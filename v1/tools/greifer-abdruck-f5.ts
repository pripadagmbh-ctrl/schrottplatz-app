/**
 * Derselbe ABDRUCK wie `tools/greifer-abdruck.ts`, nur mit dem
 * FUENFSCHALENGREIFER am Arm.
 *
 * Warum als zweite Datei und nicht als Schalter in der ersten: Der Abdruck
 * wird gegen einen Stand aus der Versionsverwaltung verglichen, und der
 * kennt den Schalter nicht. Ein alter Aufruf mit unbekanntem Argument haette
 * still den Abdruck der Sichelkralle geliefert und die Pruefung in eine
 * Behauptung verwandelt. Zwei Dateien koennen das nicht.
 *
 * Aufruf:  npx vite-node tools/greifer-abdruck-f5.ts > abdruck-f5.json
 * Vergleichen:  npx vite-node tools/greifer-abdruck-vergleich.ts a.json b.json
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";

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

const DT = 1 / 60;

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  if (!bagger.setGreifer(FUENFSCHALEN)) throw new Error("Greiferwechsel abgelehnt");
  const tasten = new Tasten();

  const brocken = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.3, 8.4));
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3).setMass(400), brocken);

  const zahlen: number[] = [];
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();

  for (let i = 0; i < 300; i++) {
    tasten.down.clear();
    if (i < 160) {
      tasten.down.add("KeyF");
      tasten.down.add("KeyG");
    } else if (i < 250) {
      tasten.down.add("Space");
    }
    bagger.update(DT, tasten as never);
    world.step();
    const g = bagger.grappleGroup;
    zahlen.push(g.position.x, g.position.y, g.position.z);
    zahlen.push(g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w);
    zahlen.push(bagger.splay, bagger.clawSplayMax, bagger.closure);
    bagger.getSensorPosition(v);
    zahlen.push(v.x, v.y, v.z);
  }

  bagger.grappleGroup.updateWorldMatrix(true, true);
  const netze: string[] = [];
  bagger.grappleGroup.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.matrixWorld.decompose(v, q, s);
    netze.push(`${m.geometry.type}:${m.geometry.getAttribute("position").count}`);
    zahlen.push(v.x, v.y, v.z, q.x, q.y, q.z, q.w, s.x, s.y, s.z);
  });

  const kollider: number[] = [];
  for (let i = 0; i < bagger.grappleBody.numColliders(); i++) {
    const c = bagger.grappleBody.collider(i);
    const t = c.translation();
    const r = c.rotation();
    kollider.push(t.x, t.y, t.z, r.x, r.y, r.z, r.w, c.isEnabled() ? 1 : 0);
    const sh = c.shape as unknown as { halfHeight?: number; radius?: number };
    kollider.push(sh.halfHeight ?? -1, sh.radius ?? -1);
  }

  const korb: number[] = [];
  for (const schliessgrad of [0, 0.5, 0.8, 1]) {
    bagger.closure = schliessgrad;
    const mitte = bagger.grappleGroup.position;
    for (let iy = 0; iy <= 24; iy++) {
      for (let ir = 0; ir <= 12; ir++) {
        for (let ia = 0; ia < 4; ia++) {
          const y = mitte.y - (iy / 24) * 3.4;
          const r = (ir / 12) * 2.0;
          const a = (ia / 4) * Math.PI * 2;
          korb.push(
            bagger.isInsideGrapple(v.set(mitte.x + Math.sin(a) * r, y, mitte.z + Math.cos(a) * r))
              ? 1
              : 0
          );
        }
      }
    }
  }

  console.log(
    JSON.stringify({
      netze,
      bewegung: zahlen.map((x) => Number(x.toFixed(12))),
      kollider: kollider.map((x) => Number(x.toFixed(12))),
      korb,
    })
  );
}

void main();
