import { describe, it, expect } from "vitest";
import { UPGRADES, UpgradeState, getUpgrade } from "../src/economy/upgrades";
import { Account, CREDIT_LIMIT_EUR } from "../src/economy/account";

describe("Ausbau des Platzes", () => {
  it("führt jedes Upgrade mit Preis, Wirkung und Schwelle", () => {
    expect(UPGRADES.length).toBeGreaterThanOrEqual(5);
    for (const u of UPGRADES) {
      expect(u.name.length, u.id).toBeGreaterThan(3);
      expect(u.effect.length, `${u.name} braucht eine Wirkung`).toBeGreaterThan(15);
      expect(u.priceEur, `${u.name} braucht einen Preis`).toBeGreaterThan(0);
      expect(u.requiresTurnoverKg).toBeGreaterThanOrEqual(0);
    }
  });

  it("staffelt Preise und Schwellen aufsteigend", () => {
    for (let i = 1; i < UPGRADES.length; i++) {
      expect(UPGRADES[i].priceEur, `${UPGRADES[i].name} teurer als davor`).toBeGreaterThan(
        UPGRADES[i - 1].priceEur
      );
      expect(UPGRADES[i].requiresTurnoverKg).toBeGreaterThanOrEqual(
        UPGRADES[i - 1].requiresTurnoverKg
      );
    }
  });

  it("gibt den Radlader von Anfang an frei", () => {
    const s = new UpgradeState();
    expect(s.available("loader", 0), "ohne Umschlag kaufbar").toBe(true);
    expect(s.available("dozer", 0), "der Bulldozer erst später").toBe(false);
  });

  it("schaltet weitere Maschinen erst mit Umschlag frei", () => {
    const s = new UpgradeState();
    const dozer = getUpgrade("dozer");
    expect(s.available("dozer", dozer.requiresTurnoverKg - 1)).toBe(false);
    expect(s.available("dozer", dozer.requiresTurnoverKg)).toBe(true);
  });

  it("lässt nur kaufen, was bezahlbar ist", () => {
    const s = new UpgradeState();
    const p = getUpgrade("loader").priceEur;
    expect(s.affordable("loader", 0, p - 1), "zu wenig Geld").toBe(false);
    expect(s.affordable("loader", 0, p), "genau genug").toBe(true);
  });

  it("bietet Gekauftes nicht erneut an", () => {
    const s = new UpgradeState();
    s.buy("loader");
    expect(s.has("loader")).toBe(true);
    expect(s.available("loader", 999999), "schon vorhanden").toBe(false);
  });

  it("überlebt Speichern und Laden", () => {
    const s = new UpgradeState();
    s.buy("loader");
    s.buy("magnet");
    const b = new UpgradeState();
    b.load(s.toJSON());
    expect(b.has("loader")).toBe(true);
    expect(b.has("magnet")).toBe(true);
    expect(b.has("dozer")).toBe(false);
  });

  it("verträgt unbekannte Einträge aus alten Ständen", () => {
    const s = new UpgradeState();
    s.load(["loader", "gibtsNichtMehr"]);
    expect(s.has("loader")).toBe(true);
    expect(s.toJSON()).toHaveLength(1);
  });
});

describe("Zahlungsdruck", () => {
  it("kann zu Beginn ankaufen", () => {
    const a = new Account();
    expect(a.canBuy).toBe(true);
  });

  it("stoppt den Ankauf, wenn das Konto leer ist", () => {
    const a = new Account();
    a.moneyEur = CREDIT_LIMIT_EUR - 1;
    expect(a.canBuy, "ohne Geld liefert niemand mehr").toBe(false);
  });

  it("lässt einen kleinen Dispo zu, damit das Spiel nicht feststeckt", () => {
    const a = new Account();
    a.moneyEur = 0;
    expect(a.canBuy, "bei null geht es noch weiter").toBe(true);
    expect(CREDIT_LIMIT_EUR).toBeLessThan(0);
  });

  it("warnt, bevor es eng wird", () => {
    const a = new Account();
    a.moneyEur = 5000;
    expect(a.lowOnCash).toBe(false);
    a.moneyEur = 500;
    expect(a.lowOnCash, "rechtzeitig warnen").toBe(true);
  });

  it("wird nach einem Verkauf wieder zahlungsfähig", () => {
    const a = new Account();
    a.moneyEur = CREDIT_LIMIT_EUR - 500;
    expect(a.canBuy).toBe(false);
    a.moneyEur += 3000;
    expect(a.canBuy, "Verkaufen löst die Sperre").toBe(true);
  });

  it("zieht den ausgehandelten Faktor vom Ankauf ab", () => {
    const voll = new Account();
    const gedrueckt = new Account();
    voll.payDelivery(1000);
    gedrueckt.payDelivery(1000, 0.68);
    expect(gedrueckt.moneyEur, "gedrückt kostet weniger").toBeGreaterThan(voll.moneyEur);
  });
});
