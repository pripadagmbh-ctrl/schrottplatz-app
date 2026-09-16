/**
 * Wie weit deckt sich die neue Schale (E-090) mit der alten?
 *
 * DIE ZAHL, AN DER PATRICK MISST, OB ETWAS PASSIERT IST. E-069 lag bei 98,5 %
 * und E-083 bei 70,7 % — beide Male sah der Greifer danach aus wie vorher.
 * Über 90 % heißt: es ist wieder nichts passiert.
 *
 * WIE GEMESSEN WIRD. Nicht am Schattenriss, sondern am QUERSCHNITT, Station für
 * Station — denn genau dort sitzt der Umbau. Der Schattenriss von der Seite
 * zeigt eine Schale, die beidseits der Mittellinie aufsteht, kaum anders als
 * eine flache; die Deckung wäre hoch und die Zahl wertlos. Der Querschnitt
 * zeigt es sofort.
 *
 * Gerechnet wird die Fläche, die beide Querschnitte gemeinsam haben, gegen die
 * Fläche, die sie zusammen belegen (Schnitt durch Vereinigung). Über die
 * Stationen gemittelt und mit dem Stationsabstand gewichtet ist das der Anteil
 * des Werkstoffs, der an derselben Stelle geblieben ist.
 *
 * DIE ALTE FORM wird hier aus ihren eigenen Formeln nachgebaut, nicht aus einem
 * alten Netz gelesen: Breite `HALB · verjuengung(k)`, Querschnitt nur die
 * Wölbung `(halb² − x²)/(2r)`, Haut `BLECH` nach innen. Das ist Zeile für Zeile
 * das, was bis zum 16.09.2026 in `baueGreiferschale` stand.
 *
 * Aufruf:  npx vite-node tools/schale-deckung.ts
 */
import {
  MASS,
  SCHALEN_ABSCHNITTE,
  ZU,
  halbbreiteBei,
  mittellinie,
  randhoehe,
} from "../src/fuenfschalen/teile";

const HALB = MASS.schale.breite / 2;
const BLECH = 0.045;

/** Die Breitenkurve, wie sie bis zum 16.09.2026 galt. */
const verjuengungAlt = (k: number): number =>
  1 - 0.7 * (Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k)) / SCHALEN_ABSCHNITTE) ** 1.3;

const BAHN = mittellinie(ZU);
const querRadius = (k: number): number => {
  const kk = Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k));
  const a = Math.floor(kk);
  const b = Math.min(SCHALEN_ABSCHNITTE, a + 1);
  const t = kk - a;
  return Math.max((BAHN[a]?.r ?? 0.1) * (1 - t) + (BAHN[b]?.r ?? 0.1) * t, 0.12);
};

/** Aussenflaeche des ALTEN Querschnitts an Station k. */
function wAlt(x: number, k: number): number {
  const halb = HALB * verjuengungAlt(k);
  return (halb * halb - x * x) / (2 * querRadius(k));
}
/** Aussenflaeche des NEUEN Querschnitts — dieselbe Formel wie im Bau. */
const WANGE_AB = 0.5;
const WANGE_ANTEIL = 0.3;
const WANGE_RAMPE = 1;
function wNeu(x: number, k: number): number {
  const halb = halbbreiteBei(k);
  const bogen = (halb * halb - x * x) / (2 * querRadius(k));
  const u = Math.min(1, Math.abs(x) / Math.max(halb, 1e-6));
  const auf = Math.max(0, (u - WANGE_AB) / (1 - WANGE_AB)) ** 2;
  const rampe = Math.min(1, Math.max(0, k) / WANGE_RAMPE);
  return bogen - auf * rampe * WANGE_ANTEIL * 2 * halb;
}

/**
 * Deckung zweier Querschnitte an Station k, als Flaechenanteil.
 * Gerastert in 0,5 mm — fein genug fuer 45 mm Blech.
 */
function deckungBei(k: number): { gemeinsam: number; zusammen: number } {
  const PX = 0.0005;
  const halbAlt = HALB * verjuengungAlt(k);
  const halbNeu = halbbreiteBei(k);
  const xMax = Math.max(halbAlt, halbNeu) + 0.01;
  let gemeinsam = 0;
  let zusammen = 0;
  for (let x = -xMax; x <= xMax; x += PX) {
    const inAlt = Math.abs(x) <= halbAlt;
    const inNeu = Math.abs(x) <= halbNeu;
    const aAlt = inAlt ? wAlt(x, k) : NaN;
    const aNeu = inNeu ? wNeu(x, k) : NaN;
    for (let w = -0.2; w <= 0.15; w += PX) {
      const drinAlt = inAlt && w >= aAlt && w <= aAlt + BLECH;
      const drinNeu = inNeu && w >= aNeu && w <= aNeu + BLECH;
      if (drinAlt && drinNeu) gemeinsam += PX * PX;
      if (drinAlt || drinNeu) zusammen += PX * PX;
    }
  }
  return { gemeinsam, zusammen };
}

console.log("Station\tBreite alt\tBreite neu\tRand neu\tDeckung");
let sumG = 0;
let sumZ = 0;
for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
  const { gemeinsam, zusammen } = deckungBei(k);
  sumG += gemeinsam;
  sumZ += zusammen;
  console.log(
    `${k}\t${(2 * HALB * verjuengungAlt(k) * 1000).toFixed(0)} mm\t\t` +
      `${(2 * halbbreiteBei(k) * 1000).toFixed(0)} mm\t\t` +
      `${(randhoehe(k) * 1000).toFixed(0)} mm\t\t` +
      `${((gemeinsam / zusammen) * 100).toFixed(1)} %`
  );
}
console.log(`\nDECKUNGSGLEICHHEIT ueber alle Stationen: ${((sumG / sumZ) * 100).toFixed(1)} %`);

/*
 * Die Deckung haengt NICHT vom Oeffnungsgrad ab: Der Umbau sitzt im
 * Querschnitt, und der Schwenk dreht jede Station starr um ihren Bolzen. Offen
 * wie geschlossen steht derselbe Querschnitt an derselben Station — die Zahl
 * oben gilt fuer beide. Was sich mit dem Oeffnen aendert, ist die Lage im Raum,
 * und die ist bei beiden Formen dieselbe (die Mittellinie ist unangetastet).
 */
console.log(
  "\nOffen wie geschlossen dieselbe Zahl: Der Umbau sitzt im Querschnitt, und\n" +
    "die Mittellinie ist unangetastet — jede Station dreht starr um ihren Bolzen."
);
