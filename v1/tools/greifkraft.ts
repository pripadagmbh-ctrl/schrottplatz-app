/**
 * WIEVIEL BLEIBT STEHEN? — die Messung vor der Schliesskraft (22.09.2026).
 *
 * Die Frage des Auftrags: Wie weit fahren die Schalen heute zu, wenn ein Wrack
 * dazwischen liegt, und wie gross ist die Differenz zwischen BEFOHLENER und
 * WIRKLICH erreichter Stellung? Ohne diese Zahl ist jede Kraftformel geraten.
 *
 * Gemessen wird am echten Bagger in einer echten Rapier-Welt, mit dem echten
 * `Excavator.update()` — also mit Rampen, Bodenanschlag und Krallenkollidern,
 * genau wie auf dem iPad. Der Arm senkt sich, bis die offene Spinne aufsitzt,
 * dann wird die Leertaste gehalten (voller Schliessbefehl) und in jedem Bild
 * abgelesen:
 *
 *   ziel    `Excavator.splay` — die befohlene Spreizung (rad)
 *   ist[c]  die wirklich erreichte Spreizung jeder einzelnen Schale (rad)
 *   rest[c] verbleibende Nachdrueck-Reserve (rad)
 *   art[c]  0 frei, 1 weich, 2 hart
 *
 * Aufruf: npx vite-node tools/greifkraft.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";

const DT = 1 / 60;
const GRAD = 180 / Math.PI;

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
  hart: Set<number>;
}

function aufbau(): Stand {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const hart = new Set<number>();
  bagger.clawBlockedBy = (b) => hart.has(b.handle);
  return { world, bagger, grip, tasten: new Tasten(), hart };
}

const sensor = new THREE.Vector3();
function takt(s: Stand): void {
  s.bagger.update(DT, s.tasten as never);
  s.grip.update(s.bagger.closure, s.bagger.closing, s.bagger.getSensorPosition(sensor), DT);
  s.world.step();
  s.bagger.carriedCount = s.grip.grippedCount;
  s.bagger.carriedMassKg = s.grip.totalMassKg;
  s.bagger.grippedHandles.clear();
  for (const b of s.grip.grippedBodies) s.bagger.grippedHandles.add(b.handle);
}

function absetzen(s: Stand): void {
  s.tasten.down.add("KeyF");
  s.tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) takt(s);
  s.tasten.down.clear();
  for (let i = 0; i < 30; i++) takt(s);
}

/** Innenleben des Baggers — fuer die Messung, nicht fuers Spiel. */
function innen(b: Excavator): { ist: number[]; rest: number[]; art: number[] } {
  const x = b as unknown as { clawSplayIst: number[]; clawReserve: number[]; clawArt: number[] };
  return { ist: x.clawSplayIst, rest: x.clawReserve, art: x.clawArt };
}

interface Fall {
  name: string;
  dims: [number, number, number] | null;
  massKg: number;
  hart: boolean;
}

const FAELLE: Fall[] = [
  { name: "Autowrack (4,2 x 1,4 x 1,8 m, 1100 kg, hart)", dims: [4.2, 1.4, 1.8], massKg: 1100, hart: true },
  { name: "Brocken (0,85 m Kubus, 400 kg, hart)", dims: [0.85, 0.85, 0.85], massKg: 400, hart: true },
  { name: "Traeger (2,4 x 0,3 x 0,3 m, 180 kg, hart)", dims: [2.4, 0.3, 0.3], massKg: 180, hart: true },
  { name: "Blech (1,2 x 0,08 x 0,9 m, 55 kg, weich)", dims: [1.2, 0.08, 0.9], massKg: 55, hart: false },
  { name: "Luft (nichts dazwischen)", dims: null, massKg: 0, hart: false },
];

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();

  for (const f of FAELLE) {
    const s = aufbau();
    absetzen(s);
    const gp = s.bagger.grappleGroup.position.clone();
    let ziel: RAPIER.RigidBody | null = null;
    if (f.dims) {
      const d = RAPIER.RigidBodyDesc.dynamic().setTranslation(gp.x, f.dims[1] / 2 + 0.02, gp.z);
      ziel = s.world.createRigidBody(d);
      s.world.createCollider(
        RAPIER.ColliderDesc.cuboid(f.dims[0] / 2, f.dims[1] / 2, f.dims[2] / 2).setMass(f.massKg),
        ziel
      );
      if (f.hart) s.hart.add(ziel.handle);
      for (let i = 0; i < 40; i++) takt(s);
    }

    // Leertaste halten: voller Schliessbefehl, 3 s
    let bisse = 0;
    let maxKraft = 0;
    let ersterBiss = -1;
    s.bagger.onClawBite = (e) => {
      bisse++;
      if (ersterBiss < 0) ersterBiss = e.kraftKN;
    };
    s.tasten.down.add("Space");
    const v = innen(s.bagger);
    let ersterBlock = -1;
    let maxDiff = 0;
    const verlauf: string[] = [];
    for (let i = 0; i < 180; i++) {
      takt(s);
      const soll = s.bagger.splay;
      let diff = 0;
      for (const w of v.ist) diff = Math.max(diff, w - soll);
      if (ersterBlock < 0 && v.art.some((a) => a !== 0)) ersterBlock = i;
      maxDiff = Math.max(maxDiff, diff);
      maxKraft = Math.max(maxKraft, s.bagger.schliesskraftKN);
      if (i % 20 === 19)
        verlauf.push(
          `t=${((i + 1) * DT).toFixed(2)}s zu=${s.bagger.closure.toFixed(2)} ` +
            `soll=${(soll * GRAD).toFixed(1)}° dmax=${(diff * GRAD).toFixed(2)}°`
        );
    }
    const soll = s.bagger.splay;
    const diffs = v.ist.map((w) => w - soll);
    const summe = diffs.reduce((a, b) => a + Math.max(b, 0), 0);
    const anliegend = v.art.filter((a) => a !== 0).length;
    const leer = v.rest.filter((r) => r <= 1e-9).length;
    const t = ziel?.isValid() ? ziel.translation() : null;

    console.log(`\n=== ${f.name}`);
    console.log(verlauf.join("\n  "));
    console.log(`  Ende: closure=${s.bagger.closure.toFixed(3)} soll=${(soll * GRAD).toFixed(2)}°`);
    console.log(`  ist je Schale: ${v.ist.map((w) => (w * GRAD).toFixed(2)).join("  ")}`);
    console.log(`  Diff je Schale (°): ${diffs.map((w) => (w * GRAD).toFixed(2)).join("  ")}`);
    console.log(
      `  Diff max ${(Math.max(...diffs) * GRAD).toFixed(2)}° · Summe ${(summe * GRAD).toFixed(2)}°` +
        ` · Diff max im Verlauf ${(maxDiff * GRAD).toFixed(2)}°`
    );
    console.log(
      `  Schalen mit Fund ${anliegend}/5 · Reserve leer ${leer}/5 · art=${v.art.join("")}` +
        ` · erster Fund Bild ${ersterBlock}`
    );
    console.log(
      `  Stau ${(s.bagger.schalenStau * GRAD).toFixed(2)}° · Kraft jetzt ` +
        `${s.bagger.schliesskraftKN.toFixed(2)} kN · hoechste ${maxKraft.toFixed(2)} kN · ` +
        `Bisse ${bisse} (erster mit ${ersterBiss < 0 ? "-" : ersterBiss.toFixed(2)} kN)`
    );
    // Hebel loslassen und noch einmal zudruecken: kommt ein zweiter Biss?
    s.tasten.down.delete("Space");
    for (let i = 0; i < 30; i++) takt(s);
    s.tasten.down.add("Space");
    for (let i = 0; i < 90; i++) takt(s);
    console.log(`  nach Loslassen und erneutem Zudruecken: ${bisse} Bisse gesamt`);
    console.log(
      `  gegriffen: ${s.grip.grippedCount} Teile / ${s.grip.totalMassKg.toFixed(0)} kg` +
        (t ? ` · Ziel verschoben auf (${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}), war (${gp.x.toFixed(2)}, ${(f.dims![1] / 2 + 0.02).toFixed(2)}, ${gp.z.toFixed(2)})` : "")
    );
    s.world.free();
  }
}

void main();
