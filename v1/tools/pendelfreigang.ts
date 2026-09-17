/**
 * Schlaegt der ausgeschlagene Greifer an den eigenen Arm?
 *
 * Die Frage zu E-105: Seit das Pendel keine Winkelsperre mehr hat, haengt der
 * Greifer im Schwenk bis zu 20 Grad schraeg. Beruehrt er dabei Armstellungen,
 * in denen er lotrecht noch frei haengt?
 *
 * ## WARUM DAS BILLIG ZU BEANTWORTEN IST — und die Kippmessung von E-085 nicht
 *
 * Das Pendel dreht den Greifer in der WELT, der Rotator dreht ihn um seine
 * EIGENE Achse — und der Rotator steht ganz rechts in der Drehkette
 * (`qPendel · qGier`). Laesst man den Rotator einmal ganz herumlaufen,
 * ueberstreicht der Greifer also einen Drehkoerper um seine eigene Achse, und
 * die Schraeglage dreht diesen Drehkoerper als Ganzes.
 *
 * Damit gilt derselbe Kunstgriff wie in `test/greiferNullgrad.test.ts`: Statt
 * 24 Rotatorstellungen einzeln abzufragen, wird der Greifer EINMAL als
 * Drehprofil (Achsabstand | Hoehe) abgelegt, und jeder Armpunkt wird in die
 * Greiferachse zurueckgedreht. Das ist strenger als Stichproben — zwischen
 * zwei Stichproben rutscht nichts durch — und um Groessenordnungen billiger.
 *
 * Bei E-085 ging das nicht: Dort stand der Kippwinkel RECHTS vom Rotator, im
 * eigenen Frame des Greifers. Dann ist der ueberstrichene Koerper kein
 * Drehkoerper mehr, und es half nur Abtasten.
 *
 * ## WAS GEMESSEN WIRD
 *
 * Je Armstellung (dieselben 62 erreichbaren wie in E-085/E-095) und je
 * Schraeglage (Betrag θ, Himmelsrichtung φ in 24 Schritten): der kleinste
 * Abstand zwischen Armoberflaeche und Greiferoberflaeche, ueber ALLE
 * Rotatorstellungen. Gezaehlt wird eine Armstellung als „beruehrt", wenn der
 * Abstand unter die Fehlerschranke beider Abtastungen faellt.
 *
 * ZUM AUFRUF, und bitte genau so: `greifer-freigang.ts` startet beim
 * IMPORTIEREN seine eigene Messung, wenn `process.env.VITEST` nicht gesetzt
 * ist (der Grund steht dort unten). Dieses Werkzeug holt sich von dort die
 * Armstellungen. Die Kennung im Quelltext zu setzen hilft nicht — Importe
 * laufen vor jeder Anweisung. Also von aussen:
 *
 * Aufruf: VITEST=true npx vite-node tools/pendelfreigang.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { Drehprofil, abtasten, dreieckssuppe, eps } from "./freigang-kern";
import {
  BOOM_MAX,
  BOOM_MIN,
  DECKEL,
  HOCHSTAND,
  STICK_MAX,
  STICK_MIN,
  VORHALT,
  formVermessen,
  posenBauen,
  reihe,
  type Form,
} from "./greifer-freigang";

/** Raster beider Seiten (m) — wie im Nullgrad-Waechter. */
const RASTER = 0.03;
/** Schranke, ab der „beruehrt" gilt: beide Abtastfehler zusammen. */
const GRENZE = 2 * eps(RASTER);
/** Oeffnungsstellungen, ueber die der Greifer zusammengelegt wird. */
const SPLAY = 6;
/** Schlaeuche geben nach und zaehlen nicht als Hindernis. */
const SCHLAUCH = /SCHLAUCH/;
const GRAD = Math.PI / 180;

/**
 * Schraeglagen, die gemessen werden (Grad) — ueberschreibbar auf der
 * Befehlszeile, etwa `... tools/pendelfreigang.ts 17 20`.
 *
 * Die Vorgabe deckt ab, was das Pendel wirklich erreicht: 17,3 Grad war der
 * groesste Ausschlag MIT dem alten Deckel, 20,2 ohne ihn
 * (`tools/pendelausschlag.ts`). Die Zeilen darueber und darunter stehen dabei,
 * damit man sieht, wohin die Kurve laeuft.
 */
const NEIGUNGEN = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : [0, 5, 10, 15, 17, 20, 25, 30];
/** Himmelsrichtungen der Schraeglage (Grad). */
const RICHTUNGEN = reihe(0, 345, 15);

const boomReihe = reihe(BOOM_MIN, BOOM_MAX, 8.125);
const stickReihe = reihe(STICK_MIN, STICK_MAX, 14.375);

interface Teil {
  obj: THREE.Mesh;
  punkte: Float64Array;
  bezugInv: THREE.Matrix4;
  mitte: THREE.Vector3;
  radius: number;
}

interface Stellung {
  boom: number;
  stick: number;
  /** Armpunkte RELATIV zum Kardangelenk, 3 Zahlen je Punkt. */
  rel: Float64Array;
}

function profilVon(f: Form): Drehprofil {
  const n = f.rho.length;
  let ab = 0;
  while (ab < n && f.rho[ab] <= VORHALT) ab++;
  return new Drehprofil(f.wolke, ab, 0.1);
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  const bagger = new Excavator(szene, world);

  const sichel = formVermessen(bagger, SICHELKRALLE, RASTER, SPLAY);
  const fuenf = formVermessen(bagger, FUENFSCHALEN, RASTER, SPLAY);
  const greiferR = Math.max(sichel.rho[sichel.rho.length - 1], fuenf.rho[fuenf.rho.length - 1]);

  szene.updateMatrixWorld(true);
  const teile: Teil[] = [];
  szene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) {
      if (p === bagger.grappleGroup) return;
      if (!p.visible) return;
    }
    if (SCHLAUCH.test(m.name)) return;
    const s = dreieckssuppe(m, () => true);
    if (s.tri.length === 0) return;
    m.geometry.computeBoundingSphere();
    const bs = m.geometry.boundingSphere!;
    const sk = m.getWorldScale(new THREE.Vector3());
    teile.push({
      obj: m,
      punkte: abtasten(s, RASTER),
      bezugInv: m.matrixWorld.clone().invert(),
      mitte: bs.center.clone().applyMatrix4(m.matrixWorld),
      radius: bs.radius * Math.max(sk.x, sk.y, sk.z),
    });
  });

  const stellungen: Stellung[] = [];
  const tiefste = Math.max(SICHELKRALLE.maxTiefe, FUENFSCHALEN.maxTiefe);
  const M = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const bezugMitte = teile.map((t) => t.mitte.clone());
  for (const bg of boomReihe) {
    for (const sg of stickReihe) {
      const p = posenBauen(bagger, szene, bg, sg, greiferR, false);
      if (!p) continue;
      if (p.u.y < tiefste + 0.02 - HOCHSTAND) continue;
      const rel: number[] = [];
      for (let i = 0; i < teile.length; i++) {
        const t = teile[i];
        v.copy(bezugMitte[i]).applyMatrix4(M.multiplyMatrices(t.obj.matrixWorld, t.bezugInv));
        if (v.distanceTo(p.u) > t.radius + greiferR + DECKEL) continue;
        for (let k = 0; k < t.punkte.length; k += 3) {
          v.set(t.punkte[k], t.punkte[k + 1], t.punkte[k + 2]).applyMatrix4(M);
          rel.push(v.x - p.u.x, v.y - p.u.y, v.z - p.u.z);
        }
      }
      stellungen.push({ boom: bg, stick: sg, rel: Float64Array.from(rel) });
    }
  }
  const punkte = stellungen.reduce((a, s) => a + s.rel.length / 3, 0);
  console.log(
    `=== Freigang des PENDELNDEN Greifers (Raster ${(RASTER * 100).toFixed(1)} cm, ` +
      `Schranke ${(GRENZE * 1000).toFixed(1)} mm) ===\n`
  );
  console.log(
    `  ${stellungen.length} erreichbare Armstellungen, ${punkte} Armpunkte in Reichweite,\n` +
      `  ${NEIGUNGEN.length} Schraeglagen x ${RICHTUNGEN.length} Himmelsrichtungen, ` +
      `Rotator vollstaendig (Drehprofil)\n`
  );

  const q = new THREE.Quaternion();
  const achse = new THREE.Vector3();
  const pkt = new THREE.Vector3();
  for (const [name, f] of [
    ["Sichelkralle", sichel],
    ["Fuenfschalengreifer", fuenf],
  ] as Array<[string, Form]>) {
    const profil = profilVon(f);
    console.log(`  ${name}`);
    console.log("    Schraeglage | beruehrende Armstellungen | engste Stelle");
    console.log("    ------------+---------------------------+--------------");
    for (const d of NEIGUNGEN) {
      const treffer = new Set<string>();
      let engste = Infinity;
      for (const s of stellungen) {
        let getroffen = false;
        for (const r of d === 0 ? [0] : RICHTUNGEN) {
          // Schraeglage: Drehung um die waagerechte Achse senkrecht zu r
          achse.set(Math.cos(r * GRAD), 0, -Math.sin(r * GRAD));
          q.setFromAxisAngle(achse, d * GRAD).invert();
          for (let i = 0; i < s.rel.length; i += 3) {
            pkt.set(s.rel[i], s.rel[i + 1], s.rel[i + 2]).applyQuaternion(q);
            const ab = profil.abstand(Math.hypot(pkt.x, pkt.z), pkt.y, DECKEL);
            if (ab < engste) engste = ab;
            if (ab <= GRENZE) {
              getroffen = true;
              break;
            }
          }
          if (getroffen) break;
        }
        if (getroffen) treffer.add(`${s.boom}/${s.stick}`);
      }
      console.log(
        `    ${String(d).padStart(6)}°     | ` +
          `${String(treffer.size).padStart(3)} von ${stellungen.length}` +
          `                | ${(engste * 1000).toFixed(1)} mm`
      );
    }
    console.log("");
  }
}

void main();
