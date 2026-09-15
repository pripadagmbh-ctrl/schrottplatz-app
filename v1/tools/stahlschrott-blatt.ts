/**
 * Das Stahlschrott-Blatt — eine Seite, auf der man SIEHT, wo die Grenze liegt.
 *
 * Anlass (Patrick, 15.09.2026): „Ich möchte ein bisschen strenger werden, was
 * Stahlschrott ist. … Auch bei so Gitterboxen bin ich mir nicht sicher."
 *
 * Jede Zahl auf dem Blatt wird gerechnet, keine ist getippt: Masse und Maße
 * kommen aus dem Katalog, die Wandstärke aus `tools/stahlschrott.ts`. Ändert
 * jemand ein Maß, ändert sich das Blatt beim nächsten Lauf mit.
 *
 * MASSE. Breite 820 Einheiten wie beim Fraktionsblatt — Patrick schaut das auf
 * dem iPhone in der Planmappe an, und bei 820 wird aus Schriftgröße 30 rund
 * 14 px. Ein 1760 breites Blatt bildet 11-px-Text auf 2,4 px ab.
 *
 * Erzeugen, aus `v1/`:
 *
 *     npx vite-node tools/stahlschrott-blatt-schreiben.ts
 */
import { alleUrteile, WAND_AB_MM, STAHL_KG_M3, aussenflaeche, type Urteil } from "./stahlschrott";

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

function kasten(z: Z, x: number, y: number, w: number, h: number, fuell: string, rand?: string, r = 8): void {
  z.s.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fuell}"` +
      (rand ? ` stroke="${rand}" stroke-width="2"` : "") +
      `/>`
  );
}

/** Maße eines Stücks als Zeile: „180 kg · 0,28 × 0,28 × 2,90 m". */
function masse(u: Urteil): string {
  const d = u.spec.dims.map((x) => komma(x, 2)).join(" × ");
  const form = u.spec.kind === "cyl" ? " (Ø/Länge)" : u.spec.kind === "torus" ? " (Ring)" : "";
  return `${Math.round(u.spec.massKg)} kg · ${d} m${form}`;
}

/**
 * Die Stücke, die aufs Blatt kommen.
 *
 * Nicht die extremsten, sondern die, über die Patrick gesprochen hat, und die
 * dicht an der Grenze — ein Blatt, das nur Träger gegen Kühlschränke zeigt,
 * beantwortet keine einzige strittige Frage.
 */
const GEZEIGT = [
  "Waggon-Drehgestell",
  "Eisenbahn-Puffer (Paar)",
  "LKW-Achse",
  "Profilstahl",
  "Doppel-T-Träger",
  "Schienenbündel",
  "Traktor-Frontgewicht",
  "Palettenregal-Traversen (Bund)",
  "LKW-Felge",
  "Baggerlöffel",
  "Seecontainer 20 Fuß",
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
  const zeilen = GEZEIGT.map(finde).sort((a, b) => b.wand - a.wand);

  const heuteStahl = alle.filter((u) => u.heute === "steel").length;
  const neuStahl = alle.filter((u) => u.neu === "steel").length;

  const z: Z = { s: [] };
  let y = 0;

  /* --- Kopf --------------------------------------------------------- */
  y = 64;
  text(z, RAND, y, "WAS IST STAHLSCHROTT?", 42, TINTE, true);
  y += 38;
  text(z, RAND, y, "Vorschlag 15.09.2026 · zwei Fraktionen, strenger getrennt", 22, GRAU);

  /* --- Die Regel ----------------------------------------------------- */
  y += 26;
  const regelH = 196;
  kasten(z, RAND, y, W - 2 * RAND, regelH, "#F2EFE8", LINIE, 12);
  let ry = y + 44;
  text(z, RAND + 22, ry, "Stahlschrott ist, was massiv ist.", 30, TINTE, true);
  ry += 40;
  text(
    z,
    RAND + 22,
    ry,
    "Gewicht ÷ (7,85 kg/dm³ × Außenfläche) = Wandstärke.",
    25,
    TINTE
  );
  ry += 34;
  text(z, RAND + 22, ry, `Ab ${WAND_AB_MM} mm: STAHLSCHROTT.   Darunter: MISCHSCHROTT.`, 25, TINTE, true);
  ry += 34;
  text(
    z,
    RAND + 22,
    ry,
    "Dazu: höchstens 10 % Fremdstoff. Sonst Mischschrott.",
    25,
    TINTE
  );
  y += regelH + 30;

  /* --- Der Vergleich -------------------------------------------------- */
  text(z, RAND, y, "GEMESSEN AM KATALOG", 26, TINTE, true);
  y += 12;

  const barX = RAND + 8;
  const barBreite = W - RAND - 8 - barX - 108;
  const maxWand = Math.max(...zeilen.map((u) => u.wand)) * 1.04;
  const schwelleX = barX + (WAND_AB_MM / maxWand) * barBreite;

  const zeilenH = 68;
  const chartY = y + 26;
  let cy = chartY;
  let trennerGemalt = false;
  const stuecke: string[] = [];

  for (const u of zeilen) {
    if (!trennerGemalt && u.wand < WAND_AB_MM) {
      trennerGemalt = true;
      cy += 10;
      stuecke.push(
        `<line x1="${RAND}" y1="${cy - 16}" x2="${W - RAND}" y2="${cy - 16}" stroke="${WARN}" stroke-width="2" stroke-dasharray="7 5"/>`
      );
      const t: Z = { s: [] };
      text(t, W - RAND, cy + 4, "ab hier: MISCHSCHROTT", 21, WARN, true, "end");
      stuecke.push(...t.s);
      cy += 22;
    }
    const premium = u.neu === "steel";
    const farbe = premium ? PREMIUM : MISCH;
    const t: Z = { s: [] };
    text(t, barX, cy, u.spec.name ?? "", 24, TINTE, true);
    text(t, W - RAND - 8, cy, masse(u), 17, GRAU, false, "end");
    const w = Math.max(3, (u.wand / maxWand) * barBreite);
    kasten(t, barX, cy + 10, w, 26, farbe, undefined, 5);
    text(t, barX + w + 12, cy + 31, `${komma(u.wand, 1)} mm`, 22, farbe, true);
    stuecke.push(...t.s);
    cy += zeilenH;
  }

  // Die Schwellenlinie liegt UNTER den Balken, damit sie keinen Text zerschneidet.
  z.s.push(
    `<line x1="${schwelleX}" y1="${chartY - 22}" x2="${schwelleX}" y2="${cy - 26}" ` +
      `stroke="${WARN}" stroke-width="3"/>`
  );
  text(z, schwelleX, chartY - 30, `${WAND_AB_MM} mm`, 22, WARN, true, "middle");
  z.s.push(...stuecke);
  y = cy + 6;

  /* --- Die Gitterbox, ausdrücklich ------------------------------------ */
  const box = finde("Gitterbox");
  const flaeche = aussenflaeche(box.spec.kind, box.spec.dims);
  const gH = 150;
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
  gy += 30;
  text(
    z,
    RAND + 22,
    gy,
    "Ein Rahmen mit Luft dazwischen — genau das meint „gemischt“.",
    20,
    GRAU
  );
  y += gH + 26;

  /* --- Fuß ------------------------------------------------------------ */
  z.s.push(`<line x1="${RAND}" y1="${y}" x2="${W - RAND}" y2="${y}" stroke="${LINIE}" stroke-width="2"/>`);
  y += 34;
  text(z, RAND, y, `Heute Stahlschrott: ${heuteStahl} von ${alle.length} Katalogstücken.`, 23, TINTE, true);
  y += 30;
  text(z, RAND, y, `Nach dieser Regel: ${neuStahl}.`, 23, TINTE, true);
  y += 30;
  text(
    z,
    RAND,
    y,
    `Schwelle ${WAND_AB_MM} mm = Sortenliste E1/E3 gegen Blechschrott. Stahl 7850 kg/m³.`,
    19,
    GRAU
  );
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

/** Damit der Wächter nicht am Text, sondern an den Zahlen hängt. */
export const BLATT_STUECKE = GEZEIGT;
export const BLATT_STAHL_DICHTE = STAHL_KG_M3;
