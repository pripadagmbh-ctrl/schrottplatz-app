import { test, expect } from "@playwright/test";

/**
 * Rauchtest (M0): Seite lädt, Boot-Screen verschwindet, Overlay zeigt fps > 0,
 * keine Konsolenfehler, Draw Calls unter dem Desktop-Budget.
 */
test("leere Szene startet ohne Fehler und zeigt Messwerte", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.locator("body[data-ready='1']")).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(1500);

  const overlay = page.locator("#debug-overlay");
  await expect(overlay).toBeVisible();
  const text = await overlay.textContent();
  expect(text).toMatch(/fps \d+/);
  const fps = Number(/fps (\d+)/.exec(text ?? "")?.[1] ?? 0);
  expect(fps).toBeGreaterThan(0);
  const drawCalls = Number(/draw calls (\d+)/.exec(text ?? "")?.[1] ?? 999);
  expect(drawCalls).toBeLessThanOrEqual(400);

  const stepped = await page.evaluate(() => window.__bagerana?.sim.world.step ?? 0);
  // Headless-Software-Rendering schafft nur wenige Bilder; es zählt, dass die Simulation überhaupt läuft
  expect(stepped).toBeGreaterThan(10);

  // M1: Start-Haufen liegt schlafend da; Draw Calls bleiben unter dem Desktop-Budget trotz 150 Teilen
  const state = await page.evaluate(() => {
    const g = window.__bagerana!;
    return { items: g.sim.world.items.size, awake: g.sim.physics.stats().awake, drawCalls: g.renderer.drawCalls };
  });
  expect(state.items).toBe(150);
  expect(state.awake).toBeLessThanOrEqual(5);
  expect(state.drawCalls).toBeLessThanOrEqual(400);

  // Debug-Knopf „Haufen kippen": weitere 150 Teile fallen, nichts stürzt ab
  await page.click("#debug-dump");
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ items: window.__bagerana!.sim.world.items.size, step: window.__bagerana!.sim.world.step }));
  expect(after.items).toBe(300);
  expect(after.step).toBeGreaterThan(stepped);
  expect(errors).toEqual([]);
});
