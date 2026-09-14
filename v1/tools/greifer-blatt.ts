/**
 * Bauteil- und Stellungsblatt des Fünfzinken-Mehrschalengreifers.
 *
 * Aufruf:  npx vite-node tools/greifer-blatt.ts
 * Ergebnis: docs/greifer-mehrschalen.svg
 */
import * as THREE from "three";
import { writeFileSync } from "node:fs";
import {
  baueAufhaengung,
  baueGelenkbolzen,
  baueMittelstueck,
  baueRotator,
  baueSchale,
  baueZylinder,
  stoffe,
} from "../src/grapple/parts";
import { GELENKRING, GROESSTE_TIEFE, SCHALEN, SEGMENTE, clawSpan, OFFEN } from "../src/grapple/form";
import { baueGreifer } from "../src/grapple/rig";
import { BLICK_SCHRAEG, BLICK_VORN, blatt, feld, type Feld } from "./riss";

const st = stoffe();

function zylinderKomplett(): THREE.Group {
  const g = new THREE.Group();
  const { rohr, stange } = baueZylinder(st);
  rohr.scale.y = 0.28;
  rohr.position.y = -0.14;
  stange.scale.y = 0.3;
  stange.position.y = -0.29;
  g.add(rohr, stange);
  return g;
}

function greiferIn(oeffnung: number): THREE.Object3D {
  const g = baueGreifer(stoffe());
  g.setOeffnung(oeffnung);
  return g.wurzel;
}

const teile: Feld[] = [
  { name: "01/02  ADAPTER", obj: baueAufhaengung(st), blick: BLICK_SCHRAEG },
  { name: "03  ROTATOR", obj: baueRotator(st), blick: BLICK_SCHRAEG },
  { name: "06/07  MITTELSTUECK", obj: baueMittelstueck(st), blick: BLICK_SCHRAEG },
  { name: "04  ZYLINDER", obj: zylinderKomplett(), blick: BLICK_SCHRAEG, notiz: `x${SCHALEN}` },
  {
    name: "08/09/10  GREIFERSCHALE",
    obj: baueSchale(st, 0, "01"),
    blick: BLICK_SCHRAEG,
    notiz: `x${SCHALEN}`,
  },
  { name: "11  GELENKBOLZEN", obj: baueGelenkbolzen(st), blick: BLICK_SCHRAEG, notiz: `x${SCHALEN}` },
];

const stellungen: Feld[] = [
  { name: "geschlossen", obj: greiferIn(0), blick: BLICK_SCHRAEG },
  { name: "halb", obj: greiferIn(0.5), blick: BLICK_SCHRAEG },
  { name: "offen", obj: greiferIn(1), blick: BLICK_SCHRAEG },
  { name: "offen, von vorn", obj: greiferIn(1), blick: BLICK_VORN },
];

const SPALTEN = 4;
const ZELLE_B = 300;
const ZELLE_H = 240;
const LUFT = 12;
const RAND = 24;
const KOPFZEILE = 64;
const GROSS_H = 430;
const reihen = Math.ceil(teile.length / SPALTEN);
const bauB = SPALTEN * ZELLE_B + (SPALTEN - 1) * LUFT;
const breite = RAND * 2 + bauB;
const hoehe = RAND * 2 + KOPFZEILE + reihen * (ZELLE_H + LUFT) + GROSS_H + LUFT;

let inhalt = "";
teile.forEach((f, i) => {
  inhalt += feld(
    f,
    RAND + (i % SPALTEN) * (ZELLE_B + LUFT),
    RAND + KOPFZEILE + Math.floor(i / SPALTEN) * (ZELLE_H + LUFT),
    ZELLE_B,
    ZELLE_H
  );
});
const yGross = RAND + KOPFZEILE + reihen * (ZELLE_H + LUFT);
const grossB = (bauB - 3 * LUFT) / 4;
stellungen.forEach((f, i) => {
  inhalt += feld(f, RAND + i * (grossB + LUFT), yGross, grossB, GROSS_H);
});

const komma = (x: number): string => x.toFixed(2).replace(".", ",");

writeFileSync(
  "docs/greifer-mehrschalen.svg",
  blatt(
    breite,
    hoehe,
    `${SCHALEN}-Zinken-Mehrschalengreifer — Bauteile und Stellungen`,
    `Sichelkralle aus ${SEGMENTE} Segmenten · Gelenkring ${komma(2 * GELENKRING)} m · ` +
      `offen ${komma(clawSpan(OFFEN))} m Spitzenweite · ` +
      `tiefste Spitze ${komma(GROESSTE_TIEFE)} m · ` +
      `dieselbe Geometrie wie die Spinne im Spiel`,
    inhalt
  )
);
console.log("docs/greifer-mehrschalen.svg " + breite + "x" + hoehe);
