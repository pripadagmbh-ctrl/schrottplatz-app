/**
 * Wächter für das Abkippen.
 *
 * Anlass (13.09.2026): „die Kipper / Ladefläche heben das Material nicht an,
 * sondern das Material bleibt auf dem Chassis und taucht entsprechend unter
 * der Ladefläche."
 *
 * Gemessen war es genau das, und die Ursache steckte in zwei Kollidern
 * desselben Fahrzeugs: Der Rahmen war ein Kasten von 2,2 m Breite bis y 0,92,
 * der Muldenboden beginnt aber schon bei y 0,49 — 43 cm Überschneidung. Beide
 * sind kinematisch; beim Kippen wurde die Ladung zwischen ihnen eingeklemmt
 * und mit Gewalt herausgedrückt. Der Löser rechnet kinematische Körper mit
 * unendlicher Masse.
 *
 * Geprüft wird die Eigenschaft, nicht der Weg: Bei voller Neigung darf fast
 * nichts mehr obenauf liegen, und die Ladung darf dabei nicht davonfliegen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";

beforeAll(async () => {
  await initPhysics();
});

/** Fester Zufall — die Ladung wird gewürfelt, sonst vergleicht man Rauschen. */
function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

function kippen(): { vmax: number; obenauf: number; teile: number } {
  const zurueck = festerZufall(20260913);
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items));
  m.spawnNow("kipper");
  const v = (m as unknown as { active: Record<string, unknown> }).active;
  const dt = 1 / 60;
  let vmax = 0;
  let obenauf = -1;
  let phase = "";
  let t = -1;
  const q = new THREE.Vector3();
  for (let i = 0; i < 60 * 120 && obenauf < 0; i++) {
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    const p = String(v.phase);
    if (p !== phase) {
      if (p === "tipping") t = 0;
      phase = p;
    }
    if (t < 0) continue;
    for (const it of items.items) {
      const lv = it.body.linvel();
      vmax = Math.max(vmax, Math.hypot(lv.x, lv.y, lv.z));
    }
    t += dt;
    if (t > 5.2) {
      const g = v.group as THREE.Group;
      g.updateWorldMatrix(true, true);
      obenauf = items.items.filter((it) => {
        const pp = it.body.translation();
        q.set(pp.x, pp.y, pp.z);
        g.worldToLocal(q);
        return Math.abs(q.x) < 1.6 && q.z > -4 && q.z < 6 && pp.y > 0.45;
      }).length;
    }
  }
  const teile = items.items.length;
  zurueck();
  return { vmax, obenauf, teile };
}

describe("Kipper", () => {
  it("laedt beim Kippen ab, statt die Ladung auf dem Rahmen liegen zu lassen", () => {
    const r = kippen();
    expect(r.teile).toBeGreaterThan(8);
    /*
     * Mit dem alten, ueberschneidenden Rahmen blieben 12 von 14 Teilen liegen.
     * Ein Rest darf haengen — ein Kipper bekommt nie jedes Stueck heraus, dafuer
     * gibt es das Anziehen danach (`tipCreep`).
     */
    expect(
      r.obenauf,
      `${r.obenauf} von ${r.teile} liegen bei voller Neigung noch obenauf`
    ).toBeLessThanOrEqual(Math.ceil(r.teile * 0.35));
  }, 30000);

  it("schleudert die Ladung nicht davon", () => {
    /*
     * Ein eingeklemmtes Teil wird vom Loeser mit einem einzigen sehr grossen
     * Stoss befreit. Mit der Ueberschneidung waren es 258 km/h; jetzt bleibt
     * es unter 130. Das ist noch viel, aber es ist kein Katapult mehr.
     */
    const r = kippen();
    expect(r.vmax * 3.6, `Ladung erreicht ${(r.vmax * 3.6).toFixed(0)} km/h`).toBeLessThan(130);
  }, 30000);
});
