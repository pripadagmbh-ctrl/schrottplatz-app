import type { CustomerGroup } from "../delivery/customers";

/**
 * Ruf bei den drei Kundengruppen (Briefing Kap. 26.5).
 *
 * Jede Gruppe merkt sich etwas anderes. Privatleute erinnern sich grob, ob
 * man fair war. Händler sind lang und nachtragend. Gewerbebetriebe führen
 * faktisch einen Zuverlässigkeits-Score: Ihnen ist der Preis zweitrangig,
 * entscheidend ist, dass der Ablauf stimmt.
 *
 * Der Ruf steuert, wie oft eine Gruppe anliefert, wie gut ihr Material ist
 * und wie viel Verhandlungsspielraum bleibt — nicht, ob man „gewinnt".
 */

export type ReputationEvent =
  | "fairBezahlt"
  | "hartGedrueckt"
  | "kurzeStandzeit"
  | "langeWartenLassen"
  | "sauberVerwogen";

/** Wie stark ein Ereignis bei welcher Gruppe wirkt. 0 = kümmert sie nicht. */
const WIRKUNG: Record<ReputationEvent, Record<CustomerGroup, number>> = {
  // Faire Preise: Privatleute danken es am meisten, Gewerbe ist es gleich
  fairBezahlt: { privat: 6, haendler: 3, gewerbe: 0 },
  // Hart drücken: Privatleute nehmen es übel, Händler kontern
  hartGedrueckt: { privat: -8, haendler: -4, gewerbe: 0 },
  // Zügig abfertigen: das ist die Währung der Betriebe
  kurzeStandzeit: { privat: 1, haendler: 2, gewerbe: 7 },
  langeWartenLassen: { privat: -2, haendler: -3, gewerbe: -9 },
  // Korrekte Wiegescheine
  sauberVerwogen: { privat: 2, haendler: 0, gewerbe: 5 },
};

/** Ober- und Untergrenze des Rufs */
export const REP_MIN = -100;
export const REP_MAX = 100;

/**
 * Wie träge eine Gruppe vergisst. Händler sind nachtragend, also verblasst
 * ihr Ruf am langsamsten.
 */
const VERGESSEN_PRO_TAG: Record<CustomerGroup, number> = {
  privat: 6,
  haendler: 1.5,
  gewerbe: 3,
};

export class Reputation {
  private werte: Record<CustomerGroup, number> = { privat: 0, haendler: 0, gewerbe: 0 };

  get(group: CustomerGroup): number {
    return this.werte[group];
  }

  /** Ereignis verbuchen — wirkt je nach Gruppe unterschiedlich stark. */
  note(event: ReputationEvent, group?: CustomerGroup): void {
    const w = WIRKUNG[event];
    for (const g of Object.keys(this.werte) as CustomerGroup[]) {
      // Betrifft das Ereignis eine bestimmte Gruppe, wirkt es nur dort voll;
      // die anderen hören es vom Hörensagen und nur abgeschwächt
      const faktor = !group ? 1 : g === group ? 1 : 0.25;
      this.werte[g] = clamp(this.werte[g] + w[g] * faktor);
    }
  }

  /** Ruf verblasst über die Zeit — unterschiedlich schnell je Gruppe. */
  decay(tage: number): void {
    for (const g of Object.keys(this.werte) as CustomerGroup[]) {
      const schritt = VERGESSEN_PRO_TAG[g] * tage;
      const v = this.werte[g];
      this.werte[g] = v > 0 ? Math.max(0, v - schritt) : Math.min(0, v + schritt);
    }
  }

  /**
   * Faktor auf die Anlieferfrequenz dieser Gruppe. Guter Ruf bringt mehr
   * Fuhren, schlechter weniger — aber nie gar keine, sonst spielt sich das
   * Spiel in eine Sackgasse.
   */
  frequencyFactor(group: CustomerGroup): number {
    return 1 + (this.werte[group] / REP_MAX) * 0.6;
  }

  /** Klartext fürs HUD. */
  label(group: CustomerGroup): string {
    const v = this.werte[group];
    if (v > 55) return "bester Ruf";
    if (v > 20) return "gut angesehen";
    if (v > -20) return "neutral";
    if (v > -55) return "verstimmt";
    return "verbrannt";
  }

  toJSON(): Record<CustomerGroup, number> {
    return { ...this.werte };
  }

  load(d: Partial<Record<CustomerGroup, number>> | undefined): void {
    if (!d) return;
    for (const g of Object.keys(this.werte) as CustomerGroup[]) {
      if (typeof d[g] === "number") this.werte[g] = clamp(d[g]);
    }
  }
}

function clamp(v: number): number {
  return Math.max(REP_MIN, Math.min(REP_MAX, v));
}
