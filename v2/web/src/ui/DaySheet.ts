import type { GameData } from "@/data/types";
import type { Simulation } from "@/sim/Simulation";
import { makeT, missionText, missionProgress, eur } from "./format";

/**
 * Bottom-Sheet fuer Morgen, Feierabend und Spielende (M4b, Briefing Kap. 14.2 gekuerzt; keine Figuren, E-027).
 *  morning — „Tag N", geplante Fuhren, Fixkosten, Auftraege des Tages, [Arbeitstag starten]
 *  evening — Bilanz aus world.day.report, Sterne, Kontostand, [Naechster Tag], Export/Import
 *  ended   — Pleite oder Kampagne geschafft, [Neu beginnen]
 * Liest nur; Aktionen laufen ueber Callbacks der App. Waehrend das Sheet offen ist, liegt es ueber der Touch-Ebene.
 */
export interface DaySheetActions { onStart(): void; onNext(): void; onRestart(): void; onExport(): void; onImport(file: File): void }

export class DaySheet {
  private readonly root: HTMLElement; private readonly body: HTMLElement; private readonly file: HTMLInputElement;
  private readonly t; private lastKey = "";

  constructor(parent: HTMLElement, private readonly data: GameData, private readonly sim: Simulation, private readonly actions: DaySheetActions) {
    this.t = makeT(data.i18n as Record<string, unknown>);
    this.root = document.createElement("div"); this.root.className = "sheet"; this.root.hidden = true; parent.appendChild(this.root);
    this.body = document.createElement("div"); this.body.className = "sheet-body"; this.root.appendChild(this.body);
    this.file = document.createElement("input"); this.file.type = "file"; this.file.accept = "application/json,.json"; this.file.hidden = true; this.root.appendChild(this.file);
    this.file.addEventListener("change", () => { const f = this.file.files?.[0]; if (f) this.actions.onImport(f); this.file.value = ""; });
    this.body.addEventListener("pointerup", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]"); if (!b) return;
      const act = b.dataset["act"];
      if (act === "start") this.actions.onStart(); else if (act === "next") this.actions.onNext(); else if (act === "restart") this.actions.onRestart();
      else if (act === "export") this.actions.onExport(); else if (act === "import") this.file.click();
    });
  }

  get open(): boolean { return !this.root.hidden; }

  /** Pro Simulationsschritt aufrufen — schreibt DOM nur bei Aenderung. */
  update(): void {
    const d = this.sim.world.day; const e = this.sim.world.economy;
    const show = d.phase !== "work";
    if (this.root.hidden === show) this.root.hidden = !show;
    if (!show) { this.lastKey = ""; return; }
    const key = `${d.phase}:${d.day}:${Math.round(e.moneyEur * 100)}:${this.sim.missions.active.map((m) => m.def.id + m.done).join(",")}:${this.sim.day.isBankrupt}`;
    if (key === this.lastKey) return; this.lastKey = key;
    this.body.innerHTML = d.phase === "morning" ? this.morning() : d.phase === "evening" ? this.evening() : this.ended();
  }

  private morning(): string {
    const t = this.t, d = this.sim.world.day; const fixed = Number(this.data.balancing.economy["fixedCostsPerDayEur"]);
    const ms = this.sim.missions.active;
    const list = d.day === 0 ? `<p class="muted">${t("day.noMissions")}</p>`
      : `<h3>${t("day.missions")}</h3><ul>${ms.map((m) => `<li>${esc(missionText(m.def, this.data, t))} <span class="bonus">+${m.def.bonusEur} € ★</span></li>`).join("")}</ul>`;
    return `<h2>${t("day.morning", { day: d.day })}</h2><p class="muted">${t("day.morningSub", { deliveries: this.sim.day.plannedDeliveries(), fixed })}</p>${list}
      <div class="sheet-actions"><button type="button" class="primary" data-act="start">${t("hud.startDay")}</button></div>`;
  }

  private evening(): string {
    const t = this.t, d = this.sim.world.day, r = d.report, e = this.sim.world.economy;
    const ms = this.sim.missions.active;
    const row = (label: string, val: string, cls = "") => `<div class="row"><span>${label}</span><b class="${cls}">${val}</b></div>`;
    const missionRows = ms.length ? `<h3>${t("day.missions")}</h3>${ms.map((m) => row(esc(missionText(m.def, this.data, t)), missionProgress(m), m.done ? "ok" : "muted")).join("")}` : "";
    return `<h2>${t("day.evening", { day: d.day })}</h2>
      ${row(t("day.sales"), eur(r.salesEur), "ok")}${row(t("day.purchases"), eur(-r.purchasesEur), r.purchasesEur ? "bad" : "")}${row(t("day.fixed"), eur(-r.fixedEur), "bad")}
      ${r.interestEur ? row(t("day.interest"), eur(-r.interestEur), "bad") : ""}${r.missionBonusEur ? row(t("day.missionBonus"), eur(r.missionBonusEur), "ok") : ""}
      ${row(t("day.points"), `${r.points} P (${r.correctSorts} ✓ / ${r.wrongSorts} ✗)`)}${row(t("day.stars"), `★ ${e.starsTotal}`)}
      ${row(t("day.balance"), eur(e.moneyEur), e.moneyEur < 0 ? "bad" : "")}
      ${missionRows}
      <div class="sheet-actions"><button type="button" class="primary" data-act="next">${t("hud.nextDay")}</button>
      <button type="button" data-act="export">${t("day.export")}</button><button type="button" data-act="import">${t("day.import")}</button></div>`;
  }

  private ended(): string {
    const t = this.t; const bankrupt = this.sim.day.isBankrupt;
    return `<h2>${bankrupt ? t("day.bankrupt") : t("day.campaignDone", { days: this.data.balancing.day.campaignDays })}</h2>
      <p class="muted">${t("day.balance")}: ${eur(this.sim.world.economy.moneyEur)} · ★ ${this.sim.world.economy.starsTotal}</p>
      <div class="sheet-actions"><button type="button" class="primary" data-act="restart">${t("day.restart")}</button><button type="button" data-act="export">${t("day.export")}</button></div>`;
  }
}

function esc(s: string): string { return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!); }
