/**
 * Der ganze Weg durch die Presse, mit echter Physik — nicht nachgerechnet.
 *
 * Fuenf Stuecke in die Kammer, Zyklus fahren, und dann steht da, was
 * herauskommt: Fraktion, Zusammensetzung, Erloes. Daneben derselbe Erloes
 * ohne Presse.
 *
 * Aufruf: npx vite-node tools/pressprobe.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager, SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";
import { CompositeManager } from "../src/dismantle/composites";
import { PressManager, PRESS_CENTER } from "../src/world/press";
import { EventBus } from "../src/core/events";
import { Account } from "../src/economy/account";

leinwandAttrappe();
await initPhysics();

const ALLE: PileSpec[] = [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE];
const items0 = { remove: () => {} } as never;
const comps0 = { despawnByBody: () => false } as never;

function verkauf(ware: Array<{ materialId: string; massKg: number; composition?: unknown }>): number {
  return new Account().sellContainer(
    ware.map((w) => ({ ...w, body: null })) as never,
    items0,
    comps0,
    null
  ).eur;
}

function probe(titel: string, fraktionen: string[], mal = 5): void {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const composites = new CompositeManager(scene, world, items, bus);
  const press = new PressManager(scene, world, items, composites);

  // Boden, damit nichts durchfaellt
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );

  const vorher: Array<{ materialId: string; massKg: number; composition?: unknown }> = [];
  for (let i = 0; i < mal; i++) {
    const fraktion = fraktionen[i % fraktionen.length]!;
    const liste = ALLE.filter((s) => s.materialId === fraktion);
    const s = liste[Math.floor(i / fraktionen.length) % liste.length]!;
    const it = items.spawnScrap(
      s.materialId,
      s.massKg,
      {
        kind: s.kind,
        dims: s.dims,
        color: 0x808080,
        bau: s.bau,
        name: s.name,
        zusammensetzung: s.zusammensetzung,
        massiv: s.massiv,
        trennbar: s.trennbar,
        nurWerkzeug: s.nurWerkzeug,
      },
      new THREE.Vector3(PRESS_CENTER.x + (i - 2) * 0.3, 1.0 + i * 0.05, PRESS_CENTER.z)
    );
    vorher.push({ materialId: it.materialId, massKg: it.massKg, composition: it.composition });
  }

  press.start();
  for (let i = 0; i < 1200 && press.running; i++) {
    press.update(1 / 60);
    world.step();
  }

  const nachher = items.items.map((it) => ({
    materialId: it.materialId,
    massKg: it.massKg,
    composition: it.composition,
  }));

  /*
   * Speichern und laden — genau so, wie `main.ts` es tut: gesichert wird je
   * Teil nur materialId, massKg und shape, wiederhergestellt wird ueber
   * `spawnScrap`.
   */
  const stand = items.items.filter((i) => i.shape).map((i) => ({
    materialId: i.materialId,
    massKg: i.massKg,
    shape: JSON.parse(JSON.stringify(i.shape)) as (typeof i.shape & object),
  }));
  const scene2 = new THREE.Scene();
  const world2 = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items2 = new ItemManager(scene2, world2);
  for (const s of stand) items2.spawnScrap(s.materialId, s.massKg, s.shape!, new THREE.Vector3(0, 5, 0));
  const geladen = items2.items.map((it) => ({
    materialId: it.materialId,
    massKg: it.massKg,
    composition: it.composition,
  }));

  const e0 = verkauf(vorher);
  const e1 = verkauf(nachher);
  const e2 = verkauf(geladen);
  console.log(
    `${titel.padEnd(30)} ${vorher.length} Stück → ${nachher.length} Stück  ` +
      `Fraktion(en) ${[...new Set(nachher.map((n) => n.materialId))].join("+")}  ` +
      `${e0.toFixed(2)} € → ${e1.toFixed(2)} €  (${(e1 - e0).toFixed(2)})` +
      `   nach Neuladen ${e2.toFixed(2)} € (${(e2 - e1).toFixed(2)})` +
      `   [Neuladen ohne Zusammensetzung, Stand bis 16.09.: ` +
      `${verkauf(nachher.map((n) => ({ materialId: n.materialId, massKg: n.massKg }))).toFixed(2)} €]`
  );
  for (const n of nachher) {
    console.log(
      `    ${n.materialId.padEnd(8)} ${Math.round(n.massKg)} kg  ` +
        (n.composition
          ? (n.composition as Array<{ materialId: string; massKg: number }>)
              .map((c) => `${c.materialId} ${Math.round(c.massKg)}`)
              .join(", ")
          : "OHNE ZUSAMMENSETZUNG")
    );
  }
}

console.log("--- eine Fraktion, so wie eine Mulde sie fasst ---");
for (const fr of ["copper", "brass", "alu", "va", "steel", "zinc", "cable", "mixed"]) {
  probe(`5 × ${fr}`, [fr]);
}
console.log("\n--- was EIN Behälter zusammen aufnimmt (mitFraktionen) ---");
probe("KUPFER-LAGER: Cu + Ms", ["copper", "brass"], 6);
probe("ALU-LAGER: Al + Zn", ["alu", "zinc"], 6);
probe("BUNT+VA: alle sechs", ["copper", "brass", "alu", "zinc", "cable", "va"], 6);
probe("MUELL: alle vier", ["wood", "rubble", "tires", "plastic"], 4);
