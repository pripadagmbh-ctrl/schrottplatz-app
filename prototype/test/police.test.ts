import { describe, it, expect } from "vitest";
import { hitsObstacle } from "../src/world/obstacles";
import { Police } from "../src/world/police";
import { GATE_X, KAFFEE_POS, YARD_MAX_X, YARD_MIN_X, YARD_D } from "../src/world/yard";

/**
 * Der Streifenwagen fährt eine feste Runde über den Platz (Wunsch
 * 11.09.2026). Sie darf durch nichts hindurchführen — sonst fährt die
 * Polizei durch die Presse, und niemand sieht es, bis es jemand sieht.
 * Derselbe Fehler ist bei den LKW-Routen schon zweimal passiert.
 */
describe("Streifenwagen", () => {
  it("fährt eine Runde, die an allen Bauwerken vorbeiführt", () => {
    for (const [x, z] of Police.runde) {
      // 1,4 m Sicherheitsabstand — die halbe Wagenbreite plus Rand
      expect(hitsObstacle(x, z, 1.4), `Rundfahrt bei (${x}, ${z})`).toBeNull();
    }
  });

  it("hält vor dem Büro, ohne darin zu stehen", () => {
    const halt = Police.bueroHalt;
    expect(hitsObstacle(halt.x, halt.z, 1.2)).toBeNull();
    // und nicht im Kaffeewagen
    expect(Math.hypot(halt.x - KAFFEE_POS.x, halt.z - KAFFEE_POS.z)).toBeGreaterThan(3);
  });

  it("bleibt mit der Runde innerhalb des Platzes", () => {
    for (const [x, z] of Police.runde) {
      expect(x).toBeGreaterThan(YARD_MIN_X + 1);
      expect(x).toBeLessThan(YARD_MAX_X - 1);
      expect(Math.abs(z)).toBeLessThan(YARD_D / 2 - 1);
    }
  });

  it("kommt durch die Toreinfahrt", () => {
    // Die Einfahrt liegt bei GATE_X; dort muss der Wagen durchpassen
    expect(hitsObstacle(GATE_X, YARD_D / 2, 1.4)).toBeNull();
  });
});

describe("Halteplatz beim Bagger", () => {
  it("liegt frei, nicht in der Muldenreihe", () => {
    // Erster Versuch war 6,5 m nach Osten — das ist mitten in den Mulden.
    expect(hitsObstacle(6.5, 1.0, 1.6)).not.toBeNull();
    // Die Kandidatenliste muss mindestens einen freien Platz enthalten
    const frei = [
      [4.5, 9.5],
      [-1.5, 11.0],
      [4.5, -11.0],
      [-6.0, 12.5],
    ].some(([dx, dz]) => hitsObstacle(0 + dx, -1 + dz, 1.6) === null);
    expect(frei).toBe(true);
  });
});
