/**
 * DER LADEKRAN SCHWENKT VOM BAGGER WEG (E-044).
 *
 * Ansage Patrick, 15.09.2026: „LKW-Kran immer vom Bagger weg bewegen."
 *
 * Vorher wurde die Seite beim Erzeugen gewürfelt — jede zweite Fuhre hängte
 * ihren Ausleger also in den Arbeitsbereich. Ein Fahrer dreht seinen Kran zur
 * Straßenseite, nicht dorthin, wo gearbeitet wird.
 *
 * Geprüft wird die EIGENSCHAFT, nicht das Vorzeichen: Ausleger und Bagger
 * liegen auf verschiedenen SEITEN des Wagens — an jedem Halteplatz. Das gilt
 * unabhängig davon, wie der Wagen gerade steht, und es bleibt richtig, wenn
 * der Bagger einmal umzieht.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, it, expect, beforeAll } from "vitest";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { VehicleManager, type DeliveryKind } from "../src/delivery/vehicles";
import type { CustomerProfile } from "../src/delivery/customers";
import { pruefKunde } from "./pruefkunde";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { CRANE_SWING } from "../src/delivery/routes";

beforeAll(async () => {
  await initPhysics();
});

/**
 * Nur Händler fahren einen Kran mit (`vehicles.ts`, `withCrane`), und nur auf
 * Kipper und Pritsche.
 */
function haendler(sortenrein: string | null = null): CustomerProfile {
  /*
   * DAS PROFIL KOMMT AUS `test/pruefkunde.ts` (15.09.2026, E-062).
   *
   * Hier stand es als Objektliteral, und darin `fuellgrad: 0.85` neben
   * `massKg: 5000` und `dichte: 500`. Alle drei zusammen sind unvereinbar:
   * Die Spielregel seit E-033 lautet Masse = Fuellgrad x Laderaum x
   * Schuettdichte, und 0,85 voll sind im flachen Kipper 7.118 kg, nicht 5.000.
   * `dichte: 500` gehoert ausserdem zu keinem Material (Mischschrott mit 6 %
   * Stoerstoff: 594,65 kg/m3).
   *
   * Fuer DIESEN Waechter ist das folgenlos — er misst den Kran, nicht die
   * Ladung. Die Abschrift ist trotzdem weg: Sie war die Vorlage, von der das
   * weggeworfene Messgeraet abgeschrieben hat.
   */
  return pruefKunde({ fuellgrad: 0.85, sortenrein, vehicle: "kipper", aufbau: "flach" });
}

interface Innen {
  crane: THREE.Group | null;
  group: THREE.Group;
  phaseName: string;
}

/**
 * Die Spitze des Auslegers in Weltkoordinaten.
 *
 * Der Ausleger zeigt in Kransäulen-Koordinaten nach −z und ist rund 2,3 m
 * lang (`vehicleModel.buildCrane`: `ausleger` auf y 1,05, `arm1` 2,5 m lang,
 * Knickpunkt auf z −2,3). Mehr Genauigkeit braucht es nicht — geprüft wird
 * eine Richtung, keine Kollision auf den Zentimeter.
 */
function auslegerSpitze(v: Innen): THREE.Vector3 {
  v.group.updateWorldMatrix(true, true);
  return v.crane!.localToWorld(new THREE.Vector3(0, 1.05, -2.3));
}

/** Fahrzeug bis zu einer Phase laufen lassen. */
function bisPhase(
  art: DeliveryKind,
  c: CustomerProfile,
  ziel: string
): { v: Innen; vm: VehicleManager; schritt: (n: number) => void } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  const vm = new VehicleManager(
    scene,
    world,
    items,
    new CompositeManager(scene, world, items, new EventBus())
  );
  vm.spawnNow(art, c);
  const v = (vm as unknown as { active: Innen }).active;
  const schritt = (n: number): void => {
    for (let i = 0; i < n; i++) {
      vm.update(1 / 60);
      items.clampSpeeds(1 / 60);
      world.step();
    }
  };
  for (let i = 0; i < 60 * 300 && v.phaseName !== ziel; i++) schritt(1);
  return { v, vm, schritt };
}

describe("Der Ladekran zeigt vom Bagger weg", () => {
  it("der Händler bringt überhaupt einen Kran mit", () => {
    const { v } = bisPhase("kipper", haendler(), "weighIn");
    expect(v.crane, "kein Kran am Händler-LKW").toBeTruthy();
  }, 120000);

  for (const [art, phase, kunde] of [
    ["kipper", "tipping", haendler()],
    ["kipper", "tipHold", haendler()],
    ["pritsche", "waitUnload", haendler()],
    ["kipper", "tipping", haendler("alu")],
  ] as Array<[DeliveryKind, string, CustomerProfile]>) {
    it(`am Halteplatz „${phase}" (${art}${kunde.sortedMaterial ? ", sortenrein" : ""})`, () => {
      const { v, schritt } = bisPhase(art, kunde, phase);
      expect(v.phaseName, `die Phase ${phase} wurde nie erreicht`).toBe(phase);
      // Der Kran schwenkt gemächlich (0,5 rad/s) — erst ausschwenken lassen
      schritt(Math.ceil((CRANE_SWING / 0.5) * 60) + 30);
      const spitze = auslegerSpitze(v);
      const wagen = v.group.position;
      /*
       * Gemessen wird die SEITE, nicht der Abstand.
       *
       * Der Abstand zum Baggerstand ist das falsche Mass: Steht der Wagen
       * 36 m weit weg in der Silo-Gasse, aendert ein Ausleger von zwei Metern
       * ihn quer nur um sechs Zentimeter, laengs aber um zwei Meter — der
       * Vergleich misst dann, ob der Kran nach vorn oder nach hinten zeigt,
       * und nicht, auf welcher Seite er steht. (Genau daran ist die erste
       * Fassung dieses Waechters gescheitert, und das war die richtige
       * Meldung.)
       */
      const quer = (px: number, pz: number): number =>
        (px - wagen.x) * Math.cos(v.group.rotation.y) -
        (pz - wagen.z) * Math.sin(v.group.rotation.y);
      const kran = quer(spitze.x, spitze.z);
      const bagger = quer(BAGGER_STAND.x, BAGGER_STAND.z);
      expect(Number.isFinite(kran) && Number.isFinite(bagger), "NaN in der Lage").toBe(true);
      expect(
        Math.abs(kran),
        `der Ausleger steht nur ${Math.abs(kran).toFixed(2)} m seitlich — er ist gar nicht ausgeschwenkt`
      ).toBeGreaterThan(1.2);
      if (Math.abs(bagger) > 0.5) {
        expect(
          kran * bagger,
          `Kran ${kran.toFixed(2)} m, Bagger ${bagger.toFixed(2)} m quer zum Wagen — ` +
            `beide auf derselben Seite`
        ).toBeLessThan(0);
      }
    }, 120000);
  }

  it("er hängt unterwegs nicht seitlich heraus, sondern liegt über der Fläche", () => {
    /*
     * Ausgeschwenkt ragt der Ausleger rund 2,0 m aus der Wagenmitte, der Wagen
     * selbst nur 1,55 m (`boxen`). Auf der Fahrt muss er deshalb eingeklappt
     * sein — sonst streift er unterwegs Mauern und Mulden, die niemand prüft.
     */
    const { v } = bisPhase("kipper", haendler(), "approach");
    const spitze = auslegerSpitze(v);
    const wagen = v.group.position;
    const quer = Math.abs(
      (spitze.x - wagen.x) * Math.cos(v.group.rotation.y) -
        (spitze.z - wagen.z) * Math.sin(v.group.rotation.y)
    );
    expect(quer, `der Ausleger steht unterwegs ${quer.toFixed(2)} m seitlich heraus`).toBeLessThan(
      1.0
    );
  }, 120000);

  it("die Seite wird gerechnet, nicht gewürfelt und nicht je Halteplatz eingetragen", () => {
    /*
     * Zwei Fuhren in derselben Lage müssen dieselbe Seite wählen. Mit dem
     * gewürfelten `craneSide` von vorher war das in der Hälfte der Fälle
     * nicht so — und genau das hat Patrick gesehen.
     */
    const a = bisPhase("kipper", haendler(), "tipHold");
    const b = bisPhase("kipper", haendler(), "tipHold");
    a.schritt(200);
    b.schritt(200);
    const seite = (x: { v: Innen }): number => {
      const sp = auslegerSpitze(x.v);
      const w = x.v.group.position;
      const quer = (px: number, pz: number): number =>
        (px - w.x) * Math.cos(x.v.group.rotation.y) - (pz - w.z) * Math.sin(x.v.group.rotation.y);
      // Vorzeichen der Kranseite, und zugleich: liegt der Bagger gegenueber?
      expect(quer(sp.x, sp.z) * quer(BAGGER_STAND.x, BAGGER_STAND.z)).toBeLessThan(0);
      return Math.sign(quer(sp.x, sp.z));
    };
    expect(seite(a), "zwei gleiche Fuhren schwenken auf verschiedene Seiten").toBe(seite(b));
  }, 240000);
});
