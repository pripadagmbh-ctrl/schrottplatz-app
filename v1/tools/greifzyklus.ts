/**
 * GEGENPROBE: Greifen, Halten, Werfen, Pendeln in Zahlen (22.09.2026).
 *
 * Dieses Werkzeug benutzt AUSSCHLIESSLICH die Schnittstelle, die es vor der
 * Schliesskraft (E-112) schon gab — `clawSplayMax`, `closure`, `neigung`,
 * `GripSystem.grippedCount`. Damit laeuft es unveraendert in einem
 * Vergleichsbaum am alten Stand, und die vier Zahlen sind Ziffer fuer Ziffer
 * vergleichbar:
 *
 *   Griffweite    Spreizung der weitesten Schale im Moment des Zufassens (°)
 *   Haltedauer    Bilder, in denen das Teil durchgehend hing
 *   Wurfweite     waagerechte Strecke vom Loslasspunkt bis zum Liegenbleiben
 *   Pendelwinkel  groesste Schraeglage des Greifers waehrend des Schwenks (°)
 *
 * Aufruf: npx vite-node tools/greifzyklus.ts
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

const sensor = new THREE.Vector3();

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  const hart = new Set<number>();
  bagger.clawBlockedBy = (b) => hart.has(b.handle);
  const tasten = new Tasten();

  const takt = (): void => {
    bagger.update(DT, tasten as never);
    grip.update(bagger.closure, bagger.closing, bagger.getSensorPosition(sensor), DT);
    world.step();
    bagger.carriedCount = grip.grippedCount;
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.grippedHandles.clear();
    for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
  };

  // Arm senken, bis die offene Spinne aufsitzt
  tasten.down.add("KeyF");
  tasten.down.add("KeyG");
  for (let i = 0; i < 260; i++) takt();
  tasten.down.clear();
  for (let i = 0; i < 30; i++) takt();

  // Traeger unter die Spinne legen
  const gp = bagger.grappleGroup.position.clone();
  const teil = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(gp.x, 0.17, gp.z)
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.15, 0.15).setMass(180), teil);
  hart.add(teil.handle);
  for (let i = 0; i < 40; i++) takt();

  // Zufassen
  tasten.down.add("Space");
  let griffweite = -1;
  let haltedauer = 0;
  for (let i = 0; i < 90; i++) {
    takt();
    if (griffweite < 0 && grip.grippedCount > 0) griffweite = bagger.clawSplayMax;
    if (grip.grippedCount > 0) haltedauer++;
  }
  // Heben und schwenken — daraus kommt der Pendelausschlag
  tasten.down.add("KeyR");
  for (let i = 0; i < 60; i++) {
    takt();
    if (grip.grippedCount > 0) haltedauer++;
  }
  tasten.down.delete("KeyR");
  tasten.down.add("KeyE");
  let pendel = 0;
  for (let i = 0; i < 120; i++) {
    takt();
    pendel = Math.max(pendel, bagger.neigung);
    if (grip.grippedCount > 0) haltedauer++;
  }
  // Werfen: mitten im Schwenk loslassen
  const los = teil.translation();
  const losX = los.x;
  const losZ = los.z;
  tasten.down.delete("Space");
  for (let i = 0; i < 240; i++) {
    takt();
    pendel = Math.max(pendel, bagger.neigung);
  }
  tasten.down.clear();
  for (let i = 0; i < 120; i++) takt();
  const liegt = teil.translation();
  const wurf = Math.hypot(liegt.x - losX, liegt.z - losZ);

  console.log(`Griffweite    ${(griffweite * GRAD).toFixed(4)}°`);
  console.log(`Haltedauer    ${haltedauer} Bilder`);
  console.log(`Wurfweite     ${wurf.toFixed(4)} m`);
  console.log(`Pendelwinkel  ${(pendel * GRAD).toFixed(4)}°`);
  console.log(`Ruhelage      (${liegt.x.toFixed(4)}, ${liegt.y.toFixed(4)}, ${liegt.z.toFixed(4)})`);
  console.log(`Spreizung zu  ${(bagger.clawSplayMax * GRAD).toFixed(4)}°`);
}

void main();
