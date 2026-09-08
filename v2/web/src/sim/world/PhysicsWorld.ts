import RAPIER from "@dimforge/rapier3d-compat";
import type { BalancingFile } from "@/data/types";

/**
 * Dünner Wrapper um die Rapier-Welt (Briefing Kap. 6, 19). Pflichtmuster aus dem QA-Befund H1:
 * Körper werden nur über `safeBody()` angefasst und nur über `requestRemove()` entfernt —
 * ein `wakeUp()` auf einem gelöschten Körper hat im Prototyp die ganze Welt eingefroren.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private removeQueue: number[] = [];
  private lastStepMs = 0;

  constructor(b: BalancingFile["physics"]) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / b.stepHz;
    const p = this.world.integrationParameters;
    p.numSolverIterations = b.solverIterations;
    p.numInternalPgsIterations = b.internalPgsIterations;
    p.contact_natural_frequency = b.contactNaturalFrequency;
  }

  /** Einziger Weg zu einem Körper von außen. `null`, wenn das Handle nicht (mehr) gültig ist. */
  safeBody(handle: number | undefined): RAPIER.RigidBody | null {
    if (handle === undefined) return null;
    const b = this.world.getRigidBody(handle);
    return b && b.isValid() ? b : null;
  }

  /** Entfernen wird gesammelt und erst nach `postStep` ausgeführt, damit alle Beteiligten vorher loslassen können. */
  requestRemove(handle: number): void { this.removeQueue.push(handle); }

  flushRemovals(): number {
    let n = 0;
    for (const h of this.removeQueue) {
      const b = this.safeBody(h);
      if (b) { this.world.removeRigidBody(b); n++; }
    }
    this.removeQueue.length = 0;
    return n;
  }

  step(): void {
    const t0 = performance.now();
    this.world.step();
    this.lastStepMs = performance.now() - t0;
  }

  /** Statistik fürs Debug-Overlay und die Wächter-Tests. */
  stats(): { bodies: number; awake: number; stepMs: number } {
    let bodies = 0, awake = 0;
    this.world.bodies.forEach((b) => { bodies++; if (!b.isSleeping()) awake++; });
    return { bodies, awake, stepMs: this.lastStepMs };
  }

  dispose(): void { this.world.free(); }
}

/** Rapier-WASM initialisieren — einmal vor der ersten Welt. Läuft in Node (Tests) und Browser gleich. */
export async function initPhysics(): Promise<void> { await RAPIER.init(); }
export { RAPIER };
