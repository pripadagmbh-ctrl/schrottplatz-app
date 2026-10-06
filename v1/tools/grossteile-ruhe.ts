/**
 * KOMMEN DIE NEUEN GROSSTEILE ZUR RUHE? (E-123, Physik-Budget)
 *
 * Fuer jedes Teil aus E-123 (dazu der behobene Kupferrohr-Bund und die
 * umgebaute Absetzmulde): einzeln aus 0,3 m auf den Boden fallen lassen und
 * zaehlen, nach wie vielen Schritten (1/60 s) es liegt — Tempo unter
 * 0,05 m/s und 0,05 rad/s, 30 Schritte am Stueck. Dazu Ecken des Netzes,
 * Ecken der Kollisionshuelle, Netze je Teil und die Physikzeit je Schritt.
 * Zum Schluss alle zusammen als Haufen: dieselbe Frage, mit Kontakt.
 *
 *     npx vite-node tools/grossteile-ruhe.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager, SPECS, BIG_SPECS, HUGE_SPECS } from "../src/world/scrapItems";
import type { PileSpec } from "../src/world/objektkatalog";

const NAMEN = [
  "Werkzeugcontainer (Baustelle)",
  "Kippbehälter (Stapler)",
  "Absetzmulde 5 m³ (Klappdeckel)",
  "Schuttcontainer (Absetzmulde)",
  "Gerüstrahmen (Paket, verzinkt)",
  "Alu-Rollgerüst (zerlegt, Paket)",
  "Gerüstrohre verzinkt (Bund)",
  "Gerüstfeld (ausgerissen)",
  "Minibagger-Raupenunterwagen",
  "Minibagger-Ausleger mit Stiel",
  "Minibagger 1,5 t (ohne Arm/Dach)",
  "Minibagger (ausgeschlachtet)",
  "Kupferrohr-Bund",
];

function form(sp: PileSpec) {
  return {
    kind: sp.kind,
    dims: sp.dims,
    color: 0xffffff,
    bau: sp.bau,
    name: sp.name,
    zusammensetzung: sp.zusammensetzung,
    massiv: sp.massiv,
  };
}

function hoehe(sp: PileSpec): number {
  if (sp.kind === "box") return sp.dims[1]!;
  if (sp.kind === "torus") return sp.dims[1]! * 2;
  return sp.dims[0]! * 2;
}

function welt(): { world: RAPIER.World; items: ItemManager } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const items = new ItemManager(new THREE.Scene(), world);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  return { world, items };
}

function ruhig(b: RAPIER.RigidBody): boolean {
  if (b.isSleeping()) return true;
  const v = b.linvel();
  const w = b.angvel();
  return Math.hypot(v.x, v.y, v.z) < 0.05 && Math.hypot(w.x, w.y, w.z) < 0.05;
}

async function main(): Promise<void> {
  await RAPIER.init();
  const alle = [...SPECS, ...BIG_SPECS, ...HUGE_SPECS];
  console.log("Teil                               Netze  Ecken Netz  Ecken Huelle  Schritte bis Ruhe  ms/Schritt  Kippung");
  for (const name of NAMEN) {
    const sp = alle.find((s) => s.name === name);
    if (!sp) {
      console.log(`  FEHLT: ${name}`);
      continue;
    }
    const { world, items } = welt();
    const it = items.spawnScrap(sp.materialId, sp.massKg, form(sp), new THREE.Vector3(0, hoehe(sp) / 2 + 0.3, 0));
    let netze = 0;
    let ecken = 0;
    it.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        netze++;
        ecken += m.geometry.getAttribute("position").count;
      }
    });
    let huelle = 0;
    for (let i = 0; i < it.body.numColliders(); i++) {
      const v = it.body.collider(i).vertices();
      huelle += v ? v.length / 3 : 0;
    }
    let schritte = -1;
    let folge = 0;
    const t0 = performance.now();
    let n = 0;
    for (; n < 900; n++) {
      world.step();
      folge = ruhig(it.body) ? folge + 1 : 0;
      if (folge >= 30) {
        schritte = n + 1 - 30;
        break;
      }
    }
    const ms = (performance.now() - t0) / Math.max(1, n + 1);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
      new THREE.Quaternion().copy(it.body.rotation() as THREE.QuaternionLike)
    );
    const kipp = THREE.MathUtils.radToDeg(Math.acos(Math.min(1, up.y)));
    console.log(
      `${name.padEnd(35)}${String(netze).padStart(5)}${String(ecken).padStart(12)}${String(huelle).padStart(14)}` +
        `${(schritte < 0 ? "nie (900)" : String(schritte)).padStart(19)}${ms.toFixed(3).padStart(12)}${kipp.toFixed(1).padStart(9)}°`
    );
    world.free();
  }

  // Alle zusammen: in zwei Lagen versetzt abgeworfen, ohne Ueberlappung
  const { world, items } = welt();
  const teile = NAMEN.map((n) => alle.find((s) => s.name === n)!).filter(Boolean);
  teile.forEach((sp, i) => {
    const x = (i % 4) * 3.2 - 4.8;
    const z = Math.floor(i / 4) * 4.2 - 4.2;
    const y = hoehe(sp) / 2 + 0.3 + (i % 2) * 2.5;
    items.spawnScrap(sp.materialId, sp.massKg, form(sp), new THREE.Vector3(x * 0.55, y, z * 0.55));
  });
  const koerper = items.items.map((x) => x.body);
  let schritte = -1;
  let folge = 0;
  const t0 = performance.now();
  let n = 0;
  for (; n < 1800; n++) {
    world.step();
    folge = koerper.every(ruhig) ? folge + 1 : 0;
    if (folge >= 30) {
      schritte = n + 1 - 30;
      break;
    }
  }
  const ms = (performance.now() - t0) / (n + 1);
  const wach = koerper.filter((b) => !ruhig(b)).length;
  console.log(
    `\nHaufen aus ${koerper.length} Teilen (enger Abwurf, zwei Lagen): ruhig nach ` +
      `${schritte < 0 ? "nie (1800)" : schritte} Schritten, ${ms.toFixed(3)} ms je Schritt, ` +
      `am Ende wach ${wach}/${koerper.length}`
  );
}

void main();
