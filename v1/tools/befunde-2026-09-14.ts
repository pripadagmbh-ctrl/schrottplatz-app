/**
 * Die fünf Baufehler vom 14.09.2026, gezeichnet — vorher gegen nachher.
 *
 * Patrick entscheidet alles Gestalterische am Bild, nicht am Messwert. Vier
 * der fünf Befunde sind Formsachen (überstehende Steine, ein Baum in der
 * Wand, ein verdecktes Schild, Masten auf der Fläche); dieses Blatt zeigt sie
 * so, wie man sie auf dem Platz sieht. Gezeichnet wird aus denselben Zahlen,
 * aus denen gebaut wird — kein Bildschirmfoto, keine Handskizze.
 *
 * Aufruf:  npx vite-node tools/befunde-2026-09-14.ts
 */
import * as THREE from "three";
import { writeFileSync, mkdirSync } from "node:fs";
import { reihenstuecke } from "../src/world/legoreihe";
import { muldenWandSpannen, MULDE_STEIN, CONFIGS } from "../src/world/containers";
import {
  mauerLaeufe,
  MAUER_STEIN,
  baumStandort,
  KRONE_R,
  SCHILD_POS,
  SCHILD_B,
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  GATE_X,
  TRENNSTEINE,
  TRENNSTEIN_X,
  TRENNSTEIN_L,
} from "../src/world/yard";
import { einmauern } from "../src/world/daylight";
import { hallenFootprints } from "../src/world/office";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { baueGeometrie } from "../src/world/objektbau";
import { feld, blatt, BLICK_SCHRAEG, BLICK_VORN } from "./riss";

/*
 * BEFUND 15.09.2026 (E-038): Hier stand zweimal
 * `CONFIGS.find((c) => c.id === "r_cable")!`. Die Kabelmulde ist mit E-034
 * abgerissen worden; das `!` hat dem Typpruefer versichert, sie sei da, und
 * das Werkzeug brach beim Ausfuehren mit „Cannot read properties of
 * undefined". Jetzt wird die erste Mulde mit Wand genommen, die es gibt —
 * gezeigt wird ohnehin das Mauerwerk und nicht die Fraktion. Ohne `!`, mit
 * einer Meldung, die sagt, was fehlt.
 */
const MULDE_BEISPIEL = CONFIGS.find((c) => c.kind === "bay" && c.lager !== true);
if (!MULDE_BEISPIEL) throw new Error("Keine Mulde mit Wand in CONFIGS — Blatt 1 und 5 haetten nichts zu zeigen.");

mkdirSync("docs/messungen", { recursive: true });

const F = {
  papier: "#eef0f3",
  weiss: "#ffffff",
  rahmen: "#c8ccd2",
  text: "#1b2026",
  blass: "#5b626b",
  stein: "#b6b2a8",
  steinKante: "#8b877e",
  endstein: "#3f7d5c",
  fehler: "#a33a24",
  gruen: "#2c7a66",
  baum: "#4a7a3c",
  bau: "#9a948a",
  licht: "#c9a227",
};

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** Deutsche Schreibweise: Komma statt Punkt. */
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

/* ===================================================== 1 · Endsteine ===== */
{
  const cfg = MULDE_BEISPIEL;
  const [w, d] = cfg.size;
  const BL = MULDE_STEIN.laenge;
  const BH = MULDE_STEIN.hoehe;
  const REIHEN = 4;
  const S = 64; // Pixel je Meter
  const W = 1180;
  const H = 520;
  const spannen = muldenWandSpannen(w, d, !cfg.shareEast);
  const [von, bis] = spannen.flanke;

  /** Die alte Schleife: volle Steine, bis die MITTE über das Ende läuft. */
  const alt = (versatz: number): Array<{ mitte: number; laenge: number }> => {
    const out: Array<{ mitte: number; laenge: number }> = [];
    for (let x = von + BL / 2 - versatz; x < bis + 0.4; x += BL) out.push({ mitte: x, laenge: BL });
    return out;
  };

  const zeichne = (x0: number, y0: number, titel: string, alteArt: boolean): string => {
    let s = kasten(x0, y0, 540, 400, titel);
    const mx = x0 + 270;
    const my = y0 + 300;
    const px = (m: number): number => mx + m * S;
    const py = (m: number): number => my - m * S;
    // Wandkanten als Maßlinien
    for (const kante of [von, bis]) {
      s += `<line x1="${px(kante)}" y1="${py(0) + 16}" x2="${px(kante)}" y2="${py(REIHEN * BH) - 18}" stroke="${F.gruen}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
    }
    s += t(px(von), py(REIHEN * BH) - 24, "offene Kante", 10, F.gruen, "middle");
    s += t(px(bis), py(REIHEN * BH) - 24, "Rückwand", 10, F.gruen, "middle");
    let ueber = 0;
    for (let r = 0; r < REIHEN; r++) {
      const versatz = (r % 2) * (BL / 2);
      const steine = alteArt ? alt(versatz) : reihenstuecke(von, bis, BL, versatz);
      for (const st of steine) {
        const links = st.mitte - st.laenge / 2;
        const rechts = st.mitte + st.laenge / 2;
        const raus = Math.max(von - links, rechts - bis, 0);
        ueber = Math.max(ueber, raus);
        const farbe = raus > 1e-6 ? F.fehler : st.laenge < BL - 1e-6 ? F.endstein : F.stein;
        s +=
          `<rect x="${px(links).toFixed(1)}" y="${py((r + 1) * BH).toFixed(1)}" ` +
          `width="${(st.laenge * S).toFixed(1)}" height="${(BH * S).toFixed(1)}" ` +
          `fill="${farbe}" fill-opacity="${raus > 1e-6 ? 0.55 : 0.8}" stroke="${F.steinKante}" stroke-width="1"/>`;
        // Noppen
        const anteil = st.laenge / BL;
        const noppen = anteil < 0.7 ? [0] : [-0.4 * anteil, 0.4 * anteil];
        for (const n of noppen)
          s += `<rect x="${(px(st.mitte + n * BL) - 3).toFixed(1)}" y="${(py((r + 1) * BH) - 4).toFixed(1)}" width="6" height="4" fill="${F.steinKante}"/>`;
      }
    }
    s += `<line x1="${px(von) - 40}" y1="${py(0)}" x2="${px(bis) + 40}" y2="${py(0)}" stroke="${F.text}" stroke-width="1.5"/>`;
    s += t(
      x0 + 14,
      y0 + 380,
      alteArt
        ? `Überstand bis ${zahl(ueber)} m — ein halber Stein steht in der Luft`
        : `Überstand 0,00 m — der kürzeste Stein misst ${((BL / 2) * 100).toFixed(0)} cm`,
      12,
      alteArt ? F.fehler : F.gruen,
      "start",
      600
    );
    return s;
  };

  let inhalt = zeichne(24, 96, "VORHER · volle Steine, Schleife mit 0,4 m Zugabe", true);
  inhalt += zeichne(600, 96, "NACHHER · Endstein an jeder Wandkante", false);
  inhalt += t(
    24,
    H - 26,
    `Mulde ${MULDE_BEISPIEL.label}, Stein 1,50 × 0,50 × 0,55 m · grün = Endstein, rot = Überstand`,
    12,
    F.blass
  );
  writeFileSync(
    "docs/messungen/2026-09-14_legosteine.svg",
    blatt(W, H, "Befund 1 · Volle Legosteine, wo ein halber reicht", "Ansicht einer Muldenflanke, vier Lagen", inhalt)
  );
}

/* ======================================================== 2 · Baum ======= */
{
  const W = 1100;
  const H = 540;
  // Ausschnitt: nur die Ausbuchtung und ihr Umfeld
  const S = 13;
  const Z_OBEN = -23;
  const Z_UNTEN = -45;
  const mx = 543;
  const px = (x: number): number => mx + x * S;
  const py = (z: number): number => 150 + (Z_OBEN - z) * S;
  let inhalt = kasten(24, 96, W - 48, 390, "Die Ausbuchtung von oben · Bäume vorher (rot) und nachher (grün)");

  // Mauern, auf den Ausschnitt beschnitten
  for (const l of mauerLaeufe()) {
    const dick = MAUER_STEIN.dicke * S;
    if (l.achse === "x") {
      if (l.fest > Z_OBEN || l.fest < Z_UNTEN) continue;
      const von = Math.max(l.von, -19);
      const bis = Math.min(l.bis, 19);
      if (bis <= von) continue;
      inhalt += `<rect x="${px(von).toFixed(1)}" y="${(py(l.fest) - dick / 2).toFixed(1)}" width="${((bis - von) * S).toFixed(1)}" height="${dick.toFixed(1)}" fill="${F.stein}" stroke="${F.steinKante}" stroke-width="0.8"/>`;
    } else {
      const von = Math.max(l.von, Z_UNTEN);
      const bis = Math.min(l.bis, Z_OBEN);
      if (bis <= von || l.fest < -19 || l.fest > 19) continue;
      inhalt += `<rect x="${(px(l.fest) - dick / 2).toFixed(1)}" y="${py(bis).toFixed(1)}" width="${dick.toFixed(1)}" height="${((bis - von) * S).toFixed(1)}" fill="${F.stein}" stroke="${F.steinKante}" stroke-width="0.8"/>`;
    }
  }
  inhalt += t(px(0.5), py(-33.5), "Ausbuchtung: Misch- und Stahlschrott", 11, F.blass, "middle");

  // Bäume: derselbe feste Zufall wie in yard.ts
  const YARD_W = YARD_MAX_X - YARD_MIN_X;
  const hz = YARD_D / 2;
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 46; i++) {
    const seite = i % 4;
    const q = rnd();
    let x: number;
    let z: number;
    if (seite === 0) {
      x = YARD_MIN_X + q * YARD_W;
      z = hz + 5 + rnd() * 26;
      if (Math.abs(x - GATE_X) < 9) continue;
    } else if (seite === 1) {
      x = YARD_MIN_X + q * YARD_W;
      z = -hz - 5 - rnd() * 26;
    } else if (seite === 2) {
      x = YARD_MIN_X - 5 - rnd() * 26;
      z = -hz + q * YARD_D;
    } else {
      x = YARD_MAX_X + 5 + rnd() * 26;
      z = -hz + q * YARD_D;
    }
    const scale = 0.85 + rnd() * 0.8;
    for (let k = 0; k < 6; k++) rnd();
    const krone = KRONE_R * scale;
    const neu = baumStandort(x, z, krone);
    if (z > Z_OBEN || z < Z_UNTEN || x < -19 || x > 19) continue; // nur der Ausschnitt
    const versetzt = Math.hypot(neu.x - x, neu.z - z) > 1e-9;
    inhalt += `<circle cx="${px(x).toFixed(1)}" cy="${py(z).toFixed(1)}" r="${(krone * S).toFixed(1)}" fill="${versetzt ? F.fehler : F.baum}" fill-opacity="0.22" stroke="${versetzt ? F.fehler : F.baum}" stroke-width="1.2" ${versetzt ? 'stroke-dasharray="4 3"' : ""}/>`;
    if (versetzt) {
      inhalt += `<circle cx="${px(neu.x).toFixed(1)}" cy="${py(neu.z).toFixed(1)}" r="${(krone * S).toFixed(1)}" fill="${F.gruen}" fill-opacity="0.3" stroke="${F.gruen}" stroke-width="1.4"/>`;
      inhalt += `<line x1="${px(x).toFixed(1)}" y1="${py(z).toFixed(1)}" x2="${px(neu.x).toFixed(1)}" y2="${py(neu.z).toFixed(1)}" stroke="${F.gruen}" stroke-width="1.6"/>`;
      inhalt += t(
        px(neu.x),
        py(neu.z) + 4,
        `${zahl(Math.hypot(neu.x - x, neu.z - z))} m`,
        10,
        F.gruen,
        "middle",
        600
      );
    }
  }
  inhalt += t(
    24,
    H - 26,
    "Maßstab 1 : 105 · rot gestrichelt = alter Standort (Krone in der Wand), grün = versetzt",
    12,
    F.blass
  );
  writeFileSync(
    "docs/messungen/2026-09-14_baum.svg",
    blatt(W, H, "Befund 2 · Eine Wand läuft durch einen Baum", "Ausbuchtung von oben, Kronenradius maßstäblich", inhalt)
  );
}

/* ====================================================== 3 · Schild ======= */
{
  const W = 1180;
  const H = 700;
  // Der ganze Nordteil des Platzes plus die Kamera im Süden
  const S = 7.0;
  const mx = 640;
  const px = (x: number): number => mx + x * S;
  const py = (z: number): number => 140 + (36 - z) * S;
  let inhalt = kasten(24, 96, W - 48, 540, "Blick von der Startkamera nach Norden · was vor dem Schild steht");

  // Platzmauern
  for (const l of mauerLaeufe()) {
    const dick = MAUER_STEIN.dicke * S;
    if (l.achse === "x")
      inhalt += `<rect x="${px(l.von).toFixed(1)}" y="${(py(l.fest) - dick / 2).toFixed(1)}" width="${((l.bis - l.von) * S).toFixed(1)}" height="${dick.toFixed(1)}" fill="${F.stein}"/>`;
    else
      inhalt += `<rect x="${(px(l.fest) - dick / 2).toFixed(1)}" y="${py(l.bis).toFixed(1)}" width="${dick.toFixed(1)}" height="${((l.bis - l.von) * S).toFixed(1)}" fill="${F.stein}"/>`;
  }
  // Büro und Hallen
  const bau = (x0: number, x1: number, z0: number, z1: number, name: string): string =>
    `<rect x="${px(x0)}" y="${py(z1)}" width="${((x1 - x0) * S).toFixed(1)}" height="${((z1 - z0) * S).toFixed(1)}" fill="${F.bau}" fill-opacity="0.75" stroke="${F.steinKante}"/>` +
    t((px(x0) + px(x1)) / 2, (py(z0) + py(z1)) / 2 + 4, name, 10, "#ffffff", "middle", 600);
  inhalt += bau(-39.6, -30.6, 22.4, 28.6, "BÜRO");
  /*
   * BEFUND 15.09.2026 (E-038): Hier stand `HALLEN_X.forEach(...)` mit
   * `HALLEN_Z` als Einzelzahl. Seit dem Umbau „Hallen zurueck ans Buero"
   * (E-028) ist es genau andersherum — `HALLEN_X` ist EINE Zahl, `HALLEN_Z`
   * sind DREI. Das Werkzeug liess sich seitdem nicht mehr ausfuehren; gesehen
   * hat es niemand, weil `tools/` bis heute nie typgeprueft wurde. Jetzt aus
   * `hallenFootprints()` gelesen, also aus derselben Quelle wie der Bau.
   */
  hallenFootprints().forEach(([hx, hz, halbX, halbZ], i) => {
    inhalt += bau(hx - halbX, hx + halbX, hz - halbZ, hz + halbZ, `HALLE ${i + 1}`);
  });

  // Kamera
  const kam = { x: BAGGER_STAND.x, z: BAGGER_STAND.z - Math.cos(0.42) * 11 };
  inhalt += `<circle cx="${px(kam.x)}" cy="${py(kam.z)}" r="6" fill="${F.gruen}"/>`;
  inhalt += t(px(kam.x) + 10, py(kam.z) + 4, "Startkamera", 11, F.gruen, "start", 600);

  // Der Parameter `yText` wurde nie gelesen (beide Aufrufe uebergaben 0);
  // gemeldet von der Typpruefung fuer `tools/` (E-038).
  const tafel = (
    cx: number,
    breite: number,
    farbe: string,
    beschriftung: string
  ): string => {
    let s = `<rect x="${px(cx - breite / 2)}" y="${py(SCHILD_POS.z) - 4}" width="${(breite * S).toFixed(1)}" height="8" fill="${farbe}"/>`;
    for (const kante of [cx - breite / 2, cx + breite / 2]) {
      s += `<line x1="${px(kam.x)}" y1="${py(kam.z)}" x2="${px(kante)}" y2="${py(SCHILD_POS.z)}" stroke="${farbe}" stroke-width="1" stroke-dasharray="4 4" opacity="0.8"/>`;
    }
    s += t(px(cx), py(SCHILD_POS.z) - 10, beschriftung, 11, farbe, "middle", 600);
    return s;
  };
  inhalt += tafel(-10, 14, F.fehler, "VORHER 14 m — 40 % hinter den Hallen");
  inhalt += tafel(SCHILD_POS.x, SCHILD_B, F.gruen, `NACHHER ${zahl(SCHILD_B, 1)} m — frei`);
  // Einfahrtsspur
  inhalt += `<rect x="${px(GATE_X - 1.55)}" y="${py(36)}" width="${(3.1 * S).toFixed(1)}" height="${(10 * S).toFixed(1)}" fill="${F.licht}" fill-opacity="0.2" stroke="${F.licht}" stroke-dasharray="4 4"/>`;
  inhalt += t(px(GATE_X), py(36) - 8, "LKW-Einfahrt", 10, F.licht, "middle", 600);

  inhalt += t(
    24,
    H - 26,
    "Gemessen aus der Startansicht (Orbit, 11 m, 24° geneigt, 55°): vorher 69 % frei und 60 % im Bild, nachher 100 % / 100 %",
    12,
    F.blass
  );
  writeFileSync(
    "docs/messungen/2026-09-14_schild.svg",
    blatt(W, H, "Befund 3 · Das Firmenschild ist verdeckt", "Grundriss mit Sichtlinien", inhalt)
  );
}

/* ==================================================== 4 · Flutlicht ====== */
{
  const W = 1180;
  const H = 700;
  const S = 7.0;
  const mx = 500;
  const px = (x: number): number => mx + x * S;
  const py = (z: number): number => 140 + (29 - z) * S;
  const MASTEN: Array<[number, number]> = [
    [-37, 26],
    [-37, -26],
    [-37, 2],
    [9, 26],
    [9, 8],
    [0, 26],
  ];
  let inhalt = kasten(24, 96, 740, 560, "Masten vorher (rot) und eingemauert (grün)");
  for (const l of mauerLaeufe()) {
    const dick = MAUER_STEIN.dicke * S;
    if (l.achse === "x")
      inhalt += `<rect x="${px(l.von)}" y="${py(l.fest) - dick / 2}" width="${((l.bis - l.von) * S).toFixed(1)}" height="${dick.toFixed(1)}" fill="${F.stein}"/>`;
    else
      inhalt += `<rect x="${px(l.fest) - dick / 2}" y="${py(l.bis)}" width="${dick.toFixed(1)}" height="${((l.bis - l.von) * S).toFixed(1)}" fill="${F.stein}"/>`;
  }
  for (const [x, z] of MASTEN) {
    const [nx, nz] = einmauern(x, z);
    inhalt += `<circle cx="${px(x)}" cy="${py(z)}" r="5" fill="none" stroke="${F.fehler}" stroke-width="2"/>`;
    inhalt += `<line x1="${px(x)}" y1="${py(z)}" x2="${px(nx)}" y2="${py(nz)}" stroke="${F.gruen}" stroke-width="1.5"/>`;
    inhalt += `<circle cx="${px(nx)}" cy="${py(nz)}" r="5" fill="${F.licht}" stroke="${F.gruen}" stroke-width="2"/>`;
    inhalt += t(px(nx), py(nz) - 10, `${zahl(Math.hypot(nx - x, nz - z), 1)} m`, 9, F.gruen, "middle");
  }
  inhalt += t(px(BAGGER_STAND.x), py(BAGGER_STAND.z) + 4, "B", 12, F.gruen, "middle", 700);
  inhalt += `<circle cx="${px(BAGGER_STAND.x)}" cy="${py(BAGGER_STAND.z)}" r="9" fill="none" stroke="${F.gruen}" stroke-width="1.5"/>`;

  // Schnitt durch die Mauer mit Mast
  const sx = 840;
  const sy = 96;
  inhalt += kasten(sx, sy, 316, 560, "Schnitt: der Mast steckt in der Mauer");
  const SS = 34;
  const bx = sx + 158;
  const by = sy + 500;
  // Steine der Umrandung
  for (let r = 0; r < 3; r++) {
    for (const seite of [-1, 1]) {
      inhalt += `<rect x="${bx + seite * 0.36 * SS - (seite < 0 ? 1.6 * SS : 0)}" y="${by - (r + 1) * 0.6 * SS}" width="${(1.6 * SS).toFixed(1)}" height="${(0.6 * SS).toFixed(1)}" fill="${F.stein}" stroke="${F.steinKante}"/>`;
    }
  }
  // Betonsockel und Mast
  inhalt += `<rect x="${bx - 0.36 * SS}" y="${by - 1.8 * SS}" width="${(0.72 * SS).toFixed(1)}" height="${(1.8 * SS).toFixed(1)}" fill="#a8a49b" stroke="${F.steinKante}"/>`;
  inhalt += `<rect x="${bx - 0.2 * SS}" y="${by - 12 * SS}" width="${(0.4 * SS).toFixed(1)}" height="${(12 * SS).toFixed(1)}" fill="#6b7278"/>`;
  inhalt += `<rect x="${bx - 0.34 * SS}" y="${by - 1.9 * SS}" width="${(0.68 * SS).toFixed(1)}" height="${(0.22 * SS).toFixed(1)}" fill="#3d4347"/>`;
  inhalt += `<rect x="${bx - 1.3 * SS}" y="${by - 12.4 * SS}" width="${(2.6 * SS).toFixed(1)}" height="${(0.16 * SS).toFixed(1)}" fill="#3d4347"/>`;
  for (const off of [-0.95, -0.32, 0.32, 0.95])
    inhalt += `<rect x="${bx + (off - 0.26) * SS}" y="${by - 12.3 * SS}" width="${(0.52 * SS).toFixed(1)}" height="${(0.42 * SS).toFixed(1)}" fill="${F.licht}"/>`;
  inhalt += `<line x1="${bx - 2.2 * SS}" y1="${by}" x2="${bx + 2.2 * SS}" y2="${by}" stroke="${F.text}" stroke-width="1.5"/>`;
  inhalt += t(bx, by + 18, "Mauerhöhe 1,80 m · Mast 12,00 m", 11, F.blass, "middle");

  inhalt += t(
    24,
    H - 26,
    "Ausleuchtung über vierzehn Arbeitspunkte nachgerechnet: 95 % nach dem Versetzen, mit 400 statt 380 Lichtstärke wieder 100 %",
    12,
    F.blass
  );
  writeFileSync(
    "docs/messungen/2026-09-14_flutlicht.svg",
    blatt(W, H, "Befund 4 · Scheinwerfer einmauern", "Grundriss und Schnitt", inhalt)
  );
}

/* ============================== Frage · Pyramiden an den Mulden? ========= */
{
  const W = 1180;
  const H = 560;
  let inhalt = kasten(24, 96, 560, 380, "Was heute zwischen den Halden steht: die Trennstein-Pyramide");
  const S = 46;
  const mx = 300;
  const my = 400;
  const px = (m: number): number => mx + (m + 34.7) * S * 0.62;
  const py = (m: number): number => my - m * S;
  TRENNSTEINE.forEach((st) => {
    const lagen = Math.round(st.hoehe / 0.6);
    for (let r = 0; r < lagen; r++) {
      inhalt += `<rect x="${px(st.z).toFixed(1)}" y="${py((r + 1) * 0.6).toFixed(1)}" width="${(TRENNSTEIN_L * S * 0.62).toFixed(1)}" height="${(0.6 * S).toFixed(1)}" fill="${F.stein}" stroke="${F.steinKante}"/>`;
    }
    inhalt += t(px(st.z) + 14, py(st.hoehe) - 8, `${zahl(st.hoehe, 1)} m`, 10, F.blass, "middle");
  });
  inhalt += `<line x1="${px(TRENNSTEINE[0]!.z) + 60}" y1="${py(0)}" x2="${px(TRENNSTEINE[TRENNSTEINE.length - 1]!.z) - 20}" y2="${py(0)}" stroke="${F.text}" stroke-width="1.5"/>`;
  inhalt += t(24, 470, `Sechs Säulen à 1,60 m auf x ${zahl(TRENNSTEIN_X, 1)}, Lagen 1–2–4–4–2–1`, 12, F.blass);

  inhalt += kasten(604, 96, 552, 380, "Was an den drei Metallmulden steht: gerade Wände");
  const mx2 = 880;
  const my2 = 400;
  const cfg = MULDE_BEISPIEL;
  const [w] = cfg.size;
  const REIHEN = Math.max(2, Math.round(cfg.size[2] / MULDE_STEIN.hoehe));
  for (let r = 0; r < REIHEN; r++) {
    for (const st of reihenstuecke(-w / 2, w / 2, MULDE_STEIN.laenge, (r % 2) * (MULDE_STEIN.laenge / 2))) {
      inhalt += `<rect x="${(mx2 + (st.mitte - st.laenge / 2) * S).toFixed(1)}" y="${(my2 - (r + 1) * MULDE_STEIN.hoehe * S).toFixed(1)}" width="${(st.laenge * S).toFixed(1)}" height="${(MULDE_STEIN.hoehe * S).toFixed(1)}" fill="${F.stein}" stroke="${F.steinKante}"/>`;
    }
  }
  inhalt += `<line x1="${mx2 - (w / 2) * S - 30}" y1="${my2}" x2="${mx2 + (w / 2) * S + 30}" y2="${my2}" stroke="${F.text}" stroke-width="1.5"/>`;
  inhalt += t(
    604 + 14,
    470,
    `Mulde ${cfg.label}: ${REIHEN} Lagen à 0,50 m = ${zahl(REIHEN * MULDE_STEIN.hoehe)} m, durchgehend gleich hoch`,
    12,
    F.blass
  );
  inhalt += t(
    24,
    H - 26,
    "Offene Frage an Patrick: Soll die Pyramidenform auch an den Mulden gebaut werden? Hier ist nichts geändert.",
    12,
    F.text,
    "start",
    600
  );
  writeFileSync(
    "docs/messungen/2026-09-14_pyramiden.svg",
    blatt(W, H, 'Frage · „Die Mulden haben überhaupt keine Pyramiden“', "Was gebaut ist, in Ansicht", inhalt)
  );
}

/* =================================================== 5 · Schneemobil ===== */
{
  const dims: [number, number, number] = [1.15, 1.1, 2.2];
  const mach = (bau: string): THREE.Mesh => {
    const g = baueGeometrie(bau as never, dims, "box").koerper;
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8a8f95 }));
  };
  const W = 1180;
  const H = 520;
  const BLICK_SEITE = new THREE.Vector3(1, 0.06, 0.02);
  let inhalt = "";
  inhalt += feld(
    { name: 'VORHER · „kleinfahrzeug“', obj: mach("kleinfahrzeug"), blick: BLICK_SCHRAEG, notiz: "vier Gummiräder" },
    24,
    96,
    276,
    390
  );
  inhalt += feld(
    { name: 'NACHHER · „kufenRaupe“', obj: mach("kufenRaupe"), blick: BLICK_SCHRAEG, notiz: "zwei Kufen, eine Raupe" },
    312,
    96,
    276,
    390
  );
  inhalt += feld(
    { name: "NACHHER · von der Seite", obj: mach("kufenRaupe"), blick: BLICK_SEITE, notiz: "Kufe vorn, Raupe hinten" },
    600,
    96,
    276,
    390
  );
  inhalt += feld(
    { name: "NACHHER · von vorn", obj: mach("kufenRaupe"), blick: BLICK_VORN, notiz: "Kufen auf ±0,40 · Breite" },
    888,
    96,
    276,
    390
  );
  writeFileSync(
    "docs/messungen/2026-09-14_schneemobil.svg",
    blatt(W, H, "Befund 5 · Das Schneemobil hatte vier Gummiräder", "Katalogmaß 1,15 × 1,10 × 2,20 m", inhalt)
  );
}

console.log("docs/messungen/2026-09-14_legosteine.svg");
console.log("docs/messungen/2026-09-14_baum.svg");
console.log("docs/messungen/2026-09-14_schild.svg");
console.log("docs/messungen/2026-09-14_flutlicht.svg");
console.log("docs/messungen/2026-09-14_pyramiden.svg");
console.log("docs/messungen/2026-09-14_schneemobil.svg");
