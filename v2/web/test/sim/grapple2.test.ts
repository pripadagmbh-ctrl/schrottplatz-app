import { describe, it, expect, beforeAll } from "vitest";
import { loadGameData } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { clawTipDepth } from "@/shared/clawGeometry";

/**
 * Spinne 2.0 (E-038) — Waechter: die Spinne ist ein dynamischer Koerper an einer Feder.
 *  - Beton: Krallenspitzen bleiben ueber dem Boden (≥ −5 cm, Kapselradius), auch bei Dauerdruck und beim Schliessen.
 *  - Haufen: die Spinne stuetzt sich AUF dem Haufen ab (Kardan deutlich hoeher als auf Beton), kein Teil wird in den
 *    Boden gedrueckt, kein Teil schneller als 3 m/s, keines fliegt vom Platz.
 *  - Pendel: schwingt beim Schwenken aus (< 0,35 rad) und beruhigt sich nach dem Stopp.
 */
beforeAll(async () => { await initPhysics(); });

function lowerFully(sim: Simulation, steps = 420) { sim.control.boom = -1; sim.run(steps); sim.control.boom = 0; }
function tipsY(sim: Simulation): number { return sim.excavator.pose.grapplePos.y - clawTipDepth(sim.excavator.pose.splay); }

describe("Spinne 2.0", () => {
  it("Beton: kein Eintauchen bei Dauerdruck, Schliessen hebt die Spinne nur leicht", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    sim.world.excavator.cab = Math.PI; sim.excavator.resetPendulum(); // freie Flaeche hinter dem Bagger
    lowerFully(sim);
    let minTips = Infinity; for (let i = 0; i < 180; i++) { sim.control.boom = -1; sim.step(); minTips = Math.min(minTips, tipsY(sim)); }
    sim.control.boom = 0;
    expect(minTips, "Spitzen im Beton").toBeGreaterThan(-0.05);
    expect(sim.excavator.groundContact).toBe(true);
    const restY = sim.excavator.pose.grapplePos.y;
    sim.control.grapple = 1; let minClose = Infinity, maxRise = 0;
    for (let i = 0; i < 90; i++) { sim.step(); minClose = Math.min(minClose, tipsY(sim)); maxRise = Math.max(maxRise, sim.excavator.pose.grapplePos.y - restY); }
    expect(minClose, "Spitzen beim Schliessen").toBeGreaterThan(-0.08);
    expect(maxRise, "Hochbocken beim Schliessen").toBeLessThan(0.45);
    sim.dispose();
  });

  it("Haufen: stuetzt sich ab, drueckt nichts in den Boden, schleudert nichts weg", () => {
    const sim = new Simulation(loadGameData()); sim.init();
    sim.scrap.spawnPile("intake_pile", 40, 42); sim.settle();
    const zone = sim.level.zone("intake_pile");
    // Spinne ueber die Haufenmitte, offen absenken und 4 s druecken, dann schliessen und heben
    const s = sim.world.excavator; s.cab = Math.atan2(zone.x - s.pos.x, zone.z - s.pos.z) - s.heading; sim.excavator.resetPendulum();
    let maxSpeed = 0, minItemY = Infinity;
    const scan = () => { for (const it of sim.world.items.values()) { if (it.state !== "loose") continue; const b = sim.physics.safeBody(it.bodyHandle); if (!b) continue; const v = b.linvel(); maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z)); minItemY = Math.min(minItemY, b.translation().y); } };
    sim.control.boom = -1; for (let i = 0; i < 480; i++) { sim.step(); if (i % 5 === 0) scan(); }
    sim.control.boom = 0;
    const onPile = sim.excavator.pose.grapplePos.y;
    sim.control.grapple = 1; for (let i = 0; i < 90; i++) { sim.step(); if (i % 5 === 0) scan(); }
    sim.control.boom = 1; for (let i = 0; i < 120; i++) { sim.step(); if (i % 5 === 0) scan(); }
    sim.control.boom = 0; sim.run(60); scan();
    expect(onPile, "Kardan nicht tiefer als auf Beton (~2,0 m): offene Zinken finden zwischen den Teilen den Boden").toBeGreaterThan(2.0);
    expect(maxSpeed, "kein Teil schneller als 5 m/s (freier Fall vom Haufen ≈ 3–4 m/s ist erlaubt)").toBeLessThan(5);
    expect(minItemY, "kein Teil im Boden").toBeGreaterThan(-0.15);
    for (const it of sim.world.items.values()) expect(sim.level.insideYard(it.pos.x, it.pos.z), `Teil ${it.id} auf dem Platz`).toBe(true);
    expect(sim.grip.count, "Griff aus dem Haufen").toBeGreaterThanOrEqual(1); // 40 Teile auf 6 × 5 m sind duenn gestreut; 150er-Haufen: ~6,5 Teile/Griff (Messung 09.09.)
    sim.dispose();
  });

  it("Pendel: schwingt beim Schwenken aus und beruhigt sich", () => {
    const sim = new Simulation(loadGameData()); sim.init(); const p = sim.excavator.pose;
    sim.control.boom = 1; sim.run(90); sim.control.boom = 0; sim.run(120);
    let max = 0; sim.control.cab = 1; for (let i = 0; i < 240; i++) { sim.step(); max = Math.max(max, Math.hypot(p.swingX, p.swingZ)); }
    expect(max).toBeGreaterThan(0.03); expect(max).toBeLessThan(0.35);
    sim.control.cab = 0; sim.run(180);
    expect(Math.hypot(p.swingX, p.swingZ)).toBeLessThan(0.03);
    sim.dispose();
  });
});
