/**
 * Waechter fuer den Fuenfschalengreifer als zweite Greiferform (E-058).
 *
 * Geprueft wird gegen die Rechnung aus E-048 (`tools/greifer-gegenueber.ts`,
 * `tools/greifer-modelle.ts`) und gegen das GEBAUTE Modell — nicht gegen sich
 * selbst. Die Zahlen aus dem Log, die hier wieder herauskommen muessen:
 *
 *   Sensorradius   1,2289 m   bei gleichem Sensorsitz (1,50 m)
 *   Schalenluecke  0,5954 m
 *   Grabtiefe      2,7511 m   ueber den ganzen Weg
 *   Tiefenzuwachs  0,534 m    vom offenen zum tiefsten Stand
 *
 * Dazu die vier stillen Zahlen, die am Schliessweg haengen, und die Korbform,
 * die den Unterschied zur Sichelkralle ausmacht.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { FUENFSCHALEN, ANTEIL } from "../src/excavator/greiferFuenfschalen";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { baueGreifer } from "../src/fuenfschalen/rig";
import {
  MASS,
  OFFEN,
  SCHALEN_ABSCHNITTE,
  STEMPEL_AUGE,
  ZU,
  mittellinie,
  schwenkFuer,
  stoffe,
} from "../src/fuenfschalen/teile";

/** Korbradius auf Hoehe y — die Rechnung aus `tools/greifer-modelle.ts`. */
function korbRadius(bahn: Array<{ r: number; y: number }>, y: number): number {
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

describe("Fuenfschalengreifer — die Form am Bagger", () => {
  it("Kennzahlen stimmen mit dem Modell ueberein", () => {
    expect(FUENFSCHALEN.id).toBe("fuenfschalen");
    expect(FUENFSCHALEN.schalen).toBe(MASS.schalen);
    expect(FUENFSCHALEN.stationen).toBe(SCHALEN_ABSCHNITTE);
    expect(FUENFSCHALEN.zu).toBe(ZU);
    expect(FUENFSCHALEN.offen).toBe(OFFEN);
    // 1,6799 gegen 1,0055 rad — der 67 % laengere Schliessweg aus E-048
    expect(ANTEIL).toBeCloseTo(1.6707, 4);
  });

  it("punkt() ist die Mittellinie aus teile.ts — ueber den ganzen Weg", () => {
    const a = new THREE.Vector3();
    let groesste = 0;
    for (let i = 0; i <= 40; i++) {
      const schwenk = schwenkFuer(i / 40);
      const bahn = mittellinie(schwenk);
      for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
        FUENFSCHALEN.punkt(0, schwenk, k, a);
        groesste = Math.max(
          groesste,
          Math.abs(Math.hypot(a.x, a.z) - bahn[k]!.r),
          Math.abs(a.y - bahn[k]!.y)
        );
      }
    }
    expect(groesste).toBeLessThan(1e-12);
  });

  it("Sensorradius und Schalenluecke treffen die Rechnung aus E-048", () => {
    /*
     * E-048 hat 1,2289 m gerechnet: tiefste Mittellinie (2,5489) + 0,18 Luft
     * − 1,50 Sitz. Am Bagger sind es 1,2511 m, und der Unterschied ist
     * gemessen, nicht gewaehlt: Der Korbboden reicht bis an die GEZEICHNETEN
     * Zaehne (2,7511 m), die 0,202 m unter der Mittellinie haengen — mehr als
     * die 0,18 m Luft. Ohne die 2,2 cm blieb ein 6 cm dickes Blech auf dem
     * Beton liegen, obwohl die Zaehne daran standen
     * (`greiferwechsel.test.ts`).
     */
    expect(FUENFSCHALEN.sensorRadius).toBeCloseTo(1.2511, 4);
    expect(2.5489 + 0.18 - 1.5, "die Rechnung aus E-048").toBeCloseTo(1.2289, 4);
    expect(FUENFSCHALEN.schalenluecke).toBeCloseTo(0.5954, 4);
    expect(FUENFSCHALEN.sensorSitz, "Sensorsitz wie bei der Sichelkralle").toBe(1.5);
  });

  it("die Sensorkugel umschliesst den ganzen geschlossenen Korb", () => {
    /*
     * Der Grund, warum der Sensorsitz NICHT mitgewandert ist (E-048 hatte es
     * vorgeschlagen). Gemessen: vom Sitz auf −1,50 reicht der Korb 1,049 m
     * weit, die Kugel misst 1,2289 m. Von der Korbmitte (−2,04) aus waeren es
     * 1,025 m — die dort vorgeschlagenen 0,689 m haetten den Korbrand um
     * 34 cm abgeschnitten.
     */
    /*
     * Die Huelle des Korbs: die geschlossene Mittellinie und dazu der tiefste
     * Punkt, den die Mittellinie ueber den ganzen Weg erreicht (2,5489 m —
     * derselbe, aus dem der Sensorradius kommt).
     */
    let tiefste = 0;
    for (let i = 0; i <= 200; i++) {
      const w = ZU + ((OFFEN - ZU) * i) / 200;
      for (const p of mittellinie(w)) tiefste = Math.max(tiefste, -p.y);
    }
    expect(tiefste, "tiefste Mittellinie ueber den Weg (E-048)").toBeCloseTo(2.5489, 4);
    const huelle = [...mittellinie(ZU), { r: 0, y: -tiefste }];
    const mitte = (STEMPEL_AUGE.y - tiefste) / 2;
    let vonOben = 0;
    let vonMitte = 0;
    for (const p of huelle) {
      vonOben = Math.max(vonOben, Math.hypot(p.r, p.y + FUENFSCHALEN.sensorSitz));
      vonMitte = Math.max(vonMitte, Math.hypot(p.r, p.y - mitte));
    }
    expect(vonOben).toBeCloseTo(1.049, 2);
    // Der Korbboden geht noch 2,2 cm tiefer als die Mittellinie — bis an die
    // Zaehne. Die Kugel deckt beides.
    expect(FUENFSCHALEN.sensorRadius).toBeGreaterThan(FUENFSCHALEN.maxTiefe - 1.5 - 1e-9);
    expect(FUENFSCHALEN.sensorRadius, "die Kugel laesst den Korb aussen vor").toBeGreaterThan(
      vonOben
    );
    expect(mitte).toBeCloseTo(-2.041, 3);
    expect(vonMitte, "von der Korbmitte aus braeuchte es mehr als 0,689 m").toBeGreaterThan(0.689);
  });

  it("die Grabtiefe kommt vom gezeichneten Zahn", () => {
    // Gegenprobe am gebauten Modell: Unterkante des Knotens `07_ZAHN`.
    const g = baueGreifer(stoffe());
    const zaehne: THREE.Object3D[] = [];
    g.wurzel.traverse((n) => {
      if (n.name === "07_ZAHN") zaehne.push(n);
    });
    expect(zaehne.length, "fuenf Zaehne").toBe(5);
    const v = new THREE.Vector3();
    const amModell = (t: number): number => {
      g.setOeffnung(t);
      g.wurzel.updateMatrixWorld(true);
      let tief = 0;
      for (const z of zaehne)
        z.traverse((n) => {
          const m = n as THREE.Mesh;
          if (!m.isMesh) return;
          const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let k = 0; k < pos.count; k++) {
            v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
            tief = Math.max(tief, -v.y);
          }
        });
      return tief;
    };
    let groesste = 0;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      groesste = Math.max(groesste, Math.abs(FUENFSCHALEN.tiefe(schwenkFuer(t)) - amModell(t)));
    }
    /*
     * 0,05 mm Toleranz, nicht null: `rig.stelleSchale` rundet den
     * Schwenkwinkel auf 1e−5 rad, damit keine Fliesskommareste ins glTF
     * wandern. Auf 2,5 m Hebel sind das bis zu 0,025 mm; gemessen bleiben
     * 0,004 mm.
     */
    expect(groesste, "gerechnete gegen gezeichnete Tiefe (m)").toBeLessThan(5e-5);

    // Die Zahlen aus E-048
    expect(FUENFSCHALEN.maxTiefe).toBeCloseTo(2.7511, 4);
    expect(FUENFSCHALEN.tiefe(schwenkFuer(1)), "offen").toBeCloseTo(2.2173, 3);
    expect(FUENFSCHALEN.tiefe(ZU), "geschlossen").toBeCloseTo(2.4987, 3);
    expect(FUENFSCHALEN.maxTiefe - FUENFSCHALEN.tiefe(schwenkFuer(1))).toBeCloseTo(0.534, 3);

    // Und der Zahn ist wirklich das Tiefste am ganzen Greifer.
    let alles = 0;
    for (let i = 0; i <= 20; i++) {
      g.setOeffnung(i / 20);
      g.wurzel.updateMatrixWorld(true);
      g.wurzel.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
          alles = Math.max(alles, -v.y);
        }
      });
    }
    expect(FUENFSCHALEN.maxTiefe, "etwas haengt tiefer als der Zahn").toBeGreaterThanOrEqual(
      alles - 0.001
    );
  }, 60000);

  it("der Korb ist der gemessene, nicht der Kegel der Sichelkralle", () => {
    /*
     * Die Tabelle aus E-048, Zeile „Fuenfschalen echt". `imKorb` muss diese
     * Radien plus 0,14 m Luft zulassen — und der Kegel der Sichelkralle
     * duerfte hier gerade NICHT herauskommen (auf 60 % Hoehe 0,412 statt
     * 0,771 m).
     */
    const bahn = mittellinie(ZU);
    const yO = Math.max(...bahn.map((p) => p.y));
    const yU = Math.min(...bahn.map((p) => p.y));
    const erwartet = [0.89, 0.89, 0.853, 0.771, 0.617];
    const p = new THREE.Vector3();
    for (let i = 0; i < erwartet.length; i++) {
      const anteil = i * 0.2;
      const y = yO + (yU - yO) * anteil;
      expect(korbRadius(bahn, y), `Korbradius auf ${anteil * 100} %`).toBeCloseTo(
        erwartet[i]!,
        3
      );
      // knapp innerhalb der Luft: drin. Deutlich ausserhalb: draussen.
      expect(FUENFSCHALEN.imKorb(p.set(erwartet[i]! + 0.1, y, 0), ZU)).toBe(true);
      expect(FUENFSCHALEN.imKorb(p.set(erwartet[i]! + 0.25, y, 0), ZU)).toBe(false);
    }
    // Der Kegel der Sichelkralle wuerde auf 60 % Hoehe bei 0,412 m aufhoeren.
    const y60 = yO + (yU - yO) * 0.6;
    expect(FUENFSCHALEN.imKorb(p.set(0.6, y60, 0), ZU), "der Kegel waere hier zu Ende").toBe(true);
  });

  it("kein Greifen durch die Luft: 1,40 m neben der Achse bleibt draussen", () => {
    /*
     * Derselbe Fall wie in `test/greiffenster.test.ts` — dort am ganzen
     * Bagger, hier an der reinen Form, ueber das ganze Greiffenster
     * (Schliessgrad 0,60 bis 0,98, also Oeffnung 0,40 bis 0,02).
     */
    const p = new THREE.Vector3();
    for (let i = 0; i <= 20; i++) {
      const schwenk = schwenkFuer(0.4 * (1 - i / 20));
      for (let y = -1; y > -3.2; y -= 0.05) {
        expect(
          FUENFSCHALEN.imKorb(p.set(1.4, y, 0), schwenk),
          `1,40 m neben der Achse auf ${y.toFixed(2)} m`
        ).toBe(false);
      }
    }
  });

  it("die vier Zahlen des Schliessens sind Anteile, keine neuen Werte", () => {
    expect(FUENFSCHALEN.nachdrueckReserve).toBeCloseTo(0.635, 3);
    expect(FUENFSCHALEN.weichReserve).toBeCloseTo(1.604, 3);
    expect(FUENFSCHALEN.ladungOffen).toBeCloseTo(0.835, 3);
    // jede ist die der Sichelkralle mal dem Wegverhaeltnis
    expect(FUENFSCHALEN.nachdrueckReserve / SICHELKRALLE.nachdrueckReserve).toBeCloseTo(ANTEIL, 9);
    expect(FUENFSCHALEN.weichReserve / SICHELKRALLE.weichReserve).toBeCloseTo(ANTEIL, 9);
    expect(FUENFSCHALEN.ladungOffen / SICHELKRALLE.ladungOffen).toBeCloseTo(ANTEIL, 9);
    /*
     * Und die Rate: Der Befehl laeuft ueber CLOSE_TIME = 0,4 s von offen nach
     * zu. Wer langsamer ist als das, hinkt ueber den ganzen Weg hinterher.
     */
    const CLOSE_TIME = 0.4;
    const verlangt = (FUENFSCHALEN.offen - FUENFSCHALEN.zu) / CLOSE_TIME;
    expect(verlangt).toBeCloseTo(4.2, 2);
    expect(FUENFSCHALEN.rate, "haengt dem Befehl hinterher").toBeGreaterThan(verlangt);
    // gleicher Spielraum wie bei der Sichelkralle
    const spielraumSichel =
      SICHELKRALLE.rate / ((SICHELKRALLE.offen - SICHELKRALLE.zu) / CLOSE_TIME);
    expect(FUENFSCHALEN.rate / verlangt).toBeCloseTo(spielraumSichel, 9);
    expect(spielraumSichel).toBeCloseTo(1.591, 3);
  });

  it("baue() liefert den zusammengelegten Greifer mit 58 Netzen", () => {
    const bau = FUENFSCHALEN.baue();
    let netze = 0;
    bau.gruppe.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) netze++;
    });
    expect(netze, "E-053: 217 → 58 Netze").toBe(58);

    // Jede Schale bewegt sich einzeln, und keine zwei bewegen dasselbe Netz.
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
    const stelle = (w: (i: number) => number): void => {
      for (let i = 0; i < MASS.schalen; i++) bau.setWinkel(i, w(i));
      bau.nachfuehren();
    };
    stelle(() => ZU);
    const ruhe = posen();
    const bewegt: Set<number>[] = [];
    for (let i = 0; i < MASS.schalen; i++) {
      stelle((k) => (k === i ? OFFEN : ZU));
      const jetzt = posen();
      const menge = new Set<number>();
      for (let k = 0; k < jetzt.length; k++) if (jetzt[k] !== ruhe[k]) menge.add(k);
      expect(menge.size, `Schale ${i} bewegt kein einziges Netz`).toBeGreaterThan(1);
      bewegt.push(menge);
    }
    for (let i = 0; i < MASS.schalen; i++) {
      for (let j = i + 1; j < MASS.schalen; j++) {
        for (const k of bewegt[i]!) {
          expect(bewegt[j]!.has(k), `Schale ${i} und ${j} bewegen dasselbe Netz`).toBe(false);
        }
      }
    }
  }, 60000);
});
