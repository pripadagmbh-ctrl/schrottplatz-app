import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { inRect } from "@/shared/math";

/**
 * M4a-Waechter: eine Anlieferung von Tor bis Tor, kopflos.
 *  - Ladung liegt bis zum Kippen auf der Mulde (kinematisch), danach lose auf der Annahmeflaeche
 *  - nichts bleibt auf der Ladeflaeche (Lkw faehrt gekippt ab), nichts unter dem Boden
 *  - Waage: brutto = tara + Ladung, Zahlung exakt kg × Preis, Geld auf den Cent
 *  - Verbuchung und Verkauf: Reinheit^2 auf den Cent
 */
beforeAll(async () => { await initPhysics(); });

function newSim() {
  const d = loadGameData();
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  const sim = new Simulation(d); sim.init(); sim.world.day.phase = "work";
  return sim;
}

describe("Anlieferung (VehicleSystem)", () => {
  it("Kipper: rein, wiegen, rueckwaerts andocken, kippen, gekippt abfahren, wiegen, zahlen, raus", () => {
    const sim = newSim();
    const events: string[] = [];
    for (const e of ["vehicleArrived", "vehicleWeighed", "vehicleDumped", "vehicleLeft", "moneyChanged"] as const) sim.bus.on(e, () => events.push(e));
    const money0 = sim.world.economy.moneyEur;
    const run = sim.vehicles.requestDelivery("hallmann")!; // Giesserei, Kipper, meist sortenrein Stahl
    expect(run).toBeTruthy();
    const loadIds = run.loads.map((l) => l.itemId);
    expect(loadIds.length).toBeGreaterThanOrEqual(10);
    const loadKg = run.loads.reduce((s, l) => s + l.massKg, 0);
    expect(run.delivery.grossKg).toBeCloseTo(run.def.body.tareKg + loadKg, 5);
    for (const id of loadIds) expect(sim.world.items.get(id)!.state).toBe("onVehicle");

    // Bis zur Ankunft am Tor laufen (max. 150 s)
    let steps = 0; const maxSteps = 150 * 60;
    let sawTipped = false, maxItemsY = 0;
    while (run.stage !== "done" && steps < maxSteps) {
      sim.step(); steps++;
      if (run.stage === "creep") sawTipped = true;
    }
    expect(run.stage, `Fahrzeug nach ${steps / 60} s`).toBe("done");
    expect(sawTipped, "faehrt gekippt ab").toBe(true);
    expect(events.indexOf("vehicleWeighed")).toBeLessThan(events.indexOf("vehicleDumped"));
    expect(events.indexOf("vehicleDumped")).toBeLessThan(events.indexOf("moneyChanged"));
    expect(events.indexOf("moneyChanged")).toBeLessThan(events.indexOf("vehicleLeft"));

    // Ladung: lose, auf der Annahmeflaeche (mit 2,5 m Toleranz), nicht in der Luft, nicht im Boden
    const intake = sim.level.zone("intake");
    let onZone = 0;
    for (const id of loadIds) {
      const it = sim.world.items.get(id); expect(it, `Teil ${id} existiert noch`).toBeTruthy();
      expect(it!.state).toBe("loose");
      expect(it!.pos.y, `Teil ${id} Hoehe`).toBeLessThan(2.0); maxItemsY = Math.max(maxItemsY, it!.pos.y);
      expect(it!.pos.y).toBeGreaterThan(-0.2);
      if (inRect(it!.pos.x, it!.pos.z, intake.x, intake.z, intake.hw + 2.5, intake.hd + 2.5)) onZone++;
    }
    expect(onZone / loadIds.length, "Anteil auf der Annahmeflaeche").toBeGreaterThanOrEqual(0.85);

    // Geld: exakt kg × Preis (sortenrein → Fraktionspreis, sonst Pauschale)
    const d = run.delivery;
    const mat = sim.data.materials.materials.find((m) => m.id === d.materialId);
    const perKg = d.sorted && mat ? mat.buyPricePerKg : Number(sim.data.balancing.economy["mixedBuyPricePerKg"]);
    const expected = Math.round(loadKg * perKg * 100) / 100;
    expect(d.priceEur).toBeCloseTo(expected, 2);
    expect(sim.world.economy.moneyEur).toBeCloseTo(money0 - expected, 2);
    expect(sim.vehicles.runs.length).toBe(0);
    sim.dispose();
  });

  it("Anhaenger (Privatkunde) kommt ebenfalls durch", () => {
    const sim = newSim();
    const run = sim.vehicles.requestDelivery("private_generic")!;
    let steps = 0; while (run.stage !== "done" && steps < 150 * 60) { sim.step(); steps++; }
    expect(run.stage).toBe("done");
    expect(sim.world.day.deliveriesDone).toBe(1);
    sim.dispose();
  });
});

describe("Verbuchung und Verkauf (ContainerSystem)", () => {
  it("richtiges Teil → Inhalt + Punkte, falsches → Verunreinigung; Verkauf zahlt Reinheit² auf den Cent", () => {
    const sim = newSim();
    const box = sim.data.level.containers.find((c) => c.id === "box_copper")!;
    const cu = sim.scrap.spawn({ materialId: "copper", shapeId: "pipe", pos: { x: box.rect.x, y: 1.0, z: box.rect.z } })!;
    const st = sim.scrap.spawn({ materialId: "steel", shapeId: "block", pos: { x: box.rect.x + 0.6, y: 1.0, z: box.rect.z + 0.3 } })!;
    let sorted = 0; sim.bus.on("itemSorted", () => sorted++);
    sim.run(60 * 8); // fallen, ruhen, 3 s Verbuchungsfrist
    expect(sorted).toBe(2);
    const cont = sim.world.containers.get("box_copper" as never)!;
    expect(cont.contentKg).toBeCloseTo(cu.massKg, 5);
    expect(cont.contaminationKg).toBeCloseTo(st.massKg, 5);
    expect(cu.state).toBe("booked"); expect(st.state).toBe("booked");
    expect(sim.world.economy.sortPoints).toBeGreaterThan(0);
    expect(sim.world.economy.moneyEur).toBe(5000); // Sortieren gibt kein Geld

    // Verkauf
    const money0 = sim.world.economy.moneyEur;
    const pick = sim.vehicles.requestPickup("box_copper")!;
    let steps = 0; while (pick.stage !== "done" && steps < 200 * 60) { sim.step(); steps++; }
    const total = cu.massKg + st.massKg, purity = cu.massKg / total;
    const price = sim.data.materials.materials.find((m) => m.id === "copper")!.sellPricePerKg;
    const expected = Math.round(total * price * purity * purity * 100) / 100;
    expect(sim.world.economy.moneyEur).toBeCloseTo(money0 + expected, 2);
    expect(cont.contentKg).toBe(0); expect(cont.contaminationKg).toBe(0);
    expect(sim.world.items.has(cu.id)).toBe(false); // verkaufte Teile sind weg
    sim.dispose();
  });
});
