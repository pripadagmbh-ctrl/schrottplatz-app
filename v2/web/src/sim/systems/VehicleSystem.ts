import type { System, SimContext } from "./System";
import type { ScrapSystem } from "./ScrapSystem";
import type { CompositeSystem } from "./CompositeSystem";
import type { CustomerDef, VehicleDef } from "@/data/types";
import type { DeliveryState } from "@/sim/world/WorldState";
import type { DeliveryId, ItemId } from "@/shared/ids";
import { nextId } from "@/shared/ids";
import { Rng } from "@/shared/rng";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { COLLISION } from "@/sim/world/collisionGroups";
import type { Level } from "@/sim/world/Level";
import { clamp, deg, quatFromAxisX, quatFromAxisY, quatMul, type Quat, type Vec3 } from "@/shared/math";

/**
 * Kundenfahrzeuge (Briefing Kap. 9.1, 13; Rueckfragen M4-1..3, Patrick 08.09.):
 *  - Splines aus level.routes, konstante Geschwindigkeit, Kurven ueber turnRateRadS; Andocken RUECKWAERTS (routeDock).
 *  - Ladung liegt echt auf der Ladeflaeche: Regalpackung im Muldenraum, Koerper kinematisch mitgefuehrt (Gruppe VEHICLE),
 *    ab releaseAngleDeg dynamisch → rutscht ueber die gekippte Mulde ab.
 *  - Kipper kippt im Stand, faehrt dann MIT gekippter Mulde los (creepSpeedMs ueber creepDistanceM) und senkt sie erst
 *    auf den ersten Metern der Abfahrt — so bleibt nichts auf der Flaeche haengen.
 *  - Waage: Stopp am Waagen-Wegpunkt beim Rein- (brutto) und Rausfahren (tara); Zahlung beim Rausfahren.
 *  Zustandsmaschine datengetrieben statt 16 Phasen im Prototyp (vehicles.ts). Kein Pathfinding.
 *
 *  Fahrzeugrahmen: Ursprung = Kippgelenk (Muldenhinterkante, Bodenhoehe), +z = Fahrtrichtung, x = quer.
 *  Mulde z ∈ [0, bedLen], Kabine dahinter (z > bedLen). Kippen = Drehung um die x-Achse durchs Gelenk, Front hebt sich.
 */
export type Stage = "in" | "weighIn" | "dock" | "tipUp" | "creep" | "out" | "weighOut" | "pickupWait" | "done";

interface Load { itemId: ItemId; handle: number; local: Vec3; localRot: Quat; massKg: number }

export interface VehicleRun {
  delivery: DeliveryState; def: VehicleDef; customer: CustomerDef | null;
  pos: Vec3; heading: number; bedAngle: number; speed: number;
  stage: Stage; timer: number; path: Vec3[]; seg: number; reverse: boolean; creepLeft: number; lowerLeft: number;
  loads: Load[]; bodies: RAPIER.RigidBody[]; scaleIdx: number;
  /** nur Abholer: welcher Container */
  pickupContainerId: string | null;
}

export class VehicleSystem implements System {
  readonly name = "vehicles";
  readonly phase = "preStep" as const;
  readonly order = 15;

  readonly runs: VehicleRun[] = [];
  private ctx!: SimContext; private scrap!: ScrapSystem; private composites!: CompositeSystem;
  private v!: Record<string, number | boolean | string>;
  private rng = new Rng(7);
  private nextAutoS = 0;
  /** fuer Tests/HUD */
  deliveriesCompleted = 0;
  private readonly q: Quat = { x: 0, y: 0, z: 0, w: 1 }; private readonly qTilt: Quat = { x: 0, y: 0, z: 0, w: 1 }; private readonly qYaw: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly tmp: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(private readonly level: Level) {}

  init(ctx: SimContext): void {
    this.ctx = ctx; this.scrap = ctx.get<ScrapSystem>("scrap"); this.composites = ctx.get<CompositeSystem>("composites");
    this.v = ctx.data.balancing.vehicles;
    this.nextAutoS = Number(this.v["firstDeliveryDelayS"] ?? 8);
  }

  get active(): VehicleRun | undefined { return this.runs.find((r) => r.def.id !== "rolloff"); }

  // ------------------------------------------------------------------ Anlieferung starten
  /** Anlieferung eines Kunden starten (zufaellig nach Gewicht und Tag, oder gezielt). */
  /** `forceSorted` (M4b-Tutorial): sortenrein erzwingen statt wuerfeln. */
  requestDelivery(customerId?: string, forceSorted?: boolean): VehicleRun | null {
    const day = this.ctx.world.day.day;
    const vehicleOk = (c: CustomerDef) => this.ctx.data.customers.vehicles.some((v) => c.vehicleIds.includes(v.id) && v.tier === "MVP" && (v.tips || !!c.compositeDefId));
    const wreckOnYard = this.ctx.world.composites.size > 0; // M5 (Annahme): hoechstens ein Wrack auf dem Platz
    const pool = this.ctx.data.customers.customers.filter((c) => c.fromDay <= day && vehicleOk(c) && (!c.compositeDefId || (!wreckOnYard && this.composites.def(c.compositeDefId)?.tier === "MVP")));
    const customer = customerId ? this.ctx.data.customers.customers.find((c) => c.id === customerId) : pool.length ? this.rng.pickWeighted(pool, (c) => c.weight) : undefined;
    if (!customer) return null;
    const vehicleId = customer.vehicleIds.find((id) => this.ctx.data.customers.vehicles.find((v) => v.id === id && v.tier === "MVP" && (v.tips || !!customer.compositeDefId))) ?? customer.vehicleIds[0]!;
    const def = this.ctx.data.customers.vehicles.find((v) => v.id === vehicleId)!;
    const sorted = forceSorted ?? this.rng.next() < customer.sortedProbability;
    const dominant = [...customer.loadProfile].sort((a, b) => b.share - a.share)[0]?.materialId ?? null;
    const delivery: DeliveryState = {
      id: nextId<DeliveryId>("dlv"), customerId: customer.id, vehicleId, phase: "approach",
      grossKg: 0, tareKg: def.body.tareKg, priceEur: 0, tStart: this.ctx.world.step, sorted, materialId: sorted ? dominant : null,
    };
    this.ctx.world.deliveries.set(delivery.id, delivery);
    if (customer.compositeDefId) { delivery.compositeDefId = customer.compositeDefId; delivery.sorted = false; delivery.materialId = null; }
    const run = this.spawnRun(delivery, def, customer);
    if (customer.compositeDefId) this.loadComposite(run, customer.compositeDefId); else this.loadCargo(run, customer, sorted, dominant);
    this.ctx.world.day.deliveriesToday += 1;
    return run;
  }

  /** Abholer fuer einen Container rufen (Briefing 9.5). Einer gleichzeitig. */
  requestPickup(containerId: string): VehicleRun | null {
    if (this.runs.some((r) => r.def.id === "rolloff")) return null;
    const def = this.ctx.data.customers.vehicles.find((v) => v.id === "rolloff"); if (!def) return null;
    const delivery: DeliveryState = { id: nextId<DeliveryId>("pick"), customerId: "pickup", vehicleId: "rolloff", phase: "approach", grossKg: 0, tareKg: def.body.tareKg, priceEur: 0, tStart: this.ctx.world.step, sorted: true, materialId: null };
    this.ctx.world.deliveries.set(delivery.id, delivery);
    const run = this.spawnRun(delivery, def, null);
    run.pickupContainerId = containerId;
    this.ctx.bus.emit("pickupOrdered", { containerId: containerId as never });
    return run;
  }

  private spawnRun(delivery: DeliveryState, def: VehicleDef, customer: CustomerDef | null): VehicleRun {
    const routeIn = this.route(def.routeIn);
    const start = routeIn[0]!;
    const heading = Math.atan2(routeIn[1]!.x - start.x, routeIn[1]!.z - start.z);
    const run: VehicleRun = {
      delivery, def, customer, pos: { x: start.x, y: 0, z: start.z }, heading, bedAngle: 0, speed: def.speedMs,
      stage: "in", timer: 0, path: routeIn, seg: 0, reverse: false, creepLeft: 0, lowerLeft: 0, loads: [], bodies: [],
      scaleIdx: this.scaleIndex(routeIn), pickupContainerId: null,
    };
    this.createBodies(run);
    this.runs.push(run);
    this.ctx.bus.emit("vehicleArrived", { deliveryId: delivery.id });
    return run;
  }

  private route(name: string): Vec3[] {
    const r = this.level.def.routes[name]; if (!r) throw new Error(`Route unbekannt: ${name}`);
    return r.map(([x, z]) => ({ x, y: 0, z }));
  }
  /** Wegpunkt auf der Waage (naechster zur Waagenmitte) */
  private scaleIndex(path: Vec3[]): number {
    const w = this.level.def.weighbridge; let best = -1, bd = 1.5;
    path.forEach((p, i) => { const d = Math.hypot(p.x - w.x, p.z - w.z); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  // ------------------------------------------------------------------ Koerper
  private createBodies(run: VehicleRun): void {
    const w = this.ctx.physics.world, b = run.def.body;
    const mk = () => { const body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()); run.bodies.push(body); return body; };
    const add = (body: RAPIER.RigidBody, hx: number, hy: number, hz: number) => w.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setCollisionGroups(COLLISION.vehicle).setFriction(0.4), body);
    // 0 Kabine+Fahrgestell (kippt nicht), 1 Muldenboden, 2/3 Seitenwaende, 4 Stirnwand (kippen mit)
    add(mk(), b.bedW / 2, (b.floorY + 1.6) / 2, b.cabLen / 2);
    add(mk(), b.bedW / 2, 0.05, b.bedLen / 2);
    add(mk(), 0.05, b.wallH / 2, b.bedLen / 2);
    add(mk(), 0.05, b.wallH / 2, b.bedLen / 2);
    add(mk(), b.bedW / 2, b.wallH / 2, 0.05);
    this.placeBodies(run);
  }

  /** Lokale Position → Welt (Fahrzeugrahmen, optional im gekippten Muldenrahmen) */
  private toWorld(run: VehicleRun, local: Vec3, tilted: boolean, out: Vec3): Vec3 {
    const lx = local.x; let ly = local.y, lz = local.z;
    if (tilted) { const a = run.bedAngle, c = Math.cos(a), s = Math.sin(a); const y = ly * c + lz * s, z = lz * c - ly * s; ly = y; lz = z; }
    const h = run.heading, ch = Math.cos(h), sh = Math.sin(h);
    out.x = run.pos.x + lx * ch + lz * sh; out.y = run.pos.y + ly; out.z = run.pos.z - lx * sh + lz * ch;
    return out;
  }
  private frameQuat(run: VehicleRun, tilted: boolean, out: Quat): Quat {
    quatFromAxisY(run.heading, this.qYaw);
    if (!tilted) { out.x = this.qYaw.x; out.y = this.qYaw.y; out.z = this.qYaw.z; out.w = this.qYaw.w; return out; }
    // Kippen: Drehung um die lokale x-Achse (Front hoch = negativer Winkel um +x in unserer Konvention)
    quatFromAxisX(-run.bedAngle, this.qTilt);
    return quatMul(this.qYaw, this.qTilt, out);
  }

  private placeBodies(run: VehicleRun): void {
    const b = run.def.body, p = this.tmp;
    const set = (i: number, local: Vec3, tilted: boolean) => {
      const body = run.bodies[i]!; this.toWorld(run, local, tilted, p); body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z }); body.setNextKinematicRotation(this.frameQuat(run, tilted, this.q));
    };
    set(0, { x: 0, y: (b.floorY + 1.6) / 2, z: b.bedLen + 0.15 + b.cabLen / 2 }, false);
    set(1, { x: 0, y: b.floorY - 0.05, z: b.bedLen / 2 }, true);
    set(2, { x: -b.bedW / 2, y: b.floorY + b.wallH / 2, z: b.bedLen / 2 }, true);
    set(3, { x: b.bedW / 2, y: b.floorY + b.wallH / 2, z: b.bedLen / 2 }, true);
    set(4, { x: 0, y: b.floorY + b.wallH / 2, z: b.bedLen }, true);
    // Ladung mitfuehren
    for (const l of run.loads) {
      const body = this.ctx.physics.safeBody(l.handle); if (!body) continue;
      this.toWorld(run, l.local, true, p); body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      body.setNextKinematicRotation(quatMul(this.frameQuat(run, true, this.q), l.localRot, this.qTilt));
    }
  }

  // ------------------------------------------------------------------ Ladung
  /** Regalpackung im Muldenraum (wie ScrapSystem.spawnPile, aber im Fahrzeugrahmen). */
  private loadCargo(run: VehicleRun, customer: CustomerDef, sorted: boolean, dominant: string | null): void {
    const b = run.def.body, gap = Number(this.v["loadLayerGapM"] ?? 0.06);
    const maxItems = Math.min(Number(this.v["loadMaxItems"] ?? 40), run.def.itemsMax);
    const count = Math.round(this.rng.range(run.def.itemsMin, maxItems));
    const targetKg = this.rng.range(run.def.loadKgMin, run.def.loadKgMax);
    const profile = sorted && dominant ? [{ materialId: dominant, share: 1 }] : customer.loadProfile;
    const x0 = -b.bedW / 2 + gap, x1 = b.bedW / 2 - gap, z0 = gap, z1 = b.bedLen - gap;
    let x = x0, z = z0, y = b.floorY + gap, rowDepth = 0, layerH = 0, kg = 0;
    const maxItemKg = targetKg * Number(this.v["maxItemShareOfLoad"] ?? 0.34); // kein 1-t-Gussteil auf dem Privatanhaenger
    // Stueckzahl UND Gewicht treffen: pro Teil ein Massebudget; zu schwere Formen werden neu gewuerfelt (Balancing 08.09.:
    // vorher 10 Teile mit 3,9 t statt 15–30 Teile mit 1,5–3 t)
    const perItemKg = Math.max(20, (targetKg / count) * 2.2);
    for (let i = 0; i < count && kg < targetKg * 1.15; i++) {
      const mat = this.rng.pickWeighted(profile, (p) => p.share).materialId;
      const remaining = targetKg * 1.15 - kg;
      let plan = this.scrap.planShape(mat, this.rng);
      for (let tries = 0; plan && (plan.massKg > Math.min(maxItemKg, perItemKg) || plan.massKg > remaining) && tries < 8; tries++) plan = this.scrap.planShape(mat, this.rng);
      if (!plan || plan.massKg > maxItemKg || plan.massKg > remaining) continue;
      const { shape, size } = plan;
      const fw = shape.collider === "cylinder" ? size[2] : size[0], fd = shape.collider === "cylinder" ? size[0] * 2 : size[2], fh = shape.collider === "cylinder" ? size[0] * 2 : size[1];
      const long = Math.max(fw, fd), short = Math.min(fw, fd);
      if (long > b.bedW - 2 * gap && long > b.bedLen - 2 * gap) continue; // passt nicht auf die Flaeche
      // lange Achse quer (x), wenn sie in die Breite passt, sonst laengs (z)
      const across = long <= x1 - x0;
      const fx = across ? long : short, fz = across ? short : long;
      if (x + fx > x1) { x = x0; z += rowDepth + gap; rowDepth = 0; }
      if (z + fz > z1) { z = z0; x = x0; y += layerH + gap; layerH = 0; rowDepth = 0; }
      if (y + fh > b.floorY + b.wallH * 1.6) break; // Mulde voll
      const yawLocal = (fw >= fd) === across ? 0 : Math.PI / 2;
      const rotY = shape.collider === "cylinder" ? yawLocal + Math.PI / 2 : yawLocal;
      const local: Vec3 = { x: x + fx / 2, y: y + fh / 2, z: z + fz / 2 };
      const localRot: Quat = { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };
      this.toWorld(run, local, true, this.tmp);
      const worldRot = quatMul(this.frameQuat(run, true, this.q), localRot, { x: 0, y: 0, z: 0, w: 1 });
      const item = this.scrap.spawnExact(mat, shape, size, this.tmp, worldRot);
      if (!item || item.bodyHandle === undefined) break;
      const body = this.ctx.physics.safeBody(item.bodyHandle)!;
      body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
      for (let c = 0; c < body.numColliders(); c++) body.collider(c).setCollisionGroups(COLLISION.vehicle);
      item.state = "onVehicle";
      run.loads.push({ itemId: item.id, handle: item.bodyHandle, local, localRot, massKg: item.massKg });
      kg += item.massKg;
      x += fx + gap; rowDepth = Math.max(rowDepth, fz); layerH = Math.max(layerH, fh);
    }
    run.delivery.grossKg = b.tareKg + kg;
  }

  /** M5: Wrack auf dem Tieflader — ein Rumpf-Teil, kinematisch mitgefuehrt wie jede Ladung. */
  private loadComposite(run: VehicleRun, defId: string): void {
    const b = run.def.body;
    const local: Vec3 = { x: 0, y: b.floorY, z: b.bedLen / 2 };
    this.toWorld(run, local, true, this.tmp);
    const st = this.composites.spawn(defId, this.tmp, run.heading); if (!st) return;
    const item = this.ctx.world.items.get(st.hullItemId)!; const body = this.ctx.physics.safeBody(item.bodyHandle!)!;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    for (let c = 0; c < body.numColliders(); c++) body.collider(c).setCollisionGroups(COLLISION.vehicle);
    item.state = "onVehicle";
    const def = this.composites.def(defId)!;
    run.loads.push({ itemId: item.id, handle: item.bodyHandle!, local: { x: 0, y: b.floorY + def.hull.yOffset, z: b.bedLen / 2 }, localRot: { x: 0, y: 0, z: 0, w: 1 }, massKg: item.massKg });
    run.delivery.grossKg = b.tareKg + item.massKg;
  }

  /** Tieflader kippt nicht: Wrack wird seitlich neben dem Fahrzeug abgesetzt (Annahme M5: Kran gedacht, kein Rampen-Abrollen). */
  private unloadBeside(run: VehicleRun): void {
    const b = run.def.body, off = Number(this.ctx.data.balancing.composites["unloadOffsetM"] ?? 2.2);
    for (const l of run.loads) {
      const body = this.ctx.physics.safeBody(l.handle); const item = this.ctx.world.items.get(l.itemId);
      if (!body || !item) continue;
      const local: Vec3 = { x: -(b.bedW / 2 + off), y: item.size[1] / 2 + 0.05, z: l.local.z };
      this.toWorld(run, local, false, this.tmp);
      body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      body.setTranslation({ x: this.tmp.x, y: this.tmp.y, z: this.tmp.z }, true); body.setRotation(this.frameQuat(run, false, this.q), true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      for (let i = 0; i < body.numColliders(); i++) body.collider(i).setCollisionGroups(COLLISION.loose);
      item.state = "loose";
    }
    this.ctx.bus.emit("vehicleDumped", { deliveryId: run.delivery.id, itemCount: run.loads.length });
    run.loads.length = 0;
  }

  private releaseCargo(run: VehicleRun): void {
    const c = Math.cos(run.heading), s = Math.sin(run.heading);
    for (const l of run.loads) {
      const body = this.ctx.physics.safeBody(l.handle); const item = this.ctx.world.items.get(l.itemId);
      if (!body || !item) continue;
      body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      for (let i = 0; i < body.numColliders(); i++) body.collider(i).setCollisionGroups(COLLISION.loose);
      body.setLinvel({ x: s * run.speed, y: 0, z: c * run.speed }, true);
      item.state = "loose";
    }
    this.ctx.bus.emit("vehicleDumped", { deliveryId: run.delivery.id, itemCount: run.loads.length });
    run.loads.length = 0;
  }

  // ------------------------------------------------------------------ Schritt
  update(ctx: SimContext, dt: number): void {
    // Automatische Anlieferungen im Arbeitsteil des Tages
    if (this.v["autoDeliveries"] && ctx.world.day.phase === "work" && !this.active) {
      const perDay = this.deliveriesPerDay(ctx.world.day.day);
      if (ctx.world.day.deliveriesToday < perDay) { this.nextAutoS -= dt; if (this.nextAutoS <= 0) { this.requestDelivery(); const [a, b] = ctx.data.balancing.day.deliveryIntervalS; this.nextAutoS = this.rng.range(a, b); } }
    }
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const run = this.runs[i]!;
      this.step(run, dt);
      if (run.stage === "done") { this.finish(run); this.runs.splice(i, 1); }
      else this.placeBodies(run);
    }
  }

  private deliveriesPerDay(day: number): number {
    const t = this.ctx.data.balancing.day.deliveriesPerDay; return t[String(day)] ?? t["4"] ?? 2;
  }

  private step(run: VehicleRun, dt: number): void {
    const v = this.v; const d = run.delivery;
    switch (run.stage) {
      case "in": {
        if (this.follow(run, dt, run.def.speedMs)) {
          if (run.def.id === "rolloff") { run.stage = "pickupWait"; run.timer = Number(this.ctx.data.balancing.containers["pickupLoadS"] ?? 6); }
          else if (run.def.routeDock) { run.path = this.route(run.def.routeDock); run.seg = 0; run.reverse = true; run.stage = "dock"; d.phase = "toDump"; }
          else { run.stage = "tipUp"; }
        } else if (run.seg === run.scaleIdx && run.stage === "in" && !run.reverse && this.atWaypoint(run) && d.phase === "approach") {
          run.stage = "weighIn"; run.timer = Number(v["scaleStopS"]); d.phase = "weighIn";
        }
        break;
      }
      case "weighIn": {
        run.timer -= dt;
        if (run.timer <= 0) { this.ctx.bus.emit("vehicleWeighed", { deliveryId: d.id, grossKg: d.grossKg }); this.price(run); d.phase = "toDump"; run.stage = "in"; }
        break;
      }
      case "dock": {
        if (this.follow(run, dt, run.def.speedMs * Number(v["reverseSpeedFactor"] ?? 0.5))) { run.reverse = false; run.stage = "tipUp"; d.phase = "dumping"; }
        break;
      }
      case "tipUp": {
        if (!run.def.tips) { // Tieflader: Wartezeit, dann absetzen, ohne Kippen und ohne Kriechen
          run.timer += dt;
          if (run.loads.length && run.timer >= run.def.dumpSeconds * 0.5) this.unloadBeside(run);
          // Rueckwaerts auf der eigenen Spur hinaus (erstes Teilstueck): Wenden im Zerlegebereich fegte das Wrack 20 m weit weg (Test M5)
          if (run.timer >= run.def.dumpSeconds) { run.path = [{ ...run.pos }, ...this.route(run.def.routeOut).slice(1)]; run.seg = 0; run.reverse = true; run.scaleIdx = this.scaleIndex(run.path); run.stage = "out"; run.lowerLeft = 0; d.phase = "weighOut"; }
          break;
        }
        const target = deg(Number(v["tipAngleDeg"]));
        run.bedAngle = Math.min(target, run.bedAngle + (target / run.def.dumpSeconds) * dt);
        if (run.loads.length && run.bedAngle >= deg(Number(v["releaseAngleDeg"]))) this.releaseCargo(run);
        if (run.bedAngle >= target - 1e-6) { run.stage = "creep"; run.creepLeft = Number(v["creepDistanceM"]); run.speed = Number(v["creepSpeedMs"]); }
        break;
      }
      case "creep": {
        // gekippt losfahren: geradeaus in Fahrtrichtung, Mulde bleibt oben
        const s = Math.min(run.speed * dt, run.creepLeft);
        run.pos.x += Math.sin(run.heading) * s; run.pos.z += Math.cos(run.heading) * s; run.creepLeft -= s;
        if (run.creepLeft <= 1e-6) {
          run.path = [{ ...run.pos }, ...this.route(run.def.routeOut).slice(1)]; run.seg = 0; run.scaleIdx = this.scaleIndex(run.path);
          run.stage = "out"; run.lowerLeft = run.def.dumpSeconds * 0.6; d.phase = "weighOut";
        }
        break;
      }
      case "out": {
        if (run.reverse && run.seg >= 1) run.reverse = false; // Tieflader: ab dem ersten Wegpunkt wieder vorwaerts
        if (run.bedAngle > 0) { run.bedAngle = Math.max(0, run.bedAngle - (deg(Number(v["tipAngleDeg"])) / Math.max(0.1, run.lowerLeft)) * dt); }
        const arrived = this.follow(run, dt, run.bedAngle > 0 || run.reverse ? run.def.speedMs * 0.5 : run.def.speedMs);
        if (run.seg === run.scaleIdx && this.atWaypoint(run) && d.phase === "weighOut" && run.def.id !== "rolloff") {
          run.stage = "weighOut"; run.timer = Number(v["scaleStopS"]);
        } else if (arrived) { run.stage = "done"; }
        break;
      }
      case "weighOut": {
        run.timer -= dt;
        if (run.timer <= 0) { this.pay(run); d.phase = "leave"; run.stage = "out"; }
        break;
      }
      case "pickupWait": {
        run.timer -= dt;
        if (run.timer <= 0) { this.sellContainer(run); run.path = this.route(run.def.routeOut); run.seg = 0; run.scaleIdx = -1; run.stage = "out"; d.phase = "leave"; }
        break;
      }
      default: break;
    }
  }

  /** Auf dem Pfad weiterfahren; true, wenn das Ende erreicht ist. Rueckwaerts: Heck voraus, Heading zeigt vom Ziel weg. */
  private follow(run: VehicleRun, dt: number, speed: number): boolean {
    if (run.seg >= run.path.length - 1) return true;
    const to = run.path[run.seg + 1]!;
    const dx = to.x - run.pos.x, dz = to.z - run.pos.z, dist = Math.hypot(dx, dz);
    const dir = Math.atan2(dx, dz);
    const want = run.reverse ? dir + Math.PI : dir;
    let dh = want - run.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const maxTurn = Number(this.v["turnRateRadS"] ?? 1.4) * dt;
    run.heading += clamp(dh, -maxTurn, maxTurn);
    run.speed = speed;
    const s = Math.min(speed * dt, dist);
    run.pos.x += (dx / Math.max(dist, 1e-6)) * s; run.pos.z += (dz / Math.max(dist, 1e-6)) * s;
    if (dist - s < 0.05) { run.seg += 1; if (run.seg >= run.path.length - 1) return true; }
    return false;
  }
  private atWaypoint(run: VehicleRun): boolean {
    const p = run.path[run.seg]; if (!p) return false;
    return Math.hypot(p.x - run.pos.x, p.z - run.pos.z) < 0.1;
  }

  // ------------------------------------------------------------------ Geld
  private price(run: VehicleRun): void {
    const d = run.delivery, econ = this.ctx.data.balancing.economy;
    const netKg = d.grossKg - d.tareKg;
    let perKg = Number(econ["mixedBuyPricePerKg"]);
    if (d.sorted && d.materialId) { const m = this.ctx.data.materials.materials.find((x) => x.id === d.materialId); if (m) perKg = m.buyPricePerKg; }
    d.priceEur = Math.round(netKg * perKg * 100) / 100;
    if (d.compositeDefId) d.priceEur = this.composites.def(d.compositeDefId)?.buyPriceEur ?? d.priceEur; // Wrack: Pauschale (Briefing 8.3)
  }
  private pay(run: VehicleRun): void {
    const d = run.delivery; if (d.priceEur <= 0) return;
    const e = this.ctx.world.economy; e.moneyEur = Math.round((e.moneyEur - d.priceEur) * 100) / 100;
    const name = run.customer?.displayName ?? "Kunde";
    this.ctx.bus.emit("moneyChanged", { deltaEur: -d.priceEur, totalEur: e.moneyEur, reason: `Ankauf ${name}` });
    this.ctx.bus.emit("toast", { text: `−${d.priceEur.toFixed(0)} € · ${name} · ${(d.grossKg - d.tareKg).toFixed(0)} kg`, kind: "info" });
  }
  private sellContainer(run: VehicleRun): void {
    const id = run.pickupContainerId; if (!id) return;
    const cont = this.ctx.world.containers.get(id as never); const def = this.ctx.data.level.containers.find((c) => c.id === id);
    if (!cont || !def) return;
    const mat = this.ctx.data.materials.materials.find((m) => m.id === def.materialId); if (!mat) return;
    const total = cont.contentKg + cont.contaminationKg;
    const purity = total > 0 ? cont.contentKg / total : 1;
    const exp = Number(this.ctx.data.balancing.economy["purityExponent"] ?? 2);
    const eur = Math.round((mat.sellPricePerKg < 0 ? total * mat.sellPricePerKg : total * mat.sellPricePerKg * Math.pow(purity, exp)) * 100) / 100;
    const e = this.ctx.world.economy; e.moneyEur = Math.round((e.moneyEur + eur) * 100) / 100; e.stats.turnoverKg += total;
    // verbuchte, noch sichtbare Teile entfernen
    for (const itemId of [...cont.pendingItemIds]) this.scrap.requestRemove(itemId, "sold");
    cont.pendingItemIds.length = 0; cont.contentKg = 0; cont.contaminationKg = 0;
    this.ctx.bus.emit("containerSold", { containerId: cont.id, kg: total, purity, eur });
    this.ctx.bus.emit("moneyChanged", { deltaEur: eur, totalEur: e.moneyEur, reason: `Verkauf ${def.id}` });
    this.ctx.bus.emit("toast", { text: `${eur >= 0 ? "+" : ""}${eur.toFixed(0)} € · ${total.toFixed(0)} kg · ${(purity * 100).toFixed(0)} % rein`, kind: eur >= 0 ? "good" : "bad" });
  }

  private finish(run: VehicleRun): void {
    for (const l of run.loads) { const item = this.ctx.world.items.get(l.itemId); if (item) this.scrap.requestRemove(item.id, "cleanup"); }
    for (const b of run.bodies) this.ctx.physics.world.removeRigidBody(b);
    run.delivery.phase = "done";
    if (run.def.id !== "rolloff") { this.ctx.world.day.deliveriesDone += 1; this.deliveriesCompleted += 1; }
    this.ctx.bus.emit("vehicleLeft", { deliveryId: run.delivery.id, secondsOnSite: (this.ctx.world.step - run.delivery.tStart) / 60 });
    this.ctx.world.deliveries.delete(run.delivery.id);
  }

  dispose(): void { for (const r of this.runs) for (const b of r.bodies) this.ctx.physics.world.removeRigidBody(b); this.runs.length = 0; }
}
