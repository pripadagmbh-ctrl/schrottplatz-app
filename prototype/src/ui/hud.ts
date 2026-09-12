import { getMaterial } from "../materials/catalog";
import { euroIndicator, masseText, preisProTonne } from "../materials/purity";
import type { ScrapItem } from "../world/scrapItems";
import type { AmpelState } from "../world/containers";

/**
 * HUD M1 (Briefing Kap. 14): Griff-Info (Material, Gewicht, €-Indikator),
 * Sortierwert-Anzeige mit Ticker, Abwurf-Ampel-Text.
 */
/**
 * Ab dieser Masse wird ein Stueck beim Namen genannt statt nur nach Fraktion
 * gezaehlt. Darunter sind es Bleche und Profile, bei denen der Name nichts
 * hilft.
 */
const GROSS_AB_KG = 60;
/** So viele Namen hoechstens — danach wird zusammengefasst. */
const GROSS_MAX = 3;

/**
 * Woraus das Stueck vorwiegend besteht.
 *
 * Ansage 12.09.2026: „Bei Spinne sollte immer das Hauptmaterial wie Alu, VA
 * etc. mit angezeigt werden." Bei sortenreinem Schrott ist das die Fraktion
 * selbst; bei einem Verbundteil die groesste Fraktion darin — sonst stuende da
 * nur „Mischschrott", und man wuesste nicht, ob man eine Waschmaschine oder
 * einen Kupfermotor in der Schale hat.
 */
function hauptMaterial(item: ScrapItem): string {
  const eigen = getMaterial(item.materialId).name;
  if (!item.composition || item.composition.length === 0) return eigen;
  let groesster = item.composition[0];
  let summe = 0;
  for (const c of item.composition) {
    summe += c.massKg;
    if (c.massKg > groesster.massKg) groesster = c;
  }
  if (groesster.materialId === item.materialId || summe <= 0) return eigen;
  const anteil = Math.round((groesster.massKg / summe) * 100);
  return `${eigen} · ${anteil} % ${getMaterial(groesster.materialId).name}`;
}

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
    // Der Name zuerst: Man greift einen Kuehlschrank, nicht "Stahlschrott".
    const name = item.shape?.name;
    const kopf = name ? `${name} · ${hauptMaterial(item)}` : hauptMaterial(item);
    this.gripEl.textContent =
      `▼ ${kopf} · ${masseText(item.massKg)} · ${preisProTonne(mat)} ${euroIndicator(mat)}`;
  }

  /**
   * Griff-Info beim Tragen: Ladungsliste + Ampel.
   *
   * Grosse Stuecke werden beim Namen genannt, kleine nach Fraktion
   * zusammengefasst (Wunsch 12.09.2026: „evtl. Listenbeschreibung einbauen, was
   * in Spinne liegt, zumindest fuer grosse Teile"). Sonst stuende bei einer
   * vollen Spinne eine Zeile aus zwoelf Namen da, die niemand liest.
   */
  showCarry(items: ScrapItem[], hover: { container: string; ampel: AmpelState } | null): void {
    const byMat = new Map<string, number>();
    const gross: string[] = [];
    let total = 0;
    for (const it of items) {
      total += it.massKg;
      const name = it.shape?.name;
      if (name && it.massKg >= GROSS_AB_KG && gross.length < GROSS_MAX) {
        gross.push(name);
        continue;
      }
      byMat.set(it.materialId, (byMat.get(it.materialId) ?? 0) + 1);
    }
    const parts = [
      ...gross,
      ...[...byMat.entries()].map(([id, n]) => `${n}× ${getMaterial(id).name}`),
    ];
    const gezeigt = parts.slice(0, GROSS_MAX + 2);
    if (parts.length > gezeigt.length) gezeigt.push(`+${parts.length - gezeigt.length} weitere`);
    let text = `Greifer: ${gezeigt.join(", ")} · ${masseText(total)}`;
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
    el.textContent = `${ziel}: ${masseText(kg)} · ${balken} ${p} % sortenrein`;
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
