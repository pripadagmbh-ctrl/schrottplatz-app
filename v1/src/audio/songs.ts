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

// ---------------------------------------------------------------------------
// Hilfen fuer wiederkehrende Muster
// ---------------------------------------------------------------------------
/**
 * Achtel-Arpeggio ueber die Akkorde der Schleife.
 *
 * Gebrochene Akkorde brauchen die EINZELNEN Toene, nicht den Klang als
 * Ganzes — `akkord: true` wuerde alle drei gleichzeitig anschlagen. Und
 * `anStufe` hilft hier nicht: Es haengt den Ton an den Grundton des Akkords
 * und kennt sein Geschlecht nicht; eine feste Terz von +4 waere ueber einem
 * Mollakkord der falsche Ton. Deshalb werden die Stufen aus dem Akkord selbst
 * geholt, Takt fuer Takt.
 *
 * Die Folge geht hoch und zurueck (Grundton, Terz, Quinte, Terz); die zweite
 * Takthaelfte liegt eine Oktave hoeher — das ist die Figur, an der man ein
 * Popstueck in zwei Sekunden erkennt.
 */
function arpeggioAchtel(akkorde: number[][], laenge: number): Ton[][] {
  const folge = [0, 1, 2, 1]; // hoch und zurueck, ueber die Akkordtoene
  return akkorde.map((a) =>
    [...folge, ...folge].map((stufe, i) => ({
      halbton: a[stufe]! + (i >= 4 ? 12 : 0),
      schlag: i * 0.5,
      laenge,
      // SW: leichte Betonung auf den Zaehlzeiten, sonst klappert die Figur
      kraft: i % 2 === 0 ? 1 : 0.78,
    }))
  );
}

/** Gleichmaessige Unterteilung: `anzahl` Toene je Takt, alle gleich lang. */
function raster(anzahl: number, schlaegeProTakt: number, laenge: number): Ton[] {
  const schritt = schlaegeProTakt / anzahl;
  return Array.from({ length: anzahl }, (_, i) => ({
    halbton: 0,
    schlag: i * schritt,
    laenge,
  }));
}

// ---------------------------------------------------------------------------
// Sender 3 — Nachtschicht (Techno)
// ---------------------------------------------------------------------------
/*
 * WORAN MAN IHN ERKENNT: die Bassdrum auf JEDER Zaehlzeit. Kein anderer
 * Sender hat das, und es ist das eine Merkmal, das auch aus einem
 * Kabinenlautsprecher durch den Motorlaerm kommt. Darueber der Bass auf den
 * Nachschlaegen — Schlag, Bass, Schlag, Bass: der Wechselschritt, der Techno
 * ausmacht. Dazu eine Sechzehntelfigur, die sich nie aendert, und ein
 * Akkordstoss hinter dem Schlag.
 *
 * Tempo 132 (SW): zwischen den ueblichen 128 und 140 die Mitte. Schneller
 * waere es im Fuehrerhaus hektisch, langsamer klaenge es nach Rock. Tonart
 * a-Moll; die Sechzehntelfigur laesst die Terz weg und passt deshalb ueber
 * jeden Akkord der Schleife.
 */
export const TECHNO: Song = {
  id: "techno",
  sender: "Nachtschicht",
  frequenz: "102,3",
  beschreibung: "Bassdrum auf jedem Schlag, Sechzehntel, kein Gesang.",
  grundtonHz: 55, // A1 — tief genug fuer den Bass, alles andere sitzt darueber
  bpm: 132, // SW: Mitte zwischen 128 und 140
  schlaegeProTakt: 4,
  // i · i · VI · VII — vier Takte, die sich nie aufloesen
  akkorde: [
    [0, 3, 7], // Am
    [0, 3, 7], // Am
    [8, 12, 15], // F
    [10, 14, 17], // G
  ],
  shuffle: 0, // eine Maschine schleppt nicht
  pegel: 0.16,
  klang: { hochpassHz: 45, tiefpassHz: 7200 },
  spuren: [
    // DAS Merkmal: vier auf den Boden
    {
      stimme: "kick",
      pegel: 0.5,
      muster: [
        { halbton: 0, schlag: 0, laenge: 0.5 },
        { halbton: 0, schlag: 1, laenge: 0.5, kraft: 0.88 },
        { halbton: 0, schlag: 2, laenge: 0.5 },
        { halbton: 0, schlag: 3, laenge: 0.5, kraft: 0.88 },
      ],
    },
    // Bass auf den Nachschlaegen — er faellt in die Luecke zwischen zwei
    // Schlaegen, nie auf den Schlag selbst. Daher der Wechselschritt.
    {
      stimme: "bass",
      pegel: 0.3,
      anStufe: true,
      muster: [0.5, 1.5, 2.5, 3.5].map((s) => ({ halbton: 0, schlag: s, laenge: 0.42 })),
    },
    // Geschlossene Hi-Hat auf allen Achteln, leise und gleichmaessig
    {
      stimme: "hihat",
      pegel: 0.05,
      cutoff: 8200,
      abkling: 0.028,
      muster: raster(8, 4, 0.1).map((t) => ({
        ...t,
        kraft: t.schlag % 1 === 0 ? 1 : 0.6,
      })),
    },
    // Offene Hi-Hat auf den Nachschlaegen: der lange Zischer, der das Tempo
    // traegt. Gleiche Stimme, nur laengere Abklingzeit (SW: 0,19 s).
    {
      stimme: "hihat",
      pegel: 0.04,
      cutoff: 6800,
      abkling: 0.19,
      muster: [0.5, 1.5, 2.5, 3.5].map((s) => ({ halbton: 0, schlag: s, laenge: 0.2 })),
    },
    // Sechzehntelfigur: Grundton, Quinte, Oktave, Quinte — sicher ueber Dur
    // wie ueber Moll, weil die Terz fehlt.
    {
      stimme: "zupf",
      pegel: 0.045,
      form: "square",
      cutoff: 3200,
      oktave: 2,
      anStufe: true,
      muster: raster(16, 4, 0.22).map((t, i) => ({
        ...t,
        halbton: [0, 7, 12, 7][i % 4]!,
        kraft: i % 4 === 0 ? 1 : 0.7,
      })),
    },
    // Akkordstoss hinter dem Schlag — kurz, hart, immer an derselben Stelle
    {
      stimme: "zupf",
      pegel: 0.075,
      form: "sawtooth",
      cutoff: 2600,
      oktave: 1,
      muster: [0.75, 2.75].map((s) => ({
        halbton: 0,
        schlag: s,
        laenge: 0.3,
        akkord: true,
      })),
    },
    // Klatscher auf zwei und vier, damit der Takt eine Richtung hat
    {
      stimme: "snare",
      pegel: 0.15,
      muster: [
        { halbton: 0, schlag: 1, laenge: 0.3 },
        { halbton: 0, schlag: 3, laenge: 0.3 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Sender 4 — Werkhof (Rap-Beat)
// ---------------------------------------------------------------------------
/*
 * WORAN MAN IHN ERKENNT: am Tempo. 88 Schlaege sind zwei Drittel des
 * Technotempos und deutlich langsamer als alles andere im Kranz — man hoert
 * beim ersten Takt, dass hier nichts eilt. Dazu die Snare hart auf zwei und
 * vier, eine Bassdrum, die dazwischen stolpert, und ein dumpfer Klang, als
 * kaeme das Stueck von einer alten Platte (Tiefpass 3000 Hz).
 *
 * WAS ER NICHT HAT: eine Stimme. Ein Rap ohne Rapper ist ein Beat — das ist
 * ehrlich so gebaut und nicht vergessen worden. Eine erzeugte Sprechstimme
 * waere ein eigenes Paket und eine Geschmacksfrage, die Patrick entscheidet.
 *
 * Tonart d-Moll. Die Figur darueber laeuft durch einen Tiefpass von 900 Hz —
 * so klingt ein Ausschnitt, der schon einmal durch ein Band gelaufen ist.
 */
export const RAP: Song = {
  id: "rap",
  sender: "Werkhof",
  frequenz: "90,4",
  beschreibung: "Langsamer Beat, harte Snare, dumpf wie von Platte.",
  grundtonHz: 73.42, // D2
  bpm: 88, // SW: Boom-Bap-Mass, langsamster Sender im Kranz
  schlaegeProTakt: 4,
  // i · VII · VI · iv
  akkorde: [
    [0, 3, 7], // Dm
    [10, 14, 17], // C
    [8, 12, 15], // B-Dur
    [5, 8, 12], // Gm
  ],
  shuffle: 0.05, // SW: knapper Nachzug auf den Achteln — das Schleppen
  pegel: 0.16,
  klang: { hochpassHz: 60, mitten: { hz: 420, q: 0.8, db: 4 }, tiefpassHz: 3000 },
  spuren: [
    /*
     * Die Bassdrum stolpert: einmal auf die Eins, einmal kurz dahinter, einmal
     * vor der Vier. Sie steht ausgeschrieben und bekommt deshalb KEINEN
     * Shuffle — sonst rutschte die Drei-und noch einmal nach hinten.
     */
    {
      stimme: "kick",
      pegel: 0.55,
      shuffle: false,
      muster: [
        { halbton: 0, schlag: 0, laenge: 0.5 },
        { halbton: 0, schlag: 0.75, laenge: 0.5, kraft: 0.6 },
        { halbton: 0, schlag: 2.5, laenge: 0.5, kraft: 0.9 },
      ],
    },
    // Snare hart auf zwei und vier, ohne Shuffle — sie ist das Metronom
    {
      stimme: "snare",
      pegel: 0.24,
      shuffle: false,
      muster: [
        { halbton: 0, schlag: 1, laenge: 0.4 },
        { halbton: 0, schlag: 3, laenge: 0.4 },
      ],
    },
    // Hi-Hat auf den Achteln; die Nachschlaege bekommen den Shuffle und
    // erzeugen damit das Schleppen
    {
      stimme: "hihat",
      pegel: 0.045,
      cutoff: 7000,
      abkling: 0.032,
      muster: raster(8, 4, 0.1).map((t) => ({
        ...t,
        kraft: t.schlag % 1 === 0 ? 1 : 0.55,
      })),
    },
    // Bass: zwei lange Toene je Takt und ein kurzer Nachschlag eine Oktave
    // hoeher — mehr braucht ein Beat nicht
    {
      stimme: "bass",
      pegel: 0.32,
      anStufe: true,
      laengeFaktor: 1.15,
      muster: [
        { halbton: 0, schlag: 0, laenge: 1.4 },
        { halbton: 0, schlag: 2.5, laenge: 0.9 },
        { halbton: 12, schlag: 3.5, laenge: 0.4, kraft: 0.5 },
      ],
    },
    // Akkordflaeche, vom Tiefpass des Stuecks stumpf gemacht
    {
      stimme: "orgel",
      pegel: 0.045,
      muster: [{ halbton: 0, schlag: 0, laenge: 2.2, akkord: true }],
    },
    // Die Figur darueber, dumpf (Tiefpass 900 Hz) — vier Takte, immer gleich
    {
      stimme: "zupf",
      pegel: 0.17,
      form: "triangle",
      cutoff: 900,
      oktave: 1,
      musterProTakt: [
        [
          { halbton: 0, schlag: 0, laenge: 1.2 },
          { halbton: 3, schlag: 1.5, laenge: 0.5 },
          { halbton: 5, schlag: 2, laenge: 1.0 },
        ],
        [
          { halbton: 3, schlag: 0, laenge: 1.0 },
          { halbton: 0, schlag: 1.5, laenge: 0.5 },
          { halbton: -2, schlag: 2.5, laenge: 1.2 },
        ],
        [
          { halbton: 8, schlag: 0, laenge: 1.2 },
          { halbton: 7, schlag: 1.5, laenge: 0.5 },
          { halbton: 5, schlag: 2.5, laenge: 1.0 },
        ],
        [
          { halbton: 3, schlag: 0, laenge: 1.0 },
          { halbton: 5, schlag: 1.5, laenge: 0.5 },
          { halbton: 7, schlag: 2.5, laenge: 1.2 },
        ],
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Sender 5 — Niederrhein Eins (Pop)
// ---------------------------------------------------------------------------
/*
 * WORAN MAN IHN ERKENNT: an der gebrochenen Akkordfigur in Achteln, die
 * durchlaeuft, und daran, dass er BREIT klingt. Der Schlager laeuft durch ein
 * Nadeloehr bei 1100 Hz und klingt deshalb nach Kofferradio; dieser Sender
 * hat oben 9000 Hz und eine Anhebung bei 2600 — er klingt nach Autoradio von
 * heute. Das ist der Unterschied, den man auch ohne Musikgehoer hoert.
 *
 * Dazu die vier Akkorde, die in der Popmusik seit vierzig Jahren dieselben
 * sind (I–V–vi–IV), ein Backbeat auf zwei und vier und eine Melodie, die man
 * mitsummen kann. Tempo 116 (SW): Gehtempo, kein Tanztempo.
 */
export const POP: Song = {
  id: "pop",
  sender: "Niederrhein Eins",
  frequenz: "106,9",
  beschreibung: "Vier Akkorde, gebrochene Figur, helle Aufnahme.",
  grundtonHz: 98, // G2 — der Bass hat darunter noch Luft
  bpm: 116, // SW: Gehtempo, zwischen Rap (88) und Schlager (130)
  schlaegeProTakt: 4,
  // I · V · vi · IV in G-Dur
  akkorde: [
    [0, 4, 7], // G
    [7, 11, 14], // D
    [9, 12, 16], // Em
    [5, 9, 12], // C
  ],
  shuffle: 0,
  pegel: 0.16,
  klang: { hochpassHz: 80, mitten: { hz: 2600, q: 0.7, db: 3 }, tiefpassHz: 9000 },
  spuren: [
    {
      stimme: "kick",
      pegel: 0.42,
      muster: [
        { halbton: 0, schlag: 0, laenge: 0.5 },
        { halbton: 0, schlag: 2, laenge: 0.5 },
        { halbton: 0, schlag: 3.5, laenge: 0.5, kraft: 0.7 },
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
    {
      stimme: "hihat",
      pegel: 0.05,
      cutoff: 7800,
      abkling: 0.03,
      muster: raster(8, 4, 0.1).map((t) => ({
        ...t,
        kraft: t.schlag % 1 === 0 ? 1 : 0.6,
      })),
    },
    // DIE Figur: gebrochener Akkord in Achteln, zweite Takthaelfte eine
    // Oktave hoeher. Die Stufen kommen aus derselben Akkordreihe wie oben —
    // eine zweite Liste waere die Stelle, an der spaeter etwas auseinanderlaeuft.
    {
      stimme: "zupf",
      pegel: 0.085,
      form: "triangle",
      cutoff: 3400,
      oktave: 1,
      musterProTakt: arpeggioAchtel(
        [
          [0, 4, 7],
          [7, 11, 14],
          [9, 12, 16],
          [5, 9, 12],
        ],
        0.45
      ),
    },
    // Teppich darunter
    {
      stimme: "flaeche",
      pegel: 0.07,
      muster: [{ halbton: 0, schlag: 0, laenge: 3.7, akkord: true }],
    },
    // Bass: Grundton auf eins und drei, lang gehalten
    {
      stimme: "bass",
      pegel: 0.26,
      oktave: -1,
      anStufe: true,
      muster: [
        { halbton: 0, schlag: 0, laenge: 1.8 },
        { halbton: 0, schlag: 2, laenge: 1.8 },
      ],
    },
    // Melodie zum Mitsummen, minimal hinter dem Schlag (SW: 0,04 Schlaege)
    {
      stimme: "zupf",
      pegel: 0.13,
      form: "sawtooth",
      cutoff: 3000,
      oktave: 1,
      versatz: 0.04,
      musterProTakt: [
        [
          { halbton: 7, schlag: 0, laenge: 1.0 },
          { halbton: 11, schlag: 1, laenge: 1.0 },
          { halbton: 12, schlag: 2, laenge: 1.6 },
        ],
        [
          { halbton: 14, schlag: 0, laenge: 1.0 },
          { halbton: 11, schlag: 1.5, laenge: 1.0 },
          { halbton: 7, schlag: 2.5, laenge: 1.4 },
        ],
        [
          { halbton: 9, schlag: 0, laenge: 1.0 },
          { halbton: 12, schlag: 1, laenge: 1.0 },
          { halbton: 16, schlag: 2, laenge: 1.6 },
        ],
        [
          { halbton: 14, schlag: 0, laenge: 1.4 },
          { halbton: 12, schlag: 1.5, laenge: 0.8 },
          { halbton: 7, schlag: 2.5, laenge: 1.4 },
        ],
      ],
    },
  ],
};

/**
 * Alle Sender, in der Reihenfolge des Menues — und damit auch in der
 * Reihenfolge, in der die Taste MUSIK weiterschaltet (E-094, umgestellt in
 * E-105).
 *
 * DER ERSTE IST DER STANDARD, und daran haengt mehr als die Optik: Beim
 * Ausschalten springt die Wahl auf `SENDER[0]` zurueck (`naechsterSender`),
 * und der Knebelschalter laeuft von dort wieder los. Stuende der Standard
 * mitten in der Reihe oder am Ende, waere die Stellung „aus" eine Sackgasse —
 * ein Tipp schaltete den Standard ein, der naechste sofort wieder aus.
 *
 * Deshalb ist Werkhof am 17.09.2026 nach VORN gerueckt und nicht nur zum
 * Standard erklaert worden (Ansage Patrick: „werkshof radio"). Von dort geht
 * es ueber Schlager, Pop und Bluesrock ins Schnelle — vom langsamsten zum
 * schnellsten Sender, und dann aus.
 */
export const SENDER: Song[] = [RAP, SCHLAGER, POP, BLUESROCK, TECHNO];

/** Standardsender — Werkhof 90,4 (Ansage Patrick, 17.09.2026). */
export const STANDARD_SENDER = RAP.id;

/** Sender zu einer Kennung; unbekannte Kennung faellt auf den Standard zurueck. */
export function findeSender(id: string | undefined | null): Song {
  return SENDER.find((s) => s.id === id) ?? RAP;
}
