/**
 * Patricks Platzkonzept vom 14.09.2026, gezeichnet — die Ausbuchtung.
 *
 * Seine Worte: Misch und Stahlschrott hinter dem Bagger, die Presse beim
 * Mischschrott, beides mit hohen Waenden als Ausbuchtung der Platzgrenze. Die
 * beiden Halden nur durch niedrige Legosteine getrennt, pyramidenfoermig — in
 * der Mitte am hoechsten. Beim Stahlschrott ein grosser schwarzer Muellcontainer,
 * ein kleiner fuer Reifen davor. Wo die Ausbuchtung am Stahlschrott anfaengt,
 * fangen die Mulden an, fuer den Radlader von der Seite anfahrbar. Abgeladen
 * wird vor dem Bagger oder links daneben. Sortenrein direkt in die Silos.
 *
 * Ausrichtung wie tools/platzplan.ts: links im Bild ist rechts vom Fahrersitz.
 */
import { writeFileSync } from "node:fs";

const MIN_X = -40, MAX_X = 10.5, HALB_Z = 29;
const BUCHT_Z = -38.5;                 // wie weit die Ausbuchtung nach hinten geht
const S = 13, RAND = 34;
const W = (MAX_X - MIN_X) * S + RAND * 2;
const H = (HALB_Z - BUCHT_Z) * S + RAND * 2 + 34;
const px = (x) => RAND + (x - MIN_X) * S;
const py = (z) => RAND + 34 + (HALB_Z - z) * S;

const R_INNEN = 5.8, R_AUSSEN = 9.2;
const BAGGER = { x: -0.5, z: -22.5 };

const F = {
  boden: "#E8E4DC", gitter: "#D6D1C6", mauer: "#8C8578", hochmauer: "#6E6558",
  ring: "#2C7A66", ringFlaeche: "rgba(44,122,102,0.14)",
  halde: "#7A6A55", mulde: "#3E6E8C", container: "#A85C22", muell: "#3A3A3C",
  presse: "#6B4E8C", bau: "#9A948A", silo: "#5C7F73",
  lego: "#B08A55", gasse: "#B9563A", text: "#23262A", blass: "#7C7F82", weit: "#A33A24",
};

const ziele = [
  { label: 'MISCHSCHROTT', art: 'halde', x: 4.0, z: -33.7, size: [6.8, 9.0] },
  { label: 'STAHLSCHROTT', art: 'halde', x: -3.0, z: -33.7, size: [6.8, 9.0] },
  { label: 'PRESSE', art: 'presse', x: 7.3, z: -26.0, size: [5.0, 6.2] },
  { label: 'MÜLL', art: 'muell', x: 8.2, z: -21.5, size: [3.4, 3.0] },
  { label: 'REIFEN', art: 'container', x: 5.6, z: -18.5, size: [2.6, 2.4] },
  { label: 'ALU+ZINK', art: 'mulde', x: -8.0, z: -27.2, size: [4.2, 3.2] },
  { label: 'KABEL', art: 'mulde', x: -8.0, z: -23.0, size: [4.2, 3.2] },
  { label: 'KUPFER+MSG', art: 'mulde', x: -8.0, z: -18.8, size: [4.2, 3.2] },
  { label: 'VERLADEN', art: 'abkipp', x: -23.5, z: -6, size: [15, 22] },
  { label: 'ABKIPPEN', art: 'abkipp', x: 1.6, z: -25.2, size: [5.4, 4.2] },
];
const kulisse = [];
const SILOS = ['E-MOTOREN','BATTERIEN','ALU','KABEL','KUPFER','VA','HOLZ','BAUMISCH','KUNSTSTOFF'];
for (let i = 0; i < SILOS.length; i++)
  kulisse.push({ label: SILOS[i], art: 'silo', x: -36, z: 10 - i * 4.6, size: [6, 4.2] });
kulisse.push(
  { label: 'BÜRO', art: 'bau', x: -35.5, z: 23.5, size: [7, 6] },
  { label: 'WAAGE', art: 'bau', x: -27.5, z: 23.5, size: [9, 3.5] },
  { label: 'HALLE 1', art: 'bau', x: -14, z: 22, size: [7.5, 9] },
  { label: 'HALLE 2', art: 'bau', x: -5, z: 22, size: [7.5, 9] },
  { label: 'HALLE 3', art: 'bau', x: 4, z: 22, size: [7.5, 9] });

const d = (o) => Math.hypot(o.x - BAGGER.x, o.z - BAGGER.z);

function kasten(o, mitAbstand) {
  const [b, t] = o.size;
  const farbe = F[o.art] ?? F.bau;
  const abst = mitAbstand ? d(o) : null;
  const drin = abst !== null && abst <= R_AUSSEN + 1.0;
  let s = `<rect x="${px(o.x - b / 2).toFixed(1)}" y="${py(o.z + t / 2).toFixed(1)}"`;
  s += ` width="${(b * S).toFixed(1)}" height="${(t * S).toFixed(1)}"`;
  s += o.art === "abkipp"
    ? ` fill="none" stroke="${F.gasse}" stroke-width="2" stroke-dasharray="8 5" rx="2"/>`
    : ` fill="${farbe}" fill-opacity="${o.art === "silo" ? 0.5 : 0.78}" stroke="${farbe}" stroke-width="1.6" rx="2"/>`;
  const mx = px(o.x), my = py(o.z);
  const tf = o.art === "abkipp" ? F.gasse : "#fff";
  s += `<text x="${mx.toFixed(1)}" y="${(my - 1).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${tf}" font-family="IBM Plex Sans Condensed, sans-serif">${o.label}</text>`;
  if (abst !== null)
    s += `<text x="${mx.toFixed(1)}" y="${(my + 11).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${drin ? "#D9F2E9" : "#FFD9CE"}" font-family="IBM Plex Mono, monospace">${abst.toFixed(1)} m${drin ? "" : " — Fahrt"}</text>`;
  return s;
}

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="IBM Plex Sans, sans-serif">`;
s += `<rect width="${W}" height="${H}" fill="#F5F3EE"/>`;
s += `<text x="${RAND}" y="22" font-size="16" font-weight="700" font-family="IBM Plex Sans Condensed, sans-serif" fill="${F.text}">Platzkonzept — die Ausbuchtung</text>`;
s += `<text x="${RAND}" y="39" font-size="10.5" fill="${F.blass}">Nach Patricks Beschreibung vom 14.09.2026 · Gitter 5 m · links im Bild ist rechts vom Fahrersitz</text>`;

// Platzflaeche inklusive Ausbuchtung
const bxA = -6.5, bxB = 7.5;      // Ausbuchtung von x .. x
s += `<path d="M ${px(MIN_X)} ${py(HALB_Z)} H ${px(MAX_X)} V ${py(-29)} H ${px(bxB)} V ${py(BUCHT_Z)} H ${px(bxA)} V ${py(-29)} H ${px(MIN_X)} Z" fill="${F.boden}" stroke="${F.mauer}" stroke-width="3"/>`;
for (let x = Math.ceil(MIN_X / 5) * 5; x <= MAX_X; x += 5)
  s += `<line x1="${px(x)}" y1="${py(HALB_Z)}" x2="${px(x)}" y2="${py(x >= bxA && x <= bxB ? BUCHT_Z : -29)}" stroke="${F.gitter}" stroke-width="0.7"/>`;
for (let z = BUCHT_Z; z <= HALB_Z; z += 5)
  s += `<line x1="${px(z < -29 ? bxA : MIN_X)}" y1="${py(z)}" x2="${px(z < -29 ? bxB : MAX_X)}" y2="${py(z)}" stroke="${F.gitter}" stroke-width="0.7"/>`;

// Die HOHE Wand um die Ausbuchtung
s += `<path d="M ${px(bxB)} ${py(-29)} V ${py(BUCHT_Z)} H ${px(bxA)} V ${py(-29)}" fill="none" stroke="${F.hochmauer}" stroke-width="7" stroke-linejoin="round"/>`;
s += `<text x="${px((bxA + bxB) / 2).toFixed(1)}" y="${(py(BUCHT_Z) + 20).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${F.hochmauer}">hohe Wand, rundum — die Ausbuchtung</text>`;

// Fahrgassen
const gassen = [
  { label: 'Händler', punkte: [[-22, 29], [-22, 26], [-14, 17]] },
  { label: 'Lambert', punkte: [[-14, 16], [-22, 12], [-29, 6], [-29, -8], [-30, -22]] },
  { label: 'Abholer + Großteile', punkte: [[-22, 29], [-19, 20], [-19, 2], [-20, -20], [-8, -22]] },
];
for (const g of gassen) {
  const p = g.punkte.map(([x, z]) => `${px(x).toFixed(1)},${py(z).toFixed(1)}`).join(" ");
  s += `<polyline points="${p}" fill="none" stroke="${F.gasse}" stroke-width="${4.2 * S}" stroke-opacity="0.10" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<polyline points="${p}" fill="none" stroke="${F.gasse}" stroke-width="1.4" stroke-dasharray="7 5" stroke-opacity="0.8" stroke-linejoin="round"/>`;
}

// Schwenkband
s += `<circle cx="${px(BAGGER.x)}" cy="${py(BAGGER.z)}" r="${R_AUSSEN * S}" fill="${F.ringFlaeche}"/>`;
s += `<circle cx="${px(BAGGER.x)}" cy="${py(BAGGER.z)}" r="${R_INNEN * S}" fill="${F.boden}" fill-opacity="0.9"/>`;
s += `<circle cx="${px(BAGGER.x)}" cy="${py(BAGGER.z)}" r="${R_AUSSEN * S}" fill="none" stroke="${F.ring}" stroke-width="1.4" stroke-dasharray="5 4"/>`;

for (const o of kulisse) s += kasten(o, false);
for (const o of ziele) s += kasten(o, o.art !== "abkipp");

// Pyramiden-Trennsteine zwischen den beiden Halden
const tx = 0.5;
for (let i = 0; i < 9; i++) {
  const z = -29.2 - i * 1.05;
  const mitte = 1 - Math.abs(i - 4) / 4.4;            // in der Mitte am hoechsten
  const hoehe = 0.6 + mitte * 1.8;                     // 0,6 bis 2,4 m
  const bb = 1.0 * S, hh = 0.9 * S;
  s += `<rect x="${(px(tx) - bb / 2).toFixed(1)}" y="${(py(z) - hh / 2).toFixed(1)}" width="${bb.toFixed(1)}" height="${hh.toFixed(1)}" fill="${F.lego}" fill-opacity="${(0.35 + mitte * 0.6).toFixed(2)}" stroke="${F.lego}" stroke-width="1"/>`;
  if (i === 4) s += `<text x="${(px(tx) + 12).toFixed(1)}" y="${(py(z) + 4).toFixed(1)}" font-size="9.5" font-weight="600" fill="${F.lego}" font-family="IBM Plex Mono, monospace">${hoehe.toFixed(1)} m</text>`;
  if (i === 8) s += `<text x="${(px(tx) + 12).toFixed(1)}" y="${(py(z) + 4).toFixed(1)}" font-size="9.5" fill="${F.lego}" font-family="IBM Plex Mono, monospace">0,6 m</text>`;
}
s += `<text x="${(px(tx) + 30).toFixed(1)}" y="${(py(-35.5)).toFixed(1)}" text-anchor="start" font-size="10" font-weight="600" fill="${F.lego}">Trennsteine, Pyramide</text>`;

// Bagger mit Blickrichtung
const bx = px(BAGGER.x), bz = py(BAGGER.z);
s += `<path d="M ${bx} ${bz - 30} l 7 13 l -7 -4 l -7 4 Z" fill="${F.ring}" fill-opacity="0.85"/>`;
s += `<circle cx="${bx}" cy="${bz}" r="10" fill="${F.ring}" stroke="#fff" stroke-width="2"/>`;
s += `<text x="${bx}" y="${bz + 3.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">B</text>`;
s += `<text x="${bx + 16}" y="${bz - 24}" font-size="10" font-weight="600" fill="${F.ring}">Blickrichtung</text>`;
s += `<text x="${bx}" y="${bz + 26}" text-anchor="middle" font-size="9.5" fill="${F.blass}">hinter ihm</text>`;

// Zweiter Baggerstand: Verladen aus dem Silo
const V = { x: -25.5, z: -12 };
s += `<circle cx="${px(V.x)}" cy="${py(V.z)}" r="${R_AUSSEN * S}" fill="${F.ringFlaeche}"/>`;
s += `<circle cx="${px(V.x)}" cy="${py(V.z)}" r="${R_AUSSEN * S}" fill="none" stroke="${F.ring}" stroke-width="1.2" stroke-dasharray="4 5"/>`;
s += `<circle cx="${px(V.x)}" cy="${py(V.z)}" r="9" fill="#F5F3EE" stroke="${F.ring}" stroke-width="2.5"/>`;
s += `<text x="${px(V.x)}" y="${(py(V.z) + 3.5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${F.ring}">B2</text>`;
s += `<text x="${px(V.x)}" y="${(py(V.z) + 26).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${F.ring}">Verladen aus dem Silo</text>`;

const y0 = H - 13;
s += `<line x1="${px(MIN_X)}" y1="${y0}" x2="${px(MIN_X) + 10 * S}" y2="${y0}" stroke="${F.text}" stroke-width="2"/>`;
s += `<text x="${px(MIN_X) + 10 * S + 7}" y="${y0 + 4}" font-size="10" fill="${F.text}">10 m · grünes Band = Schwenkbereich 5,8–9,2 m</text>`;
s += `</svg>`;

writeFileSync("konzept-platz-4.svg", s);
console.log("konzept-ausbuchtung.svg");
for (const o of ziele.filter((o) => o.art !== "abkipp"))
  console.log(`  ${o.label.padEnd(24)} ${d(o).toFixed(1).padStart(5)} m  ${d(o) <= R_AUSSEN + 1 ? "in Reichweite" : "FAHRT"}`);
