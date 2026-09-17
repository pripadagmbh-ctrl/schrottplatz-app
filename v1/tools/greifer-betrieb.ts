/**
 * KOMMT ES IM BETRIEB VOR? — der Greifer am eigenen Arm, im laufenden Spiel.
 *
 * `tools/greifer-freigang.ts` rastert die Gelenkgrenzen ab und sagt, in
 * WELCHEN Armstellungen sich Greifer und Arm berühren (E-085, E-091: 13 von 62
 * schon bei Kippwinkel 0). Das ist eine Aussage über den Raum der Stellungen,
 * nicht über das Spiel. Eine rechnerische Berührung in einer Stellung, die
 * niemand einnimmt, ist kein Fehler.
 *
 * Hier wird deshalb GEFAHREN statt gerastert: Der echte `Excavator.update()`
 * läuft mit echten Tastendrücken, mit Rampen, mit `resolveGroundClamp` und mit
 * der Armkollision — genau wie auf dem iPad. Gemessen wird in jedem
 * abgetasteten Bild der kleinste Abstand zwischen dem GEZEICHNETEN Greifer und
 * dem GEZEICHNETEN Arm, auf Dreiecksebene, mit dem Rechenkern aus
 * `tools/freigang-kern.ts`.
 *
 * DIE EICHUNG IST DIESELBE wie dort: Der Ursprung der `grappleGroup` IST das
 * Kardangelenk, und es sitzt in der Stielspitze. Alles innerhalb von
 * R0 = 0,466 m ist Aufhängung und steckt bauartbedingt im Stiel — auch bei
 * Kippwinkel 0, wo der Greifer nachweislich frei hängt. Gemessen wird ab
 * `VORHALT` = 0,8 m nach außen, mit demselben Vorhalt, mit dem die Vorprobe
 * dort ihre 13 Armstellungen gezählt hat.
 *
 * Die Tastenfolgen sind keine Kunstfiguren, sondern die vier Handgriffe, mit
 * denen ein Bagger bewegt wird: Ausleger heben, Stiel anziehen, Stiel
 * strecken, und ein ganzer Greifzyklus.
 *
 * Aufruf: npx vite-node tools/greifer-betrieb.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";
import { Gitter, Naehefeld, abtasten, dreieckssuppe, eps, type Suppe } from "./freigang-kern";

const GRAD = 180 / Math.PI;
const DT = 1 / 60;

/**
 * Abtastraster des Greifers (m) — 5 cm, Abtastfehler 28,9 mm.
 *
 * Gröber als die 2,5 cm des Rasterlaufs, und das ist hier richtig: Dort ging
 * es um die ZAHL hinter dem Freigang, hier um die Frage „berührt es sich
 * während dieser Bewegung". Die gemessenen Durchdringungen liegen bei 5,5 bis
 * 16 cm, also weit über der Schranke. Dafür werden statt 62 Armstellungen
 * einige hundert Bilder gerechnet.
 */
const H = 0.05;
const EPS = eps(H);
/** Weiter als das interessiert nicht — wie im Rasterlauf. */
const DECKEL = 0.15;
/** Alles näher am Kardangelenk ist Aufhängung (wie `VORHALT` im Rasterlauf). */
const VORHALT = 0.8;
/** Schläuche geben nach und zählen nicht als Hindernis — wie im Rasterlauf. */
const SCHLAUCH = /SCHLAUCH/;

/** Eine Tastatur, die tut, was das Drehbuch sagt. */
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

/** Ein Abschnitt des Drehbuchs: so viele Bilder lang diese Tasten halten. */
interface Schritt {
  was: string;
  tasten: string[];
  bilder: number;
}

interface Drehbuch {
  name: string;
  /** Womit der Bagger vorher in Stellung gebracht wird — wird nicht gemessen. */
  vorlauf: Schritt[];
  schritte: Schritt[];
}

/*
 * DIE TASTEN, aus `excavator.ts` gelesen (Zeilen 1834-1836), nicht geraten:
 *   inBoom  = axis("KeyF", "KeyR")   → KeyR hebt den Ausleger, KeyF senkt ihn
 *   inStick = axis("KeyG", "KeyT")   → KeyT streckt den Stiel, KeyG zieht an
 *   inCab   = axis("KeyE", "KeyQ")   → Oberwagen
 *   Space                            → greifen
 * Die Richtungen sind unten mit `pruefeTasten()` einmal nachgemessen, statt
 * sie aus dem Namen zu schließen.
 */
const BUECHER: Drehbuch[] = [
  {
    /*
     * Der erste Handgriff jedes Spielers: weit ausstrecken und dann den
     * Ausleger heben, um die Fuhre über eine Bordwand zu bringen.
     */
    name: "Stiel gestreckt, dann Ausleger ganz heben",
    vorlauf: [
      { was: "Stiel bis zum Anschlag strecken", tasten: ["KeyT"], bilder: 420 },
      { was: "Ausleger ganz senken", tasten: ["KeyF"], bilder: 420 },
    ],
    schritte: [{ was: "Ausleger heben", tasten: ["KeyR"], bilder: 420 }],
  },
  {
    /*
     * Der zweite: alles einklappen, um zu fahren oder dicht an der Maschine
     * zu arbeiten.
     */
    name: "Stiel ganz anziehen (Fahrstellung)",
    vorlauf: [{ was: "Ausleger auf halbe Höhe", tasten: ["KeyR"], bilder: 220 }],
    schritte: [{ was: "Stiel anziehen", tasten: ["KeyG"], bilder: 420 }],
  },
  {
    /*
     * Derselbe Handgriff MIT FUHRE — und das ist nicht dasselbe.
     *
     * Der Greifer hängt geschlossen 13 cm tiefer als offen (Kommentar zu
     * `hoechsteKrallenspitze`), und der Bodenanschlag rechnet mit `maxTiefe`
     * über den ganzen Schließweg, hebt den Arm also NICHT entsprechend an. Ob
     * der eingeklappte Greifer das Räumschild trifft, hängt damit daran, ob er
     * offen oder zu ist — die erste Fassung dieses Drehbuchs hat nur den
     * offenen gefahren und deshalb nichts gefunden.
     */
    name: "Stiel ganz anziehen MIT FUHRE (Greifer zu)",
    vorlauf: [{ was: "Ausleger auf halbe Höhe", tasten: ["KeyR"], bilder: 220 }],
    schritte: [
      { was: "zupacken", tasten: ["Space"], bilder: 90 },
      { was: "anziehen, Greifer zu", tasten: ["Space", "KeyG"], bilder: 420 },
      { was: "absenken, Greifer zu", tasten: ["Space", "KeyF"], bilder: 300 },
    ],
  },
  {
    /*
     * Eingeklappt ABSETZEN — der Fall, den der Rasterlauf trifft und die
     * beiden Drehbücher oben nicht.
     *
     * Der Rasterlauf legt SECHS Öffnungsstellungen übereinander, von ganz zu
     * bis ganz auf. Seine Berührung am Räumschild sitzt bei 2,81 m unter dem
     * Gelenk und 0,99 m von der Achse — das ist weder der geschlossene
     * (schmal und tief) noch der offene Greifer (breit und flach), sondern
     * einer auf halbem Schließweg. Den fährt man nur, wenn man eingeklappt
     * auf- oder zumacht. Genau das steht hier.
     */
    name: "Eingeklappt absetzen: Stiel angezogen, Greifer auf und wieder zu",
    vorlauf: [
      { was: "Ausleger heben", tasten: ["KeyR"], bilder: 300 },
      { was: "zupacken", tasten: ["Space"], bilder: 90 },
      { was: "Stiel bis zum Anschlag anziehen", tasten: ["Space", "KeyG"], bilder: 600 },
    ],
    schritte: [
      { was: "öffnen", tasten: [], bilder: 200 },
      { was: "wieder schließen", tasten: ["Space"], bilder: 200 },
    ],
  },
  {
    /*
     * Und der Zyklus, den Patrick hundertmal am Tag macht: greifen, heben,
     * schwenken, absetzen.
     */
    name: "Greifzyklus: fassen, heben, schwenken, absetzen",
    vorlauf: [
      { was: "auf Arbeitsstellung", tasten: ["KeyT"], bilder: 200 },
      { was: "absenken", tasten: ["KeyF"], bilder: 200 },
    ],
    schritte: [
      { was: "zupacken", tasten: ["Space"], bilder: 90 },
      { was: "heben, Greifer zu", tasten: ["Space", "KeyR"], bilder: 200 },
      { was: "schwenken, Greifer zu", tasten: ["Space", "KeyQ"], bilder: 150 },
      { was: "anziehen, Greifer zu", tasten: ["Space", "KeyG"], bilder: 150 },
      { was: "loslassen", tasten: [], bilder: 90 },
    ],
  },
];

/* --------------------------------------------------------------- Messung */

interface Bild {
  boom: number;
  stick: number;
  gier: number;
  abstand: number;
  wo: string;
  was: string;
}

/**
 * Der kleinste Abstand zwischen GEZEICHNETEM Greifer und GEZEICHNETEM Arm,
 * in der Stellung, in der die Maschine gerade steht.
 *
 * Beide Seiten kommen aus dem Szenengraphen, nicht aus einer Formel: Was
 * gerade nicht sichtbar ist (der abgehängte zweite Greifer), zählt nicht mit,
 * und der Öffnungswinkel ist der, den das Spiel in diesem Bild gesetzt hat.
 */
function abstandJetzt(
  bagger: Excavator,
  szene: THREE.Scene
): { d: number; wo: string } {
  const g = bagger.grappleGroup;
  g.updateWorldMatrix(true, true);
  const u = g.position;

  const greiferSuppe = dreieckssuppe(g, () => true);
  const punkte = abtasten(greiferSuppe, H);

  const armSuppe: Suppe = dreieckssuppe(szene, (m) => {
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p === g) return false;
    return !SCHLAUCH.test(m.name);
  });
  if (armSuppe.tri.length === 0) return { d: DECKEL, wo: "—" };
  const arm = new Gitter(armSuppe, 0.2);
  const naehe = new Naehefeld(arm, u, 3.6, 0.2, DECKEL);

  let best = DECKEL;
  let wo = "—";
  for (let i = 0; i < punkte.length; i += 3) {
    const x = punkte[i], y = punkte[i + 1], z = punkte[i + 2];
    // Die Aufhängung steckt bauartbedingt im Stiel — dieselbe Eichung wie im
    // Rasterlauf, sonst meldet jede Messung Berührung.
    if (Math.hypot(x - u.x, y - u.y, z - u.z) <= VORHALT) continue;
    if (naehe.untere(x, y, z) >= best) continue;
    const q = arm.abstand(x, y, z, best);
    if (q.d < best) {
      best = q.d;
      if (q.netz >= 0) wo = armSuppe.namen[q.netz] ?? "?";
    }
  }
  return { d: best, wo };
}

/** Richtung der Tasten NACHMESSEN statt aus dem Namen schließen. */
function pruefeTasten(bagger: Excavator): void {
  const b = bagger as unknown as { boomAngle: number; stickAngle: number };
  const t = new Tasten();
  const probe = (taste: string, lies: () => number): number => {
    const vor = lies();
    t.down.clear();
    t.down.add(taste);
    for (let i = 0; i < 30; i++) bagger.update(DT, t as never);
    const nach = lies();
    t.down.clear();
    for (let i = 0; i < 30; i++) bagger.update(DT, t as never);
    return nach - vor;
  };
  const r = probe("KeyR", () => b.boomAngle);
  const gG = probe("KeyG", () => b.stickAngle);
  console.log(
    `  Tastenprobe: KeyR bewegt den Ausleger um ${(r * GRAD).toFixed(1)}° ` +
      `(${r > 0 ? "HEBEN" : "senken"}), KeyG den Stiel um ${(gG * GRAD).toFixed(1)}° ` +
      `(${gG < 0 ? "ANZIEHEN" : "strecken"}).`
  );
  if (r <= 0 || gG >= 0) {
    throw new Error(
      "Die Tasten tun nicht, was das Drehbuch annimmt — die Messung wäre wertlos."
    );
  }
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();

  console.log("=== Berührt der Greifer den Arm im BETRIEB? — im laufenden Spiel gemessen ===\n");
  console.log(
    `  Raster ${(H * 100).toFixed(0)} cm → Abtastfehler EPS = ${(EPS * 1000).toFixed(1)} mm` +
      `  ·  Vorhalt ${VORHALT} m um das Kardangelenk  ·  Deckel ${DECKEL} m`
  );
  console.log(
    "  Gemessen wird jedes 10. Bild, gegen den ganzen gezeichneten Arm (Stiel,\n" +
      "  Ausleger, Zylinder, Kabine, Oberwagen, Unterwagen, Räder, Räumschild, Pratzen).\n"
  );

  for (const form of [SICHELKRALLE, FUENFSCHALEN] as Greiferform[]) {
    console.log(`\n################  ${form.name}  ################`);
    for (const buch of BUECHER) {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
      world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
      const szene = new THREE.Scene();
      const bagger = new Excavator(szene, world);
      if (form !== SICHELKRALLE && !bagger.setGreifer(form)) throw new Error("Wechsel abgelehnt");
      const t = new Tasten();
      if (buch === BUECHER[0] && form === SICHELKRALLE) pruefeTasten(bagger);

      for (const s of buch.vorlauf) {
        t.down.clear();
        for (const k of s.tasten) t.down.add(k);
        for (let i = 0; i < s.bilder; i++) {
          bagger.update(DT, t as never);
          world.step();
        }
      }

      const bilder: Bild[] = [];
      const b = bagger as unknown as { boomAngle: number; stickAngle: number; rotatorYaw: number };
      for (const s of buch.schritte) {
        t.down.clear();
        for (const k of s.tasten) t.down.add(k);
        for (let i = 0; i < s.bilder; i++) {
          bagger.update(DT, t as never);
          world.step();
          if (i % 10 !== 0) continue;
          const q = abstandJetzt(bagger, szene);
          bilder.push({
            boom: b.boomAngle * GRAD,
            stick: b.stickAngle * GRAD,
            gier: b.rotatorYaw * GRAD,
            abstand: q.d,
            wo: q.wo,
            was: s.was,
          });
        }
      }

      const treffer = bilder.filter((x) => x.abstand <= EPS);
      const engste = bilder.reduce((a, x) => (x.abstand < a.abstand ? x : a), bilder[0]);
      console.log(`\n--- ${buch.name} ---`);
      /*
       * Welchen Bereich die Bewegung ueberhaupt abgefahren hat — ohne diese
       * Zeile sieht man einem „0 Beruehrungen" nicht an, ob nichts passiert
       * ist oder ob das Drehbuch die fragliche Stellung nie erreicht hat.
       */
      const spanne = (lies: (x: Bild) => number): string =>
        `${Math.min(...bilder.map(lies)).toFixed(1)}…${Math.max(...bilder.map(lies)).toFixed(1)}°`;
      console.log(
        `  Abgefahren: Ausleger ${spanne((x) => x.boom)}, Stiel ${spanne((x) => x.stick)}.`
      );
      console.log(
        `  ${bilder.length} Bilder gemessen, davon ${treffer.length} mit Berührung` +
          ` (${((100 * treffer.length) / bilder.length).toFixed(0)} % der Bewegung).`
      );
      console.log(
        `  Engste Stelle: ${engste.abstand <= EPS ? "BERUEHRUNG" : `${(engste.abstand - EPS).toFixed(3)} m`}` +
          ` an ${engste.wo}, bei Ausleger ${engste.boom.toFixed(1)}° / Stiel ${engste.stick.toFixed(1)}°` +
          ` (${engste.was}).`
      );
      if (treffer.length) {
        const erste = treffer[0];
        const letzte = treffer[treffer.length - 1];
        console.log(
          `  Berührung ab Ausleger ${erste.boom.toFixed(1)}° / Stiel ${erste.stick.toFixed(1)}°` +
            ` bis Ausleger ${letzte.boom.toFixed(1)}° / Stiel ${letzte.stick.toFixed(1)}°,` +
            ` Netze: ${[...new Set(treffer.map((x) => x.wo))].join(", ")}.`
        );
      }
    }
  }
}

if (!process.env.VITEST) void main();
