import type { System, SimContext } from "./System";
import type { ScrapItem } from "@/sim/world/WorldState";
import type { MaterialDef, ShapeDef } from "@/data/types";
import type { ItemId } from "@/shared/ids";
import { nextId } from "@/shared/ids";
import { Rng } from "@/shared/rng";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { COLLISION } from "@/sim/world/collisionGroups";
import type { Level } from "@/sim/world/Level";

/**
 * Lose Schrottteile (Briefing Kap. 6.5, 19.1): Spawnen aus Formvorlagen, Masse aus Dichte,
 * Deckel, Schlafhilfe, Entfernen über die Registry, Save/Load mit Validierung je Eintrag.
 *
 * Schlafhilfe: Rapier legt Körper selbst schlafen, aber mit festen Schwellen. Der Prototyp-Haufen
 * zitterte mit 0,01 mm/s und schlief nie (A2). Deshalb zusätzlich: wer drei Prüfungen lang
 * unter den Schwellen aus balancing.json liegt, wird per `sleep()` schlafen gelegt.
 */
export interface SpawnRequest {
  materialId: string; shapeId?: string;
  pos: { x: number; y: number; z: number }; rot?: { x: number; y: number; z: number; w: number };
  origin?: ScrapItem["origin"]; rng?: Rng;
}
interface SavedItem {
  materialId: string; shapeId: string; size: [number, number, number]; massKg: number;
  pos: [number, number, number]; rot: [number, number, number, number]; origin: ScrapItem["origin"];
}

const SQRT_HALF = Math.SQRT1_2;

export class ScrapSystem implements System {
  readonly name = "scrap";
  readonly phase = "postStep" as const;
  readonly order = 10;

  private ctx!: SimContext;
  private level!: Level;
  private maxLoose = 300;
  private sleepLin2 = 0; private sleepAng2 = 0;
  private quietChecks = 0;
  private checkEvery = 10;
  private materials = new Map<string, MaterialDef>();
  private shapes = new Map<string, ShapeDef>();
  private nextSeed = 1;
  /** Zähler für die Abnahme: verworfene Spielstand-Einträge */
  rejectedOnLoad = 0;

  constructor(level: Level) { this.level = level; }

  init(ctx: SimContext): void {
    this.ctx = ctx;
    const b = ctx.data.balancing;
    this.maxLoose = Number(b.scrap["maxLooseItems"]);
    this.sleepLin2 = b.physics.sleepLinearThreshold ** 2;
    this.sleepAng2 = b.physics.sleepAngularThreshold ** 2;
    for (const m of ctx.data.materials.materials) this.materials.set(m.id, m);
    for (const s of ctx.data.materials.shapes) this.shapes.set(s.id, s);
  }

  get count(): number { return this.ctx.world.items.size; }
  items(): IterableIterator<ScrapItem> { return this.ctx.world.items.values(); }

  /** Ein Teil erzeugen. Größe zufällig im Bereich der Form, Masse = Volumen × Dichte × Füllgrad. */
  spawn(req: SpawnRequest): ScrapItem | null {
    if (this.ctx.world.items.size >= this.maxLoose) return null; // Deckel — Bündeln kommt in M4
    const mat = this.materials.get(req.materialId);
    if (!mat) throw new Error(`Material unbekannt: ${req.materialId}`);
    const rng = req.rng ?? new Rng(this.nextSeed++);
    const shape = req.shapeId ? this.shapes.get(req.shapeId) : this.pickShape(mat.id, rng);
    if (!shape) throw new Error(`Form unbekannt: ${req.shapeId ?? "(keine passende)"}`);
    const size: [number, number, number] = [0, 1, 2].map((i) => rng.range(shape.sizeMin[i] as number, shape.sizeMax[i] as number)) as [number, number, number];
    const massKg = Math.max(0.5, Math.round(volume(shape, size) * mat.densityKgM3 * shape.fill * 10) / 10);
    const rot = req.rot ?? randomRot(rng);
    return this.createItem({ materialId: mat.id, shapeId: shape.id, size, massKg, pos: req.pos, rot, origin: req.origin ?? "delivery" });
  }

  /**
   * Haufen in einer Zone: Regalpackung ohne Überlappung (Entscheidung E-010). Jedes Teil wird erst
   * bemessen, dann in Reihen gelegt (lange Achse entlang X, Gieren nur 0°/90°), Lagen stapeln sich
   * mit Abstand `spawnGapM`. Überlappende Spawns waren im Prototyp die Ursache für nie schlafende Haufen.
   */
  spawnPile(zoneId: string, count: number, seed: number, mix?: { materialId: string; share: number }[]): number {
    const rng = new Rng(seed);
    const rect = this.level.zone(zoneId);
    const gap = this.ctx.data.balancing.physics.spawnGapM;
    const profile = mix ?? DEFAULT_MIX;
    const x0 = rect.x - rect.hw + gap, x1 = rect.x + rect.hw - gap;
    const z0 = rect.z - rect.hd + gap, z1 = rect.z + rect.hd - gap;
    let x = x0, z = z0, y = gap, rowDepth = 0, layerHeight = 0, spawned = 0;
    for (let i = 0; i < count; i++) {
      if (this.ctx.world.items.size >= this.maxLoose) break;
      const mat = this.materials.get(rng.pickWeighted(profile, (p) => p.share).materialId)!;
      const shape = this.pickShape(mat.id, rng);
      if (!shape) continue;
      const size: [number, number, number] = [0, 1, 2].map((k) => rng.range(shape.sizeMin[k] as number, shape.sizeMax[k] as number)) as [number, number, number];
      // Grundriss: Zylinder liegt entlang Z (Länge size[2]); wir drehen so, dass die lange Achse entlang X liegt
      const fw = shape.collider === "cylinder" ? size[2] : size[0];
      const fd = shape.collider === "cylinder" ? size[0] * 2 : size[2];
      const fh = shape.collider === "cylinder" ? size[0] * 2 : size[1];
      const long = Math.max(fw, fd), short = Math.min(fw, fd);
      const yaw = fw >= fd ? 0 : Math.PI / 2;
      if (x + long > x1) { x = x0; z += rowDepth + gap; rowDepth = 0; }
      if (z + short > z1) { z = z0; x = x0; y += layerHeight + gap; layerHeight = 0; rowDepth = 0; }
      const pos = { x: x + long / 2, y: y + fh / 2, z: z + short / 2 };
      const rotY = shape.collider === "cylinder" ? yaw + Math.PI / 2 : yaw; // Zylinder: lokale Z-Achse → X
      const rot = { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };
      const massKg = Math.max(0.5, Math.round(volume(shape, size) * mat.densityKgM3 * shape.fill * 10) / 10);
      this.createItem({ materialId: mat.id, shapeId: shape.id, size, massKg, pos, rot, origin: "delivery" });
      spawned++;
      x += long + gap; rowDepth = Math.max(rowDepth, short); layerHeight = Math.max(layerHeight, fh);
    }
    return spawned;
  }

  /** Form nach Auswahlgewicht (materials.json `weight`; grosse Einzelteile ~0,1, engine 0 = nur gezielt). */
  private pickShape(materialId: string, rng: Rng): ShapeDef | undefined {
    const candidates = [...this.shapes.values()].filter((s) => s.materialIds.includes(materialId) && (s.weight ?? 1) > 0);
    return candidates.length ? rng.pickWeighted(candidates, (s) => s.weight ?? 1) : undefined;
  }

  /** Wie spawn(), aber Position/Rotation exakt und ohne eigene Formwahl — fuer Ladungen auf Fahrzeugen. */
  spawnExact(materialId: string, shape: ShapeDef, size: [number, number, number], pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number; w: number }): ScrapItem | null {
    if (this.ctx.world.items.size >= this.maxLoose) return null;
    const mat = this.materials.get(materialId); if (!mat) throw new Error(`Material unbekannt: ${materialId}`);
    const massKg = Math.max(0.5, Math.round(volume(shape, size) * mat.densityKgM3 * shape.fill * 10) / 10);
    return this.createItem({ materialId, shapeId: shape.id, size, massKg, pos, rot, origin: "delivery" });
  }
  /** Fuer Ladungsplanung: passende Form zum Material waehlen und bemessen. */
  planShape(materialId: string, rng: Rng): { shape: ShapeDef; size: [number, number, number]; massKg: number } | null {
    const mat = this.materials.get(materialId); if (!mat) return null;
    const shape = this.pickShape(materialId, rng); if (!shape) return null;
    const size: [number, number, number] = [0, 1, 2].map((i) => rng.range(shape.sizeMin[i] as number, shape.sizeMax[i] as number)) as [number, number, number];
    const massKg = Math.max(0.5, Math.round(volume(shape, size) * mat.densityKgM3 * shape.fill * 10) / 10);
    return { shape, size, massKg };
  }

  private createItem(d: Omit<SavedItem, "pos" | "rot"> & { pos: { x: number; y: number; z: number }; rot: { x: number; y: number; z: number; w: number } }): ScrapItem {
    const shape = this.shapes.get(d.shapeId);
    if (!shape) throw new Error(`Form unbekannt: ${d.shapeId}`);
    const w = this.ctx.physics.world;
    const thin = Math.min(...d.size) < 0.1; // Bleche, Latten: CCD gegen Tunneln durch den Boden
    // Runde Formen sind Achtkant-Prismen (E-011) und bekommen zusätzlich etwas mehr Dämpfung.
    const round = shape.collider === "cylinder" || shape.collider === "sphere";
    // Kurze Scheiben (Felge, Coil, Reifen) trudeln wie eine Muenze minutenlang auf der Kante und halten den ganzen
    // Haufen wach (gemeinsames Schlafen, E-012) — sie bekommen deutlich mehr Drehdaempfung (Befund M4a, Seed 42).
    const disc = round && d.size[2] < d.size[0] * 1.5;
    const body = w.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(d.pos.x, d.pos.y, d.pos.z).setRotation(d.rot)
        .setLinearDamping(disc ? 0.6 : round ? 0.3 : 0.05).setAngularDamping(disc ? 4.0 : round ? 1.0 : 0.2).setCcdEnabled(thin),
    );
    const desc = colliderFor(shape, d.size).setMass(d.massKg).setFriction(0.7).setRestitution(0.05).setCollisionGroups(COLLISION.loose);
    w.createCollider(desc, body);
    const id = nextId<ItemId>("item");
    const item: ScrapItem = {
      id, materialId: d.materialId, shapeId: d.shapeId, size: d.size, massKg: d.massKg,
      pos: { ...d.pos }, rot: { ...d.rot }, prevPos: { ...d.pos }, prevRot: { ...d.rot }, sleeping: false,
      bodyHandle: body.handle, state: "loose", origin: d.origin,
    };
    this.ctx.world.items.set(id, item);
    this.ctx.physics.register(body.handle, id);
    return item;
  }

  /** Entfernen: erst Event (Greifer, Container, Ansicht lösen Referenzen), dann Körper weg. */
  requestRemove(id: ItemId, reason: "press" | "sold" | "bundled" | "cleanup"): boolean {
    const item = this.ctx.world.items.get(id);
    if (!item) return false;
    this.ctx.bus.emit("itemRemoving", { itemId: id, reason });
    if (item.bodyHandle !== undefined) this.ctx.physics.requestRemove(item.bodyHandle);
    this.ctx.world.items.delete(id);
    return true;
  }

  /** Liegen alle losen Körper unter den Schlafschwellen? (für settle) */
  isQuiet(): boolean {
    for (const item of this.ctx.world.items.values()) {
      const b = this.ctx.physics.safeBody(item.bodyHandle);
      if (!b || b.isSleeping()) continue;
      const v = b.linvel(), a = b.angvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z >= this.sleepLin2 || a.x * a.x + a.y * a.y + a.z * a.z >= this.sleepAng2) return false;
    }
    return true;
  }

  /** Alle Körper sofort schlafen legen — nach der Vorsimulation beim Laden. */
  sleepAll(): void {
    for (const item of this.ctx.world.items.values()) {
      const b = this.ctx.physics.safeBody(item.bodyHandle);
      if (b) { b.sleep(); item.sleeping = true; }
    }
  }

  /**
   * Posen übernehmen und Schlafhilfe. Wichtig (E-012): Körper werden nur **gemeinsam** schlafen gelegt,
   * wenn der ganze lose Bestand drei Prüfungen lang unter den Schwellen liegt. Einzelne Körper unter Last
   * schlafen zu legen hat im Test Teile durch den Boden gedrückt (Kontakt mit schlafendem Körper verliert Halt).
   */
  update(ctx: SimContext): void {
    const check = ctx.world.step % this.checkEvery === 0;
    let allStill = true, anyAwake = false;
    for (const item of ctx.world.items.values()) {
      const b = ctx.physics.safeBody(item.bodyHandle);
      if (!b) continue;
      item.prevPos.x = item.pos.x; item.prevPos.y = item.pos.y; item.prevPos.z = item.pos.z;
      item.prevRot.x = item.rot.x; item.prevRot.y = item.rot.y; item.prevRot.z = item.rot.z; item.prevRot.w = item.rot.w;
      const t = b.translation(), r = b.rotation();
      item.pos.x = t.x; item.pos.y = t.y; item.pos.z = t.z;
      item.rot.x = r.x; item.rot.y = r.y; item.rot.z = r.z; item.rot.w = r.w;
      item.sleeping = b.isSleeping();
      if (check && !item.sleeping && item.state === "loose") {
        anyAwake = true;
        const v = b.linvel(), a = b.angvel();
        if (v.x * v.x + v.y * v.y + v.z * v.z >= this.sleepLin2 || a.x * a.x + a.y * a.y + a.z * a.z >= this.sleepAng2) allStill = false;
      }
    }
    if (check && anyAwake && this.sleepLin2 > 0) {
      this.quietChecks = allStill ? this.quietChecks + 1 : 0;
      if (this.quietChecks >= 3) { this.sleepAll(); this.quietChecks = 0; }
    }
  }

  save(): unknown {
    const items: SavedItem[] = [];
    for (const it of this.ctx.world.items.values()) {
      items.push({ materialId: it.materialId, shapeId: it.shapeId, size: it.size, massKg: it.massKg, pos: [it.pos.x, it.pos.y, it.pos.z], rot: [it.rot.x, it.rot.y, it.rot.z, it.rot.w], origin: it.origin });
    }
    return { items };
  }

  /** Jeder Eintrag wird einzeln geprüft; kaputte Einträge werden gezählt und übersprungen (QA H2). */
  load(data: unknown): void {
    this.rejectedOnLoad = 0;
    const d = data as { items?: unknown[] } | undefined;
    if (!d || !Array.isArray(d.items)) return;
    for (const raw of d.items) {
      const it = raw as Partial<SavedItem>;
      const ok = it && typeof it.materialId === "string" && this.materials.has(it.materialId)
        && typeof it.shapeId === "string" && this.shapes.has(it.shapeId)
        && Array.isArray(it.size) && it.size.length === 3 && it.size.every(finitePos)
        && typeof it.massKg === "number" && Number.isFinite(it.massKg) && it.massKg > 0
        && Array.isArray(it.pos) && it.pos.length === 3 && it.pos.every(Number.isFinite)
        && Array.isArray(it.rot) && it.rot.length === 4 && it.rot.every(Number.isFinite)
        && this.level.insideYard(it.pos[0] as number, it.pos[2] as number);
      if (!ok) { this.rejectedOnLoad++; continue; }
      const s = it as SavedItem;
      this.createItem({ materialId: s.materialId, shapeId: s.shapeId, size: s.size, massKg: s.massKg, pos: { x: s.pos[0], y: s.pos[1], z: s.pos[2] }, rot: { x: s.rot[0], y: s.rot[1], z: s.rot[2], w: s.rot[3] }, origin: s.origin ?? "delivery" });
    }
  }

  dispose(): void { this.quietChecks = 0; }
}

const DEFAULT_MIX = [
  { materialId: "steel", share: 0.6 }, { materialId: "alu", share: 0.12 }, { materialId: "va", share: 0.06 },
  { materialId: "copper", share: 0.06 }, { materialId: "cable", share: 0.06 }, { materialId: "wood", share: 0.06 }, { materialId: "rubble", share: 0.04 },
];

function finitePos(n: unknown): boolean { return typeof n === "number" && Number.isFinite(n) && n > 0; }

/** Volumen der Form; Zylinder: size = [Radius, Radius, Länge]. */
export function volume(shape: ShapeDef, size: [number, number, number]): number {
  switch (shape.collider) {
    case "cylinder": return Math.PI * size[0] * size[0] * size[2];
    case "sphere": return (4 / 3) * Math.PI * size[0] ** 3;
    default: return size[0] * size[1] * size[2];
  }
}

/**
 * Kollider je Form. „Zylinder" sind achteckige Prismen entlang Z (E-011): ein perfekter Zylinder rollt in
 * Rapier ohne Rollwiderstand endlos; ein verbeultes Rohr mit Kanten bleibt liegen — wie auf einem echten Platz.
 */
function colliderFor(shape: ShapeDef, size: [number, number, number]): RAPIER.ColliderDesc {
  switch (shape.collider) {
    case "cylinder": {
      const r = size[0], hz = size[2] / 2, pts: number[] = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; pts.push(Math.cos(a) * r, Math.sin(a) * r, -hz, Math.cos(a) * r, Math.sin(a) * r, hz); }
      return RAPIER.ColliderDesc.convexHull(new Float32Array(pts)) ?? RAPIER.ColliderDesc.cylinder(hz, r).setRotation({ x: SQRT_HALF, y: 0, z: 0, w: SQRT_HALF });
    }
    case "sphere": return RAPIER.ColliderDesc.ball(size[0]);
    default: return RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2);
  }
}

function randomRot(rng: Rng): { x: number; y: number; z: number; w: number } {
  const a = rng.range(0, Math.PI * 2);
  return { x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) };
}
