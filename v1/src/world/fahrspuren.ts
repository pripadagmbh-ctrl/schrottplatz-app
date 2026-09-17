/**
 * Wo die Fahrzeuge fahren — als Frage, die das Platzpersonal stellen kann.
 *
 * Anlass (Auftrag 17.09.2026): „Prüf, dass Lambert die Fahrspuren nicht
 * blockiert." Die Spuren selbst stehen in `delivery/routes.ts`, und die
 * Überwachung auf liegenden Schrott in `delivery/laneWatch.ts` — dort aber in
 * einer privaten Methode, die niemand sonst lesen kann. Statt sie abzuschreiben
 * steht hier EINE Funktion, die dieselben Streckenzüge mit derselben Geometrie
 * (`weg.ts`, `abstandZurStrecke`) abfragt.
 *
 * Wichtig für das Verständnis: Ein LKW hält NICHT wegen Lambert an. Die
 * Fahrzeugverwaltung fragt ihn nirgends ab — sie kennt nur liegenden Schrott
 * (`BLOCKING_MASS_KG`) und andere Fahrzeuge. Lambert kann den Betrieb also gar
 * nicht zum Stehen bringen; was er kann, ist im Bild stehen, während ein Wagen
 * durch ihn hindurchfährt. Genau dagegen ist diese Abfrage da.
 */
import {
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  pickupApproach,
  pickupInRev,
} from "../delivery/routes";
import { abstandZurStrecke } from "./weg";

/**
 * Halbe Spurbreite in m.
 *
 * Dieselbe Zahl wie `LANE_HALF_W` in `delivery/laneWatch.ts` (dort privat) und
 * dieselbe Herkunft: so viel Platz braucht ein LKW. Zum Vergleich: die
 * Ladefläche misst 1,35 m halbbreit (`BED_HALF_W`), der Rest ist der Rand, den
 * ein Fahrer lässt.
 */
export const SPUR_HALB = 2.6;

/** Alle Strecken, die frei bleiben müssen — bei jeder Abfrage frisch geholt. */
function spuren(): Array<[string, Array<[number, number]>]> {
  return [
    ["Einfahrt", ROUTE_IN_FWD],
    ["Zufahrt", routeApproach()],
    ["Abladeplatz", routeInRev()],
    ["Abholerspur", pickupApproach()],
    ["Verladeplatz", pickupInRev()],
  ];
}

/** Abstand von (x,z) zur nächsten Fahrspur, mit deren Namen. */
export function naechsteSpur(x: number, z: number): { name: string; abstand: number } {
  let name = "-";
  let abstand = Infinity;
  for (const [n, pts] of spuren()) {
    for (let i = 0; i < pts.length - 1; i++) {
      const d = abstandZurStrecke(x, z, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]);
      if (d < abstand) {
        abstand = d;
        name = n;
      }
    }
  }
  return { name, abstand };
}

/** Abstand zur nächsten Fahrspur in m. */
export function spurAbstand(x: number, z: number): number {
  return naechsteSpur(x, z).abstand;
}

/**
 * Liegt (x,z) auf einer Fahrspur?
 *
 * @param rand zusätzlicher Abstand, z. B. der halbe Umriss dessen, was dort
 *             abgelegt werden soll
 */
export function aufFahrspur(x: number, z: number, rand = 0): boolean {
  return spurAbstand(x, z) < SPUR_HALB + rand;
}
