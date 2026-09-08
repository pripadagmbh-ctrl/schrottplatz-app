/** €-Indikator fürs Griff-Info-HUD (Briefing Kap. 14; prototype purity.ts:31-35): 1–4 €-Symbole bzw. "fee" (Gebühr). */
export function euroIndicator(sellPricePerKg: number): string {
  if (sellPricePerKg <= 0) return "fee";
  const n = sellPricePerKg >= 5 ? 4 : sellPricePerKg >= 2 ? 3 : sellPricePerKg >= 1 ? 2 : 1;
  return "€".repeat(n);
}
