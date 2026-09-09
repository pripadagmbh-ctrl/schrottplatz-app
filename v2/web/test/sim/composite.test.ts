import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * M5-Waechter (Briefing Kap. 8.1 „Fertig, wenn"): Motor loest sich in 2,4–3,0 s bei Zugkraft 1,0 und erscheint als
 * Stahl-Teil mit 210 kg; der Rumpf wiegt danach 210 kg weniger. Falsche Reihenfolge (Motor vor Batterie): Timer steht.
 * Tieflader bringt das Wrack, setzt es ab, Pauschalpreis auf den Cent.
 */
beforeAll(async () => { await initPhysics(); });

function newSim() {
  const d = loadGameData();
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  const sim = new Simulation(d); sim.init(); sim.world.day.day = 1; sim.world.day.phase = "work";
  return sim;
}

/**
 * Arm so stellen, dass der Sensor moeglichst nah am Zielpunkt liegt (Rastersuche ueber Oberwagen/Hauptarm/Stiel).
 * Waehrend der Suche fegt der Arm durch die Szene — das Wrack wird solange beiseite geparkt.
 */
function aimAt(sim: Simulation, target: { x: number; y: number; z: number }, parkId?: string): number {
  const park = parkId ? sim.world.items.get(parkId as never) : undefined;
  const body = park?.bodyHandle !== undefined ? sim.physics.safeBody(park.bodyHandle) : null;
  const home = body ? { ...body.translation() } : null; const homeRot = body ? { ...body.rotation() } : null;
  if (body) { body.setTranslation({ x: 40, y: 5, z: 40 }, false); }
  // Spinne 2.0: Baugruppen werden auf Spitzenhoehe gefasst (reachPoint), der Sensor haengt ~0,9 m darueber; dazu ~5 cm Federsack
  target = { x: target.x, y: target.y + 0.9, z: target.z };
  const s = sim.world.excavator; const ex = sim.data.balancing.excavator as Record<string, number>;
  const drop = Number(ex["grappleLinkM"]) + Number(ex["palmOffsetY"]) + Number(ex["palmToSensorM"]);
  const d2r = Math.PI / 180; let best = Infinity, bc = 0, bb = 0, bs = 0;
  const yaw = Math.atan2(target.x - s.pos.x, target.z - s.pos.z) - s.heading;
  // Kinematisch rechnen (computePose), nicht steppen: der dynamische Spinnenkoerper wuerde sonst dem Arm hinterherhinken
  for (let boom = ex["boomMinDeg"]!; boom <= ex["boomMaxDeg"]!; boom += 2) for (let stick = ex["stickMinDeg"]!; stick <= ex["stickMaxDeg"]!; stick += 2) {
    s.cab = yaw; s.boom = boom * d2r; s.stick = stick * d2r; sim.excavator.computePose(s);
    const p = sim.excavator.pose.stickTip; const d = Math.hypot(p.x - target.x, p.y - drop - target.y, p.z - target.z);
    if (d < best) { best = d; bc = yaw; bb = s.boom; bs = s.stick; }
  }
  s.cab = bc; s.boom = bb; s.stick = bs; sim.step(); sim.excavator.resetPendulum(); sim.run(20);
  if (body && home && homeRot) { body.setTranslation(home, true); body.setRotation(homeRot, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); sim.run(30); }
  return best;
}

describe("Verbundteile (CompositeSystem)", () => {
  it("Motor: Batterie zuerst, dann 2,4–3,0 s Zug → Stahlteil 210 kg in der Spinne, Rumpf 210 kg leichter", () => {
    const sim = newSim();
    const st = sim.composites.spawn("car_compact", { x: 0, y: 0, z: 5 }, 0)!;
    sim.run(120); // setzen
    const hull = sim.world.items.get(st.hullItemId)!;
    const def = sim.composites.def("car_compact")!;
    const engine = def.parts.find((p) => p.id === "engine")!, battery = def.parts.find((p) => p.id === "battery")!;
    expect(hull.massKg).toBeCloseTo(def.hull.massKg + 4 * 25 + 18 + 210, 3);

    // Motor vor Batterie: gefasst, aber blockiert. Reihenfolge wie der Spieler: erst schliessen (fassen), dann ziehen.
    const a = sim.composites.anchorWorld(st, engine, { x: 0, y: 0, z: 0 });
    expect(aimAt(sim, a, st.hullItemId)).toBeLessThan(engine.grabRadius + 0.1);
    sim.control.grapple = 1; sim.run(60);
    expect(sim.composites.engaged?.partId).toBe("engine");
    expect(sim.composites.engaged?.blockedBy).toBe("battery");
    sim.control.boom = 1; sim.run(60 * 4); expect(st.remainingParts).toContain("engine"); // nichts reisst
    sim.control.grapple = -1; sim.control.boom = 0; sim.run(90); expect(sim.composites.engaged).toBeNull(); sim.control.grapple = 0;

    // Batterie
    const ab = sim.composites.anchorWorld(st, battery, { x: 0, y: 0, z: 0 });
    expect(aimAt(sim, ab, st.hullItemId)).toBeLessThan(battery.grabRadius + 0.5);
    let torn: string[] = []; sim.bus.on("partTorn", ({ partId }) => torn.push(partId));
    sim.control.grapple = 1; sim.run(60); expect(sim.composites.engaged?.partId).toBe("battery");
    sim.control.boom = 1; sim.run(60 * 2);
    expect(torn).toEqual(["battery"]);
    expect(sim.grip.count).toBe(1); // Batterie in der Spinne
    // ablegen
    sim.control.grapple = -1; sim.control.boom = 0; sim.run(120); sim.control.grapple = 0; sim.run(120);
    expect(sim.grip.count).toBe(0);

    // Motor: Zeit ab Zugbeginn messen (Briefing 8.1: 2,4–3,0 s bei Zugkraft 1,0)
    const ae = sim.composites.anchorWorld(st, engine, { x: 0, y: 0, z: 0 });
    expect(aimAt(sim, ae, st.hullItemId)).toBeLessThan(engine.grabRadius + 0.1);
    torn = []; const m0 = hull.massKg;
    sim.control.grapple = 1; sim.run(60); expect(sim.composites.engaged?.partId).toBe("engine");
    sim.control.boom = 1;
    let steps = 0; while (!torn.length && steps < 60 * 6) { sim.step(); steps++; }
    expect(torn).toEqual(["engine"]);
    expect(steps / 60).toBeGreaterThanOrEqual(2.4); expect(steps / 60).toBeLessThanOrEqual(3.0);
    expect(hull.massKg).toBeCloseTo(m0 - 210, 3);
    const eng = [...sim.world.items.values()].find((i) => i.origin === "torn" && i.materialId === "steel")!;
    expect(eng.massKg).toBe(210); expect(eng.state).toBe("held");
    sim.dispose();
  });

  it("Tieflader (Kfz-Werkstatt Rehm): Wrack kommt, wird abgesetzt, Pauschale 120 € auf den Cent", () => {
    const sim = newSim();
    const money0 = sim.world.economy.moneyEur;
    const run = sim.vehicles.requestDelivery("rehm")!;
    expect(run.def.id).toBe("lowloader"); expect(sim.world.composites.size).toBe(1);
    let steps = 0; while (run.stage !== "done" && steps < 200 * 60) { sim.step(); steps++; }
    expect(run.stage).toBe("done");
    const st = [...sim.world.composites.values()][0]!; const hull = sim.world.items.get(st.hullItemId)!;
    expect(hull.state).toBe("loose"); expect(hull.pos.y).toBeGreaterThan(0.3); expect(hull.pos.y).toBeLessThan(1.5);
    expect(sim.level.inZone("dismantle", hull.pos.x, hull.pos.z) || Math.hypot(hull.pos.x + 16, hull.pos.z - 2) < 8).toBe(true);
    expect(sim.world.economy.moneyEur).toBeCloseTo(money0 - 120, 2);
    sim.dispose();
  });
});

describe("Erstes Wrack garantiert", () => {
  it("Tag 1: die erste automatische Fuhre ist der Tieflader mit dem Pkw", () => {
    const d = loadGameData(); d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: true }; // loadGameData teilt das Objekt zwischen Tests
    const sim = new Simulation(d); sim.init(); sim.world.day.day = 1; sim.world.day.phase = "work";
    let steps = 0; while (!sim.vehicles.runs.length && steps < 60 * 30) { sim.step(); steps++; }
    expect(sim.vehicles.runs[0]?.def.id).toBe("lowloader"); expect(sim.world.composites.size).toBe(1);
    sim.dispose();
  });
});
