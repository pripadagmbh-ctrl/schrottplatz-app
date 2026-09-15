/**
 * Durchsicht "Aussehen und Name in Deckung" (15.09.2026).
 *
 *     npx vite-node tools/katalog-aussehen.ts           # jede Zeile
 *     npx vite-node tools/katalog-aussehen.ts bau       # nach Bauzweig gruppiert
 *     npx vite-node tools/katalog-aussehen.ts frak      # je Fraktion: welche Sorten
 *     npx vite-node tools/katalog-aussehen.ts klassen   # Sorten je Fraktion UND Groesse
 *     npx vite-node tools/katalog-aussehen.ts wand      # rechnerische Wandstaerke
 *     npx vite-node tools/katalog-aussehen.ts ecken     # was ein Bau an Ecken kostet
 *
 * Es urteilt nichts, es zeigt nur: Name, Fraktion, Bauzweig, Masse, Mass,
 * Huellwichte, Feststoffdichte. Ob Name und Bauzweig zusammenpassen, entscheidet
 * ein Mensch — dieses Blatt ist die Unterlage dafuer. Was danach FEST steht,
 * gehoert in `test/bauart.test.ts` und `test/gewicht.test.ts`, nicht hierher:
 * Ein Werkzeug, das man von Hand aufruft, faellt niemandem auf, wenn es rot
 * wird.
 */
import { alleEintraege, huellVolumen, leitstoff } from "./stahlschrott";
import { feststoffdichte } from "../src/materials/schuettdichte";
import { aussenflaeche, fraktionVonTeil } from "../src/materials/purity";
import { baueGeometrie } from "../src/world/objektbau";

const modus = process.argv[2] ?? "";
const alle = alleEintraege().map(({ spec, liste }) => ({
  spec,
  liste,
  name: spec.name ?? "(ohne Namen)",
  frak: fraktionVonTeil(spec),
}));
const z = (n: number, k = 0) =>
  n.toLocaleString("de-DE", { maximumFractionDigits: k, minimumFractionDigits: k });

if (modus === "bau") {
  const proBau = new Map<string, string[]>();
  for (const e of alle) {
    const key = e.spec.bau ?? "(ohne Bau)";
    if (!proBau.has(key)) proBau.set(key, []);
    proBau.get(key)!.push(`${e.name} [${e.frak}] ${e.spec.dims.map((d) => z(d, 2)).join("x")}`);
  }
  for (const key of [...proBau.keys()].sort()) {
    const liste = proBau.get(key)!;
    console.log(`\n## ${key} (${liste.length})`);
    for (const n of liste.sort()) console.log(`  ${n}`);
  }
} else if (modus === "klassen") {
  /*
   * Die Zahl, auf die es bei "mindestens acht je Fraktion" ankommt.
   *
   * `randomCargo` zieht sein Stueck aus GENAU EINER Groessenklasse. Eine
   * sortenreine Kleinteil-Fuhre sieht darum nur die Kleinteile ihrer Fraktion,
   * nie den ganzen Katalog — deshalb wird hier je Klasse gezaehlt.
   */
  const klasse = (l: string) =>
    l === "SPECS" || l === "KATALOG_SPECS" ? "klein" : l === "BIG_SPECS" || l === "KATALOG_BIG" ? "gross" : "riesig";
  const m = new Map<string, Record<string, number>>();
  for (const e of alle) {
    if (!m.has(e.frak)) m.set(e.frak, { klein: 0, gross: 0, riesig: 0 });
    m.get(e.frak)![klasse(e.liste)]++;
  }
  console.log("Fraktion\tklein\tgross\triesig");
  for (const k of [...m.keys()].sort()) {
    const r = m.get(k)!;
    console.log(`${k}\t${r.klein}\t${r.gross}\t${r.riesig}`);
  }
} else if (modus === "ecken") {
  /*
   * Was ein Bau kostet: Eckpunkte je Gegenstand. Zeichenrufe sind es nie mehr
   * als einer (plus einer fuer Glas) — alles verschmilzt zu einer Geometrie.
   * Die Eckenzahl ist trotzdem die Zahl, die zaehlt: Sie geht als konvexe
   * Huelle in den Kollider (`scrapItems.ts`) und damit in die Physik.
   */
  const proBau = new Map<string, number[]>();
  for (const e of alle) {
    if (!e.spec.bau) continue;
    const t = baueGeometrie(e.spec.bau, e.spec.dims, e.spec.kind, e.frak);
    const n = t.koerper.getAttribute("position").count + (t.glas?.getAttribute("position").count ?? 0);
    if (!proBau.has(e.spec.bau)) proBau.set(e.spec.bau, []);
    proBau.get(e.spec.bau)!.push(n);
    t.koerper.dispose();
    t.glas?.dispose();
  }
  console.log("Bau\tTraeger\tEcken min\tEcken max");
  let gesamt = 0;
  for (const k of [...proBau.keys()].sort()) {
    const v = proBau.get(k)!;
    gesamt += v.reduce((s, x) => s + x, 0);
    console.log(`${k}\t${v.length}\t${Math.min(...v)}\t${Math.max(...v)}`);
  }
  console.log(`\nSumme ueber alle gebauten Eintraege: ${gesamt} Ecken`);
} else if (modus === "wand") {
  /*
   * Rechnerische Wandstaerke in Millimetern, aber mit der Dichte des EIGENEN
   * Werkstoffs statt der von Stahl (`purity.ts` rechnet immer mit 7850, weil
   * die Stahlschrott-Regel nur Stahl sortiert).
   *
   *     t = Masse / (Dichte x Aussenflaeche)
   *
   * Das ist die Zahl, an der man ein falsches Gewicht sieht, ohne den
   * Gegenstand zu kennen: Unter 0,5 mm wird kein Blech gewalzt, ueber 60 mm
   * ist es kein hohler Koerper mehr, sondern ein Klotz.
   */
  console.log("Name\tFraktion\tkg\tWand mm");
  for (const e of alle)
    console.log(
      [
        e.name,
        e.frak,
        e.spec.massKg,
        (
          (1000 * e.spec.massKg) /
          (feststoffdichte(leitstoff(e.spec).id) * aussenflaeche(e.spec.kind, e.spec.dims))
        ).toFixed(2),
      ].join("\t")
    );
} else if (modus === "frak") {
  const proFrak = new Map<string, string[]>();
  for (const e of alle) {
    if (!proFrak.has(e.frak)) proFrak.set(e.frak, []);
    proFrak.get(e.frak)!.push(`${e.name} (${e.liste}, ${e.spec.massKg} kg)`);
  }
  for (const key of [...proFrak.keys()].sort()) {
    const liste = proFrak.get(key)!;
    console.log(`\n## ${key} — ${liste.length}`);
    for (const n of liste.sort()) console.log(`  ${n}`);
  }
} else {
  console.log("Liste\tName\tFraktion\tBau\tkg\tMass\tkg/m3\tFeststoff");
  for (const e of alle) {
    const vol = huellVolumen(e.spec.kind, e.spec.dims);
    console.log(
      [
        e.liste,
        e.name,
        e.frak,
        e.spec.bau ?? "-",
        e.spec.massKg,
        e.spec.dims.map((d) => z(d, 2)).join("x"),
        z(e.spec.massKg / Math.max(vol, 1e-4)),
        z(feststoffdichte(leitstoff(e.spec).id)),
      ].join("\t")
    );
  }
  console.log(`\n${alle.length} Eintraege`);
}
