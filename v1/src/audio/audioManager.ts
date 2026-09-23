/**
 * Kern-Sounds M1 (Briefing Kap. 15) — komplett prozedural per WebAudio, keine Assets.
 * Audio ist der primäre Belohnungskanal: jeder Abwurf klingt nach seinem Material,
 * richtig = angenehmer Doppelton, falsch = stumpfer Missklang.
 * Startet erst nach der ersten echten Nutzereingabe (Browser-Autoplay-Policy).
 *
 * Tonwaechter (Befund 14.09.2026, iPad): Der Tonkanal faellt auf iOS in den
 * Zustand `interrupted`, sobald die Seite in den Hintergrund geht, der
 * Bildschirm sperrt oder ein Anruf kommt — und er kommt ohne ausdrueckliches
 * `resume()` nicht zurueck. Deshalb wird hier aus DREI Richtungen geweckt:
 * bei jeder Nutzergeste, bei `visibilitychange`/`pageshow`/`focus` und direkt
 * am Kanal ueber `statechange` — letzteres fuer den Ausfall mitten im Spiel,
 * bei dem es gar keine Geste gibt, an der man sich festhalten koennte.
 */
import { Music } from "./music";
import { findeSender, STANDARD_SENDER, type Song } from "./songs";
import { brauchtNeuaufbau, brauchtWeckruf, istHoerbar, type Tondiagnose } from "./tonzustand";

/**
 * Nachfassfristen in Millisekunden. `resume()` loest sein Versprechen auf iOS
 * auch dann ein, wenn der Kanal gleich wieder stumm wird — dem Versprechen
 * allein darf man also nicht glauben, man muss nachsehen.
 * SW: 250 ms (unmittelbar nach der Geste) und 1200 ms (nachdem das System die
 * Unterbrechung abgeschlossen hat).
 */
const NACHSEHEN_MS = [250, 1200];
/**
 * So viele Weckrufe duerfen vergeblich bleiben, bevor der Kanal beim naechsten
 * Antippen komplett neu gebaut wird. SW: 3 — die ersten beiden koennen daran
 * scheitern, dass gerade keine Nutzergeste anlag (dann verweigert Safari das
 * Aufwecken); beim dritten ist der Kanal vermutlich verloren.
 */
const NEUAUFBAU_AB = 3;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: Music | null = null;
  /** Musikwunsch des Spielers — gilt auch, bevor der Ton überhaupt läuft */
  private musicWanted = true;
  /**
   * Gewaehlter Sender. Steht auch dann schon fest, wenn es den Tonkanal noch
   * gar nicht gibt: Die erste Geste baut ihn dann gleich mit dem richtigen
   * Stueck auf, statt kurz das falsche anzuspielen.
   */
  private songWanted: string = STANDARD_SENDER;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private hydraulicGain: GainNode | null = null;
  private hydOsc: OscillatorNode | null = null;
  private scrapeGain: GainNode | null = null;
  /** Alle Dauerquellen, damit sie nach einer Unterbrechung ersetzt werden koennen */
  private dauerquellen: AudioScheduledSourceNode[] = [];
  /** Vergebliche Weckrufe, seit der Ton zuletzt lief */
  private weckversuche = 0;
  /** Seit dem letzten hoerbaren Moment gab es eine Unterbrechung */
  private unterbrochen = false;

  constructor() {
    const start = (): void => this.ensureStarted();
    // Mobile Browser geben den Ton erst nach einer echten Geste frei, und
    // welches Ereignis dabei zählt, unterscheidet sich je nach System — daher
    // auf alle üblichen hören.
    for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
      window.addEventListener(ev, start, { once: false, passive: true });
    }
    // Rueckkehr aus dem Hintergrund. Ohne diesen Handler bleibt ein auf
    // `interrupted` gefallener Kanal stumm, bis der Spieler zufaellig tippt.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.ensureStarted();
    });
    // Safari meldet die Rueckkehr aus dem Seiten-Zwischenspeicher (bfcache)
    // nur ueber `pageshow`; nach einem App-Wechsel kommt teils nur `focus`.
    window.addEventListener("pageshow", start);
    window.addEventListener("focus", start);
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

  /** Kennung des gewaehlten Senders (fuer Menue und Spielstand). */
  get songId(): string {
    return this.songWanted;
  }

  /** Der gewaehlte Sender als Datensatz — Name, Frequenz, Beschreibung. */
  get song(): Song {
    return findeSender(this.songWanted);
  }

  /**
   * Sender waehlen. Liefert true, wenn sich etwas geaendert hat. Das Radio
   * bleibt dabei, wie es war: Ist es aus, bleibt es still.
   */
  setSong(id: string): boolean {
    const gewaehlt = findeSender(id).id;
    if (gewaehlt === this.songWanted) return false;
    this.songWanted = gewaehlt;
    this.music?.setSong(gewaehlt);
    return true;
  }

  /**
   * Zustandsbericht für Fehlersuche und Tests — bewusst ehrlich: `musicRunning`
   * meldet nur dann „laeuft", wenn der Kanal auch wirklich Ton durchlaesst.
   * Vorher stand im Overlay „Musik an (laeuft)", waehrend der Kanal auf
   * `interrupted` stand und nichts zu hoeren war.
   */
  get diagnostics(): Tondiagnose {
    const zustand = (this.ctx?.state as string | undefined) ?? "keiner";
    const hoerbar = istHoerbar(zustand);
    return {
      ctx: zustand,
      musicWanted: this.musicWanted,
      musicRunning: (this.music?.enabled ?? false) && hoerbar,
      hoerbar,
      weckversuche: this.weckversuche,
    };
  }

  /**
   * Einstiegspunkt aller Weckrichtungen: baut den Kanal beim ersten Mal auf,
   * weckt ihn danach, und baut ihn notfalls neu.
   */
  private ensureStarted(): void {
    const ctx = this.ctx;
    if (!ctx) {
      this.baueKanal();
      return;
    }
    const zustand = ctx.state as string;
    if (brauchtNeuaufbau(zustand) || (this.weckversuche >= NEUAUFBAU_AB && !istHoerbar(zustand))) {
      this.neuAufbauen();
      return;
    }
    if (brauchtWeckruf(zustand)) {
      this.weckruf();
      return;
    }
    this.laeuftWieder();
  }

  /**
   * `resume()` anstossen und nachsehen, ob es geholfen hat. Der Weckruf gilt
   * so lange als vergeblich, bis das Gegenteil festgestellt ist — deshalb wird
   * hier hochgezaehlt und erst in `laeuftWieder()` zurueckgesetzt.
   */
  private weckruf(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.unterbrochen = true;
    this.weckversuche++;
    ctx.resume().catch(() => {});
    for (const ms of NACHSEHEN_MS) window.setTimeout(() => this.nachsehen(), ms);
  }

  /** Hat der Weckruf gegriffen? Wenn nein: noch einmal schieben. */
  private nachsehen(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const zustand = ctx.state as string;
    if (istHoerbar(zustand)) {
      this.laeuftWieder();
      return;
    }
    if (brauchtWeckruf(zustand)) ctx.resume().catch(() => {});
  }

  /**
   * Der Kanal ist (wieder) offen. Nach einer Unterbrechung werden die
   * Dauerquellen ersetzt: Auf iOS gelten Oszillatoren und Rauschschleifen
   * danach zwar weiter als laufend, geben aber nichts mehr aus.
   */
  private laeuftWieder(): void {
    this.weckversuche = 0;
    if (this.unterbrochen) {
      this.unterbrochen = false;
      this.baueDauertoene();
      this.music?.wiederaufnehmen();
    }
    if (this.musicWanted) this.music?.start();
  }

  /** Kanal samt Musik von Grund auf neu. Letzte Rettung, wenn nichts weckt. */
  private neuAufbauen(): void {
    const alt = this.ctx;
    this.stoppeDauertoene();
    try {
      this.music?.stop();
    } catch {
      /* toter Kanal — egal, er wird ohnehin verworfen */
    }
    this.music = null;
    this.ctx = null;
    this.master = null;
    // Der Rauschpuffer gehoert zum alten Kanal und waere im neuen unbrauchbar
    this.cachedNoise = null;
    this.weckversuche = 0;
    this.unterbrochen = false;
    try {
      alt?.close().catch(() => {});
    } catch {
      /* war schon zu */
    }
    this.baueKanal();
  }

  private baueKanal(): void {
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(ctx.destination);
      this.unterbrochen = false;
      this.weckversuche = 0;

      // Der Kanal meldet selbst, wenn er einschlaeft — der einzige Weg, einen
      // Ausfall mitten im Spiel (Anruf, Kontrollzentrum) sofort zu bemerken.
      ctx.onstatechange = (): void => {
        if (this.ctx !== ctx) return; // gehoert zu einem verworfenen Kanal
        const z = ctx.state as string;
        if (istHoerbar(z)) this.laeuftWieder();
        else if (brauchtWeckruf(z)) this.weckruf();
      };

      // Hintergrundmusik, zur Laufzeit erzeugt — keine fremden Aufnahmen
      this.music = new Music(ctx, this.master, this.songWanted);
      if (this.musicWanted) this.music.start();

      this.baueDauertoene();

      // Frisch angelegte Kanaele starten auf iOS haeufig als `suspended`
      if (brauchtWeckruf(ctx.state as string)) this.weckruf();
    } catch {
      this.ctx = null; // Audio bleibt aus, Spiel läuft weiter
    }
  }

  /**
   * Motor, Hydraulik und Kratzen laufen dauerhaft. Sie liegen in einer eigenen
   * Methode, weil sie nach jeder Tonunterbrechung ersetzt werden muessen.
   */
  private baueDauertoene(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    this.stoppeDauertoene();

    // Diesel-Loop: tiefer Sägezahn + Tiefpass, Drehzahl folgt der Aktivität
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 48;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 220;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(master);
    this.engineOsc.start();

    // Hydraulik: kein Zischen mehr, sondern ein dezenter Pumpenton, der beim
    // Bedienen mitläuft (Design-Wunsch 2026-08-29)
    this.hydOsc = ctx.createOscillator();
    this.hydOsc.type = "triangle";
    this.hydOsc.frequency.value = 118;
    const hydFilter = ctx.createBiquadFilter();
    hydFilter.type = "lowpass";
    hydFilter.frequency.value = 520;
    this.hydraulicGain = ctx.createGain();
    this.hydraulicGain.gain.value = 0;
    this.hydOsc.connect(hydFilter).connect(this.hydraulicGain).connect(master);
    this.hydOsc.start();
    // leichtes Pulsieren der Pumpe
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain).connect(this.hydOsc.frequency);
    lfo.start();

    // Kratzen auf Beton: helleres, raueres Rauschband — Gain folgt der Kontakt-Intensität
    const scrapeNoise = ctx.createBufferSource();
    scrapeNoise.buffer = this.noiseBuffer();
    scrapeNoise.loop = true;
    const scrapeFilter = ctx.createBiquadFilter();
    scrapeFilter.type = "bandpass";
    scrapeFilter.frequency.value = 2600;
    scrapeFilter.Q.value = 1.2;
    this.scrapeGain = ctx.createGain();
    this.scrapeGain.gain.value = 0;
    scrapeNoise.connect(scrapeFilter).connect(this.scrapeGain).connect(master);
    scrapeNoise.start();

    this.dauerquellen = [this.engineOsc, this.hydOsc, lfo, scrapeNoise];
  }

  /** Alte Dauerquellen abstellen und abhaengen, damit nichts doppelt laeuft. */
  private stoppeDauertoene(): void {
    for (const q of this.dauerquellen) {
      try {
        q.stop();
      } catch {
        /* nie gestartet oder schon gestoppt */
      }
      try {
        q.disconnect();
      } catch {
        /* schon abgehaengt */
      }
    }
    this.dauerquellen = [];
    this.engineOsc = null;
    this.engineGain = null;
    this.hydOsc = null;
    this.hydraulicGain = null;
    this.scrapeGain = null;
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
  playClawSnap(haerte = 1, _typ?: string): void {
    const h = Math.max(0.15, Math.min(haerte, 1));
    this.metalHit([620, 940, 1380, 1970], [0.34 * h, 0.26 * h, 0.18 * h, 0.12 * h], 0.1 + 0.12 * h, {
      transient: 1500,
      transientGain: 0.3 * h,
      spread: 0.012,
    });
  }

  playGrab(_materialId?: string): void {
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
  /*
   * ------------------------------------------------------------------
   * Stumm gestellt, nicht geloescht (Ansage 12.09.2026: "erst Ton fixen,
   * auf Stand von gestern frueh gehen, und Toene einzeln testen spaeter").
   *
   * Die Klangwelt steht wieder auf dem Stand vom 11.09. mittags — vor der
   * gesamten Tonueberarbeitung. Drei Dinge sind seither im Spiel dazugekommen
   * und rufen hier an: Aufschlaege von Teilen, der Rueckfahrwarner und der
   * Taktgeber der Platzkulisse. Sie bleiben als leere Einsprungstellen
   * stehen, damit das Spiel unveraendert laeuft und jeder Klang spaeter
   * EINZELN wieder eingeschaltet und beurteilt werden kann — genau so, wie
   * es diesmal haette laufen muessen.
   *
   * Was daraus geworden ist, steht in docs/tonkonzept.md.
   * ------------------------------------------------------------------
   */

  /** Ein Teil schlaegt auf. Stumm, bis der Ton einzeln geprueft wird. */
  playAufprall(_materialId: string, _wucht: number, _aufStahl: boolean): void {}

  /** Rueckfahrwarner eines rangierenden LKW. Stumm, siehe oben. */
  setRueckfahrwarner(_an: boolean): void {}

  /** Taktgeber der Platzkulisse. Stumm, siehe oben. */
  tickUmgebung(_dt: number): void {}

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

  /**
   * DIE FEIERABENDGLOCKE (E-113).
   *
   * Zwei Schläge auf eine Werksglocke, prozedural wie alles hier: ein
   * Grundton und drei Teiltöne, die NICHT ganzzahlig darüber liegen. Genau das
   * macht den Unterschied zwischen einer Glocke und einer Orgelpfeife —
   * 2,00 × (Oktave), 2,76 × und 5,40 × sind die Teiltöne, die eine echte
   * Glocke in diesem Verhältnis hat. Mit sauberen Oktaven klänge es nach
   * Kirchenlied, mit einem Ton allein nach Türklingel.
   *
   * Lang ausklingend (2,2 s) und leise: Der Tag hört auf, er wird nicht
   * angepfiffen. Der zweite Schlag kommt nach 0,62 s und etwas schwächer —
   * niemand schlägt zweimal gleich hart an.
   */
  playFeierabend(): void {
    // SW: Lautstärken wie playSale (0,14) als Obergrenze, Glocke etwas darunter
    const schlag = (delay: number, gain: number): void => {
      this.tone(523, 2.2, gain, delay); // Grundton c''
      this.tone(1046, 1.5, gain * 0.5, delay); // 2,00 ×
      this.tone(1443, 1.0, gain * 0.26, delay); // 2,76 ×
      this.tone(2824, 0.45, gain * 0.1, delay); // 5,40 ×
    };
    schlag(0, 0.12);
    schlag(0.62, 0.085);
  }

  /**
   * Die Sterne des Tages, hörbar (E-113).
   *
   * Ein bis drei kurze Töne, aufsteigend — man hört die Bewertung, ohne
   * hinzusehen (Blindtest-Regel: Farbe und Zeichen sind nie der einzige
   * Kanal, und der Ton ist der dritte). Sie setzen nach der Glocke ein, damit
   * sie nicht im Anschlag untergehen.
   */
  playSterne(anzahl: number): void {
    const stufen = [660, 880, 1320]; // Quinte, Oktave, Duodezime über e''
    for (let i = 0; i < Math.max(0, Math.min(3, anzahl)); i++) {
      this.tone(stufen[i]!, 0.3, 0.1, 0.95 + i * 0.26);
    }
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
