/**
 * Wo die Netze der beiden Greifer sitzen — Baugruppe fuer Baugruppe.
 *
 * Hintergrund: Die Budgetregel von Patricks Geraet (E-025, gemessen
 * 14.09.2026) lautet „Dreiecke sind fast gratis, BAUTEILE sind teuer".
 * `test/baggerteile.test.ts` haelt den Bagger deshalb bei 57 Netzen — die
 * Spinne ist in dieser Zahl NICHT enthalten. Bevor ein Greifertausch geplant
 * wird, muss beziffert sein, was der neue Greifer an Netzen kostet und wo sie
 * liegen.
 *
 * Aufruf:  npx vite-node tools/greifer-netze.ts
 */
import * as THREE from "three";
import { baueSpinne } from "../src/excavator/grappleParts";
import { baueGreifer } from "../src/fuenfschalen/rig";
import { stoffe } from "../src/fuenfschalen/teile";

/** Netze und Dreiecke eines Teilbaums. */
function zaehl(o: THREE.Object3D): { netze: number; dreiecke: number } {
  let netze = 0;
  let drei = 0;
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    netze++;
    const idx = m.geometry.getIndex();
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    drei += Math.floor((idx ? idx.count : pos.count) / 3);
  });
  return { netze, dreiecke: drei };
}

/** Netze je Werkstoff — was sich ueberhaupt zusammenlegen LIESSE. */
function jeStoff(o: THREE.Object3D): Map<string, number> {
  const raus = new Map<string, number>();
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    const name = mat.name || `#${(mat as THREE.MeshStandardMaterial).color?.getHexString() ?? "?"}`;
    raus.set(name, (raus.get(name) ?? 0) + 1);
  });
  return raus;
}

function bericht(name: string, wurzel: THREE.Object3D, kinder: THREE.Object3D[]): void {
  const g = zaehl(wurzel);
  console.log(`${name}: ${g.netze} Netze, ${g.dreiecke} Dreiecke`);
  for (const k of kinder) {
    const z = zaehl(k);
    console.log(`  ${(k.name || k.type).padEnd(26)}${String(z.netze).padStart(5)} Netze${String(z.dreiecke).padStart(8)} Dreiecke`);
  }
  console.log("  Netze je Werkstoff (Obergrenze des Zusammenlegens):");
  for (const [stoff, n] of [...jeStoff(wurzel)].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${stoff.padEnd(24)}${String(n).padStart(5)}`);
  }
  console.log("");
}

function main(): void {
  const s = baueSpinne();
  bericht("Sichelkralle (grappleParts.baueSpinne)", s.gruppe, [
    ...s.gruppe.children.slice(0, 3),
    s.gelenke[0]!,
  ]);

  const f = baueGreifer(stoffe());
  bericht("Fuenfschalengreifer (fuenfschalen/rig.baueGreifer)", f.wurzel, [
    f.adapter,
    f.traverse,
    f.stempel,
    f.schalen[0]!.gelenk,
    f.zylinder[0]!.gelenk,
  ]);
}

main();
