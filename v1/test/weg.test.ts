import { describe, it, expect } from "vitest";
import {
  abstandZurStrecke,
  wegFrei,
  wegPunkte,
  SCHAUFEL_BREITE,
  WEG_MAX_PUNKTE,
  WEG_SCHWER_KG,
  streckeSchneidetZone,
  inZonen,
  nachbarn,
  type WegTeil,
  type Zone,
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

/**
 * "Er darf nur an Aussengrenzen ran" (Wunsch 11.09.2026). Der Radlader
 * faehrt nicht durch Abkippplatz oder Haufen — gemessen stand Lambert vorher
 * 92 Prozent der Zeit mitten in der Abladestelle.
 */
describe("Sperrzonen und Rand", () => {
  const abkipp: Zone = { x: 0, z: 7, hw: 4.5, hd: 4.5 };

  it("erkennt eine Strecke quer durch die Zone", () => {
    expect(streckeSchneidetZone(-10, 7, 10, 7, abkipp)).toBe(true);
    expect(streckeSchneidetZone(0, -5, 0, 20, abkipp)).toBe(true);
  });

  it("lässt Wege daran vorbei zu", () => {
    expect(streckeSchneidetZone(-10, 14, 10, 14, abkipp)).toBe(false);
    expect(streckeSchneidetZone(8, 0, 8, 20, abkipp)).toBe(false);
  });

  it("lässt Arbeit am Rand zu, wenn die Zone geschrumpft geprüft wird", () => {
    // Ein Teil dicht an der Kante: ohne Schrumpfen gesperrt, mit erlaubt
    expect(streckeSchneidetZone(9, 11.4, 0.5, 11.4, abkipp)).toBe(true);
    expect(streckeSchneidetZone(9, 11.4, 0.5, 11.4, abkipp, 1.0)).toBe(false);
  });

  it("erkennt Punkte in der Zone", () => {
    expect(inZonen(0, 7, [abkipp])).toBe(true);
    expect(inZonen(0, 13, [abkipp])).toBe(false);
  });

  it("zählt Nachbarn, um vergrabene Teile auszuschliessen", () => {
    const haufen = [teil(0, 0), teil(0.5, 0.3), teil(-0.4, 0.6), teil(0.2, -0.5)];
    const einzeln = teil(20, 20);
    expect(nachbarn(0, 0, haufen, 1.8, haufen[0])).toBe(3);
    expect(nachbarn(einzeln.x, einzeln.z, [...haufen, einzeln], 1.8, einzeln)).toBe(0);
  });
});
