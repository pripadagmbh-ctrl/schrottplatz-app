// Fuzz: 6000 Schritte (100 s Spielzeit) mit zufaelligen Touch-Eingaben; Fehler, NaN, Ausreisser, Explosionen zaehlen
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
await page.goto("http://localhost:5173/");
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(500);
const r = await page.evaluate(async () => {
  const g = window.__game, w = g.physics.world, out = { resets: 0, maxSpeedSeen: 0, over20: 0, nanSeen: 0, grabs: 0, maxGrippedKg: 0, jointsLeft: 0 };
  const orig = g.items.clampSpeeds.bind(g.items);
  g.items.clampSpeeds = function () {
    for (const it of g.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const v = it.body.linvel(); const s = Math.hypot(v.x, v.y, v.z);
      if (!isFinite(s)) out.nanSeen++;
      if (s > out.maxSpeedSeen) out.maxSpeedSeen = s;
      if (s > 20) out.over20++;
      const p = it.body.translation();
      if (Math.abs(p.x) > 45 || Math.abs(p.z) > 60 || p.y < -5 || p.y > 60) out.resets++;
    }
    orig();
  };
  const axes = { drive: 0, steer: 0, cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0, grab: false };
  g.excavator.touch = axes;
  let t0 = performance.now(), maxStepMs = 0;
  for (let i = 0; i < 6000; i++) {
    if (i % 45 === 0) {
      axes.drive = Math.random() * 2 - 1; axes.steer = Math.random() * 2 - 1;
      axes.cab = Math.random() * 2 - 1; axes.boom = Math.random() * 2 - 1; axes.stick = Math.random() * 2 - 1;
      axes.rotator = Math.random() < 0.3 ? Math.random() * 2 - 1 : 0;
      axes.grab = Math.random() < 0.5;
      axes.grapple = axes.grab ? 1 : -1;
    }
    if (i % 600 === 0) { try { g.vehicles.spawnNow(); } catch (e) { out.spawnErr = String(e).slice(0, 100); } }
    if (i % 1500 === 0) { try { g.press.start(); } catch (e) { out.pressErr = String(e).slice(0, 100); } }
    const a = performance.now();
    try { g.step(1); } catch (e) { out.stepErr = String(e).slice(0, 150); out.stepErrAt = i; break; }
    const ms = performance.now() - a; if (ms > maxStepMs) maxStepMs = ms;
    if (g.grip.grippedCount > 0) { out.grabs++; out.maxGrippedKg = Math.max(out.maxGrippedKg, g.grip.totalMassKg); }
  }
  out.totalMs = Math.round(performance.now() - t0);
  out.maxStepMs = +maxStepMs.toFixed(1);
  out.items = g.items.items.length;
  out.bodies = w.bodies.len();
  out.joints = w.impulseJoints.len();
  const ex = g.excavator.position; out.excavatorPos = [+ex.x.toFixed(1), +ex.y.toFixed(1), +ex.z.toFixed(1)];
  out.memMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
  return out;
});
console.log(JSON.stringify({ r, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
