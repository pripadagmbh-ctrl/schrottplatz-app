/**
 * Wo sitzt der GEZEICHNETE Zahn der Spinne — und meldet `CLAW_MAX_DEPTH` ihn?
 *
 * Das Gegenstueck zu `tools/fuenfschalen/zahnlage.ts`, nur fuer die gespielte
 * Spinne aus `src/excavator/grappleParts.ts`. Dort hat dieselbe Messart einen
 * Fehler aufgedeckt, den kein Waechter gesehen hat: Der Bodenanschlag kam aus
 * dem Rechenmodell (`clawPoint`), der Zahnkegel aber wird zusaetzlich
 * gezeichnet und haengt darunter.
 *
 * Wichtig ist die Messart: Der Zahn wird ueber seinen KNOTENNAMEN gesucht
 * (`tineTip`), nicht ueber „tiefster Punkt irgendwo". Bei einer nach innen
 * gekruemmten Sichel kann der tiefste Punkt naemlich auch der Ruecken sein.
 *
 * Aufruf:  npx vite-node tools/zahnlage-spinne.ts
 */
import * as THREE from "three";
import { baueSpinne } from "../src/excavator/grappleParts";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_MAX_DEPTH,
  CLAW_OPEN_SPLAY,
  clawTipDepth,
} from "../src/excavator/clawGeometry";

const spinne = baueSpinne();

/** Tiefster Eckpunkt aller Meshes unter `knoten` — in Metern unter dem Ursprung. */
function tiefsterPunkt(knoten: THREE.Object3D): { tiefe: number; teil: string } {
  const p = new THREE.Vector3();
  let tiefe = -Infinity;
  let teil = "";
  knoten.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = (o.geometry as THREE.BufferGeometry).getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      o.localToWorld(p);
      if (-p.y > tiefe) {
        tiefe = -p.y;
        teil = o.name || `(unbenannt: ${(o.geometry as THREE.BufferGeometry).type})`;
      }
    }
  });
  return { tiefe, teil };
}

function stelle(splay: number): void {
  for (const g of spinne.gelenke) g.rotation.x = -splay;
  spinne.gruppe.updateMatrixWorld(true);
}

const kralle = spinne.gelenke[0]!;
const namen: string[] = [];
kralle.traverse((o) => {
  if (o.name) namen.push(`${o.type}:${o.name}`);
});
console.log("Knoten unter einer Kralle: " + (namen.join(" · ") || "(alle unbenannt)"));

const zahn = kralle.getObjectByName("tineTip");
console.log(zahn ? "Zahn gefunden: tineTip" : "KEIN Knoten namens tineTip — Messung unsicher");
console.log("");
console.log("Spreizung   clawTipDepth   gezeichnet    Zahn allein   Differenz   tiefstes Teil");

let maxGez = 0;
let maxGezBei = 0;
for (let i = 0; i <= 40; i++) {
  const splay = (CLAW_OPEN_SPLAY * i) / 40;
  stelle(splay);
  const gez = tiefsterPunkt(kralle);
  if (gez.tiefe > maxGez) {
    maxGez = gez.tiefe;
    maxGezBei = splay;
  }
  if (i % 4 !== 0) continue;
  const rech = clawTipDepth(splay);
  const nurZahn = zahn ? tiefsterPunkt(zahn).tiefe : NaN;
  console.log(
    `  ${splay.toFixed(4)}     ${rech.toFixed(4)}       ${gez.tiefe.toFixed(4)}      ` +
      `${nurZahn.toFixed(4)}      ${(gez.tiefe - rech).toFixed(4)}   ${gez.teil}`
  );
}

console.log("");
console.log(`CLAW_MAX_DEPTH meldet             ${CLAW_MAX_DEPTH.toFixed(4)} m`);
console.log(`tiefster gezeichneter Punkt       ${maxGez.toFixed(4)} m (bei Spreizung ${maxGezBei.toFixed(4)})`);
console.log(`Fehlbetrag                        ${(maxGez - CLAW_MAX_DEPTH).toFixed(4)} m`);

/** Wie genau trifft eine Abtastung mit `n` Stufen das wahre Maximum? */
function abtastung(n: number): { wert: number; bei: number } {
  let wert = 0;
  let bei = 0;
  for (let i = 0; i <= n; i++) {
    const s = (CLAW_OPEN_SPLAY * i) / n;
    const v = clawTipDepth(s);
    if (v > wert) {
      wert = v;
      bei = s;
    }
  }
  return { wert, bei };
}
const grob = abtastung(20);
const fein = abtastung(2000);
console.log("");
console.log(`clawTipDepth-Maximum,   20 Stufen: ${grob.wert.toFixed(5)} m bei ${grob.bei.toFixed(4)}`);
console.log(`clawTipDepth-Maximum, 2000 Stufen: ${fein.wert.toFixed(5)} m bei ${fein.bei.toFixed(4)}`);
console.log(`Abtastfehler der groben Stufung:   ${((fein.wert - grob.wert) * 1000).toFixed(2)} mm`);

console.log("");
let imSpiel = 0;
let imSpielBei = 0;
for (let i = 0; i <= 200; i++) {
  const s = CLAW_CLOSED_SPLAY + ((CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * i) / 200;
  stelle(s);
  const t = tiefsterPunkt(kralle).tiefe;
  if (t > imSpiel) {
    imSpiel = t;
    imSpielBei = s;
  }
}
console.log(
  `Nur im gespielten Bereich (ZU…OFFEN): gezeichnet tiefst ${imSpiel.toFixed(4)} m ` +
    `bei Spreizung ${imSpielBei.toFixed(4)}`
);
