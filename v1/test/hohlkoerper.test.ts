/**
 * Waechter fuer den Hohlkoerper (E-124, 06.10.2026).
 *
 * Patrick, 06.10.2026: „Autos müssen hole elemente werden, die man zerdrücken
 * kann." Ein Wrack der Fassung C ist seitdem kein Quader mehr, sondern acht
 * (`FORM_C.bleche`), und ein Biss drueckt das Blech ein, auf das die Spinne
 * zielt — nicht die ganze Karosse.
 *
 * Gemessen wurde das mit `tools/wrackdruck.ts` am echten Bagger. Hier steht,
 * was davon ohne Bagger pruefbar ist: Bauart, Masse, Ort des Nachgebens, der
 * Kollider folgt, die Haut folgt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, CarComposite } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { FORM_C } from "../src/dismantle/wrackformen";
import { EventBus } from "../src/core/events";

/** Voller Biss auf ein Autowrack (E-112) — derselbe Wert wie in `greiferschaden`. */
const KRAFT_WRACK = 15.7;

function werkbank(form: "c" | "bestand" = "c"): {
  world: RAPIER.World;
  bus: EventBus;
  comps: CompositeManager;
  car: CarComposite;
} {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0),
    world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  );
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const comps = new CompositeManager(scene, world, items, bus);
  const car = new CarComposite(CAR_DEF, scene, world, items, bus, new THREE.Vector3(0, 0.02, 0), form);
  comps.cars.push(car);
  return { world, bus, comps, car };
}

/**
 * Eine Attrappe der Spinne: ein kinematischer Koerper mit EINER Kapsel, die
 * von oben auf dem Wrack aufliegt — so meldet Rapier sie auch im Spiel (die
 * Schalen sind Kapseln am `grappleBody`). Das Gelenk steht 3 m ueber dem Boden,
 * die Achse zeigt senkrecht nach unten.
 */
function spinneAuf(world: RAPIER.World, x: number, z: number, oberkante: number): void {
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 3, z));
  // Kapsel um 4 cm ins Blech: Rapier fuehrt dann einen Kontakt
  world.createCollider(RAPIER.ColliderDesc.capsule(0.1, 0.09).setTranslation(0, oberkante - 3 + 0.05, 0), b);
}

function blech(car: CarComposite, name: string): number {
  return car.eindrueckung.find((e) => e.name === name)!.m;
}

/** Der Biss, wie der Bagger ihn heute meldet: am URSPRUNG des Koerpers (E-112). */
function biss(bus: EventBus, car: CarComposite, kraftKN = KRAFT_WRACK): void {
  const p = car.body.translation();
  bus.emit("greifer:zugedrueckt", { handle: car.body.handle, kraftKN, x: p.x, y: p.y, z: p.z });
}

beforeAll(async () => {
  await RAPIER.init();
});

describe("Hohlkoerper (E-124)", () => {
  it("Fassung C ist ein Verbund aus acht Quadern, der Bestand bleibt EIN Quader", () => {
    expect(werkbank("c").car.kolliderZahl).toBe(FORM_C.bleche!.length);
    expect(FORM_C.bleche!.length).toBe(8);
    expect(werkbank("bestand").car.kolliderZahl).toBe(1);
    // Kollider 0 ist der Boden und traegt die Masse. Der Bagger fragt seit
    // E-127 in `krallenKontakte` alle Kollider, nicht mehr nur ihn.
    expect(FORM_C.bleche![0]!.name).toBe("Boden");
    expect(FORM_C.bleche![0]!.max).toBe(0);
  });

  it("die Masse ist die des alten Quaders — Werfen und Fallen bleiben, wie sie waren", () => {
    const { world, car } = werkbank("c");
    // Vergleich: genau so, wie das Wrack vor E-124 gebaut wurde
    const alt = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(10, 0.02, 0));
    const [hx, hy, hz] = CAR_DEF.colliderHalf;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(0, CAR_DEF.colliderYOffset, 0).setMass(CAR_DEF.totalMassKg),
      alt
    );
    world.step();
    expect(car.body.mass()).toBeCloseTo(alt.mass(), 3);
    expect(car.body.localCom().y).toBeCloseTo(alt.localCom().y, 4);
    const a = alt.principalInertia();
    const n = car.body.principalInertia();
    expect(n.x).toBeCloseTo(a.x, 1);
    expect(n.y).toBeCloseTo(a.y, 1);
    expect(n.z).toBeCloseTo(a.z, 1);
    // und nach dem Herausreissen des Motors um genau dessen Masse leichter
    car.tearPart("engine");
    world.step();
    expect(car.body.mass()).toBeCloseTo(CAR_DEF.totalMassKg - 150, 3);
  });

  it("gedrueckt wird, worauf die Spinne zielt: Dach, Kofferraum, Haube, rechte Tuer", () => {
    const faelle: Array<[string, number, number, number]> = [
      // Blech, x, z der Spinne, Oberkante darunter (aus FORM_C.bleche)
      ["Dach", 0, -0.05, 1.42],
      ["Heck", 0, -1.5, 0.97],
      ["Vorderwagen", 0, 1.6, 0.86],
      ["Tür vorn rechts", 0.77, 0.34, 0.92],
    ];
    for (const [name, x, z, oben] of faelle) {
      const { world, bus, comps, car } = werkbank("c");
      for (let i = 0; i < 30; i++) world.step();
      spinneAuf(world, x, z, oben);
      car.body.wakeUp();
      world.step();
      comps.update();
      biss(bus, car);
      const gedrueckt = car.eindrueckung.filter((e) => e.m > 0).map((e) => e.name);
      expect(gedrueckt, `Spinne ueber ${name}`).toEqual([name]);
      expect(car.crushStage, `ein Biss auf ${name} quetscht nicht das ganze Auto`).toBe(0);
    }
  });

  it("ohne Spinne in der Naehe und mit dem Koerperursprung als Ort wird von oben gedrueckt (E-114)", () => {
    const { bus, car } = werkbank("c");
    biss(bus, car);
    expect(car.eindrueckung.filter((e) => e.m > 0).map((e) => e.name)).toEqual(["Dach"]);
  });

  it("der Kollider folgt dem Blech: das Dach sinkt um genau den Eindruck, und nie tiefer als sein max", () => {
    const { bus, car, world } = werkbank("c");
    const dachKollider = (): RAPIER.Collider => car.body.collider(FORM_C.bleche!.findIndex((b) => b.name === "Dach"));
    // Wrack-lokal: Rapier stellt die Weltlage eines umgeformten Kolliders erst im naechsten Schritt
    const oben = (): number =>
      dachKollider().translation().y - car.body.translation().y + dachKollider().halfExtents().y;
    world.step();
    const vorher = oben();
    biss(bus, car);
    world.step();
    // 15,7 kN = 7 m/s → min(0,2; 0,035 · 7) = 0,2 m
    expect(blech(car, "Dach")).toBeCloseTo(0.2, 6);
    expect(vorher - oben()).toBeCloseTo(0.2, 3);
    for (let i = 0; i < 5; i++) biss(bus, car);
    expect(blech(car, "Dach")).toBeCloseTo(FORM_C.bleche!.find((b) => b.name === "Dach")!.max, 6);
    expect(dachKollider().halfExtents().y * 2, "Mindestdicke").toBeGreaterThanOrEqual(0.12 * CAR_DEF.crushScales[car.crushStage] - 1e-6);
  });

  it("die Haut folgt dem Blech: die Dachkante geht mit, die Guertellinie bleibt", () => {
    const { bus, car } = werkbank("c");
    const haut = car.group.getObjectByProperty("type", "Mesh") as THREE.Mesh | undefined;
    // Die Karosserie ist das erste Netz im crushGroup
    let karosse: THREE.Mesh | null = null;
    car.group.traverse((o) => {
      if (!karosse && (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.getAttribute("color")) karosse = o as THREE.Mesh;
    });
    expect(karosse ?? haut).toBeTruthy();
    const attr = (karosse as unknown as THREE.Mesh).geometry.getAttribute("position") as THREE.BufferAttribute;
    const vorher = new Float32Array(attr.array as Float32Array);
    biss(bus, car);
    let dachkante = 0;
    let guertel = 0;
    for (let i = 0; i < attr.count; i++) {
      const y0 = vorher[i * 3 + 1]!;
      const z0 = vorher[i * 3 + 2]!;
      const dy = vorher[i * 3 + 1]! - attr.getY(i);
      if (Math.abs(z0 + 0.06) <= 0.31 && y0 >= 1.29) dachkante = Math.max(dachkante, dy);
      if (Math.abs(z0 + 0.06) <= 0.31 && Math.abs(y0 - 0.92) < 0.01) guertel = Math.max(guertel, Math.abs(dy));
    }
    expect(dachkante, "das Dach ist sichtbar eingedrueckt").toBeGreaterThan(0.15);
    expect(guertel, "die Guertellinie unter dem Dach bleibt stehen").toBeLessThan(0.01);
  });

  it("die Bodenwanne endet am Schweller (0,32 m), und alles Uebrige steht lueckenlos darauf (E-127)", () => {
    const [boden, ...rest] = FORM_C.bleche!;
    const oben = boden!.mitte[1] + boden!.halb[1];
    // Ebene 1 der Fassung C ist die Schwellerkante
    expect(oben).toBeCloseTo(FORM_C.ebenen[1]!, 9);
    for (const b of rest) {
      if (b.name === "Dach") continue; // liegt auf dem Glashaus, nicht auf dem Boden
      expect(b.mitte[1] - b.halb[1], `${b.name} steht auf dem Boden, ohne Spalt`).toBeCloseTo(oben, 9);
    }
  });

  it("die Tuer gibt bis zum Schweller nach, nicht nur bis zur Sicke (E-127)", () => {
    const { world, bus, comps, car } = werkbank("c");
    let karosse: THREE.Mesh | null = null;
    car.group.traverse((o) => {
      if (!karosse && (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.getAttribute("color")) karosse = o as THREE.Mesh;
    });
    const attr = (karosse as unknown as THREE.Mesh).geometry.getAttribute("position") as THREE.BufferAttribute;
    const vorher = new Float32Array(attr.array as Float32Array);
    for (let i = 0; i < 30; i++) world.step();
    spinneAuf(world, 0.77, 0.34, 0.92);
    car.body.wakeUp();
    world.step();
    comps.update();
    biss(bus, car);
    expect(blech(car, "Tür vorn rechts")).toBeCloseTo(0.2, 6);
    // Wie weit geht die rechte Flanke unter der Tuer je Hoehe nach innen?
    const nachInnen = (hoehe: number): number => {
      let m = 0;
      for (let i = 0; i < attr.count; i++) {
        const [x0, y0, z0] = [vorher[i * 3]!, vorher[i * 3 + 1]!, vorher[i * 3 + 2]!];
        if (x0 > 0.3 && Math.abs(y0 - hoehe) < 0.005 && z0 > 0 && z0 < 0.7) m = Math.max(m, x0 - attr.getX(i));
      }
      return m;
    };
    /*
     * Gemessen 06.10.2026 bei 0,20 m Eindruck (Knitter ±20 %, dazu die Beule):
     *   Hoehe        0,20   0,32   0,46   0,58
     *   Boden 0,58   0,000  0,022  0,072  0,196   (E-124)
     *   Boden 0,32   0,136  0,166  0,120  0,196   (E-127)
     */
    for (const h of [0.2, 0.32, 0.46]) expect(nachInnen(h), `Flanke auf ${h} m`).toBeGreaterThan(0.1);
  });

  it("Eindruecken kostet keine Masse (E-114): nur herausgerissene Teile machen das Wrack leichter", () => {
    const { bus, car } = werkbank("c");
    const vorher = car.massKg;
    /*
     * 10 kN = 4,46 m/s: ueber der Beulschwelle, unter der Quetschschwelle.
     * Ein VOLLER Biss ueber dem Dach reisst das Getriebe heraus (E-114, rohe
     * Gewalt als Sortierung) — das ist gewollt und steht in `greiferschaden`.
     */
    for (let i = 0; i < 3; i++) biss(bus, car, 10);
    expect(blech(car, "Dach")).toBeGreaterThan(0);
    expect(car.massKg).toBe(vorher);
  });
});
