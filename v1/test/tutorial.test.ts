import { describe, it, expect } from "vitest";
import { Tutorial, STEPS, type TutorialContext } from "../src/ui/tutorial";

/** Nichts erreicht — der Ausgangszustand eines neuen Spiels. */
function leer(): TutorialContext {
  return {
    verhandeltGerade: false,
    preisVereinbart: false,
    looseKg: 0,
    sortiertKg: 0,
    gepresst: false,
    abholerBestellt: false,
    turnoverKg: 0,
  };
}

/** Führung bis zu einem Schritt vorspulen. */
function bisSchritt(t: Tutorial, id: string, c: TutorialContext): void {
  t.update(20, c); // erster Schritt ist zeitgesteuert
  for (let i = 0; i < STEPS.length && t.step?.id !== id; i++) t.update(1, c);
}

describe("Geführter Einstieg", () => {
  it("beginnt beim ersten Schritt", () => {
    const t = new Tutorial();
    expect(t.step?.id).toBe("umsehen");
    expect(t.finished).toBe(false);
    expect(t.progress).toBe("1/6");
  });

  it("hat für jeden Schritt Titel, Text und ein Ziel", () => {
    for (const s of STEPS) {
      expect(s.title.length, s.id).toBeGreaterThan(5);
      expect(s.text.length, `${s.id} braucht eine Anweisung`).toBeGreaterThan(40);
      expect(typeof s.done, s.id).toBe("function");
    }
  });

  it("lässt den ersten Schritt erst nach einer Weile weiterlaufen", () => {
    const t = new Tutorial();
    t.update(5, leer());
    expect(t.step?.id, "nach 5 s noch beim Umsehen").toBe("umsehen");
    t.update(10, leer());
    expect(t.step?.id, "nach 15 s weiter").toBe("annehmen");
  });

  it("wartet beim Verhandeln, bis ein Preis vereinbart ist", () => {
    const t = new Tutorial();
    const c = leer();
    bisSchritt(t, "annehmen", c);
    for (let i = 0; i < 50; i++) t.update(1, c);
    expect(t.step?.id, "ohne Abschluss bleibt es stehen").toBe("annehmen");
    c.preisVereinbart = true;
    t.update(1, c);
    expect(t.step?.id).toBe("sortieren");
  });

  it("verlangt beim Sortieren eine spürbare Menge", () => {
    const t = new Tutorial();
    const c = leer();
    c.preisVereinbart = true;
    bisSchritt(t, "sortieren", c);
    c.sortiertKg = 100;
    t.update(1, c);
    expect(t.step?.id, "ein einzelnes Teil reicht nicht").toBe("sortieren");
    c.sortiertKg = 400;
    t.update(1, c);
    expect(t.step?.id).toBe("pressen");
  });

  it("läuft den ganzen Kreislauf durch und hört dann auf", () => {
    const t = new Tutorial();
    const c = leer();
    t.update(20, c);
    c.preisVereinbart = true;
    t.update(1, c);
    c.sortiertKg = 500;
    t.update(1, c);
    c.gepresst = true;
    t.update(1, c);
    c.abholerBestellt = true;
    t.update(1, c);
    c.turnoverKg = 2000;
    t.update(1, c);
    expect(t.finished, "nach dem ersten Zyklus ist Schluss").toBe(true);
    expect(t.step).toBeNull();
  });

  it("lässt sich jederzeit abbrechen", () => {
    const t = new Tutorial();
    t.skip();
    expect(t.finished).toBe(true);
    expect(t.step).toBeNull();
    // Danach meldet sie sich nicht mehr
    expect(t.update(100, leer())).toBe(false);
  });

  it("überlebt Speichern und Laden", () => {
    const t = new Tutorial();
    const c = leer();
    t.update(20, c);
    c.preisVereinbart = true;
    t.update(1, c);
    const b = new Tutorial();
    b.load(t.toJSON());
    expect(b.step?.id).toBe(t.step?.id);
  });

  it("verträgt Spielstände ohne Führungsdaten", () => {
    const t = new Tutorial();
    t.load(undefined);
    expect(t.step?.id).toBe("umsehen");
  });
});

/*
 * Anhalten ist nicht Ueberspringen (Ansage 14.09.2026: „das Tutorial
 * pausieren"). Uebersprungen ist fuer immer weg, angehalten wartet — und der
 * Unterschied muss auch einen Neustart ueberleben.
 */
describe("Führung anhalten", () => {
  it("rückt angehalten nicht weiter, auch wenn das Ziel erreicht ist", () => {
    const t = new Tutorial();
    t.togglePause();
    // 20 Sekunden und ein erfülltes Ziel — ohne Pause wäre der Schritt gewechselt
    const c = leer();
    let gewechselt = false;
    for (let i = 0; i < 40; i++) gewechselt = t.update(0.5, c) || gewechselt;
    expect(gewechselt).toBe(false);
    expect(t.step?.id).toBe("umsehen");
  });

  it("hält die Uhr an, statt sie weiterlaufen zu lassen", () => {
    // Sonst wäre der erste Schritt nach der Pause sofort „reif" und die Führung
    // spränge beim Fortsetzen ohne Zutun weiter.
    const t = new Tutorial();
    t.togglePause();
    for (let i = 0; i < 40; i++) t.update(0.5, leer());
    t.togglePause();
    expect(t.update(0.5, leer())).toBe(false);
  });

  it("nimmt dort wieder auf, wo sie stand", () => {
    const t = new Tutorial();
    expect(t.togglePause()).toBe(true);
    expect(t.paused).toBe(true);
    expect(t.togglePause()).toBe(false);
    expect(t.paused).toBe(false);
    expect(t.step?.id).toBe("umsehen");
  });

  it("lässt sich nach dem Überspringen nicht mehr anhalten", () => {
    const t = new Tutorial();
    t.skip();
    expect(t.togglePause()).toBe(false);
    expect(t.paused).toBe(false);
    expect(t.step).toBeNull();
  });

  it("merkt sich die Pause über einen Neustart", () => {
    const t = new Tutorial();
    t.togglePause();
    const zweiter = new Tutorial();
    zweiter.load(t.toJSON());
    expect(zweiter.paused).toBe(true);
    expect(zweiter.step?.id).toBe("umsehen");
  });

  it("gilt alten Spielständen ohne Pausenfeld als nicht angehalten", () => {
    const t = new Tutorial();
    t.load({ index: 1, finished: false });
    expect(t.paused).toBe(false);
  });
});
