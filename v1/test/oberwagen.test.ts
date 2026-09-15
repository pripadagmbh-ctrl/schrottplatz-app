/**
 * Wächter für den Oberwagen — Paket 3 aus E-025, Frage 2 von Patrick am
 * 15.09.2026 bejaht („Geländer ja, mit Aufstieg, Knieleiste bleibt drin").
 *
 * DER BEFUND: Der ganze Oberwagen hatte **120 Dreiecke** — Motorhaube 12,
 * Gegengewicht 12, acht Lüftungsschlitze à 12 — und kostete dafür **10 Netze**,
 * acht davon für die acht Schlitze. Das ist das Musterbeispiel für das, was
 * E-025 abstellt: viel Aufwand, wenig zu sehen.
 *
 * Was hier still verlorengehen kann: die drei Netze (ein Detail als eigenes
 * Mesh, und es sind vier), die Höhe der Deckplatte (darauf steht alles) und
 * das Geländer (es ist das, was eine Umschlagmaschine ausmacht).
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { DECK_OBEN } from "../src/excavator/oberwagenParts";

let scene: THREE.Scene;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
});

function finde(name: string): THREE.Mesh {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o as THREE.Mesh;
}

/** Alle Netze, die direkt am Oberwagen hängen (ohne Kabine und Ausleger). */
function oberwagenNetze(): string[] {
  const ow = scene.getObjectByName("05_OBERWAGEN")!;
  const raus: string[] = [];
  for (const k of ow.children) if (k instanceof THREE.Mesh) raus.push(k.name);
  return raus.sort();
}

describe("Oberwagen", () => {
  it("besteht aus genau drei Netzen", () => {
    /*
     * Lack (Haube, Laufblech, Tank), Stahl (Deckplatte, Drehkranzdeckel,
     * Gitter, Gegengewicht, Geländer, Auspuff) und Leuchten. Vorher waren es
     * zehn plus die Deckplatte.
     */
    expect(oberwagenNetze(), "Netze direkt am Oberwagen").toEqual([
      "04_DREHKRANZ",
      "05_LEUCHTEN",
      "05_MOTORHAUBE",
    ]);
  });

  it("die Motorhaube ist gestuft und behält ihre Oberkante", () => {
    /*
     * Die Stufe ist der Unterschied zwischen „Kiste" und „Motorraum": unten
     * 0,72 m hoch und 2,50 m breit, oben schmaler. Die OBERKANTE (1,355 im
     * Oberwagen-Frame) bleibt, wo sie war — sonst ändert sich die Silhouette
     * der ganzen Maschine.
     */
    const pos = (finde("05_MOTORHAUBE").geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let breiteUnten = 0;
    let breiteOben = 0;
    let oben = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = Math.abs(pos.getX(i));
      const z = pos.getZ(i);
      if (z > -0.15) continue; // nur die Haube, nicht das Laufblech
      oben = Math.max(oben, y);
      if (Math.abs(y - (DECK_OBEN + 0.4)) < 0.05) breiteUnten = Math.max(breiteUnten, x);
      if (y > 1.2) breiteOben = Math.max(breiteOben, x);
    }
    expect(oben, "Oberkante der Haube").toBeCloseTo(1.355, 3);
    expect(breiteUnten * 2, "Breite der unteren Stufe").toBeGreaterThan(2.4);
    expect(breiteOben * 2, "Breite der oberen Stufe").toBeLessThan(breiteUnten * 2 - 0.2);
  });

  it("das Geländer steht auf dem Laufgang und ist 0,90 m hoch", () => {
    /*
     * Es steht NICHT an der Deckkante: Zwischen Haube (±1,25) und Deckkante
     * (±1,45) bleiben 20 cm, darauf geht niemand, und im Bild klebte das
     * Geländer an der Haubenflanke. Es steht auf der Schulter der gestuften
     * Haube (y 1,075) — dort ist der Laufgang.
     */
    const pos = (finde("04_DREHKRANZ").geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let oben = -Infinity;
    let pfostenFuss = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.abs(pos.getX(i));
      /*
       * Nur der Geländerstreifen: x um 1,08, hinter der Kabine (z < −0,30) und
       * VOR dem Gegengewicht (z > −1,60). Dessen Fase liegt bei x 1,05 und
       * y 0,01 und wäre sonst der tiefste Punkt im Fenster — der Test hätte
       * dann das Gegengewicht vermessen und nicht das Geländer.
       */
      if (Math.abs(x - 1.08) > 0.08) continue;
      const z = pos.getZ(i);
      if (z > -0.3 || z < -1.6) continue;
      oben = Math.max(oben, pos.getY(i));
      pfostenFuss = Math.min(pfostenFuss, pos.getY(i));
    }
    expect(pfostenFuss, "Fuß des Geländers auf der Haubenschulter").toBeCloseTo(
      DECK_OBEN + 0.72,
      2
    );
    expect(oben - pfostenFuss, "Höhe des Handlaufs").toBeCloseTo(0.93, 2);
  });

  it("die Maschine hat jetzt Licht", () => {
    /*
     * Der Kipper hat Scheinwerfer, Rückleuchten und Dachleuchten
     * (`delivery/vehicleModel.ts`), der Bagger hatte kein einziges Licht.
     */
    const l = finde("05_LEUCHTEN");
    const mat = l.material as THREE.MeshStandardMaterial;
    expect(mat.emissiveIntensity, "Leuchten leuchten nicht").toBeGreaterThan(0);
    expect(scene.getObjectByName("07_AUSLEGER_LEUCHTEN"), "Arbeitslicht am Ausleger").toBeDefined();
  });

  it("nichts am Oberwagen wirft doppelt Schatten, was man nicht sieht", () => {
    /*
     * Jedes schattenwerfende Netz kostet zwei Zeichenrufe. Die Leuchten sind
     * flache Platten in der Silhouette der Haube — sie brauchen keinen.
     */
    expect(finde("05_LEUCHTEN").castShadow, "Leuchten werfen Schatten").toBe(false);
  });
});
