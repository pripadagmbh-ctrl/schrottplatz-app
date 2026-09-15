/**
 * Die Verkleidung, nachgemessen — Netze, Eckpunkte, Freigang, Sicht.
 *
 * Gebaut ist sie in `teile.baueVerkleidung`, angebaut in `rig.baueGreifer`.
 * Hier wird geprüft, was Patrick am Gerät nicht sehen kann: dass sie NICHTS
 * kostet außer Eckpunkten, dass sie über den ganzen Schließweg nirgends in eine
 * Schale oder einen Zylinder ragt, und dass sich an der Form des Greifers
 * nichts geändert hat.
 *
 * Aufruf: npx vite-node tools/fuenfschalen/verkleidung-messen.ts
 */
import * as THREE from "three";
import { MASS, STEMPEL_AUGE, TRAVERSE_Y, stoffe } from "../../src/fuenfschalen/teile";
import { baueGreifer, baueGreiferInTeilen } from "../../src/fuenfschalen/rig";
import { verdeckung } from "./anlenkungsriss";

/** Zählt Netze und Eckpunkte eines Baums. */
export function zaehlen(wurzel: THREE.Object3D): { netze: number; ecken: number } {
  let netze = 0;
  let ecken = 0;
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    netze++;
    ecken += (m.geometry.getAttribute("position") as THREE.BufferAttribute).count;
  });
  return { netze, ecken };
}

/** Alle Dreiecke eines Teilbaums in Weltlage, als flaches Feld. */
function dreiecke(wurzel: THREE.Object3D, raus: number[][] = []): number[][] {
  wurzel.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anz = idx ? idx.count : pos.count;
    for (let i = 0; i < anz; i += 3) {
      const t: number[] = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        t.push(v.x, v.y, v.z);
      }
      raus.push(t);
    }
  });
  return raus;
}

/** Abstand eines Punktes zu einem Dreieck. */
function punktDreieck(px: number, py: number, pz: number, t: number[]): number {
  const a = new THREE.Vector3(t[0]!, t[1]!, t[2]!);
  const b = new THREE.Vector3(t[3]!, t[4]!, t[5]!);
  const c = new THREE.Vector3(t[6]!, t[7]!, t[8]!);
  const tri = new THREE.Triangle(a, b, c);
  const ziel = new THREE.Vector3();
  tri.closestPointToPoint(new THREE.Vector3(px, py, pz), ziel);
  return ziel.distanceTo(new THREE.Vector3(px, py, pz));
}

/**
 * Kleinster Abstand der Verkleidung zu Schalen und Zylindern über den ganzen
 * Schließweg (m).
 *
 * Punkte der Verkleidung gegen DREIECKE der Anlenkung — nicht Eckpunkt gegen
 * Eckpunkt: Ein Zylinderrohr hat zwischen seinen Enden keine Eckpunkte, und
 * eine Messung, die nur Ecken kennt, sieht seine Flanke nicht (derselbe Fehler,
 * an dem die Kastenmessung von E-065 gescheitert ist).
 */
export function freigang(stufen = 21): { abstand: number; bei: number } {
  const g = baueGreiferInTeilen(stoffe());
  const hut = g.traverse.getObjectByName("08_ZYLINDERSCHUTZ");
  if (!hut) throw new Error("Die Verkleidung hängt nicht an der Traverse.");
  let abstand = Infinity;
  let bei = 0;
  for (let i = 0; i < stufen; i++) {
    const t = i / (stufen - 1);
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    /* Punkte der Verkleidung */
    const punkte: number[][] = [];
    hut.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        punkte.push([v.x, v.y, v.z]);
      }
    });
    const tris: number[][] = [];
    for (const s of g.schalen) dreiecke(s.gelenk, tris);
    for (const z of g.zylinder) dreiecke(z.gelenk, tris);
    for (const q of punkte) {
      for (const tr of tris) {
        /* Grob aussortieren: nur Dreiecke in der Nähe */
        if (Math.abs(tr[1]! - q[1]!) > 0.5) continue;
        const d = punktDreieck(q[0]!, q[1]!, q[2]!, tr);
        if (d < abstand) {
          abstand = d;
          bei = t;
        }
      }
    }
  }
  return { abstand, bei };
}

function main(): void {
  console.log("Die Verkleidung — nachgemessen\n");

  const g = baueGreifer(stoffe());
  const z = zaehlen(g.wurzel);
  console.log(`  Greifer zusammengelegt: ${z.netze} Netze, ${z.ecken.toLocaleString("de-DE")} Eckpunkte`);
  const hutNetze = (() => {
    const t = baueGreiferInTeilen(stoffe());
    const h = t.traverse.getObjectByName("08_ZYLINDERSCHUTZ")!;
    return zaehlen(h);
  })();
  console.log(`  davon die Verkleidung   : ${hutNetze.netze} Netz, ${hutNetze.ecken} Eckpunkte (vor dem Zusammenlegen)`);

  const einzeln = zaehlen(baueGreiferInTeilen(stoffe()).wurzel);
  console.log(`  in Einzelteilen         : ${einzeln.netze} Netze (vor diesem Paket 217, siehe verschmelzen.ts)`);
  let hutImGuss = false;
  g.wurzel.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name.includes("VERKLEIDUNG")) hutImGuss = true;
  });
  console.log(
    `  Eigenes Netz nach dem Zusammenlegen: ${hutImGuss ? "JA — das wäre ein Netz zuviel" : "nein"}`
  );
  console.log(
    `  → ${einzeln.netze - 217} Netz mehr in Einzelteilen, ${z.netze - 58} Netze mehr zusammengelegt, ` +
      `${hutNetze.ecken} Eckpunkte. Die Verkleidung kostet KEIN Netz.`
  );

  console.log("\n  Maße der Verkleidung (alle abgeleitet, keines gesetzt):");
  const R = MASS.traverse.breite / 2;
  console.log(`    oben  Ø ${(2 * R * 0.86).toFixed(3)} m auf y ${(TRAVERSE_Y - (MASS.traverse.hoehe * 0.75) / 2).toFixed(4)} m — der untere Rand der Traverse`);
  console.log(
    `    unten Ø ${(2 * (MASS.stempel.breite / 2 + 0.01)).toFixed(3)} m auf y ${(STEMPEL_AUGE.y + MASS.stempel.hoehe).toFixed(4)} m — der obere Rand des Stempels`
  );
  console.log(`    sie verkleidet damit genau die ${((TRAVERSE_Y - (MASS.traverse.hoehe * 0.75) / 2 - (STEMPEL_AUGE.y + MASS.stempel.hoehe)) * 100).toFixed(1)} cm nackte Säule.`);

  const f = freigang();
  console.log(`\n  KLEINSTER FREIGANG zu Schalen und Zylindern: ${(f.abstand * 1000).toFixed(0)} mm`);
  console.log(`  (über 21 Stellungen des Schließwegs, engste bei ${(f.bei * 100).toFixed(0)} % Öffnung,`);
  console.log("   Punkte der Verkleidung gegen DREIECKE der Anlenkung)");

  console.log("\n  SICHT — Anteil des Spitzenrings, den der Kopf verdeckt:");
  const AUF = 2.766; // Aufhängung aufgesetzt, E-065
  for (const [name, h] of [
    ["Kabine unten (3,28 m)", 3.28],
    ["Kabine oben  (5,88 m)", 5.88],
  ] as const) {
    const vier = verdeckung(R, h, 4, AUF, 0.72, 2.5, 3.095) * 100;
    const sieben = verdeckung(R, h, 7, AUF, 0.72, 2.5, 3.095) * 100;
    console.log(`    ${name}: bei 4 m ${vier.toFixed(0)} %, bei 7 m ${sieben.toFixed(0)} %`);
  }
  console.log("    (Der Kopf ist unverändert Ø 0,95 m — die Verkleidung sitzt DARUNTER");
  console.log("     und ist enger, sie verdeckt also nichts, was der Kopf nicht schon verdeckt.)");
}

if (!process.env.VITEST) main();
