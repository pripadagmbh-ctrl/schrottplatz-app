import { describe, it, expect } from "vitest";
import { Shift, BUSY_KG, JAM_KG, JAM_CLEAR_KG } from "../src/economy/shift";

describe("Betrieb auf dem Platz", () => {
  it("nimmt von Anfang an an", () => {
    const s = new Shift();
    s.update(1, 0);
    expect(s.acceptsDeliveries).toBe(true);
    expect(s.jammed).toBe(false);
  });

  it("lässt den Verkehr auch auf gut gefülltem Platz weiterlaufen", () => {
    const s = new Shift();
    s.update(1, BUSY_KG * 1.5);
    expect(s.acceptsDeliveries).toBe(true);
  });

  it("wird nur langsamer, nicht leer: voller Platz heißt längere Abstände", () => {
    const s = new Shift();
    const leer = s.intervalFactor(0);
    const voll = s.intervalFactor(BUSY_KG);
    expect(leer).toBeLessThan(voll);
    expect(leer).toBeGreaterThan(0); // es kommt immer etwas nach
  });

  it("deckelt den Abstand, damit der Nachschub nie versiegt", () => {
    const s = new Shift();
    expect(s.intervalFactor(999999)).toBeLessThanOrEqual(2.2);
  });

  it("macht erst bei zugestelltem Platz zu und wieder auf, wenn Luft ist", () => {
    const s = new Shift();
    s.update(1, JAM_KG + 1);
    expect(s.jammed).toBe(true);
    expect(s.acceptsDeliveries).toBe(false);
    // Hysterese: knapp unter der Sperre bleibt zu
    s.update(1, JAM_KG - 100);
    expect(s.jammed).toBe(true);
    s.update(1, JAM_CLEAR_KG - 1);
    expect(s.jammed).toBe(false);
  });

  it("zählt abgefahrenes Material als Umschlag", () => {
    const s = new Shift();
    s.noteTurnover(1200);
    s.noteTurnover(800);
    expect(s.turnoverKg).toBe(2000);
    expect(s.pickups).toBe(2);
    expect(s.statusText(0)).toContain("2.0 t");
  });

  it("überlebt Speichern und Laden", () => {
    const s = new Shift();
    s.update(42, 100);
    s.noteTurnover(3400);
    s.deliveries = 7;
    const b = new Shift();
    b.load(s.toJSON());
    expect(b.turnoverKg).toBe(3400);
    expect(b.pickups).toBe(1);
    expect(b.deliveries).toBe(7);
    expect(b.t).toBeCloseTo(42, 5);
  });

  it("verträgt alte Spielstände ohne Betriebszahlen", () => {
    const s = new Shift();
    s.load(undefined);
    expect(s.turnoverKg).toBe(0);
    expect(s.acceptsDeliveries).toBe(true);
  });
});
