import { describe, it, expect } from "vitest";
import { packeLadung, ladeHoehe, stueckMass, type LadeStueck } from "../src/delivery/ladung";

/**
 * Anlass (11.09.2026): "Die LKWs sind viel zu hoch beladen, die Ladung sollte
 * sich an der Kastenform orientieren." Vorher landete jedes Stück, das keinen
 * zufälligen Platz fand, auf einem Stapel in der Mitte — daraus wurden Türme
 * weit über der Bordwand.
 */
describe("Ladung packen", () => {
  /** n gleiche Wuerfelchen von 2r Kante — wie vorher, nur als Rechteck benannt. */
  const gleich = (n: number, r = 0.3, hoehe = 0.3): LadeStueck[] =>
    Array.from({ length: n }, () => ({ breite: r * 2, laenge: r * 2, hoehe }));

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
      const halbX = (p.quer ? stuecke[i].laenge : stuecke[i].breite) / 2;
      const halbZ = (p.quer ? stuecke[i].breite : stuecke[i].laenge) / 2;
      expect(Math.abs(p.x) + halbX).toBeLessThanOrEqual(1.35 + 1e-9);
      expect(p.z - halbZ).toBeGreaterThanOrEqual(-1e-9);
      expect(p.z + halbZ).toBeLessThanOrEqual(5.4 + 1e-9);
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
    expect(blech.breite).toBeCloseTo(0.7, 5);
    expect(blech.laenge).toBeCloseTo(0.9, 5);
    // Ein Rohr liegt auf der Seite: Höhe ist sein Durchmesser
    const rohr = stueckMass("cyl", [0.09, 1.1]);
    expect(rohr.hoehe).toBeCloseTo(0.18, 5);
    expect(rohr.laenge).toBeCloseTo(1.1, 5);
  });

  /**
   * DAS LANGE STÜCK LIEGT LÄNGS (E-105, 17.09.2026).
   *
   * Ein Stück, das breiter ist als der Wagen und kürzer als er lang ist,
   * gehört gedreht. Vorher belegte jedes Stück ein Quadrat seiner
   * Grundriss-Diagonale und fiel deshalb durch.
   */
  it("dreht ein langes Stück, damit es längs auf den Wagen passt", () => {
    // Mähdrescher-Schneidwerk: 4,60 m breit, 1,30 m tief, 0,90 m hoch
    const s = stueckMass("box", [4.6, 0.9, 1.3]);
    const plaetze = packeLadung([s], 1.27, 5.0, 0.99);
    expect(plaetze[0], "das Schneidwerk fand keinen Platz").not.toBeNull();
    expect(plaetze[0]!.quer, "es liegt quer über der Pritsche").toBe(true);
    // und bleibt dabei innerhalb der Bordwände
    expect(Math.abs(plaetze[0]!.x) + s.laenge / 2).toBeLessThanOrEqual(1.27 + 1e-9);
    expect(plaetze[0]!.z + s.breite / 2).toBeLessThanOrEqual(5.0 + 1e-9);
  });

  /**
   * GEGENPROBE zum Wächter darüber: Was auch gedreht nicht passt, muss
   * liegenbleiben. Ohne diese Zeile wäre „passt immer" ein grüner Test.
   */
  it("und was in keiner Lage passt, bleibt liegen", () => {
    // 3,00 m x 2,80 m — in beiden Lagen breiter als die 2,54 m Innenbreite
    const s = stueckMass("box", [3.0, 0.5, 2.8]);
    expect(packeLadung([s], 1.27, 5.0, 0.99)[0]).toBeNull();
    // und ein flaches Stück, das schlicht zu hoch baut
    const hoch = stueckMass("box", [1.0, 2.2, 1.0]);
    expect(packeLadung([hoch], 1.27, 5.0, 0.99)[0]).toBeNull();
  });
});
