import * as THREE from "three";
import { GATE_X, WEIGH_X } from "../world/yard";
import { VERLADE_STAND } from "../world/baggerstand";
import type { ContainerConfig } from "../world/containers";

/**
 * Halteplatz auf der Brueckenwaage.
 *
 * Seit E-010 steht die Waage neben dem Buero auf x −27,5 statt mittig in der
 * Einfahrt. Jeder Weg auf den Platz beginnt und endet hier; deshalb steht der
 * Punkt einmal und wird ueberall eingesetzt.
 */
export const WAAGE_HALT: [number, number] = [WEIGH_X, 22.5];
/**
 * Erster Punkt suedlich der Waage, von dem aus sich die Wege verzweigen.
 *
 * Gesucht, nicht gegriffen: westlich davon steht das Buero (Front x −30,6),
 * oestlich Janines Kaffeewagen (ab x −25,0), noerdlich die Wiegeplatte. Bei
 * (−27,0 | 16,0) bleiben zu beiden Seiten ueber 1,6 m — mehr, als die
 * Blockadepruefung der LKW mit 1,4 m abtastet.
 */
export const VERTEILER: [number, number] = [-27.0, 16.0];

/**
 * Das Streckennetz des Platzes.
 *
 * Jede Fahrzeugart hat ihre eigene Anfahrt, Rangierstrecke und Ausfahrt.
 * Die Punkte sind bewusst hier gebündelt statt im Fahrzeugcode verstreut:
 * Sie hängen an der Platzgeometrie, und ein einziger blockierter Punkt legt
 * den ganzen Umschlag lahm. Der Kollisionstest prüft sie deshalb gegen die
 * Hindernisliste — gegen genau diese Werte, nicht gegen abgeschriebene.
 */

/**
 * Fahrspur (SW, Design-Fix 2026-08-29): Die Route läuft ausschließlich über die
 * östliche Spur und endet in einer Sackgasse — sie kreuzt WEDER die Haufen-Zonen
 * (z ≈ 8–12) NOCH den Bagger-Standplatz. Abfahrt erfolgt vorwärts über dieselbe
 * Spur, also weg vom frisch abgekippten Schrott.
 */
// ANLIEFERUNG: Nordspur über die Brückenwaage, dann rückwärts an den
// Abkippplatz vor dem Bagger. Ausfahrt vorwärts wieder über die Waage.
// Einfahrt → Brückenwaage (dort wird brutto gewogen)
export const ROUTE_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 28],
  WAAGE_HALT,
];
/**
 * DER ABLADEPLATZ — seit dem 14.09.2026 abends ein fester Ort in der
 * Suedostecke, und der Wagen steht mit der LAENGSSEITE zum Bagger.
 *
 * Ansage Patrick: „Ich haette gerne, dass ich LKWs nicht mehr von hinten,
 * sondern von der Seite ablade. Die Presse muss weg, da wo sie gerade steht,
 * und da kommt der LKW hin, da faehrt er rueckwaerts ran. Der Weg ist einfach
 * viel zu lang, wenn ich eine 180-Grad-Drehung machen muss."
 *
 * Was daran gemessen ist:
 *
 *  - VORHER hielt der Wagen vor dem Bagger, das Heck zum Sitz. Die
 *    Ladeflaeche lag damit RADIAL: ihre Ecken standen 8,0 bis 13,5 m vom
 *    Sitz, die hintere Haelfte ausserhalb der Reichweite (Grenze 9,2 m).
 *  - JETZT steht sie QUER. Bei Halt (6,3 | −24,0) liegt die Flaeche von
 *    z −24,0 bis −18,6 auf x 4,95 bis 7,65; ihre vier Ecken sind 5,65 · 8,35 ·
 *    6,94 · 9,04 m vom Sitz entfernt — die ganze Flaeche im Schwenkband.
 *  - Der Schwenkweg zur Mischschrott-Halde schrumpft von 180 auf 52 Grad:
 *    bei 14 Grad/s sind das 3,7 s statt 12,9 s je Griff.
 *
 * Die Stelle ist FEST, nicht mehr aus der Baggerstellung gerechnet. Sie haengt
 * an der Ecke, die die Presse geraeumt hat — und an der Muellmulde daneben:
 * Deren Nordflanke liegt auf z −25,8, die Blockadepruefung tastet mit 1,40 m,
 * also muessen zwischen Halt und Flanke mindestens 1,75 m liegen.
 */
export const ABLADE_SPUR_X = 6.3;
/*
 * VON −24,0 AUF −23,0 (15.09.2026) — gemessen, nicht verschoben.
 *
 * Befund Patrick: „Ich kann noch nicht mal die LKWs vollstaendig abladen, weil
 * ich in die Wand greife." Nachgerechnet mit dem echten Umriss aus
 * `vehicles.ts` (Ursprung = Muldenmitte, Ladeflaeche ± bedLen/2 = ± 2,70 m,
 * Standflaeche ± 4,30 m, Kipper ± 4,60 m):
 *
 *                              bei z −24,0        bei z −23,0
 *   Ladeflaeche (z)            −26,70 … −21,30    −25,70 … −20,30
 *   Suedkante bis Mauerinnen   2,00 m             3,00 m
 *     (Spinne offen 3,38 m, also 1,69 m Halbmass + Luft)
 *   Standflaeche Kipper bis Mauer  0,10 m         1,10 m
 *   naechste Ladeflaechenecke  5,58 m  ZU NAH     5,88 m  im Band
 *   fernste Ladeflaechenecke   9,17 m             8,76 m
 *
 * Bei −24,0 lag die vordere linke Ecke der Ladeflaeche mit 5,58 m UNTER der
 * inneren Grenze von 5,80 m — der Arm bekommt dort den Ausleger nicht mehr eng
 * genug zusammen. Ein Meter nach Norden bringt alle vier Ecken ins Band
 * (5,88 · 8,44 · 6,32 · 8,76 m) und schafft zugleich die Luft zur Suedmauer.
 */
export const ABLADE_HALT_Z = -23.0;
/**
 * Nordende der Abladespur — von hier setzt der Wagen zurueck.
 *
 * VON z −10,0 AUF −17,5 (15.09.2026, E-029). GEMESSEN, und zwar am
 * Ladungs-Katapult: Waehrend des Rueckwaertssetzens ist die Fuhre auf der
 * Flaeche VERRIEGELT. Je laenger der Weg, desto tiefer arbeiten sich einzelne
 * Stuecke in den Schlitz am Kipplager — und der Loeser befreit ein
 * eingeklemmtes Teil mit einem einzigen sehr grossen Stoss.
 *
 * Nachgemessen ueber 16 Ladungen mit festen Zufallssaaten, jeweils die
 * hoechste Geschwindigkeit eines Stuecks zwischen Kippbeginn und Abfahrt
 * (`test/kipper.test.ts`, „schleudert die Ladung nicht davon"):
 *
 *   Rueckweg   Mittel   Hoechstwert   ueber 130 km/h
 *   13,0 m     154        424 km/h    8 von 16
 *    9,5 m     146        298 km/h    7 von 16
 *    5,5 m     109        255 km/h    3 von 16
 *
 * Zum Vergleich die ALTE Kipperspur (x 2,0, Halt −12,5), die ebenfalls 5,5 m
 * Rueckweg hatte: Mittel 117, Hoechstwert 305, 6 von 16. Der Umzug an den
 * Abladeplatz macht den Katapult mit kurzem Rueckweg also nicht schlimmer,
 * sondern etwas besser — mit dem alten 13-m-Rueckweg waere er deutlich
 * schlimmer geworden.
 *
 * Der Katapult selbst bleibt ein offener Punkt (`docs/offene-punkte.md`); hier
 * wird er nur nicht gefuettert.
 *
 * Was die Verlegung sonst noch aendert: Der letzte Knick vor der Spur wird
 * flacher (11 statt 30 Grad aus der Suedrichtung), der Wagen kommt der
 * Ostmauer also WENIGER nahe als vorher.
 */
const ABLADE_RANGIER: [number, number] = [ABLADE_SPUR_X, -17.5];

let abladeStelle: [number, number] = [ABLADE_SPUR_X, ABLADE_HALT_Z];
let baggerOrt: (() => { x: number; z: number }) | null = null;

/**
 * Woher die Baggerstellung kommt. Einmal beim Aufbau setzen.
 *
 * Bleibt bestehen, obwohl die Abladestelle nicht mehr daran haengt: `main.ts`
 * meldet die Maschine hier an, und wer den Abladeplatz eines Tages wieder
 * mitwandern lassen will, hat die Quelle dann schon.
 */
export function setBaggerOrt(f: () => { x: number; z: number }): void {
  baggerOrt = f;
}
/** Nur gelesen, damit der Verweis nicht als tot gilt. */
export function baggerStellung(): { x: number; z: number } | null {
  return baggerOrt?.() ?? null;
}
/**
 * Abladestelle bestimmen — beim Losfahren von der Waage aufzurufen.
 *
 * Sie steht fest; die Funktion bleibt, weil `vehicles.ts` sie zu genau dem
 * Zeitpunkt aufruft, an dem die Strecke festgelegt wird. Ein Ort, der sich
 * unter dem fahrenden Wagen verschiebt, ist keine Strecke.
 */
export function neueAbladestelle(): [number, number] {
  abladeStelle = [ABLADE_SPUR_X, ABLADE_HALT_Z];
  return abladeStelle;
}

/** Wo gerade abgeladen wird — für die Spurüberwachung. */
export function abladestelle(): [number, number] {
  return abladeStelle;
}

/*
 * Nach dem Wiegen quer ueber den Platz zum Rangierpunkt noerdlich der
 * Abladespur. Der Weg laeuft noerdlich an der Muldenreihe vorbei (deren
 * noerdlichste Mulde bei z −12,5 endet).
 *
 * Seit E-029 faehrt hier JEDER Anlieferer, auch der Kipper — seine eigene
 * Spur auf x 2,0 ist weg. Die Strecke ist damit einspurig; zwei Fahrzeuge
 * gleichzeitig auf dem Platz halten sich gegenseitig auf, statt sich zu
 * kreuzen (`test/einspurig.test.ts`).
 */
export function routeApproach(): Array<[number, number]> {
  /*
   * Der letzte Knick vor der Abladespur ist flach, und das ist gerechnet:
   * Ein LKW nimmt am Wegpunkt sofort die Richtung des naechsten Stuecks an —
   * er dreht sich auf der Stelle. Steht er dabei quer zur Ostmauer, schwenkt
   * seine Ecke darueber hinaus. Bei der alten Fuehrung (−4 | −2) → (6,3 | −8)
   * stand er 60 Grad schraeg und ragte 0,49 m in die Mauer.
   *
   * Aus (4 | −4) heraus sind es nur noch 30 Grad: Seine aeusserste Ecke liegt
   * dann auf x 9,93, die Mauer steht innen bei 10,20 — 0,27 m Luft. Und der
   * Zwischenpunkt (−4 | −4) haelt ihn beim Ausschwenken nach Osten 1,55 m
   * suedlich der Flanke des untersten Silos.
   */
  return [WAAGE_HALT, VERTEILER, [-21, 10], [-12, 4], [-4, -4], [4, -6], ABLADE_RANGIER];
}
export function routeInRev(): Array<[number, number]> {
  return [ABLADE_RANGIER, abladeStelle];
}
export function routeOut(): Array<[number, number]> {
  return [
    abladeStelle,
    ABLADE_RANGIER,
    [4, -6],
    [-4, -4],
    [-12, 4],
    [-21, 10],
    VERTEILER,
    WAAGE_HALT,
    [GATE_X, 28],
    [GATE_X, 40],
  ];
}

/*
 * ABHOLUNG — zum VERLADEPLATZ vor der Silo-Reihe.
 *
 * Das ist die Umkehrung dessen, was bis zum 14.09.2026 galt. Vorher kam der
 * Abholer an die Flanke des Baggers, weil sein Container dort stehen musste,
 * wo der Arm hinkommt. Seit E-010 gibt es dafuer einen eigenen Ort: den
 * Verladeplatz zwischen Silo-Reihe und LKW-Spur, mit einem zweiten
 * Baggerstand dazwischen (−25,5 | −12). Der Abholer setzt auf x −18 zurueck,
 * die Silo-Vorderkante liegt bei x −33 — 7,5 m nach jeder Seite.
 *
 * Damit haengt die Halteposition NICHT mehr am Bagger, sondern steht fest.
 * Das ist die Entscheidung von E-011: „Silo zu Abholer — der Spieler mit dem
 * Bagger am Verladeplatz." Wer laden will, faehrt hin; eine Fahrt hin und
 * zurueck dauert gemessen 22,6 s (E-012). Die alte Rechnung, die den LKW dem
 * Bagger hinterhertrug, ginge hier auch gar nicht auf: Steht die Maschine an
 * ihrem Hauptplatz, sind es 26 m bis zur Silo-Reihe.
 *
 * Der Weg kreuzt die Anlieferung nicht: Der Kipper faehrt oestlich an den
 * Bagger, der Abholer westlich an die Silos.
 */
export const PICKUP_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 28],
  WAAGE_HALT,
];
/**
 * Die LKW-Spur des Verladeplatzes und der Punkt, an dem der Abholer steht.
 *
 * 7,5 m vom zweiten Baggerstand, genau so weit, wie die Silo-Vorderkante auf
 * der anderen Seite liegt. Der Bagger steht in der Mitte und dreht sich
 * zwischen beiden — er muss nicht umsetzen.
 *
 * VORZEICHEN GEWECHSELT am 15.09.2026 (E-028): Die Silo-Reihe ist an die
 * WESTwand gezogen, ihre Vorderkante liegt auf x −33,0 und damit WESTlich des
 * Stands (−25,5). Der Abholer gehoert folglich nach Osten, auf −18,0. Mit dem
 * alten `− 7,5` waere er auf −33,0 gelandet, also mitten in der Silo-Reihe.
 */
export const VERLADE_SPUR_X = VERLADE_STAND.x + 7.5;
/**
 * Nordende der Verladespur — von hier setzt der Abholer nach SUEDEN zurueck.
 *
 * Der Verladeplatz liegt seit E-028 in der leeren Suedwesthaelfte (−25,5 |
 * −8,0), die Spur auf x −18,0. Der Wagen kommt von der Waage herunter, haelt
 * auf z 0,0 und setzt 8,0 m nach Sueden zurueck — dieselbe Strecke wie vorher,
 * nur andersherum. Noerdlich davon ist der Platz frei: Janines Kaffeewagen
 * steht seit heute an der Nordmauer, die Silo-Gasse liegt zehn Meter weiter
 * westlich.
 */
const ABHOL_RANGIER: [number, number] = [VERLADE_SPUR_X, 0.0];

let abholStelle: [number, number] = [VERLADE_SPUR_X, VERLADE_STAND.z];

/**
 * Halteposition des Abholers. Sie steht fest — der Verladeplatz ist ein Ort,
 * kein Abstand zum Bagger.
 */
export function neueAbholstelle(): [number, number] {
  abholStelle = [VERLADE_SPUR_X, VERLADE_STAND.z];
  return abholStelle;
}

/** Wo gerade verladen wird — fuer die Spurueberwachung. */
export function abholstelle(): [number, number] {
  return abholStelle;
}

export function pickupApproach(): Array<[number, number]> {
  /*
   * Von der Waage in die leere Suedwesthaelfte. Der Knick bei (−22 | 9) haelt
   * die Gerade oestlich der Hallenfront (x −30,6) und westlich der
   * Silo-Gasse; dazwischen steht auf dieser Haelfte des Platzes nichts.
   */
  return [WAAGE_HALT, VERTEILER, [-22, 9], ABHOL_RANGIER];
}
export function pickupInRev(): Array<[number, number]> {
  return [ABHOL_RANGIER, abholStelle];
}
export function pickupOut(): Array<[number, number]> {
  return [
    abholStelle,
    ABHOL_RANGIER,
    [-22, 9],
    VERTEILER,
    WAAGE_HALT,
    [GATE_X, 28],
    [GATE_X, 40],
  ];
}

/* ------------------------------------------- KIPPER: gemischte Ladung ---- */

/*
 * SEIT DEM 15.09.2026 KIPPT AUCH DER KIPPER AM ABLADEPLATZ (E-029).
 *
 * Ansage Patrick: „Kipper fahren die falsche Spur. Die sollen auch, wie die
 * anderen LKWs, seitlich von mir abgeladen werden."
 *
 * Vorher hatte er eine EIGENE Spur mitten im Arbeitsbereich: x 2,0, Halt auf
 * z −12,5, Abkippfleck (2,0 | −15,5). Sie lag 7,0 bis 7,4 m vom Sitz — beste
 * Lage, aber quer durch das Feld, in dem der Spieler schwenkt. Diese Spur
 * ist ersatzlos weg; rund 3 x 9 m mitten im Schwenkband sind frei geworden.
 *
 * Er faehrt jetzt dieselbe Strecke wie die Pritschen (`routeApproach`,
 * `routeInRev`, `routeOut`) und haelt an derselben Stelle: (6,3 | −23,0),
 * Laengsseite zum Bagger. Was bleibt, ist das Kippen — es ist der einzige
 * Weg, auf dem Material ohne Spielerarbeit auf den Platz kommt, und der
 * Spieler sortiert danach nach.
 *
 * WO DIE FUHRE LANDET — gerechnet, nicht geschaetzt. Der Wagen steht mit der
 * Kabine nach NORDEN (er ist von Norden nach Sueden zurueckgesetzt), die
 * Mulde kippt ueber ihre HINTERE Kante aus, und die liegt bei
 * Halt − bedLen/2. Danach zieht er `TIP_CREEP_M` gekippt nach vorn, der Rest
 * rutscht nach:
 *
 *   Abwurfkante   (6,3 | −26,0)   7,65 m vom Sitz (−0,5 | −22,5)
 *   nach Anziehen (6,3 | −24,6)   7,12 m
 *
 * Beides mitten im Schwenkband 5,8 bis 9,2 m und weit innerhalb der 9,5 m,
 * auf die der Arm ueberhaupt noch den Boden erreicht (`test/reach.test.ts`).
 * Nach Sueden bleiben bis zur Suedmauer (innen −28,7) noch 2,56 m Auslauf,
 * nach Norden liegt der Haufen hinter dem Wagen und nicht in seiner
 * Ausfahrt. Gezeichnet in `docs/messungen/2026-09-15_kipper.svg`.
 */

/**
 * Laenge der Ladeflaeche je Fahrzeugart (m).
 *
 * EINE Quelle fuer Bau (`vehicles.ts`), Abwurfrechnung und Waechter. Bis zum
 * 15.09.2026 stand dieselbe Tabelle dreimal abgeschrieben da — in
 * `vehicles.ts`, in `test/fahrumriss.test.ts` und in `test/vehicleModel.test.ts`.
 * Der Kipper ist der laengste Wagen; wer seine Zahl an einer Stelle aendert
 * und an der anderen nicht, prueft einen Umriss, den niemand faehrt.
 */
export const BED_LEN: Record<string, number> = {
  // Der PKW-Anhaenger ist kurz — ein Kofferraum voll, keine Fuhre
  pkw: 2.4,
  wrack: 5.4,
  pritsche: 5.4,
  abholer: 5.4,
  kipper: 6.0,
};

/** Ladeflaechenlaenge eines Fahrzeugs; Unbekanntes faehrt wie eine Pritsche. */
export function bedLenFor(kind: string): number {
  return BED_LEN[kind] ?? BED_LEN.pritsche!;
}

/**
 * Wo die gekippte Fuhre liegen bleibt — Ziel der Arbeitszonen und der
 * Wegpruefung von Lambert.
 *
 * Die hintere Muldenkante des Kippers im Halt. Frueher eine gegriffene Zahl
 * („Halt − 3,0"), jetzt aus derselben Ladeflaechenlaenge gerechnet, aus der
 * der Wagen gebaut wird.
 */
export const ABKIPP_ZONE: [number, number] = [
  ABLADE_SPUR_X,
  ABLADE_HALT_Z - BED_LEN.kipper! / 2,
];

/**
 * Faehrt diese Fuhre ins Lagersilo — oder auf den Abladeplatz?
 *
 * DIE ZWEITEILUNG, die seit E-028 im Code steht und die Patrick am
 * 15.09.2026 bestaetigt hat („sortenreine Kipper fahren weiterhin zu den
 * Silos"):
 *
 *   sortenrein UND es gibt ein Lagersilo  →  die Gasse hinunter ins Silo
 *   alles andere                          →  Abladeplatz, Laengsseite
 *                                            zum Bagger
 *
 * Nur wer SELBST kippen kann, faehrt ins Silo: Eine Pritsche wird vom Bagger
 * ausgeraeumt und muss dafuer in Reichweite stehen, auch wenn ihre Ladung
 * sortenrein ist.
 *
 * Steht hier und nicht in `vehicles.ts`, weil es die eine Regel ist, an der
 * der ganze Verkehr haengt — und weil sie so kopflos zu pruefen ist.
 */
export function faehrtInsSilo(kind: string, lagerMulde: ContainerConfig | null): boolean {
  if (kind !== "kipper") return false;
  return lagerMulde !== null;
}

/* ------------------------------------------ Sortenrein: die Silo-Reihe ---- */

/**
 * Wer sortenrein anliefert, kippt in das Silo seiner Fraktion.
 *
 * Ansage 13.09.2026: „sortenreine Kipper sollen direkt in den Mulden kippen,
 * nicht bei mir." Vorher ging jede Fuhre auf den Mischschrott vor dem Bagger
 * — auch die sauber getrennte, die dort nur wieder auseinandersortiert werden
 * musste.
 *
 * Seit E-028 ist die Reihe ein L, und die Gasse ist es auch: ein Schenkel
 * laengs der Westwand, einer laengs der Suedwand, verbunden ueber die Ecke.
 * Welcher Schenkel gilt, steht nicht in der Route, sondern am Silo
 * (`facing`) — `bayApproach` bekommt deshalb seit heute den ganzen Datensatz
 * und nicht mehr nur ein z. Mit der alten Signatur haette ein Suedsilo seine
 * Anfahrt an der falschen Wand bekommen, und zwar stumm.
 */

/**
 * Gassenmitte vor dem WESTschenkel (x) und vor dem SUEDschenkel (z).
 *
 * Beide liegen 5,0 m vor der Muldenoeffnung — dieselbe Zahl wie seit E-024,
 * und sie ist gemessen, nicht gegriffen: Ein LKW schaut vier Meter voraus, und
 * zwar auf der SEHNE von seinem Standort zum Vorausschaupunkt. Mit einer Gasse
 * dichter an der Reihe liegt dieser Punkt schon hinter der Ecke, die Sehne
 * schneidet sie ab und kommt der Flanke des Nachbarsilos auf 1,74 m nahe — die
 * Schranke liegt bei 1,75 m. Ein Zentimeter, und das Fahrzeug steht fuer immer
 * (gemessen 14.09.2026: 275 s ohne einen Meter Fortschritt).
 *
 * Westschenkel: Oeffnungen auf x −33,0 → Gasse −28,0.
 * Suedschenkel: Oeffnungen auf z −22,0 → Gasse −17,0.
 *
 * Die Ecke liegt auf (−28,0 | −17,0). Dort steht ein wartender Wagen mit der
 * Kabine auf z −21,6, also 0,40 m vor der Nordkante der Suedsilos.
 */
export const MULDEN_GASSE_X = -28.0;
export const MULDEN_GASSE_Z = -17.0;
/** Die Ecke, an der beide Schenkel ineinander uebergehen. */
const GASSEN_ECKE: [number, number] = [MULDEN_GASSE_X, MULDEN_GASSE_Z];
/** Wo die Gasse von der Waage her beginnt — suedlich der dritten Halle. */
const GASSEN_KOPF: [number, number] = [MULDEN_GASSE_X, -2.0];

/**
 * Wie weit der Wagen in das Silo zurueckstoesst (Wagenmitte).
 *
 * Mit dem RICHTIGEN Heckmass gerechnet: Der Wagen reicht nicht 3,0 m nach
 * hinten, sondern bedLen/2 + 0,14 = 3,14 m (Unterfahrschutz,
 * `vehicleModel.ts`). Die alte Rechnung nahm 3,0 m an und schickte den Wagen
 * 0,70 m in die Stirnwand — gefunden hat das erst `test/fahrumriss.test.ts`.
 *
 * WEST  Stirnwand innen auf x −38,65; bei −35,40 endet das Heck auf −38,54
 *       und bleibt 0,11 m davor.
 * SUED  Rueckwand innen auf z −27,65; bei −24,40 endet das Heck auf −27,54.
 *
 * Nach vorn reicht die Ladeflaeche damit bis 0,6 m vor die Muldenoeffnung.
 * Die Blockadepruefung laesst das zu: Sie tastet mit 1,40 m Radius, die
 * Flanken stehen 2,10 m von der Mittellinie entfernt und sind 0,35 m dick —
 * es bleiben 0,20 m Luft je Seite.
 */
const MULDE_TIEFE_X = -35.4;
const MULDE_TIEFE_Z = -24.4;

/** Steht dieses Silo am Suedschenkel? (Oeffnung nach Norden.) */
function amSuedschenkel(c: ContainerConfig): boolean {
  return c.facing === "north";
}

/** Halteplatz in der Gasse vor diesem Silo. */
function gassenHalt(c: ContainerConfig): [number, number] {
  return amSuedschenkel(c) ? [c.x, MULDEN_GASSE_Z] : [MULDEN_GASSE_X, c.z];
}
/** Wo die Wagenmitte beim Kippen steht. */
function muldenHalt(c: ContainerConfig): [number, number] {
  return amSuedschenkel(c) ? [c.x, MULDE_TIEFE_Z] : [MULDE_TIEFE_X, c.z];
}

export function bayApproach(c: ContainerConfig): Array<[number, number]> {
  /*
   * Von der Waage senkrecht nach Sueden in die Gasse. Der Knick bei (−27 | 6)
   * haelt den Wagen von der Hallenfront (x −30,6) weg: Er schwenkt dort nur
   * 7 Grad aus der Suedrichtung, seine westlichste Ecke liegt damit auf
   * −30,02 — 0,58 m Luft. Ein schaerferer Knick kostete pro Grad rund 7 cm.
   */
  const kopf: Array<[number, number]> = [WAAGE_HALT, VERTEILER, [-27, 6], GASSEN_KOPF];
  if (!amSuedschenkel(c)) return [...kopf, gassenHalt(c)];
  return [...kopf, GASSEN_ECKE, gassenHalt(c)];
}
export function bayInRev(c: ContainerConfig): Array<[number, number]> {
  return [gassenHalt(c), muldenHalt(c)];
}
export function bayOut(c: ContainerConfig): Array<[number, number]> {
  const zurueck: Array<[number, number]> = amSuedschenkel(c)
    ? [muldenHalt(c), gassenHalt(c), GASSEN_ECKE, GASSEN_KOPF]
    : [muldenHalt(c), gassenHalt(c), GASSEN_KOPF];
  return [...zurueck, [-27, 6], VERTEILER, WAAGE_HALT, [GATE_X, 28], [GATE_X, 40]];
}

/**
 * Warteplaetze: nach dem Abladen stellen sich vor allem die Haendler dort ab
 * und quatschen, bevor sie fahren. Das haelt Betrieb auf dem Platz — und macht
 * den Abladeplatz sofort fuer den Naechsten frei (Wunsch 02.09.2026).
 *
 * Der LKW faehrt dafuer auf (x | z − PARK_ANFAHRT_M) und setzt von dort nach
 * NORDEN zurueck; am Ende steht er mit dem Heck zur Wand (`vehicles.ts`).
 * Zwei der drei Plaetze liegen deshalb wieder an der Nordwand oestlich der
 * Einfahrt, wo sie bis E-010 schon standen — dort stehen seit dem 15.09.2026
 * keine Hallen mehr.
 *
 * Gesucht, nicht gegriffen. Eine Standflaeche misst 3,10 x 8,60 m:
 *
 *   (−18,5 | 24)  x −20,05 … −16,95 — 0,4 m neben der Torspur (x −22 ± 1,55)
 *   (−14,5 | 24)  x −16,05 … −12,95 — 0,95 m westlich von Janines Kaffeewagen
 *                 (der belegt x −12,0 … −7,0)
 *   (−26,0 |  6)  vor dem Tor der dritten Halle, 3,05 m davor; die Waagenspur
 *                 (x −27,5, z 14 … 26) bleibt frei, der Wagen endet auf z 10,3
 *
 * Warum nicht drei an der Nordwand: Oestlich von Janine bleibt zwischen ihr
 * und der Silo-Gasse (x −1,5, Wagenflanke bis 0,05) kein Streifen von 3,10 m
 * uebrig — nachgerechnet 3,45 m zwischen Gassenflanke und Silo-Wand, und
 * darin stuende der Wartende dann wieder im Weg.
 */
export const PARK_SLOTS: Array<[number, number]> = [
  [-18.5, 24],
  [-14.5, 24],
  [-26.0, 6],
];
/**
 * Wie weit suedlich des Platzes der LKW anhaelt, bevor er rueckwaerts an die
 * Wand setzt. Ein Fahrer stellt sich nicht mit der Schnauze an die Mauer.
 */
export const PARK_ANFAHRT_M = 8;
/** So lange bleibt ein Fahrzeug stehen (s) */
export const PARK_TIME_S: [number, number] = [45, 120];

export const SPEED = 4.8; // m/s (SW) — zuegiger Umschlag
export const FIRST_DELAY_S = 12; // (SW)
export const NEXT_DELAY_S: [number, number] = [7, 15]; // (SW) — dichter Umschlag
/** Sicherheitsabstand zum Bagger: darunter wartet der Fahrer (Briefing Kap. 13) */
export const BLOCK_RADIUS = 5.5;
/** Ab diesem Gewicht gilt ein liegendes Teil als echtes Hindernis (SW) */
export const BLOCKING_MASS_KG = 120;
export const HONK_AFTER_S = 10;
/** Halbe Innenbreite der Ladefläche (SW) — größer als das breiteste Großteil */
export const BED_HALF_W = 1.35;
/**
 * Arbeitszonen, in denen liegender Schrott NICHT als Blockade gilt: Genau
 * dorthin wird abgekippt bzw. verladen — dort muss das Fahrzeug hin.
 * [x, z, radius]
 */
export const WORK_ZONES: Array<[number, number, number]> = [
  /*
   * Der Vorplatz vor dem Bagger. Hier kippte bis zum 15.09.2026 der
   * Selbstabkipper ab; seit E-029 faehrt er an den Abladeplatz. Der Kreis
   * bleibt, weil hier weiterhin liegt, was dem Spieler aus der Spinne
   * faellt — ohne ihn haelt der naechste Wagen davor an und hupt.
   */
  [0, -13, 11],
  /*
   * Der Abladeplatz in der Suedostecke (seit 14.09.2026 abends): Dort steht
   * der Haendler quer, und dort liegt zwangslaeufig Material, waehrend der
   * Spieler ihn ausraeumt. Ohne diese Zone haelt der naechste Wagen davor an
   * und hupt, weil sein eigener Vorgaenger etwas hat liegen lassen.
   */
  [ABLADE_SPUR_X, ABLADE_HALT_Z, 9],
  /*
   * Der Verladeplatz vor der Silo-Reihe: Dort steht der Abholer, und dort
   * liegt zwangslaeufig Material, waehrend der Bagger ihn belaedt. Der
   * Mittelpunkt liegt zwischen Bagger und LKW-Spur — seit E-028 also OESTLICH
   * des Stands, weil die Silos nach Westen gewandert sind.
   */
  [VERLADE_STAND.x + 3.5, VERLADE_STAND.z, 11],
  /*
   * Die L-foermige Silo-Reihe samt Gasse. Dorthin kippt der sortenreine
   * Kipper; was dort liegt, ist Ziel und nicht Hindernis. Ein Kreis je
   * Schenkel, damit kein Radius quer ueber den halben Platz greift:
   *
   *   WEST  Silos auf x −36,0 von z −3,4 bis −12,6, Gasse auf x −28,0.
   *         Von (−32,0 | −8,0) sind es 6,9 m in die entfernteste Ecke.
   *   SUED  Silos auf z −25,0 von x −30,0 bis −20,8, Gasse auf z −17,0.
   *         Von (−25,4 | −21,0) sind es 10,1 m in die entfernteste Ecke.
   */
  [-32.0, -8.0, 9],
  [-25.4, -21.0, 11],
];
/** Nach so langer Blockade fährt der Fahrer vorsichtig weiter (kein Deadlock) */
export const BLOCK_GIVEUP_S = 35;

export const TIP_ANGLE = THREE.MathUtils.degToRad(58); // (SW) steil genug für sperrige Großteile
/**
 * Wie weit der Kipper mit oben stehender Mulde anzieht, bevor er sie senkt.
 * Senkt er im Stand, bleibt Schrott auf der Fläche liegen, sobald unten schon
 * etwas im Weg liegt — und das wird mit jeder Fuhre wahrscheinlicher.
 *
 * Kurz gehalten mit Absicht. Der Bagger erreicht den Boden nur zwischen 3,0
 * und 9,5 m (gemessen aus der Armgeometrie). Seit E-029 zieht der Wagen am
 * Abladeplatz nach NORDEN an, also auf den Bagger zu: Die Abwurfkante wandert
 * von 7,65 auf 7,12 m. Weiter anziehen hiesse, den Rest der Fuhre unter die
 * 5,8-m-Grenze zu schieben, wo der Arm nicht mehr eng genug zusammenkommt.
 */
export const TIP_CREEP_M = 1.4;
export const TIP_CREEP_SPEED = 1.1; // m/s — Schritttempo, damit man das Abrutschen sieht
/** Wie weit der Händlerkran beim Andocken zur Seite schwenkt (aus dem Weg). */
export const CRANE_SWING = THREE.MathUtils.degToRad(78);
