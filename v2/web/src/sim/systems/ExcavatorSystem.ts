import type { System, SimContext } from "./System";
import type { ExcavatorState } from "@/sim/world/WorldState";
import { clamp, deg, ramp, quatFromAxisY, rotateVec, type Vec3, type Quat } from "@/shared/math";
import { CLAW_OPEN_SPLAY } from "@/shared/clawGeometry";

/**
 * Bagger-Kinematik als reines Modell (Briefing Kap. 5.1, 6.1; Kern aus prototype excavator.ts:1015-1176).
 * Der Arm ist animiert, nicht physiksimuliert: Winkel, Rampen, Lastfaktor, Bodenanschlag.
 * Liest nur den ControlFrame — keine Tastencodes. Alle Zahlen aus balancing.json.
 *
 * Achsen: heading (Fahrwerk), cab (Oberwagen), boom (Hauptarm), stick (Stiel), rotator, grapple (0 offen … 1 zu).
 * `pose()` liefert die Weltpositionen von Ausleger-Drehpunkt, Stielspitze, Spinne und Sensor für Kollider, Greifer und Ansicht.
 */
export interface ExcavatorPose {
  boomPivot: Vec3;        // Welt
  stickTip: Vec3;         // Welt: Kardangelenk
  grapplePos: Vec3;       // Welt: Ursprung der Spinne (= Stielspitze; Spinne hängt lotrecht)
  grappleQuat: Quat;      // Gieren (heading + cab + rotator) × Pendelneigung (M3)
  grappleYaw: number;
  /** Pendelwinkel (rad): swingX kippt um die Welt-X-Achse (Last nach ∓z), swingZ um die Welt-Z-Achse (Last nach ±x) */
  swingX: number; swingZ: number;
  sensorPos: Vec3;        // Welt: Mitte des Schalenkorbs
  splay: number;          // aktuelle Spreizung (rad)
  chassisQuat: Quat;
}

export class ExcavatorSystem implements System {
  readonly name = "excavator";
  readonly phase = "input" as const;
  readonly order = 10;

  // gerampte Achsgeschwindigkeiten
  driveVel = 0; cabVel = 0; boomVel = 0; stickVel = 0;
  /** von außen gesetzt (GripSystem, ExcavatorColliders) */
  carriedMassKg = 0; carriedCount = 0; plowFactor = 1;
  /** Tiefe des untersten Punkts der Ladung unter dem Kardan (m), vom GripSystem gesetzt; 0 = leer */
  carriedBottomM = 0;
  /** Bodenkontakt der Krallen (für Audio/HUD) */
  groundContact = false;
  /** Sollzustand: schließt die Spinne gerade / hält sie zu? */
  closing = false;
  private grappleHold = false;
  private b!: Record<string, number>;
  private boomLen = 0; stickLen = 0; grappleLink = 0; palmToSensor = 0; palmOffsetY = 0;
  private boomPivot: [number, number, number] = [0, 0, 0];
  private cabMax = 0; boomRate = 0; stickRate = 0; rotatorRate = 0; boomMin = 0; boomMax = 0; stickMin = 0; stickMax = 0;
  private maxTotalKg = 3500;
  readonly pose: ExcavatorPose = {
    boomPivot: { x: 0, y: 0, z: 0 }, stickTip: { x: 0, y: 0, z: 0 }, grapplePos: { x: 0, y: 0, z: 0 },
    grappleQuat: { x: 0, y: 0, z: 0, w: 1 }, grappleYaw: 0, swingX: 0, swingZ: 0, sensorPos: { x: 0, y: 0, z: 0 }, splay: CLAW_OPEN_SPLAY,
    chassisQuat: { x: 0, y: 0, z: 0, w: 1 },
  };
  /** Pose des vorherigen Schritts — für die Render-Interpolation (Bagger springt sonst mit 60 Hz vor 48/120-Hz-Bildschirmen) */
  readonly prev = { x: 0, y: 0, z: 0, heading: 0, cab: 0, boom: 0, stick: 0, rotator: 0, splay: CLAW_OPEN_SPLAY, gx: 0, gy: 0, gz: 0, swingX: 0, swingZ: 0, gqx: 0, gqy: 0, gqz: 0, gqw: 1 };

  // Pendel: seit Spinne 2.0 (E-038) echte Physik des Spinnenkoerpers; swingX/Z werden aus seiner Neigung abgeleitet
  private a!: Record<string, number | boolean | string>;
  private readonly hang: Vec3 = { x: 0, y: 0, z: 0 };

  // --- Snap (Greif-Magnet, Briefing Kap. 5.4): Oberwagen und Stiel gleiten kurz auf ein Zielteil ---
  private snapT = 0; private snapTotal = 0; private snapX = 0; private snapZ = 0;
  /** Vom GripSystem gesetzt: Zielpunkt (Welt, x/z) für den Greif-Magneten. */
  beginSnap(x: number, z: number): void { const a = this.a; if (!a["snapEnabled"]) return; this.snapX = x; this.snapZ = z; this.snapTotal = Number(a["snapSeconds"]); this.snapT = this.snapTotal; }
  get snapping(): boolean { return this.snapT > 0; }

  /** Geschwindigkeit der Spinne (Welt, m/s) — für Loslassen und Widerstand */
  readonly grappleVel: Vec3 = { x: 0, y: 0, z: 0 };

  init(ctx: SimContext): void {
    this.ctxRef = ctx;
    const b = ctx.data.balancing.excavator as Record<string, number | number[] | string>;
    this.b = b as Record<string, number>;
    this.boomLen = Number(b["boomLenM"]); this.stickLen = Number(b["stickLenM"]);
    this.grappleLink = Number(b["grappleLinkM"]); this.palmToSensor = Number(b["palmToSensorM"]); this.palmOffsetY = Number(b["palmOffsetY"]);
    this.boomPivot = b["boomPivot"] as [number, number, number];
    this.cabMax = deg(Number(b["cabRateDegS"])); this.boomRate = deg(Number(b["boomRateDegS"])); this.stickRate = deg(Number(b["stickRateDegS"]));
    this.rotatorRate = deg(Number(b["rotatorRateDegS"]));
    this.boomMin = deg(Number(b["boomMinDeg"])); this.boomMax = deg(Number(b["boomMaxDeg"]));
    this.stickMin = deg(Number(b["stickMinDeg"])); this.stickMax = deg(Number(b["stickMaxDeg"]));
    this.maxTotalKg = Number(ctx.data.balancing.grip["maxTotalKg"]);
    this.a = ctx.data.balancing.assist;
    this.computePose(ctx.world.excavator);
  }

  /** Lastfaktor (Kap. 5.1): 1 − 0,5 × Last/Referenz, Untergrenze loadFactorMin; mal Pflügwiderstand. */
  loadFactor(): number {
    const ref = Number(this.b["loadFactorRefKg"]), min = Number(this.b["loadFactorMin"]);
    const carried = Math.max(min, 1 - (1 - min) * Math.min(this.carriedMassKg / ref, 1));
    return carried * this.plowFactor;
  }

  update(ctx: SimContext, dt: number): void {
    const s = ctx.world.excavator;
    const c = ctx.control;
    const pv = this.prev, pp = this.pose;
    pv.x = s.pos.x; pv.y = s.pos.y; pv.z = s.pos.z; pv.heading = s.heading; pv.cab = s.cab; pv.boom = s.boom; pv.stick = s.stick; pv.rotator = s.rotator;
    pv.splay = pp.splay; pv.gx = pp.grapplePos.x; pv.gy = pp.grapplePos.y; pv.gz = pp.grapplePos.z; pv.swingX = pp.swingX; pv.swingZ = pp.swingZ; pv.gqx = pp.grappleQuat.x; pv.gqy = pp.grappleQuat.y; pv.gqz = pp.grappleQuat.z; pv.gqw = pp.grappleQuat.w;
    const b = this.b;
    const lf = this.loadFactor();
    const rampT = Number(b["rampTimeS"]);

    // --- Fahrwerk ---
    const driveMax = Number(b["driveMaxMs"]);
    const drive = s.driveMode || c.drive !== 0 ? clamp(c.drive, -1, 1) : 0;
    this.driveVel = ramp(this.driveVel, drive * driveMax, (driveMax / rampT) * dt);
    const steer = clamp(c.steer, -1, 1);
    if (Math.abs(this.driveVel) > 0.05 || steer !== 0) {
      const dir = this.driveVel >= 0 ? 1 : -1;
      const speedFactor = clamp(Math.abs(this.driveVel) / driveMax, Number(b["steerMinFactor"]), 1);
      s.heading -= steer * Number(b["steerRateRadS"]) * speedFactor * dir * dt;
    }
    s.pos.x += Math.sin(s.heading) * this.driveVel * dt;
    s.pos.z += Math.cos(s.heading) * this.driveVel * dt;

    // --- Oberwagen / Hauptarm / Stiel mit Lastfaktor ---
    if (this.snapT > 0) this.applySnap(s, dt);
    else if (this.lockArm) { this.cabVel = 0; this.boomVel = 0; this.stickVel = 0; } // M5: Spinne haengt an einer Baugruppe — Arm steht, Eingabe wird als Zugkraft gewertet
    else {
      this.cabVel = ramp(this.cabVel, clamp(c.cab, -1, 1) * this.cabMax * lf, (this.cabMax / rampT) * dt);
      s.cab += this.cabVel * dt;
      this.boomVel = ramp(this.boomVel, clamp(c.boom, -1, 1) * this.boomRate * lf, (this.boomRate / rampT) * dt);
      s.boom = clamp(s.boom + this.boomVel * dt, this.boomMin, this.boomMax);
      this.stickVel = ramp(this.stickVel, clamp(c.stick, -1, 1) * this.stickRate * lf, (this.stickRate / rampT) * dt);
      s.stick = clamp(s.stick + this.stickVel * dt, this.stickMin, this.stickMax);
    }
    s.rotator += clamp(c.rotator, -1, 1) * this.rotatorRate * dt;

    // --- Spinne: +1 schließt, −1 öffnet, 0 hält (Touch) bzw. öffnet (Tastatur meldet −1 beim Loslassen) ---
    // Während des Snaps wartet die Spinne (Briefing: „gleiten … bevor die Spinne schließt"), bleibt aber im Zustand „schließt".
    const closeT = Number(b["closeTimeS"]), openT = Number(b["openTimeS"]);
    const g = clamp(c.grapple, -1, 1);
    const rate = this.snapT > 0 && g > 0 ? 0 : g > 0 ? (g * dt) / closeT : g < 0 ? (g * dt) / openT : 0;
    s.grapple = clamp(s.grapple + rate, 0, 1);
    if (g !== 0) this.grappleHold = g > 0;
    this.closing = g > 0 || (this.grappleHold && s.grapple > 0.5);
    if (!this.closing) this.snapT = 0; // Loslassen bricht den Snap ab

    this.resolveGroundClamp(s);
    this.computePose(s);
  }

  /** Kardan-Ist der Spinne (Welt), vom dynamischen Koerper (E-038); vor dem ersten Physikschritt = Stielspitze */
  private bodyPos: Vec3 = { x: 0, y: 0, z: 0 }; private bodyInit = false;
  private ctxRef: SimContext | null = null;
  /**
   * Spinne 2.0: Pose der Spinne kommt vom dynamischen Koerper (GrapplePoseSystem nach jedem Physikschritt).
   * Setzt grapplePos/grappleQuat/sensorPos, leitet Pendelwinkel (Ansicht/Audio) aus der Neigung ab, misst die Geschwindigkeit.
   */
  syncFromBody(t: { x: number; y: number; z: number }, r: { x: number; y: number; z: number; w: number }, dt: number): void {
    const p = this.pose;
    if (dt > 0 && this.bodyInit) { this.grappleVel.x = (t.x - this.bodyPos.x) / dt; this.grappleVel.y = (t.y - this.bodyPos.y) / dt; this.grappleVel.z = (t.z - this.bodyPos.z) / dt; }
    this.bodyPos.x = t.x; this.bodyPos.y = t.y; this.bodyPos.z = t.z; this.bodyInit = true;
    p.grapplePos.x = t.x; p.grapplePos.y = t.y; p.grapplePos.z = t.z;
    p.grappleQuat.x = r.x; p.grappleQuat.y = r.y; p.grappleQuat.z = r.z; p.grappleQuat.w = r.w;
    // Neigung: gedrehte Abwaerts-Achse → swingX kippt um X (Last nach ∓z), swingZ um Z (Last nach ±x)
    this.hang.x = 0; this.hang.y = -1; this.hang.z = 0; rotateVec(p.grappleQuat, this.hang, this.hang);
    p.swingX = Math.atan2(this.hang.z, -this.hang.y); p.swingZ = Math.atan2(-this.hang.x, -this.hang.y);
    this.hang.x = 0; this.hang.y = -(this.grappleLink + this.palmOffsetY + this.palmToSensor); this.hang.z = 0;
    rotateVec(p.grappleQuat, this.hang, this.hang);
    p.sensorPos.x = t.x + this.hang.x; p.sensorPos.y = t.y + this.hang.y; p.sensorPos.z = t.z + this.hang.z;
    this.groundContact = t.y - p.stickTip.y > Number(this.ctxRef?.data.balancing.grapple["contactCompressionM"] ?? 0.03);
  }

  /** Spreizung: zu = Kalotte, aber nie enger, als die Ladung Platz braucht (excavator.ts:1183-1189). */
  splay(s: ExcavatorState): number {
    const minSplay = Math.min(0.5, this.carriedCount * 0.06 + Math.min(this.carriedMassKg / this.maxTotalKg, 1) * 0.28);
    return CLAW_OPEN_SPLAY + (minSplay - CLAW_OPEN_SPLAY) * s.grapple;
  }

  private tipY(s: ExcavatorState): number {
    return this.boomPivot[1] + this.boomLen * Math.sin(s.boom) + this.stickLen * Math.sin(s.boom + s.stick);
  }

  /** M5: Arm gesperrt, solange eine Baugruppe gefasst ist (CompositeSystem). */
  lockArm = false;
  /** Wie weit die Spinne gerade auf dem Boden aufsitzt und am Kardan hochgeschoben wird (m). */
  groundLift = 0;

  /**
   * Bodenanschlag, Spinne 2.0 (E-038): Massstab ist die FEDERKOMPRESSION. Sitzt die Spinne auf Boden oder Haufen auf,
   * bleibt ihr Kardan-Ist ueber dem Kardan-Soll des Stiels. Der Arm darf hoechstens `maxCompressionM` tiefer als die
   * Spinne, sonst wird er mit begrenzter Rate angehoben (kein Hochschnellen). Mitgefuehrte Ladung (kinematisch, E-017)
   * haelt der Arm zusaetzlich ueber dem Boden. Ersetzt E-013/E-024 (Spitzentiefen-Formeln).
   */
  private resolveGroundClamp(s: ExcavatorState): void {
    const maxComp = Number(this.ctxRef?.data.balancing.grapple["maxCompressionM"] ?? 0.12);
    const clearance = Number(this.b["groundClearanceM"]);
    const minTipY = Math.max(this.bodyInit ? this.bodyPos.y - maxComp : -Infinity, this.carriedBottomM > 0 ? this.carriedBottomM + clearance : -Infinity);
    this.groundLift = clamp(this.bodyInit ? this.bodyPos.y - this.tipY(s) : 0, 0, 1);
    let clamped = false, guard = 0;
    const maxIter = Math.max(2, Math.round((Math.max(this.boomRate, this.stickRate) * 3 / 60) / 0.004));
    while (this.tipY(s) < minTipY && guard++ < maxIter) {
      clamped = true;
      const total = s.boom + s.stick;
      const dStick = this.stickLen * Math.cos(total);
      const canStick = Math.abs(dStick) > 0.4 && ((dStick > 0 && s.stick < this.stickMax - 0.002) || (dStick < 0 && s.stick > this.stickMin + 0.002));
      if (canStick) s.stick += Math.sign(dStick) * 0.004;
      else if (s.boom < this.boomMax - 0.002) s.boom += 0.004;
      else break;
    }
    if (clamped) {
      const total = s.boom + s.stick;
      const dBoom = this.boomLen * Math.cos(s.boom) + this.stickLen * Math.cos(total);
      const dStick = this.stickLen * Math.cos(total);
      if (this.boomVel * dBoom < 0) this.boomVel = 0;
      if (this.stickVel * dStick < 0) this.stickVel = 0;
    }
  }

  /**
   * Greif-Magnet: in `snapSeconds` gleiten Oberwagen (Gierwinkel) und Stiel (Reichweite) auf den Zielpunkt.
   * Kleine IK mit einem Freiheitsgrad pro Größe: Gieren = atan2 um den Ausleger-Drehpunkt, Reichweite über die
   * Ableitung dReichweite/dStiel = −stickLen·sin(boom+stick). Bei fast gestrecktem Arm (Ableitung ≈ 0) bleibt der Stiel.
   */
  private applySnap(s: ExcavatorState, dt: number): void {
    const bp = this.pose.boomPivot;
    const k = Math.min(1, dt / this.snapT);
    const yawT = Math.atan2(this.snapX - bp.x, this.snapZ - bp.z) - s.heading;
    let dYaw = yawT - s.cab; dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    s.cab += dYaw * k;
    const reachT = Math.hypot(this.snapX - bp.x, this.snapZ - bp.z);
    const reach = this.boomLen * Math.cos(s.boom) + this.stickLen * Math.cos(s.boom + s.stick);
    const dReach = -this.stickLen * Math.sin(s.boom + s.stick);
    if (Math.abs(dReach) > 0.3) s.stick = clamp(s.stick + ((reachT - reach) / dReach) * k, this.stickMin, this.stickMax);
    this.cabVel = 0; this.boomVel = 0; this.stickVel = 0;
    this.snapT = Math.max(0, this.snapT - dt);
  }

  /** Pendel zurücksetzen (Laden, Tests). */
  resetPendulum(): void {
    this.pose.swingX = this.pose.swingZ = 0; this.bodyInit = false; this.computePose(this.ctxRef!.world.excavator);
    const cols = this.ctxRef?.get("excavatorColliders") as unknown as { teleportGrapple(p: Vec3, yaw: number): void; grapple: { translation(): Vec3 } };
    cols.teleportGrapple(this.pose.stickTip, this.pose.grappleYaw);
    this.syncFromBody(cols.grapple.translation(), this.pose.grappleQuat, 0);
    // Arm sofort ueber die (ggf. angehobene) Spinne klemmen — sonst zieht die Feder sie in den Boden
    const s = this.ctxRef!.world.excavator;
    for (let i = 0; i < 400 && this.tipY(s) < this.bodyPos.y - 0.05; i++) this.resolveGroundClamp(s);
    this.computePose(s);
  }

  /** Vorwärtskinematik in Weltkoordinaten. Oberwagen dreht um Y; Arm liegt in der Ebene des Oberwagens. */
  computePose(s: ExcavatorState): void {
    const yaw = s.heading + s.cab;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const p = this.pose;
    // Ausleger-Drehpunkt: boomPivot (x, y, z) im Oberwagen-Raum, z zeigt nach vorn
    const bpX = this.boomPivot[0], bpY = this.boomPivot[1], bpZ = this.boomPivot[2];
    p.boomPivot.x = s.pos.x + bpX * cy + bpZ * sy; p.boomPivot.y = s.pos.y + bpY; p.boomPivot.z = s.pos.z - bpX * sy + bpZ * cy;
    const reach = this.boomLen * Math.cos(s.boom) + this.stickLen * Math.cos(s.boom + s.stick);
    const height = this.boomLen * Math.sin(s.boom) + this.stickLen * Math.sin(s.boom + s.stick);
    p.stickTip.x = p.boomPivot.x + reach * sy; p.stickTip.y = p.boomPivot.y + height; p.stickTip.z = p.boomPivot.z + reach * cy;
    p.grappleYaw = yaw + s.rotator;
    if (!this.bodyInit) { // vor dem ersten Physikschritt haengt die Spinne lotrecht am Kardan
      p.grapplePos.x = p.stickTip.x; p.grapplePos.y = p.stickTip.y; p.grapplePos.z = p.stickTip.z;
      quatFromAxisY(p.grappleYaw, p.grappleQuat);
      p.sensorPos.x = p.stickTip.x; p.sensorPos.y = p.stickTip.y - (this.grappleLink + this.palmOffsetY + this.palmToSensor); p.sensorPos.z = p.stickTip.z;
    }
    p.splay = this.splay(s);
    p.chassisQuat.x = 0; p.chassisQuat.y = Math.sin(s.heading / 2); p.chassisQuat.z = 0; p.chassisQuat.w = Math.cos(s.heading / 2);
  }

  /** Tiefe des Kardangelenks bis Traversen-Unterkante (für Kollider/Ansicht) */
  get palmY(): number { return -(this.grappleLink + this.palmOffsetY); }

  save(): unknown { return null; } // Zustand liegt in world.excavator (SaveService, M4)
}
