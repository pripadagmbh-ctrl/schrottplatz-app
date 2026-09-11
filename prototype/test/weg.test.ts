import { describe, it, expect } from "vitest";
import {
  abstandZurStrecke,
  wegFrei,
  wegPunkte,
  SCHAUFEL_BREITE,
  WEG_MAX_PUNKTE,
  WEG_SCHWER_KG,
  type WegTeil,
} from "../src/world/weg";

/**
 * Auftrag 11.09.2026, Phase 0.2: "Nicht durch den Haufen pflügen."
 * Mehr als ~3 Teile oder ein schweres Teil im Weg ⇒ Ziel unerreichbar,
 * schlafende Teile zählen doppelt.
 */
const teil = (x: number, z: number, o: Partial<WegTeil> = {}): WegTeil => ({
  x,
  z,
  r: 0.25,
  massKg: 40,
  schlaeft: false,
  ...o,
});

describe("Wegprüfung des Radladers", () => {
  it("misst den Abstand zur Strecke, nicht zu ihren Enden", () => {
    // Punkt neben der Streckenmitte
    expect(abstandZurStrecke(0, 1, -5, 0, 5, 0)).toBeCloseTo(1, 5);
    // Punkt hinter dem Ende: dann zählt der Abstand zum Endpunkt
    expect(abstandZurStrecke(8, 0, -5, 0, 5, 0)).toBeCloseTo(3, 5);
  });

  it("lässt einen freien Weg passieren", () => {
    const teile = [teil(0, 6), teil(4, -3)];
    expect(wegFrei(0, 0, 0, 3, teile)).toBe(true);
  });

  it("sperrt, sobald mehr als drei Teile im Korridor liegen", () => {
    const teile = [teil(0, 1), teil(0, 2), teil(0, 3), teil(0, 4)];
    expect(wegPunkte(0, 0, 0, 5, teile)).toBeGreaterThan(WEG_MAX_PUNKTE);
    expect(wegFrei(0, 0, 0, 5, teile)).toBe(false);
  });

  it("zählt schlafende Teile doppelt", () => {
    const wach = [teil(0, 1), teil(0, 2)];
    const schlafend = wach.map((t) => ({ ...t, schlaeft: true }));
    expect(wegPunkte(0, 0, 0, 3, wach)).toBe(2);
    expect(wegPunkte(0, 0, 0, 3, schlafend)).toBe(4);
    expect(wegFrei(0, 0, 0, 3, schlafend)).toBe(false);
  });

  it("ein einzelner schwerer Brocken genügt", () => {
    const teile = [teil(0, 2, { massKg: WEG_SCHWER_KG })];
    expect(wegFrei(0, 0, 0, 4, teile)).toBe(false);
  });

  it("zählt nur, was wirklich im Korridor liegt", () => {
    // knapp daneben: Schaufelbreite halbe plus Teilradius
    const knappDaneben = SCHAUFEL_BREITE / 2 + 0.25 + 0.05;
    const teile = [teil(knappDaneben, 2), teil(-knappDaneben, 2)];
    expect(wegPunkte(0, 0, 0, 4, teile)).toBe(0);
  });

  it("lässt das Zielteil selbst aussen vor", () => {
    const ziel = teil(0, 3);
    expect(wegFrei(0, 0, 0, 3, [ziel], SCHAUFEL_BREITE, ziel)).toBe(true);
  });
});
