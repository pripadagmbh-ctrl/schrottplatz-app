/**
 * Ein Bild aus einer three.js-Szene, ohne Browser und ohne WebGL.
 *
 * Herausgeloest aus `tools/fuenfschalen/rasterbild.ts`, damit mehr als ein
 * Werkzeug dasselbe Bild bekommen kann — gebraucht wurde das zuerst fuer die
 * Gegenprobe des Zusammenlegens (E-053): zwei Bilder desselben Greifers,
 * einmal in Einzelteilen und einmal zusammengelegt, Pixel gegen Pixel.
 *
 * Verfahren: orthogonale Projektion, flache Schattierung je Dreieck
 * (`tools/riss.ts`), Tiefenpuffer je Bildfeld. Kein Antialiasing — das ist
 * Absicht: Ein Bild ohne Kantenglaettung laesst sich Pixel fuer Pixel
 * vergleichen, ein geglaettetes nicht.
 */
import * as THREE from "three";
import { deflateSync } from "node:zlib";
import { dreiecke } from "../riss";

const HINTERGRUND = [0xee, 0xf0, 0xf3];

export class Raster {
  readonly breite: number;
  readonly hoehe: number;
  readonly bild: Uint8Array;
  private readonly tiefe: Float32Array;

  constructor(breite: number, hoehe: number, hintergrund: number[] = HINTERGRUND) {
    this.breite = breite;
    this.hoehe = hoehe;
    this.bild = new Uint8Array(breite * hoehe * 3);
    this.tiefe = new Float32Array(breite * hoehe).fill(-1e30);
    for (let i = 0; i < breite * hoehe; i++) {
      this.bild[i * 3] = hintergrund[0]!;
      this.bild[i * 3 + 1] = hintergrund[1]!;
      this.bild[i * 3 + 2] = hintergrund[2]!;
    }
  }

  private setze(x: number, y: number, r: number, g: number, b: number): void {
    if (x < 0 || y < 0 || x >= this.breite || y >= this.hoehe) return;
    const i = (y * this.breite + x) * 3;
    this.bild[i] = r;
    this.bild[i + 1] = g;
    this.bild[i + 2] = b;
  }

  rechteck(x0: number, y0: number, w: number, h: number, farbe: number[]): void {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) this.setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
    }
  }

  /** Dreieck fuellen, Scanline ueber die Bounding Box, Tiefe je Ecke. */
  private dreieck(
    p: Array<[number, number]>,
    farbe: number[],
    z?: [number, number, number]
  ): void {
    const [a, b, c] = p as [[number, number], [number, number], [number, number]];
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(this.breite - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(this.hoehe - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const flaeche = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(flaeche) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / flaeche;
        const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / flaeche;
        const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / flaeche;
        if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) {
          const i = y * this.breite + x;
          const zz = z ? z[1]! * w0 + z[2]! * w1 + z[0]! * w2 : 0;
          if (!z || zz >= this.tiefe[i]!) {
            if (z) this.tiefe[i] = zz;
            this.setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
          }
        }
      }
    }
  }

  /**
   * Ein Objekt in ein Bildfeld malen, eingepasst mit 20 px Rand.
   *
   * Der Massstab kann vorgegeben werden — sonst wird jedes Feld fuer sich
   * eingepasst, und zwei Felder mit verschieden grossen Objekten stehen
   * nebeneinander, als waeren sie gleich gross.
   */
  male(
    obj: THREE.Object3D,
    blick: THREE.Vector3,
    x0: number,
    y0: number,
    w: number,
    h: number
  ): void {
    this.rechteck(x0, y0, w, h, [255, 255, 255]);
    /* Tiefenpuffer je Bildfeld zuruecksetzen — sonst blenden sich die Felder aus. */
    for (let yy = y0; yy < y0 + h; yy++) {
      for (let xx = x0; xx < x0 + w; xx++) this.tiefe[yy * this.breite + xx] = -1e30;
    }
    const tr = dreiecke(obj, blick);
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
      this.dreieck(
        t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
        farbeZuRgb(t.farbe),
        t.ecken
      );
    }
  }

  /** Das Bild als PNG-Datei (RGB, Filterbyte 0, deflate). */
  png(): Buffer {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.breite, 0);
    ihdr.writeUInt32BE(this.hoehe, 4);
    ihdr[8] = 8; // Bittiefe
    ihdr[9] = 2; // Farbtyp RGB
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    const roh = Buffer.alloc(this.hoehe * (this.breite * 3 + 1));
    for (let y = 0; y < this.hoehe; y++) {
      roh[y * (this.breite * 3 + 1)] = 0;
      Buffer.from(this.bild.buffer, y * this.breite * 3, this.breite * 3).copy(
        roh,
        y * (this.breite * 3 + 1) + 1
      );
    }
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(roh, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

export function farbeZuRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

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
