import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import type { MissionDef } from "@/data/types";
import type { CompositeId, ItemId } from "@/shared/ids";

/**
 * Zerlege- und Presse-Auftrag (M6).
 *
 * Die Waechter im ersten Block sind aus einem echten Fehler entstanden: `dismantle_engine` stand auf
 * `tier: V1` und `fromDay: 5`. Gezogen werden nur MVP-Auftraege, und die Gratis-Tage enden nach
 * `unlockAfterDay` (3) — der Auftrag war damit doppelt unerreichbar. Das Wrack lag ab Tag 1 auf dem Platz,
 * ohne dass irgendetwas dazu aufforderte. Aufgefallen ist es niemandem, weil jedes Einzelteil funktionierte:
 * Tieflader, Zerlegen und Presse waren gebaut und getestet, nur verband sie nichts.
 *
 * Diese Tests pruefen deshalb nicht Mechanik, sondern **Erreichbarkeit** — bekommt der Spieler das
 * ueberhaupt zu Gesicht? Das ist die Sorte Luecke, die Modultests naturgemaess nicht finden.
 */
beforeAll(async () => { await initPhysics(); });

function newSim(day: number) {
  const d = loadGameData();
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  const sim = new Simulation(d); sim.init();
  sim.world.day.day = day; sim.world.day.phase = "morning";
  sim.missions.roll(day);
  return sim;
}

/** Die Ereignisse tragen gebrandete Kennungen; fuer den Test genuegen erfundene. */
const cid = "wrack_test" as CompositeId;
const iid = (s: string): ItemId => s as unknown as ItemId;

/** Auftrag erzwingen, statt auf die gewichtete Ziehung zu warten. */
function force(sim: Simulation, id: string): { def: MissionDef; done: boolean } {
  const def = sim.data.missions.missions.find((m) => m.id === id)!;
  expect(def, `Auftrag ${id} fehlt in missions.json`).toBeTruthy();
  sim.missions.active.length = 0;
  const m = { def, progress: 0, target: 1, done: false };
  sim.missions.active.push(m);
  return m;
}

describe("Erreichbarkeit der Auftraege", () => {
  it("kein Auftrag startet nach dem letzten Kampagnentag", () => {
    const d = loadGameData();
    const letzter = d.balancing.day.campaignDays;
    const zuSpaet = d.missions.missions.filter((m) => m.tier === "MVP" && m.fromDay >= letzter);
    expect(
      zuSpaet.map((m) => `${m.id} (fromDay ${m.fromDay})`),
      `Die Kampagne endet nach Tag ${letzter}`
    ).toEqual([]);
  });

  it("die Gratis-Tage bieten jeden Tag volle perDay Auftraege", () => {
    // Tag 1 bis unlockAfterDay spielt jeder, auch ohne zu zahlen. Waeren dort weniger Auftraege
    // im Topf als `perDay`, zoege roll() stillschweigend weniger — der Spieler saehe eine halb
    // leere Morgen-Karte, ohne dass irgendetwas fehlschluege.
    const d = loadGameData();
    for (let day = 1; day <= d.balancing.day.unlockAfterDay; day++) {
      const topf = d.missions.missions.filter(
        (m) => m.tier === "MVP" && m.fromDay <= day && (m.toDay === undefined || day <= m.toDay)
      );
      expect(topf.length, `Tag ${day} hat nur ${topf.length} Auftraege im Topf`).toBeGreaterThanOrEqual(d.missions.perDay);
    }
  });

  it("Zerlegen und Pressen liegen in den Gratis-Tagen — sonst zeigt der MVP sie nie", () => {
    // Der eigentliche Anlass dieses Waechters: `dismantle_engine` stand auf tier V1 und fromDay 5.
    // Gezogen werden nur MVP-Auftraege, und die Gratis-Tage enden nach unlockAfterDay — der
    // Auftrag war damit doppelt unerreichbar, obwohl Wrack, Zerlegen und Presse gebaut waren.
    const d = loadGameData();
    const letzterGratis = d.balancing.day.unlockAfterDay;
    for (const id of ["dismantle_engine", "press_car"]) {
      const m = d.missions.missions.find((x) => x.id === id)!;
      expect(m, `${id} fehlt`).toBeTruthy();
      expect(m.tier, `${id} muss MVP sein, sonst wird er nie gezogen`).toBe("MVP");
      expect(m.fromDay, `${id} liegt hinter dem letzten Gratis-Tag ${letzterGratis}`).toBeLessThanOrEqual(letzterGratis);
    }
  });

  it("kein Auftrag verlangt ein Wrack, bevor eines geliefert werden kann", () => {
    const d = loadGameData();
    for (const m of d.missions.missions) {
      if (m.tier !== "MVP" || (m.type !== "dismantle" && m.type !== "press")) continue;
      const defId = String(m.params["compositeDefId"]);
      const bringer = d.customers.customers.filter((c) => c.compositeDefId === defId);
      expect(bringer.length, `${m.id}: niemand liefert ${defId}`).toBeGreaterThan(0);
      const frueheste = Math.min(...bringer.map((c) => c.fromDay));
      expect(m.fromDay, `${m.id} startet vor der ersten Lieferung (Tag ${frueheste})`).toBeGreaterThanOrEqual(frueheste);
    }
  });
});

describe("Zerlege-Auftrag", () => {
  it("wird ab Tag 2 angeboten, vorher nicht", () => {
    const pool = (day: number) =>
      loadGameData().missions.missions.filter((m) => m.tier === "MVP" && m.fromDay <= day).map((m) => m.id);
    expect(pool(1)).not.toContain("dismantle_engine");
    expect(pool(2)).toContain("dismantle_engine");
  });

  it("abgerissener Motor erfuellt ihn: Bonus im Konto, ein Stern", () => {
    const sim = newSim(2);
    const m = force(sim, "dismantle_engine");
    const geld0 = sim.world.economy.moneyEur, sterne0 = sim.world.economy.starsTotal;
    const erfuellt: string[] = [];
    sim.bus.on("missionCompleted", ({ missionId }) => erfuellt.push(missionId));

    // ein anderes Teil zaehlt nicht
    sim.bus.emit("partTorn", { compositeId: cid, partId: "wheel_fl", itemId: iid("i1"), kg: 25 });
    expect(m.done, "Rad ist nicht der Motor").toBe(false);

    sim.bus.emit("partTorn", { compositeId: cid, partId: "engine", itemId: iid("i2"), kg: 210 });
    expect(m.done).toBe(true);
    expect(erfuellt).toEqual(["dismantle_engine"]);
    expect(sim.world.economy.moneyEur - geld0).toBeCloseTo(m.def.bonusEur, 2);
    expect(sim.world.economy.starsTotal - sterne0).toBe(sim.data.missions.starsPerMission);
    expect(sim.world.day.report.missionBonusEur).toBeCloseTo(m.def.bonusEur, 2);
  });

  it("zahlt den Bonus nur einmal, auch wenn ein zweiter Motor faellt", () => {
    const sim = newSim(2);
    const m = force(sim, "dismantle_engine");
    const geld0 = sim.world.economy.moneyEur;
    for (let i = 0; i < 3; i++) sim.bus.emit("partTorn", { compositeId: cid, partId: "engine", itemId: iid(`i${i}`), kg: 210 });
    expect(sim.world.economy.moneyEur - geld0).toBeCloseTo(m.def.bonusEur, 2);
    expect(sim.world.day.report.missionsDone).toBe(1);
  });
});

describe("Presse-Auftrag", () => {
  it("wird ab Tag 3 angeboten, vorher nicht", () => {
    const pool = (day: number) =>
      loadGameData().missions.missions.filter((m) => m.tier === "MVP" && m.fromDay <= day).map((m) => m.id);
    expect(pool(2)).not.toContain("press_car");
    expect(pool(3)).toContain("press_car");
  });

  it("ein fertiges Paket erfuellt ihn", () => {
    const sim = newSim(3);
    const m = force(sim, "press_car");
    const geld0 = sim.world.economy.moneyEur;
    sim.bus.emit("pressDone", { compositeId: cid, itemId: iid("bale1"), kg: 700 });
    expect(m.done).toBe(true);
    expect(sim.world.economy.moneyEur - geld0).toBeCloseTo(m.def.bonusEur, 2);
  });
});
