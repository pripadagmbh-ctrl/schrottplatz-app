import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics, RAPIER } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { Rng } from "@/shared/rng";

/**
 * Fuzz-Wächter (Architektur Kap. 9, Ebene 4): zufällige Stöße auf zufällige Teile über 6 000 Schritte.
 * Kein Ausreißer über 20 m/s (Prototyp: 12× über 20 m/s, Spitze 55 m/s), kein NaN, nichts verlässt den Platz.
 */
beforeAll(async () => { await initPhysics(); });

describe("Fuzz: Haufen unter Stößen", () => {
  it("6 000 Schritte mit Zufallsimpulsen — keine Explosion, kein NaN, alles auf dem Platz", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    sim.scrap.spawnPile("intake", 120, 99);
    sim.settle();
    const rng = new Rng(2024);
    const items = [...sim.scrap.items()];
    let maxSpeed = 0;
    for (let step = 0; step < 6000; step++) {
      if (step % 30 === 0) {
        const it = rng.pick(items);
        const b = sim.physics.safeBody(it.bodyHandle);
        if (b) {
          // Stoß wie ein Greifer-Schubs: bis 3 m/s Geschwindigkeitsänderung
          const dv = rng.range(0.5, 3);
          const ang = rng.range(0, Math.PI * 2);
          b.applyImpulse(new RAPIER.Vector3(Math.cos(ang) * dv * b.mass(), rng.range(0, 1.5) * b.mass(), Math.sin(ang) * dv * b.mass()), true);
        }
      }
      sim.step();
      if (step % 10 === 0) {
        for (const it of items) {
          const b = sim.physics.safeBody(it.bodyHandle);
          if (!b) continue;
          const v = b.linvel();
          const speed = Math.hypot(v.x, v.y, v.z);
          expect(Number.isFinite(speed), `NaN bei ${it.id}`).toBe(true);
          if (speed > maxSpeed) maxSpeed = speed;
          expect(sim.level.insideYard(it.pos.x, it.pos.z), `${it.id} hat den Platz verlassen`).toBe(true);
          expect(it.pos.y, `${it.id} unter dem Boden`).toBeGreaterThan(-0.5);
        }
      }
    }
    expect(maxSpeed, "Spitzengeschwindigkeit").toBeLessThan(20);
    sim.dispose();
  });
});
