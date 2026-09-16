/**
 * WAS DER RANGIERKNICK ANRICHTET — mit echten Koerpern gemessen.
 *
 * Die Knicktabelle (`test/knicklauf.ts`) sagt, wie weit ein Umriss in einem
 * Rechenschritt springt. Sie sagt NICHT, was mit dem Schrott geschieht, der
 * dort liegt. Das steht hier: Ein Haufen wird abgelegt und zur Ruhe gebracht,
 * dann faehrt ein LKW seine Runde, und gemessen wird, wie schnell die schon
 * liegenden Stuecke werden und wie weit sie sich verschieben.
 *
 * DREI STAENDE, und der erste ist der wichtigste:
 *
 *   NULLPROBE   derselbe Haufen, derselbe Zeitraum, KEIN Fahrzeug. Was hier
 *               herauskommt, ist das Grundrauschen des Loesers. Ohne diese
 *               Zahl bedeutet „12 km/h" gar nichts.
 *   SPRUNG      der Zustand vor dem 16.09.2026 (`lenkrate = Infinity`).
 *   EINLENKEN   der gebaute Zustand.
 *
 * GEPAART GEMESSEN: Alle drei Staende fahren dieselben Saaten und damit
 * denselben Haufen. Das ist noetig, weil ein Schrotthaufen chaotisch ist —
 * zwei Ziehungen derselben Groesse unterscheiden sich um mehr, als der
 * gesuchte Unterschied gross ist (E-062, E-080).
 *
 * KEIN ZUSAETZLICHES OBJEKT: Der Apparat legt nichts an, was das Spiel nicht
 * auch anlegt. Jedes `THREE.Object3D` zieht beim Erzeugen vier Zufallszahlen
 * (`MathUtils.generateUUID`), ein Netz mehr wuerfelt also einen anderen
 * Haufen — das hat am 15.09.2026 einen Waechter rot gemacht, ohne dass an der
 * Physik etwas geaendert war (E-080).
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { LENK_RATE } from "../src/delivery/lenkung";
import { ABKIPP_ZONE, ABLADE_SPUR_X } from "../src/delivery/routes";
import { festerZufall } from "./kipperlauf";
import { spielFuhre } from "./pruefkunde";

/**
 * Wo der Haufen liegt, der getroffen werden kann.
 *
 * Zwei Orte, beide aus `routes.ts` gerechnet und nicht gegriffen:
 *
 *   ABKIPPZONE   wo die Fuhre des VORIGEN Kippers liegen bleibt. Das ist der
 *                Fall, den Patrick sieht: „Zwei Fuhren hintereinander an
 *                dieselbe Stelle" (E-073, Punkt 3 der Geraeteliste). Der
 *                Wagen setzt hier mit der Mulde DARUEBER — was sich bewegt,
 *                bewegt sich auch bei bestem Fahrbild.
 *   KEHRE        NEBEN dem Rangierpunkt, 4,0 m westlich der Abladespur. Der
 *                Wagen faehrt dort nie hin, aber sein Umriss ueberstreicht
 *                die Stelle beim Eindrehen: Der Kreis seiner weitesten Ecke
 *                misst 5,14 m. Hier wird GESCHOBEN — auch mit bestem
 *                Fahrbild. Gemessen wird, ob geschoben oder geschossen wird.
 *   KEHRE_FERN   6,5 m westlich, also AUSSERHALB dieses Kreises. Hier kommt
 *                der Wagen geometrisch nie hin — der Sprung aber schon: Er
 *                versetzte die Ecke in einem Bild um 10,23 m. Das ist die
 *                entscheidende Stelle: Was sich hier bewegt, kann sich nur
 *                durch den Knick bewegt haben.
 */
export const HAUFEN_ORTE = {
  abkippzone: { x: ABKIPP_ZONE[0], z: ABKIPP_ZONE[1] },
  kehre: { x: ABLADE_SPUR_X - 4.0, z: -17.5 },
  kehre_fern: { x: ABLADE_SPUR_X - 6.5, z: -17.5 },
} as const;

export type HaufenOrt = keyof typeof HAUFEN_ORTE;

export interface WirkungsStand {
  name: string;
  /** rad/s; `Infinity` ist der alte Sprungzustand. */
  lenkrate: number;
  /** Faehrt ueberhaupt ein Fahrzeug? `false` ist die Nullprobe. */
  mitFahrzeug: boolean;
  ort: HaufenOrt;
}

export interface Wirkung {
  /** Hoechsttempo eines schon liegenden Stuecks (km/h). */
  vmaxKmh: number;
  /** Weiteste Verschiebung eines schon liegenden Stuecks (m). */
  weitesteM: number;
  /** Mittlere Verschiebung ueber alle liegenden Stuecke (m). */
  mittlereM: number;
  /** Wieviele Stuecke im Haufen lagen. */
  teile: number;
  /** Wieviele Rechenschritte gemessen wurden. */
  schritte: number;
}

/** Wieviele Stuecke der Haufen hat — eine abgekippte Kipperfuhre sind rund 20. */
const HAUFEN_TEILE = 22; // SW, Groessenordnung einer Fuhre (`ladung.packeLadung`)

/**
 * Ein Lauf: Haufen ablegen, zur Ruhe bringen, Fahrzeug durchschicken, messen.
 *
 * Gemessen wird ERST AB DEM RUHEZUSTAND. Was beim Aufschuetten passiert,
 * gehoert nicht zur Frage — sonst misst man das Fallen und nicht den Knick.
 */
export function wirkung(s: WirkungsStand, saat: number): Wirkung {
  const zurueck = festerZufall(saat);
  try {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    // Abschrift aus `physics/physicsWorld.ts` — dort ist die Quelle.
    world.timestep = 1 / 60;
    const p = world.integrationParameters;
    p.numSolverIterations = 6;
    p.contact_natural_frequency = 30;
    p.normalizedAllowedLinearError = 0.005;
    p.numAdditionalFrictionIterations = 2;
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
      boden
    );
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(
      scene,
      world,
      items,
      new CompositeManager(scene, world, items, new EventBus())
    );
    const o = HAUFEN_ORTE[s.ort];
    items.spawnPile(new THREE.Vector3(o.x, 0, o.z), HAUFEN_TEILE, 2.2);
    items.settle(world, 300);
    // Der Haufen liegt. Ab hier zaehlt jede Bewegung dieser Stuecke.
    const liegend = items.items.filter((it) => it.body.isDynamic());
    const start = liegend.map((it) => {
      const t = it.body.translation();
      return { x: t.x, y: t.y, z: t.z };
    });
    const dt = 1 / 60;
    let vmax = 0;
    let schritte = 0;
    if (s.mitFahrzeug) {
      const c = spielFuhre();
      m.spawnNow("kipper", c);
      const v = (m as unknown as { active: { phase: string; lenkrate: number } }).active;
      v.lenkrate = s.lenkrate;
      for (let i = 0; i < 60 * 300; i++) {
        m.update(dt);
        items.clampSpeeds(dt);
        /*
         * GEMESSEN WIRD NACH DEM DECKEL, vor dem Schritt — also genau das
         * Tempo, mit dem das Stueck wirklich weiterfliegt. `clampSpeeds`
         * begrenzt den Zuwachs je Bild und das Gesamttempo nach Masse
         * (`scrapItems.maxSpeedFor`); wer davor misst, misst eine Zahl, die
         * das Spiel nie anwendet.
         */
        for (const it of liegend) {
          if (!it.body.isValid()) continue;
          const lv = it.body.linvel();
          const v3 = Math.hypot(lv.x, lv.y, lv.z);
          if (v3 > vmax) vmax = v3;
        }
        world.step();
        schritte++;
        if (String(v.phase) === "out" || String(v.phase) === "toPark") break;
      }
    } else {
      /*
       * NULLPROBE: genauso viele Schritte, aber ohne Fahrzeug. Die Zahl
       * stammt aus einem Lauf MIT Fahrzeug (rund 100 s Zyklus); sie steht
       * fest, damit die Nullprobe nicht kuerzer misst als der Vergleich.
       */
      for (let i = 0; i < 60 * 100; i++) {
        items.clampSpeeds(dt);
        for (const it of liegend) {
          if (!it.body.isValid()) continue;
          const lv = it.body.linvel();
          const v3 = Math.hypot(lv.x, lv.y, lv.z);
          if (v3 > vmax) vmax = v3;
        }
        world.step();
        schritte++;
      }
    }
    // Auslaufen lassen: Wo etwas LIEGT, sieht man erst, wenn es ruht.
    for (let i = 0; i < 60 * 15; i++) {
      items.clampSpeeds(dt);
      world.step();
    }
    let weiteste = 0;
    let summe = 0;
    for (let i = 0; i < liegend.length; i++) {
      const it = liegend[i]!;
      if (!it.body.isValid()) continue;
      const t = it.body.translation();
      const a = start[i]!;
      const d = Math.hypot(t.x - a.x, t.y - a.y, t.z - a.z);
      if (d > weiteste) weiteste = d;
      summe += d;
    }
    const ergebnis = {
      vmaxKmh: vmax * 3.6,
      weitesteM: weiteste,
      mittlereM: summe / Math.max(1, liegend.length),
      teile: liegend.length,
      schritte,
    };
    /*
     * DIE WELT WIRD FREIGEGEBEN, und das ist kein Aufraeumen aus Ordnungsliebe:
     * Jeder Lauf legt eine eigene Rapier-Welt an, und die liegt im
     * WASM-Speicher. Ueber 12 Saaten und neun Staende sind das 108 Welten; ohne
     * `free()` bricht der Lauf nach rund 50 ab (gemessen 16.09.2026, Abbruch
     * ohne Meldung mitten in der Tabelle).
     */
    world.free();
    return ergebnis;
  } finally {
    zurueck();
  }
}

/** Die zwoelf Saaten aus E-073, damit die Zahlen vergleichbar bleiben. */
export const SAATEN_12 = [20260913, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export interface WirkungsReihe {
  name: string;
  mittel: number;
  median: number;
  hoechst: number;
  weiteste: number;
  weitesteMittel: number;
  werte: number[];
  wege: number[];
}

const mittelwert = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;

export function reihe(s: WirkungsStand, saaten: number[] = SAATEN_12): WirkungsReihe {
  const r = saaten.map((x) => wirkung(s, x));
  const werte = r.map((x) => x.vmaxKmh);
  const sortiert = [...werte].sort((a, b) => a - b);
  return {
    name: s.name,
    mittel: mittelwert(werte),
    median: sortiert[Math.floor(sortiert.length / 2)]!,
    hoechst: Math.max(...werte),
    weiteste: Math.max(...r.map((x) => x.weitesteM)),
    weitesteMittel: mittelwert(r.map((x) => x.weitesteM)),
    werte,
    wege: r.map((x) => x.weitesteM),
  };
}

/** Die Staende, die `tools/rangier-wirkung.ts` und der Waechter fahren. */
export function staende(ort: HaufenOrt): WirkungsStand[] {
  return [
    { name: `Nullprobe (${ort})`, lenkrate: LENK_RATE, mitFahrzeug: false, ort },
    { name: `Sprung (${ort})`, lenkrate: Infinity, mitFahrzeug: true, ort },
    { name: `Einlenken (${ort})`, lenkrate: LENK_RATE, mitFahrzeug: true, ort },
  ];
}
