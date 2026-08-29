import { describe, it, expect } from "vitest";
import { Shift, SORT_START_KG, SORT_DONE_KG, SORT_MAX_S, SORT_AFTER_DELIVERIES } from "../src/economy/shift";

describe("Tagesablauf", () => {
  it("nimmt zu Beginn an", () => {
    const s = new Shift();
    expect(s.phase).toBe("annahme");
    expect(s.acceptsDeliveries).toBe(true);
  });

  it("macht die Einfahrt zu, wenn der Platz voll ist", () => {
    const s = new Shift();
    s.update(1, SORT_START_KG - 1);
    expect(s.phase).toBe("annahme");
    s.update(1, SORT_START_KG);
    expect(s.phase).toBe("sortieren");
    expect(s.acceptsDeliveries).toBe(false);
    expect(s.consumeChange()).toBe("sortieren");
  });

  it("macht auch nach genug Fuhren zu, selbst bei leichtem Schrott", () => {
    const s = new Shift();
    s.deliveriesThisShift = SORT_AFTER_DELIVERIES;
    s.update(1, 10);
    expect(s.phase).toBe("sortieren");
  });

  it("öffnet wieder, sobald aufgeräumt ist, und zählt den Zyklus", () => {
    const s = new Shift();
    s.update(1, SORT_START_KG);
    s.update(1, SORT_DONE_KG + 100); // noch zu viel
    expect(s.phase).toBe("sortieren");
    s.update(1, SORT_DONE_KG);
    expect(s.phase).toBe("annahme");
    expect(s.cycle).toBe(1);
    expect(s.deliveriesThisShift).toBe(0);
  });

  it("öffnet spätestens nach Ablauf der Sortierzeit", () => {
    const s = new Shift();
    s.update(1, SORT_START_KG);
    s.update(SORT_MAX_S - 1, 99999);
    expect(s.phase).toBe("sortieren");
    s.update(2, 99999);
    expect(s.phase).toBe("annahme");
  });

  it("überlebt Speichern und Laden", () => {
    const s = new Shift();
    s.update(1, SORT_START_KG);
    s.update(42, 3000);
    const b = new Shift();
    b.load(s.toJSON());
    expect(b.phase).toBe("sortieren");
    expect(b.t).toBeCloseTo(42, 5);
  });

  it("verträgt alte Spielstände ohne Ablauf-Daten", () => {
    const s = new Shift();
    s.load(undefined);
    expect(s.phase).toBe("annahme");
  });
});
