import type { System, SimContext } from "./System";

/**
 * M0-Platzhalter, damit Scheduler, Snapshot-Test und Overlay etwas zu tun haben.
 * Zählt Simulationssekunden. Wird in M1 durch die echten Systeme ersetzt bzw. bleibt als Uhr.
 */
export class HeartbeatSystem implements System {
  readonly name = "heartbeat";
  readonly phase = "postStep" as const;
  readonly order = 1000;
  seconds = 0;
  update(_ctx: SimContext, dt: number): void { this.seconds += dt; }
  save(): unknown { return { seconds: this.seconds }; }
  load(data: unknown): void {
    const d = data as { seconds?: number } | undefined;
    if (d && typeof d.seconds === "number" && Number.isFinite(d.seconds)) this.seconds = d.seconds;
  }
}
