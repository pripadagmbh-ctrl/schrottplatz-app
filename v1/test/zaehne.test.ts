/**
 * Wächter für die Starrheit der Greifzähne.
 *
 * Befund 12.09.2026: „die Spinne soll im Zweifel die Zähne bei Bedarf dem
 * Objekt angepasst schließen, aber eine gewisse Starre bzw. Kraft muss jeder
 * Zahn haben."
 *
 * Vorher gab es nur zwei Zustände: massiver Stahl hielt den Zahn auf, alles
 * andere galt gar nicht als Hindernis — der Zahn lief durch ein Fass, eine
 * Waschmaschine, eine Kabine glatt hindurch bis zum Anschlag. Das Objekt sah
 * hinterher aus, als hätte der Greifer es nie berührt.
 *
 * Jetzt hat jeder Zahn ein Weggeld: An Massivem einen Ruck, an Nachgiebigem
 * gut das Dreifache. Danach steht er, egal was der Fahrer kommandiert.
 */
import { describe, it, expect } from "vitest";
import {
  naechsteSpreizung,
  NACHDRUECK_RESERVE,
  WEICH_RESERVE,
} from "../src/excavator/clawGeometry";

/** Einen Zahn von `start` aus gegen ein Hindernis zufahren lassen. */
function fahreZu(start: number, reserve: number, schritt = 0.05): number {
  let winkel = start;
  let rest = reserve;
  for (let i = 0; i < 400; i++) {
    const r = naechsteSpreizung(winkel, 0, schritt, true, rest);
    if (r.winkel === winkel) break; // steht
    winkel = r.winkel;
    rest = r.reserve;
  }
  return start - winkel;
}

describe("Starrheit der Zähne", () => {
  it("nachgiebiges Material gibt weiter nach als massives", () => {
    const hart = fahreZu(1.0, NACHDRUECK_RESERVE);
    const weich = fahreZu(1.0, WEICH_RESERVE);
    expect(weich).toBeGreaterThan(hart);
    // Deutlich weiter, nicht nur ein bisschen — sonst sieht man den
    // Unterschied zwischen Fass und Träger nicht.
    expect(weich / hart).toBeGreaterThan(2.5);
  });

  it("auch nachgiebiges Material bringt den Zahn zum Stehen", () => {
    /*
     * Das ist der Kern der Ansage. Der Zahn passt sich an — aber er hört auf.
     * Vorher war dieser Fall gar nicht erreichbar: Nachgiebiges wurde dem
     * Aufrufer als „nicht blockiert" gemeldet, und dann läuft der Zahn ohne
     * Grenze bis zum Zielwinkel durch.
     */
    const weg = fahreZu(1.0, WEICH_RESERVE);
    expect(weg).toBeLessThan(1.0); // er kommt nicht bis zum Anschlag
    expect(weg).toBeCloseTo(WEICH_RESERVE, 5);
  });

  it("ohne Hindernis läuft der Zahn ganz zu", () => {
    let winkel = 1.0;
    let rest = NACHDRUECK_RESERVE;
    for (let i = 0; i < 400; i++) {
      const r = naechsteSpreizung(winkel, 0, 0.05, false, rest);
      winkel = r.winkel;
      rest = r.reserve;
    }
    expect(winkel).toBe(0);
  });

  it("Öffnen gibt das Weggeld zurück", () => {
    // Sonst bliebe ein Zahn, der einmal aufgesessen hat, für immer weich.
    const r = naechsteSpreizung(0.5, 1.0, 0.05, false, 0);
    expect(r.reserve).toBe(NACHDRUECK_RESERVE);
  });
});
