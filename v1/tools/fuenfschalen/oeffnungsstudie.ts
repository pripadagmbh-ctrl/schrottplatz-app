/**
 * Was kostet es, den Greifer WENIGER weit zu öffnen?
 *
 * Auftrag 14.09.2026: „Die Öffnung zurücknehmen, von E/A 1,470 auf rund 1,30
 * — also E von 3,227 m auf etwa 2,85 m." Dazu der Hinweis, dass darin ein
 * Widerspruch stecken könnte: Nach der Abtastung in `docs/messungen/` liegt der
 * tiefste Zahnpunkt bei 40 % Öffnung und steigt zur vollen Öffnung wieder an.
 * Weniger Öffnung würde die Unterkante also TIEFER machen, nicht flacher.
 *
 * Dieses Werkzeug rechnet es aus, statt es zu vermuten: Es baut den Greifer mit
 * verschiedenen Anschlägen `offen` und misst jedes Mal dieselben Grössen.
 *
 * Die Spalte „Zahnachse" steht überall auf 0,00°, und das ist kein Fehler: Der
 * Anstellwinkel des Zahns folgt aus dem Anschlag (`zahnAnstellung(offen)`),
 * jede Zeile hat ihren eigenen. Der Zahn steht also in JEDER dieser Varianten
 * lotrecht — der Vergleich ist damit sauber, es wandert nur die Öffnung.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/oeffnungsstudie.ts
 */
import * as THREE from "three";
import { STEMPEL_AUGE, stoffe } from "../../src/fuenfschalen/teile";
import { FORM_BOGEN, Formsatz, baueGreifer, hebelarm } from "../../src/fuenfschalen/rig";

const v = new THREE.Vector3();

function punkte(o: THREE.Object3D, fn: (p: THREE.Vector3) => void): void {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) fn(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  });
}

interface Messung {
  gradOffen: number;
  E: number;
  A: number;
  C: number;
  D: number;
  huellkreis: number;
  zahnUnterStempel: number;
  zahnachse: number;
  hebelMin: number;
  sektor: number;
}

function miss(gradOffen: number): Messung {
  const form: Formsatz = { ...FORM_BOGEN, offen: (gradOffen * Math.PI) / 180 };
  const g = baueGreifer(stoffe(), form);

  const lage = (t: number): { r: number; yMin: number; yMax: number } => {
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    let r = 0;
    let yMin = Infinity;
    let yMax = -Infinity;
    punkte(g.wurzel, (p) => {
      r = Math.max(r, Math.hypot(p.x, p.z));
      yMin = Math.min(yMin, p.y);
      yMax = Math.max(yMax, p.y);
    });
    return { r, yMin, yMax };
  };

  const zu = lage(0);
  const auf = lage(1);
  let huellkreis = 0;
  let sektor = 0;
  let hebelMin = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    huellkreis = Math.max(huellkreis, 2 * lage(t).r);
    hebelMin = Math.min(hebelMin, hebelarm(form.offen * t, form));
    for (const s of g.schalen) {
      punkte(s.gelenk, (p) => {
        if (Math.hypot(p.x, p.z) < 0.3) return;
        let d = Math.atan2(p.x, p.z) - s.winkel;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        sektor = Math.max(sektor, Math.abs(d));
      });
    }
  }

  g.setOeffnung(1);
  g.wurzel.updateMatrixWorld(true);
  let zahnTief = Infinity;
  for (let i = 0; i < g.schalen.length; i++) {
    const z = g.schalen[i]!.gelenk.getObjectByName(`SHELL_TIP_${String(i + 1).padStart(2, "0")}`)!;
    punkte(z, (p) => {
      zahnTief = Math.min(zahnTief, p.y);
    });
  }
  let stempelY = Infinity;
  punkte(g.stempel, (p) => {
    stempelY = Math.min(stempelY, p.y);
  });

  /* Zahnachse aus den beiden Stirnquerschnitten — siehe `abcde.ts`. */
  const zahn = g.schalen[0]!.gelenk.getObjectByName("07_ZAHN") as THREE.Mesh;
  zahn.updateWorldMatrix(true, false);
  const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
  const mitte = (welche: number): THREE.Vector3 => {
    const s = new THREE.Vector3();
    const w = new THREE.Vector3();
    for (let i = 0; i < 5; i++) s.add(w.fromBufferAttribute(pos, welche * 5 + i));
    return s.multiplyScalar(0.2).applyMatrix4(zahn.matrixWorld);
  };
  const fuss = mitte(0);
  const d = mitte(1).sub(fuss);
  const aussen = new THREE.Vector2(fuss.x, fuss.z).normalize();

  return {
    gradOffen,
    E: 2 * auf.r,
    A: 2 * zu.r,
    C: auf.yMax - auf.yMin,
    D: zu.yMax - zu.yMin,
    huellkreis,
    zahnUnterStempel: stempelY - zahnTief,
    zahnachse: (Math.atan2(d.x * aussen.x + d.z * aussen.y, -d.y) * 180) / Math.PI,
    hebelMin,
    sektor: (sektor * 180) / Math.PI,
  };
}

console.log("Anschlag    E       E/A     C       C/D    Zahn unter   in %    Zahnachse  Hebel   Sektor");
console.log("  offen     m               m              Stempel, m   von C   offen      m       °");
for (const grad of [96.25, 90, 85, 80, 75, 70, 65, 60, 50, 40]) {
  const m = miss(grad);
  console.log(
    `  ${grad.toFixed(2).padStart(6)}  ${m.E.toFixed(3)}   ${(m.E / m.A).toFixed(3)}   ` +
      `${m.C.toFixed(3)}   ${(m.C / m.D).toFixed(3)}  ` +
      `${m.zahnUnterStempel.toFixed(3).padStart(9)}   ${((m.zahnUnterStempel / m.C) * 100).toFixed(1).padStart(5)}  ` +
      `${m.zahnachse.toFixed(2).padStart(9)}  ${m.hebelMin.toFixed(4)}  ${m.sektor.toFixed(2)}`
  );
}
console.log("");
console.log("Zeichnung (Augenmass):  E/A rund 1,30 · C/D rund 0,83 · Zahn rund 18 % von C · Zahnachse 0,00°");
console.log("Vertrag: Huellkreis <= 3,38 m · Hebelarm nie unter 0,05 (besser 0,10) · Sektor < 36°");
