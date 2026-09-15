/**
 * Die Gegenprobe zum Zusammenlegen (E-053): zwei Bilder, Pixel gegen Pixel.
 *
 * Oben der Greifer in EINZELTEILEN (217 Netze), unten der ZUSAMMENGELEGTE
 * (58 Netze), beide in denselben drei Stellungen, mit demselben Rasterer und
 * ohne Kantenglättung. Die Abnahme dieses Pakets ist, dass man die beiden
 * Reihen nicht unterscheiden kann — deshalb wird nicht nur gezeichnet, sondern
 * auch GEZÄHLT, wie viele Bildpunkte abweichen und wie stark.
 *
 * Warum das mehr ist als ein Blick: `test/verschmelzen.test.ts` beweist, dass
 * beide Fassungen dieselben Dreiecke tragen (auf 0,03 µm). Das Bild beweist
 * etwas anderes, nämlich dass auch die REIHENFOLGE nichts ausmacht — wo zwei
 * Flächen genau aufeinanderliegen, entscheidet sie, welche man sieht.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/verschmelz-bild.ts
 * Ergebnis: docs/f5-verschmelzen-2026-09-15.png
 */
import * as THREE from "three";
import { writeFileSync } from "node:fs";
import { stoffe } from "../../src/fuenfschalen/teile";
import { baueGreifer, baueGreiferInTeilen } from "../../src/fuenfschalen/rig";
import { Raster } from "./raster";

const BREITE = 1320;
const REIHE = 560;
const BLICK = new THREE.Vector3(0, 0, 1);
const PANEL = Math.floor((BREITE - 4 * 10) / 3);

function reihe(verschmolzen: boolean): Raster {
  const r = new Raster(BREITE, REIHE);
  for (let i = 0; i < 3; i++) {
    const g = verschmolzen ? baueGreifer(stoffe()) : baueGreiferInTeilen(stoffe());
    g.setOeffnung(i / 2);
    r.male(g.wurzel, BLICK, 10 + i * (PANEL + 10), 10, PANEL, REIHE - 20);
  }
  return r;
}

const vorher = reihe(false);
const nachher = reihe(true);

/* --- Wie viele Bildpunkte sind anders, und wie stark? --- */
let anders = 0;
let staerkste = 0;
for (let i = 0; i < BREITE * REIHE; i++) {
  let d = 0;
  for (let k = 0; k < 3; k++) {
    d = Math.max(d, Math.abs(vorher.bild[i * 3 + k]! - nachher.bild[i * 3 + k]!));
  }
  if (d > 0) anders++;
  staerkste = Math.max(staerkste, d);
}
const gesamt = BREITE * REIHE;
console.log(
  `abweichende Bildpunkte: ${anders} von ${gesamt} ` +
    `(${((anders / gesamt) * 100).toFixed(4)} %), staerkste Abweichung ${staerkste} von 255`
);

/* --- Beide Reihen untereinander in ein Blatt --- */
const blatt = new Raster(BREITE, REIHE * 2);
for (let y = 0; y < REIHE; y++) {
  for (let x = 0; x < BREITE; x++) {
    const q = (y * BREITE + x) * 3;
    const z1 = (y * BREITE + x) * 3;
    const z2 = ((y + REIHE) * BREITE + x) * 3;
    for (let k = 0; k < 3; k++) {
      blatt.bild[z1 + k] = vorher.bild[q + k]!;
      blatt.bild[z2 + k] = nachher.bild[q + k]!;
    }
  }
}
const ZIEL = "docs/f5-verschmelzen-2026-09-15.png";
const png = blatt.png();
writeFileSync(ZIEL, png);
console.log(`${ZIEL}  ${BREITE}x${REIHE * 2}, ${(png.length / 1024).toFixed(0)} kB`);
console.log("  obere Reihe: 217 Netze (Einzelteile) · untere Reihe: 58 Netze (zusammengelegt)");
