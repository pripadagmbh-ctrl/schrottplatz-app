/**
 * Kern-Sounds M1 (Briefing Kap. 15) — komplett prozedural per WebAudio, keine Assets.
 * Audio ist der primäre Belohnungskanal: jeder Abwurf klingt nach seinem Material,
 * richtig = angenehmer Doppelton, falsch = stumpfer Missklang.
 * Startet erst nach der ersten echten Nutzereingabe (Browser-Autoplay-Policy).
 */
import { Music } from "./music";

/**
 * Klangprofile der Greifer (Wunsch 11.09.2026: "Muster fuer unterschiedliche
 * Greifer").
 *
 * Die Groesse bestimmt die Tonlage, die Bauart das Nachklingen: Ein kleiner
 * Polypgreifer schnappt hell und kurz, ein schwerer Schrottgreifer dumpf und
 * lange, zwei Schalen treffen flaechig und dröhnen nach, ein Magnet schnappt
 * gar nicht — er saugt an und schlaegt einmal dumpf auf.
 */
import {
  DREHZAHL_STUETZEN,
  UMSCHLAGBAGGER,
  dieselSchleife,
  drehzahlFuer,
  mischung,
} from "./diesel";

export type GreiferKlang = "polyp" | "schrott" | "zweischalen" | "magnet";

interface GreiferProfil {
  freqs: number[];
  guete: number[];
  wumms: number;
  wummsVon: number;
  wummsBis: number;
  wummsDauer: number;
  nachschlag: boolean;
  /** Rauschanteil (Hz) — Schmutz und Dreck zwischen den Schalen */
  rauschen?: number;
}

const GREIFER_KLANG: Record<GreiferKlang, GreiferProfil> = {
  // klein und leicht: hoeher, kurz, wenig Bass
  polyp: {
    freqs: [268, 402, 589, 831, 1146, 1680, 2410],
    guete: [40, 32, 26, 20, 16, 12, 9],
    wumms: 0.12,
    wummsVon: 128,
    wummsBis: 74,
    wummsDauer: 0.1,
    nachschlag: true,
    rauschen: 1300,
  },
  // der grosse Schrottgreifer: tief, satt, langes Nachklappern
  schrott: {
    freqs: [168, 252, 371, 523, 742, 1090, 1580, 2270],
    guete: [55, 42, 34, 26, 20, 15, 11, 8],
    wumms: 0.24,
    wummsVon: 104,
    wummsBis: 52,
    wummsDauer: 0.18,
    nachschlag: true,
    rauschen: 1000,
  },
  // zwei grosse Schalen: flaechiger Schlag, droehnt nach
  zweischalen: {
    freqs: [96, 143, 214, 318, 472, 690, 1010],
    guete: [85, 66, 52, 40, 30, 20, 14],
    wumms: 0.4,
    wummsVon: 88,
    wummsBis: 40,
    wummsDauer: 0.34,
    nachschlag: false,
    rauschen: 700,
  },
  // Magnet: kein Schnappen, ein dumpfer Aufschlag mit Brummen
  magnet: {
    freqs: [62, 94, 141],
    guete: [14, 10, 8],
    wumms: 0.42,
    wummsVon: 72,
    wummsBis: 46,
    wummsDauer: 0.5,
    nachschlag: false,
    rauschen: 240,
  },
};

/**
 * So oft hoechstens ein Aufschlag (s) — der staerkste im Fenster gewinnt.
 *
 * Stand auf 0,14 s. Solange alles dumpf war, verschmierten die Schlaege zu
 * einem Rollen; mit dem Anriss wurde daraus eine Salve (gemessen 11.09.2026:
 * 47 Transienten je Sekunde). Ein Schrotthaufen, der in eine Mulde faellt,
 * macht drei bis vier hoerbare Schlaege je Sekunde, nicht dreissig.
 */
const AUFPRALL_FENSTER_S = 0.3;

/**
 * Obere Grenzfrequenz der Geraeusche (Hz).
 *
 * Stand vorher auf 1600. Gemessen am 11.09.2026 lagen damit 99,6 Prozent der
 * Energie eines Stahlaufschlags unter 400 Hz, der Schwerpunkt bei 115 Hz und
 * oberhalb von 2 kHz nichts — das war das "klingt wie unter Wasser". Stahl
 * auf Stahl lebt zwischen 2 und 6 kHz. Der Tiefpass steht darum jetzt weit
 * oben und nimmt nur noch das Schrille weg; das Dumpfe macht die
 * Hoehenabsenkung darunter, und die ist ein Hang, keine Mauer.
 */
const SFX_TIEFPASS_HZ = 5500;

/** Ab hier wird abgesenkt — das ist die Entfernung, nicht der Verlust. */
const SFX_FERNE_HZ = 3500;
/** Wie stark (dB) */
const SFX_FERNE_DB = -7;

export class AudioManager {
  /**
   * Die Klangwelt haengt an einem Kontext. Normalerweise legt sie ihn selbst
   * an; fuer Hoerproben laesst sich ein OfflineAudioContext hineinreichen,
   * der dieselben Klaenge in eine Datei rechnet statt auf den Lautsprecher.
   * Deshalb der breitere Typ.
   */
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private music: Music | null = null;
  /** Musikwunsch des Spielers — gilt auch, bevor der Ton überhaupt läuft */
  private musicWanted = true;
  /** Je Drehzahl-Stuetzstelle eine laufende Schleife, Block und Nageln getrennt */
  private motorStimmen: {
    stuetze: number;
    quelle: AudioBufferSourceNode;
    gain: GainNode;
    klopfQuelle: AudioBufferSourceNode;
    klopfGain: GainNode;
  }[] = [];
  /**
   * Eigener Weg fuer die Maschine.
   *
   * Der Kompressor auf dem Geraeuschweg ist fuer Schlaege gebaut: schnelles
   * Ansprechen, 120 ms Loslassen. Ein Motor zuendet im Leerlauf alle 28 ms —
   * der Kompressor kann dem nicht folgen und pumpt im Zuendtakt (gemessen
   * 11.09.2026: 14,7 Prozent Pegelschwankung). Darum laeuft die Maschine
   * daran vorbei. Das ist Schritt 5 des Tonkonzepts, vorgezogen, weil es hier
   * hoerbar war.
   */
  private maschine: GainNode | null = null;
  /** Gesamtpegel des Motors */
  private motorGain: GainNode | null = null;
  /** Pegel des Nagelns — folgt der Last */
  private klopfSumme: GainNode | null = null;
  /** Luefter und Kuehler: breitbandig, folgt der Drehzahl */
  private luefterGain: GainNode | null = null;
  private luefterFilter: BiquadFilterNode | null = null;
  /** Turbolader: steigt mit Drehzahl und Last */
  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private hydraulicGain: GainNode | null = null;
  private hydOsc: OscillatorNode | null = null;
  private scrapeGain: GainNode | null = null;
  /** Sammelweg aller Geraeusche — gefiltert, damit es dumpf bleibt */
  private sfx: GainNode | null = null;

  constructor(private vorgabe?: BaseAudioContext) {
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

  ensureStarted(): void {
    if (this.ctx) {
      // Auf dem Handy kann der Ton jederzeit wieder einschlafen (Anruf,
      // Bildschirm aus, Tabwechsel) — bei jeder Geste erneut aufwecken.
      if (this.ctx instanceof AudioContext && this.ctx.state !== "running") {
        this.ctx.resume().catch(() => {});
      }
      if (this.musicWanted) this.music?.start();
      return;
    }
    try {
      this.ctx = this.vorgabe ?? new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.62;
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
      this.sfx.gain.value = 1.35;
      const dumpf = this.ctx.createBiquadFilter();
      dumpf.type = "lowpass";
      dumpf.frequency.value = SFX_TIEFPASS_HZ;
      dumpf.Q.value = 0.6;
      // Leichte Anhebung im Bauchbereich, damit der Schlag Koerper behaelt,
      // wenn die Hoehen weg sind
      const bauch = this.ctx.createBiquadFilter();
      bauch.type = "peaking";
      bauch.frequency.value = 110;
      bauch.Q.value = 0.9;
      // War +6,5 dB. Zusammen mit dem tiefen Tiefpass ergab das eine
      // Bassbetonung, die alles zugedeckt hat (Messung 11.09.2026).
      bauch.gain.value = 1.5;
      // Entfernung statt Verlust: ein Hang nach oben, keine Mauer.
      const ferne = this.ctx.createBiquadFilter();
      ferne.type = "highshelf";
      ferne.frequency.value = SFX_FERNE_HZ;
      ferne.gain.value = SFX_FERNE_DB;
      /*
       * Kompressor als letztes Glied (Wunsch 11.09.2026: "lass richtig
       * krachen"). Er faengt die Spitzen ab und hebt alles darunter an —
       * dadurch wird ein Krach lauter, ohne zu uebersteuern, und ein
       * einzelner Schlag klingt wuchtiger statt nur spitzer. Schnelles
       * Ansprechen, damit der Anschlag durchkommt, langsames Loslassen, damit
       * das Scheppern zusammenhaengt.
       */
      const presse = this.ctx.createDynamicsCompressor();
      presse.threshold.value = -20;
      presse.knee.value = 8;
      // 7:1 mit langem Loslassen hat die Anrisse in einen Brei gezogen —
      // gerade das, was Stahl von Wasser unterscheidet. Jetzt moderater.
      presse.ratio.value = 4;
      presse.attack.value = 0.003;
      presse.release.value = 0.12;
      this.sfx.connect(bauch).connect(ferne).connect(dumpf).connect(presse).connect(this.master);

      // Hintergrundmusik, zur Laufzeit erzeugt — keine fremden Aufnahmen
      this.music = new Music(this.ctx, this.master);
      if (this.musicWanted) this.music.start();

      this.baueMaschinenweg();
      this.baueMotor();

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
      this.hydOsc.connect(hydFilter).connect(this.hydraulicGain).connect(this.maschine!);
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

      this.baueKlangwege();
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
    // Weiter weg heisst dumpfer: weniger Guete, tiefere Anteile
    const d = 1 - fern * 0.45;
    this.scheppern([86 * d, 131 * d, 198 * d, 287 * d], [50, 38, 28, 20], 0.3 * pegel, true);
  }

  /** Jemand schlaegt mit dem Vorschlaghammer: drei Schlaege, ungleich verteilt. */
  private hammer(pegel: number, fern: number): void {
    if (!this.ctx) return;
    const start = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = start + i * (0.26 + Math.random() * 0.12);
      const d = 1 - fern * 0.4;
      this.spaeter(t - start, () =>
        this.anschlag([156 * d, 241 * d, 352 * d], [45, 34, 26], 0.3 * pegel, 0.004)
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
  /**
   * Den Motor aufbauen: je Stuetzdrehzahl eine Schleife aus Zuendungen, dazu
   * Luefter und Turbolader.
   *
   * Die Schleifen laufen von Anfang bis Ende durch; im Betrieb wird nur
   * ueberblendet und die Abspielgeschwindigkeit nachgefuehrt. Das kostet
   * unabhaengig von der Drehzahl immer gleich wenig.
   */
  /** Der Weg, auf dem alles Laufende liegt: Motor, Hydraulik, Fahrwerk. */
  private baueMaschinenweg(): void {
    if (!this.ctx || !this.master) return;
    this.maschine = this.ctx.createGain();
    this.maschine.gain.value = 1;
    // Unterhalb von gut 30 Hz steht nichts Nuetzliches, es kostet nur
    // Aussteuerung — und ein Gleichanteil faellt hier auf jeden Fall weg.
    const tief = this.ctx.createBiquadFilter();
    tief.type = "highpass";
    tief.frequency.value = 32;
    const hoch = this.ctx.createBiquadFilter();
    hoch.type = "lowpass";
    hoch.frequency.value = 7000;
    hoch.Q.value = 0.5;
    this.maschine.connect(tief).connect(hoch).connect(this.master);
  }

  private baueMotor(): void {
    if (!this.ctx || !this.maschine) return;
    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.value = 0.32;
    this.motorGain.connect(this.maschine);
    this.klopfSumme = this.ctx.createGain();
    this.klopfSumme.gain.value = 0.12;
    this.klopfSumme.connect(this.motorGain);

    for (const stuetze of DREHZAHL_STUETZEN) {
      const form = { ...UMSCHLAGBAGGER, drehzahl: stuetze };
      const mach = (anteil: "block" | "klopfen") => {
        const daten = dieselSchleife(this.ctx!.sampleRate, form, anteil);
        const buf = this.ctx!.createBuffer(1, daten.length, this.ctx!.sampleRate);
        buf.copyToChannel(daten, 0);
        const q = this.ctx!.createBufferSource();
        q.buffer = buf;
        q.loop = true;
        const g = this.ctx!.createGain();
        g.gain.value = 0;
        q.connect(g);
        return { q, g };
      };
      const block = mach("block");
      const klopf = mach("klopfen");
      block.g.connect(this.motorGain);
      klopf.g.connect(this.klopfSumme);
      // Versetzt starten, damit die drei Schleifen nicht im Gleichtakt
      // laufen und sich zu einem Brummen addieren.
      const t0 = this.ctx.currentTime + 0.02;
      block.q.start(t0);
      klopf.q.start(t0);
      this.motorStimmen.push({
        stuetze,
        quelle: block.q,
        gain: block.g,
        klopfQuelle: klopf.q,
        klopfGain: klopf.g,
      });
    }
    // Ganz unten der Motor, ganz oben der Wind vom Kuehler.
    const luft = this.ctx.createBufferSource();
    luft.buffer = this.noiseBuffer();
    luft.loop = true;
    this.luefterFilter = this.ctx.createBiquadFilter();
    this.luefterFilter.type = "bandpass";
    this.luefterFilter.frequency.value = 420;
    this.luefterFilter.Q.value = 0.5;
    this.luefterGain = this.ctx.createGain();
    this.luefterGain.gain.value = 0.02;
    luft.connect(this.luefterFilter).connect(this.luefterGain).connect(this.motorGain);
    luft.start();

    // Der Turbolader pfeift erst, wenn Last anliegt — das ist der Laut, den
    // man hoert, wenn eine volle Spinne hochgeht.
    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = "sawtooth";
    this.turboOsc.frequency.value = 1800;
    const turboFilter = this.ctx.createBiquadFilter();
    turboFilter.type = "bandpass";
    turboFilter.frequency.value = 2600;
    turboFilter.Q.value = 2.2;
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.value = 0;
    this.turboOsc.connect(turboFilter).connect(this.turboGain).connect(this.motorGain);
    this.turboOsc.start();
  }

  /** Zuletzt gestellte Drehzahl (1/min) — fuers Ablesen bei Messungen. */
  get drehzahl(): number {
    return this.letzteDrehzahl;
  }
  private letzteDrehzahl = DREHZAHL_STUETZEN[0];

  updateEngine(activity: number, load: number): void {
    if (!this.ctx || !this.hydraulicGain) return;
    const t = this.ctx.currentTime;
    const drehzahl = drehzahlFuer(activity, load);
    this.letzteDrehzahl = drehzahl;
    const anteile = mischung(drehzahl);
    this.motorStimmen.forEach((st, i) => {
      // Abspielgeschwindigkeit traegt die Feinabstimmung zwischen den
      // Stuetzstellen: Die Schleife ist bei ihrer Stuetzdrehzahl gerechnet.
      const tempo = drehzahl / st.stuetze;
      st.quelle.playbackRate.setTargetAtTime(tempo, t, 0.08);
      st.klopfQuelle.playbackRate.setTargetAtTime(tempo, t, 0.08);
      st.gain.gain.setTargetAtTime(anteile[i], t, 0.1);
      st.klopfGain.gain.setTargetAtTime(anteile[i], t, 0.1);
    });
    /*
     * Lauter wird der Motor mit der Drehzahl, das Nageln mit der Last.
     *
     * Die Pegel sind gegen den alten Saegezahn gemessen (11.09.2026), damit
     * der Platz nicht ploetzlich vom Motor zugedeckt wird: im Leerlauf rund
     * 0,05 Effektivwert, unter Volllast rund 0,13 — und dazwischen ein
     * hoerbarer Unterschied. Der neue Motor hatte zunaechst im Leerlauf den
     * doppelten Pegel und kaum noch Spanne nach oben.
     */
    const gas = (drehzahl - DREHZAHL_STUETZEN[0]) / 1000;
    this.motorGain?.gain.setTargetAtTime(0.24 + 0.5 * gas, t, 0.15);
    this.klopfSumme?.gain.setTargetAtTime(0.07 + 0.16 * load + 0.06 * gas, t, 0.2);
    this.luefterGain?.gain.setTargetAtTime(0.015 + 0.03 * gas, t, 0.2);
    this.luefterFilter?.frequency.setTargetAtTime(380 + 260 * gas, t, 0.2);
    // Der Lader dreht deutlich schneller als der Motor.
    this.turboOsc?.frequency.setTargetAtTime(1500 + 1500 * gas, t, 0.25);
    this.turboGain?.gain.setTargetAtTime(0.006 * load * (0.3 + gas), t, 0.3);
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
  playClawSnap(haerte = 1, typ: GreiferKlang = "schrott"): void {
    const h = Math.max(0.15, Math.min(haerte, 1));
    const k = GREIFER_KLANG[typ] ?? GREIFER_KLANG.schrott;
    /*
     * Zwei Schalen aus Stahl schlagen aufeinander: ein harter, kurzer Krach
     * mit Nachklappern, kein Ton. Wie tief und wie lang, haengt vom Greifer
     * ab — ein kleiner Polyp klingt anders als ein grosser Schrottgreifer.
     */
    this.wumms(k.wumms * h, k.wummsVon, k.wummsBis, k.wummsDauer);
    this.anschlag(k.freqs, k.guete, 0.5 * h, 0.004);
    if (k.nachschlag) {
      this.anschlag(
        k.freqs.slice(0, 3).map((f) => f * 1.06),
        k.guete,
        0.2 * h,
        0.007,
        0.045 + Math.random() * 0.03
      );
    }
    if (k.rauschen) this.noiseBurst(k.rauschen, 0.1, 0.12 * h);
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
    // Frueher wurde erst ab 4 m/s voll aufgedreht — damit blieb fast alles im
    // Halbschatten. Jetzt ist bei 2,6 m/s Anschlag, und darunter faellt es
    // sanft ab.
    const w = Math.min(Math.max(wucht / 2.6, 0.16), 1);
    const weich =
      materialId === "wood" ||
      materialId === "plastic" ||
      materialId === "tires" ||
      materialId === "rubble" ||
      materialId === "cable";

    if (weich) {
      // Holz, Gummi, Kunststoff: ein Plumps, kein Klang. Wenige, stark
      // gedaempfte Resonanzen, viel Rauschen — und ein kurzer tiefer Druck.
      this.anschlag([78, 121, 205], [7, 5, 4], 0.5 * w, 0.02);
      this.wumms(0.34 * w, 84, 46, 0.16);
      this.noiseBurst(260, 0.12, 0.16 * w);
      return;
    }

    if (aufStahl) {
      /*
       * Ladeflaeche und Bordwaende: grosse, duenne Bleche. Sie haben tiefe,
       * dicht beieinander liegende Eigenfrequenzen und klingen lange nach —
       * daher hohe Guete und viele Anschlaege hintereinander.
       */
      // Die oberen drei Eigenfrequenzen kamen dazu (Messung 11.09.2026):
      // Ohne sie endete der Blechschlag bei 651 Hz und klang wie ein Sack
      // Sand. Ein Blech klirrt nun mal mit.
      this.scheppern(
        [94, 147, 223, 331, 468, 651, 920, 1310, 1760],
        [90, 70, 55, 45, 35, 28, 22, 16, 12],
        1.4 * w,
        true
      );
      // Blechdonner: die ganze Flaeche schwingt breitbandig mit — breitbandig
      // heisst breitbandig, nicht bis 300 Hz.
      this.noiseBurst(1500, 0.32 + 0.3 * w, 0.38 * w, "bandpass", 0.7);
      // Die Flaeche wummert: tiefer Schlag, der ueber eine halbe Sekunde ausklingt
      this.wumms(0.3 * w, 104, 42, 0.38 + 0.34 * w);
      this.wumms(0.24 * w, 72, 36, 0.55 + 0.3 * w, 0.03);
      return;
    }
    // Beton: kurz, trocken, wenig Nachklang
    this.scheppern([128, 196, 289, 402, 640, 980], [30, 24, 18, 14, 11, 8], 1.05 * w, false);
    // Beton schluckt: kurzer, harter Wumms ohne langen Bauch
    this.wumms(0.32 * w, 116, 50, 0.22);
    this.noiseBurst(1100, 0.08, 0.18 * w, "bandpass", 0.8);
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
  /**
   * Abwurfklang je Material (Kap. 15), jetzt ueber Resonanzen statt addierter
   * Toene: Metall klingt nicht harmonisch wie ein Instrument, sondern
   * rauschhaft mit einigen stehenden Eigenfrequenzen — und es scheppert nach.
   */
  /**
   * Sperre gegen Salven.
   *
   * Beim Abkippen faellt eine ganze Spinnenladung auf einmal in die Mulde,
   * und jedes Teil meldet sich einzeln. Zehn Teile ergaben zehn Fallklaenge
   * und zehn Quittungstoene im selben Moment — genau das Maschinengewehr
   * (Befund 11.09.2026). Wer in echt eine Fuhre abkippt, hoert ein Poltern,
   * keine Salve. Darum darf jede Klangart nur alle paar Hundertstel einmal
   * ansprechen; was dazwischen kommt, faellt weg.
   */
  private zuletzt = new Map<string, number>();

  private darfSpielen(art: string, abstandS: number): boolean {
    if (!this.ctx) return false;
    const jetzt = this.ctx.currentTime;
    const vorher = this.zuletzt.get(art) ?? -Infinity;
    if (jetzt - vorher < abstandS) return false;
    this.zuletzt.set(art, jetzt);
    return true;
  }

  playDrop(materialId: string): void {
    if (!this.darfSpielen("drop", 0.11)) return;
    switch (materialId) {
      case "steel":
      case "mixed":
        // schwerer Stahl: tief, lang, mit Nachklappern
        this.scheppern([104, 158, 236, 347, 498], [80, 62, 48, 38, 30], 0.5, true);
        this.wumms(0.45, 92, 42, 0.42);
        break;
      case "va":
        // Edelstahl: heller und praeziser, kuerzeres Scheppern
        this.scheppern([186, 281, 412, 588], [70, 55, 42, 32], 0.42, false);
        break;
      case "alu":
        // Alu: leicht, klirrt kurz
        this.scheppern([243, 366, 537, 761], [45, 36, 28, 22], 0.34, false);
        break;
      case "copper":
        // Kupfer: dumpfer als Stahl, kaum Nachklang
        this.scheppern([152, 226, 332], [26, 20, 15], 0.34, false);
        break;
      case "cable":
        // Kabelbund: klatscht, klingt nicht
        this.anschlag([88, 132], [6, 5], 0.42, 0.03);
        this.noiseBurst(320, 0.14, 0.18);
        break;
      default:
        // Holz, Reifen, Baumisch, Kunststoff: Plumps ohne Klang
        this.anschlag([72, 108, 176], [7, 5, 4], 0.44, 0.025);
        this.noiseBurst(240, 0.16, 0.2);
    }
  }

  /*
   * --- Schrottklang: Rauschen durch Resonanzen statt addierter Toene ---
   *
   * Befund 11.09.2026: "Das klingt alles noch sehr kindlich." Zu Recht. Bis
   * hierher wurde jeder Schlag aus einer Handvoll Sinus- und Dreieckstoenen
   * addiert. Solche Toene sind sauber und periodisch — das Ohr hoert ein
   * Xylophon, kein Blech. Echter Schrott klingt anders:
   *
   *   RAUSCHHAFT   Der Klang entsteht, weil Material breitbandig angeregt wird
   *                und nur einige Eigenfrequenzen stehen bleiben. Also kurzes
   *                Rauschen durch schmale Bandpaesse mit hoher Guete, statt
   *                Oszillatoren.
   *   SCHMUTZIG    Ein Waveshaper saettigt leicht und setzt Obertoene dazu —
   *                das ist der Unterschied zwischen "Ton" und "Krach".
   *   UNREGELMAESSIG  Ein Aufschlag ist nie EIN Schlag: Das Stueck springt,
   *                kippt, rutscht. Eine Kaskade mit fallender Lautstaerke und
   *                zufaelligem Abstand — das ist das Scheppern.
   *   MIT RAUM     Ein kurzer, dichter Nachhall aus prozeduralem Rauschen
   *                setzt alles auf denselben Platz.
   */

  /** Gemeinsamer Platzhall — kurz und dicht, damit nichts nach Studio klingt. */
  private hall: ConvolverNode | null = null;
  private hallSend: GainNode | null = null;
  /** Leichte Saettigung fuer alle Schlaege */
  private dreck: WaveShaperNode | null = null;

  private baueKlangwege(): void {
    if (!this.ctx || !this.sfx) return;
    this.dreck = this.ctx.createWaveShaper();
    const n = 1024;
    const kurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      kurve[i] = Math.tanh(x * 4.2);
    }
    this.dreck.curve = kurve;
    this.dreck.oversample = "2x";
    this.dreck.connect(this.sfx);

    this.hall = this.ctx.createConvolver();
    const dauer = 0.4;
    const len = Math.floor(this.ctx.sampleRate * dauer);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2);
      }
      // ein paar harte frueh Reflexionen — Wand, Mulde, Container
      for (const ms of [11, 19, 31, 47]) {
        const idx = Math.floor((ms / 1000) * this.ctx.sampleRate);
        if (idx < len) d[idx] += (Math.random() * 2 - 1) * 0.6;
      }
    }
    this.hall.buffer = buf;
    this.hallSend = this.ctx.createGain();
    this.hallSend.gain.value = 0.15;
    this.hallSend.connect(this.hall).connect(this.sfx);
  }

  /**
   * Ein Anschlag: kurzes Rauschen durch mehrere Resonanzen.
   *
   * @param freqs Eigenfrequenzen (bewusst unharmonisch)
   * @param guete Guete je Resonanz — hoch heisst langes Nachklingen
   * @param gain Lautstaerke
   * @param anregung Dauer der Anregung (kurz = harter Schlag)
   * @param wann Versatz in Sekunden
   */
  /**
   * Der Anriss vor dem Klang.
   *
   * Gemessen am 11.09.2026: Im ganzen Krach lag oberhalb von 2 kHz nichts,
   * der Schwerpunkt bei 115 Hz. So klingt kein Stahl. Was fehlte, sind die
   * ersten Millisekunden, in denen zwei Bleche aufeinanderschlagen — ein
   * sehr kurzes, helles Rauschen zwischen 2 und 7 kHz. Man hoert es nicht
   * als Ton, sondern als Haerte; ohne das bleibt jeder Schlag ein Plumps.
   */
  private knall(gain: number, wann = 0, mitteHz = 3800): void {
    if (!this.ctx || !this.dreck) return;
    const t = this.ctx.currentTime + wann;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.playbackRate.value = 0.9 + Math.random() * 0.4;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = mitteHz * 0.5;
    const spitz = this.ctx.createBiquadFilter();
    spitz.type = "peaking";
    spitz.frequency.value = mitteHz * (0.85 + Math.random() * 0.3);
    spitz.Q.value = 1.1;
    spitz.gain.value = 7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
    src.connect(hp).connect(spitz).connect(g);
    // Direkt UND durch den Dreck: der direkte Weg haelt den Anriss spitz, die
    // Saettigung gibt ihm Schmutz. Nur ueber die Saettigung wird er rund.
    if (this.sfx) g.connect(this.sfx);
    g.connect(this.dreck);
    if (this.hallSend) g.connect(this.hallSend);
    src.start(t);
    src.stop(t + 0.06);
  }

  private anschlag(
    freqs: number[],
    guete: number[],
    gain: number,
    anregung: number,
    wann = 0,
    knallAnteil = 0.5
  ): void {
    if (!this.ctx || !this.sfx || !this.dreck) return;
    const t = this.ctx.currentTime + wann;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const anreg = this.ctx.createGain();
    anreg.gain.setValueAtTime(gain, t);
    anreg.gain.exponentialRampToValueAtTime(0.0001, t + anregung);
    src.connect(anreg);

    freqs.forEach((f, i) => {
      const bp = this.ctx!.createBiquadFilter();
      bp.type = "bandpass";
      // leicht verstimmt — kein Schlag klingt wie der vorige
      bp.frequency.value = f * (0.93 + Math.random() * 0.14);
      bp.Q.value = guete[i] ?? 40;
      const g = this.ctx!.createGain();
      /*
       * Lautstaerke je Teilton. Zwei Anteile:
       *
       * - Die hoeheren Teiltoene sind leiser als die tiefen (1/(1+i·0,25)).
       * - Dazu eine breite Betonung um 1150 Hz. Genau dort sitzt bei echten
       *   Aufnahmen (Uploads 11.09.2026) das Gewicht eines Metallschlags;
       *   ohne diese Betonung war der Klang Bass plus ein heller Tick und
       *   dazwischen nichts.
       */
      const bell = 0.4 + 0.6 / (1 + Math.pow(Math.log2(bp.frequency.value / 1150), 2) * 0.7);
      g.gain.value = (1 / (1 + i * 0.25)) * bell;
      anreg.connect(bp).connect(g);
      g.connect(this.dreck!);
      if (this.hallSend) g.connect(this.hallSend);
    });
    src.start(t);
    src.stop(t + anregung + 1.2);

    // Die Haerte oben drauf. Wie hell, richtet sich nach dem Material: Ein
    // duenner Blechschnipsel klirrt, ein Motorblock schlaegt nur.
    if (knallAnteil > 0) {
      const oben = freqs[freqs.length - 1] ?? 700;
      this.knall(gain * knallAnteil, wann, 700 + oben * 0.6);
    }
  }

  /**
   * Wumms: der tiefe Schlag unter dem Krach (Wunsch 11.09.2026).
   *
   * Ein schwerer Brocken auf Blech ist zuerst ein Druck, dann erst ein
   * Geraeusch. Gebaut wie eine Basstrommel: ein Ton, der in wenigen
   * Hundertstel von oben nach unten faellt, mit einem kraeftigen Anschlag
   * davor.
   *
   * Dazu ein zweiter, gesaettigter Weg: Auf einem Tablet- oder
   * Handylautsprecher ist unter etwa 200 Hz nichts mehr zu hoeren. Die
   * Saettigung erzeugt Obertoene des Grundtons, und das Ohr setzt daraus den
   * fehlenden Grundton wieder zusammen — so bleibt der Wumms auch dort
   * spuerbar, wo der Lautsprecher ihn gar nicht abstrahlen kann.
   */
  private wumms(gain: number, vonHz: number, bisHz: number, dauer: number, wann = 0): void {
    if (!this.ctx || !this.sfx) return;
    const t = this.ctx.currentTime + wann;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(vonHz, t);
    osc.frequency.exponentialRampToValueAtTime(bisHz, t + Math.min(0.14, dauer * 0.5));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    osc.connect(g).connect(this.sfx);
    osc.start(t);
    osc.stop(t + dauer + 0.05);

    // Obertonweg fuer kleine Lautsprecher
    if (this.dreck) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(vonHz * 2, t);
      osc2.frequency.exponentialRampToValueAtTime(bisHz * 2, t + Math.min(0.14, dauer * 0.5));
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(gain * 0.45, t + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dauer * 0.7);
      osc2.connect(g2).connect(this.dreck);
      osc2.start(t);
      osc2.stop(t + dauer + 0.05);
    }
  }

  /**
   * Scheppern: eine Kaskade von Anschlaegen. Das Stueck springt, kippt und
   * rutscht aus — genau das unterscheidet Krach von einem einzelnen "Pling".
   */
  private scheppern(freqs: number[], guete: number[], wucht: number, stahl: boolean): void {
    // War 4 bis 9 bzw. 3 bis 5 — zusammen mit dem Fenster von 0,14 s ergab
    // das eine Dauersalve statt einzelner Schlaege.
    const schlaege = stahl ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2);
    let wann = 0;
    for (let i = 0; i < schlaege; i++) {
      const staerke = wucht * Math.pow(0.72, i) * (0.75 + Math.random() * 0.6);
      this.anschlag(
        freqs.map((f) => f * (0.9 + Math.random() * 0.25)),
        guete,
        staerke,
        i === 0 ? 0.004 : 0.006 + Math.random() * 0.01,
        wann,
        /*
         * Nur der erste Kontakt reisst hart an. Gemessen am 11.09.2026:
         * Mit einem Anriss je Huepfer kamen bei voller Ladung 47 scharfe
         * Transienten je Sekunde zusammen — das war das Maschinengewehr.
         * Was danach kommt, ist Klappern, kein Schlag.
         */
        i === 0 ? (stahl ? 0.85 : 0.7) : 0.12
      );
      wann += 0.035 + Math.random() * (stahl ? 0.13 : 0.07);
    }
    // Auslaufen: kurzes Rutschen und Wackeln am Ende
    if (wucht > 0.25) {
      this.noiseBurst(stahl ? 900 : 380, 0.12 + Math.random() * 0.12, 0.05 * wucht);
    }
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
    // Eine Fuhre ist ein Treffer, nicht zwanzig — sonst klingelt es im Kreis.
    if (!this.darfSpielen("correct", 0.6)) return;
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

  private noiseBurst(cutoff: number, dur: number, gain: number, typ: BiquadFilterType = "lowpass", guete = 1): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = typ;
    filter.frequency.value = cutoff;
    filter.Q.value = guete;
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
