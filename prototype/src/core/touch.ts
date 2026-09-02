/**
 * Touch-Steuerung für Tablet und Smartphone (Briefing Kap. 5.1).
 * Aufteilung (Design 2026-08-29):
 *   linker Stick   — X: Oberwagen drehen, Y: Hauptarm heben/senken
 *   rechter Stick  — X: Spinne öffnen/schließen, Y: Ausleger heran/weg
 *   (alle vier Achsen sind im Steuerungsmenü frei belegbar)
 *   ↺ / ↻          — Spinne links bzw. rechts drehen (Rotator)
 *   Fadenkreuz     — nur Fahren: vor/zurück und links/rechts lenken (simultan)
 *   Greifen        — über den rechten Stick (oder festen Fingerdruck)
 *   Extras         — Doppeltipp wechselt die Ansicht, Kippen ersetzt das Fadenkreuz
 *   Rädchen        — die übrigen Funktionen, endlos drehbar
 */
import { type ControlConfig, type AxisId, loadConfig } from "./controlConfig";

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
/** Totzone der Spinnenachse — schützt vor ungewolltem Öffnen beim Baggern */
const GRAPPLE_DEADZONE = 0.38;

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

export class TouchControls {
  /** Achsenbelegung — vom Steuerungsmenü geändert, im Browser gespeichert */
  config: ControlConfig = loadConfig();
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
    this.bindHold("btn-fwd", "fwd");
    this.bindHold("btn-back", "back");
    this.bindHold("btn-left", "left");
    this.bindHold("btn-right", "right");
    this.bindHold("btn-rot-l", "rotL");
    this.bindHold("btn-rot-r", "rotR");
    this.bindTap("btn-cab", "KeyX");
    this.bindTap("btn-outrig", "KeyO");
    this.bindTap("btn-press", "KeyB");
    this.bindTap("btn-pickup", "KeyV");
    this.bindTap("btn-marks", "KeyM");
    this.bindTap("btn-away", "KeyJ");
    this.bindTap("btn-blade", "KeyI");
    this.bindTap("btn-music", "KeyU");
    this.bindTap("btn-shop", "KeyZ");
    this.bindTap("btn-pause", "Escape");
    this.buildWheel();
    this.bindTilt();
    this.bindCanvas(canvas);
    TouchControls.blockBrowserZoom();
  }

  /**
   * Kurzer Vibrationsimpuls, wo das Gerät ihn kann. Android liefert ihn über
   * die Vibrations-Schnittstelle; iOS kennt sie nicht, dort bleibt es beim
   * Klickgeräusch. Fehler werden geschluckt — Haptik ist Beiwerk.
   */
  private static vibrate(ms: number): void {
    try {
      navigator.vibrate?.(ms);
    } catch {
      // manche Browser werfen ohne vorherige Nutzergeste
    }
  }

  /** Rastklick des Rädchens — von main mit dem Audiosystem verbunden. */
  onWheelTick: (() => void) | null = null;

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
        TouchControls.vibrate(22); // spürbare Bestätigung
        el.classList.add("down");
        window.setTimeout(() => el.classList.remove("down"), 120);
        e.preventDefault();
      },
      { passive: false }
    );
  }

  /**
   * Funktionsrädchen: Die Tasten sitzen auf einer gedachten Walze. Wischen
   * dreht sie, der Eintrag in der Mitte ist scharfgestellt und lässt sich
   * antippen. So bleibt die Liste kurz, egal wie viele Funktionen dazukommen
   * (Design 29.08.2026).
   */
  private buildWheel(): void {
    const bar = document.getElementById("fnbar");
    if (!bar) return;
    const items = Array.prototype.slice.call(
      bar.querySelectorAll(".btn")
    ) as HTMLElement[];
    if (items.length === 0) return;
    const n = items.length;
    // Eng gestaffelt, damit mehrere Befehle gleichzeitig lesbar sind. Die
    // Walze dreht trotzdem endlos: der Sprung vom letzten zum ersten Eintrag
    // passiert auf der abgewandten Seite und ist ausgeblendet.
    const STEP = 23; // Grad zwischen zwei Einträgen
    const RADIUS = 92; // px — bestimmt, wie stark die Walze wölbt
    let pos = 0; // aktuelle Position in Einträgen, darf zwischen zwei liegen

    /** Kürzester Abstand von Eintrag i zur aktuellen Position, rundherum. */
    const ringAbstand = (i: number): number => {
      let d = (((i - pos) % n) + n) % n;
      if (d > n / 2) d -= n;
      return d;
    };

    const render = (): void => {
      const sel = ((Math.round(pos) % n) + n) % n;
      items.forEach((el, i) => {
        const d = ringAbstand(i);
        const ang = d * STEP;
        // Rückseite der Walze wegblenden
        const sichtbar = Math.abs(ang) < 78;
        el.style.transform = `rotateX(${-ang}deg) translateZ(${RADIUS}px)`;
        el.style.opacity = sichtbar ? String(Math.max(0.25, 1 - Math.abs(d) / 3.4)) : "0";
        el.classList.toggle("sel", i === sel);
      });
    };

    /** Beim Überrasten fühlbar und hörbar quittieren. */
    let letzterRast = 0;
    const drehen = (delta: number): void => {
      pos = (((pos + delta) % n) + n) % n;
      const rast = Math.round(pos);
      if (rast !== letzterRast) {
        letzterRast = rast;
        TouchControls.vibrate(9);
        this.onWheelTick?.();
      }
      render();
    };

    /**
     * Nachlauf: Nach dem Loslassen dreht die Walze mit dem aufgenommenen
     * Schwung weiter aus und rastet dann sanft ein. Das macht den Unterschied
     * zwischen „Liste schieben" und einem Rad, das sich gut anfühlt.
     */
    let schwung = 0;
    let laeuft = false;
    const ausrollen = (): void => {
      if (Math.abs(schwung) > 0.004) {
        drehen(schwung);
        schwung *= 0.92;
        requestAnimationFrame(ausrollen);
        return;
      }
      // sanft auf die nächste Rastung ziehen
      const ziel = Math.round(pos);
      const rest = ziel - pos;
      if (Math.abs(rest) > 0.004) {
        pos += rest * 0.25;
        render();
        requestAnimationFrame(ausrollen);
        return;
      }
      pos = (((ziel % n) + n) % n);
      render();
      laeuft = false;
    };

    // Wischen: ein Eintrag je 34 px
    let dragId: number | null = null;
    let lastY = 0;
    let moved = 0;
    bar.addEventListener(
      "pointerdown",
      (e) => {
        dragId = e.pointerId;
        lastY = e.clientY;
        moved = 0;
        schwung = 0;
        laeuft = false;
        bar.setPointerCapture?.(e.pointerId);
      },
      { passive: true }
    );
    bar.addEventListener(
      "pointermove",
      (e) => {
        if (dragId !== e.pointerId) return;
        const dy = e.clientY - lastY;
        lastY = e.clientY;
        moved += Math.abs(dy);
        const schritt = -dy / 30;
        schwung = schwung * 0.6 + schritt * 0.4; // geglättet, für den Nachlauf
        drehen(schritt);
        e.preventDefault();
      },
      { passive: false }
    );
    const ende = (e: PointerEvent): void => {
      if (dragId !== e.pointerId) return;
      dragId = null;
      // Mit Schwung ausrollen statt hart einzurasten
      if (!laeuft) {
        laeuft = true;
        requestAnimationFrame(ausrollen);
      }
    };
    bar.addEventListener("pointerup", ende);
    bar.addEventListener("pointercancel", ende);
    // Mausrad für den Test am Rechner
    bar.addEventListener(
      "wheel",
      (e) => {
        drehen(Math.sign(e.deltaY));
        e.preventDefault();
      },
      { passive: false }
    );
    render();
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
    // Die vier Stickachsen sind frei belegbar (Steuerungsmenü). Werkseinstellung:
    // Hauptarm und Oberwagen links, Ausleger und Spinne rechts.
    this.axes.cab = 0;
    this.axes.boom = 0;
    this.axes.stick = 0;
    this.axes.grapple = 0;
    let rotAxis = 0;
    const raw: Record<AxisId, number> = {
      leftY: l ? l.dy : 0,
      leftX: l ? l.dx : 0,
      rightY: r ? r.dy : 0,
      rightX: r ? r.dx : 0,
    };
    for (const id of ["leftY", "leftX", "rightY", "rightX"] as AxisId[]) {
      const b = this.config[id];
      const v = raw[id] * (b.invert ? -1 : 1);
      switch (b.fn) {
        case "boom":
          this.axes.boom += v;
          break;
        case "stick":
          this.axes.stick += v;
          break;
        case "cab":
          this.axes.cab += v;
          break;
        case "grapple": {
          // Die Spinne braucht eine großzügige Totzone: beim Ziehen am
          // Ausleger rutscht der Daumen leicht zur Seite, und die Schalen
          // gingen dann ungewollt auf. Zusätzlich wird die Querachse gedämpft,
          // solange die Längsachse desselben Sticks stark ausgelenkt ist —
          // bewusste Diagonalbewegungen bleiben trotzdem möglich.
          const quer = id === "leftX" || id === "rightX";
          const laengs = Math.abs(quer ? (id === "leftX" ? raw.leftY : raw.rightY) : 0);
          const eff = v * (1 - Math.min(laengs, 1) * 0.5);
          if (Math.abs(eff) > GRAPPLE_DEADZONE) this.axes.grapple += eff;
          break;
        }
        case "rotator":
          rotAxis += v;
          break;
        default:
          break;
      }
    }
    // Rotator: Drehtasten, zusätzlich eine Stickachse, falls so belegt
    this.axes.rotator = clamp1(
      (this.held.has("rotR") ? 1 : 0) - (this.held.has("rotL") ? 1 : 0) + rotAxis
    );
    this.axes.drive =
      (this.held.has("fwd") ? 1 : 0) - (this.held.has("back") ? 1 : 0) + this.tiltDrive;
    this.axes.steer =
      (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0) + this.tiltSteer;
    this.axes.drive = clamp1(this.axes.drive);
    this.axes.steer = clamp1(this.axes.steer);
    this.axes.boom = clamp1(this.axes.boom);
    this.axes.stick = clamp1(this.axes.stick);
    this.axes.cab = clamp1(this.axes.cab);
    this.axes.grapple = clamp1(this.axes.grapple);
    this.axes.grab = this.pressureGrab;
  }
}
