/**
 * Der Betrieb auf dem Platz (Briefing Kap. 21, Fassung 29.08.2026).
 *
 * Früher machte die Einfahrt zu, sobald genug Material dalag, und es gab eine
 * Sortierpause. Das hat den Platz leergespielt und war am Ende zäh. Jetzt
 * läuft der Umschlag durch: Es kommt immer Material nach, und woran man sich
 * misst, ist der Durchsatz — wie viele Tonnen an einem Tag über den Platz
 * gehen.
 *
 * Gesteuert wird nur noch die Dichte des Verkehrs. Ist der Platz voll,
 * kommen die Fuhren etwas seltener, aber sie hören nie ganz auf. Erst wenn
 * gar nichts mehr geht, macht die Einfahrt kurz zu — als Sicherheitsventil
 * gegen einen Platz, der sich selbst zustellt.
 */

/** Ab hier gilt der Platz als gut gefüllt — der Verkehr wird etwas ruhiger. */
export const BUSY_KG = 6000;
/** Ab hier ist dicht: die Einfahrt macht zu, bis wieder Luft ist. */
export const JAM_KG = 16000;
/** Darunter läuft der Verkehr wieder normal an. */
export const JAM_CLEAR_KG = 11000;

export class Shift {
  /** Sekunden seit Beginn */
  t = 0;
  /** Heute abgefahrenes Material in kg — die eigentliche Wertung */
  turnoverKg = 0;
  /** abgeschlossene Abholungen */
  pickups = 0;
  /** Anlieferungen insgesamt */
  deliveries = 0;
  /** true, solange der Platz zugestellt ist */
  jammed = false;

  update(dt: number, looseKg: number): void {
    this.t += dt;
    // Hysterese, damit die Einfahrt nicht im Sekundentakt auf und zu geht
    if (this.jammed) {
      if (looseKg < JAM_CLEAR_KG) this.jammed = false;
    } else if (looseKg > JAM_KG) {
      this.jammed = true;
    }
  }

  /** Kommen gerade Anlieferer? */
  get acceptsDeliveries(): boolean {
    return !this.jammed;
  }

  /**
   * Faktor auf die Wartezeit zwischen zwei Fuhren. Auf einem leeren Platz
   * drängeln sie sich, auf einem vollen lassen sie etwas Luft — aber sie
   * kommen weiter.
   */
  intervalFactor(looseKg: number): number {
    if (looseKg <= 0) return 0.6;
    const f = 0.6 + (looseKg / BUSY_KG) * 0.9;
    return Math.min(f, 2.2);
  }

  /** Abgefahrene Ladung verbuchen. */
  noteTurnover(massKg: number): void {
    this.turnoverKg += massKg;
    this.pickups++;
  }

  /** Kurztext fürs HUD. */
  statusText(looseKg: number): string {
    const t = (this.turnoverKg / 1000).toFixed(1);
    if (this.jammed) return `Platz dicht · ${t} t umgeschlagen · erst räumen!`;
    return `${t} t umgeschlagen · ${Math.round(looseKg)} kg liegen`;
  }

  toJSON(): { t: number; turnoverKg: number; pickups: number; deliveries: number } {
    return {
      t: this.t,
      turnoverKg: this.turnoverKg,
      pickups: this.pickups,
      deliveries: this.deliveries,
    };
  }

  load(
    d: { t?: number; turnoverKg?: number; pickups?: number; deliveries?: number } | undefined
  ): void {
    if (!d) return;
    this.t = d.t ?? 0;
    this.turnoverKg = d.turnoverKg ?? 0;
    this.pickups = d.pickups ?? 0;
    this.deliveries = d.deliveries ?? 0;
  }
}
