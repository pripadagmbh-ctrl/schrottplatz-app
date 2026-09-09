import { EventBus } from "@/shared/events";
import type { GameData } from "@/data/types";
import { createWorldState, type WorldState } from "./world/WorldState";
import { PhysicsWorld } from "./world/PhysicsWorld";
import { Level } from "./world/Level";
import { Scheduler, type SimContext, type System } from "./systems/System";
import { emptyControlFrame, type ControlFrame } from "./control/ControlFrame";
import { HeartbeatSystem } from "./systems/HeartbeatSystem";
import { ScrapSystem } from "./systems/ScrapSystem";
import { ExcavatorSystem } from "./systems/ExcavatorSystem";
import { ExcavatorColliders } from "./systems/ExcavatorColliders";
import { GripSystem } from "./systems/GripSystem";
import { AimSystem } from "./systems/AimSystem";
import { VehicleSystem } from "./systems/VehicleSystem";
import { ContainerSystem } from "./systems/ContainerSystem";
import { DaySystem } from "./systems/DaySystem";
import { MissionSystem } from "./systems/MissionSystem";
import { TutorialSystem } from "./systems/TutorialSystem";

/**
 * Bündelt WorldState, PhysicsWorld, Level, Scheduler und EventBus zu einer kopflosen Simulation.
 * Läuft identisch in Node (Vitest) und im Browser — das ist der Kern der v2-Architektur.
 * `initPhysics()` muss vorher gelaufen sein.
 */
export class Simulation {
  readonly bus = new EventBus();
  readonly scheduler = new Scheduler();
  readonly world: WorldState;
  readonly physics: PhysicsWorld;
  readonly level: Level;
  readonly control: ControlFrame = emptyControlFrame();
  readonly scrap: ScrapSystem;
  readonly excavator = new ExcavatorSystem();
  readonly excavatorColliders = new ExcavatorColliders();
  readonly grip = new GripSystem();
  readonly aim: AimSystem;
  readonly vehicles: VehicleSystem;
  readonly containers: ContainerSystem;
  readonly day = new DaySystem();
  readonly missions: MissionSystem;
  readonly tutorial: TutorialSystem;
  readonly dt: number;
  private readonly ctx: SimContext;

  constructor(readonly data: GameData) {
    const b = data.balancing;
    this.dt = 1 / b.physics.stepHz;
    this.world = createWorldState(Number(b.economy["startMoneyEur"]), data.level.spawns.excavator);
    this.physics = new PhysicsWorld(b.physics);
    this.level = new Level(data.level, this.physics);
    const scheduler = this.scheduler;
    this.ctx = {
      world: this.world, physics: this.physics, data, bus: this.bus, control: this.control,
      get: <T extends System>(name: string) => scheduler.get<T>(name),
    };
    this.scrap = new ScrapSystem(this.level);
    this.aim = new AimSystem(this.level);
    this.vehicles = new VehicleSystem(this.level);
    this.containers = new ContainerSystem(this.level);
    this.missions = new MissionSystem(this.level);
    this.tutorial = new TutorialSystem(this.level);
    this.registerDefaultSystems();
  }

  /** Feste Reihenfolge — wächst mit den Meilensteinen (Architektur Kap. 4, Tabelle). */
  private registerDefaultSystems(): void {
    this.scheduler.register(this.excavator);          // input 10
    this.scheduler.register(this.excavatorColliders); // preStep 10
    this.scheduler.register(this.vehicles);           // preStep 15
    this.scheduler.register(this.grip);               // preStep 20
    this.scheduler.register(this.scrap);              // postStep 10
    this.scheduler.register(this.aim);                // postStep 20
    this.scheduler.register(this.containers);         // slow ×6
    this.scheduler.register(this.day);                // slow ×6 (30)
    this.scheduler.register(this.missions);           // slow ×6 (40)
    this.scheduler.register(this.tutorial);           // slow ×6 (50)
    this.scheduler.register(new HeartbeatSystem());   // postStep 1000
  }

  init(): void { this.scheduler.init(this.ctx); }
  step(): void { this.scheduler.step(this.ctx, this.dt); }
  run(steps: number): void { for (let i = 0; i < steps; i++) this.step(); }

  /**
   * Vorsimulation ohne Systeme und ohne Zeitfortschritt: Haufen setzt sich, dann schlafen alle.
   * Damit beginnt kein Bild mit 150 wachen Körpern (Briefing Kap. 6.5).
   */
  settle(maxSteps = this.data.balancing.physics.presimulateSteps): number {
    let quiet = 0, i = 0;
    for (; i < maxSteps; i++) {
      this.physics.step();
      if (i % 10 === 9) { quiet = this.scrap.isQuiet() ? quiet + 1 : 0; if (quiet >= 3) { i++; break; } }
    }
    this.scrap.update(this.ctx); // Posen übernehmen
    this.scrap.sleepAll();
    this.scrap.update(this.ctx);
    return i;
  }

  save(): Record<string, unknown> { return this.scheduler.saveAll(); }
  load(data: Record<string, unknown>): void { this.scheduler.loadAll(data, this.ctx); }
  dispose(): void { this.scheduler.dispose(); this.physics.dispose(); this.bus.clear(); }
}
