import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Der Hydraulikzylinder des Baggers, Bauteil für Bauteil.
 *
 * Vorbild und Aufbau: Tafel 3 der Zeichnung `docs/baggerkonzept-2026-09-14.svg`,
 * Teileliste `docs/baggerkonzept.md` Abschnitt 07. Beschlossen in E-025.
 *
 * WARUM ES DIESES MODUL GIBT — der Befund vom 14.09.2026
 * (`npx vite-node tools/zylinderhub.ts`):
 *
 *   Zylinder              kürzest  längst    Hub   Verhältnis
 *   07_ZYLINDER_HUB_R/L    2,518   3,757   1,239     1,49
 *   07_ZYLINDER_STIEL      1,809   2,235   0,426     1,24
 *
 * Bis zum 15.09.2026 wurde die „Kolbenstange" mit `rod.scale.y` auf den
 * jeweiligen Abstand GEDEHNT — am Hubzylinder von 0,97 auf 2,21 m, also um
 * **+128 %**. Das ist kein Zylinder, das ist ein gezogener Klotz: Ein
 * angebauter Gabelkopf würde mitgedehnt, der Bolzen würde zur Wurst.
 *
 * Ein echter Zylinder macht es umgekehrt: **Rohr und Stange behalten ihre
 * Länge, die Stange wird nur verschoben** und taucht dabei ins Rohr ein. Genau
 * das baut dieses Modul.
 *
 * DIE BUDGETREGEL (E-025, Gerätemessung 14.09.2026: FPS 48 · Frame 21,0 ms ·
 * 1322 Zeichenrufe · 240k Dreiecke): Dreiecke sind fast gratis, NETZE sind
 * teuer — jedes schattenwerfende Netz wird zweimal gezeichnet.
 *
 *   EIN NETZ JE STARRKÖRPER UND WERKSTOFF.
 *
 * Ein ausfahrender Zylinder hat zwangsläufig **zwei** Starrkörper: die
 * Rohrseite und die Stangenseite. Also **zwei Netze je Zylinder**, nicht
 * sechs — obwohl er aus sechs benannten Teilen besteht:
 *
 *   a Bodenauge mit Kugelbuchse   → Rohr-Netz
 *   b Zylinderrohr (14 Segmente)  → Rohr-Netz
 *   c Führungskopf, 6 Schrauben   → Rohr-Netz
 *   f 2 Anschlussstutzen + Schlauch → Rohr-Netz
 *   d Kolbenstange, blank         → Stangen-Netz
 *   e Gabelkopf, Bolzen, Blech    → Stangen-Netz
 *
 * DIE BEZUGSPUNKTE — der Grund, warum hier nie skaliert werden muss:
 *
 *   Das Rohr-Netz wird mit dem Ursprung im **Fußanker** gebaut, Achse +Y.
 *   Das Stangen-Netz wird mit dem Ursprung im **Kopfanker** gebaut, Achse −Y.
 *
 * Beim Zeichnen bekommt jedes der beiden nur seinen Ankerpunkt und dieselbe
 * Drehung. Der Abstand der Anker verschiebt die Stange im Rohr — mehr passiert
 * nicht. `scale` bleibt bei beiden (1, 1, 1); `test/zylinder.test.ts` wacht
 * darüber.
 */

/** Maße eines Zylinders, wie sie aus der Abtastung folgen. */
export interface ZylinderMasse {
  /** Ankerabstand in der kürzesten Stellung (m) — gemessen, `tools/zylinderhub.ts`. */
  kurz: number;
  /** Ankerabstand in der längsten Stellung (m) — gemessen. */
  lang: number;
  /** Außenradius des Zylinderrohrs (m). */
  rRohr: number;
}

/** Was ein fertiger Zylinder an Geometrie und Maßen liefert. */
export interface ZylinderForm {
  /** Rohrseite: Ursprung im Fußanker, Achse +Y. */
  rohr: THREE.BufferGeometry;
  /** Stangenseite: Ursprung im Kopfanker, Achse −Y. */
  stange: THREE.BufferGeometry;
  /** Halber Augenabstand — Mitte Bohrung bis Rohrboden (m). */
  auge: number;
  /** Länge des Rohrs selbst, ohne Auge und Führungskopf (m). */
  rohrLaenge: number;
  /** Länge der Kolbenstange ab Mitte Gabelkopfbohrung (m). */
  stangeLaenge: number;
}

/**
 * Umfangssegmente des Zylinderrohrs. 14, wie in Tafel 3 angeschrieben.
 *
 * Bei r = 0,10 m misst die Sehne 2 · 0,10 · sin(180°/14) = 0,044 m und die
 * Ecke steht 2,5 mm hinter der Kreislinie zurück — auf dem iPad nicht zu
 * sehen. Weniger Segmente (der alte Wert war 10) zeigen das Vieleck, sobald
 * der Zylinder quer im Bild steht.
 */
const ROHR_SEGMENTE = 14;

/** Umfangssegmente der Kolbenstange — sie ist dünner, 10 genügen. */
const STANGE_SEGMENTE = 10;

/**
 * Verhältnis Stangendurchmesser zu Rohrdurchmesser.
 *
 * 0,55 — der Wert, mit dem der Zylinder seit dem Prototyp gezeichnet wird
 * (`rBarrel * 0.55` in `buildHydraulics`). Er bleibt, damit sich die Silhouette
 * nicht ändert.
 */
const STANGE_ZU_ROHR = 0.55;

/**
 * Augenabstand als Vielfaches des Rohrradius.
 *
 * 1,1 · r ergibt für den Hubzylinder (r = 0,10) genau die 0,11 m, mit denen im
 * Konzept gerechnet wurde: 0,11 + 2,30 (Rohr) + 0,11 = 2,52 m — der gemessene
 * kürzeste Ankerabstand von 2,518 m. Für den dünneren Stielzylinder (r = 0,08)
 * fällt das Auge entsprechend kleiner aus, sonst säße an einem schlanken Rohr
 * ein Auge wie an einem dicken.
 */
const AUGE_ZU_ROHR = 1.1;

/**
 * Überdeckung der Kolbenstange im Rohr, als Anteil der Rohrlänge.
 *
 * 0,25 — der Vorschlag aus `tools/zylinderhub.ts`. Er sorgt dafür, dass der
 * Kolben auch in der längsten Stellung noch tief im Rohr steht und beim
 * Einfahren nie hinten herausschaut. Nachgerechnet für den Hubzylinder:
 * Kolben 0,60 m … 1,84 m im 2,30 m langen Rohr.
 */
const UEBERDECKUNG = 0.25;

/** Länge des Rohrs, die aus den gemessenen Ankerabständen folgt (m). */
export function rohrLaenge(m: ZylinderMasse): number {
  return m.kurz - 2 * m.rRohr * AUGE_ZU_ROHR;
}

/** Länge der Kolbenstange, die aus Hub und Rohrlänge folgt (m). */
export function stangeLaenge(m: ZylinderMasse): number {
  return m.lang - m.kurz + rohrLaenge(m) * UEBERDECKUNG;
}

/**
 * a — Bodenauge mit Kugelbuchse.
 *
 * Die Lasche liegt QUER zur Zylinderachse (Bohrung in X), so wie sie am
 * Lagerbock sitzt. Die Kugelbuchse steht beidseits als Bund heraus; sie ist
 * das Teil, an dem man von nahem sieht, dass der Zylinder gelenkig angebunden
 * ist und nicht angeschweißt.
 */
function bodenauge(r: number, auge: number): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const lasche = new THREE.CylinderGeometry(auge, auge, r * 1.9, 12);
  lasche.rotateZ(Math.PI / 2); // Bohrungsachse nach X
  teile.push(lasche);
  for (const s of [-1, 1]) {
    const buchse = new THREE.CylinderGeometry(auge * 0.55, auge * 0.55, r * 0.5, 10);
    buchse.rotateZ(Math.PI / 2);
    buchse.translate(s * r * 1.15, 0, 0);
    teile.push(buchse);
  }
  // Hals: vom Auge auf den Rohrboden, leicht konisch wie ein Gussteil
  const hals = new THREE.CylinderGeometry(r, auge * 0.9, auge * 1.3, 12);
  hals.translate(0, auge * 0.55, 0);
  teile.push(hals);
  return teile;
}

/** b — das Zylinderrohr selbst. Seine Länge ändert sich NIE. */
function zylinderrohr(r: number, auge: number, laenge: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, laenge, ROHR_SEGMENTE);
  g.translate(0, auge + laenge / 2, 0);
  return g;
}

/**
 * c — Führungskopf mit sechs Schraubenköpfen.
 *
 * Der Führungskopf ist der Bund, durch den die Stange austritt. Er ist das
 * Teil, an dem man von außen abliest, WO das Rohr endet — und damit das Teil,
 * das die Dehnung von früher sofort verraten hätte.
 */
function fuehrungskopf(r: number, auge: number, laenge: number): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const yKopf = auge + laenge;
  const bund = new THREE.CylinderGeometry(r * 1.18, r * 1.18, r * 0.9, ROHR_SEGMENTE);
  bund.translate(0, yKopf - r * 0.25, 0);
  teile.push(bund);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    // Sechskant: sechs Segmente, mehr sieht man an einer 3-cm-Schraube nie
    const kopf = new THREE.CylinderGeometry(r * 0.17, r * 0.17, r * 0.34, 6);
    kopf.translate(Math.sin(a) * r * 0.92, yKopf + r * 0.05, Math.cos(a) * r * 0.92);
    teile.push(kopf);
  }
  return teile;
}

/**
 * f — zwei Anschlussstutzen mit Kurzschläuchen.
 *
 * Sie sitzen auf der Rückseite (−Z): unten der Anschluss für die Kolbenseite,
 * oben der für die Stangenseite. Dazwischen läuft der Schlauch am Rohr
 * entlang. Ohne sie ist ein Zylinder ein Rohr ohne Öl.
 */
function anschluesse(r: number, auge: number, laenge: number): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const yUnten = auge + r * 1.4;
  const yOben = auge + laenge - r * 1.4;
  for (const y of [yUnten, yOben]) {
    const stutzen = new THREE.CylinderGeometry(r * 0.24, r * 0.24, r * 1.3, 8);
    stutzen.rotateX(Math.PI / 2);
    stutzen.translate(0, y, -r * 1.0);
    teile.push(stutzen);
    const bund = new THREE.CylinderGeometry(r * 0.33, r * 0.33, r * 0.28, 6);
    bund.rotateX(Math.PI / 2);
    bund.translate(0, y, -r * 1.45);
    teile.push(bund);
  }
  // Kurzschlauch: verbindet die beiden Stutzen längs am Rohr
  const schlauch = new THREE.CylinderGeometry(r * 0.17, r * 0.17, yOben - yUnten, 6);
  schlauch.translate(0, (yUnten + yOben) / 2, -r * 1.5);
  teile.push(schlauch);
  return teile;
}

/**
 * d — die Kolbenstange, blank.
 *
 * Ursprung ist der KOPFANKER; die Stange hängt nach −Y ins Rohr. Ihre Länge
 * ist fest. Wie weit sie heraussteht, entscheidet allein der Ankerabstand.
 */
function kolbenstange(r: number, laenge: number): THREE.BufferGeometry {
  const rs = r * STANGE_ZU_ROHR;
  const g = new THREE.CylinderGeometry(rs, rs, laenge, STANGE_SEGMENTE);
  g.translate(0, -laenge / 2, 0);
  return g;
}

/**
 * e — Gabelkopf, Bolzen, Sicherungsblech.
 *
 * Das Teil, an dem der Streckfehler aufgefallen wäre: Zwei Wangen, ein Bolzen
 * quer, ein Blech dagegen. Gedehnt wäre der Bolzen zur Wurst geworden. Hier
 * kann das nicht mehr passieren — die Stange wird nicht gedehnt, sondern
 * geschoben.
 */
function gabelkopf(r: number, auge: number): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const rs = r * STANGE_ZU_ROHR;
  for (const s of [-1, 1]) {
    const wange = new THREE.BoxGeometry(r * 0.34, auge * 2.2, auge * 1.5);
    wange.translate(s * (rs + r * 0.2), auge * 0.45, 0);
    teile.push(wange);
  }
  const bolzen = new THREE.CylinderGeometry(auge * 0.48, auge * 0.48, r * 2.4, 10);
  bolzen.rotateZ(Math.PI / 2);
  teile.push(bolzen);
  // Sicherungsblech gegen das Herauswandern des Bolzens
  const blech = new THREE.BoxGeometry(r * 0.12, auge * 1.1, auge * 0.3);
  blech.translate(-(rs + r * 0.42), 0, auge * 0.75);
  teile.push(blech);
  return teile;
}

/**
 * Der fertige Zylinder: zwei verschmolzene Geometrien, sonst nichts.
 *
 * Als sechs Einzelnetze je Zylinder wären das bei fünf Zylindern 30 Netze und
 * 60 Zeichenrufe gewesen — mehr, als der ganze Bagger heute an Unterwagen,
 * Rädern und Oberwagen zusammen kostet.
 */
export function baueZylinder(m: ZylinderMasse): ZylinderForm {
  const auge = m.rRohr * AUGE_ZU_ROHR;
  const rl = rohrLaenge(m);
  const sl = stangeLaenge(m);
  if (rl <= 0) {
    throw new Error(
      `Zylinderrohr hat die Laenge ${rl.toFixed(3)} m — der kuerzeste Ankerabstand ` +
        `(${m.kurz.toFixed(3)} m) ist kleiner als die beiden Augen. Siehe E-025, Befund 2.`
    );
  }
  const rohr = mergeGeometries(
    [
      ...bodenauge(m.rRohr, auge),
      zylinderrohr(m.rRohr, auge, rl),
      ...fuehrungskopf(m.rRohr, auge, rl),
      ...anschluesse(m.rRohr, auge, rl),
    ],
    false
  );
  const stange = mergeGeometries([kolbenstange(m.rRohr, sl), ...gabelkopf(m.rRohr, auge)], false);
  if (!rohr || !stange) throw new Error("Zylinder liess sich nicht verschmelzen");
  rohr.computeVertexNormals();
  stange.computeVertexNormals();
  return { rohr, stange, auge, rohrLaenge: rl, stangeLaenge: sl };
}
