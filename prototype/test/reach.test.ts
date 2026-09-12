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
  neueAbholstelle,
  routeInRev,
  setBaggerOrt,
  TIP_CREEP_M,
} from "../src/delivery/routes";
import { baleYard, PRESS_CENTER as PRESSE } from "../src/world/press";

/** Standplatz des Baggers — siehe `position` in excavator.ts. */
const BAGGER = { x: -2.5, z: -19.5 };

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
const HUB_CACHE = new Map<number, number>();
const LINIE: Array<[number, number]> = [];
// Nach vorn, an der Containerreihe entlang
for (let t = 0; t <= 1.0001; t += 0.05) LINIE.push([-2.5, -19.5 + t * 5]);
/*
 * Und einmal herum zur offenen Westseite der Stahlmulde.
 *
 * Die Mulde liegt seit dem 12.09.2026 rechts neben der Presse und ist vom
 * Sitz aus 11,0 m entfernt — ausserhalb jeder Reichweite. Der Gang hinter der
 * Containerreihe, aus dem sie vorher befuellt wurde, ist zu, seit die
 * Container an der Muldenwand stehen. Bleibt die offene Westseite: nordlich an
 * den Containern vorbei, dann nach Sueden. Von (−15,5 | −21) sind es 6,4 m auf
 * die Muldenmitte bei 8,1 m Hubhoehe.
 */
for (let t = 0; t <= 1.0001; t += 0.1) LINIE.push([-2.5 - t * 13.0, -13.5]);
for (let t = 0; t <= 1.0001; t += 0.1) LINIE.push([-15.5, -13.5 - t * 8.5]);

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
      /*
       * Geprueft wird, ob IRGENDEIN Punkt der Zone von IRGENDEINEM Punkt der
       * Arbeitslinie aus zu treffen ist — nicht nur die naechste Ecke.
       *
       * Vorher stand hier die naechste Ecke, und das ergab einen falschen
       * Alarm, sobald ein Behaelter dicht an der Linie steht: Bei einem
       * 3,6-m-Container liegt die nahe Kante dann in der toten Zone (3,3 m),
       * die Mitte aber bei 6,1 m mit 8,1 m Hubhoehe. Man greift auch nicht die
       * Kante an, sondern laesst in den Kasten fallen.
       */
      let beste: { d: number; h: number; p: [number, number] } | null = null;
      const SCHRITT = 0.5;
      // `hoechsteKrallenspitze` rechnet die ganze Armgeometrie ab; ueber ein
      // Raster aufgerufen dauert der Test sonst Minuten. Auf 10 cm gerundet
      // gemerkt — feiner als die Schrittweite des Rasters ohnehin ist.
      const hubBei = (dist: number): number => {
        const k = Math.round(dist * 10);
        let v = HUB_CACHE.get(k);
        if (v === undefined) {
          v = hoechsteKrallenspitze(k / 10);
          HUB_CACHE.set(k, v);
        }
        return v;
      };
      for (const [px, pz] of LINIE) {
        for (let zx = cfg.x - w / 2; zx <= cfg.x + w / 2 + 1e-6; zx += SCHRITT) {
          for (let zz = cfg.z - d / 2; zz <= cfg.z + d / 2 + 1e-6; zz += SCHRITT) {
            const dist = Math.hypot(zx - px, zz - pz);
            const hoch = hubBei(dist);
            if (hoch > wandH + 0.4 && (beste === null || dist < beste.d)) {
              beste = { d: dist, h: hoch, p: [px, pz] };
            }
          }
        }
      }
      expect(
        beste,
        `${cfg.label} (Wand ${wandH.toFixed(2)} m) ist von keinem Punkt der ` +
          `Arbeitslinie aus zu befuellen`
      ).not.toBeNull();
    });
  }

  /*
   * Zwei Stellen, die der Spieler nicht selbst waehlt und trotzdem erreichen
   * muss: der Halteplatz des Abholers und die Stelle, an der die Presse das
   * fertige Paket auswirft. Beide werden zur Laufzeit aus der Baggerstellung
   * gerechnet, beide koennten dabei aus dem Greifring rutschen — und beide
   * waeren dann eine Sackgasse: Was man nicht greifen kann, kann man weder
   * verladen noch verkaufen.
   */
  it("der Abholer haelt im Greifring, egal wo der Bagger steht", () => {
    for (const b of [
      { x: -2.0, z: -19.5 },
      { x: -2.0, z: -14.0 },
      { x: 2.0, z: -22.0 },
      { x: -6.0, z: -12.0 },
    ]) {
      setBaggerOrt(() => b);
      const [x, z] = neueAbholstelle();
      const d = Math.hypot(x - b.x, z - b.z);
      expect(d, `Abholer bei Bagger (${b.x}|${b.z})`).toBeGreaterThanOrEqual(4.0);
      expect(d, `Abholer bei Bagger (${b.x}|${b.z})`).toBeLessThanOrEqual(9.5);
      // Ueber die Bordwand muss der Greifer auch noch kommen.
      expect(hoechsteKrallenspitze(d), `Hubhoehe bei ${d.toFixed(1)} m`).toBeGreaterThan(2.5);
    }
  });

  it("das Presspaket bleibt in der Kammer", () => {
    /*
     * "Ballen bleiben in Presse, ohne Abscheiden" (12.09.2026). Dazwischen
     * warf die Presse zum Bagger hin aus; der Test hielt fest, dass die
     * Auswurfstelle im Greifring liegt. Jetzt haelt er das Gegenteil fest:
     * Es gibt keine Auswurfstelle, das Paket liegt in der Kammer — und weil
     * es dort liegt, blockiert es die naechste Fuhre. Das ist gewollt.
     */
    const y = baleYard();
    expect(y.x).toBeCloseTo(PRESSE.x, 5);
    expect(y.z).toBeCloseTo(PRESSE.z, 5);
  });
});
