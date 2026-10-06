/**
 * WAS KOSTET `krallenKontakte`? (E-127, 06.10.2026)
 *
 * Seit E-127 fragt der Bagger alle Kollider eines Koerpers. Gemessen je Aufruf
 * fuer einen Koerper mit einem Kollider und fuer das hohle Wrack (acht), je
 * mit Treffern und ohne (ohne = schlimmster Fall, jede Abfrage laeuft durch).
 *
 * Aufruf: npx vite-node tools/krallenzeit.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { FORM_C } from "../src/dismantle/wrackformen";
async function main() {
  leinwandAttrappe(); await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const bagger = new Excavator(new THREE.Scene(), world);
  const gp = bagger.grappleGroup.position;
  const proben = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const mk = (dx: number, dy: number, viele: boolean) => {
    const b = proben.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(gp.x + dx, gp.y + dy, gp.z));
    if (viele) for (const bl of FORM_C.bleche!) proben.createCollider(RAPIER.ColliderDesc.cuboid(...bl.halb).setTranslation(...bl.mitte), b);
    else proben.createCollider(RAPIER.ColliderDesc.cuboid(0.85, 0.55, 2.0).setTranslation(0, 0.55, 0), b);
    return b;
  };
  const faelle: [string, RAPIER.RigidBody][] = [
    ["1 Kollider, Spinne auf dem Koerper", mk(0, -2.0, false)],
    ["8 Kollider, Spinne auf dem Wrack", mk(0, -2.0, true)],
    ["1 Kollider, nichts in Reichweite", mk(6, -2.0, false)],
    ["8 Kollider, nichts in Reichweite", mk(6, -2.0, true)],
  ];
  proben.step();
  for (const [name, b] of faelle) {
    for (let i = 0; i < 2000; i++) bagger.krallenKontakte(b);
    const N = 20000; let r = 0;
    const t = performance.now();
    for (let i = 0; i < N; i++) r = bagger.krallenKontakte(b);
    console.log(`${name.padEnd(36)} ${(((performance.now() - t) / N) * 1000).toFixed(2)} µs/Aufruf (Treffer ${r})`);
  }
}
void main();
