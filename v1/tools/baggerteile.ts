/**
 * Die Positionsliste des Baggers: welche Bauteile gibt es, wie heissen sie,
 * wie viele Dreiecke und wie viele Zeichenrufe kosten sie?
 *
 * Anlass (14.09.2026): Am Fuenfschalengreifer heissen die Teile `SHELL_01`,
 * `07_ZAHN`, `ADAPTER` — deshalb kann man ueber sie reden, sie messen und
 * gezielt aendern. Am Bagger trugen 117 von 117 Meshes gar keinen Namen.
 *
 * Die Budgetregel steht in der Kopfzeile der Ausgabe und kommt von Patricks
 * Geraet (14.09.2026: FPS 48 · Frame 21,0 ms · 1322 Zeichenrufe · 240k
 * Dreiecke): Dreiecke sind fast gratis, BAUTEILE sind teuer, und jedes
 * schattenwerfende Teil wird zweimal gezeichnet.
 *
 * Aufruf:  npx vite-node tools/baggerteile.ts
 *          npx vite-node tools/baggerteile.ts --alle   (jedes Mesh einzeln)
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const bagger = new Excavator(scene, world);
bagger.root.updateMatrixWorld(true);

function dreiecke(g: THREE.BufferGeometry): number {
  const index = g.getIndex();
  const pos = g.getAttribute("position");
  if (!pos) return 0;
  return Math.floor((index ? index.count : pos.count) / 3);
}

interface Zeile {
  pfad: string;
  name: string;
  geo: string;
  dreiecke: number;
  schatten: boolean;
}

const zeilen: Zeile[] = [];
let ohneNamen = 0;

function gehe(o: THREE.Object3D, pfad: string): void {
  o.children.forEach((k, i) => {
    const eigen = k.name || `#${i}`;
    const p = `${pfad}/${eigen}`;
    if (k instanceof THREE.Mesh) {
      if (!k.name) ohneNamen++;
      zeilen.push({
        pfad: p,
        name: k.name,
        geo: (k.geometry as THREE.BufferGeometry).type,
        dreiecke: dreiecke(k.geometry as THREE.BufferGeometry),
        schatten: k.castShadow,
      });
    }
    gehe(k, p);
  });
}
gehe(bagger.root, "");

/*
 * Und die Teile, die NICHT unter root haengen: Hydraulikzylinder und
 * Kabinenlenker rechnen in Weltkoordinaten und liegen deshalb lose in der
 * Szene. Sie gehoeren trotzdem zum Bagger. Die Spinne (grappleGroup) bleibt
 * aussen vor — die hat ihre eigene Teileliste in `grappleParts.ts`.
 */
const lose: Zeile[] = [];
for (const o of scene.children) {
  if (o === bagger.root || o === bagger.grappleGroup) continue;
  if (!(o instanceof THREE.Mesh)) continue;
  if (!o.name) ohneNamen++;
  lose.push({
    pfad: `(Szene)/${o.name || "#?"}`,
    name: o.name,
    geo: (o.geometry as THREE.BufferGeometry).type,
    dreiecke: dreiecke(o.geometry as THREE.BufferGeometry),
    schatten: o.castShadow,
  });
}

const dreieckeGesamt = zeilen.reduce((s, z) => s + z.dreiecke, 0);
const zeichenrufe = zeilen.reduce((s, z) => s + (z.schatten ? 2 : 1), 0);

console.log("BAGGER — Positionsliste");
console.log("=======================");
console.log("Budgetregel (Geraetemessung 14.09.2026): Dreiecke sind fast gratis,");
console.log("Bauteile sind teuer. Jedes schattenwerfende Teil kostet ZWEI Zeichenrufe.");
console.log("");
console.log(`Meshes unter root      ${zeilen.length}`);
console.log(`Meshes lose in der Szene ${lose.length}  (Zylinder, Kabinenlenker)`);
console.log(`davon ohne Namen       ${ohneNamen}`);
console.log(`Dreiecke gesamt        ${dreieckeGesamt} (nur root)`);
console.log(`Zeichenrufe (geschaetzt) ${zeichenrufe} (nur root)`);
console.log("");

// Zusammenfassung je Baugruppe = je Ast unter root
console.log("Baugruppe                        Meshes  Dreiecke  Zeichenrufe  ohne Namen");
const aeste = new Map<string, Zeile[]>();
for (const z of zeilen) {
  const ast = z.pfad.split("/")[1] ?? "?";
  const liste = aeste.get(ast) ?? [];
  liste.push(z);
  aeste.set(ast, liste);
}
for (const [ast, liste] of aeste) {
  const d = liste.reduce((s, z) => s + z.dreiecke, 0);
  const r = liste.reduce((s, z) => s + (z.schatten ? 2 : 1), 0);
  const u = liste.filter((z) => !z.name).length;
  console.log(
    `${ast.padEnd(32)} ${String(liste.length).padStart(6)}  ${String(d).padStart(8)}  ` +
      `${String(r).padStart(11)}  ${String(u).padStart(9)}`
  );
}

if (process.argv.includes("--alle")) {
  console.log("");
  console.log("Jedes Mesh einzeln:");
  console.log("Pfad                                                  Dreiecke  Schatten  Geometrie");
  for (const z of [...zeilen, ...lose]) {
    console.log(
      `${z.pfad.padEnd(52).slice(0, 52)}  ${String(z.dreiecke).padStart(8)}  ` +
        `${(z.schatten ? "ja" : "nein").padStart(8)}  ${z.geo}`
    );
  }
}
