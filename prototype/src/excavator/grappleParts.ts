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
 *   Drehmotor · Birne · Zylinder · Strunk mit Prisma · Gelenk · Schale · Zahn
 */

/** Die Werkstoffe der Spinne — einmal gebaut, von allen Teilen geteilt. */
export interface SpinnenStoffe {
  /** Gusseisen, hell und matt: die großen Flächen */
  guss: THREE.MeshStandardMaterial;
  /** Eine Spur dunkler: Kanten, Absätze, Lagerböcke */
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
    lack: new THREE.MeshStandardMaterial({ color: 0x5fbe3f, roughness: 0.45, metalness: 0.3 }),
    chrom: new THREE.MeshStandardMaterial({ color: 0xd0d6dc, roughness: 0.14, metalness: 0.92 }),
  };
}

/**
 * Drehmotor — das Modul ganz oben, mit dem sich die Spinne dreht.
 *
 * Ein eigenes Gerät, kein Teil des Greifers: Es wird angeflanscht und ist auf
 * jedem Bild als abgesetzter Kasten zu erkennen.
 */
export function baueDrehmotor(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const gehaeuse = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.5), st.kante);
  gehaeuse.position.y = -0.48;
  gehaeuse.castShadow = true;
  g.add(gehaeuse);
  const flansch = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12), st.guss);
  flansch.position.y = -0.3;
  g.add(flansch);
  return g;
}

/**
 * Birne — der Gussblock unter dem Drehmotor, in dem die Zylinder sitzen.
 *
 * Sie war einmal eine Scheibe: 0,72 m Radius bei 0,40 m Höhe, also fast so
 * breit wie der Zinkenkreis. Darauf standen die Zylinder wie Stummel, und
 * geschlossen sah die Spinne aus wie eine fliegende Untertasse (Befund
 * 12.09.2026: „Ist das ein UFO?").
 *
 * Am Foto nachgemessen ist der Kopf gut halb so breit wie der Zinkenkreis und
 * deutlich höher als breit. Genau daran erkennt man die Maschine: schlanker
 * Turm über weitem Zinkenkreis.
 */
export function baueBirne(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.86, 6), st.guss);
  koerper.position.y = -0.5;
  koerper.rotation.y = Math.PI / 6;
  koerper.castShadow = true;
  g.add(koerper);
  // Schulter, an der die Zylinder hängen — sie kragt über die Birne hinaus
  const schulter = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.62, 0.2, 6), st.guss);
  schulter.position.y = -0.26;
  schulter.rotation.y = Math.PI / 6;
  schulter.castShadow = true;
  g.add(schulter);
  return g;
}

/**
 * Strunk — die massive Säule, die unten aus der Birne kommt, und das Prisma
 * an ihrem Ende, an dem die Schalen hängen.
 *
 * Beschreibung 12.09.2026: „dieser Ring, den Du da zeichnest, der existiert
 * gar nicht … da geht ein massives Stahlrohr runter, was unten wie ein Prisma
 * daherkommt, und da sind die Schalen befestigt." Auf den Bildern ist es der
 * auffällige graue Keil in der Mitte.
 */
export function baueStrunk(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.62, 6), st.guss);
  saeule.position.y = CLAW_RING_Y + 0.34;
  saeule.rotation.y = Math.PI / 6;
  saeule.castShadow = true;
  g.add(saeule);
  const prisma = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.1, 0.5, 6), st.kante);
  prisma.position.y = CLAW_RING_Y - 0.14;
  prisma.rotation.y = Math.PI / 6;
  prisma.castShadow = true;
  g.add(prisma);
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
  const lagerbock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.24), st.kante);
  lagerbock.position.set(0, 0.04, 0.04);
  lagerbock.castShadow = true;
  g.add(lagerbock);
  /*
   * Der Drehbolzen liegt quer zur Schale, also entlang der lokalen x-Achse —
   * genau der Achse, um die das Gelenk schwenkt. Er ragt beidseits heraus, wie
   * ein gesicherter Bolzen es tut.
   */
  const dreh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.46, 10), st.bolzen);
  dreh.rotation.z = Math.PI / 2;
  dreh.castShadow = true;
  g.add(dreh);
  const laschenBolzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.38, 10),
    st.bolzen
  );
  laschenBolzen.rotation.z = Math.PI / 2;
  laschenBolzen.position.copy(LASCHE_AM_GELENK);
  laschenBolzen.castShadow = true;
  g.add(laschenBolzen);
  const lasche = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.16), st.kante);
  lasche.position.set(0, 0.19, 0.09);
  lasche.rotation.x = -0.35;
  lasche.castShadow = true;
  g.add(lasche);
  return g;
}

/** Wo die Kolbenstange am Gelenk angreift — Bolzenmitte im Gelenkframe. */
export const LASCHE_AM_GELENK = new THREE.Vector3(0, 0.13, 0.11);

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
  const halb = 0.08;
  const zahn = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.16, 4), st.guss);
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
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.13, 1, 14), st.lack);
  rohr.castShadow = true;
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 12), st.chrom);
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
  gruppe.add(baueDrehmotor(st));
  gruppe.add(baueBirne(st));
  gruppe.add(baueStrunk(st));

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
      obenLokal: new THREE.Vector3(Math.sin(a) * 0.78, -0.06, Math.cos(a) * 0.78),
      untenAmGelenk: LASCHE_AM_GELENK.clone(),
      rohr,
      stange,
      rohrLaenge: 0.46,
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
  rohr.scale.y = 0.46;
  stange.scale.y = 0.4;
  stange.position.y = -0.4;
  const zyl = new THREE.Group();
  zyl.add(rohr, stange);
  return [
    { name: "Drehmotor", teil: baueDrehmotor(st) },
    { name: "Birne", teil: baueBirne(st) },
    { name: "Strunk", teil: baueStrunk(st) },
    { name: "Zylinder", teil: zyl },
    { name: "Gelenk", teil: baueGelenk(st) },
    { name: "Schale", teil: baueSchale(st) },
    { name: "Zahn", teil: baueZahn(st) },
  ];
}
