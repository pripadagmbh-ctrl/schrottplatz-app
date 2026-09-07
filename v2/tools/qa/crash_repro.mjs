import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.goto("http://localhost:5173/");
await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const g = window.__game, out = {};
  g.step(120);
  const it = g.items.items.find((i) => i.massKg <= 45 && i.body.isDynamic());
  out.attached = g.grip.attachBody(it.body);
  out.gripped = g.grip.grippedCount;
  // Szenario: Teil wird entfernt, waehrend es in der Spinne haengt (Presse/Verkauf/Buendelung)
  g.items.remove(it, true);
  try { g.grip.releaseAll(); out.release = "OK"; } catch (e) { out.release = "FEHLER: " + String(e).slice(0, 100); }
  try { g.step(1); out.stepAfter = "OK"; } catch (e) { out.stepAfter = "FEHLER: " + String(e).slice(0, 100); }
  try { g.step(1); out.stepAfter2 = "OK"; } catch (e) { out.stepAfter2 = "FEHLER: " + String(e).slice(0, 100); }
  return out;
});
console.log(r);
await browser.close();
