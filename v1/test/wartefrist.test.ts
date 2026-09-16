import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { Account } from "../src/economy/account";
import { ANLIEFERER_SPRUECHE } from "../src/delivery/customers";

/*
 * DER ANLIEFERER OHNE FRIST (E-082).
 *
 * Befund aus dem kopflosen Lauf zu E-070: Eine Pritsche, die niemand
 * abgeladen hat, stand ZEHN MINUTEN in `waitUnload` — und hielt dabei eine
 * vorgemerkte Abholung auf, denn der Platz ist einspurig (E-029). Auf freiem
 * Hof steht der naechste Wagen 34,4 s nach der Abfahrt vor der Waage; Stille
 * danach ist nie normal.
 *
 * Geprueft wird hier nicht die Zahl 240, sondern die EIGENSCHAFT, die daran
 * haengt — und sie hat zwei Haelften, die auseinanderlaufen koennen:
 *
 *   1. Er faehrt ueberhaupt. (Sonst steht der Hof.)
 *   2. Er faehrt MIT SEINER LADUNG, und bezahlt wird nichts.
 *      (Sonst waere die Frist ein Geschenkautomat: vier Minuten warten, eine
 *      ganze Fuhre umsonst.)
 *
 * Die zweite Haelfte ist die, die man erst Wochen spaeter merkt. `despawn()`
 * stellt Reste, die noch auf der Flaeche liegen, ABSICHTLICH neben dem Wagen
 * ab — fuer den Fall „hat abgeladen, ein Blech klemmt noch" ist das richtig.
 * Fuer den Fall „hat gar nicht abgeladen" ist es geschenkter Schrott.
 */

beforeAll(async () => {
  await initPhysics();
});

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  account: Account;
  composites: CompositeManager;
  funk: Array<{ wer: string; spruch: string }>;
  netto: number[];
}

function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  const p: Platz = {
    m,
    items,
    world,
    scene,
    composites,
    account: new Account(),
    funk: [],
    netto: [],
  };
  // Die Verdrahtung aus `main.ts`, nicht nacherzaehlt, sondern benutzt.
  m.onPickupFunk = (wer, spruch) => p.funk.push({ wer, spruch });
  m.onWeighOut = (netKg) => {
    p.netto.push(netKg);
    p.account.payDelivery(netKg, 1);
  };
  return p;
}

function takt(p: Platz, dt = 1 / 60): void {
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
  p.scene.updateMatrixWorld(true);
}

/** Bis der Wagen vom Hof ist (oder die Geduld des Waechters am Ende). */
function fahreBisLeer(p: Platz, maxSekunden = 900): number {
  const schritte = Math.round(maxSekunden * 60);
  for (let i = 0; i < schritte; i++) {
    takt(p);
    // Ein neuer Wagen darf nicht dazwischenfunken — geprueft wird dieser hier.
    p.m.acceptDeliveries = false;
    if (p.netto.length > 0) return i / 60;
  }
  return Infinity;
}

describe("Ein Anlieferer, den niemand ablaedt, faehrt irgendwann", () => {
  it("er steht nicht ewig — und er sagt vorher Bescheid", () => {
    const p = bauePlatz();
    let brutto = 0;
    p.m.onWeighIn = (kg) => (brutto = kg);
    p.m.spawnNow("pritsche");
    const gebracht = p.m.deliveries;
    expect(gebracht, "es ist gar kein Anlieferer gekommen").toBe(1);
    const geldVor = p.account.moneyEur;

    const sekunden = fahreBisLeer(p);

    /*
     * DIE OBERGRENZE. Sie ist absichtlich grosszuegig gegen alles, was der
     * Wagen ausser Warten noch tut (Einfahrt, Wiegen, Rangieren): geprueft
     * wird, dass die Frist GREIFT, nicht auf welche Sekunde.
     */
    expect(sekunden, "der Wagen ist nie ausgefahren — die Frist greift nicht").toBeLessThan(600);
    /*
     * UND DIE UNTERGRENZE — sonst waere ein Wagen, der sofort wieder
     * umdreht, ebenfalls gruen. Vier Minuten Standzeit muessen drin sein,
     * sonst wird der Spieler gehetzt.
     */
    expect(sekunden, "er faehrt viel zu frueh wieder ab").toBeGreaterThan(240);
    expect(brutto, "der Wagen kam leer — so prueft das hier nichts").toBeGreaterThan(200);

    // Er ist nicht klammheimlich verschwunden.
    const sprueche = p.funk.map((f) => f.spruch);
    expect(sprueche.length, "er faehrt wortlos").toBeGreaterThanOrEqual(2);
    expect(
      sprueche.some((s) => ANLIEFERER_SPRUECHE.wartetLange.includes(s)),
      "es kam keine Mahnung vor der Abfahrt"
    ).toBe(true);
    expect(
      sprueche.some((s) => ANLIEFERER_SPRUECHE.faehrtUnverrichtet.includes(s)),
      "er sagt beim Losfahren nichts"
    ).toBe(true);
    // Und mit dem Namen des Kunden, nicht mit dem des Abholfahrers.
    expect(p.funk[0].wer, "es spricht niemand").toBeTruthy();
    expect(p.funk[0].wer, "Achim spricht fuer den Anlieferer").not.toBe("Achim");

    /*
     * BEZAHLT WIRD NUR, WAS ABGELADEN WURDE — und abgeladen ist, was auf dem
     * Hof liegt. Das ist bei einer unangetasteten Fuhre fast nichts: Die
     * Ausfahrtswiegung rechnet brutto minus dem, was noch oben liegt.
     *
     * „Fast" und nicht „gar", weil die Bordwaende waehrend der Standzeit
     * offen haengen — in vier Minuten kann von selbst ein Stueck
     * herunterrutschen. Das IST dann abgeladen, es liegt ja da. Deshalb
     * prueft der Waechter die Eigenschaft und nicht die Null (gemessen
     * 16.09.2026: je nach Fuhre 0 bis 56 kg).
     */
    expect(
      p.netto[0],
      "es wurde bezahlt, als waere die Fuhre abgeladen worden"
    ).toBeLessThan(brutto * 0.25);
    expect(p.account.moneyEur, "mehr bezahlt als der Marktpreis fuers Liegengebliebene")
      .toBeGreaterThan(geldVor - p.netto[0] * 0.2 - 0.01);
  });

  it("was auf dem Hof bleibt, ist genau das, was bezahlt wurde", () => {
    /*
     * DIE EIGENTLICHE REGEL, in einem Satz, den man einem Spieler sagen kann.
     *
     * Sie hat zwei Seiten, und beide gehen schief, wenn man nur eine baut:
     *   - Bliebe die ganze Fuhre am Tor liegen, waere sie geschenkt (Netto
     *     null an der Waage, Schrott trotzdem da). Vier Minuten warten haette
     *     sich mehr gelohnt als jede Arbeit.
     *   - Wuerde umgekehrt ALLES mitgenommen, verschwaende auch das Stueck,
     *     das waehrend der Standzeit von selbst heruntergerutscht ist — und
     *     das ist an der Waage bereits bezahlt worden.
     */
    const p = bauePlatz();
    let brutto = 0;
    p.m.onWeighIn = (kg) => (brutto = kg);
    p.m.spawnNow("pritsche");
    for (let i = 0; i < 60 * 3; i++) takt(p);
    expect(p.items.items.length, "der Wagen kam leer — so prueft das hier nichts")
      .toBeGreaterThan(0);

    const sekunden = fahreBisLeer(p);
    expect(sekunden).toBeLessThan(600);
    // Noch ein Stueck weiter, bis er das Tor durch und abgeraeumt ist.
    for (let i = 0; i < 60 * 90; i++) {
      takt(p);
      p.m.acceptDeliveries = false;
    }

    const aufDemHof = p.items.items.reduce((a, it) => a + it.massKg, 0);
    expect(aufDemHof, "bezahlt und liegengeblieben gehen auseinander").toBeCloseTo(
      p.netto[0],
      0
    );
    expect(
      aufDemHof,
      "die Fuhre liegt geschenkt auf dem Hof — vier Minuten warten, alles umsonst"
    ).toBeLessThan(brutto * 0.25);
  });

  it("wer abgeladen HAT, wird weiter bezahlt — die Frist aendert daran nichts", () => {
    /*
     * GEGENPROBE zur Regel oben. Ohne sie koennte die Frist einfach jede
     * Anlieferung auf null Euro setzen und der Waechter waere gruen.
     *
     * Abgeladen wird hier so, wie es der Spieler mit der Spinne taete: Die
     * Fuhre wird von der Flaeche genommen, sobald sie freigegeben ist.
     */
    const p = bauePlatz();
    let gewogen = false;
    p.m.onWeighIn = () => (gewogen = true);
    p.m.spawnNow("pritsche");
    for (let i = 0; i < 60 * 900 && p.netto.length === 0; i++) {
      takt(p);
      p.m.acceptDeliveries = false;
      /*
       * Erst NACH der Bruttowiegung abladen — vorher waere es keine
       * Anlieferung, sondern ein Taschenspielertrick, und die Waage haette
       * nichts zu wiegen. (Genau daran ist dieser Waechter beim ersten Lauf
       * gescheitert: Er nahm die Fuhre schon herunter, waehrend sie sich am
       * Tor noch setzte.)
       */
      if (!gewogen) continue;
      // Sobald die Ladung dynamisch auf der Flaeche liegt: herunternehmen.
      for (const it of [...p.items.items]) {
        const t = it.body.translation();
        if (t.y > 0.9 && it.body.isDynamic()) {
          it.body.setTranslation({ x: t.x + 14, y: 0.4, z: t.z }, true);
          it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
    }
    expect(p.netto.length, "der Wagen ist nie ueber die Ausfahrtswaage").toBe(1);
    expect(p.netto[0], "abgeladenes Material wurde nicht gewogen").toBeGreaterThan(50);
    expect(p.account.moneyEur, "abgeladenes Material wurde nicht bezahlt").toBeLessThan(5000);
    // Und der Schrott liegt auf dem Hof, nicht im Nichts.
    expect(p.items.items.length, "der abgeladene Schrott ist verschwunden").toBeGreaterThan(0);
  });
});
