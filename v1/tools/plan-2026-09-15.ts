/**
 * Grundriss vorher/nachher zum Umzug am 15.09.2026 — Hallen, Silos, Müll.
 *
 * Das „Nachher" wird aus dem Quelltext gerechnet, nicht abgezeichnet: Was hier
 * steht, ist das, was gebaut wird. Das „Vorher" sind die Zahlen vom Abend des
 * 14.09.2026, von Hand eingetragen, weil sie im Quelltext nicht mehr
 * existieren — sie sind mit `// Stand 14.09.` gekennzeichnet.
 *
 * Erzeugen (das Skript läuft nicht von allein, es hat keinen Runner im
 * Projekt):  eine Datei `test/_plan.test.ts` anlegen mit
 *
 *   import { writeFileSync } from "node:fs";
 *   import { zeichnePlan } from "../tools/plan-2026-09-15";
 *   import { it } from "vitest";
 *   it("zeichnet", () => writeFileSync("docs/messungen/2026-09-15_hallen-silos.svg", zeichnePlan()));
 *
 * dann `npx vitest run test/_plan.test.ts` und die Datei wieder löschen.
 */
import { CONFIGS } from "../src/world/containers";
import {
  YARD_MIN_X,
  YARD_MAX_X,
  YARD_D,
  GATE_X,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  KAFFEE_POS,
  KAFFEE_FUSS,
  WEIGH_X,
  WEIGH_Z,
} from "../src/world/yard";
import {
  HALLEN_X,
  HALLEN_Z,
  HALLE_BREITE,
  HALLE_TIEFE,
  TOR_RICHTUNG,
  officeFootprints,
  hallenVorplatz,
} from "../src/world/office";
import { PRESS_CENTER, PRESS_FUSS } from "../src/world/press";
import {
  BAGGER_STAND,
  VERLADE_STAND,
  SCHWENK_INNEN,
  SCHWENK_AUSSEN,
  abstandVomStand,
} from "../src/world/baggerstand";
import {
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  VERLADE_SPUR_X,
  MULDEN_GASSE_X,
  KIPP_SPUR_X,
  KIPP_HALT_Z,
  routeApproach,
  pickupApproach,
  pickupInRev,
  bayApproach,
  TIP_APPROACH,
} from "../src/delivery/routes";

const M = 9; // Pixel je Meter
const RAND = 40;
const BLATT_B = (YARD_MAX_X - YARD_MIN_X + 8) * M + 2 * RAND;
const BLATT_H = (YARD_D + 16) * M + 2 * RAND + 70;

/** Weltkoordinaten auf das Blatt: +x nach rechts, +z nach OBEN. */
function px(x: number): number {
  return RAND + (x - YARD_MIN_X + 4) * M;
}
function pz(z: number): number {
  return RAND + 50 + (YARD_D / 2 + 8 - z) * M;
}

function rechteck(
  x: number,
  z: number,
  hw: number,
  hd: number,
  fill: string,
  stroke: string,
  strich = ""
): string {
  return (
    `<rect x="${px(x - hw).toFixed(1)}" y="${pz(z + hd).toFixed(1)}" ` +
    `width="${(hw * 2 * M).toFixed(1)}" height="${(hd * 2 * M).toFixed(1)}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="1.2"${
      strich ? ` stroke-dasharray="${strich}"` : ""
    }/>`
  );
}
function text(x: number, z: number, s: string, size = 9, farbe = "#222", anker = "middle"): string {
  return `<text x="${px(x).toFixed(1)}" y="${pz(z).toFixed(1)}" font-family="Segoe UI,Arial" font-size="${size}" fill="${farbe}" text-anchor="${anker}">${s}</text>`;
}
function linie(pts: Array<[number, number]>, farbe: string, breite = 1.6, strich = ""): string {
  const d = pts.map(([x, z]) => `${px(x).toFixed(1)},${pz(z).toFixed(1)}`).join(" ");
  return `<polyline points="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}"${
    strich ? ` stroke-dasharray="${strich}"` : ""
  }/>`;
}

export function zeichnePlan(): string {
  const o: string[] = [];
  o.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BLATT_B.toFixed(0)}" height="${BLATT_H.toFixed(
      0
    )}" viewBox="0 0 ${BLATT_B.toFixed(0)} ${BLATT_H.toFixed(0)}">`
  );
  o.push(`<rect width="100%" height="100%" fill="#f7f5f0"/>`);
  o.push(
    `<text x="${RAND}" y="26" font-family="Segoe UI,Arial" font-size="17" fill="#111">Rust'n'Reibach — Platz nach dem Umzug, 15.09.2026</text>`
  );
  o.push(
    `<text x="${RAND}" y="44" font-family="Segoe UI,Arial" font-size="11" fill="#555">Hallen an die Wand neben dem Büro (Tor nach Osten) · Silo-Reihe an die Ostwand, neun auf sechs · Müllmulde aus der Rückfahrspur · Maße in Metern, Norden oben</text>`
  );

  // --- Platzgrenze inkl. Ausbuchtung ---
  const HZ = YARD_D / 2;
  o.push(
    `<polyline points="${[
      [YARD_MIN_X, HZ],
      [YARD_MAX_X, HZ],
      [YARD_MAX_X, -HZ],
      [BUCHT_X_BIS, -HZ],
      [BUCHT_X_BIS, BUCHT_Z],
      [BUCHT_X_VON, BUCHT_Z],
      [BUCHT_X_VON, -HZ],
      [YARD_MIN_X, -HZ],
      [YARD_MIN_X, HZ],
    ]
      .map(([x, z]) => `${px(x).toFixed(1)},${pz(z).toFixed(1)}`)
      .join(" ")}" fill="#efece4" stroke="#7d7466" stroke-width="2.4"/>`
  );
  // Einfahrt
  o.push(linie([[GATE_X - 4.5, HZ], [GATE_X + 4.5, HZ]], "#f7f5f0", 5));
  o.push(text(GATE_X, HZ + 1.6, "EINFAHRT", 9, "#777"));

  // --- Schwenkband ---
  for (const r of [SCHWENK_INNEN, SCHWENK_AUSSEN]) {
    o.push(
      `<circle cx="${px(BAGGER_STAND.x).toFixed(1)}" cy="${pz(BAGGER_STAND.z).toFixed(
        1
      )}" r="${(r * M).toFixed(1)}" fill="none" stroke="#c07b2a" stroke-width="1.1" stroke-dasharray="5 4"/>`
    );
  }
  o.push(
    `<circle cx="${px(BAGGER_STAND.x).toFixed(1)}" cy="${pz(BAGGER_STAND.z).toFixed(
      1
    )}" r="4" fill="#c07b2a"/>`
  );
  o.push(text(BAGGER_STAND.x, BAGGER_STAND.z - 1.6, "SITZ (−0,5 | −22,5)", 8, "#c07b2a"));
  o.push(text(BAGGER_STAND.x + 6.6, BAGGER_STAND.z + 6.9, "Schwenkband 5,8–9,2 m", 8, "#c07b2a"));

  // --- Büro und Hallen: NACHHER ---
  for (const [x, z, hw, hd] of officeFootprints()) {
    o.push(rechteck(x, z, hw, hd, "#d8d2c4", "#6b6257"));
    o.push(text(x, z, "BÜRO", 9, "#4a443b"));
  }
  HALLEN_Z.forEach((z, i) => {
    o.push(rechteck(HALLEN_X, z, HALLE_TIEFE / 2, HALLE_BREITE / 2, "#dfe6ea", "#41627a"));
    o.push(text(HALLEN_X - 0.6, z + 0.4, `HALLE ${i + 1}`, 9, "#2f4a5e"));
    o.push(text(HALLEN_X - 0.6, z - 1.4, "7,5 × 9,0 m", 7, "#6d8496"));
    // Tor als offene Seite
    const tx = HALLEN_X + TOR_RICHTUNG.x * (HALLE_TIEFE / 2);
    o.push(
      linie(
        [
          [tx, z - HALLE_BREITE / 2],
          [tx, z + HALLE_BREITE / 2],
        ],
        "#dfe6ea",
        3.2
      )
    );
    o.push(linie([[tx, z], [tx + 1.8, z]], "#41627a", 1.4));
    o.push(
      `<polygon points="${px(tx + 2.4).toFixed(1)},${pz(z).toFixed(1)} ${px(tx + 1.5).toFixed(
        1
      )},${pz(z + 0.5).toFixed(1)} ${px(tx + 1.5).toFixed(1)},${pz(z - 0.5).toFixed(
        1
      )}" fill="#41627a"/>`
    );
  });
  o.push(text(HALLEN_X + 5.6, HALLEN_Z[0]! + 4.6, "TOR NACH OSTEN", 8, "#41627a", "start"));

  // --- Hallen VORHER (14.09., Nordwand) ---
  for (const [i, hx] of [-14, -5, 4].entries()) {
    // Stand 14.09.: HALLEN_X = [−14, −5, 4], HALLEN_Z = 22
    o.push(rechteck(hx, 22, 7.5 / 2, 9.0 / 2, "none", "#b44", "4 3"));
    if (i === 1) o.push(text(hx, 22 + 5.4, "VORHER: drei Hallen an der Nordwand", 8, "#b44"));
  }

  // --- Waage, Kaffeewagen ---
  o.push(rechteck(WEIGH_X, WEIGH_Z, 1.6, 4.5, "#e6e2d6", "#8a8172"));
  o.push(text(WEIGH_X, WEIGH_Z - 5.6, "WAAGE", 8, "#6b6257"));
  o.push(rechteck(KAFFEE_POS.x, KAFFEE_POS.z, KAFFEE_FUSS[0], KAFFEE_FUSS[1], "#f0dcc0", "#a4762e"));
  o.push(text(KAFFEE_POS.x, KAFFEE_POS.z - 2.4, "JANINE", 8, "#8a5f1e"));

  // --- Presse ---
  o.push(rechteck(PRESS_CENTER.x, PRESS_CENTER.z, PRESS_FUSS.hw, PRESS_FUSS.hd, "#d6cfe2", "#5d4f77"));
  o.push(text(PRESS_CENTER.x, PRESS_CENTER.z, "PRESSE", 9, "#41365a"));

  // --- Behälter ---
  for (const c of CONFIGS) {
    const [w, d] = c.size;
    const halde = c.kind === "halde";
    const lager = c.lager === true;
    o.push(
      rechteck(
        c.x,
        c.z,
        w / 2,
        d / 2,
        halde ? "#e2dcc8" : lager ? "#dcecdc" : "#f2e3d8",
        halde ? "#8a7f60" : lager ? "#3f7040" : "#a8663a"
      )
    );
    o.push(text(c.x, c.z + 0.4, c.label, 8, "#3a3227"));
    const ziel = halde ? c.z + d / 2 : c.z;
    const dist = abstandVomStand(c.x, ziel);
    if (dist <= SCHWENK_AUSSEN + 0.2) {
      o.push(text(c.x, c.z - 1.2, `${dist.toFixed(2)} m`, 7, "#c07b2a"));
      o.push(
        linie(
          [
            [BAGGER_STAND.x, BAGGER_STAND.z],
            [c.x, ziel],
          ],
          "#c07b2a",
          0.7,
          "2 3"
        )
      );
    }
  }

  // --- Silos VORHER (14.09., Westwand x −36, z +10 bis −26,8) ---
  for (let i = 0; i < 9; i++) {
    const z = 10.0 - i * 4.6; // Stand 14.09.
    o.push(rechteck(-36, z, 3.0, 2.1, "none", "#b44", "4 3"));
  }
  o.push(text(-36, 13.6, "VORHER: neun Silos", 8, "#b44"));

  // --- Müll VORHER ---
  o.push(rechteck(7.0, -27.0, 1.8, 1.2, "none", "#b44", "4 3")); // Stand 14.09.
  o.push(text(7.0, -28.8, "VORHER: MÜLL", 7, "#b44"));

  // --- Fahrlinien ---
  const spuren: Array<[string, Array<[number, number]>, string]> = [
    ["Anlieferung → Abladeplatz", routeApproach(), "#2f6f8f"],
    ["Rückfahrspur", [[ABLADE_SPUR_X, -10], [ABLADE_SPUR_X, ABLADE_HALT_Z]], "#2f6f8f"],
    ["Abholer → Verladeplatz", pickupApproach(), "#2f8f5f"],
    ["Abholer rückwärts", pickupInRev(), "#2f8f5f"],
    ["sortenrein → Silo", bayApproach(CONFIGS.find((c) => c.id === "c_alu_lager")!.z), "#7f5f2f"],
    ["Silo-Gasse", [[MULDEN_GASSE_X, 0.8], [MULDEN_GASSE_X, 23.8]], "#7f5f2f"],
    ["Kipper → Abkippen", TIP_APPROACH, "#8f2f6f"],
    ["Kipperspur", [[KIPP_SPUR_X, -7], [KIPP_SPUR_X, KIPP_HALT_Z]], "#8f2f6f"],
  ];
  for (const [, pts, farbe] of spuren) o.push(linie(pts, farbe, 1.5, "7 4"));
  // Zufahrt zu den Hallen (keine Route, nur die freie Linie)
  for (const [vx, vz] of hallenVorplatz()) {
    o.push(linie([[WEIGH_X, WEIGH_Z], [vx, vz], [HALLEN_X - 2.2, vz]], "#41627a", 1.3, "3 4"));
  }

  // --- Verladeplatz ---
  o.push(
    `<circle cx="${px(VERLADE_STAND.x).toFixed(1)}" cy="${pz(VERLADE_STAND.z).toFixed(
      1
    )}" r="4" fill="#2f8f5f"/>`
  );
  o.push(text(VERLADE_STAND.x, VERLADE_STAND.z - 1.6, "VERLADEPLATZ", 8, "#2f8f5f"));
  o.push(
    linie(
      [
        [VERLADE_SPUR_X, VERLADE_STAND.z],
        [CONFIGS.find((c) => c.id === "c_copper_lager")!.x - 3.0, VERLADE_STAND.z],
      ],
      "#2f8f5f",
      1.0
    )
  );
  o.push(text(VERLADE_STAND.x - 3.8, VERLADE_STAND.z + 0.8, "7,5 m", 7, "#2f8f5f"));
  o.push(text(VERLADE_STAND.x + 3.8, VERLADE_STAND.z + 0.8, "7,5 m", 7, "#2f8f5f"));

  // --- Abladeplatz mit echtem Wagenumriss ---
  const bedLen = 5.4;
  o.push(
    rechteck(
      ABLADE_SPUR_X,
      ABLADE_HALT_Z + (bedLen / 2 + 1.9 - (bedLen / 2 + 0.14)) / 2,
      1.55,
      (bedLen + 2.04) / 2,
      "none",
      "#2f6f8f",
      "3 2"
    )
  );
  o.push(text(ABLADE_SPUR_X, ABLADE_HALT_Z, "ABLADEPLATZ", 8, "#2f6f8f"));
  o.push(text(ABLADE_SPUR_X, ABLADE_HALT_Z - 1.4, "(6,3 | −23,0)", 7, "#2f6f8f"));

  // --- Legende ---
  const ly = BLATT_H - 22;
  o.push(
    `<text x="${RAND}" y="${ly}" font-family="Segoe UI,Arial" font-size="10" fill="#555">` +
      `rot gestrichelt = Stand 14.09.2026 (Hallen an der Nordwand, neun Silos an der Westwand, Müll in der Südostecke) · ` +
      `orange = Schwenkband und Abstände vom Sitz · blau = Anlieferung · grün = Abholung · braun = sortenrein · violett = Kipper</text>`
  );
  o.push("</svg>");
  return o.join("\n");
}
