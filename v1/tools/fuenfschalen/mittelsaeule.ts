/**
 * Die Mittelsäule — was passiert, wenn sie fällt. GERECHNET, NICHT GEBAUT.
 *
 * Anlass, wörtlich (Patrick, 15.09.2026):
 *
 *   „Also, wir sind uns doch einig, dass die Zacken direkt an der Traverse
 *    sein sollen. Und das ist aktuell nicht der Fall."
 *   „der ist ja nur durch den Bolzen quasi direkt an der Traverse fest"
 *
 * Nachgemessen hat er recht: `TRAVERSE_Y` = −0,865, `STEMPEL_AUGE.y` = −1,5335.
 * Zwischen der Mitteltraverse und den fünf Schalenbolzen liegen **66,9 cm**.
 * Davon sind 26 cm der Stempelkörper selbst (`MASS.stempel.hoehe`, er trägt die
 * fünf Ausleger) und 40,9 cm die gerechnete Säule (`09_SAEULE`).
 *
 * SIE WIRD HIER NICHT WEGGEBAUT. Sie ist am 14.09.2026 mit Begründung gebaut
 * worden (`teile.ts`, MASS.stempel: sie ist gekürzt worden, weil sie den
 * SCHLUND verengt — und genau darum ist es nicht gleichgültig, was an ihre
 * Stelle rückt). Dieses Werkzeug rechnet aus, was der Umbau kostet, damit
 * Patrick am Bild und an Zahlen entscheiden kann.
 *
 * `src/` ist von diesem Werkzeug UNBERÜHRT. Die Anlenkung wird deshalb hier
 * mit einer eigenen, parametrischen Rechnung geführt — und diese Rechnung
 * beweist sich selbst: Bei der heutigen Bolzenhöhe muss sie Ziffer für Ziffer
 * dasselbe liefern wie `rig.ts` (Gegenprobe im Ablauf, Abbruch bei Abweichung).
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/mittelsaeule.ts
 * Ergebnis: docs/f5-mittelsaeule-2026-09-15.svg + die Tabellen auf der Konsole
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import {
  MASS,
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZU,
  ZYLINDER_AUFNAHME,
  schwenkFuer,
  stoffe,
} from "../../src/fuenfschalen/teile";
import {
  baueGreiferInTeilen,
  hebelarm,
  zylinderLaenge,
  zylinderNeigung,
} from "../../src/fuenfschalen/rig";
import { schattenriss, type Strecke } from "../schattenriss";

const GRAD = 180 / Math.PI;

/** Wie weit der Bolzen heute unter der Traversenmitte sitzt (m). */
export const SAEULE_HEUTE = TRAVERSE_Y - STEMPEL_AUGE.y;
/** Reines Säulenrohr `09_SAEULE` — der Rest ist der Stempelkörper. */
export const SAEULENROHR = SAEULE_HEUTE - MASS.stempel.hoehe;

/* =========================================================== 1  ANLENKUNG */

export interface Anlenkwert {
  neigungZu: number;
  neigungOffen: number;
  neigungMax: number;
  hebelZu: number;
  hebelOffen: number;
  hebelMin: number;
  laengeZu: number;
  laengeOffen: number;
  laengeMin: number;
  hub: number;
}

/**
 * Kennwerte der Anlenkung bei FREI GEWÄHLTER Bolzenhöhe.
 *
 * Wortgleich mit `anbindungspunkt`/`hebelarm`/`zylinderNeigung` in `rig.ts`,
 * nur dass `STEMPEL_AUGE.y` durch `By` ersetzt ist. Warum abgeschrieben statt
 * aufgerufen: `rig.ts` nimmt die Bolzenhöhe nicht als Parameter, und sie dort
 * hineinzureichen hieße, `src/` für eine Rechnung anzufassen, die nichts bauen
 * soll. Die Kopie ist zulässig, WEIL sie sich gegen das Original prüfen lässt
 * — `probe()` tut das bei jedem Lauf.
 */
export function anlenkungBei(By: number): Anlenkwert {
  let neigungMax = 0;
  let hebelMin = Infinity;
  let laengeMin = Infinity;
  let neigungZu = 0;
  let neigungOffen = 0;
  let hebelZu = 0;
  let hebelOffen = 0;
  let laengeZu = 0;
  let laengeOffen = 0;
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / N;
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    const r = STEMPEL_AUGE.r + (OBERE_ANBINDUNG.y * sn + OBERE_ANBINDUNG.z * c);
    const y = By + (OBERE_ANBINDUNG.y * c - OBERE_ANBINDUNG.z * sn);
    const dr = r - ZYLINDER_AUFNAHME.r;
    const dy = y - ZYLINDER_AUFNAHME.y;
    const l = Math.hypot(dr, dy);
    const neigung = Math.atan2(Math.abs(dr), Math.abs(dy)) * GRAD;
    const hebel = Math.abs(
      ((STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r) * dy - (By - ZYLINDER_AUFNAHME.y) * dr) /
        Math.max(l, 1e-6)
    );
    laengeMin = Math.min(laengeMin, l);
    neigungMax = Math.max(neigungMax, neigung);
    hebelMin = Math.min(hebelMin, hebel);
    if (i === 0) {
      neigungZu = neigung;
      hebelZu = hebel;
      laengeZu = l;
    }
    if (i === N) {
      neigungOffen = neigung;
      hebelOffen = hebel;
      laengeOffen = l;
    }
  }
  return {
    neigungZu,
    neigungOffen,
    neigungMax,
    hebelZu,
    hebelOffen,
    hebelMin,
    laengeZu,
    laengeOffen,
    laengeMin,
    hub: laengeZu - laengeOffen,
  };
}

/**
 * Die Gegenprobe: bei heutiger Bolzenhöhe muss die Kopie das Original treffen.
 *
 * Ein Wächter mit Zahlenschranke, der nie meldet, ist keiner. Deshalb prüft
 * `probe()` NICHT nur, dass es passt, sondern gibt auch den Abstand zurück,
 * den eine um 1 mm verschobene Bolzenhöhe erzeugt — wenn der null wäre, wäre
 * die Prüfung blind.
 */
export function probe(): { fehler: number; gegenprobe: number } {
  let fehler = 0;
  for (let i = 0; i <= 60; i++) {
    const s = schwenkFuer(i / 60);
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    const r = STEMPEL_AUGE.r + (OBERE_ANBINDUNG.y * sn + OBERE_ANBINDUNG.z * c);
    const y = STEMPEL_AUGE.y + (OBERE_ANBINDUNG.y * c - OBERE_ANBINDUNG.z * sn);
    const dr = r - ZYLINDER_AUFNAHME.r;
    const dy = y - ZYLINDER_AUFNAHME.y;
    fehler = Math.max(fehler, Math.abs(Math.hypot(dr, dy) - zylinderLaenge(s)));
    fehler = Math.max(
      fehler,
      Math.abs(Math.atan2(Math.abs(dr), Math.abs(dy)) - zylinderNeigung(s))
    );
    fehler = Math.max(
      fehler,
      Math.abs(
        Math.abs(
          ((STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r) * dy - (STEMPEL_AUGE.y - ZYLINDER_AUFNAHME.y) * dr) /
            Math.hypot(dr, dy)
        ) - hebelarm(s)
      )
    );
  }
  const a = anlenkungBei(STEMPEL_AUGE.y);
  const b = anlenkungBei(STEMPEL_AUGE.y + 0.001);
  return { fehler, gegenprobe: Math.abs(a.hebelMin - b.hebelMin) };
}

/* ================================================================ 2  KORB */

export interface Korbmass {
  /** Tiefster Punkt geschlossen, unter dem BOLZEN (m). */
  tiefeZu: number;
  /** Tiefster Punkt über den Schließweg, unter dem BOLZEN (m). */
  maxTiefe: number;
  /** Schwebehöhe geschlossen (m). */
  schwebt: number;
  /** Maulweite offen, Spitze zu Spitze (m). */
  maul: number;
  /** Größter gezeichneter Durchmesser über den Weg (m). */
  huellkreis: number;
  /**
   * Tiefster Punkt in WELTHÖHE (m, unter der Aufhängung) — die Gegenprobe.
   *
   * Alles andere in diesem Satz ist auf den Bolzen bezogen und darf sich beim
   * Heben NICHT rühren. Wäre `hoch` wirkungslos, wäre das trivial richtig und
   * die Prüfung blind. Diese eine Zahl MUSS sich um genau `hoch` ändern.
   */
  tiefeWelt: number;
}

/**
 * Korbmaße einer Schale, gemessen UNTER IHREM BOLZEN.
 *
 * Der Bezug ist Absicht: Die Schale hängt am Bolzen und geht mit, wenn er
 * wandert. Alles, was hier herauskommt, muss darum von `hoch` unabhängig sein
 * — und genau das ist die Aussage, die das Blatt braucht. Gemessen statt
 * behauptet: `hoch` verschiebt das Schalengelenk wirklich.
 */
export function korbmass(hoch: number, stufen = 200): Korbmass {
  const g = baueGreiferInTeilen(stoffe());
  for (const s of g.schalen) s.gelenk.position.y += hoch;
  const bolzen = STEMPEL_AUGE.y + hoch;
  const p = new THREE.Vector3();
  const tiefe = (t: number): number => {
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    let d = 0;
    g.schalen[0]!.gelenk.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        p.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        d = Math.max(d, bolzen - p.y);
      }
    });
    return d;
  };
  let maxTiefe = 0;
  for (let i = 0; i <= stufen; i++) maxTiefe = Math.max(maxTiefe, tiefe(i / stufen));
  const tiefeZu = tiefe(0);

  g.setOeffnung(1);
  g.wurzel.updateMatrixWorld(true);
  const zahn = g.schalen[0]!.gelenk
    .getObjectByName("SHELL_TIP_01")!
    .getObjectByName("07_ZAHN") as THREE.Mesh;
  const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
  const m = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let k = pos.count - 5; k < pos.count; k++) m.add(v.fromBufferAttribute(pos, k));
  m.multiplyScalar(0.2).applyMatrix4(zahn.matrixWorld);

  let huellkreis = 0;
  for (let i = 0; i <= 40; i++) {
    g.setOeffnung(i / 40);
    g.wurzel.updateMatrixWorld(true);
    g.schalen[0]!.gelenk.traverse((o) => {
      const q = o as THREE.Mesh;
      if (!q.isMesh) return;
      const a = q.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < a.count; k++) {
        p.fromBufferAttribute(a, k).applyMatrix4(q.matrixWorld);
        huellkreis = Math.max(huellkreis, 2 * Math.hypot(p.x, p.z));
      }
    });
  }
  return {
    tiefeZu,
    maxTiefe,
    schwebt: maxTiefe - tiefeZu,
    maul: 2 * Math.hypot(m.x, m.z),
    huellkreis,
    tiefeWelt: maxTiefe - bolzen,
  };
}

/* ============================================ 3  SCHLUND UND EIGENKOLLISION */

/** Dreiecke eines Teilbaums in Weltlage. */
function dreiecke(wurzel: THREE.Object3D): Float64Array[] {
  wurzel.updateMatrixWorld(true);
  const raus: Float64Array[] = [];
  const v = new THREE.Vector3();
  wurzel.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anz = idx ? idx.count : pos.count;
    for (let i = 0; i < anz; i += 3) {
      const t = new Float64Array(9);
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        t[j * 3] = v.x;
        t[j * 3 + 1] = v.y;
        t[j * 3 + 2] = v.z;
      }
      raus.push(t);
    }
  });
  return raus;
}

/**
 * Wie viel Fläche in der Ebene `y` von Material versperrt ist (m²).
 *
 * Das ist das Mass, mit dem am 14.09.2026 die Saeule gekuerzt wurde: „In der
 * Ebene 5 cm ueber den Bolzen versperrte die Saeule 0,46 m² von 2,49 m²" — der
 * SCHLUND, also das, was von oben ueberhaupt hineinfaellt. Gemessen wird mit
 * senkrechten Strahlen (ungerade Zahl von Durchstossungen darueber = im
 * Koerper), auf einem 1-cm-Raster.
 */
export function versperrt(tris: Float64Array[], y: number, raster = 0.01, R = 1.8): number {
  let flaeche = 0;
  for (let x = -R; x <= R; x += raster) {
    for (let z = -R; z <= R; z += raster) {
      let n = 0;
      for (const t of tris) {
        /* Baryzentrisch in der xz-Projektion; y des Schnittpunkts ueber der Ebene? */
        const x1 = t[0]!;
        const z1 = t[2]!;
        const x2 = t[3]!;
        const z2 = t[5]!;
        const x3 = t[6]!;
        const z3 = t[8]!;
        const d = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3);
        if (Math.abs(d) < 1e-12) continue;
        const a = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / d;
        if (a < 0 || a > 1) continue;
        const b = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / d;
        if (b < 0 || b > 1) continue;
        const c = 1 - a - b;
        if (c < 0 || c > 1) continue;
        if (a * t[1]! + b * t[4]! + c * t[7]! > y) n++;
      }
      if (n % 2 === 1) flaeche += raster * raster;
    }
  }
  return flaeche;
}

/** Kleinster Abstand zweier Punktwolken (m) — grob, aber ausreichend. */
function naehe(a: THREE.Vector3[], b: THREE.Vector3[]): number {
  let min = Infinity;
  for (const p of a) for (const q of b) {
    const d = p.distanceToSquared(q);
    if (d < min) min = d;
  }
  return Math.sqrt(min);
}

function wolke(wurzel: THREE.Object3D, raster = 0.02): THREE.Vector3[] {
  wurzel.updateMatrixWorld(true);
  const gesehen = new Set<string>();
  const raus: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  wurzel.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = `${Math.round(v.x / raster)}|${Math.round(v.y / raster)}|${Math.round(v.z / raster)}`;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      raus.push(v.clone());
    }
  });
  return raus;
}

/**
 * Kommen sich die fuenf Schalen und der Kopf in die Quere, wenn der Bolzen um
 * `hoch` steigt?
 *
 * Zwei Fragen, und sie sind NICHT dieselbe:
 *   Schale gegen Nachbarschale — aendert sich durch eine gemeinsame Hebung
 *      GAR NICHT (alle fuenf steigen um denselben Betrag). Wird trotzdem
 *      gemessen, damit die Aussage nicht auf einem Gedanken beruht.
 *   Schale gegen KOPF (Traverse, Drehwerksgehaeuse, Stempel) — genau hier
 *      wird es eng, denn der Kopf bleibt stehen, wo er ist.
 */
export function freigang(hoch: number): { nachbar: number; traverse: number; wo: number } {
  const g = baueGreiferInTeilen(stoffe());
  for (const s of g.schalen) s.gelenk.position.y += hoch;
  /* Der Stempel traegt die Bolzen und geht mit ihnen mit — er bleibt aussen vor. */
  g.stempel.position.y += hoch;
  let nachbar = Infinity;
  let traverse = Infinity;
  let wo = 0;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    const s0 = wolke(g.schalen[0]!.gelenk, 0.03);
    const s1 = wolke(g.schalen[1]!.gelenk, 0.03);
    const k = wolke(g.traverse, 0.03);
    const n = naehe(s0, s1);
    const h = naehe(s0, k);
    if (n < nachbar) nachbar = n;
    if (h < traverse) {
      traverse = h;
      wo = t;
    }
  }
  return { nachbar, traverse, wo };
}

/* ======================================================= 4  BAUHOEHE / ARM */

/**
 * Wie tief der Arm die Stielspitze ueberhaupt bekommt (m ueber Grund),
 * je waagerechtem Abstand vom Drehmittelpunkt.
 *
 * Gemessen am ECHTEN Bagger, nicht an nachgeschriebenen Konstanten: Ausleger-
 * und Stielwinkel werden gesetzt, die Meshkette nachgefuehrt und die Weltlage
 * von `grappleGroup` abgelesen. Der Bodenanschlag ist dabei ausdruecklich NICHT
 * im Spiel — gefragt ist, was die Kinematik hergibt.
 */
export async function stielspitze(): Promise<Map<number, number>> {
  const { leinwandAttrappe } = await import("../leinwand-attrappe");
  const RAPIER = (await import("@dimforge/rapier3d-compat")).default;
  const { initPhysics } = await import("../../src/physics/physicsWorld");
  const { Excavator } = await import("../../src/excavator/excavator");
  const { BAGGER_STAND } = await import("../../src/world/baggerstand");
  leinwandAttrappe();
  await initPhysics();
  const welt = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = welt.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  welt.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), welt);
  const b = bagger as unknown as { boomAngle: number; stickAngle: number; syncMeshes(): void };
  const tiefste = new Map<number, number>();
  for (let bo = 5; bo <= 70; bo += 0.5) {
    for (let st = -140; st <= -25; st += 0.5) {
      b.boomAngle = bo / GRAD;
      b.stickAngle = st / GRAD;
      b.syncMeshes();
      const p = bagger.grappleGroup.position;
      const d = Math.round(Math.hypot(p.x - BAGGER_STAND.x, p.z - BAGGER_STAND.z) * 10) / 10;
      const alt = tiefste.get(d);
      if (alt === undefined || p.y < alt) tiefste.set(d, p.y);
    }
  }
  return tiefste;
}

/* =================================================================== BLATT */

const BREITE = 1560;
const HOEHE = 1400;
const FARBE = {
  papier: "#f4f2ee",
  feld: "#ffffff",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#b3bac0",
  beton: "#8a6a3a",
  gut: "#1d6f34",
  schlecht: "#9c2717",
  heute: "#3f4a52",
  ohne: "#1f5d86",
};

const teile: string[] = [];
const T = (
  x: number,
  y: number,
  s: string,
  groesse = 16,
  f = FARBE.linie,
  anker = "middle",
  fett = false
): void => {
  teile.push(
    `<text x="${x}" y="${y}" font-size="${groesse}" fill="${f}" text-anchor="${anker}" ` +
      `font-family="Helvetica,Arial,sans-serif"${fett ? ' font-weight="700"' : ""}>` +
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</text>"
  );
};
function male(st: Strecke[], mx: number, my: number, px: number, farbe: string): void {
  const d = st
    .map(
      ([z, y, b, h]) =>
        `M${(mx + z * px).toFixed(1)},${(my - y * px - h * px).toFixed(1)}` +
        `h${(b * px).toFixed(1)}v${(h * px).toFixed(1)}h${(-b * px).toFixed(1)}Z`
    )
    .join("");
  teile.push(`<path d="${d}" fill="${farbe}"/>`);
}
function feld(x: number, y: number, w: number, h: number, titel: string): void {
  teile.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  if (titel) T(x + 12, y + 20, titel, 13, FARBE.grau, "start");
}

/**
 * Der Greifer mit angehobenem Bolzen, als Riss.
 *
 * Nur zum ANSEHEN: Zylinder und Saeule stehen dabei falsch, weil sie in
 * `rig.ts` an festen Punkten haengen. Genau das ist ja der Befund — was hier
 * schief aussieht, ist die Anlenkung, die nachgerechnet werden muesste.
 */
function rissMitBolzen(hoch: number, t: number): Strecke[] {
  const g = baueGreiferInTeilen(stoffe());
  for (const s of g.schalen) s.gelenk.position.y += hoch;
  g.stempel.position.y += hoch;
  g.setOeffnung(t);
  return schattenriss(g.wurzel, 0.005);
}

/* --------------------------------------------------------------- Ablauf */

async function main(): Promise<void> {
  const p = probe();
  console.log("Die Mittelsäule — gerechnet, nicht gebaut\n");
  console.log(`  Traverse           ${TRAVERSE_Y.toFixed(4)} m`);
  console.log(`  Schalenbolzen      ${STEMPEL_AUGE.y.toFixed(4)} m`);
  console.log(
    `  dazwischen         ${(SAEULE_HEUTE * 100).toFixed(1)} cm  ` +
      `(${(MASS.stempel.hoehe * 100).toFixed(0)} cm Stempelkörper + ${(SAEULENROHR * 100).toFixed(1)} cm Säulenrohr)\n`
  );
  console.log(
    `  GEGENPROBE der Rechnung gegen rig.ts: groesster Fehler ${p.fehler.toExponential(1)}` +
      `  (1 mm Bolzenversatz ergaebe ${p.gegenprobe.toExponential(1)})`
  );
  if (p.fehler > 1e-12) throw new Error("Die Kopie der Anlenkung trifft rig.ts nicht mehr.");
  if (p.gegenprobe < 1e-6) throw new Error("Die Gegenprobe ist blind — sie meldet nichts.");

  /* ---------------------------------------------------- 1  Anlenkung */
  console.log("\n=== 1. Die Anlenkung, wenn der Bolzen steigt ===\n");
  console.log("  Die beiden engsten Wächter von heute (test/fuenfschalen.test.ts):");
  console.log("     Neigung des Zylinders  < 25,0°      Hebelarm  > 0,115 m\n");
  console.log("  Bolzen  Säule | Neigung | Hebelarm | Zylinder    | Hub   | Wächter");
  console.log("   (m)     (cm) |  max °  |  min mm  | zu → offen  | (mm)  |");
  console.log("  -------+------+---------+----------+-------------+-------+---------");
  const stufen: Array<{ hoch: number; a: Anlenkwert }> = [];
  for (let i = 0; i <= 10; i++) {
    const hoch = (SAEULE_HEUTE * i) / 10;
    const a = anlenkungBei(STEMPEL_AUGE.y + hoch);
    stufen.push({ hoch, a });
    const ok = a.neigungMax < 25 && a.hebelMin > 0.115;
    console.log(
      `  ${(STEMPEL_AUGE.y + hoch).toFixed(3)} | ${((SAEULE_HEUTE - hoch) * 100).toFixed(1).padStart(4)} | ` +
        `${a.neigungMax.toFixed(1).padStart(7)} | ${(a.hebelMin * 1000).toFixed(0).padStart(8)} | ` +
        `${a.laengeZu.toFixed(3)}→${a.laengeOffen.toFixed(3)} | ${(a.hub * 1000).toFixed(0).padStart(5)} | ${ok ? "hält" : "REISST"}`
    );
  }
  /* Feiner: wo genau reissen die beiden Waechter? */
  let letzterOk = 0;
  for (let i = 0; i <= 1000; i++) {
    const hoch = (SAEULE_HEUTE * i) / 1000;
    const a = anlenkungBei(STEMPEL_AUGE.y + hoch);
    if (a.neigungMax < 25 && a.hebelMin > 0.115) letzterOk = hoch;
    else break;
  }
  console.log(
    `\n  Der Bolzen darf um ${(letzterOk * 100).toFixed(1)} cm steigen, bevor einer der beiden Wächter reisst.`
  );
  console.log(
    `  Von den ${(SAEULE_HEUTE * 100).toFixed(1)} cm Säule sind das ${((letzterOk / SAEULE_HEUTE) * 100).toFixed(0)} %.`
  );
  const ganz = anlenkungBei(TRAVERSE_Y);
  console.log(
    `\n  GANZ OBEN (Bolzen auf der Traverse): Neigung ${ganz.neigungMax.toFixed(1)}°, ` +
      `Hebelarm ${(ganz.hebelMin * 1000).toFixed(0)} mm,`
  );
  console.log(
    `  Zylinder ${ganz.laengeZu.toFixed(3)} → ${ganz.laengeOffen.toFixed(3)} m bei ${(ganz.hub * 1000).toFixed(0)} mm Hub.`
  );
  const ROHR = MASS.zylinder.laenge * 0.6;
  console.log(
    `  Das Rohr allein ist ${ROHR.toFixed(3)} m lang — der Zylinder müsste also ` +
      `${(ROHR - ganz.laengeOffen).toFixed(3)} m KÜRZER werden als sein eigenes Rohr.`
  );

  /* -------------------------------------------------------- 2  Korb */
  console.log("\n=== 2. Der Korb ===\n");
  const kHeute = korbmass(0);
  const kOhne = korbmass(SAEULE_HEUTE);
  const zeile = (n: string, a: number, b: number, e = 4): void =>
    console.log(
      `  ${n.padEnd(34)}${a.toFixed(e).padStart(12)}${b.toFixed(e).padStart(12)}` +
        `${Math.abs(a - b) < 5e-9 ? "   unverändert" : `   ${(b - a).toFixed(e)}`}`
    );
  console.log(`  ${"".padEnd(34)}${"heute".padStart(12)}${"ohne Säule".padStart(12)}`);
  zeile("Tiefe geschlossen unter dem Bolzen", kHeute.tiefeZu, kOhne.tiefeZu);
  zeile("Tiefe über den ganzen Weg", kHeute.maxTiefe, kOhne.maxTiefe);
  zeile("Schwebehöhe", kHeute.schwebt, kOhne.schwebt);
  zeile("Maulweite offen", kHeute.maul, kOhne.maul);
  zeile("Hüllkreis", kHeute.huellkreis, kOhne.huellkreis);
  console.log(
    "\n  Der Korb hängt am Bolzen und geht mit ihm mit: Form, Volumen und Weite bleiben."
  );
  console.log("  Was sich ändert, ist die BAUHÖHE — und was von oben in den Korb fällt.\n");

  /*
   * Gemessen wird nur, was der KOPF versperrt — Traverse, Gehaeuse, Stempel,
   * Saeule, Ausleger. Die Schalen bleiben aussen vor: sie wandern mit und
   * versperren in ihrer eigenen Bolzenebene immer dasselbe.
   */
  const kopfVon = (g: ReturnType<typeof baueGreiferInTeilen>): THREE.Object3D => {
    const k = new THREE.Group();
    g.wurzel.updateMatrixWorld(true);
    k.add(g.traverse, g.stempel);
    return k;
  };
  const g0 = baueGreiferInTeilen(stoffe());
  g0.setOeffnung(1);
  const schlundHeute = versperrt(dreiecke(kopfVon(g0)), STEMPEL_AUGE.y + 0.05);
  const g1 = baueGreiferInTeilen(stoffe());
  for (const s of g1.schalen) s.gelenk.position.y += SAEULE_HEUTE;
  g1.stempel.position.y += SAEULE_HEUTE;
  g1.setOeffnung(1);
  const schlundOhne = versperrt(dreiecke(kopfVon(g1)), TRAVERSE_Y + 0.05);
  console.log(`  SCHLUND, 5 cm über der Bolzenebene — was der KOPF versperrt:`);
  console.log(
    `    heute        ${(schlundHeute * 1e4).toFixed(0)} cm²  (Stempelkörper Ø ${MASS.stempel.breite.toFixed(2)} + fünf Ausleger)`
  );
  console.log(
    `    ohne Säule   ${(schlundOhne * 1e4).toFixed(0)} cm²  (dort steht dann die Traverse, Ø ${MASS.traverse.breite.toFixed(2)})`
  );
  console.log(
    `    Das ist das ${(schlundOhne / Math.max(schlundHeute, 1e-9)).toFixed(2)}-fache. Genau dieses Mass war am 14.09.2026`
  );
  console.log("    der Grund, die Säule zu KÜRZEN (teile.ts, MASS.stempel) — es wird hier wieder größer.");

  /* ------------------------------------------------- 3  Eigenfreigang */
  console.log("\n=== 3. Kommen sich die Schalen und der Kopf in die Quere? ===\n");
  const fHeute = freigang(0);
  const fOhne = freigang(SAEULE_HEUTE);
  console.log(
    `  Schale gegen Nachbarschale   heute ${fHeute.nachbar.toFixed(3)} m   ohne Säule ${fOhne.nachbar.toFixed(3)} m`
  );
  console.log(
    `  Schale gegen Mitteltraverse  heute ${fHeute.traverse.toFixed(3)} m   ohne Säule ${fOhne.traverse.toFixed(3)} m`
  );
  console.log(
    `  (engste Stelle bei ${(fOhne.wo * 100).toFixed(0)} % Öffnung; 3-cm-Punktraster, also grob — es geht um`
  );
  console.log("   die Größenordnung, nicht um den Millimeter)");
  console.log(
    "\n  Die Nachbarschalen ändern sich NICHT: alle fünf steigen um denselben Betrag,"
  );
  console.log(
    "  ihr Sektor bleibt 26,3° von 36°. Was eng wird, ist die Traverse — sie bleibt stehen."
  );

  /* ------------------------------------------------ 4  Bauhöhe / Reichweite */
  console.log("\n=== 4. Bauhöhe und Reichweite ===\n");
  const tiefste = await stielspitze();
  const abstaende = [...tiefste.keys()].sort((a, b) => a - b);
  const bauHeute = kHeute.maxTiefe + -STEMPEL_AUGE.y;
  const bauOhne = kOhne.maxTiefe + -(STEMPEL_AUGE.y + SAEULE_HEUTE);
  console.log(`  Bauhöhe (Aufhängung → tiefster Punkt)   heute ${bauHeute.toFixed(3)} m`);
  console.log(`                                          ohne  ${bauOhne.toFixed(3)} m`);
  console.log(`  Der Greifer wird ${((bauHeute - bauOhne) * 100).toFixed(1)} cm kürzer.\n`);
  console.log("  Reicht der Arm dann noch auf den Beton?");
  console.log("  Abst. | tiefste Stielspitze | Zahn heute | Zahn ohne Säule");
  console.log("  ------+---------------------+------------+-----------------");
  for (const d of abstaende) {
    const y = tiefste.get(d)!;
    const zh = y - bauHeute;
    const zo = y - bauOhne;
    if (d % 1 === 0 && d >= 4 && d <= 10) {
      console.log(
        `  ${d.toFixed(1).padStart(5)} | ${y.toFixed(3).padStart(19)} | ${zh.toFixed(3).padStart(10)} | ${zo.toFixed(3).padStart(15)}`
      );
    }
  }
  const erreichtHeute = abstaende.filter((d) => tiefste.get(d)! - bauHeute <= 0);
  const erreichtOhne = abstaende.filter((d) => tiefste.get(d)! - bauOhne <= 0);
  const spanne = (a: number[]): string =>
    a.length ? `${Math.min(...a).toFixed(1)} … ${Math.max(...a).toFixed(1)} m` : "NIRGENDS";
  console.log(`\n  Auf den Beton kommt der Zahn   heute: ${spanne(erreichtHeute)}`);
  console.log(`                                 ohne:  ${spanne(erreichtOhne)}`);
  console.log(
    "\n  Die Reichweite ist NICHT das Problem. Der Arm kommt so oder so tief genug;"
  );
  console.log("  der Bodenanschlag hält ihn ohnehin an, bevor der Zahn den Beton berührt.");

  /* ------------------------------------------------------------- Blatt */
  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 50, "Die Mittelsäule — was es kostet, sie wegzunehmen", 30, FARBE.linie, "start", true);
  T(
    40,
    78,
    `Fünfschalengreifer · ${(SAEULE_HEUTE * 100).toFixed(1)} cm zwischen Traversenmitte und Schalenbolzen · GERECHNET, NICHT GEBAUT · 15.09.2026`,
    14,
    FARBE.grau,
    "start"
  );
  T(
    40,
    100,
    '„der ist ja nur durch den Bolzen quasi direkt an der Traverse fest"  (Patrick, 15.09.2026)',
    14,
    FARBE.grau,
    "start"
  );

  /* Risse: heute und ganz oben, offen, im selben Massstab */
  const PX = 150;
  const risse: Array<[string, number, string]> = [
    ["HEUTE — Bolzen −1,5335", 0, FARBE.heute],
    ["OHNE SÄULE — Bolzen −0,865", SAEULE_HEUTE, FARBE.ohne],
  ];
  risse.forEach(([titel, hoch, farbe], i) => {
    const x = 40 + i * 480;
    feld(x, 130, 460, 470, titel);
    const oben = 190;
    const mx = x + 230;
    const id = `r${i}`;
    teile.push(`<clipPath id="${id}"><rect x="${x + 2}" y="156" width="456" height="416"/></clipPath>`);
    teile.push(`<g clip-path="url(#${id})">`);
    male(rissMitBolzen(hoch, 1), mx, oben, PX, farbe);
    teile.push("</g>");
    /* Bolzenebene und Traversenmitte als Linien — darum geht es. */
    const yB = oben + -(STEMPEL_AUGE.y + hoch) * PX;
    const yT = oben + -TRAVERSE_Y * PX;
    teile.push(
      `<line x1="${x + 20}" y1="${yT}" x2="${x + 440}" y2="${yT}" stroke="${FARBE.schlecht}" stroke-width="2" stroke-dasharray="7 5"/>` +
        `<line x1="${x + 20}" y1="${yB}" x2="${x + 440}" y2="${yB}" stroke="${FARBE.gut}" stroke-width="2" stroke-dasharray="7 5"/>`
    );
    T(x + 436, yT - 6, "Traversenmitte", 12, FARBE.schlecht, "end");
    T(x + 436, yB + 16, "Schalenbolzen", 12, FARBE.gut, "end");
    if (hoch === 0) {
      teile.push(
        `<line x1="${x + 60}" y1="${yT}" x2="${x + 60}" y2="${yB}" stroke="${FARBE.linie}" stroke-width="3"/>`
      );
      T(x + 54, (yT + yB) / 2 + 5, `${(SAEULE_HEUTE * 100).toFixed(1)} cm`, 17, FARBE.linie, "end", true);
    }
    T(
      x + 230,
      586,
      hoch === 0 ? "Zylinder und Säule stehen richtig" : "Zylinder und Säule stehen FALSCH — sie sind nicht nachgerechnet",
      12,
      hoch === 0 ? FARBE.grau : FARBE.schlecht
    );
  });

  /* Kurven: Hebelarm und Neigung über die Bolzenhöhe */
  feld(1000, 130, 520, 470, "Die Anlenkung, während der Bolzen steigt");
  const kx = 1050;
  const kw = 420;
  const ky = 210;
  const kh = 150;
  const zeichneKurve = (
    y0: number,
    wert: (a: Anlenkwert) => number,
    grenze: number,
    oben2: number,
    name: string,
    einheit: string,
    hoehe: number
  ): void => {
    const pts: string[] = [];
    let riss = -1;
    for (let i = 0; i <= 200; i++) {
      const hoch = (SAEULE_HEUTE * i) / 200;
      const a = anlenkungBei(STEMPEL_AUGE.y + hoch);
      const v = Math.min(wert(a), oben2);
      const px2 = kx + (kw * i) / 200;
      const py = y0 + hoehe - (v / oben2) * hoehe;
      pts.push(`${px2.toFixed(1)},${py.toFixed(1)}`);
      if (riss < 0 && (name === "Neigung" ? wert(a) >= grenze : wert(a) <= grenze)) riss = hoch;
    }
    teile.push(
      `<rect x="${kx}" y="${y0}" width="${kw}" height="${hoehe}" fill="#fbfaf8" stroke="#e4e0d8"/>` +
        `<polyline points="${pts.join(" ")}" fill="none" stroke="${FARBE.ohne}" stroke-width="3"/>`
    );
    const gy = y0 + hoehe - (grenze / oben2) * hoehe;
    teile.push(
      `<line x1="${kx}" y1="${gy}" x2="${kx + kw}" y2="${gy}" stroke="${FARBE.schlecht}" stroke-width="2" stroke-dasharray="6 4"/>`
    );
    T(kx + kw - 6, gy - 6, `Wächter ${grenze} ${einheit}`, 12, FARBE.schlecht, "end");
    T(kx - 8, y0 + 14, name, 13, FARBE.linie, "end", true);
    T(kx - 8, y0 + hoehe, "0", 11, FARBE.hilfe, "end");
    T(kx - 8, y0 + 32, `${oben2}`, 11, FARBE.hilfe, "end");
    if (riss >= 0) {
      const rx = kx + (kw * riss) / SAEULE_HEUTE;
      teile.push(
        `<line x1="${rx}" y1="${y0}" x2="${rx}" y2="${y0 + hoehe}" stroke="${FARBE.schlecht}" stroke-width="2"/>`
      );
      T(rx, y0 - 6, `reisst bei ${(riss * 100).toFixed(0)} cm`, 12, FARBE.schlecht);
    }
  };
  zeichneKurve(ky, (a) => a.neigungMax, 25, 60, "Neigung", "°", kh);
  zeichneKurve(ky + 200, (a) => a.hebelMin * 1000, 115, 260, "Hebelarm", "mm", kh);
  T(kx, ky + 200 + kh + 24, "Bolzen steigt →  0 cm (heute)            66,9 cm (an der Traverse)", 12, FARBE.grau, "start");
  T(
    1260,
    176,
    "Der Zylinder greift 67 cm über dem Bolzen an — wandert der Bolzen dorthin,",
    12,
    FARBE.grau
  );
  T(1260, 192, "arbeitet der Zylinder gegen seinen eigenen Drehpunkt.", 12, FARBE.grau);

  /* Tabelle unten */
  feld(40, 620, 1480, 330, "Was sich ändert — und was nicht");
  const sp = [70, 640, 900, 1160, 1400];
  const kopf = ["", "heute", "ohne Säule", "", ""];
  kopf.forEach((k, i) => T(sp[i]!, 664, k, 14, FARBE.grau, i === 0 ? "start" : "end", true));
  const reihen: Array<[string, string, string, boolean]> = [
    ["Schwebehöhe geschlossen", `${(kHeute.schwebt * 100).toFixed(1)} cm`, `${(kOhne.schwebt * 100).toFixed(1)} cm`, false],
    ["Maulweite offen", `${kHeute.maul.toFixed(3)} m`, `${kOhne.maul.toFixed(3)} m`, false],
    ["Korbtiefe unter dem Bolzen", `${kHeute.tiefeZu.toFixed(3)} m`, `${kOhne.tiefeZu.toFixed(3)} m`, false],
    ["Hüllkreis", `${kHeute.huellkreis.toFixed(3)} m`, `${kOhne.huellkreis.toFixed(3)} m`, false],
    ["BAUHÖHE des Greifers", `${bauHeute.toFixed(3)} m`, `${bauOhne.toFixed(3)} m`, true],
    ["SCHLUND versperrt, 5 cm über dem Bolzen", `${(schlundHeute * 1e4).toFixed(0)} cm²`, `${(schlundOhne * 1e4).toFixed(0)} cm²`, true],
    ["Zylinderneigung, größte", `${anlenkungBei(STEMPEL_AUGE.y).neigungMax.toFixed(1)}°`, `${ganz.neigungMax.toFixed(1)}°`, true],
    ["Hebelarm, kleinster", `${(anlenkungBei(STEMPEL_AUGE.y).hebelMin * 1000).toFixed(0)} mm`, `${(ganz.hebelMin * 1000).toFixed(0)} mm`, true],
    [`Zylinderlänge offen (Rohr allein ${ROHR.toFixed(3)} m)`, `${anlenkungBei(STEMPEL_AUGE.y).laengeOffen.toFixed(3)} m`, `${ganz.laengeOffen.toFixed(3)} m`, true],
    ["Freigang Schale ↔ Mitteltraverse", `${(fHeute.traverse * 1000).toFixed(0)} mm`, `${(fOhne.traverse * 1000).toFixed(0)} mm`, true],
    ["Freigang Schale ↔ Nachbarschale", `${(fHeute.nachbar * 1000).toFixed(0)} mm`, `${(fOhne.nachbar * 1000).toFixed(0)} mm`, false],
    ["Reichweite: Zahn kommt auf den Beton", spanne(erreichtHeute), spanne(erreichtOhne), false],
  ];
  reihen.forEach((r, i) => {
    const y = 690 + i * 21;
    T(sp[0]!, y, r[0]!, 13, r[3] ? FARBE.linie : FARBE.grau, "start");
    T(sp[1]!, y, r[1]!, 13, FARBE.linie, "end");
    T(sp[2]!, y, r[2]!, 13, r[3] ? FARBE.schlecht : FARBE.hilfe, "end");
    T(sp[3]!, y, r[3] ? "ändert sich" : "unverändert", 13, r[3] ? FARBE.schlecht : FARBE.gut, "end");
  });

  /* Urteil */
  feld(40, 970, 1480, 340, "Das Urteil — und die offene Frage");
  const urteil = [
    `Der Korb ändert sich NICHT. Er hängt am Bolzen und geht mit ihm mit: Schwebehöhe, Maulweite, Korbtiefe, Hüllkreis und Volumen bleiben auf die Stelle genau.`,
    `Der Greifer wird ${((bauHeute - bauOhne) * 100).toFixed(1)} cm kürzer. Die REICHWEITE kostet das nichts: Der Zahn kommt weiter zwischen ${spanne(erreichtOhne)} auf den Beton — genau wie heute.`,
    ``,
    `Was bricht, ist die ANLENKUNG. Der Zylinder greift von der Traverse aus an der Schale an; rückt der Bolzen an die Traverse, sitzen Angriffspunkt und`,
    `Drehpunkt praktisch auf derselben Höhe. Der Bolzen darf um ${(letzterOk * 100).toFixed(1)} cm steigen — dann reisst der erste der beiden Wächter, die E-039 erkämpft hat.`,
    `Ganz oben ist der Zylinder offen nur noch ${ganz.laengeOffen.toFixed(3)} m lang. Sein Rohr allein misst ${ROHR.toFixed(3)} m. So ein Zylinder lässt sich nicht bauen.`,
    ``,
    `Der SCHLUND wird das ${(schlundOhne / Math.max(schlundHeute, 1e-9)).toFixed(2)}-fache zugebaut (${(schlundHeute * 1e4).toFixed(0)} → ${(schlundOhne * 1e4).toFixed(0)} cm²): statt Stempelkörper Ø ${MASS.stempel.breite.toFixed(2)} steht dort dann die Traverse Ø ${MASS.traverse.breite.toFixed(2)}.`,
    `Genau dieses Mass war am 14.09.2026 der Grund, die Säule zu KÜRZEN. Und die Schalen kämen der Traverse auf ${(fOhne.traverse * 1000).toFixed(0)} mm nahe statt auf ${(fHeute.traverse * 1000).toFixed(0)} mm.`,
    `Die fünf Schalen UNTEREINANDER bleiben dagegen unberührt — sie steigen alle um denselben Betrag, ihr Sektor bleibt 26,3° von 36°.`,
    ``,
    `DIE OFFENE FRAGE, die nur Patrick beantworten kann: Soll die Traverse zum Bolzen HERUNTER, statt den Bolzen zur Traverse hinauf?`,
    `Dann bleibt die Anlenkung, wie sie ist, der Greifer wird trotzdem kürzer — und der Kopf wandert in den Korb hinein. Das ist ein eigenes Blatt.`,
  ];
  urteil.forEach((s, i) => T(70, 1006 + i * 24, s, 14, s.startsWith("DIE OFFENE") ? FARBE.linie : FARBE.grau, "start", s.startsWith("DIE OFFENE")));

  T(
    40,
    1348,
    "Gemessen mit tools/fuenfschalen/mittelsaeule.ts · die Anlenkungsrechnung prüft sich bei jedem Lauf gegen rig.ts (Fehler " +
      p.fehler.toExponential(1) +
      ")",
    12,
    FARBE.hilfe,
    "start"
  );
  T(
    40,
    1370,
    "src/ ist unberührt · der Korb wurde am gebauten Netz gemessen, nicht gerechnet · Reichweite am kopflos gebauten Bagger",
    12,
    FARBE.hilfe,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-mittelsaeule-2026-09-15.svg", svg);
  console.log(`\ndocs/f5-mittelsaeule-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
}

/*
 * Nur als Werkzeug ausfuehren. `test/mittelsaeule.test.ts` importiert die
 * Rechnung, um die Aussagen des Blattes nachzuprueften — dabei soll kein Blatt
 * geschrieben und kein Bagger gebaut werden. Dasselbe Muster wie in
 * `traverse-blatt.ts`.
 */
if (!process.env.VITEST) void main();
