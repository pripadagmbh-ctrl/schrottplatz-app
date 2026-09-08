import { describe, it, expect } from "vitest";
import { Scheduler, type System, type SimContext } from "@/sim/systems/System";

function sys(name: string, phase: System["phase"], order: number, every?: number, log?: string[]): System {
  const s: System = { name, phase, order, update: () => { log?.push(name); } };
  return every ? { ...s, every } : s;
}

describe("Scheduler", () => {
  it("sortiert nach Phase, dann order — Snapshot der Reihenfolge", () => {
    const sch = new Scheduler();
    sch.register(sys("day", "postStep", 50));
    sch.register(sys("excavator", "input", 10));
    sch.register(sys("grip", "preStep", 20));
    sch.register(sys("colliders", "preStep", 10));
    sch.register(sys("scrap", "postStep", 10));
    sch.register(sys("containers", "slow", 10, 10));
    // Wer ein System einfügt, sieht die Reihenfolge hier im Diff und bestätigt sie bewusst.
    expect(sch.describe()).toMatchInlineSnapshot(`
      [
        "input:10:excavator",
        "preStep:10:colliders",
        "preStep:20:grip",
        "postStep:10:scrap",
        "postStep:50:day",
        "slow:10:containers×10",
      ]
    `);
  });
  it("verweigert doppelte Namen und slow ohne every", () => {
    const sch = new Scheduler();
    sch.register(sys("a", "input", 1));
    expect(() => sch.register(sys("a", "input", 2))).toThrow(/doppelt/);
    expect(() => sch.register(sys("b", "slow", 1))).toThrow(/every/);
  });
  it("führt slow-Systeme nur alle N Schritte aus", () => {
    const log: string[] = [];
    const sch = new Scheduler();
    sch.register(sys("fast", "postStep", 1, undefined, log));
    sch.register(sys("slow", "slow", 1, 5, log));
    const world = { step: 0 } as unknown as SimContext["world"];
    const physics = { step: () => {}, flushRemovals: () => 0 } as unknown as SimContext["physics"];
    const ctx = { world, physics, get: (n: string) => sch.get(n) } as unknown as SimContext;
    for (let i = 0; i < 10; i++) sch.step(ctx, 1 / 60);
    expect(log.filter((x) => x === "fast")).toHaveLength(10);
    expect(log.filter((x) => x === "slow")).toHaveLength(2);
  });
});
