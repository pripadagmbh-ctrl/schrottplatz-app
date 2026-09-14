import { describe, it, expect } from "vitest";
import { defaultConfig, FUNCTION_LABELS, AXIS_LABELS } from "../src/core/controlConfig";

/*
 * Die Werkseinstellung der Steuerung ist eine Entscheidung, keine Zufallszahl.
 *
 * Patrick hat sie sich am 14.09.2026 auf dem iPad selbst eingestellt und als
 * Werkseinstellung bestellt. Wer sie aendert, aendert damit, wie sich das Spiel
 * fuer jeden neuen Spieler zum ersten Mal anfuehlt — das soll auffallen und
 * nicht nebenbei passieren. Deshalb steht sie hier Achse fuer Achse.
 */
describe("Werkseinstellung der Steuerung", () => {
  it("belegt die vier Achsen nach dem Bedienschema echter Umschlagbagger", () => {
    const c = defaultConfig();
    expect(c.leftY.fn).toBe("boom"); // Hauptarm heben/senken
    expect(c.leftX.fn).toBe("cab"); // Oberwagen drehen
    expect(c.rightY.fn).toBe("stick"); // Ausleger heran/weg
    expect(c.rightX.fn).toBe("grapple"); // Spinne oeffnen/schliessen
  });

  it("kehrt drei Achsen um, die Spinne nicht", () => {
    const c = defaultConfig();
    // Beide Y-Achsen: Stick nach vorne liefert einen negativen Wert, soll aber
    // "heben" heissen.
    expect(c.leftY.invert).toBe(true);
    expect(c.rightY.invert).toBe(true);
    // Drehen: Der Spieler sitzt in der Kabine und dreht mit. Stick nach links
    // laesst die Welt nach rechts wandern (Ansage 14.09.2026).
    expect(c.leftX.invert).toBe(true);
    // Die Spinne oeffnet und schliesst richtungsneutral.
    expect(c.rightX.invert).toBe(false);
  });

  it("gibt bei jedem Aufruf ein frisches Objekt zurueck", () => {
    // Sonst traegt eine Aenderung im Menue in die Werkseinstellung zurueck und
    // "Werkseinstellung" stellt nichts mehr her.
    const a = defaultConfig();
    a.leftY.fn = "none";
    expect(defaultConfig().leftY.fn).toBe("boom");
  });

  it("hat fuer jede Funktion und jede Achse einen Klartext im Menue", () => {
    const c = defaultConfig();
    for (const achse of Object.keys(c) as Array<keyof typeof c>) {
      expect(AXIS_LABELS[achse]).toBeTruthy();
      expect(FUNCTION_LABELS[c[achse].fn]).toBeTruthy();
    }
  });
});
