import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * M3-Wächter für Pendel, Greif-Magnet und Zielhilfe (Briefing Kap. 5.4, 6.1, 14.1).
 * Alles kopflos: keine Ansicht, kein DOM.
 */
beforeAll(async () => { await initPhysics(); });

/** Arm so stellen, dass die Korbmitte über (x, z) in Höhe y liegt — Teleport, nur für Tests. */
function aimSensorAt(sim: Simulation, x: number, y: number, z: number): void {
  const s = sim.world.excavator;
  const b = sim.data.balancing.excavator as Record<string, number | number[]>;
  const bp = b["boomPivot"] as number[];
  const boomLen = Number(b["boomLenM"]), stickLen = Number(b["stickLenM"]);
  const drop = Number(b["grappleLinkM"]) + Number(b["palmOffsetY"]) + Number(b["palmToSensorM"]);
  const dx = x - s.pos.x, dz = z - s.pos.z;
  s.cab = Math.atan2(dx, dz) - s.heading;
  const reach = Math.hypot(dx, dz) - (bp[2] ?? 0);
  const height = y + drop - (bp[1] ?? 0);
  const d = Math.hypot(reach, height);
  const cosStick = Math.max(-1, Math.min(1, (d * d - boomLen * boomLen - stickLen * stickLen) / (2 * boomLen * stickLen)));
  const stick = -Math.acos(cosStick);
  const boom = Math.atan2(height, reach) - Math.atan2(stickLen * Math.sin(stick), boomLen + stickLen * Math.cos(stick));
  s.boom = boom; s.stick = stick;
  sim.excavator.resetPendulum();
  sim.excavator.computePose(s);
}

describe("Pendel der Spinne", () => {
  it("schwingt beim Schwenken aus, bleibt unter der Kappung und beruhigt sich nach dem Stopp", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    aimSensorAt(sim, 0, 2.5, 8);
    sim.run(30);
    sim.control.cab = 1; sim.run(120); // 2 s schwenken
    const p = sim.excavator.pose;
    const swingWhile = Math.hypot(p.swingX, p.swingZ);
    expect(swingWhile, "Pendel beim Schwenken").toBeGreaterThan(0.02);
    expect(swingWhile).toBeLessThanOrEqual(Number(sim.data.balancing.assist["pendulumMaxRad"]) * Math.SQRT2 + 1e-9);
    sim.control.cab = 0; sim.run(240); // 4 s Ruhe
    expect(Math.hypot(p.swingX, p.swingZ), "Pendel nach 4 s Ruhe").toBeLessThan(0.03);
    // Sensor hängt mit: bei Neigung 0 liegt er lotrecht unter dem Kardan
    expect(Math.hypot(p.sensorPos.x - p.grapplePos.x, p.sensorPos.z - p.grapplePos.z)).toBeLessThan(0.05);
    sim.dispose();
  });

  it("Teleport (Laden/Spawn) erzeugt keinen Riesenimpuls", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    aimSensorAt(sim, 0, 2.5, 8); sim.run(5);
    sim.world.excavator.cab = Math.PI; sim.run(1); // harter Sprung
    const p = sim.excavator.pose;
    expect(Math.hypot(p.swingX, p.swingZ)).toBeLessThan(0.05);
    sim.dispose();
  });
});

describe("Greif-Magnet (Snap)", () => {
  it("gleitet auf ein einzelnes Teil knapp außerhalb des Korbs und greift es", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    const item = sim.scrap.spawn({ materialId: "steel", shapeId: "block", pos: { x: 0, y: 0.4, z: 8 } })!;
    sim.run(90);
    const t = sim.physics.safeBody(item.bodyHandle)!.translation();
    // Korb 1,6 m seitlich neben das Teil setzen (Korbrand ≈ 1,3 m + Snap 0,5 m)
    sim.world.excavator.grapple = 0;
    aimSensorAt(sim, t.x + 1.6, t.y + 0.3, t.z);
    const before = Math.hypot(sim.excavator.pose.sensorPos.x - t.x, sim.excavator.pose.sensorPos.z - t.z);
    sim.control.grapple = 1; sim.run(2);
    expect(sim.grip.snapCount, "Snap ausgelöst").toBe(1);
    expect(sim.excavator.snapping).toBe(true);
    sim.run(30); // > 0,25 s
    expect(sim.excavator.snapping).toBe(false);
    const after = Math.hypot(sim.excavator.pose.sensorPos.x - t.x, sim.excavator.pose.sensorPos.z - t.z);
    expect(after, `Abstand vorher ${before.toFixed(2)} m`).toBeLessThan(0.3);
    sim.run(60);
    expect(sim.grip.heldIds).toContain(item.id);
    sim.dispose();
  });

  it("kein Snap bei zwei Kandidaten oder wenn schon ein Teil im Korb liegt", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    const a = sim.scrap.spawn({ materialId: "steel", shapeId: "block", pos: { x: 0, y: 0.4, z: 8 } })!;
    sim.scrap.spawn({ materialId: "steel", shapeId: "block", pos: { x: 0, y: 0.4, z: 8.8 } });
    sim.run(90);
    const t = sim.physics.safeBody(a.bodyHandle)!.translation();
    sim.world.excavator.grapple = 0;
    aimSensorAt(sim, t.x + 1.6, t.y + 0.3, t.z + 0.4); // beide ≈ 1,65 m seitlich
    sim.control.grapple = 1; sim.run(2);
    expect(sim.grip.snapCount).toBe(0);
    sim.dispose();
  });
});

describe("Zielhilfe (AimSystem)", () => {
  it("meldet das Teil unter der Spinne, dann Ampel über dem Container", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    const item = sim.scrap.spawn({ materialId: "copper", shapeId: "pipe", pos: { x: 0, y: 0.4, z: 7 } })!;
    sim.run(90);
    const t = sim.physics.safeBody(item.bodyHandle)!.translation();
    sim.world.excavator.grapple = 0;
    aimSensorAt(sim, t.x, t.y + 1.5, t.z); sim.run(2);
    const a = sim.aim.state;
    expect(a.hoverItemId).toBe(item.id); expect(a.hoverMaterialId).toBe("copper"); expect(a.verdict).toBe("item");
    expect(a.y).toBeGreaterThan(0.05); // Strahl trifft das Teil, nicht den Boden
    // greifen
    aimSensorAt(sim, t.x, t.y + 0.3, t.z); sim.control.grapple = 1; sim.run(60);
    expect(sim.grip.heldIds).toContain(item.id);
    expect(a.heldMaterialId).toBe("copper"); expect(a.heldKg).toBeGreaterThan(0);
    // über die Kupferbox → ok, über die Alubox → wrong, über Störstoff → tolerated
    const box = (id: string) => sim.data.level.containers.find((c) => c.id === id)!.rect;
    for (const [id, want] of [["box_copper", "ok"], ["box_alu", "wrong"], ["box_contaminant", "tolerated"]] as const) {
      const r = box(id); aimSensorAt(sim, r.x, 3, r.z); sim.run(2);
      expect(a.containerId, id).toBe(id); expect(a.verdict, id).toBe(want);
    }
    sim.dispose();
  });
});
