import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * Wächter-Tests M1 (Briefing Kap. 6.5, 19; CLAUDE.md „Performance-Wächter"):
 *  - 150 Teile, 600 Schritte → alle schlafen, Physikzeit pro Schritt unter 0,3 ms
 *  - Vorsimulation liefert einen schlafenden Haufen vor dem ersten Bild
 */
beforeAll(async () => { await initPhysics(); });

describe("Haufen schläft (QA A2 §5)", () => {
  it("150 Teile auf der Annahmefläche schlafen nach 600 Schritten; Physik < 0,3 ms/Schritt", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const n = sim.scrap.spawnPile("intake", 150, 42);
    expect(n).toBe(150);
    sim.run(600);
    const st = sim.physics.stats();
    expect(st.bodies).toBe(150);
    expect(st.awake, "wache Körper nach 10 s").toBeLessThanOrEqual(0);
    // Physikzeit bei schlafendem Haufen: Mittel über 60 weitere Schritte
    let ms = 0;
    for (let i = 0; i < 60; i++) { sim.step(); ms += sim.physics.stats().stepMs; }
    expect(ms / 60, "ms pro Schritt schlafend").toBeLessThan(0.3);
    // Kein Teil ist durch den Boden gefallen oder vom Platz
    for (const it of sim.scrap.items()) {
      expect(it.pos.y).toBeGreaterThan(-0.1);
      expect(sim.level.insideYard(it.pos.x, it.pos.z)).toBe(true);
    }
    sim.dispose();
  });

  it("settle() liefert vor dem ersten Bild einen schlafenden Haufen", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    sim.scrap.spawnPile("intake", 150, 7);
    const steps = sim.settle();
    expect(steps, "Vorsimulation endet, sobald es ruhig ist").toBeLessThan(600);
    expect(sim.physics.stats().awake).toBe(0);
    // und der Haufen bleibt ruhig: nach 120 weiteren Schritten sind höchstens 5 wach
    sim.run(120);
    expect(sim.physics.stats().awake).toBeLessThanOrEqual(5);
    sim.dispose();
  });

  it("Massen sind plausibel: Stahlträger schwerer als Alu-Felge, Deckel greift bei 300", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const beam = sim.scrap.spawn({ materialId: "steel", shapeId: "beam", pos: { x: 0, y: 1, z: 0 } })!;
    const rim = sim.scrap.spawn({ materialId: "alu", shapeId: "rim", pos: { x: 2, y: 1, z: 0 } })!;
    expect(beam.massKg).toBeGreaterThan(20); expect(beam.massKg).toBeLessThan(700);
    expect(rim.massKg).toBeGreaterThan(2); expect(rim.massKg).toBeLessThan(30);
    let spawned = 2;
    for (let i = 0; i < 400; i++) if (sim.scrap.spawn({ materialId: "steel", pos: { x: (i % 20) - 10, y: 5 + Math.floor(i / 20), z: 0 } })) spawned++;
    expect(spawned).toBe(300);
    sim.dispose();
  });
});
