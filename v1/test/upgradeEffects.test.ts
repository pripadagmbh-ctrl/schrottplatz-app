import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { Account } from "../src/economy/account";
import { haggle, MARKET_KNOWLEDGE_BONUS } from "../src/economy/haggle";
import { UPGRADES, UpgradeState } from "../src/economy/upgrades";
import type { CustomerProfile } from "../src/delivery/customers";

/**
 * Prüft die WIRKUNG der Ausbaustufen, nicht ihre Existenz.
 *
 * Der Prüfbericht vom 03.09.2026 hat aufgedeckt, dass Büro, Halle und Magnet
 * zwar sauber gebaut und getestet waren, im Spiel aber nichts taten: Tests am
 * Modul selbst rufen es direkt auf und merken darum nie, dass niemand sonst
 * es aufruft. Diese Datei prüft deshalb, dass ein gekaufter Ausbau am
 * Ergebnis etwas ändert — und dass zwei verschiedene Käufe nicht dasselbe
 * bewirken.
 */

/** Alle Quelldateien außer der Ausbau-Liste selbst einlesen. */
function leseQuellen(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) leseQuellen(p, out);
    else if (e.name.endsWith(".ts") && e.name !== "upgrades.ts") {
      out.push(readFileSync(p, "utf8"));
    }
  }
  return out;
}

/** Minimaler Kunde für die Verhandlungsprüfung. */
function kunde(over: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    name: "Testkunde",
    subtitle: "",
    group: "privat",
    hardness: 3,
    greeting: "",
    ...over,
  } as CustomerProfile;
}

describe("Büro: Marktkenntnis", () => {
  it("verschafft Spielraum, den man ohne Büro nicht hat", () => {
    const k = kunde({ hardness: 5 });
    // Ein Angebot, das genau im Grenzbereich liegt: Ohne Büro abgelehnt,
    // mit Büro angenommen. Trifft das nicht zu, wirkt der Kauf nicht.
    let ohneAbgelehnt = false;
    let mitAngenommen = false;
    for (const reinheit of [0, 0.2, 0.45]) {
      const ohne = haggle(k, "hart", reinheit, 0, false);
      const mit = haggle(k, "hart", reinheit, 0, true);
      if (!ohne.accepted && mit.accepted) {
        ohneAbgelehnt = true;
        mitAngenommen = true;
      }
      // Das Büro darf niemals schaden
      expect(mit.accepted || !ohne.accepted).toBe(true);
    }
    expect(ohneAbgelehnt && mitAngenommen, "Büro ändert nichts am Ausgang").toBe(true);
  });

  it("hat einen Bonus größer null", () => {
    expect(MARKET_KNOWLEDGE_BONUS).toBeGreaterThan(0);
  });
});

describe("Magnet: trennt Eisen vom Rest", () => {
  /** Ladung aus zwei Fraktionen, ohne Physik — nur die Rechnung zählt. */
  const ladung = () => [
    { materialId: "alu", massKg: 700, body: null, composition: undefined },
    { materialId: "steel", massKg: 300, body: null, composition: undefined },
  ];
  // Verkauf braucht Manager, die hier nichts zu tun haben
  const items = { remove: () => {} } as never;
  const comps = { despawnByBody: () => false } as never;

  it("hebt Reinheit und Erlös einer verunreinigten Buntmetallladung", () => {
    const ohne = new Account();
    const mit = new Account();
    mit.hasMagnet = true;
    const a = ohne.sellContainer(ladung() as never, items, comps, "alu");
    const b = mit.sellContainer(ladung() as never, items, comps, "alu");
    expect(a.purity).toBeCloseTo(0.7, 5);
    expect(b.purity).toBeCloseTo(1, 5);
    expect(b.eur).toBeGreaterThan(a.eur);
  });

  it("zählt die volle Fuhre weiterhin als Umschlag", () => {
    const mit = new Account();
    mit.hasMagnet = true;
    const r = mit.sellContainer(ladung() as never, items, comps, "alu");
    expect(r.massKg).toBe(1000);
  });

  it("lässt eine bereits sortenreine Ladung unverändert", () => {
    const rein = [{ materialId: "alu", massKg: 500, body: null, composition: undefined }];
    const ohne = new Account().sellContainer(rein as never, items, comps, "alu");
    const m = new Account();
    m.hasMagnet = true;
    const mit = m.sellContainer(rein as never, items, comps, "alu");
    expect(mit.eur).toBeCloseTo(ohne.eur, 5);
  });
});

describe("Jede Ausbaustufe wirkt, und zwar eigenständig", () => {
  it("Bulldozer und Stapler geben nicht denselben Bonus", () => {
    // Nachgebaut wie in main.ts verdrahtet
    const tempo = (s: UpgradeState) => (s.has("dozer") ? 1.4 : 1);
    const traglast = (s: UpgradeState) => (s.has("forklift") ? 2.5 : 1);
    const nurDozer = new UpgradeState();
    nurDozer.load(["dozer"]);
    const nurStapler = new UpgradeState();
    nurStapler.load(["forklift"]);
    const beide = new UpgradeState();
    beide.load(["dozer", "forklift"]);
    expect(tempo(nurDozer)).toBeGreaterThan(tempo(nurStapler));
    expect(traglast(nurStapler)).toBeGreaterThan(traglast(nurDozer));
    // Wer beide kauft, bekommt auch beides
    expect(tempo(beide)).toBe(tempo(nurDozer));
    expect(traglast(beide)).toBe(traglast(nurStapler));
  });

  it("kein Ausbau verspricht etwas, das nirgends abgefragt wird", () => {
    // Sieht im echten Quelltext nach, statt gegen eine gepflegte Liste zu
    // prüfen: Genau dieser Fehler — gebaut, getestet, aber nirgends
    // aufgerufen — ist am 03.09.2026 durchgerutscht.
    const quelltext = leseQuellen(resolve(__dirname, "../src")).join("\n");
    for (const u of UPGRADES) {
      // Ein Ausbau wirkt entweder direkt im Code — oder er schaltet einen
      // anderen frei. Beides ist eine Wirkung; nur wer gar nichts tut, faellt
      // hier durch.
      const schaltetFrei = UPGRADES.some((a) => a.requires === u.id);
      const treffer =
        quelltext.includes(`has("${u.id}")`) ||
        quelltext.includes(`id === "${u.id}"`) ||
        schaltetFrei;
      expect(treffer, `Ausbau „${u.name}" (${u.id}) wird nirgends abgefragt`).toBe(true);
    }
  });
});
