import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * Spinne Schritt 1 — weicher Zinken-Kontakt (E-043): Die Spinne bleibt kinematisch (Daumen = Spinne), aber
 *  - ein Teil am Korbrand wird beim Schliessen nach innen GESCHOBEN (≥ 0,15 m), nicht geschleudert (< 3 m/s),
 *  - ein Teil, das nicht ausweichen kann, landet nie im Boden und fliegt nie vom Platz,
 *  - geschobene Masse bremst das Schliessen (clawLoadFactor < 1 waehrend des Kontakts).
 */
beforeAll(async () => { await initPhysics(); });

function aimSensorAt(sim: Simulation, x: number, y: number, z: number): void {
  const s = sim.world.excavator; const b = sim.data.balancing.excavator as Record<string, number | number[]>; const bp = b["boomPivot"] as number[];
  const boomLen = Number(b["boomLenM"]), stickLen = Number(b["stickLenM"]); const drop = Number(b["grappleLinkM"]) + Number(b["palmOffsetY"]) + Number(b["palmToSensorM"]);
  const dx = x - s.pos.x, dz = z - s.pos.z; s.cab = Math.atan2(dx, dz) - s.heading; const reach = Math.hypot(dx, dz) - (bp[2] ?? 0); const height = y + drop - (bp[1] ?? 0);
  const d = Math.hypot(reach, height); const cosStick = Math.max(-1, Math.min(1, (d * d - boomLen * boomLen - stickLen * stickLen) / (2 * boomLen * stickLen)));
  const stick = -Math.acos(cosStick); const boom = Math.atan2(height, reach) - Math.atan2(stickLen * Math.sin(stick), boomLen + stickLen * Math.cos(stick));
  s.boom = boom; s.stick = stick; sim.excavator.computePose(s); sim.excavator.resetPendulum();
}

describe("Zinken-Kontakt", () => {
  it("Teil am Korbrand wird nach innen geschoben, nicht geschleudert; Schliessen wird gebremst", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    // Teil 1,3 m neben der Korbmitte auf freier Flaeche (z = −6), Spinne offen darueber
    const item = sim.scrap.spawn({ materialId: "steel", shapeId: "block", pos: { x: 1.3, y: 0.3, z: -6 } })!;
    sim.run(90);
    const b = sim.physics.safeBody(item.bodyHandle)!; const x0 = b.translation().x;
    sim.world.excavator.grapple = 0; sim.control.grapple = 0;
    aimSensorAt(sim, 0, 0.5, -6); sim.run(5);
    let maxSpeed = 0, minFactor = 1;
    sim.control.grapple = 1;
    for (let i = 0; i < 70; i++) { sim.step(); minFactor = Math.min(minFactor, sim.excavator.clawLoadFactor); if (item.state !== "loose") break; const v = b.linvel(); maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z)); }
    const t = b.translation();
    expect(maxSpeed, "geschoben, nicht geschleudert").toBeLessThan(3);
    expect(t.y, "nicht im Boden").toBeGreaterThan(-0.05);
    expect(sim.level.insideYard(t.x, t.z)).toBe(true);
    expect(minFactor, "Schliessbremse").toBeLessThan(1);
    // nach innen (Richtung Korbmitte x=0) oder gegriffen
    const inward = x0 - t.x;
    expect(inward > 0.15 || sim.grip.heldIds.includes(item.id), `nach innen geschoben (${inward.toFixed(2)} m) oder gegriffen`).toBe(true);
    sim.dispose();
  });

  it("Haufen: Griff auf einen Haufen — Material wird geschoben, nicht geschossen", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    sim.scrap.spawnPile("intake", 60, 42); sim.settle();
    const zone = sim.level.zone("intake");
    let top = 0; for (const it of sim.world.items.values()) top = Math.max(top, it.pos.y);
    // Spinne knapp UEBER dem Haufen ansetzen (nicht hinein) und nur schliessen: geprueft wird der Zinken-Kontakt.
    // Das Eintauchen in den Haufen bleibt bewusst aussen vor — dagegen hilft erst das Aufsetzen per Strahlen (Schritt 2).
    sim.world.excavator.grapple = 0; sim.control.grapple = 0;
    aimSensorAt(sim, zone.x, top + 0.15, zone.z); sim.run(10);
    let maxSpeed = 0, minY = Infinity;
    sim.control.grapple = 1;
    for (let i = 0; i < 90; i++) {
      sim.step();
      for (const it of sim.world.items.values()) {
        if (it.state !== "loose") continue;
        const bb = sim.physics.safeBody(it.bodyHandle)!; const v = bb.linvel();
        maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z)); minY = Math.min(minY, bb.translation().y);
      }
    }
    expect(maxSpeed, "kein Teil geschossen").toBeLessThan(6);
    expect(minY, "kein Teil im Boden").toBeGreaterThan(-0.15);
    for (const it of sim.world.items.values()) expect(sim.level.insideYard(it.pos.x, it.pos.z)).toBe(true);
    expect(sim.grip.count, "Griff hat gefasst").toBeGreaterThanOrEqual(1);
    sim.dispose();
  });
});
