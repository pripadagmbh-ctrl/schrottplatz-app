import * as THREE from "three";
import {
  clawPoint,
  flanschGeometrie,
  schalenGeometrie,
  CLAW_BEND_KUM,
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  CLAW_SHELL_BREITE,
  HAUT_RUECKSPRUNG,
  SPIEL_MASSSTAB,
} from "./clawGeometry";

/**
 * Die Spinne, Bauteil für Bauteil.
 *
 * Vorher stand der ganze Greifer als ein Block von 270 Zeilen mitten im
 * Baggermodell. Das war der eigentliche Grund, warum die Formarbeit am
 * 12.09.2026 fünfmal hintereinander danebenging: Ich habe immer das Ganze auf
 * einmal geändert und konnte nie zuordnen, welche Änderung was bewirkt hat.
 *
 * Jedes Teil hat jetzt seine eigene Funktion, sein eigenes Maß und seine
 * eigene Begründung. Der Prüfstand kann sie einzeln nebeneinanderstellen, und
 * wer eines ändert, sieht genau dieses eine Teil vorher und nachher.
 *
 * Reihenfolge von oben nach unten:
 *
 * Die Nummern folgen dem Baugruppenblatt vom 13.09.2026:
 *
 *   1 Aufhaengung · 2 Drehwerk · 3 Greiferkopf · 4 Zylinder ·
 *   5 Schale · 6 Gelenk · 7 Hydraulik · 8 Verschleissteile
 */

/** Die Werkstoffe der Spinne — einmal gebaut, von allen Teilen geteilt. */
export interface SpinnenStoffe {
  /** Gusseisen, hell und matt: die großen Flächen */
  guss: THREE.MeshStandardMaterial;
  /** Eine Spur dunkler: Kanten, Absätze, Lagerböcke */
  kante: THREE.MeshStandardMaterial;
  /** Blank gedreht: Bolzen */
  bolzen: THREE.MeshStandardMaterial;
  /** Ocker: Zylinderrohre */
  lack: THREE.MeshStandardMaterial;
  /** Verchromt: Kolbenstangen */
  chrom: THREE.MeshStandardMaterial;
}

export function spinnenStoffe(): SpinnenStoffe {
  return {
    /*
     * Heller, matter Guss.
     *
     * 0x40474b war so dunkel, dass die Schalen zu einer einzigen Masse
     * verschmolzen; ohne erkennbare Kanten liest sich das Ding als glatter
     * Körper statt als Maschine. Auf den Vorlagen ist der Greifer helles,
     * abgeschabtes Grau.
     */
    guss: new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.62, metalness: 0.45 }),
    /*
     * Nur eine Spur dunkler. Mit einem deutlich dunkleren Kantenmaterial
     * zerfiel der Greifer in schwarze Einzelteile, und die Zähne stachen als
     * Pfeile heraus (Befund 12.09.2026).
     */
    kante: new THREE.MeshStandardMaterial({ color: 0x89919a, roughness: 0.5, metalness: 0.6 }),
    bolzen: new THREE.MeshStandardMaterial({ color: 0x3c4248, roughness: 0.3, metalness: 0.85 }),
    /*
     * Ocker, nicht Maschinengruen.
     *
     * Auf dem Baugruppenblatt (13.09.2026) sind die Zylinder das einzige
     * farbige Teil am ganzen Greifer — daran liest man die Maschine ab.
     * In Gruen verschwanden sie zwischen den grauen Gussteilen.
     */
    lack: new THREE.MeshStandardMaterial({ color: 0xd9a227, roughness: 0.45, metalness: 0.3 }),
    chrom: new THREE.MeshStandardMaterial({ color: 0xd0d6dc, roughness: 0.14, metalness: 0.92 }),
  };
}

/** Kurz fuer den Spielmassstab — die Handmasse der unteren Teile haengen daran. */
const M = SPIEL_MASSSTAB;
/**
 * Die beiden Masse, an denen der ganze Kopf haengt.
 *
 * Nicht in Metern gebaut, sondern in Anteilen von Bolzenkreis und Kopfhoehe.
 * Beim ersten Anlauf am 13.09.2026 standen hier Meterwerte, die ich schon in
 * Spielgroesse gerechnet und dann nochmal mit dem Massstab multipliziert
 * hatte — der Grundkoerper wurde dadurch unten breiter als der Bolzenkreis,
 * die Schalen sassen also INNERHALB des Kopfes. In Anteilen kann das nicht
 * passieren.
 */
const RK = CLAW_RING_R;
const KH = -CLAW_RING_Y;

/**
 * (1) Aufhaengung — Adapterplatte und Gabel, mit der die Spinne am Stiel haengt.
 *
 * Auf dem Baugruppenblatt (13.09.2026) ist das die oberste Gruppe: Adapter-
 * platte, Bolzen, darueber die Pendelaufhaengung. Im Modell gab es das bisher
 * gar nicht — die Spinne begann beim Drehmotor und hing sichtbar im Nichts.
 *
 * Die Gabel ist das Erkennungsmerkmal: zwei Ohren mit einer Bohrung, dazwischen
 * der Bolzen. Genau daran sieht man, dass das Ding abnehmbar ist.
 */
export function baueAufhaengung(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  for (const seite of [-1, 1]) {
    const ohr = new THREE.Mesh(
      new THREE.BoxGeometry(0.11 * RK, 0.25 * KH, 0.32 * RK),
      st.kante
    );
    ohr.position.set(seite * 0.19 * RK, -0.07 * KH, 0);
    ohr.castShadow = true;
    g.add(ohr);
  }
  const bolzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088 * RK, 0.088 * RK, 0.57 * RK, 12),
    st.bolzen
  );
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.y = -0.03 * KH;
  bolzen.castShadow = true;
  g.add(bolzen);
  const platte = new THREE.Mesh(
    new THREE.BoxGeometry(0.68 * RK, 0.065 * KH, 0.68 * RK),
    st.guss
  );
  platte.position.y = -0.155 * KH;
  platte.castShadow = true;
  g.add(platte);
  return g;
}

/**
 * (2) Drehwerk — Hydraulikmotor, Getriebe, Lager, Drehdurchfuehrung.
 *
 * Ein abgesetzter runder Turm zwischen Adapter und Kopf, unten mit dem
 * Drehkranz. Vorher war das ein Kasten; auf allen Vorlagen ist es ein Zylinder
 * mit deutlichem Flanschring, und der Ring ist das, woran man die Gruppe
 * ueberhaupt erkennt.
 */
export function baueDrehwerk(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const gehaeuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.285 * RK, 0.32 * RK, 0.16 * KH, 12),
    st.kante
  );
  gehaeuse.position.y = -0.225 * KH;
  gehaeuse.castShadow = true;
  g.add(gehaeuse);
  // Drehkranz: der breite Flansch, auf dem der Kopf sitzt
  const kranz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38 * RK, 0.38 * RK, 0.065 * KH, 16),
    st.guss
  );
  kranz.position.y = -0.3 * KH;
  kranz.castShadow = true;
  g.add(kranz);
  // Drehdurchfuehrung: der Stutzen an der Seite, an dem die Schlaeuche sitzen
  const stutzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065 * RK, 0.065 * RK, 0.22 * RK, 8),
    st.bolzen
  );
  stutzen.rotation.z = Math.PI / 2;
  stutzen.position.set(0.33 * RK, -0.21 * KH, 0);
  g.add(stutzen);
  return g;
}

/**
 * (3) Greiferkopf / Mittelteil — Grundkoerper, Zylinderaufnahmen, Lageraufnahmen.
 *
 * Der Kern der Maschine, und der Teil, den ich bis zum 13.09.2026 falsch hatte.
 * Er bestand aus einer „Birne" und einem duennen „Strunk" mit Prisma darunter,
 * an dem die Schalen haengen sollten. Auf dem Baugruppenblatt ist das ein
 * einziges Gussteil: ein nach unten breiter werdender Koerper, oben die Ohren
 * fuer die Zylinder, unten am Rand die Lageraufnahmen fuer die Schalenbolzen.
 *
 * Der Unterschied ist nicht kosmetisch. Der Strunk endete bei einem knappen
 * Drittel des Bolzenkreises — dazwischen war schlicht Luft, und die Schalen
 * hingen an nichts. Jetzt reicht der Koerper bis auf vier Fuenftel heran, und
 * die Lageraufnahmen ueberbruecken den Rest.
 */
export function baueGreiferkopf(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const OBEN = -0.28 * KH;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72 * RK, 0.66 * RK, OBEN - CLAW_RING_Y + 0.04 * KH, 10),
    st.guss
  );
  koerper.position.y = (OBEN + CLAW_RING_Y) / 2;
  koerper.rotation.y = Math.PI / 10;
  koerper.castShadow = true;
  g.add(koerper);
  // Unterer Rand: der kraeftige Flansch, auf dem die Lageraufnahmen sitzen
  const rand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72 * RK, 0.66 * RK, 0.09 * KH, 10),
    st.kante
  );
  rand.position.y = CLAW_RING_Y + 0.04 * KH;
  rand.rotation.y = Math.PI / 10;
  rand.castShadow = true;
  g.add(rand);

  for (let i = 0; i < CLAW_COUNT; i++) {
    const a = (i / CLAW_COUNT) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    // Zylinderaufnahme: das Ohr, das neben dem Drehwerk nach oben steht
    const ohr = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * RK, 0.15 * KH, 0.32 * RK),
      st.kante
    );
    ohr.position.set(sin * 0.79 * RK, -0.451 * KH, cos * 0.79 * RK);
    ohr.rotation.y = a;
    ohr.castShadow = true;
    g.add(ohr);
    // Lageraufnahme: der Arm vom Rand hinaus zum Schalenbolzen
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.26 * RK, 0.17 * KH, 0.4 * RK),
      st.kante
    );
    arm.position.set(sin * 0.82 * RK, CLAW_RING_Y + 0.05 * KH, cos * 0.82 * RK);
    arm.rotation.y = a;
    arm.castShadow = true;
    g.add(arm);
  }
  return g;
}

/**
 * Gelenk einer Schale — Lagerbock, Drehbolzen, Laschenbolzen, Lasche.
 *
 * Auf der Maßskizze (P25VR HD-3-W, 12.09.2026) hat jede Schale zwei Bolzen
 * dicht beieinander: unten den Drehbolzen zum Rahmen, darüber den Bolzen für
 * die Lasche. Dazwischen liegt der Hebelarm, und dass er kurz ist, ist der
 * Grund für die Griffkraft.
 *
 * Beides waren vorher gedachte Punkte ohne Bauteil — die Kolbenstange endete
 * sichtbar im Nichts.
 */
export function baueGelenk(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const lagerbock = new THREE.Mesh(new THREE.BoxGeometry(0.34 * M, 0.28 * M, 0.26 * M), st.kante);
  lagerbock.position.set(0, 0.04 * M, 0.03 * M);
  lagerbock.castShadow = true;
  g.add(lagerbock);
  /*
   * Der Drehbolzen liegt quer zur Schale, also entlang der lokalen x-Achse —
   * genau der Achse, um die das Gelenk schwenkt. Er ragt beidseits heraus, wie
   * ein gesicherter Bolzen es tut.
   */
  const dreh = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * M, 0.075 * M, 0.5 * M, 10), st.bolzen);
  dreh.rotation.z = Math.PI / 2;
  dreh.castShadow = true;
  g.add(dreh);
  const laschenBolzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055 * M, 0.055 * M, 0.34 * M, 10),
    st.bolzen
  );
  laschenBolzen.rotation.z = Math.PI / 2;
  laschenBolzen.position.copy(LASCHE_AM_GELENK);
  laschenBolzen.castShadow = true;
  g.add(laschenBolzen);
  const lasche = new THREE.Mesh(
    new THREE.BoxGeometry(0.1 * M, LASCHE_AM_GELENK.y * 1.1, 0.14 * M),
    st.kante
  );
  lasche.position.set(0, LASCHE_AM_GELENK.y * 0.55, LASCHE_AM_GELENK.z * 0.55);
  lasche.rotation.x = Math.atan2(LASCHE_AM_GELENK.z, LASCHE_AM_GELENK.y);
  lasche.castShadow = true;
  g.add(lasche);
  return g;
}

/**
 * Wo die Kolbenstange am Gelenk angreift — Bolzenmitte im Gelenkframe.
 *
 * Ueber dem Drehbolzen und deutlich nach aussen: Auf dem Baugruppenblatt sitzt
 * an jeder Schale hinten ein Ausleger, und daran greift die Stange an. Die
 * Lage ist nicht gegriffen, sondern abgetastet (13.09.2026) unter drei
 * Bedingungen:
 *
 *   - Der Zylinder muss frei NEBEN dem Grundkoerper stehen. Beim ersten Anlauf
 *     lag die Lasche innen; die Zylinder verschwanden dadurch komplett im Kopf
 *     und waren im Bild nicht zu sehen.
 *   - Der Hub soll rund ein Viertel der Laenge betragen: 0,61 m geschlossen,
 *     0,85 m offen.
 *   - Der Zylinder soll steil stehen (hier 12 bis 14 Grad), nicht quer
 *     ueber dem Kopf liegen wie beim ersten Anlauf mit 31 Grad.
 *   - Nichts davon darf ueber die geschlossene Schalenkontur hinausragen.
 *     Ein Zwischenstand hatte die Lasche 32 cm nach aussen gelegt; die
 *     Spinne mass geschlossen dadurch 2,61 m statt der 1,89 m aus dem
 *     Datenblatt — die Laschen standen wie Hoerner ab.
 *
 * Die Lasche liegt damit oberhalb und INNERHALB des Drehbolzens, und der
 * Zylinder zieht die Schale zu: Beim Schliessen faehrt er ein. So ist es
 * auch im Bewegungsablauf auf dem Baugruppenblatt — offen stehen die
 * Kolbenstangen weit heraus, geschlossen sind sie eingezogen.
 */
export const LASCHE_AM_GELENK = new THREE.Vector3(0, 0.18, -0.18);

/**
 * Schale — Haut, Seitenwangen, Schneidkante und Zahn.
 *
 * Sie ist ein geschweißter Trog, kein Ausschnitt aus einem Rotationskörper:
 * zwei tiefe Wangen mit einer zurückliegenden Haut dazwischen. Als Spaltstück
 * hatte sie keine eigene Form und keine Kanten, und geschlossen ergab sie
 * zwangsläufig ein Ei — ein Rotationskörper ist ein Ei (Befund 12.09.2026:
 * „ich glaub dein Ansatz ist falsch").
 *
 * Gebaut wird im GESCHLOSSENEN Zustand. Bei Spreizung 0 läuft die Schale durch
 * die Achse hindurch auf die Gegenseite, der Radius wird negativ, und die
 * Bauroutine klemmt ihn ab — das zerstört die Form vollständig.
 */
export function baueSchale(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  // Die Haut liegt hinter der Außenkante der Wangen zurück — daher das Profil
  const haut = new THREE.Mesh(
    schalenGeometrie(0, CLAW_SHELL_BREITE, -HAUT_RUECKSPRUNG),
    st.guss
  );
  haut.castShadow = true;
  haut.receiveShadow = true;
  g.add(haut);
  // Schneidkante: nur die unterste Station, sonst zerschneidet sie die Fläche
  const schneide = new THREE.Mesh(
    schalenGeometrie(6, CLAW_SHELL_BREITE, -HAUT_RUECKSPRUNG),
    st.kante
  );
  schneide.scale.set(1.012, 1, 1.012);
  g.add(schneide);
  for (const seite of [-1, 1]) {
    const wange = new THREE.Mesh(flanschGeometrie(seite), st.kante);
    wange.castShadow = true;
    g.add(wange);
  }
  g.add(baueZahn(st));
  return g;
}

/**
 * Zahn an der Schalenspitze.
 *
 * Er sitzt auf der Spitze und zeigt in Laufrichtung der Schale — beides
 * gerechnet, nicht geschätzt. Die Schale endet mit dem Winkel `th` gegen die
 * Senkrechte, läuft dort also in Richtung (0, −cos th, −sin th). Ein Kegel
 * zeigt von Haus aus nach +y; eine Drehung um x um φ bringt +y auf
 * (0, cos φ, sin φ). Aus cos φ = −cos th und sin φ = −sin th folgt φ = π + th.
 *
 * Beim ersten Versuch stand dort π − th: Der Zahn zeigte nach außen statt in
 * Laufrichtung und schwebte sichtbar neben der Schale.
 */
export function baueZahn(st: SpinnenStoffe): THREE.Mesh {
  const spitze = clawPoint(0, CLAW_CLOSED_SPLAY, CLAW_SEGMENTS, new THREE.Vector3());
  const th = (CLAW_BEND_KUM[CLAW_SEGMENTS - 1] ?? 0) - CLAW_CLOSED_SPLAY;
  const halb = 0.1 * M;
  /*
   * Ein Keil, kein Kegel.
   *
   * Vorher war es ein vierseitiger Kegel, und auf dem Bauteilblatt vom
   * 13.09.2026 war das sofort zu sehen: von vorn eine flache Raute, von der
   * Seite ein Dreieck — ein Blech, kein Zahn. Auf dem Baugruppenblatt ist die
   * Spitze ein Verschleissteil mit Ruecken, Flanken und einer Schneide: breit
   * quer zur Schale, schmal in Blickrichtung, und sie laeuft nicht auf einen
   * Punkt, sondern auf eine Kante zu.
   */
  const zahn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035 * M, 0.1 * M, 0.26 * M, 4),
    st.kante
  );
  zahn.scale.set(1.45, 1, 0.6);
  zahn.position.set(
    0,
    spitze.y - CLAW_RING_Y - halb * Math.cos(th),
    spitze.z - CLAW_RING_R - halb * Math.sin(th)
  );
  zahn.rotation.x = Math.PI + th;
  zahn.name = "tineTip";
  zahn.castShadow = true;
  return zahn;
}

/**
 * Zylinder — Rohr und Kolbenstange.
 *
 * Auf der Vorlage sind sie das Auffälligste an der ganzen Maschine: dick,
 * fast senkrecht, in Maschinengrün, mit blanker Stange. Vorher waren es
 * 6,6-cm-Schrägstreben, die im Bild untergingen — ein Zylinder, der fünf
 * Tonnen zudrückt, ist kein Bleistift.
 */
export function baueZylinder(st: SpinnenStoffe): { rohr: THREE.Mesh; stange: THREE.Mesh } {
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.115 * M, 0.12 * M, 1, 14), st.lack);
  rohr.castShadow = true;
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * M, 0.065 * M, 1, 12), st.chrom);
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
  /** Die fünf Schalengelenke — sie werden zum Öffnen gedreht. */
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
  gruppe.add(baueAufhaengung(st));
  gruppe.add(baueDrehwerk(st));
  gruppe.add(baueGreiferkopf(st));

  const gelenke: THREE.Group[] = [];
  const zylinder: ZylinderAnlenkung[] = [];
  for (let i = 0; i < CLAW_COUNT; i++) {
    const a = (i / CLAW_COUNT) * Math.PI * 2;
    const gelenk = new THREE.Group();
    gelenk.position.set(Math.sin(a) * CLAW_RING_R, CLAW_RING_Y, Math.cos(a) * CLAW_RING_R);
    gelenk.rotation.order = "YXZ";
    gelenk.rotation.y = a; // lokales +z zeigt radial nach außen
    gelenk.add(baueGelenk(st));
    gelenk.add(baueSchale(st));
    gruppe.add(gelenk);
    gelenke.push(gelenk);

    const { rohr, stange } = baueZylinder(st);
    gruppe.add(rohr);
    gruppe.add(stange);
    zylinder.push({
      gelenk,
      /*
       * Der Zylinder steht fast senkrecht: oben am äußeren Rand der Birne,
       * unten am Laschenbolzen über dem Drehpunkt. Weil der Bolzen oberhalb
       * des Drehpunkts sitzt, schwenkt er beim Öffnen nach außen — die Stange
       * fährt dabei aus, genau wie bei der echten Maschine.
       *
       * Ein erster Anlauf setzte ihn oben nah an die Achse und unten weit
       * außen an die Schale. Der Zylinder lag dann quer über der Birne wie ein
       * hingelegter Baumstamm.
       */
      obenLokal: new THREE.Vector3(
        Math.sin(a) * 0.919 * CLAW_RING_R,
        0.451 * CLAW_RING_Y,
        Math.cos(a) * 0.919 * CLAW_RING_R
      ),
      untenAmGelenk: LASCHE_AM_GELENK.clone(),
      rohr,
      stange,
      rohrLaenge: 0.55,
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
  rohr.scale.y = 0.55;
  stange.scale.y = 0.45;
  stange.position.y = -0.5;
  const zyl = new THREE.Group();
  zyl.add(rohr, stange);
  return [
    { name: "1 Aufhaengung", teil: baueAufhaengung(st) },
    { name: "2 Drehwerk", teil: baueDrehwerk(st) },
    { name: "3 Greiferkopf", teil: baueGreiferkopf(st) },
    { name: "4 Zylinder", teil: zyl },
    { name: "5 Schale", teil: baueSchale(st) },
    { name: "6 Gelenk", teil: baueGelenk(st) },
    { name: "8 Zahn", teil: baueZahn(st) },
  ];
}
