/**
 * Waechter fuer den Kehrbesen aus Maschendraht (E-031, 15.09.2026).
 *
 * Wunsch Patrick: „Ich bräuchte einen Maschendrahtzaun, der quasi oben schon
 * gequetscht ist und unten breit ist, der quasi wie ein Besen fungiert ...
 * Damit ich quasi mit dem Maschendrahtzaun den Boden bzw. die Ladeflächen
 * abkehren kann."
 *
 * Das ist ein WERKZEUG, kein Deko-Stueck. Ein Aussehen allein nuetzt nichts —
 * darum misst dieser Test in der echten Rapier-Welt, welche Teilegroessen die
 * Schleppkante mitnimmt und welche darunter durchrutschen, und er misst es bei
 * mehreren Bodenabstaenden. Die Tabelle steht im Bericht und in
 * `docs/messungen/2026-09-15_besen.svg`.
 *
 * Drei Dinge haelt dieser Test fest:
 *
 * 1. **Form und Kollider stimmen ueberein** — unten breit und flach, oben
 *    schmal. Ein einzelner Quader ueber das ganze Teil taete es nicht; die
 *    Gegenprobe zeigt, dass der Waechter das auch merkt.
 * 2. **Die Schleppkante erfasst, was sie laut Tabelle erfassen soll.**
 * 3. **Es ist ein Werkzeug**: genau eines, greifbar am Kopf, nicht pressbar,
 *    nicht verkaeuflich.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld, initPhysics } from "../src/physics/physicsWorld";
import { GripSystem } from "../src/physics/gripSystem";
import {
  BESEN,
  ItemManager,
  besenForm,
  istPlatzinventar,
  PLATZINVENTAR,
  SPECS,
  type ScrapItem,
} from "../src/world/scrapItems";
import { KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE } from "../src/world/objektkatalog";
import { baueGeometrie, BESEN_TEILUNG } from "../src/world/objektbau";
import { BESEN_PLATZ, START_HAUFEN, START_STREU } from "../src/world/startplatz";
import {
  BAGGER_STAND,
  SCHWENK_AUSSEN,
  SCHWENK_INNEN,
  abstandVomStand,
} from "../src/world/baggerstand";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { CONFIGS } from "../src/world/containers";
import { Daylight, DAY_LENGTH_S } from "../src/world/daylight";
import { Account } from "../src/economy/account";
import type { CompositeManager } from "../src/dismantle/composites";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  clawPoint,
} from "../src/excavator/clawGeometry";

beforeAll(async () => {
  await initPhysics();
});

const [BREITE, HOEHE, TIEFE] = BESEN.dims;

/* ======================================================================== */
/* Werkzeug: Welt mit Boden                                                  */
/* ======================================================================== */

function platz(): { physics: PhysicsWorld; items: ItemManager } {
  const physics = new PhysicsWorld();
  const boden = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
  );
  // Genau wie im Spiel (`yard.ts`): grosse Platte, Rapier-Standardreibung.
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  return { physics, items: new ItemManager(new THREE.Scene(), physics.world) };
}

/**
 * Breite und Tiefe des KOLLIDERS auf einer Hoehe.
 *
 * Nicht die rohen Eckpunkte des Netzes messen: Zwischen zwei Drahtknoten
 * liegen Baender ganz ohne Eckpunkte, und was die Physik sieht, ist der
 * Kollider. Abgetastet wird mit `projectPoint(solid = true)`, das meldet, ob
 * ein Punkt IN einer Form liegt; die Kante wird dann eingeschachtelt.
 *
 * Gemessen wird gegen ALLE Kollider des Koerpers — der Besen hat zwei.
 */
function kolliderBei(
  body: RAPIER.RigidBody,
  y: number
): { breite: number; tiefe: number } {
  const innen = (x: number, z: number): boolean => {
    for (let i = 0; i < body.numColliders(); i++) {
      const p = body.collider(i).projectPoint({ x, y, z }, true);
      if (p && p.isInside) return true;
    }
    return false;
  };
  const suche = (achse: "x" | "z"): number => {
    let lo = 0;
    let hi = 2.0;
    const drin = (v: number): boolean => (achse === "x" ? innen(v, 0) : innen(0, v));
    if (!drin(0)) return 0;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (drin(m)) lo = m;
      else hi = m;
    }
    return lo * 2;
  };
  return { breite: suche("x"), tiefe: suche("z") };
}

/** Der Besen als fester Koerper im Ursprung — so, wie das Spiel ihn baut. */
function besenKoerper(): { physics: PhysicsWorld; body: RAPIER.RigidBody } {
  const { physics, items } = platz();
  const it = items.spawnScrap(
    BESEN.materialId,
    BESEN.massKg,
    besenForm(),
    new THREE.Vector3(0, 0, 0),
    new THREE.Quaternion()
  );
  it.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  return { physics, body: it.body };
}

/* ======================================================================== */
/* 1 — Form und Kollider                                                     */
/* ======================================================================== */

describe("Besen: Form und Kollider", () => {
  it("ist EIN Netz aus Draht, ohne Glas und ohne NaN", () => {
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    expect(bau.glas, "ein Zaun hat keine Scheiben").toBeNull();
    const pos = bau.koerper.getAttribute("position") as THREE.BufferAttribute;
    // Genau eine Geometrie: alles ist verschmolzen, ein Zeichenruf.
    expect(bau.koerper.groups.length, "mehr als eine Materialgruppe").toBeLessThanOrEqual(1);
    const arr = pos.array as Float32Array;
    // Ein einziges NaN beendet nicht die Funktion, sondern das WebAssembly-
    // Modul beim Bau der Huelle (siehe scrapItems.ts, `sauber`).
    expect(arr.every((v) => Number.isFinite(v)), "NaN in der Geometrie").toBe(true);
    // Dreiecke sind billig, Netze nicht. Zur Einordnung fuer spaeter:
    expect(pos.count / 3, "Dreiecke").toBeGreaterThan(800);
    expect(pos.count / 3, "unnoetig viele Dreiecke").toBeLessThan(4000);
  });

  it("misst aussen genau die Katalogmasse", () => {
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    bau.koerper.computeBoundingBox();
    const b = bau.koerper.boundingBox!;
    expect(b.max.x - b.min.x, "Breite").toBeCloseTo(BREITE, 2);
    expect(b.max.y - b.min.y, "Hoehe").toBeCloseTo(HOEHE, 2);
    expect(b.max.z - b.min.z, "Tiefe").toBeCloseTo(TIEFE, 2);
  });

  it("der Kollider ist unten breit und flach und oben schmal", () => {
    const { body } = besenKoerper();
    // Zwei Kollider: Faecher und Kopf. Eine einzige konvexe Huelle wuerde die
    // Taille ueberbruecken (gemessen: 0,61 statt 0,22 m am Hals).
    expect(body.numColliders(), "der Besen hat nicht zwei Kollider").toBe(2);

    const T = BESEN_TEILUNG;
    const yHals = HOEHE / 2 - HOEHE * T.kopf;
    const unten = kolliderBei(body, -HOEHE / 2 + 0.03);
    const mitte = kolliderBei(body, 0);
    const hals = kolliderBei(body, yHals + 0.06);
    const wulst = kolliderBei(body, HOEHE / 2 - HOEHE * T.wulstVonOben);

    // eslint-disable-next-line no-console
    console.log(
      `Kollider  unten ${unten.breite.toFixed(2)} x ${unten.tiefe.toFixed(2)} m` +
        ` · mitte ${mitte.breite.toFixed(2)} x ${mitte.tiefe.toFixed(2)}` +
        ` · Hals ${hals.breite.toFixed(2)} x ${hals.tiefe.toFixed(2)}` +
        ` · Wulst ${wulst.breite.toFixed(2)} x ${wulst.tiefe.toFixed(2)}`
    );

    // Unten die volle Breite — das ist die Schleppkante.
    expect(unten.breite, "unten nicht breit").toBeGreaterThan(BREITE * 0.85);
    // Und flach: deutlich breiter als tief.
    expect(unten.breite / unten.tiefe, "unten nicht flach").toBeGreaterThan(2.5);
    // Nach oben laeuft es zusammen — sonst waere es ein Quader.
    expect(mitte.breite, "die Mitte verjuengt sich nicht").toBeLessThan(unten.breite * 0.7);
    expect(hals.breite, "der Hals ist nicht schmal").toBeLessThan(unten.breite * 0.3);
    // Und der Wulst steht wieder heraus: die Kante, unter die die Schalen fassen.
    expect(wulst.breite, "die Ausbuchtung ist kein Wulst").toBeGreaterThan(hals.breite * 1.3);
    // Er bleibt aber schmal genug fuer den Schalenkorb (Halbmesser rund 0,44 m
    // auf Sensorhoehe, siehe Greif-Abschnitt weiter unten).
    expect(wulst.breite, "die Ausbuchtung ist zu dick zum Greifen").toBeLessThan(0.6);
  });

  it("Gegenprobe: ein Quader derselben Masse faellt durch", () => {
    /*
     * Ein Waechter, den man nie hat scheitern sehen, ist keiner (Lehre vom
     * 15.09.2026: zwei Stunden gruen, weil die Eingaben NaN waren). Hier laeuft
     * dieselbe Messung ueber einen glatten Quader mit genau den Massen des
     * Besens — und die Bedingung „oben schmal" muss dann verletzt sein.
     */
    const { physics } = platz();
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BREITE / 2, HOEHE / 2, TIEFE / 2),
      body
    );
    const yHals = HOEHE / 2 - HOEHE * BESEN_TEILUNG.kopf;
    const unten = kolliderBei(body, -HOEHE / 2 + 0.03);
    const hals = kolliderBei(body, yHals + 0.06);
    expect(unten.breite, "Aufbau: der Quader ist unten breit").toBeGreaterThan(BREITE * 0.85);
    expect(
      hals.breite < unten.breite * 0.3,
      "ein Quader duerfte die Bedingung 'oben schmal' NICHT erfuellen"
    ).toBe(false);
  });

  it("der Schwerpunkt liegt tief — wie bei einem Besen", () => {
    /*
     * Die Masse wird auf die beiden Kollider nach dem Rauminhalt ihrer
     * Huellquader verteilt. Damit liegt der Schwerpunkt im Faecher und nicht in
     * der Mitte — genau das, was bei einem Besen den Kopf leicht und das
     * Kehrende schwer macht. Fuer das Greifen ist es zugleich die bekannte
     * Falle (siehe Bericht): Wer oben fasst, hat den Schwerpunkt weit weg.
     */
    const { body } = besenKoerper();
    const cm = body.localCom();
    // eslint-disable-next-line no-console
    console.log(
      `Schwerpunkt lokal y = ${cm.y.toFixed(3)} m (Mitte 0, Schleppkante ${(-HOEHE / 2).toFixed(2)})`
    );
    expect(cm.y, "der Schwerpunkt sitzt nicht unten").toBeLessThan(-0.1);
    expect(body.mass(), "die Gesamtmasse stimmt nicht").toBeCloseTo(BESEN.massKg, 1);
  });
});

/* ======================================================================== */
/* 2 — Kehren: die Messung in der echten Physik                              */
/* ======================================================================== */

/**
 * Ein Kehrzug.
 *
 * Der Besen haengt am Haken und ist damit KINEMATISCH — genau so, wie das
 * Greifsystem ein gefasstes Teil fuehrt (`gripSystem.ts`, `attachBody`: „Pose
 * halten, nicht verschieben"). Seine Masse spielt dabei keine Rolle; was
 * zaehlt, ist allein, wo sein Kollider steht. Deshalb wird hier kinematisch
 * gezogen und nicht an einer Feder.
 *
 * @param kantenlaenge Kantenlaenge des Probeteils (m)
 * @param abstand Bodenabstand der Schleppkante (m)
 * @returns wie weit das Teil mitgekommen ist (m)
 */
function kehrzug(kantenlaenge: number, abstand: number): number {
  const { physics, items } = platz();
  const s = kantenlaenge;
  /*
   * Masse nach der Dichte, mit der das Spiel selbst rechnet: rund 900 kg je
   * Kubikmeter losem Schrott (`scrapItems.ts`, `trennForm`).
   */
  const kg = Math.max(0.2, 900 * s * s * s);
  const teil = items.spawnScrap(
    "steel",
    kg,
    { kind: "box", dims: [s, s, s], color: 0x808080 },
    new THREE.Vector3(0, s / 2 + 0.02, 0),
    // Ausdruecklich ohne Zufallsdrehung: `spawnScrap` wuerfelt sonst die
    // Gierung, und ein Waechter, der mal gruen und mal rot ist, taugt nichts.
    new THREE.Quaternion()
  );
  // Erst liegen lassen, dann kehren — sonst misst man den freien Fall mit.
  for (let i = 0; i < 90; i++) physics.step();
  const startZ = teil.body.translation().z;

  const besen = items.spawnScrap(
    BESEN.materialId,
    BESEN.massKg,
    besenForm(),
    new THREE.Vector3(0, HOEHE / 2 + abstand, -1.6),
    new THREE.Quaternion()
  );
  besen.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);

  /** Kehrtempo (m/s) — so schnell, wie die Spinne im Schwenk laeuft. */
  const TEMPO = 0.7;
  const SCHRITTE = 320; // 5,33 s, also 3,73 m Weg
  const y = HOEHE / 2 + abstand;
  for (let i = 0; i < SCHRITTE; i++) {
    const z = -1.6 + (TEMPO * (i + 1)) / 60;
    besen.body.setNextKinematicTranslation({ x: 0, y, z });
    physics.step();
  }
  // Nachlaufen lassen: was geschoben wurde, darf auslaufen.
  for (let i = 0; i < 60; i++) physics.step();
  return teil.body.translation().z - startZ;
}

/**
 * Ab diesem Weg gilt ein Teil als mitgekehrt (m).
 *
 * Der Besen zieht 3,73 m weit; ein Teil, das auf halber Strecke liegt, kann
 * also hoechstens rund 2,1 m mitkommen. 1,2 m ist gut die Haelfte davon und
 * damit eindeutig „mitgenommen" — die Teile, die nicht erfasst werden, bleiben
 * gemessen unter 0,9 m, meist bei null. Der Abstand zwischen beiden Gruppen
 * ist der Grund, warum diese Grenze nicht gefeilscht ist.
 */
const MITGEKEHRT_AB = 1.2;

describe("Besen: was die Schleppkante erfasst", () => {
  /*
   * Die Kehr-Tabelle. Zeilen = Kantenlaenge des Teils, Spalten = Bodenabstand
   * der Schleppkante. Gemessen, nicht geschaetzt.
   */
  const GROESSEN = [0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.5];
  const ABSTAENDE = [0.0, 0.05, 0.1];

  it("nimmt bei aufliegender Kante alles ab 5 cm mit", () => {
    const zeilen: string[] = [];
    const erfasst = new Map<string, number>();
    for (const s of GROESSEN) {
      const weg = ABSTAENDE.map((a) => kehrzug(s, a));
      weg.forEach((w, i) => erfasst.set(`${s}|${ABSTAENDE[i]}`, w));
      zeilen.push(
        `  ${(s * 100).toFixed(0).padStart(3)} cm : ` +
          weg
            .map((w, i) => `${(ABSTAENDE[i] * 100).toFixed(0)} cm → ${w.toFixed(2)} m`)
            .join("  ·  ")
      );
    }
    // eslint-disable-next-line no-console
    console.log("Kehr-Tabelle (Weg des Teils je Bodenabstand)\n" + zeilen.join("\n"));

    // Bei aufliegender Kante nimmt der Besen ALLES mit — das ist der Zweck.
    for (const s of GROESSEN) {
      expect(erfasst.get(`${s}|0`)!, `${s} m bei aufliegender Kante`).toBeGreaterThan(
        MITGEKEHRT_AB
      );
    }
  });

  it("Gegenprobe: was flacher ist als der Spalt, bleibt liegen", () => {
    /*
     * Der Waechter oben muss auch scheitern koennen. Ein 3-cm-Stueck bei 10 cm
     * Bodenabstand darf NICHT mitkommen — sonst misst der Test etwas anderes
     * als das, was er zu messen glaubt (z. B. einen Sog oder einen Fehler in
     * der Wegmessung).
     */
    const weg = kehrzug(0.03, 0.12);
    // eslint-disable-next-line no-console
    console.log(`Gegenprobe: 3 cm bei 12 cm Spalt → ${weg.toFixed(2)} m`);
    expect(weg, "ein flaches Teil rutscht unter der Kante durch").toBeLessThan(MITGEKEHRT_AB);
  });

  it("kehrt eine Ladeflaeche ueber die Bordwand hinweg leer", () => {
    /*
     * Der zweite Anwendungsfall aus Patricks Beschreibung: „den Boden bzw. die
     * Ladeflächen abkehren". Eine Pritsche hat Bordwaende von 0,64 m
     * (`delivery/vehicleModel.ts`, `wandHoehe`) und eine Innenbreite von
     * 2 x 1,35 m (`delivery/routes.ts`, `BED_HALF_W`). Nachgebaut wird genau
     * das: Flaeche, zwei Bordwaende, vorn eine Stirnwand, hinten offen.
     *
     * Der Besen ist 1,20 m breit, die Flaeche 2,70 m — eine Bahn reicht also
     * nicht. Gekehrt wird in DREI Bahnen, wie man es auch von Hand taete.
     */
    const { physics, items } = platz();
    const BED_HALF_W = 1.35;
    const WAND_H = 0.64;
    const FLAECHE_Y = 1.1; // Ladehoehe einer Pritsche (SW, aus dem Modell)
    const LAENGE = 5.0;
    const fest = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BED_HALF_W, 0.05, LAENGE / 2).setTranslation(
        0,
        FLAECHE_Y - 0.05,
        0
      ),
      fest
    );
    for (const sx of [-1, 1]) {
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, WAND_H / 2, LAENGE / 2).setTranslation(
          sx * (BED_HALF_W + 0.04),
          FLAECHE_Y + WAND_H / 2,
          0
        ),
        fest
      );
    }
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BED_HALF_W, WAND_H / 2, 0.04).setTranslation(
        0,
        FLAECHE_Y + WAND_H / 2,
        -LAENGE / 2
      ),
      fest
    );

    // Sechs Kleinteile ueber die ganze Breite, vorn an der Stirnwand.
    const reste: ScrapItem[] = [];
    for (let i = 0; i < 6; i++) {
      reste.push(
        items.spawnScrap(
          "steel",
          6,
          { kind: "box", dims: [0.14, 0.12, 0.14], color: 0x808080 },
          new THREE.Vector3(-1.05 + i * 0.42, FLAECHE_Y + 0.2, -1.7),
          new THREE.Quaternion()
        )
      );
    }
    for (let i = 0; i < 90; i++) physics.step();

    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, FLAECHE_Y + WAND_H + HOEHE / 2 + 0.3, -2.2),
      new THREE.Quaternion()
    );
    besen.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const yOben = FLAECHE_Y + WAND_H + HOEHE / 2 + 0.3;
    const yUnten = FLAECHE_Y + HOEHE / 2 + 0.01;
    const setz = (x: number, y: number, z: number): void => {
      besen.body.setNextKinematicTranslation({ x, y, z });
      physics.step();
    };
    for (const bahn of [-0.75, 0.0, 0.75]) {
      // ueber die Bordwand herein und absenken
      for (let i = 0; i < 40; i++) setz(bahn, yOben, -2.2);
      for (let i = 0; i < 72; i++) setz(bahn, yOben + ((yUnten - yOben) * (i + 1)) / 72, -2.2);
      /*
       * Nach hinten zur offenen Seite ziehen — und ueber die Kante hinaus.
       * Die Flaeche endet auf z +2,5; wer dort aufhoert, schiebt den Schrott
       * nur ans Heck statt herunter.
       */
      for (let i = 0; i < 470; i++) setz(bahn, yUnten, -2.2 + (0.7 * (i + 1)) / 60);
      // wieder anheben und zurueck, ohne dabei etwas mitzunehmen
      for (let i = 0; i < 40; i++) setz(bahn, yOben, -2.2 + (0.7 * 470) / 60);
      for (let i = 0; i < 40; i++) setz(bahn, yOben, -2.2);
    }
    for (let i = 0; i < 120; i++) physics.step();

    const runter = reste.filter((r) => r.body.translation().y < FLAECHE_Y - 0.2).length;
    // eslint-disable-next-line no-console
    console.log(`Ladeflaeche: ${runter} von ${reste.length} Teilen heruntergekehrt`);
    expect(runter, "die Flaeche wurde nicht leer gekehrt").toBeGreaterThanOrEqual(5);
  });
});

/* ======================================================================== */
/* 3 — Greifen am Kopf                                                       */
/* ======================================================================== */

/**
 * Der Schalenkorb, wie ihn `excavator.ts` (`isInsideGrapple`, Zeile 2492)
 * rechnet — hier nachgebaut, weil der Bagger sich kopflos nicht bauen laesst.
 *
 * Die Zahlen kommen aus `clawGeometry.ts`; nur die drei Zugaben (+0,22 oben,
 * −0,18 unten, +0,14 im Halbmesser) sind abgeschrieben. Wer sie dort aendert,
 * muss sie hier mitaendern — dafuer steht dieser Hinweis.
 */
function korbTest(splay: number): (p: THREE.Vector3) => boolean {
  const spitze = clawPoint(0, splay, CLAW_SEGMENTS, new THREE.Vector3());
  const tipY = spitze.y;
  const tipR = Math.max(spitze.z, 0);
  return (p: THREE.Vector3): boolean => {
    if (p.y > CLAW_RING_Y + 0.22 || p.y < tipY - 0.18) return false;
    const t = THREE.MathUtils.clamp(
      (CLAW_RING_Y - p.y) / Math.max(CLAW_RING_Y - tipY, 0.01),
      0,
      1
    );
    const r = THREE.MathUtils.lerp(CLAW_RING_R, tipR, t) + 0.14;
    return Math.hypot(p.x, p.z) <= r;
  };
}

/** Wie viele Krallen liegen an? Nachbau von `excavator.krallenKontakte`. */
function krallen(
  body: RAPIER.RigidBody,
  splay: number,
  greiferPos: THREE.Vector3
): number {
  const col = body.collider(0);
  if (!col) return 0;
  const KONTAKT_NAH = 0.14; // excavator.ts
  let treffer = 0;
  const p = new THREE.Vector3();
  for (let c = 0; c < CLAW_COUNT; c++) {
    const a = (c / CLAW_COUNT) * Math.PI * 2;
    let nah = false;
    for (const seg of [CLAW_SEGMENTS, Math.round(CLAW_SEGMENTS * 0.6)]) {
      clawPoint(a, splay, seg, p).add(greiferPos);
      const pr = col.projectPoint({ x: p.x, y: p.y, z: p.z }, false);
      if (!pr) continue;
      const d = Math.hypot(pr.point.x - p.x, pr.point.y - p.y, pr.point.z - p.z);
      if (pr.isInside || d <= KONTAKT_NAH) {
        nah = true;
        break;
      }
    }
    if (nah) treffer++;
  }
  return treffer;
}

describe("Besen: greifbar am Kopf", () => {
  /**
   * Der Besen liegt flach auf dem Boden, die Spinne kommt von oben ueber den
   * Wulst. Das ist der Griff, den Patrick beschreibt: „ich würde quasi immer
   * oben greifen."
   */
  function aufbau(closure: number): {
    gefasst: number;
    mittig: boolean;
    krallenZahl: number;
  } {
    const { physics, items } = platz();
    // flach hingelegt: um X gekippt, der Wulst zeigt dann nach +z
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, TIEFE / 2 + 0.02, 0),
      q
    );
    for (let i = 0; i < 90; i++) physics.step();

    const p = besen.body.translation();
    const rot = besen.body.rotation();
    // Weltlage des Wulstes: lokal (0, +h/2, 0)
    const kopf = new THREE.Vector3(0, HOEHE / 2 - 0.1, 0)
      .applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
      .add(new THREE.Vector3(p.x, p.y, p.z));

    // Die Spinne so setzen, dass ihr Sensor knapp ueber dem Wulst steht.
    const SENSOR_LOKAL = -(0.55 + 0.2 + 0.75); // excavator.ts: GRAPPLE_LINK + 0,2 + PALM_TO_SENSOR
    const greiferPos = new THREE.Vector3(kopf.x, kopf.y + 0.12 - SENSOR_LOKAL, kopf.z);
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        greiferPos.x,
        greiferPos.y,
        greiferPos.z
      )
    );
    const grip = new GripSystem(physics.world, greifer);
    const splay = THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, closure);
    const imKorb = korbTest(splay);
    const lokal = new THREE.Vector3();
    grip.insideGrapple = (welt) => imKorb(lokal.copy(welt).sub(greiferPos));
    grip.krallenKontakte = (b) => krallen(b, splay, greiferPos);

    const sensor = new THREE.Vector3(greiferPos.x, greiferPos.y + SENSOR_LOKAL, greiferPos.z);
    grip.update(closure, true, sensor, 1 / 60);

    const mitte = besen.body.translation();
    return {
      gefasst: grip.grippedCount,
      mittig: imKorb(lokal.set(mitte.x, mitte.y, mitte.z).sub(greiferPos)),
      krallenZahl: krallen(besen.body, splay, greiferPos),
    };
  }

  /** Die Spinne faehrt zu, waehrend der Spieler haelt — wie im Spiel. */
  function zufahren(): { gefasst: number; beiClosure: number | null } {
    const { physics, items } = platz();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, TIEFE / 2 + 0.02, 0),
      q
    );
    for (let i = 0; i < 90; i++) physics.step();
    const p = besen.body.translation();
    const rot = besen.body.rotation();
    const kopf = new THREE.Vector3(0, HOEHE / 2 - 0.1, 0)
      .applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
      .add(new THREE.Vector3(p.x, p.y, p.z));
    const SENSOR_LOKAL = -(0.55 + 0.2 + 0.75);
    const greiferPos = new THREE.Vector3(kopf.x, kopf.y + 0.12 - SENSOR_LOKAL, kopf.z);
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        greiferPos.x,
        greiferPos.y,
        greiferPos.z
      )
    );
    const grip = new GripSystem(physics.world, greifer);
    let splay = CLAW_OPEN_SPLAY;
    const lokal = new THREE.Vector3();
    grip.insideGrapple = (welt) => korbTest(splay)(lokal.copy(welt).sub(greiferPos));
    grip.krallenKontakte = (b) => krallen(b, splay, greiferPos);
    const sensor = new THREE.Vector3(greiferPos.x, greiferPos.y + SENSOR_LOKAL, greiferPos.z);
    // 0 auf 1 in 0,8 s — das Tempo, mit dem die Spinne zufaehrt
    let beiClosure: number | null = null;
    for (let i = 0; i <= 48; i++) {
      const closure = Math.min(i / 48, 1);
      splay = THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, closure);
      grip.update(closure, true, sensor, 1 / 60);
      if (grip.grippedCount > 0 && beiClosure === null) beiClosure = closure;
      physics.step();
    }
    return { gefasst: grip.grippedCount, beiClosure };
  }

  it("wird beim Zufahren der Spinne am Wulst gefasst", () => {
    /*
     * So, wie es im Spiel laeuft: Der Spieler haelt die Greiftaste, die
     * Spinne faehrt zu, und das Greifsystem probiert in jedem Schritt des
     * Fensters 0,60 bis 0,98 (`gripSystem.ts`). Es zaehlt also, ob es
     * IRGENDWANN in diesem Fenster zupackt — nicht, ob es bei jedem einzelnen
     * Schliessgrad zupackt.
     */
    const r = zufahren();
    // eslint-disable-next-line no-console
    console.log(`Greifen beim Zufahren: gefasst ab Schliessgrad ${r.beiClosure?.toFixed(2)}`);
    expect(r.gefasst, "der Besen wird beim Zufahren nicht gefasst").toBe(1);
  });

  it("Befund: ab etwa 0,8 zu ist der Kopfgriff allein nicht mehr genug", () => {
    /*
     * Das ist der Fall, an dem Karossen frueher gescheitert sind, und er
     * betrifft den Besen genauso: Wer oben fasst, hat den Schwerpunkt weit
     * unten — bei diesem Objekt 0,55 m vom Griff entfernt. Solange die Spinne
     * noch weit offen ist, liegt er trotzdem im Korb; je enger sie zugeht,
     * desto schmaler wird der Korb, und irgendwann faellt er heraus.
     *
     * Praktisch macht das nichts, weil das Greiffenster bei 0,60 beginnt und
     * dort zupackt (Test darueber). Der Wert steht hier trotzdem fest, damit
     * er auffaellt, falls jemand das Fenster verschiebt.
     */
    const weit = aufbau(0.65);
    const eng = aufbau(0.95);
    // eslint-disable-next-line no-console
    console.log(
      `Einzelbild: 0,65 → gefasst=${weit.gefasst}, Schwerpunkt im Korb=${weit.mittig}, Krallen=${weit.krallenZahl}` +
        ` · 0,95 → gefasst=${eng.gefasst}, Schwerpunkt im Korb=${eng.mittig}, Krallen=${eng.krallenZahl}`
    );
    expect(weit.gefasst, "weit offen muss der Kopfgriff reichen").toBe(1);
    expect(eng.mittig, "eng zu liegt der Schwerpunkt noch im Korb").toBe(false);
  });

  it("Gegenprobe: neben der Spinne wird nichts gefasst", () => {
    const { physics, items } = platz();
    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(4, TIEFE / 2 + 0.02, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))
    );
    for (let i = 0; i < 60; i++) physics.step();
    const greiferPos = new THREE.Vector3(0, 3, 0);
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0)
    );
    const grip = new GripSystem(physics.world, greifer);
    const splay = THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, 0.85);
    const imKorb = korbTest(splay);
    const lokal = new THREE.Vector3();
    grip.insideGrapple = (welt) => imKorb(lokal.copy(welt).sub(greiferPos));
    grip.krallenKontakte = (b) => krallen(b, splay, greiferPos);
    grip.update(0.85, true, new THREE.Vector3(0, 1.5, 0), 1 / 60);
    expect(grip.grippedCount, "vier Meter daneben darf nichts gefasst werden").toBe(0);
    expect(besen.body.isValid()).toBe(true);
  });
});

/* ======================================================================== */
/* 4 — Platzinventar: einer, wertlos, kommt wieder                           */
/* ======================================================================== */

/**
 * Die Tagesuhr des Spiels, kopflos.
 *
 * `Daylight` faerbt beim Rechnen den Himmel — dafuer braucht die Szene einen
 * Hintergrund. Das ist im Spiel selbstverstaendlich, in einer nackten Szene
 * nicht.
 */
function tagesuhr(): Daylight {
  const szene = new THREE.Scene();
  szene.background = new THREE.Color(0x000000);
  return new Daylight(szene, new THREE.HemisphereLight(), new THREE.DirectionalLight());
}

describe("Besen: Platzinventar, kein Handelsgut", () => {
  it("wird beim Neuen Spiel genau einmal gesetzt", () => {
    const { items } = platz();
    expect(items.inventarNachtragen(), "der erste Aufruf legt ihn hin").toEqual([
      "Maschendraht-Besen",
    ]);
    expect(items.inventarNachtragen(), "der zweite legt keinen zweiten an").toEqual([]);
    const inventar = items.items.filter((it) => istPlatzinventar(it.shape));
    expect(inventar.length, "es liegt nicht genau ein Besen auf dem Platz").toBe(1);
    expect(inventar[0].shape?.inventar).toBe("besen");
  });

  it("steht als Gattung in der Inventarliste, nicht als Sonderfall", () => {
    /*
     * Die Liste ist der gemeinsame Ort fuer Besen und Muellcontainer
     * (Ansage 15.09.2026). Sie darf wachsen; was hier steht, muss eine
     * Kennung und einen Namen haben.
     */
    expect(
      PLATZINVENTAR.some((st) => st.id === "besen"),
      "der Besen fehlt in der Liste"
    ).toBe(true);
    for (const st of PLATZINVENTAR) {
      expect(st.id.length, "ein Inventarstueck ohne Kennung").toBeGreaterThan(0);
      expect(st.name.length, `${st.id} hat keinen Namen`).toBeGreaterThan(0);
    }
  });

  it("steht in keiner Ladungsliste — er wird nie angeliefert", () => {
    const listen = [SPECS, KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE];
    for (const liste of listen) {
      expect(
        liste.some((sp) => sp.bau === "besen"),
        "ein Besen steht in einer Ladungsliste und wuerde angeliefert"
      ).toBe(false);
    }
  });

  it("geht in der Spinne nicht kaputt", () => {
    const { items } = platz();
    const besen = items.spawnBesen()!;
    expect(items.isCrushable(besen), "der Besen laesst sich zerdruecken").toBe(false);

    // Gegenprobe: dasselbe Stueck OHNE die Inventarmarke ist sehr wohl pressbar
    // — die Marke ist also der Grund und nicht die Form.
    const ware = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      { ...besenForm(), inventar: undefined },
      new THREE.Vector3(6, 2, 6)
    );
    expect(items.isCrushable(ware), "Aufbau: ohne Marke waere es pressbar").toBe(true);
  });

  it("wiegt fuer die Wirtschaft nichts — an genau einer Stelle", () => {
    /*
     * Ansage Patrick, 15.09.2026: „Selbst wenn er mal aufgeladen wird, gibt es
     * kein Geld dafuer. Auch wenn er in der Presse mal verschwindet, gaebe es
     * kein Geld dafuer." Die eine Stelle ist die Zusammensetzung: null Kilo.
     * Alles, was Geld rechnet, liest sie ohnehin — der Verkauf wie das
     * Presspaket.
     */
    const { items } = platz();
    const besen = items.spawnBesen()!;
    expect(besen.composition, "der Besen hat keine Zusammensetzung").toEqual([
      { materialId: BESEN.materialId, massKg: 0 },
    ]);
    expect(besen.massKg, "physikalisch wiegt er sehr wohl etwas").toBe(BESEN.massKg);
  });

  it("bringt beim Abholer kein Geld — auch nicht in gemischter Ladung", () => {
    const leer = { despawnByBody: () => false } as unknown as CompositeManager;

    const a = (() => {
      const { items } = platz();
      const zink = items.spawnScrap(
        "zinc",
        100,
        { kind: "box", dims: [0.4, 0.4, 0.4], color: 0x9aa6ad },
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion()
      );
      return new Account().sellContainer([zink], items, leer);
    })();

    const b = (() => {
      const { items } = platz();
      const besen = items.spawnBesen()!;
      const zink = items.spawnScrap(
        "zinc",
        100,
        { kind: "box", dims: [0.4, 0.4, 0.4], color: 0x9aa6ad },
        new THREE.Vector3(0, 2, 0),
        new THREE.Quaternion()
      );
      return new Account().sellContainer([zink, besen], items, leer);
    })();

    // eslint-disable-next-line no-console
    console.log(
      `Verkauf ohne Besen ${a.eur.toFixed(2)} EUR / ${a.massKg} kg \u00b7 ` +
        `mit Besen ${b.eur.toFixed(2)} EUR / ${b.massKg} kg`
    );
    expect(b.eur, "der Besen aendert den Erloes").toBeCloseTo(a.eur, 6);
    expect(b.massKg, "der Besen zaehlt als Umschlag").toBe(a.massKg);
    expect(b.purity, "der Besen verunreinigt die Ladung").toBeCloseTo(a.purity, 6);
  });

  it("und wenn NUR er auf dem Wagen liegt, bleibt das Spiel trotzdem stehen? Nein.", () => {
    /*
     * Der Fall, der ohne Vorsorge abstuerzt: leere Massentabelle, keine
     * dominante Fraktion, `getMaterial("")` wirft.
     */
    const { items } = platz();
    const besen = items.spawnBesen()!;
    const account = new Account();
    const vorher = account.moneyEur;
    const leer = { despawnByBody: () => false } as unknown as CompositeManager;
    const sale = account.sellContainer([besen], items, leer);
    expect(sale.eur, "fuer Inventar gibt es kein Geld").toBe(0);
    expect(sale.massKg, "Inventar zaehlt nicht als Umschlag").toBe(0);
    expect(account.moneyEur, "das Konto hat sich bewegt").toBe(vorher);
  });

  it("Gegenprobe: gewoehnlicher Schrott wird sehr wohl verkauft", () => {
    const { items } = platz();
    const teil = items.spawnScrap(
      "steel",
      100,
      { kind: "box", dims: [0.4, 0.4, 0.4], color: 0x808080 },
      new THREE.Vector3(0, 2, 0),
      new THREE.Quaternion()
    );
    const account = new Account();
    const leer = { despawnByBody: () => false } as unknown as CompositeManager;
    const sale = account.sellContainer([teil], items, leer);
    expect(sale.massKg, "Aufbau: normaler Schrott zaehlt").toBe(100);
    expect(sale.eur, "Aufbau: normaler Schrott bringt Geld").toBeGreaterThan(0);
  });

  it("ist am naechsten Tag wieder da", () => {
    /*
     * „Und er kommt jeden Tag wieder." Der Tageswechsel ist der Umlauf der Uhr
     * um Mitternacht (`world/daylight.ts`); mehr Tagesstruktur gibt es nicht,
     * und mehr wird hier auch nicht erfunden.
     */
    const { items } = platz();
    items.remove(items.spawnBesen()!); // verkauft, verpresst, heruntergefallen
    expect(
      items.items.some((it) => istPlatzinventar(it.shape)),
      "weg ist weg"
    ).toBe(false);

    const uhr = tagesuhr();
    let wechsel = 0;
    for (let i = 0; i < DAY_LENGTH_S * 60; i++) {
      uhr.update(1 / 60);
      if (uhr.neuerTag) {
        uhr.neuerTag = false;
        wechsel++;
        items.inventarNachtragen();
      }
    }
    expect(wechsel, "die Uhr ist in einem Tag nicht genau einmal umgelaufen").toBe(1);
    expect(
      items.items.filter((it) => istPlatzinventar(it.shape)).length,
      "der Besen ist am naechsten Tag nicht wieder da"
    ).toBe(1);
  });

  it("Gegenprobe: ohne Tageswechsel bleibt er weg", () => {
    const { items } = platz();
    items.remove(items.spawnBesen()!);
    const uhr = tagesuhr();
    for (let i = 0; i < 600; i++) uhr.update(1 / 60); // zehn Sekunden Spielzeit
    expect(uhr.neuerTag, "so schnell ist kein Tag um").toBe(false);
    expect(
      items.items.filter((it) => istPlatzinventar(it.shape)).length,
      "er kam ohne Tageswechsel zurueck"
    ).toBe(0);
  });
});

/* ======================================================================== */
/* 5 — Sein Platz auf dem Hof                                                */
/* ======================================================================== */

describe("Besen: wo er liegt", () => {
  const d = abstandVomStand(BESEN_PLATZ.x, BESEN_PLATZ.z);

  it("liegt im Schwenkband des Baggers", () => {
    // eslint-disable-next-line no-console
    console.log(
      `Besenplatz (${BESEN_PLATZ.x} | ${BESEN_PLATZ.z}) — ${d.toFixed(2)} m vom Sitz ` +
        `(${BAGGER_STAND.x} | ${BAGGER_STAND.z})`
    );
    expect(d, "zu nah am Sitz").toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(d, "ausser Reichweite").toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("liegt nicht im Starthaufen und nicht im Streuschrott", () => {
    const zumHaufen = Math.hypot(BESEN_PLATZ.x - START_HAUFEN.x, BESEN_PLATZ.z - START_HAUFEN.z);
    expect(zumHaufen, "er waere unter dem Haufen begraben").toBeGreaterThan(
      START_HAUFEN.streuung + 0.5
    );
    for (let i = 0; i < START_STREU.teile; i++) {
      const a = (i / START_STREU.teile) * Math.PI * 2;
      const x = START_STREU.x + Math.cos(a) * START_STREU.radius;
      const z = START_STREU.z + Math.sin(a) * START_STREU.radius;
      expect(
        Math.hypot(BESEN_PLATZ.x - x, BESEN_PLATZ.z - z),
        `Streuteil ${i} faellt auf den Besen`
      ).toBeGreaterThan(1.0);
    }
  });

  it("liegt nicht in der Presskammer", () => {
    const x0 = PRESS_CENTER.x - (PRESS_INNER.laenge + 0.7) / 2;
    const x1 = PRESS_CENTER.x + (PRESS_INNER.laenge + 0.7) / 2;
    const z0 = PRESS_CENTER.z - (PRESS_INNER.tiefe + 0.7) / 2;
    const z1 = PRESS_CENTER.z + (PRESS_INNER.tiefe + 0.7) / 2;
    const dx = Math.max(x0 - BESEN_PLATZ.x, 0, BESEN_PLATZ.x - x1);
    const dz = Math.max(z0 - BESEN_PLATZ.z, 0, BESEN_PLATZ.z - z1);
    expect(Math.hypot(dx, dz), "der Besen liegt in der Presse").toBeGreaterThan(1.5);
  });

  it("liegt in keiner Halde und in keiner Mulde — mit Abstand", () => {
    /*
     * Sonst zaehlte das Werkzeug als sortiertes Material — und der Spieler
     * bekaeme eine Sortierpraemie fuer seinen eigenen Besen. Die Zone wird
     * gegen den Mittelpunkt des Koerpers geprueft (`containers.containsPoint`
     * gegen `body.translation()`), darum reicht der Mittelpunkt als Mass. Ein
     * Meter Abstand verlangt der Test trotzdem: Ein Besen, der auf der Kante
     * liegt, rutscht beim ersten Anstossen hinein.
     */
    let naechste = Infinity;
    let name = "";
    for (const c of CONFIGS) {
      const dx = Math.abs(BESEN_PLATZ.x - c.x) - c.size[0] / 2;
      const dz = Math.abs(BESEN_PLATZ.z - c.z) - c.size[1] / 2;
      const ab =
        dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
      if (ab < naechste) {
        naechste = ab;
        name = c.label;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`naechste Zone: ${name}, ${naechste.toFixed(2)} m entfernt`);
    expect(naechste, `zu nah an ${name}`).toBeGreaterThan(1.0);
  });
});
