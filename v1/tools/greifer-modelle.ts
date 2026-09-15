/**
 * Sichelkralle gegen Fuenfschalengreifer — dieselben Groessen, dieselbe Messart.
 *
 * Auftrag 15.09.2026: Bevor der Fuenfschalengreifer an den Bagger darf, muss
 * durchgerechnet sein, was sich an Reichweite, Grabtiefe, Korb und Kollidern
 * aendert. Dieses Werkzeug misst — es aendert nichts.
 *
 * WIE GEMESSEN WIRD, und warum nicht ueber Extrempunkte:
 *
 * Am 14.09.2026 ist an dieser Baugruppe ein Messwerkzeug weggeworfen worden,
 * weil es „aeusserster Punkt = Spitze" annahm. Bei einer nach innen
 * gekruemmten Sichel ist der aeusserste Punkt die RUECKSEITE, nicht die
 * Spitze; das Werkzeug meldete 34 cm in die falsche Richtung. Hier wird
 * deshalb ueber KNOTENNAMEN gemessen:
 *
 *   Zahn        Sichelkralle `tineTip`  ·  Fuenfschalen `07_ZAHN`
 *   Schale      Sichelkralle das Krallengelenk (`baueSpinne().gelenke[i]`)
 *               Fuenfschalen `greifer.schalen[i].gelenk`
 *   Bolzenebene Sichelkralle `CLAW_RING_Y`  ·  Fuenfschalen `STEMPEL_AUGE.y`
 *
 * Kein Aufruf sucht „das Maximum ueber alle Netzpunkte" und nennt es dann ein
 * Bauteilmass. Wo das Maximum ueber alle Punkte WIRKLICH gemeint ist
 * (Huellkreis, Bauhoehe), heisst die Zeile auch so.
 *
 * DER GEMEINSAME NULLPUNKT. Beide Modelle haengen mit y = 0 an der Stelle, an
 * der der Greifer am Stiel sitzt: bei der Sichelkralle der Ursprung von
 * `grappleGroup` (das Kardangelenk), beim Fuenfschalengreifer die Oberkante
 * des Adapters. Alle Tiefen sind Tiefen unter diesem Punkt.
 *
 * Die Korbrechnungen (brutto, netto, Muendung, Einwurfschatten) sind wortweise
 * dieselben wie in `tools/fuenfschalen/traverse-messen.ts` — Strahl laengs +x
 * mit TIEFENZAEHLER statt Paritaet, weil sich die Koerper eines Gussstuecks
 * durchdringen und Paritaet den gemeinsamen Kern zweimal zaehlen wuerde.
 *
 * Diese Datei MISST nur und druckt nichts. Die Tabelle dazu druckt
 * `tools/greifer-gegenueber.ts`, das Blatt zeichnet
 * `tools/greifer-vergleich-blatt.ts` — beide aus derselben Messung, damit auf
 * dem Blatt nichts anderes steht als in der Tabelle.
 */
import * as THREE from "three";
import { baueSpinne } from "../src/excavator/grappleParts";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_OPEN_SPLAY,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  clawPoint,
} from "../src/excavator/clawGeometry";
import { baueGreifer } from "../src/fuenfschalen/rig";
import {
  MASS,
  SCHALEN_ABSCHNITTE,
  STEMPEL_AUGE,
  mittellinie,
  schwenkFuer,
  stoffe,
} from "../src/fuenfschalen/teile";

/* ------------------------------------------------------------ Dreieckssatz */

type Dreieck = number[];

/** Alle Weltdreiecke eines Teilbaums. */
export function dreiecke(o: THREE.Object3D): Dreieck[] {
  const raus: Dreieck[] = [];
  const v = new THREE.Vector3();
  o.updateMatrixWorld(true);
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

/** Netze und Dreiecke eines Teilbaums. */
function zaehlwerk(o: THREE.Object3D): { netze: number; dreiecke: number } {
  let netze = 0;
  let drei = 0;
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    netze++;
    const idx = m.geometry.getIndex();
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    drei += Math.floor((idx ? idx.count : pos.count) / 3);
  });
  return { netze, dreiecke: drei };
}

/** Alle Weltpunkte eines Teilbaums abschreiten. */
export function punkte(o: THREE.Object3D, fn: (p: THREE.Vector3) => void): void {
  const v = new THREE.Vector3();
  o.updateMatrixWorld(true);
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      fn(v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld));
    }
  });
}

/* ------------------------------------------------------- Strahl mit Zaehler */

/** Getroffene x-Strecken eines Strahls laengs +x durch (y, z). */
function strecken(teile: Dreieck[], y: number, z: number): Array<[number, number]> {
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
  if (treffer.length < 2) return [];
  treffer.sort((p, q) => p[0]! - q[0]!);
  const raus: Array<[number, number]> = [];
  let tiefe = 0;
  for (let i = 0; i + 1 < treffer.length; i++) {
    tiefe += treffer[i]![1]!;
    if (tiefe > 0) raus.push([treffer[i]![0]!, treffer[i + 1]![0]!]);
  }
  return raus;
}

/* ------------------------------------------------------------- Der Prueling */

export interface Pruefling {
  name: string;
  wurzel: THREE.Object3D;
  /** 0 = geschlossen, 1 = ganz offen. */
  setOeffnung(t: number): void;
  /** Die fuenf Zahnknoten. */
  zaehne(): THREE.Object3D[];
  /** Die fuenf Schalen-Teilbaeume (mit Zahn). */
  schalen(): THREE.Object3D[];
  /** Hoehe der Bolzenebene — darunter liegt der Korb. */
  bolzenY: number;
  /** Mittellinie EINER Schale bei gegebenem Oeffnungsgrad, im Greiferframe. */
  mittellinie(t: number): Array<{ r: number; y: number }>;
  /** Zahl der Schalen. */
  schalenzahl: number;
  /** Stationen je Schale (fuer die Lueckenrechnung). */
  stationen: number;
}

export function sichelkralle(): Pruefling {
  const s = baueSpinne();
  const wurzel = new THREE.Group();
  wurzel.add(s.gruppe);
  /*
   * Die fuenf Zylinder rechnen im Spiel in Weltkoordinaten und werden von
   * `Excavator.updateGrappleCylinders` gesetzt. Kopflos stuenden sie als
   * Einheitszylinder im Ursprung und wuerden jede Korbmessung verfaelschen.
   * Hier steht dieselbe Rechnung wie dort — sonst misst man einen Greifer,
   * den es nicht gibt.
   */
  const setzeZylinder = (): void => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (const c of s.zylinder) {
      a.copy(c.obenLokal);
      b.copy(c.untenAmGelenk).applyEuler(c.gelenk.rotation).add(c.gelenk.position);
      dir.copy(b).sub(a);
      const dist = Math.max(dir.length(), 0.2);
      dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      c.rohr.position.copy(a).addScaledVector(dir, c.rohrLaenge / 2);
      c.rohr.quaternion.copy(q);
      c.rohr.scale.set(1, c.rohrLaenge, 1);
      const stangeLang = Math.max(dist - c.rohrLaenge + 0.08, 0.08);
      c.stange.position.copy(b).addScaledVector(dir, -stangeLang / 2);
      c.stange.quaternion.copy(q);
      c.stange.scale.set(1, stangeLang, 1);
    }
  };
  const splayFuer = (t: number): number =>
    CLAW_CLOSED_SPLAY + (CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * Math.min(1, Math.max(0, t));
  return {
    name: "Sichelkralle",
    wurzel,
    setOeffnung(t) {
      // Genau die Drehung, die `Excavator.updateFingers` setzt: −Spreizung.
      for (const g of s.gelenke) g.rotation.x = -splayFuer(t);
      setzeZylinder();
      wurzel.updateMatrixWorld(true);
    },
    zaehne: () =>
      s.gelenke.map((g) => {
        const z = g.getObjectByName("tineTip");
        if (!z) throw new Error("tineTip nicht gefunden");
        return z;
      }),
    schalen: () => s.gelenke,
    bolzenY: CLAW_RING_Y,
    mittellinie(t) {
      const splay = splayFuer(t);
      const p = new THREE.Vector3();
      const bahn: Array<{ r: number; y: number }> = [];
      for (let k = 0; k <= CLAW_SEGMENTS; k++) {
        clawPoint(0, splay, k, p);
        bahn.push({ r: Math.hypot(p.x, p.z), y: p.y });
      }
      return bahn;
    },
    schalenzahl: CLAW_COUNT,
    stationen: CLAW_SEGMENTS,
  };
}

export function fuenfschalen(): Pruefling {
  const g = baueGreifer(stoffe());
  return {
    name: "Fuenfschalengreifer",
    wurzel: g.wurzel,
    setOeffnung(t) {
      g.setOeffnung(Math.min(1, Math.max(0, t)));
      g.wurzel.updateMatrixWorld(true);
    },
    zaehne: () =>
      g.schalen.map((s, i) => {
        const spitze = s.gelenk.getObjectByName(`SHELL_TIP_${String(i + 1).padStart(2, "0")}`);
        const z = spitze?.getObjectByName("07_ZAHN");
        if (!z) throw new Error("07_ZAHN nicht gefunden");
        return z;
      }),
    schalen: () => g.schalen.map((s) => s.gelenk),
    bolzenY: STEMPEL_AUGE.y,
    mittellinie: (t) => mittellinie(schwenkFuer(Math.min(1, Math.max(0, t)))),
    schalenzahl: MASS.schalen,
    stationen: SCHALEN_ABSCHNITTE,
  };
}

/* ------------------------------------------------------------- Die Messung */

export interface Messung {
  name: string;
  netze: number;
  dreiecke: number;
  /** Tiefster Punkt des ZAHNKNOTENS ueber den ganzen Oeffnungsweg (m). */
  grabtiefe: number;
  /** Tiefster gezeichneter Punkt ueberhaupt, ueber den ganzen Weg (m). */
  tiefsterPunkt: number;
  /** Groesster gezeichneter Durchmesser ueber den ganzen Weg (m). */
  huellkreis: number;
  /** Abstand der Zahnspitzen von der Achse mal zwei, ganz offen (m). */
  spitzenweiteOffen: number;
  /** Dasselbe geschlossen (m) — Restweite auf der Achse. */
  spitzenweiteZu: number;
  /** Groesster gezeichneter Durchmesser geschlossen (m). */
  breiteZu: number;
  /** Bauhoehe geschlossen ueber alle Netzpunkte (m). */
  bauhoehe: number;
  /** Oberkante des Modells unter dem Aufhaengepunkt (m, negativ = darunter). */
  oberkante: number;
  bruttokorb: number;
  nettokorb: number;
  muendung: number;
  schatten: number;
  /** Werkstoffvolumen des ganzen Greifers (m³), Strahlraster. */
  werkstoff: number;
  /** Bolzenebene (m). */
  bolzenY: number;
  /** Noetiger Sensorradius bei Sensorsitz 1,50 m unter der Spinne (m). */
  sensorRadius: number;
  /** Tiefster Punkt der SCHALENMITTELLINIE ueber den Weg (m). */
  mittellinieTief: number;
  /** Abstand benachbarter Schalen bei 60 % der Schalenlaenge, geschlossen (m). */
  schalenluecke: number;
  /** Dieselbe Luecke am Anfang des Greiffensters (Schliessgrad 0,60). */
  lueckeFensterAuf: number;
  /** Dieselbe Luecke am Ende des Greiffensters (Schliessgrad 0,98). */
  lueckeFensterZu: number;
  /** Korbradius auf halber Korbhoehe, geschlossen (m). */
  korbRadiusMitte: number;
  /** Groesster Durchmesser der geschlossenen Mittellinie — der Aequator (m). */
  aequator: number;
  /** Hoehe des Aequators (m). */
  aequatorY: number;
  /** Was von der Aequatorscheibe von oben zugebaut ist (m²). */
  schattenAequator: number;
  /** Grabtiefe je Oeffnungsgrad (0 = zu … 1 = offen), 11 Stuetzstellen. */
  tiefenweg: number[];
}

/** Radius der geschlossenen Mittellinie auf Hoehe y (m). */
export function korbRadius(bahn: Array<{ r: number; y: number }>, y: number): number {
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

const SCHRITTE = 40;
/** Luft, die `isInsideGrapple` unter die Spitzen legt (gripSystem.KORB_LUFT_UNTEN). */
const KORB_LUFT_UNTEN = 0.18;
/** Sensorsitz unter dem Greiferursprung (gripSystem.SENSOR_UNTER_SPINNE). */
const SENSOR_UNTER_SPINNE = 1.5;
/** Dichte von Baustahl (kg/m³) — fuer die Massenschaetzung. */
export const STAHL = 7850;

export function miss(p: Pruefling, raster = 0.02): Messung {
  /* --- ueber den ganzen Oeffnungsweg --- */
  let grabtiefe = 0;
  let tiefsterPunkt = 0;
  let huellkreis = 0;
  let mittellinieTief = 0;
  const tiefeBei: number[] = [];
  for (let i = 0; i <= SCHRITTE; i++) {
    p.setOeffnung(i / SCHRITTE);
    let hier = 0;
    for (const z of p.zaehne()) punkte(z, (q) => (hier = Math.max(hier, -q.y)));
    tiefeBei.push(hier);
    grabtiefe = Math.max(grabtiefe, hier);
    punkte(p.wurzel, (q) => {
      tiefsterPunkt = Math.max(tiefsterPunkt, -q.y);
      huellkreis = Math.max(huellkreis, 2 * Math.hypot(q.x, q.z));
    });
    for (const m of p.mittellinie(i / SCHRITTE)) {
      mittellinieTief = Math.max(mittellinieTief, -m.y);
    }
  }
  const tiefenweg = Array.from({ length: 11 }, (_, i) => tiefeBei[(i * SCHRITTE) / 10]!);

  /* --- Spitzenweite offen und zu, ueber die MITTE des Zahnrandes --- */
  /*
   * Nicht „der aeusserste Punkt des Zahns": Die Unterkante ist bei beiden
   * Greifern eine Scheibe bzw. eine Kante von einigen Zentimetern, und welcher
   * ihrer Eckpunkte als erster das Minimum trifft, ist Zufall der
   * Netzreihenfolge — beim ersten Lauf kam so die INNENkante heraus und meldete
   * 14,7 cm zu wenig. Gemessen wird deshalb der Schwerpunkt aller Punkte, die
   * innerhalb von 3 mm am tiefsten liegen. Das ist dieselbe Vorsicht wie in
   * `traverse-messen.ts` („Spitzenring, nicht aeusserster Punkt").
   */
  const spitzenweite = (t: number): number => {
    p.setOeffnung(t);
    let weite = 0;
    for (const z of p.zaehne()) {
      let tief = Infinity;
      punkte(z, (q) => (tief = Math.min(tief, q.y)));
      const mitte = new THREE.Vector3();
      let n = 0;
      punkte(z, (q) => {
        if (q.y > tief + 0.003) return;
        mitte.add(q);
        n++;
      });
      if (n === 0) continue;
      mitte.multiplyScalar(1 / n);
      weite = Math.max(weite, 2 * Math.hypot(mitte.x, mitte.z));
    }
    return weite;
  };
  const spitzenweiteOffen = spitzenweite(1);
  const spitzenweiteZu = spitzenweite(0);

  /* --- geschlossen: Bauhoehe, Breite, Oberkante --- */
  p.setOeffnung(0);
  let yMin = Infinity;
  let yMax = -Infinity;
  let breiteZu = 0;
  punkte(p.wurzel, (q) => {
    yMin = Math.min(yMin, q.y);
    yMax = Math.max(yMax, q.y);
    breiteZu = Math.max(breiteZu, 2 * Math.hypot(q.x, q.z));
  });

  /* --- Korb --- */
  const bahn = p.mittellinie(0);
  const yO = p.bolzenY;
  const yU = Math.min(...bahn.map((b) => b.y));
  const teile = dreiecke(p.wurzel);
  let brutto = 0;
  for (let i = 0; i < 4000; i++) {
    brutto += Math.PI * korbRadius(bahn, yU + ((yO - yU) * (i + 0.5)) / 4000) ** 2 * ((yO - yU) / 4000);
  }
  let imKorb = 0;
  for (let y = yU + raster / 2; y < yO; y += raster) {
    const R = korbRadius(bahn, y);
    for (let z = -R; z <= R; z += raster) {
      const halb = Math.sqrt(Math.max(0, R * R - z * z));
      if (halb < raster) continue;
      for (const [a, b] of strecken(teile, y, z)) {
        const u = Math.max(a, -halb);
        const w = Math.min(b, halb);
        if (w > u) imKorb += (w - u) * raster * raster;
      }
    }
  }

  /* --- Muendung und Einwurfschatten --- */
  /**
   * Senkrechte Projektion alles Eisens ueber der Ebene `yEbene` auf eine
   * Scheibe vom Radius `R` (m²). Schuettgut faellt senkrecht ein.
   */
  const einwurfschatten = (yEbene: number, R: number): number => {
    const oben = teile.filter((t) => Math.max(t[1]!, t[4]!, t[7]!) > yEbene);
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
          if (w1 * t[1]! + w2 * t[4]! + w3 * t[7]! <= yEbene) continue;
          getroffen = true;
          break;
        }
        if (getroffen) a += raster * raster;
      }
    }
    return a;
  };
  const R0 = korbRadius(bahn, yO);
  const muendung = Math.PI * R0 * R0;
  const schatten = einwurfschatten(yO, R0);
  /*
   * Die Bolzenebene ist bei den beiden Greifern NICHT dieselbe Stelle:
   * Der Fuenfschalengreifer haengt seine Schalen am Aequator (r 0,89), die
   * Sichelkralle an einem Zapfen von r 0,40, und ihr Korb bauscht sich erst
   * DARUNTER auf. Wer nur die Bolzenebene vergleicht, vergleicht bei der einen
   * die Muendung und bei der anderen den Hals. Deshalb zusaetzlich der
   * AEQUATOR — der weiteste waagrechte Schnitt des geschlossenen Korbs.
   */
  let aequator = 0;
  let aequatorY = yO;
  for (const b of bahn) {
    if (2 * b.r > aequator) {
      aequator = 2 * b.r;
      aequatorY = b.y;
    }
  }
  const schattenAequator = einwurfschatten(aequatorY, aequator / 2);

  /* --- Werkstoff im ganzen Greifer --- */
  let werkstoff = 0;
  const grobRaster = raster * 2;
  for (let y = yMin + grobRaster / 2; y < yMax; y += grobRaster) {
    for (let z = -breiteZu / 2; z <= breiteZu / 2; z += grobRaster) {
      for (const [a, b] of strecken(teile, y, z)) werkstoff += (b - a) * grobRaster * grobRaster;
    }
  }

  /* --- Greifsystem-Zahlen --- */
  const station = Math.round(p.stationen * 0.6);
  /**
   * Abstand zweier benachbarter Schalen an der Station, die `krallenKontakte`
   * abtastet — bei gegebenem SCHLIESSGRAD (1 = ganz zu), nicht Oeffnungsgrad.
   * Fuenf Schalen auf einem Kreis vom Radius r stehen 2·r·sin(π/5) auseinander.
   */
  const lueckeBei = (schliessgrad: number): number => {
    const r = p.mittellinie(1 - schliessgrad)[station]?.r ?? 0;
    return 2 * r * Math.sin(Math.PI / p.schalenzahl);
  };
  const bahnZu = p.mittellinie(0);
  const schalenluecke = lueckeBei(1);
  const korbRadiusMitte = korbRadius(bahnZu, (yO + yU) / 2);

  const zw = zaehlwerk(p.wurzel);
  return {
    name: p.name,
    netze: zw.netze,
    dreiecke: zw.dreiecke,
    grabtiefe,
    tiefsterPunkt,
    huellkreis,
    spitzenweiteOffen,
    spitzenweiteZu,
    breiteZu,
    bauhoehe: yMax - yMin,
    oberkante: yMax,
    bruttokorb: brutto,
    nettokorb: brutto - imKorb,
    muendung,
    schatten,
    werkstoff,
    bolzenY: p.bolzenY,
    sensorRadius: mittellinieTief + KORB_LUFT_UNTEN - SENSOR_UNTER_SPINNE,
    mittellinieTief,
    schalenluecke,
    lueckeFensterAuf: lueckeBei(0.6),
    lueckeFensterZu: lueckeBei(0.98),
    korbRadiusMitte,
    aequator,
    aequatorY,
    schattenAequator,
    tiefenweg,
  };
}

