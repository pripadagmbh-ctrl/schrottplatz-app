import { describe, it, expect } from "vitest";
import {
  SCHUETTDICHTE,
  STOERSTOFFE,
  ladungsDichte,
  mischDichte,
  schuettdichte,
  stoerstoffDichte,
} from "../src/materials/schuettdichte";
import { MATERIALS, istAbfall } from "../src/materials/catalog";

/**
 * Wächter über die Schüttdichten.
 *
 * Der Fehler, den sie verhindern sollen, ist ein alter: Feststoffdichte statt
 * Schüttdichte. Stahl wiegt 7.850 kg/m³ — loser Stahlschrott 600 bis 900, weil
 * zwischen den Teilen Luft ist. Wer das verwechselt, lädt sechsmal zu viel auf
 * jeden LKW.
 */
describe("Schüttdichten", () => {
  it("jede Fraktion aus dem Katalog hat eine Schüttdichte", () => {
    /*
     * Dieser Wächter zieht mit: Kommt im Katalog eine neue Fraktion dazu,
     * fällt er auf, bevor sie stillschweigend mit dem Standardwert fährt.
     */
    for (const id of Object.keys(MATERIALS)) {
      expect(SCHUETTDICHTE[id], `Fraktion ${id} ohne Schüttdichte`).toBeGreaterThan(0);
    }
  });

  it("jeder Wert ist eine endliche Zahl im Bereich loser Schüttung", () => {
    // Untergrenze: loser Kunststoff (unter 0,1 t/m³).
    // Obergrenze: dicht gestapelte Bleiakkus (1,6 t/m³) — nichts erreicht die
    // Feststoffdichte von Stahl (7,85 t/m³).
    for (const [id, d] of Object.entries(SCHUETTDICHTE)) {
      expect(Number.isFinite(d), `${id}: ${d}`).toBe(true);
      expect(d, id).toBeGreaterThanOrEqual(50);
      expect(d, id).toBeLessThanOrEqual(2000);
    }
  });

  it("Stahlschrott liegt im Faustwert-Band: eine Tonne sind 1,2 bis 1,5 m³", () => {
    const m3proTonne = 1000 / schuettdichte("steel");
    expect(m3proTonne, `${m3proTonne.toFixed(2)} m³ je Tonne`).toBeGreaterThanOrEqual(1.2);
    expect(m3proTonne, `${m3proTonne.toFixed(2)} m³ je Tonne`).toBeLessThanOrEqual(1.5);
  });

  it("die Reihenfolge stimmt: Kunststoff leichter als Alu, Alu leichter als Stahl, Stahl leichter als Messing", () => {
    expect(schuettdichte("plastic")).toBeLessThan(schuettdichte("alu"));
    expect(schuettdichte("alu")).toBeLessThan(schuettdichte("steel"));
    expect(schuettdichte("steel")).toBeLessThan(schuettdichte("brass"));
    expect(schuettdichte("brass")).toBeLessThan(schuettdichte("battery"));
  });

  it("der Störstoff wiegt weniger als jedes Metall — er frisst Volumen, nicht Nutzlast", () => {
    /*
     * Nicht jeder einzelne Abfall ist leichter als jedes Metall — loser
     * Baumischabfall (300) ist schwerer als loses Alu (250), und das stimmt
     * auch in Wirklichkeit. Die Aussage, auf die es ankommt, ist die über das
     * Gemisch: Was als Beifang mitkommt, ist im Mittel leichter als alles,
     * wofür der Platz Geld zahlt.
     */
    const metalle = Object.keys(MATERIALS).filter((id) => !istAbfall(id));
    const leichtestesMetall = Math.min(...metalle.map(schuettdichte));
    expect(
      stoerstoffDichte(),
      `Störstoff ${stoerstoffDichte()}, leichtestes Metall ${leichtestesMetall}`
    ).toBeLessThan(leichtestesMetall);
    // und jeder einzelne Abfall bleibt unter dem Mischschrott
    for (const id of Object.keys(MATERIALS).filter(istAbfall)) {
      expect(schuettdichte(id), id).toBeLessThan(schuettdichte("mixed"));
    }
  });

  it("kennt die alten Fraktionsnamen aus gespeicherten Ständen", () => {
    // `cast` läuft im Stahlschrott mit, `contaminant` im Baumischabfall
    expect(schuettdichte("cast")).toBe(schuettdichte("steel"));
    expect(schuettdichte("contaminant")).toBe(schuettdichte("rubble"));
  });

  it("der Störstoff ist das Mittel aus Holz, Reifen, Baumisch und Kunststoff", () => {
    const mittel = STOERSTOFFE.reduce((s, id) => s + schuettdichte(id), 0) / STOERSTOFFE.length;
    expect(stoerstoffDichte()).toBeCloseTo(mittel, 10);
    expect(stoerstoffDichte()).toBeLessThan(schuettdichte("mixed") / 2);
  });
});

describe("Mischdichte", () => {
  it("rechnet mit Volumenanteilen, nicht mit Gewichtsanteilen", () => {
    // Halb Stahl, halb Kunststoff: das halbe Volumen wiegt fast nichts
    const d = mischDichte({ steel: 0.5, plastic: 0.5 });
    expect(d).toBeCloseTo((schuettdichte("steel") + schuettdichte("plastic")) / 2, 10);
  });

  it("normiert die Anteile, auch wenn sie nicht auf eins aufgehen", () => {
    expect(mischDichte({ steel: 2, plastic: 2 })).toBeCloseTo(mischDichte({ steel: 0.5, plastic: 0.5 }), 10);
  });

  it("eine verunreinigte Fuhre wiegt weniger als eine saubere", () => {
    const sauber = ladungsDichte("steel", 0.05);
    const dreckig = ladungsDichte("steel", 0.35);
    expect(dreckig).toBeLessThan(sauber);
    // 30 Prozentpunkte mehr Störstoff kosten rund ein Fünftel des Gewichts
    expect(dreckig / sauber).toBeLessThan(0.85);
  });

  it("eine gemischte Fuhre ohne Hauptfraktion ist Mischschrott", () => {
    expect(ladungsDichte(null, 0)).toBe(schuettdichte("mixed"));
  });

  it("liefert auch für Unsinn eine brauchbare Zahl statt NaN", () => {
    expect(Number.isFinite(mischDichte({}))).toBe(true);
    expect(Number.isFinite(schuettdichte("gibtsnicht"))).toBe(true);
    expect(Number.isFinite(ladungsDichte("steel", Number.NaN))).toBe(true);
  });
});
