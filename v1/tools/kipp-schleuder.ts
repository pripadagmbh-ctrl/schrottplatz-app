/**
 * WER SCHLEUDERT? — Diagnose zum Rückschlag aus E-105.
 *
 * `test/kipper.test.ts` misst nur das Höchsttempo der ganzen Fuhre. Für die
 * Frage „liegt es an den neuen Großteilen oder am dichteren Packen?" braucht es
 * einen Namen: welches Stück war das schnellste, wie groß und wie schwer war
 * es, und in welcher Phase ist es losgegangen.
 *
 * Aufruf, aus `v1/`:
 *
 *     npx vite-node tools/kipp-schleuder.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { VehicleManager } from "../src/delivery/vehicles";
import { spielFuhre } from "../test/pruefkunde";
import { SAATEN, festerZufall } from "../test/kipperlauf";

interface Schnellster {
  saat: number;
  kmh: number;
  name: string;
  dims: string;
  massKg: number;
  phase: string;
  bild: number;
}

async function main(): Promise<void> {
  await initPhysics();
  const ergebnisse: Schnellster[] = [];
  for (const saat of SAATEN) {
    const zurueck = festerZufall(saat);
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
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
    m.spawnNow("kipper", spielFuhre());
    const v = (m as unknown as { active: Record<string, unknown> }).active;
    (v as { parkSpot: [number, number] | null }).parkSpot = null;
    const dt = 1 / 60;
    let best: Schnellster = {
      saat,
      kmh: 0,
      name: "—",
      dims: "",
      massKg: 0,
      phase: "",
      bild: 0,
    };
    for (let i = 0; i < 60 * 300; i++) {
      m.update(dt);
      items.clampSpeeds(dt);
      world.step();
      const phase = String(v.phase);
      for (const it of items.items) {
        if (!it.body.isDynamic()) continue;
        const lv = it.body.linvel();
        const kmh = Math.hypot(lv.x, lv.y, lv.z) * 3.6;
        if (kmh > best.kmh) {
          best = {
            saat,
            kmh,
            name: it.shape?.name ?? "(ohne Namen)",
            dims: (it.shape?.dims ?? []).map((d) => d.toFixed(2)).join(" x "),
            massKg: it.massKg,
            phase,
            bild: i,
          };
        }
      }
      if (phase === "leaving" || phase === "gone") break;
    }
    zurueck();
    ergebnisse.push(best);
    console.log(
      `Saat ${String(saat).padStart(9)}  ${best.kmh.toFixed(0).padStart(4)} km/h  ` +
        `Bild ${String(best.bild).padStart(6)}  ${best.phase.padEnd(18)}  ` +
        `${best.massKg.toString().padStart(5)} kg  ${best.dims.padEnd(22)} ${best.name}`
    );
  }
  const sortiert = [...ergebnisse].sort((a, b) => b.kmh - a.kmh);
  console.log("\nDie fuenf schnellsten:");
  for (const e of sortiert.slice(0, 5)) {
    console.log(
      `  ${e.kmh.toFixed(0).padStart(4)} km/h  ${e.massKg} kg  ${e.dims}  ${e.name}  (${e.phase})`
    );
  }
}

void main();
