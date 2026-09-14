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
  routeApproach,
  pickupApproach,
  pickupInRev,
  bayApproach,
  bayInRev,
  TIP_APPROACH,
  TIP_IN_REV,
  ABKIPP_ZONE,
} from "../src/delivery/routes";
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
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  TRENNSTEINE,
  TRENNSTEIN_X,
  TRENNSTEIN_L,
  TRENNSTEIN_T,
} from "../src/world/yard";
import { BAGGER_STAND, VERLADE_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { hallenFootprints, officeFootprints } from "../src/world/office";

const HZ = YARD_D / 2;
const RAND = 46;
const M = 13; // Pixel je Meter
const W = (YARD_MAX_X - YARD_MIN_X) * M + 2 * RAND;
/* Die Ausbuchtung ragt nach Sueden ueber den Platz hinaus — sie braucht Bild. */
const H = (YARD_D + (-BUCHT_Z - HZ)) * M + 2 * RAND;
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
/* Die Ausbuchtung hinter dem Bagger (E-010) */
s(
  `<rect x="${px(BUCHT_X_VON)}" y="${py(-HZ)}" width="${(BUCHT_X_BIS - BUCHT_X_VON) * M}" ` +
    `height="${(-BUCHT_Z - HZ) * M}" fill="#dcd8d2"/>`
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
/* Die Suedmauer in zwei Stuecken — dazwischen geht die Ausbuchtung auf. */
mauer((YARD_MIN_X + BUCHT_X_VON) / 2, -HZ, BUCHT_X_VON - YARD_MIN_X, WT);
mauer((BUCHT_X_BIS + YARD_MAX_X) / 2, -HZ, YARD_MAX_X - BUCHT_X_BIS, WT);
/* Das erhoehte Stueck der Suedmauer — dunkler, mit der Hoehe daneben. */
const hochVon = SUED_HOCH_VON - SUED_HOCH_RAMPE;
const hochMauer = (x: number, z: number, bx: number, bz: number): void =>
  kasten(x, z, bx, bz, "#5f6670", "#3b4149", 'stroke-width="0.8"');
hochMauer((hochVon + BUCHT_X_VON) / 2, -HZ, BUCHT_X_VON - hochVon, WT * 1.6);
hochMauer((BUCHT_X_BIS + YARD_MAX_X) / 2, -HZ, YARD_MAX_X - BUCHT_X_BIS, WT * 1.6);
/* Die drei Waende der Ausbuchtung, alle auf voller Hoehe */
for (const bx of [BUCHT_X_VON, BUCHT_X_BIS])
  hochMauer(bx, (-HZ + BUCHT_Z) / 2, WT * 1.6, -HZ - BUCHT_Z);
hochMauer((BUCHT_X_VON + BUCHT_X_BIS) / 2, BUCHT_Z, BUCHT_X_BIS - BUCHT_X_VON, WT * 1.6);
beschriftung(
  (BUCHT_X_VON + BUCHT_X_BIS) / 2,
  BUCHT_Z - 1.6,
  `Ausbuchtung, Wand ${SUED_HOCH.toFixed(1).replace(".", ",")} m`,
  "#3b4149",
  10
);
/* Die Trennsteine zwischen den Halden — je dunkler, desto hoeher. */
for (const t of TRENNSTEINE) {
  const grau = Math.round(190 - (t.hoehe / 2.4) * 90);
  kasten(
    TRENNSTEIN_X,
    t.z,
    TRENNSTEIN_T,
    TRENNSTEIN_L,
    `rgb(${grau + 20},${grau},${grau - 25})`,
    "#6b5535",
    'stroke-width="0.6"'
  );
}
beschriftung(TRENNSTEIN_X + 2.6, -34.0, "Trennsteine 0,6–2,4 m", "#6b5535", 9);
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
/* Die beiden Standplaetze mit ihrem Schwenkband (world/baggerstand.ts). */
for (const [stand, name] of [
  [BAGGER_STAND, "BAGGER"],
  [VERLADE_STAND, "VERLADEN"],
] as Array<[{ x: number; z: number }, string]>) {
  s(
    `<circle cx="${px(stand.x)}" cy="${py(stand.z)}" r="${SCHWENK_AUSSEN * M}" ` +
      `fill="#2c7a6622" stroke="#2c7a66" stroke-width="1" stroke-dasharray="5 4"/>`
  );
  s(
    `<circle cx="${px(stand.x)}" cy="${py(stand.z)}" r="${SCHWENK_INNEN * M}" ` +
      `fill="#dcd8d2" fill-opacity="0.85" stroke="#2c7a66" stroke-width="0.7" ` +
      `stroke-dasharray="3 4"/>`
  );
  s(
    `<circle cx="${px(stand.x)}" cy="${py(stand.z)}" r="9" fill="#c2410c" ` +
      `stroke="#fff" stroke-width="2"/>`
  );
  beschriftung(stand.x, stand.z - 2.0, name, "#c2410c", 10);
}
kasten(WEIGH_X, WEIGH_Z, 4.6, 9.0, "#c8ccd0", "#7a7670", 'stroke-width="0.8"');
beschriftung(WEIGH_X, WEIGH_Z, "WAAGE", "#2f343a", 9);
for (const [x, z, hw, hd] of officeFootprints()) {
  kasten(x, z, hw * 2, hd * 2, "#cfd3d7", "#7a7670", 'stroke-width="0.8"');
  beschriftung(x, z, "BÜRO", "#2f343a", 9);
}
hallenFootprints().forEach(([x, z, hw, hd], i) => {
  kasten(x, z, hw * 2, hd * 2, "#cfd3d7", "#7a7670", 'stroke-width="0.8"');
  beschriftung(x, z, `HALLE ${i + 1}`, "#2f343a", 9);
});

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

/* ------------------------------------------------ Fahrspuren und Abkippen */
/*
 * Die echten Strecken aus `delivery/routes.ts`, nicht gemalte. Der
 * Konzeptplan zeichnet daneben eine Abkippzone hinter dem Bagger; gebaut ist
 * sie VOR ihm, links neben der Maschine — hinter ihm kommt kein Fahrzeug
 * vorbei, solange sie auf ihrem Platz steht (siehe Kommentar bei
 * `KIPP_SPUR_X`). Wer die beiden Bilder nebeneinanderlegt, soll genau das
 * sehen.
 */
for (const [name, weg] of [
  ["Anlieferung", routeApproach()],
  ["Kipper", TIP_APPROACH.concat(TIP_IN_REV.slice(1))],
  ["Abholer", pickupApproach().concat(pickupInRev().slice(1))],
  ["sortenrein", bayApproach(-13).concat(bayInRev(-13).slice(1))],
] as Array<[string, Array<[number, number]>]>) {
  const punkte = weg.map(([x, z]) => `${px(x).toFixed(1)},${py(z).toFixed(1)}`).join(" ");
  s(
    `<polyline points="${punkte}" fill="none" stroke="#c2410c" stroke-width="${(4.2 * M).toFixed(
      1
    )}" stroke-opacity="0.07" stroke-linejoin="round" stroke-linecap="round"/>`
  );
  s(
    `<polyline points="${punkte}" fill="none" stroke="#c2410c" stroke-width="1.2" ` +
      `stroke-dasharray="7 5" stroke-opacity="0.75" stroke-linejoin="round"/>`
  );
  const [ex, ez] = weg[weg.length - 1]!;
  beschriftung(ex, ez - 1.4, name, "#c2410c", 9);
}
kasten(ABKIPP_ZONE[0], ABKIPP_ZONE[1], 5.4, 4.2, "none", "#b9563a", 'stroke-width="2" stroke-dasharray="8 5"');
beschriftung(ABKIPP_ZONE[0], ABKIPP_ZONE[1], "ABKIPPEN", "#b9563a", 10);

/* --------------------------------------------- Abnahmetabelle, gemessen */
/*
 * Die Zahlen, die in E-010 als Abnahmekriterium stehen — aber aus dem
 * GEBAUTEN Platz gerechnet, nicht aus dem Konzeptplan abgeschrieben. Wer die
 * beiden Bilder nebeneinanderlegt, sieht die Form; diese Liste sagt, wo sie
 * auseinanderlaufen.
 */
const abstand = (x: number, z: number): number =>
  Math.hypot(x - BAGGER_STAND.x, z - BAGGER_STAND.z);
const ziele: Array<[string, number]> = [];
for (const id of ["c_mixed", "c_steel", "r_alu", "r_cable", "r_copper", "r_rubble", "c_tires"]) {
  const c = CONFIGS.find((k) => k.id === id)!;
  // Bei einer Halde zaehlt die vordere Kante, sonst die Mitte (E-010).
  const z = c.kind === "halde" ? c.z + c.size[1] / 2 : c.z;
  ziele.push([c.label, abstand(c.x, z)]);
}
ziele.push(["PRESSE", abstand(PRESS_CENTER.x, PRESS_CENTER.z)]);
console.log("Ziel                      Abstand   im Schwenkband 5,8–9,2 m?");
for (const [label, d] of ziele) {
  const drin = d >= SCHWENK_INNEN && d <= SCHWENK_AUSSEN;
  console.log(`${label.padEnd(24)} ${d.toFixed(2).padStart(6)} m   ${drin ? "ja" : "NEIN"}`);
}
const siloKante = CONFIGS.find((c) => c.id === "c_va_lager")!;
console.log(
  `Verladeplatz: ${(VERLADE_STAND.x - (siloKante.x + siloKante.size[0] / 2)).toFixed(2)} m ` +
    `zur Silo-Vorderkante, ${(VERLADE_STAND.x + 7.5 - VERLADE_STAND.x).toFixed(2)} m zur LKW-Spur`
);

writeFileSync(
  "docs/platz.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(0)}" height="${H.toFixed(0)}" ` +
    `viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}">${teile.join("")}</svg>\n`
);
console.log(`docs/platz.svg ${W.toFixed(0)}x${H.toFixed(0)}`);
