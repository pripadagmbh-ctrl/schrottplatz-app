/**
 * Der Tagesablauf auf dem Platz (Briefing Kap. 21).
 *
 * Das Spiel wechselt zwischen zwei Phasen:
 *
 *   ANNAHME    LKW kommen, werden gewogen und laden auf dem Sammelplatz ab.
 *              Sortiert wird hier nicht — der Schrott darf erst mal fallen,
 *              wo er fällt. Bezahlt wird nach Gewicht bei der Ausfahrt.
 *
 *   SORTIEREN  Ist genug Material da, macht die Einfahrt zu: kein LKW mehr,
 *              Ruhe zum Aufräumen. Jetzt wird auf die Haufen und in die Boxen
 *              geworfen, gepresst und die Abholung gerufen.
 *
 * Zurück in die Annahme geht es, sobald der Platz wieder frei ist — oder wenn
 * die Sortierzeit abgelaufen ist. So entsteht der Rhythmus aus vollem Platz
 * und dem befriedigenden Leerräumen.
 */

/** Ab dieser losen Menge auf dem Platz endet die Annahme. */
export const SORT_START_KG = 4500;
/** Darunter gilt der Platz als aufgeräumt — die Einfahrt macht wieder auf. */
export const SORT_DONE_KG = 1200;
/** Ruhe zum Sortieren, auch wenn nicht alles weggeräumt wird. */
export const SORT_MAX_S = 600;
/** Nach so vielen Anlieferungen ist ebenfalls Schluss, selbst bei leichtem Schrott. */
export const SORT_AFTER_DELIVERIES = 5;

export type ShiftPhase = "annahme" | "sortieren";

export class Shift {
  phase: ShiftPhase = "annahme";
  /** Sekunden in der laufenden Phase */
  t = 0;
  /** abgeschlossene Sortierphasen — Grundlage für Abholung und Fortschritt */
  cycle = 0;
  /** Anlieferungen seit Beginn der aktuellen Annahme */
  deliveriesThisShift = 0;
  /** wird true, wenn die Phase in diesem Frame gewechselt hat */
  private justChanged: ShiftPhase | null = null;

  /**
   * @param looseKg lose auf dem Platz liegender Schrott (nicht in Boxen)
   */
  update(dt: number, looseKg: number): void {
    this.t += dt;
    if (this.phase === "annahme") {
      const voll = looseKg >= SORT_START_KG;
      const genugFuhren = this.deliveriesThisShift >= SORT_AFTER_DELIVERIES;
      if (voll || genugFuhren) this.switchTo("sortieren");
      return;
    }
    // Sortierphase: fertig, wenn aufgeräumt ist oder die Zeit abläuft
    if (looseKg <= SORT_DONE_KG || this.t >= SORT_MAX_S) {
      this.cycle++;
      this.deliveriesThisShift = 0;
      this.switchTo("annahme");
    }
  }

  private switchTo(p: ShiftPhase): void {
    this.phase = p;
    this.t = 0;
    this.justChanged = p;
  }

  /** true (einmalig), wenn gerade in diese Phase gewechselt wurde. */
  consumeChange(): ShiftPhase | null {
    const c = this.justChanged;
    this.justChanged = null;
    return c;
  }

  /** Dürfen gerade Anlieferer kommen? */
  get acceptsDeliveries(): boolean {
    return this.phase === "annahme";
  }

  /** Restliche Sortierzeit in Sekunden (0 in der Annahme). */
  get remainingS(): number {
    return this.phase === "sortieren" ? Math.max(0, SORT_MAX_S - this.t) : 0;
  }

  /** Kurztext für das HUD. */
  statusText(looseKg: number): string {
    if (this.phase === "annahme") {
      const rest = Math.max(0, SORT_START_KG - looseKg);
      return `Annahme · noch ${Math.round(rest)} kg bis Feierabend`;
    }
    const m = Math.floor(this.remainingS / 60);
    const s = Math.floor(this.remainingS % 60);
    return `Sortieren · ${m}:${String(s).padStart(2, "0")} · ${Math.round(looseKg)} kg liegen`;
  }

  toJSON(): { phase: ShiftPhase; t: number; cycle: number; deliveries: number } {
    return { phase: this.phase, t: this.t, cycle: this.cycle, deliveries: this.deliveriesThisShift };
  }

  load(d: { phase?: string; t?: number; cycle?: number; deliveries?: number } | undefined): void {
    if (!d) return;
    this.phase = d.phase === "sortieren" ? "sortieren" : "annahme";
    this.t = d.t ?? 0;
    this.cycle = d.cycle ?? 0;
    this.deliveriesThisShift = d.deliveries ?? 0;
  }
}
