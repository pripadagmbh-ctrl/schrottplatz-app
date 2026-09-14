import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { baueGeometrie } from "../src/world/objektbau";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE } from "../src/world/objektkatalog";

/*
 * Ansage 14.09.2026: „Motorraeder kommen aktuell mit vier Reifen an."
 *
 * Die Ursache war eine gemeinsame Bauform: `kleinfahrzeug` setzt seine Raeder
 * in einer doppelten Schleife ueber beide Vorzeichen — vier Stueck, fest
 * verdrahtet — und bediente damit Quad, Motorrad, Moped, Roller UND Jetski.
 *
 * Diese Waechter halten fest, welches Fahrzeug welche Bauform bekommt, und
 * pruefen die Geometrie gegen: Ein einspuriges Fahrzeug ist auf Radhoehe
 * deutlich schmaler als ein vierraedriges, weil seine Raeder auf der
 * Mittellinie stehen.
 */

/** Breite der Geometrie in einem waagerechten Streifen um `y`, in Metern. */
function breiteBei(g: THREE.BufferGeometry, y: number, dicke: number): number {
  const pos = g.getAttribute("position");
  let weit = 0;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    if (Math.abs(py - y) > dicke / 2) continue;
    weit = Math.max(weit, Math.abs(pos.getX(i)));
  }
  return weit * 2;
}

const alle = [...SPECS, ...KATALOG_SPECS, ...KATALOG_BIG, ...KATALOG_HUGE] as Array<{ name?: string; bau?: string }>;
const bauFuer = (name: string): string | undefined => alle.find((t) => t.name === name)?.bau;

describe("Einspurige Fahrzeuge", () => {
  it("baut Motorrad, Moped und Roller einspurig, nicht als Kleinfahrzeug", () => {
    for (const name of ["Motorradrahmen", "Mopedrahmen", "Motorroller (komplett)"]) {
      expect(bauFuer(name), name).toBe("einspurig");
    }
  });

  it("lässt dem Quad seine vier Räder", () => {
    expect(bauFuer("Quad")).toBe("kleinfahrzeug");
  });

  it("gibt dem Jetski gar keine Räder", () => {
    expect(bauFuer("Jetski")).toBe("wasserfahrzeug");
  });

  it("stellt die Räder eines Einspurigen auf die Mittellinie", () => {
    const dims = [0.6, 0.9, 1.9];
    const ein = baueGeometrie("einspurig", dims, "box");
    const vier = baueGeometrie("kleinfahrzeug", dims, "box");
    // Radband liegt unter der Mitte des Koerpers
    const y = -dims[1]! * 0.28;
    const bEin = breiteBei(ein.koerper, y, 0.12);
    const bVier = breiteBei(vier.koerper, y, 0.12);
    // Vier Raeder stehen aussen, zwei stehen mittig — das muss man messen koennen
    expect(bVier).toBeGreaterThan(bEin * 1.4);
  });

  it("lässt beim Wasserfahrzeug das Radband ganz weg", () => {
    const dims = [1.1, 0.75, 2.2];
    const ohne = baueGeometrie("wasserfahrzeug", dims, "box");
    const mit = baueGeometrie("kleinfahrzeug", dims, "box");
    const y = -dims[1]! * 0.3;
    expect(breiteBei(ohne.koerper, y, 0.08)).toBeLessThan(breiteBei(mit.koerper, y, 0.08));
  });
});
