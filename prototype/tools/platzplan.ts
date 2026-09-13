/**
 * Grundriss des Schrottplatzes als SVG — von oben, in Metern.
 *
 * Gebaut, weil Umbauten am Platz bisher im Kopf verhandelt wurden und man erst
 * im Spiel sah, was daraus geworden ist. Die Wandlagen stehen nirgends als
 * Zahl im Quelltext, sie fallen aus den Schleifen in `containers.ts` und
 * `yard.ts` heraus. Hier werden dieselben Schleifen nachgerechnet, damit der
 * Plan zeigt, was wirklich gebaut wird — und nicht, was im Kommentar steht.
 *
 * Aufruf:  npx vite-node tools/platzplan.ts
 * Ergebnis: docs/platz.svg
 */
import { writeFileSync } from "node:fs";
import { CONFIGS } from "../src/world/containers";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import {
  YARD_MIN_X,
  YARD_MAX_X,
  YARD_D,
  GATE_X,
  WEIGH_X,
  WEIGH_Z,
  SUED_HOCH,
  SUED_HOCH_VON,
  SUED_HOCH_RAMPE,
} from "../src/world/yard";

const HZ = YARD_D / 2;
const RAND = 46;
const M = 13; // Pixel je Meter
const W = (YARD_MAX_X - YARD_MIN_X) * M + 2 * RAND;
const H = YARD_D * M + 2 * RAND;
const px = (x: number): number => RAND + (x - YARD_MIN_X) * M;
const py = (z: number): number => RAND + (HZ - z) * M;

const teile: string[] = [];
const s = (t: string): void => void teile.push(t);

/** Rechteck aus Mitte und voller Ausdehnung. */
function kasten(
  x: number,
  z: number,
  bx: number,
  bz: number,
  fuell: string,
  strich: string,
  extra = ""
): void {
  s(
    `<rect x="${px(x - bx / 2).toFixed(1)}" y="${py(z + bz / 2).toFixed(1)}" ` +
      `width="${(bx * M).toFixed(1)}" height="${(bz * M).toFixed(1)}" ` +
      `fill="${fuell}" stroke="${strich}" ${extra}/>`
  );
}

function beschriftung(x: number, z: number, t: string, farbe = "#33383f", groesse = 11): void {
  s(
    `<text x="${px(x).toFixed(1)}" y="${py(z).toFixed(1)}" fill="${farbe}" ` +
      `font-size="${groesse}" text-anchor="middle" dominant-baseline="middle" ` +
      `font-family="system-ui,sans-serif">${t}</text>`
  );
}

/* ------------------------------------------------------------------- Boden */
s(`<rect width="${W}" height="${H}" fill="#eef0f3"/>`);
s(
  `<rect x="${px(YARD_MIN_X)}" y="${py(HZ)}" width="${(YARD_MAX_X - YARD_MIN_X) * M}" ` +
    `height="${YARD_D * M}" fill="#dcd8d2"/>`
);
for (let x = Math.ceil(YARD_MIN_X / 5) * 5; x <= YARD_MAX_X; x += 5)
  s(`<line x1="${px(x)}" y1="${py(HZ)}" x2="${px(x)}" y2="${py(-HZ)}" stroke="#00000012"/>`);
for (let z = -Math.floor(HZ / 5) * 5; z <= HZ; z += 5)
  s(
    `<line x1="${px(YARD_MIN_X)}" y1="${py(z)}" x2="${px(YARD_MAX_X)}" y2="${py(z)}" ` +
      `stroke="#00000012"/>`
  );

/* --------------------------------------------------------- Platzumrandung */
/* yard.ts: drei Reihen à 0,6 m = 1,8 m, Einfahrt bei GATE_X ± 4,5 ausgespart. */
const WT = 0.6;
const mauer = (x: number, z: number, bx: number, bz: number): void =>
  kasten(x, z, bx, bz, "#a8a49c", "#6b6862", 'stroke-width="0.7"');
mauer((YARD_MIN_X + YARD_MAX_X) / 2, -HZ, YARD_MAX_X - YARD_MIN_X, WT);
/* Das erhoehte Stueck der Suedmauer — dunkler, mit der Hoehe daneben. */
const hochVon = SUED_HOCH_VON - SUED_HOCH_RAMPE;
kasten(
  (hochVon + YARD_MAX_X) / 2,
  -HZ,
  YARD_MAX_X - hochVon,
  WT * 1.6,
  "#5f6670",
  "#3b4149",
  'stroke-width="0.8"'
);
beschriftung(
  (hochVon + YARD_MAX_X) / 2,
  -HZ + 1.9,
  `Aussenmauer ${SUED_HOCH.toFixed(1).replace(".", ",")} m`,
  "#3b4149",
  10
);
mauer(YARD_MIN_X, 0, WT, YARD_D);
mauer(YARD_MAX_X, 0, WT, YARD_D);
mauer((YARD_MIN_X + GATE_X - 4.5) / 2, HZ, GATE_X - 4.5 - YARD_MIN_X, WT);
mauer((GATE_X + 4.5 + YARD_MAX_X) / 2, HZ, YARD_MAX_X - GATE_X - 4.5, WT);
beschriftung(GATE_X, HZ + 2.2, "EINFAHRT", "#6b6862", 10);

/* ---------------------------------------------- Haldenwaende aus CONFIGS */
/* Dieselben Schleifen wie in containers.ts: Blocklaenge 1,5 m, zwei Lagen. */
const BL = 1.5;
const BT = 0.55;
/** Von wo bis wo laufen die Bloecke einer Wand? */
function spanne(von: number, bis: number, mitte: number): [number, number] {
  let a = Infinity;
  let b = -Infinity;
  for (let t = von; t < bis; t += BL) {
    a = Math.min(a, mitte + t - BL / 2);
    b = Math.max(b, mitte + t + BL / 2);
  }
  return [a, b];
}
for (const c of CONFIGS) {
  if (c.kind !== "halde") continue;
  const [hw, hd] = c.size as [number, number, number];
  const w = c.haldeWaende ?? { rueck: true, aussen: true, trenn: true };
  const plus = c.wandPlus ?? 0;
  const dick = 2 * BT;
  const voll = "#8f8b84";
  const halb = "#aeaaa2"; // halbe Hoehe — heller gezeichnet
  if (w.rueck !== false) {
    const [a, b] = spanne(-hw / 2 + BL / 2, hw / 2 + 0.4, c.x);
    kasten((a + b) / 2, c.z - hd / 2 - BT, b - a, dick, voll, "#5d5a55", 'stroke-width="0.7"');
  }
  if (w.aussen !== false) {
    const [a, b] = spanne(-hd / 2 + BL / 2, hd / 2 + plus + 0.4, c.z);
    kasten(c.x + hw / 2 + BT, (a + b) / 2, dick, b - a, voll, "#5d5a55", 'stroke-width="0.7"');
  }
  if (w.nord === true) {
    const [a, b] = spanne(-hw / 2 + BL / 2, hw / 2 + 0.4, c.x);
    kasten((a + b) / 2, c.z + hd / 2 + BT, b - a, dick, halb, "#5d5a55", 'stroke-width="0.7"');
  }
  if (w.trenn === "voll") {
    const [a, b] = spanne(-hd / 2 + BL / 2, hd / 2 + 0.4, c.z);
    kasten(c.x - hw / 2 - BT, (a + b) / 2, dick, b - a, voll, "#5d5a55", 'stroke-width="0.7"');
  } else if (w.trenn !== false) {
    const [a, b] = spanne(-hd / 2 + BL / 2, -hd / 2 + 2 * BL, c.z);
    kasten(c.x - hw / 2 - BT, (a + b) / 2, dick, b - a, halb, "#5d5a55", 'stroke-width="0.7"');
  }
}

/* --------------------------------------------------------- Stellplaetze */
const FARBE: Record<string, string> = {
  halde: "none",
  pile: "#cdc7bc",
  rolloff: "#b9c5d0",
  bay: "#c3c9cf",
};
for (const c of CONFIGS) {
  const [bx, bz] = c.size as [number, number, number];
  kasten(
    c.x,
    c.z,
    bx,
    bz,
    FARBE[c.kind] ?? "#ccc",
    "#7a7670",
    c.kind === "halde" ? 'stroke-width="0.8" stroke-dasharray="4 3"' : 'stroke-width="0.8"'
  );
  beschriftung(c.x, c.z, c.label, "#2f343a", c.kind === "rolloff" ? 9 : 10);
}

/* ------------------------------------------- Trennsteine zwischen Behaeltern */
/* Dieselbe Regel wie in yard.ts: je zwei Nachbarn mit genug Luecke. */
const rolloffs = CONFIGS.filter((c) => c.sortierbox === true);
for (let i = 0; i < rolloffs.length; i++) {
  for (let j = i + 1; j < rolloffs.length; j++) {
    const a = rolloffs[i]!;
    const b = rolloffs[j]!;
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    const bA = a.size[0] / 2 + b.size[0] / 2;
    const tA = a.size[1] / 2 + b.size[1] / 2;
    if (dz < 0.6 && dx > bA && dx - bA >= BT + 0.1 && dx - bA < 2.0)
      kasten((a.x + b.x) / 2, (a.z + b.z) / 2, BT, Math.min(a.size[1], b.size[1]) + 0.5,
        "#8f8b84", "#5d5a55", 'stroke-width="0.6"');
    if (dx < 0.6 && dz > tA && dz - tA >= BT + 0.1 && dz - tA < 2.0)
      kasten((a.x + b.x) / 2, (a.z + b.z) / 2, Math.min(a.size[0], b.size[0]) + 0.5, BT,
        "#8f8b84", "#5d5a55", 'stroke-width="0.6"');
  }
}

/* ---------------------------------------------------------------- Presse */
kasten(
  PRESS_CENTER.x,
  PRESS_CENTER.z,
  PRESS_INNER.laenge + 0.7,
  PRESS_INNER.tiefe + 0.7,
  "#93a3b3",
  "#4c5a68",
  'stroke-width="1.2"'
);
beschriftung(PRESS_CENTER.x, PRESS_CENTER.z, "PRESSE", "#16202b", 11);

/* -------------------------------------------------------- Bagger, Bauten */
/* Arbeitslinie wie in tools/platz.ts: (−2,5 | −19,5), fuenf Meter nach vorn. */
s(
  `<line x1="${px(-2.5)}" y1="${py(-19.5)}" x2="${px(-2.5)}" y2="${py(-14.5)}" ` +
    `stroke="#c2410c" stroke-width="3" stroke-linecap="round"/>`
);
beschriftung(-2.5, -12.4, "BAGGER", "#c2410c", 10);
kasten(WEIGH_X, WEIGH_Z, 3.2, 8.0, "#c8ccd0", "#7a7670", 'stroke-width="0.8"');
beschriftung(WEIGH_X, WEIGH_Z, "WAAGE", "#2f343a", 9);
kasten(-35.1, 25.5, 9.0, 9.0, "#cfd3d7", "#7a7670", 'stroke-width="0.8"');
beschriftung(-35.1, 25.5, "BÜRO", "#2f343a", 9);
for (const z of [18.8, 11.6]) {
  kasten(-35.1, z, 9.0, 7.2, "#cfd3d7", "#7a7670", 'stroke-width="0.8"');
  beschriftung(-35.1, z, "HALLE", "#2f343a", 9);
}

/* ------------------------------------------------------------ Kopfzeile */
s(
  `<text x="${RAND}" y="24" fill="#16202b" font-size="16" font-weight="600" ` +
    `font-family="system-ui,sans-serif">Schrottplatz — Grundriss von oben</text>`
);
s(
  `<text x="${RAND}" y="40" fill="#6b7280" font-size="11" ` +
    `font-family="system-ui,sans-serif">Gitter 5 m · links im Bild ist rechts vom ` +
    `Fahrersitz · unten ist hinter ihm</text>`
);
s(
  `<line x1="${W - RAND - 5 * M}" y1="${H - 20}" x2="${W - RAND}" y2="${H - 20}" ` +
    `stroke="#33383f" stroke-width="2"/>`
);
s(
  `<text x="${W - RAND - 2.5 * M}" y="${H - 26}" fill="#33383f" font-size="10" ` +
    `text-anchor="middle" font-family="system-ui,sans-serif">5 m</text>`
);

writeFileSync(
  "docs/platz.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" ` +
    `viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">${teile.join("")}</svg>\n`
);
console.log(`docs/platz.svg ${W.toFixed(0)}x${H.toFixed(0)}`);
