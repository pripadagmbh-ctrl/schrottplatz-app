/**
 * ALLE STRECKEN DES PLATZES — einmal aufgeschrieben, von drei Geraeten benutzt.
 *
 * Die Liste stand bis zum 16.09.2026 als `alleStrecken()` in
 * `test/fahrumriss.test.ts`. Sie ist dort hinausgezogen, weil der
 * Rangierknick-Waechter (`test/rangierknick.test.ts`) und das Messwerkzeug
 * (`tools/rangierknick.ts`) dieselbe Liste brauchen — und zwar dieselbe und
 * nicht eine zweite Abschrift. Zwei Abschriften laufen auseinander, sobald
 * eine Strecke dazukommt, und der zweite Waechter prueft dann eine Strecke
 * weniger, ohne es zu sagen (das ist die Lehre aus E-041).
 *
 * ZWEI SICHTEN AUF DASSELBE:
 *
 *   `alleStrecken()`  Einzelstrecken. Antwortet auf „faehrt irgendwo ein
 *                     Umriss durch ein Bauwerk".
 *   `fahrplaene()`    Ketten. Antwortet auf „wie gross ist der Knick am
 *                     UEBERGANG von einer Strecke zur naechsten" — und genau
 *                     dort steht der schaerfste (168,7 Grad beim Wechsel
 *                     `shiftPause` → `reverseIn`, E-073). Wer nur
 *                     Einzelstrecken ansieht, findet ihn nie.
 */
import { CONFIGS } from "../src/world/containers";
import {
  routeApproach,
  routeInRev,
  routeOut,
  bayApproach,
  bayInRev,
  bayOut,
  ROUTE_IN_FWD,
  PICKUP_IN_FWD,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  neueAbladestelle,
  neueAbholstelle,
  alleAbholPlaetze,
  SPEED,
} from "../src/delivery/routes";

/** Eine Etappe: ein Streckenzug, in einer Richtung, mit ihrem Fahrtempo. */
export interface Etappe {
  name: string;
  route: Array<[number, number]>;
  /** Rueckwaerts heisst: dieselbe Bahn, Kabine um 180 Grad gedreht. */
  rueckwaerts: boolean;
  /** Fahrtempo auf dieser Etappe (m/s) — aus `vehicles.update`. */
  tempo: number;
}

/** Was ein Fahrzeug einer Art von der Einfahrt bis zur Ausfahrt abfaehrt. */
export interface Fahrplan {
  name: string;
  /** Fahrzeugart, fuer `bedLenFor` — der Kipper ist der laengste Wagen. */
  kind: string;
  etappen: Etappe[];
}

/** Rueckwaerts faehrt der Fahrer langsamer — dieselbe Zahl wie in `vehicles.ts`. */
const RUECK_TEMPO = SPEED * 0.6;

/**
 * Jede Kette, die auf dem Platz wirklich gefahren wird.
 *
 * Die Reihenfolge ist die der Phasen in `vehicles.update`:
 * `in` → `approach` → (`shiftPause`) → `reverseIn` → … → `out`.
 * Die Pausen dazwischen stehen nicht in der Liste; fuer den Knick zaehlt nur,
 * welche Gierlage am Ende der einen und am Anfang der naechsten Etappe gilt.
 */
export function fahrplaene(): Fahrplan[] {
  neueAbladestelle();
  neueAbholstelle();
  const out: Fahrplan[] = [];
  for (const kind of ["pritsche", "kipper"]) {
    const v = kind === "kipper" ? "Kipper-" : "";
    out.push({
      name: `${kind} zum Abladeplatz`,
      kind,
      etappen: [
        { name: `${v}Einfahrt`, route: ROUTE_IN_FWD, rueckwaerts: false, tempo: SPEED },
        { name: `${v}Anfahrt`, route: routeApproach(), rueckwaerts: false, tempo: SPEED },
        { name: `${v}Rangieren`, route: routeInRev(), rueckwaerts: true, tempo: RUECK_TEMPO },
        { name: `${v}Ausfahrt`, route: routeOut(), rueckwaerts: false, tempo: SPEED },
      ],
    });
  }
  for (const p of alleAbholPlaetze()) {
    const wie = p.order ?? "gemischt";
    out.push({
      name: `Abholer ${wie}`,
      kind: "abholer",
      etappen: [
        {
          name: `Abholer ${wie} Einfahrt`,
          route: PICKUP_IN_FWD,
          rueckwaerts: false,
          tempo: SPEED,
        },
        { name: `Abholer ${wie} Anfahrt`, route: p.anfahrt, rueckwaerts: false, tempo: SPEED },
        {
          name: `Abholer ${wie} Rangieren`,
          route: p.rueckweg,
          rueckwaerts: true,
          tempo: RUECK_TEMPO,
        },
        { name: `Abholer ${wie} Ausfahrt`, route: p.ausfahrt, rueckwaerts: false, tempo: SPEED },
      ],
    });
  }
  for (const c of CONFIGS.filter((s) => s.lager === true)) {
    out.push({
      name: `Silo ${c.label}`,
      kind: "kipper",
      etappen: [
        { name: `Silo ${c.label} Einfahrt`, route: ROUTE_IN_FWD, rueckwaerts: false, tempo: SPEED },
        {
          name: `Silo ${c.label} Anfahrt`,
          route: bayApproach(c),
          rueckwaerts: false,
          tempo: SPEED,
        },
        {
          name: `Silo ${c.label} Rangieren`,
          route: bayInRev(c),
          rueckwaerts: true,
          tempo: RUECK_TEMPO,
        },
        { name: `Silo ${c.label} Ausfahrt`, route: bayOut(c), rueckwaerts: false, tempo: SPEED },
      ],
    });
  }
  return out;
}

/**
 * Alle Strecken einzeln — Name, Punkte, Fahrzeugart, rueckwaerts.
 *
 * Aus den Fahrplaenen abgeleitet, damit eine neue Strecke nur EINMAL
 * eingetragen werden muss. Dazu die Parkbuchten: Sie gehoeren zu keiner Kette
 * (der Fahrer setzt dort frei rangierend zurueck, `vehicles.parkRueck`), sind
 * aber Strecken, auf denen ein Umriss durch eine Mauer fahren koennte.
 */
export function alleStrecken(): Array<[string, Array<[number, number]>, string, boolean]> {
  const strecken: Array<[string, Array<[number, number]>, string, boolean]> = [];
  for (const f of fahrplaene()) {
    for (const e of f.etappen) strecken.push([e.name, e.route, f.kind, e.rueckwaerts]);
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
