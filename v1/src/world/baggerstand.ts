/**
 * Wo der Bagger steht und wie weit er von dort greift.
 *
 * Diese Zahlen standen bisher an drei Stellen abgeschrieben: in
 * `excavator.ts` als Startpose, in `test/collision.test.ts` und in
 * `test/reach.test.ts` je als Konstante „siehe position in excavator.ts". Beim
 * Platzumbau nach E-010 wandert der Standplatz — und abgeschriebene Zahlen
 * wandern nicht mit. Deshalb steht er hier einmal, und alles rechnet dagegen.
 *
 * Quelle der Werte: `tools/platzkonzept.mjs` (der Plan zu E-010, gezeichnet am
 * 14.09.2026) — dort `BAGGER`, `V` und `R_INNEN`/`R_AUSSEN`.
 */

/** Ein Standplatz der Maschine. */
export interface Stand {
  x: number;
  z: number;
}

/**
 * Der Hauptstandplatz: vor der Ausbuchtung, mit Blick nach Norden.
 *
 * Er ist bewusst der Torwächter der Ausbuchtung — hinter ihm liegen die
 * beiden Halden, und kein Fahrzeug fährt daran vorbei (E-010, E-011:
 * „Großteile und Mischschrott — immer beim Bagger").
 */
export const BAGGER_STAND: Stand = { x: -0.5, z: -22.5 };

/**
 * Der zweite Standplatz: der Verladeplatz zwischen Silo-Reihe und LKW-Spur.
 *
 * Von hier raeumt der Spieler aus den Silos in den Container des Abholers.
 * 7,5 m nach beiden Seiten — die Eigenschaft ist dieselbe wie seit E-010, nur
 * die Seite hat gewechselt: Seit dem 15.09.2026 steht die Silo-Reihe an der
 * Wand bei x +10,5, ihre Vorderkante liegt auf x +3,5. Der Bagger steht 7,5 m
 * davor auf −4,0, die LKW-Spur noch einmal 7,5 m weiter auf −11,5.
 *
 * z +5,4: die Mitte des fuenften Silos von Norden (KUPFER-LAGER) — dorthin
 * geht die meiste Fuhre, und der Halt liegt weit genug suedlich, dass der
 * Abholer Janines Kaffeewagen nicht beruehrt. Gemessen: Seine Standflaeche
 * reicht 4,90 m nach vorn und 3,14 m nach hinten; von Sueden angesetzt endet
 * er auf z +10,3, der Kaffeewagen beginnt auf +14,1 — 3,8 m Luft.
 *
 * Vom Hauptstandplatz sind es hypot(3,5 | 27,9) = 28,1 m (vorher 27,1 m).
 */
export const VERLADE_STAND: Stand = { x: -4.0, z: 5.4 };

/**
 * Das Schwenkband: näher als `SCHWENK_INNEN` bekommt der Arm den Ausleger
 * nicht mehr eng genug zusammen, weiter als `SCHWENK_AUSSEN` reicht er nicht.
 *
 * Beide Zahlen sind gemessen, nicht gegriffen (E-010: „Der Bagger hat nicht
 * nur eine äußere Grenze, sondern auch eine innere: Unter rund 5,8 m bekommt
 * er den Arm nicht mehr eng genug zusammen").
 */
export const SCHWENK_INNEN = 5.8;
export const SCHWENK_AUSSEN = 9.2;

/** Abstand eines Punktes zum Standplatz. */
export function abstandVomStand(x: number, z: number, stand: Stand = BAGGER_STAND): number {
  return Math.hypot(x - stand.x, z - stand.z);
}

/** Liegt der Punkt im Schwenkband? */
export function imSchwenkband(x: number, z: number, stand: Stand = BAGGER_STAND): boolean {
  const d = abstandVomStand(x, z, stand);
  return d >= SCHWENK_INNEN && d <= SCHWENK_AUSSEN;
}
