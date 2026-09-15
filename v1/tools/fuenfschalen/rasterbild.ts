/**
 * PNG-Bild des Greifers, ohne Browser und ohne WebGL.
 *
 * Die SVG-Blätter sind gut zum Vergleichen, aber mit 13.000 Dreiecken sind sie
 * mehrere Megabyte gross und werden nicht überall angezeigt. Hier werden die
 * Dreiecke stattdessen direkt in einen Pixelpuffer gemalt und als PNG
 * geschrieben — ein Bild, das jeder Betrachter zeigt, in 200 kB statt 4 MB.
 *
 * Der Rasterer selbst steht seit E-053 in `tools/fuenfschalen/raster.ts`;
 * hier steht nur noch, WAS gemalt wird. Herausgelöst wurde er, weil die
 * Gegenprobe des Zusammenlegens (`verschmelz-bild.ts`) dasselbe Bild braucht —
 * und zwei Rasterer nebeneinander hätten den Vergleich wertlos gemacht.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/rasterbild.ts
 * Ergebnis: docs/f5-greifer.png
 */
import * as THREE from "three";
import { writeFileSync } from "node:fs";
import { stoffe } from "../../src/fuenfschalen/teile";
import { baueGreifer } from "../../src/fuenfschalen/rig";
import { Raster } from "./raster";

const BREITE = 1320;
const HOEHE = 560;
const raster = new Raster(BREITE, HOEHE);

const PANEL = Math.floor((BREITE - 4 * 10) / 3);
["geschlossen", "halb", "offen"].forEach((_name, i) => {
  const g = baueGreifer(stoffe());
  g.setOeffnung(i / 2);
  raster.male(
    g.wurzel,
    new THREE.Vector3(0, 0, 1),
    10 + i * (PANEL + 10),
    10,
    PANEL,
    HOEHE - 20
  );
});

const png = raster.png();
writeFileSync("docs/f5-greifer.png", png);
console.log(`docs/f5-greifer.png ${BREITE}x${HOEHE}, ${(png.length / 1024).toFixed(0)} kB`);
