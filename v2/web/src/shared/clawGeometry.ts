import type { Vec3 } from "./math";

/**
 * Geometrie der Greifspinne — die eine Wahrheit für Modell (view), Kollider (sim) und Bodenanschlag.
 * Maße nach Datenblatt Sennebogen MG4.1-800-HO5 (aus prototype/src/excavator/clawGeometry.ts).
 * Ohne Three.js, damit die Simulation sie benutzen darf; `out` ist alles mit x/y/z (auch ein THREE.Vector3).
 */
/** Gelenkkreis der Schalen = ØC/2 laut Datenblatt (1514 mm) */
export const CLAW_RING_R = 0.757;
/** Unterkante Traverse, gemessen ab Kardangelenk */
export const CLAW_RING_Y = -0.9;
/** Länge eines Krallensegments */
export const CLAW_SEG_LEN = 0.26;
/** Krümmung je Segment nach innen (rad) — macht aus der Kralle eine Sichel */
export const CLAW_SEG_BEND = 0.22;
export const CLAW_SEGMENTS = 6;
export const CLAW_COUNT = 5;
/** Spreizung ganz offen (rad). Datenblatt 2225 mm Öffnung ≈ 0,8 — zum Spielen bewusst weiter. */
export const CLAW_OPEN_SPLAY = 1.25;

/**
 * Punkt auf einer Kralle nach `k` Segmenten, im Frame der Spinne.
 * @param a Umfangswinkel (0 … 2π) · @param splay 0 = zu … CLAW_OPEN_SPLAY = offen · @param k 0 = Gelenk … CLAW_SEGMENTS = Spitze
 */
export function clawPoint<T extends Vec3>(a: number, splay: number, k: number, out: T): T {
  let y = 0, z = 0;
  for (let i = 0; i < k; i++) {
    const th = -splay + i * CLAW_SEG_BEND;
    y -= CLAW_SEG_LEN * Math.cos(th);
    z -= CLAW_SEG_LEN * Math.sin(th);
  }
  const r = CLAW_RING_R + z;
  out.x = Math.sin(a) * r; out.y = CLAW_RING_Y + y; out.z = Math.cos(a) * r;
  return out;
}

const tmp: Vec3 = { x: 0, y: 0, z: 0 };
/** Öffnungsweite der Spinne (m) bei gegebener Spreizung. */
export function clawSpan(splay: number): number {
  clawPoint(0, splay, CLAW_SEGMENTS, tmp);
  return Math.hypot(tmp.x, tmp.z) * 2;
}
/** Tiefe der Krallenspitze unter dem Spinnenursprung — Bodenanschlag. */
export function clawTipDepth(splay: number): number {
  return -clawPoint(0, splay, CLAW_SEGMENTS, tmp).y;
}
/** Radius, den die Spitzen bei gegebener Spreizung aufspannen. */
export function clawTipRadius(splay: number): number {
  return Math.max(clawPoint(0, splay, CLAW_SEGMENTS, tmp).z, 0);
}
