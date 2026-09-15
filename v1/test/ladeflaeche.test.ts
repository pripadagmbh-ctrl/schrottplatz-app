/**
 * BLECH UND KOLLIDER DER LADEFLÄCHE LIEGEN AUF DERSELBEN HÖHE (E-051).
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
import { FLAECHE_KOLLIDER_OBEN } from "../src/delivery/vehicleModel";

const quelle = (datei: string): string =>
  readFileSync(resolve(__dirname, "..", "src", "delivery", datei), "utf8");

/** Dicke des sichtbaren Blechs (`vehicleModel`: BoxGeometry(bedW, 0.12, bedLen)). */
const BLECH_DICKE = 0.12;

describe("Ladefläche: Blech und Kollider", () => {
  it("die Kollideroberkante steht dort, wo `vehicles.ts` sie baut", () => {
    /*
     * `vehicles.ts` legt den Boden als Quader mit Halbhöhe 0,30 auf −0,26 an.
     * Oberkante also −0,26 + 0,30 = +0,04. Die Abschrift in `vehicleModel.ts`
     * muss dasselbe sagen — sonst sitzt das Blech beim nächsten Umbau wieder
     * daneben.
     */
    const v = quelle("vehicles.ts");
    const m = v.match(/cuboid\(halfW,\s*([\d.]+),\s*this\.bedLen \/ 2\)\.setTranslation\(0,\s*(-?[\d.]+),/);
    expect(m, "der Bodenquader steht nicht mehr da, wo dieser Wächter ihn sucht").toBeTruthy();
    const halbHoehe = Number(m![1]);
    const mitte = Number(m![2]);
    expect(Number.isFinite(halbHoehe) && Number.isFinite(mitte), "NaN aus dem Quelltext").toBe(true);
    expect(mitte + halbHoehe, "Kollideroberkante").toBeCloseTo(FLAECHE_KOLLIDER_OBEN, 10);
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
