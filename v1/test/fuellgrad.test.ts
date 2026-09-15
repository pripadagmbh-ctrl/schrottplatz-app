import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANHAENGER_HALB_BREITE,
  ANHAENGER_WAND,
  BED_LEN,
  FUELL_KLASSEN,
  FUELL_REIHE,
  LADE_RAND,
  LADUNG_UEBERSTAND,
  LKW_HALB_BREITE,
  NUTZLAST,
  WAND_HOEHE,
  baueFuhre,
  fuellKlasse,
  ladeVolumen,
  rollAufbau,
  rollFuellgrad,
  type FuellKlasse,
} from "../src/delivery/fuellgrad";
import { wandHoehe } from "../src/delivery/vehicleModel";
import { BED_HALF_W, bedLenFor } from "../src/delivery/routes";
import { ladungsDichte, schuettdichte } from "../src/materials/schuettdichte";

/**
 * Wie voll ein Wagen ankommt (Ansage Patrick 15.09.2026).
 *
 *   „Es ist halt bei Händlern halt auch nicht immer das Gewicht, sondern eher
 *    das Volumen auf der Ladefläche. … Halb voll, mittelvoll, dreiviertel
 *    voll, voll voll. Aber so ein Viertel voll ist schon eher selten bis
 *    schwierig."
 *
 * Bewacht werden drei Dinge: die Verteilung der Füllgrade, die Herkunft der
 * Maße (sie stammen aus dem Fahrzeugmodell, nicht aus der Luft) und die
 * Rechenkette Füllgrad → Volumen → Masse.
 *
 * WARNUNG aus dem Log (15.09.2026): Ein Wächter war zwei Stunden grün, weil
 * seine Eingaben `NaN` waren — jeder Vergleich mit NaN ist falsch, und die
 * Tests laufen ohne `tsc`. Deshalb prüft der erste Block hier, dass überhaupt
 * Zahlen herauskommen.
 */

const WUERFE = 20000;

describe("Füllgrad: es kommen Zahlen heraus", () => {
  it("jeder Wurf ist eine endliche Zahl zwischen 0 und 1", () => {
    for (const gruppe of ["privat", "haendler", "gewerbe"] as const) {
      for (let i = 0; i < 500; i++) {
        const f = rollFuellgrad(gruppe);
        expect(Number.isFinite(f), `${gruppe}: ${f}`).toBe(true);
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });

  it("jedes Ladevolumen und jede Nutzlast ist eine endliche Zahl über null", () => {
    for (const kind of ["kipper", "pritsche", "pkw", "wrack"] as const) {
      for (const aufbau of ["flach", "rungen", "koffer"] as const) {
        const v = ladeVolumen(kind, aufbau);
        expect(Number.isFinite(v), `${kind}/${aufbau}: ${v}`).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
      expect(Number.isFinite(NUTZLAST[kind])).toBe(true);
      expect(NUTZLAST[kind]).toBeGreaterThan(0);
    }
  });
});

describe("Verteilung der Füllgrade", () => {
  const anteile = (gruppe: "privat" | "haendler" | "gewerbe"): Record<FuellKlasse, number> => {
    const zaehler: Record<string, number> = {};
    for (let i = 0; i < WUERFE; i++) {
      const k = fuellKlasse(rollFuellgrad(gruppe));
      zaehler[k] = (zaehler[k] ?? 0) + 1;
    }
    return Object.fromEntries(
      FUELL_REIHE.map((k) => [k, (zaehler[k] ?? 0) / WUERFE])
    ) as Record<FuellKlasse, number>;
  };

  it("der volle Wagen ist der Normalfall — bei jeder Gruppe zusammen mit dreiviertel über der Hälfte", () => {
    for (const gruppe of ["privat", "haendler", "gewerbe"] as const) {
      const a = anteile(gruppe);
      expect(
        a.dreiviertel + a.randvoll,
        `${gruppe}: dreiviertel ${(100 * a.dreiviertel).toFixed(1)} % + randvoll ${(100 * a.randvoll).toFixed(1)} %`
      ).toBeGreaterThan(0.5);
    }
  });

  it("der Händler kommt am häufigsten randvoll — „erst, wenn ihre LKWs randvoll sind“", () => {
    const h = anteile("haendler");
    const g = anteile("gewerbe");
    const p = anteile("privat");
    expect(h.randvoll).toBeGreaterThan(g.randvoll);
    expect(g.randvoll).toBeGreaterThan(p.randvoll);
    // und bei ihm ist der volle Wagen häufiger als alles andere zusammen
    expect(h.randvoll).toBeGreaterThan(0.5);
  });

  it("ein Viertel voll ist selten — aber es kommt vor", () => {
    /*
     * „Aber so ein Viertel voll ist schon eher selten bis schwierig." Das ist
     * kein Verbot. Wer die Klasse ganz ausschließt, macht aus dem Zufall eine
     * Regel; wer sie zu oft würfelt, macht aus dem Schrottplatz einen
     * Taubenschlag.
     */
    for (const gruppe of ["privat", "haendler", "gewerbe"] as const) {
      const a = anteile(gruppe);
      expect(a.viertel, `${gruppe}: viertel ${(100 * a.viertel).toFixed(2)} %`).toBeGreaterThan(0);
      expect(a.viertel, `${gruppe}: viertel ${(100 * a.viertel).toFixed(2)} %`).toBeLessThan(0.15);
    }
    // Über alle Anlieferer (18 % privat, 60 % Händler, 22 % Gewerbe):
    const p = anteile("privat");
    const h = anteile("haendler");
    const g = anteile("gewerbe");
    const gesamt = 0.18 * p.viertel + 0.6 * h.viertel + 0.22 * g.viertel;
    expect(gesamt, `viertel gesamt ${(100 * gesamt).toFixed(2)} %`).toBeGreaterThan(0.005);
    expect(gesamt, `viertel gesamt ${(100 * gesamt).toFixed(2)} %`).toBeLessThan(0.06);
  });

  it("die vier Klassen decken lückenlos von einem Viertel bis randvoll", () => {
    expect(FUELL_KLASSEN.viertel.bis).toBe(FUELL_KLASSEN.halb.von);
    expect(FUELL_KLASSEN.halb.bis).toBe(FUELL_KLASSEN.dreiviertel.von);
    expect(FUELL_KLASSEN.dreiviertel.bis).toBe(FUELL_KLASSEN.randvoll.von);
    expect(FUELL_KLASSEN.randvoll.bis).toBe(1);
    // und keine Fuhre fällt unter die unterste Klasse
    for (let i = 0; i < 2000; i++) {
      expect(rollFuellgrad("privat")).toBeGreaterThanOrEqual(FUELL_KLASSEN.viertel.von);
    }
  });
});

/**
 * Die Maße stammen aus dem Fahrzeug, nicht aus der Luft. `fuellgrad.ts`
 * spiegelt sie, damit `customers.ts` nicht three.js und Rapier mitziehen muss —
 * und dieser Block hält beide Fassungen zusammen. Läuft eine auseinander, ist
 * das Volumen erfunden.
 */
describe("Herkunft der Ladeflächenmaße", () => {
  const quelle = (datei: string): string =>
    readFileSync(resolve(__dirname, "..", "src", "delivery", datei), "utf8");

  it("die Bordwandhöhen sind die aus `vehicleModel.wandHoehe`", () => {
    for (const aufbau of ["flach", "rungen", "koffer"] as const) {
      expect(WAND_HOEHE[aufbau], aufbau).toBe(wandHoehe("kipper", aufbau));
    }
  });

  it("die halbe Innenbreite folgt `routes.BED_HALF_W` minus Wandstärke", () => {
    expect(LKW_HALB_BREITE).toBeCloseTo(BED_HALF_W - 0.08, 10);
    // und `vehicles.ts` rechnet genauso
    expect(quelle("vehicles.ts")).toContain("BED_HALF_W - 0.08");
  });

  it("der PKW-Anhänger wird mit seinen eigenen Maßen gepackt, nicht mit LKW-Maßen", () => {
    /*
     * BEFUND 15.09.2026. `fuellgrad.ts` rechnete das Volumen des Anhängers
     * längst richtig (1,74 m breit, 0,34 m Bordwand), `vehicles.ts` packte ihn
     * aber weiter wie einen LKW: 2,54 m breit und bis 0,99 m hoch. Der
     * Unterschied ist kein Detail — der LKW-Laderaum ist 2,1-mal so groß:
     *
     *   Anhänger  1,74 × 2,00 × 0,69 =  2,40 m³
     *   LKW-Maße  2,54 × 2,00 × 0,99 =  5,03 m³
     *
     * Ein „voller" Anhänger bekam damit doppelt so viel Schrott zugeteilt, wie
     * auf ihn passt, und die Hälfte stand neben ihm in der Luft.
     *
     * Bewacht wird, dass es keine zweite Zahlenreihe gibt: `vehicles.ts` liest
     * die Anhängermaße aus dieser Datei.
     */
    const v = quelle("vehicles.ts");
    expect(v, "vehicles.ts kennt die Anhängerbreite nicht").toContain("ANHAENGER_HALB_BREITE");
    expect(v, "vehicles.ts kennt die Anhänger-Bordwand nicht").toContain("ANHAENGER_WAND");
    // und die Maße hier stammen aus dem Modell (buildCarAndTrailer)
    expect(ANHAENGER_HALB_BREITE).toBeCloseTo(0.9 - 0.03, 10);
    expect(ANHAENGER_WAND).toBeCloseTo(0.34, 10);
    // Der Anhänger fasst deutlich weniger als eine Pritsche gleicher Länge
    expect(ladeVolumen("pkw")).toBeLessThan(ladeVolumen("pritsche") * 0.5);
  });

  it("die Ladeflächenlängen kommen aus der gemeinsamen Quelle, nicht aus einer Abschrift", () => {
    /*
     * Bis zum Zusammenführen am 15.09.2026 las dieser Test die Zeile
     * `this.bedLen = kind === "pkw" ? …` aus `vehicles.ts` und verglich sie mit
     * einer Tabelle hier. Das war richtig gedacht und trotzdem die falsche
     * Prüfung: Zwei Pakete desselben Tages haben dieselbe Zahlenreihe angelegt
     * — dieses als Abschrift, das Kipper-Paket (E-029) als **gemeinsame
     * Quelle** in `routes.ts`, die seither auch `vehicles.ts` liest.
     *
     * Der Test wurde beim Zusammenführen rot, und das war die richtige
     * Meldung. Bewacht wird jetzt nicht mehr, dass zwei Abschriften
     * übereinstimmen, sondern dass es **keine zweite Abschrift gibt**.
     */
    for (const kind of ["pkw", "wrack", "kipper", "pritsche"] as const) {
      expect(BED_LEN[kind], kind).toBe(bedLenFor(kind));
    }
    // Und in vehicles.ts steht keine eigene Zahlenreihe mehr.
    expect(quelle("vehicles.ts")).not.toMatch(/this\.bedLen\s*=\s*kind === "pkw" \?/);
    expect(quelle("vehicles.ts")).toContain("bedLenFor");
  });

  it("Rand und Überstand sind die aus `vehicles.ts`", () => {
    const text = quelle("vehicles.ts");
    expect(text).toContain(`const LADUNG_UEBERSTAND = ${LADUNG_UEBERSTAND};`);
    expect(text).toContain(`const LADE_RAND = ${LADE_RAND};`);
  });

  it("der Aufbau wird gewürfelt wie in `vehicles.ts` — Händler Rungen, Koffer oder flach", () => {
    expect(quelle("vehicles.ts")).toContain('["rungen", "rungen", "koffer", "flach"]');
    for (const gruppe of ["privat", "gewerbe"] as const) {
      for (let i = 0; i < 200; i++) expect(rollAufbau(gruppe)).toBe("flach");
    }
    const gezogen = new Set(Array.from({ length: 400 }, () => rollAufbau("haendler")));
    expect([...gezogen].sort()).toEqual(["flach", "koffer", "rungen"]);
  });

  it("der PKW-Anhänger ist schmaler und flacher als jeder LKW", () => {
    // Boden 1,86 m breit, Bordwände 0,06 m bei x = ±0,90, Wandhöhe 0,34 m
    const modell = quelle("vehicleModel.ts");
    expect(modell).toContain("new THREE.BoxGeometry(1.86, 0.08, v.bedLen)");
    expect(modell).toContain("new THREE.BoxGeometry(bw, 0.34, bd)");
    expect(ladeVolumen("pkw")).toBeLessThan(ladeVolumen("pritsche") / 4);
  });

  it("die Laderäume stimmen mit der Rechnung überein", () => {
    // Kipper flach: 2,54 m breit × 5,60 m nutzbar × (0,64 + 0,35) m hoch
    expect(ladeVolumen("kipper", "flach")).toBeCloseTo(2.54 * 5.6 * 0.99, 6);
    expect(ladeVolumen("kipper", "koffer")).toBeCloseTo(2.54 * 5.6 * 1.9, 6);
    expect(ladeVolumen("pritsche", "flach")).toBeCloseTo(2.54 * 5.0 * 0.99, 6);
    expect(ladeVolumen("pkw")).toBeCloseTo(1.74 * 2.0 * 0.69, 6);
    // Ein Wagen mit Rungen fasst mehr als derselbe mit flacher Bordwand
    expect(ladeVolumen("kipper", "rungen")).toBeGreaterThan(ladeVolumen("kipper", "flach"));
    expect(ladeVolumen("kipper", "koffer")).toBeGreaterThan(ladeVolumen("kipper", "rungen"));
  });
});

describe("Aus Füllgrad wird Masse", () => {
  it("Masse = Füllgrad × Laderaum × Schüttdichte, auf das Kilo", () => {
    const f = baueFuhre({
      kind: "pritsche",
      aufbau: "flach",
      fuellgrad: 0.5,
      hauptfraktion: "alu",
      stoerstoffAnteil: 0,
    });
    expect(f.nutzlastBegrenzt).toBe(false);
    expect(f.massKg).toBe(Math.round(ladeVolumen("pritsche", "flach") * 0.5 * schuettdichte("alu")));
  });

  it("gleicher Füllgrad, anderes Material — das ist der ganze Punkt", () => {
    const gleich = { kind: "pritsche", aufbau: "flach", fuellgrad: 0.6, stoerstoffAnteil: 0 } as const;
    const alu = baueFuhre({ ...gleich, hauptfraktion: "alu" });
    const stahl = baueFuhre({ ...gleich, hauptfraktion: "steel" });
    expect(alu.fuellgrad).toBeCloseTo(stahl.fuellgrad, 10);
    // Dieselbe halbe Pritsche wiegt mit Stahl das Dreifache
    expect(stahl.massKg / alu.massKg).toBeGreaterThan(2.5);
  });

  it("Störstoff frisst Volumen und wiegt nichts — die Fuhre sieht voller aus, als sie wiegt", () => {
    const sauber = baueFuhre({
      kind: "pritsche",
      fuellgrad: 0.8,
      hauptfraktion: "steel",
      stoerstoffAnteil: 0,
    });
    const dreckig = baueFuhre({
      kind: "pritsche",
      fuellgrad: 0.8,
      hauptfraktion: "steel",
      stoerstoffAnteil: 0.35,
    });
    expect(dreckig.fuellgrad).toBeCloseTo(sauber.fuellgrad, 10);
    expect(dreckig.massKg).toBeLessThan(sauber.massKg * 0.8);
  });

  it("geht die Nutzlast vor dem Platz aus, sinkt der Füllgrad — nicht nur die Zahl auf der Waage", () => {
    /*
     * Eine Fuhre Messingarmaturen ist der Fall, den Patrick beschreibt: Der
     * Fahrer hört auf zu laden, wenn die Waage es sagt, und dann liegt die
     * Ladung als flacher Fleck auf dem Boden der Pritsche. Was man sieht und
     * was gewogen wird, muss dasselbe bleiben.
     */
    const f = baueFuhre({
      kind: "kipper",
      aufbau: "koffer",
      fuellgrad: 1,
      hauptfraktion: "brass",
      stoerstoffAnteil: 0,
    });
    expect(f.nutzlastBegrenzt).toBe(true);
    expect(f.massKg).toBe(NUTZLAST.kipper);
    expect(f.fuellgrad).toBeLessThan(0.4);
    // und der gesunkene Füllgrad trägt genau diese Masse
    expect(f.volumen * f.fuellgrad * f.dichte).toBeCloseTo(NUTZLAST.kipper, 6);
  });

  it("kein Wagen überschreitet seine Nutzlast, egal wie schwer das Material ist", () => {
    for (const kind of ["kipper", "pritsche", "pkw"] as const) {
      for (const mat of ["battery", "brass", "copper", "steel", "mixed"]) {
        const f = baueFuhre({
          kind,
          aufbau: "koffer",
          fuellgrad: 1,
          hauptfraktion: mat,
          stoerstoffAnteil: 0,
        });
        expect(f.massKg, `${kind}/${mat}`).toBeLessThanOrEqual(NUTZLAST[kind]);
      }
    }
  });

  it("das Wrack wiegt, was der Abschleppwagen mitbringt — keine Schüttung", () => {
    const f = baueFuhre({
      kind: "wrack",
      fuellgrad: 0.3,
      hauptfraktion: null,
      stoerstoffAnteil: 0.2,
    });
    // 950 kg ist die Zahl, mit der `vehicles.cargoMassKg` das Wrack wiegt
    expect(f.massKg).toBe(950);
    expect(readFileSync(resolve(__dirname, "..", "src", "delivery", "vehicles.ts"), "utf8")).toContain(
      "sum += 950"
    );
  });

  it("die Dichte einer Mischung liegt zwischen ihren Bestandteilen", () => {
    const rein = ladungsDichte("steel", 0);
    const halb = ladungsDichte("steel", 0.5);
    const voll = ladungsDichte("steel", 1);
    expect(halb).toBeLessThan(rein);
    expect(halb).toBeGreaterThan(voll);
  });
});
