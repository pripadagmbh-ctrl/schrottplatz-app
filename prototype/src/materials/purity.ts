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

/** €-Indikator fürs Griff-Info-HUD (Briefing Kap. 14): 1–4 €-Symbole bzw. „Gebühr". */
export function euroIndicator(mat: MaterialClass): string {
  if (mat.sellPricePerKg <= 0) return "Gebühr";
  const n = mat.sellPricePerKg >= 5 ? 4 : mat.sellPricePerKg >= 2 ? 3 : mat.sellPricePerKg >= 1 ? 2 : 1;
  return "€".repeat(n);
}
