/**
 * Risszeichnung aus einer three.js-Szene, ohne Browser und ohne WebGL.
 *
 * Orthogonale Projektion, flache Schattierung je Dreieck, Malerreihenfolge.
 * Das reicht, um eine Form zu beurteilen — und es geht ohne Kamerafahrt,
 * Beleuchtung und Bildschirmfoto. Entstanden aus E-127: Verglichen wird Bild an
 * Bild, und dafür braucht es ein Bild, das in einer Sekunde da ist.
 */
import * as THREE from "three";

export interface Dreieck {
  p: Array<[number, number]>;
  tiefe: number;
  farbe: string;
}

const LICHT = new THREE.Vector3(0.45, 0.82, 0.36).normalize();

/** Alle Dreiecke eines Objekts, orthogonal projiziert und flach schattiert. */
export function dreiecke(wurzel: THREE.Object3D, blick: THREE.Vector3): Dreieck[] {
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
      const hell = 0.3 + 0.7 * Math.max(0, n.dot(LICHT));
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

export interface Feld {
  name: string;
  obj: THREE.Object3D;
  blick: THREE.Vector3;
  /** Zusatzzeile unten links, etwa eine Stückzahl oder ein Hinweis. */
  notiz?: string;
}

export const BLICK_SCHRAEG = new THREE.Vector3(0.75, 0.32, 1);
export const BLICK_VORN = new THREE.Vector3(0, 0.05, 1);

/** Ein Feld zeichnen: Rahmen, Titel, Teil, Massangabe. */
export function feld(f: Feld, x: number, y: number, w: number, h: number): string {
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

  const notiz = f.notiz
    ? '<text x="' + (x + 14) + '" y="' + (y + h - 12) +
      '" font-family="Segoe UI,Arial" font-size="11" fill="#6b7280">' + f.notiz + "</text>"
    : "";

  return (
    "<g>" +
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" fill="#ffffff" stroke="#c8ccd2" rx="6"/>' +
    '<text x="' + (x + 14) + '" y="' + (y + 21) +
    '" font-family="Segoe UI,Arial" font-size="14" font-weight="600" fill="#22272d">' +
    f.name + "</text>" +
    teile +
    notiz +
    '<text x="' + (x + w - 14) + '" y="' + (y + h - 12) +
    '" text-anchor="end" font-family="Segoe UI,Arial" font-size="11" fill="#6b7280">' +
    bw.toFixed(2) + " × " + bh.toFixed(2) + " m</text>" +
    "</g>"
  );
}

/** Rahmen eines ganzen Blattes mit Kopfzeile. */
export function blatt(
  breite: number,
  hoehe: number,
  titel: string,
  unterzeile: string,
  inhalt: string
): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + breite + '" height="' + hoehe +
    '" viewBox="0 0 ' + breite + " " + hoehe + '">' +
    '<rect width="' + breite + '" height="' + hoehe + '" fill="#eef0f3"/>' +
    '<text x="24" y="50" font-family="Segoe UI,Arial" font-size="22" font-weight="700" ' +
    'fill="#1b2026">' + titel + "</text>" +
    '<text x="24" y="72" font-family="Segoe UI,Arial" font-size="13" fill="#5b626b">' +
    unterzeile + "</text>" +
    inhalt +
    "</svg>"
  );
}
