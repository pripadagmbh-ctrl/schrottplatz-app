/**
 * PNG-Bild des Greifers, ohne Browser und ohne WebGL.
 *
 * Die SVG-Blätter sind gut zum Vergleichen, aber mit 13.000 Dreiecken sind sie
 * mehrere Megabyte gross und werden nicht überall angezeigt. Hier werden die
 * Dreiecke stattdessen direkt in einen Pixelpuffer gemalt und als PNG
 * geschrieben — ein Bild, das jeder Betrachter zeigt, in 200 kB statt 4 MB.
 *
 * Aufruf:  npx vite-node tools/rasterbild.ts
 * Ergebnis: docs/greifer.png
 */
import * as THREE from "three";
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { stoffe } from "../src/grapple/teile";
import { baueGreifer } from "../src/grapple/rig";
import { dreiecke } from "./riss";

/* ------------------------------------------------------------ Pixelpuffer */

const BREITE = 1320;
const HOEHE = 560;
const HINTERGRUND = [0xee, 0xf0, 0xf3];

const bild = new Uint8Array(BREITE * HOEHE * 3);
for (let i = 0; i < BREITE * HOEHE; i++) {
  bild[i * 3] = HINTERGRUND[0]!;
  bild[i * 3 + 1] = HINTERGRUND[1]!;
  bild[i * 3 + 2] = HINTERGRUND[2]!;
}

function setze(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= BREITE || y >= HOEHE) return;
  const i = (y * BREITE + x) * 3;
  bild[i] = r;
  bild[i + 1] = g;
  bild[i + 2] = b;
}

function rechteck(x0: number, y0: number, w: number, h: number, farbe: number[]): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
  }
}

/**
 * Dreieck fuellen, mit Scanline ueber die Bounding Box.
 *
 * Kein Antialiasing und kein Tiefenpuffer: Die Dreiecke kommen schon von
 * hinten nach vorn sortiert, also reicht Uebermalen — dasselbe Verfahren wie
 * beim SVG-Blatt.
 */
function dreieck(p: Array<[number, number]>, farbe: number[]): void {
  const [a, b, c] = p as [[number, number], [number, number], [number, number]];
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(BREITE - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(HOEHE - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const flaeche = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(flaeche) < 1e-9) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / flaeche;
      const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / flaeche;
      const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / flaeche;
      if (w0 >= -0.0001 && w1 >= -0.0001 && w2 >= -0.0001) {
        setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
      }
    }
  }
}

/* ----------------------------------------------------------- Greifer malen */

function farbeZuRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function male(oeffnung: number, x0: number, y0: number, w: number, h: number): void {
  rechteck(x0, y0, w, h, [255, 255, 255]);
  const g = baueGreifer(stoffe());
  g.setOeffnung(oeffnung);
  const tr = dreiecke(g.wurzel, new THREE.Vector3(0, 0, 1));
  let ax = Infinity;
  let bx = -Infinity;
  let ay = Infinity;
  let by = -Infinity;
  for (const t of tr) {
    for (const q of t.p) {
      if (q[0] < ax) ax = q[0];
      if (q[0] > bx) bx = q[0];
      if (q[1] < ay) ay = q[1];
      if (q[1] > by) by = q[1];
    }
  }
  const s = Math.min((w - 40) / (bx - ax), (h - 60) / (by - ay));
  const cx = x0 + w / 2 - ((ax + bx) / 2) * s;
  const cy = y0 + h / 2 + 12 + ((ay + by) / 2) * s;
  for (const t of tr) {
    dreieck(
      t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      farbeZuRgb(t.farbe)
    );
  }
}

const PANEL = Math.floor((BREITE - 4 * 10) / 3);
["geschlossen", "halb", "offen"].forEach((_name, i) => {
  male(i / 2, 10 + i * (PANEL + 10), 10, PANEL, HOEHE - 20);
});

/* -------------------------------------------------------------- PNG-Datei */

/** CRC32, wie es der PNG-Standard vorschreibt. */
const CRC_TABELLE = (() => {
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
  for (const byte of buf) c = CRC_TABELLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const kopf = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(kopf), 0);
  return Buffer.concat([laenge, kopf, pruef]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(BREITE, 0);
ihdr.writeUInt32BE(HOEHE, 4);
ihdr[8] = 8; // Bittiefe
ihdr[9] = 2; // Farbtyp RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Jede Zeile bekommt ein Filterbyte 0 vorangestellt
const roh = Buffer.alloc(HOEHE * (BREITE * 3 + 1));
for (let y = 0; y < HOEHE; y++) {
  roh[y * (BREITE * 3 + 1)] = 0;
  Buffer.from(bild.buffer, y * BREITE * 3, BREITE * 3).copy(
    roh,
    y * (BREITE * 3 + 1) + 1
  );
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(roh, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync("docs/greifer.png", png);
console.log(`docs/greifer.png ${BREITE}x${HOEHE}, ${(png.length / 1024).toFixed(0)} kB`);
