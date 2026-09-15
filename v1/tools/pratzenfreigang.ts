/**
 * Wie viel Luft haben die Abstützpratzen ringsum — in JEDER bewegten Stellung?
 *
 * Anlass (E-036, festgehalten in `test/fahrwerk.test.ts`): Der Pratzenausleger
 * lag bei z ±1,35 mitten im Vorderrad. Patrick hat am 15.09.2026 entschieden,
 * die Pratzen nach vorn und hinten aus dem Rad herauszuziehen. Bevor eine Zahl
 * gesetzt wird, muss sie gemessen sein — mit der ECHTEN Geometrie, nicht mit
 * der Sollzahl aus dem Datenblatt.
 *
 * WARUM DAS NICHT MIT ZWEI ZAHLEN GEHT. Das Rad ist kein Zylinder von 0,62 m
 * Halbmesser. Über die Stollen gemessen sind es 0,62, an der Flanke 0,594, am
 * Felgenhorn nur 0,42 — und genau dort, an der Flanke, liegt die Ecke des
 * Tellerfußes. Wer mit dem Zylinder rechnet, misst eine Durchdringung, die es
 * nicht gibt, und verschiebt die Pratze weiter, als nötig wäre.
 *
 * DAS VERFAHREN.
 *  1. Das Rad DREHT sich. Sein überstrichener Raum ist deshalb ein
 *     Drehkörper: für jede Stelle der Achse der grösste vorkommende
 *     Halbmesser. Dieses Profil wird aus den echten Netzpunkten gelesen
 *     (Reifen, Felge, Nabe), nicht angenommen.
 *  2. Die Pratzen werden in Punkte zerlegt (jedes Dreieck unterteilt, bis
 *     kein Punktabstand grösser als 2 cm ist).
 *  3. Jeder Punkt wird in das Radsystem gerechnet — für JEDEN Lenkeinschlag
 *     und JEDEN Ausfahrzustand — und gegen das Profil gemessen.
 *  4. Schild, Oberwagen (Gegengewicht, Auspuff) und Rahmen folgen mit
 *     Dreieck-gegen-Dreieck: kleinster Abstand und, getrennt davon, ob sich
 *     Kanten wirklich kreuzen.
 *
 * Aufruf:  npx vite-node tools/pratzenfreigang.ts
 *          npx vite-node tools/pratzenfreigang.ts --suche   (Lagen abtasten)
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { pratzenausleger, PRATZE_X, PRATZE_Z } from "../src/excavator/unterwagenParts";
import { pratzeFuss, pratzeStempel } from "../src/excavator/schildParts";
import {
  radProfil,
  punkte,
  dreieckeGeo,
  fussStrecken,
  festeStrecken,
  kleinsterRadfreigang,
  FACH,
  type Dreieck,
  type Strecke,
} from "./radraum";

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
bagger.root.updateMatrixWorld(true);

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/* ------------------------------------------------------ Dreiecke und Punkte */

/** Alle Dreiecke eines Objekts in Wurzelkoordinaten (Bagger-Frame). */
function dreieckeVon(o: THREE.Object3D, wurzel: THREE.Object3D): Dreieck[] {
  wurzel.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(wurzel.matrixWorld).invert();
  const out: Dreieck[] = [];
  o.traverse((k) => {
    const m = k as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const idx = geo.getIndex();
    const n = idx ? idx.count : pos.count;
    const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < n; i += 3) {
      const p = [0, 1, 2].map((k2) => {
        const j = idx ? idx.getX(i + k2) : i + k2;
        return new THREE.Vector3().fromBufferAttribute(pos, j).applyMatrix4(mat);
      }) as Dreieck;
      out.push(p);
    }
  });
  return out;
}

/* ------------------------------ Abstand und Kreuzung zweier Dreiecksmengen */

function kasten(tris: Dreieck[]): THREE.Box3 {
  const b = new THREE.Box3();
  for (const t of tris) for (const p of t) b.expandByPoint(p);
  return b;
}

/** Abstand Punkt–Dreieck. */
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _bp = new THREE.Vector3();
const _cp = new THREE.Vector3();
function punktDreieck(p: THREE.Vector3, t: Dreieck): number {
  const [a, b, c] = t;
  _ab.subVectors(b, a);
  _ac.subVectors(c, a);
  _ap.subVectors(p, a);
  const d1 = _ab.dot(_ap);
  const d2 = _ac.dot(_ap);
  if (d1 <= 0 && d2 <= 0) return _ap.length();
  _bp.subVectors(p, b);
  const d3 = _ab.dot(_bp);
  const d4 = _ac.dot(_bp);
  if (d3 >= 0 && d4 <= d3) return _bp.length();
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return _ap.clone().sub(_ab.clone().multiplyScalar(v)).length();
  }
  _cp.subVectors(p, c);
  const d5 = _ab.dot(_cp);
  const d6 = _ac.dot(_cp);
  if (d6 >= 0 && d5 <= d6) return _cp.length();
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return _ap.clone().sub(_ac.clone().multiplyScalar(w)).length();
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return _bp.clone().sub(c.clone().sub(b).multiplyScalar(w)).length();
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return _ap
    .clone()
    .sub(_ab.clone().multiplyScalar(v))
    .sub(_ac.clone().multiplyScalar(w))
    .length();
}

/** Abstand zweier Strecken. */
function streckeStrecke(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3
): number {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s = 0;
  let t = 0;
  if (a <= 1e-12 && e <= 1e-12) return r.length();
  if (a <= 1e-12) {
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = d1.dot(r);
    if (e <= 1e-12) {
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom > 1e-12 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).sub(p2.clone().addScaledVector(d2, t)).length();
}

/** Schneidet die Strecke p→q das Dreieck? (Möller–Trumbore) */
function streckeDreieck(p: THREE.Vector3, q: THREE.Vector3, t: Dreieck): boolean {
  const [a, b, c] = t;
  const e1 = b.clone().sub(a);
  const e2 = c.clone().sub(a);
  const dir = q.clone().sub(p);
  const h = dir.clone().cross(e2);
  const det = e1.dot(h);
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det;
  const s = p.clone().sub(a);
  const u = inv * s.dot(h);
  if (u < 0 || u > 1) return false;
  const qv = s.clone().cross(e1);
  const v = inv * dir.dot(qv);
  if (v < 0 || u + v > 1) return false;
  const w = inv * e2.dot(qv);
  return w >= 0 && w <= 1;
}

/** Kleinster Abstand zweier Dreiecksmengen (exakt: Ecke–Fläche und Kante–Kante). */
function mengenAbstand(A: Dreieck[], B: Dreieck[]): number {
  const bb = kasten(B);
  let best = Infinity;
  for (const ta of A) {
    const ka = kasten([ta]);
    if (kastenAbstand(ka, bb) > best) continue;
    for (const tb of B) {
      const kb = kasten([tb]);
      if (kastenAbstand(ka, kb) > best) continue;
      for (const p of ta) best = Math.min(best, punktDreieck(p, tb));
      for (const p of tb) best = Math.min(best, punktDreieck(p, ta));
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          best = Math.min(
            best,
            streckeStrecke(ta[i]!, ta[(i + 1) % 3]!, tb[j]!, tb[(j + 1) % 3]!)
          );
        }
      }
    }
  }
  return best;
}

function kastenAbstand(a: THREE.Box3, b: THREE.Box3): number {
  const dx = Math.max(0, Math.max(a.min.x - b.max.x, b.min.x - a.max.x));
  const dy = Math.max(0, Math.max(a.min.y - b.max.y, b.min.y - a.max.y));
  const dz = Math.max(0, Math.max(a.min.z - b.max.z, b.min.z - a.max.z));
  return Math.hypot(dx, dy, dz);
}

/** Kreuzen sich die beiden Mengen wirklich? */
function kreuzen(A: Dreieck[], B: Dreieck[]): boolean {
  const bb = kasten(B);
  for (const ta of A) {
    if (kastenAbstand(kasten([ta]), bb) > 0) continue;
    for (const tb of B) {
      for (let i = 0; i < 3; i++) {
        if (streckeDreieck(ta[i]!, ta[(i + 1) % 3]!, tb)) return true;
        if (streckeDreieck(tb[i]!, tb[(i + 1) % 3]!, ta)) return true;
      }
    }
  }
  return false;
}

/* -------------------------------------------------------- Die Pratzen selbst */

/** Die Punkte EINES Fußes in Fußkoordinaten (Gruppe bei y = 0). */
const fussPunkte = punkte([...dreieckeGeo(pratzeFuss()), ...dreieckeGeo(pratzeStempel())], 0.03);
/** Die Dreiecke EINES Fußes, für die Dreieck-gegen-Dreieck-Proben. */
const fussTris = [...dreieckeGeo(pratzeFuss()), ...dreieckeGeo(pratzeStempel())];

interface Lage {
  x: number;
  z: number;
}

/** Punkte aller vier Füße bei Ausfahrgrad `unten`, in Wurzelkoordinaten. */
function pratzenPunkte(lage: Lage, unten: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const dy = (1 - unten) * FUSS_HUB;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const p of fussPunkte) {
        out.push(new THREE.Vector3(sx * lage.x + p.x, p.y + dy, sz * lage.z + p.z));
      }
    }
  }
  return out;
}

function pratzenTris(lage: Lage, unten: number): Dreieck[] {
  const out: Dreieck[] = [];
  const dy = (1 - unten) * FUSS_HUB;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const t of fussTris) {
        out.push(
          t.map((p) => new THREE.Vector3(sx * lage.x + p.x, p.y + dy, sz * lage.z + p.z)) as Dreieck
        );
      }
    }
  }
  return out;
}

/** Die vier Ausleger als Dreiecke (sie bewegen sich nicht). */
function auslegerTris(lage?: Lage): Dreieck[] {
  const out: Dreieck[] = [];
  for (const g of pratzenausleger(lage)) out.push(...dreieckeGeo(g));
  return out;
}

/* ------------------------------------------------------------------ Messung */

/** Das Radprofil wird EINMAL gelesen — es tastet eine halbe Million Punkte ab. */
const PROFIL = radProfil(finde("02_RAD_VL"));
/** Ausfahrweg des Fußes (m) — `syncMeshes` in `excavator.ts`. */
const FUSS_HUB = 0.72;

/** Kleinster Radabstand über ALLE Lenkstellungen und den ganzen Ausfahrweg. */
function radFreigang(
  lage: Lage,
  auch: Dreieck[],
  lenkSchritte = 135
): { abstand: number; wo: string } {
  const st: Strecke[] = [
    ...fussStrecken(lage, fussPunkte, FUSS_HUB),
    ...festeStrecken(auch),
  ];
  return kleinsterRadfreigang(st, PROFIL, lenkSchritte);
}

/**
 * Freigang zum Räumschild, über den ganzen Schildhub und den ganzen
 * Ausfahrweg der Pratze.
 */
const schildGruppe = finde("01_RAEUMSCHILD");
function schildFreigang(
  lage: Lage,
  auch: Dreieck[],
  schritte = 11
): { abstand: number; wo: string; kreuzt: boolean } {
  let best = Infinity;
  let wo = "";
  let kreuzt = false;
  for (let i = 0; i < schritte; i++) {
    const unten = i / (schritte - 1);
    schildGruppe.position.y = (1 - unten) * 0.62;
    schildGruppe.rotation.x = (1 - unten) * 0.35;
    schildGruppe.updateMatrixWorld(true);
    const st = dreieckeVon(schildGruppe, bagger.root);
    for (let j = 0; j < schritte; j++) {
      const aus = j / (schritte - 1);
      const pt = [...pratzenTris(lage, aus), ...auch];
      const d = mengenAbstand(pt, st);
      if (d < best) {
        best = d;
        wo = `Schild ${unten.toFixed(2)}, Pratze ${aus.toFixed(2)}`;
      }
      if (d < 0.08 && kreuzen(pt, st)) kreuzt = true;
    }
  }
  return { abstand: best, wo, kreuzt };
}

/* ------------------------------------------------------------- Die Ausgabe */

console.log("PRATZENFREIGANG — gemessen an der echten Geometrie");
console.log("==================================================");
console.log("");
console.log("Radprofil (überstrichener Raum, Achslage → grösster Halbmesser):");
for (let i = 0; i < PROFIL.faecher.length; i += 4) {
  const b = PROFIL.b0 + i * FACH;
  if (b < 0) continue;
  console.log(`   |b| = ${b.toFixed(3)} m   r = ${PROFIL.faecher[i]!.toFixed(3)} m`);
}
console.log("");

const rahmenTris = dreieckeVon(finde("01_UNTERWAGEN_LACK"), bagger.root);

const LAGEN: Array<{ name: string; lage: Lage }> = [
  { name: "alt   12.09.2026", lage: { x: 1.8, z: 1.35 } },
  { name: "Patricks Ansage ", lage: { x: 1.8, z: 2.3 } },
  { name: "x 1,80 / z 2,40 ", lage: { x: 1.8, z: 2.4 } },
  { name: "x 1,80 / z 2,50 ", lage: { x: 1.8, z: 2.5 } },
  { name: "x 1,90 / z 2,40 ", lage: { x: 1.9, z: 2.4 } },
  { name: "im Bau          ", lage: { x: PRATZE_X, z: PRATZE_Z } },
];

/*
 * Die Tafel vergleicht LAGEN, nicht Bauformen: Jede Zeile setzt den heutigen
 * Ausleger (Kragarm + Stiel) auf die genannte Fußlage. Die Zeile „alt" ist
 * deshalb nicht ganz der Stand vom 12.09. — dort lief ein durchgehender
 * Querbalken quer durchs Rad, gemessen 25,2 cm tief. Was hier steht, ist der
 * FUSS an der alten Stelle: 22,2 cm im Reifen.
 */
console.log("Lage            Rad      Schild   kreuzt   am Rahmen");
for (const { name, lage } of LAGEN) {
  const tris = auslegerTris(lage);
  const r = radFreigang(lage, tris, 67);
  const s = schildFreigang(lage, tris);
  const fest = kreuzen(tris, rahmenTris);
  console.log(
    `${name} ${(r.abstand * 100).toFixed(1).padStart(7)} ${(s.abstand * 100)
      .toFixed(1)
      .padStart(8)} ${(s.kreuzt ? "JA" : "nein").padStart(7)}   ${fest ? "ja" : "NEIN"}`
  );
  console.log(`                 Rad: ${r.wo}`);
}
console.log("   (alle Werte in cm; negativ = Durchdringung)");
console.log("");

/*
 * WO genau kreuzt es das Schild? Getrennt nach Fuss und Ausleger — sonst weiss
 * man nur, dass es klemmt, aber nicht, welches Teil man anfassen muss.
 */
for (const z of [2.3, 2.4, 2.5]) {
  const lage: Lage = { x: 1.8, z };
  for (const [wer, tris] of [
    ["Fuss    ", pratzenTris(lage, 0)],
    ["Ausleger", auslegerTris(lage)],
  ] as Array<[string, Dreieck[]]>) {
    let treffer = "";
    for (let i = 0; i < 11 && !treffer; i++) {
      const unten = i / 10;
      schildGruppe.position.y = (1 - unten) * 0.62;
      schildGruppe.rotation.x = (1 - unten) * 0.35;
      schildGruppe.updateMatrixWorld(true);
      const st = dreieckeVon(schildGruppe, bagger.root);
      if (!kreuzen(tris, st)) continue;
      const k = kasten(tris.filter((t) => kreuzen([t], st)));
      treffer = `Schildstellung ${unten.toFixed(2)}, Stelle x ${k.min.x.toFixed(2)}…${k.max.x.toFixed(
        2
      )} y ${k.min.y.toFixed(2)}…${k.max.y.toFixed(2)} z ${k.min.z.toFixed(2)}…${k.max.z.toFixed(2)}`;
    }
    console.log(`   z ${z.toFixed(2)}  ${wer} gegen Schild: ${treffer || "frei"}`);
  }
}
console.log("");

/* --- Nachbarn: Oberwagen, Boden, Rahmen ----------------------------------- */

const lageJetzt: Lage = { x: PRATZE_X, z: PRATZE_Z };
const auslegerJetzt = auslegerTris();
const schildJetzt = schildFreigang(lageJetzt, auslegerJetzt);
console.log("Räumschild (11 Schildstellungen × 11 Ausfahrgrade):");
console.log(`   kleinster Abstand ${(schildJetzt.abstand * 100).toFixed(1)} cm   (${schildJetzt.wo})`);
console.log(`   Kanten kreuzen sich: ${schildJetzt.kreuzt ? "JA" : "nein"}`);
console.log("");

/*
 * Oberwagen: Er DREHT sich, also zählt auch hier der überstrichene Raum. Für
 * jeden Netzpunkt wird (Abstand von der Drehachse | Höhe) genommen; eine
 * Pratze ist frei, solange ihr höchster Punkt unter dem tiefsten Punkt des
 * Oberwagens liegt, der ihren Abstandsbereich überstreicht.
 */
const R_FACH = 0.02;

/**
 * Untere Kante des drehenden Aufbaus je Abstand von der Drehachse.
 *
 * Der Arm (07_*) bleibt draussen: Er GEHÖRT unter die Deckhöhe — er gräbt ja.
 * Verglichen wird nur, was beim Schwenken über die Pratzen hinwegstreicht:
 * Deckplatte, Drehkranz, Motorhaube, Gegengewicht, Auspuff, Kabine, Mast.
 */
function drehProfil(): number[] {
  const o = finde("05_OBERWAGEN");
  const faecher: number[] = [];
  const merke = (p: THREE.Vector3): void => {
    const i = Math.floor(Math.hypot(p.x, p.z) / R_FACH);
    faecher[i] = Math.min(faecher[i] ?? Infinity, p.y);
  };
  o.traverse((k) => {
    const m = k as THREE.Mesh;
    if (!m.isMesh) return;
    for (let q: THREE.Object3D | null = m; q; q = q.parent) {
      if (q.name.startsWith("07_")) return;
    }
    for (const t of dreieckeVon(m, bagger.root)) for (const p of punkte([t], 0.05)) merke(p);
  });
  // Fächer ohne Treffer auf die Nachbarn ziehen — die Fläche läuft ja durch
  for (let i = 1; i < faecher.length; i++) {
    if (faecher[i] === undefined) faecher[i] = faecher[i - 1] ?? Infinity;
  }
  return faecher;
}
const DREH = drehProfil();

let obenLuft = Infinity;
let obenWo = "";
for (const p of [...pratzenPunkte(lageJetzt, 0), ...punkte(auslegerJetzt)]) {
  const r = Math.hypot(p.x, p.z);
  const i = Math.floor(r / R_FACH);
  const unten = DREH[i];
  if (unten === undefined || !isFinite(unten)) continue;
  if (unten - p.y < obenLuft) {
    obenLuft = unten - p.y;
    obenWo = `bei r ${r.toFixed(2)} m: Pratze y ${p.y.toFixed(3)}, Aufbau y ${unten.toFixed(3)}`;
  }
}
console.log("Oberwagen (Deck, Gegengewicht, Auspuff) — überstrichener Raum:");
console.log(`   engste Stelle: ${obenWo}`);
console.log(`   Luft: ${(obenLuft * 100).toFixed(1)} cm`);
console.log("");

/* --- Steht der Teller auf dem Boden? -------------------------------------- */

const JACK = Excavator.JACK_UP_M;
/*
 * Gemessen wird die BODENPLATTE, nicht der Stempel: Der blanke Stempel steckt
 * im Kasten und reicht rechnerisch 3,5 cm unter die Platte, ist dort aber
 * verdeckt. Auf dem Boden steht die Platte.
 */
let tellerUnten = Infinity;
for (const t of dreieckeGeo(pratzeFuss())) for (const p of t) tellerUnten = Math.min(tellerUnten, p.y);
console.log("Abstützen:");
console.log(`   Maschine hebt sich um ${(JACK * 100).toFixed(0)} cm (JACK_UP_M)`);
console.log(`   Teller ausgefahren im Bagger-Frame: y ${tellerUnten.toFixed(3)} m`);
console.log(`   → über dem Boden: ${((tellerUnten + JACK) * 100).toFixed(1)} cm`);
console.log(`   Stützbasis (Fußmitten): ${(2 * lageJetzt.x).toFixed(2)} m breit × ${(
  2 * lageJetzt.z
).toFixed(2)} m lang`);
console.log("");

/* --- Sitzt der Ausleger am Rahmen? ---------------------------------------- */

console.log("Anbindung:");
console.log(
  `   Ausleger steckt im Rahmenblech: ${
    kreuzen(auslegerJetzt, rahmenTris) ? "JA" : "NEIN — er haengt in der Luft"
  }`
);
console.log("");

/* --- Abtastung möglicher Anlenkpunkte -------------------------------------- */

/**
 * Der Kotflügelbogen aus dem Lacknetz — Bogen um die Radmitte, r 0,70.
 *
 * Die zweite Bedingung ist nötig, und sie hat mich eine Fehlmeldung gekostet:
 * Auch das WANGENBLECH läuft bei y 1,32 durch den Halbmesser 0,70 um die
 * Radmitte. Ohne sie zählte jeder Ausleger als „kreuzt den Kotflügel" — dabei
 * steckte er nur dort, wo er stecken soll, nämlich in der Wange. Das
 * Wangenblech liegt bei |x| 1,14 … 1,20, der Kotflügel bei |x| 0,96 … 1,54,
 * und seine Dreiecke haben ihre Ecken an den Bandkanten, nicht dazwischen.
 */
const kotfluegelTris = rahmenTris.filter(
  (t) =>
    t.every((p) => Math.abs(Math.hypot(p.y - 0.62, Math.abs(p.z) - 1.5) - 0.7) < 0.1) &&
    t.every((p) => Math.abs(p.x) < 1.12 || Math.abs(p.x) > 1.22)
);
/** Das Wangenblech — senkrechtes Blech bei x ±1,17 oberhalb der Radoberkante. */
const wangeTris = rahmenTris.filter((t) =>
  t.every((p) => Math.abs(p.x) > 1.12 && Math.abs(p.x) < 1.22 && p.y > 1.2)
);

{
  /** Wo genau kreuzen sich zwei Mengen? Die Schnittpunkte selbst. */
  const punkteDerKreuzung: THREE.Vector3[] = [];
  for (const ta of auslegerJetzt) {
    for (const tb of kotfluegelTris) {
      for (let i = 0; i < 3; i++) {
        for (const [p, q, t] of [
          [ta[i]!, ta[(i + 1) % 3]!, tb],
          [tb[i]!, tb[(i + 1) % 3]!, ta],
        ] as Array<[THREE.Vector3, THREE.Vector3, Dreieck]>) {
          if (!streckeDreieck(p, q, t)) continue;
          // Näherung: die Mitte der Kante genügt zum Zeigen, wo es klemmt
          punkteDerKreuzung.push(p.clone().add(q).multiplyScalar(0.5));
        }
      }
    }
  }
  if (punkteDerKreuzung.length > 0) {
    const k = new THREE.Box3();
    for (const p of punkteDerKreuzung) if (p.x > 0 && p.z > 0) k.expandByPoint(p);
    console.log(
      `Kotflügel: ${punkteDerKreuzung.length} Kreuzungen, vorn links um x ${k.min.x.toFixed(
        2
      )}…${k.max.x.toFixed(2)} y ${k.min.y.toFixed(2)}…${k.max.y.toFixed(2)} z ${k.min.z.toFixed(
        2
      )}…${k.max.z.toFixed(2)}`
    );
  }
  const treffer = auslegerJetzt.filter((t) => kreuzen([t], kotfluegelTris));
  if (treffer.length === 0) {
    console.log(
      `Kotflügel: frei, kleinster Abstand ${(
        mengenAbstand(auslegerJetzt, kotfluegelTris) * 100
      ).toFixed(1)} cm`
    );
  } else {
    const k = kasten(treffer);
    const g = kasten(kotfluegelTris.filter((t) => kreuzen([t], auslegerJetzt)));
    console.log(
      `Kotflügel: KREUZT bei x ${k.min.x.toFixed(2)}…${k.max.x.toFixed(2)} y ${k.min.y.toFixed(
        2
      )}…${k.max.y.toFixed(2)} z ${k.min.z.toFixed(2)}…${k.max.z.toFixed(2)}`
    );
    console.log(
      `   getroffenes Bogenstück: x ${g.min.x.toFixed(2)}…${g.max.x.toFixed(2)} y ${g.min.y.toFixed(
        2
      )}…${g.max.y.toFixed(2)} z ${g.min.z.toFixed(2)}…${g.max.z.toFixed(2)}`
    );
  }
  console.log("");
}

if (process.argv.includes("--anker")) {
  console.log("Abtastung der Anlenkpunkte (Fuß bleibt bei x 1,90 / z 2,45):");
  console.log("   Anker y / z   Rad    Schild  Kotfl.  Aufbau  in der Wange");
  for (const ay of [1.28, 1.33, 1.38, 1.43]) {
    for (const az of [1.85, 1.95, 2.05, 2.1]) {
      const anker = { x: 1.16, y: ay, z: az };
      const tris: Dreieck[] = [];
      for (const g of pratzenausleger(lageJetzt, anker)) tris.push(...dreieckeGeo(g));
      const rad = radFreigang(lageJetzt, tris, 45);
      const sch = schildFreigang(lageJetzt, tris, 6);
      let luft = Infinity;
      for (const p of punkte(tris)) {
        const i = Math.floor(Math.hypot(p.x, p.z) / R_FACH);
        const u = DREH[i];
        if (u !== undefined && isFinite(u)) luft = Math.min(luft, u - p.y);
      }
      console.log(
        `   ${ay.toFixed(2)} / ${az.toFixed(2)} ${(rad.abstand * 100)
          .toFixed(1)
          .padStart(7)} ${(sch.abstand * 100).toFixed(1).padStart(7)} ${(
          kreuzen(tris, kotfluegelTris) ? "KREUZT" : "frei"
        ).padStart(7)} ${(luft * 100).toFixed(1).padStart(7)}   ${
          kreuzen(tris, wangeTris) ? "ja" : "NEIN"
        }`
      );
    }
  }
  console.log("");
}

/* --- Abtastung möglicher Lagen -------------------------------------------- */

if (process.argv.includes("--suche")) {
  const zs = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5];
  console.log("Abtastung: Freigang des FUSSES zum Rad, ohne Ausleger (cm)");
  console.log("   x / z " + zs.map((z) => z.toFixed(2).padStart(8)).join(""));
  for (const x of [1.7, 1.8, 1.9, 2.0]) {
    const zeile: string[] = [];
    for (const z of zs) {
      const r = radFreigang({ x, z }, [], 45);
      zeile.push(`${(r.abstand * 100).toFixed(1).padStart(8)}`);
    }
    console.log(`   ${x.toFixed(2)} ${zeile.join("")}`);
  }
  console.log("");
  console.log("Dasselbe MIT dem heutigen Ausleger (quer, Innenende bei x 0,62):");
  for (const x of [1.8]) {
    const zeile: string[] = [];
    for (const z of zs) {
      const r = radFreigang({ x, z }, auslegerTris({ x, z }), 45);
      zeile.push(`${(r.abstand * 100).toFixed(1).padStart(8)}`);
    }
    console.log(`   ${x.toFixed(2)} ${zeile.join("")}`);
  }
}
