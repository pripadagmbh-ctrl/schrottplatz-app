/**
 * Ausbau des Platzes (Briefing Kap. 25.2).
 *
 * Verdientes Geld hatte bis hierhin keine Verwendung — der Kontostand war
 * eine Zahl ohne Folgen. Mit den Upgrades bekommt der Umschlag ein Ziel:
 * Jede gekaufte Maschine nimmt einem Arbeit ab oder bringt mehr Erlös.
 *
 * Das Be- und Entladen soll den Spaß tragen; die Upgrades sind das
 * Sahnehäubchen, nicht der Antrieb.
 */

export type UpgradeId =
  | "loader"
  | "dozer"
  | "forklift"
  | "magnet"
  | "boom"
  | "press";

export interface Upgrade {
  id: UpgradeId;
  name: string;
  /** Was es im Spiel bewirkt — erscheint im Kaufmenü */
  effect: string;
  priceEur: number;
  /** Erst kaufbar, wenn so viel umgeschlagen wurde (kg) */
  requiresTurnoverKg: number;
}

/**
 * Reihenfolge ist Fortschritt: Jede Stufe ist teurer als die davor und wird
 * erst ab mehr Umschlag angeboten. Wer nur den nächsten Eintrag kauft, kommt
 * damit sinnvoll voran.
 */
export const UPGRADES: Upgrade[] = [
  {
    id: "loader",
    name: "Radlader",
    effect: "Lambert fährt statt zu laufen und räumt auch schwere Brocken von der Fahrspur",
    priceEur: 12000,
    requiresTurnoverKg: 0,
  },
  {
    id: "dozer",
    name: "Bulldozer",
    effect: "Lambert schiebt losen Schrott zusammen und kehrt den Platz",
    priceEur: 18000,
    requiresTurnoverKg: 30000,
  },
  {
    id: "forklift",
    name: "Stapler",
    effect: "Lambert stapelt Karossen und räumt Kleinteile schneller",
    priceEur: 22000,
    requiresTurnoverKg: 60000,
  },
  {
    id: "magnet",
    name: "Magnet",
    effect: "Stahl lässt sich sauber vom Rest trennen — höhere Sortenreinheit",
    priceEur: 26000,
    requiresTurnoverKg: 90000,
  },
  {
    id: "boom",
    name: "Baggerausbau",
    effect: "Schnellere Hydraulik und mehr Traglast",
    priceEur: 34000,
    requiresTurnoverKg: 120000,
  },
  {
    id: "press",
    name: "Größere Presse",
    effect: "Schwerere Pakete, mehr Ladung je Abholung",
    priceEur: 42000,
    requiresTurnoverKg: 160000,
  },
];

export function getUpgrade(id: UpgradeId): Upgrade {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) throw new Error(`Unbekanntes Upgrade: ${id}`);
  return u;
}

export class UpgradeState {
  private owned = new Set<UpgradeId>();

  has(id: UpgradeId): boolean {
    return this.owned.has(id);
  }

  /** Ist es freigeschaltet? Erst ab genügend Umschlag bietet es der Händler an. */
  available(id: UpgradeId, turnoverKg: number): boolean {
    return !this.has(id) && turnoverKg >= getUpgrade(id).requiresTurnoverKg;
  }

  /** Kaufbar heißt: freigeschaltet und bezahlbar. */
  affordable(id: UpgradeId, turnoverKg: number, moneyEur: number): boolean {
    return this.available(id, turnoverKg) && moneyEur >= getUpgrade(id).priceEur;
  }

  buy(id: UpgradeId): void {
    this.owned.add(id);
  }

  toJSON(): UpgradeId[] {
    return [...this.owned];
  }

  load(d: string[] | undefined): void {
    if (!d) return;
    for (const id of d) {
      if (UPGRADES.some((u) => u.id === id)) this.owned.add(id as UpgradeId);
    }
  }
}
