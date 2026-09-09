/**
 * Wächter für den Modellbau der Anlieferfahrzeuge.
 *
 * Anlass (09.09.2026): Der PKW mit Anhänger kam sichtbar ohne Schrott an und
 * liess sich nicht abladen. Ursache war eine Zeile, die nie lief — der Rumpf
 * von `buildVehicleModel` setzt `bedGroup` erst hinter dem Rücksprung für den
 * PKW, also blieb dessen Ladefläche im Weltursprung und wurde nie ans Fahrzeug
 * gehängt. Die Ladung wird über `bedGroup.localToWorld()` platziert und landete
 * darum mitten auf dem Platz.
 *
 * Der Test prüft die Eigenschaft, die dabei verletzt war: Jede Bauart braucht
 * eine Ladefläche, die am Fahrzeug hängt und über dem Boden liegt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildVehicleModel, type VehicleModelContext } from "../src/delivery/vehicleModel";
import { initPhysics } from "../src/physics/physicsWorld";

beforeAll(async () => {
  await initPhysics();
});

/** Bauarten mit ihren Ladeflächenlängen — Werte aus `vehicles.ts`. */
const BAUARTEN: Array<[string, number]> = [
  ["kipper", 6.0],
  ["pritsche", 5.4],
  ["wrack", 5.4],
  ["abholer", 5.4],
  ["pkw", 2.4],
];

function bauen(kind: string, bedLen: number, withCrane = false): VehicleModelContext {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const ctx: VehicleModelContext = {
    kind,
    bedLen,
    withCrane,
    group: new THREE.Group(),
    bedGroup: new THREE.Group(),
    world,
    sideWalls: [],
    tailGate: null,
  };
  teileVomBau = buildVehicleModel(ctx);
  ctx.group.updateWorldMatrix(true, true);
  return ctx;
}

/** Ergebnis des letzten Bauvorgangs — der Kran kommt nur hierüber zurück. */
let teileVomBau: ReturnType<typeof buildVehicleModel>;

describe("Anlieferfahrzeuge", () => {
  for (const [kind, bedLen] of BAUARTEN) {
    it(`${kind}: die Ladefläche hängt am Fahrzeug`, () => {
      const v = bauen(kind, bedLen);
      expect(v.bedGroup.parent, `${kind}: bedGroup wurde nie angehängt`).not.toBeNull();
      // Ohne Elternteil liefert localToWorld Weltkoordinaten aus dem Nichts —
      // genau so landete die Ladung im Ursprung des Platzes.
      let wurzel: THREE.Object3D = v.bedGroup;
      while (wurzel.parent) wurzel = wurzel.parent;
      expect(wurzel, `${kind}: bedGroup hängt nicht unter dem Fahrzeug`).toBe(v.group);
    });

    it(`${kind}: die Ladefläche liegt über dem Boden`, () => {
      const v = bauen(kind, bedLen);
      const p = new THREE.Vector3();
      v.bedGroup.getWorldPosition(p);
      // Eine Ladefläche auf Höhe 0 ist der Ursprung, nicht das Fahrzeug.
      expect(p.y, `${kind}: Ladefläche bei y=${p.y.toFixed(2)}`).toBeGreaterThan(0.5);
      expect(p.y, `${kind}: Ladefläche unrealistisch hoch`).toBeLessThan(2.0);
    });

    it(`${kind}: das Fahrzeug hat sichtbare Teile`, () => {
      const v = bauen(kind, bedLen);
      let meshes = 0;
      v.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes++;
      });
      expect(meshes, `${kind}: nur ${meshes} Meshes`).toBeGreaterThan(5);
    });
  }

  it("ohne Händler kein Kran", () => {
    bauen("kipper", 6.0, false);
    expect(teileVomBau.crane).toBeNull();
  });

  it("der Händlerkran steht auf dem Fahrzeug, nicht im Boden", () => {
    const v = bauen("kipper", 6.0, true);
    const kran = teileVomBau.crane;
    expect(kran, "Kran wurde nicht gebaut").not.toBeNull();
    v.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(kran!);
    // Der Kran sitzt auf dem Rahmen — nichts davon darf unter den LKW ragen
    expect(box.min.y, `Kran reicht bis y=${box.min.y.toFixed(2)}`).toBeGreaterThan(0.8);
    // ... und er soll ein LKW-Kran bleiben, kein Baukran
    expect(box.max.y, `Kran ${box.max.y.toFixed(2)} m hoch`).toBeLessThan(4.0);
    // Eingeklappt liegt der Ausleger über der Ladefläche, also hinter der Säule
    expect(box.min.z, "Ausleger zeigt nach hinten über die Fläche").toBeLessThan(2.0);
  });

  it("das Schwenken bringt den Ausleger zur Seite", () => {
    const v = bauen("kipper", 6.0, true);
    const kran = teileVomBau.crane!;
    v.group.updateWorldMatrix(true, true);
    const vorher = new THREE.Box3().setFromObject(kran).getCenter(new THREE.Vector3());
    kran.rotation.y = THREE.MathUtils.degToRad(78);
    v.group.updateWorldMatrix(true, true);
    const nachher = new THREE.Box3().setFromObject(kran).getCenter(new THREE.Vector3());
    // Quer versetzt statt nur gedreht: der Ausleger hängt danach neben dem LKW
    expect(Math.abs(nachher.x - vorher.x), "Ausleger bleibt über der Fläche stehen").toBeGreaterThan(0.8);
  });

  it("der PKW-Anhänger trägt seine Ladung dort, wo der Boden ist", () => {
    const v = bauen("pkw", 2.4);
    // Die Ladung wird bei lokal z zwischen 0,15 und bedLen-0,15 gesetzt
    // (siehe `loadCargo`). Diese Spanne muss auf dem Anhängerboden liegen.
    const vorne = v.bedGroup.localToWorld(new THREE.Vector3(0, 0, 0.15));
    const hinten = v.bedGroup.localToWorld(new THREE.Vector3(0, 0, 2.25));
    for (const p of [vorne, hinten]) {
      expect(p.z, "Ladung sitzt auf dem Anhänger, nicht daneben").toBeGreaterThan(-0.5);
      expect(p.z, "Ladung sitzt auf dem Anhänger, nicht am Zugfahrzeug").toBeLessThan(3.0);
    }
  });
});
