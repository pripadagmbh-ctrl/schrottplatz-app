import { describe, it, expect } from "vitest";
import { rollCustomer, MINDEST_FUHRE_KG } from "../src/delivery/customers";
import { NUTZLAST, fuellKlasse, ladeVolumen } from "../src/delivery/fuellgrad";

/*
 * Wie voll ein Anlieferer ist.
 *
 * ERSTE FASSUNG (15.09.2026 vormittags, E-030). Befund Patrick am Gerät:
 * „Eigentlich kommen Händler erst, wenn ihre LKWs randvoll sind. … mindestens
 * mal über 600, 700 Kilo Minimum." Daraus wurde eine gewürfelte Untergrenze
 * von 600 kg, die dieser Wächter festhielt.
 *
 * ZWEITE FASSUNG (15.09.2026 nachmittags, E-033). Derselbe Tag, derselbe
 * Mensch, genauere Ansage: „Es ist halt bei Händlern halt auch nicht immer das
 * Gewicht, sondern eher das Volumen auf der Ladefläche."
 *
 * Seitdem wird die Menge nicht mehr gewürfelt, sondern gerechnet:
 *
 *     Masse = Füllgrad × Laderaum × Schüttdichte
 *
 * Damit ist die 600-kg-Grenze KEINE Regel mehr, sondern ein Ergebnis — und
 * sie hält nicht mehr in jedem Fall. Ein viertelvoller PKW-Anhänger
 * (2,40 m³) mit Haushaltsschrott und viel Holz und Kunststoff wiegt
 * rechnerisch rund 300 kg. Das ist richtig so: Der Füllgrad gewinnt
 * (Ansage Patrick 15.09.2026). Gemessen betrifft das rund 4 % aller
 * Anlieferungen, ausschließlich Privatleute mit dem Anhänger.
 *
 * Was bleibt, ist der Kern der Aussage: Wer herfährt, hat sich die Fahrt
 * überlegt. Deshalb bewacht diese Fassung drei Dinge —
 *
 *   1. kein LKW unter 600 kg (die Grenze von heute Vormittag, für alles,
 *      was Händler oder Gewerbe heißt),
 *   2. überhaupt niemand unter der Notbremse `MINDEST_FUHRE_KG`,
 *   3. der leichte Fall bleibt selten und bleibt beim Privatmann.
 */

/** Was Patrick als „Minimum" genannt hat — gilt weiter für jeden LKW. */
const LKW_MINDESTMENGE_KG = 600;
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

  it("jede Fuhre ist eine endliche Zahl — sonst prüft der Rest nichts", () => {
    /*
     * Lehre vom 15.09.2026: Ein Wächter war zwei Stunden grün, weil seine
     * Eingaben NaN waren. Jeder Vergleich mit NaN ist falsch, und die Tests
     * laufen ohne `tsc`.
     */
    for (const k of kunden) {
      expect(Number.isFinite(k.massKg), `${k.name}: massKg ${k.massKg}`).toBe(true);
      expect(Number.isFinite(k.fuellgrad), `${k.name}: fuellgrad ${k.fuellgrad}`).toBe(true);
      expect(Number.isFinite(k.dichte), `${k.name}: dichte ${k.dichte}`).toBe(true);
    }
  });

  it("kein LKW fährt mit weniger als 600 kg vor", () => {
    const lkw = kunden.filter((k) => k.vehicle === "kipper" || k.vehicle === "pritsche");
    expect(lkw.length).toBeGreaterThan(WUERFE / 4);
    const zuLeer = lkw.filter((k) => k.massKg < LKW_MINDESTMENGE_KG);
    const leichtester = Math.min(...lkw.map((k) => k.massKg));
    expect(
      zuLeer.length,
      `${zuLeer.length} von ${lkw.length} LKW unter ${LKW_MINDESTMENGE_KG} kg, leichtester ${leichtester.toFixed(0)} kg`
    ).toBe(0);
  });

  it("niemand fährt unter der Notbremse vor", () => {
    const leichtester = Math.min(...kunden.map((k) => k.massKg));
    expect(leichtester, `leichtester ${leichtester.toFixed(0)} kg`).toBeGreaterThanOrEqual(
      MINDEST_FUHRE_KG
    );
  });

  it("die leichte Fuhre bleibt selten und bleibt beim Privatmann", () => {
    const leicht = kunden.filter((k) => k.massKg < LKW_MINDESTMENGE_KG);
    for (const k of leicht) {
      expect(k.group, `${k.name} mit ${k.massKg} kg`).toBe("privat");
      // und sie ist immer das, was Patrick „selten bis schwierig" nennt:
      // ein Anhänger, der höchstens halb voll ist
      expect(["viertel", "halb"], `${k.name}, Füllgrad ${k.fuellgrad.toFixed(2)}`).toContain(
        fuellKlasse(k.fuellgrad)
      );
    }
    const anteil = leicht.length / WUERFE;
    expect(anteil, `${(100 * anteil).toFixed(1)} % unter ${LKW_MINDESTMENGE_KG} kg`).toBeLessThan(
      0.08
    );
  });

  it("und niemand mit mehr, als auf einen Wagen passt", () => {
    const schwerster = Math.max(...kunden.map((k) => k.massKg));
    expect(schwerster, `schwerster ${schwerster.toFixed(0)} kg`).toBeLessThanOrEqual(
      HOECHSTMENGE_KG
    );
    // schärfer: keiner über der Nutzlast seines eigenen Wagens
    for (const k of kunden) {
      expect(k.massKg, `${k.name} im ${k.vehicle}`).toBeLessThanOrEqual(NUTZLAST[k.vehicle]);
    }
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
     * Privatmann ist das untere Ende dieser Spanne und soll es bleiben — jetzt
     * nicht mehr, weil eine Zahl es anordnet, sondern weil sein Anhänger
     * 2,4 m³ fasst und ein Kipper 14 bis 27.
     */
    const schnitt = (g: string) => {
      const m = kunden.filter((k) => k.group === g).map((k) => k.massKg);
      return m.reduce((a, b) => a + b, 0) / m.length;
    };
    expect(schnitt("privat")).toBeLessThan(schnitt("gewerbe"));
    expect(schnitt("gewerbe")).toBeLessThan(schnitt("haendler"));
    expect(ladeVolumen("pkw")).toBeLessThan(ladeVolumen("kipper", "flach"));
  });

  it("die Menge folgt dem Füllgrad, nicht umgekehrt", () => {
    /*
     * Die Probe aufs Exempel: Zwei Wagen derselben Bauart mit demselben
     * Material — der vollere muss der schwerere sein. Vorher war das reiner
     * Zufall, weil Masse und Ladefläche nichts miteinander zu tun hatten.
     */
    const geladen = kunden.filter((k) => k.vehicle !== "wrack" && k.massKg > MINDEST_FUHRE_KG);
    expect(geladen.length).toBeGreaterThan(WUERFE / 2);
    for (const k of geladen) {
      const gerechnet = ladeVolumen(k.vehicle, k.aufbau) * k.fuellgrad * k.dichte;
      expect(
        Math.abs(k.massKg - gerechnet),
        `${k.name} im ${k.vehicle}/${k.aufbau}: ${k.massKg} kg, gerechnet ${gerechnet.toFixed(0)} kg`
      ).toBeLessThanOrEqual(1);
    }
  });
});
