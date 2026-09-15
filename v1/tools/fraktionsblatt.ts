/**
 * Das Fraktionsblatt — ein Blatt, auf dem man SIEHT, was wohin gehoert.
 *
 * Anlass (Patrick, 15.09.2026, nach dem Geraetetest): „Es ist nicht wirklich
 * erkennbar, was Stahlschrott ist und was Mischschrott ist. Auch die
 * Kategorisierung ist mir nicht ganz bewusst."
 *
 * Jede Farbe, jede Zahl und jedes Beispiel auf diesem Blatt wird aus dem
 * Quelltext GELESEN, nicht abgeschrieben: `MATERIALS` fuer Farbe und Preis,
 * `SPECS`/`KATALOG_*` fuer die Beispiele und ihre abgeleitete Fraktion,
 * `CONFIGS` fuer das Ziel. Aendert jemand einen Preis, aendert sich das Blatt
 * beim naechsten Lauf mit. Ein Blatt, das man von Hand pflegt, ist nach einer
 * Woche falsch.
 *
 * MASSE. Breite 820 Einheiten, nicht 1760 wie die aelteren Plaene. Patrick
 * schaut das auf dem iPhone in der Planmappe an; ein 1760 breites Blatt auf
 * einem 390 px breiten Schirm bildet 11-px-Text auf 2,4 px ab. Bei 820 wird
 * aus Schriftgroesse 30 rund 14 px — lesbar ohne Zoom.
 *
 * Erzeugen, aus `v1/`:
 *
 *     npx vite-node tools/fraktionsblatt-schreiben.ts
 */
import { MATERIALS } from "../src/materials/catalog";
import { SORTENREIN_AB } from "../src/materials/purity";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { deltaEHex } from "./farbabstand";

const W = 820;
const RAND = 34;
const SCHRIFT = "Helvetica,Arial,sans-serif";

const PAPIER = "#FBFAF7";
const TINTE = "#1F2326";
const GRAU = "#6E7377";
const LINIE = "#D8D4CC";
const WARN = "#B4342A";

function hex(c: number): string {
  return "#" + c.toString(16).padStart(6, "0");
}

/** Deutsche Schreibweise: Komma statt Punkt, echtes Minus statt Bindestrich. */
function komma(n: number, stellen: number): string {
  return n.toFixed(stellen).replace(".", ",").replace(/^-/, "−");
}

/** Ist eine Farbe so dunkel, dass weisse Schrift daraufpasst? */
function dunkel(c: number): boolean {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Geschaetzte Breite einer Zeile in SVG-Einheiten.
 *
 * Ein SVG kennt seine Schriftbreiten nicht, solange es niemand darstellt —
 * darum die Schaetzung. 0,54 bzw. 0,60 der Schriftgroesse je Zeichen ist der
 * Mittelwert von Helvetica; sie faellt eher zu gross aus, und genau das soll
 * sie: Ein Blatt, auf dem eine Zeile aus dem Rand laeuft, ist auf dem Telefon
 * abgeschnitten, und dann fehlt genau die Auskunft, wegen der man hinsieht.
 */
function breite(t: string, groesse: number, fett = false): number {
  return t.length * groesse * (fett ? 0.6 : 0.54);
}

/** Zeile so weit kuerzen, dass sie in `platz` passt. */
function kuerze(t: string, groesse: number, platz: number, fett = false): string {
  if (breite(t, groesse, fett) <= platz) return t;
  const maxZeichen = Math.max(1, Math.floor(platz / (groesse * (fett ? 0.6 : 0.54))) - 1);
  return t.slice(0, maxZeichen).trimEnd() + "…";
}

interface Zeichner {
  s: string[];
  y: number;
}

function text(
  z: Zeichner,
  x: number,
  y: number,
  t: string,
  groesse: number,
  farbe = TINTE,
  fett = false,
  anker: "start" | "middle" | "end" = "start"
): void {
  z.s.push(
    `<text x="${x}" y="${y}" font-family="${SCHRIFT}" font-size="${groesse}" ` +
      `font-weight="${fett ? 700 : 400}" fill="${farbe}" text-anchor="${anker}">${esc(t)}</text>`
  );
}

function kasten(z: Zeichner, x: number, y: number, w: number, h: number, fuell: string, rand?: string, r = 8): void {
  z.s.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fuell}"` +
      (rand ? ` stroke="${rand}" stroke-width="2"` : "") +
      `/>`
  );
}

/** Alle Katalogeintraege, die von aussen erreichbar sind. */
function alleSpecs(): PileSpec[] {
  return [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE];
}

/**
 * Beispiele einer Fraktion, so viele wie in `platz` passen.
 *
 * Kurze Namen zuerst — nicht aus Bequemlichkeit, sondern weil „Felge" auf dem
 * Telefon in einer Zeile steht und „U-Bahn-Drehgestell (angetrieben)" nicht.
 * Wer drei Beispiele lesen kann, hat mehr davon als wer eines abgeschnitten
 * sieht.
 */
function beispiele(fraktion: string, platz: number, groesse: number): string[] {
  const namen = alleSpecs()
    .filter((s) => s.materialId === fraktion && s.name)
    .map((s) => s.name!)
    .filter((name, i, arr) => arr.indexOf(name) === i)
    .sort((a, b) => a.length - b.length);
  const raus: string[] = [];
  for (const n of namen) {
    if (raus.length >= 3) break;
    const probe = [...raus, n].join(", ");
    if (breite(probe, groesse) > platz) break;
    raus.push(n);
  }
  return raus;
}

/** Wohin diese Fraktion darf — die Beschriftungen der Behaelter. */
function ziele(fraktion: string): string {
  const z = CONFIGS.filter((c) => gehoertHierhin(c, fraktion)).map((c) => c.label);
  return z.length > 0 ? z.join("  ·  ") : "kein Behaelter";
}

export function zeichneFraktionsblatt(): string {
  const z: Zeichner = { s: [], y: 0 };
  let y = 0;

  /* --------------------------------------------------------- Titelkopf --- */
  y = 76;
  text(z, RAND, y, "WAS GEHÖRT WOHIN", 54, TINTE, true);
  y += 34;
  text(z, RAND, y, "Rust'n'Reibach v1 · Stand 15.09.2026", 26, GRAU);
  y += 30;
  text(z, RAND, y, "Farben und Preise aus dem Quelltext gelesen.", 26, GRAU);

  /* ------------------------------------------------------------ Regel --- */
  y += 46;
  const regelH = 178;
  kasten(z, RAND, y, W - 2 * RAND, regelH, "#F0EDE6", LINIE);
  let ry = y + 50;
  text(z, RAND + 24, ry, "DIE REGEL", 30, TINTE, true);
  ry += 44;
  text(z, RAND + 24, ry, `Sortenrein ist ein Teil ab ${Math.round(SORTENREIN_AB * 100)} %`, 34, TINTE, true);
  ry += 40;
  text(z, RAND + 24, ry, "eines Stoffes. Alles darunter ist", 34, TINTE, true);
  ry += 40;
  text(z, RAND + 24, ry, "MISCHSCHROTT — auch bei 94 % Stahl.", 34, WARN, true);
  y += regelH + 40;

  /* ---------------------------------------- Stahl gegen Mischschrott ---- */
  text(z, RAND, y, "STAHLSCHROTT ODER MISCHSCHROTT?", 32, TINTE, true);
  y += 38;
  const st = MATERIALS.steel!;
  const mi = MATERIALS.mixed!;
  const feldB = (W - 2 * RAND - 20) / 2;
  const feldH = 132;
  for (const [i, m] of [st, mi].entries()) {
    const x = RAND + i * (feldB + 20);
    kasten(z, x, y, feldB, feldH, hex(m.color), LINIE, 10);
    const fg = dunkel(m.color) ? "#FFFFFF" : TINTE;
    text(z, x + 18, y + 46, m.name.toUpperCase(), 30, fg, true);
    text(z, x + 18, y + 80, hex(m.color), 26, fg);
    text(z, x + 18, y + 112, `${Math.round(m.sellPricePerKg * 1000)} €/t`, 30, fg, true);
  }
  y += feldH + 34;
  const dSteelMixed = deltaEHex(st.color, mi.color);
  text(
    z,
    RAND,
    y,
    `Farbabstand der beiden: ΔE2000 = ${komma(dSteelMixed, 1)}`,
    28,
    TINTE,
    true
  );
  y += 32;
  text(z, RAND, y, "(unter 2 gilt als nicht unterscheidbar, unter 10 als", 26, GRAU);
  y += 28;
  text(z, RAND, y, "gleiche Farbe mit anderem Ton). Bei Abendlicht: 4,2.", 26, GRAU);
  y += 44;

  /* ------------------------------ Aber: die Teile tragen sie gar nicht -- */
  const alle = alleSpecs();
  const ohneBau = alle.filter((s) => !s.bau).length;
  const boxH = 250;
  kasten(z, RAND, y, W - 2 * RAND, boxH, "#FBEFEC", WARN);
  let by = y + 48;
  text(z, RAND + 24, by, "ABER: DIE TEILE TRAGEN SIE NICHT", 29, WARN, true);
  by += 42;
  text(z, RAND + 24, by, `${ohneBau} von ${alle.length} Teilen tragen die`, 32, TINTE);
  by += 38;
  text(z, RAND + 24, by, "Fraktionsfarbe. Alle anderen sind nach", 32, TINTE);
  by += 38;
  text(z, RAND + 24, by, "ZWECK gefärbt: weiß = Haushaltsgerät,", 32, TINTE);
  by += 38;
  text(z, RAND + 24, by, "blau = Container, grün = Landmaschine.", 32, TINTE);
  y += boxH + 44;

  /* ------------------------------------------- Gemessene Verwechslungen - */
  text(z, RAND, y, "GEMESSEN: SO NAH LIEGEN SIE", 32, TINTE, true);
  y += 36;
  text(z, RAND, y, "Flächengewichtete Mittelfarbe der gebauten Teile.", 26, GRAU);
  y += 34;
  /*
   * Die Werte stammen aus der Messung vom 15.09.2026 (siehe
   * docs/fraktionen.md, Abschnitt „Teil 2"). Sie hier neu zu rechnen hiesse,
   * `three` in dieses Blatt zu holen; die Zahlen stehen deshalb als Befund,
   * mit Datum und Quelle.
   */
  const paare: Array<[string, string, number, string, number, string, number]> = [
    ["Elektroherd", "Stahlschrott", 0xc8c6c1, "Waschmaschine", 0xc7c5c0, "Mischschrott", 0.18],
    ["Seecontainer", "Stahlschrott", 0x34577e, "Baustellencont.", 0x34577e, "Mischschrott", 0.0],
    ["Blech", "Stahlschrott", 0x67625c, "Motorblock V8", 0x696563, "Mischschrott", 2.55],
  ];
  for (const [n1, f1, c1, n2, c2, f2, d] of paare) {
    const h = 84;
    kasten(z, RAND, y, W - 2 * RAND, h, "#FFFFFF", LINIE, 8);
    kasten(z, RAND + 14, y + 14, 56, h - 28, hex(c1), LINIE, 4);
    kasten(z, RAND + 78, y + 14, 56, h - 28, hex(c2), LINIE, 4);
    text(z, RAND + 152, y + 34, `${n1} · ${n2}`, 27, TINTE, true);
    text(z, RAND + 152, y + 64, `${f1} / ${f2}`, 25, GRAU);
    text(z, W - RAND - 16, y + 52, `ΔE ${komma(d, 1)}`, 32, WARN, true, "end");
    y += h + 12;
  }
  y += 34;

  /* -------------------------------------------------- Die Fraktionen ---- */
  text(z, RAND, y, "ALLE FRAKTIONEN", 32, TINTE, true);
  y += 24;

  const reihenfolge = [
    "steel", "mixed", "va", "alu", "zinc", "copper", "brass", "cable",
    "battery", "wood", "tires", "rubble", "plastic",
  ];
  for (const id of reihenfolge) {
    const m = MATERIALS[id];
    if (!m) continue;
    const h = 122;
    y += 14;
    kasten(z, RAND, y, W - 2 * RAND, h, "#FFFFFF", LINIE, 8);
    // Farbfeld links — alle in einer Flucht, damit man die Abstaende sieht
    kasten(z, RAND + 14, y + 14, 96, h - 28, hex(m.color), LINIE, 6);
    const tx = RAND + 128;
    const platz = W - RAND - 16 - tx;
    const bsp = beispiele(id, platz, 25);
    const preisText = `${komma(Math.round(m.sellPricePerKg * 1000), 0)} €/t`;
    text(z, tx, y + 42, m.name, 34, TINTE, true);
    text(z, W - RAND - 16, y + 42, preisText, 32,
      m.sellPricePerKg < 0 ? WARN : TINTE, true, "end");
    text(z, tx, y + 74, kuerze("→ " + ziele(id), 25, platz), 25, GRAU);
    text(
      z,
      tx,
      y + 104,
      kuerze(bsp.length > 0 ? bsp.join(", ") : "(Teile ohne Namen)", 25, platz),
      25,
      GRAU
    );
    y += h;
  }

  /* ------------------------------------------------------ Was hilft ----- */
  y += 46;
  text(z, RAND, y, "WORAN MAN ES HEUTE ERKENNT", 32, TINTE, true);
  y += 40;
  for (const zeile of [
    "1. Anvisieren: die Zeile oben nennt Name,",
    "    Fraktion und Hauptmaterial. Der einzige",
    "    Ort im Spiel, an dem die Fraktion steht.",
    "2. Ampel am Muldenschild: grün = darf hinein.",
    "3. Sonst nichts. Kein Schild am Platz, kein",
    "    Menü, kein Tutorialschritt sagt es.",
  ]) {
    text(z, RAND, y, zeile, 29, TINTE);
    y += 36;
  }

  y += 30;
  text(z, RAND, y, "Gemessen am 15.09.2026 aus dem Quelltext des", 24, GRAU);
  y += 28;
  text(z, RAND, y, "Arbeitsstands. ΔE2000 nach CIE 142:2001,", 24, GRAU);
  y += 28;
  text(z, RAND, y, "Werkzeug gegen Sharma/Wu/Dalal (2005) geprüft.", 24, GRAU);
  y += 40;

  const H = Math.round(y);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n` +
    `<rect width="${W}" height="${H}" fill="${PAPIER}"/>\n` +
    z.s.join("\n") +
    `\n</svg>\n`
  );
}
