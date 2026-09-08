import type { ControlFrame } from "@/sim/control/ControlFrame";
import type { ControlsFile } from "@/data/types";

/**
 * Tastatur + Maus → ControlFrame (Briefing Kap. 5.2). Belegung aus controls.json; keine Tastencodes in der Simulation.
 *  - Achsen: Tastenpaare (neg/pos), z. B. Q/E Oberwagen, R/F Hauptarm, T/G Stiel, W/S Fahren, A/D Lenken.
 *  - Greifen: linke Maustaste halten = schließen (+1); losgelassen = öffnen (−1). Toggle-Option kommt mit den Einstellungen (M3).
 *  - Rotator: Mausrad, 15° je Raste — wird als Dauerdrehung ausgegeben, bis der Winkel abgearbeitet ist.
 *  - Kamera: mittlere oder rechte Maustaste ziehen = Orbit; Shift + Rad = Zoom. Wird nur transportiert, sim ignoriert es.
 */
export class KeyboardMouseAdapter {
  private down = new Set<string>();
  private mouseButtons = 0;
  private pendingRotatorRad = 0;
  private orbitDx = 0; private orbitDy = 0; private zoom = 0;
  private dragging = false; private lastX = 0; private lastY = 0;
  private readonly pairs: { fn: "cab" | "boom" | "stick" | "drive" | "steer" | "rotator"; neg: string; pos: string }[] = [];
  private wantOpen = false; private grabHeld = false;
  private readonly actions = new Map<string, ControlFrame["actions"] extends Set<infer A> ? A : never>();
  private pressedActions = new Set<string>();
  private readonly rotatorStepRad: number; private readonly rotatorRateRad: number;
  private readonly unsubs: (() => void)[] = [];

  constructor(target: HTMLElement, controls: ControlsFile, rotatorStepDeg: number, rotatorRateDegS: number) {
    this.rotatorStepRad = (rotatorStepDeg * Math.PI) / 180; this.rotatorRateRad = (rotatorRateDegS * Math.PI) / 180;
    for (const fn of ["cab", "boom", "stick", "drive", "steer", "rotator"] as const) {
      const k = controls.keyboard[fn];
      if (k && typeof k === "object") this.pairs.push({ fn, neg: k.neg, pos: k.pos });
    }
    const single = (name: string) => { const k = controls.keyboard[name]; return typeof k === "string" ? k : undefined; };
    for (const [action, key] of [["cycleCamera", single("cycleCamera")], ["orderPickup", single("orderPickup")], ["pause", single("pause")], ["endDay", single("endDay")], ["toggleDebug", single("debugOverlay")], ["toggleDriveMode", single("toggleDriveMode")]] as const) {
      if (key) this.actions.set(key, action);
    }
    const on = <K extends keyof WindowEventMap>(el: Window | HTMLElement, ev: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts); this.unsubs.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(window, "keydown", (e) => { if (e.repeat) return; this.down.add(e.code); const a = this.actions.get(e.code); if (a) { this.pressedActions.add(a); e.preventDefault(); } });
    on(window, "keyup", (e) => this.down.delete(e.code));
    on(window, "blur", () => { this.down.clear(); this.mouseButtons = 0; this.dragging = false; });
    on(target, "contextmenu", (e) => e.preventDefault());
    on(target, "pointerdown", (e) => {
      this.mouseButtons |= 1 << e.button;
      if (e.button === 1 || e.button === 2) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; target.setPointerCapture(e.pointerId); }
      e.preventDefault();
    });
    on(target, "pointerup", (e) => { this.mouseButtons &= ~(1 << e.button); if (e.button === 1 || e.button === 2) this.dragging = false; });
    on(target, "pointermove", (e) => { if (!this.dragging) return; this.orbitDx += e.clientX - this.lastX; this.orbitDy += e.clientY - this.lastY; this.lastX = e.clientX; this.lastY = e.clientY; });
    on(target, "wheel", (e) => {
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      if (e.shiftKey) this.zoom += dir; else this.pendingRotatorRad += -dir * this.rotatorStepRad;
    }, { passive: false });
  }

  private axis(neg: string, pos: string): number { return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0); }

  /**
   * Pro Physikschritt: Werte **addieren** (Touch kann parallel liegen; der InputMapper klemmt).
   * Greifen: Maustaste/Leertaste halten = schließen; Loslassen = öffnen, aber nur bis die Spinne offen ist —
   * danach 0, damit ein Touch-Spieler mit angeschlossener Maus nicht dauerhaft „öffnen" bekommt.
   */
  add(f: ControlFrame, dt: number): void {
    for (const p of this.pairs) f[p.fn] += this.axis(p.neg, p.pos);
    const held = (this.mouseButtons & 1) !== 0 || this.down.has("Space");
    if (held) { f.grapple = 1; this.grabHeld = true; this.wantOpen = false; }
    else if (this.grabHeld) { this.grabHeld = false; this.wantOpen = true; }
    if (this.wantOpen) f.grapple = Math.min(f.grapple, -1);
    // Rotator: Rastenwinkel vom Mausrad als Dauerdrehung abarbeiten
    if (Math.abs(this.pendingRotatorRad) > 1e-4) {
      const step = this.rotatorRateRad * dt;
      const s = Math.sign(this.pendingRotatorRad);
      f.rotator += s * Math.min(1, Math.abs(this.pendingRotatorRad) / step);
      this.pendingRotatorRad -= s * Math.min(step, Math.abs(this.pendingRotatorRad));
    }
    for (const a of this.pressedActions) f.actions.add(a as never);
    this.pressedActions.clear();
    f.camOrbit.dx += this.orbitDx; f.camOrbit.dy += this.orbitDy; f.camZoom += this.zoom;
    this.orbitDx = 0; this.orbitDy = 0; this.zoom = 0;
  }
  /** Von außen: Spinne ist offen → „öffnen"-Wunsch erledigt. */
  notifyOpen(): void { this.wantOpen = false; }

  dispose(): void { for (const u of this.unsubs) u(); this.unsubs.length = 0; }
}
