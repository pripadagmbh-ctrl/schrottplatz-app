/**
 * Kern-Sounds M1 (Briefing Kap. 15) — komplett prozedural per WebAudio, keine Assets.
 * Audio ist der primäre Belohnungskanal: jeder Abwurf klingt nach seinem Material,
 * richtig = angenehmer Doppelton, falsch = stumpfer Missklang.
 * Startet erst nach der ersten echten Nutzereingabe (Browser-Autoplay-Policy).
 */
import { Music } from "./music";

/** So oft hoechstens ein Aufschlag (s) — der staerkste im Fenster gewinnt */
const AUFPRALL_FENSTER_S = 0.14;

/**
 * Obere Grenzfrequenz der Geraeusche (Hz). Darueber klingt es nach Werkstatt
 * mit Fliesen, nicht nach Schrottplatz — und auf kleinen Lautsprechern nur
 * noch schrill.
 */
const SFX_TIEFPASS_HZ = 1800;

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
  /** Sammelweg aller Geraeusche — gefiltert, damit es dumpf bleibt */
  private sfx: GainNode | null = null;

  constructor() {
    const start = () => this.ensureStarted();
    // Mobile Browser geben den Ton erst nach einer echten Geste frei, und
    // welches Ereignis dabei zählt, unterscheidet sich je nach System — daher
    // auf alle üblichen hören.
    for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
      window.addEventListener(ev, start, { once: false, passive: true });
    }
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

  /** Zustandsbericht für Fehlersuche und Tests. */
  get diagnostics(): { ctx: string; musicWanted: boolean; musicRunning: boolean } {
    return {
      ctx: this.ctx?.state ?? "keiner",
      musicWanted: this.musicWanted,
      musicRunning: this.music?.enabled ?? false,
    };
  }

  private ensureStarted(): void {
    if (this.ctx) {
      // Auf dem Handy kann der Ton jederzeit wieder einschlafen (Anruf,
      // Bildschirm aus, Tabwechsel) — bei jeder Geste erneut aufwecken.
      if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
      if (this.musicWanted) this.music?.start();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      /*
       * Eigener Weg fuer die Geraeusche, mit Tiefpass davor (Wunsch
       * 11.09.2026: "Ton dumpfer").
       *
       * Ein Schrottplatz klingt nicht hell. Stahl auf Beton ist ein dumpfer
       * Schlag mit kurzem Nachklang, kein Glockenton — und auf einem kleinen
       * Tablet-Lautsprecher wirkt Hoehe ohnehin nur schrill. Die Musik laeuft
       * absichtlich daran vorbei: Sie soll klar bleiben.
       */
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 1;
      const dumpf = this.ctx.createBiquadFilter();
      dumpf.type = "lowpass";
      dumpf.frequency.value = SFX_TIEFPASS_HZ;
      dumpf.Q.value = 0.6;
      // Leichte Anhebung im Bauchbereich, damit der Schlag Koerper behaelt,
      // wenn die Hoehen weg sind
      const bauch = this.ctx.createBiquadFilter();
      bauch.type = "peaking";
      bauch.frequency.value = 180;
      bauch.Q.value = 0.9;
      bauch.gain.value = 4;
      this.sfx.connect(bauch).connect(dumpf).connect(this.master);

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
      this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.sfx);
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
      this.hydOsc.connect(hydFilter).connect(this.hydraulicGain).connect(this.sfx);
      this.hydOsc.start();
      // leichtes Pulsieren der Pumpe
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 7.5;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 5;
      lfo.connect(lfoGain).connect(this.hydOsc.frequency);
      lfo.start();

      /*
       * Kratzen auf Beton. Vorher ein helles Rauschband bei 2600 Hz — das
       * klang nach Sandpapier auf Holz, nicht nach Stahlzacken auf Beton
       * (Befund 11.09.2026). Stahl auf Beton ist tief und koernig: ein
       * Rumpeln mit etwas Griff darueber, nicht ein Zischen.
       */
      const scrapeNoise = this.ctx.createBufferSource();
      scrapeNoise.buffer = this.noiseBuffer();
      scrapeNoise.loop = true;
      const scrapeFilter = this.ctx.createBiquadFilter();
      scrapeFilter.type = "bandpass";
      scrapeFilter.frequency.value = 760;
      scrapeFilter.Q.value = 0.8;
      this.scrapeGain = this.ctx.createGain();
      this.scrapeGain.gain.value = 0;
      scrapeNoise.connect(scrapeFilter).connect(this.scrapeGain).connect(this.sfx);
      scrapeNoise.start();

      this.starteUmgebung();
    } catch {
      this.ctx = null; // Audio bleibt aus, Spiel läuft weiter
    }
  }

  /*
   * --- Platzkulisse (Wunsch 11.09.2026: "mehr Tonkulisse wie auf echtem
   * Schrottplatz") ---
   *
   * Ein Schrottplatz ist nie still, aber auch nicht laut: Wind ueber freier
   * Flaeche, weit weg ein Schlag, wenn jemand etwas abkippt, das Kreischen
   * einer Flex aus der Halle, Kraehen. Dazu der Rueckfahrwarner, ohne den
   * kein Hof auskommt.
   *
   * Alles prozedural wie der Rest — keine Aufnahmen, also auch keine
   * Rechtefragen. Die Einzelgeraeusche kommen unregelmaessig und mit
   * zufaelliger Entfernung: Weiter weg heisst leiser UND dumpfer, das ist der
   * halbe Realismus.
   */
  /** Abstand zweier Zufallsgeraeusche (s) */
  private static readonly KULISSE_PAUSE: [number, number] = [6, 17];
  private kulisseRest = 4;
  private windGain: GainNode | null = null;
  private warnOsc: OscillatorNode | null = null;
  private warnGain: GainNode | null = null;
  private warnAn = false;
  private warnTakt = 0;

  private starteUmgebung(): void {
    if (!this.ctx || !this.sfx) return;
    // Windbett: tiefes Rauschen, langsam an- und abschwellend
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer();
    wind.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 320;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.035;
    wind.connect(windFilter).connect(this.windGain).connect(this.sfx);
    wind.start();
    const boe = this.ctx.createOscillator();
    boe.frequency.value = 0.07; // eine Boe alle gut vierzehn Sekunden
    const boeGain = this.ctx.createGain();
    boeGain.gain.value = 0.022;
    boe.connect(boeGain).connect(this.windGain.gain);
    boe.start();

    // Rueckfahrwarner: liegt bereit und wird nur auf- und zugeblendet
    this.warnOsc = this.ctx.createOscillator();
    this.warnOsc.type = "square";
    this.warnOsc.frequency.value = 1050;
    const warnFilter = this.ctx.createBiquadFilter();
    warnFilter.type = "lowpass";
    warnFilter.frequency.value = 1500; // aus der Ferne, nicht schrill
    this.warnGain = this.ctx.createGain();
    this.warnGain.gain.value = 0;
    this.warnOsc.connect(warnFilter).connect(this.warnGain).connect(this.sfx);
    this.warnOsc.start();
  }

  /**
   * Je Bild aufrufen. Zaehlt die Kulisse weiter und schaltet den
   * Rueckfahrwarner im Takt.
   */
  tickUmgebung(dt: number): void {
    if (!this.ctx) return;
    this.spieleAufprallPuffer(dt);
    this.kulisseRest -= dt;
    if (this.kulisseRest <= 0) {
      const [a, b] = AudioManager.KULISSE_PAUSE;
      this.kulisseRest = a + Math.random() * (b - a);
      this.zufallsgeraeusch();
    }
    if (this.warnGain) {
      this.warnTakt += dt;
      const an = this.warnAn && this.warnTakt % 0.74 < 0.37;
      this.warnGain.gain.setTargetAtTime(an ? 0.028 : 0, this.ctx.currentTime, 0.01);
    }
  }

  /** Rueckfahrwarner an/aus — von der Fahrzeugverwaltung gesetzt. */
  setRueckfahrwarner(an: boolean): void {
    this.warnAn = an;
  }

  /** Ein zufaelliges Geraeusch vom Platz, mit zufaelliger Entfernung. */
  private zufallsgeraeusch(): void {
    // 0 = direkt daneben, 1 = am anderen Ende des Platzes
    const fern = 0.25 + Math.random() * 0.75;
    const leise = (1 - fern) * 0.8 + 0.12;
    const wuerfel = Math.random();
    if (wuerfel < 0.34) this.fernerSchlag(leise, fern);
    else if (wuerfel < 0.55) this.hammer(leise, fern);
    else if (wuerfel < 0.72) this.flex(leise, fern);
    else if (wuerfel < 0.9) this.kraehe(leise);
    else this.ferneHupe(leise, fern);
  }

  /** Irgendwo faellt etwas Schweres — der haeufigste Klang auf dem Platz. */
  private fernerSchlag(pegel: number, fern: number): void {
    this.metalHit(
      [88, 132, 196, 279],
      [0.5, 0.36, 0.24, 0.16],
      0.1 * pegel,
      { transient: 300 - fern * 120, transientGain: 0.12 * pegel, spread: 0.03 }
    );
  }

  /** Jemand schlaegt mit dem Vorschlaghammer: drei Schlaege, ungleich verteilt. */
  private hammer(pegel: number, fern: number): void {
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = start + i * (0.26 + Math.random() * 0.12);
      this.spaeter(t - start, () =>
        this.metalHit([150, 232, 338], [0.28, 0.2, 0.13], 0.085 * pegel, {
          transient: 420 - fern * 160,
          transientGain: 0.1 * pegel,
          spread: 0.02,
        })
      );
    }
  }

  /** Trennschleifer aus der Halle: Rauschband, das kurz hochzieht. */
  private flex(pegel: number, fern: number): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime;
    const dauer = 0.7 + Math.random() * 0.9;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 6;
    const f0 = 900 - fern * 250;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.linearRampToValueAtTime(f0 * 1.45, t + dauer * 0.35);
    bp.frequency.linearRampToValueAtTime(f0 * 1.1, t + dauer);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * pegel, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dauer + 0.05);
  }

  /** Kraehe ueber dem Platz — zwei, drei Rufe. */
  private kraehe(pegel: number): void {
    if (!this.ctx || !this.sfx) return;
    const rufe = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < rufe; i++) {
      this.spaeter(i * (0.32 + Math.random() * 0.18), () => {
        if (!this.ctx || !this.sfx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = "sawtooth";
        const f = 620 + Math.random() * 140;
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.22);
        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 900;
        bp.Q.value = 2.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05 * pegel, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        osc.connect(bp).connect(g).connect(this.sfx);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }
  }

  /** Weit weg hupt jemand — kurz, zweitoenig. */
  private ferneHupe(pegel: number, fern: number): void {
    this.burst([196, 262], 0.35, 0.05 * pegel * (1 - fern * 0.4), "square");
  }

  /** Kleiner Zeitversatz ohne eigenen Scheduler. */
  private spaeter(sekunden: number, tue: () => void): void {
    window.setTimeout(tue, Math.max(0, sekunden * 1000));
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

  /**
   * Zuschnappen der Spinne: Stahl auf Stahl (Wunsch 11.09.2026).
   *
   * Kein Zupacken-Thump, sondern ein harter, heller Anschlag mit kurzem
   * metallischem Nachklingen — so klingt es, wenn die Zaehne leer
   * aufeinandertreffen. Liegt Material dazwischen, daempft das: dann kommt
   * `haerte` kleiner herein und der Klang wird kuerzer und leiser.
   */
  playClawSnap(haerte = 1): void {
    const h = Math.max(0.15, Math.min(haerte, 1));
    this.metalHit([330, 505, 742, 1058], [0.36 * h, 0.27 * h, 0.19 * h, 0.12 * h], 0.12 + 0.14 * h, {
      transient: 434,
      transientGain: 0.34 * h,
      spread: 0.012,
    });
  }

  /**
   * Aufprall eines Teils (Wunsch 11.09.2026).
   *
   * Der wichtigste Klang auf dem Platz: Blech faellt auf die Ladeflaeche,
   * Traeger schlaegt gegen die Bordwand, Brocken landet auf Beton. Drei
   * Groessen faerben ihn:
   *
   *   WUCHT     wie schnell das Teil war — Lautstaerke und Laenge
   *   MATERIAL  was aufschlaegt — Stahl klingt nach, Holz nicht
   *   UNTERGRUND Stahl unter dem Teil laesst die ganze Flaeche mitschwingen,
   *              Beton schluckt es
   *
   * @param wucht Tempoverlust beim Aufschlag (m/s)
   * @param aufStahl true = Ladeflaeche oder Bordwand, false = Boden
   */
  playAufprall(materialId: string, wucht: number, aufStahl: boolean): void {
    /*
     * Gesammelt statt sofort gespielt. Beim Abkippen schlagen binnen einer
     * Sekunde ein Dutzend Teile auf (gemessen: 169 Aufschlaege in zwoelf
     * Sekunden, in Spitzen 14 je Sekunde). Einzeln abgespielt waere das ein
     * Maschinengewehr; in Wirklichkeit hoert man ein einziges, rollendes
     * Krachen. Also wird je Fenster der staerkste Aufschlag gespielt, und die
     * Zahl der gesammelten hebt ihn etwas an.
     */
    if (wucht > this.puffer.wucht) {
      this.puffer = { materialId, wucht, aufStahl, zahl: this.puffer.zahl + 1 };
    } else {
      this.puffer.zahl++;
    }
  }

  private puffer = { materialId: "steel", wucht: 0, aufStahl: false, zahl: 0 };
  private aufprallRest = 0;

  /** Gesammelte Aufschlaege ausgeben — aus tickUmgebung gerufen. */
  private spieleAufprallPuffer(dt: number): void {
    this.aufprallRest -= dt;
    if (this.aufprallRest > 0 || this.puffer.zahl === 0) return;
    this.aufprallRest = AUFPRALL_FENSTER_S;
    const { materialId, wucht, aufStahl, zahl } = this.puffer;
    this.puffer = { materialId: "steel", wucht: 0, aufStahl: false, zahl: 0 };
    // Mehrere Teile zugleich: lauter, aber nicht linear — sonst uebersteuert
    // eine volle Fuhre alles andere.
    this.aufprallJetzt(materialId, wucht * (1 + Math.log10(zahl) * 0.6), aufStahl);
  }

  private aufprallJetzt(materialId: string, wucht: number, aufStahl: boolean): void {
    if (!this.ctx || !this.sfx) return;
    const w = Math.min(Math.max(wucht / 4, 0.12), 1);
    const weich =
      materialId === "wood" ||
      materialId === "plastic" ||
      materialId === "tires" ||
      materialId === "rubble" ||
      materialId === "cable";

    if (aufStahl) {
      /*
       * Ladeflaeche und Bordwaende sind grosse, duenne Stahlbleche. Sie
       * antworten mit einem tiefen Wummern und einem laenger stehenden,
       * leicht verstimmten Nachklang — das ist der Klang, den man von einem
       * Schrottplatz kennt.
       */
      this.metalHit(
        [72, 108, 163, 241, 352],
        [0.85, 0.7, 0.52, 0.36, 0.24],
        (weich ? 0.1 : 0.22) * w,
        { transient: 240, transientGain: 0.22 * w, spread: 0.035 }
      );
      this.burst([44, 58], 0.26 + 0.2 * w, 0.16 * w, "sine"); // das Blech wummert
      if (!weich) this.noiseBurst(520, 0.12, 0.1 * w); // Scheppern obendrauf
      return;
    }
    // Auf Beton: kurz, dumpf, kaum Nachklang
    this.metalHit(
      [96, 141, 208],
      [0.3, 0.2, 0.13],
      (weich ? 0.08 : 0.16) * w,
      { transient: 260, transientGain: 0.2 * w, spread: 0.02 }
    );
    this.noiseBurst(220, 0.09, 0.12 * w);
  }

  /**
   * Zupacken. Der Klang gefaellt und bleibt deshalb, wie er ist — nur bekommt
   * er jetzt je nach Material eine eigene Faerbung (Wunsch 11.09.2026):
   * Stahl sattt und tief, Blech und Alu heller und kuerzer, Kabel und
   * Nichtmetalle dumpf ohne Nachklang.
   */
  playGrab(materialId = "steel"): void {
    switch (materialId) {
      case "alu":
      case "va":
        this.burst([96], 0.15, 0.3, "triangle");
        this.noiseBurst(620, 0.07, 0.22);
        break;
      case "copper":
        this.burst([84], 0.17, 0.32, "triangle");
        this.noiseBurst(430, 0.08, 0.2);
        break;
      case "cable":
      case "wood":
      case "plastic":
      case "tires":
      case "rubble":
        // kein Metall: nur der dumpfe Griff, kein Klang danach
        this.burst([58], 0.2, 0.3, "sine");
        this.noiseBurst(260, 0.1, 0.2);
        break;
      default:
        // Stahl, Mischschrott, Ballen: satt und tief
        this.burst([70], 0.18, 0.35, "triangle");
        this.noiseBurst(420, 0.08, 0.25);
    }
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
        this.metalHit([132, 205, 301, 441, 646], [1.0, 0.78, 0.55, 0.36, 0.24], 0.3, {
          transient: 992,
          transientGain: 0.3,
          spread: 0.05,
        });
        break;
      case "va":
        // Edelstahl: heller und klarer, klingt am längsten nach
        this.metalHit([243, 379, 566, 823, 1180], [1.3, 1.0, 0.72, 0.46, 0.3], 0.24, {
          transient: 1400,
          transientGain: 0.2,
          spread: 0.03,
        });
        break;
      case "alu":
        // Aluminium: leicht, hell, kurzer Nachhall
        this.metalHit([324, 500, 736, 1037], [0.55, 0.38, 0.25, 0.17], 0.22, {
          transient: 1400,
          transientGain: 0.22,
          spread: 0.04,
        });
        break;
      case "copper":
        // Kupfer/Messing: weicher, dunkler Klang mit tragendem Sustain
        this.metalHit([184, 278, 414, 590], [1.05, 0.82, 0.56, 0.36], 0.26, {
          transient: 682,
          transientGain: 0.18,
          spread: 0.06,
        });
        break;
      case "cable":
        // Kabelbund: fast tonlos, dumpfes Poltern mit Raschelanteil
        this.metalHit([88, 126], [0.26, 0.2], 0.24, {
          transient: 558,
          transientGain: 0.3,
          spread: 0.09,
        });
        this.noiseBurst(1600, 0.22, 0.16);
        break;
      default:
        // Störstoff (Holz, Beton, Kunststoff): Schlag ohne metallisches Klingen
        this.metalHit([72, 104], [0.16, 0.12], 0.34, {
          transient: 260,
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
      osc.connect(g).connect(this.sfx!);
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
    osc.connect(g).connect(this.sfx!);
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

  /**
   * Rastklick des Funktionsrädchens — ein sehr kurzer, trockener Tick, wie
   * das Einrasten eines Drehschalters. Bewusst leise: er kommt bei jedem
   * Eintrag und darf nicht nerven.
   */
  playTick(): void {
    this.tone(1760, 0.035, 0.045, 0);
    this.tone(2640, 0.022, 0.025, 0.004);
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
    osc.connect(g).connect(this.sfx!);
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
      osc.connect(g).connect(this.sfx!);
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
    src.connect(filter).connect(g).connect(this.sfx!);
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
