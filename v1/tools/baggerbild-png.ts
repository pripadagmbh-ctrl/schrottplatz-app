/**
 * Dieselben Risse wie `tools/baggerbild.ts`, nur als PNG.
 *
 * Grund: Ein SVG lässt sich nicht überall ansehen, ein PNG schon. Gerastert
 * wird mit `tools/fuenfschalen/png.ts` — ohne Browser, ohne WebGL, mit
 * Tiefenpuffer je Bildfeld. Das zeigt die FORM, nicht die Beleuchtung; wie es
 * auf dem iPad aussieht, entscheidet Patrick am Gerät.
 *
 * EIN BEKANNTER HAKEN: `Blatt.dreieck` ordnet die Ecktiefen um eine Ecke
 * verdreht zu (`z[1]·w0 + z[2]·w1 + z[0]·w2`). Derselbe Befund steht in
 * `tools/radbild.ts` vom 14.09.2026 — dort waren daraus grüne Späne über der
 * Felge geworden. Hier wird die Reihenfolge beim Übergeben zurechtgedreht,
 * statt fremden Werkzeugcode anzufassen.
 *
 * Aufruf:  npx vite-node tools/baggerbild-png.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { mkdirSync } from "node:fs";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/** Arm in eine Stellung bringen — samt Hydraulik, sonst stehen die Zylinder. */
function stelle(boomGrad: number, stickGrad: number): void {
  finde("07_AUSLEGER").rotation.x = -THREE.MathUtils.degToRad(boomGrad);
  finde("07_STIEL").rotation.x = -THREE.MathUtils.degToRad(stickGrad);
  bagger.root.updateWorldMatrix(true, true);
  (bagger as unknown as { updateHydraulics(): void }).updateHydraulics();
}

/**
 * Ein Mesh in Weltlage kopieren — BUNTE Netze dabei in ihre Farbflächen
 * zerlegen.
 *
 * Der Rasterer liest `material.color`, und das ist bei einem Netz mit
 * Eckfarben absichtlich WEISS (siehe `bauteile.ts`): Three multipliziert
 * Material- und Eckfarbe, und mit Weiß kommt die Eckfarbe heraus. Ohne diese
 * Zerlegung wären Räumschild, Pratzen, Kabine und Fahrer im Riss weiß —
 * genau das war im ersten Blatt vom 15.09.2026 zu sehen.
 *
 * Im Spiel bleibt jedes davon EIN Netz mit einem Zeichenruf; hier wird nur
 * fürs Bild aufgeteilt.
 */
function farbtreu(o: THREE.Mesh, ziel: THREE.Group): void {
  o.updateWorldMatrix(true, false);
  const geo = o.geometry as THREE.BufferGeometry;
  const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!col) {
    const k = new THREE.Mesh(geo, o.material);
    k.applyMatrix4(o.matrixWorld);
    ziel.add(k);
    return;
  }
  const idx = geo.getIndex()!;
  const gruppen = new Map<string, number[]>();
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const s = `${col.getX(a).toFixed(4)},${col.getY(a).toFixed(4)},${col.getZ(a).toFixed(4)}`;
    const liste = gruppen.get(s) ?? [];
    liste.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    gruppen.set(s, liste);
  }
  for (const [s, liste] of gruppen) {
    const teil = new THREE.BufferGeometry();
    teil.setAttribute("position", geo.getAttribute("position"));
    teil.setAttribute("normal", geo.getAttribute("normal"));
    teil.setIndex(liste);
    const [r, g, b] = s.split(",").map(Number) as [number, number, number];
    const c = new THREE.Color();
    c.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
    const k = new THREE.Mesh(teil, new THREE.MeshStandardMaterial({ color: c }));
    k.applyMatrix4(o.matrixWorld);
    ziel.add(k);
  }
}

/** Ausgewählte Meshes in eine Hilfsgruppe kopieren, in Weltlage. */
function nur(namen: string[]): THREE.Object3D {
  const g = new THREE.Group();
  for (const n of namen) farbtreu(finde(n) as THREE.Mesh, g);
  return g;
}

/** Die ganze Maschine, farbtreu — ohne die Spinne, die hier nicht zur Sache gehört. */
function ganzeMaschine(): THREE.Object3D {
  const g = new THREE.Group();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    farbtreu(o, g);
  });
  return g;
}

/** Ein Bildfeld: Rahmen freiräumen, Objekt einpassen, malen. */
function feld(
  blatt: Blatt,
  obj: THREE.Object3D,
  blick: THREE.Vector3,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  blatt.rechteck(x, y, w, h, [0xff, 0xff, 0xff]);
  blatt.frei(x, y, w, h);
  const tr = dreiecke(obj, blick);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of tr)
    for (const p of t.p) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
  const rand = 18;
  const s = Math.min(
    (w - 2 * rand) / Math.max(x1 - x0, 1e-6),
    (h - 2 * rand) / Math.max(y1 - y0, 1e-6)
  );
  const cx = x + w / 2 - ((x0 + x1) / 2) * s;
  const cy = y + h / 2 + ((y0 + y1) / 2) * s;
  for (const t of tr) {
    const p = t.p.map((q) => [cx + q[0] * s, cy - q[1] * s] as [number, number]);
    const e = t.ecken;
    blatt.dreieck(p, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
}

mkdirSync("docs/messungen/2026-09-15-bagger", { recursive: true });

const BREITE = 1500;
const HOEHE = 980;
const ZB = Math.floor((BREITE - 30) / 2);
const ZH = Math.floor((HOEHE - 30) / 2);
const SEITE = new THREE.Vector3(1, 0.06, 0.02);
const VORN = new THREE.Vector3(0.02, 0.06, 1);
const SCHRAEG = new THREE.Vector3(0.75, 0.32, 1);

// Blatt 1 — die ganze Maschine, Arbeits- und Ruhestellung
const b1 = new Blatt(BREITE, HOEHE);
stelle(58, -35);
feld(b1, ganzeMaschine(), SEITE, 10, 10, ZB, ZH);
feld(b1, ganzeMaschine(), SCHRAEG, 20 + ZB, 10, ZB, ZH);
stelle(8, -132);
feld(b1, ganzeMaschine(), SEITE, 10, 20 + ZH, ZB, ZH);
feld(b1, ganzeMaschine(), VORN, 20 + ZB, 20 + ZH, ZB, ZH);
b1.schreibe("docs/messungen/2026-09-15-bagger/01-maschine.png");

// Blatt 2 — die drei Baugruppen einzeln
const b2 = new Blatt(BREITE, HOEHE);
const HUB = ["07_ZYLINDER_HUB_L_ROHR", "07_ZYLINDER_HUB_L_STANGE"];
stelle(5, -140); // eingefahren
feld(b2, nur(HUB), SEITE, 10, 10, ZB, ZH);
stelle(70, -25); // ausgefahren
feld(b2, nur(HUB), SEITE, 20 + ZB, 10, ZB, ZH);
/*
 * Der Drehkranz wird FLACH angesehen (Blickhöhe 0,08 statt 0,32). Von schräg
 * oben verdeckt ihn die Deckplatte des Oberwagens vollständig — genau das war
 * ja der Befund: Er saß bisher unsichtbar unter ihr. Mitgezeichnet wird der
 * Unterwagenkasten, damit man die Taille als Taille sieht.
 */
feld(
  b2,
  nur(["01_UNTERWAGEN_LACK", "01_UNTERWAGEN_STAHL", "04_DREHKRANZ"]),
  new THREE.Vector3(0.75, 0.08, 1),
  10,
  20 + ZH,
  ZB,
  ZH
);
feld(
  b2,
  nur([
    "07_AUSLEGER_KASTEN",
    "07_AUSLEGER_STAHL",
    "07_SCHLAUCH_AUSLEGER",
    "07_STIEL_KASTEN",
    "07_STIEL_STAHL",
    "07_SCHLAUCH_STIEL",
  ]),
  SCHRAEG,
  20 + ZB,
  20 + ZH,
  ZB,
  ZH
);
b2.schreibe("docs/messungen/2026-09-15-bagger/02-bauteile.png");

/*
 * Blatt 3 — das FAHRWERK gross.
 *
 * Auf dem Uebersichtsblatt ist die Maschine 60 Pixel hoch; ob ein Rad im
 * Kasten steckt, sieht man dort nicht. Genau das war aber der Befund
 * (E-025, Befund 1: die obersten 54 cm des Rades waren verdeckt), also
 * bekommt es ein eigenes Blatt.
 */
const b3 = new Blatt(BREITE, 640);
const FAHRWERK = [
  "01_UNTERWAGEN_LACK",
  "01_UNTERWAGEN_STAHL",
  "02_RAD_VL_REIFEN",
  "02_RAD_VL_FELGE",
  "02_RAD_VL_NABE",
  "02_RAD_VR_REIFEN",
  "02_RAD_VR_FELGE",
  "02_RAD_VR_NABE",
  "02_RAD_HL_REIFEN",
  "02_RAD_HL_FELGE",
  "02_RAD_HL_NABE",
  "02_RAD_HR_REIFEN",
  "02_RAD_HR_FELGE",
  "02_RAD_HR_NABE",
  "04_DREHKRANZ",
];
feld(b3, nur(FAHRWERK), SEITE, 10, 10, ZB, 620);
feld(b3, nur(FAHRWERK), new THREE.Vector3(0.45, 0.22, 1), 20 + ZB, 10, ZB, 620);
b3.schreibe("docs/messungen/2026-09-15-bagger/04-fahrwerk.png");

/*
 * Blatt 5 — der OBERWAGEN gross.
 *
 * Geländer, Auspuff, Lüftungsgitter und die gestufte Haube sind auf dem
 * Übersichtsblatt je zwei Pixel breit. Wer sie beurteilen soll, braucht sie
 * gross.
 */
const b5 = new Blatt(BREITE, 640);
const OBERWAGEN = ["04_DREHKRANZ", "05_MOTORHAUBE", "05_LEUCHTEN"];
feld(b5, nur(OBERWAGEN), new THREE.Vector3(0.8, 0.3, 1), 10, 10, ZB, 620);
feld(b5, nur(OBERWAGEN), new THREE.Vector3(1, 0.12, 0.05), 20 + ZB, 10, ZB, 620);
b5.schreibe("docs/messungen/2026-09-15-bagger/05-oberwagen.png");

/*
 * Blatt 6 — die KABINE gross.
 *
 * Glas wird vom Rasterer als deckende Flaeche gemalt (er kennt keine
 * Durchsichtigkeit). Deshalb zwei Felder: eins mit Glas — so sieht man die
 * Silhouette —, eins ohne, damit Sitz, Konsolen, Joysticks und Display
 * sichtbar sind.
 */
const b6 = new Blatt(BREITE, 700);
const KABINE_AUSSEN = [
  "06_KABINE_LACK",
  "06_KABINE_STAHL",
  "06_SCHEIBEN",
  "08_NAMENSSCHILD",
];
const KABINE_INNEN = [
  "06_KABINE_LACK",
  "06_KABINE_STAHL",
  "06_SITZ",
  "06_JOYSTICK_R_HEBEL",
  "06_JOYSTICK_L_HEBEL",
  "06_FAHRER_HAND_R",
  "06_FAHRER_HAND_L",
  "06_FAHRER_HAUT",
  "06_FAHRER_KLEIDUNG",
];
feld(b6, nur(KABINE_AUSSEN), new THREE.Vector3(-0.9, 0.25, 1), 10, 10, ZB, 680);
feld(b6, nur(KABINE_INNEN), new THREE.Vector3(-0.9, 0.25, 1), 20 + ZB, 10, ZB, 680);
b6.schreibe("docs/messungen/2026-09-15-bagger/06-kabine.png");
