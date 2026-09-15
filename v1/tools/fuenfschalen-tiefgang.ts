/**
 * Warum kommt der Fuenfschalengreifer nicht bis zum Boden? (Geraetebefund
 * Patrick, 15.09.2026: „der neue greifer fuehlt sich zaeh, falsch konstruiert
 * an und senkt nicht weit genug runter, weil die traverse stoert")
 *
 * Drei Aussagen, und dieses Werkzeug haelt Zahlen gegen jede einzelne. Es
 * BAUT NICHTS UM.
 *
 *   A. Welches BAUTEIL haengt bei welcher Schliessstellung am tiefsten —
 *      Traverse oder Zahn? Genau das ist Patricks Vermutung, und sie laesst
 *      sich beantworten, statt sie zu glauben.
 *   B. Wie hoch ueber dem Beton steht der Greifer, wenn er aufsetzt und dann
 *      zupackt? Dieselbe Messung fuer beide Formen, dieselbe Armstellung.
 *   C. „Zaeh" — welche Zahl steht dahinter? Schliesszeit, Weg bis zum ersten
 *      Kontakt, noetige Schalen je Teilegroesse, Sensorkugel.
 *
 * Gemessen wird am ECHTEN Bagger in einer echten Rapier-Welt und an den
 * GEZEICHNETEN Netzen.
 *
 * Aufruf: npx vite-node tools/fuenfschalen-tiefgang.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";
import { noetigeKrallenFuer } from "../src/physics/gripSystem";

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

/* ------------------------------------------------ A: welches Teil haengt tief */

/** Der Name, unter dem ein Netz in der Tabelle auftaucht. */
function teilname(m: THREE.Object3D, wurzel: THREE.Object3D): string {
  const kette: string[] = [];
  for (let a: THREE.Object3D | null = m; a && a !== wurzel; a = a.parent) {
    if (a.name) kette.unshift(a.name);
  }
  return kette.length ? kette.join("/") : "(ohne Namen)";
}

interface Tiefstes {
  tief: number;
  teil: string;
}

/** Tiefster gezeichneter Punkt unter der Aufhaengung, bei diesem Winkel. */
function tiefstesTeil(bagger: Excavator, winkel: number): Tiefstes {
  const g = bagger.grappleGroup;
  const form = bagger.greiferform;
  /*
   * Gegenprobe gegen den Fehler, der diese Messung schon einmal wertlos
   * gemacht hat: Ein Winkel ausserhalb der Anschlaege der ANGEHAENGTEN Form
   * heisst, dass gerade der falsche Greifer am Arm sitzt.
   */
  if (winkel < form.zu - 1e-6 || winkel > form.offen + 1e-6) {
    throw new Error(
      `Winkel ${winkel.toFixed(4)} liegt ausserhalb von ${form.name} (${form.zu} … ${form.offen})`
    );
  }
  const bau = (bagger as unknown as {
    greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
  }).greiferbau;
  for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, winkel);
  bau.nachfuehren();
  g.updateWorldMatrix(false, true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const p = new THREE.Vector3();
  let tief = 0;
  let teil = "?";
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) {
      if (!a.visible) return;
    }
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mm);
      if (-p.y > tief) {
        tief = -p.y;
        teil = teilname(m, g);
      }
    }
  });
  return { tief, teil };
}

/**
 * Tiefster Punkt der Baugruppen, die NICHT mitschwenken — „die Traverse".
 *
 * Was „nicht mitschwenken" heisst, wird GEMESSEN und nicht am Namen erkannt:
 * Das Modell wird zweimal gestellt, einmal zu und einmal offen, und nur die
 * Netze zaehlen, deren Weltmatrix sich dabei nicht ruehrt. Die erste Fassung
 * hat die Bauteile am Namen aussortiert und dabei alle fuenf Schalen des
 * Fuenfschalengreifers fuer fest gehalten (sie heissen `SHELL_*`, nicht
 * `SCHALE_*`) — Ergebnis war eine Traverse, die angeblich 2,90 m tief haengt.
 */
function tiefsterFestpunkt(bagger: Excavator): Tiefstes {
  const g = bagger.grappleGroup;
  const form = bagger.greiferform;
  const bau = (bagger as unknown as {
    greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
  }).greiferbau;
  const stelle = (w: number): Map<THREE.Mesh, string> => {
    for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, w);
    bau.nachfuehren();
    g.updateWorldMatrix(false, true);
    const raus = new Map<THREE.Mesh, string>();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      /*
       * Der abgehaengte Greifer bleibt im Baum stehen, nur unsichtbar
       * (`setGreifer` schaltet `gruppe.visible`). Ohne diese Zeile zaehlt die
       * unsichtbare Sichelkralle als „steht fest" und liefert die Traverse des
       * Fuenfschalengreifers mit 2,95 m — ihrem eigenen Zahn.
       */
      for (let a: THREE.Object3D | null = m; a && a !== g; a = a.parent) {
        if (!a.visible) return;
      }
      raus.set(m, m.matrixWorld.elements.map((e) => e.toFixed(6)).join(","));
    });
    return raus;
  };
  const a = stelle(form.zu);
  const b = stelle(form.offen);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const p = new THREE.Vector3();
  let tief = 0;
  let teil = "?";
  let feste = 0;
  for (const [m, lageOffen] of b) {
    if (a.get(m) !== lageOffen) continue; // hat sich bewegt → Schale
    feste++;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const mm = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mm);
      if (-p.y > tief) {
        tief = -p.y;
        teil = teilname(m, g);
      }
    }
  }
  return { tief, teil: `${teil}, ${feste} von ${b.size} Netzen stehen fest` };
}

function frageA(bagger: Excavator, form: Greiferform): void {
  console.log(`\n=== A. Welches Bauteil haengt am tiefsten? (${form.name}) ===\n`);
  const fest = tiefsterFestpunkt(bagger);
  console.log(`  Tiefster Punkt, der NICHT mitschwenkt: ${fest.tief.toFixed(4)} m  (${fest.teil})`);
  console.log(`  — das ist der Kandidat „Traverse".\n`);
  console.log("  Anteil | Winkel |  tiefster  | welches Bauteil");
  console.log("  am Weg |  (rad) |   Punkt    |");
  console.log("  -------+--------+------------+-----------------------------");
  let maxT = 0;
  let maxAnteil = 0;
  for (let i = 0; i <= 10; i++) {
    const anteil = i / 10;
    const w = form.zu + (form.offen - form.zu) * anteil;
    const t = tiefstesTeil(bagger, w);
    if (t.tief > maxT) {
      maxT = t.tief;
      maxAnteil = anteil;
    }
    console.log(
      `  ${(anteil * 100).toFixed(0).padStart(5)}% | ${w.toFixed(4)} | ${t.tief.toFixed(4)} m | ${t.teil}`
    );
  }
  console.log("");
  console.log(`  Tiefste Stellung: ${(maxAnteil * 100).toFixed(0)} % des Weges, ${maxT.toFixed(4)} m`);
  console.log(`  form.maxTiefe (womit der Bodenanschlag rechnet): ${form.maxTiefe.toFixed(4)} m`);
  console.log(
    `  Die Traverse liegt ${(maxT - fest.tief).toFixed(3)} m HOEHER als der tiefste Punkt — sie beruehrt den Boden nie.`
  );
}

/* ------------------------------------------- B: wie hoch steht er ueber Beton */

interface Aufsatz {
  armtiefeY: number;
  boom: number;
  stick: number;
  offenUeberBeton: number;
  zuUeberBeton: number;
  tiefstesTeilZu: string;
  anschlagAktiv: string;
}

/** Arm absenken, bis der Bodenanschlag haelt; dann messen. */
function absetzen(bagger: Excavator, world: RAPIER.World, form: Greiferform): Aufsatz {
  if (bagger.greiferform.id !== form.id) {
    throw new Error(`Am Arm haengt ${bagger.greiferform.name}, gemessen werden soll ${form.name}`);
  }
  const tasten = new Tasten();
  const b = bagger as unknown as {
    boomAngle: number;
    stickAngle: number;
    rotatorYaw: number;
    closure: number;
    clawSplayIst: number[];
  };
  /* Immer aus derselben Stellung starten, damit beide Formen vergleichbar sind. */
  b.boomAngle = 35 / GRAD;
  b.stickAngle = -70 / GRAD;
  b.rotatorYaw = 0;
  b.closure = 0;
  b.clawSplayIst = new Array(form.schalen).fill(form.offen);
  /* Arm senken (KeyF = Ausleger runter, KeyG = Stiel), 400 Schritte. */
  for (let i = 0; i < 400; i++) {
    tasten.down.clear();
    tasten.down.add("KeyF");
    bagger.update(DT, tasten as never);
    world.step();
  }
  const g = bagger.grappleGroup;
  const offenTief = tiefstesTeil(bagger, form.offen);
  const offenUeberBeton = g.position.y - offenTief.tief;
  /* Jetzt zupacken. */
  for (let i = 0; i < 120; i++) {
    tasten.down.clear();
    tasten.down.add("KeyF");
    tasten.down.add("Space");
    bagger.update(DT, tasten as never);
    world.step();
  }
  const istWinkel = b.clawSplayIst[0] ?? form.zu;
  const zuTief = tiefstesTeil(bagger, istWinkel);
  return {
    armtiefeY: g.position.y,
    boom: b.boomAngle * GRAD,
    stick: b.stickAngle * GRAD,
    offenUeberBeton,
    zuUeberBeton: g.position.y - zuTief.tief,
    tiefstesTeilZu: zuTief.teil,
    anschlagAktiv:
      Math.abs(b.boomAngle * GRAD - 5) < 0.2
        ? "Ausleger am unteren Anschlag (5°)"
        : Math.abs(b.stickAngle * GRAD + 140) < 0.2
          ? "Stiel am Anschlag (-140°)"
          : "Bodenanschlag (resolveGroundClamp)",
  };
}

function frageB(a: Aufsatz, form: Greiferform): void {
  console.log(`\n  ${form.name}`);
  console.log(`    Aufhaengung steht auf y ${a.armtiefeY.toFixed(3)} m`);
  console.log(`    Arm: Ausleger ${a.boom.toFixed(1)}° / Stiel ${a.stick.toFixed(1)}°`);
  console.log(`    gehalten von: ${a.anschlagAktiv}`);
  console.log(`    OFFEN, tiefster Punkt ueber Beton : ${(a.offenUeberBeton * 100).toFixed(1)} cm`);
  console.log(`    ZU,    tiefster Punkt ueber Beton : ${(a.zuUeberBeton * 100).toFixed(1)} cm  (${a.tiefstesTeilZu})`);
  console.log(
    `    rechnerisch: maxTiefe ${form.maxTiefe.toFixed(4)} − tiefe(zu) ${form.tiefe(form.zu).toFixed(4)} = ${((form.maxTiefe - form.tiefe(form.zu)) * 100).toFixed(1)} cm`
  );
}

/* ------------------------------------------------------------- C: „zaeh" */

function frageC(s: Greiferform, f: Greiferform): void {
  console.log("\n=== C. Zaeh: welche Zahl steht dahinter? ===\n");
  const zeile = (name: string, a: string, b: string): void =>
    console.log(`  ${name.padEnd(38)} ${a.padStart(12)} ${b.padStart(12)}`);
  zeile("", "Sichelkralle", "Fuenfschalen");
  console.log("  " + "-".repeat(64));
  zeile("Schliessweg (rad)", (s.offen - s.zu).toFixed(4), (f.offen - f.zu).toFixed(4));
  zeile(
    "verlangtes Tempo bei CLOSE_TIME 0,4 s",
    ((s.offen - s.zu) / 0.4).toFixed(3),
    ((f.offen - f.zu) / 0.4).toFixed(3)
  );
  zeile("Schalenrate (rad/s)", s.rate.toFixed(3), f.rate.toFixed(3));
  zeile("Spielraum (Rate / verlangt)", (s.rate / ((s.offen - s.zu) / 0.4)).toFixed(3), (f.rate / ((f.offen - f.zu) / 0.4)).toFixed(3));
  zeile("Schalenluecke zu (m)", s.schalenluecke.toFixed(4), f.schalenluecke.toFixed(4));
  zeile("Sensorradius (m)", s.sensorRadius.toFixed(4), f.sensorRadius.toFixed(4));
  zeile("maxTiefe (m)", s.maxTiefe.toFixed(4), f.maxTiefe.toFixed(4));
  zeile("tiefe geschlossen (m)", s.tiefe(s.zu).toFixed(4), f.tiefe(f.zu).toFixed(4));
  zeile("tiefe offen (m)", s.tiefe(s.offen).toFixed(4), f.tiefe(f.offen).toFixed(4));
  zeile(
    "SCHWEBT geschlossen (cm)",
    ((s.maxTiefe - s.tiefe(s.zu)) * 100).toFixed(1),
    ((f.maxTiefe - f.tiefe(f.zu)) * 100).toFixed(1)
  );
  console.log("");
  console.log("  Noetige Schalen je Teilegroesse (E-043):");
  console.log("    Groesse |  Sichel | Fuenfschalen");
  for (const gm of [0.2, 0.4, 0.6, 0.63, 0.8, 1.0, 1.5]) {
    console.log(
      `    ${gm.toFixed(2)} m |  ${noetigeKrallenFuer(gm, s.schalenluecke)}      |  ${noetigeKrallenFuer(gm, f.schalenluecke)}`
    );
  }
}

/* ------------------------------------------------- D: woran es wirklich haengt */

/**
 * Warum die Schale beim Schliessen wieder hochkommt — und was daran drehbar
 * ist.
 *
 * Die Schale ist EIN starrer Koerper an EINEM Bolzen (`STEMPEL_AUGE`). Ihr
 * Zahn sitzt im Rahmen des Bolzens auf (−A / −B): A tief darunter, B nach
 * innen. Beim Schwenken um `s` ist die Tiefe des Zahns unter der Aufhaengung
 *
 *     T(s) = |y_Bolzen| + A·cos s + B·sin s
 *
 * Das ist eine Sinuswelle. Sie ist am groessten bei s* = atan(B/A) mit dem
 * Wert sqrt(A² + B²), und geschlossen (s = 0) ist sie A. Der Greifer schwebt
 * also um
 *
 *     SCHWEBT = sqrt(A² + B²) − A
 *
 * ueber dem Beton, und das ist keine Einstellung, sondern eine Folge der
 * Anlenkung: Ein Zahn, der geschlossen auf der Achse stehen muss, hat B ≈ dem
 * Bolzenkreisradius zu ueberbruecken und hebt sich dabei zwangslaeufig.
 *
 * Die Sichelkralle hat dieses Problem nicht, weil ihre Kralle KEIN starrer
 * Koerper an einem Bolzen ist, sondern eine Kette aus acht Segmenten: Sie
 * rollt sich ein, statt zu schwenken, und ihre Spitze bleibt dabei unten.
 */
function frageD(form: Greiferform): void {
  console.log("\n=== D. Woran die 25 cm wirklich haengen ===\n");
  /*
   * A und B werden aus der FORM zurueckgerechnet, nicht abgeschrieben: aus der
   * Tiefe geschlossen und der groessten Tiefe ueber den Weg. Damit kann die
   * Tabelle nicht von der gebauten Schale abweichen.
   */
  const p = new THREE.Vector3();
  form.punkt(0, form.zu, form.stationen, p);
  const yBolzen = 1.5335; // STEMPEL_AUGE.y, siehe src/fuenfschalen/teile.ts
  const A = form.tiefe(form.zu) - yBolzen;
  const B = Math.sqrt(Math.max(form.maxTiefe - yBolzen, 0) ** 2 - A ** 2);
  const sStern = Math.atan2(B, A);
  console.log(`  Zahn unter dem Bolzen   A = ${A.toFixed(4)} m`);
  console.log(`  Zahn innen vom Bolzen   B = ${B.toFixed(4)} m   (Bolzenkreis r = 0,59 m)`);
  console.log(`  tiefste Stellung        s* = ${sStern.toFixed(4)} rad = ${((sStern / (form.offen - form.zu)) * 100).toFixed(0)} % des Weges`);
  console.log(
    `  Probe: sqrt(A²+B²) − A = ${((Math.hypot(A, B) - A) * 100).toFixed(1)} cm, gemessen ${((form.maxTiefe - form.tiefe(form.zu)) * 100).toFixed(1)} cm`
  );
  console.log("");
  console.log("  Wie weit der Greifer schwebt, wenn man EINE Zahl aendert:");
  console.log("");
  console.log("   Bolzenkreis B |  schwebt | dafuer muesste");
  console.log("   --------------+----------+---------------------------------");
  for (const b of [0.742, 0.65, 0.55, 0.45, 0.35, 0.3]) {
    console.log(
      `      ${b.toFixed(3)} m   |  ${((Math.hypot(A, b) - A) * 100).toFixed(1).padStart(4)} cm | Stempelauge r ${(0.59 * (b / B)).toFixed(2)} m`
    );
  }
  console.log("");
  console.log("   Schale laenger A |  schwebt");
  console.log("   -----------------+----------");
  for (const a of [A, 1.2, 1.5, 2.0, 2.5]) {
    console.log(`       ${a.toFixed(3)} m     |  ${((Math.hypot(a, B) - a) * 100).toFixed(1).padStart(4)} cm`);
  }
  console.log("");
  console.log("  Zum Vergleich Sichelkralle: 5,1 cm — sie schwenkt nicht, sie rollt sich ein.");
}

/* ---------------------------------------------------------------- Ablauf */

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(80, 0.5, 80), boden);
  const szene = new THREE.Scene();
  const bagger = new Excavator(szene, world);

  frageA(bagger, SICHELKRALLE);
  const aS = absetzen(bagger, world, SICHELKRALLE);

  /*
   * Erst aufraeumen, dann wechseln. `setGreifer` verweigert bei geschlossener
   * Spinne (E-059) und liefert dann still `false` — genau daran ist die erste
   * Fassung dieser Messung gescheitert: Sie hat die SICHELKRALLE auf die
   * Winkel des Fuenfschalengreifers gestellt und die Zahlen als dessen
   * ausgegeben. Deshalb steht hier ein Abbruch statt eines Aufrufs.
   */
  const b = bagger as unknown as { closure: number; clawSplayIst: number[] };
  b.closure = 0;
  b.clawSplayIst = new Array(SICHELKRALLE.schalen).fill(SICHELKRALLE.offen);
  if (!bagger.setGreifer(FUENFSCHALEN)) throw new Error("Greiferwechsel verweigert");
  if (bagger.greiferform.id !== "fuenfschalen") throw new Error("Greifer haengt nicht");
  frageA(bagger, FUENFSCHALEN);
  const aF = absetzen(bagger, world, FUENFSCHALEN);

  console.log("\n=== B. Wie hoch steht der Greifer ueber dem Beton? ===");
  frageB(aS, SICHELKRALLE);
  frageB(aF, FUENFSCHALEN);

  frageC(SICHELKRALLE, FUENFSCHALEN);
  frageD(FUENFSCHALEN);
}

void main();
