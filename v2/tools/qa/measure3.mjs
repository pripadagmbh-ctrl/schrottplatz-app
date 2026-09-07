import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://localhost:5173/");
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1000);

const r = await page.evaluate(async () => {
  const g = window.__game, w = g.physics.world, out = {};
  const awake = () => { let a = 0, dyn = 0; w.bodies.forEach((b) => { if (b.isDynamic()) { dyn++; if (!b.isSleeping()) a++; } }); return { a, dyn }; };
  // A) Nur Physik, keine Spiellogik
  g.step(300); // settle mit Logik
  out.afterLogic300 = awake();
  for (let i = 0; i < 600; i++) w.step();
  out.pureStep600 = awake();
  for (let i = 0; i < 600; i++) w.step();
  out.pureStep1200 = awake();
  // B) Physik + nur excavator.update (Krallenkollider-Updates)
  for (let i = 0; i < 600; i++) { g.excavator.update(1 / 60, g.input); w.step(); }
  out.withExcavator600 = awake();
  // C) Physik + clampSpeeds
  for (let i = 0; i < 600; i++) { w.step(); g.items.clampSpeeds(); }
  out.withClamp600 = awake();
  // D) Physik + vehicles
  for (let i = 0; i < 600; i++) { w.step(); g.vehicles.update(1 / 60); }
  out.withVehicles600 = awake();
  // E) Physik + staff
  for (let i = 0; i < 600; i++) { w.step(); g.staff.update(1 / 60, false); }
  out.withStaff600 = awake();
  // F) Physik + composites/fence
  for (let i = 0; i < 600; i++) { w.step(); g.composites.update(); g.fence.update(); }
  out.withCompFence600 = awake();
  // G) Ganz
  g.step(600);
  out.full600 = awake();
  // Sleep-Parameter
  out.sleepParams = { dt: w.timestep, iters: w.integrationParameters.numSolverIterations };
  // Rapier-Sicherheit: Callback mit fruehem return false, danach schreibender Zugriff
  out.earlyReturn = "n/a";
  try {
    const RAPIER = (await import("@dimforge/rapier3d-compat")).default;
    const ball = new RAPIER.Ball(3);
    const p = g.excavator.position;
    let n = 0;
    w.intersectionsWithShape({ x: -9, y: 0.5, z: 1 }, { x: 0, y: 0, z: 0, w: 1 }, ball, () => { n++; return false; });
    w.step();
    g.items.clampSpeeds();
    out.earlyReturn = `ok, callback ${n}x, danach step + setLinvel ohne Fehler`;
  } catch (e) { out.earlyReturn = "FEHLER: " + String(e); }
  // Kinematische Koerper: Rapier-Kontakt Kinematik<->Dynamik
  return out;
});
console.log(JSON.stringify({ r, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
