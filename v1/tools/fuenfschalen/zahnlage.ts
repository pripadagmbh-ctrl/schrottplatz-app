/**
 * Wo genau sitzt der Zahn, wenn der Greifer offen ist?
 *
 * `unterkante.ts` sucht den aeussersten Punkt der Schale und nimmt ihn fuer die
 * Spitze. Bei einer nach innen gekruemmten Sichel kann das aber der RUECKEN
 * sein, nicht der Zahn. Hier wird der Zahn ueber seinen Knotennamen gesucht,
 * damit die Zahl stimmt.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/zahnlage.ts
 */
import * as THREE from "three";
import { stoffe } from "../../src/fuenfschalen/teile";
import { baueGreifer } from "../../src/fuenfschalen/rig";

const g = baueGreifer(stoffe());
g.setOeffnung(1);
g.wurzel.updateMatrixWorld(true);

const s = g.schalen[0]!.gelenk;
const namen: string[] = [];
s.traverse((o) => { if (o.name) namen.push(`${o.type}:${o.name}`); });
console.log("Knoten unter einer Schale:", namen.length ? namen.join(" · ") : "(alle unbenannt)");

function tiefsterVon(knoten: THREE.Object3D) {
  let tief = Infinity, yTief = 0, rTief = 0;
  const p = new THREE.Vector3();
  knoten.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = (o.geometry as THREE.BufferGeometry).getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      o.localToWorld(p);
      if (p.y < tief) { tief = p.y; yTief = p.y; rTief = Math.hypot(p.x, p.z); }
    }
  });
  return { y: yTief, r: rTief, gefunden: Number.isFinite(tief) };
}

const zahn = s.getObjectByName("SHELL_TIP_01") ?? s.getObjectByName("07_ZAHN");
console.log("");
if (zahn) {
  const z = tiefsterVon(zahn);
  console.log(`Zahn gefunden: tiefster Punkt y ${z.y.toFixed(3)} m bei r ${z.r.toFixed(3)} m`);
} else {
  console.log("Kein Knoten namens tineTip/ZAHN/SPITZE — der Zahn ist Teil des Schalenmesh.");
  console.log("Dann gilt: der tiefste Punkt der Schale IST die Unterkante, die aufsetzt.");
}
const ganz = tiefsterVon(s);
console.log(`Ganze Schale: tiefster Punkt y ${ganz.y.toFixed(3)} m bei r ${ganz.r.toFixed(3)} m`);
console.log(`Stempel:      tiefster Punkt y ${tiefsterVon(g.stempel).y.toFixed(3)} m`);

console.log("");
console.log("Oeffnung   Zahn tiefst   Schale tiefst   Stempel   Zahn ueber Schalenbauch");
for (let i = 0; i <= 10; i++) {
  const t = i / 10;
  g.setOeffnung(t);
  g.wurzel.updateMatrixWorld(true);
  const zz = s.getObjectByName("SHELL_TIP_01")!;
  const z = tiefsterVon(zz).y;
  const a = tiefsterVon(s).y;
  const st = tiefsterVon(g.stempel).y;
  console.log(
    `  ${(t * 100).toFixed(0).padStart(3)} %   ${z.toFixed(3).padStart(8)}   ${a.toFixed(3).padStart(8)}   ` +
      `${st.toFixed(3).padStart(7)}   ${(z - a).toFixed(3).padStart(7)} m` +
      (Math.abs(z - a) <= 0.02 ? "   <- Zahn setzt auf" : "")
  );
}
