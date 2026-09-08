/**
 * Fixed-Step-Akkumulator (Briefing Kap. 6): Physik läuft mit 60 Hz, gezeichnet wird so oft der
 * Bildschirm will. Höchstens `maxCatchUp` Nachholschritte pro Bild — danach wird Simulationszeit
 * verworfen. Der Prototyp holte bis zu 5 Schritte nach und lief auf langsamen Geräten in Zeitlupe.
 * `alpha` (0..1) ist der Interpolationsfaktor zwischen letztem und aktuellem Physikschritt.
 */
export interface LoopCallbacks {
  simStep(dt: number): void;
  render(alpha: number, frameDt: number): void;
}
export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  running = false;
  paused = false;
  /** Bild-Statistik für das Overlay */
  frameMs = 0; fps = 0; droppedSteps = 0;
  private fpsAcc = 0; private fpsN = 0;

  constructor(private readonly dt: number, private readonly maxCatchUp: number, private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const frame = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      this.frameMs = frame * 1000;
      this.fpsAcc += frame; this.fpsN++;
      if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
      if (!this.paused) {
        this.acc += frame;
        let steps = 0;
        while (this.acc >= this.dt && steps < this.maxCatchUp) { this.cb.simStep(this.dt); this.acc -= this.dt; steps++; }
        if (this.acc >= this.dt) { this.droppedSteps += Math.floor(this.acc / this.dt); this.acc = this.acc % this.dt; }
      }
      this.cb.render(this.acc / this.dt, frame);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop(): void { this.running = false; cancelAnimationFrame(this.raf); }
}
