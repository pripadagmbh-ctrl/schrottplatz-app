/**
 * Stahlschrott-Regel — rechnet aus dem Katalog aus, was Premium ist.
 *
 * Anlass (Patrick, 15.09.2026): „Ich möchte ein bisschen strenger werden, was
 * Stahlschrott ist. Das ist halt so das Premium. Es geht da eher so um
 * Bahnschwellen, Bremsscheiben, Träger — das ist so wirklich ganz gutes
 * Material."
 *
 * Dieses Werkzeug ändert nichts am Spiel. Es liest den vorhandenen Katalog,
 * wendet die vorgeschlagene Regel an und schreibt die Liste, nach der der
 * Umbau später sortiert. Erklärung und Ergebnis stehen in
 * `docs/stahlschrott.md`.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/stahlschrott-liste.ts
 *     npx vite-node tools/stahlschrott-blatt-schreiben.ts
 */
import { readFileSync } from "node:fs";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";

/* ------------------------------------------------------------------------ */
/* 1 · Der Katalog, vollständig                                               */
/* ------------------------------------------------------------------------ */

/**
 * `BIG_SPECS` und `HUGE_SPECS` in `scrapItems.ts` sind **nicht exportiert**.
 * Genau dort stehen aber Patricks Premium-Beispiele (Doppel-T-Träger,
 * Blechtafel, Maschinenblock). Wer nur die Exporte liest, misst am
 * Interessantesten vorbei — die Bestandsaufnahme vom 15.09. („271 erreichbare
 * Einträge", `docs/fraktionen.md`) hat genau diese Lücke.
 *
 * Deshalb werden die beiden Listen aus dem Quelltext gelesen. Das ist erlaubt,
 * weil jede Zeile ein reines Objektliteral ist: keine Funktionsaufrufe, keine
 * Variablen, nur Zahlen und Zeichenketten. Die Spreads `...KATALOG_*` werden
 * entfernt, weil die Katalogteile schon über den Import kommen.
 *
 * Bricht das, sobald jemand in diesen Listen eine Variable benutzt — dann
 * wirft `new Function` und das Werkzeug schweigt nicht, sondern stürzt ab.
 * Das ist die gewollte Reihenfolge: lieber laut falsch als leise unvollständig.
 */
function ausQuelltext(quelle: string, name: string): PileSpec[] {
  const kopf = new RegExp(`const ${name}: PileSpec\\[\\] = \\[`);
  const start = quelle.search(kopf);
  if (start < 0) throw new Error(`${name} im Quelltext nicht gefunden`);
  const auf = quelle.indexOf("[", start);
  const zu = quelle.indexOf("\n];", auf);
  if (zu < 0) throw new Error(`${name}: Ende der Liste nicht gefunden`);
  const rumpf = quelle
    .slice(auf + 1, zu)
    .split("\n")
    .filter((z) => !z.includes("...KATALOG"))
    .join("\n");
  return new Function(`return [${rumpf}];`)() as PileSpec[];
}

/** Alle Schrottteile des Spiels, mit Herkunftsliste. */
export function alleEintraege(
  quelltext = readFileSync(new URL("../src/world/scrapItems.ts", import.meta.url), "utf8")
): { spec: PileSpec; liste: string }[] {
  const big = ausQuelltext(quelltext, "BIG_SPECS");
  const huge = ausQuelltext(quelltext, "HUGE_SPECS");
  return [
    ...SPECS.map((spec) => ({ spec, liste: "SPECS" })),
    ...big.map((spec) => ({ spec, liste: "BIG_SPECS" })),
    ...huge.map((spec) => ({ spec, liste: "HUGE_SPECS" })),
    ...KATALOG_BIG.map((spec) => ({ spec, liste: "KATALOG_BIG" })),
    ...KATALOG_HUGE.map((spec) => ({ spec, liste: "KATALOG_HUGE" })),
  ];
}

/* ------------------------------------------------------------------------ */
/* 2 · Maße, die der Katalog schon kennt                                      */
/* ------------------------------------------------------------------------ */

/**
 * Rauminhalt der Hülle in m³ — der Raum, den das Stück auf der Ladefläche
 * wegnimmt.
 *
 * Je Form die echte Außenform, nicht der Quader drumherum: Ein Rohr, das man
 * als Quader rechnet, sähe 27 % hohler aus, als es ist (1 − π/4).
 *
 * - `box`  a·b·c
 * - `cyl`  dims = [Radius, Länge] (`scrapItems.ts:474`) → π·r²·l
 * - `torus` dims = [Ringradius, Rohrradius] (`scrapItems.ts:478`) → 2π²·R·r²
 * - `wire` dims = [Radius] → Kugel, so wie der Kollider es sieht
 */
export function huellVolumen(kind: string, dims: number[]): number {
  if (kind === "cyl") {
    const [r, l] = dims;
    return Math.PI * r * r * l;
  }
  if (kind === "torus") {
    const [R, r] = dims;
    return 2 * Math.PI * Math.PI * R * r * r;
  }
  if (kind === "wire") {
    const r = dims[0];
    return (4 / 3) * Math.PI * r * r * r;
  }
  const [a = 1, b = 1, c = 1] = dims;
  return a * b * c;
}

/**
 * Kleinste Außenkante in m — das Maß für „dünnwandig oder nicht".
 *
 * Bei Rohrform und Ring ist die kleinste Kante der Durchmesser, nicht der
 * Radius: Ein Rohr von 9 cm Radius ist 18 cm dick.
 */
export function kleinsteKante(kind: string, dims: number[]): number {
  if (kind === "cyl") return Math.min(2 * dims[0], dims[1]);
  if (kind === "torus") return 2 * dims[1];
  if (kind === "wire") return 2 * dims[0];
  return Math.min(...dims.filter((d) => d > 0));
}

/* ------------------------------------------------------------------------ */
/* 3 · Die Regel                                                              */
/* ------------------------------------------------------------------------ */

/** Dichte von Stahl, Physik: 7.850 kg/m³. */
export const STAHL_KG_M3 = 7850;

/**
 * **Die rechnerische Wandstärke** — das eine Maß, auf dem die Regel steht.
 *
 * Gedankenexperiment: Man schmilzt das Stück ein und streicht das Metall
 * gleichmäßig als Haut über seine eigene Außenfläche. Wie dick wird die Haut?
 *
 *     t = Masse / (Dichte von Stahl × Außenfläche)
 *
 * Ein Elektroherd von 30 kg hat 3,03 m² Außenfläche — das ergibt 1,3 mm, und
 * genau so dick ist Herdblech. Ein Doppel-T-Träger von 180 kg auf 3,40 m²
 * ergibt 6,7 mm, und genau so dick ist der Steg eines IPE 280. Die Zahl
 * stimmt also nicht nur ungefähr, sie trifft.
 *
 * Warum dieses Maß und nicht die Hüllwichte allein: Die Wichte bestraft große
 * Stücke doppelt. Ein 20-Fuß-Container und ein Kühlschrank sind beide Blech
 * über Luft, aber die Wichte des Containers ist viel kleiner, weil sein
 * Hohlraum mit der dritten Potenz wächst und sein Blech nur mit der zweiten.
 * Die Wandstärke rechnet genau diesen Größeneffekt heraus. Deshalb sortiert
 * sie einen kleinen Klotz und einen großen Klotz gleich ein — und das ist es,
 * was ein Schrottplatz auch tut.
 */
export function wandstaerkeMm(spec: PileSpec): number {
  return (1000 * spec.massKg) / (STAHL_KG_M3 * aussenflaeche(spec.kind, spec.dims));
}

/** Außenfläche in m², je Form. */
export function aussenflaeche(kind: string, dims: number[]): number {
  if (kind === "cyl") {
    const [r, l] = dims;
    return 2 * Math.PI * r * l + 2 * Math.PI * r * r;
  }
  if (kind === "torus") {
    const [R, r] = dims;
    return 4 * Math.PI * Math.PI * R * r;
  }
  if (kind === "wire") {
    const r = dims[0];
    return 4 * Math.PI * r * r;
  }
  const [a = 1, b = 1, c = 1] = dims;
  return Math.max(2 * (a * b + b * c + c * a), 1e-4);
}

/**
 * **Schwelle 1 — 6 mm Wandstärke.**
 *
 * Herkunft: die europäische Sortenliste für Stahlschrott. Dort trennt
 * genau diese Zahl den schweren Altschrott (Sorten E1/E3, Mindestdicke 6 mm)
 * vom Blechschrott (E5 und Verwandte, alles Dünnere). Das ist nicht
 * ausgedacht, sondern die Grenze, nach der ein Platz wirklich abrechnet —
 * und sie deckt sich mit dem, was Patrick am 15.09.2026 gesagt hat:
 * Bahnschwellen, Bremsscheiben, Träger sind darüber, ein Elektroherd ist es
 * nicht.
 *
 * ACHTUNG, Herkunft zweiter Klasse: Die 6 mm sind Branchenwissen, im Projekt
 * bisher nirgends belegt (`docs/02_Briefing.md` Kap. 7 nennt Preise, keine
 * Sortenliste). Wer eine Quelle einträgt, soll die Zahl gegenprüfen.
 */
export const WAND_AB_MM = 6; // Sortenliste E1/E3 gegen E5 — Branchenzahl, projektintern unbelegt

/**
 * **Schwelle 2 — Fremdstoffanteil höchstens 10 %.**
 *
 * Patrick: „Stahlschrott sind selten Verbundmaterialien. Natürlich hast du
 * mal Tanks, wo dann noch was dran ist." Eine Regel, die an einer einzigen
 * Schraube scheitert, ist zu streng — deshalb nicht 0 %.
 *
 * 10 % statt der heutigen 5 % (`SORTENREIN_AB = 0.95`, `purity.ts:110`), weil
 * 5 % genau das verbietet, was er ausdrücklich erlaubt: Der Baggerlöffel mit
 * Gumminoppen (3 % Fremdes) rutscht gerade so durch, ein Tank mit
 * Kunststoffschauglas und Dichtungen (8 %) nicht mehr.
 *
 * Die Schwelle wird also **weicher** — und die Regel trotzdem strenger, weil
 * die Wandstärke davor greift. Dass die Verbundschwelle die Sortierung heute
 * allein trägt, ist der eigentliche Fehler: Sie kann es nicht, weil 215 von
 * 271 Einträgen gar keine Stückliste haben (`docs/fraktionen.md`, 1.1).
 */
export const VERBUND_BIS = 0.1; // SW, aufgeweitet von SORTENREIN_AB = 0.95

/** Hüllwichte in kg/m³ — nur zur Anschauung, die Regel hängt nicht daran. */
export function huellwichte(spec: PileSpec): number {
  return spec.massKg / Math.max(huellVolumen(spec.kind, spec.dims), 1e-4);
}

/** Der Stoff mit dem größten Anteil und sein Anteil (ohne Stückliste: 1,0). */
export function leitstoff(spec: PileSpec): { id: string; anteil: number } {
  const z = spec.zusammensetzung;
  if (!z || z.length === 0) return { id: spec.materialId, anteil: 1 };
  let groesster = z[0];
  for (const a of z) if (a.anteil > groesster.anteil) groesster = a;
  return { id: groesster.materialId, anteil: groesster.anteil };
}

/** Warum ein Stück kein Stahlschrott ist. */
export type Grund = "premium" | "kein-stahl" | "duennwandig" | "verbund";

export interface Urteil {
  spec: PileSpec;
  liste: string;
  /** Fraktion nach heutiger Regel (`fraktionAus`, SORTENREIN_AB = 0.95). */
  heute: string;
  /** Fraktion nach der vorgeschlagenen Regel. */
  neu: string;
  grund: Grund;
  wand: number;
  wichte: number;
  fremd: number;
}

/**
 * Die Regel in Code.
 *
 * Sie entscheidet **nur zwischen Stahlschrott und Mischschrott**. Buntmetall,
 * VA, Holz, Reifen, Kunststoff bleiben unberührt: Ein Alu-Kessel ist Alu, ob
 * massiv oder hohl — das ist eine Frage des Stoffs, nicht der Bauweise. Die
 * Premium-Frage stellt sich nur dort, wo zwei Mulden dasselbe Metall nehmen.
 */
export function urteile(spec: PileSpec, liste = ""): Urteil {
  const { id, anteil } = leitstoff(spec);
  const wand = wandstaerkeMm(spec);
  const fremd = 1 - anteil;
  const heute = spec.zusammensetzung?.length ? (anteil >= 0.95 ? id : "mixed") : spec.materialId;

  let grund: Grund = "premium";
  if (id !== "steel") grund = "kein-stahl";
  else if (wand < WAND_AB_MM) grund = "duennwandig";
  else if (fremd > VERBUND_BIS + 1e-9) grund = "verbund";

  const neu = grund === "premium" ? "steel" : grund === "kein-stahl" ? heute : "mixed";
  return { spec, liste, heute, neu, grund, wand, wichte: huellwichte(spec), fremd };
}

/** Alle Einträge beurteilt. */
export function alleUrteile(quelltext?: string): Urteil[] {
  return alleEintraege(quelltext).map(({ spec, liste }) => urteile(spec, liste));
}
