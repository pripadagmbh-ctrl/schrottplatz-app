/**
 * Das Blatt zum Kehrbesen (E-031, 15.09.2026).
 *
 * Patrick entscheidet am Bild und schaut es auf dem Telefon unter
 * `/v1/plaene/` an — also muss das Blatt ohne Begleittext lesbar sein.
 *
 * Gezeichnet wird nicht nachgebaut, sondern ABGENOMMEN: Das Geflecht kommt aus
 * derselben `baueGeometrie("besen", ...)`, die im Spiel laeuft, und die
 * gestrichelten Kollider aus denselben konvexen Huellen, die Rapier bekommt.
 * Wer die Form aendert, aendert das Blatt mit.
 *
 * Aufruf: npx vite-node tools/plan-2026-09-15-besen.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { baueGeometrie } from "../src/world/objektbau";
import { BESEN } from "../src/world/scrapItems";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";

const [BREITE, HOEHE, TIEFE] = BESEN.dims;

const bau = baueGeometrie("besen", BESEN.dims, "box");
const pos = bau.koerper.getAttribute("position") as THREE.BufferAttribute;
const huellen = bau.huellen ?? [];

/* ----------------------------------------------------------------- Werkzeug */

type P2 = [number, number];

/** Konvexe Huelle einer Punktwolke in 2D (Andrew's monotone chain). */
function huelle2d(punkte: P2[]): P2[] {
  const p = [...punkte].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const kreuz = (o: P2, a: P2, b: P2): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const unten: P2[] = [];
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], q) <= 0)
      unten.pop();
    unten.push(q);
  }
  const oben: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], q) <= 0)
      oben.pop();
    oben.push(q);
  }
  unten.pop();
  oben.pop();
  return unten.concat(oben);
}

/** Achsen einer Ansicht: welche Modellachse waagerecht, welche senkrecht. */
type Achsen = { h: 0 | 1 | 2; v: 0 | 1 | 2; vInvers: boolean };

function hol(i: number, achse: 0 | 1 | 2): number {
  return achse === 0 ? pos.getX(i) : achse === 1 ? pos.getY(i) : pos.getZ(i);
}

const teile: string[] = [];
const zeichne = (s: string): void => {
  teile.push(s);
};

const SCHRIFT = "Segoe UI,Helvetica,Arial,sans-serif";

function text(
  x: number,
  y: number,
  s: string,
  groesse = 13,
  farbe = "#3a4149",
  fett = false,
  anker = "start"
): void {
  zeichne(
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${SCHRIFT}" font-size="${groesse}"` +
      `${fett ? ' font-weight="700"' : ""} fill="${farbe}" text-anchor="${anker}">${s}</text>`
  );
}

/** Massband mit Pfeilen und Beschriftung. */
function mass(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  beschriftung: string,
  versatz = 12
): void {
  const waagerecht = Math.abs(y2 - y1) < 0.5;
  const c = "#c0392b";
  zeichne(
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
      `stroke="${c}" stroke-width="1.1" marker-start="url(#pf)" marker-end="url(#pf)"/>`
  );
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  if (waagerecht) text(mx, my - 6, beschriftung, 13, c, true, "middle");
  else
    zeichne(
      `<text x="${(mx + versatz).toFixed(1)}" y="${my.toFixed(1)}" font-family="${SCHRIFT}" ` +
        `font-size="13" font-weight="700" fill="${c}">${beschriftung}</text>`
    );
}

/**
 * Eine Ansicht zeichnen: Geflecht als feine Dreieckskanten, Kollider
 * gestrichelt darueber.
 */
function ansicht(
  x0: number,
  y0: number,
  breitePx: number,
  hoehePx: number,
  titel: string,
  untertitel: string,
  a: Achsen,
  massstab: number,
  mitte: { h: number; v: number }
): { px: (h: number, v: number) => P2 } {
  zeichne(
    `<rect x="${x0}" y="${y0}" width="${breitePx}" height="${hoehePx}" fill="#ffffff" ` +
      `stroke="#c8ccd2" rx="8"/>`
  );
  text(x0 + 16, y0 + 26, titel, 15, "#1b2026", true);
  text(x0 + 16, y0 + 45, untertitel, 12, "#6b727a");

  const cx = x0 + breitePx / 2;
  const cy = y0 + hoehePx / 2 + 22;
  const px = (h: number, v: number): P2 => [
    cx + (h - mitte.h) * massstab,
    cy - (a.vInvers ? -(v - mitte.v) : v - mitte.v) * massstab,
  ];

  // Boden als Hilfslinie
  const [, bodenY] = px(0, -HOEHE / 2);
  zeichne(
    `<line x1="${x0 + 14}" y1="${bodenY.toFixed(1)}" x2="${x0 + breitePx - 14}" y2="${bodenY.toFixed(1)}" ` +
      `stroke="#9aa3ad" stroke-width="1" stroke-dasharray="2 4"/>`
  );

  // Geflecht: jede Dreieckskante einmal, sehr fein
  const linien: string[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    const ecken: P2[] = [];
    for (let k = 0; k < 3; k++) ecken.push(px(hol(t + k, a.h), hol(t + k, a.v)));
    linien.push(
      `M${ecken[0][0].toFixed(1)},${ecken[0][1].toFixed(1)}L${ecken[1][0].toFixed(1)},${ecken[1][1].toFixed(1)}` +
        `L${ecken[2][0].toFixed(1)},${ecken[2][1].toFixed(1)}Z`
    );
  }
  zeichne(
    `<path d="${linien.join("")}" fill="none" stroke="#5d6a74" stroke-width="0.35" ` +
      `stroke-opacity="0.55"/>`
  );

  // Kollider gestrichelt
  for (const [i, wolke] of huellen.entries()) {
    const punkte: P2[] = [];
    for (let k = 0; k + 2 < wolke.length; k += 3) {
      const v3 = [wolke[k], wolke[k + 1], wolke[k + 2]];
      punkte.push(px(v3[a.h], v3[a.v]));
    }
    const h = huelle2d(punkte);
    if (h.length < 3) continue;
    zeichne(
      `<polygon points="${h.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
        `fill="none" stroke="${i === 0 ? "#1f6fb2" : "#7d3fb5"}" stroke-width="1.6" ` +
        `stroke-dasharray="7 4"/>`
    );
  }
  return { px };
}

/* ------------------------------------------------------------------ Blatt */

const W = 1240;
const H = 900;
zeichne(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
);
zeichne(
  `<defs><marker id="pf" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">` +
    `<path d="M1,4 L7,1 L7,7 Z" fill="#c0392b"/></marker></defs>`
);
zeichne(`<rect width="${W}" height="${H}" fill="#eef0f3"/>`);
text(28, 46, "Kehrbesen aus Maschendraht", 24, "#161b20", true);
text(
  28,
  70,
  `Ein Stück Zaun, oben zusammengequetscht, unten breit aufgefächert · ${BREITE.toFixed(2)} × ${HOEHE.toFixed(2)} × ${TIEFE.toFixed(2)} m · ${BESEN.massKg} kg · verzinkt`,
  14,
  "#5b626b"
);

const MST = 300; // Pixel je Meter
const mitteXY = { h: 0, v: 0 };

// --- Vorderansicht ---------------------------------------------------------
const vorn = ansicht(
  28,
  92,
  470,
  560,
  "VORDERANSICHT",
  "so breit, wie er kehrt",
  { h: 0, v: 1, vInvers: false },
  MST,
  mitteXY
);
{
  const [lx, ly] = vorn.px(-BREITE / 2, -HOEHE / 2);
  const [rx] = vorn.px(BREITE / 2, -HOEHE / 2);
  mass(lx, ly + 32, rx, ly + 32, `${BREITE.toFixed(2)} m breit`);
  const [, oy] = vorn.px(0, HOEHE / 2);
  mass(rx + 24, oy, rx + 24, ly, `${HOEHE.toFixed(2)} m`, -54);
  // Beschriftungen mit Fuehrungslinie nach innen, damit nichts abgeschnitten wird
  const zeiger = (zx: number, zy: number, tx: number, ty: number, s2: string, f: string): void => {
    zeichne(
      `<line x1="${zx.toFixed(1)}" y1="${zy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" ` +
        `stroke="${f}" stroke-width="1"/>`
    );
    zeichne(
      `<circle cx="${zx.toFixed(1)}" cy="${zy.toFixed(1)}" r="2.6" fill="${f}"/>`
    );
    text(tx + 5, ty + 4, s2, 12, f, true);
  };
  const [wx, wy] = vorn.px(0.16, HOEHE / 2 - HOEHE * 0.11);
  zeiger(wx, wy, 28 + 260, 92 + 92, "runde Ausbuchtung — hier greifen", "#7d3fb5");
  const [hx, hy] = vorn.px(0.1, HOEHE / 2 - HOEHE * 0.36 + 0.05);
  zeiger(hx, hy, 28 + 280, 92 + 200, "oben zusammengequetscht", "#3a4149");
  const [sx, sy] = vorn.px(-0.45, -HOEHE / 2 + 0.02);
  zeiger(sx, sy, 28 + 52, 92 + 452, "Schleppkante — muss den Boden berühren", "#c0392b");
}

// --- Seitenansicht ---------------------------------------------------------
const seite = ansicht(
  516,
  92,
  330,
  560,
  "SEITENANSICHT",
  "flach in Zugrichtung",
  { h: 2, v: 1, vInvers: false },
  MST,
  mitteXY
);
{
  const [lx, ly] = seite.px(-TIEFE / 2, -HOEHE / 2);
  const [rx] = seite.px(TIEFE / 2, -HOEHE / 2);
  mass(lx, ly + 34, rx, ly + 34, `${TIEFE.toFixed(2)} m`);
  text(516 + 16, 92 + 62, "Die Vorderfläche steht fast", 11.5, "#6b727a");
  text(516 + 16, 92 + 78, "senkrecht: sie schiebt Teile", 11.5, "#6b727a");
  text(516 + 16, 92 + 94, "vor sich her, statt über sie", 11.5, "#6b727a");
  text(516 + 16, 92 + 110, "hinwegzugleiten.", 11.5, "#6b727a");
  const [ax, ay] = seite.px(0, -HOEHE / 2);
  zeichne(
    `<line x1="${(ax - 40).toFixed(1)}" y1="${(ay + 58).toFixed(1)}" x2="${(ax + 40).toFixed(1)}" ` +
      `y2="${(ay + 58).toFixed(1)}" stroke="#1b2026" stroke-width="2" marker-end="url(#pf)"/>`
  );
  text(ax, ay + 78, "Zugrichtung", 12, "#1b2026", true, "middle");
}

// --- Draufsicht der Schleppkante ------------------------------------------
{
  const x0 = 864;
  const y0 = 92;
  const bw = 348;
  const bh = 268;
  zeichne(
    `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#ffffff" stroke="#c8ccd2" rx="8"/>`
  );
  text(x0 + 16, y0 + 26, "SCHLEPPKANTE VON OBEN", 15, "#1b2026", true);
  text(x0 + 16, y0 + 45, "flach, ründlich, aber breit", 12, "#6b727a");
  const m = 230;
  const cx = x0 + bw / 2;
  const cy = y0 + bh / 2 + 26;
  const untere: P2[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > -HOEHE / 2 + 0.06) continue;
    untere.push([cx + pos.getX(i) * m, cy + pos.getZ(i) * m]);
  }
  const rand = huelle2d(untere);
  zeichne(
    `<polygon points="${rand.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="#dfe6ea" stroke="#1f6fb2" stroke-width="1.6"/>`
  );
  mass(cx - (BREITE / 2) * m, cy + 52, cx + (BREITE / 2) * m, cy + 52, `${BREITE.toFixed(2)} m`);
  text(cx, cy - 56, `${TIEFE.toFixed(2)} m tief`, 12, "#3a4149", true, "middle");
  zeichne(
    `<line x1="${(cx + 138).toFixed(1)}" y1="${(cy - 20).toFixed(1)}" x2="${(cx + 138).toFixed(1)}" ` +
      `y2="${(cy + 14).toFixed(1)}" stroke="#1b2026" stroke-width="2" marker-end="url(#pf)"/>`
  );
  text(cx + 138, cy + 30, "Zug", 11, "#1b2026", true, "middle");
}

// --- Legende ---------------------------------------------------------------
{
  const x0 = 864;
  const y0 = 372;
  const bw = 348;
  const bh = 120;
  zeichne(
    `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#ffffff" stroke="#c8ccd2" rx="8"/>`
  );
  text(x0 + 16, y0 + 26, "WAS DIE LINIEN BEDEUTEN", 15, "#1b2026", true);
  const zeile = (i: number, farbe: string, strich: string, was: string): void => {
    const y = y0 + 52 + i * 22;
    zeichne(
      `<line x1="${x0 + 18}" y1="${y - 4}" x2="${x0 + 62}" y2="${y - 4}" stroke="${farbe}" ` +
        `stroke-width="2" stroke-dasharray="${strich}"/>`
    );
    text(x0 + 72, y, was, 12.5, "#3a4149");
  };
  zeile(0, "#5d6a74", "", "Drahtgeflecht — das, was man sieht");
  zeile(1, "#1f6fb2", "7 4", "Kollider Fächer — womit er kehrt");
  zeile(2, "#7d3fb5", "7 4", "Kollider Kopf — woran die Spinne fasst");
}

// --- Kehr-Tabelle ----------------------------------------------------------
{
  const x0 = 28;
  const y0 = 668;
  const bw = 818;
  const bh = 232;
  zeichne(
    `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#ffffff" stroke="#c8ccd2" rx="8"/>`
  );
  text(x0 + 16, y0 + 26, "WAS ER MITNIMMT", 15, "#1b2026", true);
  text(
    x0 + 16,
    y0 + 45,
    "gemessen in der Spielphysik: Wie weit ein liegendes Teil mitkommt, wenn der Besen 3,7 m darüberzieht",
    12,
    "#6b727a"
  );
  const spalten = ["Teil", "Kante auf dem Boden", "5 cm Luft", "10 cm Luft"];
  /** Gemessen mit `test/besen.test.ts`, Lauf vom 15.09.2026. */
  const zeilen: Array<[string, string, string, string]> = [
    ["3 cm", "—", "—", "0,00 m"],
    ["5 cm", "1,58 m", "0,00 m", "0,00 m"],
    ["8 cm", "2,36 m", "0,62 m", "0,00 m"],
    ["12 cm", "2,38 m", "0,66 m", "0,53 m"],
    ["18 cm", "2,41 m", "0,16 m", "0,74 m"],
    ["25 cm", "2,45 m", "2,45 m", "0,78 m"],
    ["35 cm", "2,50 m", "2,50 m", "2,50 m"],
    ["50 cm", "2,58 m", "2,57 m", "2,57 m"],
  ];
  const spx = [x0 + 20, x0 + 150, x0 + 380, x0 + 560];
  for (const [i, s] of spalten.entries()) text(spx[i], y0 + 76, s, 12.5, "#1b2026", true);
  for (const [r, zeile] of zeilen.entries()) {
    const y = y0 + 98 + r * 12.5;
    const mitgenommen = zeile.map((v) => parseFloat(v.replace(",", ".")) >= 1.2);
    for (const [c, v] of zeile.entries())
      text(spx[c], y, v, 12, c > 0 && mitgenommen[c] ? "#1f7a3d" : c > 0 ? "#a04040" : "#3a4149");
  }
  text(
    x0 + 700,
    y0 + 98,
    "grün = kehrt mit",
    12,
    "#1f7a3d",
    true
  );
  text(x0 + 700, y0 + 116, "rot = rutscht", 12, "#a04040", true);
  text(x0 + 700, y0 + 134, "darunter durch", 12, "#a04040", true);
  text(
    x0 + 20,
    y0 + 212,
    "Kurz: die Kante muss auf dem Boden aufliegen. Dann kehrt er alles ab 5 cm zusammen.",
    13,
    "#161b20",
    true
  );
}

// --- Wo er liegt -----------------------------------------------------------
{
  const x0 = 864;
  const y0 = 504;
  const bw = 348;
  const bh = 368;
  zeichne(
    `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#ffffff" stroke="#c8ccd2" rx="8"/>`
  );
  text(x0 + 16, y0 + 26, "WO ER LIEGT", 15, "#1b2026", true);
  text(x0 + 16, y0 + 45, "dauerhaft, es gibt genau einen", 12, "#6b727a");
  const m = 10.5;
  const cx = x0 + bw / 2 - 10;
  const cy = y0 + 178;
  const px = (x: number, z: number): P2 => [cx + x * m, cy + (z + 27) * m];
  // Halden
  const halde = (hx: number, hz: number, hw: number, hd: number, name: string): void => {
    const [ax, ay] = px(hx - hw / 2, hz - hd / 2);
    zeichne(
      `<rect x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" width="${(hw * m).toFixed(1)}" ` +
        `height="${(hd * m).toFixed(1)}" fill="#e7e3d8" stroke="#bdb6a4"/>`
    );
    text(ax + (hw * m) / 2, ay + (hd * m) / 2 + 4, name, 10, "#7a7362", false, "middle");
  };
  halde(4.0, -32.0, 6.8, 6.0, "MISCHSCHROTT");
  halde(-3.0, -32.0, 6.8, 6.0, "STAHL");
  // Schwenkband
  const [bx, by] = px(BAGGER_STAND.x, BAGGER_STAND.z);
  for (const [r, farbe] of [
    [5.8, "#9fb8cc"],
    [9.2, "#9fb8cc"],
  ] as Array<[number, string]>)
    zeichne(
      `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(r * m).toFixed(1)}" fill="none" ` +
        `stroke="${farbe}" stroke-width="1" stroke-dasharray="4 4"/>`
    );
  zeichne(
    `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="7" fill="#f0a500" stroke="#7a5600"/>`
  );
  text(bx + 12, by + 4, "Bagger", 11, "#7a5600", true);
  const [px2, py2] = px(BESEN_PLATZ.x, BESEN_PLATZ.z);
  zeichne(
    `<rect x="${(px2 - (BREITE / 2) * m).toFixed(1)}" y="${(py2 - (TIEFE / 2) * m).toFixed(1)}" ` +
      `width="${(BREITE * m).toFixed(1)}" height="${(TIEFE * m).toFixed(1)}" fill="#7d3fb5"/>`
  );
  zeichne(
    `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${px2.toFixed(1)}" y2="${py2.toFixed(1)}" ` +
      `stroke="#c0392b" stroke-width="1.2"/>`
  );
  text(
    (bx + px2) / 2 + 8,
    (by + py2) / 2,
    `${abstandVomStand(BESEN_PLATZ.x, BESEN_PLATZ.z).toFixed(2)} m`,
    12,
    "#c0392b",
    true
  );
  text(px2 + 14, py2 + 4, "Besen", 11, "#7d3fb5", true);
  zeichne(`<rect x="${x0 + 1}" y="${y0 + bh - 58}" width="${bw - 2}" height="52" fill="#ffffff" opacity="0.92"/>`);
  text(x0 + 16, y0 + bh - 34, "Schwenkband 5,8 bis 9,2 m (gestrichelt)", 11.5, "#6b727a");
  text(x0 + 16, y0 + bh - 16, "frei: 2,0 m zur nächsten Haldenkante", 11.5, "#6b727a");
}

zeichne("</svg>");

const ziel = fileURLToPath(new URL("../docs/messungen/2026-09-15_besen.svg", import.meta.url));
writeFileSync(ziel, teile.join(""), "utf8");
// eslint-disable-next-line no-console
console.log(`geschrieben: ${ziel} (${(teile.join("").length / 1024).toFixed(0)} kB)`);
