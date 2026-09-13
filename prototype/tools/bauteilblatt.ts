/**
 * Bauteilblatt der Spinne — ein gezeichnetes Blatt statt eines Bildschirmfotos.
 *
 * Warum gezeichnet und nicht gerendert: Die Formarbeit am 12.09.2026 ging
 * fuenfmal hintereinander daneben, weil ich aus der Erinnerung verglichen habe.
 * Was hilft, ist ein Blatt, das man neben die Vorlage legen kann — und das
 * entsteht schneller und verlaesslicher aus der Geometrie selbst als aus einem
 * Bildschirmfoto.
 *
 * Aufruf:  npx vite-node tools/bauteilblatt.ts
 */
import * as THREE from "three";
import { writeFileSync } from "node:fs";
import {
  baueSpinne,
  einzelteile,
  spinnenStoffe,
  type ZylinderAnlenkung,
} from "../src/excavator/grappleParts";
import { CLAW_CLOSED_SPLAY, CLAW_OPEN_SPLAY } from "../src/excavator/clawGeometry";

interface Dreieck {
  p: Array<[number, number]>;
  tiefe: number;
  farbe: string;
}

const LICHT = new THREE.Vector3(0.45, 0.82, 0.36).normalize();

/** Alle Dreiecke eines Objekts, orthogonal projiziert und flach schattiert. */
function dreiecke(wurzel: THREE.Object3D, blick: THREE.Vector3): Dreieck[] {
  wurzel.updateMatrixWorld(true);
  const d = blick.clone().normalize();
  const rechts = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const hoch = d.clone().cross(rechts).normalize();
  const out: Dreieck[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();

  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const idx = geo.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    const mat = m.material as THREE.MeshStandardMaterial;
    const grund = new THREE.Color(mat.color ? mat.color.getHex() : 0x999999);
    for (let i = 0; i < anzahl; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      n.copy(e1.copy(b).sub(a)).cross(e2.copy(c).sub(a));
      if (n.lengthSq() < 1e-12) continue;
      n.normalize();
      if (n.dot(d) < 0) n.negate(); // nur die zugewandte Seite beleuchten
      const hell = 0.32 + 0.68 * Math.max(0, n.dot(LICHT));
      const f = grund.clone().multiplyScalar(hell);
      out.push({
        p: [a, b, c].map((v) => [v.dot(rechts), v.dot(hoch)] as [number, number]),
        tiefe: (a.dot(d) + b.dot(d) + c.dot(d)) / 3,
        farbe: "#" + f.getHexString(),
      });
    }
  });
  out.sort((x, y) => x.tiefe - y.tiefe); // hinten zuerst
  return out;
}

interface Feld {
  name: string;
  obj: THREE.Object3D;
  blick: THREE.Vector3;
}

const BLICK = new THREE.Vector3(0.75, 0.32, 1);
const VORN = new THREE.Vector3(0, 0.05, 1);

/** Ein Feld zeichnen: Rahmen, Titel, Teil, Massangabe. */
function feld(f: Feld, x: number, y: number, w: number, h: number): string {
  const tr = dreiecke(f.obj, f.blick);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of tr) {
    for (const punkt of t.p) {
      if (punkt[0] < x0) x0 = punkt[0];
      if (punkt[0] > x1) x1 = punkt[0];
      if (punkt[1] < y0) y0 = punkt[1];
      if (punkt[1] > y1) y1 = punkt[1];
    }
  }
  const bw = Math.max(x1 - x0, 1e-6);
  const bh = Math.max(y1 - y0, 1e-6);
  const rand = 26;
  const kopf = 30;
  const s = Math.min((w - 2 * rand) / bw, (h - kopf - rand - 16) / bh);
  const cx = x + w / 2 - ((x0 + x1) / 2) * s;
  const cy = y + kopf + (h - kopf - rand - 16) / 2 + ((y0 + y1) / 2) * s;

  const teile = tr
    .map((t) => {
      const d = t.p
        .map(
          (punkt, i) =>
            (i ? "L" : "M") +
            (cx + punkt[0] * s).toFixed(1) +
            "," +
            (cy - punkt[1] * s).toFixed(1)
        )
        .join("");
      return (
        '<path d="' + d + 'Z" fill="' + t.farbe + '" stroke="' + t.farbe + '" stroke-width="0.4"/>'
      );
    })
    .join("");

  return (
    "<g>" +
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" fill="#ffffff" stroke="#c8ccd2" rx="6"/>' +
    '<text x="' + (x + 14) + '" y="' + (y + 21) +
    '" font-family="Segoe UI,Arial" font-size="14" font-weight="600" fill="#22272d">' +
    f.name + "</text>" +
    teile +
    '<text x="' + (x + w - 14) + '" y="' + (y + h - 12) +
    '" text-anchor="end" font-family="Segoe UI,Arial" font-size="11" fill="#6b7280">' +
    bw.toFixed(2) + " × " + bh.toFixed(2) + " m</text>" +
    "</g>"
  );
}

/** Dieselbe Rechnung wie im Bagger — sonst stehen die Zylinder im Nichts. */
function richteZylinder(zyl: ZylinderAnlenkung[]): void {
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (const c of zyl) {
    A.copy(c.obenLokal);
    B.copy(c.untenAmGelenk).applyEuler(c.gelenk.rotation).add(c.gelenk.position);
    dir.copy(B).sub(A);
    const dist = Math.max(dir.length(), 0.2);
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    c.rohr.position.copy(A).addScaledVector(dir, c.rohrLaenge / 2);
    c.rohr.quaternion.copy(q);
    c.rohr.scale.set(1, c.rohrLaenge, 1);
    const stangenLaenge = Math.max(dist - c.rohrLaenge + 0.08, 0.08);
    c.stange.position.copy(B).addScaledVector(dir, -stangenLaenge / 2);
    c.stange.quaternion.copy(q);
    c.stange.scale.set(1, stangenLaenge, 1);
  }
}

function spinneMit(splay: number): THREE.Object3D {
  const s = baueSpinne(spinnenStoffe());
  for (const g of s.gelenke) g.rotation.x = -(splay - CLAW_CLOSED_SPLAY);
  richteZylinder(s.zylinder);
  return s.gruppe;
}

const teile = einzelteile();
const felder: Feld[] = teile.map((t) => ({ name: t.name, obj: t.teil, blick: BLICK }));

const SPALTEN = 4;
const ZELLE_B = 300;
const ZELLE_H = 250;
const LUFT = 12;
const RAND = 24;
const KOPFZEILE = 64;
const reihen = Math.ceil(felder.length / SPALTEN);
const bauB = SPALTEN * ZELLE_B + (SPALTEN - 1) * LUFT;
const GROSS_H = 430;
const breite = RAND * 2 + bauB;
const hoehe = RAND * 2 + KOPFZEILE + reihen * (ZELLE_H + LUFT) + GROSS_H + LUFT;

let svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + breite + '" height="' + hoehe +
  '" viewBox="0 0 ' + breite + " " + hoehe + '">' +
  '<rect width="' + breite + '" height="' + hoehe + '" fill="#eef0f3"/>' +
  '<text x="' + RAND + '" y="' + (RAND + 26) +
  '" font-family="Segoe UI,Arial" font-size="22" font-weight="700" fill="#1b2026">' +
  "Spinne — Bauteile, Stand 13.09.2026</text>" +
  '<text x="' + RAND + '" y="' + (RAND + 48) +
  '" font-family="Segoe UI,Arial" font-size="13" fill="#5b626b">' +
  "Sennebogen MG4.1-800-HO5, im Spiel um ein Viertel vergroessert · " +
  "Bogen 86° · Bolzenkreis 1,83 m · offen 2,73 m Spitzenweite</text>";

felder.forEach((f, i) => {
  const sp = i % SPALTEN;
  const re = Math.floor(i / SPALTEN);
  svg += feld(
    f,
    RAND + sp * (ZELLE_B + LUFT),
    RAND + KOPFZEILE + re * (ZELLE_H + LUFT),
    ZELLE_B,
    ZELLE_H
  );
});

const yGross = RAND + KOPFZEILE + reihen * (ZELLE_H + LUFT);
const grossB = (bauB - 3 * LUFT) / 4;
const gross: Feld[] = [
  { name: "Zusammenbau — geschlossen", obj: spinneMit(CLAW_CLOSED_SPLAY), blick: BLICK },
  { name: "geschlossen, von vorn", obj: spinneMit(CLAW_CLOSED_SPLAY), blick: VORN },
  { name: "Zusammenbau — offen", obj: spinneMit(CLAW_OPEN_SPLAY), blick: BLICK },
  { name: "offen, von vorn", obj: spinneMit(CLAW_OPEN_SPLAY), blick: VORN },
];
gross.forEach((f, i) => {
  svg += feld(f, RAND + i * (grossB + LUFT), yGross, grossB, GROSS_H);
});
svg += "</svg>";

writeFileSync("docs/spinne-bauteile.svg", svg);
console.log(
  "docs/spinne-bauteile.svg  " + breite + "x" + hoehe + ", " + teile.length + " Bauteile"
);
