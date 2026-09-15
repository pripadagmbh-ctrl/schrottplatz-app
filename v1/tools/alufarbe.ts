/**
 * Wo sieht man Aluminium — und welche Farbe hat es dort wirklich?
 *
 * Anlass (Patrick, 15.09.2026, am Gerät): „Aluminium ist in den meisten Fällen
 * grau." Im Katalog steht `alu: 0xc4c8cc` — ein sehr helles, leicht bläuliches
 * Grau, näher an poliertem Edelstahl als an dem, was auf einem Platz liegt.
 *
 * Vor dem Ändern die Gegenfrage, die `docs/fraktionen.md` (2.3) aufgeworfen
 * hat: **Sieht er diese Farbe überhaupt?** Ein Katalogeintrag mit `bau` wird
 * nach Zweck gefärbt (Entscheidung 12.09.2026), und `baueGeometrie` bekommt
 * die Fraktionsfarbe gar nicht erst zu sehen — sie steht in keiner Signatur.
 * Nur Einträge OHNE `bau` tragen die Fraktionsfarbe.
 *
 * Dieses Werkzeug beantwortet beides mit Zahlen:
 *
 *   npx vite-node tools/alufarbe.ts
 *
 * 1. Welche Alu-Teile tragen die Fraktionsfarbe, welche nicht.
 * 2. Welche Farbe die gebauten wirklich haben (flächengewichtete Mittelfarbe
 *    ihrer Dreiecke, im linearen Raum gewichtet — dieselbe Messart wie in
 *    `docs/fraktionen.md`, 2.3).
 * 3. Die Abstände Alu↔VA, Alu↔Zink, Alu↔Mischschrott bei Tageslicht,
 *    Abendsonne und Flutlicht — vorher und für jeden Vorschlag.
 */
import { MATERIALS } from "../src/materials/catalog";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";
import { baueGeometrie } from "../src/world/objektbau";
import { deltaEHex, linearZuSrgb, srgbZuLinear } from "./farbabstand";

const ALLE: PileSpec[] = [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE];

function hex(c: number): string {
  return "#" + c.toString(16).padStart(6, "0");
}

/**
 * Flächengewichtete Mittelfarbe einer gebauten Geometrie.
 *
 * Gewichtet wird im LINEAREN Raum, weil Licht linear addiert; erst am Ende
 * geht es zurück nach sRGB. Wer in sRGB mittelt, bekommt zu dunkle Mischungen.
 */
function mittelfarbe(spec: PileSpec): number | null {
  if (!spec.bau) return null;
  const t = baueGeometrie(spec.bau, spec.dims, spec.kind);
  const pos = t.koerper.getAttribute("position").array as Float32Array;
  const col = t.koerper.getAttribute("color")?.array as Float32Array | undefined;
  if (!col) {
    t.koerper.dispose();
    t.glas?.dispose();
    return null;
  }
  let gew = 0;
  const summe = [0, 0, 0];
  for (let i = 0; i + 8 < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i];
    const ay = pos[i + 4] - pos[i + 1];
    const az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i];
    const by = pos[i + 7] - pos[i + 1];
    const bz = pos[i + 8] - pos[i + 2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const flaeche = 0.5 * Math.hypot(cx, cy, cz);
    if (!Number.isFinite(flaeche) || flaeche <= 0) continue;
    const j = i; // Vertexfarben liegen je Ecke; die erste reicht, sie sind gleich
    const k = (j / 3) * 3;
    summe[0] += flaeche * col[k];
    summe[1] += flaeche * col[k + 1];
    summe[2] += flaeche * col[k + 2];
    gew += flaeche;
  }
  t.koerper.dispose();
  t.glas?.dispose();
  if (gew <= 0) return null;
  /*
   * Die Vertexfarben stehen LINEAR: `THREE.Color.set(hex)` rechnet seit
   * three r152 von sRGB in den linearen Arbeitsraum um (ColorManagement ist
   * voreingestellt an). Wer sie ohne Rückrechnung als Byte schreibt, bekommt
   * fast Schwarz heraus — ein Alu-Bündel maß so `#1d1510` statt `#a8adb2`.
   * Deshalb hier zurück nach sRGB, und zwar erst nach dem Mitteln.
   */
  const r = Math.round(Math.min(255, Math.max(0, linearZuSrgb(summe[0] / gew))));
  const g = Math.round(Math.min(255, Math.max(0, linearZuSrgb(summe[1] / gew))));
  const b = Math.round(Math.min(255, Math.max(0, linearZuSrgb(summe[2] / gew))));
  return (r << 16) | (g << 8) | b;
}

/* --- 1 · Wer trägt die Fraktionsfarbe? ---------------------------------- */

const alu = ALLE.filter((s) => s.materialId === "alu");
const ohneBau = alu.filter((s) => !s.bau);
console.log("");
console.log(`Aluminium im Katalog: ${alu.length} Einträge`);
console.log(`  davon OHNE bau (tragen die Fraktionsfarbe): ${ohneBau.length}`);
for (const s of ohneBau) console.log(`      ${s.name ?? "(namenlos)"}  ${s.massKg} kg`);
console.log(`  davon MIT bau (Farbe nach Zweck): ${alu.length - ohneBau.length}`);

const gezaehlt = new Map<string, { n: number; farbe: number; bau: string }>();
for (const s of alu) {
  if (!s.bau) continue;
  const f = mittelfarbe(s);
  if (f === null) continue;
  const key = `${s.bau}|${hex(f)}`;
  const e = gezaehlt.get(key) ?? { n: 0, farbe: f, bau: s.bau };
  e.n += 1;
  gezaehlt.set(key, e);
}
console.log("");
console.log("  Was die gebauten Alu-Teile wirklich für eine Farbe haben:");
for (const [, e] of [...gezaehlt].sort((a, b) => b[1].n - a[1].n))
  console.log(
    `      ${String(e.n).padStart(2)} × ${e.bau.padEnd(16)} ${hex(e.farbe)}  ` +
      `ΔE zur Fraktionsfarbe: ${deltaEHex(e.farbe, MATERIALS.alu.color).toFixed(1)}`
  );

/* --- 2 · Die Abstände, unter drei Lichtern ------------------------------ */

/** Grundfarbe × Lichtfarbe im linearen Raum — was der Shader für diffus tut. */
function unterLicht(farbe: number, licht: number, staerke: number): number {
  let out = 0;
  for (let i = 2; i >= 0; i--) {
    const f = srgbZuLinear((farbe >> (i * 8)) & 0xff);
    const l = srgbZuLinear((licht >> (i * 8)) & 0xff);
    out |= Math.round(linearZuSrgb(f * l * staerke)) << (i * 8);
  }
  return out >>> 0;
}

/** Lichtfarben aus `world/daylight.ts:22-26` und `:204`. */
const LICHTER: [string, number, number][] = [
  ["Mittagssonne", 0xfff4e0, 1.0],
  ["Abendsonne", 0xffb066, 0.45],
  ["Flutlicht", 0xfff2d0, 0.7],
];

const PAARE: [string, string][] = [
  ["alu", "va"],
  ["alu", "zinc"],
  ["alu", "mixed"],
  ["alu", "steel"],
  ["zinc", "va"],
];

function tafel(aluFarbe: number, titel: string): void {
  const farbe = (id: string) => (id === "alu" ? aluFarbe : MATERIALS[id].color);
  console.log("");
  console.log(`  ${titel}  (alu = ${hex(aluFarbe)})`);
  console.log("    Paar            Grundfarbe   Mittag   Abend  Flutlicht");
  for (const [a, b] of PAARE) {
    const roh = deltaEHex(farbe(a), farbe(b));
    const je = LICHTER.map(([, licht, st]) =>
      deltaEHex(unterLicht(farbe(a), licht, st), unterLicht(farbe(b), licht, st))
    );
    console.log(
      `    ${(a + " ↔ " + b).padEnd(16)} ${roh.toFixed(2).padStart(9)} ` +
        je.map((d) => d.toFixed(2).padStart(8)).join("")
    );
  }
}

console.log("");
console.log("=== Farbabstände (ΔE2000) ===");
tafel(MATERIALS.alu.color, "HEUTE");

/**
 * Die Vorschläge.
 *
 * Altaluminium ist matt, oxidiert und staubig — ein stumpfes Mittelgrau mit
 * einem Hauch Wärme vom Oxid, nicht das Blauweiß von poliertem Blech. Die
 * Kandidaten laufen von „etwas zurückgenommen" bis „deutlich stumpf"; die
 * Zahlen darunter entscheiden, welcher bleibt.
 */
export const VORSCHLAEGE: [string, number][] = [
  ["a · leicht zurückgenommen", 0xaeb0ae],
  ["b · mattes Mittelgrau, neutral", 0x9b9c98],
  ["c · mattes Mittelgrau, warm", 0x96938c],
  ["d · deutlich stumpf", 0x8b8983],
  ["e · stumpf, warm", 0x928d85],
  ["f · dunkler, blaeulich wie heute", 0x8f969b],
];
for (const [name, f] of VORSCHLAEGE) tafel(f, name);
