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
  const s = sim.world.excavator; const ex = sim.data.balancing.excavator as Record<string, number>;
  const d2r = Math.PI / 180; let best = Infinity, bc = 0, bb = 0, bs = 0;
  const yaw = Math.atan2(target.x - s.pos.x, target.z - s.pos.z) - s.heading;
  for (let boom = ex["boomMinDeg"]!; boom <= ex["boomMaxDeg"]!; boom += 2) for (let stick = ex["stickMinDeg"]!; stick <= ex["stickMaxDeg"]!; stick += 2) {
    s.cab = yaw; s.boom = boom * d2r; s.stick = stick * d2r; sim.step();
    const p = sim.excavator.pose.sensorPos; const d = Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z);
    if (d < best) { best = d; bc = yaw; bb = s.boom; bs = s.stick; }
  }
  s.cab = bc; s.boom = bb; s.stick = bs; sim.step();
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

    // Motor vor Batterie: gefasst, aber blockiert
    const a = sim.composites.anchorWorld(st, engine, { x: 0, y: 0, z: 0 });
    expect(aimAt(sim, a, st.hullItemId)).toBeLessThan(engine.grabRadius);
    sim.control.grapple = 1; sim.control.boom = 1; sim.run(60);
    expect(sim.composites.engaged?.partId).toBe("engine");
    expect(sim.composites.engaged?.blockedBy).toBe("battery");
    sim.run(60 * 4); expect(st.remainingParts).toContain("engine"); // nichts reisst
    sim.control.grapple = -1; sim.control.boom = 0; sim.run(90); expect(sim.composites.engaged).toBeNull(); sim.control.grapple = 0;

    // Batterie
    const ab = sim.composites.anchorWorld(st, battery, { x: 0, y: 0, z: 0 });
    expect(aimAt(sim, ab, st.hullItemId)).toBeLessThan(battery.grabRadius);
    let torn: string[] = []; sim.bus.on("partTorn", ({ partId }) => torn.push(partId));
    sim.control.grapple = 1; sim.control.boom = 1; sim.run(60 * 3);
    expect(torn).toEqual(["battery"]);
    expect(sim.grip.count).toBe(1); // Batterie in der Spinne
    // ablegen
    sim.control.grapple = -1; sim.control.boom = 0; sim.run(120); sim.control.grapple = 0; sim.run(120);
    expect(sim.grip.count).toBe(0);

    // Motor: Zeit messen
    const ae = sim.composites.anchorWorld(st, engine, { x: 0, y: 0, z: 0 });
    expect(aimAt(sim, ae, st.hullItemId)).toBeLessThan(engine.grabRadius);
    torn = []; const m0 = hull.massKg;
    sim.control.grapple = 1; sim.control.boom = 1;
    let steps = 0; while (!torn.length && steps < 60 * 6) { sim.step(); steps++; }
    expect(torn).toEqual(["engine"]);
    const grabSteps = Math.ceil(0.3 * 0.8 * 60); // Schliessen bis engageWindowStart (closeTimeS 0,8)
    expect((steps - grabSteps) / 60).toBeGreaterThanOrEqual(2.4); expect((steps - grabSteps) / 60).toBeLessThanOrEqual(3.0);
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
    // Seit 09.09. setzt der Tieflader an der Annahme ab statt im Zerlegebereich: das Wrack muss ohne Fahren erreichbar sein
    const exb = sim.data.balancing.excavator as Record<string, number>;
    const reach = Number(exb["boomLenM"]) + Number(exb["stickLenM"]);
    expect(Math.hypot(hull.pos.x - sim.world.excavator.pos.x, hull.pos.z - sim.world.excavator.pos.z)).toBeLessThan(reach - 1);
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

/**
 * Anlieferungs-Waechter (Patrick, iPad 09.09.: „es laesst sich mit dem Pkw nichts machen"). Der Fehler lag NICHT in der
 * Zerlege-Mechanik — die war getestet — sondern davor: Der Tieflader setzte das Wrack im Zerlegebereich ab, 20,8 m vom
 * Bagger entfernt bei 9,2 m Reichweite. Dieser Test deckt die Kette Anlieferung → Ablage ab: Das Wrack muss ohne Fahren
 * erreichbar sein, auf dem Boden stehen und darf nicht in der Schuettzone der Kipper liegen.
 */
describe("Wrack-Anlieferung", () => {
  it("Tieflader setzt das Wrack in Reichweite des Baggers ab", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    sim.world.day.day = 1; sim.day.startDay(); // Tag 0 ist der Einweisungstag ohne Anlieferungen
    for (let i = 0; i < 60 * 240 && sim.world.composites.size === 0; i++) sim.step();
    expect(sim.world.composites.size, "Tieflader kommt an Tag 1").toBe(1);
    for (let i = 0; i < 60 * 40; i++) sim.step(); // absetzen und ausrollen abwarten

    const st = [...sim.world.composites.values()][0]!;
    const hull = sim.world.items.get(st.hullItemId)!;
    const ex = sim.world.excavator;
    const b = sim.data.balancing.excavator as Record<string, number>;
    const reach = Number(b["boomLenM"]) + Number(b["stickLenM"]);

    const dist = Math.hypot(hull.pos.x - ex.pos.x, hull.pos.z - ex.pos.z);
    expect(dist, "ohne Fahren erreichbar (mit Sicherheitsabstand zur Reichweitengrenze)").toBeLessThan(reach - 1);
    expect(hull.pos.y, "steht auf dem Boden, nicht darin oder auf einer Box").toBeGreaterThan(0.1);
    expect(hull.state).toBe("loose");
    expect(st.remainingParts.length, "alle Baugruppen noch dran").toBeGreaterThanOrEqual(6);

    // nicht in der Schuettzone der Kipper (dort landet der Haufen)
    const pile = sim.level.zone("intake_pile");
    const inPile = Math.abs(hull.pos.x - pile.x) < pile.hw && Math.abs(hull.pos.z - pile.z) < pile.hd;
    expect(inPile, "liegt nicht im Schuettbereich der Kipper").toBe(false);
    sim.dispose();
  });
});
