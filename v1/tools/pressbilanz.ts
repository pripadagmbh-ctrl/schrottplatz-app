/**
 * Was kostet das Pressen? — Buchhaltung des Presspakets, kopflos gemessen.
 *
 * Gefragt ist eine einzige Zahl je Fall: Erloes derselben Stuecke EINZELN
 * verkauft gegen Erloes derselben Stuecke ALS PAKET verkauft. Bleibt der
 * Unterschied bei null, ist die Presse buchhalterisch neutral. Alles andere
 * ist ein Loch.
 *
 * Aufruf: npx vite-node tools/pressbilanz.ts
 */
import { Account } from "../src/economy/account";
import { getMaterial } from "../src/materials/catalog";
import { SORTENREIN_AB } from "../src/materials/purity";
import { SPECS, randomCargo } from "../src/world/scrapItems";
import { fraktionAus } from "../src/materials/purity";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";

const ALLE: PileSpec[] = [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE];

const items = { remove: () => {} } as never;
const comps = { despawnByBody: () => false } as never;

interface Stueck {
  materialId: string;
  massKg: number;
  composition?: Array<{ materialId: string; massKg: number }>;
}

/** Ein Katalogeintrag so, wie er als Teil auf dem Platz liegt (scrapItems.ts:1645). */
function alsStueck(s: PileSpec): Stueck {
  return {
    materialId: s.materialId,
    massKg: s.massKg,
    composition: s.zusammensetzung?.map((a) => ({
      materialId: a.materialId,
      massKg: a.anteil * s.massKg,
    })),
  };
}

function verkauf(ware: Stueck[], order?: string | null): number {
  const ladung = ware.map((w) => ({ ...w, body: null }));
  return new Account().sellContainer(ladung as never, items, comps, order ?? null).eur;
}

/** Die Rechnung aus press.ts:797-820, unveraendert nachgebaut. */
function pressen(ware: Stueck[]): Stueck {
  const anteile = new Map<string, number>();
  for (const it of ware) {
    for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }]) {
      anteile.set(c.materialId, (anteile.get(c.materialId) ?? 0) + c.massKg);
    }
  }
  const composition = [...anteile].map(([materialId, massKg]) => ({ materialId, massKg }));
  const dominant = composition.reduce((a, b) => (b.massKg > a.massKg ? b : a));
  const kg = composition.reduce((s, c) => s + c.massKg, 0);
  const reinheit = dominant.massKg / Math.max(kg, 1);
  const paketMaterial = reinheit >= SORTENREIN_AB ? dominant.materialId : "mixed";
  return { materialId: paketMaterial, massKg: kg, composition };
}

function eur(x: number): string {
  return `${x.toFixed(2).padStart(10)} €`;
}

function fall(titel: string, ware: Stueck[], order?: string | null): void {
  const einzeln = verkauf(ware, order);
  const paket = pressen(ware);
  const gepresst = verkauf([paket], order);
  const kg = ware.reduce((a, w) => a + w.massKg, 0);
  console.log(
    `${titel.padEnd(52)} ${String(Math.round(kg)).padStart(6)} kg  ` +
      `einzeln ${eur(einzeln)}  Paket(${paket.materialId.padEnd(7)}) ${eur(gepresst)}  ` +
      `${(gepresst - einzeln >= 0 ? "+" : "") + (gepresst - einzeln).toFixed(2)} €`
  );
}

function n(name: string, mal: number): Stueck[] {
  const s = ALLE.find((x) => x.name === name);
  if (!s) throw new Error(`kein Eintrag ${name}`);
  return Array.from({ length: mal }, () => alsStueck(s));
}

console.log("\n=== Fraktionen im Katalog ===");
const nachFraktion = new Map<string, number>();
for (const s of ALLE) nachFraktion.set(s.materialId, (nachFraktion.get(s.materialId) ?? 0) + 1);
console.log([...nachFraktion].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  "));

function f(fraktion: string, mal: number, ab = 0): Stueck[] {
  const l = ALLE.filter((x) => x.materialId === fraktion);
  return Array.from({ length: mal }, (_, i) => alsStueck(l[(ab + i) % l.length]!));
}

console.log("\n=== Sortenrein hinein ===");
for (const fr of ["copper", "brass", "alu", "va", "steel", "zinc", "cable"]) {
  fall(`5 × ${fr} (Katalog, erste fünf)`, f(fr, 5));
}
fall("5 × steel, andere fünf", f("steel", 5, 20));
fall("5 × alu, andere fünf", f("alu", 5, 10));
fall("5 × Baggerlöffel (steel 97 / tires 3)", n("Baggerlöffel", 5));
fall("5 × Seecontainer 20 Fuß (steel 95 / wood 5)", n("Seecontainer 20 Fuß", 5));
fall("3 × Seecontainer + 2 × Baggerlöffel", [...n("Seecontainer 20 Fuß", 3), ...n("Baggerlöffel", 2)]);

console.log("\n=== Gemischt hinein ===");
fall("5 × Kühlschrank (Fraktion mixed)", n("Kühlschrank", 5));
fall("3 × Kühlschrank + 2 × Elektroherd", [...n("Kühlschrank", 3), ...n("Elektroherd", 2)]);

/* ------------------------------------------------------------------------ */
/*  Der Tag: was die Umstellung auf Fraktions-Etiketten wirklich verschiebt   */
/* ------------------------------------------------------------------------ */

/** Etikett nach der alten Regel (Rohstoffe + SORTENREIN_AB). */
function etikettAlt(ware: Stueck[]): string {
  const a = new Map<string, number>();
  for (const it of ware)
    for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }])
      a.set(c.materialId, (a.get(c.materialId) ?? 0) + c.massKg);
  const l = [...a].map(([materialId, massKg]) => ({ materialId, massKg }));
  const dom = l.reduce((x, y) => (y.massKg > x.massKg ? y : x));
  const kg = l.reduce((s, c) => s + c.massKg, 0);
  return dom.massKg / Math.max(kg, 1) >= SORTENREIN_AB ? dom.materialId : "mixed";
}

/** Etikett nach der neuen Regel (Fraktionen). */
function etikettNeu(ware: Stueck[]): string {
  const f = new Map<string, number>();
  let kg = 0;
  for (const it of ware) {
    const w = (it.composition ?? [{ massKg: it.massKg }]).reduce((s, c) => s + c.massKg, 0);
    kg += w;
    if (w > 0) f.set(it.materialId, (f.get(it.materialId) ?? 0) + w);
  }
  return fraktionAus(
    [...f].map(([materialId, m]) => ({ materialId, anteil: m / Math.max(kg, 1e-9) })),
    "mixed"
  );
}

console.log("\n=== 96 Tage à 12 Fuhren: verschiebt das neue Etikett etwas? ===");
let unterschiede = 0;
let paketeGesamt = 0;
let euroAlt = 0;
let euroNeu = 0;
let kgGesamt = 0;
let euroNachLadenAlt = 0;
let euroNachLadenNeu = 0;
for (let tag = 0; tag < 96; tag++) {
  for (let fuhre = 0; fuhre < 12; fuhre++) {
    // Eine Fuhre, so wie sie an der Waage ankommt (12 Stück, 20 % Großteile).
    const ladung = randomCargo(12, 0.2).map((s) => ({
      materialId: s.materialId,
      massKg: s.massKg,
      composition: s.shape.zusammensetzung?.map((a) => ({
        materialId: a.materialId,
        massKg: a.anteil * s.massKg,
      })),
    }));
    // Sortiert: nach Fraktion getrennt, jede Fraktion für sich in die Presse.
    const nachFraktion = new Map<string, Stueck[]>();
    for (const t of ladung) {
      const l = nachFraktion.get(t.materialId);
      if (l) l.push(t);
      else nachFraktion.set(t.materialId, [t]);
    }
    for (const gruppe of nachFraktion.values()) {
      if (gruppe.length < 2) {
        euroAlt += verkauf(gruppe);
        euroNeu += verkauf(gruppe);
        kgGesamt += gruppe.reduce((a, g) => a + g.massKg, 0);
        continue;
      }
      paketeGesamt++;
      const a = etikettAlt(gruppe);
      const n = etikettNeu(gruppe);
      if (a !== n) unterschiede++;
      const paket = pressen(gruppe);
      kgGesamt += paket.massKg;
      euroAlt += verkauf([{ ...paket, materialId: a }]);
      euroNeu += verkauf([{ ...paket, materialId: n }]);
      // Und derselbe Ballen nach einem Neuladen, wie es bis zum 16.09. war:
      // ohne Zusammensetzung zaehlt die ganze Masse als seine Fraktion.
      euroNachLadenAlt += verkauf([{ materialId: n, massKg: paket.massKg }]);
      euroNachLadenNeu += verkauf([{ ...paket, materialId: n }]);
    }
  }
}
console.log(
  `${paketeGesamt} Pakete, davon ${unterschiede} mit anderem Etikett ` +
    `(${((100 * unterschiede) / paketeGesamt).toFixed(2)} %)`
);
console.log(
  `Erlös über 96 Tage: alt ${euroAlt.toFixed(2)} €, neu ${euroNeu.toFixed(2)} €, ` +
    `Unterschied ${(euroNeu - euroAlt).toFixed(2)} €`
);
console.log(
  `Nur die Ballen, nach einem Neuladen: bis 16.09. ${euroNachLadenAlt.toFixed(2)} €, jetzt ${euroNachLadenNeu.toFixed(2)} € ` +
    `(${(((euroNachLadenAlt - euroNachLadenNeu) / euroNachLadenNeu) * 100).toFixed(1)} % Abweichung, ` +
    `je Tag ${((euroNachLadenAlt - euroNachLadenNeu) / 96).toFixed(2)} €)`
);
console.log(
  `Je Tag: alt ${(euroAlt / 96).toFixed(2)} €, neu ${(euroNeu / 96).toFixed(2)} €, ` +
    `${(kgGesamt / 96 / 1000).toFixed(1)} t Umschlag`
);

console.log("\n=== Was ein Behälter-Schild dazu sagt ===");
for (const name of ["Kühlschrank", "Baggerlöffel", "Seecontainer 20 Fuß", "Elektroherd"]) {
  const s = ALLE.find((x) => x.name === name)!;
  const st = alsStueck(s);
  console.log(
    `${name.padEnd(24)} Fraktion ${s.materialId.padEnd(8)} ` +
      `Zusammensetzung ${st.composition ? st.composition.map((c) => `${c.materialId} ${Math.round(c.massKg)}`).join(", ") : "—"}`
  );
  console.log(
    `${"".padEnd(24)} Schild(Fraktion voll) ${eur(s.massKg * getMaterial(s.materialId).sellPricePerKg)}  ` +
      `Kasse ${eur(verkauf([st]))}`
  );
}
