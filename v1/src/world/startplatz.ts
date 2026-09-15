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
/**
 * LEERER PLATZ AM ERSTEN TAG.
 *
 * Ansage Patrick, 15.09.2026: „Erster Tag ohne Schrott anfangen als Test."
 *
 * Steht das hier auf `true`, liegt beim Neuen Spiel **kein** Schrott auf dem
 * Platz — kein Haufen, kein Streugut. Alles, was da ist, kommt dann durch
 * Anlieferungen, und man sieht dem Platz an, wie ein Tag gelaufen ist.
 *
 * Es ist ausdruecklich ein Versuch und deshalb EINE Zahl: Wer den vollen
 * Start zurueckwill, setzt `false` und bekommt Haufen und Streugut in den
 * Groessen, die darunter stehen und begruendet sind.
 *
 * Nicht betroffen: die beiden **Altfahrzeuge** (`START_AUTOS`). Sie sind kein
 * loser Schrott, sondern das, woran Schere und Ausschlachten ueberhaupt
 * haengen — ohne sie waere der erste Tag nicht leer, sondern leer UND ohne
 * Beschaeftigung, bis der erste Haendler kommt. Wenn Patrick auch die weg
 * haben will, ist das eine Zeile mehr.
 */
export const LEERER_START = true;

/** Wie viele Teile der Starthaufen haette — null, solange `LEERER_START` gilt. */
const HAUFEN_TEILE = LEERER_START ? 0 : 85;
/** Dasselbe fuer das Streugut ringsum. */
const STREU_TEILE = LEERER_START ? 0 : 10;

export const START_HAUFEN = { x: 4.0, z: -32.0, streuung: 2.9, teile: HAUFEN_TEILE };

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
export const START_STREU = { x: 4.0, z: -32.0, radius: 2.9, teile: STREU_TEILE };

/**
 * Wo der eine Kehrbesen liegt (E-031, neu gerechnet in E-037 und E-049).
 *
 * Entscheidung Patrick: „Es gibt genau einen Besen, und der liegt dauerhaft
 * auf dem Platz." Er wird also gesetzt, nicht angeliefert — und dann muss der
 * Ort begruendet sein, nicht gewaehlt.
 *
 * **Warum er vom alten Fleck (5,0 | −27,0) weg musste — zwei Gruende.**
 *
 * 1. Er ist gewachsen: aus 1,20 x 0,38 m (Trichter) wurde ueber den Ballen
 *    inzwischen eine Rolle von 2,70 x 1,12 m. Der Umkreis stieg von 0,63 auf
 *    **1,46 m**; der alte Fleck war auf ein Viertel dieser Grundflaeche
 *    gerechnet.
 * 2. **Der alte Fleck war schon vorher keiner mehr.** Seit E-029 kippt der
 *    Selbstabkipper nicht mehr auf den Vorplatz, sondern am Abladeplatz ab;
 *    die Fuhre landet auf `ABKIPP_ZONE` = (6,3 | −26,0). Von (5,0 | −27,0)
 *    sind das **1,64 m** — der Besen lag ab dem naechsten Kipper unter der
 *    Fuhre. Gefunden beim Nachrechnen fuer E-037; der Waechter davor hat die
 *    Abkippstelle nicht geprueft.
 *
 * **Gesucht, nicht gegriffen.** Das Schwenkband um den Sitz (−0,5 | −22,5)
 * wird in 0,25-m-Schritten abgesucht und jeder Punkt gegen alles gerechnet,
 * was ihn verbietet: jede Mulde und Halde aus `containers.ts`, die
 * Presskammer, den Starthaufen samt Streuung, die beiden Altfahrzeuge, die
 * Abkippstelle, die Abladespur und die Hindernisliste. Verlangt wird der
 * Umkreis plus 0,5 m Luft. Die Suche steht als Waechter in
 * `test/besen.test.ts` — sie laeuft also bei jedem Testlauf mit, statt einmal
 * gerechnet und dann vergessen zu werden. Uebrig bleiben 275 Punkte, und sie
 * liegen ALLE im selben Gebiet: auf dem Vorplatz vor dem Bagger, zwischen
 * x 0,0 und 6,25 und z −13,5 und −17,5. Anderswo ist kein Platz mehr.
 *
 * Genommen ist **(3,5 | −16,0)**:
 * - **7,63 m vom Sitz** — mitten im Schwenkband 5,8 bis 9,2 m.
 * - **2,82 m Luft** zum Naechsten (der Abladespur samt 1,5 m Tastrand), also
 *   fast der doppelte Umkreis der Rolle.
 * - **4,50 m** zum Muellcontainer auf (−2,8 | −15,4), **10,4 m** zur
 *   Abkippstelle, **13,2 m** zum Starthaufen.
 * - in keiner Mulde und keiner Halde: Er wird nie als sortiertes Material
 *   gezaehlt, und niemand bekommt eine Sortierpraemie fuer seinen eigenen
 *   Besen.
 * - **in einer Arbeitszone** (`WORK_ZONES`, der Kreis um den Vorplatz). Das
 *   ist seit E-037 wichtig: Die Rolle wiegt 680 kg und liegt damit weit ueber
 *   `BLOCKING_MASS_KG` (120 kg). Ausserhalb einer Arbeitszone haetten die
 *   Fahrer davor angehalten und gehupt — beim 52-kg-Besen war das egal.
 *
 * `gier` ist die Drehung um die Hochachse. Die Rolle wird NICHT gekippt (ihre
 * Bauform ist schon die Liegelage, siehe `spawnBesen`); 0 heisst, die
 * Rollenachse und damit die 2,70 m lange Schleppkante liegen quer (Ost–West).
 * Der Bagger schaut nach Norden und sieht beim Start die lange Seite — man
 * sieht sofort, wie breit das Ding kehrt.
 */
export const BESEN_PLATZ = { x: 3.5, z: -16.0, gier: 0 };
