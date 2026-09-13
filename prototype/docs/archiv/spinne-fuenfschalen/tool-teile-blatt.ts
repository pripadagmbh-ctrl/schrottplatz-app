/**
 * Teileblatt nach der Explosionszeichnung — jede Position einzeln.
 *
 * Aufruf:  npx vite-node tools/teile-blatt.ts
 * Ergebnis: docs/greifer-teile.svg
 *
 * Bewusst kein Zusammenbau: „erst mal nur die Einzelteile, die du verwenden
 * wuerdest". Jedes Teil steht allein, mit Stueckzahl und Abmessung — so laesst
 * es sich neben die Positionsliste legen und Zeile fuer Zeile abhaken.
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import {
  MASS,
  baueGreiferschale,
  baueMitteltraverse,
  baueStempel,
  einzelteile,
  stoffe,
} from "../src/grapple/teile";
import { BLICK_SCHRAEG, BLICK_VORN, blatt, feld, type Feld } from "./riss";

const teile = einzelteile();
const felder: Feld[] = teile.map((t) => ({
  name: t.name,
  obj: t.teil,
  blick: BLICK_SCHRAEG,
  notiz: t.anzahl > 1 ? "x" + t.anzahl : undefined,
}));

const SPALTEN = 4;
const ZELLE_B = 300;
const ZELLE_H = 250;
const LUFT = 12;
const RAND = 24;
const KOPFZEILE = 64;
const DETAIL_H = 420;
const reihen = Math.ceil(felder.length / SPALTEN);
const bauB = SPALTEN * ZELLE_B + (SPALTEN - 1) * LUFT;
const breite = RAND * 2 + bauB;
const hoehe = RAND * 2 + KOPFZEILE + reihen * (ZELLE_H + LUFT) + DETAIL_H + LUFT;

/*
 * Detailzeile, wie auf der Zeichnung: Die beiden grossen Teile bekommen eigene
 * Ansichten. In der Uebersicht sind Augen, Naehte und Aufnahmen zu klein, um
 * sie zu beurteilen — und genau die sind der Auftrag.
 */
const st = stoffe();
const details: Feld[] = [
  { name: "Detail 06 — von innen", obj: baueGreiferschale(st), blick: new THREE.Vector3(0, 0.05, -1) },
  { name: "Detail 06 — von der Seite", obj: baueGreiferschale(st), blick: new THREE.Vector3(1, 0.12, 0.1) },
  { name: "Detail 09 — Stempel", obj: baueStempel(st), blick: BLICK_VORN },
  { name: "Detail 09 — von unten", obj: baueStempel(st), blick: new THREE.Vector3(0.25, -1, 0.25) },
];

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
const yDetail = RAND + KOPFZEILE + reihen * (ZELLE_H + LUFT);
const detailB = (bauB - 3 * LUFT) / 4;
details.forEach((f, i) => {
  inhalt2 += feld(f, RAND + i * (detailB + LUFT), yDetail, detailB, DETAIL_H);
});

const komma = (x: number): string => x.toFixed(2).replace(".", ",");

writeFileSync(
  "docs/greifer-teile.svg",
  blatt(
    breite,
    hoehe,
    "5-Schalen-Mehrschalengreifer, 1.200 Liter — Einzelteile",
    `${teile.length} Positionen nach der Explosionszeichnung · ` +
      `Mitteltraverse ${komma(MASS.traverse.breite)} m · Stempel ${komma(MASS.stempel.breite)} m · ` +
      `Schale ${komma(MASS.schale.laenge)} × ${komma(MASS.schale.breite)} × ` +
      `${komma(MASS.schale.tiefe)} m · ` +
      `Gesamt geschlossen ${komma(MASS.gesamt.hoehe)} × ${komma(MASS.gesamt.breite)} m · ` +
      "noch nicht zusammengebaut",
    inhalt2
  )
);
console.log(`docs/greifer-teile.svg ${breite}x${hoehe}, ${teile.length} Positionen`);
