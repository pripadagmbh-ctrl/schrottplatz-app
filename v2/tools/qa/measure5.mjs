import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
await page.goto("http://localhost:5173/");
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(800);

const r = await page.evaluate(async () => {
  const g = window.__game, THREE = g.THREE, out = {};
  let scene = g.excavator.root; while (scene.parent) scene = scene.parent;
  // Kamera finden: OrbitCamera nicht exportiert -> ueber Renderer nicht moeglich; Frustum aus einer Standardkamera nachbauen
  // Stattdessen: Anzahl sichtbarer Meshes ohne Culling zaehlen und Objekte pro Kategorie
  const cats = {};
  let total = 0, castShadow = 0, transparent = 0, physical = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    total++;
    if (o.castShadow) castShadow++;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.transparent) transparent++;
    if (m.isMeshPhysicalMaterial) physical++;
    // Top-level-Gruppe unter der Szene
    let top = o; while (top.parent && top.parent !== scene) top = top.parent;
    const key = top.name || top.type + (top === g.excavator.root ? ":excavator" : "");
    cats[key] = (cats[key] || 0) + 1;
  });
  out.meshTotal = total; out.castShadow = castShadow; out.transparent = transparent; out.physicalMaterials = physical;
  out.topGroups = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 12);
  // Wie viele Meshes hat der Bagger, ein Item, ein Auto, ein Fahrzeug?
  const count = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh) n++; }); return n; };
  out.excavatorMeshes = count(g.excavator.root);
  out.itemMeshesAvg = +(g.items.items.reduce((s, it) => s + count(it.mesh), 0) / g.items.items.length).toFixed(2);
  out.carMeshes = g.composites.cars.length ? count(g.composites.cars[0].group ?? g.composites.cars[0].mesh ?? new THREE.Group()) : null;
  out.items = g.items.items.length;
  // Lights
  const lights = []; scene.traverse((o) => { if (o.isLight) lights.push(o.type + (o.castShadow ? "(shadow " + o.shadow.mapSize.x + ")" : "")); });
  out.lights = lights;
  // Schattenkarte: Groesse
  // Speicher-Leak-Test: 20 Fahrzeuge spawnen/despawnen und Geometrien im Renderer zaehlen geht nicht ohne renderer; stattdessen Materialien/Geometrien im Scene-Graph vor/nach
  const cnt = () => { const gs = new Set(), ms = new Set(); scene.traverse((o) => { if (o.isMesh) { gs.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => ms.add(m)); } }); return { geos: gs.size, mats: ms.size }; };
  out.before = cnt();
  return out;
});
// Fehlerhafter Spielstand: Item ohne shape -> bootet das Spiel noch?
await page.evaluate(() => {
  localStorage.setItem("schrottplatz_save", JSON.stringify({ schemaVersion: 1, savedAt: "x", moneyEur: 100, items: [{ materialId: "steel", massKg: 10, pos: [0, 1, 0], rot: [0, 0, 0, 1] }], cars: [], fencesBroken: [] }));
});
await page.reload();
await page.waitForTimeout(6000);
const boot1 = await page.evaluate(() => ({ game: !!window.__game, loading: document.getElementById("loading")?.textContent ?? null }));
// NaN-Position im Save
await page.evaluate(() => {
  localStorage.setItem("schrottplatz_save", JSON.stringify({ schemaVersion: 1, savedAt: "x", moneyEur: 100, items: [{ materialId: "steel", massKg: 10, shape: { kind: "box", dims: [1, 1, 1], color: 0 }, pos: [null, null, null], rot: [0, 0, 0, 1] }], cars: [{ pos: [0, 1, 0], rot: [0, 0, 0, 1], crushStage: 0, torn: [], brokenWindows: [] }], fencesBroken: [] }));
});
await page.reload();
await page.waitForTimeout(6000);
const boot2 = await page.evaluate(() => {
  const g = window.__game; if (!g) return { game: false, loading: document.getElementById("loading")?.textContent ?? null };
  g.step(60);
  const it = g.items.items[0]; const p = it.body.translation();
  return { game: true, itemPos: [p.x, p.y, p.z] };
});
await page.evaluate(() => localStorage.removeItem("schrottplatz_save"));
console.log(JSON.stringify({ r, boot_missingShape: boot1, boot_nanPos: boot2, errors: errors.slice(0, 10) }, null, 2));
await browser.close();
