/**
 * Wächter für die Steinreihen — Befund 14.09.2026: „Bei jeder Mulde werden
 * immer vollständige Legosteine gebaut ... die Außenteile stehen immer ab."
 *
 * Geprüft wird die Eigenschaft, die man im Bild sieht: Eine Reihe füllt ihre
 * Strecke GENAU aus. Kein Stein steht über das Ende hinaus, und es bleibt
 * auch keine Lücke.
 */
import { describe, it, expect } from "vitest";
import { reihenstuecke, MIN_STUECK } from "../src/world/legoreihe";

/** So lief es vorher: volle Steine, solange die MITTE noch vor dem Ende liegt. */
function alteReihe(von: number, bis: number, steinLaenge: number, versatz = 0): number[] {
  const mitten: number[] = [];
  for (let x = von + steinLaenge / 2 - versatz; x < bis + 0.4; x += steinLaenge) mitten.push(x);
  return mitten;
}

describe("Eine Steinreihe füllt ihre Strecke genau aus", () => {
  const faelle: Array<[string, number, number, number, number]> = [
    // [Name, von, bis, Steinlänge, Versatz]
    ["Muldenflanke 4,2 m, gerade Lage", -2.1, 2.1, 1.5, 0],
    ["Muldenflanke 4,2 m, versetzte Lage", -2.1, 2.1, 1.5, 0.75],
    ["Muldenrückwand 5,1 m", -2.55, 2.55, 1.5, 0],
    ["Silofront 6,0 m", -3.0, 3.0, 1.5, 0.75],
    ["Südmauer bis zur Bucht", -40, -6.5, 1.6, 0],
    ["Südmauer östlich der Bucht", 7.5, 10.5, 1.6, 0],
    ["Ostmauer", -28.7, 28.7, 1.6, 0],
    ["ganz kurzes Stück", 0, 0.9, 1.6, 0],
  ];

  for (const [name, von, bis, laenge, versatz] of faelle) {
    it(`${name}: Anfang, Ende und Fugen stimmen`, () => {
      const st = reihenstuecke(von, bis, laenge, versatz);
      expect(st.length, "keine Steine gesetzt").toBeGreaterThan(0);
      const erster = st[0]!;
      const letzter = st[st.length - 1]!;
      expect(erster.mitte - erster.laenge / 2, "die Reihe fängt woanders an").toBeCloseTo(von, 9);
      expect(letzter.mitte + letzter.laenge / 2, "der letzte Stein steht über").toBeCloseTo(bis, 9);
      // lückenlos aneinander
      for (let i = 1; i < st.length; i++) {
        const linkeKante = st[i]!.mitte - st[i]!.laenge / 2;
        const rechteKante = st[i - 1]!.mitte + st[i - 1]!.laenge / 2;
        expect(linkeKante, `Fuge zwischen Stein ${i} und ${i + 1}`).toBeCloseTo(rechteKante, 9);
      }
      // kein Stein länger als ein ganzer, keiner kürzer als ein Splitter
      const gesamt = bis - von;
      for (const s of st) {
        expect(s.laenge, "Stein länger als ein voller").toBeLessThanOrEqual(laenge + 1e-9);
        if (gesamt > MIN_STUECK) {
          expect(s.laenge, "Splitter am Wandende").toBeGreaterThanOrEqual(MIN_STUECK - 1e-9);
        }
      }
      // Summe = Strecke
      const summe = st.reduce((a, s) => a + s.laenge, 0);
      expect(summe, "Summe der Steine ist nicht die Wandlänge").toBeCloseTo(gesamt, 9);
    });
  }

  it("legt bei glatter Teilung lauter volle Steine", () => {
    const st = reihenstuecke(0, 6, 1.5);
    expect(st.length).toBe(4);
    for (const s of st) expect(s.laenge).toBeCloseTo(1.5, 9);
  });

  it("fängt eine versetzte Lage mit dem kurzen Stein an", () => {
    const st = reihenstuecke(0, 6, 1.5, 0.75);
    expect(st[0]!.laenge).toBeCloseTo(0.75, 9);
  });

  it("macht aus einem Splitter zwei gleich lange Steine", () => {
    // 3,05 m wären zwei volle Steine und ein 5-cm-Rest
    const st = reihenstuecke(0, 3.05, 1.5);
    expect(st.length).toBe(3);
    expect(st[0]!.laenge).toBeCloseTo(1.5, 9);
    expect(st[1]!.laenge).toBeCloseTo(0.775, 9);
    expect(st[2]!.laenge).toBeCloseTo(0.775, 9);
  });

  it("belegt, wie weit die alte Schleife überstand", () => {
    /*
     * Der Vorher-Wert zum Befund, damit die Zahl nicht verlorengeht: Eine
     * versetzte Lage der Muldenflanke stand vorn 0,75 m und hinten 0,50 m
     * über die Wand hinaus.
     */
    const mitten = alteReihe(-2.1, 2.1, 1.5, 0.75);
    expect(mitten[0]! - 0.75).toBeCloseTo(-2.85, 9); // 0,75 m vor der Kante
    expect(mitten[mitten.length - 1]! + 0.75).toBeCloseTo(3.15, 9); // 1,05 m dahinter
    const neu = reihenstuecke(-2.1, 2.1, 1.5, 0.75);
    expect(neu[0]!.mitte - neu[0]!.laenge / 2).toBeCloseTo(-2.1, 9);
  });
});
