import { mkdirSync } from "node:fs";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  DREHPUNKT,
  HUB_MAX,
  KABINE_UMRISS,
  LENKER_L,
  LENKER_X,
  MAST_HOEHE,
  NISCHE_BEDARF,
  VORLAUF,
  WINKEL_OBEN,
  WINKEL_UNTEN,
  ZYL_MASSE,
  hubVersatz,
  hubWinkel,
} from "../src/excavator/kabinenhubParts";
import { DECK_OBEN, HAUBE_HALB, HAUBE_OBEN, HAUBE_STUFE, HAUBE_VORN, HAUBE_HINTEN, NISCHE } from "../src/excavator/oberwagenParts";

/**
 * Der Kabinenhub, nachgemessen (E-040, Paket 8 aus E-025).
 *
 * Anlass: Dies ist die einzige Änderung im ganzen Baggerumbau, die den
 * Augpunkt der Kabinenkamera berührt. Deshalb wird sie nicht beschrieben,
 * sondern gemessen — und zwar an der wirklich gebauten Maschine, nicht an
 * einer Nebenrechnung.
 *
 * Aufruf:  npx vite-node tools/kabinenhub-bahn.ts
 *
 * Das Bild am Ende ist eine RISSZEICHNUNG aus der echten Szene (orthogonale
 * Projektion, flache Schattierung — `tools/riss.ts`), KEIN Bildschirmfoto.
 */

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));

/** Hubhöhe setzen und die ganze Maschine nachziehen. */
const geheAuf = (h: number): void => {
  const b = bagger as unknown as { cabLift: number; syncMeshes(): void; updateHydraulics(): void };
  b.cabLift = h;
  b.syncMeshes();
  b.updateHydraulics();
};

/**
 * Augpunkt IM FRAME DER MASCHINE. `getCabinEye` liefert Weltkoordinaten, und
 * der Bagger steht auf (−0,5 | −22,5) — dort stünden statt der 0,20 m Vorlauf
 * −22,30 im Bericht.
 */
const augpunkt = (out: THREE.Vector3): THREE.Vector3 => {
  bagger.getCabinEye(out);
  bagger.root.updateMatrixWorld(true);
  return out.applyMatrix4(new THREE.Matrix4().copy(bagger.root.matrixWorld).invert());
};

const zahl = (n: number, s = 3): string => n.toFixed(s).replace(".", ",");

console.log("KABINENHUB — Mast hinter der Kabine, gemessen an der gebauten Maschine");
console.log("=====================================================================");
console.log("");
console.log(`Drehpunkt (Oberwagen-Frame)  y ${zahl(DREHPUNKT.y)} | z ${zahl(DREHPUNKT.z)}`);
console.log(`Mast über der Deckplatte     ${zahl(MAST_HOEHE)} m`);
console.log(`Lenker                       ${zahl(LENKER_L)} m bei x ${zahl(LENKER_X[0], 2)} und ${zahl(LENKER_X[1], 2)}`);
console.log(
  `Schwenkbereich               ${zahl((WINKEL_UNTEN * 180) / Math.PI, 1)}° … ` +
    `${zahl((WINKEL_OBEN * 180) / Math.PI, 1)}°  (${zahl(((WINKEL_OBEN - WINKEL_UNTEN) * 180) / Math.PI, 1)}°)`
);
console.log(
  `Zylinder                     ${zahl(ZYL_MASSE.kurz)} … ${zahl(ZYL_MASSE.lang)} m  ` +
    `= ${zahl(ZYL_MASSE.lang / ZYL_MASSE.kurz, 2)} : 1   (vorher 5,18 : 1)`
);
console.log("");

/* ------------------------------------------------- 1. Die Bahn des Augpunkts */

console.log("1 — DIE BAHN DES AUGPUNKTS, heute gegen neu");
console.log("-------------------------------------------");
console.log("Hub    heute y      heute z      neu y        neu z     Δz (waagerecht)");
const auge = new THREE.Vector3();
let groessteDz = 0;
let groessteDzBei = 0;
const bahnNeu: Array<[number, number]> = [];
const bahnAlt: Array<[number, number]> = [];
for (let i = 0; i <= 13; i++) {
  const h = (HUB_MAX * i) / 13;
  geheAuf(h);
  augpunkt(auge);
  const altY = 3.28 + h;
  const altZ = 0.2 + h * VORLAUF;
  const dz = auge.z - altZ;
  if (Math.abs(dz) > Math.abs(groessteDz)) {
    groessteDz = dz;
    groessteDzBei = h;
  }
  bahnNeu.push([auge.z, auge.y]);
  bahnAlt.push([altZ, altY]);
  console.log(
    `${zahl(h, 2).padStart(5)}  ${zahl(altY).padStart(9)}  ${zahl(altZ).padStart(11)}  ` +
      `${zahl(auge.y).padStart(9)}  ${zahl(auge.z).padStart(9)}  ${zahl(dz).padStart(12)}`
  );
}
console.log("");
console.log(`Größte waagerechte Abweichung  ${zahl(groessteDz)} m bei Hub ${zahl(groessteDzBei, 2)} m`);
console.log(`Sehnenabstand (senkrecht zur Geraden) ${zahl(LENKER_L - Math.sqrt(LENKER_L ** 2 - ((HUB_MAX * Math.hypot(1, VORLAUF)) / 2) ** 2))} m`);
geheAuf(0);
augpunkt(auge);
console.log(`Augpunkt unten   y ${zahl(auge.y)} | z ${zahl(auge.z)}   (Soll 3,280 | 0,200)`);
geheAuf(HUB_MAX);
augpunkt(auge);
console.log(`Augpunkt oben    y ${zahl(auge.y)} | z ${zahl(auge.z)}   (Soll 5,880 | 1,084)`);
console.log("");

/* ------------------------------- 2. Läuft ein Lenker durch den Kabinenraum? */

console.log("2 — 861 ABGETASTETE STELLUNGEN GEGEN DEN KABINENUMRISS");
console.log("------------------------------------------------------");
console.log("41 Lenkerstellungen × 21 Punkte je Lenker, wie in tools/kabinenhub.ts.");
let treffer = 0;
const versatz = new THREE.Vector3();
for (let i = 0; i <= 40; i++) {
  const h = (HUB_MAX * i) / 40;
  const w = hubWinkel(h);
  hubVersatz(h, versatz);
  for (let t = 0; t <= 20; t++) {
    const y = DREHPUNKT.y + Math.sin(w) * LENKER_L * (t / 20);
    const z = DREHPUNKT.z + Math.cos(w) * LENKER_L * (t / 20);
    if (
      y > KABINE_UMRISS.yVon + versatz.y &&
      y < KABINE_UMRISS.yBis + versatz.y &&
      z > KABINE_UMRISS.zVon + versatz.z &&
      z < KABINE_UMRISS.zBis + versatz.z
    ) {
      treffer++;
    }
  }
}
console.log(`Durchdringungen: ${treffer} von 861     (Variante B „Lenker vorn": 186 von 861)`);

/* -------------------------- 3. Was die beweglichen Teile wirklich streifen */

interface Kasten {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/**
 * Die festen Hindernisse am Oberwagen, als Quader.
 *
 * Haube und Aussparung kommen aus `oberwagenParts.ts`; Tank, Deckel und
 * Geländer sind dort als Quader gebaut und hier mit denselben Zahlen
 * angeschrieben (die Prüfung unten läuft gegen die WIRKLICHEN Eckpunkte der
 * beweglichen Teile, nicht gegen eine zweite Rechnung).
 */
const HINDERNISSE: Kasten[] = [
  { name: "Haube unten, linkes Band", x0: -HAUBE_HALB, x1: NISCHE.xVon, y0: DECK_OBEN, y1: HAUBE_STUFE, z0: HAUBE_HINTEN, z1: HAUBE_VORN },
  { name: "Haube unten, rechter Teil", x0: NISCHE.xBis, x1: HAUBE_HALB, y0: DECK_OBEN, y1: HAUBE_STUFE, z0: HAUBE_HINTEN, z1: HAUBE_VORN },
  { name: "Haube unten, hinter der Nische", x0: NISCHE.xVon, x1: NISCHE.xBis, y0: DECK_OBEN, y1: HAUBE_STUFE, z0: HAUBE_HINTEN, z1: NISCHE.zHinten },
  { name: "Haube oben, linkes Band", x0: -(HAUBE_HALB - 0.17), x1: NISCHE.xVon, y0: HAUBE_STUFE, y1: HAUBE_OBEN, z0: -1.76, z1: -0.36 },
  { name: "Haube oben, rechter Teil", x0: NISCHE.xBis, x1: HAUBE_HALB - 0.17, y0: HAUBE_STUFE, y1: HAUBE_OBEN, z0: -1.76, z1: -0.36 },
  { name: "Haube oben, hinter der Nische", x0: NISCHE.xVon, x1: NISCHE.xBis, y0: HAUBE_STUFE, y1: HAUBE_OBEN, z0: -1.76, z1: NISCHE.zHinten },
  { name: "Hydrauliktank (-X)", x0: -1.4, x1: -1.24, y0: DECK_OBEN, y1: DECK_OBEN + 0.44, z0: -1.81, z1: -1.09 },
  { name: "Tankdeckel (-X)", x0: -1.42, x1: -1.22, y0: DECK_OBEN + 0.44, y1: DECK_OBEN + 0.48, z0: -1.83, z1: -1.07 },
  { name: "Gelaender-Handlauf (-X)", x0: -1.108, x1: -1.052, y0: HAUBE_STUFE, y1: HAUBE_STUFE + 0.93, z0: -1.8, z1: -0.35 },
  { name: "Kabinenbodenblech", x0: -1.6, x1: -0.5, y0: 0.545, y1: 0.615, z0: -0.105, z1: 0.645 },
  { name: "Auspuff", x0: -0.955, x1: -0.765, y0: HAUBE_OBEN, y1: HAUBE_OBEN + 0.5, z0: -0.645, z1: -0.455 },
];

/** Die beweglichen Netze des Hubwerks samt Mast. */
const BEWEGT = ["06_KABINENLENKER", "06_ZYLINDER_KABINE_ROHR", "06_ZYLINDER_KABINE_STANGE"];
const FEST = ["06_KABINENMAST"];

/**
 * Für jedes Hindernis: der kleinste Abstand, den ein Eckpunkt der bewegten
 * Teile je davon hatte. Negativ heißt: er stand darin.
 */
function abstand(p: THREE.Vector3, k: Kasten): number {
  const dx = Math.max(k.x0 - p.x, p.x - k.x1);
  const dy = Math.max(k.y0 - p.y, p.y - k.y1);
  const dz = Math.max(k.z0 - p.z, p.z - k.z1);
  if (dx > 0 || dy > 0 || dz > 0) return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
  return Math.max(dx, dy, dz); // alle negativ → tiefste Durchdringung
}

const naechster = new Map<string, number>();
const p = new THREE.Vector3();
const inv = new THREE.Matrix4();
const kabinenNetz = scene.getObjectByName("06_KABINE")!;
for (let i = 0; i <= 40; i++) {
  geheAuf((HUB_MAX * i) / 40);
  // Alles im Frame des Oberwagens messen
  const ober = scene.getObjectByName("05_OBERWAGEN")!;
  ober.updateWorldMatrix(true, true);
  inv.copy(ober.matrixWorld).invert();
  // Das Bodenblech wandert mit der Kabine — Hindernis nachführen
  kabinenNetz.updateWorldMatrix(true, false);
  const v = new THREE.Vector3().setFromMatrixPosition(kabinenNetz.matrixWorld).applyMatrix4(inv);
  const boden = HINDERNISSE.find((k) => k.name === "Kabinenbodenblech")!;
  const bodenJetzt: Kasten = { ...boden, y0: 0.545 + v.y, y1: 0.615 + v.y, z0: -0.105 + v.z, z1: 0.645 + v.z };
  for (const name of [...BEWEGT, ...(i === 0 ? FEST : [])]) {
    const m = scene.getObjectByName(name) as THREE.Mesh;
    m.updateWorldMatrix(true, false);
    const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const pos = (m.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute;
    for (let j = 0; j < pos.count; j++) {
      p.fromBufferAttribute(pos, j).applyMatrix4(mat);
      for (const k of HINDERNISSE) {
        const kk = k.name === "Kabinenbodenblech" ? bodenJetzt : k;
        const d = abstand(p, kk);
        const schluessel = `${name} ↔ ${k.name}`;
        if (!naechster.has(schluessel) || d < naechster.get(schluessel)!) naechster.set(schluessel, d);
      }
    }
  }
}
console.log("");
console.log("3 — FREIGÄNGE (kleinster Abstand über 41 Hubstellungen, negativ = steckt drin)");
console.log("-----------------------------------------------------------------------------");
const eng = [...naechster.entries()].filter(([, d]) => d < 0.25).sort((a, b) => a[1] - b[1]);
for (const [was, d] of eng) console.log(`${zahl(d).padStart(8)} m   ${was}`);
const drin = eng.filter(([, d]) => d < 0);
console.log(drin.length === 0 ? "Keine Durchdringung." : `${drin.length} DURCHDRINGUNGEN!`);

/* ---------------------------------------- 4. Nische, Deckkante, Netze zählen */

console.log("");
console.log("4 — NISCHE, DECKKANTE, NETZE");
console.log("----------------------------");
console.log(
  `Nische  x ${zahl(NISCHE.xVon, 2)} … ${zahl(NISCHE.xBis, 2)} · z ${zahl(NISCHE.zHinten, 2)} … ${zahl(HAUBE_VORN, 2)}` +
    `   Bedarf x ${zahl(NISCHE_BEDARF.xVon, 2)} … ${zahl(NISCHE_BEDARF.xBis, 2)} · z bis ${zahl(NISCHE_BEDARF.zHinten, 2)}`
);
const nischeBreite = NISCHE.xBis - NISCHE.xVon;
const volAlt = HAUBE_HALB * 2 * (HAUBE_STUFE - DECK_OBEN) * (HAUBE_VORN - HAUBE_HINTEN) + (HAUBE_HALB - 0.17) * 2 * (HAUBE_OBEN - HAUBE_STUFE) * 1.4;
const volWeg = nischeBreite * (HAUBE_VORN - NISCHE.zHinten) * (HAUBE_STUFE - DECK_OBEN) + nischeBreite * (-0.36 - NISCHE.zHinten) * (HAUBE_OBEN - HAUBE_STUFE);
console.log(`Haubenvolumen ${zahl(volAlt, 2)} m³, ausgespart ${zahl(volWeg, 3)} m³ = ${zahl((100 * volWeg) / volAlt, 1)} %`);

const mast = scene.getObjectByName("06_KABINENMAST") as THREE.Mesh;
mast.geometry.computeBoundingBox();
console.log(
  `Mast reicht bis x ${zahl(mast.geometry.boundingBox!.min.x)} — Deckkante −1,450, ` +
    `also ${zahl(-1.45 - mast.geometry.boundingBox!.min.x)} m darüber`
);
bagger.root.updateMatrixWorld(true);
let breiteste = 0;
let breitestesTeil = "";
scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  if (o.name.startsWith("06_KABINENMAST")) return;
  const g = o.geometry as THREE.BufferGeometry;
  g.computeBoundingBox();
  for (const e of [g.boundingBox!.min, g.boundingBox!.max]) {
    const w = new THREE.Vector3(e.x, g.boundingBox!.min.y, 0).applyMatrix4(o.matrixWorld);
    if (Math.abs(w.x) > breiteste) {
      breiteste = Math.abs(w.x);
      breitestesTeil = o.name;
    }
  }
});
console.log(`Breitestes Teil der Maschine: ${breitestesTeil} bei x ±${zahl(breiteste)}`);

let netze = 0;
scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === bagger.grappleGroup) return;
  netze++;
});
console.log(`Netze am Bagger (ohne Spinne): ${netze}    (vor E-040: 59, Ziel aus E-025: 57)`);

/* ------------ 5. Ein Nachbarbefund: Kabine gegen die beiden Hubzylinder ---- */

/*
 * DIE FRAGE, die dieses Paket aufwirft, ohne sie zu verursachen: Auf halbem
 * Weg steht die Kabine jetzt 0,63 m weiter vorn. Kommt sie dort den beiden
 * HUBZYLINDERN des Auslegers naeher als vorher?
 *
 * Gemessen wird der Umriss der Kabine gegen die Achse beider Zylinder, ueber
 * 21 Hubhoehen x 21 Auslegerstellungen — einmal auf der heutigen geraden
 * Bahn und einmal auf der neuen.
 */
{
  const BOOM_MIN = THREE.MathUtils.degToRad(5);
  const BOOM_MAX = THREE.MathUtils.degToRad(70);
  const ausleger = scene.getObjectByName("07_AUSLEGER")!;
  const ober = scene.getObjectByName("05_OBERWAGEN")!;
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const pq = new THREE.Vector3();
  const invO = new THREE.Matrix4();
  const messe = (bogen: boolean): number => {
    let min = Infinity;
    for (let i = 0; i <= 20; i++) {
      const h = (HUB_MAX * i) / 20;
      const v = bogen ? hubVersatz(h, new THREE.Vector3()) : new THREE.Vector3(0, h, h * VORLAUF);
      const kab: Kasten = {
        name: "Kabine",
        x0: KABINE_UMRISS.xVon,
        x1: KABINE_UMRISS.xBis,
        y0: KABINE_UMRISS.yVon + v.y,
        y1: KABINE_UMRISS.yBis + v.y,
        z0: KABINE_UMRISS.zVon + v.z,
        z1: KABINE_UMRISS.zBis + v.z,
      };
      for (let j = 0; j <= 20; j++) {
        ausleger.rotation.x = -(BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * j) / 20);
        ober.updateWorldMatrix(true, true);
        invO.copy(ober.matrixWorld).invert();
        for (const seite of ["R", "L"]) {
          scene.getObjectByName(`07_ZYLINDER_HUB_${seite}_FUSS`)!.getWorldPosition(pa).applyMatrix4(invO);
          scene.getObjectByName(`07_ZYLINDER_HUB_${seite}_KOPF`)!.getWorldPosition(pb).applyMatrix4(invO);
          for (let t = 0; t <= 40; t++) {
            pq.lerpVectors(pa, pb, t / 40);
            min = Math.min(min, abstand(pq, kab) - 0.12); // Rohrradius samt Fuehrungskopf
          }
        }
      }
    }
    ausleger.rotation.x = 0;
    return min;
  };
  console.log("");
  console.log("5 — NACHBARBEFUND: Kabinenumriss gegen die Achsen der beiden Hubzylinder");
  console.log("------------------------------------------------------------------------");
  console.log(`heutige gerade Bahn   ${zahl(messe(false))} m`);
  console.log(`neue Bogenbahn        ${zahl(messe(true))} m`);
  console.log("(negativ heisst: der Zylinder steht im Umriss der Kabine — in BEIDEN Bahnen)");
}

/* ------------------------------------------------------------- 5. Das Bild */

/*
 * EIN PNG, KEIN BILDSCHIRMFOTO. Gerastert aus der echten Szene mit
 * `tools/riss.ts` (orthogonale Projektion, flache Schattierung) und
 * `tools/fuenfschalen/png.ts` (Tiefenpuffer je Bildfeld) — so, wie die
 * uebrigen Blaetter des Baggerumbaus vom 15.09.2026 auch. Es zeigt die FORM,
 * nicht die Beleuchtung; wie es auf dem iPad aussieht, entscheidet Patrick am
 * Geraet.
 */
mkdirSync("docs/messungen/2026-09-15-bagger", { recursive: true });

/** Ein Mesh farbtreu in Weltlage kopieren (bunte Netze in Farbflaechen zerlegt). */
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

/** Die ganze Maschine farbtreu, wahlweise ohne die vordere Haelfte des Arms. */
function ganzeMaschine(): THREE.Object3D {
  const g = new THREE.Group();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) farbtreu(o, g);
  });
  return g;
}

function bildfeld(
  b: Blatt,
  obj: THREE.Object3D,
  blick: THREE.Vector3,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  b.rechteck(x, y, w, h, [0xff, 0xff, 0xff]);
  b.frei(x, y, w, h);
  const tr = dreiecke(obj, blick);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of tr)
    for (const q of t.p) {
      x0 = Math.min(x0, q[0]);
      x1 = Math.max(x1, q[0]);
      y0 = Math.min(y0, q[1]);
      y1 = Math.max(y1, q[1]);
    }
  const rand = 18;
  const s = Math.min((w - 2 * rand) / Math.max(x1 - x0, 1e-6), (h - 2 * rand) / Math.max(y1 - y0, 1e-6));
  const cx = x + w / 2 - ((x0 + x1) / 2) * s;
  const cy = y + h / 2 + ((y0 + y1) / 2) * s;
  for (const t of tr) {
    const q = t.p.map((r) => [cx + r[0] * s, cy - r[1] * s] as [number, number]);
    const e = t.ecken;
    b.dreieck(q, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
}

const BREITE = 1600;
const HOEHE = 1000;
const ZB = Math.floor((BREITE - 30) / 2);
const ZH = Math.floor((HOEHE - 30) / 2);
/** Blick von RECHTS (−X) auf die Maschine: +z laeuft im Bild nach rechts. */
const SEITE = new THREE.Vector3(-1, 0.05, 0.02);
const SCHRAEG = new THREE.Vector3(-0.8, 0.3, -0.75);

const b = new Blatt(BREITE, HOEHE);
geheAuf(0);
bildfeld(b, ganzeMaschine(), SEITE, 10, 10, ZB, ZH);
geheAuf(HUB_MAX / 2);
bildfeld(b, ganzeMaschine(), SEITE, 20 + ZB, 10, ZB, ZH);
geheAuf(HUB_MAX);
bildfeld(b, ganzeMaschine(), SEITE, 10, 20 + ZH, ZB, ZH);

// Viertes Feld: die beiden Bahnen uebereinander, in Metern
{
  const x = 20 + ZB;
  const y = 20 + ZH;
  b.rechteck(x, y, ZB, ZH, [0xff, 0xff, 0xff]);
  b.frei(x, y, ZB, ZH);
  const s = 150; // Pixel je Meter
  const ox = x + 150;
  const oy = y + ZH - 60;
  const px = (z: number): number => ox + (z - 0.2) * s;
  const py2 = (yy: number): number => oy - (yy - 3.28) * s;
  const GRAU = farbe("#8a929b");
  const ROT = farbe("#c0392b");
  const SCHWARZ = farbe("#1b2026");
  for (let i = 1; i < bahnAlt.length; i++) {
    b.linie(px(bahnAlt[i - 1]![0]), py2(bahnAlt[i - 1]![1]), px(bahnAlt[i]![0]), py2(bahnAlt[i]![1]), GRAU, 5, 2);
    b.linie(px(bahnNeu[i - 1]![0]), py2(bahnNeu[i - 1]![1]), px(bahnNeu[i]![0]), py2(bahnNeu[i]![1]), ROT, 0, 3);
  }
  for (let i = 0; i < bahnAlt.length; i++) {
    b.linie(px(bahnAlt[i]![0]), py2(bahnAlt[i]![1]), px(bahnNeu[i]![0]), py2(bahnNeu[i]![1]), ROT, 3, 1);
  }
  for (const i of [0, bahnNeu.length - 1]) {
    for (let d = -4; d <= 4; d++) {
      b.linie(px(bahnNeu[i]![0]) - 5, py2(bahnNeu[i]![1]) + d, px(bahnNeu[i]![0]) + 5, py2(bahnNeu[i]![1]) + d, SCHWARZ);
    }
  }
}
b.schreibe("docs/messungen/2026-09-15-bagger/08-kabinenhub.png");

// Ein zweites Blatt: Mast, Lenker und Zylinder gross, unten und oben
const b2 = new Blatt(BREITE, Math.floor(HOEHE / 2));
const HUBWERK = ["06_KABINENMAST", "06_KABINENLENKER", "06_ZYLINDER_KABINE_ROHR", "06_ZYLINDER_KABINE_STANGE", "05_MOTORHAUBE", "04_DREHKRANZ"];
function nurHubwerk(): THREE.Object3D {
  const g = new THREE.Group();
  for (const n of HUBWERK) farbtreu(scene.getObjectByName(n) as THREE.Mesh, g);
  return g;
}
geheAuf(0);
bildfeld(b2, nurHubwerk(), SEITE, 10, 10, ZB, Math.floor(HOEHE / 2) - 20);
geheAuf(HUB_MAX);
bildfeld(b2, nurHubwerk(), SCHRAEG, 20 + ZB, 10, ZB, Math.floor(HOEHE / 2) - 20);
b2.schreibe("docs/messungen/2026-09-15-bagger/08-kabinenhub-mast.png");
geheAuf(0);
