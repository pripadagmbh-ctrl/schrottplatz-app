import * as THREE from "three";
import { GATE_X, WEIGH_X } from "../world/yard";
import { VERLADE_STAND } from "../world/baggerstand";

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
/** Nordende der Abladespur — von hier setzt der Wagen zurueck. */
const ABLADE_RANGIER: [number, number] = [ABLADE_SPUR_X, -10.0];

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
 * noerdlichste Mulde bei z −12,5 endet) und oestlich an der Kipperspur
 * (x 2,0) — beide bleiben frei.
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
 * x −18,0 ist gesucht: 7,5 m oestlich des zweiten Baggerstands, genau so weit,
 * wie die Silo-Vorderkante westlich davon liegt. Der Bagger steht in der
 * Mitte und dreht sich zwischen beiden — er muss nicht umsetzen.
 */
export const VERLADE_SPUR_X = VERLADE_STAND.x - 7.5;
/**
 * Suedende der Verladespur — von hier setzt der Abholer nach NORDEN zurueck.
 *
 * Bis zum 15.09.2026 lag der Verladeplatz im Sueden und der Abholer kam von
 * Norden. Jetzt ist es umgekehrt, und das ist kein Geschmack, sondern
 * gemessen: Janines Kaffeewagen steht auf (−9,5 | 15,5) und belegt
 * x −12,0 … −7,0, z +14,1 … +16,9. Die Spur laeuft auf x −11,5 mitten durch
 * diesen Streifen — von Norden kommend faehrt der Wagen durch den Kaffeewagen.
 * Von Sueden bleibt er 2,0 m darunter.
 */
const ABHOL_RANGIER: [number, number] = [VERLADE_SPUR_X, -1.0];

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
   * Von der Waage suedlich an Janines Kaffeewagen vorbei auf die Spur. Der
   * Knick bei (−20 | 8) haelt die Sehne, mit der ein LKW vier Meter
   * vorausschaut, aus dem Kaffeewagen heraus: Auf der Geraden von dort zum
   * Rangierpunkt liegt sie bei x −12 auf z +0,6 — 13,5 m suedlich des Wagens.
   */
  return [WAAGE_HALT, VERTEILER, [-20, 8], ABHOL_RANGIER];
}
export function pickupInRev(): Array<[number, number]> {
  return [ABHOL_RANGIER, abholStelle];
}
export function pickupOut(): Array<[number, number]> {
  return [
    abholStelle,
    ABHOL_RANGIER,
    [-20, 8],
    VERTEILER,
    WAAGE_HALT,
    [GATE_X, 28],
    [GATE_X, 40],
  ];
}

/* ------------------------------------------- KIPPER: gemischte Ladung ---- */

/*
 * Wer selbst abkippen kann, faehrt an den Mischschrott — aber NICHT in die
 * Ausbuchtung hinein.
 *
 * Das ist beim Nachrechnen des neuen Platzes die eine Stelle, an der Plan und
 * Geometrie auseinandergehen, und deshalb steht hier, warum:
 *
 * Der Konzeptplan zeichnet die Abkippzone auf (1,6 | −25,2), also hinter dem
 * Bagger, zwischen ihm und den beiden Halden. Ein Kipper, dessen Ladeflaeche
 * darueber steht, hat seine Wagenmitte bei z ≈ −22,2 — 2,1 m vom Bagger, der
 * auf (−0,5 | −22,5) steht. Das ist nicht knapp, das ist ineinander: Die
 * Blockadepruefung haelt jeden LKW ab 5,5 m Abstand an (`BLOCK_RADIUS`), und
 * der Oberwagen schwenkt ueber diese Flaeche.
 *
 * Nachgerechnet ist die Oeffnung der Ausbuchtung 14 m breit (x −6,5 bis 7,5),
 * und der Bagger steht in ihrer Mitte. Links von ihm bleiben bis zu den
 * Mulden 2,4 m, rechts bis zur Presse 0,8 m — durch beides passt kein
 * 2,7-m-Wagen. Anders gesagt: Solange die Maschine auf ihrem Platz steht,
 * kommt kein Fahrzeug an den Halden vorbei. Genau so ist die Ausbuchtung auch
 * gemeint (E-011: „Grossteile und Mischschrott — immer beim Bagger").
 *
 * Der Konzeptplan schreibt es selbst dazu: „Abgeladen wird vor dem Bagger
 * oder links daneben." Also kippt der Wagen vorne links ab, und der Spieler
 * raeumt von dort in die Halde hinter sich. Gesucht sind zwei Zahlen:
 *
 *   Spur x 2,0   — die Ladeflaeche liegt dann zwischen 0,65 und 3,35; der
 *                  Reifencontainer beginnt bei 2,8, seine Flankensteine bei
 *                  2,75 — aber erst ab z −16,4, also suedlich des Halts.
 *   Halt z −13,0 — die Ladeflaeche steht von −16,0 bis −10,0, die Fuhre
 *                  rutscht hinten heraus und liegt um (2,0 | −16,0). Das sind
 *                  7,0 m vom Sitz, mitten im Schwenkband 5,8 bis 9,2 m.
 */
/** Spur, auf der der Kipper vor dem Bagger zurueckstoesst. */
export const KIPP_SPUR_X = 2.0;
/**
 * Wo seine Wagenmitte beim Kippen steht.
 *
 * Gemessen ueber sieben Halteplaetze von −11 bis −17 (14.09.2026): Bei −13,0
 * schoss ein eingeklemmtes Teil mit 167 km/h heraus, an allen anderen blieb es
 * unter 130. Das ist keine Eigenschaft des Platzes, sondern der bekannte
 * Schlitz am Kipplager — der Waechter misst mit EINEM Zufallsstartwert und
 * trifft mal einen Zacken, mal nicht. −12,5 ist gewaehlt, weil dort der
 * Abkippfleck 7,4 m vom Sitz liegt (mitten im Schwenkband) und die Ladeflaeche
 * 0,9 m vor dem Reifencontainer endet.
 */
export const KIPP_HALT_Z = -12.5;
/** Wo die Fuhre danach liegt — Ziel der Arbeitszonen und der Wegweiser. */
export const ABKIPP_ZONE: [number, number] = [KIPP_SPUR_X, KIPP_HALT_Z - 3.0];

/*
 * Der Wendepunkt der Kipperspur ist am 15.09.2026 von z +2 auf −4 gerueckt.
 *
 * Gemessen, nicht verlegt: Die Silo-Reihe steht jetzt auf x +6,5 und reicht
 * mit ihren Flanken bis x +3,5, die suedlichste Flanke bis z +0,825. Ein
 * Kipper, der bei (2 | 2) aus der Kurve kommt, steht dort quer und liegt mit
 * seiner Standflaeche mitten in der Flanke des suedlichsten Silos.
 *
 * Bei (2 | −7) steht er laengs zur Spur: Seine Flaeche reicht dann von
 * z −11,14 bis −3,10 und bleibt 1,18 m suedlich der Silo-Flanke (die endet auf
 * z −1,925). Zwischenstand (2 | −4) war nachgemessen 0,05 m zu weit noerdlich
 * — genau die Groessenordnung, in der solche Fehler bisher durchgerutscht
 * sind.
 */
const TIP_EINFAHRT: [number, number] = [KIPP_SPUR_X, -7];
export const TIP_APPROACH: Array<[number, number]> = [
  WAAGE_HALT,
  VERTEILER,
  [-14, 9],
  [-6, 1],
  TIP_EINFAHRT,
];
export const TIP_IN_REV: Array<[number, number]> = [
  TIP_EINFAHRT,
  [KIPP_SPUR_X, KIPP_HALT_Z],
];
export const TIP_OUT: Array<[number, number]> = [
  [KIPP_SPUR_X, KIPP_HALT_Z],
  TIP_EINFAHRT,
  [-6, 1],
  [-14, 9],
  VERTEILER,
  WAAGE_HALT,
  [GATE_X, 28],
  [GATE_X, 40],
];

/* ------------------------------------------ Sortenrein: die Silo-Reihe ---- */

/**
 * Wer sortenrein anliefert, kippt in das Silo seiner Fraktion an der Westwand.
 *
 * Ansage 13.09.2026: „sortenreine Kipper sollen direkt in den Mulden kippen,
 * nicht bei mir." Vorher ging jede Fuhre auf den Mischschrott vor dem Bagger
 * — auch die sauber getrennte, die dort nur wieder auseinandersortiert werden
 * musste.
 *
 * Die Reihe ist mit E-010 von x −34,5 auf −36 gerueckt und laeuft jetzt von
 * z +10 bis −26,8. Die Gasse musste dabei mitwandern: Sie lag auf x −26, und
 * dort steht seither der zweite Baggerstand (−25,5 | −12).
 */
/**
 * Gassenmitte, auf der die Anlieferer an der Silo-Reihe entlangfahren.
 *
 * GESPIEGELT am 15.09.2026, weil die Reihe die Wand gewechselt hat — die
 * Massverhaeltnisse sind uebernommen, nicht neu geraten. Die alte Reihe
 * oeffnete sich auf x −33, die Gasse lag 5,0 m davor auf −28. Die neue Reihe
 * oeffnet sich auf x +3,5; die Gasse liegt also auf −1,5.
 *
 * Warum ausgerechnet 5,0 m: Ein LKW schaut vier Meter voraus, und zwar auf der
 * SEHNE von seinem Standort zum Vorausschaupunkt, nicht der Strecke entlang.
 * Mit einer Gasse dichter an der Reihe lag dieser Punkt schon hinter der Ecke,
 * die Sehne schnitt sie ab und kam der Flanke des Nachbarsilos auf 1,74 m nahe
 * — die Schranke liegt bei 1,75 m. Ein Zentimeter, und das Fahrzeug steht fuer
 * immer (gemessen 14.09.2026: 275 s ohne einen Meter Fortschritt). Bei 5,0 m
 * ist die gerade Strecke aus dem Silo 7,6 m lang; nachgemessen 10 von 10
 * Fuhren durch.
 */
export const MULDEN_GASSE_X = -1.5;
/**
 * Wie weit der Wagen in das Silo zurueckstoesst (Wagenmitte, x).
 *
 * Auch das gespiegelt — aber mit dem RICHTIGEN Heckmass. Die Stirnwand steht
 * innen bei x +9,15, und der Wagen reicht nicht 3,0 m nach hinten, sondern
 * bedLen/2 + 0,14 = 3,14 m (Unterfahrschutz, `vehicleModel.ts`). Bei +5,9
 * endet er auf 9,04 und bleibt 0,11 m vor der Wand. Die alte Rechnung an der
 * Westwand nahm 3,0 m an und schickte den Wagen 0,70 m in die Stirnwand —
 * gefunden hat das erst `test/fahrumriss.test.ts` am 15.09.2026.
 *
 * Nach vorn reicht die Ladeflaeche damit bis x +2,9; 0,6 m von ihr stehen vor
 * der Muldenoeffnung (3,5).
 *
 * Die Blockadepruefung laesst das zu: Sie tastet mit 1,40 m Radius, die
 * Flanken stehen 2,375 m von der Mittellinie entfernt.
 */
const MULDE_TIEFE_X = 5.9;

export function bayApproach(z: number): Array<[number, number]> {
  /*
   * Quer ueber den freien Mittelplatz auf die Gasse. Der Knick bei (−20 | 11)
   * ist gesetzt, damit die Gerade suedlich an Janines Kaffeewagen vorbeilaeuft
   * (er belegt x −12,0 … −7,0 auf z +14,1 … +16,9): Auf der Strecke von dort
   * zum Gasseneingang liegt sie bei x −12 auf z +9,7 und bei x −7 auf z +8,9.
   */
  return [WAAGE_HALT, VERTEILER, [-20, 11], [MULDEN_GASSE_X, 8], [MULDEN_GASSE_X, z]];
}
export function bayInRev(z: number): Array<[number, number]> {
  return [
    [MULDEN_GASSE_X, z],
    [MULDE_TIEFE_X, z],
  ];
}
export function bayOut(z: number): Array<[number, number]> {
  return [
    [MULDE_TIEFE_X, z],
    [MULDEN_GASSE_X, z],
    [MULDEN_GASSE_X, 8],
    [-20, 11],
    VERTEILER,
    WAAGE_HALT,
    [GATE_X, 28],
    [GATE_X, 40],
  ];
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
   * Der Vorplatz vor dem Bagger: Hier kippt der Selbstabkipper seine
   * gemischte Fuhre ab (`ABKIPP_ZONE`).
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
   * liegt zwangslaeufig Material, waehrend der Bagger ihn belaedt.
   */
  [VERLADE_STAND.x - 3.5, VERLADE_STAND.z, 11],
  /*
   * Die Silo-Reihe samt Gasse. Dorthin kippt der sortenreine Kipper; was dort
   * liegt, ist Ziel und nicht Hindernis. Ein Radius deckt die ganze Reihe ab:
   * Sie laeuft seit dem 15.09.2026 von z +0,8 bis +28,6 auf x +6,5, die Gasse
   * auf x −1,5. Von (2,5 | 14,7) sind es 15,6 m in die entfernteste Ecke.
   */
  [2.5, 14.7, 16],
];
/** Nach so langer Blockade fährt der Fahrer vorsichtig weiter (kein Deadlock) */
export const BLOCK_GIVEUP_S = 35;

export const TIP_ANGLE = THREE.MathUtils.degToRad(58); // (SW) steil genug für sperrige Großteile
/**
 * Wie weit der Kipper mit oben stehender Mulde anzieht, bevor er sie senkt.
 * Senkt er im Stand, bleibt Schrott auf der Fläche liegen, sobald unten schon
 * etwas im Weg liegt — und das wird mit jeder Fuhre wahrscheinlicher.
 */
/**
 * Kurz gehalten mit Absicht. Der Bagger erreicht den Boden nur zwischen 3,0 und
 * 9,5 m (gemessen aus der Armgeometrie). Der Kipper dockt bei z = 7 an, also
 * 8 m vom Bagger — zieht er gekippt 3,2 m weiter weg, landet der Rest der Fuhre
 * bei ueber 11 m und ist nicht mehr wegzubaggern. 1,4 m reichen, damit der
 * Wagen unter dem Haufen hervorkommt und der Rest ueber die Kante nachrutscht.
 */
export const TIP_CREEP_M = 1.4;
export const TIP_CREEP_SPEED = 1.1; // m/s — Schritttempo, damit man das Abrutschen sieht
/** Wie weit der Händlerkran beim Andocken zur Seite schwenkt (aus dem Weg). */
export const CRANE_SWING = THREE.MathUtils.degToRad(78);
