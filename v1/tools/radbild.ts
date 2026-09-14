/**
 * PNG-Blatt vom Rad des Baggers — damit Patrick die FORM beurteilen kann.
 *
 * Gestalterisches entscheidet er am Bild, nicht am Messwert (Projektregel:
 * „Patrick entscheidet alles Gestalterische"). Dieses Blatt zeigt links das
 * alte Rad — einen Zylinder mit 20 Ecken — und rechts daneben das neue in drei
 * Ansichten: von der Seite, halb schräg und von vorn.
 *
 * Gemalt wird ohne Browser und ohne WebGL, mit demselben Rasterer wie
 * `tools/fuenfschalen/rasterbild.ts`.
 *
 * Aufruf:  npx vite-node tools/radbild.ts
 * Ergebnis: docs/messungen/2026-09-14_rad.png
 */
import * as THREE from "three";
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dreiecke } from "./riss";
import { baueRad, radGeometrien, radStoffe, RAD_R, RAD_B } from "../src/excavator/wheelParts";

const BREITE = 1400;
const HOEHE = 520;
const HINTERGRUND = [0xee, 0xf0, 0xf3];

const tiefe = new Float32Array(BREITE * HOEHE).fill(-1e30);
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
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
}

function dreieck(p: Array<[number, number]>, farbe: number[], z?: [number, number, number]): void {
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
      if (w0 >= -1e-4 && w1 >= -1e-4 && w2 >= -1e-4) {
        const i = y * BREITE + x;
        /*
         * WELCHES GEWICHT ZU WELCHER ECKE.
         *
         * w0 steht auf der Kante a→b, gehört also zur GEGENÜBERLIEGENDEN Ecke
         * c; w1 steht auf b→c und gehört zu a; w2 steht auf c→a und gehört
         * zu b.
         *
         * In `tools/fuenfschalen/rasterbild.ts`, von wo dieser Rasterer stammt,
         * ist diese Zuordnung um eine Ecke verdreht (dort steht
         * `z[1]*w0 + z[2]*w1 + z[0]*w2`). Die Tiefe im Inneren eines Dreiecks
         * ist damit falsch, und bei schräger Sicht auf große Flächen schlägt
         * das als Splitter durch — genau die grünen Späne, die am 14.09.2026
         * über der Felge standen und nicht in der Geometrie waren.
         */
        const zz = z ? z[2]! * w0 + z[0]! * w1 + z[1]! * w2 : 0;
        if (!z || zz >= tiefe[i]!) {
          if (z) tiefe[i] = zz;
          setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
        }
      }
    }
  }
}

function farbeZuRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ------------------------------------------------------- Ein kleines Alphabet */

/**
 * 5×7-Raster für Grossbuchstaben und Ziffern — gerade genug, um die Bildfelder
 * zu beschriften. Ohne Beschriftung müsste man raten, welches Feld was zeigt.
 */
const SCHRIFT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
  F: ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "11100", "10010", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "11110", "10000", "10000", "10000", "10000"],
  R: ["11110", "10001", "11110", "10100", "10010", "10001", "10001"],
  S: ["01111", "10000", "01110", "00001", "00001", "10001", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Z: ["11111", "00010", "00100", "01000", "10000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "01110", "10001", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function schreibe(text: string, x0: number, y0: number, gross: number, farbe: number[]): void {
  let x = x0;
  for (const z of text.toUpperCase()) {
    const muster = SCHRIFT[z] ?? SCHRIFT[" "]!;
    muster.forEach((zeile, ry) => {
      [...zeile].forEach((p, rx) => {
        if (p === "1") rechteck(x + rx * gross, y0 + ry * gross, gross, gross, farbe);
      });
    });
    x += 6 * gross;
  }
}

/* ------------------------------------------------------------- Räder bauen */

/** Das ALTE Rad, wie es bis zum 14.09.2026 gebaut wurde — zum Vergleich. */
function altesRad(): THREE.Object3D {
  const geo = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 20);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2b2e31 }));
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function neuesRad(): THREE.Object3D {
  const st = radStoffe(new THREE.MeshStandardMaterial({ color: 0x5bbf46 }));
  const g = new THREE.Group();
  g.add(baueRad(radGeometrien(), st, "VL", true));
  return g;
}

function male(
  obj: THREE.Object3D,
  blick: THREE.Vector3,
  titel: string,
  x0: number,
  y0: number,
  w: number,
  h: number
): void {
  rechteck(x0, y0, w, h, [255, 255, 255]);
  for (let yy = y0; yy < y0 + h; yy++)
    for (let xx = x0; xx < x0 + w; xx++) tiefe[yy * BREITE + xx] = -1e30;
  const tr = dreiecke(obj, blick);
  let ax = Infinity;
  let bx = -Infinity;
  let ay = Infinity;
  let by = -Infinity;
  for (const t of tr)
    for (const q of t.p) {
      if (q[0] < ax) ax = q[0];
      if (q[0] > bx) bx = q[0];
      if (q[1] < ay) ay = q[1];
      if (q[1] > by) by = q[1];
    }
  /*
   * ALLE Felder im selben Massstab: sonst sieht das neue Rad groesser aus als
   * das alte, obwohl der Durchmesser genau gleich geblieben ist — und genau
   * darueber soll das Bild ja nicht taeuschen.
   */
  const s = (h - 110) / (2 * RAD_R);
  const cx = x0 + w / 2 - ((ax + bx) / 2) * s;
  const cy = y0 + h / 2 + 18 + ((ay + by) / 2) * s;
  for (const t of tr)
    dreieck(
      t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      farbeZuRgb(t.farbe),
      t.ecken
    );
  schreibe(titel, x0 + 14, y0 + 12, 2, [0x33, 0x3a, 0x40]);
}

const alt = altesRad();
const neu = neuesRad();

/** Dreiecke unter einem Knoten — die Zahl gehört in die Beschriftung. */
function dreieckzahl(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((k) => {
    if (!(k instanceof THREE.Mesh)) return;
    const geo = k.geometry as THREE.BufferGeometry;
    const idx = geo.getIndex();
    const pos = geo.getAttribute("position");
    if (pos) n += Math.floor((idx ? idx.count : pos.count) / 3);
  });
  return n;
}
const altD = dreieckzahl(alt);
const neuD = dreieckzahl(neu);

const FELDER = 4;
const LUFT = 10;
const FB = Math.floor((BREITE - (FELDER + 1) * LUFT) / FELDER);
const FH = HOEHE - 2 * LUFT;

/*
 * Die Achse liegt in X. Ein Blick entlang X zeigt also das Rad von der Seite
 * des Baggers — so, wie man es im Spiel sieht. Ein Blick entlang Z zeigt die
 * Lauffläche, also das Profil.
 */
male(alt, new THREE.Vector3(1, 0.22, 0.45), `ALT - 1 TEIL, ${altD} DREIECKE`, LUFT, LUFT, FB, FH);
male(neu, new THREE.Vector3(1, 0.22, 0.45), `NEU - 3 TEILE, ${neuD} DREIECKE`, LUFT * 2 + FB, LUFT, FB, FH);
male(neu, new THREE.Vector3(1, 0.05, 0), "NEU - VON DER SEITE", LUFT * 3 + FB * 2, LUFT, FB, FH);
male(neu, new THREE.Vector3(0.2, 0.15, 1), "NEU - LAUFFLAECHE", LUFT * 4 + FB * 3, LUFT, FB, FH);

schreibe(
  `DURCHMESSER ${(2 * RAD_R).toFixed(2).replace(".", ",")} M - BREITE ${RAD_B.toFixed(2).replace(".", ",")} M - UNVERAENDERT`,
  LUFT + 14,
  HOEHE - 26,
  2,
  [0x55, 0x5c, 0x62]
);

/* -------------------------------------------------------------- PNG-Datei */

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
ihdr[8] = 8;
ihdr[9] = 2;

const roh = Buffer.alloc(HOEHE * (BREITE * 3 + 1));
for (let y = 0; y < HOEHE; y++) {
  roh[y * (BREITE * 3 + 1)] = 0;
  Buffer.from(bild.buffer, y * BREITE * 3, BREITE * 3).copy(roh, y * (BREITE * 3 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(roh, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
mkdirSync("docs/messungen", { recursive: true });
writeFileSync("docs/messungen/2026-09-14_rad.png", png);
console.log(
  `docs/messungen/2026-09-14_rad.png ${BREITE}x${HOEHE}, ${(png.length / 1024).toFixed(0)} kB`
);
