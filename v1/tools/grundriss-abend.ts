/**
 * Der Platz nach dem Umbau vom Abend des 14.09.2026 — gezeichnet aus dem,
 * was gebaut ist.
 *
 * Anlass: Der LKW-Abladeplatz zieht auf die alte Pressenstelle, die Presse an
 * die Westflanke, die Ausbuchtung wird flacher, der Reifencontainer faellt
 * weg. Das verschiebt genug, dass ein Bild dazugehoert: Patrick entscheidet
 * am Grundriss, nicht am Messwert.
 *
 * Gezeichnet wird aus den echten Zahlen — `mauerLaeufe()`, `CONFIGS`,
 * `PRESS_*`, `routes.ts` —, nicht aus einer zweiten Liste. Was hier steht,
 * steht auch im Spiel.
 *
 * Aufruf:  npx vite-node tools/grundriss-abend.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { CONFIGS, MULDE_STEIN } from "../src/world/containers";
import {
  mauerLaeufe,
  MAUER_STEIN,
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  TRENNSTEINE,
  TRENNSTEIN_X,
  TRENNSTEIN_L,
  WEIGH_X,
  WEIGH_Z,
  SCHILD_POS,
  SCHILD_B,
} from "../src/world/yard";
import {
  PRESS_CENTER,
  PRESS_INNER,
  PRESS_FUSS,
  KLAPPE_WEG,
  KLAPPE_RICHTUNG,
} from "../src/world/press";
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
  BED_HALF_W,
  ABKIPP_ZONE,
  KIPP_SPUR_X,
  KIPP_HALT_Z,
  MULDEN_GASSE_X,
  VERLADE_SPUR_X,
  routeApproach,
  routeInRev,
  TIP_APPROACH,
  TIP_IN_REV,
  pickupApproach,
  pickupInRev,
} from "../src/delivery/routes";
import { hallenFootprints, officeFootprints } from "../src/world/office";

mkdirSync("docs/messungen", { recursive: true });

const F = {
  weiss: "#ffffff",
  rahmen: "#c8ccd2",
  text: "#1b2026",
  blass: "#5b626b",
  stein: "#b6b2a8",
  steinKante: "#8b877e",
  halde: "#7a6a55",
  mulde: "#3e6e8c",
  muell: "#3a3a3c",
  presse: "#6b4e8c",
  silo: "#5c7f73",
  bau: "#9a948a",
  ring: "#2c7a66",
  ringFlaeche: "rgba(44,122,102,0.12)",
  spur: "#c9a227",
  lkw: "#a33a24",
  alt: "#b9b4ac",
};

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const zahl = (n: number, stellen = 2): string => n.toFixed(stellen).replace(".", ",");
const t = (
  x: number,
  y: number,
  s: string,
  groesse = 12,
  farbe = F.text,
  anker = "start",
  fett = 400
): string =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Segoe UI,Arial" font-size="${groesse}" font-weight="${fett}" fill="${farbe}" text-anchor="${anker}">${esc(s)}</text>`;
const kasten = (x: number, y: number, w: number, h: number, titel: string): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${F.weiss}" stroke="${F.rahmen}" rx="6"/>` +
  t(x + 14, y + 21, titel, 14, F.text, "start", 600);
const blatt = (b: number, h: number, titel: string, unter: string, inhalt: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${h}" viewBox="0 0 ${b} ${h}">` +
  `<rect width="${b}" height="${h}" fill="#eef0f3"/>` +
  t(24, 50, titel, 22, "#1b2026", "start", 700) +
  t(24, 72, unter, 13, F.blass) +
  inhalt +
  "</svg>";

/* ===================================================== Der Grundriss ===== */
{
  const W = 1240;
  const H = 820;
  const S = 7.4; // Pixel je Meter
  const px = (x: number): number => 157 + (x - YARD_MIN_X) * S;
  const py = (z: number): number => 130 + (42 - z) * S;
  let inhalt = kasten(24, 96, 640, 700, "Gebauter Platz, Stand 14.09.2026 abends");

  // --- Umland: Mauern
  for (const l of mauerLaeufe()) {
    const dick = MAUER_STEIN.dicke * S;
    if (l.achse === "x")
      inhalt += `<rect x="${px(l.von).toFixed(1)}" y="${(py(l.fest) - dick / 2).toFixed(1)}" width="${((l.bis - l.von) * S).toFixed(1)}" height="${dick.toFixed(1)}" fill="${F.stein}"/>`;
    else
      inhalt += `<rect x="${(px(l.fest) - dick / 2).toFixed(1)}" y="${py(l.bis).toFixed(1)}" width="${dick.toFixed(1)}" height="${((l.bis - l.von) * S).toFixed(1)}" fill="${F.stein}"/>`;
  }

  // --- Schwenkband
  for (const r of [SCHWENK_INNEN, SCHWENK_AUSSEN]) {
    inhalt += `<circle cx="${px(BAGGER_STAND.x).toFixed(1)}" cy="${py(BAGGER_STAND.z).toFixed(1)}" r="${(r * S).toFixed(1)}" fill="${r === SCHWENK_AUSSEN ? F.ringFlaeche : "none"}" stroke="${F.ring}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
  }

  // --- Behälter aus CONFIGS
  const farbeFuer = (id: string, kind: string): string =>
    id === "r_rubble" ? F.muell : kind === "halde" ? F.halde : kind === "bay" ? F.mulde : F.silo;
  for (const c of CONFIGS) {
    const nord = c.facing === "north";
    const w = (nord ? c.size[1] : c.size[0]) * S;
    const d = (nord ? c.size[0] : c.size[1]) * S;
    const lager = c.lager === true;
    inhalt += `<rect x="${(px(c.x) - w / 2).toFixed(1)}" y="${(py(c.z) - d / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${d.toFixed(1)}" fill="${farbeFuer(c.id, c.kind)}" fill-opacity="${lager ? 0.25 : 0.45}" stroke="${farbeFuer(c.id, c.kind)}" stroke-width="1.2"/>`;
    if (!lager)
      inhalt += t(px(c.x), py(c.z) + 3, c.label.replace(" + ", "+"), 8.5, "#20262c", "middle", 600);
  }
  inhalt += t(px(-36), py(10) - 14, "SILO-REIHE (9)", 9, F.silo, "middle", 600);

  // --- Trennsteine
  for (const st of TRENNSTEINE)
    inhalt += `<rect x="${(px(TRENNSTEIN_X) - 3).toFixed(1)}" y="${(py(st.z) - (TRENNSTEIN_L * S) / 2).toFixed(1)}" width="6" height="${(TRENNSTEIN_L * S).toFixed(1)}" fill="#b08a55" fill-opacity="${(0.3 + st.hoehe / 4).toFixed(2)}" stroke="#b08a55"/>`;

  // --- Presse mit Klappenschwenk
  inhalt += `<rect x="${(px(PRESS_CENTER.x) - PRESS_FUSS.hw * S).toFixed(1)}" y="${(py(PRESS_CENTER.z) - PRESS_FUSS.hd * S).toFixed(1)}" width="${(PRESS_FUSS.hw * 2 * S).toFixed(1)}" height="${(PRESS_FUSS.hd * 2 * S).toFixed(1)}" fill="${F.presse}" fill-opacity="0.5" stroke="${F.presse}" stroke-width="1.4"/>`;
  inhalt += t(px(PRESS_CENTER.x), py(PRESS_CENTER.z) + 3, "PRESSE", 9, "#ffffff", "middle", 700);
  const klx = PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG;
  const klz = PRESS_CENTER.z + KLAPPE_RICHTUNG.z * KLAPPE_WEG;
  inhalt += `<line x1="${px(PRESS_CENTER.x)}" y1="${py(PRESS_CENTER.z)}" x2="${px(klx)}" y2="${py(klz)}" stroke="${F.presse}" stroke-width="1.2" stroke-dasharray="3 3"/>`;
  inhalt += t(px(klx) - 4, py(klz) - 6, "Klappe offen", 8, F.presse, "end");

  // --- Bauten
  for (const [x, z, hw, hd] of officeFootprints())
    inhalt += `<rect x="${px(x - hw)}" y="${py(z + hd)}" width="${(hw * 2 * S).toFixed(1)}" height="${(hd * 2 * S).toFixed(1)}" fill="${F.bau}" fill-opacity="0.7"/>`;
  hallenFootprints().forEach(([x, z, hw, hd], i) => {
    inhalt += `<rect x="${px(x - hw)}" y="${py(z + hd)}" width="${(hw * 2 * S).toFixed(1)}" height="${(hd * 2 * S).toFixed(1)}" fill="${F.bau}" fill-opacity="0.7"/>`;
    inhalt += t(px(x), py(z) + 3, `HALLE ${i + 1}`, 8, "#ffffff", "middle", 600);
  });
  inhalt += `<rect x="${px(WEIGH_X - 2.3)}" y="${py(WEIGH_Z + 4.5)}" width="${(4.6 * S).toFixed(1)}" height="${(9 * S).toFixed(1)}" fill="#7d858b" fill-opacity="0.5"/>`;
  inhalt += t(px(WEIGH_X), py(WEIGH_Z) + 3, "WAAGE", 8, "#ffffff", "middle", 600);
  inhalt += `<rect x="${px(SCHILD_POS.x - SCHILD_B / 2)}" y="${py(SCHILD_POS.z) - 3}" width="${(SCHILD_B * S).toFixed(1)}" height="6" fill="#20262c"/>`;
  inhalt += t(px(SCHILD_POS.x), py(SCHILD_POS.z) - 8, "Firmenschild", 8, F.blass, "middle");

  // --- Fahrspuren
  const spur = (punkte: Array<[number, number]>, farbe: string, dick: number, strich?: string): string =>
    `<polyline points="${punkte.map(([x, z]) => `${px(x).toFixed(1)},${py(z).toFixed(1)}`).join(" ")}" fill="none" stroke="${farbe}" stroke-width="${dick}" ${strich ? `stroke-dasharray="${strich}"` : ""} stroke-linejoin="round"/>`;
  inhalt += spur(routeApproach(), F.spur, 2.2);
  inhalt += spur(routeInRev(), F.lkw, 2.6, "6 4");
  inhalt += spur(TIP_APPROACH, F.spur, 1.6, "2 3");
  inhalt += spur(TIP_IN_REV, F.lkw, 2.0, "6 4");
  inhalt += spur(pickupApproach(), F.spur, 1.6, "2 3");
  inhalt += spur(pickupInRev(), F.lkw, 2.0, "6 4");
  inhalt += spur(
    [
      [MULDEN_GASSE_X, 13],
      [MULDEN_GASSE_X, -27],
    ],
    F.spur,
    1.4,
    "2 4"
  );

  // --- LKW auf dem Abladeplatz
  const bedLen = 5.4;
  inhalt += `<rect x="${px(ABLADE_SPUR_X - BED_HALF_W).toFixed(1)}" y="${py(ABLADE_HALT_Z + bedLen).toFixed(1)}" width="${(BED_HALF_W * 2 * S).toFixed(1)}" height="${(bedLen * S).toFixed(1)}" fill="${F.lkw}" fill-opacity="0.35" stroke="${F.lkw}" stroke-width="1.6"/>`;
  inhalt += `<rect x="${px(ABLADE_SPUR_X - 1.2).toFixed(1)}" y="${py(ABLADE_HALT_Z + bedLen + 2.5).toFixed(1)}" width="${(2.4 * S).toFixed(1)}" height="${(2.5 * S).toFixed(1)}" fill="${F.lkw}" fill-opacity="0.2" stroke="${F.lkw}" stroke-width="1"/>`;
  inhalt += t(px(ABLADE_SPUR_X) + 22, py(ABLADE_HALT_Z + 2.7), "LKW quer", 9, F.lkw, "start", 700);

  // --- Bagger und Verladestand
  for (const [stand, name] of [
    [BAGGER_STAND, "B"],
    [VERLADE_STAND, "B2"],
  ] as Array<[{ x: number; z: number }, string]>) {
    inhalt += `<circle cx="${px(stand.x).toFixed(1)}" cy="${py(stand.z).toFixed(1)}" r="8" fill="${name === "B" ? F.ring : "#ffffff"}" stroke="${F.ring}" stroke-width="2"/>`;
    inhalt += t(px(stand.x), py(stand.z) + 3.5, name, 9, name === "B" ? "#ffffff" : F.ring, "middle", 700);
  }

  // --- Abstände der vier Pflichtziele + Abladeplatz
  const ziele: Array<[string, number, number]> = [
    ["MISCHSCHROTT", 4.0, -29.0],
    ["STAHLSCHROTT", -3.0, -29.0],
    ["PRESSE", PRESS_CENTER.x, PRESS_CENTER.z],
    ["MUELL", 7.0, -27.0],
    ["LKW", ABLADE_SPUR_X, ABLADE_HALT_Z + bedLen / 2],
  ];
  for (const [, zx, zz] of ziele) {
    inhalt += `<line x1="${px(BAGGER_STAND.x)}" y1="${py(BAGGER_STAND.z)}" x2="${px(zx)}" y2="${py(zz)}" stroke="${F.ring}" stroke-width="1" opacity="0.7"/>`;
  }
  inhalt += t(
    24,
    H - 26,
    "Maßstab 1 : 135 · grünes Band = Schwenkbereich 5,8 – 9,2 m · gelb = Anfahrt, rot gestrichelt = Rückwärtsfahrt",
    12,
    F.blass
  );

  // --- Tabelle rechts
  let y = 140;
  inhalt += kasten(688, 96, 528, 700, "Die vier Pflichtziele und der Abladeplatz");
  inhalt += t(704, y, "Ziel", 12, F.blass, "start", 600);
  inhalt += t(1010, y, "Abstand", 12, F.blass, "end", 600);
  inhalt += t(1200, y, "Schwenk", 12, F.blass, "end", 600);
  y += 8;
  inhalt += `<line x1="704" y1="${y}" x2="1200" y2="${y}" stroke="${F.rahmen}"/>`;
  y += 22;
  for (const [name, zx, zz] of ziele) {
    const d = abstandVomStand(zx, zz);
    const winkel = (Math.atan2(zx - BAGGER_STAND.x, zz - BAGGER_STAND.z) * 180) / Math.PI;
    inhalt += t(704, y, name, 12);
    inhalt += t(1010, y, `${zahl(d)} m`, 12, d <= SCHWENK_AUSSEN && d >= SCHWENK_INNEN ? F.ring : F.lkw, "end", 600);
    inhalt += t(1200, y, `${zahl(((winkel % 360) + 360) % 360, 0)}°`, 12, F.blass, "end");
    y += 22;
  }
  y += 14;
  inhalt += t(704, y, "Was sich geändert hat", 13, F.text, "start", 700);
  y += 22;
  const zeilen = [
    "LKW-Abladeplatz auf die alte Pressenstelle,",
    "der Wagen steht mit der Längsseite zum Sitz.",
    "Alle vier Ecken der Ladefläche liegen zwischen",
    "5,65 und 9,04 m — vorher 8,0 bis 13,5 m radial.",
    "",
    "Presse an die Westflanke, um 90° gedreht,",
    `Kammer ${zahl(PRESS_INNER.laenge)} × ${zahl(PRESS_INNER.tiefe)} m statt 5,95 × 4,05.`,
    "",
    "Ausbuchtung 6,5 m statt 9,5 m tief:",
    "40,8 statt 61,2 m² Haldenfläche je Halde.",
    "",
    "Reifencontainer ersatzlos weg — Reifen zählen",
    "vorerst zum Müll (mitFraktionen).",
    "",
    "Metallmulden: ALU+ZINK 7,28 m im Band,",
    "KABEL 9,17 m am Rand, KUPFER+MSG 12,31 m",
    "außerhalb. Entscheidung offen.",
  ];
  for (const zeile of zeilen) {
    inhalt += t(704, y, zeile, 12, zeile.startsWith("Metall") ? F.text : F.blass);
    y += 19;
  }

  writeFileSync(
    "docs/messungen/2026-09-14_grundriss-abend.svg",
    blatt(W, H, "Der Platz nach dem Umbau vom Abend", "Grundriss aus den gebauten Zahlen, mit Fahrspuren", inhalt)
  );
}

/* ================================================= Die Presse, Formfrage = */
{
  const W = 1180;
  const H = 560;
  const S = 34;
  let inhalt = "";
  const zeichne = (
    x0: number,
    titel: string,
    laenge: number,
    tiefe: number,
    farbe: string,
    notiz: string
  ): string => {
    let s = kasten(x0, 96, 360, 390, titel);
    const mx = x0 + 180;
    const my = 300;
    const rahmen = 0.35;
    s += `<rect x="${(mx - ((laenge + 2 * rahmen) * S) / 2).toFixed(1)}" y="${(my - ((tiefe + 2 * rahmen) * S) / 2).toFixed(1)}" width="${((laenge + 2 * rahmen) * S).toFixed(1)}" height="${((tiefe + 2 * rahmen) * S).toFixed(1)}" fill="${farbe}" fill-opacity="0.18" stroke="${farbe}" stroke-width="1.6"/>`;
    s += `<rect x="${(mx - (laenge * S) / 2).toFixed(1)}" y="${(my - (tiefe * S) / 2).toFixed(1)}" width="${(laenge * S).toFixed(1)}" height="${(tiefe * S).toFixed(1)}" fill="#ffffff" stroke="${farbe}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    // offene Spinne als Kreis
    s += `<circle cx="${mx}" cy="${my}" r="${(1.69 * S).toFixed(1)}" fill="none" stroke="${F.ring}" stroke-width="1.4"/>`;
    s += t(mx, my + 4, "Spinne 3,38 m", 9, F.ring, "middle", 600);
    s += t(mx, my - (tiefe * S) / 2 - 12, `${zahl(laenge)} × ${zahl(tiefe)} m lichte Kammer`, 11, F.text, "middle", 600);
    s += t(x0 + 14, 470, notiz, 12, F.blass);
    return s;
  };
  inhalt += zeichne(24, "VORHER · 5,95 × 4,05 m", 5.95, 4.05, F.alt, "Grundfläche der Kammer 24,1 m²");
  inhalt += zeichne(
    406,
    `VORSCHLAG · ${zahl(PRESS_INNER.laenge)} × ${zahl(PRESS_INNER.tiefe)} m`,
    PRESS_INNER.laenge,
    PRESS_INNER.tiefe,
    F.presse,
    `Grundfläche ${zahl(PRESS_INNER.laenge * PRESS_INNER.tiefe, 1)} m² — ${zahl((1 - (PRESS_INNER.laenge * PRESS_INNER.tiefe) / (5.95 * 4.05)) * 100, 0)} % weniger`
  );
  inhalt += zeichne(788, "GRENZE · 3,98 × 3,98 m", 3.98, 3.98, F.lkw, "Kleiner geht nicht: Spinne + 30 cm je Seite");
  inhalt += t(
    24,
    H - 26,
    "„Die Presse ist, glaub ich, auch ein bisschen zu groß, die kann verkleinert werden, eher wie so ein Rechteck, wie ein Quader.“ — die Form entscheidet Patrick.",
    12,
    F.text
  );
  writeFileSync(
    "docs/messungen/2026-09-14_presse.svg",
    blatt(W, H, "Die Presse wird kleiner — Vorschlag", "Draufsicht auf die Kammer, mit der offenen Spinne als Maß", inhalt)
  );
}

console.log("docs/messungen/2026-09-14_grundriss-abend.svg");
console.log("docs/messungen/2026-09-14_presse.svg");
