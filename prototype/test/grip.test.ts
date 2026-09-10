/**
 * Wächter für das Greifen.
 *
 * Anlass (10.09.2026): Gegriffene Teile blieben in der Luft stehen, während
 * der Bagger wegfuhr, und fielen erst beim Öffnen herunter. Ursache war ein
 * schlafender Körper — der wird nicht integriert, das Gelenk zum kinematischen
 * Greifer zieht ins Leere. Vorher fiel das nicht auf, weil im Haufen ohnehin
 * fast nichts schlief; seit die Schlafhilfe ihn zur Ruhe bringt, greift man
 * regelmäßig nach schlafenden Teilen.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";

beforeAll(async () => {
  await initPhysics();
});

function aufbau(): {
  world: RAPIER.World;
  grip: GripSystem;
  greifer: RAPIER.RigidBody;
} {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const greifer = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0)
  );
  return { world, grip: new GripSystem(world, greifer), greifer };
}

function teil(world: RAPIER.World, x: number, y: number, z: number): RAPIER.RigidBody {
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(30), b);
  return b;
}

describe("Greifen", () => {
  it("ohne Wecken bliebe es liegen — die Gegenprobe", () => {
    // Damit klar ist, dass der Waechter oben etwas Echtes prueft: Ein
    // schlafender Koerper bewegt sich nicht, auch wenn er per Gelenk an einem
    // fahrenden kinematischen Koerper haengt.
    const { world, greifer } = aufbau();
    const b = teil(world, 0, 2.6, 0);
    const j = RAPIER.JointData.fixed(
      { x: 0, y: -0.4, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 }
    );
    world.createImpulseJoint(j, greifer, b, true);
    b.sleep(); // schlafen NACH dem Verbinden, wie im Spiel der Haufen
    for (let i = 0; i < 60; i++) {
      const t = greifer.translation();
      greifer.setNextKinematicTranslation({ x: t.x + 4 / 60, y: t.y, z: t.z });
      world.step();
    }
    expect(b.translation().x, "schlafend haette es mitkommen duerfen").toBeLessThan(0.5);
  });

  it("weckt ein schlafendes Teil beim Fassen", () => {
    const { world, grip } = aufbau();
    const b = teil(world, 0, 2.6, 0);
    b.sleep();
    expect(b.isSleeping(), "Aufbau: das Teil schläft").toBe(true);

    expect(grip.attachBody(b)).toBe(true);
    expect(b.isSleeping(), "schlafend am Gelenk bleibt es in der Luft stehen").toBe(false);
  });

  it("ein gefasstes Teil folgt dem Greifer", () => {
    const { world, grip, greifer } = aufbau();
    const b = teil(world, 0, 2.6, 0);
    b.sleep();
    grip.attachBody(b);

    // Greifer 4 m zur Seite fahren, wie beim Schwenken des Oberwagens.
    // Das Mitfuehren macht seit dem Umbau das Greifsystem je Schritt, nicht
    // mehr ein Gelenk — also muss der Takt hier auch laufen.
    const sensor = new THREE.Vector3();
    for (let i = 0; i < 60; i++) {
      const t = greifer.translation();
      greifer.setNextKinematicTranslation({ x: t.x + 4 / 60, y: t.y, z: t.z });
      grip.update(0.8, true, sensor.set(t.x, t.y, t.z), 1 / 60);
      world.step();
    }
    const p = b.translation();
    expect(p.x, `Teil steht bei x=${p.x.toFixed(2)} statt mitzukommen`).toBeGreaterThan(2.5);
    expect(b.isKinematic(), "das Teil wird kinematisch mitgefuehrt").toBe(true);
  });

  it("die Haltepose zieht das Teil in den Korb, ohne es hochzusaugen", () => {
    const { world, grip, greifer } = aufbau();
    // Seitlich versetzt gefasst, wie wenn man am Rand zupackt
    const b = teil(world, 0.9, 2.2, 0);
    grip.attachBody(b);
    const sensor = new THREE.Vector3();
    for (let i = 0; i < 40; i++) {
      const t = greifer.translation();
      grip.update(0.8, true, sensor.set(t.x, t.y, t.z), 1 / 60);
      world.step();
    }
    const p = b.translation();
    expect(Math.abs(p.x), "Teil haengt weiter neben der Spinne").toBeLessThan(0.5);
    // ... aber die Hoehe bleibt: ein Teil am Boden darf nicht hochgesaugt werden
    expect(p.y, `Hoehe von 2,2 auf ${p.y.toFixed(2)} gewandert`).toBeCloseTo(2.2, 1);
  });

  it("Loslassen gibt den Schwung der Spinne mit", () => {
    const { world, grip, greifer } = aufbau();
    const b = teil(world, 0, 2.6, 0);
    grip.attachBody(b);
    const sensor = new THREE.Vector3();
    // Spinne zieht zur Seite, dann loslassen
    for (let i = 0; i < 10; i++) {
      const t = greifer.translation();
      greifer.setNextKinematicTranslation({ x: t.x + 3 / 60, y: t.y, z: t.z });
      grip.update(0.8, true, sensor.set(t.x, t.y, t.z), 1 / 60);
      world.step();
    }
    grip.update(0.8, false, sensor, 1 / 60); // Taste los
    const v = b.linvel();
    expect(b.isDynamic(), "Teil ist wieder dynamisch").toBe(true);
    expect(v.x, "der Schwung fehlt — das Teil fiele senkrecht").toBeGreaterThan(1.0);
    expect(v.y, "es soll fallen, nicht steigen").toBeLessThanOrEqual(0);
  });

  it("beim Loslassen wird die Schonfrist gemeldet", () => {
    const { world, grip } = aufbau();
    const b = teil(world, 0, 2.6, 0);
    grip.attachBody(b);
    let gemeldet = 0;
    grip.onReleaseGrace = () => gemeldet++;
    grip.update(0.8, false, new THREE.Vector3(), 1 / 60);
    // Ohne die Frist quetschen die zufahrenden Krallen das Teil gegen den Boden
    expect(gemeldet).toBe(1);
  });

  it("fasst nichts, was nicht im Schalenkorb liegt", () => {
    const { world, grip } = aufbau();
    const drin = teil(world, 0, 2.6, 0);
    const draussen = teil(world, 0.9, 2.6, 0);
    // Korbprüfung wie im Spiel: nur was nah an der Achse liegt, zählt
    grip.insideGrapple = (p) => Math.hypot(p.x, p.z) < 0.5;
    // Ein Schritt, damit die Kollider in der Abfragestruktur stehen
    world.step();

    grip.update(0.8, true, new THREE.Vector3(0, 2.6, 0), 1 / 60);

    expect(grip.grippedBodies.map((b) => b.handle)).toContain(drin.handle);
    expect(
      grip.grippedBodies.map((b) => b.handle),
      "ein Teil neben der Spinne wurde gefasst"
    ).not.toContain(draussen.handle);
  });
});
