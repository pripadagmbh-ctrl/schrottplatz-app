/**
 * Wächter für die ganzen Strecken, nicht nur ihre Stützpunkte.
 *
 * `test/collision.test.ts` prüft die Ecken der Routen. Ein LKW fährt aber
 * nicht von Ecke zu Ecke, sondern die Strecke dazwischen ab und tastet dabei
 * mit 1,40 m nach festen Bauten (`isBlockedByBuilding`). Ein Bauwerk, das nur
 * die Mitte eines Abschnitts streift, hält ihn genauso auf — und feste Bauten
 * kennen keine Aufgeben-Regel: Was sie versperren, bleibt versperrt.
 *
 * Anlass ist der Umbau vom Abend des 14.09.2026: Der Abladeplatz ist in die
 * Südostecke gezogen, und die Rückwärtsstrecke läuft dort 16 m an der
 * Müllmulde entlang.
 */
import { describe, it, expect } from "vitest";
import { hitsObstacle } from "../src/world/obstacles";
import {
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
  bayApproach,
  bayInRev,
  bayOut,
} from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";

/** Derselbe Tastradius, mit dem die Fahrzeuge prüfen. */
const TASTRADIUS = 1.4;

function strecke(name: string, punkte: Array<[number, number]>): void {
  for (let i = 0; i < punkte.length - 1; i++) {
    const [ax, az] = punkte[i]!;
    const [bx, bz] = punkte[i + 1]!;
    const laenge = Math.hypot(bx - ax, bz - az);
    const schritte = Math.max(2, Math.ceil(laenge / 0.25));
    for (let k = 0; k <= schritte; k++) {
      const t = k / schritte;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const o = hitsObstacle(x, z, TASTRADIUS);
      expect(
        o,
        `${name}: bei (${x.toFixed(2)} | ${z.toFixed(2)}) steht ${o?.label} im Weg`
      ).toBeNull();
    }
  }
}

describe("Jede Fahrstrecke ist auf ganzer Länge frei", () => {
  const silos = CONFIGS.filter((c) => c.lager === true);

  const routen: Array<[string, Array<[number, number]>]> = [
    ["Einfahrt", ROUTE_IN_FWD],
    ["Händler-Anfahrt", routeApproach()],
    ["Händler-Rückwärts", routeInRev()],
    ["Händler-Ausfahrt", routeOut()],
    ["Abholer-Anfahrt", pickupApproach()],
    ["Abholer-Rückwärts", pickupInRev()],
    ["Abholer-Ausfahrt", pickupOut()],
  ];
  /*
   * Der Kipper faehrt seit E-029 DIESELBEN drei Strecken wie die Pritsche —
   * eine eigene Spur hat er nicht mehr. Sie stehen deshalb nur noch einmal in
   * der Liste; ein zweiter Eintrag pruefte dieselben Punkte ein zweites Mal.
   */

  for (const [name, punkte] of routen) {
    it(`${name}`, () => strecke(name, punkte));
  }

  /*
   * Die Silo-Anfahrten enden IN der Mulde — dort ist das Bauwerk das Ziel
   * und kein Hindernis. Geprüft wird deshalb nur die Gasse davor.
   */
  for (const c of silos) {
    it(`Silo-Gasse vor ${c.label}`, () => {
      /*
       * MIT DEM DATENSATZ, nicht mit `c.z`. Hier stand bis zum 15.09.2026
       * `bayApproach(c.z)` — seit E-028 nimmt die Funktion den ganzen
       * Container. Eine Zahl hat kein `.facing` und kein `.z`, also kamen
       * Strecken mit `undefined`/`NaN` heraus, und jeder Vergleich mit NaN ist
       * falsch: Der Wächter hat monatelang nichts geprüft. Die Tests laufen
       * ohne `tsc` (tsconfig sammelt nur `src`), deshalb fängt das kein Typ ab.
       */
      const an = bayApproach(c);
      for (const [x, z] of an) expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
      strecke(`Anfahrt ${c.label}`, an.slice(0, an.length - 1));
      const aus = bayOut(c);
      for (const [x, z] of aus) expect(Number.isFinite(x) && Number.isFinite(z)).toBe(true);
      strecke(`Ausfahrt ${c.label}`, aus.slice(1));
      // Und das letzte Stück in die Mulde hinein steht wenigstens in der Spur
      expect(bayInRev(c).length).toBe(2);
    });
  }
});
