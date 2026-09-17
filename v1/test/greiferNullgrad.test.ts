/**
 * Wächter für den NULLGRAD-BEFUND — E-095.
 *
 * DER BEFUND, den dieser Wächter festhält: Der Greifer berührt den eigenen
 * Arm nicht erst beim Seitwärtskippen, sondern **schon bei Kippwinkel 0** —
 * in 13 von 62 erreichbaren Armstellungen mit der Sichelkralle, in 8 von 62
 * mit dem Fünfschalengreifer (E-085 hat es gefunden, E-091 nachgemessen,
 * E-095 aufgeschlüsselt).
 *
 * Es sind ZWEI Sachverhalte an ganz verschiedenen Stellen:
 *
 *   A. **Stiel ganz angezogen** (−140°): Der Greifer hängt über dem
 *      angehobenen Räumschild und steckt 7…14 cm darin. Im laufenden Spiel
 *      passiert das aber nur auf halbem Schließweg — offen wie geschlossen
 *      bleiben 4…12 cm Luft (`tools/greifer-betrieb.ts`).
 *   B. **Stiel gestreckt, Ausleger hoch**: Sobald Ausleger + Stiel über rund
 *      20° einknicken, läuft der Stielkasten schräg durch den Kreis, den der
 *      hängende Greifer beim Drehen beschreibt. 5,5…16 cm tief — und DAS
 *      passiert im Spiel auf einen einzigen Tastendruck.
 *
 * NICHTS DAVON IST REPARIERT. Jede Abhilfe kostet entweder Hubhöhe
 * (Gelenksperre, Preiszettel in `tools/knickgrenze.ts`) oder greift ins
 * Pendel — beides entscheidet Patrick (E-095). Der Wächter hält deshalb den
 * STAND fest: Wird es mehr, ist etwas gewachsen; wird es weniger, hat jemand
 * repariert und soll es ins Log schreiben.
 *
 * ## WIE HIER GEMESSEN WIRD — und warum nicht so wie im Werkzeug
 *
 * Das Werkzeug fragt je Armstellung 24 Rotatorstellungen einzeln ab und
 * rechnet räumlich; das kostet Minuten. Hier wird die Drehung
 * HERAUSGERECHNET: Bei Kippwinkel 0 dreht der Rotator um die Lotrechte durch
 * das Kardangelenk, ein Greiferpunkt läuft also auf einem waagerechten Kreis,
 * und der kleinste Abstand über den GANZEN Rotatorweg ist der ebene Abstand
 * in der Halbebene (Achsabstand | Höhe) — siehe `Drehprofil` in
 * `tools/freigang-kern.ts`. Das ist strenger als 24 Stichproben (zwischen
 * zwei Stichproben rutscht nichts mehr durch) und um Größenordnungen
 * billiger.
 *
 * Bezahlt wird es damit, dass hier BEIDE Seiten abgetastet werden — das
 * Werkzeug lässt den Arm exakt. Die Fehlerschranken addieren sich deshalb.
 * Dass beide Verfahren trotzdem auf dieselben Armstellungen kommen, steht
 * unten als Prüfung: Liste gegen Liste, nicht nur Zahl gegen Zahl.
 *
 * ## UND WARUM ER NICHT VIER MINUTEN LÄUFT
 *
 * Die erste Fassung hat je Armstellung die Oberfläche des Arms neu abgetastet
 * (Dreiecke teilen, bis jede Kante klein genug ist) — 62-mal, und das für
 * jede der sechs Prüfungen. Gemessen: 384 s. Der Arm ist aber in jeder
 * Stellung DERSELBE Körper; es bewegen sich nur seine Gelenke. Abgetastet
 * wird deshalb EINMAL, in einer Bezugsstellung, und danach werden die Punkte
 * je Armstellung nur noch umgerechnet (`matrixWorld · Bezug⁻¹`).
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { Drehprofil, abtasten, dreieckssuppe, eps } from "../tools/freigang-kern";
import {
  BOOM_MAX,
  BOOM_MIN,
  DECKEL,
  HOCHSTAND,
  STICK_MAX,
  STICK_MIN,
  VORHALT,
  amBodenErreichbar,
  formVermessen,
  posenBauen,
  reihe,
  type Form,
} from "../tools/greifer-freigang";

/**
 * Raster beider Seiten (m).
 *
 * 3 cm, nicht 2,5 wie im Werkzeug: Der Wächter läuft bei jedem `npm test` mit.
 * Die Fehlerschranke wird damit `2 × 3/√3 = 34,6 mm` statt 14,4 — grob genug,
 * dass ein streifender Kontakt durchrutschen könnte, fein genug für die
 * gemessenen 55…160 mm Durchdringung. Dass dieselben Armstellungen
 * herauskommen wie im Werkzeug, steht unten als Prüfung; mit 4 cm kam eine
 * vierzehnte dazu (53,75°/−39,37°), die das Werkzeug nicht meldet.
 */
const RASTER = 0.03;
/** Schranke, ab der „berührt" gilt: beide Abtastfehler zusammen. */
const GRENZE = 2 * eps(RASTER);
/** Öffnungsstellungen, über die der Greifer zusammengelegt wird — wie im Werkzeug. */
const SPLAY = 6;
/** Schläuche geben nach und zählen nicht als Hindernis — wie im Werkzeug. */
const SCHLAUCH = /SCHLAUCH/;
/**
 * Um wie viel der Greifer für die Gegenprobe wächst.
 *
 * 25 %, nicht 10: Bei 10 % meldet die Sichelkralle zwar mehr, der
 * Fünfschalengreifer aber nicht — seine acht Armstellungen berühren schon,
 * und die nächste liegt weiter weg als ein Zehntel. Eine Gegenprobe, die nur
 * bei einer von zwei Formen anspricht, prüft die andere nicht.
 */
const STRECKUNG = 1.25;

const boomReihe = reihe(BOOM_MIN, BOOM_MAX, 8.125);
const stickReihe = reihe(STICK_MIN, STICK_MAX, 14.375);

/** Ein Armnetz, einmal abgetastet, mit seiner Bezugsstellung. */
interface Teil {
  obj: THREE.Mesh;
  /** Abgetastete Oberfläche in der Bezugsstellung, Weltkoordinaten. */
  punkte: Float64Array;
  /** Inverse der Weltmatrix in der Bezugsstellung. */
  bezugInv: THREE.Matrix4;
  /** Hüllkugel in der Bezugsstellung — für die Reichweitenprobe je Stellung. */
  mitte: THREE.Vector3;
  radius: number;
}

/** Was in einer Armstellung an Punkten und Stielspitze vorliegt. */
interface Stellung {
  boom: number;
  stick: number;
  u: THREE.Vector3;
  /** (Achsabstand | Höhe über dem Kardangelenk) je Armpunkt in Reichweite. */
  ry: Float64Array;
}

let bagger: Excavator;
let stellungen: Stellung[];
let stand: THREE.Vector3;
let sichel: Form;
let fuenf: Form;
/** Ergebnis je Profil: Namen der berührenden Armstellungen. */
let treffer: Map<string, string[]>;

/** Punkte der Greiferwolke jenseits der Aufhängung, als Drehprofil. */
function profilVon(f: Form, streckung: number): Drehprofil {
  const n = f.rho.length;
  const wolke = streckung === 1 ? f.wolke : f.wolke.map((v) => v * streckung);
  let ab = 0;
  while (ab < n && f.rho[ab] * streckung <= VORHALT) ab++;
  return new Drehprofil(wolke, ab, 0.1);
}

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  bagger = new Excavator(szene, world);
  stand = bagger.position.clone();

  sichel = formVermessen(bagger, SICHELKRALLE, RASTER, SPLAY);
  fuenf = formVermessen(bagger, FUENFSCHALEN, RASTER, SPLAY);
  const greiferR = Math.max(sichel.rho[sichel.rho.length - 1], fuenf.rho[fuenf.rho.length - 1]);

  /*
   * Den Arm EINMAL abtasten, in der Stellung, in der die Maschine gerade
   * steht. Genommen wird alles außerhalb der `grappleGroup` außer den beiden
   * Schläuchen — dieselbe Auswahl wie im Werkzeug.
   */
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

  stellungen = [];
  const tiefste = Math.max(SICHELKRALLE.maxTiefe, FUENFSCHALEN.maxTiefe);
  const M = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const bezugMitte = teile.map((t) => t.mitte.clone());
  for (const bg of boomReihe) {
    for (const sg of stickReihe) {
      /*
       * `posenBauen` bringt die Netze in Stellung und liefert die Stielspitze —
       * mit `false` ohne das teure Grobsieb, das hier niemand abfragt. Dass
       * dieselbe Funktion wie im Werkzeug die Auswahl trifft, ist Absicht:
       * Sonst laufen die beiden Zählungen auseinander.
       */
      const p = posenBauen(bagger, szene, bg, sg, greiferR, false);
      if (!p) continue;
      if (p.u.y < tiefste + 0.02 - HOCHSTAND) continue;
      const ry: number[] = [];
      for (let i = 0; i < teile.length; i++) {
        const t = teile[i];
        // Hüllkugel in dieser Stellung — die Mitte wandert mit der Matrix mit.
        v.copy(bezugMitte[i]).applyMatrix4(M.multiplyMatrices(t.obj.matrixWorld, t.bezugInv));
        if (v.distanceTo(p.u) > t.radius + greiferR + DECKEL) continue;
        for (let k = 0; k < t.punkte.length; k += 3) {
          v.set(t.punkte[k], t.punkte[k + 1], t.punkte[k + 2]).applyMatrix4(M);
          ry.push(Math.hypot(v.x - p.u.x, v.z - p.u.z), v.y - p.u.y);
        }
      }
      stellungen.push({ boom: bg, stick: sg, u: p.u.clone(), ry: Float64Array.from(ry) });
    }
  }

  const profile: Array<[string, Drehprofil]> = [
    ["sichel", profilVon(sichel, 1)],
    ["fuenf", profilVon(fuenf, 1)],
    ["sichel+", profilVon(sichel, STRECKUNG)],
    ["fuenf+", profilVon(fuenf, STRECKUNG)],
  ];
  treffer = new Map(profile.map(([k]) => [k, [] as string[]]));
  for (const s of stellungen) {
    for (const [name, pr] of profile) {
      for (let i = 0; i < s.ry.length; i += 2) {
        if (pr.abstand(s.ry[i], s.ry[i + 1], DECKEL) <= GRENZE) {
          treffer.get(name)!.push(`${s.boom}/${s.stick}`);
          break;
        }
      }
    }
  }
}, 900_000);

/**
 * Die Armstellungen, die `npx vite-node tools/greifer-freigang.ts nullgrad`
 * am 17.09.2026 gemeldet hat — Raster 2,5 cm, 24 Rotatorstellungen, räumlich
 * gerechnet. Protokoll: `docs/messungen/greifer-nullgrad-2026-09-17.txt`.
 */
const WERKZEUG_SICHEL = [
  "29.38/-140",
  "37.5/-140",
  "45.63/-140",
  "45.63/-25",
  "53.75/-140",
  "53.75/-25",
  "61.88/-140",
  "61.88/-39.37",
  "61.88/-25",
  "70/-140",
  "70/-53.75",
  "70/-39.37",
  "70/-25",
];
const WERKZEUG_FUENF = [
  "29.38/-140",
  "37.5/-140",
  "45.63/-140",
  "53.75/-140",
  "61.88/-140",
  "61.88/-25",
  "70/-140",
  "70/-25",
];

describe("Nullgrad — der Greifer am eigenen Arm, ohne jede Kippung", () => {
  it("rastert dieselben 62 erreichbaren Armstellungen ab wie die Messung", () => {
    expect(boomReihe.length * stickReihe.length).toBe(81);
    expect(stellungen.length).toBe(62);
  });

  it("Sichelkralle: 13 von 62 Armstellungen berühren — Liste gegen Liste", () => {
    expect(treffer.get("sichel")!.slice().sort()).toEqual([...WERKZEUG_SICHEL].sort());
  });

  it("Fünfschalengreifer: 8 von 62 Armstellungen berühren — Liste gegen Liste", () => {
    expect(treffer.get("fuenf")!.slice().sort()).toEqual([...WERKZEUG_FUENF].sort());
  });

  it("die acht des Fünfschalengreifers sind eine echte Teilmenge der dreizehn", () => {
    /*
     * E-091 hat das so ausgewiesen; hier steht es als Bedingung. Wäre es
     * einmal keine Teilmenge mehr, hätte der Trog eine Stelle gefunden, an
     * der die Sichelkralle vorbeikommt — dann ist die gemeinsame Ursache
     * (Räumschild, Stielkasten) nicht mehr die ganze Geschichte.
     */
    const dreizehn = new Set(WERKZEUG_SICHEL);
    for (const k of treffer.get("fuenf")!) expect(dreizehn.has(k), k).toBe(true);
    expect(treffer.get("fuenf")!.length).toBeLessThan(treffer.get("sichel")!.length);
  });

  it(`GEGENPROBE: ein um ${Math.round((STRECKUNG - 1) * 100)} % größerer Greifer wird gemeldet`, () => {
    /*
     * Ein Wächter, den man nicht scheitern gesehen hat, prüft nichts. Beide
     * Formen müssen ansprechen, nicht nur die größere.
     */
    expect(treffer.get("sichel+")!.length).toBeGreaterThan(WERKZEUG_SICHEL.length);
    expect(treffer.get("fuenf+")!.length).toBeGreaterThan(WERKZEUG_FUENF.length);
  });

  it("drei der dreizehn hält der Bodenanschlag ohnehin nicht", () => {
    /*
     * `resolveGroundClamp` hält die Stielspitze auf `Fläche + maxTiefe + 0,02`,
     * und tiefer als der Beton (0) kann die Fläche nicht liegen. Drei der
     * dreizehn Stellungen liegen darunter und kommen im Spiel nicht vor; die
     * übrigen zehn schon. Der Filter der Messung (`HOCHSTAND`) ist an dieser
     * Stelle zu großzügig — nachzulesen bei `amBodenErreichbar`.
     */
    const spitze = (bg: number, sg: number): number => {
      const s = stellungen.find((q) => q.boom === bg && q.stick === sg);
      expect(s, `Armstellung ${bg}/${sg} fehlt`).toBeDefined();
      // Aus der gebauten Maschine gelesen; die Formel steht nur als Gegenprobe.
      const gelesen = s!.u.y - stand.y;
      const b = (bg * Math.PI) / 180;
      expect(gelesen).toBeCloseTo(2.95 + 5.2 * Math.sin(b) + 4.0 * Math.sin(b + (sg * Math.PI) / 180), 3);
      return gelesen;
    };
    const unerreichbar = WERKZEUG_SICHEL.filter((k) => {
      const [bg, sg] = k.split("/").map(Number);
      return !amBodenErreichbar(spitze(bg, sg), SICHELKRALLE.maxTiefe);
    });
    expect(unerreichbar).toEqual(["29.38/-140", "37.5/-140", "45.63/-140"]);
  });

  it("die Berührung am Stielkasten hängt an der Winkelsumme, nicht am Ausleger allein", () => {
    /*
     * Die zweite Gruppe (Stiel gestreckt) ist KEINE Sammlung von Einzelfällen,
     * sondern eine Kante im Gelenkfeld: Sie beginnt, sobald Ausleger + Stiel
     * — die Neigung des Stiels über der Waagerechten — über rund 20° steigt.
     * Das ist die Zahl, an der `tools/knickgrenze.ts` seinen Preiszettel
     * aufhängt; steht sie hier nicht, ist der Preiszettel für etwas anderes
     * ausgerechnet worden.
     */
    const knickeMitTreffer = WERKZEUG_SICHEL.map((k) => k.split("/").map(Number))
      .filter(([, sg]) => sg > -140) // die Räumschild-Gruppe ist ein anderer Fall
      .map(([bg, sg]) => bg + sg);
    expect(Math.min(...knickeMitTreffer)).toBeGreaterThan(15);
    expect(Math.min(...knickeMitTreffer)).toBeLessThan(21);
    // Und keine einzige Stellung unter 15° Knick berührt am Stielkasten.
    const flach = stellungen.filter((s) => s.stick > -140 && s.boom + s.stick <= 15);
    expect(flach.length).toBeGreaterThan(20); // sonst prüft die Zeile nichts
    for (const s of flach) {
      expect(treffer.get("sichel")!, `${s.boom}/${s.stick}`).not.toContain(`${s.boom}/${s.stick}`);
    }
  });
});
