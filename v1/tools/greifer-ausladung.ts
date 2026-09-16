/**
 * Stimmt `form.ausladung(winkel, kipp)` mit dem GEZEICHNETEN Greifer ueberein?
 *
 * Jede Form rechnet ihre Ausladung selbst — die Sichelkralle ueber
 * Segmentkette und Zahnkegel (`clawTipAusladung`), der Fuenfschalengreifer
 * ueber die am Modell abgegriffenen Zahnpunkte. Beides ist Geometrie und
 * keine Messung am Netz; eine Rechnung ohne gemessenen Fehler ist aber eine
 * Behauptung. Hier steht die Messung dazu.
 *
 * Gemessen wird gegen das gebaute Netz: Alle Eckpunkte unter der
 * `grappleGroup`, in den Greiferframe gerechnet, und daraus
 *
 *     wahre Ausladung(θ) = max über p von ( −p.y·cos θ + p.z·sin θ ).
 *
 * WAS DIE INTERESSANTE ZAHL IST. Nicht der absolute Unterschied — den gibt es
 * auch bei 0 Grad, weil das Netz dicker ist als seine Mittellinie und der
 * Bodenanschlag schon immer mit der Mittellinie plus Kegel rechnet. Die Frage
 * lautet: Wie viel GROESSER wird dieser Unterschied durchs Kippen? Das ist der
 * Fehler, den E-083 einfuehrt, und nur der.
 *
 * Aufruf: npx vite-node tools/greifer-ausladung.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";

const GRAD = 180 / Math.PI;

/** Alle gezeichneten Eckpunkte des Greifers im Greiferframe, bei `winkel`. */
function netzpunkte(bagger: Excavator, form: Greiferform, winkel: number): Float64Array {
  const g = bagger.grappleGroup;
  const bau = (bagger as unknown as {
    greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
  }).greiferbau;
  for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, winkel);
  bau.nachfuehren();
  g.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const p = new THREE.Vector3();
  const raus: number[] = [];
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) if (!a.visible) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mm);
      raus.push(p.x, p.y, p.z);
    }
  });
  return new Float64Array(raus);
}

function wahr(punkte: Float64Array, kipp: number): number {
  const c = Math.cos(kipp);
  const s = Math.sin(kipp);
  let weit = -Infinity;
  for (let i = 0; i < punkte.length; i += 3) {
    const d = -punkte[i + 1] * c + punkte[i + 2] * s;
    if (d > weit) weit = d;
  }
  return weit;
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const szene = new THREE.Scene();
  const bagger = new Excavator(szene, world);

  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    bagger.setGreifer(form);
    console.log(`\n=== ${form.name} ===\n`);
    console.log(`  maxTiefe (Bodenanschlag heute, lotrecht): ${form.maxTiefe.toFixed(4)} m`);
    console.log("");
    console.log("  Kipp  | maxAusladung | wahr am Netz | Unterschied | Zuwachs gegen 0°");
    console.log("  ------+--------------+--------------+-------------+-----------------");

    // wahre groesste Ausladung ueber den Schliessweg
    const STUFEN = 40;
    const wolken: Float64Array[] = [];
    for (let i = 0; i <= STUFEN; i++) {
      wolken.push(netzpunkte(bagger, form, form.zu + ((form.offen - form.zu) * i) / STUFEN));
    }
    const wahrMax = (kipp: number): number => {
      let w = -Infinity;
      for (const p of wolken) w = Math.max(w, wahr(p, kipp));
      return w;
    };
    const d0 = wahrMax(0) - form.maxAusladung(0);
    let groessterZuwachs = 0;
    for (let g = -90; g <= 90; g += 5) {
      const k = g / GRAD;
      const rechnung = form.maxAusladung(k);
      const gemessen = wahrMax(k);
      const d = gemessen - rechnung;
      const zuwachs = d - d0;
      if (Math.abs(zuwachs) > Math.abs(groessterZuwachs)) groessterZuwachs = zuwachs;
      console.log(
        `  ${String(g).padStart(4)}° |   ${rechnung.toFixed(4)} m |   ${gemessen.toFixed(4)} m |  ${d >= 0 ? "+" : ""}${d.toFixed(4)} m | ${zuwachs >= 0 ? "+" : ""}${(zuwachs * 1000).toFixed(1)} mm`
      );
    }
    console.log("");
    console.log(`  Bei 0 Grad rechnet der Bodenanschlag ${(d0 * 1000).toFixed(1)} mm zu flach —`);
    console.log("  das ist der Stand von heute und nicht Gegenstand dieses Umbaus.");
    console.log(
      `  DURCHS KIPPEN kommen hoechstens ${Math.abs(groessterZuwachs * 1000).toFixed(1)} mm dazu.`
    );

    // und dieselbe Frage je Oeffnungsstellung, nicht nur ueber das Maximum
    let schlimmst = 0;
    let woW = 0;
    let woK = 0;
    for (let i = 0; i <= STUFEN; i++) {
      const winkel = form.zu + ((form.offen - form.zu) * i) / STUFEN;
      const e0 = wahr(wolken[i], 0) - form.ausladung(winkel, 0);
      for (let g = -90; g <= 90; g += 5) {
        const k = g / GRAD;
        const e = wahr(wolken[i], k) - form.ausladung(winkel, k) - e0;
        if (Math.abs(e) > Math.abs(schlimmst)) {
          schlimmst = e;
          woW = winkel;
          woK = g;
        }
      }
    }
    console.log(
      `  Je Oeffnungsstellung einzeln: schlimmster Zuwachs ${(schlimmst * 1000).toFixed(1)} mm` +
        ` bei Winkel ${woW.toFixed(3)} rad, Kipp ${woK}°.`
    );
    console.log(`  Probe auf Zifferntreue bei 0 Grad:`);
    for (let i = 0; i <= STUFEN; i += 8) {
      const winkel = form.zu + ((form.offen - form.zu) * i) / STUFEN;
      const gleich = form.ausladung(winkel, 0) === form.tiefe(winkel);
      console.log(
        `    ausladung(${winkel.toFixed(4)}, 0) === tiefe(…) : ${gleich ? "ja" : "NEIN"}` +
          `  (${form.ausladung(winkel, 0).toFixed(12)})`
      );
    }
    console.log(
      `    maxAusladung(0) === maxTiefe : ${form.maxAusladung(0) === form.maxTiefe ? "ja" : "NEIN"}`
    );
  }
}

void main();
