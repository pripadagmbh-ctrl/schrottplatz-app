import type { System, SimContext } from "./System";
import type { DaySystem } from "./DaySystem";
import type { MissionDef } from "@/data/types";
import type { Level } from "@/sim/world/Level";
import { Rng } from "@/shared/rng";

/**
 * Tagesauftraege (Briefing Kap. 11.2; M4b): am Morgen jedes Tages ≥ 1 werden `perDay` Auftraege aus missions.json
 * gezogen (gewichtet, gefiltert nach fromDay/toDay und Tier MVP, ohne Doppelte; Seed = Tag, damit ein Spielstand
 * dieselben Auftraege wiederbekommt). Typen im MVP:
 *  deliver  — heute verkaufte kg des Materials mit Reinheit ≥ minPurity (je Verkauf gezaehlt) erreichen `kg`
 *  clear    — beim Feierabend liegen in der Zone hoechstens `maxLooseKg` lose
 *  customer — ein Kunde (bestimmter oder beliebiger) ist in ≤ maxMinutes vom Tor bis Tor durch
 *  dismantle— das benannte Teil (`partId`) ist vom Wrack abgerissen (M6, Tag 2)
 *  press    — ein Rumpf ist zum Paket gepresst (M6, Tag 3)
 * Erfuellt → Bonus (DaySystem.addBonus), ein Stern, `missionCompleted`. Tag 0 (Tutorial) hat keine Auftraege.
 *
 * dismantle und press setzen voraus, dass an dem Tag ueberhaupt ein Wrack auf dem Platz liegt — der Tieflader
 * kommt ab Tag 1 (customers.json, Kunde `rehm`). `supported()` prueft das, damit nie ein Auftrag gezogen wird,
 * den der Spieler gar nicht erfuellen kann. Genau daran ist der Zerlege-Auftrag vorher gescheitert: Er stand
 * auf `fromDay: 5`, der MVP endet aber nach Tag 3 — er wurde nie ausgespielt (Entscheidung 09.09., E-047).
 */
export interface ActiveMission { def: MissionDef; progress: number; target: number; done: boolean }

export class MissionSystem implements System {
  readonly name = "missions";
  readonly phase = "slow" as const;
  readonly order = 40;
  readonly every = 6;

  readonly active: ActiveMission[] = [];
  private ctx!: SimContext; private rolledDay = -1;

  constructor(private readonly level: Level) {}

  init(ctx: SimContext): void {
    this.ctx = ctx;
    ctx.bus.on("dayPhaseChanged", ({ day, phase }) => {
      if (phase === "morning") this.roll(day);
      if (phase === "evening") this.evaluateClear();
    });
    ctx.bus.on("containerSold", ({ containerId, kg, purity }) => {
      const cont = ctx.data.level.containers.find((c) => c.id === containerId); if (!cont) return;
      for (const m of this.active) {
        if (m.done || m.def.type !== "deliver") continue;
        const p = m.def.params;
        if (p["materialId"] === cont.materialId && purity >= Number(p["minPurity"] ?? 0)) { m.progress += kg; this.check(m); }
      }
    });
    ctx.bus.on("vehicleLeft", ({ deliveryId, secondsOnSite }) => {
      const d = ctx.world.deliveries.get(deliveryId); if (!d || d.customerId === "pickup") return;
      for (const m of this.active) {
        if (m.done || m.def.type !== "customer") continue;
        const p = m.def.params; const who = p["customerId"];
        if ((who === undefined || who === d.customerId) && secondsOnSite <= Number(p["maxMinutes"]) * 60) { m.progress = 1; this.check(m); }
      }
    });
    ctx.bus.on("partTorn", ({ partId }) => {
      for (const m of this.active) {
        if (m.done || m.def.type !== "dismantle") continue;
        if (m.def.params["partId"] === partId) { m.progress = 1; this.check(m); }
      }
    });
    ctx.bus.on("pressDone", () => {
      for (const m of this.active) {
        if (m.done || m.def.type !== "press") continue;
        m.progress = 1; this.check(m);
      }
    });
  }

  /** Auftraege des Tages ziehen; Tag 0 bleibt leer (Tutorial). */
  roll(day: number): void {
    if (this.rolledDay === day) return;
    this.rolledDay = day; this.active.length = 0;
    if (day < 1) { this.ctx.bus.emit("missionsRolled", { day, missionIds: [] }); return; }
    const file = this.ctx.data.missions; const rng = new Rng(1000 + day);
    const pool = file.missions.filter((m) => m.tier === "MVP" && m.fromDay <= day && (m.toDay === undefined || day <= m.toDay) && this.supported(m));
    const picked: MissionDef[] = [];
    while (picked.length < file.perDay && pool.length) {
      const m = rng.pickWeighted(pool, (x) => x.weight); picked.push(m); pool.splice(pool.indexOf(m), 1);
    }
    for (const def of picked) this.active.push({ def, progress: 0, target: this.targetOf(def), done: false });
    this.ctx.bus.emit("missionsRolled", { day, missionIds: picked.map((m) => m.id) });
  }

  private supported(m: MissionDef): boolean {
    if (m.type === "deliver") return this.ctx.data.level.containers.some((c) => c.materialId === m.params["materialId"]);
    if (m.type === "clear") return this.ctx.data.level.zones.some((z) => z.id === m.params["zoneId"]);
    if (m.type === "customer") { const who = m.params["customerId"]; return who === undefined || this.ctx.data.customers.customers.some((c) => c.id === who && c.fromDay <= this.rolledDay); }
    if (m.type === "dismantle" || m.type === "press") {
      // Es muss die Wrack-Vorlage geben und der Tieflader muss sie schon gebracht haben koennen
      const def = this.ctx.data.composites.composites.find((c) => c.id === m.params["compositeDefId"]);
      if (!def || def.tier === "V1") return false;
      if (!this.wreckPossibleBy(String(m.params["compositeDefId"]), this.rolledDay)) return false;
      if (m.type !== "dismantle") return true;
      return def.parts.some((p) => p.id === m.params["partId"] && p.unlockDay <= this.rolledDay);
    }
    return false;
  }

  /** Bringt bis zu diesem Tag ueberhaupt ein Kunde dieses Wrack? (customers.json, Feld `compositeDefId`) */
  private wreckPossibleBy(compositeDefId: string, day: number): boolean {
    return this.ctx.data.customers.customers.some((c) => c.fromDay <= day && c.compositeDefId === compositeDefId);
  }
  private targetOf(def: MissionDef): number {
    if (def.type === "deliver") return Number(def.params["kg"]);
    if (def.type === "clear") return Number(def.params["maxLooseKg"]);
    return 1;
  }

  /** Lose kg in einer Zone (fuer clear-Auftraege und HUD). */
  looseKgIn(zoneId: string): number {
    let kg = 0;
    for (const it of this.ctx.world.items.values()) if (it.state === "loose" && this.level.inZone(zoneId, it.pos.x, it.pos.z)) kg += it.massKg;
    return kg;
  }

  update(ctx: SimContext): void {
    if (this.rolledDay !== ctx.world.day.day) this.roll(ctx.world.day.day); // auch nach Laden ohne Auftrags-Block
    for (const m of this.active) if (!m.done && m.def.type === "clear") m.progress = this.looseKgIn(String(m.def.params["zoneId"]));
  }

  private evaluateClear(): void {
    for (const m of this.active) if (!m.done && m.def.type === "clear") { m.progress = this.looseKgIn(String(m.def.params["zoneId"])); if (m.progress <= m.target) this.complete(m); }
  }

  private check(m: ActiveMission): void { if (!m.done && m.progress >= m.target) this.complete(m); }

  private complete(m: ActiveMission): void {
    m.done = true;
    const stars = this.ctx.data.missions.starsPerMission; this.ctx.world.economy.starsTotal += stars;
    this.ctx.get<DaySystem>("day").addBonus(m.def.bonusEur, m.def.id);
    this.ctx.bus.emit("missionCompleted", { missionId: m.def.id, bonusEur: m.def.bonusEur });
    this.ctx.bus.emit("toast", { text: `Auftrag erfüllt: +${m.def.bonusEur} € · ★`, kind: "good" });
  }

  save(): unknown { return { day: this.rolledDay, active: this.active.map((m) => ({ id: m.def.id, progress: m.progress, done: m.done })) }; }
  load(data: unknown): void {
    const d = data as { day?: number; active?: { id?: string; progress?: number; done?: boolean }[] } | undefined;
    if (!d || typeof d.day !== "number" || !Array.isArray(d.active)) return;
    this.rolledDay = d.day; this.active.length = 0;
    for (const a of d.active) {
      const def = this.ctx.data.missions.missions.find((m) => m.id === a.id); if (!def) continue;
      this.active.push({ def, progress: typeof a.progress === "number" && Number.isFinite(a.progress) ? a.progress : 0, target: this.targetOf(def), done: a.done === true });
    }
  }
}
