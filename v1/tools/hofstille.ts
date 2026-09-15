/**
 * WIE LANGE STEHT DER HOF STILL, nachdem der Abholer losgefahren ist?
 *
 * Zur Ansage Patrick, 15.09.2026: „noch sind danach noch Haendler gekommen."
 * Es gibt zwei Tore, die Anlieferer aufhalten (`shift.acceptsDeliveries`,
 * `account.canBuy`) — und ein drittes, das keines sein will: Solange noch ein
 * Fahrzeug auf dem Platz ist (`VehicleManager.active`), kommt gar niemand.
 * Der Platz ist einspurig (E-029).
 *
 * Gemessen wird deshalb der Weg des Abholers NACH der Abfahrt: Wann ist er
 * wirklich vom Hof, und wann faehrt der Naechste durchs Tor?
 *
 * Aufruf: npx vite-node tools/hofstille.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { setBaggerOrt } from "../src/delivery/routes";

async function main(): Promise<void> {
  await initPhysics();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(
    scene,
    world,
    items,
    new CompositeManager(scene, world, items, new EventBus())
  );
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  m.acceptDeliveries = true;
  const takt = (): void => {
    m.update(1 / 60);
    items.clampSpeeds(1 / 60);
    world.step();
    scene.updateMatrixWorld(true);
  };

  m.requestPickup("steel");
  for (let i = 0; i < 60 * 400 && !m.pickupTruck?.waitingForLoad; i++) takt();
  console.log(`Abholer steht — Phase ${m.pickupTruck?.phaseName ?? "?"}`);

  let abgerechnet = false;
  m.onPickupDepart = () => {
    abgerechnet = true;
  };
  m.requestPickup(); // Taste V
  let t = 0;
  let frei = -1;
  let naechster = -1;
  for (let i = 0; i < 60 * 900; i++) {
    takt();
    t += 1 / 60;
    if (frei < 0 && m.activeKind === null) frei = t;
    if (frei >= 0 && m.activeKind !== null) {
      naechster = t;
      break;
    }
  }
  console.log(
    `Abgerechnet: ${abgerechnet ? "ja" : "NEIN"} · ` +
      `Platz frei nach ${frei.toFixed(1)} s · ` +
      `naechstes Fahrzeug nach ${naechster.toFixed(1)} s (${m.activeKind ?? "keins"})`
  );
}

void main();
