import { mkdirSync } from "node:fs";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { dreiecke } from "./riss";
import { Blatt, farbe } from "./fuenfschalen/png";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { AUSLEGER_FUSS, AUSLEGER_FUSS_AUSSEN } from "../src/excavator/armParts";
import {
  BOCK,
  BockTeil,
  DECK_OBEN,
  auslegerbockTeile,
  oberwagenStahl,
} from "../src/excavator/oberwagenParts";

/**
 * DER AUSLEGERBOCK, nachgemessen (E-050).
 *
 * Anlass: Patrick am Gerät, 15.09.2026 — „Keine Verbindung des Arms am Turm."
 * Dieses Werkzeug misst zuerst, WAS dort steht, und danach die Freigänge des
 * neuen Bauteils über den ganzen Schwenkbereich des Auslegers.
 *
 * Aufruf:  npx vite-node tools/auslegerbock.ts
 *
 * WIE GEMESSEN WIRD. Der Bock steht als Liste von Quadern, Walzen und Blechen
 * in `oberwagenParts.auslegerbockTeile` — aus derselben Liste entstehen seine
 * Dreiecke. Der Abstand zu ihnen wird deshalb EXAKT gerechnet und nicht
 * abgetastet. Nur der Arm wird abgetastet (3-cm-Raster über seine Dreiecke);
 * dort ist der Fehler höchstens die halbe Rasterweite und immer zu Ungunsten
 * des Ergebnisses.
 *
 * Die Bilder am Ende sind RISSZEICHNUNGEN aus der echten Szene (orthogonale
 * Projektion, flache Schattierung — `tools/riss.ts`), KEINE Bildschirmfotos.
 */

leinwandAttrappe();
await initPhysics();
const scene = new THREE.Scene();
const bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
/* Die Maschine steht im Spiel auf (−0,5 | −22,5); für die Messung an den
 * Ursprung, damit die Zahlen im Bericht Maschinenmaße sind. */
bagger.root.position.set(0, 0, 0);
bagger.root.quaternion.identity();
bagger.root.updateMatrixWorld(true);

const zahl = (n: number, s = 3): string => n.toFixed(s).replace(".", ",");

/** Grenzen des Arms — dieselben Zahlen wie in `excavator.ts`. */
const BOOM_MIN = THREE.MathUtils.degToRad(5);
const BOOM_MAX = THREE.MathUtils.degToRad(70);
const STICK_MIN = THREE.MathUtils.degToRad(-140);
const STICK_MAX = THREE.MathUtils.degToRad(-25);
/** Drehpunkt des Auslegers über Grund (`BOOM_PIVOT` in `excavator.ts`). */
const PIVOT_WELT = new THREE.Vector3(0, 2.95, 0.55);
/** Ursprung des Oberwagens über Grund (`cabGroup.position`). */
const OBER_Y = 1.6;
/** Fußanker der Hubzylinder im Oberwagen-Frame (`HUB_FUSS_*` in excavator.ts). */
const HUB_FUSS: Array<[number, number, number]> = [
  [-0.52, 0.02, 1.05],
  [0.52, 0.02, 1.05],
];

const ausleger = scene.getObjectByName("07_AUSLEGER")!;
const stiel = scene.getObjectByName("07_STIEL")!;
const innen = bagger as unknown as { cabLift: number; syncMeshes(): void; updateHydraulics(): void };

/** Arm in eine Stellung bringen und Zylinder nachziehen (ohne `syncMeshes`). */
function stelle(boom: number, stick: number): void {
  ausleger.rotation.x = -boom;
  stiel.rotation.x = -stick;
  bagger.root.updateMatrixWorld(true);
  innen.updateHydraulics();
}

console.log("AUSLEGERBOCK — was am Drehpunkt steht, und was dort stehen muss");
console.log("==============================================================");
console.log("");

/* ------------------------------------------------ 1. Der Befund von heute */

console.log("1 — DER BEFUND: was trägt den Ausleger heute?");
console.log("---------------------------------------------");

stelle(BOOM_MIN, STICK_MAX);
const armNetze = new Set<string>();
ausleger.traverse((o) => armNetze.add(o.uuid));
const untergrund: THREE.Mesh[] = [];
bagger.root.traverse((o) => {
  const m = o as THREE.Mesh;
  if (m.isMesh && !armNetze.has(m.uuid)) untergrund.push(m);
});

/** Für den Befund wird das Stahlnetz OHNE Bock eingesetzt — sonst misst man sich selbst. */
const deckNetz = scene.getObjectByName("04_DREHKRANZ") as THREE.Mesh;
const deckMitBock = deckNetz.geometry as THREE.BufferGeometry;
const bockAchse = { y: PIVOT_WELT.y - OBER_Y, z: PIVOT_WELT.z };
const deckOhneBock = oberwagenStahl(HUB_FUSS, bockAchse, true);
deckNetz.geometry = deckOhneBock;

console.log("Senkrechter Strahl nach unten, Arm ausgeblendet. Alle Werte über Grund.");
const rc = new THREE.Raycaster();
for (const z of [0.3, 0.55, 0.8]) {
  for (const x of [-0.3, 0, 0.3]) {
    rc.set(new THREE.Vector3(x, PIVOT_WELT.y, z), new THREE.Vector3(0, -1, 0));
    const h = rc.intersectObjects(untergrund, false)[0];
    console.log(
      `  x ${zahl(x, 2).padStart(5)} | z ${zahl(z, 2).padStart(4)}   ` +
        `${(h ? h.object.name : "— nichts —").padEnd(22)} Oberkante y ${h ? zahl(h.point.y) : "—"}`
    );
  }
}

/**
 * Tiefster Punkt des Auslegerfußes über den ganzen Schwenkbereich.
 * Nur der Fußbereich: die ersten 0,9 m des Arms.
 */
function fussUnterkante(): { y: number; boom: number; lasche: number } {
  let y = Infinity;
  let beiBoom = 0;
  let lasche = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= 65; i++) {
    const boom = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / 65;
    stelle(boom, STICK_MAX);
    for (const name of ["07_AUSLEGER_STAHL", "07_AUSLEGER_KASTEN"]) {
      const m = scene.getObjectByName(name) as THREE.Mesh;
      const pos = (m.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute;
      // Lack-Netz sitzt um die Kastenmitte (z − 2,60), Stahl-Netz um den Drehpunkt
      const versatz = name === "07_AUSLEGER_KASTEN" ? -2.6 : 0;
      for (let j = 0; j < pos.count; j++) {
        if (pos.getZ(j) > 0.9 + versatz) continue;
        v.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld);
        if (v.y < y) {
          y = v.y;
          beiBoom = boom;
        }
        if (name === "07_AUSLEGER_STAHL" && pos.getZ(j) < 0.3) lasche = Math.min(lasche, v.y);
      }
    }
  }
  return { y, boom: beiBoom, lasche };
}
const unten = fussUnterkante();
const deck = OBER_Y + DECK_OBEN;
console.log("");
console.log(`Unterkante des Auslegerfußes   y ${zahl(unten.y)}  (bei ${zahl((unten.boom * 180) / Math.PI, 1)}° Auslegerwinkel)`);
console.log(`davon die Fußlaschen           y ${zahl(unten.lasche)}`);
console.log(`Deckplatte darunter            y ${zahl(deck)}`);
console.log(`>> LUFTSPALT                   ${zahl(unten.y - deck)} m, über die ganze Breite und den ganzen Schwenkbereich`);
console.log("");

/* ---------------------------- 2. Wie breit darf der Bock sein? (gemessen) */

console.log("2 — DAS BREITENFENSTER (Oberwagen-Frame, y 0,355…1,70 über dem Deck)");
console.log("--------------------------------------------------------------------");
/*
 * Nach innen begrenzt der Auslegerfuß, nach außen die Kabine. Die Kabine
 * FÄHRT (E-040) — deshalb wird sie über 21 Hubstellungen abgetastet, nicht
 * nur in der untersten. Gemessen wird im Frame des Oberwagens, weil
 * `syncMeshes()` die Maschine an ihren Spielplatz zurücksetzt.
 */
const oberwagen = scene.getObjectByName("05_OBERWAGEN")!;
const KAB_NETZE = ["06_KABINE_LACK", "06_KABINE_STAHL", "06_SCHEIBEN", "06_KABINENLENKER", "06_KABINENMAST"];
let kabineNah = -Infinity;
let kabineTeil = "";
const v = new THREE.Vector3();
const invOber = new THREE.Matrix4();
for (let i = 0; i <= 20; i++) {
  innen.cabLift = (2.6 * i) / 20;
  innen.syncMeshes();
  oberwagen.updateWorldMatrix(true, true);
  invOber.copy(oberwagen.matrixWorld).invert();
  for (const n of KAB_NETZE) {
    const m = scene.getObjectByName(n) as THREE.Mesh | undefined;
    if (!m) continue;
    m.updateWorldMatrix(true, false);
    const nachOber = new THREE.Matrix4().multiplyMatrices(invOber, m.matrixWorld);
    const pos = (m.geometry as THREE.BufferGeometry).getAttribute("position") as THREE.BufferAttribute;
    for (let j = 0; j < pos.count; j++) {
      v.fromBufferAttribute(pos, j).applyMatrix4(nachOber);
      if (v.y < DECK_OBEN || v.y > 1.7 || v.z < -0.4 || v.z > 1.4) continue;
      if (v.x > kabineNah) {
        kabineNah = v.x;
        kabineTeil = n;
      }
    }
  }
}
innen.cabLift = 0;
innen.syncMeshes();
bagger.root.position.set(0, 0, 0);
bagger.root.quaternion.identity();
bagger.root.updateMatrixWorld(true);
oberwagen.updateWorldMatrix(true, true);
invOber.copy(oberwagen.matrixWorld).invert();

const bockTeile = auslegerbockTeile(bockAchse.y, bockAchse.z);
let bockAussen = 0;
let bockAussenTeil = "";
for (const t of bockTeile) {
  const a = t.art === "walze" ? Math.max(Math.abs(t.x[0]), Math.abs(t.x[1])) : Math.max(Math.abs(t.x[0]), Math.abs(t.x[1]));
  if (a > bockAussen) {
    bockAussen = a;
    bockAussenTeil = t.name;
  }
}
console.log(`Auslegerfuß, äußere Fläche    x ±${zahl(AUSLEGER_FUSS_AUSSEN)}   (Lasche r ${zahl(AUSLEGER_FUSS.r)})`);
console.log(`Wange innen / außen           x ±${zahl(BOCK.xInnen)} / ±${zahl(BOCK.xInnen + BOCK.dicke)}`);
console.log(`Bock, äußerster Punkt         x ±${zahl(bockAussen)}   (${bockAussenTeil})`);
console.log(`Kabine, nächster Punkt        x ${zahl(kabineNah)}   (${kabineTeil}, über 21 Hubstellungen)`);
console.log("");
console.log(`>> Luft nach innen zum Arm    ${zahl(BOCK.xInnen - AUSLEGER_FUSS_AUSSEN)} m`);
console.log(`>> Luft nach außen zur Kabine ${zahl(-kabineNah - bockAussen)} m`);
console.log("");

/* ------------------------- 3. Freigänge über den ganzen Schwenkbereich */

console.log("3 — FREIGÄNGE ÜBER DEN GANZEN SCHWENKBEREICH");
console.log("--------------------------------------------");

/** Abstand eines Punktes zu einer Strecke in der Ebene. */
function abstandStrecke(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Vorzeichenbehafteter Abstand zu einem Umriss (negativ = innen). */
function abstandUmriss(pz: number, py: number, umriss: Array<[number, number]>): number {
  let d = Infinity;
  let drin = false;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const a = umriss[j]!;
    const b = umriss[i]!;
    d = Math.min(d, abstandStrecke(pz, py, a[0], a[1], b[0], b[1]));
    if (b[1] > py !== a[1] > py && pz < ((a[0] - b[0]) * (py - b[1])) / (a[1] - b[1]) + b[0]) drin = !drin;
  }
  return drin ? -d : d;
}

/** Abstand zweier Achsintervalle: negativ, wenn der Punkt dazwischen liegt. */
function abstandSpanne(p: number, a: [number, number]): number {
  return Math.max(a[0] - p, p - a[1]);
}

/** Zwei Richtungsabstände zusammensetzen (beide negativ = innen). */
function zusammen(dQuer: number, dLaengs: number): number {
  if (dQuer <= 0 && dLaengs <= 0) return Math.max(dQuer, dLaengs);
  return Math.hypot(Math.max(dQuer, 0), Math.max(dLaengs, 0));
}

/** Exakter Abstand eines Punktes zu einem Bauteil des Bocks (negativ = darin). */
function abstandTeil(p: THREE.Vector3, t: BockTeil): number {
  const dx = abstandSpanne(p.x, t.x);
  if (t.art === "walze") return zusammen(Math.hypot(p.y - t.y, p.z - t.z) - t.r, dx);
  if (t.art === "blech") return zusammen(abstandUmriss(p.z, p.y, t.umriss), dx);
  const dy = abstandSpanne(p.y, t.y);
  const dz = abstandSpanne(p.z, t.z);
  if (dx <= 0 && dy <= 0 && dz <= 0) return Math.max(dx, dy, dz);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
}

/*
 * Der BOLZEN bleibt außen vor: Er steckt in der Bohrung des Auslegerfußes und
 * SOLL dort stecken. Alles andere muss frei bleiben.
 */
const HINDERNISSE = bockTeile.filter((t) => t.name !== "BOLZEN");

/**
 * Punktwolke eines Netzes: alle Dreiecke so fein abgetastet, dass zwischen
 * zwei Punkten höchstens `schritt` liegt. Nur Eckpunkte zu nehmen wäre
 * untauglich — der Bolzen hat 12 Mantellinien, aber eine glatte Fläche.
 */
function wolke(geo: THREE.BufferGeometry, schritt: number, behalte: (p: THREE.Vector3) => boolean): THREE.Vector3[] {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const out: THREE.Vector3[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(pos, idx ? idx.getX(i) : i);
    b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1);
    c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2);
    const k = Math.max(1, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / schritt));
    for (let u = 0; u <= k; u++) {
      for (let w = 0; u + w <= k; w++) {
        p.set(0, 0, 0)
          .addScaledVector(a, (k - u - w) / k)
          .addScaledVector(b, u / k)
          .addScaledVector(c, w / k);
        if (behalte(p)) out.push(p.clone());
      }
    }
  }
  return out;
}

/** Die beweglichen Netze, die überhaupt in die Nähe des Bocks kommen können. */
const BEWEGT = [
  "07_AUSLEGER_KASTEN",
  "07_AUSLEGER_STAHL",
  "07_AUSLEGER_LEUCHTEN",
  "07_SCHLAUCH_AUSLEGER",
  "08_LOGO_AUSLEGER",
  "07_STIEL_KASTEN",
  "07_STIEL_STAHL",
  "07_ZYLINDER_HUB_R_ROHR",
  "07_ZYLINDER_HUB_R_STANGE",
  "07_ZYLINDER_HUB_L_ROHR",
  "07_ZYLINDER_HUB_L_STANGE",
  "07_ZYLINDER_STIEL_ROHR",
  "07_ZYLINDER_STIEL_STANGE",
];

/*
 * Jedes bewegliche Netz wird EINMAL in seinem eigenen Bezugssystem abgetastet
 * und danach je Stellung nur noch verschoben. Wer in jeder der 594 Stellungen
 * neu abtastet, wartet Stunden statt Sekunden.
 *
 * VORFILTER, und warum er stimmt: Jedes dieser Netze hängt starr an etwas, das
 * sich um einen FESTEN Punkt dreht. Der Abstand seines eigenen Ursprungs zum
 * Auslegerdrehpunkt (`rUrsprung`) ändert sich deshalb nie. Nach der
 * Dreiecksungleichung kann ein Punkt im Abstand L vom Ursprung dem Drehpunkt
 * nie näher kommen als |L − rUrsprung|. Der Bock reicht 1,26 m vom Drehpunkt;
 * mit 1,9 m Sicherheitsabstand fällt alles weg, was ihn nie erreichen kann.
 */
const pivotOber = new THREE.Vector3(0, bockAchse.y, bockAchse.z);
const REICHT = 1.9;
stelle(BOOM_MIN, STICK_MAX);
const lokal = new Map<string, Float64Array>();
for (const n of BEWEGT) {
  const m = scene.getObjectByName(n) as THREE.Mesh | undefined;
  if (!m) continue;
  m.updateWorldMatrix(true, false);
  const nachOber = new THREE.Matrix4().multiplyMatrices(invOber, m.matrixWorld);
  const ursprung = new THREE.Vector3().setFromMatrixPosition(nachOber);
  const rUrsprung = ursprung.distanceTo(pivotOber);
  const pk = wolke(m.geometry as THREE.BufferGeometry, 0.03, (p) => Math.abs(p.length() - rUrsprung) < REICHT);
  const flach = new Float64Array(pk.length * 3);
  pk.forEach((p, i) => {
    flach[i * 3] = p.x;
    flach[i * 3 + 1] = p.y;
    flach[i * 3 + 2] = p.z;
  });
  lokal.set(n, flach);
}
let punkte = 0;
for (const pk of lokal.values()) punkte += pk.length / 3;
console.log(`Arm abgetastet: ${punkte} Punkte im 3-cm-Raster; Bock exakt (${HINDERNISSE.length} Bauteile, ohne Bolzen).`);

/*
 * Was am AUSLEGER hängt, bewegt sich beim Stielwinkel nicht — für diese Netze
 * genügt der Auslegerwinkel. Nur Stiel und Stielzylinder brauchen beide.
 */
const NUR_AUSLEGER = new Set(
  BEWEGT.filter((n) => !n.startsWith("07_STIEL") && !n.startsWith("07_ZYLINDER_STIEL"))
);

/**
 * DIE BOHRUNG bleibt außen vor. Was näher als der Bolzenhalbmesser an der
 * Lagerachse liegt, steckt im Lager — dort sitzt der Bolzen, und dort ist
 * Berührung kein Fehler, sondern der Zweck. Betroffen ist genau ein Teil: der
 * Fußbolzen des Auslegers (r 0,099), der 4 cm über seine Laschen hinaussteht
 * und im Bolzen des Bocks (r 0,100) verschwindet.
 */
function inDerBohrung(p: THREE.Vector3): boolean {
  return Math.hypot(p.y - bockAchse.y, p.z - bockAchse.z) <= BOCK.bolzenR;
}

const naechster = new Map<string, { d: number; boom: number; teil: string; wo: THREE.Vector3 }>();
const SCHRITTE_BOOM = 65; // 1° je Schritt
const SCHRITTE_STIEL = 8;
let stellungen = 0;
const mat = new THREE.Matrix4();
const q = new THREE.Vector3();
for (let i = 0; i <= SCHRITTE_BOOM; i++) {
  const boom = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / SCHRITTE_BOOM;
  for (let j = 0; j <= SCHRITTE_STIEL; j++) {
    stelle(boom, STICK_MIN + ((STICK_MAX - STICK_MIN) * j) / SCHRITTE_STIEL);
    stellungen++;
    for (const [n, pk] of lokal) {
      if (j > 0 && NUR_AUSLEGER.has(n)) continue;
      const m = scene.getObjectByName(n) as THREE.Mesh;
      m.updateWorldMatrix(true, false);
      mat.multiplyMatrices(invOber, m.matrixWorld);
      let beste = Infinity;
      let bestesTeil = "";
      const wo = new THREE.Vector3();
      for (let k = 0; k < pk.length; k += 3) {
        q.set(pk[k]!, pk[k + 1]!, pk[k + 2]!).applyMatrix4(mat);
        if (q.distanceTo(pivotOber) > 1.6 || inDerBohrung(q)) continue;
        for (const t of HINDERNISSE) {
          const d = abstandTeil(q, t);
          if (d < beste) {
            beste = d;
            bestesTeil = t.name;
            wo.copy(q);
          }
        }
      }
      const alt = naechster.get(n);
      if (beste < Infinity && (!alt || beste < alt.d)) {
        naechster.set(n, { d: beste, boom, teil: bestesTeil, wo: wo.clone() });
      }
    }
  }
}
stelle(BOOM_MIN, STICK_MAX);

console.log(`${stellungen} Stellungen abgetastet (${SCHRITTE_BOOM + 1} Auslegerwinkel × ${SCHRITTE_STIEL + 1} Stielwinkel).`);
console.log("");
console.log("   Abstand   bei      bewegtes Teil              nächstes Teil des Bocks   engste Stelle (x|y|z)");
const sortiert = [...naechster.entries()].sort((a, b) => a[1].d - b[1].d);
for (const [n, e] of sortiert) {
  console.log(
    `  ${zahl(e.d).padStart(7)} m   ${zahl((e.boom * 180) / Math.PI, 1).padStart(5)}°   ${n.padEnd(26)} ` +
      `${e.teil.padEnd(24)} ${zahl(e.wo.x, 2)} | ${zahl(e.wo.y, 2)} | ${zahl(e.wo.z, 2)}`
  );
}
const engste = sortiert[0];
console.log("");
console.log(
  engste && engste[1].d > 0
    ? `Kleinster Freigang ${zahl(engste[1].d)} m (${engste[0]} an ${engste[1].teil}). KEINE BERÜHRUNG.`
    : "ES GIBT EINE BERÜHRUNG — der Bock steht im Weg."
);
console.log("");

/* ------------------------------------------------------- 4. Netze zählen */

console.log("4 — NETZE UND DREIECKE");
console.log("----------------------");
let netze = 0;
scene.traverse((o) => {
  if (!(o instanceof THREE.Mesh)) return;
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === bagger.grappleGroup) return;
  netze++;
});
function dreieckZahl(g: THREE.BufferGeometry): number {
  const idx = g.getIndex();
  const pos = g.getAttribute("position");
  return Math.floor((idx ? idx.count : pos!.count) / 3);
}
console.log(`Netze am Bagger (ohne Spinne): ${netze}    (Ziel aus E-025: 57)`);
console.log(
  `Stahl-Netz des Oberwagens: ${dreieckZahl(deckOhneBock)} → ${dreieckZahl(deckMitBock)} Dreiecke ` +
    `(+${dreieckZahl(deckMitBock) - dreieckZahl(deckOhneBock)} für ${bockTeile.length} Bauteile, 0 Netze)`
);
console.log("");

/* ------------------------------------------------------------ 5. Die Bilder */

mkdirSync("docs/messungen/2026-09-15-bagger", { recursive: true });

function farbtreu(o: THREE.Mesh, ziel: THREE.Group): void {
  o.updateWorldMatrix(true, false);
  const k = new THREE.Mesh(o.geometry as THREE.BufferGeometry, o.material);
  k.applyMatrix4(o.matrixWorld);
  ziel.add(k);
}

function maschine(ohneKabine = false): THREE.Object3D {
  const g = new THREE.Group();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (ohneKabine && (o.name.startsWith("06_") || o.name === "05_LEUCHTEN")) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === bagger.grappleGroup) return;
    farbtreu(o, g);
  });
  return g;
}

function bildfeld(b: Blatt, obj: THREE.Object3D, blick: THREE.Vector3, x: number, y: number, w: number, h: number): void {
  b.rechteck(x, y, w, h, [0xff, 0xff, 0xff]);
  b.frei(x, y, w, h);
  const tr = dreiecke(obj, blick);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const t of tr)
    for (const r of t.p) {
      x0 = Math.min(x0, r[0]);
      x1 = Math.max(x1, r[0]);
      y0 = Math.min(y0, r[1]);
      y1 = Math.max(y1, r[1]);
    }
  const rand = 18;
  const s = Math.min((w - 2 * rand) / Math.max(x1 - x0, 1e-6), (h - 2 * rand) / Math.max(y1 - y0, 1e-6));
  const cx = x + w / 2 - ((x0 + x1) / 2) * s;
  const cy = y + h / 2 + ((y0 + y1) / 2) * s;
  for (const t of tr) {
    const r = t.p.map((e) => [cx + e[0] * s, cy - e[1] * s] as [number, number]);
    const e = t.ecken;
    b.dreieck(r, farbe(t.farbe), e ? [e[1], e[2], e[0]] : undefined);
  }
}

/**
 * Die Teile, die am Drehpunkt zusammenkommen. Alles andere — Fahrwerk,
 * Pratzen, Räumschild, Kabine, Gegengewicht — bliebe im Bild nur Beiwerk und
 * ließe den Bock auf zwanzig Pixeln schrumpfen.
 */
const IM_BILD = [
  "04_DREHKRANZ",
  "05_MOTORHAUBE",
  "07_AUSLEGER_KASTEN",
  "07_AUSLEGER_STAHL",
  "07_AUSLEGER_LEUCHTEN",
  "07_SCHLAUCH_AUSLEGER",
  "07_ZYLINDER_HUB_R_ROHR",
  "07_ZYLINDER_HUB_R_STANGE",
  "07_ZYLINDER_HUB_L_ROHR",
  "07_ZYLINDER_HUB_L_STANGE",
];

/**
 * AUSSCHNITT um den Drehpunkt: alles, was weiter als `r` davon entfernt ist,
 * bleibt draußen — Dreieck für Dreieck, damit auch die langen Teile (Deck,
 * Ausleger) nur mit ihrem vorderen Stück im Bild stehen.
 */
function ausschnitt(r: number): THREE.Object3D {
  const g = new THREE.Group();
  const p = new THREE.Vector3();
  const quelle = new THREE.Group();
  for (const n of IM_BILD) {
    const m = scene.getObjectByName(n) as THREE.Mesh | undefined;
    if (m) farbtreu(m, quelle);
  }
  /*
   * OHNE DIESE ZEILE ist `o.matrixWorld` unten die Einheitsmatrix, und der
   * Ausschnitt schneidet nach den LOKALEN Koordinaten der Netze statt nach den
   * Weltkoordinaten. Im ersten Bild fehlte dadurch der ganze Ausleger.
   */
  quelle.updateMatrixWorld(true);
  quelle.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = o.geometry as THREE.BufferGeometry;
    const idx = geo.getIndex();
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const n = idx ? idx.count : pos.count;
    const liste: number[] = [];
    for (let i = 0; i < n; i += 3) {
      const ecken = [0, 1, 2].map((k) => (idx ? idx.getX(i + k) : i + k));
      let drin = false;
      for (const e of ecken) {
        p.fromBufferAttribute(pos, e).applyMatrix4(o.matrixWorld);
        if (p.distanceTo(PIVOT_WELT) < r) drin = true;
      }
      if (drin) liste.push(...ecken);
    }
    if (liste.length === 0) return;
    const teil = new THREE.BufferGeometry();
    teil.setAttribute("position", pos);
    const nor = geo.getAttribute("normal");
    if (nor) teil.setAttribute("normal", nor);
    teil.setIndex(liste);
    const k = new THREE.Mesh(teil, o.material);
    k.applyMatrix4(o.matrixWorld);
    g.add(k);
  });
  return g;
}

const BREITE = 1650;
const HOEHE = 1100;
const DB = Math.floor((BREITE - 40) / 3);
const ZH = Math.floor((HOEHE - 30) / 2);
/** Blick von RECHTS (−X): +z läuft im Bild nach rechts. */
const SEITE = new THREE.Vector3(-1, 0.04, 0);
const SCHRAEG = new THREE.Vector3(-0.8, 0.3, 0.55);
/** Blick von VORN (+Z) — nur so sieht man die beiden Wangen und den Bolzen. */
const VORN = new THREE.Vector3(0.03, 0.12, 1);

const b = new Blatt(BREITE, HOEHE);
stelle(THREE.MathUtils.degToRad(30), STICK_MAX);
// Obere Reihe: VORHER (ohne Bock). Untere Reihe: NACHHER.
[deckOhneBock, deckMitBock].forEach((geo, reihe) => {
  deckNetz.geometry = geo;
  const y = 10 + reihe * (ZH + 10);
  [SEITE, SCHRAEG, VORN].forEach((blick, spalte) => {
    bildfeld(b, ausschnitt(2.2), blick, 10 + spalte * (DB + 10), y, DB, ZH);
  });
});
b.schreibe("docs/messungen/2026-09-15-bagger/09-auslegerbock.png");

// Zweites Blatt: die ganze Maschine, drei Auslegerstellungen, mit Bock
const b2 = new Blatt(BREITE, Math.floor(HOEHE / 2));
const H2 = Math.floor(HOEHE / 2) - 20;
[BOOM_MIN, THREE.MathUtils.degToRad(37), BOOM_MAX].forEach((w, i) => {
  stelle(w, STICK_MIN);
  bildfeld(b2, maschine(), SEITE, 10 + i * (DB + 10), 10, DB, H2);
});
b2.schreibe("docs/messungen/2026-09-15-bagger/09-auslegerbock-stellungen.png");

console.log(`Auslegerfuß sitzt IM Bock: Lasche r ${zahl(AUSLEGER_FUSS.r)} < Lagerauge r ${zahl(BOCK.augeR)}`);
