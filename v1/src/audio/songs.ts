/**
 * Das Kabinenradio als Daten (Briefing Kap. 15).
 *
 * Alles, was ein Stueck ausmacht, steht hier als Zahlenreihe: Grundton, Tempo,
 * Akkorde, Spuren, Klangfarbe. Der Klangapparat in `music.ts` kennt kein
 * einziges Stueck — er liest nur diese Daten. Ein weiterer Sender ist damit ein
 * weiterer Eintrag in `SENDER`, keine Zeile Programmcode.
 *
 * Warum erzeugt statt abgespielt: Fremde Aufnahmen und Senderstreams sind
 * lizenz- und GEMA-pflichtig und wuerden die Veroeffentlichung blockieren
 * (Beschluss 12.09.2026). Erzeugte Stuecke kosten weder Speicherplatz in der
 * App noch Lizenzbuchhaltung.
 */

/** Die Stimmen des gemeinsamen Klangapparats. */
export type Stimme =
  /** kurzer gezupfter Ton — Umtata-Bass, Akkordschlag, Melodie */
  | "zupf"
  /** getragene Flaeche mit langsamem An- und Abschwellen (Streicher) */
  | "flaeche"
  /** verzerrte Gitarre ueber eine Zerrkurve */
  | "fuzz"
  /** Bass: Dreieck mit etwas Biss */
  | "bass"
  /** Zugriegelorgel: Grundton, Oktave, Quinte */
  | "orgel"
  /** Bassdrum mit fallender Tonhoehe */
  | "kick"
  /** Snare: Rauschen plus Koerper */
  | "snare"
  /** gefiltertes Rauschen, kurz — Hi-Hat oder Tick */
  | "hihat"
  /** schmalbandiges Rauschen, hoch — Tamburin */
  | "tamburin";

/** Ein Ton im Takt. */
export interface Ton {
  /**
   * Halbtoene ueber dem Bezugston. Bezug ist der Grundton des Stuecks, bei
   * `anStufe` der Grundton des Takt-Akkords, bei `akkord` jeder Akkordton.
   */
  halbton: number;
  /** Schlag im Takt, 0-basiert; Nachkomma = Unterteilung (0,5 = Achtel) */
  schlag: number;
  /**
   * Laenge in Schlaegen. Die Schlagzeugstimmen ueberhoeren sie: Ein Schlag ist
   * so lang, wie er ausklingt (`abkling` an der Spur), nicht wie er notiert
   * ist. Genauso ueberhoert die Bassdrum den Halbton — sie hat ihre eigene
   * fallende Tonhoehe.
   */
  laenge: number;
  /** Anschlag 0..1, wirkt auf den Pegel der Spur. Fehlt = 1 */
  kraft?: number;
  /** true = der ganze Akkord des Takts, um `halbton` versetzt */
  akkord?: boolean;
}

/** Eine Spur: eine Stimme, ein Muster, ein Pegel. */
export interface Spur {
  stimme: Stimme;
  /** Spitzenpegel dieser Spur (vor `kraft`) */
  pegel: number;
  /** Oktavversatz, +1 = eine Oktave hoeher */
  oktave?: number;
  /** Toene an den Grundton des Takt-Akkords haengen (Riff) statt absolut */
  anStufe?: boolean;
  /** Nur in diesen Takten der Schleife spielen. Fehlt = in allen */
  takte?: number[];
  /** Shuffle auf die Achtel dieser Spur anwenden. Fehlt = ja, wenn das Stueck shuffelt */
  shuffle?: boolean;
  /** Fester Versatz in Schlaegen — ruecke die Spur minimal hinter den Schlag */
  versatz?: number;
  /** Tondauer strecken; der Bass laeuft dem Riff gern etwas nach */
  laengeFaktor?: number;
  /** Nur `zupf`: Wellenform */
  form?: OscillatorType;
  /** `zupf`: Tiefpass · `hihat`/`tamburin`: Trennfrequenz */
  cutoff?: number;
  /** Rausch-Stimmen: Abklingzeit in Sekunden */
  abkling?: number;
  /** Gleiches Muster in jedem Takt */
  muster?: Ton[];
  /** Eigenes Muster je Takt der Schleife (Vorrang vor `muster`) */
  musterProTakt?: Ton[][];
}

/**
 * Die Klangfarbe des Kabinenlautsprechers. Reihenfolge der Kette ist fest:
 * Bandpass → Hochpass → Mitten → Tiefpass; was fehlt, wird uebersprungen.
 */
export interface Klangfarbe {
  bandpass?: { hz: number; q: number };
  hochpassHz?: number;
  mitten?: { hz: number; q: number; db: number };
  tiefpassHz?: number;
}

/** Ein Stueck — vollstaendig als Datensatz. */
export interface Song {
  /** Schluessel im Spielstand. Nie umbenennen, sonst faellt die Wahl zurueck */
  id: string;
  /** Sendername im Menue */
  sender: string;
  /** Erfundene Frequenz, nur Zierde — macht aus einer Liste ein Radio */
  frequenz: string;
  /** Eine Zeile, was einen erwartet (Menue, ohne Farbe als einziger Kanal) */
  beschreibung: string;
  /** Grundton in Hertz */
  grundtonHz: number;
  /** Tempo in Schlaegen je Minute */
  bpm: number;
  schlaegeProTakt: number;
  /** Akkorde der Schleife, ein Eintrag je Takt, Halbtoene ueber dem Grundton */
  akkorde: number[][];
  /** Wie weit das zweite Achtel nach hinten rutscht (Anteil am Schlag); 0 = gerade */
  shuffle: number;
  spuren: Spur[];
  klang: Klangfarbe;
  /** Grundpegel des Stuecks. SW seit M1: 0,16 */
  pegel: number;
}

// ---------------------------------------------------------------------------
// Sender 1 — Schlagerwelle (Standard)
// ---------------------------------------------------------------------------
/*
 * Das ist die Melodie aus der Fassung vor dem 12.09.2026, Ton fuer Ton aus der
 * Geschichte geholt (`git show a6cc90f^:prototype/src/audio/music.ts`):
 * PROGRESSION und MELODY unveraendert, ROOT_HZ 131 (C3), BEAT_S 0,46 s,
 * Bandpass 1100 Hz mit Q 0,75 hinter einem Hochpass bei 220 Hz.
 *
 * Umgerechnet wurden nur die Tondauern: Sie standen frueher in Sekunden und
 * stehen jetzt in Schlaegen (0,34 s / 0,46 s = 0,739 Schlaege usw.).
 */
export const SCHLAGER: Song = {
  id: "schlager",
  sender: "Schlagerwelle",
  frequenz: "104,1",
  beschreibung: "Dur, Umtata-Bass, Melodie zum Mitsingen.",
  grundtonHz: 131, // C3 — aus der alten Fassung
  bpm: 60 / 0.46, // = 130,4 — haelt den alten BEAT_S von 0,46 s exakt
  schlaegeProTakt: 4,
  // Klassische Schlager-Kadenz in C-Dur: C → G → Am → F
  akkorde: [
    [0, 4, 7], // C
    [-5, -1, 2], // G
    [-3, 0, 4], // Am
    [-7, -3, 0], // F
  ],
  shuffle: 0, // gerade Achtel — Schlager stampft, er schleppt nicht
  pegel: 0.16,
  klang: { bandpass: { hz: 1100, q: 0.75 }, hochpassHz: 220 },
  spuren: [
    // Umtata, Teil eins: Grundton auf die Zaehlzeiten 1 und 3
    {
      stimme: "zupf",
      pegel: 0.55,
      form: "triangle",
      cutoff: 320,
      anStufe: true,
      muster: [
        { halbton: -12, schlag: 0, laenge: 0.739 },
        { halbton: -12, schlag: 2, laenge: 0.739 },
      ],
    },
    // Umtata, Teil zwei: Quinte darunter auf 2 und 4 — etwas leiser und dumpfer
    {
      stimme: "zupf",
      pegel: 0.38,
      form: "triangle",
      cutoff: 300,
      anStufe: true,
      muster: [
        { halbton: -5, schlag: 1, laenge: 0.652 },
        { halbton: -5, schlag: 3, laenge: 0.652 },
      ],
    },
    // „Tata" — kurzer Akkordschlag auf jedem Off
    {
      stimme: "zupf",
      pegel: 0.1,
      form: "square",
      cutoff: 1500,
      muster: [0.5, 1.5, 2.5, 3.5].map((s) => ({
        halbton: 12,
        schlag: s,
        laenge: 0.478,
        akkord: true,
      })),
    },
    // Streicherteppich ueber den ganzen Takt
    {
      stimme: "flaeche",
      pegel: 0.1,
      muster: [{ halbton: 0, schlag: 0, laenge: 3.8, akkord: true }],
    },
    // Melodie, ein Ton je Schlag — bei Schlager darf sie mitsingbar sein.
    // 0,043 Schlaege Versatz = die 20 ms, mit denen sie frueher hinter dem
    // Bass einsetzte, damit beide nicht auf denselben Punkt schlagen.
    {
      stimme: "zupf",
      pegel: 0.2,
      form: "sawtooth",
      cutoff: 2200,
      versatz: 0.043,
      musterProTakt: [
        [12, 12, 16, 14],
        [14, 11, 7, 11],
        [12, 16, 19, 16],
        [17, 14, 12, 12],
      ].map((takt) => takt.map((h, i) => ({ halbton: h, schlag: i, laenge: 0.913 }))),
    },
    // Sparsames Schlagzeug: Tick auf jedem Schlag, betont auf zwei und vier
    {
      stimme: "hihat",
      pegel: 0.14,
      cutoff: 6000,
      abkling: 0.04,
      muster: [
        { halbton: 0, schlag: 0, laenge: 0.1, kraft: 0.357 }, // 0,05 von 0,14
        { halbton: 0, schlag: 1, laenge: 0.1 },
        { halbton: 0, schlag: 2, laenge: 0.1, kraft: 0.357 },
        { halbton: 0, schlag: 3, laenge: 0.1 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Sender 2 — Hallenfunk (Bluesrock)
// ---------------------------------------------------------------------------
/*
 * Der Bluesrock vom 12.09.2026, unveraendert in Daten uebersetzt:
 * E-Moll-Pentatonik, Riff ueber i–bIII–IV mit angerissener Blue Note,
 * 128 Schlaege je Minute mit leichtem Shuffle, Fuzz-Gitarre ueber eine
 * Zerrkurve, Bassdrum auf 1 und 3, Snare auf 2 und 4, Tamburin auf den
 * Nachschlaegen, Orgel nur in der zweiten Haelfte.
 */
/** Das Riff, in Halbtoenen ueber dem Grundton des Takts. */
const RIFF: Ton[] = [
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

export const BLUESROCK: Song = {
  id: "bluesrock",
  sender: "Hallenfunk",
  frequenz: "98,7",
  beschreibung: "Moll, Fuzz-Gitarre, Backbeat und Tamburin.",
  grundtonHz: 82.41, // E2
  bpm: 128,
  schlaegeProTakt: 4,
  // i · i · bIII · IV, jeweils als Dreiklang — der erste Ton traegt das Riff
  akkorde: [
    [0, 3, 7],
    [0, 3, 7],
    [3, 6, 10],
    [5, 8, 12],
  ],
  shuffle: 0.06,
  pegel: 0.16,
  klang: { hochpassHz: 95, mitten: { hz: 1400, q: 0.8, db: 4 }, tiefpassHz: 5200 },
  spuren: [
    // Riff und Bass laufen im Gleichschritt: genau das macht den Stampf
    { stimme: "fuzz", pegel: 0.18, oktave: 1, anStufe: true, muster: RIFF },
    {
      stimme: "bass",
      pegel: 0.3,
      oktave: -1,
      anStufe: true,
      laengeFaktor: 1.1,
      muster: RIFF,
    },
    // Backbeat: Bassdrum auf 1 und 3, Snare auf 2 und 4
    {
      stimme: "kick",
      pegel: 0.5,
      muster: [
        { halbton: 0, schlag: 0, laenge: 0.5 },
        { halbton: 0, schlag: 2, laenge: 0.5 },
      ],
    },
    {
      stimme: "snare",
      pegel: 0.2,
      muster: [
        { halbton: 0, schlag: 1, laenge: 0.4 },
        { halbton: 0, schlag: 3, laenge: 0.4 },
      ],
    },
    // Wirbel vor dem Zuruecksprung an den Anfang. Die Zeiten stehen hier
    // ausgeschrieben, deshalb bleibt der Shuffle aus.
    {
      stimme: "snare",
      pegel: 0.2,
      takte: [3],
      shuffle: false,
      muster: [
        { halbton: 0, schlag: 3.5, laenge: 0.3, kraft: 0.5 },
        { halbton: 0, schlag: 3.66, laenge: 0.3, kraft: 0.7 },
        { halbton: 0, schlag: 3.82, laenge: 0.3, kraft: 0.9 },
      ],
    },
    // Hi-Hat auf allen Achteln, das zweite geshufflet
    {
      stimme: "hihat",
      pegel: 0.05,
      cutoff: 7500,
      abkling: 0.045,
      muster: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((s) => ({
        halbton: 0,
        schlag: s,
        laenge: 0.1,
        kraft: s % 1 === 0 ? 1 : 0.64, // 0,032 von 0,05
      })),
    },
    // Tamburin auf den Nachschlaegen — der Klang dieser Filme
    {
      stimme: "tamburin",
      pegel: 0.045,
      cutoff: 9000,
      abkling: 0.11,
      muster: [0.5, 1.5, 2.5, 3.5].map((s) => ({ halbton: 0, schlag: s, laenge: 0.2 })),
    },
    // Orgel nur in der zweiten Haelfte, als Flaeche unter dem Riff. Ein Riff
    // lebt von der Luecke, und eine Dauerorgel nimmt dem Schlagzeug den Platz.
    {
      stimme: "orgel",
      pegel: 0.055,
      takte: [2, 3],
      muster: [{ halbton: 0, schlag: 0, laenge: 3.6, akkord: true }],
    },
  ],
};

/** Alle Sender, in der Reihenfolge des Menues. Der erste ist der Standard. */
export const SENDER: Song[] = [SCHLAGER, BLUESROCK];

/** Standardsender — die alte Schlagermelodie (Ansage Patrick, 14.09.2026). */
export const STANDARD_SENDER = SCHLAGER.id;

/** Sender zu einer Kennung; unbekannte Kennung faellt auf den Standard zurueck. */
export function findeSender(id: string | undefined | null): Song {
  return SENDER.find((s) => s.id === id) ?? SCHLAGER;
}
