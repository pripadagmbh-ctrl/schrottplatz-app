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
 * Der Greiferkopf ist ein Gussblock mit gefrästen Taschen, kein Vollklotz.
 *
 * Befund 13.09.2026: „der Greiferkopf ist kein Vollklotz, wo die Hülsen
 * angeschweißt bzw. die Hydraulikzylinder außen angebracht sind. Die Zylinder
 * laufen nach innen, weil es entsprechende Fräsungen für die Zylinder gibt."
 *
 * Das stimmt und war vorher falsch: Die Zylinder hingen an Ohren außen am
 * Kegelstumpf. Auf dem Prospektfoto sitzt jeder Zylinder in einer eigenen
 * senkrechten Tasche; zwischen den Taschen stehen die Rippen. Deshalb wirkt der
 * Kopf von oben gezahnt und nicht rund.
 *
 * Der Unterschied ist nicht kosmetisch. Versenkt man den Zylinder, rückt seine
 * Achse von 0,92 auf 0,72 Bolzenkreisradien nach innen, und damit ändert sich
 * die ganze Anlenkung — sie wurde neu abgetastet (siehe unten).
 */
/** Radius, auf dem die Mitte einer Tasche liegt (Anteil am Bolzenkreis). */
export const TASCHE_MITTE = 0.662;
/**
 * Radius der Fräsung selbst (Anteil am Bolzenkreis).
 *
 * Nicht frei gewählt: Sie muss das Rohr über die ganze Schwenkbewegung fassen
 * (bei 0,21 fehlten am unteren Ende 1,2 mm — `test/greifer.test.ts` hat es
 * gefangen) und darf zugleich den Kern des Kopfes nicht anschneiden.
 * Dazwischen bleibt ein schmales Fenster, und 0,23 liegt darin.
 */
export const TASCHE_RADIUS = 0.225;
/** Kern des Kopfes — so weit darf keine Tasche hineinreichen. */
export const KOPF_KERN = 0.4;
/**
 * Außenkontur des Kopfes über die Höhe (Anteil am Bolzenkreis).
 *
 * Drei Stützstellen, weil der Kopf zwei Teile ist, die aus einem Stück gegossen
 * sind: oben der Block mit den Taschen, unten der Zapfen, der nach außen
 * aufweitet und an seinem untersten Ende die Lagerböcke der Schalen trägt.
 *
 * Genau das zeigt das Foto von unten (13.09.2026): „man sieht da auch gut, wo
 * die Zähne befestigt sind, am untersten Ende vom Zapfen." Vorher saßen die
 * Lagerböcke am Rand des Blocks, und der Zapfen hing als Stummel darunter,
 * ohne Aufgabe.
 */
export const KONTUR_OBEN = 0.88;
export const KONTUR_BAUCH = 0.94;
export const KONTUR_UNTEN = 0.9;
/** Auf welcher Höhe der Zapfen am dicksten ist (Anteil der Kopfhöhe). */
export const KONTUR_BAUCH_Y = -0.85;
/** Oberkante des Kopfes unter dem Adapter (Anteil der Kopfhöhe). */
export const KOPF_OBERKANTE = -0.28;

/**
 * Anlenkung der Zylinder — ausgelegt auf die SCHLIESSKRAFT.
 *
 * Ansage 13.09.2026: „die Kraft wird für das Schließen benötigt, nicht das
 * Öffnen." Das war ein echter Befund. Nachgerechnet lag das Schließmoment
 * vorher bei 57 % des Öffnungsmoments — genau verkehrt herum, aus zwei
 * Gründen gleichzeitig:
 *
 *   - Geschlossen wird durch EINFAHREN, und einfahrend drückt der Zylinder nur
 *     auf die Ringfläche: rund 84 % der Kolbenfläche bei dieser Stange.
 *   - Der Hebelarm am Drehbolzen war geschlossen am KLEINSTEN (0,26 m gegen
 *     0,35 m offen). Die Kraft fehlte also dort, wo sie gebraucht wird.
 *
 * Am Einfahren lässt sich nichts ändern. Bei versenkten Zylindern ist es
 * geometrisch zwingend: Damit Ausfahren schließt, müsste die Lasche nach außen
 * über die geschlossene Schalenkontur hinausstehen (abgetastet: bis 1,4
 * Bolzenkreisradien) — Hörner, die es an der Maschine nicht gibt. Auf den Fotos
 * ist es auch genau so: offen stehen die Kolbenstangen weit heraus.
 *
 * Am Hebelarm dagegen sehr wohl. Die Lasche zeigt jetzt als Ausleger nach
 * INNEN statt nach oben. Damit steht der Zylinder geschlossen fast senkrecht
 * auf ihr, und der Hebelarm ist dort am größten:
 *
 *   Öffnung   0,0    0,25   0,5    0,75   1,0
 *   Hebelarm  0,38   0,34   0,30   0,27   0,24  m
 *
 * Schließmoment zu Öffnungsmoment: 1,30. Die Kraft liegt jetzt dort, wo
 * zugegriffen wird. `test/greifer.test.ts` rechnet das nach, damit es dabei
 * bleibt.
 */
/** Angriffspunkt der Kolbenstange, im Frame des Schalengelenks (m). */
export const LASCHE = { y: -0.04, z: -0.38 };
/** Aufnahme des Zylinders in der Tasche: Radius und Höhe, als Anteil der Kopfmaße. */
export const ZYLINDER_AUFNAHME = { r: 0.61, y: -0.45 };

/**
 * Außendurchmesser des Zylinderrohrs (m).
 *
 * Am 12.09.2026 auf 30 cm gesetzt, weil dünne Zylinder im Bild untergingen.
 * Das war richtig, solange sie außen am Kopf hingen — versenkt in einer Tasche
 * hat es sich umgedreht: Ein 30-cm-Rohr zwingt die Fräsung nach außen und den
 * Kopf auf 1,81 m Durchmesser, fast so breit wie der geschlossene Greifer.
 * Mit 24 cm — der Größenordnung am echten Gerät — bleiben es 1,70 m, und in
 * der Nische sieht man den Zylinder trotzdem.
 */
export const ZYLINDER_RADIUS = 0.095 * MASSSTAB;
/** Länge des Zylinderrohrs (m) — kürzer als der eingefahrene Abstand. */
export const ROHRLAENGE = 0.68;

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

/* ------------------------------------------------------- Kontur des Kopfes */

/**
 * Halbe Winkelweite einer Tasche (rad).
 *
 * Eine Fräsung vom Radius `TASCHE_RADIUS`, deren Mitte auf `TASCHE_MITTE`
 * liegt, ist von der Drehachse aus unter diesem Winkel zu sehen. Bei fünf
 * Schalen füllt sie damit 34° von 72° — der Rest ist Rippe. Genau dieses
 * Verhältnis zeigt die Vorlage.
 */
export const TASCHE_HALBWINKEL = Math.asin(TASCHE_RADIUS / TASCHE_MITTE);

/** Außenradius des Kopfes auf Höhe `y` (m), ohne die Taschen. */
export function rippenRadius(y: number): number {
  const oben = KOPF_OBERKANTE * KOPFHOEHE;
  const bauch = KONTUR_BAUCH_Y * KOPFHOEHE;
  if (y >= bauch) {
    const t = Math.min(1, Math.max(0, (y - oben) / (bauch - oben)));
    return (KONTUR_OBEN + (KONTUR_BAUCH - KONTUR_OBEN) * t) * BOLZENKREIS;
  }
  const t = Math.min(1, Math.max(0, (y - bauch) / (-KOPFHOEHE - bauch)));
  return (KONTUR_BAUCH + (KONTUR_UNTEN - KONTUR_BAUCH) * t) * BOLZENKREIS;
}

/**
 * Wie tief die Tasche auf Höhe `y` noch eingefräst ist, 1 bis 0.
 *
 * Eine Fräsung hat einen Grund. Nach unten läuft sie aus, und darunter ist der
 * Zapfen wieder voller Guss — sonst hinge er an nichts.
 */
export function taschenTiefe(y: number): number {
  const von = -0.92 * KOPFHOEHE;
  const bis = -1.0 * KOPFHOEHE;
  if (y >= von) return 1;
  if (y <= bis) return 0;
  return (y - bis) / (von - bis);
}

/**
 * Radius der Kopfkontur unter dem Winkel `theta`, auf Höhe `y` (m).
 *
 * Außen die Rippe, und wo eine Tasche liegt, deren Grund. Gerechnet wird das
 * als Schnitt eines Strahls aus der Drehachse mit dem Fräserkreis: Liegt der
 * Strahl innerhalb von `TASCHE_HALBWINKEL`, trifft er den Kreis, und die
 * nähere der beiden Lösungen ist die Wand der Tasche.
 */
export function kopfKontur(theta: number, y: number): number {
  const rippe = rippenRadius(y);
  const d = TASCHE_MITTE * BOLZENKREIS;
  const rn = TASCHE_RADIUS * BOLZENKREIS;
  const tief = taschenTiefe(y);
  if (tief <= 0) return rippe;
  let naechste = rippe;
  for (let i = 0; i < SCHALEN; i++) {
    let ab = theta - (i / SCHALEN) * Math.PI * 2;
    while (ab > Math.PI) ab -= 2 * Math.PI;
    while (ab < -Math.PI) ab += 2 * Math.PI;
    const wurzel = rn * rn - d * d * Math.sin(ab) * Math.sin(ab);
    if (wurzel <= 0) continue;
    const t = d * Math.cos(ab) - Math.sqrt(wurzel);
    if (t > 0 && t < naechste) naechste = t;
  }
  return Math.max(KOPF_KERN * BOLZENKREIS, rippe + (naechste - rippe) * tief);
}
