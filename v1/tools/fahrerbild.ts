/**
 * Riss vom Fahrer — Daniel in drei Ansichten, damit Patrick die FORM
 * beurteilen kann (Paket 1 aus E-025, Frage 4).
 *
 * Kein Bildschirmfoto: gerastert ohne Browser und ohne WebGL
 * (`tools/fuenfschalen/png.ts`). Das zeigt die Silhouette und die Farbflächen,
 * nicht die Beleuchtung der Kabine.
 *
 * Aufruf:  npx vite-node tools/fahrerbild.ts
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
bagger.root.updateMatrixWorld(true);

/**
 * Nur den Fahrer zeigen, in Weltlage.
 *
 * Die Eckfarben müssen dabei mit: Der Rasterer liest sonst nur `material.color`
 * — und das ist bei einem bunten Netz absichtlich WEISS. Deshalb wird je
 * Farbfläche eine eigene Kopie mit passendem Material gebaut.
 */
function fahrer(): THREE.Object3D {
  const g = new THREE.Group();
  const quelle = scene.getObjectByName("06_FAHRER")!;
  quelle.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.updateWorldMatrix(true, false);
    const geo = o.geometry as THREE.BufferGeometry;
    const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (!col) {
      const k = new THREE.Mesh(geo, o.material);
      k.applyMatrix4(o.matrixWorld);
      g.add(k);
      return;
    }
    /*
     * Ein buntes Netz in seine Farbflächen zerlegen — nur fürs Bild, nicht im
     * Spiel. Im Spiel bleibt es EIN Netz mit einem Zeichenruf.
     */
    const idx = geo.getIndex()!;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
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
      teil.setAttribute("position", pos);
      teil.setAttribute("normal", geo.getAttribute("normal"));
      teil.setIndex(liste);
      const [r, gr, b] = s.split(",").map(Number) as [number, number, number];
      const c = new THREE.Color();
      c.setRGB(r, gr, b, THREE.LinearSRGBColorSpace);
      const k = new THREE.Mesh(teil, new THREE.MeshStandardMaterial({ color: c }));
      k.applyMatrix4(o.matrixWorld);
      g.add(k);
    }
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
  const rand = 22;
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

mkdirSync("docs/messungen/2026-09-15-bagger", { recursive: true });
const b = new Blatt(1350, 620);
const d = fahrer();
feld(b, d, new THREE.Vector3(0.02, 0.05, 1), 10, 10, 440, 600); // von vorn
feld(b, d, new THREE.Vector3(0.7, 0.18, 1), 460, 10, 440, 600); // schräg
feld(b, d, new THREE.Vector3(1, 0.08, 0.05), 910, 10, 430, 600); // von der Seite
b.schreibe("docs/messungen/2026-09-15-bagger/03-fahrer.png");
