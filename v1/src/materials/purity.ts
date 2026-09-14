import type { MaterialClass } from "./catalog";

/**
 * Reinheits- und Erlösrechnung (Briefing Kap. 7) — reine Funktionen, Vitest-geprüft.
 */

/** Reinheit = 1 − Fremdmasse/Gesamtmasse, geklemmt auf [0, 1]. Leerer Container = 1. */
export function computePurity(contentKg: number, contaminationKg: number): number {
  if (contentKg <= 0) return 1;
  return Math.min(Math.max(1 - contaminationKg / contentKg, 0), 1);
}

/**
 * Prognostizierter Erlös eines Containers:
 * Wert = Inhalt × Verkaufspreis × Reinheit².
 * Entsorgungsfraktionen (negativer Preis) kosten unabhängig von der Reinheit.
 */
export function containerValue(
  fraction: MaterialClass,
  contentKg: number,
  contaminationKg: number
): number {
  if (contentKg <= 0) return 0;
  if (fraction.sellPricePerKg < 0) return contentKg * fraction.sellPricePerKg;
  const purity = computePurity(contentKg, contaminationKg);
  return contentKg * fraction.sellPricePerKg * purity * purity;
}

/**
 * Preis als Zahl, die im Handel benutzt wird: **Euro je Tonne**.
 *
 * Intern rechnet alles in Euro je Kilogramm, weil die Massen der Teile in
 * Kilogramm stehen. Nach aussen ist das die falsche Einheit: Schrott wird in
 * Tonnen gehandelt, und „0,25 €/kg" liest niemand, der mit dem Zeug zu tun hat
 * (Ansage 12.09.2026: „bitte mache Angaben immer pro Tonne").
 */
export function preisProTonne(mat: MaterialClass): string {
  const t = Math.round(mat.sellPricePerKg * 1000);
  return t < 0 ? `${t} €/t` : `${t} €/t`;
}

/** Masse lesbar: unter einer Tonne in Kilogramm, darüber in Tonnen. */
export function masseText(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)} t` : `${Math.round(kg)} kg`;
}

/** €-Indikator fürs Griff-Info-HUD (Briefing Kap. 14): 1–4 €-Symbole bzw. „Gebühr". */
export function euroIndicator(mat: MaterialClass): string {
  if (mat.sellPricePerKg <= 0) return "Gebühr";
  const n = mat.sellPricePerKg >= 5 ? 4 : mat.sellPricePerKg >= 2 ? 3 : mat.sellPricePerKg >= 1 ? 2 : 1;
  return "€".repeat(n);
}

/**
 * Ab diesem Anteil gilt ein Gemisch noch als sortenrein.
 *
 * Ein Objekt aus Verbundteilen ist nie sortenrein — es sei denn, das Fremde
 * faellt nicht ins Gewicht (Ansage 12.09.2026). Eine Baggerschaufel mit
 * Gumminoppen ist Stahlschrott, weil der Gummi ein paar Prozent ausmacht. Ein
 * Kuehlschrank ist es nicht: Blech, Alu, Kupfer, Styropor und Kunststoff
 * zusammen ergeben Mischschrott, solange sie niemand trennt.
 *
 * Derselbe Wert gilt fuer Presspakete — was zusammen in die Kammer geht, kommt
 * nach derselben Regel heraus.
 */
export const SORTENREIN_AB = 0.95;

/** Ein Stoffanteil an einem Objekt. */
export interface Anteil {
  materialId: string;
  /** Anteil an der Gesamtmasse, 0..1 */
  anteil: number;
}

/**
 * Welche Fraktion ein Objekt ist: die vorwiegende, wenn sie deutlich
 * ueberwiegt — sonst Mischschrott.
 */
export function fraktionAus(zusammensetzung: Anteil[], vorgabe = "steel"): string {
  if (zusammensetzung.length === 0) return vorgabe;
  let groesster = zusammensetzung[0];
  for (const a of zusammensetzung) if (a.anteil > groesster.anteil) groesster = a;
  return groesster.anteil >= SORTENREIN_AB ? groesster.materialId : "mixed";
}

/**
 * Laesst sich das Ding pressen?
 *
 * Ansage 12.09.2026: "Stahlschrott wie starre und massive Traeger sollte von
 * der Presse unberuehrt bleiben, wohingegen Kuehlschraenke, Waschmaschinen,
 * Kabinen mit viel Hohlraum zusammengepresst werden koennen."
 *
 * Das braucht kein neues Feld — es steht schon in Masse und Massen. Die Dichte
 * ueber die Huellmasse trennt hohl von massiv sauber: Ein Kuehlschrank kommt
 * auf 90 kg je Kubikmeter, eine Traktorkabine auf 78, ein Seecontainer auf 73;
 * ein Motorblock auf 452, ein Doppel-T-Traeger auf 790. Dazu die Ausnahme fuer
 * Duennes: Ein Blech ist nach Huellmass dicht wie Blei und laesst sich
 * trotzdem falten.
 */
export const HOHL_KG_JE_M3 = 260;
export const DUENN_M = 0.12;

export function istPressbar(massKg: number, dims: number[]): boolean {
  const [a, b, c] = dims;
  const volumen = Math.max((a ?? 1) * (b ?? 1) * (c ?? 1), 1e-4);
  if (Math.min(a ?? 1, b ?? 1, c ?? 1) < DUENN_M) return true;
  return massKg / volumen < HOHL_KG_JE_M3;
}
