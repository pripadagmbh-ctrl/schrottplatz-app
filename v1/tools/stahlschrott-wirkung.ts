/**
 * Was die strengere Stahlschrott-Regel am Umschlag und am Verdienst ändert.
 *
 *     npx vite-node tools/stahlschrott-wirkung.ts
 *
 * Die Frage ist nicht „wie viele Einträge wechseln" (das sagt
 * `stahlschrott-liste.ts`), sondern: Wie viel Geld verdient der Spieler
 * nachher an derselben Arbeit?
 *
 * Der entscheidende Umstand steht in `scrapItems.ts:788-800`: `randomCargo`
 * würfelt **zuerst die Fraktion** (42 % Stahl, 22 % Misch, 16 % Alu, Rest
 * verteilt) und sucht sich **dann** ein passendes Stück. Die Umsortierung
 * verschiebt also nicht, wie oft Stahl kommt — sie verschiebt, **welche
 * Stücke** im Stahltopf liegen und wie schwer die im Mittel sind.
 */
import { MATERIALS, getMaterial } from "../src/materials/catalog";
import { PURCHASE_PRICE_PER_KG } from "../src/economy/account";
import { alleUrteile, type Urteil } from "./stahlschrott";

const z = (n: number, k = 2) =>
  n.toLocaleString("de-DE", { maximumFractionDigits: k, minimumFractionDigits: k });

const urteile = alleUrteile();

/** Der Fraktionsmix einer Anlieferung, abgeschrieben aus `scrapItems.ts:788`. */
const MIX: Record<string, number> = {
  steel: 0.42,
  mixed: 0.22,
  alu: 0.16,
};
const REST = ["va", "copper", "brass", "zinc", "battery", "cable", "wood", "plastic", "rubble"];
for (const id of REST) MIX[id] = 0.2 / REST.length;

/** Deckungsbeitrag je Kilo: Verkaufspreis minus Ankaufspreis, Reinheit 1. */
function margeJeKg(fraktion: string): number {
  return getMaterial(fraktion).sellPricePerKg - PURCHASE_PRICE_PER_KG;
}

/** Erwartete Masse und Marge eines einzelnen angelieferten Stücks. */
function erwartung(pool: Urteil[], welche: "heute" | "neu") {
  let kg = 0;
  let eur = 0;
  for (const [fraktion, p] of Object.entries(MIX)) {
    const treffer = pool.filter((u) => u[welche] === fraktion);
    // Findet randomCargo nichts, greift es blind in den ganzen Topf.
    const aus = treffer.length > 0 ? treffer : pool;
    const mKg = aus.reduce((s, u) => s + u.spec.massKg, 0) / aus.length;
    const mEur =
      aus.reduce((s, u) => s + u.spec.massKg * margeJeKg(u[welche]), 0) / aus.length;
    kg += p * mKg;
    eur += p * mEur;
  }
  return { kg, eur };
}

const listen: [string, string[]][] = [
  ["Kleinteile (SPECS)", ["SPECS"]],
  ["Großteile (BIG_SPECS + KATALOG_BIG)", ["BIG_SPECS", "KATALOG_BIG"]],
  ["Schwergewichte (HUGE_SPECS + KATALOG_HUGE)", ["HUGE_SPECS", "KATALOG_HUGE"]],
];

console.log("");
console.log("## Der Stahltopf, aus dem randomCargo zieht");
console.log("");
console.log("| Ladungsliste | Stahl-Stücke heute | ø kg | Stahl-Stücke neu | ø kg |");
console.log("|---|---:|---:|---:|---:|");
for (const [titel, quellen] of listen) {
  const pool = urteile.filter((u) => quellen.includes(u.liste));
  const h = pool.filter((u) => u.heute === "steel");
  const n = pool.filter((u) => u.neu === "steel");
  const mit = (a: Urteil[]) => (a.length ? a.reduce((s, u) => s + u.spec.massKg, 0) / a.length : 0);
  console.log(
    `| ${titel} | ${h.length} | ${z(mit(h), 0)} | ${n.length} | ${z(mit(n), 0)} |`
  );
}

console.log("");
console.log("## Was eine Anlieferung einbringt (Reinheit 1, ein Stück)");
console.log("");
console.log("| Ladungsliste | ø kg heute | ø € heute | ø kg neu | ø € neu | Verdienst |");
console.log("|---|---:|---:|---:|---:|---:|");
for (const [titel, quellen] of listen) {
  const pool = urteile.filter((u) => quellen.includes(u.liste));
  const h = erwartung(pool, "heute");
  const n = erwartung(pool, "neu");
  const faktor = h.eur !== 0 ? (n.eur / h.eur - 1) * 100 : 0;
  console.log(
    `| ${titel} | ${z(h.kg, 0)} | ${z(h.eur)} | ${z(n.kg, 0)} | ${z(n.eur)} | ${faktor >= 0 ? "+" : ""}${z(faktor, 0)} % |`
  );
}

console.log("");
console.log("## Die beiden Halden am Bagger");
console.log("");
for (const welche of ["heute", "neu"] as const) {
  const st = urteile.filter((u) => u[welche] === "steel");
  const mi = urteile.filter((u) => u[welche] === "mixed");
  const kg = (a: Urteil[]) => a.reduce((s, u) => s + u.spec.massKg, 0);
  const anteil = (100 * st.length) / (st.length + mi.length);
  console.log(
    `${welche.padEnd(6)}: STAHLSCHROTT ${st.length} Sorten / ${z(kg(st) / 1000, 1)} t  ·  ` +
      `MISCHSCHROTT ${mi.length} Sorten / ${z(kg(mi) / 1000, 1)} t  ·  ` +
      `Stahlanteil ${z(anteil, 0)} % der Sorten`
  );
}

console.log("");
console.log("");
console.log("## Was in die beiden Halden fliesst — je 100 angelieferte Kleinteile");
console.log("");
for (const welche of ["heute", "neu"] as const) {
  const pool = urteile.filter((u) => u.liste === "SPECS");
  const mit = (f: string) => {
    const a = pool.filter((u) => u[welche] === f);
    return a.length ? a.reduce((s, u) => s + u.spec.massKg, 0) / a.length : 0;
  };
  const stahlKg = 100 * MIX.steel * mit("steel");
  const mischKg = 100 * MIX.mixed * mit("mixed");
  console.log(
    `${welche.padEnd(6)}: STAHLSCHROTT ${z(stahlKg, 0)} kg  ·  MISCHSCHROTT ${z(mischKg, 0)} kg  ·  ` +
      `Verhaeltnis ${z(stahlKg / mischKg, 2)} : 1`
  );
}

console.log(
  `Preise: Stahlschrott ${MATERIALS.steel.sellPricePerKg * 1000} €/t, ` +
    `Mischschrott ${MATERIALS.mixed.sellPricePerKg * 1000} €/t, ` +
    `Ankauf ${PURCHASE_PRICE_PER_KG * 1000} €/t (catalog.ts, account.ts:16)`
);
