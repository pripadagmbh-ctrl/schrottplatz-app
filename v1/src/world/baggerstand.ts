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
 * die Seite hat wieder gewechselt: Seit E-028 steht der Westschenkel der
 * Silo-Reihe auf x −36,0, seine Vorderkante liegt auf x −33,0. Der Bagger
 * steht 7,5 m davor auf −25,5, die LKW-Spur noch einmal 7,5 m weiter auf
 * −18,0.
 *
 * z −8,0: die Mitte des zweiten Silos von Norden (KABEL-LAGER). Der Punkt ist
 * gerechnet, nicht gewaehlt: Bei 7,5 m Seitenabstand reicht der Arm in z noch
 * sqrt(9,20² − 7,50²) = 5,33 m weit, also genau ueber einen Achsabstand von
 * 4,60 m hinweg. Von hier sind drei Silos zu erreichen (8,80 · 7,50 · 8,80 m);
 * jeder andere Halt auf der Reihe erreicht hoechstens zwei. Vier auf einmal
 * ginge nicht — dafuer muesste der Arm 13,8 m ueberspannen.
 *
 * Vom Hauptstandplatz sind es hypot(25,0 | 14,5) = 28,9 m (vorher 28,1 m).
 */
export const VERLADE_STAND: Stand = { x: -25.5, z: -8.0 };

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
