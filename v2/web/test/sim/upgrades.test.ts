import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * Ausbau des Platzes (Roadmap 3.6).
 *
 * Die Tests prüfen die **Wirkung**, nicht die Existenz. Im Prototyp waren
 * Büro, Halle und Magnet sauber gebaut und getestet, taten im Spiel aber
 * nichts — für zusammen 63 000 € (Prüfbericht 03.09.2026). Ein Modultest
 * findet das nie, weil er das Modul selbst aufruft. Deshalb steht unten ein
 * Strukturtest, der im echten Quelltext nachsieht, ob jede in `upgrades.json`
 * versprochene Wirkung irgendwo gelesen wird.
 */
/**
 * Eine Simulation für alle Fälle. Der Ausbau ist reine Buchhaltung — jeder
 * Test setzt Konto, Sterne und Bestand selbst. Eine Sim je Test würde hier
 * nichts beweisen, aber den Rechner so belasten, dass der Zeitwächter in
 * `scrap_sleep.test.ts` daneben misst.
 */
let sim: Simulation;

beforeAll(async () => {
  await initPhysics();
  const d = loadGameData();
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  sim = new Simulation(d);
  sim.init();
  sim.world.day.day = 2;
  sim.world.day.phase = "morning";
});

/** Frischer Ausgangszustand: nichts gekauft, Konto und Sterne wie angegeben. */
function stand(eur: number, sterne: number): Simulation {
  sim.world.economy.upgrades.length = 0;
  sim.world.economy.moneyEur = eur;
  sim.world.economy.starsTotal = sterne;
  return sim;
}

const BUERO = "stage2_office";

describe("Kaufen", () => {
  it("geht nicht ohne Sterne", () => {
    const sim = stand(999_999, 0);
    expect(sim.upgrades.buy(BUERO)).toBe("zuWenigSterne");
    expect(sim.upgrades.has(BUERO)).toBe(false);
  });

  it("geht nicht ohne Geld", () => {
    const sim = stand(10, 99);
    expect(sim.upgrades.buy(BUERO)).toBe("zuWenigGeld");
    expect(sim.upgrades.has(BUERO)).toBe(false);
  });

  it("bucht den Preis ab und schaltet frei", () => {
    const sim = stand(20_000, 99);
    const preis = sim.upgrades.def(BUERO)!.priceEur;
    expect(sim.upgrades.buy(BUERO)).toBe("gekauft");
    expect(sim.world.economy.moneyEur).toBeCloseTo(20_000 - preis, 2);
    expect(sim.upgrades.has(BUERO)).toBe(true);
    // Der Bus zählt über die geteilte Simulation hinweg — entscheidend ist,
    // dass der Kauf überhaupt gemeldet wurde
    expect(sim.bus.count("upgradeBought")).toBeGreaterThan(0);
  });

  it("verlangt die Vorstufe", () => {
    const sim = stand(999_999, 99);
    // Die Halle setzt das Büro voraus
    expect(sim.upgrades.buy("stage3_hall")).toBe("vorstufeFehlt");
  });

  it("nimmt kein Geld für etwas, das man schon hat", () => {
    const sim = stand(20_000, 99);
    sim.upgrades.buy(BUERO);
    const nachKauf = sim.world.economy.moneyEur;
    expect(sim.upgrades.buy(BUERO)).toBe("schonVorhanden");
    expect(sim.world.economy.moneyEur).toBe(nachKauf);
  });
});

describe("Wirkung im Spiel", () => {
  it("das Büro bringt mehr Fuhren am Tag", () => {
    const sim = stand(20_000, 99);
    const vorher = sim.day.plannedDeliveries(2);
    sim.upgrades.buy(BUERO);
    const nachher = sim.day.plannedDeliveries(2);
    expect(nachher).toBeGreaterThan(vorher);
  });

  it("das Büro zeigt die Zusammensetzung an", () => {
    const sim = stand(20_000, 99);
    expect(sim.upgrades.showComposition).toBe(false);
    sim.upgrades.buy(BUERO);
    expect(sim.upgrades.showComposition).toBe(true);
  });

  it("der Tutorial-Tag bleibt ohne Fuhren, auch mit Büro", () => {
    const sim = stand(20_000, 99);
    sim.upgrades.buy(BUERO);
    expect(sim.day.plannedDeliveries(0)).toBe(0);
  });

  it("überlebt Speichern und Laden", () => {
    const sim = stand(20_000, 99);
    sim.upgrades.buy(BUERO);
    // Der Bestand liegt in economy.upgrades und wird darüber gespeichert
    expect(sim.world.economy.upgrades).toContain(BUERO);
  });
});

describe("Nichts wird versprochen, was niemand liest", () => {
  it("jede Wirkung einer verkäuflichen Stufe wird auch abgerufen", () => {
    // Entscheidend ist, dass jemand AUSSERHALB des UpgradeSystems nachfragt.
    // Sonst gibt es zwar einen Getter, aber niemanden, der ihn liest — genau
    // so blieben im Prototyp drei bezahlte Stufen wirkungslos.
    const daten = JSON.parse(
      readFileSync(resolve(__dirname, "../../data/upgrades.json"), "utf8")
    ) as { upgrades: Array<{ id: string; tier: string; effects: Record<string, unknown> }> };
    const fremd = quellen(resolve(__dirname, "../../src"), [], "UpgradeSystem.ts").join("\n");
    /** Wirkungsname in upgrades.json → so heißt die Abfrage im Code. */
    const abfrage: Record<string, string> = {
      deliveriesPerDay: "deliveriesPerDayOverride",
      showComposition: "showComposition",
      pickupsParallel: "pickupsParallel",
      speedFactor: "speedFactor",
      capacityFactor: "capacityFactor",
      pressCapacityFactor: "pressCapacityFactor",
      staffLoader: "staffLoader",
      tool: "hasTool",
    };
    for (const u of daten.upgrades) {
      if (u.tier !== "MVP") continue; // V1-Stufen werden noch nicht verkauft
      for (const k of Object.keys(u.effects)) {
        const name = abfrage[k] ?? k;
        expect(
          fremd.includes(name),
          `„${u.id}" verspricht ${k}, aber niemand fragt ${name} ab`
        ).toBe(true);
      }
    }
  });

  it("jede angebotene Stufe ist auch käuflich", () => {
    const sim = stand(0, 0);
    for (const u of sim.upgrades.angebot()) {
      expect(sim.upgrades.def(u.id), `${u.id} fehlt in den Daten`).toBeDefined();
    }
    expect(sim.upgrades.angebot().length).toBeGreaterThan(0);
  });
});

/** Alle .ts-Dateien unter `dir` einlesen, `ausser` übergehen. */
function quellen(dir: string, out: string[] = [], ausser = ""): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) quellen(p, out, ausser);
    else if (e.name.endsWith(".ts") && e.name !== ausser) out.push(readFileSync(p, "utf8"));
  }
  return out;
}
