import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import type { ItemId } from "@/shared/ids";

beforeAll(async () => { await initPhysics(); });

describe("Entfernen über Registry und Spielstand", () => {
  it("requestRemove feuert itemRemoving vor dem Entfernen; Registry und Welt sind danach sauber", () => {
    const sim = new Simulation(loadGameData());
    sim.init();
    const it = sim.scrap.spawn({ materialId: "copper", shapeId: "pipe", pos: { x: 0, y: 1, z: 0 } })!;
    const h = it.bodyHandle!;
    let seenBeforeRemoval = false;
    sim.bus.on("itemRemoving", (p) => { seenBeforeRemoval = p.itemId === it.id && sim.physics.safeBody(h) !== null; });
    expect(sim.physics.itemOf(h)).toBe(it.id);
    expect(sim.scrap.requestRemove(it.id, "sold")).toBe(true);
    expect(seenBeforeRemoval).toBe(true);
    expect(sim.world.items.has(it.id)).toBe(false);
    sim.step(); // flushRemovals läuft am Ende des Schritts
    expect(sim.physics.safeBody(h)).toBeNull();
    expect(sim.physics.itemOf(h)).toBeUndefined();
    expect(sim.physics.handleOf(it.id)).toBeUndefined();
    expect(() => sim.run(30)).not.toThrow();
    expect(sim.scrap.requestRemove("item_nix" as ItemId, "cleanup")).toBe(false);
    sim.dispose();
  });

  it("Save → Load stellt Teile mit Pose und Masse wieder her; kaputte Einträge werden einzeln verworfen", () => {
    const a = new Simulation(loadGameData());
    a.init();
    a.scrap.spawnPile("intake", 40, 5);
    a.settle();
    const saved = a.save();
    const scrapSave = saved["scrap"] as { items: unknown[] };
    expect(scrapSave.items).toHaveLength(40);
    const before = [...a.scrap.items()].map((i) => [i.materialId, i.massKg, i.pos.x.toFixed(2), i.pos.z.toFixed(2)].join("|")).sort();
    a.dispose();

    // zwei absichtlich kaputte Einträge: NaN-Position, unbekannte Form
    scrapSave.items.push({ materialId: "steel", shapeId: "beam", size: [0.2, 0.2, 2], massKg: 60, pos: [NaN, 1, 0], rot: [0, 0, 0, 1], origin: "delivery" });
    scrapSave.items.push({ materialId: "steel", shapeId: "ufo", size: [0.2, 0.2, 2], massKg: 60, pos: [0, 1, 0], rot: [0, 0, 0, 1], origin: "delivery" });

    const b = new Simulation(loadGameData());
    b.init();
    b.load(saved);
    expect(b.scrap.count).toBe(40);
    expect(b.scrap.rejectedOnLoad).toBe(2);
    const after = [...b.scrap.items()].map((i) => [i.materialId, i.massKg, i.pos.x.toFixed(2), i.pos.z.toFixed(2)].join("|")).sort();
    expect(after).toEqual(before);
    expect(() => b.run(60)).not.toThrow();
    b.dispose();
  });

  it("Level: Boden, 5 Wände, Muldenwände; Zonen- und Containerabfrage", () => {
    const sim = new Simulation(loadGameData());
    const walls = sim.level.boxes.filter((b) => b.kind === "wall").length;
    const cont = sim.level.boxes.filter((b) => b.kind === "container").length;
    expect(walls).toBe(5);
    expect(cont).toBe(5 * 4 + 3); // 5 Mulden × 4 Wände + Stahlhaufen 3 Wände
    expect(sim.level.inZone("intake", 0, -5)).toBe(true);
    expect(sim.level.containerAt(0, 8.5)).toBe("box_copper");
    expect(sim.level.containerAt(0, 0)).toBeNull();
    sim.dispose();
  });
});
