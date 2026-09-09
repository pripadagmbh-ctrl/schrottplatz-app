import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * Paketierpresse (M5b), Bauart nach dem Prototyp: Mulde, Deckelklappen, Längsstempel.
 * Geprüft wird, woran man ohne Diskussion sieht, ob sie fertig ist:
 *  - Loser Schrott in der Mulde wird zu EINEM Paket; die Gesamtmasse bleibt erhalten.
 *  - Gemischt eingefüllt gibt ein Paket aus der schwersten Fraktion — sortenrein einlegen lohnt.
 *  - Ein Wrack mit Batterie oder Motor blockiert; die Presse sagt, was im Weg ist.
 *  - Leere Mulde: kein Start.
 *  - Die Mulde ist vom Standplatz aus erreichbar (E-048).
 */
beforeAll(async () => { await initPhysics(); });

function newSim() {
  const d = loadGameData();
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  const sim = new Simulation(d); sim.init(); sim.world.day.day = 1; sim.world.day.phase = "work";
  return sim;
}

/** Teile in die Mulde fallen lassen (so, wie der Spieler sie mit der Spinne einfüllt). */
function fill(sim: Simulation, mix: { materialId: string; n: number }[]) {
  const z = sim.level.zone("press");
  let i = 0;
  for (const m of mix) {
    for (let k = 0; k < m.n; k++, i++) {
      sim.scrap.spawn({ materialId: m.materialId, shapeId: "block", pos: { x: z.x - 2 + (i % 5) * 1.0, y: 1.2 + Math.floor(i / 5) * 0.5, z: z.z + ((i % 3) - 1) * 0.5 } });
    }
  }
  sim.run(120); // fallen und liegen bleiben
}

/** Presse durchlaufen lassen (Klappen 1,6 s + Stempel 3 s + Halten 0,9 s + zurück 2 s + Klappen 1,6 s). */
function runCycle(sim: Simulation) {
  const p = sim.data.balancing.press as Record<string, number>;
  const total = Number(p["lidTimeS"]) * 2 + Number(p["ramFwdTimeS"]) + Number(p["ramHoldTimeS"]) + Number(p["ramBackTimeS"]) + 1;
  sim.run(Math.ceil(total / sim.dt));
}

describe("Paketierpresse", () => {
  it("presst losen Schrott zu einem Paket und behält die Masse", () => {
    const sim = newSim();
    fill(sim, [{ materialId: "steel", n: 8 }]);
    const vorher = sim.press.status();
    expect(vorher.items, "Teile liegen in der Mulde").toBeGreaterThanOrEqual(6);
    expect(vorher.ready).toBe(true);

    const kgVorher = [...sim.world.items.values()].filter((i) => sim.level.inZone("press", i.pos.x, i.pos.z)).reduce((s, i) => s + i.massKg, 0);
    let done: { kg: number; itemId: string; purity: number } | null = null;
    sim.bus.on("pressDone", (e) => (done = e));

    expect(sim.press.trigger()).toBe(true);
    runCycle(sim);

    expect(done, "Presse meldet ein fertiges Paket").not.toBeNull();
    expect(done!.kg).toBeCloseTo(kgVorher, 0);
    expect(done!.purity, "sortenrein eingefüllt").toBeGreaterThan(0.95);

    const bale = sim.world.items.get(done!.itemId as never)!;
    expect(bale, "Paket liegt in der Mulde").toBeTruthy();
    expect(bale.massKg).toBeCloseTo(kgVorher, 0);
    expect(sim.level.inZone("press", bale.pos.x, bale.pos.z)).toBe(true);
    expect(sim.press.status().items, "nur noch das Paket").toBe(1);
    expect(sim.press.status().phase).toBe("idle");
    sim.dispose();
  });

  it("gemischt eingefüllt: Paket aus der schwersten Fraktion, Reinheit unter 1", () => {
    const sim = newSim();
    fill(sim, [{ materialId: "steel", n: 6 }, { materialId: "alu", n: 3 }]);
    let done: { kg: number; purity: number; itemId: string } | null = null;
    sim.bus.on("pressDone", (e) => (done = e));
    expect(sim.press.trigger()).toBe(true);
    runCycle(sim);
    expect(done).not.toBeNull();
    expect(done!.purity, "gemischt").toBeLessThan(0.95);
    expect(sim.world.items.get(done!.itemId as never)!.materialId, "schwerste Fraktion gibt das Material").toBe("steel");
    sim.dispose();
  });

  it("Wrack mit Batterie und Motor blockiert — die Presse sagt, was im Weg ist", () => {
    const sim = newSim();
    const z = sim.level.zone("press");
    sim.composites.spawn("car_compact", { x: z.x, y: 0.8, z: z.z }, 0);
    sim.run(90);
    const denials: { reason: string; blockedBy: string[] }[] = [];
    sim.bus.on("pressDenied", (e) => denials.push(e));

    const s = sim.press.status();
    expect(s.wrecks, "Wrack liegt in der Mulde").toBe(1);
    expect(s.ready).toBe(false);
    expect(s.blockedBy).toContain("battery");
    expect(s.blockedBy).toContain("engine");
    expect(sim.press.trigger()).toBe(false);
    expect(denials[0]!.reason).toBe("blocked");
    expect(sim.world.composites.size, "Wrack bleibt unversehrt").toBe(1);
    sim.dispose();
  });

  it("ausgebautes Wrack wird mitgepresst", () => {
    const sim = newSim();
    const z = sim.level.zone("press");
    const st = sim.composites.spawn("car_compact", { x: z.x, y: 0.8, z: z.z }, 0)!;
    st.remainingParts = st.remainingParts.filter((p) => p !== "battery" && p !== "engine");
    const def = sim.composites.def(st.defId)!;
    sim.scrap.setMass(sim.composites.hullItem(st)!, def.hull.massKg + sim.composites.remaining(st).reduce((s, p) => s + p.massKg, 0));
    sim.run(90);
    let done: { kg: number } | null = null;
    sim.bus.on("pressDone", (e) => (done = e));
    expect(sim.press.status().ready).toBe(true);
    expect(sim.press.trigger()).toBe(true);
    runCycle(sim);
    expect(done!.kg, "Rumpf 600 kg + 4 Räder à 25 kg").toBeCloseTo(700, 0);
    expect(sim.world.composites.size, "das Wrack existiert nicht mehr").toBe(0);
    sim.dispose();
  });

  it("leere Mulde: kein Start", () => {
    const sim = newSim();
    const denials: { reason: string }[] = [];
    sim.bus.on("pressDenied", (e) => denials.push(e));
    expect(sim.press.status().ready).toBe(false);
    expect(sim.press.trigger()).toBe(false);
    expect(denials[0]!.reason).toBe("empty");
    sim.dispose();
  });

  it("die Mulde ist vom Standplatz aus zu befüllen (kein Fahren nötig)", () => {
    const sim = newSim();
    const z = sim.level.zone("press"); const ex = sim.world.excavator;
    const b = sim.data.balancing.excavator as Record<string, number>;
    const reach = Number(b["boomLenM"]) + Number(b["stickLenM"]);
    // Die Mulde ist 10 m lang (Prototyp-Maß) — eingefüllt wird über die lange Kante, nicht in der Mitte.
    // Geprüft wird daher der nächste Punkt des Rechtecks, so wie es data.test.ts für die Mulden tut.
    const dx = Math.max(0, Math.abs(z.x - ex.pos.x) - z.hw);
    const dz = Math.max(0, Math.abs(z.z - ex.pos.z) - z.hd);
    expect(Math.hypot(dx, dz), "Einfüllkante in Reichweite (E-048/E-059)").toBeLessThan(reach - 1);
    sim.dispose();
  });
});
