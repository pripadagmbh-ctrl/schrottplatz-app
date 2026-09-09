import type { System, SimContext } from "./System";
import type { ExcavatorSystem } from "./ExcavatorSystem";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { COLLISION, GROUP } from "@/sim/world/collisionGroups";
import { clamp, quatFromAxisX, quatFromAxisY, quatMul, quatFromUnitVectors, type Quat, type Vec3 } from "@/shared/math";
import { CLAW_COUNT, CLAW_SEGMENTS, clawPoint, clawTipDepth, clawTipRadius } from "@/shared/clawGeometry";

/**
 * Kinematische Kollider des Baggers (Briefing Kap. 6.1, 6.4): Unterwagen, Hauptarm, Stiel, Spinne
 * (Traverse + 10 Krallen-Kapseln) folgen jeden Schritt der Kinematik. Die Krallen bleiben beim Tragen
 * AKTIV — die Ladung ist über die Kollisionsgruppe HELD für sie unsichtbar (E-008), nicht abgeschaltet.
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
  private raking: boolean | null = null;
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
    this.grapple = kin();
    w.createCollider(RAPIER.ColliderDesc.cylinder(Number(b["palmHalfHeight"]), Number(b["palmRadius"])).setTranslation(0, this.palmY, 0).setCollisionGroups(COLLISION.excavator), this.grapple);
    for (let i = 0; i < CLAW_COUNT * 2; i++) this.claws.push(w.createCollider(RAPIER.ColliderDesc.capsule(0.16, 0.1).setCollisionGroups(COLLISION.excavator).setFriction(0.35), this.grapple));
    this.sync(ctx, 0);
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
    // Spinne
    this.grapple.setNextKinematicTranslation(p.grapplePos);
    this.grapple.setNextKinematicRotation(p.grappleQuat);
    this.updateClaws(p.splay);
    // Krallen rechen nur mit OFFENER Spinne durch den Haufen; ab dem Schliessen (Schliessgrad ≥ clawRakeMaxClosure) beruehren
    // sie lose Teile nicht mehr — eine kinematische Zinke, die durch ein Teil faehrt, schleudert es sonst weg (E-025).
    const raking = s.grapple < Number(b["clawRakeMaxClosure"] ?? 0.1);
    if (raking !== this.raking) { this.raking = raking; const g = raking ? COLLISION.excavator : COLLISION.clawsClosed; for (const c of this.claws) c.setCollisionGroups(g); }
    if (dt > 0) this.updatePlow(ctx, dt);
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
