/**
 * Der Bagger mit BEIDEN Greifern — dieselbe Stellung, einmal so, einmal so.
 *
 * KEIN Bildschirmfoto: gezeichnet ohne Browser und ohne WebGL, mit dem
 * Rasterer aus `tools/riss.ts` und dem Tiefenpuffer aus
 * `tools/fuenfschalen/png.ts`. Das zeigt die FORM und die
 * Groessenverhaeltnisse, nicht die Beleuchtung — wie es auf dem iPad aussieht,
 * entscheidet Patrick am Geraet.
 *
 * PNG und nicht SVG: Der Fuenfschalengreifer hat 14.884 Dreiecke, und als
 * Vektorblatt wurden daraus 12 MB, die kein Betrachter mehr oeffnen mag.
 *
 * Aufruf:  npx vite-node tools/greifer-am-bagger.ts
 * Ergebnis: docs/messungen/2026-09-15-greiferwechsel/*.png
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mkdirSync } from "node:fs";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { GripSystem } from "../src/physics/gripSystem";
import { setzeGreifer } from "../src/excavator/greiferwahl";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";

leinwandAttrappe();
await initPhysics();
const welt = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const scene = new THREE.Scene();
const bagger = new Excavator(scene, welt);
const grip = new GripSystem(welt, bagger.grappleBody);

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/** Arm in eine Stellung bringen — samt Hydraulik und Greifer an der Spitze. */
function stelle(boomGrad: number, stickGrad: number): void {
  finde("07_AUSLEGER").rotation.x = -THREE.MathUtils.degToRad(boomGrad);
  finde("07_STIEL").rotation.x = -THREE.MathUtils.degToRad(stickGrad);
  bagger.root.updateWorldMatrix(true, true);
  (bagger as unknown as { updateHydraulics(): void }).updateHydraulics();
  const stiel = finde("07_STIEL");
  stiel.updateWorldMatrix(true, true);
  bagger.grappleGroup.position.copy(
    new THREE.Vector3(0, 0, 4.0).applyMatrix4(stiel.matrixWorld)
  );
  bagger.grappleGroup.updateWorldMatrix(true, true);
}

/** Nur die SICHTBAREN Netze — der abgehaengte Greifer bleibt aussen vor. */
function sichtbares(): THREE.Object3D {
  const g = new THREE.Group();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    for (let k: THREE.Object3D | null = m.parent; k; k = k.parent) {
      if (!k.visible) return;
    }
    m.updateWorldMatrix(true, false);
    const kopie = new THREE.Mesh(m.geometry, m.material);
    kopie.applyMatrix4(m.matrixWorld);
    g.add(kopie);
  });
  return g;
}

function feld(
  blatt: Blatt,
  obj: THREE.Object3D,
  blick: THREE.Vector3,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  blatt.rechteck(x, y, w, h, [0xff, 0xff, 0xff]);
  blatt.frei(x, y, w, h);
  const tr = dreiecke(obj, blick);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of tr)
    for (const p of t.p) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
  const rand = 18;
  const s = Math.min(
    (w - 2 * rand) / Math.max(x1 - x0, 1e-6),
    (h - 2 * rand) / Math.max(y1 - y0, 1e-6)
  );
  const cx = x + w / 2 - ((x0 + x1) / 2) * s;
  const cy = y + h / 2 + ((y0 + y1) / 2) * s;
  for (const t of tr) {
    const p = t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]);
    const e = t.ecken;
    // Die Ecktiefen kommen um eine Ecke verdreht an — derselbe bekannte Haken
    // wie in `tools/baggerbild-png.ts`.
    blatt.dreieck(p, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
}

mkdirSync("docs/messungen/2026-09-15-greiferwechsel", { recursive: true });

const BREITE = 1500;
const HOEHE = 980;
const ZB = Math.floor((BREITE - 30) / 2);
const ZH = Math.floor((HOEHE - 30) / 2);
const SEITE = new THREE.Vector3(1, 0.06, 0.02);
const SCHRAEG = new THREE.Vector3(0.75, 0.32, 1);

const b = new Blatt(BREITE, HOEHE);
let spalte = 0;
for (const form of [SICHELKRALLE, FUENFSCHALEN]) {
  setzeGreifer(bagger, grip, form);
  stelle(40, -70);
  feld(b, sichtbares(), SEITE, 10 + spalte * (ZB + 10), 10, ZB, ZH);
  feld(b, sichtbares(), SCHRAEG, 10 + spalte * (ZB + 10), 20 + ZH, ZB, ZH);
  console.log(
    `${form.name}: Grabtiefe ${form.maxTiefe.toFixed(4)} m · Fuehlkugel ` +
      `${form.sensorRadius.toFixed(4)} m · Schalenluecke ${form.schalenluecke.toFixed(4)} m`
  );
  spalte++;
}
b.schreibe("docs/messungen/2026-09-15-greiferwechsel/bagger-beide.png");
console.log("docs/messungen/2026-09-15-greiferwechsel/bagger-beide.png geschrieben");
