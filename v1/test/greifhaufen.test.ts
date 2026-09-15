/**
 * Waechter fuers Greifen IM HAUFEN — nicht auf dem Beton.
 *
 * Anlass (Patrick, 15.09.2026, nach dem zweiten Geraetetest): „Kleinteile sind
 * sehr schwer zu greifen." Die erste Ursache war die zu kleine Sensorkugel
 * (E-030, `test/greiffenster.test.ts`); danach nimmt die Spinne vom Beton alles
 * auf. Im Haufen blieb es trotzdem schwierig.
 *
 * Die zweite Ursache ist die Kontaktbedingung. Gefasst wurde nur, was entweder
 * den Schwerpunkt mitten im Korb hatte oder an dem ZWEI Schalen anlagen. Zwei
 * Schalen sind fuer Kleinteile aber unerreichbar: Fuenf Schalen stehen im
 * Kreis, zwischen zwei benachbarten klafft selbst geschlossen eine Luecke von
 * 0,63 m, und im Greiffenster (Schliessgrad 0,60 bis 0,98) sind es bis zu
 * 1,30 m. Gemessen ueber 63 Griffe im Haufen: `krallenKontakte` meldet fuer
 * Teile bis 0,40 m hoechstens 2, meist 0 — auch wenn das Teil neun Bilder lang
 * nachweislich zwischen den Schalen liegt. Die Bedingung fiel damit immer auf
 * die Ausnahme „Schwerpunkt mittig" zurueck, und am Korbrand, wo die nicht
 * greift, blieb das Teil liegen.
 *
 * Gemessen wird am echten Bagger in einer echten Rapier-Welt, mit Nachbarn
 * ringsum, ueber MEHRERE Zufallssaaten — ein Waechter mit einer einzigen Saat
 * misst nur, ob er einen ruhigen Wurf erwischt hat.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem, SCHALENLUECKE, noetigeKrallenFuer } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_SEGMENTS,
  clawPoint,
} from "../src/excavator/clawGeometry";

/** Tastatur-Attrappe: nur `isDown` und `axis` werden vom Bagger gebraucht. */
class Tasten {
  down = new Set<string>();
  wheelDelta = 0;
  orbitDX = 0;
  orbitDY = 0;
  shiftHeld = false;
  isDown(c: string): boolean {
    return this.down.has(c);
  }
  wasPressed(): boolean {
    return false;
  }
  mouseHeld(): boolean {
    return false;
  }
  axis(neg: string, pos: string): number {
    return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0);
  }
  endFrame(): void {}
}

interface Stand {
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  tasten: Tasten;
  massiv: Set<number>;
}

const DT = 1 / 60;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  // genau wie in main.ts verdrahtet
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const massiv = new Set<number>();
  bagger.clawBlockedBy = (b) => massiv.has(b.handle);
  return { world, bagger, grip, tasten: new Tasten(), massiv };
}

function takt(s: Stand): void {
  const sensor = new THREE.Vector3();
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(s.bagger.closure, s.bagger.closing, s.bagger.getSensorPosition(sensor), DT);
  s.world.step();
  s.bagger.carriedCount = s.grip.grippedCount;
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
}

function quader(
  s: Stand,
  mitte: THREE.Vector3,
  dims: [number, number, number],
  massKg: number,
  rot?: THREE.Quaternion
): RAPIER.RigidBody {
  const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(mitte.x, mitte.y, mitte.z);
  if (rot) d.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
  const b = s.world.createRigidBody(d);
  s.world.createCollider(
    RAPIER.ColliderDesc.cuboid(dims[0] / 2, dims[1] / 2, dims[2] / 2).setMass(massKg),
    b
  );
  s.massiv.add(b.handle); // massiver Stahl: die Zaehne bleiben daran stehen
  return b;
}

/**
 * Fester Zufall je Saat. Der Haufen wird gewuerfelt; mit `Math.random` waere
 * der Waechter mal gruen und mal rot — und mit EINER Saat misst er nur einen
 * einzigen Haufen (Befund 15.09.2026).
 */
function zufall(saat: number): () => number {
  let z = saat >>> 0;
  return () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
}

/** Arm senken, bis die offene Spinne aufsitzt. */
function absetzen(s: Stand): void {
  s.tasten.down.add("KeyF"); // Ausleger ab
  s.tasten.down.add("KeyG"); // Stiel ab
  for (let i = 0; i < 260; i++) takt(s);
  s.tasten.down.clear();
  for (let i = 0; i < 30; i++) takt(s);
}

/** Wo die abgesetzte Spinne steht — einmal gemessen, dann gemerkt. */
let GRIFFPUNKT: THREE.Vector3 | null = null;
function griffpunkt(): THREE.Vector3 {
  if (!GRIFFPUNKT) {
    const s = aufbau();
    absetzen(s);
    GRIFFPUNKT = s.bagger.grappleGroup.position.clone();
    s.world.free();
  }
  return GRIFFPUNKT.clone();
}

interface Versuch {
  gegriffen: boolean;
  /** Bilder, in denen das Teil nachweislich im Korb lag */
  imKorb: number;
  /** wie weit das Teil relativ zur Spinne gewandert ist, nachdem es hing (m) */
  gewandert: number;
  /** wie viele Teile am Ende in der Spinne haengen */
  korb: number;
  /** Bilder, in denen es im Korb lag, aber der volle Korb es abwies */
  verdraengt: number;
}

/**
 * Ein Greifversuch mitten im Haufen.
 *
 * Reihenfolge wie im Spiel: Haufen liegt und ruht, DANN faehrt der Arm hinein,
 * und gezielt wird auf das, was dann unter der Spinne liegt. (Wer das Zielteil
 * vorher legt, misst nur, wohin die Krallen es geschoben haben.)
 */
function haufenversuch(
  dims: [number, number, number],
  massKg: number,
  versatz: number,
  saat: number,
  nachbarn = 14,
  ringVon = 0.5,
  ringBis = 2.0
): Versuch {
  const s = aufbau();
  const g = griffpunkt();
  const rnd = zufall(saat);
  for (let i = 0; i < nachbarn; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = ringVon + rnd() * (ringBis - ringVon);
    const br = 0.25 + rnd() * 0.65;
    const ho = 0.2 + rnd() * 0.5;
    const y = 0.4 + Math.floor(i / 7) * 0.9 + rnd() * 0.3;
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rnd() - 0.5) * 1.2, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.2)
    );
    quader(
      s,
      new THREE.Vector3(g.x + Math.cos(a) * rad, y, g.z + Math.sin(a) * rad),
      [br, ho, br * (0.6 + rnd())],
      20 + rnd() * 30,
      q
    );
  }
  for (let i = 0; i < 180; i++) takt(s); // Haufen setzen lassen
  absetzen(s);

  // Zielteil dorthin, wo der Spieler zielt: unter die Spinne, um `versatz`
  // daneben, auf das, was dort gerade obenauf liegt.
  const gp = s.bagger.grappleGroup.position;
  const zx = gp.x + versatz * 0.93;
  const zz = gp.z + versatz * 0.37;
  let unterlage = 0;
  s.world.bodies.forEach((b) => {
    if (!b.isDynamic()) return;
    const t = b.translation();
    if (Math.hypot(t.x - zx, t.z - zz) < 0.45) unterlage = Math.max(unterlage, t.y + 0.2);
  });
  const ziel = quader(s, new THREE.Vector3(zx, unterlage + dims[1] / 2 + 0.03, zz), dims, massKg);
  for (let i = 0; i < 45; i++) takt(s);

  s.tasten.down.add("Space");
  let imKorb = 0;
  let verdraengt = 0;
  let gewandert = 0;
  let haengtSeit = 0;
  let relBeimFassen: THREE.Vector3 | null = null;
  const probe = new THREE.Vector3();
  for (let i = 0; i < 110; i++) {
    takt(s);
    if (!ziel.isValid()) break;
    const haengt = s.grip.grippedBodies.some((x) => x.handle === ziel.handle);
    const c = s.bagger.closure;
    if (c >= 0.6 && c <= 0.98 && !haengt) {
      // Liegt das Teil im Korb? Geprueft wird wie in `tryGrab`: der Punkt der
      // Oberflaeche, der der Sensormitte am naechsten liegt.
      const sensor = s.bagger.getSensorPosition(new THREE.Vector3());
      const pr = ziel
        .collider(0)
        ?.projectPoint({ x: sensor.x, y: sensor.y, z: sensor.z }, true);
      if (pr && s.bagger.isInsideGrapple(probe.set(pr.point.x, pr.point.y, pr.point.z))) {
        imKorb++;
        if (s.grip.grippedCount >= 5) verdraengt++;
      }
    }
    if (!haengt) continue;
    haengtSeit++;
    if (haengtSeit < 4) continue; // Kinematik wirkt erst im naechsten Schritt
    const p = ziel.translation();
    const q = s.bagger.grappleBody.translation();
    const r = s.bagger.grappleBody.rotation();
    const rel = new THREE.Vector3(p.x - q.x, p.y - q.y, p.z - q.z).applyQuaternion(
      new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()
    );
    if (!relBeimFassen) relBeimFassen = rel.clone();
    else gewandert = Math.max(gewandert, rel.distanceTo(relBeimFassen));
  }
  const gegriffen = s.grip.grippedBodies.some((x) => x.handle === ziel.handle);
  const korb = s.grip.grippedCount;
  s.world.free();
  return { gegriffen, imKorb, gewandert, korb, verdraengt };
}

describe("Schalenluecke — Herkunft der Zahl", () => {
  it("ist gerechnet, nicht gewaehlt", () => {
    // Nachgerechnet aus der Krallenform: zwei benachbarte Schalen an der
    // Station, die `krallenKontakte` abtastet, bei geschlossener Spinne.
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    clawPoint(0, CLAW_CLOSED_SPLAY, Math.round(CLAW_SEGMENTS * 0.6), a);
    clawPoint((1 / CLAW_COUNT) * Math.PI * 2, CLAW_CLOSED_SPLAY, Math.round(CLAW_SEGMENTS * 0.6), b);
    expect(SCHALENLUECKE).toBeCloseTo(a.distanceTo(b), 6);
    expect(SCHALENLUECKE).toBeCloseTo(0.629, 2);
  });

  it("kleiner als die Luecke heisst: keine Schale verlangen", () => {
    // Wer zwischen zwei geschlossene Schalen passt, kann sie nicht beide
    // beruehren — von dem zwei Kontakte zu verlangen ist unerfuellbar.
    expect(noetigeKrallenFuer(0.1)).toBe(0);
    expect(noetigeKrallenFuer(0.4)).toBe(0);
    expect(noetigeKrallenFuer(0.62)).toBe(0);
    // Ab einer Luecke eine Schale, ab zweien zwei — und dabei bleibt es.
    expect(noetigeKrallenFuer(0.7)).toBe(1);
    expect(noetigeKrallenFuer(1.3)).toBe(2);
    // Die Kiste, die nur mit einer Ecke hineinragt (2,40 m), bleibt bei zwei:
    // Sie ist der Grund, warum es die Bedingung ueberhaupt gibt.
    expect(noetigeKrallenFuer(2.4)).toBe(2);
  });
});

/*
 * Dieselben Groessen wie auf dem Beton (`test/greiffenster.test.ts`), damit
 * die beiden Tabellen vergleichbar sind: vom Kleinteil von 10 cm bis zum
 * Betonblock von 1,10 m, dazu das flache Blech und der lange Traeger.
 */
const GROESSEN: [string, [number, number, number], number][] = [
  ["Kleinteil 0,10 m", [0.1, 0.1, 0.1], 8],
  ["Kupferbund, flach 0,10 m", [0.38, 0.1, 0.38], 18],
  ["Messingarmatur 0,30 m", [0.3, 0.25, 0.3], 15],
  ["Motorblock-Rest 0,40 m", [0.4, 0.4, 0.4], 110],
  ["Blech, 6 cm dick", [0.7, 0.06, 0.9], 55],
  ["Traeger 2,90 m", [0.28, 0.28, 2.9], 180],
  ["Betonblock 1,10 m", [1.1, 1.1, 1.1], 130],
];

/** Zwei Haufen, nicht einer. */
const SAATEN = [20260915, 4711];

describe("Greifen im Haufen — was die Spinne aus dem Haufen holt", () => {
  it(
    "holt jede Groesse aus dem Haufen, auch 0,40 m neben der Achse",
    () => {
      const fehlt: string[] = [];
      for (const [name, dims, kg] of GROESSEN) {
        for (const saat of SAATEN) {
          const r = haufenversuch(dims, kg, 0.4, saat);
          if (!r.gegriffen) fehlt.push(`${name} (Saat ${saat}, ${r.imKorb} Bilder im Korb)`);
        }
      }
      expect(fehlt, `blieb im Haufen liegen: ${fehlt.join(", ")}`).toEqual([]);
    },
    180000
  );

  it(
    "holt auch vom Korbrand (0,80 m neben der Achse) das meiste heraus",
    () => {
      /*
       * Der Rand ist der Fall, an dem die alte Bedingung scheiterte: Dort
       * liegt der Schwerpunkt nicht mehr im Korbkegel, und zwei anliegende
       * Schalen gibt es bei Kleinteilen nie. Gemessen (je drei Saaten,
       * vier Groessen): vorher 6 von 12, nachher 11 von 12.
       *
       * Keine 12 von 12: Am Rand schiebt die schliessende Schale ein
       * leichtes Teil auch mal aus dem Korb, bevor sie es fasst. Das ist
       * Physik, keine Bedingung — deshalb steht die Schwelle bei 9.
       */
      const rand: [string, [number, number, number], number][] = GROESSEN.slice(0, 4);
      let ja = 0;
      let gesamt = 0;
      const bericht: string[] = [];
      for (const [name, dims, kg] of rand) {
        for (const saat of [20260915, 4711, 99991]) {
          const r = haufenversuch(dims, kg, 0.8, saat);
          gesamt++;
          if (r.gegriffen) ja++;
          else bericht.push(`${name}/${saat}: ${r.imKorb} Bilder im Korb, nicht gefasst`);
        }
      }
      expect(ja, `nur ${ja} von ${gesamt} — ${bericht.join(" | ")}`).toBeGreaterThanOrEqual(9);
    },
    180000
  );

  it(
    "ein im Haufen gefasstes Teil bleibt, wo es gefasst wurde (kein Saugen)",
    () => {
      // Der v2-Fehler, den Patrick ausdruecklich nicht will: Das Teil wanderte
      // nach dem Zupacken in die Korbmitte. Schwelle wie auf dem Beton.
      for (const saat of SAATEN) {
        const r = haufenversuch([0.4, 0.4, 0.4], 110, 0.4, saat);
        expect(r.gegriffen).toBe(true);
        expect(r.gewandert, "das Teil wandert nach dem Fassen — das ist Saugen").toBeLessThan(
          0.05
        );
      }
    },
    120000
  );

  it(
    "nimmt auch im Haufen keine Kiste mit, die nur mit einer Ecke hineinragt",
    () => {
      /*
       * Die Gegenprobe zur gelockerten Bedingung: Eine grosse Kiste, deren
       * Mitte weit neben der Spinne liegt, ist groesser als zwei
       * Schalenluecken und braucht deshalb weiter zwei anliegende Schalen.
       *
       * 2,12 m Versatz wie auf dem Beton (`test/greiffenster.test.ts`): Nur
       * eine Ecke der Kiste ragt in den Korb. Naeher heran gelegt ist die
       * Kiste wirklich gefasst — zwei Schalen liegen dann an, und dass sie
       * dann mitkommt, ist richtig und war vor dieser Aenderung ebenso.
       */
      for (const saat of SAATEN) {
        const r = haufenversuch([2.4, 0.9, 2.4], 600, 2.12, saat);
        expect(r.gegriffen, "eine Kiste mit einer Ecke im Korb wurde gefasst").toBe(false);
      }
    },
    120000
  );
});

describe("Greifen im Haufen — wer dem Kleinteil den Platz wegnimmt", () => {
  it(
    "meldet, wie oft der volle Korb ein Kleinteil abweist",
    () => {
      /*
       * KEINE Behauptung, sondern eine Messung mit Zahl: Im dichten Haufen
       * (30 Nachbarn, Ring 0,3 bis 1,2 m) liegt das Kleinteil nachweislich im
       * Korb — und geht trotzdem leer aus, weil `MAX_ITEMS` (5) schon von
       * schwereren Nachbarn belegt ist. `candidates.sort` nimmt das Schwerste
       * zuerst; das ist Absicht („wer in einen Haufen greift, bekommt das
       * grosse Teil sicher"), aber es ist auch der Grund, warum ein 8-kg-Teil
       * zwischen 25-kg-Brocken nicht mitkommt.
       *
       * Gemessen 15.09.2026: 5 von 5 Versuchen, in JEDEM Bild des
       * Greiffensters vom vollen Korb abgewiesen. Der Waechter haelt den
       * Befund fest, damit die Zahl nicht unbemerkt kippt — er verlangt
       * nichts, er misst. Was daraus wird, entscheidet Patrick (E-043).
       */
      let leerAusgegangen = 0;
      let mitKorbVoll = 0;
      for (const saat of [20260915, 4711, 99991]) {
        const r = haufenversuch([0.1, 0.1, 0.1], 8, 0, saat, 30, 0.3, 1.2);
        if (!r.gegriffen) {
          leerAusgegangen++;
          if (r.verdraengt > 0 && r.korb >= 5) mitKorbVoll++;
        }
      }
      // Solange das so ist, gehoert es in den Bericht — nicht in eine stille
      // Annahme. Faellt der Wert eines Tages auf 0, ist das kein Fehler,
      // sondern die Entscheidung dazu; dann faellt dieser Waechter auf und
      // will neu geschrieben werden.
      expect(leerAusgegangen).toBe(mitKorbVoll);
    },
    180000
  );
});
