import * as THREE from "three";
import {
  CLAW_COUNT,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  CLAW_SEG_BEND,
  CLAW_SEG_LEN,
} from "./clawGeometry";

/**
 * Die Spinne, Bauteil für Bauteil.
 *
 * Stand: zurück auf die Form vom 12.09.2026 mittags (Ansage 13.09.2026:
 * „kannst du einfach wieder die Spinne von gestern Mittag nehmen?"). Also
 * wieder Rotator, Gusstraverse, Gelenkring und fünf Sichelkrallen aus je sechs
 * Segmenten — nicht die Trogschalen und nicht der Gussblock mit Frästaschen,
 * die am 12. abends und am 13. morgens daraus geworden waren.
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
const SEG_BREITE = [0.4, 0.37, 0.33, 0.28, 0.22, 0.15];
/** Dicke der Krallensegmente, von der Wurzel zur Spitze (m). */
const SEG_DICKE = [0.16, 0.15, 0.135, 0.12, 0.105, 0.085];
/**
 * Anlenkung der Zylinder — abgetastet, nicht gegriffen (13.09.2026).
 *
 * Am 12.09. mittags sass der Anlenkbock bei Radius 0,42 und die Lasche 0,30 m
 * unter dem Drehbolzen. Nachgerechnet war das mechanisch unbrauchbar: Der
 * Hebelarm lief bei 20 % Oeffnung durch einen Totpunkt (7 mm), das
 * Schliessmoment betrug nur ein Fuenftel des Oeffnungsmoments, und die
 * Zylinder liefen durch den Gussblock hindurch. Im Spiel fiel nichts davon
 * auf, weil die Kralle kinematisch gefuehrt wird und der Zylinder nur
 * mitlaeuft — er ist Dekoration.
 *
 * Fuer den exportierten Prototyp muss es stimmen, und weil beide dieselbe
 * Geometrie benutzen, stimmt es jetzt auch hier. Ueber alle Lagen abgetastet
 * unter vier Bedingungen — Zylinder frei am Gussblock vorbei, steil, kein
 * Totpunkt, groesster Hebelarm im geschlossenen Zustand — bleibt diese
 * Familie uebrig:
 *
 *   geschlossen 0,57 m   offen 0,34 m   Hub 0,23 m   Neigung bis 14°
 *   Hebelarm 0,19 m geschlossen, 0,11 m offen
 *
 * Damit faehrt der Zylinder zum SCHLIESSEN AUS — die starke Richtung, volle
 * Kolbenflaeche. Schliessmoment zu Oeffnungsmoment: 1,70.
 */
const ZYLINDERKREIS = 0.84;

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
export function baueTraverse(st: SpinnenStoffe): THREE.Group {
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.5, 0.4, 5), st.guss);
  block.position.y = -0.75;
  block.rotation.y = Math.PI / 5;
  block.castShadow = true;
  g.add(block);
  /*
   * Anlenkboecke fuer die Zylinder — die radialen Ohren oben am Mittelstueck.
   *
   * Sie fehlten, und das war kein Schoenheitsfehler: Nach dem Verlegen der
   * Anlenkung von Radius 0,42 auf 0,84 hingen die Zylinder mit ihrem oberen
   * Ende sichtbar im Nichts. Auf der Explosionszeichnung (Position 07) sind
   * genau diese Ohren das, woran die Zylinder haengen.
   */
  for (let i = 0; i < CLAW_COUNT; i++) {
    const a = (i / CLAW_COUNT) * Math.PI * 2;
    // Schmal und knapp vor dem Bolzen endend, sonst verdeckt der Bock den
    // Zylinder, den er halten soll.
    const ohr = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.28, 0.2), st.kante);
    ohr.position.set(Math.sin(a) * 0.74, -0.46, Math.cos(a) * 0.74);
    ohr.rotation.y = a;
    ohr.castShadow = true;
    g.add(ohr);
    const bolzen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10),
      st.bolzen
    );
    bolzen.position.set(Math.sin(a) * ZYLINDERKREIS, -0.38, Math.cos(a) * ZYLINDERKREIS);
    bolzen.rotation.y = a;
    bolzen.rotation.z = Math.PI / 2;
    g.add(bolzen);
  }
  return g;
}

/**
 * Gelenkring — der Kreis, auf dem die fünf Krallen hängen.
 *
 * Er war am 12.09. abends ersatzlos gestrichen worden („dieser Ring, den Du da
 * zeichnest, der existiert gar nicht"), und die Krallen hingen stattdessen an
 * einem Strunk mit 0,25 m Radius. Mit der Rückkehr zur Mittagsform ist er
 * wieder da — er ist es, der die Kralle so weit außen aufhängt, dass sie ein
 * großes C beschreibt.
 */
export function baueGelenkring(st: SpinnenStoffe): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(CLAW_RING_R, 0.075, 8, 22), st.kante);
  m.rotation.x = Math.PI / 2;
  m.position.y = CLAW_RING_Y;
  return m;
}

/**
 * Eine Sichelkralle: Lagerbock, sechs gebogene Segmente, stumpfe Spitze.
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
   */
  const spitze = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.075, 0.14, 8), st.kante);
  spitze.position.y = -CLAW_SEG_LEN - 0.03;
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
        -0.38,
        Math.cos(a) * ZYLINDERKREIS
      ),
      untenAmGelenk: new THREE.Vector3(0, -0.04, 0.2),
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
