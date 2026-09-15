import * as THREE from "three";
import { verschmelze } from "./bauteile";
import { DECK_OBEN, HAUBE_OBEN } from "./oberwagenParts";

/**
 * Das Kabinenhubwerk — Paket 8 und letztes aus E-025.
 *
 * WAS VORHER FALSCH WAR (gemessen, `npx vite-node tools/zylinderhub.ts`,
 * 14.09.2026; Befund 2 in E-025):
 *
 *   - Die beiden „Parallelogramm-Lenker" waren keine: Ihr Ankerabstand wuchs
 *     von 0,647 auf 3,139 m — Faktor 4,8. Sie wurden gedehnt wie ein Gummiband.
 *   - Die beiden Kabinenhubzylinder verlangten ein Hubverhältnis von
 *     **5,18 : 1** (0,650 → 3,368 m). Das kann kein einstufiger Zylinder. Ihr
 *     Rohr war mit 1,10 m länger als der Spalt von 0,65 m und stand in der
 *     untersten Stellung durch den Kabinenboden.
 *
 * WAS JETZT GEBAUT IST: ein echtes Schwenkwerk. Ein **Mast hinter der Kabine**
 * trägt eine Welle; an ihr hängen zwei Lenker von 1,88 m, die die Kabine
 * tragen. Ein Hebel auf derselben Welle wird von **einem** Zylinder gedrückt.
 * Patrick hat die Bauform am 15.09.2026 am Bild entschieden
 * (`docs/messungen/2026-09-15-bagger/07-kabinenhub.svg`, Variante A), gegen
 * „Lenker vor der Kabine" — dort laufen die Lenker in 186 von 861 abgetasteten
 * Stellungen durch den Kabineninnenraum.
 *
 * DIE ZAHLEN SIND NICHT GEWÄHLT, SONDERN GERECHNET. Gegeben sind nur drei
 * Dinge, und alle drei sind alt:
 *
 *   - die Lenkerlänge 1,88 m (E-025, Frage 3, von Patrick bestätigt),
 *   - der Hub 2,60 m mit 0,34 m Vorlauf je Meter (Prototyp, unverändert),
 *   - der Anlenkpunkt an der Kabine (y 0,50 | z −0,12), unverändert.
 *
 * Daraus folgt der Drehpunkt zwingend: Beide Endlagen des Anlenkpunkts liegen
 * auf einem Kreis mit Radius 1,88 m, also liegt der Mittelpunkt auf der
 * Mittelsenkrechten der Sehne. Es gibt genau zwei Lösungen — die hintere ist
 * Variante A. Gerechnet wird sie hier, nicht abgeschrieben.
 *
 * WAS DAS FÜR DIE KABINENANSICHT HEISST — und warum dieses Paket als einziges
 * allein abgenommen wird: **Unten und ganz oben steht der Augpunkt auf den
 * Zentimeter da, wo er stand** (y 3,28 unten; daran hängt die Sichtrechnung
 * der Muldenschwelle, E-034). Dazwischen läuft die Kabine einen Bogen statt
 * einer Geraden und weicht auf halbem Weg bis 0,60 m ab. Das ist bekannt,
 * gerechnet und von Patrick mitentschieden (E-025, Frage 3).
 *
 * ZWEI NETZE, nicht sechs:
 *   `06_KABINENMAST`     — steht fest am Oberwagen: zwei Säulen, Querträger,
 *                          zwei Lageraugen, zwei Fußplatten, Zylinderkonsole
 *   `06_KABINENLENKER`   — dreht mit der Welle: zwei Lenker, Welle, Hebel,
 *                          vier Augen
 * dazu EIN echter Zylinder (`06_ZYLINDER_KABINE`, zwei Netze aus
 * `zylinderParts.ts`). Vorher: zwei gedehnte Lenker + zwei unmögliche Zylinder
 * = sechs Netze.
 */

/* ------------------------------------------------------- Die drei Vorgaben */

/** Lenkerlänge (m). E-025, Frage 3 — von Patrick bestätigt. */
export const LENKER_L = 1.88;

/** Größter Kabinenhub (m). Unverändert seit dem Prototyp. */
export const HUB_MAX = 2.6;

/** Vorlauf der Kabine je Meter Hub. Unverändert seit dem Prototyp. */
export const VORLAUF = 0.34;

/** Kabinenmitte im Oberwagen-Frame — unverändert seit dem Design-Fix 29.08.2026. */
export const CX = -1.05;
export const CZ = 0.6;

/** Seitenversatz der beiden Lenker (m) — unverändert seit dem Prototyp. */
export const LENKER_RX = 0.42;

/** x-Lage der beiden Lenker und damit der beiden Mastsäulen (m). */
export const LENKER_X: readonly [number, number] = [CX - LENKER_RX, CX + LENKER_RX];

/**
 * Anlenkpunkt an der Kabine in der untersten Stellung (Oberwagen-Frame).
 *
 * Unverändert: Das war schon die Lage des Lenkerkopfs `06_KABINENLENKER_*_KOPF`
 * vor dem Umbau.
 */
export const ANKER = { y: 0.5, z: CZ - 0.72 };

/* ----------------------------------------------- Was daraus zwingend folgt */

/**
 * Der Drehpunkt der Lenker im Oberwagen-Frame.
 *
 * Mittelsenkrechte der Sehne zwischen unterer und oberer Anlenkung, Abstand
 * √(L² − (Sehne/2)²) von deren Mitte, hintere Lösung (Variante A).
 */
export const DREHPUNKT = (() => {
  const a1 = { y: ANKER.y + HUB_MAX, z: ANKER.z + HUB_MAX * VORLAUF };
  const sy = a1.y - ANKER.y;
  const sz = a1.z - ANKER.z;
  const sehne = Math.hypot(sy, sz);
  const h = Math.sqrt(LENKER_L * LENKER_L - (sehne / 2) ** 2);
  // Einheitsvektor senkrecht zur Sehne, nach hinten-oben
  return {
    y: (ANKER.y + a1.y) / 2 + (h * sz) / sehne,
    z: (ANKER.z + a1.z) / 2 - (h * sy) / sehne,
  };
})();

/** Lenkerwinkel (rad, 0 = waagerecht nach vorn) bei gegebener Hubhöhe. */
export function hubWinkel(hoehe: number): number {
  return Math.asin((hoehe + ANKER.y - DREHPUNKT.y) / LENKER_L);
}

/** Lenkerwinkel in der untersten und in der obersten Stellung (rad). */
export const WINKEL_UNTEN = hubWinkel(0);
export const WINKEL_OBEN = hubWinkel(HUB_MAX);

/**
 * Versatz des Kabinenschlittens gegenüber der untersten Stellung (m).
 *
 * `y` kommt exakt als die übergebene Hubhöhe zurück — deshalb bleibt `cabLift`
 * in `excavator.ts` weiter die Hubhöhe in Metern, und HUD, Hubtempo und
 * Augpunkt rechnen mit derselben Zahl wie vorher. Nur `z` läuft jetzt einen
 * Bogen statt einer Geraden.
 */
export function hubVersatz(hoehe: number, out: THREE.Vector3): THREE.Vector3 {
  const w = hubWinkel(hoehe);
  return out.set(
    0,
    DREHPUNKT.y + Math.sin(w) * LENKER_L - ANKER.y,
    DREHPUNKT.z + Math.cos(w) * LENKER_L - ANKER.z
  );
}

/** Höhe des Drehpunkts über der Deckplatte (m) — das ist „der Mast". */
export const MAST_HOEHE = DREHPUNKT.y - DECK_OBEN;

/* ------------------------------------------------------------ Der Zylinder */

/**
 * Wo der Hebel auf der Welle steht und wo der Zylinderfuß sitzt.
 *
 * DAS PROBLEM: 93,9° Schwenkweg sind viel. Greift der Zylinder direkt am
 * Lenker an, kommt man auf Hubverhältnisse über 2 : 1 — wieder nichts, was ein
 * einstufiger Zylinder kann (die beiden gebauten Zylinder liegen bei 1,49 und
 * 1,24).
 *
 * DIE RECHNUNG: Steht der Zylinderfuß im Winkel φ zum Drehpunkt und der Hebel
 * im Winkel β dazu, dann ist die Baulänge L² = r² + R² − 2rR·cos β. Über einen
 * Schwenkweg von 93,9° wird das Verhältnis am kleinsten, wenn β am Ende dieses
 * Wegs gegen 180° läuft (dort ändert sich der Kosinus am langsamsten) — aber
 * nicht darüber hinaus, sonst hat das Gestänge einen Totpunkt mitten im Weg.
 * Mit β = 80° … 173,9° und r/R = 0,55 ergibt sich **1,47 : 1** — genau die
 * Größenordnung des Hubzylinders.
 */
const ZYL_BETA_UNTEN = THREE.MathUtils.degToRad(80);

/**
 * Zylinderfuß, senkrecht unter dem Drehpunkt am Mast (Oberwagen-Frame).
 *
 * y 1,45 ist die tiefste Stelle, an der er noch **über** der Motorhaube
 * (Oberkante 1,355) sitzt: Damit läuft der Zylinder in keiner Stellung durch
 * die Haube, und die Aussparung darin muss nur Mastsäule und Lenker aufnehmen.
 */
export const ZYL_FUSS = { x: -0.44, y: HAUBE_OBEN + 0.095, z: DREHPUNKT.z };

/** Abstand Zylinderfuß ↔ Drehpunkt (m). */
const ZYL_R = DREHPUNKT.y - ZYL_FUSS.y;

/** Hebellänge auf der Welle (m) — 0,55 · Fußabstand, siehe Rechnung oben. */
export const HEBEL_L = ZYL_R * 0.55;

/**
 * Winkel des Hebels gegen den Lenker (rad).
 *
 * Der Fuß steht senkrecht unter dem Drehpunkt, also φ = −90°. Aus
 * β = (Lenkerwinkel + Hebelwinkel) − φ folgt der Hebelwinkel unmittelbar.
 */
export const HEBEL_WINKEL = ZYL_BETA_UNTEN - Math.PI / 2 - WINKEL_UNTEN;

/** Kopfanker des Zylinders im Frame der Welle (Lenker zeigt bei 0 nach +Z). */
export const ZYL_KOPF: [number, number, number] = [
  ZYL_FUSS.x,
  Math.sin(HEBEL_WINKEL) * HEBEL_L,
  Math.cos(HEBEL_WINKEL) * HEBEL_L,
];

/** Ankerabstand des Zylinders bei Lenkerwinkel `w` (m). */
export function zylinderLaenge(w: number): number {
  const beta = w + HEBEL_WINKEL + Math.PI / 2;
  return Math.sqrt(
    HEBEL_L * HEBEL_L + ZYL_R * ZYL_R - 2 * HEBEL_L * ZYL_R * Math.cos(beta)
  );
}

/**
 * Maße des Kabinenhubzylinders — gerechnet, nicht gewählt.
 *
 * Rohrradius 0,055 m: derselbe Wert, mit dem die beiden alten (unmöglichen)
 * Kabinenzylinder gezeichnet wurden. Die Silhouette ändert sich dadurch nicht.
 */
export const ZYL_MASSE = {
  kurz: zylinderLaenge(WINKEL_UNTEN),
  lang: zylinderLaenge(WINKEL_OBEN),
  rRohr: 0.055,
};

/* ------------------------------------------------------------- Der Mast */

/** Querschnitt der Mastsäulen (m): x-Breite und z-Tiefe. */
const SAEULE_B = 0.13;
const SAEULE_T = 0.22;
/** Radius der Welle (m) und der Lageraugen darum. */
const WELLE_R = 0.05;
const AUGE_R = 0.1;

/**
 * `06_KABINENMAST` — steht fest auf dem Oberwagen, EIN Netz.
 *
 * ZWEI BEKANNTE ÜBERSCHNEIDUNGEN, beide von Patrick mitentschieden:
 *
 * 1. Die **innere Säule (x −0,63) steht in der Motorhaube.** Dafür hat die
 *    Haube seit diesem Paket eine Aussparung (`NISCHE` in `oberwagenParts.ts`).
 * 2. Die **äußere Säule (x −1,47) steht über der Deckkante (±1,45).** Sie
 *    ragt mit ihrer Außenflanke 8,5 cm darüber hinaus — und bleibt damit immer
 *    noch 21 cm INNERHALB der Radaußenkanten (±1,75). Die Fußplatte ist
 *    deshalb nach innen gezogen und stützt sich auf der Deckplatte ab.
 */
export function kabinenmast(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const yKopf = DREHPUNKT.y + 0.11; // Säule steht übers Lagerauge hinaus
  for (const x of LENKER_X) {
    const saeule = new THREE.BoxGeometry(SAEULE_B, yKopf - DECK_OBEN, SAEULE_T);
    saeule.translate(x, (DECK_OBEN + yKopf) / 2, DREHPUNKT.z);
    teile.push(saeule);
    // Lagerauge: Bohrungsachse in X, wie an jedem Lagerbock der Maschine
    const auge = new THREE.CylinderGeometry(AUGE_R, AUGE_R, SAEULE_B + 0.03, 12);
    auge.rotateZ(Math.PI / 2);
    auge.translate(x, DREHPUNKT.y, DREHPUNKT.z);
    teile.push(auge);
    /*
     * Fußplatte auf der Deckplatte — NACH INNEN versetzt, nicht mittig.
     * Mittig gesetzt stünde sie unter der äußeren Säule 11,5 cm über der
     * Deckkante (±1,45); so ist es nur die Säule selbst mit 8,5 cm.
     */
    const platte = new THREE.BoxGeometry(SAEULE_B + 0.06, 0.05, SAEULE_T + 0.04);
    platte.translate(x - Math.sign(x) * 0.03, DECK_OBEN + 0.025, DREHPUNKT.z);
    teile.push(platte);
  }
  /*
   * Querträger zwischen den Säulen — HINTER der Welle (z −1,12), nicht auf
   * ihrer Höhe: Dort läuft die Welle, und bei z −0,97 beginnt der Schwenkraum
   * der Lenker. Er liegt 14 cm über dem Handlauf des Geländers (y 1,995).
   */
  const quer = new THREE.BoxGeometry(LENKER_X[1] - LENKER_X[0] - SAEULE_B, 0.16, 0.3);
  quer.translate((LENKER_X[0] + LENKER_X[1]) / 2, DREHPUNKT.y, DREHPUNKT.z - 0.226);
  teile.push(quer);
  /*
   * Konsole für den Zylinderfuß: sie greift von der inneren Säule zur
   * Zylinderebene (x −0,44) und liegt vollständig über der Haube.
   */
  const konsole = new THREE.BoxGeometry(0.24, 0.1, 0.2);
  konsole.translate((LENKER_X[1] + ZYL_FUSS.x) / 2 - 0.035, ZYL_FUSS.y, DREHPUNKT.z);
  teile.push(konsole);
  return verschmelze(teile, "Kabinenmast");
}

/* ----------------------------------------------------------- Die Lenker */

/**
 * `06_KABINENLENKER` — zwei Lenker, Welle, Hebel und vier Augen als EIN Netz.
 *
 * Sie dürfen in ein Netz, weil sie sich untereinander nicht bewegen: Beide
 * Lenker und der Hebel sitzen auf DERSELBEN Welle und drehen um denselben
 * Winkel. Vorher waren es zwei Netze für zwei gedehnte Kästen.
 *
 * DER URSPRUNG IST DER DREHPUNKT, der Lenker zeigt bei Winkel 0 nach +Z.
 * Gedreht wird die Gruppe darum mit `rotation.x = −Lenkerwinkel`.
 *
 * WARUM DER LENKER ZUR KABINE HIN FLACH AUSLÄUFT: In der untersten Stellung
 * steht er steil (65,7° unter der Waagerechten) und läuft dicht an der
 * Hinterkante des Kabinenbodenblechs (z −0,105) vorbei. Ein durchgehend
 * 16 cm dicker Kasten stieße dort 6 mm hinein. Gerechnet ist die Grenze bei
 * 6,5 cm Dicke; gebaut sind 5 cm, das lässt 8 mm Luft.
 */
export function kabinenlenker(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  for (const x of LENKER_X) {
    // Kastenprofil am Drehpunkt, zur Kabine hin in zwei Stufen flacher
    for (const [dicke, breite, von, bis] of [
      [0.16, 0.14, 0.09, 1.02],
      [0.11, 0.13, 1.0, 1.5],
      [0.042, 0.12, 1.46, LENKER_L - 0.02],
    ] as const) {
      const kasten = new THREE.BoxGeometry(breite, dicke, bis - von);
      kasten.translate(x, 0, (von + bis) / 2);
      teile.push(kasten);
    }
    // Auge am Drehpunkt und Auge an der Kabine
    const nabe = new THREE.CylinderGeometry(0.09, 0.09, 0.15, 12);
    nabe.rotateZ(Math.PI / 2);
    nabe.translate(x, 0, 0);
    teile.push(nabe);
    const kopf = new THREE.CylinderGeometry(0.03, 0.03, 0.13, 10);
    kopf.rotateZ(Math.PI / 2);
    kopf.translate(x, 0, LENKER_L);
    teile.push(kopf);
  }
  // Durchgehende Welle von der äußeren Säule bis unter den Hebel
  const wellenVon = LENKER_X[0] - 0.085;
  const wellenBis = ZYL_FUSS.x + 0.025;
  const welle = new THREE.CylinderGeometry(WELLE_R, WELLE_R, wellenBis - wellenVon, 10);
  welle.rotateZ(Math.PI / 2);
  welle.translate((wellenVon + wellenBis) / 2, 0, 0);
  teile.push(welle);
  // Hebel für den Zylinder, auf derselben Welle
  const hebel = new THREE.BoxGeometry(0.1, 0.09, HEBEL_L);
  hebel.translate(0, 0, HEBEL_L / 2);
  hebel.rotateX(-HEBEL_WINKEL);
  hebel.translate(ZYL_FUSS.x, 0, 0);
  teile.push(hebel);
  const hebelauge = new THREE.CylinderGeometry(0.055, 0.055, 0.12, 10);
  hebelauge.rotateZ(Math.PI / 2);
  hebelauge.translate(ZYL_KOPF[0], ZYL_KOPF[1], ZYL_KOPF[2]);
  teile.push(hebelauge);
  return verschmelze(teile, "Kabinenlenker");
}

/**
 * Der Umriss der Kabine im Kabinenframe — das Fenster, durch das in keiner
 * Stellung ein Lenker laufen darf.
 *
 * Dieselben Zahlen, mit denen `tools/kabinenhub.ts` am 15.09.2026 die beiden
 * Bauformen verglichen hat (Variante B fiel damit durch: 186 von 861
 * Abtastpunkten). `test/kabinenhub.test.ts` prüft sie gegen die wirklich
 * gebaute Kabine nach.
 */
export const KABINE_UMRISS = {
  xVon: CX - 0.56,
  xBis: CX + 0.56,
  yVon: 0.4,
  yBis: 2.16,
  zVon: CZ - 0.71,
  zBis: CZ + 0.71,
};

/**
 * Was die Aussparung in der Motorhaube mindestens aufnehmen muss: die innere
 * Mastsäule samt Lagerauge und den Schwenkraum des inneren Lenkers.
 *
 * `test/kabinenhub.test.ts` hält `NISCHE` (in `oberwagenParts.ts`) dagegen —
 * so kann die Aussparung nicht stillschweigend zu klein werden, wenn jemand
 * am Mast etwas ändert.
 */
export const NISCHE_BEDARF = {
  xVon: LENKER_X[1] - Math.max(SAEULE_B, 0.14) / 2,
  xBis: LENKER_X[1] + Math.max(SAEULE_B, 0.14) / 2,
  zHinten: DREHPUNKT.z - SAEULE_T / 2,
};
