/**
 * Was die Buntmetall-Mulde im Geldkreislauf kostet — in Euro, nicht in
 * Vermutungen (E-028).
 *
 * Ansage Patrick 15.09.2026: „Das mit der Buntmetallmulde ist in Ordnung. Das
 * heißt, du kannst da die Mulden alle wegmachen und machst nur noch eine
 * Buntmetallmulde." Und zur Rolle: „Also, wir würden erstmal alles rausfischen
 * in die Mulde tun und dann später entweder ich oder Lambert das sortieren."
 *
 * Die Mulde am Bagger ist damit ein PUFFER, kein Abrechnungsort. Dieser
 * Wächter hält die drei Zahlen fest, an denen das hängt — und den Weg, an dem
 * es kippen würde:
 *
 *  1. Verdient wird beim Verkauf aus dem Container des Abholers, je Stück nach
 *     seiner eigenen Fraktion (`sellContainer`). Die Mulde kommt darin nicht
 *     vor.
 *  2. Solange die Lagersilos getrennt bleiben, ändert das Zusammenlegen der
 *     Mulden **null Euro**.
 *  3. Würde man die Silos mitzusammenlegen, bräche der Erlös um über 90 %
 *     ein — Reinheit hoch drei.
 *
 * Die Beispielfuhre ist überall dieselbe: je 100 kg Alu, Zink, Kupfer,
 * Messing, Kabel. Preise aus `materials/catalog.ts` (Briefing Kap. 7).
 */
import { describe, it, expect } from "vitest";
import { MATERIALS } from "../src/materials/catalog";
import { containerValue, containerValueGemischt } from "../src/materials/purity";
import {
  CONFIGS,
  bayHalb,
  gehoertHierhin,
  lagerMuldeFuer,
  totenStreifen,
  AUGPUNKT_UNTEN,
  MULDE_STEIN,
} from "../src/world/containers";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { PRESS_CENTER, PRESS_FUSS, KLAPPE_WEG, KLAPPE_RICHTUNG } from "../src/world/press";
import { BAGGER_STAND, abstandVomStand } from "../src/world/baggerstand";

const FUHRE: Array<[string, number]> = [
  ["alu", 100],
  ["zinc", 100],
  ["copper", 100],
  ["brass", 100],
  ["cable", 100],
];
/**
 * Edelstahl UND Batterien liegen seit dem 15.09.2026 mit in der Mulde
 * (Entscheidungen Patrick, E-028 und E-029). Was das Blei kostet, steht in
 * `test/blei.test.ts` — hier zaehlt nur, dass es dazugehoert.
 */
const AUCH_DRIN = ["va", "battery"];
const preis = (id: string): number => MATERIALS[id]!.sellPricePerKg;

/**
 * Der echte Erlös, wie `Account.sellContainer` ihn rechnet: dominante Fraktion,
 * Reinheit hoch drei. Hier nachgebaut, weil der Originalaufruf eine Physikwelt
 * und einen ItemManager braucht — die Formel ist dieselbe und steht in
 * `economy/account.ts` daneben.
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

describe("Die Buntmetall-Mulde ist ein Puffer und kostet kein Geld", () => {
  it("es gibt genau eine Sortiermulde, und sie nimmt alle sechs Fraktionen", () => {
    const mulden = CONFIGS.filter((c) => c.sortierbox === true);
    expect(mulden.length, "es sind nicht mehr eine").toBe(1);
    const bunt = mulden[0]!;
    expect(bunt.id).toBe("r_bunt");
    for (const id of [...FUHRE.map(([m]) => m), ...AUCH_DRIN]) {
      expect(gehoertHierhin(bunt, id), `${id} gilt in der Mulde als Fremdstoff`).toBe(true);
    }
    /*
     * Die Aufschrift muss beides decken: Buntmetall UND Edelstahl. „BUNTMETALL"
     * allein wäre fachlich falsch — VA ist legierter Stahl.
     */
    expect(bunt.label).toBe("BUNT + VA");
    // Und was wirklich nicht hineingehört, gilt weiterhin als Fremdstoff —
    // sonst wäre die Ampel wertlos.
    for (const id of ["steel", "mixed", "rubble", "tires", "wood"]) {
      expect(gehoertHierhin(bunt, id), `${id} gilt als richtig`).toBe(false);
    }
  });

  it("jede der fünf Fraktionen findet weiter IHR eigenes Silo — dort wird sortiert", () => {
    /*
     * Das ist die Bedingung, unter der das Zusammenlegen nichts kostet:
     * getrennte Lagersilos. Lambert trägt jedes Stück einzeln in das Silo
     * seiner Fraktion (`people.ts`, `muldeFuer` liest `item.materialId`), und
     * der Spieler räumt sortenrein aus EINEM Silo in den Container.
     */
    expect(lagerMuldeFuer("alu")?.id).toBe("c_alu_lager");
    expect(lagerMuldeFuer("zinc")?.id).toBe("c_alu_lager");
    expect(lagerMuldeFuer("copper")?.id).toBe("c_copper_lager");
    expect(lagerMuldeFuer("brass")?.id).toBe("c_copper_lager");
    expect(lagerMuldeFuer("cable")?.id).toBe("c_cable_lager");
    expect(lagerMuldeFuer("va")?.id, "VA hat kein eigenes Lagersilo mehr").toBe("c_va_lager");
  });

  it("Weg A (Silos getrennt): 437,50 € — vor wie nach dem Zusammenlegen", () => {
    /*
     * Drei Fuhren aus drei Silos. Die Zahlen sind unabhängig davon, ob am
     * Bagger eine oder drei Mulden stehen: Der Weg des einzelnen Stücks endet
     * in beiden Fällen im selben Silo.
     *
     *   ALU-LAGER    200 kg, Alu dominiert, Reinheit 0,50 → 200 × 1,50 × 0,125
     *   KUPFER-LAGER 200 kg, Kupfer dominiert, Reinheit 0,50
     *   KABEL-LAGER  100 kg, sortenrein
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
    expect(aluFuhre).toBeCloseTo(37.5, 2);
    expect(kupferFuhre).toBeCloseTo(180.0, 2);
    expect(kabelFuhre).toBeCloseTo(220.0, 2);
    expect(aluFuhre + kupferFuhre + kabelFuhre).toBeCloseTo(437.5, 2);
  });

  it("Weg B (Silos ebenfalls zusammengelegt): 28,80 € — 93 % weniger", () => {
    /*
     * EIN Buntmetall-Silo, aus dem der Spieler in einem Zug lädt: 500 kg, die
     * dominante Fraktion wiegt 100 kg, Reinheit 0,20, und die geht hoch drei.
     * Das ist die Warnung, die in den Bericht gehört — nicht die Mulde am
     * Bagger kostet Geld, sondern ein zusammengelegtes LAGER.
     */
    const einSilo = erlös([
      ["copper", 100],
      ["alu", 100],
      ["zinc", 100],
      ["brass", 100],
      ["cable", 100],
    ]);
    expect(einSilo).toBeCloseTo(28.8, 2);
    const wegA = 437.5;
    expect(wegA - einSilo).toBeCloseTo(408.7, 2);
    expect(einSilo / wegA).toBeLessThan(0.07);
  });

  it("das Schild rechnet je Stoff und springt beim Zusammenlegen nicht", () => {
    /*
     * Mit der alten Rechnung (`containerValue`, ganzer Inhalt zum Preis der
     * Leitfraktion) stünde derselbe Inhalt je nach gewählter Leitfraktion
     * zwischen 410 € (Zink) und 3600 € (Kupfer) auf dem Schild. Und schon die
     * bisherigen Paare logen: Messing zum Kupferpreis, Zink zum Alupreis.
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const gemischt = containerValueGemischt(
      FUHRE,
      (id) => gehoertHierhin(bunt, id),
      preis
    );
    expect(gemischt, "je Stoff gerechnet").toBeCloseTo(1602.0, 2);

    // Dieselbe Fuhre auf die drei alten Mulden verteilt — dieselbe Summe.
    const alt =
      containerValueGemischt(
        [
          ["alu", 100],
          ["zinc", 100],
        ],
        (id) => id === "alu" || id === "zinc",
        preis
      ) +
      containerValueGemischt(
        [
          ["copper", 100],
          ["brass", 100],
        ],
        (id) => id === "copper" || id === "brass",
        preis
      ) +
      containerValueGemischt([["cable", 100]], (id) => id === "cable", preis);
    expect(alt, "die Aufstellung ändert sich beim Zusammenlegen").toBeCloseTo(gemischt, 6);

    // Und so weit lag die alte Rechnung daneben.
    const naivKupfer = containerValue(MATERIALS["copper"]!, 500, 0);
    expect(naivKupfer).toBeCloseTo(3600.0, 2);
    const naivZink = containerValue(MATERIALS["zinc"]!, 500, 0);
    expect(naivZink).toBeCloseTo(410.0, 2);
  });

  it("Fremdstoff drückt weiter quadratisch — der Puffer ist keine Freikarte", () => {
    /*
     * 400 kg Buntmetall und 100 kg Stahl: Reinheit 0,80, also 64 % des Werts.
     * Wer die Mulde als Mülleimer benutzt, sieht das sofort am Schild.
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const sauber = containerValueGemischt(
      [
        ["copper", 100],
        ["brass", 100],
        ["alu", 100],
        ["cable", 100],
      ],
      (id) => gehoertHierhin(bunt, id),
      preis
    );
    const dreckig = containerValueGemischt(
      [
        ["copper", 100],
        ["brass", 100],
        ["alu", 100],
        ["cable", 100],
        ["steel", 100],
      ],
      (id) => gehoertHierhin(bunt, id),
      preis
    );
    expect(dreckig / sauber).toBeCloseTo(0.64, 6);
  });

  it("die Schwelle vorn ist zwei Lagen hoch — Entscheidung über Rechnung", () => {
    /*
     * HIER STEHEN ZWEI DINGE NEBENEINANDER, UND KEINES ERSETZT DAS ANDERE.
     *
     * 1. WAS VON DER ALTEN REGEL GILT: die Rechnung. Der Augpunkt bei
     *    abgesenkter Kabine liegt auf 3,28 m (`excavator.ts`: cabGroup y 1,60
     *    + Augpunkt lokal 1,68; dieselbe Zahl in `docs/baggerkonzept.md`), der
     *    Blick streift die Wandkrone und trifft den Boden erst dahinter:
     *
     *        blind = h × D / (H − h)
     *
     *    Sie ist unverändert richtig und wird hier weiter nachgerechnet — an
     *    der NEUEN Stelle, denn der tote Streifen wächst mit dem Abstand.
     *
     * 2. WAS PATRICK ÜBERSTIMMT HAT: die Höhe. Am 15.09.2026 stand aufgrund
     *    dieser Rechnung EINE Lage (0,50 m, 68–79 % Boden sichtbar); zwei
     *    Lagen waren ausdrücklich verworfen, weil sie den Blick nehmen.
     *    Patrick hat die eine Lage am Gerät gesehen und entschieden: „da kommt
     *    einfach noch 'ne Lage drüber, damit die Anhäufung etwas höher ist."
     *    Gebaut werden zwei. Der Wächter hält ab jetzt die ENTSCHEIDUNG fest
     *    (zwei ganze Lagen) und die MESSUNG daneben (wieviel man noch sieht),
     *    statt die alte Schranke zu verteidigen.
     *
     * Was er weiterhin verhindert: dass die Schwelle unbemerkt zur Mauer wird.
     * Ab 1,17 m sieht man vom hinteren Ende der Mulde überhaupt keinen Boden
     * mehr — diese Grenze bleibt hart.
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const h = bunt.niedrigeStirn;
    expect(h, "die Schwelle fehlt").toBeDefined();
    // Die Entscheidung: zwei Betonlego-Lagen, nichts wird gesägt.
    expect((h! / MULDE_STEIN.hoehe) % 1, `${h} m sind keine ganzen Lagen`).toBeCloseTo(0, 6);
    expect(h! / MULDE_STEIN.hoehe, "es sind nicht zwei Lagen").toBe(2);

    const [w, d] = bunt.size;
    const wandX = bunt.x + w / 2;
    const tiefe = w; // von der Schwelle bis zur gegenüberliegenden Kante
    const sicht = (hoehe: number, z: number): number =>
      Math.max(0, tiefe - totenStreifen(hoehe, abstandVomStand(wandX, z))) / tiefe;

    /*
     * DIE MESSUNG am neuen Standort (Mitte −7,6 | −19,8, Schwelle auf x −5,5,
     * also 5,01 m vom Sitz am vorderen und 7,58 m am hinteren Ende):
     *
     *              vorn    Mitte   hinten
     *   0,50 m     79 %    76 %    68 %
     *   1,00 m     48 %    41 %    21 %   ← gebaut
     */
    expect(sicht(1.0, bunt.z - d / 2), "vorderes Ende").toBeCloseTo(0.48, 2);
    expect(sicht(1.0, bunt.z), "Mitte").toBeCloseTo(0.41, 2);
    expect(sicht(1.0, bunt.z + d / 2), "hinteres Ende").toBeCloseTo(0.21, 2);
    // Und was eine Lage gebracht hätte — damit die Zahl nicht verlorengeht.
    expect(sicht(0.5, bunt.z + d / 2), "eine Lage, hinteres Ende").toBeCloseTo(0.68, 2);

    /*
     * DIE HARTE SCHRANKE: Vom hintersten Punkt muss ein Streifen Boden zu
     * sehen bleiben. Ab 1,17 m ist es an dieser Stelle vorbei — eine dritte
     * Lage (1,50 m) fiele hier durch.
     */
    expect(sicht(h!, bunt.z + d / 2), "die Schwelle nimmt den Boden ganz").toBeGreaterThan(0.15);
    expect(
      sicht(h! + MULDE_STEIN.hoehe, bunt.z + d / 2),
      "eine dritte Lage ginge auch noch — dann stimmt die Grenze nicht"
    ).toBe(0);

    expect(AUGPUNKT_UNTEN, "Augpunkt aus excavator.ts").toBeCloseTo(3.28, 6);
    expect(BAGGER_STAND).toEqual({ x: -0.5, z: -22.5 });
  });

  it("die Mulde steht neben der Presse und ganz im Schwenkband", () => {
    /*
     * Ansage Patrick 15.09.2026: „direkt eine Mulde neben der Presse
     * platzieren". „Neben" ist hier eine Zahl: Die Presse steht auf
     * (−8,0 | −26,0), ihr Rahmen endet nach Norden auf z −23,55, und ihre
     * Deckelklappe schwingt 3,85 m nach WESTEN — nach Norden schwingt nichts.
     * Geprüft wird beides: dass die Mulde dicht danebensteht (höchstens 1,5 m
     * Lücke) und dass sie den Rahmen nicht berührt.
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const { hd } = bayHalb(bunt);
    const suedkante = bunt.z - hd - 0.35; // 0,35 = halbe Wanddicke der Hindernisliste
    const pressenRahmen = PRESS_CENTER.z + PRESS_FUSS.hd;
    const luecke = suedkante - pressenRahmen;
    expect(luecke, `${luecke.toFixed(2)} m — die Mulde steht im Pressenrahmen`).toBeGreaterThan(0);
    expect(luecke, `${luecke.toFixed(2)} m — das ist nicht „direkt neben"`).toBeLessThan(1.5);

    // Die Klappe schwingt nach Westen, nicht nach Norden — sonst stünde die
    // Mulde in ihrem Weg.
    expect(Math.abs(KLAPPE_RICHTUNG.z), "die Klappe schwingt in z").toBeLessThan(0.01);
    const klappeX = PRESS_CENTER.x + KLAPPE_RICHTUNG.x * KLAPPE_WEG;
    expect(klappeX, "die Klappe schwingt zur Mulde hin").toBeLessThan(bunt.x - bunt.size[0] / 2);

    /*
     * Und der Grund, warum sie 0,60 m nach Süden gerückt ist: Jetzt liegt die
     * GANZE Muldenachse im Schwenkband (vorher 93 %).
     */
    const laenge = bunt.size[1];
    for (let i = 0; i <= 50; i++) {
      const z = bunt.z - laenge / 2 + (laenge * i) / 50;
      const dist = abstandVomStand(bunt.x, z);
      expect(dist, `Muldenachse bei z ${z.toFixed(1)}: ${dist.toFixed(2)} m`).toBeGreaterThanOrEqual(
        5.8
      );
      expect(dist, `Muldenachse bei z ${z.toFixed(1)}: ${dist.toFixed(2)} m`).toBeLessThanOrEqual(
        9.2
      );
    }
  });

  it("und sie steht in der Hindernisliste — niedrig, nicht als volle Wand", () => {
    /*
     * Gebaut und verzeichnet müssen dasselbe sagen (Lehre vom 12.09.2026).
     * Und sie darf nicht als volle Stirnwand geführt werden: `top` ist die
     * Schwellenhöhe, alles darüber schwenkt frei.
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const schwelle = STATIC_OBSTACLES.find((o) => o.label === `${bunt.label} Schwelle`);
    expect(schwelle, "die Schwelle fehlt in der Hindernisliste").toBeTruthy();
    expect(schwelle!.top).toBeCloseTo(bunt.niedrigeStirn!, 6);
    /*
     * MITTE DER STEINE, nicht Muldenkante (22.09.2026, E-110). Hier stand
     * `bunt.x + w/2` — das war die Kante, an der die Steine ANFANGEN; sie
     * stehen davor, also auf `w/2 + dicke/2`. Die alte Liste trug die Schwelle
     * auf x −5,50 und 0,35 m breit (−5,85 … −5,15), gebaut ist sie −5,50 …
     * −4,95: 0,35 m Sperre ohne Stein nach innen, 0,20 m Stein ohne Sperre
     * nach aussen. Genau das war Patricks Befund „Kollisionsprüfung ohne Mauer
     * bei Buntmetallmulde?".
     */
    expect(schwelle!.x).toBeCloseTo(bunt.x + bunt.size[0] / 2 + MULDE_STEIN.dicke / 2, 6);
    expect(schwelle!.hw).toBeCloseTo(MULDE_STEIN.dicke / 2, 6);
    // Auf der Baggerseite, nicht auf der Lambertseite.
    expect(schwelle!.x, "die Schwelle steht auf der falschen Seite").toBeGreaterThan(bunt.x);
    expect(
      STATIC_OBSTACLES.some((o) => o.label === `${bunt.label} Stirn`),
      "die volle Stirnwand ist zurück"
    ).toBe(false);
  });
});
