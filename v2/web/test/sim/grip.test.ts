import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { Rng } from "@/shared/rng";
import { CLAW_OPEN_SPLAY } from "@/shared/clawGeometry";

/**
 * M2-Wächter (Briefing Kap. 6.2 „Fertig, wenn"): greifen → heben → schwenken → tragen → ablegen,
 * 100× mit Zufallslagen, ohne Ausreißer > 5 m/s beim Loslassen und ohne Durchdringung des Bodens.
 * Dazu: Bodenanschlag, Widerstand nur bei Kontakt, Entfernen eines gehaltenen Teils (H1).
 */
beforeAll(async () => { await initPhysics(); });

/** Teleport-Helfer: Arm so stellen, dass die Korbmitte über (x, z) in Höhe y liegt — nur für Tests. */
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
  // Zwei-Glieder-IK (Kosinussatz)
  const d = Math.hypot(reach, height);
  const cosStick = Math.max(-1, Math.min(1, (d * d - boomLen * boomLen - stickLen * stickLen) / (2 * boomLen * stickLen)));
  const stick = -Math.acos(cosStick);
  const boom = Math.atan2(height, reach) - Math.atan2(stickLen * Math.sin(stick), boomLen + stickLen * Math.cos(stick));
  s.boom = boom; s.stick = stick;
  sim.excavator.computePose(s);
}

describe("Greifen kinematisch", () => {
  it("100× greifen, heben, 180° schwenken, tragen, ablegen — kein Ausreißer, keine Durchdringung", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const rng = new Rng(11);
    let grabbed = 0, maxRelease = 0;
    for (let i = 0; i < 100; i++) {
      // Teil zufällig vor den Bagger legen
      const px = rng.range(-2, 2), pz = rng.range(5, 8);
      const shape = rng.pick(["beam", "block", "pipe", "sheet"] as const);
      const mat = shape === "pipe" ? "copper" : "steel";
      const item = sim.scrap.spawn({ materialId: mat, shapeId: shape, pos: { x: px, y: 0.6, z: pz } })!;
      sim.run(90); // liegt
      const t = sim.physics.safeBody(item.bodyHandle)!.translation();
      // Korb über das Teil, dann schließen
      sim.world.excavator.grapple = 0; sim.control.grapple = 0;
      aimSensorAt(sim, t.x, t.y + 0.3, t.z);
      sim.control.grapple = 1; sim.run(45); // 0,75 s schließen
      if (!sim.grip.heldIds.includes(item.id)) { sim.control.grapple = -1; sim.run(30); sim.scrap.requestRemove(item.id, "cleanup"); sim.run(2); continue; }
      grabbed++;
      // heben 3 m, 180° schwenken, ablegen — alles über den ControlFrame
      sim.control.boom = 1; sim.run(90); sim.control.boom = 0;
      sim.control.cab = 1; sim.run(270); sim.control.cab = 0; // 4,5 s × 40°/s × Lastfaktor ≥ 90°
      sim.control.boom = -1; sim.run(60); sim.control.boom = 0;
      const heldBody = sim.physics.safeBody(item.bodyHandle)!;
      expect(item.state).toBe("held");
      expect(heldBody.translation().y, "gehaltenes Teil über dem Boden (sitzt seit 08.09. auf Spitzenhöhe, nicht mehr auf Sensorhöhe)").toBeGreaterThan(0);
      sim.control.grapple = -1; sim.run(3);
      expect(item.state).toBe("loose");
      const v = heldBody.linvel(); const speed = Math.hypot(v.x, v.y, v.z);
      maxRelease = Math.max(maxRelease, speed);
      sim.run(120);
      expect(heldBody.translation().y, `Teil ${i} unter dem Boden`).toBeGreaterThan(-0.1);
      sim.scrap.requestRemove(item.id, "cleanup"); sim.run(2);
      // Arm zurück
      sim.world.excavator.cab = 0;
    }
    expect(grabbed, "gegriffene Teile von 100").toBeGreaterThanOrEqual(90);
    expect(maxRelease, "Geschwindigkeit beim Loslassen").toBeLessThan(5);
    sim.dispose();
  });

  it("Bodenanschlag: Krallenspitzen bleiben über dem Beton, egal wie der Arm gesenkt wird", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    sim.control.boom = -1; sim.control.stick = 1; sim.control.grapple = -1;
    sim.run(600);
    const p = sim.excavator.pose;
    expect(p.grapplePos.y).toBeGreaterThan(2.0); // Spitzen bei offener Spinne ~2,4 m unter dem Gelenk
    expect(sim.excavator.groundContact).toBe(true);
    sim.dispose();
  });

  it("Widerstand nur bei Kontakt: Absenken über den Haufen bremst nicht, Durchschwenken bremst", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    sim.scrap.spawnPile("intake", 120, 3); sim.settle();
    // hoch über die Annahmefläche (z = −5), Spinne offen
    aimSensorAt(sim, 0, 4, -5);
    sim.control.boom = -1; // absenken
    let minFactorDescending = 1;
    for (let i = 0; i < 60; i++) { sim.step(); if (sim.excavator.pose.grapplePos.y - 2.4 > 1.6) minFactorDescending = Math.min(minFactorDescending, sim.excavator.plowFactor); }
    sim.control.boom = 0;
    expect(minFactorDescending, "Bremse ohne Kontakt").toBeGreaterThan(0.95);
    // jetzt auf Haufenhöhe schwenken
    aimSensorAt(sim, 3, 0.5, -5);
    sim.control.cab = -1;
    let minFactorSwing = 1;
    for (let i = 0; i < 90; i++) { sim.step(); minFactorSwing = Math.min(minFactorSwing, sim.excavator.plowFactor); }
    expect(minFactorSwing, "Bremse beim Pflügen").toBeLessThan(0.9);
    sim.dispose();
  });

  it("Überlast wird nicht gegriffen; Entfernen eines gehaltenen Teils löst den Griff (H1)", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const heavy = sim.scrap.spawn({ materialId: "steel", shapeId: "block", pos: { x: 0, y: 0.5, z: 4 } })!;
    // Masse künstlich über die Kapazität heben
    sim.physics.safeBody(heavy.bodyHandle)!.setAdditionalMass(4000, true);
    sim.run(60);
    const t = sim.physics.safeBody(heavy.bodyHandle)!.translation();
    aimSensorAt(sim, t.x, t.y + 0.3, t.z);
    sim.control.grapple = 1; sim.run(45);
    expect(sim.grip.heldIds).toHaveLength(0);
    expect(sim.grip.lastRefusal).toBe("tooHeavy");
    sim.control.grapple = -1; sim.run(20);
    sim.scrap.requestRemove(heavy.id, "cleanup"); sim.run(2);

    const light = sim.scrap.spawn({ materialId: "copper", shapeId: "pipe", pos: { x: 0, y: 0.5, z: 4 } })!;
    sim.run(60);
    const t2 = sim.physics.safeBody(light.bodyHandle)!.translation();
    aimSensorAt(sim, t2.x, t2.y + 0.3, t2.z);
    sim.control.grapple = 1; sim.run(45);
    expect(sim.grip.heldIds).toContain(light.id);
    sim.scrap.requestRemove(light.id, "press"); // wie Presse/Verkauf
    sim.run(1);
    expect(sim.grip.heldIds).not.toContain(light.id);
    expect(sim.physics.safeBody(light.bodyHandle)).toBeNull();
    sim.control.grapple = -1;
    expect(() => sim.run(120)).not.toThrow();
    sim.dispose();
  });

  it("Spreizung: offen = CLAW_OPEN_SPLAY, zu und leer = Kalotte", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    expect(sim.excavator.pose.splay).toBeCloseTo(CLAW_OPEN_SPLAY, 5);
    sim.control.grapple = 1; sim.run(60);
    expect(sim.excavator.pose.splay).toBeLessThan(0.05);
    sim.dispose();
  });
});
