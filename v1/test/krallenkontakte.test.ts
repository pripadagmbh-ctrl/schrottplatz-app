/**
 * WAECHTER FUER `krallenKontakte` (E-127, 06.10.2026).
 *
 * Der Bagger fragt seit E-127 ALLE Kollider eines Koerpers, nicht nur
 * Kollider 0 — damit eine Schale an der Tuer des hohlen Wracks (E-124) zaehlt.
 * Projektregel 2: Fuer jeden Koerper mit EINEM Kollider (alle Schrottteile,
 * Bestand, A, B) darf sich dabei nichts aendern. Bewiesen wird das gegen einen
 * woertlichen Nachbau der Fassung vor E-127, ueber einen ganzen Schliessvorgang
 * und ein Gitter von Koerpern rund um die Spinne.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";

const DT = 1 / 60;
const KONTAKT_NAH = 0.14; // excavator.ts

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

interface Innen {
  form: {
    schalen: number;
    stationen: number;
    punkt: (a: number, s: number, st: number, out: THREE.Vector3) => THREE.Vector3;
  };
  clawSplayIst: number[];
  currentSplay(): number;
}

/** Woertlich die Fassung vor E-127: nur Kollider 0. */
function vorher(bagger: Excavator, body: RAPIER.RigidBody): number {
  const x = bagger as unknown as Innen;
  const col = body.collider(0);
  if (!col) return 0;
  bagger.grappleGroup.updateWorldMatrix(true, false);
  const p = new THREE.Vector3();
  let treffer = 0;
  for (let c = 0; c < x.form.schalen; c++) {
    const a = (c / x.form.schalen) * Math.PI * 2;
    const splay = x.clawSplayIst[c] ?? x.currentSplay();
    let nah = false;
    for (const seg of [x.form.stationen, Math.round(x.form.stationen * 0.6)]) {
      x.form.punkt(a, splay, seg, p);
      p.applyMatrix4(bagger.grappleGroup.matrixWorld);
      const pr = col.projectPoint({ x: p.x, y: p.y, z: p.z }, false);
      if (!pr) continue;
      const d = Math.hypot(pr.point.x - p.x, pr.point.y - p.y, pr.point.z - p.z);
      if (pr.isInside || d <= KONTAKT_NAH) {
        nah = true;
        break;
      }
    }
    if (nah) treffer++;
  }
  return treffer;
}

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
});

function bagger(): { world: RAPIER.World; bagger: Excavator; tasten: Tasten; takt(): void } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const b = new Excavator(new THREE.Scene(), world);
  const tasten = new Tasten();
  // Arm senken, bis die offene Spinne aufsitzt (wie tools/greifzyklus.ts)
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) {
    b.update(DT, tasten as never);
    world.step();
  }
  tasten.down.clear();
  return {
    world,
    bagger: b,
    tasten,
    takt(): void {
      b.update(DT, tasten as never);
      world.step();
    },
  };
}

describe("krallenKontakte fragt alle Kollider (E-127)", () => {
  it("ein Kollider: dasselbe Ergebnis wie vorher, ueber einen ganzen Schliessvorgang", () => {
    const s = bagger();
    /*
     * Die Probekoerper leben in einer ZWEITEN Welt: So stoeren sie den Arm
     * nicht, und die Spinne schliesst bei jedem Lauf gleich. `projectPoint`
     * fragt nur den Kollider, keine Welt.
     */
    const proben = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const gp = s.bagger.grappleGroup.position.clone();
    const formen = [
      RAPIER.ColliderDesc.cuboid(0.6, 0.15, 0.15),
      RAPIER.ColliderDesc.ball(0.35),
      RAPIER.ColliderDesc.cylinder(0.2, 0.3),
      RAPIER.ColliderDesc.capsule(0.4, 0.1),
      RAPIER.ColliderDesc.cuboid(0.85, 0.55, 2.0), // so gross wie ein Wrack
    ];
    const koerper: RAPIER.RigidBody[] = [];
    for (const f of formen) {
      for (const dx of [-1.2, -0.6, -0.3, 0, 0.3, 0.6, 1.2]) {
        for (const dy of [-2.2, -1.6, -1.0]) {
          for (const dz of [-0.6, 0, 0.6]) {
            const b = proben.createRigidBody(
              RAPIER.RigidBodyDesc.fixed().setTranslation(gp.x + dx, gp.y + dy, gp.z + dz)
            );
            proben.createCollider(f, b);
            koerper.push(b);
          }
        }
      }
    }
    proben.step();

    let vergleiche = 0;
    let nichtNull = 0;
    s.tasten.down.add("Space");
    for (let i = 0; i < 60; i++) {
      s.takt();
      for (const b of koerper) {
        const alt = vorher(s.bagger, b);
        expect(s.bagger.krallenKontakte(b)).toBe(alt);
        vergleiche++;
        if (alt > 0) nichtNull++;
      }
    }
    // Sonst haette der Vergleich nur 0 = 0 bewiesen.
    expect(nichtNull).toBeGreaterThan(vergleiche / 10);
    s.world.free();
    proben.free();
  });

  it("zwei Kollider: eine Schale am zweiten zaehlt, auch wenn der erste weit weg ist", () => {
    const s = bagger();
    const proben = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const gp = s.bagger.grappleGroup.position.clone();
    const b = proben.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(gp.x, gp.y, gp.z));
    // Kollider 0 drei Meter daneben, Kollider 1 dort, wo die Schalen sind
    proben.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setTranslation(4, 0, 0), b);
    proben.createCollider(RAPIER.ColliderDesc.cuboid(1.5, 1.5, 1.5).setTranslation(0, -1.6, 0), b);
    proben.step();
    expect(vorher(s.bagger, b)).toBe(0);
    expect(s.bagger.krallenKontakte(b)).toBeGreaterThan(0);
    s.world.free();
    proben.free();
  });

  it("ein entfernter Koerper liefert 0, statt die Welt zu zerstoeren (E-103)", () => {
    const s = bagger();
    const gp = s.bagger.grappleGroup.position;
    const b = s.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(gp.x, gp.y - 1.6, gp.z));
    s.world.createCollider(RAPIER.ColliderDesc.ball(0.4), b);
    s.world.removeRigidBody(b);
    expect(s.bagger.krallenKontakte(b)).toBe(0);
    s.takt(); // die Welt laeuft weiter
    s.world.free();
  });
});
