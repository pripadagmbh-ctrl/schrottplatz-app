/**
 * DIE EINZELSTÜCK-FUHRE, GEFAHREN (E-126) — Messung zu `test/einzelstueck.test.ts`.
 *
 * Jedes Teil aus `EINZELSTUECKE` einmal vom Tor bis an den Abladeplatz und
 * 10 s darüber hinaus. Gemeldet: Ankunft, Lage auf der Fläche, ob das Teil
 * nach der Ankunft frei (dynamisch) ist, wann es still liegt, Kippung,
 * Physik-ms je Schritt und Körper wach/gesamt am Ende.
 *
 * Aufruf, aus `v1/`:  npx vite-node tools/einzelstueck-fahrt.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { EINZELSTUECKE, rollEinzelstueck } from "../src/delivery/customers";

async function main(): Promise<void> {
  await initPhysics();
  console.log("Teil                                   an(s)  quer   x(m)   z(m)  frei  still(s)  kipp(°)  ms/Schritt  wach/ges  Teil schlaeft");
  for (const teil of EINZELSTUECKE) {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
    m.spawnNow("pritsche", { ...rollEinzelstueck(), einzelstueck: teil, massKg: teil.massKg });
    m.acceptDeliveries = false;
    const v = (m as unknown as {
      active: { phase: string; bedGroup: THREE.Group; cargo: { items: Array<{ body: RAPIER.RigidBody }> } };
    }).active;
    const body = v.cargo.items[0]!.body;
    const dt = 1 / 60;
    let t = 0;
    let an = Infinity;
    let still = Infinity;
    let ms = 0;
    let schritte = 0;
    for (let i = 0; i < 60 * 240; i++) {
      m.update(dt);
      items.clampSpeeds(dt);
      const t0 = performance.now();
      world.step();
      ms += performance.now() - t0;
      schritte++;
      scene.updateMatrixWorld(true);
      t += dt;
      if (an === Infinity && v.phase === "waitUnload") an = t;
      if (an !== Infinity) {
        const lv = body.linvel();
        const ruhig = Math.hypot(lv.x, lv.y, lv.z) < 0.02 && body.isDynamic();
        if (ruhig && still === Infinity) still = t - an;
        if (!ruhig) still = Infinity;
        if (t > an + 10) break;
      }
    }
    const p = body.translation();
    const lokal = v.bedGroup.worldToLocal(new THREE.Vector3(p.x, p.y, p.z));
    const q = body.rotation();
    const fq = new THREE.Quaternion();
    v.bedGroup.getWorldQuaternion(fq);
    const oben = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    const kipp = (Math.acos(Math.min(1, Math.abs(oben.dot(new THREE.Vector3(0, 1, 0).applyQuaternion(fq))))) * 180) / Math.PI;
    let wach = 0;
    let ges = 0;
    world.forEachRigidBody((b) => {
      ges++;
      if (!b.isSleeping() && !b.isFixed()) wach++;
    });
    // Liegt es quer? Gierwinkel des Teils gegen die Fläche.
    const vorn = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    const flVorn = new THREE.Vector3(0, 0, 1).applyQuaternion(fq);
    const quer = Math.abs(vorn.dot(flVorn)) < 0.5;
    console.log(
      `${(teil.name ?? "?").padEnd(38)} ${an.toFixed(1).padStart(5)}  ${quer ? "ja  " : "nein"} ${lokal.x.toFixed(2).padStart(6)} ${lokal.z.toFixed(2).padStart(6)}  ${body.isDynamic() ? "ja  " : "nein"} ${still.toFixed(1).padStart(8)} ${kipp.toFixed(1).padStart(8)} ${(ms / schritte).toFixed(3).padStart(11)}  ${wach}/${ges}    ${body.isSleeping() ? "ja" : "nein"}`
    );
  }
}

main();
