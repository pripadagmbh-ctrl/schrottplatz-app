import { describe, expect, it } from "vitest";
import { migrate, type SaveData } from "../src/core/save";

/** M3-Abnahme: Spielstand mit Schema-Version + Migrationspfad von Anfang an. */

const valid: SaveData = {
  schemaVersion: 1,
  savedAt: "2026-08-27T12:00:00Z",
  moneyEur: 5150,
  items: [
    {
      materialId: "steel",
      massKg: 60,
      shape: { kind: "box", dims: [0.15, 0.15, 1.3], color: 0x6e5a4e },
      pos: [1, 0.1, 2],
      rot: [0, 0, 0, 1],
    },
  ],
  cars: [
    { pos: [7, 0.1, -1], rot: [0, 0, 0, 1], crushStage: 1, torn: ["engine"], brokenWindows: ["front"] },
  ],
  fencesBroken: [true, false, false, false, false, false],
};

describe("Spielstand-Migration", () => {
  it("gültiger v1-Stand läuft durch", () => {
    expect(migrate(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });
  it("unbekannte/zukünftige Schema-Version wird abgelehnt", () => {
    expect(migrate({ ...valid, schemaVersion: 99 })).toBeNull();
    expect(migrate({ ...valid, schemaVersion: 0 })).toBeNull();
  });
  it("kaputte Daten werden abgelehnt (kein Absturz)", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate("quatsch")).toBeNull();
    expect(migrate({ schemaVersion: 1 })).toBeNull();
    expect(migrate({ ...valid, items: "nope" })).toBeNull();
  });
});
