/**
 * Die Silo-Reihe: vollzählig versorgt, an der Wand, anfahrbar — und der Müll
 * steht nicht in der Rückfahrspur.
 *
 * Am 15.09.2026 ist die Reihe von neun auf sechs gekürzt und an die andere
 * Wand gezogen. Kürzen heißt kein Material verlieren: Was `lager: true`
 * trägt, ist das Ziel des sortenreinen Kippers UND Lamberts Ablageort. Fällt
 * ein Silo weg, ohne dass seine Fraktion woanders unterkommt, bleibt sie
 * liegen — und zwar stumm, ohne Fehlermeldung. Genau das hält der erste Test
 * hier fest.
 */
import { describe, it, expect } from "vitest";
import { CONFIGS, gehoertHierhin, lagerMuldeFuer } from "../src/world/containers";
import { MATERIALS } from "../src/materials/catalog";
import { YARD_MAX_X, YARD_D } from "../src/world/yard";
import { hitsObstacle } from "../src/world/obstacles";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN, abstandVomStand } from "../src/world/baggerstand";
import { ABLADE_SPUR_X, ABLADE_HALT_Z, MULDEN_GASSE_X } from "../src/delivery/routes";
import { StaffManager, imBaggerrevier } from "../src/world/people";

const LAGER = CONFIGS.filter((c) => c.lager === true);

/**
 * Fraktionen, die bewusst KEIN Lagersilo haben.
 *
 * Stahl und Mischschrott werden direkt an der Halde verladen (E-010: „Stahl
 * entfällt — ein Silo dafür wäre ein Umweg"). Beide stehen als Halde im
 * Katalog der Behälter und brauchen kein zweites Ziel.
 */
const OHNE_SILO = new Set(["steel", "mixed"]);

describe("Keine Fraktion verliert ihr Lager", () => {
  it("für jede Fraktion im Katalog gibt es ein Silo — oder einen genannten Grund", () => {
    const ohne: string[] = [];
    for (const id of Object.keys(MATERIALS)) {
      if (OHNE_SILO.has(id)) continue;
      if (!lagerMuldeFuer(id)) ohne.push(id);
    }
    expect(ohne, `ohne Lagerziel: ${ohne.join(", ")}`).toEqual([]);
  });

  it("und die drei gestrichenen Fraktionen landen nachweislich im ABFALL", () => {
    /*
     * HOLZ, KUNSTSTOFF und BAUMISCH hatten bis zum 15.09.2026 je ein eigenes
     * Silo. Sie sind zu einem zusammengelegt, weil alle vier Abfallsätze
     * negativ sind (−0,02 bis −0,06 €/kg, `materials/catalog.ts`): Sie werden
     * entsorgt, nicht verkauft, und ein Abnehmer bestellt sie nie.
     */
    const abfall = lagerMuldeFuer("rubble");
    expect(abfall?.id).toBe("c_rubble");
    for (const id of ["wood", "plastic", "tires", "rubble"]) {
      expect(lagerMuldeFuer(id)?.id, `${id} findet das Abfall-Silo nicht`).toBe("c_rubble");
      expect(MATERIALS[id]!.sellPricePerKg, `${id} ist kein Abfall`).toBeLessThan(0);
    }
  });

  it("was der Spieler in den MUELL wirft, darf Lambert eins zu eins weitertragen", () => {
    /*
     * Sonst zählte die Hälfte im Silo als Verunreinigung und drückte die
     * Reinheit des ganzen Behälters (Briefing Kap. 7, Erlös = kg × Preis ×
     * Reinheit²).
     */
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    const silo = CONFIGS.find((c) => c.id === "c_rubble")!;
    for (const id of ["rubble", "tires", "wood", "plastic"]) {
      expect(gehoertHierhin(muell, id), `${id} gehört nicht in den MUELL`).toBe(true);
      expect(gehoertHierhin(silo, id), `${id} gehört nicht ins ABFALL-Silo`).toBe(true);
    }
  });

  it("kein Silo ist eine leere Hülle mehr", () => {
    // Das E-Motoren-Silo war baulich fertig, hatte aber keine Fraktion
    // (E-011) — es ist ersatzlos entfallen, und mit ihm das Kennzeichen.
    for (const c of CONFIGS) expect(c.nurHuelle, `${c.label}`).toBeUndefined();
  });
});

describe("Die Reihe steht an der Wand und in der Nordhälfte", () => {
  it("es sind sechs", () => {
    expect(LAGER.length).toBe(6);
  });

  it("jedes Silo steht mit dem Rücken an der Ostgrenze", () => {
    for (const c of LAGER) {
      const ruecken = c.x + c.size[0] / 2;
      const luft = YARD_MAX_X - ruecken;
      expect(luft, `${c.label}: ${luft.toFixed(2)} m Leere hinter dem Silo`).toBeLessThan(1.5);
      expect(luft, `${c.label}: steht in der Mauer`).toBeGreaterThan(0.3);
    }
  });

  it("die Reihe hat gleichen Achsabstand und bleibt innerhalb der Mauern", () => {
    const z = LAGER.map((c) => c.z).sort((a, b) => b - a);
    for (let i = 1; i < z.length; i++) {
      expect(z[i - 1]! - z[i]!, "ungleicher Achsabstand").toBeCloseTo(4.6, 6);
    }
    // Flankenmaß: halbe Tiefe plus Steinreihe (0,275 m)
    const flanke = LAGER[0]!.size[1] / 2 + 0.275;
    expect(z[0]! + flanke, "das nördlichste Silo steht in der Nordmauer").toBeLessThan(
      YARD_D / 2 - 0.3
    );
  });

  it("und bewusst außerhalb des Schwenkbands — dorthin wird gefahren", () => {
    for (const c of LAGER) {
      expect(abstandVomStand(c.x, c.z), `${c.label} steht im Schwenkband`).toBeGreaterThan(
        SCHWENK_AUSSEN
      );
    }
  });

  it("Lambert kommt an jedes Silo — keines liegt in seinem Sperrgebiet", () => {
    /*
     * Lambert faehrt nicht in den Arbeitsbereich des Baggers (Ansage
     * 12.09.2026). Faellt ein Silo in dieses Gebiet, traegt er nichts mehr
     * dorthin — ohne Fehlermeldung, das Material bleibt einfach liegen.
     *
     * Genau das drohte am 15.09.2026: Die Reihe steht jetzt an der Ostwand,
     * ihr suedlichstes Silo auf z +0,8, und die Nordgrenze des Sperrgebiets
     * stand als feste 2,0 im Quelltext.
     */
    for (const c of LAGER) {
      expect(imBaggerrevier(c.x, c.z), `${c.label} liegt in Lamberts Sperrgebiet`).toBe(false);
      const [ax, az] = StaffManager.anfahrtZu(c);
      expect(
        imBaggerrevier(ax, az),
        `${c.label}: der Halteplatz (${ax.toFixed(1)}|${az.toFixed(1)}) liegt im Sperrgebiet`
      ).toBe(false);
    }
  });

  it("die Gasse läuft vor den Öffnungen, nicht in ihnen", () => {
    for (const c of LAGER) {
      const oeffnung = c.x - c.size[0] / 2;
      const abstand = oeffnung - MULDEN_GASSE_X;
      expect(abstand, `${c.label}: Gasse ${abstand.toFixed(2)} m vor der Öffnung`).toBeCloseTo(
        5.0,
        6
      );
      expect(hitsObstacle(MULDEN_GASSE_X, c.z, 1.4), `${c.label}: Gasse versperrt`).toBeNull();
    }
  });
});

describe("Der Müll steht nicht mehr in der Rückfahrspur", () => {
  const muell = CONFIGS.find((c) => c.id === "r_rubble")!;

  it("er liegt im Schwenkband — vierte Pflichtstation", () => {
    const d = abstandVomStand(muell.x, muell.z);
    expect(d, `MUELL ${d.toFixed(2)} m vom Sitz`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(d).toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("aber westlich der Rückfahrspur zum Abladeplatz", () => {
    /*
     * Ansage Patrick 15.09.2026: „Die LKWs fahren in die Müllmulde." Gemessen
     * lag die alte Mulde (7,0 | −27,0) mit ihrer Nordwand 2,45 x 0,70 m unter
     * der Ladefläche des haltenden Wagens.
     *
     * Die Spur ist der Streifen x = ABLADE_SPUR_X ± (halbe Wagenbreite 1,55 +
     * Tastrand 1,40) von der Rangierhöhe bis zum Halt. Der ganze Grundriss der
     * Mulde muss davon weg sein — samt Stirnwand, die 0,35 m übersteht.
     */
    const spurHalb = 1.55 + 1.4;
    const ostkante = muell.x + muell.size[0] / 2 + 0.35;
    expect(
      ostkante,
      `MUELL reicht bis x ${ostkante.toFixed(2)}, die Spur beginnt bei ${(
        ABLADE_SPUR_X - spurHalb
      ).toFixed(2)}`
    ).toBeLessThan(ABLADE_SPUR_X - spurHalb);
  });

  it("und der Greifer kommt hinein, ohne in eine Wand zu fassen", () => {
    /*
     * Die offene Spinne misst 3,38 m. Die Mulde ist nach OSTEN offen — zum
     * Sitz und zur Kipperspur hin, von wo das Material kommt. Geprüft wird,
     * dass dort auf 1,0 m nichts steht.
     */
    const auf = muell.facing === "east" ? 1 : -1;
    expect(
      hitsObstacle(muell.x + auf * (muell.size[0] / 2 + 1.0), muell.z, 0),
      "die Öffnung des MUELL ist zugestellt"
    ).toBeNull();
    // Und auf der anderen Seite steht die Stirnwand — sonst läuft der Müll in
    // die Kabel-Mulde.
    expect(
      hitsObstacle(muell.x - auf * (muell.size[0] / 2), muell.z, 0),
      "die Stirnwand des MUELL fehlt"
    ).not.toBeNull();
  });

  it("er steht auch nicht vor der Öffnung einer Metallmulde", () => {
    for (const c of CONFIGS.filter((x) => x.sortierbox === true)) {
      const probe = c.x + c.size[0] / 2 + 0.8;
      expect(
        hitsObstacle(probe, c.z, 0),
        `${c.label}: der MUELL steht vor der Öffnung`
      ).toBeNull();
    }
  });

  it("und der Abladeplatz selbst ist auf ganzer Wagenlänge frei", () => {
    // Umriss aus `vehicleModel.ts`: Heck −(bedLen/2 + 0,14), Kabine
    // +(bedLen/2 + 1,90) um den Haltepunkt, halbe Breite 1,55 m.
    const bedLen = 6.0; // der längste Wagen (Kipper)
    for (let dz = -(bedLen / 2 + 0.14); dz <= bedLen / 2 + 1.9; dz += 0.4) {
      for (const dx of [-1.55, 0, 1.55]) {
        expect(
          hitsObstacle(ABLADE_SPUR_X + dx, ABLADE_HALT_Z + dz, 0),
          `Abladeplatz belegt bei (${(ABLADE_SPUR_X + dx).toFixed(2)} | ${(
            ABLADE_HALT_Z + dz
          ).toFixed(2)})`
        ).toBeNull();
      }
    }
  });

  it("der Sitz steht noch dort, wo der Platz für ihn gebaut wurde", () => {
    expect(BAGGER_STAND).toEqual({ x: -0.5, z: -22.5 });
  });
});
