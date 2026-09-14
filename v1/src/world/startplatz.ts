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

/**
 * Mitte und Streuung des unsortierten Starthaufens (m).
 *
 * Die Streuung von 2,9 m ist die von vor dem Umbau und bleibt es mit Absicht.
 * Beim Umzug in die Ausbuchtung war sie kurz auf 2,3 m verengt, damit der
 * Haufen sicher in die Halde passt — nachgemessen mit `tools/platzlast.ts`
 * (85 Teile, 30 Sekunden Spielzeit) blieben dabei 42 von 56 dynamischen
 * Koerpern wach, bei 2,9 m dagegen keiner. Ein enger getuermter Haufen
 * rutscht laenger in sich zusammen.
 *
 * ACHTUNG, das ist kein Freibrief: Ueber vier Laeufe kommt der Haufen auch
 * mit 2,9 m nur in einem von vier Faellen ganz zur Ruhe. Das ist aber KEINE
 * Folge des Umbaus — auf der alten Stelle (6,2 | −19,0) gemessen, blieb er in
 * drei von drei Laeufen ebenfalls wach. Die Koerper kriechen dabei mit unter
 * 0,05 m/s; es ist ein Einschlaf-Problem des Haufens, kein Platzproblem, und
 * gehoert in ein eigenes Paket.
 */
/*
 * Nachtrag 14.09.2026 abends: von z −33,0 auf −32,0.
 *
 * Die Ausbuchtung ist auf 6,5 m Tiefe verkuerzt, die Mischschrott-Halde
 * reicht damit von z −29,0 bis −35,0. Bei −33,0 haette der Haufen mit seinen
 * 2,9 m Streuung bis −35,9 gereicht und waere hinten an der Buchtwand
 * gelegen; auf −32,0 liegt er mit −34,9 bis −29,1 vollstaendig in der Halde.
 */
export const START_HAUFEN = { x: 4.0, z: -32.0, streuung: 2.9, teile: 85 };

/**
 * Die beiden Altfahrzeuge, je eines an der vorderen Kante einer Halde.
 *
 * Nicht beide in den Mischschrott: Die Halde ist 6,8 m breit, und ihre linke
 * Haelfte liegt 10,4 m vom Sitz — ausserhalb des Schwenkbands. Ein Wrack
 * dort waere ein Wrack, an das man nicht herankommt. So steht eines vor dem
 * Mischschrott (7,9 m) und eines in der noch leeren Stahlhalde (8,7 m), beide
 * im Band, beide 1,5 m von den Trennsteinen weg und keines im Starthaufen
 * (der reicht von z −35,9 bis −30,1).
 */
export const START_AUTOS: Array<{ x: number; z: number }> = [
  { x: 2.4, z: -29.8 },
  { x: -2.2, z: -31.0 },
];

/** Streuschrott ringsum: zehn Teile auf einem Kreis um den Haufen. */
export const START_STREU = { x: 4.0, z: -32.0, radius: 2.9, teile: 10 };
