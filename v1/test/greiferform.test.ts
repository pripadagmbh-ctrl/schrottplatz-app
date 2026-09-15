/**
 * Waechter fuer die Greiferform-Schnittstelle (E-057, 15.09.2026).
 *
 * Der Umbau legt alles, was am Greifer haengt, hinter `Greiferform`. Die
 * haerteste Bedingung dabei: Die SICHELKRALLE ist danach Zeichen fuer Zeichen
 * dieselbe. Nicht „aehnlich" — identisch.
 *
 * Hier steht deshalb jede Zahl der Form NEBEN der Rechnung, aus der sie bis
 * zum 15.09.2026 kam — die alten Formeln sind unten ausgeschrieben, nicht aus
 * der Form importiert. Ein Vergleich mit sich selbst waere kein Waechter.
 * Verglichen wird bis 1e−9; wo die Rechnung wortgleich ist, kommt ohnehin
 * dieselbe Fliesskommazahl heraus.
 *
 * Der Abdruck des BEWEGTEN Greifers (Pose, Kollider, Korbgitter ueber 300
 * Schritte am kopflosen Bagger) steht daneben als Werkzeug:
 * `tools/greifer-abdruck.ts`. Gemessen vor und nach dem Umbau war der
 * Unterschied in allen 10.442 Werten exakt null.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_MAX_DEPTH,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  NACHDRUECK_RESERVE,
  WEICH_RESERVE,
  clawPoint,
  clawTipDepth,
} from "../src/excavator/clawGeometry";
import { SICHELKRALLE, sensorRadiusVon, schalenlueckeVon } from "../src/excavator/greiferform";

/** Bis hierher gilt „dieselbe Zahl". */
const GENAU = 1e-9;

/* --------------------------------------------------------------------------
 * Die alten Rechnungen, wortwoertlich wie sie bis zum 15.09.2026 im Quelltext
 * standen. Sie sind hier ABSICHTLICH abgeschrieben: Der Waechter soll gegen
 * den alten Stand pruefen, nicht gegen den neuen.
 * ------------------------------------------------------------------------ */

/** `gripSystem.SENSOR_RADIUS`, Fassung vom 15.09.2026 (E-030). */
function altSensorRadius(): number {
  const p = new THREE.Vector3();
  let tiefste = 0;
  for (let i = 0; i <= 200; i++) {
    const splay = CLAW_CLOSED_SPLAY + ((CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * i) / 200;
    tiefste = Math.max(tiefste, -clawPoint(0, splay, CLAW_SEGMENTS, p).y);
  }
  return tiefste + 0.18 - 1.5;
}

/** `gripSystem.SCHALENLUECKE`, Fassung vom 15.09.2026 (E-043). */
function altSchalenluecke(): number {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const station = Math.round(CLAW_SEGMENTS * 0.6);
  clawPoint(0, CLAW_CLOSED_SPLAY, station, a);
  clawPoint((1 / CLAW_COUNT) * Math.PI * 2, CLAW_CLOSED_SPLAY, station, b);
  return a.distanceTo(b);
}

/** `Excavator.isInsideGrapple`, Fassung vom 15.09.2026 — der gerade Kegel. */
function altImKorb(p: THREE.Vector3, splay: number): boolean {
  const tip = new THREE.Vector3();
  clawPoint(0, splay, CLAW_SEGMENTS, tip);
  const tipY = tip.y;
  const tipR = Math.max(tip.z, 0);
  if (p.y > CLAW_RING_Y + 0.22 || p.y < tipY - 0.18) return false;
  const t = THREE.MathUtils.clamp((CLAW_RING_Y - p.y) / Math.max(CLAW_RING_Y - tipY, 0.01), 0, 1);
  const r = THREE.MathUtils.lerp(CLAW_RING_R, tipR, t) + 0.14;
  return Math.hypot(p.x, p.z) <= r;
}

describe("Greiferform — die Sichelkralle bleibt, was sie war", () => {
  it("Kennzahlen kommen unveraendert aus clawGeometry", () => {
    expect(SICHELKRALLE.id).toBe("sichel");
    expect(SICHELKRALLE.schalen).toBe(CLAW_COUNT);
    expect(SICHELKRALLE.stationen).toBe(CLAW_SEGMENTS);
    expect(SICHELKRALLE.zu).toBe(CLAW_CLOSED_SPLAY);
    expect(SICHELKRALLE.offen).toBe(CLAW_OPEN_SPLAY);
    expect(SICHELKRALLE.nachdrueckReserve).toBe(NACHDRUECK_RESERVE);
    expect(SICHELKRALLE.weichReserve).toBe(WEICH_RESERVE);
    expect(SICHELKRALLE.maxTiefe).toBe(CLAW_MAX_DEPTH);
  });

  it("die Zahlen aus dem Spiel stehen unveraendert da", () => {
    // Werte, die vor E-057 als Konstanten im Bagger standen. Wer sie aendert,
    // aendert das Spielgefuehl des Prototyps — Projektregel 2.
    expect(SICHELKRALLE.rate, "CLAW_RATE").toBe(4.0);
    expect(SICHELKRALLE.ladungOffen, "wie weit Ladung offen haelt").toBe(0.5);
    expect(SICHELKRALLE.kolliderRadius, "Kapselradius der Krallen").toBe(0.09);
    // GRAPPLE_LINK + 0.2 + PALM_TO_SENSOR = 0,55 + 0,20 + 0,75
    expect(SICHELKRALLE.sensorSitz, "Sensorsitz unter der Spinne").toBe(1.5);
  });

  it("Sensorradius und Schalenluecke sind dieselbe Rechnung wie vorher", () => {
    expect(Math.abs(SICHELKRALLE.sensorRadius - altSensorRadius())).toBeLessThan(GENAU);
    expect(Math.abs(SICHELKRALLE.schalenluecke - altSchalenluecke())).toBeLessThan(GENAU);
    // und die Zahlen, die im Log stehen (E-030, E-043, E-048)
    expect(SICHELKRALLE.sensorRadius).toBeCloseTo(1.5554, 4);
    expect(SICHELKRALLE.schalenluecke).toBeCloseTo(0.6293, 4);
  });

  it("die gemeinsame Rechnung liefert fuer die Sichelkralle dasselbe", () => {
    // `sensorRadiusVon`/`schalenlueckeVon` sind die Formeln, die ab jetzt fuer
    // JEDE Form gelten. Auf die Sichelkralle angewandt muessen sie ihren
    // eigenen alten Wert treffen.
    expect(Math.abs(sensorRadiusVon(SICHELKRALLE) - altSensorRadius())).toBeLessThan(GENAU);
    expect(Math.abs(schalenlueckeVon(SICHELKRALLE) - altSchalenluecke())).toBeLessThan(GENAU);
  });

  it("punkt() ist clawPoint — ueber den ganzen Weg, alle Stationen, rundum", () => {
    const a1 = new THREE.Vector3();
    const a2 = new THREE.Vector3();
    let groesste = 0;
    for (let i = 0; i <= 60; i++) {
      const splay = CLAW_CLOSED_SPLAY + ((CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * i) / 60;
      for (let k = 0; k <= CLAW_SEGMENTS; k++) {
        for (let c = 0; c < CLAW_COUNT; c++) {
          const winkel = (c / CLAW_COUNT) * Math.PI * 2;
          SICHELKRALLE.punkt(winkel, splay, k, a1);
          clawPoint(winkel, splay, k, a2);
          groesste = Math.max(groesste, a1.distanceTo(a2));
        }
      }
    }
    expect(groesste).toBeLessThan(GENAU);
  });

  it("tiefe() ist clawTipDepth — ueber den ganzen Weg", () => {
    let groesste = 0;
    for (let i = 0; i <= 200; i++) {
      const splay = (CLAW_OPEN_SPLAY * i) / 200;
      groesste = Math.max(groesste, Math.abs(SICHELKRALLE.tiefe(splay) - clawTipDepth(splay)));
    }
    expect(groesste).toBeLessThan(GENAU);
  });

  it("imKorb() ist der alte Kegel — 33.000 Punkte, vier Stellungen", () => {
    const p = new THREE.Vector3();
    let geprueft = 0;
    let drin = 0;
    for (const t of [0, 0.35, 0.7, 1]) {
      const splay = CLAW_CLOSED_SPLAY + (CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * t;
      for (let iy = 0; iy <= 40; iy++) {
        const y = -0.4 - (iy / 40) * 3.2;
        for (let ir = 0; ir <= 20; ir++) {
          const r = (ir / 20) * 2.2;
          for (let ia = 0; ia < 10; ia++) {
            const a = (ia / 10) * Math.PI * 2;
            p.set(Math.sin(a) * r, y, Math.cos(a) * r);
            const neu = SICHELKRALLE.imKorb(p, splay);
            expect(neu).toBe(altImKorb(p, splay));
            geprueft++;
            if (neu) drin++;
          }
        }
      }
    }
    // Der Waechter muss auch etwas GETROFFEN haben: Waere `imKorb` immer
    // falsch, ginge der Vergleich oben trivial durch.
    expect(geprueft).toBeGreaterThan(30000);
    expect(drin, "kein einziger Punkt lag im Korb — der Test prueft nichts").toBeGreaterThan(1000);
  });

  it("baue() liefert dieselbe Spinne wie bisher", () => {
    const bau = SICHELKRALLE.baue();
    let netze = 0;
    bau.gruppe.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) netze++;
    });
    // 105 Netze — die Zahl aus `tools/greifer-gegenueber.ts` (E-048).
    expect(netze).toBe(105);

    /*
     * Jede Schale muss sich EINZELN bewegen lassen — daran haengt das
     * ungleichmaessige Schliessen (eine Kralle bleibt stehen, der Rest geht
     * weiter zu). Geprueft wird am gezeichneten Modell: Welche Netze wandern,
     * wenn nur Schale i einen anderen Winkel bekommt?
     */
    const posen = (): string[] => {
      bau.gruppe.updateWorldMatrix(true, true);
      const v = new THREE.Vector3();
      const raus: string[] = [];
      bau.gruppe.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        m.getWorldPosition(v);
        raus.push(`${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`);
      });
      return raus;
    };
    const stelle = (winkel: (i: number) => number): void => {
      for (let i = 0; i < CLAW_COUNT; i++) bau.setWinkel(i, winkel(i));
      bau.nachfuehren();
    };
    stelle(() => CLAW_CLOSED_SPLAY);
    const ruhe = posen();
    const bewegt: Set<number>[] = [];
    for (let i = 0; i < CLAW_COUNT; i++) {
      stelle((k) => (k === i ? CLAW_OPEN_SPLAY : CLAW_CLOSED_SPLAY));
      const jetzt = posen();
      const menge = new Set<number>();
      for (let k = 0; k < jetzt.length; k++) if (jetzt[k] !== ruhe[k]) menge.add(k);
      expect(menge.size, `Schale ${i} bewegt kein einziges Netz`).toBeGreaterThan(5);
      bewegt.push(menge);
    }
    // Keine zwei Schalen bewegen dasselbe Netz — sonst haengen sie aneinander.
    for (let i = 0; i < CLAW_COUNT; i++) {
      for (let j = i + 1; j < CLAW_COUNT; j++) {
        for (const k of bewegt[i]!) {
          expect(bewegt[j]!.has(k), `Schale ${i} und ${j} bewegen dasselbe Netz`).toBe(false);
        }
      }
    }
  });
});
