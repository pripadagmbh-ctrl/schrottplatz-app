import { getMaterial } from "../materials/catalog";
import { euroIndicator } from "../materials/purity";
import type { ScrapItem } from "../world/scrapItems";
import type { AmpelState } from "../world/containers";

/**
 * HUD M1 (Briefing Kap. 14): Griff-Info (Material, Gewicht, €-Indikator),
 * Sortierwert-Anzeige mit Ticker, Abwurf-Ampel-Text.
 */
export class Hud {
  private gripEl = document.getElementById("gripinfo")!;
  private moneyEl = document.getElementById("money")!;
  private displayedValue = 0;

  /** Griff-Info bei offenem Greifer: anvisiertes Objekt. */
  showTarget(item: ScrapItem | null): void {
    if (!item) {
      this.gripEl.textContent = "Greifer: offen";
      return;
    }
    const mat = getMaterial(item.materialId);
    this.gripEl.textContent = `▼ ${mat.name} · ${item.massKg.toFixed(0)} kg · ${euroIndicator(mat)}`;
  }

  /** Griff-Info beim Tragen: Ladungsliste + Ampel. */
  showCarry(items: ScrapItem[], hover: { container: string; ampel: AmpelState } | null): void {
    const byMat = new Map<string, number>();
    let total = 0;
    for (const it of items) {
      byMat.set(it.materialId, (byMat.get(it.materialId) ?? 0) + 1);
      total += it.massKg;
    }
    const parts = [...byMat.entries()].map(([id, n]) => `${n}× ${getMaterial(id).name}`);
    let text = `Greifer: ${parts.join(", ")} · ${total.toFixed(0)} kg`;
    if (hover) {
      // Zielzone unter dem Greifer samt Bewertung — nicht das Material selbst
      const verdict =
        hover.ampel === "green" ? "✓ passt" : hover.ampel === "yellow" ? "! gemischt" : "✕ falsche Zone";
      text += `  ›  über ${hover.container}: ${verdict}`;
    }
    this.gripEl.textContent = text;
  }

  showClosedEmpty(): void {
    this.gripEl.textContent = "Greifer: geschlossen (leer)";
  }

  /** Hinweis bei offener Spinne über einer abreißbaren Baugruppe. */
  showPartHint(name: string): void {
    this.gripEl.textContent = `▼ ${name} — greifen + halten zum Abreißen`;
  }

  /** Reiß-Fortschritt während des Abreißens. */
  showTearing(name: string, progress01: number): void {
    const blocks = Math.round(progress01 * 10);
    this.gripEl.textContent = `${name} abreißen ${"█".repeat(blocks)}${"░".repeat(10 - blocks)} ${(progress01 * 100).toFixed(0)} %`;
  }

  /** Konto (echtes Geld) + Haufen-Prognose, Konto mit weichem Ticker. */
  updateMoney(kontoEur: number, pilesValue: number): void {
    this.displayedValue += (kontoEur - this.displayedValue) * 0.12;
    if (Math.abs(this.displayedValue - kontoEur) < 0.5) this.displayedValue = kontoEur;
    this.moneyEl.textContent = `Konto: ${this.displayedValue.toFixed(0)} € · Haufen ≈ ${pilesValue.toFixed(0)} €`;
  }

  /**
   * Ladezustand des wartenden Abholers. Sortenrein zu laden entscheidet über
   * den Erlös — deshalb steht es dauerhaft im Bild, solange einer wartet.
   */
  updateLoad(kg: number | null, purity: number, bestellt: string | null): void {
    const el = document.getElementById("load");
    if (!el) return;
    if (kg === null) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    const p = Math.round(purity * 100);
    const ziel = bestellt ? getMaterial(bestellt).name : "Gemischt";
    if (kg === 0) {
      el.textContent = `Auftrag: ${ziel} — Container ist leer`;
      el.style.color = "#9aa2a8";
      return;
    }
    const balken = "█".repeat(Math.round(p / 10)) + "░".repeat(10 - Math.round(p / 10));
    el.textContent = `${ziel}: ${Math.round(kg)} kg · ${balken} ${p} % sortenrein`;
    // Ab 90 % lohnt das Abfahren, darunter drückt die Reinheit den Preis
    el.style.color = p >= 90 ? "#7ec96a" : p >= 65 ? "#f0d060" : "#e08a5a";
  }

  /** Phase des Tagesablaufs samt Fortschritt. */
  updateShift(text: string, sortierphase: boolean): void {
    const el = document.getElementById("shift");
    if (!el) return;
    el.textContent = text;
    el.style.color = sortierphase ? "#7ec96a" : "#f0d060";
  }

  /** Kurze Einblendung (Verkauf, Speichern, Anlieferung). */
  toast(msg: string): void {
    const el = document.getElementById("toast")!;
    el.textContent = msg;
    el.style.opacity = "1";
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.style.opacity = "0"), 2600);
  }
  private toastTimer = 0;
}
