/**
 * Der Mehrschalengreifer, mechanisch nachgerechnet.
 *
 * Nicht „sieht gut aus", sondern: Gehen die Schalen über den ganzen Weg
 * aneinander vorbei? Steht der Zylinder frei? Ist der Hub plausibel? Liegen die
 * Pivots dort, wo die Bolzen sind? Das sind die Fragen, die man einem Modell
 * ansehen muss, bevor es exportiert wird — im GLB sind sie nicht mehr zu
 * beantworten.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  BOLZENKREIS,
  KOPFHOEHE,
  MASSSTAB,
  OFFEN,
  ROHRLAENGE,
  SCHALEN,
  SPITZEN_FREIGANG,
  ZU,
  durchmesser,
  mittellinie,
  schwenkFuer,
  spitzenweite,
  tiefe,
} from "../src/grapple/form";
import { baueGreifer, zylinderLaenge, zylinderNeigung } from "../src/grapple/rig";

/** Sektor je Schale: bei fünf Schalen 72°, also 36° zu jeder Seite. */
const SEKTOR_HALB = Math.PI / SCHALEN;

function finde(wurzel: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return wurzel.getObjectByName(name);
}

describe("Greifer — Hierarchie und Pivots", () => {
  const g = baueGreifer();

  it("trägt die verabredeten Namen", () => {
    for (const name of ["GRAPPLE_ROOT", "ADAPTER", "ROTATOR", "GRAPPLE_HEAD", "HYDRAULIC_LINES"]) {
      expect(finde(g.wurzel, name) ?? (g.wurzel.name === name ? g.wurzel : undefined), name)
        .toBeDefined();
    }
    for (let i = 1; i <= SCHALEN; i++) {
      const nr = String(i).padStart(2, "0");
      for (const name of [
        `SHELL_${nr}`,
        `SHELL_BODY_${nr}`,
        `WEAR_PLATE_${nr}`,
        `SHELL_TIP_${nr}`,
        `SHELL_LUG_${nr}`,
        `CYLINDER_${nr}`,
        `CYL_BARREL_${nr}`,
        `CYL_ROD_${nr}`,
        `PIVOT_PIN_${nr}`,
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
    const kopf = finde(g.wurzel, "GRAPPLE_HEAD")!;
    expect(kopf.parent?.name).toBe("ROTATOR");
    for (let i = 1; i <= SCHALEN; i++) {
      const nr = String(i).padStart(2, "0");
      expect(finde(g.wurzel, `SHELL_${nr}`)!.parent?.name).toBe("GRAPPLE_HEAD");
      expect(finde(g.wurzel, `CYLINDER_${nr}`)!.parent?.name).toBe("GRAPPLE_HEAD");
    }
    // Der Adapter dreht NICHT mit — er hängt am Stiel.
    expect(finde(g.wurzel, "ADAPTER")!.parent?.name).toBe("GRAPPLE_ROOT");
  });

  it("setzt jeden Schalen-Pivot auf seinen Gelenkbolzen", () => {
    for (let i = 0; i < SCHALEN; i++) {
      const nr = String(i + 1).padStart(2, "0");
      const schale = finde(g.wurzel, `SHELL_${nr}`)!;
      const bolzen = finde(g.wurzel, `PIVOT_PIN_${nr}`)!;
      expect(schale.position.distanceTo(bolzen.position), `SHELL_${nr} sitzt nicht auf dem Bolzen`)
        .toBeLessThan(1e-9);
      expect(Math.hypot(schale.position.x, schale.position.z)).toBeCloseTo(BOLZENKREIS, 6);
      expect(schale.position.y).toBeCloseTo(-KOPFHOEHE, 6);
    }
  });

  it("dreht den Rotator unabhängig von der Schalenbewegung", () => {
    g.setOeffnung(0.5);
    const vorher = g.schalen[0]!.gelenk.rotation.x;
    g.setDrehung(1.2);
    expect(g.rotator.rotation.y).toBeCloseTo(1.2, 6);
    expect(g.schalen[0]!.gelenk.rotation.x).toBeCloseTo(vorher, 9);
    g.setDrehung(0);
  });
});

describe("Greifer — Bewegungsfreiheit der Schalen", () => {
  /**
   * Jede Schale hat ihren eigenen Sektor (360°/n). Bleibt sie über den ganzen
   * Weg darin, kann sie die Nachbarn nicht durchdringen — die Sektoren sind
   * disjunkt.
   *
   * Geprüft wird an den echten Eckpunkten aller Schalenteile, nicht an der
   * Mittellinie: Haut, Wangen, Verschleißmesser und Zahn zählen mit. Der Zahn
   * ist dabei der kritische: Er ist das Breiteste ganz nah an der Achse.
   */
  it("bleibt in jeder Stellung im eigenen Sektor", () => {
    const g = baueGreifer();
    const v = new THREE.Vector3();
    let engste = Infinity;
    let engsteStellung = 0;

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
            if (r < 1e-4) continue; // exakt auf der Achse: kein Winkel definiert
            let d = Math.atan2(v.x, v.z) - schale.winkel;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            const luft = SEKTOR_HALB - Math.abs(d);
            if (luft < engste) {
              engste = luft;
              engsteStellung = s / 20;
            }
          }
        });
      }
    }
    expect(
      engste,
      `engste Stelle bei Öffnung ${engsteStellung.toFixed(2)}: ` +
        `${((SEKTOR_HALB - engste) * (180 / Math.PI)).toFixed(1)}° von ` +
        `${((SEKTOR_HALB * 180) / Math.PI).toFixed(0)}° genutzt`
    ).toBeGreaterThan(0);
  });

  it("hält die Zähne auf Abstand, statt sie ineinanderfahren zu lassen", () => {
    /*
     * Der Grund, warum der Anschlag bei 8° liegt und nicht bei den 4,6° aus
     * dem Datenblatt: Überfährt eine Spitze die Drehachse, landet sie im
     * Sektor ihres Gegenübers und steckt dort fest.
     */
    const spitzen = mittellinie(ZU);
    const r = spitzen[spitzen.length - 1]!.r;
    expect(r, "Spitzen überfahren die Drehachse").toBeGreaterThan(SPITZEN_FREIGANG);
    expect(r, "unnötig viel Loch in der Mitte").toBeLessThan(0.12);
  });

  it("schwenkt monoton auf — keine Stelle, an der die Schale zurückläuft", () => {
    let vorher = -Infinity;
    for (let s = 0; s <= 20; s++) {
      const weite = spitzenweite(schwenkFuer(s / 20));
      expect(weite).toBeGreaterThan(vorher);
      vorher = weite;
    }
  });
});

describe("Greifer — Zylinder", () => {
  it("fährt beim Öffnen aus und beim Schließen ein", () => {
    const zu = zylinderLaenge(ZU);
    const offen = zylinderLaenge(OFFEN);
    expect(offen).toBeGreaterThan(zu);
    expect(offen - zu, "Hub zu klein, die Stange wäre nicht zu sehen").toBeGreaterThan(0.15);
  });

  it("bleibt länger als sein Rohr — die Stange fährt nicht durch den Boden", () => {
    for (let s = 0; s <= 20; s++) {
      const l = zylinderLaenge(schwenkFuer(s / 20));
      expect(l, `Öffnung ${s / 20}`).toBeGreaterThan(ROHRLAENGE);
    }
  });

  it("steht steil, statt quer über dem Kopf zu liegen", () => {
    for (let s = 0; s <= 20; s++) {
      const grad = (zylinderNeigung(schwenkFuer(s / 20)) * 180) / Math.PI;
      expect(grad, `Öffnung ${s / 20}: ${grad.toFixed(0)}°`).toBeLessThan(25);
    }
  });

  it("läuft frei neben dem Kopf, nicht durch ihn hindurch", () => {
    /*
     * Der Grundkörper ist ein Kegelstumpf von 0,74 auf 0,66 Bolzenkreisradien.
     * Die Verbindungslinie Aufnahme–Lasche muss überall außerhalb davon liegen,
     * sonst steckt der Zylinder im Guss und ist im Bild nicht zu sehen.
     */
    const g = baueGreifer();
    const oben = -0.28 * KOPFHOEHE;
    const kopfRadius = (y: number): number => {
      if (y > oben) return 0.42 * BOLZENKREIS;
      const t = Math.min(1, Math.max(0, (y - oben) / (-KOPFHOEHE - oben)));
      return (0.74 + (0.66 - 0.74) * t) * BOLZENKREIS;
    };
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let s = 0; s <= 10; s++) {
      g.setOeffnung(s / 10);
      g.kopf.updateMatrixWorld(true);
      for (const z of g.zylinder) {
        a.set(0, 0, 0).applyMatrix4(z.gelenk.matrixWorld);
        b.set(0, -1, 0)
          .multiplyScalar(zylinderLaenge(schwenkFuer(s / 10)))
          .applyMatrix4(z.gelenk.matrixWorld);
        for (let k = 0; k <= 12; k++) {
          p.lerpVectors(a, b, k / 12);
          const r = Math.hypot(p.x, p.z);
          expect(
            r - kopfRadius(p.y),
            `Zylinder steckt im Kopf (Öffnung ${s / 10})`
          ).toBeGreaterThan(0.03);
        }
      }
    }
  });
});

describe("Greifer — Maße gegen das Datenblatt", () => {
  /*
   * MG4.1-800-HO5, im Spiel um ein Viertel vergrößert. Die Vierschalen-
   * ausführung weicht bewusst an einer Stelle ab: Sie kann nicht so weit
   * schließen, also ist sie geschlossen etwas höher.
   */
  const soll = (m: number): number => m * MASSSTAB;

  /** Wie weit ein Maß vom Datenblatt abweichen darf (m). */
  const TOLERANZ = 0.14;
  const trifft = (ist: number, sollWert: number, was: string): void => {
    expect(
      Math.abs(ist - sollWert),
      `${was}: ${ist.toFixed(2)} m statt ${sollWert.toFixed(2)} m`
    ).toBeLessThan(TOLERANZ);
  };

  it("trifft die offene Stellung", () => {
    trifft(durchmesser(OFFEN), soll(2.409), "größter Durchmesser offen (ØD)");
    trifft(spitzenweite(OFFEN), soll(2.225), "Spitzenweite offen (d)");
    // `tiefe` misst bereits ab dem Adapter — die Kopfhoehe steckt darin.
    trifft(tiefe(OFFEN), soll(2.363), "Gesamthöhe offen (A)");
  });

  it("trifft die geschlossene Breite", () => {
    trifft(durchmesser(ZU), soll(1.514), "Durchmesser geschlossen (ØC)");
  });

  it("ist geschlossen kürzer als offen", () => {
    // Eine Faust ist kürzer als eine ausgestreckte Hand — geometrisch zwingend,
    // weil die Spitzen geschlossen den Bolzenkreis nach innen überbrücken.
    expect(tiefe(ZU)).toBeLessThan(tiefe(OFFEN));
  });
});
