/**
 * Die Zielform B — die Halbschale, ausgearbeitet.
 *
 * WIE ES DAZU KAM. Das Blatt `schalen-vorbilder-2026-09-16.svg` zeigt acht
 * Bauarten echter Greifer, frei recherchiert und ohne Rücksicht auf unsere
 * Konstruktion. Patrick am 16.09.2026, nachdem er es gesehen hatte: „dann
 * schlage form vor, begründe und überarbeite anschliessend." Vorgeschlagen und
 * angenommen wurde **B, die Halbschale**:
 *
 *   · Sie ist der DOKUMENTIERTE Standard für Schrott — Kinshofer Profil H,
 *     Bateman „Semi-Closed (Standard)", Sennebogen „halboffen bis vollständig
 *     geschlossen". Vollschalen sind für Späne, Glas und Sand; spitze für
 *     Sperrgut und Autowracks.
 *   · Es ist die Bauart der Maschine auf Patricks eigenen Aufnahmen
 *     (Sennebogen MG4.1).
 *
 * WORAN GEMESSEN WIRD: am FÜNFSCHALENGREIFER (`src/fuenfschalen/teile.ts`),
 * nicht an der Sichelkralle. Dort sitzen die Schale, die E-083 zweimal nicht
 * angefasst hat, die 58 Netze aus E-025 und alle drei Wächter.
 *
 * VIER ÄNDERUNGEN, je eine Beschwerde — und keine davon rührt die Mittellinie
 * an. B ändert, wie die Schale AUSSIEHT und wie viel sie hält, nicht welche
 * Bahn die Spitze fährt. Der Scheitel aus E-065 bleibt unberührt; warum, steht
 * im Kasten des Vorbilder-Blattes (Patent DE 31 31 624 A1).
 *
 * HIER WIRD ZUM ERSTEN MAL GERECHNET — und erst hier, nachdem die Form steht.
 * Die Zahlen unten sind Auskunft für Patricks Entscheidung, KEIN Maßstab, an
 * den die Form angepasst wurde. Genau diese Reihenfolge war dreimal falsch
 * herum: erst passend machen, dann sieht alles aus wie vorher.
 *
 * Aufruf:  npx vite-node tools/schale-b.ts
 */
import { writeFileSync } from "node:fs";
import {
  MASS,
  SCHALEN_ABSCHNITTE,
  STEMPEL_AUGE,
  ZU,
  mittellinie,
  schalenHalbbreite,
} from "../src/fuenfschalen/teile";
import { BESEN, SPECS } from "../src/world/scrapItems";

/* ====================================================== Die beiden Formen */

const SCHALEN = MASS.schalen; // 5
const SEKTOR = (2 * Math.PI) / SCHALEN; // 72°
const SEKTOR_HALB_GRAD = 180 / SCHALEN; // 36° — die Wächtergrenze
/** Unterhalb dieses Radius lässt der Sektor-Wächter die Schale in Ruhe. */
const SEKTOR_AB = 0.3;
/** Blechdicke der Haut, wie im Bau. */
const BLECH = 0.045;

/** Die Wölbung der heutigen Haut: (halb² / 2r) — „keine tiefe Rinne". */
const woelbung = (halb: number, r: number): number => (halb * halb) / (2 * Math.max(r, 0.12));

/** B: Wurzel wie heute (400 mm), Saum 60 % davon statt 30 %. */
const B_SAUM_ANTEIL = 0.6;
/** Höhe der durchgehenden Seitenwange, als Anteil der vollen Breite. */
const B_WANGE = 0.45;

/* ========================================================= Die Messungen */

interface Station {
  k: number;
  r: number;
  y: number;
  halbHeute: number;
  halbB: number;
  tiefeHeute: number;
  tiefeB: number;
  spaltHeute: number;
  spaltB: number;
  sektorHeute: number;
  sektorB: number;
  /** Zählt diese Stelle für den Sektor-Wächter (r ≥ 0,3 m)? */
  bewacht: boolean;
}

/**
 * Die lichte Weite zwischen zwei Nachbarschalen an Radius r.
 *
 * Fünf Schalen sitzen 72° auseinander; jede belegt um ihre Mittellinie den
 * Winkel 2·atan(halb/r). Was übrig bleibt, ist der Spalt — als Sehne auf dem
 * Radius r gemessen, denn so fällt ein Teil hindurch.
 */
function spalt(r: number, halb: number): number {
  if (r < 1e-4) return 0;
  const frei = SEKTOR - 2 * Math.atan(halb / r);
  return frei <= 0 ? 0 : 2 * r * Math.sin(frei / 2);
}

const BAHN = mittellinie(ZU);

function stationen(): Station[] {
  const raus: Station[] = [];
  const halbWurzel = schalenHalbbreite(0);
  const halbSaumB = halbWurzel * B_SAUM_ANTEIL;
  for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
    const b = BAHN[k]!;
    const halbHeute = schalenHalbbreite(k);
    const halbB = halbWurzel + (halbSaumB - halbWurzel) * (k / SCHALEN_ABSCHNITTE);
    raus.push({
      k,
      r: b.r,
      y: b.y,
      halbHeute,
      halbB,
      tiefeHeute: woelbung(halbHeute, b.r),
      tiefeB: B_WANGE * 2 * halbB,
      spaltHeute: spalt(b.r, halbHeute),
      spaltB: spalt(b.r, halbB),
      sektorHeute: (Math.atan(halbHeute / Math.max(b.r, 1e-4)) * 180) / Math.PI,
      sektorB: (Math.atan(halbB / Math.max(b.r, 1e-4)) * 180) / Math.PI,
      bewacht: b.r >= SEKTOR_AB,
    });
  }
  return raus;
}

const ST = stationen();
const BEWACHT = ST.filter((s) => s.bewacht);
const maxSektorHeute = Math.max(...BEWACHT.map((s) => s.sektorHeute));
const maxSektorB = Math.max(...BEWACHT.map((s) => s.sektorB));

/*
 * ZWEI STELLEN, ZWEI GANZ VERSCHIEDENE ANTWORTEN — und das ist der Befund
 * dieses Blattes.
 *
 * Die Naht zwischen zwei Nachbarschalen ist KEIN einzelnes Maß. Sie ist oben
 * an der Schulter am weitesten (dort ist der Radius am größten und damit die
 * Teilung) und wird nach unten enger, bis sich die Spitzen treffen.
 *
 *   · An der SCHULTER ändert B so gut wie nichts: Beide Formen sind dort
 *     400 bzw. 373 mm breit, und die Teilung ist über einen Meter. Wer dort
 *     dichtmachen wollte, müsste die Schale am Fuß zwei- bis dreimal so breit
 *     machen — das wäre eine Vollschale, keine Halbschale.
 *   · UNTEN, wo das Material liegt, wirkt die größere Endbreite sehr wohl.
 *     Das ist die Stelle, an der sich „fällt durch" entscheidet.
 *
 * Beides steht auf dem Blatt. Die eine Zahl ohne die andere wäre geschönt.
 */
const SCHULTER = ST.reduce((a, s) => (s.spaltHeute > a.spaltHeute ? s : a), ST[0]!);
/** Die unterste Station, an der überhaupt noch eine Naht offen ist. */
const UNTEN = [...ST].reverse().find((s) => s.spaltHeute > 0.01) ?? ST[0]!;
const untenHeute = UNTEN.spaltHeute;
const untenB = UNTEN.spaltB;

/** Kleinste Kantenlänge eines Teils — daran entscheidet sich der Durchfall. */
function kleinstesMass(spec: { kind: string; dims: number[] }): number {
  const d = spec.dims;
  if (spec.kind === "cyl") return Math.min(2 * d[0]!, d[1]!);
  if (spec.kind === "torus") return 2 * d[1]!;
  if (spec.kind === "wire") return d[0]!;
  return Math.min(...d);
}

const TEILE = [...SPECS, BESEN]
  .map((s) => ({ name: s.name, mass: kleinstesMass(s) }))
  .sort((a, b) => a.mass - b.mass);
const faelltHeute = TEILE.filter((t) => t.mass < untenHeute);
const faelltB = TEILE.filter((t) => t.mass < untenB);
const gerettet = TEILE.filter((t) => t.mass >= untenB && t.mass < untenHeute);
const BESEN_MASS = kleinstesMass(BESEN);

/*
 * Dreiecke. Die Haut wird auf den FEINEN Stützstellen gebaut, in zwei Lagen
 * (außen/innen) mit QUER Feldern quer. Ein Feld sind zwei Dreiecke je Lage,
 * dazu die beiden Seitenschlüsse. B braucht quer mehr Felder, weil der Trog
 * einen Boden UND zwei aufgestellte Wangen hat.
 */
const QUER_HEUTE = 4;
/** Acht Felder quer statt vier — nötig, um den aufgestellten Rand zu zeigen. */
const QUER_B = 8;
/**
 * NICHT gerechnet, sondern am gebauten Stand GEMESSEN.
 *
 * Die Schale ist am 16.09.2026 wirklich umgebaut worden (Trog mit
 * aufgestelltem Rand, acht Felder quer); `test/verschmelzen.test.ts` meldete
 * danach 16.524 Dreiecke statt 15.004 und unverändert 58 Netze. Die Formel aus
 * Feldern und Stationen sagt 1.440 vorher — die zwei Zahlen gehen um 80
 * auseinander, weil das Verschmelzen Stirnkappen zusammenzieht. Hier steht die
 * gemessene, nicht die gerechnete.
 *
 * Der Umbau ist danach zurückgenommen worden; warum, steht im Feld 6.
 */
const NETZE_HEUTE = 58;
const DREIECKE_HEUTE = 15004;
const DREIECKE_B = 16524;
const TRI_MEHR = DREIECKE_B - DREIECKE_HEUTE;

/* ============================================================ Das Blatt */

const BREITE = 2260;
const HOEHE = 2900;
const PX = 300; // px je Meter im Riss
const PX_Q = 700; // px je Meter im Querschnitt
const PX_K = 300; // px je Meter im Kranz

const F = {
  papier: "#f5f3ef",
  feld: "#ffffff",
  linie: "#161a1d",
  stahl: "#2f3a42",
  fuell: "#dfe4e7",
  fuellTief: "#c3ccd2",
  grau: "#6d757a",
  hilfe: "#a8b0b5",
  rot: "#9c2717",
  gruen: "#1d6f34",
  blau: "#1f5d86",
  band: "#e7e2da",
};

const teile: string[] = [];
const z = (s: string): void => {
  teile.push(s);
};
const r2 = (v: number): number => Math.round(v * 100) / 100;
const esc = (s: unknown): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const zahl = (v: number, n = 1): string => v.toFixed(n).replace(".", ",");

function text(x: number, y: number, s: unknown, g = 20, farbe = F.linie, anker = "start", fett = false): void {
  z(
    `<text x="${r2(x)}" y="${r2(y)}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" ` +
      `font-size="${g}" fill="${farbe}" text-anchor="${anker}"` +
      (fett ? ' font-weight="600"' : "") +
      `>${esc(s)}</text>`
  );
}
function linie(x1: number, y1: number, x2: number, y2: number, farbe = F.linie, w = 1.6, strich?: string): void {
  z(
    `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${farbe}" stroke-width="${w}"` +
      (strich ? ` stroke-dasharray="${strich}"` : "") +
      ` stroke-linecap="round"/>`
  );
}
function kreis(x: number, y: number, rad: number, fuell = "none", farbe = F.linie, w = 1.6): void {
  z(`<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(rad)}" fill="${fuell}" stroke="${farbe}" stroke-width="${w}"/>`);
}
function pfad(d: string, fuell = "none", farbe = F.linie, w = 1.8, strich?: string): void {
  z(
    `<path d="${d}" fill="${fuell}" stroke="${farbe}" stroke-width="${w}" stroke-linejoin="round" ` +
      `stroke-linecap="round"${strich ? ` stroke-dasharray="${strich}"` : ""}/>`
  );
}
function poly(pts: number[][], zu = true): string {
  let d = `M ${r2(pts[0]![0]!)} ${r2(pts[0]![1]!)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${r2(pts[i]![0]!)} ${r2(pts[i]![1]!)}`;
  return d + (zu ? " Z" : "");
}
function glatt(pts: number[][], zu = false): string {
  let d = `M ${r2(pts[0]![0]!)} ${r2(pts[0]![1]!)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d +=
      ` C ${r2(p1[0]! + (p2[0]! - p0[0]!) / 6)} ${r2(p1[1]! + (p2[1]! - p0[1]!) / 6)}` +
      ` ${r2(p2[0]! - (p3[0]! - p1[0]!) / 6)} ${r2(p2[1]! - (p3[1]! - p1[1]!) / 6)}` +
      ` ${r2(p2[0]!)} ${r2(p2[1]!)}`;
  }
  return d + (zu ? " Z" : "");
}
function feld(x: number, y: number, w: number, h: number, titel: string): void {
  z(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${F.feld}" stroke="${F.band}" stroke-width="2" rx="8"/>`);
  text(x + 20, y + 32, titel, 22, F.linie, "start", true);
  linie(x + 20, y + 42, x + w - 20, y + 42, F.band, 2);
}

z(`<rect x="0" y="0" width="${BREITE}" height="${HOEHE}" fill="${F.papier}"/>`);

text(32, 56, "Die Zielform: B — die Halbschale", 42, F.linie, "start", true);
text(
  32,
  90,
  "Ausgewählt aus dem Blatt der acht Bauarten. Der dokumentierte Standard für Schrott: Kinshofer Profil H, Bateman „Semi-Closed (Standard)“, Sennebogen „halboffen bis vollständig geschlossen“ — und die Bauart auf Patricks eigenen Aufnahmen (Sennebogen MG4.1).",
  19,
  F.grau
);
text(
  32,
  116,
  "Gemessen am Fünfschalengreifer (src/fuenfschalen/teile.ts) — dort sitzt die Schale aus E-083, dort gelten die 58 Netze und die drei Wächter. Die MITTELLINIE bleibt Punkt für Punkt dieselbe; B ändert nur den Querschnitt, die Breite und die Wangen.",
  19,
  F.grau
);

/* ------------------------------- Zeile 1: Seitenriss, heute und B nebeneinander */

const Z1 = { y: 140, h: 720 };
feld(32, Z1.y, BREITE - 64, Z1.h, "1 · Der Seitenriss — heute und B, gleicher Maßstab, gleiche Mittellinie");

const rissY = Z1.y + 130;
const px = (r: number, x0: number): number => x0 + (r - STEMPEL_AUGE.r) * PX;
const py = (y: number): number => rissY + (STEMPEL_AUGE.y - y) * PX;

/** Seitenriss: die Mittellinie, beidseits um die halbe Bautiefe aufgedickt. */
function riss(x0: number, tiefe: (s: Station) => number, farbe: string, wangen: boolean): void {
  const mitte = ST.map((s) => [px(s.r, x0), py(s.y)]);
  const n = mitte.map((_, k) => {
    const a = mitte[Math.max(0, k - 1)]!;
    const b = mitte[Math.min(mitte.length - 1, k + 1)]!;
    const dx = b[0]! - a[0]!;
    const dy = b[1]! - a[1]!;
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const innen = mitte.map((p) => [p[0]!, p[1]!]);
  const aussen = mitte.map((p, k) => [
    p[0]! + n[k]![0]! * tiefe(ST[k]!) * PX,
    p[1]! + n[k]![1]! * tiefe(ST[k]!) * PX,
  ]);
  pfad(
    glatt(innen) + " L " + aussen.slice().reverse().map((p) => `${r2(p[0]!)} ${r2(p[1]!)}`).join(" L ") + " Z",
    F.fuell,
    farbe,
    2.6
  );
  pfad(glatt(innen), "none", F.linie, 2.8);
  if (wangen) {
    // Die durchgehende Wange steht über die Innenfläche hinaus — im Seitenriss
    // als eigene Kante sichtbar. Das ist die Silhouette, die heute fehlt.
    pfad(
      glatt(
        mitte.map((p, k) => [p[0]! - n[k]![0]! * B_WANGE * 2 * ST[k]!.halbB * PX * 0.42, p[1]! - n[k]![1]! * B_WANGE * 2 * ST[k]!.halbB * PX * 0.42])
      ),
      "none",
      F.blau,
      2.6,
      "9 5"
    );
    // Verstärkter Rücken über die ersten zwei Drittel.
    pfad(glatt(aussen.slice(0, 5)), "none", F.stahl, 7);
    // Verschleißstreifen auf der Innenfläche.
    pfad(glatt(innen.map((p, k) => [p[0]! + n[k]![0]! * 6, p[1]! + n[k]![1]! * 6])), "none", F.gruen, 2.6);
    // Die angeschweißte Spitze am Absatz.
    const l = mitte[mitte.length - 1]!;
    const v = n[n.length - 1]!;
    const t = tiefe(ST[ST.length - 1]!) * PX;
    const ux = v[1]!;
    const uy = -v[0]!;
    pfad(
      poly([
        [l[0]!, l[1]!],
        [l[0]! + v[0]! * t, l[1]! + v[1]! * t],
        [l[0]! + v[0]! * t * 0.35 + ux * 46, l[1]! + v[1]! * t * 0.35 + uy * 46],
        [l[0]! + ux * 46, l[1]! + uy * 46],
      ]),
      F.fuellTief,
      F.rot,
      2.6
    );
    linie(l[0]!, l[1]!, l[0]! + v[0]! * t, l[1]! + v[1]! * t, F.rot, 3.5);
    text(l[0]! + ux * 66, l[1]! + uy * 66 + 8, "Absatz: hier sitzt", 16, F.rot);
    text(l[0]! + ux * 66, l[1]! + uy * 66 + 30, "die Verschleißspitze", 16, F.rot);
  }
  // Der Drehbolzen.
  const bx = px(STEMPEL_AUGE.r, x0);
  const by = py(STEMPEL_AUGE.y);
  kreis(bx, by, 14, F.feld, F.linie, 2.4);
  kreis(bx, by, 5, F.linie, F.linie, 1);
  // Die Achse.
  const achse = px(0, x0);
  linie(achse, by - 40, achse, py(ST[ST.length - 1]!.y) + 40, F.hilfe, 1.4, "6 6");
}

text(300, Z1.y + 82, "heute", 24, F.stahl, "middle", true);
text(300, Z1.y + 106, "Blech mit flacher Wölbung, keine Wangen", 17, F.grau, "middle");
riss(300, (s) => Math.max(s.tiefeHeute, BLECH), F.stahl, false);

text(760, Z1.y + 82, "B — Halbschale", 24, F.blau, "middle", true);
text(760, Z1.y + 106, "Trog mit durchgehenden Wangen", 17, F.blau, "middle");
riss(760, (s) => s.tiefeB, F.blau, true);

text(300, py(ST[ST.length - 1]!.y) + 74, `Wölbung an der Wurzel nur ${zahl(ST[0]!.tiefeHeute * 1000, 0)} mm`, 17, F.grau, "middle");
text(760, py(ST[ST.length - 1]!.y) + 74, `Trogtiefe an der Wurzel ${zahl(ST[0]!.tiefeB * 1000, 0)} mm`, 17, F.blau, "middle");

/* Die vier Änderungen. */
const tx = 1180;
const AEND: string[][] = [
  ["Seitenwangen", "keine", "durchgehend", "„sieht aus wie die alte Spinne“"],
  ["Querschnitt", `flache Wölbung, ${zahl(ST[0]!.tiefeHeute * 1000, 0)} mm`, `Trog, ${zahl(ST[0]!.tiefeB * 1000, 0)} mm`, "„der Kopf ist zu schlank“"],
  [
    "Breite am Saum",
    `${zahl((schalenHalbbreite(SCHALEN_ABSCHNITTE) / schalenHalbbreite(0)) * 100, 0)} % der Wurzel`,
    `${zahl(B_SAUM_ANTEIL * 100, 0)} % der Wurzel`,
    "die Nadel am Ende",
  ],
  ["Lücke am Drehbolzen", "Loch im Blech", "Absicht, mit Zweck", "„da wo die Bolzen durchkommen“"],
];
text(tx, Z1.y + 82, "Die vier Änderungen", 24, F.linie, "start", true);
text(tx, Z1.y + 118, "was", 17, F.grau, "start", true);
text(tx + 240, Z1.y + 118, "heute", 17, F.grau, "start", true);
text(tx + 520, Z1.y + 118, "B", 17, F.blau, "start", true);
text(tx + 760, Z1.y + 118, "beantwortet", 17, F.grau, "start", true);
linie(tx, Z1.y + 128, BREITE - 64, Z1.y + 128, F.band, 2);
AEND.forEach((a, k) => {
  const yy = Z1.y + 160 + k * 36;
  text(tx, yy, a[0]!, 18, F.linie, "start", true);
  text(tx + 240, yy, a[1]!, 18, F.grau);
  text(tx + 520, yy, a[2]!, 18, F.blau, "start", true);
  text(tx + 760, yy, a[3]!, 18, F.grau);
});

text(tx, Z1.y + 340, "Der Absatz am Zinkensitz wird vom Fehler zum Merkmal.", 20, F.rot, "start", true);
[
  "Dort sitzt die angeschweißte Verschleißspitze. Bateman zur B5T:",
  "„thicker backs, wear strips & replaceable weld-on tine tips“ —",
  "verstärkter Rücken, Verschleißstreifen, Wechselspitze. Drei Teile,",
  "die wir bisher als eines gezeichnet haben.",
].forEach((zl, k) => text(tx, Z1.y + 372 + k * 25, zl, 18, F.grau));

text(tx, Z1.y + 500, "Was ausdrücklich NICHT anders wird", 20, F.linie, "start", true);
[
  "Die Mittellinie bleibt Punkt für Punkt dieselbe — damit auch die",
  "Bahn der Spitze und der Scheitel aus E-065 (25,2 cm). Wer den",
  "weghaben will, muss an die Anlenkung, nicht an die Schale. Das",
  "Patent DE 31 31 624 A1 löst ihn über eine zweite Bewegung des",
  "ganzen Greifers, nicht über eine andere Schalenform.",
].forEach((zl, k) => text(tx, Z1.y + 532 + k * 25, zl, 18, F.grau));

/* ------------------------------- Zeile 2: Von vorn und Querschnitte */

const Z2 = { y: 888, h: 540 };
feld(32, Z2.y, BREITE - 64, Z2.h, "2 · Von vorn und im Schnitt — wo das Material hinkommt");

function vorn(x0: number, halb: (s: Station) => number, farbe: string, wangen: boolean, marke: string): void {
  const yTop = Z2.y + 108;
  const H = 300;
  const links: number[][] = [];
  const rechts: number[][] = [];
  ST.forEach((s, k) => {
    const yy = yTop + (H * k) / SCHALEN_ABSCHNITTE;
    links.push([x0 - halb(s) * PX, yy]);
    rechts.push([x0 + halb(s) * PX, yy]);
  });
  pfad(poly([...links, ...rechts.slice().reverse()]), F.fuell, farbe, 2.6);
  if (wangen) {
    pfad(poly(links.map(([x, y]) => [x! + BLECH * PX, y!]), false), "none", F.blau, 2.2, "8 5");
    pfad(poly(rechts.map(([x, y]) => [x! - BLECH * PX, y!]), false), "none", F.blau, 2.2, "8 5");
    text(x0, yTop + H + 32, "durchgehende Wange bis zum Saum", 17, F.blau, "middle");
  } else {
    text(x0, yTop + H + 32, "keine Wange — nur die gewölbte Haut", 17, F.grau, "middle");
  }
  text(x0, Z2.y + 82, marke, 22, farbe, "middle", true);
  text(
    x0,
    yTop + H + 58,
    `Wurzel ${zahl(2 * halb(ST[0]!) * 1000, 0)} mm → Saum ${zahl(2 * halb(ST[SCHALEN_ABSCHNITTE]!) * 1000, 0)} mm`,
    18,
    F.linie,
    "middle",
    true
  );
}

vorn(300, (s) => s.halbHeute, F.stahl, false, "heute");
vorn(720, (s) => s.halbB, F.blau, true, "B");

const QSTELLEN = [0, 3, 6];
QSTELLEN.forEach((k, i) => {
  const cx = 1180 + i * 330;
  const s = ST[k]!;
  const yH = Z2.y + 150;
  const yB = Z2.y + 330;

  // heute: gewölbte Haut, Dicke BLECH
  const bh = s.halbHeute * PX_Q;
  const wh = s.tiefeHeute * PX_Q;
  const bogen = (yy: number, halb: number, tief: number, dick: number): string => {
    const pts: number[][] = [];
    for (let j = 0; j <= 12; j++) {
      const t = -1 + (2 * j) / 12;
      pts.push([cx + t * halb, yy - (1 - t * t) * tief]);
    }
    const zurueck = pts.slice().reverse().map((p) => [p[0]!, p[1]! + dick]);
    return poly([...pts, ...zurueck]);
  };
  pfad(bogen(yH, bh, wh, BLECH * PX_Q), F.fuell, F.stahl, 2.6);

  // B: Trog mit aufgestellten Wangen
  const bb = s.halbB * PX_Q;
  const hh = s.tiefeB * PX_Q;
  const bl = BLECH * PX_Q;
  pfad(
    poly([
      [cx - bb, yB - hh],
      [cx - bb, yB + bl],
      [cx + bb, yB + bl],
      [cx + bb, yB - hh],
      [cx + bb - bl, yB - hh],
      [cx + bb - bl, yB],
      [cx - bb + bl, yB],
      [cx - bb + bl, yB - hh],
    ]),
    F.fuell,
    F.blau,
    3
  );
  text(cx, Z2.y + 82, `Station ${k}`, 18, F.grau, "middle", true);
  text(cx, yH + 46, `${zahl(2 * s.halbHeute * 1000, 0)} mm breit, ${zahl(s.tiefeHeute * 1000, 0)} mm tief`, 16, F.grau, "middle");
  text(cx, yB + 46, `${zahl(2 * s.halbB * 1000, 0)} mm breit, ${zahl(s.tiefeB * 1000, 0)} mm tief`, 16, F.blau, "middle");
});
text(1100, Z2.y + 150, "heute", 19, F.stahl, "end", true);
text(1100, Z2.y + 330, "B", 19, F.blau, "end", true);
text(1180, Z2.y + Z2.h - 22, `Querschnitte im doppelten Maßstab der Risse (1 m = ${PX_Q} px), damit man die ${zahl(BLECH * 1000, 0)} mm Blech sieht.`, 16, F.grau);

/* ------------------------------- Zeile 3: Bolzenaufnahme + Kranz */

const Z3 = { y: 1456, h: 460 };
feld(32, Z3.y, 1080, Z3.h, "3 · Die Bolzenaufnahme — und die Lücke, die Absicht ist");

{
  const cx = 320;
  const cy = Z3.y + 250;
  const R = 34;
  z(`<rect x="${cx - 256}" y="${cy - 84}" width="104" height="168" fill="${F.band}" stroke="${F.blau}" stroke-width="2.4" stroke-dasharray="8 6" rx="6"/>`);
  text(cx - 204, cy - 100, "Mitteltraverse", 17, F.blau, "middle");
  pfad(
    glatt(
      [
        [cx + 250, cy + 190],
        [cx + 120, cy + 110],
        [cx + 30, cy + 52],
        [cx - 58, cy + 20],
        [cx - 76, cy - 40],
        [cx - 26, cy - 78],
        [cx + 54, cy - 44],
        [cx + 152, cy + 70],
        [cx + 278, cy + 166],
      ],
      true
    ),
    F.fuell,
    F.stahl,
    2.6
  );
  kreis(cx, cy, R + 22, F.feld, F.linie, 2.6);
  kreis(cx, cy, R, F.papier, F.linie, 2.6);
  text(cx + R + 34, cy - 16, "Kragen ums Loch", 17, F.grau);
  text(cx + 160, cy + 154, "die Wangen SELBST bilden das Auge", 17, F.grau, "middle");
  linie(cx - R - 14, cy + 38, cx - R - 40, cy + 60, F.linie, 3.5);
  kreis(cx - R - 45, cy + 65, 6, F.feld, F.linie, 2.4);
  text(cx - R - 54, cy + 84, "Schmiernippel", 15, F.grau, "end");
  kreis(cx - 82, cy - 106, 17, F.feld, F.blau, 2.6);
  kreis(cx - 82, cy - 106, 7, F.blau, F.blau, 1);
  linie(cx, cy, cx - 82, cy - 106, F.blau, 1.8, "5 5");
  text(cx - 62, cy - 118, "2. Auge (Lasche)", 16, F.blau);
  const x1 = cx - 152;
  const x2 = cx - 68;
  const yy = cy + 32;
  linie(x1, yy, x2, yy, F.rot, 3);
  linie(x1, yy - 9, x1, yy + 9, F.rot, 3);
  linie(x2, yy - 9, x2, yy + 9, F.rot, 3);
  text((x1 + x2) / 2, yy + 26, "Spalt", 17, F.rot, "middle", true);
  for (let k = 0; k < 3; k++) kreis(x1 + 34 + k * 7, yy + 46 + k * 20, 4, F.rot, F.rot, 1);
  text(x1 + 4, yy + 122, "Kleinmaterial fällt hier durch", 17, F.rot);
}
{
  const tx2 = 640;
  text(tx2, Z3.y + 90, "Warum die Lücke bleibt", 21, F.linie, "start", true);
  [
    "Sennebogen zur MG4.1: Die Anbindung der",
    "Greiferschalen an den Mittelbalken lässt am",
    "Schalendrehpunkt genügend Platz, damit Klein-",
    "material durchfallen kann.",
    "",
    "Die Stelle, auf die Patrick seit zwei Tagen",
    "zeigt, hat also einen Zweck. Sie wird nicht",
    "zugemacht, sondern als das gezeichnet, was sie",
    "ist: eine Aufnahme aus Kragen, Buchse und Auge",
    "mit gewolltem Abstand zur Traverse — statt",
    "eines Lochs in einem Blech.",
  ].forEach((zl, k) => text(tx2, Z3.y + 124 + k * 25, zl, 18, F.grau));
}

feld(1144, Z3.y, BREITE - 32 - 1144, Z3.h, "4 · Fünf im Kreis, geschlossen — was zwischen zwei Schalen bleibt");

function kranz(cx: number, cy: number, s: Station, halb: number, sp: number, farbe: string, marke: string): void {
  const R = s.r * PX_K;
  z(`<circle cx="${cx}" cy="${cy}" r="${r2(R)}" fill="none" stroke="${F.hilfe}" stroke-width="1.4" stroke-dasharray="5 6"/>`);
  const ha = Math.atan(halb / s.r);
  for (let i = 0; i < SCHALEN; i++) {
    const m = -Math.PI / 2 + (i * 2 * Math.PI) / SCHALEN;
    const p = (a: number, rr: number): number[] => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    pfad(poly([p(m - ha, R + 12), p(m + ha, R + 12), p(m + ha, R - 12), p(m - ha, R - 12)]), F.fuell, farbe, 2.4);
  }
  const a1 = -Math.PI / 2 + ha;
  const a2 = -Math.PI / 2 + (2 * Math.PI) / SCHALEN - ha;
  const q1 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R];
  const q2 = [cx + Math.cos(a2) * R, cy + Math.sin(a2) * R];
  linie(q1[0]!, q1[1]!, q2[0]!, q2[1]!, F.rot, 4);
  text((q1[0]! + q2[0]!) / 2 + 30, (q1[1]! + q2[1]!) / 2 - 16, `${zahl(sp * 100, 0)} cm`, 21, F.rot, "start", true);
  kreis(cx, cy, 5, F.feld, F.hilfe, 1.6);
  text(cx, cy + R + 54, marke, 21, farbe, "middle", true);
  text(cx, cy + R + 78, `Station ${s.k} — die unterste offene Naht`, 16, F.grau, "middle");
}

kranz(1360, Z3.y + 220, UNTEN, UNTEN.halbHeute, UNTEN.spaltHeute, F.stahl, "heute");
kranz(1820, Z3.y + 220, UNTEN, UNTEN.halbB, UNTEN.spaltB, F.blau, "B");
text(BREITE - 52, Z3.y + 392, "Gezeichnet ist die UNTERSTE Station mit offener Naht — dort, wo das Material liegt.", 17, F.grau, "end");
text(BREITE - 52, Z3.y + 416, "Weiter oben an der Schulter stehen beide über 70 cm offen; siehe Feld 5.", 17, F.grau, "end");

/* ------------------------------------------------- Zeile 4: Die Zahlen */

const Z4 = { y: 1944, h: 872 };

feld(32, Z4.y, 1080, Z4.h, "5 · Was durchfällt — der Preis der Halbschale, in Zentimetern");

text(52, Z4.y + 76, "Die Naht ist kein einzelnes Maß — sie ist oben weit und unten eng:", 19, F.linie, "start", true);

/* Das Nahtprofil über die Höhe: die eine Grafik, die den Befund trägt. */
{
  const gx = 62;
  const gy = Z4.y + 100;
  const gw = 420;
  const gh = 180;
  const maxG = Math.max(...ST.map((s) => s.spaltHeute));
  z(`<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="${F.papier}" stroke="${F.band}" stroke-width="1.6"/>`);
  const X = (sp: number): number => gx + (sp / maxG) * gw;
  const Y = (k: number): number => gy + (gh * k) / SCHALEN_ABSCHNITTE;
  pfad(poly(ST.map((s) => [X(s.spaltHeute), Y(s.k)]), false), "none", F.stahl, 3);
  pfad(poly(ST.map((s) => [X(s.spaltB), Y(s.k)]), false), "none", F.blau, 3);
  ST.forEach((s) => {
    kreis(X(s.spaltHeute), Y(s.k), 3.5, F.stahl, F.stahl, 1);
    kreis(X(s.spaltB), Y(s.k), 3.5, F.blau, F.blau, 1);
  });
  text(gx, gy - 8, "Schulter", 15, F.grau);
  text(gx, gy + gh + 18, "Spitze", 15, F.grau);
  text(gx + gw, gy - 8, `${zahl(maxG * 100, 0)} cm`, 15, F.grau, "end");
  text(X(ST[2]!.spaltHeute) + 12, Y(2) + 5, "heute", 16, F.stahl, "start", true);
  text(X(ST[4]!.spaltB) - 12, Y(4) + 5, "B", 16, F.blau, "end", true);
  // Die beiden Stellen, die zählen.
  linie(gx, Y(SCHULTER.k), gx + gw, Y(SCHULTER.k), F.hilfe, 1.4, "4 5");
  linie(gx, Y(UNTEN.k), gx + gw, Y(UNTEN.k), F.rot, 1.6, "4 5");
}

const rx = 520;
text(rx, Z4.y + 118, "Oben, an der Schulter", 19, F.linie, "start", true);
text(rx, Z4.y + 148, `heute ${zahl(SCHULTER.spaltHeute * 100)} cm  →  B ${zahl(SCHULTER.spaltB * 100)} cm`, 20, F.grau, "start", true);
[
  "Dort ändert B so gut wie nichts: beide sind am Fuß",
  "gleich breit, und die Teilung ist über einen Meter.",
  "Wer DA dichtmachen will, braucht eine Schale, die",
  "zwei- bis dreimal so breit ist — das wäre A, die",
  "Vollschale, und die ist für Späne und Sand gebaut.",
].forEach((zl, k) => text(rx, Z4.y + 178 + k * 24, zl, 17, F.grau));

text(rx, Z4.y + 322, "Unten, wo das Material liegt", 19, F.rot, "start", true);
text(rx, Z4.y + 352, `heute ${zahl(untenHeute * 100)} cm  →  B ${zahl(untenB * 100)} cm`, 22, F.rot, "start", true);
text(rx, Z4.y + 378, `${zahl((untenHeute - untenB) * 100)} cm enger — hier wirkt die breitere Endbreite.`, 17, F.gruen, "start", true);

text(52, Z4.y + 330, "Ein Teil fällt hindurch, wenn seine KLEINSTE Kante", 18, F.grau);
text(52, Z4.y + 354, `unter dem Maß UNTEN liegt: heute ${faelltHeute.length} von ${TEILE.length}`, 18, F.grau);
text(52, Z4.y + 378, `Gegenständen des Platzes, bei B noch ${faelltB.length}.`, 18, F.grau);

text(52, Z4.y + 418, `Was B zusätzlich hält (${gerettet.length}):`, 19, gerettet.length ? F.gruen : F.rot, "start", true);
if (gerettet.length === 0) {
  text(52, Z4.y + 446, "— keines.", 18, F.rot);
} else {
  gerettet.slice(0, 9).forEach((t, k) => {
    text(
      52 + (k % 3) * 340,
      Z4.y + 446 + Math.floor(k / 3) * 24,
      `· ${t.name} (${zahl(t.mass * 100, 0)} cm)`,
      17,
      F.gruen
    );
  });
  if (gerettet.length > 9) {
    text(52, Z4.y + 446 + 3 * 24, `… und ${gerettet.length - 9} weitere zwischen ${zahl(untenB * 100)} und ${zahl(untenHeute * 100)} cm`, 17, F.gruen);
  }
}

text(
  52,
  Z4.y + 572,
  `Der Besen (${zahl(BESEN_MASS * 100, 0)} cm kleinste Kante) wird von beiden gehalten. Das kleinste Teil des Platzes (${TEILE[0]!.name}, ${zahl(TEILE[0]!.mass * 100, 0)} cm) fällt bei beiden durch.`,
  18,
  F.grau
);
text(52, Z4.y + 604, "Eine Halbschale SOLL nicht ganz schließen — das ist ihr Zweck, nicht ihr Fehler.", 18, F.rot, "start", true);
text(52, Z4.y + 630, "Was davon erträglich ist, entscheidet nur das Gerät.", 18, F.rot);

feld(1144, Z4.y, BREITE - 32 - 1144, Z4.h, "6 · Gebaut, gemessen, zurückgenommen — was im Weg steht");

[
  "Alle vier Änderungen sind am 16.09.2026 gebaut und gemessen",
  "worden. Drei davon reißen je einen bestehenden Wächter, und",
  "zwar nicht knapp:",
  "",
  "· TROG MIT AUFGESTELLTEM RAND (Änderung 1 + 2). Die drei",
  "  Schranken in test/schalenform.test.ts messen den SCHATTEN-",
  "  RISS und verlangen, dass er vom Bolzen an nur dünner wird.",
  "  Ein aufgestellter Rand macht ihn im ersten Drittel dicker —",
  "  das ist ja gerade der Sinn. Gemessen: bei 80 mm Rand reißt",
  "  die Ferse an drei Stellen, bei 60 mm an einer, bei 48 mm",
  "  reißt die andere Schranke. Ohne Rand: grün. Es gibt keine",
  "  Randhöhe, die alle drei hält.",
  "",
  "· SAUM AUF 60 % (Änderung 3). Der Wächter aus E-069 verlangt,",
  "  dass die Außenkontur ohne Knick über den Zahnsitz läuft",
  "  (Grenze 4°) — er steht auf Patricks eigenem Vorbildfoto.",
  "  Ein breiter Saum mit schmalem Zahn macht dort 9,68°. Das",
  "  ist genau der Absatz, den wir zeigen wollen.",
  "",
  "Das ist der Grund, warum jeder Anlauf wieder aussah wie vorher:",
  "Nicht der Entwurf war zu zaghaft — die Wächter halten die",
  "Schale flach. Welcher von ihnen weichen darf, ist Patricks",
  "Entscheidung, nicht meine. Der Spielcode ist unverändert.",
].forEach((zl, k) => text(1164, Z4.y + 82 + k * 22, zl, 16, k < 3 ? F.linie : F.grau));

text(1164, Z4.y + 624, "Was es gekostet HÄTTE — am gebauten Stand gemessen", 19, F.linie, "start", true);
const KOST: string[][] = [
  ["", "heute", "B"],
  ["Dreiecke am ganzen Greifer", String(DREIECKE_HEUTE), String(DREIECKE_B)],
  ["Netze am ganzen Greifer", String(NETZE_HEUTE), String(NETZE_HEUTE)],
  ["Nettokorb (l)", "1.525", "1.510"],
  [`Sektor je Schale (Grenze ${SEKTOR_HALB_GRAD}°)`, `${zahl(maxSektorHeute)}°`, `${zahl(maxSektorB)}°`],
];
KOST.forEach((zeile, k) => {
  const yy = Z4.y + 656 + k * 26;
  text(1164, yy, zeile[0]!, 17, k === 0 ? F.grau : F.linie, "start", k === 0);
  text(1830, yy, zeile[1]!, 17, F.stahl, "end", k > 0);
  text(2000, yy, zeile[2]!, 17, F.blau, "end", k > 0);
});
text(
  1164,
  Z4.y + 800,
  `Netze bleiben bei ${NETZE_HEUTE} — der Trog ist dieselbe eine Haut. Neigung und Hebelarm bleiben unberührt: B fasst weder Drehbolzen noch Laschenauge an.`,
  17,
  F.grau
);

/* --------------------------------------------------------------- Fuß */

linie(32, HOEHE - 72, BREITE - 32, HOEHE - 72, F.band, 2);
text(
  32,
  HOEHE - 46,
  "Gezeichnet mit tools/schale-b.ts. Mittellinie, Stationen und die heutigen Breiten sind nicht nachempfunden, sondern aus src/fuenfschalen/teile.ts gerechnet (mittellinie, schalenHalbbreite) — was hier steht, steht so im Modell. Kein Spielcode geändert.",
  17,
  F.grau
);
text(
  32,
  HOEHE - 22,
  "Quellen als Text: Kinshofer Profil H · Bateman B5T „Semi-Closed (Standard)“, verstärkte Rücken, Verschleißstreifen, angeschweißte Wechselspitzen · Sennebogen MG4.1, Hardox-Schweißkonstruktion und der gewollte Platz am Schalendrehpunkt · Patent DE 31 31 624 A1 zur Bahn der Schneide.",
  17,
  F.grau
);

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" viewBox="0 0 ${BREITE} ${HOEHE}">` +
  teile.join("") +
  `</svg>\n`;
writeFileSync("docs/schale-b-2026-09-16.svg", svg, "utf8");

console.log(`geschrieben: docs/schale-b-2026-09-16.svg (${(svg.length / 1024).toFixed(0)} kB, ${BREITE}x${HOEHE})`);
console.log("\nk\tr\ty\tbreit heute\ttief heute\tbreit B\ttief B\tSpalt heute\tSpalt B\tSekt heute\tSekt B\tbewacht");
for (const s of ST) {
  console.log(
    `${s.k}\t${s.r.toFixed(3)}\t${s.y.toFixed(3)}\t${(2 * s.halbHeute).toFixed(3)}\t\t${s.tiefeHeute.toFixed(4)}\t\t${(2 * s.halbB).toFixed(3)}\t${s.tiefeB.toFixed(3)}\t${s.spaltHeute.toFixed(3)}\t\t${s.spaltB.toFixed(3)}\t\t${s.sektorHeute.toFixed(1)}\t\t${s.sektorB.toFixed(1)}\t${s.bewacht}`
  );
}
console.log(
  `\nSchulter (Station ${SCHULTER.k}): heute ${(SCHULTER.spaltHeute * 100).toFixed(1)} cm, B ${(SCHULTER.spaltB * 100).toFixed(1)} cm` +
    `\nunterste offene Naht (Station ${UNTEN.k}): heute ${(untenHeute * 100).toFixed(1)} cm, B ${(untenB * 100).toFixed(1)} cm`
);
console.log(`Sektor max: heute ${maxSektorHeute.toFixed(1)}, B ${maxSektorB.toFixed(1)} (Grenze ${SEKTOR_HALB_GRAD})`);
console.log(`Felder quer je Schale: heute ${QUER_HEUTE}, B ${QUER_B}; alle fuenf +${TRI_MEHR} Dreiecke; Greifer ${DREIECKE_HEUTE} -> ${DREIECKE_HEUTE + TRI_MEHR}`);
console.log(`Teile ${TEILE.length}: faellt heute durch ${faelltHeute.length}, bei B ${faelltB.length}`);
console.log(`zusaetzlich gehalten: ${gerettet.map((t) => `${t.name} ${(t.mass * 100).toFixed(0)}cm`).join(", ") || "(keines)"}`);
console.log(`kleinstes Teil ${TEILE[0]!.name} ${(TEILE[0]!.mass * 100).toFixed(0)} cm; Besen ${(BESEN_MASS * 100).toFixed(0)} cm`);
