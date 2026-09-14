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

  it("PKW und Anhänger sind zwei Körper mit Gelenk an der Kupplung", () => {
    const v = bauen("pkw", 2.4);
    const anhaenger = teileVomBau.trailer;
    expect(anhaenger, "kein Anhänger als eigene Gruppe").not.toBeNull();
    // Die Ladefläche gehört an den Anhänger, nicht an den Rahmen — sonst bliebe
    // die Ladung beim Einlenken in der Luft stehen
    let wurzel: THREE.Object3D | null = v.bedGroup.parent;
    let unterAnhaenger = false;
    while (wurzel) {
      if (wurzel === anhaenger) unterAnhaenger = true;
      wurzel = wurzel.parent;
    }
    expect(unterAnhaenger, "Ladefläche hängt nicht am Anhänger").toBe(true);
  });

  it("das Gelenk sitzt an der Kupplung, nicht in der Anhängermitte", () => {
    const v = bauen("pkw", 2.4);
    const anhaenger = teileVomBau.trailer!;
    v.group.updateWorldMatrix(true, true);
    const kupplung = anhaenger.getWorldPosition(new THREE.Vector3()).clone();
    const achseVorher = v.bedGroup.getWorldPosition(new THREE.Vector3()).clone();

    anhaenger.rotation.y = 0.5;
    v.group.updateWorldMatrix(true, true);
    const kupplungNachher = anhaenger.getWorldPosition(new THREE.Vector3());
    const achseNachher = v.bedGroup.getWorldPosition(new THREE.Vector3());

    // Der Kupplungspunkt bleibt stehen ...
    expect(kupplungNachher.distanceTo(kupplung)).toBeLessThan(1e-6);
    // ... und der Anhänger schwenkt darum herum
    expect(achseNachher.distanceTo(achseVorher)).toBeGreaterThan(0.4);
  });

  it("das Zugfahrzeug steht vor dem Anhänger, ohne ihn zu überlappen", () => {
    const v = bauen("pkw", 2.4);
    const anhaenger = teileVomBau.trailer!;
    v.group.updateWorldMatrix(true, true);
    // Karosserie ist das breiteste Teil am Rahmen; der Anhänger liegt dahinter
    const anhaengerBox = new THREE.Box3().setFromObject(anhaenger);
    const kupplungZ = anhaenger.position.z;
    // Vorher stand das Heck des Wagens über dem Anhängerboden — der Anhänger
    // darf nicht über die Kupplung hinausragen
    expect(anhaengerBox.max.z).toBeLessThanOrEqual(kupplungZ + 0.1);
  });

  it("die Aufbauten unterscheiden sich in der Wandhöhe", () => {
    // Haendler fahren nicht alle denselben Wagen. Gemessen wird die Huelle des
    // Fahrzeugs: Ein Rungen- oder Kofferaufbau ragt hoeher als flache
    // Bordwaende.
    const hoehe = (stil: "flach" | "rungen" | "koffer"): number => {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const ctx: VehicleModelContext = {
        kind: "pritsche",
        bedLen: 5.4,
        bodyStyle: stil,
        group: new THREE.Group(),
        bedGroup: new THREE.Group(),
        world,
        sideWalls: [],
        tailGate: null,
      };
      buildVehicleModel(ctx);
      ctx.group.updateWorldMatrix(true, true);
      return new THREE.Box3().setFromObject(ctx.bedGroup).max.y;
    };
    const flach = hoehe("flach");
    const rungen = hoehe("rungen");
    const koffer = hoehe("koffer");
    expect(rungen, "Rungen ragen nicht hoeher als flache Bordwaende").toBeGreaterThan(flach);
    expect(koffer, "Koffer ragt nicht hoeher als Rungen").toBeGreaterThan(rungen);
  });

  it("der PKW-Anhänger trägt seine Ladung dort, wo der Boden ist", () => {
    const v = bauen("pkw", 2.4);
    // Die Ladung wird bei lokal z zwischen 0,15 und bedLen-0,15 gesetzt
    // (siehe `loadCargo`). Diese Spanne muss auf dem Anhängerboden liegen.
    const anhaenger = teileVomBau.trailer!;
    const boden = new THREE.Box3().setFromObject(anhaenger);
    const vorne = v.bedGroup.localToWorld(new THREE.Vector3(0, 0, 0.15));
    const hinten = v.bedGroup.localToWorld(new THREE.Vector3(0, 0, 2.25));
    for (const p of [vorne, hinten]) {
      expect(p.z, "Ladung liegt hinter dem Anhänger").toBeGreaterThan(boden.min.z - 0.2);
      expect(p.z, "Ladung liegt vor der Kupplung, also am Zugfahrzeug").toBeLessThan(
        boden.max.z + 0.2
      );
    }
  });
});
