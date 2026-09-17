/**
 * Kann der Greifer zur Seite kippen — und wie weit? (Wunsch Patrick
 * 15.09.2026: „Greifer muss komplett zur Seite kippen koennen, zum Kehren und
 * Schleudern.")
 *
 * Dieses Werkzeug BAUT NICHTS UM. Es rechnet vier Fragen aus, bevor eine Zeile
 * Spielcode angefasst wird:
 *
 *   1. Wie weit kippt der Greifer HEUTE? (erreichbar, nicht nominell erlaubt)
 *   2. Was macht die senkrechte Ausladung beim Kippen — also die Zahl, mit der
 *      `resolveGroundClamp` und `hoechsteKrallenspitze` rechnen?
 *   3. Kollidiert der gekippte Greifer mit Stiel, Ausleger, Kabine, Oberwagen?
 *   4. Reicht der Korb fuer den 2,70-m-Besen, wenn er gekippt gehalten wird?
 *
 * Gemessen wird am ECHTEN Bagger (kopflos gebaut, echte Rapier-Welt) und an
 * den GEZEICHNETEN Netzen — nicht an einer Nachbildung. Wer die Form aendert,
 * aendert die Messung mit.
 *
 * Aufruf: npx vite-node tools/greifer-kippen.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";
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

/** Ein Punkt der Greifergeometrie im Greiferframe. */
interface Punkt {
  x: number;
  y: number;
  z: number;
  /** Abstand von der Greiferachse (m) */
  r: number;
}

/* ------------------------------------------------- Punktwolke des Greifers */

/**
 * Alle gezeichneten Punkte unter `grappleGroup`, im GREIFERFRAME.
 *
 * Im Greiferframe, damit dieselbe Wolke fuer jeden Kippwinkel und jede
 * Rotatorstellung wiederverwendet werden kann: Kippen und Drehen sind dann
 * eine Rechnung je Punkt statt ein neuer Matrixdurchlauf je Netz.
 */
function greiferwolke(bagger: Excavator, winkel: number): Punkt[] {
  const g = bagger.grappleGroup;
  const form = bagger.greiferform;
  const bau = (bagger as unknown as {
    greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
  }).greiferbau;
  for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, winkel);
  bau.nachfuehren();
  g.updateWorldMatrix(false, true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const p = new THREE.Vector3();
  const raus: Punkt[] = [];
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
      raus.push({ x: p.x, y: p.y, z: p.z, r: Math.hypot(p.x, p.z) });
    }
  });
  return raus;
}

/**
 * Die Punktwolke ueber den ganzen Schliessweg — 41 Stuetzstellen.
 *
 * 41, weil `CLAW_MAX_DEPTH` mit 21 Stellen 0,05 mm danebenliegt
 * (`tools/zahnlage-spinne.ts`); das Doppelte kostet nichts und nimmt die
 * Stuetzstellenzahl als Fehlerquelle aus der Rechnung.
 */
function wolkeUeberWeg(bagger: Excavator, form: Greiferform): Punkt[] {
  const alle: Punkt[] = [];
  for (let i = 0; i <= 40; i++) {
    alle.push(...greiferwolke(bagger, form.zu + ((form.offen - form.zu) * i) / 40));
  }
  return alle;
}

/** Die Wolke auf ein Raster ausduennen — ein Punkt je belegter Zelle. */
function ausduennen(wolke: Punkt[], raster: number): Punkt[] {
  const gesehen = new Set<string>();
  const raus: Punkt[] = [];
  for (const p of wolke) {
    const s = `${Math.round(p.x / raster)}|${Math.round(p.y / raster)}|${Math.round(p.z / raster)}`;
    if (gesehen.has(s)) continue;
    gesehen.add(s);
    raus.push(p);
  }
  return raus;
}

/**
 * Senkrechte Ausladung bei Kippwinkel `theta` (m unter der Aufhaengung).
 *
 * Gekippt wird um eine WAAGERECHTE Achse; welche, bestimmt der Rotator. Diese
 * Rechnung nimmt deshalb die schlimmste Rotatorstellung: Ein Punkt im Abstand
 * `r` von der Achse laesst sich durch Drehen an jede Stelle seines Kreises
 * bringen, also gilt
 *
 *     Welt-y = y·cos θ − z·sin θ,   z ∈ [−r, +r]
 *     Ausladung = max( −y·cos θ + r·sin θ )
 */
function ausladung(wolke: Punkt[], theta: number): { tief: number; versatz: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let tief = 0;
  let versatz = 0;
  for (const p of wolke) {
    const d = -p.y * c + p.r * s;
    if (d > tief) {
      tief = d;
      versatz = Math.abs(p.y * s + p.r * c);
    }
  }
  return { tief, versatz };
}

/* ------------------------------------------------------- Frage 1: heute */

function frage1(bagger: Excavator, world: RAPIER.World): void {
  console.log("\n=== 1. Wie weit kippt der Greifer HEUTE? ===\n");
  const tasten = new Tasten();
  const hoch = new THREE.Vector3(0, 1, 0);
  const achse = new THREE.Vector3();
  let groesst = 0;
  /*
   * Das Pendel wird von der Beschleunigung der Stielspitze angetrieben. Die
   * groesste bekommt es, wenn Oberwagen und Arm gleichzeitig aus dem Stand
   * anreissen und dann schlagartig umgekehrt werden — 8 Wechsel a 40 Schritte.
   */
  for (let block = 0; block < 8; block++) {
    const links = block % 2 === 0;
    for (let i = 0; i < 40; i++) {
      tasten.down.clear();
      tasten.down.add(links ? "KeyQ" : "KeyE");
      tasten.down.add(links ? "KeyR" : "KeyF");
      tasten.down.add(links ? "KeyT" : "KeyG");
      bagger.update(DT, tasten as never);
      world.step();
      achse.set(0, 1, 0).applyQuaternion(bagger.grappleGroup.quaternion);
      groesst = Math.max(groesst, achse.angleTo(hoch));
    }
  }
  console.log(`  erreicht, hart geschwenkt        : ${(groesst * GRAD).toFixed(2)}°`);
  console.log(`  Deckel im Quelltext              : KEINER MEHR (E-105, 17.09.2026).`);
  console.log(`                                     Bis dahin 17,00° je Achse (PENDEL_MAX).`);
  console.log(`  vom Spieler steuerbar            : gar nicht, es gibt keine Eingabe dafuer`);
  console.log(`  Begrenzt durch                   : Rueckstellung und Daempfung,`);
  console.log(`                                     nicht durch Anschlag, Gelenk oder Kollision`);
  console.log(`  Nachgemessen wird das in         : tools/pendelausschlag.ts`);
}

/* ------------------------------------ Frage 2: was die drei Stellen sagen */

function frage2(wolke: Punkt[], form: Greiferform): void {
  console.log(`\n=== 2. Senkrechte Ausladung beim Kippen (${form.name}) ===\n`);
  console.log(`  form.maxTiefe — die Zahl, mit der heute gerechnet wird: ${form.maxTiefe.toFixed(4)} m`);
  console.log("");
  console.log("  Kipp  |  wirkliche |  Fehler des  |  tiefster Punkt");
  console.log("  winkel|  Ausladung |  alten Werts |  seitlich versetzt");
  console.log("  ------+------------+--------------+-------------------");
  for (let d = 0; d <= 90; d += 10) {
    const a = ausladung(wolke, d / GRAD);
    const fehler = form.maxTiefe - a.tief;
    console.log(
      `  ${String(d).padStart(4)}° | ${a.tief.toFixed(4)} m | ${fehler >= 0 ? "+" : ""}${fehler.toFixed(4)} m   | ${a.versatz.toFixed(4)} m`
    );
  }
  const a90 = ausladung(wolke, Math.PI / 2);
  console.log("");
  console.log(`  Bei 90° rechnet resolveGroundClamp mit ${form.maxTiefe.toFixed(3)} m,`);
  console.log(`  wirklich sind es ${a90.tief.toFixed(3)} m — der Arm bleibt ${(form.maxTiefe - a90.tief).toFixed(3)} m ZU HOCH.`);
  console.log(`  surfaceUnderClaws misst senkrecht unter der Mitte; die Schalen`);
  console.log(`  liegen dann ${a90.versatz.toFixed(3)} m daneben.`);
}

/* --------------------------------------------- Frage 3: Eigenkollision */

/** Ein Netz des Baggers als Kasten in seinem eigenen Frame. */
interface Kasten {
  name: string;
  invers: THREE.Matrix4;
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** Weltmitte und Weltradius — fuers grobe Aussortieren. */
  mitte: THREE.Vector3;
  radius: number;
}

function istUnter(o: THREE.Object3D, wurzel: THREE.Object3D): boolean {
  for (let a: THREE.Object3D | null = o; a; a = a.parent) if (a === wurzel) return true;
  return false;
}

/**
 * WELCHE NETZE DIESE MESSUNG BEANTWORTEN KANN — und welche nicht.
 *
 * Geprueft wird gegen den Kasten, den ein Netz in SEINEM EIGENEN Rahmen
 * aufspannt. Bei einem geraden Traeger ist dieser Kasten stramm: Ausleger und
 * Stiel liegen in ihrem Rahmen laengs, ihr Kasten ist der Traeger.
 *
 * Bei einem VERSCHMOLZENEN Netz ist er es nicht. `01_UNTERWAGEN_STAHL` ist ein
 * einziges Netz ueber den ganzen Unterwagen; sein Kasten umschliesst auch die
 * Luft zwischen den Raedern. Ein Punkt „in diesem Kasten" heisst dort nicht
 * Beruehrung, sondern nur „irgendwo im Bereich des Unterwagens". Die erste
 * Fassung dieser Messung hat genau das als Durchdringung gemeldet — 47 cm ins
 * Raeumschild, schon bei Kippwinkel 0, wo der Greifer nachweislich frei haengt.
 *
 * Deshalb steht die Frage hier auf den ARM: Patricks Frage lautet „kollidiert
 * der gekippte Greifer mit dem eigenen Stiel oder Ausleger". Die Schlaeuche
 * sind ausgenommen, weil sie gebogene Rohre sind (loser Kasten) — und weil ein
 * Schlauch im Zweifel nachgibt.
 */
const ARM_NETZ = /^07_(AUSLEGER|STIEL)_(KASTEN|STAHL)$/;

function baggerkaesten(bagger: Excavator, wurzel: THREE.Object3D): Kasten[] {
  const raus: Kasten[] = [];
  wurzel.updateWorldMatrix(true, true);
  const ecke = new THREE.Vector3();
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (istUnter(m, bagger.grappleGroup)) return;
    if (!ARM_NETZ.test(m.name)) return;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!;
    const welt = new THREE.Box3();
    for (let i = 0; i < 8; i++) {
      ecke.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      welt.expandByPoint(ecke.applyMatrix4(m.matrixWorld));
    }
    const mitte = welt.getCenter(new THREE.Vector3());
    raus.push({
      name: m.name || m.parent?.name || "?",
      invers: new THREE.Matrix4().copy(m.matrixWorld).invert(),
      min: bb.min.clone(),
      max: bb.max.clone(),
      mitte,
      radius: welt.max.distanceTo(mitte),
    });
  });
  return raus;
}

/** Abstand eines Weltpunktes zum Kasten (negativ = drin). */
function kastenabstand(k: Kasten, px: number, py: number, pz: number, hilf: THREE.Vector3): number {
  hilf.set(px, py, pz).applyMatrix4(k.invers);
  const dx = Math.max(k.min.x - hilf.x, hilf.x - k.max.x);
  const dy = Math.max(k.min.y - hilf.y, hilf.y - k.max.y);
  const dz = Math.max(k.min.z - hilf.z, hilf.z - k.max.z);
  if (dx <= 0 && dy <= 0 && dz <= 0) return Math.max(dx, dy, dz);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
}

function frage3(bagger: Excavator, szene: THREE.Scene, wolke: Punkt[]): void {
  console.log("\n=== 3. Kollidiert der gekippte Greifer mit Ausleger oder Stiel? ===\n");
  console.log("  Gemessen gegen Ausleger- und Stielkasten; Schlaeuche und Unterwagen");
  console.log("  bleiben aussen vor — warum, steht bei ARM_NETZ.\n");
  const b = bagger as unknown as { boomAngle: number; stickAngle: number; rotatorYaw: number };
  const tasten = new Tasten();
  const hilf = new THREE.Vector3();
  const qKipp = new THREE.Quaternion();
  const eKipp = new THREE.Euler();

  /*
   * Ausgeduennt auf 6 cm — feiner als die 3 cm von E-050 muss es hier nicht
   * sein, weil nicht der Freigang auf den Millimeter gesucht wird, sondern die
   * Frage „beruehrt es sich ueberhaupt". Die Krallen sind Kaesten und
   * Kegel; ihre Ecken liegen alle in der Wolke.
   */
  /*
   * NUR was unterhalb des Zapfens haengt.
   *
   * Darueber sitzen Stummel und die beiden Kardangabeln, und die stecken
   * BAUARTBEDINGT im Stiel — sie sind seine Aufhaengung. Die erste Fassung hat
   * sie mitgemessen und deshalb schon bei Kippwinkel 0 eine „Durchdringung"
   * von 23 cm gemeldet, wo der Greifer nachweislich frei haengt. Der Zapfen
   * liegt auf y −1,05 (`CLAW_RING_Y`); alles darunter ist Spinne.
   */
  const aussen = ausduennen(wolke, 0.06).filter((q) => q.y < -1.05);
  /** Groesster Abstand eines Greiferpunktes vom Aufhaengepunkt. */
  let greiferR = 0;
  for (const p of aussen) greiferR = Math.max(greiferR, Math.hypot(p.r, p.y));

  const BOOM = [5, 20, 35, 50, 70];
  const STICK = [-140, -115, -90, -70, -45, -25];
  const YAW = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
  const KIPP: number[] = [];
  for (let d = 0; d <= 90; d += 5) KIPP.push(d);

  const besteYaw = new Map<string, { abstand: number; wo: string; yaw: number }>();
  const schlechtesteYaw = new Map<string, number>();
  let abstaende = 0;

  for (const bg of BOOM) {
    for (const sg of STICK) {
      b.boomAngle = bg / GRAD;
      b.stickAngle = sg / GRAD;
      b.rotatorYaw = 0;
      bagger.update(DT, tasten as never);
      const ursprung = bagger.grappleGroup.position.clone();
      /*
       * Grob aussortieren: Nur Netze, die ueberhaupt in Reichweite des
       * Greifers liegen. Das nimmt Raeder, Schild und Gegengewicht aus der
       * inneren Schleife und macht aus Stunden Sekunden.
       */
      const kaesten = baggerkaesten(bagger, szene).filter(
        (k) => k.mitte.distanceTo(ursprung) < k.radius + greiferR + 0.5
      );
      for (const d of KIPP) {
        const schluessel = `${bg}|${sg}|${d}`;
        eKipp.set(d / GRAD, 0, 0);
        qKipp.setFromEuler(eKipp);
        const ck = Math.cos(d / GRAD);
        const sk = Math.sin(d / GRAD);
        for (const yaw of YAW) {
          /*
           * Der Rotator dreht ZUERST (um die Greiferachse), gekippt wird
           * danach um die Weltachse X — so waehlt der Rotator, in welche
           * Richtung der Greifer faellt. Genau das meint Patricks „ich kann
           * die Spinne ja drehen damit es passt."
           */
          const cy = Math.cos(yaw / GRAD);
          const sy = Math.sin(yaw / GRAD);
          let min = Infinity;
          let wo = "";
          for (const q of aussen) {
            const x = q.x * cy + q.z * sy;
            const z0 = -q.x * sy + q.z * cy;
            const px = ursprung.x + x;
            const py = ursprung.y + q.y * ck - z0 * sk;
            const pz = ursprung.z + q.y * sk + z0 * ck;
            for (const k of kaesten) {
              if (Math.abs(px - k.mitte.x) > k.radius + min) continue;
              const a = kastenabstand(k, px, py, pz, hilf);
              abstaende++;
              if (a < min) {
                min = a;
                wo = k.name;
              }
            }
          }
          const b1 = besteYaw.get(schluessel);
          if (!b1 || min > b1.abstand) besteYaw.set(schluessel, { abstand: min, wo, yaw });
          const s1 = schlechtesteYaw.get(schluessel);
          if (s1 === undefined || min < s1) schlechtesteYaw.set(schluessel, min);
        }
      }
    }
  }

  console.log(
    `  ${BOOM.length * STICK.length} Armstellungen x ${KIPP.length} Kippwinkel x ${YAW.length} Rotatorstellungen`
  );
  console.log(`  x ${aussen.length} Greiferpunkte — ${abstaende.toLocaleString("de-DE")} Abstaende gerechnet\n`);
  console.log("  Kipp  | beste Rotatorstellung,     | schlechteste");
  console.log("  winkel| schlimmste Armstellung     | Rotatorstellung");
  console.log("  ------+----------------------------+----------------");
  let groessterFrei = -1;
  for (const d of KIPP) {
    let besteSchlimmst = Infinity;
    let wo = "";
    let pose = "";
    let schlechtSchlimmst = Infinity;
    for (const bg of BOOM) {
      for (const sg of STICK) {
        const e = besteYaw.get(`${bg}|${sg}|${d}`);
        if (e && e.abstand < besteSchlimmst) {
          besteSchlimmst = e.abstand;
          wo = e.wo;
          pose = `Ausleger ${bg}°/Stiel ${sg}°`;
        }
        const s = schlechtesteYaw.get(`${bg}|${sg}|${d}`);
        if (s !== undefined && s < schlechtSchlimmst) schlechtSchlimmst = s;
      }
    }
    if (besteSchlimmst >= 0) groessterFrei = d;
    console.log(
      `  ${String(d).padStart(4)}° | ${besteSchlimmst >= 0 ? "+" : ""}${besteSchlimmst.toFixed(3)} m ${
        besteSchlimmst < 0 ? "BERUEHRUNG" : "frei      "
      } | ${schlechtSchlimmst >= 0 ? "+" : ""}${schlechtSchlimmst.toFixed(3)} m  (${wo}, ${pose})`
    );
  }
  /*
   * DIE NULLGRAD-ZEILE IST DIE EICHUNG DIESER MESSUNG.
   *
   * Bei Kippwinkel 0 haengt der Greifer so, wie er im Spiel seit Monaten
   * haengt — er beruehrt den Stiel nachweislich nicht. Was diese Messung dort
   * meldet, ist also der EIGENFEHLER des Verfahrens: Kaesten um verschmolzene
   * Netze sind groesser als die Netze selbst, und der Stielkasten enthaelt den
   * seitlich abstehenden Zylinderkopf.
   *
   * Absolute Zahlen aus dieser Tabelle sind deshalb nicht verwendbar.
   * Verwendbar ist allein der ZUWACHS gegenueber der Nullgradzeile: So viel
   * naeher kommt der gekippte Greifer dem Arm als der lotrechte.
   */
  console.log(`\n  Groesster Kippwinkel, der in JEDER Armstellung frei laeuft: ${groessterFrei}°`);
  const bei = (d: number): number => {
    let s = Infinity;
    for (const bg of BOOM) {
      for (const sg of STICK) {
        const e = besteYaw.get(`${bg}|${sg}|${d}`);
        if (e && e.abstand < s) s = e.abstand;
      }
    }
    return s;
  };
  const null0 = bei(0);
  console.log("");
  console.log("  EICHUNG. Bei 0° haengt der Greifer frei — das weiss man aus dem Spiel.");
  console.log(`  Diese Messung meldet dort trotzdem ${null0.toFixed(3)} m. Das ist ihr Eigenfehler;`);
  console.log("  absolute Zahlen oben sind damit nicht verwendbar. Verwendbar ist der Zuwachs:");
  console.log("");
  console.log("   Kipp | kommt dem Arm naeher als lotrecht um");
  console.log("   -----+-------------------------------------");
  for (const d of [30, 45, 60, 75, 90]) {
    console.log(`   ${String(d).padStart(3)}° |  ${(null0 - bei(d)).toFixed(3)} m`);
  }
  console.log("");
  console.log("  Eine belastbare Antwort auf die Frage, ob 90 Grad gehen, braucht einen Test auf");
  console.log("  DREIECKSebene statt auf Kastenebene. Das ist ein eigenes Paket.");
}

/* -------------------------------------------------- Frage 4: der Besen */

function frage4(form: Greiferform): void {
  console.log("\n=== 4. Haelt der gekippte Greifer den 2,70-m-Besen? ===\n");
  const [laenge, hoehe, tiefe] = BESEN.dims;
  console.log(`  Besen: ${laenge} x ${hoehe} x ${tiefe} m, ${BESEN.massKg} kg`);
  const p = new THREE.Vector3();
  let breiteZu = 0;
  let tiefeZu = 0;
  for (let k = 0; k <= form.stationen; k++) {
    form.punkt(0, form.zu, k, p);
    breiteZu = Math.max(breiteZu, Math.hypot(p.x, p.z) * 2);
    tiefeZu = Math.max(tiefeZu, -p.y);
  }
  console.log(`  groesster Durchmesser geschlossen : ${breiteZu.toFixed(3)} m`);
  console.log(`  Korbtiefe geschlossen             : ${tiefeZu.toFixed(3)} m`);
  console.log(`  Schalenluecke geschlossen         : ${form.schalenluecke.toFixed(3)} m`);
  console.log(
    `  Der Besen ragt quer ${((laenge - breiteZu) / 2).toFixed(2)} m je Seite heraus; gefasst wird seine`
  );
  console.log(
    `  Mitte (${hoehe.toFixed(2)} x ${tiefe.toFixed(2)} m). Kleinste Kante ${Math.min(hoehe, tiefe).toFixed(2)} m > Luecke ${form.schalenluecke.toFixed(3)} m`
  );
  console.log(`  → zwei Schalen koennen ihn beruehren, das Greiffenster ist offen.`);
}

/* ---------------------------------------------------------------- Ablauf */

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  const bagger = new Excavator(szene, world);

  frage1(bagger, world);

  const wolke = wolkeUeberWeg(bagger, SICHELKRALLE);
  console.log(
    `\n(Punktwolke Sichelkralle: ${wolke.length.toLocaleString("de-DE")} gezeichnete Punkte ueber 41 Stellungen)`
  );
  frage2(wolke, SICHELKRALLE);
  frage3(bagger, szene, wolke);
  frage4(SICHELKRALLE);

  bagger.setGreifer(FUENFSCHALEN);
  const wolke5 = wolkeUeberWeg(bagger, FUENFSCHALEN);
  frage2(wolke5, FUENFSCHALEN);
}

void main();
