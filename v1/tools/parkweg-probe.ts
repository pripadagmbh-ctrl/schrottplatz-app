/**
 * WELCHER ABZWEIGPUNKT FUEHRT FREI ZUM WARTEPLATZ?
 *
 * Die Zahl hinter `routes.routeToPark` (E-098). Ein Wagen, der zum Warteplatz
 * will, faehrt seine Ausfahrt und biegt irgendwann ab. Nur: WO? Diese Probe
 * haelt jeden Punkt jeder Ausfahrt einmal als Abzweig hin und misst mit dem
 * echten Fahrzeugumriss, wie tief die letzte Etappe — vom Abzweig zur Bucht —
 * in ein Bauwerk fuehrt.
 *
 * ERGEBNIS vom 17.09.2026, fuenf Ausfahrten mal drei Buchten: Der jeweils
 * NAECHSTGELEGENE Streckenpunkt ist in allen 15 Faellen frei (0,00 m). Der
 * letzte waere es nicht — vom Tor (−22 | 40) aus 0,60 m Nordwand Ost, von der
 * Waage (−27,5 | 22,5) aus 0,55 bis 0,60 m Betriebsgebaeude.
 *
 * Aufruf:  npx vite-node tools/parkweg-probe.ts
 */
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import {
  routeOut,
  bayOut,
  pickupOut,
  neueAbladestelle,
  neueAbholstelle,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  bedLenFor,
} from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";
import { umrisseEntlang, umrissUeberlappung } from "../src/delivery/umriss";

function tiefe(route: Array<[number, number]>, kind: string, rev: boolean): [number, string] {
  let t = 0;
  let wo = "";
  for (const u of umrisseEntlang(route, bedLenFor(kind), rev)) {
    for (const o of STATIC_OBSTACLES) {
      const d = umrissUeberlappung(u, o);
      if (d > t) {
        t = d;
        wo = o.label;
      }
    }
  }
  return [t, wo];
}

neueAbladestelle();
neueAbholstelle();
const ausfahrten: Array<[string, Array<[number, number]>, string]> = [
  ["Abladeplatz", routeOut(), "kipper"],
  ["Abholer", pickupOut(), "abholer"],
];
for (const c of CONFIGS.filter((s) => s.lager === true)) {
  ausfahrten.push([`Silo ${c.label}`, bayOut(c), "kipper"]);
}

for (const [name, aus, kind] of ausfahrten) {
  for (const [i, slot] of PARK_SLOTS.entries()) {
    const bucht: [number, number] = [slot[0], slot[1] - PARK_ANFAHRT_M];
    const zeilen: string[] = [];
    for (let k = 0; k < aus.length; k++) {
      const [t, wo] = tiefe([aus[k]!, bucht], kind, false);
      const d = Math.hypot(aus[k]![0] - bucht[0], aus[k]![1] - bucht[1]);
      zeilen.push(
        `    k=${k} (${aus[k]![0].toFixed(1)}|${aus[k]![1].toFixed(1)}) d=${d.toFixed(1)} letzteEtappe=${t.toFixed(2)} ${wo}`
      );
    }
    console.log(`${name} -> Warteplatz ${i + 1} (${slot[0]}|${slot[1]}), Bucht (${bucht[0]}|${bucht[1]})`);
    console.log(zeilen.join("\n"));
  }
}
for (const [i, slot] of PARK_SLOTS.entries()) {
  const bucht: [number, number] = [slot[0], slot[1] - PARK_ANFAHRT_M];
  const [t, wo] = tiefe([bucht, slot], "kipper", true);
  console.log(`ParkRueck ${i + 1}: ${t.toFixed(2)} ${wo}`);
}
