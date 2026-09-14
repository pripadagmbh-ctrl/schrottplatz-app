/**
 * Die fünf Strecken der Herstellerzeichnung, an unserem Modell gemessen.
 *
 * Die Vorlage vom 14.09.2026 zeigt zwei Ansichten eines Fünfschalengreifers und
 * bemaßt sie mit fünf Buchstaben. Patrick hat keine Maßtabelle dazu, nur das
 * Bild — vergleichbar sind deshalb nicht die Millimeter, sondern die
 * VERHÄLTNISSE. Genau die rechnet dieses Werkzeug aus.
 *
 *   A  Breite geschlossen       größter Durchmesser über alle Netzpunkte, zu
 *   D  Höhe geschlossen         Bauhöhe über alle Netzpunkte, zu
 *   B  Spitzenweite offen       2 × größter Radius eines ZAHNpunktes, offen
 *   E  größte Breite offen      größter Durchmesser über alle Netzpunkte, offen
 *   C  Höhe offen               Bauhöhe über alle Netzpunkte, offen
 *
 * Dazu die drei Zahlen, an denen die Formarbeit vom 14.09.2026 hängt:
 *
 *   Zahnachse        Winkel der Zahnachse gegen die Senkrechte, je Öffnung.
 *                    Auf der Zeichnung steht der Zahn offen LOTRECHT.
 *   Zahn unter Mitte Wie weit die Zahnunterkante offen unter der Unterkante der
 *                    zentralen unteren Einheit (Stempel) hängt, in % von C.
 *                    Von der Zeichnung abgelesen rund 18 %.
 *   Hüllkreis        Größter Durchmesser über den GANZEN Öffnungsweg — das ist
 *                    das Platzmaß (E-009), nicht E. Grenze 3,38 m.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/abcde.ts
 */
import * as THREE from "three";
import {
  MASS,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  mittellinie,
  schwenkFuer,
  stoffe,
} from "../../src/fuenfschalen/teile";
import { baueGreifer, hebelarm, zylinderNeigung } from "../../src/fuenfschalen/rig";

/* ------------------------------------------------------------- Hilfsmittel */

interface Lage {
  rMax: number;
  yMin: number;
  yMax: number;
}

function huelle(o: THREE.Object3D): Lage {
  let rMax = 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  const v = new THREE.Vector3();
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      rMax = Math.max(rMax, Math.hypot(v.x, v.z));
      yMin = Math.min(yMin, v.y);
      yMax = Math.max(yMax, v.y);
    }
  });
  return { rMax, yMin, yMax };
}

/** Alle fünf Zähne eines Greifers als ein Objekt-Bündel. */
function zaehne(g: ReturnType<typeof baueGreifer>): THREE.Object3D[] {
  return g.schalen.map(
    (s, i) => s.gelenk.getObjectByName(`SHELL_TIP_${String(i + 1).padStart(2, "0")}`)!
  );
}

function zahnHuelle(g: ReturnType<typeof baueGreifer>): Lage {
  const teile = zaehne(g);
  let rMax = 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const t of teile) {
    const h = huelle(t);
    rMax = Math.max(rMax, h.rMax);
    yMin = Math.min(yMin, h.yMin);
    yMax = Math.max(yMax, h.yMax);
  }
  return { rMax, yMin, yMax };
}

/**
 * Winkel der ZAHNACHSE gegen die Senkrechte (Grad, + = Spitze nach außen).
 *
 * Die Achse ist die Verbindung der beiden Stirnflächen-Schwerpunkte des
 * Zahnkörpers — nicht seine Tangente am Fuß und nicht die der Schale. Der Zahn
 * ist selbst gebogen; wer nur die Tangente am Schalenende misst, misst die
 * Biegung des Zahns nicht mit. Genau daran ist der bisherige Anschlag `OFFEN`
 * vorbeigegangen: Er stellt die TANGENTE der Schale senkrecht, der Zahn steht
 * danach noch um seine eigene Biegung schräg.
 */
function zahnachse(g: ReturnType<typeof baueGreifer>): number {
  const zahn = zaehne(g)[0]!.getObjectByName("07_ZAHN") as THREE.Mesh;
  zahn.updateWorldMatrix(true, false);
  const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
  /* Die Ringe stehen in Bauordnung hintereinander, fünf Punkte je Ring. */
  const RING = 5;
  const mitte = (von: number): THREE.Vector3 => {
    const s = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i < RING; i++) s.add(v.fromBufferAttribute(pos, von + i));
    return s.multiplyScalar(1 / RING).applyMatrix4(zahn.matrixWorld);
  };
  const fuss = mitte(0);
  const spitze = mitte(pos.count - RING);
  const d = spitze.clone().sub(fuss);
  /* Radiale Richtung am Fuß — dorthin zeigt „außen". */
  const aussen = new THREE.Vector2(fuss.x, fuss.z).normalize();
  const dr = d.x * aussen.x + d.z * aussen.y;
  return (Math.atan2(dr, -d.y) * 180) / Math.PI;
}

/** Radius der geschlossenen Mittellinie auf Höhe y (m) — 0 unterhalb der Spitze. */
function korbRadius(y: number): number {
  const bahn = mittellinie(ZU);
  let r = 0;
  for (let k = 0; k + 1 < bahn.length; k++) {
    const p = bahn[k]!;
    const q = bahn[k + 1]!;
    if ((y <= p.y && y >= q.y) || (y >= p.y && y <= q.y)) {
      const t = Math.abs(q.y - p.y) < 1e-9 ? 0 : (y - p.y) / (q.y - p.y);
      r = Math.max(r, p.r + (q.r - p.r) * t);
    }
  }
  return r;
}

/** Bruttokorb: Rotationskörper der geschlossenen Mittellinie unter der Bolzenebene. */
function bruttokorb(): number {
  const bahn = mittellinie(ZU);
  const N = 4000;
  const yO = STEMPEL_AUGE.y;
  const yU = Math.min(...bahn.map((p) => p.y));
  let v = 0;
  for (let i = 0; i < N; i++) {
    v += Math.PI * korbRadius(yU + ((yO - yU) * (i + 0.5)) / N) ** 2 * ((yO - yU) / N);
  }
  return v;
}

/**
 * Wie viel Schalenwerkstoff steht IM Korb (m³)?
 *
 * Nicht dasselbe wie „Schalenwerkstoff unter der Bolzenebene": Haut und Guss
 * liegen der Bahn AUSSEN auf (`baueGreiferschale` trägt beide längs der
 * Aussennormalen ab), sie stehen also gar nicht im Korb. Nur der Schalenkopf
 * greift über die Bahn nach innen. Gezählt wird deshalb im Raster und nur
 * innerhalb des Rotationskörpers.
 *
 * Verfahren: je Höhenscheibe und je z ein Strahl längs +x durch das Netz der
 * fünf Schalen, Schnittpunkte sortiert, Parität gibt die Materialstrecken. Das
 * ist dasselbe Verfahren wie im Messprotokoll vom 14.09.2026 (dort 5 mm, hier
 * 10 mm — die Zahl kommt auf ±1 l heran und läuft in Sekunden statt Minuten).
 */
function koepfeImKorb(g: ReturnType<typeof baueGreifer>): number {
  const RASTER = Number(process.env.KORB_RASTER ?? 0.01); // SW 14.09.2026, siehe oben
  const dreieck: number[][] = [];
  for (const s of g.schalen) {
    s.gelenk.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      const idx = m.geometry.getIndex();
      const anzahl = idx ? idx.count : pos.count;
      const v = new THREE.Vector3();
      for (let i = 0; i < anzahl; i += 3) {
        const e: number[] = [];
        for (let j = 0; j < 3; j++) {
          v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
          e.push(v.x, v.y, v.z);
        }
        dreieck.push(e);
      }
    });
  }
  const bahn = mittellinie(ZU);
  const yO = STEMPEL_AUGE.y;
  const yU = Math.min(...bahn.map((p) => p.y));
  let v = 0;
  for (let y = yU + RASTER / 2; y < yO; y += RASTER) {
    const R = korbRadius(y);
    for (let z = -R; z <= R; z += RASTER) {
      const halb = Math.sqrt(Math.max(0, R * R - z * z));
      if (halb < RASTER) continue;
      /*
       * Schnittpunkte des Strahls (·, y, z) längs x — mit TIEFENZÄHLER, nicht
       * mit Parität. Haut, Guss und Hülse durchdringen einander (ein Gussstück
       * ist aus überlappenden Körpern gebaut); Parität würde dort den
       * gemeinsamen Kern zweimal zählen und wieder abziehen. Der Zähler steigt
       * beim Eintritt und fällt beim Austritt; Werkstoff ist, wo er über null
       * steht.
       */
      const treffer: Array<[number, number]> = [];
      for (const t of dreieck) {
        const ay = t[1]!;
        const az = t[2]!;
        const by = t[4]!;
        const bz = t[5]!;
        const cy = t[7]!;
        const cz = t[8]!;
        const d = (bz - cz) * (ay - cy) + (cy - by) * (az - cz);
        if (Math.abs(d) < 1e-14) continue;
        const w1 = ((bz - cz) * (y - cy) + (cy - by) * (z - cz)) / d;
        const w2 = ((cz - az) * (y - cy) + (ay - cy) * (z - cz)) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
        if (nx === 0) continue;
        treffer.push([w1 * t[0]! + w2 * t[3]! + w3 * t[6]!, nx < 0 ? 1 : -1]);
      }
      if (treffer.length < 2) continue;
      treffer.sort((p, q) => p[0]! - q[0]!);
      let tiefe = 0;
      for (let i = 0; i + 1 < treffer.length; i++) {
        tiefe += treffer[i]![1]!;
        if (tiefe <= 0) continue;
        const a = Math.max(treffer[i]![0]!, -halb);
        const b = Math.min(treffer[i + 1]![0]!, halb);
        if (b > a) v += (b - a) * RASTER * RASTER;
      }
    }
  }
  return v;
}

/* ------------------------------------------------------------- Die Messung */

const g = baueGreifer(stoffe());

function bei(t: number): { alle: Lage; zahn: Lage } {
  g.setOeffnung(t);
  g.wurzel.updateMatrixWorld(true);
  return { alle: huelle(g.wurzel), zahn: zahnHuelle(g) };
}

const zu = bei(0);
const auf = bei(1);
g.setOeffnung(0);
g.wurzel.updateMatrixWorld(true);
const stempelY = huelle(g.stempel).yMin;

const A = 2 * zu.alle.rMax;
const D = zu.alle.yMax - zu.alle.yMin;
const B = 2 * auf.zahn.rMax;
const E = 2 * auf.alle.rMax;
const C = auf.alle.yMax - auf.alle.yMin;

let huellkreis = 0;
let huellkreisBei = 0;
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  const h = bei(t).alle;
  if (2 * h.rMax > huellkreis) {
    huellkreis = 2 * h.rMax;
    huellkreisBei = t;
  }
}

const zeile = (n: string, w: string, s = ""): string =>
  `  ${n.padEnd(30)} ${w.padStart(10)}  ${s}`;

console.log("ABCDE — die fünf Strecken der Zeichnung, an unserem Modell");
console.log("");
console.log(zeile("A  Breite geschlossen", `${A.toFixed(3)} m`));
console.log(zeile("D  Höhe geschlossen", `${D.toFixed(3)} m`));
console.log(zeile("B  Spitzenweite offen", `${B.toFixed(3)} m`));
console.log(zeile("E  größte Breite offen", `${E.toFixed(3)} m`));
console.log(zeile("C  Höhe offen", `${C.toFixed(3)} m`));
console.log("");
console.log("Verhältnisse (das, was mit der Zeichnung vergleichbar ist)");
console.log(zeile("C/D  Höhe offen zu geschlossen", (C / D).toFixed(3), "Zeichnung rund 0,83"));
console.log(zeile("E/A  Breite offen zu geschl.", (E / A).toFixed(3), "Zeichnung rund 1,30"));
console.log(zeile("B/E  Spitzen zu Rücken, offen", (B / E).toFixed(3)));
console.log("");
console.log("Zahn");
for (const t of [0, 0.5, 1]) {
  g.setOeffnung(t);
  g.wurzel.updateMatrixWorld(true);
  console.log(
    zeile(
      `  Achse gegen Senkrechte, ${(t * 100).toFixed(0).padStart(3)} %`,
      `${zahnachse(g).toFixed(2)}°`,
      t === 1 ? "Zeichnung: 0,00° (lotrecht)" : ""
    )
  );
}
const unterMitte = stempelY - auf.zahn.yMin;
console.log(zeile("  Unterkante unter Stempel", `${unterMitte.toFixed(3)} m`));
console.log(
  zeile("  dasselbe in % von C", `${((unterMitte / C) * 100).toFixed(1)} %`, "Zeichnung rund 18 %")
);
console.log("");
console.log("Platz und Mechanik");
console.log(
  zeile("Hüllkreis über den Weg", `${huellkreis.toFixed(3)} m`, `bei ${(huellkreisBei * 100).toFixed(0)} % · Grenze 3,38`)
);
let neigung = 0;
let arm = Infinity;
for (let i = 0; i <= 40; i++) {
  const s = schwenkFuer(i / 40);
  neigung = Math.max(neigung, (zylinderNeigung(s) * 180) / Math.PI);
  arm = Math.min(arm, hebelarm(s));
}
console.log(zeile("Zylinderneigung, größte", `${neigung.toFixed(2)}°`, "Ziel < 20"));
console.log(zeile("Hebelarm, kleinster", `${arm.toFixed(4)} m`, "Ziel > 0,10"));

g.setOeffnung(0);
g.wurzel.updateMatrixWorld(true);
const brutto = bruttokorb();
const koepfe = koepfeImKorb(g);
console.log(zeile("Bruttokorb", `${(brutto * 1000).toFixed(0)} l`));
console.log(zeile("Schalenköpfe darin", `${(koepfe * 1000).toFixed(1)} l`));
console.log(zeile("Nettokorb", `${((brutto - koepfe) * 1000).toFixed(0)} l`, "Vergleich 1.598 l"));

let sektor = 0;
const v = new THREE.Vector3();
for (let i = 0; i <= 40; i++) {
  g.setOeffnung(i / 40);
  g.wurzel.updateMatrixWorld(true);
  for (const s of g.schalen) {
    s.gelenk.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        if (Math.hypot(v.x, v.z) < 0.3) continue;
        let d = Math.atan2(v.x, v.z) - s.winkel;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        sektor = Math.max(sektor, Math.abs(d));
      }
    });
  }
}
const SEKTOR_HALB = (180 / MASS.schalen) * 1;
console.log(
  zeile(
    "Sektor genutzt",
    `${((sektor * 180) / Math.PI).toFixed(2)}°`,
    `von ${SEKTOR_HALB.toFixed(0)}° · Luft ${(SEKTOR_HALB - (sektor * 180) / Math.PI).toFixed(2)}°`
  )
);
console.log("");
console.log(`(OFFEN = ${((OFFEN * 180) / Math.PI).toFixed(2)}°)`);
