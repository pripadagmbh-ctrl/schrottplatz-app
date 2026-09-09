import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";

/**
 * M4b-Waechter: Tagesstruktur, Auftraege, Tutorial, Spielstand.
 *  - Morgen → Betrieb → Feierabend: Fixkosten auf den Cent, Zinsen nur bei Minus, Pleite unter der Kreditlinie
 *  - Tag 0 hat keine Auftraege, Tag ≥ 1 genau perDay; Seed = Tag → reproduzierbar
 *  - deliver-Auftrag erfuellt sich durch einen Verkauf mit genug kg und Reinheit; Bonus landet im Konto und in der Bilanz
 *  - Tutorial: Lektion 1 fuehrt Achse fuer Achse durch, Fuhren an Tag 0 nur vom Tutorial
 *  - save/load: Tag, Konto, Auftraege, Tutorial-Abschluss ueberleben eine Runde
 */
beforeAll(async () => { await initPhysics(); });

function newSim() {
  const d = loadGameData();
  // Keine automatischen Anlieferungen: sonst haengen die Geldpruefungen am Zufall bzw. am Ankaufspreis des Wracks,
  // das seit 09.09. schneller an der Annahme steht (kuerzere Tieflader-Route). loadGameData teilt das Objekt zwischen
  // Tests, deshalb wird der Wert hier ausdruecklich gesetzt.
  d.balancing.vehicles = { ...d.balancing.vehicles, autoDeliveries: false };
  const sim = new Simulation(d); sim.init();
  return sim;
}

describe("Tagesstruktur (DaySystem)", () => {
  it("Morgen → Betrieb → Feierabend: Fixkosten, Bilanz, naechster Tag", () => {
    const sim = newSim();
    const fixed = Number(sim.data.balancing.economy["fixedCostsPerDayEur"]);
    const phases: string[] = []; sim.bus.on("dayPhaseChanged", ({ phase }) => phases.push(phase));
    expect(sim.world.day.phase).toBe("morning");
    expect(sim.day.endDay()).toBe(false); // nicht aus dem Morgen heraus
    expect(sim.day.startDay()).toBe(true);
    sim.run(60);
    const m0 = sim.world.economy.moneyEur;
    expect(sim.day.endDay()).toBe(true);
    expect(sim.world.day.phase).toBe("evening");
    expect(sim.world.economy.moneyEur).toBeCloseTo(m0 - fixed, 2);
    expect(sim.world.day.report.fixedEur).toBe(fixed);
    expect(sim.world.day.report.interestEur).toBe(0); // Konto im Plus
    expect(sim.world.economy.stats.daysPlayed).toBe(1);
    expect(sim.day.nextDay()).toBe(true);
    expect(sim.world.day).toMatchObject({ day: 1, phase: "morning", deliveriesToday: 0, deliveriesDone: 0 });
    expect(phases).toEqual(["work", "evening", "morning"]);
    sim.dispose();
  });

  it("Minus wird verzinst; unter der Kreditlinie ist Schluss", () => {
    const sim = newSim();
    const e = sim.data.balancing.economy; const f = Number(e["debtInterestFactor"]), limit = Number(e["creditLimitEur"]);
    sim.day.startDay(); sim.world.economy.moneyEur = -400; sim.day.endDay();
    const fixed = Number(e["fixedCostsPerDayEur"]);
    const afterFixed = -400 - fixed; const interest = Math.round(-afterFixed * (f - 1) * 100) / 100;
    expect(sim.world.economy.moneyEur).toBeCloseTo(afterFixed - interest, 2);
    expect(sim.world.day.phase).toBe("evening");
    sim.day.nextDay(); sim.day.startDay(); sim.world.economy.moneyEur = limit - 1;
    let ended = false; sim.bus.on("dayEnded", ({ bankrupt }) => (ended = bankrupt));
    sim.day.endDay();
    expect(ended).toBe(true); expect(sim.world.day.phase).toBe("ended");
    sim.dispose();
  });
});

describe("Auftraege (MissionSystem)", () => {
  it("Tag 0 leer, Tag 1 genau perDay Stueck, reproduzierbar", () => {
    const a = newSim(), b = newSim();
    a.day.startDay(); a.run(6); expect(a.missions.active.length).toBe(0);
    a.day.endDay(); a.day.nextDay(); a.run(6);
    b.day.startDay(); b.run(6); b.day.endDay(); b.day.nextDay(); b.run(6);
    expect(a.missions.active.length).toBe(a.data.missions.perDay);
    expect(a.missions.active.map((m) => m.def.id)).toEqual(b.missions.active.map((m) => m.def.id));
    expect(new Set(a.missions.active.map((m) => m.def.id)).size).toBe(a.data.missions.perDay);
    for (const m of a.missions.active) expect(m.def.fromDay).toBeLessThanOrEqual(1);
    a.dispose(); b.dispose();
  });

  it("deliver-Auftrag: Verkauf mit genug kg und Reinheit → Bonus im Konto und in der Bilanz, ein Stern", () => {
    const sim = newSim();
    sim.day.startDay(); sim.day.endDay(); sim.day.nextDay(); sim.day.startDay(); sim.run(6);
    // Auftrag von Hand setzen — welcher gezogen wurde, ist Zufall
    const def = sim.data.missions.missions.find((m) => m.id === "deliver_steel_medium")!;
    sim.missions.active.length = 0; sim.missions.active.push({ def, progress: 0, target: Number(def.params["kg"]), done: false });
    const cont = sim.world.containers.get("pile_steel" as never)!; cont.contentKg = 1600; cont.contaminationKg = 50; // Reinheit 0,97
    const m0 = sim.world.economy.moneyEur; const stars0 = sim.world.economy.starsTotal;
    let completed = ""; sim.bus.on("missionCompleted", ({ missionId }) => (completed = missionId));
    const pick = sim.vehicles.requestPickup("pile_steel")!;
    let steps = 0; while (pick.stage !== "done" && steps < 200 * 60) { sim.step(); steps++; }
    expect(completed).toBe("deliver_steel_medium");
    expect(sim.world.economy.starsTotal).toBe(stars0 + sim.data.missions.starsPerMission);
    expect(sim.world.day.report.missionBonusEur).toBe(def.bonusEur);
    expect(sim.world.day.report.salesEur).toBeGreaterThan(0);
    expect(sim.world.economy.moneyEur).toBeCloseTo(m0 + sim.world.day.report.salesEur + def.bonusEur, 2);
    sim.dispose();
  });
});

describe("Einweisung (TutorialSystem)", () => {
  it("Tag 0: startet mit dem Arbeitstag, fuehrt Achse fuer Achse, keine Auto-Fuhren", () => {
    const sim = newSim();
    const t = sim.tutorial.state;
    expect(t.active).toBe(false);
    sim.day.startDay(); sim.run(6);
    expect(t.active).toBe(true); expect(t).toMatchObject({ lesson: 1, step: 1 });
    expect([...sim.world.items.values()].filter((i) => i.origin === "tutorial").length).toBe(Number(sim.data.balancing.tutorial["lesson1ItemCount"]));
    const holdSteps = Math.ceil(Number(sim.data.balancing.tutorial["inputHoldS"]) * 60) + 12;
    sim.control.boom = 1; sim.run(holdSteps); sim.control.boom = 0; expect(t.step).toBe(2);
    sim.control.cab = 1; sim.run(holdSteps); sim.control.cab = 0; expect(t.step).toBe(3);
    sim.control.stick = -1; sim.run(holdSteps); sim.control.stick = 0; expect(t.step).toBe(4);
    sim.control.grapple = 1; sim.run(90); sim.control.grapple = -1; sim.run(90); sim.control.grapple = 0; expect(t.step).toBe(5);
    sim.run(60 * 20); // 20 s Betrieb an Tag 0 — keine automatische Fuhre
    expect(sim.vehicles.runs.length).toBe(0);
    expect(sim.world.day.deliveriesToday).toBe(0);
    sim.tutorial.skip(); expect(t.finished).toBe(true); expect(t.active).toBe(false);
    sim.dispose();
  });

  it("Spielstand: Tag, Konto, Auftraege, Tutorial-Abschluss ueberleben save/load", () => {
    const a = newSim();
    a.day.startDay(); a.tutorial.skip(); a.day.endDay(); a.day.nextDay(); a.day.startDay(); a.run(6);
    a.world.economy.moneyEur = 4321.55; a.world.economy.sortPoints = 77; a.missions.active[0]!.progress = 12;
    const blob = JSON.parse(JSON.stringify(a.save())) as Record<string, unknown>;
    const b = newSim(); b.load(blob); b.run(6);
    expect(b.world.day.day).toBe(1); expect(b.world.day.phase).toBe("work");
    expect(b.world.economy.moneyEur).toBe(4321.55); expect(b.world.economy.sortPoints).toBe(77);
    expect(b.missions.active.map((m) => m.def.id)).toEqual(a.missions.active.map((m) => m.def.id));
    expect(b.missions.active[0]!.progress).toBe(12);
    expect(b.tutorial.state.finished).toBe(true);
    // Kaputter Block: wird ignoriert, nichts wirft
    const c = newSim(); expect(() => c.load({ day: { day: "x" }, missions: 5, tutorial: null } as never)).not.toThrow();
    expect(c.world.day.day).toBe(0);
    a.dispose(); b.dispose(); c.dispose();
  });
});

/**
 * Grundstock auf dem Platz (E-057, Patrick 09.09.: „es soll auch immer ein Schrotthaufen liegen bleiben").
 * Morgens wird die Abladefläche aufgefüllt, wenn zu wenig darauf liegt — abgeräumt werden darf trotzdem.
 */
describe("Schrotthaufen bleibt liegen", () => {
  it("leerer Platz wird zum Tagesbeginn aufgefüllt, voller nicht", () => {
    const sim = newSim();
    const kgAufPlatz = () => [...sim.world.items.values()]
      .filter((i) => i.state === "loose" && sim.level.inZone("intake_pile", i.pos.x, i.pos.z))
      .reduce((s, i) => s + i.massKg, 0);
    const b = sim.data.balancing.scrap as Record<string, number>;

    expect(kgAufPlatz(), "vor Tagesbeginn ist der Platz leer").toBe(0);
    sim.day.startDay();
    sim.settle();
    const nachher = kgAufPlatz();
    expect(nachher, "aufgefüllt bis in die Nähe des Zielwerts").toBeGreaterThan(Number(b["pileMinKg"]));

    // zweiter Tag: es liegt genug, also kein Nachschub
    sim.day.endDay(); sim.day.nextDay();
    const vorTag2 = kgAufPlatz();
    sim.day.startDay(); sim.settle();
    expect(kgAufPlatz(), "voller Platz bekommt keinen Nachschub").toBeCloseTo(vorTag2, 0);
    sim.dispose();
  });
});
