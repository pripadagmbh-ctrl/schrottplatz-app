/**
 * Kabinenradio — komplett prozedural erzeugt (Briefing Kap. 15).
 *
 * Gewuenscht ist der Ton aus Guy Ritchies Gaunerfilmen (Wunsch 12.09.2026:
 * "ich haette auch so ne coole Musik wie in dem Film RocknRolla"): dreckiger
 * Bluesrock, Fuzz-Gitarre, stampfender Backbeat, Tamburin.
 *
 * Die Stuecke aus dem Film selbst koennen hier nicht laufen. Fremde Aufnahmen
 * und ein Senderstream sind lizenz- und GEMA-pflichtig und wuerden die
 * Veroeffentlichung blockieren. Was hier spielt, ist deshalb eine eigene
 * Komposition in derselben Richtung — dieselbe Ueberlegung, aus der frueher an
 * dieser Stelle ein eigener Schlager lief. Da nichts Fremdes abgespielt wird,
 * entstehen keine Rechtefragen.
 *
 * Musikalisch: E-Moll-Pentatonik, ein Riff ueber i–bIII–IV, 128 Schlaege je
 * Minute mit leichtem Shuffle auf den Achteln. Das ist das Gerippe praktisch
 * jedes Stuecks dieser Sorte — mehr braucht es nicht, der Rest ist Dreck im
 * Klang.
 */

/** Das Riff, in Halbtoenen ueber dem Grundton und Schlaegen im Takt. */
const RIFF: Array<{ halbton: number; schlag: number; laenge: number }> = [
  { halbton: 0, schlag: 0, laenge: 0.5 },
  { halbton: 0, schlag: 0.75, laenge: 0.25 },
  { halbton: 3, schlag: 1, laenge: 0.5 },
  { halbton: 0, schlag: 1.75, laenge: 0.25 },
  { halbton: 5, schlag: 2, laenge: 0.5 },
  // Blue Note, nur kurz angerissen — daher kommt der schiefe Reiz
  { halbton: 6, schlag: 2.5, laenge: 0.25 },
  { halbton: 7, schlag: 2.75, laenge: 0.5 },
  { halbton: 0, schlag: 3.5, laenge: 0.5 },
];
/** Akkordfolge, ein Eintrag je Takt: i · i · bIII · IV */
const STUFEN = [0, 0, 3, 5];
/**
 * Wo die Orgel dazukommt. Nicht durchgehend: Ein Riff lebt von der Luecke, und
 * eine Orgel, die immer laeuft, nimmt dem Schlagzeug den Platz.
 */
const ORGEL_TAKTE = new Set([2, 3]);

const ROOT_HZ = 82.41; // E2
const BEAT_S = 60 / 128;
const BEATS_PER_BAR = 4;
const TAKTE = 4;
/** Shuffle: Wie weit das zweite Achtel nach hinten rutscht (Anteil am Schlag). */
const SHUFFLE = 0.06;
/** So weit im Voraus werden Toene gesetzt (WebAudio plant exakt) */
const SCHEDULE_AHEAD_S = 0.7;

const hz = (halbtoene: number): number => ROOT_HZ * Math.pow(2, halbtoene / 12);

/**
 * Zerrkurve fuer den Verstaerker.
 *
 * Ein sauberer Sinus klingt nach Telefon, nicht nach Gitarre. Die Kennlinie
 * biegt die Spitzen um — daraus entstehen die Obertoene, die man als Fuzz
 * hoert. `grad` steuert, wie hart.
 */
function zerrkurve(grad: number): Float32Array {
  const n = 1024;
  const k = grad * 100;
  const kurve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    kurve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return kurve;
}

export class Music {
  private gain: GainNode;
  private takt = 0;
  private schlag = 0;
  private nextTime = 0;
  private timer = 0;
  private running = false;
  private fuzzKurve = zerrkurve(0.62);
  private bassKurve = zerrkurve(0.22);
  private rauschen: AudioBuffer | null = null;

  constructor(
    private ctx: BaseAudioContext,
    destination: AudioNode
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    /*
     * Klangfarbe: Es kommt weiter aus dem Kabinenlautsprecher, aber nicht mehr
     * durch ein Nadeloehr. Der alte Bandpass bei 1100 Hz mit Q 0,75 nahm einem
     * Riff genau das, was es ausmacht — den Bauch. Jetzt ein Hochpass gegen den
     * Tiefbass, den so ein Lautsprecher ohnehin nicht bringt, eine Absenkung
     * der schrillsten Hoehen und etwas Mitte. Das ist der Ton eines kleinen
     * Lautsprechers, ohne dass er das Stueck ausweidet.
     */
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 95;
    const mitten = ctx.createBiquadFilter();
    mitten.type = "peaking";
    mitten.frequency.value = 1400;
    mitten.Q.value = 0.8;
    mitten.gain.value = 4;
    const zahm = ctx.createBiquadFilter();
    zahm.type = "lowpass";
    zahm.frequency.value = 5200;
    this.gain.connect(hp).connect(mitten).connect(zahm).connect(destination);
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

  /** Lautstaerke 0..1, bezogen auf den eingestellten Grundpegel. */
  setVolume(v: number): void {
    this.gain.gain.setTargetAtTime(0.16 * Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.2);
  }

  /** Alle faelligen Toene bis zum Vorausschau-Fenster einplanen. */
  private schedule(): void {
    if (!this.running) return;
    // Solange der Ton schlaeft, steht die Uhr des AudioContext. Wuerden wir
    // trotzdem planen, laegen nach dem Aufwachen alle Toene in der
    // Vergangenheit und kaemen als Knall auf einmal. Stattdessen mitziehen.
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
      this.schlag++;
      if (this.schlag >= BEATS_PER_BAR) {
        this.schlag = 0;
        this.takt = (this.takt + 1) % TAKTE;
      }
    }
  }

  private playBeat(t: number): void {
    const stufe = STUFEN[this.takt]!;

    // --- Schlagzeug: Bassdrum auf 1 und 3, Snare auf 2 und 4. Das ist der
    // Backbeat, und daran haengt der ganze Groove.
    if (this.schlag === 0 || this.schlag === 2) this.kick(t);
    if (this.schlag === 1 || this.schlag === 3) this.snare(t);
    // Hi-Hat auf allen Achteln, das zweite geshufflet
    this.hat(t, 0.05);
    this.hat(t + BEAT_S * (0.5 + SHUFFLE), 0.032);
    // Tamburin auf den Nachschlaegen — der Klang dieser Filme
    this.tamburin(t + BEAT_S * (0.5 + SHUFFLE), 0.045);
    // Wirbel vor dem Zurueckspringen an den Anfang
    if (this.takt === TAKTE - 1 && this.schlag === 3) {
      for (let i = 0; i < 3; i++) this.snare(t + BEAT_S * (0.5 + i * 0.16), 0.1 + i * 0.04);
    }

    // --- Riff und Bass laufen im Gleichschritt: Genau das macht den Stampf.
    for (const n of RIFF) {
      if (Math.floor(n.schlag) !== this.schlag) continue;
      const versatz = n.schlag - this.schlag;
      // Achtel hinter dem Schlag bekommen den Shuffle
      const swing = versatz > 0.4 && versatz < 0.6 ? SHUFFLE : 0;
      const zeit = t + (versatz + swing) * BEAT_S;
      const dauer = n.laenge * BEAT_S;
      this.fuzz(hz(n.halbton + stufe + 12), zeit, dauer, 0.18);
      this.bass(hz(n.halbton + stufe - 12), zeit, dauer * 1.1);
    }

    // --- Orgel nur in der zweiten Haelfte, als Flaeche unter dem Riff
    if (ORGEL_TAKTE.has(this.takt) && this.schlag === 0) {
      for (const s of [0, 3, 7]) {
        this.orgel(hz(s + stufe), t, BEAT_S * BEATS_PER_BAR * 0.9);
      }
    }
  }

  /** Verzerrte Gitarre: zwei leicht verstimmte Saegezaehne durch die Zerrkurve. */
  private fuzz(f: number, t: number, dur: number, peak: number): void {
    const form = this.ctx.createWaveShaper();
    form.curve = this.fuzzKurve;
    form.oversample = "2x";
    // Der Ton ist hell, wenn er angerissen wird, und dumpft dann ab — so
    // klingt eine angeschlagene Saite.
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(3400, t);
    filt.frequency.exponentialRampToValueAtTime(900, t + dur);
    filt.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    form.connect(filt).connect(g).connect(this.gain);
    for (const versatz of [1, 1.004]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f * versatz;
      osc.connect(form);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  /** Bass: Dreieck mit etwas Biss, damit er auf kleinen Lautsprechern durchkommt. */
  private bass(f: number, t: number, dur: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const form = this.ctx.createWaveShaper();
    form.curve = this.bassKurve;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 620;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(form).connect(filt).connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Getragene Orgelflaeche. */
  private orgel(f: number, t: number, dur: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.25);
    g.gain.linearRampToValueAtTime(0.04, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 2200;
    filt.connect(g).connect(this.gain);
    // Zugriegel: Grundton, Oktave, Quinte — daher kommt der Orgelklang
    for (const [vielfaches, anteil] of [
      [1, 1],
      [2, 0.6],
      [3, 0.35],
    ] as Array<[number, number]>) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * vielfaches;
      const teil = this.ctx.createGain();
      teil.gain.value = anteil;
      osc.connect(teil).connect(filt);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  /** Rauschpuffer, einmal gebaut und wiederverwendet. */
  private holeRauschen(): AudioBuffer {
    if (this.rauschen) return this.rauschen;
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.rauschen = buf;
    return buf;
  }

  private kick(t: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    // Die Tonhoehe faellt schnell ab — das ist der Bauch einer Bassdrum
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private snare(t: number, peak = 0.2): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.holeRauschen();
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1900;
    filt.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.16);
    src.connect(filt).connect(g).connect(this.gain);
    src.start(t);
    src.stop(t + 0.2);
    // Der Koerper des Schlags — ohne ihn klingt die Snare nur nach Zischen
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(peak * 0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.0008, t + 0.1);
    osc.connect(g2).connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private hat(t: number, peak: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.holeRauschen();
    const filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 7500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);
    src.connect(filt).connect(g).connect(this.gain);
    src.start(t);
    src.stop(t + 0.06);
  }

  private tamburin(t: number, peak: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.holeRauschen();
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 9000;
    filt.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    src.connect(filt).connect(g).connect(this.gain);
    src.start(t);
    src.stop(t + 0.14);
  }
}
