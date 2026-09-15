/**
 * Waechter fuer den Kehrbesen (E-031, neu gerechnet in E-037 am 15.09.2026).
 *
 * Wunsch Patrick vormittags: „Ich bräuchte einen Maschendrahtzaun, der quasi
 * oben schon gequetscht ist und unten breit ist, der quasi wie ein Besen
 * fungiert ... Damit ich quasi mit dem Maschendrahtzaun den Boden bzw. die
 * Ladeflächen abkehren kann."
 *
 * Befund am Geraet abends: „Der ist viel zu klein. Er soll fast so breit sein
 * wie eine Pritsche und viel voluminöser. Das Breite ist eigentlich das am
 * meisten Volumen einnehmende ... oben ist das alles wie eine Kugel geformt,
 * aber auch nicht so sauber ... es ist halt ein bisschen wie ein Tee-Ei."
 *
 * Aus dem Trichter ist damit ein Ballen geworden. Das ist ein WERKZEUG, kein
 * Deko-Stueck — ein Aussehen allein nuetzt nichts. Darum misst dieser Test in
 * der echten Rapier-Welt:
 *
 * 1. **Die Form ist ein Ballen**: unten am breitesten, Flanke praktisch
 *    senkrecht, nach oben rund zulaufend, keine Taille — und die EINE konvexe
 *    Huelle folgt dem, was man sieht. Die Gegenprobe mit einer Sanduhr faellt
 *    durch.
 * 2. **Masse und Rauminhalt sind gerechnet**, nicht gesetzt: Drahtmenge mal
 *    Drahtgewicht, und die Packung liegt zwischen „lose" und „flach gestapelt".
 * 3. **Er kehrt**: Teilegroesse gegen mitgenommene Strecke, gemessen.
 * 4. **Die Spinne bekommt ihn**: vom Bodenanschlag aus zugefahren.
 * 5. **Er ist Platzinventar**: genau einer, wertlos, kommt wieder.
 * 6. **Sein Fleck ist gesucht, nicht gewaehlt** — und er liegt nicht dort, wo
 *    der Kipper abkippt.
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
  dampAng,
  dampLin,
  istPlatzinventar,
  quaderRaum,
  PLATZINVENTAR,
  SPECS,
  type ScrapItem,
} from "../src/world/scrapItems";
import { KATALOG_SPECS, KATALOG_BIG, KATALOG_HUGE } from "../src/world/objektkatalog";
import { baueGeometrie, punkteBis, BESEN_FORM } from "../src/world/objektbau";
import { BESEN_PLATZ, START_HAUFEN, START_STREU, START_AUTOS } from "../src/world/startplatz";
import {
  BAGGER_STAND,
  SCHWENK_AUSSEN,
  SCHWENK_INNEN,
  abstandVomStand,
} from "../src/world/baggerstand";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { CONFIGS } from "../src/world/containers";
import { hitsObstacle } from "../src/world/obstacles";
import { Daylight, DAY_LENGTH_S } from "../src/world/daylight";
import { Account } from "../src/economy/account";
import type { CompositeManager } from "../src/dismantle/composites";
import {
  ABKIPP_ZONE,
  ABLADE_HALT_Z,
  ABLADE_SPUR_X,
  BED_HALF_W,
  BED_LEN,
  BLOCKING_MASS_KG,
  WORK_ZONES,
} from "../src/delivery/routes";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  clawPoint,
  clawSpan,
  clawTipDepth,
  clawWidth,
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

/** Liegt der Punkt in irgendeinem Kollider des Koerpers? */
function innen(body: RAPIER.RigidBody, x: number, y: number, z: number): boolean {
  for (let i = 0; i < body.numColliders(); i++) {
    const p = body.collider(i).projectPoint({ x, y, z }, true);
    if (p && p.isInside) return true;
  }
  return false;
}

/**
 * Halbmesser des Kolliders auf Hoehe `y` in Richtung `theta`.
 *
 * Nicht die rohen Eckpunkte des Netzes messen: Zwischen zwei Drahtknoten
 * liegen Baender ganz ohne Eckpunkte, und was die Physik sieht, ist der
 * Kollider. Abgetastet wird mit `projectPoint(solid = true)`, das meldet, ob
 * ein Punkt IN einer Form liegt; die Kante wird dann eingeschachtelt.
 */
function kolliderR(body: RAPIER.RigidBody, y: number, theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  if (!innen(body, 0, y, 0)) return 0;
  let lo = 0;
  let hi = 2.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (innen(body, m * c, y, m * s)) lo = m;
    else hi = m;
  }
  return lo;
}

/** Breite und Tiefe des Kolliders auf einer Hoehe. */
function kolliderBei(body: RAPIER.RigidBody, y: number): { breite: number; tiefe: number } {
  return {
    breite: kolliderR(body, y, 0) + kolliderR(body, y, Math.PI),
    tiefe: kolliderR(body, y, Math.PI / 2) + kolliderR(body, y, -Math.PI / 2),
  };
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

/**
 * Wie weit steht die konvexe Huelle vom gezeichneten Draht ab?
 *
 * DAS ist die Frage hinter „braucht er eine oder zwei Huellen". Eine konvexe
 * Huelle kennt keine Einschnuerung; sie spannt sich ueber sie hinweg. Gemessen
 * wird darum parameterfrei: Auf der Oberflaeche der Huelle werden Punkte
 * abgetastet, und zu jedem wird der naechste Eckpunkt des Netzes gesucht.
 * Liegt die Huelle auf dem Draht, sind das ein paar Zentimeter — die halbe
 * Maschenweite. Ueberbrueckt sie eine Taille, wird der Abstand so gross wie
 * die Einschnuerung tief ist.
 *
 * @returns groesster Abstand in Metern
 */
function huelleUeberDraht(
  body: RAPIER.RigidBody,
  ecken: Float32Array,
  hoehe: number
): number {
  let schlimmster = 0;
  for (let i = 0; i <= 14; i++) {
    const y = -hoehe / 2 + 0.02 + (hoehe - 0.06) * (i / 14);
    for (let k = 0; k < 24; k++) {
      const theta = (k / 24) * Math.PI * 2;
      const r = kolliderR(body, y, theta);
      if (r <= 0) continue;
      const px = r * Math.cos(theta);
      const pz = r * Math.sin(theta);
      let naechster = Infinity;
      for (let e = 0; e + 2 < ecken.length; e += 3) {
        const d = (ecken[e] - px) ** 2 + (ecken[e + 1] - y) ** 2 + (ecken[e + 2] - pz) ** 2;
        if (d < naechster) naechster = d;
      }
      schlimmster = Math.max(schlimmster, Math.sqrt(naechster));
    }
  }
  return schlimmster;
}

/** Rauminhalt eines Koerpers, per Raster abgetastet. */
function rauminhalt(body: RAPIER.RigidBody, w: number, h: number, d: number, n = 48): number {
  let drin = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        if (
          innen(
            body,
            -w / 2 + (w * (i + 0.5)) / n,
            -h / 2 + (h * (j + 0.5)) / n,
            -d / 2 + (d * (k + 0.5)) / n
          )
        )
          drin++;
  return (drin / (n * n * n)) * w * h * d;
}

/**
 * Eine Sanduhr als Attrappe — die Form, fuer die EINE Huelle nicht reicht.
 *
 * Zwei Scheiben, dazwischen ein duenner Hals. Sie dient zweimal: als
 * Gegenprobe zu `huelleUeberDraht` und als Nachweis, dass die Maschinerie fuer
 * mehrteilige Kollider (`Bauteil.huellen`, `punkteBis`, `quaderRaum`) noch
 * funktioniert, obwohl sie seit E-037 von keinem Bau mehr benutzt wird.
 */
function sanduhr(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const scheibe = (y: number, r: number, h: number): void => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const g = new THREE.BoxGeometry(0.05, h, 0.05);
      g.translate(r * Math.cos(a), y, r * Math.sin(a));
      teile.push(g);
    }
  };
  scheibe(-0.6, 0.6, 0.2);
  scheibe(0.6, 0.6, 0.2);
  scheibe(0, 0.08, 0.9);
  const geo = new THREE.BufferGeometry();
  const alle: number[] = [];
  for (const t of teile) {
    const p = t.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) alle.push(p.getX(i), p.getY(i), p.getZ(i));
    t.dispose();
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(alle, 3));
  return geo;
}

/* ======================================================================== */
/* 1 — Die Form ist ein Ballen                                               */
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
    // eslint-disable-next-line no-console
    console.log(`Netz: ${pos.count / 3} Dreiecke, ${pos.count} Eckpunkte`);
    expect(pos.count / 3, "Dreiecke").toBeGreaterThan(2000);
    expect(pos.count / 3, "unnoetig viele Dreiecke").toBeLessThan(6000);
  });

  it("misst aussen genau die Katalogmasse", () => {
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    bau.koerper.computeBoundingBox();
    const b = bau.koerper.boundingBox!;
    expect(b.max.x - b.min.x, "Breite").toBeCloseTo(BREITE, 3);
    expect(b.max.y - b.min.y, "Hoehe").toBeCloseTo(HOEHE, 3);
    expect(b.max.z - b.min.z, "Tiefe").toBeCloseTo(TIEFE, 3);
  });

  it("ist unten am breitesten und laeuft nach oben rund zu — ohne Taille", () => {
    const { body } = besenKoerper();
    /*
     * EINE Huelle, gemessen statt uebernommen. Der Trichter von heute
     * vormittag brauchte zwei, weil eine einzige seine Taille ueberbrueckt
     * haette. Der Ballen hat keine.
     */
    expect(body.numColliders(), "der Ballen braucht keine zweite Huelle").toBe(1);

    const stufen: Array<{ y: number; breite: number; tiefe: number }> = [];
    for (let i = 0; i <= 10; i++) {
      const y = -HOEHE / 2 + 0.03 + (HOEHE - 0.08) * (i / 10);
      stufen.push({ y, ...kolliderBei(body, y) });
    }
    // eslint-disable-next-line no-console
    console.log(
      "Kollider ueber die Hoehe:\n" +
        stufen
          .map((s) => `  y ${s.y.toFixed(2).padStart(5)}  ${s.breite.toFixed(2)} x ${s.tiefe.toFixed(2)} m`)
          .join("\n")
    );

    // Unten die volle Breite — das ist die Schleppkante.
    expect(stufen[0].breite, "unten nicht breit").toBeGreaterThan(BREITE * 0.95);
    // Und flach: deutlich breiter als tief, sonst waere es eine Kugel.
    expect(stufen[0].breite / stufen[0].tiefe, "unten nicht flach").toBeGreaterThan(1.6);
    // Keine Taille: von unten nach oben wird er nie wieder breiter.
    for (let i = 1; i < stufen.length; i++) {
      expect(
        stufen[i].breite,
        `zwischen y ${stufen[i - 1].y.toFixed(2)} und ${stufen[i].y.toFixed(2)} wird er wieder breiter`
      ).toBeLessThanOrEqual(stufen[i - 1].breite + 0.01);
    }
    // Oben laeuft er zu — sonst waere es ein Quader.
    expect(stufen[stufen.length - 1].breite, "oben nicht rund zulaufend").toBeLessThan(
      stufen[0].breite * 0.55
    );
  });

  /**
   * Neigung der Flanke ueber die untersten `hoch` Meter (Grad).
   *
   * Positiv heisst „nach hinten geneigt" — die Front springt nach oben zurueck.
   * Negativ heisst Ueberhang: Die breiteste Stelle liegt dann NICHT am Boden,
   * und alles, was der Besen vor sich hertreibt, wird unter den Bauch gedrueckt.
   */
  function flankenwinkel(body: RAPIER.RigidBody, unten: number, hoch: number): number {
    const r0 = kolliderR(body, unten + 0.02, 0);
    const r1 = kolliderR(body, unten + hoch, 0);
    return (Math.atan2(r0 - r1, hoch - 0.02) * 180) / Math.PI;
  }

  it("die Schleppkante steht praktisch senkrecht", () => {
    /*
     * Eine gewoelbte Front schoebe Kleinteile nach aussen weg, statt sie vor
     * sich herzuschieben. Gemessen wird die Flanke auf den unteren 18 cm —
     * das ist genau der Bereich, in dem die Teile aus der Kehr-Tabelle liegen
     * (5 bis 18 cm Kantenlaenge). Weiter oben darf er rund werden, dort
     * beruehrt er nichts mehr.
     */
    const { body } = besenKoerper();
    const nah = flankenwinkel(body, -HOEHE / 2, 0.18);
    const weit = flankenwinkel(body, -HOEHE / 2, 0.3 * HOEHE);
    // eslint-disable-next-line no-console
    console.log(
      `Flanke: ${nah.toFixed(1)} Grad auf den unteren 18 cm, ` +
        `${weit.toFixed(1)} Grad auf den unteren 30 % der Hoehe`
    );
    /*
     * Die Grenze ist nicht der Winkel, sondern die Breite: Auf den unteren
     * 18 cm darf der Ballen hoechstens 5 % seiner Breite verlieren — dann ist
     * die Schleppkante wirklich die breiteste Stelle und nicht nur ein Rand.
     * Gemessen sind es 3 %. Ein Ueberhang (Wert ueber 1) ist verboten: Dann
     * laege die breiteste Stelle hoeher, und alles Gekehrte kaeme unter den
     * Bauch.
     */
    const r0 = kolliderR(body, -HOEHE / 2 + 0.02, 0);
    const r1 = kolliderR(body, -HOEHE / 2 + 0.18, 0);
    // eslint-disable-next-line no-console
    console.log(`Schleppkante ${r0.toFixed(3)} m, auf 18 cm Hoehe ${r1.toFixed(3)} m`);
    expect(r1 / r0, "die Flanke zieht sich zu schnell ein").toBeGreaterThan(0.95);
    expect(r1 / r0, "Ueberhang: die breiteste Stelle liegt nicht am Boden").toBeLessThanOrEqual(1);
    expect(nah, "die Front haengt zu weit zurueck").toBeLessThan(15);
  });

  it("Gegenprobe: eine Kugel derselben Breite haengt ueber", () => {
    /*
     * Ohne diese Probe misst der Test oben nur, dass irgendein Koerper da ist.
     * Eine Kugel ist auf halber Hoehe am breitesten; unten haengt sie ueber,
     * und der Winkel wird negativ. Genau deshalb ist der Ballen unten platt
     * und nicht rund.
     */
    const { physics } = platz();
    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0)
    );
    physics.world.createCollider(RAPIER.ColliderDesc.ball(BREITE / 2), body);
    const winkel = flankenwinkel(body, -BREITE / 2, 0.18);
    const r0 = kolliderR(body, -BREITE / 2 + 0.02, 0);
    const r1 = kolliderR(body, -BREITE / 2 + 0.18, 0);
    // eslint-disable-next-line no-console
    console.log(
      `Kugel: unten ${r0.toFixed(3)} m, auf 18 cm ${r1.toFixed(3)} m — ` +
        `${winkel.toFixed(1)} Grad, also Ueberhang statt Schleppkante`
    );
    expect(r1 / r0, "eine Kugel duerfte die Bedingung NICHT erfuellen").toBeGreaterThan(1);
  });

  it("eine Huelle genuegt: sie liegt auf dem Draht, statt ihn zu ueberbruecken", () => {
    const { body } = besenKoerper();
    const bau = baueGeometrie("besen", BESEN.dims, "box");
    const ecken = punkteBis(bau.koerper, -Infinity, Infinity);
    const ab = huelleUeberDraht(body, ecken, HOEHE);
    // eslint-disable-next-line no-console
    console.log(
      `Huelle steht hoechstens ${ab.toFixed(3)} m vom naechsten Drahtknoten ab ` +
        `(${ecken.length / 3} Knoten)`
    );
    // Eine halbe Maschenweite ist normal, mehr waere eine ueberbrueckte Delle.
    expect(ab, "die Huelle haengt frei ueber dem Draht").toBeLessThan(0.2);
  });

  it("Gegenprobe: bei einer Sanduhr faellt genau diese Messung durch", () => {
    /*
     * Ein Waechter, den man nie hat scheitern sehen, ist keiner. Dieselbe
     * Messung ueber eine Form MIT Taille — sie muss die Grenze reissen, sonst
     * misst der Test oben etwas anderes als das, was er zu messen glaubt.
     */
    const { physics } = platz();
    const geo = sanduhr();
    const punkte = (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(RAPIER.ColliderDesc.convexHull(punkte)!, body);
    const ab = huelleUeberDraht(body, punkte, 1.1);
    // eslint-disable-next-line no-console
    console.log(`Sanduhr: Huelle steht ${ab.toFixed(3)} m vom naechsten Knoten ab`);
    expect(ab, "eine Sanduhr duerfte die Bedingung NICHT erfuellen").toBeGreaterThan(0.2);
  });

  it("die Maschinerie fuer Formen mit Taille lebt noch", () => {
    /*
     * Seit E-037 nutzt kein Bau mehr `Bauteil.huellen`. Weil der naechste
     * Gegenstand mit Hals sie wieder braucht, wird sie hier an der Sanduhr
     * durchgespielt: Punktwolken trennen, zwei Huellen bauen, Masse nach
     * Rauminhalt aufteilen.
     */
    const { physics } = platz();
    const geo = sanduhr();
    const oben = punkteBis(geo, 0.48, Infinity);
    const unten = punkteBis(geo, -Infinity, -0.48);
    expect(oben.length, "obere Wolke leer").toBeGreaterThan(12);
    expect(unten.length, "untere Wolke leer").toBeGreaterThan(12);
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic());
    const raeume = [quaderRaum(unten), quaderRaum(oben)];
    const summe = raeume[0] + raeume[1];
    for (const [i, wolke] of [unten, oben].entries()) {
      physics.world.createCollider(
        RAPIER.ColliderDesc.convexHull(wolke)!.setMass((100 * raeume[i]) / summe),
        body
      );
    }
    expect(body.numColliders(), "zwei Huellen an einem Koerper").toBe(2);
    expect(body.mass(), "die Masse verteilt sich nicht auf 100 kg").toBeCloseTo(100, 4);
    // Beide Scheiben sind gleich gross, also sitzt der Schwerpunkt in der Mitte.
    expect(Math.abs(body.localCom().y), "der Schwerpunkt haengt schief").toBeLessThan(0.05);
    // Und die Taille bleibt erhalten: in der Mitte ist NICHTS.
    const mitte = kolliderBei(body, 0);
    // eslint-disable-next-line no-console
    console.log(`Sanduhr mit zwei Huellen: Taille ${mitte.breite.toFixed(2)} m`);
    expect(mitte.breite, "die Taille ist doch ueberbrueckt").toBeLessThan(0.1);
  });

  it("der Schwerpunkt liegt tief", () => {
    /*
     * Der Ballen ist unten breit und oben rund — schon die Huelle allein legt
     * den Schwerpunkt damit unter die Mitte. Beim Trichter war dafuer eine
     * Massenaufteilung auf zwei Kollider noetig; hier faellt es von selbst an.
     */
    const { body } = besenKoerper();
    const cm = body.localCom();
    // eslint-disable-next-line no-console
    console.log(
      `Schwerpunkt lokal y = ${cm.y.toFixed(3)} m (Mitte 0, Schleppkante ${(-HOEHE / 2).toFixed(2)})`
    );
    expect(cm.y, "der Schwerpunkt sitzt nicht unten").toBeLessThan(-0.08);
    expect(body.mass(), "die Gesamtmasse stimmt nicht").toBeCloseTo(BESEN.massKg, 1);
  });
});

/* ======================================================================== */
/* 2 — Masse und Rauminhalt sind gerechnet                                   */
/* ======================================================================== */

describe("Besen: woher Masse und Rauminhalt kommen", () => {
  /** Draht je Quadratmeter Maschendraht: 2,8 mm Draht, 50 mm Masche. */
  const DRAHT_M_JE_M2 = 56.6;
  /** Gewicht von 2,8-mm-Stahldraht (kg/m). */
  const KG_JE_M = 0.048;
  /** Handelsuebliche Rolle: 1,25 m hoch, 25 m lang. */
  const ROLLE_M2 = 1.25 * 25;
  /** „Sehr viele Maschendraehte" — acht Rollen. */
  const ROLLEN = 8;

  it("die Masse ist die Drahtmenge, nicht eine Zahl", () => {
    const flaeche = ROLLEN * ROLLE_M2;
    const kgJeM2 = DRAHT_M_JE_M2 * KG_JE_M;
    const kg = flaeche * kgJeM2;
    // eslint-disable-next-line no-console
    console.log(
      `${ROLLEN} Rollen = ${flaeche} m² x ${kgJeM2.toFixed(2)} kg/m² = ${kg.toFixed(1)} kg ` +
        `(im Katalog ${BESEN.massKg} kg)`
    );
    expect(BESEN.massKg, "die Masse passt nicht zur Drahtmenge").toBe(Math.ceil(kg));
  });

  it("der Rauminhalt passt zu einem getretenen Ballen, nicht zu einer Rolle", () => {
    const { body } = besenKoerper();
    const raum = rauminhalt(body, BREITE, HOEHE, TIEFE);
    const packung = BESEN.massKg / raum;
    /** Dichteste flache Lage: zwei Drahtdurchmesser je Maschenlage. */
    const flach = ROLLEN * ROLLE_M2 * (2 * 0.0028);
    // eslint-disable-next-line no-console
    console.log(
      `Rauminhalt ${raum.toFixed(3)} m³ · Packung ${packung.toFixed(0)} kg/m³ · ` +
        `flach gestapelt waeren es ${flach.toFixed(2)} m³ (${(BESEN.massKg / flach).toFixed(0)} kg/m³)`
    );
    // Locker genug, dass noch Luft zwischen den Lagen ist ...
    expect(raum, "der Ballen ist dichter als flach gestapelter Draht").toBeGreaterThan(flach);
    // ... aber nicht so locker, dass er nur noch Luft waere.
    expect(raum / flach, "der Ballen ist zu luftig").toBeLessThan(2.0);
    expect(packung, "Packung zu gering").toBeGreaterThan(150);
    expect(packung, "dichter als eine stramme Rolle (rund 700 kg/m³)").toBeLessThan(700);
  });

  it("Gegenprobe: ein voller Quader derselben Masse waere viel dichter", () => {
    /*
     * Wenn die Rastermessung nicht misst, was sie zu messen glaubt, faellt es
     * hier auf: Ein massiver Quader mit denselben Aussenmassen hat den vollen
     * Huellquader als Rauminhalt, und die Packung liegt dann deutlich unter
     * der des Ballen — nicht darueber.
     */
    const { physics } = platz();
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BREITE / 2, HOEHE / 2, TIEFE / 2),
      body
    );
    const raum = rauminhalt(body, BREITE, HOEHE, TIEFE);
    // eslint-disable-next-line no-console
    console.log(`Quader: ${raum.toFixed(3)} m³ (Huellquader ${(BREITE * HOEHE * TIEFE).toFixed(3)})`);
    expect(raum, "Aufbau: der Quader fuellt seinen Huellquader").toBeCloseTo(
      BREITE * HOEHE * TIEFE,
      1
    );
    const ballen = rauminhalt(besenKoerper().body, BREITE, HOEHE, TIEFE);
    expect(ballen, "der Ballen fuellt seinen Huellquader genauso — dann misst hier nichts").toBeLessThan(
      raum * 0.75
    );
  });
});

/* ======================================================================== */
/* 3 — Kehren: die Messung in der echten Physik                              */
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
 * gemessen bei null. Der Abstand zwischen beiden Gruppen ist der Grund, warum
 * diese Grenze nicht gefeilscht ist.
 */
const MITGEKEHRT_AB = 1.2;

describe("Besen: was die Schleppkante erfasst", () => {
  /*
   * Die Kehr-Tabelle. Zeilen = Kantenlaenge des Teils, Spalten = Bodenabstand
   * der Schleppkante. Gemessen, nicht geschaetzt. Die Werte der alten
   * Trichterform stehen zum Vergleich daneben — sie sind mit demselben Zug in
   * derselben Welt gemessen worden (Blatt `2026-09-15_besen-2.svg`).
   */
  const GROESSEN = [0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.5];
  const ABSTAENDE = [0.0, 0.05, 0.1];
  /** Weg in Metern mit der Trichterform vom 15.09.2026 vormittags. */
  const ALT: Record<string, number[]> = {
    "0.05": [2.35, 0.0, 0.0],
    "0.08": [2.36, 0.62, 0.0],
    "0.12": [2.38, 0.66, 0.53],
    "0.18": [2.41, 0.38, 0.74],
    "0.25": [2.45, 2.45, 0.74],
    "0.35": [2.5, 2.5, 2.5],
    "0.5": [2.57, 2.57, 2.57],
  };

  it("nimmt bei aufliegender Kante alles ab 5 cm mit — und ist nirgends schlechter als vorher", () => {
    const zeilen: string[] = [];
    const erfasst = new Map<string, number>();
    for (const s of GROESSEN) {
      const weg = ABSTAENDE.map((a) => kehrzug(s, a));
      weg.forEach((w, i) => erfasst.set(`${s}|${ABSTAENDE[i]}`, w));
      zeilen.push(
        `  ${(s * 100).toFixed(0).padStart(3)} cm : ` +
          weg
            .map(
              (w, i) =>
                `${(ABSTAENDE[i] * 100).toFixed(0)} cm → ${w.toFixed(2)} m (alt ${ALT[String(s)][i].toFixed(2)})`
            )
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
    /*
     * Und der Ballen darf nichts verlieren, was der Trichter konnte: Ein Teil,
     * das vorher mitkam, muss auch jetzt mitkommen. Auftrag 15.09.2026: „Der
     * bestehende Stand darf nicht schlechter werden."
     */
    for (const s of GROESSEN) {
      for (const [i, a] of ABSTAENDE.entries()) {
        if (ALT[String(s)][i] < MITGEKEHRT_AB) continue;
        expect(
          erfasst.get(`${s}|${a}`)!,
          `${s} m bei ${a} m Spalt kam frueher mit und jetzt nicht mehr`
        ).toBeGreaterThan(MITGEKEHRT_AB);
      }
    }
  });

  it("Gegenprobe: was flacher ist als der Spalt, bleibt liegen", () => {
    /*
     * Der Waechter oben muss auch scheitern koennen. Ein 3-cm-Stueck bei 12 cm
     * Bodenabstand darf NICHT mitkommen — sonst misst der Test etwas anderes
     * als das, was er zu messen glaubt (z. B. einen Sog oder einen Fehler in
     * der Wegmessung).
     */
    const weg = kehrzug(0.03, 0.12);
    // eslint-disable-next-line no-console
    console.log(`Gegenprobe: 3 cm bei 12 cm Spalt → ${weg.toFixed(2)} m`);
    expect(weg, "ein flaches Teil rutscht unter der Kante durch").toBeLessThan(MITGEKEHRT_AB);
  });

  it("kehrt eine Ladeflaeche leer — die Mitte in einer Bahn", () => {
    /*
     * Der zweite Anwendungsfall aus Patricks Beschreibung: „den Boden bzw. die
     * Ladeflächen abkehren". Eine Pritsche hat Bordwaende von 0,64 m
     * (`delivery/vehicleModel.ts`, `wandHoehe`) und eine Innenbreite von
     * 2 x `BED_HALF_W` = 2,70 m. Nachgebaut wird genau das: Flaeche, zwei
     * Bordwaende, vorn eine Stirnwand, hinten offen.
     *
     * DAS IST DER GEWINN DER NEUEN BREITE: Der Trichter war 1,20 m breit und
     * liess nach DREI Bahnen immer noch eines von sechs Teilen liegen. Der
     * Ballen ist 2,40 m breit und raeumt die Mitte in einer Bahn; die 0,15 m
     * Luft je Seite holt ein Versatz nach links und rechts.
     */
    const { physics, items } = platz();
    const WAND_H = 0.64;
    const FLAECHE_Y = 1.1; // Ladehoehe einer Pritsche (SW, aus dem Modell)
    const LAENGE = BED_LEN.pritsche!;
    expect(BREITE, "der Ballen passt nicht mehr zwischen die Bordwaende").toBeLessThan(
      BED_HALF_W * 2 - 0.2
    );
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

    /*
     * Der Besen wird direkt hinter der Stirnwand abgesetzt: Seine Vorderkante
     * steht dann an der Wand, und alles, was weiter hinten liegt, ist vor ihm.
     */
    const zStart = -LAENGE / 2 + TIEFE / 2 + 0.04;

    // Sechs Kleinteile ueber die ganze Breite, dicht vor dem Besen.
    const reste: ScrapItem[] = [];
    for (let i = 0; i < 6; i++) {
      reste.push(
        items.spawnScrap(
          "steel",
          6,
          { kind: "box", dims: [0.14, 0.12, 0.14], color: 0x808080 },
          new THREE.Vector3(-1.05 + i * 0.42, FLAECHE_Y + 0.2, zStart + TIEFE / 2 + 0.35),
          new THREE.Quaternion()
        )
      );
    }
    for (let i = 0; i < 90; i++) physics.step();

    const yOben = FLAECHE_Y + WAND_H + HOEHE / 2 + 0.3;
    const yUnten = FLAECHE_Y + HOEHE / 2 + 0.01;
    const besen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, yOben, zStart),
      new THREE.Quaternion()
    );
    besen.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const setz = (x: number, y: number, z: number): void => {
      besen.body.setNextKinematicTranslation({ x, y, z });
      physics.step();
    };
    const runter = (): number =>
      reste.filter((r) => r.body.translation().y < FLAECHE_Y - 0.2).length;

    expect(runter(), "Aufbau: vor dem Kehren liegt noch nichts unten").toBe(0);

    /*
     * DREI BAHNEN WAREN ES MIT DEM TRICHTER (1,20 m breit), und auch dann
     * blieb eines von sechs liegen. Der Ballen holt die Mitte in EINER Bahn;
     * die beiden aeusseren Teile landen im 15-cm-Streifen zwischen seiner
     * Flanke und der Bordwand, weil die Ecken der Schleppkante gerundet sind
     * und sie dorthin schieben. Ein Versatz nach links und rechts (mehr geht
     * nicht, dann steht er an der Wand) holt eines davon; das letzte bleibt.
     *
     * Das ist eine gemessene Grenze der Form, kein Versehen: Eine Bordwand-Ecke
     * raeumt nur ein Werkzeug mit eckiger Kante leer. Steht als offener Punkt
     * im Bericht zu E-037.
     */
    const BAHNEN = [0, -(BED_HALF_W - BREITE / 2), BED_HALF_W - BREITE / 2];
    const nachBahn: number[] = [];
    for (const bahn of BAHNEN) {
      for (let i = 0; i < 30; i++) setz(bahn, yOben, zStart);
      for (let i = 0; i < 60; i++) setz(bahn, yOben + ((yUnten - yOben) * (i + 1)) / 60, zStart);
      /*
       * Nach hinten zur offenen Seite ziehen — und ueber die Kante hinaus.
       * Wer an der Heckkante aufhoert, schiebt den Schrott nur ans Heck statt
       * herunter.
       */
      const weg = LAENGE + 1.2;
      const schritte = Math.round((weg / 0.7) * 60);
      for (let i = 0; i < schritte; i++) setz(bahn, yUnten, zStart + (weg * (i + 1)) / schritte);
      for (let i = 0; i < 60; i++) physics.step();
      nachBahn.push(runter());
      // wieder anheben und zurueck, ohne dabei etwas mitzunehmen
      for (let i = 0; i < 30; i++) setz(bahn, yOben, zStart + weg);
      for (let i = 0; i < 40; i++) setz(bahn, yOben, zStart + weg - ((weg + 0.2) * (i + 1)) / 40);
    }
    for (let i = 0; i < 120; i++) physics.step();

    // eslint-disable-next-line no-console
    console.log(
      `Ladeflaeche (${(BED_HALF_W * 2).toFixed(2)} m innen, Ballen ${BREITE.toFixed(2)} m): ` +
        nachBahn.map((n, i) => `nach Bahn ${i + 1}: ${n}/${reste.length}`).join(" · ")
    );
    // Der Gewinn: was frueher drei Bahnen brauchte, faellt jetzt in der ersten.
    expect(nachBahn[0], "die erste Bahn raeumt nicht einmal die Mitte").toBeGreaterThanOrEqual(4);
    // Und am Ende nicht schlechter als der Trichter nach drei Bahnen (5 von 6).
    expect(runter(), "schlechter als die alte Form").toBeGreaterThanOrEqual(5);
  });
});

/* ======================================================================== */
/* 4 — Greifen: die Spinne holt ihn vom Boden                                */
/* ======================================================================== */

/**
 * Der Schalenkorb, wie ihn `excavator.ts` (`isInsideGrapple`) rechnet — hier
 * nachgebaut, weil der Bagger sich kopflos nicht bauen laesst.
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
function krallen(body: RAPIER.RigidBody, splay: number, greiferPos: THREE.Vector3): number {
  const col = body.collider(0);
  if (!col) return 0;
  const KONTAKT_NAH = 0.14; // excavator.ts
  let treffer = 0;
  const p = new THREE.Vector3();
  for (let c = 0; c < CLAW_COUNT; c++) {
    const a = (c / CLAW_COUNT) * Math.PI * 2;
    for (const seg of [CLAW_SEGMENTS, Math.round(CLAW_SEGMENTS * 0.6)]) {
      clawPoint(a, splay, seg, p).add(greiferPos);
      const pr = col.projectPoint({ x: p.x, y: p.y, z: p.z }, false);
      if (!pr) continue;
      const d = Math.hypot(pr.point.x - p.x, pr.point.y - p.y, pr.point.z - p.z);
      if (pr.isInside || d <= KONTAKT_NAH) {
        treffer++;
        break;
      }
    }
  }
  return treffer;
}

/** Sensormitte unter dem Spinnenursprung (`excavator.ts`). */
const SENSOR_LOKAL = -(0.55 + 0.2 + 0.75);

describe("Besen: die Spinne bekommt ihn", () => {
  /**
   * So, wie der Spieler es tut: Spinne offen ueber den Ballen, bis zum
   * Bodenanschlag herunter, dann zufahren. Der Arm steigt dabei mit, weil die
   * Schalen im Zufahren tiefer reichen (`clawTipDepth`).
   */
  function zufahren(versatzX = 0): {
    gefasst: number;
    beiClosure: number | null;
    krallenDann: number;
    gehoben: number;
  } {
    const { physics, items } = platz();
    const ballen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, HOEHE / 2 + 0.05, 0),
      new THREE.Quaternion()
    );
    for (let i = 0; i < 90; i++) physics.step();
    const vorher = ballen.body.translation().y;

    const gp = new THREE.Vector3(versatzX, clawTipDepth(CLAW_OPEN_SPLAY), 0);
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(gp.x, gp.y, gp.z)
    );
    const grip = new GripSystem(physics.world, greifer);
    let splay = CLAW_OPEN_SPLAY;
    const lokal = new THREE.Vector3();
    grip.insideGrapple = (welt) => korbTest(splay)(lokal.copy(welt).sub(gp));
    grip.krallenKontakte = (b) => krallen(b, splay, gp);

    let beiClosure: number | null = null;
    let krallenDann = 0;
    for (let i = 0; i <= 48; i++) {
      const closure = Math.min(i / 48, 1);
      splay = THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, closure);
      gp.set(versatzX, clawTipDepth(splay), 0);
      greifer.setNextKinematicTranslation({ x: gp.x, y: gp.y, z: gp.z });
      grip.update(closure, true, new THREE.Vector3(gp.x, gp.y + SENSOR_LOKAL, gp.z), 1 / 60);
      if (grip.grippedCount > 0 && beiClosure === null) {
        beiClosure = closure;
        krallenDann = krallen(ballen.body, splay, gp);
      }
      physics.step();
    }
    // Anheben — was gefasst ist, muss auch mitkommen.
    for (let i = 0; i < 120; i++) {
      const y = clawTipDepth(CLAW_CLOSED_SPLAY) + (3.0 * (i + 1)) / 120;
      gp.set(versatzX, y, 0);
      greifer.setNextKinematicTranslation({ x: gp.x, y, z: gp.z });
      grip.update(1, true, new THREE.Vector3(gp.x, y + SENSOR_LOKAL, gp.z), 1 / 60);
      physics.step();
    }
    return {
      gefasst: grip.grippedCount,
      beiClosure,
      krallenDann,
      gehoben: ballen.body.translation().y - vorher,
    };
  }

  it("passt er ueberhaupt unter die Spinne? Die Zahlen dazu", () => {
    /*
     * Die Frage, an der das Paket haette scheitern koennen. Drei Masse:
     *
     *  - OFFEN spannt die Spinne 3,38 m. Der Ballen ist 2,40 m breit, sie kann
     *    also von oben ueber ihn kommen, ohne anzustossen.
     *  - IM GREIFFENSTER (Schliessgrad 0,60 bis 0,98) ist der Korb hoechstens
     *    1,46 m weit. UMFASSEN kann sie ihn damit NICHT — sie drueckt auf die
     *    Kuppe und haelt ihn mit fuenf Schalen, wie ein Klauenautomat einen
     *    Ball. Genau so ist der Ballen ja entstanden.
     *  - GESCHLOSSEN misst sie aussen 1,30 m — und das ist die Tiefe des
     *    Ballen, kein Zufall (siehe `BESEN`).
     */
    const offen = clawSpan(CLAW_OPEN_SPLAY);
    const beiGriff = clawSpan(THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, CLAW_CLOSED_SPLAY, 0.6));
    const zu = clawWidth(CLAW_CLOSED_SPLAY);
    // eslint-disable-next-line no-console
    console.log(
      `Spinne offen ${offen.toFixed(2)} m · im Greiffenster ${beiGriff.toFixed(2)} m · ` +
        `geschlossen aussen ${zu.toFixed(2)} m · Ballen ${BREITE.toFixed(2)} x ${TIEFE.toFixed(2)} m`
    );
    expect(BREITE, "die offene Spinne kommt nicht mehr ueber ihn").toBeLessThan(offen - 0.5);
    expect(TIEFE, "die Tiefe ist nicht die Spur der geschlossenen Spinne").toBeCloseTo(zu, 1);
  });

  it("wird vom Bodenanschlag aus gefasst und kommt hoch", () => {
    const r = zufahren();
    // eslint-disable-next-line no-console
    console.log(
      `Greifen vom Bodenanschlag: gefasst ab Schliessgrad ${r.beiClosure?.toFixed(2)} ` +
        `mit ${r.krallenDann} Schalen am Ballen, ${r.gehoben.toFixed(2)} m angehoben`
    );
    expect(r.gefasst, "der Ballen wird nicht gefasst").toBe(1);
    expect(r.krallenDann, "er haengt an weniger als zwei Schalen").toBeGreaterThanOrEqual(2);
    expect(r.gehoben, "er kommt nicht mit hoch").toBeGreaterThan(2.0);
  });

  it("Gegenprobe: eineinhalb Ballenbreiten daneben bekommt sie ihn nicht", () => {
    /*
     * Sonst misst der Test oben nur, dass irgendwo ein Koerper liegt. Drei
     * Meter neben der Mitte hat die Spinne weder den Ballen im Korb noch eine
     * Schale an ihm.
     */
    const r = zufahren(3.6);
    // eslint-disable-next-line no-console
    console.log(`Gegenprobe 3,6 m daneben: gefasst ${r.gefasst}`);
    expect(r.gefasst, "drei Meter daneben darf nichts gefasst werden").toBe(0);
  });

  it("er ist tragbar — die Spinne nimmt ihn ans Gelenk", () => {
    /*
     * `MAX_TOTAL_KG` steht in `gripSystem.ts` und ist nicht ausgefuehrt. Statt
     * die Zahl abzuschreiben, wird gefragt: Nimmt die Spinne ihn an? 683 kg
     * sind knapp ein Fuenftel ihrer Traglast.
     */
    const { physics, items } = platz();
    const ballen = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      besenForm(),
      new THREE.Vector3(0, HOEHE / 2 + 0.05, 0),
      new THREE.Quaternion()
    );
    for (let i = 0; i < 30; i++) physics.step();
    const greifer = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0)
    );
    const grip = new GripSystem(physics.world, greifer);
    expect(grip.attachBody(ballen.body), "die Spinne verweigert den Ballen").toBe(true);

    // Gegenprobe: ein Wrack von vier Tonnen wird abgelehnt — die Grenze gibt es.
    const { physics: p2, items: i2 } = platz();
    const brocken = i2.spawnScrap(
      "steel",
      4000,
      { kind: "box", dims: [2, 1, 3], color: 0x808080 },
      new THREE.Vector3(0, 2, 0),
      new THREE.Quaternion()
    );
    const g2 = p2.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 3, 0)
    );
    expect(
      new GripSystem(p2.world, g2).attachBody(brocken.body),
      "Aufbau: vier Tonnen muessten zu schwer sein"
    ).toBe(false);
  });
});

/* ======================================================================== */
/* 5 — Platzinventar: einer, wertlos, kommt wieder                           */
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
      BESEN.name,
    ]);
    expect(items.inventarNachtragen(), "der zweite legt keinen zweiten an").toEqual([]);
    const inventar = items.items.filter((it) => istPlatzinventar(it.shape));
    expect(inventar.length, "es liegt nicht genau ein Besen auf dem Platz").toBe(1);
    expect(inventar[0].shape?.inventar).toBe("besen");
  });

  it("bleibt liegen, wo er hingelegt wird — und kommt dabei zur Ruhe", () => {
    /*
     * BEFUND 15.09.2026, E-037: Der Ballen kam auf dem gebauten Platz nicht
     * zur Ruhe. Er wanderte nur 5 mm in 30 Sekunden, blieb aber WACH — und ein
     * wacher Koerper rechnet in jedem Bild mit. Ursache waren die weichen
     * Kontakte zusammen mit der sehr niedrigen Daempfung, die `dampLin`
     * schweren Koerpern gibt (0,02). Platzinventar bekommt seitdem eine
     * Mindestdaempfung; im gebauten Platz schlaeft der Ballen damit nach
     * 3,4 Sekunden ein (gemessen mit `tools/platzlast.ts`).
     *
     * Hier wird die Eigenschaft geprueft, die der Spieler merkt: Er bleibt
     * liegen. Und die Ursache gleich mit — sonst faellt beim naechsten Umbau
     * nur auf, DASS es klemmt, nicht warum.
     */
    const { physics, items } = platz();
    const besen = items.spawnBesen()!;
    expect(
      besen.body.linearDamping(),
      "Platzinventar bekommt keine Mindestdaempfung"
    ).toBeGreaterThan(dampLin(BESEN.massKg));
    expect(besen.body.angularDamping(), "dasselbe fuer die Drehung").toBeGreaterThan(
      dampAng(BESEN.massKg)
    );

    // Gegenprobe: dasselbe Stueck OHNE die Inventarmarke behaelt die niedrige
    // Daempfung — „Schweres behaelt seinen Schwung" gilt weiter fuer Ware.
    const ware = items.spawnScrap(
      BESEN.materialId,
      BESEN.massKg,
      { ...besenForm(), inventar: undefined },
      new THREE.Vector3(12, 2, 12),
      new THREE.Quaternion()
    );
    expect(ware.body.linearDamping(), "Aufbau: Ware wird auch gebremst").toBeCloseTo(
      dampLin(BESEN.massKg),
      6
    );

    // Erst aufsetzen und einschlafen lassen: Das Rutschen beim Aufkommen aus
    // 5 cm Hoehe ist kein Wandern. Im gebauten Platz dauert es 3,4 s.
    let einschlafen = -1;
    for (let i = 0; i < 1800 && einschlafen < 0; i++) {
      physics.step();
      if (besen.body.isSleeping()) einschlafen = i;
    }
    // eslint-disable-next-line no-console
    console.log(`eingeschlafen nach ${(einschlafen / 60).toFixed(1)} s`);
    expect(einschlafen, "er schlaeft in dreissig Sekunden nicht ein").toBeGreaterThanOrEqual(0);
    const p0 = besen.body.translation();
    const start = { x: p0.x, z: p0.z };
    for (let i = 0; i < 1800; i++) physics.step(); // 30 Sekunden Spielzeit
    const p1 = besen.body.translation();
    const v = besen.body.linvel();
    const gewandert = Math.hypot(p1.x - start.x, p1.z - start.z);
    // eslint-disable-next-line no-console
    console.log(
      `nach 30 s: ${gewandert * 1000 >= 1 ? (gewandert * 100).toFixed(1) + " cm" : "unter 1 mm"} ` +
        `gewandert, v ${Math.hypot(v.x, v.y, v.z).toFixed(4)} m/s, schlaeft ${besen.body.isSleeping()}`
    );
    expect(gewandert, "er wandert vom Fleck").toBeLessThan(0.005);
    expect(besen.body.isSleeping(), "er kommt nicht zur Ruhe").toBe(true);
    expect(Math.hypot(v.x, v.y, v.z), "er zappelt noch").toBeLessThan(1e-6);
  });

  it("liegt in seiner Gebrauchslage, nicht auf der Flanke", () => {
    /*
     * Seit E-037 ist die Bauform schon die Liegelage: unten platt, oben rund.
     * Der Trichter musste noch gekippt werden. Gemessen wird am Ergebnis —
     * nach dem Hinlegen darf er sich nicht mehr umlegen.
     */
    const { physics, items } = platz();
    const besen = items.spawnBesen()!;
    const y0 = besen.body.translation().y;
    for (let i = 0; i < 240; i++) physics.step();
    const rot = besen.body.rotation();
    const hoch = new THREE.Vector3(0, 1, 0).applyQuaternion(
      new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
    );
    // eslint-disable-next-line no-console
    console.log(
      `nach 4 s: y ${besen.body.translation().y.toFixed(3)} (gesetzt ${y0.toFixed(3)}), ` +
        `Neigung ${((Math.acos(Math.min(1, hoch.y)) * 180) / Math.PI).toFixed(1)} Grad`
    );
    expect(hoch.y, "er ist umgekippt").toBeGreaterThan(0.97);
    expect(besen.body.translation().y, "er ist eingesunken").toBeGreaterThan(HOEHE / 2 - 0.06);
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
      new THREE.Vector3(9, 2, 9)
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
      `Verkauf ohne Besen ${a.eur.toFixed(2)} EUR / ${a.massKg} kg · ` +
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
/* 6 — Sein Fleck auf dem Hof                                                */
/* ======================================================================== */

/** Abstand eines Punktes zum Rand eines achsparallelen Rechtecks (negativ = drin). */
function zuRechteck(
  x: number,
  z: number,
  cx: number,
  cz: number,
  sx: number,
  sz: number
): number {
  const dx = Math.abs(x - cx) - sx / 2;
  const dz = Math.abs(z - cz) - sz / 2;
  return dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}

/**
 * Wie viel Luft hat ein Fleck? Alles, was ihn verbieten wuerde, in EINER
 * Rechnung — damit der Waechter dieselbe Suche fahren kann wie der Bau.
 */
function luftAm(x: number, z: number): { frei: number; grund: string } {
  let frei = Infinity;
  let grund = "";
  const merke = (ab: number, was: string): void => {
    if (ab < frei) {
      frei = ab;
      grund = was;
    }
  };
  for (const c of CONFIGS) merke(zuRechteck(x, z, c.x, c.z, c.size[0], c.size[1]), c.label);
  merke(
    zuRechteck(
      x,
      z,
      PRESS_CENTER.x,
      PRESS_CENTER.z,
      PRESS_INNER.laenge + 0.7,
      PRESS_INNER.tiefe + 0.7
    ),
    "Presskammer"
  );
  merke(Math.hypot(x - START_HAUFEN.x, z - START_HAUFEN.z) - START_HAUFEN.streuung, "Starthaufen");
  merke(Math.hypot(x - START_STREU.x, z - START_STREU.z) - START_STREU.radius, "Streuschrott");
  for (const a of START_AUTOS) merke(Math.hypot(x - a.x, z - a.z) - 2.5, "Altfahrzeug");
  merke(Math.hypot(x - ABKIPP_ZONE[0], z - ABKIPP_ZONE[1]) - 3.0, "Abkippstelle");
  merke(
    zuRechteck(x, z, ABLADE_SPUR_X, ABLADE_HALT_Z, 3.0, BED_LEN.kipper! + 3.0),
    "Abladespur"
  );
  return { frei, grund };
}

describe("Besen: wo er liegt", () => {
  /** Der Umkreis des Ballen — im schlimmsten Fall steht er verdreht. */
  const UMKREIS = Math.hypot(BREITE / 2, TIEFE / 2);
  const d = abstandVomStand(BESEN_PLATZ.x, BESEN_PLATZ.z);

  it("liegt im Schwenkband des Baggers", () => {
    // eslint-disable-next-line no-console
    console.log(
      `Besenplatz (${BESEN_PLATZ.x} | ${BESEN_PLATZ.z}) — ${d.toFixed(2)} m vom Sitz ` +
        `(${BAGGER_STAND.x} | ${BAGGER_STAND.z}), Umkreis ${UMKREIS.toFixed(2)} m`
    );
    expect(d, "zu nah am Sitz").toBeGreaterThanOrEqual(SCHWENK_INNEN);
    expect(d, "ausser Reichweite").toBeLessThanOrEqual(SCHWENK_AUSSEN);
  });

  it("hat rundum Luft — Mulden, Halden, Presse, Haufen, Fahrspur", () => {
    const { frei, grund } = luftAm(BESEN_PLATZ.x, BESEN_PLATZ.z);
    // eslint-disable-next-line no-console
    console.log(`naechstes Hindernis: ${grund}, ${frei.toFixed(2)} m entfernt`);
    expect(frei, `zu nah an ${grund}`).toBeGreaterThan(UMKREIS + 0.5);
    expect(hitsObstacle(BESEN_PLATZ.x, BESEN_PLATZ.z, UMKREIS), "er steckt in einem Bauwerk").toBe(
      null
    );
  });

  it("liegt nicht dort, wo der Kipper abkippt — und der alte Fleck tat es", () => {
    /*
     * DER BEFUND DES ABENDS. Seit E-029 kippt der Selbstabkipper am
     * Abladeplatz ab; die Fuhre landet auf `ABKIPP_ZONE`. Der alte Besenplatz
     * (5,0 | −27,0) lag 1,64 m daneben — das Werkzeug waere unter der naechsten
     * Fuhre verschwunden. Der Waechter von heute vormittag hat die
     * Abkippstelle nicht geprueft; dieser tut es, und die Gegenprobe zeigt,
     * dass er es merkt.
     */
    const neu = Math.hypot(
      BESEN_PLATZ.x - ABKIPP_ZONE[0],
      BESEN_PLATZ.z - ABKIPP_ZONE[1]
    );
    const alt = Math.hypot(5.0 - ABKIPP_ZONE[0], -27.0 - ABKIPP_ZONE[1]);
    // eslint-disable-next-line no-console
    console.log(
      `Abkippstelle (${ABKIPP_ZONE[0]} | ${ABKIPP_ZONE[1]}): neuer Fleck ${neu.toFixed(2)} m, ` +
        `alter Fleck ${alt.toFixed(2)} m`
    );
    expect(neu, "er liegt wieder unter der Abkippstelle").toBeGreaterThan(4.0);
    expect(alt, "Aufbau: der alte Fleck lag nicht an der Abkippstelle").toBeLessThan(2.0);
  });

  it("liegt in einer Arbeitszone — sonst huepen die Fahrer davor", () => {
    /*
     * Neu wichtig, weil der Ballen 683 kg wiegt: Ab `BLOCKING_MASS_KG`
     * (120 kg) gilt ein liegendes Teil als Hindernis, ausser es liegt in einer
     * Arbeitszone (`routes.ts`, `WORK_ZONES`). Beim 52-kg-Besen war das egal.
     */
    expect(BESEN.massKg, "unter der Blockadegrenze — dann ist dieser Test unnoetig").toBeGreaterThan(
      BLOCKING_MASS_KG
    );
    const zone = WORK_ZONES.find(
      ([wx, wz, wr]) => Math.hypot(BESEN_PLATZ.x - wx, BESEN_PLATZ.z - wz) <= wr
    );
    // eslint-disable-next-line no-console
    console.log(
      `Arbeitszone: ${zone ? `(${zone[0]} | ${zone[1]}) r ${zone[2]}` : "KEINE"} bei ${BESEN.massKg} kg`
    );
    expect(zone, "der Ballen liegt ausserhalb jeder Arbeitszone").toBeDefined();
  });

  it("und es gibt ueberhaupt keinen besseren Fleck — die Suche als Waechter", () => {
    /*
     * Der Fleck ist gesucht, nicht gegriffen: Das Schwenkband wird in
     * 0,25-m-Schritten abgesucht, jeder Punkt gegen alles gerechnet, was ihn
     * verbietet. Uebrig bleibt nur der Vorplatz — und dort liegt er.
     */
    const frei: Array<{ x: number; z: number; luft: number }> = [];
    for (let x = -14; x <= 14; x += 0.25) {
      for (let z = -34; z <= -8; z += 0.25) {
        const ab = abstandVomStand(x, z);
        if (ab < SCHWENK_INNEN || ab > SCHWENK_AUSSEN) continue;
        if (hitsObstacle(x, z, UMKREIS)) continue;
        const { frei: luft } = luftAm(x, z);
        if (luft > UMKREIS + 0.5) frei.push({ x, z, luft });
      }
    }
    const xs = frei.map((f) => f.x);
    const zs = frei.map((f) => f.z);
    // eslint-disable-next-line no-console
    console.log(
      `${frei.length} freie Punkte, alle zwischen x ${Math.min(...xs).toFixed(2)} und ` +
        `${Math.max(...xs).toFixed(2)}, z ${Math.min(...zs).toFixed(2)} und ${Math.max(...zs).toFixed(2)}`
    );
    expect(frei.length, "es gibt gar keinen freien Fleck mehr").toBeGreaterThan(20);
    // Der gewaehlte Punkt ist einer davon.
    expect(
      frei.some(
        (f) => Math.abs(f.x - BESEN_PLATZ.x) < 0.13 && Math.abs(f.z - BESEN_PLATZ.z) < 0.13
      ),
      "der Besenplatz kommt in der eigenen Suche nicht vor"
    ).toBe(true);
    // Und der alte Fleck ist keiner mehr — die Gegenprobe zur Suche.
    expect(
      frei.some((f) => Math.abs(f.x - 5.0) < 0.13 && Math.abs(f.z + 27.0) < 0.13),
      "Aufbau: der alte Fleck muesste durchgefallen sein"
    ).toBe(false);
  });

  it("die Form beschreibt einen Ballen, keinen Trichter — die Tabelle sagt es", () => {
    /*
     * `BESEN_FORM` ist die Tabelle, aus der die Form entsteht. Wer an ihr
     * dreht, soll hier merken, ob er die Geschichte noch erzaehlt: unten am
     * breitesten (Exponenten so, dass `f(0) = 1`), unten eckig und oben rund,
     * und mit Dellen.
     */
    const f = (v: number): number =>
      Math.max(Math.pow(Math.max(1 - Math.pow(v, BESEN_FORM.steil), 0), BESEN_FORM.rund), BESEN_FORM.kuppe);
    expect(f(0), "unten nicht die volle Breite").toBeCloseTo(1, 6);
    expect(f(0.3), "die Flanke faellt zu schnell ein").toBeGreaterThan(0.94);
    expect(f(1), "oben laeuft er nicht zu").toBeCloseTo(BESEN_FORM.kuppe, 6);
    expect(BESEN_FORM.pUnten, "unten muss die Flanke gerade sein").toBeGreaterThanOrEqual(4);
    expect(BESEN_FORM.pOben, "oben muss es rund werden").toBeLessThan(2.5);
    expect(BESEN_FORM.dellen.length, "ohne Dellen waere es sauber").toBeGreaterThanOrEqual(3);
  });
});
