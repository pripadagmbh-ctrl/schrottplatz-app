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
  baueGreiferspitze,
  stoffe,
} from "../src/grapple/teile";
import { dreiecke } from "./riss";

const BREITE = 1180;
const HOEHE = 760;
/*
 * Tiefenpuffer. Ohne ihn bleibt nur das Malerverfahren, und bei einer
 * gekruemmten Schale, die sich in der Projektion selbst ueberlappt,
 * uebermalen sich die Dreiecke gegenseitig — im Bild entstand dadurch eine
 * Einschnuerung, die in der Geometrie nicht da war.
 */
const tiefe = new Float32Array(BREITE * HOEHE).fill(-1e30);
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
function dreieck(
  p: Array<[number, number]>,
  f: number[],
  z?: [number, number, number]
): void {
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
      if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) {
        const i = y * BREITE + x;
        const zz = z ? z[1]! * w0 + z[2]! * w1 + z[0]! * w2 : 0;
        if (!z || zz >= tiefe[i]!) {
          if (z) tiefe[i] = zz;
          setze(x, y, f);
        }
      }
    }
  }
}
function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Schale mit aufgesetzter Spitze, wie sie im Zusammenbau sitzt. */
function schale(): THREE.Group {
  /* Nur der Zahn, unrotiert — damit man seine eigene Form sieht. */
  return baueGreiferspitze(stoffe());
}

function male(
  blick: THREE.Vector3,
  x0: number,
  y0: number,
  w: number,
  h: number,
  umriss = false
): void {
  rechteck(x0, y0, w, h, [255, 255, 255]);
  // Tiefenpuffer je Bildfeld zuruecksetzen — sonst blenden sich die Felder aus
  for (let yy = y0; yy < y0 + h; yy++)
    for (let xx = x0; xx < x0 + w; xx++) tiefe[yy * BREITE + xx] = -1e30;
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
  /*
   * `umriss`: alles in einer Farbe. Dann bleibt nur die Silhouette uebrig —
   * dieselbe Darstellung wie eine technische Zeichnung, und Schattierung kann
   * keine Form vortaeuschen, die gar nicht da ist.
   */
  for (const t of tr)
    dreieck(
      t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      umriss ? [0x33, 0x37, 0x3b] : rgb(t.farbe),
      t.ecken
    );
}

/* Seitenansicht gross links, die beiden anderen klein rechts daneben */
const GROSS = Math.floor(BREITE * 0.56);
const KLEIN = BREITE - GROSS - 30;
male(new THREE.Vector3(1, 0, 0), 10, 10, GROSS, HOEHE - 20); // genau von der Seite
male(new THREE.Vector3(0, 0, 1), GROSS + 20, 10, KLEIN, Math.floor((HOEHE - 30) / 2));
male(
  new THREE.Vector3(0.75, 0.3, 1),
  GROSS + 20,
  20 + Math.floor((HOEHE - 30) / 2),
  KLEIN,
  Math.floor((HOEHE - 30) / 2)
);

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
  "docs/zahn.png",
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
);
console.log("docs/zahn.png geschrieben");
/* Masse des Zahns, damit das Bild nicht allein steht */
import { MASS } from "../src/grapple/teile";
const bb = new THREE.Box3().setFromObject(schale());
console.log(
  `Zahn: ${( (bb.max.x - bb.min.x) * 1000).toFixed(0)} mm breit, ` +
    `${((bb.max.y - bb.min.y) * 1000).toFixed(0)} mm lang, ` +
    `${((bb.max.z - bb.min.z) * 1000).toFixed(0)} mm tief ` +
    `(Positionsliste ${MASS.spitze.breite * 1000} x ${MASS.spitze.laenge * 1000} x ${MASS.spitze.dicke * 1000})`
);
