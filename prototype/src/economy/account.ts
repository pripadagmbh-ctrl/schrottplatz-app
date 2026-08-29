import { getMaterial } from "../materials/catalog";
import type { ItemManager, ScrapItem } from "../world/scrapItems";
import type { CompositeManager } from "../dismantle/composites";

/**
 * Wirtschaft (Design 2026-08-29, Briefing Kap. 9/10):
 * 1. ANKAUF — Anlieferer werden voll und leer gewogen; für die Nettomenge
 *    bekommt der Kunde Geld (Ausgabe des Spielers).
 * 2. SORTIERPRÄMIE — jedes korrekt einsortierte Teil bringt sofort etwas Geld.
 * 3. VERKAUF — der Abhol-LKW nimmt den beladenen Container mit; bezahlt wird
 *    nach Materialwert × Sortenreinheit² (sortenrein lohnt sich deutlich).
 * Alle Preise sind Startwerte (SW).
 */

/** Mischpreis, den der Anlieferer je kg bekommt */
export const PURCHASE_PRICE_PER_KG = 0.16;
/** Sofortprämie fürs korrekte Einsortieren je kg */
export const SORTING_BONUS_PER_KG = 0.05;

export interface SaleResult {
  eur: number;
  massKg: number;
  purity: number;
  dominant: string;
}

export class Account {
  moneyEur = 5000; // Startkapital (SW)
  /** Statistik für HUD/Bilanz */
  purchasedKg = 0;
  sortedKg = 0;

  /** Ankauf nach der Ausfahrtswiegung: Kunde erhält Geld. */
  payDelivery(netKg: number): number {
    const eur = netKg * PURCHASE_PRICE_PER_KG;
    this.moneyEur -= eur;
    this.purchasedKg += netKg;
    return eur;
  }

  /** Sofortprämie fürs Sortieren. */
  paySortingBonus(massKg: number): number {
    const eur = massKg * SORTING_BONUS_PER_KG;
    this.moneyEur += eur;
    this.sortedKg += massKg;
    return eur;
  }

  /**
   * Containerinhalt verkaufen: Wert nach dominanter Fraktion, gedämpft mit
   * Sortenreinheit² — eine sortenreine Ladung bringt ein Vielfaches.
   */
  sellContainer(
    loaded: ScrapItem[],
    items: ItemManager,
    composites: CompositeManager
  ): SaleResult {
    if (loaded.length === 0) return { eur: 0, massKg: 0, purity: 1, dominant: "" };
    const massByMaterial = new Map<string, number>();
    let totalKg = 0;
    for (const it of loaded) {
      massByMaterial.set(it.materialId, (massByMaterial.get(it.materialId) ?? 0) + it.massKg);
      totalKg += it.massKg;
    }
    let dominant = "";
    let dominantKg = 0;
    for (const [id, kg] of massByMaterial) {
      if (kg > dominantKg) {
        dominantKg = kg;
        dominant = id;
      }
    }
    const purity = dominantKg / totalKg;
    const price = getMaterial(dominant).sellPricePerKg;
    const eur = totalKg * price * purity * purity;
    this.moneyEur += eur;

    for (const it of loaded) {
      const wasCar = composites.despawnByBody(it.body);
      items.remove(it, !wasCar);
    }
    return { eur, massKg: totalKg, purity, dominant };
  }
}
