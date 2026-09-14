/**
 * Wächter für die Karosserieform des Wracks.
 *
 * Anlass (10.09.2026): Das Auto war ein glatter Quader von 1,7 x 0,55 x 4,0 m
 * plus Kabinenquader — "sehr eckig". Statt neuer Geometrie werden die
 * Eckpunkte des vorhandenen Quaders verschoben, damit die Beul-Mechanik weiter
 * auf ihrem regelmäßigen Gitter rechnet.
 *
 * Schönheit lässt sich nicht testen. Die Absicht schon: Die Schnauze muss
 * schmaler sein als die Mitte, das Heck ebenfalls, und die Schweller dürfen
 * nicht so breit sein wie die Türhöhe.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { formeKarosserie, baueAnbauteile } from "../src/dismantle/composites";

/** Größte halbe Breite in einem z-Band, optional nur oben oder unten. */
function halbbreite(geo: THREE.BufferGeometry, zVon: number, zBis: number, oben?: boolean): number {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  let max = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    if (z < zVon || z > zBis) continue;
    if (oben === true && y <= 0) continue;
    if (oben === false && y > 0) continue;
    max = Math.max(max, Math.abs(pos.getX(i)));
  }
  return max;
}

function karosserie(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1.7, 0.55, 4.0, 4, 2, 9);
  formeKarosserie(geo);
  return geo;
}

describe("Wrack-Karosserie", () => {
  it("die Schnauze ist schmaler als die Mitte", () => {
    const g = karosserie();
    const mitte = halbbreite(g, -0.5, 0.5);
    const schnauze = halbbreite(g, 1.7, 2.0);
    expect(schnauze).toBeLessThan(mitte);
    // aber kein Bleistift — ein Auto laeuft vorn nicht spitz zu
    expect(schnauze).toBeGreaterThan(mitte * 0.6);
  });

  it("das Heck zieht sich ein, weniger als die Schnauze", () => {
    const g = karosserie();
    const mitte = halbbreite(g, -0.5, 0.5);
    const heck = halbbreite(g, -2.0, -1.7);
    const schnauze = halbbreite(g, 1.7, 2.0);
    expect(heck).toBeLessThan(mitte);
    expect(heck).toBeGreaterThan(schnauze);
  });

  it("die Schweller sind schmaler als die Türhöhe", () => {
    const g = karosserie();
    const unten = halbbreite(g, -0.5, 0.5, false);
    const oben = halbbreite(g, -0.5, 0.5, true);
    expect(unten, "das Auto steht sonst auf einem Brett").toBeLessThan(oben);
  });

  it("die Motorhaube fällt nach vorn ab", () => {
    const g = karosserie();
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    let hoechstesVorn = -Infinity;
    let hoechstesMitte = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (z > 1.7) hoechstesVorn = Math.max(hoechstesVorn, y);
      if (Math.abs(z) < 0.5) hoechstesMitte = Math.max(hoechstesMitte, y);
    }
    expect(hoechstesVorn).toBeLessThan(hoechstesMitte);
  });

  it("die Länge bleibt, das Auto wird nicht gestaucht", () => {
    const g = karosserie();
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.z - b.min.z).toBeCloseTo(4.0, 2);
  });

  it("Anbauteile sitzen am Auto, nicht daneben", () => {
    const gruppe = new THREE.Group();
    baueAnbauteile(gruppe, new THREE.MeshStandardMaterial());
    expect(gruppe.children.length, "keine Anbauteile gebaut").toBeGreaterThan(8);
    const box = new THREE.Box3().setFromObject(gruppe);
    // innerhalb der Fahrzeughuelle (Laenge 4 m, Breite 1,7 m, Hoehe bis Dach)
    expect(box.min.z).toBeGreaterThan(-2.2);
    expect(box.max.z).toBeLessThan(2.2);
    expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThan(1.1);
    expect(box.min.y, "nichts haengt unter dem Auto").toBeGreaterThan(0);
  });
});
