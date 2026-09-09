import RAPIER from "@dimforge/rapier3d-compat";
import type { BalancingFile } from "@/data/types";
import type { ItemId } from "@/shared/ids";

/**
 * Dünner Wrapper um die Rapier-Welt (Briefing Kap. 6, 19). Pflichtmuster aus dem QA-Befund H1:
 * Körper werden nur über `safeBody()` angefasst und nur über `requestRemove()` entfernt —
 * ein `wakeUp()` auf einem gelöschten Körper hat im Prototyp die ganze Welt eingefroren.
 *
 * Body-Registry (E-009): `handle → ItemId` lebt hier, weil Kontakt-Events und Shape-Casts
 * (Greifer, Arm-Kollision) nur Handles liefern und die Rückübersetzung an einer Stelle liegen soll.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private removeQueue: number[] = [];
  private lastStepMs = 0;
  private handleToItem = new Map<number, ItemId>();
  private itemToHandle = new Map<ItemId, number>();

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

  register(handle: number, id: ItemId): void {
    this.handleToItem.set(handle, id);
    this.itemToHandle.set(id, handle);
  }
  itemOf(handle: number): ItemId | undefined { return this.handleToItem.get(handle); }
  handleOf(id: ItemId): number | undefined { return this.itemToHandle.get(id); }

  /** Entfernen wird gesammelt und erst nach `postStep` ausgeführt, damit alle Beteiligten vorher loslassen können. */
  requestRemove(handle: number): void { this.removeQueue.push(handle); }

  flushRemovals(): number {
    let n = 0;
    for (const h of this.removeQueue) {
      const id = this.handleToItem.get(h);
      if (id !== undefined) { this.handleToItem.delete(h); this.itemToHandle.delete(id); }
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

  /** Statistik fürs Debug-Overlay und die Wächter-Tests — zählt nur dynamische Körper (Bagger und Lkw sind kinematisch, immer „wach"). */
  stats(): { bodies: number; awake: number; stepMs: number } {
    let bodies = 0, awake = 0;
    // nur Schrottteile zaehlen — der dynamische Spinnenkoerper (E-038) schlaeft nie und ist kein Budget-Posten
    this.world.bodies.forEach((b) => { if (!b.isDynamic() || !this.handleToItem.has(b.handle)) return; bodies++; if (!b.isSleeping()) awake++; });
    return { bodies, awake, stepMs: this.lastStepMs };
  }

  dispose(): void { this.world.free(); this.handleToItem.clear(); this.itemToHandle.clear(); }
}

/** Rapier-WASM initialisieren — einmal vor der ersten Welt. Läuft in Node (Tests) und Browser gleich. */
export async function initPhysics(): Promise<void> { await RAPIER.init(); }
export { RAPIER };
