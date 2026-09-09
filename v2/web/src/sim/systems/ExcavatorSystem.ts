import type { System, SimContext } from "./System";
import type { ExcavatorState } from "@/sim/world/WorldState";
import { clamp, deg, ramp, quatFromAxisX, quatFromAxisY, quatFromAxisZ, quatMul, rotateVec, type Vec3, type Quat } from "@/shared/math";
import { CLAW_OPEN_SPLAY, clawTipDepth } from "@/shared/clawGeometry";

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
  /** Zinken-Kontakt (E-043): Schliessbremse 0..1, von ExcavatorColliders gesetzt — Zinken, die Teile schieben, schliessen langsamer */
  clawLoadFactor = 1;
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
  readonly prev = { x: 0, y: 0, z: 0, heading: 0, cab: 0, boom: 0, stick: 0, rotator: 0, splay: CLAW_OPEN_SPLAY, gx: 0, gy: 0, gz: 0, swingX: 0, swingZ: 0 };

  // --- Pendel (prototype excavator.ts:1314-1346; Werte aus balancing.assist) ---
  private swingVelX = 0; private swingVelZ = 0;
  private prevTip: Vec3 = { x: 0, y: 0, z: 0 }; private prevTipVel: Vec3 = { x: 0, y: 0, z: 0 }; private pendulumInit = false;
  private a!: Record<string, number | boolean | string>;
  private readonly qYaw: Quat = { x: 0, y: 0, z: 0, w: 1 }; private readonly qTiltX: Quat = { x: 0, y: 0, z: 0, w: 1 }; private readonly qTiltZ: Quat = { x: 0, y: 0, z: 0, w: 1 }; private readonly qTilt: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly hang: Vec3 = { x: 0, y: 0, z: 0 };

  // --- Snap (Greif-Magnet, Briefing Kap. 5.4): Oberwagen und Stiel gleiten kurz auf ein Zielteil ---
  private snapT = 0; private snapTotal = 0; private snapX = 0; private snapZ = 0;
  /** Vom GripSystem gesetzt: Zielpunkt (Welt, x/z) für den Greif-Magneten. */
  beginSnap(x: number, z: number): void { const a = this.a; if (!a["snapEnabled"]) return; this.snapX = x; this.snapZ = z; this.snapTotal = Number(a["snapSeconds"]); this.snapT = this.snapTotal; }
  get snapping(): boolean { return this.snapT > 0; }

  /** Geschwindigkeit der Spinne (Welt, m/s) — für Loslassen und Widerstand */
  readonly grappleVel: Vec3 = { x: 0, y: 0, z: 0 };
  private prevGrapple: Vec3 = { x: 0, y: 0, z: 0 };
  private prevInit = false;

  init(ctx: SimContext): void {
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
    pv.splay = pp.splay; pv.gx = pp.grapplePos.x; pv.gy = pp.grapplePos.y; pv.gz = pp.grapplePos.z; pv.swingX = pp.swingX; pv.swingZ = pp.swingZ;
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
    const rate = this.snapT > 0 && g > 0 ? 0 : g > 0 ? (g * dt * this.clawLoadFactor) / closeT : g < 0 ? (g * dt) / openT : 0;
    s.grapple = clamp(s.grapple + rate, 0, 1);
    if (g !== 0) this.grappleHold = g > 0;
    this.closing = g > 0 || (this.grappleHold && s.grapple > 0.5);
    if (!this.closing) this.snapT = 0; // Loslassen bricht den Snap ab

    this.resolveGroundClamp(s);
    this.integratePendulum(s, dt);
    this.computePose(s);

    // Spinnengeschwindigkeit (für Loslassen mit Schwung)
    const p = this.pose.grapplePos;
    if (this.prevInit) { this.grappleVel.x = (p.x - this.prevGrapple.x) / dt; this.grappleVel.y = (p.y - this.prevGrapple.y) / dt; this.grappleVel.z = (p.z - this.prevGrapple.z) / dt; }
    this.prevGrapple.x = p.x; this.prevGrapple.y = p.y; this.prevGrapple.z = p.z; this.prevInit = true;
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
   * Boden ist harter Widerstand (excavator.ts:1197-1246), aber anders gelöst als im Prototyp (E-013):
   * Dort hob der Anschlag den Arm über den Stielwinkel an — dabei wanderte die Spinne beim Schließen bis zu
   * 1,3 m zur Seite und verlor das Teil. Jetzt setzt die Spinne auf und wird am Kardangelenk senkrecht
   * hochgeschoben (bis maxLift); erst darüber hinaus wird der Arm geklemmt.
   */
  private resolveGroundClamp(s: ExcavatorState): void {
    // Bezug ist die Spitzentiefe der OFFENEN Spinne (E-024, ersetzt E-013 teilweise): Beim Schliessen werden die Spitzen bis
    // 0,34 m tiefer — frueher hob der Anschlag dann die ganze Spinne an („Hochbocken", geschlossen kam sie nicht mehr an den
    // Haufen, Ladung fuhr mit hoch; iPad-Test 08.09.). Jetzt duerfen die Spitzen beim Schliessen in Boden/Haufen eintauchen,
    // wie echte Zinken. Dazu die Unterkante einer mitgefuehrten Ladung (E-017).
    // Nachjustiert 09.09. (iPad: „Spinne versinkt im Boden"): Bezug ist die AKTUELLE Spreizung, die Spitzen duerfen aber
    // hoechstens clawTipDipMaxM tiefer als der Boden — geschlossen hebt sich die Spinne also nur um (0,34 − dip) m statt 0,34.
    const dip = Number(this.b["clawTipDipMaxM"] ?? 0.1);
    const tipDepth = Math.max(clawTipDepth(CLAW_OPEN_SPLAY), clawTipDepth(this.splay(s)) - dip, this.carriedBottomM);
    const minTipY = tipDepth + Number(this.b["groundClearanceM"]);
    const maxLift = 0.6;
    let need = minTipY - this.tipY(s);
    this.groundLift = clamp(need, 0, maxLift);
    // Pro Schritt hoechstens so viel Armbewegung wie der Fahrer selbst in 3 Schritten schafft — kein Hochschnellen
    let clamped = false, guard = 0;
    const maxIter = Math.max(2, Math.round((Math.max(this.boomRate, this.stickRate) * 3 / 60) / 0.004));
    while (this.tipY(s) + maxLift < minTipY && guard++ < maxIter) {
      clamped = true;
      const total = s.boom + s.stick;
      const dStick = this.stickLen * Math.cos(total);
      const canStick = Math.abs(dStick) > 0.4 && ((dStick > 0 && s.stick < this.stickMax - 0.002) || (dStick < 0 && s.stick > this.stickMin + 0.002));
      if (canStick) s.stick += Math.sign(dStick) * 0.004;
      else if (s.boom < this.boomMax - 0.002) s.boom += 0.004;
      else break;
    }
    if (clamped) {
      need = minTipY - this.tipY(s);
      this.groundLift = clamp(need, 0, maxLift);
      const total = s.boom + s.stick;
      const dBoom = this.boomLen * Math.cos(s.boom) + this.stickLen * Math.cos(total);
      const dStick = this.stickLen * Math.cos(total);
      if (this.boomVel * dBoom < 0) this.boomVel = 0;
      if (this.stickVel * dStick < 0) this.stickVel = 0;
    }
    this.groundContact = this.groundLift > 0.001 || this.tipY(s) < minTipY + 0.04;
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

  /**
   * Gedämpftes Pendel am Kardan (prototype excavator.ts:1314-1346): angetrieben von der horizontalen
   * Beschleunigung der Stielspitze (gekappt), schwere Last pendelt länger nach, Bodenkontakt beruhigt sofort.
   * Teleport (Spawn, Laden) füttert das Pendel nicht mit einem Riesenimpuls.
   */
  private integratePendulum(s: ExcavatorState, dt: number): void {
    const a = this.a;
    const yaw = s.heading + s.cab;
    const reach = this.boomLen * Math.cos(s.boom) + this.stickLen * Math.cos(s.boom + s.stick);
    const bpX = this.boomPivot[0], bpZ = this.boomPivot[2];
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const tx = s.pos.x + bpX * cy + bpZ * sy + reach * sy, tz = s.pos.z - bpX * sy + bpZ * cy + reach * cy;
    if (!this.pendulumInit) { this.prevTip.x = tx; this.prevTip.z = tz; this.pendulumInit = true; }
    const vx = (tx - this.prevTip.x) / dt, vz = (tz - this.prevTip.z) / dt;
    this.prevTip.x = tx; this.prevTip.z = tz;
    if (Math.hypot(vx, vz) > 30) { this.swingVelX = 0; this.swingVelZ = 0; this.prevTipVel.x = vx; this.prevTipVel.z = vz; return; }
    const cap = Number(a["pendulumAccelCapMs2"]);
    const ax = clamp((vx - this.prevTipVel.x) / dt, -cap, cap), az = clamp((vz - this.prevTipVel.z) / dt, -cap, cap);
    this.prevTipVel.x = vx; this.prevTipVel.z = vz;
    const L = Number(a["pendulumLengthM"]), G = 9.81, maxRad = Number(a["pendulumMaxRad"]);
    const heavy = Math.min(this.carriedMassKg / Number(a["pendulumHeavyRefKg"]), 1);
    const damping = Number(a["pendulumDampingLight"]) + (Number(a["pendulumDampingHeavy"]) - Number(a["pendulumDampingLight"])) * heavy;
    const p = this.pose;
    this.swingVelX += (-(G / L) * Math.sin(p.swingX) - damping * this.swingVelX + az / L) * dt;
    this.swingVelZ += (-(G / L) * Math.sin(p.swingZ) - damping * this.swingVelZ - ax / L) * dt;
    p.swingX = clamp(p.swingX + this.swingVelX * dt, -maxRad, maxRad);
    p.swingZ = clamp(p.swingZ + this.swingVelZ * dt, -maxRad, maxRad);
    if (this.groundContact) {
      const dp = Number(a["pendulumGroundDampPos"] ?? 0.75), dv = Number(a["pendulumGroundDampVel"] ?? 0.5);
      p.swingX *= dp; p.swingZ *= dp; this.swingVelX *= dv; this.swingVelZ *= dv;
    }
  }

  /** Pendel zurücksetzen (Laden, Tests). */
  resetPendulum(): void { this.pose.swingX = this.pose.swingZ = 0; this.swingVelX = this.swingVelZ = 0; this.pendulumInit = false; }

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
    p.grapplePos.x = p.stickTip.x; p.grapplePos.y = p.stickTip.y + this.groundLift; p.grapplePos.z = p.stickTip.z;
    p.grappleYaw = yaw + s.rotator;
    // Gieren zuerst, dann Neigung um Weltachsen (wie im Prototyp: qTilt × qYaw)
    quatFromAxisY(p.grappleYaw, this.qYaw); quatFromAxisX(p.swingX, this.qTiltX); quatFromAxisZ(p.swingZ, this.qTiltZ);
    quatMul(this.qTiltX, this.qTiltZ, this.qTilt); quatMul(this.qTilt, this.qYaw, p.grappleQuat);
    // Sensor hängt unter dem Kardan — mit der Neigung mit
    this.hang.x = 0; this.hang.y = -(this.grappleLink + this.palmOffsetY + this.palmToSensor); this.hang.z = 0;
    rotateVec(this.qTilt, this.hang, this.hang);
    p.sensorPos.x = p.grapplePos.x + this.hang.x; p.sensorPos.y = p.grapplePos.y + this.hang.y; p.sensorPos.z = p.grapplePos.z + this.hang.z;
    p.splay = this.splay(s);
    p.chassisQuat.x = 0; p.chassisQuat.y = Math.sin(s.heading / 2); p.chassisQuat.z = 0; p.chassisQuat.w = Math.cos(s.heading / 2);
  }

  /** Tiefe des Kardangelenks bis Traversen-Unterkante (für Kollider/Ansicht) */
  get palmY(): number { return -(this.grappleLink + this.palmOffsetY); }

  save(): unknown { return null; } // Zustand liegt in world.excavator (SaveService, M4)
}
