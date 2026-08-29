/**
 * Hintergrundmusik — komplett prozedural erzeugt (Briefing Kap. 15).
 *
 * Es wird nichts abgespielt, was jemandem gehört: Akkorde, Bass und Melodie
 * entstehen zur Laufzeit aus Oszillatoren. Damit sind keinerlei Lizenz- oder
 * GEMA-Fragen berührt, und die App bleibt ohne Audio-Dateien.
 *
 * Stimmung: ruhiger, leicht schwermütiger Werkhof-Groove in a-Moll. Die Musik
 * hält sich bewusst zurück — sie trägt die Szene, ohne den Schrott zu
 * übertönen.
 */

/** Akkordfolge in Halbtönen über dem Grundton A (a-Moll → F → C → G) */
const PROGRESSION: number[][] = [
  [0, 3, 7], // Am
  [-4, 0, 5], // F
  [-9, -5, 0], // C
  [-2, 2, 7], // G
];
/** Töne der Melodie je Akkord (Halbtöne über dem Grundton) */
const MELODY: number[][] = [
  [12, 15, 19, 15],
  [17, 12, 14, 12],
  [15, 19, 15, 12],
  [14, 17, 14, 10],
];
const ROOT_HZ = 110; // A2
const BEAT_S = 0.55;
const BEATS_PER_BAR = 4;
/** So weit im Voraus werden Töne gesetzt (WebAudio plant exakt) */
const SCHEDULE_AHEAD_S = 0.7;

const hz = (semitones: number): number => ROOT_HZ * Math.pow(2, semitones / 12);

export class Music {
  private gain: GainNode;
  private bar = 0;
  private beat = 0;
  private nextTime = 0;
  private timer = 0;
  private running = false;

  constructor(
    private ctx: AudioContext,
    destination: AudioNode
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
  }

  get enabled(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    // sanft einblenden, damit die Musik nicht hereinplatzt
    this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.gain.gain.setValueAtTime(this.gain.gain.value, this.ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(0.16, this.ctx.currentTime + 2.5);
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.clearInterval(this.timer);
    this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.gain.gain.setValueAtTime(this.gain.gain.value, this.ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
  }

  toggle(): boolean {
    if (this.running) this.stop();
    else this.start();
    return this.running;
  }

  /** Lautstärke 0..1, bezogen auf den eingestellten Grundpegel. */
  setVolume(v: number): void {
    this.gain.gain.setTargetAtTime(0.16 * Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.2);
  }

  /** Alle fälligen Töne bis zum Vorausschau-Fenster einplanen. */
  private schedule(): void {
    if (!this.running) return;
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.playBeat(this.nextTime);
      this.nextTime += BEAT_S;
      this.beat++;
      if (this.beat >= BEATS_PER_BAR) {
        this.beat = 0;
        this.bar = (this.bar + 1) % PROGRESSION.length;
      }
    }
  }

  private playBeat(t: number): void {
    const chord = PROGRESSION[this.bar];

    // Bass auf der Eins und der Drei — trägt den Groove
    if (this.beat === 0 || this.beat === 2) {
      this.pluck(hz(chord[0] - 12), t, 0.9, "triangle", 0.5, 260);
    }

    // Akkord-Pad zu Beginn des Takts, weich und lang
    if (this.beat === 0) {
      for (const s of chord) this.pad(hz(s), t, BEAT_S * BEATS_PER_BAR * 0.95);
    }

    // Melodie: ein Ton je Schlag, aber nicht jeder — das lässt Luft
    const note = MELODY[this.bar][this.beat];
    if (this.beat !== 1) this.pluck(hz(note), t + 0.02, 0.55, "sine", 0.22, 1800);

    // Leises Hi-Hat-Ticken auf den Nachschlägen
    this.tick(t + BEAT_S * 0.5, this.beat % 2 === 0 ? 0.05 : 0.09);
  }

  /** Kurzer, gezupfter Ton mit schnellem Abfall. */
  private pluck(
    f: number,
    t: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    cutoff: number
  ): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(filt).connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Getragener Akkordton mit langsamem An- und Abschwellen. */
  private pad(f: number, t: number, dur: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    // leichte Verstimmung macht den Klang breiter
    const det = this.ctx.createOscillator();
    det.type = "sawtooth";
    det.frequency.value = f * 1.005;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(400, t);
    filt.frequency.linearRampToValueAtTime(900, t + dur * 0.4);
    filt.frequency.linearRampToValueAtTime(500, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.5);
    g.gain.linearRampToValueAtTime(0.07, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(filt);
    det.connect(filt);
    filt.connect(g).connect(this.gain);
    osc.start(t);
    det.start(t);
    osc.stop(t + dur + 0.05);
    det.stop(t + dur + 0.05);
  }

  /** Rauschtick als sparsames Schlagzeug. */
  private tick(t: number, peak: number): void {
    const len = Math.floor(this.ctx.sampleRate * 0.04);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = peak;
    src.connect(filt).connect(g).connect(this.gain);
    src.start(t);
  }
}
