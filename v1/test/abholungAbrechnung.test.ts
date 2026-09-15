/**
 * Wächter für die GANZE Abholung: Teile drauf, Wagen weg, Geld da.
 *
 * Anlass — Patrick am Gerät, 15.09.2026: „Also ich habe gerade einen Abholer
 * kommen lassen mit Stahlschrott, der ist auch abgefahren, aber es hat sich
 * weder am Kontostand noch was geändert … und es stand auch 0 Tonnen
 * umgeschlagen."
 *
 * Verkauf und Umschlagszähler hängen an genau einer Stelle (`onPickupDepart`
 * in `main.ts` → `DeliveryVehicle.containedItems` → `Account.sellContainer`),
 * und bis heute gab es DREI verschiedene Antworten auf die Frage, was auf der
 * Ladefläche liegt:
 *
 *   `verriegeleLadeflaeche()`  |x| < 1,70   z −0,40 … L+0,40   y −0,40 … 3,00
 *   `ladeflaecheKg()`          |x| < 1,85   z −0,50 … L+0,50   y −0,40 … 5,00
 *   `containedItems()`         |x| < 1,60   z −0,30 … L+0,30   y −0,40 … 2,60
 *
 * Ein Blech auf der Bordwandkante fuhr damit mit, wurde an der Ausfahrt
 * gewogen und war beim Verkauf nicht dabei — es verließ den Hof, ohne bezahlt
 * zu werden. Geprüft wird deshalb die Eigenschaft und nicht die Zahl: WAS
 * MITFÄHRT, WIRD GEWOGEN UND BEZAHLT.
 *
 * Zu jeder Zahlenschranke gehört hier eine Gegenprobe: Eine absichtlich falsch
 * gezählte Ladefläche MUSS auffallen, sonst prüft der Wächter nichts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, type ScrapItem, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { Account } from "../src/economy/account";
import { Shift } from "../src/economy/shift";
import { getMaterial } from "../src/materials/catalog";
import { BED_HALF_W } from "../src/delivery/routes";

/**
 * Der Fahrzeugtyp, ohne ihn auszufuehren.
 *
 * Die Klasse `DeliveryVehicle` ist in `vehicles.ts` absichtlich nicht
 * exportiert — von aussen geht alles ueber den Fuhrpark. Gebraucht wird hier
 * nur ihr TYP, und den gibt `VehicleManager.pickupTruck` heraus. So bleibt die
 * Modulgrenze, wie sie ist.
 */
type Abholer = NonNullable<VehicleManager["pickupTruck"]>;

beforeAll(async () => {
  await initPhysics();
});

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  account: Account;
  shift: Shift;
  composites: CompositeManager;
}

function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  return { m, items, world, scene, account: new Account(), shift: new Shift(), composites };
}

/**
 * Ein Takt des ganzen Platzes.
 *
 * `scene.updateMatrixWorld()` gehört dazu: Im Spiel besorgt das der Renderer
 * jedes Bild, im Test niemand — ohne die Zeile rechnete jede Umrechnung
 * „Welt → Ladefläche" mit der Lage von vorgestern.
 */
function takt(p: Platz, dt = 1 / 60): void {
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
  p.scene.updateMatrixWorld(true);
}

function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

function summe(items: Array<{ massKg: number }>): number {
  return items.reduce((a, it) => a + it.massKg, 0);
}

/** Abholer für `order` rufen und fahren lassen, bis er auf Ladung wartet. */
function holeAbholer(p: Platz, order: string | null): Abholer {
  p.m.requestPickup(order);
  for (let i = 0; i < 60 * 400 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
  const t = p.m.pickupTruck;
  expect(t?.waitingForLoad, "der Abholer ist nie an seinem Platz angekommen").toBe(true);
  return t!;
}

/**
 * Die Verdrahtung aus `main.ts` (Zeile 924 ff.), Zeile für Zeile.
 *
 * Der Wächter darf sie nicht nacherzählen, sondern muss sie benutzen: Eine
 * abgeschriebene Fassung wäre grün, während im Spiel das Gegenteil passiert.
 */
interface Abrechnung {
  kg: number;
  eur: number;
  meldung: string;
}
function verdrahte(p: Platz, ablage: { letzte: Abrechnung | null }): void {
  p.m.onPickupDepart = (truck) => {
    const loaded = truck.containedItems(p.items);
    const sale = p.account.sellContainer(loaded, p.items, p.composites, p.m.pickupOrder);
    if (sale.massKg > 0) {
      p.shift.noteTurnover(sale.massKg);
      ablage.letzte = {
        kg: sale.massKg,
        eur: sale.eur,
        meldung:
          `Verkauft: ${sale.massKg.toFixed(0)} kg ${getMaterial(sale.dominant).name} · ` +
          `${(sale.purity * 100).toFixed(0)} % sortenrein · +${sale.eur.toFixed(0)} €`,
      };
    } else {
      ablage.letzte = {
        kg: 0,
        eur: sale.eur,
        meldung: "Container war leer — der LKW fährt umsonst.",
      };
    }
  };
}

/** Stahl in die Mulde fallen lassen — über die Physik, nicht per Zuweisung. */
function ladeAuf(p: Platz, truck: Abholer, massen: number[]): ScrapItem[] {
  const innen = truck as unknown as { bedGroup: THREE.Group; bedLen: number };
  const drauf: ScrapItem[] = [];
  for (const [i, kg] of massen.entries()) {
    const wo = innen.bedGroup.localToWorld(
      new THREE.Vector3(0, 1.2, innen.bedLen * (0.25 + 0.5 * (i / Math.max(massen.length - 1, 1))))
    );
    drauf.push(p.items.spawnScrap("steel", kg, kiste(), wo, new THREE.Quaternion()));
    for (let s = 0; s < 45; s++) takt(p);
  }
  for (let s = 0; s < 120; s++) takt(p);
  return drauf;
}

describe("Eine ganze Abholung — und was danach auf dem Konto steht", () => {
  it("Nullprobe: ein leerer Abholer bringt 0 kg, 0 € und sagt es", () => {
    /*
     * DER FALL MIT FESTSTEHENDEM ERGEBNIS. Er muss zuerst stimmen: Solange
     * eine leere Mulde nicht zuverlässig 0 ergibt, ist jede andere Zahl aus
     * demselben Weg wertlos.
     */
    const p = bauePlatz();
    const ablage: { letzte: Abrechnung | null } = { letzte: null };
    verdrahte(p, ablage);
    holeAbholer(p, "steel");
    const geldVor = p.account.moneyEur;
    p.m.requestPickup(); // Taste V
    for (let i = 0; i < 60 * 400 && ablage.letzte === null; i++) takt(p);

    expect(ablage.letzte, "es wurde überhaupt nicht abgerechnet").not.toBeNull();
    expect(ablage.letzte!.kg).toBe(0);
    expect(ablage.letzte!.eur).toBe(0);
    expect(p.account.moneyEur).toBe(geldVor);
    expect(p.shift.turnoverKg).toBe(0);
    expect(ablage.letzte!.meldung).toContain("Container war leer");
  });

  it("beladen: das Konto wächst auf den Cent, der Umschlag auf das Kilo", () => {
    const p = bauePlatz();
    const ablage: { letzte: Abrechnung | null } = { letzte: null };
    verdrahte(p, ablage);
    const truck = holeAbholer(p, "steel");
    const drauf = ladeAuf(p, truck, [300, 280, 260, 240, 220, 200]);
    const sollKg = summe(drauf);
    expect(sollKg).toBe(1500);
    // Was der Spieler hineingelegt hat, liegt auch wirklich drin.
    expect(summe(truck.containedItems(p.items)), "die Ladung liegt nicht auf der Fläche").toBe(
      sollKg
    );

    const geldVor = p.account.moneyEur;
    p.m.requestPickup(); // Taste V
    for (let i = 0; i < 60 * 400 && ablage.letzte === null; i++) takt(p);
    for (let i = 0; i < 60 * 3; i++) takt(p);

    expect(ablage.letzte, "der Abholer ist ohne Abrechnung losgefahren").not.toBeNull();
    // 1. Verkauft wurde die ganze Fuhre …
    expect(ablage.letzte!.kg).toBeCloseTo(sollKg, 6);
    // 2. … sortenrein zum Katalogpreis (Reinheit 1 → kg × Preis) …
    const preis = getMaterial("steel").sellPricePerKg;
    expect(ablage.letzte!.eur).toBeCloseTo(sollKg * preis, 2);
    // 3. … das Geld ist auf dem Konto …
    expect(p.account.moneyEur - geldVor).toBeCloseTo(sollKg * preis, 2);
    // 4. … der Umschlag ist gewachsen …
    expect(p.shift.turnoverKg).toBeCloseTo(sollKg, 6);
    expect(p.shift.pickups).toBe(1);
    // 5. … und die Teile sind vom Platz verschwunden.
    for (const it of drauf) {
      expect(p.items.items.includes(it), "verkaufter Schrott liegt noch auf dem Platz").toBe(false);
    }
    expect(ablage.letzte!.meldung).toContain("Stahlschrott");
  });

  it("Gegenprobe: eine falsch gezählte Ladefläche fällt auf", () => {
    /*
     * Ohne diesen Fall prüfte der Fall darüber nichts: Er würde auch dann
     * grün, wenn die Schranken so weich wären, dass eine halbe Fuhre
     * durchgeht. Hier wird die Zählung ABSICHTLICH kaputt gemacht — ein Teil
     * wird unterschlagen —, und die Schranken von oben MÜSSEN dagegen
     * anschlagen.
     */
    const p = bauePlatz();
    const truck = holeAbholer(p, "steel");
    const drauf = ladeAuf(p, truck, [300, 280, 260, 240, 220, 200]);
    const sollKg = summe(drauf);
    const preis = getMaterial("steel").sellPricePerKg;

    // Die falsche Zählung: das letzte Stück fehlt (so sah E-044 aus).
    const falsch = truck.containedItems(p.items).slice(0, -1);
    const geldVor = p.account.moneyEur;
    const sale = p.account.sellContainer(falsch, p.items, p.composites, "steel");

    expect(sale.massKg, "die falsche Zählung liefert zufällig doch alles").not.toBeCloseTo(
      sollKg,
      6
    );
    expect(p.account.moneyEur - geldVor).not.toBeCloseTo(sollKg * preis, 2);
    // Und das unterschlagene Stück liegt noch da — es wäre mitgefahren, ohne
    // je bezahlt zu werden. Genau das ist der Schaden.
    expect(p.items.items.length).toBe(1);
  });
});

describe("Ein Fenster, eine Wahrheit: was mitfährt, wird gewogen und bezahlt", () => {
  /**
   * Punktprobe an neun Stellen der Ladefläche.
   *
   * Gemessen wird nicht „liegt im Fenster", sondern was das Spiel mit dem
   * Stück wirklich tut: Wird es für die Fahrt an die Fläche gekoppelt, zählt
   * es die Ausfahrtswiegung, steht es auf der Rechnung? Diese drei Antworten
   * müssen für jeden Punkt gleich sein — und zwar für JA wie für NEIN.
   */
  const punkte: Array<[string, number, number, number]> = [
    ["mitten drin", 0, 0.3, 0.5],
    ["auf der Bordwand, noch innen", 1.5, 1.4, 0.5],
    ["auf der Bordwand, halb drüber", 1.65, 1.4, 0.5],
    ["auf der Bordwand, weit drüber", 1.9, 1.4, 0.5],
    ["auf der Heckklappe", 0, 1.4, -0.35 / 5.4],
    ["an der Stirnwand", 0, 1.4, 1 + 0.35 / 5.4],
    ["oben auf dem Haufen", 0, 2.4, 0.5],
    ["ganz oben auf dem Haufen", 0, 2.8, 0.5],
    ["turmhoch", 0, 4.0, 0.5],
  ];

  it("antwortet an jeder Stelle dreimal dasselbe", () => {
    const p = bauePlatz();
    const truck = holeAbholer(p, "steel");
    const innen = truck as unknown as {
      bedGroup: THREE.Group;
      bedLen: number;
      riding: unknown[];
    };
    const probe = p.items.spawnScrap(
      "steel",
      100,
      kiste(),
      new THREE.Vector3(0, 40, 0),
      new THREE.Quaternion()
    );
    // Fest: Das Stück bleibt liegen, wo es hingesetzt wird — gemessen wird das
    // Fenster, nicht der Fall eines Blechs.
    probe.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);

    for (const [was, x, y, zAnteil] of punkte) {
      const w = innen.bedGroup.localToWorld(new THREE.Vector3(x, y, zAnteil * innen.bedLen));
      probe.body.setTranslation({ x: w.x, y: w.y, z: w.z }, true);
      p.scene.updateMatrixWorld(true);

      const bezahlt = truck.containedItems(p.items).includes(probe);
      const gewogen = truck.ladeflaecheKg() >= 100;
      innen.riding.length = 0;
      truck.verriegeleLadeflaeche();
      const faehrtMit = innen.riding.length > 0;
      innen.riding.length = 0;
      probe.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);

      expect(
        [faehrtMit, gewogen, bezahlt],
        `„${was}" (x ${x} | y ${y}): fährt mit ${faehrtMit}, gewogen ${gewogen}, bezahlt ${bezahlt}`
      ).toEqual([faehrtMit, faehrtMit, faehrtMit]);
    }
  });

  it("Gegenprobe: die Punktliste trifft beide Antworten, nicht nur eine", () => {
    /*
     * Ein Wächter, dessen Proben alle im Container liegen, wäre grün, selbst
     * wenn das Fenster unendlich groß wäre. Deshalb muss die Liste beides
     * enthalten: Stellen, die dazugehören, und Stellen, die es nicht tun.
     */
    const p = bauePlatz();
    const truck = holeAbholer(p, "steel");
    const innen = truck as unknown as { bedGroup: THREE.Group; bedLen: number };
    const probe = p.items.spawnScrap(
      "steel",
      100,
      kiste(),
      new THREE.Vector3(0, 40, 0),
      new THREE.Quaternion()
    );
    probe.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    let drin = 0;
    let draussen = 0;
    for (const [, x, y, zAnteil] of punkte) {
      const w = innen.bedGroup.localToWorld(new THREE.Vector3(x, y, zAnteil * innen.bedLen));
      probe.body.setTranslation({ x: w.x, y: w.y, z: w.z }, true);
      p.scene.updateMatrixWorld(true);
      if (truck.containedItems(p.items).includes(probe)) drin++;
      else draussen++;
    }
    expect(drin, "keine einzige Probe liegt auf der Fläche").toBeGreaterThan(0);
    expect(draussen, "keine einzige Probe liegt daneben").toBeGreaterThan(0);
    // Und die Fläche ist wirklich begrenzt: 1,90 m quer ist außerhalb.
    expect(BED_HALF_W).toBeLessThan(1.9);
  });
});
