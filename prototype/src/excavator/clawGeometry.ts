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
