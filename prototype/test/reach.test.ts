/**
 * Wächter für die Erreichbarkeit der Mulden.
 *
 * Anlass (10.09.2026): Aluminium liess sich von der Standposition aus nicht in
 * seine Mulde bugsieren — man stiess gegen die Kopfwand. Nachgerechnet war es
 * nicht knapp, sondern unmöglich: Bei 4,6 m Abstand kommt die Krallenspitze auf
 * 1,43 m, die Wand ist 2,50 m hoch.
 *
 * Der Arm hat einen scharfen Knick bei rund 6,5 m — näher dran bleibt er
 * eingeklappt, jenseits von 9,5 m reicht er nicht mehr. Wer eine Mulde
 * verschiebt, muss dieses Fenster treffen; der Test sagt es sofort.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { hoechsteKrallenspitze, tempoFaktor, anlaufZeit, CAB_MAX } from "../src/excavator/excavator";
import { CONFIGS } from "../src/world/containers";
import { ROUTE_IN_REV, TIP_CREEP_M } from "../src/delivery/routes";

/** Standplatz des Baggers — siehe `position` in excavator.ts. */
const BAGGER = { x: 0, z: -1 };

/** Mulden, die der Spieler selbst befüllt (die Nichtmetalle beschickt der Radlader). */
const SELBST_BEFUELLT = ["c_va", "c_alu", "c_copper", "c_cable", "c_bales"];

function abstand(x: number, z: number): number {
  return Math.hypot(x - BAGGER.x, z - BAGGER.z);
}

describe("Reichweite des Arms", () => {
  it("der Arm hat eine tote Zone in Baggernähe", () => {
    // Der Befund, der die Reihe zum Umziehen gezwungen hat — er soll
    // dokumentiert bleiben, damit niemand die Mulden wieder heranrückt.
    expect(hoechsteKrallenspitze(4.6)).toBeLessThan(2.0);
    expect(hoechsteKrallenspitze(6.0)).toBeLessThan(3.0);
    expect(hoechsteKrallenspitze(7.5)).toBeGreaterThan(4.0);
  });

  it("alles, was ein Kipper ablaedt, bleibt in Reichweite", () => {
    // Der Arm erreicht den BODEN nur zwischen 3,0 und 9,5 m. Der Kipper dockt
    // an, kippt und zieht dann gekippt an — der Rest der Fuhre rutscht auf
    // dieser Strecke heraus. Reicht sie ueber 9,5 m hinaus, liegt dort Schrott,
    // den man nicht mehr wegbekommt (Befund 10.09.2026).
    const dock = ROUTE_IN_REV[ROUTE_IN_REV.length - 1]!;
    const weitesterPunkt = Math.hypot(dock[0] - BAGGER.x, dock[1] + TIP_CREEP_M - BAGGER.z);
    expect(
      weitesterPunkt,
      `letzter Abwurf bei ${weitesterPunkt.toFixed(1)} m — dort kommt der Arm nicht mehr auf den Boden`
    ).toBeLessThan(9.5);
  });

  it("jenseits von zehn Metern reicht er gar nicht", () => {
    expect(hoechsteKrallenspitze(10.5)).toBe(-Infinity);
  });

  for (const cfg of CONFIGS) {
    if (!SELBST_BEFUELLT.includes(cfg.id)) continue;
    it(`${cfg.label}: der Arm kommt über die Wand`, () => {
      const wandH = cfg.size[2];
      const d = abstand(cfg.x, cfg.z);
      const hoch = hoechsteKrallenspitze(d);
      expect(
        hoch,
        `${cfg.label} liegt ${d.toFixed(2)} m entfernt; dort kommt die Spitze auf ` +
          `${hoch === -Infinity ? "gar nichts" : hoch.toFixed(2) + " m"}, ` +
          `die Wand ist ${wandH.toFixed(2)} m hoch`
      ).toBeGreaterThan(wandH + 0.4);
    });
  }
});

/**
 * Last und Tempo (Befund 11.09.2026).
 *
 * Vorher galt: 1 − 0,5 × (Last / 2000 kg). Zwei Tonnen halbierten also das
 * Tempo der ganzen Maschine. Für einen Umschlagbagger dieser Größe sind zwei
 * Tonnen nichts — die Hydraulik ist druckgeregelt, das Drehwerk dreht nahezu
 * unverändert weiter. Zu spüren ist die Masse im Anlauf.
 */
describe("Last am Greifer", () => {
  it("kostet bis zur Nennlast kaum Endtempo", () => {
    expect(tempoFaktor(0)).toBe(1);
    expect(tempoFaktor(2000)).toBeGreaterThan(0.9);
    expect(tempoFaktor(5000)).toBeGreaterThan(0.8);
  });

  it("bremst erst jenseits der Nennlast deutlich", () => {
    expect(tempoFaktor(7500)).toBeLessThan(tempoFaktor(5000));
    expect(tempoFaktor(10000)).toBeCloseTo(0.5, 2);
    // und nie ins Stehen
    expect(tempoFaktor(50000)).toBeGreaterThan(0.4);
  });

  it("macht den Anlauf träger statt das Tempo kleiner", () => {
    // Genau darüber wirkt die Masse: Sie läuft langsam an und läuft aus.
    expect(anlaufZeit(5000)).toBeGreaterThan(anlaufZeit(0) * 1.5);
    expect(anlaufZeit(0)).toBeGreaterThan(0.2);
    // Über der Nennlast wächst die Rampe nicht weiter ins Uferlose
    expect(anlaufZeit(20000)).toBe(anlaufZeit(5000));
  });

  it("dreht den Turm zügig genug für Umschlagarbeit", () => {
    // 7 bis 9 Umdrehungen je Minute sind bei dieser Maschinenklasse üblich,
    // also 42 bis 54 Grad je Sekunde.
    const gradProSekunde = THREE.MathUtils.radToDeg(CAB_MAX);
    expect(gradProSekunde).toBeGreaterThanOrEqual(42);
    expect(gradProSekunde).toBeLessThanOrEqual(54);
  });
});
