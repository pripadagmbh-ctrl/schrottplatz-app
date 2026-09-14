/**
 * Wächter für die Sichelform: von oben nach unten nur dünner, ohne Loch.
 *
 * Ansage 13.09.2026, nach mehreren Anläufen: „schau dir die dünnsten Stellen
 * bei den äusseren Zähnen an. die dünnsten Stellen sollten am Ende sein, nicht
 * mittig oben" und, auf das winkelfreie Bild: „die mitte ist zu dün, das hat
 * nichts mit dem blech zu tun".
 *
 * Ursache war die Richtung, in der Wölbung, Strebe und Zahn von der Bahn
 * abgetragen wurden. Die Stationen liegen auf einem Kreis mit
 * y = Cy − R·sin θ und z = Cz + R·cos θ; die Aussennormale ist damit
 * (−sin θ, cos θ). Gerechnet war (+sin θ, cos θ) — bei θ = 0 dasselbe, danach
 * um 2θ verdreht: bei Station 3 (43,8°) fast parallel zur Bahn, an der Spitze
 * (80,2°) rückwärts. Die Strebe lag dadurch nicht AUF dem Blech, sondern längs
 * daneben, und in der Seitenansicht klaffte die Schale in der Mitte auf.
 *
 * Der Test misst, was man sieht: die Silhouette längs der Aussennormalen.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  SCHALEN_ABSCHNITTE,
  baueGreiferschale,
  baueGreiferspitze,
  feineStationen,
  schalenEnde,
  stoffe,
} from "../src/fuenfschalen/teile";

/** Seitensilhouette (Blick längs der Breitenachse) als Maske, 1 mm je Pixel. */
function silhouette(): {
  drin: (z: number, y: number) => boolean;
} {
  const st = stoffe();
  const g = new THREE.Group();
  g.add(baueGreiferschale(st));
  const ende = schalenEnde();
  const spitze = baueGreiferspitze(st);
  spitze.position.set(0, ende.y, ende.z);
  spitze.rotation.x = ende.th;
  g.add(spitze);
  g.updateMatrixWorld(true);

  const tri: Array<Array<[number, number]>> = [];
  const v = new THREE.Vector3();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || /AUGE|ANBINDUNG|NAHT/.test(m.name)) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const p: Array<[number, number]> = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        p.push([-v.z, v.y]);
      }
      tri.push(p);
    }
  });

  const PX = 0.001;
  let ax = Infinity;
  let ay = Infinity;
  let bx = -Infinity;
  let by = -Infinity;
  for (const t of tri)
    for (const q of t) {
      ax = Math.min(ax, q[0]!);
      bx = Math.max(bx, q[0]!);
      ay = Math.min(ay, q[1]!);
      by = Math.max(by, q[1]!);
    }
  const W = Math.ceil((bx - ax) / PX) + 4;
  const H = Math.ceil((by - ay) / PX) + 4;
  const maske = new Uint8Array(W * H);
  for (const t of tri) {
    const [a, b, c] = t.map((q) => [(q[0]! - ax) / PX + 2, (q[1]! - ay) / PX + 2]) as [
      [number, number],
      [number, number],
      [number, number],
    ];
    const fl = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(fl) < 1e-12) continue;
    for (
      let y = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
      y <= Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
        x <= Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
        x++
      ) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / fl;
        const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / fl;
        const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / fl;
        if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) maske[y * W + x] = 1;
      }
  }
  return {
    drin: (z, y) => {
      const i = Math.round((z - ax) / PX + 1.5);
      const j = Math.round((y - ay) / PX + 1.5);
      return i >= 0 && j >= 0 && i < W && j < H && maske[j * W + i] === 1;
    },
  };
}

/** Dicke und Lochzahl je Station, längs der Aussennormalen gemessen. */
function profil(): Array<{ k: number; dicke: number; loecher: number }> {
  const { drin } = silhouette();
  const fein = feineStationen(18);
  const BOGEN = fein[1]!.th - fein[0]!.th;
  const R =
    Math.hypot(fein[1]!.y - fein[0]!.y, fein[1]!.z - fein[0]!.z) / (2 * Math.sin(BOGEN / 2));
  const Cy = fein[0]!.y + R * Math.sin(fein[0]!.th);
  const Cz = fein[0]!.z - R * Math.cos(fein[0]!.th);
  const aus: Array<{ k: number; dicke: number; loecher: number }> = [];
  for (let i = 0; i <= 18 * SCHALEN_ABSCHNITTE + 30; i += 3) {
    const th = fein[0]!.th + i * BOGEN;
    const px = -(Cz + R * Math.cos(th));
    const py = Cy - R * Math.sin(th);
    const nx = -Math.cos(th);
    const ny = -Math.sin(th);
    let lo = 0;
    let hi = 0;
    let loecher = 0;
    let letzt = -999;
    for (let d = -0.06; d <= 0.32; d += 0.001) {
      if (!drin(px + nx * d, py + ny * d)) continue;
      if (letzt > -900 && d - letzt > 0.0035) loecher++;
      letzt = d;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    const dicke = (hi - lo) * 1000;
    if (dicke < 1) break;
    aus.push({ k: i / 18, dicke, loecher });
  }
  return aus;
}

describe("Form der Greiferschale in der Seitenansicht", () => {
  const p = profil();

  it("wird von der Aufhängung bis zur Zahnspitze nur dünner", () => {
    const rueck = p.filter((s, i) => i > 0 && s.dicke > p[i - 1]!.dicke + 0.5);
    expect(rueck.map((s) => `k=${s.k.toFixed(2)}: ${s.dicke.toFixed(0)} mm`)).toEqual([]);
  });

  it("ist am Ende am dünnsten, nicht in der Mitte", () => {
    const duennste = p.reduce((a, b) => (b.dicke < a.dicke ? b : a));
    expect(duennste.k).toBe(p[p.length - 1]!.k);
    expect(p[0]!.dicke).toBeGreaterThan(2.5 * duennste.dicke);
  });

  it("hat kein Loch im Querschnitt — die Schale ist ein Guss", () => {
    /* An den Stirnkappen liegt der Strahl in der Flaeche; die zaehlen nicht. */
    const innen = p.filter(
      (s) => Math.abs(s.k) > 0.01 && Math.abs(s.k - SCHALEN_ABSCHNITTE) > 0.01
    );
    expect(innen.filter((s) => s.loecher > 0).map((s) => s.k)).toEqual([]);
  });
});
