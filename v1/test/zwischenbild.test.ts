import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { Zwischenbild } from "../src/core/zwischenbild";

const FIXED_DT = 1 / 60; // wie main.ts:50
const MAX_STEPS = 5;
const TEMPO = 3.0; // m/s — Fahrtempo eines rangierenden LKW (SW, zum Rechnen)

/**
 * Die Bildschleife aus main.ts, nachgebaut ohne Browser.
 *
 * `schritt` rueckt die Welt einen festen Zeitschritt vor, `zeichne` liefert,
 * was auf dem Bildschirm steht. Der Rueckgabewert ist die Folge der
 * gezeichneten Werte — daraus laesst sich das Ruckeln messen.
 */
function schleife(opts: {
  hz: number;
  bilder: number;
  schritt: () => void;
  gezeichnet: () => number;
  /** Zwischenbild an/aus */
  interp?: { erfasse: () => void; zeichne: (a: number) => void; zurueck: () => void };
  /** Bildabstand streuen (Safari liefert keine exakten Takte) */
  jitter?: number;
}): { werte: number[]; muster: number[] } {
  const werte: number[] = [];
  const muster: number[] = [];
  let acc = 0;
  let zufall = 12345;
  for (let f = 0; f < opts.bilder; f++) {
    let dt = 1 / opts.hz;
    if (opts.jitter) {
      zufall = (zufall * 1103515245 + 12345) & 0x7fffffff;
      dt += ((zufall / 0x7fffffff) * 2 - 1) * opts.jitter;
    }
    acc += dt;
    let n = 0;
    while (acc >= FIXED_DT && n < MAX_STEPS) {
      opts.schritt();
      acc -= FIXED_DT;
      opts.interp?.erfasse();
      n++;
    }
    if (n === MAX_STEPS) acc = 0;
    muster.push(n);
    opts.interp?.zeichne(acc / FIXED_DT);
    werte.push(opts.gezeichnet());
    opts.interp?.zurueck();
  }
  return { werte, muster };
}

/** Groesste und kleinste Strecke, die das Bild von Frame zu Frame vorrueckt. */
function spruenge(werte: number[]): { min: number; max: number; spanne: number } {
  // Einschwingen ueberspringen
  const d: number[] = [];
  for (let i = 21; i < werte.length; i++) d.push(werte[i] - werte[i - 1]);
  const min = Math.min(...d);
  const max = Math.max(...d);
  return { min, max, spanne: max - min };
}

describe("Sprungmuster des festen Zeitschritts", () => {
  /*
   * Die Nachrechnung zu Patricks Befund vom 14.09.2026 ("kein durchgaengiges
   * Bild, sondern zwei schnelle Bilder hintereinander"). Auf dem iPad laeuft
   * das Bild mit 48 Hz, gerechnet wird mit 60 Hz.
   */
  const faelle: Array<[number, string, number]> = [
    // [Hz, erwartetes Muster (Anfang), Verhaeltnis groesster Sprung zum Idealwert]
    [30, "22222222", 1],
    [48, "21112111", 1.6],
    [50, "21111211", 1.667],
    [60, "11111111", 1],
    [120, "01010101", 2],
  ];
  for (const [hz, muster, faktor] of faelle) {
    it(`${hz} Hz: Muster ${muster}`, () => {
      let x = 0;
      const { werte, muster: m } = schleife({
        hz,
        bilder: 240,
        schritt: () => {
          x += TEMPO * FIXED_DT;
        },
        gezeichnet: () => x,
      });
      expect(m.slice(24, 32).join("")).toBe(muster);
      const ideal = (TEMPO / hz) * 1000;
      const s = spruenge(werte);
      expect((s.max * 1000) / ideal).toBeCloseTo(faktor, 2);
    });
  }

  it("48 Hz ohne Interpolation: jedes vierte Bild rueckt doppelt vor", () => {
    let x = 0;
    const { werte } = schleife({
      hz: 48,
      bilder: 240,
      schritt: () => {
        x += TEMPO * FIXED_DT;
      },
      gezeichnet: () => x,
    });
    const s = spruenge(werte);
    // 50 mm, 50 mm, 50 mm, 100 mm — bei 3 m/s und 48 Hz
    expect(s.min * 1000).toBeCloseTo(50, 3);
    expect(s.max * 1000).toBeCloseTo(100, 3);
  });
});

describe("Zwischenbild glaettet die Fahrt", () => {
  function fahrtAufbau() {
    const szene = new THREE.Scene();
    const lkw = new THREE.Group();
    const kabine = new THREE.Mesh();
    lkw.add(kabine);
    szene.add(lkw);
    const zb = new Zwischenbild();
    zb.wurzel(lkw);
    return { szene, lkw, zb };
  }

  it("48 Hz mit Interpolation: gleiche Strecke in jedem Bild", () => {
    const { lkw, zb } = fahrtAufbau();
    const { werte } = schleife({
      hz: 48,
      bilder: 240,
      schritt: () => {
        lkw.position.z += TEMPO * FIXED_DT;
      },
      gezeichnet: () => lkw.position.z,
      interp: {
        erfasse: () => zb.erfasse(),
        zeichne: (a) => zb.zeichne(a),
        zurueck: () => zb.zurueck(),
      },
    });
    const s = spruenge(werte);
    const ideal = (TEMPO / 48) * 1000; // 62,5 mm
    expect(s.max * 1000).toBeCloseTo(ideal, 6);
    // Abnahmekriterium: die Spanne faellt von 50 mm auf unter 0,01 mm
    expect(s.spanne * 1000).toBeLessThan(0.01);
  });

  it("auch mit gestreutem Bildtakt bleibt die Spanne klein", () => {
    const { lkw, zb } = fahrtAufbau();
    const { werte } = schleife({
      hz: 48,
      bilder: 240,
      jitter: 0.002, // +/- 2 ms Streuung, wie sie Safari liefert
      schritt: () => {
        lkw.position.z += TEMPO * FIXED_DT;
      },
      gezeichnet: () => lkw.position.z,
      interp: {
        erfasse: () => zb.erfasse(),
        zeichne: (a) => zb.zeichne(a),
        zurueck: () => zb.zurueck(),
      },
    });
    const ohne = (() => {
      let x = 0;
      return spruenge(
        schleife({
          hz: 48,
          bilder: 240,
          jitter: 0.002,
          schritt: () => {
            x += TEMPO * FIXED_DT;
          },
          gezeichnet: () => x,
        }).werte
      );
    })();
    const mit = spruenge(werte);
    // Mit Streuung bleibt ein Rest, aber er ist um ein Vielfaches kleiner
    expect(mit.spanne).toBeLessThan(ohne.spanne / 4);
  });

  it("zeichnet den Zwischenstand, nicht den gerechneten", () => {
    const { lkw, zb } = fahrtAufbau();
    lkw.position.z = 0;
    zb.erfasse();
    lkw.position.z = 1;
    zb.erfasse();
    zb.zeichne(0.25);
    expect(lkw.position.z).toBeCloseTo(0.25, 9);
    zb.zurueck();
    expect(lkw.position.z).toBe(1);
  });
});

describe("Zwischenbild laesst die Rechnung unangetastet", () => {
  it("setzt Position, Drehung und Streckung exakt zurueck", () => {
    const szene = new THREE.Scene();
    const g = new THREE.Group();
    g.add(new THREE.Mesh());
    szene.add(g);
    const zb = new Zwischenbild();
    zb.wurzel(g);
    g.position.set(1, 2, 3);
    g.rotation.y = 0.4;
    g.scale.set(1, 1, 1);
    zb.erfasse();
    g.position.set(2, 2, 3);
    g.rotation.y = 0.9;
    g.scale.set(1, 2, 1);
    zb.erfasse();
    zb.zeichne(0.5);
    zb.zurueck();
    expect(g.position.toArray()).toEqual([2, 2, 3]);
    expect(g.rotation.y).toBe(0.9);
    expect(g.scale.toArray()).toEqual([1, 2, 1]);
  });

  /*
   * Die Falle, die Fahrzeuge zum Schlingern gebracht haette: vehicles.ts rechnet
   * mit `group.rotation.y` weiter (`rotation.y += diff * ...`). Ein aus dem
   * Quaternion neu gewonnener Euler-Winkel beschreibt denselben Dreh mit
   * anderen Zahlen — 3,50 wuerde zu -2,78. Darum setzt zurueck() den
   * Euler-Winkel, nicht das Quaternion.
   */
  it("haelt Drehwinkel jenseits von 180 Grad in derselben Zahl", () => {
    const szene = new THREE.Scene();
    const lkw = new THREE.Group();
    lkw.add(new THREE.Mesh());
    szene.add(lkw);
    const zb = new Zwischenbild();
    zb.wurzel(lkw);
    lkw.rotation.y = 3.4;
    zb.erfasse();
    lkw.rotation.y = 3.5;
    zb.erfasse();
    zb.zeichne(0.5);
    expect(Math.abs(lkw.rotation.y)).toBeLessThan(Math.PI); // gezeichnet: gemischt
    zb.zurueck();
    expect(lkw.rotation.y).toBe(3.5); // gerechnet: unveraendert
  });

  it("dreht ueber slerp, nicht ueber die Winkelzahlen", () => {
    const szene = new THREE.Scene();
    const g = new THREE.Group();
    g.add(new THREE.Mesh());
    szene.add(g);
    const zb = new Zwischenbild();
    zb.wurzel(g);
    g.rotation.y = 0;
    zb.erfasse();
    g.rotation.y = Math.PI / 2;
    zb.erfasse();
    zb.zeichne(0.5);
    const e = new THREE.Euler().setFromQuaternion(g.quaternion, "YXZ");
    expect(e.y).toBeCloseTo(Math.PI / 4, 9);
  });

  it("bei alpha 1 oder in der Pause steht der gerechnete Stand im Bild", () => {
    const szene = new THREE.Scene();
    const g = new THREE.Group();
    g.add(new THREE.Mesh());
    szene.add(g);
    const zb = new Zwischenbild();
    zb.wurzel(g);
    g.position.z = 0;
    zb.erfasse();
    g.position.z = 1;
    zb.erfasse();
    zb.zeichne(1);
    expect(g.position.z).toBe(1);
    zb.zeichne(7); // Messbetrieb: Akkumulator laeuft ohne Schritte weiter
    expect(g.position.z).toBe(1);
  });
});

describe("Zwischenbild: was dazukommt und was draussen bleibt", () => {
  it("der erste Schritt nach einer Pause springt nicht", () => {
    const szene = new THREE.Scene();
    const zb = new Zwischenbild();
    zb.beobachte(szene);
    const lkw = new THREE.Group();
    lkw.add(new THREE.Mesh());
    lkw.position.set(40, 0, 20); // faehrt am Tor herein, nicht am Ursprung
    szene.add(lkw);
    zb.wurzel(lkw);
    zb.erfasse(); // erste Erfassung: prev = curr
    zb.zeichne(0.5);
    expect(lkw.position.x).toBe(40); // kein Sprung aus dem Ursprung
    zb.zurueck();
  });

  it("meldet eine Baugruppe an, sobald sie sich bewegt", () => {
    const szene = new THREE.Scene();
    const zb = new Zwischenbild();
    zb.beobachte(szene);
    const lkw = new THREE.Group();
    lkw.add(new THREE.Mesh());
    szene.add(lkw);
    zb.erfasse();
    expect(zb.knoten).toBe(0); // steht still: kostet nichts
    lkw.position.z += 0.05;
    zb.erfasse();
    expect(zb.knoten).toBe(2); // Gruppe + Netz
  });

  it("einzelne Netze ohne Kinder bleiben aussen vor (loser Schrott)", () => {
    const szene = new THREE.Scene();
    const zb = new Zwischenbild();
    zb.beobachte(szene);
    const teil = new THREE.Mesh();
    szene.add(teil);
    zb.erfasse();
    teil.position.y += 0.3;
    zb.erfasse();
    expect(zb.knoten).toBe(0);
  });

  it("eine abgefahrene Baugruppe faellt wieder heraus", () => {
    const szene = new THREE.Scene();
    const zb = new Zwischenbild();
    zb.beobachte(szene);
    const lkw = new THREE.Group();
    lkw.add(new THREE.Mesh());
    szene.add(lkw);
    zb.erfasse(); // Erstpose merken
    lkw.position.z = 1; // faehrt los → meldet sich an
    zb.erfasse();
    expect(zb.knoten).toBe(2);
    szene.remove(lkw);
    zb.erfasse();
    expect(zb.knoten).toBe(0);
  });

  /*
   * Der Schrott in der Spinne ist der heikle Fall: Bliebe er ungemischt,
   * waehrend die Maschine glatt laeuft, zappelte die Ladung gegen die Krallen.
   */
  it("gegriffener Schrott laeuft mit, losgelassener faellt heraus", () => {
    const szene = new THREE.Scene();
    const spinne = new THREE.Group();
    spinne.add(new THREE.Mesh());
    szene.add(spinne);
    const teil = new THREE.Mesh(); // loser Schrott: eigenes Netz in der Szene
    szene.add(teil);
    const zb = new Zwischenbild();
    zb.wurzel(spinne);
    zb.beobachte(szene);

    // ohne Griff: das Teil bleibt aussen vor
    teil.position.y = 1;
    zb.erfasse();
    teil.position.y = 2;
    zb.erfasse();
    zb.zeichne(0.5);
    expect(teil.position.y).toBe(2);
    zb.zurueck();

    // gegriffen: es wird gemischt
    zb.zeitweise([teil]);
    teil.position.y = 3;
    zb.erfasse();
    teil.position.y = 4;
    zb.erfasse();
    zb.zeichne(0.5);
    expect(teil.position.y).toBeCloseTo(3.5, 9);
    zb.zurueck();
    expect(teil.position.y).toBe(4);

    // losgelassen: wieder aussen vor
    zb.zeitweise([]);
    teil.position.y = 5;
    zb.erfasse();
    teil.position.y = 6;
    zb.erfasse();
    zb.zeichne(0.5);
    expect(teil.position.y).toBe(6);
  });

  it("zaehlt nur die wirklich bewegten Knoten zum Mischen", () => {
    const szene = new THREE.Scene();
    const bagger = new THREE.Group();
    const oberwagen = new THREE.Group();
    for (let i = 0; i < 40; i++) oberwagen.add(new THREE.Mesh()); // Kulisse am Bagger
    bagger.add(oberwagen);
    szene.add(bagger);
    const zb = new Zwischenbild();
    zb.wurzel(bagger);
    zb.erfasse();
    oberwagen.rotation.y += 0.01;
    zb.erfasse();
    expect(zb.knoten).toBe(42);
    expect(zb.bewegteKnoten).toBe(1); // nur der Oberwagen wird angefasst
  });
});
