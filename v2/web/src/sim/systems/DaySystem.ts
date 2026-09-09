import type { System, SimContext } from "./System";
import type { VehicleSystem } from "./VehicleSystem";
import { emptyDayReport, type DayState, type EconomyState } from "@/sim/world/WorldState";

/**
 * Tagesstruktur (Briefing Kap. 4.3, 10.2; M4b):
 *  morning  — Morgen-Karte steht, nichts faehrt. `startDay()` (UI-Knopf) → work.
 *  work     — Fuhren kommen automatisch (VehicleSystem, deliveriesPerDay), Spieler sortiert und verkauft.
 *             `endDay()` (UI-Knopf) → evening. Erlaubt jederzeit; Fahrzeuge auf dem Platz fahren zu Ende (kein Abbruch).
 *  evening  — Bilanz: Fixkosten abziehen, negatives Konto verzinsen (debtInterestFactor, SW), Pleite pruefen.
 *             `nextDay()` → Tag +1, morning; nach campaignDays → ended.
 *  ended    — Pleite oder Kampagne geschafft; nur noch „Neu beginnen" (App).
 * Die Tagesbilanz (`world.day.report`) sammelt Geldbewegungen ueber `moneyChanged` (Praefix des Grundes) und
 * Sortierpunkte ueber `sortPointsChanged`. Bonus fuer Auftraege bucht das MissionSystem ueber `addBonus()`.
 * Speichert Tag + Wirtschaft (Bagger-Pose liegt in world.excavator und wird hier mitgesichert).
 */
export class DaySystem implements System {
  readonly name = "day";
  readonly phase = "slow" as const;
  readonly order = 30;
  readonly every = 6;

  private ctx!: SimContext;
  private fixedEur = 150; private creditLimit = -1500; private interest = 1.2; private campaignDays = 30;

  init(ctx: SimContext): void {
    this.ctx = ctx;
    const e = ctx.data.balancing.economy;
    this.fixedEur = Number(e["fixedCostsPerDayEur"] ?? 150); this.creditLimit = Number(e["creditLimitEur"] ?? -1500);
    this.interest = Number(e["debtInterestFactor"] ?? e["creditPenaltyFactor"] ?? 1.2); this.campaignDays = ctx.data.balancing.day.campaignDays;
    ctx.bus.on("moneyChanged", ({ deltaEur, reason }) => {
      const r = ctx.world.day.report;
      if (reason.startsWith("Verkauf")) r.salesEur += deltaEur;
      else if (reason.startsWith("Ankauf")) r.purchasesEur += -deltaEur;
    });
    ctx.bus.on("sortPointsChanged", ({ delta, correct }) => { const r = ctx.world.day.report; r.points += delta; if (correct) r.correctSorts++; else r.wrongSorts++; });
    ctx.bus.on("dayPhaseChanged", () => { /* Platzhalter fuer Zaehler; UI hoert selbst */ });
  }

  get day(): DayState { return this.ctx.world.day; }
  get economy(): EconomyState { return this.ctx.world.economy; }
  /** Wie viele Fuhren der Tag laut Plan hat (Tag 0 = 0, Tutorial ruft selbst). */
  plannedDeliveries(day = this.day.day): number { const t = this.ctx.data.balancing.day.deliveriesPerDay; return t[String(day)] ?? t["4"] ?? 2; }
  /** Fuhren erledigt und keine mehr geplant → Tag kann ohne Verlust beendet werden. */
  get deliveriesFinished(): boolean {
    const d = this.day; const veh = this.ctx.get<VehicleSystem>("vehicles");
    return d.deliveriesDone >= this.plannedDeliveries() && !veh.active;
  }

  update(ctx: SimContext, dt: number): void {
    const d = ctx.world.day;
    if (d.phase === "work" || d.phase === "morning" || d.phase === "evening") d.secondsInPhase += dt;
  }

  private setPhase(phase: DayState["phase"]): void {
    const d = this.ctx.world.day; if (d.phase === phase) return;
    d.phase = phase; d.secondsInPhase = 0;
    this.ctx.bus.emit("dayPhaseChanged", { day: d.day, phase });
  }

  startDay(): boolean { if (this.day.phase !== "morning") return false; this.setPhase("work"); return true; }

  /** Feierabend: Fixkosten, Zinsen, Pleite-Pruefung. Fahrzeuge auf dem Platz laufen weiter aus (kein Abbruch). */
  endDay(): boolean {
    if (this.day.phase !== "work") return false;
    const e = this.economy, r = this.day.report;
    if (this.fixedEur > 0) { e.moneyEur = round2(e.moneyEur - this.fixedEur); r.fixedEur = this.fixedEur; this.ctx.bus.emit("moneyChanged", { deltaEur: -this.fixedEur, totalEur: e.moneyEur, reason: "Fixkosten" }); }
    if (e.moneyEur < 0 && this.interest > 1) {
      const z = round2(-e.moneyEur * (this.interest - 1)); e.moneyEur = round2(e.moneyEur - z); r.interestEur = z;
      this.ctx.bus.emit("moneyChanged", { deltaEur: -z, totalEur: e.moneyEur, reason: "Zinsen" });
    }
    e.stats.daysPlayed += 1; e.stats.correctSorts += r.correctSorts; e.stats.wrongSorts += r.wrongSorts;
    const bankrupt = e.moneyEur < this.creditLimit;
    const campaignDone = !bankrupt && this.day.day + 1 >= this.campaignDays;
    this.setPhase("evening");
    this.ctx.bus.emit("dayEnded", { day: this.day.day, bankrupt, campaignDone });
    this.ctx.bus.emit("saveRequested", { reason: "day" });
    if (bankrupt || campaignDone) this.setPhase("ended");
    return true;
  }

  nextDay(): boolean {
    if (this.day.phase !== "evening") return false;
    const d = this.day; d.day += 1; d.deliveriesToday = 0; d.deliveriesDone = 0; d.report = emptyDayReport(this.economy.moneyEur);
    this.setPhase("morning");
    return true;
  }

  /** Vom MissionSystem: Bonus gutschreiben und in der Bilanz fuehren. */
  addBonus(eur: number, missionId: string): void {
    const e = this.economy; e.moneyEur = round2(e.moneyEur + eur); this.day.report.missionBonusEur += eur; this.day.report.missionsDone += 1;
    this.ctx.bus.emit("moneyChanged", { deltaEur: eur, totalEur: e.moneyEur, reason: `Bonus ${missionId}` });
  }

  get isBankrupt(): boolean { return this.economy.moneyEur < this.creditLimit; }
  get isCampaignDone(): boolean { return this.day.day + 1 >= this.campaignDays && this.day.phase === "ended"; }

  save(): unknown {
    const w = this.ctx.world; const veh = this.ctx.get<VehicleSystem>("vehicles");
    // Fahrzeuge unterwegs werden nicht gesichert (E-028): ihre Fuhre zaehlt beim Laden als nicht angekommen
    const inFlight = veh.runs.filter((r) => r.def.id !== "rolloff").length;
    return { day: { ...w.day, deliveriesToday: Math.max(0, w.day.deliveriesToday - inFlight) }, economy: w.economy, excavator: w.excavator };
  }
  load(data: unknown, ctx: SimContext): void {
    const d = data as { day?: Partial<DayState>; economy?: Partial<EconomyState>; excavator?: Partial<typeof ctx.world.excavator> } | undefined;
    if (!d || typeof d !== "object") return;
    if (d.day && typeof d.day.day === "number" && Number.isFinite(d.day.day)) {
      const phase = d.day.phase; const okPhase = phase === "morning" || phase === "work" || phase === "evening" || phase === "ended";
      Object.assign(ctx.world.day, { day: Math.max(0, Math.floor(d.day.day)), phase: okPhase ? phase : "morning", secondsInPhase: 0, deliveriesToday: num(d.day.deliveriesToday), deliveriesDone: num(d.day.deliveriesDone), report: { ...emptyDayReport(0), ...(d.day.report ?? {}) } });
    }
    if (d.economy && typeof d.economy.moneyEur === "number" && Number.isFinite(d.economy.moneyEur)) {
      const e = ctx.world.economy;
      e.moneyEur = d.economy.moneyEur; e.starsTotal = num(d.economy.starsTotal); e.sortPoints = num(d.economy.sortPoints);
      e.premiumUnlocked = d.economy.premiumUnlocked === true; e.upgrades = Array.isArray(d.economy.upgrades) ? d.economy.upgrades.filter((u) => typeof u === "string") : [];
      if (d.economy.stats) e.stats = { ...e.stats, ...Object.fromEntries(Object.entries(d.economy.stats).filter(([, v]) => typeof v === "number" && Number.isFinite(v))) };
    }
    if (d.excavator) {
      const x = d.excavator; const ex = ctx.world.excavator;
      if (x.pos && [x.pos.x, x.pos.z].every((v) => typeof v === "number" && Number.isFinite(v))) { ex.pos.x = x.pos.x; ex.pos.z = x.pos.z; }
      for (const k of ["heading", "cab", "boom", "stick", "rotator"] as const) if (typeof x[k] === "number" && Number.isFinite(x[k])) ex[k] = x[k] as number;
    }
  }
}

function round2(x: number): number { return Math.round(x * 100) / 100; }
function num(v: unknown): number { return typeof v === "number" && Number.isFinite(v) ? v : 0; }
