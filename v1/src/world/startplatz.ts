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

/*
 * Nachtrag 14.09.2026 (E-010): Der Haufen ist mit dem Mischschrott in die
 * Ausbuchtung gezogen.
 *
 * Er liegt jetzt an der VORDEREN Kante der Halde (z −29,2), nicht in ihrer
 * Mitte: Man graebt sich von vorn hinein, und die Mitte laege 12,1 m vom Sitz
 * und damit ausserhalb des Schwenkbands. Bei (4,0 | −32,0) mit 2,6 m Streuung
 * reicht der Haufen von z −34,6 bis −29,4 und liegt vollstaendig in der Box
 * (die von −38,2 bis −29,2 geht); sein naechster Rand steht 7,9 m vom Sitz.
 */

/** Mitte und Streuung des unsortierten Starthaufens (m). */
export const START_HAUFEN = { x: 4.0, z: -32.0, streuung: 2.6, teile: 85 };

/**
 * Die beiden Altfahrzeuge am Rand des Haufens.
 *
 * Beide stehen an der vorderen Kante der Mischschrottbox, 4,2 m auseinander —
 * ein Auto ist 1,8 m breit, sie stehen also nebeneinander und nicht
 * ineinander.
 */
export const START_AUTOS: Array<{ x: number; z: number }> = [
  { x: 1.4, z: -30.0 },
  { x: 5.6, z: -30.2 },
];

/** Streuschrott ringsum: zehn Teile auf einem Kreis um den Haufen. */
export const START_STREU = { x: 4.0, z: -32.0, radius: 2.6, teile: 10 };
