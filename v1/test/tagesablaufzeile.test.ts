/**
 * Die Farbe der Tagesablaufzeile.
 *
 * Patrick am 17.09.2026: „Platz dicht" stand in Gruen da, obwohl es eine
 * Aufforderung ist („erst raeumen!"). Der Wert hiess damals `sortierphase` —
 * ein Rest der abgeschafften Sortierphase — und niemandem fiel auf, dass
 * dort seit langem `shift.jammed` uebergeben wird.
 *
 * Der Waechter haelt beides fest: dass die Warnung warnfarben ist, und dass
 * sie DIESELBE Farbe traegt wie die andere Aufforderung im selben Feld
 * („Kasse wird knapp"). Zwei Aufforderungen in zwei Toenen waeren wieder
 * zwei Wahrheiten.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const QUELLE = readFileSync(new URL("../src/ui/hud.ts", import.meta.url), "utf8");

/** Holt eine benannte Farbkonstante aus dem Quelltext. */
function farbe(name: string): string {
  const treffer = QUELLE.match(new RegExp(`const ${name} = "(#[0-9a-fA-F]{6})"`));
  if (!treffer) throw new Error(`Farbe ${name} steht nicht mehr im Quelltext`);
  return treffer[1]!.toLowerCase();
}

/** Die Warnfarbe aus KASSENLAGE, Stufe „knapp". */
function knappFarbe(): string {
  const treffer = QUELLE.match(/knapp: \{ text: "[^"]*", farbe: "(#[0-9a-fA-F]{6})" \}/);
  if (!treffer) throw new Error("Die Stufe knapp hat keine Farbe mehr");
  return treffer[1]!.toLowerCase();
}

/** Quelltext ohne Kommentare — fuer Pruefungen, die ein Wort verbieten. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Rot, Gruen oder dazwischen? Grob nach Farbkanaelen. */
function istGruen(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  return g > r;
}

describe("Die Tagesablaufzeile faerbt nach Bedeutung", () => {
  it("Platz dicht ist eine Warnung, kein gruenes Licht", () => {
    expect(istGruen(farbe("PLATZ_DICHT"))).toBe(false);
  });

  it("dieselbe Aufforderung, dieselbe Farbe wie Kasse wird knapp", () => {
    expect(farbe("PLATZ_DICHT")).toBe(knappFarbe());
  });

  it("der normale Tag ist NICHT in Warnfarbe", () => {
    expect(farbe("NORMAL")).not.toBe(farbe("PLATZ_DICHT"));
  });

  it("der Wert heisst, was er ist, nicht mehr sortierphase", () => {
    expect(QUELLE).toMatch(/updateShift\(text: string, platzDicht: boolean/);
    // OHNE KOMMENTARE PRUEFEN. Der Eintrag im Quelltext ERKLAERT den alten
    // Namen und nennt ihn dabei; eine Textsuche ueber die ganze Datei findet
    // ihn dort und meldet faelschlich. Dieselbe Falle wie beim
    // Konfliktmarker-Waechter (15.09.) und beim Funk-Vermerk (17.09.): Ein
    // Text, der ein Signalwort ERWAEHNT, sieht fuer eine Suche aus, als
    // SENDE er es.
    expect(ohneKommentare(QUELLE)).not.toMatch(/sortierphase/);
  });

  it("GEGENPROBE: der alte gruene Ton faellt durch", () => {
    // #7ec96a ist die Farbe, die bis zum 17.09.2026 dort stand.
    expect(istGruen("#7ec96a")).toBe(true);
  });

  it("GEGENPROBE: ohneKommentare entfernt wirklich, was in Kommentaren steht", () => {
    expect(ohneKommentare("/* sortierphase */ const a = 1;")).not.toMatch(/sortierphase/);
    const zeilenende = String.fromCharCode(10);
    expect(ohneKommentare("// sortierphase" + zeilenende + "const a = 1;")).not.toMatch(/sortierphase/);
    expect(ohneKommentare("const sortierphase = 1;")).toMatch(/sortierphase/);
  });

  it("GEGENPROBE: zwei verschiedene Warntoene faellen durch", () => {
    // Die Pruefung oben ist eine Gleichheit — hier der Beleg, dass sie
    // ueberhaupt etwas ablehnen kann.
    expect("#f0b24a").not.toBe(knappFarbe());
  });
});
