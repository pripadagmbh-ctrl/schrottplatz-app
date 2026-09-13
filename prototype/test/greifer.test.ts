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
  KOPF_KERN,
  KOPF_OBERKANTE,
  TASCHE_MITTE,
  TASCHE_RADIUS,
  ZYLINDER_RADIUS,
  rippenRadius,
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
import {
  baueGreifer,
  hebelarm,
  kraftverhaeltnis,
  zylinderLaenge,
  zylinderNeigung,
} from "../src/grapple/rig";

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
  it("hat seine Kraft beim Schließen, nicht beim Öffnen", () => {
    /*
     * Der Punkt, auf den es bei einem Greifer ankommt (Ansage 13.09.2026).
     * Geschlossen wird durch Einfahren — bei versenkten Zylindern geht es
     * geometrisch nicht anders —, und einfahrend wirkt nur die Ringfläche.
     * Ausgeglichen wird das über den Hebelarm, der zum Schließen hin wächst.
     */
    expect(hebelarm(ZU), "Hebelarm geschlossen kleiner als offen").toBeGreaterThan(
      hebelarm(OFFEN)
    );
    let vorher = Infinity;
    for (let s = 0; s <= 20; s++) {
      const h = hebelarm(schwenkFuer(s / 20));
      expect(h, `Hebelarm wächst beim Öffnen (Stellung ${s / 20})`).toBeLessThan(vorher);
      vorher = h;
    }
    expect(kraftverhaeltnis(), "Schließmoment unter dem Öffnungsmoment").toBeGreaterThan(1.2);
  });

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

  it("liegt in seiner Frästasche, nicht im Guss und nicht daneben", () => {
    /*
     * Seit dem 13.09.2026 läuft der Zylinder nicht mehr außen am Kopf vorbei,
     * sondern in einer Tasche darin. Geprüft wird deshalb anders herum: Die
     * Achse muss über ihre ganze Länge INNERHALB der Tasche liegen — mit
     * Wandstärke zur Taschenwand — und die Tasche selbst darf den Kern des
     * Kopfes nicht anschneiden.
     */
    const g = baueGreifer();
    const d = TASCHE_MITTE * BOLZENKREIS;
    const rn = TASCHE_RADIUS * BOLZENKREIS;
    const rZyl = ZYLINDER_RADIUS;

    expect(d - rn, "die Fräsung schneidet den Kern des Kopfes an").toBeGreaterThan(
      KOPF_KERN * BOLZENKREIS
    );

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
          if (p.y < -KOPFHOEHE) continue; // unterhalb des Kopfes endet die Tasche
          const r = Math.hypot(p.x, p.z);
          expect(
            rn - Math.abs(r - d) - rZyl,
            `Zylinder verlässt seine Tasche (Öffnung ${s / 10}, r ${r.toFixed(2)})`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("bleibt versenkt — die Rippen stehen außen über dem Rohr", () => {
    /*
     * Der eigentliche Punkt des Umbaus: Von außen sieht man den Zylinder in
     * seiner Nische, nicht davor. Dafür muss die Rippe an jeder Höhe weiter
     * außen liegen als die Außenkante des Rohres.
     */
    const rZyl = ZYLINDER_RADIUS;
    const aussen = TASCHE_MITTE * BOLZENKREIS + ZYLINDER_RADIUS;
    for (let h = 0; h <= 10; h++) {
      const y = KOPF_OBERKANTE * KOPFHOEHE + ((-KOPFHOEHE - KOPF_OBERKANTE * KOPFHOEHE) * h) / 10;
      expect(rippenRadius(y), `Rippe zu flach bei y ${y.toFixed(2)}`).toBeGreaterThan(aussen);
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
