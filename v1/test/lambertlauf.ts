/**
 * EIN LAUFAPPARAT FÜR LAMBERTS AUFRÄUMEN — Wächter und Messwerkzeug teilen ihn.
 *
 * Stand bis 21.09.2026: Der Aufbau stand nur in `test/lambertAufraeumen.test.ts`.
 * Wer die Streuung messen wollte, hätte ihn abschreiben müssen — genau der
 * Fehler, den E-062 beim Kipper gekostet hat (zwei Geräte, zwei Wahrheiten).
 * Deshalb liegt er jetzt hier, wie `test/kipperlauf.ts` beim Kipper.
 *
 * WO DER ZUFALL SITZT (gemessen 21.09.2026, E-109). Drei `Math.random()` im
 * Produktivcode liegen auf Lamberts Weg:
 *
 *   `world/people.ts:1390`     PRUEF_INTERVALL_S, 3 bis 5 s bis zur nächsten
 *                              Arbeitssuche — wirkungslos, weil er nach jeder
 *                              abgelegten Fuhre sofort weitersucht
 *                              (`pruefUhr = naechstePruefung`)
 *   `world/scrapItems.ts:1647` die Gierlage eines frisch abgelegten Stücks —
 *                              gemessen ohne Wirkung auf den Ablauf
 *   `world/people.ts:1327/29`  DIE EINZIGE, DIE ZÄHLT: Er wirft die Fuhre aus
 *                              `mulde.size[2] + 0,9` = 3,90 m Höhe ab und
 *                              streut die Abwurfstelle um ±0,60 m
 *
 * Deshalb braucht der Wächter feste Saaten, aber kein grösseres Zeitbudget:
 * Über 60 Saaten liegen beide Stücke nach 22,1 s in der Mulde — auf die
 * Zehntelsekunde gleich, bei 120 s Budget. Eine Uhr reisst hier nichts.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager, type ScrapItem } from "../src/world/scrapItems";
import { StaffManager } from "../src/world/people";
import { ContainerManager, CONFIGS, bayHalb } from "../src/world/containers";
import { EventBus } from "../src/core/events";
import { WEIGH_X, WEIGH_Z, KAFFEE_POS } from "../src/world/yard";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { OFFICE_X } from "../src/world/office";
import { getMaterial } from "../src/materials/catalog";

export const ABFALLSILO = CONFIGS.find((c) => c.id === "c_rubble")!;

/** Fester Zufall — wortgleich zu `test/kipperlauf.ts`, damit beide Apparate gleich würfeln. */
export function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

/**
 * Ein Blatt Papier statt eines Browsers — wortgleich zu
 * `test/containerrueckgabe.test.ts`. Die Behälterschilder zeichnen sich auf ein
 * Canvas, und das gibt es in Node nicht.
 */
export function papierStattBrowser(): void {
  if (typeof (globalThis as { document?: unknown }).document !== "undefined") return;
  const ctx = new Proxy(
    {},
    {
      get: (_t, p) => (p === "measureText" ? () => ({ width: 10 }) : () => undefined),
      set: () => true,
    }
  );
  const canvas = { width: 256, height: 128, getContext: () => ctx, style: {} };
  (globalThis as { document?: unknown }).document = { createElement: () => canvas };
}

export interface Platz {
  staff: StaffManager;
  items: ItemManager;
  funk: string[];
  /** Sekunden simulierter Zeit seit dem Aufbau. */
  uhr: number;
  schritt: (sekunden: number, lkw?: THREE.Vector3 | null) => void;
  /** Schrittweise laufen, bis die Bedingung hält — gibt die Sekunde zurück oder null. */
  bisS: (bedingung: () => boolean, hoechstensS: number) => number | null;
  lege: (materialId: string, kg: number, x: number, z: number) => ScrapItem;
  imSilo: () => number;
  minBandAbstand: number;
  imBand: boolean;
}

export function baueAbfall(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  /*
   * DIE MULDE MUSS DA SEIN — das war die Ursache des unzuverlässigen Wächters
   * (E-109). Vorher stand hier nur ein Boden, und der Prüfcode zählte, was in
   * einem gedachten Rechteck um die Betonlego-Mulde liegt. Lambert wirft seine
   * Fuhre aber aus `mulde.size[2] + 0,9` = 3,90 m Höhe ab, gestreut um bis zu
   * ±0,60 m (`people.ts:1327`, `Math.random()`). Ohne Wände prallte das Stück
   * auf den nackten Boden und rutschte in rund einem von zwanzig Läufen über
   * die gedachte Kante hinaus — gemessen 2,95 m neben der Muldenmitte, also
   * 0,85 m ausserhalb einer Wand, die es gar nicht gab.
   *
   * Mit dem echten `ContainerManager` steht die Mulde da, wo sie im Spiel
   * steht, mitsamt Betonlego. Das ist zugleich das fehlende Kettenglied: Der
   * Wächter prüfte „in die Mulde gebracht", ohne dass eine Mulde vorhanden war.
   */
  papierStattBrowser();
  const container = new ContainerManager(scene, world, new EventBus());
  const staff = new StaffManager(
    scene,
    items,
    new THREE.Vector3(WEIGH_X, 0, WEIGH_Z),
    KAFFEE_POS,
    new THREE.Vector3(OFFICE_X + 4.5, 0, 25)
  );
  staff.setLoader(true);
  // Er wirft an die Stelle, an der der Behälter JETZT steht — er lässt sich ja
  // verschieben (`people.ts`, `getMuldenOrt`).
  staff.getMuldenOrt = (id) => container.ortVon(id);
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  staff.getExcavatorPos = () => bagger;
  const funk: string[] = [];
  staff.onFunk = (_wer, spruch) => funk.push(spruch);

  const dt = 1 / 60;
  const einBild = (lkw: THREE.Vector3 | null): void => {
    world.step();
    staff.update(dt, lkw);
    p.uhr += dt;
    const q = staff.lambertOrt;
    const r = Math.hypot(q.x - BAGGER_STAND.x, q.z - BAGGER_STAND.z);
    if (r >= SCHWENK_INNEN && r <= SCHWENK_AUSSEN) p.imBand = true;
  };

  const p: Platz = {
    staff,
    items,
    funk,
    uhr: 0,
    minBandAbstand: Infinity,
    imBand: false,
    lege: (materialId, kg, x, z) =>
      items.spawnScrap(
        materialId,
        kg,
        { kind: "box", dims: [0.7, 0.5, 0.7], color: getMaterial(materialId).color },
        new THREE.Vector3(x, 0.4, z)
      ),
    schritt: (sekunden, lkw = null) => {
      for (let i = 0; i < sekunden * 60; i++) einBild(lkw ?? null);
    },
    bisS: (bedingung, hoechstensS) => {
      for (let i = 0; i < hoechstensS * 60; i++) {
        einBild(null);
        if (bedingung()) return p.uhr;
      }
      return null;
    },
    /*
     * DRIN HEISST DRIN: im Grundriss der Mulde, nicht in einem Rechteck, das
     * 0,78 m darüber hinausragt. Bis E-109 stand hier `size[1]/2 + 0,5` bzw.
     * `size[0]/2 + 0,5` — ein handgerechneter Rahmen mit Zuschlag, der ein
     * Stück NEBEN der Mulde mitzählte. `bayHalb` ist dieselbe Rechnung, die
     * auch `people.ts` benutzt, und sie dreht mit der Öffnungsrichtung mit.
     */
    imSilo: () => {
      const { hw, hd } = bayHalb(ABFALLSILO);
      const o = container.ortVon(ABFALLSILO.id) ?? { x: ABFALLSILO.x, z: ABFALLSILO.z };
      return items.items.filter((it) => {
        const q = it.body.translation();
        return Math.abs(q.x - o.x) <= hw && Math.abs(q.z - o.z) <= hd;
      }).length;
    },
  };
  return p;
}

/** Die Mulde künstlich füllen: Stücke, die schon drinliegen (wie nach `recount`). */
export function fuelleSilo(p: Platz, kg: number): void {
  const it = p.lege("wood", kg, ABFALLSILO.x, ABFALLSILO.z);
  it.containerId = ABFALLSILO.id;
}

/** Die Lage des Wächters: zwei Abfallstücke, er soll beide in die Mulde bringen. */
export const ZWEI_STUECKE: Array<[string, number, number, number]> = [
  ["wood", 80, -14.0, -6.0],
  ["plastic", 40, -17.0, -3.0],
];

/**
 * Sechs feste Saaten für den Wächter.
 *
 * WARUM SECHS UND NICHT EINE: Mit einer Saat prüft man einen einzigen Wurf.
 * Warum überhaupt feste Saaten, wo der Lauf doch beinahe deterministisch ist —
 * `people.ts:1327` streut die Ablage um ±0,60 m aus `Math.random()`. Gemessen
 * (`tools/lambert-streuung.ts`, 200 Läufe mit echtem Zufall, 21.09.2026):
 * 199 von 200 haben nach 120 s beide Stücke in der Mulde, einer nicht — das
 * Stück springt über die offene Nordseite wieder heraus und bleibt 0,74 m
 * davor liegen. 0,5 % also. Ein Wächter, der bei jedem zwanzigsten Lauf des
 * Tages zufällig rot wird, taugt nichts; deshalb feste Saaten.
 */
export const SAATEN = [20260921, 2, 3, 4, 5, 6];

/**
 * Ein Lauf mit fester Saat: Wie viele simulierte Sekunden braucht er, bis beide
 * Stücke in der Mulde liegen? `null` heißt: innerhalb von `hoechstensS` nicht.
 */
export function abfallLauf(
  saat: number,
  hoechstensS = 300
): { fertigS: number | null; funk: string[]; verlauf: Array<[number, number]>; amEnde: number } {
  // Saat 0: echter Zufall des Laufzeitsystems — so, wie der Wächter bisher lief.
  const zurueck = saat === 0 ? (): void => {} : festerZufall(saat);
  try {
    const p = baueAbfall();
    for (const [mat, kg, x, z] of ZWEI_STUECKE) p.lege(mat, kg, x, z);
    const fertigS = p.bisS(() => p.imSilo() === 2, hoechstensS);
    // Weiterlaufen lassen und jede Sekunde mitschreiben: Ein Stück, das wieder
    // herausrollt, ist ein anderer Befund als eines, das nie ankommt.
    const verlauf: Array<[number, number]> = [];
    while (p.uhr < hoechstensS) {
      p.schritt(1);
      verlauf.push([Math.round(p.uhr), p.imSilo()]);
    }
    return { fertigS, funk: p.funk, verlauf, amEnde: p.imSilo() };
  } finally {
    zurueck();
  }
}
