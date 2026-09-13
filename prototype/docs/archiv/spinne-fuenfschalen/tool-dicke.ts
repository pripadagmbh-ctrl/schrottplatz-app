/**
 * Dicke der Schale in der WINKELFREIEN Seitenansicht, Station für Station.
 *
 * Gebaut, weil die Form dort beurteilt wird und das Auge im gerenderten Bild
 * eine Einschnürung sieht, die man nicht aus der Zeichnung herausrechnen kann
 * (Ansage 13.09.2026: „die Mitte ist zu dünn, das hat nichts mit dem Blech zu
 * tun"). Gemessen wird deshalb genau das, was man sieht.
 *
 * Verfahren: Alle Dreiecke werden entlang der Breitenachse in die Ebene
 * (−z, y) projiziert und in eine Maske mit 0,5 mm je Pixel gerastert. Danach
 * läuft je Station ein Strahl LÄNGS DER AUSSENNORMALEN des Bogens durch die
 * Maske. Der Punkttest gegen die Dreiecke direkt war dafür untauglich: An einer
 * Stationsgrenze fällt der Abtastpunkt zwischen zwei Float32-Kanten und meldet
 * ein Loch, das es nicht gibt.
 *
 * Die Aussennormale ist (−sin θ, cos θ) in (y, z), nicht (sin θ, cos θ).
 * Mit dem falschen Vorzeichen misst man schräg durch das Bauteil und bekommt
 * Werte, die mit der Form nichts zu tun haben.
 *
 * Aufruf:  npx vite-node tools/dicke.ts
 */
import * as THREE from "three";
import {
  SCHALEN_ABSCHNITTE,
  baueGreiferschale,
  baueGreiferspitze,
  feineStationen,
  schalenEnde,
  stoffe,
} from "../src/grapple/teile";

const st = stoffe();
const g = new THREE.Group();
g.add(baueGreiferschale(st));
const ende = schalenEnde();
const spitze = baueGreiferspitze(st);
spitze.position.set(0, ende.y, ende.z);
spitze.rotation.x = ende.th;
g.add(spitze);
g.updateMatrixWorld(true);

/* Lager und Nähte gehören nicht zur Kontur der Sichel. */
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

const PX = 0.0005;
let ax = Infinity;
let bx = -Infinity;
let ay = Infinity;
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
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / fl;
      const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / fl;
      const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / fl;
      if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) maske[y * W + x] = 1;
    }
}
function drin(z: number, y: number): boolean {
  const i = Math.round((z - ax) / PX + 1.5);
  const j = Math.round((y - ay) / PX + 1.5);
  return i >= 0 && j >= 0 && i < W && j < H && maske[j * W + i] === 1;
}

/* Die Bahn über das Schalenende hinaus verlängern — der Zahn gehört dazu. */
const fein = feineStationen(18);
const BOGEN = fein[1]!.th - fein[0]!.th;
const R = Math.hypot(fein[1]!.y - fein[0]!.y, fein[1]!.z - fein[0]!.z) / (2 * Math.sin(BOGEN / 2));
const Cy = fein[0]!.y + R * Math.sin(fein[0]!.th);
const Cz = fein[0]!.z - R * Math.cos(fein[0]!.th);

console.log("  k     Dicke  Loecher");
let vorher = Infinity;
let ruecksprung = 0;
for (let i = 0; i <= 18 * SCHALEN_ABSCHNITTE + 30; i += 3) {
  const k = i / 18;
  const th = fein[0]!.th + i * BOGEN;
  const px = -(Cz + R * Math.cos(th));
  const py = Cy - R * Math.sin(th);
  const nx = -Math.cos(th);
  const ny = -Math.sin(th);
  let lo = 0;
  let hi = 0;
  let loch = 0;
  let letzt = -999;
  for (let d = -0.06; d <= 0.32; d += 0.0005) {
    if (!drin(px + nx * d, py + ny * d)) continue;
    if (letzt > -900 && d - letzt > 0.0015) loch++;
    letzt = d;
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  const dicke = (hi - lo) * 1000;
  if (dicke < 1) break;
  /* An k = 0 und k = 6 liegt eine Stirnkappe genau in der Strahlrichtung. */
  const randnah = Math.abs(k) < 0.01 || Math.abs(k - SCHALEN_ABSCHNITTE) < 0.01;
  if (dicke > vorher + 0.5) ruecksprung++;
  vorher = dicke;
  console.log(
    `${k.toFixed(2).padStart(5)} ${dicke.toFixed(0).padStart(6)} ${String(randnah ? 0 : loch).padStart(7)}` +
      (k > SCHALEN_ABSCHNITTE ? "   (Zahn)" : "")
  );
}
console.log(
  ruecksprung === 0
    ? "\n  durchgehend duenner werdend, kein Ruecksprung"
    : `\n  ACHTUNG: ${ruecksprung} Stellen werden wieder dicker`
);
