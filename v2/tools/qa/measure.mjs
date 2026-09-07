// Headless-Messung: Physikschritt + Spiellogik über window.__game (Dev-Build)
import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const stats = await page.evaluate(async () => {
  const g = window.__game, p = g.physics, w = p.world;
  const out = {};
  // Renderer-Infos
  out.ua = navigator.userAgent;
  const gl = document.querySelector("canvas").getContext("webgl2") || document.querySelector("canvas").getContext("webgl");
  const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
  out.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?";

  // Zaehlung Bodies/Collider
  const count = () => {
    let bodies = 0, awake = 0, dyn = 0, kin = 0, fix = 0, colliders = 0, sensors = 0;
    const shapes = {};
    w.bodies.forEach((b) => { bodies++; if (!b.isSleeping()) awake++; if (b.isDynamic()) dyn++; else if (b.isKinematic()) kin++; else fix++; });
    w.colliders.forEach((c) => { colliders++; if (c.isSensor()) sensors++; const t = c.shapeType(); shapes[t] = (shapes[t] || 0) + 1; });
    return { bodies, awake, dyn, kin, fix, colliders, sensors, shapes, joints: w.impulseJoints.len(), items: g.items.items.length };
  };
  const rein = () => { const t0 = performance.now(); for (let i = 0; i < 200; i++) w.step(); return (performance.now() - t0) / 200; };
  const logik = () => { const t0 = performance.now(); for (let i = 0; i < 120; i++) g.step(1); return (performance.now() - t0) / 120; };
  const med = (f) => { f(); const l = [f(), f(), f()].sort((a, b) => a - b); return +l[1].toFixed(2); };

  out.start = count();
  out.idlePhysMs = med(rein);
  out.idleStepMs = med(logik);
  // 600 Steps laufen lassen (Haufen setzt sich)
  g.step(600);
  out.settled = count();
  out.settledPhysMs = med(rein);
  out.settledStepMs = med(logik);
  // Last: 6 Fahrzeuge
  for (let f = 0; f < 6; f++) { try { g.vehicles.spawnNow(); } catch (e) { out.spawnErr = String(e); } g.step(60); }
  g.step(200);
  out.loaded = count();
  out.loadedPhysMs = med(rein);
  out.loadedStepMs = med(logik);
  // Alles wecken (Worst Case: nichts schlaeft)
  w.bodies.forEach((b) => b.wakeUp());
  out.allAwake = count();
  const t0 = performance.now(); for (let i = 0; i < 100; i++) w.step(); out.allAwakePhysMs = +((performance.now() - t0) / 100).toFixed(2);
  return out;
});

// Render-Kosten: Frames über rAF messen (SwiftShader, also nur Draw-Call-Zahl aussagekraeftig)
const render = await page.evaluate(async () => {
  const g = window.__game;
  await new Promise((r) => setTimeout(r, 500));
  const t0 = performance.now(); let n = 0;
  await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  const fps = n / ((performance.now() - t0) / 1000);
  // Renderer-Info via THREE-Szene: Anzahl Meshes/Lights
  const THREE = g.THREE;
  // Szene ueber den Bagger-Root suchen
  let scene = g.excavator.root; while (scene.parent) scene = scene.parent;
  let meshes = 0, lights = 0, shadowCasters = 0, sprites = 0, instanced = 0, vertices = 0, mats = new Set(), geos = new Set(), shadowLights = 0;
  scene.traverse((o) => {
    if (o.isMesh) { meshes++; if (o.castShadow) shadowCasters++; if (o.isInstancedMesh) instanced++; geos.add(o.geometry); const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => mats.add(x)); const pa = o.geometry.getAttribute("position"); if (pa) vertices += pa.count; }
    if (o.isSprite) sprites++;
    if (o.isLight) { lights++; if (o.castShadow) shadowLights++; }
  });
  return { fps: +fps.toFixed(1), meshes, lights, shadowLights, shadowCasters, sprites, instanced, vertices, materials: mats.size, geometries: geos.size, pixelRatio: window.devicePixelRatio, memMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null };
});

console.log(JSON.stringify({ stats, render, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
