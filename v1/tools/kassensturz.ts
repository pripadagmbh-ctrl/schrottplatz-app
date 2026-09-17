/**
 * Kassensturz — stimmt das Muldenschild mit der Kasse ueberein?
 *
 * Misst die Befunde W-1 bis W-10 aus `docs/fraktionen.md` gegen den HEUTIGEN
 * Stand nach. Jede Zeile nennt beide Zahlen fuer DIESELBE Ladung:
 *   Schild = `Container.value` → `containerValueGemischt` (Rechnung A)
 *   Kasse  = `Account.sellContainer`                      (Rechnung B)
 *
 * Aufruf: npx vite-node tools/kassensturz.ts
 */
import { Account } from "../src/economy/account";
import { getMaterial } from "../src/materials/catalog";
import { containerValueGemischt } from "../src/materials/purity";
import { CONFIGS, gehoertHierhin, type ContainerConfig } from "../src/world/containers";
import { abrechnungsgruppe } from "../src/economy/fraktionsgruppen";
import { randomCargo } from "../src/world/scrapItems";

const items = { remove: () => {} } as never;
const comps = { despawnByBody: () => false } as never;

interface Stueck {
  materialId: string;
  massKg: number;
  composition?: Array<{ materialId: string; massKg: number }>;
}

function cfg(id: string): ContainerConfig {
  const c = CONFIGS.find((x) => x.id === id);
  if (!c) throw new Error(`kein Behaelter ${id}`);
  return c;
}

/** Was auf dem Schild steht, wenn genau diese Stuecke in der Mulde liegen. */
function schild(c: ContainerConfig, ware: Stueck[]): { eur: number; rein: number } {
  const massen = new Map<string, number>();
  let gesamt = 0;
  let passend = 0;
  for (const w of ware) {
    massen.set(w.materialId, (massen.get(w.materialId) ?? 0) + w.massKg);
    gesamt += w.massKg;
    if (gehoertHierhin(c, w.materialId)) passend += w.massKg;
  }
  return {
    eur: containerValueGemischt(
      massen,
      (id) => gehoertHierhin(c, id),
      (id) => getMaterial(id).sellPricePerKg
    ),
    rein: gesamt > 0 ? passend / gesamt : 1,
  };
}

function kasse(ware: Stueck[], order?: string | null) {
  const ladung = ware.map((w) => ({ ...w, body: null }));
  return new Account().sellContainer(ladung as never, items, comps, order ?? null);
}

function s(materialId: string, massKg: number): Stueck {
  return { materialId, massKg };
}

function eur(x: number): string {
  return `${x.toFixed(2).padStart(10)} €`;
}

function zeile(
  nr: string,
  was: string,
  c: ContainerConfig,
  ware: Stueck[],
  order?: string | null
): void {
  const a = schild(c, ware);
  const b = kasse(ware, order);
  const faktor = b.eur === 0 ? Infinity : a.eur / b.eur;
  console.log(
    `${nr.padEnd(5)} ${was.padEnd(52)} Schild ${eur(a.eur)} (${(a.rein * 100).toFixed(0)} %)  ` +
      `Kasse ${eur(b.eur)} (${(b.purity * 100).toFixed(0)} %, ${b.dominant})  ` +
      `Faktor ${Number.isFinite(faktor) ? faktor.toFixed(2) : "∞"}`
  );
}

console.log("\n=== W-1 bis W-6: Schild gegen Kasse, gemessen am Stand von heute ===");
const bunt = cfg("r_bunt");
zeile("W-1", "BUNT+VA, je 100 kg alu zinc copper brass cable va", bunt, [
  s("copper", 100),
  s("alu", 100),
  s("zinc", 100),
  s("brass", 100),
  s("cable", 100),
  s("va", 100),
]);
zeile("W-2", "BUNT+VA ohne VA, je 100 kg alu zinc copper brass cable", bunt, [
  s("copper", 100),
  s("alu", 100),
  s("zinc", 100),
  s("brass", 100),
  s("cable", 100),
]);
zeile("W-3", "KUPFER-LAGER, 100 kg Kupfer + 100 kg Messing", cfg("c_copper_lager"), [
  s("copper", 100),
  s("brass", 100),
]);
zeile("W-4", "ALU-LAGER, 100 kg Alu + 100 kg Zink", cfg("c_alu_lager"), [
  s("alu", 100),
  s("zinc", 100),
]);
zeile("W-5", "MUELL, je 100 kg rubble tires wood plastic", cfg("r_rubble"), [
  s("rubble", 100),
  s("tires", 100),
  s("wood", 100),
  s("plastic", 100),
]);
zeile("W-6", "STAHLSCHROTT-Halde, 400 kg Stahl + 600 kg Misch", cfg("c_steel"), [
  s("steel", 400),
  s("mixed", 600),
]);

console.log("\n=== W-6 mit Bestellung: derselbe Haufen als Stahlfuhre ===");
zeile("W-6b", "STAHLSCHROTT-Halde, Abholer fuer Stahl bestellt", cfg("c_steel"),
  [s("steel", 400), s("mixed", 600)], "steel");

console.log("\n=== W-1: ist das Schild der BUNT+VA-Mulde erreichbar? ===");
const buntInhalt = [
  s("copper", 100), s("alu", 100), s("zinc", 100),
  s("brass", 100), s("cable", 100), s("va", 100),
];
const ueberSilos =
  kasse([s("copper", 100), s("brass", 100)], "copper").eur +
  kasse([s("alu", 100), s("zinc", 100)], "alu").eur +
  kasse([s("cable", 100)], "cable").eur +
  kasse([s("va", 100)], "va").eur;
console.log(`  Schild der Mulde          ${eur(schild(bunt, buntInhalt).eur)}`);
console.log(`  ueber die vier Silos      ${eur(ueberSilos)}`);
console.log(`  alles in EINEM Zug gekippt ${eur(kasse(buntInhalt).eur)}`);

console.log("\n=== Der Kuehlschrank: Fraktion gegen Rohstoff ===");
const kuehl = {
  materialId: "mixed",
  massKg: 55,
  composition: [
    { materialId: "steel", massKg: 55 * 0.52 },
    { materialId: "alu", massKg: 55 * 0.1 },
    { materialId: "copper", massKg: 55 * 0.06 },
    { materialId: "plastic", massKg: 55 * 0.32 },
  ],
};
console.log(`  1 Kuehlschrank (55 kg): Schild ${eur(55 * getMaterial("mixed").sellPricePerKg)}  Kasse ${eur(kasse([kuehl]).eur)}`);
const fuenf = [kuehl, kuehl, kuehl, kuehl, kuehl];
console.log(`  5 Kuehlschraenke (275 kg): Schild ${eur(275 * getMaterial("mixed").sellPricePerKg)}  Kasse ${eur(kasse(fuenf).eur)}`);

console.log("\n=== W-10: entscheidet die Ladereihenfolge? ===");
const fuhre = [s("alu", 100), s("zinc", 100), s("copper", 100), s("brass", 100), s("cable", 100)];
const kupferZuerst = [fuhre[2], ...fuhre.filter((_, i) => i !== 2)];
console.log(`  Alu zuerst    ${eur(kasse(fuhre).eur)}  dominant ${kasse(fuhre).dominant}`);
console.log(`  Kupfer zuerst ${eur(kasse(kupferZuerst).eur)}  dominant ${kasse(kupferZuerst).dominant}`);

console.log("\n=== W-9: lohnt sich Abfall gemischt? ===");
const abfall = [s("rubble", 100), s("tires", 100), s("wood", 100), s("plastic", 100)];
const getrennt = abfall.reduce((sum, t) => sum + kasse([t]).eur, 0);
console.log(`  getrennt abgefahren ${eur(getrennt)} · gemischt ${eur(kasse(abfall).eur)}`);

console.log("\n=== W-8: zwei Reinheiten auf einem Bildschirm ===");
const cu = [s("copper", 100), s("brass", 100)];
console.log(
  `  Muldenschild ${(schild(cfg("c_copper_lager"), cu).rein * 100).toFixed(0)} % · ` +
    `Ladeanzeige (bestellt: copper) ${(kasse(cu, "copper").purity * 100).toFixed(0)} %`
);

console.log("\n=== W-7: welchen Preis bekommt Kupfer+Messing wirklich? ===");
for (const [erst, zweit] of [
  ["copper", "brass"],
  ["brass", "copper"],
] as const) {
  const r = kasse([s(erst, 150), s(zweit, 100)]);
  console.log(`  ${erst} 150 kg + ${zweit} 100 kg → Preis von ${r.dominant}, ${eur(r.eur)}`);
}

/* ------------------------------------------------------------------------ */
/*  96 Tage à 12 Fuhren: was die Reparatur am Verdienst verschiebt            */
/* ------------------------------------------------------------------------ */

/**
 * Die Kasse, wie sie bis zum 16.09.2026 rechnete — ROHSTOFFE, eine
 * Leitfraktion, ihr Preis fuer alles, Reinheit hoch drei, `mitFraktionen`
 * unbekannt. Woertlich aus `account.ts` vor E-094 uebernommen.
 */
function alteKasse(ware: Stueck[], order?: string | null): number {
  const massen = new Map<string, number>();
  let gesamt = 0;
  for (const it of ware) {
    for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }]) {
      massen.set(c.materialId, (massen.get(c.materialId) ?? 0) + c.massKg);
      gesamt += c.massKg;
    }
  }
  if (gesamt <= 0) return 0;
  let dominant = "";
  let dominantKg = 0;
  if (order && massen.has(order)) {
    dominant = order;
    dominantKg = massen.get(order)!;
  } else {
    for (const [id, kg] of massen) {
      if (kg > dominantKg) {
        dominantKg = kg;
        dominant = id;
      }
    }
  }
  const r = dominantKg / gesamt;
  return gesamt * getMaterial(dominant).sellPricePerKg * r * r * r;
}

const ANKAUF_JE_KG = 0.16; // PURCHASE_PRICE_PER_KG (account.ts:16)

const TAGE = 96;
const FUHREN = 12;
let ankauf = 0;
let kgGesamt = 0;
let altFraktion = 0;
let neuFraktion = 0;
let altGruppe = 0;
let neuGruppe = 0;
let altAlles = 0;
let neuAlles = 0;

for (let tag = 0; tag < TAGE; tag++) {
  for (let f = 0; f < FUHREN; f++) {
    const ladung: Stueck[] = randomCargo(12, 0.2).map((sp) => ({
      materialId: sp.materialId,
      massKg: sp.massKg,
      composition: sp.shape.zusammensetzung?.map((a) => ({
        materialId: a.materialId,
        massKg: a.anteil * sp.massKg,
      })),
    }));
    const kg = ladung.reduce((sum, w) => sum + w.massKg, 0);
    kgGesamt += kg;
    ankauf += kg * ANKAUF_JE_KG;
    // Weg 1: je Fraktion ein eigener Abholer.
    const jeFraktion = new Map<string, Stueck[]>();
    for (const t of ladung) {
      const l = jeFraktion.get(t.materialId);
      if (l) l.push(t);
      else jeFraktion.set(t.materialId, [t]);
    }
    for (const [fr, gruppe] of jeFraktion) {
      altFraktion += alteKasse(gruppe, fr);
      neuFraktion += kasse(gruppe, fr).eur;
    }
    // Weg 2: je MULDE ein Abholer — Kupfer und Messing zusammen usw.
    const jeGruppe = new Map<string, Stueck[]>();
    for (const t of ladung) {
      const schluessel = abrechnungsgruppe(t.materialId).slice().sort().join("+");
      const l = jeGruppe.get(schluessel);
      if (l) l.push(t);
      else jeGruppe.set(schluessel, [t]);
    }
    for (const gruppe of jeGruppe.values()) {
      altGruppe += alteKasse(gruppe);
      neuGruppe += kasse(gruppe).eur;
    }
    // Weg 3: gar nicht sortiert, alles auf einen Wagen.
    altAlles += alteKasse(ladung);
    neuAlles += kasse(ladung).eur;
  }
}

const je = (x: number): string => `${(x / TAGE).toFixed(2).padStart(10)} €`;
console.log(`\n=== ${TAGE} Tage à ${FUHREN} Fuhren — Tagesverdienst vorher/nachher ===`);
console.log(`  Umschlag je Tag                   ${(kgGesamt / TAGE / 1000).toFixed(2)} t`);
console.log(`  Ankauf je Tag                 ${je(-ankauf)}`);
console.log(`  Erlös je Fraktion sortiert  alt ${je(altFraktion)}   neu ${je(neuFraktion)}`);
console.log(`  Erlös je MULDE sortiert     alt ${je(altGruppe)}   neu ${je(neuGruppe)}`);
console.log(`  Erlös gar nicht sortiert    alt ${je(altAlles)}   neu ${je(neuAlles)}`);
console.log(
  `  VERDIENST (Mulde − Ankauf)  alt ${je(altGruppe - ankauf)}   neu ${je(neuGruppe - ankauf)}`
);
console.log(
  `  Verschiebung: Faktor ${((neuGruppe - ankauf) / (altGruppe - ankauf)).toFixed(2)} ` +
    `(${((neuGruppe - altGruppe) / TAGE).toFixed(2)} € je Tag mehr Erlös)`
);
