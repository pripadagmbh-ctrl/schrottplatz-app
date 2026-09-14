import * as THREE from "three";
import {
  CLAW_COUNT,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  CLAW_SEG_BEND,
  CLAW_SEG_LEN,
  CLAW_TIP_CONE,
} from "./clawGeometry";

/**
 * Die Spinne, Bauteil für Bauteil.
 *
 * Stand: zurück auf die Form vom 12.09.2026 mittags (Ansage 13.09.2026:
 * „kannst du einfach wieder die Spinne von gestern Mittag nehmen?"). Also
 * wieder Rotator, Gusstraverse und fünf Sichelkrallen — nicht die Trogschalen
 * und nicht der Gussblock mit Frästaschen, die am 12. abends und am 13.
 * morgens daraus geworden waren. Am Ring hatte jede Kralle sechs Segmente;
 * seit dem Zapfen sind es acht (`CLAW_SEGMENTS`).
 *
 * Was bleibt, ist die Zerlegung selbst. Vorher stand der ganze Greifer als
 * Block von 270 Zeilen mitten im Baggermodell, und genau das war der Grund,
 * warum die Formarbeit am 12.09. fünfmal hintereinander danebenging: Es ließ
 * sich nie ein Teil allein ändern und nie zuordnen, welche Änderung was
 * bewirkt hat. Jedes Teil hat darum weiterhin seine eigene Funktion, sein
 * eigenes Maß und seine eigene Begründung — nur eben mit den alten Maßen.
 *
 * Von oben nach unten:
 *
 *   Rotator · Traverse · Gelenkring · Kralle · Zylinder
 */

/** Die Werkstoffe der Spinne — einmal gebaut, von allen Teilen geteilt. */
export interface SpinnenStoffe {
  /** Hardox-Schalen: die großen Flächen */
  guss: THREE.MeshStandardMaterial;
  /** Fast schwarz: Kanten, Stege, Lagerböcke, Ring */
  kante: THREE.MeshStandardMaterial;
  /** Blank gedreht: Bolzen */
  bolzen: THREE.MeshStandardMaterial;
  /** Maschinengrün: Zylinderrohre */
  lack: THREE.MeshStandardMaterial;
  /** Verchromt: Kolbenstangen */
  chrom: THREE.MeshStandardMaterial;
}

export function spinnenStoffe(): SpinnenStoffe {
  return {
    /*
     * Dunkle Hardox-Schalen, fast schwarze Kanten — die Farbgebung vom
     * 12.09. mittags. Am Abend war sie auf helles Grau gezogen worden, weil
     * die Schalen zu einer einzigen Masse verschmolzen; das war aber ein
     * Problem der Trogform, nicht der Farbe. Die Segmentkralle bringt ihre
     * Kanten selbst mit — jedes Segment hat seinen eigenen dunklen Steg.
     */
    guss: new THREE.MeshStandardMaterial({ color: 0x40474b, roughness: 0.5, metalness: 0.55 }),
    kante: new THREE.MeshStandardMaterial({ color: 0x23282b, roughness: 0.45, metalness: 0.7 }),
    bolzen: new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8, metalness: 0.5 }),
    lack: new THREE.MeshStandardMaterial({ color: 0x62c94b, roughness: 0.4, metalness: 0.35 }),
    chrom: new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.22, metalness: 0.85 }),
  };
}

/** Breite der Krallensegmente, von der Wurzel zur Spitze (m). */
const SEG_BREITE = [0.4, 0.37, 0.33, 0.28, 0.22, 0.18, 0.15, 0.13];
/** Dicke der Krallensegmente, von der Wurzel zur Spitze (m). */
const SEG_DICKE = [0.16, 0.15, 0.135, 0.12, 0.105, 0.095, 0.085, 0.075];
/**
 * Anlenkung der Zylinder - abgetastet, nicht gegriffen (14.09.2026).
 *
 * Mit dem Zapfen hat sich die Aufgabe geaendert. Die Werte, die bis zum
 * 14.09. hier standen (Anlenkkreis 0,66 - Bock auf -0,52 - Lasche
 * {y -0,09; z 0,26}), waren fuer den breiten Gelenkring von 0,757 m gesucht
 * worden und fuer einen Schwenkbereich, der bei Spreizung 0 begann. Am Zapfen
 * von 0,40 m und ueber 0,5495 bis 1,555 blieb davon nichts uebrig -
 * nachgerechnet 14.09.2026 mit `tools/anlenkung-abtastung.ts`:
 *
 *   Hub 0,153 m, also haarscharf ueber der geforderten Grenze von 0,15
 *   Neigung bis 31,4 Grad statt unter 20
 *   Hebelarm offen 0,055 m, im Durchlauf bis auf 0,003 m hinunter
 *
 * Das letzte ist kein schwacher Hebel mehr, sondern ein Totpunkt: Dort steht
 * die Schale fest, gleich wie viel Druck anliegt. Die aelteren Ringwerte vom
 * 13.09. (0,84 - -0,38 - {y -0,04; z 0,20}, im Prototyp-Zweig wip/zapfen) sind
 * am Zapfen noch schlechter: Hub 0,033 m, Neigung 40,1 Grad, Hebelarm bis
 * 0,004 m.
 *
 * Neu abgetastet mit `tools/anlenkung-abtastung.ts` unter sechs Bedingungen -
 * zum Schliessen ausfahrend, Hub ueber 0,15, laenger als das Rohr, steiler als
 * 20 Grad, kein Totpunkt, frei am Gussblock vorbei - dazu zwei Schranken, die
 * aus der Bauform kommen und nicht aus der Mechanik: Der Anlenkbock darf nicht
 * breiter werden als der alte Ring, sonst steht wieder ein Schirm ueber dem
 * Korb; und die Lasche darf nicht weit aus dem Schalenruecken ragen, sonst
 * haengt sie im Schrott. Ohne diese beiden gewinnt die Suche mit einem breiten
 * Bock und einer langen Lasche - mechanisch glaenzend und genau das, was weg
 * sollte (E-007). Mit ihnen halten 1 564 Familien alle sechs Bedingungen mit
 * Reserve; die eingebaute ist eine davon.
 *
 * Uebrig bleibt ein Bock, der auf der Traversenflanke sitzt statt auf einem
 * Ausleger darueber. Nachgemessen am 14.09.2026 (21 Stuetzstellen ueber den
 * ganzen Weg, dieselben Rechenwege wie die Waechter in test/greifer.test.ts;
 * Protokoll: docs/messungen/2026-09-14_greifer-anlenkung.md):
 *
 *   Zylinderlaenge geschlossen 0,7332 m   offen 0,4571 m   Hub 0,2761 m
 *   Neigung hoechstens 7,15 Grad (bei ganz offen)
 *   Hebelarm 0,2848 m geschlossen, 0,1969 m offen, nirgends unter 0,1969 m
 *   Luft zum Gussblock: Achse 0,1164 m, Rohrmantel 0,0504 m (bei ganz offen)
 *
 * Zum SCHLIESSEN faehrt er AUS - volle Kolbenflaeche. Schliessmoment zu
 * Oeffnungsmoment: 1,446.
 *
 * Die Zahlen in diesem Block standen bis zum 14.09. auf Werten, die die
 * Messung widerlegt hat (0,62/0,36 m Laenge, 1,35 Momentverhaeltnis, 0,06 m
 * Luft). Sie stammten aus der Abtastung selbst, die mit einer eigenen
 * Laengenkonvention rechnet; hier steht jetzt, was das gebaute Modell liefert.
 */
const ZYLINDERKREIS = 0.68;

/**
 * Rotator — das Modul ganz oben, mit dem sich die Spinne dreht.
 *
 * Ein eigenes Gerät, kein Teil des Greifers: Es wird angeflanscht und ist auf
 * jedem Bild als abgesetzter Kasten zu erkennen.
 */
export function baueRotator(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const gehaeuse = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.5), st.kante);
  gehaeuse.position.y = -0.48;
  gehaeuse.castShadow = true;
  g.add(gehaeuse);
  const kappe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12), st.guss);
  kappe.position.y = -0.3;
  g.add(kappe);
  return g;
}

/**
 * Traverse — der Stahlgussblock unter dem Rotator, nach unten verjüngt.
 *
 * Fünfeckig, weil fünf Krallen daran hängen: So sitzt jede Anlenkung auf einer
 * Fläche und nicht auf einer Kante.
 */
export function baueTraverse(st: SpinnenStoffe): THREE.Mesh {
  /*
   * Kuerzer und hoeher als vorher (Ansage 13.09.2026: „der Stempel/Traverse
   * schaut so weit unten raus und verkleinert das Ladevolumen").
   *
   * Sie sass auf y −0,75 und reichte mit 0,40 m Hoehe bis −0,95 — also bis
   * genau dorthin, wo die Krallen ansetzten, und stand damit als Trichter
   * mitten im offenen Korb. Jetzt endet sie bei −0,80, und darunter laeuft nur
   * noch der schlanke Zapfen weiter.
   */
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.46, 0.3, 5), st.guss);
  m.position.y = -0.65;
  m.rotation.y = Math.PI / 5;
  m.castShadow = true;
  return m;
}

/**
 * Der ZAPFEN, an dem die fünf Krallen hängen — kein Ring mehr.
 *
 * Ansage 13.09.2026: „ich hätte die Zähne gerne eher unten am Zapfen
 * verortet." Vorher war das ein Torus von 0,757 m Radius auf y −0,9: ein
 * breiter Reifen, an dessen Außenkante die Krallen ansetzten. Von unten sah
 * die offene Spinne dadurch aus wie ein flacher Schirm mit einem Trichter in
 * der Mitte.
 *
 * Jetzt ein kurzer, dicker Stempel auf der Achse. Er läuft von der Traverse
 * herunter und trägt unten den Lagerkranz, auf dem die Krallen sitzen — das
 * ist die Bauweise, die ein Mehrschalengreifer wirklich hat.
 */
export function baueGelenkring(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  // Säule von der Traverse herunter bis auf Zapfenhöhe
  const saeule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, Math.abs(CLAW_RING_Y) - 0.8 + 0.14, 10),
    st.guss
  );
  saeule.position.y = (-0.8 + CLAW_RING_Y) / 2;
  saeule.castShadow = true;
  g.add(saeule);
  // Lagerkranz, auf dem die Krallen hängen
  const kranz = new THREE.Mesh(
    new THREE.CylinderGeometry(CLAW_RING_R, CLAW_RING_R * 0.88, 0.22, 12),
    st.kante
  );
  kranz.position.y = CLAW_RING_Y;
  kranz.castShadow = true;
  g.add(kranz);
  return g;
}

/**
 * Eine Sichelkralle: Lagerbock, `CLAW_SEGMENTS` gebogene Segmente (seit dem
 * Zapfen acht, davor sechs), stumpfe Spitze.
 *
 * Gebaut als Kette ineinandersteckender Gruppen — jedes Segment sitzt eine
 * Segmentlänge tiefer als sein Vorgänger und ist um `CLAW_SEG_BEND` weiter
 * gekippt. Das ist genau die Rechnung aus `clawPoint`, nur als Szenengraph:
 * Modell und Kollider können dadurch nicht auseinanderlaufen.
 *
 * Der zurückgegebene Knoten ist der Drehpunkt am Gelenkring. Ihn dreht der
 * Bagger um seine lokale x-Achse, um die Spinne zu öffnen.
 */
export function baueKralle(st: SpinnenStoffe, winkel: number): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(Math.sin(winkel) * CLAW_RING_R, CLAW_RING_Y, Math.cos(winkel) * CLAW_RING_R);
  pivot.rotation.order = "YXZ";
  pivot.rotation.y = winkel; // lokales +z zeigt radial nach außen

  const lagerbock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), st.kante);
  lagerbock.position.y = 0.02;
  pivot.add(lagerbock);

  let eltern: THREE.Object3D = pivot;
  for (let i = 0; i < CLAW_SEGMENTS; i++) {
    const breite = SEG_BREITE[i] ?? 0.15;
    const dicke = SEG_DICKE[i] ?? 0.085;
    const seg = new THREE.Group();
    if (i > 0) {
      seg.position.y = -CLAW_SEG_LEN;
      seg.rotation.x = CLAW_SEG_BEND;
    }
    const schale = new THREE.Mesh(
      new THREE.BoxGeometry(breite, CLAW_SEG_LEN + 0.04, dicke),
      st.guss
    );
    schale.position.y = -CLAW_SEG_LEN / 2;
    schale.castShadow = true;
    seg.add(schale);
    // dunkler Steg auf der Außenseite gibt der Schale Profil
    const steg = new THREE.Mesh(
      new THREE.BoxGeometry(breite + 0.03, CLAW_SEG_LEN + 0.05, 0.045),
      st.kante
    );
    steg.position.set(0, -CLAW_SEG_LEN / 2, dicke / 2);
    seg.add(steg);
    eltern.add(seg);
    eltern = seg;
  }

  /*
   * Stumpfes Schalenende statt Vierkantkegel: Sortiergreifer laufen wie ein
   * Löffelrand aus, nicht wie ein Spieß. Das erklärt nebenbei, warum Bleche
   * früher aufgespießt wurden.
   *
   * Die Maße stehen seit 14.09.2026 in `CLAW_TIP_CONE`, nicht mehr hier: Der
   * Kegel haengt unter der letzten Station und bestimmt damit den
   * Bodenanschlag mit. Solange die Zahlen nur an dieser Stelle standen, kannte
   * `CLAW_MAX_DEPTH` sie nicht und meldete 0,1241 m zu wenig.
   */
  const spitze = new THREE.Mesh(
    new THREE.CylinderGeometry(
      CLAW_TIP_CONE.rOben,
      CLAW_TIP_CONE.rUnten,
      CLAW_TIP_CONE.hoehe,
      8
    ),
    st.kante
  );
  spitze.position.y = -CLAW_SEG_LEN - CLAW_TIP_CONE.versatz;
  spitze.castShadow = true;
  spitze.name = "tineTip";
  eltern.add(spitze);

  return pivot;
}

/** Zylinder — Rohr und Kolbenstange, je ein eigenes Objekt. */
export function baueZylinder(st: SpinnenStoffe): { rohr: THREE.Mesh; stange: THREE.Mesh } {
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 1, 10), st.lack);
  rohr.castShadow = true;
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1, 8), st.chrom);
  return { rohr, stange };
}

/** Anlenkung eines Zylinders, wie der Bagger sie zum Nachführen braucht. */
export interface ZylinderAnlenkung {
  gelenk: THREE.Group;
  obenLokal: THREE.Vector3;
  untenAmGelenk: THREE.Vector3;
  rohr: THREE.Mesh;
  stange: THREE.Mesh;
  rohrLaenge: number;
}

export interface Spinne {
  gruppe: THREE.Group;
  /** Die fünf Krallengelenke — sie werden zum Öffnen gedreht. */
  gelenke: THREE.Group[];
  zylinder: ZylinderAnlenkung[];
}

/**
 * Die ganze Spinne aus ihren Bauteilen zusammensetzen.
 *
 * Die Gruppe hat ihren Ursprung im Kardangelenk, wie der Greifer am Stiel
 * hängt. Alle Teile sitzen relativ dazu.
 */
export function baueSpinne(st: SpinnenStoffe = spinnenStoffe()): Spinne {
  const gruppe = new THREE.Group();
  gruppe.add(baueRotator(st));
  gruppe.add(baueTraverse(st));
  gruppe.add(baueGelenkring(st));

  const gelenke: THREE.Group[] = [];
  const zylinder: ZylinderAnlenkung[] = [];
  for (let i = 0; i < CLAW_COUNT; i++) {
    const a = (i / CLAW_COUNT) * Math.PI * 2;
    const gelenk = baueKralle(st, a);
    gruppe.add(gelenk);
    gelenke.push(gelenk);

    const { rohr, stange } = baueZylinder(st);
    gruppe.add(rohr);
    gruppe.add(stange);
    zylinder.push({
      gelenk,
      obenLokal: new THREE.Vector3(
        Math.sin(a) * ZYLINDERKREIS,
        -0.40,
        Math.cos(a) * ZYLINDERKREIS
      ),
      untenAmGelenk: new THREE.Vector3(0, -0.22, 0.2),
      rohr,
      stange,
      rohrLaenge: 0.28,
    });
  }
  return { gruppe, gelenke, zylinder };
}

/** Alle Bauteile einzeln, für den Prüfstand. */
export function einzelteile(st: SpinnenStoffe = spinnenStoffe()): Array<{
  name: string;
  teil: THREE.Object3D;
}> {
  const { rohr, stange } = baueZylinder(st);
  rohr.scale.y = 0.28;
  stange.scale.y = 0.3;
  stange.position.y = -0.28;
  const zyl = new THREE.Group();
  zyl.add(rohr, stange);
  return [
    { name: "Rotator", teil: baueRotator(st) },
    { name: "Traverse", teil: baueTraverse(st) },
    { name: "Gelenkring", teil: baueGelenkring(st) },
    { name: "Zylinder", teil: zyl },
    { name: "Kralle", teil: baueKralle(st, 0) },
  ];
}
