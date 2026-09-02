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
// Nach dem Wiegen weiter zum Rangierpunkt vor dem Abkippplatz
export const ROUTE_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-14, 18.5],
  [0, 19],
];
export const ROUTE_IN_REV: Array<[number, number]> = [
  [0, 19],
  // 7,0 m: so nah, dass der Bagger die ganze Ladefläche bestreicht, und noch
  // weit genug, dass die Blockadeprüfung (5,5 m um die Maschine) nicht
  // dauernd anspricht.
  [0, 7.0],
];
export const ROUTE_OUT: Array<[number, number]> = [
  [0, 7.0],
  [0, 19],
  [-14, 18.5],
  [GATE_X, 24],
  [GATE_X, 40],
];

// ABHOLUNG: Ostspur nach Süden, dann rückwärts an den Verladeplatz neben der
// Presse — dort lädt der Spieler den Container mit sortenreinem Material.
export const PICKUP_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 24],
];
export const PICKUP_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-14, 18.5],
  [-3.5, 19],
];
// Rückwärts nach Westen direkt neben die Presse — Heck (Container-Öffnung)
// zeigt zur Schere, der Bagger lädt von dort um (Design-Fix 2026-08-29)
export const PICKUP_IN_REV: Array<[number, number]> = [
  [-3.5, 19],
  [-3.5, 8.0],
];
export const PICKUP_OUT: Array<[number, number]> = [
  [-3.5, 8.0],
  [-3.5, 19],
  [-14, 18.5],
  [GATE_X, 24],
  [GATE_X, 40],
];
// KIPPER: Wer selbst abkippen kann, muss nicht vor dem Bagger halten. Er fährt
// rückwärts an die Nordkante des Stahlschrotthaufens (Mitte bei x −9, z 1) und
// kippt seine Ladung direkt dort ab (Design-Fix 29.08.2026).
export const TIP_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-14, 18.5],
  [-9, 13],
];
export const TIP_IN_REV: Array<[number, number]> = [
  [-9, 13],
  [-9, 7.5],
];
export const TIP_OUT: Array<[number, number]> = [
  [-9, 7.5],
  [-9, 13],
  [-14, 18.5],
  [GATE_X, 24],
  [GATE_X, 40],
];

/**
 * Warteplatz an der Innenseite der Nordwand, westlich der Einfahrt: Nach dem
 * Abladen stellen sich vor allem die Händler dort ab, holen sich bei Janine
 * einen Kaffee und quatschen, bevor sie fahren. Das hält Betrieb auf dem
 * Platz — und macht den Abladeplatz sofort für den Nächsten frei
 * (Wunsch 02.09.2026).
 */
export const PARK_SLOTS: Array<[number, number]> = [
  [-30, 24],
  [-33.5, 24],
  [-30, 20],
];
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
