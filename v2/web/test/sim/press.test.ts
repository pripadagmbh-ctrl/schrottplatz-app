import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * Presse (M5b, Briefing Kap. 8.2/8.3). Geprueft wird das, woran man ohne Diskussion sieht, ob sie fertig ist:
 *  - Sie verweigert, solange Batterie oder Motor dranhaengen, und sagt welches Teil im Weg ist.
 *  - Ohne diese Teile presst sie in 3 Stufen zu einem Stahlpaket; das Wrack verschwindet, das Paket wiegt Rumpf
 *    plus alles, was noch dran war (Raeder zaehlen mit — wer sie dranlaesst, presst sie ein).
 *  - Ein Rumpf ausserhalb der Pressenzone wird nicht gepresst.
 */
beforeAll(async () => { await initPhysics(); });

function newSim() {
  const d = loadGameData();
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  const sim = new Simulation(d); sim.init(); sim.world.day.day = 1; sim.world.day.phase = "work";
  return sim;
}

/** Wrack mitten in die Presse setzen (der Weg dorthin ist Sache des Spielers). */
function wreckInPress(sim: Simulation, opts: { remove?: string[] } = {}) {
  const z = sim.level.zone("press");
  const st = sim.composites.spawn("car_compact", { x: z.x, y: 0.6, z: z.z }, 0)!;
  if (opts.remove) st.remainingParts = st.remainingParts.filter((p) => !opts.remove!.includes(p));
  const hull = sim.composites.hullItem(st)!;
  const def = sim.composites.def(st.defId)!;
  sim.scrap.setMass(hull, def.hull.massKg + sim.composites.remaining(st).reduce((s, p) => s + p.massKg, 0));
  sim.run(30);
  return st;
}

describe("Presse", () => {
  it("verweigert, solange Batterie und Motor dranhaengen — und sagt, was im Weg ist", () => {
    const sim = newSim();
    wreckInPress(sim);
    const denials: { reason: string; blockedBy: string[] }[] = [];
    sim.bus.on("pressDenied", (e) => denials.push(e));

    const s = sim.press.status();
    expect(s.loaded, "Wrack liegt in der Presse").toBe(true);
    expect(s.ready).toBe(false);
    expect(s.blockedBy).toContain("battery");
    expect(s.blockedBy).toContain("engine");

    expect(sim.press.trigger()).toBe(false);
    expect(denials).toHaveLength(1);
    expect(denials[0]!.reason).toBe("blocked");
    expect(denials[0]!.blockedBy).toContain("battery");
    expect(sim.world.composites.size, "Wrack ist unveraendert da").toBe(1);
    sim.dispose();
  });

  it("presst ohne Batterie und Motor in 3 Stufen zu einem Stahlpaket", () => {
    const sim = newSim();
    const st = wreckInPress(sim, { remove: ["battery", "engine"] });
    const def = sim.composites.def(st.defId)!;
    const erwartet = def.hull.massKg + sim.composites.remaining(st).reduce((s, p) => s + p.massKg, 0); // 600 + 4x25 Raeder = 700
    const stages: number[] = []; let done: { kg: number; itemId: string } | null = null;
    sim.bus.on("pressStage", (e) => stages.push(e.stage));
    sim.bus.on("pressDone", (e) => (done = { kg: e.kg, itemId: e.itemId }));

    expect(sim.press.status().ready).toBe(true);
    expect(sim.press.trigger()).toBe(true);

    const total = Number((sim.data.balancing.press as Record<string, number>)["stageSeconds"]) * 3;
    sim.run(Math.ceil((total + 1) / sim.dt));

    expect(done, "Presse meldet Fertigmeldung").not.toBeNull();
    expect(done!.kg).toBeCloseTo(erwartet, 1);
    expect(stages, "drei Quetschstufen durchlaufen").toEqual([1, 2]); // Stufe 0 ist der Startzustand
    expect(sim.world.composites.size, "das Wrack existiert nicht mehr").toBe(0);

    const pack = sim.world.items.get(done!.itemId as never)!;
    expect(pack, "Paket liegt da").toBeTruthy();
    expect(pack.materialId).toBe("steel");
    expect(pack.massKg).toBeCloseTo(erwartet, 1);
    expect(sim.level.inZone("press", pack.pos.x, pack.pos.z), "Paket liegt in der Presse").toBe(true);
    sim.dispose();
  });

  it("presst nicht, was ausserhalb der Presse liegt", () => {
    const sim = newSim();
    const st = sim.composites.spawn("car_compact", { x: 0, y: 0.6, z: -4 }, 0)!;
    st.remainingParts = [];
    sim.run(30);
    const s = sim.press.status();
    expect(s.loaded).toBe(false);
    expect(s.ready).toBe(false);
    expect(sim.press.trigger()).toBe(false);
    expect(sim.world.composites.size).toBe(1);
    sim.dispose();
  });

  it("die Presse ist vom Standplatz aus erreichbar (kein Fahren noetig)", () => {
    const sim = newSim();
    const z = sim.level.zone("press"); const ex = sim.world.excavator;
    const b = sim.data.balancing.excavator as Record<string, number>;
    const reach = Number(b["boomLenM"]) + Number(b["stickLenM"]);
    expect(Math.hypot(z.x - ex.pos.x, z.z - ex.pos.z), "Presse in Reichweite (E-048)").toBeLessThan(reach - 1);
    sim.dispose();
  });
});
