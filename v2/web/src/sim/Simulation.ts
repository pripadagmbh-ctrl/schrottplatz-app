import { EventBus } from "@/shared/events";
import type { GameData } from "@/data/types";
import { createWorldState, type WorldState } from "./world/WorldState";
import { PhysicsWorld } from "./world/PhysicsWorld";
import { Scheduler, type SimContext, type System } from "./systems/System";
import { emptyControlFrame, type ControlFrame } from "./control/ControlFrame";
import { HeartbeatSystem } from "./systems/HeartbeatSystem";

/**
 * Bündelt WorldState, PhysicsWorld, Scheduler und EventBus zu einer kopflosen Simulation.
 * Läuft identisch in Node (Vitest) und im Browser — das ist der Kern der v2-Architektur.
 * `initPhysics()` muss vorher gelaufen sein.
 */
export class Simulation {
  readonly bus = new EventBus();
  readonly scheduler = new Scheduler();
  readonly world: WorldState;
  readonly physics: PhysicsWorld;
  readonly control: ControlFrame = emptyControlFrame();
  readonly dt: number;
  private readonly ctx: SimContext;

  constructor(readonly data: GameData) {
    const b = data.balancing;
    this.dt = 1 / b.physics.stepHz;
    this.world = createWorldState(Number(b.economy["startMoneyEur"]), data.level.spawns.excavator);
    this.physics = new PhysicsWorld(b.physics);
    const scheduler = this.scheduler;
    this.ctx = {
      world: this.world, physics: this.physics, data, bus: this.bus, control: this.control,
      get: <T extends System>(name: string) => scheduler.get<T>(name),
    };
    this.registerDefaultSystems();
  }

  /** Feste Reihenfolge — wächst mit den Meilensteinen (Architektur Kap. 4, Tabelle). */
  private registerDefaultSystems(): void {
    this.scheduler.register(new HeartbeatSystem());
  }

  init(): void { this.scheduler.init(this.ctx); }
  step(): void { this.scheduler.step(this.ctx, this.dt); }
  run(steps: number): void { for (let i = 0; i < steps; i++) this.step(); }
  dispose(): void { this.scheduler.dispose(); this.physics.dispose(); this.bus.clear(); }
}
