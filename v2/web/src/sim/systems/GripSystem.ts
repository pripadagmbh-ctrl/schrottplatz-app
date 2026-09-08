import type { System, SimContext } from "./System";
import type { ExcavatorSystem } from "./ExcavatorSystem";
import type { ExcavatorColliders } from "./ExcavatorColliders";
import type { ScrapItem } from "@/sim/world/WorldState";
import type { ItemId } from "@/shared/ids";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { COLLISION } from "@/sim/world/collisionGroups";
import { clamp, quatConj, quatMul, rotateVec, slerp, type Quat, type Vec3 } from "@/shared/math";
import { CLAW_OPEN_SPLAY, CLAW_RING_R, CLAW_RING_Y, CLAW_SEGMENTS, clawPoint } from "@/shared/clawGeometry";

/**
 * Greifen kinematisch (Briefing Kap. 6.2, 6.3; Entscheidung M2-1). Kein Fixed Joint:
 *  1. Sensor-Kugel in der Korbmitte findet Kandidaten; nur was wirklich im Schalenkorb liegt, zählt (Korbgeometrie).
 *  2. Greiffenster: Schließgrad 0,6–0,98 und Spieler schließt.
 *  3. Gegriffenes Teil wird kinematisch, wechselt in Gruppe HELD (kollidiert mit Boden/Haufen, nie mit dem Bagger)
 *     und wandert in 0,25 s in die Haltepose: seitlich zentriert, Höhe bleibt (kein „Hochsaugen" — Gerätetest 08.09.),
 *     höchstens so weit angehoben, dass die Unterkante auf den geschlossenen Krallenspitzen aufliegt.
 *  4. Loslassen: wieder dynamisch, Gruppe LOOSE, Geschwindigkeit der Spinne (Mittel der letzten Schritte) + etwas abwärts.
 *  5. Abrutsch-Regeln (Kap. 6.3): Überlast → kein Griff; Schwungwurf → Verlust nach 1,5 s. Aufprall-Regel folgt mit Kontakt-Events (M3).
 *  6. `itemRemoving` (Presse, Verkauf) löst den Griff sofort — der H1-Absturz des Prototyps.
 *  7. Losgelassene Teile kollidieren `releaseGraceSeconds` lang nicht mit dem Bagger (E-018): die Krallen sind beim
 *     Loslassen noch fast zu und die Spinne kann noch sinken — sonst quetschen die kinematischen Krallen das Teil
 *     gegen den Boden und es schießt mit > 5 m/s weg („Teile fliegen umher", Playtest M2).
 */
interface Held {
  id: ItemId; handle: number; massKg: number;
  /** Zielpose relativ zur Spinne (lokal) */
  localPos: Vec3; localRot: Quat;
  /** Startpose relativ zur Spinne beim Zupacken (für die Interpolation) */
  fromPos: Vec3; fromRot: Quat;
  t: number; // 0..1 Haltepose erreicht
}

export class GripSystem implements System {
  readonly name = "grip";
  readonly phase = "preStep" as const;
  readonly order = 20;

  private ex!: ExcavatorSystem;
  private cols!: ExcavatorColliders;
  private held: Held[] = [];
  private sensor = new RAPIER.Ball(1);
  private maxItems = 5; maxTotalKg = 3500; winStart = 0.6; winEnd = 0.98; holdPoseS = 0.15; releaseDown = 0.2;
  private slipSwingFrac = 0.9; slipLoadFrac = 0.6; slipSwingS = 1.5; slipTimer = 0;
  private velHist: Vec3[] = []; velAvgSteps = 3;
  /** Rückmeldung fürs HUD: letzter Grund, warum nicht gegriffen wurde */
  lastRefusal: "none" | "tooHeavy" | "full" = "none";
  private wasClosing = false; private snapRadius = 0.5; private snapBall = new RAPIER.Ball(1);
  /** Zähler für Tests: wie oft der Greif-Magnet ausgelöst hat */
  snapCount = 0;
  private graceS = 0.6; private released: { handle: number; t: number }[] = [];
  // Temporär
  private q: Quat = { x: 0, y: 0, z: 0, w: 1 }; private qInv: Quat = { x: 0, y: 0, z: 0, w: 1 }; private qOut: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private v: Vec3 = { x: 0, y: 0, z: 0 }; private tip: Vec3 = { x: 0, y: 0, z: 0 };
  private ctx!: SimContext;

  get heldIds(): ItemId[] { return this.held.map((h) => h.id); }
  get totalMassKg(): number { return this.held.reduce((s, h) => s + h.massKg, 0); }
  get count(): number { return this.held.length; }

  init(ctx: SimContext): void {
    this.ctx = ctx;
    this.ex = ctx.get<ExcavatorSystem>("excavator");
    this.cols = ctx.get<ExcavatorColliders>("excavatorColliders");
    const g = ctx.data.balancing.grip;
    this.maxItems = Number(g["maxItems"]); this.maxTotalKg = Number(g["maxTotalKg"]);
    this.sensor.radius = Number(g["sensorRadiusM"]);
    this.winStart = Number(g["grabWindowStart"]); this.winEnd = Number(g["grabWindowEnd"]);
    this.holdPoseS = Number(g["holdPoseSeconds"]); this.releaseDown = Number(g["releaseDownwardMs"]);
    this.slipSwingFrac = Number(g["slipSwingFraction"]); this.slipLoadFrac = Number(g["slipLoadFraction"]); this.slipSwingS = Number(g["slipSwingSeconds"]);
    this.velAvgSteps = Number(g["releaseVelocityAvgSteps"] ?? 3);
    this.snapRadius = Number(ctx.data.balancing.assist["snapRadiusM"]);
    this.graceS = Number(g["releaseGraceSeconds"] ?? 0.6);
    this.snapBall.radius = this.sensor.radius + this.snapRadius + 1.0;
    ctx.bus.on("itemRemoving", ({ itemId }) => this.dropById(itemId, "removed"));
  }

  update(ctx: SimContext, dt: number): void {
    const s = ctx.world.excavator;
    const p = this.ex.pose;
    // Geschwindigkeitsverlauf für das Loslassen
    this.velHist.push({ x: this.ex.grappleVel.x, y: this.ex.grappleVel.y, z: this.ex.grappleVel.z });
    if (this.velHist.length > this.velAvgSteps) this.velHist.shift();

    if (!this.ex.closing) {
      if (this.held.length > 0) this.releaseAll("opened");
      this.slipTimer = 0;
    } else {
      // Greif-Magnet genau beim Beginn des Schließens (Flanke), nur mit leerer Spinne
      if (!this.wasClosing && this.held.length === 0) this.trySnap(ctx);
      if (s.grapple >= this.winStart && s.grapple <= this.winEnd) this.tryGrab(ctx);
    }
    this.wasClosing = this.ex.closing;

    // Schwungwurf-Regel (Kap. 6.3)
    if (this.held.length > 0) {
      const cabMax = Math.abs(this.ex.cabVel) / (Number((ctx.data.balancing.excavator as Record<string, number>)["cabRateDegS"]) * Math.PI / 180);
      const loadFrac = this.totalMassKg / this.maxTotalKg;
      if (cabMax > this.slipSwingFrac && loadFrac > this.slipLoadFrac) { this.slipTimer += dt; if (this.slipTimer > this.slipSwingS) { this.releaseAll("slip"); this.slipTimer = 0; } }
      else this.slipTimer = Math.max(0, this.slipTimer - dt);
    }

    // Gehaltene Teile mitführen (Haltepose interpolieren); dabei Unterkante der Ladung für den Bodenanschlag messen
    let bottom = 0;
    for (const h of this.held) {
      const body = ctx.physics.safeBody(h.handle);
      const item = ctx.world.items.get(h.id);
      if (!body || !item) continue;
      bottom = Math.max(bottom, p.grapplePos.y - (body.translation().y - this.worldHalfHeight(item.size, body.rotation())));
      h.t = Math.min(1, h.t + dt / this.holdPoseS);
      const k = h.t * h.t * (3 - 2 * h.t); // weich
      const lx = h.fromPos.x + (h.localPos.x - h.fromPos.x) * k, ly = h.fromPos.y + (h.localPos.y - h.fromPos.y) * k, lz = h.fromPos.z + (h.localPos.z - h.fromPos.z) * k;
      slerp(h.fromRot, h.localRot, k, this.qOut);
      this.v.x = lx; this.v.y = ly; this.v.z = lz;
      rotateVec(p.grappleQuat, this.v, this.v);
      body.setNextKinematicTranslation({ x: p.grapplePos.x + this.v.x, y: p.grapplePos.y + this.v.y, z: p.grapplePos.z + this.v.z });
      quatMul(p.grappleQuat, this.qOut, this.q);
      body.setNextKinematicRotation(this.q);
    }
    this.ex.carriedMassKg = this.totalMassKg; this.ex.carriedCount = this.held.length; this.ex.carriedBottomM = bottom;

    // Schonfrist nach dem Loslassen ablaufen lassen → zurück in die normale Gruppe
    for (let i = this.released.length - 1; i >= 0; i--) {
      const r = this.released[i]!; r.t -= dt;
      if (r.t > 0) continue;
      const body = ctx.physics.safeBody(r.handle);
      if (body) for (let c = 0; c < body.numColliders(); c++) body.collider(c).setCollisionGroups(COLLISION.loose);
      this.released.splice(i, 1);
    }
  }

  /** Halbe Höhe der Welt-AABB eines gedrehten Quaders: Σ half_i · |y-Anteil der gedrehten Achse i|. */
  private worldHalfHeight(size: readonly [number, number, number], r: { x: number; y: number; z: number; w: number }): number {
    const hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    // y-Komponenten der gedrehten Einheitsachsen (Zeilen der Rotationsmatrix)
    const ax = 2 * (r.x * r.y + r.w * r.z), ay = 1 - 2 * (r.x * r.x + r.z * r.z), az = 2 * (r.y * r.z - r.w * r.x);
    return hx * Math.abs(ax) + hy * Math.abs(ay) + hz * Math.abs(az);
  }

  private tryGrab(ctx: SimContext): void {
    if (this.held.length >= this.maxItems) { this.lastRefusal = "full"; return; }
    const p = this.ex.pose;
    const candidates: { item: ScrapItem; body: RAPIER.RigidBody }[] = [];
    ctx.physics.world.intersectionsWithShape(p.sensorPos, { x: 0, y: 0, z: 0, w: 1 }, this.sensor, (col) => {
      const body = col.parent();
      if (!body || !body.isDynamic()) return true;
      const id = ctx.physics.itemOf(body.handle);
      if (!id) return true;
      const item = ctx.world.items.get(id);
      if (!item || item.state !== "loose") return true;
      const t = body.translation();
      if (this.insideBasket(t.x, t.y, t.z)) candidates.push({ item, body });
      return true;
    }, undefined, COLLISION.loose);
    // Nächstes zum Sensor zuerst
    candidates.sort((a, b) => dist2(a.body.translation(), p.sensorPos) - dist2(b.body.translation(), p.sensorPos));
    for (const c of candidates) {
      if (this.held.length >= this.maxItems) { this.lastRefusal = "full"; break; }
      const mass = c.body.mass();
      if (this.totalMassKg + mass > this.maxTotalKg) { this.lastRefusal = "tooHeavy"; continue; }
      this.grab(ctx, c.item, c.body);
    }
  }

  /**
   * Greif-Magnet (Briefing Kap. 5.4, E-016): Liegt genau ein loses Einzelteil bis `snapRadiusM` seitlich
   * über den Korbrand hinaus — und keines im Korb —, gleiten Oberwagen/Stiel auf dieses Teil. Verbundteile nie.
   * Vertikal zählt nur, was in Greifhöhe liegt (dieselben Grenzen wie der Korb).
   */
  private trySnap(ctx: SimContext): void {
    const p = this.ex.pose;
    // Korb so, wie er beim Beginn des Greiffensters aussieht (Spreizung bei Schließgrad winStart, leere Spinne):
    // die offene Spinne ist deutlich weiter als der Korb, der das Teil am Ende hält.
    clawPoint(0, CLAW_OPEN_SPLAY * (1 - this.winStart), CLAW_SEGMENTS, this.tip);
    const basketR = Math.max(this.tip.z, CLAW_RING_R) + Number(ctx.data.balancing.grip["basketMarginM"]);
    let inside = 0, outside = 0, tx = 0, tz = 0, composite = false;
    ctx.physics.world.intersectionsWithShape(p.sensorPos, { x: 0, y: 0, z: 0, w: 1 }, this.snapBall, (col) => {
      const body = col.parent(); if (!body || !body.isDynamic()) return true;
      const id = ctx.physics.itemOf(body.handle); const item = id ? ctx.world.items.get(id) : undefined;
      if (!item || item.state !== "loose") return true;
      const t = body.translation();
      if (!this.insideBasketHeight(t.y)) return true;
      const d = Math.hypot(t.x - p.sensorPos.x, t.z - p.sensorPos.z);
      if (d <= basketR) inside++;
      else if (d <= basketR + this.snapRadius) { outside++; tx = t.x; tz = t.z; if (item.compositeId) composite = true; }
      return true;
    }, undefined, COLLISION.loose);
    if (inside === 0 && outside === 1 && !composite) { this.ex.beginSnap(tx, tz); this.snapCount++; }
  }

  private insideBasketHeight(y: number): boolean {
    const p = this.ex.pose, g = this.ctx.data.balancing.grip;
    const rel = y - p.grapplePos.y;
    return rel <= CLAW_RING_Y + Number(g["basketTopMarginM"]) && rel >= this.tip.y - Number(g["basketBottomMarginM"]);
  }

  /** Liegt der Weltpunkt im Schalenkorb? Korb = Kegelstumpf Gelenkring → Spitzen, mit Luft (excavator.ts:1553-1575). */
  private insideBasket(x: number, y: number, z: number): boolean {
    const p = this.ex.pose;
    const g = this.ctx.data.balancing.grip;
    this.v.x = x - p.grapplePos.x; this.v.y = y - p.grapplePos.y; this.v.z = z - p.grapplePos.z;
    rotateVec(quatConj(p.grappleQuat, this.qInv), this.v, this.v);
    clawPoint(0, p.splay, CLAW_SEGMENTS, this.tip);
    const tipY = this.tip.y, tipR = Math.max(this.tip.z, 0);
    if (this.v.y > CLAW_RING_Y + Number(g["basketTopMarginM"]) || this.v.y < tipY - Number(g["basketBottomMarginM"])) return false;
    const t = clamp((CLAW_RING_Y - this.v.y) / Math.max(CLAW_RING_Y - tipY, 0.01), 0, 1);
    const r = CLAW_RING_R + (tipR - CLAW_RING_R) * t + Number(g["basketMarginM"]);
    return Math.hypot(this.v.x, this.v.z) <= r;
  }

  private grab(ctx: SimContext, item: ScrapItem, body: RAPIER.RigidBody): void {
    const p = this.ex.pose;
    // Startpose relativ zur Spinne
    const t = body.translation(), r = body.rotation();
    this.v.x = t.x - p.grapplePos.x; this.v.y = t.y - p.grapplePos.y; this.v.z = t.z - p.grapplePos.z;
    quatConj(p.grappleQuat, this.qInv);
    rotateVec(this.qInv, this.v, this.v);
    const fromPos: Vec3 = { x: this.v.x, y: this.v.y, z: this.v.z };
    const fromRot: Quat = quatMul(this.qInv, r, { x: 0, y: 0, z: 0, w: 1 });
    // Haltepose: seitlich in die Korbmitte, Höhe behalten; Unterkante mindestens auf Höhe der geschlossenen Spitzen
    // (Patrick 08.09.: „Teile rutschen unnatürlich nach oben" — vorher wurde alles auf Sensorhöhe gezogen, 0,7 m über den Spitzen)
    const halfH = this.worldHalfHeight(item.size, r);
    clawPoint(0, 0, CLAW_SEGMENTS, this.tip); // Spitzen bei geschlossener Spinne
    const minY = this.tip.y + halfH;
    const topY = CLAW_RING_Y - halfH; // nie in die Traverse hinein
    const localPos: Vec3 = { x: 0, y: clamp(Math.max(fromPos.y, minY), Math.min(minY, topY), Math.max(minY, topY)), z: 0 };
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    for (let i = 0; i < body.numColliders(); i++) body.collider(i).setCollisionGroups(COLLISION.held);
    item.state = "held";
    this.held.push({ id: item.id, handle: body.handle, massKg: body.mass(), localPos, localRot: { ...fromRot }, fromPos, fromRot, t: 0 });
    this.cols.heldHandles.add(body.handle);
    ctx.bus.emit("itemGrabbed", { itemId: item.id, kg: body.mass() });
  }

  private releaseAll(reason: "opened" | "slip"): void {
    for (const h of [...this.held]) this.release(h, reason);
  }

  private release(h: Held, reason: "opened" | "slip" | "removed"): void {
    const idx = this.held.indexOf(h); if (idx >= 0) this.held.splice(idx, 1);
    this.cols.heldHandles.delete(h.handle);
    const body = this.ctx.physics.safeBody(h.handle);
    const item = this.ctx.world.items.get(h.id);
    if (item) item.state = "loose";
    if (!body || reason === "removed") return;
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    for (let i = 0; i < body.numColliders(); i++) body.collider(i).setCollisionGroups(COLLISION.released);
    this.released.push({ handle: h.handle, t: this.graceS });
    // Geschwindigkeit der Spinne (Mittel) + leicht abwärts
    let vx = 0, vy = 0, vz = 0;
    for (const v of this.velHist) { vx += v.x; vy += v.y; vz += v.z; }
    const n = Math.max(1, this.velHist.length);
    body.setLinvel({ x: vx / n, y: vy / n - this.releaseDown, z: vz / n }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.ctx.bus.emit("itemReleased", { itemId: h.id, kg: h.massKg });
  }

  private dropById(id: ItemId, reason: "removed"): void {
    const h = this.held.find((x) => x.id === id);
    if (h) this.release(h, reason);
  }

  dispose(): void { this.held.length = 0; this.velHist.length = 0; this.released.length = 0; }
}

function dist2(a: { x: number; y: number; z: number }, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return dx * dx + dy * dy + dz * dz;
}
