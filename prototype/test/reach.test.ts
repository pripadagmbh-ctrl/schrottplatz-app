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
import { hoechsteKrallenspitze } from "../src/excavator/excavator";
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
