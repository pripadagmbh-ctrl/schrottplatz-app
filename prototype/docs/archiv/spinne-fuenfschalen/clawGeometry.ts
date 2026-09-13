import * as THREE from "three";
import {
  ABSCHNITT,
  MASS,
  OFFEN,
  SCHALEN_ABSCHNITTE,
  SCHALEN_BOGEN,
  STEMPEL_AUGE,
  ZU,
  schalenStationen,
} from "../grapple/teile";

/**
 * Geometrie der Spinne — die eine Wahrheit für Modell, Kollider und
 * Bodenanschlag.
 *
 * Stand 13.09.2026: Der Bagger trägt jetzt den Fünfschalengreifer nach der
 * Explosionszeichnung. Vorher lagen hier eigene Zahlen für eine Sichelkralle,
 * und daneben stand in `src/grapple/` ein zweites, genaueres Modell, das nur
 * die Vorschauseite zu sehen bekam. Genau davor warnt E-154: Zwei Modelle
 * laufen auseinander, sobald man an einem von beiden etwas ändert. Deshalb
 * steht hier keine Zahl mehr, sondern nur noch die Ableitung.
 *
 * Die alte Sichelform liegt unter `docs/archiv/spinne-sichel/`.
 *
 * Was sich damit im Spiel ändert, nachgemessen:
 *
 *            alt (Sichel)   neu (Fünfschalen)
 *   offen      3,38 m           2,30 m
 *   geschlossen 1,51 m          1,78 m
 *   Bauhöhe     2,14 m          2,49 m
 *
 * Der Greifer nimmt also einen kleineren Biss, baut aber höher. Beides folgt
 * aus der Positionsliste und ist nicht frei gewählt — die Herleitung steht in
 * `src/grapple/teile.ts` und in `docs/greifer-mehrschalen.md`.
 */

/** Radius des Bolzenkreises, an dem die Schalen hängen (Stempelauge). */
export const CLAW_RING_R = STEMPEL_AUGE.r;
/** Höhe dieses Kreises, gemessen ab Kardangelenk. */
export const CLAW_RING_Y = STEMPEL_AUGE.y;
/** Länge eines Schalenabschnitts (m). */
export const CLAW_SEG_LEN = ABSCHNITT;
/** Krümmung je Abschnitt (rad). */
export const CLAW_SEG_BEND = SCHALEN_BOGEN;
/** Abschnitte je Schale. */
export const CLAW_SEGMENTS = SCHALEN_ABSCHNITTE;
/** Zahl der Schalen. */
export const CLAW_COUNT = MASS.schalen;
/** Spreizung offen (rad) — der Öffnungsanschlag der Schalen. */
export const CLAW_OPEN_SPLAY = OFFEN;
/**
 * Spreizung geschlossen (rad).
 *
 * Null, und das ist keine Rundung: Der Radius der Schalenmittellinie fällt von
 * Station zu Station um `ABSCHNITT · sin(θ − Spreizung)`. Nicht-positiv ist das
 * genau dann, wenn die geschlossene Spreizung den Anstellwinkel der obersten
 * Station nicht übersteigt. Nur so schließt die Spinne zur Birne statt zum Fass.
 */
export const CLAW_CLOSED_SPLAY = ZU;

export const CLAW_BEND_KUM: number[] = Array.from(
  { length: CLAW_SEGMENTS + 1 },
  (_, i) => i * CLAW_SEG_BEND
);

/**
 * Stützstellen der Schale im Frame ihres Drehpunkts — einmal gerechnet.
 *
 * `clawPoint` läuft pro Bild für jede Schale und jede Station mehrfach; eine
 * Neuberechnung (oder gar ein neues Array) je Aufruf wäre auf dem Tablet
 * spürbar. Die Stationen ändern sich nie, nur die Drehung um sie.
 */
const STATIONEN = schalenStationen();

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
  const p = STATIONEN[Math.max(0, Math.min(CLAW_SEGMENTS, Math.round(k)))]!;
  const c = Math.cos(-splay);
  const sn = Math.sin(-splay);
  const r = CLAW_RING_R + (p.y * sn + p.z * c);
  const y = CLAW_RING_Y + (p.y * c - p.z * sn);
  return out.set(Math.sin(a) * r, y, Math.cos(a) * r);
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
export const NACHDRUECK_RESERVE = 0.12;
/**
 * Dasselbe fuer Nachgiebiges: Blech, Faesser, Weisse Ware, Kabinen.
 *
 * Der Zahn drueckt sich hier deutlich weiter hinein als in massiven Stahl —
 * gut das Dreifache, am Zahnende rund 45 cm — und steht dann. Vorher gab es
 * fuer solches Material gar keine Grenze: Es galt nicht als Hindernis, der
 * Zahn lief bis zum Anschlag durch das Teil hindurch (Ansage 12.09.2026:
 * „eine gewisse Starre bzw. Kraft muss jeder Zahn haben").
 */
export const WEICH_RESERVE = 0.4;
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

