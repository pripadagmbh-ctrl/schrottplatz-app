/**
 * Kompakte Silhouette fuer die Anzeige im Chat.
 *
 * Dasselbe Bild wie `silhouette.ts`, aber auf ein Zehntel der Groesse
 * gebracht: Dreiecke gleicher Farbe wandern in einen gemeinsamen Pfad,
 * Koordinaten werden auf ganze Pixel gerundet, und Schweissnaehte sowie
 * Kleinteile bleiben weg — in einer Silhouette sieht man sie ohnehin nicht.
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { stoffe } from "../../src/fuenfschalen/teile";
import { baueGreifer } from "../../src/fuenfschalen/rig";
import { dreiecke } from "../riss";

function bild(oeffnung: number, breite: number, hoehe: number): string {
  const g = baueGreifer(stoffe());
  g.setOeffnung(oeffnung);
  g.wurzel.updateMatrixWorld(true);
  g.wurzel.traverse((o) => {
    if (o.name === "SCHWEISSNAHT") o.visible = false;
  });
  /*
   * Rueckseiten weglassen. Der Koerper ist geschlossen, also verdeckt die
   * Vorderseite die Rueckseite ohnehin — und das halbiert die Datei. Geprueft
   * wird die Umlaufrichtung des projizierten Dreiecks: Eine Orientierung zeigt
   * zur Kamera, die andere weg.
   */
  const tr = dreiecke(g.wurzel, new THREE.Vector3(0, 0, 1)).filter((t) => {
    const [a, b, c] = t.p as Array<[number, number]>;
    const flaeche = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    return flaeche > 4e-5;
  });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const t of tr) for (const q of t.p) {
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  const s = Math.min((breite - 20) / (x1 - x0), (hoehe - 20) / (y1 - y0));
  const cx = breite / 2 - ((x0 + x1) / 2) * s;
  const cy = hoehe / 2 + ((y0 + y1) / 2) * s;
  const nachFarbe = new Map<string, string[]>();
  for (const t of tr) {
    const d = t.p
      .map((q, i) => (i ? "L" : "M") + Math.round(cx + q[0] * s) + "," + Math.round(cy - q[1] * s))
      .join("") + "Z";
    const liste = nachFarbe.get(t.farbe) ?? [];
    liste.push(d);
    nachFarbe.set(t.farbe, liste);
  }
  let out = "";
  for (const [farbe, pfade] of nachFarbe) {
    out += '<path fill="' + farbe + '" stroke="' + farbe + '" stroke-width="0.6" d="' + pfade.join("") + '"/>';
  }
  return out;
}

const B = 260, H = 380;
let svg = "";
["geschlossen", "halb", "offen"].forEach((name, i) => {
  svg += '<g transform="translate(' + (i * (B + 8)) + ',26)">' +
    '<rect width="' + B + '" height="' + H + '" fill="#ffffff" stroke="#c8ccd2" rx="6"/>' +
    bild(i / 2, B, H) +
    '<text x="12" y="20" font-family="Segoe UI,Arial" font-size="13" font-weight="600" fill="#22272d">' +
    name + "</text></g>";
});
const ganz =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (3 * B + 16) + " " + (H + 34) + '">' +
  '<rect width="' + (3 * B + 16) + '" height="' + (H + 34) + '" fill="#eef0f3"/>' +
  '<text x="4" y="20" font-family="Segoe UI,Arial" font-size="14" font-weight="700" fill="#1b2026">' +
  "5-Schalen-Mehrschalengreifer — Silhouette von vorn</text>" + svg + "</svg>";
writeFileSync("docs/f5-greifer-kompakt.svg", ganz);
console.log("docs/f5-greifer-kompakt.svg " + (ganz.length / 1024).toFixed(0) + " kB");
