import * as THREE from "three";
import { verschmelze, verschmelzeBunt, type Bauteil } from "./bauteile";

/**
 * Räumschild und Abstützpratzen, Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitte 01x (Räumschild, 16 Teile,
 * 2 Netze) und 03 (Abstützung, 28 Teile, 8 Netze). Beschlossen in E-025.
 *
 * WARUM SIE HIER ZUSAMMEN STEHEN: Beides sind BEWEGTE Gruppen am Fahrwerk, und
 * beide bestanden aus lauter Einzelteilen, die sich untereinander gar nicht
 * bewegen. Das Räumschild kostete 10 Netze, obwohl Blatt, Schneide, Wangen,
 * Streben und Zylinder gemeinsam auf- und abschwenken; die vier Pratzenfüße
 * kosteten 12, obwohl Kasten, Stempel und Teller gemeinsam ausfahren.
 *
 * FORM UND LAGE ÄNDERN SICH NICHT. Beide wurden am 12.09.2026 von Patrick
 * eingestellt („nicht so runde Stuetzen, sondern schmale herausstehende
 * Stuetzen mit eckigen Bodenplatten"; Pratzen „eher fuenfzig Zentimeter oder
 * dreissig" heraus). Hier wird nur zusammengefasst und ergänzt — kein Maß
 * wandert.
 */

/** Anthrazit — Blatt, Wangen, Teller. Unverändert. */
const DUNKEL = 0x2b2e31;
/** Maschinengrün — Streben, Zylinderrohre, Pratzenkasten. Unverändert. */
const GRUEN = 0x5bbf46;

/* ------------------------------------------------------------- Räumschild */

/**
 * Das Räumschild als BUNTES Netz: Blatt, Schneidenrücken, zwei Seitenwangen,
 * zwei Streben, zwei Zylinderrohre, vier Augen, zwei Bolzen.
 *
 * Bunt, weil Blatt und Wangen anthrazit sind und Streben und Zylinder grün —
 * zwei Farben, aber ein einziger Starrkörper. Über Eckfarben kostet das ein
 * Netz statt zwei (`bauteile.ts`).
 *
 * @param breite Schildbreite (m) — `BLADE_W` aus `excavator.ts`
 */
export function schildKoerper(breite: number): THREE.BufferGeometry {
  const teile: Bauteil[] = [];
  // Schildblatt, leicht nach vorn geneigt — unverändert
  const blatt = new THREE.BoxGeometry(breite, 0.72, 0.16);
  blatt.rotateX(-0.22);
  blatt.translate(0, 0.42, 0);
  teile.push({ geo: blatt, farbe: DUNKEL });
  // Seitenwangen, damit das Material nicht seitlich wegläuft — unverändert
  for (const s of [-1, 1]) {
    const wange = new THREE.BoxGeometry(0.14, 0.62, 0.5);
    wange.translate((s * breite) / 2, 0.4, 0.22);
    teile.push({ geo: wange, farbe: DUNKEL });
  }
  for (const s of [-1, 1]) {
    // Strebe zum Fahrgestell — unverändert
    const strebe = new THREE.BoxGeometry(0.16, 0.16, 0.9);
    strebe.translate(s * 0.7, 0.5, -0.45);
    teile.push({ geo: strebe, farbe: GRUEN });
    // Zylinderrohr — unverändert in Lage und Neigung
    const rohr = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8);
    rohr.rotateX(0.9);
    rohr.translate(s * 0.42, 0.78, -0.3);
    teile.push({ geo: rohr, farbe: GRUEN });
    /*
     * NEU: die vier Augen und die zwei Bolzen (Konzept 01x). Sie sitzen an
     * den Enden von Strebe und Zylinder — dort, wo das Schild am Fahrgestell
     * hängt. Ohne sie endete die Strebe stumpf in der Luft, genau wie vor dem
     * Umbau der Ausleger an beiden Enden.
     */
    for (const [y, z] of [
      [0.5, -0.87],
      [0.9, -0.5],
    ] as const) {
      const auge = new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10);
      auge.rotateZ(Math.PI / 2);
      auge.translate(s * (y > 0.7 ? 0.42 : 0.7), y, z);
      teile.push({ geo: auge, farbe: DUNKEL });
    }
    const bolzen = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8);
    bolzen.rotateZ(Math.PI / 2);
    bolzen.translate(s * 0.7, 0.5, -0.87);
    teile.push({ geo: bolzen, farbe: DUNKEL });
  }
  return verschmelzeBunt(teile, "Raeumschild");
}

/**
 * Der blanke Stahl am Räumschild: die Schneide und die beiden Kolbenstangen.
 *
 * Eigenes Netz, weil blanker Stahl nicht nur eine andere FARBE hat, sondern
 * eine andere Oberfläche (metallisch, glatt). Das lässt sich nicht über
 * Eckfarben erschlagen.
 */
export function schildSchneide(breite: number): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const schneide = new THREE.BoxGeometry(breite, 0.14, 0.2);
  schneide.translate(0, 0.07, 0.03);
  teile.push(schneide);
  for (const s of [-1, 1]) {
    const stange = new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8);
    stange.rotateX(0.9);
    stange.translate(s * 0.42, 0.55, -0.16);
    teile.push(stange);
  }
  return verschmelze(teile, "Raeumschildschneide");
}

/* -------------------------------------------------------------- Pratzenfuß */

/**
 * Ein Pratzenfuß als BUNTES Netz: Kasten, Tellerfuß, zwei Lagerböcke, Bolzen,
 * zwei Schlauchstücke.
 *
 * Alles daran fährt GEMEINSAM aus — es bewegt sich nichts gegeneinander, also
 * ein Netz. Vorher waren es drei je Fuß, zwölf im ganzen.
 *
 * Die Form von Kasten und Teller ist unverändert (Ansage 12.09.2026: „eckige
 * Bodenplatten").
 */
export function pratzeFuss(): THREE.BufferGeometry {
  const teile: Bauteil[] = [];
  const kasten = new THREE.BoxGeometry(0.26, 0.5, 0.26);
  kasten.translate(0, 0.42, 0);
  teile.push({ geo: kasten, farbe: GRUEN });
  const teller = new THREE.BoxGeometry(0.62, 0.14, 0.62);
  teller.translate(0, 0.07, 0);
  teile.push({ geo: teller, farbe: DUNKEL });
  /*
   * NEU (Konzept 03): zwei Lagerböcke am Kopf des Kastens, ein Bolzen quer
   * hindurch und zwei Schlauchstücke. Sie sind das, woran man sieht, dass die
   * Pratze hydraulisch fährt und nicht angeschraubt ist.
   */
  for (const s of [-1, 1]) {
    const bock = new THREE.BoxGeometry(0.04, 0.16, 0.2);
    bock.translate(s * 0.15, 0.62, 0);
    teile.push({ geo: bock, farbe: DUNKEL });
  }
  const bolzen = new THREE.CylinderGeometry(0.035, 0.035, 0.38, 8);
  bolzen.rotateZ(Math.PI / 2);
  bolzen.translate(0, 0.62, 0);
  teile.push({ geo: bolzen, farbe: DUNKEL });
  for (const s of [-1, 1]) {
    const schlauch = new THREE.CylinderGeometry(0.022, 0.022, 0.36, 6);
    schlauch.translate(s * 0.1, 0.5, -0.15);
    teile.push({ geo: schlauch, farbe: 0x1c1e20 });
  }
  return verschmelzeBunt(teile, "Pratzenfuss");
}

/**
 * Der blanke Stempel eines Pratzenfußes — das Teil, das sichtbar im Kasten
 * steckt. Eigenes Netz wegen der metallischen Oberfläche. Form unverändert.
 */
export function pratzeStempel(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.17, 0.35, 0.17);
  g.translate(0, 0.14, 0);
  return g;
}
