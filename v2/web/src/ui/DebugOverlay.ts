/**
 * Debug-Overlay (Briefing Kap. 14.1, 19.2): fps, Bild-ms, Physik-ms, Körper wach/gesamt,
 * Draw Calls, Dreiecke, Heap. Umschalten mit F3 oder 5-Finger-Tipp. Standard: sichtbar im Dev-Build.
 */
export interface OverlayValues {
  fps: number; frameMs: number; physicsMs: number; bodies: number; awake: number;
  drawCalls: number; tris: number; step: number; moneyEur: number; day: number; dropped: number; version: string;
}
export class DebugOverlay {
  private readonly el: HTMLElement;
  private visible = import.meta.env.DEV;
  private lastText = "";
  private acc = 0;

  constructor(parent: HTMLElement, i18n: Record<string, unknown>) {
    this.el = document.createElement("pre");
    this.el.id = "debug-overlay";
    this.el.hidden = !this.visible;
    parent.appendChild(this.el);
    void i18n; // Beschriftungen kommen in M3 aus i18n.debug; M0 zeigt Rohwerte
    let touches = 0;
    parent.addEventListener("touchstart", (e) => { touches = e.touches.length; if (touches >= 5) this.toggle(); }, { passive: true });
  }
  toggle(): void { this.visible = !this.visible; this.el.hidden = !this.visible; }
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
    ].join("\n");
    if (text !== this.lastText) { this.el.textContent = text; this.lastText = text; }
  }
}
