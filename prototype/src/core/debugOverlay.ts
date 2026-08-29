/** F3-Debug-Overlay: FPS, Physik-Körper (gesamt/wach), Griff-Status. Budget-Wächter ab M0. */
export class DebugOverlay {
  private el: HTMLElement;
  visible = false;
  private fpsSmoothed = 60;
  private lastUpdate = 0;

  constructor() {
    this.el = document.getElementById("debug")!;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? "block" : "none";
  }

  /** Jeden Render-Frame aufrufen; schreibt das DOM nur 4×/s. */
  update(
    frameDt: number,
    stats: { bodies: number; awake: number; gripped: number; grippedKg: number }
  ): void {
    const fps = 1 / Math.max(frameDt, 1e-4);
    this.fpsSmoothed += (fps - this.fpsSmoothed) * 0.05;
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastUpdate < 250) return;
    this.lastUpdate = now;
    this.el.innerHTML =
      `FPS: ${this.fpsSmoothed.toFixed(0)}<br />` +
      `Frame: ${(frameDt * 1000).toFixed(1)} ms<br />` +
      `Bodies: ${stats.bodies} (wach: ${stats.awake})<br />` +
      `Gegriffen: ${stats.gripped} Obj / ${stats.grippedKg.toFixed(0)} kg`;
  }
}
