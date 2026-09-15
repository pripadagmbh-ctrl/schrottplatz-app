/**
 * Wächter für das Fahrwerk — Paket 2 aus E-025, Frage 1 von Patrick am
 * 15.09.2026 bejaht („schmaler Mittelträger, Wange ab 1,24, Achsbrücken").
 *
 * DER BEFUND, DER NICHT ZURÜCKKOMMEN DARF (E-025, Befund 1): Der Rahmen war
 * ein Quader von y 0,70 bis 1,60, das Rad reicht bis y 1,24 — die obersten
 * **54 cm** des Rades steckten im Kasten. Und keine Zeile im Quelltext drehte
 * je ein Rad: Bei 3,2 m/s rutschte die Maschine auf vier Klötzen über den
 * Platz.
 *
 * Beides kann leise zurückkommen: Wer ein Blech nach unten zieht, versenkt das
 * Rad wieder; wer in `syncMeshes` eine Zeile streicht, stellt es still.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import type { Input } from "../src/core/input";

/**
 * Eine Tastatur-Attrappe: Sie liefert `Input`, ohne dass ein Fenster
 * gebraucht wird. Nur `axis` und `isDown` werden vom Fahrwerk gelesen.
 */
function tastatur(tasten: string[]): Input {
  const down = new Set(tasten);
  return {
    isDown: (c: string) => down.has(c),
    wasPressed: () => false,
    mouseHeld: () => false,
    axis: (neg: string, pos: string) => (down.has(pos) ? 1 : 0) - (down.has(neg) ? 1 : 0),
    endFrame: () => {},
    wheelDelta: 0,
    orbitDX: 0,
    orbitDY: 0,
    shiftHeld: false,
  } as unknown as Input;
}

let bagger: Excavator;
let scene: THREE.Scene;
let welt: RAPIER.World;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  welt = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  bagger = new Excavator(scene, welt);
});

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

describe("Unterwagen", () => {
  it("besteht aus genau zwei Netzen: Lack und Stahl", () => {
    const namen: string[] = [];
    bagger.root.children.forEach((o) => {
      if (o instanceof THREE.Mesh && o.name.startsWith("01_UNTERWAGEN")) namen.push(o.name);
    });
    expect(namen.sort(), "vorher war es ein Quader, danach zwei Netze").toEqual([
      "01_UNTERWAGEN_LACK",
      "01_UNTERWAGEN_STAHL",
    ]);
  });

  it("kein Lackblech reicht über der Radbreite unter die Radoberkante", () => {
    /*
     * DIE Zahl des ganzen Pakets: 1,24 m. Geprüft wird der Bereich ÜBER dem
     * Rad — alles, was dort tiefer liegt, verdeckt es. Achsbrücken, Tank und
     * Werkzeugkasten dürfen und sollen tiefer liegen; sie stehen in der Lücke
     * ZWISCHEN den Rädern und sind gerade das, was man dort sehen soll.
     *
     * Rad: Mitte x ±1,25, Radius 0,62, Breite 0,50 → x 1,00 … 1,50.
     */
    const m = finde("01_UNTERWAGEN_LACK") as THREE.Mesh;
    const pos = (m.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let tiefster = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.abs(pos.getX(i));
      // Etwas enger als das Rad, damit der Kotflügel nicht mitzählt — der
      // gehört optisch zum Rad und liegt über ihm.
      if (x < 1.06 || x > 1.44) continue;
      if (Math.abs(Math.abs(pos.getZ(i)) - 1.5) > 0.55) continue;
      tiefster = Math.min(tiefster, pos.getY(i));
    }
    expect(tiefster, "tiefstes Lackblech über dem Rad").toBeGreaterThanOrEqual(1.24 - 1e-6);
  });

  it("die Pratzenausleger stehen weiter im Rad — bekannter, alter Befund", () => {
    /*
     * ABSICHTLICH FESTGEHALTEN, NICHT BEHOBEN.
     *
     * Der Pratzenausleger läuft bei z ±1,35 quer heraus. Das Vorderrad steht
     * bei z ±1,50 mit Radius 0,62, füllt dort also z 0,88 … 2,12 und bei
     * z = 1,35 die Höhen y 0,02 … 1,22. Der Ausleger liegt mit y 0,50 … 0,90
     * mitten darin — er geht durch das Rad hindurch.
     *
     * Das ist NICHT neu: Die Pratzen sitzen seit dem 12.09.2026 dort
     * (Ansage: „einfach nur vom Bagger links und rechts weg"), und schon
     * damals lief der Ausleger von x 1,05 nach x 1,80 quer durchs Rad. Vorher
     * fiel es nicht auf, weil das Rad zur Hälfte im Kasten steckte und beide
     * Teile dunkel waren. Seit das Rad frei steht, sieht man es.
     *
     * Behoben wird es NICHT in diesem Paket: Jede Lösung verschiebt ein Maß —
     * die Pratzen nach vorn/hinten aus dem Rad heraus (Stützbasis wächst von
     * 2,70 auf 4,60 m Länge) oder nach innen (sie schrumpft auf 1,20 m). Das
     * ist eine Gestaltungsfrage für Patrick, kein stiller Umbau.
     *
     * Dieser Test hält den Befund fest, damit er nicht vergessen wird. Wenn er
     * eines Tages fehlschlägt, ist das Problem gelöst — dann darf er weg.
     */
    const m = finde("01_UNTERWAGEN_STAHL") as THREE.Mesh;
    const pos = (m.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let tiefster = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.abs(pos.getX(i));
      if (x < 1.06 || x > 1.44) continue;
      if (Math.abs(Math.abs(pos.getZ(i)) - 1.5) > 0.55) continue;
      tiefster = Math.min(tiefster, pos.getY(i));
    }
    expect(tiefster, "Stahl im Radschatten — erwartet ist der Pratzenausleger").toBeLessThan(1.24);
    expect(tiefster, "und zwar auf Auslegerhöhe, nicht tiefer").toBeGreaterThan(0.4);
  });

  it("man sieht unter der Maschine hindurch", () => {
    /*
     * Der Mittelträger ist 1,50 m breit, der Unterwagen war 2,40 m. Zwischen
     * Träger und Rad muss Luft sein, sonst ist es wieder eine Kiste — nur eine
     * höhere.
     */
    const lack = finde("01_UNTERWAGEN_LACK") as THREE.Mesh;
    const pos = (lack.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let breitesteUnten = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 1.2) continue; // nur unterhalb der Wangenunterkante
      // ... und nur zwischen den Achsen, sonst zählt der Kotflügel mit; der
      // gehört zum Rad, nicht zum Rahmen.
      if (Math.abs(pos.getZ(i)) > 0.6) continue;
      breitesteUnten = Math.max(breitesteUnten, Math.abs(pos.getX(i)));
    }
    expect(breitesteUnten * 2, "Breite des Rahmens unterhalb der Räder").toBeLessThan(2.4);
  });

  it("der Kollider des Unterwagens ist unverändert", () => {
    /*
     * Er war noch nie deckungsgleich mit dem sichtbaren Kasten (E-025,
     * Befund 3) und darf sich durch dieses rein optische Paket auf keinen Fall
     * ändern — daran hängt, wie die Maschine Schrott beiseiteschiebt und wo
     * sie an Hindernisse stösst.
     */
    let gefunden = false;
    welt.forEachCollider((c) => {
      const h = c.halfExtents();
      if (!h) return;
      if (
        Math.abs(h.x - 1.2) < 1e-6 &&
        Math.abs(h.y - 0.75) < 1e-6 &&
        Math.abs(h.z - 2.2) < 1e-6
      ) {
        gefunden = true;
      }
    });
    expect(gefunden, "Unterwagen-Kollider 2,4 × 1,5 × 4,4 nicht gefunden").toBe(true);
  });
});

describe("Räder — sie rollen und lenken", () => {
  const raeder = () => ["VL", "VR", "HL", "HR"].map((e) => finde(`02_RAD_${e}`));

  it("stehen weiter auf Achshöhe und tragen ihre drei Bauteile", () => {
    for (const r of raeder()) {
      expect(r.position.y, `${r.name}`).toBeCloseTo(0.62, 6);
      expect(Math.abs(r.position.x), `${r.name} Spurhalbmaß`).toBeCloseTo(1.25, 6);
    }
  });

  it("die Drehreihenfolge ist YXZ — sonst lenkt das Rad um seine eigene Achse", () => {
    /*
     * Three rechnet bei `YXZ` R = RY · RX · RZ: RZ stellt das Rad auf die
     * Seite, RX rollt es, RY lenkt. In der Voreinstellung `XYZ` säße das
     * Lenken innen und drehte das Rad um seine eigene Nabe — es würde also
     * rollen statt einzuschlagen.
     */
    for (const r of raeder()) expect(r.rotation.order, `${r.name}`).toBe("YXZ");
  });

  it("beim Fahren drehen sich alle vier Räder — und zwar passend zur Strecke", () => {
    const vorher = raeder().map((r) => r.rotation.x);
    const input = tastatur(["KeyW"]);
    let strecke = 0;
    const start = bagger.position.clone();
    for (let i = 0; i < 120; i++) bagger.update(1 / 60, input);
    strecke = bagger.position.distanceTo(start);
    const nachher = raeder().map((r) => r.rotation.x);
    for (let i = 0; i < 4; i++) {
      expect(nachher[i], `Rad ${i} steht still`).not.toBeCloseTo(vorher[i]!, 4);
    }
    /*
     * Die Probe: Winkel = Strecke / Radhalbmesser. Bei 2 s Fahrt legt die
     * Maschine gut 5 m zurück, das sind über 8 Umdrehungen — der Rollwinkel
     * wird auf einen Umlauf gestutzt, deshalb wird hier modulo verglichen.
     */
    const erwartet = ((strecke / 0.62) % (Math.PI * 2)) + vorher[0]!;
    const ist = nachher[0]!;
    const abweichung = Math.abs(
      Math.atan2(Math.sin(erwartet - ist), Math.cos(erwartet - ist))
    );
    expect(abweichung, `Rollwinkel passt nicht zur Strecke (${strecke.toFixed(2)} m)`).toBeLessThan(
      0.02
    );
  });

  it("nur die Vorderräder lenken, und nicht weiter als die Achse kann", () => {
    const input = tastatur(["KeyW", "KeyA"]);
    for (let i = 0; i < 60; i++) bagger.update(1 / 60, input);
    const vl = finde("02_RAD_VL");
    const hl = finde("02_RAD_HL");
    expect(Math.abs(vl.rotation.y), "Vorderrad lenkt nicht").toBeGreaterThan(0.1);
    expect(hl.rotation.y, "Hinterrad lenkt mit").toBe(0);
    /*
     * Der größte Einschlag ist gerechnet, nicht gesetzt: atan(Radstand /
     * Wenderadius) = atan(3,00 / 4,57) = 33,3°. Stünde das Rad weiter quer,
     * liefe es nicht mehr auf der Bahn, die die Maschine fährt.
     */
    expect(Math.abs(vl.rotation.y), "Lenkeinschlag über dem Anschlag").toBeLessThanOrEqual(
      Math.atan(3.0 / (3.2 / 0.7)) + 1e-6
    );
  });

  it("die Lenkung stellt sich zurück, wenn niemand lenkt", () => {
    const input = tastatur([]);
    for (let i = 0; i < 120; i++) bagger.update(1 / 60, input);
    expect(Math.abs(finde("02_RAD_VL").rotation.y), "Lenkung bleibt eingeschlagen").toBeLessThan(
      0.01
    );
  });
});
