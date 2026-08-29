/**
 * Kern-Sounds M1 (Briefing Kap. 15) — komplett prozedural per WebAudio, keine Assets.
 * Audio ist der primäre Belohnungskanal: jeder Abwurf klingt nach seinem Material,
 * richtig = angenehmer Doppelton, falsch = stumpfer Missklang.
 * Startet erst nach der ersten echten Nutzereingabe (Browser-Autoplay-Policy).
 */
import { Music } from "./music";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: Music | null = null;
  /** Musikwunsch des Spielers — gilt auch, bevor der Ton überhaupt läuft */
  private musicWanted = true;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private hydraulicGain: GainNode | null = null;
  private hydOsc: OscillatorNode | null = null;
  private scrapeGain: GainNode | null = null;

  constructor() {
    const start = () => this.ensureStarted();
    window.addEventListener("pointerdown", start, { once: false });
    window.addEventListener("keydown", start, { once: false });
  }

  /** Musik an/aus. Liefert den neuen Zustand. */
  toggleMusic(): boolean {
    this.musicWanted = !this.musicWanted;
    if (this.music) {
      if (this.musicWanted) this.music.start();
      else this.music.stop();
    }
    return this.musicWanted;
  }

  get musicOn(): boolean {
    return this.musicWanted;
  }

  private ensureStarted(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // Hintergrundmusik, zur Laufzeit erzeugt — keine fremden Aufnahmen
      this.music = new Music(this.ctx, this.master);
      if (this.musicWanted) this.music.start();

      // Diesel-Loop: tiefer Sägezahn + Tiefpass, Drehzahl folgt der Aktivität
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 48;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 220;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;
      this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();

      // Hydraulik: kein Zischen mehr, sondern ein dezenter Pumpenton, der beim
      // Bedienen mitläuft (Design-Wunsch 2026-08-29)
      this.hydOsc = this.ctx.createOscillator();
      this.hydOsc.type = "triangle";
      this.hydOsc.frequency.value = 118;
      const hydFilter = this.ctx.createBiquadFilter();
      hydFilter.type = "lowpass";
      hydFilter.frequency.value = 520;
      this.hydraulicGain = this.ctx.createGain();
      this.hydraulicGain.gain.value = 0;
      this.hydOsc.connect(hydFilter).connect(this.hydraulicGain).connect(this.master);
      this.hydOsc.start();
      // leichtes Pulsieren der Pumpe
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 7.5;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 5;
      lfo.connect(lfoGain).connect(this.hydOsc.frequency);
      lfo.start();

      // Kratzen auf Beton: helleres, raueres Rauschband — Gain folgt der Kontakt-Intensität
      const scrapeNoise = this.ctx.createBufferSource();
      scrapeNoise.buffer = this.noiseBuffer();
      scrapeNoise.loop = true;
      const scrapeFilter = this.ctx.createBiquadFilter();
      scrapeFilter.type = "bandpass";
      scrapeFilter.frequency.value = 2600;
      scrapeFilter.Q.value = 1.2;
      this.scrapeGain = this.ctx.createGain();
      this.scrapeGain.gain.value = 0;
      scrapeNoise.connect(scrapeFilter).connect(this.scrapeGain).connect(this.master);
      scrapeNoise.start();
    } catch {
      this.ctx = null; // Audio bleibt aus, Spiel läuft weiter
    }
  }

  /** Pro Frame: activity 0..1 (Achsbewegung), load 0..1 (Traglast-Anteil). */
  updateEngine(activity: number, load: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.hydraulicGain) return;
    const t = this.ctx.currentTime;
    // Beim Bedienen geht der Motor spürbar hoch — das trägt das Feedback
    this.engineOsc.frequency.setTargetAtTime(46 * (1 + 0.55 * activity + 0.22 * load), t, 0.12);
    this.engineGain.gain.setTargetAtTime(0.05 + 0.085 * activity + 0.02 * load, t, 0.15);
    // Hydraulikpumpe nur dezent darunter, Tonhöhe folgt der Last
    if (this.hydOsc) {
      this.hydOsc.frequency.setTargetAtTime(112 + 26 * activity + 14 * load, t, 0.1);
    }
    this.hydraulicGain.gain.setTargetAtTime(0.028 * Math.min(activity * 1.6, 1), t, 0.1);
  }

  /** Pro Frame: Kratz-Intensität 0..1 (Zackenspitzen schleifen über den Boden). */
  setScrape(intensity: number): void {
    if (!this.ctx || !this.scrapeGain) return;
    this.scrapeGain.gain.setTargetAtTime(0.14 * intensity, this.ctx.currentTime, 0.06);
  }

  playGrab(): void {
    // sattes Zupacken: kurzer Rauschimpuls + tiefer Thump
    this.burst([70], 0.18, 0.35, "triangle");
    this.noiseBurst(500, 0.08, 0.25);
  }

  /**
   * Abwurfklang je Material (Kap. 15). Metall klingt nicht harmonisch wie ein
   * Instrument, sondern über INHARMONISCHE Teiltöne mit unterschiedlich langem
   * Abklingen — genau das bildet metalHit nach. Dazu ein kurzer Aufprall-
   * Transient, der Masse und Härte vermittelt.
   */
  playDrop(materialId: string): void {
    switch (materialId) {
      case "steel":
        // schwerer Stahl: tiefer Anschlag, langes metallisches Nachklingen
        this.metalHit([214, 331, 487, 712, 1043], [0.9, 0.7, 0.5, 0.34, 0.22], 0.26, {
          transient: 1600,
          transientGain: 0.3,
          spread: 0.05,
        });
        break;
      case "va":
        // Edelstahl: heller und klarer, klingt am längsten nach
        this.metalHit([392, 611, 913, 1327, 1904], [1.25, 0.95, 0.7, 0.45, 0.3], 0.2, {
          transient: 3400,
          transientGain: 0.2,
          spread: 0.03,
        });
        break;
      case "alu":
        // Aluminium: leicht, hell, kurzer Nachhall
        this.metalHit([523, 807, 1188, 1673], [0.5, 0.36, 0.24, 0.16], 0.19, {
          transient: 4200,
          transientGain: 0.22,
          spread: 0.04,
        });
        break;
      case "copper":
        // Kupfer/Messing: weicher, dunkler Klang mit tragendem Sustain
        this.metalHit([297, 449, 668, 951], [1.0, 0.8, 0.55, 0.35], 0.22, {
          transient: 1100,
          transientGain: 0.18,
          spread: 0.06,
        });
        break;
      case "cable":
        // Kabelbund: fast tonlos, dumpfes Poltern mit Raschelanteil
        this.metalHit([132, 189], [0.24, 0.18], 0.2, {
          transient: 900,
          transientGain: 0.3,
          spread: 0.09,
        });
        this.noiseBurst(1600, 0.22, 0.16);
        break;
      default:
        // Störstoff (Holz, Beton, Kunststoff): Schlag ohne metallisches Klingen
        this.metalHit([96, 143], [0.14, 0.1], 0.3, {
          transient: 420,
          transientGain: 0.26,
          spread: 0.02,
        });
    }
  }

  /**
   * Ein Metallschlag: kurzer Aufprall-Transient plus inharmonische Partialtöne,
   * die unterschiedlich schnell verklingen.
   * @param partials Teiltonfrequenzen (bewusst nicht harmonisch)
   * @param decays Abklingzeit je Teilton in Sekunden
   * @param gain Grundlautstärke
   */
  private metalHit(
    partials: number[],
    decays: number[],
    gain: number,
    opts: { transient: number; transientGain: number; spread: number }
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    // Aufprall: sehr kurzer, gefilterter Rauschimpuls
    this.noiseBurst(opts.transient, 0.045, opts.transientGain);
    partials.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      // leichte Verstimmung je Anschlag — kein Ton klingt exakt wie der vorige
      osc.frequency.value = f * (1 + (Math.random() - 0.5) * opts.spread);
      osc.type = i === 0 ? "triangle" : "sine";
      const g = this.ctx!.createGain();
      const amp = (gain / (i + 1.4)) * (0.85 + Math.random() * 0.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.006); // harter Anschlag
      g.gain.exponentialRampToValueAtTime(0.0001, t + decays[i]);
      osc.connect(g).connect(this.master!);
      osc.start(t);
      osc.stop(t + decays[i] + 0.05);
    });
  }

  /** Metall-Kreischen beim Abreißen einer Baugruppe. */
  playTear(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);
    this.noiseBurst(1800, 0.35, 0.3);
  }

  /** Schwerer Blech-Crash (Quetschstufe). */
  playCrash(strength = 1): void {
    this.burst([52, 78], 0.7, 0.35 + 0.25 * strength, "sine");
    this.burst([161, 214, 289], 0.5, 0.32, "triangle");
    this.noiseBurst(2500, 0.18, 0.3);
  }

  /** Scheibe birst. */
  playGlass(): void {
    this.burst([1900, 2600, 3400], 0.28, 0.2);
    this.noiseBurst(7000, 0.14, 0.22);
  }

  /** Zaunfeld reißt aus der Verankerung / scheppert. */
  playRattle(): void {
    this.noiseBurst(900, 0.35, 0.3);
    this.burst([178, 242], 0.32, 0.24, "triangle");
  }

  /** Verkauf: Münz-Dreiklang. */
  playSale(): void {
    this.tone(880, 0.12, 0.14, 0);
    this.tone(1175, 0.12, 0.14, 0.09);
    this.tone(1568, 0.2, 0.14, 0.18);
  }

  playCorrect(): void {
    // dezentes „Kaching": zwei weiche Sinustöne (−6 dB unter Weltklang, SW)
    this.tone(660, 0.1, 0.12, 0);
    this.tone(990, 0.16, 0.12, 0.07);
  }

  playWrong(): void {
    this.burst([110, 116], 0.3, 0.25, "square");
  }

  // ---------- Synthese-Helfer ----------

  private tone(freq: number, dur: number, gain: number, delay: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private burst(freqs: number[], dur: number, gain: number, type: OscillatorType = "sine"): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f * (0.98 + Math.random() * 0.04); // leichte Verstimmung
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain / freqs.length, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private noiseBurst(cutoff: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private cachedNoise: AudioBuffer | null = null;
  private noiseBuffer(): AudioBuffer {
    if (this.cachedNoise) return this.cachedNoise;
    const len = this.ctx!.sampleRate;
    const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.cachedNoise = buf;
    return buf;
  }
}
