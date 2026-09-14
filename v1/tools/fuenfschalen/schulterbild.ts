/**
 * Das Blatt, an dem Schulter und Zahnwinkel zu beurteilen sind.
 *
 * Auftrag 14.09.2026: „ein Bild der einzelnen Schale, an dem man Schulter und
 * Zahnwinkel beurteilen kann." Die drei Felder beantworten je eine Frage:
 *
 *   1  Schale von der Seite, gross     Sitzt der Absatz vom Arm in die Sichel
 *                                      da, wo er hingehoert? Die beiden roten
 *                                      Striche markieren Anfang und Ende der
 *                                      Schulter, wie sie gerechnet ist.
 *   2  Schale von schraeg unten        Lesen sich die Flaechen als gekantetes,
 *                                      gegossenes Eisen — oder als Schlauch?
 *   3  Zahn am offenen Greifer         Steht die Zahnachse (rot) auf der
 *                                      Senkrechten (blau gestrichelt)?
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/schulterbild.ts
 * Ergebnis: docs/f5-schale-schulter.png
 */
import * as THREE from "three";
import {
  DREHPUNKT,
  baueGreiferschale,
  baueGreiferspitze,
  fersenStationen,
  schalenEnde,
  stoffe,
} from "../../src/fuenfschalen/teile";
import { baueGreifer } from "../../src/fuenfschalen/rig";
import { dreiecke } from "../riss";
import { Blatt, farbe } from "./png";

const BREITE = 1240;
const HOEHE = 700;
const blatt = new Blatt(BREITE, HOEHE);

const ROT = farbe("#c83c3c");
const BLAU = farbe("#2a5fa8");
const WEISS = farbe("#ffffff");

/** Ein Bildfeld malen; gibt die Abbildung Welt → Pixel zurück. */
function feld(
  obj: THREE.Object3D,
  blick: THREE.Vector3,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rand = 48
): (p: THREE.Vector3) => [number, number] {
  blatt.rechteck(x0, y0, w, h, WEISS);
  blatt.frei(x0, y0, w, h);
  const d = blick.clone().normalize();
  const rechts = new THREE.Vector3(0, 1, 0).cross(d).normalize();
  const hoch = d.clone().cross(rechts).normalize();
  const tr = dreiecke(obj, blick);
  let ax = Infinity;
  let bx = -Infinity;
  let ay = Infinity;
  let by = -Infinity;
  for (const t of tr)
    for (const q of t.p) {
      ax = Math.min(ax, q[0]);
      bx = Math.max(bx, q[0]);
      ay = Math.min(ay, q[1]);
      by = Math.max(by, q[1]);
    }
  const s = Math.min((w - rand) / (bx - ax), (h - rand) / (by - ay));
  const cx = x0 + w / 2 - ((ax + bx) / 2) * s;
  const cy = y0 + h / 2 + ((ay + by) / 2) * s;
  for (const t of tr)
    blatt.dreieck(
      t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]),
      farbe(t.farbe),
      t.ecken
    );
  return (p: THREE.Vector3) => [cx + p.dot(rechts) * s, cy - p.dot(hoch) * s];
}

/* ------------------------------------------------ 1  Schale von der Seite */

const st = stoffe();
function schaleAllein(): THREE.Group {
  const g = new THREE.Group();
  g.add(baueGreiferschale(st));
  const ende = schalenEnde();
  const spitze = baueGreiferspitze(st);
  spitze.position.set(0, ende.y, ende.z);
  spitze.rotation.x = ende.th;
  g.add(spitze);
  g.updateMatrixWorld(true);
  return g;
}

const P1 = { x: 8, y: 8, w: 700, h: HOEHE - 16 };
/*
 * 150 Pixel Rand statt 48 — die beiden Schulterzeiger stehen 13 cm ueber dem
 * Koerper und liefen sonst oben aus dem Bildfeld heraus.
 */
const nachPixel = feld(schaleAllein(), new THREE.Vector3(1, 0, 0), P1.x, P1.y, P1.w, P1.h, 150);

/*
 * Die Schulter markieren — dieselben zwei Zahlen wie in `baueGreiferschale`.
 *
 * Sie stehen dort als `SCHULTER_AB` und `SCHULTER_BIS`, als Anteil der
 * Fersenkurve. Hier werden sie auf die Kurve zurueckgerechnet und als kurze
 * Striche quer zur Bahn eingezeichnet, damit man sieht, ob der Absatz im Bild
 * dort liegt, wo er gerechnet ist.
 */
const SCHULTER = [0.42, 0.74]; // SW 14.09.2026, siehe `baueGreiferschale`
const ferse = fersenStationen(60, DREHPUNKT.versatz);
for (const ziel of SCHULTER) {
  const f = ferse.reduce((a, b) => (Math.abs(b.t - ziel) < Math.abs(a.t - ziel) ? b : a));
  /* Aussennormale (−sin th, cos th) — dieselbe Regel wie im `strang`. */
  const ny = -Math.sin(f.th);
  const nz = Math.cos(f.th);
  /*
   * Der Strich steht AUSSERHALB des Koerpers, als Zeiger.
   *
   * Quer durchgezogen liefen die beiden Striche einander ueber den Weg: Die
   * Fersenkurve dreht zwischen den Marken um rund 30°, und zwei 50-cm-Linien
   * durch zwei 10 cm auseinanderliegende Punkte kreuzen sich dann mitten im
   * Bauteil. Der dickste Punkt des Koerpers liegt bei 0,19 m von der Bahn;
   * darum beginnt der Zeiger bei 0,21.
   */
  const a = nachPixel(new THREE.Vector3(0, f.y + 0.21 * ny, f.z + 0.21 * nz));
  const b = nachPixel(new THREE.Vector3(0, f.y + 0.34 * ny, f.z + 0.34 * nz));
  blatt.linie(a[0], a[1], b[0], b[1], ROT, 4, 2);
}

/* ------------------------------------------ 2  Schale von schraeg unten */

const P2 = { x: 716, y: 8, w: BREITE - 724, h: 340 };
feld(schaleAllein(), new THREE.Vector3(0.8, -0.45, 1), P2.x, P2.y, P2.w, P2.h);

/* ------------------------------------------- 3  Zahn am offenen Greifer */

const P3 = { x: 716, y: 356, w: BREITE - 724, h: HOEHE - 364 };
const g = baueGreifer(st);
g.setOeffnung(1);
g.wurzel.updateMatrixWorld(true);
const schale = g.schalen[0]!.gelenk;
/*
 * Nur der ZAHN im Feld, nicht die ganze Schale.
 *
 * Mit der ganzen Schale sass er als 20-Pixel-Zipfel am unteren Rand, und die
 * Senkrechte lief aus dem Bildfeld heraus — beurteilen konnte man daran nichts.
 * Die Schale steht gross im ersten und zweiten Feld; hier geht es um den Winkel.
 */
const zuPixel = feld(
  schale.getObjectByName("SHELL_TIP_01")!,
  new THREE.Vector3(1, 0, 0),
  P3.x,
  P3.y,
  P3.w,
  P3.h
);

/* Zahnachse aus den beiden Stirnquerschnitten — siehe `abcde.ts`. */
const zahn = schale.getObjectByName("07_ZAHN") as THREE.Mesh;
zahn.updateWorldMatrix(true, false);
const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
const mitte = (welche: number): THREE.Vector3 => {
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < 5; i++) s.add(v.fromBufferAttribute(pos, welche * 5 + i));
  return s.multiplyScalar(0.2).applyMatrix4(zahn.matrixWorld);
};
const fuss = mitte(0);
const spitze = mitte(1);
/* Die Senkrechte durch den Zahnsitz, weit ueber den Zahn hinaus gezogen. */
const lot = fuss.clone().add(new THREE.Vector3(0, -0.3, 0));
const oben = fuss.clone().add(new THREE.Vector3(0, 0.06, 0));
const pLotO = zuPixel(oben);
const pLotU = zuPixel(lot);
blatt.linie(pLotO[0], pLotO[1], pLotU[0], pLotU[1], BLAU, 5, 2);
const pA = zuPixel(fuss);
const pB = zuPixel(spitze.clone().sub(fuss).multiplyScalar(1.2).add(fuss));
blatt.linie(pA[0], pA[1], pB[0], pB[1], ROT, 0, 2);

blatt.schreibe("docs/f5-schale-schulter.png");
console.log(`  Schulter markiert bei t = ${SCHULTER.join(" und ")} der Fersenkurve`);
const d = spitze.clone().sub(fuss);
const aussen = new THREE.Vector2(fuss.x, fuss.z).normalize();
console.log(
  `  Zahnachse offen: ${((Math.atan2(d.x * aussen.x + d.z * aussen.y, -d.y) * 180) / Math.PI).toFixed(2)}° gegen die Senkrechte`
);
