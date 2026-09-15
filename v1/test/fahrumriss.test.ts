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
import { endlich, mindestens } from "./zahl";
// Kein Import aus `world/baggerstand` mehr: Seit E-029 rechnet dieser Waechter
// nicht mehr gegen den Baggerstand. Die drei Namen standen bis 15.09.2026 als
// tote Einfuhr hier und wurden von der neuen Typpruefung gemeldet (E-038).
import {
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
  bayApproach,
  bayInRev,
  bayOut,
  ROUTE_IN_FWD,
  PICKUP_IN_FWD,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  neueAbladestelle,
  neueAbholstelle,
  bedLenFor,
} from "../src/delivery/routes";

const BED_HALF = 1.55;

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

/**
 * Alle Strecken, die auf dem Platz wirklich gefahren werden.
 *
 * Steht als eigene Funktion da, seit ein zweiter Waechter dieselbe Liste
 * braucht (E-041, der Startplatz des Muellcontainers). Zwei Abschriften
 * derselben Liste laufen auseinander, sobald eine Route dazukommt — und der
 * zweite Waechter prueft dann eine Strecke weniger, ohne es zu sagen.
 */
function alleStrecken(): Array<[string, Array<[number, number]>, string, boolean]> {
  {
    neueAbladestelle();
    neueAbholstelle();
    const lager = CONFIGS.filter((c) => c.lager === true);
    const strecken: Array<[string, Array<[number, number]>, string, boolean]> = [
      ["Einfahrt", ROUTE_IN_FWD, "pritsche", false],
      ["Anfahrt", routeApproach(), "pritsche", false],
      ["Rangieren", routeInRev(), "pritsche", true],
      ["Ausfahrt", routeOut(), "pritsche", false],
      /*
       * DIESELBEN DREI STRECKEN NOCH EINMAL MIT DEM KIPPER (E-029).
       *
       * Er faehrt seit dem 15.09.2026 den Abladeplatz an wie alle anderen,
       * ist aber mit 6,00 m Ladeflaeche der LAENGSTE Wagen auf dem Platz —
       * 0,60 m mehr als die Pritsche, also 0,30 m mehr nach jeder Seite. Wer
       * nur die Pritsche abfaehrt, prueft die Strecke, auf der nichts
       * passiert.
       */
      ["Kipper-Anfahrt", routeApproach(), "kipper", false],
      ["Kipper-Rangieren", routeInRev(), "kipper", true],
      ["Kipper-Ausfahrt", routeOut(), "kipper", false],
      ["Abholer-Einfahrt", PICKUP_IN_FWD, "abholer", false],
      ["Abholer-Anfahrt", pickupApproach(), "abholer", false],
      ["Abholer-Rangieren", pickupInRev(), "abholer", true],
      ["Abholer-Ausfahrt", pickupOut(), "abholer", false],
    ];
    for (const c of lager) {
      strecken.push([`Silo ${c.label} Anfahrt`, bayApproach(c), "kipper", false]);
      strecken.push([`Silo ${c.label} Rangieren`, bayInRev(c), "kipper", true]);
      strecken.push([`Silo ${c.label} Ausfahrt`, bayOut(c), "kipper", false]);
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
    return strecken;
  }
}

describe("Kein Fahrzeugumriss schneidet ein festes Bauwerk", () => {
  it("auf keiner Route und in keinem Halt", () => {
    const strecken = alleStrecken();
    /*
     * ERST PRUEFEN, OB DIE STRECKE EINE IST.
     *
     * Am 15.09.2026 hat dieser Waechter zwei Stunden lang nichts gemeldet,
     * weil die Silo-Routen `NaN` enthielten: `bayApproach` bekam seit dem
     * Umbau einen Datensatz statt einer z-Koordinate, der Test uebergab
     * weiter `c.z` — und jeder Vergleich mit NaN ist falsch, also fand die
     * Trennachsenpruefung nie eine Ueberschneidung. Ein Test, der wegen
     * kaputter Eingaben gruen ist, ist schlimmer als keiner.
     *
     * Seit dem 15.09.2026 sieht `tsc` die Testordner an (E-038,
     * `tsconfig.test.json`) und faengt genau diesen Aufruf. Die Pruefung hier
     * bleibt trotzdem: Sie faengt, was erst zur Laufzeit `NaN` wird.
     *
     * Und die zweite Haelfte des Musters, die kein Typ faengt: Wieviele Faelle
     * sind es ueberhaupt? Ein Waechter, dessen Schleife leer blieb, meldet
     * dasselbe wie einer, der alles geprueft hat. Darum `mindestens(...)` —
     * Stand 15.09.2026 sind es 13 feste Strecken, drei je Lagersilo und eine
     * je Parkbucht.
     */
    mindestens(strecken.length, 20, "Fahrstrecken im Umrissbild");
    for (const [name, route] of strecken) {
      expect(route.length, `${name}: leere Strecke`).toBeGreaterThan(1);
      endlich(route, name);
    }
    const treffer = new Map<string, number>();
    /** Wieviele Fahrzeugumrisse tatsaechlich gegen Bauten gerechnet wurden. */
    let geprueft = 0;
    for (const [name, route, kind, rev] of strecken) {
      for (const r of fahre(route, kind, rev)) {
        geprueft++;
        for (const o of STATIC_OBSTACLES) {
          const d = ueberlappung(r, o);
          if (d > 0.01) {
            const k = `${name} | ${o.label}`;
            treffer.set(k, Math.max(treffer.get(k) ?? 0, d));
          }
        }
      }
    }
    // Erst die Frage „wurde ueberhaupt gerechnet?", dann das Ergebnis. In der
    // Reihenfolge, weil „null Durchdringungen" sonst zweierlei heissen kann.
    mindestens(geprueft, 500, "gerechnete Fahrzeugumrisse");
    const zeilen = [...treffer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, d]) => `${d.toFixed(2)} m  ${k}`);
    expect(zeilen, ["Durchdringungen:", ...zeilen].join(" / ")).toEqual([]);
  });

  it("und keiner faehrt durch den Startplatz des Muellcontainers", () => {
    /*
     * DER MUELLCONTAINER STEHT IN KEINER FESTEN LISTE (E-034) — er ist
     * versetzbar und meldet seinen Umriss zur Laufzeit
     * (`ContainerManager.hindernisse`). Der Waechter oben laeuft deshalb an
     * ihm vorbei, ohne ihn je anzufassen: Bis E-041 stand in der Uebergabe
     * „kein Fahrzeugumriss schneidet den Container", geprueft hatte das
     * niemand.
     *
     * Hier wird er geprueft, und zwar nur an seinem STARTPLATZ. Wohin der
     * Spieler ihn stellt, ist seine Sache — auch mitten in die Einfahrt; dann
     * hupt der Fahrer, und das ist richtig so. Am Morgen aber soll kein Wagen
     * durch ihn hindurchfahren.
     *
     * Gemessen am 15.09.2026: 3,62 m Luft, am naechsten kommt ihm der Kipper
     * auf der Anfahrt.
     */
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    expect(muell.kind, "der MUELL ist kein versetzbarer Container mehr").toBe("rolloff");
    expect(
      Number.isFinite(muell.x) && Number.isFinite(muell.z),
      `Startplatz (${muell.x} | ${muell.z}) ist keine Koordinate`
    ).toBe(true);
    const platz = {
      x: muell.x,
      z: muell.z,
      hw: muell.size[0] / 2,
      hd: muell.size[1] / 2,
      label: "MUELL Startplatz",
    };
    const treffer = new Map<string, number>();
    let schritte = 0;
    for (const [name, route, kind, rev] of alleStrecken()) {
      for (const r of fahre(route, kind, rev)) {
        schritte++;
        const d = ueberlappung(r, platz);
        if (d > 0.01) treffer.set(name, Math.max(treffer.get(name) ?? 0, d));
      }
    }
    // Ohne diese Zeile waere der Test gruen, wenn die Streckenliste leer waere.
    expect(schritte, "keine einzige Fahrzeuglage geprueft").toBeGreaterThan(500);
    const zeilen = [...treffer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, d]) => `${d.toFixed(2)} m  ${k}`);
    expect(zeilen, ["Durchfahrten durch den Container:", ...zeilen].join(" / ")).toEqual([]);
  });
});
