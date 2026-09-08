/**
 * Debug-Overlay (Briefing Kap. 14.1, 19.2): fps, Bild-ms, Physik-ms, Körper wach/gesamt,
 * Draw Calls, Dreiecke, Heap. Umschalten mit F3 oder 5-Finger-Tipp. Standard: sichtbar im Dev-Build.
 */
export interface OverlayValues {
  fps: number; frameMs: number; physicsMs: number; bodies: number; awake: number;
  drawCalls: number; tris: number; step: number; moneyEur: number; day: number; dropped: number; version: string;
  held?: number; heldKg?: number; closure?: number; plow?: number;
}
export class DebugOverlay {
  private readonly el: HTMLElement;
  private visible = import.meta.env.DEV;
  private lastText = "";
  private acc = 0;

  private readonly box: HTMLElement;

  constructor(parent: HTMLElement, i18n: Record<string, unknown>, actions: { dumpPile: () => void }) {
    this.box = document.createElement("div");
    this.box.id = "debug-box";
    this.el = document.createElement("pre");
    this.el.id = "debug-overlay";
    const btn = document.createElement("button");
    btn.id = "debug-dump"; btn.type = "button"; btn.textContent = "Haufen kippen (P)";
    btn.addEventListener("click", () => actions.dumpPile());
    this.box.append(this.el, btn);
    this.box.hidden = !this.visible;
    parent.appendChild(this.box);
    void i18n; // Beschriftungen kommen in M3 aus i18n.debug; M0 zeigt Rohwerte
    let touches = 0;
    parent.addEventListener("touchstart", (e) => { touches = e.touches.length; if (touches >= 5) this.toggle(); }, { passive: true });
  }
  toggle(): void { this.visible = !this.visible; this.box.hidden = !this.visible; }
  update(v: OverlayValues): void {
    if (!this.visible) return;
    this.acc += v.frameMs;
    if (this.acc < 250) return; // 4× pro Sekunde reicht; DOM-Schreiben ist nicht gratis
    this.acc = 0;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    const text = [
      `Bagerana ${v.version}`,
      `fps ${v.fps.toFixed(0)}  frame ${v.frameMs.toFixed(1)} ms  physik ${v.physicsMs.toFixed(2)} ms`,
      `bodies ${v.awake}/${v.bodies}  step ${v.step}  dropped ${v.dropped}`,
      `draw calls ${v.drawCalls}  tris ${(v.tris / 1000).toFixed(1)}k${heap ? `  heap ${(heap / 1048576).toFixed(0)} MB` : ""}`,
      `tag ${v.day}  konto ${v.moneyEur.toFixed(0)} €`,
      v.held !== undefined ? `spinne ${((v.closure ?? 0) * 100).toFixed(0)}%  last ${v.held}× ${(v.heldKg ?? 0).toFixed(0)} kg  pflug ${(v.plow ?? 1).toFixed(2)}` : "",
    ].join("\n");
    if (text !== this.lastText) { this.el.textContent = text; this.lastText = text; }
  }
}
