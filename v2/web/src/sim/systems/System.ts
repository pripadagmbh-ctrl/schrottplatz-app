import type { EventBus } from "@/shared/events";
import type { GameData } from "@/data/types";
import type { WorldState } from "@/sim/world/WorldState";
import type { PhysicsWorld } from "@/sim/world/PhysicsWorld";
import type { ControlFrame } from "@/sim/control/ControlFrame";

/**
 * System-Interface und Scheduler (Architektur Kap. 4).
 * Ein Feature = ein System mit deklarierter Phase und Reihenfolge. Kein main.ts, das 30 Callbacks setzt.
 *
 *  input    : ControlFrame anwenden (Bagger)
 *  preStep  : kinematische Körper setzen (Bagger-Kollider, Lkw, Greifer-Ladung)
 *  postStep : nach physics.step — Zählen, Ereignisse, Zustandsautomaten
 *  slow     : alle N Steps (Container-Zählung, Bündeln, Fahrspur)
 */
export type Phase = "input" | "preStep" | "postStep" | "slow";
const PHASE_ORDER: Record<Phase, number> = { input: 0, preStep: 1, postStep: 2, slow: 3 };

export interface SimContext {
  readonly world: WorldState;
  readonly physics: PhysicsWorld;
  readonly data: GameData;
  readonly bus: EventBus;
  readonly control: ControlFrame;
  /** Nur lesender Zugriff auf ein anderes System (nach unten fragen, nie nach oben rufen). */
  get<T extends System>(name: string): T;
}

export interface System {
  readonly name: string;
  readonly phase: Phase;
  readonly order: number;
  /** Nur Phase "slow": alle N Steps */
  readonly every?: number;
  init?(ctx: SimContext): void;
  update(ctx: SimContext, dt: number): void;
  save?(): unknown;
  load?(data: unknown, ctx: SimContext): void;
  dispose?(): void;
}

export class Scheduler {
  private systems: System[] = [];
  private byName = new Map<string, System>();

  register(s: System): void {
    if (this.byName.has(s.name)) throw new Error(`System doppelt registriert: ${s.name}`);
    if (s.phase === "slow" && (!s.every || s.every < 1)) throw new Error(`Slow-System ${s.name} braucht every ≥ 1`);
    this.systems.push(s);
    this.byName.set(s.name, s);
    this.systems.sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.order - b.order || a.name.localeCompare(b.name));
  }

  get<T extends System>(name: string): T {
    const s = this.byName.get(name);
    if (!s) throw new Error(`Unbekanntes System: ${name}`);
    return s as T;
  }

  /** Für den Snapshot-Test: Wer ein System einfügt, sieht die Reihenfolge im Diff. */
  describe(): string[] {
    return this.systems.map((s) => `${s.phase}:${s.order}:${s.name}${s.every ? `×${s.every}` : ""}`);
  }

  init(ctx: SimContext): void { for (const s of this.systems) s.init?.(ctx); }

  /** Ein fester Physikschritt. `dt` = 1/stepHz. */
  step(ctx: SimContext, dt: number): void {
    this.run("input", ctx, dt);
    this.run("preStep", ctx, dt);
    ctx.physics.step();
    this.run("postStep", ctx, dt);
    ctx.physics.flushRemovals();
    for (const s of this.systems) {
      if (s.phase !== "slow") continue;
      const every = s.every ?? 10;
      if (ctx.world.step % every === 0) s.update(ctx, dt * every);
    }
    ctx.world.step += 1;
  }

  private run(phase: Phase, ctx: SimContext, dt: number): void {
    for (const s of this.systems) if (s.phase === phase) s.update(ctx, dt);
  }

  saveAll(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const s of this.systems) if (s.save) out[s.name] = s.save();
    return out;
  }
  loadAll(data: Record<string, unknown>, ctx: SimContext): void {
    for (const s of this.systems) if (s.load && s.name in data) s.load(data[s.name], ctx);
  }
  dispose(): void { for (const s of this.systems) s.dispose?.(); }
}
