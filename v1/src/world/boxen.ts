/**
 * Gedrehte Rechtecke — die Standfläche beweglicher Dinge (Wunsch 11.09.2026).
 *
 * Die festen Bauten stehen achsparallel in obstacles.ts und kommen damit aus.
 * Fahrzeuge nicht: Ein LKW steht schräg auf dem Hof, und wer nur seinen
 * Umkreis prüft, sperrt entweder den halben Platz oder lässt den Bagger
 * mitten durch die Ladefläche fahren. Beides war zu sehen — der Bagger und
 * der Radlader fuhren durch stehende LKW hindurch.
 */
export interface Box {
  x: number;
  z: number;
  /** halbe Ausdehnung quer zur Blickrichtung */
  hw: number;
  /** halbe Ausdehnung in Blickrichtung */
  hd: number;
  /** Drehung um die Hochachse (three.js rotation.y) */
  rot: number;
}

/**
 * Liegt (px, pz) in der Box? `pad` erweitert sie nach allen Seiten — damit
 * prüft man einen Körper mit Radius, ohne ihn selbst zu drehen.
 *
 * Gerechnet wird im Koordinatensystem der Box: Bei three.js zeigt die lokale
 * +z-Achse nach vorn, und die Drehung bildet sie auf
 * (sin rot, cos rot) ab. Die Rückrechnung dreht den Punkt entsprechend
 * zurück.
 */
export function inBox(px: number, pz: number, b: Box, pad = 0): boolean {
  const dx = px - b.x;
  const dz = pz - b.z;
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= b.hw + pad && Math.abs(lz) <= b.hd + pad;
}

/** Erste Box, in der der Punkt liegt — oder null. */
export function findeBox(px: number, pz: number, boxen: Box[], pad = 0): Box | null {
  for (const b of boxen) if (inBox(px, pz, b, pad)) return b;
  return null;
}

/**
 * Richtung, die aus einer Box herausführt: senkrecht zu der Kante, die am
 * nächsten liegt. Damit schiebt sich ein Fahrzeug nicht in die Box hinein,
 * sondern gleitet an ihr entlang.
 */
export function ausBox(px: number, pz: number, b: Box, out: { x: number; z: number }): void {
  const dx = px - b.x;
  const dz = pz - b.z;
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  // Welche Kante ist näher? Der kürzere Weg hinaus gewinnt.
  const rausX = b.hw - Math.abs(lx);
  const rausZ = b.hd - Math.abs(lz);
  let nx = 0;
  let nz = 0;
  if (rausX < rausZ) nx = Math.sign(lx) || 1;
  else nz = Math.sign(lz) || 1;
  // zurück in Weltkoordinaten drehen
  out.x = nx * c + nz * s;
  out.z = -nx * s + nz * c;
}
