/**
 * Mehrschalengreifer, fünf Schalen, halboffene Bauform (HO) — die Maße.
 *
 * Eine Datei, eine Wahrheit. Modell, Gelenke, Zylinder, Kollisionsprüfung und
 * GLB-Export leiten alles hieraus ab; nichts davon hat eigene Zahlen.
 *
 * Vorlage ist der SENNEBOGEN MG4.1 (Prospekt, Seite 2: der offene Greifer
 * links). Die Zahlen stammen aber nicht aus dem Bild, sondern aus dem
 * Datenblatt der MG4.1-800-HO5, und zwar aus allen sechs Maßen gleichzeitig:
 *
 *   ØC = 1514 mm   Durchmesser geschlossen
 *   ØD = 2409 mm   größter Durchmesser offen
 *   d  = 2225 mm   Spitzenweite offen
 *   A  = 2363 mm   Gesamthöhe offen
 *   B  = 1966 mm   Gesamthöhe geschlossen
 *
 * Warum alle sechs: Mit zweien ist die Aufgabe unterbestimmt, und es kam ein
 * Haken von 170° heraus, der sich beim Öffnen fast waagerecht aufklappte.
 * Gegen alle sechs bleibt genau ein Bogen übrig — ein gleichmäßiger von 86°.
 *
 * Und A gehört zur OFFENEN Stellung, B zur geschlossenen. Andersherum geht es
 * geometrisch gar nicht: Geschlossen müssen die Spitzen den Bolzenkreis nach
 * innen überbrücken, und genau dieser Weg fehlt ihnen nach unten. Eine Faust
 * ist kürzer als eine ausgestreckte Hand.
 */

/**
 * Maßstab gegenüber dem Datenblatt.
 *
 * Alle Zahlen unten stehen so, wie sie am echten Gerät gemessen sind — das
 * Datenblatt bleibt damit nachprüfbar. Größer wird der Greifer an genau einer
 * Stelle, hier. Ein Viertel darüber, weil im Spiel Autos, Tanks und
 * Motorblöcke dichter beieinanderliegen als auf einem echten Platz.
 */
export const MASSSTAB = 1.25;

/**
 * Zahl der Schalen.
 *
 * Die einzige Stelle, an der sie steht. Alles Weitere rechnet mit: der
 * Sektor je Schale (360°/n), ihre Breite, die Eckenzahl des Kopfes, die
 * Zahl der Zylinder und der geschlossene Anschlag.
 *
 * Fünf, wie beim Vorbild MG4.1-800-HO5. Zwischendurch waren es vier; der
 * Unterschied kostet genau diese Zeile.
 */
export const SCHALEN = 5;

/** Radius des Bolzenkreises, auf dem die Schalen am Kopf hängen (m). */
export const BOLZENKREIS = 0.731 * MASSSTAB;

/** Höhe des Kopfes über dem Bolzenkreis (m) — Adapter, Drehwerk, Mittelteil. */
export const KOPFHOEHE = 1.1 * MASSSTAB;

/** Stationen je Schale — so fein, dass der Bogen rund wirkt, und nicht feiner. */
export const STATIONEN = 8;

/** Länge eines Schalenabschnitts (m). */
export const ABSCHNITT = 0.1719 * MASSSTAB;

/** Gesamtbogen einer Schale vom Drehbolzen bis zur Spitze (rad) = 86,2°. */
export const BOGEN = 1.5041;

/** Krümmung je Abschnitt (rad) — gleichmäßig, also ein Kreisbogen. */
export const KRUEMMUNG = BOGEN / (STATIONEN - 1);

/** Kumulierte Krümmung bis Station `k`. */
export const KRUEMMUNG_KUM: number[] = Array.from(
  { length: STATIONEN + 1 },
  (_, k) => k * KRUEMMUNG
);

/**
 * Schwenkwinkel der Schalen (rad), geschlossen und ganz offen.
 *
 * Geschlossen sind es 8°, nicht 4,6° wie aus dem Datenblatt zurückgerechnet.
 *
 * Der Grund ist eine harte Grenze: Die Spitzen dürfen die Drehachse nicht
 * überfahren. Täte eine es, liefe sie auf die Seite ihres Gegenübers und beide
 * steckten ineinander. Sie bleiben also kurz davor stehen, und in der Mitte
 * bleibt ein Loch von 8 cm — das hat ein echter Greifer auch.
 *
 * Wer die Schalenzahl ändert, muss diesen Wert nachziehen: `test/greifer.test.ts`
 * rechnet nach, ob die Spitzen noch vor der Achse halten.
 */
export const ZU = 0.14;
export const OFFEN = 1.0532;

/**
 * Kleinster Spitzenradius, den der geschlossene Anschlag einhalten muss (m).
 *
 * Alles andere ergibt sich von selbst: `halbbreite()` deckelt die Schalenbreite
 * auf `r · sin(Halbwinkel)`, und der Halbwinkel ist kleiner als der halbe
 * Sektor. Solange der Radius positiv bleibt, kann keine Schale in den Sektor
 * der Nachbarin geraten — auch die Spitze nicht, denn sie wird aus derselben
 * Breitenfunktion gebaut.
 */
export const SPITZEN_FREIGANG = 0.03 * MASSSTAB;

/**
 * Wie viel von ihrem Kreisabschnitt eine Schale ausfüllt.
 *
 * Bei fünf Schalen hat jede 72°. Sie füllt davon 68 %, also 49° — das ist der
 * Unterschied zwischen der halboffenen Bauform (HO) und der geschlossenen (G).
 * „Ist das Material sperrig und großformatiger, empfiehlt sich der Einsatz
 * zunehmend geöffneter Schalen" (Prospekt, Seite 3). Auf dem Platz hier liegen
 * Karosserien und Tanks, also halboffen.
 *
 * Die Lücken sind auch der Grund, warum der Greifer als Klaue gelesen wird und
 * nicht als Topf: Nicht die Krümmung macht das aus, sondern die Luft dazwischen.
 */
export const FUELLGRAD = 0.68;

/** Halber Öffnungswinkel einer Schale (rad). */
export const SCHALE_HALBWINKEL = ((Math.PI * 2) / SCHALEN / 2) * FUELLGRAD;

/** Größte halbe Breite einer Schale (m) — an der breitesten Station. */
export const SCHALE_HALBBREITE = 0.56 * MASSSTAB;

/**
 * Breitenverlauf über die Stationen.
 *
 * Schmal am Lagerbock, breit im ersten Drittel, dann auslaufend zur Spitze.
 * Das ist die Blattform der Vorlage; eine Schale gleicher Breite sieht aus wie
 * ein Rohrsegment.
 */
export const BREITENPROFIL = [0.5, 0.84, 1.0, 1.0, 0.94, 0.83, 0.68, 0.48, 0.26];

/** Blechstärke der Schalenhaut (m). */
export const HAUT = 0.075 * MASSSTAB;
/** Stärke der Seitenwangen (m) — sie tragen, die Haut füllt nur. */
export const WANGE = 0.085 * MASSSTAB;

/**
 * Anlenkung der Zylinder, abgetastet statt gesetzt.
 *
 * Drei Bedingungen gleichzeitig — sie stehen in `test/greifer.test.ts` und
 * werden dort auch geprüft:
 *
 *   1. Der Zylinder muss frei NEBEN dem Mittelteil stehen, sonst sieht man ihn
 *      nicht.
 *   2. Er muss steil stehen (hier 12–14°), nicht quer über dem Kopf liegen.
 *   3. Nichts an der Anlenkung darf über die geschlossene Schalenkontur hinaus.
 *
 * Ergebnis: 0,61 m eingefahren, 0,85 m ausgefahren, Hub 24 cm. Der Zylinder
 * zieht die Schale zu — beim Schließen fährt er ein, wie im Bewegungsablauf
 * der Vorlage.
 */
/** Angriffspunkt der Kolbenstange, im Frame des Schalengelenks (m). */
export const LASCHE = { y: 0.18, z: -0.18 };
/** Aufnahme des Zylinders am Kopf: Radius und Höhe, als Anteil der Kopfmaße. */
export const ZYLINDER_AUFNAHME = { r: 0.919, y: -0.451 };
/** Länge des Zylinderrohrs (m) — kürzer als der eingefahrene Abstand. */
export const ROHRLAENGE = 0.55;

/** Ein Punkt auf der Mittellinie einer Schale, im Frame der ganzen Spinne. */
export interface Station {
  /** Abstand von der Drehachse (m) */
  r: number;
  /** Höhe unter dem Kardangelenk (m, negativ) */
  y: number;
  /** Winkel der Schalenrichtung gegen die Senkrechte (rad) */
  neigung: number;
}

/**
 * Die Mittellinie einer Schale bei gegebenem Schwenkwinkel.
 *
 * Station 0 ist der Drehbolzen, Station `STATIONEN` die Spitze.
 */
export function mittellinie(schwenk: number): Station[] {
  const out: Station[] = [{ r: BOLZENKREIS, y: -KOPFHOEHE, neigung: -schwenk }];
  let r = BOLZENKREIS;
  let y = -KOPFHOEHE;
  for (let k = 0; k < STATIONEN; k++) {
    const th = (KRUEMMUNG_KUM[k] ?? 0) - schwenk;
    y -= ABSCHNITT * Math.cos(th);
    r -= ABSCHNITT * Math.sin(th);
    out.push({ r, y, neigung: (KRUEMMUNG_KUM[k + 1] ?? 0) - schwenk });
  }
  return out;
}

/** Halbe Breite der Schale an Station `k` bei gegebenem Radius (m). */
export function halbbreite(k: number, r: number): number {
  const nachProfil = SCHALE_HALBBREITE * (BREITENPROFIL[k] ?? 0.3);
  const nachWinkel = Math.max(r, 0.04) * Math.sin(SCHALE_HALBWINKEL);
  return Math.min(nachProfil, nachWinkel);
}

/** Größte Ausladung des Greifers bei gegebenem Schwenkwinkel (Durchmesser, m). */
export function durchmesser(schwenk: number): number {
  return 2 * Math.max(...mittellinie(schwenk).map((s) => s.r));
}

/** Spitzenweite bei gegebenem Schwenkwinkel (Durchmesser, m). */
export function spitzenweite(schwenk: number): number {
  const bahn = mittellinie(schwenk);
  return 2 * (bahn[bahn.length - 1]?.r ?? 0);
}

/** Tiefster Punkt der Schalen unter dem Kardangelenk (m). */
export function tiefe(schwenk: number): number {
  return -Math.min(...mittellinie(schwenk).map((s) => s.y));
}

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return ZU + (OFFEN - ZU) * t;
}
