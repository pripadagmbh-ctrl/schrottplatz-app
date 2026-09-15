import { describe, it, expect } from "vitest";
import { rollCustomer } from "../src/delivery/customers";

/*
 * Wie voll ein Anlieferer ist.
 *
 * Befund Patrick am Gerät, 15.09.2026: „Eigentlich kommen Händler erst, wenn
 * ihre LKWs randvoll sind. … mindestens mal über 600, 700 Kilo Minimum. … Ich
 * sehe ja, dass die zwischen 1 und 10 Tonnen alles haben, aber drunter ist eher
 * selten."
 *
 * Nachgemessen war weder der Händler (2,5–9,0 t) noch das Gewerbe (1,2–6,5 t)
 * das Problem. Es war der Privatmann mit 50 kg — eine Fuhre, für die in der
 * Wirklichkeit niemand losfährt.
 *
 * Dieser Wächter hält die Untergrenze fest. Sie ist kein Balancing-Regler,
 * sondern eine Aussage über die Welt: Wer herfährt, hat sich die Fahrt
 * überlegt.
 */

/** Was Patrick als „Minimum" genannt hat, mit etwas Luft nach unten. */
const MINDESTMENGE_KG = 600;
/** Grösster Wagen aus dem Katalog; darüber wäre die Ladefläche erfunden. */
const HOECHSTMENGE_KG = 10_000;

/**
 * So viele Würfe, dass auch ein seltener Ausreisser auffällt.
 *
 * Privatleute sind 18 % der Anlieferer; bei 4000 Würfen sind das rund 720
 * Stück. Eine Untergrenze, die in einem von hundert Fällen durchbrochen würde,
 * fiele hier sicher auf.
 */
const WUERFE = 4000;

describe("Wie voll ein Anlieferer vorfährt", () => {
  const kunden = Array.from({ length: WUERFE }, () => rollCustomer());

  it("niemand fährt mit weniger als 600 kg vor", () => {
    const zuLeer = kunden.filter((k) => k.massKg < MINDESTMENGE_KG);
    const leichtester = Math.min(...kunden.map((k) => k.massKg));
    expect(
      zuLeer.length,
      `${zuLeer.length} von ${WUERFE} unter ${MINDESTMENGE_KG} kg, leichtester ${leichtester.toFixed(0)} kg`
    ).toBe(0);
  });

  it("und niemand mit mehr, als auf einen Wagen passt", () => {
    const schwerster = Math.max(...kunden.map((k) => k.massKg));
    expect(schwerster, `schwerster ${schwerster.toFixed(0)} kg`).toBeLessThanOrEqual(
      HOECHSTMENGE_KG
    );
  });

  it("alle drei Gruppen kommen vor — sonst prüft der Wächter nur eine", () => {
    /*
     * Ohne diese Prüfung wäre der Test oben auch dann grün, wenn es
     * Privatleute gar nicht mehr gäbe — und genau sie sind der Fall, den er
     * bewacht.
     */
    for (const gruppe of ["privat", "haendler", "gewerbe"] as const) {
      const anzahl = kunden.filter((k) => k.group === gruppe).length;
      expect(anzahl, `Gruppe ${gruppe} kam in ${WUERFE} Würfen nie vor`).toBeGreaterThan(0);
    }
  });

  it("der Privatmann bleibt der kleinste — er soll nicht zum Händler werden", () => {
    /*
     * Die Untergrenze anzuheben ist das eine; die Gruppen einzuebnen wäre das
     * andere. Patrick will Abwechslung: „zwischen 1 und 10 Tonnen alles". Der
     * Privatmann ist das untere Ende dieser Spanne und soll es bleiben.
     */
    const schnitt = (g: string) => {
      const m = kunden.filter((k) => k.group === g).map((k) => k.massKg);
      return m.reduce((a, b) => a + b, 0) / m.length;
    };
    expect(schnitt("privat")).toBeLessThan(schnitt("gewerbe"));
    expect(schnitt("gewerbe")).toBeLessThan(schnitt("haendler"));
  });
});
