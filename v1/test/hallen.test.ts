/**
 * Die drei Sortierhallen: wo sie stehen, wohin ihr Tor zeigt, ob man
 * hineinfährt.
 *
 * Drei Zusicherungen, die am 15.09.2026 jede einzeln gerissen war:
 *
 * 1. **Das Tor zeigt auf den Platz, nicht in die Mauer.** Die Hallen wurden
 *    lokal mit der Front auf +x gebaut und dann mit `rotation.y = −π/2`
 *    gedreht; bei θ = −π/2 gilt welt_x = −lokal_z und welt_z = +lokal_x, das
 *    Tor lag also auf welt +z — in der Nordmauer. Der Kommentar daneben
 *    behauptete „Front auf −z" und hat das zugedeckt.
 * 2. **Kollider und Hindernisliste lassen dieselbe Seite frei wie das
 *    sichtbare Tor.** Sie setzten die Rückwand im Norden an, also genau dort,
 *    wo das Tor stand: unsichtbare Wand im Tor, offenes Loch in der Rückwand.
 * 3. **Sie stehen nicht bei Janine.** Ansage Patrick: „Die dürfen nicht bei
 *    Janin stehen."
 *
 * Gemessen wird gegen `TOR_RICHTUNG` — die eine Angabe, aus der Bau, Kollider
 * und Hindernisliste seit dem 15.09.2026 gemeinsam lesen.
 */
import { describe, it, expect } from "vitest";
import {
  HALLEN_X,
  HALLEN_Z,
  HALLE_BREITE,
  HALLE_TIEFE,
  TOR_RICHTUNG,
  hallenFootprints,
  hallenWaende,
  hallenVorplatz,
  OFFICE_Z,
} from "../src/world/office";
import { hitsObstacle } from "../src/world/obstacles";
import { KAFFEE_POS, KAFFEE_FUSS, YARD_MIN_X, YARD_D, WEIGH_X, WEIGH_Z } from "../src/world/yard";

/** Halbe Wagenbreite eines LKW plus der Rand, mit dem er tastet. */
const WAGEN_HALB = 1.55;

describe("Das Tor zeigt auf den Platz", () => {
  it("die Torrichtung zeigt von der Wand weg, nicht in sie hinein", () => {
    /*
     * Die Hallen stehen an der Westgrenze. Das Tor muss also nach +x zeigen;
     * jede andere Richtung ist eine Wand oder der Nachbar.
     */
    const zurWand = HALLEN_X - HALLE_TIEFE / 2;
    expect(zurWand, "die Rückwand steht nicht an der Platzgrenze").toBeLessThan(YARD_MIN_X + 1.5);
    expect(TOR_RICHTUNG.x, "das Tor zeigt nicht auf den Platz").toBe(1);
    expect(TOR_RICHTUNG.z, "das Tor zeigt schräg").toBe(0);
  });

  it("vor dem Tor steht nichts, hinter der Halle schon", () => {
    for (const z of HALLEN_Z) {
      for (const d of [0.5, 2.0, 4.0]) {
        const x = HALLEN_X + TOR_RICHTUNG.x * (HALLE_TIEFE / 2 + d);
        expect(hitsObstacle(x, z, 0), `${d} m vor dem Tor bei z=${z}`).toBeNull();
      }
      const hinten = HALLEN_X - TOR_RICHTUNG.x * (HALLE_TIEFE / 2);
      expect(hitsObstacle(hinten, z, 0), `Rückwand bei z=${z} fehlt`).not.toBeNull();
    }
  });

  it("die Flanken stehen, sonst liefe eine Halle in die nächste", () => {
    for (const z of HALLEN_Z) {
      for (const sz of [-1, 1]) {
        const p = hitsObstacle(HALLEN_X, z + (sz * HALLE_BREITE) / 2, 0);
        expect(p, `Flanke bei z=${z} (${sz > 0 ? "Nord" : "Süd"}) fehlt`).not.toBeNull();
      }
    }
  });

  it("und der Innenraum ist frei — dort steht der Händler mit seinem Wagen", () => {
    for (const z of HALLEN_Z) {
      for (const dx of [-3, 0, 3]) {
        expect(hitsObstacle(HALLEN_X + dx, z, 0), `Innenraum bei (${dx}|${z})`).toBeNull();
      }
    }
  });

  it("es sind genau drei, bündig aneinander und bündig ans Büro", () => {
    expect(HALLEN_Z.length).toBe(3);
    // Die erste schließt an die Südkante des Bürogebäudes an (OFFICE_Z − 3,1).
    expect(HALLEN_Z[0]! + HALLE_BREITE / 2).toBeCloseTo(OFFICE_Z - 3.1, 6);
    for (let i = 1; i < HALLEN_Z.length; i++) {
      expect(
        HALLEN_Z[i - 1]! - HALLEN_Z[i]!,
        "zwischen zwei Hallen klafft eine Lücke"
      ).toBeCloseTo(HALLE_BREITE, 6);
    }
    // Und die Reihe bleibt innerhalb des Platzes.
    expect(HALLEN_Z[2]! - HALLE_BREITE / 2).toBeGreaterThan(-YARD_D / 2);
  });
});

describe("Die Hallen stehen nicht bei Janine", () => {
  it("kein Hallengrundriss berührt den Kaffeewagen", () => {
    /*
     * Ansage Patrick 15.09.2026. Der Kaffeewagen steht auf (−9,5 | 15,5) und
     * belegt mit seinem Grundriss x −12,0 … −7,0 und z +14,1 … +16,9. Geprüft
     * wird mit 3 m Rand — ein Kaffeewagen braucht einen Vorplatz, keine
     * Hauswand.
     */
    const RAND = 3.0;
    for (const [x, z, hw, hd] of hallenFootprints()) {
      const dx = Math.abs(x - KAFFEE_POS.x) - (hw + KAFFEE_FUSS[0] + RAND);
      const dz = Math.abs(z - KAFFEE_POS.z) - (hd + KAFFEE_FUSS[1] + RAND);
      expect(
        dx >= 0 || dz >= 0,
        `Halle bei (${x}|${z}) steht ${(-Math.max(dx, dz)).toFixed(2)} m zu dicht an Janine`
      ).toBe(true);
    }
  });
});

describe("Die Zufahrt zu den Hallen ist frei", () => {
  /*
   * Ansage Patrick 15.09.2026: „Erstmal ist ja ein super grosser Mittelplatz
   * da. … Die können ja von der Waage rechts abbiegen und dann sind sie ja
   * auch in der Halle."
   *
   * Es gibt dafür bewusst KEINE eigene Fahrspur — der Mittelplatz ist die
   * Zufahrt. Was hier geprüft wird, ist genau das: Auf der Luftlinie von der
   * Brückenwaage zum Vorplatz jeder Halle steht nichts, und zwar in voller
   * Wagenbreite.
   */
  it("von der Waage zum Vorplatz jeder Halle steht nichts im Weg", () => {
    for (const [i, [zx, zz]] of hallenVorplatz().entries()) {
      const schritte = Math.ceil(Math.hypot(zx - WEIGH_X, zz - WEIGH_Z) * 2);
      for (let k = 0; k <= schritte; k++) {
        const t = k / schritte;
        const x = WEIGH_X + (zx - WEIGH_X) * t;
        const z = WEIGH_Z + (zz - WEIGH_Z) * t;
        expect(
          hitsObstacle(x, z, WAGEN_HALB),
          `Halle ${i + 1}: Zufahrt versperrt bei (${x.toFixed(1)}|${z.toFixed(1)})`
        ).toBeNull();
      }
    }
  });

  it("und vom Vorplatz gerade in die Halle hinein", () => {
    for (const [i, [zx, zz]] of hallenVorplatz().entries()) {
      /*
       * Bis 2,3 m vor die Rückwand. Weiter muss kein Wagen: Sein Heck liegt
       * 2,84 m hinter dem Ursprung (`vehicleModel.ts`), er steht also mit
       * seinem letzten halben Meter schon an der Wand. Getastet wird mit
       * halber Wagenbreite — das ist der Abstand, der seitlich zählt.
       */
      for (let x = zx; x >= HALLEN_X - HALLE_TIEFE / 2 + 2.3; x -= 0.5) {
        expect(
          hitsObstacle(x, zz, WAGEN_HALB),
          `Halle ${i + 1}: Einfahrt versperrt bei x=${x.toFixed(1)}`
        ).toBeNull();
      }
    }
  });

  it("der Vorplatz liegt vor dem Tor, nicht dahinter", () => {
    const vor = hallenVorplatz();
    expect(vor.length).toBe(3);
    for (const [x] of vor) expect(x).toBeGreaterThan(HALLEN_X + HALLE_TIEFE / 2);
  });
});

describe("Bau, Kollider und Hindernisliste lesen dieselbe Torrichtung", () => {
  it("die Wandliste führt Rückwand und zwei Flanken je Halle — und keine Stirn", () => {
    const waende = hallenWaende();
    expect(waende.length, "es fehlt eine Wand").toBe(9);
    for (const nr of [1, 2, 3]) {
      const teile = waende.filter((w) => w.nr === nr).map((w) => w.teil).sort();
      expect(teile, `Halle ${nr}`).toEqual(["Nord", "Rueck", "Sued"]);
    }
  });

  it("die Rückwand liegt der Torrichtung genau gegenüber", () => {
    for (const w of hallenWaende().filter((x) => x.teil === "Rueck")) {
      const richtung = Math.sign(w.x - HALLEN_X);
      expect(richtung, `Halle ${w.nr}: Rückwand auf der Torseite`).toBe(-TOR_RICHTUNG.x);
    }
  });
});
