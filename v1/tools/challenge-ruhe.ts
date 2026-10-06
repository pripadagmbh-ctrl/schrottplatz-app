/**
 * KOMMT EIN ABGELEGTES WRACK IN DER PRESSKAMMER ZUR RUHE? (E-125)
 *
 * Challenge 1 wertet Ruhe und Praezision ueber die Fahrkunst-Messung (E-119),
 * und die misst erst, wenn die Ladung LIEGT (`isSleeping`). Dieses Werkzeug
 * legt das echte Wrack in die echte Presse (und zum Vergleich auf freien
 * Boden) und schreibt je Sekunde Hoehe, Tempo, Schlaf und „drin" auf.
 *
 * Befund 06.10.2026 (Hoehe 2,6 m): Laengs (Gier 86–92 Grad) faellt es auf den
 * Kammerboden (y 0,30) und schlaeft nach 3 s. Quer oder schraeg (0, 55, 84,
 * 96 Grad) bleibt es auf Wandkrone und offener Klappe liegen (y 2,18–2,23),
 * zittert mit 0,3–1 mm/s und schlaeft NIE ein — es beruehrt dabei einen
 * festen und einen kinematischen Koerper. Eine Kiste auf einer stillen
 * kinematischen Platte schlaeft dagegen nach 130 Schritten; es ist die
 * Kantenauflage, nicht die Klappe an sich. Darum schliesst seit E-125 der
 * Pressenstart die Fahrkunst-Messung ab (`Fahrkunst.jetztLiegtSie`).
 *
 * Aufruf: npx vite-node tools/challenge-ruhe.ts
 * Unter PowerShell: `$env:GIER=0; $env:HOCH=2.6; $env:KONTAKT=1; npx vite-node tools/challenge-ruhe.ts`
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { PressManager, PRESS_CENTER } from "../src/world/press";
import { EventBus } from "../src/core/events";

await RAPIER.init();
const GIER = Number(process.env.GIER ?? "0");
const HOCH = Number(process.env.HOCH ?? "1.2");
for (const [name, ort] of [
  [`Kammer, Gier ${GIER} Grad, Hoehe ${HOCH}`, new THREE.Vector3(PRESS_CENTER.x, HOCH, PRESS_CENTER.z + 0.3)],
  ["freier Platz", new THREE.Vector3(0, HOCH, 0)],
] as const) {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const press = new PressManager(scene, world, items, composites);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  const car = composites.spawnCar(ort);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (GIER * Math.PI) / 180);
  car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  console.log(`\n=== ${name} ===  Teile: ${items.items.length}`);
  for (let i = 1; i <= 600; i++) {
    world.step();
    composites.update();
    press.update(1 / 60);
    if (i % 60 === 0) {
      const p = car.body.translation();
      const v = car.body.linvel();
      const w = car.body.angvel();
      console.log(
        `${(i / 60).toFixed(1)} s  y ${p.y.toFixed(3)}  v ${Math.hypot(v.x, v.y, v.z).toFixed(4)}  ` +
          `w ${Math.hypot(w.x, w.y, w.z).toFixed(4)}  schlaeft ${car.body.isSleeping()}  drin ${press.inChamber(p)}`
      );
      if (process.env.KONTAKT && i === 600) {
        for (let k = 0; k < car.body.numColliders(); k++) {
          world.contactPairsWith(car.body.collider(k), (o) => {
            const b = o.parent();
            let n = 0;
            world.contactPair(car.body.collider(k), o, (mf) => (n += mf.numSolverContacts()));
            if (n > 0) console.log(`  Blech ${k} beruehrt ${b?.isFixed() ? "fest" : b?.isKinematic() ? "kinematisch" : "dynamisch"} Koerper ${b?.handle} schlaeft ${b?.isSleeping()} (${n} Punkte)`);
          });
        }
      }
    }
  }
}
