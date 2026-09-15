/**
 * Waechter zum Tiefgang der Greifer — wie weit kommt ein Greifer herunter,
 * und woran haengt es? (E-063, 15.09.2026)
 *
 * Anlass: Geraetebefund Patrick, 15.09.2026 — „der neue greifer fuehlt sich
 * zaeh, falsch konstruiert an und senkt nicht weit genug runter, weil die
 * traverse stoert."
 *
 * Nachgemessen (`tools/fuenfschalen-tiefgang.ts`) stimmt das Symptom und
 * stimmt die Ursache nicht: Die Traverse haelt 1,10 m Luft zum Beton und
 * beruehrt ihn nie. Was den Greifer oben haelt, ist die ANLENKUNG der Schale.
 *
 * Dieser Waechter haelt drei Saetze fest, und jede Zahlenschranke darin hat
 * eine Gegenprobe, die MELDEN muss:
 *
 *   1. Die Sichelkralle schliesst dicht ueber dem Beton — das ist das
 *      Spielgefuehl des Prototyps (Projektregel 2) und darf nicht wandern.
 *   2. Die Traverse des Fuenfschalengreifers beruehrt den Boden nicht.
 *   3. Die Schwebehoehe folgt einer Formel, nicht einem Zufall. Damit ist
 *      nachpruefbar, was eine Formaenderung braechte, bevor sie gebaut wird.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";
import { baueGreifer } from "../src/fuenfschalen/rig";
import { STEMPEL_AUGE, stoffe } from "../src/fuenfschalen/teile";

/**
 * Wie weit ein Greifer geschlossen ueber dem Beton schwebt (m).
 *
 * Der Bodenanschlag setzt den Arm so ab, dass ueber den GANZEN Schliessweg
 * kein gezeichneter Punkt in den Beton geraet (E-046). Er rechnet also mit
 * `maxTiefe`. Geschlossen reicht der Greifer nur `tiefe(zu)` hinunter — die
 * Differenz ist die Luft, die beim Zupacken unter den Zaehnen bleibt.
 */
function schwebt(f: Greiferform): number {
  return f.maxTiefe - f.tiefe(f.zu);
}

describe("Tiefgang: wie dicht kommt der Greifer an den Beton?", () => {
  it("Die Sichelkralle schliesst dicht ueber dem Beton (Prototyp-Gefuehl)", () => {
    /*
     * Gemessen 5,1 cm. Die Schranke steht auf 8 cm: Sie soll melden, wenn
     * jemand an der Krallenkette dreht, nicht bei jedem Millimeter.
     */
    expect(schwebt(SICHELKRALLE)).toBeLessThan(0.08);
  });

  it("GEGENPROBE: dieselbe Rechnung meldet eine Kralle, die hoch bleibt", () => {
    /*
     * Ein Greifer, dessen Zaehne geschlossen 30 cm hoeher stehen als in ihrer
     * tiefsten Stellung. Genau das ist der Fall, den Satz 1 ausschliessen
     * soll — und `schwebt` muss ihn sehen.
     */
    const kaputt: Greiferform = {
      ...SICHELKRALLE,
      tiefe: (w: number) => SICHELKRALLE.tiefe(w) - 0.3,
      maxTiefe: SICHELKRALLE.maxTiefe,
    };
    expect(schwebt(kaputt)).toBeGreaterThan(0.08);
  });

  it("Die Traverse des Fuenfschalengreifers beruehrt den Boden nie", () => {
    const { tief, feste, gesamt } = tiefsterFestpunkt();
    /*
     * Was „fest" heisst, wird gemessen und nicht am Namen erkannt: Das Modell
     * wird zu und offen gestellt, und nur Netze zaehlen, deren Weltmatrix sich
     * dabei nicht ruehrt. Ohne diese Probe haette der Waechter die fuenf
     * Schalen fuer Traverse gehalten (sie heissen `SHELL_*`).
     */
    expect(feste, "keine festen Netze gefunden — die Messung greift ins Leere").toBeGreaterThan(5);
    expect(feste, "ALLE Netze stehen fest — die Schalen bewegen sich nicht").toBeLessThan(gesamt);
    /*
     * Aufgesetzt steht die Aufhaengung `maxTiefe + 0,02` ueber dem Beton
     * (`resolveGroundClamp`). Die Traverse haengt `tief` darunter.
     * Gemessen 1,099 m Luft; die Schranke steht auf 0,50 m.
     */
    const luft = FUENFSCHALEN.maxTiefe + 0.02 - tief;
    expect(luft, `Traverse nur ${(luft * 100).toFixed(1)} cm ueber dem Beton`).toBeGreaterThan(0.5);
  });

  it("GEGENPROBE: dieselbe Rechnung meldet eine Traverse, die aufsetzt", () => {
    const { tief } = tiefsterFestpunkt();
    // Dieselbe Formel, Traverse um 1,20 m tiefer gehaengt.
    const luft = FUENFSCHALEN.maxTiefe + 0.02 - (tief + 1.2);
    expect(luft).toBeLessThan(0.5);
  });

  it("Die Schwebehoehe folgt der Anlenkung: sqrt(A²+B²) − A", () => {
    /*
     * Die Schale ist EIN starrer Koerper an EINEM Bolzen. Ihr Zahn sitzt im
     * Bolzenrahmen auf (−A / −B), also ist die Tiefe beim Schwenk `s`
     *   T(s) = |y_Bolzen| + A·cos s + B·sin s
     * — eine Sinuswelle mit Scheitel sqrt(A²+B²) und Randwert A bei s = 0.
     *
     * Wenn diese Probe aufgeht, ist die Schwebehoehe keine Einstellung,
     * sondern eine Folge der Anlenkung: Ein Zahn, der geschlossen auf der
     * Achse stehen muss, ueberbrueckt B ≈ Bolzenkreisradius und hebt sich
     * dabei zwangslaeufig. Daran haengt, was eine Formaenderung braechte.
     */
    const yBolzen = -STEMPEL_AUGE.y;
    const A = FUENFSCHALEN.tiefe(FUENFSCHALEN.zu) - yBolzen;
    const B = Math.sqrt((FUENFSCHALEN.maxTiefe - yBolzen) ** 2 - A ** 2);
    expect(Math.hypot(A, B) - A).toBeCloseTo(schwebt(FUENFSCHALEN), 3);
    // B ist der Weg, den der Zahn vom Bolzen bis auf die Achse zuruecklegt —
    // er liegt in der Groessenordnung des Bolzenkreises (0,59 m).
    expect(B).toBeGreaterThan(STEMPEL_AUGE.r);
    expect(B).toBeLessThan(STEMPEL_AUGE.r + 0.3);
  });

  it("GEGENPROBE: die Formel meldet, wenn B nicht stimmt", () => {
    const yBolzen = -STEMPEL_AUGE.y;
    const A = FUENFSCHALEN.tiefe(FUENFSCHALEN.zu) - yBolzen;
    const Bfalsch = 0.3; // ein um 44 cm zu kleiner Bolzenkreis
    expect(Math.hypot(A, Bfalsch) - A).not.toBeCloseTo(schwebt(FUENFSCHALEN), 3);
  });
});

/**
 * Tiefster Punkt der Baugruppen des Fuenfschalengreifers, die NICHT
 * mitschwenken — also Traverse, Stempel, Drehwerk, Rotator.
 */
function tiefsterFestpunkt(): { tief: number; feste: number; gesamt: number } {
  const g = baueGreifer(stoffe());
  const lagen = (t: number): Map<THREE.Mesh, string> => {
    g.setOeffnung(t);
    g.wurzel.updateMatrixWorld(true);
    const raus = new Map<THREE.Mesh, string>();
    g.wurzel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) raus.set(m, m.matrixWorld.elements.join(","));
    });
    return raus;
  };
  const zu = lagen(0);
  const offen = lagen(1);
  const p = new THREE.Vector3();
  let tief = 0;
  let feste = 0;
  for (const [m, lage] of offen) {
    if (zu.get(m) !== lage) continue;
    feste++;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (-p.y > tief) tief = -p.y;
    }
  }
  return { tief, feste, gesamt: offen.size };
}
