/**
 * Das dritte Blatt zum Kehrbesen — aus dem Ballen wird eine Rolle (E-049).
 *
 * Patrick entscheidet am Bild und schaut es auf dem Telefon unter
 * `/v1/plaene/` an — also muss das Blatt ohne Begleittext lesbar sein. An
 * einem Abend hat die Form dreimal gewechselt; darum stehen alle DREI
 * Fassungen im selben Massstab nebeneinander, mit der Ladeflaeche dahinter.
 *
 * Gezeichnet wird nicht nachgebaut, sondern ABGENOMMEN: Das Geflecht kommt aus
 * derselben `baueGeometrie("besen", ...)`, die im Spiel laeuft, und der
 * gestrichelte Kollider aus derselben konvexen Huelle, die Rapier bekommt.
 * Trichter und Ballen sind nachgezeichnete Umrisse — sie stehen nicht mehr im
 * Quelltext — und tragen ihre Katalogmasse.
 *
 * Aufruf: npx vite-node tools/plan-2026-09-15-besen-3.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { baueGeometrie } from "../src/world/objektbau";
import { BESEN } from "../src/world/scrapItems";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";
import { BED_HALF_W, BED_LEN } from "../src/delivery/routes";
import { CLAW_OPEN_SPLAY, clawSpan } from "../src/excavator/clawGeometry";

const [LAENGE, HOEHE, TIEFE] = BESEN.dims;

const bau = baueGeometrie("besen", BESEN.dims, "box");
const pos = bau.koerper.getAttribute("position") as THREE.BufferAttribute;

/** Die beiden Vorgaengerformen, nur noch als Umriss. */
const TRICHTER = { breite: 1.2, hoehe: 1.3, tiefe: 0.38, kg: 52, raum: 0.2 };
const BALLEN = { breite: 2.4, hoehe: 1.1, tiefe: 1.3, kg: 680, raum: 1.98 };

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
function geflecht(px: (h: number, v: number) => P2, a: Achsen): void {
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
    `<path d="${linien.join("")}" fill="none" stroke="#2f5738" stroke-width="0.35" stroke-opacity="0.65"/>`
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
const H = 1460;
zeichne(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
zeichne(
  `<defs><marker id="pf" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">` +
    `<path d="M1,4 L7,1 L7,7 Z" fill="#c0392b"/></marker></defs>`
);
zeichne(`<rect width="${W}" height="${H}" fill="#eef0f3"/>`);
text(28, 48, "Kehrbesen: drei Formen an einem Abend", 26, "#161b20", true);
text(
  28,
  74,
  `Jetzt eine getretene Rolle grüner Maschendraht · ${LAENGE.toFixed(2)} × ${HOEHE.toFixed(2)} × ${TIEFE.toFixed(2)} m · ` +
    `${BESEN.massKg} kg · unten rund, oben gequetscht`,
  15,
  "#5b626b"
);

/* --- 1 · Drei Fassungen im selben Massstab -------------------------------- */
{
  const x0 = 28;
  const y0 = 96;
  const bw = W - 56;
  const bh = 400;
  kasten(x0, y0, bw, bh, "TRICHTER · BALLEN · ROLLE — SELBER MASSSTAB", "so hat sich das Ding entwickelt");

  const m = 100; // Pixel je Meter
  const boden = y0 + bh - 84;

  // Bodenlinie
  zeichne(
    `<line x1="${x0 + 14}" y1="${boden}" x2="${x0 + bw - 14}" y2="${boden}" stroke="#9aa3ad" stroke-width="1.4"/>`
  );

  // Pritschen-Ladeflaeche als Massstab hinter der Rolle
  const pw = BED_HALF_W * 2;
  const rMitte = x0 + 800;
  zeichne(
    `<rect x="${(rMitte - (pw / 2) * m).toFixed(1)}" y="${(boden - 0.05 * m).toFixed(1)}" ` +
      `width="${(pw * m).toFixed(1)}" height="${(0.05 * m).toFixed(1)}" fill="#cfd6db"/>`
  );
  for (const s of [-1, 1])
    zeichne(
      `<rect x="${(rMitte + s * (pw / 2) * m - (s > 0 ? 0 : 6)).toFixed(1)}" ` +
        `y="${(boden - 0.64 * m).toFixed(1)}" width="6" height="${(0.64 * m).toFixed(1)}" fill="#cfd6db"/>`
    );
  text(rMitte, boden + 72, `Ladefläche einer Pritsche, innen ${pw.toFixed(2)} m`, 13, "#8a929a", false, "middle");

  // Umrisse der beiden Vorgaenger
  const umriss = (
    mitte: number,
    daten: { breite: number; hoehe: number; tiefe: number; kg: number; raum: number },
    punkteFn: (v: number) => number,
    titel: string,
    stand: string
  ): void => {
    const links: P2[] = [];
    for (let i = 0; i <= 28; i++) {
      const v = i / 28;
      links.push([-punkteFn(v) * daten.breite, v * daten.hoehe]);
    }
    const ganz = [...links, ...[...links].reverse().map((p) => [-p[0], p[1]] as P2)];
    zeichne(
      `<polygon points="${ganz
        .map((p) => `${(mitte + p[0] * m).toFixed(1)},${(boden - p[1] * m).toFixed(1)}`)
        .join(" ")}" fill="#e2e6ea" stroke="#98a2ab" stroke-width="1.6"/>`
    );
    mass(mitte - (daten.breite / 2) * m, boden + 32, mitte + (daten.breite / 2) * m, boden + 32, `${daten.breite.toFixed(2)} m`);
    text(mitte, y0 + 84, titel, 16, "#7a828a", true, "middle");
    text(mitte, y0 + 104, stand, 12.5, "#8a929a", false, "middle");
    text(mitte, y0 + 122, `${daten.kg} kg · ${daten.raum.toFixed(2)} m³`, 12.5, "#8a929a", false, "middle");
  };

  // Trichter: unten breit, nach oben auf den Hals, darueber der Wulst
  umriss(
    x0 + 140,
    TRICHTER,
    (v) => {
      const hals = 0.092;
      if (v < 0.64) return hals + (0.5 - hals) * Math.pow(1 - v / 0.64, 1.6);
      if (v < 0.78) return hals;
      const t = (v - 0.89) / 0.11;
      return 0.146 * Math.sqrt(Math.max(1 - t * t * 0.86, 0.04));
    },
    "TRICHTER",
    "E-031, vormittags"
  );
  // Ballen: Halbellipse mit kleiner Kuppe
  umriss(
    x0 + 400,
    BALLEN,
    (v) => Math.max(0.5 * Math.sqrt(Math.max(1 - Math.pow(v, 2.2), 0)), 0.08),
    "BALLEN",
    "E-037, abends"
  );

  // ROLLE — echte Geometrie
  const pxR = (h: number, v: number): P2 => [rMitte + h * m, boden - (v + HOEHE / 2) * m];
  geflecht(pxR, { h: 0, v: 1 });
  kollider(pxR, { h: 0, v: 1 });
  mass(rMitte - (LAENGE / 2) * m, boden + 32, rMitte + (LAENGE / 2) * m, boden + 32, `${LAENGE.toFixed(2)} m`);
  text(rMitte, y0 + 84, "ROLLE", 16, "#1f6fb2", true, "middle");
  text(rMitte, y0 + 104, "E-049, nachts", 12.5, "#6b727a", false, "middle");
  text(rMitte, y0 + 122, `${BESEN.massKg} kg · 2,04 m³`, 12.5, "#6b727a", false, "middle");
  text(x0 + bw - 24, boden + 72, "so breit wie die Ladefläche — wie bestellt", 14, "#161b20", true, "end");
}

/* --- 2 · Vorderansicht ---------------------------------------------------- */
const MST = 150;
{
  const x0 = 28;
  const y0 = 512;
  const bw = 520;
  const bh = 440;
  kasten(x0, y0, bw, bh, "VON VORN", "die Rolle liegt quer — die Schleppkante ist eine Gerade");
  const cx = x0 + bw / 2;
  const boden = y0 + bh - 108;
  const px = (h: number, v: number): P2 => [cx + h * MST, boden - (v + HOEHE / 2) * MST];
  zeichne(
    `<line x1="${x0 + 14}" y1="${boden}" x2="${x0 + bw - 14}" y2="${boden}" stroke="#9aa3ad" ` +
      `stroke-width="1" stroke-dasharray="2 4"/>`
  );
  geflecht(px, { h: 0, v: 1 });
  kollider(px, { h: 0, v: 1 });
  mass(cx - (LAENGE / 2) * MST, boden + 34, cx + (LAENGE / 2) * MST, boden + 34, `${LAENGE.toFixed(2)} m`);
  mass(cx + (LAENGE / 2) * MST + 24, boden - HOEHE * MST, cx + (LAENGE / 2) * MST + 24, boden, `${HOEHE.toFixed(2)} m`, 8);
  const zeiger = (zx: number, zy: number, tx: number, ty: number, s: string, f: string): void => {
    zeichne(
      `<line x1="${zx.toFixed(1)}" y1="${zy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" ` +
        `stroke="${f}" stroke-width="1"/>`
    );
    zeichne(`<circle cx="${zx.toFixed(1)}" cy="${zy.toFixed(1)}" r="2.8" fill="${f}"/>`);
    text(tx + 6, ty + 4, s, 12.5, f, true);
  };
  const [ex, ey] = px(LAENGE / 2 - 0.02, 0);
  zeiger(ex, ey, x0 + 300, y0 + 92, "Stirnscheibe: hier sieht man die Wicklung", "#7d3fb5");
  const [sx, sy] = px(-0.9, -HOEHE / 2 + 0.01);
  zeiger(sx, sy, x0 + 26, boden + 64, "Schleppkante — gerade über 2,70 m", "#c0392b");
}

/* --- 3 · Seitenansicht ---------------------------------------------------- */
{
  const x0 = 566;
  const y0 = 512;
  const bw = 320;
  const bh = 440;
  kasten(x0, y0, bw, bh, "VON DER SEITE", "unten rund, oben gequetscht");
  const cx = x0 + bw / 2;
  const boden = y0 + bh - 108;
  const px = (h: number, v: number): P2 => [cx + h * MST, boden - (v + HOEHE / 2) * MST];
  zeichne(
    `<line x1="${x0 + 14}" y1="${boden}" x2="${x0 + bw - 14}" y2="${boden}" stroke="#9aa3ad" ` +
      `stroke-width="1" stroke-dasharray="2 4"/>`
  );
  geflecht(px, { h: 2, v: 1 });
  kollider(px, { h: 2, v: 1 });
  mass(cx - (TIEFE / 2) * MST, boden + 34, cx + (TIEFE / 2) * MST, boden + 34, `${TIEFE.toFixed(2)} m`);
  zeichne(
    `<line x1="${(cx - 44).toFixed(1)}" y1="${(boden + 74).toFixed(1)}" x2="${(cx + 44).toFixed(1)}" ` +
      `y2="${(boden + 74).toFixed(1)}" stroke="#1b2026" stroke-width="2" marker-end="url(#pf)"/>`
  );
  text(cx, boden + 94, "Zugrichtung", 13, "#1b2026", true, "middle");
  text(x0 + 16, y0 + 74, "Ungetreten war sie rund und", 12.5, "#6b727a");
  text(x0 + 16, y0 + 91, "0,98 m dick. Getreten: 0,80 m", 12.5, "#6b727a");
  text(x0 + 16, y0 + 108, "hoch, 1,12 m breit.", 12.5, "#6b727a");
}

/* --- 4 · Von oben --------------------------------------------------------- */
{
  const x0 = 904;
  const y0 = 512;
  const bw = W - 28 - x0;
  const bh = 440;
  kasten(x0, y0, bw, bh, "VON OBEN", "so steht sie auf dem Beton");
  const m = 78;
  const cx = x0 + bw / 2;
  const cy = y0 + 210;
  const untere: P2[] = [];
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > -HOEHE / 2 + 0.05) continue;
    untere.push([cx + pos.getX(i) * m, cy + pos.getZ(i) * m]);
  }
  const rand = huelle2d(untere);
  zeichne(
    `<polygon points="${rand.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="#dfe6ea" stroke="#1f6fb2" stroke-width="1.8"/>`
  );
  mass(cx - (LAENGE / 2) * m, cy + 80, cx + (LAENGE / 2) * m, cy + 80, `${LAENGE.toFixed(2)} m`);
  text(cx, cy - 72, `${TIEFE.toFixed(2)} m tief`, 13, "#3a4149", true, "middle");
  text(x0 + 16, y0 + bh - 118, "Ein Zug räumt", 13.5, "#161b20", true);
  text(x0 + 16, y0 + bh - 98, "2,72 m — gemessen.", 15, "#1f7a3d", true);
  text(x0 + 16, y0 + bh - 74, "Der Ballen schaffte 2,10 m:", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 56, "seine runden Ecken schoben", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 38, "die äußeren Teile zur Seite.", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 14, `Offene Spinne: ${clawSpan(CLAW_OPEN_SPLAY).toFixed(2)} m`, 12.5, "#6b727a");
}

/* --- 5 · Die Ladefläche wird quer gekehrt --------------------------------- */
{
  const x0 = 28;
  const y0 = 968;
  const bw = 720;
  const bh = 300;
  kasten(
    x0,
    y0,
    bw,
    bh,
    "DIE LADEFLÄCHE WIRD QUER GEKEHRT",
    "„Breite so lassen, ich kann die Spinne ja drehen, damit es passt.“"
  );
  const m = 44;
  const LADE = BED_LEN.pritsche!;
  const cx = x0 + 200;
  const cy = y0 + 176;
  // Ladeflaeche von oben
  zeichne(
    `<rect x="${(cx - BED_HALF_W * m).toFixed(1)}" y="${(cy - (LADE / 2) * m).toFixed(1)}" ` +
      `width="${(2 * BED_HALF_W * m).toFixed(1)}" height="${(LADE * m).toFixed(1)}" ` +
      `fill="#f2f4f6" stroke="#b3c0cb" stroke-width="2"/>`
  );
  text(cx, cy - (LADE / 2) * m - 10, `Ladefläche ${(2 * BED_HALF_W).toFixed(2)} × ${LADE.toFixed(2)} m`, 12.5, "#8a929a", false, "middle");
  // drei Bahnen
  for (const [i, bahn] of [-(BED_HALF_W - TIEFE / 2), 0, BED_HALF_W - TIEFE / 2].entries()) {
    zeichne(
      `<rect x="${(cx + bahn * m - (TIEFE / 2) * m).toFixed(1)}" y="${(cy - (LADE / 2) * m + 16).toFixed(1)}" ` +
        `width="${(TIEFE * m).toFixed(1)}" height="${(LAENGE * m).toFixed(1)}" ` +
        `fill="${i === 1 ? "#cfe0cf" : "#e3ece3"}" stroke="#2f5738" stroke-width="1.4"/>`
    );
    text(cx + bahn * m, cy - (LADE / 2) * m + 16 + (LAENGE * m) / 2 + 4, `${i + 1}`, 15, "#2f5738", true, "middle");
  }
  zeichne(
    `<line x1="${(cx + 150).toFixed(1)}" y1="${(cy - 30).toFixed(1)}" x2="${(cx + 150).toFixed(1)}" ` +
      `y2="${(cy + 70).toFixed(1)}" stroke="#1b2026" stroke-width="2" marker-end="url(#pf)"/>`
  );
  text(cx + 108, cy + 88, "zum Heck", 12, "#1b2026", true, "middle");

  const tx = x0 + 330;
  text(tx, y0 + 92, "Längs passt sie nicht mehr hinein:", 13.5, "#161b20", true);
  text(tx, y0 + 112, `2,70 m Rolle gegen 2,70 m lichte Weite — null Luft.`, 13, "#3a4149");
  text(tx, y0 + 142, "Quer schon:", 13.5, "#161b20", true);
  text(tx, y0 + 162, `1,12 m Rolle gegen 2,70 m — 0,79 m Luft je Bordwand.`, 13, "#3a4149");
  text(tx, y0 + 192, "Drei Bahnen über die Länge, dann ist sie leer", 13, "#1f7a3d", true);
  text(tx, y0 + 210, "(6 von 6 Teilen; der Ballen ließ eines liegen).", 13, "#1f7a3d", true);
  text(tx, y0 + 244, "Beim Schwenken mit hängender Rolle bleiben", 12.5, "#6b727a");
  text(tx, y0 + 262, "quer 0,64 m Luft zum Unterwagen; längs gehalten", 12.5, "#6b727a");
  text(tx, y0 + 280, "streift sie ihn bei ganz eingezogenem Arm um 15 cm.", 12.5, "#6b727a");
}

/* --- 6 · Wo sie liegt ----------------------------------------------------- */
{
  const x0 = 766;
  const y0 = 968;
  const bw = W - 28 - x0;
  const bh = 300;
  kasten(x0, y0, bw, bh, "WO SIE LIEGT", "auf dem Vorplatz, es gibt genau eine");
  const m = 6.6;
  const cx = x0 + bw / 2 - 6;
  const cy = y0 + 172;
  const px = (x: number, z: number): P2 => [cx + x * m, cy + (z + 19) * m];
  const [bx, by] = px(BAGGER_STAND.x, BAGGER_STAND.z);
  for (const r of [5.8, 9.2])
    zeichne(
      `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(r * m).toFixed(1)}" fill="none" ` +
        `stroke="#9fb8cc" stroke-width="1" stroke-dasharray="4 4"/>`
    );
  const rechteck = (rx: number, rz: number, rw: number, rd: number, name: string): void => {
    const [ax, ay] = px(rx - rw / 2, rz - rd / 2);
    zeichne(
      `<rect x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" width="${(rw * m).toFixed(1)}" ` +
        `height="${(rd * m).toFixed(1)}" fill="#e7e3d8" stroke="#bdb6a4"/>`
    );
    text(ax + (rw * m) / 2, ay + (rd * m) / 2 + 4, name, 9, "#7a7362", false, "middle");
  };
  rechteck(-2.8, -15.4, 3.6, 4.3, "MÜLL");
  rechteck(6.3, -23.0, 2.6, 6.0, "LKW");
  zeichne(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="6" fill="#f0a500" stroke="#7a5600"/>`);
  text(bx - 10, by + 4, "Bagger", 11.5, "#7a5600", true, "end");
  const [px2, py2] = px(BESEN_PLATZ.x, BESEN_PLATZ.z);
  zeichne(
    `<rect x="${(px2 - (LAENGE / 2) * m).toFixed(1)}" y="${(py2 - (TIEFE / 2) * m).toFixed(1)}" ` +
      `width="${(LAENGE * m).toFixed(1)}" height="${(TIEFE * m).toFixed(1)}" fill="#2f5738"/>`
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
  text(x0 + 16, y0 + bh - 60, `(${BESEN_PLATZ.x} | ${BESEN_PLATZ.z}) — unverändert seit E-037`, 13, "#161b20", true);
  text(x0 + 16, y0 + bh - 40, "2,82 m Luft zum Nächsten, in der", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 22, "Arbeitszone (680 kg wären sonst", 12.5, "#6b727a");
  text(x0 + 16, y0 + bh - 4, "ein Hindernis für die Fahrer).", 12.5, "#6b727a");
}

text(28, H - 24, "Blaue Strichlinie = Kollider, das, was die Physik anfasst. Grün = Draht, wie er gezeichnet wird.", 13, "#6b727a");

zeichne("</svg>");

const ziel = fileURLToPath(new URL("../docs/messungen/2026-09-15_besen-3.svg", import.meta.url));
writeFileSync(ziel, teile.join(""), "utf8");
// eslint-disable-next-line no-console
console.log(`geschrieben: ${ziel} (${(teile.join("").length / 1024).toFixed(0)} kB)`);
