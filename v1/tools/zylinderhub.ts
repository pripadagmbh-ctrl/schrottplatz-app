/**
 * Wie weit faehrt jeder Hydraulikzylinder am Bagger wirklich aus?
 *
 * Anlass (14.09.2026, Baggerkonzept): Patrick zu den Zylindern — „die
 * Zylinder, wie man das aufbauen koennte". Ein Zylinder aus Rohr, Kolbenstange,
 * Augen und Lagerboecken laesst sich nur zeichnen, wenn man seinen HUB kennt:
 * Rohr und Stange haben feste Laengen, die Stange taucht ins Rohr ein. Heute
 * wird stattdessen beides in der Laenge GESTRECKT (`updateHydraulics`,
 * `barrel.scale.y` / `rod.scale.y`) — damit wuerde ein angebautes Auge
 * mitgestreckt.
 *
 * Gemessen wird der Abstand der beiden Ankerpunkte (`*_FUSS` und `*_KOPF`)
 * ueber den ganzen Bewegungsbereich von Ausleger, Stiel und Kabinenhub.
 * Daraus folgen Rohrlaenge und Stangenlaenge.
 *
 * Aufruf:  npx vite-node tools/zylinderhub.ts
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

/** Achsgrenzen — Kopien der Konstanten aus `excavator.ts` (BOOM_MIN … STICK_MAX). */
const BOOM_MIN = THREE.MathUtils.degToRad(5);
const BOOM_MAX = THREE.MathUtils.degToRad(70);
const STICK_MIN = THREE.MathUtils.degToRad(-140);
const STICK_MAX = THREE.MathUtils.degToRad(-25);
const CAB_LIFT_MAX = 2.6;

function finde(name: string): THREE.Object3D {
  let treffer: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (o.name === name) treffer = o;
  });
  if (!treffer) throw new Error(`Knoten ${name} nicht gefunden`);
  return treffer;
}

const boom = finde("07_AUSLEGER");
const stick = finde("07_STIEL");
const kabine = finde("06_KABINE");

/** Die fuenf Zylinder, wie sie `buildHydraulics` anlegt. */
const ZYLINDER = [
  "07_ZYLINDER_HUB_R",
  "07_ZYLINDER_HUB_L",
  "06_ZYLINDER_KABINE_A",
  "06_ZYLINDER_KABINE_B",
  "07_ZYLINDER_STIEL",
];
const anker = ZYLINDER.map((n) => ({
  name: n,
  fuss: finde(`${n}_FUSS`),
  kopf: finde(`${n}_KOPF`),
  min: Infinity,
  max: -Infinity,
}));

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const SCHRITTE = 40;
for (let i = 0; i <= SCHRITTE; i++) {
  const bw = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / SCHRITTE;
  for (let j = 0; j <= SCHRITTE; j++) {
    const sw = STICK_MIN + ((STICK_MAX - STICK_MIN) * j) / SCHRITTE;
    for (let k = 0; k <= 8; k++) {
      const hub = (CAB_LIFT_MAX * k) / 8;
      boom.rotation.x = -bw;
      stick.rotation.x = -sw;
      kabine.position.y = hub;
      kabine.position.z = hub * 0.34; // wie in syncMeshes
      bagger.root.updateWorldMatrix(true, true);
      for (const z of anker) {
        z.fuss.getWorldPosition(a);
        z.kopf.getWorldPosition(b);
        const d = a.distanceTo(b);
        if (d < z.min) z.min = d;
        if (d > z.max) z.max = d;
      }
    }
  }
}

console.log("ZYLINDERHUB — Ankerabstand ueber den ganzen Bewegungsbereich");
console.log("===========================================================");
console.log("Abgetastet: Ausleger 5°…70°, Stiel −140°…−25°, Kabinenhub 0…2,60 m");
console.log("");
console.log("Zylinder                 kuerzest  laengst     Hub   Rohr*  Stange*");
for (const z of anker) {
  /*
   * Bauvorschlag: Das Rohr bekommt die kuerzeste Baulaenge minus zwei
   * Augenabstaende, die Stange den Hub plus 25 % Ueberdeckung im Rohr — so
   * taucht sie beim Einfahren vollstaendig ein und steht hinten nie heraus.
   */
  const hub = z.max - z.min;
  const rohr = z.min - 0.22; // 11 cm je Auge (SW, Zeichnung)
  const stange = hub + rohr * 0.25;
  console.log(
    `${z.name.padEnd(24)} ${z.min.toFixed(3)}    ${z.max.toFixed(3)}   ${hub.toFixed(3)}   ` +
      `${rohr.toFixed(3)}   ${stange.toFixed(3)}`
  );
}
console.log("");
console.log("* Vorschlag, keine Messung — Rohr = kuerzester Abstand − 2 × 0,11 m Auge,");
console.log("  Stange = Hub + 25 % der Rohrlaenge Ueberdeckung.");
