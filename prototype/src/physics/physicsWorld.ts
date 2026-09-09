import RAPIER from "@dimforge/rapier3d-compat";

/** Dünner Wrapper um die Rapier-Welt: fester 60-Hz-Step, Zählstatistik fürs Debug-Overlay. */
export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;

    // Kontakte müssen hart sein: Beton ist Beton. Zu weiche Werte ließen
    // Teile sichtbar in den Boden und ineinander einsinken, statt satt
    // aufzuliegen. Viele Iterationen halten Haufen trotzdem ruhig.
    const p = this.world.integrationParameters;
    p.numSolverIterations = 12;
    p.contact_natural_frequency = 40;
    p.normalizedAllowedLinearError = 0.001;
    // Zusätzliche Reibungsdurchläufe: sonst rutschen gestapelte Teile ab
    p.numAdditionalFrictionIterations = 6;
  }

  step(): void {
    this.world.step();
  }

  /**
   * Zaehlung fuers Overlay. `awake` allein taeuscht: Rapier meldet feste und
   * kinematische Koerper nie als schlafend, und davon gibt es auf dem Platz
   * reichlich — Waende, Mulden, Gebaeude, die Baggerglieder, die Fahrzeuge.
   * Die koennen gar nicht einschlafen, faerben die Zahl aber ein. Zum Beurteilen
   * der Haufen-Ruhe zaehlt nur `dynAwake` von `dynamic`.
   */
  counts(): { bodies: number; awake: number; dynamic: number; dynAwake: number } {
    let bodies = 0;
    let awake = 0;
    let dynamic = 0;
    let dynAwake = 0;
    this.world.bodies.forEach((b) => {
      bodies++;
      if (!b.isSleeping()) awake++;
      if (b.isDynamic()) {
        dynamic++;
        if (!b.isSleeping()) dynAwake++;
      }
    });
    return { bodies, awake, dynamic, dynAwake };
  }
}

/** Rapier-WASM initialisieren — muss vor dem ersten `new PhysicsWorld()` laufen. */
export async function initPhysics(): Promise<void> {
  await RAPIER.init();
}

export { RAPIER };
