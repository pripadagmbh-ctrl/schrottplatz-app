import type { System, SimContext } from "./System";
import type { ExcavatorSystem } from "./ExcavatorSystem";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { COLLISION, GROUP } from "@/sim/world/collisionGroups";
import { clamp, quatFromAxisX, quatFromAxisY, quatMul, quatFromUnitVectors, type Quat, type Vec3 } from "@/shared/math";
import { CLAW_COUNT, CLAW_SEGMENTS, clawPoint, clawTipDepth, clawTipRadius } from "@/shared/clawGeometry";

/**
 * Kollider des Baggers (Briefing Kap. 6.1, 6.4): Unterwagen, Hauptarm, Stiel folgen kinematisch der Kinematik.
 * Die Spinne (Traverse + 10 Krallen-Kapseln) ist seit Spinne 2.0 (E-038) ein DYNAMISCHER Koerper (~900 kg), der am
 * Kardanpunkt des Stiels an einer Feder-Daempfer-Aufhaengung haengt: Federkraft gekappt (maxForceN), Gieren ueber ein
 * Drehmoment zum Sollwinkel. Folgen: sie pendelt echt, stuetzt sich auf Boden und Haufen ab statt einzutauchen, und
 * ihre Krallen schieben lose Teile mit endlicher Kraft — kein Wegschleudern durch unendlich schwere Kinematik mehr.
 * Die Ladung ist ueber die Kollisionsgruppe HELD fuer sie unsichtbar (E-008).
 *
 * Pflügwiderstand: Eine Sonde in Bewegungsrichtung der Spinne (nur wenn sie sich bewegt) summiert die Masse
 * der losen Teile, in die sie hineinfährt → Faktor auf die Armachsen. Senkt man die offene Spinne über einen
 * Haufen, gibt es keinen Widerstand bis zum Kontakt (Gerätetest 02.09., Befund 3).
 */
export class ExcavatorColliders implements System {
  readonly name = "excavatorColliders";
  readonly phase = "preStep" as const;
  readonly order = 10;

  private ex!: ExcavatorSystem;
  private chassis!: RAPIER.RigidBody; private boom!: RAPIER.RigidBody; private stick!: RAPIER.RigidBody; grapple!: RAPIER.RigidBody;
  private claws: RAPIER.Collider[] = [];
  private gp!: Record<string, number | string>;
  private readonly f: Vec3 = { x: 0, y: 0, z: 0 };
  /** letzte Federkompression (Kardan-Soll unter Kardan-Ist), fuer Anschlag/Audio */
  compressionM = 0;
  /** Krallen-Kollider fuer Kontaktabfragen (GripSystem: „Zinke beruehrt Teil → gegriffen") */
  get clawColliders(): readonly RAPIER.Collider[] { return this.claws; }
  private probe = new RAPIER.Ball(0.5);
  private plowRef = 800; private plowMin = 0.3;
  private boomLen = 0; stickLen = 0; palmY = 0;
  // Temporäre Werte (keine Allokation im Step)
  private qYaw: Quat = { x: 0, y: 0, z: 0, w: 1 }; private qPitch: Quat = { x: 0, y: 0, z: 0, w: 1 }; private q: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private a: Vec3 = { x: 0, y: 0, z: 0 }; private bV: Vec3 = { x: 0, y: 0, z: 0 }; private dir: Vec3 = { x: 0, y: 0, z: 0 };
  private up: Vec3 = { x: 0, y: 1, z: 0 };
  /** Handles der gerade gehaltenen Teile — die zählen nicht als Widerstand */
  heldHandles = new Set<number>();
  lastPlowMassKg = 0;

  init(ctx: SimContext): void {
    this.ex = ctx.get<ExcavatorSystem>("excavator");
    const w = ctx.physics.world;
    const b = ctx.data.balancing.excavator as Record<string, number | number[]>;
    const g = ctx.data.balancing.grip;
    this.plowRef = Number(g["plowMassRefKg"]); this.plowMin = Number(g["plowFactorMin"]);
    this.boomLen = Number(b["boomLenM"]); this.stickLen = Number(b["stickLenM"]); this.palmY = this.ex.palmY;
    const ch = b["chassisHalf"] as number[], bh = b["boomHalf"] as number[], sh = b["stickHalf"] as number[];
    const kin = () => w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.chassis = kin(); w.createCollider(RAPIER.ColliderDesc.cuboid(ch[0]!, ch[1]!, ch[2]!).setCollisionGroups(COLLISION.excavator), this.chassis);
    this.boom = kin(); w.createCollider(RAPIER.ColliderDesc.cuboid(bh[0]!, bh[1]!, bh[2]!).setCollisionGroups(COLLISION.excavator), this.boom);
    this.stick = kin(); w.createCollider(RAPIER.ColliderDesc.cuboid(sh[0]!, sh[1]!, sh[2]!).setCollisionGroups(COLLISION.excavator), this.stick);
    // Spinne: dynamisch, Ursprung = Kardanpunkt; Masse ueber die Traverse (Schwerpunkt unter dem Kardan → haengt von selbst lotrecht)
    this.gp = ctx.data.balancing.grapple;
    const p0 = this.ex.pose.stickTip;
    this.grapple = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p0.x, p0.y, p0.z)
      .setLinearDamping(Number(this.gp["linearDamping"])).setAngularDamping(Number(this.gp["angularDamping"])).setCcdEnabled(true).setCanSleep(false));
    w.createCollider(RAPIER.ColliderDesc.cylinder(Number(b["palmHalfHeight"]), Number(b["palmRadius"])).setTranslation(0, this.palmY, 0).setMass(Number(this.gp["massKg"]) * 0.7).setCollisionGroups(COLLISION.grapple).setFriction(0.5), this.grapple);
    const clawMass = (Number(this.gp["massKg"]) * 0.3) / (CLAW_COUNT * 2);
    for (let i = 0; i < CLAW_COUNT * 2; i++) this.claws.push(w.createCollider(RAPIER.ColliderDesc.capsule(0.16, 0.1).setMass(clawMass).setCollisionGroups(COLLISION.grapple).setFriction(Number(this.gp["clawFriction"])).setRestitution(Number(this.gp["clawRestitution"])), this.grapple));
    this.sync(ctx, 0);
    this.ex.syncFromBody(this.grapple.translation(), this.grapple.rotation(), 0);
  }

  update(ctx: SimContext, dt: number): void {
    this.sync(ctx, dt);
  }

  private sync(ctx: SimContext, dt: number): void {
    const s = ctx.world.excavator; const p = this.ex.pose;
    const b = ctx.data.balancing.excavator as Record<string, number>;
    // Unterwagen
    quatFromAxisY(s.heading, this.q);
    this.chassis.setNextKinematicTranslation({ x: s.pos.x, y: s.pos.y + Number(b["chassisCenterY"]), z: s.pos.z });
    this.chassis.setNextKinematicRotation(this.q);
    // Hauptarm: Mitte zwischen Drehpunkt und Auslegerende, Rotation = Gieren × Neigung(−boom)
    const yaw = s.heading + s.cab, sy = Math.sin(yaw), cy = Math.cos(yaw);
    quatFromAxisY(yaw, this.qYaw);
    quatMul(this.qYaw, quatFromAxisX(-s.boom, this.qPitch), this.q);
    const bl = this.boomLen, cb = Math.cos(s.boom), sb = Math.sin(s.boom);
    this.boom.setNextKinematicTranslation({ x: p.boomPivot.x + (bl / 2) * cb * sy, y: p.boomPivot.y + (bl / 2) * sb, z: p.boomPivot.z + (bl / 2) * cb * cy });
    this.boom.setNextKinematicRotation(this.q);
    // Stiel
    const tot = s.boom + s.stick, ct = Math.cos(tot), st = Math.sin(tot), sl = this.stickLen;
    const bex = p.boomPivot.x + bl * cb * sy, bey = p.boomPivot.y + bl * sb, bez = p.boomPivot.z + bl * cb * cy;
    quatMul(this.qYaw, quatFromAxisX(-tot, this.qPitch), this.q);
    this.stick.setNextKinematicTranslation({ x: bex + (sl / 2) * ct * sy, y: bey + (sl / 2) * st, z: bez + (sl / 2) * ct * cy });
    this.stick.setNextKinematicRotation(this.q);
    // Spinne: Krallen nach Spreizung stellen, dann Feder-Daempfer zum Kardanpunkt und Gier-Drehmoment
    this.updateClaws(p.splay);
    if (dt > 0) { this.applySuspension(p); this.wakeTouched(ctx); this.updatePlow(ctx, dt); }
  }

  /**
   * Feder-Daempfer vom Kardan-Soll (Stielspitze, kinematisch) zum Kardan-Ist (Koerperursprung): F = k·Δx − c·v, gekappt.
   * Angriffspunkt = Kardan → die Feder zieht am oberen Ende, der Koerper pendelt darunter aus (echtes Pendel).
   * Gieren: Drehmoment um die Weltachse Y zum Sollwinkel (Oberwagen + Rotator), gedaempft.
   */
  private applySuspension(p: { stickTip: Vec3; grappleYaw: number }): void {
    const g = this.gp, body = this.grapple;
    const t = body.translation(); let v = body.linvel();
    // Sicherheitsnetz: Kontaktkorrekturen (Kralle im Teil, Teil am Boden verkeilt) duerfen den 900-kg-Koerper nicht
    // wegschleudern — Geschwindigkeit hart gekappt (maxSpeedMs), Drehrate ebenso.
    const vMax = Number(g["maxSpeedMs"] ?? 4), sp = Math.hypot(v.x, v.y, v.z);
    if (sp > vMax) { body.setLinvel({ x: (v.x / sp) * vMax, y: (v.y / sp) * vMax, z: (v.z / sp) * vMax }, true); v = body.linvel(); }
    const w0 = body.angvel(), wMax = Number(g["maxAngularRadS"] ?? 6), ws = Math.hypot(w0.x, w0.y, w0.z);
    if (ws > wMax) body.setAngvel({ x: (w0.x / ws) * wMax, y: (w0.y / ws) * wMax, z: (w0.z / ws) * wMax }, true);
    const k = Number(g["springNPerM"]), c = Number(g["damperNsPerM"]), fMax = Number(g["maxForceN"]);
    this.f.x = k * (p.stickTip.x - t.x) - c * v.x; this.f.y = k * (p.stickTip.y - t.y) - c * v.y; this.f.z = k * (p.stickTip.z - t.z) - c * v.z;
    // Kappung getrennt fuer waagerecht und senkrecht: die Abstuetzkraft nach unten (Spinne sitzt auf) darf das Budget
    // fuers seitliche Nachziehen nicht aufbrauchen — sonst bleibt die aufgesetzte Spinne stehen, wenn der Arm schwenkt.
    const magH = Math.hypot(this.f.x, this.f.z);
    if (magH > fMax) { const s = fMax / magH; this.f.x *= s; this.f.z *= s; }
    this.f.y = clamp(this.f.y, -fMax, fMax);
    body.resetForces(false); body.resetTorques(false);
    body.addForceAtPoint(this.f, t, true);
    // Gieren zum Sollwinkel
    const r = body.rotation();
    const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.z * r.z));
    let d = p.grappleYaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    const w = body.angvel();
    // Aufricht-Moment: das Kardangelenk laesst Neigung zu, aber eine Spinne, deren Spitzen am Boden haengen bleiben,
    // darf nicht ueberschlagen (Test: Schwenken mit aufgesetzter Spinne kippte sie auf den Ruecken). Neigungsvektor =
    // Welt-Hoch × Koerper-Hoch; Moment dagegen, dazu Daempfung der Kipp-Drehraten.
    this.f.x = 0; this.f.y = 1; this.f.z = 0; // Koerper-Hoch
    const ux = 2 * (r.x * r.y - r.w * r.z), uy = 1 - 2 * (r.x * r.x + r.z * r.z), uz = 2 * (r.y * r.z + r.w * r.x);
    const kt = Number(g["uprightTorqueNm"]), ct = Number(g["tiltDampingNms"]);
    // up × bodyUp = (0,1,0) × (ux,uy,uz) = (uz, 0, -ux)
    void uy;
    body.addTorque({ x: -kt * uz - ct * w.x, y: Number(g["yawTorqueNm"]) * d - Number(g["yawDampingNms"]) * w.y, z: kt * ux - ct * w.z }, true);
    this.compressionM = p.stickTip.y - t.y < 0 ? t.y - p.stickTip.y : 0;
  }

  /**
   * Teile, die der Spinnenkoerper beruehrt, wecken. Das gemeinsame Schlafen (E-012) legt Teile per sleep() schlafen;
   * ein Kontakt mit dem dynamischen Spinnenkoerper weckt sie nicht zuverlaessig — dann faellt ein angestossenes Teil
   * „schlafend" durch den Boden (Test grapple2, Coil bei −0,63 m).
   */
  private wakeTouched(ctx: SimContext): void {
    const w = ctx.physics.world;
    for (let i = 0; i < this.grapple.numColliders(); i++) {
      w.contactPairsWith(this.grapple.collider(i), (other) => { const b = other.parent(); if (b && b.isDynamic() && b.isSleeping()) b.wakeUp(); });
    }
  }

  /** Spinne hart an den Kardan setzen (Laden, Teleport, Tests) — ohne Riesenimpuls. */
  teleportGrapple(p: Vec3, yaw: number): void {
    // nie in den Boden setzen: Spitzen der aktuellen Spreizung bleiben ueber dem Beton (Rapier wuerde den Koerper sonst herausschleudern)
    const minY = clawTipDepth(this.ex.pose.splay) + 0.05;
    this.grapple.setTranslation({ x: p.x, y: Math.max(p.y, minY), z: p.z }, true); this.grapple.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    this.grapple.setLinvel({ x: 0, y: 0, z: 0 }, true); this.grapple.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Je zwei Kapseln bilden die Sichel jeder Kralle nach (excavator.ts:964-985). clawPoint rechnet ab Kardangelenk (CLAW_RING_Y). */
  private updateClaws(splay: number): void {
    for (let c = 0; c < CLAW_COUNT; c++) {
      const ang = (c / CLAW_COUNT) * Math.PI * 2;
      for (let h = 0; h < 2; h++) {
        const col = this.claws[c * 2 + h]!;
        clawPoint(ang, splay, h * (CLAW_SEGMENTS / 2), this.a);
        clawPoint(ang, splay, (h + 1) * (CLAW_SEGMENTS / 2), this.bV);
        this.dir.x = this.bV.x - this.a.x; this.dir.y = this.bV.y - this.a.y; this.dir.z = this.bV.z - this.a.z;
        const len = Math.hypot(this.dir.x, this.dir.y, this.dir.z);
        if (len < 1e-4) continue;
        this.dir.x /= len; this.dir.y /= len; this.dir.z /= len;
        quatFromUnitVectors(this.up, this.dir, this.q);
        col.setHalfHeight(Math.max(len / 2 - 0.1, 0.03));
        col.setTranslationWrtParent({ x: (this.a.x + this.bV.x) / 2, y: (this.a.y + this.bV.y) / 2, z: (this.a.z + this.bV.z) / 2 });
        col.setRotationWrtParent(this.q);
      }
    }
  }

  /** Sonde in Bewegungsrichtung: Masse der losen Teile, in die der Korb hineinfährt (Kap. 6.4). */
  private updatePlow(ctx: SimContext, dt: number): void {
    const v = this.ex.grappleVel;
    const speed = Math.hypot(v.x, v.y, v.z);
    let mass = 0;
    if (speed > 0.15) {
      const p = this.ex.pose;
      // Sonde sitzt an den Krallenspitzen (Unterkante = Spitzen), nicht in der Korbmitte — sonst bremst sie
      // schon einen Meter über dem Haufen (Prototyp-Fehler, Messung 4 vom 02.09.: Sonde 79 cm tiefer als die Spitzen).
      const r = Math.max(clawTipRadius(p.splay), 0.3);
      this.probe.radius = r;
      const ahead = 0.3;
      const cy = p.grapplePos.y - clawTipDepth(p.splay) + r;
      const px = p.grapplePos.x + (v.x / speed) * ahead, py = cy + (v.y / speed) * ahead, pz = p.grapplePos.z + (v.z / speed) * ahead;
      ctx.physics.world.intersectionsWithShape({ x: px, y: py, z: pz }, { x: 0, y: 0, z: 0, w: 1 }, this.probe, (col) => {
        const body = col.parent();
        if (body && body.isDynamic() && !this.heldHandles.has(body.handle)) mass += body.mass();
        return true;
      }, undefined, (GROUP.LOOSE << 16) | GROUP.LOOSE);
    }
    this.lastPlowMassKg = mass;
    const target = clamp(1 - mass / this.plowRef, this.plowMin, 1);
    this.ex.plowFactor += (target - this.ex.plowFactor) * Math.min(dt * 6, 1);
  }

  dispose(): void { this.claws.length = 0; }
}
