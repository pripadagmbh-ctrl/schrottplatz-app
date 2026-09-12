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
export const CLAW_RING_R = 0.82;
/** Unterkante Traverse, gemessen ab Kardangelenk */
export const CLAW_RING_Y = -0.9;
/** Länge eines Krallensegments */
export const CLAW_SEG_LEN = 0.2140;
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
 *   Station   1    2    3    4    5    6    7    8
 *   Winkel   0°   6°  13°  22°  33°  46°  61°  78°
 *
 * Der Endwinkel bestimmt die Bauform, und zwar allein. Gemessen wurde er am
 * Foto des Sennebogen-Greifers, im direkten Vergleich mit dem gebauten Modell
 * nebeneinander — aus dem Gedächtnis ging es dreimal daneben. Das Maß ist die
 * Breite der offenen Schalen geteilt durch ihre Tiefe, auf der Vorlage rund 2,8:
 *
 *   Endwinkel      55°    70°    78°    85°    95°   115°
 *   Breite/Tiefe  1,94   2,55   2,93   3,23   3,64   4,15
 *   Tiefe/Ring    1,19   0,91   0,80   0,72   0,62   0,47
 *
 * Zwischendurch standen hier 55°. Das war ein Fehlschluss aus dem ersten Foto
 * (Rotobec): Dessen Zinken sind lang und schlank, die Schalen des Sennebogen
 * dagegen breit, rund und gedrungen — zwei verschiedene Bauarten. Maßgeblich
 * ist die zweite.
 *
 * Die Zahlen sind so skaliert, dass die Spitzen bei geschlossener Spinne genau
 * auf der Achse zusammenkommen. Wer daran dreht, muss das nachrechnen — sonst
 * laufen die Schalen übereinander oder es bleibt ein Loch.
 */
const BEND_PROFIL = Array.from({ length: CLAW_SEGMENTS }, (_, i) =>
  0.32413 * (0.3 + 0.7 * (i / (CLAW_SEGMENTS - 1)))
);
/** Aufsummierte Krümmung bis Station `i`. */
export const CLAW_BEND_KUM: number[] = BEND_PROFIL.reduce<number[]>(
  (acc, b2) => [...acc, (acc[acc.length - 1] ?? 0) + b2],
  [0]
);
/** Zahl der Krallen */
export const CLAW_COUNT = 5;
/**
 * Spreizung der ganz offenen Spinne (rad).
 *
 * Sie hängt am Krümmungsprofil: Je stärker die Schale eingerollt ist, desto
 * weiter muss sie schwenken, um dieselbe Weite zu öffnen. Mit dem 78°-Profil:
 *
 *   Spreizung     1,20   1,30   1,35   1,40
 *   Öffnungsweite 3,48   3,72   3,83   3,94  (m)
 *
 * 1,30 gewählt: 3,72 m Weite. Die Behälter auf dem Platz messen 4,7 m licht,
 * das reicht mit Luft.
 */
export const CLAW_OPEN_SPLAY = 1.30;

/**
 * Halbe Winkelbreite einer Schale (rad).
 *
 * Das ist der Kern der Neufassung vom 12.09.2026 („die Schalen müssen komplett
 * abschließen"). Vorher war jede Kralle ein Finger von fester Breite — 0,40 m
 * oben, 0,15 m an der Spitze. Fünf davon auf einem Kreis von 0,757 m Radius:
 * Jede hat 0,95 m Bogen zur Verfügung und füllt 0,40 m davon. Mehr als die
 * Hälfte des Umfangs war Lücke, und deshalb schloss der Korb nie.
 *
 * Eine Schale bekommt ihren Anteil am Kreis: 360°/5 = 72°, also 36° zu jeder
 * Seite, davon 2° Luft für das Gelenk. Damit stoßen die Schalen über ihre
 * ganze Länge aneinander.
 *
 * Zwischendurch waren es 21°, weil die offenen Greifer auf den Vorlagen breite
 * Lücken zeigen. Am zweiten Foto (Sennebogen-Mehrschalengreifer, 12.09.2026)
 * nachgemessen ist das ein Trugschluss: Der Zinkenkreis misst dort rund 330 px,
 * sein Umfang also 1040 px, macht 207 px je Schale — und jede Schale ist etwa
 * 180 px breit, also 87 % ihres Abschnitts. Die Lücken entstehen erst durch das
 * Öffnen, wenn die Schalen auseinanderschwenken.
 *
 * Nebenbei erledigt sich damit der zweite Wunsch von selbst: „gern oben
 * breiter als unten". Bei fester Winkelbreite folgt die Bogenbreite dem
 * Radius, und der schrumpft zur Spitze hin:
 *
 *   Station   0      1      2      3      4      5      6      7      8
 *   Radius  0,757  0,757  0,744  0,708  0,642  0,536  0,390  0,207  ~0
 *   Breite  0,79   0,79   0,78   0,74   0,67   0,56   0,41   0,22   0  (m)
 */
export const CLAW_SHELL_HALF = (Math.PI / CLAW_COUNT) * (34 / 36);
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
/**
 * Rippe auf dem Ruecken einer Schale.
 *
 * Auf den Vorlagen laeuft ueber jede Schale ein erhabener Steg — daran
 * erkennt man, dass es ein Gussteil ist und keine gebogene Platte. Ohne ihn
 * ist die Schale eine glatte Flaeche, und glatte Flaechen dieser Groesse
 * lesen sich als Kunststoff (Befund 12.09.2026).
 *
 * Gebaut wie die Schale selbst, nur schmal und ein Stueck weiter aussen.
 */
export function rippenGeometrie(): THREE.BufferGeometry {
  return schalenGeometrie(0, CLAW_SHELL_HALF * 0.26, 0.075);
}

/**
 * Seitenwange an einer Kante der Schale.
 *
 * `seite` ist −1 oder +1. Die Wange ist ein schmaler Streifen genau auf der
 * Kante und steht ein Stueck weiter aussen als die Schale — daraus wird ein
 * Profil, das Licht faengt, statt einer glatten Flaeche.
 */
/**
 * Seitenwange einer Schale — das tragende Blech, nicht nur eine Kante.
 *
 * Die Schale ist kein Spaltstueck einer Glocke, sondern ein geschweisster
 * Trog: zwei ebene Wangen, dazwischen eine Haut (Befund 12.09.2026: „ich
 * glaub dein Ansatz ist falsch"). Die Wange steht darum nicht als schmale
 * Rippe auf der Flaeche, sondern reicht als tiefes Blech nach innen — 34 cm
 * gegenueber 8,5 cm Hautstaerke. Genau daran sieht man von der Seite, dass da
 * Blech steht und nicht eine gewoelbte Flaeche.
 */
export function flanschGeometrie(seite: number): THREE.BufferGeometry {
  return schalenGeometrie(0, 0.055, 0.03, CLAW_SHELL_HALF * seite, WANGEN_TIEFE);
}

/** Wie tief die Wangen nach innen reichen (m). */
export const WANGEN_TIEFE = 0.34;
/** Wie weit die Haut hinter der Aussenkante der Wangen zurueckliegt (m). */
export const HAUT_RUECKSPRUNG = 0.1;

export function schalenGeometrie(
  vonStation = 0,
  halbWinkel = CLAW_SHELL_HALF,
  hinaus = 0,
  mitte = 0,
  dicke = CLAW_SHELL_DICKE
): THREE.BufferGeometry {
  /*
   * Fünf Facetten über die Breite, nicht zehn.
   *
   * Der ganze Platz ist flächig gebaut — Bäume, Fahrzeuge, Container, alles
   * hat sichtbare Facetten. Eine fein unterteilte, weich schattierte Schale
   * liest sich dazwischen wie ein Körper aus einem anderen Spiel: aufgeblasen
   * und organisch statt gekantet (Befund 12.09.2026: „so sieht doch keine
   * Spinne aus"). Wenige Facetten und harte Kanten machen daraus Blech.
   */
  const BOGEN = 5;
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
      const r = Math.max(0.012, st.r + hinaus - seite * dicke);
      const reihe: number[] = [];
      for (let j = 0; j <= BOGEN; j++) {
        const u = mitte - halbWinkel + (j / BOGEN) * 2 * halbWinkel;
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
  /*
   * Ohne Index heisst: jede Facette hat ihre eigenen Ecken und damit ihre
   * eigene Normale. Genau das gibt die harten Kanten. Mit gemeinsamen Ecken
   * mittelt `computeVertexNormals` ueber die Nachbarflaechen und glaettet die
   * Schale zu einer weichen Wölbung — das war der Grund, warum sie aussah wie
   * ein Blütenblatt.
   */
  const flach = geo.toNonIndexed();
  geo.dispose();
  flach.computeVertexNormals();
  return flach;
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
