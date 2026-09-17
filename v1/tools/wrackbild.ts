/**
 * WAS KOSTET EIN WRACK? — Netze, Eckpunkte, Materialien.
 *
 * Anlass (Patrick, 17.09.2026): „und autos, brauchen wir verschiedene modelle,
 * farben und wrackzustände". Bevor man fünf Modelle baut, muss die Zahl auf
 * dem Tisch liegen, an der alles hängt: Wieviele ZEICHENRUFE kostet ein Wrack
 * heute? Gemessen wurden am Bagger 1322 auf dem ganzen Platz, und der
 * Schattenwurf verdoppelt sie (E-025).
 *
 * Gezählt wird, was Three.js zeichnet: jedes Mesh ist ein Zeichenruf, es sei
 * denn, es teilt Geometrie UND Material mit einem anderen — dann nicht
 * einmal das (Instanzen gibt es hier nicht). Gezählt wird deshalb roh: Netze,
 * Eckpunkte, verschiedene Materialien.
 *
 * Aufruf, aus `v1/`:
 *
 *     npx vite-node tools/wrackbild.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";

interface Zaehlung {
  netze: number;
  ecken: number;
  dreiecke: number;
  materialien: number;
  geometrien: number;
  namen: Map<string, number>;
}

function zaehle(wurzel: THREE.Object3D): Zaehlung {
  const mats = new Set<THREE.Material>();
  const geos = new Set<THREE.BufferGeometry>();
  const namen = new Map<string, number>();
  let netze = 0;
  let ecken = 0;
  let dreiecke = 0;
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    netze++;
    const g = m.geometry;
    geos.add(g);
    const pos = g.getAttribute("position");
    ecken += pos ? pos.count : 0;
    const idx = g.getIndex();
    dreiecke += idx ? idx.count / 3 : pos ? pos.count / 3 : 0;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
    const schluessel = `${(pos?.count ?? 0).toString().padStart(4)} Ecken`;
    namen.set(schluessel, (namen.get(schluessel) ?? 0) + 1);
  });
  return { netze, ecken, dreiecke, materialien: mats.size, geometrien: geos.size, namen };
}

async function main(): Promise<void> {
  await initPhysics();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  const comps = new CompositeManager(scene, world, items, new EventBus());

  const eins = comps.spawnCar(new THREE.Vector3(0, 1, 0));
  const a = zaehle(eins.group);
  console.log("EIN WRACK, frisch angeliefert");
  console.log(`  Netze          ${a.netze}`);
  console.log(`  Eckpunkte      ${a.ecken}`);
  console.log(`  Dreiecke       ${Math.round(a.dreiecke)}`);
  console.log(`  Geometrien     ${a.geometrien}`);
  console.log(`  Materialien    ${a.materialien}`);
  console.log(`  mit Schatten:  ${a.netze * 2} Zeichenrufe`);
  console.log("  Aufteilung nach Eckpunktzahl:");
  for (const [k, n] of [...a.namen.entries()].sort()) console.log(`    ${n} x ${k}`);

  comps.spawnCar(new THREE.Vector3(6, 1, 0));
  const beide = zaehle(scene);
  console.log("\nZWEI WRACKS AUF DEM PLATZ");
  console.log(`  Netze          ${beide.netze}`);
  console.log(`  Eckpunkte      ${beide.ecken}`);
  console.log(`  Materialien    ${beide.materialien}  (geteilt wird nichts: jedes Wrack baut eigene)`);
  console.log(`  mit Schatten:  ${beide.netze * 2} Zeichenrufe`);
  console.log(
    `\nZum Vergleich: gemessene 1322 Zeichenrufe auf dem ganzen Platz —` +
      ` zwei Wracks sind davon ${((beide.netze * 2 * 100) / 1322).toFixed(1)} %.`
  );
}

void main();
