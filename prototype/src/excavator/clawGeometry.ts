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
 * fürs Spiel vergrößert: Öffnungsweite 3,38 m statt 2,225 m. Nachgerechnet
 * ergibt die Kette unten
 *
 *   offen (Spreizung 1,25)   Spitzenweite 3,38 m   Tiefe 1,11 m
 *   geschlossen (Spreizung 0) Spitzen treffen sich auf der Achse (r = 0,00 m)
 *
 * Wer an `CLAW_SEG_LEN` oder `CLAW_SEG_BEND` dreht, muss beides nachrechnen —
 * vor allem das Schließen auf der Achse, denn davon hängt ab, ob der Korb
 * überhaupt zugeht.
 */

/** Radius des Gelenkrings, an dem die Krallen hängen = ØC/2 aus dem Datenblatt. */
export const CLAW_RING_R = 0.757;
/** Unterkante Traverse, gemessen ab Kardangelenk */
export const CLAW_RING_Y = -0.9;
/** Länge eines Krallensegments */
export const CLAW_SEG_LEN = 0.26;
/** Krümmung je Segment (rad) — gleichmäßig, also ein Kreisbogen von 63° */
export const CLAW_SEG_BEND = 0.22;
/** Segmente je Kralle */
export const CLAW_SEGMENTS = 6;
/** Zahl der Krallen */
export const CLAW_COUNT = 5;
/** Spreizung der ganz offenen Spinne (rad) */
export const CLAW_OPEN_SPLAY = 1.25;
/**
 * Spreizung der GESCHLOSSENEN Spinne (rad).
 *
 * Hier wieder schlicht 0: Mit dem großen Gelenkring von 0,757 m hängt die
 * Kralle bei 0 senkrecht nach unten und krümmt sich von dort zur Achse, wo die
 * Spitzen sich treffen. Der Wert steht nur deshalb als eigene Konstante da,
 * weil die Greiflogik und die Tests ihn brauchen — mit dem kleinen Bolzenkreis
 * vom 12.09. abends war er 0,85, und die Annahme „0 heißt zu" steckte an vier
 * Stellen im Code.
 */
export const CLAW_CLOSED_SPLAY = 0;

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
 * Tiefe des tiefsten Krallenpunktes unter dem Ursprung der Spinne. Daraus
 * ergibt sich der Bodenanschlag — der Greifer darf nie in den Beton sinken.
 *
 * Heute ist das die Spitze; die Rechnung läuft trotzdem über alle Stationen.
 * Das ist Absicht: Sobald jemand am Krümmungsprofil dreht und die Kralle am
 * Ende nach innen hakt, wandert der tiefste Punkt nach oben, und wer dann noch
 * nach der Spitze absetzt, fährt mit dem Bauch der Kralle in den Beton.
 */
export function clawTipDepth(splay: number): number {
  const p = new THREE.Vector3();
  let tief = 0;
  for (let k = 1; k <= CLAW_SEGMENTS; k++) {
    tief = Math.max(tief, -clawPoint(0, splay, k, p).y);
  }
  return tief;
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
  reserve: number = NACHDRUECK_RESERVE
): { winkel: number; reserve: number } {
  // Öffnen: immer erlaubt, und der Druck ist damit weg
  if (ziel >= ist) {
    return { winkel: Math.min(ziel, ist + schritt), reserve: NACHDRUECK_RESERVE };
  }
  if (!blockiert) {
    return { winkel: Math.max(ziel, ist - schritt), reserve: NACHDRUECK_RESERVE };
  }
  if (reserve <= 0) return { winkel: ist, reserve: 0 };
  const drueck = Math.min(schritt * NACHDRUECK_TEMPO, reserve, ist - ziel);
  return { winkel: ist - drueck, reserve: reserve - drueck };
}

/**
 * Groesste Tiefe, die eine Krallenspitze in irgendeiner Stellung erreicht (m).
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
 */
export const CLAW_MAX_DEPTH: number = (() => {
  let tief = 0;
  for (let i = 0; i <= 20; i++) {
    tief = Math.max(tief, clawTipDepth((CLAW_OPEN_SPLAY * i) / 20));
  }
  return tief;
})();

