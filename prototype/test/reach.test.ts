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
import {
  neueAbladestelle,
  routeInRev,
  setBaggerOrt,
  TIP_CREEP_M,
} from "../src/delivery/routes";

/** Standplatz des Baggers — siehe `position` in excavator.ts. */
const BAGGER = { x: -2.0, z: -18.3 };

/**
 * Mulden, die der Spieler von seinem Standplatz aus selbst befüllt.
 *
 * Seit der Platzordnung vom 12.09.2026 sind das genau drei plus das
 * Ballenlager: Stahl, Alu, VA. Abfall und Hortmulden stehen bewusst außerhalb
 * des Schwenkkranzes — dorthin wird gefahren oder Lambert trägt es hin —, und
 * die Absetzcontainer lassen sich ohnehin heranziehen.
 */
const SELBST_BEFUELLT = [
  "c_mixed",
  "c_steel",
  "r_cable",
  "r_va",
  "r_copper",
  "r_alu",
  "r_zinc",
  "r_brass",
];

/**
 * Die Arbeitslinie des Baggers (Platzordnung 12.09.2026).
 *
 * Er arbeitet nicht von einem Punkt: Ein Ring von 4,0 bis 9,5 m fasst keine
 * zehn Ziele. Geprueft wird deshalb, ob jedes Ziel von IRGENDEINEM Punkt
 * dieser kurzen Linie aus ueber seine Wand zu befuellen ist.
 */
const LINIE: Array<[number, number]> = [];
for (let t = 0; t <= 1.0001; t += 0.05) LINIE.push([-2.0, -18.3 + t * 5]);

function abstand(x: number, z: number): number {
  return Math.hypot(x - BAGGER.x, z - BAGGER.z);
}

describe("Reichweite des Arms", () => {
  it("der Arm hat eine tote Zone in Baggernähe", () => {
    /*
     * Der Befund, der die Muldenreihe zum Umziehen gezwungen hat: Ganz nah am
     * Bagger bleibt der Arm eingeklappt. Seit der Drehpunkt hoeher sitzt und
     * der Ausleger steiler stehen darf (11.09.2026), reicht er frueher hoch —
     * die tote Zone ist kleiner, aber es gibt sie:
     *
     *          3,0 m   4,6 m   6,0 m   7,5 m   9,5 m
     *   vorher  -1,68    1,48    2,52    6,28    1,73
     *   nachher -1,28    2,55    8,11    6,68    2,13
     */
    expect(hoechsteKrallenspitze(3.0)).toBeLessThan(0);
    expect(hoechsteKrallenspitze(4.6)).toBeLessThan(3.0);
    expect(hoechsteKrallenspitze(7.5)).toBeGreaterThan(4.0);
    // ... und ueber eine 3-m-Muldenwand kommt er jetzt schon bei 6 m
    expect(hoechsteKrallenspitze(6.0)).toBeGreaterThan(3.0);
  });

  it("alles, was ein Kipper ablaedt, bleibt in Reichweite", () => {
    // Der Arm erreicht den BODEN nur zwischen 3,0 und 9,5 m. Der Kipper dockt
    // an, kippt und zieht dann gekippt an — der Rest der Fuhre rutscht auf
    // dieser Strecke heraus. Reicht sie ueber 9,5 m hinaus, liegt dort Schrott,
    // den man nicht mehr wegbekommt (Befund 10.09.2026).
    //
    // Die Abladestelle wandert seit 12.09.2026 mit dem Bagger, also genügt es
    // nicht mehr, einen Punkt zu prüfen: Gefahren wird ueber den ganzen
    // Vorplatz, und an jeder Stelle muss der Arm noch auf den Boden kommen.
    for (const ort of [
      { x: -4, z: -17 },
      { x: -4, z: -12 },
      { x: -6, z: -15 },
      { x: -2, z: -14 },
      { x: -4, z: -10 },
    ]) {
      setBaggerOrt(() => ort);
      neueAbladestelle();
      const r = routeInRev();
      const dock = r[r.length - 1]!;
      const weitesterPunkt = Math.hypot(dock[0] - ort.x, dock[1] + TIP_CREEP_M - ort.z);
      expect(
        weitesterPunkt,
        `Bagger auf (${ort.x}, ${ort.z}): letzter Abwurf bei ` +
          `${weitesterPunkt.toFixed(1)} m — dort kommt der Arm nicht mehr auf den Boden`
      ).toBeLessThan(9.5);
    }
  });

  it("jenseits von zehn Metern reicht er gar nicht", () => {
    expect(hoechsteKrallenspitze(10.5)).toBe(-Infinity);
  });

  for (const cfg of CONFIGS) {
    if (!SELBST_BEFUELLT.includes(cfg.id)) continue;
    it(`${cfg.label}: der Arm kommt über die Wand`, () => {
      const wandH = cfg.size[2];
      const [w, d] = cfg.size;
      let beste: { d: number; h: number; p: [number, number] } | null = null;
      for (const [px, pz] of LINIE) {
        // Naechster Punkt der Zone, nicht ihre Mitte: eine 12-m-Halde greift
        // man am Rand, nicht in der Mitte.
        const zx = Math.max(cfg.x - w / 2, Math.min(cfg.x + w / 2, px));
        const zz = Math.max(cfg.z - d / 2, Math.min(cfg.z + d / 2, pz));
        const dist = Math.hypot(zx - px, zz - pz);
        const hoch = hoechsteKrallenspitze(dist);
        if (hoch > wandH + 0.4 && (beste === null || dist < beste.d)) {
          beste = { d: dist, h: hoch, p: [px, pz] };
        }
      }
      expect(
        beste,
        `${cfg.label} (Wand ${wandH.toFixed(2)} m) ist von keinem Punkt der ` +
          `Arbeitslinie aus zu befuellen`
      ).not.toBeNull();
    });
  }
});
