/**
 * WAS DAS EINLENKEN KOSTET — in Millisekunden, nicht in „kaum".
 *
 *     npx vite-node tools/lenkkosten.ts
 *
 * Zwei Zahlen:
 *
 *   je Bild          Der Zusatzaufwand von `advance`: ein `poseAuf` mehr und
 *                    zwei Winkelrechnungen. Das laeuft 60-mal je Sekunde.
 *   je Kehre EINMAL  Die Wahl der Drehrichtung (`drehRichtung`) tastet beide
 *                    Haelften des Kreises mit dem echten Umriss ab. Das
 *                    passiert nur beim Eindrehen — aber in EINEM Bild, und
 *                    ein Ruckler auf dem iPhone mini ist sichtbar.
 */
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { drehRichtung } from "../src/delivery/lenkung";
import { fahrzeugUmriss, umrissUeberlappung, poseAuf } from "../src/delivery/umriss";
import { bedLenFor } from "../src/delivery/routes";

const bedLen = bedLenFor("kipper");
const tiefeBei = (g: number): number => {
  const b = fahrzeugUmriss({ x: 6.3, z: -17.5, rot: g }, bedLen);
  let t = 0;
  for (const o of STATIC_OBSTACLES) {
    const d = umrissUeberlappung(b, o);
    if (d > t) t = d;
  }
  return t;
};

// Warmlaufen, sonst misst man den Uebersetzer.
for (let i = 0; i < 200; i++) drehRichtung(2.944, 0, tiefeBei);
let t0 = performance.now();
const N = 2000;
for (let i = 0; i < N; i++) drehRichtung(2.944, 0, tiefeBei);
const jeKehre = (performance.now() - t0) / N;

const route: Array<[number, number]> = [
  [-27.5, 22.5],
  [-27, 16],
  [-21, 10],
  [-12, 4],
  [-4, -4],
  [4, -6],
  [6.3, -17.5],
];
for (let i = 0; i < 20000; i++) poseAuf(route, (i % 60) * 0.8, false);
t0 = performance.now();
const M = 200000;
for (let i = 0; i < M; i++) poseAuf(route, (i % 60) * 0.8, false);
const jeBild = (performance.now() - t0) / M;

console.log(`Vorausschau je Bild (ein poseAuf): ${(jeBild * 1000).toFixed(2)} Mikrosekunden`);
console.log(`Drehrichtung je Kehre (einmalig):  ${jeKehre.toFixed(3)} ms`);
console.log(
  `Bauwerke in der Liste: ${STATIC_OBSTACLES.length}; ` +
    "Kehren je Zyklus: 1 (Rangieren) bis 2 (Silo-Fahrten)"
);
