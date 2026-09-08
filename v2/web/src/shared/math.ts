/** Vektor-Helfer ohne Three.js — die Simulation darf Three nicht kennen (Lint-Gate). */
export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }

export const ZERO: Readonly<Vec3> = Object.freeze({ x: 0, y: 0, z: 0 });
export const IDENTITY: Readonly<Quat> = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export const DEG = Math.PI / 180;
export function deg(d: number): number { return d * DEG; }

/** Wert linear Richtung Ziel bewegen, höchstens `maxStep` pro Aufruf (Rampe, wie prototype excavator.ts:1592). */
export function ramp(current: number, target: number, maxStep: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}
export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx, dz = az - bz;
  return Math.hypot(dx, dz);
}
/** Liegt (x,z) im achsparallelen Rechteck mit Mittelpunkt (cx,cz) und Halbmaßen (hw,hd)? */
export function inRect(x: number, z: number, cx: number, cz: number, hw: number, hd: number): boolean {
  return Math.abs(x - cx) <= hw && Math.abs(z - cz) <= hd;
}
