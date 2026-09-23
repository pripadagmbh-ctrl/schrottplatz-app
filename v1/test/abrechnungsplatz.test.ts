/**
 * Passt das Abrechnungsbild aufs Gerät? (E-113)
 *
 * Gerechnet mit `test/abrechnungsmass.ts`, gezeichnet von
 * `tools/abrechnungsbild.ts` — dieselbe Rechnung, eine Quelle.
 *
 * Der Fall, der hier abgefangen wird, ist der von E-093 (Senderliste): Ein
 * Feld, das auf dem iPad passt, rutscht auf dem iPhone mini quer (375 px hoch)
 * unten aus dem Bild — und dann ist der einzige Knopf nicht mehr zu erreichen.
 * Bei DIESEM Feld wäre das schlimmer als beim Radio: Es steht vor dem
 * Weiterspielen, es ist keine Wahl, sondern der einzige Weg.
 */
import { describe, it, expect } from "vitest";
import { FASSUNGEN } from "./cssmass";
import { abrechnungsMass } from "./abrechnungsmass";

describe("Das Abrechnungsbild passt in jede Fassung", () => {
  for (const f of FASSUNGEN) {
    const m = abrechnungsMass(f);

    it(`${f.name}: nichts rutscht aus dem Bild`, () => {
      expect(
        m.luft,
        `gebraucht ${m.gebraucht.toFixed(0)} px, Platz ${m.platz.toFixed(0)} px — ` +
          m.bloecke.map((b) => `${b.name} ${b.hoehe.toFixed(0)}`).join(", ")
      ).toBeGreaterThanOrEqual(0);
    });

    it(`${f.name}: die Zahlenspalte passt in die Breite`, () => {
      expect(m.gebrauchteBreite).toBeLessThanOrEqual(m.inhaltBreite + 0.5);
    });

    it(`${f.name}: WEITER ist mit dem Daumen zu treffen (44 px)`, () => {
      expect(m.knopfHoehe).toBeGreaterThanOrEqual(44);
    });

    /** Briefing Kap. 20: Text nicht unter 14 px. Auch nicht auf dem Telefon. */
    it(`${f.name}: die Zahlen stehen in mindestens 14 px`, () => {
      expect(m.zeilenSchrift).toBeGreaterThanOrEqual(14);
    });
  }

  it("GEGENPROBE: eine Fassung ohne Höhe fällt durch", () => {
    const winzig = abrechnungsMass({ name: "Probe", w: 812, h: 200, sa: { l: 0, r: 0, t: 0, b: 0 } });
    expect(winzig.luft).toBeLessThan(0);
  });
});
