/**
 * DIE FUHRE MUSS IN SICH STIMMEN — im Spiel und auf jedem Prüfstand (E-062).
 *
 * WAS HIER BEWACHT WIRD und warum es keine Formsache ist:
 *
 * Am 15.09.2026 haben sich zwei Messgeräte über denselben Vorgang um den
 * Faktor zwei gestritten (`kipper.test.ts` gegen ein Wegwerf-Gerät im
 * Arbeitsbaum `agent-a2b4fd9faf32d7293`). Nachgemessen mit EINEM Laufapparat,
 * bei dem immer nur ein Schalter umgelegt wurde, war die Ursache weder das
 * Messfenster noch der Solver noch die Saaten, sondern die **Fuhre**:
 *
 *     Gerät A (kipper.test.ts)  massKg 5000, Füllgrad daraus gerechnet (0,60)
 *     Gerät B (Wegwerf)         massKg 5000, Füllgrad 0,85, dichte 500
 *
 * B ist in sich falsch. Seit E-033 gilt eine Regel für jede Fuhre:
 *
 *     Masse = Füllgrad × Laderaum × Schüttdichte
 *
 * `vehicles.ts` liest die beiden Zahlen an zwei getrennten Stellen —
 * `c.fuellgrad` bestimmt, wie viele und wie große Brocken auf die Fläche
 * kommen (`buildCargo`, Zielfüllung und Rundengröße), `c.massKg` bestimmt, was
 * jedes einzelne Stück wiegt (Umlegen auf die liegenden Stücke). Laufen die
 * beiden auseinander, packt der Prüfstand einen Wagen 0,85 voll und schreibt
 * die Ladung danach auf 5.000 kg herunter: mehr Stücke, jedes zu leicht. Das
 * ist eine andere Fuhre, kein anderes Messverfahren — und sie kippt anders.
 *
 * `c.dichte` wird von `vehicles.ts` überhaupt nicht gelesen. Genau deshalb ist
 * eine falsche Dichte im Profil still: Sie fällt nirgends auf, macht aber die
 * beiden anderen Zahlen unvereinbar.
 *
 * DER LETZTE TEST IST DIE GEGENPROBE. Ein Wächter, der nie rot werden kann,
 * bewacht nichts — hier wird die gerade gefundene Falschfuhre eingesetzt und
 * verlangt, dass die Prüfung sie auch wirklich meldet.
 */
import { describe, it, expect } from "vitest";
import { rollCustomer, type CustomerProfile } from "../src/delivery/customers";
import { MINDEST_FUHRE_KG } from "../src/delivery/customers";
import { ladeVolumen, NUTZLAST } from "../src/delivery/fuellgrad";
import { ladungsDichte } from "../src/materials/schuettdichte";
import { pruefKunde, fuhrenAbweichung, erwarteteDichte, PRUEF_STOER } from "./pruefkunde";
import { AUSSEHEN_NEUTRAL } from "../src/delivery/aussehen";

/**
 * Wie weit darf es auseinanderliegen? Ein Prozent.
 *
 * `baueFuhre` rundet die Masse auf ganze Kilogramm; bei der kleinsten Fuhre
 * (300 kg) sind das 0,17 %. Alles darüber ist kein Rundungsfehler, sondern
 * eine erfundene Zahl.
 */
const TOLERANZ = 0.01;

describe("Kundenprofil: die Fuhre stimmt in sich", () => {
  it("der Prüfstand-Kunde erfüllt die Regel, egal ob Masse oder Füllgrad vorgegeben ist", () => {
    const nachMasse = pruefKunde({ massKg: 5000 });
    const nachFuellung = pruefKunde({ fuellgrad: 0.85 });
    expect(fuhrenAbweichung(nachMasse), "Masse vorgegeben").toBeLessThan(TOLERANZ);
    expect(fuhrenAbweichung(nachFuellung), "Fuellgrad vorgegeben").toBeLessThan(TOLERANZ);
    /*
     * Und die beiden Wege müssen sich treffen: Der Füllgrad, den der eine aus
     * 5.000 kg rechnet, muss beim anderen wieder 5.000 kg ergeben.
     */
    const zurueck = pruefKunde({ fuellgrad: nachMasse.fuellgrad });
    expect(zurueck.massKg, "Hin- und Rueckrechnung").toBeCloseTo(nachMasse.massKg, 0);
  });

  it("die Dichte im Profil ist die des Materials, keine gegriffene Zahl", () => {
    /*
     * `dichte: 500` stand in vier Prüfständen und gehört zu keinem Material:
     * Mischschrott mit 6 % Störstoff sind 594,65 kg/m³, Alu 253,5, Messing
     * 1327,7. Eine Zahl ohne Herkunft (Projektregel 3).
     */
    for (const rein of [null, "alu", "brass", "steel"]) {
      const c = pruefKunde({ sortenrein: rein, fuellgrad: 0.8 });
      expect(c.dichte, `Dichte fuer ${rein ?? "misch"}`).toBeCloseTo(
        ladungsDichte(rein, PRUEF_STOER),
        6
      );
      expect(c.dichte).not.toBe(500);
    }
  });

  it("beide Zahlen zusammen anzugeben wird abgelehnt statt still hingenommen", () => {
    // Der Fehler, der zur Doppelmessung geführt hat, lässt sich hier gar nicht
    // mehr formulieren.
    expect(() => pruefKunde({ massKg: 5000, fuellgrad: 0.85 })).toThrow(/genau eine/);
  });

  it("jede gewürfelte Kundschaft des Spiels erfüllt dieselbe Regel", () => {
    /*
     * Das ist der eigentliche Wächter: Nicht der Prüfstand muss stimmen,
     * sondern `customers.rollCustomer()` — und zwar über alle drei Gruppen,
     * alle Fahrzeuge und alle Aufbauten hinweg. 400 Würfe treffen jede
     * Kombination mehrfach (Wrack 4 %, PKW 15 %, Koffer 15 % der Händler).
     */
    const abweichler: string[] = [];
    const gesehen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const c = rollCustomer();
      gesehen.add(`${c.group}/${c.vehicle}/${c.aufbau}`);
      expect(Number.isFinite(c.massKg), `massKg NaN bei ${c.vehicle}`).toBe(true);
      expect(Number.isFinite(c.fuellgrad), `fuellgrad NaN bei ${c.vehicle}`).toBe(true);
      expect(Number.isFinite(c.dichte), `dichte NaN bei ${c.vehicle}`).toBe(true);
      expect(c.dichte, `Dichte passt nicht zum Material (${c.sortedMaterial})`).toBeCloseTo(
        erwarteteDichte(c),
        6
      );
      /*
       * Ausnahme mit Namen: `customers.fuhreFuer` hebt jede Fuhre auf
       * MINDEST_FUHRE_KG an. Darunter DARF die Regel verletzt sein — für
       * 40 kg Kunststoff auf dem Anhänger fährt niemand los. Oberhalb nicht.
       */
      const erwartet = c.fuellgrad * ladeVolumen(c.vehicle, c.aufbau) * c.dichte;
      if (c.vehicle !== "wrack" && erwartet >= MINDEST_FUHRE_KG) {
        const ab = fuhrenAbweichung(c);
        if (ab >= TOLERANZ) {
          abweichler.push(
            `${c.group}/${c.vehicle}/${c.aufbau}: ${c.massKg} kg, erwartet ` +
              `${erwartet.toFixed(0)} kg (Fuellgrad ${c.fuellgrad.toFixed(2)}, ` +
              `Dichte ${c.dichte.toFixed(0)})`
          );
        }
      }
    }
    expect(gesehen.size, "zu wenig Kombinationen gesehen").toBeGreaterThan(5);
    expect(abweichler, abweichler.slice(0, 5).join(" | ")).toHaveLength(0);
  });

  it("die Nutzlastgrenze rechnet den Füllgrad herunter, statt die Masse zu kappen", () => {
    /*
     * Der Fall, in dem die Regel am leichtesten bräche: schweres Material,
     * randvoll. Messing im Kipper wären 0,95 × 14,08 m³ × 1327,7 kg/m³ =
     * 17,8 t — der Wagen trägt 9,5 t. `baueFuhre` senkt dann den Füllgrad,
     * damit das, was man sieht, und das, was die Waage sagt, dasselbe bleiben.
     */
    const c = pruefKunde({ sortenrein: "brass", fuellgrad: 0.95 });
    // pruefKunde rechnet ohne Nutzlastdeckel — die Rohmasse zeigt, worum es geht
    expect(c.massKg, "Messing randvoll waere ueber der Nutzlast").toBeGreaterThan(
      NUTZLAST.kipper
    );
    expect(fuhrenAbweichung(c), "trotzdem in sich stimmig").toBeLessThan(TOLERANZ);
  });

  it("GEGENPROBE: die Prüfung meldet die Falschfuhre, die den Streit ausgelöst hat", () => {
    /*
     * Ohne diesen Test wüsste niemand, ob `fuhrenAbweichung` überhaupt etwas
     * merkt. Hier steht das Profil des verworfenen Messgeräts Zeichen für
     * Zeichen, wie es dort stand.
     */
    const falsch: CustomerProfile = {
      group: "haendler",
      name: "Pruefstand",
      subtitle: "Test",
      massKg: 5000,
      vehicle: "kipper",
      aufbau: "flach",
      fuellgrad: 0.85,
      dichte: 500,
      sortedMaterial: null,
      contaminantShare: 0.06,
      hardness: 1,
      greeting: "",
      // Das Aussehen ist hier belanglos; die Fuhre ist der Gegenstand.
      aussehen: AUSSEHEN_NEUTRAL,
    };
    const ab = fuhrenAbweichung(falsch);
    expect(ab, `Abweichung ${(ab * 100).toFixed(0)} %`).toBeGreaterThan(0.15);
    // und die Dichte gehört zu keinem Material
    expect(Math.abs(falsch.dichte - erwarteteDichte(falsch))).toBeGreaterThan(50);
    /*
     * Was das in Metern und Kilogramm heißt: Bei 0,85 Füllgrad wiegt dieselbe
     * Fuhre 7.118 kg statt 5.000 — 42 % mehr, verteilt auf dieselbe Stückzahl.
     */
    const richtig = pruefKunde({ fuellgrad: 0.85 });
    expect(richtig.massKg).toBeGreaterThan(7000);
    expect(richtig.massKg).toBeLessThan(7250);
  });
});
