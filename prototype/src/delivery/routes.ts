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

// ABHOLUNG: Ostspur nach Süden, dann rückwärts an den Verladeplatz neben der
// Presse — dort lädt der Spieler den Container mit sortenreinem Material.
export const PICKUP_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 24],
];
/*
 * Der Abholer fährt an der Ostwand entlang (Ansage 12.09.2026: „von der Waage
 * am Büro vorbei entlang der Silos und kommt von Osten, was nicht der
 * Arbeitsbereich des Baggers wäre"). Die Spur läuft zwischen den
 * Absetzcontainern und den Silos nach Süden und endet östlich vom
 * Stahlcontainer — der Bagger muss dafür nicht ausweichen.
 */
export const PICKUP_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-27, 20],
  [-29, 10],
  [-29, -8],
];
export const PICKUP_IN_REV: Array<[number, number]> = [
  [-29, -8],
  [-21.5, -17.0],
];
export const PICKUP_OUT: Array<[number, number]> = [
  [-21.5, -17.0],
  [-29, -8],
  [-29, 10],
  [-27, 20],
  [GATE_X, 24],
  [GATE_X, 40],
];
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
  [5.0, 2],
];
export const TIP_IN_REV: Array<[number, number]> = [
  [5.0, 2],
  [5.0, -16.0],
];
export const TIP_OUT: Array<[number, number]> = [
  [5.0, -16.0],
  [5.0, 2],
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
  [0, 9, 11], // Abkippplatz vor dem Bagger inkl. Halteposition
  [-3.5, 10, 8], // Verladeplatz westlich neben dem Abladeplatz
  [-9, 4, 10], // Stahlschrotthaufen — dorthin kippen die Kipper selbst ab
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
