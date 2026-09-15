/**
 * Was der ehrliche Pruefkorridor NEU blockiert — in Zahlen.
 *
 * Gebaut am 15.09.2026 fuer E-054. Der Wagen wird auf jeder Strecke des
 * Platzes alle 25 cm gesetzt, und an jeder Stelle werden beide Korridore
 * befragt:
 *
 *   ALT  ein Punkt mit 1,40 m Radius auf der Mittellinie, vier Stellen
 *        zwischen 1,2 und 4,0 m VORAUS (`hitsObstacle`, Rechteck + Rand)
 *   NEU  der echte Umriss (1,55 m halbe Breite, 7,4 bis 8,0 m lang) an der
 *        aktuellen Lage und an drei Lagen bis 4,0 m voraus
 *
 * Gezaehlt wird, wie oft jeder von beiden anschlaegt — einmal nur gegen die
 * festen Bauwerke, und einmal mit einem versetzten Muellcontainer, wie ihn
 * der Spieler abstellt.
 *
 * Aufruf: npx vite-node tools/fahrumriss-vergleich.ts
 */
import { CONFIGS } from "../src/world/containers";
import { STATIC_OBSTACLES, setBuildingObstacles, hitsObstacle } from "../src/world/obstacles";
import {
  ROUTE_IN_FWD,
  PICKUP_IN_FWD,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  routeApproach,
  routeInRev,
  routeOut,
  bayApproach,
  bayInRev,
  bayOut,
  alleAbholPlaetze,
  neueAbladestelle,
  neueAbholstelle,
  bedLenFor,
} from "../src/delivery/routes";
import {
  fahrzeugUmriss,
  poseAuf,
  streckenLaenge,
  tiefsteDurchdringung,
  UMRISS_TOLERANZ,
} from "../src/delivery/umriss";

type Strecke = [string, Array<[number, number]>, string, boolean];

function strecken(): Strecke[] {
  neueAbladestelle();
  neueAbholstelle();
  const out: Strecke[] = [
    ["Einfahrt", ROUTE_IN_FWD, "pritsche", false],
    ["Anfahrt", routeApproach(), "pritsche", false],
    ["Rangieren", routeInRev(), "pritsche", true],
    ["Ausfahrt", routeOut(), "pritsche", false],
    ["Kipper-Anfahrt", routeApproach(), "kipper", false],
    ["Kipper-Rangieren", routeInRev(), "kipper", true],
    ["Kipper-Ausfahrt", routeOut(), "kipper", false],
    ["Abholer-Einfahrt", PICKUP_IN_FWD, "abholer", false],
  ];
  for (const p of alleAbholPlaetze()) {
    const w = p.order ?? "gemischt";
    out.push([`Abholer ${w} Anfahrt`, p.anfahrt, "abholer", false]);
    out.push([`Abholer ${w} Rangieren`, p.rueckweg, "abholer", true]);
    out.push([`Abholer ${w} Ausfahrt`, p.ausfahrt, "abholer", false]);
  }
  for (const c of CONFIGS.filter((s) => s.lager === true)) {
    out.push([`Silo ${c.label} Anfahrt`, bayApproach(c), "kipper", false]);
    out.push([`Silo ${c.label} Rangieren`, bayInRev(c), "kipper", true]);
    out.push([`Silo ${c.label} Ausfahrt`, bayOut(c), "kipper", false]);
  }
  for (const [i, p] of PARK_SLOTS.entries()) {
    out.push([
      `Parken ${i + 1}`,
      [
        [p[0], p[1] - PARK_ANFAHRT_M],
        [p[0], p[1]],
      ],
      "pritsche",
      true,
    ]);
  }
  return out;
}

/** Der alte Korridor: Punkt mit 1,40 m Rand, vier Stellen voraus. */
function altBlockiert(route: Array<[number, number]>, s: number, reverse: boolean): boolean {
  const a = poseAuf(route, s, reverse);
  const b = poseAuf(route, s + 4, reverse);
  for (let t = 0.3; t <= 1.001; t += 0.235) {
    if (hitsObstacle(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 1.4)) return true;
  }
  return false;
}

/** Der neue Korridor: echter Umriss, jetzige Lage und drei Lagen voraus. */
function neuBlockiert(
  route: Array<[number, number]>,
  s: number,
  reverse: boolean,
  bedLen: number,
  hind: readonly { x: number; z: number; hw: number; hd: number }[]
): boolean {
  const jetzt = tiefsteDurchdringung([fahrzeugUmriss(poseAuf(route, s, reverse), bedLen)], hind);
  const voraus: ReturnType<typeof fahrzeugUmriss>[] = [];
  for (let i = 1; i <= 3; i++) {
    voraus.push(fahrzeugUmriss(poseAuf(route, s + (4 * i) / 3, reverse), bedLen));
  }
  const tief = tiefsteDurchdringung(voraus, hind);
  return tief > UMRISS_TOLERANZ && tief > jetzt;
}

function laufe(titel: string): void {
  let stellen = 0;
  let alt = 0;
  let neu = 0;
  let nurNeu = 0;
  let nurAlt = 0;
  const wo = new Map<string, number>();
  for (const [name, route, kind, rev] of strecken()) {
    const bedLen = bedLenFor(kind);
    const len = streckenLaenge(route);
    const liste = aktuelleHindernisse();
    for (let s = 0; s <= len; s += 0.25) {
      stellen++;
      const a = altBlockiert(route, s, rev);
      const n = neuBlockiert(route, s, rev, bedLen, liste);
      if (a) alt++;
      if (n) neu++;
      if (n && !a) {
        nurNeu++;
        wo.set(name, (wo.get(name) ?? 0) + 1);
      }
      if (a && !n) nurAlt++;
    }
  }
  console.log(`\n${titel}`);
  console.log(`  Stellen geprueft        ${stellen}`);
  console.log(`  ALT blockiert           ${alt}`);
  console.log(`  NEU blockiert           ${neu}`);
  console.log(`  NUR NEU (neu blockiert) ${nurNeu}`);
  console.log(`  NUR ALT (falscher Halt) ${nurAlt}`);
  for (const [k, v] of [...wo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(v).padStart(4)} Stellen  ${k}`);
  }
}

/** Dieselbe Liste, die `vehicles.ts` benutzt — bewegliche zuerst. */
function aktuelleHindernisse(): Array<{ x: number; z: number; hw: number; hd: number }> {
  return [...beweglich, ...STATIC_OBSTACLES];
}
let beweglich: Array<{ x: number; z: number; hw: number; hd: number; top: number; label: string }> =
  [];

laufe("NUR FESTE BAUWERKE");

/*
 * Und derselbe Durchlauf mit einem versetzten Muellcontainer. Drei Stellen,
 * wie sie ein Spieler waehlt: neben der Rangierstrecke am Abladeplatz, neben
 * der Silo-Gasse, und neben der Anfahrt.
 */
const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
for (const [x, z, was] of [
  [3.05, -20.0, "neben der Rangierstrecke am Abladeplatz"],
  [-24.6, -7.0, "neben dem Verladeplatz Suedschenkel"],
  [-30.6, -10.0, "neben der Silo-Gasse West"],
] as Array<[number, number, string]>) {
  beweglich = [
    { x, z, hw: muell.size[0] / 2, hd: muell.size[1] / 2, top: 2.0, label: "MUELL versetzt" },
  ];
  setBuildingObstacles(beweglich);
  laufe(`MUELLCONTAINER ${was}  (${x} | ${z})`);
}
setBuildingObstacles([]);
beweglich = [];
