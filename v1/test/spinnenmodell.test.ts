/**
 * Waechter: Steht die GESPIELTE Spinne dort, wo ihre Kollider stehen?
 *
 * `test/greifer.test.ts` prueft dieselbe Frage am exportierbaren Modell
 * (`src/grapple/`). Hier steht sie fuers Spielmodell (`src/excavator/`) — und
 * das ist die Seite, an der es weh tut: Die Krallen-Kollider in
 * `Excavator.updateClawColliders` werden nicht aus dem Szenengraph gelesen,
 * sondern aus `clawPoint` gerechnet. Laufen Zeichnung und Rechnung auseinander,
 * greift der Spieler sichtbar neben dem, was die Physik anfasst — genau der
 * Befund vom 14.09.2026 („die Spinne greift nicht richtig"): Der Drehpunkt wurde
 * um `-(Spreizung − ZU)` gedreht statt um `-Spreizung`, und weil „zu" am Zapfen
 * nicht mehr die Spreizung 0 ist, stand die gezeichnete Kralle 31 Grad daneben.
 *
 * Der Bagger selbst wird dafuer nicht gebaut — der braucht Rapier, eine
 * Weltszene und einen Renderer. Geprueft wird die Spinne aus `grappleParts.ts`
 * mit genau der Drehung, die `Excavator.updateFingers` setzt.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { baueSpinne } from "../src/excavator/grappleParts";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_MAX_DEPTH,
  CLAW_OPEN_SPLAY,
  CLAW_SEGMENTS,
  CLAW_SEG_LEN,
  clawPoint,
  clawToothDepth,
} from "../src/excavator/clawGeometry";
import { LASCHE, ROHRLAENGE, ZYLINDERKREIS, ZYLINDER_OBEN_Y } from "../src/grapple/form";

/**
 * Die Segmentgruppen einer Kralle, von der Wurzel zur Spitze.
 *
 * `baueKralle` haengt jedes Segment als Gruppe in seinen Vorgaenger; Meshes
 * (Schale, Steg, Spitze) haengen daneben. Die Kette sind also die Gruppen.
 * Gruppe i sitzt auf Station i — die erste ohne Versatz, also genau auf dem
 * Drehpunkt.
 */
function kette(pivot: THREE.Object3D): THREE.Object3D[] {
  const knoten: THREE.Object3D[] = [];
  let hier: THREE.Object3D | undefined = pivot;
  while (hier) {
    hier = hier.children.find((k) => k.type === "Group");
    if (hier) knoten.push(hier);
  }
  return knoten;
}

/**
 * Weltpunkt der Station `k` einer Kralle.
 *
 * Stationen 0…7 sind die Segmentursprünge; Station 8 — die Spitze — ist kein
 * eigener Knoten, sondern liegt eine Segmentlaenge unter der letzten Gruppe.
 */
function station(knoten: THREE.Object3D[], k: number, out: THREE.Vector3): THREE.Vector3 {
  if (k < knoten.length) return knoten[k]!.getWorldPosition(out);
  return knoten[knoten.length - 1]!.localToWorld(out.set(0, -CLAW_SEG_LEN, 0));
}

/**
 * Tiefster ECKPUNKT aller Meshes unter `knoten` — in Metern unter dem Ursprung.
 *
 * Nicht die Segmentkette, sondern die gebaute Geometrie: Was gezeichnet wird,
 * setzt im Spiel auf. Die Messart ist die von `tools/fuenfschalen/zahnlage.ts`.
 */
function tiefsterEckpunkt(knoten: THREE.Object3D): { tiefe: number; teil: string } {
  const p = new THREE.Vector3();
  let tiefe = -Infinity;
  let teil = "";
  knoten.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = (o.geometry as THREE.BufferGeometry).getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      o.localToWorld(p);
      if (-p.y > tiefe) {
        tiefe = -p.y;
        teil = o.name || `(unbenannt: ${(o.geometry as THREE.BufferGeometry).type})`;
      }
    }
  });
  return { tiefe, teil };
}

/** Stellt die Spinne so, wie `Excavator.updateFingers` es tut. */
function stelle(gelenke: THREE.Group[], splay: number): void {
  for (const g of gelenke) g.rotation.x = -splay;
}

const STUFEN = 20;
const splayBei = (t: number): number =>
  CLAW_CLOSED_SPLAY + (CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * t;

describe("Spielmodell der Spinne", () => {
  it("zeichnet jede Kralle dort, wo clawPoint sie rechnet", () => {
    const spinne = baueSpinne();
    const soll = new THREE.Vector3();
    const ist = new THREE.Vector3();
    const ketten = spinne.gelenke.map(kette);
    expect(ketten[0]!.length, "Segmentkette unvollstaendig").toBe(CLAW_SEGMENTS);

    let groesster = 0;
    let wo = "";
    for (let s = 0; s <= STUFEN; s++) {
      const splay = splayBei(s / STUFEN);
      stelle(spinne.gelenke, splay);
      spinne.gruppe.updateMatrixWorld(true);
      for (let c = 0; c < CLAW_COUNT; c++) {
        const a = (c / CLAW_COUNT) * Math.PI * 2;
        for (let k = 0; k <= CLAW_SEGMENTS; k++) {
          station(ketten[c]!, k, ist);
          clawPoint(a, splay, k, soll);
          const ab = ist.distanceTo(soll);
          if (ab > groesster) {
            groesster = ab;
            wo = `Kralle ${c}, Station ${k}, Oeffnung ${(s / STUFEN).toFixed(2)}`;
          }
        }
      }
    }
    expect(groesster, `${(groesster * 1000).toFixed(0)} mm daneben bei ${wo}`).toBeLessThan(0.002);
  });

  it("legt die Krallen-Kollider auf die gezeichnete Kralle", () => {
    /*
     * Nachgebaut ist die Stuetzstellenwahl aus `updateClawColliders`: je Kralle
     * zwei Kapseln, von Station 0 bis zur Mitte und von der Mitte bis zur
     * Spitze. Der Seitenversatz der Kollider-Reihen faellt hier weg — er
     * verschiebt nur den Umfangswinkel und nicht die Kette.
     */
    const spinne = baueSpinne();
    const ketten = spinne.gelenke.map(kette);
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    let groesster = 0;
    for (let s = 0; s <= STUFEN; s++) {
      const splay = splayBei(s / STUFEN);
      stelle(spinne.gelenke, splay);
      spinne.gruppe.updateMatrixWorld(true);
      for (let c = 0; c < CLAW_COUNT; c++) {
        const a = (c / CLAW_COUNT) * Math.PI * 2;
        for (let h = 0; h < 2; h++) {
          for (const k of [h * (CLAW_SEGMENTS / 2), (h + 1) * (CLAW_SEGMENTS / 2)]) {
            clawPoint(a, splay, k, p);
            station(ketten[c]!, k, q);
            groesster = Math.max(groesster, p.distanceTo(q));
          }
        }
      }
    }
    expect(groesster, `Kollider ${(groesster * 1000).toFixed(0)} mm neben der Kralle`).toBeLessThan(
      0.002
    );
  });

  it("sinkt mit keinem GEZEICHNETEN Eckpunkt tiefer als CLAW_MAX_DEPTH", () => {
    /*
     * Aus `CLAW_MAX_DEPTH` kommt, wie tief der Arm die Spinne noch senken darf.
     *
     * Bis zum 14.09.2026 hat dieser Waechter die STATIONEN der Segmentkette
     * gemessen — also dasselbe Rechenmodell, aus dem `CLAW_MAX_DEPTH` selbst
     * kommt. Er hat damit nur sich selbst geprueft und „passt" gemeldet,
     * waehrend der gezeichnete Zahnkegel 12,4 cm tiefer hing und im Spiel im
     * Beton verschwand (Befund am Geraet: „die kleinen aeussersten Noppen
     * verschwinden im Boden").
     *
     * Jetzt werden die ECKPUNKTE der gebauten Meshes abgetastet, so wie
     * `tools/fuenfschalen/zahnlage.ts` es beim Fuenfschalengreifer getan hat.
     * Was gezeichnet wird, setzt auf — was gerechnet wird, nicht.
     */
    const spinne = baueSpinne();
    let tiefste = 0;
    let wo = "";
    for (let s = 0; s <= STUFEN; s++) {
      stelle(spinne.gelenke, splayBei(s / STUFEN));
      spinne.gruppe.updateMatrixWorld(true);
      for (const gelenk of spinne.gelenke) {
        const t = tiefsterEckpunkt(gelenk);
        if (t.tiefe > tiefste) {
          tiefste = t.tiefe;
          wo = `${t.teil} bei Oeffnung ${(s / STUFEN).toFixed(2)}`;
        }
      }
    }
    expect(
      tiefste,
      `tiefster gezeichneter Punkt ${tiefste.toFixed(4)} m (${wo}), ` +
        `Anschlag ${CLAW_MAX_DEPTH.toFixed(4)} m`
    ).toBeLessThanOrEqual(CLAW_MAX_DEPTH + 1e-9);
    /*
     * Und die Gegenrichtung: Der Anschlag darf auch nicht zu grosszuegig sein,
     * sonst schwebt die Spinne ueber dem Boden. 5 mm Toleranz, weil beide
     * Seiten den Oeffnungsweg in 21 Stufen abtasten und das Maximum zwischen
     * zwei Stufen liegt (`tools/zahnlage-spinne.ts`: 0,05 mm Abtastfehler).
     */
    expect(
      CLAW_MAX_DEPTH - tiefste,
      `Anschlag ${((CLAW_MAX_DEPTH - tiefste) * 1000).toFixed(1)} mm zu tief angesetzt`
    ).toBeLessThan(0.005);
  });

  it("der tiefste gezeichnete Punkt ist der Zahn, und der heisst tineTip", () => {
    /*
     * Die Lehre aus `tools/fuenfschalen/zahnlage.ts`: den Zahn ueber seinen
     * NAMEN suchen, nicht ueber „aeusserster Punkt" raten. Bei einer nach innen
     * gekruemmten Sichel kann der tiefste Punkt auch der Schalenruecken sein —
     * dann stimmt zwar der Anschlag, aber die Begruendung waere falsch, und der
     * naechste Formwechsel faellt still darauf herein.
     */
    const spinne = baueSpinne();
    const gelenk = spinne.gelenke[0]!;
    const zahn = gelenk.getObjectByName("tineTip");
    expect(zahn, "kein Knoten namens tineTip — der Zahn ist nicht mehr messbar").toBeDefined();
    for (let s = 0; s <= STUFEN; s++) {
      const splay = splayBei(s / STUFEN);
      stelle(spinne.gelenke, splay);
      spinne.gruppe.updateMatrixWorld(true);
      const ganz = tiefsterEckpunkt(gelenk);
      const nurZahn = tiefsterEckpunkt(zahn!);
      expect(ganz.teil, `bei Oeffnung ${(s / STUFEN).toFixed(2)} setzt ${ganz.teil} auf`).toBe(
        "tineTip"
      );
      /*
       * Und `clawToothDepth` rechnet genau diesen gezeichneten Punkt nach —
       * das ist die Bruecke zwischen Modell und Rechnung. Ginge sie auf,
       * waere der Bodenanschlag wieder blind fuer den Zahn.
       */
      expect(clawToothDepth(splay), `Zahnrechnung bei Oeffnung ${(s / STUFEN).toFixed(2)}`)
        .toBeCloseTo(nurZahn.tiefe, 6);
    }
  });

  it("haengt die Zylinder an denselben Punkten auf wie das Exportmodell", () => {
    /*
     * `src/excavator/grappleParts.ts` und `src/grapple/form.ts` fuehren die
     * Anlenkung doppelt — einmal fuers Spiel, einmal fuers GLB. Solange das so
     * ist, muss ein Waechter dafuer sorgen, dass sie nicht auseinanderlaufen:
     * Genau daran ist der Greifer am 12./13.09.2026 schon einmal gescheitert.
     */
    const spinne = baueSpinne();
    for (let i = 0; i < CLAW_COUNT; i++) {
      const a = (i / CLAW_COUNT) * Math.PI * 2;
      const z = spinne.zylinder[i]!;
      expect(Math.hypot(z.obenLokal.x, z.obenLokal.z), `Anlenkkreis ${i}`).toBeCloseTo(
        ZYLINDERKREIS,
        6
      );
      expect(Math.atan2(z.obenLokal.x, z.obenLokal.z), `Azimut ${i}`).toBeCloseTo(
        Math.atan2(Math.sin(a), Math.cos(a)),
        6
      );
      expect(z.obenLokal.y, `Bockhoehe ${i}`).toBeCloseTo(ZYLINDER_OBEN_Y, 6);
      expect(z.untenAmGelenk.x, `Lasche seitlich ${i}`).toBeCloseTo(0, 9);
      expect(z.untenAmGelenk.y, `Lasche y ${i}`).toBeCloseTo(LASCHE.y, 6);
      expect(z.untenAmGelenk.z, `Lasche z ${i}`).toBeCloseTo(LASCHE.z, 6);
      expect(z.rohrLaenge, `Rohrlaenge ${i}`).toBeCloseTo(ROHRLAENGE, 6);
    }
  });
});
