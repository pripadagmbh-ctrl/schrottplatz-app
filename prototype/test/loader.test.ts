import { describe, it, expect } from "vitest";
import {
  brauchtSchieben,
  anstellPunkt,
  schiebeZiel,
  SCHIEB_AB_M,
  SCHIEB_ZIEL_M,
  ANSTELL_ABSTAND,
} from "../src/world/loader";

/**
 * Der Radlader hat eine einzige Aufgabe, die sich rechnen lässt: Er schiebt
 * Schrott aus dem Nirgendwo in den Bereich, in dem der Bagger ihn greifen
 * kann. Genau das wird hier geprüft — an der gemessenen Reichweite des Arms
 * (Boden erreichbar zwischen 3,0 und 9,5 m, Knick bei 6,5 m, siehe
 * reach.test.ts), nicht an gefühlten Werten.
 */
describe("Radlader schiebt heran", () => {
  const ex = { x: 0, z: -1 };

  it("greift erst ausserhalb der Baggerreichweite ein", () => {
    expect(brauchtSchieben(ex.x + 5, ex.z, ex.x, ex.z)).toBe(false);
    expect(brauchtSchieben(ex.x + 9, ex.z, ex.x, ex.z)).toBe(false);
    expect(brauchtSchieben(ex.x + 14, ex.z, ex.x, ex.z)).toBe(true);
  });

  it("legt das Schiebeziel mitten in den erreichbaren Bereich", () => {
    for (const [ix, iz] of [
      [16, -1],
      [-18, 4],
      [3, 20],
      [-12, -9],
    ] as Array<[number, number]>) {
      const [zx, zz] = schiebeZiel(ix, iz, ex.x, ex.z);
      // Die Halteposition des Laders steht hinter dem Teil; das Teil selbst
      // liegt eine Anstelllänge näher am Bagger.
      const halt = Math.hypot(zx - ex.x, zz - ex.z);
      const teil = halt - ANSTELL_ABSTAND;
      expect(teil).toBeGreaterThan(3.0);
      expect(teil).toBeLessThan(9.5);
      expect(teil).toBeCloseTo(SCHIEB_ZIEL_M, 6);
    }
  });

  it("stellt den Lader hinter das Teil, nie davor", () => {
    const [ax, az] = anstellPunkt(14, 6, ex.x, ex.z);
    const zumTeil = Math.hypot(14 - ex.x, 6 - ex.z);
    const zumLader = Math.hypot(ax - ex.x, az - ex.z);
    // weiter weg als das Teil — sonst schiebt er es vom Bagger fort
    expect(zumLader).toBeGreaterThan(zumTeil);
    expect(zumLader - zumTeil).toBeCloseTo(ANSTELL_ABSTAND, 6);
    // und auf derselben Linie: das Kreuzprodukt verschwindet
    expect((ax - ex.x) * (6 - ex.z) - (az - ex.z) * (14 - ex.x)).toBeCloseTo(0, 6);
  });

  it("schiebt in Richtung Bagger, nicht daran vorbei", () => {
    const [zx, zz] = schiebeZiel(20, -1, ex.x, ex.z);
    // Von 20 m kommend muss das Ziel deutlich näher liegen
    expect(Math.hypot(zx - ex.x, zz - ex.z)).toBeLessThan(20);
    expect(SCHIEB_ZIEL_M).toBeLessThan(SCHIEB_AB_M);
  });
});
