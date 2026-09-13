/**
 * Silhouettenblatt — die Glockenform gross und von vorn.
 *
 * Aufruf:  npx vite-node tools/silhouette.ts
 * Ergebnis: docs/greifer-silhouette.svg
 *
 * Drei Frontansichten nebeneinander, damit man die Form beurteilen kann:
 * oben schmal, nach unten aufgehend, unten rund. In der Schraegansicht des
 * Zusammenbaublatts geht genau das unter.
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { MASS, stoffe } from "../src/grapple/teile";
import { baueGreifer, huelle } from "../src/grapple/rig";
import { blatt, feld, type Feld } from "./riss";

function greiferIn(oeffnung: number): THREE.Object3D {
  const g = baueGreifer(stoffe());
  g.setOeffnung(oeffnung);
  return g.wurzel;
}

const VORN = new THREE.Vector3(0, 0, 1);
const felder: Feld[] = [
  { name: "geschlossen", obj: greiferIn(0), blick: VORN },
  { name: "halb", obj: greiferIn(0.5), blick: VORN },
  { name: "offen", obj: greiferIn(1), blick: VORN },
];

const ZELLE_B = 420;
const ZELLE_H = 700;
const LUFT = 14;
const RAND = 24;
const KOPFZEILE = 64;
const breite = RAND * 2 + 3 * ZELLE_B + 2 * LUFT;
const hoehe = RAND * 2 + KOPFZEILE + ZELLE_H;

let inhalt2 = "";
felder.forEach((f, i) => {
  inhalt2 += feld(f, RAND + i * (ZELLE_B + LUFT), RAND + KOPFZEILE, ZELLE_B, ZELLE_H);
});

const zu = huelle(0);
const auf = huelle(1);
const komma = (x: number): string => x.toFixed(2).replace(".", ",");

writeFileSync(
  "docs/greifer-silhouette.svg",
  blatt(
    breite,
    hoehe,
    "5-Schalen-Mehrschalengreifer — Silhouette von vorn",
    `Birnenform: Drehpunkte am Stempel, unten schaut er heraus · ` +
      `unten Schalenbauch Ø ${komma(zu.breite)} m · ` +
      `offen Ø ${komma(auf.breite)} m · ` +
      "die ganze Anlenkung bleibt im Schatten der Traverse",
    inhalt2
  )
);
console.log(`docs/greifer-silhouette.svg ${breite}x${hoehe}`);
