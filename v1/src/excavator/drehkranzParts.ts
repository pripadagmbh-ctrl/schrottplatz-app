import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Der Drehkranz — die Verbindung zwischen Unterwagen und Oberwagen.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 04, Tafel 4 der Zeichnung.
 * Beschlossen in E-025.
 *
 * WARUM ES DIESES MODUL GIBT. Gemessen am 14.09.2026: Was im Szenengraph
 * `04_DREHKRANZ` hieß, war in Wahrheit die **Deckplatte des Oberwagens** —
 * ein Quader 2,90 × 0,35 × 3,20 m. Einen sichtbaren Drehkranz gab es nicht;
 * der Oberwagen saß mit seiner Unterkante (y 1,605) praktisch auf dem
 * Unterwagenkasten (Oberkante y 1,60) auf. Zwischen den beiden war nichts.
 *
 * Genau daran erkennt man aber am Vorbild einen Bagger, wenn er sich dreht:
 * an der runden Taille zwischen Fahrwerk und Oberwagen, an der der Zahnkranz
 * sitzt.
 *
 * ZWEI TEILE, ZWEI BEWEGUNGEN — und deshalb am Ende KEIN eigenes Netz:
 *
 *   Der RING steht still (er gehört zum Unterwagen) und wandert in dessen
 *   Stahl-Netz.
 *   Der DECKEL dreht sich mit (er gehört zum Oberwagen) und wandert in dessen
 *   Netz.
 *
 * Solange Unterwagen und Oberwagen noch nicht umgebaut sind, hängen beide als
 * je ein eigenes Netz (`04_DREHKRANZ_RING`, `04_DREHKRANZ`) — sie werden mit
 * den Paketen 2 und 3 eingeschmolzen.
 *
 * DAS EINZIGE, WAS SICH BEWEGEN MUSSTE. Der Ring braucht Platz. Er steht
 * zwischen Unterwagenoberkante (y 1,60) und Oberwagen. Die Deckplatte des
 * Oberwagens reichte bis y 1,605 hinunter und hätte ihn vollständig
 * geschluckt. Sie wird deshalb dünner und rückt nach oben — **ihre Oberkante
 * bleibt bei y 1,955, wo sie war**, damit Motorhaube, Gegengewicht, Kabine und
 * Auslegerdrehpunkt keinen Millimeter wandern.
 */

/**
 * Außendurchmesser des Drehkranzes (m). SW nach Augenmaß am gezeichneten Riss
 * (Konzept Abschnitt 9: Drehkranzdurchmesser 1,70).
 *
 * Er muss kleiner sein als die Breite des Unterwagenkastens (2,40 m) und
 * deutlich kleiner als die Deckplatte des Oberwagens (2,90 m) — sonst steht
 * der Ring über und man sieht ihn nicht als Taille, sondern als Kragen.
 */
export const DREHKRANZ_D = 1.7;

/** Oberkante des Unterwagenkastens (m über Grund) — dort setzt der Ring auf. */
export const DREHKRANZ_Y_UNTEN = 1.6;
/** Bauhöhe des Rings (m) — Konzept 04.1: y 1,60 … 1,78. */
export const DREHKRANZ_H = 0.18;
/** Oberkante des Rings (m über Grund). */
export const DREHKRANZ_Y_OBEN = DREHKRANZ_Y_UNTEN + DREHKRANZ_H;

/**
 * Unterkante der Oberwagen-Deckplatte über dem Ringfuß (m, im Bezugssystem des
 * Oberwagens, dessen Ursprung bei y 1,60 liegt).
 *
 * 0,22 m über dem Ringfuß = y 1,82, also 4 cm über der Ringoberkante (1,78).
 * Diese vier Zentimeter sind das, was man vom Deckel sieht.
 */
export const PLATTE_UNTEN = 0.22;

/** Zahl der Zähne am Zahnkranz. Konzept 04.2. */
const ZAEHNE = 36;
/** Zahl der Schraubenköpfe im Schraubenkreis. Konzept 04.3. */
const SCHRAUBEN = 24;
/**
 * Umfangssegmente des Rings. 24 — bei r = 0,85 m misst die Sehne dann 0,222 m
 * und die Ecke steht 7 mm hinter der Kreislinie zurück. Das ist die Auflösung,
 * in der der Ring aus 15 m Entfernung zu sehen ist.
 */
const SEGMENTE = 24;

/**
 * 04.1 — der Laufring: der Körper, um den sich alles dreht.
 *
 * Unten etwas breiter (der Befestigungsflansch), oben schlanker — so liest
 * sich die Taille als Lager und nicht als Dose.
 */
function laufring(): THREE.BufferGeometry[] {
  const r = DREHKRANZ_D / 2;
  const teile: THREE.BufferGeometry[] = [];
  // Flansch unten: steht 4 cm über den Ring hinaus, darauf sitzen die Schrauben
  const flansch = new THREE.CylinderGeometry(r + 0.09, r + 0.09, 0.035, SEGMENTE);
  flansch.translate(0, 0.0175, 0);
  teile.push(flansch);
  // Ringkörper
  const koerper = new THREE.CylinderGeometry(r - 0.015, r - 0.015, DREHKRANZ_H, SEGMENTE);
  koerper.translate(0, DREHKRANZ_H / 2, 0);
  teile.push(koerper);
  return teile;
}

/**
 * 04.2 — der Zahnkranz: 36 Zähne rund um den Ringkörper.
 *
 * Er ist der Grund, warum der Drehkranz von Weitem als bewegtes Teil lesbar
 * ist: Beim Schwenken wandert das Zahnmuster, und erst dadurch sieht man, dass
 * sich der Oberwagen gegen das Fahrwerk dreht und nicht die ganze Maschine.
 *
 * 36 Quader à 12 Dreiecke = 432 — als 36 Netze wären das 36 Zeichenrufe
 * gewesen; verschmolzen kosten sie keinen einzigen.
 */
function zahnkranz(): THREE.BufferGeometry[] {
  const r = DREHKRANZ_D / 2;
  const teile: THREE.BufferGeometry[] = [];
  for (let i = 0; i < ZAEHNE; i++) {
    const a = (i / ZAEHNE) * Math.PI * 2;
    // Zahnbreite ~ halbe Teilung: 2πr / 36 / 2 = 0,074 m
    const z = new THREE.BoxGeometry(0.074, DREHKRANZ_H * 0.5, 0.03);
    z.translate(0, DREHKRANZ_H * 0.52, r - 0.005);
    z.rotateY(a);
    teile.push(z);
  }
  return teile;
}

/**
 * 04.3 — der Schraubenkreis: 24 Sechskantköpfe auf dem unteren Flansch.
 *
 * Sie stehen AUSSERHALB des Zahnkranzes, sonst verschwänden sie dahinter.
 */
function schraubenkreis(): THREE.BufferGeometry[] {
  const lochkreis = DREHKRANZ_D / 2 + 0.05;
  const teile: THREE.BufferGeometry[] = [];
  for (let i = 0; i < SCHRAUBEN; i++) {
    const a = (i / SCHRAUBEN) * Math.PI * 2;
    const k = new THREE.CylinderGeometry(0.026, 0.026, 0.035, 6);
    k.translate(Math.sin(a) * lochkreis, 0.05, Math.cos(a) * lochkreis);
    teile.push(k);
  }
  return teile;
}

/**
 * Der RING als EIN Netz — Laufring, Zahnkranz, Schraubenkreis.
 *
 * Ursprung liegt auf der Oberkante des Unterwagenkastens, Achse +Y.
 * Er steht still: Er gehört zum Unterwagen, nicht zum Oberwagen.
 */
export function drehkranzRing(): THREE.BufferGeometry {
  const g = mergeGeometries([...laufring(), ...zahnkranz(), ...schraubenkreis()], false);
  if (!g) throw new Error("Drehkranzring liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/**
 * 04.4 — der Deckel plus die Deckplatte des Oberwagens, als EIN Netz.
 *
 * Der Deckel ist die mitdrehende Hälfte des Lagers: eine Scheibe, die den Ring
 * von oben abdeckt und dabei ein Stück über ihn hinaussteht, damit kein Spalt
 * zu sehen ist. Darüber liegt die Deckplatte des Oberwagens.
 *
 * Die Deckplatte war bisher 0,35 m dick und reichte bis y 1,605 hinunter.
 * Jetzt ist sie 0,135 m dick und beginnt bei y 1,82 — **ihre Oberkante bleibt
 * bei y 1,955**. Alles, was darauf steht, bleibt deshalb, wo es war.
 *
 * @param yOben Oberkante der Deckplatte im Bezugssystem des Oberwagens (m)
 */
export function drehkranzDeckel(breite: number, tiefe: number, yOben: number): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  // Deckel: sitzt auf dem Ring, 2 cm größer im Radius als dessen Flansch
  const rDeckel = DREHKRANZ_D / 2 + 0.11;
  const deckel = new THREE.CylinderGeometry(rDeckel, rDeckel - 0.06, 0.06, SEGMENTE);
  deckel.translate(0, PLATTE_UNTEN + 0.02 - 0.03, 0);
  teile.push(deckel);
  const platte = new THREE.BoxGeometry(breite, yOben - PLATTE_UNTEN, tiefe);
  platte.translate(0, (yOben + PLATTE_UNTEN) / 2, 0);
  teile.push(platte);
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Drehkranzdeckel liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}
