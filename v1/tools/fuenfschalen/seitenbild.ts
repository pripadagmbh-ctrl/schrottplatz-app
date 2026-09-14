/**
 * PNG-Bild des Greifers, ohne Browser und ohne WebGL.
 *
 * Die SVG-Blätter sind gut zum Vergleichen, aber mit 13.000 Dreiecken sind sie
 * mehrere Megabyte gross und werden nicht überall angezeigt. Hier werden die
 * Dreiecke stattdessen direkt in einen Pixelpuffer gemalt und als PNG
 * geschrieben — ein Bild, das jeder Betrachter zeigt, in 200 kB statt 4 MB.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/seitenbild.ts
 *           npx vite-node tools/fuenfschalen/seitenbild.ts flach
 * Ergebnis: docs/f5-greifer-seite.png  bzw.  docs/f5-greifer-seite-flach.png
 */
import * as THREE from "three";
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { stoffe } from "../../src/fuenfschalen/teile";
import { FORM_BOGEN, Formsatz, baueGreifer } from "../../src/fuenfschalen/rig";
import { dreiecke } from "../riss";

/**
 * Studie „flache Unterkante", 14.09.2026 — NICHT abgenommen, nur zum Ansehen.
 *
 * Aufgabe war: offen sollen die Unterkanten der fuenf Zinken und die des
 * Stempels in einer Ebene liegen. Mit der Kruemmung allein geht das nicht (die
 * Rechnung steht bei `Formsatz` in `rig.ts`). Es geht mit zwei Zahlen des
 * Formvertrags, und dieser Satz ist ihre Loesung:
 *
 *   Bolzen von r 0,590 auf 0,516 nach innen, Schalenversatz von 0,300 auf
 *   0,374 — die Summe bleibt 0,890, also bleibt die GESCHLOSSENE Form Punkt
 *   fuer Punkt dieselbe (Volumen, Huellkreis, Bauhoehe unveraendert).
 *   Schwenk von 96,25° auf 123°.
 *
 * Gemessen trifft er die Aufgabe: Zahnunterkante offen −1,655 gegen
 * Stempelunterkante −1,652 m, Differenz 3 mm (Ziel ±50 mm).
 *
 * Und er hat einen Preis, der hier stehen bleibt, bis Patrick entscheidet:
 *
 *   Sektor      35,3° von 36° (heute 24,0°) — 0,7° Luft zur Nachbarschale.
 *   Zylinder    kuerzeste Laenge 0,4385 m bei 0,42 m Rohr (heute 0,5405 m).
 *   Hebelarm    faellt bei 83 % Oeffnung auf 0,011 m (heute nie unter 0,092).
 *
 * Der letzte Punkt ist ein TOTPUNKT: Bei 102,4° Schwenk stehen Bolzen,
 * Zylinderaufnahme und Schalenauge auf einer Geraden, und die Schale liesse
 * sich mit keinem Druck weiterdrehen. Das ist keine Eigenheit dieses Satzes —
 * die Aufnahme sitzt ueber der Bolzenebene, und damit liegt der Totpunkt fuer
 * JEDE Loesung dieser Aufgabe bei rund 102…107° Schwenk, waehrend die flache
 * Unterkante mindestens 113° verlangt. Wer sie will, muss auch `OBERE_ANBINDUNG`
 * oder `ZYLINDER_AUFNAHME` versetzen — genau die Entscheidung, die im
 * Messprotokoll vom 14.09. als offener Punkt 1 steht.
 */
const FORM_FLACH: Formsatz = {
  drehpunktR: 0.516,
  versatz: 0.374,
  offen: (123 * Math.PI) / 180,
};

const FLACH = process.argv.slice(2).includes("flach");
const FORM = FLACH ? FORM_FLACH : FORM_BOGEN;
const ZIEL = FLACH ? "docs/f5-greifer-seite-flach.png" : "docs/f5-greifer-seite.png";

const BLICK = new THREE.Vector3(1, 0, 0);

/* ------------------------------------------------------------ Pixelpuffer */

const BREITE = 1320;
const HOEHE = 560;
const HINTERGRUND = [0xee, 0xf0, 0xf3];

/*
 * Tiefenpuffer. Ohne ihn bleibt nur das Malerverfahren, und bei einer
 * gekruemmten Schale, die sich in der Projektion selbst ueberlappt,
 * uebermalen sich die Dreiecke gegenseitig — im Bild entstand dadurch eine
 * Einschnuerung, die in der Geometrie nicht da war.
 */
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
function dreieck(
  p: Array<[number, number]>,
  farbe: number[],
  z?: [number, number, number]
): void {
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
        const zz = z ? z[1]! * w0 + z[2]! * w1 + z[0]! * w2 : 0;
        if (!z || zz >= tiefe[i]!) {
          if (z) tiefe[i] = zz;
          setze(x, y, farbe[0]!, farbe[1]!, farbe[2]!);
        }
      }
    }
  }
}

/* ----------------------------------------------------------- Greifer malen */

function farbeZuRgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Alle drei Felder im GLEICHEN Maßstab und auf derselben Höhenlinie.
 *
 * Vorher hat jedes Feld sich selbst eingepasst: Der offene Greifer ist der
 * flachste, wurde also am kleinsten gezeichnet, und die drei Bilder waren
 * untereinander nicht vergleichbar. Genau die Frage vom 14.09.2026 — liegen
 * die Zahnunterkanten offen auf einer Ebene mit dem Stempel? — kann man daran
 * nicht beantworten. Jetzt gilt für alle drei derselbe Maßstab, dieselbe
 * Nullhöhe, und eine dünne Linie markiert die Unterkante der zentralen unteren
 * Einheit.
 */
function huellmass(): { ax: number; bx: number; ay: number; by: number } {
  let ax = Infinity;
  let bx = -Infinity;
  let ay = Infinity;
  let by = -Infinity;
  for (const t of [0, 0.5, 1]) {
    const g = baueGreifer(stoffe(), FORM);
    g.setOeffnung(t);
    for (const d of dreiecke(g.wurzel, BLICK))
      for (const q of d.p) {
        ax = Math.min(ax, q[0]);
        bx = Math.max(bx, q[0]);
        ay = Math.min(ay, q[1]);
        by = Math.max(by, q[1]);
      }
  }
  return { ax, bx, ay, by };
}

/** Unterkante der zentralen unteren Einheit (Stempel) in Weltkoordinaten. */
function stempelUnterkante(): number {
  const g = baueGreifer(stoffe(), FORM);
  g.wurzel.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g.stempel);
  return b.min.y;
}

const HUELLE = huellmass();
const STEMPEL_Y = stempelUnterkante();

function male(oeffnung: number, x0: number, y0: number, w: number, h: number): void {
  rechteck(x0, y0, w, h, [255, 255, 255]);
  // Tiefenpuffer je Bildfeld zuruecksetzen — sonst blenden sich die Felder aus
  for (let yy = y0; yy < y0 + h; yy++)
    for (let xx = x0; xx < x0 + w; xx++) tiefe[yy * BREITE + xx] = -1e30;
  const g = baueGreifer(stoffe(), FORM);
  g.setOeffnung(oeffnung);
  /*
 * Blickrichtung +x: Damit steht die Schale bei Winkel 0 exakt in der
 * Bildebene — eine winkelfreie Seitenansicht (Ansage 13.09.2026: „du musst
 * die Spinne so drehen, dass du eine winkelfreie Seitenansicht bekommst").
 * Von vorn (+z) sieht man jede Schale schraeg, und schraege Ansichten haben
 * bei dieser Form schon mehrfach etwas vorgetaeuscht, was nicht da war.
 */
  const tr = dreiecke(g.wurzel, BLICK);
  const { ax, bx, ay, by } = HUELLE;
  const s = Math.min((w - 40) / (bx - ax), (h - 60) / (by - ay));
  const cx = x0 + w / 2 - ((ax + bx) / 2) * s;
  const cy = y0 + h / 2 + 12 + ((ay + by) / 2) * s;
  for (const t of tr) {
    dreieck(
      t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      farbeZuRgb(t.farbe),
      t.ecken
    );
  }
  /* Höhenlinie der Stempelunterkante — gestrichelt, damit sie nichts verdeckt. */
  const ly = Math.round(cy - STEMPEL_Y * s);
  for (let x = x0 + 6; x < x0 + w - 6; x++) if ((x >> 2) % 2 === 0) setze(x, ly, 200, 60, 60);
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
writeFileSync(ZIEL, png);
console.log(`${ZIEL} ${BREITE}x${HOEHE}, ${(png.length / 1024).toFixed(0)} kB`);
