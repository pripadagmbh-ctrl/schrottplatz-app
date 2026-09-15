/**
 * Das Stahlschrott-Blatt — eine Seite, auf der man SIEHT, wo die Grenze liegt.
 *
 * Anlass (Patrick, 15.09.2026): „Ich möchte ein bisschen strenger werden, was
 * Stahlschrott ist. … Auch bei so Gitterboxen bin ich mir nicht sicher." Und
 * nach dem ersten Blick aufs Blatt: „LKW-Felge, sind gehärteter Stahl und
 * daher auf massiv setzen. Dicke Übersee-Container haben auch viel Masse, auch
 * wenn es dünnes Blech ist. Drum Stahl."
 *
 * Deshalb hat das Blatt **drei** Blöcke und nicht zwei: Was die Regel über die
 * Wandstärke holt, was von Hand auf massiv gesetzt ist — mit Begründung, damit
 * niemand es für Willkür hält —, und was Mischschrott wird.
 *
 * Jede Zahl wird gerechnet, keine ist getippt: Masse und Maß aus dem Katalog,
 * die Wandstärke aus `src/materials/purity.ts`. Ändert jemand ein Maß, ändert
 * sich das Blatt beim nächsten Lauf mit.
 *
 * MASSE. Breite 820 Einheiten wie beim Fraktionsblatt — Patrick schaut das auf
 * dem iPhone in der Planmappe an, und bei 820 wird aus Schriftgröße 30 rund
 * 14 px. Ein 1760 breites Blatt bildet 11-px-Text auf 2,4 px ab.
 *
 * Erzeugen, aus `v1/`:
 *
 *     npx vite-node tools/stahlschrott-blatt-schreiben.ts
 */
import { alleUrteile, WAND_AB_MM, aussenflaeche, type Urteil } from "./stahlschrott";

const W = 820;
const RAND = 30;
const SCHRIFT = "Helvetica,Arial,sans-serif";

const PAPIER = "#FBFAF7";
const TINTE = "#1F2326";
const GRAU = "#6E7377";
const LINIE = "#D8D4CC";
const PREMIUM = "#4E6B3A"; // Stahlschrott: satt, dunkelgrün
const MISCH = "#9A948B"; // Mischschrott: stumpfes Grau
const WARN = "#B4342A";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function komma(n: number, stellen: number): string {
  return n.toFixed(stellen).replace(".", ",").replace(/^-/, "−");
}

interface Z {
  s: string[];
}

function text(
  z: Z,
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

function kasten(
  z: Z,
  x: number,
  y: number,
  w: number,
  h: number,
  fuell: string,
  rand?: string,
  r = 8,
  gestrichelt = false
): void {
  z.s.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fuell}"` +
      (rand ? ` stroke="${rand}" stroke-width="3"` : "") +
      (gestrichelt ? ` stroke-dasharray="9 5"` : "") +
      `/>`
  );
}

/** Maße eines Stücks als Zeile: „180 kg · 0,28 × 0,28 × 2,90 m". */
function masse(u: Urteil): string {
  const d = u.spec.dims.map((x) => komma(x, 2)).join(" × ");
  const form = u.spec.kind === "cyl" ? " (r/L)" : u.spec.kind === "torus" ? " (Ring)" : "";
  return `${Math.round(u.spec.massKg)} kg · ${d} m${form}`;
}

/**
 * Was aufs Blatt kommt — nicht die extremsten Stücke, sondern die, über die
 * Patrick gesprochen hat, und die dicht an der Grenze. Ein Blatt, das nur
 * Träger gegen Kühlschränke zeigt, beantwortet keine strittige Frage.
 */
const REGEL = [
  "Waggon-Drehgestell",
  "LKW-Achse",
  "Bremsscheibe (LKW)",
  "Schienenabschnitt",
  "Profilstahl",
  "Grobblech-Zuschnitt (20 mm)",
  "Doppel-T-Träger",
  "Schienenbündel",
  "Bahnschwelle (Stahl, Y-Form)",
];

/** Von Hand gesetzt — und warum. Der Grund steht auf dem Blatt, nicht nur im Code. */
const VON_HAND: [string, string][] = [
  ["LKW-Felge", "gehärteter Stahl"],
  ["Felgenstapel (Stahl)", "dieselben Felgen, gestapelt"],
  ["Baggerlöffel", "Verschleißblech 15–20 mm"],
  ["Seecontainer 20 Fuß", "2,2 t Stahlkörper, nichts drin"],
];

const MISCHSCHROTT = [
  "Palettenregal-Traversen (Bund)",
  "Blech",
  "Blechtafel",
  "Gitterbox",
  "Elektroherd",
];

export function zeichneStahlschrottblatt(): string {
  const alle = alleUrteile();
  const finde = (name: string) => {
    const u = alle.find((x) => x.spec.name === name);
    if (!u) throw new Error(`Katalogeintrag „${name}" fehlt — Blatt nicht zeichenbar`);
    return u;
  };

  const gruppe1 = REGEL.map(finde).sort((a, b) => b.wand - a.wand);
  const gruppe2 = VON_HAND.map(([n, g]) => [finde(n), g] as [Urteil, string]).sort(
    (a, b) => b[0].wand - a[0].wand
  );
  const gruppe3 = MISCHSCHROTT.map(finde).sort((a, b) => b.wand - a.wand);

  const vorherStahl = alle.filter((u) => u.vorher === "steel").length;
  const jetztStahl = alle.filter((u) => u.jetzt === "steel").length;

  const z: Z = { s: [] };
  let y = 0;

  /* --- Kopf --------------------------------------------------------- */
  y = 62;
  text(z, RAND, y, "WAS IST STAHLSCHROTT?", 42, TINTE, true);
  y += 36;
  text(z, RAND, y, "Stand 15.09.2026 · zwei Fraktionen, strenger getrennt", 22, GRAU);

  /* --- Die Regel ----------------------------------------------------- */
  y += 24;
  const regelH = 190;
  kasten(z, RAND, y, W - 2 * RAND, regelH, "#F2EFE8", LINIE, 12);
  let ry = y + 44;
  text(z, RAND + 22, ry, "Stahlschrott ist, was massiv ist.", 30, TINTE, true);
  ry += 40;
  text(z, RAND + 22, ry, "Gewicht ÷ (7,85 kg/dm³ × Außenfläche) = Wandstärke.", 25, TINTE);
  ry += 34;
  text(z, RAND + 22, ry, `Ab ${WAND_AB_MM} mm: STAHLSCHROTT.   Darunter: MISCHSCHROTT.`, 25, TINTE, true);
  ry += 32;
  text(z, RAND + 22, ry, "Dazu: höchstens 10 % Fremdstoff. Sonst Mischschrott.", 25, TINTE);
  y += regelH + 28;

  /* --- Die drei Blöcke ----------------------------------------------- */
  const barX = RAND + 8;
  const barBreite = W - RAND - 8 - barX - 112;
  const maxWand = Math.max(...gruppe1.map((u) => u.wand)) * 1.04;
  const schwelleX = barX + (WAND_AB_MM / maxWand) * barBreite;
  const zeilenH = 66;

  function balken(u: Urteil, cy: number, farbe: string, gestrichelt: boolean, zusatz?: string): void {
    text(z, barX, cy, u.spec.name ?? "", 24, TINTE, true);
    text(z, W - RAND - 8, cy, masse(u), 17, GRAU, false, "end");
    const w = Math.max(4, (u.wand / maxWand) * barBreite);
    kasten(z, barX, cy + 10, w, 26, gestrichelt ? PAPIER : farbe, gestrichelt ? farbe : undefined, 5, gestrichelt);
    text(z, barX + w + 12, cy + 31, `${komma(u.wand, 1)} mm`, 22, farbe, true);
    if (zusatz) text(z, W - RAND - 8, cy + 31, zusatz, 19, farbe, false, "end");
  }

  function ueberschrift(t: string, farbe: string, cy: number): void {
    z.s.push(
      `<line x1="${RAND}" y1="${cy - 22}" x2="${W - RAND}" y2="${cy - 22}" stroke="${LINIE}" stroke-width="2"/>`
    );
    text(z, RAND, cy, t, 24, farbe, true);
  }

  let cy = y + 48;
  const schwelleVon = cy - 34;

  // Die Beschriftung der Schwelle steht ueber allem, damit sie keine Zeile
  // kreuzt — die Linie selbst wird ganz zum Schluss gezogen.
  text(z, schwelleX, cy - 50, `${WAND_AB_MM} mm`, 21, WARN, true, "middle");
  ueberschrift("STAHLSCHROTT — die Regel holt es", PREMIUM, cy);
  cy += 34;
  for (const u of gruppe1) {
    balken(u, cy, PREMIUM, false);
    cy += zeilenH;
  }

  cy += 8;
  ueberschrift("STAHLSCHROTT — von Hand, mit Begründung", PREMIUM, cy);
  cy += 34;
  for (const [u, grund] of gruppe2) {
    balken(u, cy, PREMIUM, true, grund);
    cy += zeilenH;
  }

  cy += 8;
  ueberschrift("MISCHSCHROTT — Blech über Luft", MISCH, cy);
  cy += 34;
  for (const u of gruppe3) {
    balken(u, cy, MISCH, false);
    cy += zeilenH;
  }

  // Die Schwellenlinie durch alle drei Blöcke — erst jetzt, unter den Balken
  // wäre sie hinter ihnen; SVG malt in Reihenfolge, deshalb hier zuletzt und
  // halbdurchsichtig, damit sie keine Zahl zerschneidet.
  z.s.push(
    `<line x1="${schwelleX}" y1="${schwelleVon}" x2="${schwelleX}" y2="${cy - 30}" ` +
      `stroke="${WARN}" stroke-width="3" opacity="0.55"/>`
  );
  y = cy;

  /* --- Die Gitterbox, ausdrücklich ------------------------------------ */
  const box = finde("Gitterbox");
  const flaeche = aussenflaeche(box.spec.kind, box.spec.dims);
  const gH = 146;
  kasten(z, RAND, y, W - 2 * RAND, gH, "#FFF4EE", WARN, 12);
  let gy = y + 42;
  text(z, RAND + 22, gy, "UND DIE GITTERBOX?", 28, WARN, true);
  gy += 36;
  text(
    z,
    RAND + 22,
    gy,
    `${Math.round(box.spec.massKg)} kg auf ${komma(flaeche, 2)} m² Außenfläche = ${komma(box.wand, 1)} mm.`,
    25,
    TINTE
  );
  gy += 34;
  text(z, RAND + 22, gy, "Halb so dick wie die Schwelle —", 25, TINTE);
  text(z, RAND + 22 + 440, gy, "MISCHSCHROTT.", 25, WARN, true);
  gy += 28;
  text(z, RAND + 22, gy, "Ein Rahmen mit Luft dazwischen.", 20, GRAU);
  y += gH + 26;

  /* --- Fuß ------------------------------------------------------------ */
  z.s.push(`<line x1="${RAND}" y1="${y}" x2="${W - RAND}" y2="${y}" stroke="${LINIE}" stroke-width="2"/>`);
  y += 34;
  text(z, RAND, y, `Vorher Stahlschrott: ${vorherStahl} von ${alle.length} Katalogstücken.`, 23, TINTE, true);
  y += 30;
  text(z, RAND, y, `Jetzt: ${jetztStahl}.`, 23, TINTE, true);
  y += 30;
  text(z, RAND, y, `Schwelle ${WAND_AB_MM} mm = Sortenliste E1/E3 gegen Blechschrott.`, 19, GRAU);
  y += 26;
  text(z, RAND, y, "Erzeugt aus dem Katalog: tools/stahlschrott-blatt.ts · E-042", 19, GRAU);
  y += 24;

  const H = y;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="${PAPIER}"/>` +
    z.s.join("") +
    `</svg>\n`
  );
}

/** Damit ein Wächter an den Namen hängen kann, nicht am Text. */
export const BLATT_STUECKE = [...REGEL, ...VON_HAND.map(([n]) => n), ...MISCHSCHROTT];
