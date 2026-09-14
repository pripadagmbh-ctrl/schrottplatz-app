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
 * Die Abladestelle ist kein fester Punkt mehr (Ansage 12.09.2026).
 *
 * „Je nachdem, wie der Bagger positioniert ist, sollte er auch nicht immer
 * auf derselben Stelle platziert sein, sondern so nah wie möglich an den
 * Bagger heranfahren." Vorher hielt jeder LKW auf (0 | 7), egal wo die
 * Maschine stand — wer nach Süden gefahren war, musste zurückfahren, um an
 * die eigene Anlieferung zu kommen.
 *
 * Der Punkt liegt auf der Verbindung Bagger–Rangierpunkt, acht Meter vor der
 * Maschine, und wird auf den Vorplatz begrenzt. Acht Meter, weil die
 * Ladefläche dann im Greifbereich liegt (4,0–9,5 m) und die Blockadeprüfung
 * ringsum die Maschine (5,5 m) noch nicht anspricht. Steht der Bagger an
 * seinem gewohnten Platz, kommt genau die alte Stelle heraus.
 */
const ABLADE_ABSTAND = 8.0;
/**
 * Rangierpunkt, von dem aus rückwärts gesetzt wird.
 *
 * Seit der Platzumstellung (12.09.2026) sitzt der Betrieb im Süden: Der
 * Bagger steht auf (−6 | −16), die Presse hinter ihm an der Südgrenze. Der
 * LKW kommt also von Norden die Gasse herunter und setzt auf den Vorplatz
 * vor der Maschine zurück.
 */
/*
 * Nach dem Platzumbau (E-010) sitzt der Betrieb noch weiter suedlich: Der
 * Bagger steht auf (−0,5 | −22,5) vor der Ausbuchtung. Der LKW kommt die
 * Gasse herunter und setzt auf die freie Flaeche vor der Maschine zurueck.
 */
const RANGIER_Z = -6.0;
/**
 * Der Vorplatz, über den der Punkt nicht hinauswandert.
 *
 * Gesucht gegen die Nachbarn: Bei x unter −4,5 streift die Ladeflaeche die
 * Mulden an der Westflanke (Ostkante −5,9), ueber +1,5 den Reifencontainer
 * (Westkante 2,8). Suedlich von −16,5 stuende der Wagen im Schwenkbereich
 * ueber den Halden, noerdlich von −10,0 waere die Ladeflaeche weiter als
 * 9,2 m vom Sitz und damit nicht mehr auszuraeumen.
 */
const VORPLATZ = { xMin: -4.5, xMax: 1.5, zMin: -16.5, zMax: -10.0 };

let abladeStelle: [number, number] = [-1.2, -14.5];
let baggerOrt: (() => { x: number; z: number }) | null = null;

/** Woher die Baggerstellung kommt. Einmal beim Aufbau setzen. */
export function setBaggerOrt(f: () => { x: number; z: number }): void {
  baggerOrt = f;
}

/**
 * Neue Abladestelle bestimmen — beim Losfahren von der Waage aufzurufen.
 * Danach steht sie fest, solange der LKW unterwegs ist: Eine Strecke, die
 * sich unter dem fahrenden Wagen verschiebt, ist keine Strecke.
 */
export function neueAbladestelle(): [number, number] {
  const b = baggerOrt?.();
  if (b) {
    const rx = -2.0 - b.x;
    const rz = RANGIER_Z - b.z;
    const len = Math.hypot(rx, rz) || 1;
    const x = b.x + (rx / len) * ABLADE_ABSTAND;
    const z = b.z + (rz / len) * ABLADE_ABSTAND;
    abladeStelle = [
      Math.min(VORPLATZ.xMax, Math.max(VORPLATZ.xMin, x)),
      Math.min(VORPLATZ.zMax, Math.max(VORPLATZ.zMin, z)),
    ];
  }
  return abladeStelle;
}

/** Wo gerade abgeladen wird — für die Spurüberwachung. */
export function abladestelle(): [number, number] {
  return abladeStelle;
}

// Nach dem Wiegen weiter zum Rangierpunkt vor dem Abkippplatz
export function routeApproach(): Array<[number, number]> {
  const [x] = abladeStelle;
  return [WAAGE_HALT, VERTEILER, [-21, 10], [-12, 3], [x, RANGIER_Z]];
}
export function routeInRev(): Array<[number, number]> {
  const [x, z] = abladeStelle;
  return [
    [x, RANGIER_Z],
    [x, z],
  ];
}
export function routeOut(): Array<[number, number]> {
  const [x, z] = abladeStelle;
  return [
    [x, z],
    [x, RANGIER_Z],
    [-12, 3],
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
export const VERLADE_SPUR_X = VERLADE_STAND.x + 7.5;
/** Nordende der Verladespur — von hier setzt der Abholer zurueck. */
const ABHOL_RANGIER: [number, number] = [VERLADE_SPUR_X, -2.0];

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
  return [WAAGE_HALT, VERTEILER, [-19, 9], [VERLADE_SPUR_X, 2], ABHOL_RANGIER];
}
export function pickupInRev(): Array<[number, number]> {
  return [ABHOL_RANGIER, abholStelle];
}
export function pickupOut(): Array<[number, number]> {
  return [
    abholStelle,
    ABHOL_RANGIER,
    [VERLADE_SPUR_X, 2],
    [-19, 9],
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

export const TIP_APPROACH: Array<[number, number]> = [
  WAAGE_HALT,
  VERTEILER,
  [-14, 9],
  [-4, 3],
  [KIPP_SPUR_X, 2],
];
export const TIP_IN_REV: Array<[number, number]> = [
  [KIPP_SPUR_X, 2],
  [KIPP_SPUR_X, KIPP_HALT_Z],
];
export const TIP_OUT: Array<[number, number]> = [
  [KIPP_SPUR_X, KIPP_HALT_Z],
  [KIPP_SPUR_X, 2],
  [-4, 3],
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
 * Gesucht: Die Silo-Oeffnungen liegen bei x −33, ihre Flankensteine reichen
 * bis −32,7. Der Wagen ist 2,8 m breit, seine Blockadepruefung tastet mit
 * 1,4 m. Bei −30,0 bleiben 1,3 m bis zu den Steinen und 4,5 m bis zum
 * Verladeplatz — naeher an den Silos stuende er in der Oeffnung, weiter
 * oestlich im Arbeitsbereich des zweiten Baggerstands.
 */
export const MULDEN_GASSE_X = -30.0;
/**
 * Wie weit der Wagen in das Silo zurueckstoesst (Wagenmitte, x).
 *
 * Gesucht, nicht gegriffen. Nach hinten begrenzt ihn die Stirnwand: Sie steht
 * bei x −39,275 ± 0,275, ihre Innenseite also bei −39,0; das Heck liegt 3,0 m
 * hinter der Wagenmitte, bei −35,6 bleiben davon 0,4 m Luft. Nach vorn
 * begrenzt ihn die Ladung: Die Ladeflaeche reicht damit von −38,6 bis −32,6
 * und steht ganz ueber der Mulde (−39,0 bis −33,0).
 *
 * Die Blockadepruefung laesst das zu: Sie tastet mit 1,40 m Radius, die
 * Flanken stehen 2,375 m von der Mittellinie entfernt.
 */
const MULDE_TIEFE_X = -35.6;

export function bayApproach(z: number): Array<[number, number]> {
  return [WAAGE_HALT, VERTEILER, [MULDEN_GASSE_X, 13], [MULDEN_GASSE_X, z]];
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
    [MULDEN_GASSE_X, 13],
    VERTEILER,
    WAAGE_HALT,
    [GATE_X, 28],
    [GATE_X, 40],
  ];
}

/**
 * Warteplatz an der Innenseite der Nordwand, oestlich der Einfahrt: Nach dem
 * Abladen stellen sich vor allem die Händler dort ab und quatschen, bevor
 * sie fahren. Das hält Betrieb auf dem
 * Platz — und macht den Abladeplatz sofort für den Nächsten frei
 * (Wunsch 02.09.2026).
 *
 * Vorher lagen sie westlich der Einfahrt. Dort steht seit 11.09.2026 der
 * Betriebshof — die LKW haetten im Buero geparkt.
 */
/*
 * Nachtrag 14.09.2026 (E-010): Die drei Warteplaetze liegen jetzt VOR den
 * Sortierhallen, nicht mehr an der Nordwand — dort stehen seit heute die
 * Hallen selbst (z +17,5 bis +26,5). Je ein Platz vor einem Tor: Wer auf
 * seine Einweisung wartet, steht schon vor der richtigen Halle.
 */
export const PARK_SLOTS: Array<[number, number]> = [
  [-14, 14],
  [-5, 14],
  [4, 14],
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
   * Der Vorplatz vor dem Bagger: Hier haelt der Haendler zum Entladen, und
   * hier kippt der Selbstabkipper seine gemischte Fuhre ab (`ABKIPP_ZONE`).
   * Ein Radius deckt beides ab — sie liegen 2,5 m auseinander.
   */
  [0, -13, 11],
  /*
   * Der Verladeplatz vor der Silo-Reihe: Dort steht der Abholer, und dort
   * liegt zwangslaeufig Material, waehrend der Bagger ihn belaedt.
   */
  [-22, -10, 11],
  /*
   * Die Silo-Reihe samt Gasse. Dorthin kippt der sortenreine Kipper; was dort
   * liegt, ist Ziel und nicht Hindernis. Ein Radius deckt die ganze Reihe ab:
   * Sie laeuft von z +12,1 bis −28,9 auf x −36.
   */
  [-33, -8, 24],
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
