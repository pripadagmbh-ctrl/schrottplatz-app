import * as THREE from "three";

/**
 * Geometrie der Spinne — die eine Wahrheit für Modell, Kollider und
 * Bodenanschlag.
 *
 * Die Maße folgen dem Datenblatt der Sennebogen MG4.1-800-HO5. Mesh und
 * Kollider leiten sich beide hieraus ab, damit die Krallen physisch dort
 * sind, wo man sie sieht: Früher waren die Zahlen an drei Stellen kopiert,
 * und nach einer Formänderung stimmte der Bodenanschlag nicht mehr.
 */

/** Gelenkkreis der Schalen = ØC/2 laut Datenblatt (1514 mm) */
export const CLAW_RING_R = 0.757;
/** Unterkante Traverse, gemessen ab Kardangelenk */
export const CLAW_RING_Y = -0.9;
/** Länge eines Krallensegments */
export const CLAW_SEG_LEN = 0.26;
/** Krümmung je Segment nach innen (rad) — macht aus der Kralle eine Sichel */
export const CLAW_SEG_BEND = 0.22;
/** Segmente je Kralle */
export const CLAW_SEGMENTS = 6;
/** Zahl der Krallen */
export const CLAW_COUNT = 5;
/**
 * Spreizung der ganz offenen Spinne (rad). Das Datenblatt nennt 2225 mm
 * Öffnungsweite (entspräche 0,8) — zum Spielen ist das zu eng, der Greifer
 * soll weit aufreißen und ordentlich Volumen fassen.
 */
export const CLAW_OPEN_SPLAY = 1.25;

/**
 * Punkt auf einer Kralle nach `k` Segmenten, im Frame der Spinne.
 *
 * @param a Umfangswinkel der Kralle (0 … 2π)
 * @param splay Öffnungswinkel: 0 = geschlossen, CLAW_OPEN_SPLAY = ganz offen
 * @param k Segment, bis zu dem gerechnet wird (0 = Gelenk, CLAW_SEGMENTS = Spitze)
 */
export function clawPoint(
  a: number,
  splay: number,
  k: number,
  out: THREE.Vector3
): THREE.Vector3 {
  let y = 0;
  let z = 0;
  for (let i = 0; i < k; i++) {
    const th = -splay + i * CLAW_SEG_BEND;
    y -= CLAW_SEG_LEN * Math.cos(th);
    z -= CLAW_SEG_LEN * Math.sin(th);
  }
  const r = CLAW_RING_R + z;
  return out.set(Math.sin(a) * r, CLAW_RING_Y + y, Math.cos(a) * r);
}

/**
 * Öffnungsweite der Spinne bei gegebener Spreizung, in Metern.
 * Nützlich für Maßproben: Passt der Greifer noch zwischen die Muldenwände?
 */
export function clawSpan(splay: number): number {
  const p = clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3());
  return Math.hypot(p.x, p.z) * 2;
}

/**
 * Tiefe der Krallenspitze unter dem Ursprung der Spinne. Daraus ergibt sich
 * der Bodenanschlag — der Greifer darf nie in den Beton sinken.
 */
export function clawTipDepth(splay: number): number {
  return -clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3()).y;
}

/**
 * Wieviel Winkel eine Kralle gegen Widerstand noch nachdrücken darf (rad).
 * Ein Greifer bleibt nicht schlagartig stehen, wenn er auf Stahl trifft — die
 * Hydraulik drückt weiter, bis der Druck steht. Sichtbar wird das als kurzes
 * Nachsetzen, nicht als abrupter Stopp.
 */
export const NACHDRUECK_RESERVE = 0.12;
/**
 * Dasselbe fuer Nachgiebiges: Blech, Faesser, Weisse Ware, Kabinen.
 *
 * Der Zahn drueckt sich hier deutlich weiter hinein als in massiven Stahl —
 * gut das Dreifache, am Zahnende rund 45 cm — und steht dann. Vorher gab es
 * fuer solches Material gar keine Grenze: Es galt nicht als Hindernis, der
 * Zahn lief bis zum Anschlag durch das Teil hindurch (Ansage 12.09.2026:
 * „eine gewisse Starre bzw. Kraft muss jeder Zahn haben").
 */
export const WEICH_RESERVE = 0.4;
/** Wie langsam das Nachdrücken gegenüber freier Bewegung läuft. */
const NACHDRUECK_TEMPO = 0.25;

/**
 * Nächster Spreizwinkel einer einzelnen Kralle. Kleinerer Winkel = weiter zu.
 *
 * Die Regel ist der Kern des ungleichmäßigen Schließens: Öffnen geht immer —
 * sonst bliebe eine Kralle für immer stecken, sobald sie einmal aufsitzt.
 * Schließen läuft frei, solange nichts im Weg ist. Trifft die Kralle auf etwas,
 * das nicht nachgibt, drückt sie noch ein Stück nach und steht dann.
 *
 * Was nachgibt — Blech, Kabel, Fässer — gilt gar nicht erst als blockierend;
 * das entscheidet der Aufrufer. Ein Greifer quetscht solche Teile platt oder
 * schiebt sie beiseite, statt an ihnen hängen zu bleiben.
 *
 * @param ist       aktueller Winkel dieser Kralle
 * @param ziel      Winkel, den der Fahrer kommandiert
 * @param schritt   was in diesem Bild höchstens zurückgelegt wird (rad)
 * @param blockiert ob bei `ist - schritt` etwas Massives im Weg wäre
 * @param reserve   verbleibendes Nachdrücken dieser Kralle
 */
export function naechsteSpreizung(
  ist: number,
  ziel: number,
  schritt: number,
  blockiert: boolean,
  reserve: number = NACHDRUECK_RESERVE
): { winkel: number; reserve: number } {
  // Öffnen: immer erlaubt, und der Druck ist damit weg
  if (ziel >= ist) {
    return { winkel: Math.min(ziel, ist + schritt), reserve: NACHDRUECK_RESERVE };
  }
  if (!blockiert) {
    return { winkel: Math.max(ziel, ist - schritt), reserve: NACHDRUECK_RESERVE };
  }
  if (reserve <= 0) return { winkel: ist, reserve: 0 };
  const drueck = Math.min(schritt * NACHDRUECK_TEMPO, reserve, ist - ziel);
  return { winkel: ist - drueck, reserve: reserve - drueck };
}
