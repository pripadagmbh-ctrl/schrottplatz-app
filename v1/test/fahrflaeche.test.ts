import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fahrachse } from "../src/core/touch";
import { FUNCTION_LABELS, AXIS_LABELS, defaultConfig } from "../src/core/controlConfig";

/*
 * Fahren ist kein Modus mehr (Ansage Patrick 14.09.2026, Skizze Variante C).
 *
 * Bis dahin machte ein Doppeltipp links den Armstick zu Gas und Lenkung, und
 * nach vier Sekunden ohne Daumen fiel er von selbst zurueck. Derselbe Stick tat
 * mal das eine, mal das andere — und der Zustand wechselte auch ohne Zutun.
 * Jetzt hat das Fahren eine eigene Flaeche in der unteren linken Ecke.
 *
 * Diese Datei haelt beides fest: die Rechnung hinter der Fahrflaeche und den
 * Umstand, dass der alte Modus wirklich weg ist. TouchControls selbst braucht
 * ein Browser-Dokument und laesst sich hier nicht bauen — darum wird die Quelle
 * gelesen, wie es test/upgradeEffects.test.ts fuer die Ausbaustufen tut.
 */

const wurzel = resolve(__dirname, "..");
const touchQuelle = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
/**
 * Dieselbe Seite ohne Kommentare — nur das, was der Spieler wirklich lesen
 * kann. Die Begruendung, warum der Fahrmodus weg ist, steht als Kommentar im
 * Dokument und darf die Suche nach alten Hilfetexten nicht stoeren.
 */
const sichtbar = seite.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("Fahrachse", () => {
  it("bleibt in der Totzone bei null", () => {
    // Daumen rollt beim Aufsetzen ein paar Pixel — das darf nicht anfahren
    expect(fahrachse(0)).toBe(0);
    expect(fahrachse(0.1)).toBe(0);
    expect(fahrachse(-0.14)).toBe(0);
  });

  it("gibt am Vollausschlag volles Gas, in beide Richtungen", () => {
    expect(fahrachse(1)).toBeCloseTo(1, 6);
    expect(fahrachse(-1)).toBeCloseTo(-1, 6);
    // Ueber den Rand gezogen bleibt es bei eins
    expect(fahrachse(1.4)).toBeCloseTo(1, 6);
  });

  it("spreizt den Rest wieder auf den vollen Bereich", () => {
    // Ohne Spreizen begaenne das Fahren mit einem Ruck bei 0,15
    const knapp = fahrachse(0.16);
    expect(knapp).toBeGreaterThan(0);
    expect(knapp).toBeLessThan(0.05);
    // Mitte zwischen Totzone und Vollausschlag ergibt gut halbes Gas
    expect(fahrachse(0.575)).toBeCloseTo(0.5, 2);
  });

  it("steigt durchgehend an", () => {
    let vorher = -1;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const jetzt = fahrachse(v);
      expect(jetzt).toBeGreaterThanOrEqual(vorher);
      vorher = jetzt;
    }
  });
});

describe("Fahrflaeche statt Fahrmodus", () => {
  it("kennt keinen Umschalter und keinen Zeitablauf mehr", () => {
    for (const rest of ["driveMode", "driveIdleS", "DRIVE_AUTO_EXIT_S", "onDriveMode"]) {
      expect(touchQuelle.includes(rest), `${rest} haengt noch in touch.ts`).toBe(false);
    }
  });

  it("hat eine eigene Zone und einen eigenen Stick im Dokument", () => {
    expect(seite).toContain('id="zone-drive"');
    expect(seite).toContain('id="touch-drive"');
    expect(touchQuelle).toContain('this.makeStick("touch-drive", "zone-drive", "fahren")');
  });

  it("nennt die Flaeche im Bild, nicht nur mit Farbe", () => {
    // Regel: Farbe ist nie der einzige Kanal — das Feld traegt seine Aufschrift
    expect(seite).toContain("FAHREN");
    expect(seite).toContain("Gas ↕ · Lenken ↔");
  });

  it("verspricht in keinem Hilfetext mehr einen Doppeltipp zum Fahren", () => {
    expect(sichtbar).not.toContain("Doppeltipp links");
    expect(sichtbar).not.toMatch(/Fahren schaltest du/);
  });

  it("laesst den Doppeltipp fuer die Ansicht unangetastet", () => {
    expect(touchQuelle).toContain('this.pressed.add("KeyC")');
    expect(seite).toContain("Doppeltipp rechts: Ansicht");
  });

  it("gibt der Fahrflaeche keine Zeile im Steuerungsmenue", () => {
    // Gas und Lenken sind fest. Waeren sie belegbar, koennte man sich das
    // Fahren wegstellen — und die Flaeche taete dann nichts.
    expect(Object.keys(AXIS_LABELS)).toEqual(["leftY", "leftX", "rightY", "rightX"]);
    expect(Object.keys(FUNCTION_LABELS)).not.toContain("drive");
    expect(Object.keys(FUNCTION_LABELS)).not.toContain("steer");
    expect(Object.keys(defaultConfig())).toHaveLength(4);
  });
});

describe("Platz auf dem Glas", () => {
  /** Zahl hinter einer CSS-Eigenschaft im angegebenen Block herausziehen. */
  function css(block: string, eigenschaft: string): number {
    const m = new RegExp(`${eigenschaft}:\\s*(\\d+)px`).exec(block);
    expect(m, `${eigenschaft} fehlt`).not.toBeNull();
    return Number(m![1]);
  }
  const tablet = /#touch #zone-drive \{([^}]*)\}/.exec(seite)?.[1] ?? "";
  const handy = /#touch #zone-drive \{ width: (\d+)px; height: (\d+)px/.exec(seite);

  it("laesst dem Armstick auf dem iPad quer den groesseren Teil", () => {
    const hoehe = css(tablet, "height");
    // iPad quer ist 820 px hoch; darueber bleibt der Armstick.
    expect(hoehe).toBeLessThan(820 / 3);
    // Tippziel weit ueber den geforderten 44 px
    expect(hoehe).toBeGreaterThanOrEqual(120);
  });

  it("endet vor der mittigen Griff-Info", () => {
    // Die Griff-Info steht mittig unten; auf dem iPad quer (1180 px) beginnt
    // sie bei rund 515 px, auf dem iPhone mini (812 px) bei rund 336 px.
    expect(css(tablet, "width")).toBeLessThan(515);
    expect(handy, "flaches Layout fehlt").not.toBeNull();
    expect(Number(handy![1])).toBeLessThan(336);
  });

  it("bleibt im Daumenbogen von 478 px", () => {
    // Messung 14.09.2026: von der unteren Ecke reicht der Daumen 478 px weit.
    const b = css(tablet, "width");
    const h = css(tablet, "height");
    const mitte = Math.hypot(b / 2, h / 2);
    expect(mitte).toBeLessThan(478);
  });

  it("schrumpft auf dem flachen Handy-Layout mit", () => {
    // iPhone mini quer: 375 px hoch. Mehr als ein Drittel darf das Fahren nicht
    // nehmen, sonst bleibt dem Armstick keine Aufsetzflaeche.
    expect(Number(handy![2])).toBeLessThan(375 / 3);
    expect(Number(handy![2])).toBeGreaterThanOrEqual(110);
  });
});
