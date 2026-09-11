/** F3-Debug-Overlay: FPS, Physik-Körper (gesamt/wach), Griff-Status. Budget-Wächter ab M0. */
export class DebugOverlay {
  private el: HTMLElement;
  visible = false;
  private fpsSmoothed = 60;
  private lastUpdate = 0;
  private physGeglaettet = 0;
  private bildGeglaettet = 0;

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
    stats: {
      bodies: number;
      awake: number;
      dynamic: number;
      dynAwake: number;
      gripped: number;
      grippedKg: number;
      /** renderer.info.render — was die Grafikkarte je Bild wirklich zu tun bekommt */
      calls: number;
      tris: number;
      /** reine Arbeitszeit, unabhaengig vom 60/30-Riegel der Bildsynchronisation */
      msPhysik: number;
      msBild: number;
      /** Zustand des Tonsystems — auf dem Geraet die einzige Moeglichkeit
       *  nachzusehen, warum nichts zu hoeren ist. */
      audio: { ctx: string; musicWanted: boolean; musicRunning: boolean };
      /** Was Lambert treibt und wie viele Koerper er dabei je Minute weckt
       *  (Auftrag 11.09.2026, Phase 0.2) */
      lambert: { taetigkeit: string; geweckteProMinute: number };
    }
  ): void {
    const fps = 1 / Math.max(frameDt, 1e-4);
    this.fpsSmoothed += (fps - this.fpsSmoothed) * 0.05;
    // Arbeitszeiten schwanken je Bild stark — geglaettet sind sie ablesbar
    this.physGeglaettet += (stats.msPhysik - this.physGeglaettet) * 0.08;
    this.bildGeglaettet += (stats.msBild - this.bildGeglaettet) * 0.08;
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastUpdate < 250) return;
    this.lastUpdate = now;
    this.el.innerHTML =
      `FPS: ${this.fpsSmoothed.toFixed(0)}<br />` +
      `Frame: ${(frameDt * 1000).toFixed(1)} ms<br />` +
      `Koerper: ${stats.bodies} (wach: ${stats.awake})<br />` +
      // Die aussagekraeftige Zeile: nur bewegliche Teile koennen ueberhaupt schlafen
      `Beweglich: ${stats.dynamic} (wach: ${stats.dynAwake})<br />` +
      `Zeichenrufe: ${stats.calls} · ${(stats.tris / 1000).toFixed(0)}k Dreiecke<br />` +
      `Arbeit: Physik ${this.physGeglaettet.toFixed(1)} ms · Bild ${this.bildGeglaettet.toFixed(1)} ms<br />` +
      `Ton: ${stats.audio.ctx} · Musik ${stats.audio.musicWanted ? "an" : "aus"}` +
      `${stats.audio.musicRunning ? " (laeuft)" : ""}<br />` +
      `Gegriffen: ${stats.gripped} Obj / ${stats.grippedKg.toFixed(0)} kg<br />` +
      `Lambert: ${stats.lambert.taetigkeit} · weckt ` +
      `${stats.lambert.geweckteProMinute.toFixed(0)}/min`;
  }
}
