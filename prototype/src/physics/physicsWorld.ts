import RAPIER from "@dimforge/rapier3d-compat";

/** Dünner Wrapper um die Rapier-Welt: fester 60-Hz-Step, Zählstatistik fürs Debug-Overlay. */
export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;

    // Kontaktwerte nach Messung (10.09.2026), nicht nach Gefuehl.
    //
    // Hier standen harte Werte (12 Iterationen, Frequenz 40, zugelassener
    // Fehler 0,001, 6 Reibungsdurchlaeufe) mit der Begruendung, weichere
    // liessen Teile in den Boden und ineinander einsinken. Nachgemessen stimmt
    // das nicht: Mit den weichen Werten liegt KEIN Teil unter dem Boden, und
    // der Haufen steht sogar hoeher (2,76 statt 2,11 m) — die harten Werte
    // ruetteln ihn zusammen, statt ihn zu stuetzen.
    //
    // Dafuer kosten sie: 3,07 gegen 1,44 ms je Schritt im wachen Zustand. Das
    // ist die Zeitlupe beim Abwerfen — ein Abwurf weckt den Haufen, die Physik
    // ueberzieht das Bildbudget, und der Spiral-Schutz wirft Zeit weg. Und der
    // Haufen schlaeft mit den weichen Werten genauso zuverlaessig ein (ueber
    // vier Haufen je 0 von rund 100 wach).
    const p = this.world.integrationParameters;
    p.numSolverIterations = 6;
    p.contact_natural_frequency = 30;
    p.normalizedAllowedLinearError = 0.005;
    p.numAdditionalFrictionIterations = 2;
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
