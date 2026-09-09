import type { ControlFrame } from "@/sim/control/ControlFrame";
import type { ControlsFile } from "@/data/types";
import { TapDetector } from "./TapDetector";

/**
 * Touch → ControlFrame (Briefing Kap. 5.2, Stilguide Kap. 2; Rückfrage M3-1).
 *  - Zwei „floating" Sticks: erscheinen dort, wo der Daumen in der linken bzw. rechten 40 %-Zone aufsetzt.
 *    Links: X Oberwagen, Y Hauptarm. Rechts: Y Stiel, X Spinne (rechts = schließen, links = öffnen, neutral = halten)
 *    mit asymmetrischer Totzone (Schließen ab 0,3, Öffnen ab 0,6 — Öffnen darf nicht aus Versehen passieren).
 *  - FAHREN-Toggle über dem linken Stick: dann Y = Gas/Bremse, X = Lenkung. Endet automatisch nach 4 s ohne Finger auf dem linken Stick.
 *  - ↺ ↻ über dem rechten Stick: Rotator, solange gehalten.
 *  - Mittlerer Streifen zwischen den Zonen: ein Finger wischt = Kamera-Orbit, zwei Finger = Pinch-Zoom.
 *  - Ansicht wechseln: ⌖ oder Doppeltipp irgendwo. Doppeltipp = zwei kurze (< tapMaxMs), unbewegte (< tapMaxMovePx) Tipps
 *    am selben Ort (< doubleTapRadiusPx) innerhalb doubleTapMs. Die Ortsprüfung fehlte im ersten Wurf — linker und rechter
 *    Daumen nacheinander galten als Doppeltipp und die Kamera sprang ständig (Gerätetest 08.09., Wunsch Patrick: Doppeltipp behalten).
 *  - Alle Tippziele ≥ 44 px; Positionen relativ zur Safe-Area (CSS env()). Kompaktlayout unter 700 px Breite.
 * Nur DOM + Zahlen; keine Spiellogik. Pointer-Capture, damit ein Stick beim Verlassen des Kreises aktiv bleibt.
 */
interface Stick { el: HTMLElement; knob: HTMLElement; pointerId: number | null; cx: number; cy: number; x: number; y: number; radius: number; }

export class TouchAdapter {
  readonly root: HTMLElement;
  private left: Stick; private right: Stick;
  private driveMode = false; private driveIdleS = 0;
  private rotL = false; private rotR = false;
  private orbitDx = 0; private orbitDy = 0; private zoom = 0;
  private freePointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private readonly taps: TapDetector;
  private pressedActions = new Set<string>();
  private readonly deadzone: number; private readonly closeDz: number; private readonly openDz: number; private readonly cross: number;
  private readonly unsubs: (() => void)[] = [];
  private readonly orbitSens: number; private readonly pinchSens: number;
  private readonly driveAutoExitS: number;

  constructor(parent: HTMLElement, controls: ControlsFile) {
    const t = controls.touch as Record<string, number | string>;
    this.deadzone = controls.deadzone; this.closeDz = Number(t["grapCloseDeadzone"] ?? 0.3); this.openDz = Number(t["grapOpenDeadzone"] ?? 0.6);
    this.cross = Number(t["stickCrossDamping"] ?? 0.35);
    this.orbitSens = Number(t["cameraOrbitSensitivity"] ?? 0.004); this.pinchSens = Number(t["pinchZoomSensitivity"] ?? 1);
    this.driveAutoExitS = Number(t["driveModeAutoExitS"] ?? 4);
    this.taps = new TapDetector({ doubleTapMs: Number(t["doubleTapMs"] ?? 300), doubleTapRadiusPx: Number(t["doubleTapRadiusPx"] ?? 40), tapMaxMs: Number(t["tapMaxMs"] ?? 250), tapMaxMovePx: Number(t["tapMaxMovePx"] ?? 12) });
    const compact = window.innerWidth < Number(t["compactMaxWidthPx"] ?? 700);
    const stickPx = compact ? Number(t["stickDiameterCompactPx"] ?? 100) : Number(t["stickDiameterPx"] ?? 120);

    this.root = document.createElement("div");
    this.root.id = "touch-layer";
    this.root.classList.toggle("compact", compact);
    this.root.style.setProperty("--stick", `${stickPx}px`);
    this.root.style.setProperty("--knob", `${Number(t["stickKnobPx"] ?? 52)}px`);
    this.root.style.setProperty("--grab", `${Number(t["grabButtonPx"] ?? 76)}px`);
    this.root.style.setProperty("--rot", `${Number(t["rotatorButtonPx"] ?? 48)}px`);
    this.root.style.setProperty("--drive", `${Number(t["driveModeButtonPx"] ?? 56)}px`);
    this.root.innerHTML = `
      <div class="zone zone-left" data-zone="left"></div>
      <div class="zone zone-right" data-zone="right"></div>
      <div class="zone zone-cam" data-zone="cam"></div>
      <div class="stick" id="stick-left" hidden><div class="knob"></div></div>
      <div class="stick" id="stick-right" hidden><div class="knob"></div></div>
      <button type="button" class="tbtn" id="btn-drive" aria-label="Fahren">FAHREN</button>
      <button type="button" class="tbtn rot" id="btn-rot-l" aria-label="Spinne links drehen">↺</button>
      <button type="button" class="tbtn rot" id="btn-rot-r" aria-label="Spinne rechts drehen">↻</button>
      <button type="button" class="tbtn top" id="btn-camera" aria-label="Ansicht wechseln">⌖</button>
      <div class="hint" id="touch-hint">L: drehen · heben &nbsp; R: Stiel · Spinne ▶ zu ◀ auf</div>`;
    parent.appendChild(this.root);
    const mk = (id: string): Stick => { const el = this.root.querySelector<HTMLElement>(`#${id}`)!; return { el, knob: el.querySelector<HTMLElement>(".knob")!, pointerId: null, cx: 0, cy: 0, x: 0, y: 0, radius: stickPx / 2 }; };
    this.left = mk("stick-left"); this.right = mk("stick-right");

    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts); this.unsubs.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    for (const zone of this.root.querySelectorAll<HTMLElement>(".zone-left, .zone-right")) {
      on(zone, "pointerdown", (e) => { const s = zone.dataset["zone"] === "left" ? this.left : this.right; if (s.pointerId !== null) return; this.beginStick(s, e); zone.setPointerCapture(e.pointerId); e.preventDefault(); });
      on(zone, "pointermove", (e) => this.moveStick(e));
      on(zone, "pointerup", (e) => this.endStick(e)); on(zone, "pointercancel", (e) => this.endStick(e));
      on(zone, "lostpointercapture", (e) => this.endStick(e));
    }
    // Sicherung gegen „Geister-Zeiger" (iPad-Test 09.09.: linker Stick blieb stehen, Oberwagen liess sich nicht mehr drehen):
    // Verpasst Safari ein pointerup (Systemgeste, App-Wechsel, Multitouch-Abbruch), bliebe der Stick mit alter Zeiger-ID
    // belegt und ignorierte jeden neuen Finger. Deshalb: kein Finger mehr auf dem Glas → alles loslassen. Das Touch-Ereignis
    // zaehlt die echten Finger, unabhaengig von der Pointer-Buchfuehrung.
    const docOn = (ev: string, fn: (e: Event) => void) => { document.addEventListener(ev, fn, { passive: true }); this.unsubs.push(() => document.removeEventListener(ev, fn)); };
    const allUp = (e: Event) => { if ((e as TouchEvent).touches.length === 0) this.releaseAll(); };
    docOn("touchend", allUp); docOn("touchcancel", allUp);
    docOn("visibilitychange", () => { if (document.hidden) this.releaseAll(); });
    const hold = (id: string, set: (v: boolean) => void) => { const b = this.root.querySelector<HTMLElement>(`#${id}`)!; on(b, "pointerdown", (e) => { set(true); b.setPointerCapture(e.pointerId); e.preventDefault(); }); on(b, "pointerup", () => set(false)); on(b, "pointercancel", () => set(false)); };
    hold("btn-rot-l", (v) => (this.rotL = v)); hold("btn-rot-r", (v) => (this.rotR = v));
    const drive = this.root.querySelector<HTMLElement>("#btn-drive")!;
    on(drive, "pointerup", () => this.setDrive(!this.driveMode));
    on(this.root.querySelector<HTMLElement>("#btn-camera")!, "pointerup", () => this.pressedActions.add("cycleCamera"));
    // Kamera nur im mittleren Streifen (.zone-cam) — Finger, die neben eine Stick-Zone rutschen, bewegen nichts mehr.
    const cam = this.root.querySelector<HTMLElement>(".zone-cam")!;
    on(cam, "pointerdown", (e) => { if (e.pointerType !== "touch") return; cam.setPointerCapture(e.pointerId); this.freePointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.freePointers.size === 2) this.pinchDist = this.pinchDistance(); e.preventDefault(); });
    on(cam, "pointermove", (e) => { const p = this.freePointers.get(e.pointerId); if (!p) return; if (this.freePointers.size === 1) { this.orbitDx += e.clientX - p.x; this.orbitDy += e.clientY - p.y; } p.x = e.clientX; p.y = e.clientY; if (this.freePointers.size === 2) { const d = this.pinchDistance(); if (this.pinchDist > 0) this.zoom += ((this.pinchDist - d) / 80) * this.pinchSens; this.pinchDist = d; } });
    const endFree = (e: PointerEvent) => { this.freePointers.delete(e.pointerId); this.pinchDist = 0; };
    on(cam, "pointerup", endFree); on(cam, "pointercancel", endFree);
    // Doppeltipp-Erkennung über alle Zonen (Sticks und Kamera-Streifen); Knöpfe zählen nicht
    for (const zone of this.root.querySelectorAll<HTMLElement>(".zone")) {
      on(zone, "pointerdown", (e) => { if (e.pointerType === "touch") this.taps.pointerDown(e.pointerId, e.clientX, e.clientY, performance.now()); });
      on(zone, "pointerup", (e) => { if (this.taps.pointerUp(e.pointerId, e.clientX, e.clientY, performance.now())) this.pressedActions.add("cycleCamera"); });
      on(zone, "pointercancel", (e) => this.taps.cancel(e.pointerId));
    }
    void parent;
  }

  private pinchDistance(): number { const [a, b] = [...this.freePointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }

  private beginStick(s: Stick, e: PointerEvent): void {
    s.pointerId = e.pointerId; s.cx = e.clientX; s.cy = e.clientY; s.x = 0; s.y = 0;
    s.el.hidden = false; s.el.style.left = `${s.cx - s.radius}px`; s.el.style.top = `${s.cy - s.radius}px`;
    s.knob.style.transform = "translate(0px, 0px)";
  }
  private moveStick(e: PointerEvent): void {
    const s = this.left.pointerId === e.pointerId ? this.left : this.right.pointerId === e.pointerId ? this.right : null;
    if (!s) return;
    let dx = e.clientX - s.cx, dy = e.clientY - s.cy;
    const len = Math.hypot(dx, dy);
    if (len > s.radius) { dx = (dx / len) * s.radius; dy = (dy / len) * s.radius; }
    s.x = dx / s.radius; s.y = -dy / s.radius; // y nach oben positiv
    s.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  private endStick(e: PointerEvent): void {
    const s = this.left.pointerId === e.pointerId ? this.left : this.right.pointerId === e.pointerId ? this.right : null;
    if (!s) return;
    s.pointerId = null; s.x = 0; s.y = 0; s.el.hidden = true;
  }
  /** Alle Sticks, Halteknoepfe und Kamera-Zeiger loslassen (kein Finger mehr auf dem Glas / Seite versteckt). */
  releaseAll(): void {
    for (const s of [this.left, this.right]) { s.pointerId = null; s.x = 0; s.y = 0; s.el.hidden = true; }
    this.rotL = false; this.rotR = false; this.freePointers.clear(); this.pinchDist = 0;
  }
  private setDrive(v: boolean): void { this.driveMode = v; this.driveIdleS = 0; this.root.querySelector("#btn-drive")!.classList.toggle("active", v); }

  /** Achse mit Totzone und Querdämpfung: die dominante Richtung bleibt voll, die andere wird abgeschwächt. */
  private axis(v: number, other: number): number {
    const a = Math.abs(v); if (a < this.deadzone) return 0;
    const scaled = Math.sign(v) * ((a - this.deadzone) / (1 - this.deadzone));
    return Math.abs(other) > a ? scaled * this.cross : scaled;
  }

  get active(): boolean { return this.left.pointerId !== null || this.right.pointerId !== null || this.rotL || this.rotR; }
  get isDriveMode(): boolean { return this.driveMode; }

  /** Pro Physikschritt: Frame **addieren** (Tastatur kann parallel liegen; der Mapper klemmt). */
  add(f: ControlFrame, dt: number): void {
    const L = this.left, R = this.right;
    const lx = this.axis(L.x, L.y), ly = this.axis(L.y, L.x);
    if (this.driveMode) {
      f.drive += ly; f.steer += lx;
      // Auto-Ende: 4 s kein Finger auf dem linken Stick → zurück zum Arm (Gerätetest 08.09.: alte Regel griff nie)
      if (L.pointerId === null) { this.driveIdleS += dt; if (this.driveIdleS > this.driveAutoExitS) this.setDrive(false); } else this.driveIdleS = 0;
    } else { f.cab += lx; f.boom += ly; }
    f.stick += this.axis(R.y, R.x);
    // Spinne: rechts = schließen (ab closeDz), links = öffnen (ab openDz), sonst halten
    const gx = R.x;
    if (gx > this.closeDz) f.grapple = Math.max(f.grapple, (gx - this.closeDz) / (1 - this.closeDz));
    else if (gx < -this.openDz) f.grapple = Math.min(f.grapple, -((-gx - this.openDz) / (1 - this.openDz)));
    f.rotator += (this.rotR ? 1 : 0) - (this.rotL ? 1 : 0);
    for (const a of this.pressedActions) f.actions.add(a as never); this.pressedActions.clear();
    // CameraRig rechnet Pixel × 0,005 rad (Maus). Touch bekommt seinen eigenen Faktor aus controls.json, daher hier umskalieren.
    const k = this.orbitSens / 0.005;
    f.camOrbit.dx += this.orbitDx * k; f.camOrbit.dy += this.orbitDy * k; f.camZoom += this.zoom;
    this.orbitDx = 0; this.orbitDy = 0; this.zoom = 0;
  }

  dispose(): void { for (const u of this.unsubs) u(); this.root.remove(); }
}
