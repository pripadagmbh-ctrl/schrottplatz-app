/**
 * Die Greiferschale allein, in den drei Ansichten, in denen man ihre Kontur
 * beurteilt — und mit der gemessenen Breite je Station daneben.
 *
 * Gebaut, weil die Seitenansicht der Schale die Stelle ist, an der die Form
 * beurteilt wird: oben am breitesten, nach unten nur schmaler. Im
 * Gesamtbild verdecken fuenf Schalen einander genau dort.
 *
 * Aufruf:  npx vite-node tools/schalenbild.ts
 * Ergebnis: docs/greiferschale.png
 */
import * as THREE from "three";
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import {
  SCHALEN_ABSCHNITTE,
  baueGreiferschale,
  baueGreiferspitze,
  schalenHalbbreite,
  schalenEnde,
  stoffe,
} from "../src/grapple/teile";
import { dreiecke } from "./riss";

const BREITE = 1180;
const HOEHE = 620;
const bild = new Uint8Array(BREITE * HOEHE * 3).fill(0xf2);

function setze(x: number, y: number, f: number[]): void {
  if (x < 0 || y < 0 || x >= BREITE || y >= HOEHE) return;
  const i = (y * BREITE + x) * 3;
  bild[i] = f[0]!;
  bild[i + 1] = f[1]!;
  bild[i + 2] = f[2]!;
}
function rechteck(x0: number, y0: number, w: number, h: number, f: number[]): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setze(x, y, f);
}
function dreieck(p: Array<[number, number]>, f: number[]): void {
  const [a, b, c] = p as [[number, number], [number, number], [number, number]];
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const x1 = Math.min(BREITE - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const y1 = Math.min(HOEHE - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const fl = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(fl) < 1e-9) return;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / fl;
      const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / fl;
      const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / fl;
      if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) setze(x, y, f);
    }
  }
}
function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Schale mit aufgesetzter Spitze, wie sie im Zusammenbau sitzt. */
function schale(): THREE.Group {
  const st = stoffe();
  const g = new THREE.Group();
  g.add(baueGreiferschale(st));
  const ende = schalenEnde();
  const sp = baueGreiferspitze(st);
  sp.position.set(0, ende.y, ende.z);
  sp.rotation.x = ende.th;
  g.add(sp);
  return g;
}

function male(blick: THREE.Vector3, x0: number, y0: number, w: number, h: number): void {
  rechteck(x0, y0, w, h, [255, 255, 255]);
  const tr = dreiecke(schale(), blick);
  let ax = Infinity;
  let bx = -Infinity;
  let ay = Infinity;
  let by = -Infinity;
  for (const t of tr)
    for (const q of t.p) {
      ax = Math.min(ax, q[0]);
      bx = Math.max(bx, q[0]);
      ay = Math.min(ay, q[1]);
      by = Math.max(by, q[1]);
    }
  const s = Math.min((w - 40) / (bx - ax), (h - 40) / (by - ay));
  const cx = x0 + w / 2 - ((ax + bx) / 2) * s;
  const cy = y0 + h / 2 + ((ay + by) / 2) * s;
  for (const t of tr)
    dreieck(
      t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      rgb(t.farbe)
    );
}

const P = Math.floor((BREITE - 4 * 10) / 3);
male(new THREE.Vector3(1, 0, 0), 10, 10, P, HOEHE - 20); // Seite
male(new THREE.Vector3(0, 0, 1), 20 + P, 10, P, HOEHE - 20); // von vorn
male(new THREE.Vector3(0.75, 0.3, 1), 30 + 2 * P, 10, P, HOEHE - 20); // schraeg

/* Breitenbalken unten in die vordere Ansicht: gemessen, nicht behauptet */
const balkenX = 30 + P;
for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
  const b = 2 * schalenHalbbreite(k);
  const y = HOEHE - 46 + 0;
  rechteck(
    Math.round(balkenX + (P - 40) / 2 - (b / 0.4) * ((P - 60) / 2)),
    y - k * 5,
    Math.round((b / 0.4) * (P - 60)),
    4,
    [0x2e, 0x7d, 0x32]
  );
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(typ: string, daten: Buffer): Buffer {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(daten.length, 0);
  const k = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(k), 0);
  return Buffer.concat([l, k, c]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(BREITE, 0);
ihdr.writeUInt32BE(HOEHE, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const roh = Buffer.alloc(HOEHE * (BREITE * 3 + 1));
for (let y = 0; y < HOEHE; y++)
  Buffer.from(bild.buffer, y * BREITE * 3, BREITE * 3).copy(roh, y * (BREITE * 3 + 1) + 1);
writeFileSync(
  "docs/greiferschale.png",
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
);
console.log("docs/greiferschale.png geschrieben");
for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++)
  console.log(`  Station ${k}: ${(2 * schalenHalbbreite(k)).toFixed(3)} m breit`);
