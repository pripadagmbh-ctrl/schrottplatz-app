/**
 * Blatt des zusammengebauten Greifers.
 *
 * Aufruf:  npx vite-node tools/greifer-blatt.ts
 * Ergebnis: docs/greifer-mehrschalen.svg
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { MASS, stoffe } from "../src/grapple/teile";
import { baueGreifer, huelle } from "../src/grapple/rig";
import { BLICK_SCHRAEG, BLICK_VORN, blatt, feld, type Feld } from "./riss";

function greiferIn(oeffnung: number): THREE.Object3D {
  const g = baueGreifer(stoffe());
  g.setOeffnung(oeffnung);
  return g.wurzel;
}

const felder: Feld[] = [
  { name: "geschlossen", obj: greiferIn(0), blick: BLICK_SCHRAEG },
  { name: "halb", obj: greiferIn(0.5), blick: BLICK_SCHRAEG },
  { name: "offen", obj: greiferIn(1), blick: BLICK_SCHRAEG },
  { name: "geschlossen, von vorn", obj: greiferIn(0), blick: BLICK_VORN },
  { name: "offen, von vorn", obj: greiferIn(1), blick: BLICK_VORN },
  { name: "offen, von unten", obj: greiferIn(1), blick: new THREE.Vector3(0.2, -1, 0.25) },
];

const SPALTEN = 3;
const ZELLE_B = 404;
const ZELLE_H = 430;
const LUFT = 12;
const RAND = 24;
const KOPFZEILE = 64;
const reihen = Math.ceil(felder.length / SPALTEN);
const breite = RAND * 2 + SPALTEN * ZELLE_B + (SPALTEN - 1) * LUFT;
const hoehe = RAND * 2 + KOPFZEILE + reihen * (ZELLE_H + LUFT);

let inhalt2 = "";
felder.forEach((f, i) => {
  inhalt2 += feld(
    f,
    RAND + (i % SPALTEN) * (ZELLE_B + LUFT),
    RAND + KOPFZEILE + Math.floor(i / SPALTEN) * (ZELLE_H + LUFT),
    ZELLE_B,
    ZELLE_H
  );
});

const zu = huelle(0);
const auf = huelle(1);
const komma = (x: number): string => x.toFixed(2).replace(".", ",");

writeFileSync(
  "docs/greifer-mehrschalen.svg",
  blatt(
    breite,
    hoehe,
    "5-Schalen-Mehrschalengreifer, 1.200 Liter — Zusammenbau",
    `Bolzenkreis Ø 0,68 m am Rand der Mitteltraverse (Ø ${komma(MASS.traverse.durchmesser)} m) · ` +
      `geschlossen Ø ${komma(zu.breite)} m · offen Ø ${komma(auf.breite)} m · ` +
      `Schalen 31° bis 58° · alle Maße aus der Positionsliste`,
    inhalt2
  )
);
console.log(
  `docs/greifer-mehrschalen.svg ${breite}x${hoehe}  ` +
    `zu ${zu.breite.toFixed(2)}x${zu.hoehe.toFixed(2)}  offen ${auf.breite.toFixed(2)}x${auf.hoehe.toFixed(2)}`
);
