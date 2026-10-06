/**
 * E-122 — Im Sandkasten kommen die Anlieferer wieder von selbst.
 *
 * Ansage Patrick, 06.10.2026: „LKWs kommen automatisch." Seit E-118 hatte der
 * Block „Simulator: abhängen" in `main.ts` die Einfahrt mit
 * `acceptDeliveries = false` zugemacht. Zurück kommt der VORHANDENE Takt, kein
 * neuer: `shift.intervalFactor` nach losem Schrott, Einfahrt zu ab `JAM_KG`.
 *
 * Zwei Teile: ein Quelltext-Wächter für die Verdrahtung (Muster wie
 * `spielart.test.ts`) und eine Fahrprobe für die Regel „immer nur einer auf
 * dem Abladeplatz" — auch dann, wenn ein Abholer steht.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { wurzel } from "./cssmass";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { FIRST_DELAY_S, NEXT_DELAY_S } from "../src/delivery/routes";

const main = readFileSync(resolve(wurzel, "src/main.ts"), "utf8");
/** Der Block „Simulator: abhängen" — von `if (!BETRIEB) {` bis zur Rückruf-Zeile danach. */
const abhaengen = main.slice(
  main.indexOf("if (!BETRIEB) {\n    const stumm"),
  main.indexOf("vehicles.gegriffen =")
);

describe("Sandkasten: Anlieferer kommen nach dem Takt des Betriebs", () => {
  it("der Block „Simulator: abhängen“ macht die Einfahrt nicht mehr zu", () => {
    expect(abhaengen.length, "Block nicht gefunden").toBeGreaterThan(100);
    expect(abhaengen).not.toMatch(/acceptDeliveries\s*=\s*false/);
  });

  it("die Bildschleife setzt Einfahrt und Takt auch im Sandkasten — aus `shift`", () => {
    // Einmal im Betrieb, einmal im Sandkasten: dieselbe Quelle, kein zweiter Takt.
    const takt = main.match(/vehicles\.intervalFactor\s*=\s*shift\.intervalFactor\(looseKg\)/g) ?? [];
    expect(takt.length, "Takt nur an einer Stelle gesetzt").toBe(2);
    expect(main).toMatch(/vehicles\.acceptDeliveries\s*=\s*!shift\.jammed/);
    /*
     * Ohne Tageszeit: Sonst schlösse um 17:00 das Tor (`TORSCHLUSS_TIME`), und
     * im Sandkasten macht kein Feierabend den nächsten Tag wieder auf — die
     * Einfahrt bliebe für immer zu.
     */
    expect(main).toMatch(/shift\.update\(frameDt,\s*looseKg\)/);
  });
});

describe("Immer nur ein Laster auf dem Abladeplatz", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("solange ein Abholer steht, kommt kein Anlieferer — auch nicht nach Uhr", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
    m.acceptDeliveries = true;
    m.intervalFactor = 0.6; // leerer Platz: der dichteste Takt
    m.spawnNow("abholer");
    // Länger als die längste Wartezeit des Takts, kürzer als die Standzeit (240 s)
    const s = FIRST_DELAY_S + NEXT_DELAY_S[1] * 2.2 + 5;
    for (let i = 0; i < s * 60; i++) {
      m.update(1 / 60);
      world.step();
    }
    expect(m.activeKind).toBe("abholer");
    expect(m.deliveries).toBe(0);
  });
});
