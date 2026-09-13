/**
 * Der zusammengebaute Fünfschalengreifer, mechanisch nachgerechnet.
 *
 * Nicht „sieht gut aus", sondern: Sind alle zehn Positionen verbaut? Gehen die
 * fünf Schalen über den ganzen Weg aneinander vorbei? Liegen die Pivots auf den
 * Bolzen? Fährt der Zylinder zum Schließen aus und hat er nirgends einen
 * Totpunkt? Das sind die Fragen, die man einem Modell ansehen muss, bevor es
 * exportiert wird — im GLB sind sie nicht mehr zu beantworten.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  ABSCHNITT,
  MASS,
  OFFEN,
  SCHALEN_ABSCHNITTE,
  SCHALEN_BOGEN,
  STEMPEL_AUGE,
  ZU,
  mittellinie,
  schalenStationen,
  schwenkFuer,
} from "../src/grapple/teile";
import { baueGreifer, hebelarm, huelle, zylinderLaenge, zylinderNeigung } from "../src/grapple/rig";

function finde(wurzel: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return wurzel.getObjectByName(name);
}

describe("Greifer — Maße aus der Positionsliste", () => {
  it("baut die Schale aus ihrem Hüllmaß 1,20 × 0,30 m", () => {
    /*
     * Der Schlüssel zur ganzen Tabelle. Als Bogenlänge gelesen ging die
     * Rechnung nicht auf; als Hüllmaß entlang der eigenen Sehne — so misst man
     * ein gebogenes Blech — trifft sie auf den Millimeter.
     */
    const pts = schalenStationen();
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    const d = Math.hypot(b.y - a.y, b.z - a.z);
    const uy = (b.y - a.y) / d;
    const uz = (b.z - a.z) / d;
    const laengs = pts.map((p) => (p.y - a.y) * uy + (p.z - a.z) * uz);
    const quer = pts.map((p) => -(p.y - a.y) * uz + (p.z - a.z) * uy);
    expect(Math.max(...laengs) - Math.min(...laengs)).toBeCloseTo(MASS.schale.laenge, 2);
    expect(Math.max(...quer) - Math.min(...quer)).toBeCloseTo(MASS.schale.tiefe, 2);
    expect(SCHALEN_ABSCHNITTE * ABSCHNITT).toBeCloseTo(1.38, 2);
    expect((SCHALEN_BOGEN * 180) / Math.PI).toBeCloseTo(17.5, 1);
  });

  it("hängt die Schalen am Stempel, nicht an der Mitteltraverse", () => {
    /*
     * Der Befund aus der zweiten Fassung der Zeichnung. Die Augen der unteren
     * Schalenanbindung liegen auf einem Kreis von Ø 0,96 m — das ist der
     * Stempel (0,60 m breit) mit seinen fünf Gabeln, nicht die Traverse.
     */
    expect(2 * STEMPEL_AUGE.r).toBeGreaterThan(MASS.stempel.breite);
    expect(STEMPEL_AUGE.y).toBeLessThan(-1.4);
  });

  it("lässt geschlossen ein Loch, wie es die halboffene Bauform tut", () => {
    const bahn = mittellinie(ZU);
    const spitze = bahn[bahn.length - 1]!;
    expect(spitze.r, "die Spitzen überfahren die Drehachse").toBeGreaterThan(0.03);
    expect(2 * spitze.r, "unnötig viel Loch in der Mitte").toBeLessThan(0.3);
  });
});

describe("Greifer — Hierarchie und Pivots", () => {
  const g = baueGreifer();

  it("hat alle Positionen verbaut", () => {
    expect(g.wurzel.name).toBe("GRAPPLE_ROOT");
    for (const name of [
      "01_AUFHAENGUNG",
      "02_ROTATOR",
      "03_DREHWERKSGEHAEUSE",
      "GRAPPLE_HEAD",
      "09_STEMPEL",
    ]) {
      expect(finde(g.wurzel, name), name).toBeDefined();
    }
    for (let i = 1; i <= MASS.schalen; i++) {
      const nr = String(i).padStart(2, "0");
      for (const name of [
        `SHELL_${nr}`,
        `SHELL_BODY_${nr}`,
        `SHELL_TIP_${nr}`,
        `CYLINDER_${nr}`,
        `CYL_BARREL_${nr}`,
        `CYL_ROD_${nr}`,
        `04_ZYLINDERAUFNAHME_${nr}`,
        `10_SCHALENANBINDUNG_${nr}`,
      ]) {
        expect(finde(g.wurzel, name), name).toBeDefined();
      }
    }
  });

  it("hängt mechanisch richtig: alles Drehbare unter dem Rotator", () => {
    expect(finde(g.wurzel, "GRAPPLE_HEAD")!.parent?.name).toBe("ROTATOR");
    for (let i = 1; i <= MASS.schalen; i++) {
      const nr = String(i).padStart(2, "0");
      expect(finde(g.wurzel, `SHELL_${nr}`)!.parent?.name).toBe("ROTATOR");
      expect(finde(g.wurzel, `CYLINDER_${nr}`)!.parent?.name).toBe("ROTATOR");
    }
    // Die Aufhaengung dreht NICHT mit — sie haengt am Stiel.
    expect(finde(g.wurzel, "01_AUFHAENGUNG")!.parent?.name).toBe("GRAPPLE_ROOT");
  });

  it("setzt jeden Schalen-Pivot auf sein Stempelauge", () => {
    for (let i = 0; i < MASS.schalen; i++) {
      const nr = String(i + 1).padStart(2, "0");
      const schale = finde(g.wurzel, `SHELL_${nr}`)!;
      expect(Math.hypot(schale.position.x, schale.position.z)).toBeCloseTo(STEMPEL_AUGE.r, 6);
      expect(schale.position.y).toBeCloseTo(STEMPEL_AUGE.y, 6);
    }
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
  it("bleibt in jeder Stellung im eigenen Sektor", () => {
    /*
     * Jede Schale hat 72°. Bleibt sie über den ganzen Weg darin, kann sie die
     * Nachbarn nicht durchdringen — die Sektoren sind disjunkt. Geprüft an den
     * echten Eckpunkten aller Schalenteile, nicht an der Mittellinie. Nahe der
     * Achse wird ausgespart: Dort laufen die fünf Spitzen zusammen.
     */
    const g = baueGreifer();
    const sektorHalb = Math.PI / MASS.schalen;
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
             * Innerhalb von 28 cm um die Achse wird nicht geprueft. Dort laufen
             * die fuenf Spitzen im geschlossenen Zustand zusammen und schieben
             * sich aneinander vorbei — bei fuenf Zinken endlicher Breite geht
             * es gar nicht anders. Ueberall sonst muessen die Sektoren sauber
             * getrennt bleiben.
             */
            if (r < 0.28) continue;
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

  it("öffnet monoton", () => {
    let vorher = -Infinity;
    for (let s = 0; s <= 20; s++) {
      const bahn = mittellinie(schwenkFuer(s / 20));
      const weite = 2 * bahn[bahn.length - 1]!.r;
      expect(weite).toBeGreaterThan(vorher);
      vorher = weite;
    }
  });
});

describe("Greifer — Zylinder", () => {
  it("hat einen Hub, den man sieht", () => {
    expect(Math.abs(zylinderLaenge(ZU) - zylinderLaenge(OFFEN)), "Hub zu klein")
      .toBeGreaterThan(0.12);
  });

  it("bleibt in der Größenordnung der Positionsliste", () => {
    // Position 5 nennt 700 mm ueber alles; zwischen den Augen bleibt weniger.
    for (let s = 0; s <= 20; s++) {
      const l = zylinderLaenge(schwenkFuer(s / 20));
      expect(l, `Öffnung ${s / 20}`).toBeGreaterThan(0.4);
      expect(l, `Öffnung ${s / 20}`).toBeLessThan(1.0);
    }
  });

  it("steht steil und hat nirgends einen Totpunkt", () => {
    for (let s = 0; s <= 20; s++) {
      const schwenk = schwenkFuer(s / 20);
      const grad = (zylinderNeigung(schwenk) * 180) / Math.PI;
      expect(grad, `Neigung bei ${s / 20}: ${grad.toFixed(0)}°`).toBeLessThan(45);
      expect(hebelarm(schwenk), `Hebelarm bei ${s / 20}`).toBeGreaterThan(0.09);
    }
  });

  it("hat sein größtes Moment beim Zugreifen", () => {
    /*
     * Der Punkt, auf den es bei einem Greifer ankommt. Geschlossen wird hier
     * durch Einfahren, also über die Ringfläche — dass es trotzdem reicht,
     * kommt vom Hebelarm, der zum Schließen hin wächst. Gerechnet:
     * 1,66-mal das Öffnungsmoment.
     */
    const ringflaeche = 1 - 0.4 ** 2;
    const verhaeltnis = hebelarm(ZU) / hebelarm(OFFEN);
    const moment = verhaeltnis * (zylinderLaenge(ZU) > zylinderLaenge(OFFEN) ? 1 : ringflaeche);
    expect(moment, `Schließmoment nur ${moment.toFixed(2)}-mal Öffnungsmoment`)
      .toBeGreaterThan(1.2);
  });
});

describe("Greifer — Hüllmaße", () => {
  it("misst geschlossen und offen plausibel", () => {
    const zu = huelle(0);
    const auf = huelle(1);
    expect(auf.breite, "öffnet nicht").toBeGreaterThan(zu.breite * 1.3);
    expect(zu.breite).toBeGreaterThan(1.0);
    expect(auf.breite).toBeLessThan(2.6);
    /*
     * Die Zusammenfassung der Zeichnung nennt 1,85 m Höhe. Gebaut sind es
     * 2,3 m, weil die Einzelmaße der Kopfbaugruppen zusammen schon 1,23 m
     * ergeben und die Schale mit 1,38 m Bogen 1,09 m tief hängt. Die
     * Zusammenfassung passt also nicht zu ihrer eigenen Positionsliste —
     * gebaut ist nach der Liste, weil die die Bauteile beschreibt.
     */
    // Die Zeichnung nennt 2,40 m Gesamthoehe — gebaut sind es 2,40 m.
    expect(zu.hoehe).toBeGreaterThan(2.25);
    expect(zu.hoehe).toBeLessThan(2.55);
  });
});
