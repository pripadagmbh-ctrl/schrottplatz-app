import * as THREE from "three";

/**
 * Geometrie der Spinne — die eine Wahrheit für Modell, Kollider und
 * Bodenanschlag.
 *
 * Die Maße folgen dem Datenblatt der Sennebogen MG4.1-800-HO5. Mesh und
 * Kollider leiten sich beide hieraus ab, damit die Krallen physisch dort
 * sind, wo man sie sieht: Früher waren die Zahlen an drei Stellen kopiert,
 * und nach einer Formänderung stimmte der Bodenanschlag nicht mehr.
 */

/** Gelenkkreis der Schalen = ØC/2 laut Datenblatt (1514 mm) */
export const CLAW_RING_R = 0.757;
/** Unterkante Traverse, gemessen ab Kardangelenk */
export const CLAW_RING_Y = -0.9;
/** Länge eines Krallensegments */
export const CLAW_SEG_LEN = 0.21;
/** Segmente je Kralle */
export const CLAW_SEGMENTS = 8;
/**
 * Krümmung der Sichel, Station für Station (rad).
 *
 * Nicht gleichmäßig, sondern nach hinten zunehmend — das ist der Unterschied
 * zwischen einem Kreisbogen und der Sichel eines echten Schrottgreifers
 * (Vorlage 12.09.2026, Rotobec-Mehrschalengreifer). Oben läuft die Schale fast
 * senkrecht, unten hakt sie scharf nach innen:
 *
 *   Station        1    2    3    4    5    6    7    8
 *   gleichmäßig   0°   9°  17°  26°  35°  43°  52°  61°
 *   so            0°   4°  10°  19°  30°  44°  61°  80°
 *
 * Die Zahlen sind so skaliert, dass die Spitzen bei geschlossener Spinne genau
 * auf der Achse zusammenkommen (Radius 0,000 an Station 8) und die Tiefe von
 * 1,30 m erhalten bleibt. Wer daran dreht, muss beides nachrechnen — sonst
 * laufen die Schalen übereinander oder es bleibt ein Loch.
 */
const BEND_PROFIL = Array.from({ length: CLAW_SEGMENTS }, (_, i) =>
  0.207 * (0.3 + 1.55 * (i / (CLAW_SEGMENTS - 1)))
);
/** Aufsummierte Krümmung bis Station `i`. */
export const CLAW_BEND_KUM: number[] = BEND_PROFIL.reduce<number[]>(
  (acc, b2) => [...acc, (acc[acc.length - 1] ?? 0) + b2],
  [0]
);
/** Zahl der Krallen */
export const CLAW_COUNT = 5;
/**
 * Spreizung der ganz offenen Spinne (rad). Das Datenblatt nennt 2225 mm
 * Öffnungsweite (entspräche 0,8) — zum Spielen ist das zu eng, der Greifer
 * soll weit aufreißen und ordentlich Volumen fassen.
 */
export const CLAW_OPEN_SPLAY = 1.25;

/**
 * Halbe Winkelbreite einer Schale (rad).
 *
 * Das ist der Kern der Neufassung vom 12.09.2026 („die Schalen müssen komplett
 * abschließen"). Vorher war jede Kralle ein Finger von fester Breite — 0,40 m
 * oben, 0,15 m an der Spitze. Fünf davon auf einem Kreis von 0,757 m Radius:
 * Jede hat 0,95 m Bogen zur Verfügung und füllt 0,40 m davon. Mehr als die
 * Hälfte des Umfangs war Lücke, und deshalb schloss der Korb nie.
 *
 * Eine Schale bekommt jetzt ihren Anteil am Kreis: 360°/5 = 72°, also 36° zu
 * jeder Seite, davon 2° Luft für das Gelenk. Damit stoßen die Schalen über
 * ihre ganze Länge aneinander.
 *
 * Nebenbei erledigt sich damit der zweite Wunsch von selbst: „gern oben
 * breiter als unten". Bei fester Winkelbreite folgt die Bogenbreite dem
 * Radius, und der schrumpft zur Spitze hin:
 *
 *   Station   0      1      2      3      4      5      6      7      8
 *   Radius  0,757  0,757  0,744  0,708  0,642  0,536  0,390  0,207  ~0
 *   Breite  0,79   0,79   0,78   0,74   0,67   0,56   0,41   0,22   0  (m)
 */
export const CLAW_SHELL_HALF = (Math.PI / CLAW_COUNT) * (30 / 36);
/** Blechstärke der Schale (m) — sie ist ein Hohlkörper, kein Vollprofil. */
export const CLAW_SHELL_DICKE = 0.085;
/**
 * Kleinster Radius, bis zu dem die Schale läuft.
 *
 * Genau auf der Achse liefen alle fünf Spitzen in einen Punkt; dort
 * durchdringen sie sich und flackern. Sie hören darum kurz davor auf. Das
 * verbleibende Loch von gut zehn Zentimetern hat ein echter Greifer auch.
 */
const SCHALE_MIN_R = 0.055;

/**
 * Geometrie einer Schale, im Frame ihres Gelenks.
 *
 * `vonStation` schneidet oben ab: 0 ist die ganze Schale, 5 nur noch der
 * unterste Abschnitt. Damit laesst sich derselbe Bau fuer den dunklen
 * Schneidenrand verwenden, ohne die Form ein zweites Mal zu beschreiben.
 *
 * Die Umrechnung ist einfacher, als sie aussieht: Ein Punkt, der im Frame der
 * Spinne bei Radius `r`, Winkel `a + u` und Höhe `y` liegt, hat im Frame des
 * Gelenks — das bei Radius `CLAW_RING_R` unter dem Winkel `a` sitzt und um `a`
 * gedreht ist — immer die Koordinaten
 *
 *     (r·sin u, y, r·cos u − CLAW_RING_R)
 *
 * unabhängig davon, um welche der fünf Schalen es geht. Damit lässt sich die
 * Schale einmal bauen und fünfmal verwenden.
 *
 * Gebaut wird sie als Hohlkörper: Außenfläche auf dem Radius der Krallenkurve,
 * Innenfläche eine Blechstärke weiter innen, dazu die beiden Seitenwangen, der
 * Rand oben und die stumpfe Spitze.
 */
export function schalenGeometrie(vonStation = 0): THREE.BufferGeometry {
  const BOGEN = 10; // Unterteilungen über die Breite
  const stationen: Array<{ y: number; r: number }> = [];
  let y = 0;
  let z = 0;
  for (let k = 0; k <= CLAW_SEGMENTS; k++) {
    stationen.push({ y, r: Math.max(SCHALE_MIN_R, CLAW_RING_R + z) });
    const th = CLAW_BEND_KUM[k] ?? 0;
    y -= CLAW_SEG_LEN * Math.cos(th);
    z -= CLAW_SEG_LEN * Math.sin(th);
  }

  const pos: number[] = [];
  const idx: number[] = [];
  const punkt = (r: number, u: number, yy: number): number => {
    const i = pos.length / 3;
    pos.push(r * Math.sin(u), yy, r * Math.cos(u) - CLAW_RING_R);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };

  // Gitter: [aussen | innen] × Station × Bogen
  const gitter: number[][][] = [];
  const teil = stationen.slice(vonStation);
  for (const seite of [0, 1]) {
    const lagen: number[][] = [];
    for (const st of teil) {
      const r = Math.max(0.012, st.r - seite * CLAW_SHELL_DICKE);
      const reihe: number[] = [];
      for (let j = 0; j <= BOGEN; j++) {
        const u = -CLAW_SHELL_HALF + (j / BOGEN) * 2 * CLAW_SHELL_HALF;
        reihe.push(punkt(r, u, st.y));
      }
      lagen.push(reihe);
    }
    gitter.push(lagen);
  }
  const [aussen, innen] = gitter as [number[][], number[][]];

  const letzte = teil.length - 1;
  for (let k = 0; k < letzte; k++) {
    for (let j = 0; j < BOGEN; j++) {
      // Aussenhaut zeigt nach aussen, Innenhaut nach innen — daher die
      // umgekehrte Reihenfolge.
      quad(aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      quad(innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    // Seitenwangen links und rechts
    quad(aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    quad(innen[k]![BOGEN]!, aussen[k]![BOGEN]!, aussen[k + 1]![BOGEN]!, innen[k + 1]![BOGEN]!);
  }
  // Rand oben und stumpfe Spitze unten
  for (let j = 0; j < BOGEN; j++) {
    quad(innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    const e = letzte;
    quad(aussen[e]![j]!, aussen[e]![j + 1]!, innen[e]![j + 1]!, innen[e]![j]!);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Punkt auf einer Kralle nach `k` Segmenten, im Frame der Spinne.
 *
 * @param a Umfangswinkel der Kralle (0 … 2π)
 * @param splay Öffnungswinkel: 0 = geschlossen, CLAW_OPEN_SPLAY = ganz offen
 * @param k Segment, bis zu dem gerechnet wird (0 = Gelenk, CLAW_SEGMENTS = Spitze)
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
    const th = -splay + (CLAW_BEND_KUM[i] ?? 0);
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
 * Tiefe der Krallenspitze unter dem Ursprung der Spinne. Daraus ergibt sich
 * der Bodenanschlag — der Greifer darf nie in den Beton sinken.
 */
export function clawTipDepth(splay: number): number {
  return -clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3()).y;
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
 *
 * Was nachgibt — Blech, Kabel, Fässer — gilt gar nicht erst als blockierend;
 * das entscheidet der Aufrufer. Ein Greifer quetscht solche Teile platt oder
 * schiebt sie beiseite, statt an ihnen hängen zu bleiben.
 *
 * @param ist       aktueller Winkel dieser Kralle
 * @param ziel      Winkel, den der Fahrer kommandiert
 * @param schritt   was in diesem Bild höchstens zurückgelegt wird (rad)
 * @param blockiert ob bei `ist - schritt` etwas Massives im Weg wäre
 * @param reserve   verbleibendes Nachdrücken dieser Kralle
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
