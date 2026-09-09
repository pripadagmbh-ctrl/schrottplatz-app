import { test, expect } from "@playwright/test";

/**
 * Rauchtest (M0): Seite lädt, Boot-Screen verschwindet, Overlay zeigt fps > 0,
 * keine Konsolenfehler, Draw Calls unter dem Desktop-Budget.
 */
test("leere Szene startet ohne Fehler und zeigt Messwerte", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/?pile"); // Dev-Weg: Start-Haufen wie M1–M4a; neues Spiel beginnt sonst leer (E-026)
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

  // M1/M4a: Start-Haufen liegt schlafend da; Draw Calls bleiben unter dem Desktop-Budget
  const state = await page.evaluate(() => {
    const g = window.__bagerana!;
    return { items: g.sim.world.items.size, awake: g.sim.physics.stats().awake, drawCalls: g.renderer.drawCalls };
  });
  expect(state.items).toBe(40); // Rest-Haufen ueber ?pile (balancing.scrap.startPileCount)
  expect(state.awake).toBeLessThanOrEqual(5);
  expect(state.drawCalls).toBeLessThanOrEqual(400);

  // M4b: Morgen-Karte steht, Bagger reagiert nicht, bis der Arbeitstag beginnt; dann legt die Einweisung 4 Stahlteile hin
  const start = page.locator(".sheet button[data-act='start']");
  await expect(start).toBeVisible();
  await expect(page.locator(".sheet h2")).toHaveText(/Tag 0/);
  await start.dispatchEvent("pointerup");
  await expect(page.locator(".sheet")).toBeHidden();
  await expect(page.locator(".tut")).toBeVisible();
  await page.waitForFunction(() => window.__bagerana!.sim.world.items.size === 44, undefined, { timeout: 10_000 });

  // Debug-Knopf „Haufen kippen": weitere 150 Teile fallen, nichts stürzt ab
  await page.click("#debug-dump");
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ items: window.__bagerana!.sim.world.items.size, step: window.__bagerana!.sim.world.step }));
  expect(after.items).toBe(194);
  expect(after.step).toBeGreaterThan(stepped);

  // M4b: Feierabend → Autosave (IndexedDB) → Neuladen landet wieder am Abend von Tag 0 mit demselben Konto
  await page.evaluate(() => { const g = window.__bagerana!; g.sim.tutorial.skip(); g.sim.day.endDay(); });
  await expect(page.locator(".sheet h2")).toHaveText(/Feierabend — Tag 0/);
  const money = await page.evaluate(() => window.__bagerana!.sim.world.economy.moneyEur);
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator("body[data-ready='1']")).toBeAttached({ timeout: 30_000 });
  await expect(page.locator(".sheet h2")).toHaveText(/Feierabend — Tag 0/);
  const restored = await page.evaluate(() => ({ money: window.__bagerana!.sim.world.economy.moneyEur, items: window.__bagerana!.sim.world.items.size, tut: window.__bagerana!.sim.tutorial.state.finished }));
  expect(restored.money).toBe(money); expect(restored.items).toBe(194); expect(restored.tut).toBe(true);
  // Menue: oeffnen, schliessen — und wirklich weg (display:none), nicht nur hidden-Attribut (iPad 09.09.: Menue verschwand nicht)
  await page.locator("#btn-menu").dispatchEvent("pointerup");
  await expect(page.locator(".menu-panel")).toBeVisible();
  await page.locator(".menu-panel .sell-close").dispatchEvent("pointerup");
  expect(await page.locator(".menu-panel").evaluate((el) => getComputedStyle(el).display)).toBe("none");
  // Vier Ansichten im Kreis (Prototyp, E-032): orbit → top → cabin → side → orbit
  const modes: string[] = [];
  for (let i = 0; i < 4; i++) { modes.push(await page.evaluate(() => window.__bagerana!.renderer.rig.mode)); await page.evaluate(() => window.__bagerana!.renderer.rig.cycle()); }
  expect(modes).toEqual(["orbit", "top", "cabin", "side"]);
  expect(await page.evaluate(() => window.__bagerana!.renderer.rig.mode)).toBe("orbit");
  // Naechster Tag: drei Auftraege auf der Morgen-Karte
  await page.locator(".sheet button[data-act='next']").dispatchEvent("pointerup");
  await expect(page.locator(".sheet h2")).toHaveText(/Tag 1/);
  expect(await page.locator(".sheet li").count()).toBe(3);
  expect(errors).toEqual([]);
});
