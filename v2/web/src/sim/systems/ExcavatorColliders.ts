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
 * Zinken-Kontakt (E-043, Spinne-Schritt 1): Die Zinken bleiben kinematisch (Daumen = Spinne, keine Feder), beruehren
 * lose Teile aber „weich": Ein Teil, das eine bewegte Zinke ueberlappt, bekommt einen begrenzten KRAFTSTOSS in
 * Zinkenrichtung — es wird geschoben, nicht geschleudert — und die Schliessbewegung wird nach geschobener Masse
 * gebremst (clawLoadFactor). Die Kollisionsgruppe der Krallen bleibt ohne LOOSE (E-025), der Schub ersetzt den Stoss.
 * Drei Regeln aus der Messung vom 09.09., jede gegen einen konkreten Fehlschlag:
 *   1. Treffer erst sammeln, dann anwenden — waehrend intersectionsWithShape laeuft, ist die Koerperliste
 *      ausgeliehen; ein Schreibzugriff im Callback verletzt den Zustand (Teile im Boden, 111 m/s, Absturz im dispose).
 *   2. Impuls statt setLinvel — ein gesetzter Geschwindigkeitswert ueberschreibt den Kontaktloeser, eingeklemmtes
 *      Material wird sonst durch seine Nachbarn und den Boden gedrueckt.
 *   3. Deckel auf das Gesamttempo — zehn Zinken zeigen in zehn Richtungen; ein Teil, das entlang jeder einzelnen
 *      noch „langsam" ist, schaukelt sich sonst ueber die Schritte auf (196 m/s).
 * Nicht geschoben werden: getragene Teile, Rumpfe von Wracks (die fuehrt das CompositeSystem per Zug).
 * BEWUSST OFFEN: Taucht die Spinne dauerhaft IN einen Haufen ein, schleudern die kinematischen Koerper weiter
 * Material weg (gemessen auch ohne diesen Schub). Dagegen hilft erst das Aufsetzen per Strahlen — Schritt 2.
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
  /** Zinken-Kontakt: Mittelpunkte der Kapseln im vorigen Schritt (Welt), fuer die Zinkengeschwindigkeit */
  private prevMid: Vec3[] = []; private prevMidInit = false;
  lastPushedKg = 0;
  /** Treffer eines Schritts (wiederverwendet, keine Allokation): Handle + Zinkenrichtung + Zinkentempo */
  private hits: { h: number; dx: number; dy: number; dz: number; mag: number }[] = [];
  private hullHandles = new Set<number>();
  private cc!: Record<string, number | string>;

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
    this.cc = ctx.data.balancing.clawContact;
    for (let i = 0; i < CLAW_COUNT * 2; i++) this.prevMid.push({ x: 0, y: 0, z: 0 });
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
    if (dt > 0) { this.pushLoose(ctx, dt); this.updatePlow(ctx, dt); }
  }

  /**
   * Weicher Zinken-Kontakt (E-043): fuer jede Kapsel die Bewegung seit dem letzten Schritt bestimmen; lose Teile, die sie
   * ueberlappt, bekommen diese Geschwindigkeit (auf pushMaxMs gekappt, nur die Komponente in Zinkenrichtung, nie nach unten
   * unter Bodenniveau). Die geschobene Masse bremst das Schliessen: Faktor 1 − kg/brakeRefKg, mindestens brakeMin.
   * Bewusst kinematisch: der Daumen bleibt die Spinne; ein Teil, das nicht ausweichen kann, wird ueberlappt statt gequetscht.
   */
  private pushLoose(ctx: SimContext, dt: number): void {
    const w = ctx.physics.world; const c = this.cc;
    const vMax = Number(c["pushMaxMs"] ?? 1.5), minMove = Number(c["minClawSpeedMs"] ?? 0.05);
    let pushedKg = 0;
    const seen = new Set<number>();
    // Treffer erst SAMMELN, danach anwenden: Waehrend intersectionsWithShape laeuft, ist die Koerperliste an Rapier
    // ausgeliehen; ein Schreibzugriff im Callback verletzt den Zustand (Messung 09.09.: Teile im Boden, 111 m/s,
    // "attempted to take ownership of Rust value while it was borrowed" beim dispose).
    const hits = this.hits; hits.length = 0;
    // Rumpfe von Wracks bleiben aussen vor: Eine Spinne schiebt kein 900-kg-Auto, und wer daran zerrt, wird vom
    // CompositeSystem gefuehrt (Zug statt Schub). Sonst verschoebe der Zinken-Kontakt das Abreissen von Baugruppen.
    const hulls = this.hullHandles; hulls.clear();
    for (const st of ctx.world.composites.values()) { const it = ctx.world.items.get(st.hullItemId); if (it?.bodyHandle !== undefined) hulls.add(it.bodyHandle); }
    for (let i = 0; i < this.claws.length; i++) {
      const col = this.claws[i]!; const t = col.translation(); const prev = this.prevMid[i]!;
      if (this.prevMidInit) {
        let vx = (t.x - prev.x) / dt, vy = (t.y - prev.y) / dt, vz = (t.z - prev.z) / dt;
        const sp = Math.hypot(vx, vy, vz);
        if (sp > minMove && sp < 30) { // Teleport (Laden, Tests) schiebt nichts
          if (sp > vMax) { vx *= vMax / sp; vy *= vMax / sp; vz *= vMax / sp; }
          const mag = Math.hypot(vx, vy, vz), dx = vx / mag, dy = vy / mag, dz = vz / mag;
          w.intersectionsWithShape(t, col.rotation(), col.shape, (other) => {
            const b = other.parent(); if (!b || !b.isDynamic() || seen.has(b.handle) || this.heldHandles.has(b.handle) || hulls.has(b.handle)) return true;
            if (!ctx.physics.itemOf(b.handle)) return true;
            seen.add(b.handle); pushedKg += b.mass();
            hits.push({ h: b.handle, dx, dy, dz, mag });
            return true;
          }, undefined, (GROUP.LOOSE << 16) | GROUP.LOOSE);
        }
      }
      prev.x = t.x; prev.y = t.y; prev.z = t.z;
    }
    const gain = Number(c["pushGain"] ?? 0.35);
    for (const hit of hits) {
      const b = ctx.physics.safeBody(hit.h); if (!b) continue;
      const v = b.linvel();
      // Nur nachschieben, wenn das Teil in Zinkenrichtung langsamer ist als die Zinke. IMPULS statt setLinvel: ein
      // gesetzter Geschwindigkeitswert ueberschreibt jeden Schritt das Ergebnis des Kontaktloesers, eingeklemmtes
      // Material wird dann durch seine Nachbarn gedrueckt. Ein Kraftstoss laesst den Loeser gegenhalten — Material,
      // das nicht ausweichen kann, bleibt liegen und bremst stattdessen das Schliessen (clawLoadFactor).
      // Deckel auf das GESAMTTEMPO, nicht nur auf die Komponente entlang dieser Zinke: zehn Zinken zeigen in zehn
      // Richtungen, und ein Teil, das entlang jeder einzelnen noch „langsam" ist, wuerde sich sonst ueber die Schritte
      // aufschaukeln (Messung 09.09.: 196 m/s im Haufen).
      if (Math.hypot(v.x, v.y, v.z) > vMax * Number(c["pushSpeedCapFactor"] ?? 1.5)) continue;
      const along = v.x * hit.dx + v.y * hit.dy + v.z * hit.dz;
      if (along >= hit.mag) continue;
      const dv = Math.min(hit.mag - along, vMax) * gain, m = b.mass();
      let iy = hit.dy * dv * m;
      if (iy < 0 && b.translation().y < 0.35) iy = 0; // knapp ueber dem Boden nie nach unten stossen
      b.applyImpulse({ x: hit.dx * dv * m, y: iy, z: hit.dz * dv * m }, true);
    }
    this.prevMidInit = true;
    this.lastPushedKg = pushedKg;
    const target = clamp(1 - pushedKg / Number(c["brakeRefKg"] ?? 600), Number(c["brakeMin"] ?? 0.35), 1);
    this.ex.clawLoadFactor += (target - this.ex.clawLoadFactor) * Math.min(dt * 8, 1);
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
