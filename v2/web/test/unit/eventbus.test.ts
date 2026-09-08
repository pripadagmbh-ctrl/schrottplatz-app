import { describe, it, expect } from "vitest";
import { EventBus } from "@/shared/events";
import { Rng } from "@/shared/rng";
import { ramp, clamp } from "@/shared/math";

describe("shared", () => {
  it("EventBus liefert typisiert, zählt und meldet ab", () => {
    const bus = new EventBus();
    const seen: number[] = [];
    const off = bus.on("moneyChanged", (p) => seen.push(p.deltaEur));
    bus.emit("moneyChanged", { deltaEur: 5, totalEur: 5005, reason: "test" });
    off();
    bus.emit("moneyChanged", { deltaEur: 7, totalEur: 5012, reason: "test" });
    expect(seen).toEqual([5]);
    expect(bus.count("moneyChanged")).toBe(2);
  });
  it("Rng ist deterministisch", () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
    const x = new Rng(7).range(2, 4); expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThan(4);
  });
  it("ramp bewegt höchstens maxStep und trifft das Ziel exakt", () => {
    expect(ramp(0, 1, 0.3)).toBeCloseTo(0.3); expect(ramp(0.9, 1, 0.3)).toBe(1); expect(ramp(1, 0, 0.3)).toBeCloseTo(0.7);
    expect(clamp(5, 0, 1)).toBe(1);
  });
});
