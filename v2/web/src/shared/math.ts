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

// --- Quaternion-Helfer (ohne Three) ---
export function quatFromAxisY(yaw: number, out: Quat): Quat { out.x = 0; out.y = Math.sin(yaw / 2); out.z = 0; out.w = Math.cos(yaw / 2); return out; }
export function quatFromAxisZ(roll: number, out: Quat): Quat { out.x = 0; out.y = 0; out.z = Math.sin(roll / 2); out.w = Math.cos(roll / 2); return out; }
export function quatFromAxisX(pitch: number, out: Quat): Quat { out.x = Math.sin(pitch / 2); out.y = 0; out.z = 0; out.w = Math.cos(pitch / 2); return out; }
/** out = a × b (erst b, dann a anwenden) */
export function quatMul(a: Quat, b: Quat, out: Quat): Quat {
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  out.x = x; out.y = y; out.z = z; out.w = w; return out;
}
export function quatConj(q: Quat, out: Quat): Quat { out.x = -q.x; out.y = -q.y; out.z = -q.z; out.w = q.w; return out; }
/** v gedreht um q → out */
export function rotateVec(q: Quat, v: Vec3, out: Vec3): Vec3 {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  out.x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
  out.y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
  out.z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
  return out;
}
/** Kürzeste Drehung, die `from` (Einheitsvektor) auf `to` (Einheitsvektor) abbildet. */
export function quatFromUnitVectors(from: Vec3, to: Vec3, out: Quat): Quat {
  let r = from.x * to.x + from.y * to.y + from.z * to.z + 1;
  if (r < 1e-6) { // entgegengesetzt: beliebige senkrechte Achse
    r = 0;
    if (Math.abs(from.x) > Math.abs(from.z)) { out.x = -from.y; out.y = from.x; out.z = 0; out.w = r; }
    else { out.x = 0; out.y = -from.z; out.z = from.y; out.w = r; }
  } else {
    out.x = from.y * to.z - from.z * to.y; out.y = from.z * to.x - from.x * to.z; out.z = from.x * to.y - from.y * to.x; out.w = r;
  }
  const len = Math.hypot(out.x, out.y, out.z, out.w) || 1;
  out.x /= len; out.y /= len; out.z /= len; out.w /= len;
  return out;
}
export function slerp(a: Quat, b: Quat, t: number, out: Quat): Quat {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let ka = 1 - t, kb = t;
  if (cos < 0.9995) { const th = Math.acos(cos), s = Math.sin(th); ka = Math.sin((1 - t) * th) / s; kb = Math.sin(t * th) / s; }
  out.x = a.x * ka + bx * kb; out.y = a.y * ka + by * kb; out.z = a.z * ka + bz * kb; out.w = a.w * ka + bw * kb;
  return out;
}
