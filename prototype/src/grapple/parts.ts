/**
 * Die Bauteile des Fünfzinken-Mehrschalengreifers.
 *
 * Nummerierung nach der Positionsliste der Explosionszeichnung (13.09.2026):
 *
 *   01 Aufhängung / Anschraubplatte   Verbindung zum Stiel
 *   02 Aufnahmebolzen                 Befestigung der Aufhängung
 *   03 Rotator                        Drehwerk
 *   04 Hydraulikzylinder (5x)         Greifbewegung der Schalen
 *   05 Hydraulikschläuche (5x)        Zylinderverbindung
 *   06 Schutzabdeckung                Schutz vor Schmutz
 *   07 Mittelstück                    zentrale Greiferanbindung
 *   08 Greiferschale (5x)             Schalenkörper
 *   09 Verschleißblech                seitlicher Schutz
 *   10 Greiferspitze (5x)             austauschbar
 *   11 Gelenkbolzen                   Verbindung Schale / Zylinder
 *
 * Nicht als eigene Netze gebaut sind 12 Buchse, 13 Sicherungsring und 14
 * Verschraubung: In einer Spielkamera ist davon nichts zu sehen, und der
 * Auftrag sagt ausdrücklich, unnötig winzige Details wegzulassen. Sie sind an
 * den Gelenkbolzen mitgedacht — dort sitzt der Absatz, auf dem sie liefen.
 *
 * Jedes Teil ist um seinen eigenen Ursprung gebaut. Das ist keine Ordnungsliebe,
 * sondern die Bedingung für alles Weitere: Der Ursprung eines Teils ist im glTF
 * sein Pivot.
 */
import * as THREE from "three";
import {
  GELENKRING,
  LASCHE,
  MITTELSTUECK,
  RING_ROHR,
  RING_Y,
  ROHR_R,
  ROHRLAENGE,
  ROTATOR,
  SCHALEN,
  SEGMENTBOGEN,
  SEGMENTE,
  SEGMENTLAENGE,
  SEG_BREITE,
  SEG_DICKE,
  STANGE_R,
  VERSCHLEISSBLECH,
  ZYLINDERKREIS,
  ZYLINDER_OBEN_Y,
} from "./form";

/* ------------------------------------------------------------------ Stoffe */

export interface Stoffe {
  guss: THREE.MeshStandardMaterial;
  stahl: THREE.MeshStandardMaterial;
  bolzen: THREE.MeshStandardMaterial;
  gruen: THREE.MeshStandardMaterial;
  chrom: THREE.MeshStandardMaterial;
  gummi: THREE.MeshStandardMaterial;
}

/**
 * Die Werkstoffe, als PBR-Materialien.
 *
 * Dieselben Farben wie im Spiel: dunkler Hardox-Guss, fast schwarze Kanten,
 * Maschinengrün ausschließlich an den Zylinderrohren. Auf der Vorlage ist das
 * Grün das einzige Farbige am ganzen Gerät, und genau diese Sparsamkeit macht
 * es industriell statt bunt.
 */
export function stoffe(): Stoffe {
  const m = (
    name: string,
    color: number,
    roughness: number,
    metalness: number
  ): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    mat.name = name;
    return mat;
  };
  return {
    guss: m("Hardox_Guss", 0x40474b, 0.5, 0.55),
    stahl: m("Stahl_dunkel", 0x23282b, 0.45, 0.7),
    bolzen: m("Stahl_blank", 0xb9c0c6, 0.25, 0.9),
    gruen: m("Lack_gruen", 0x62c94b, 0.4, 0.35),
    chrom: m("Kolbenstange_chrom", 0xb8bec4, 0.22, 0.85),
    gummi: m("Hydraulikschlauch", 0x15181a, 0.85, 0.05),
  };
}

/* ------------------------------------------------- (01/02) Aufhängung */

/**
 * Aufhängung mit Anschraubplatte und Aufnahmebolzen.
 *
 * Zwei hochstehende Bleche mit einer Bohrung, dazwischen der Bolzen — daran
 * erkennt man, dass das Gerät abnehmbar ist. Auf der Explosionszeichnung ist es
 * die oberste Gruppe.
 */
export function baueAufhaengung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "ADAPTER";
  for (const seite of [-1, 1]) {
    const ohr = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.3, 0.34), st.stahl);
    ohr.name = `ADAPTER_OHR_${seite < 0 ? "L" : "R"}`;
    ohr.position.set(seite * 0.13, -0.13, 0);
    g.add(ohr);
  }
  const bolzen = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 12), st.bolzen);
  bolzen.name = "ADAPTER_BOLZEN";
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.y = -0.06;
  g.add(bolzen);
  const platte = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), st.guss);
  platte.name = "ADAPTER_PLATTE";
  platte.position.y = -0.31;
  g.add(platte);
  return g;
}

/* ------------------------------------------------------------ (03) Rotator */

/**
 * Rotator — Drehwerk mit Gehäuse, Drehkranz und Drehdurchführung.
 *
 * Ein eigenes Gerät, kein Teil des Greifers: Es wird angeflanscht und ist auf
 * jedem Bild als abgesetzter Kasten mit Flanschring zu erkennen. Sein Ursprung
 * liegt auf der Drehachse — das Bauteil ist zugleich der Pivot der
 * Rotationsanimation.
 */
export function baueRotator(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "ROTATOR";
  const gehaeuse = new THREE.Mesh(
    new THREE.BoxGeometry(ROTATOR.breite, ROTATOR.hoehe, ROTATOR.breite),
    st.stahl
  );
  gehaeuse.name = "ROTATOR_GEHAEUSE";
  gehaeuse.position.y = ROTATOR.y;
  g.add(gehaeuse);
  const kranz = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12), st.guss);
  kranz.name = "ROTATOR_DREHKRANZ";
  kranz.position.y = -0.3;
  g.add(kranz);
  const durchfuehrung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), st.bolzen);
  durchfuehrung.name = "ROTATOR_DURCHFUEHRUNG";
  durchfuehrung.rotation.z = Math.PI / 2;
  durchfuehrung.position.set(0.28, ROTATOR.y, 0);
  g.add(durchfuehrung);
  return g;
}

/* -------------------------------------------- (06/07) Mittelstück + Deckel */

/**
 * Mittelstück — der Stahlgussblock, an dem alles hängt, mit Gelenkring.
 *
 * Fünfeckig, weil fünf Krallen daran hängen: So sitzt jede Anlenkung auf einer
 * Fläche und nicht auf einer Kante. Der Gelenkring darunter ist der Kreis, auf
 * dem die Krallen sitzen — er ist es, der die Kralle so weit außen aufhängt,
 * dass sie ein großes C beschreibt.
 *
 * Obenauf die Schutzabdeckung (06): die flache Haube, die auf der
 * Explosionszeichnung als eigenes Teil neben dem Block liegt. Sie deckt die
 * Zylinderanlenkungen ab.
 */
export function baueMittelstueck(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "GRAPPLE_HEAD";
  const block = new THREE.Mesh(
    new THREE.CylinderGeometry(MITTELSTUECK.oben, MITTELSTUECK.unten, MITTELSTUECK.hoehe, 5),
    st.guss
  );
  block.name = "HEAD_MITTELSTUECK";
  block.position.y = MITTELSTUECK.y;
  block.rotation.y = Math.PI / 5;
  g.add(block);

  const haube = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.14, 10), st.stahl);
  haube.name = "HEAD_SCHUTZABDECKUNG";
  haube.position.y = MITTELSTUECK.y + MITTELSTUECK.hoehe / 2 + 0.05;
  g.add(haube);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(GELENKRING, RING_ROHR, 8, 22),
    st.stahl
  );
  ring.name = "HEAD_GELENKRING";
  ring.rotation.x = Math.PI / 2;
  ring.position.y = RING_Y;
  g.add(ring);

  /*
   * Anlenkböcke für die Zylinder — die radialen Ohren oben am Mittelstück.
   *
   * Sie fehlten, und das war kein Schönheitsfehler: Nach dem Verlegen der
   * Anlenkung von Radius 0,42 auf 0,84 hingen die Zylinder mit ihrem oberen
   * Ende sichtbar im Nichts. Auf der Explosionszeichnung (Position 07) sind
   * genau diese Ohren das, woran die Zylinder hängen.
   */
  for (let i = 0; i < SCHALEN; i++) {
    const a = (i / SCHALEN) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    // Schmal und knapp vor dem Bolzen endend, sonst verdeckt der Bock den
    // Zylinder, den er halten soll.
    const ohr = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.28, 0.2), st.stahl);
    ohr.name = `HEAD_ZYLINDERBOCK_${nr}`;
    ohr.position.set(Math.sin(a) * 0.74, ZYLINDER_OBEN_Y - 0.08, Math.cos(a) * 0.74);
    ohr.rotation.y = a;
    g.add(ohr);
    const bolzen = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), st.bolzen);
    bolzen.name = `HEAD_ZYLINDERBOLZEN_${nr}`;
    bolzen.position.copy(zylinderAmKopf(a));
    bolzen.rotation.y = a;
    bolzen.rotation.z = Math.PI / 2;
    g.add(bolzen);
  }
  return g;
}

/* ------------------------------------------------------ (11) Gelenkbolzen */

/**
 * Gelenkbolzen einer Schale, quer zur Drehachse.
 *
 * Er liegt auf genau der Achse, um die die Schale schwenkt, und ist damit die
 * sichtbare Begründung für den Pivot. Der Absatz an beiden Enden steht für
 * Buchse und Sicherungsring (12/13), die nicht einzeln gebaut sind.
 */
export function baueGelenkbolzen(st: Stoffe): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 12), st.bolzen);
  m.rotation.z = Math.PI / 2;
  return m;
}

/* ------------------------------------------- (08/09/10) Greiferschale */

/**
 * Eine Sichelkralle: Lagerbock, sechs gebogene Segmente, Verschleißbleche,
 * austauschbare Spitze.
 *
 * Gebaut als Kette ineinandersteckender Gruppen — jedes Segment sitzt eine
 * Segmentlänge tiefer als sein Vorgänger und ist um `SEGMENTBOGEN` weiter
 * gekippt. Das ist genau die Rechnung aus `clawPoint`, nur als Szenengraph:
 * Modell und Physik können dadurch nicht auseinanderlaufen.
 *
 * Der zurückgegebene Knoten ist der Drehpunkt am Gelenkring. Nur er wird
 * animiert; die Segmente stehen fest zu ihrem Vorgänger. Eine Schale braucht
 * deshalb genau EINE Rotationsspur, egal wie viele Segmente sie hat.
 */
export function baueSchale(st: Stoffe, winkel: number, nr: string): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = `SHELL_${nr}`;
  pivot.position.set(Math.sin(winkel) * GELENKRING, RING_Y, Math.cos(winkel) * GELENKRING);
  pivot.rotation.order = "YXZ";
  pivot.rotation.y = winkel; // lokales +z zeigt radial nach außen

  const lagerbock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), st.stahl);
  lagerbock.name = `SHELL_LAGERBOCK_${nr}`;
  lagerbock.position.y = 0.02;
  pivot.add(lagerbock);

  let eltern: THREE.Object3D = pivot;
  for (let i = 0; i < SEGMENTE; i++) {
    const breite = SEG_BREITE[i] ?? 0.15;
    const dicke = SEG_DICKE[i] ?? 0.085;
    const seg = new THREE.Group();
    seg.name = `SHELL_SEG_${nr}_${i + 1}`;
    if (i > 0) {
      seg.position.y = -SEGMENTLAENGE;
      seg.rotation.x = SEGMENTBOGEN;
    }
    const koerper = new THREE.Mesh(
      new THREE.BoxGeometry(breite, SEGMENTLAENGE + 0.04, dicke),
      st.guss
    );
    koerper.name = `SHELL_BODY_${nr}_${i + 1}`;
    koerper.position.y = -SEGMENTLAENGE / 2;
    seg.add(koerper);
    // Verschleissblech auf dem Ruecken — gibt der Schale Profil und Schutz
    const blech = new THREE.Mesh(
      new THREE.BoxGeometry(breite + 0.03, SEGMENTLAENGE + 0.05, VERSCHLEISSBLECH),
      st.stahl
    );
    blech.name = `WEAR_PLATE_${nr}_${i + 1}`;
    blech.position.set(0, -SEGMENTLAENGE / 2, dicke / 2);
    seg.add(blech);
    eltern.add(seg);
    eltern = seg;
  }

  /*
   * Stumpfe Greiferspitze statt Vierkantkegel: Sortiergreifer laufen wie ein
   * Löffelrand aus, nicht wie ein Spieß. Das erklärt nebenbei, warum Bleche
   * früher aufgespießt wurden. Auf der Vorlage ist sie als austauschbares Teil
   * geführt (10) — im Modell ist sie darum ein eigenes Netz.
   */
  const spitze = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.075, 0.14, 8), st.stahl);
  spitze.name = `SHELL_TIP_${nr}`;
  spitze.position.y = -SEGMENTLAENGE - 0.03;
  eltern.add(spitze);

  /*
   * Lasche, an der die Kolbenstange angreift. Sie sitzt am Lagerbock, nicht an
   * der Segmentkette — der Zylinder greift oben an der Schale an, nicht in
   * ihrer Mitte.
   */
  const lasche = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.14), st.stahl);
  lasche.name = `SHELL_LUG_${nr}`;
  lasche.position.set(0, LASCHE.y * 0.6, LASCHE.z * 0.6);
  lasche.rotation.x = Math.atan2(LASCHE.z, LASCHE.y);
  pivot.add(lasche);

  return pivot;
}

/* ------------------------------------------------------ (04) Hydraulikzylinder */

/**
 * Hydraulikzylinder: Zylindergehäuse und Kolbenstange, je ein eigenes Objekt.
 *
 * Beide sind um ihren eigenen Ursprung gebaut und zeigen nach −y, damit sie
 * sich im Rig einfach aufhängen lassen: Das Rohr hängt am Mittelstück, die
 * Stange fährt aus ihm heraus. Kolben und Dichtungen (16/17) stecken darin und
 * sind nicht einzeln gebaut — in einer Spielkamera sieht man sie nie.
 */
export function baueZylinder(st: Stoffe): { rohr: THREE.Mesh; stange: THREE.Mesh } {
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(ROHR_R, ROHR_R, 1, 10), st.gruen);
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(STANGE_R, STANGE_R, 1, 8), st.chrom);
  return { rohr, stange };
}

/* ---------------------------------------------- (05) Hydraulikschläuche */

/**
 * Hydraulikschläuche — einer je Zylinder, von der Drehdurchführung zum Rohr.
 *
 * Bewusst grob: fünf Schläuche mit sechs Ecken Querschnitt. Sie sind das, was
 * den Kopf als Hydraulikgerät lesbar macht; einzeln sichtbar sind sie in einer
 * Spielkamera nie. Verlegt als Bézierbogen, damit sie hängen statt zu stehen.
 */
export function baueSchlaeuche(st: Stoffe, ziele: THREE.Vector3[]): THREE.Group {
  const g = new THREE.Group();
  g.name = "HYDRAULIC_LINES";
  ziele.forEach((ziel, i) => {
    const start = new THREE.Vector3(ziel.x * 0.25, ROTATOR.y - 0.08, ziel.z * 0.25);
    const bauch = new THREE.Vector3(
      (start.x + ziel.x) * 0.62,
      (start.y + ziel.y) * 0.5 - 0.12,
      (start.z + ziel.z) * 0.62
    );
    const kurve = new THREE.QuadraticBezierCurve3(start, bauch, ziel);
    const schlauch = new THREE.Mesh(new THREE.TubeGeometry(kurve, 6, 0.028, 6, false), st.gummi);
    schlauch.name = `HYDRAULIC_LINE_${String(i + 1).padStart(2, "0")}`;
    g.add(schlauch);
  });
  return g;
}

/** Aufnahmepunkt eines Zylinders am Mittelstück, im Frame des Kopfes. */
export function zylinderAmKopf(winkel: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(winkel) * ZYLINDERKREIS,
    ZYLINDER_OBEN_Y,
    Math.cos(winkel) * ZYLINDERKREIS
  );
}

/** Wie viele Schalen der Greifer hat — für Prüfungen von außen sichtbar. */
export const ZINKEN = SCHALEN;
export { ROHRLAENGE };
