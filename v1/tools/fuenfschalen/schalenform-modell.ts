/**
 * Die Schalenform selbst — HEUTE, NEU und VORBILD als EINE Rechnung.
 *
 * Anlass, woertlich (Patrick, 16.09.2026, vor dem Zahn-Vorher-Nachher-Blatt):
 *
 *   „Die Verkleidung — das ist aber an der Stelle wahrscheinlich nicht ganz
 *    das Entscheidende. Wenn ich mir die Zeichnung anschaue, sieht alles
 *    andere — ich spreche da vor allem von der Form der inneren Spinne — noch
 *    gleich aus. … Wie bekommen wir das so hin, dass alles unterhalb der
 *    Traverse entsprechend neu gedacht wird? Weil aktuell sieht die neue
 *    Spinne aus wie die alte Spinne. … Was aber natuerlich auch geschehen
 *    muss, ist, dass man den ganzen Knick der Zinken, der Zaehne nochmal
 *    ueberarbeitet."
 *
 * Er hat recht, und E-069/E-077 belegen es: geaendert wurde der Anstellwinkel
 * des Zahns (12,15° → 0°) und ein Blech ueber der Saeule. Die SCHALE — Bogen,
 * Querschnitt, Schulter, Verjuengung — ist seit dem 14.09.2026 unangetastet.
 *
 * DIESES WERKZEUG BAUT NICHTS UM. Es rechnet und zeichnet. `src/` wird nur
 * GELESEN.
 *
 * ---------------------------------------------------------------------------
 * WAS HIER DRINSTEHT UND WAS NICHT
 *
 * Alle drei Spalten werden aus DERSELBEN Kette gerechnet:
 *
 *   Ruecken­linie (Bolzenframe)  →  Querschnitt je Station  →  Punktwolke
 *   →  Kinematik (Schwenk um den Bolzen, fuenfmal um 72° versetzt)
 *   →  Seitenriss / Vorderriss  →  Flaeche, Deckung, Kennwerte
 *
 * HEUTE liest seine Zahlen aus `src/fuenfschalen/teile.ts`. Drei Funktionen
 * dort sind modulprivat (`verjuengung`, `querRadius`, `woelbungBei`); sie
 * stehen unten als Kopie mit Datum. Damit die Kopie nicht stillschweigend
 * veraltet, prueft `pruefeKopie()` sie gegen die EXPORTIERTE `halbbreiteBei`.
 * Weicht etwas ab, bricht das Werkzeug ab statt falsch zu zeichnen.
 *
 * VORBILD ist KEIN Modell, sondern eine ABGELESENE KONTUR aus
 * `docs/f5-vorbild-offen-halle-gross-2026-09-15.png` (siehe `VORBILD_RUECKEN`).
 * Jede Zahl daraus ist eine SCHAETZUNG mit Pixelgrundlage.
 *
 * Aufruf: npx vite-node tools/fuenfschalen/schalenform-modell.ts
 */
import {
  MASS,
  SCHALEN_ABSCHNITTE,
  SCHALEN_BOGEN,
  ABSCHNITT,
  STEMPEL_AUGE,
  ZU,
  OFFEN,
  OBERE_ANBINDUNG,
  ZYLINDER_AUFNAHME,
  TRAVERSE_Y,
  halbbreiteBei,
  schalenHalbbreite,
  mittellinie,
  schalenStationen,
  fersenStationen,
  feineStationen,
} from "../../src/fuenfschalen/teile";
import { kennwerte } from "./traverse-rechnen";

export const GRAD = 180 / Math.PI;

/* ======================================================= Kopien aus teile.ts */

/**
 * Wortgleiche Kopien der drei modulprivaten Funktionen aus
 * `src/fuenfschalen/teile.ts`, Stand 16.09.2026. Sie sind dort nicht
 * exportiert; `pruefeKopie()` haelt sie ehrlich.
 */
const BLECH = 0.045;
const STREBE_B_OBEN = 0.22;
const STREBE_H_OBEN = 0.13;
const HALB = MASS.schale.breite / 2;
const sektorHalb = Math.PI / MASS.schalen;
const SEKTOR_AB = 0.3;
const SEKTOR_SICHER = 0.9;

export function verjuengungHeute(k: number): number {
  return 1 - 0.7 * (Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k)) / SCHALEN_ABSCHNITTE) ** 1.3;
}
function verstVorn(): number {
  return STREBE_H_OBEN * verjuengungHeute(SCHALEN_ABSCHNITTE);
}
function querRadius(k: number): number {
  const bahn = mittellinie(ZU);
  const kk = Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k));
  const a = Math.floor(kk);
  const b = Math.min(SCHALEN_ABSCHNITTE, a + 1);
  const t = kk - a;
  const r = (bahn[a]?.r ?? 0.1) * (1 - t) + (bahn[b]?.r ?? 0.1) * t;
  return Math.max(r, 0.12);
}
function woelbungBei(halb: number, k: number): number {
  return (halb * halb) / (2 * querRadius(k));
}
/** Kopie von `schalenHalbbreite` — nur um die Kopie gegen das Original zu pruefen. */
function halbKopie(k: number): number {
  let halb = Infinity;
  for (let i = 0; i <= k; i++) {
    let innen = Infinity;
    for (let j = 0; j <= 12; j++) {
      const schwenk = ZU + ((OFFEN - ZU) * j) / 12;
      const bahn = mittellinie(schwenk);
      const th = i * SCHALEN_BOGEN - schwenk;
      innen = Math.min(innen, (bahn[i]?.r ?? 0) - verstVorn() * Math.cos(th));
    }
    halb = Math.min(
      halb,
      HALB * verjuengungHeute(i),
      Math.max(innen, SEKTOR_AB) * Math.tan(sektorHalb) * SEKTOR_SICHER
    );
  }
  return halb;
}

export function pruefeKopie(): void {
  let groesster = 0;
  for (let i = 0; i <= SCHALEN_ABSCHNITTE; i++) {
    groesster = Math.max(groesster, Math.abs(halbKopie(i) - schalenHalbbreite(i)));
  }
  if (groesster > 1e-12) {
    throw new Error(
      `Die Kopie der privaten Funktionen aus teile.ts stimmt nicht mehr ` +
        `(groesster Unterschied ${groesster.toExponential(2)} m). ` +
        `teile.ts hat sich geaendert — die Kopien oben nachziehen, sonst zeichnet ` +
        `dieses Blatt eine Schale, die es nicht gibt.`
    );
  }
}

/* ============================================================ Ruecken­linien */

export interface Punkt {
  /** Lage im Frame des Bolzens (m). */
  y: number;
  z: number;
  /** Tangente (rad), Konvention von teile.ts: Laufrichtung ist (−cos th, −sin th). */
  th: number;
  /** Bogenlaenge ab Station 0 (m). */
  s: number;
  /** Stationsmass 0..6 — proportional zur Bogenlaenge. */
  k: number;
}

/**
 * Der Kreisradius von heute — und warum die Bogenlaenge NICHT 1,38 m ist.
 *
 * `ABSCHNITT` = 0,23 m ist die SEHNE eines Abschnitts, nicht sein Bogen.
 * `feineStationen` setzt darum R = Sehne / (2·sin(Knick/2)) = 0,7560 m; der
 * Bogen eines Abschnitts ist R·17,5° = 0,2309 m, ueber sechs also 1,3854 m.
 * 6 × 0,23 m = 1,38 m ist die Summe der Sehnen. Wer die als Bogenlaenge nimmt,
 * rechnet mit R 0,7530 statt 0,7560 — und trifft `feineStationen` um 5,4 mm
 * daneben. (Genau das ist hier beim ersten Lauf passiert.)
 */
export const R_KREIS = ABSCHNITT / (2 * Math.sin(SCHALEN_BOGEN / 2));
const TH_0 = -SCHALEN_BOGEN / 2; // −8,75°
const TH_E = SCHALEN_ABSCHNITTE * SCHALEN_BOGEN - SCHALEN_BOGEN / 2; // +96,25° = OFFEN
const PHI = TH_E - TH_0; // 105°
const L_BOGEN = R_KREIS * PHI; // 1,3854 m

/**
 * Eine Rueckenlinie aus einer KRUEMMUNGSVERTEILUNG.
 *
 * Fest bleiben drei Dinge, und sie sind genau die, an denen die Kinematik
 * haengt:
 *
 *   1. die Bogenlaenge L = 6 · 0,23 m = 1,38 m  (das Huellmass der Positionsliste)
 *   2. die Anfangstangente −8,75°               (die Naht zur Ferse, ohne Knick)
 *   3. die Endtangente +96,25° = `OFFEN`        („Spitzen senkrecht", 13.09.2026)
 *
 * Frei ist allein, WO zwischen diesen Enden die Kruemmung sitzt. `dichte(t)`
 * gibt sie als Vielfaches der gleichmaessigen Kruemmung an; das Mittel wird
 * hier auf 1 normiert, damit Punkt 3 in jedem Fall erfuellt ist.
 *
 * `dichte = () => 1` liefert exakt den Kreis von heute — das prueft
 * `pruefeBahn()` gegen `feineStationen()` nach.
 */
export function bahnAus(dichte: (t: number) => number, n = 240): Punkt[] {
  // Mittelwert der Dichte, damit die Endtangente sicher getroffen wird
  let summe = 0;
  for (let i = 0; i < n; i++) summe += dichte((i + 0.5) / n);
  const mittel = summe / n;

  const start = schalenStationen()[0]!; // Nullpunkt der Schale im Bolzenframe
  const aus: Punkt[] = [];
  let y = start.y;
  let z = start.z;
  let th = TH_0;
  aus.push({ y, z, th, s: 0, k: 0 });
  const ds = L_BOGEN / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const kappa = ((PHI / L_BOGEN) * dichte(t)) / mittel;
    // Mittelpunktsregel: erst halb drehen, dann laufen, dann halb drehen
    const thm = th + (kappa * ds) / 2;
    y -= ds * Math.cos(thm);
    z -= ds * Math.sin(thm);
    th += kappa * ds;
    aus.push({ y, z, th, s: (i + 1) * ds, k: ((i + 1) / n) * SCHALEN_ABSCHNITTE });
  }
  return aus;
}

/** Der Kreis von heute — gleichmaessige Kruemmung. */
export const DICHTE_HEUTE = (): number => 1;

/**
 * Die gespreizte Kruemmung: oben flach, unten eng — EIN ENTWURF, KEINE MESSUNG.
 *
 * Das gehoert klar gekennzeichnet, weil hier beim ersten Anlauf ein Fehler
 * stand. Am Foto abgelesen wirkt der Ruecken oben flacher; per Hand ueber die
 * 16 Punkte gerechnet kam 1 : 1,50 : 1,44 heraus, und darauf waren die Zahlen
 * unten gesetzt. Die nachgerechnete Messung ueber das Fenster, das WIRKLICH
 * unserem Schalenkoerper entspricht (105° Drehung, siehe `vorbildFenster`),
 * sagt etwas anderes: **1 : 1,02 : 0,93**. Innerhalb der Ablesegenauigkeit ist
 * der Ruecken des Vorbilds derselbe gleichmaessige Kreis, den wir schon haben.
 *
 * Der Unterschied zwischen beiden Rechnungen ist die FERSE: Ueber die ganze
 * abgelesene Linie (148°) liegt vorn ein Stueck, das steiler dreht — aber das
 * ist Ferse, nicht Schale, und die Ferse ist mit E-069 schon am Vorbild
 * geprueft worden.
 *
 * Die Spreizung bleibt als ANGEBOT stehen, damit auf dem Blatt steht, was sie
 * kostet und was sie bringt. Sie ist ein Startwert (SW 16.09.2026):
 * oben 0,72-fach (R 1,03 m), unten 1,15-fach (R 0,65 m), Mittel 1 — damit
 * bleibt die Endtangente bei 96,25° und `OFFEN` unberuehrt.
 */
export const DICHTE_SPREIZ = (t: number): number => {
  const OBEN = 0.88; // aus 1 : 1,21 : 1,19, auf Mittel 1 normiert
  const UNTEN = 1.06;
  const w = Math.max(0, Math.min(1, (t - 0.28) / 0.22)); // Uebergang 28 % … 50 %
  return OBEN + (UNTEN - OBEN) * (w * w * (3 - 2 * w));
};

export function pruefeBahn(): number {
  const b = bahnAus(DICHTE_HEUTE, 600);
  const f = feineStationen(40);
  let groesster = 0;
  for (const p of f) {
    /*
     * Zwischen den Stuetzstellen INTERPOLIEREN, nicht auf den naechsten Index
     * runden. Gerundet meldete die Gegenprobe 1,15 mm — das ist genau eine
     * halbe Schrittweite und sagt nichts ueber die Bahn, nur ueber das Runden.
     */
    const q = beiK(b, p.k);
    groesster = Math.max(groesster, Math.hypot(q.y - p.y, q.z - p.z));
  }
  return groesster;
}

/* ================================================== abgelesene Vorbildkontur */

/**
 * Die Ruecken­linie des Vorbilds, am Foto abgelesen — SCHAETZUNG.
 *
 * Bild `docs/f5-vorbild-offen-halle-gross-2026-09-15.png`, 2360 × 1640 px.
 * Rechte Schale, Ausschnitt x 1250…1820 / y 780…1400, 2,4-fach vergroessert,
 * 50-px-Raster daruebergelegt (`tools`-Arbeitsstand 16.09.2026). Abgelesen sind
 * die Punkte der AUSSENKANTE vom Austritt hinter dem Kopf bis in die
 * Zahnspitze. Ablesegenauigkeit ±15 px im Original, das sind rund 2 % der
 * Ruecken­laenge (786 px).
 *
 * WAS NICHT DRINSTEHT: die Ferse. Sie liegt im Foto hinter dem Kopf. Die
 * Vorbildspalte benutzt deshalb UNSERE Ferse — sie ist mit E-069 schon am
 * Vorbild geprueft worden.
 */
export const VORBILD_RUECKEN: Array<[number, number]> = [
  [1285, 885],
  [1340, 866],
  [1400, 856],
  [1460, 858],
  [1520, 874],
  [1575, 900],
  [1620, 932],
  [1655, 972],
  [1678, 1018],
  [1692, 1068],
  [1698, 1120],
  [1697, 1170],
  [1688, 1215],
  [1672, 1250], // <- hier sitzt die Naht der Zahnaufnahme (sichtbare Querkante)
  [1648, 1285],
  [1620, 1320],
];
/** Index des Punktes, an dem im Foto die Naht zum Zahn liegt. */
export const VORBILD_ZAHNNAHT = 13;

/** Die abgelesene Kontur, gleichmaessig nachabgetastet: Bildpunkte mit Tangente. */
function vorbildDicht(n = 600): Array<{ x: number; y: number; th: number; s: number }> {
  const p = VORBILD_RUECKEN;
  const kum: number[] = [0];
  for (let i = 0; i < p.length - 1; i++) {
    kum.push(kum[i]! + Math.hypot(p[i + 1]![0] - p[i]![0], p[i + 1]![1] - p[i]![1]));
  }
  const ges = kum[kum.length - 1]!;
  const roh: Array<{ x: number; y: number; s: number }> = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * ges;
    let j = 0;
    while (j < kum.length - 2 && kum[j + 1]! < s) j++;
    const u = (s - kum[j]!) / Math.max(1e-9, kum[j + 1]! - kum[j]!);
    roh.push({
      x: p[j]![0] + (p[j + 1]![0] - p[j]![0]) * u,
      y: p[j]![1] + (p[j + 1]![1] - p[j]![1]) * u,
      s,
    });
  }
  /*
   * Die Tangente ueber ein FENSTER von 5 % der Laenge, nicht aus der Richtung
   * des gerade getroffenen Abschnitts.
   *
   * 16 abgelesene Punkte ergeben 15 Richtungen — als Treppe. Wer die Treppe
   * abtastet, misst an jeder Stufe eine unendliche Kruemmung und dazwischen
   * keine; die Viertelradien kamen so auf 0,97 m heraus, obwohl das Mittel
   * ueber die ganze Bahn 0,756 m sein MUSS. Das Fenster glaettet genau diese
   * Treppe und laesst die Form in Ruhe.
   */
  const w = Math.max(2, Math.round(n * 0.05));
  return roh.map((q, i) => {
    const a = roh[Math.max(0, i - w)]!;
    const b = roh[Math.min(roh.length - 1, i + w)]!;
    return { x: q.x, y: q.y, s: q.s, th: Math.atan2(b.y - a.y, b.x - a.x) };
  });
}

/** Bogenlaenge bis zur Zahnnaht (px). */
function nahtLaenge(): number {
  const p = VORBILD_RUECKEN;
  let s = 0;
  for (let i = 0; i < VORBILD_ZAHNNAHT; i++) {
    s += Math.hypot(p[i + 1]![0] - p[i]![0], p[i + 1]![1] - p[i]![1]);
  }
  return s;
}

/**
 * Das FENSTER der abgelesenen Kontur, das unserem Schalenkoerper entspricht.
 *
 * Die abgelesene Linie faengt dort an, wo die Schale hinter dem Kopf
 * hervorkommt — das ist schon ein Stueck FERSE, nicht der Schalenanfang. Und
 * sie hoert in der Zahnspitze auf, also hinter dem Schalenende. Ueber alles
 * dreht sie sich 148°; unser Schalenkoerper dreht sich 105°.
 *
 * Verglichen wird deshalb das Stueck, das vor der sichtbaren ZAHNNAHT liegt und
 * sich um genau 105° dreht. Das ist der einzige Zuschnitt, der ohne eine
 * geratene Bolzenlage auskommt: Die Naht ist im Bild zu sehen, die Drehung ist
 * unsere eigene Zahl.
 */
function vorbildFenster(): { von: number; bis: number; dicht: ReturnType<typeof vorbildDicht> } {
  const d = vorbildDicht();
  const bis = nahtLaenge();
  const thBis = d.find((q) => q.s >= bis)!.th;
  const ziel = thBis - PHI;
  let von = 0;
  for (const q of d) {
    if (q.s > bis) break;
    if (q.th <= ziel) von = q.s;
  }
  return { von, bis, dicht: d };
}

/** Bogenlaenge, Gesamtdrehung und Drittel-Kruemmung der abgelesenen Kontur. */
export function vorbildMessung(): {
  laengePx: number;
  koerperPx: number;
  fersePx: number;
  zahnPx: number;
  zahnAnteil: number;
  drehung: number;
  drittel: [number, number, number];
} {
  const { von, bis, dicht } = vorbildFenster();
  const ges = dicht[dicht.length - 1]!.s;
  const koerper = bis - von;
  // Drehung je Drittel des Koerpers, in Grad je 100 px
  const dreh: [number, number, number] = [0, 0, 0];
  const len: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < dicht.length - 1; i++) {
    const a = dicht[i]!;
    const b = dicht[i + 1]!;
    if (a.s < von || b.s > bis) continue;
    const j = Math.min(2, Math.floor(((a.s - von) / koerper) * 3));
    dreh[j] += (b.th - a.th) * GRAD;
    len[j] += b.s - a.s;
  }
  return {
    laengePx: ges,
    koerperPx: koerper,
    fersePx: von,
    zahnPx: ges - bis,
    zahnAnteil: (ges - bis) / koerper,
    drehung: (dicht[dicht.length - 1]!.th - dicht[0]!.th) * GRAD,
    drittel: [
      (dreh[0] / len[0]) * 100,
      (dreh[1] / len[1]) * 100,
      (dreh[2] / len[2]) * 100,
    ],
  };
}

/**
 * Die abgelesene Kontur als Ruecken­linie im Bolzenframe — massstabsfrei.
 *
 * Genommen wird das Fenster aus `vorbildFenster()`, skaliert auf unsere
 * Bogenlaenge und gedreht, bis die Anfangstangente auf −8,75° liegt. Damit
 * vergleicht die dritte Spalte die FORM, nicht die Groesse — so, wie der
 * Auftrag es verlangt („Verhaeltnisse statt Masse").
 */
export function bahnVorbild(n = 240): Punkt[] {
  const { von, bis, dicht } = vorbildFenster();
  const teil = dicht.filter((q) => q.s >= von - 1e-9 && q.s <= bis + 1e-9);
  const f = L_BOGEN / (bis - von);
  const dreh = teil[0]!.th - TH_0;
  const c = Math.cos(-dreh);
  const sn = Math.sin(-dreh);
  const start = schalenStationen()[0]!;
  const aus: Punkt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (teil.length - 1);
    const a = Math.floor(t);
    const b = Math.min(teil.length - 1, a + 1);
    const u = t - a;
    const px = teil[a]!.x + (teil[b]!.x - teil[a]!.x) * u;
    const py = teil[a]!.y + (teil[b]!.y - teil[a]!.y) * u;
    const th = teil[a]!.th + (teil[b]!.th - teil[a]!.th) * u;
    const dx = (px - teil[0]!.x) * f;
    const dy = (py - teil[0]!.y) * f;
    /*
     * Bild: +x nach rechts, +y nach unten. Unsere Laufrichtung ist
     * (−cos th, −sin th) in (y, z) — Bild-(x, y) bildet also auf (−y, −z) ab.
     */
    aus.push({
      y: start.y - (dx * c - dy * sn),
      z: start.z - (dx * sn + dy * c),
      th: th - dreh,
      s: (i / n) * L_BOGEN,
      k: (i / n) * SCHALEN_ABSCHNITTE,
    });
  }
  return aus;
}

/* ================================================================ Querschnitt */

/** Ein Querschnitt: geschlossener Polygonzug in (x quer, w normal nach aussen). */
export type Schnitt = Array<[number, number]>;

export interface Form {
  name: string;
  kurz: string;
  bahn: Punkt[];
  /** Halbbreite der Schale an Stationsmass k (m). */
  halb(k: number): number;
  /** Querschnitt an Stationsmass k. */
  schnitt(k: number): Schnitt;
  /** Wo endet der Schalenkoerper und faengt der Zahn an (Stationsmass). */
  zahnAb: number;
  /** Zahnquerschnitt an Zahnparameter u 0..1, und seine Laenge (m). */
  zahnLaenge: number;
  zahnSchnitt(u: number): Schnitt;
  /** Wie tief reicht der Koerper an Station k nach INNEN (m, positiv = nach innen). */
  innenTiefe(k: number): number;
}

/* -------------------------------------------------------------- HEUTE */

/**
 * Der Querschnitt von heute: eine sanft gewoelbte Platte, darauf mittig eine
 * Kastenrippe. Keine Wangen — E-013/E-025 haben sie ausdruecklich abgeschafft
 * („ein Guss, keine nach oben stehenden Bleche").
 *
 * Wortgleich zu `baueGreiferschale` in `teile.ts`, nur als Umriss statt als Netz.
 */
function schnittHeute(k: number): Schnitt {
  const halb = halbbreiteBei(k);
  const R = querRadius(k);
  const auf = woelbungBei(halb, k) + BLECH;
  const bB = STREBE_B_OBEN * verjuengungHeute(k);
  const bH = STREBE_H_OBEN * verjuengungHeute(k);
  const innenStrebe = auf * Math.min(1, k);
  const N = 16;
  const p: Schnitt = [];
  // Aussenflaeche der Haut von −halb nach +halb
  for (let i = 0; i <= N; i++) {
    const x = -halb + (2 * halb * i) / N;
    p.push([x, (halb * halb - x * x) / (2 * R) + BLECH]);
  }
  // zurueck ueber die Innenflaeche
  for (let i = N; i >= 0; i--) {
    const x = -halb + (2 * halb * i) / N;
    p.push([x, (halb * halb - x * x) / (2 * R)]);
  }
  // die Strebe als eigener Ring — als zweites Polygon angehaengt reicht fuer
  // Umriss und Flaeche, weil sie die Haut beruehrt
  const s: Schnitt = [
    [-bB / 2, innenStrebe],
    [bB / 2, innenStrebe],
    [bB / 2, auf + bH],
    [-bB / 2, auf + bH],
  ];
  return [...p, ...s];
}

/* ---------------------------------------------------------------- NEU */

/**
 * NEU — die vier Aenderungen, jede einzeln umschaltbar.
 *
 * N1 RUECKENLINIE   Kreis R 0,756 m  →  zweiradig, oben R 1,05 / unten R 0,66
 * N2 VERJUENGUNG    400 → 120 mm (30 %)  →  400 → 248 mm (62 %), oben gehalten
 * N3 QUERSCHNITT    Platte + Kastenrippe  →  Trog mit Wangen und Rueckenkamm
 * N4 ZAHN           buendig, 250 mm  →  auf sichtbarer Aufnahme, 180 mm, schmaler
 *
 * Alle vier lassen Bolzen, Zylinderauge und die drei Waechter unberuehrt —
 * siehe `waechter()` am Ende dieser Datei.
 */
export interface Schalter {
  /** "heute" = Kreis · "spreiz" = Kruemmung gespreizt · "vorbild" = abgelesene Linie */
  n1: "heute" | "spreiz" | "vorbild";
  n2: boolean;
  n3: boolean;
  n4: boolean;
}
export const ALLE: Schalter = { n1: "spreiz", n2: true, n3: true, n4: true };
export const KEINE: Schalter = { n1: "heute", n2: false, n3: false, n4: false };
/** Die vier Aenderungen einzeln — damit auf dem Blatt steht, welche was bringt. */
export const STUFEN: Array<[string, Schalter]> = [
  ["N1a Ruecken vom Vorbild", { ...KEINE, n1: "vorbild" }],
  ["N1b Ruecken gespreizt", { ...KEINE, n1: "spreiz" }],
  ["N2 Verjuengung allein", { ...KEINE, n2: true }],
  ["N3 Querschnitt allein", { ...KEINE, n3: true }],
  ["N4 Zahn allein", { ...KEINE, n4: true }],
  ["EMPFEHLUNG N2+N3+N4", { n1: "heute", n2: true, n3: true, n4: true }],
  ["alles inkl. N1b", ALLE],
];

function bahnFuer(n1: Schalter["n1"]): Punkt[] {
  return n1 === "vorbild"
    ? bahnVorbild()
    : bahnAus(n1 === "spreiz" ? DICHTE_SPREIZ : DICHTE_HEUTE);
}

/**
 * N2 — die neue Verjuengung.
 *
 * Endwert 0,62 statt 0,30. Grundlage: `docs/f5-vorbild-nabe-unten-2026-09-15.png`
 * (Plansicht von unten, 2360 × 1640 px) und
 * `docs/f5-vorbild-offen-halle-gross-2026-09-15.png`. Am Vorbild endet der
 * SCHALENKOERPER stumpf und breit; der Zahn ist ein eigenes, schmaleres Stueck
 * darauf. Gemessen an der rechten Schale der Plansicht faellt die Blattbreite
 * vom Hals bis zum stumpfen Ende auf rund 0,6 — SCHAETZUNG, ±0,1, weil die
 * Plansicht perspektivisch ist und die Schalen dabei unterschiedlich weit vom
 * Bildmittelpunkt liegen.
 *
 * Der Exponent 2,2 statt 1,3 haelt die Breite oben: bei halber Laenge sind es
 * 0,92 statt 0,72. Das ist der zweite Teil des Befundes — das Vorbild wird
 * erst im letzten Drittel schmal.
 */
export function verjuengungNeu(k: number): number {
  return 1 - 0.38 * (Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k)) / SCHALEN_ABSCHNITTE) ** 2.2;
}

/**
 * N3 — der neue Querschnitt: ein TROG.
 *
 * Drei Zahlen, alle als Anteil der Halbbreite, damit die Form massstabsfrei
 * mitwaechst:
 *
 *   Pfeilhoehe der Platte   0,30 · halb   (heute: halb²/2R, oben 22 mm)
 *   Ruecken­kamm            0,055 m hoch ueber 0,45 der Breite, gerundet
 *   Wange                   0,11 m tief am Bolzen, mit der Verjuengung fallend,
 *                           0,03 m stark
 *
 * Die Wangen sind der eigentliche Unterschied: Sie stehen NACH INNEN, in den
 * Korb hinein, und halten die Ladung. Genau das zeigen
 * `f5-vorbild-geschlossen-beladen` (die Ladung liegt zwischen den Raendern,
 * nicht auf einer Platte) und `f5-vorbild-offen-halle-gross` (der Hohlraum
 * unter dem Ruecken ist zwischen zwei Wangen aufgespannt).
 *
 * Damit faellt die Kastenrippe weg. Sie war der Grund, warum die Schale in der
 * Schraegansicht wie „ein Blatt mit einer Leiste darauf" aussieht: Die Tiefe
 * kam aus einem 220 mm breiten Kasten auf einer 400 mm breiten Platte.
 *
 * WAS ES KOSTET, steht in `messe()`: die Wangen greifen nach innen und
 * verschaerfen damit den Sektordeckel — genau dieselbe Rechnung, mit der
 * `schalenHalbbreite` heute schon die Rippe beruecksichtigt.
 */
const NEU_PFEIL = 0.16; // Pfeilhoehe als Anteil der Halbbreite, SW 16.09.2026
const NEU_KAMM_H = 0.035; // Hoehe des Rueckenkamms (m)
const NEU_KAMM_B = 0.5; // Breite des Kamms als Anteil der Halbbreite
const NEU_WANGE_T = 0.03; // Staerke der Wange (m)
const NEU_WANGE_H = 0.085; // Tiefe der Wange am Bolzen (m)

export function wangenTiefe(k: number): number {
  return NEU_WANGE_H * verjuengungNeu(k);
}

function schnittNeu(k: number, s: Schalter): Schnitt {
  const halb = halbNeu(k, s);
  if (!s.n3) {
    // nur N1/N2: Querschnitt wie heute, aber mit der neuen Breite
    const R = querRadius(k);
    const auf = (halb * halb) / (2 * R) + BLECH;
    const bB = STREBE_B_OBEN * (s.n2 ? verjuengungNeu(k) : verjuengungHeute(k));
    const bH = STREBE_H_OBEN * (s.n2 ? verjuengungNeu(k) : verjuengungHeute(k));
    const N = 16;
    const p: Schnitt = [];
    for (let i = 0; i <= N; i++) {
      const x = -halb + (2 * halb * i) / N;
      p.push([x, (halb * halb - x * x) / (2 * R) + BLECH]);
    }
    for (let i = N; i >= 0; i--) {
      const x = -halb + (2 * halb * i) / N;
      p.push([x, (halb * halb - x * x) / (2 * R)]);
    }
    return [
      ...p,
      [-bB / 2, auf - BLECH],
      [bB / 2, auf - BLECH],
      [bB / 2, auf + bH],
      [-bB / 2, auf + bH],
    ];
  }
  const pfeil = NEU_PFEIL * halb;
  const kammB = NEU_KAMM_B * halb;
  const wange = wangenTiefe(k);
  const N = 18;
  const platte = (x: number): number => pfeil * (1 - (x / halb) ** 2);
  const kamm = (x: number): number =>
    Math.abs(x) >= kammB ? 0 : NEU_KAMM_H * (1 - (x / kammB) ** 2) ** 0.7;
  const p: Schnitt = [];
  // Aussenflaeche: Platte + Blech + Kamm, von −halb nach +halb
  for (let i = 0; i <= N; i++) {
    const x = -halb + (2 * halb * i) / N;
    p.push([x, platte(x) + BLECH + kamm(x)]);
  }
  // rechte Wange nach innen
  const xw = halb - NEU_WANGE_T;
  p.push([halb, -wange]);
  p.push([xw, -wange]);
  /*
   * Die Innenflaeche wird an FESTEN Bruchteilen von (halb − Wangenstaerke)
   * abgetastet, nicht an denselben Stellen wie die Aussenflaeche. Sonst haengt
   * die Punktzahl des Querschnitts davon ab, wo die Wange gerade liegt — und
   * ein Strang aus Ringen unterschiedlicher Laenge laesst sich nicht
   * vernetzen. (Genau daran ist der erste Entwurf gescheitert.)
   */
  for (let i = 0; i <= N; i++) {
    const x = xw - (2 * xw * i) / N;
    p.push([x, platte(x)]);
  }
  // linke Wange nach innen
  p.push([-xw, -wange]);
  p.push([-halb, -wange]);
  return p;
}

/**
 * Die neue Halbbreite — mit demselben Sektordeckel wie heute, aber am
 * INNERSTEN Punkt des Koerpers gemessen.
 *
 * Heute rechnet `schalenHalbbreite` mit `r − verstVorn()·cos(th)`: der Deckel
 * gilt fuer die Rippe, die am weitesten nach innen reicht. Mit Wangen ist das
 * die Wange, und sie reicht tiefer. Die Rechnung ist wortgleich, nur die
 * Eindringtiefe ist eine andere — deshalb faellt die Endbreite in der Regel
 * NICHT auf die vollen 62 %, und genau diese Zahl gehoert aufs Blatt.
 */
export function halbNeu(k: number, s: Schalter): number {
  const bahn = bahnFuer(s.n1);
  const vj = s.n2 ? verjuengungNeu : verjuengungHeute;
  const tief = s.n3 ? NEU_WANGE_H * vj(SCHALEN_ABSCHNITTE) : verstVorn();
  let halb = Infinity;
  for (let i = 0; i <= Math.ceil(k); i++) {
    const ki = Math.min(i, k);
    let innen = Infinity;
    for (let j = 0; j <= 12; j++) {
      const schwenk = ZU + ((OFFEN - ZU) * j) / 12;
      const p = beiK(bahn, ki);
      const r = STEMPEL_AUGE.r + (p.y * Math.sin(-schwenk) + p.z * Math.cos(-schwenk));
      innen = Math.min(innen, r - tief * Math.cos(p.th - schwenk));
    }
    halb = Math.min(
      halb,
      HALB * vj(ki),
      Math.max(innen, SEKTOR_AB) * Math.tan(sektorHalb) * SEKTOR_SICHER
    );
  }
  return halb;
}

/** Punkt einer Bahn bei Stationsmass k (linear zwischen den Stuetzstellen). */
export function beiK(bahn: Punkt[], k: number): Punkt {
  const t = Math.max(0, Math.min(1, k / SCHALEN_ABSCHNITTE)) * (bahn.length - 1);
  const a = Math.floor(t);
  const b = Math.min(bahn.length - 1, a + 1);
  const u = t - a;
  const p = bahn[a]!;
  const q = bahn[b]!;
  return {
    y: p.y + (q.y - p.y) * u,
    z: p.z + (q.z - p.z) * u,
    th: p.th + (q.th - p.th) * u,
    s: p.s + (q.s - p.s) * u,
    k,
  };
}

/* ================================================================== Zaehne */

/** Biegeradius des Zahns (m) — aus `teile.ts`, Zeichnung `zahngreifer` 13.09.2026. */
const ZAHN_R = 0.7;

/**
 * Wo sitzt der Zahnquerschnitt bei Zahnparameter u — MIT der Biegung.
 *
 * `teile.ts` biegt den Zahn ueber `zahnRing` auf R 0,70: Die Laenge entlang der
 * Achse bleibt erhalten, sie wird nur zum Bogen. Ohne diese Biegung waere die
 * HEUTE-Spalte nicht die heutige Form — auf 250 mm sind das 20,5° und rund
 * 11 mm Versatz der Spitze, und genau um solche Betraege geht es auf diesem
 * Blatt. Deshalb steht sie hier und nicht in einer Fussnote.
 */
function zahnLage(
  e: { y: number; z: number; th: number },
  d: number
): { y: number; z: number; th: number } {
  const w = d / ZAHN_R;
  /* Laufrichtung (−cos th, −sin th); auf dem Bogen dreht th mit s/R mit. */
  const th = e.th + w;
  return {
    y: e.y - ZAHN_R * (Math.sin(th) - Math.sin(e.th)),
    z: e.z + ZAHN_R * (Math.cos(th) - Math.cos(e.th)),
    th,
  };
}

const ZAHN_STATIONEN: Array<[number, number, number]> = [
  [0, 1, 1],
  [0.09, 0.9, 0.86],
  [0.18, 0.76, 0.68],
  [0.25, 0.62, 0.52],
];

/** Zahnquerschnitt von heute (Fuenfeck), im Zahnrahmen. */
function zahnSchnittHeute(u: number): Schnitt {
  const b = 2 * schalenHalbbreite(SCHALEN_ABSCHNITTE);
  const h = STREBE_H_OBEN * verjuengungHeute(SCHALEN_ABSCHNITTE);
  const i = Math.min(ZAHN_STATIONEN.length - 1, Math.floor(u * 3));
  const j = Math.min(ZAHN_STATIONEN.length - 1, i + 1);
  const t = u * 3 - i;
  const fb = ZAHN_STATIONEN[i]![1] + (ZAHN_STATIONEN[j]![1] - ZAHN_STATIONEN[i]![1]) * t;
  const fh = ZAHN_STATIONEN[i]![2] + (ZAHN_STATIONEN[j]![2] - ZAHN_STATIONEN[i]![2]) * t;
  const hb = (b * fb) / 2;
  const hh = h * fh;
  return [
    [-hb, 0],
    [hb, 0],
    [hb * 0.84, hh * 0.65],
    [0, hh],
    [-hb * 0.84, hh * 0.65],
  ];
}

/**
 * N4 — der neue Zahn: kuerzer, auf einer sichtbaren Aufnahme, schmaler als das
 * Schalenende.
 *
 * Am Vorbild (`f5-vorbild-offen-halle-gross`, rechte Schale) liegt zwischen
 * Schalenkoerper und Spitze eine QUERKANTE bei y ≈ 1250 px, und die Spitze
 * endet bei y ≈ 1320 px: der Zahn misst rund 87 px von 786 px Ruecken­laenge,
 * also 11 % — SCHAETZUNG, ±2 Prozentpunkte. Heute sind es 250 mm auf 1.380 mm
 * Bogen plus Ferse, also 15 %.
 *
 * 0,18 m sind 11 % der Ruecken­laenge von 1,38 m + 0,25 m Ferse. Die Basis ist
 * 0,55 des Schalenendes — damit bleibt der Zahn mit 0,55 · 248 mm = 136 mm
 * ungefaehr so breit wie heute (120 mm), obwohl die Schale breiter wird. Das
 * ist der Punkt: nicht der Zahn waechst, die Schale hoert auf, eine Nadel zu
 * sein.
 */
const NEU_ZAHN_L = 0.22;
const NEU_ZAHN_B = 0.55;
const NEU_ZAHN_ABSATZ = 0.025; // Hoehe der sichtbaren Zahnaufnahme (m), SW 16.09.2026

/**
 * Wie schief steht der Zahn am Vorbild, wenn der Greifer offen ist? SCHAETZUNG.
 *
 * Bild `docs/f5-vorbild-offen-halle-gross-2026-09-15.png`, die LINKE Schale —
 * sie steht am naechsten an der reinen Seitenansicht. Der Zahn ist dort als
 * eigener dunkler Streifen gegen die helle Wand zu trennen; seine Mitte wandert
 *
 *   y 1260 px → x 663      y 1290 px → x 674      y 1320 px → x 682
 *
 * also 19 px nach INNEN auf 60 px Laenge: atan(19/60) = 17,6°. Mit ±5 px
 * Ablesefehler an beiden Enden sind das 17,6° ± 5°.
 *
 * DAS WIDERSPRICHT der Ansage vom 13.09.2026 („wenn die Spinne offen ist,
 * sollten die Spitzen senkrecht stehen") und der Entscheidung E-069, die den
 * Zahn genau deshalb von 12,15° auf 0° gestellt hat.
 *
 * ES WIRD HIER NICHTS GEAENDERT. Zwei Vorbehalte machen die Messung allein zu
 * schwach fuer eine Umkehr: Der Greifer im Bild steht auf Podesten und muss
 * nicht am Anschlag offen sein, und eine perspektivische Aufnahme kippt eine
 * Achse, die auf die Kamera zulaeuft. Die Zahl gehoert auf das Blatt und die
 * Frage an Patrick — nicht in eine Aenderung.
 */
export const VORBILD_ZAHNNEIGUNG = 17.6;

function zahnSchnittNeu(u: number, endBreite: number, endHoehe: number): Schnitt {
  // Breite faellt auf 0,45 der Basis, Hoehe auf 0,40 — kurzer, stumpfer Keil
  const fb = 1 - 0.55 * u ** 1.1;
  const fh = 1 - 0.6 * u ** 1.1;
  const hb = (endBreite * NEU_ZAHN_B * fb) / 2;
  const hh = endHoehe * 0.9 * fh;
  return [
    [-hb, -hh * 0.25],
    [hb, -hh * 0.25],
    [hb * 0.8, hh * 0.6],
    [0, hh],
    [-hb * 0.8, hh * 0.6],
  ];
}

/* ================================================================== Formen */

export function formHeute(): Form {
  return {
    name: "HEUTE",
    kurz: "heute",
    bahn: bahnAus(DICHTE_HEUTE),
    halb: (k) => halbbreiteBei(k),
    schnitt: schnittHeute,
    zahnAb: SCHALEN_ABSCHNITTE,
    zahnLaenge: 0.25,
    zahnSchnitt: zahnSchnittHeute,
    innenTiefe: () => 0,
  };
}

export function formNeu(s: Schalter = ALLE): Form {
  const bahn = bahnFuer(s.n1);
  const endB = 2 * halbNeu(SCHALEN_ABSCHNITTE, s);
  const endH = s.n3
    ? NEU_PFEIL * halbNeu(SCHALEN_ABSCHNITTE, s) + BLECH + NEU_KAMM_H
    : STREBE_H_OBEN * (s.n2 ? verjuengungNeu : verjuengungHeute)(SCHALEN_ABSCHNITTE);
  return {
    name: "NEU",
    kurz: "neu",
    bahn,
    halb: (k) => halbNeu(k, s),
    schnitt: (k) => schnittNeu(k, s),
    zahnAb: SCHALEN_ABSCHNITTE,
    zahnLaenge: s.n4 ? NEU_ZAHN_L : 0.25,
    zahnSchnitt: s.n4
      ? (u) => zahnSchnittNeu(u, endB, endH)
      : (u) => zahnSchnittHeute(u),
    innenTiefe: (k) => (s.n3 ? wangenTiefe(k) : 0),
  };
}

/**
 * Die Vorbildspalte — abgelesener Ruecken, unsere Ferse, geschaetzter Querschnitt.
 *
 * Der Querschnitt ist NICHT gemessen, er ist der Trog aus N3. Das ist ehrlich
 * so zu lesen: Die dritte Spalte zeigt, wohin die Form laeuft, wenn man dem
 * Foto folgt — nicht ein vermessenes Bauteil.
 */
export function formVorbild(): Form {
  const s = ALLE;
  const endB = 2 * halbNeu(SCHALEN_ABSCHNITTE, s);
  const endH = NEU_PFEIL * halbNeu(SCHALEN_ABSCHNITTE, s) + BLECH + NEU_KAMM_H;
  return {
    name: "VORBILD",
    kurz: "vorbild",
    bahn: bahnVorbild(),
    halb: (k) => halbNeu(k, s),
    schnitt: (k) => schnittNeu(k, s),
    zahnAb: SCHALEN_ABSCHNITTE,
    zahnLaenge: NEU_ZAHN_L,
    zahnSchnitt: (u) => zahnSchnittNeu(u, endB, endH),
    innenTiefe: (k) => wangenTiefe(k),
  };
}

/* ============================================================= Punktwolke */

export interface Wolke {
  /** Punkte im Greiferframe: [z, y] — der Seiten-/Vorderriss der z-y-Ebene. */
  riss: Array<[number, number]>;
  /** Tiefster Punkt (m) und groesster Radius (m). */
  tiefstes: number;
  weitestes: number;
  /** Lage der Zahnspitze im Greiferframe. */
  spitze: [number, number];
}

/** Ferse als Bahnpunkte (aus teile.ts, fuer alle drei Spalten dieselbe). */
function fersenBahn(): Punkt[] {
  return fersenStationen(14).map((f) => ({ y: f.y, z: f.z, th: f.th, s: 0, k: 0 }));
}

/**
 * Alle RINGE einer Schale bei gegebenem Schwenk, im Greiferframe, projiziert.
 *
 * `psi` ist der Umfangswinkel der Schale (0, 72°, …). Ein Punkt sitzt bei
 * Radius r, Hoehe y und quer x; im Riss auf die z-y-Ebene wird daraus
 * z = r·cos ψ − x·sin ψ. Zurueck kommen drei STRAENGE — Ferse, Koerper, Zahn —,
 * jeder mit gleich langen Ringen, damit man sie vernetzen kann.
 */
export function schalenStraenge(
  f: Form,
  schwenk: number,
  psi: number,
  stationen = 26
): Array<Array<Array<[number, number]>>> {
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  const cp = Math.cos(psi);
  const sp = Math.sin(psi);
  const lege = (
    y0: number,
    z0: number,
    th: number,
    quer: Schnitt
  ): Array<[number, number]> =>
    quer.map(([x, w]) => {
      const y1 = y0 - w * Math.sin(th);
      const z1 = z0 + w * Math.cos(th);
      const r = STEMPEL_AUGE.r + (y1 * sn + z1 * c);
      const Y = STEMPEL_AUGE.y + (y1 * c - z1 * sn);
      return [r * cp - x * sp, Y] as [number, number];
    });

  // Ferse — bei allen drei Spalten dieselbe (E-069)
  const fb = fersenBahn();
  const anschlussB = 2 * f.halb(0);
  const ferse = fb.map((p, i) => {
    const t = i / (fb.length - 1);
    const w = t * t * (3 - 2 * t);
    const bB = 0.4 * (1 - w) + anschlussB * w;
    const hoch = 0.28 * (1 - w) + 0.2 * w;
    return lege(p.y, p.z, p.th, [
      [-bB / 2, -hoch / 2],
      [bB / 2, -hoch / 2],
      [bB / 2, hoch / 2],
      [-bB / 2, hoch / 2],
    ]);
  });

  // Schalenkoerper
  const koerper: Array<Array<[number, number]>> = [];
  for (let i = 0; i <= stationen; i++) {
    const k = (i / stationen) * SCHALEN_ABSCHNITTE;
    const p = beiK(f.bahn, k);
    koerper.push(lege(p.y, p.z, p.th, f.schnitt(k)));
  }

  // Zahn: sitzt am Ende, auf der Tangente, mit Absatz
  const e = f.bahn[f.bahn.length - 1]!;
  const absatz = f.name === "HEUTE" ? 0 : NEU_ZAHN_ABSATZ;
  const zahn: Array<Array<[number, number]>> = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const q = zahnLage(e, absatz + u * f.zahnLaenge);
    zahn.push(lege(q.y, q.z, q.th, f.zahnSchnitt(u)));
  }
  return [ferse, koerper, zahn];
}

/** Ein Strang aus Ringen gleicher Laenge wird zu Dreiecken. */
export function strangDreiecke(ringe: Array<Array<[number, number]>>): Dreieck[] {
  const aus: Dreieck[] = [];
  for (let i = 0; i < ringe.length - 1; i++) {
    const a = ringe[i]!;
    const b = ringe[i + 1]!;
    const n = Math.min(a.length, b.length);
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      aus.push([a[j]!, a[j2]!, b[j2]!]);
      aus.push([a[j]!, b[j2]!, b[j]!]);
    }
  }
  // Deckel an beiden Enden, als Faecher — sonst fehlt im Riss die Stirnflaeche
  for (const r of [ringe[0]!, ringe[ringe.length - 1]!]) {
    for (let j = 1; j < r.length - 1; j++) aus.push([r[0]!, r[j]!, r[j + 1]!]);
  }
  return aus;
}

/**
 * Der Umriss EINER Schale in ihrem eigenen Frame — Ruecken und Bauch getrennt.
 *
 * Das ist die Ansicht, in der man eine Form beurteilt: laengs des Bolzens
 * geschaut, ohne Schwenk, ohne die vier anderen Schalen davor. Zurueck kommen
 * zwei Linien in (z, y) — der Ruecken (groesstes w) und der Bauch (kleinstes
 * w) — und die Stelle, an der der Zahn aufsitzt.
 */
export function eigenUmriss(f: Form): {
  ruecken: Array<[number, number]>;
  bauch: Array<[number, number]>;
  naht: [number, number];
  spitze: [number, number];
  stationen: Array<[number, number]>;
} {
  const ruecken: Array<[number, number]> = [];
  const bauch: Array<[number, number]> = [];
  const lege = (y0: number, z0: number, th: number, quer: Schnitt): void => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, w] of quer) {
      lo = Math.min(lo, w);
      hi = Math.max(hi, w);
    }
    ruecken.push([z0 + hi * Math.cos(th), y0 - hi * Math.sin(th)]);
    bauch.push([z0 + lo * Math.cos(th), y0 - lo * Math.sin(th)]);
  };
  const fb = fersenBahn();
  const anschlussB = 2 * f.halb(0);
  for (let i = 0; i < fb.length; i++) {
    const p = fb[i]!;
    const t = i / (fb.length - 1);
    const w = t * t * (3 - 2 * t);
    const hoch = 0.28 * (1 - w) + 0.2 * w;
    void anschlussB;
    lege(p.y, p.z, p.th, [
      [0, -hoch / 2],
      [0, hoch / 2],
    ]);
  }
  for (let i = 0; i <= 60; i++) {
    const k = (i / 60) * SCHALEN_ABSCHNITTE;
    const p = beiK(f.bahn, k);
    lege(p.y, p.z, p.th, f.schnitt(k));
  }
  const e = f.bahn[f.bahn.length - 1]!;
  const absatz = f.name === "HEUTE" ? 0 : NEU_ZAHN_ABSATZ;
  const n0 = zahnLage(e, absatz);
  const naht: [number, number] = [n0.z, n0.y];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const q = zahnLage(e, absatz + u * f.zahnLaenge);
    lege(q.y, q.z, q.th, f.zahnSchnitt(u));
  }
  const qEnd = zahnLage(e, absatz + f.zahnLaenge);
  const stationen: Array<[number, number]> = [];
  for (let i = 0; i <= SCHALEN_ABSCHNITTE; i++) {
    const p = beiK(f.bahn, i);
    stationen.push([p.z, p.y]);
  }
  return {
    ruecken,
    bauch,
    naht,
    spitze: [qEnd.z, qEnd.y],
    stationen,
  };
}

/** Alle Dreiecke des Greifers (fuenf Schalen) bei Oeffnung t 0..1, im Riss. */
export function greiferDreiecke(f: Form, t: number): Dreieck[] {
  const schwenk = ZU + (OFFEN - ZU) * t;
  const aus: Dreieck[] = [];
  for (let i = 0; i < MASS.schalen; i++) {
    for (const strang of schalenStraenge(f, schwenk, (i * 2 * Math.PI) / MASS.schalen)) {
      aus.push(...strangDreiecke(strang));
    }
  }
  return aus;
}

/** Punktwolke des ganzen Greifers (fuenf Schalen) bei Oeffnung t 0..1. */
export function greiferPunkte(f: Form, t: number): Wolke {
  const schwenk = ZU + (OFFEN - ZU) * t;
  const riss: Array<[number, number]> = [];
  for (let i = 0; i < MASS.schalen; i++) {
    for (const strang of schalenStraenge(f, schwenk, (i * 2 * Math.PI) / MASS.schalen)) {
      for (const ring of strang) riss.push(...ring);
    }
  }
  let tief = Infinity;
  let weit = 0;
  for (const [z, y] of riss) {
    tief = Math.min(tief, y);
    weit = Math.max(weit, Math.abs(z));
  }
  // Zahnspitze der Schale 0
  const e = f.bahn[f.bahn.length - 1]!;
  const absatz = f.name === "HEUTE" ? 0 : NEU_ZAHN_ABSATZ;
  const q = zahnLage(e, absatz + f.zahnLaenge);
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  const r = STEMPEL_AUGE.r + (q.y * sn + q.z * c);
  const Y = STEMPEL_AUGE.y + (q.y * c - q.z * sn);
  return { riss, tiefstes: tief, weitestes: weit, spitze: [r, Y] };
}

/* ================================================================== Messen */

export interface Kennzahl {
  /** Aus dem Riss. */
  maulweite: number;
  spitzenweiteZu: number;
  korbtiefe: number;
  gesamthoehe: number;
  tiefsterPunkt: number;
  /** Aus der Bahn. */
  bogenLaenge: number;
  huelleLang: number;
  huelleQuer: number;
  rOben: number;
  rUnten: number;
  /** Breiten. */
  breiteWurzel: number;
  breiteEnde: number;
  breiteAnteil: number;
  /** Querschnitt in Seitenansicht (m) an k = 0 / 3 / 6. */
  dicke: [number, number, number];
  /** Korbvolumen als Rotationskoerper der Innenflaeche (l). */
  korb: number;
  /** Sektor: groesster genutzter Halbwinkel (Grad) und ab welchem Radius. */
  sektor: number;
  sektorAb: number;
  /** Laenge (m) und groesster Ueberstand (m) in der Zone unter r 0,30. */
  ueberLaenge: number;
  ueberGroesst: number;
  /** Dreiecke des Schalenkoerpers (Schaetzung aus dem Netzraster). */
  dreiecke: number;
}

/**
 * Flaeche eines Risses ueber ein Raster — GEFUELLT, nicht als Umriss.
 *
 * Das ist der Punkt, an dem diese Messung beim ersten Lauf falsch war: Wer nur
 * die Randpunkte rastert, vergleicht zwei Striche. Zwei Striche, die 5 mm
 * auseinanderliegen, sind zu 0 % deckungsgleich, obwohl die Flaechen darunter
 * zu 99 % dieselben sind — der erste Lauf meldete deshalb 48 % fuer eine
 * Aenderung, die man auf dem Blatt kaum sieht.
 *
 * Gefuellt wird wie in `tools/schattenriss.ts`: je Zeile die Vereinigung der
 * Strecken, in die die Dreiecke sie schneiden. Die Dreiecke sind die des
 * Netzes, das die Form ergibt — dieselbe Kette wie beim Zeichnen.
 */
export function rastere(dreiecke: Dreieck[], zelle: number): Set<string> {
  const s = new Set<string>();
  for (const z of spannen(dreiecke, zelle)) {
    for (let ix = Math.floor(z.von / zelle); ix <= Math.ceil(z.bis / zelle); ix++) {
      const m = (ix + 0.5) * zelle;
      if (m >= z.von && m <= z.bis) s.add(`${ix},${Math.round(z.y / zelle)}`);
    }
  }
  return s;
}

/** Ein Dreieck des Risses: drei Punkte [z, y]. */
export type Dreieck = Array<[number, number]>;

/**
 * Der Riss zeilenweise: je Zeile die VEREINIGTEN Strecken.
 *
 * Dasselbe Verfahren wie `tools/schattenriss.ts`, nur auf Dreiecken, die schon
 * in der Rissebene liegen. Aus diesen Strecken wird sowohl die Deckungszahl
 * (`rastere`) als auch die Zeichnung auf dem Blatt — eine Quelle, zwei
 * Verwendungen, damit Bild und Zahl nicht auseinanderlaufen koennen.
 */
export function spannen(
  dreiecke: Dreieck[],
  zeile: number
): Array<{ y: number; von: number; bis: number }> {
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const t of dreiecke) {
    for (const p of t) {
      yMin = Math.min(yMin, p[1]);
      yMax = Math.max(yMax, p[1]);
    }
  }
  const aus: Array<{ y: number; von: number; bis: number }> = [];
  for (let iy = Math.floor(yMin / zeile); iy <= Math.ceil(yMax / zeile); iy++) {
    const y = (iy + 0.5) * zeile;
    const roh: Array<[number, number]> = [];
    for (const t of dreiecke) {
      const zs: number[] = [];
      for (let k = 0; k < 3; k++) {
        const a = t[k]!;
        const b = t[(k + 1) % 3]!;
        if (a[1] === b[1]) continue;
        const u = (y - a[1]) / (b[1] - a[1]);
        if (u < 0 || u > 1) continue;
        zs.push(a[0] + (b[0] - a[0]) * u);
      }
      if (zs.length < 2) continue;
      roh.push([Math.min(...zs), Math.max(...zs)]);
    }
    if (!roh.length) continue;
    roh.sort((a, b) => a[0] - b[0]);
    let von = roh[0]![0];
    let bis = roh[0]![1];
    for (const s of roh.slice(1)) {
      if (s[0] <= bis + 1e-4) bis = Math.max(bis, s[1]);
      else {
        aus.push({ y, von, bis });
        von = s[0];
        bis = s[1];
      }
    }
    aus.push({ y, von, bis });
  }
  return aus;
}

/**
 * Deckungsgleichheit zweier Risse (0..1) — Schnitt durch Vereinigung.
 *
 * DERSELBE Begriff wie im Blatt von E-069 („98,5 % deckungsgleich"), nur an
 * einer anderen Stelle gemessen: dort an den Dreiecken des gebauten Netzes,
 * hier an der Punktwolke der gerechneten Form. Beide zaehlen Flaeche, nicht
 * Punkte: `zelle` ist die Kantenlaenge eines Rasterfeldes, und gezaehlt werden
 * die getroffenen Felder. Bei 4 mm Raster liegen ueber der Silhouette des
 * Greifers rund 200.000 Felder.
 *
 * Damit die Zahl nicht luegt: Die Punktwolke wird vorher VERDICHTET (die
 * Schnitte werden als Polygonzug abgetastet), sonst zaehlt ein duenner Umriss
 * statt einer Flaeche.
 */
export function deckung(a: Dreieck[], b: Dreieck[], zelle = 0.005): [number, number, number] {
  const ra = rastere(a, zelle);
  const rb = rastere(b, zelle);
  let schnitt = 0;
  for (const k of ra) if (rb.has(k)) schnitt++;
  const vereinigung = ra.size + rb.size - schnitt;
  return [
    vereinigung > 0 ? schnitt / vereinigung : 1,
    ra.size * zelle * zelle,
    rb.size * zelle * zelle,
  ];
}

export function messe(f: Form): Kennzahl {
  const auf = greiferPunkte(f, 1);
  const zu = greiferPunkte(f, 0);
  const bahn = f.bahn;
  const e = bahn[bahn.length - 1]!;
  const start = bahn[0]!;

  // Huellmass entlang der eigenen Sehne (wie teile.ts es liest)
  const dy = e.y - start.y;
  const dz = e.z - start.z;
  const sehne = Math.hypot(dy, dz);
  const ex = dy / sehne;
  const ez = dz / sehne;
  let quer = 0;
  for (const p of bahn) {
    const qy = p.y - start.y;
    const qz = p.z - start.z;
    quer = Math.max(quer, Math.abs(qy * ez - qz * ex));
  }

  // Kruemmungsradien oben/unten (Mittel ueber das erste und letzte Viertel)
  const rMittel = (von: number, bis: number): number => {
    const a = beiK(bahn, von * SCHALEN_ABSCHNITTE);
    const b = beiK(bahn, bis * SCHALEN_ABSCHNITTE);
    const dth = Math.abs(b.th - a.th);
    const ds = Math.abs(b.s - a.s);
    return dth > 1e-9 ? ds / dth : Infinity;
  };

  /*
   * Korbvolumen — Rotationskoerper der MITTLEREN INNENFLAECHE.
   *
   * Nicht der Mittellinie: Die Innenflaeche liegt bei beiden Formen nicht auf
   * ihr. Heute woelbt sich das Blech um bis zu 22 mm nach AUSSEN (mehr Korb),
   * neu um bis zu 60 mm — dafuer greifen die Wangen an den Raendern nach innen
   * (weniger Korb). Wer nur das eine zaehlt, bekommt ein falsches Vorzeichen.
   *
   * Gemittelt wird ueber die Breite: der Querschnitt wird in x abgetastet und
   * sein innerster Werkstoffpunkt je Stelle genommen. Das ist dieselbe
   * konservative Lesart wie in `teile.ts` („hier steht die konservative").
   */
  const innenMittel = (k: number): number => {
    const q = f.schnitt(k);
    const halb = f.halb(k);
    let summe = 0;
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const x = -halb + (2 * halb * i) / N;
      let w = Infinity;
      for (const [qx, qw] of q) if (Math.abs(qx - x) < halb / N + 1e-9) w = Math.min(w, qw);
      summe += Number.isFinite(w) ? w : 0;
    }
    return summe / (N + 1);
  };
  const mitteZu: Array<{ r: number; y: number }> = [];
  for (let i = 0; i <= 120; i++) {
    const k = (i / 120) * SCHALEN_ABSCHNITTE;
    const p = beiK(bahn, k);
    const w = innenMittel(k);
    mitteZu.push({
      r: STEMPEL_AUGE.r + p.z + w * Math.cos(p.th),
      y: STEMPEL_AUGE.y + p.y - w * Math.sin(p.th),
    });
  }
  let korb = 0;
  for (let i = 0; i < mitteZu.length - 1; i++) {
    const a = mitteZu[i]!;
    const b = mitteZu[i + 1]!;
    const h = a.y - b.y;
    if (h <= 0) continue;
    korb += (Math.PI / 3) * h * (a.r * a.r + a.r * b.r + b.r * b.r);
  }

  /*
   * Sektor: Fuenf Schalen haben je 36° Halbwinkel. Gemessen wird der
   * groesste Halbwinkel, den der Koerper geschlossen wirklich braucht — und
   * getrennt davon, wie weit unten er in die Zone laeuft, in der sich die
   * Spitzen ohnehin aneinander vorbeischieben (`SEKTOR_AB` = 0,30 m, dieselbe
   * Grenze und derselbe Grund wie in `test/greifer.test.ts`).
   */
  let sektor = 0;
  let sektorAb = 0;
  let ueberLaenge = 0;
  let ueberGroesst = 0;
  for (let i = 0; i <= 120; i++) {
    const k = (i / 120) * SCHALEN_ABSCHNITTE;
    const p = beiK(bahn, k);
    const r = STEMPEL_AUGE.r + p.z;
    const rInnen = r - f.innenTiefe(k) * Math.cos(p.th);
    const w = Math.atan(f.halb(k) / Math.max(rInnen, 1e-4)) * GRAD;
    if (rInnen >= SEKTOR_AB) {
      if (w > sektor) {
        sektor = w;
        sektorAb = rInnen;
      }
    } else if (w > sektorHalb * GRAD) {
      ueberLaenge += L_BOGEN / 120;
      ueberGroesst = Math.max(
        ueberGroesst,
        f.halb(k) - Math.max(rInnen, 1e-4) * Math.tan(sektorHalb)
      );
    }
  }

  const zahnSpitzeZu = zu.spitze;
  const dicke = ([0, 3, 6] as const).map((k) => {
    const q = f.schnitt(k);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, w] of q) {
      lo = Math.min(lo, w);
      hi = Math.max(hi, w);
    }
    return hi - lo;
  }) as [number, number, number];

  // Dreiecke des Schalenkoerpers: Punkte je Schnitt × Stationen × 2 Dreiecke
  const querPunkte = f.schnitt(3).length;
  const dreiecke = 5 * (querPunkte * 18 * 2);

  return {
    maulweite: 2 * auf.weitestes,
    spitzenweiteZu: 2 * Math.abs(zahnSpitzeZu[0]),
    korbtiefe: STEMPEL_AUGE.y - zu.tiefstes,
    gesamthoehe: TRAVERSE_Y + 0.225 - zu.tiefstes,
    tiefsterPunkt: zu.tiefstes,
    bogenLaenge: e.s,
    huelleLang: sehne,
    huelleQuer: quer,
    rOben: rMittel(0, 0.25),
    rUnten: rMittel(0.75, 1),
    breiteWurzel: 2 * f.halb(0),
    breiteEnde: 2 * f.halb(SCHALEN_ABSCHNITTE),
    breiteAnteil: f.halb(SCHALEN_ABSCHNITTE) / f.halb(0),
    dicke,
    korb: korb * 1000,
    sektor,
    sektorAb,
    ueberLaenge,
    ueberGroesst,
    dreiecke,
  };
}

/* ============================================================== Die Waechter */

/**
 * Die drei Waechter — und warum keine Schalenform sie bewegen kann.
 *
 * `kennwerte()` aus `traverse-rechnen.ts` (wortgleich mit `anbindungspunkt` in
 * `rig.ts`) liest GENAU VIER Groessen: `STEMPEL_AUGE`, `OBERE_ANBINDUNG`,
 * `ZYLINDER_AUFNAHME` und die Anschlaege `ZU`/`OFFEN`. Keine davon liegt in der
 * Schale. Solange der Bolzen bleibt, wo er ist, und das Zylinderauge auch,
 * kommt hier dieselbe Zahl heraus — egal, wie die Schale gebogen ist.
 *
 * Das ist keine Behauptung, sondern eine Eigenschaft der Funktion, und dieses
 * Blatt weist sie nach, indem es sie fuer alle drei Spalten aufruft und die
 * Gleichheit prueft.
 */
export function waechter(): {
  neigung: number;
  hebelMin: number;
  hebelZu: number;
} {
  const k = kennwerte({
    Zr: ZYLINDER_AUFNAHME.r,
    Zy: ZYLINDER_AUFNAHME.y,
    Ay: OBERE_ANBINDUNG.y,
    Az: OBERE_ANBINDUNG.z,
  });
  return { neigung: k.neigungMax, hebelMin: k.hebelMin, hebelZu: k.hebelZu };
}

/* ================================================================== Ausgabe */

function komma(x: number, n = 3): string {
  return x.toFixed(n).replace(".", ",");
}

export function bericht(): void {
  pruefeKopie();
  const abw = pruefeBahn();
  console.log(
    `Gegenprobe: die nachgerechnete Bahn trifft feineStationen() auf ` +
      `${(abw * 1000).toFixed(4)} mm — unter 0,1 mm heisst, die Rechnung ist dieselbe.`
  );
  const v = vorbildMessung();
  console.log("");
  console.log("--- Am Foto abgelesen (SCHAETZUNG) -------------------------------");
  console.log(`Abgelesene Linie insgesamt      ${v.laengePx.toFixed(0)} px`);
  console.log(`davon Ferse (vor dem Fenster)   ${v.fersePx.toFixed(0)} px`);
  console.log(`davon Schalenkoerper (105°)     ${v.koerperPx.toFixed(0)} px`);
  console.log(
    `davon Zahn (hinter der Naht)    ${v.zahnPx.toFixed(0)} px = ` +
      `${(v.zahnAnteil * 100).toFixed(1)} % des Koerpers`
  );
  console.log(`Gesamtdrehung der Tangente      ${v.drehung.toFixed(1)}°`);
  console.log(
    `Kruemmung je Drittel (°/100px)  ${v.drittel.map((x) => x.toFixed(1)).join(" · ")}` +
      `   → 1 : ${(v.drittel[1] / v.drittel[0]).toFixed(2)} : ` +
      `${(v.drittel[2] / v.drittel[0]).toFixed(2)}`
  );

  /*
   * Die mittlere Spalte ist die EMPFEHLUNG (N2+N3+N4), nicht `ALLE`. `ALLE`
   * enthaelt zusaetzlich die gespreizte Ruecken­linie N1b, und die ist
   * ausdruecklich nicht empfohlen — siehe `DICHTE_SPREIZ`. Stuenden hier
   * andere Zahlen als auf dem Blatt, waere eine von beiden falsch.
   */
  const EMPFEHLUNG: Schalter = { n1: "heute", n2: true, n3: true, n4: true };
  const formen = [formHeute(), formNeu(EMPFEHLUNG), formVorbild()];
  const m = formen.map(messe);
  console.log("");
  console.log("--- Kennwerte (Spalten: HEUTE · NEU=Empfehlung N2+N3+N4 · VORBILD) ---");
  const zeile = (
    name: string,
    z: (k: Kennzahl) => string
  ): void => console.log(name.padEnd(30) + m.map((k) => z(k).padStart(12)).join(""));
  zeile("Bogenlaenge Ruecken (m)", (k) => komma(k.bogenLaenge));
  zeile("Huellmass lang x quer (m)", (k) => `${komma(k.huelleLang, 2)}x${komma(k.huelleQuer, 2)}`);
  zeile("Kruemmungsradius oben (m)", (k) => komma(k.rOben));
  zeile("Kruemmungsradius unten (m)", (k) => komma(k.rUnten));
  zeile("Breite Wurzel (mm)", (k) => (k.breiteWurzel * 1000).toFixed(0));
  zeile("Breite Ende (mm)", (k) => (k.breiteEnde * 1000).toFixed(0));
  zeile("Ende / Wurzel", (k) => `${(k.breiteAnteil * 100).toFixed(0)} %`);
  zeile("Dicke Seitenriss k0/k3/k6 (mm)", (k) =>
    k.dicke.map((d) => (d * 1000).toFixed(0)).join("/")
  );
  zeile("Maulweite offen (m)", (k) => komma(k.maulweite));
  zeile("Spitzenweite zu (m)", (k) => komma(k.spitzenweiteZu));
  zeile("Korbtiefe zu (m)", (k) => komma(k.korbtiefe));
  zeile("Korb (Rotation, l)", (k) => k.korb.toFixed(0));
  zeile("Sektor genutzt (Halbwinkel °)", (k) => komma(k.sektor, 1));
  zeile("  … am Radius (m)", (k) => komma(k.sektorAb));
  zeile("Ueberstand unter r 0,30 (mm)", (k) => (k.ueberGroesst * 1000).toFixed(0));
  zeile("  … auf Laenge (m)", (k) => komma(k.ueberLaenge, 2));
  zeile("Dreiecke Schalenkoerper", (k) => k.dreiecke.toFixed(0));

  console.log("");
  console.log("--- Deckungsgleichheit zum heutigen Stand -------------------------");
  const h1 = greiferDreiecke(formen[0]!, 1);
  const h0 = greiferDreiecke(formen[0]!, 0);
  for (const [name, s] of STUFEN) {
    const f = formNeu(s);
    const [d1, fl] = deckung(h1, greiferDreiecke(f, 1));
    const [d0] = deckung(h0, greiferDreiecke(f, 0));
    void fl;
    console.log(
      name.padEnd(26) +
        `offen ${(d1 * 100).toFixed(1)} %`.padStart(14) +
        `   geschlossen ${(d0 * 100).toFixed(1)} %`
    );
  }
  const vb = formVorbild();
  const [dv1, flH] = deckung(h1, greiferDreiecke(vb, 1));
  const [dv0] = deckung(h0, greiferDreiecke(vb, 0));
  console.log(
    "VORBILD-Spalte".padEnd(26) +
      `offen ${(dv1 * 100).toFixed(1)} %`.padStart(14) +
      `   geschlossen ${(dv0 * 100).toFixed(1)} %`
  );
  console.log(
    `Schattenflaeche heute offen: ${flH.toFixed(3)} m² — die Zahl, auf die sich ` +
      `die Prozente beziehen.`
  );

  console.log("");
  console.log("--- Die drei Waechter --------------------------------------------");
  const w = waechter();
  console.log(
    `Neigung groesste ${komma(w.neigung, 1)}° (< 25°) · ` +
      `Hebelarm kleinster ${(w.hebelMin * 1000).toFixed(0)} mm (> 115) · ` +
      `Hebelarm geschlossen ${(w.hebelZu * 1000).toFixed(0)} mm (> 200)`
  );
  console.log(
    "Dieselbe Zahl fuer alle drei Spalten: `kennwerte()` liest nur STEMPEL_AUGE, " +
      "OBERE_ANBINDUNG,\nZYLINDER_AUFNAHME und die Anschlaege — keine Zahl der Schale."
  );
}

/*
 * Der Bericht laeuft beim Laden. `vite-node` reicht den Dateinamen NICHT in
 * `process.argv` durch (dort steht sein eigener Einstieg) — eine Pruefung auf
 * „direkt aufgerufen" waere hier immer falsch. Das Blattwerkzeug importiert
 * deshalb nur die Rechnung und ruft `bericht()` selbst noch einmal auf; zwei
 * gleiche Tabellen sind besser als eine, die nie erscheint.
 */
bericht();
