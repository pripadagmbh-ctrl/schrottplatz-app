/**
 * Touch-Steuerung für Tablet und Smartphone (Briefing Kap. 5.1).
 * Aufteilung (Design 2026-08-29):
 *   linker Stick   — X: Oberwagen drehen, Y: Stiel heran/weg
 *   rechter Stick  — X: Spinne öffnen/schließen, Y: Ausleger heben/senken
 *   ↺ / ↻          — Spinne links bzw. rechts drehen (Rotator)
 *   Fadenkreuz     — nur Fahren: vor/zurück und links/rechts lenken (simultan)
 *   Greifen        — großer Knopf links, zusätzlich per festem Fingerdruck
 *   Extras         — Doppeltipp wechselt die Ansicht, Kippen ersetzt das Fadenkreuz
 */
export interface TouchAxes {
  cab: number;
  stick: number;
  boom: number;
  rotator: number;
  drive: number;
  steer: number;
  grab: boolean;
  /** Spinnen-Befehl vom rechten Stick: 1 = schließen, -1 = öffnen, 0 = halten */
  grapple: number;
}

interface StickState {
  id: number | null;
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
  knob: HTMLElement;
}

const RADIUS = 62; // px bis Vollausschlag
/** Ab diesem Druck (0..1) gilt eine Berührung als „festes Drücken" = Greifen */
const PRESSURE_GRAB = 0.55;
/** Neigung in Grad, ab der die Kippsteuerung Vollausschlag gibt */
const TILT_FULL = 22;

export class TouchControls {
  readonly axes: TouchAxes = {
    cab: 0,
    stick: 0,
    boom: 0,
    rotator: 0,
    drive: 0,
    steer: 0,
    grab: false,
    grapple: 0,
  };
  readonly active: boolean;
  /** true, sobald das Gerät echten Druck meldet — dann geht Greifen per Drücken */
  pressureSupported = false;
  private left: StickState | null = null;
  private right: StickState | null = null;
  private pressed = new Set<string>();
  private held = new Set<string>();
  private pressureGrab = false;
  private tiltEnabled = false;
  private tiltDrive = 0;
  private tiltSteer = 0;
  private lastTap = 0;

  constructor(canvas: HTMLElement) {
    this.active = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const root = document.getElementById("touch");
    if (!root) return;
    if (!this.active) {
      root.style.display = "none";
      return;
    }
    root.style.display = "block";
    this.left = this.makeStick("touch-left");
    this.right = this.makeStick("touch-right");
    this.bindHold("btn-grab", "grab");
    this.bindHold("btn-fwd", "fwd");
    this.bindHold("btn-back", "back");
    this.bindHold("btn-left", "left");
    this.bindHold("btn-right", "right");
    this.bindHold("btn-rot-l", "rotL");
    this.bindHold("btn-rot-r", "rotR");
    this.bindTap("btn-view", "KeyC");
    this.bindTap("btn-cab", "KeyX");
    this.bindTap("btn-outrig", "KeyO");
    this.bindTap("btn-press", "KeyB");
    this.bindTap("btn-pickup", "KeyV");
    this.bindTap("btn-marks", "KeyM");
    this.bindTilt();
    this.bindCanvas(canvas);
    TouchControls.blockBrowserZoom();
  }

  /**
   * Browser-Zoom unterbinden: Safari kennt eigene Gesture-Events, und ein
   * schneller Doppeltipp zoomt sonst die Seite, statt die Ansicht zu wechseln.
   */
  private static blockBrowserZoom(): void {
    for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
    // iOS/Android markieren sonst Elemente beim Halten und zeigen ein Kontextmenü
    document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("selectstart", (e) => e.preventDefault(), { passive: false });
    // Mehrfinger-Gesten (Pinch) abfangen
    document.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length > 1) e.preventDefault();
      },
      { passive: false }
    );
    // Ein zweiter Tipp binnen 320 ms würde sonst den Doppeltipp-Zoom auslösen
    let last = 0;
    document.addEventListener(
      "touchend",
      (e) => {
        const now = performance.now();
        if (now - last < 320) e.preventDefault();
        last = now;
      },
      { passive: false }
    );
  }

  private makeStick(id: string): StickState | null {
    const pad = document.getElementById(id);
    if (!pad) return null;
    const knob = pad.querySelector<HTMLElement>(".knob")!;
    const st: StickState = { id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, knob };
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
    pad.addEventListener(
      "pointermove",
      (e) => {
        if (st.id !== e.pointerId) return;
        st.dx = Math.max(-1, Math.min(1, (e.clientX - st.baseX) / RADIUS));
        st.dy = Math.max(-1, Math.min(1, (e.clientY - st.baseY) / RADIUS));
        knob.style.transform = `translate(${st.dx * RADIUS * 0.6}px, ${st.dy * RADIUS * 0.6}px)`;
        e.preventDefault();
      },
      { passive: false }
    );
    const end = (e: PointerEvent): void => {
      if (st.id !== e.pointerId) return;
      st.id = null;
      st.dx = 0;
      st.dy = 0;
      knob.style.transform = "translate(0,0)";
    };
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
    return st;
  }

  private bindHold(id: string, key: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(
      "pointerdown",
      (e) => {
        this.held.add(key);
        el.classList.add("down");
        e.preventDefault();
      },
      { passive: false }
    );
    const up = (): void => {
      this.held.delete(key);
      el.classList.remove("down");
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up);
  }

  private bindTap(id: string, code: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(
      "pointerdown",
      (e) => {
        this.pressed.add(code);
        el.classList.add("down");
        window.setTimeout(() => el.classList.remove("down"), 120);
        e.preventDefault();
      },
      { passive: false }
    );
  }

  /** Kippsteuerung: Gerät neigen statt Fadenkreuz drücken. */
  private bindTilt(): void {
    const el = document.getElementById("btn-tilt");
    if (!el) return;
    el.addEventListener("pointerdown", async (e) => {
      e.preventDefault();
      if (this.tiltEnabled) {
        this.tiltEnabled = false;
        this.tiltDrive = 0;
        this.tiltSteer = 0;
        el.classList.remove("down");
        return;
      }
      // iOS verlangt eine ausdrückliche Freigabe für Bewegungssensoren
      type OrientCtor = { requestPermission?: () => Promise<string> };
      const ctor = (window as unknown as { DeviceOrientationEvent?: OrientCtor })
        .DeviceOrientationEvent;
      if (ctor?.requestPermission) {
        try {
          if ((await ctor.requestPermission()) !== "granted") return;
        } catch {
          return;
        }
      }
      this.tiltEnabled = true;
      el.classList.add("down");
    });
    window.addEventListener("deviceorientation", (e) => {
      if (!this.tiltEnabled) return;
      // beta = vor/zurück kippen, gamma = seitlich kippen (Landscape-Halterung)
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      this.tiltDrive = Math.max(-1, Math.min(1, -(beta - 45) / TILT_FULL));
      this.tiltSteer = Math.max(-1, Math.min(1, gamma / TILT_FULL));
    });
  }

  /**
   * Freie Fläche: fester Druck greift (sofern das Gerät Druck meldet),
   * Doppeltipp wechselt die Ansicht.
   */
  private bindCanvas(canvas: HTMLElement): void {
    const check = (e: PointerEvent): void => {
      if (e.pointerType !== "touch") return;
      // Geräte ohne Kraftsensor melden konstant 0 oder 0.5
      if (e.pressure > 0 && e.pressure !== 0.5) this.pressureSupported = true;
      this.pressureGrab = this.pressureSupported && e.pressure >= PRESSURE_GRAB;
    };
    canvas.addEventListener("pointerdown", (e) => {
      check(e);
      const now = performance.now();
      if (now - this.lastTap < 320) {
        this.pressed.add("KeyC"); // Doppeltipp → Ansicht wechseln
        this.lastTap = 0;
      } else {
        this.lastTap = now;
      }
    });
    canvas.addEventListener("pointermove", check);
    const clear = (): void => {
      this.pressureGrab = false;
    };
    canvas.addEventListener("pointerup", clear);
    canvas.addEventListener("pointercancel", clear);
  }

  consumePress(code: string): boolean {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  update(): void {
    if (!this.active) return;
    const l = this.left;
    const r = this.right;
    // Linker Stick: Oberwagen drehen und Stiel (Y-Achse umgekehrt)
    this.axes.cab = l ? l.dx : 0;
    this.axes.stick = l ? l.dy : 0;
    // Rechter Stick: Spinne öffnen/schließen (X) und Ausleger (Y)
    const gx = r ? r.dx : 0;
    this.axes.grapple = gx > 0.25 ? 1 : gx < -0.25 ? -1 : 0;
    this.axes.boom = r ? r.dy : 0;
    // Rotator liegt auf den beiden Drehtasten
    this.axes.rotator =
      (this.held.has("rotR") ? 1 : 0) - (this.held.has("rotL") ? 1 : 0);
    this.axes.drive =
      (this.held.has("fwd") ? 1 : 0) - (this.held.has("back") ? 1 : 0) + this.tiltDrive;
    this.axes.steer =
      (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0) + this.tiltSteer;
    this.axes.drive = Math.max(-1, Math.min(1, this.axes.drive));
    this.axes.steer = Math.max(-1, Math.min(1, this.axes.steer));
    this.axes.grab = this.held.has("grab") || this.pressureGrab;
  }
}
