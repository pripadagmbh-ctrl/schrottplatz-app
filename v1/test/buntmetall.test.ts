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
  gehoertHierhin,
  lagerMuldeFuer,
  totenStreifen,
  AUGPUNKT_UNTEN,
  MULDE_STEIN,
} from "../src/world/containers";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
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

  it("die Schwelle vorn ist so hoch wie möglich, ohne den Blick zu nehmen", () => {
    /*
     * Wunsch Patrick 14.09.2026, bestätigt am 15.09.: „vorn niedrig zumauern,
     * damit nichts zurückrollt — aber bei abgesenkter Kabine muss man noch
     * hineinsehen können."
     *
     * Die Grenze ist gerechnet, nicht gegriffen. Augpunkt bei abgesenkter
     * Kabine: 3,28 m (`excavator.ts`: cabGroup y 1,60 + Augpunkt lokal 1,68;
     * dieselbe Zahl in `docs/baggerkonzept.md`). Der Blick streift die
     * Wandkrone und trifft den Boden erst dahinter:
     *
     *     blind = h × D / (H − h)
     *
     * Die Baggerseite der Mulde läuft von (−5,5 | −22,2) bis (−5,5 | −16,2),
     * also 5,01 bis 8,04 m vom Sitz. Gefordert: Vom UNGÜNSTIGSTEN Punkt aus
     * bleiben mindestens 60 % des 6,0 m langen, 4,2 m tiefen Bodens sichtbar.
     *
     *   0,50 m (eine Lage):  blind 0,90 bis 1,45 m  →  65 bis 79 % sichtbar
     *   1,00 m (zwei Lagen): blind 2,20 bis 3,53 m  →  16 bis 48 % sichtbar
     */
    const bunt = CONFIGS.find((c) => c.id === "r_bunt")!;
    const h = bunt.niedrigeStirn;
    expect(h, "die Schwelle fehlt").toBeDefined();
    // Sie ist ein ganzes Vielfaches einer Betonlego-Lage — nichts wird gesägt.
    expect((h! / MULDE_STEIN.hoehe) % 1, `${h} m sind keine ganzen Lagen`).toBeCloseTo(0, 6);

    const [w, d] = bunt.size;
    const wandX = bunt.x + w / 2;
    const tiefe = w; // von der Schwelle bis zur gegenüberliegenden Kante
    let schlechtester = 1;
    for (const z of [bunt.z - d / 2, bunt.z, bunt.z + d / 2]) {
      const D = abstandVomStand(wandX, z);
      const sichtbar = Math.max(0, tiefe - totenStreifen(h!, D)) / tiefe;
      schlechtester = Math.min(schlechtester, sichtbar);
    }
    expect(
      schlechtester,
      `nur ${(schlechtester * 100).toFixed(0)} % des Muldenbodens sichtbar`
    ).toBeGreaterThan(0.6);

    // Und eine Lage mehr wäre zu viel — das ist die Zahl, an der es hängt.
    const zweiLagen = Math.max(
      0,
      tiefe - totenStreifen(h! + MULDE_STEIN.hoehe, abstandVomStand(wandX, bunt.z + d / 2))
    ) / tiefe;
    expect(zweiLagen, "eine Lage mehr ginge auch noch").toBeLessThan(0.6);
    expect(AUGPUNKT_UNTEN, "Augpunkt aus excavator.ts").toBeCloseTo(3.28, 6);
    expect(BAGGER_STAND).toEqual({ x: -0.5, z: -22.5 });
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
    expect(schwelle!.x).toBeCloseTo(bunt.x + bunt.size[0] / 2, 6);
    // Auf der Baggerseite, nicht auf der Lambertseite.
    expect(schwelle!.x, "die Schwelle steht auf der falschen Seite").toBeGreaterThan(bunt.x);
    expect(
      STATIC_OBSTACLES.some((o) => o.label === `${bunt.label} Stirn`),
      "die volle Stirnwand ist zurück"
    ).toBe(false);
  });
});
