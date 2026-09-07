import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const variants = {
  pure1: "for (let i=0;i<N;i++) w.step();",
  pure2: "for (let i=0;i<N;i++) w.step();",
  pure3: "for (let i=0;i<N;i++) w.step();",
  pure4: "for (let i=0;i<N;i++) w.step();",
  pure: "for (let i=0;i<N;i++) w.step();",
};
const out = {};
for (const [name, code] of Object.entries(variants)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  out[name] = await page.evaluate(async (code) => {
    const g = window.__game, w = g.physics.world;
    const awake = () => { let a = 0, dyn = 0; w.bodies.forEach((b) => { if (b.isDynamic()) { dyn++; if (!b.isSleeping()) a++; } }); return `${a}/${dyn}`; };
    const run = new Function("g", "w", "N", code);
    const curve = [];
    for (let k = 0; k < 5; k++) { run(g, w, 600); curve.push(awake()); }
    return curve.join(" -> ");
  }, code);
  await page.close();
  console.log(name, out[name]);
}
await browser.close();
