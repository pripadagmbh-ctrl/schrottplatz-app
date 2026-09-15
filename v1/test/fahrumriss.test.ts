import { describe, it, expect } from "vitest";/**
 * Kein Fahrzeug faehrt durch eine Wand — gemessen am ECHTEN Umriss.
 *
 * Bis zum 15.09.2026 gab es diese Pruefung nicht. `test/fahrstrecke.test.ts`
 * haelt fest, DASS ein LKW ankommt, `test/collision.test.ts` prueft die
 * Wegpunkte als Punkte — beide sehen nicht, WO der Wagen durchfaehrt. Genau
 * dort ist der Fehler entstanden, den Patrick gemeldet hat: „Die fahren ja
 * durch die Wand, halb durch die Mulde."
 *
 * Gemessen wird der Umriss aus `vehicles.ts`/`vehicleModel.ts`: Der Ursprung
 * liegt in der Mitte der Ladeflaeche, nach hinten reicht der Wagen bis
 * −(bedLen/2 + 0,14) (Unterfahrschutz), nach vorn bis +(bedLen/2 + 1,90)
 * (Kabine), halbe Breite 1,55 m. Dieses Rechteck wird alle 50 cm entlang jeder
 * Route gesetzt — mit der Ausrichtung, die das Fahrzeug dort wirklich hat
 * (beim Rueckwaertsfahren um 180 Grad gedreht) — und mit dem Trennachsensatz
 * gegen jedes feste Bauwerk geprueft.
 *
 * Toleranz 1 cm: Darunter ist es Rundung, darueber steckt Blech in Beton.
 */

import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { CONFIGS } from "../src/world/containers";
import { BAGGER_STAND, VERLADE_STAND, abstandVomStand } from "../src/world/baggerstand";
import {
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
  TIP_APPROACH,
  TIP_IN_REV,
  TIP_OUT,
  bayApproach,
  bayInRev,
  bayOut,
  ROUTE_IN_FWD,
  PICKUP_IN_FWD,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  neueAbladestelle,
  neueAbholstelle,
} from "../src/delivery/routes";

const BED_HALF = 1.55;
function bedLenFor(k: string): number {
  return k === "kipper" ? 6.0 : 5.4;
}

type R = { cx: number; cz: number; hw: number; hd: number; rot: number };
function ecken(r: R): Array<[number, number]> {
  const c = Math.cos(r.rot);
  const s = Math.sin(r.rot);
  const out: Array<[number, number]> = [];
  for (const dx of [-r.hw, r.hw])
    for (const dz of [-r.hd, r.hd]) out.push([r.cx + dx * c + dz * s, r.cz - dx * s + dz * c]);
  return out;
}
function ueberlappung(r: R, o: { x: number; z: number; hw: number; hd: number }): number {
  const A = ecken(r);
  const B: Array<[number, number]> = [
    [o.x - o.hw, o.z - o.hd],
    [o.x + o.hw, o.z - o.hd],
    [o.x + o.hw, o.z + o.hd],
    [o.x - o.hw, o.z + o.hd],
  ];
  const achsen: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [Math.cos(r.rot), -Math.sin(r.rot)],
    [Math.sin(r.rot), Math.cos(r.rot)],
  ];
  let min = Infinity;
  for (const [ax, az] of achsen) {
    let a0 = Infinity;
    let a1 = -Infinity;
    let b0 = Infinity;
    let b1 = -Infinity;
    for (const [x, z] of A) {
      const p = x * ax + z * az;
      a0 = Math.min(a0, p);
      a1 = Math.max(a1, p);
    }
    for (const [x, z] of B) {
      const p = x * ax + z * az;
      b0 = Math.min(b0, p);
      b1 = Math.max(b1, p);
    }
    const ov = Math.min(a1, b1) - Math.max(a0, b0);
    if (ov <= 0) return 0;
    min = Math.min(min, ov);
  }
  return min;
}

function fahre(route: Array<[number, number]>, kind: string, reverse: boolean): R[] {
  const bl = bedLenFor(kind);
  const out: R[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i]!;
    const [bx, bz] = route[i + 1]!;
    const rot = Math.atan2(bx - ax, bz - az) + (reverse ? Math.PI : 0);
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= 1.0001; t += 0.5 / Math.max(len, 0.001)) {
      const tt = Math.min(1, t);
      const vorn = bl / 2 + 1.9;
      const hinten = -(bl / 2 + 0.14);
      const mitte = (vorn + hinten) / 2;
      out.push({
        cx: ax + (bx - ax) * tt + Math.sin(rot) * mitte,
        cz: az + (bz - az) * tt + Math.cos(rot) * mitte,
        hw: BED_HALF,
        hd: (vorn - hinten) / 2,
        rot,
      });
    }
  }
  return out;
}

describe("Kein Fahrzeugumriss schneidet ein festes Bauwerk", () => {
  it("auf keiner Route und in keinem Halt", () => {
    neueAbladestelle();
    neueAbholstelle();
    const lager = CONFIGS.filter((c) => c.lager === true);
    const strecken: Array<[string, Array<[number, number]>, string, boolean]> = [
      ["Einfahrt", ROUTE_IN_FWD, "pritsche", false],
      ["Anfahrt", routeApproach(), "pritsche", false],
      ["Rangieren", routeInRev(), "pritsche", true],
      ["Ausfahrt", routeOut(), "pritsche", false],
      ["Kipper-Anfahrt", TIP_APPROACH, "kipper", false],
      ["Kipper-Rangieren", TIP_IN_REV, "kipper", true],
      ["Kipper-Ausfahrt", TIP_OUT, "kipper", false],
      ["Abholer-Einfahrt", PICKUP_IN_FWD, "abholer", false],
      ["Abholer-Anfahrt", pickupApproach(), "abholer", false],
      ["Abholer-Rangieren", pickupInRev(), "abholer", true],
      ["Abholer-Ausfahrt", pickupOut(), "abholer", false],
    ];
    for (const c of lager) {
      strecken.push([`Silo ${c.label} Anfahrt`, bayApproach(c.z), "kipper", false]);
      strecken.push([`Silo ${c.label} Rangieren`, bayInRev(c.z), "kipper", true]);
      strecken.push([`Silo ${c.label} Ausfahrt`, bayOut(c.z), "kipper", false]);
    }
    for (const [i, p] of PARK_SLOTS.entries()) {
      strecken.push([
        `Parken ${i + 1}`,
        [
          [p[0], p[1] - PARK_ANFAHRT_M],
          [p[0], p[1]],
        ],
        "pritsche",
        true,
      ]);
    }
    const treffer = new Map<string, number>();
    for (const [name, route, kind, rev] of strecken) {
      for (const r of fahre(route, kind, rev)) {
        for (const o of STATIC_OBSTACLES) {
          const d = ueberlappung(r, o);
          if (d > 0.01) {
            const k = `${name} | ${o.label}`;
            treffer.set(k, Math.max(treffer.get(k) ?? 0, d));
          }
        }
      }
    }
    const zeilen = [...treffer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, d]) => `${d.toFixed(2)} m  ${k}`);
    expect(zeilen, ["Durchdringungen:", ...zeilen].join(" / ")).toEqual([]);
  });

});
