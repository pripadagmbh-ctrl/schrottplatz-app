/**
 * Vier Risse der Abstützung: alte und neue Lage, eingefahren und ausgefahren.
 *
 * Gerastert ohne Browser und ohne WebGL (`tools/riss.ts` + `fuenfschalen/png`).
 * Das zeigt die FORM und die Lage zueinander — ob es auf dem iPad gut
 * AUSSIEHT, entscheidet Patrick am Gerät.
 *
 * Die ALTE Lage wird hier nachgebaut, nicht aus dem Quelltext geholt: Sie
 * steht seit E-047 nicht mehr darin. Die Zahlen sind die vom 12.09.2026 —
 * Fuß bei x ±1,80 / z ±1,35, ein durchgehender Querbalken 0,34 × 0,34 von
 * x ±0,62 (y 0,95) nach x ±1,80 (y 0,70).
 *
 * Aufruf:  npx vite-node tools/pratzenbild.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mkdirSync } from "node:fs";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/** Ein Mesh in Weltlage kopieren, bunte Netze in ihre Farbflächen zerlegt. */
function farbtreu(o: THREE.Mesh, ziel: THREE.Group): void {
  o.updateWorldMatrix(true, false);
  const geo = o.geometry as THREE.BufferGeometry;
  const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!col) {
    const k = new THREE.Mesh(geo, o.material);
    k.applyMatrix4(o.matrixWorld);
    ziel.add(k);
    return;
  }
  const idx = geo.getIndex()!;
  const gruppen = new Map<string, number[]>();
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const s = `${col.getX(a).toFixed(4)},${col.getY(a).toFixed(4)},${col.getZ(a).toFixed(4)}`;
    const liste = gruppen.get(s) ?? [];
    liste.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    gruppen.set(s, liste);
  }
  for (const [s, liste] of gruppen) {
    const teil = new THREE.BufferGeometry();
    teil.setAttribute("position", geo.getAttribute("position"));
    teil.setAttribute("normal", geo.getAttribute("normal"));
    teil.setIndex(liste);
    const [r, g, b] = s.split(",").map(Number) as [number, number, number];
    const c = new THREE.Color();
    c.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
    const k = new THREE.Mesh(teil, new THREE.MeshStandardMaterial({ color: c }));
    k.applyMatrix4(o.matrixWorld);
    ziel.add(k);
  }
}

/** Das Fahrwerk mit Rädern, Schild und Pratzen — ohne Oberwagen und Arm. */
const FAHRWERK = [
  "01_UNTERWAGEN_LACK",
  "01_UNTERWAGEN_STAHL",
  "01_RAEUMSCHILD",
  "02_RAD_VL",
  "02_RAD_VR",
  "02_RAD_HL",
  "02_RAD_HR",
  "03_PRATZE_VL",
  "03_PRATZE_VR",
  "03_PRATZE_HL",
  "03_PRATZE_HR",
];

function fahrwerk(zusatz: THREE.Object3D[] = []): THREE.Object3D {
  const g = new THREE.Group();
  for (const n of FAHRWERK) {
    finde(n).traverse((o) => {
      if (o instanceof THREE.Mesh) farbtreu(o, g);
    });
  }
  for (const o of zusatz) g.add(o);
  return g;
}

/** Die Pratzen um `unten` (0 = eingefahren, 1 = ausgefahren) verfahren. */
function stelle(unten: number): void {
  for (const e of ["VL", "VR", "HL", "HR"]) {
    finde(`03_PRATZE_${e}`).position.y = (1 - unten) * 0.72;
  }
  bagger.root.position.y = unten * Excavator.JACK_UP_M;
  bagger.root.updateMatrixWorld(true);
}

/**
 * Die ALTE Abstützung von Hand, rot — Querbalken, Fußkasten, Bodenplatte.
 *
 * ACHTUNG, die Falle: Alle Zahlen hier stehen im BAGGER-Frame, der Bagger
 * selbst steht aber auf seinem Startplatz weit draussen auf dem Hof. Ohne die
 * Weltmatrix der Wurzel lägen die roten Klötze 22 m neben der Maschine — genau
 * so sah das erste Blatt aus.
 */
function alteLage(): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const stoff = new THREE.MeshStandardMaterial({ color: 0x8a2b2b });
  const inDieWelt = (g: THREE.BufferGeometry): THREE.Mesh => {
    const m = new THREE.Mesh(g, stoff);
    m.applyMatrix4(bagger.root.matrixWorld);
    return m;
  };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const von = new THREE.Vector3(sx * 0.62, 0.95, sz * 1.35);
      const bis = new THREE.Vector3(sx * 1.8, 0.7, sz * 1.35);
      const richtung = bis.clone().sub(von);
      const g = new THREE.BoxGeometry(0.34, 0.34, richtung.length() + 0.3);
      g.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          richtung.clone().normalize()
        )
      );
      g.translate(
        von.x + richtung.x / 2,
        von.y + richtung.y / 2,
        von.z + richtung.z / 2
      );
      out.push(inDieWelt(g));
      // Fußkasten und Teller an der alten Stelle
      const kasten = new THREE.BoxGeometry(0.26, 0.5, 0.26);
      kasten.translate(sx * 1.8, 0.42, sz * 1.35);
      out.push(inDieWelt(kasten));
      const teller = new THREE.BoxGeometry(0.62, 0.14, 0.62);
      teller.translate(sx * 1.8, 0.07, sz * 1.35);
      out.push(inDieWelt(teller));
    }
  }
  return out;
}

/** Ein Bildfeld: Rahmen freiräumen, Objekt einpassen, malen. */
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
  const rand = 16;
  const s = Math.min(
    (w - 2 * rand) / Math.max(x1 - x0, 1e-6),
    (h - 2 * rand) / Math.max(y1 - y0, 1e-6)
  );
  const cx = x + w / 2 - ((x0 + x1) / 2) * s;
  const cy = y + h / 2 + ((y0 + y1) / 2) * s;
  for (const t of tr) {
    const p = t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]);
    const e = t.ecken;
    blatt.dreieck(p, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
}

mkdirSync("docs/messungen/2026-09-15-pratzen", { recursive: true });

const BREITE = 1500;
const HOEHE = 1000;
const ZB = Math.floor((BREITE - 30) / 2);
const ZH = Math.floor((HOEHE - 30) / 2);
const SEITE = new THREE.Vector3(1, 0.05, 0.02);
const OBEN = new THREE.Vector3(0.001, 1, 0.001);
const SCHRAEG = new THREE.Vector3(0.8, 0.35, 1);

// Blatt 1 — alt gegen neu, Seitenriss und Draufsicht, alles eingefahren
stelle(0);
const b1 = new Blatt(BREITE, HOEHE);
feld(b1, fahrwerk(alteLage()), SEITE, 10, 10, ZB, ZH);
feld(b1, fahrwerk(), SEITE, 20 + ZB, 10, ZB, ZH);
feld(b1, fahrwerk(alteLage()), OBEN, 10, 20 + ZH, ZB, ZH);
feld(b1, fahrwerk(), OBEN, 20 + ZB, 20 + ZH, ZB, ZH);
b1.schreibe("docs/messungen/2026-09-15-pratzen/01-alt-neu.png");

// Blatt 2 — die neue Abstützung eingefahren und ausgefahren
const b2 = new Blatt(BREITE, HOEHE);
stelle(0);
feld(b2, fahrwerk(), SEITE, 10, 10, ZB, ZH);
feld(b2, fahrwerk(), SCHRAEG, 20 + ZB, 10, ZB, ZH);
stelle(1);
feld(b2, fahrwerk(), SEITE, 10, 20 + ZH, ZB, ZH);
feld(b2, fahrwerk(), SCHRAEG, 20 + ZB, 20 + ZH, ZB, ZH);
b2.schreibe("docs/messungen/2026-09-15-pratzen/02-ein-ausgefahren.png");
stelle(0);

// Blatt 3 — vorn links gross: Rad, Kotflügel, Kragarm, Stiel, Schild
const b3 = new Blatt(BREITE, 700);
const VORNLINKS = new THREE.Vector3(0.9, 0.25, 0.45);
feld(b3, fahrwerk(), VORNLINKS, 10, 10, ZB, 680);
feld(b3, fahrwerk(), new THREE.Vector3(0.02, 0.08, 1), 20 + ZB, 10, ZB, 680);
b3.schreibe("docs/messungen/2026-09-15-pratzen/03-vorderecke.png");
