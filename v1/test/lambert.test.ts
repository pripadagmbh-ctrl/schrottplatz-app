/**
 * Wächter für Lamberts Arbeit, seit sie auf Befehl läuft.
 *
 * Ansage 13.09.2026: „wir lassen die Container weg und nutzen die Trennwände
 * als Mulden. Lambert fährt von der Ostseite ran auf Befehl und macht die
 * Mulden leer und fährt sie zu der Ostseite mit dem Radlader. Er kommt dann
 * nicht mehr bei uns aufräumen."
 *
 * Der Weg dorthin war eine Kette von Messungen, und jede Stufe steckt hier als
 * Prüfung:
 *
 *  - Der Ruf darf nicht an der Erreichbarkeit hängen. Er hing daran, und
 *    Lambert sagte ab, weil er noch am alten Posten stand.
 *  - Die Ladung in der Box darf ihm nicht den Weg zu sich selbst versperren.
 *    Gemessen lag das nächste Stück 0,7 m neben der Linie und galt als
 *    Hindernis.
 *  - Eine volle Box gilt nicht als leer, nur weil der Haufen höher liegt als
 *    die alte Schranke von 1,4 m. Die Boxwände sind 1,8 m hoch.
 *  - Das Einweisen von LKW überschrieb jedes Ziel, sobald einer auf dem Platz
 *    stand — Lambert blieb stehen, obwohl er gerufen war.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { StaffManager } from "../src/world/people";
import { CONFIGS } from "../src/world/containers";
import { WEIGH_X, WEIGH_Z, KAFFEE_POS } from "../src/world/yard";
import { BAGGER_STAND } from "../src/world/baggerstand";

beforeAll(async () => {
  await initPhysics();
});

const KUPFERBOX = CONFIGS.find((c) => c.id === "r_copper")!;
const KUPFERLAGER = CONFIGS.find((c) => c.id === "c_copper_lager")!;

function inZone(p: { x: number; z: number }, c: typeof KUPFERBOX): boolean {
  return Math.abs(p.x - c.x) <= c.size[0] / 2 && Math.abs(p.z - c.z) <= c.size[1] / 2;
}

/** Platz mit `stueck` Kupferteilen in der Kupferbox aufbauen. */
function platz(stueck: number): {
  staff: StaffManager;
  items: ItemManager;
  schritt: (s: number) => void;
  imLager: () => number;
  inDerBox: () => number;
} {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden
  );
  const items = new ItemManager(scene, world);
  for (let i = 0; i < stueck; i++) {
    items.spawnScrap(
      "copper",
      30,
      { kind: "box", dims: [0.5, 0.4, 0.5] },
      new THREE.Vector3(
        KUPFERBOX.x + (i % 2) * 0.7,
        0.6 + i * 0.4,
        KUPFERBOX.z + Math.floor(i / 2) * 0.7
      )
    );
  }
  const staff = new StaffManager(
    scene,
    items,
    new THREE.Vector3(WEIGH_X, 0, WEIGH_Z),
    KAFFEE_POS,
    new THREE.Vector3(-30, 0, 25)
  );
  /*
   * Der Bagger steht auf seinem Standplatz — der kommt aus `baggerstand.ts`
   * und nicht mehr als abgeschriebene Zahl hierher.
   *
   * Beim Platzumbau (E-010) ist genau daran zwei Stunden lang gesucht worden:
   * Mit der alten Zahl (−2,5 | −19,5) stand die Spinne 4,97 m von der Hälfte
   * der Ladung entfernt, und Lambert fasst nichts an, was näher als 5,5 m an
   * ihr liegt (`GRAPPLE_KEEPOUT`). Gemessen blieben zwei von vier Stücken
   * liegen — nicht weil Lambert etwas verlernt hätte, sondern weil der Test
   * den Bagger an eine Stelle setzte, an der er seit dem Umbau nicht mehr
   * steht. Vom echten Standplatz aus sind es 8,0 m.
   */
  staff.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  staff.getGrapplePos = () => new THREE.Vector3(BAGGER_STAND.x, 3, BAGGER_STAND.z);
  staff.setLoader(true);
  const schritt = (s: number): void => {
    for (let i = 0; i < Math.round(s * 60); i++) {
      staff.update(1 / 60, null);
      items.clampSpeeds(1 / 60);
      world.step();
    }
  };
  const zaehle = (c: typeof KUPFERBOX): number =>
    items.items.filter((it) => it.materialId === "copper" && inZone(it.body.translation(), c))
      .length;
  return {
    staff,
    items,
    schritt,
    imLager: () => zaehle(KUPFERLAGER),
    inDerBox: () => zaehle(KUPFERBOX),
  };
}

describe("Lambert", () => {
  it("steht auf der Ostseite und rührt sich nicht, solange er nicht gerufen ist", () => {
    const p = platz(4);
    p.schritt(3);
    const a = p.staff.lambertOrt.clone();
    p.schritt(20);
    const b = p.staff.lambertOrt;
    expect(p.staff.lambertArbeitet, "arbeitet ungerufen").toBe(false);
    expect(
      Math.hypot(b.x - a.x, b.z - a.z),
      `er ist ungerufen von (${a.x.toFixed(1)}|${a.z.toFixed(1)}) nach ` +
        `(${b.x.toFixed(1)}|${b.z.toFixed(1)}) gefahren`
    ).toBeLessThan(0.5);
    /*
     * Sein Posten liegt in der Gasse VOR den offenen Seiten der Sortiermulden
     * — westlich davon, damit er mit der Schaufel hineinkommt. Geprueft wird
     * diese Eigenschaft, nicht die Zahl: Die Reihe ist am 13.09.2026 einmal
     * gewandert, und mit einer festen Schranke waere der Test danach falsch
     * gewesen, obwohl er richtig stand.
     */
    const mulde = CONFIGS.find((c) => c.sortierbox === true)!;
    expect(b.x, "steht nicht vor den offenen Seiten der Mulden").toBeLessThan(
      mulde.x - mulde.size[0] / 2
    );
  }, 30000);

  it("nimmt den Ruf an, auch wenn der Weg gerade versperrt ist", () => {
    /*
     * Der Ruf fragt nur, OB etwas in den Boxen liegt. Haengt er am Weg, sagt
     * Lambert ab, weil die Ladung sich selbst im Weg liegt oder weil er noch
     * am falschen Ende des Platzes steht — beides geht vorbei, die Absage
     * nicht.
     */
    const p = platz(5);
    p.schritt(3);
    expect(p.staff.rufeLambert()).toBe("kommt");
    expect(p.staff.rufeLambert(), "zweiter Ruf").toBe("schon unterwegs");
  }, 30000);

  it("sagt ab, wenn die Boxen leer sind", () => {
    const p = platz(0);
    p.schritt(3);
    expect(p.staff.rufeLambert()).toBe("nichts zu holen");
  }, 30000);

  it("räumt die Box leer und fährt das Material in die Mulde an der Ostwand", () => {
    const p = platz(4);
    p.schritt(3);
    expect(p.inDerBox(), "nichts in der Box").toBeGreaterThan(2);
    expect(p.staff.rufeLambert()).toBe("kommt");
    p.schritt(150);
    expect(p.inDerBox(), `${p.inDerBox()} liegen noch in der Box`).toBe(0);
    expect(
      p.imLager(),
      `nur ${p.imLager()} von ${p.items.items.length} im Kupferlager`
    ).toBeGreaterThan(2);
  }, 60000);

  it("meldet sich ab, wenn nichts mehr da ist", () => {
    const p = platz(2);
    p.schritt(3);
    p.staff.rufeLambert();
    p.schritt(150);
    expect(p.staff.lambertArbeitet, "bleibt gerufen, obwohl die Box leer ist").toBe(false);
    const mulde = CONFIGS.find((c) => c.sortierbox === true)!;
    expect(
      p.staff.lambertOrt.x,
      "steht nicht wieder vor den offenen Seiten der Mulden"
    ).toBeLessThan(mulde.x - mulde.size[0] / 2);
  }, 60000);
});
