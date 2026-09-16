/**
 * Wie hoch steht der geschlossene Greifer ueber dem Beton? — dieselbe Folge,
 * mit der E-046 und E-065 den Bodenanschlag gemessen haben, aber als eigenes
 * Werkzeug.
 *
 * Wofuer: E-083 baut den Bodenanschlag um. Die Bedingung dabei lautet, dass
 * er BEI LOTRECHTEM GREIFER auf seiner heutigen Hoehe bleibt. „Heutig" heisst
 * hier nicht „die Zahl aus einem alten Log", sondern „mit demselben Werkzeug
 * am Stand vor dem Umbau gemessen" — Zahlen aus verschiedenen Messverfahren
 * gegeneinanderzuhalten waere genau der Fehler, an dem die Kastenmessung von
 * E-065 gestorben ist.
 *
 * Aufruf: npx vite-node tools/bodenanschlag-hoehe.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";

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
const SCHRITTE = 420;

function tiefsterPunkt(bagger: Excavator): number {
  const g = bagger.grappleGroup;
  g.updateWorldMatrix(true, true);
  const p = new THREE.Vector3();
  let tief = Infinity;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) if (!a.visible) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (p.y < tief) tief = p.y;
    }
  });
  return tief;
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
    const bagger = new Excavator(new THREE.Scene(), world);
    if (form !== SICHELKRALLE && !bagger.setGreifer(form)) throw new Error("Wechsel abgelehnt");
    const tasten = new Tasten();
    for (let i = 0; i < SCHRITTE; i++) {
      tasten.down.clear();
      if (i < SCHRITTE * 0.55) {
        tasten.down.add("KeyF");
        tasten.down.add("KeyG");
      } else {
        tasten.down.add("Space");
      }
      bagger.update(DT, tasten as never);
      world.step();
    }
    console.log(
      `${form.name.padEnd(20)} tiefster gezeichneter Punkt ueber Beton: ` +
        `${(tiefsterPunkt(bagger) * 100).toFixed(2)} cm   (maxTiefe ${form.maxTiefe.toFixed(4)} m)`
    );
  }
}

void main();
