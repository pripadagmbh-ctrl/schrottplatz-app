import { loadGameData, DataError } from "@/data/loadData";
import { initPhysics } from "@/sim/world/PhysicsWorld";
import { Simulation } from "@/sim/Simulation";
import { debugSnapshot } from "@/sim/snapshot/Snapshot";
import { Renderer } from "@/view/Renderer";
import { DebugOverlay } from "@/ui/DebugOverlay";
import { GameLoop } from "./GameLoop";

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

  const renderer = new Renderer(canvas, data.level, Number(data.balancing.budgets["pixelRatioMax"]));
  const overlay = new DebugOverlay(document.body, data.i18n as Record<string, unknown>);

  const loop = new GameLoop(sim.dt, data.balancing.physics.maxCatchUpSteps, {
    simStep: () => sim.step(),
    render: (alpha, frameDt) => {
      renderer.render(alpha, frameDt);
      overlay.update({ ...debugSnapshot(sim.world, sim.physics), fps: loop.fps, frameMs: loop.frameMs, drawCalls: renderer.drawCalls, tris: renderer.triangles, dropped: loop.droppedSteps, version: VERSION });
    },
  });

  document.addEventListener("keydown", (e) => { if (e.code === "F3") { e.preventDefault(); overlay.toggle(); } });
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
