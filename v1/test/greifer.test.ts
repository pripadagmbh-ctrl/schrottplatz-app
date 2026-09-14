/**
 * Der exportierbare Fünfzinken-Mehrschalengreifer, mechanisch nachgerechnet.
 *
 * Nicht „sieht gut aus", sondern: Ist es dieselbe Spinne wie im Spiel? Gehen
 * die fünf Schalen über den ganzen Weg aneinander vorbei? Liegen die Pivots auf
 * den Bolzen? Das sind die Fragen, die man einem Modell ansehen muss, bevor es
 * exportiert wird — im GLB sind sie nicht mehr zu beantworten.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  GELENKRING,
  GROESSTE_TIEFE,
  OFFEN,
  RING_Y,
  ROHRLAENGE,
  SCHALEN,
  SEGMENTE,
  ZU,
  clawSpan,
  clawTipDepth,
  schwenkFuer,
} from "../src/grapple/form";
import { baueGreifer, hebelarm, zylinderLaenge, zylinderNeigung } from "../src/grapple/rig";
import {
  CLAW_COUNT,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_SEGMENTS,
} from "../src/excavator/clawGeometry";

function finde(wurzel: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return wurzel.getObjectByName(name);
}

describe("Greifer — dieselbe Spinne wie im Spiel", () => {
  /*
   * Der wichtigste Test dieser Datei. Zwischen dem 12. und 13.09.2026 gab es
   * zeitweise zwei Greifer nebeneinander — den im Spiel und einen eigenen fürs
   * GLB —, und sie liefen auseinander, sobald an einem von beiden etwas
   * geändert wurde. Seither importiert das Exportmodell die Geometrie des
   * Spielmodells. Hier steht, dass es dabei bleibt.
   */
  it("teilt Zahl, Ring, Segmente und Öffnungsweite mit dem Baggermodell", () => {
    expect(SCHALEN).toBe(CLAW_COUNT);
    expect(GELENKRING).toBe(CLAW_RING_R);
    expect(SEGMENTE).toBe(CLAW_SEGMENTS);
    expect(OFFEN).toBe(CLAW_OPEN_SPLAY);
    expect(clawSpan(OFFEN)).toBeCloseTo(3.38, 2);
  });
});

describe("Greifer — Hierarchie und Pivots", () => {
  const g = baueGreifer();

  it("trägt die verabredeten Namen", () => {
    expect(g.wurzel.name).toBe("GRAPPLE_ROOT");
    for (const name of ["ADAPTER", "ROTATOR", "GRAPPLE_HEAD", "HYDRAULIC_LINES"]) {
      expect(finde(g.wurzel, name), name).toBeDefined();
    }
    for (let i = 1; i <= SCHALEN; i++) {
      const nr = String(i).padStart(2, "0");
      for (const name of [
        `SHELL_${nr}`,
        `SHELL_TIP_${nr}`,
        `SHELL_LUG_${nr}`,
        `CYLINDER_${nr}`,
        `CYL_BARREL_${nr}`,
        `CYL_ROD_${nr}`,
        `PIVOT_PIN_${nr}`,
        `WEAR_PLATE_${nr}_1`,
        `SHELL_SEG_${nr}_${SEGMENTE}`,
      ]) {
        expect(finde(g.wurzel, name), name).toBeDefined();
      }
    }
  });

  it("hängt mechanisch richtig: alles Drehbare unter dem Rotator", () => {
    /*
     * Die Wunschliste hatte Rotator, Kopf, Zylinder und Schalen nebeneinander.
     * So dreht der Rotator sich allein und lässt den Greifer stehen.
     */
    expect(finde(g.wurzel, "GRAPPLE_HEAD")!.parent?.name).toBe("ROTATOR");
    for (let i = 1; i <= SCHALEN; i++) {
      const nr = String(i).padStart(2, "0");
      expect(finde(g.wurzel, `SHELL_${nr}`)!.parent?.name).toBe("GRAPPLE_HEAD");
      expect(finde(g.wurzel, `CYLINDER_${nr}`)!.parent?.name).toBe("GRAPPLE_HEAD");
    }
    // Die Aufhaengung dreht NICHT mit — sie haengt am Stiel.
    expect(finde(g.wurzel, "ADAPTER")!.parent?.name).toBe("GRAPPLE_ROOT");
  });

  it("setzt jeden Schalen-Pivot auf seinen Gelenkbolzen", () => {
    for (let i = 0; i < SCHALEN; i++) {
      const nr = String(i + 1).padStart(2, "0");
      const schale = finde(g.wurzel, `SHELL_${nr}`)!;
      const bolzen = finde(g.wurzel, `PIVOT_PIN_${nr}`)!;
      expect(schale.position.distanceTo(bolzen.position), `SHELL_${nr}`).toBeLessThan(1e-9);
      expect(Math.hypot(schale.position.x, schale.position.z)).toBeCloseTo(GELENKRING, 6);
      expect(schale.position.y).toBeCloseTo(RING_Y, 6);
    }
  });

  it("braucht je Schale genau eine Rotationsspur", () => {
    /*
     * Die Segmentkette ist fest verbaut: Nur der Drehpunkt am Gelenkring wird
     * animiert, die sechs Segmente stehen unveraendert zu ihrem Vorgaenger.
     * Sonst braeuchte eine Schale sechs Spuren statt einer.
     */
    const vorher: number[] = [];
    for (let k = 1; k <= SEGMENTE; k++) {
      vorher.push(finde(g.wurzel, `SHELL_SEG_01_${k}`)!.rotation.x);
    }
    g.setOeffnung(1);
    for (let k = 1; k <= SEGMENTE; k++) {
      expect(finde(g.wurzel, `SHELL_SEG_01_${k}`)!.rotation.x).toBeCloseTo(vorher[k - 1]!, 9);
    }
    g.setOeffnung(0);
  });

  it("dreht den Rotator unabhängig von der Schalenbewegung", () => {
    g.setOeffnung(0.5);
    const vorher = g.schalen[0]!.gelenk.rotation.x;
    g.setDrehung(1.2);
    expect(g.rotator.rotation.y).toBeCloseTo(1.2, 6);
    expect(g.schalen[0]!.gelenk.rotation.x).toBeCloseTo(vorher, 9);
    g.setDrehung(0);
    g.setOeffnung(0);
  });
});

describe("Greifer — Bewegungsfreiheit der Schalen", () => {
  /**
   * Jede Schale hat ihren eigenen Sektor (360°/n). Bleibt sie über den ganzen
   * Weg darin, kann sie die Nachbarn nicht durchdringen — die Sektoren sind
   * disjunkt. Geprüft an den echten Eckpunkten aller Schalenteile, nicht an der
   * Mittellinie.
   */
  it("bleibt in jeder Stellung im eigenen Sektor", () => {
    const g = baueGreifer();
    const sektorHalb = Math.PI / SCHALEN;
    const v = new THREE.Vector3();
    let engste = Infinity;
    let stelle = 0;

    for (let s = 0; s <= 20; s++) {
      g.setOeffnung(s / 20);
      g.wurzel.updateMatrixWorld(true);
      for (const schale of g.schalen) {
        schale.gelenk.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
            const r = Math.hypot(v.x, v.z);
            /*
             * Nahe der Achse wird nicht geprueft. Dort laufen die fuenf
             * Spitzen im geschlossenen Zustand zusammen und ueberlappen sich
             * auf den letzten Zentimetern — bei fuenf Zinken von endlicher
             * Breite geht es gar nicht anders, und am Geraet schieben sie sich
             * dort aneinander vorbei. Ueberall sonst muessen die Sektoren
             * sauber getrennt bleiben.
             */
            if (r < 0.3) continue;
            let d = Math.atan2(v.x, v.z) - schale.winkel;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            const luft = sektorHalb - Math.abs(d);
            if (luft < engste) {
              engste = luft;
              stelle = s / 20;
            }
          }
        });
      }
    }
    expect(
      engste,
      `engste Stelle bei Öffnung ${stelle.toFixed(2)}: ` +
        `${((sektorHalb - engste) * (180 / Math.PI)).toFixed(1)}° von ` +
        `${((sektorHalb * 180) / Math.PI).toFixed(0)}° genutzt`
    ).toBeGreaterThan(0);
  });

  it("öffnet monoton — keine Stelle, an der die Schale zurückläuft", () => {
    let vorher = -Infinity;
    for (let s = 0; s <= 20; s++) {
      const weite = clawSpan(schwenkFuer(s / 20));
      expect(weite).toBeGreaterThan(vorher);
      vorher = weite;
    }
  });
});

describe("Greifer — Zylinder", () => {
  it("fährt zum SCHLIESSEN aus — die Kraft liegt beim Zugreifen", () => {
    /*
     * Der Punkt, auf den es bei einem Greifer ankommt: Ein Hydraulikzylinder
     * ist ausfahrend stärker, weil die volle Kolbenfläche wirkt. Schließen ist
     * die Richtung, für die Kraft gebraucht wird.
     *
     * Die Anlenkung vom 12.09. mittags fuhr zwar auch zum Schließen aus, hatte
     * aber bei 20 % Öffnung einen Totpunkt (Hebelarm 7 mm) und damit trotzdem
     * nur ein Fünftel des Öffnungsmoments. Beides zusammen wird hier geprüft.
     */
    const zu = zylinderLaenge(ZU);
    const offen = zylinderLaenge(OFFEN);
    expect(zu, "Schließen fährt ein statt aus").toBeGreaterThan(offen);
    expect(zu - offen, "Hub zu klein, die Stange wäre nicht zu sehen").toBeGreaterThan(0.15);
    expect(hebelarm(ZU), "Hebelarm geschlossen kleiner als offen").toBeGreaterThan(
      hebelarm(OFFEN)
    );
  });

  it("bleibt länger als sein Rohr — die Stange fährt nicht durch den Boden", () => {
    for (let s = 0; s <= 20; s++) {
      expect(zylinderLaenge(schwenkFuer(s / 20)), `Öffnung ${s / 20}`).toBeGreaterThan(ROHRLAENGE);
    }
  });

  it("steht steil, statt quer über dem Kopf zu liegen", () => {
    for (let s = 0; s <= 20; s++) {
      const grad = (zylinderNeigung(schwenkFuer(s / 20)) * 180) / Math.PI;
      expect(grad, `Öffnung ${s / 20}: ${grad.toFixed(0)}°`).toBeLessThan(20);
    }
  });

  it("hat einen Hebelarm, der über den ganzen Weg trägt", () => {
    /*
     * Kein Totpunkt: Ginge der Hebelarm irgendwo gegen null, stünde die Schale
     * dort fest, egal wie viel Druck anliegt.
     */
    for (let s = 0; s <= 20; s++) {
      expect(hebelarm(schwenkFuer(s / 20)), `Öffnung ${s / 20}`).toBeGreaterThan(0.1);
    }
  });
});

describe("Greifer — Maße", () => {
  it("öffnet 3,38 m und schließt auf der Achse", () => {
    expect(clawSpan(OFFEN)).toBeCloseTo(3.38, 2);
    expect(clawSpan(ZU), "die Spitzen treffen sich nicht in der Mitte").toBeLessThan(0.05);
  });

  it("meldet als größte Tiefe wirklich das Maximum über alle Stellungen", () => {
    for (let s = 0; s <= 20; s++) {
      expect(clawTipDepth(schwenkFuer(s / 20))).toBeLessThanOrEqual(GROESSTE_TIEFE + 1e-9);
    }
  });
});
