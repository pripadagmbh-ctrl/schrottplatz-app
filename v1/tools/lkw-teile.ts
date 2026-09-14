/**
 * Die Positionsliste der Anlieferfahrzeuge — das Vergleichsmass fuer den Bagger.
 *
 * Anlass (14.09.2026): Patrick zum Bagger — „die LKW sind manchmal besser
 * detailliert als der Bagger selbst". Bevor man darueber redet, muss man es
 * zaehlen. Dieselbe Rechnung wie in `tools/baggerteile.ts`: Meshes, Dreiecke,
 * und Zeichenrufe (ein schattenwerfendes Teil kostet zwei).
 *
 * Aufruf:  npx vite-node tools/lkw-teile.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildVehicleModel, type VehicleModelContext } from "../src/delivery/vehicleModel";
import { initPhysics } from "../src/physics/physicsWorld";

await initPhysics();

function dreiecke(g: THREE.BufferGeometry): number {
  const index = g.getIndex();
  const pos = g.getAttribute("position");
  if (!pos) return 0;
  return Math.floor((index ? index.count : pos.count) / 3);
}

/** Bauarten mit Ladeflaechenlaenge — Werte aus `src/delivery/vehicles.ts`. */
const BAUARTEN: Array<[string, string, number, boolean, string | undefined]> = [
  ["kipper", "kipper", 6.0, false, undefined],
  ["pritsche (rungen)", "pritsche", 5.4, false, "rungen"],
  ["pritsche (koffer)", "pritsche", 5.4, false, "koffer"],
  ["pritsche + Kran", "pritsche", 5.4, true, "rungen"],
  ["wrack", "wrack", 5.4, false, undefined],
  ["abholer", "abholer", 5.4, false, undefined],
  ["pkw + Anhaenger", "pkw", 2.4, false, undefined],
];

console.log("ANLIEFERFAHRZEUGE — Positionsliste");
console.log("==================================");
console.log("Bauart                 Meshes  Dreiecke  Zeichenrufe");
for (const [name, kind, bedLen, kran, stil] of BAUARTEN) {
  const ctx: VehicleModelContext = {
    kind,
    bedLen,
    withCrane: kran,
    bodyStyle: stil as VehicleModelContext["bodyStyle"],
    halter: "Messung",
    group: new THREE.Group(),
    bedGroup: new THREE.Group(),
    world: new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    sideWalls: [],
    tailGate: null,
  };
  const teile = buildVehicleModel(ctx);
  let meshes = 0;
  let tris = 0;
  let rufe = 0;
  const zaehle = (wurzel: THREE.Object3D | null): void => {
    if (!wurzel) return;
    wurzel.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      tris += dreiecke(o.geometry as THREE.BufferGeometry);
      rufe += o.castShadow ? 2 : 1;
    });
  };
  zaehle(ctx.group);
  // Der Anhaenger des PKW haengt nicht unter `group` — er wird vom Ablauf
  // nachgefuehrt und liegt lose in der Szene. Er gehoert trotzdem zur Fuhre.
  if (teile.trailer && teile.trailer.parent !== ctx.group) zaehle(teile.trailer);
  console.log(
    `${name.padEnd(20)} ${String(meshes).padStart(7)}  ${String(tris).padStart(8)}  ${String(rufe).padStart(11)}`
  );
}
