/**
 * Zwei Varianten nebeneinander: so weit offen wie heute, oder enger.
 *
 * Auftrag 14.09.2026 Nummer 3: „Die Öffnung zurücknehmen, von E/A 1,470 auf
 * rund 1,30 — also E von 3,227 m auf etwa 2,85 m." Dazu der Hinweis, dass darin
 * ein Widerspruch stecken kann, und die Ansage: „Wenn sich das bestätigt:
 * Priorität 1 gewinnt. Melde den Konflikt mit Zahlen und lass Auftrag 3 liegen."
 *
 * Er bestätigt sich (`tools/fuenfschalen/oeffnungsstudie.ts`). Gebaut ist
 * deshalb A. B ist gezeichnet und NICHT gebaut — damit die Entscheidung am Bild
 * fällt und nicht an meiner Zusammenfassung.
 *
 *   A  Anschlag 96,25°   E 3,232 m · E/A 1,476 · C/D 0,882 · Zahn 25,6 % unter dem Stempel
 *   B  Anschlag 70,00°   E 2,859 m · E/A 1,306 · C/D 1,012 · Zahn 36,7 % unter dem Stempel
 *
 * Von der Zeichnung abgelesen: E/A rund 1,30 · C/D rund 0,83 · Zahn rund 18 %.
 * B trifft das erste Verhältnis und entfernt sich von den beiden anderen.
 *
 * Der Zahn steht in BEIDEN lotrecht — seine Anstellung folgt dem Anschlag
 * (`zahnAnstellung(offen)`), der Vergleich ist also sauber.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/varianten.ts
 * Ergebnis: docs/f5-greifer-varianten.png
 */
import * as THREE from "three";
import { OFFEN, stoffe } from "../../src/fuenfschalen/teile";
import { FORM_BOGEN, Formsatz, baueGreifer } from "../../src/fuenfschalen/rig";
import { dreiecke } from "../riss";
import { Blatt, farbe } from "./png";

/**
 * Der engere Anschlag — 70°.
 *
 * Aus `oeffnungsstudie.ts`: Bei 70° ist E 2,859 m und E/A 1,306, also genau das
 * Verhältnis, das die Zeichnung zeigt. Alles andere am Formsatz bleibt stehen;
 * die geschlossene Form ist Punkt für Punkt dieselbe.
 */
const FORM_ENG: Formsatz = { ...FORM_BOGEN, offen: (70 * Math.PI) / 180 };

const BREITE = 1320;
const HOEHE = 1000;
const blatt = new Blatt(BREITE, HOEHE);
const BLICK = new THREE.Vector3(1, 0, 0);
const WEISS = farbe("#ffffff");
const ROT = farbe("#c83c3c");

/* Ein Maßstab für alle sechs Felder — sonst ist nichts vergleichbar. */
function huellmass(): { ax: number; bx: number; ay: number; by: number } {
  let ax = Infinity;
  let bx = -Infinity;
  let ay = Infinity;
  let by = -Infinity;
  for (const form of [FORM_BOGEN, FORM_ENG])
    for (const t of [0, 0.5, 1]) {
      const g = baueGreifer(stoffe(), form);
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

const H = huellmass();

/** Unterkante der zentralen unteren Einheit — die Höhenlinie im Bild. */
function stempelY(): number {
  const g = baueGreifer(stoffe(), FORM_BOGEN);
  g.wurzel.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(g.stempel).min.y;
}
const STEMPEL = stempelY();

function male(form: Formsatz, t: number, x0: number, y0: number, w: number, h: number): void {
  blatt.rechteck(x0, y0, w, h, WEISS);
  blatt.frei(x0, y0, w, h);
  const g = baueGreifer(stoffe(), form);
  g.setOeffnung(t);
  const s = Math.min((w - 40) / (H.bx - H.ax), (h - 40) / (H.by - H.ay));
  const cx = x0 + w / 2 - ((H.ax + H.bx) / 2) * s;
  const cy = y0 + h / 2 + ((H.ay + H.by) / 2) * s;
  for (const d of dreiecke(g.wurzel, BLICK))
    blatt.dreieck(
      d.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      farbe(d.farbe),
      d.ecken
    );
  blatt.linie(x0 + 6, cy - STEMPEL * s, x0 + w - 6, cy - STEMPEL * s, ROT, 4);
}

const FELD_W = Math.floor((BREITE - 4 * 8) / 3);
const FELD_H = Math.floor((HOEHE - 3 * 8) / 2);
[FORM_BOGEN, FORM_ENG].forEach((form, reihe) => {
  for (let i = 0; i < 3; i++) {
    male(form, i / 2, 8 + i * (FELD_W + 8), 8 + reihe * (FELD_H + 8), FELD_W, FELD_H);
  }
});

blatt.schreibe("docs/f5-greifer-varianten.png");
console.log(
  `  oben  A: Anschlag ${((OFFEN * 180) / Math.PI).toFixed(2)}° — gebaut\n` +
    `  unten B: Anschlag ${((FORM_ENG.offen * 180) / Math.PI).toFixed(2)}° — nur gezeichnet`
);
