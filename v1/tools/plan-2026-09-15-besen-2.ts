/**
 * Das zweite Blatt zum Kehrbesen — aus dem Trichter wird ein Ballen (E-037).
 *
 * Patrick entscheidet am Bild und schaut es auf dem Telefon unter
 * `/v1/plaene/` an — also muss das Blatt ohne Begleittext lesbar sein. Die
 * wichtigste Frage des Tages ist „wie viel groesser?", darum steht die alte
 * Form im SELBEN MASSSTAB daneben.
 *
 * Gezeichnet wird nicht nachgebaut, sondern ABGENOMMEN: Das Geflecht kommt aus
 * derselben `baueGeometrie("besen", ...)`, die im Spiel laeuft, und der
 * gestrichelte Kollider aus derselben konvexen Huelle, die Rapier bekommt.
 * Einzig die ALTE Form ist nachgezeichnet (sie steht nicht mehr im Quelltext)
 * — und zwar nur als Umriss, mit ihren Katalogmassen.
 *
 * Aufruf: npx vite-node tools/plan-2026-09-15-besen-2.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { baueGeometrie } from "../src/world/objektbau";
import { BESEN } from "../src/world/scrapItems";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";
import { BED_HALF_W } from "../src/delivery/routes";
import { CLAW_OPEN_SPLAY, clawSpan } from "../src/excavator/clawGeometry";

const [BREITE, HOEHE, TIEFE] = BESEN.dims;

const bau = baueGeometrie("besen", BESEN.dims, "box");
const pos = bau.koerper.getAttribute("position") as THREE.BufferAttribute;

/** Die Form von heute vormittag (E-031), nur noch als Umriss. */
const ALT = { breite: 1.2, hoehe: 1.3, tiefe: 0.38, kg: 52 };

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
    while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], q) <= 0) oben.pop();
    oben.push(q);
  }
  unten.pop();
  oben.pop();
  return unten.concat(oben);
}

type Achsen = { h: 0 | 1 | 2; v: 0 | 1 | 2 };
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

function kasten(x: number, y: number, w: number, h: number, titel: string, unter: string): void {
  zeichne(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#c8ccd2" rx="8"/>`);
  text(x + 16, y + 28, titel, 16, "#1b2026", true);
  if (unter) text(x + 16, y + 48, unter, 12.5, "#6b727a");
}

/** Massband mit Pfeilen und Beschriftung. */
function mass(x1: number, y1: number, x2: number, y2: number, beschriftung: string, versatz = 12): void {
  const waagerecht = Math.abs(y2 - y1) < 0.5;
  const c = "#c0392b";
  zeichne(
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
      `stroke="${c}" stroke-width="1.2" marker-start="url(#pf)" marker-end="url(#pf)"/>`
  );
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  if (waagerecht) text(mx, my - 7, beschriftung, 14, c, true, "middle");
  else
    zeichne(
      `<text x="${(mx + versatz).toFixed(1)}" y="${my.toFixed(1)}" font-family="${SCHRIFT}" ` +
        `font-size="14" font-weight="700" fill="${c}">${beschriftung}</text>`
    );
}

/** Das Geflecht in einer Ansicht zeichnen. */
function geflecht(px: (h: number, v: number) => P2, a: Achsen, deckkraft = 0.55): void {
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
    `<path d="${linien.join("")}" fill="none" stroke="#5d6a74" stroke-width="0.35" stroke-opacity="${deckkraft}"/>`
  );
}

/** Kollider (eine konvexe Huelle ueber alle Eckpunkte) gestrichelt. */
function kollider(px: (h: number, v: number) => P2, a: Achsen): void {
  const punkte: P2[] = [];
  for (let i = 0; i < pos.count; i++) punkte.push(px(hol(i, a.h), hol(i, a.v)));
  const h = huelle2d(punkte);
  if (h.length < 3) return;
  zeichne(
    `<polygon points="${h.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="#1f6fb2" stroke-width="1.8" stroke-dasharray="8 5"/>`
  );
}

/* ------------------------------------------------------------------ Blatt */

const W = 1240;
const H = 1420;
zeichne(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
zeichne(
  `<defs><marker id="pf" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">` +
    `<path d="M1,4 L7,1 L7,7 Z" fill="#c0392b"/></marker></defs>`
);
zeichne(`<rect width="${W}" height="${H}" fill="#eef0f3"/>`);
text(28, 48, "Kehrbesen: aus dem Trichter wird ein Ballen", 26, "#161b20", true);
text(
  28,
  74,
  `Maschendraht, hundertmal zwischen Spinne, Birne und Boden gedrückt · ` +
    `${BREITE.toFixed(2)} × ${HOEHE.toFixed(2)} × ${TIEFE.toFixed(2)} m · ${BESEN.massKg} kg · verzinkt`,
  15,
  "#5b626b"
);

/* --- 1 · Alt und neu im selben Massstab ----------------------------------- */
{
  const x0 = 28;
  const y0 = 96;
  const bw = W - 56;
  const bh = 420;
  kasten(x0, y0, bw, bh, "ALT UND NEU — SELBER MASSSTAB", "so viel größer ist er geworden");

  const m = 118; // Pixel je Meter
  const boden = y0 + bh - 86;

  // Pritschen-Ladefläche als Massstab
  const pw = BED_HALF_W * 2;
  const pMitte = x0 + 690;
  zeichne(
    `<rect x="${(pMitte - (pw / 2) * m).toFixed(1)}" y="${(boden - 0.05 * m).toFixed(1)}" ` +
      `width="${(pw * m).toFixed(1)}" height="${(0.05 * m).toFixed(1)}" fill="#cfd6db"/>`
  );
  for (const s of [-1, 1]) {
    zeichne(
      `<rect x="${(pMitte + s * (pw / 2) * m - (s > 0 ? 0 : 6)).toFixed(1)}" ` +
        `y="${(boden - 0.64 * m).toFixed(1)}" width="6" height="${(0.64 * m).toFixed(1)}" fill="#cfd6db"/>`
    );
  }
  text(pMitte, boden + 74, `Ladefläche einer Pritsche, innen ${pw.toFixed(2)} m`, 13, "#8a929a", false, "middle");

  // NEU — echte Geometrie
  const pxNeu = (h: number, v: number): P2 => [pMitte + h * m, boden - (v + HOEHE / 2) * m];
  geflecht(pxNeu, { h: 0, v: 1 });
  kollider(pxNeu, { h: 0, v: 1 });
  mass(pMitte - (BREITE / 2) * m, boden + 34, pMitte + (BREITE / 2) * m, boden + 34, `${BREITE.toFixed(2)} m`);
  mass(
    pMitte + (BREITE / 2) * m + 34,
    boden - HOEHE * m,
    pMitte + (BREITE / 2) * m + 34,
    boden,
    `${HOEHE.toFixed(2)} m`,
    10
  );
  text(pMitte, y0 + 86, "NEU — Ballen", 17, "#1f6fb2", true, "middle");
  text(pMitte, y0 + 108, `${BESEN.massKg} kg · 1,98 m³`, 13.5, "#6b727a", false, "middle");

  // ALT — nur der Umriss, nachgezeichnet
  const aMitte = x0 + 210;
  const altUmriss: P2[] = [];
  /*
   * Der Trichter von heute vormittag: unten die volle Breite, nach oben mit
   * (1 − v)^1,6 auf den Hals zulaufend, darueber der runde Wulst. Zahlen aus
   * E-031.
   */
  const rAlt = (v: number): number => 0.092 * ALT.breite + (ALT.breite / 2 - 0.092 * ALT.breite) * Math.pow(1 - v, 1.6);
  const yHals = ALT.hoehe / 2 - ALT.hoehe * 0.36;
  for (let i = 0; i <= 24; i++) {
    const v = i / 24;
    altUmriss.push([-rAlt(v), -ALT.hoehe / 2 + v * (yHals + ALT.hoehe / 2)]);
  }
  const wulstR = 0.146 * ALT.breite;
  const yW = ALT.hoehe / 2 - ALT.hoehe * 0.11;
  for (let i = 0; i <= 12; i++) {
    const t = -1 + (2 * i) / 12;
    altUmriss.push([-wulstR * Math.sqrt(Math.max(1 - t * t * 0.86, 0.04)), yW + (t * ALT.hoehe * 0.185) / 2]);
  }
  const ganz = [...altUmriss, ...[...altUmriss].reverse().map((p) => [-p[0], p[1]] as P2)];
  zeichne(
    `<polygon points="${ganz
      .map((p) => `${(aMitte + p[0] * m).toFixed(1)},${(boden - (p[1] + ALT.hoehe / 2) * m).toFixed(1)}`)
      .join(" ")}" fill="#e2e6ea" stroke="#98a2ab" stroke-width="1.6"/>`
  );
  mass(
    aMitte - (ALT.breite / 2) * m,
    boden + 34,
    aMitte + (ALT.breite / 2) * m,
    boden + 34,
    `${ALT.breite.toFixed(2)} m`
  );
  mass(
    aMitte + (ALT.breite / 2) * m + 34,
    boden - ALT.hoehe * m,
    aMitte + (ALT.breite / 2) * m + 34,
    boden,
    `${ALT.hoehe.toFixed(2)} m`,
    10
  );
  text(aMitte, y0 + 86, "ALT — Trichter", 17, "#7a828a", true, "middle");
  text(aMitte, y0 + 108, `${ALT.kg} kg · 0,20 m³`, 13.5, "#8a929a", false, "middle");

  // Bodenlinie
  zeichne(
    `<line x1="${x0 + 16}" y1="${boden}" x2="${x0 + bw - 16}" y2="${boden}" stroke="#9aa3ad" ` +
      `stroke-width="1.4"/>`
  );
  text(x0 + bw - 24, boden + 74, "doppelt so breit · zehnmal so viel Rauminhalt", 14, "#161b20", true, "end");
}

/* --- 2 · Vorderansicht ---------------------------------------------------- */
const MST = 160;
{
  const x0 = 28;
  const y0 = 532;
  const bw = 500;
  const bh = 470;
  kasten(x0, y0, bw, bh, "VORDERANSICHT", "so breit, wie er kehrt");
  const cx = x0 + bw / 2;
  const boden = y0 + bh - 110;
  const px = (h: number, v: number): P2 => [cx + h * MST, boden - (v + HOEHE / 2) * MST];
  zeichne(
    `<line x1="${x0 + 14}" y1="${boden}" x2="${x0 + bw - 14}" y2="${boden}" stroke="#9aa3ad" ` +
      `stroke-width="1" stroke-dasharray="2 4"/>`
  );
  geflecht(px, { h: 0, v: 1 });
  kollider(px, { h: 0, v: 1 });
  mass(cx - (BREITE / 2) * MST, boden + 36, cx + (BREITE / 2) * MST, boden + 36, `${BREITE.toFixed(2)} m breit`);
  mass(cx + (BREITE / 2) * MST + 26, boden - HOEHE * MST, cx + (BREITE / 2) * MST + 26, boden, `${HOEHE.toFixed(2)} m`, 8);

  const zeiger = (zx: number, zy: number, tx: number, ty: number, s: string, f: string): void => {
    zeichne(
      `<line x1="${zx.toFixed(1)}" y1="${zy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" ` +
        `stroke="${f}" stroke-width="1"/>`
    );
    zeichne(`<circle cx="${zx.toFixed(1)}" cy="${zy.toFixed(1)}" r="2.8" fill="${f}"/>`);
    text(tx + 6, ty + 4, s, 12.5, f, true);
  };
  const [kx, ky] = px(0.1, HOEHE / 2 - 0.06);
  zeiger(kx, ky, x0 + 244, y0 + 96, "Kuppe — hier greift die Spinne", "#7d3fb5");
  const [dx, dy] = px(-0.62, 0.3);
  zeiger(dx, dy, x0 + 30, y0 + 150, "Dellen, wo die Schalen", "#3a4149");
  text(x0 + 36, y0 + 168, "aufgesessen haben", 12.5, "#3a4149", true);
  const [sx, sy] = px(-0.9, -HOEHE / 2 + 0.02);
  zeiger(sx, sy, x0 + 26, boden + 66, "Schleppkante — breit und senkrecht", "#c0392b");
}

/* --- 3 · Seitenansicht ---------------------------------------------------- */
{
  const x0 = 546;
  const y0 = 532;
  const bw = 330;
  const bh = 470;
  kasten(x0, y0, bw, bh, "SEITENANSICHT", "flach in Zugrichtung");
  const cx = x0 + bw / 2;
  const boden = y0 + bh - 110;
  const px = (h: number, v: number): P2 => [cx + h * MST, boden - (v + HOEHE / 2) * MST];
  zeichne(
    `<line x1="${x0 + 14}" y1="${boden}" x2="${x0 + bw - 14}" y2="${boden}" stroke="#9aa3ad" ` +
      `stroke-width="1" stroke-dasharray="2 4"/>`
  );
  geflecht(px, { h: 2, v: 1 });
  kollider(px, { h: 2, v: 1 });
  mass(cx - (TIEFE / 2) * MST, boden + 36, cx + (TIEFE / 2) * MST, boden + 36, `${TIEFE.toFixed(2)} m`);
  zeichne(
    `<line x1="${(cx - 46).toFixed(1)}" y1="${(boden + 76).toFixed(1)}" x2="${(cx + 46).toFixed(1)}" ` +
      `y2="${(boden + 76).toFixed(1)}" stroke="#1b2026" stroke-width="2" marker-end="url(#pf)"/>`
  );
  text(cx, boden + 96, "Zugrichtung", 13, "#1b2026", true, "middle");
  text(x0 + 16, y0 + 74, "Unten platt vom Boden,", 12.5, "#6b727a");
  text(x0 + 16, y0 + 91, "oben rund von der Spinne.", 12.5, "#6b727a");
}

/* --- 4 · Draufsicht ------------------------------------------------------- */
{
  const x0 = 894;
  const y0 = 532;
  const bw = W - 28 - x0;
  const bh = 470;
  kasten(x0, y0, bw, bh, "VON OBEN", "die Grundfläche, die auf dem Beton liegt");
  const m = 96;
  const cx = x0 + bw / 2;
  const cy = y0 + 240;
  const untere: P2[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > -HOEHE / 2 + 0.07) continue;
    untere.push([cx + pos.getX(i) * m, cy + pos.getZ(i) * m]);
  }
  const rand = huelle2d(untere);
  zeichne(
    `<polygon points="${rand.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="#dfe6ea" stroke="#1f6fb2" stroke-width="1.8"/>`
  );
  mass(cx - (BREITE / 2) * m, cy + 92, cx + (BREITE / 2) * m, cy + 92, `${BREITE.toFixed(2)} m`);
  text(cx, cy - 86, `${TIEFE.toFixed(2)} m tief`, 13, "#3a4149", true, "middle");
  zeichne(
    `<line x1="${(cx + 96).toFixed(1)}" y1="${(cy - 34).toFixed(1)}" x2="${(cx + 96).toFixed(1)}" ` +
      `y2="${(cy + 22).toFixed(1)}" stroke="#1b2026" stroke-width="2" marker-end="url(#pf)"/>`
  );
  text(cx + 96, cy + 40, "Zug", 12, "#1b2026", true, "middle");
  text(x0 + 16, y0 + bh - 96, "Die offene Spinne misst", 13, "#3a4149");
  text(x0 + 16, y0 + bh - 76, `${clawSpan(CLAW_OPEN_SPLAY).toFixed(2)} m — sie kommt also`, 13, "#3a4149");
  text(x0 + 16, y0 + bh - 56, "von oben über ihn.", 13, "#3a4149");
  text(x0 + 16, y0 + bh - 28, "Umfassen kann sie ihn nicht;", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 10, "sie drückt auf die Kuppe.", 12.5, "#6b727a");
}

/* --- 5 · Kehr-Tabelle alt gegen neu --------------------------------------- */
{
  const x0 = 28;
  const y0 = 1018;
  const bw = 780;
  const bh = 340;
  kasten(
    x0,
    y0,
    bw,
    bh,
    "WAS ER MITNIMMT — ALT GEGEN NEU",
    "gemessen in der Spielphysik: wie weit ein liegendes Teil mitkommt, wenn der Besen 3,7 m darüberzieht"
  );
  const spx = [x0 + 22, x0 + 140, x0 + 268, x0 + 396, x0 + 524, x0 + 640];
  text(spx[0], y0 + 82, "Teil", 13.5, "#1b2026", true);
  text(spx[1], y0 + 68, "Kante auf", 12.5, "#1b2026", true);
  text(spx[1], y0 + 84, "dem Boden", 12.5, "#1b2026", true);
  text(spx[3], y0 + 68, "5 cm Luft", 12.5, "#1b2026", true);
  text(spx[5], y0 + 68, "10 cm Luft", 12.5, "#1b2026", true);
  text(spx[1], y0 + 102, "alt", 11.5, "#8a929a");
  text(spx[2], y0 + 102, "neu", 11.5, "#1f6fb2", true);
  text(spx[3], y0 + 102, "alt", 11.5, "#8a929a");
  text(spx[4], y0 + 102, "neu", 11.5, "#1f6fb2", true);
  text(spx[5], y0 + 102, "alt", 11.5, "#8a929a");
  text(spx[5] + 60, y0 + 102, "neu", 11.5, "#1f6fb2", true);

  /** Gemessen 15.09.2026 mit derselben Physik, beide Formen im selben Lauf. */
  const zeilen: Array<[string, string, string, string, string, string, string]> = [
    ["5 cm", "2,35", "2,80", "0,00", "0,00", "0,00", "0,00"],
    ["8 cm", "2,36", "2,81", "0,62", "2,34", "0,00", "0,00"],
    ["12 cm", "2,38", "2,84", "0,66", "1,72", "0,53", "1,50"],
    ["18 cm", "2,41", "2,86", "0,38", "2,86", "0,74", "1,76"],
    ["25 cm", "2,45", "2,90", "2,45", "2,90", "0,74", "1,64"],
    ["35 cm", "2,50", "2,95", "2,50", "2,95", "2,50", "2,95"],
    ["50 cm", "2,57", "3,02", "2,57", "3,02", "2,57", "3,02"],
  ];
  for (const [r, zeile] of zeilen.entries()) {
    const y = y0 + 128 + r * 24;
    text(spx[0], y, zeile[0], 13, "#3a4149", true);
    for (let c = 1; c <= 6; c++) {
      const wert = parseFloat(zeile[c].replace(",", "."));
      const gut = wert >= 1.2;
      const px2 = c === 6 ? spx[5] + 60 : spx[c];
      text(px2, y, zeile[c] + " m", 13, gut ? "#1f7a3d" : "#a04040", c % 2 === 0);
    }
  }
  text(
    x0 + 22,
    y0 + bh - 42,
    "Grün = kommt mit, rot = rutscht darunter durch.",
    13.5,
    "#161b20",
    true
  );
  text(
    x0 + 22,
    y0 + bh - 20,
    "Mit aufliegender Kante kehrt er weiter alles ab 5 cm — und mit Spalt deutlich mehr als vorher.",
    13.5,
    "#161b20",
    true
  );
}

/* --- 6 · Wo er liegt ------------------------------------------------------ */
{
  const x0 = 826;
  const y0 = 1018;
  const bw = W - 28 - x0;
  const bh = 340;
  kasten(x0, y0, bw, bh, "WO ER LIEGT", "auf dem Vorplatz, es gibt genau einen");
  const m = 7.4;
  const cx = x0 + bw / 2 - 10;
  const cy = y0 + 196;
  const px = (x: number, z: number): P2 => [cx + x * m, cy + (z + 19) * m];
  const [bx, by] = px(BAGGER_STAND.x, BAGGER_STAND.z);
  for (const r of [5.8, 9.2])
    zeichne(
      `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(r * m).toFixed(1)}" fill="none" ` +
        `stroke="#9fb8cc" stroke-width="1" stroke-dasharray="4 4"/>`
    );
  // Muellcontainer und Abladespur als Nachbarn
  const rechteck = (rx: number, rz: number, rw: number, rd: number, f: string, s: string, name: string): void => {
    const [ax, ay] = px(rx - rw / 2, rz - rd / 2);
    zeichne(
      `<rect x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" width="${(rw * m).toFixed(1)}" ` +
        `height="${(rd * m).toFixed(1)}" fill="${f}" stroke="${s}"/>`
    );
    text(ax + (rw * m) / 2, ay + (rd * m) / 2 + 4, name, 10, "#7a7362", false, "middle");
  };
  rechteck(-2.8, -15.4, 3.6, 4.3, "#e7e3d8", "#bdb6a4", "MÜLL");
  rechteck(6.3, -23.0, 2.6, 6.0, "#e4e9ee", "#b3c0cb", "LKW");
  zeichne(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="7" fill="#f0a500" stroke="#7a5600"/>`);
  text(bx - 12, by + 4, "Bagger", 11.5, "#7a5600", true, "end");
  const [px2, py2] = px(BESEN_PLATZ.x, BESEN_PLATZ.z);
  zeichne(
    `<rect x="${(px2 - (BREITE / 2) * m).toFixed(1)}" y="${(py2 - (TIEFE / 2) * m).toFixed(1)}" ` +
      `width="${(BREITE * m).toFixed(1)}" height="${(TIEFE * m).toFixed(1)}" fill="#7d3fb5"/>`
  );
  zeichne(
    `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${px2.toFixed(1)}" y2="${py2.toFixed(1)}" ` +
      `stroke="#c0392b" stroke-width="1.3"/>`
  );
  text(
    (bx + px2) / 2 + 8,
    (by + py2) / 2 - 4,
    `${abstandVomStand(BESEN_PLATZ.x, BESEN_PLATZ.z).toFixed(2)} m`,
    13,
    "#c0392b",
    true
  );
  text(px2 + (BREITE / 2) * m + 8, py2 + 4, "Besen", 12, "#7d3fb5", true);
  text(x0 + 16, y0 + bh - 62, `neu: (${BESEN_PLATZ.x} | ${BESEN_PLATZ.z}) statt (5,0 | −27,0)`, 13, "#161b20", true);
  text(x0 + 16, y0 + bh - 42, "Der alte Fleck lag 1,64 m neben der", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 24, "Stelle, an der der Kipper abkippt.", 12.5, "#6b727a");
}

text(28, H - 24, "Blaue Strichlinie = Kollider, das, was die Physik anfasst.", 13, "#6b727a");

zeichne("</svg>");

const ziel = fileURLToPath(new URL("../docs/messungen/2026-09-15_besen-2.svg", import.meta.url));
writeFileSync(ziel, teile.join(""), "utf8");
// eslint-disable-next-line no-console
console.log(`geschrieben: ${ziel} (${(teile.join("").length / 1024).toFixed(0)} kB)`);
