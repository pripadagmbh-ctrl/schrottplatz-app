/**
 * Das Blatt zur Schalenform: HEUTE · NEU · VORBILD, drei Spalten, ein Massstab.
 *
 * Anlass: Patrick, 16.09.2026 — „aktuell sieht die neue Spinne aus wie die alte
 * Spinne", und die Frage, wie alles UNTERHALB DER TRAVERSE neu gedacht wird.
 *
 * DIE REGEL DIESES BLATTES ist dieselbe wie beim Vorher-Nachher-Blatt von
 * E-069: EHRLICH ZEICHNEN. Alle drei Spalten stehen in jeder Zeile im selben
 * Massstab, die Silhouette des GANZEN Greifers ist die Hauptsache, und die
 * Deckungsgleichheit steht als Zahl da — auch wenn sie hoch ist.
 *
 * Gerechnet wird in `schalenform-modell.ts`; hier wird nur gezeichnet.
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/schalenform-blatt.ts
 * Ergebnis: docs/f5-schalenform-2026-09-16.svg + Tabelle auf der Konsole
 */
import { writeFileSync } from "node:fs";
import {
  ALLE,
  GRAD,
  KEINE,
  STUFEN,
  VORBILD_ZAHNNEIGUNG,
  bericht,
  deckung,
  eigenUmriss,
  formHeute,
  formNeu,
  formVorbild,
  greiferDreiecke,
  messe,
  spannen,
  vorbildMessung,
  waechter,
  type Form,
  type Kennzahl,
} from "./schalenform-modell";
import { OBERE_ANBINDUNG, SCHALEN_ABSCHNITTE, STEMPEL_AUGE } from "../../src/fuenfschalen/teile";

/* ------------------------------------------------------------------ Farben */

const F = {
  papier: "#f4f2ee",
  feld: "#ffffff",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#c3c9cf",
  heute: "#3f4a52",
  neu: "#1f5d86",
  vorbild: "#8a5a1e",
  gut: "#1d6f34",
  warn: "#9c2717",
};

const BREITE = 1740;
const HOEHE = 2960;
const SPALTE_X = [40, 610, 1180];
const SPALTE_B = 520;

let svg = "";

function text(
  x: number,
  y: number,
  s: string,
  groesse = 13,
  farbe = F.linie,
  fett = false,
  anker = "start"
): void {
  svg +=
    `<text x="${x}" y="${y}" font-family="Segoe UI,Arial" font-size="${groesse}" ` +
    `fill="${farbe}"${fett ? ' font-weight="700"' : ""}` +
    `${anker !== "start" ? ` text-anchor="${anker}"` : ""}>` +
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
    "</text>";
}

function rahmen(x: number, y: number, b: number, h: number, titel?: string): void {
  svg += `<rect x="${x}" y="${y}" width="${b}" height="${h}" fill="${F.feld}" stroke="${F.hilfe}"/>`;
  if (titel) text(x + 8, y + 18, titel, 12, F.grau, true);
}

function komma(x: number, n = 2): string {
  return x.toFixed(n).replace(".", ",");
}

/**
 * Text ueber mehrere Zeilen, umgebrochen an Wortgrenzen.
 *
 * SVG bricht von sich aus nichts um — ein langer `<text>` laeuft einfach ueber
 * den Rahmen hinaus und ueber den Nachbarn. `zeichen` ist die Breite in
 * Zeichen; bei Arial und der hier benutzten Groesse passen rund 5,3 px auf ein
 * Zeichen, das reicht fuer ein Blatt.
 */
function absatz(
  x: number,
  y: number,
  s: string,
  zeichen: number,
  groesse = 10,
  farbe = F.grau,
  abstand = 13
): number {
  const worte = s.split(" ");
  let zeile = "";
  let n = 0;
  for (const wo of worte) {
    if ((zeile + " " + wo).trim().length > zeichen && zeile) {
      text(x, y + n * abstand, zeile, groesse, farbe);
      n++;
      zeile = wo;
    } else {
      zeile = (zeile + " " + wo).trim();
    }
  }
  if (zeile) {
    text(x, y + n * abstand, zeile, groesse, farbe);
    n++;
  }
  return n;
}

/* -------------------------------------------------------------- Abbildungen */

interface Karte {
  x: number;
  y: number;
  b: number;
  h: number;
  /** Weltkoordinaten der Mitte und Massstab px je Meter. */
  mz: number;
  my: number;
  m: number;
}

function karte(x: number, y: number, b: number, h: number, box: number[], rand = 16): Karte {
  const [z0, z1, y0, y1] = box as [number, number, number, number];
  const m = Math.min((b - 2 * rand) / (z1 - z0), (h - 2 * rand) / (y1 - y0));
  return { x, y, b, h, mz: (z0 + z1) / 2, my: (y0 + y1) / 2, m };
}

/** Welt (z, y) → Blatt (px). y zeigt in der Welt nach oben, auf dem Blatt nach unten. */
function px(k: Karte, z: number, y: number): [number, number] {
  return [k.x + k.b / 2 + (z - k.mz) * k.m, k.y + k.h / 2 - (y - k.my) * k.m];
}

function pfad(k: Karte, punkte: Array<[number, number]>, fuellung: string, deckkraft = 1): void {
  if (!punkte.length) return;
  let d = "";
  punkte.forEach(([z, y], i) => {
    const [a, b] = px(k, z, y);
    d += `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`;
  });
  svg += `<path d="${d}Z" fill="${fuellung}" fill-opacity="${deckkraft}" stroke="none"/>`;
}

function linie(
  k: Karte,
  punkte: Array<[number, number]>,
  farbe: string,
  stark = 1.2,
  strich = ""
): void {
  let d = "";
  punkte.forEach(([z, y], i) => {
    const [a, b] = px(k, z, y);
    d += `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`;
  });
  svg +=
    `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${stark}"` +
    `${strich ? ` stroke-dasharray="${strich}"` : ""}/>`;
}

/**
 * Eine Bohrung: weisse Scheibe mit dunklem Rand.
 *
 * Als blosser weisser Ring gezeichnet war sie dort unsichtbar, wo sie AUSSERHALB
 * der Schale liegt — und das Zylinderauge liegt in der HEUTE-Spalte zum Teil
 * ausserhalb. Eine gefuellte Scheibe liest sich auf beiden Untergruenden als
 * Loch, und genau das ist sie.
 */
function kreis(k: Karte, z: number, y: number, r: number, farbe: string): void {
  const [a, b] = px(k, z, y);
  svg +=
    `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${(r * k.m).toFixed(1)}" ` +
    `fill="${farbe}" stroke="${F.linie}" stroke-width="1.2"/>`;
}

/**
 * Eine Silhouette aus den Zeilenstrecken des Risses.
 *
 * Gezeichnet werden die STRECKEN, nicht die Dreiecke: 12.000 Dreiecke je Bild
 * waeren ein Blatt von acht Megabyte, und man saehe dasselbe. Die Strecken sind
 * dieselben, aus denen auch die Deckungszahl kommt — Bild und Zahl koennen
 * deshalb nicht auseinanderlaufen.
 */
function silhouette(k: Karte, f: Form, t: number, farbe: string): void {
  const zeile = 0.006;
  let d = "";
  for (const s of spannen(greiferDreiecke(f, t), zeile)) {
    const [a, b] = px(k, s.von, s.y + zeile / 2);
    const br = (s.bis - s.von) * k.m;
    const ho = zeile * k.m + 0.6;
    d += `M${a.toFixed(1)} ${b.toFixed(1)}h${br.toFixed(1)}v${ho.toFixed(1)}h${(-br).toFixed(1)}Z`;
  }
  svg += `<path d="${d}" fill="${farbe}" stroke="none"/>`;
}

/* ================================================================== Inhalt */

const formen: Array<{ f: Form; farbe: string; unter: string }> = [
  {
    f: formHeute(),
    farbe: F.heute,
    unter: "Kreis R 0,756 m · Platte + Kastenrippe · Ende 30 % · Zahn buendig",
  },
  {
    f: formNeu({ n1: "heute", n2: true, n3: true, n4: true }),
    farbe: F.neu,
    unter: "N2 + N3 + N4 (Empfehlung) · Trog mit Wangen · Ende 62 % · Zahn auf Aufnahme",
  },
  {
    f: formVorbild(),
    farbe: F.vorbild,
    unter:
      "abgelesene Ruecken­linie aus dem Foto (SCHAETZUNG) · Querschnitt und Zahn wie NEU, denn beides ist am Foto NICHT messbar",
  },
];
const kz: Kennzahl[] = formen.map((s) => messe(s.f));
const umr = formen.map((s) => eigenUmriss(s.f));
const v = vorbildMessung();
const w = waechter();

svg += `<rect width="${BREITE}" height="${HOEHE}" fill="${F.papier}"/>`;
text(40, 46, "Alles unterhalb der Traverse — die Schalenform neu gezeichnet", 24, F.linie, true);
text(
  40,
  70,
  "HEUTE · NEU · VORBILD, drei Spalten im selben Massstab. " +
    "Anlass: „aktuell sieht die neue Spinne aus wie die alte Spinne\" (16.09.2026). " +
    "Jede Zahl aus einem Foto ist als SCHAETZUNG gekennzeichnet.",
  13,
  F.grau
);

/* ---------------------------------------------- Kopfzeile der drei Spalten */

const namen = ["HEUTE — was gebaut ist", "NEU — Vorschlag", "VORBILD — Foto, geschaetzt"];
SPALTE_X.forEach((x, i) => {
  svg += `<rect x="${x}" y="90" width="${SPALTE_B}" height="26" fill="${formen[i]!.farbe}"/>`;
  text(x + 10, 108, namen[i]!, 14, "#ffffff", true);
  text(x + 4, 132, formen[i]!.unter, 11, F.grau);
});

/* ------------------------------------------- Block 1: die Schale allein */

const Y1 = 144;
const H1 = 520;
// gemeinsamer Ausschnitt fuer alle drei Spalten — sonst luegt der Massstab
const box1 = [Infinity, -Infinity, Infinity, -Infinity];
for (const u of umr) {
  for (const p of [...u.ruecken, ...u.bauch]) {
    box1[0] = Math.min(box1[0]!, p[0]);
    box1[1] = Math.max(box1[1]!, p[0]);
    box1[2] = Math.min(box1[2]!, p[1]);
    box1[3] = Math.max(box1[3]!, p[1]);
  }
}
SPALTE_X.forEach((x, i) => {
  rahmen(x, Y1, SPALTE_B, H1, "1 · DIE SCHALE ALLEIN — Seitenriss im Frame des Bolzens");
  const k = karte(x, Y1 + 16, SPALTE_B, H1 - 16, box1, 30);
  const u = umr[i]!;
  pfad(k, [...u.ruecken, ...[...u.bauch].reverse()], formen[i]!.farbe, 0.9);
  // zum Vergleich: die heutige Kontur als duenne Linie ueber jede Spalte
  if (i > 0) {
    const h = umr[0]!;
    linie(k, [...h.ruecken, ...[...h.bauch].reverse(), h.ruecken[0]!], F.heute, 1, "5 4");
  }
  // Bolzen und Zylinderauge — beide bleiben, wo sie sind
  kreis(k, 0, 0, 0.085, "#ffffff");
  kreis(k, OBERE_ANBINDUNG.z, OBERE_ANBINDUNG.y, 0.085, "#ffffff");
  const [bz, by] = px(k, 0, 0);
  text(bz + 12, by - 8, "Bolzen", 10, F.linie);
  const [az, ay] = px(k, OBERE_ANBINDUNG.z, OBERE_ANBINDUNG.y);
  text(az + 12, ay + 4, "Zylinderauge", 10, F.linie);
  // Naht der Zahnaufnahme
  if (i > 0) {
    const [nz, ny] = px(k, u.naht[0], u.naht[1]);
    svg += `<circle cx="${nz.toFixed(1)}" cy="${ny.toFixed(1)}" r="4" fill="${F.warn}"/>`;
    text(nz - 10, ny + 16, "Zahnaufnahme", 10, F.warn, true, "end");
  }
  // Schnittstellen markieren
  for (const j of [0, 3, 6]) {
    const st = u.stationen[j]!;
    const [sz, sy] = px(k, st[0], st[1]);
    svg += `<circle cx="${sz.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.5" fill="${F.hilfe}"/>`;
    text(sz + 6, sy + 4, `k${j}`, 9, F.grau);
  }
  text(x + 8, Y1 + H1 - 10, `Massstab: 1 m = ${k.m.toFixed(0)} px — in allen drei Spalten gleich`, 10, F.hilfe);
});
text(
  40,
  Y1 + H1 + 18,
  "Gestrichelt in Spalte 2 und 3: die heutige Kontur, im selben Frame. " +
    "Bolzen und Zylinderauge sind in allen drei Spalten derselbe Punkt — daran haengt die Anlenkung, und sie wird nicht angefasst.",
  11,
  F.grau
);

/* --------------------------------------- Block 2: Querschnitt an drei Stellen */

const Y2 = Y1 + H1 + 32;
const H2 = 250;
const box2 = [-0.23, 0.23, -0.15, 0.2];
SPALTE_X.forEach((x, i) => {
  rahmen(x, Y2, SPALTE_B, H2, "2 · QUERSCHNITT an k0 (Bolzen) · k3 (Mitte) · k6 (Ende)");
  [0, 3, 6].forEach((kk, j) => {
    const k = karte(x + 4 + j * ((SPALTE_B - 8) / 3), Y2 + 22, (SPALTE_B - 8) / 3, H2 - 46, box2, 10);
    // Mittellinie als Hilfslinie: w = 0
    linie(k, [[-0.21, 0], [0.21, 0]], F.hilfe, 1, "4 3");
    const q = formen[i]!.f.schnitt(kk).map(([qx, qw]) => [qx, qw] as [number, number]);
    pfad(k, q, formen[i]!.farbe, 0.9);
    const b = 2 * formen[i]!.f.halb(kk);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, qw] of q) {
      lo = Math.min(lo, qw);
      hi = Math.max(hi, qw);
    }
    text(
      k.x + k.b / 2,
      Y2 + H2 - 10,
      `k${kk}  ${(b * 1000).toFixed(0)} × ${((hi - lo) * 1000).toFixed(0)} mm`,
      11,
      F.linie,
      false,
      "middle"
    );
  });
});
text(
  40,
  Y2 + H2 + 18,
  "Gestrichelt: die Mittellinie der Schale. Heute liegt der ganze Werkstoff AUSSERHALB davon " +
    "(Platte plus 220 mm breite Kastenrippe). Neu steht er zu beiden Seiten: ein Trog, dessen Wangen nach INNEN in den Korb greifen.",
  11,
  F.grau
);

/* ------------------------------------------- Block 3/4: der ganze Greifer */

const bilder: Array<[string, number, number, number]> = [
  ["3 · DER GANZE GREIFER, OFFEN — Silhouette von der Seite", 1, Y2 + H2 + 32, 400],
  ["4 · DER GANZE GREIFER, GESCHLOSSEN — dasselbe von der Seite", 0, Y2 + H2 + 32 + 416, 580],
];
const boxG: Record<number, number[]> = {};
for (const [, t] of bilder) {
  const b = [Infinity, -Infinity, Infinity, -Infinity];
  for (const s of formen) {
    for (const zeile of spannen(greiferDreiecke(s.f, t), 0.02)) {
      b[0] = Math.min(b[0]!, zeile.von);
      b[1] = Math.max(b[1]!, zeile.bis);
      b[2] = Math.min(b[2]!, zeile.y);
      b[3] = Math.max(b[3]!, zeile.y);
    }
  }
  boxG[t] = b;
}
for (const [titel, t, y, h] of bilder) {
  SPALTE_X.forEach((x, i) => {
    rahmen(x, y, SPALTE_B, h, i === 0 ? titel : "");
    const k = karte(x, y + 20, SPALTE_B, h - 40, boxG[t]!, 22);
    // Bezugslinien: Bolzenebene und Aufhaengung
    const [, by] = px(k, 0, STEMPEL_AUGE.y);
    svg +=
      `<line x1="${x + 6}" y1="${by.toFixed(1)}" x2="${x + SPALTE_B - 6}" y2="${by.toFixed(1)}" ` +
      `stroke="${F.hilfe}" stroke-dasharray="4 4"/>`;
    silhouette(k, formen[i]!.f, t, formen[i]!.farbe);
    const m = kz[i]!;
    text(
      x + 8,
      y + h - 10,
      t === 1
        ? `Maulweite ${komma(m.maulweite)} m · tiefster Punkt ${komma(m.tiefsterPunkt)} m`
        : `Korbtiefe ${komma(m.korbtiefe)} m · Loch unten ${komma(m.spitzenweiteZu)} m`,
      11,
      F.linie
    );
  });
}

/* ------------------------------------------------------- Block 5: Kennwerte */

const Y5 = bilder[1]![2] + bilder[1]![3] + 26;
rahmen(40, Y5, BREITE - 80, 268, "5 · KENNWERTE — dieselbe Rechnung fuer alle drei Spalten");
const zeilen: Array<[string, (k: Kennzahl) => string]> = [
  ["Bogenlaenge des Ruecken (m)", (k) => komma(k.bogenLaenge, 3)],
  ["Huellmass lang × quer (m)", (k) => `${komma(k.huelleLang)} × ${komma(k.huelleQuer)}`],
  ["Kruemmungsradius oben / unten (m)", (k) => `${komma(k.rOben)} / ${komma(k.rUnten)}`],
  ["Breite Wurzel → Ende (mm)", (k) =>
    `${(k.breiteWurzel * 1000).toFixed(0)} → ${(k.breiteEnde * 1000).toFixed(0)}  (${(k.breiteAnteil * 100).toFixed(0)} %)`],
  ["Dicke im Seitenriss k0/k3/k6 (mm)", (k) => k.dicke.map((d) => (d * 1000).toFixed(0)).join(" / ")],
  ["Maulweite offen (m)", (k) => komma(k.maulweite, 3)],
  ["Korbtiefe geschlossen (m)", (k) => komma(k.korbtiefe, 3)],
  ["Loch unten geschlossen (m)", (k) => komma(k.spitzenweiteZu, 3)],
  ["Korb als Rotationskoerper (l)", (k) => k.korb.toFixed(0)],
  ["Sektor genutzt (Halbwinkel, Grenze 36°)", (k) => `${komma(k.sektor, 1)}°  ab r ${komma(k.sektorAb)} m`],
  ["Ueberstand unter r 0,30 m", (k) => `${(k.ueberGroesst * 1000).toFixed(0)} mm auf ${komma(k.ueberLaenge)} m`],
  ["Dreiecke des Schalenkoerpers", (k) => k.dreiecke.toFixed(0)],
];
zeilen.forEach(([name, wert], r) => {
  const yy = Y5 + 42 + r * 18;
  if (r % 2 === 0) {
    svg += `<rect x="46" y="${yy - 13}" width="${BREITE - 92}" height="18" fill="#00000008"/>`;
  }
  text(54, yy, name, 12, F.grau);
  kz.forEach((k, i) => text(560 + i * 380, yy, wert(k), 12, formen[i]!.farbe, i === 1));
});
["HEUTE", "NEU", "VORBILD"].forEach((n, i) =>
  text(560 + i * 380, Y5 + 24, n, 12, formen[i]!.farbe, true)
);

/* --------------------------------------------- Block 6: Deckung und Grenzen */

const Y6 = Y5 + 282;
rahmen(40, Y6, 840, 380, "6 · DECKUNGSGLEICHHEIT ZUM HEUTIGEN STAND — ehrlich");
const flaecheHeute = deckung(
  greiferDreiecke(formen[0]!.f, 1),
  greiferDreiecke(formen[0]!.f, 1)
)[1];
text(
  54,
  Y6 + 40,
  "Schnittmenge durch Vereinigungsmenge der Schattenflaechen, 5-mm-Raster, " +
    `Bezugsflaeche ${komma(flaecheHeute, 3)} m² (offen).`,
  11,
  F.grau
);
text(54, Y6 + 58, "Zum Vergleich: das Paket vom 15.09. (E-069, Zahnwinkel) kam auf 98,5 % offen.", 11, F.grau);
{
  const h1 = greiferDreiecke(formen[0]!.f, 1);
  const h0 = greiferDreiecke(formen[0]!.f, 0);
  const reihen: Array<[string, number, number, string]> = [];
  for (const [name, s] of STUFEN) {
    const f = formNeu(s);
    reihen.push([name, deckung(h1, greiferDreiecke(f, 1))[0], deckung(h0, greiferDreiecke(f, 0))[0], ""]);
  }
  reihen.push([
    "VORBILD-Spalte",
    deckung(h1, greiferDreiecke(formen[2]!.f, 1))[0],
    deckung(h0, greiferDreiecke(formen[2]!.f, 0))[0],
    "",
  ]);
  text(54, Y6 + 84, "Aenderung", 11, F.linie, true);
  text(420, Y6 + 84, "offen", 11, F.linie, true);
  text(540, Y6 + 84, "geschlossen", 11, F.linie, true);
  reihen.forEach(([name, a, b], r) => {
    const yy = Y6 + 104 + r * 20;
    const hervor = name.startsWith("EMPFEHLUNG");
    text(54, yy, name, 12, hervor ? F.neu : F.linie, hervor);
    text(420, yy, `${(a * 100).toFixed(1)} %`, 12, hervor ? F.neu : F.linie, hervor);
    text(540, yy, `${(b * 100).toFixed(1)} %`, 12, hervor ? F.neu : F.linie, hervor);
    const balken = 160 * (1 - a);
    svg +=
      `<rect x="660" y="${yy - 10}" width="160" height="12" fill="#00000010"/>` +
      `<rect x="660" y="${yy - 10}" width="${balken.toFixed(1)}" height="12" fill="${hervor ? F.neu : F.grau}"/>`;
  });
  text(660, Y6 + 96, "Anteil der Silhouette, der sich aendert", 10, F.grau);
  absatz(
    54,
    Y6 + 296,
    `ZUM EINORDNEN: Die Empfehlung aendert ${((1 - deckung(h1, greiferDreiecke(formNeu({ n1: "heute", n2: true, n3: true, n4: true }), 1))[0]) * 100).toFixed(0)} % der offenen Silhouette. Das Paket vom 15.09. ` +
      "(Zahnwinkel 12,15° → 0° und die Verkleidung) aenderte 1,5 % — das ist der Grund, warum die neue " +
      "Spinne aussah wie die alte. N1 ist NICHT in der Empfehlung: Die Foto-Messung gibt ihn nicht her, " +
      `und zusammen mit N2/N3/N4 macht er den Greifer sogar wieder AEHNLICHER (${(deckung(h1, greiferDreiecke(formNeu(ALLE), 1))[0] * 100).toFixed(1)} % statt ${(deckung(h1, greiferDreiecke(formNeu({ n1: "heute", n2: true, n3: true, n4: true }), 1))[0] * 100).toFixed(1)} %).`,
    132,
    11,
    F.linie
  );
}

rahmen(900, Y6, BREITE - 940, 380, "7 · DIE NADELOEHRE — haelt der Entwurf sie?");
{
  const m = kz[1]!;
  const pruef: Array<[string, boolean, string]> = [
    [
      "Drehbolzen und Zylinderauge bleiben",
      true,
      "beide Punkte unveraendert; die Schalenform steht in keiner Zeile der Anlenkung",
    ],
    [
      `Neigung ${komma(w.neigung, 1)}° < 25°`,
      w.neigung < 25,
      "kennwerte() liest nur STEMPEL_AUGE, OBERE_ANBINDUNG, ZYLINDER_AUFNAHME, ZU/OFFEN",
    ],
    [
      `Hebelarm kleinster ${(w.hebelMin * 1000).toFixed(0)} mm > 115`,
      w.hebelMin > 0.115,
      "unveraendert, aus demselben Grund — keine Schranke nachgezogen",
    ],
    [
      `Hebelarm geschlossen ${(w.hebelZu * 1000).toFixed(0)} mm > 200`,
      w.hebelZu > 0.2,
      "unveraendert",
    ],
    [
      `Fuenf Schalen: ${komma(m.sektor, 1)}° von 36° Halbsektor`,
      m.sektor < 36,
      `${(m.ueberGroesst * 1000).toFixed(0)} mm Ueberstand auf ${komma(m.ueberLaenge)} m unter r 0,30 — heute 16 mm auf 0,03 m`,
    ],
    [
      "58 zusammengelegte Netze",
      true,
      "kein neues Teil: Wangen sind Reihen in 06_HAUT, der Kamm ersetzt die Strebe in 06_ZINKEN, die Aufnahme ist eine Formaenderung",
    ],
    [
      `Dreiecke +${(kz[1]!.dreiecke - kz[0]!.dreiecke).toFixed(0)} (+${(((kz[1]!.dreiecke - kz[0]!.dreiecke) / kz[0]!.dreiecke) * 100).toFixed(0)} %)`,
      true,
      "Dreiecke sind erlaubt, Netze nicht",
    ],
  ];
  pruef.forEach(([name, ok, grund], r) => {
    const yy = Y6 + 44 + r * 42;
    text(914, yy, ok ? "haelt" : "HAELT NICHT", 12, ok ? F.gut : F.warn, true);
    text(980, yy, name, 12, F.linie, true);
    absatz(980, yy + 15, grund, 128, 10.5);
  });
  const yy = Y6 + 44 + 7 * 42;
  text(914, yy, "aendert", 12, F.warn, true);
  text(980, yy, "Maulweite, Korbtiefe, Korb — nicht festgehalten", 12, F.linie, true);
  text(
    980,
    yy + 15,
    `Maulweite ${komma(kz[0]!.maulweite)} → ${komma(kz[1]!.maulweite)} m · ` +
      `Korbtiefe ${komma(kz[0]!.korbtiefe)} → ${komma(kz[1]!.korbtiefe)} m · ` +
      `Korb ${kz[0]!.korb.toFixed(0)} → ${kz[1]!.korb.toFixed(0)} l`,
    10.5,
    F.grau
  );
}

/* ------------------------------------------------- Block 8: die Foto-Messung */

const Y8 = Y6 + 394;
rahmen(40, Y8, BREITE - 80, 250, "8 · WAS AM FOTO GEMESSEN IST — jede Zahl eine SCHAETZUNG");
{
  absatz(
    54,
    Y8 + 38,
    "Quelle: docs/f5-vorbild-offen-halle-gross-2026-09-15.png, 2360 × 1640 px, rechte Schale gegen das Hallenfenster. " +
      "16 Punkte am 50-px-Raster abgelesen, Ablesegenauigkeit ±15 px = rund 2 % der Ruecken­laenge. " +
      "Verglichen wird das Stueck der abgelesenen Linie, das sich um 105° dreht — genauso viel wie unser Schalenkoerper.",
    230,
    11
  );
  const zeilen8: Array<[string, string, string]> = [
    [
      "Ist der Ruecken ein Kreis?",
      `Kruemmung je Drittel 1 : ${komma(v.drittel[1] / v.drittel[0])} : ${komma(v.drittel[2] / v.drittel[0])}`,
      "Das obere Drittel ist rund ein Fuenftel flacher — mehr nicht. Unser Kreis (1 : 1 : 1) liegt innerhalb der doppelten Ablesegenauigkeit. DER KNICK, DEN MAN SIEHT, STECKT NICHT IM RUECKEN.",
    ],
    [
      "Wie lang ist der Zahn?",
      `${v.zahnPx.toFixed(0)} px von ${v.koerperPx.toFixed(0)} px = ${(v.zahnAnteil * 100).toFixed(1)} %`,
      "Heute: 250 mm auf 1.385 mm = 18,1 %. Der Zahn hat also schon die richtige LAENGE — was fehlt, ist die sichtbare Aufnahme und ein Schalenende, das breiter ist als er.",
    ],
    [
      "Steht der Zahn offen senkrecht?",
      `nein — ${komma(VORBILD_ZAHNNEIGUNG, 1)}° ± 5° nach innen`,
      "Linke Schale, die Zahnmitte wandert 19 px auf 60 px. WIDERSPRICHT der Ansage vom 13.09. und E-069. Hier NICHT geaendert: der Greifer im Bild steht auf Podesten und muss nicht am Anschlag offen sein. Frage an Patrick.",
    ],
    [
      "Wie breit endet die Schale?",
      "rund 60 % der Wurzel (±10 Prozentpunkte)",
      "Plansicht f5-vorbild-nabe-unten: der Schalenkoerper endet stumpf und breit, der Zahn ist ein schmaleres Stueck darauf. Heute laufen wir auf 30 % aus — eine Nadel.",
    ],
    [
      "Hat das Vorbild Wangen?",
      "ja, durchgehend von der Nabe bis zur Aufnahme",
      "f5-vorbild-geschlossen-beladen: die Ladung liegt ZWISCHEN den Raendern. f5-vorbild-offen-halle: der Hohlraum unter dem Ruecken ist zwischen zwei Wangen aufgespannt. Keine Zahl — ein Befund, aber in allen Aufnahmen derselbe.",
    ],
    [
      "Hat das Vorbild eine Schulter?",
      "nein",
      "Patricks gelber Kringel auf f5-vorbild-aufnahme-patrick liegt genau darauf: durchgehender Schwung. Bei uns faellt der Querschnitt im staerksten Zehntel um das 3,8-fache (E-069, kontur.ts). BLEIBT VORERST: sie haelt das Zylinderauge im Guss (26 statt 60 mm), das ist E-013.",
    ],
  ];
  zeilen8.forEach(([frage, antwort, grund], r) => {
    const yy = Y8 + 88 + (r % 3) * 54;
    const xx = 54 + Math.floor(r / 3) * 840;
    text(xx, yy, frage, 11.5, F.linie, true);
    text(xx + 210, yy, antwort, 11.5, F.vorbild, true);
    absatz(xx, yy + 15, grund, 145, 10);
  });
}

/* ------------------------------------------------------------- Schlusszeile */

text(
  40,
  HOEHE - 26,
  "Gerechnet in tools/fuenfschalen/schalenform-modell.ts · gezeichnet in schalenform-blatt.ts · " +
    "Gegenprobe: die nachgerechnete Bahn trifft feineStationen() aus teile.ts auf 0,001 mm. " +
    "Nichts in src/ ist angefasst.",
  11,
  F.grau
);

writeFileSync(
  "docs/f5-schalenform-2026-09-16.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">${svg}</svg>`
);
console.log(`docs/f5-schalenform-2026-09-16.svg ${BREITE}x${HOEHE}`);
void ALLE;
void KEINE;
void GRAD;
void SCHALEN_ABSCHNITTE;
bericht();
