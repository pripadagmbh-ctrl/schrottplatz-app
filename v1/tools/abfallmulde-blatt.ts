/**
 * Zeichnet das Blatt zur Frage „bleiben die vier Abfallsorten in EINER Mulde?"
 * nach `docs/abfallmulde-2026-09-16.svg`.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/abfallmulde-blatt.ts
 *
 * Anlass: Beim Aufloesen von „Stoerstoff" in Holz, Baumischabfall, Reifen und
 * Kunststoff stand die Frage im Raum, ob die vier weiter zusammen in den
 * Muellcontainer gehoeren. Das ist eine GESTALTUNGSFRAGE und Patricks
 * Entscheidung — sie baut den Platz um. Ein Blatt kann sie nicht treffen, aber
 * beantwortbar machen: Es zeigt, was im Schwenkband schon steht und wo noch
 * etwas hinpasst.
 *
 * Alle Masse sind GELESEN, keines gegriffen: `world/containers.ts`,
 * `world/press.ts`, `world/baggerstand.ts`, `delivery/routes.ts`,
 * `world/obstacles.ts`.
 */
import { writeFileSync } from "node:fs";
import { CONFIGS } from "../src/world/containers";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { PRESS_CENTER, PRESS_FUSS } from "../src/world/press";
import { ABLADE_SPUR_X, ABLADE_HALT_Z, BED_HALF_W, ABKIPP_ZONE } from "../src/delivery/routes";
import { BESEN_PLATZ } from "../src/world/startplatz";
import { STATIC_OBSTACLES } from "../src/world/obstacles";

const B = BAGGER_STAND;
/** Masse des Muellcontainers, als Mass fuer einen zweiten (containers.ts). */
const MULDE_BX = 3.6 / 2;
const MULDE_BZ = 4.3 / 2;

const M = 44;
const S = 23; // Pixel je Meter
const X0 = -15;
const Z1 = -9;
const px = (x: number) => (x - X0) * S + M;
const py = (z: number) => (Z1 - z) * S + M;
const W = (13 - X0) * S + 2 * M;
const H = (Z1 - -35) * S + 2 * M;

const d = (x: number, z: number) => Math.hypot(x - B.x, z - B.z);
const peil = (x: number, z: number) => (Math.atan2(x - B.x, z - B.z) * 180) / Math.PI;

/** Anteil der Grundflaeche im Schwenkband — Rasterprobe 40 x 40. */
export function anteilImBand(cx: number, cz: number): number {
  let n = 0;
  for (let i = 0; i < 40; i++)
    for (let j = 0; j < 40; j++) {
      const x = cx - MULDE_BX + ((i + 0.5) / 40) * 2 * MULDE_BX;
      const z = cz - MULDE_BZ + ((j + 0.5) / 40) * 2 * MULDE_BZ;
      const r = Math.hypot(x - B.x, z - B.z);
      if (r >= SCHWENK_INNEN && r <= SCHWENK_AUSSEN) n++;
    }
  return n / 1600;
}

/** Die Tasche, die die Abtastung gefunden hat (siehe Kopf der Datei). */
export const TASCHE = { x: 2.8, z: -15.9 };

function rechteck(
  x: number,
  z: number,
  bx: number,
  bz: number,
  farbe: string,
  text: string,
  unten = ""
): string {
  const w = bx * S;
  const h = bz * S;
  return (
    `<rect x="${(px(x) - w / 2).toFixed(1)}" y="${(py(z) - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${farbe}" stroke="#333" stroke-width="1.2"/>` +
    `<text x="${px(x).toFixed(1)}" y="${(py(z) - 2).toFixed(1)}" text-anchor="middle" font-size="12" font-family="sans-serif" font-weight="bold">${text}</text>` +
    (unten
      ? `<text x="${px(x).toFixed(1)}" y="${(py(z) + 12).toFixed(1)}" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#333">${unten}</text>`
      : "")
  );
}

export function zeichneAbfallmuldenblatt(): string {
  const t: string[] = [];
  t.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  t.push(`<rect width="${W}" height="${H}" fill="#f6f4ef"/>`);

  t.push(
    `<circle cx="${px(B.x)}" cy="${py(B.z)}" r="${SCHWENK_AUSSEN * S}" fill="#dfe7d8" stroke="#7d9a6a" stroke-width="1.5"/>`
  );
  t.push(
    `<circle cx="${px(B.x)}" cy="${py(B.z)}" r="${SCHWENK_INNEN * S}" fill="#f6f4ef" stroke="#7d9a6a" stroke-width="1.5" stroke-dasharray="5 4"/>`
  );

  t.push(
    `<rect x="${px(ABLADE_SPUR_X - BED_HALF_W - 0.2)}" y="${py(-9)}" width="${(2 * BED_HALF_W + 0.4) * S}" height="${26 * S}" fill="#e6ddc9" stroke="#b9a87e" stroke-width="1"/>`
  );
  t.push(
    `<text x="${px(ABLADE_SPUR_X)}" y="${py(-12)}" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#8a7648">LKW-SPUR x 6,3</text>`
  );

  t.push(
    rechteck(
      PRESS_CENTER.x,
      PRESS_CENTER.z,
      PRESS_FUSS.hw * 2,
      PRESS_FUSS.hd * 2,
      "#cfd4dc",
      "PRESSE",
      `${d(PRESS_CENTER.x, PRESS_CENTER.z).toFixed(2)} m`
    )
  );

  for (const c of CONFIGS) {
    if (c.lager) continue;
    const farbe = c.id === "r_rubble" ? "#b7b0a2" : c.kind === "halde" ? "#d8cfc2" : "#c7d3c0";
    const zusatz =
      c.id === "r_rubble"
        ? `${d(c.x, c.z).toFixed(2)} m · ${(anteilImBand(c.x, c.z) * 100).toFixed(0)} % im Band`
        : `${d(c.x, c.z).toFixed(2)} m · Peilung ${peil(c.x, c.z).toFixed(0)}°`;
    t.push(rechteck(c.x, c.z, c.size[0]!, c.size[1]!, farbe, c.label, zusatz));
  }

  t.push(
    `<circle cx="${px(ABKIPP_ZONE[0])}" cy="${py(ABKIPP_ZONE[1])}" r="${1.6 * S}" fill="#eadfc4" stroke="#b9a87e" stroke-width="1"/>` +
      `<text x="${px(ABKIPP_ZONE[0])}" y="${py(ABKIPP_ZONE[1])}" text-anchor="middle" font-size="10" font-family="sans-serif">ABKIPP</text>`
  );
  t.push(
    `<circle cx="${px(ABLADE_SPUR_X)}" cy="${py(ABLADE_HALT_Z)}" r="4" fill="#8a7648"/>` +
      `<text x="${px(ABLADE_SPUR_X) + 8}" y="${py(ABLADE_HALT_Z) + 4}" font-size="10" font-family="sans-serif">Halt z ${ABLADE_HALT_Z}</text>`
  );
  t.push(
    `<circle cx="${px(BESEN_PLATZ.x)}" cy="${py(BESEN_PLATZ.z)}" r="6" fill="#9a8055"/>` +
      `<text x="${px(BESEN_PLATZ.x) + 9}" y="${py(BESEN_PLATZ.z) + 4}" font-size="10" font-family="sans-serif">Besen</text>`
  );

  const anteil = anteilImBand(TASCHE.x, TASCHE.z);
  t.push(
    `<rect x="${px(TASCHE.x) - MULDE_BX * S}" y="${py(TASCHE.z) - MULDE_BZ * S}" width="${2 * MULDE_BX * S}" height="${2 * MULDE_BZ * S}" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="7 5"/>`
  );
  t.push(
    `<text x="${px(TASCHE.x)}" y="${py(TASCHE.z) - 16}" text-anchor="middle" font-size="12" font-weight="bold" font-family="sans-serif" fill="#c0392b">PLATZ FÜR</text>` +
      `<text x="${px(TASCHE.x)}" y="${py(TASCHE.z) - 2}" text-anchor="middle" font-size="12" font-weight="bold" font-family="sans-serif" fill="#c0392b">EINE ZWEITE MULDE</text>`
  );
  t.push(
    `<text x="${px(TASCHE.x)}" y="${py(TASCHE.z) + 12}" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#c0392b">${d(TASCHE.x, TASCHE.z).toFixed(2)} m · ${(anteil * 100).toFixed(0)} % im Band</text>`
  );
  t.push(
    `<text x="${px(TASCHE.x)}" y="${py(TASCHE.z) + 25}" text-anchor="middle" font-size="10" font-family="sans-serif" fill="#c0392b">0,35 m Luft zur LKW-Spur</text>`
  );

  t.push(
    `<circle cx="${px(B.x)}" cy="${py(B.z)}" r="8" fill="#2c3e50"/>` +
      `<line x1="${px(B.x)}" y1="${py(B.z)}" x2="${px(B.x)}" y2="${py(B.z) - 30}" stroke="#2c3e50" stroke-width="3"/>` +
      `<text x="${px(B.x) + 11}" y="${py(B.z) + 16}" font-size="11" font-family="sans-serif" font-weight="bold">BAGGER (${B.x} | ${B.z}), Blick nach Norden</text>`
  );

  t.push(
    `<text x="${M}" y="26" font-size="16" font-weight="bold" font-family="sans-serif">Bleiben Holz, Baumischabfall, Reifen und Kunststoff in EINER Mulde? (16.09.2026)</text>`
  );
  t.push(
    `<text x="${M}" y="${H - 34}" font-size="11" font-family="sans-serif" fill="#444">Grundriss, Norden oben. Grün = Schwenkband 5,80–9,20 m; innen gestrichelt die 5,80 m, darunter bekommt der Arm den Ausleger nicht mehr zusammen.</text>`
  );
  t.push(
    `<text x="${M}" y="${H - 18}" font-size="11" font-family="sans-serif" fill="#444">Im Band stehen heute zwei Sortierziele: BUNT + VA und MUELL. Die rot gestrichelte Tasche ist der einzige Platz, an dem eine gleich große zweite Mulde noch stünde.</text>`
  );
  t.push("</svg>");
  return t.join("\n");
}

/* --------------------------------------------------------------------- */

const ZIEL = "docs/abfallmulde-2026-09-16.svg";
writeFileSync(ZIEL, zeichneAbfallmuldenblatt());
console.log(`geschrieben: ${ZIEL}`);
console.log(
  `Tasche (${TASCHE.x} | ${TASCHE.z}): ${d(TASCHE.x, TASCHE.z).toFixed(2)} m, ` +
    `${(anteilImBand(TASCHE.x, TASCHE.z) * 100).toFixed(0)} % im Band, ` +
    `Luft zur LKW-Spur ${(ABLADE_SPUR_X - BED_HALF_W - (TASCHE.x + MULDE_BX)).toFixed(2)} m`
);
const treffer = STATIC_OBSTACLES.filter(
  (o) =>
    Math.abs(TASCHE.x - o.x) < o.hw + MULDE_BX && Math.abs(TASCHE.z - o.z) < o.hd + MULDE_BZ
);
console.log(`Hindernisse in der Tasche: ${treffer.length} (${treffer.map((o) => o.label).join(", ") || "keine"})`);
