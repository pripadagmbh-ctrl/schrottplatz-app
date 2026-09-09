import { loadGameData, DataError } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { debugSnapshot } from "@/sim/snapshot/Snapshot";
import { Renderer } from "@/view/Renderer";
import { DebugOverlay } from "@/ui/DebugOverlay";
import { GripChip } from "@/ui/GripChip";
import { Hud } from "@/ui/Hud";
import { DaySheet } from "@/ui/DaySheet";
import { TutorialBanner } from "@/ui/TutorialBanner";
import { BrokenSaveDialog } from "@/ui/BrokenSaveDialog";
import { MenuPanel } from "@/ui/MenuPanel";
import { AudioSystem } from "@/view/audio/AudioSystem";
import { Persistence } from "./Persistence";
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

  // M4b: Spielstand laden, sonst neues Spiel (Tag 0 = Einweisung, leerer Platz — die Lektionen liefern das Material, E-026)
  const persistence = new Persistence(sim, VERSION);
  const restored = await persistence.restore();
  if (!restored && new URLSearchParams(location.search).has("pile")) { // Dev-Weg: ?pile → Start-Haufen wie in M1–M4a
    sim.scrap.spawnPile(String(data.balancing.scrap["startPileZone"] ?? "intake"), Number(data.balancing.scrap["startPileCount"] ?? 150), 42);
  }
  sim.settle();
  persistence.wire();
  const audio = new AudioSystem(sim.bus);

  const renderer = new Renderer(canvas, data, sim.level.boxes, Number(data.balancing.budgets["pixelRatioMax"]));
  let pileSeed = 100;
  const dumpPile = () => { sim.scrap.spawnPile("intake", 150, pileSeed++); };
  const overlay = new DebugOverlay(document.body, data.i18n as Record<string, unknown>, { dumpPile });
  const chip = new GripChip(document.body, data.i18n as Record<string, unknown>, data.materials.materials);
  const hud = new Hud(document.body, data, sim.bus, (cid) => { if (!sim.vehicles.requestPickup(cid)) sim.bus.emit("toast", { text: "Abholer ist schon unterwegs", kind: "info" }); }, () => sim.day.endDay());
  const sheet = new DaySheet(document.body, data, sim, {
    onStart: () => sim.day.startDay(), onNext: () => sim.day.nextDay(), onRestart: () => void persistence.restart(),
    onExport: () => persistence.export(), onImport: (f) => void persistence.import(f).then((ok) => { if (!ok) sim.bus.emit("toast", { text: "Datei ist kein Spielstand", kind: "bad" }); }),
  });
  const menu = new MenuPanel(document.body, data.i18n as Record<string, unknown>, audio.muted, {
    onNewGame: () => void persistence.restart(), onExport: () => persistence.export(), onToggleMute: () => audio.toggleMute(),
    onImport: (f) => void persistence.import(f).then((ok) => { if (!ok) sim.bus.emit("toast", { text: "Datei ist kein Spielstand", kind: "bad" }); }),
  });
  const banner = new TutorialBanner(document.body, data.i18n as Record<string, unknown>, () => sim.tutorial.skip());
  if (persistence.service.broken) new BrokenSaveDialog(document.body, data.i18n as Record<string, unknown>, { onRestart: () => void persistence.restart(), onImport: (f) => void persistence.import(f) });

  const ex = data.balancing.excavator as Record<string, number>;
  const input = new InputMapper(canvas, document.body, data.controls, Number(ex["rotatorStepDeg"]), Number(ex["rotatorRateDegS"]));
  const camFrame = { camOrbit: { dx: 0, dy: 0 }, camZoom: 0 };

  const loop = new GameLoop(sim.dt, data.balancing.physics.maxCatchUpSteps, {
    simStep: (dt) => {
      input.fill(sim.control, dt, sim.world.excavator.grapple);
      if (sheet.open || menu.open) resetControlFrame(sim.control); // Karte oder Menue offen: Bagger steht
      if (sim.control.actions.has("toggleDriveMode")) sim.world.excavator.driveMode = !sim.world.excavator.driveMode;
      // Kamera-Eingaben pro Bild sammeln — sie gehen an die Ansicht, nicht an die Simulation
      camFrame.camOrbit.dx += sim.control.camOrbit.dx; camFrame.camOrbit.dy += sim.control.camOrbit.dy; camFrame.camZoom += sim.control.camZoom;
      if (sim.control.actions.has("toggleDebug")) overlay.toggle();
      if (sim.control.actions.has("cycleCamera")) renderer.rig.cycle();
      sim.step();
      renderer.syncExcavator(sim.world, sim.excavator.pose, sim.excavator.prev, sim.control, sim.aim.state, sim.vehicles.runs);
      chip.update(sim.aim.state);
      hud.update(sim.world, sim.vehicles.runs.some((r) => r.def.id === "rolloff"), sim.missions.active, sim.day.deliveriesFinished);
      sheet.update(); banner.update(sim.tutorial.state, performance.now()); persistence.tick(dt);
    },
    render: (alpha, frameDt) => {
      renderer.render(sim.world, alpha, frameDt, { ...sim.control, camOrbit: camFrame.camOrbit, camZoom: camFrame.camZoom });
      camFrame.camOrbit.dx = 0; camFrame.camOrbit.dy = 0; camFrame.camZoom = 0;
      overlay.update({ ...debugSnapshot(sim.world, sim.physics), fps: loop.fps, frameMs: loop.frameMs, drawCalls: renderer.drawCalls, tris: renderer.triangles, dropped: loop.droppedSteps, version: VERSION, held: sim.grip.count, heldKg: sim.grip.totalMassKg, closure: sim.world.excavator.grapple, plow: sim.excavator.plowFactor });
    },
  });

  document.addEventListener("keydown", (e) => { if (e.code === "KeyP" && !e.repeat) dumpPile(); if (e.code === "KeyK" && !e.repeat) sim.vehicles.requestDelivery(); if (e.code === "KeyM" && !e.repeat) audio.toggleMute(); });
  const unlock = () => audio.unlock(); document.addEventListener("pointerdown", unlock, { passive: true }); document.addEventListener("keydown", unlock);
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
