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
import {
  CONFIGS,
  gehoertHierhin,
  lagerMuldeFuer,
  bayHalb,
  bayOeffnung,
  bayVorderkante,
  bayRuecken,
  type ContainerConfig,
} from "../src/world/containers";
import { MATERIALS } from "../src/materials/catalog";
import { YARD_MAX_X, YARD_MIN_X, YARD_D } from "../src/world/yard";
import { hitsObstacle } from "../src/world/obstacles";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN, abstandVomStand } from "../src/world/baggerstand";
import {
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  MULDEN_GASSE_X,
  MULDEN_GASSE_Z,
} from "../src/delivery/routes";
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

/** Westschenkel (Oeffnung nach Osten) und Suedschenkel (Oeffnung nach Norden). */
const WEST = LAGER.filter((c) => c.facing === "east");
const SUED = LAGER.filter((c) => c.facing === "north");

describe("Die Reihe steht als L an Westwand und Suedwand (E-028)", () => {
  it("es sind sechs, drei je Schenkel", () => {
    expect(LAGER.length).toBe(6);
    expect(WEST.length, "Westschenkel").toBe(3);
    expect(SUED.length, "Suedschenkel").toBe(3);
    expect(WEST.length + SUED.length, "ein Silo zeigt in keine der beiden Richtungen").toBe(
      LAGER.length
    );
  });

  it("jedes Silo steht mit dem Ruecken an SEINER Platzgrenze", () => {
    /*
     * Gemessen gegen die Wand, an der das Silo steht — nicht gegen eine fest
     * eingetragene. Bis zum 15.09.2026 stand hier `YARD_MAX_X` und damit die
     * Ostwand; nach dem Umzug haette derselbe Test 43,50 m „Leere hinter dem
     * Silo" gemeldet, obwohl das Silo sauber an der Westwand steht.
     */
    for (const c of LAGER) {
      const r = bayRuecken(c);
      const wand = c.facing === "north" ? -YARD_D / 2 : YARD_MIN_X;
      const luft = Math.abs(c.facing === "north" ? r.z - wand : r.x - wand);
      expect(luft, `${c.label}: ${luft.toFixed(2)} m Leere hinter dem Silo`).toBeLessThan(1.5);
      expect(luft, `${c.label}: steht in der Mauer`).toBeGreaterThan(0.3);
    }
  });

  it("jeder Schenkel steht in einer Flucht und hat gleichen Achsabstand", () => {
    for (const [name, leg] of [
      ["West", WEST],
      ["Sued", SUED],
    ] as Array<[string, ContainerConfig[]]>) {
      const quer = leg[0]!.facing === "north" ? "z" : "x";
      const laengs = quer === "z" ? "x" : "z";
      for (const c of leg) {
        expect(c[quer], `${c.label} steht nicht in der ${name}-Flucht`).toBeCloseTo(
          leg[0]![quer],
          6
        );
      }
      const achsen = leg.map((c) => c[laengs]).sort((a, b) => b - a);
      for (let i = 1; i < achsen.length; i++) {
        expect(achsen[i - 1]! - achsen[i]!, `${name}: ungleicher Achsabstand`).toBeCloseTo(4.6, 6);
      }
    }
  });

  it("kein Silo steht in einer Mauer", () => {
    for (const c of LAGER) {
      const { hw, hd } = bayHalb(c);
      // Flankenmass: halbe Laenge plus Steinreihe (0,275 m)
      const fw = c.facing === "north" ? hw + 0.275 : hw;
      const fd = c.facing === "north" ? hd : hd + 0.275;
      expect(c.x - fw, `${c.label} steht in der Westmauer`).toBeGreaterThan(YARD_MIN_X + 0.3);
      expect(c.x + fw, `${c.label} steht in der Ostmauer`).toBeLessThan(YARD_MAX_X - 0.3);
      expect(c.z - fd, `${c.label} steht in der Suedmauer`).toBeGreaterThan(-YARD_D / 2 + 0.3);
      expect(c.z + fd, `${c.label} steht in der Nordmauer`).toBeLessThan(YARD_D / 2 - 0.3);
    }
  });

  it("die beiden Schenkel kommen sich an der Ecke nicht ins Gehege", () => {
    /*
     * Die Ecke ist der heikle Punkt des L. Geprueft wird der Streifen, den
     * die Gasse des Suedschenkels braucht: Sie liegt auf z −17,0, ein LKW ist
     * dort 3,10 m breit, und das unterste Westsilo darf nicht hineinragen.
     */
    const LKW_HALB = 1.55;
    for (const c of WEST) {
      const { hd } = bayHalb(c);
      const suedkante = c.z - hd - 0.275;
      expect(
        suedkante,
        `${c.label} reicht bis z ${suedkante.toFixed(2)} und damit in die Suedgasse`
      ).toBeGreaterThan(MULDEN_GASSE_Z + LKW_HALB);
    }
    for (const c of SUED) {
      const { hw } = bayHalb(c);
      const nordkante = c.z + hw + 0.275;
      expect(nordkante, `${c.label} ragt in die Suedgasse`).toBeLessThan(
        MULDEN_GASSE_Z - LKW_HALB
      );
    }
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
     */
    for (const c of LAGER) {
      expect(imBaggerrevier(c.x, c.z), `${c.label} liegt in Lamberts Sperrgebiet`).toBe(false);
      const [ax, az] = StaffManager.anfahrtZu(c);
      expect(
        imBaggerrevier(ax, az),
        `${c.label}: der Halteplatz (${ax.toFixed(1)}|${az.toFixed(1)}) liegt im Sperrgebiet`
      ).toBe(false);
      // Und er haelt VOR der Oeffnung, nicht darin.
      const v = bayVorderkante(c);
      const o = bayOeffnung(c);
      const davor = (ax - v.x) * o.x + (az - v.z) * o.z;
      expect(davor, `${c.label}: Halteplatz ${davor.toFixed(2)} m vor der Oeffnung`).toBeCloseTo(
        2.2,
        6
      );
    }
  });

  it("die Gasse läuft 5,0 m vor den Öffnungen, nicht in ihnen", () => {
    for (const c of LAGER) {
      const v = bayVorderkante(c);
      const gasse = c.facing === "north" ? MULDEN_GASSE_Z : MULDEN_GASSE_X;
      const eigen = c.facing === "north" ? v.z : v.x;
      const abstand = Math.abs(gasse - eigen);
      expect(abstand, `${c.label}: Gasse ${abstand.toFixed(2)} m vor der Öffnung`).toBeCloseTo(
        5.0,
        6
      );
      const gx = c.facing === "north" ? c.x : MULDEN_GASSE_X;
      const gz = c.facing === "north" ? MULDEN_GASSE_Z : c.z;
      expect(hitsObstacle(gx, gz, 1.4), `${c.label}: Gasse versperrt`).toBeNull();
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
