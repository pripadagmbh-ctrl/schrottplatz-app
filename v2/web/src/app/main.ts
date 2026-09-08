import { loadGameData, DataError } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { debugSnapshot } from "@/sim/snapshot/Snapshot";
import { Renderer } from "@/view/Renderer";
import { DebugOverlay } from "@/ui/DebugOverlay";
import { GripChip } from "@/ui/GripChip";
import { GameLoop } from "./GameLoop";
import { InputMapper } from "./input/InputMapper";
import { resetControlFrame } from "@/sim/control/ControlFrame";

/**
 * Bootstrap (< 150 Zeilen, Architektur Kap. 3): Daten laden → Simulation → Renderer → Loop.
 * Keine Spiellogik hier. Fehler beim Start erscheinen als Klartext, nie als Schwarzbild (QA H2).
 */
declare global { interface Window { __bagerana?: { sim: Simulation; loop: GameLoop; renderer: Renderer; version: string } } }

const VERSION = __APP_VERSION__;

function showFatal(title: string, detail: string): void {
  const el = document.getElementById("boot") ?? document.body;
  el.innerHTML = `<div class="fatal"><h1>${title}</h1><pre>${detail.replace(/</g, "&lt;")}</pre></div>`;
}

async function boot(): Promise<void> {
  const bootEl = document.getElementById("boot");
  const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("Canvas #scene fehlt in index.html");

  const data = loadGameData();
  await initPhysics();

  const sim = new Simulation(data);
  sim.init();

  // M1: Start-Haufen auf der Annahmefläche, vorsimuliert und schlafend (Briefing Kap. 6.5)
  const pileCount = Number(data.balancing.scrap["startPileCount"] ?? 150);
  sim.scrap.spawnPile("intake", pileCount, 42);
  sim.settle();

  const renderer = new Renderer(canvas, data, sim.level.boxes, Number(data.balancing.budgets["pixelRatioMax"]));
  let pileSeed = 100;
  const dumpPile = () => { sim.scrap.spawnPile("intake", 150, pileSeed++); };
  const overlay = new DebugOverlay(document.body, data.i18n as Record<string, unknown>, { dumpPile });
  const chip = new GripChip(document.body, data.i18n as Record<string, unknown>, data.materials.materials);

  const ex = data.balancing.excavator as Record<string, number>;
  const input = new InputMapper(canvas, document.body, data.controls, Number(ex["rotatorStepDeg"]), Number(ex["rotatorRateDegS"]));
  const camFrame = { camOrbit: { dx: 0, dy: 0 }, camZoom: 0 };

  const loop = new GameLoop(sim.dt, data.balancing.physics.maxCatchUpSteps, {
    simStep: (dt) => {
      input.fill(sim.control, dt, sim.world.excavator.grapple);
      if (sim.control.actions.has("toggleDriveMode")) sim.world.excavator.driveMode = !sim.world.excavator.driveMode;
      // Kamera-Eingaben pro Bild sammeln — sie gehen an die Ansicht, nicht an die Simulation
      camFrame.camOrbit.dx += sim.control.camOrbit.dx; camFrame.camOrbit.dy += sim.control.camOrbit.dy; camFrame.camZoom += sim.control.camZoom;
      if (sim.control.actions.has("toggleDebug")) overlay.toggle();
      if (sim.control.actions.has("cycleCamera")) renderer.rig.cycle();
      sim.step();
      renderer.syncExcavator(sim.world, sim.excavator.pose, sim.excavator.prev, sim.control, sim.aim.state);
      chip.update(sim.aim.state);
    },
    render: (alpha, frameDt) => {
      renderer.render(sim.world, alpha, frameDt, { ...sim.control, camOrbit: camFrame.camOrbit, camZoom: camFrame.camZoom });
      camFrame.camOrbit.dx = 0; camFrame.camOrbit.dy = 0; camFrame.camZoom = 0;
      overlay.update({ ...debugSnapshot(sim.world, sim.physics), fps: loop.fps, frameMs: loop.frameMs, drawCalls: renderer.drawCalls, tris: renderer.triangles, dropped: loop.droppedSteps, version: VERSION, held: sim.grip.count, heldKg: sim.grip.totalMassKg, closure: sim.world.excavator.grapple, plow: sim.excavator.plowFactor });
    },
  });

  document.addEventListener("keydown", (e) => { if (e.code === "KeyP" && !e.repeat) dumpPile(); });
  // iOS-Safari: Seiten-Zoom per Doppeltipp/Pinch unterbinden (zweiter Gürtel zu touch-action:none). Nicht-passiv, sonst wirkt preventDefault nicht.
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => { const now = Date.now(); if (now - lastTouchEnd < 350) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("visibilitychange", () => { if (document.hidden) resetControlFrame(sim.control); });
  document.addEventListener("visibilitychange", () => { loop.paused = document.hidden; });
  window.addEventListener("resize", () => renderer.resize());

  window.__bagerana = { sim, loop, renderer, version: VERSION };
  loop.start();
  // Ladebildschirm erst weg, wenn das erste Bild gezeichnet ist.
  requestAnimationFrame(() => requestAnimationFrame(() => { bootEl?.remove(); document.body.dataset["ready"] = "1"; }));
}

boot().catch((err: unknown) => {
  if (err instanceof DataError) showFatal("Datenfehler", err.message);
  else showFatal("Start fehlgeschlagen", err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
  console.error(err);
});
