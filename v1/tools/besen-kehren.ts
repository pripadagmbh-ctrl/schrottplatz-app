/**
 * Laesst sich mit dem gekippten Greifer KEHREN? — am Besen gemessen.
 *
 * Patrick hat sich den Besen bauen lassen, um Beton und Ladeflaechen
 * abzukehren: eine getretene Rolle Maschendraht, 2,70 m lang, 680 kg. Damit
 * das geht, muss der Greifer sie quer packen und die Schalen zur Seite legen
 * koennen (E-083).
 *
 * DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist nicht „haelt er sie" — das ist in
 * `test/besen.test.ts` gemessen — sondern:
 *
 *   Kommt die Rolle beim Kippen FLACH auf, oder stellt sie sich auf die Kante?
 *
 * Und die Antwort haengt am Rotator, nicht am Kippen. Die Rolle sitzt fest im
 * Greifer (Fixed Joint), ihre Laengsachse liegt also in dessen Rahmen fest.
 * Gekippt wird um die LOKALE X-Achse. Liegt die Rollenachse PARALLEL dazu,
 * dreht sich die Rolle um sich selbst und bleibt waagerecht; steht sie quer,
 * kippt ein Ende nach oben und das andere nach unten, und bei 90 Grad steht
 * die Rolle senkrecht.
 *
 * Gerechnet: Wird bei Greiferdrehung ψ eine Rolle gefasst, die in der Welt
 * unter β liegt, so liegt ihre Achse im Greiferrahmen unter (β − ψ), und nach
 * dem Kippen um θ ist ihre Neigung
 *
 *     asin( |cos(β − ψ)| · sin θ ).
 *
 * Flach bleibt sie also genau dann, wenn cos(β − ψ) = 0 ist — wenn der Rotator
 * 90 Grad gegen die Rolle steht. Gemessen wird das hier am echten Bagger mit
 * echter Physik, nicht an dieser Formel.
 *
 * Aufruf: npx vite-node tools/besen-kehren.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { BESEN } from "../src/world/scrapItems";

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
const GRAD = 180 / Math.PI;
const [LAENGE, HOEHE, TIEFE] = BESEN.dims as [number, number, number];
/** Voller Kippwinkel, wie ihn `KIPP_MAX` im Bagger setzt (rad). */
const KIPP_VOLL = Math.PI / 2;

interface Lauf {
  gefasst: boolean;
  /** Neigung der Rollenachse gegen die Waagerechte (Grad) */
  neigung: number;
  /** Tiefster Punkt der Rolle ueber der Standflaeche (m) */
  ueberGrund: number;
  /** Wie weit die Rolle im Greifer gerutscht ist (m) */
  schlupf: number;
  kipp: number;
  /** Hoehe des Kardangelenks ueber der Standflaeche (m) */
  aufhaengung: number;
}

/**
 * Einen Durchgang fahren: Besen hinlegen, Rotator stellen, greifen, kippen,
 * absetzen.
 *
 * `podest` hebt die Standflaeche an — damit laesst sich dieselbe Frage ueber
 * einer LKW-Ladeflaeche stellen (1,05 m, `delivery/routes.ts`).
 */
function lauf(rotator: number, kippen: boolean, podest: number, zielKipp = KIPP_VOLL): Lauf {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.insideGrapple = (p) => bagger.isInsideGrapple(p);
  grip.krallenKontakte = (b) => bagger.krallenKontakte(b);
  grip.onReleaseGrace = () => bagger.startClawGrace();

  const tasten = new Tasten();
  const sensor = new THREE.Vector3();
  const schritt = (): void => {
    bagger.update(DT, tasten as never);
    bagger.getSensorPosition(sensor);
    grip.update(bagger.closure, bagger.closing, sensor, DT);
    bagger.carriedMassKg = grip.totalMassKg;
    bagger.carriedCount = grip.grippedCount;
    bagger.grippedHandles.clear();
    for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
    world.step();
  };

  // Der Arm steht still, der Greifer offen — erst mal die Pose finden.
  for (let i = 0; i < 30; i++) schritt();

  // Standflaeche
  if (podest > 0) {
    const m = bagger.grappleGroup.position;
    const p = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(m.x, podest / 2, m.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(4, podest / 2, 4), p);
  }

  /*
   * Die Rolle unter den Greifer legen, LAENGS +x. Der Rotator steht dann bei
   * 0 quer zu ihr und bei 90 Grad laengs — genau die beiden Faelle, die
   * unterschieden werden sollen.
   */
  const m = bagger.grappleGroup.position;
  const rolle = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(m.x, podest + HOEHE / 2 + 0.05, m.z)
      .setLinearDamping(0.2)
      .setAngularDamping(0.3)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(LAENGE / 2, HOEHE / 2, TIEFE / 2).setMass(BESEN.massKg),
    rolle
  );
  for (let i = 0; i < 60; i++) world.step();

  bagger.rotatorYaw = rotator;
  for (let i = 0; i < 30; i++) {
    bagger.rotatorYaw = rotator;
    schritt();
  }

  // absenken und zupacken
  for (let i = 0; i < 300; i++) {
    tasten.down.clear();
    if (i < 160) {
      tasten.down.add("KeyF");
      tasten.down.add("KeyG");
    } else {
      tasten.down.add("Space");
    }
    bagger.rotatorYaw = rotator;
    schritt();
  }
  const gefasst = grip.grippedCount > 0;

  // anheben, kippen, wieder absetzen
  const lokalBeimFassen = new THREE.Vector3(
    rolle.translation().x,
    rolle.translation().y,
    rolle.translation().z
  )
    .sub(bagger.grappleGroup.position)
    .applyQuaternion(bagger.grappleGroup.quaternion.clone().invert());

  tasten.down.clear();
  for (let i = 0; i < 120; i++) {
    tasten.down.add("KeyR");
    tasten.down.add("Space");
    bagger.rotatorYaw = rotator;
    schritt();
  }
  if (kippen) {
    /*
     * Der Greifer kennt im Spiel nur zwei Lagen — lotrecht und ganz zur
     * Seite. Dieses Werkzeug haelt ihn auch dazwischen an, weil die Frage
     * „ab welchem Winkel liegt der Besen auf dem Boden" sonst gar nicht zu
     * stellen waere. Der Sollwert wird deshalb direkt gesetzt; die Rampe
     * darauf ist dieselbe wie im Spiel.
     */
    (bagger as unknown as { kippSoll: number }).kippSoll = -Math.abs(zielKipp);
  }
  for (let i = 0; i < 180; i++) {
    tasten.down.clear();
    tasten.down.add("Space");
    bagger.rotatorYaw = rotator;
    schritt();
  }
  // wieder herunter, bis der Bodenanschlag greift
  for (let i = 0; i < 400; i++) {
    tasten.down.clear();
    tasten.down.add("KeyF");
    tasten.down.add("KeyG");
    tasten.down.add("Space");
    bagger.rotatorYaw = rotator;
    schritt();
  }

  const q = rolle.rotation();
  const achse = new THREE.Vector3(1, 0, 0).applyQuaternion(
    new THREE.Quaternion(q.x, q.y, q.z, q.w)
  );
  const neigung = Math.asin(Math.min(1, Math.abs(achse.y))) * GRAD;

  // tiefster Punkt der Rolle: acht Ecken des Kastens
  const t = rolle.translation();
  const qq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  let tief = Infinity;
  const e = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    e.set(
      (i & 1 ? 1 : -1) * (LAENGE / 2),
      (i & 2 ? 1 : -1) * (HOEHE / 2),
      (i & 4 ? 1 : -1) * (TIEFE / 2)
    ).applyQuaternion(qq);
    tief = Math.min(tief, t.y + e.y);
  }

  const jetztLokal = new THREE.Vector3(t.x, t.y, t.z)
    .sub(bagger.grappleGroup.position)
    .applyQuaternion(bagger.grappleGroup.quaternion.clone().invert());

  return {
    gefasst,
    neigung,
    ueberGrund: tief - podest,
    schlupf: gefasst ? jetztLokal.distanceTo(lokalBeimFassen) : NaN,
    kipp: bagger.kippIst * GRAD,
    aufhaengung: bagger.grappleGroup.position.y - podest,
  };
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  console.log("=== Kehren mit dem Besen: liegt die Rolle flach? ===\n");
  console.log(`  Rolle ${LAENGE} x ${HOEHE} x ${TIEFE} m, ${BESEN.massKg} kg, liegt laengs +x.\n`);
  console.log("  Rotator | gekippt | erreichter | Neigung der | tiefster Punkt | Schlupf");
  console.log("          |         | Kippwinkel | Rollenachse | ueber Grund    | im Greifer");
  console.log("  --------+---------+------------+-------------+----------------+-----------");
  for (const podest of [0, 1.05]) {
    console.log(
      podest === 0 ? "  — auf dem Beton —" : "  — auf einer Ladeflaeche (1,05 m) —"
    );
    for (const [rot, kipp] of [
      [0, false],
      [0, true],
      [90, true],
      [45, true],
    ] as Array<[number, boolean]>) {
      const r = lauf(rot / GRAD, kipp, podest);
      console.log(
        `  ${String(rot).padStart(5)}°  |   ${kipp ? "ja " : "nein"}  |   ${r.kipp.toFixed(1).padStart(5)}°   |` +
          `   ${r.neigung.toFixed(1).padStart(5)}°    |    ${r.ueberGrund.toFixed(3)} m     |  ` +
          `${Number.isNaN(r.schlupf) ? "NICHT GEFASST" : `${(r.schlupf * 1000).toFixed(1)} mm`}`
      );
    }
  }
  console.log("");
  console.log("  === Und die entscheidende Frage: kommt sie auf den Boden? ===");
  console.log("  Rotator 0 (Rollenachse laengs der Kippachse), Besen quer im Greifer.");
  console.log("");
  console.log("  Kipp  | Neigung der | tiefster Punkt | Aufhaengung");
  console.log("  winkel| Rollenachse | ueber Beton    | steht auf");
  console.log("  ------+-------------+----------------+------------");
  for (const g of [0, 15, 30, 45, 60, 75, 90]) {
    const r = lauf(0, g > 0, 0, (g / 180) * Math.PI);
    console.log(
      `  ${String(g).padStart(4)}° |    ${r.neigung.toFixed(1).padStart(5)}°   |   ${r.ueberGrund.toFixed(3)} m    |  ${r.aufhaengung.toFixed(3)} m`
    );
  }
  console.log("");
  console.log("  Lesehilfe: Neigung 0° = die Rolle liegt flach, 90° = sie steht auf dem Ende.");
  console.log("  Der Rotator entscheidet das, nicht der Kippwinkel — die Rolle sitzt fest im");
  console.log("  Greifer, und gekippt wird um dessen eigene X-Achse.");
}

void main();
