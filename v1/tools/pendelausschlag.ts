/**
 * Wie weit schlaegt der Greifer aus, wann kommt er zur Ruhe, und wie weit
 * fliegt ein Traeger, den man aus dem Schwung loslaesst?
 *
 * Drei Fragen, ein Werkzeug — gebaut fuer den Vergleich VORHER/NACHHER, als
 * die Winkelsperre des Pendels (frueher `PENDEL_MAX`, 17 Grad je Achse) fiel.
 * Es misst am kopflos gebauten Bagger, mit derselben Schrittweite wie das
 * Spiel (1/60 s).
 *
 * WIE DER AUSSCHLAG GEMESSEN WIRD: nicht an `swing`, sondern an dem, was man
 * sieht. Die Greiferachse ist die lokale −y-Achse der `grappleGroup`; der
 * Ausschlag ist der Winkel zwischen ihr und der Weltsenkrechten. Damit ist die
 * Zahl unabhaengig davon, wie das Pendel innen gerechnet wird.
 *
 * Aufruf: npx vite-node tools/pendelausschlag.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { GripSystem } from "../src/physics/gripSystem";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE, type Greiferform } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";

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

/** Bagger auf ebenem Beton, ohne Haufen — nur das Pendel soll wirken. */
function aufbau(form: Greiferform): {
  world: RAPIER.World;
  bagger: Excavator;
  grip: GripSystem;
  tasten: Tasten;
} {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(120, 0.5, 120), boden);
  const bagger = new Excavator(new THREE.Scene(), world);
  if (form !== SICHELKRALLE) bagger.setGreifer(form);
  const grip = new GripSystem(world, bagger.grappleBody);
  grip.setForm(form);
  return { world, bagger, grip, tasten: new Tasten() };
}

/**
 * Was `main.ts` je Bild tut, damit der Bagger von seiner Ladung weiss.
 *
 * Ohne diese zwei Zeilen misst das Werkzeug Unsinn: Ein gefasstes Teil ist
 * kinematisch, und `surfaceUnderClaws` haelt jeden nicht-dynamischen Koerper
 * fuer tragenden Grund. Der Bagger setzte dann auf seiner eigenen Ladung auf,
 * `groundContact` ginge an — und das Pendel wuerde je Bild mit 0,75
 * heruntergedaempft. Gemessen war der Ausschlag damit 6,2 statt 17,3 Grad.
 */
function takt(bagger: Excavator, grip: GripSystem): void {
  bagger.carriedMassKg = grip.totalMassKg;
  bagger.grippedHandles.clear();
  for (const b of grip.grippedBodies) bagger.grippedHandles.add(b.handle);
}

const achse = new THREE.Vector3();
/** Ausschlag der Greiferachse gegen die Lotrechte (Grad). */
function ausschlag(bagger: Excavator): number {
  achse.set(0, -1, 0).applyQuaternion(bagger.grappleGroup.quaternion);
  return Math.acos(THREE.MathUtils.clamp(-achse.y, -1, 1)) * GRAD;
}

interface Schwung {
  hoechster: number;
  beharrung: number;
  ruheS: number;
  wechsel: number;
  schwungS: number;
}

/**
 * Oberwagen 5 s voll schwenken, dann loslassen.
 *
 * `beharrung` ist der Mittelwert der letzten Sekunde des Schwenks — bei einem
 * gedaempften Pendel unter gleichbleibender Fliehkraft steht der Greifer dort
 * schraeg und ruhig. `hoechster` ist der Ueberschwinger beim Anfahren.
 * `ruheS` zaehlt ab dem Loslassen, bis der Ausschlag zum letzten Mal ueber
 * 1 Grad lag; `wechsel` sind die Richtungswechsel danach — ein Pendel, das
 * einmal durchschwingt und steht, hat wenige.
 */
function schwenken(form: Greiferform, mitLast: number): Schwung {
  const { world, bagger, grip, tasten } = aufbau(form);
  // Einschwingen: Arm in Stellung fahren lassen, Pendel zur Ruhe kommen
  for (let i = 0; i < 240; i++) {
    bagger.update(DT, tasten as never);
    world.step();
  }
  if (mitLast > 0) haenge(world, bagger, grip, mitLast);

  let hoechster = 0;
  let summe = 0;
  let zaehl = 0;
  const schwungBilder = 300; // 5 s
  for (let i = 0; i < schwungBilder; i++) {
    tasten.down.clear();
    tasten.down.add("KeyQ");
    takt(bagger, grip);
    bagger.update(DT, tasten as never);
    grip.update(1, true, korb(bagger), DT);
    world.step();
    const a = ausschlag(bagger);
    if (a > hoechster) hoechster = a;
    if (i >= schwungBilder - 60) {
      summe += a;
      zaehl++;
    }
  }
  // loslassen und ausschwingen lassen
  tasten.down.clear();
  let ruheBild = 0;
  let wechsel = 0;
  let vor = ausschlag(bagger);
  let steigend = false;
  for (let i = 0; i < 900; i++) {
    takt(bagger, grip);
    bagger.update(DT, tasten as never);
    grip.update(1, true, korb(bagger), DT);
    world.step();
    const a = ausschlag(bagger);
    if (a > 1) ruheBild = i;
    const jetzt = a > vor;
    if (i > 2 && jetzt !== steigend) wechsel++;
    steigend = jetzt;
    vor = a;
  }
  return {
    hoechster,
    beharrung: summe / Math.max(1, zaehl),
    ruheS: (ruheBild + 1) * DT,
    wechsel,
    schwungS: schwungBilder * DT,
  };
}

const korbP = new THREE.Vector3();
/** Mitte des Korbes in Weltkoordinaten — das ist der Sensorsitz. */
function korb(bagger: Excavator): THREE.Vector3 {
  return korbP
    .set(0, -bagger.greiferform.sensorSitz, 0)
    .applyQuaternion(bagger.grappleGroup.quaternion)
    .add(bagger.grappleGroup.position);
}

/** Einen Traeger in den Korb haengen — direkt, ohne den Griffweg zu spielen. */
function haenge(
  world: RAPIER.World,
  bagger: Excavator,
  grip: GripSystem,
  massKg: number
): RAPIER.RigidBody {
  const p = korb(bagger);
  const b = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z)
  );
  // Traeger 2 m lang, wie ein Doppel-T-Abschnitt aus dem Haufen
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.1, 1.0).setMass(massKg), b);
  grip.attachBody(b);
  return b;
}

interface Wurf {
  vAbwurf: number;
  vEcht: number;
  weite: number;
  hoeheAbwurf: number;
  ausschlagAbwurf: number;
}

/**
 * Aus vollem Schwung loslassen und messen, wie weit der Traeger fliegt.
 *
 * Gewartet wird, bis der Ausschlag sich beruhigt hat (dort ist die
 * Bahngeschwindigkeit am gleichmaessigsten) — das ist der Wurf, den man im
 * Spiel macht: erst aufdrehen, dann aufmachen. Gemessen wird die WAAGERECHTE
 * Strecke vom Abwurfpunkt bis zur Ruhelage.
 */
function werfen(form: Greiferform, massKg: number, rueckschwung = false): Wurf {
  const { world, bagger, grip, tasten } = aufbau(form);
  for (let i = 0; i < 240; i++) {
    bagger.update(DT, tasten as never);
    world.step();
  }
  const teil = haenge(world, bagger, grip, massKg);
  /*
   * `spur` ist die eigene Bahn des TEILS ueber die letzten drei Schritte —
   * dieselbe Fensterbreite, mit der `releaseAll` die Bahn des KARDANGELENKS
   * mittelt (`RELEASE_AVG_STEPS`). Die zwei Zahlen nebeneinander beantworten
   * die Frage aus E-085: Fliegt die Ladung so schnell, wie sie sich bewegt?
   */
  const spur: THREE.Vector3[] = [];
  for (let i = 0; i < 300; i++) {
    tasten.down.clear();
    tasten.down.add("KeyQ");
    takt(bagger, grip);
    bagger.update(DT, tasten as never);
    grip.update(1, true, korb(bagger), DT);
    world.step();
    const t = teil.translation();
    spur.push(new THREE.Vector3(t.x, t.y, t.z));
    if (spur.length > 4) spur.shift();
  }
  /*
   * RUECKSCHWUNG: Oberwagen anhalten und warten, bis das Pendel durch die
   * Senkrechte zurueckschwingt — dort ist seine eigene Winkelgeschwindigkeit
   * am groessten. Losgelassen wird am ersten Hoehepunkt der Korbgeschwindigkeit.
   */
  if (rueckschwung) {
    tasten.down.clear();
    let vorher = 0;
    for (let i = 0; i < 120; i++) {
      takt(bagger, grip);
      bagger.update(DT, tasten as never);
      grip.update(1, true, korb(bagger), DT);
      world.step();
      const t = teil.translation();
      spur.push(new THREE.Vector3(t.x, t.y, t.z));
      if (spur.length > 4) spur.shift();
      const v = spur[spur.length - 1]!.clone().sub(spur[0]!).divideScalar((spur.length - 1) * DT);
      const b = Math.hypot(v.x, v.z);
      if (i > 6 && b < vorher) break;
      vorher = b;
    }
  }
  const vEcht =
    spur.length >= 2
      ? spur[spur.length - 1]!.clone().sub(spur[0]!).divideScalar((spur.length - 1) * DT)
      : new THREE.Vector3();
  const ab = teil.translation();
  const start = new THREE.Vector3(ab.x, ab.y, ab.z);
  const winkel = ausschlag(bagger);
  grip.releaseAll();
  const v = teil.linvel();
  const vAbwurf = Math.hypot(v.x, v.z);
  /*
   * Flugbahn austragen. `grip.update` wird hier NICHT mehr gerufen: Mit
   * geschlossener Spinne faengt der Sensor das eben geworfene Teil sofort
   * wieder ein, und die Weite waere null.
   */
  for (let i = 0; i < 600; i++) {
    bagger.carriedMassKg = 0;
    bagger.grippedHandles.clear();
    bagger.update(DT, tasten as never);
    world.step();
  }
  const e = teil.translation();
  return {
    vAbwurf,
    vEcht: Math.hypot(vEcht.x, vEcht.z),
    weite: Math.hypot(e.x - start.x, e.z - start.z),
    hoeheAbwurf: start.y,
    ausschlagAbwurf: winkel,
  };
}

/**
 * Was ein Bild kostet — Bagger und Physikschritt zusammen, in Millisekunden.
 *
 * Gemessen wird im vollen Schwenk mit Ladung, also in dem Zustand, in dem der
 * Greifer schraeg haengt und die Rechnungen in der Greiferachse wirklich
 * laufen. Zwei Durchgaenge; der erste waermt nur auf.
 */
function kosten(form: Greiferform): { ms: number; koerper: number } {
  const { world, bagger, grip, tasten } = aufbau(form);
  for (let i = 0; i < 240; i++) {
    bagger.update(DT, tasten as never);
    world.step();
  }
  haenge(world, bagger, grip, 600);
  const lauf = (bilder: number): number => {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < bilder; i++) {
      tasten.down.clear();
      tasten.down.add("KeyQ");
      takt(bagger, grip);
      bagger.update(DT, tasten as never);
      grip.update(1, true, korb(bagger), DT);
      world.step();
    }
    return Number(process.hrtime.bigint() - t0) / 1e6 / bilder;
  };
  lauf(200);
  return { ms: lauf(600), koerper: world.bodies.len() };
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();

  console.log("=== Ausschlag des Greifers beim vollen Oberwagenschwenk ===\n");
  console.log("  Form                 | Last   | hoechster | Beharrung | Ruhe nach | Wechsel");
  console.log("  ---------------------+--------+-----------+-----------+-----------+--------");
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    for (const last of [0, 900]) {
      const s = schwenken(form, last);
      console.log(
        `  ${form.name.padEnd(20)} | ${String(last).padStart(4)}kg | ` +
          `${s.hoechster.toFixed(1).padStart(6)}°   | ${s.beharrung.toFixed(1).padStart(6)}°   | ` +
          `${s.ruheS.toFixed(2).padStart(6)} s  | ${String(s.wechsel).padStart(4)}`
      );
    }
  }

  console.log("\n=== Was ein Bild kostet (Bagger + Physikschritt, im Schwenk mit Ladung) ===\n");
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    const k = kosten(form);
    console.log(
      `  ${form.name.padEnd(20)} ${k.ms.toFixed(3)} ms je Bild   (${k.koerper} Koerper)`
    );
  }

  console.log("\n=== Werfen: aus vollem Schwung losgelassen (* = aus dem Rueckschwung) ===\n");
  console.log(
    "  Form                 | Last   | Ausschlag | v Korb   | v Abwurf | Hoehe  | Weite"
  );
  console.log(
    "  ---------------------+--------+-----------+----------+----------+--------+-------"
  );
  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    for (const [last, rueck] of [[300, false], [900, false], [300, true]] as const) {
      const w = werfen(form, last, rueck);
      console.log(
        `  ${form.name.padEnd(20)} | ${String(last).padStart(4)}kg${rueck ? "*" : " "}| ` +
          `${w.ausschlagAbwurf.toFixed(1).padStart(6)}°   | ` +
          `${w.vEcht.toFixed(2).padStart(5)} m/s | ` +
          `${w.vAbwurf.toFixed(2).padStart(5)} m/s | ` +
          `${w.hoeheAbwurf.toFixed(2).padStart(5)} m | ${w.weite.toFixed(2).padStart(5)} m`
      );
    }
  }
}

void main();
