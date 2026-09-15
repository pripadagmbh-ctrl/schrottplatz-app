/**
 * Waechter fuer E-064: Der Abholer wiegt leer rein und voll raus.
 *
 * Ansage Patrick am Geraet, 15.09.2026: „ausserdem muss auch abholer leer
 * wiegen." Bis dahin fuhr er an der Bruecke vorbei — im Quelltext stand es
 * ausdruecklich so da: „der Abholer kommt leer und faehrt durch".
 *
 * So laeuft es auf dem Platz: leer herein (Tara), voll hinaus (Brutto), die
 * Differenz ist, was er mitnimmt. Geprueft wird deshalb nicht eine Zahl,
 * sondern die Rechnung — und dass sie den Kreislauf NICHT anfasst: Der
 * Abholer verhandelt nicht, und die Wiegung zahlt nichts aus.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { WEIGH_X } from "../src/world/yard";
import { WAAGE_HALT } from "../src/delivery/routes";

beforeAll(async () => {
  await initPhysics();
});

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
}

function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(
    scene,
    world,
    items,
    new CompositeManager(scene, world, items, new EventBus())
  );
  return { m, items, world };
}

/** Ein Takt des ganzen Platzes — Fahrzeuge, Bremsen, Physik. */
function takt(p: Platz, dt = 1 / 60): void {
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
}

/** Eine einfache Kiste — Form fuer Pruefladung, die sonst nichts kann. */
function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

describe("Der Abholer haelt auf der Waage und wiegt leer", () => {
  it("meldet seine Tara, waehrend er auf der Bruecke steht", () => {
    const p = bauePlatz();
    let tara: number | null = null;
    let wo: [number, number] | null = null;
    let phaseDabei = "";
    p.m.onAbholerTara = (kg) => {
      tara = kg;
      const t = p.m.pickupTruck!;
      wo = [t.group.position.x, t.group.position.z];
      phaseDabei = t.phaseName;
    };
    p.m.requestPickup("alu");
    for (let i = 0; i < 60 * 120 && tara === null; i++) takt(p);

    expect(tara, "der Abholer hat nie gewogen").not.toBeNull();
    // Leer heisst leer: Auf der Flaeche liegt nichts, gewogen wird der
    // Container. Also eine Tara groesser null, aber weit unter einer Fuhre.
    expect(tara!).toBeGreaterThan(0);
    expect(tara!, "eine leere Tara waere keine").toBeLessThan(3000);
    expect(phaseDabei, "er wiegt nicht in der Wiegephase").toBe("weighIn");
    // Und er steht dabei wirklich auf der Waage, nicht irgendwo am Tor.
    expect(wo, "keine Lage aufgezeichnet").not.toBeNull();
    expect(Math.abs(wo![0] - WEIGH_X), "steht nicht in der Waagenspur").toBeLessThan(0.5);
    expect(Math.abs(wo![1] - WAAGE_HALT[1]), "steht nicht auf der Bruecke").toBeLessThan(0.5);
  });

  it("und wird dabei NICHT in eine Preisverhandlung geschickt", () => {
    /*
     * `onWeighIn` setzt in `main.ts` `dealPending` und oeffnet das
     * Verhandlungsfenster. Ueber einen leeren Wagen wird nicht gefeilscht —
     * und ein Fahrer, der auf eine Antwort wartet, die nie kommt, steht 32
     * Sekunden auf der Bruecke, bevor die Notbremse greift.
     */
    const p = bauePlatz();
    let verhandelt = 0;
    let ausgezahlt = 0;
    let tara: number | null = null;
    p.m.onWeighIn = () => verhandelt++;
    p.m.onWeighOut = () => ausgezahlt++;
    p.m.onAbholerTara = (kg) => (tara = kg);
    p.m.requestPickup(null);
    for (let i = 0; i < 60 * 120 && tara === null; i++) takt(p);
    expect(tara).not.toBeNull();
    expect(verhandelt, "der leere Abholer wurde an den Verhandlungstisch geschickt").toBe(0);
    expect(ausgezahlt, "fuer den leeren Abholer wurde Geld bewegt").toBe(0);
    /*
     * Und er bleibt nicht auf der Waage kleben. Die Wiegung ist ein kurzer
     * Halt: Im selben Takt, in dem die Tara feststeht, faehrt er weiter — der
     * Anlieferer wartet an dieser Stelle auf den Preis, der Abholer nicht.
     */
    expect(p.m.pickupTruck!.phaseName, "wartet auf eine Antwort, die nie kommt").not.toBe(
      "weighIn"
    );
    for (let i = 0; i < 60 * 10; i++) takt(p);
    expect(p.m.pickupTruck!.phaseName, "steht immer noch an der Waage").toBe("approach");
  });
});

describe("Und beim Hinausfahren steht fest, was er mitnimmt", () => {
  it("Brutto minus Tara ist genau die aufgeladene Masse", () => {
    const p = bauePlatz();
    let tara: number | null = null;
    let wiegung: { tara: number; brutto: number } | null = null;
    p.m.onAbholerTara = (kg) => (tara = kg);
    p.m.onAbholerBrutto = (t, b) => (wiegung = { tara: t, brutto: b });
    p.m.requestPickup("steel");
    // Hin fahren, bis er auf Ladung wartet.
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    const wagen = p.m.pickupTruck!;
    expect(wagen.waitingForLoad, "der Abholer ist nie an seinem Platz angekommen").toBe(true);
    expect(tara, "keine Tara gewogen").not.toBeNull();

    /*
     * Ladung wird nicht von Hand erdacht, sondern hineingelegt: drei Teile
     * mit bekannten Massen, die der Wagen wirklich traegt. Was auf der
     * Flaeche landet, sagt danach `ladeflaecheKg()` — und die Differenz der
     * beiden Wiegungen muss dasselbe sein.
     */
    const massen = [120, 240, 95];
    for (const [i, kg] of massen.entries()) {
      p.items.spawnScrap(
        "steel",
        kg,
        kiste(),
        new THREE.Vector3(
          wagen.group.position.x,
          1.6,
          wagen.group.position.z - 1.2 + i * 1.2
        ),
        new THREE.Quaternion()
      );
    }
    // Absetzen lassen, damit sie wirklich auf der Flaeche liegen.
    for (let i = 0; i < 60 * 3; i++) takt(p);
    const aufDerFlaeche = wagen.ladeflaecheKg();
    expect(aufDerFlaeche, "die Pruefladung ist nicht auf der Flaeche gelandet").toBeGreaterThan(
      0
    );

    p.m.requestPickup();
    for (let i = 0; i < 60 * 300 && wiegung === null; i++) takt(p);
    expect(wiegung, "der volle Abholer wurde nie gewogen").not.toBeNull();
    expect(wiegung!.tara, "die Tara der Einfahrt gilt nicht mehr").toBeCloseTo(tara!, 6);
    expect(
      wiegung!.brutto - wiegung!.tara,
      `brutto ${wiegung!.brutto.toFixed(0)} − tara ${wiegung!.tara.toFixed(0)}`
    ).toBeCloseTo(aufDerFlaeche, 1);
    // Und die Differenz ist tatsaechlich die Fuhre, nicht null.
    expect(wiegung!.brutto - wiegung!.tara).toBeGreaterThan(50);
  });

  it("und ein leer wieder hinausfahrender Abholer meldet 0 kg abgeholt", () => {
    /*
     * DIE GEGENPROBE ZUR RECHNUNG OBEN, mit demselben Weg und ohne Ladung:
     * Wer nichts aufgeladen bekommt, nimmt nichts mit. Kaeme hier eine Zahl
     * ungleich null heraus, waere die Differenz oben nicht die Fuhre, sondern
     * ein Messfehler des Wiegens.
     */
    const p = bauePlatz();
    let wiegung: { tara: number; brutto: number } | null = null;
    p.m.onAbholerBrutto = (t, b) => (wiegung = { tara: t, brutto: b });
    p.m.requestPickup("steel");
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    expect(p.m.pickupTruck?.waitingForLoad).toBe(true);
    p.m.requestPickup();
    for (let i = 0; i < 60 * 300 && wiegung === null; i++) takt(p);
    expect(wiegung, "der leere Abholer wurde nie gewogen").not.toBeNull();
    expect(wiegung!.brutto - wiegung!.tara).toBeCloseTo(0, 6);
  });
});
