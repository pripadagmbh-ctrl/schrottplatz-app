/**
 * Bauteil- und Stellungsblatt des Mehrschalengreifers.
 *
 * Aufruf:  npx vite-node tools/greifer-blatt.ts
 * Ergebnis: docs/greifer-mehrschalen.svg
 */
import * as THREE from "three";
import { writeFileSync } from "node:fs";
import {
  baueAdapter,
  baueGelenkbolzen,
  baueKopf,
  baueLasche,
  baueRotator,
  baueSchalenkoerper,
  baueSpitze,
  baueVerschleissmesser,
  baueWange,
  baueZylinder,
  stoffe,
} from "../src/grapple/parts";
import { SCHALEN } from "../src/grapple/form";
import { baueGreifer } from "../src/grapple/rig";
import { BLICK_SCHRAEG, BLICK_VORN, blatt, feld, type Feld } from "./riss";

const st = stoffe();

function schaleKomplett(): THREE.Group {
  const g = new THREE.Group();
  g.add(baueSchalenkoerper(st));
  g.add(baueWange(st, -1));
  g.add(baueWange(st, 1));
  g.add(baueVerschleissmesser(st));
  g.add(baueSpitze(st));
  g.add(baueLasche(st));
  return g;
}

function zylinderKomplett(): THREE.Group {
  const g = new THREE.Group();
  const { rohr, stange } = baueZylinder(st);
  stange.scale.y = 0.42;
  stange.position.y = -0.34;
  g.add(rohr, stange);
  return g;
}

function greiferIn(oeffnung: number, drehung = 0): THREE.Object3D {
  const g = baueGreifer(stoffe());
  g.setOeffnung(oeffnung);
  g.setDrehung(drehung);
  return g.wurzel;
}

const teile: Feld[] = [
  { name: "1  ADAPTER", obj: baueAdapter(st), blick: BLICK_SCHRAEG },
  { name: "2  ROTATOR", obj: baueRotator(st), blick: BLICK_SCHRAEG },
  { name: "3  GRAPPLE_HEAD", obj: baueKopf(st), blick: BLICK_SCHRAEG },
  { name: "4  CYLINDER", obj: zylinderKomplett(), blick: BLICK_SCHRAEG, notiz: `x${SCHALEN}` },
  { name: "5  SHELL", obj: schaleKomplett(), blick: BLICK_SCHRAEG, notiz: `x${SCHALEN}` },
  { name: "6  PIVOT_PIN", obj: baueGelenkbolzen(st), blick: BLICK_SCHRAEG, notiz: `x${SCHALEN}` },
  { name: "8  WEAR_PLATE + TIP", obj: (() => {
      const g = new THREE.Group();
      g.add(baueVerschleissmesser(st));
      g.add(baueSpitze(st));
      return g;
    })(), blick: BLICK_SCHRAEG, notiz: `x${SCHALEN}` },
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

writeFileSync(
  "docs/greifer-mehrschalen.svg",
  blatt(
    breite,
    hoehe,
    "Mehrschalengreifer — Bauteile und Stellungen",
    `${SCHALEN} Schalen, halboffene Bauform (HO) nach SENNEBOGEN MG4.1 · Bogen 86° · ` +
      "Bolzenkreis 1,83 m · offen 2,73 m Spitzenweite · im Spiel x1,25",
    inhalt
  )
);
console.log("docs/greifer-mehrschalen.svg " + breite + "x" + hoehe);
