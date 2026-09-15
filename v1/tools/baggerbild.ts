/**
 * Risse vom Bagger — damit Patrick die FORM beurteilen kann, bevor er das
 * Gerät anfasst.
 *
 * KEIN Bildschirmfoto: gezeichnet wird ohne Browser und ohne WebGL, mit dem
 * Rasterer aus `tools/riss.ts` (orthogonale Projektion, flache Schattierung).
 * Das zeigt die Form, nicht die Beleuchtung. Wie es auf dem iPad aussieht,
 * entscheidet Patrick am Gerät.
 *
 * Aufruf:  npx vite-node tools/baggerbild.ts
 * Ergebnis: docs/messungen/2026-09-15-bagger/*.svg
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { writeFileSync, mkdirSync } from "node:fs";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { blatt, feld, type Feld } from "./riss";

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));

const BLICK_SEITE = new THREE.Vector3(1, 0.06, 0.02);
const BLICK_SCHRAEG = new THREE.Vector3(0.75, 0.32, 1);
const BLICK_VORN = new THREE.Vector3(0.02, 0.06, 1);

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/**
 * Den Arm in eine Stellung bringen — und die Hydraulik mitziehen.
 *
 * Ohne den Aufruf von `updateHydraulics` blieben die Zylinder in der Pose des
 * letzten Bildes stehen; genau daran hätte man den Umbau nicht beurteilen
 * können.
 */
function stelle(boomGrad: number, stickGrad: number): void {
  finde("07_AUSLEGER").rotation.x = -THREE.MathUtils.degToRad(boomGrad);
  finde("07_STIEL").rotation.x = -THREE.MathUtils.degToRad(stickGrad);
  bagger.root.updateWorldMatrix(true, true);
  (bagger as unknown as { updateHydraulics(): void }).updateHydraulics();
}

/**
 * Alles, was zum Bagger gehört, in eine Hilfsgruppe hängen — auch die
 * Zylinder, die in Weltkoordinaten lose in der Szene liegen.
 *
 * Gehängt wird NICHT umgehängt: Der Rasterer läuft über `scene` und lässt die
 * Spinne stehen, weil sie an dieser Stelle nicht zur Sache gehört.
 */
function ganzerBagger(): THREE.Object3D {
  return scene;
}

/** Nur diese Teile zeigen — für die Nahaufnahmen. */
function nur(namen: string[]): THREE.Object3D {
  const g = new THREE.Group();
  for (const n of namen) {
    const o = finde(n) as THREE.Mesh;
    o.updateWorldMatrix(true, false);
    const k = new THREE.Mesh(o.geometry, o.material);
    k.applyMatrix4(o.matrixWorld);
    g.add(k);
  }
  return g;
}

mkdirSync("docs/messungen/2026-09-15-bagger", { recursive: true });

/* ---------------------------------------------- Blatt 1: die ganze Maschine */

const RAND = 24;
const KOPF = 68;
const ZELLE_B = 520;
const ZELLE_H = 420;

stelle(58, -35); // Arbeitsstellung: Arm aufgerichtet, Stiel gestreckt
const arbeit = feld(
  { name: "ARBEITSSTELLUNG  (Ausleger 58°, Stiel −35°)", obj: ganzerBagger(), blick: BLICK_SEITE },
  RAND,
  KOPF,
  ZELLE_B,
  ZELLE_H
);
const arbeitSchraeg = feld(
  { name: "ARBEITSSTELLUNG, schräg", obj: ganzerBagger(), blick: BLICK_SCHRAEG },
  RAND + ZELLE_B + 12,
  KOPF,
  ZELLE_B,
  ZELLE_H
);
stelle(8, -132); // Ruhestellung: Arm abgelegt, Stiel eingeklappt
const ruhe = feld(
  { name: "RUHESTELLUNG  (Ausleger 8°, Stiel −132°)", obj: ganzerBagger(), blick: BLICK_SEITE },
  RAND,
  KOPF + ZELLE_H + 12,
  ZELLE_B,
  ZELLE_H
);
const ruheVorn = feld(
  { name: "RUHESTELLUNG, von vorn", obj: ganzerBagger(), blick: BLICK_VORN },
  RAND + ZELLE_B + 12,
  KOPF + ZELLE_H + 12,
  ZELLE_B,
  ZELLE_H
);
writeFileSync(
  "docs/messungen/2026-09-15-bagger/01-maschine.svg",
  blatt(
    2 * ZELLE_B + 12 + 2 * RAND,
    2 * ZELLE_H + 12 + KOPF + RAND,
    "BAGGER nach E-029 — Zylinder, Drehkranz, Ausleger und Stiel",
    "Riss ohne Browser (tools/riss.ts), orthogonal, flache Schattierung. Kein Bildschirmfoto.",
    arbeit + arbeitSchraeg + ruhe + ruheVorn
  )
);

/* ------------------------------------- Blatt 2: der Zylinder, ein- und ausgefahren */

const zellen: Feld[] = [];
stelle(5, -140);
zellen.push({
  name: "HUBZYLINDER, eingefahren",
  obj: nur(["07_ZYLINDER_HUB_L_ROHR", "07_ZYLINDER_HUB_L_STANGE"]),
  blick: BLICK_SEITE,
  notiz: "Rohr 2,298 m · Stange 1,813 m",
});
const eingefahren = feld(zellen[0]!, RAND, KOPF, ZELLE_B, ZELLE_H);
stelle(70, -25);
const ausgefahren = feld(
  {
    name: "HUBZYLINDER, ausgefahren",
    obj: nur(["07_ZYLINDER_HUB_L_ROHR", "07_ZYLINDER_HUB_L_STANGE"]),
    blick: BLICK_SEITE,
    notiz: "dieselben Längen — nur die Stange steht heraus",
  },
  RAND + ZELLE_B + 12,
  KOPF,
  ZELLE_B,
  ZELLE_H
);
const kranz = feld(
  {
    name: "DREHKRANZ  (Ring steht still, Deckel dreht mit)",
    obj: nur(["04_DREHKRANZ_RING", "04_DREHKRANZ"]),
    blick: BLICK_SCHRAEG,
    notiz: "36 Zähne, 24 Schrauben, d 1,70 m",
  },
  RAND,
  KOPF + ZELLE_H + 12,
  ZELLE_B,
  ZELLE_H
);
const arm = feld(
  {
    name: "AUSLEGER UND STIEL",
    obj: nur([
      "07_AUSLEGER_KASTEN",
      "07_AUSLEGER_STAHL",
      "07_SCHLAUCH_AUSLEGER",
      "07_STIEL_KASTEN",
      "07_STIEL_STAHL",
      "07_SCHLAUCH_STIEL",
    ]),
    blick: BLICK_SCHRAEG,
    notiz: "Kastenprofil verjüngt, Laschen, Lagerböcke, Schlauchpaket in Schellen",
  },
  RAND + ZELLE_B + 12,
  KOPF + ZELLE_H + 12,
  ZELLE_B,
  ZELLE_H
);
writeFileSync(
  "docs/messungen/2026-09-15-bagger/02-bauteile.svg",
  blatt(
    2 * ZELLE_B + 12 + 2 * RAND,
    2 * ZELLE_H + 12 + KOPF + RAND,
    "E-029 — die drei Baugruppen einzeln",
    "Der Hubzylinder in beiden Endstellungen: gleiches Rohr, gleiche Stange, andere Lage.",
    eingefahren + ausgefahren + kranz + arm
  )
);

console.log("geschrieben: docs/messungen/2026-09-15-bagger/01-maschine.svg");
console.log("geschrieben: docs/messungen/2026-09-15-bagger/02-bauteile.svg");
