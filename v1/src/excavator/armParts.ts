import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Ausleger und Stiel des Baggers, Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 07, Tafel 2 und 5 der Zeichnung
 * `docs/baggerkonzept-2026-09-14.svg`. Beschlossen in E-025.
 *
 * WARUM ES DIESES MODUL GIBT. Gemessen am 14.09.2026: Ausleger und Stiel waren
 * je **ein Quader mit 12 Dreiecken** — die beiden größten Teile der ganzen
 * Maschine hatten zusammen weniger Form als ein einzelner Fingernagel des
 * Fahrers (4 648 Dreiecke). Am Vorbild (SENNEBOGEN 840 E) ist der Ausleger ein
 * Kastenträger, der sich zur Spitze hin verjüngt, mit angeschweißten Laschen an
 * beiden Enden, Lagerböcken für den Stielzylinder und einem Schlauchpaket, das
 * oben in Schellen läuft.
 *
 * DIE BUDGETREGEL (E-025): EIN NETZ JE STARRKÖRPER UND WERKSTOFF. Der Ausleger
 * ist ein Starrkörper mit fünf Werkstoffen (Lack, Stahl, Schlauch, Logo,
 * Leuchte) → fünf Netze für 23 Teile. Der Stiel hat drei Werkstoffe → drei
 * Netze für 16 Teile.
 *
 * WAS SICH NICHT ÄNDERT — und warum das hier im Kopf steht:
 * Der ganze Platz ist um die gemessene Reichweite gebaut (Schwenkband innen
 * 5,80 m, außen 9,20 m, `world/baggerstand.ts`). `BOOM_LEN` 5,20 m,
 * `STICK_LEN` 4,00 m, der Auslegerdrehpunkt und die Kollider-Halbmaße
 * (0,21 / 0,31 / 0,16 / 0,225) bleiben deshalb unangetastet. Dieses Modul
 * ändert **nur die Hülle**, nie ein Maß.
 *
 * Das ist auch der Grund für die Bezugspunkte unten: Beide Kasten-Geometrien
 * werden um ihre **Mitte** gebaut, damit das Netz weiterhin bei
 * `z = LÄNGE / 2` sitzt — dort hängt in `excavator.ts` der Arm-Kollider daran
 * (`armShapes`, `syncMeshes`). Alles andere wird um den **Gelenkpunkt** gebaut.
 */

/** Breite des Auslegerkastens (m) — unverändert, die Logos sitzen bei ±0,216. */
export const AUSLEGER_BREITE = 0.42;
/** Höhe des Auslegerkastens am Fuß (m) — unverändert (Kollider 2 × 0,31). */
export const AUSLEGER_H_FUSS = 0.62;
/**
 * Höhe des Auslegerkastens am Kopf (m). SW nach Tafel 2.
 *
 * Ein Kastenträger ist dort am höchsten, wo das Biegemoment am größten ist —
 * am Fuß. Zur Spitze läuft er aus. 0,44 ist gut ein Drittel weniger; darunter
 * wirkte der Ausleger dünn, darüber sähe man die Verjüngung nicht.
 * Der Kollider behält seine 0,62 m; er war noch nie deckungsgleich mit der
 * Hülle (E-025, Befund 3).
 */
export const AUSLEGER_H_KOPF = 0.44;

/**
 * DER AUSLEGERFUSS — die beiden Laschen am Drehpunkt, in Zahlen.
 *
 * Sie standen bis zum 15.09.2026 als nackte Argumente in `auslegerStahl`
 * (`laschenpaar(0, 0, 0.245, AUSLEGER_H_FUSS * 0.42, 0.06)`). Jetzt stehen sie
 * hier, weil ein ZWEITES Bauteil sie braucht: der Auslegerbock auf dem
 * Oberwagen (E-050) muss wissen, wie breit der Fuß ist, den er zwischen seine
 * Wangen nimmt, und wie groß dessen Lasche ist, die in sein Lagerauge sitzt.
 * Die Maße sind unverändert; sie haben nur einen Namen bekommen.
 */
export const AUSLEGER_FUSS = {
  /** Halber Wangenabstand der beiden Fußlaschen (m). */
  halb: 0.245,
  /** Dicke einer Fußlasche (m). */
  dicke: 0.06,
  /** Radius einer Fußlasche (m) = halbe Bauhöhe des Kastens am Fuß. */
  r: AUSLEGER_H_FUSS * 0.42,
} as const;

/** Äußerste Fläche des Auslegerfußes (m) — dort endet der Arm in der Breite. */
export const AUSLEGER_FUSS_AUSSEN = AUSLEGER_FUSS.halb + AUSLEGER_FUSS.dicke / 2;

/** Breite des Stielkastens (m) — unverändert. */
export const STIEL_BREITE = 0.32;
/** Höhe des Stielkastens am Fuß (m) — unverändert (Kollider 2 × 0,225). */
export const STIEL_H_FUSS = 0.45;
/** Höhe des Stielkastens an der Spitze (m). SW nach Tafel 2, wie oben. */
export const STIEL_H_SPITZE = 0.3;

/**
 * Ein Kastenträger, der sich über seine Länge verjüngt.
 *
 * Gebaut aus einem Quader, dessen Eckpunkte in der Höhe nachgezogen werden:
 * `BoxGeometry` hat in Längsrichtung nur die beiden Endquerschnitte, also
 * genügt eine lineare Zuordnung — jeder Punkt bekommt die Höhe seines Endes.
 *
 * Ursprung ist die MITTE des Trägers (z = 0), weil daran der Kollider hängt.
 */
export function kastenVerjuengt(
  breite: number,
  hFuss: number,
  hKopf: number,
  laenge: number
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(breite, 1, laenge);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getZ(i) + laenge / 2) / laenge; // 0 am Fuß, 1 am Kopf
    pos.setY(i, pos.getY(i) * (hFuss + (hKopf - hFuss) * t));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Höhe des verjüngten Kastens an der Stelle `z` ab Fuß (m). */
function hoeheBei(z: number, hFuss: number, hKopf: number, laenge: number): number {
  return hFuss + (hKopf - hFuss) * (z / laenge);
}

/**
 * Zwei Aussteifungsrippen auf dem Kasten.
 *
 * An einem geschweißten Kastenträger sitzen innen Schotten; nach außen sieht
 * man davon die aufgesetzten Rippen. Sie sind das Detail, das einen
 * lackierten Quader in ein Schweißteil verwandelt — und sie kosten kein Netz,
 * weil sie dieselbe Farbe tragen wie der Kasten.
 *
 * Sie bleiben VOR dem Logo (das ab z = 2,39 m an der Flanke klebt), sonst
 * stünde eine Rippe durch die Wortmarke.
 */
function rippen(
  breite: number,
  hFuss: number,
  hKopf: number,
  laenge: number,
  stellen: number[]
): THREE.BufferGeometry[] {
  return stellen.map((z) => {
    const h = hoeheBei(z, hFuss, hKopf, laenge);
    const g = new THREE.BoxGeometry(breite + 0.035, h + 0.035, 0.075);
    g.translate(0, 0, z - laenge / 2); // in das Mitten-Bezugssystem des Kastens
    return g;
  });
}

/**
 * Ein Laschenpaar mit Bolzen an einem Gelenkpunkt.
 *
 * Das ist das Teil, an dem man einen Gelenkpunkt überhaupt erst erkennt:
 * zwei Stahlwangen, die über den Kasten hinausstehen, und ein Bolzen quer
 * hindurch. Vorher endete der Ausleger an beiden Enden stumpf.
 *
 * @param z    Lage des Gelenks im Bezugssystem des Aufrufers (m)
 * @param y    Höhe des Gelenks (m)
 * @param halb halber Wangenabstand (m)
 * @param r    Radius der Lasche = halbe Bauhöhe (m)
 */
function laschenpaar(
  z: number,
  y: number,
  halb: number,
  r: number,
  dicke: number
): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.CylinderGeometry(r, r, dicke, 12);
    w.rotateZ(Math.PI / 2);
    w.translate(s * halb, y, z);
    teile.push(w);
  }
  const bolzen = new THREE.CylinderGeometry(r * 0.38, r * 0.38, halb * 2 + dicke * 2.4, 10);
  bolzen.rotateZ(Math.PI / 2);
  bolzen.translate(0, y, z);
  teile.push(bolzen);
  return teile;
}

/**
 * Ein Lagerbock: zwei Konsolenbleche mit Bohrung, an denen ein Zylinderauge
 * hängt.
 *
 * Bis zum 15.09.2026 hingen die Hydraulikzylinder buchstäblich in der Luft —
 * ihr Auge saß an einem `Object3D` ohne Blech darum. Der Lagerbock gehört
 * nicht zum Zylinder, sondern zu dem Teil, das ihn trägt (Tafel 3, letzte
 * Zeile), und liegt deshalb in dessen Netz.
 */
function lagerbock(
  x: number,
  y: number,
  z: number,
  breite: number,
  hoehe: number
): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const blech = new THREE.BoxGeometry(0.035, hoehe, hoehe * 0.85);
    blech.translate(x + s * breite, y, z);
    teile.push(blech);
  }
  const fuss = new THREE.BoxGeometry(breite * 2 + 0.07, hoehe * 0.3, hoehe * 0.95);
  fuss.translate(x, y + hoehe * 0.45, z);
  teile.push(fuss);
  return teile;
}

/**
 * Der AUSLEGER als Lack-Netz: verjüngter Kasten plus zwei Rippen.
 *
 * Ursprung ist die MITTE des Kastens — das Netz hängt in `excavator.ts` bei
 * `z = BOOM_LEN / 2`, wo der Kollider daran hängt.
 */
export function auslegerLack(laenge: number): THREE.BufferGeometry {
  const g = mergeGeometries(
    [
      kastenVerjuengt(AUSLEGER_BREITE, AUSLEGER_H_FUSS, AUSLEGER_H_KOPF, laenge),
      // SW: vor dem Logo (das ab z = 0,46 · L − 1,35 m an der Flanke sitzt)
      ...rippen(AUSLEGER_BREITE, AUSLEGER_H_FUSS, AUSLEGER_H_KOPF, laenge, [0.6, 1.8]),
    ],
    false
  );
  if (!g) throw new Error("Auslegerkasten liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/**
 * Der AUSLEGER als Stahl-Netz: Fußlaschen, Kopflaschen, Lagerböcke.
 *
 * Ursprung ist der DREHPUNKT des Auslegers (z = 0), nicht die Kastenmitte —
 * die Gelenkpunkte sind in `excavator.ts` in diesem Bezugssystem angeschrieben
 * und sollen hier genauso ablesbar bleiben.
 *
 * @param zStielzylinder Fußanker des Stielzylinders am Ausleger (y, z)
 * @param zHubzylinder   Kopfanker der beiden Hubzylinder am Ausleger (x, y, z)
 */
export function auslegerStahl(
  laenge: number,
  stielzylinder: { y: number; z: number },
  hubzylinder: { x: number; y: number; z: number }
): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [
    // 2 Fußlaschen mit Bolzen — der Auslegerdrehpunkt selbst
    ...laschenpaar(0, 0, AUSLEGER_FUSS.halb, AUSLEGER_FUSS.r, AUSLEGER_FUSS.dicke),
    // 2 Kopflaschen mit Bolzen — das Stielgelenk
    ...laschenpaar(laenge, 0, 0.2, AUSLEGER_H_KOPF * 0.46, 0.055),
    // 2 Lagerböcke für den Stielzylinder, oben auf dem Kasten
    ...lagerbock(0, stielzylinder.y, stielzylinder.z, 0.1, 0.16),
  ];
  // 2 Lagerböcke für die Hubzylinder, unten an den Kastenflanken
  for (const s of [-1, 1]) {
    teile.push(...lagerbock(s * hubzylinder.x, hubzylinder.y, hubzylinder.z, 0.07, 0.15));
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Auslegerstahl liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/**
 * Das Schlauchpaket auf dem Ausleger: zwei Schläuche, vier Klemmschellen,
 * Bogen über das Stielgelenk — EIN Netz statt bisher zwei.
 *
 * Die Schläuche liefen bisher frei über dem Kasten, bis zu 21 cm über seiner
 * Oberkante. Jetzt folgen sie der verjüngten Oberkante mit 5,5 cm Abstand und
 * sind in Schellen gefasst — daran sieht man, dass sie zum Ausleger gehören
 * und nicht darüber schweben.
 */
export function auslegerSchlauch(laenge: number): THREE.BufferGeometry {
  const oben = (z: number): number =>
    hoeheBei(z, AUSLEGER_H_FUSS, AUSLEGER_H_KOPF, laenge) / 2 + 0.055;
  const teile: THREE.BufferGeometry[] = [];
  for (const hx of [-0.07, 0.07]) {
    const kurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, oben(0.25) + 0.02, 0.25),
      new THREE.Vector3(hx, oben(1.8) + 0.05, 1.8),
      new THREE.Vector3(hx, oben(3.6) + 0.04, 3.6),
      new THREE.Vector3(hx, oben(laenge - 0.15), laenge - 0.15),
    ]);
    teile.push(new THREE.TubeGeometry(kurve, 20, 0.028, 6));
  }
  // 4 Klemmschellen: fassen beide Schläuche gegen den Kastenrücken
  for (const z of [0.9, 2.2, 3.4, 4.6]) {
    const s = new THREE.BoxGeometry(0.235, 0.028, 0.05);
    s.translate(0, oben(z) + 0.035, z);
    teile.push(s);
    const steg = new THREE.BoxGeometry(0.05, 0.07, 0.045);
    steg.translate(0, oben(z) - 0.005, z);
    teile.push(steg);
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Auslegerschlauch liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/**
 * Zwei Arbeitsscheinwerfer am Auslegerfuß.
 *
 * Der Kipper hat Scheinwerfer, Rückleuchten und Dachleuchten
 * (`delivery/vehicleModel.ts`) — der Bagger hatte kein einziges Licht. Am
 * Vorbild sitzen zwei Strahler am Auslegerfuß und leuchten dorthin, wo
 * gegriffen wird.
 */
export function auslegerLeuchten(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const glas = new THREE.BoxGeometry(0.14, 0.11, 0.05);
    glas.translate(s * 0.21, 0.2, 0.62);
    teile.push(glas);
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Auslegerleuchten liessen sich nicht verschmelzen");
  return g;
}

/**
 * Der STIEL als Lack-Netz: verjüngter Kasten plus zwei Rippen.
 * Ursprung ist die Kastenmitte (Kollider, siehe oben).
 */
export function stielLack(laenge: number): THREE.BufferGeometry {
  const g = mergeGeometries(
    [
      kastenVerjuengt(STIEL_BREITE, STIEL_H_FUSS, STIEL_H_SPITZE, laenge),
      ...rippen(STIEL_BREITE, STIEL_H_FUSS, STIEL_H_SPITZE, laenge, [1.1, 2.6]),
    ],
    false
  );
  if (!g) throw new Error("Stielkasten liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/**
 * Der STIEL als Stahl-Netz: Fußlaschen, Lagerbock des Stielzylinders und der
 * ganze Greiferhalter.
 *
 * Ursprung ist das STIELGELENK (z = 0).
 *
 * Der Greiferhalter (Ansage 13.09.2026: „Greifer braucht Befestigung am
 * Ausleger") bleibt Teil für Teil erhalten — Gusskopf, zwei Laschen, Bolzen,
 * zwei Scheiben —, nur liegt er jetzt im selben Netz wie der übrige Stahl des
 * Stiels. Neu ist der Anschlagpuffer, der verhindert, dass die Spinne beim
 * vollen Einklappen an den Kasten schlägt.
 *
 * @param zylinderkopf Kopfanker des Stielzylinders am Stiel (y, z)
 */
export function stielStahl(laenge: number, zylinderkopf: { y: number; z: number }): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [
    // 2 Fußlaschen mit Bolzen — das Stielgelenk
    ...laschenpaar(0, 0, 0.19, STIEL_H_FUSS * 0.46, 0.05),
    // Lagerbock des Stielzylinders
    ...lagerbock(0, zylinderkopf.y, zylinderkopf.z, 0.085, 0.14),
  ];
  // Greiferhalter an der Stielspitze
  const kopf = new THREE.BoxGeometry(0.42, 0.52, 0.36);
  kopf.translate(0, 0, laenge - 0.1);
  teile.push(kopf);
  for (const sx of [-1, 1]) {
    const lasche = new THREE.BoxGeometry(0.07, 0.3, 0.2);
    lasche.translate(sx * 0.16, -0.22, laenge);
    teile.push(lasche);
  }
  const halterBolzen = new THREE.CylinderGeometry(0.05, 0.05, 0.44, 10);
  halterBolzen.rotateZ(Math.PI / 2);
  halterBolzen.translate(0, -0.32, laenge);
  teile.push(halterBolzen);
  for (const sx of [-0.21, 0.21]) {
    const scheibe = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10);
    scheibe.rotateZ(Math.PI / 2);
    scheibe.translate(sx, -0.32, laenge);
    teile.push(scheibe);
  }
  // Anschlagpuffer: der Gummiklotz, gegen den der Halter beim Einklappen läuft
  const puffer = new THREE.BoxGeometry(0.2, 0.09, 0.12);
  puffer.translate(0, 0.19, laenge - 0.28);
  teile.push(puffer);
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Stielstahl liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/**
 * Der Schlauch auf dem Stiel mit zwei Schellen — EIN Netz.
 * Ursprung ist das Stielgelenk.
 */
export function stielSchlauch(): THREE.BufferGeometry {
  const kurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.34, -0.45),
    new THREE.Vector3(0, 0.3, 0.1),
    new THREE.Vector3(0, 0.24, 0.9),
  ]);
  const teile: THREE.BufferGeometry[] = [new THREE.TubeGeometry(kurve, 16, 0.028, 6)];
  for (const z of [0.2, 0.8]) {
    const s = new THREE.BoxGeometry(0.1, 0.026, 0.045);
    s.translate(0, 0.29 - (z - 0.2) * 0.08, z);
    teile.push(s);
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Stielschlauch liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}
