import type { System, SimContext } from "./System";
import type { ScrapSystem } from "./ScrapSystem";
import type { ExcavatorSystem } from "./ExcavatorSystem";
import type { GripSystem } from "./GripSystem";
import type { CompositeDef, PartDef } from "@/data/types";
import type { CompositeState, ScrapItem } from "@/sim/world/WorldState";
import { nextId, type CompositeId, type ItemId } from "@/shared/ids";
import { quatFromAxisY, rotateVec, type Vec3 } from "@/shared/math";
import { clawTipDepth } from "@/shared/clawGeometry";

/**
 * Verbundteile (Briefing Kap. 8.1; M5): Rumpf = ein normales Schrottteil (Form `hull_<def>`, Masse = Rumpf + noch
 * angebaute Baugruppen), Baugruppen = Anker am Rumpf ohne eigenen Koerper. Ablauf eines Abrisses:
 *  1. Spinne schliesst (ab `engageWindowStart`) mit dem Sensor im `grabRadius` einer Baugruppe → „gefasst":
 *     Arm steht (ExcavatorSystem.lockArm), die Spinne greift nichts anderes (GripSystem.blocked).
 *  2. Zugkraft 0–1 = staerkste Achseingabe (Hauptarm, Oberwagen, Stiel; Rotator × `rotatorFactor`).
 *     Solange Zugkraft > `pullThreshold`, laeuft der Timer; bei `tearSeconds` reisst die Baugruppe ab.
 *  3. Abgerissen: eigenes Schrottteil (Form nach part.shape), sofort in der Spinne (GripSystem.forceGrab);
 *     Rumpf verliert die Masse; Event `partTorn`.
 *  4. `requires` nicht erfuellt: gefasst, aber Timer steht — HUD sagt „erst X ab". Keine Strafe.
 *  Loslassen (Spinne oeffnet) oder Wegziehen ueber `disengageRadiusM` loest den Griff.
 * Der Rumpf selbst ist greifbar und tragbar (Annahme M5-1: maxTotalKg 3500 > 950 kg). Pressen folgt in M5b.
 */
export interface Engaged { compositeId: CompositeId; partId: string; timer: number; pull: number; blockedBy: string | null }

export class CompositeSystem implements System {
  readonly name = "composites";
  readonly phase = "preStep" as const;
  readonly order = 18; // vor dem Greifer (20)

  engaged: Engaged | null = null;
  private ctx!: SimContext; private scrap!: ScrapSystem; private ex!: ExcavatorSystem; private grip!: GripSystem;
  private defs = new Map<string, CompositeDef>();
  private c!: Record<string, number | string>;
  private readonly tmp: Vec3 = { x: 0, y: 0, z: 0 }; private readonly loc: Vec3 = { x: 0, y: 0, z: 0 }; private readonly reach: Vec3 = { x: 0, y: 0, z: 0 };

  /**
   * Greifpunkt der Spinne fuer Baugruppen: Mitte auf Hoehe der Krallenspitzen (nicht der Sensor in der Korbmitte).
   * Spinne 2.0 kollidiert echt mit dem Rumpf — sie sitzt auf dem Dach, die Spitzen fassen um die Baugruppe.
   */
  private reachPoint(): Vec3 {
    const p = this.ex.pose; this.loc.x = 0; this.loc.y = -clawTipDepth(p.splay); this.loc.z = 0;
    rotateVec(p.grappleQuat, this.loc, this.reach); this.reach.x += p.grapplePos.x; this.reach.y += p.grapplePos.y; this.reach.z += p.grapplePos.z; return this.reach;
  }

  init(ctx: SimContext): void {
    this.ctx = ctx; this.scrap = ctx.get<ScrapSystem>("scrap"); this.ex = ctx.get<ExcavatorSystem>("excavator"); this.grip = ctx.get<GripSystem>("grip");
    this.c = ctx.data.balancing.composites;
    for (const d of ctx.data.composites.composites) this.defs.set(d.id, d);
    ctx.bus.on("itemRemoving", ({ itemId }) => { for (const [cid, st] of ctx.world.composites) if (st.hullItemId === itemId) { ctx.world.composites.delete(cid); if (this.engaged?.compositeId === cid) this.disengage(); } });
  }

  def(id: string): CompositeDef | undefined { return this.defs.get(id); }

  /** Wrack erzeugen: Rumpf-Teil + Zustand. Ursprung = Bodenpunkt unter dem Rumpf, `yaw` = Fahrtrichtung. */
  spawn(defId: string, pos: Vec3, yaw: number): CompositeState | null {
    const def = this.defs.get(defId); if (!def) throw new Error(`Verbundteil unbekannt: ${defId}`);
    const shape = this.scrap.shape(`hull_${defId.split("_")[0]}`) ?? this.scrap.shape("hull_car"); if (!shape) throw new Error("Rumpf-Form fehlt in materials.json");
    const size: [number, number, number] = [def.hull.half[0] * 2, def.hull.half[1] * 2, def.hull.half[2] * 2];
    const parts = def.parts.filter((p) => (p.tier ?? "MVP") === "MVP");
    const total = def.hull.massKg + parts.reduce((s, p) => s + p.massKg, 0);
    const id = nextId<CompositeId>("comp");
    const rot = quatFromAxisY(yaw, { x: 0, y: 0, z: 0, w: 1 });
    const item = this.scrap.spawnExact(def.hull.materialId, shape, size, { x: pos.x, y: pos.y + def.hull.yOffset, z: pos.z }, rot, { massKg: total, compositeId: id });
    if (!item) return null;
    const st: CompositeState = { id, defId, pos: { ...item.pos }, rot: { ...item.rot }, crushStage: 0, remainingParts: parts.map((p) => p.id), hullMassKg: def.hull.massKg, hullItemId: item.id };
    this.ctx.world.composites.set(id, st);
    return st;
  }

  hullItem(st: CompositeState): ScrapItem | undefined { return this.ctx.world.items.get(st.hullItemId); }

  /** Weltposition eines Ankers (Anker ist relativ zum Bodenpunkt des Rumpfs, das Teil sitzt yOffset hoeher). */
  anchorWorld(st: CompositeState, part: PartDef, out: Vec3): Vec3 {
    const def = this.defs.get(st.defId)!; const item = this.hullItem(st);
    const pos = item?.pos ?? st.pos, rot = item?.rot ?? st.rot;
    this.loc.x = part.anchor[0]; this.loc.y = part.anchor[1] - def.hull.yOffset; this.loc.z = part.anchor[2];
    rotateVec(rot, this.loc, out); out.x += pos.x; out.y += pos.y; out.z += pos.z; return out;
  }

  /** Noch angebaute Baugruppen (fuer Ansicht und HUD). */
  remaining(st: CompositeState): PartDef[] { const def = this.defs.get(st.defId)!; return def.parts.filter((p) => st.remainingParts.includes(p.id)); }
  blocksPress(st: CompositeState): string[] { return this.remaining(st).filter((p) => p.blocksPress).map((p) => p.id); }

  update(ctx: SimContext, dt: number): void {
    // Zustand vom Rumpf-Teil uebernehmen; verwaiste Zustaende weg
    for (const [cid, st] of ctx.world.composites) {
      const item = ctx.world.items.get(st.hullItemId);
      if (!item) { ctx.world.composites.delete(cid); if (this.engaged?.compositeId === cid) this.disengage(); continue; }
      st.pos.x = item.pos.x; st.pos.y = item.pos.y; st.pos.z = item.pos.z; st.rot = item.rot;
    }
    const g = ctx.world.excavator.grapple; const start = Number(this.c["engageWindowStart"] ?? 0.3);
    if (this.engaged) {
      const st = ctx.world.composites.get(this.engaged.compositeId); const def = st && this.defs.get(st.defId);
      const part = def?.parts.find((p) => p.id === this.engaged!.partId);
      if (!st || !def || !part || g < start || !st.remainingParts.includes(part.id)) { this.disengage(); return; }
      const a = this.anchorWorld(st, part, this.tmp); const s = this.reachPoint();
      if (!this.within(a, s, part.grabRadius + Number(this.c["disengageRadiusM"] ?? 0.4))) { this.disengage(); return; }
      const c = ctx.control;
      this.engaged.pull = Math.min(1, Math.max(Math.abs(c.boom), Math.abs(c.cab), Math.abs(c.stick), Math.abs(c.rotator) * Number(this.c["rotatorFactor"] ?? 1.8)));
      this.engaged.blockedBy = part.requires.find((r) => st.remainingParts.includes(r)) ?? null;
      if (!this.engaged.blockedBy && this.engaged.pull > Number(this.c["pullThreshold"] ?? 0.5)) {
        this.engaged.timer += dt;
        if (this.engaged.timer >= part.tearSeconds) this.tear(st, def, part);
      }
      return;
    }
    // Fassen: Spinne schliesst, nichts in der Spinne, Sensor im grabRadius einer angebauten Baugruppe
    if (g < start || g > 0.98 || ctx.control.grapple <= 0 || this.grip.count > 0) return;
    const s = this.reachPoint(); let best: { st: CompositeState; part: PartDef; d: number } | null = null;
    for (const st of ctx.world.composites.values()) {
      const def = this.defs.get(st.defId); if (!def) continue;
      const item = this.hullItem(st); if (!item || item.state !== "loose") continue;
      for (const part of def.parts) {
        if (!st.remainingParts.includes(part.id) || part.tool !== "grapple") continue;
        const a = this.anchorWorld(st, part, this.tmp); const d = Math.hypot(a.x - s.x, a.z - s.z);
        if (this.within(a, s, part.grabRadius) && (!best || d < best.d)) best = { st, part, d };
      }
    }
    if (best) this.engage(best.st, best.part);
  }

  /** Waagerecht im Radius, senkrecht mit Toleranz: die Spitzen sitzen auf dem Rumpf, der Anker liegt darunter (Rumpf ist ein Kasten). */
  private within(a: Vec3, s: Vec3, r: number): boolean {
    return Math.hypot(a.x - s.x, a.z - s.z) <= r && Math.abs(a.y - s.y) <= Math.max(r, Number(this.c["verticalToleranceM"] ?? 0.8));
  }

  /** Fuer HUD/Chip: was gerade gefasst ist. */
  engagedInfo(): { partId: string; kg: number; progress: number; blockedBy: string | null } | null {
    const e = this.engaged; if (!e) return null;
    const st = this.ctx.world.composites.get(e.compositeId); const def = st && this.defs.get(st.defId); const part = def?.parts.find((p) => p.id === e.partId);
    if (!part) return null;
    return { partId: part.id, kg: part.massKg, progress: Math.min(1, e.timer / part.tearSeconds), blockedBy: e.blockedBy };
  }

  private engage(st: CompositeState, part: PartDef): void {
    this.engaged = { compositeId: st.id, partId: part.id, timer: 0, pull: 0, blockedBy: part.requires.find((r) => st.remainingParts.includes(r)) ?? null };
    this.ex.lockArm = true; this.grip.blocked = true;
  }
  private disengage(): void { this.engaged = null; this.ex.lockArm = false; this.grip.blocked = false; }

  private tear(st: CompositeState, def: CompositeDef, part: PartDef): void {
    const hull = this.hullItem(st); if (!hull) { this.disengage(); return; }
    const a = this.anchorWorld(st, part, { x: 0, y: 0, z: 0 });
    const shapeId = part.id.startsWith("wheel") ? "tire" : part.id === "battery" ? "battery" : part.id === "engine" ? "engine" : part.shape.kind === "cylinder" ? "pipe" : "block";
    const shape = this.scrap.shape(shapeId); if (!shape) { this.disengage(); return; }
    const sz = part.shape.size;
    const size: [number, number, number] = part.shape.kind === "wheel" ? [sz[0]!, sz[0]!, sz[1]!] : part.shape.kind === "cylinder" ? [sz[0]!, sz[0]!, sz[2] ?? sz[1]!] : [sz[0]!, sz[1]!, sz[2]!];
    // Teil knapp ueber dem Anker, damit es nicht im Rumpf steckt; Rumpfdrehung uebernehmen
    a.y += 0.15;
    const item = this.scrap.spawnExact(part.materialId, shape, size, a, hull.rot);
    st.remainingParts = st.remainingParts.filter((p) => p !== part.id);
    const remainingKg = this.remaining(st).reduce((s, p) => s + p.massKg, 0);
    this.scrap.setMass(hull, def.hull.massKg + remainingKg);
    this.disengage();
    if (item) { this.scrap.setMass(item, part.massKg); item.origin = "torn"; this.grip.forceGrab(item.id); }
    this.ctx.bus.emit("partTorn", { compositeId: st.id, partId: part.id, itemId: (item?.id ?? "") as ItemId, kg: part.massKg });
    this.ctx.bus.emit("toast", { text: `${partName(part.id)} abgerissen · ${part.massKg} kg`, kind: "good" });
  }

  save(): unknown {
    return [...this.ctx.world.composites.values()].map((st) => ({ defId: st.defId, remainingParts: st.remainingParts, crushStage: st.crushStage, pos: [st.pos.x, st.pos.y, st.pos.z], rot: [st.rot.x, st.rot.y, st.rot.z, st.rot.w] }));
  }
  /** Rumpf-Teile werden vom ScrapSystem als normale Teile gesichert und geladen — hier werden sie wieder verknuepft. */
  load(data: unknown, ctx: SimContext): void {
    if (!Array.isArray(data)) return;
    const hulls = [...ctx.world.items.values()].filter((i) => i.shapeId.startsWith("hull_"));
    for (const raw of data) {
      const d = raw as { defId?: string; remainingParts?: unknown; crushStage?: number; pos?: number[] };
      const def = d.defId ? this.defs.get(d.defId) : undefined; if (!def || !Array.isArray(d.pos)) continue;
      let best: ScrapItem | null = null, bd = 0.5;
      for (const h of hulls) { const dist = Math.hypot(h.pos.x - (d.pos[0] as number), h.pos.z - (d.pos[2] as number)); if (dist < bd) { bd = dist; best = h; } }
      if (!best) continue;
      hulls.splice(hulls.indexOf(best), 1);
      const remaining = Array.isArray(d.remainingParts) ? (d.remainingParts as unknown[]).filter((p): p is string => typeof p === "string" && def.parts.some((x) => x.id === p)) : [];
      const id = nextId<CompositeId>("comp"); best.compositeId = id;
      const st: CompositeState = { id, defId: def.id, pos: { ...best.pos }, rot: { ...best.rot }, crushStage: (d.crushStage === 1 || d.crushStage === 2 ? d.crushStage : 0), remainingParts: remaining, hullMassKg: def.hull.massKg, hullItemId: best.id };
      ctx.world.composites.set(id, st);
      this.scrap.setMass(best, def.hull.massKg + this.remaining(st).reduce((s, p) => s + p.massKg, 0));
    }
  }
}

export function partName(id: string): string {
  const names: Record<string, string> = { engine: "Motor", battery: "Batterie", catalyst: "Katalysator", tank: "Tank", harness: "Kabelbaum" };
  if (id.startsWith("wheel")) return "Rad";
  return names[id] ?? id;
}
