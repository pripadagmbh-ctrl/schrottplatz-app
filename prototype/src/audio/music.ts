/**
 * Kabinenradio — komplett prozedural erzeugt (Briefing Kap. 15).
 *
 * Gewünscht war Schlager beziehungsweise Radioprogramm. Echte Aufnahmen oder
 * ein Senderstream scheiden aus: beides ist lizenz- und GEMA-pflichtig und
 * würde die Veröffentlichung im Store blockieren. Stattdessen spielt hier eine
 * eigene Komposition im Schlagerstil — Dur, Vier-Viertel-Takt, Umtata-Bass,
 * eingängige Melodie — durch einen Bandpass geschickt, damit es aus dem
 * Lautsprecher der Fahrerkabine kommt.
 *
 * Da nichts Fremdes abgespielt wird, entstehen keinerlei Rechtefragen.
 */

/** Klassische Schlager-Kadenz in C-Dur: C → G → Am → F */
const PROGRESSION: number[][] = [
  [0, 4, 7], // C
  [-5, -1, 2], // G
  [-3, 0, 4], // Am
  [-7, -3, 0], // F
];
/** Eingängige Melodie, ein Ton je Schlag */
const MELODY: number[][] = [
  [12, 12, 16, 14],
  [14, 11, 7, 11],
  [12, 16, 19, 16],
  [17, 14, 12, 12],
];
const ROOT_HZ = 131; // C3
const BEAT_S = 0.46; // etwa 130 bpm — flott, wie es sich gehört
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
    // Radio-Klangfarbe: schmalbandig wie ein Kabinenlautsprecher, ohne Tiefbass
    // und ohne Höhenglanz
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1100;
    band.Q.value = 0.75;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 220;
    this.gain.connect(band).connect(hp).connect(destination);
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
    // Solange der Ton schläft, steht die Uhr des AudioContext. Würden wir
    // trotzdem planen, lägen nach dem Aufwachen alle Töne in der
    // Vergangenheit und kämen als Knall auf einmal. Stattdessen mitziehen.
    if (this.ctx.state !== "running") {
      this.nextTime = this.ctx.currentTime + 0.1;
      return;
    }
    // Nach einer Pause (Bildschirm aus, Tabwechsel) den Faden neu aufnehmen,
    // statt die verpasste Zeit nachzuholen
    if (this.nextTime < this.ctx.currentTime - 1) {
      this.nextTime = this.ctx.currentTime + 0.05;
    }
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

    // Umtata: Bass auf den Zählzeiten, Akkord auf den Nachschlägen — das
    // typische Schlager-Fundament
    if (this.beat % 2 === 0) {
      this.pluck(hz(chord[0] - 12), t, 0.34, "triangle", 0.55, 320);
    } else {
      this.pluck(hz(chord[0] - 5), t, 0.3, "triangle", 0.38, 300);
    }
    // „Tata" — kurzer Akkordschlag auf dem Off
    for (const s of chord) {
      this.pluck(hz(s + 12), t + BEAT_S * 0.5, 0.22, "square", 0.1, 1500);
    }

    // Streicherteppich über den ganzen Takt
    if (this.beat === 0) {
      for (const s of chord) this.pad(hz(s), t, BEAT_S * BEATS_PER_BAR * 0.95);
    }

    // Melodie führt durch — bei Schlager darf sie gerne mitsingbar sein
    const note = MELODY[this.bar][this.beat];
    this.pluck(hz(note), t + 0.02, 0.42, "sawtooth", 0.2, 2200);

    // Schlagzeug: Schlag auf zwei und vier
    this.tick(t, this.beat % 2 === 1 ? 0.14 : 0.05);
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
