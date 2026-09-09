import type { WorldState } from "@/sim/world/WorldState";
import type { GameData } from "@/data/types";
import type { EventBus } from "@/shared/events";
import type { ActiveMission } from "@/sim/systems/MissionSystem";
import { makeT, missionText, missionProgress } from "./format";

/**
 * HUD M4a (Briefing Kap. 14.1, gekuerzt): Konto und Sortierpunkte oben Mitte, Toasts darunter,
 * Verkaufsliste (Container → kg, Reinheit, Erloes-Prognose, „Abholer rufen"). M4b: Tag-Anzeige, „Tag beenden"
 * (gruen, wenn alle Fuhren durch sind), Auftragszeile unter der Leiste.
 * DOM nur bei Aenderung schreiben.
 */
export class Hud {
  readonly bar: HTMLElement; private readonly money: HTMLElement; private readonly points: HTMLElement;
  private readonly toasts: HTMLElement; private readonly panel: HTMLElement; private readonly list: HTMLElement;
  private readonly dayEl: HTMLElement; private readonly endBtn: HTMLButtonElement; private readonly missions: HTMLElement;
  private lastMoney = NaN; private lastPoints = NaN; private lastList = ""; private lastDay = ""; private lastMissions = ""; private lastEnd = "";
  private readonly names = new Map<string, string>(); private readonly price = new Map<string, number>();
  private readonly t;

  constructor(parent: HTMLElement, private readonly data: GameData, bus: EventBus, private readonly onPickup: (containerId: string) => void, onEndDay: () => void) {
    const i18n = data.i18n as Record<string, Record<string, string>>;
    this.t = makeT(data.i18n as Record<string, unknown>);
    for (const m of data.materials.materials) { this.names.set(m.id, i18n["material"]?.[m.id] ?? m.id); this.price.set(m.id, m.sellPricePerKg); }
    this.bar = el("div", "hud-bar"); parent.appendChild(this.bar);
    this.money = el("span", "hud-money"); this.points = el("span", "hud-points");
    const sell = el("button", "hud-sell") as HTMLButtonElement; sell.type = "button"; sell.textContent = "Verkaufen";
    this.dayEl = el("span", "hud-day");
    this.endBtn = el("button", "hud-end") as HTMLButtonElement; this.endBtn.type = "button"; this.endBtn.textContent = this.t("hud.endDay");
    this.endBtn.addEventListener("pointerup", onEndDay);
    this.bar.append(this.dayEl, this.money, this.points, sell, this.endBtn);
    this.missions = el("div", "hud-missions"); parent.appendChild(this.missions);
    this.toasts = el("div", "hud-toasts"); parent.appendChild(this.toasts);
    this.panel = el("div", "sell-panel"); this.panel.hidden = true; parent.appendChild(this.panel);
    const head = el("div", "sell-head"); head.textContent = "Abholer rufen — zahlt kg × Preis × Reinheit²";
    const close = el("button", "sell-close") as HTMLButtonElement; close.type = "button"; close.textContent = "✕"; close.addEventListener("pointerup", () => (this.panel.hidden = true));
    head.appendChild(close);
    this.list = el("div", "sell-list"); this.panel.append(head, this.list);
    sell.addEventListener("pointerup", () => { this.panel.hidden = !this.panel.hidden; this.lastList = ""; });
    this.list.addEventListener("pointerup", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("button[data-cid]"); if (b && !b.hasAttribute("disabled")) { this.onPickup(b.dataset["cid"]!); this.panel.hidden = true; } });
    bus.on("toast", ({ text, kind }) => this.toast(text, kind));
    bus.on("sortPointsChanged", ({ delta, correct }) => { if (delta !== 0) this.toast(`${delta > 0 ? "+" : ""}${delta} P${correct ? "" : " · Fehlwurf"}`, correct ? "good" : "bad", 1400); });
  }

  private toast(text: string, kind: string, ms = 3200): void {
    const t = el("div", `toast ${kind}`); t.textContent = text; this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
  }

  update(world: WorldState, pickupBusy: boolean, missions: readonly ActiveMission[] = [], deliveriesFinished = false): void {
    const m = Math.round(world.economy.moneyEur), p = world.economy.sortPoints;
    if (m !== this.lastMoney) { this.money.textContent = `${m.toLocaleString("de-DE")} €`; this.lastMoney = m; }
    if (p !== this.lastPoints) { this.points.textContent = `${p} P`; this.lastPoints = p; }
    const dayTxt = this.t("hud.day", { day: world.day.day, total: this.data.balancing.day.campaignDays });
    if (dayTxt !== this.lastDay) { this.dayEl.textContent = dayTxt; this.lastDay = dayTxt; }
    const endState = world.day.phase !== "work" ? "hidden" : deliveriesFinished ? "ready" : "open";
    if (endState !== this.lastEnd) { this.endBtn.hidden = endState === "hidden"; this.endBtn.classList.toggle("ready", endState === "ready"); this.lastEnd = endState; }
    const mHtml = world.day.phase === "work" && missions.length
      ? missions.map((x) => `<span class="${x.done ? "done" : ""}">${missionText(x.def, this.data, this.t).replace(/[<>&]/g, "")} · ${missionProgress(x)}</span>`).join("")
      : "";
    if (mHtml !== this.lastMissions) { this.missions.innerHTML = mHtml; this.missions.hidden = !mHtml; this.lastMissions = mHtml; }
    if (this.panel.hidden) return;
    const rows: string[] = [];
    for (const c of this.data.level.containers) {
      const st = world.containers.get(c.id as never); const total = st ? st.contentKg + st.contaminationKg : 0;
      const purity = total > 0 && st ? st.contentKg / total : 1;
      const price = this.price.get(c.materialId) ?? 0;
      const eur = price < 0 ? total * price : total * price * purity * purity;
      const pct = Math.round(purity * 100); const cls = pct >= 95 ? "ok" : pct >= 80 ? "warn" : "bad";
      rows.push(`<div class="sell-row"><b>${this.names.get(c.materialId) ?? c.materialId}</b><span>${Math.round(total)} kg</span><span class="${cls}">${total > 0 ? pct + " %" : "—"}</span><span>${eur >= 0 ? "" : "−"}${Math.abs(eur).toFixed(0)} €</span><button type="button" data-cid="${c.id}" ${total <= 0 || pickupBusy ? "disabled" : ""}>Abholer</button></div>`);
    }
    const html = rows.join("");
    if (html !== this.lastList) { this.list.innerHTML = html; this.lastList = html; }
  }
}

function el(tag: string, cls: string): HTMLElement { const e = document.createElement(tag); e.className = cls; return e; }
