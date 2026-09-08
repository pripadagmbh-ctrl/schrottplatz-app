import { describe, it, expect } from "vitest";
import { TapDetector } from "@/app/input/TapDetector";

const cfg = { tapMaxMs: 250, tapMaxMovePx: 12, doubleTapMs: 300, doubleTapRadiusPx: 40 };

describe("TapDetector (Doppeltipp = Ansicht wechseln)", () => {
  it("zwei kurze Tipps am selben Ort → Doppeltipp", () => {
    const d = new TapDetector(cfg);
    d.pointerDown(1, 100, 500, 0); expect(d.pointerUp(1, 100, 500, 80)).toBe(false);
    d.pointerDown(2, 105, 503, 200); expect(d.pointerUp(2, 106, 503, 270)).toBe(true);
  });
  it("linker und rechter Daumen nacheinander → kein Doppeltipp (Gerätetest 08.09.)", () => {
    const d = new TapDetector(cfg);
    d.pointerDown(1, 200, 600, 0); d.pointerUp(1, 200, 600, 80);
    d.pointerDown(2, 900, 600, 150); expect(d.pointerUp(2, 900, 600, 230)).toBe(false);
  });
  it("Stick-Zug (bewegt) oder langes Halten zählt nicht als Tipp", () => {
    const d = new TapDetector(cfg);
    d.pointerDown(1, 100, 500, 0); expect(d.pointerUp(1, 100, 560, 100)).toBe(false); // bewegt
    d.pointerDown(2, 100, 500, 150); expect(d.pointerUp(2, 100, 500, 230)).toBe(false); // erster gültiger Tipp
    d.pointerDown(3, 100, 500, 260); expect(d.pointerUp(3, 100, 500, 900)).toBe(false); // zu lang gehalten
    d.pointerDown(4, 100, 500, 950); expect(d.pointerUp(4, 100, 500, 1000)).toBe(false); // Kette wurde unterbrochen
  });
  it("zu langsam hintereinander → zwei Einzeltipps", () => {
    const d = new TapDetector(cfg);
    d.pointerDown(1, 100, 500, 0); d.pointerUp(1, 100, 500, 80);
    d.pointerDown(2, 100, 500, 500); expect(d.pointerUp(2, 100, 500, 560)).toBe(false);
  });
});
