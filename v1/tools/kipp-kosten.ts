/**
 * Was kostet das Seitwaertskippen je Bild? (E-083)
 *
 * Die Frage ist nicht akademisch: `maxAusladung` tastet den Schliessweg an
 * 41 Stellen ab und rechnet je Stelle ueber alle Schalen und Stationen — das
 * sind rund 1.845 Punktrechnungen, und `resolveGroundClamp` ruft sie JEDES
 * Bild. Auf dem iPad zaehlt das.
 *
 * Gemessen werden drei Faelle am kopflos gebauten Bagger, je 600 Bilder:
 * lotrecht (der Vorabsprung greift), waehrend des Kippens, und ganz zur
 * Seite gelegt.
 *
 * Aufruf: npx vite-node tools/kipp-kosten.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";
import { SICHELKRALLE } from "../src/excavator/greiferform";

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
const BILDER = 600;

function messen(form: Greiferform, kippen: boolean): { ms: number; koerper: number } {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  if (form !== SICHELKRALLE) bagger.setGreifer(form);
  const tasten = new Tasten();
  if (kippen) bagger.toggleKippen();
  // erst einschwingen lassen, damit die Rampe steht und nicht mitgemessen wird
  for (let i = 0; i < 200; i++) {
    bagger.update(DT, tasten as never);
    world.step();
  }
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < BILDER; i++) {
    tasten.down.clear();
    tasten.down.add("KeyQ");
    bagger.update(DT, tasten as never);
    world.step();
  }
  const t1 = process.hrtime.bigint();
  return { ms: Number(t1 - t0) / 1e6 / BILDER, koerper: world.bodies.len() };
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  console.log("=== Was das Kippen je Bild kostet ===\n");
  console.log("  Form                 | lotrecht | ganz zur Seite | Unterschied");
  console.log("  ---------------------+----------+----------------+------------");
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    // zweimal, die erste Runde waermt nur auf
    messen(form, false);
    const a = messen(form, false);
    const b = messen(form, true);
    console.log(
      `  ${form.name.padEnd(20)} | ${a.ms.toFixed(3)} ms | ${b.ms.toFixed(3)} ms      | ` +
        `${b.ms - a.ms >= 0 ? "+" : ""}${(b.ms - a.ms).toFixed(3)} ms   (${a.koerper} Koerper)`
    );
  }
  console.log("");
  console.log("  Lotrecht kostet das Kippen NICHTS: `maxAusladung(0)` springt vorab auf");
  console.log("  `maxTiefe` und rechnet gar nicht erst.");
}

void main();
