import * as THREE from "three";

/**
 * Geometrie der Spinne — die eine Wahrheit für Modell, Kollider und
 * Bodenanschlag.
 *
 * Stand: zurück auf den 12.09.2026 mittags (Ansage 13.09.2026: „kannst du
 * einfach wieder die Spinne von gestern Mittag nehmen?").
 *
 * Dazwischen lagen zwei Tage Formarbeit: Trogschalen statt Finger, ein Strunk
 * statt des Gelenkrings, 170°-Haken, dann ein gleichmäßiger 86°-Bogen aus dem
 * Datenblatt. Die Zwischenstände stehen in `docs/entscheidungen.md` (E-115 bis
 * E-151) und in der Historie; hier steht wieder die Sichelkralle, die vorher
 * da war.
 *
 * Die Maße stammen aus dem Datenblatt der Sennebogen MG4.1-800-HO5, sind aber
 * fürs Spiel vergrößert: Öffnungsweite 3,38 m statt 2,225 m.
 *
 * Nachgerechnet ergibt die Kette unten (14.09.2026, acht Segmente am Zapfen;
 * die Zahlen kommen aus `clawSpan`, `clawWidth` und `clawTipDepth` selbst,
 * abgetastet über 2001 Stützstellen des Öffnungsweges):
 *
 *   offen (Spreizung 1,555)     Spitzenweite 3,3805 m   Segmentkette 2,3413 m tief
 *   geschlossen (Spreizung 0,5495)  Spitzen treffen sich auf der Achse
 *                                   (Restweite 0,0015 m), 2,8312 m tief
 *   tiefster Kettenpunkt über den ganzen Weg 2,8754 m, bei Spreizung 0,7702
 *
 * Der tiefste Punkt liegt also weder ganz offen noch ganz zu, sondern
 * dazwischen — deshalb tastet `CLAW_MAX_DEPTH` den Weg ab, statt die beiden
 * Endlagen zu vergleichen.
 *
 * Unter der Segmentkette haengt noch der ZAHNKEGEL (`CLAW_TIP_CONE`), und der
 * zaehlt fuer den Bodenanschlag mit — er wird gezeichnet, also setzt er auf.
 * Mit ihm (14.09.2026, `tools/zahnlage-spinne.ts`):
 *
 *   offen 2,4424 m   geschlossen 2,9488 m
 *   tiefster Punkt über den ganzen Weg 2,9995 m, bei Spreizung 0,7775
 *
 * Wer an `CLAW_SEG_LEN` oder `CLAW_SEG_BEND` dreht, muss beides nachrechnen —
 * vor allem das Schließen auf der Achse, denn davon hängt ab, ob der Korb
 * überhaupt zugeht.
 */

/**
 * Radius des ZAPFENS, an dem die Krallen haengen.
 *
 * Ansage 13.09.2026: „ich haette die Zaehne gerne eher unten am Zapfen
 * verortet" — und davor: „mich stoert, dass die Zaehne so weit oben angeordnet
 * sind … das Ladevolumen bei geoeffneter Spinne verkleinert bzw. die Spinne
 * dadurch nicht richtig eintauchen kann."
 *
 * Vorher war das ein RING von 0,757 m. Der Wert war keine Wahl, sondern ein
 * Zwang: Die Kralle kruemmt sich ueber ihre sechs Segmente um genau 0,757 m
 * nach innen, und nur bei diesem Radius trafen sich die Spitzen bei
 * Spreizung 0 auf der Achse. Die Folge war ein flacher, breiter Schirm — offen
 * hingen die Spitzen nur 1,11 m unter der Aufhaengung.
 *
 * Jetzt ein Zapfen von 0,40 m. Damit die Spitzen sich trotzdem treffen,
 * kruemmt die Kralle sich weiter, also braucht sie mehr Segmente: acht statt
 * sechs. „Zu" ist deshalb nicht mehr Spreizung 0, sondern 0,55.
 */
export const CLAW_RING_R = 0.4;
/** Hoehe des Zapfens, gemessen ab Kardangelenk — 15 cm tiefer als der Ring. */
export const CLAW_RING_Y = -1.05;
/** Länge eines Krallensegments */
export const CLAW_SEG_LEN = 0.26;
/** Krümmung je Segment (rad) — gleichmäßig, also ein Kreisbogen von 63° */
export const CLAW_SEG_BEND = 0.22;
/** Segmente je Kralle */
export const CLAW_SEGMENTS = 8;
/** Zahl der Krallen */
export const CLAW_COUNT = 5;
/**
 * Der ZAHNKEGEL am Ende jeder Kralle — die Verschleisskappe.
 *
 * Er wird in `grappleParts.baueKralle` als Knoten `tineTip` gezeichnet und
 * haengt UNTER der letzten Station der Segmentkette. Bis zum 14.09.2026 stand
 * er nur dort im Modell und nirgends in der Rechnung; `CLAW_MAX_DEPTH` lief
 * ueber `clawPoint` und kannte ihn nicht. Gemessen mit
 * `tools/zahnlage-spinne.ts` fehlten dadurch 0,1241 m, und genau so viel sank
 * die Spinne in den Beton (Befund am Geraet 14.09.2026: „Spinne sitzt auf, die
 * kleinen aeussersten Noppen verschwinden im Boden").
 *
 * Die Zahlen sind keine neuen Werte, sondern die des gezeichneten Kegels, hier
 * an EINE Stelle gezogen: `grappleParts.ts` baut ihn jetzt daraus.
 *
 *   hoehe    0,14 m   Kegelhoehe
 *   rOben    0,03 m   Radius am Schalenende
 *   rUnten   0,075 m  Radius an der Unterkante — der stumpfe Loeffelrand
 *   versatz  0,03 m   Kegelmitte unter der Spitzenstation
 *
 * Die Unterkante liegt damit `versatz + hoehe/2` = 0,10 m unter der Station,
 * gemessen entlang der Krallenachse. In der Senkrechten sind es je nach
 * Neigung des letzten Segments bis zu 0,125 m, weil die Unterkante eine
 * Scheibe von 0,075 m Radius ist und sich mitneigt.
 */
export const CLAW_TIP_CONE = { hoehe: 0.14, rOben: 0.03, rUnten: 0.075, versatz: 0.03 };

/** Spreizung der ganz offenen Spinne (rad) */
/*
 * Offen ist 1,555, nicht mehr 1,25.
 *
 * Der Oeffnungsweg ist gesucht, nicht gegriffen: Bei 1,555 misst die Spinne
 * wieder 3,38 m — genau so viel wie vorher. Das ist Absicht, denn an dieser
 * Zahl haengen Presskammer und Muldenbreiten. Mit dem vollen Weg von 1,25 rad
 * ab „zu" waeren es 3,93 m gewesen, und die Presse haette sie nicht mehr
 * aufgenommen.
 */
export const CLAW_OPEN_SPLAY = 1.555;
/**
 * Spreizung der GESCHLOSSENEN Spinne (rad).
 *
 * 0,5495 seit dem Zapfen (13.09.2026). Bei Spreizung 0 wuerden die acht
 * Segmente 1,16 m weit nach innen kruemmen und die Spitzen 76 cm ueber die
 * Achse hinausschiessen — sie muessen also ein Stueck offen stehen, damit sie
 * sich genau treffen. Der Wert ist abgetastet, nicht geschaetzt.
 *
 * Die Annahme „0 heisst zu" steckte einmal an vier Stellen im Code; deshalb
 * steht das hier als eigene Konstante.
 */
export const CLAW_CLOSED_SPLAY = 0.5495;

/** Aufsummierte Krümmung bis Station `i`. */
export const CLAW_BEND_KUM: number[] = Array.from(
  { length: CLAW_SEGMENTS + 1 },
  (_, i) => i * CLAW_SEG_BEND
);

/**
 * Punkt auf der Mittellinie einer Kralle, im Frame der Spinne.
 *
 * `a` ist der Umfangswinkel der Kralle, `splay` die Spreizung, `k` die Station
 * (0 = Gelenk, `CLAW_SEGMENTS` = Spitze).
 */
export function clawPoint(
  a: number,
  splay: number,
  k: number,
  out: THREE.Vector3
): THREE.Vector3 {
  let y = 0;
  let z = 0;
  for (let i = 0; i < k; i++) {
    const th = -splay + i * CLAW_SEG_BEND;
    y -= CLAW_SEG_LEN * Math.cos(th);
    z -= CLAW_SEG_LEN * Math.sin(th);
  }
  const r = CLAW_RING_R + z;
  return out.set(Math.sin(a) * r, CLAW_RING_Y + y, Math.cos(a) * r);
}

/**
 * Öffnungsweite der Spinne bei gegebener Spreizung, in Metern.
 * Nützlich für Maßproben: Passt der Greifer noch zwischen die Muldenwände?
 */
export function clawSpan(splay: number): number {
  const p = clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3());
  return Math.hypot(p.x, p.z) * 2;
}

/**
 * Größter Durchmesser der Spinne bei gegebener Spreizung, in Metern.
 *
 * Nicht dasselbe wie `clawSpan`: Geschlossen treffen sich die Spitzen auf der
 * Achse, aber die Krallen bauchen davor nach außen. Für die Frage „passt sie
 * in den Behälter" zählt diese Zahl.
 */
export function clawWidth(splay: number): number {
  const p = new THREE.Vector3();
  let weit = 0;
  for (let k = 0; k <= CLAW_SEGMENTS; k++) {
    weit = Math.max(weit, Math.hypot(clawPoint(0, splay, k, p).x, p.z));
  }
  return weit * 2;
}

/**
 * Tiefe der Unterkante des ZAHNKEGELS unter dem Ursprung der Spinne (m).
 *
 * Der Kegel haengt an der letzten Segmentgruppe und neigt sich mit ihr. Seine
 * Unterkante ist eine Scheibe von `rUnten`; je schraeger das letzte Segment
 * steht, desto weiter reicht ihr aeusserer Rand nach unten. Beides steckt in
 * der Rechnung:
 *
 *   Tiefe = Spitzenstation + (versatz + hoehe/2) · cos θ + rUnten · |sin θ|
 *
 * mit θ = Neigung des letzten Segments gegen die Senkrechte. Das ist derselbe
 * Winkel, mit dem `clawPoint` von Station 7 auf Station 8 laeuft, und dieselbe
 * Drehung, die `baueKralle` dem Segment gibt — Zeichnung und Rechnung koennen
 * deshalb nicht auseinanderlaufen. `test/spinnenmodell.test.ts` misst das am
 * gezeichneten Knoten nach.
 */
export function clawToothDepth(splay: number): number {
  const spitze = clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3());
  const th = -splay + (CLAW_SEGMENTS - 1) * CLAW_SEG_BEND;
  const laengs = CLAW_TIP_CONE.versatz + CLAW_TIP_CONE.hoehe / 2;
  return -spitze.y + laengs * Math.cos(th) + CLAW_TIP_CONE.rUnten * Math.abs(Math.sin(th));
}

/**
 * Tiefe des tiefsten Krallenpunktes unter dem Ursprung der Spinne. Daraus
 * ergibt sich der Bodenanschlag — der Greifer darf nie in den Beton sinken.
 *
 * Gerechnet wird über alle Stationen der Segmentkette UND über den gezeichneten
 * Zahnkegel. Die Stationenschleife ist Absicht: Sobald jemand am Krümmungsprofil
 * dreht und die Kralle am Ende nach innen hakt, wandert der tiefste Punkt nach
 * oben, und wer dann noch nach der Spitze absetzt, fährt mit dem Bauch der
 * Kralle in den Beton.
 *
 * Der Zahnkegel kam am 14.09.2026 dazu. Er wurde von Anfang an gezeichnet, aber
 * nie gerechnet — 0,1241 m Modell, die es fuer den Bodenanschlag nicht gab.
 */
export function clawTipDepth(splay: number): number {
  const p = new THREE.Vector3();
  let tief = 0;
  for (let k = 1; k <= CLAW_SEGMENTS; k++) {
    tief = Math.max(tief, -clawPoint(0, splay, k, p).y);
  }
  return Math.max(tief, clawToothDepth(splay));
}

/**
 * Wieviel Winkel eine Kralle gegen Widerstand noch nachdrücken darf (rad).
 * Ein Greifer bleibt nicht schlagartig stehen, wenn er auf Stahl trifft — die
 * Hydraulik drückt weiter, bis der Druck steht. Sichtbar wird das als kurzes
 * Nachsetzen, nicht als abrupter Stopp.
 */
/*
 * 0,55 statt 0,12 (Ansage 13.09.2026: „die Spinne greift nicht richtig").
 *
 * Gemessen war der Grund nicht die Form — die ist unveraendert die von
 * letzter Woche —, sondern diese Zahl. Mit 0,12 rad verengte sich die Spinne
 * nach der ersten Beruehrung noch um 28 cm und stand: von 3,38 m auf 3,11 m.
 * Sie war damit praktisch noch ganz offen und hielt nichts. Der Zahn hatte
 * Starre, aber der Greifer hatte keinen Griff.
 *
 * 0,38 rad sind knapp 1,0 m Verengung statt 0,28 — dreimal so viel. Weiter
 * ging es nicht, ohne die Starre selbst aufzugeben: `test/zaehne.test.ts`
 * verlangt, dass Weiches mehr als das 2,5-fache nachgibt und dass auch
 * Weiches den Zahn zum Stehen bringt. Das deckelt Weich auf unter 1,0 und
 * damit Massiv auf unter 0,4.
 *
 * Die Starre von der Ansage 12.09.2026 („eine gewisse Starre bzw. Kraft muss
 * jeder Zahn haben") bleibt also — sie steht nur nicht mehr so weit vor dem
 * Zufassen.
 */
export const NACHDRUECK_RESERVE = 0.38;
/**
 * Dasselbe fuer Nachgiebiges: Blech, Faesser, Weisse Ware, Kabinen.
 *
 * Der Zahn drueckt sich hier weiter hinein als in massiven Stahl und steht
 * dann. Mit 0,38 fuer massiv (13.09.2026) sind es 0,96 statt 0,4, damit der
 * Abstand zwischen hart und weich bleibt. Vorher gab es
 * fuer solches Material gar keine Grenze: Es galt nicht als Hindernis, der
 * Zahn lief bis zum Anschlag durch das Teil hindurch (Ansage 12.09.2026:
 * „eine gewisse Starre bzw. Kraft muss jeder Zahn haben").
 */
export const WEICH_RESERVE = 0.96;
/** Wie langsam das Nachdrücken gegenüber freier Bewegung läuft. */
const NACHDRUECK_TEMPO = 0.25;

/**
 * Nächster Spreizwinkel einer einzelnen Kralle. Kleinerer Winkel = weiter zu.
 *
 * Die Regel ist der Kern des ungleichmäßigen Schließens: Öffnen geht immer —
 * sonst bliebe eine Kralle für immer stecken, sobald sie einmal aufsitzt.
 * Schließen läuft frei, solange nichts im Weg ist. Trifft die Kralle auf etwas,
 * das nicht nachgibt, drückt sie noch ein Stück nach und steht dann.
 */
export function naechsteSpreizung(
  ist: number,
  ziel: number,
  schritt: number,
  blockiert: boolean,
  reserve: number = NACHDRUECK_RESERVE,
  /**
   * Womit die Reserve wieder aufgefuellt wird, sobald die Schale frei ist.
   *
   * Bis E-057 stand hier `NACHDRUECK_RESERVE` fest im Rumpf. Das war richtig,
   * solange es einen Greifer gab; der Fuenfschalengreifer hat einen 67 %
   * laengeren Schliessweg und damit eine andere Reserve (0,635 statt 0,38 rad).
   * Vorgabe bleibt die der Sichelkralle — fuer sie aendert sich nichts.
   */
  vollerVorrat: number = NACHDRUECK_RESERVE
): { winkel: number; reserve: number } {
  // Öffnen: immer erlaubt, und der Druck ist damit weg
  if (ziel >= ist) {
    return { winkel: Math.min(ziel, ist + schritt), reserve: vollerVorrat };
  }
  if (!blockiert) {
    return { winkel: Math.max(ziel, ist - schritt), reserve: vollerVorrat };
  }
  if (reserve <= 0) return { winkel: ist, reserve: 0 };
  const drueck = Math.min(schritt * NACHDRUECK_TEMPO, reserve, ist - ziel);
  return { winkel: ist - drueck, reserve: reserve - drueck };
}

/**
 * Groesste Tiefe, die ein GEZEICHNETER Krallenpunkt in irgendeiner Stellung
 * erreicht (m) — Segmentkette oder Zahnkegel, was tiefer haengt.
 *
 * Der Wert, mit dem gerechnet werden muss, wenn die Stellung offen ist oder
 * sich noch aendern kann — etwa fuer die Frage, wie hoch der Arm die Spitzen
 * ueber eine Wand bringt.
 *
 * Welche Stellung die tiefere ist, haengt an der Form und hat sich innerhalb
 * von zwei Tagen zweimal umgedreht: Bei der Sichelkralle am grossen Gelenkring
 * (heute) haengt sie geschlossen fast senkrecht und ist damit tiefer als offen;
 * bei den Trogschalen am kleinen Bolzenkreis war es andersherum, weil dort die
 * Spitzen geschlossen erst den Bolzenkreis nach innen ueberbruecken mussten.
 *
 * Statt die jeweils gueltige Richtung an mehreren Stellen zu pflegen, wird hier
 * schlicht das Maximum genommen. Das ist in beiden Faellen richtig und bleibt
 * es auch beim naechsten Formwechsel.
 *
 * 21 Stuetzstellen reichen: Gegen 2001 abgetastet liegt das grobe Maximum
 * 0,05 mm zu niedrig (`tools/zahnlage-spinne.ts`, 14.09.2026). Das ist weniger
 * als die 2 cm Luft, die `resolveGroundClamp` ohnehin darauf legt.
 */
export const CLAW_MAX_DEPTH: number = (() => {
  let tief = 0;
  for (let i = 0; i <= 20; i++) {
    tief = Math.max(tief, clawTipDepth((CLAW_OPEN_SPLAY * i) / 20));
  }
  return tief;
})();

