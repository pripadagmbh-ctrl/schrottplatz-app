/**
 * Die zwei Blätter vom 15.09.2026 abends — und was sie behaupten.
 *
 * Patrick, 15.09.2026: „Also, wir sind uns doch einig, dass die Zacken direkt
 * an der Traverse sein sollen. Und das ist aktuell nicht der Fall. Deshalb
 * weiss ich überhaupt nicht, woran der Agent gearbeitet hat."
 *
 * Darauf sind zwei Blätter entstanden:
 *   docs/f5-zahn-vorher-nachher-2026-09-15.svg  — was E-069 wirklich gebaut hat
 *   docs/f5-mittelsaeule-2026-09-15.svg         — was es kostet, die Säule
 *                                                 wegzunehmen (gerechnet)
 *
 * Ein Blatt, das niemand nachprüft, ist eine Behauptung. Dieser Wächter hält
 * seine load-bearing Zahlen gegen die gebaute Form — und JEDE Zahlenschranke
 * hier hat eine Gegenprobe, die melden MUSS. Wer `teile.ts` ändert, ohne die
 * Blätter neu zu ziehen, wird hier rot.
 */
import { describe, expect, it } from "vitest";
import {
  MASS,
  OFFEN,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZYLINDER_AUFNAHME,
  zahnAnstellung,
} from "../src/fuenfschalen/teile";
import { FORMEN, baue, zahnspitze } from "../tools/fuenfschalen/zahnformen";
import {
  SAEULE_HEUTE,
  SAEULENROHR,
  anlenkungAus,
  anlenkungBei,
  kopfHerunter,
  korbmass,
  probe,
} from "../tools/fuenfschalen/saeulenrechnung";

/** Länge des Zylinderrohrs (m) — dieselbe Ableitung wie in `rig.stelleSchale`. */
const ROHR = MASS.zylinder.laenge * 0.6;

const GRAD = 180 / Math.PI;

describe("Blatt 1 — der Zahn, vorher gegen nachher (E-069)", () => {
  it("vergleicht die zwei Formen, um die es geht", () => {
    /* A ist der Stand bis 15.09. mittags, B der gebaute. C gehört nicht aufs Blatt. */
    expect(FORMEN[0]!.anstellung * GRAD).toBeCloseTo(-12.15, 2);
    expect(FORMEN[1]!.anstellung).toBe(0);
    /* Und B IST der gebaute Stand: `zahnAnstellung` liefert am Anschlag null. */
    expect(zahnAnstellung(OFFEN)).toBeCloseTo(0, 12);
  });

  it("bewegt die Zahnspitze um 41 mm — nicht mehr, nicht weniger", () => {
    /*
     * Das ist die ehrliche Zahl des Blattes. Sie ist KLEIN, und genau deshalb
     * steht sie dort: Patricks Verdacht war, es sei gar nichts gebaut worden.
     * 41 mm sind etwas — aber am 3,2-m-Greifer sieht man sie kaum.
     */
    const a = baue(FORMEN[0]!);
    const b = baue(FORMEN[1]!);
    for (const t of [0, 1]) {
      const weg = zahnspitze(a, t).distanceTo(zahnspitze(b, t));
      expect(weg, `Öffnung ${t}`).toBeGreaterThan(0.035);
      expect(weg, `Öffnung ${t}`).toBeLessThan(0.047);
    }
    /*
     * GEGENPROBE: Dieselbe Form gegen sich selbst muss NULL ergeben. Ohne sie
     * misst der Wächter womöglich nur das Rauschen zweier Neubauten.
     */
    const c = baue(FORMEN[1]!);
    expect(zahnspitze(b, 1).distanceTo(zahnspitze(c, 1))).toBeLessThan(1e-12);
  });
});

describe("Blatt 2 — die Mittelsäule, gerechnet und nicht gebaut", () => {
  it("steht unverändert: 66,9 cm zwischen Traverse und Schalenbolzen", () => {
    /*
     * Der eigentliche Einwand von Patrick. Solange diese Zahl hier steht, ist
     * die Säule NICHT weggebaut — und das Blatt sagt genau das.
     */
    expect(SAEULE_HEUTE).toBeCloseTo(0.6685, 9);
    expect(TRAVERSE_Y - STEMPEL_AUGE.y).toBeCloseTo(SAEULE_HEUTE, 12);
    /* 26 cm davon sind der Stempelkörper, der Rest das Säulenrohr `09_SAEULE`. */
    expect(SAEULENROHR).toBeCloseTo(SAEULE_HEUTE - MASS.stempel.hoehe, 12);
    expect(SAEULENROHR).toBeCloseTo(0.4085, 9);
  });

  it("rechnet die Anlenkung wie rig.ts — und die Prüfung ist nicht blind", () => {
    const p = probe();
    expect(p.fehler, "die Kopie trifft rig.ts nicht mehr").toBeLessThan(1e-12);
    /*
     * GEGENPROBE: Ein um 1 mm verschobener Bolzen muss sich im Hebelarm
     * niederschlagen. Wäre das null, prüfte der Test oben nichts.
     */
    expect(p.gegenprobe, "die Rechnung reagiert gar nicht auf die Bolzenhöhe").toBeGreaterThan(1e-6);
  });

  it("hält heute beide Wächter von E-039 — und reisst, sobald der Bolzen steigt", () => {
    const heute = anlenkungBei(STEMPEL_AUGE.y);
    expect(heute.neigungMax, "Neigung heute").toBeLessThan(25);
    expect(heute.hebelMin, "Hebelarm heute").toBeGreaterThan(0.115);
    /*
     * GEGENPROBE, und sie ist der ganze Befund des Blattes: An der Traverse
     * steht der Zylinder quer (fast 90°) und ist offen kürzer als sein eigenes
     * Rohr. Meldet dieser Block nicht, ist die Rechnung kaputt.
     */
    const oben = anlenkungBei(TRAVERSE_Y);
    expect(oben.neigungMax, "an der Traverse müsste die Neigung reissen").toBeGreaterThan(25);
    expect(oben.neigungMax).toBeGreaterThan(85);
    const rohr = MASS.zylinder.laenge * 0.6;
    expect(oben.laengeOffen, "der Zylinder wäre kürzer als sein Rohr").toBeLessThan(rohr);
  });

  it("lässt den Bolzen nur rund 2 cm steigen, bevor der erste Wächter reisst", () => {
    let letzterOk = 0;
    for (let i = 0; i <= 1000; i++) {
      const hoch = (SAEULE_HEUTE * i) / 1000;
      const a = anlenkungBei(STEMPEL_AUGE.y + hoch);
      if (a.neigungMax < 25 && a.hebelMin > 0.115) letzterOk = hoch;
      else break;
    }
    expect(letzterOk).toBeGreaterThan(0.015);
    expect(letzterOk).toBeLessThan(0.030);
  });

  it("nimmt dem Korb nichts — er hängt am Bolzen und geht mit", () => {
    /*
     * 20 Stützstellen statt 200: Der Wächter prüft die GLEICHHEIT zweier
     * Messungen, und dafür genügt dasselbe Raster auf beiden Seiten. Die
     * absoluten Zahlen des Blattes stehen im Werkzeug.
     */
    const heute = korbmass(0, 20);
    const ohne = korbmass(SAEULE_HEUTE, 20);
    expect(ohne.tiefeZu).toBeCloseTo(heute.tiefeZu, 9);
    expect(ohne.maxTiefe).toBeCloseTo(heute.maxTiefe, 9);
    expect(ohne.schwebt).toBeCloseTo(heute.schwebt, 9);
    expect(ohne.maul).toBeCloseTo(heute.maul, 9);
    expect(ohne.huellkreis).toBeCloseTo(heute.huellkreis, 9);
    /*
     * GEGENPROBE: Hätte das Heben gar nicht gewirkt, wären die fünf Zeilen
     * darüber trivial gleich. Die Welthöhe MUSS sich um genau die Säule ändern.
     */
    expect(heute.tiefeWelt - ohne.tiefeWelt).toBeCloseTo(SAEULE_HEUTE, 9);
  });
});

describe("Blatt 3 — die Anlenkung: passt der Zylinder? (E-073)", () => {
  /*
   * Patrick, 15.09.2026: „Ich bräuchte schon irgendwie ne Zeichnung, ob das
   * passt." Das Blatt `docs/f5-anlenkung-2026-09-15.svg` zeigt drei Wege. Hier
   * steht, was es behauptet.
   */
  const HEUTE = anlenkungAus(ZYLINDER_AUFNAHME.y, STEMPEL_AUGE.y);
  const BOLZEN_HOCH = anlenkungAus(ZYLINDER_AUFNAHME.y, TRAVERSE_Y);
  const TRAVERSE_RUNTER = anlenkungAus(ZYLINDER_AUFNAHME.y - SAEULE_HEUTE, STEMPEL_AUGE.y);

  it("kennt nur den Abstand — Bolzen hinauf und Traverse herunter sind dieselbe Rechnung", () => {
    /*
     * Der Kern des Blattes, und keine Behauptung, sondern eine Identität: In
     * `hebelarm` und `zylinderLaenge` stehen ausschliesslich DIFFERENZEN von
     * Aufnahme und Bolzen. Wer den Abstand um denselben Betrag schliesst,
     * bekommt dieselbe Anlenkung — egal, welches der beiden Teile wandert.
     *
     * NICHT bitgenau, und das ist ehrlich so aufgeschrieben: Die beiden Wege
     * addieren dieselben Zahlen in anderer Reihenfolge, und das letzte Bit
     * einer Fliesskommazahl haengt daran. Gemessen sind 5,6e−17 m bei den
     * Laengen und 2,8e−14 Grad beim Winkel — unvorstellbar wenig, aber nicht
     * null, und ein `toBe` waere an dieser Stelle eine Luege.
     */
    expect(TRAVERSE_RUNTER.laengeZu).toBeCloseTo(BOLZEN_HOCH.laengeZu, 12);
    expect(TRAVERSE_RUNTER.laengeOffen).toBeCloseTo(BOLZEN_HOCH.laengeOffen, 12);
    expect(TRAVERSE_RUNTER.neigungMax).toBeCloseTo(BOLZEN_HOCH.neigungMax, 12);
    expect(TRAVERSE_RUNTER.hebelMin).toBeCloseTo(BOLZEN_HOCH.hebelMin, 12);
    /*
     * GEGENPROBE: Ein anderer Abstand muss ein anderes Ergebnis geben. Ohne
     * sie bewiese der Block oben nur, dass die Funktion konstant ist.
     */
    const halb = anlenkungAus(ZYLINDER_AUFNAHME.y, STEMPEL_AUGE.y + SAEULE_HEUTE / 2);
    expect(halb.laengeOffen).not.toBeCloseTo(BOLZEN_HOCH.laengeOffen, 3);
  });

  it("zeigt, dass die Stange nur heute in ihr Rohr passt", () => {
    /* Das Rohr ist fest; der Augenabstand offen ist die Probe. */
    expect(ROHR).toBeCloseTo(0.42, 9);
    expect(HEUTE.laengeOffen, "heute schaut die Stange heraus").toBeGreaterThan(ROHR);
    /*
     * GEGENPROBE und Befund in einem: Bei beiden Umbauten läge das Auge der
     * Kolbenstange INNERHALB des Rohrs. Meldet dieser Block nicht, zeichnet
     * das Blatt einen Zylinder, den es nicht gibt.
     */
    expect(BOLZEN_HOCH.laengeOffen, "Umbau: Auge läge im Rohr").toBeLessThan(ROHR);
    expect(ROHR - BOLZEN_HOCH.laengeOffen).toBeGreaterThan(0.2);
    expect(TRAVERSE_RUNTER.laengeOffen).toBeLessThan(ROHR);
  });

  it("legt bei Variante 3 den Kopf in den Korb und reisst oben eine Lücke auf", () => {
    const drei = kopfHerunter(SAEULE_HEUTE, false);
    /* Der Kopf steht dann unter der Bolzenebene — also im Korb. */
    expect(drei.unterBolzen, "Kopf unter der Bolzenebene").toBeGreaterThan(0.1);
    expect(drei.freiZuSchale, "Kopf berührt die Schalen fast").toBeLessThan(0.02);
    /* Die Säule ist nicht weg, sie ist umgezogen: oben klafft dieselbe Länge. */
    expect(drei.luecke).toBeCloseTo(SAEULE_HEUTE, 9);
    /*
     * GEGENPROBE: Ohne Verschiebung steht der Kopf ÜBER der Bolzenebene und
     * hat Luft zu den Schalen. Sonst misst der Block oben nur sich selbst.
     */
    const null0 = kopfHerunter(0, false);
    expect(null0.unterBolzen, "unverschoben darf der Kopf nicht im Korb stehen").toBeLessThan(0);
    expect(null0.freiZuSchale).toBeGreaterThan(0.05);
  });
});
