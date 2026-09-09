import { test, expect, devices } from "@playwright/test";

/**
 * Layout-Wächter M3 (Briefing Kap. 5.2, Abnahme M3): Touch-Oberfläche auf drei Viewports —
 * iPad quer, iPhone mini quer (Kompaktlayout) und ein zweites Kompaktformat. Prüft per getBoundingClientRect():
 *  - alle Tippziele ≥ 44 px, - keine Überlappung zwischen Knöpfen, Chip und Overlay-Box,
 *  - Sticks erscheinen dort, wo der Daumen aufsetzt, - GREIFEN über den rechten Stick löst in der Simulation aus.
 */
const viewports = [
  { name: "iPad quer", width: 1180, height: 820, compact: false },
  { name: "iPhone mini quer", width: 812, height: 375, compact: false },
  { name: "Kompakt 390 quer", width: 844, height: 390, compact: false },
  // Safari mit Leisten: Debug-Box (nur Dev) darf hier überlappen — im Live-Build ist sie unsichtbar
  { name: "iPhone mini quer mit Safari-Leisten", width: 812, height: 265, compact: false, ignoreDebugBox: true },
  // Debug-Box (nur Dev) darf im Hochformat unter der Einweisung liegen — im Live-Build ist sie unsichtbar
  { name: "iPhone mini hoch", width: 375, height: 812, compact: true, ignoreDebugBox: true },
];

interface Box { id: string; x: number; y: number; w: number; h: number }
function overlaps(a: Box, b: Box): boolean { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

for (const vp of viewports) {
  test(`Touch-Layout ${vp.name} (${vp.width}×${vp.height})`, async ({ browser }) => {
    const context = await browser.newContext({ ...devices["iPad (gen 7) landscape"], viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.locator("body[data-ready='1']")).toBeAttached({ timeout: 30_000 });
    await expect(page.locator("#touch-layer")).toBeAttached();
    // M4b: Morgen-Karte schliessen, sonst steht der Bagger
    await page.locator(".sheet button[data-act='start']").dispatchEvent("pointerup");
    await expect(page.locator(".sheet")).toBeHidden();
    await expect(page.locator(".tut")).toBeVisible(); // Einweisung Tag 0 — ihr Knopf darf nichts ueberlappen
    expect(await page.locator("#touch-layer").evaluate((el) => el.classList.contains("compact"))).toBe(vp.compact);

    const boxes: Box[] = await page.evaluate(() =>
      ["btn-drive", "btn-rot-l", "btn-rot-r", "btn-camera", "tut-skip", "debug-box"].map((id) => {
        const r = document.getElementById(id)!.getBoundingClientRect();
        return { id, x: r.x, y: r.y, w: r.width, h: r.height };
      }));
    for (const b of boxes) {
      if (b.id === "debug-box") continue;
      expect(b.w, `${b.id} Breite`).toBeGreaterThanOrEqual(44);
      expect(b.h, `${b.id} Höhe`).toBeGreaterThanOrEqual(44);
      expect(b.x, `${b.id} links im Bild`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w, `${b.id} rechts im Bild`).toBeLessThanOrEqual(vp.width);
      expect(b.y + b.h, `${b.id} unten im Bild`).toBeLessThanOrEqual(vp.height);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if ("ignoreDebugBox" in vp && (boxes[i]!.id === "debug-box" || boxes[j]!.id === "debug-box")) continue;
      expect(overlaps(boxes[i]!, boxes[j]!), `${boxes[i]!.id} überlappt ${boxes[j]!.id}`).toBe(false);
    }

    // Ab hier wie im Live-Build: Debug-Box aus (sie ist nur Dev und würde bei 265 px Höhe den Stick-Tipp abfangen)
    if ("ignoreDebugBox" in vp) await page.keyboard.press("F3");
    // Stick erscheint unter dem Daumen (linke Zone) und liefert eine Achse an die Simulation
    const lx = Math.round(vp.width * 0.2), ly = Math.round(vp.height * 0.75);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: lx, y: ly, id: 1 }] });
    await page.waitForTimeout(50);
    const stick = await page.locator("#stick-left").boundingBox();
    expect(stick, "Stick sichtbar").not.toBeNull();
    expect(Math.abs(stick!.x + stick!.width / 2 - lx)).toBeLessThanOrEqual(3); // Rahmen 2 px
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: lx, y: ly - 50, id: 1 }] });
    // Headless rendert ~4 fps und die Simulation holt nur begrenzt auf — deshalb warten, bis der Wert steht, statt fester Zeit
    await page.waitForFunction(() => (window.__bagerana?.sim.control.boom ?? 0) > 0.3, undefined, { timeout: 5000 }).catch(() => undefined);
    const boom = await page.evaluate(() => window.__bagerana?.sim.control.boom ?? 0);
    expect(boom, "Hauptarm hebt").toBeGreaterThan(0.3);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(60);
    expect(await page.locator("#stick-left").isHidden()).toBe(true);

    // Rechter Stick nach rechts = Spinne schließt (Rückfrage M3-1)
    const rx = Math.round(vp.width * 0.8), ry = Math.round(vp.height * 0.75);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rx, y: ry, id: 2 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: rx + 55, y: ry, id: 2 }] });
    await page.waitForFunction(() => (window.__bagerana?.sim.control.grapple ?? 0) > 0.3, undefined, { timeout: 5000 }).catch(() => undefined);
    const grapple = await page.evaluate(() => window.__bagerana?.sim.control.grapple ?? 0);
    expect(grapple, "Spinne schließt").toBeGreaterThan(0.3);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    // Doppeltipp: zwei Daumen nacheinander (links/rechts) dürfen NICHT wechseln. Der Positivfall steht in
    // test/unit/tapdetector.test.ts — Headless braucht ~2 s pro Touch, ein echter 0,25-s-Tipp ist dort nicht möglich.
    const mode = () => page.evaluate(() => window.__bagerana?.renderer.rig.mode);
    const tap = async (x: number, y: number, id: number) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
    const m0 = await mode();
    await tap(lx, ly, 3); await page.waitForTimeout(60); await tap(rx, ry, 4); await page.waitForTimeout(700); // Headless rendert nur ~4 fps
    expect(await mode(), "zwei Daumen ≠ Doppeltipp").toBe(m0);

    // Overlay aus → Box darf nicht mehr gezeichnet werden (iPhone-Befund 08.09.: display:grid schlug das hidden-Attribut)
    const disp = () => page.locator("#debug-box").evaluate((el) => getComputedStyle(el).display);
    if ((await disp()) !== "none") { await page.keyboard.press("F3"); await page.waitForTimeout(100); }
    expect(await disp()).toBe("none");

    expect(errors, "Seitenfehler").toEqual([]);
    await context.close();
  });
}
