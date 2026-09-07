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
  // Draw calls: renderer.info über Prototyp-Hook abgreifen
  const proto = g.THREE.WebGLRenderer.prototype;
  const orig = proto.render;
  let info = null;
  proto.render = function (s, c) { orig.call(this, s, c); info = { calls: this.info.render.calls, tris: this.info.render.triangles, geos: this.info.memory.geometries, tex: this.info.memory.textures, programs: this.info.programs.length }; };
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  out.renderInfo = info;
  proto.render = orig;

  // Schlafverhalten: 3600 Steps (= 60 s Spielzeit) ohne Eingabe
  const awake = () => { let a = 0, dyn = 0; w.bodies.forEach((b) => { if (b.isDynamic()) { dyn++; if (!b.isSleeping()) a++; } }); return { a, dyn }; };
  out.sleepCurve = [];
  for (let k = 0; k < 6; k++) { g.step(600); out.sleepCurve.push({ steps: (k + 1) * 600, ...awake() }); }
  // Welche wachen Koerper: Geschwindigkeiten
  const vs = [];
  w.bodies.forEach((b) => { if (b.isDynamic() && !b.isSleeping()) { const v = b.linvel(); const p = b.translation(); vs.push({ v: +Math.hypot(v.x, v.y, v.z).toFixed(4), y: +p.y.toFixed(2), m: Math.round(b.mass()) }); } });
  vs.sort((a, b) => b.v - a.v);
  out.awakeTop = vs.slice(0, 8);
  out.awakeSlowest = vs.slice(-5);
  out.vehicleActive = g.vehicles.active ? { kind: g.vehicles.activeKind } : null;

  // Logik-Anteile: einzelne Teile stoppen
  const time = (fn, n = 120) => { fn(); const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return +((performance.now() - t0) / n).toFixed(3); };
  const dummyInput = g.input;
  out.parts = {
    physicsStep: time(() => w.step()),
    excavatorUpdate: time(() => g.excavator.update(1 / 60, dummyInput)),
    clampSpeeds: time(() => g.items.clampSpeeds()),
    compositesUpdate: time(() => g.composites.update()),
    fenceUpdate: time(() => g.fence.update()),
    vehiclesUpdate: time(() => g.vehicles.update(1 / 60)),
    pressUpdate: time(() => g.press.update(1 / 60)),
    staffUpdate: time(() => g.staff.update(1 / 60, false)),
    syncMeshes: time(() => g.items.syncMeshes()),
    containersRecount: time(() => g.containers.recount(g.items, new Set()), 20),
    fullStep: time(() => g.step(1)),
  };
  // Spawn-Last: 150 zusaetzliche Teile
  const THREE = g.THREE;
  const mod = await import("/src/world/scrapItems.ts");
  mod.randomCargo(150).forEach((s, i) => g.items.spawnScrap(s.materialId, s.massKg, s.shape, new THREE.Vector3(-9 + (Math.random() - 0.5) * 6, 6 + i * 0.3, 1 + (Math.random() - 0.5) * 6)));
  g.step(300);
  out.afterSpawn = { items: g.items.items.length, ...awake(), physicsStep: time(() => w.step()), fullStep: time(() => g.step(1)) };
  out.consolidated = g.items.consolidate();
  g.step(120);
  out.afterConsolidate = { items: g.items.items.length, ...awake(), physicsStep: time(() => w.step()), fullStep: time(() => g.step(1)) };
  out.memMB = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
  return out;
});
console.log(JSON.stringify({ r, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
