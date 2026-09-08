import type { WorldState } from "@/sim/world/WorldState";
import type { PhysicsWorld } from "@/sim/world/PhysicsWorld";

/**
 * Nur-Lese-Sicht für view/ui (Architektur Kap. 2). Die Ansicht greift nie in Systeme,
 * sie liest pro Bild diesen Datensatz. M0: nur Zähler fürs Overlay; Posen ab M2.
 */
export interface DebugSnapshot {
  step: number; bodies: number; awake: number; physicsMs: number; moneyEur: number; day: number;
}
export function debugSnapshot(world: WorldState, physics: PhysicsWorld): DebugSnapshot {
  const s = physics.stats();
  return { step: world.step, bodies: s.bodies, awake: s.awake, physicsMs: s.stepMs, moneyEur: world.economy.moneyEur, day: world.day.day };
}
