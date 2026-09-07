import { chromium } from "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const url of ["http://localhost:4173/", "http://localhost:5173/"]) {
  const page = await browser.newPage();
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById("loading"), null, { timeout: 90000 });
  const t1 = Date.now();
  const cpu = await page.evaluate(() => { const e = performance.getEntriesByType("navigation")[0]; return { domContentLoaded: Math.round(e.domContentLoadedEventEnd), load: Math.round(e.loadEventEnd) }; });
  console.log(url, "bis Spiel bereit:", t1 - t0, "ms", cpu);
  await page.close();
}
await browser.close();
