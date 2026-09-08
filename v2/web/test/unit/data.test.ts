import { describe, it, expect } from "vitest";
import { loadGameData, crossCheck } from "@/data/loadData";

/** Ein Test pro Datei (Briefing Kap. 18 „Fertig, wenn") plus Querbezüge. */
describe("Datenkataloge", () => {
  const data = loadGameData();

  it("materials.json: 6 MVP-Fraktionen, Preise aus catalog.ts", () => {
    const mvp = data.materials.materials.filter((m) => m.tier === "MVP").map((m) => m.id);
    for (const id of ["steel", "va", "alu", "copper", "cable", "contaminant"]) expect(mvp).toContain(id);
    const copper = data.materials.materials.find((m) => m.id === "copper")!;
    expect(copper.sellPricePerKg).toBe(7.2);
    expect(copper.buyPricePerKg).toBeLessThan(copper.sellPricePerKg);
  });
  it("materials.json: Ankauf nie über Verkauf (außer Entsorgung)", () => {
    for (const m of data.materials.materials) if (m.sellPricePerKg > 0) expect(m.buyPricePerKg).toBeLessThanOrEqual(m.sellPricePerKg);
  });
  it("composites.json: Auto hat Motor, Batterie, 4 Räder; Motor braucht Batterie", () => {
    const car = data.composites.composites.find((c) => c.id === "car_compact")!;
    const ids = car.parts.map((p) => p.id);
    expect(ids.filter((i) => i.startsWith("wheel_"))).toHaveLength(4);
    expect(ids).toContain("engine"); expect(ids).toContain("battery");
    expect(car.parts.find((p) => p.id === "engine")!.requires).toContain("battery");
    expect(car.parts.find((p) => p.id === "battery")!.blocksPress).toBe(true);
    const mvpMass = car.hull.massKg + car.parts.filter((p) => (p.tier ?? "MVP") === "MVP").reduce((a, p) => a + p.massKg, 0);
    expect(mvpMass).toBeGreaterThan(900); expect(mvpMass).toBeLessThan(1000);
  });
  it("level_yard.json: alle 5 Boxen + Stahlhaufen der Stufe 1 innerhalb der Bagger-Reichweite", () => {
    const b = data.balancing.excavator;
    const reach = Number(b["boomLenM"]) + Number(b["stickLenM"]) + Number(b["grappleLinkM"]) + 0.5;
    const spawn = data.level.spawns.excavator;
    const stage1 = data.level.containers.filter((c) => c.stage === 1);
    expect(stage1).toHaveLength(6);
    for (const c of stage1) {
      // nächster Punkt des Rechtecks zum Bagger muss erreichbar sein (Kap. 12 „Fertig, wenn")
      const dx = Math.max(0, Math.abs(c.rect.x - spawn.x) - c.rect.hw);
      const dz = Math.max(0, Math.abs(c.rect.z - spawn.z) - c.rect.hd);
      expect(Math.hypot(dx, dz), `Container ${c.id} außer Reichweite`).toBeLessThanOrEqual(reach);
    }
  });
  it("level_yard.json: Routen halten Abstand zu Boxen und Gebäuden der Stufe 1", () => {
    const obstacles = [...data.level.containers.filter((c) => c.stage === 1).map((c) => c.rect), ...data.level.buildings.filter((b) => b.stage === 1).map((b) => b.rect)];
    const clearance = data.level.clearanceM;
    for (const [name, pts] of Object.entries(data.level.routes)) {
      for (const [x, z] of pts) {
        for (const r of obstacles) {
          const dx = Math.max(0, Math.abs(x - r.x) - r.hw), dz = Math.max(0, Math.abs(z - r.z) - r.hd);
          expect(Math.hypot(dx, dz), `Route ${name} Punkt (${x},${z}) zu nah an Hindernis bei (${r.x},${r.z})`).toBeGreaterThanOrEqual(clearance);
        }
      }
    }
  });
  it("customers.json: Ladungsprofile summieren auf 1, Privatkunden ≤ 800 kg", () => {
    const trailer = data.customers.vehicles.find((v) => v.id === "trailer")!;
    expect(trailer.loadKgMax).toBeLessThanOrEqual(Number(data.balancing.customers["privateMaxKg"]));
    for (const c of data.customers.customers) if (c.loadProfile.length) expect(c.loadProfile.reduce((a, p) => a + p.share, 0)).toBeCloseTo(1, 3);
  });
  it("missions.json: an Tag 1 gibt es mindestens 3 MVP-Aufträge", () => {
    const day1 = data.missions.missions.filter((m) => m.tier === "MVP" && m.fromDay <= 1 && (m.toDay ?? 99) >= 1);
    expect(day1.length).toBeGreaterThanOrEqual(3);
  });
  it("upgrades.json: Stufe 2 vor Stufe 3, Sterne und Geld steigen", () => {
    const s2 = data.upgrades.upgrades.find((u) => u.id === "stage2_office")!;
    const s3 = data.upgrades.upgrades.find((u) => u.id === "stage3_hall")!;
    expect(s3.requires).toBe("stage2_office");
    expect(s3.priceEur).toBeGreaterThan(s2.priceEur); expect(s3.requiresStars).toBeGreaterThan(s2.requiresStars);
  });
  it("controls.json: Werkseinstellung wie Prototyp (links: cab/boom, rechts: stick)", () => {
    expect(data.controls.axes.leftX.fn).toBe("cab"); expect(data.controls.axes.leftY.fn).toBe("boom"); expect(data.controls.axes.rightY.fn).toBe("stick");
    expect(Number(data.controls.touch["minTapTargetPx"])).toBeGreaterThanOrEqual(44);
  });
  it("balancing.json: Reinheit², Kredit −1500, Start 5000, max. 2 Nachholschritte", () => {
    expect(data.balancing.economy["purityExponent"]).toBe(2);
    expect(data.balancing.economy["creditLimitEur"]).toBe(-1500);
    expect(data.balancing.economy["startMoneyEur"]).toBe(5000);
    expect(data.balancing.physics.maxCatchUpSteps).toBe(2);
  });
  it("i18n/de.json: jeder Auftrag und jedes Material hat einen Text", () => {
    expect(crossCheck(data)).toEqual([]);
  });
});
