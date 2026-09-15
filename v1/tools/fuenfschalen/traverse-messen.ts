/**
 * Was kostet eine dickere Mitteltraverse am Korb? — gemessen, nicht geschaetzt.
 *
 * Patricks Klage am Fuenfschalengreifer vom Wochenende war, dass Traverse und
 * Stempel „das Volumen des Greifers fuer das Material" nehmen (E-009). Bevor
 * die Traverse fuer die Anlenkung waechst, muss deshalb beziffert sein, was das
 * dem Korb kostet. Dieses Werkzeug baut den Greifer zu jeder Variante wirklich
 * auf und misst ihn.
 *
 * WIE GEMESSEN WIRD — und warum nicht ueber Extrempunkte:
 *
 * Am 14.09.2026 ist an dieser Baugruppe ein Messwerkzeug weggeworfen worden,
 * weil es „aeusserster Punkt = Spitze" annahm. Bei einer nach innen gekruemmten
 * Sichel ist der aeusserste Punkt die RUECKSEITE, nicht die Spitze; das
 * Werkzeug meldete 34 cm in die falsche Richtung. Hier wird deshalb ueber
 * KNOTENNAMEN gemessen:
 *
 *   Zahn / Grabtiefe   `SHELL_TIP_xx` -> `07_ZAHN`, tiefster Netzpunkt dieses
 *                      einen Koerpers, ueber 41 Stellungen des Oeffnungswegs.
 *   Traverse           `04_MITTELTRAVERSE` mit allem, was darunterhaengt.
 *   Stempel            `09_STEMPEL`.
 *   Schalen            `greifer.schalen[i].gelenk`.
 *
 * Kein Aufruf sucht „das Maximum ueber alle Netzpunkte" und nennt es dann ein
 * Bauteilmass.
 *
 * WIE DIE VARIANTEN ENTSTEHEN: `teile.ts` bleibt unberuehrt. Die drei Zahlen
 * der Anlenkung (`ZYLINDER_AUFNAHME.r/.y`, `OBERE_ANBINDUNG.y/.z`) und
 * `MASS.traverse.breite/.tiefe` werden hier im Werkzeug VOR dem Bauen gesetzt
 * und danach auf den Ausgangswert zurueckgestellt. Nichts davon geht ins Spiel
 * oder in die Vorschau; das Blatt ist eine Zeichnung, kein Umbau.
 *
 * Diese Datei misst nur. Die Tabelle dazu druckt `traverse-korb.ts`.
 */
import * as THREE from "three";
import {
  MASS,
  OBERE_ANBINDUNG,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZU,
  ZYLINDER_AUFNAHME,
  mittellinie,
  stoffe,
} from "../../src/fuenfschalen/teile";
import { baueGreifer } from "../../src/fuenfschalen/rig";
import { Variante, traverseHoehe } from "./traverse-varianten";

/* ------------------------------------------------------------- Dreieckssatz */

type Dreieck = number[];

/** Alle Weltdreiecke eines Teilbaums. */
function dreiecke(o: THREE.Object3D): Dreieck[] {
  const raus: Dreieck[] = [];
  const v = new THREE.Vector3();
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anzahl = idx ? idx.count : pos.count;
    for (let i = 0; i < anzahl; i += 3) {
      const e: number[] = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        e.push(v.x, v.y, v.z);
      }
      raus.push(e);
    }
  });
  return raus;
}

/* ------------------------------------------------------------------ Korb */

/** Radius der geschlossenen Mittellinie auf Hoehe y (m) — wie in `abcde.ts`. */
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

/** Bruttokorb: Rotationskoerper der geschlossenen Mittellinie unter der Bolzenebene (m³). */
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
 * Werkstoff IM Korb (m³) — Strahl laengs +x, mit Tiefenzaehler statt Paritaet.
 *
 * Wortgleich mit `koepfeImKorb` in `abcde.ts`; dort steht auch, warum der
 * Zaehler sein muss: Haut, Guss und Huelse durchdringen einander, Paritaet
 * wuerde den gemeinsamen Kern zweimal zaehlen und wieder abziehen.
 */
function werkstoffImKorb(teile: Dreieck[], raster = 0.01): number {
  const bahn = mittellinie(ZU);
  const yO = STEMPEL_AUGE.y;
  const yU = Math.min(...bahn.map((p) => p.y));
  let v = 0;
  for (let y = yU + raster / 2; y < yO; y += raster) {
    const R = korbRadius(y);
    for (let z = -R; z <= R; z += raster) {
      const halb = Math.sqrt(Math.max(0, R * R - z * z));
      if (halb < raster) continue;
      const treffer: Array<[number, number]> = [];
      for (const t of teile) {
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
        if (b > a) v += (b - a) * raster * raster;
      }
    }
  }
  return v;
}

/* ------------------------------------------------------------- Der Schlund */

/**
 * Wie viel Eisen steht in einer waagrechten Ebene (m²)?
 *
 * Dasselbe Verfahren wie oben, nur in EINER Scheibe und ueber einen frei
 * gewaehlten Kreis. Das ist die Zahl aus E-009 („in der Ebene 5 cm ueber den
 * Bolzen standen 0,464 m² von 2,488 m² auf Eisen").
 */
function eisenInEbene(teile: Dreieck[], y: number, R: number, raster = 0.01): number {
  let a = 0;
  for (let z = -R; z <= R; z += raster) {
    const halb = Math.sqrt(Math.max(0, R * R - z * z));
    if (halb < raster) continue;
    const treffer: Array<[number, number]> = [];
    for (const t of teile) {
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
      const u = Math.max(treffer[i]![0]!, -halb);
      const w = Math.min(treffer[i + 1]![0]!, halb);
      if (w > u) a += (w - u) * raster;
    }
  }
  return a;
}

/**
 * Der Einwurfschatten: wie viel der Korbmuendung von oben zugebaut ist (m²).
 *
 * Schuettgut faellt senkrecht ein. Gezaehlt wird darum die SENKRECHTE
 * Projektion alles Eisens ueber der Bolzenebene auf die Muendungsscheibe —
 * Traverse, Saeule, Stempel, Ausleger, Zylinder, Schalenkoepfe. Das ist die
 * Zahl, die Patricks Eindruck „nimmt das Volumen fuer das Material" wirklich
 * trifft: Die Traverse steht NICHT im Korb, sie steht davor.
 */
function einwurfschatten(teile: Dreieck[], R: number, raster = 0.01): number {
  const oben = teile.filter((t) => Math.max(t[1]!, t[4]!, t[7]!) > STEMPEL_AUGE.y);
  let a = 0;
  for (let x = -R; x <= R; x += raster) {
    for (let z = -R; z <= R; z += raster) {
      if (x * x + z * z > R * R) continue;
      let getroffen = false;
      for (const t of oben) {
        const ax = t[0]!;
        const az = t[2]!;
        const bx = t[3]!;
        const bz = t[5]!;
        const cx = t[6]!;
        const cz = t[8]!;
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-14) continue;
        const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
        const w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
        const w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        if (w1 * t[1]! + w2 * t[4]! + w3 * t[7]! <= STEMPEL_AUGE.y) continue;
        getroffen = true;
        break;
      }
      if (getroffen) a += raster * raster;
    }
  }
  return a;
}

/* ----------------------------------------------------- Messung je Variante */

export interface Messung {
  name: string;
  durchmesser: number;
  /** Tiefster Punkt des Knotens `07_ZAHN`, ueber den ganzen Oeffnungsweg (m). */
  grabtiefe: number;
  /** Groesster Durchmesser ueber den ganzen Oeffnungsweg (m). */
  huellkreis: number;
  /** Bauhoehe geschlossen, ueber alle Netzpunkte (m). */
  bauhoehe: number;
  /** Groesster Durchmesser geschlossen (m) — Strecke A der Zeichnung. */
  breiteZu: number;
  bruttokorb: number;
  nettokorb: number;
  schlund: number;
  muendung: number;
  schatten: number;
  /** Groesster Radius des Knotens `04_MITTELTRAVERSE` (m). */
  kopfradius: number;
  /** Abstand der fuenf Zahnspitzen von der Achse, geschlossen (m). */
  spitzenAufAchse: number;
  /** Genutzter Sektor je Schale (Grad), Grenze 36. */
  sektor: number;
  /** Einbauhoehe der Traverse (m) — sie folgt ihrer Aufnahme. */
  traverseY: number;
  /** Sitzt das Zylinderauge im Gusskoerper des Zinkens (E-013)? */
  augeImGuss: boolean;
  /** Abstand des Augenmittelpunkts zum naechsten Gussknoten (m), Naeherung. */
  augeAbstand: number;
  schattenTraverse: number;
  schattenStempel: number;
  schattenZylinder: number;
  schattenSchalen: number;
}

/**
 * Einbauhoehe der Traverse im gebauten Stand — `LAGE.traverse` aus `rig.ts`.
 *
 * Hier stand `traverseHoehe(-0.73)`, also die Aufnahmehoehe der Variante A als
 * feste Zahl. Das war richtig, solange A gebaut war, und wurde mit E-039 zur
 * Falle: Nach dem Umbau haette das Werkzeug jede Variante um 9,5 cm versetzt
 * gemessen. `TRAVERSE_Y` sagt dasselbe, ohne eine Variante zu kennen.
 */
const LAGE_TRAVERSE = TRAVERSE_Y;

const URSPRUNG = {
  Zr: ZYLINDER_AUFNAHME.r,
  Zy: ZYLINDER_AUFNAHME.y,
  Ay: OBERE_ANBINDUNG.y,
  Az: OBERE_ANBINDUNG.z,
  breite: MASS.traverse.breite,
  tiefe: MASS.traverse.tiefe,
};

/** Setzt die Anlenkung fuer den naechsten Bau. Nur im Werkzeug, nie im Spiel. */
function stelleEin(v: Variante | null): void {
  const s = v
    ? { Zr: v.Zr, Zy: v.Zy, Ay: v.Ay, Az: v.Az, breite: v.durchmesser, tiefe: v.durchmesser }
    : URSPRUNG;
  ZYLINDER_AUFNAHME.r = s.Zr;
  ZYLINDER_AUFNAHME.y = s.Zy;
  OBERE_ANBINDUNG.y = s.Ay;
  OBERE_ANBINDUNG.z = s.Az;
  (MASS.traverse as { breite: number }).breite = s.breite;
  (MASS.traverse as { tiefe: number }).tiefe = s.tiefe;
}

/**
 * Ist der Punkt (x, y, z) im Werkstoff dieses Teilbaums?
 *
 * Strahl laengs +x mit Tiefenzaehler — dasselbe Verfahren wie im Korb, und aus
 * demselben Grund: Die Koerper eines Gussstuecks durchdringen einander.
 */
function imWerkstoff(teile: Dreieck[], x: number, y: number, z: number): boolean {
  const treffer: Array<[number, number]> = [];
  for (const t of teile) {
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
  treffer.sort((p, q) => p[0]! - q[0]!);
  let tiefe = 0;
  for (const [ort, richtung] of treffer) {
    if (ort > x) break;
    tiefe += richtung;
  }
  return tiefe > 0;
}

/**
 * `miss` mit `korb = false` laesst die vier teuren Rasterungen weg.
 *
 * Volumen, Schlund und Einwurfschatten kosten je Variante mehrere Sekunden;
 * Grabtiefe, Huellkreis, Sektor, Spitzenlage und Augensitz sind in Sekunden
 * da. Die Waechter brauchen nur die zweite Haelfte und sollen `npm test` nicht
 * um Minuten verlaengern.
 */
export function miss(v: Variante, korb = true): Messung {
  stelleEin(v);
  const g = baueGreifer(stoffe());
  /*
   * Die Traverse rueckt mit ihrer Aufnahme. `TRAVERSE_Y` ist eine Konstante in
   * `teile.ts` und wird hier nicht angefasst; stattdessen wird die fertige
   * Baugruppe versetzt und ihre fuenf Gabeln um denselben Betrag zurueck —
   * so bleiben die Gabelaugen genau auf `Zy`, wo die Kinematik sie erwartet.
   */
  const rueck = traverseHoehe(v.Zy) - LAGE_TRAVERSE;
  if (Math.abs(rueck) > 1e-9) {
    g.traverse.position.y += rueck;
    for (const kind of g.traverse.children) {
      if (kind.name.startsWith("04_ZYLINDERAUFNAHME_")) kind.position.y -= rueck;
    }
  }

  /* Grabtiefe, Huellkreis und Sektor ueber den ganzen Weg. */
  let grabtiefe = 0;
  let huellkreis = 0;
  let sektor = 0;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 40; i++) {
    g.setOeffnung(i / 40);
    g.wurzel.updateMatrixWorld(true);
    for (let s = 0; s < g.schalen.length; s++) {
      const schale = g.schalen[s]!;
      const zahn = schale.gelenk
        .getObjectByName(`SHELL_TIP_${String(s + 1).padStart(2, "0")}`)!
        .getObjectByName("07_ZAHN") as THREE.Mesh;
      const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        p.fromBufferAttribute(pos, k).applyMatrix4(zahn.matrixWorld);
        grabtiefe = Math.max(grabtiefe, -p.y);
      }
      schale.gelenk.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const q = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < q.count; k++) {
          p.fromBufferAttribute(q, k).applyMatrix4(m.matrixWorld);
          huellkreis = Math.max(huellkreis, 2 * Math.hypot(p.x, p.z));
          /* Achsnahe Zone ausgenommen — `SEKTOR_AB` aus E-009. */
          if (Math.hypot(p.x, p.z) < 0.3) continue;
          let d = Math.atan2(p.x, p.z) - schale.winkel;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          sektor = Math.max(sektor, Math.abs(d));
        }
      });
    }
  }

  g.setOeffnung(0);
  g.wurzel.updateMatrixWorld(true);

  /* Bauhoehe geschlossen und Kopfradius — beide ueber benannte Knoten. */
  let yMin = Infinity;
  let yMax = -Infinity;
  let breiteZu = 0;
  for (const t of dreiecke(g.wurzel)) {
    for (const j of [0, 3, 6]) {
      yMin = Math.min(yMin, t[j + 1]!);
      yMax = Math.max(yMax, t[j + 1]!);
      breiteZu = Math.max(breiteZu, 2 * Math.hypot(t[j]!, t[j + 2]!));
    }
  }
  let kopfradius = 0;
  for (const t of dreiecke(g.traverse)) {
    for (const j of [0, 3, 6]) kopfradius = Math.max(kopfradius, Math.hypot(t[j]!, t[j + 2]!));
  }

  /* Wo stehen die fuenf Zahnspitzen geschlossen? Ueber den Knoten, nicht ueber Extrema. */
  let spitzenAufAchse = 0;
  for (let s = 0; s < g.schalen.length; s++) {
    const zahn = g.schalen[s]!.gelenk
      .getObjectByName(`SHELL_TIP_${String(s + 1).padStart(2, "0")}`)!
      .getObjectByName("07_ZAHN") as THREE.Mesh;
    const pos = zahn.geometry.getAttribute("position") as THREE.BufferAttribute;
    /*
     * Die letzten fuenf Punkte sind der Spitzenring — so legt
     * `baueGreiferspitze` sie ab. Gemessen wird ihr Schwerpunkt, nicht der
     * aeusserste Punkt: Bei einer nach innen gekruemmten Sichel liegt der
     * aeusserste Punkt auf der Rueckseite.
     */
    const mitte = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let k = pos.count - 5; k < pos.count; k++) mitte.add(v.fromBufferAttribute(pos, k));
    mitte.multiplyScalar(0.2).applyMatrix4(zahn.matrixWorld);
    spitzenAufAchse = Math.max(spitzenAufAchse, Math.hypot(mitte.x, mitte.z));
  }

  /*
   * Sitzt das Zylinderauge noch IM Guss? E-013 hat die Konsole abgeschafft:
   * Das Auge ist seitdem eine Nabe im durchgehenden Gusskoerper. Wandert es
   * mit `Ay`/`Az` aus dem `06_ZINKEN` heraus, braucht es die Konsole zurueck —
   * und das waere ein Rueckschritt hinter E-013, keine Nebensache.
   */
  const zinken = g.schalen[0]!.gelenk.getObjectByName("06_ZINKEN")!;
  const auge = g.schalen[0]!.gelenk.getObjectByName("06_ZYLINDERAUGE")!;
  auge.updateWorldMatrix(true, false);
  const augeWelt = new THREE.Vector3().setFromMatrixPosition(auge.matrixWorld);
  const gussDreiecke = dreiecke(zinken);
  const augeImGuss = imWerkstoff(gussDreiecke, augeWelt.x, augeWelt.y, augeWelt.z);
  /*
   * Und wie weit davor? Abgeschritten, nicht geschaetzt: in 72 Richtungen der
   * Radialebene in 2-mm-Schritten, bis der erste Punkt im Guss liegt. Liegt
   * das Auge selbst im Guss, ist der Wert 0.
   *
   * In der Radialebene, weil sich das Auge nur dort bewegt: `Ay` und `Az`
   * spannen genau diese Ebene auf, quer dazu (x, laengs der Schalenbreite)
   * sitzt es unveraendert in der Mitte.
   */
  let augeAbstand = 0;
  if (!augeImGuss) {
    augeAbstand = Infinity;
    for (let i = 0; i < 72; i++) {
      const w = (i / 72) * Math.PI * 2;
      for (let d = 0.002; d <= 0.3; d += 0.002) {
        if (
          imWerkstoff(
            gussDreiecke,
            augeWelt.x,
            augeWelt.y + Math.sin(w) * d,
            augeWelt.z + Math.cos(w) * d
          )
        ) {
          augeAbstand = Math.min(augeAbstand, d);
          break;
        }
      }
    }
  }

  const muendungR = korbRadius(STEMPEL_AUGE.y);
  const alleTeile = korb ? dreiecke(g.wurzel) : [];
  const schattenTraverse = korb ? einwurfschatten(dreiecke(g.traverse), muendungR) : 0;
  const schattenStempel = korb ? einwurfschatten(dreiecke(g.stempel), muendungR) : 0;
  const schattenZylinder = korb
    ? einwurfschatten(
        g.zylinder.flatMap((z) => dreiecke(z.gelenk)),
        muendungR
      )
    : 0;
  const schattenSchalen = korb
    ? einwurfschatten(
        g.schalen.flatMap((s) => dreiecke(s.gelenk)),
        muendungR
      )
    : 0;
  const messung: Messung = {
    name: v.name,
    durchmesser: v.durchmesser,
    grabtiefe,
    huellkreis,
    bauhoehe: yMax - yMin,
    breiteZu,
    bruttokorb: bruttokorb(),
    nettokorb: korb ? bruttokorb() - werkstoffImKorb(alleTeile) : 0,
    schlund: korb ? eisenInEbene(alleTeile, STEMPEL_AUGE.y + 0.05, muendungR) : 0,
    muendung: Math.PI * muendungR ** 2,
    schatten: korb ? einwurfschatten(alleTeile, muendungR) : 0,
    kopfradius,
    spitzenAufAchse,
    sektor: (sektor * 180) / Math.PI,
    traverseY: traverseHoehe(v.Zy),
    augeImGuss,
    augeAbstand,
    schattenTraverse,
    schattenStempel,
    schattenZylinder,
    schattenSchalen,
  };
  stelleEin(null);
  return messung;
}

