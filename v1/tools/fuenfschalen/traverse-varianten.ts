/**
 * Die drei Traversen des Blattes vom 15.09.2026 — eine einzige Quelle.
 *
 * Blatt (`docs/f5-traverse-2026-09-15.svg`), Messung (`traverse-korb.ts`) und
 * Waechter (`test/traverse.test.ts`) lesen dieselben Zahlen hier. Wer eine
 * Variante aendert, aendert sie an einer Stelle.
 *
 * WOHER DIE ZAHLEN KOMMEN. `traverse.ts` rastert je Durchmesser alle
 * Anlenkungen ab, die den Vertrag aus `anlenkung.ts` halten (faehrt zum
 * Schliessen aus, Hub >= 0,15 m, kuerzeste Laenge ueber dem Rohr + 2 cm,
 * laengste <= 1,05 m, Hebelarm geschlossen > 0,20 m). Aus denen wird nach
 * EINER Regel fuer alle drei ausgewaehlt:
 *
 *   flachster Zylinder unter allen mit Hebelarm ueber dem E-009-Ziel 0,10 m;
 *   unter den gleich flachen (±0,1°) der staerkste Hebel.
 *
 * Variante A ist davon ausgenommen: Sie ist der GEBAUTE Stand, nicht das
 * Beste, was Ø 0,70 hergibt. Was Ø 0,70 nachgestellt hergibt, steht als
 * `A_NACHGESTELLT` daneben — es gehoert als Fussnote aufs Blatt, damit
 * niemand den Gewinn der dickeren Traverse dem Durchmesser allein zuschreibt.
 */
import { TRAVERSE_Y } from "../../src/fuenfschalen/teile";

export interface Variante {
  name: string;
  kurz: string;
  durchmesser: number;
  Zr: number;
  Zy: number;
  Ay: number;
  Az: number;
  /** Wofuer sie steht, in einer Zeile fuers Blatt. */
  ruf: string;
  /**
   * Wie der Kopf wirkt — ein Wort, damit das Blatt die Formfrage stellt und
   * nicht nur Kennwerte zeigt. Gemessen ist der Anteil an der geschlossenen
   * Korbweite (2,19 m): 32 %, 43 %, 50 %.
   */
  aussehen: string;
}

/**
 * Wohin die Traverse rueckt, wenn die Zylinderaufnahme steigt.
 *
 * Die Aufnahme sitzt als Gabel AM Bauteil: Ihr Fuss greift 9 cm in den Flansch
 * (`TRAVERSE_Y`-Kommentar in `teile.ts`). Steigt die Aufnahme, muss die
 * Traverse um denselben Betrag mit — sonst schweben die fuenf Gabeln neben
 * dem Koerper, an dem sie angeschweisst sein sollen. Genau dieser Fehler stand
 * am 14.09. im Code (Aufnahme −0,80, Gabel gezeichnet bei −1,14).
 *
 * Gerechnet wird gegen `GEBAUT.Zy`, nicht gegen `ZYLINDER_AUFNAHME.y`: Das
 * Messwerkzeug setzt diesen Wert vor jedem Bau um, ein Bezug darauf waere von
 * der Aufrufreihenfolge abhaengig. `TRAVERSE_Y` dagegen ist eine Konstante und
 * beschreibt die Einbauhoehe der gebauten Variante — beide Enden des Bezugs
 * gehoeren also zusammen und wandern gemeinsam.
 */
export function traverseHoehe(Zy: number): number {
  return TRAVERSE_Y + (Zy - GEBAUT.Zy);
}

/**
 * A — der Stand bis E-039. Ø 0,70 × 0,45 nach Positionsliste (E-009).
 *
 * Bis zum 15.09.2026 war das der gebaute Greifer; seitdem ist es `B`. A bleibt
 * hier stehen, weil das Blatt vom 15.09.2026 drei Spalten hat und die erste
 * zeigt, wogegen entschieden wurde.
 */
export const A: Variante = {
  name: "A  Ø 0,70",
  kurz: "A",
  durchmesser: 0.7,
  Zr: 0.34,
  Zy: -0.73,
  Ay: 0,
  Az: 0.31,
  ruf: "der Stand bis E-039",
  aussehen: "schlank",
};

/** Was Ø 0,70 hergaebe, wenn nur die Anlenkung nachgestellt wird. Fussnote. */
export const A_NACHGESTELLT: Variante = {
  name: "A* Ø 0,70 nachgestellt",
  kurz: "A*",
  durchmesser: 0.7,
  Zr: 0.34,
  Zy: -0.655,
  Ay: -0.04,
  Az: 0.25,
  ruf: "gleiche Traverse, beste Anlenkung",
  aussehen: "schlank",
};

/**
 * B — Ø 0,95, seit E-039 der GEBAUTE Stand.
 *
 * Der kleinste Durchmesser, dessen flachster Arbeitspunkt noch denselben
 * Hebelarm traegt wie die Ø-1,10-Loesung (0,1179 m). Ø 0,90 kommt dort nur auf
 * 0,1003 m — es steht auf dem Ziel, nicht darueber. Ø 0,95 kauft damit rund
 * drei Viertel des Neigungsgewinns fuer knapp zwei Drittel des Zuwachses.
 *
 * Patrick hat am 15.09.2026 am Blatt entschieden. Seitdem stehen diese vier
 * Zahlen auch in `src/fuenfschalen/teile.ts`; der Waechter
 * „beschreibt mit Variante B genau den gebauten Stand" haelt beide Stellen
 * zusammen.
 */
export const B: Variante = {
  name: "B  Ø 0,95",
  kurz: "B",
  durchmesser: 0.95,
  Zr: 0.465,
  Zy: -0.635,
  Ay: -0.08,
  Az: 0.245,
  ruf: "wie heute gebaut",
  aussehen: "kräftig",
};

/**
 * Welche Variante GEBAUT ist — die einzige Stelle, an der das steht.
 *
 * `traverseHoehe` und die Waechter haengen daran. Wird der Greifer je wieder
 * umgebaut, wandert diese eine Zeile mit, und alles andere folgt.
 */
export const GEBAUT: Variante = B;

/** C — der Vorschlag aus E-009. Kleinste Traverse, die BEIDE Ziele haelt. */
export const C: Variante = {
  name: "C  Ø 1,10",
  kurz: "C",
  durchmesser: 1.1,
  Zr: 0.54,
  Zy: -0.625,
  Ay: -0.1,
  Az: 0.24,
  ruf: "beide Ziele erreicht",
  aussehen: "wuchtig",
};

export const VARIANTEN: Variante[] = [A, B, C];
