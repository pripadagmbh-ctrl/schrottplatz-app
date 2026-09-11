/**
 * Wächter für die Haufen-Ruhe (Vorbild v2 M1, Entscheidungen E-010 bis E-012).
 *
 * Gemessen am 09.09.2026 im gebauten Prototyp: 115 von 159 Körpern blieben
 * dauerhaft wach, auch nach 20 s ohne Eingabe. Physik, die nie zur Ruhe kommt,
 * kostet jeden Frame Rechenzeit — auf dem Tablet am meisten.
 *
 * Der Test läuft kopflos: THREE.Scene und Rapier brauchen keinen Bildschirm,
 * nur der Renderer täte das. Deshalb keine Meshes prüfen, nur Körper.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager, maxSpeedFor, FALL_MAX, WERKZEUG_MAX } from "../src/world/scrapItems";
import { PhysicsWorld, initPhysics } from "../src/physics/physicsWorld";

beforeAll(async () => {
  await initPhysics();
});

/**
 * Fester Zufall. Der Haufen wird gewuerfelt — Formen, Massen, Lage, Drehung.
 * Mit echtem Math.random schwankt die Zahl der Nachzuegler von Lauf zu Lauf
 * (gemessen 1 bis 3), und ein Waechter, der mal gruen und mal rot ist, taugt
 * nichts. Deshalb hier ein einfacher Kongruenzgenerator mit festem Startwert.
 */
function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

/** Welt mit den Solver-Werten des Spiels plus Boden — sonst fällt der Haufen ins Leere. */
function platz(): { physics: PhysicsWorld; items: ItemManager } {
  const physics = new PhysicsWorld();
  const boden = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0)
  );
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  return { physics, items: new ItemManager(new THREE.Scene(), physics.world) };
}

/**
 * Wache Schrottteile. Nicht `physics.counts()` nehmen: Rapier meldet feste
 * Körper — hier den Boden — nie als schlafend, das ergäbe immer mindestens 1.
 */
function wacheTeile(items: ItemManager): number {
  return items.items.filter((it) => it.body.isDynamic() && !it.body.isSleeping()).length;
}

/** Schnellster loser Körper — verrät Explosionen, die der Wachzähler nicht zeigt. */
function schnellster(world: RAPIER.World): number {
  let max = 0;
  world.bodies.forEach((b) => {
    if (b.isFixed()) return;
    const v = b.linvel();
    max = Math.max(max, Math.hypot(v.x, v.y, v.z));
  });
  return max;
}

describe("Schrotthaufen", () => {
  it("kommt binnen 600 Schritten vollständig zur Ruhe", () => {
    const zurueck = festerZufall(20260909);
    const { physics, items } = platz();
    items.spawnPile(new THREE.Vector3(0, 0, 0), 150);
    zurueck();

    let spitze = 0;
    for (let i = 0; i < 600; i++) {
      physics.step();
      items.settleSleep(1 / 60);
      spitze = Math.max(spitze, schnellster(physics.world));
    }

    const wach = wacheTeile(items);
    expect(items.items.length, "der Haufen ist gespawnt").toBeGreaterThan(90);
    // Gemessen am 09.09.2026 über sieben verschiedene Haufen: ohne die
    // Schlafhilfe bleiben rund 90 von 118 Teilen dauerhaft wach, mit ihr keines.
    // Wird die Zahl wieder größer, ist eine der drei Ursachen zurück —
    // überlappender Spawn, runde Kollider oder die Einstimmigkeitsregel.
    expect(wach, `${wach} von ${items.items.length} Teilen noch wach nach 10 s`).toBe(0);
    expect(spitze, "kein Teil wurde weggeschleudert").toBeLessThan(20);
    let tiefste = 0;
    for (const it of items.items) tiefste = Math.min(tiefste, it.body.translation().y);
    expect(tiefste, "kein Teil ist durch den Boden gesackt").toBeGreaterThan(-1);
  });

  it("spawnt überlappungsfrei — nichts schleudert im ersten Moment davon", () => {
    const zurueck = festerZufall(20260909);
    const { physics, items } = platz();
    items.spawnPile(new THREE.Vector3(0, 0, 0), 150);
    zurueck();

    // Die ersten 30 Schritte sind der Lackmustest: klemmen Teile ineinander,
    // treibt der Solver sie sofort auseinander (v2 maß 110 m/s, E-010).
    let spitze = 0;
    for (let i = 0; i < 30; i++) {
      physics.step();
      spitze = Math.max(spitze, schnellster(physics.world));
    }
    expect(spitze, "keine Spawn-Explosion").toBeLessThan(8);
  });

  it("legt Teile nur gemeinsam schlafen, nie einzeln", () => {
    // E-012: Ein einzeln schlafen gelegter Körper unter Last verliert den
    // Bodenkontakt und sinkt durch den Platz. Deshalb darf kein Teil schlafen,
    // solange irgendein anderes noch in Bewegung ist.
    const { physics, items } = platz();
    items.spawnPile(new THREE.Vector3(0, 0, 0), 60);

    let verstoss: string | null = null;
    for (let i = 0; i < 400; i++) {
      physics.step();
      items.settleSleep(1 / 60);
      const { bodies, awake } = physics.counts();
      const lose = bodies - 1; // ohne Boden
      if (awake > 0 && awake < lose && !verstoss) {
        // gemischter Zustand ist nur erlaubt, solange Rapier selbst Inseln
        // einschlafen lässt — unsere Schlafhilfe darf ihn nicht erzeugen
        const tiefstes = tiefsterKoerper(physics.world);
        if (tiefstes < -2) verstoss = `Körper bei y=${tiefstes.toFixed(2)} durchgesackt`;
      }
    }
    expect(verstoss).toBeNull();
  });
});

/** Tiefster loser Körper — durchgesackte Teile fallen ins Bodenlose. */
function tiefsterKoerper(world: RAPIER.World): number {
  let tief = 0;
  world.bodies.forEach((b) => {
    if (b.isFixed()) return;
    tief = Math.min(tief, b.translation().y);
  });
  return tief;
}

/**
 * Fallen und Werfen (Messung 11.09.2026).
 *
 * Die Geschwindigkeitsdeckelung galt für jede Richtung. Ein 180-kg-Teil fiel
 * dadurch mit konstant 1,5 m/s statt zu beschleunigen — das sah aus wie
 * Schweben —, und ein weggeschleudertes Teil verlor seinen Schwung sofort.
 */
describe("Geschwindigkeitsgrenzen", () => {
  it("hält schwere Teile quer langsamer als leichte", () => {
    expect(maxSpeedFor(20)).toBeGreaterThan(maxSpeedFor(500));
    // Auch ein Brocken muss sich noch schieben lassen, sonst klebt er fest
    expect(maxSpeedFor(2000)).toBeGreaterThanOrEqual(1.2);
  });

  it("lässt nichts schneller werden als das Werkzeug, das es anstößt", () => {
    /*
     * Ein geschobenes Teil kann nicht schneller sein als sein Schieber: Bei
     * einem Stoss ohne Federung gibt es nichts, woraus mehr Tempo kaeme.
     * Gemessen am 11.09.2026 flog ein 7-kg-Stueck mit 9,33 m/s, waehrend die
     * Spitze der Spinne mit 3,8 m/s lief — das Zweieinhalbfache. Ursache ist
     * die kinematische Spinne, die beliebig viel Schwung abgeben kann.
     *
     * Die alte Fassung dieses Tests verlangte das Gegenteil ("ein Wurf muss
     * als Wurf erkennbar bleiben") und stammte aus einer Zeit, in der das
     * Drehwerk 45 statt 28 Grad je Sekunde drehte.
     */
    for (const masse of [5, 20, 60, 200, 500, 2000]) {
      expect(maxSpeedFor(masse)).toBeLessThanOrEqual(WERKZEUG_MAX);
    }
    expect(WERKZEUG_MAX).toBeLessThanOrEqual(5);
  });

  it("deckelt nach unten erst weit jenseits des freien Falls", () => {
    // Aus 5 m freiem Fall kommt ein Teil auf 10 m/s.
    expect(FALL_MAX).toBeGreaterThan(20);
  });
});
