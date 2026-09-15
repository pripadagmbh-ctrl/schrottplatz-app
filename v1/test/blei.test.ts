/**
 * Was das Blei kostet — in Euro, nicht in Vermutungen (E-029).
 *
 * Batterien hatten am Bagger kein Ziel: Wer einen Akku aus einem Wrack fischte,
 * bekam überall „falsche Zone" — derselbe offene Punkt, den Edelstahl bis zum
 * 15.09.2026 hatte. Vorgeschlagen war eine eigene kleine Batteriemulde
 * (Gefahrgut, und Blei im Kupfer drückt die Reinheit). **Patrick hat sich für
 * die gemeinsame Mulde entschieden**, beide Folgen lagen ihm vor.
 *
 * Dieser Wächter hält fest, was diese Entscheidung kostet — und was sie nicht
 * kostet:
 *
 *  1. In der MULDE null Euro: Verdient wird beim Verkauf aus dem Container des
 *     Abholers, je Stück nach seiner eigenen Fraktion (`sellContainer`), und
 *     Lambert trägt jeden Akku in das BATTERIEN-Silo.
 *  2. Wenn das Blei doch MITGEHT — also in derselben Fuhre verkauft wird —,
 *     kostet es 155,00 € je 100 kg. Das ist die Zahl, die Patrick kennen soll.
 *  3. Am SCHILD verschwindet die Warnung: Ein Akku gilt nicht mehr als
 *     Fremdstoff. Das ist der eigentliche Preis, und er ist kein Geldbetrag.
 *
 * Preise aus `materials/catalog.ts` (Briefing Kap. 7):
 * Kupfer 7,20 €/kg · Messing 4,30 · Batterien 0,55.
 */
import { describe, it, expect } from "vitest";
import { MATERIALS } from "../src/materials/catalog";
import { containerValueGemischt } from "../src/materials/purity";
import { CONFIGS, gehoertHierhin, lagerMuldeFuer } from "../src/world/containers";

const preis = (id: string): number => MATERIALS[id]!.sellPricePerKg;

/**
 * Der echte Erlös, wie `Account.sellContainer` ihn rechnet: dominante Fraktion,
 * Reinheit hoch drei. Hier nachgebaut wie in `test/buntmetall.test.ts` — der
 * Originalaufruf braucht eine Physikwelt.
 */
function erlös(massen: Array<[string, number]>): number {
  const gesamt = massen.reduce((a, [, kg]) => a + kg, 0);
  let dominant = "";
  let dominantKg = 0;
  for (const [id, kg] of massen) {
    if (kg > dominantKg) {
      dominantKg = kg;
      dominant = id;
    }
  }
  const reinheit = dominantKg / gesamt;
  return gesamt * preis(dominant) * reinheit ** 3;
}

describe("Batterien in der Mulde BUNT + VA", () => {
  it("sie haben am Bagger endlich ein Ziel", () => {
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    expect(
      gehoertHierhin(bunt, "battery"),
      "ein Akku gilt in der Mulde weiterhin als Fremdstoff"
    ).toBe(true);
    // Und was wirklich nicht hineingehört, gilt weiter als Fremdstoff.
    for (const id of ["steel", "mixed", "rubble", "tires", "wood", "plastic"]) {
      expect(gehoertHierhin(bunt, id), `${id} gilt als richtig`).toBe(false);
    }
  });

  it("das Batterie-Lagersilo bleibt getrennt — dort wird sortiert", () => {
    /*
     * Das ist die Bedingung, unter der die gemeinsame Mulde nichts kostet
     * (E-028): Lambert liest `item.materialId` und trägt jeden Akku in SEIN
     * Silo, unabhängig davon, in welcher Mulde er lag.
     */
    expect(lagerMuldeFuer("battery")?.id).toBe("c_battery");
    expect(lagerMuldeFuer("copper")?.id).toBe("c_copper_lager");
    // Die Sammelmulde am Bagger ist kein Lager und darf nie eines werden.
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    expect(bunt.lager, "die Sortiermulde ist zum Lager geworden").not.toBe(true);
    // Kein Lagersilo nimmt Blei nebenbei mit auf.
    for (const c of CONFIGS.filter((x) => x.lager === true && x.id !== "c_battery")) {
      expect(gehoertHierhin(c, "battery"), `${c.label} nimmt Blei mit`).toBe(false);
    }
  });

  it("solange die Silos getrennt bleiben, kostet das Blei null Euro", () => {
    /*
     * Beispielfuhre wie in E-028, um 100 kg Akku erweitert:
     * je 100 kg Alu, Zink, Kupfer, Messing, Kabel — plus 100 kg Batterien.
     *
     *   ALU-LAGER      200 kg, Alu dominiert, Reinheit 0,50   37,50 €
     *   KUPFER-LAGER   200 kg, Kupfer dominiert, Reinheit 0,50 180,00 €
     *   KABEL-LAGER    100 kg sortenrein                     220,00 €
     *   BATTERIE-SILO  100 kg sortenrein                      55,00 €
     */
    const aluFuhre = erlös([
      ["alu", 100],
      ["zinc", 100],
    ]);
    const kupferFuhre = erlös([
      ["copper", 100],
      ["brass", 100],
    ]);
    const kabelFuhre = erlös([["cable", 100]]);
    const bleiFuhre = erlös([["battery", 100]]);
    expect(bleiFuhre).toBeCloseTo(55.0, 2);
    const mitBlei = aluFuhre + kupferFuhre + kabelFuhre + bleiFuhre;
    const ohneBlei = aluFuhre + kupferFuhre + kabelFuhre;
    expect(ohneBlei).toBeCloseTo(437.5, 2);
    expect(mitBlei).toBeCloseTo(492.5, 2);
    // Das Blei bringt seinen eigenen Wert und nimmt keinem anderen etwas weg.
    expect(mitBlei - ohneBlei).toBeCloseTo(bleiFuhre, 6);
  });

  it("geht das Blei in derselben Fuhre mit, kostet es 155,00 € je 100 kg", () => {
    /*
     * DIE ZAHL, DIE PATRICK KENNEN SOLL.
     *
     * Der Weg, auf dem es schiefgeht: Der Spieler lädt den Container des
     * Abholers direkt aus der Sammelmulde, statt aus dem Silo. Dann liegt der
     * Akku zwischen Kupfer und Messing, und `sellContainer` rechnet Reinheit
     * HOCH DREI.
     *
     *   ohne Blei   200 kg, Kupfer dominiert mit 100 kg, Reinheit 0,50
     *               200 × 7,20 × 0,125                       = 180,00 €
     *   mit Blei    300 kg, Kupfer dominiert mit 100 kg, Reinheit 0,333
     *               300 × 7,20 × 0,037                       =  80,00 €
     *
     * 100 kg MEHR in der Fuhre und 100,00 € WENIGER heraus. Und die 100 kg
     * Akku, getrennt verkauft, hätten selbst 55,00 € gebracht.
     */
    const ohneBlei = erlös([
      ["copper", 100],
      ["brass", 100],
    ]);
    const mitBlei = erlös([
      ["copper", 100],
      ["brass", 100],
      ["battery", 100],
    ]);
    expect(ohneBlei).toBeCloseTo(180.0, 2);
    expect(mitBlei).toBeCloseTo(80.0, 2);
    expect(ohneBlei - mitBlei, "die Fuhre selbst").toBeCloseTo(100.0, 2);
    const getrennt = ohneBlei + erlös([["battery", 100]]);
    expect(getrennt).toBeCloseTo(235.0, 2);
    expect(getrennt - mitBlei, "der volle Unterschied je 100 kg Blei").toBeCloseTo(155.0, 2);
    // Als Anteil: Es bleibt ein Drittel übrig.
    expect(mitBlei / getrennt).toBeCloseTo(0.3404, 3);
  });

  it("dafür warnt das Schild nicht mehr vor Blei — das ist der wahre Preis", () => {
    /*
     * Vorher zählte ein Akku in der Mulde als Fremdstoff und drückte den
     * Schildwert quadratisch; jetzt zählt er mit seinem eigenen Preis. Die
     * Ampel geht damit nicht mehr auf Rot, wenn Blei zwischen dem Kupfer
     * liegt. Gerechnet an 500 kg Buntmetall plus 100 kg Akku:
     *
     *   Akku als Fremdstoff   1602,00 × (500/600)²  = 1112,50 €
     *   Akku gehört dazu      1602,00 + 55,00       = 1657,00 €
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const inhalt: Array<[string, number]> = [
      ["alu", 100],
      ["zinc", 100],
      ["copper", 100],
      ["brass", 100],
      ["cable", 100],
      ["battery", 100],
    ];
    const jetzt = containerValueGemischt(inhalt, (id) => gehoertHierhin(bunt, id), preis);
    expect(jetzt, "das Schild rechnet den Akku nicht mit").toBeCloseTo(1657.0, 2);
    const vorher = containerValueGemischt(
      inhalt,
      (id) => id !== "battery" && gehoertHierhin(bunt, id),
      preis
    );
    expect(vorher).toBeCloseTo(1112.5, 2);
    expect(jetzt - vorher, "so viel Warnung ist weggefallen").toBeCloseTo(544.5, 2);
    /*
     * Was weiterhin warnt: alles, was wirklich nicht hineingehört. 100 kg
     * Stahl unter 500 kg Nichteisen lassen vom Schildwert 69 % übrig — die
     * Mulde ist also keine Freikarte geworden, sie kennt nur ein Gefahrgut
     * mehr.
     */
    const mitStahl = containerValueGemischt(
      [...inhalt, ["steel", 100]],
      (id) => gehoertHierhin(bunt, id),
      preis
    );
    expect(mitStahl / jetzt).toBeCloseTo((600 / 700) ** 2, 6);
  });
});
