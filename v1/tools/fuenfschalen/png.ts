/**
 * Pixelpuffer und PNG-Datei, ohne Browser und ohne WebGL.
 *
 * Herausgelöst aus `seitenbild.ts` und `schalenbild.ts`, die beide dieselben
 * 120 Zeilen CRC32-, Chunk- und Rasterer-Code trugen. Wer ein drittes Blatt
 * braucht, soll es nicht ein drittes Mal abschreiben.
 *
 * Das Verfahren ist dasselbe wie dort: orthogonale Projektion, flache
 * Schattierung je Dreieck (`tools/riss.ts`), Tiefenpuffer je Bildfeld. Der
 * Tiefenpuffer ist nicht optional — bei einer gekrümmten Schale, die sich in
 * der Projektion selbst überlappt, übermalen sich die Dreiecke sonst
 * gegenseitig, und im Bild entsteht eine Einschnürung, die in der Geometrie
 * nicht da ist (Befund 13.09.2026).
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

export class Blatt {
  readonly breite: number;
  readonly hoehe: number;
  private readonly bild: Uint8Array;
  private readonly tiefe: Float32Array;

  constructor(breite: number, hoehe: number, hintergrund: [number, number, number] = [0xee, 0xf0, 0xf3]) {
    this.breite = breite;
    this.hoehe = hoehe;
    this.bild = new Uint8Array(breite * hoehe * 3);
    this.tiefe = new Float32Array(breite * hoehe).fill(-1e30);
    for (let i = 0; i < breite * hoehe; i++) {
      this.bild[i * 3] = hintergrund[0];
      this.bild[i * 3 + 1] = hintergrund[1];
      this.bild[i * 3 + 2] = hintergrund[2];
    }
  }

  setze(x: number, y: number, f: [number, number, number]): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.breite || yi >= this.hoehe) return;
    const i = (yi * this.breite + xi) * 3;
    this.bild[i] = f[0];
    this.bild[i + 1] = f[1];
    this.bild[i + 2] = f[2];
  }

  rechteck(x0: number, y0: number, w: number, h: number, f: [number, number, number]): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.setze(x, y, f);
  }

  /** Tiefenpuffer eines Bildfelds zurücksetzen — sonst blenden sich die Felder aus. */
  frei(x0: number, y0: number, w: number, h: number): void {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= this.breite || y >= this.hoehe) continue;
        this.tiefe[y * this.breite + x] = -1e30;
      }
  }

  /** Linie, wahlweise gestrichelt (Strichlänge in Pixeln, 0 = durchgezogen). */
  linie(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    f: [number, number, number],
    strich = 0,
    dick = 1
  ): void {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      if (strich > 0 && Math.floor(i / strich) % 2 === 1) continue;
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      for (let d = 0; d < dick; d++) this.setze(x, y + d, f);
    }
  }

  dreieck(p: Array<[number, number]>, f: [number, number, number], z?: [number, number, number]): void {
    const [a, b, c] = p as [[number, number], [number, number], [number, number]];
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(this.breite - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(this.hoehe - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const fl = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(fl) < 1e-9) return;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / fl;
        const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / fl;
        const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / fl;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const i = y * this.breite + x;
        const zz = z ? z[1] * w0 + z[2] * w1 + z[0] * w2 : 0;
        if (z && zz < this.tiefe[i]!) continue;
        if (z) this.tiefe[i] = zz;
        this.setze(x, y, f);
      }
  }

  schreibe(ziel: string): void {
    const png = alsPng(this.bild, this.breite, this.hoehe);
    writeFileSync(ziel, png);
    console.log(`${ziel} ${this.breite}x${this.hoehe}, ${(png.length / 1024).toFixed(0)} kB`);
  }
}

export function farbe(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------------------------------------------------------------- PNG */

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
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const kopf = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(kopf), 0);
  return Buffer.concat([laenge, kopf, pruef]);
}

function alsPng(bild: Uint8Array, breite: number, hoehe: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; // Bittiefe
  ihdr[9] = 2; // Farbtyp RGB
  const roh = Buffer.alloc(hoehe * (breite * 3 + 1));
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 3 + 1)] = 0; // Filterbyte
    Buffer.from(bild.buffer, y * breite * 3, breite * 3).copy(roh, y * (breite * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(roh, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
