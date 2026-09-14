import { describe, it, expect } from "vitest";
import { inBox, findeBox, ausBox, type Box } from "../src/world/boxen";

/**
 * Anlass (11.09.2026): Bagger und Radlader fuhren mitten durch stehende LKW.
 * Ein LKW steht schräg auf dem Hof — mit einem Umkreis sperrt man entweder
 * den halben Platz oder lässt die Maschine hindurch. Deshalb gedrehte
 * Rechtecke, und die müssen stimmen.
 */
describe("Gedrehte Standflächen", () => {
  const laengs: Box = { x: 0, z: 0, hw: 1.5, hd: 4, rot: 0 };
  const quer: Box = { x: 0, z: 0, hw: 1.5, hd: 4, rot: Math.PI / 2 };

  it("trifft in Blickrichtung weiter als quer dazu", () => {
    expect(inBox(0, 3.5, laengs)).toBe(true);
    expect(inBox(0, 4.5, laengs)).toBe(false);
    expect(inBox(1.2, 0, laengs)).toBe(true);
    expect(inBox(2.0, 0, laengs)).toBe(false);
  });

  it("dreht mit dem Fahrzeug mit", () => {
    // Um 90° gedreht liegt die lange Seite in x
    expect(inBox(3.5, 0, quer)).toBe(true);
    expect(inBox(4.5, 0, quer)).toBe(false);
    expect(inBox(0, 1.2, quer)).toBe(true);
    expect(inBox(0, 2.0, quer)).toBe(false);
  });

  it("rechnet den Sicherheitsabstand mit", () => {
    expect(inBox(2.0, 0, laengs)).toBe(false);
    expect(inBox(2.0, 0, laengs, 0.8)).toBe(true);
  });

  it("findet die Box, in der ein Punkt liegt", () => {
    const boxen: Box[] = [laengs, { ...quer, x: 20 }];
    expect(findeBox(0, 3, boxen)).toBe(laengs);
    expect(findeBox(23, 0, boxen)).toBe(boxen[1]);
    expect(findeBox(50, 50, boxen)).toBeNull();
  });

  it("weist nach draussen, und zwar über die nächste Kante", () => {
    const out = { x: 0, z: 0 };
    // dicht an der rechten Laengsseite: hinaus geht es quer, nicht nach vorn
    ausBox(1.3, 0, laengs, out);
    expect(out.x).toBeCloseTo(1, 5);
    expect(out.z).toBeCloseTo(0, 5);
    // dicht am Heck: hinaus geht es nach hinten
    ausBox(0, -3.8, laengs, out);
    expect(out.z).toBeCloseTo(-1, 5);
    expect(out.x).toBeCloseTo(0, 5);
  });
});
