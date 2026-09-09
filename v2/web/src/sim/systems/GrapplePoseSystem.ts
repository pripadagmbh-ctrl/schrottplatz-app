import type { System, SimContext } from "./System";
import type { ExcavatorSystem } from "./ExcavatorSystem";
import type { ExcavatorColliders } from "./ExcavatorColliders";

/**
 * Spinne 2.0 (E-038): Nach jedem Physikschritt die Pose des dynamischen Spinnenkoerpers in `ExcavatorSystem.pose`
 * uebernehmen — Ansicht, Zielring, Greifer und Verbundteile lesen alle von dort. Laeuft VOR Scrap/Aim (postStep 10/20).
 */
export class GrapplePoseSystem implements System {
  readonly name = "grapplePose";
  readonly phase = "postStep" as const;
  readonly order = 5;
  private ex!: ExcavatorSystem; private cols!: ExcavatorColliders;

  init(ctx: SimContext): void { this.ex = ctx.get<ExcavatorSystem>("excavator"); this.cols = ctx.get<ExcavatorColliders>("excavatorColliders"); }
  update(_ctx: SimContext, dt: number): void { const b = this.cols.grapple; this.ex.syncFromBody(b.translation(), b.rotation(), dt); }
}
