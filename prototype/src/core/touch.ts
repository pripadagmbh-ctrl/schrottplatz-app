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
 *   FAHREN         — Umschalter: solange er an ist, wird der linke Stick zu Gas
 *                    (Y) und Lenkung (X). Endet von selbst nach vier Sekunden
 *                    ohne Daumen auf dem linken Stick.
 *   Greifen        — über den rechten Stick (oder festen Fingerdruck)
 *   Extras         — Doppeltipp wechselt die Ansicht, Kippen fährt ohne Stick
 *   Rädchen        — die übrigen Funktionen, endlos drehbar
 *   Fünf Finger    — Debug-Overlay ein/aus (auf dem Tablet gibt es keine F3-Taste)
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
/** So lange darf der linke Stick unberuehrt bleiben, bevor der Fahrmodus endet */
const DRIVE_AUTO_EXIT_S = 4;
/** Bis hierhin gilt eine Berührung des Rädchens als Tipp, darüber als Blättern (px) */
/** So lange muss der rechte Daumen stillhalten, bis der Kranz aufklappt */
const RADIAL_HOLD_S = 0.4;
/** Halbmesser des Kranzes in px */
const RADIAL_R = 104;
/** Ab diesem Zugweg gilt eine Richtung als gewaehlt */
const RADIAL_MIN_PX = 34;
/** Bis hierhin gilt der Daumen als stillgehalten (Anteil des Vollausschlags) */
const RADIAL_STILL = 0.14;
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
  /**
   * Fahrmodus (Vorbild v2). Vier feste Pfeiltasten waren auf dem Glas schlecht
   * zu treffen, und man konnte nicht gleichzeitig lenken und den Arm bewegen.
   * Jetzt uebernimmt der linke Stick das Fahren, solange der Modus laeuft.
   */
  private driveMode = false;
  private driveIdleS = 0;
  private radialEl: HTMLElement | null = null;
  private radialItems: Array<{ el: HTMLElement; code: string }> = [];
  private radialSel = -1;
  private radialOpen = false;
  private radialHoldS = 0;
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
    this.bindDebugGeste();
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
    this.bindTap("btn-tilt", "TILT");
    this.bindMenu();
    this.buildRadial();
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
   * Bestätigung beim Auslösen eines Eintrags. Auf Android vibriert das Gerät
   * zusätzlich; iOS Safari kennt keine Vibrations-Schnittstelle, dort ist der
   * Ton die einzige Rückmeldung, die eine Webseite geben kann.
   */
  onTap: (() => void) | null = null;

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
      if (st === this.right && this.radialOpen) {
        // Gezogen und losgelassen waehlt; nur losgelassen schliesst folgenlos
        const gewaehlt = this.radialItems[this.radialSel];
        if (gewaehlt) this.fire(gewaehlt.code);
        this.radialOpen = false;
        this.radialHoldS = 0;
        this.closeRadial();
      } else {
        const dauer = performance.now() - st.downT;
        const weg = Math.hypot(e.clientX - st.baseX, e.clientY - st.baseY);
        if (dauer < TAP_MAX_MS && weg < TAP_MAX_MOVE) {
          this.registerTap(e.clientX, e.clientY, st === this.left);
        }
      }
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
  private registerTap(x: number, y: number, links: boolean): void {
    const now = performance.now();
    const nah = Math.hypot(x - this.lastTapX, y - this.lastTapY) < DOUBLE_TAP_RADIUS;
    if (now - this.lastTap < DOUBLE_TAP_MS && nah) {
      // Links doppelt: Fahren an/aus — dort liegt der Fahrdaumen ohnehin, und
      // ein Knopf an dieser Stelle wurde staendig versehentlich getroffen.
      // Rechts doppelt: Ansicht wechseln, wie bisher.
      if (links) this.setDrive(!this.driveMode);
      else this.pressed.add("KeyC");
      this.onTap?.();
      this.lastTap = 0;
      return;
    }
    this.lastTap = now;
    this.lastTapX = x;
    this.lastTapY = y;
  }

  /**
   * Fünf Finger gleichzeitig schalten das Debug-Overlay um. Am Rechner liegt es
   * auf F3 — die hat ein Tablet nicht, und ohne die Zahlen laesst sich auf dem
   * Geraet nichts nachmessen. Fuenf Finger deshalb, weil kein Spielgriff so
   * viele braucht: mit zweien steuert man, mit dreien verrutscht man mal.
   */
  private bindDebugGeste(): void {
    document.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length >= 5) {
          this.pressed.add("F3");
          TouchControls.vibrate(30);
          this.releaseAll(); // die fuenf Finger sollen nichts am Bagger verstellen
        }
      },
      { passive: true }
    );
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
    if (this.radialOpen) {
      this.radialOpen = false;
      this.closeRadial();
    }
    this.radialHoldS = 0;
    for (const id of ["btn-rot-l", "btn-rot-r"]) {
      document.getElementById(id)?.classList.remove("down");
    }
  }

  /** FAHREN-Umschalter. Tippen schaltet um, die Taste faerbt sich. */
  private setDrive(v: boolean): void {
    this.driveMode = v;
    this.driveIdleS = 0;
    TouchControls.vibrate(v ? 18 : 9);
    this.onDriveMode?.(v);
  }

  /** Wechsel des Fahrmodus melden — main zeigt es in der Griff-Info an. */
  onDriveMode: ((an: boolean) => void) | null = null;

  /** true, solange der linke Stick fahrt statt den Arm bewegt. */
  get isDriveMode(): boolean {
    return this.driveMode;
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

  /**
   * Eintrag des Funktionsrädchens mit einer Taste verbinden.
   *
   * Ausgelöst wird NICHT hier, sondern beim Loslassen im Rädchen selbst — und
   * nur, wenn der Finger dabei kaum gewandert ist. Vorher hing die Auslösung am
   * pointerdown des Eintrags: Weil das Rädchen den Zeiger einfängt, sobald man
   * es dreht, galt jedes Wischen zugleich als Tipp auf den scharfgestellten
   * Eintrag. Man wollte blättern und löste aus.
   */
  private bindTap(id: string, code: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset["action"] = code;
  }

  /** Eintrag auslösen. */
  private fire(code: string): void {
    if (code === "TILT") {
      void this.toggleTilt();
      TouchControls.vibrate(22);
      this.onTap?.();
      return;
    }
    this.pressed.add(code);
    TouchControls.vibrate(22); // spürbar, wo das Gerät es kann
    this.onTap?.(); // hörbar überall — auf iOS die einzige Rückmeldung
  }

  /**
   * Funktionskranz am rechten Joystickkopf.
   *
   * Feste Knöpfe auf dem Glas werden versehentlich bedient — sie liegen dort,
   * wo die Daumen ohnehin sind. In einer echten Maschine liegt nichts im Weg:
   * Die Funktionen sitzen auf der Konsole und auf den Joystickköpfen. Hier
   * genauso: Rechten Daumen kurz stillhalten, der Kranz klappt um ihn auf. In
   * eine Richtung ziehen und loslassen wählt; loslassen ohne zu ziehen
   * schliesst folgenlos.
   */
  private buildRadial(): void {
    const el = document.getElementById("radial");
    // Nur der erste Traegerblock kommt in den Kranz; #menu-actions liegt
    // hinter dem Menueknopf.
    const traeger = Array.from(
      document.querySelectorAll<HTMLElement>(".hidden-actions:not(#menu-actions) span")
    );
    if (!el || traeger.length === 0) return;
    this.radialEl = el;
    for (const t of traeger) {
      const code = t.dataset["action"];
      if (!code) continue;
      const sektor = document.createElement("div");
      sektor.className = "sektor";
      sektor.textContent = t.textContent ?? "";
      el.appendChild(sektor);
      this.radialItems.push({ el: sektor, code });
    }
    const nabe = document.createElement("div");
    nabe.className = "nabe";
    el.appendChild(nabe);
    // Sektoren einmal auf dem Kreis verteilen — die Lage aendert sich nie
    const n = this.radialItems.length;
    this.radialItems.forEach((it, i) => {
      const a = (i / n) * Math.PI * 2; // 0 = oben, im Uhrzeigersinn
      it.el.style.left = `${Math.sin(a) * RADIAL_R}px`;
      it.el.style.top = `${-Math.cos(a) * RADIAL_R}px`;
    });
  }

  /** Menüknopf oben rechts: öffnet die Pause. */
  private bindMenu(): void {
    const el = document.getElementById("btn-menu");
    if (!el) return;
    el.addEventListener(
      "pointerup",
      (e) => {
        this.fire("Escape");
        e.preventDefault();
      },
      { passive: false }
    );
  }

  private openRadial(x: number, y: number): void {
    if (!this.radialEl) return;
    this.radialEl.style.left = `${x}px`;
    this.radialEl.style.top = `${y}px`;
    this.radialEl.hidden = false;
    this.radialSel = -1;
    for (const it of this.radialItems) it.el.classList.remove("sel");
    TouchControls.vibrate(14);
    this.onTap?.();
  }

  private closeRadial(): void {
    if (this.radialEl) this.radialEl.hidden = true;
    this.radialSel = -1;
  }

  /** Auswahl aus der Zugrichtung des Daumens. -1 = nichts gewählt. */
  private radialPick(dx: number, dy: number): number {
    const weg = Math.hypot(dx, dy) * RADIUS;
    if (weg < RADIAL_MIN_PX) return -1;
    const n = this.radialItems.length;
    const winkel = Math.atan2(dx, -dy); // 0 = oben
    const i = Math.round((winkel / (Math.PI * 2)) * n);
    return ((i % n) + n) % n;
  }

  /**
   * Kippsteuerung: Gerät neigen statt den linken Stick zum Fahren zu nehmen.
   *
   * Sie haengt jetzt als Eintrag im Kranz, nicht mehr an einem eigenen Knopf —
   * den gibt es nicht mehr. Die Freigabe der Bewegungssensoren verlangt auf iOS
   * eine Nutzergeste; das Auswaehlen im Kranz ist eine.
   */
  private async toggleTilt(): Promise<void> {
    if (this.tiltEnabled) {
      this.tiltEnabled = false;
      this.tiltDrive = 0;
      this.tiltSteer = 0;
      return;
    }
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
  }

  private bindTilt(): void {
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

  update(dt = 1 / 60): void {
    if (!this.active) return;
    const l = this.left;
    const r = this.right;
    // Fahrmodus endet von selbst: Wer den Daumen vom linken Stick nimmt, will
    // in aller Regel wieder baggern. Ohne das bleibt der Modus an, und der
    // naechste Griff an den Stick faehrt die Maschine statt den Arm zu heben.
    // Funktionskranz: rechten Daumen stillhalten laesst ihn aufklappen
    if (r && r.id !== null) {
      const still = Math.hypot(r.dx, r.dy) < RADIAL_STILL;
      if (!this.radialOpen) {
        // Wer den Stick bewegt, will arbeiten — dann keine Uhr
        this.radialHoldS = still ? this.radialHoldS + dt : 0;
        if (this.radialHoldS >= RADIAL_HOLD_S) {
          this.radialOpen = true;
          this.openRadial(r.baseX, r.baseY);
        }
      } else {
        const wahl = this.radialPick(r.dx, r.dy);
        if (wahl !== this.radialSel) {
          this.radialItems[this.radialSel]?.el.classList.remove("sel");
          this.radialItems[wahl]?.el.classList.add("sel");
          this.radialSel = wahl;
          if (wahl >= 0) TouchControls.vibrate(9);
        }
      }
    } else {
      this.radialHoldS = 0;
    }

    if (this.driveMode) {
      if (l && l.id === null) {
        this.driveIdleS += dt;
        if (this.driveIdleS > DRIVE_AUTO_EXIT_S) this.setDrive(false);
      } else {
        this.driveIdleS = 0;
      }
    }
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
      // Im Fahrmodus gehoert der linke Stick dem Fahrwerk — die eingestellte
      // Belegung ruht so lange.
      if (this.driveMode && (id === "leftX" || id === "leftY")) continue;
      // Solange der Kranz offen ist, waehlt der rechte Stick aus, statt zu
      // steuern — sonst faehrt beim Auswaehlen der Arm mit.
      if (this.radialOpen && (id === "rightX" || id === "rightY")) continue;
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
    // Fahren: linker Stick im Fahrmodus, dazu weiterhin die Kippsteuerung
    const fahrY = this.driveMode && l ? -l.dy : 0; // Stick nach oben = vorwaerts
    const fahrX = this.driveMode && l ? l.dx : 0;
    this.axes.drive = fahrY + this.tiltDrive;
    this.axes.steer = fahrX + this.tiltSteer;
    this.axes.drive = clamp1(this.axes.drive);
    this.axes.steer = clamp1(this.axes.steer);
    this.axes.boom = clamp1(this.axes.boom);
    this.axes.stick = clamp1(this.axes.stick);
    this.axes.cab = clamp1(this.axes.cab);
    this.axes.grapple = clamp1(this.axes.grapple);
    this.axes.grab = this.pressureGrab;
  }
}
