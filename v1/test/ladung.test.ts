import { describe, it, expect } from "vitest";
import { packeLadung, ladeHoehe, stueckMass, type LadeStueck } from "../src/delivery/ladung";

/**
 * Anlass (11.09.2026): "Die LKWs sind viel zu hoch beladen, die Ladung sollte
 * sich an der Kastenform orientieren." Vorher landete jedes Stück, das keinen
 * zufälligen Platz fand, auf einem Stapel in der Mitte — daraus wurden Türme
 * weit über der Bordwand.
 */
describe("Ladung packen", () => {
  const gleich = (n: number, r = 0.3, hoehe = 0.3): LadeStueck[] =>
    Array.from({ length: n }, () => ({ r, hoehe }));

  it("bleibt unter der Höhengrenze, auch wenn zu viel angeliefert wird", () => {
    const stuecke = gleich(60);
    const plaetze = packeLadung(stuecke, 1.35, 5.4, 1.0);
    expect(ladeHoehe(stuecke, plaetze)).toBeLessThanOrEqual(1.0);
  });

  it("lässt liegen, was nicht mehr passt, statt es aufzutürmen", () => {
    const stuecke = gleich(200);
    const plaetze = packeLadung(stuecke, 1.35, 5.4, 0.7);
    expect(plaetze.some((p) => p === null)).toBe(true);
    expect(ladeHoehe(stuecke, plaetze)).toBeLessThanOrEqual(0.7);
  });

  it("bleibt innerhalb der Ladefläche", () => {
    const stuecke = gleich(30, 0.35, 0.25);
    const plaetze = packeLadung(stuecke, 1.35, 5.4, 1.2);
    plaetze.forEach((p, i) => {
      if (!p) return;
      expect(Math.abs(p.x) + stuecke[i].r).toBeLessThanOrEqual(1.35 + 1e-9);
      expect(p.z - stuecke[i].r).toBeGreaterThanOrEqual(-1e-9);
      expect(p.z + stuecke[i].r).toBeLessThanOrEqual(5.4 + 1e-9);
    });
  });

  it("füllt erst den Boden, bevor gestapelt wird", () => {
    // Vier flache Stücke auf eine große Fläche: keins darf oben liegen
    const stuecke = gleich(4, 0.3, 0.2);
    const plaetze = packeLadung(stuecke, 1.35, 5.4, 1.2);
    for (const p of plaetze) expect(p?.y).toBe(0);
  });

  it("stapelt überhaupt, wenn der Boden voll ist", () => {
    const stuecke = gleich(40, 0.3, 0.2);
    const plaetze = packeLadung(stuecke, 1.35, 5.4, 1.2);
    expect(plaetze.some((p) => p && p.y > 0)).toBe(true);
  });

  it("misst Grundfläche und Höhe der Formen sinnvoll", () => {
    // Ein Blech liegt flach: kaum Höhe, aber viel Grundfläche
    const blech = stueckMass("box", [0.7, 0.06, 0.9]);
    expect(blech.hoehe).toBeCloseTo(0.06, 5);
    expect(blech.r).toBeGreaterThan(0.5);
    // Ein Rohr liegt auf der Seite: Höhe ist sein Durchmesser
    const rohr = stueckMass("cyl", [0.09, 1.1]);
    expect(rohr.hoehe).toBeCloseTo(0.18, 5);
  });
});
