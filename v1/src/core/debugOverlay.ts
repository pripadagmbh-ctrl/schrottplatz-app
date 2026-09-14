import type { Tondiagnose } from "../audio/tonzustand";

/**
 * Die Tonzeile des Overlays.
 *
 * Eigene Funktion, damit sie ohne Browser geprueft werden kann. Sie ist die
 * Lehre aus dem 14.09.2026: Im Overlay stand `Ton: interrupted · Musik an
 * (laeuft)`, waehrend gar nichts lief — die Anzeige hat auf die falsche Faehrte
 * gefuehrt. Ab jetzt steht dort, ob wirklich Ton herauskommt, und wie oft
 * vergeblich geweckt wurde.
 */
export function tonZeile(a: Tondiagnose): string {
  const lage = a.hoerbar ? "hoerbar" : "stumm";
  // Weckrufe nur zeigen, wenn es welche gab — sonst Rauschen in der Anzeige
  const weck = a.weckversuche > 0 ? ` · ${a.weckversuche} Weckruf${a.weckversuche === 1 ? "" : "e"}` : "";
  const musik = !a.musicWanted ? "aus" : a.musicRunning ? "an, laeuft" : "an, wartet";
  return `Ton: ${a.ctx} (${lage})${weck} · Musik ${musik}`;
}

/** F3-Debug-Overlay: FPS, Physik-Körper (gesamt/wach), Griff-Status. Budget-Wächter ab M0. */
export class DebugOverlay {
  private el: HTMLElement;
  visible = false;
  private fpsSmoothed = 60;
  private lastUpdate = 0;
  private physGeglaettet = 0;
  private bildGeglaettet = 0;
  private mischGeglaettet = 0;
  private vorGeglaettet = 0;
  private logikGeglaettet = 0;
  private restGeglaettet = 0;

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
      /** Bildinterpolation: mischen + zwei Weltmatrix-Durchlaeufe */
      msMisch: number;
      /** Eingaben und Tastenbefehle vor dem ersten Physikschritt */
      msVor: number;
      /** Spiellogik, HUD-Schreibvorgaenge, Ton, Partikel nach dem Zeichnen */
      msLogik: number;
      /** Zustand des Tonsystems — auf dem Geraet die einzige Moeglichkeit
       *  nachzusehen, warum nichts zu hoeren ist. */
      audio: Tondiagnose;
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
    this.mischGeglaettet += (stats.msMisch - this.mischGeglaettet) * 0.08;
    this.vorGeglaettet += (stats.msVor - this.vorGeglaettet) * 0.08;
    this.logikGeglaettet += (stats.msLogik - this.logikGeglaettet) * 0.08;
    /*
     * Die entscheidende Zahl fuer das Raetsel vom 14.09.2026: Frame 21,0 ms,
     * Arbeit 6,4 ms. `Rest` ist der Unterschied — Zeit, die weder Physik noch
     * Bild noch Spiellogik verbraucht. Steht dort fast der ganze Frame,
     * wartet der Browser (Bildsynchronisation, Verbund der Grafikschicht);
     * steht dort wenig, sitzt die Bremse in einer der anderen Zeilen.
     */
    const arbeit = stats.msVor + stats.msPhysik + stats.msMisch + stats.msBild + stats.msLogik;
    this.restGeglaettet += (frameDt * 1000 - arbeit - this.restGeglaettet) * 0.08;
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
      `Eingabe ${this.vorGeglaettet.toFixed(1)} · Misch ${this.mischGeglaettet.toFixed(1)} · ` +
      `Logik ${this.logikGeglaettet.toFixed(1)} · Rest ${this.restGeglaettet.toFixed(1)} ms<br />` +
      `${tonZeile(stats.audio)}<br />` +
      `Gegriffen: ${stats.gripped} Obj / ${stats.grippedKg.toFixed(0)} kg<br />` +
      `Lambert: ${stats.lambert.taetigkeit} · weckt ` +
      `${stats.lambert.geweckteProMinute.toFixed(0)}/min`;
  }
}
