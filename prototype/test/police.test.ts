import { describe, it, expect } from "vitest";
import { hitsObstacle } from "../src/world/obstacles";

import { HALT_KANDIDATEN, Police } from "../src/world/police";
import { GATE_X, KAFFEE_POS, YARD_MAX_X, YARD_MIN_X, YARD_D } from "../src/world/yard";

/**
 * Der Streifenwagen fährt eine feste Runde über den Platz (Wunsch
 * 11.09.2026). Sie darf durch nichts hindurchführen — sonst fährt die
 * Polizei durch die Presse, und niemand sieht es, bis es jemand sieht.
 * Derselbe Fehler ist bei den LKW-Routen schon zweimal passiert.
 */
/** Standplatz des Baggers — siehe `position` in excavator.ts. */
const BAGGER = { x: -4, z: -18.5 };

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
  it("liegt frei, nicht in einer Mulde", () => {
    /*
     * Geprueft wird die echte Liste gegen die echte Baggerstellung, nicht
     * gegen abgeschriebene Zahlen: Beim Platzumbau am 12.09.2026 stand hier
     * noch die alte Muldenreihe, und der Test bewachte nichts mehr.
     */
    const frei = HALT_KANDIDATEN.some(
      ([dx, dz]) => hitsObstacle(BAGGER.x + dx, BAGGER.z + dz, 1.6) === null
    );
    expect(frei, "kein einziger Halteplatz ist frei").toBe(true);
  });
});
