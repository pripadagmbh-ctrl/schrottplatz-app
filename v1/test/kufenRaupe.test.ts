/**
 * Befund 14.09.2026: „Das Schneemobil hat vier Gummiräder."
 *
 * Es lief über die Bauform `kleinfahrzeug`, und die setzt vier Reifen an die
 * Ecken — derselbe Fehler wie beim Motorrad am selben Tag, nur mit einem
 * anderen Fahrzeug. Ein Schneemobil hat vorn zwei Kufen und hinten eine
 * Raupe.
 *
 * Gemessen wird die Form, nicht die Absicht: vorn (auf Kufenhöhe) ist das
 * Fahrzeug breit, hinten schmal — und schmaler als ein vierrädriges.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { baueGeometrie } from "../src/world/objektbau";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE } from "../src/world/objektkatalog";

/** Breite der Geometrie in einem Quader um (y, z), in Metern. */
function breiteIn(
  g: THREE.BufferGeometry,
  y: number,
  dy: number,
  zVon: number,
  zBis: number
): number {
  const pos = g.getAttribute("position");
  let weit = 0;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    if (Math.abs(py - y) > dy / 2) continue;
    if (pz < zVon || pz > zBis) continue;
    weit = Math.max(weit, Math.abs(pos.getX(i)));
  }
  return weit * 2;
}

const alle = [...SPECS, ...KATALOG_SPECS, ...KATALOG_BIG, ...KATALOG_HUGE] as Array<{
  name?: string;
  bau?: string;
  dims?: number[];
}>;
const teil = (name: string) => alle.find((t) => t.name === name);

describe("Das Schneemobil", () => {
  it("bekommt die eigene Bauform, nicht die des Quads", () => {
    expect(teil("Schneemobil")?.bau).toBe("kufenRaupe");
    expect(teil("Quad")?.bau).toBe("kleinfahrzeug");
  });

  const dims = teil("Schneemobil")!.dims as [number, number, number];
  const [w, h, d] = dims;

  it("steht vorn auf zwei weit auseinanderstehenden Kufen", () => {
    const g = baueGeometrie("kufenRaupe", dims, "box").koerper;
    const vorn = breiteIn(g, -h * 0.46, h * 0.14, d * 0.05, d * 0.5);
    // Kufen auf ±0,40 · Breite, jede 0,12 breit → mindestens 0,8 · Breite
    expect(vorn).toBeGreaterThan(w * 0.8);
  });

  it("und läuft hinten auf einer Raupe in der Mitte", () => {
    const g = baueGeometrie("kufenRaupe", dims, "box").koerper;
    const vorn = breiteIn(g, -h * 0.46, h * 0.14, d * 0.05, d * 0.5);
    const hinten = breiteIn(g, -h * 0.33, h * 0.2, -d * 0.5, -d * 0.05);
    expect(hinten, "hinten ist es so breit wie vorn — das sind keine Kufen").toBeLessThan(
      vorn * 0.7
    );
    // Die Raupe ist 0,44 · Breite breit
    expect(hinten).toBeGreaterThan(w * 0.3);
    expect(hinten).toBeLessThan(w * 0.6);
  });

  it("hat hinten keine Räder mehr an den Ecken", () => {
    const kufen = baueGeometrie("kufenRaupe", dims, "box").koerper;
    const vier = baueGeometrie("kleinfahrzeug", dims, "box").koerper;
    const y = -h * 0.3;
    const mitRaedern = breiteIn(vier, y, 0.12, -d * 0.5, -d * 0.1);
    const mitRaupe = breiteIn(kufen, y, 0.12, -d * 0.5, -d * 0.1);
    expect(mitRaupe).toBeLessThan(mitRaedern * 0.75);
  });

  it("bleibt ein Objekt aus einer Geometrie — ein Zeichenruf, keine Scheibe", () => {
    const b = baueGeometrie("kufenRaupe", dims, "box");
    expect(b.glas).toBeNull();
    expect(b.koerper.getAttribute("position").count).toBeGreaterThan(0);
  });
});
