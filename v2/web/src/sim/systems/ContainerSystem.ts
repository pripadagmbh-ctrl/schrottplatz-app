import type { System, SimContext } from "./System";
import type { ScrapSystem } from "./ScrapSystem";
import type { Level } from "@/sim/world/Level";
import type { ContainerId, ItemId } from "@/shared/ids";
import type { MaterialDef } from "@/data/types";

/**
 * Verbuchung (Briefing Kap. 9.2, 19.3): Ein loses Teil, das `bookAfterRestS` ruhig in einem Container liegt, wird
 * Masse des Containers — richtig (contentKg) oder Verunreinigung (contaminationKg). Bis dahin kann der Spieler einen
 * Fehlwurf noch herausgreifen. Sortieren gibt PUNKTE, kein Geld (Patrick 08.09.); Geld fliesst erst beim Verkauf
 * (VehicleSystem.sellContainer) mit Reinheit^2.
 * Verbuchte Teile bleiben sichtbar (`booked`, nicht greifbar), bis mehr als keepVisibleCount im Container liegen oder
 * keepVisibleS vergangen sind — dann werden sie entfernt (Budget Kap. 19: sortierte Teile zusammenfassen).
 */
interface Booked { itemId: ItemId; t: number }

export class ContainerSystem implements System {
  readonly name = "containers";
  readonly phase = "slow" as const;
  readonly order = 20;
  readonly every = 6; // 10 Hz

  private ctx!: SimContext; private scrap!: ScrapSystem;
  private restS = 3; private keepCount = 6; private keepS = 20;
  private readonly rest = new Map<ItemId, number>();
  private readonly booked = new Map<ContainerId, Booked[]>();
  private mats = new Map<string, MaterialDef>();
  private contOf = new Map<string, string>(); // containerId → materialId

  constructor(private readonly level: Level) {}

  init(ctx: SimContext): void {
    this.ctx = ctx; this.scrap = ctx.get<ScrapSystem>("scrap");
    const c = ctx.data.balancing.containers;
    this.restS = Number(c["bookAfterRestS"] ?? 3); this.keepCount = Number(c["keepVisibleCount"] ?? 6); this.keepS = Number(c["keepVisibleS"] ?? 20);
    for (const m of ctx.data.materials.materials) this.mats.set(m.id, m);
    for (const c of ctx.data.level.containers) {
      this.contOf.set(c.id, c.materialId);
      if (!ctx.world.containers.has(c.id as ContainerId)) ctx.world.containers.set(c.id as ContainerId, { id: c.id as ContainerId, contentKg: 0, contaminationKg: 0, pendingItemIds: [] });
    }
  }

  /** Zielcontainer eines Materials: direkt oder ueber sortsAs (Holz/Bauschutt → Stoerstoffbox). */
  targetContainer(materialId: string): string | null {
    const m = this.mats.get(materialId); if (!m) return null;
    if (m.containerId) return m.containerId;
    const via = m.sortsAs ? this.mats.get(m.sortsAs) : undefined; return via?.containerId ?? null;
  }

  update(ctx: SimContext, dt: number): void {
    const lin2 = ctx.data.balancing.physics.sleepLinearThreshold ** 2 * 4; // etwas grosszuegiger als die Schlafschwelle
    for (const item of ctx.world.items.values()) {
      if (item.state !== "loose" || item.bodyHandle === undefined) { this.rest.delete(item.id); continue; }
      // M5: Ein Rumpf mit angebauten Baugruppen wird nicht verbucht (Batterie im Stahlhaufen) — erst zerlegen
      if (item.compositeId) { const st = ctx.world.composites.get(item.compositeId); if (st && st.remainingParts.length) { this.rest.delete(item.id); continue; } }
      const cid = this.level.containerAt(item.pos.x, item.pos.z);
      if (!cid) { this.rest.delete(item.id); continue; }
      const body = ctx.physics.safeBody(item.bodyHandle); if (!body) continue;
      const v = body.linvel(); const quiet = item.sleeping || v.x * v.x + v.y * v.y + v.z * v.z < lin2;
      const t = quiet ? (this.rest.get(item.id) ?? 0) + dt : 0;
      this.rest.set(item.id, t);
      if (t >= this.restS) this.book(item.id, cid as ContainerId);
    }
    // Sichtbarkeit verbuchter Teile begrenzen
    for (const [cid, list] of this.booked) {
      let i = 0;
      for (const b of list) b.t += dt;
      while (list.length > this.keepCount || (list.length && list[0]!.t > this.keepS)) { const b = list.shift()!; this.scrap.requestRemove(b.itemId, "bundled"); i++; }
      if (i) { const cont = ctx.world.containers.get(cid); if (cont) cont.pendingItemIds = list.map((b) => b.itemId); }
    }
  }

  private book(itemId: ItemId, cid: ContainerId): void {
    const ctx = this.ctx; const item = ctx.world.items.get(itemId); const cont = ctx.world.containers.get(cid);
    if (!item || !cont) return;
    this.rest.delete(itemId);
    const correct = this.targetContainer(item.materialId) === cid;
    // Metall in der Stoerstoffbox ist „erlaubt, aber Verlust": zaehlt als Inhalt der Stoerstoffbox (Gebuehr), keine Punkte
    const tolerated = !correct && this.contOf.get(cid) === "contaminant";
    if (correct || tolerated) cont.contentKg += item.massKg; else cont.contaminationKg += item.massKg;
    item.state = "booked";
    const list = this.booked.get(cid) ?? []; list.push({ itemId, t: 0 }); this.booked.set(cid, list);
    cont.pendingItemIds = list.map((b) => b.itemId);
    const e = ctx.world.economy, econ = ctx.data.balancing.economy;
    const delta = correct ? Math.round(Number(econ["sortPointsPerItem"] ?? 10) + item.massKg * Number(econ["sortPointsPerKg"] ?? 0.1)) : tolerated ? 0 : Number(econ["wrongSortPoints"] ?? -10);
    e.sortPoints = Math.max(0, e.sortPoints + delta);
    if (correct) e.stats.correctSorts++; else e.stats.wrongSorts++;
    ctx.bus.emit("itemSorted", { itemId, containerId: cid, correct, kg: item.massKg });
    ctx.bus.emit("sortPointsChanged", { delta, total: e.sortPoints, itemId, correct });
  }

  /** Reinheit 0..1 eines Containers */
  purity(cid: string): number {
    const c = this.ctx.world.containers.get(cid as ContainerId); if (!c) return 1;
    const t = c.contentKg + c.contaminationKg; return t > 0 ? c.contentKg / t : 1;
  }

  save(): unknown { return [...this.ctx.world.containers.values()].map((c) => ({ id: c.id, contentKg: c.contentKg, contaminationKg: c.contaminationKg })); }
  load(data: unknown, ctx: SimContext): void {
    if (!Array.isArray(data)) return;
    for (const d of data as { id: ContainerId; contentKg: number; contaminationKg: number }[]) { const c = ctx.world.containers.get(d.id); if (c) { c.contentKg = d.contentKg; c.contaminationKg = d.contaminationKg; } }
  }
  dispose(): void { this.rest.clear(); this.booked.clear(); }
}
