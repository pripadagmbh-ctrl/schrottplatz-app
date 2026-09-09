/**
 * Touch-Steuerung für Tablet und Smartphone (Briefing Kap. 5.1).
 * Aufteilung (Design 2026-08-29, Sticks überarbeitet 2026-09-09):
 *   linke Bildhälfte  — X: Oberwagen drehen, Y: Hauptarm heben/senken
 *   rechte Bildhälfte — X: Spinne öffnen/schließen, Y: Ausleger heran/weg
 *   Beide Sticks schweben: Sie sind unsichtbar, erscheinen unter dem Daumen, wo
 *   er aufsetzt, und verschwinden beim Loslassen — kein Zielen auf feste Kreise
 *   mehr (Vorbild Bagerana/v2). Maßgeblich ist die Bildhälfte, nicht der Ort.
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
  pad: HTMLElement;
  knob: HTMLElement;
  /** Zeitpunkt des Aufsetzens — entscheidet, ob daraus ein Tipp wird */
  downT: number;
  /** Wieviel px der Knopf im Kreis wandern darf — aus der Kreisgröße gemessen */
  travel: number;
}

const RADIUS = 62; // px bis Vollausschlag
/** Ab diesem Druck (0..1) gilt eine Berührung als „festes Drücken" = Greifen */
const PRESSURE_GRAB = 0.55;
/** Neigung in Grad, ab der die Kippsteuerung Vollausschlag gibt */
const TILT_FULL = 22;
/** Totzone der Spinnenachse — schützt vor ungewolltem Öffnen beim Baggern */
const GRAPPLE_DEADZONE = 0.38;
/** Ein Aufsetzen zählt nur als Tipp, wenn es kürzer dauert und der Finger kaum wandert */
const TAP_MAX_MS = 250;
const TAP_MAX_MOVE = 12;
/** Zwei Tipps am selben Ort binnen dieser Zeit = Doppeltipp (Ansicht wechseln) */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_RADIUS = 60;

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
  private lastTapX = 0;
  private lastTapY = 0;

  constructor(canvas: HTMLElement) {
    this.active = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    const root = document.getElementById("touch");
    if (!root) return;
    if (!this.active) {
      root.style.display = "none";
      return;
    }
    root.style.display = "block";
    // Merkmal fuers Stylesheet: nur auf Touchgeraeten sitzt die Tutorialkarte oben
    document.body.classList.add("touch");
    this.left = this.makeStick("touch-left", "zone-left");
    this.right = this.makeStick("touch-right", "zone-right");
    this.bindSafety();
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

  /**
   * Schwebender Stick: Aufsetzfläche ist die halbe Bildbreite. Wo der Daumen
   * landet, wird der Kreis hingesetzt und eingeblendet; beim Loslassen
   * verschwindet er. Nullpunkt ist der Aufsetzpunkt, nicht die Kreismitte —
   * dadurch springt nichts, egal wo der Finger aufkommt. Den Zeiger fängt die
   * Zone ein, damit der Stick weiterläuft, wenn der Daumen über den Kreisrand
   * oder in die andere Bildhälfte wandert.
   */
  private makeStick(padId: string, zoneId: string): StickState | null {
    const pad = document.getElementById(padId);
    const zone = document.getElementById(zoneId);
    if (!pad || !zone) return null;
    const knob = pad.querySelector<HTMLElement>(".knob")!;
    const st: StickState = {
      id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, pad, knob, travel: 0, downT: 0,
    };
    zone.addEventListener(
      "pointerdown",
      (e) => {
        if (st.id !== null) return; // ein Finger je Bildhälfte
        st.id = e.pointerId;
        st.baseX = e.clientX;
        st.baseY = e.clientY;
        st.dx = 0;
        st.dy = 0;
        st.downT = performance.now();
        pad.hidden = false;
        pad.style.left = `${e.clientX}px`;
        pad.style.top = `${e.clientY}px`;
        // Erst nach dem Einblenden messen — versteckt ist die Breite 0.
        st.travel = Math.max(0, pad.offsetWidth / 2 - knob.offsetWidth / 2 - 2);
        knob.style.transform = "translate(0,0)";
        zone.setPointerCapture(e.pointerId);
        this.checkPressure(e);
        e.preventDefault();
      },
      { passive: false }
    );
    zone.addEventListener(
      "pointermove",
      (e) => {
        if (st.id !== e.pointerId) return;
        st.dx = clamp1((e.clientX - st.baseX) / RADIUS);
        st.dy = clamp1((e.clientY - st.baseY) / RADIUS);
        knob.style.transform = `translate(${st.dx * st.travel}px, ${st.dy * st.travel}px)`;
        this.checkPressure(e);
        e.preventDefault();
      },
      { passive: false }
    );
    zone.addEventListener("pointerup", (e) => {
      if (st.id !== e.pointerId) return;
      const dauer = performance.now() - st.downT;
      const weg = Math.hypot(e.clientX - st.baseX, e.clientY - st.baseY);
      if (dauer < TAP_MAX_MS && weg < TAP_MAX_MOVE) this.registerTap(e.clientX, e.clientY);
      TouchControls.resetStick(st);
      this.pressureGrab = false;
    });
    const abbruch = (e: PointerEvent): void => {
      if (st.id !== e.pointerId) return;
      TouchControls.resetStick(st);
      this.pressureGrab = false;
    };
    zone.addEventListener("pointercancel", abbruch);
    // Verliert die Zone den Zeiger (Systemgeste, App-Wechsel), bliebe der Stick sonst stehen
    zone.addEventListener("lostpointercapture", abbruch);
    return st;
  }

  /** Stick auf Null stellen und ausblenden. */
  private static resetStick(st: StickState): void {
    st.id = null;
    st.dx = 0;
    st.dy = 0;
    st.knob.style.transform = "translate(0,0)";
    st.pad.hidden = true;
  }

  /**
   * Doppeltipp = Ansicht wechseln. Die Ortsprüfung ist wichtig, seit die Sticks
   * überall aufsetzen dürfen: ohne sie gälten linker und rechter Daumen kurz
   * nacheinander als Doppeltipp und die Kamera spränge beim Baggern ständig um.
   */
  private registerTap(x: number, y: number): void {
    const now = performance.now();
    const nah = Math.hypot(x - this.lastTapX, y - this.lastTapY) < DOUBLE_TAP_RADIUS;
    if (now - this.lastTap < DOUBLE_TAP_MS && nah) {
      this.pressed.add("KeyC");
      this.lastTap = 0;
      return;
    }
    this.lastTap = now;
    this.lastTapX = x;
    this.lastTapY = y;
  }

  /**
   * Sicherung gegen „Geister-Zeiger": Verschluckt der Browser ein pointerup
   * (Systemgeste, App-Wechsel, abgebrochene Mehrfingergeste), bliebe die
   * Bildhälfte mit der alten Zeiger-ID belegt und nähme keinen neuen Finger
   * mehr an. Deshalb: kein Finger mehr auf dem Glas → alles loslassen.
   */
  private bindSafety(): void {
    const allesLos = (e: Event): void => {
      if ((e as TouchEvent).touches.length === 0) this.releaseAll();
    };
    document.addEventListener("touchend", allesLos, { passive: true });
    document.addEventListener("touchcancel", allesLos, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });
  }

  /** Beide Sticks, alle Halteknöpfe und das Druck-Greifen loslassen. */
  releaseAll(): void {
    for (const st of [this.left, this.right]) if (st) TouchControls.resetStick(st);
    this.held.clear();
    this.pressureGrab = false;
    for (const id of ["btn-fwd", "btn-back", "btn-left", "btn-right", "btn-rot-l", "btn-rot-r"]) {
      document.getElementById(id)?.classList.remove("down");
    }
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
   * Druckmessung fürs Greifen. Geräte ohne Kraftsensor melden konstant 0 oder
   * 0,5 — erst ein anderer Wert beweist, dass echter Druck ankommt.
   */
  private checkPressure(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    if (e.pressure > 0 && e.pressure !== 0.5) this.pressureSupported = true;
    this.pressureGrab = this.pressureSupported && e.pressure >= PRESSURE_GRAB;
  }

  /**
   * Die Leinwand selbst bekommt auf Touchgeräten kaum noch Zeiger — die beiden
   * Stick-Zonen liegen darüber, seit die Sticks überall aufsetzen dürfen. Die
   * Bindung bleibt für den Rest: Druck greift auch dann, wenn ein Finger doch
   * einmal direkt auf der Leinwand landet (Zonen ausgeblendet, Maus mit Stift).
   * Doppeltipp und Sticks laufen über die Zonen.
   */
  private bindCanvas(canvas: HTMLElement): void {
    canvas.addEventListener("pointerdown", (e) => this.checkPressure(e));
    canvas.addEventListener("pointermove", (e) => this.checkPressure(e));
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
