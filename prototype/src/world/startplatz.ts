/**
 * Wo am Anfang was liegt.
 *
 * Die Zahlen standen in `main.ts` mitten im Aufbau. Das ging so lange gut, wie
 * der Platz sich nicht bewegte — aber er bewegt sich. Am 13.09.2026 ist die
 * Presse in die Ecke gezogen, und der Starthaufen blieb, wo er war: Er lag
 * danach zur Haelfte in der Presskammer, ein Altfahrzeug mittendrin (Ansage:
 * „achtet darauf, dass kein Schrott am Anfang in der Presse liegt").
 *
 * Hier stehen sie einzeln, damit `test/startplatz.test.ts` sie gegen die
 * Presse und die Boxen rechnen kann. Wer den Platz umbaut, merkt es dann beim
 * Testlauf statt im ersten Bild.
 */

/** Mitte und Streuung des unsortierten Starthaufens (m). */
export const START_HAUFEN = { x: 6.2, z: -19.0, streuung: 2.9, teile: 85 };

/** Die beiden Altfahrzeuge am Rand des Haufens. */
export const START_AUTOS: Array<{ x: number; z: number }> = [
  { x: 3.6, z: -18.0 },
  { x: 8.8, z: -19.0 },
];

/** Streuschrott ringsum: zehn Teile auf einem Kreis um den Haufen. */
export const START_STREU = { x: 6.2, z: -19.0, radius: 3.0, teile: 10 };
