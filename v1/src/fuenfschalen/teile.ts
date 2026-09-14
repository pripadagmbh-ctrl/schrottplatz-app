/**
 * Aufbau der Schale — aus der Zeichnung `zahngreifer` vom 13.09.2026.
 *
 * Bis dahin war jede Fassung aus Fotos geraten. Die Zeichnung liefert die
 * Bauweise mit Massen, und zwei davon korrigieren mich:
 *
 *   Der Zahn VERJUENGT sich stark — 110 x 75 mm an der Basis auf 22 x 14 mm
 *   an der Spitze. Meine letzte Fassung hatte ihn konstant.
 *
 *   Die Seitenwangen stehen AUSSEN, auf der konvexen Seite, nicht im Trog.
 *   Innen bleibt das Blech glatt; dort laeuft das Material.
 *
 * Querschnitt C-C der Zeichnung: Schalenblech 200 mm breit und 15 mm dick,
 * Wange 20 mm, Verstaerkung 110 x 25. Ein Schalenende von 200 mm traegt also
 * genau einen Zahn von 110 mm.
 */
/**
 * Blechstaerke — 45 mm, nicht 15.
 *
 * Die Herstellerzeichnung nennt 15 mm, aber fuer eine Schale von 500 mm
 * Bogenlaenge. Unsere misst 1380 mm; auf sie umgelegt waere das ein Blatt.
 * Ansage dazu: „die Masstaebe muessen nicht richtig sein, es sollte nur das
 * Grundprinzip darstellen" und, zur Skizze, „dick gegossenes Eisen".
 *
 * Vorher kam die ganze Tiefe des Zinkens aus der Strebe. Wo man die von der
 * Seite sieht, blieb nur das duenne Blech uebrig — der Zinken las sich dort
 * als Blatt statt als Guss.
 */
const BLECH = 0.045;
/**
 * Verjuengung — EIN Faktor fuer alles.
 *
 * Handskizze vom 13.09.2026 („Zinken / Zahn"), abgewickelt gezeichnet: Der
 * ganze Zinken ist ein Stueck, laeuft vom Kopf mit der Bohrung durchgehend
 * schmaler zu und endet in einer schmalen, runden Spitze. Blech und
 * Verstaerkung verjuengen sich dabei MIT — „Kruemmung dazu und dann sollte die
 * Sichelform durchgaengig proportional sein".
 *
 * Deshalb hat alles denselben Faktor: Blechbreite, Strebenbreite,
 * Strebenhoehe. Vorher lief die Breite auf 200 mm aus und darauf sass ein
 * eigener, breiter Zahn — das war ein Ende, keine Spitze.
 *
 * Der Endwert ist nicht gewaehlt, er ist der ZAHN: Die Positionsliste nennt
 * fuer die Greiferspitze 120 mm Breite, und der Zahn sitzt buendig auf dem
 * Schalenende (`baueGreiferspitze` nimmt seine Basis aus `schalenHalbbreite`).
 * 0,30 mal 400 mm sind genau diese 120 mm.
 *
 * Vorher stand hier 0,21 — 84 mm. Die Zahl kam aus der Sektorgrenze, und zwar
 * aus ihr an der falschen Stelle: gemessen wurde sie im GESCHLOSSENEN Zustand,
 * wo die Bahn an der Spitze nur 6,8 cm von der Drehachse steht. Dort laufen
 * fuenf Spitzen ohnehin ineinander — genau die Zone, die der Sektortest der
 * gespielten Sichelkralle ausnimmt (`SEKTOR_AB`). Gemessen ergab das einen
 * Zahn von 72 mm Breite: eine Nadel statt des kurzen breiten Keils, den das
 * Vorbild angeschraubt hat. Ansage 14.09.2026: „die Zacken sind spitzer als
 * beim Original".
 */
function verjuengung(k: number): number {
  return 1 - 0.7 * (Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k)) / SCHALEN_ABSCHNITTE) ** 1.3;
}

/**
 * Die Verstaerkung — der Streifen unter dem Zahn.
 *
 * Erklaerung dazu (13.09.2026): „Sie hat zwei Aufgaben. Erstens verteilt sie
 * die Punktlast: der Zahn drueckt mit der gesamten Baggerkraft auf eine
 * Flaeche von wenigen Quadratzentimetern, und ein 15-mm-Blech wuerde dort
 * einfach einreissen. Zweitens ist sie das Opferteil — der Zahn wird
 * abgeschraubt und ersetzt, wenn er runter ist, die Verstaerkung wird
 * irgendwann abgebrannt und neu aufgeschweisst. Das Schalenblech selbst soll
 * nie angefasst werden muessen."
 */
/**
 * Die Strebe — der zweite Koerper des Gussteils.
 *
 * Ansage 13.09.2026: „nur musst du dir zwei Koerper vorstellen, die als eins
 * gegossen wurden sind. Die Schalen, welche mit ihrer Form und Kruemmung fein
 * sind und die Innenflaeche der Spinne darstellen, und eine zentrierte Strebe,
 * die mittig auf der Schale liegt und die Aussenkanten der Schale nicht
 * erreicht. Nur ist diese gegossene Strebe oben von Form/Dicke gut, nur sie
 * flacht zu schnell ab, was diese duenne Form in der Mitte ergibt. Sie wird in
 * der Tat schmaeler, aber von oben nach unten durchgaengig und wird auch unten
 * nie ganz duenn, dennoch unten schmaler als oben und gleichmaessig schmaler
 * werdend."
 *
 * Mein Fehler war die LAENGE: Die Verstaerkung lief nur ueber die letzten
 * 300 mm, also knapp ein Fuenftel der Schale. Dazwischen blieb nur das
 * 15-mm-Blech — genau die duenne Mitte, die im Bild zu sehen war.
 *
 * Jetzt laeuft sie durch, von Station 0 bis zur Spitze, und verjuengt sich
 * gleichmaessig. Ihr unteres Ende hat den Querschnitt der Zahnbasis
 * (110 x 75 mm), damit der Zahn buendig darauf sitzt — das ist die
 * „Verstaerkung" der Zeichnung, nur als Ende eines durchgehenden Koerpers
 * statt als eigenes Stueck.
 */
const STREBE_B_OBEN = 0.22;
const STREBE_H_OBEN = 0.13;
/**
 * Hoehe der Strebe an der Spitze — nur noch fuer den Sektordeckel gebraucht.
 *
 * Als Funktion, nicht als Konstante: Sie haengt an `verjuengung`, und die
 * braucht `SCHALEN_ABSCHNITTE`, das erst weiter unten steht. Als Konstante
 * gelesen waere das ein Zugriff vor der Deklaration.
 */
function verstVorn(): number {
  return STREBE_H_OBEN * verjuengung(SCHALEN_ABSCHNITTE);
}

/**
 * Einzelteile nach der Explosionszeichnung „5-Schalen-Mehrschalengreifer,
 * 1.200 Liter" (Vorlage 13.09.2026).
 *
 * Diese Datei baut NUR Teile, keinen Greifer — so war der Auftrag: „erst mal
 * die Einzelteile und so originalgetreu wie möglich … die versuchen wir später
 * zusammenzusetzen."
 *
 * Neu gegenüber dem ersten Anlauf ist, dass die Zeichnung jetzt eine Maßtabelle
 * hat. Damit ist nichts mehr geschätzt, und drei Dinge stellten sich als falsch
 * heraus:
 *
 *   - Die **Mitteltraverse misst Ø 700 mm**, nicht Ø 1514 mm. Der Bolzenkreis
 *     ist damit weniger als halb so groß wie im bisherigen Modell.
 *   - Die **Schale ist 400 mm breit**, nicht 740. Damit hatte die schmale
 *     Sichelkralle vom 12.09. mittags an dieser Stelle recht — was sie zur
 *     Schale macht, ist nicht die Breite, sondern die Tiefe von 300 mm.
 *   - Zwei Positionen fehlten ganz: **Zylinderschutzblech** und
 *     **Schalenverstärkung**, beide fünfmal.
 *
 * Hauptmaße aus der Tabelle, in Metern:
 *
 * Nachtrag 14.09.2026: Zwei Zeilen der Tabelle standen im Code anders als hier
 * in der Liste. Die Traverse ist jetzt wirklich Ø 0,70 × 0,45 (sie stand mit
 * 0,75 × 0,55 × 0,40 im `MASS`), und der Stempel ist auf Ø 0,46 × 0,26
 * gekürzt — nicht nach Liste, sondern nach Messung: Er stand mit 0,26 m² im
 * Schlund des Greifers. Die Greiferspitze ist auf ihr Listenmaß gebracht
 * (120 × 250 × 80 statt gemessener 72 × 249 × 71 mm).
 *
 *   1  Aufhängung / Adapter    1x   0,45 × 0,35 × 0,40
 *   2  Rotator (Drehwerk)      1x   0,40 × 0,40 × 0,30
 *   3  Drehwerksgehäuse        1x   0,45 × 0,35 × 0,25
 *   4  Mitteltraverse          1x   Ø 0,70 × 0,45
 *   5  Hydraulikzylinder       5x   0,70 × 0,20 × 0,12
 *   6  Greiferschale (HO)      5x   1,20 × 0,40 × 0,30
 *   7  Greiferspitze           5x   0,25 × 0,12 × 0,08
 *   8  Zylinderschutzblech     5x   0,50 × 0,18 × 0,10
 *   9  Hydraulikleitungen      1 Satz
 *   10 Schalenverstärkung      5x   0,40 × 0,15 × 0,08
 *
 *   Gesamt geschlossen: 1,85 m hoch, 1,60 m breit, 1.200 l Schüttgut
 *
 * Zwei Dinge macht die Datei anders als das Spielmodell:
 *
 *   - **Hülsengelenke sind echte Hülsen.** Ein Auge ist ein Rohr mit Bohrung,
 *     kein voller Zapfen. Daran steckt später der Bolzen wirklich.
 *   - **Schweißnähte sind sichtbar.** Wo ein Blech an ein anderes gesetzt ist,
 *     liegt eine Kehlnaht — der Unterschied zwischen Gussteil und
 *     Schweißkonstruktion.
 */
import * as THREE from "three";

/* ------------------------------------------------------------- Hauptmaße */

/** Die Maßtabelle der Zeichnung, in Metern. Einzige Quelle für alles unten. */
export const MASS = {
  aufhaengung: { breite: 0.45, tiefe: 0.35, hoehe: 0.4 },
  rotator: { breite: 0.4, tiefe: 0.4, hoehe: 0.3 },
  drehwerksgehaeuse: { breite: 0.5, tiefe: 0.45, hoehe: 0.3 },
  /*
   * Ø 0,70 × 0,45 — so, wie die Positionsliste es oben nennt.
   *
   * Im Code stand 0,75 × 0,55 × 0,40, und das war an zwei Stellen falsch: Die
   * Liste nennt einen RUNDEN Koerper (Ø 0,70), also ist „tiefe" dasselbe Mass
   * wie „breite" — die 0,55 hat nie jemand gelesen, `baueMitteltraverse`
   * benutzt sie nicht. Und mit Ø 0,75 stand der Rand des Koerpers auf r 0,375,
   * also AUSSERHALB der Zylinderaufnahme auf r 0,34: Die Gabel steckte im
   * eigenen Grundkoerper. Mit Ø 0,70 sitzt sie auf dem Rand.
   *
   * Die 0,45 sind die Bauhoehe der ganzen Traverse mit ihren Zylindergabeln,
   * nicht die des Grundkoerpers; sie ergeben sich aus `TRAVERSE_Y` (gemessen
   * 14.09.2026: 0,45 m ueber alles).
   */
  traverse: { breite: 0.7, tiefe: 0.7, hoehe: 0.4 },
  zylinder: { laenge: 0.7, breite: 0.2, durchmesser: 0.12 },
  schale: { laenge: 1.2, breite: 0.4, tiefe: 0.3 },
  spitze: { laenge: 0.25, breite: 0.12, dicke: 0.08 },
  /*
   * Gekuerzt von 0,60 × 0,50 × 0,35 auf Ø 0,46 × 0,26.
   *
   * Ansage 14.09.2026: die Mittelsaeule „nimmt das Volumen des Greifers fuer
   * das Material". Gemessen stimmt das nicht fuer den KORB — dorthin ragen
   * nur Ausleger und Gabeln, und die machten 26 l von 1.615 l aus. Es stimmt
   * fuer den SCHLUND: In der Ebene 5 cm ueber den Bolzen versperrte die Saeule
   * 0,46 m² von 2,49 m², also fast ein Fuenftel dessen, was oben hineinfaellt.
   * Der Grundkoerper allein war davon 0,26 m².
   *
   * Weiter herunter geht es nicht, ohne die Anlenkung anzufassen: Der Koerper
   * muss die Saeule (Ø 0,26 am Fuss) tragen und fuenf Ausleger aufnehmen, und
   * die Ausleger muessen bis auf `STEMPEL_AUGE.r` hinaus. Was danach noch im
   * Schlund steht, sind die Ausleger selbst.
   */
  stempel: { breite: 0.46, tiefe: 0.46, hoehe: 0.26 },
  gesamt: { hoehe: 2.4, breite: 2.3, volumen: 1.2 },
  schalen: 5,
} as const;

/** Abschnitte, in die die Schale unterteilt ist. */
export const SCHALEN_ABSCHNITTE = 6;
/**
 * Länge eines Abschnitts und Krümmung je Abschnitt.
 *
 * Beides folgt aus dem Hauptmaß der Schale — und zwar erst, seit klar ist, wie
 * die 1.200 × 300 mm gemeint sind: als **Hüllmaß entlang der eigenen Sehne**,
 * so wie man ein gebogenes Blech misst, nicht als Bogenlänge.
 *
 * Als Bogenlänge gelesen ging die Rechnung nicht auf: Eine 1,20-m-Schale auf
 * einer Ø-700-Traverse müsste die Achse um 42 cm überfahren, um sich zu
 * schließen. Als Hüllmaß bleibt genau eine Lösung übrig, und sie trifft die
 * Tabelle auf den Millimeter:
 *
 *   6 Abschnitte à 230 mm = 1,38 m Bogen, 17,5° Krümmung je Abschnitt
 *   Hüllmaß daraus: 1,199 × 0,296 m   (Soll 1,20 × 0,30)
 */
export const ABSCHNITT = 0.23;
export const SCHALEN_BOGEN = (17.5 * Math.PI) / 180;

/* ------------------------------------------------------------- Kinematik */

/**
 * Die Kinematik — und der Befund, der sie umgeworfen hat.
 *
 * Die zweite Fassung der Zeichnung hat zwei Positionen, die vorher fehlten:
 *
 *   9  Zentrale untere Gelenk-/Führungseinheit (Stempel)   1x, 600×500×350
 *   10 Untere Schalenanbindung                             5x, Gelenkpunkt am Stempel
 *
 * Damit hängen die Schalen NICHT an der Mitteltraverse, wie ich es gebaut
 * hatte. Das Verbindungsprinzip der Zeichnung sagt es Punkt für Punkt: oberer
 * Zylinderanschluss an der Mitteltraverse, obere Schalenanbindung am Zylinder,
 * untere Schalenanbindung an der zentralen Gelenkeinheit. Jede Schale hat also
 * genau einen Drehpunkt — unten in der Mitte, am Stempel — und wird oben vom
 * Zylinder geschoben. Ein Winkelhebel, keine hängende Schale.
 *
 * Genau das ist auch der Grund, warum der Greifer geschlossen wie eine Birne
 * aussieht: Der Drehpunkt sitzt tief und mittig, die Schale wickelt sich um
 * ihn herum, und unten schaut der Stempel heraus.
 *
 * Abgetastet ergibt sich — und diesmal mit einer Probe, die aufgeht:
 *
 * Der Bogen aus dem Hüllmaß 1,20 × 0,30 m hebt über seine sechs Abschnitte
 * 0,8295 m nach außen und 0,8665 m nach unten. Legt man den Drehpunkt an das
 * OBERE Ende der Schale, liegt geschlossen genau dieser Bogen zwischen dem
 * Äquator und der Spitze auf der Achse.
 *
 * Hier stand: „die Schalen bilden eine Halbkugel von 0,83 m Radius, Inhalt
 * 1.195 Liter, die Positionsliste nennt 1.200." Nachgemessen (14.09.2026)
 * stimmt das nicht. Der Korb ist keine Halbkugel: Am Äquator steht die Bahn
 * auf r 0,890 (nicht 0,83 — die 0,8295 sind der Hub NACH AUSSEN, dazu kommt
 * der Radius der Spitze), und der Kreisbogen wölbt sich nach außen über die
 * Kugel hinaus. Als Rotationskörper der geschlossenen Mittellinie unter der
 * Bolzenebene gerechnet, in 4.000 Scheiben: **1.615 Liter**.
 *
 * Diese 1.615 l sind der SEHNENZUG über die sieben groben Stationen — dieselbe
 * Kette, an der auch Hüllmaß und Kinematik hängen. Das Netz sitzt auf dem
 * Kreisbogen durch diese Stationen (`feineStationen`), und der wölbt sich
 * zwischen ihnen nach außen: als Rotationskörper dieses Bogens gerechnet sind
 * es 1.646 l, also 31 l oder 1,9 % mehr (QA-Gegenrechnung 14.09.2026, siehe
 * `docs/messungen/2026-09-14_fuenfschalen-vorschau.md`). Beide Zahlen sind
 * richtig; hier steht die konservative.
 *
 * Die 1.200 l der Positionsliste sind davon nicht weit weg, wenn man
 * dazunimmt, dass fünf Schalen von 400 mm Breite am Äquator nur gut ein
 * Drittel des Umfangs abdecken — der Rest ist offen, und Schüttgut, das
 * dazwischen passt, bleibt nicht liegen. Als Hüllvolumen 1.615 l, als
 * Nenninhalt 1.200 l; beides sind verschiedene Dinge und keines ist falsch.
 *
 * Damit ist die Form nicht mehr geraten, sondern erzwungen:
 *
 *   Drehpunkt   an Station 0 — dem OBEREN Ende —, 0,30 m nach innen versetzt
 *   Stempelauge r 0,59 m, y −1,5335 m
 *   Anschläge   0° geschlossen, 96,25° offen — Spitzen senkrecht
 *   geschlossen 1,78 m breit, Loch Ø 0,12 m, 2,40 m hoch  (Liste: 2,40 m)
 *   offen       3,02 m Spitzenweite
 *
 * Die 2,30 m der Liste sind die SPITZENWEITE, nicht der Hüllkreis. Zuerst hatte
 * ich sie als Hüllmaß gelesen und kam auf 51° Öffnung; die Spitzen standen dann
 * nur 1,86 m auseinander. Im Spiel fielen damit zwei Schrottsorten durch — das
 * Waggon-Drehgestell und das LKW-Fahrerhaus, beide 1,90 m in der mittleren
 * Kante. Ein Datenblatt nennt bei einem Greifer die Öffnungsweite von Spitze zu
 * Spitze; so hat es auch das Vorgängermodell gelesen. Mit 65° trifft sie auf den
 * Zentimeter, und die Gesamthöhe bleibt bei 2,40 m, weil die vom geschlossenen
 * Zustand kommt.
 *   Zylinder    0,98 m geschlossen, 0,54 m offen — fährt zum SCHLIESSEN aus
 *   Moment      Schließen 2,7-mal Öffnen
 *
 * Der Drehpunkt saß vorher an Station 1, also 0,30 m UNTER dem oberen Ende.
 * Das war der Fehler hinter drei Beanstandungen auf einmal: Die Schale ragte
 * über ihren Drehpunkt hinaus, schwenkte offen bis auf 0,20 m an die Achse
 * heran und musste dort schmal gedeckelt werden — die Breite war oben klein,
 * wuchs nach unten an und fiel erst danach. Und geschlossen wuchs auch der
 * Radius der Mittellinie die ersten beiden Abschnitte nach unten noch an: ein
 * Fass, keine Birne. Beides verschwindet, sobald der Bolzen dort sitzt, wo er
 * beim Vorbild sitzt — am Äquator, am breitesten Punkt.
 */
/** Station der Schale, an der ihr Drehpunkt sitzt, und dessen Versatz nach innen. */
export const DREHPUNKT = { station: 0, versatz: 0.3 };
/** Lage des Stempelauges im Frame des Greifers (m). */
export const STEMPEL_AUGE = { r: 0.59, y: -1.5335 };
/**
 * Anschläge der Schalen (rad): 0° geschlossen, 51° offen.
 *
 * Geschlossen steht der oberste Abschnitt senkrecht. Das ist kein gerundeter
 * Wert, sondern die Bedingung für die Birnenform: Der Radius der Mittellinie
 * fällt von Station zu Station um `Abschnitt · sin(θ − Schwenk)`, und das ist
 * genau dann nirgends positiv, wenn der Schwenk den Anstellwinkel der obersten
 * Station nicht übersteigt. Bei den vorherigen 20° liefen die ersten beiden
 * Abschnitte nach außen, bevor die Schale einzog.
 */
export const ZU = 0;
/**
 * Offen stehen die SPITZEN SENKRECHT.
 *
 * Ansage 13.09.2026: „wenn die Spinne offen ist, sollten die Schalen weiter
 * offen gehen, sodass die Spitzen senkrecht stehen."
 *
 * Das ist keine gewaehlte Zahl: Die Tangente am Schalenende liegt bei
 * `SCHALEN_ABSCHNITTE · BOGEN − BOGEN/2` = 96,25° (eine Sehne zeigt in
 * Richtung der Tangente in ihrer Mitte, das Ende liegt also eine halbe Sehne
 * hinter 105°). Schwenkt die Schale um genau diesen Betrag, steht ihr Ende
 * senkrecht.
 *
 * Der Preis steht in den Huellmassen: Die Spitzenweite waechst von 2,30 auf
 * 3,02 m, die Positionsliste nennt 2,30. Die Ansage dazu lautete „die
 * Masstaebe muessen nicht richtig sein, es sollte nur das Grundprinzip
 * darstellen" — das Grundprinzip ist hier, dass die Schalen senkrecht in den
 * Schrott einstechen koennen.
 */
export const OFFEN = SCHALEN_ABSCHNITTE * SCHALEN_BOGEN - SCHALEN_BOGEN / 2;
/** Obere Schalenanbindung — wo der Zylinder angreift, im Frame des Drehpunkts. */
export const OBERE_ANBINDUNG = { y: 0, z: 0.31 };
/** Oberer Zylinderanschluss an der Mitteltraverse, im Frame des Greifers. */
export const ZYLINDER_AUFNAHME = { r: 0.34, y: -0.73 };
/**
 * Höhe der Mitteltraverse im Frame des Greifers (m).
 *
 * Steht hier und nicht im Zusammenbau, weil die Zylinderaufnahme an der
 * Traverse sitzt: Ihre Gabel muss genau auf `ZYLINDER_AUFNAHME.y` liegen, und
 * das kann das Bauteil nur wissen, wenn es seine eigene Einbauhöhe kennt.
 * Vorher war der Anschluss mit −0,80 m gerechnet und die Gabel bei −1,14 m
 * gezeichnet — der Zylinder hing 34 cm neben seinem Auge.
 *
 * Von −1,00 auf −0,96 gerueckt (14.09.2026). Die Zylindergabel haengt
 * 0,1425 m unter ihrem Auge und steht 0,07 m darueber; der Grundkoerper reicht
 * 0,15 m unter die Traversenmitte. Mit −1,00 endete er 6,6 cm UNTER dem
 * Gabelfuss — die fuenf Gabeln schwebten frei neben dem Bauteil, an dem sie
 * angeschweisst sein sollen. Mit −0,96 greift der Gabelfuss um 9 cm in den
 * Flansch, und die Bauhoehe der ganzen Traverse ist
 *   (−0,73 − TRAVERSE_Y) + 0,07 + 0,15 = 0,45 m
 * — genau das Mass der Positionsliste.
 */
export const TRAVERSE_Y = -0.96;

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return ZU + (OFFEN - ZU) * t;
}

/**
 * Stützstellen der Schale im Frame ihres Drehpunkts.
 *
 * Station 0 ist das obere Ende, `SCHALEN_ABSCHNITTE` die Spitze. Der Ursprung
 * liegt am unteren Gelenk — dort, wo die Schale am Stempel hängt.
 */
export function schalenStationen(): Array<{ y: number; z: number; th: number }> {
  const roh: Array<{ y: number; z: number; th: number }> = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i <= SCHALEN_ABSCHNITTE; i++) {
    roh.push({ y, z, th: i * SCHALEN_BOGEN });
    y -= ABSCHNITT * Math.cos(i * SCHALEN_BOGEN);
    z -= ABSCHNITT * Math.sin(i * SCHALEN_BOGEN);
  }
  const st = roh[DREHPUNKT.station]!;
  const px = st.y - DREHPUNKT.versatz * Math.sin(st.th);
  const pz = st.z - DREHPUNKT.versatz * Math.cos(st.th);
  return roh.map((r) => ({ y: r.y - px, z: r.z - pz, th: r.th }));
}

/**
 * Dieselbe Schalenbahn, nur feiner aufgelöst — ausschließlich fürs Netz.
 *
 * Die sieben Stationen sind der Vertrag: An ihnen hängen Hüllmaß, Kinematik,
 * Drehpunkt und Volumen, und nur mit ihrer groben Teilung trifft der Bogen die
 * Positionsliste auf den Millimeter (1,199 × 0,296 gegen 1,200 × 0,300; mit
 * zwölf Abschnitten wären es 1,227 × 0,271).
 *
 * Fürs Auge sind sechs Abschnitte über 87,5° aber zu wenig: Jeder Knick misst
 * 17,5°, und in der Seitenansicht liest sich die Schale dadurch als gerader
 * Schaft mit einem Knie darin statt als Sichel (Ansage 13.09.2026: „schau dir
 * doch einfach mal die Formgebung an … bei der Spinnenansicht, also montiert,
 * da siehst du es doch von der Seite").
 *
 * Deshalb wird hier eine Catmull-Rom-Kurve DURCH die sieben Stationen gelegt.
 * Sie geht exakt durch sie hindurch — an den Stützstellen ändert sich nichts,
 * dazwischen wird sie rund. Der Vertrag bleibt unangetastet, nur die Facetten
 * verschwinden.
 */
export function feineStationen(
  je = 3
): Array<{ y: number; z: number; th: number; k: number }> {
  /*
   * Die sieben Stationen liegen auf einem EXAKTEN KREIS — gleiche Sehnen,
   * gleicher Knick. Also braucht es keine Spline, sondern nur diesen Kreis.
   *
   * Der erste Versuch nahm eine Catmull-Rom-Kurve. Die traf die Stuetzstellen
   * zwar, lief zwischen ihnen aber ungleichmaessig: gemessen 2,84° bis 8,75°
   * Anstellungsaenderung je Teilschritt, wo 5,83° gleichmaessig sein muessten.
   * Dieser wandernde Fehler ist genau die Verwindung, die im Bild zu sehen war
   * — „stell dir 'n Blatt vor und das obere Ende wuerdest du mit dem
   * Uhrzeigersinn und das untere gegen den Uhrzeigersinn drehen".
   *
   * Auf dem Kreis ist der Knick je Teilschritt konstant, und die Stuetzstellen
   * werden exakt getroffen. Der Radius folgt aus Sehne und Knick:
   * R = Sehne / (2 · sin(Knick/2)).
   *
   * `th` ist die WIRKLICHE Tangente. Sie liegt an Station j bei (j − ½)·Knick,
   * denn eine Sehne zeigt in Richtung der Tangente in ihrer Mitte.
   */
  const R = ABSCHNITT / (2 * Math.sin(SCHALEN_BOGEN / 2));
  const phi0 = -SCHALEN_BOGEN / 2;
  // Nullpunkt der Schale im Frame ihres Drehpunkts — den bringt `schalenStationen` mit
  const start = schalenStationen()[0]!;
  const n = SCHALEN_ABSCHNITTE * je;
  const aus: Array<{ y: number; z: number; th: number; k: number }> = [];
  for (let i = 0; i <= n; i++) {
    const k = (i / n) * SCHALEN_ABSCHNITTE;
    const phi = phi0 + k * SCHALEN_BOGEN;
    aus.push({
      y: start.y - R * (Math.sin(phi) - Math.sin(phi0)),
      z: start.z + R * (Math.cos(phi) - Math.cos(phi0)),
      th: phi,
      k,
    });
  }
  return aus;
}

/**
 * Das Schalenende, wie es die gebaute Schale wirklich hat.
 *
 * Nicht dasselbe wie `schalenStationen()[6]`: Deren `th` ist die Richtung der
 * ABGEHENDEN Sehne, die wirkliche Tangente der Schale liegt eine halbe Sehne
 * dahinter. Der Meissel sass damit um 8,75° verkantet am Ende.
 */
export function schalenEnde(): { y: number; z: number; th: number } {
  const f = feineStationen();
  return f[f.length - 1]!;
}

/** Halbe Schalenbreite an einer Zwischenstation; zwischen den Stützstellen linear. */
export function halbbreiteBei(k: number): number {
  const a = Math.floor(k);
  const b = Math.min(SCHALEN_ABSCHNITTE, a + 1);
  const t = k - a;
  return schalenHalbbreite(a) * (1 - t) + schalenHalbbreite(b) * t;
}

/** Mittellinie einer Schale im Frame des Greifers, bei gegebenem Schwenk. */
export function mittellinie(schwenk: number): Array<{ r: number; y: number }> {
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  return schalenStationen().map((p) => ({
    r: STEMPEL_AUGE.r + (p.y * sn + p.z * c),
    y: STEMPEL_AUGE.y + (p.y * c - p.z * sn),
  }));
}

/* ------------------------------------------------------------------ Stoffe */

export interface Stoffe {
  guss: THREE.MeshStandardMaterial;
  blech: THREE.MeshStandardMaterial;
  naht: THREE.MeshStandardMaterial;
  bolzen: THREE.MeshStandardMaterial;
  gruen: THREE.MeshStandardMaterial;
  chrom: THREE.MeshStandardMaterial;
  gummi: THREE.MeshStandardMaterial;
}

export function stoffe(): Stoffe {
  const m = (n: string, c: number, r: number, me: number): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: me });
    mat.name = n;
    return mat;
  };
  return {
    guss: m("Stahlguss", 0x41474c, 0.55, 0.5),
    blech: m("Hardox_Blech", 0x2f3438, 0.45, 0.68),
    naht: m("Schweissnaht", 0x6a7076, 0.72, 0.55),
    bolzen: m("Bolzen_blank", 0xb9c0c6, 0.24, 0.92),
    gruen: m("Lack_gruen", 0x5ec23f, 0.4, 0.35),
    chrom: m("Kolbenstange_chrom", 0xc6ccd2, 0.16, 0.9),
    gummi: m("Hydraulikschlauch", 0x15181a, 0.86, 0.05),
  };
}

/* -------------------------------------------------------------- Bausteine */

/**
 * Hohlzylinder — die Grundform jedes Hülsengelenks.
 *
 * Ein Auge mit Bohrung, nicht ein voller Zapfen. Genau daran erkennt man auf
 * der Zeichnung ein Gelenk: Man sieht durch. Die Achse liegt auf x, weil alle
 * Gelenke dieses Greifers quer stehen.
 */
export function rohr(
  rAussen: number,
  rBohrung: number,
  laenge: number,
  seiten = 14
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const h = laenge / 2;
  for (let s = 0; s < seiten; s++) {
    const w0 = (s / seiten) * Math.PI * 2;
    const w1 = ((s + 1) / seiten) * Math.PI * 2;
    const u0 = s / seiten;
    const u1 = (s + 1) / seiten;
    for (const [r, aussen] of [
      [rAussen, 1],
      [rBohrung, 0],
    ] as Array<[number, number]>) {
      const a = p(-h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 0);
      const b = p(-h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 0);
      const c = p(h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 1);
      const d = p(h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 1);
      if (aussen) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
    for (const x of [-h, h]) {
      const a = p(x, Math.sin(w0) * rAussen, Math.cos(w0) * rAussen, u0, 0);
      const b = p(x, Math.sin(w1) * rAussen, Math.cos(w1) * rAussen, u1, 0);
      const c = p(x, Math.sin(w1) * rBohrung, Math.cos(w1) * rBohrung, u1, 1);
      const d = p(x, Math.sin(w0) * rBohrung, Math.cos(w0) * rBohrung, u0, 1);
      if (x > 0) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let NAHT_STOFF: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial();
/** Muss einmal gesetzt werden, bevor `naht` benutzt wird. */
export function nahtStoff(st: Stoffe): void {
  NAHT_STOFF = st.naht;
}

/**
 * Kehlnaht als schmale Dreikantleiste.
 *
 * Eine Schweißnaht ist kein Rohr, sondern eine Kehle: dreieckig im Schnitt,
 * die beiden Schenkel an den Blechen. Neun Dreiecke je Naht — billiger als
 * jedes Detail, das man dafür weglassen müsste.
 */
export function naht(laenge: number, dicke = 0.022): THREE.Mesh {
  const g = new THREE.CylinderGeometry(dicke, dicke, laenge, 3);
  g.rotateY(Math.PI / 6);
  const m = new THREE.Mesh(g, NAHT_STOFF);
  m.name = "SCHWEISSNAHT";
  return m;
}

/**
 * Gabelaufnahme: zwei Laschen mit fluchtenden Augen, dazwischen der Spalt für
 * das Gegenstück.
 *
 * Die Standardaufnahme dieses Greifers — sie kommt an der Mitteltraverse für
 * Zylinder und Schalen vor und oben am Adapter.
 */
export function gabel(
  st: Stoffe,
  spalt: number,
  augeR: number,
  bohrung: number,
  hoehe: number,
  dicke = 0.05
): THREE.Group {
  const g = new THREE.Group();
  for (const seite of [-1, 1]) {
    const x = seite * (spalt / 2 + dicke / 2);
    const platte = new THREE.Mesh(new THREE.BoxGeometry(dicke, hoehe, augeR * 1.8), st.blech);
    platte.position.set(x, -hoehe / 2 + augeR * 0.25, 0);
    g.add(platte);
    const auge = new THREE.Mesh(rohr(augeR, bohrung, dicke), st.guss);
    auge.position.set(x, 0, 0);
    g.add(auge);
    const n = naht(augeR * 1.7);
    n.rotation.z = Math.PI / 2;
    n.position.set(x - seite * (dicke / 2 + 0.016), -hoehe + augeR * 0.25, 0);
    g.add(n);
  }
  return g;
}

/**
 * Strang mit Rechteckquerschnitt entlang einer Stationsfolge.
 *
 * Fuer alles, was der Schalenkruemmung folgt: Seitenwangen, Verstaerkungen.
 * `versatz` misst von der Mittellinie nach aussen.
 */
export type ProStation = number | number[];

/** Wert einer `ProStation`-Angabe an Station k. */
function je(v: ProStation, k: number): number {
  return typeof v === "number" ? v : (v[k] ?? v[v.length - 1] ?? 0);
}

export function strang(
  stationen: Array<{ y: number; z: number; th: number }>,
  x: ProStation,
  breite: ProStation,
  dicke: ProStation,
  versatz: ProStation = 0
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (px: number, py: number, pz: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(px, py, pz);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const ecken: number[][] = [];
  for (let k = 0; k < stationen.length; k++) {
    const s0 = stationen[k]!;
    /*
     * Die Aussennormale des Bogens ist (-sin th, cos th), NICHT (sin th, cos th).
     *
     * Die Stationen liegen auf einem Kreis um (Cy, Cz) mit
     * y = Cy - R sin th und z = Cz + R cos th; der Fahrstrahl vom Mittelpunkt
     * zur Station ist damit (-R sin th, +R cos th). Mit dem falschen Vorzeichen
     * stimmt die Richtung nur bei th = 0 und kippt danach um 2 th weg: bei
     * Station 3 (th = 43,8°) stand sie fast parallel zur Bahn, bei der Spitze
     * (th = 80,2°) lief sie rueckwaerts. Die Strebe lag dadurch nicht AUF dem
     * Blech, sondern laengs daneben — in der Seitenansicht die Einschnuerung
     * in der Mitte („die Mitte ist zu duenn", 13.09.2026).
     */
    const ny = -Math.sin(s0.th);
    const nz = Math.cos(s0.th);
    const xk = je(x, k);
    const vk = je(versatz, k);
    const dk = je(dicke, k);
    const bk = je(breite, k);
    const reihe: number[] = [];
    for (const [dx, dn] of [
      [-bk / 2, vk],
      [bk / 2, vk],
      [bk / 2, vk + dk],
      [-bk / 2, vk + dk],
    ] as Array<[number, number]>) {
      reihe.push(
        p(xk + dx, s0.y + dn * ny, s0.z + dn * nz, (dx + bk / 2) / bk, k / stationen.length)
      );
    }
    ecken.push(reihe);
  }
  for (let k = 0; k < ecken.length - 1; k++) {
    for (let e = 0; e < 4; e++) {
      const f = (e + 1) % 4;
      quad(ecken[k]![e]!, ecken[k]![f]!, ecken[k + 1]![f]!, ecken[k + 1]![e]!);
    }
  }
  const letzte = ecken.length - 1;
  quad(ecken[0]![3]!, ecken[0]![2]!, ecken[0]![1]!, ecken[0]![0]!);
  quad(ecken[letzte]![0]!, ecken[letzte]![1]!, ecken[letzte]![2]!, ecken[letzte]![3]!);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------- 01 Aufhängung / Adapter */

/**
 * Aufhängung / Adapter — 0,45 × 0,35 × 0,40 m.
 *
 * Auf der Zeichnung eine geschweißte Konstruktion mit zwei hochstehenden
 * Laschen und großen Augen, dazwischen der Bolzen zum Stiel, unten die
 * Anschraubplatte zum Rotator. Die Knotenbleche zwischen Laschen und Platte
 * sind das Erkennungszeichen — ohne sie sieht die Gabel aus wie angeklebt.
 */
export function baueAufhaengung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "01_AUFHAENGUNG";
  const M = MASS.aufhaengung;
  const platte = new THREE.Mesh(new THREE.BoxGeometry(M.breite, 0.05, M.tiefe), st.guss);
  platte.name = "01_ANSCHRAUBPLATTE";
  platte.position.y = -M.hoehe / 2;
  g.add(platte);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.026, 0.014, 0.055), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * 0.16, -M.hoehe / 2, Math.cos(a) * 0.12);
    g.add(sitz);
  }
  const ohren = gabel(st, 0.14, 0.095, 0.05, 0.26, 0.055);
  ohren.name = "01_GABEL";
  ohren.position.y = M.hoehe / 2 - 0.1;
  g.add(ohren);
  const bolzen = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.32, 14), st.bolzen);
  bolzen.name = "01_BOLZEN";
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.y = M.hoehe / 2 - 0.1;
  g.add(bolzen);
  for (const sz of [-1, 1]) {
    const knoten = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.04), st.blech);
    knoten.position.set(0, -0.06, sz * 0.1);
    knoten.rotation.x = sz * 0.55;
    g.add(knoten);
  }
  return g;
}

/* ------------------------------------------------------------ 02 Rotator */

/**
 * Rotator (Drehwerk) — 0,40 × 0,40 × 0,30 m.
 *
 * Der Drehantrieb: ein gedrungener Block mit Flansch oben und unten, dem
 * Hydraulikmotor an der Seite und der Drehdurchführung. Nicht zu verwechseln
 * mit Position 3, dem Gehäuse darum herum.
 */
export function baueRotator(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "02_ROTATOR";
  const M = MASS.rotator;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2, M.breite / 2, M.hoehe * 0.62, 8),
    st.blech
  );
  koerper.name = "02_GEHAEUSE";
  koerper.rotation.y = Math.PI / 8;
  g.add(koerper);
  for (const [y, r] of [
    [M.hoehe / 2 - 0.02, M.breite / 2 - 0.03],
    [-M.hoehe / 2 + 0.02, M.breite / 2 + 0.01],
  ] as Array<[number, number]>) {
    const flansch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 16), st.guss);
    flansch.position.y = y;
    g.add(flansch);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const schraube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6),
        st.bolzen
      );
      schraube.position.set(Math.sin(a) * (r - 0.035), y, Math.cos(a) * (r - 0.035));
      g.add(schraube);
    }
  }
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 10), st.guss);
  motor.name = "02_MOTOR";
  motor.rotation.z = Math.PI / 2;
  motor.position.set(M.breite / 2 + 0.04, 0.02, 0);
  g.add(motor);
  for (const z of [-0.05, 0.05]) {
    const stutzen = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 6), st.bolzen);
    stutzen.rotation.z = Math.PI / 2;
    stutzen.position.set(-M.breite / 2 - 0.02, -0.03, z);
    g.add(stutzen);
  }
  return g;
}

/* --------------------------------------------------- 03 Drehwerksgehäuse */

/**
 * Drehwerksgehäuse — 0,45 × 0,35 × 0,25 m.
 *
 * Die Schutzabdeckung um das Drehwerk. Auf der Zeichnung ist es der gerippte
 * Ring zwischen Rotator und Mitteltraverse; die senkrechten Rippen sind das,
 * woran man es erkennt — sie halten den Schrott von der Dichtung fern.
 */
export function baueDrehwerksgehaeuse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "03_DREHWERKSGEHAEUSE";
  const M = MASS.drehwerksgehaeuse;
  const mantel = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2, M.tiefe / 2, M.hoehe, 12),
    st.guss
  );
  mantel.name = "03_MANTEL";
  g.add(mantel);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rippe = new THREE.Mesh(new THREE.BoxGeometry(0.035, M.hoehe * 0.86, 0.05), st.blech);
    rippe.position.set(Math.sin(a) * (M.breite / 2 - 0.005), 0, Math.cos(a) * (M.breite / 2 - 0.005));
    rippe.rotation.y = a;
    g.add(rippe);
  }
  const rand = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2 + 0.02, M.breite / 2 + 0.02, 0.03, 12),
    st.blech
  );
  rand.position.y = M.hoehe / 2;
  g.add(rand);
  return g;
}

/* ------------------------------------------------------ 04 Mitteltraverse */

/**
 * Mitteltraverse — 0,75 × 0,55 × 0,40 m, die zentrale Baugruppe.
 *
 * Oben der Flansch zum Drehwerk, rundum fünf Gabeln für die oberen
 * Zylinderanschlüsse. Die Schalen hängen NICHT hier — das war mein Fehler bis
 * zur zweiten Fassung der Zeichnung. Sie hängen am Stempel (Position 9); die
 * Traverse trägt nur die Zylinder und den Stempel selbst.
 */
export function baueMitteltraverse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "04_MITTELTRAVERSE";
  const M = MASS.traverse;
  const R = M.breite / 2;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.86, M.hoehe * 0.75, 10),
    st.guss
  );
  koerper.name = "04_GRUNDKOERPER";
  koerper.rotation.y = Math.PI / 10;
  g.add(koerper);
  const flansch = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.05, 16), st.guss);
  flansch.name = "04_OBERFLANSCH";
  flansch.position.y = M.hoehe * 0.38;
  g.add(flansch);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.024, 0.013, 0.06), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * R * 0.5, M.hoehe * 0.38, Math.cos(a) * R * 0.5);
    g.add(sitz);
  }
  // Fuenf Gabeln fuer die oberen Zylinderanschluesse
  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    const gabelTeil = gabel(st, 0.1, 0.07, 0.036, 0.16, 0.04);
    gabelTeil.name = `04_ZYLINDERAUFNAHME_${nr}`;
    gabelTeil.position.set(
      Math.sin(a) * ZYLINDER_AUFNAHME.r,
      ZYLINDER_AUFNAHME.y - TRAVERSE_Y,
      Math.cos(a) * ZYLINDER_AUFNAHME.r
    );
    gabelTeil.rotation.y = a;
    g.add(gabelTeil);
  }
  return g;
}

/* ------------------------------------- 09 Zentrale untere Gelenkeinheit */

/**
 * Stempel — die zentrale untere Gelenk- und Führungseinheit, Ø 0,46 × 0,26 m.
 *
 * Position 9 der Zeichnung, und das Bauteil, das mir gefehlt hat. An ihm hängen
 * alle fünf Schalen: Jede hat unten ihre eigene Gabel („untere Schalenanbindung",
 * Position 10). Nach unten endet er FLACH, mit einem kurzen Fuß — nicht in einer
 * Spitze. Die halbe Abrissbirne, die geschlossen unten herausschaut, bilden die
 * Schalen selbst, nicht der Stempel.
 *
 * Der Stempel hängt über eine Säule an der Mitteltraverse; die Säule ist das,
 * was auf der Zeichnung zwischen Traverse und Gelenkeinheit zu sehen ist.
 */
export function baueStempel(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "09_STEMPEL";
  const M = MASS.stempel;
  const R = M.breite / 2;
  /*
   * Der Stempel endet an der Bolzenebene — darunter kommt NICHTS mehr.
   *
   * Ansage 13.09.2026: „Ansonsten gibt es unten keinen Zapfen von der
   * Traverse/Stempel. Zähne sind ganz unten angesiedelt, sodass der
   * geschlossene Korb am unteren Ende des Stempels anfängt."
   *
   * Vorher sass der Körper mittig auf dem Auge und darunter noch ein Fuss; der
   * Stempel ragte damit 355 mm in den geschlossenen Korb hinein. Jetzt steht
   * er vollständig ÜBER der Bolzenebene, und der Korb beginnt genau dort, wo
   * er aufhört.
   */
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.94, M.hoehe, 10), st.guss);
  koerper.name = "09_KOERPER";
  koerper.rotation.y = Math.PI / 10;
  koerper.position.y = M.hoehe * 0.5;
  g.add(koerper);
  /*
   * Die Saeule wird gerechnet, nicht gesetzt: vom Kopf des Stempels bis in die
   * Mitte der Traverse. Vorher stand hier eine feste Laenge von 0,34 m. Die
   * passte zur alten Stempelhoehe; mit dem gekuerzten Stempel haette die
   * Saeule 6 cm unter der Traverse aufgehoert.
   */
  const saeuleL = TRAVERSE_Y - STEMPEL_AUGE.y - M.hoehe;
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, saeuleL, 8), st.guss);
  saeule.name = "09_SAEULE";
  saeule.position.y = M.hoehe + saeuleL / 2;
  g.add(saeule);
  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    /*
     * Die Gabel sitzt auf `STEMPEL_AUGE.r` — dort, wo die Schale dreht, nicht
     * am Rand des Blocks. Der Ausleger dazwischen ist das, was Position 10 von
     * einem blossen Auge unterscheidet: ein angeschweisster Arm, der den
     * Bolzen nach aussen an den Äquator der Kugel traegt.
     */
    /*
     * 100 x 120 mm statt 120 x 140 (14.09.2026). Der Ausleger ist das, was vom
     * Stempel wirklich IN den Korb ragt: Er sitzt mittig auf der Bolzenebene,
     * haengt also mit seiner halben Hoehe darunter. 20 mm weniger Hoehe sind
     * 10 mm weniger Korb, und ueber fuenf Ausleger und ihre Laenge macht das
     * mehr aus als der ganze Grundkoerper.
     */
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, Math.max(STEMPEL_AUGE.r - R * 0.7, 0.05)),
      st.guss
    );
    arm.name = `10_AUSLEGER_${nr}`;
    arm.position.set(
      Math.sin(a) * (R * 0.7 + STEMPEL_AUGE.r) * 0.5,
      0,
      Math.cos(a) * (R * 0.7 + STEMPEL_AUGE.r) * 0.5
    );
    arm.rotation.y = a;
    g.add(arm);
    const wurzelNaht = naht(0.12);
    wurzelNaht.rotation.z = Math.PI / 2;
    wurzelNaht.position.set(Math.sin(a) * R * 0.78, -0.07, Math.cos(a) * R * 0.78);
    wurzelNaht.rotation.y = a;
    g.add(wurzelNaht);
    /*
     * Gabelhoehe 0,12 statt 0,18. Die Laschen haengen unter ihrem Auge, und das
     * Auge liegt auf der Bolzenebene — jeder Zentimeter Lasche steht im Korb.
     * 0,12 reicht: Die Lasche muss das Auge (r 0,095) fassen und auf dem
     * Ausleger (0,12 hoch) aufsitzen, mehr traegt sie nicht.
     */
    const anbindung = gabel(st, 0.3, 0.095, 0.045, 0.12, 0.045);
    anbindung.name = `10_SCHALENANBINDUNG_${nr}`;
    anbindung.position.set(Math.sin(a) * STEMPEL_AUGE.r, 0, Math.cos(a) * STEMPEL_AUGE.r);
    anbindung.rotation.y = a;
    g.add(anbindung);
  }
  return g;
}

/* --------------------------------------------------- 05 Hydraulikzylinder */

/**
 * Hydraulikzylinder — 0,70 × 0,20 × Ø 0,12 m, fünfmal radial.
 *
 * Gehäuse und Kolbenstange sind getrennte Objekte, beide mit Auge. Kolben und
 * Dichtungen stecken darin und sind nicht gebaut — in einer Spielkamera sieht
 * man sie nie.
 */
export function baueZylinder(st: Stoffe): {
  gruppe: THREE.Group;
  gehaeuse: THREE.Group;
  stange: THREE.Group;
  stab: THREE.Mesh;
  auge: THREE.Mesh;
  rohrLaenge: number;
  auszug: number;
} {
  const gruppe = new THREE.Group();
  gruppe.name = "05_HYDRAULIKZYLINDER";
  const M = MASS.zylinder;
  const rR = M.durchmesser / 2;
  const rohrLaenge = M.laenge * 0.6;

  const gehaeuse = new THREE.Group();
  gehaeuse.name = "05_ZYLINDERGEHAEUSE";
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(rR, rR, rohrLaenge, 14),
    st.gruen
  );
  koerper.position.y = -rohrLaenge / 2;
  gehaeuse.add(koerper);
  const boden = new THREE.Mesh(new THREE.CylinderGeometry(rR * 1.12, rR * 1.12, 0.05, 14), st.gruen);
  gehaeuse.add(boden);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(rR * 1.08, rR * 1.08, 0.055, 14), st.blech);
  kopf.position.y = -rohrLaenge;
  gehaeuse.add(kopf);
  /*
   * Das obere Auge liegt IM Gelenkpunkt, nicht 7 cm darüber. Sonst stimmt der
   * Abstand zwischen den beiden Augen nicht mit der gerechneten Zylinderlänge
   * überein, und der Zylinder steht neben seiner Gabel.
   */
  const augeOben = new THREE.Mesh(rohr(rR * 0.95, rR * 0.42, M.breite * 0.45), st.guss);
  augeOben.position.y = 0;
  gehaeuse.add(augeOben);
  const n = naht(M.breite * 0.5);
  n.rotation.z = Math.PI / 2;
  n.position.y = 0.026;
  gehaeuse.add(n);
  for (const y of [-0.08, -rohrLaenge + 0.1]) {
    const anschluss = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), st.bolzen);
    anschluss.rotation.z = Math.PI / 2;
    anschluss.position.set(rR + 0.02, y, 0);
    gehaeuse.add(anschluss);
  }
  gruppe.add(gehaeuse);

  const stange = new THREE.Group();
  stange.name = "05_KOLBENSTANGE";
  const auszug = M.laenge - rohrLaenge - 0.12;
  const stab = new THREE.Mesh(new THREE.CylinderGeometry(rR * 0.5, rR * 0.5, auszug, 12), st.chrom);
  stab.position.y = -auszug / 2;
  stange.add(stab);
  const augeUnten = new THREE.Mesh(rohr(rR * 0.85, rR * 0.38, M.breite * 0.4), st.guss);
  augeUnten.position.y = -auszug - 0.04;
  stange.add(augeUnten);
  stange.position.y = -rohrLaenge;
  gruppe.add(stange);

  return { gruppe, gehaeuse, stange, stab, auge: augeUnten, rohrLaenge, auszug };
}

/* ------------------------------------------------ 06 Greiferschale (HO) */

/**
 * Greiferschale, halboffene Bauform — 1,20 × 0,40 × 0,30 m, fünfmal.
 *
 * Ein geschweißter Trog: gewölbte Haut zwischen zwei Seitenwangen, oben der
 * Lagerkasten mit den beiden Augen, hinten die Konsole mit dem Anlenkauge für
 * die Kolbenstange. Dazwischen Kehlnähte.
 *
 * 400 mm Breite — nicht 740, wie im ersten Anlauf geschätzt. Was die Schale von
 * einem Zinken unterscheidet, ist damit nicht die Breite, sondern die Tiefe:
 * 300 mm, verteilt auf 120 mm Wölbung der Haut und 180 mm hohe Wangen.
 */
const HALB = MASS.schale.breite / 2;
/**
 * Querradius der Schalenhaut (m).
 *
 * Die Woelbung darf NICHT konstant sein. Sie war es: 120 mm ueber die ganze
 * Laenge, waehrend die Breite von 400 auf 130 mm faellt. Oben ergibt das einen
 * flachen Bogen, unten ein spitzes V, und der Trogrand wandert dabei diagonal
 * ueber die Schale — im Bild nicht von einer Verwindung zu unterscheiden.
 *
 * Ein gewalztes oder gegossenes Blech hat stattdessen einen festen Querradius.
 * Der folgt aus dem Hauptmass: Pfeilhoehe 120 mm bei 400 mm Breite ergibt
 * R = (b/2)^2 / (2 * Pfeilhoehe) = 0,167 m. Damit faellt die Woelbung mit dem
 * Quadrat der Breite — an der Spitze bleiben von 120 mm noch 13 mm.
 */
/**
 * Querkrümmung der Haut — die der geschlossenen Kugel, nicht eine eigene.
 *
 * Ansage 13.09.2026: „die Wölbung ist immer noch nicht richtig." Sie war es
 * zweimal nicht. Erst stand sie fest auf 120 mm über die ganze Länge, während
 * die Breite von 400 auf 130 mm fiel — oben ein flacher Bogen, unten ein
 * spitzes V, und der Trogrand wanderte diagonal über die Schale. Dann lief sie
 * über einen festen Querradius von 0,167 m, was an der Spitze fast flach wurde.
 *
 * Beides ging am Wesentlichen vorbei: Fünf Schalen schließen zu einer KUGEL.
 * Damit ist jede Schale ein Stück dieser Kugeloberfläche, und ihre
 * Querkrümmung ist die der Kugel an dieser Station — der Radius, den die
 * geschlossene Mittellinie dort hat. Gerechnet sind das rund 22 mm Wölbung auf
 * 400 mm Breite, nicht 120. Die Schale ist also eine SANFT gewölbte Platte,
 * keine tiefe Rinne; die Tiefe der Positionsliste steckt im Holm.
 */
function querRadius(k: number): number {
  /*
   * Zwischen den Stuetzstellen LINEAR, nicht gerundet.
   *
   * Mit `Math.round` sprang der Radius bei jeder halben Station auf den der
   * naechsten — und weil die Woelbung mit 1/r geht, sprang sie dort nach oben:
   * 17,6 / 17,5 / 16,0 / 14,3 / 15,2 / 13,4 / 11,5 / 13,4 mm. Ein Saegezahn
   * ueber die ganze Laenge, den man der Haut als Wellen ansieht.
   */
  const bahn = mittellinie(ZU);
  const kk = Math.max(0, Math.min(SCHALEN_ABSCHNITTE, k));
  const a = Math.floor(kk);
  const b = Math.min(SCHALEN_ABSCHNITTE, a + 1);
  const t = kk - a;
  const r = (bahn[a]?.r ?? 0.1) * (1 - t) + (bahn[b]?.r ?? 0.1) * t;
  return Math.max(r, 0.12);
}
/** Wölbung der Haut bei halber Breite `halb` an Station k. */
function woelbungBei(halb: number, k: number): number {
  return (halb * halb) / (2 * querRadius(k));
}

const sektorHalb = Math.PI / MASS.schalen;
/**
 * Ab welchem Abstand von der Drehachse die Sektorgrenze ueberhaupt gilt (m).
 *
 * Naeher an der Achse laufen die fuenf Spitzen im geschlossenen Zustand
 * ineinander. Bei fuenf Zinken endlicher Breite geht das gar nicht anders —
 * der Sektortest der gespielten Sichelkralle nimmt genau diese Zone aus
 * (`test/greifer.test.ts`, „bleibt in jeder Stellung im eigenen Sektor":
 * `if (r < 0.3) continue`, mit der Begruendung „am Geraet schieben sie sich
 * dort aneinander vorbei"). Hier gilt dieselbe Grenze und derselbe Grund.
 *
 * Vorher war der Deckel bis auf 6,8 cm an die Achse durchgezogen. Das ist der
 * ganze Unterschied zwischen einem 72-mm-Zahn und einem 120-mm-Zahn.
 */
const SEKTOR_AB = 0.3;
/**
 * Sicherheitsabschlag auf die Sektorbreite.
 *
 * Der Deckel rechnet mit der EXAKTEN Beziehung: Ein Punkt, der `r` von der
 * Achse und `b` quer zur Schalenmitte steht, nutzt `atan(b/r)` des Sektors —
 * halbe Breite = `r · tan(36°)`. Vorher stand dort `sin(0,9 · 36°)`, also
 * 0,536 statt 0,727: ein Viertel zu wenig, und die Verwechslung von Sinus und
 * Tangens ist der zweite Grund, warum der Zahn zu schmal war.
 */
const SEKTOR_SICHER = 0.9;
/** Blechdicke der Seitenwangen (m). */
const WANGE_DICK = 0.035;
/** Tiefe der Randleiste (m) — nur noch eine Kante, keine Wange mehr. */
/**
 * Der Holm ist ein VIERKANTROHR, laengs gebogen — und er ist der Zahn.
 *
 * Ansage 13.09.2026, woertlich: „Stell dir 'n Zahn genauso vor: 'n Vierkantrohr.
 * 'N einfaches, breites Vierkantrohr, laengs nach innen gebogen. Das ist im
 * Grunde genommen der Zahn … Und quasi aussen auf einer Seite des
 * Vierkantrohres sind die Schalen gegossen, eben mit der einen Bodenflaeche,
 * also der breiteren Flaeche des Vierkants … Der Holmen, der das Vierkantrohr
 * ist, ist in der Dicke ueberall gleich, ueberall. Und darum ist auch der Zahn
 * ueberall gleich."
 *
 * Damit faellt mein Grundmodell: Ich hatte die Schale als gebogenes Blech mit
 * einer Rinne gebaut und den Zahn als Keil daran. Richtig ist das Umgekehrte —
 * ein durchgehendes Profil traegt alles, und die Platten sind nur aussen
 * daraufgesetzt.
 *
 * Der Querschnitt steht in der Positionsliste: Die Greiferspitze misst
 * 120 x 80 mm, also breiter als tief. Genau das ist das Rohr.
 */

/**
 * Wie tief die Seitenwange an Station k in den Trog hineinragt (m).
 *
 * Oben so tief, dass sie den Drehbolzen erreicht. Der sitzt `DREHPUNKT.versatz`
 * hinter der Haut — mit den durchgehenden 180 mm der Positionsliste hörte die
 * Wange 120 mm vor ihm auf, und die Schale hing sichtbar neben ihrem eigenen
 * Lager. Beim Vorbild sind das die großen Backen am oberen Ende, die den Bolzen
 * tragen; nach unten laufen sie auf das Normalmaß zu.
 */
export function schalenHalbbreite(k: number): number {
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
      HALB * verjuengung(i),
      Math.max(innen, SEKTOR_AB) * Math.tan(sektorHalb) * SEKTOR_SICHER
    );
  }
  return halb;
}

export function baueGreiferschale(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "06_GREIFERSCHALE";
  const HAUT = BLECH;

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const QUER = 4;

  /*
   * Gebaut wird auf den FEINEN Stuetzstellen — dieselbe Bahn, nur rund statt
   * facettiert. Die groben sieben bleiben der Vertrag fuer Mass und Kinematik.
   */
  const fein = feineStationen(3);
  const ENDE = fein.length - 1;
  const lagen: number[][][] = [];
  for (const seite of [0, 1]) {
    const reihen: number[][] = [];
    for (let k = 0; k <= ENDE; k++) {
      const s0 = fein[k]!;
      const halb = halbbreiteBei(s0.k);
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const x = -halb + t * 2 * halb;
        const w = (halb * halb - x * x) / (2 * querRadius(s0.k)) + seite * HAUT;
        reihe.push(
          // Aussennormale (-sin th, cos th) — siehe `strang`
          p(x, s0.y - w * Math.sin(s0.th), s0.z + w * Math.cos(s0.th), t, k / ENDE)
        );
      }
      reihen.push(reihe);
    }
    lagen.push(reihen);
  }
  const [aussen, innen] = lagen as [number[][], number[][]];
  for (let k = 0; k < ENDE; k++) {
    for (let j = 0; j < QUER; j++) {
      quad(aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      quad(innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    quad(aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    quad(innen[k]![QUER]!, aussen[k]![QUER]!, aussen[k + 1]![QUER]!, innen[k + 1]![QUER]!);
  }
  const e = ENDE;
  for (let j = 0; j < QUER; j++) {
    quad(innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    quad(aussen[e]![j]!, aussen[e]![j + 1]!, innen[e]![j + 1]!, innen[e]![j]!);
  }
  const haut = new THREE.BufferGeometry();
  haut.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  haut.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  haut.setIndex(idx);
  haut.computeVertexNormals();
  const hautMesh = new THREE.Mesh(haut, st.blech);
  hautMesh.name = "06_HAUT";
  g.add(hautMesh);

  /*
   * Seitenwangen: der Versatz ist NEGATIV, die Wange steht also in den Trog
   * hinein. Andersherum verschwindet sie hinter der Haut, und die Schale liest
   * sich als flaches Blech — genau so sah sie im ersten Anlauf aus.
   */
  /*
   * EIN GUSS — nichts steht ab.
   *
   * Ansage 13.09.2026: „eben, das ist alles falsch … ein Guss, keine nach oben
   * stehenden Bleche", und davor: „es gibt keine Bleche nach oben, nur
   * Stahlbleche, die das innere Material zusammenhalten sollen."
   *
   * Die Seitenansicht der Zeichnung zeigt genau drei Dinge und sonst nichts:
   * das Blech (15 mm), die Verstärkung darauf (25 mm, nach vorn dicker) und
   * den Zahn, der sie fortsetzt. Keine Seitenwangen, keine Mittelrippe. Das
   * Blech selbst ist das Stahlblech, das die Ladung hält — seine Wölbung tut
   * das, nicht angesetzte Wände.
   *
   * Damit fallen alle Aufbauten weg, die ich nacheinander gebaut hatte:
   * tiefe Randwangen, Holm, Vierkantrohr, Mittelrippe.
   */
  /*
   * Zwei Koerper, als einer gegossen.
   *
   * Erstens das Blech — Form und Kruemmung stellen die Innenflaeche der Spinne
   * dar. Zweitens eine zentrierte Strebe, die mittig darauf liegt und die
   * Aussenkanten der Schale nicht erreicht.
   *
   * Angesetzte Seitenwaende gibt es nicht: Im Querschnitt C-C tragen nur diese
   * beiden Teile eine Bemassung, und die Schenkel, die dort nach unten laufen,
   * sind das gebogene Blech selbst im Schnitt.
   */
  /*
   * Die Strebe liegt AUSSEN auf dem Blech, mittig, und laeuft durch — von
   * Station 0 bis zur Spitze. Ihre Breite endet deutlich vor den Aussenkanten
   * der Schale, ihre Hoehe faellt gleichmaessig von 130 auf 75 mm. Unten ist
   * sie damit schmaler als oben, aber nie duenn.
   */
  /* Alles mit demselben Faktor — das ist die „durchgaengig proportionale" Form. */
  const strebeBreiten = fein.map((f) => STREBE_B_OBEN * verjuengung(f.k));
  const strebeHoehen = fein.map((f) => STREBE_H_OBEN * verjuengung(f.k));
  for (let k = 0; k < fein.length - 1; k++) {
    const abschnitt = new THREE.Mesh(
      strang(
        fein.slice(k, k + 2),
        0,
        strebeBreiten.slice(k, k + 2),
        strebeHoehen.slice(k, k + 2),
        fein.slice(k, k + 2).map((f) => woelbungBei(halbbreiteBei(f.k), f.k) + BLECH)
      ),
      st.guss
    );
    abschnitt.name = `06_STREBE_${String(k + 1).padStart(2, "0")}`;
    g.add(abschnitt);
  }

  // Lagerkasten mit den beiden Augen — das Hülsengelenk zur Mitteltraverse
  /*
   * Lagerkasten und Augen — schmaler, als es die Schalenbreite zuliesse.
   *
   * Bei fuenf Schalen hat jede 72°. Auf dem Bolzenkreis von 0,34 m sind das
   * 43 cm Bogen. Die Augen sassen bei ±0,24 m, der Kasten war also 48 cm
   * breit — und griff damit in den Sektor der Nachbarin. Die Pruefung hat es
   * bei drei Vierteln geoeffnet gefangen, mit 43° von 36°.
   */
  /*
   * Untere Schalenanbindung — der Drehpunkt am Stempel (Position 10). Er liegt
   * im Ursprung der Schale, denn genau darum dreht sie sich.
   */
  /*
   * Der Bolzen geht durch BEIDE Backen, nicht zwischen ihnen hindurch.
   *
   * Vorher war die Hülse 0,26 m lang und die Wangen standen 0,40 m auseinander
   * — das Auge schwebte mit 7 cm Luft auf jeder Seite zwischen den Backen, und
   * in der Seitenansicht sah die Schale aus, als hinge sie neben ihrem Lager.
   * Länge und Kastenbreite kommen deshalb aus der Schalenbreite an Station 0.
   */
  const backen = 2 * (schalenHalbbreite(0) - WANGE_DICK);
  /*
   * Der Gusskopf überbrückt von der Innenkante des Holms bis hinter den
   * Bolzen. Vorher tat das die Wange, indem sie sich auf 360 mm vertiefte —
   * und genau davon lief das Band der Seitenansicht keilförmig zu.
   */
  const brueckeVon = DREHPUNKT.versatz; // bis zum Bolzen
  const kasten = new THREE.Mesh(
    new THREE.BoxGeometry(backen, 0.2, brueckeVon + 0.13),
    st.guss
  );
  kasten.name = "06_UNTERE_ANBINDUNG";
  kasten.position.set(0, 0.02, (brueckeVon - 0.13) / 2);
  g.add(kasten);
  const unteresAuge = new THREE.Mesh(rohr(0.085, 0.042, backen + 2 * WANGE_DICK), st.guss);
  unteresAuge.name = "06_UNTERES_AUGE";
  g.add(unteresAuge);
  /*
   * Die Kehlnaht laeuft LAENGS der Fuge zwischen Nabe und Backe, nicht quer
   * darueber. Quer gelegt stand sie 35 mm ueber die Schalenkante hinaus — und
   * genau das soll die Kontur nirgends tun.
   */
  for (const seite of [-1, 1]) {
    const n = naht(0.16);
    n.rotation.y = Math.PI / 2;
    n.position.set(seite * (backen / 2 - 0.012), 0.05, -0.02);
    g.add(n);
  }

  // Konsole mit Anlenkauge fuer die Kolbenstange
  /*
   * Konsole mit Anlenkauge — auf dem RUECKEN der Schale, nicht im Trog.
   * Ihre Lage ist gerechnet, nicht gegriffen: `ANLENKPUNKT` kommt aus der
   * Abtastung der ganzen Kinematik.
   */
  /*
   * Obere Schalenanbindung — hier greift die Kolbenstange an (Position 6 der
   * Zeichnung, orange markiert). Sie sitzt aussen am oberen Ende der Schale.
   */
  /*
   * Die Konsole steht ebenfalls von Backe zu Backe. Sie überträgt die
   * Zylinderkraft in beide Wangen; als schmaler Klotz in der Mitte hätte sie
   * nichts, woran sie sich abstützt.
   */
  const konsole = new THREE.Mesh(new THREE.BoxGeometry(backen, 0.18, 0.16), st.guss);
  konsole.name = "06_OBERE_ANBINDUNG";
  konsole.position.set(0, OBERE_ANBINDUNG.y + 0.02, OBERE_ANBINDUNG.z * 0.75);
  g.add(konsole);
  const oberesAuge = new THREE.Mesh(rohr(0.055, 0.03, 0.11), st.guss);
  oberesAuge.name = "06_OBERES_AUGE";
  oberesAuge.position.set(0, OBERE_ANBINDUNG.y, OBERE_ANBINDUNG.z);
  g.add(oberesAuge);
  const nk = naht(0.12);
  nk.rotation.z = Math.PI / 2;
  nk.position.set(0, OBERE_ANBINDUNG.y - 0.08, OBERE_ANBINDUNG.z * 0.6);
  g.add(nk);

  return g;
}

/* ------------------------------------------------------ 07 Greiferspitze */

/**
 * Greiferspitze — geschmiedet, austauschbar, fünfmal.
 *
 * Sie darf die Seitenansicht der Schale nicht verändern. Vorher tat sie das:
 * Der Kragen war mit 138 mm breiter als die Schale an ihrem Ende (110 mm), und
 * der Kegel setzte mit 120 mm ebenfalls darüber auf. In der Seitenansicht sah
 * die Schale damit aus, als würde sie ganz unten noch einmal ausstellen — ein
 * Fuß, wo eine Spitze hingehört.
 *
 * Deshalb kommt die Breite jetzt nicht mehr aus der Positionsliste, sondern
 * aus `schalenHalbbreite` an der letzten Station: Der Schuh ist genau so breit
 * wie das Schalenende, keinen Millimeter mehr. Was darunter heraussteht, sind
 * nur noch die beiden Zacken — gleich groß, schmal, auf einen Punkt zulaufend.
 */
export function baueGreiferspitze(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "07_GREIFERSPITZE";
  /*
   * Zahn nach der Zeichnung `zahngreifer` — Stationen und Querschnitt
   * uebernommen, nicht geschaetzt.
   *
   * Abgewickelt 320 mm lang, von 110 x 75 mm an der Basis auf 22 x 14 mm an
   * der Spitze. Der Querschnitt ist ein Fuenfeck: flache Innenseite, zwei
   * abgeschraegte Schultern, First in der Mitte. Gebogen wird mit demselben
   * Radius wie das Blech, damit der Zahn dessen Kurve fortsetzt — genau das
   * macht das Schliessen sauber.
   *
   * Meine letzte Fassung hatte ihn mit konstantem Querschnitt gebaut. Die
   * Zeichnung zeigt das Gegenteil: Er verjuengt sich auf ein Fuenftel.
   */
  /*
   * Vier Stationen statt sechs, und das Ende bleibt stumpf.
   *
   * Ansage 13.09.2026: „Kantenschutz braucht nicht so viel Detailtiefe und
   * sind eher stumpfe Elemente." Die Zeichnung laeuft auf 22 x 14 mm aus; hier
   * endet der Zahn bei 74 x 20 mm (gemessen 14.09.2026). Das ist Kantenschutz,
   * keine Schneide, und spart Dreiecke, die in der Spielkamera niemand sieht.
   */
  /*
   * Die Spitze setzt den Zinken fort — in seinen Proportionen.
   *
   * Handskizze 13.09.2026: Der Zinken laeuft durchgehend schmaler zu und endet
   * rund, nicht in einem angesetzten breiten Zahn. Die Basis hier ist deshalb
   * genau der Querschnitt, den Blech und Strebe am Schalenende haben; von dort
   * laeuft sie auf eine stumpfe, gerundete Spitze aus.
   */
  const basisB = 2 * schalenHalbbreite(SCHALEN_ABSCHNITTE);
  /*
   * Die Basis ist genau die Strebenhoehe am Schalenende — NICHT plus Blech.
   *
   * Die flache Seite des Zahns liegt schon auf der Aussenflaeche des Blechs
   * (`z0`); das Blech noch einmal zur Hoehe zu addieren zaehlt es doppelt.
   * Gemessen sprang die Dicke dadurch am Uebergang von 88 auf 120 mm — genau
   * die Stelle, an der das Ende dicker aussah als die Mitte.
   */
  const basisH = STREBE_H_OBEN * verjuengung(SCHALEN_ABSCHNITTE);
  /*
   * Kurzer breiter Keil, keine Nadel.
   *
   * Ansage 14.09.2026: „die Zacken sind spitzer als beim Original" — beim
   * Vorbild sind das kurze, breite, angeschraubte Keile. Die Verjuengung lief
   * vorher auf 0,34 der Basisbreite aus (41 mm bei 120 mm Basis); das ist eine
   * Schneide, kein Kantenschutz. Sie laeuft jetzt auf 0,62 aus — bei 120 mm
   * Basis endet der Zahn 74 mm breit und 20 mm hoch.
   *
   * Die Hoehe darf dabei nicht mitwachsen: Der Waechter `schalenform.test.ts`
   * verlangt, dass die Seitenansicht von oben nach unten nur duenner wird und
   * am Ende am duennsten ist. Breit wird der Zahn quer zur Seitenansicht, und
   * genau dort sieht man ihn beim Zupacken.
   */
  const STATIONEN: Array<[number, number, number]> = [
    [0, basisB, basisH],
    [0.09, basisB * 0.9, basisH * 0.86],
    [0.18, basisB * 0.76, basisH * 0.68],
    [0.25, basisB * 0.62, basisH * 0.52],
  ];
  const R = 0.7; // Biegeradius der Zeichnung
  /* Die flache Seite liegt auf der Verstaerkung, also aussen auf dem Blech. */
  const z0 = woelbungBei(schalenHalbbreite(SCHALEN_ABSCHNITTE), SCHALEN_ABSCHNITTE) + BLECH;

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, tu: number, tv: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(tu, tv);
    return i;
  };
  /*
   * Biegen wie in der Vorlage: Die Laenge entlang der Achse bleibt erhalten,
   * sie wird nur zum Bogen. Punkte weiter aussen liegen auf groesserem Radius.
   */
  const ringe = STATIONEN.map(([x, b, h], si) => {
    const hb = b / 2;
    const profil: Array<[number, number]> = [
      [-hb, 0],
      [hb, 0],
      [hb * 0.84, h * 0.65],
      [0, h],
      [-hb * 0.84, h * 0.65],
    ];
    return profil.map(([pz, py], j) => {
      const w = x / R;
      const r = R + py;
      /*
       * Die Hoehe laeuft nach +z, die Laenge nach −y.
       *
       * Eine Drehung um x um `th` bildet lokales (0,0,1) auf (0, −sin th,
       * cos th) ab — und genau das IST die Aussennormale des Bogens. Lokales
       * (0,−1,0) wird zu (0, −cos th, −sin th), der Tangente. Der Zahn steht
       * damit auf dem Blech und setzt die Sichel fort.
       *
       * Vorher war die Hoehe negiert, um zu einer Schale zu passen, deren
       * Normale selbst falsch herum gerechnet war. Beide Fehler zusammen sahen
       * am oberen Ende richtig aus und liefen nach unten auseinander.
       */
      return p(pz, -(r * Math.sin(w)), z0 + (-R + r * Math.cos(w)), j / 5, si / 5);
    });
  });
  for (let i = 0; i < ringe.length - 1; i++) {
    const a2 = ringe[i]!;
    const b2 = ringe[i + 1]!;
    for (let k = 0; k < a2.length; k++) {
      const k2 = (k + 1) % a2.length;
      idx.push(a2[k]!, b2[k]!, b2[k2]!, a2[k]!, b2[k2]!, a2[k2]!);
    }
  }
  const kappe = (ring: number[], gedreht: boolean): void => {
    for (let k = 1; k < ring.length - 1; k++) {
      if (gedreht) idx.push(ring[0]!, ring[k + 1]!, ring[k]!);
      else idx.push(ring[0]!, ring[k]!, ring[k + 1]!);
    }
  };
  kappe(ringe[0]!, true);
  kappe(ringe[ringe.length - 1]!, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  /*
   * Dasselbe Gusseisen wie die Schale, nicht das helle Bolzenmaterial.
   *
   * Ansage 13.09.2026: „wie kann es sein, dass das Ende dicker ist als die
   * Mitte?" Gemessen war es das nicht — die Spitze laeuft von 72 auf 25 mm zu
   * und schliesst buendig an das Schalenende an. Es war die FARBE: In Hellgrau
   * las sie sich als aufgesetzter Schuh. Die Skizze zeigt ein Stueck aus
   * dickem gegossenem Eisen.
   */
  const zahn = new THREE.Mesh(geo, st.guss);
  zahn.name = "07_ZAHN";
  g.add(zahn);
  /*
   * Keine Schrauben an der Spitze. Die Bohrung sitzt laut Skizze OBEN am Kopf
   * des Zinkens, wo er am Stempel haengt — nicht unten. Und mit 90 mm Laenge
   * standen die Huelsen 9 mm ueber die Schale hinaus, die dort nur noch 72 mm
   * breit ist.
   */
  return g;
}

/*
 * Weggelassen, auf Ansage vom 13.09.2026:
 *
 *   - Hydraulikleitungen und Verbindungsschläuche („kannst weglassen").
 *   - Zylinderschutzbleche. Sie liegen ZWISCHEN den Zylindern, nicht davor —
 *     und weil ich sie zweimal falsch herum gebaut habe, bleiben sie erst mal
 *     draußen („im Zweifel weglassen").
 *   - Schalenverstärkung. Sie steht in der zweiten Fassung der Zeichnung nicht
 *     mehr in der Positionsliste.
 */

/* ------------------------------------------------------------- Übersicht */

/** Alle Einzelteile, in der Reihenfolge der Positionsliste. */
export function einzelteile(st: Stoffe = stoffe()): Array<{
  name: string;
  anzahl: number;
  teil: THREE.Object3D;
}> {
  nahtStoff(st);
  return [
    { name: "01  Aufhaengung / Adapter", anzahl: 1, teil: baueAufhaengung(st) },
    { name: "02  Rotator / Drehwerk", anzahl: 1, teil: baueRotator(st) },
    { name: "03  Drehwerksgehaeuse", anzahl: 1, teil: baueDrehwerksgehaeuse(st) },
    { name: "04  Mitteltraverse", anzahl: 1, teil: baueMitteltraverse(st) },
    { name: "05  Hydraulikzylinder", anzahl: 5, teil: baueZylinder(st).gruppe },
    { name: "06  Greiferschale (HO)", anzahl: 5, teil: baueGreiferschale(st) },
    { name: "07  Greiferspitze", anzahl: 5, teil: baueGreiferspitze(st) },
    { name: "09  Zentrale untere Einheit", anzahl: 1, teil: baueStempel(st) },
  ];
}
