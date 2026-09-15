/**
 * BLECH UND KOLLIDER DER LADEFLÄCHE LIEGEN AUF DERSELBEN HÖHE (E-051, E-071).
 *
 * Befund Patrick, 15.09.2026: „Teile fallen immer noch beim Kippen durch die
 * Ladefläche."
 *
 * Eine von zwei Ursachen ist reine Geometrie und hat mit dem Kippen gar nichts
 * zu tun: Das sichtbare Blech war 12 cm dick und stand mittig auf 0, seine
 * Oberkante lag also auf +0,06. Der Kollider hat seine Oberkante auf +0,04.
 * ALLES, was auf der Fläche lag, wurde damit grundsätzlich zwei Zentimeter
 * eingesunken gezeichnet — bei einem 12-cm-Blech ein Sechstel. Gemessen ruhten
 * 27 von 36 Stücken exakt auf der Kollideroberkante und sahen trotzdem
 * eingesunken aus; die übrigen neun drückten zusätzlich bis zu 8 cm ein.
 *
 * ANGEGLICHEN WURDE DAS BLECH, NICHT DER KOLLIDER.
 *
 * ACHTUNG — DIE URSPRÜNGLICHE BEGRÜNDUNG WAR FALSCH GEMESSEN (E-062).
 * Hier stand: „Den Quader zwei Zentimeter dicker zu machen, hat den
 * Kipper-Katapult über dieselben 24 Saaten von Mittel 122 / Höchst 228 auf
 * 160 / 492 km/h getrieben." Diese vier Zahlen stammen aus einem Messgerät,
 * das eine in sich unmögliche Fuhre geladen hat (`fuellgrad: 0.85` neben
 * `massKg: 5000`, siehe `test/pruefkunde.ts`), und sie sind am 15.09.2026
 * verworfen worden.
 *
 * NACHGEMESSEN mit stimmiger Fuhre, denselben 24 Saaten und demselben
 * Laufapparat — die Dicke wird dabei am fertigen Kollider gestellt, damit
 * beide Stände Stück für Stück dieselbe Ladung tragen:
 *
 *   Kollider 0,60 m, Oberkante +0,04 (gebaut)   Mittel 149  Höchst 463 km/h
 *   Kollider 0,62 m, Oberkante +0,06 (dicker)   Mittel 135  Höchst 354 km/h
 *
 * Paarweise gerechnet ist die Differenz +14 ± 24 km/h: Der dickere Quader ist
 * NICHT messbar schlechter — eher unauffällig besser. Die Entscheidung, das
 * Blech zu senken statt den Kollider zu heben, steht trotzdem: Sie kostet
 * keine einzige Physikänderung und keine Messung, während die andere Richtung
 * die Rückwand am Kipplager anfasst. Sie steht jetzt nur aus dem richtigen
 * Grund da — „billiger und risikoärmer", nicht „sonst fliegt die Fuhre".
 *
 * Dieser Wächter hält die beiden Zahlen zusammen. Läuft eine weg, sieht man es
 * am Gerät als schwebenden oder versunkenen Schrott, und zwar erst Tage
 * später.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FLAECHE_KOLLIDER_OBEN,
  BRUECKE_DICKE_VORN,
  brueckenKeilEcken,
} from "../src/delivery/vehicleModel";
import { BED_HALF_W, bedLenFor } from "../src/delivery/routes";

const quelle = (datei: string): string =>
  readFileSync(resolve(__dirname, "..", "src", "delivery", datei), "utf8");

/** Dicke des sichtbaren Blechs (`vehicleModel`: BoxGeometry(bedW, 0.12, bedLen)). */
const BLECH_DICKE = 0.12;

/** Laenge der Kipper-Ladeflaeche (Quelle: `routes.BED_LEN`). */
const BED_LEN = bedLenFor("kipper");

describe("Ladefläche: Blech und Kollider", () => {
  it("die Kollideroberkante ist waagerecht und liegt auf der Flaechenhoehe", () => {
    /*
     * SEIT E-071 IST DIE BRÜCKE EIN KEIL, KEIN QUADER. Hier stand eine
     * Abschrift-Prüfung per Textsuche auf `cuboid(halfW, 0.30, …)`; die geht
     * jetzt nicht mehr und wäre auch die schwächere Prüfung. Gefragt wird
     * stattdessen die Funktion selbst, aus der `vehicles.ts` den Kollider baut.
     *
     * Geprüft wird die Eigenschaft, auf der alles andere aufsetzt: Die
     * DECKFLÄCHE ist über die ganze Länge waagerecht und liegt genau auf
     * `FLAECHE_KOLLIDER_OBEN`. Kippt sie, sinkt die Ladung an einem Ende ein.
     */
    const ecken = brueckenKeilEcken(BED_HALF_W, BED_LEN);
    const ys: number[] = [];
    for (let i = 0; i < ecken.length; i += 3) ys.push(ecken[i + 1]!);
    // Float32Array: auf sechs Nachkommastellen genau, mehr gibt einfache
    // Genauigkeit nicht her (0,04 wird zu 0,039999999).
    const oben = ys.filter((y) => Math.abs(y - FLAECHE_KOLLIDER_OBEN) < 1e-6);
    expect(oben.length, "die Deckflaeche hat nicht vier Ecken auf einer Hoehe").toBe(4);
    expect(Math.max(...ys), "hoechster Punkt der Bruecke").toBeCloseTo(FLAECHE_KOLLIDER_OBEN, 6);
  });

  it("die Bruecke laeuft nach hinten auf die Blechdicke aus", () => {
    /*
     * Der Kern von E-071 als Geometrie: Am Drehpunkt (lokal z 0) ist der
     * Kollider genau so dick wie das sichtbare Blech — dort, wo er beim Kippen
     * unter die Brücke schwenkt. Vorn an der Kabine bleibt er dick, damit der
     * Spalt zum Rahmen zu ist.
     */
    const ecken = brueckenKeilEcken(BED_HALF_W, BED_LEN);
    const tiefstesBei = (z: number): number => {
      let y = Number.POSITIVE_INFINITY;
      for (let i = 0; i < ecken.length; i += 3) {
        if (Math.abs(ecken[i + 2]! - z) < 1e-6) y = Math.min(y, ecken[i + 1]!);
      }
      return y;
    };
    expect(FLAECHE_KOLLIDER_OBEN - tiefstesBei(0), "Dicke am Heck").toBeCloseTo(BLECH_DICKE, 6);
    expect(FLAECHE_KOLLIDER_OBEN - tiefstesBei(BED_LEN), "Dicke an der Kabine").toBeCloseTo(
      BRUECKE_DICKE_VORN,
      6
    );
    /*
     * Und die Unterkante darf den Rahmen nicht berühren: `chassisBody` ist ein
     * Quader der Halbhöhe 0,185 auf y 0,265 in Fahrzeugkoordinaten, seine
     * Oberkante liegt auf 0,45. Die Ladefläche hängt auf 1,05, in ihren
     * Koordinaten also auf −0,60. Zwei kinematische Körper, die sich
     * überschneiden, klemmen die Ladung ein (E-029) — das war der Befund vom
     * 13.09.2026 und darf nicht zurückkommen.
     */
    const RAHMEN_OBEN = 0.45 - 1.05;
    expect(tiefstesBei(BED_LEN), "Bruecke sitzt auf dem Rahmen auf").toBeGreaterThan(RAHMEN_OBEN);
    expect(tiefstesBei(0), "Bruecke sitzt am Heck auf dem Rahmen auf").toBeGreaterThan(RAHMEN_OBEN);
  });

  it("GEGENPROBE: eine schiefe Deckflaeche wird gemeldet", () => {
    /*
     * Derselbe Prüfgedanke auf einen absichtlich kaputten Eingang: Wenn die
     * Brücke auch OBEN keilförmig wäre, dürfte die erste Prüfung nicht mehr
     * grün sein. `brueckenKeilEcken` kann so etwas gar nicht bauen — also wird
     * die Eckenliste von Hand verbogen.
     */
    const ecken = Array.from(brueckenKeilEcken(BED_HALF_W, BED_LEN));
    ecken[1 + 3 * 4] = FLAECHE_KOLLIDER_OBEN + 0.2; // eine vordere Oberkante anheben
    const ys: number[] = [];
    for (let i = 0; i < ecken.length; i += 3) ys.push(ecken[i + 1]!);
    const oben = ys.filter((y) => Math.abs(y - FLAECHE_KOLLIDER_OBEN) < 1e-6);
    expect(oben.length, "die verbogene Deckflaeche wird nicht bemerkt").not.toBe(4);
  });

  it("die Oberkante des Blechs liegt genau darauf, nicht darüber", () => {
    const vm = quelle("vehicleModel.ts");
    const m = vm.match(/floor\.position\.set\(0,\s*([^,]+),\s*v\.bedLen \/ 2\)/);
    expect(m, "der Flächenboden wird nicht mehr so gesetzt").toBeTruthy();
    // Der Ausdruck muss aus der Kolliderkante gerechnet sein, nicht getippt
    expect(m![1], "die Höhe ist wieder eine freie Zahl").toContain("FLAECHE_KOLLIDER_OBEN");
    // und das Ergebnis stimmt: Mitte + halbe Blechdicke = Kollideroberkante
    const mitteBlech = FLAECHE_KOLLIDER_OBEN - BLECH_DICKE / 2;
    expect(mitteBlech + BLECH_DICKE / 2).toBeCloseTo(FLAECHE_KOLLIDER_OBEN, 10);
  });

  it("die Ladung wird über beide gesetzt, nicht dazwischen", () => {
    /*
     * `vehicles.LADE_BODEN` ist die Höhe, auf der die Fuhre erzeugt wird. Sie
     * muss über der Kollideroberkante liegen — sonst entsteht die Ladung schon
     * im Boden und wird beim ersten Schritt herausgedrückt.
     */
    const v = quelle("vehicles.ts");
    const m = v.match(/const LADE_BODEN = ([\d.]+);/);
    expect(m, "LADE_BODEN gibt es nicht mehr").toBeTruthy();
    const ladeBoden = Number(m![1]);
    expect(Number.isFinite(ladeBoden)).toBe(true);
    expect(ladeBoden, "die Fuhre entsteht im Boden").toBeGreaterThan(FLAECHE_KOLLIDER_OBEN);
  });
});
