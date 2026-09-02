import { describe, it, expect } from "vitest";
import {
  FAMILIES,
  TRADES,
  rollCustomer,
  vehicleForCustomer,
  type CustomerProfile,
} from "../src/delivery/customers";
import { Reputation, REP_MAX } from "../src/economy/reputation";
import { getMaterial } from "../src/materials/catalog";

/** Viele Ziehungen, damit auch seltene Fälle vorkommen. */
function ziehe(n: number): CustomerProfile[] {
  return Array.from({ length: n }, () => rollCustomer());
}

describe("Kundschaft", () => {
  it("liefert alle drei Gruppen", () => {
    const gruppen = new Set(ziehe(400).map((c) => c.group));
    expect(gruppen).toContain("privat");
    expect(gruppen).toContain("haendler");
    expect(gruppen).toContain("gewerbe");
  });

  it("hält die Mengen je Gruppe auseinander", () => {
    for (const c of ziehe(500)) {
      if (c.group === "privat") {
        expect(c.massKg, "Privat bringt Kofferraummengen").toBeLessThan(800);
        expect(c.massKg).toBeGreaterThanOrEqual(50);
      } else {
        expect(c.massKg, `${c.group} bringt Fuhren`).toBeGreaterThanOrEqual(1000);
        expect(c.massKg).toBeLessThan(20001);
      }
    }
  });

  it("lässt nur Gewerbe zuverlässig sortenrein liefern", () => {
    const proben = ziehe(600);
    const gewerbe = proben.filter((c) => c.group === "gewerbe");
    const privat = proben.filter((c) => c.group === "privat");
    expect(gewerbe.every((c) => c.sortedMaterial !== null), "Gewerbe trennt im Betrieb").toBe(true);
    expect(privat.every((c) => c.sortedMaterial === null), "Haushalt ist gemischt").toBe(true);
  });

  it("gibt Privatleuten den höchsten Störstoffanteil", () => {
    const proben = ziehe(600);
    const mittel = (g: string): number => {
      const l = proben.filter((c) => c.group === g);
      return l.reduce((s, c) => s + c.contaminantShare, 0) / l.length;
    };
    expect(mittel("privat")).toBeGreaterThan(mittel("haendler"));
  });

  it("macht Händler zu den härtesten Verhandlern", () => {
    const proben = ziehe(600);
    const maxHaerte = (g: string): number =>
      Math.max(...proben.filter((c) => c.group === g).map((c) => c.hardness));
    expect(maxHaerte("haendler")).toBeGreaterThan(maxHaerte("privat"));
    expect(maxHaerte("haendler")).toBeGreaterThan(maxHaerte("gewerbe"));
  });

  it("schickt jede Gruppe im passenden Fahrzeug", () => {
    for (const c of ziehe(400)) {
      const v = vehicleForCustomer(c);
      expect(["kipper", "pritsche", "wrack"]).toContain(v);
      if (c.group === "privat") {
        // Kein Privatmann kommt mit dem Kipper
        expect(v).not.toBe("kipper");
      }
    }
  });

  it("gibt jedem Kunden einen Namen und ein Wort", () => {
    for (const c of ziehe(200)) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.subtitle.length).toBeGreaterThan(2);
      expect(c.greeting.length).toBeGreaterThan(4);
    }
  });
});

describe("Stammfiguren", () => {
  it("hat alle acht Händlerfamilien mit Sprüchen", () => {
    expect(FAMILIES).toHaveLength(8);
    for (const f of FAMILIES) {
      expect(f.family.length, "Familienname").toBeGreaterThan(3);
      expect(f.firstName.length, `${f.family} braucht einen Vornamen`).toBeGreaterThan(2);
      expect(f.hardness).toBeGreaterThanOrEqual(1);
      expect(f.hardness).toBeLessThanOrEqual(5);
      expect(f.greetings.length, `${f.family} braucht Sprüche`).toBeGreaterThanOrEqual(2);
      if (f.typical) expect(() => getMaterial(f.typical!)).not.toThrow();
    }
  });

  it("nennt für jede Branche ein bekanntes Material", () => {
    expect(TRADES.length).toBeGreaterThanOrEqual(6);
    for (const t of TRADES) {
      expect(() => getMaterial(t.material), `${t.name}`).not.toThrow();
      expect(t.beifang).toBeGreaterThanOrEqual(0);
      expect(t.beifang, `${t.name} soll nicht überwiegend Beifang liefern`).toBeLessThan(0.5);
    }
  });

  it("hat für jede Familie einen eigenen Namen", () => {
    const namen = FAMILIES.map((f) => f.family);
    expect(new Set(namen).size).toBe(namen.length);
  });
});

describe("Ruf", () => {
  it("beginnt neutral", () => {
    const r = new Reputation();
    expect(r.get("privat")).toBe(0);
    expect(r.label("haendler")).toBe("neutral");
  });

  it("trifft Privatleute am härtesten, wenn man drückt", () => {
    const r = new Reputation();
    r.note("hartGedrueckt", "privat");
    const privat = r.get("privat");
    const r2 = new Reputation();
    r2.note("hartGedrueckt", "haendler");
    expect(privat).toBeLessThan(r2.get("haendler"));
  });

  it("lässt Gewerbe nur die Zuverlässigkeit zählen", () => {
    const preis = new Reputation();
    preis.note("hartGedrueckt", "gewerbe");
    expect(preis.get("gewerbe"), "Preis ist Gewerbe gleich").toBe(0);

    const zeit = new Reputation();
    zeit.note("langeWartenLassen", "gewerbe");
    expect(zeit.get("gewerbe"), "Wartezeit nicht").toBeLessThan(0);
  });

  it("lässt Händler am langsamsten vergessen", () => {
    const r = new Reputation();
    r.note("hartGedrueckt", "haendler");
    r.note("hartGedrueckt", "privat");
    const vorherH = r.get("haendler");
    const vorherP = r.get("privat");
    r.decay(1);
    // Wie viel Prozent des Grolls ist geblieben?
    expect(r.get("haendler") / vorherH).toBeGreaterThan(r.get("privat") / vorherP);
  });

  it("bleibt in den Grenzen", () => {
    const r = new Reputation();
    for (let i = 0; i < 100; i++) r.note("fairBezahlt", "privat");
    expect(r.get("privat")).toBeLessThanOrEqual(REP_MAX);
    for (let i = 0; i < 300; i++) r.note("hartGedrueckt", "privat");
    expect(r.get("privat")).toBeGreaterThanOrEqual(-100);
  });

  it("bringt bei gutem Ruf mehr Fuhren, bei schlechtem nie null", () => {
    const gut = new Reputation();
    for (let i = 0; i < 50; i++) gut.note("fairBezahlt", "privat");
    const schlecht = new Reputation();
    for (let i = 0; i < 50; i++) schlecht.note("hartGedrueckt", "privat");
    expect(gut.frequencyFactor("privat")).toBeGreaterThan(1);
    expect(schlecht.frequencyFactor("privat")).toBeLessThan(1);
    expect(schlecht.frequencyFactor("privat"), "nie ganz versiegen").toBeGreaterThan(0.2);
  });

  it("überlebt Speichern und Laden", () => {
    const r = new Reputation();
    r.note("fairBezahlt", "privat");
    r.note("langeWartenLassen", "gewerbe");
    const b = new Reputation();
    b.load(r.toJSON());
    expect(b.get("privat")).toBe(r.get("privat"));
    expect(b.get("gewerbe")).toBe(r.get("gewerbe"));
  });
});
