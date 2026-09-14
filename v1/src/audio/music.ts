/**
 * Kabinenradio — komplett prozedural erzeugt (Briefing Kap. 15).
 *
 * Diese Datei ist der Klangapparat, nicht das Programm: Sie kennt Stimmen
 * (Zupf, Flaeche, Fuzz, Bass, Orgel, Schlagzeug) und einen Taktgeber, aber kein
 * einziges Stueck. Was gespielt wird, steht in `songs.ts` als Daten. Ein
 * weiterer Sender ist deshalb ein weiterer Datensatz, kein weiterer Apparat.
 *
 * Fremde Aufnahmen und Senderstreams scheiden aus: beides ist lizenz- und
 * GEMA-pflichtig und wuerde die Veroeffentlichung blockieren (Beschluss
 * 12.09.2026). Da nichts Fremdes abgespielt wird, entstehen keine Rechtefragen.
 */
import {
  findeSender,
  STANDARD_SENDER,
  type Song,
  type Spur,
  type Ton,
} from "./songs";

/** So weit im Voraus werden Toene gesetzt (WebAudio plant exakt) */
const SCHEDULE_AHEAD_S = 0.7;
/**
 * Senderwechsel. Das laufende Stueck wird weggeblendet, das neue faengt an —
 * ohne Blende gaebe es an der Schnittstelle einen Knack, weil die Wellen der
 * beiden Stuecke nicht aneinander passen. SW: 0,35 s aus, 0,45 s ein, dazu
 * 0,12 s Ansatz, damit die neue Kette nicht in dieselbe Millisekunde faellt.
 */
const WECHSEL_AUS_S = 0.35;
const WECHSEL_EIN_S = 0.45;
const WECHSEL_ANSATZ_S = 0.12;
/** So lange bleibt die alte Kette noch haengen, bevor sie getrennt wird. */
const WECHSEL_NACHHALL_S = 2.5;

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

/** Ein fertig verkabelter Signalweg: Eingang, Pegel, Klangfarbe. */
interface Kette {
  gain: GainNode;
  /** Alle Knoten der Kette — zum Trennen nach dem Senderwechsel */
  knoten: AudioNode[];
  /** Fuer welchen Sender sie gebaut wurde */
  fuer: string;
}

export class Music {
  private song: Song;
  private kette: Kette;
  private takt = 0;
  private schlag = 0;
  private nextTime = 0;
  private timer = 0;
  private running = false;
  private fuzzKurve = zerrkurve(0.62);
  private bassKurve = zerrkurve(0.22);
  private rauschen: AudioBuffer | null = null;
  /** Lautstaerkeregler 0..1; der Grundpegel kommt aus dem Stueck. */
  private lautstaerke = 1;

  constructor(
    private ctx: BaseAudioContext,
    private destination: AudioNode,
    senderId: string = STANDARD_SENDER
  ) {
    this.song = findeSender(senderId);
    this.kette = this.baueKette(this.song);
  }

  get enabled(): boolean {
    return this.running;
  }

  /** Welcher Sender laeuft (oder liefe, wenn das Radio an waere). */
  get songId(): string {
    return this.song.id;
  }

  get sender(): Song {
    return this.song;
  }

  private get gain(): GainNode {
    return this.kette.gain;
  }

  private get zielPegel(): number {
    return this.song.pegel * this.lautstaerke;
  }

  private get schlagS(): number {
    return 60 / this.song.bpm;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // Nach einem Senderwechsel im ausgeschalteten Zustand steht hier noch die
    // Kette des alten Stuecks — Klangfarbe und Pegel gehoeren zum Sender.
    this.sorgeFuerKette();
    this.nextTime = this.ctx.currentTime + 0.1;
    // sanft einblenden, damit die Musik nicht hereinplatzt
    this.blendeEin(2.5);
    this.timer = window.setInterval(() => this.schedule(), 120);
  }

  /**
   * Nach einer Tonunterbrechung (iOS: `interrupted`) den Faden neu aufnehmen.
   *
   * `start()` hilft hier nicht: Das Laufflag steht weiter auf true, die Methode
   * steigt sofort wieder aus — genau deshalb meldete das Overlay „Musik an
   * (laeuft)", waehrend nichts zu hoeren war. Hier wird der Taktgeber neu
   * gesetzt (im Hintergrund raeumt iOS Intervalle ab), die Planungsuhr auf das
   * Jetzt gestellt und der Pegel wieder angefahren.
   */
  wiederaufnehmen(): void {
    if (!this.running) return;
    window.clearInterval(this.timer);
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 120);
    // kuerzere Blende als beim Start: die Musik lief ja schon, sie war nur weg
    this.blendeEin(0.8);
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

  /**
   * Sender wechseln. Liefert true, wenn sich etwas geaendert hat.
   *
   * Ein Wechsel ist ausdruecklich KEINE Unterbrechung: Das Laufflag bleibt, der
   * Taktgeber laeuft weiter, `wiederaufnehmen()` wird nicht angefasst. Das alte
   * Stueck blendet auf seiner eigenen Kette aus und klingt aus — deshalb knackt
   * nichts, auch wenn gerade ein langer Orgelton steht.
   */
  setSong(id: string): boolean {
    const neu = findeSender(id);
    if (neu.id === this.song.id) return false;
    this.song = neu;
    if (!this.running) {
      // Aus ist aus. Die neue Kette entsteht beim naechsten Einschalten.
      return true;
    }
    this.sorgeFuerKette();
    // Das neue Stueck faengt an seinem Anfang an, nicht mitten im Takt
    this.takt = 0;
    this.schlag = 0;
    this.nextTime = this.ctx.currentTime + WECHSEL_ANSATZ_S;
    const jetzt = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(jetzt);
    this.gain.gain.setValueAtTime(0, jetzt);
    this.gain.gain.linearRampToValueAtTime(this.zielPegel, jetzt + WECHSEL_EIN_S);
    return true;
  }

  /** Lautstaerke 0..1, bezogen auf den Grundpegel des Stuecks. */
  setVolume(v: number): void {
    this.lautstaerke = Math.max(0, Math.min(1, v));
    this.gain.gain.setTargetAtTime(this.zielPegel, this.ctx.currentTime, 0.2);
  }

  // ------------------------------------------------------------- Signalweg

  /** Kette fuer den aktuellen Sender bereitstellen, alte sauber wegblenden. */
  private sorgeFuerKette(): void {
    if (this.kette.fuer === this.song.id) return;
    this.blendeAus(this.kette);
    this.kette = this.baueKette(this.song);
  }

  private baueKette(song: Song): Kette {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const knoten: AudioNode[] = [gain];
    /*
     * Klangfarbe des Kabinenlautsprechers, in fester Reihenfolge aus den Daten
     * des Stuecks: Bandpass, Hochpass, Mittenanhebung, Tiefpass. Der Schlager
     * lief frueher durch ein Nadeloehr bei 1100 Hz — das gehoert zu ihm. Ein
     * Riff braucht dagegen seinen Bauch und bekommt nur die Kanten gestutzt.
     */
    let letzter: AudioNode = gain;
    const k = song.klang;
    if (k.bandpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = k.bandpass.hz;
      f.Q.value = k.bandpass.q;
      letzter = letzter.connect(f);
      knoten.push(f);
    }
    if (k.hochpassHz !== undefined) {
      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = k.hochpassHz;
      letzter = letzter.connect(f);
      knoten.push(f);
    }
    if (k.mitten) {
      const f = this.ctx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = k.mitten.hz;
      f.Q.value = k.mitten.q;
      f.gain.value = k.mitten.db;
      letzter = letzter.connect(f);
      knoten.push(f);
    }
    if (k.tiefpassHz !== undefined) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = k.tiefpassHz;
      letzter = letzter.connect(f);
      knoten.push(f);
    }
    letzter.connect(this.destination);
    return { gain, knoten, fuer: song.id };
  }

  /** Alte Kette ausblenden und danach abhaengen — sie haelt noch Nachklang. */
  private blendeAus(alt: Kette): void {
    const jetzt = this.ctx.currentTime;
    alt.gain.gain.cancelScheduledValues(jetzt);
    alt.gain.gain.setValueAtTime(alt.gain.gain.value, jetzt);
    alt.gain.gain.linearRampToValueAtTime(0, jetzt + WECHSEL_AUS_S);
    window.setTimeout(
      () => {
        for (const n of alt.knoten) {
          try {
            n.disconnect();
          } catch {
            /* schon getrennt — egal */
          }
        }
      },
      WECHSEL_NACHHALL_S * 1000
    );
  }

  private blendeEin(dauer: number): void {
    const jetzt = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(jetzt);
    this.gain.gain.setValueAtTime(this.gain.gain.value, jetzt);
    this.gain.gain.linearRampToValueAtTime(this.zielPegel, jetzt + dauer);
  }

  // -------------------------------------------------------------- Taktgeber

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
    const schlagS = this.schlagS;
    while (this.nextTime < this.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.playBeat(this.nextTime);
      this.nextTime += schlagS;
      this.schlag++;
      if (this.schlag >= this.song.schlaegeProTakt) {
        this.schlag = 0;
        this.takt = (this.takt + 1) % this.song.akkorde.length;
      }
    }
  }

  /** Einen Schlag aus allen Spuren zusammensetzen. */
  private playBeat(t: number): void {
    const song = this.song;
    const akkord = song.akkorde[this.takt]!;
    const schlagS = this.schlagS;
    for (const spur of song.spuren) {
      if (spur.takte && !spur.takte.includes(this.takt)) continue;
      const muster = spur.musterProTakt ? spur.musterProTakt[this.takt] : spur.muster;
      if (!muster) continue;
      const shuffelt = (spur.shuffle ?? true) && song.shuffle > 0;
      for (const ton of muster) {
        if (Math.floor(ton.schlag) !== this.schlag) continue;
        let versatz = ton.schlag - this.schlag;
        // Achtel hinter dem Schlag bekommen den Shuffle — genau die, die
        // zwischen den Zaehlzeiten liegen
        if (shuffelt && versatz > 0.4 && versatz < 0.6) versatz += song.shuffle;
        const zeit = t + (versatz + (spur.versatz ?? 0)) * schlagS;
        const dauer = ton.laenge * schlagS * (spur.laengeFaktor ?? 1);
        const pegel = spur.pegel * (ton.kraft ?? 1);
        const oktave = 12 * (spur.oktave ?? 0);
        if (ton.akkord) {
          for (const a of akkord) {
            this.spiele(spur, this.hz(a + ton.halbton + oktave), zeit, dauer, pegel);
          }
        } else {
          const grund = spur.anStufe ? akkord[0]! : 0;
          this.spiele(spur, this.hz(ton.halbton + grund + oktave), zeit, dauer, pegel);
        }
      }
    }
  }

  private hz(halbtoene: number): number {
    return this.song.grundtonHz * Math.pow(2, halbtoene / 12);
  }

  /** Eine Stimme anschlagen. */
  private spiele(spur: Spur, f: number, t: number, dur: number, peak: number): void {
    switch (spur.stimme) {
      case "zupf":
        this.zupf(f, t, dur, spur.form ?? "triangle", peak, spur.cutoff ?? 1200);
        break;
      case "flaeche":
        this.flaeche(f, t, dur, peak);
        break;
      case "fuzz":
        this.fuzz(f, t, dur, peak);
        break;
      case "bass":
        this.bass(f, t, dur, peak);
        break;
      case "orgel":
        this.orgel(f, t, dur, peak);
        break;
      case "kick":
        this.kick(t, peak);
        break;
      case "snare":
        this.snare(t, peak);
        break;
      case "hihat":
        this.rauschstoss(t, peak, "highpass", spur.cutoff ?? 7500, 1, spur.abkling ?? 0.045, 0);
        break;
      case "tamburin":
        this.rauschstoss(t, peak, "bandpass", spur.cutoff ?? 9000, 1.6, spur.abkling ?? 0.11, 0.006);
        break;
    }
  }

  // ----------------------------------------------------------------- Stimmen

  /** Kurzer, gezupfter Ton mit schnellem Abfall. */
  private zupf(
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

  /** Getragener Akkordton mit langsamem An- und Abschwellen (Streicher). */
  private flaeche(f: number, t: number, dur: number, peak: number): void {
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
    g.gain.linearRampToValueAtTime(peak, t + 0.5);
    g.gain.linearRampToValueAtTime(peak * 0.7, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(filt);
    det.connect(filt);
    filt.connect(g).connect(this.gain);
    osc.start(t);
    det.start(t);
    osc.stop(t + dur + 0.05);
    det.stop(t + dur + 0.05);
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
  private bass(f: number, t: number, dur: number, peak: number): void {
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
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(form).connect(filt).connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Getragene Orgelflaeche. */
  private orgel(f: number, t: number, dur: number, peak: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.25);
    g.gain.linearRampToValueAtTime(peak * 0.727, t + dur * 0.7); // 0,04 von 0,055
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

  private kick(t: number, peak: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    // Die Tonhoehe faellt schnell ab — das ist der Bauch einer Bassdrum
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private snare(t: number, peak: number): void {
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

  /**
   * Kurzer Rauschstoss — Hi-Hat, Tick und Tamburin sind derselbe Handgriff mit
   * anderem Filter und anderer Abklingzeit. `anriss` > 0 setzt eine winzige
   * Anstiegsflanke davor, damit das Tamburin schwingt statt zu knallen.
   */
  private rauschstoss(
    t: number,
    peak: number,
    typ: BiquadFilterType,
    hz: number,
    q: number,
    abkling: number,
    anriss: number
  ): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.holeRauschen();
    const filt = this.ctx.createBiquadFilter();
    filt.type = typ;
    filt.frequency.value = hz;
    filt.Q.value = q;
    const g = this.ctx.createGain();
    if (anriss > 0) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + anriss);
    } else {
      g.gain.setValueAtTime(peak, t);
    }
    g.gain.exponentialRampToValueAtTime(0.0005, t + anriss + abkling);
    src.connect(filt).connect(g).connect(this.gain);
    src.start(t);
    src.stop(t + anriss + abkling + 0.02);
  }
}

export type { Song, Spur, Ton };
