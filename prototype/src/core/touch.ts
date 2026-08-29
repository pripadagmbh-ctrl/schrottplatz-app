/**
 * Touch-Steuerung für Tablet und Smartphone (Briefing Kap. 5.1, `[V1]`).
 * Zwei virtuelle Sticks im ISO-Baggerschema plus Aktionstasten:
 *   links  — X: Oberwagen drehen, Y: Stiel weg/ran
 *   rechts — X: Rotator, Y: Ausleger heben/senken
 * Die Achsen werden in dieselben Werte gespeist, die sonst die Tastatur liefert.
 */
export interface TouchAxes {
  cab: number; // Oberwagen (-1..1)
  stick: number;
  boom: number;
  rotator: number; // diskrete Rotator-Rasten pro Frame
  drive: number;
  steer: number;
  grab: boolean;
}

interface StickState {
  id: number | null;
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
  knob: HTMLElement;
  pad: HTMLElement;
}

const RADIUS = 62; // px Auslenkung bis Vollausschlag

export class TouchControls {
  readonly axes: TouchAxes = {
    cab: 0,
    stick: 0,
    boom: 0,
    rotator: 0,
    drive: 0,
    steer: 0,
    grab: false,
  };
  /** true, sobald das Gerät als Touch-Gerät erkannt wurde */
  readonly active: boolean;
  private left: StickState;
  private right: StickState;
  private buttons = new Map<string, HTMLElement>();
  /** Tastendrücke, die diesen Frame ausgelöst wurden (Kamera, Presse …) */
  private pressed = new Set<string>();

  constructor() {
    this.active = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const root = document.getElementById("touch");
    if (!root) {
      this.left = this.right = null as unknown as StickState;
      return;
    }
    if (!this.active) {
      root.style.display = "none";
      this.left = this.right = null as unknown as StickState;
      return;
    }
    root.style.display = "block";

    this.left = this.makeStick("touch-left");
    this.right = this.makeStick("touch-right");
    for (const id of ["btn-grab", "btn-view", "btn-cab", "btn-press", "btn-pickup", "btn-fwd", "btn-back"]) {
      const el = document.getElementById(id);
      if (el) this.buttons.set(id, el);
    }
    this.bindButtons();
  }

  private makeStick(id: string): StickState {
    const pad = document.getElementById(id)!;
    const knob = pad.querySelector<HTMLElement>(".knob")!;
    const st: StickState = { id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, knob, pad };
    pad.addEventListener(
      "pointerdown",
      (e) => {
        st.id = e.pointerId;
        const r = pad.getBoundingClientRect();
        st.baseX = r.left + r.width / 2;
        st.baseY = r.top + r.height / 2;
        pad.setPointerCapture(e.pointerId);
        e.preventDefault();
      },
      { passive: false }
    );
    const move = (e: PointerEvent): void => {
      if (st.id !== e.pointerId) return;
      st.dx = Math.max(-1, Math.min(1, (e.clientX - st.baseX) / RADIUS));
      st.dy = Math.max(-1, Math.min(1, (e.clientY - st.baseY) / RADIUS));
      knob.style.transform = `translate(${st.dx * RADIUS * 0.6}px, ${st.dy * RADIUS * 0.6}px)`;
      e.preventDefault();
    };
    const end = (e: PointerEvent): void => {
      if (st.id !== e.pointerId) return;
      st.id = null;
      st.dx = 0;
      st.dy = 0;
      knob.style.transform = "translate(0,0)";
    };
    pad.addEventListener("pointermove", move, { passive: false });
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
    return st;
  }

  private bindButtons(): void {
    const hold = (id: string, on: () => void, off: () => void): void => {
      const el = this.buttons.get(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        on();
        el.classList.add("down");
        e.preventDefault();
      });
      const up = (): void => {
        off();
        el.classList.remove("down");
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    hold(
      "btn-grab",
      () => (this.axes.grab = true),
      () => (this.axes.grab = false)
    );
    hold(
      "btn-fwd",
      () => (this.axes.drive = 1),
      () => (this.axes.drive = 0)
    );
    hold(
      "btn-back",
      () => (this.axes.drive = -1),
      () => (this.axes.drive = 0)
    );
    const tap = (id: string, code: string): void => {
      const el = this.buttons.get(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => {
        this.pressed.add(code);
        e.preventDefault();
      });
    };
    tap("btn-view", "KeyC");
    tap("btn-cab", "KeyX");
    tap("btn-press", "KeyB");
    tap("btn-pickup", "KeyV");
  }

  /** true, wenn die zugehörige Taste diesen Frame per Touch ausgelöst wurde. */
  consumePress(code: string): boolean {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Achsen aus der Stickstellung aktualisieren (einmal pro Frame). */
  update(): void {
    if (!this.active || !this.left) return;
    this.axes.cab = this.left.dx;
    this.axes.stick = -this.left.dy; // hoch = Stiel weg
    this.axes.boom = -this.right.dy; // hoch = Ausleger heben
    this.axes.steer = 0;
    // Rotator: seitlicher Ausschlag des rechten Sticks als langsame Drehung
    this.axes.rotator = Math.abs(this.right.dx) > 0.4 ? Math.sign(this.right.dx) : 0;
  }
}
