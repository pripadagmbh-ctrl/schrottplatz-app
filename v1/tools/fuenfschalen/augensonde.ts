/**
 * Sonde: wo sitzt das Zylinderauge gegenueber dem Gusskoerper des Zinkens?
 *
 * Nur ein Messwerkzeug fuer den Umbau E-039. Es beantwortet die Frage, die
 * `traverse-messen.ts` mit einer einzigen Zahl beantwortet („26 mm davor"):
 * Wie VIEL des Auges steckt noch im Guss, in welche Richtung fehlt Werkstoff,
 * und schliesst die Konsole die Luecke?
 *
 * Gemessen wird ueber KNOTENNAMEN (`06_ZINKEN`, `06_ZYLINDERAUGE`,
 * `06_AUGENKONSOLE`), nicht ueber Extrempunkte — aus dem Grund, der am
 * 14.09.2026 ein Werkzeug gekostet hat (Rueckseite statt Spitze).
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/augensonde.ts
 */
import * as THREE from "three";
import {
  MASS,
  OBERE_ANBINDUNG,
  ZYLINDER_AUFNAHME,
  stoffe,
} from "../../src/fuenfschalen/teile";
import { baueGreifer } from "../../src/fuenfschalen/rig";
import { A, A_NACHGESTELLT, B, C } from "./traverse-varianten";

type Dreieck = number[];

function dreiecke(o: THREE.Object3D): Dreieck[] {
  const raus: Dreieck[] = [];
  const v = new THREE.Vector3();
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const e: number[] = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        e.push(v.x, v.y, v.z);
      }
      raus.push(e);
    }
  });
  return raus;
}

function imWerkstoff(teile: Dreieck[], x: number, y: number, z: number): boolean {
  const treffer: Array<[number, number]> = [];
  for (const t of teile) {
    const ay = t[1]!;
    const az = t[2]!;
    const by = t[4]!;
    const bz = t[5]!;
    const cy = t[7]!;
    const cz = t[8]!;
    const d = (bz - cz) * (ay - cy) + (cy - by) * (az - cz);
    if (Math.abs(d) < 1e-14) continue;
    const w1 = ((bz - cz) * (y - cy) + (cy - by) * (z - cz)) / d;
    const w2 = ((cz - az) * (y - cy) + (ay - cy) * (z - cz)) / d;
    const w3 = 1 - w1 - w2;
    if (w1 < 0 || w2 < 0 || w3 < 0) continue;
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    if (nx === 0) continue;
    treffer.push([w1 * t[0]! + w2 * t[3]! + w3 * t[6]!, nx < 0 ? 1 : -1]);
  }
  treffer.sort((p, q) => p[0]! - q[0]!);
  let tiefe = 0;
  for (const [ort, richtung] of treffer) {
    if (ort > x) break;
    tiefe += richtung;
  }
  return tiefe > 0;
}

/**
 * Schattenriss eines Koerpers: welche Rasterfelder deckt er in dieser Ansicht?
 *
 * Das ist die Silhouette, und nur sie beantwortet „steht etwas heraus?".
 * Verglichen werden dieselben Felder mit und ohne Steg; was dazukommt, ist
 * genau das, was ein Betrachter mehr sieht.
 */
function schattenriss(
  obj: THREE.Object3D,
  blick: THREE.Vector3,
  raster = 0.002
): Set<string> {
  const d = blick.clone().normalize();
  const rechts = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const hoch = d.clone().cross(rechts).normalize();
  const felder = new Set<string>();
  const v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const p: Array<[number, number]> = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        p.push([v.dot(rechts), v.dot(hoch)]);
      }
      const [a, b, c] = p as [[number, number], [number, number], [number, number]];
      const fl = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(fl) < 1e-12) continue;
      const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / raster);
      const x1 = Math.ceil(Math.max(a[0], b[0], c[0]) / raster);
      const y0 = Math.floor(Math.min(a[1], b[1], c[1]) / raster);
      const y1 = Math.ceil(Math.max(a[1], b[1], c[1]) / raster);
      for (let yi = y0; yi <= y1; yi++)
        for (let xi = x0; xi <= x1; xi++) {
          const px = (xi + 0.5) * raster;
          const py = (yi + 0.5) * raster;
          const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / fl;
          const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / fl;
          const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / fl;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          felder.add(`${xi},${yi}`);
        }
    }
  });
  return felder;
}

/** Was der Steg an der Silhouette einer Schale wirklich hinzufuegt (cm²). */
function silhouette(oeffnung: number): void {
  const bauen = (mitSteg: boolean): THREE.Object3D => {
    const g = baueGreifer(stoffe());
    g.setOeffnung(oeffnung);
    g.wurzel.updateMatrixWorld(true);
    const schale = g.schalen[0]!.gelenk;
    if (!mitSteg) schale.getObjectByName("06_AUGENKONSOLE")?.removeFromParent();
    g.wurzel.updateMatrixWorld(true);
    return schale;
  };
  const mit = bauen(true);
  const ohne = bauen(false);
  const RASTER = 0.002;
  for (const [wie, blick] of [
    ["von der Seite      ", new THREE.Vector3(1, 0, 0)],
    ["von aussen-oben    ", new THREE.Vector3(0.55, 0.75, 0.35)],
    ["von vorn           ", new THREE.Vector3(0, 0, 1)],
  ] as Array<[string, THREE.Vector3]>) {
    const a = schattenriss(mit, blick, RASTER);
    const b = schattenriss(ohne, blick, RASTER);
    let dazu = 0;
    for (const f of a) if (!b.has(f)) dazu++;
    console.log(
      `   ${wie} Silhouette ${(b.size * RASTER * RASTER * 1e4).toFixed(0)} cm², ` +
        `der Steg fuegt ${(dazu * RASTER * RASTER * 1e4).toFixed(1)} cm² hinzu ` +
        `(${((dazu / Math.max(b.size, 1)) * 100).toFixed(2)} %)`
    );
  }
}

function main(): void {
  /*
   * Ohne Argument wird der GEBAUTE Stand gemessen. Mit `A`, `A*`, `B` oder `C`
   * wird die Anlenkung vorher umgesetzt — so laesst sich der alte Stand
   * nachstellen, ohne `src/` anzufassen.
   */
  const wahl = process.argv[2];
  const v = { A, "A*": A_NACHGESTELLT, B, C }[wahl ?? ""];
  if (v) {
    ZYLINDER_AUFNAHME.r = v.Zr;
    ZYLINDER_AUFNAHME.y = v.Zy;
    OBERE_ANBINDUNG.y = v.Ay;
    OBERE_ANBINDUNG.z = v.Az;
    (MASS.traverse as { breite: number }).breite = v.durchmesser;
    (MASS.traverse as { tiefe: number }).tiefe = v.durchmesser;
    console.log(`Variante ${v.name}`);
  }
  const g = baueGreifer(stoffe());
  g.setOeffnung(0);
  g.wurzel.updateMatrixWorld(true);
  const gelenk = g.schalen[0]!.gelenk;
  const zinken = gelenk.getObjectByName("06_ZINKEN")!;
  const auge = gelenk.getObjectByName("06_ZYLINDERAUGE")!;
  auge.updateWorldMatrix(true, false);
  const mitte = new THREE.Vector3().setFromMatrixPosition(auge.matrixWorld);
  const guss = dreiecke(zinken);
  const konsole = gelenk.getObjectByName("06_AUGENKONSOLE");
  const saetze: Array<[string, Dreieck[]]> = [["Zinken allein", guss]];
  if (konsole) saetze.push(["Zinken + Konsole", guss.concat(dreiecke(konsole))]);

  console.log(`OBERE_ANBINDUNG   y ${OBERE_ANBINDUNG.y}  z ${OBERE_ANBINDUNG.z}`);
  console.log(`Augenmitte (Welt) ${mitte.toArray().map((x) => x.toFixed(4)).join("  ")}`);

  for (const [wie, satz] of saetze) {
    const drin = imWerkstoff(satz, mitte.x, mitte.y, mitte.z);
    let ring = 0;
    for (let i = 0; i < 72; i++) {
      const w = (i / 72) * Math.PI * 2;
      if (imWerkstoff(satz, mitte.x, mitte.y + Math.sin(w) * 0.085, mitte.z + Math.cos(w) * 0.085))
        ring++;
    }
    let nah = drin ? 0 : Infinity;
    if (!drin) {
      for (let i = 0; i < 360; i++) {
        const w = (i / 360) * Math.PI * 2;
        for (let d = 0.001; d <= 0.3; d += 0.001) {
          if (imWerkstoff(satz, mitte.x, mitte.y + Math.sin(w) * d, mitte.z + Math.cos(w) * d)) {
            nah = Math.min(nah, d);
            break;
          }
        }
      }
    }
    console.log(
      `${wie.padEnd(18)} Mitte im Werkstoff: ${drin ? "ja " : "NEIN"}   ` +
        `Augenrand steckt an ${String(ring).padStart(2)}/72 Stellen drin   ` +
        `Mitte steht ${Number.isFinite(nah) ? (nah * 1000).toFixed(0) : ">300"} mm davor`
    );
    /*
     * Wo genau fehlt Werkstoff? Freier Abstand von der Augenmitte, alle 10° der
     * Radialebene. 0° = radial nach aussen (in der geschlossenen Stellung
     * +z der Welt), 90° = nach oben.
     */
    const zeile: string[] = [];
    for (let i = 0; i < 36; i++) {
      const w = (i / 36) * Math.PI * 2;
      let d = 0.002;
      for (; d <= 0.3; d += 0.002) {
        if (imWerkstoff(satz, mitte.x, mitte.y + Math.sin(w) * d, mitte.z + Math.cos(w) * d)) break;
      }
      zeile.push(`${i * 10}°:${d > 0.3 ? "---" : (d * 1000).toFixed(0)}`);
    }
    console.log(`   frei bis (mm): ${zeile.join("  ")}`);
  }

  if (konsole) {
    console.log("");
    console.log("Was der Steg an der Silhouette einer Schale hinzufuegt — offen:");
    silhouette(1);
    console.log("… und geschlossen:");
    silhouette(0);
  }
}

main();
