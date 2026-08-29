import { describe, expect, it } from "vitest";
import { MATERIALS } from "../src/materials/catalog";
import { computePurity, containerValue, euroIndicator } from "../src/materials/purity";

/** M1-Abnahme (Briefing Kap. 22): „Reinheits-/Geldanzeige rechnet korrekt (Vitest-geprüft)" */

describe("computePurity", () => {
  it("leerer Container ist rein", () => {
    expect(computePurity(0, 0)).toBe(1);
  });
  it("ohne Fremdmasse 100 %", () => {
    expect(computePurity(100, 0)).toBe(1);
  });
  it("25 kg fremd von 100 kg → 75 %", () => {
    expect(computePurity(100, 25)).toBeCloseTo(0.75);
  });
  it("klemmt auf [0, 1]", () => {
    expect(computePurity(10, 50)).toBe(0);
  });
});

describe("containerValue", () => {
  it("sortenrein: Inhalt × Verkaufspreis", () => {
    // 100 kg Stahl à 0,25 €/kg
    expect(containerValue(MATERIALS.steel, 100, 0)).toBeCloseTo(25);
  });
  it("Reinheit wirkt quadratisch (Kap. 7)", () => {
    // Reinheit 75 % → Faktor 0,5625
    expect(containerValue(MATERIALS.steel, 100, 25)).toBeCloseTo(25 * 0.5625);
  });
  it("Kupfer: hohe Preise, gleiche Formel", () => {
    // 50 kg à 7,20, Reinheit 90 % → 360 × 0,81
    expect(containerValue(MATERIALS.copper, 50, 5)).toBeCloseTo(360 * 0.81);
  });
  it("Entsorgungsfraktion kostet unabhängig von Reinheit", () => {
    // 100 kg Störstoff à −0,08 €/kg
    expect(containerValue(MATERIALS.contaminant, 100, 0)).toBeCloseTo(-8);
    expect(containerValue(MATERIALS.contaminant, 100, 40)).toBeCloseTo(-8);
  });
  it("leerer Container ist wertlos", () => {
    expect(containerValue(MATERIALS.steel, 0, 0)).toBe(0);
  });
});

describe("euroIndicator (Griff-Info Kap. 14)", () => {
  it("staffelt nach Verkaufspreis", () => {
    expect(euroIndicator(MATERIALS.steel)).toBe("€");
    expect(euroIndicator(MATERIALS.va)).toBe("€€");
    expect(euroIndicator(MATERIALS.alu)).toBe("€€");
    expect(euroIndicator(MATERIALS.cable)).toBe("€€€");
    expect(euroIndicator(MATERIALS.copper)).toBe("€€€€");
  });
  it("Störstoffe zeigen Gebühr", () => {
    expect(euroIndicator(MATERIALS.contaminant)).toBe("Gebühr");
  });
});
