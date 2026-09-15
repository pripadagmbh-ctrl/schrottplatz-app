/**
 * Wächter für den neuen Abladeplatz: Der Händler-LKW muss dort ankommen —
 * und quer stehen.
 *
 * Ansage Patrick, 14.09.2026 abends: „Ich hätte gerne, dass ich LKWs nicht
 * mehr von hinten, sondern von der Seite ablade … da fährt er rückwärts ran."
 *
 * Geometrie allein reicht als Beleg nicht: Ein Fahrzeug fährt eine
 * Zustandsmaschine ab, tastet unterwegs nach Bauwerken und bleibt stehen,
 * wenn eines im Weg steht. Deshalb fährt dieser Test die Fuhre wirklich —
 * kopflos, aber mit derselben Physikwelt und denselben Strecken wie im Spiel.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ABLADE_SPUR_X, ABLADE_HALT_Z } from "../src/delivery/routes";
import { BAGGER_STAND, SCHWENK_AUSSEN } from "../src/world/baggerstand";

beforeAll(async () => {
  await initPhysics();
});

interface Fuhre {
  ankunftS: number;
  x: number;
  z: number;
  gierWinkel: number;
}

/** Eine Fuhre vom Tor bis zum Stillstand am Abladeplatz. */
function fahreEineFuhre(): Fuhre {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items));
  m.spawnNow("pritsche");
  const v = (m as unknown as { active: { phase: string; group: THREE.Group } }).active;
  const dt = 1 / 60;
  let t = 0;
  for (let i = 0; i < 60 * 240; i++) {
    m.update(dt);
    world.step();
    t += dt;
    if (v.phase === "waitUnload") break;
  }
  return {
    ankunftS: v.phase === "waitUnload" ? t : Infinity,
    x: v.group.position.x,
    z: v.group.position.z,
    gierWinkel: v.group.rotation.y,
  };
}

describe("Der Händler-LKW am neuen Abladeplatz", () => {
  // Erst nach `initPhysics` — eine Rapier-Welt vor dem Laden des Wasm-Moduls
  // gibt es nicht.
  let fuhre: Fuhre;
  beforeAll(() => {
    fuhre = fahreEineFuhre();
  });

  it("kommt an, statt unterwegs steckenzubleiben", () => {
    expect(
      fuhre.ankunftS,
      "der Wagen hat den Abladeplatz in vier Minuten nicht erreicht"
    ).toBeLessThan(240);
    // Zum Vergleich: Waage, Querung und 16 m rückwärts brauchen zusammen gut
    // eine Minute. Deutlich mehr hiesse: Er hat unterwegs gewartet.
    expect(fuhre.ankunftS).toBeLessThan(150);
  });

  it("hält auf dem Punkt, für den der Platz gebaut ist", () => {
    expect(fuhre.x).toBeCloseTo(ABLADE_SPUR_X, 1);
    expect(fuhre.z).toBeCloseTo(ABLADE_HALT_Z, 1);
  });

  it("steht mit der Längsseite zum Bagger, nicht mit dem Heck", () => {
    /*
     * Die Kabine zeigt nach +z (vehicles.ts), die Ladefläche liegt dahinter.
     * Nach dem Rückwärtsfahren nach Süden zeigt der Wagen also nach Norden:
     * Gierwinkel 0 (mod 2π).
     */
    const gier = ((fuhre.gierWinkel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const abweichung = Math.min(gier, 2 * Math.PI - gier);
    expect(abweichung, `Gierwinkel ${((gier * 180) / Math.PI).toFixed(0)}°`).toBeLessThan(0.2);

    // Und damit steht die Längsachse quer zur Richtung, in die der Bagger schaut.
    const mx = fuhre.x;
    const mz = fuhre.z; // Mitte der Ladefläche = Ursprung des Wagens
    const zumSitz = Math.atan2(BAGGER_STAND.x - mx, BAGGER_STAND.z - mz);
    const quer = Math.abs(Math.abs(zumSitz) - Math.PI / 2);
    expect(quer, "der Wagen steht nicht quer zum Sitz").toBeLessThan(0.45);
  });

  it("und seine Ladefläche liegt in Reichweite", () => {
    /*
     * Die Ladefläche liegt UM den Ursprung herum, nicht davor: `bedGroup`
     * sitzt auf lokal −bedLen/2 (`vehicleModel.ts`). Bis zum 15.09.2026
     * tastete dieser Test 2,7 m zu weit nördlich — und maß damit eine Stelle,
     * an der keine Ladung liegt.
     */
    for (const dz of [-2.7, 0, 2.7]) {
      const d = Math.hypot(fuhre.x - BAGGER_STAND.x, fuhre.z + dz - BAGGER_STAND.z);
      expect(d, `Ladefläche bei ${d.toFixed(2)} m`).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    }
  });
});
