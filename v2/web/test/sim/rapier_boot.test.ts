import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics, RAPIER } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import type { HeartbeatSystem } from "@/sim/systems/HeartbeatSystem";

/**
 * Beweis für die Werkzeugkette: Rapier läuft in Node ohne Browser, die Simulation steppt,
 * safeBody liefert null nach Entfernen (Muster gegen QA-Absturz H1). Die echten Szenario-Tests
 * (150 Teile schlafen, Greifen ohne Ausreißer) kommen in M1/M2.
 */
beforeAll(async () => { await initPhysics(); });

describe("Kopflose Simulation", () => {
  it("steppt 120 Schritte und zählt 2 s", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    sim.run(120);
    expect(sim.world.step).toBe(120);
    expect(sim.scheduler.get<HeartbeatSystem>("heartbeat").seconds).toBeCloseTo(2, 5);
    sim.dispose();
  });
  it("ein fallender Würfel landet auf dem Boden und schläft ein", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const w = sim.physics.world;
    w.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 22.5).setTranslation(0, -0.5, 0));
    const body = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3, 0));
    w.createCollider(RAPIER.ColliderDesc.cuboid(0.25, 0.25, 0.25).setMass(40), body);
    sim.run(600); // 10 s
    const b = sim.physics.safeBody(body.handle)!;
    expect(b).not.toBeNull();
    expect(b.translation().y).toBeCloseTo(0.25, 1);
    expect(b.isSleeping()).toBe(true);
    expect(sim.physics.stats().stepMs).toBeLessThan(2);
    sim.dispose();
  });
  it("safeBody liefert null nach requestRemove + Schritt (QA H1-Muster)", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const body = sim.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1, 0));
    const h = body.handle;
    sim.physics.requestRemove(h);
    sim.step();
    expect(sim.physics.safeBody(h)).toBeNull();
    expect(() => sim.run(10)).not.toThrow();
    sim.dispose();
  });
});
