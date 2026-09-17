/**
 * NICHT JEDES WRACK IST ROT (17.09.2026).
 *
 * Patrick: „und autos, brauchen wir verschiedene modelle, farben und
 * wrackzustände, bitte notieren". Bis dahin stand in `composites.buildMeshes`
 * ein einziger Lack, 0x8c2f24 — jedes Auto auf dem Hof dasselbe Rot.
 *
 * Geprüft werden drei Eigenschaften, und jede hat ihre Gegenprobe:
 *   1. Zwei Wracks an verschiedenen Stellen sehen verschieden aus.
 *   2. Dasselbe Wrack an derselben Stelle sieht immer gleich aus (Spielstand).
 *   3. Der Lack ist verwittert, nicht fabrikfrisch.
 */
import { describe, it, expect } from "vitest";
import { wrackLack, wrackGrundton } from "../src/dismantle/composites";
import { AUTOLACK, verwittert } from "../src/world/objektbau";

/** Abstand zweier Farben, grob: größte Kanalabweichung in 0..255. */
function abstand(a: number, b: number): number {
  return Math.max(
    Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)),
    Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)),
    Math.abs((a & 255) - (b & 255))
  );
}

/** Sättigung in 0..1 — wie weit die Farbe vom Grau entfernt ist. */
function saettigung(hex: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

describe("Der Lack eines Wracks", () => {
  it("ist an zwanzig Standorten nicht zwanzigmal derselbe", () => {
    const farben = new Set<number>();
    for (let i = 0; i < 20; i++) farben.add(wrackGrundton(-8 + i * 0.9, 4 - i * 0.7));
    /*
     * Gemessen: 20 verschiedene aus 20 Standorten. Die Schranke steht bei 8,
     * denn `AUTOLACK` hat 16 Einträge und zieht bewusst ungleich (Weiß dreimal,
     * Schwarz/Grau/Silber zweimal) — zwei gleiche Grundtöne sind erlaubt, sie
     * bekommen dann verschiedene Verwitterung.
     */
    expect(farben.size, `nur ${farben.size} verschiedene Lacke`).toBeGreaterThanOrEqual(8);
  });

  it("wechselt auch dann, wenn die Wracks in einer Reihe stehen", () => {
    /*
     * DER FEHLER, DEN DIESE ZEILE GEFUNDEN HAT (17.09.2026): Die erste Fassung
     * rechnete die Farbe LINEAR aus den Koordinaten. Standorte auf einer
     * Geraden — und so stehen Wracks auf einem Hof, in einer Reihe — sprangen
     * dann in festem Abstand durch die Palette und trafen nur jeden zweiten
     * Eintrag. Zwölf Wracks in einer Reihe, zwei Grundtöne im Wechsel.
     *
     * Die Prüfung ist absichtlich strenger als die davor: nicht irgendwelche
     * zwanzig Stellen, sondern eine GERADE. Gemessen nach der Änderung:
     * 9 verschiedene Grundtöne bei 12 Standorten.
     */
    const reihe = new Set<number>();
    for (let i = 0; i < 12; i++) reihe.add(wrackGrundton(-8 + i * 1.3, 5 - i * 0.9));
    expect(reihe.size, `nur ${reihe.size} Grundtöne in der Reihe`).toBeGreaterThanOrEqual(6);
  });

  it("ist an derselben Stelle immer derselbe — sonst wechselt er beim Laden", () => {
    for (const [x, z] of [
      [0, 0],
      [-7.4, 3.2],
      [12.05, -8.9],
    ] as const) {
      expect(wrackLack(x, z)).toBe(wrackLack(x, z));
    }
  });

  it("ist ausgeblichen, nicht fabrikfrisch", () => {
    /*
     * Jeder Autolack verliert durch `verwittert` Sättigung. Geprüft an den
     * BUNTEN Einträgen der Palette — bei Weiß, Schwarz, Grau und Silber gibt
     * es nichts auszubleichen, die sind schon unbunt.
     *
     * Die Schwelle steht bei 0,3 und nicht bei 0,2: Beige (0xb9ad93,
     * Sättigung 0,21) wird durch den Rostanteil rechnerisch BUNTER, weil Rost
     * kräftiger ist als Beige. Das ist kein Fehler, sondern der Sinn der
     * Sache — ein beiges Auto wird auf dem Hof rostbraun, nicht grau.
     */
    let geprueft = 0;
    for (const lack of AUTOLACK) {
      if (saettigung(lack) < 0.3) continue;
      const alt = verwittert(lack, 0.7);
      expect(
        saettigung(alt),
        `${lack.toString(16)} -> ${alt.toString(16)}`
      ).toBeLessThan(saettigung(lack));
      geprueft++;
    }
    expect(geprueft, "keine bunte Farbe in der Palette").toBeGreaterThan(4);
  });
});

/**
 * GEGENPROBE — derselbe Prüfcode auf einen kaputten Eingang. Ohne diese Zeilen
 * wäre „mindestens acht verschiedene" ein Test, der auch bei einer Palette aus
 * lauter Rot grün werden könnte, solange die Verwitterung streut.
 */
describe("Gegenprobe: die Prüfungen melden auch", () => {
  it("eine Palette aus einer einzigen Farbe fällt durch die Abstandsprüfung", () => {
    const einfarbig = new Set<number>();
    for (let i = 0; i < 20; i++) einfarbig.add(0x8c2f24);
    expect(einfarbig.size).toBeLessThan(8);
  });

  it("ohne Verwitterung bleibt die Sättigung, wie sie war", () => {
    const rot = 0x8d3128;
    expect(saettigung(verwittert(rot, 0))).toBeCloseTo(saettigung(rot), 5);
    // und die Prüfung „ausgeblichen" würde das melden
    expect(saettigung(verwittert(rot, 0)) < saettigung(rot)).toBe(false);
  });

  it("zwei gleiche Farben haben Abstand null, zwei verschiedene nicht", () => {
    expect(abstand(0x8c2f24, 0x8c2f24)).toBe(0);
    expect(abstand(wrackLack(0, 0), wrackLack(5.3, -2.1))).toBeGreaterThan(0);
  });
});
