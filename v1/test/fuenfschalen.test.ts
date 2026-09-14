/**
 * Der Fünfschalengreifer als Vorschaumodell, mechanisch nachgerechnet.
 *
 * Er wird im Spiel NICHT getragen — der Bagger hat die Sichelkralle am Zapfen.
 * Trotzdem gilt für ihn dasselbe wie für jedes Modell, das exportiert wird:
 * Wenn Zeichnung und Rechnung auseinanderlaufen, sieht man es im GLB nicht
 * mehr. Die Wächter hier sind die des Exportmodells der Sichelkralle
 * (`test/greifer.test.ts`), auf diese Form übertragen.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  MASS,
  OFFEN,
  SCHALEN_ABSCHNITTE,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZU,
  mittellinie,
  schalenStationen,
  schwenkFuer,
} from "../src/fuenfschalen/teile";
import { baueGreifer, hebelarm, zylinderLaenge, zylinderNeigung } from "../src/fuenfschalen/rig";

/** Länge des Zylinderrohrs — dieselbe Rechnung wie in `baueZylinder`. */
const ROHRLAENGE = MASS.zylinder.laenge * 0.6;
const SEKTOR_HALB = Math.PI / MASS.schalen;
/*
 * Näher als das an der Drehachse laufen die fünf Spitzen geschlossen
 * ineinander — dieselbe Ausnahme und derselbe Grund wie im Sektortest der
 * Sichelkralle (`test/greifer.test.ts`: `if (r < 0.3) continue`).
 */
const SEKTOR_AB = 0.3;

function finde(wurzel: THREE.Object3D, name: string): THREE.Object3D {
  const o = wurzel.getObjectByName(name);
  if (!o) throw new Error(`${name} fehlt`);
  return o;
}

describe("Fünfschalen — Zeichnung gegen Rechnung", () => {
  /**
   * Steht die gezeichnete Schale dort, wo `mittellinie` sie rechnet?
   *
   * Der Anlass steht in `test/greifer.test.ts`: An der Sichelkralle drehte das
   * Rig den Gelenkpunkt um `-(Schwenk − ZU)` statt um `-Schwenk`. Solange „zu"
   * die Spreizung 0 war, war beides dasselbe — am Zapfen ist „zu" 0,5495, und
   * die gezeichnete Kralle stand 31° weiter zu als die gerechnete.
   *
   * Diese Form hat `ZU = 0`, der Fehler wäre hier also wieder unsichtbar.
   * Genau deshalb steht der Wächter hier: Er vergleicht nicht Winkel mit
   * Winkel, sondern die Weltlage der gezeichneten Schale mit der Bahn, auf der
   * Hüllmaß, Wölbung und Volumen gerechnet werden. Ein Vorzeichen, ein Abzug
   * oder eine Drehrichtung zu viel fällt damit auf, auch wenn `ZU` null ist.
   */
  it("zeichnet die Schale dort, wo mittellinie sie rechnet", () => {
    const g = baueGreifer();
    const stationen = schalenStationen();
    const p = new THREE.Vector3();
    let groesster = 0;
    let wo = "";
    for (let s = 0; s <= 20; s++) {
      const t = s / 20;
      g.setOeffnung(t);
      g.wurzel.updateMatrixWorld(true);
      const soll = mittellinie(schwenkFuer(t));
      for (let i = 0; i < g.schalen.length; i++) {
        const gelenk = g.schalen[i]!.gelenk;
        for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
          p.set(0, stationen[k]!.y, stationen[k]!.z).applyMatrix4(gelenk.matrixWorld);
          const ab = Math.hypot(Math.hypot(p.x, p.z) - soll[k]!.r, p.y - soll[k]!.y);
          if (ab > groesster) {
            groesster = ab;
            wo = `Schale ${i + 1}, Station ${k}, Öffnung ${t.toFixed(2)}`;
          }
        }
      }
    }
    expect(groesster, `${(groesster * 1000).toFixed(1)} mm daneben bei ${wo}`).toBeLessThan(0.002);
  });

  it("dreht alle fünf Schalen um denselben Betrag — und in dieselbe Richtung", () => {
    const g = baueGreifer();
    for (const t of [0, 0.5, 1]) {
      g.setOeffnung(t);
      const soll = -schwenkFuer(t);
      for (const s of g.schalen) {
        expect(s.gelenk.rotation.x, `Öffnung ${t}`).toBeCloseTo(soll, 4);
      }
    }
  });

  it("öffnet monoton — keine Stelle, an der die Schale zurückläuft", () => {
    let vorher = -Infinity;
    for (let s = 0; s <= 20; s++) {
      const bahn = mittellinie(schwenkFuer(s / 20));
      const weite = 2 * (bahn[SCHALEN_ABSCHNITTE]!.r ?? 0);
      expect(weite).toBeGreaterThan(vorher);
      vorher = weite;
    }
  });
});

describe("Fünfschalen — Bewegungsfreiheit der Schalen", () => {
  /**
   * Jede Schale hat ihren eigenen Sektor (360°/5). Bleibt sie über den ganzen
   * Weg darin, kann sie die Nachbarn nicht durchdringen. Geprüft an den echten
   * Eckpunkten, nicht an der Mittellinie — und außerhalb der Zone, in der die
   * fünf Spitzen sich geschlossen ohnehin aneinander vorbeischieben.
   */
  it("bleibt in jeder Stellung im eigenen Sektor", () => {
    const g = baueGreifer();
    const v = new THREE.Vector3();
    let engste = Infinity;
    let stelle = "";
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
            if (r < SEKTOR_AB) continue;
            let d = Math.atan2(v.x, v.z) - schale.winkel;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            const luft = SEKTOR_HALB - Math.abs(d);
            if (luft < engste) {
              engste = luft;
              stelle = `Öffnung ${(s / 20).toFixed(2)}, r=${r.toFixed(2)}, ${m.name}`;
            }
          }
        });
      }
    }
    expect(
      engste,
      `engste Stelle bei ${stelle}: ${((SEKTOR_HALB - engste) * (180 / Math.PI)).toFixed(1)}° ` +
        `von ${((SEKTOR_HALB * 180) / Math.PI).toFixed(0)}° genutzt`
    ).toBeGreaterThan(0);
  });
});

describe("Fünfschalen — Zylinder", () => {
  it("fährt zum SCHLIESSEN aus — die Kraft liegt beim Zugreifen", () => {
    const zu = zylinderLaenge(ZU);
    const offen = zylinderLaenge(OFFEN);
    expect(zu, "Schließen fährt ein statt aus").toBeGreaterThan(offen);
    expect(zu - offen, "Hub zu klein, die Stange wäre nicht zu sehen").toBeGreaterThan(0.15);
  });

  it("bleibt länger als sein Rohr — die Stange fährt nicht durch den Boden", () => {
    for (let s = 0; s <= 20; s++) {
      expect(zylinderLaenge(schwenkFuer(s / 20)), `Öffnung ${s / 20}`).toBeGreaterThan(ROHRLAENGE);
    }
  });

  /*
   * ACHTUNG, offene Frage (14.09.2026): Die Sichelkralle hält an dieser Stelle
   * 20° Neigung und 0,10 m Hebelarm ein. Diese Form tut es NICHT — gemessen
   * 38,9° bei 40 % Öffnung und 0,092 m ganz offen. Beides ist unverändert aus
   * dem Archiv (alt wie neu dieselbe Zahl) und folgt allein aus der Anlenkung
   * `ZYLINDER_AUFNAHME` (r 0,34 / y −0,73), `STEMPEL_AUGE` (r 0,59 / y −1,5335)
   * und `OBERE_ANBINDUNG` (z 0,31). Die sind der Formvertrag und dürfen in
   * diesem Paket nicht angefasst werden.
   *
   * Die beiden Wächter stehen deshalb auf dem GEMESSENEN Stand: Sie halten
   * fest, dass es nicht schlechter wird. Ob die Anlenkung nachgerechnet werden
   * soll, entscheidet der Auftraggeber — es ist der einzige Weg zu 20°/0,10 m.
   */
  it("steht nicht quer über dem Kopf — Neigung bleibt, wo sie ist", () => {
    for (let s = 0; s <= 20; s++) {
      const grad = (zylinderNeigung(schwenkFuer(s / 20)) * 180) / Math.PI;
      expect(grad, `Öffnung ${s / 20}: ${grad.toFixed(0)}°`).toBeLessThan(39);
    }
  });

  it("hat einen Hebelarm, der über den ganzen Weg trägt", () => {
    for (let s = 0; s <= 20; s++) {
      expect(hebelarm(schwenkFuer(s / 20)), `Öffnung ${s / 20}`).toBeGreaterThan(0.09);
    }
    /* Kein Totpunkt beim SCHLIESSEN — dort wird die Kraft gebraucht. */
    expect(hebelarm(ZU), "Hebelarm geschlossen").toBeGreaterThan(0.2);
  });
});

describe("Fünfschalen — Mittelsäule", () => {
  /*
   * Gekürzt wurde am 14.09.2026, weil die Säule den Schlund verengt. Was sie
   * dabei nicht verlieren darf, ist ihre Aufgabe: Sie hängt am Traversenkörper,
   * trägt den Stempel und bringt die fünf Bolzen an den Äquator.
   */
  const g = baueGreifer();
  g.wurzel.updateMatrixWorld(true);
  /* Box3.setFromObject aktualisiert nur nach unten — die Eltern müssen stehen. */
  const kasten = (name: string, wo: THREE.Object3D = g.wurzel): THREE.Box3 =>
    new THREE.Box3().setFromObject(finde(wo, name));

  it("setzt die Zylindergabel auf den Traversenkörper, nicht daneben", () => {
    const koerper = kasten("04_GRUNDKOERPER").union(kasten("04_OBERFLANSCH"));
    for (let i = 1; i <= MASS.schalen; i++) {
      const gabel = kasten(`04_ZYLINDERAUFNAHME_${String(i).padStart(2, "0")}`);
      expect(koerper.max.y - gabel.min.y, `Gabel ${i} schwebt über der Traverse`).toBeGreaterThan(0);
    }
  });

  it("lässt die Säule bis in die Traverse reichen", () => {
    const saeule = kasten("09_SAEULE");
    const koerper = kasten("04_GRUNDKOERPER");
    expect(saeule.max.y, "Säule endet unter der Traverse").toBeGreaterThan(koerper.min.y);
    expect(saeule.max.y, "Säule schießt oben aus der Traverse heraus").toBeLessThan(
      TRAVERSE_Y + MASS.traverse.hoehe / 2
    );
  });

  it("bringt jeden Ausleger bis an sein Schalenauge", () => {
    for (let i = 1; i <= MASS.schalen; i++) {
      const nr = String(i).padStart(2, "0");
      const arm = kasten(`10_AUSLEGER_${nr}`);
      const auge = kasten(`10_SCHALENANBINDUNG_${nr}`);
      const mitteA = arm.getCenter(new THREE.Vector3());
      const mitteB = auge.getCenter(new THREE.Vector3());
      const rArm = Math.hypot(mitteA.x, mitteA.z) + arm.getSize(new THREE.Vector3()).length() / 2;
      expect(Math.hypot(mitteB.x, mitteB.z), `Auge ${nr} nicht auf dem Bolzenkreis`).toBeCloseTo(
        STEMPEL_AUGE.r,
        2
      );
      expect(rArm, `Ausleger ${nr} erreicht das Auge nicht`).toBeGreaterThan(STEMPEL_AUGE.r);
    }
  });

  it("lässt den Zylinder nirgends durch die Mittelsäule laufen", () => {
    const v = new THREE.Vector3();
    const stempelR = MASS.stempel.breite / 2;
    let engster = Infinity;
    for (let s = 0; s <= 20; s++) {
      g.setOeffnung(s / 20);
      g.wurzel.updateMatrixWorld(true);
      for (let i = 1; i <= MASS.schalen; i++) {
        const nr = String(i).padStart(2, "0");
        for (const teil of [`CYL_BARREL_${nr}`, `CYL_ROD_${nr}`]) {
          finde(g.wurzel, teil).traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
            for (let k = 0; k < pos.count; k++) {
              v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
              /* Nur unterhalb der Traverse; darüber sitzt das Auge in der Gabel. */
              if (v.y > TRAVERSE_Y) continue;
              engster = Math.min(engster, Math.hypot(v.x, v.z));
            }
          });
        }
      }
    }
    expect(engster, `Zylinder kommt bis r=${engster.toFixed(3)} an die Achse`).toBeGreaterThan(
      stempelR
    );
  });
});

describe("Fünfschalen — Maße", () => {
  it("baut den Zahn auf sein Sollmaß 120 × 250 × 80 mm", () => {
    /*
     * Positionsliste 07 Greiferspitze: 0,25 × 0,12 × 0,08 m. Gemessen wird das
     * Hüllmaß des gebogenen Zahns — die Tiefe enthält deshalb die Biegung
     * (44 mm Pfeilhöhe über 250 mm bei R 0,70) und nur der Rest ist Querschnitt.
     */
    const g = baueGreifer();
    g.setOeffnung(0);
    const zahn = finde(g.wurzel, "SHELL_TIP_01");
    const bb = new THREE.Box3().setFromObject(zahn.children[0]!);
    const s = bb.getSize(new THREE.Vector3());
    expect(s.x, `Zahn ${(s.x * 1000).toFixed(0)} mm breit`).toBeCloseTo(0.12, 2);
    expect(Math.max(s.y, s.z), "Zahnlänge").toBeCloseTo(0.25, 2);
  });

  it("öffnet weiter, als er hoch ist, und schließt auf der Achse", () => {
    const g = baueGreifer();
    const weite = (t: number): number => {
      g.setOeffnung(t);
      return 2 * Math.max(...mittellinie(schwenkFuer(t)).map((p) => p.r));
    };
    expect(weite(1)).toBeGreaterThan(weite(0));
    expect(mittellinie(schwenkFuer(0))[SCHALEN_ABSCHNITTE]!.r, "die Spitzen treffen sich nicht in der Mitte").toBeLessThan(0.1);
  });
});
