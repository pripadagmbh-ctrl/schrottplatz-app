/**
 * Grundriss vorher/nachher zu E-028: Silo-L, Buntmetall-Mulde, Janine.
 *
 * Das „Nachher" wird aus dem Quelltext gerechnet, nicht abgezeichnet — was
 * hier steht, ist das, was gebaut wird. Das „Vorher" sind die Zahlen vom
 * Vormittag des 15.09.2026, von Hand eingetragen, weil sie im Quelltext nicht
 * mehr existieren; sie sind mit `// Stand 15.09. vormittags` gekennzeichnet.
 *
 * Erzeugen (das Skript hat keinen Runner im Projekt): eine Datei
 * `test/_plan.test.ts` anlegen mit
 *
 *   import { writeFileSync } from "node:fs";
 *   import { zeichnePlan } from "../tools/plan-2026-09-15-silos";
 *   import { it } from "vitest";
 *   it("zeichnet", () =>
 *     writeFileSync("docs/messungen/2026-09-15_silos-l-form.svg", zeichnePlan()));
 *
 * dann `npx vitest run test/_plan.test.ts` und die Datei wieder löschen.
 */
import {
  CONFIGS,
  bayHalb,
  bayVorderkante,
  bayOeffnung,
  type ContainerConfig,
} from "../src/world/containers";
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
  officeFootprints,
} from "../src/world/office";
import { PRESS_CENTER, PRESS_FUSS, KLAPPE_WEG, KLAPPE_RICHTUNG } from "../src/world/press";
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
  MULDEN_GASSE_Z,
  PARK_SLOTS,
  pickupApproach,
  pickupInRev,
  bayApproach,
} from "../src/delivery/routes";

const M = 9.5; // Pixel je Meter
const RAND = 34;
const KOPF = 96;
const BLATT_B = (YARD_MAX_X - YARD_MIN_X + 9) * M + 2 * RAND;
const BLATT_H = (YARD_D + 16) * M + 2 * RAND + KOPF;

/** Weltkoordinaten auf das Blatt: +x nach rechts, +z nach OBEN. */
function px(x: number): number {
  return RAND + (x - YARD_MIN_X + 4.5) * M;
}
function pz(z: number): number {
  return RAND + KOPF + (YARD_D / 2 + 8 - z) * M;
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
  return (
    `<text x="${px(x).toFixed(1)}" y="${pz(z).toFixed(1)}" font-family="Segoe UI,Arial" ` +
    `font-size="${size}" fill="${farbe}" text-anchor="${anker}">${s}</text>`
  );
}
function linie(pts: Array<[number, number]>, farbe: string, breite = 1.6, strich = ""): string {
  const d = pts.map(([x, z]) => `${px(x).toFixed(1)},${pz(z).toFixed(1)}`).join(" ");
  return (
    `<polyline points="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}"` +
    `${strich ? ` stroke-dasharray="${strich}"` : ""}/>`
  );
}
/** Pfeil aus der Mulde heraus — zeigt, wo sie offen ist. */
function oeffnungsPfeil(c: ContainerConfig, farbe: string): string {
  const v = bayVorderkante(c);
  const o = bayOeffnung(c);
  const a: [number, number] = [v.x, v.z];
  const b: [number, number] = [v.x + o.x * 1.7, v.z + o.z * 1.7];
  const q = 0.55;
  return (
    linie([a, b], farbe, 1.5) +
    `<polygon points="${px(b[0]).toFixed(1)},${pz(b[1]).toFixed(1)} ` +
    `${px(b[0] - o.x * 0.8 + o.z * q).toFixed(1)},${pz(b[1] - o.z * 0.8 - o.x * q).toFixed(1)} ` +
    `${px(b[0] - o.x * 0.8 - o.z * q).toFixed(1)},${pz(b[1] - o.z * 0.8 + o.x * q).toFixed(1)}" ` +
    `fill="${farbe}"/>`
  );
}

export function zeichnePlan(): string {
  const o: string[] = [];
  o.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BLATT_B.toFixed(0)}" ` +
      `height="${BLATT_H.toFixed(0)}" viewBox="0 0 ${BLATT_B.toFixed(0)} ${BLATT_H.toFixed(0)}">`
  );
  o.push(`<rect width="100%" height="100%" fill="#f7f5f0"/>`);
  o.push(
    `<text x="${RAND}" y="26" font-family="Segoe UI,Arial" font-size="18" fill="#111">` +
      `Rust'n'Reibach — drei Umzüge, 15.09.2026 (E-028)</text>`
  );
  /*
   * Kopfzeilen kurz halten: Das Blatt ist 633 px breit, und Patrick sieht es
   * auf dem Telefon. Eine Zeile mit 150 Zeichen laeuft rechts aus dem Bild —
   * und ein Plan, den man nicht ganz sieht, ist kein Protokoll.
   */
  for (const [i, zeile] of [
    "1 Silo-Reihe als L: neben die Hallen, dann um die Südwestecke",
    "2 eine Buntmetall-Mulde statt dreier Metallmulden am Bagger",
    "3 Janine an die Nordmauer, neben die Warteplätze",
  ].entries()) {
    o.push(
      `<text x="${RAND}" y="${46 + i * 15}" font-family="Segoe UI,Arial" font-size="11.5" ` +
        `fill="#555">${zeile}</text>`
    );
  }
  o.push(
    `<text x="${RAND}" y="${46 + 3 * 15 + 3}" font-family="Segoe UI,Arial" font-size="10.5" ` +
      `fill="#888">Maße in Metern · Norden oben · rot gestrichelt = Stand vormittags</text>`
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
  o.push(linie([[GATE_X - 4.5, HZ], [GATE_X + 4.5, HZ]], "#f7f5f0", 5));
  o.push(text(GATE_X, HZ + 1.8, "EINFAHRT", 9, "#777"));

  // --- Schwenkband ---
  for (const r of [SCHWENK_INNEN, SCHWENK_AUSSEN]) {
    o.push(
      `<circle cx="${px(BAGGER_STAND.x).toFixed(1)}" cy="${pz(BAGGER_STAND.z).toFixed(1)}" ` +
        `r="${(r * M).toFixed(1)}" fill="none" stroke="#c07b2a" stroke-width="1.1" ` +
        `stroke-dasharray="5 4"/>`
    );
  }
  o.push(
    `<circle cx="${px(BAGGER_STAND.x).toFixed(1)}" cy="${pz(BAGGER_STAND.z).toFixed(1)}" ` +
      `r="4" fill="#c07b2a"/>`
  );
  o.push(text(BAGGER_STAND.x + 0.5, BAGGER_STAND.z - 1.8, "SITZ (−0,5 | −22,5)", 8.5, "#c07b2a"));
  o.push(
    text(BAGGER_STAND.x + 7.2, BAGGER_STAND.z + 7.4, "Schwenkband 5,8–9,2 m", 8, "#c07b2a")
  );

  // --- Büro und Hallen ---
  for (const [x, z, hw, hd] of officeFootprints()) {
    o.push(rechteck(x, z, hw, hd, "#d8d2c4", "#6b6257"));
    o.push(text(x, z, "BÜRO", 9, "#4a443b"));
  }
  HALLEN_Z.forEach((z, i) => {
    o.push(rechteck(HALLEN_X, z, HALLE_TIEFE / 2, HALLE_BREITE / 2, "#dfe6ea", "#41627a"));
    o.push(text(HALLEN_X, z + 0.4, `HALLE ${i + 1}`, 9, "#2f4a5e"));
  });
  o.push(rechteck(WEIGH_X, WEIGH_Z, 1.6, 4.5, "#e6e2d6", "#8a8172"));
  o.push(text(WEIGH_X, WEIGH_Z - 5.8, "WAAGE", 8, "#6b6257"));

  // --- Presse samt Klappenweg ---
  o.push(
    rechteck(PRESS_CENTER.x, PRESS_CENTER.z, PRESS_FUSS.hw, PRESS_FUSS.hd, "#d6cfe2", "#5d4f77")
  );
  o.push(text(PRESS_CENTER.x, PRESS_CENTER.z, "PRESSE", 9, "#41365a"));
  o.push(
    linie(
      [
        [PRESS_CENTER.x, PRESS_CENTER.z],
        [
          PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG,
          PRESS_CENTER.z + KLAPPE_RICHTUNG.z * KLAPPE_WEG,
        ],
      ],
      "#8b7bb0",
      1.4,
      "4 3"
    )
  );
  o.push(
    text(
      PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG - 1.4,
      PRESS_CENTER.z - 1.4,
      "Klappe 3,85 m",
      7,
      "#8b7bb0"
    )
  );

  // --- VORHER, rot gestrichelt ---
  // Stand 15.09. vormittags: Silos an der Ostwand, x +6,5, z 23,8 … 0,8
  for (let i = 0; i < 6; i++) {
    o.push(rechteck(6.5, 23.8 - i * 4.6, 3.0, 2.1, "none", "#b44", "4 3"));
  }
  o.push(text(6.5, 27.4, "VORHER: sechs Silos an der Ostwand", 8.5, "#b44"));
  // Stand 15.09. vormittags: drei Metallmulden an der Westflanke
  for (const [z, name] of [
    [-20.9, "ALU+ZINK 7,28 m"],
    [-16.7, "KABEL 9,17 m"],
    [-12.5, "KU+MSG 12,26 m ✗"],
  ] as Array<[number, string]>) {
    o.push(rechteck(-7.6, z, 2.1, 2.0, "none", "#b44", "4 3"));
    o.push(text(-12.6, z, name, 7, "#b44", "end"));
  }
  // Stand 15.09. vormittags: Janine und der alte Verladeplatz
  o.push(rechteck(-9.5, 15.5, KAFFEE_FUSS[0], KAFFEE_FUSS[1], "none", "#b44", "4 3"));
  o.push(text(-9.5, 13.2, "VORHER: JANINE", 7.5, "#b44"));
  o.push(
    `<circle cx="${px(-4.0).toFixed(1)}" cy="${pz(5.4).toFixed(1)}" r="3.5" fill="none" ` +
      `stroke="#b44" stroke-width="1.2" stroke-dasharray="3 2"/>`
  );
  o.push(text(-4.0, 3.4, "VORHER: VERLADEN", 7.5, "#b44"));

  // --- Behälter NACHHER ---
  for (const c of CONFIGS) {
    const halde = c.kind === "halde";
    const lager = c.lager === true;
    const { hw, hd } = halde ? { hw: c.size[0] / 2, hd: c.size[1] / 2 } : bayHalb(c);
    o.push(
      rechteck(
        c.x,
        c.z,
        hw,
        hd,
        halde ? "#e2dcc8" : lager ? "#dcecdc" : "#f2e3d8",
        halde ? "#8a7f60" : lager ? "#3f7040" : "#a8663a"
      )
    );
    o.push(text(c.x, c.z + 0.4, c.label, 7.5, "#33301f"));
    if (!halde) o.push(oeffnungsPfeil(c, lager ? "#3f7040" : "#a8663a"));
    const ziel = halde ? c.z + c.size[1] / 2 : c.z;
    const dist = abstandVomStand(c.x, ziel);
    if (dist <= SCHWENK_AUSSEN + 0.2) {
      o.push(text(c.x, c.z - 1.3, `${dist.toFixed(2).replace(".", ",")} m`, 7.5, "#c07b2a"));
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

  // --- Die Gasse als L ---
  o.push(
    linie(
      [
        [MULDEN_GASSE_X, -2.0],
        [MULDEN_GASSE_X, MULDEN_GASSE_Z],
        [-20.8, MULDEN_GASSE_Z],
      ],
      "#7f5f2f",
      1.6,
      "7 4"
    )
  );
  o.push(text(MULDEN_GASSE_X + 2.6, -6.0, "GASSE", 7.5, "#7f5f2f", "start"));
  o.push(text(-24.0, MULDEN_GASSE_Z + 1.0, "5,0 m vor den Öffnungen", 7, "#7f5f2f"));
  for (const c of CONFIGS.filter((x) => x.lager === true)) {
    o.push(linie([...bayApproach(c).slice(-2)], "#7f5f2f", 1.0, "2 3"));
  }

  // --- Verladeplatz ---
  o.push(
    `<circle cx="${px(VERLADE_STAND.x).toFixed(1)}" cy="${pz(VERLADE_STAND.z).toFixed(1)}" ` +
      `r="4" fill="#2f8f5f"/>`
  );
  o.push(text(VERLADE_STAND.x, VERLADE_STAND.z - 1.7, "VERLADEPLATZ", 8, "#2f8f5f"));
  o.push(
    linie(
      [
        [-33.0, VERLADE_STAND.z],
        [VERLADE_SPUR_X, VERLADE_STAND.z],
      ],
      "#2f8f5f",
      1.0
    )
  );
  o.push(text(VERLADE_STAND.x - 3.8, VERLADE_STAND.z + 0.9, "7,5 m", 7.5, "#2f8f5f"));
  o.push(text(VERLADE_STAND.x + 3.8, VERLADE_STAND.z + 0.9, "7,5 m", 7.5, "#2f8f5f"));
  for (const r of [pickupApproach(), pickupInRev()]) o.push(linie(r, "#2f8f5f", 1.4, "7 4"));
  o.push(text(VERLADE_SPUR_X + 2.6, VERLADE_STAND.z, "ABHOLER", 7.5, "#2f8f5f", "start"));

  // --- Abladeplatz ---
  const bedLen = 5.4;
  o.push(
    rechteck(
      ABLADE_SPUR_X,
      ABLADE_HALT_Z + (1.9 - 0.14) / 2,
      1.55,
      (bedLen + 2.04) / 2,
      "none",
      "#2f6f8f",
      "3 2"
    )
  );
  o.push(text(ABLADE_SPUR_X, ABLADE_HALT_Z, "ABLADE-", 7.5, "#2f6f8f"));
  o.push(text(ABLADE_SPUR_X, ABLADE_HALT_Z - 1.2, "PLATZ", 7.5, "#2f6f8f"));

  // --- Janine und die Warteplätze ---
  o.push(
    rechteck(KAFFEE_POS.x, KAFFEE_POS.z, KAFFEE_FUSS[0], KAFFEE_FUSS[1], "#f0dcc0", "#a4762e")
  );
  o.push(text(KAFFEE_POS.x, KAFFEE_POS.z + 0.4, "JANINE", 8, "#8a5f1e"));
  for (const [i, [x, z]] of PARK_SLOTS.entries()) {
    o.push(rechteck(x, z - 0.78, 1.55, 4.02, "none", "#8a8172", "2 3"));
    o.push(text(x, z + 3.6, `WARTEN ${i + 1}`, 7, "#8a8172"));
  }

  // --- Legende ---
  const ly = BLATT_H - 34;
  for (const [i, zeile] of [
    "grün = Lagersilo · orange = Mulde am Bagger · Pfeil = offene Seite",
    "braun = Silo-Gasse · dunkelgrün = Abholer · blau = Abladeplatz",
  ].entries()) {
    o.push(
      `<text x="${RAND}" y="${ly + i * 14}" font-family="Segoe UI,Arial" font-size="10.5" ` +
        `fill="#555">${zeile}</text>`
    );
  }
  o.push("</svg>");
  return o.join("\n");
}
