/**
 * Messung je Paket des Baggerumbaus (E-025 / E-029): Netze, Dreiecke,
 * Zeichenrufe fuer Drehkranz, Ausleger, Stiel und Zylinder.
 *
 * Aufruf:  npx vite-node tools/paketmass.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
bagger.root.updateMatrixWorld(true);

function dreiecke(g: THREE.BufferGeometry): number {
  const i = g.getIndex();
  const p = g.getAttribute("position");
  if (!p) return 0;
  return Math.floor((i ? i.count : p.count) / 3);
}

const alle: THREE.Mesh[] = [];
scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === bagger.grappleGroup) return;
  alle.push(o);
});

const GRUPPEN: Array<[string, RegExp]> = [
  ["Drehkranz (04)", /^04_/],
  ["Ausleger", /^(07_AUSLEGER|08_LOGO_AUSLEGER|07_SCHLAUCH_AUSLEGER)/],
  ["Stiel", /^(07_STIEL|07_HALTER|07_SCHLAUCH_STIEL|07_KARDAN)/],
  ["Zylinder", /ZYLINDER_/],
];
console.log("Gruppe                                     Netze  Dreiecke  Zeichenrufe");
for (const [titel, re] of GRUPPEN) {
  const l = alle.filter((m) => re.test(m.name));
  const d = l.reduce((s, m) => s + dreiecke(m.geometry as THREE.BufferGeometry), 0);
  const z = l.reduce((s, m) => s + (m.castShadow ? 2 : 1), 0);
  console.log(
    `${titel.padEnd(42)} ${String(l.length).padStart(5)}  ${String(d).padStart(8)}  ` +
      `${String(z).padStart(11)}`
  );
  for (const m of l) {
    console.log(
      `    ${m.name.padEnd(38)} ${String(dreiecke(m.geometry as THREE.BufferGeometry)).padStart(8)}`
    );
  }
}
const dg = alle.reduce((s, m) => s + dreiecke(m.geometry as THREE.BufferGeometry), 0);
const zg = alle.reduce((s, m) => s + (m.castShadow ? 2 : 1), 0);
console.log("");
console.log(`GESAMT  Netze ${alle.length}  Dreiecke ${dg}  Zeichenrufe ${zg}`);
