/**
 * Schalen-Vorbilder — acht Bauarten echter Greiferschalen, frei gezeichnet.
 *
 * WARUM ES DIESES BLATT GIBT. Patrick am 16.09.2026: „Die Schalenform — der
 * Agent bekommt das nicht so richtig hin. […] Das sieht immer alles gleich aus.
 * Der Fehler wird durch den Ansatz, den wir heute fahren, nicht gelöst." Er hat
 * recht. Jedes bisherige Paket hat die GEBAUTE Schale als Ausgangspunkt genommen
 * und gefragt, was die kleinste Änderung ist, die alle Randbedingungen hält —
 * dabei kommt zwangsläufig wieder dasselbe heraus (gemessen 98,5 % bzw. 70,7 %
 * deckungsgleich, E-083).
 *
 * WAS DIESES BLATT ALSO NICHT TUT. Es rechnet nichts. Kein Bolzenkreis, keine
 * Zylinderneigung, kein Hebelarm, keine Maulweite, keine Wächter. Es schaut
 * nicht ein einziges Mal in `src/`. Es zeigt nicht „unsere Schale, aber anders",
 * sondern wie Schalen an echten Mehrschalengreifern aussehen. Ob eine davon bei
 * uns baubar ist, wird DANACH gerechnet — wenn Patrick eine ausgesucht hat.
 *
 * WOHER DIE FORMEN KOMMEN (Recherche 16.09.2026, Text — keine Fremdbilder):
 *   · Kinshofer, Polypgreifer P-Reihe: vier Zinkenprofile F / H / W / T
 *     (fully closing, half closing, wide pointed, pointed) sowie die Krangreifer
 *     KM 651 Vollschale (Späne, Glas, Sand, Kies), KM 652 Halbschale (Schrott,
 *     Abfall), KM 653 Spitzenschale (Sperrgut, Autowracks).
 *   · Sennebogen MG-Reihe: Schalensätze von „halboffen bis voll geschlossen",
 *     dazu Sonderschalen für Futter, Hackschnitzel, Unterwasser.
 *   · Idrobenne: geschlossen / halb geschlossen (Standard) / offen; Zinken und
 *     Spitzen aus Hardox 400, Rahmen aus Feinkornstahl; Buchsen mit
 *     innenliegender Fettspirale.
 *   · HS Schoch, Abbruch- und Sortiergreifer: „Rippen- oder
 *     Langlochschalenblech-Ausführung, optional gezackte Seitenwangen,
 *     Ausführung mit Zähnen oder U-Messer".
 *   · Genesis (Versi-Pro, GSD): „boxed tine construction, recessed welds,
 *     abrasion-resistant replaceable tine tips" — der Zinken als Kastenträger.
 *   · Rotobec / Hultdins, Holzgreifer: Sichelschalen, deren Innenfläche so
 *     gekrümmt ist, dass Stämme daran hochrollen; bypassende Backen, die
 *     aneinander vorbeigehen statt sich zu treffen.
 *   · Weihua / Servoday / Bonovo, Schrottgreifer-Bau: Hauptrahmen als
 *     Kastenträger aus hochfestem Blech, Hardox-Einlagen an den Tragstellen,
 *     auswechselbare Spitzen, angeschweißt oder geschraubt.
 *
 * WAS AUF DEM BLATT STEHT, je Spalte:
 *   1. Buchstabe A…H, damit Patrick sagen kann „B, aber mit der Ferse von E".
 *   2. Seitenriss der EINZELNEN Schale — die Hauptansicht.
 *   3. Ansicht von vorn — Breite und Wangen.
 *   4. Drei Querschnitte (nahe Ferse, Mitte, nahe Spitze).
 *   5. Die Bolzenaufnahme als eigene Vergrößerung, 2,5-fach. Patrick: „Ich sehe
 *      auch die, da wo die Bolzen durchkommen und so — das sieht irgendwie alles
 *      so danach aus, dass das immer noch passend versucht wird." An echten
 *      Geräten ist das Lagerauge ein eigenes Bauteil mit eigener Gestalt.
 *   6. Fünf Schalen im Kreis geschlossen — was für ein Korb daraus wird.
 *   7. Eine Zeile Text: Bauart, wofür, was sie auszeichnet.
 *
 * ALLE SEITENRISSE, ANSICHTEN UND SCHNITTE IM SELBEN MASSSTAB (200 px/m). Nur
 * die Lagerauge-Vergrößerung und der Kranz haben einen eigenen, angeschriebenen
 * Maßstab.
 *
 * Aufruf:  node tools/schalen-vorbilder.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/* ================================================================== Rahmen */

const SPALTEN = 8;
/**
 * Spaltenbreite. Acht Spalten nebeneinander — Patrick vergleicht, also breit.
 * 448 px, weil bei 372 px die Beschriftungen in die Nachbarspalte liefen; das
 * Blatt las sich dann wie ein einziges Bild statt wie acht (derselbe Fehler,
 * den `greifer-vergleich-blatt.ts` schon einmal gemacht hat).
 */
const SP_B = 448;
const RAND = 32;
const BREITE = RAND * 2 + SPALTEN * SP_B;
const HOEHE = 2644;

/** Pixel je Meter für Seitenriss und Vorderansicht. */
const PX = 230;
/**
 * Die Querschnitte laufen im HALBEN Maßstab. Bei vollem Maßstab liefen die
 * drei Schnitte einer Spalte ineinander — und ein Schnitt, der den Nachbarn
 * überlappt, zeigt gar nichts. Das steht auch am Band, damit die Angabe
 * „alle im selben Maßstab" nicht stillschweigend gebrochen wird.
 */
const PX_S = PX / 2;
/** Pixel je Meter für die Lagerauge-Vergrößerung (2,5-fach). */
const PX_D = 500;
/** Pixel je Meter für den Kranz aus fünf Schalen. */
const PX_K = 108;

/** Der Kasten über den Spalten: die Bahn der Schneide (DE 31 31 624 A1). */
const KASTEN = { y0: 142, h: 430 };

/** Höhenlage der Bänder im Blatt. Alles unterhalb des Kastens. */
const Y = {
  kopf: 630,
  seiteBeschr: 744,
  seiteNull: 778, // y = 0 der Schale (Drehbolzen)
  seiteLeiter: 1074, // Maßstabsleiter unter dem Seitenriss
  seiteKey: 1106, // die Dreiteilung des Zinkens erklärt
  vornBeschr: 1182,
  vornNull: 1230,
  schnittBeschr: 1494,
  schnittNull: 1556,
  augeBeschr: 1674,
  augeNull: 1812, // Bolzenmitte in der Vergrößerung
  augeText: 1992, // Legende UNTER der Zeichnung, nicht daneben
  augeSpalt: 2130, // die Zeile über die Lücke am Drehpunkt
  kranzBeschr: 2166,
  kranzNull: 2286,
  text: 2448,
};

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

const teile = [];
const z = (s) => teile.push(s);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function text(x, y, s, groesse = 20, farbe = F.linie, anker = "start", fett = false) {
  z(
    `<text x="${r(x)}" y="${r(y)}" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" ` +
      `font-size="${groesse}" fill="${farbe}" text-anchor="${anker}"` +
      (fett ? ' font-weight="600"' : "") +
      `>${esc(s)}</text>`
  );
}

function r(v) {
  return Math.round(v * 100) / 100;
}

function linie(x1, y1, x2, y2, farbe = F.linie, breite = 1.6, strich = null) {
  z(
    `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${farbe}" ` +
      `stroke-width="${breite}"${strich ? ` stroke-dasharray="${strich}"` : ""} stroke-linecap="round"/>`
  );
}

function kreis(x, y, rad, fuell = "none", farbe = F.linie, breite = 1.6) {
  z(`<circle cx="${r(x)}" cy="${r(y)}" r="${r(rad)}" fill="${fuell}" stroke="${farbe}" stroke-width="${breite}"/>`);
}

function pfad(d, fuell = "none", farbe = F.linie, breite = 1.8, strich = null) {
  z(
    `<path d="${d}" fill="${fuell}" stroke="${farbe}" stroke-width="${breite}" ` +
      `stroke-linejoin="round" stroke-linecap="round"${strich ? ` stroke-dasharray="${strich}"` : ""}/>`
  );
}

/** Punktliste zu einem glatten Pfad (Catmull-Rom als kubische Bézier). */
function glatt(pts, geschlossen = false) {
  if (pts.length < 2) return "";
  const p = pts;
  let d = `M ${r(p[0][0])} ${r(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d + (geschlossen ? " Z" : "");
}

/** Punktliste zu einem Kantenzug (für gekantete Bleche — da ist nichts glatt). */
function eckig(pts, geschlossen = false) {
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${r(pts[i][0])} ${r(pts[i][1])}`;
  return d + (geschlossen ? " Z" : "");
}

/**
 * Versetzt eine Punktliste nach AUSSEN (vom Krümmungsmittelpunkt weg).
 * Die Normale ist (−dy, dx); bei allen Schalen hier läuft die Liste von der
 * Ferse zur Spitze und krümmt sich nach oben-rechts, also zeigt diese Normale
 * konsequent auf den Rücken. Die Dicke wird über die Länge linear geführt —
 * dick an der Ferse, dünn an der Schneide, wie bei jedem Verschleißteil.
 */
function versetzen(pts, dickeFerse, dickeSpitze) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1);
    const d = dickeFerse + (dickeSpitze - dickeFerse) * t;
    return [p[0] - (dy / len) * d, p[1] + (dx / len) * d];
  });
}

/** Meter → Blattkoordinate im Seitenriss der Spalte i. */
function sx(i, xm) {
  return RAND + i * SP_B + 130 + xm * PX;
}
function sy(ym) {
  return Y.seiteNull + ym * PX;
}

/* ============================================================== Die Formen */

/**
 * Jede Form ist von Hand gesetzt, NICHT aus einer gemeinsamen Parameterfamilie
 * erzeugt. Genau das war der Fehler bisher: eine Familie kann nur Verwandte
 * hervorbringen. Acht handgesetzte Kurven können sich fremd sein.
 *
 * Koordinaten in Metern, Ursprung im Drehbolzen, +x zur Korbmitte, +y nach
 * unten. Gezeichnet ist die GESCHLOSSENE Stellung.
 */
const FORMEN = [
  {
    b: "A",
    name: "Vollschale",
    unter: "voll schließend",
    innen: [
      [0.15, 0.08],
      [0.09, 0.33],
      [0.13, 0.58],
      [0.28, 0.79],
      [0.5, 0.93],
      [0.74, 0.99],
      [0.92, 1.0],
    ],
    dicke: [0.13, 0.045],
    rund: true,
    spitze: "schneide", // gerade Schneide über die ganze Breite
    breite: 0.78, // Ansicht von vorn, volle Breite am Rand
    breiteFerse: 0.3,
    wange: "voll",
    schnitt: "trog",
    auge: "augscheiben",
    kranz: "voll",
    zweitauge: [-0.06, -0.2],
    zeilen: [
      `Tiefer gewalzter Trog, die Ränder treffen den`,
      `Nachbarn über die ganze Länge. Für Späne, Glasbruch,`,
      `Sand, Kies, Kleinschrott — alles, was sonst`,
      `durchrieselt. Kinshofer KM 651 / Zinkenprofil F.`,
      `Schwer, viel Blech, wenig Biss.`,
    ],
  },
  {
    b: "B",
    name: "Halbschale",
    unter: "halb schließend",
    innen: [
      [0.16, 0.06],
      [0.08, 0.3],
      [0.1, 0.54],
      [0.24, 0.72],
      [0.44, 0.83],
      [0.62, 0.87],
    ],
    dicke: [0.12, 0.05],
    rund: true,
    spitze: "stumpf",
    breite: 0.72,
    breiteFerse: 0.26,
    wange: "ausgeschnitten",
    schnitt: "halbtrog",
    auge: "wangenauge",
    kranz: "halb",
    zweitauge: [-0.16, -0.12],
    zeilen: [
      `Kürzer und flacher, schließt bewusst NICHT ganz — es`,
      `bleibt ein Spalt am Saum. Der Standard für Schrott,`,
      `Abfall, Papier: leichter, kippt schneller leer,`,
      `lässt Wasser und Dreck laufen. Kinshofer KM 652 /`,
      `Profil H.`,
    ],
  },
  {
    b: "C",
    name: "Zinken",
    unter: "spitzenschließend",
    innen: [
      [0.2, 0.05],
      [0.07, 0.3],
      [0.05, 0.58],
      [0.16, 0.83],
      [0.38, 1.02],
      [0.64, 1.11],
      [0.86, 1.12],
    ],
    dicke: [0.21, 0.06],
    rund: true,
    spitze: "aufsatz", // geschraubte Verschleißspitze
    breite: 0.28,
    breiteFerse: 0.24,
    wange: "keine",
    schnitt: "kasten",
    auge: "gabel",
    kranz: "spitz",
    zweitauge: [-0.02, -0.24],
    zeilen: [
      `Keine Schale mehr, ein Kastenträger: Innenblech,`,
      `zwei Wangen, Rückenblech, innen zugeschweißt.`,
      `Schließt nur auf den Spitzen, greift durch Sperrgut`,
      `und Autowracks hindurch. Spitze geschraubt.`,
      `Kinshofer KM 653 / Profil T.`,
    ],
  },
  {
    b: "D",
    name: "Breite Spitzenschale",
    unter: "gekantet, nicht gewalzt",
    innen: [
      [0.2, 0.05],
      [0.1, 0.26],
      [0.04, 0.5],
      [0.18, 0.74],
      [0.45, 0.92],
      [0.74, 1.02],
    ],
    dicke: [0.15, 0.055],
    rund: false, // gekantet — Ecken bleiben Ecken
    spitze: "spitz",
    breite: 0.95,
    breiteFerse: 0.28,
    wange: "flach",
    schnitt: "kant",
    auge: "einschnittig",
    kranz: "knick",
    zweitauge: [-0.1, -0.22],
    zeilen: [
      `Aus der Ebene gekantetes Blech statt gewalzter`,
      `Rundung: zwei Knicke, drei gerade Felder. Billiger`,
      `zu bauen und auffällig breit — viel Auflage, wenig`,
      `Tiefe. Schließt auf einer Spitze. Kinshofer Profil`,
      `W, „wide pointed tines“.`,
    ],
  },
  {
    b: "E",
    name: "Rippen-/Langlochschale",
    unter: "gezackte Seitenwangen",
    innen: [
      [0.18, 0.06],
      [0.09, 0.31],
      [0.11, 0.56],
      [0.27, 0.76],
      [0.5, 0.89],
      [0.72, 0.94],
    ],
    dicke: [0.3, 0.19], // die Seitenwange IST hier die Ansicht
    rund: true,
    spitze: "zacken",
    breite: 0.62,
    breiteFerse: 0.3,
    wange: "gezackt",
    schnitt: "rippe",
    auge: "querrohr",
    kranz: "rippe",
    zweitauge: [-0.14, -0.18],
    zeilen: [
      `Die tragende Ansicht ist die WANGE, nicht der Bogen:`,
      `zwei dicke Bleche mit Langlöchern, dazwischen`,
      `Querrippen mit Luft. Feines fällt durch, Grobes`,
      `bleibt. Sortiergreifer, Abbruch. HS Schoch: „Rippen-`,
      `oder Langlochschalenblech“.`,
    ],
  },
  {
    b: "F",
    name: "Gitter-/Stabschale",
    unter: "gar kein Blech",
    innen: [
      [0.2, 0.04],
      [0.06, 0.28],
      [0.02, 0.56],
      [0.14, 0.82],
      [0.4, 1.0],
      [0.7, 1.08],
    ],
    dicke: [0.055, 0.04],
    rund: true,
    spitze: "rund",
    breite: 0.86,
    breiteFerse: 0.2,
    wange: "keine",
    schnitt: "stab",
    auge: "guss",
    kranz: "gitter",
    zweitauge: [-0.08, -0.22],
    zeilen: [
      `Fünf gebogene Stäbe, verbunden von zwei Querbügeln —`,
      `sonst nichts. Im Seitenriss nur ein Strich, von vorn`,
      `ein Fächer. Für Leichtgut: Laub, Silage,`,
      `Hackschnitzel, lose Ballen. Fasst viel Volumen bei`,
      `wenig Eigengewicht.`,
    ],
  },
  {
    b: "G",
    name: "Holzgreifer-Sichel",
    unter: "bypassend",
    innen: [
      [0.22, 0.03],
      [0.08, 0.26],
      [0.02, 0.54],
      [0.12, 0.82],
      [0.38, 1.02],
      [0.7, 1.08],
      [0.96, 1.01],
      [1.12, 0.85],
    ],
    dicke: [0.19, 0.035],
    rund: true,
    spitze: "klinge",
    breite: 0.22,
    breiteFerse: 0.2,
    wange: "keine",
    schnitt: "klinge",
    auge: "schmiede",
    kranz: "sichel",
    zweitauge: [-0.04, -0.26],
    zeilen: [
      `Lange, stark eingerollte Sichel; die Spitze läuft an`,
      `der Gegenschale VORBEI statt sie zu treffen. Die`,
      `Innenfläche ist so gekrümmt, dass Stämme daran`,
      `hochrollen. Schmal, geschmiedet, ohne Wangen.`,
      `Rotobec / Hultdins, Holz.`,
    ],
  },
  {
    b: "H",
    name: "Zahn-/Kammschale",
    unter: "flache Pfanne",
    innen: [
      [0.14, 0.1],
      [0.02, 0.32],
      [0.0, 0.56],
      [0.14, 0.74],
      [0.4, 0.84],
      [0.68, 0.88],
      [0.94, 0.89],
    ],
    dicke: [0.12, 0.05],
    rund: true,
    spitze: "kamm",
    breite: 0.88,
    breiteFerse: 0.3,
    wange: "niedrig",
    schnitt: "pfanne",
    auge: "kastenferse",
    kranz: "zahn",
    zweitauge: [-0.12, -0.2],
    zeilen: [
      `Flache, lange Pfanne mit einer Reihe einzelner Zähne`,
      `am Saum; die Zähne der Gegenschale KÄMMEN dazwischen`,
      `durch. Für Abbruch und Sortieren, Ziegel und`,
      `Mischschutt. Ohne Zähne dieselbe Pfanne mit`,
      `U-Messer. HS Schoch, Genesis.`,
    ],
  },
];

/**
 * NACHTRAG 16.09.2026, zweiter Durchgang nach besseren Quellen (Patentrisse).
 * Drei Dinge, die im ersten Entwurf fehlten oder falsch waren:
 *
 *  1. DIE LÜCKE AM SCHALENDREHPUNKT IST ABSICHT. Sennebogen zur MG4.1: Die
 *     Anbindung der Schalen an den Mittelbalken lässt am Schalendrehpunkt
 *     genügend Platz, damit Kleinmaterial durchfallen kann. Genau die Stelle,
 *     auf die Patrick zeigt, hat also einen Zweck — Kleinzeug soll dort
 *     durchfallen, statt sich festzusetzen. Steht jetzt bei jeder Form in der
 *     Vergrößerung, mit der Frage, ob dort wirklich etwas durchläuft.
 *  2. DER ZINKEN IST DREITEILIG. Bateman zur B5T: verstärkter Rücken,
 *     Verschleißstreifen und auswechselbare, ANGESCHWEISSTE Spitze — drei
 *     Dinge, die wir als eines gezeichnet hatten. (Geschraubte Spitzen gibt es
 *     auch; der Handel führt Anschweiß- und Schraubzähne nebeneinander.)
 *  3. E UND F SIND FÜR SCHROTT NICHT BELEGT. Rippen-, Langloch- und
 *     Gitterschalen habe ich nur für Leicht- und Schüttgut gefunden, nicht für
 *     Schrott. Im ersten Entwurf stand das als „die Familie, die wir nie
 *     betrachtet haben" — das war meine Vermutung, nicht die Quellenlage. Die
 *     Formen bleiben auf dem Blatt, aber sie sind jetzt so gekennzeichnet.
 */
const NACHTRAG = {
  A: {
    dreiteilig: true,
    spitzeWort: "Schneide, angeschweißt",
    spalt: { art: "seite", weite: 14, bis: -42 },
    spaltWort: "Spalt eng: die breit auslaufende Ferse verengt ihn — Feines kann sich hier setzen.",
  },
  B: {
    dreiteilig: true,
    spitzeWort: "stumpfe Spitze, angeschweißt",
    spalt: { art: "seite", weite: 34, bis: -33 },
    spaltWort: "Spalt weit: der Rücken läuft schlank aus, Kleinzeug fällt durch. Der Schrott-Normalfall.",
  },
  C: {
    dreiteilig: true,
    spitzeWort: "Spitze angeschweißt (auch geschraubt üblich)",
    winkel: "US 2012/0299321: Spitze ≈ 53° zur Senkrechten, Innenwinkel ≈ 110°",
    spalt: { art: "front", paare: [[-29, -18], [18, 29]] },
    spaltWort: "Beidseits der Nabennase offen — von allen acht der größte Durchfall.",
  },
  D: {
    dreiteilig: true,
    spitzeWort: "Spitze angeschweißt",
    winkel: "US 2012/0299321: flache Zinke ≈ 67° zur Senkrechten, Innenwinkel ≈ 134°",
    spalt: { art: "front", paare: [[-43, -34], [34, 43]] },
    spaltWort: "Zwei schmale Spalte statt einem breiten — einschnittig heißt hier: zweimal wenig.",
  },
  E: {
    dreiteilig: false,
    spitzeWort: "gezackte Wangenkante, kein eigener Zahn",
    unbelegt: "für Schrott nicht belegt",
    spalt: { art: "front", paare: [[-64, -50], [50, 64]] },
    spaltWort: "Das Querrohr schließt die Mitte — Durchfall nur außen. Dafür ist die Schale selbst durchlässig.",
  },
  F: {
    dreiteilig: false,
    spitzeWort: "Stabende, rund",
    unbelegt: "für Schrott nicht belegt",
    spalt: { art: "rund" },
    spaltWort: "Ringsum offen: hier ist alles Spalt. Die Frage stellt sich bei dieser Bauart gar nicht.",
  },
  G: {
    dreiteilig: false,
    spitzeWort: "Klinge, aus dem Schmiedestück",
    spalt: { art: "seite", weite: 10, bis: -46 },
    spaltWort: "Eng gefasst: Holz muss nirgends durchfallen, also wird der Spalt hier nicht gebraucht.",
  },
  H: {
    dreiteilig: true,
    spitzeWort: "Zahnreihe, geschraubt oder angeschweißt",
    spalt: { art: "seite", weite: 26, bis: -52 },
    spaltWort: "Der Anschlagnocken steht im Weg; frei ist es erst unter ihm.",
  },
};
FORMEN.forEach((f) => Object.assign(f, NACHTRAG[f.b]));

/* ================================================== Blattrahmen und Kopf */

z(`<rect x="0" y="0" width="${BREITE}" height="${HOEHE}" fill="${F.papier}"/>`);

text(RAND, 60, "Wie sehen Greiferschalen wirklich aus?", 46, F.linie, "start", true);
text(
  RAND,
  96,
  "Acht Bauarten von echten Mehrschalen- und Polypgreifern, frei nachgezeichnet — ohne Rücksicht auf unsere Konstruktion. Nichts hiervon ist ein Vorschlag; das Blatt ist zum Aussuchen da.",
  22,
  F.grau
);
text(
  RAND,
  126,
  "Seitenriss, Vorderansicht und Querschnitte aller acht im selben Maßstab: 1 m = 200 px. Lagerauge 2,5-fach, Kranz verkleinert. Quellen als Text im Fuß — keine Fremdbilder.",
  22,
  F.grau
);

/* ============================== Der Kasten: die Bahn der Schneide ========= */

/**
 * DER WICHTIGSTE FUND DES PAKETS. Patent DE 31 31 624 A1 („Greifer mit
 * steuerbarem Bewegungsmuster der Schalenschneiden") beschreibt genau das
 * Problem, an dem wir seit E-065 hängen: Die Schneide fährt beim Schließen
 * einen BOGEN, geht dabei erst tiefer und kommt danach wieder hoch.
 *
 * Das Patent nennt drei Punkte: A = Schneide, B = Drehpunkt der Schale im
 * Greiferkopf, C = Anlenkpunkt an der Schale. Seine Lösung ist NICHT eine
 * bessere Schalenform, sondern eine überlagerte senkrechte Ausgleichsbewegung
 * des ganzen Greifers; die Schalengeometrie allein genügt ihm nicht. Und es
 * gibt die Regel an, wann diese Überlagerung einfach wird: wenn AB und BC
 * einen RECHTEN WINKEL bilden, ist die senkrechte Verschiebung der Schneide
 * gleich der Bewegung des Anlenkpunktes C — eins zu eins nachführbar. Wird der
 * Winkel kleiner oder wandert C entgegen der Schließrichtung, bekommt der
 * Schneidenweg eine Überhöhung.
 *
 * Daraus folgt die eine Aussage, die dieses Blatt angeht — und sie ist eine
 * Aussage über die FORM, nicht über unsere Anlenkung: Der Scheitel entsteht
 * durch den Winkel φ zwischen der Strecke Drehbolzen→Spitze und der
 * Senkrechten in der GESCHLOSSENEN Stellung. Steht die Spitze geschlossen
 * senkrecht unter ihrem Bolzen (φ = 0), gibt es überhaupt keinen Scheitel: Die
 * Schneide ist im Geschlossenen am tiefsten und steigt von da nur noch. Je
 * weiter die Spitze zur Mitte hin versetzt ist, desto höher der Scheitel.
 *
 * Hier wird NICHTS gegen unseren Greifer gerechnet. Die 25,2 cm stehen seit
 * E-065 im Log und werden nur zitiert.
 */
function bahnkasten() {
  const x0 = RAND;
  const y0 = KASTEN.y0;
  z(`<rect x="${x0}" y="${y0}" width="${BREITE - 2 * RAND}" height="${KASTEN.h}" fill="${F.feld}" stroke="${F.linie}" stroke-width="2.5" rx="10"/>`);

  text(x0 + 28, y0 + 42, "Der eine Riss, der uns wirklich weiterhilft: die Bahn der Schneide", 30, F.linie, "start", true);
  text(
    x0 + 28,
    y0 + 72,
    "Patent DE 31 31 624 A1, „Greifer mit steuerbarem Bewegungsmuster der Schalenschneiden“ — es beschreibt genau unser Problem aus E-065.",
    20,
    F.grau
  );

  /* --- Die drei kleinen Risse ------------------------------------------- */
  const RR = 96; // Schalenradius in Pixeln für die Skizzen
  const skizze = (sx0, titel, phiGrad, farbe, unten) => {
    const bx = sx0 + 130;
    const by = y0 + 148;
    const phi = (phiGrad * Math.PI) / 180;

    /*
     * Der Bogen, den die Spitze fährt: Kreis um den Drehbolzen.
     *
     * Die Winkel sind im Bildschirmsinn (y nach unten), „senkrecht nach unten"
     * ist also 90°. Geschlossen steht die Spitze um φ neben der Senkrechten,
     * offen um 90° − φ auf der anderen Seite. Der Bogen läuft damit ÜBER die
     * Senkrechte hinweg — und der tiefste Punkt der Bahn ist genau dort, nicht
     * an einem der beiden Enden. Beim ersten Entwurf lief der Bogen in die
     * falsche Richtung und der Tiefpunkt kam im Bild gar nicht vor; die
     * Zeichnung behauptete dann das Gegenteil des Textes.
     */
    const a0 = Math.PI / 2 + phi; // geschlossen
    const a1 = phi; // offen, 90° Schwenk
    const bahn = [];
    for (let k = 0; k <= 24; k++) {
      const a = a0 + ((a1 - a0) * k) / 24;
      bahn.push([bx + Math.cos(a) * RR, by + Math.sin(a) * RR]);
    }
    pfad(glatt(bahn), "none", farbe, 2.6);

    // Bolzen und die Strecke B→A im Geschlossenen.
    kreis(bx, by, 7, F.feld, F.linie, 2);
    text(bx - 12, by - 8, "B", 17, F.linie, "end", true);
    const ax = bx + Math.cos(a0) * RR;
    const ay = by + Math.sin(a0) * RR;
    linie(bx, by, ax, ay, F.linie, 1.6, "5 4");
    text(ax - 9, ay + 22, "A", 17, F.linie, "end", true);

    // Die Senkrechte und der Winkel φ.
    linie(bx, by, bx, by + RR + 16, F.hilfe, 1.4, "4 5");
    if (phiGrad > 0) {
      text(bx + 8, by + 34, `φ = ${phiGrad}°`, 16, farbe, "start", true);
    } else {
      text(bx + 8, by + 34, "φ = 0", 16, farbe, "start", true);
    }

    // Der tiefste Punkt der Bahn und der Scheitel darüber.
    const tiefY = by + RR; // tiefster Punkt des Kreises
    linie(sx0 + 14, tiefY, sx0 + 250, tiefY, F.hilfe, 1.4, "3 5");
    const schliessY = ay;
    if (tiefY - schliessY > 2) {
      // Es gibt einen Scheitel: die Schneide taucht unter die Schließstellung.
      linie(sx0 + 30, schliessY, sx0 + 30, tiefY, F.rot, 3);
      linie(sx0 + 24, schliessY, sx0 + 36, schliessY, F.rot, 3);
      linie(sx0 + 24, tiefY, sx0 + 36, tiefY, F.rot, 3);
      text(sx0 + 24, schliessY - 10, "Scheitel", 16, F.rot, "start", true);
    } else {
      text(sx0 + 24, tiefY - 12, "kein Scheitel", 16, F.gruen, "start", true);
    }

    text(sx0 + 14, y0 + 300, titel, 19, F.linie, "start", true);
    unten.forEach((zl, k) => text(sx0 + 14, y0 + 326 + k * 22, zl, 16, F.grau));
  };

  skizze(x0 + 28, "1 · Spitze senkrecht unter dem Bolzen", 0, F.gruen, [
    "Die Schneide ist geschlossen am tiefsten und",
    "steigt von da nur noch. Kein Tiefpunkt unterwegs.",
  ]);
  skizze(x0 + 400, "2 · Spitze zur Mitte versetzt", 38, F.rot, [
    "Sie taucht auf dem Weg unter die Schließstellung",
    "und kommt wieder hoch. Je größer φ, desto höher.",
  ]);

  /* --- Was das Patent sagt ---------------------------------------------- */
  const rx = x0 + 800;
  z(`<line x1="${rx - 28}" y1="${y0 + 96}" x2="${rx - 28}" y2="${y0 + KASTEN.h - 24}" stroke="${F.band}" stroke-width="2"/>`);

  text(rx, y0 + 124, "Was das Patent sagt", 21, F.linie, "start", true);
  [
    "· Die Schneiden führen beim Schließen eine bogenförmige Bewegung aus. Das ist keine",
    "  Fehlkonstruktion, sondern die Folge davon, dass die Schale EIN starrer Körper an EINEM",
    "  Bolzen ist. Genau das steht seit E-065 auch bei uns im Log.",
    "· Der Bogen verschleißt den Untergrund — im Patent ausdrücklich Waggonböden.",
    "· Die Lösung des Patents ist NICHT eine bessere Schalenform, sondern eine überlagerte",
    "  senkrechte Ausgleichsbewegung des GANZEN Greifers, gesteuert über den Schließwinkel.",
    "· Seine Regel für den Anlenkpunkt C an der Schale: bilden AB (Bolzen→Schneide) und",
    "  BC (Bolzen→Anlenkung) einen rechten Winkel, ist die senkrechte Verschiebung der",
    "  Schneide gleich der Bewegung von C — eins zu eins nachführbar. Kleinerer Winkel",
    "  oder C entgegen der Schließrichtung: der Schneidenweg bekommt eine Überhöhung.",
  ].forEach((zl, k) => text(rx, y0 + 154 + k * 24, zl, 17, F.grau));

  /* --- Die 90°-Skizze mit A, B, C --------------------------------------- */
  const cx0 = x0 + 1900;
  const cy0 = y0 + 250;
  z(`<line x1="${cx0 - 130}" y1="${y0 + 96}" x2="${cx0 - 130}" y2="${y0 + KASTEN.h - 24}" stroke="${F.band}" stroke-width="2"/>`);
  text(cx0 - 100, y0 + 124, "Die Regel für den Anlenkpunkt", 21, F.linie, "start", true);
  linie(cx0, cy0, cx0 + 96, cy0 + 76, F.linie, 2.8); // B → A
  linie(cx0, cy0, cx0 + 60, cy0 - 76, F.blau, 2.8); // B → C
  kreis(cx0, cy0, 8, F.feld, F.linie, 2.2);
  kreis(cx0 + 60, cy0 - 76, 10, F.feld, F.blau, 2.6);
  text(cx0 - 14, cy0 + 5, "B", 18, F.linie, "end", true);
  text(cx0 + 106, cy0 + 86, "A", 18, F.linie, "start", true);
  text(cx0 + 72, cy0 - 84, "C", 18, F.blau, "start", true);
  pfad(`M ${cx0 + 30} ${cy0 + 24} L ${cx0 + 46} ${cy0 - 4} L ${cx0 + 19} ${cy0 - 22}`, "none", F.rot, 2.2);
  text(cx0 + 54, cy0 + 6, "90°", 17, F.rot, "start", true);
  text(cx0 - 100, y0 + 372, "AB ⊥ BC — dann läuft die Nachführung", 17, F.linie);
  text(cx0 - 100, y0 + 394, "eins zu eins mit dem Anlenkpunkt.", 17, F.linie);

  /* --- Was das für dieses Blatt heißt ------------------------------------ */
  const fx = x0 + 2340;
  z(
    `<rect x="${fx - 28}" y="${y0 + 100}" width="${BREITE - RAND - (fx - 28) - 28}" height="${KASTEN.h - 128}" ` +
      `fill="#eef3f6" stroke="${F.blau}" stroke-width="2" rx="8"/>`
  );
  text(fx, y0 + 134, "Was das für dieses Blatt heißt", 21, F.blau, "start", true);
  [
    "Wo die Spitze im Geschlossenen relativ zu IHREM",
    "Bolzen sitzt, ist eine Frage der FORM — und sie",
    "steht bei jeder der acht Spalten im Seitenriss.",
    "",
    "Aber: Die Spitze senkrecht unter den Bolzen zu",
    "legen heißt, den Bolzen fast auf die Mitte zu",
    "holen. Ob das geht, ist eine Frage der Anlenkung",
    "und wird hier NICHT beantwortet.",
    "",
    "Das Patent selbst löst es gar nicht über die Form,",
    "sondern über eine zweite Bewegung. Auch das ist",
    "eine mögliche Antwort — aber keine, die man einer",
    "Schale ansieht.",
  ].forEach((zl, k) => text(fx, y0 + 164 + k * 22, zl, 17, F.linie));
}

bahnkasten();

/* Spaltenfelder und Trennlinien. */
for (let i = 0; i < SPALTEN; i++) {
  const x0 = RAND + i * SP_B;
  z(`<rect x="${x0 + 6}" y="${Y.kopf - 42}" width="${SP_B - 12}" height="${HOEHE - Y.kopf - 60}" fill="${F.feld}" stroke="${F.band}" stroke-width="2" rx="8"/>`);
}

/* =========================================================== Zeichenteile */

/** Ein kleines Beschriftungsband über einem Bildteil. */
function bandBeschr(i, y, s) {
  const x0 = RAND + i * SP_B;
  text(x0 + 22, y, s, 19, F.grau, "start", true);
  linie(x0 + 22, y + 7, x0 + SP_B - 22, y + 7, F.band, 2);
}

/** Maßstabsleiter: ein Meter, damit der Maßstab nicht behauptet, sondern gezeigt ist. */
function meterleiter(x, y, px, beschriftung) {
  linie(x, y, x + px, y, F.hilfe, 2);
  linie(x, y - 5, x, y + 5, F.hilfe, 2);
  linie(x + px, y - 5, x + px, y + 5, F.hilfe, 2);
  text(x + px / 2, y - 9, beschriftung, 15, F.hilfe, "middle");
}

/* ------------------------------------------------------------ Seitenriss */

function seitenriss(i, form) {
  const x0 = RAND + i * SP_B;
  bandBeschr(i, Y.seiteBeschr, "1 · Seitenriss der einzelnen Schale");

  const P = (p) => [sx(i, p[0]), sy(p[1])];
  const innen = form.innen.map(P);
  const aussen = versetzen(
    form.innen,
    form.dicke[0],
    form.dicke[1]
  ).map(P);

  const zeichner = form.rund ? glatt : eckig;

  // Grundriss-Hilfslinie: die Korbmitte, damit man sieht, wie weit die Spitze kommt.
  const mitte = sx(i, 0.98);
  linie(mitte, sy(-0.12), mitte, sy(1.3), F.hilfe, 1.4, "5 6");
  text(mitte - 6, Y.seiteLeiter - 14, "Korbmitte", 14, F.hilfe, "end");

  // Der Schalenkörper.
  const d =
    zeichner(innen).replace(/^M/, "M") +
    " L " +
    aussen
      .slice()
      .reverse()
      .map((p) => `${r(p[0])} ${r(p[1])}`)
      .join(" L ") +
    " Z";
  pfad(d, F.fuell, F.stahl, 2.2);
  // Innenfläche noch einmal kräftig — das ist die Linie, die die Form macht.
  pfad(zeichner(innen), "none", F.linie, 2.6);

  // Sonderheiten je Form.
  if (form.spitze === "aufsatz") {
    // Geschraubte Verschleißspitze: eigener Keil, durch eine Fuge abgesetzt.
    const a = innen[innen.length - 1];
    const b = aussen[aussen.length - 1];
    const a2 = innen[innen.length - 2];
    const b2 = aussen[aussen.length - 2];
    const fugeA = [a[0] - (a[0] - a2[0]) * 0.42, a[1] - (a[1] - a2[1]) * 0.42];
    const fugeB = [b[0] - (b[0] - b2[0]) * 0.42, b[1] - (b[1] - b2[1]) * 0.42];
    pfad(eckig([fugeA, a, b, fugeB], true), F.fuellTief, F.linie, 2.2);
    // Die Fuge ist eine SCHWEISSNAHT, kein Bolzen. Bateman zur B5T:
    // „replaceable weld-on tine tips". Im ersten Entwurf stand hier eine
    // Schraube — geschraubte Zähne gibt es auch, angeschweißte sind bei
    // Schrottgreifern aber das, was die Quellen nennen.
    linie(fugeA[0], fugeA[1], fugeB[0], fugeB[1], F.rot, 2.4);
    for (let k = 0; k < 4; k++) {
      const t = 0.15 + k * 0.24;
      const mx = fugeA[0] + (fugeB[0] - fugeA[0]) * t;
      const my = fugeA[1] + (fugeB[1] - fugeA[1]) * t;
      pfad(eckig([[mx - 4, my - 5], [mx + 4, my], [mx - 4, my + 5]]), "none", F.rot, 1.6);
    }
    text(a[0] - 4, a[1] + 30, "Spitze angeschweißt", 15, F.rot, "end");
  }
  if (form.spitze === "klinge") {
    const a = innen[innen.length - 1];
    text(a[0] - 4, a[1] + 26, "läuft vorbei →", 15, F.blau, "end");
  }
  if (form.spitze === "kamm") {
    // Zahnreihe am Saum, im Seitenriss sieht man einen Zahn und die Lücke dahinter.
    const a = innen[innen.length - 1];
    pfad(eckig([[a[0], a[1] - 6], [a[0] + 34, a[1] + 2], [a[0], a[1] + 16]], true), F.fuellTief, F.linie, 2);
    text(a[0] - 4, a[1] + 44, "Zahn (Reihe)", 15, F.linie, "end");
  }
  if (form.spitze === "zacken") {
    // Gezackte Wange: Sägezahn auf der Innenkante.
    for (let k = 1; k < innen.length; k++) {
      const p = innen[k];
      const q = innen[k - 1];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      const dx = p[0] - q[0];
      const dy = p[1] - q[1];
      const l = Math.hypot(dx, dy) || 1;
      pfad(
        eckig([
          [mx - (dx / l) * 9, my - (dy / l) * 9],
          [mx + (dy / l) * 13, my - (dx / l) * 13],
          [mx + (dx / l) * 9, my + (dy / l) * 9],
        ]),
        "none",
        F.linie,
        2
      );
    }
    // Langlöcher im Wangenblech.
    for (let k = 1; k < innen.length - 1; k++) {
      const p = innen[k];
      const a = aussen[k];
      const cx = p[0] * 0.45 + a[0] * 0.55;
      const cy = p[1] * 0.45 + a[1] * 0.55;
      const w = Math.atan2(a[1] - p[1], a[0] - p[0]) * (180 / Math.PI);
      z(
        `<rect x="${r(cx - 15)}" y="${r(cy - 6)}" width="30" height="12" rx="6" fill="${F.papier}" ` +
          `stroke="${F.grau}" stroke-width="1.6" transform="rotate(${r(w + 90)} ${r(cx)} ${r(cy)})"/>`
      );
    }
    text(sx(i, 0.18), sy(1.2), "Langlöcher + Zacken", 15, F.grau);
  }
  if (form.schnitt === "stab") {
    // Gitterschale: die anderen vier Stäbe liegen im Seitenriss dahinter.
    for (const versatz of [-3, 3, 6]) {
      pfad(
        glatt(form.innen.map((p) => [sx(i, p[0]) + versatz, sy(p[1]) + versatz])),
        "none",
        F.hilfe,
        1.4
      );
    }
    // Querbügel als Punkte.
    for (const k of [2, 4]) {
      const p = innen[k];
      kreis(p[0], p[1] + 8, 6, F.feld, F.blau, 2);
    }
    text(sx(i, 0.3), sy(1.26), "Querbügel", 15, F.blau);
  }
  if (form.rund === false) {
    // Die Kanten anschreiben — das ist der Punkt dieser Form.
    for (const k of [1, 2, 3]) {
      kreis(innen[k][0], innen[k][1], 5, "none", F.rot, 2);
    }
    text(sx(i, -0.12), sy(0.5), "Knick", 15, F.rot);
  }

  /**
   * DIE DREITEILUNG. Bateman zur B5T: „thicker backs, wear strips & heavy-duty
   * replaceable weld-on tine tips" — verstärkter Rücken, Verschleißstreifen,
   * auswechselbare Spitze. Wir hatten das als EIN Blech gezeichnet. Wo eine
   * Bauart die drei Teile hat, sind sie jetzt getrennt angeschrieben; die
   * Sichel (G, ein Schmiedestück), die Rippenschale (E) und die Gitterschale
   * (F) haben sie nicht, und das ist genauso ein Unterschied.
   */
  if (form.dreiteilig) {
    const nR = Math.max(3, Math.round(aussen.length * 0.62));
    pfad(glatt(aussen.slice(0, nR)), "none", F.stahl, 7); // verstärkter Rücken
    // Verschleißstreifen: zwei Linien AUF der Innenfläche (negative Dicke
    // versetzt nach innen, zur hohlen Seite).
    for (const d of [3.5, 9]) {
      pfad(glatt(versetzen(form.innen, -d / PX, -d / PX).map(P)), "none", F.gruen, 2.6);
    }
  }

  // Der Drehbolzen.
  const bx = sx(i, 0);
  const by = sy(0);
  kreis(bx, by, 13, F.feld, F.linie, 2.2);
  kreis(bx, by, 5, F.linie, F.linie, 1);
  linie(bx - 26, by, bx + 26, by, F.hilfe, 1.2, "4 4");
  linie(bx, by - 26, bx, by + 26, F.hilfe, 1.2, "4 4");
  text(bx - 20, by + 6, "Drehbolzen", 15, F.grau, "end");

  // Die Legende zur Dreiteilung — bei den Bauarten, die sie haben.
  if (form.dreiteilig) {
    linie(x0 + 24, Y.seiteKey - 5, x0 + 46, Y.seiteKey - 5, F.stahl, 7);
    text(x0 + 52, Y.seiteKey, "verstärkter Rücken", 15, F.grau);
    linie(x0 + 212, Y.seiteKey - 5, x0 + 234, Y.seiteKey - 5, F.gruen, 2.6);
    text(x0 + 240, Y.seiteKey, "Verschleißstreifen", 15, F.grau);
  } else {
    text(x0 + 24, Y.seiteKey, "ein Stück — kein verstärkter Rücken, keine Streifen", 15, F.grau);
  }
  text(x0 + 24, Y.seiteKey + 21, form.spitzeWort, 15, F.rot);
  if (form.winkel) text(x0 + 24, Y.seiteKey + 42, form.winkel, 14, F.blau);

  meterleiter(x0 + 44, Y.seiteLeiter, PX, "1 m");
}

/* ------------------------------------------------------- Ansicht von vorn */

function vorderansicht(i, form) {
  const x0 = RAND + i * SP_B;
  bandBeschr(i, Y.vornBeschr, "2 · Von vorn: Breite und Wangen");

  const cx = x0 + SP_B / 2;
  const y = Y.vornNull;
  const hb = (form.breite / 2) * PX; // halbe Breite am Saum
  const hf = (form.breiteFerse / 2) * PX; // halbe Breite an der Ferse
  const H = 176; // Bildhöhe der Vorderansicht (Ferse oben, Saum unten)

  // Der Umriss: von der schmalen Ferse zum breiten Saum.
  const umriss = [
    [cx - hf, y],
    [cx - hb, y + H],
    [cx + hb, y + H],
    [cx + hf, y],
  ];
  pfad(eckig(umriss, true), F.fuell, F.stahl, 2.2);

  // Die Seitenwangen.
  if (form.wange === "voll") {
    linie(cx - hb, y + H, cx - hf, y, F.linie, 2.4);
    linie(cx + hb, y + H, cx + hf, y, F.linie, 2.4);
    text(cx, y + H + 26, "volle Wange bis zum Saum", 15, F.grau, "middle");
  } else if (form.wange === "ausgeschnitten") {
    // Wange bis zur halben Höhe, dann ausgeschnitten.
    pfad(
      eckig([
        [cx - hb, y + H],
        [cx - hb + 16, y + H - 66],
        [cx - hf - 6, y + 10],
      ]),
      "none",
      F.rot,
      2.4
    );
    pfad(
      eckig([
        [cx + hb, y + H],
        [cx + hb - 16, y + H - 66],
        [cx + hf + 6, y + 10],
      ]),
      "none",
      F.rot,
      2.4
    );
    text(cx, y + H + 26, "Wange ausgeschnitten", 15, F.rot, "middle");
  } else if (form.wange === "keine") {
    text(cx, y + H + 26, "keine Wange", 15, F.grau, "middle");
  } else if (form.wange === "flach") {
    linie(cx - hb, y + H, cx - hb, y + H - 30, F.linie, 2.4);
    linie(cx + hb, y + H, cx + hb, y + H - 30, F.linie, 2.4);
    text(cx, y + H + 26, "nur ein flacher Bord", 15, F.grau, "middle");
  } else if (form.wange === "niedrig") {
    linie(cx - hb, y + H, cx - hb, y + H - 22, F.linie, 2.4);
    linie(cx + hb, y + H, cx + hb, y + H - 22, F.linie, 2.4);
    text(cx, y + H + 26, "niedriger Bord, offen", 15, F.grau, "middle");
  } else if (form.wange === "gezackt") {
    // Zwei dicke Wangenbleche, dazwischen Rippen mit Luft.
    z(`<rect x="${r(cx - hb)}" y="${r(y)}" width="15" height="${H}" fill="${F.fuellTief}" stroke="${F.linie}" stroke-width="2"/>`);
    z(`<rect x="${r(cx + hb - 15)}" y="${r(y)}" width="15" height="${H}" fill="${F.fuellTief}" stroke="${F.linie}" stroke-width="2"/>`);
    for (let k = 0; k < 5; k++) {
      const yy = y + 18 + k * 34;
      z(`<rect x="${r(cx - hb + 15)}" y="${r(yy)}" width="${r(2 * hb - 30)}" height="13" fill="${F.fuell}" stroke="${F.linie}" stroke-width="1.8"/>`);
    }
    text(cx, y + H + 26, "zwei Wangen, Rippen mit Luft", 15, F.grau, "middle");
  }

  // Innere Struktur je Bauart.
  if (form.schnitt === "trog" || form.schnitt === "halbtrog") {
    for (const t of [0.34, 0.66]) {
      const xx = cx - hb + 2 * hb * t;
      linie(xx, y + 14, xx, y + H - 8, F.hilfe, 1.4, "5 5");
    }
    text(cx, y + 34, "gewalzter Trog", 15, F.grau, "middle");
  }
  if (form.schnitt === "kasten") {
    z(`<rect x="${r(cx - hb + 7)}" y="${r(y + 10)}" width="${r(2 * hb - 14)}" height="${H - 20}" fill="none" stroke="${F.hilfe}" stroke-width="1.6" stroke-dasharray="5 5"/>`);
    text(cx, y + H / 2, "Kasten", 15, F.grau, "middle");
  }
  if (form.schnitt === "kant") {
    for (const t of [0.3, 0.7]) {
      const xx = cx - hb + 2 * hb * t;
      linie(xx, y + 6, xx, y + H, F.rot, 2, "7 5");
    }
    text(cx, y + 34, "zwei Kantlinien", 15, F.rot, "middle");
  }
  if (form.schnitt === "stab") {
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const xxOben = cx - hf + 2 * hf * t;
      const xxUnten = cx - hb + 2 * hb * t;
      linie(xxOben, y, xxUnten, y + H, F.stahl, 5);
    }
    for (const yy of [y + 58, y + 126]) {
      linie(cx - hb * 0.85, yy, cx + hb * 0.85, yy, F.blau, 4);
    }
    // Tiefer als die üblichen Beschriftungen: hier steht schon „keine Wange".
    text(cx, y + H + 48, "fünf Stäbe, zwei Bügel", 15, F.blau, "middle");
  }
  if (form.schnitt === "pfanne") {
    // Zahnkamm am Saum.
    for (let k = 0; k < 5; k++) {
      const xx = cx - hb + 12 + ((2 * hb - 24) / 4) * k;
      pfad(eckig([[xx - 11, y + H], [xx, y + H + 24], [xx + 11, y + H]], true), F.fuellTief, F.linie, 2);
    }
    // Die Zähne der Gegenschale kämmen in die Lücken.
    for (let k = 0; k < 4; k++) {
      const xx = cx - hb + 12 + ((2 * hb - 24) / 4) * (k + 0.5);
      pfad(eckig([[xx - 10, y + H + 32], [xx, y + H + 10], [xx + 10, y + H + 32]], true), "none", F.blau, 1.8, "4 4");
    }
    text(cx, y + H + 52, "Gegenzähne kämmen durch", 15, F.blau, "middle");
  }
  if (form.schnitt === "klinge") {
    text(cx, y + H / 2, "massiv", 15, F.grau, "middle");
  }

  meterleiter(x0 + SP_B - 128, y + 22, PX * 0.5, "50 cm");
}

/* ------------------------------------------------------------ Querschnitte */

function querschnitte(i, form) {
  const x0 = RAND + i * SP_B;
  bandBeschr(i, Y.schnittBeschr, "3 · Querschnitt an drei Stellen (½)");

  const stellen = [0.3, 0.62, 0.9]; // relative Breite an den drei Stellen
  const mitten = [x0 + 96, x0 + 224, x0 + 352];
  const y = Y.schnittNull;

  stellen.forEach((f, k) => {
    const cx = mitten[k];
    const w = Math.max(16, (form.breite * f * PX_S) / 2); // halbe Schnittbreite im halben Maßstab
    const s = form.schnitt;

    if (s === "trog" || s === "halbtrog") {
      const tief = s === "trog" ? 30 : 20;
      const hoehe = s === "trog" ? 30 : 16;
      pfad(
        glatt([
          [cx - w, y - hoehe],
          [cx - w * 0.75, y + tief * 0.5],
          [cx, y + tief],
          [cx + w * 0.75, y + tief * 0.5],
          [cx + w, y - hoehe],
        ]),
        "none",
        F.linie,
        5
      );
    } else if (s === "kasten") {
      z(`<rect x="${r(cx - w)}" y="${r(y - 16)}" width="${r(2 * w)}" height="40" fill="${F.fuell}" stroke="${F.linie}" stroke-width="4"/>`);
      linie(cx - w + 6, y - 16, cx - w + 6, y + 24, F.hilfe, 1.4);
      linie(cx + w - 6, y - 16, cx + w - 6, y + 24, F.hilfe, 1.4);
    } else if (s === "kant") {
      pfad(
        eckig([
          [cx - w, y - 22],
          [cx - w * 0.5, y + 18],
          [cx + w * 0.5, y + 18],
          [cx + w, y - 22],
        ]),
        "none",
        F.linie,
        5
      );
    } else if (s === "rippe") {
      // Schnitt DURCH eine Rippe (links, Mitte) und durch eine LÜCKE (rechts).
      z(`<rect x="${r(cx - w)}" y="${r(y - 22)}" width="9" height="46" fill="${F.fuellTief}" stroke="${F.linie}" stroke-width="2.4"/>`);
      z(`<rect x="${r(cx + w - 9)}" y="${r(y - 22)}" width="9" height="46" fill="${F.fuellTief}" stroke="${F.linie}" stroke-width="2.4"/>`);
      if (k < 2) {
        z(`<rect x="${r(cx - w + 9)}" y="${r(y - 2)}" width="${r(2 * w - 18)}" height="11" fill="${F.fuell}" stroke="${F.linie}" stroke-width="2.4"/>`);
      } else {
        text(cx, y + 10, "Lücke", 14, F.rot, "middle");
      }
    } else if (s === "stab") {
      const n = 5;
      for (let m = 0; m < n; m++) {
        kreis(cx - w + ((2 * w) / (n - 1)) * m, y, 6, F.fuellTief, F.linie, 2.4);
      }
    } else if (s === "klinge") {
      const h = [26, 18, 9][k];
      pfad(
        glatt([
          [cx - w, y],
          [cx - w * 0.3, y + h],
          [cx + w * 0.3, y + h],
          [cx + w, y],
          [cx + w * 0.3, y - h],
          [cx - w * 0.3, y - h],
        ], true),
        F.fuellTief,
        F.linie,
        3
      );
    } else if (s === "pfanne") {
      pfad(
        eckig([
          [cx - w, y - 16],
          [cx - w, y + 6],
          [cx + w, y + 6],
          [cx + w, y - 16],
        ]),
        "none",
        F.linie,
        5
      );
    }

    text(cx, y + 56, ["nahe Ferse", "Mitte", "nahe Spitze"][k], 15, F.grau, "middle");
  });

  // Ein Wort dazu, was der Schnitt eigentlich sagt.
  const wort = {
    trog: "tiefer U-Trog, Ränder hochgestellt",
    halbtrog: "flacherer Trog, Rand fällt zur Spitze ab",
    kasten: "geschlossenes Kastenprofil, vier Bleche",
    kant: "gekantetes V mit zwei geraden Feldern",
    rippe: "zwei Wangen, Rippe — dann Luft",
    stab: "fünf Stäbe, sonst nichts",
    klinge: "massive Klinge, kein Hohlraum",
    pfanne: "flache Pfanne mit niedrigem Bord",
  }[form.schnitt];
  text(x0 + 22, Y.schnittNull + 86, wort, 16, F.linie);
}

/* ------------------------------------- Die Bolzenaufnahme (Vergrößerung) */

/**
 * Das ist die Stelle, an der man sieht, ob etwas konstruiert oder zurechtgebogen
 * ist. Bei uns ist die Aufnahme ein Loch in einem Blech. An echten Geräten ist
 * sie ein eigenes Bauteil: Buchse, Augscheiben, Gabel, Guss — mit Kragen,
 * Schmiernippel und Sicherungsblech.
 */
function lagerauge(i, form) {
  const x0 = RAND + i * SP_B;
  bandBeschr(i, Y.augeBeschr, "4 · Die Bolzenaufnahme, 2,5-fach");

  const cx = x0 + 160;
  const cy = Y.augeNull;
  const R = 0.055 * PX_D; // Bolzenradius 5,5 cm → 27,5 px
  const art = form.auge;

  // Beschriftungstexte je Bauart, rechts neben der Zeichnung.
  const legenden = {
    augscheiben: [
      "zweischnittig",
      "zwei aufgeschweißte",
      "Augscheiben, Buchse",
      "eingepresst, Kragen",
      "Schmiernippel seitlich",
      "Sicherungsblech geschraubt",
    ],
    wangenauge: [
      "zweischnittig",
      "die Seitenwangen SELBST",
      "laufen nach hinten aus",
      "und bilden das Auge —",
      "kein Zusatzblech, dafür",
      "ein Kragen ums Loch",
    ],
    gabel: [
      "zweischnittig, Gabel",
      "der Kasten endet in zwei",
      "Wangen und umgreift EINE",
      "Nase der Nabe",
      "Fett durch den Bolzen",
      "(axiale Bohrung)",
    ],
    einschnittig: [
      "einschnittig, umgekehrt",
      "EIN dickes Blech mit",
      "aufgeschweißter Nabe,",
      "beidseitig überstehend,",
      "läuft zwischen zwei",
      "Wangen der Nabe",
    ],
    querrohr: [
      "zweischnittig, Querrohr",
      "ein Rohrstück quer zwischen",
      "die beiden Wangen geschweißt",
      "= eine durchgehende lange",
      "Buchse, Fett aus der Mitte",
      "breite Auflage, wenig Pressung",
    ],
    guss: [
      "Auge im vollen Guss",
      "ein Guss- oder Schmiedeblock;",
      "alle fünf Stäbe laufen in",
      "ihn hinein und sind dort",
      "verschweißt. Kragen umlaufend,",
      "keine Blechnaht sichtbar",
    ],
    schmiede: [
      "geschmiedete Gabel",
      "ein Stück, ein breites Auge,",
      "gehärtete Buchse, Übergang",
      "fließend — man sieht keine",
      "Naht. Bolzen mit Schmier-",
      "bohrung, Fett von der Stirn",
    ],
    kastenferse: [
      "zweischnittig, Kastenferse",
      "der Rückenkasten trägt beide",
      "Augen; das zweite sitzt OBEN",
      "AUF dem Kasten. Dahinter ein",
      "Anschlagnocken gegen den",
      "Endanschlag der Nabe",
    ],
  }[art];

  // --- Zeichnen ---------------------------------------------------------
  // Gemeinsam: der Schalenrücken läuft von rechts unten in die Ferse.
  const ruecken = [
    [cx + 128, cy + 150],
    [cx + 70, cy + 96],
    [cx + 26, cy + 44],
  ];

  if (art === "augscheiben") {
    // Ferse läuft breit aus, zwei runde Augscheiben aufgeschweißt.
    pfad(
      glatt([
        [cx + 132, cy + 158],
        [cx + 62, cy + 100],
        [cx + 10, cy + 40],
        [cx - 40, cy + 6],
        [cx - 52, cy - 34],
        [cx - 16, cy - 60],
        [cx + 40, cy - 40],
        [cx + 96, cy + 46],
        [cx + 150, cy + 130],
      ], true),
      F.fuell,
      F.stahl,
      2.2
    );
    kreis(cx, cy, R + 30, F.fuellTief, F.linie, 2.4); // Augscheibe
    kreis(cx, cy, R + 12, F.feld, F.linie, 2); // Buchse
    kreis(cx, cy, R, F.papier, F.linie, 2.4); // Bolzenloch
    // Schweißnaht als Kettenlinie um die Augscheibe.
    z(`<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(R + 34)}" fill="none" stroke="${F.rot}" stroke-width="2" stroke-dasharray="3 5"/>`);
    text(cx - R - 40, cy - R - 32, "Naht", 14, F.rot, "end");
    // Schmiernippel.
    linie(cx - R - 12, cy + 30, cx - R - 34, cy + 48, F.linie, 3);
    kreis(cx - R - 38, cy + 52, 5, F.feld, F.linie, 2);
    text(cx - R - 46, cy + 68, "Nippel", 14, F.grau, "end");
    // Sicherungsblech.
    z(`<rect x="${r(cx - 14)}" y="${r(cy - R - 46)}" width="28" height="16" fill="${F.feld}" stroke="${F.linie}" stroke-width="2"/>`);
    text(cx + 24, cy - R - 34, "Sicherungsblech", 14, F.grau);
  } else if (art === "wangenauge") {
    pfad(
      glatt([
        [cx + 140, cy + 150],
        [cx + 70, cy + 96],
        [cx + 16, cy + 44],
        [cx - 34, cy + 12],
        [cx - 46, cy - 28],
        [cx - 12, cy - 54],
        [cx + 44, cy - 30],
        [cx + 104, cy + 48],
        [cx + 158, cy + 126],
      ], true),
      F.fuell,
      F.stahl,
      2.2
    );
    kreis(cx, cy, R + 16, F.feld, F.linie, 2.6); // Kragen
    kreis(cx, cy, R, F.papier, F.linie, 2.4);
    text(cx + R + 24, cy - 8, "Kragen", 14, F.grau);
    // Rippe auf dem Rücken.
    pfad(eckig([[cx + 30, cy + 34], [cx + 96, cy + 100], [cx + 88, cy + 112], [cx + 22, cy + 46]], true), F.fuellTief, F.linie, 2);
    text(cx + 84, cy + 132, "Rippe auf dem Rücken", 14, F.grau, "middle");
    linie(cx - R - 8, cy + 26, cx - R - 30, cy + 44, F.linie, 3);
    kreis(cx - R - 34, cy + 48, 5, F.feld, F.linie, 2);
  } else if (art === "gabel") {
    // Zwei Wangen (Gabel) — von vorn gezeichnet, damit man die Scherflächen sieht.
    for (const dy of [-46, 46]) {
      z(`<rect x="${r(cx - 44)}" y="${r(cy + dy - 17)}" width="150" height="34" fill="${F.fuell}" stroke="${F.stahl}" stroke-width="2.2" rx="6"/>`);
      kreis(cx, cy + dy, R + 13, F.feld, F.linie, 2);
      kreis(cx, cy + dy, R, F.papier, F.linie, 2.4);
    }
    // Die Nase der Nabe dazwischen.
    z(`<rect x="${r(cx - 70)}" y="${r(cy - 26)}" width="96" height="52" fill="${F.band}" stroke="${F.blau}" stroke-width="2.2" rx="6"/>`);
    kreis(cx, cy, R, F.papier, F.blau, 2.4);
    text(cx - 74, cy + 4, "Nabe", 14, F.blau, "end");
    // Der Bolzen quer hindurch.
    linie(cx, cy - 80, cx, cy + 80, F.rot, 3.5);
    text(cx + 8, cy - 100, "Bolzen, 2 Scherflächen", 14, F.rot);
    text(cx + 112, cy - 46, "Wange", 14, F.grau);
    text(cx + 112, cy + 52, "Wange", 14, F.grau);
  } else if (art === "einschnittig") {
    // Ein Blech mit aufgeschweißter Nabe, zwischen zwei Wangen der Gegenseite.
    z(`<rect x="${r(cx - 44)}" y="${r(cy - 19)}" width="160" height="38" fill="${F.fuell}" stroke="${F.stahl}" stroke-width="2.2" rx="6"/>`);
    // Der Buchsenstutzen steht beidseitig über.
    z(`<rect x="${r(cx - 28)}" y="${r(cy - 34)}" width="56" height="68" fill="${F.fuellTief}" stroke="${F.linie}" stroke-width="2.4" rx="8"/>`);
    kreis(cx, cy, R, F.papier, F.linie, 2.4);
    text(cx + 40, cy - 40, "Nabe steht über", 14, F.grau);
    for (const dy of [-58, 58]) {
      z(`<rect x="${r(cx - 92)}" y="${r(cy + dy - 15)}" width="120" height="30" fill="${F.band}" stroke="${F.blau}" stroke-width="2" rx="6"/>`);
      kreis(cx, cy + dy, R, F.papier, F.blau, 2.2);
    }
    linie(cx, cy - 92, cx, cy + 92, F.rot, 3.5);
    text(cx + 8, cy - 112, "Schale trägt in der MITTE", 14, F.rot);
    text(cx - 96, cy - 62, "Nabe", 14, F.blau, "end");
  } else if (art === "querrohr") {
    for (const dy of [-50, 50]) {
      z(`<rect x="${r(cx - 46)}" y="${r(cy + dy - 9)}" width="160" height="18" fill="${F.fuellTief}" stroke="${F.stahl}" stroke-width="2.2"/>`);
    }
    // Das Rohr zwischen den Wangen.
    z(`<rect x="${r(cx - R - 16)}" y="${r(cy - 50)}" width="${r(2 * R + 32)}" height="100" fill="${F.feld}" stroke="${F.linie}" stroke-width="2.6"/>`);
    z(`<rect x="${r(cx - R)}" y="${r(cy - 50)}" width="${r(2 * R)}" height="100" fill="${F.papier}" stroke="${F.linie}" stroke-width="2"/>`);
    text(cx + R + 26, cy - 54, "Rohr = eine lange Buchse", 14, F.grau);
    // Fett aus der Mitte.
    linie(cx + R + 16, cy, cx + R + 46, cy, F.linie, 3);
    kreis(cx + R + 50, cy, 5, F.feld, F.linie, 2);
    text(cx + R + 58, cy + 5, "Fett aus der Mitte", 14, F.grau);
    linie(cx, cy - 84, cx, cy + 84, F.rot, 3.5);
    text(cx - 60, cy - 66, "Wange", 14, F.grau, "end");
  } else if (art === "guss") {
    // Ein Klotz, in den die Stäbe hineinlaufen.
    pfad(
      glatt([
        [cx - 54, cy - 26],
        [cx - 16, cy - 58],
        [cx + 40, cy - 44],
        [cx + 58, cy + 6],
        [cx + 36, cy + 56],
        [cx - 18, cy + 62],
        [cx - 56, cy + 26],
      ], true),
      F.fuellTief,
      F.stahl,
      2.6
    );
    kreis(cx, cy, R + 14, F.feld, F.linie, 2.4);
    kreis(cx, cy, R, F.papier, F.linie, 2.4);
    // Fünf Stäbe laufen hinein.
    for (let k = 0; k < 5; k++) {
      const a = -0.45 + k * 0.28;
      linie(cx + 40 * Math.cos(a), cy + 40 * Math.sin(a), cx + 150 * Math.cos(a) + 20, cy + 150 * Math.sin(a) + 60, F.stahl, 5);
    }
    text(cx + 66, cy - 52, "Guss-/Schmiedeblock", 14, F.grau);
    text(cx + 110, cy + 128, "Stäbe laufen hinein", 14, F.grau, "middle");
  } else if (art === "schmiede") {
    // Geschmiedete Gabel: fließender Übergang, ein breites Auge.
    pfad(
      glatt([
        [cx + 150, cy + 150],
        [cx + 74, cy + 84],
        [cx + 18, cy + 40],
        [cx - 42, cy + 18],
        [cx - 62, cy - 24],
        [cx - 24, cy - 62],
        [cx + 34, cy - 50],
        [cx + 86, cy + 26],
        [cx + 166, cy + 124],
      ], true),
      F.fuell,
      F.stahl,
      2.6
    );
    kreis(cx, cy, R + 18, F.feld, F.linie, 2.2);
    kreis(cx, cy, R, F.papier, F.linie, 2.4);
    // Fett von der Stirn durch den Bolzen.
    linie(cx, cy, cx + 0, cy - R - 40, F.rot, 2.4, "5 4");
    kreis(cx, cy - R - 44, 5, F.feld, F.rot, 2);
    text(cx + 10, cy - R - 48, "Bolzen mit Bohrung", 14, F.rot);
    text(cx + 84, cy + 112, "keine Naht — ein Stück", 14, F.grau, "middle");
  } else if (art === "kastenferse") {
    // Rückenkasten, zwei Augen, Anschlagnocken.
    pfad(
      eckig([
        [cx + 146, cy + 148],
        [cx + 14, cy + 40],
        [cx - 52, cy + 24],
        [cx - 58, cy - 34],
        [cx - 4, cy - 56],
        [cx + 52, cy - 14],
        [cx + 170, cy + 122],
      ], true),
      F.fuell,
      F.stahl,
      2.4
    );
    kreis(cx, cy, R + 15, F.fuellTief, F.linie, 2.2);
    kreis(cx, cy, R, F.papier, F.linie, 2.4);
    // Anschlagnocken hinter dem Auge.
    pfad(eckig([[cx - 58, cy - 34], [cx - 84, cy - 52], [cx - 80, cy - 14], [cx - 52, cy + 24]], true), F.fuellTief, F.rot, 2.4);
    text(cx - 90, cy - 58, "Anschlagnocken", 14, F.rot, "end");
    z(`<rect x="${r(cx - 16)}" y="${r(cy - R - 46)}" width="32" height="16" fill="${F.feld}" stroke="${F.linie}" stroke-width="2"/>`);
    text(cx + 22, cy - R - 34, "Sicherungsblech", 14, F.grau);
    linie(cx + 34, cy + 30, cx + 56, cy + 48, F.linie, 3);
    kreis(cx + 60, cy + 52, 5, F.feld, F.linie, 2);
  }

  // Das zweite Auge (Zylinder bzw. Lasche) — überall, in der jeweiligen Lage.
  const [zax, zay] = form.zweitauge;
  // Faktor 1,0: bei 0,55 lag der Marker beim ersten Entwurf MITTEN auf der
  // Augscheibe und verdeckte genau die Stelle, die das Bild zeigen soll.
  const zx = cx + zax * PX_D;
  // Nach oben gedeckelt, sonst stößt der Marker durch das Beschriftungsband.
  const zy = cy + Math.max(-0.2, zay) * PX_D;
  kreis(zx, zy, 15, F.feld, F.blau, 2.4);
  kreis(zx, zy, 6, F.blau, F.blau, 1);
  linie(cx, cy, zx, zy, F.blau, 1.6, "4 4");
  text(zx + 20, zy + 5, "2. Auge", 14, F.blau);

  /**
   * DIE LÜCKE AM SCHALENDREHPUNKT. Sennebogen zur MG4.1: Die Anbindung der
   * Greiferschalen an den Mittelbalken lässt am Schalendrehpunkt genügend
   * Platz, damit Kleinmaterial durchfallen kann. Das ist genau die Stelle, auf
   * die Patrick zeigt — und sie ist kein Versehen, sondern Absicht. Die Lücke
   * ist bei jeder Bauart anders groß und sitzt woanders; deshalb steht sie hier
   * je Form in der Vergrößerung und nicht einmal allgemein am Blattrand.
   *
   * ABSICHTLICH OHNE ZENTIMETERANGABE. Die Quellen nennen den ZWECK der Lücke,
   * kein Maß. Eine Zahl, die ich aus meiner eigenen Skizze abgreife, wäre genau
   * die Sorte hergeleitete Zahl, die Patrick auf diesem Blatt nicht sehen will.
   * Die Zeichnung zeigt die Weite im Verhältnis, das Wort in der Legende sagt,
   * ob dort etwas durchläuft.
   */
  const sp = form.spalt;
  if (sp.art === "seite") {
    // Mittelbalken links, Schale rechts, die Lücke dazwischen.
    const x2 = cx + sp.bis;
    const x1 = x2 - sp.weite;
    z(
      `<rect x="${r(x1 - 86)}" y="${r(cy - 64)}" width="86" height="126" fill="${F.band}" ` +
        `stroke="${F.blau}" stroke-width="2" stroke-dasharray="7 5" rx="5"/>`
    );
    text(x1 - 43, cy - 74, "Mittelbalken", 14, F.blau, "middle");
    const yy = cy + 22;
    linie(x1, yy - 42, x1, yy + 48, F.rot, 2, "5 4");
    linie(x1, yy, x2, yy, F.rot, 2.6);
    linie(x1, yy - 7, x1, yy + 7, F.rot, 2.6);
    linie(x2, yy - 7, x2, yy + 7, F.rot, 2.6);
    // Der Wortzeiger UNTER den Pfeil: über ihm sitzt bei jeder Bauart das
    // Lagerauge, und dort war der Text beim ersten Entwurf nicht lesbar.
    text((x1 + x2) / 2, yy + 17, "Spalt", 14, F.rot, "middle", true);
    // Kleinmaterial, das hier durchfällt.
    for (let k = 0; k < 3; k++) {
      kreis(x1 + sp.weite / 2 - 3 + k * 5, yy + 34 + k * 15, 3.2, F.rot, F.rot, 1);
    }
    text(x1 + 2, yy + 92, "fällt durch", 14, F.rot);
  } else if (sp.art === "front") {
    // Die Lücke liegt entlang der Bolzenachse, zwischen Schale und Nabe.
    const x1 = cx - 96;
    for (const [a, b] of sp.paare) {
      linie(x1, cy + a, x1, cy + b, F.rot, 2.8);
      linie(x1 - 8, cy + a, x1 + 8, cy + a, F.rot, 2.6);
      linie(x1 - 8, cy + b, x1 + 8, cy + b, F.rot, 2.6);
    }
    text(x1 - 12, cy + 4, "Spalt", 14, F.rot, "end", true);
    text(cx - 60, cy + 104, "hier fällt Kleinzeug durch", 14, F.rot, "middle");
  } else if (sp.art === "rund") {
    z(`<circle cx="${r(cx)}" cy="${r(cy)}" r="88" fill="none" stroke="${F.rot}" stroke-width="2.4" stroke-dasharray="8 7"/>`);
    text(cx - 96, cy - 84, "ringsum offen", 14, F.rot, "start", true);
  }

  // Legende — UNTER der Zeichnung. Daneben stand sie beim ersten Entwurf mitten
  // im Bauteil; man konnte weder den Text noch das Auge lesen.
  let ty = Y.augeText;
  text(x0 + 22, ty, legenden[0], 18, F.linie, "start", true);
  for (let k = 1; k < legenden.length; k++) {
    ty += 22;
    text(x0 + 22, ty, legenden[k], 16, F.grau);
  }

  // Die Lücke am Drehpunkt, in Worten — je Bauart eine andere Antwort.
  const sw = form.spaltWort.split(" ");
  const zeilen2 = [];
  let cur = "";
  for (const w of sw) {
    if ((cur + " " + w).trim().length > 54) { zeilen2.push(cur.trim()); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) zeilen2.push(cur);
  zeilen2.forEach((zl, k) => text(x0 + 22, Y.augeSpalt + k * 20, zl, 15, F.rot));
}

/* ------------------------------------------- Fünf Schalen im Kreis (Korb) */

function kranz(i, form) {
  const x0 = RAND + i * SP_B;
  bandBeschr(i, Y.kranzBeschr, "5 · Fünf im Kreis geschlossen");

  const cx = x0 + SP_B / 2;
  const cy = Y.kranzNull;
  const R = 0.78 * PX_K;
  const art = form.kranz;

  kreis(cx, cy, 8, F.feld, F.hilfe, 1.6);
  z(`<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(R)}" fill="none" stroke="${F.hilfe}" stroke-width="1.2" stroke-dasharray="4 6"/>`);

  /** Ein Bogenband von Winkel a1 bis a2 auf Radius R, Dicke t. */
  function bogen(a1, a2, t, fuell, farbe, breite) {
    const n = 16;
    const aussen = [];
    const innen = [];
    for (let k = 0; k <= n; k++) {
      const a = a1 + ((a2 - a1) * k) / n;
      aussen.push([cx + Math.cos(a) * (R + t / 2), cy + Math.sin(a) * (R + t / 2)]);
      innen.push([cx + Math.cos(a) * (R - t / 2), cy + Math.sin(a) * (R - t / 2)]);
    }
    pfad(eckig([...aussen, ...innen.reverse()], true), fuell, farbe, breite);
  }

  const S = (Math.PI * 2) / 5;
  for (let k = 0; k < 5; k++) {
    const m = -Math.PI / 2 + k * S;
    if (art === "voll") {
      bogen(m - S / 2 + 0.008, m + S / 2 - 0.008, 15, F.fuell, F.stahl, 2);
    } else if (art === "halb") {
      bogen(m - S / 2 + 0.13, m + S / 2 - 0.13, 13, F.fuell, F.stahl, 2);
    } else if (art === "spitz") {
      bogen(m - 0.12, m + 0.12, 26, F.fuellTief, F.stahl, 2);
    } else if (art === "knick") {
      // Gekantet: zwei Sehnen statt eines Bogens.
      const a1 = m - S / 2 + 0.06;
      const a2 = m + S / 2 - 0.06;
      const p = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      // Ecken auf R, Mitte auf R·cos36° = 0,81·R — das ist genau ein Fünfeck.
      // Beim ersten Entwurf standen die Ecken auf R+7 und es sah aus wie ein
      // Stern statt wie ein Korb.
      pfad(
        eckig([p(a1, R), p(m, R - 16), p(a2, R), p(a2, R - 13), p(m, R - 29), p(a1, R - 13)], true),
        F.fuell,
        F.stahl,
        2
      );
    } else if (art === "rippe") {
      bogen(m - S / 2 + 0.05, m - S / 2 + 0.11, 30, F.fuellTief, F.linie, 1.8);
      bogen(m + S / 2 - 0.11, m + S / 2 - 0.05, 30, F.fuellTief, F.linie, 1.8);
      for (const f of [-0.28, 0, 0.28]) bogen(m + f - 0.05, m + f + 0.05, 13, F.fuell, F.linie, 1.6);
    } else if (art === "gitter") {
      for (let q = 0; q < 5; q++) {
        const a = m - S / 2 + 0.1 + (q * (S - 0.2)) / 4;
        kreis(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, F.fuellTief, F.linie, 2);
      }
    } else if (art === "sichel") {
      // Sichel läuft am Nachbarn VORBEI: der Bogen reicht über das eigene Feld hinaus.
      bogen(m - 0.1, m + S * 0.72, 11, F.fuell, F.stahl, 2);
    } else if (art === "zahn") {
      const a1 = m - S / 2 + 0.05;
      const a2 = m + S / 2 - 0.05;
      const p = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
      pfad(eckig([p(a1, R + 9), p(a2, R + 9), p(a2, R - 5), p(a1, R - 5)], true), F.fuell, F.stahl, 2);
      for (const e of [a1, a2]) {
        pfad(eckig([p(e, R - 5), p(e + (e === a1 ? -0.09 : 0.09), R - 16), p(e, R - 20)], true), F.fuellTief, F.linie, 1.6);
      }
    }
  }

  const wort = {
    voll: "geschlossener Ring — hält Sand",
    halb: "fünf Spalten am Saum",
    spitz: "ein Käfig aus Spitzen, fast offen",
    knick: "Fünfeck statt Kreis",
    rippe: "ringsum geschlitzt",
    gitter: "25 Stäbe, sehr offen",
    sichel: "sie treffen sich nicht, sie kreuzen",
    zahn: "Fünfeck, Zähne kämmen am Stoß",
  }[art];
  text(cx, cy + R + 44, wort, 16, F.linie, "middle");
}

/* ================================================================ Bauen */

FORMEN.forEach((form, i) => {
  const x0 = RAND + i * SP_B;

  // Kopf der Spalte.
  z(`<rect x="${r(x0 + 22)}" y="${r(Y.kopf - 40)}" width="52" height="52" fill="${F.linie}" rx="8"/>`);
  text(x0 + 48, Y.kopf, form.b, 36, F.feld, "middle", true);
  text(x0 + 88, Y.kopf - 12, form.name, 24, F.linie, "start", true);
  text(x0 + 88, Y.kopf + 12, form.unter, 19, F.grau);
  // Was ich an einer Schrottquelle NICHT belegen konnte, steht als Warnung dran.
  if (form.unbelegt) {
    z(`<rect x="${r(x0 + 22)}" y="${r(Y.kopf + 24)}" width="${SP_B - 44}" height="30" fill="#f6e7e3" stroke="${F.rot}" stroke-width="2" rx="6"/>`);
    text(x0 + 32, Y.kopf + 45, `⚠ ${form.unbelegt} — nur für Leicht- und Schüttgut gefunden`, 15, F.rot, "start", true);
  }

  seitenriss(i, form);
  vorderansicht(i, form);
  querschnitte(i, form);
  lagerauge(i, form);
  kranz(i, form);

  // Die Zeile Text.
  linie(x0 + 22, Y.text - 24, x0 + SP_B - 22, Y.text - 24, F.band, 2);
  form.zeilen.forEach((zeile, k) => {
    text(x0 + 22, Y.text + k * 22, zeile, 16, F.linie);
  });
});

/* Fuß: Quellen als Text, wie es das Urheberrecht verlangt. */
const fussY = HOEHE - 52;
linie(RAND, fussY - 22, BREITE - RAND, fussY - 22, F.band, 2);
text(
  RAND,
  fussY,
  "Recherche 16.09.2026, zweiter Durchgang nach Patentrissen. Quellen als Text (keine Fremdbilder, keine langen Zitate). PATENTE: DE 31 31 624 A1 (Bewegungsmuster der Schalenschneiden — der Kasten oben) · US 2012/0299321 A1 (Orangenschalengreifer, Zinkenwinkel) · US 7,000,339 (universeller Zinken, U- bzw. Kastenprofil, Rückenblech/Seitenbleche/Verschleißstreifen/Spitze) · DE 197 49 848 A1 (Zweischalengreifer: U-förmige Aufnahmen, Bolzen zweischnittig) · US 1,145,220 (1915: Arm ZWEITEILIG, umgreift die Nasen; Lasche in der Armmitte). " +
    "HERSTELLER: Kinshofer P-Reihe F/H/W/T und KM 651/652/653 · Sennebogen MG4.1 — Mitteltraverse aus Stahlguss, Schalen in Hardox-Schweißkonstruktion, Spitzen aus Schmiedestahl, und am Schalendrehpunkt bleibt Platz, damit Kleinmaterial durchfällt · Bateman B5T — offen / halb geschlossen (Standard) / voll geschlossen, verstärkte Rücken, Verschleißstreifen, angeschweißte Wechselspitzen · " +
    "Idrobenne, geschlossen/halb/offen, Hardox-Zinken, Buchsen mit Fettspirale · HS Schoch, Abbruch- und Sortiergreifer in Rippen- oder Langlochschalenblech, gezackte Seitenwangen, Zähne oder U-Messer · Genesis, Kastenzinken mit versenkten Nähten · Rotobec/Hultdins, Holzgreifer mit bypassenden Sichelbacken.",
  16,
  F.grau
);
text(
  RAND,
  fussY + 22,
  "Gezeichnet mit tools/schalen-vorbilder.mjs — frei von jeder Randbedingung unserer Konstruktion. Kein Bolzenkreis, keine Zylinderneigung, kein Hebelarm, keine Maulweite geprüft, keine Empfehlung. Die 25,2 cm im Kasten oben sind aus E-065 zitiert, nicht hier gerechnet. Ob eine Form bei uns baubar ist, wird erst gerechnet, wenn eine ausgesucht ist.",
  16,
  F.grau
);

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" viewBox="0 0 ${BREITE} ${HOEHE}">` +
  teile.join("") +
  `</svg>\n`;

const ziel = join(fileURLToPath(new URL("../docs", import.meta.url)), "schalen-vorbilder-2026-09-16.svg");
writeFileSync(ziel, svg, "utf8");
console.log(`geschrieben: docs/schalen-vorbilder-2026-09-16.svg (${(svg.length / 1024).toFixed(0)} kB, ${BREITE}×${HOEHE})`);
