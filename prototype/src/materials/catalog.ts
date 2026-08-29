/**
 * Materialkatalog — die 6 MVP-Materialklassen (Briefing Kap. 7).
 * Preise in €/kg, alle Werte Startwerte (SW). Negativer Verkaufspreis = Entsorgungskosten.
 * i18n kommt in V1; M1 ist deutschsprachig.
 */
export interface MaterialClass {
  id: string;
  name: string;
  buyPricePerKg: number;
  sellPricePerKg: number;
  /** Farbleitsystem Kap. 16 */
  color: number;
}

/**
 * Fraktionen (Stand 2026-08-29): Guss läuft mit im Stahlschrott, dafür gibt es
 * eine eigene Mulde für Edelstahl (VA). Messing wird zusammen mit Kupfer
 * gesammelt — beide gehen an denselben Abnehmer.
 */
export const MATERIALS: Record<string, MaterialClass> = {
  steel: { id: "steel", name: "Stahlschrott", buyPricePerKg: 0.18, sellPricePerKg: 0.25, color: 0x6e5a4e },
  va: { id: "va", name: "Edelstahl VA", buyPricePerKg: 1.0, sellPricePerKg: 1.4, color: 0xdfe6ea },
  alu: { id: "alu", name: "Aluminium", buyPricePerKg: 1.1, sellPricePerKg: 1.5, color: 0xc4c8cc },
  copper: { id: "copper", name: "Kupfer/Messing", buyPricePerKg: 6.0, sellPricePerKg: 7.2, color: 0xc7622b },
  cable: { id: "cable", name: "Kabel", buyPricePerKg: 1.6, sellPricePerKg: 2.2, color: 0xb0682a },
  contaminant: { id: "contaminant", name: "Störstoff", buyPricePerKg: 0, sellPricePerKg: -0.08, color: 0x7a6a52 },
};

/** Alte Fraktionen aus früheren Spielständen auf die aktuellen abbilden. */
const ALIASES: Record<string, string> = { cast: "steel", brass: "copper" };

export function getMaterial(id: string): MaterialClass {
  const m = MATERIALS[id] ?? MATERIALS[ALIASES[id] ?? ""];
  if (!m) throw new Error(`Unbekannte Materialklasse: ${id}`);
  return m;
}

/** Kanonische Fraktions-ID (für Save-Migration und Zonen-Zuordnung). */
export function normalizeMaterialId(id: string): string {
  return MATERIALS[id] ? id : (ALIASES[id] ?? "steel");
}
