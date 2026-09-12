import * as THREE from "three";
import { GATE_X } from "../world/yard";

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
  [GATE_X, 24],
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
const RANGIER_Z = 2.0;
/**
 * Der Vorplatz, über den der Punkt nicht hinauswandert. Östlich beginnen die
 * Absetzcontainer, westlich die Batteriemulde, südlich der Bagger selbst.
 */
const VORPLATZ = { xMin: -6.5, xMax: -1.5, zMin: -12.5, zMax: 0.0 };

let abladeStelle: [number, number] = [0, 7.0];
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
    const rx = -4.0 - b.x;
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
  return [
    [GATE_X, 24],
    [-16, 14],
    [-8, 6],
    [x, RANGIER_Z],
  ];
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
    [-8, 6],
    [-16, 14],
    [GATE_X, 24],
    [GATE_X, 40],
  ];
}

/*
 * ABHOLUNG — eigene Anfahrt auf der Ostspur, bis an den Baggerplatz.
 *
 * Ansage 12.09.2026: „Abholer soll andere Route zum Baggerplatz nehmen."
 * Vorher fuhr er die Westspur am Buero und den Silos entlang und hielt neben
 * dem Reifendepot bei (−21,5 | −17). Das waren 19,6 m bis zur Maschine —
 * doppelt so weit, wie der Arm reicht. Beladen liess sich dort nichts; man
 * musste erst den ganzen Bagger umsetzen.
 *
 * Der Grund fuer den Umweg war die Presse: Sie und die Absetzcontainer bilden
 * zwischen x −5 und −15 eine durchgehende Sperre von z −11 bis −27. Von Westen
 * kommt man nicht an den Bagger heran, um sie herum auch nicht. Die einzige
 * offene Gasse liegt oestlich der Maschine, zwischen ihr und dem
 * Mischschrottplatz — und genau die faehrt der Abholer jetzt.
 *
 * Damit haben Anlieferung und Abholung getrennte Wege: Der Kipper setzt von
 * Nordwesten auf den Vorplatz, der Abholer kommt von Nordosten an die Flanke.
 * Sie kreuzen sich nicht, und beide stehen im Greifbereich.
 */
export const PICKUP_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 24],
];
/** Nordende der Ostgasse — von hier setzt der Abholer zurueck. */
const ABHOL_RANGIER: [number, number] = [5.5, -2.0];
/**
 * Wie weit vor dem Bagger der Abholer haelt.
 *
 * Etwas weiter weg als der Kipper (8,0 m), weil hier nicht abgekippt, sondern
 * Stueck fuer Stueck in den Container gelegt wird: Der Arm braucht Hoehe ueber
 * der Bordwand, und die hat er im mittleren Ring am ehesten.
 */
const ABHOL_ABSTAND = 7.5;
/**
 * Der Streifen, in dem die Halteposition liegen darf.
 *
 * Oestlich beginnt bei x 10 die Aussenwand des Mischschrottplatzes, suedlich
 * bei z −20 seine offene Kippkante. Und x 3,0 ist die Grenze nach Westen: Naeher
 * an den Bagger darf der Wagen nicht, sonst steht er im Heckschwenk.
 */
const ABHOLPLATZ = { xMin: 3.0, xMax: 8.0, zMin: -18.0, zMax: -6.0 };

let abholStelle: [number, number] = [5.5, -13.0];

/** Wie weit seitlich neben dem Bagger die Gasse liegt. */
const ABHOL_SEITLICH = 5.5;

/**
 * Halteposition des Abholers bestimmen — wie bei der Anlieferung einmal beim
 * Losfahren, danach steht sie fest.
 *
 * Gerechnet wird nicht auf der Luftlinie zum Rangierpunkt, sondern entlang der
 * Gasse: Erst legt sich fest, auf welcher Spurhoehe der Wagen steht (x), dann
 * wird er so weit nach Norden geschoben, dass der Abstand zum Bagger stimmt.
 *
 * Der Umweg ueber die Gasse ist noetig, weil die Luftlinie sie verlaesst,
 * sobald der Bagger nach Westen faehrt. Gemessen mit der Maschine auf
 * (−6 | −12): Die Luftlinie ergab einen Halt 10,3 m entfernt — anderthalb
 * Meter ausserhalb des Greifrings, der Container waere nicht zu beladen
 * gewesen. Diese Rechnung haelt ihn bei 9,0 m.
 */
export function neueAbholstelle(): [number, number] {
  const b = baggerOrt?.();
  if (b) {
    const x = Math.min(ABHOLPLATZ.xMax, Math.max(ABHOLPLATZ.xMin, b.x + ABHOL_SEITLICH));
    // Was der seitliche Versatz vom Sollabstand uebrig laesst, geht nach Norden.
    const quer = x - b.x;
    const laengs = Math.sqrt(Math.max(0, ABHOL_ABSTAND * ABHOL_ABSTAND - quer * quer));
    abholStelle = [
      x,
      Math.min(ABHOLPLATZ.zMax, Math.max(ABHOLPLATZ.zMin, b.z + laengs)),
    ];
  }
  return abholStelle;
}

/** Wo gerade verladen wird — fuer die Spurueberwachung. */
export function abholstelle(): [number, number] {
  return abholStelle;
}

export function pickupApproach(): Array<[number, number]> {
  return [
    [GATE_X, 24],
    [-12, 18],
    [4, 10],
    ABHOL_RANGIER,
  ];
}
export function pickupInRev(): Array<[number, number]> {
  return [ABHOL_RANGIER, abholStelle];
}
export function pickupOut(): Array<[number, number]> {
  return [
    abholStelle,
    ABHOL_RANGIER,
    [4, 10],
    [-12, 18],
    [GATE_X, 24],
    [GATE_X, 40],
  ];
}

// KIPPER: Wer selbst abkippen kann, muss nicht vor dem Bagger halten. Er fährt
// rückwärts an die Nordkante des Stahlschrotthaufens (Mitte bei x −9, z 1) und
// kippt seine Ladung direkt dort ab (Design-Fix 29.08.2026).
/*
 * Wer selbst abkippen kann, faehrt nicht vor den Bagger, sondern rueckwaerts
 * in die offene Nordseite des Mischschrottplatzes (Mitte x −19) und kippt
 * dort ab. Lambert faehrt seit 12.09.2026 nicht mehr durch den Mischschrott;
 * die Spur endet deshalb an seiner Kante, nicht darin.
 */
export const TIP_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-14, 12],
  [6.0, 2],
];
export const TIP_IN_REV: Array<[number, number]> = [
  [6.0, 2],
  [6.0, -17.5],
];
export const TIP_OUT: Array<[number, number]> = [
  [6.0, -17.5],
  [6.0, 2],
  [-14, 12],
  [GATE_X, 24],
  [GATE_X, 40],
];

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
export const PARK_SLOTS: Array<[number, number]> = [
  [-16, 24],
  [-6, 24],
  [-1.5, 24],
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
  // Vorplatz vor dem Bagger — dorthin kippt die Anlieferung ab
  [-4, -6, 11],
  // Ostgasse neben dem Bagger — dort steht der Abholer beim Verladen
  [5, -12, 8],
  // Kippkante des Mischschrottplatzes — dorthin kippen die Kipper selbst ab
  [6, -18, 9],
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
