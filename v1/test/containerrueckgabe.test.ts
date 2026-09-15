/**
 * DER ABHOLER BRINGT DEN CONTAINER ZURÜCK (E-044).
 *
 * Ansage Patrick, 15.09.2026: „Wenn ein Abholer den Müllcontainer mitnimmt,
 * dann bringt er ihn auch wieder und kippt ihn einfach bei mir ab" — „mit
 * ohne Müll in dem Fall. Und der Müll landet natürlich bei uns im Silo."
 *
 * Drei Zusicherungen, und keine davon ist verhandelbar:
 *
 *   1. KEIN KILOGRAMM VERSCHWINDET. Was im Container lag, liegt danach im
 *      ABFALL-Silo. Nichts wird gelöscht, nichts fällt vom Platz.
 *   2. KEIN GELD, NIE. Der Container ist Platzinventar. Er taucht in keiner
 *      Abrechnung auf, und sein Inhalt ist beim Abfahren schon weg, bevor die
 *      Abrechnung überhaupt hinsieht.
 *   3. DIE LEERE HÜLLE STEHT AM ABLADEPLATZ. Nicht im Nichts, nicht am
 *      nächsten Morgen — sofort und dort, wo der Wagen stand.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ContainerManager, CONFIGS, lagerMuldeFuer, bayHalb } from "../src/world/containers";
import { EventBus } from "../src/core/events";
import { VehicleManager } from "../src/delivery/vehicles";
import {
  ContainerAbholung,
  type BehaelterStellung,
  type PlatzinventarPort,
} from "../src/delivery/platzinventarAbholung";
import { ABLADE_SPUR_X, ABLADE_HALT_Z } from "../src/delivery/routes";

/**
 * Ein Blatt Papier statt eines Browsers.
 *
 * Die Behälterschilder zeichnen sich auf ein Canvas, und das gibt es in Node
 * nicht. Für diese Prüfung ist das Schild egal — gemessen werden Kilogramm und
 * Koordinaten. Also bekommt `document.createElement` eine Attrappe, die jeden
 * Zeichenbefehl schluckt. Ohne sie ließe sich der echte `ContainerManager`
 * kopflos überhaupt nicht bauen, und dann bliebe nur eine Attrappe des
 * Attrappen — also gar keine Prüfung.
 */
function papierstatBrowser(): void {
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

beforeAll(async () => {
  papierstatBrowser();
  await initPhysics();
});

const MUELL = CONFIGS.find((c) => c.id === "r_rubble")!;

function welt(): { scene: THREE.Scene; world: RAPIER.World; items: ItemManager } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  return { scene, world, items: new ItemManager(scene, world) };
}

/** Ein Stück Müll an einer Stelle im Container. */
function muell(items: ItemManager, kg: number, dx: number, dz: number): void {
  items.spawnScrap(
    "rubble",
    kg,
    { kind: "box", dims: [0.4, 0.3, 0.4], color: 0x6b6357 },
    new THREE.Vector3(MUELL.x + dx, 0.6, MUELL.z + dz),
    new THREE.Quaternion()
  );
}

describe("Die Gegenseite: Container leeren und absetzen", () => {
  it("jedes Kilogramm kommt im ABFALL-Silo an — nichts verschwindet", () => {
    const { scene, world, items } = welt();
    const c = new ContainerManager(scene, world, new EventBus());
    const abholung = new ContainerAbholung(c, items, world);
    const gewichte = [40, 75, 120, 33, 61];
    gewichte.forEach((kg, i) => muell(items, kg, (i % 3) * 0.7 - 0.7, Math.floor(i / 3) * 0.8 - 0.8));
    const summeVorher = items.items.reduce((s, it) => s + it.massKg, 0);
    const stueckVorher = items.items.length;

    const bericht = abholung.leeren("r_rubble");

    expect(bericht.stueck, `nur ${bericht.stueck} von ${stueckVorher} getragen`).toBe(stueckVorher);
    expect(bericht.kg, `${bericht.kg} kg statt ${summeVorher} kg`).toBeCloseTo(summeVorher, 6);
    expect(bericht.rest, "Stücke sind liegengeblieben").toBe(0);
    // Nichts gelöscht — die Stücke gibt es noch, nur woanders
    expect(items.items.length, "Stücke sind verschwunden").toBe(stueckVorher);
    expect(items.items.reduce((s, it) => s + it.massKg, 0)).toBeCloseTo(summeVorher, 6);
    // Und zwar im Lagersilo des Abfalls
    const silo = lagerMuldeFuer("rubble");
    expect(silo, "der Abfall hat kein Lagersilo").toBeTruthy();
    const { hw, hd } = bayHalb(silo!);
    for (const it of items.items) {
      const p = it.body.translation();
      expect(Math.abs(p.x - silo!.x), `${it.materialId} liegt nicht im Silo`).toBeLessThan(hw);
      expect(Math.abs(p.z - silo!.z)).toBeLessThan(hd);
    }
  }, 60000);

  it("die leere Hülle lässt sich absetzen und steht dann dort", () => {
    const { scene, world, items } = welt();
    const c = new ContainerManager(scene, world, new EventBus());
    const abholung = new ContainerAbholung(c, items, world);
    const vorher = abholung.stellungen();
    expect(vorher.length, "kein Platzinventar gefunden").toBeGreaterThan(0);
    expect(vorher.some((s) => s.id === "r_rubble"), "der MUELL fehlt").toBe(true);

    abholung.absetzen("r_rubble", ABLADE_SPUR_X, ABLADE_HALT_Z);
    world.step();
    const nachher = abholung.stellungen().find((s) => s.id === "r_rubble")!;
    expect(nachher.x, `x ${nachher.x.toFixed(2)}`).toBeCloseTo(ABLADE_SPUR_X, 1);
    expect(nachher.z, `z ${nachher.z.toFixed(2)}`).toBeCloseTo(ABLADE_HALT_Z, 1);
    expect(Number.isFinite(nachher.y)).toBe(true);
  }, 60000);
});

/** Ein Prüfstand-Platzinventar: sagt, wo der Container steht, und schreibt mit. */
class PruefPort implements PlatzinventarPort {
  geleert: string[] = [];
  abgesetzt: Array<{ id: string; x: number; z: number }> = [];
  constructor(private stand: BehaelterStellung[]) {}
  stellungen(): BehaelterStellung[] {
    return this.stand;
  }
  leeren(id: string): { kg: number; stueck: number; rest: number } {
    this.geleert.push(id);
    return { kg: 480, stueck: 6, rest: 0 };
  }
  absetzen(id: string, x: number, z: number): void {
    this.abgesetzt.push({ id, x, z });
    this.stand = this.stand.map((s) => (s.id === id ? { ...s, x, y: 0, z } : s));
  }
}

/** Abhol-LKW bis in die Warteschleife fahren lassen. */
function abholerAmPlatz(port: PlatzinventarPort): {
  vm: VehicleManager;
  v: { bedGroup: THREE.Group; group: THREE.Group; phaseName: string };
  schritt: (n: number) => void;
} {
  const { scene, world, items } = welt();
  const vm = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  vm.platzinventar = port;
  vm.requestPickup(null);
  const v = (vm as unknown as { active: { bedGroup: THREE.Group; group: THREE.Group; phaseName: string } }).active;
  const schritt = (n: number): void => {
    for (let i = 0; i < n; i++) {
      vm.update(1 / 60);
      items.clampSpeeds(1 / 60);
      world.step();
    }
  };
  // bis er auf Ladung wartet
  for (let i = 0; i < 60 * 180 && v.phaseName !== "waitLoad"; i++) schritt(1);
  return { vm, v, schritt };
}

describe("Der Abholer und das Platzinventar", () => {
  it("nimmt er den Container mit, wird er geleert und beim Bagger abgesetzt", () => {
    // Erst den Wagen holen, dann den Container auf SEINE Fläche legen
    const port = new PruefPort([{ id: "r_rubble", x: 0, y: 0, z: 0 }]);
    const { vm, v, schritt } = abholerAmPlatz(port);
    expect(v.phaseName, "der Abholer ist nie in die Warteschleife gekommen").toBe("waitLoad");
    v.group.updateWorldMatrix(true, true);
    const auf = v.bedGroup.localToWorld(new THREE.Vector3(0, 0.2, 2.7));
    (port as unknown as { stand: BehaelterStellung[] }).stand = [
      { id: "r_rubble", x: auf.x, y: auf.y, z: auf.z },
    ];

    vm.requestPickup(null); // V drücken: Abfahrt
    schritt(2);

    expect(port.geleert, "der Container wurde nicht geleert").toEqual(["r_rubble"]);
    expect(port.abgesetzt.length, "die Hülle wurde nicht abgesetzt").toBe(1);
    expect(port.abgesetzt[0]!.x).toBeCloseTo(ABLADE_SPUR_X, 6);
    expect(port.abgesetzt[0]!.z).toBeCloseTo(ABLADE_HALT_Z, 6);
  }, 120000);

  it("ein Container NEBEN dem Wagen bleibt stehen", () => {
    const port = new PruefPort([{ id: "r_rubble", x: 0, y: 0, z: 0 }]);
    const { vm, v, schritt } = abholerAmPlatz(port);
    v.group.updateWorldMatrix(true, true);
    // Dieselbe Stelle, aber auf dem Boden statt auf der Fläche
    const daneben = v.bedGroup.localToWorld(new THREE.Vector3(0, 0.2, 2.7));
    (port as unknown as { stand: BehaelterStellung[] }).stand = [
      { id: "r_rubble", x: daneben.x + 4.5, y: 0, z: daneben.z },
    ];
    vm.requestPickup(null);
    schritt(2);
    expect(port.geleert, "ein Container daneben wurde geleert").toEqual([]);
    expect(port.abgesetzt, "ein Container daneben wurde versetzt").toEqual([]);
  }, 120000);

  it("ohne Platzinventar-Zugang fährt der Abholer wie bisher", () => {
    /*
     * Die Verdrahtung in `main.ts` ist eine eigene Zeile. Fehlt sie, darf sich
     * nichts ändern — kein Absturz, kein anderer Ablauf.
     */
    const { scene, world, items } = welt();
    const vm = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
    vm.requestPickup(null);
    const v = (vm as unknown as { active: { phaseName: string } }).active;
    for (let i = 0; i < 60 * 180 && v.phaseName !== "waitLoad"; i++) {
      vm.update(1 / 60);
      world.step();
    }
    expect(v.phaseName).toBe("waitLoad");
    vm.requestPickup(null);
    for (let i = 0; i < 4; i++) {
      vm.update(1 / 60);
      world.step();
    }
    expect(v.phaseName).toBe("out");
  }, 120000);
});
