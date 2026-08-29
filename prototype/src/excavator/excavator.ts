import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Input } from "../core/input";

/**
 * Fuchsbagger (Umschlagbagger) — M0.
 * Kinematische Kette (Briefing Kap. 6.1): Der Arm ist animiert, NICHT physiksimuliert.
 * Chassis und Greifer haben kinematische Rapier-Körper, damit sie Schrott wegschieben können.
 * Der Greifer hängt in M0 immer lotrecht (Pendel/Auto-Nivellierung kommt später).
 */

// Geometrie (SW)
const BOOM_LEN = 5.2;
const STICK_LEN = 4.0;
const BOOM_PIVOT = new THREE.Vector3(0, 2.55, 0.55); // relativ zum Chassis-Ursprung (Boden)
const GRAPPLE_LINK = 0.55; // Abstand Stielspitze → Palm-Oberkante

// Geometrie der Spinne — Mesh UND Kollider leiten sich davon ab, damit die
// Krallen physisch dort sind, wo man sie sieht.
const CLAW_RING_R = 0.757; // Gelenkkreis = ØC/2 laut Datenblatt (1514 mm)
const CLAW_RING_Y = -0.9; // Unterkante Traverse ab Kardangelenk
const CLAW_SEG_LEN = 0.26;
const CLAW_SEG_BEND = 0.22; // Krümmung je Segment nach innen (rad)
const CLAW_SEGMENTS = 6;
const CLAW_COUNT = 5;
/**
 * Spreizung der ganz offenen Spinne (rad). Das Datenblatt nennt 2225 mm
 * Öffnungsweite (entspräche 0,8) — zum Spielen ist das zu eng, der Greifer
 * soll weit aufreißen und ordentlich Volumen fassen.
 */
const CLAW_OPEN_SPLAY = 1.25;
const UP_Y = new THREE.Vector3(0, 1, 0);

/**
 * Punkt auf einer Kralle nach `k` Segmenten, im Frame der Spinne.
 * `splay` ist der Öffnungswinkel (0 = zu, 1.0 = ganz offen), `a` der
 * Umfangswinkel der Kralle.
 */
function clawPoint(a: number, splay: number, k: number, out: THREE.Vector3): THREE.Vector3 {
  let y = 0;
  let z = 0;
  for (let i = 0; i < k; i++) {
    const th = -splay + i * CLAW_SEG_BEND;
    y -= CLAW_SEG_LEN * Math.cos(th);
    z -= CLAW_SEG_LEN * Math.sin(th);
  }
  const r = CLAW_RING_R + z;
  return out.set(Math.sin(a) * r, CLAW_RING_Y + y, Math.cos(a) * r);
}
const PALM_TO_SENSOR = 0.75; // Palm-Zentrum → Sensor in der Mitte des Schalenkorbs

// Achsgrenzen (SW)
const BOOM_MIN = THREE.MathUtils.degToRad(5);
const BOOM_MAX = THREE.MathUtils.degToRad(62);
const STICK_MIN = THREE.MathUtils.degToRad(-140);
const STICK_MAX = THREE.MathUtils.degToRad(-25);

// Geschwindigkeiten (SW aus Briefing Kap. 5.1)
const DRIVE_MAX = 1.4; // m/s ≈ 5 km/h
const STEER_RATE = 0.7; // rad/s
const CAB_MAX = THREE.MathUtils.degToRad(40);
const BOOM_RATE = THREE.MathUtils.degToRad(25);
const STICK_RATE = THREE.MathUtils.degToRad(30);
const ROTATOR_STEP = THREE.MathUtils.degToRad(15); // pro Mausrad-Raste
const CLOSE_TIME = 0.4; // s (SW)
const OPEN_TIME = 0.3; // s (SW)
const RAMP_TIME = 0.2; // s Anlauf-/Auslauframpe (SW, vereinfacht symmetrisch)
const CAB_LIFT_MAX = 2.6; // m Kabinenhub für besseren Überblick (SW)
const CAB_LIFT_SPEED = 0.75; // m/s (SW)

export class Excavator {
  // Spielzustand
  // Standplatz mittig: Stahlhaufen links, Boxenreihe rechts, Presse hinten
  readonly position = new THREE.Vector3(0, 0, -1);
  heading = 0; // rad, 0 = +Z
  cabYaw = 0;
  boomAngle = THREE.MathUtils.degToRad(35);
  stickAngle = THREE.MathUtils.degToRad(-70);
  rotatorYaw = 0;
  closure = 0; // 0 offen .. 1 zu
  closing = false;

  // gerampte Achsgeschwindigkeiten
  private driveVel = 0;
  private cabVel = 0;
  private boomVel = 0;
  private stickVel = 0;

  // Szene
  readonly root = new THREE.Group(); // Chassis (Ursprung am Boden)
  private cabGroup = new THREE.Group();
  private boomGroup = new THREE.Group();
  private stickGroup = new THREE.Group();
  private stickTip = new THREE.Object3D();
  readonly grappleGroup = new THREE.Group(); // top-level, hängt lotrecht
  private fingerPivots: THREE.Group[] = [];
  /**
   * Greifer-Hydraulik: Die Zylinder sind über Gelenke mit Traverse und Schale
   * verbunden und werden IM Spinnen-Koordinatensystem berechnet — so bilden sie
   * mit den Schalen eine Einheit und schwingen mit dem Pendel mit.
   */
  private grappleCylinders: Array<{
    pivot: THREE.Group;
    fromLocal: THREE.Vector3;
    toLocalOnShell: THREE.Vector3;
    barrel: THREE.Mesh;
    rod: THREE.Mesh;
    barrelLen: number;
  }> = [];
  private joyLeft!: THREE.Group;
  private joyRight!: THREE.Group;
  private cabinEye = new THREE.Object3D();
  /** Hubschlitten der Fahrerkabine (Taste X) */
  private cabLiftGroup = new THREE.Group();
  private cabLift = 0; // aktuelle Hubhöhe in m
  private cabLiftTarget = 0;
  // letzte Achseingaben (-1..1) für die Joystick-Animation in der Kabine
  private inCab = 0;
  private inBoom = 0;
  private inStick = 0;
  private inGrapple = 0;

  // Physik
  chassisBody!: RAPIER.RigidBody;
  grappleBody!: RAPIER.RigidBody;
  private clawColliders: RAPIER.Collider[] = [];
  private clawA = new THREE.Vector3();
  private clawB = new THREE.Vector3();
  private clawMid = new THREE.Vector3();
  private clawDir = new THREE.Vector3();
  private clawQuat = new THREE.Quaternion();
  /** Ausleger und Stiel bekommen eigene Kollider, damit der Kran nicht
   *  durch Schrott oder LKW hindurchtaucht (Design-Fix 2026-08-29) */
  private boomBody!: RAPIER.RigidBody;
  private stickBody!: RAPIER.RigidBody;
  private boomMesh!: THREE.Mesh;
  private stickMesh!: THREE.Mesh;

  /** Touch-Achsen (Tablet/Smartphone); null auf Desktop */
  touch: {
    cab: number;
    stick: number;
    boom: number;
    rotator: number;
    drive: number;
    steer: number;
    grab: boolean;
    grapple: number;
  } | null = null;
  /** gemerkter Spinnen-Zustand für die Stick-Steuerung (Stick neutral = halten) */
  private grappleHold = false;

  /** von außen gesetzt (GripSystem): getragene Masse → Achsen werden träger */
  carriedMassKg = 0;
  /** Anzahl der Teile im Greifer — bestimmt mit, wie weit die Spinne schließt */
  carriedCount = 0;

  /** Bodenkontakt der Zackenspitzen (Kap. 6.1: Boden ist immer harter Widerstand) */
  readonly groundContact = { active: false, intensity: 0, point: new THREE.Vector3() };

  /**
   * Körper, in die der Arm nicht eintauchen darf (LKW). Sie sind kinematisch,
   * kollidieren also nicht von selbst mit dem ebenfalls kinematischen Arm —
   * deshalb wird die Achsbewegung bei Überlappung zurückgenommen.
   */
  obstacleBodies: Set<number> = new Set();
  /** true, solange der Arm gegen ein Fahrzeug drückt (fürs HUD/Audio) */
  armBlocked = false;

  // Pendel der Spinne am Kardan-Gelenk (x: Kippen um Welt-X, y: um Welt-Z)
  private swing = new THREE.Vector2();
  private swingVel = new THREE.Vector2();
  private prevTip = new THREE.Vector3();
  private prevTipVel = new THREE.Vector3();
  private pendulumInit = false;

  private hydraulics: Array<{
    a: THREE.Object3D;
    b: THREE.Object3D;
    barrel: THREE.Mesh;
    rod: THREE.Mesh;
    barrelLen: number;
  }> = [];

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.buildMeshes();
    scene.add(this.root);
    scene.add(this.grappleGroup);
    this.buildHydraulics(scene);
    this.buildBodies(world);
    this.syncMeshes();
  }

  /**
   * Sichtbare Hydraulik (Design-Wunsch): Hubzylinder Kabine→Ausleger (2×),
   * Stielzylinder auf dem Ausleger, dazu Schläuche entlang der Arm-Oberseite.
   * Zylinder = Rohr + Kolbenstange, die sich zwischen zwei Ankern längt/kürzt.
   */
  private buildHydraulics(scene: THREE.Scene): void {
    // Kabinen-Lenker leben in Weltkoordinaten
    for (const l of this.cabLinks) {
      l.mesh.geometry.dispose();
      l.mesh.geometry = new THREE.BoxGeometry(0.14, 1, 0.16);
      scene.add(l.mesh);
    }
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.6 });
    const rodMat = new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.25, metalness: 0.8 });
    const addCyl = (
      parentA: THREE.Object3D,
      la: [number, number, number],
      parentB: THREE.Object3D,
      lb: [number, number, number],
      barrelLen: number,
      rBarrel: number
    ): void => {
      const a = new THREE.Object3D();
      a.position.set(...la);
      parentA.add(a);
      const b = new THREE.Object3D();
      b.position.set(...lb);
      parentB.add(b);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rBarrel, rBarrel, 1, 10), barrelMat);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(rBarrel * 0.55, rBarrel * 0.55, 1, 8), rodMat);
      barrel.castShadow = true;
      scene.add(barrel);
      scene.add(rod);
      this.hydraulics.push({ a, b, barrel, rod, barrelLen });
    };
    // Hubzylinder des Auslegers: sitzen tief am Oberwagen-Deck links und rechts
    // neben dem Auslegerfuß (nicht an der Kabine) und greifen nach oben an den
    // Ausleger — so sieht es an echten Umschlagbaggern aus.
    addCyl(this.cabGroup, [-0.52, 0.02, 1.05], this.boomGroup, [-0.28, -0.2, 2.6], 1.7, 0.1);
    addCyl(this.cabGroup, [0.52, 0.02, 1.05], this.boomGroup, [0.28, -0.2, 2.6], 1.7, 0.1);
    // Kabinenhub: zwei kleine Zylinder unten links und rechts an der Kabine
    addCyl(this.cabGroup, [-1.5, 0.3, 0.1], this.cabLiftGroup, [-1.5, 0.95, 0.1], 1.1, 0.055);
    addCyl(this.cabGroup, [-0.6, 0.3, 0.1], this.cabLiftGroup, [-0.6, 0.95, 0.1], 1.1, 0.055);
    // Stielzylinder: Ausleger-Oberseite → Stiel-Anlenkung
    addCyl(this.boomGroup, [0, 0.34, 3.4], this.stickGroup, [0, 0.2, 0.35], 1.2, 0.08);

    // Hydraulikschläuche oben auf dem Ausleger (2×) + Bogen über das Stielgelenk
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.9 });
    for (const hx of [-0.07, 0.07]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx, 0.38, 0.25),
        new THREE.Vector3(hx, 0.52, 1.8),
        new THREE.Vector3(hx, 0.46, 3.6),
        new THREE.Vector3(hx, 0.32, BOOM_LEN - 0.15),
      ]);
      const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.028, 6), hoseMat);
      this.boomGroup.add(hose);
    }
    const stickCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.34, -0.45),
      new THREE.Vector3(0, 0.3, 0.1),
      new THREE.Vector3(0, 0.24, 0.9),
    ]);
    const stickHose = new THREE.Mesh(new THREE.TubeGeometry(stickCurve, 16, 0.028, 6), hoseMat);
    this.stickGroup.add(stickHose);
  }

  private armPos = new THREE.Vector3();
  private armQuat = new THREE.Quaternion();
  private tmpPrevPos = new THREE.Vector3();
  private armShapes: Array<{ mesh: () => THREE.Mesh; half: [number, number, number] }> = [];
  private physicsWorld!: RAPIER.World;

  /** Schneidet Ausleger oder Stiel gerade ein Hindernis (LKW)? */
  private armHitsObstacle(): boolean {
    for (const s of this.armShapes) {
      const mesh = s.mesh();
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(this.armPos);
      mesh.getWorldQuaternion(this.armQuat);
      const shape = new RAPIER.Cuboid(s.half[0], s.half[1], s.half[2]);
      let hit = false;
      this.physicsWorld.intersectionsWithShape(
        this.armPos,
        this.armQuat,
        shape,
        (collider) => {
          const b = collider.parent();
          if (b && this.obstacleBodies.has(b.handle)) {
            hit = true;
            return false;
          }
          return true;
        }
      );
      if (hit) return true;
    }
    return false;
  }
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private static UP = new THREE.Vector3(0, 1, 0);

  private updateHydraulics(): void {
    // Weltmatrizen frisch berechnen — sonst sitzen die Zylinder auf den
    // Posen des letzten Frames
    this.root.updateWorldMatrix(true, true);
    this.grappleGroup.updateWorldMatrix(true, true);
    for (const h of this.hydraulics) {
      h.a.getWorldPosition(this.tmpA);
      h.b.getWorldPosition(this.tmpB);
      this.tmpDir.copy(this.tmpB).sub(this.tmpA);
      const dist = Math.max(this.tmpDir.length(), 0.2);
      this.tmpDir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Excavator.UP, this.tmpDir);
      h.barrel.position.copy(this.tmpA).addScaledVector(this.tmpDir, h.barrelLen / 2);
      h.barrel.quaternion.copy(q);
      h.barrel.scale.set(1, h.barrelLen, 1);
      const rodLen = Math.max(dist - h.barrelLen + 0.15, 0.15);
      h.rod.position.copy(this.tmpB).addScaledVector(this.tmpDir, -rodLen / 2);
      h.rod.quaternion.copy(q);
      h.rod.scale.set(1, rodLen, 1);
    }
  }

  // ---------- Aufbau ----------

  private buildMeshes(): void {
    // Firmenfarbe PRIPADA: helles Umschlagbagger-Grün (Art Direction Kap. 16)
    const machineBlue = new THREE.MeshStandardMaterial({ color: 0x5bbf46, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8 });
    // Greifer-Farbgebung nach Vorbild: dunkle Hardox-Schalen, fast schwarze Kanten
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x40474b,
      roughness: 0.5,
      metalness: 0.55,
      side: THREE.DoubleSide, // Innenseite ist bei geöffneter Spinne sichtbar
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x23282b,
      roughness: 0.45,
      metalness: 0.7,
    });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.2 });

    // Chassis + 4 Räder
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 4.4), machineBlue);
    chassis.position.y = 1.15;
    chassis.castShadow = true;
    this.root.add(chassis);
    const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.5, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [
      [-1.25, 1.5],
      [1.25, 1.5],
      [-1.25, -1.5],
      [1.25, -1.5],
    ]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(x, 0.62, z);
      w.castShadow = true;
      this.root.add(w);
    }

    // Oberwagen: verglaste Hochkabine + Gegengewicht
    this.cabGroup.position.set(0, 1.6, 0);
    this.root.add(this.cabGroup);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.35, 3.2), dark);
    deck.position.y = 0.18;
    this.cabGroup.add(deck);
    this.buildCabin(machineBlue, dark, glass);
    // Motorhaube mit Lüftungsgittern + Gegengewicht (wie am Umschlagbagger)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 1.7), machineBlue);
    hood.position.set(0, 0.85, -1.0);
    hood.castShadow = true;
    this.cabGroup.add(hood);
    const louver = new THREE.MeshStandardMaterial({ color: 0x1f2224, roughness: 0.8 });
    for (const sx of [-1.27, 1.27]) {
      for (let i = 0; i < 4; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.12), louver);
        slot.position.set(sx, 0.9, -1.55 + i * 0.32);
        this.cabGroup.add(slot);
      }
    }
    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 0.7), dark);
    counterweight.position.set(0, 0.5, -2.0);
    counterweight.castShadow = true;
    this.cabGroup.add(counterweight);
    this.buildOutriggers(machineBlue, dark);

    // Ausleger
    this.boomGroup.position.copy(BOOM_PIVOT).sub(new THREE.Vector3(0, 1.6, 0)); // relativ zum Oberwagen
    this.cabGroup.add(this.boomGroup);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, BOOM_LEN), machineBlue);
    boom.position.z = BOOM_LEN / 2;
    boom.castShadow = true;
    this.boomGroup.add(boom);
    this.boomMesh = boom;
    this.buildBoomLogo();

    // Stiel
    this.stickGroup.position.z = BOOM_LEN;
    this.boomGroup.add(this.stickGroup);
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, STICK_LEN), machineBlue);
    stick.position.z = STICK_LEN / 2;
    stick.castShadow = true;
    this.stickGroup.add(stick);
    this.stickMesh = stick;
    this.stickTip.position.z = STICK_LEN;
    this.stickGroup.add(this.stickTip);

    // Kardan-Aufhängung: zwei ineinandergreifende Gelenkgabeln (90° verdreht)
    // zwischen Stielspitze und Spinne — statt eines schlichten Zylinders.
    const buildYoke = (y: number, alongX: boolean): void => {
      const yoke = new THREE.Group();
      yoke.position.y = y;
      if (!alongX) yoke.rotation.y = Math.PI / 2;
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.16), dark);
        plate.position.set(side * 0.1, -0.09, 0);
        plate.castShadow = true;
        yoke.add(plate);
      }
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), dark);
      pin.rotation.z = Math.PI / 2;
      pin.position.y = -0.16;
      yoke.add(pin);
      this.grappleGroup.add(yoke);
    };
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), dark);
    stub.position.y = -0.05;
    this.grappleGroup.add(stub);
    buildYoke(-0.1, true); // obere Gabel: Bolzen quer
    buildYoke(-0.3, false); // untere Gabel: 90° verdreht — greift in die obere
    // --- Greifspinne nach Fotoreferenz (Umschlagbagger-Bauart) ---
    // Von oben nach unten: Rotatorgehäuse, Guss-Traverse, Gelenkring, fünf
    // gebogene Sichelkrallen und in der Mitte der zentrale Eindringdorn.
    // Maße nach Datenblatt MG4.1-800-HO5 (800 l): Öffnungsweite d = 2225 mm,
    // Schalenkreis ØD = 2409 mm, Zylinderkreis ØC = 1514 mm, Gesamthöhe
    // A = 2363 mm. Alle Werte hier in Metern.
    // Gelenkkreis = ØC/2 aus dem Datenblatt (1514 mm). Segmentlänge und
    // Krümmung sind so gewählt, dass die Spitzen bei geschlossener Spinne
    // exakt in der Mitte zusammenkommen — vorher liefen sie übereinander.
    const RING_R = CLAW_RING_R;
    const CYL_R = 0.42; // Anlenkkreis der Zylinder am Gehäuse
    const ringY = CLAW_RING_Y;
    const SEG_LEN = CLAW_SEG_LEN;
    const SEG_BEND = CLAW_SEG_BEND;
    const SEGMENTS = 6;
    const segWidth = [0.4, 0.37, 0.33, 0.28, 0.22, 0.15];
    const segThick = [0.16, 0.15, 0.135, 0.12, 0.105, 0.085];

    const rotator = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.5), edgeMat);
    rotator.position.y = -0.48;
    rotator.castShadow = true;
    this.grappleGroup.add(rotator);
    const rotatorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12), shellMat);
    rotatorCap.position.y = -0.3;
    this.grappleGroup.add(rotatorCap);

    // Traverse: Stahlgussblock, nach unten verjüngt
    const traverse = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.5, 0.4, 5), shellMat);
    traverse.position.y = -0.75;
    traverse.rotation.y = Math.PI / 5;
    traverse.castShadow = true;
    this.grappleGroup.add(traverse);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.075, 8, 22), edgeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ringY;
    this.grappleGroup.add(ring);
    // Zentraler Eindringdorn
    const centerSpike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 4), edgeMat);
    centerSpike.position.y = ringY - 0.26;
    centerSpike.rotation.x = Math.PI;
    centerSpike.castShadow = true;
    this.grappleGroup.add(centerSpike);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(a) * RING_R, ringY, Math.cos(a) * RING_R);
      pivot.rotation.order = "YXZ";
      pivot.rotation.y = a; // lokales +Z zeigt radial nach außen

      const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), edgeMat);
      knuckle.position.y = 0.02;
      pivot.add(knuckle);

      // Sichelkralle: Kette gebogener Schalensegmente, zur Spitze verjüngt
      let parent: THREE.Object3D = pivot;
      for (let sIdx = 0; sIdx < SEGMENTS; sIdx++) {
        const seg = new THREE.Group();
        if (sIdx > 0) {
          seg.position.y = -SEG_LEN;
          seg.rotation.x = SEG_BEND;
        }
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(segWidth[sIdx], SEG_LEN + 0.04, segThick[sIdx]),
          shellMat
        );
        mesh.position.y = -SEG_LEN / 2;
        mesh.castShadow = true;
        seg.add(mesh);
        // dunkler Steg auf der Außenseite gibt der Schale Profil
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(segWidth[sIdx] + 0.03, SEG_LEN + 0.05, 0.045),
          edgeMat
        );
        edge.position.set(0, -SEG_LEN / 2, segThick[sIdx] / 2);
        seg.add(edge);
        parent.add(seg);
        parent = seg;
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 4), edgeMat);
      tip.position.y = -SEG_LEN - 0.08;
      tip.rotation.x = Math.PI;
      tip.castShadow = true;
      tip.name = "tineTip";
      parent.add(tip);

      // Hydraulikzylinder: Traverse → Krallen-Lagerbock
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.066, 0.066, 1, 10),
        new THREE.MeshStandardMaterial({ color: 0x62c94b, roughness: 0.4, metalness: 0.35 })
      );
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 1, 8),
        new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.22, metalness: 0.85 })
      );
      barrel.castShadow = true;
      this.grappleGroup.add(barrel);
      this.grappleGroup.add(rod);
      this.grappleCylinders.push({
        pivot,
        fromLocal: new THREE.Vector3(Math.sin(a) * CYL_R, -0.56, Math.cos(a) * CYL_R),
        toLocalOnShell: new THREE.Vector3(0, -0.3, 0.19),
        barrel,
        rod,
        barrelLen: 0.3,
      });

      this.grappleGroup.add(pivot);
      this.fingerPivots.push(pivot);
    }
  }

  /**
   * Verglaste Hochkabine mit Innenausbau (Kabinensicht, Briefing Kap. 5.2):
   * Rahmen + Glasflächen, Sitz, zwei Konsolen mit ISO-Joysticks, die die
   * Achseingaben live mitbewegen. Kabinenzentrum lokal (-0.6, *, 0.6).
   */
  private cabLinks: Array<{ a: THREE.Object3D; b: THREE.Object3D; mesh: THREE.Mesh }> = [];
  /** Alles am Fahrer außer Unterarmen/Händen — in der Ego-Sicht unsichtbar */
  private driverBody: THREE.Object3D[] = [];

  /**
   * Ego-Perspektive: In der Kabinenansicht sieht der Fahrer nur seine eigenen
   * Unterarme an den Joysticks, sonst nichts von sich selbst.
   */
  setFirstPerson(active: boolean): void {
    for (const o of this.driverBody) o.visible = !active;
  }
  /** Abstützpratzen: eingefahren (0) bis ausgefahren (1), Taste O */
  private outriggerGroups: THREE.Group[] = [];
  private outriggerDown = 1;
  private outriggerTarget = 1;
  /** true, solange der Spieler auf Stützen zu fahren versucht (für HUD/Ton) */
  blockedByOutriggers = false;
  /** Aufbockhöhe: so weit hebt sich die Maschine auf den Stützen (m) */
  static readonly JACK_UP_M = 0.34;

  private buildCabin(
    frameMat: THREE.MeshStandardMaterial,
    darkMat: THREE.MeshStandardMaterial,
    glassBase: THREE.MeshStandardMaterial
  ): void {
    // Kabine deutlich weiter nach links gesetzt, damit der Ausleger nicht ins
    // Blickfeld ragt (Design-Fix 2026-08-29)
    const cx = -1.05;
    const cz = 0.6;
    // Kabinenausleger (wie am Vorbild): zwei Parallelogramm-Lenker heben die
    // Kabine nach vorn-oben; sie bleibt dabei waagerecht.
    for (const rx of [-0.42, 0.42]) {
      const base = new THREE.Object3D();
      base.position.set(cx + rx, 0.35, cz - 1.35);
      this.cabGroup.add(base);
      const tip = new THREE.Object3D();
      tip.position.set(cx + rx, 0.5, cz - 0.72);
      this.cabLiftGroup.add(tip);
      // Lenker liegt in Weltkoordinaten (wird in buildHydraulics zur Szene gehängt)
      const link = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1), frameMat);
      link.castShadow = true;
      this.cabLinks.push({ a: base, b: tip, mesh: link });
    }
    // Alles Weitere sitzt im Hubschlitten und fährt mit der Kabine hoch
    this.cabGroup.add(this.cabLiftGroup);
    const glass = new THREE.MeshStandardMaterial({
      color: glassBase.color,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });

    // Boden: hinten Blech, vorn eine Glasscheibe im Fußbereich — so sieht der
    // Fahrer senkrecht nach unten auf den Greifer (Design-Wunsch 2026-08-29)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.75), darkMat);
    floor.position.set(cx, 0.58, cz - 0.33);
    this.cabLiftGroup.add(floor);
    // Fußscheibe: schräg eingesetzt, sie schließt vorn an die Frontscheibe an.
    // Rahmen: eine dünne Querstrebe in der Mitte, dazu zwei Randstreben, die
    // den Übergang zur Frontscheibe bilden.
    const footPane = new THREE.Group();
    footPane.position.set(cx, 0.6, cz + 0.36);
    footPane.rotation.x = -0.42; // Vorderkante höher, Anschluss an die Frontscheibe
    this.cabLiftGroup.add(footPane);
    const footGlass = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 0.7), glass);
    footPane.add(footGlass);
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.028, 0.045), darkMat);
    crossBar.position.y = 0.03;
    footPane.add(crossBar);
    for (const sx of [-0.5, 0.5]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.72), darkMat);
      edge.position.set(sx, 0.02, 0);
      footPane.add(edge);
    }
    // Dach: hinten Blech, vorn eine Querscheibe zum Blick nach oben auf den
    // Ausleger (Design-Wunsch 2026-08-29)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.85), frameMat);
    roof.position.set(cx, 2.1, cz - 0.32);
    roof.castShadow = true;
    this.cabLiftGroup.add(roof);
    // Vordere Dachscheibe um ~40° nach unten geneigt: sie führt vom Dach zur
    // Frontscheibe und gibt den Blick nach oben auf den Ausleger frei
    const roofGlass = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.04, 0.78), glass);
    roofGlass.position.set(cx, 1.98, cz + 0.42);
    roofGlass.rotation.x = THREE.MathUtils.degToRad(40);
    this.cabLiftGroup.add(roofGlass);
    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.05, 0.06), frameMat);
    roofBar.position.set(cx, 2.06, cz + 0.3);
    this.cabLiftGroup.add(roofBar);
    for (const [px, pz] of [
      [-0.52, -0.66],
      [0.52, -0.66],
      [-0.52, 0.66],
      [0.52, 0.66],
    ]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.08), frameMat);
      pillar.position.set(cx + px, 1.33, cz + pz);
      pillar.castShadow = true;
      this.cabLiftGroup.add(pillar);
    }
    // Glas: Front (bis in den Fußbereich hinunter), Heck, links, rechts
    const panes: Array<[number, number, number, number, number, number]> = [
      // [x, y, z, sx, sy, sz]
      [cx, 1.28, cz + 0.69, 1.0, 1.52, 0.03],
      [cx, 1.33, cz - 0.69, 1.0, 1.42, 0.03],
      [cx - 0.54, 1.33, cz, 0.03, 1.42, 1.3],
      [cx + 0.54, 1.33, cz, 0.03, 1.42, 1.3],
    ];
    for (const [x, y, z, sx, sy, sz] of panes) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), glass);
      pane.position.set(x, y, z);
      this.cabLiftGroup.add(pane);
    }

    // Bordinstrument rechts vorn an der Säule — zeigt Achswinkel, Hydraulik
    // und Greiferstatus, wie das Display in der echten Maschine
    this.buildInstrumentPanel(cx, cz);

    // Sitz + Konsolen
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.9 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), seatMat);
    seat.position.set(cx, 0.95, cz - 0.2);
    this.cabLiftGroup.add(seat);
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.1), seatMat);
    backrest.position.set(cx, 1.3, cz - 0.48);
    this.cabLiftGroup.add(backrest);
    // Kopfstütze
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.12), seatMat);
    headrest.position.set(cx, 1.76, cz - 0.47);
    headrest.castShadow = true;
    this.cabLiftGroup.add(headrest);
    for (const sx of [-0.09, 0.09]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8), darkMat);
      post.position.set(cx + sx, 1.63, cz - 0.47);
      this.cabLiftGroup.add(post);
    }
    for (const side of [-1, 1]) {
      const console = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.44), darkMat);
      console.position.set(cx + side * 0.36, 1.02, cz + 0.02);
      this.cabLiftGroup.add(console);
      // Moderner Kreuzhebel: Faltenbalg, ergonomischer Griff mit Daumentaste
      // und Vorderfinger-Wippe — statt Kugelknauf (Design-Wunsch 2026-08-29).
      const pivot = new THREE.Group();
      pivot.position.set(cx + side * 0.36, 1.16, cz + 0.1);
      const rubber = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.95 });
      const gripMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.45 });
      const accent = new THREE.MeshStandardMaterial({
        color: 0xd97a1f,
        roughness: 0.35,
        emissive: 0x3a1f00,
      });
      // Faltenbalg (drei Wülste)
      for (let b = 0; b < 3; b++) {
        const bellow = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055 - b * 0.006, 0.062 - b * 0.006, 0.035, 12),
          rubber
        );
        bellow.position.y = 0.03 + b * 0.037;
        pivot.add(bellow);
      }
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.12, 10), gripMat);
      shaft.position.y = 0.18;
      pivot.add(shaft);
      // Griff: leicht nach hinten geneigter, abgerundeter Körper
      const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.1, 4, 12), gripMat);
      grip.position.set(0, 0.29, -0.012);
      grip.rotation.x = -0.22;
      grip.castShadow = true;
      pivot.add(grip);
      // Daumentaste oben
      const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.014, 10), accent);
      thumb.position.set(0, 0.365, 0.012);
      thumb.rotation.x = -0.22;
      pivot.add(thumb);
      // Wippe für den Zeigefinger vorn
      const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, 0.018), accent);
      trigger.position.set(0, 0.285, 0.05);
      trigger.rotation.x = 0.25;
      pivot.add(trigger);

      // Unterarm und Hand hängen am Hebel: Sie kippen mit ihm mit und liegen
      // AUSSEN am Griff, nicht zwischen Fahrer und Joystick.
      const armSkin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
      // Nach Fotoreferenz: Unterarm läuft schräg von hinten-unten heran, die
      // Faust liegt oben auf dem Griff und umschließt ihn.
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.34, 4, 10), armSkin);
      forearm.position.set(side * 0.06, 0.28, -0.28);
      forearm.rotation.set(1.28, 0, side * 0.18);
      forearm.castShadow = true;
      pivot.add(forearm);
      // Faust: ein liegender, abgerundeter Block um den Griff, davor der
      // Daumen — einfache Formen, aber anatomisch plausibel
      const fist = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.075, 4, 10), armSkin);
      fist.position.set(0, 0.315, -0.01);
      fist.rotation.set(Math.PI / 2, 0, 0);
      fist.castShadow = true;
      pivot.add(fist);
      const thumbFinger = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.055, 4, 8), armSkin);
      thumbFinger.position.set(-side * 0.042, 0.318, 0.035);
      thumbFinger.rotation.set(1.35, 0, side * 0.35);
      pivot.add(thumbFinger);

      this.cabLiftGroup.add(pivot);
      if (side < 0) this.joyLeft = pivot;
      else this.joyRight = pivot;
    }

    this.buildDriver(cx, cz);
    this.buildNamePlate(cx, cz);

    // Augpunkt der Kabinenkamera: Kopf an der Lehne, Konsolen liegen im Blickfeld
    this.cabinEye.position.set(cx, 1.68, cz - 0.4);
    this.cabLiftGroup.add(this.cabinEye);
  }

  /**
   * Fahrerfigur „Daniel" im Sitz — stilisierte Low-Poly-Figur im Artstyle des
   * Spiels. In der Kabinenansicht wird der Kopf ausgeblendet, damit er nicht
   * vor der Kamera steht.
   */
  private buildDriver(cx: number, cz: number): void {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.85 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x3d4b5c, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.95 });

    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    this.cabLiftGroup.add(g);

    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0
    ): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Von außen ist Daniel komplett zu sehen; in der Ego-Sicht bleiben nur die
    // Unterarme stehen. Alles aus runden Grundformen (Kapseln/Kugeln).
    const body: THREE.Object3D[] = [];
    body.push(add(new THREE.CapsuleGeometry(0.16, 0.3, 4, 12), shirt, 0, 1.42, -0.24));
    body.push(add(new THREE.SphereGeometry(0.17, 12, 10), shirt, 0, 1.58, -0.24)); // Schultern
    // Sitzende Beine (nur von außen sichtbar)
    body.push(add(new THREE.CapsuleGeometry(0.12, 0.12, 4, 10), jeans, 0, 1.12, -0.16));
    for (const sx of [-0.1, 0.1]) {
      body.push(add(new THREE.CapsuleGeometry(0.07, 0.26, 4, 10), jeans, sx, 1.1, 0.02, Math.PI / 2));
      body.push(add(new THREE.CapsuleGeometry(0.065, 0.24, 4, 10), jeans, sx, 0.88, 0.2));
      body.push(add(new THREE.SphereGeometry(0.075, 10, 8), boot, sx, 0.7, 0.26));
    }
    for (const sx of [-1, 1] as const) {
      // Oberarm gehört zum Körper, Unterarm + Hand bleiben in der Ego-Sicht
      body.push(
        add(new THREE.CapsuleGeometry(0.058, 0.22, 4, 10), shirt, sx * 0.29, 1.44, -0.18, 0, sx * 0.28)
      );
      // Unterarm und Hand sitzen am Joystick selbst (siehe buildCabin) und
      // bewegen sich mit ihm — der Oberarm bleibt am Körper.
    }
    // Hals, Kopf, Haare, Lederband
    body.push(add(new THREE.CapsuleGeometry(0.05, 0.06, 4, 10), skin, 0, 1.73, -0.25));
    const head = add(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 1.87, -0.25);
    head.scale.set(1, 1.12, 1.02);
    body.push(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 12), hair);
    hairCap.position.set(0, 1.9, -0.26);
    hairCap.scale.set(1, 0.95, 1.02);
    g.add(hairCap);
    body.push(hairCap);
    // kurze Haare — nur ein flacher Nackenansatz, kein Zopf
    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hair);
    nape.position.set(0, 1.84, -0.3);
    nape.scale.set(1, 0.7, 0.7);
    g.add(nape);
    body.push(nape);
    const necklace = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.01, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.7 })
    );
    necklace.rotation.x = Math.PI / 2;
    necklace.position.set(0, 1.65, -0.23);
    g.add(necklace);
    body.push(necklace);
    this.driverBody = body;
  }

  /**
   * Abstützpratzen (Design nach Vorbildfoto 2026-08-29): vier ausgestellte
   * Stützbeine mit Hydraulikzylinder und Tellerfuß — das prägende Merkmal
   * eines Umschlagbaggers. Rein visuell, das Abstützen wird nicht simuliert.
   */
  private buildOutriggers(
    frameMat: THREE.MeshStandardMaterial,
    darkMat: THREE.MeshStandardMaterial
  ): void {
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xb8bec4,
      roughness: 0.25,
      metalness: 0.8,
    });
    const UP = new THREE.Vector3(0, 1, 0);
    for (const [sx, sz] of [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ] as const) {
      // Ansatz am Unterwagen → Fußpunkt schräg nach außen unten
      const from = new THREE.Vector3(sx * 1.05, 0.95, sz * 1.5);
      const to = new THREE.Vector3(sx * 2.35, 0.62, sz * 2.5);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, len), darkMat);
      arm.position.copy(from).addScaledVector(dir.clone().normalize(), len / 2);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
      arm.castShadow = true;
      this.root.add(arm);
      // Stempel + Tellerfuß in einer Gruppe — fahren gemeinsam ein und aus
      const foot = new THREE.Group();
      foot.position.set(to.x, 0, to.z);
      this.root.add(foot);
      this.outriggerGroups.push(foot);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10), frameMat);
      cyl.position.y = 0.42;
      cyl.castShadow = true;
      foot.add(cyl);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.35, 8), rodMat);
      rod.position.y = 0.14;
      foot.add(rod);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.14, 12), darkMat);
      pad.position.y = 0.07;
      pad.castShadow = true;
      foot.add(pad);
      void UP;
    }
  }

  /** Dezentes Fahrerschild außen an der Kabinentür: „BAGGERFAHRER — DANIEL". */
  private buildNamePlate(cx: number, cz: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1b1f22";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#c8cdd1";
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.textAlign = "center";
    ctx.fillStyle = "#9aa2a8";
    ctx.font = "bold 30px 'Arial Black', Impact, sans-serif";
    ctx.fillText("BAGGERFAHRER", canvas.width / 2, 58);
    ctx.fillStyle = "#eef1f3";
    ctx.font = "bold 58px 'Arial Black', Impact, sans-serif";
    ctx.fillText("DANIEL", canvas.width / 2, 118);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.19),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
    );
    plate.position.set(cx - 0.56, 1.0, cz - 0.12);
    plate.rotation.y = -Math.PI / 2;
    this.cabLiftGroup.add(plate);
  }

  /** „PRIPADA" in weißer Blockschrift auf beiden Auslegerflanken. */
  private buildBoomLogo(): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 160px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "12px";
    ctx.fillText("PRIPADA", 40, canvas.height / 2 + 6);
    // Signet rechts neben der Wortmarke
    const sx0 = 880;
    const sy0 = canvas.height / 2;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(sx0, sy0, 78, -Math.PI / 2, Math.PI * 0.75);
    ctx.stroke();
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(sx0 - 13, sy0 - 7, 40, Math.PI * 0.5, Math.PI * 1.75);
    ctx.stroke();
    ctx.fillRect(sx0 - 35, sy0 - 7, 22, 92);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (const side of [-1, 1] as const) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.52), mat);
      plane.position.set(side * 0.216, 0.03, BOOM_LEN * 0.46);
      plane.rotation.y = (side * Math.PI) / 2;
      this.boomGroup.add(plane);
    }
  }

  private buildBodies(world: RAPIER.World): void {
    this.chassisBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y + 1.15,
        this.position.z
      )
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.75, 2.2), this.chassisBody);

    // Ausleger + Stiel als kinematische Kollider — der Kran schiebt Schrott
    // beiseite, statt hindurchzutauchen
    this.boomBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.21, 0.31, BOOM_LEN / 2 - 0.1),
      this.boomBody
    );
    this.stickBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.16, 0.225, STICK_LEN / 2 - 0.1),
      this.stickBody
    );

    this.physicsWorld = world;
    this.armShapes = [
      { mesh: () => this.boomMesh, half: [0.21, 0.31, BOOM_LEN / 2 - 0.1] },
      { mesh: () => this.stickMesh, half: [0.16, 0.225, STICK_LEN / 2 - 0.1] },
    ];

    this.grappleBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.22, 0.5).setTranslation(0, -GRAPPLE_LINK - 0.2, 0),
      this.grappleBody
    );
    // Die Krallen bekommen eigene Kollider — je zwei Kapseln bilden die Sichel
    // grob nach. Ohne sie fuhr die Spinne sichtbar durch Schrottteile hindurch.
    for (let i = 0; i < CLAW_COUNT * 2; i++) {
      this.clawColliders.push(
        world.createCollider(RAPIER.ColliderDesc.capsule(0.16, 0.1), this.grappleBody)
      );
    }
  }

  /**
   * Krallen-Kollider der aktuellen Öffnung nachführen. Beim Tragen werden sie
   * abgeschaltet: die Last hängt am Gelenk und würde sonst herausgequetscht.
   */
  private updateClawColliders(splay: number): void {
    const carrying = this.carriedCount > 0;
    for (let c = 0; c < CLAW_COUNT; c++) {
      const a = (c / CLAW_COUNT) * Math.PI * 2;
      for (let h = 0; h < 2; h++) {
        const col = this.clawColliders[c * 2 + h];
        col.setEnabled(!carrying);
        if (carrying) continue;
        clawPoint(a, splay, h * (CLAW_SEGMENTS / 2), this.clawA);
        clawPoint(a, splay, (h + 1) * (CLAW_SEGMENTS / 2), this.clawB);
        this.clawMid.addVectors(this.clawA, this.clawB).multiplyScalar(0.5);
        this.clawDir.subVectors(this.clawB, this.clawA);
        const len = this.clawDir.length();
        if (len < 1e-4) continue;
        this.clawDir.divideScalar(len);
        this.clawQuat.setFromUnitVectors(UP_Y, this.clawDir);
        col.setHalfHeight(Math.max(len / 2 - 0.1, 0.03));
        col.setTranslationWrtParent(this.clawMid);
        col.setRotationWrtParent(this.clawQuat);
      }
    }
  }

  // ---------- Simulation ----------

  /** Einmal pro Render-Frame: diskrete Eingaben (Mausrad-Rotator, Kabinenhub). */
  handleDiscreteInput(input: Input): void {
    if (!input.shiftHeld && input.wheelDelta !== 0) {
      this.rotatorYaw += input.wheelDelta * ROTATOR_STEP;
    }
    
    if (input.wasPressed("KeyX")) this.toggleCabLift();
    if (input.wasPressed("KeyO")) this.toggleOutriggers();
  }

  /** Kabine hoch-/runterfahren (Taste X oder Touch-Knopf). */
  toggleCabLift(): void {
    this.cabLiftTarget = this.cabLiftTarget > 0.1 ? 0 : CAB_LIFT_MAX;
  }

  /** Abstützpratzen aus-/einfahren (Taste O oder Touch-Knopf). */
  toggleOutriggers(): void {
    this.outriggerTarget = this.outriggerTarget > 0.5 ? 0 : 1;
  }

  /** Aktuelle Kabinenhöhe (0 = unten) — fürs HUD. */
  get cabLiftHeight(): number {
    return this.cabLift;
  }

  /** Ein fester Physik-Step (dt = 1/60). Reihenfolge: Achsen → Meshes → kinematische Körper. */
  update(dt: number, input: Input): void {
    // Lastfaktor (Briefing 6.1): 1 − 0,5 × (Last / 2000 kg)
    const loadFactor = 1 - 0.5 * Math.min(this.carriedMassKg / 2000, 1);
    // Zustand vor der Bewegung merken (für die Fahrzeug-Sperre unten)
    const prevBoom = this.boomAngle;
    const prevStick = this.stickAngle;
    const prevCabYaw = this.cabYaw;
    const prevPos = this.tmpPrevPos.copy(this.position);

    // --- Fahrwerk ---
    // Auf ausgefahrenen Stützen steht die Maschine aufgebockt — dann wird
    // nicht gefahren, so wie es sich gehört.
    const wantsDrive = clamp1(input.axis("KeyS", "KeyW") + (this.touch?.drive ?? 0));
    const rawSteer = clamp1(input.axis("KeyA", "KeyD") + (this.touch?.steer ?? 0));
    this.blockedByOutriggers =
      this.outriggerDown > 0.15 && (wantsDrive !== 0 || rawSteer !== 0);
    const locked = this.outriggerDown > 0.15;
    const driveTarget = (locked ? 0 : wantsDrive) * DRIVE_MAX;
    this.driveVel = ramp(this.driveVel, driveTarget, (DRIVE_MAX / RAMP_TIME) * dt);
    const steer = locked ? 0 : rawSteer;
    if (Math.abs(this.driveVel) > 0.05 || steer !== 0) {
      const dir = this.driveVel >= 0 ? 1 : -1;
      const speedFactor = THREE.MathUtils.clamp(Math.abs(this.driveVel) / DRIVE_MAX, 0.35, 1);
      this.heading -= steer * STEER_RATE * speedFactor * dir * dt;
    }
    this.position.x += Math.sin(this.heading) * this.driveVel * dt;
    this.position.z += Math.cos(this.heading) * this.driveVel * dt;

    // --- Oberwagen / Ausleger / Stiel (mit Last-Trägheit) ---
    // Zweitbelegung Pfeil-Block (einhändiges Testen): ←/→ Oberwagen,
    // ↑/↓ Stiel, Bild↑/Bild↓ Ausleger
    // Tastatur + Touch-Sticks auf dieselben Achsen
    const t = this.touch;
    if (t?.rotator) this.rotatorYaw += t.rotator * ROTATOR_STEP * 0.06; // Dauerdrehung, ~54°/s
    this.inCab = clamp1(axis2(input, "KeyE", "KeyQ", "ArrowRight", "ArrowLeft") + (t?.cab ?? 0));
    this.inBoom = clamp1(axis2(input, "KeyF", "KeyR", "PageDown", "PageUp") + (t?.boom ?? 0));
    this.inStick = clamp1(axis2(input, "KeyG", "KeyT", "ArrowDown", "ArrowUp") + (t?.stick ?? 0));
    const cabTarget = this.inCab * CAB_MAX * loadFactor;
    this.cabVel = ramp(this.cabVel, cabTarget, (CAB_MAX / RAMP_TIME) * dt);
    this.cabYaw += this.cabVel * dt;

    const boomTarget = this.inBoom * BOOM_RATE * loadFactor;
    this.boomVel = ramp(this.boomVel, boomTarget, (BOOM_RATE / RAMP_TIME) * dt);
    this.boomAngle = THREE.MathUtils.clamp(this.boomAngle + this.boomVel * dt, BOOM_MIN, BOOM_MAX);

    const stickTarget = this.inStick * STICK_RATE * loadFactor;
    this.stickVel = ramp(this.stickVel, stickTarget, (STICK_RATE / RAMP_TIME) * dt);
    this.stickAngle = THREE.MathUtils.clamp(
      this.stickAngle + this.stickVel * dt,
      STICK_MIN,
      STICK_MAX
    );

    // --- Spinne ---
    // Spinne: Tastatur, Maus und Druckgriff schließen mit voller Kraft.
    // Der rechte Stick arbeitet stufenlos — je weiter der Ausschlag, desto
    // schneller schließt bzw. öffnet die Spinne; neutral hält den Zustand.
    const cmd = this.touch?.grapple ?? 0;
    const held = input.mouseHeld(0) || input.isDown("Space") || (this.touch?.grab ?? false);
    // für die Hebelanimation in der Kabine
    this.inGrapple = held ? 1 : THREE.MathUtils.clamp(cmd, -1, 1);
    let closeRate: number;
    if (held) {
      closeRate = dt / CLOSE_TIME;
      this.grappleHold = true;
    } else if (cmd !== 0) {
      const intensity = Math.min(Math.abs(cmd), 1);
      closeRate = cmd > 0 ? (intensity * dt) / CLOSE_TIME : (-intensity * dt) / OPEN_TIME;
      this.grappleHold = cmd > 0;
    } else if (this.touch) {
      closeRate = 0; // Stick neutral: Position halten
    } else {
      closeRate = -dt / OPEN_TIME; // Tastatur losgelassen: öffnet
      this.grappleHold = false;
    }
    this.closure = THREE.MathUtils.clamp(this.closure + closeRate, 0, 1);
    // „closing" steuert das Greifsystem: Zupacken solange die Spinne schließt
    // oder geschlossen gehalten wird
    this.closing = held || closeRate > 0 || (this.grappleHold && this.closure > 0.5);

    // Kabinenhub fährt gleichmäßig auf die Zielhöhe
    const liftStep = CAB_LIFT_SPEED * dt;
    this.cabLift += THREE.MathUtils.clamp(this.cabLiftTarget - this.cabLift, -liftStep, liftStep);
    // Abstützpratzen ein-/ausfahren
    const outStep = dt / 2.2;
    this.outriggerDown += THREE.MathUtils.clamp(
      this.outriggerTarget - this.outriggerDown,
      -outStep,
      outStep
    );
    // Aufbocken: die ganze Maschine steigt auf den Stützen. Über position.y
    // wandern Arm, Greifer und Physikkörper mit — nur die Optik anzuheben
    // würde den Greifer von seinem Kollider trennen.
    this.position.y = this.outriggerDown * Excavator.JACK_UP_M;

    this.resolveGroundClamp();
    this.syncMeshes();

    // Arm darf nicht im LKW verschwinden: Bewegung zurücknehmen, wenn er
    // Fahrzeugteile schneiden würde
    if (this.obstacleBodies.size > 0 && this.armHitsObstacle()) {
      this.armBlocked = true;
      this.boomAngle = prevBoom;
      this.stickAngle = prevStick;
      this.cabYaw = prevCabYaw;
      this.position.copy(prevPos);
      this.boomVel = 0;
      this.stickVel = 0;
      this.cabVel = 0;
      this.driveVel = 0;
      this.syncMeshes();
    } else {
      this.armBlocked = false;
    }

    this.integratePendulum(dt);
    this.syncBodies();

    if (this.groundContact.active) {
      this.groundContact.point.set(
        this.grappleGroup.position.x,
        0.05,
        this.grappleGroup.position.z
      );
    }
  }

  /**
   * Boden ist immer harter Widerstand (Kap. 6.1): Ausleger/Stiel werden so
   * geklemmt, dass die Zackenspitzen nie unter den Boden geraten. Kontakt bei
   * gleichzeitiger Dreh-/Fahrbewegung liefert die Kratz-Intensität für
   * Sound + Staub/Funken.
   */
  /**
   * Aktuelle Spreizung der Schalen. Geschlossen legen sie sich zur Kalotte
   * zusammen — es sei denn, es liegt Material darin: dann bleibt die Spinne
   * so weit offen, wie die Ladung Platz braucht.
   */
  private currentSplay(): number {
    const minSplay = Math.min(
      0.5,
      this.carriedCount * 0.06 + Math.min(this.carriedMassKg / 2000, 1) * 0.28
    );
    return THREE.MathUtils.lerp(CLAW_OPEN_SPLAY, minSplay, this.closure);
  }

  private groundTmp = new THREE.Vector3();

  private resolveGroundClamp(): void {
    // Spitzentiefe direkt aus der Krallengeometrie — so bleibt der Bodenanschlag
    // richtig, auch wenn sich Form oder Öffnungswinkel ändern.
    const tipDepth = -clawPoint(0, this.currentSplay(), CLAW_SEGMENTS, this.groundTmp).y;
    // tipY() rechnet ab der Maschinenbasis; steht die Maschine aufgebockt,
    // ist der Boden entsprechend weiter unten
    const minTipY = tipDepth + 0.02 - this.position.y;
    const tipY = () =>
      BOOM_PIVOT.y +
      BOOM_LEN * Math.sin(this.boomAngle) +
      STICK_LEN * Math.sin(this.boomAngle + this.stickAngle);

    let clamped = false;
    let guard = 0;
    while (tipY() < minTipY && guard++ < 80) {
      clamped = true;
      const total = this.boomAngle + this.stickAngle;
      const dStick = STICK_LEN * Math.cos(total);
      const canStick =
        Math.abs(dStick) > 0.4 &&
        ((dStick > 0 && this.stickAngle < STICK_MAX - 0.002) ||
          (dStick < 0 && this.stickAngle > STICK_MIN + 0.002));
      if (canStick) {
        this.stickAngle += Math.sign(dStick) * 0.004;
      } else if (this.boomAngle < BOOM_MAX - 0.002) {
        this.boomAngle += 0.004;
      } else {
        break;
      }
    }

    if (clamped) {
      // abwärts gerichtete Achsgeschwindigkeiten hart stoppen
      const total = this.boomAngle + this.stickAngle;
      const dBoom = BOOM_LEN * Math.cos(this.boomAngle) + STICK_LEN * Math.cos(total);
      const dStick = STICK_LEN * Math.cos(total);
      if (this.boomVel * dBoom < 0) this.boomVel = 0;
      if (this.stickVel * dStick < 0) this.stickVel = 0;
    }
    // Kontakt gilt auch beim Aufliegen (Spitzen ruhen auf dem Boden), nicht nur
    // beim aktiven Hineindrücken — sonst bleibt das Kratzen beim Drehen stumm.
    const resting = tipY() < minTipY + 0.04;
    this.groundContact.active = clamped || resting;
    this.groundContact.intensity = this.groundContact.active
      ? Math.min(1, (Math.abs(this.cabVel) * 9 + Math.abs(this.driveVel) * 1.5) / 3)
      : 0;
  }

  private syncMeshes(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
    this.cabGroup.rotation.y = this.cabYaw;
    // Kabine fährt am Ausleger nach oben UND ein Stück nach vorn
    this.cabLiftGroup.position.y = this.cabLift;
    this.cabLiftGroup.position.z = this.cabLift * 0.34;
    for (const g of this.outriggerGroups) {
      g.position.y = (1 - this.outriggerDown) * 0.72; // eingefahren = angehoben
    }
    // Kabinen-Lenker zwischen Oberwagen und Kabinenschlitten ausrichten
    for (const l of this.cabLinks) {
      l.a.updateWorldMatrix(true, false);
      l.b.updateWorldMatrix(true, false);
      l.a.getWorldPosition(this.tmpA);
      l.b.getWorldPosition(this.tmpB);
      this.tmpDir.copy(this.tmpB).sub(this.tmpA);
      const len = Math.max(this.tmpDir.length(), 0.2);
      this.tmpDir.normalize();
      l.mesh.position.copy(this.tmpA).addScaledVector(this.tmpDir, len / 2);
      l.mesh.quaternion.setFromUnitVectors(Excavator.UP, this.tmpDir);
      l.mesh.scale.set(1, len, 1);
    }
    this.boomGroup.rotation.x = -this.boomAngle;
    this.stickGroup.rotation.x = -this.stickAngle;

    // Greifer lotrecht unter die Stielspitze setzen
    const tip = new THREE.Vector3();
    this.stickTip.getWorldPosition(tip);
    this.grappleGroup.position.copy(tip);
    this.grappleGroup.rotation.set(0, this.heading + this.cabYaw + this.rotatorYaw, 0);

    // Zacken: offen weit gespreizt. Geschlossen fügen sich die Schalen zur
    // dichten Kalotte — es sei denn, es liegt Material darin: dann bleibt die
    // Spinne so weit offen, wie die Ladung Platz braucht.
    const splay = this.currentSplay();
    for (const pivot of this.fingerPivots) {
      pivot.rotation.x = -splay;
    }
    this.updateClawColliders(splay);

    this.updateHydraulics();

    this.updateGrappleCylinders();

    // Joysticks samt Unterarmen kippen genau so, wie der Spieler steuert:
    // links Hauptarm und Oberwagen, rechts Ausleger und Spinne. Vorher stand
    // hier noch die alte Belegung, weshalb die Hände nicht zur Bewegung passten.
    if (this.joyLeft && this.joyRight) {
      const tilt = 0.35;
      // Achse hoch (+1) → Hebel nach vorn, wie beim Wischen nach oben
      this.joyLeft.rotation.x = this.inBoom * tilt;
      this.joyLeft.rotation.z = this.inCab * tilt; // rechts = Oberwagen rechts
      this.joyRight.rotation.x = this.inStick * tilt;
      this.joyRight.rotation.z = this.inGrapple * tilt; // rechts = schließen
    }
  }

  /**
   * Gedämpftes Pendel am Kardan-Gelenk (Design-Wunsch 2026-08-27): Die Spinne
   * schwenkt aus, angetrieben von der Beschleunigung der Stielspitze —
   * Fliehkraft beim Drehen, Ruck beim Anfahren/Stoppen. Schwere Last pendelt
   * länger nach (weniger Dämpfung). Am Boden aufliegend beruhigt sie sich sofort.
   */
  private integratePendulum(dt: number): void {
    const tip = this.grappleGroup.position;
    if (!this.pendulumInit) {
      this.prevTip.copy(tip);
      this.pendulumInit = true;
    }
    const velX = (tip.x - this.prevTip.x) / dt;
    const velZ = (tip.z - this.prevTip.z) / dt;
    // Teleport (Tests/Spawns): Pendel nicht mit Riesenimpuls füttern
    if (Math.hypot(velX, velZ) > 30) {
      this.swingVel.set(0, 0);
      this.prevTipVel.set(velX, 0, velZ);
      this.prevTip.copy(tip);
      return;
    }
    const CAP = 15; // m/s² (SW)
    const ax = THREE.MathUtils.clamp((velX - this.prevTipVel.x) / dt, -CAP, CAP);
    const az = THREE.MathUtils.clamp((velZ - this.prevTipVel.z) / dt, -CAP, CAP);
    this.prevTipVel.set(velX, 0, velZ);
    this.prevTip.copy(tip);

    const L = 1.5; // wirksame Pendellänge Gelenk→Lastschwerpunkt (SW)
    const G = 9.81;
    // schwere Last: weniger Dämpfung → längeres Nachpendeln (SW)
    const damping = THREE.MathUtils.lerp(2.4, 0.9, Math.min(this.carriedMassKg / 2000, 1));
    this.swingVel.x += (-(G / L) * Math.sin(this.swing.x) - damping * this.swingVel.x + az / L) * dt;
    this.swingVel.y += (-(G / L) * Math.sin(this.swing.y) - damping * this.swingVel.y - ax / L) * dt;
    this.swing.x = THREE.MathUtils.clamp(this.swing.x + this.swingVel.x * dt, -0.45, 0.45);
    this.swing.y = THREE.MathUtils.clamp(this.swing.y + this.swingVel.y * dt, -0.45, 0.45);
    if (this.groundContact.active) {
      this.swing.multiplyScalar(0.75);
      this.swingVel.multiplyScalar(0.5);
    }

    const yaw = this.heading + this.cabYaw + this.rotatorYaw;
    const qYaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
    const qTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.swing.x, 0, this.swing.y));
    this.grappleGroup.quaternion.copy(qTilt).multiply(qYaw);
  }

  private cylA = new THREE.Vector3();
  private cylB = new THREE.Vector3();
  private cylDir = new THREE.Vector3();

  /**
   * Zylinder zwischen Traversen-Gelenk und Schale ausrichten — alles im
   * lokalen Spinnenraum, damit sie beim Pendeln nicht nachhinken.
   */
  private updateGrappleCylinders(): void {
    for (const c of this.grappleCylinders) {
      this.cylA.copy(c.fromLocal);
      this.cylB.copy(c.toLocalOnShell).applyEuler(c.pivot.rotation).add(c.pivot.position);
      this.cylDir.copy(this.cylB).sub(this.cylA);
      const dist = Math.max(this.cylDir.length(), 0.2);
      this.cylDir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Excavator.UP, this.cylDir);
      c.barrel.position.copy(this.cylA).addScaledVector(this.cylDir, c.barrelLen / 2);
      c.barrel.quaternion.copy(q);
      c.barrel.scale.set(1, c.barrelLen, 1);
      const rodLen = Math.max(dist - c.barrelLen + 0.08, 0.08);
      c.rod.position.copy(this.cylB).addScaledVector(this.cylDir, -rodLen / 2);
      c.rod.quaternion.copy(q);
      c.rod.scale.set(1, rodLen, 1);
    }
  }

  private syncBodies(): void {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.heading, 0));
    this.chassisBody.setNextKinematicTranslation({
      x: this.position.x,
      y: this.position.y + 1.15,
      z: this.position.z,
    });
    this.chassisBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    // Arm-Kollider den Meshes nachführen
    for (const [mesh, body] of [
      [this.boomMesh, this.boomBody],
      [this.stickMesh, this.stickBody],
    ] as const) {
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(this.armPos);
      mesh.getWorldQuaternion(this.armQuat);
      body.setNextKinematicTranslation(this.armPos);
      body.setNextKinematicRotation({
        x: this.armQuat.x,
        y: this.armQuat.y,
        z: this.armQuat.z,
        w: this.armQuat.w,
      });
    }

    const gq = this.grappleGroup.quaternion;
    this.grappleBody.setNextKinematicTranslation({
      x: this.grappleGroup.position.x,
      y: this.grappleGroup.position.y,
      z: this.grappleGroup.position.z,
    });
    this.grappleBody.setNextKinematicRotation({ x: gq.x, y: gq.y, z: gq.z, w: gq.w });
  }

  /** Achs-Aktivität 0..1 — treibt Motor-/Hydrauliksound (Kap. 15). */
  get activity(): number {
    return Math.min(
      1,
      Math.abs(this.driveVel) / DRIVE_MAX +
        Math.abs(this.cabVel) / CAB_MAX +
        Math.abs(this.boomVel) / BOOM_RATE +
        Math.abs(this.stickVel) / STICK_RATE
    );
  }

  /** Weltposition des Greif-Sensors (zwischen den Fingerspitzen) — pendelt mit. */
  private instrCanvas: HTMLCanvasElement | null = null;
  private instrTex: THREE.CanvasTexture | null = null;
  private instrT = 0;

  /**
   * Bordinstrument: eine Leinwand-Textur auf einer Platte an der rechten
   * Säule. Sie wird viermal je Sekunde neu gezeichnet — häufiger bringt nichts
   * und kostet nur Zeit.
   */
  private buildInstrumentPanel(cx: number, cz: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 224;
    this.instrCanvas = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.instrTex = tex;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.26, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.7 })
    );
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.33, 0.23),
      // unbeleuchtet: ein Display leuchtet selbst und soll nicht abdunkeln
      new THREE.MeshBasicMaterial({ map: tex })
    );
    screen.position.z = 0.012;
    const holder = new THREE.Group();
    holder.add(frame, screen);
    // Rechts neben dem Fahrer: er blickt in +Z, seine rechte Seite ist −X.
    // Tief genug, dass das Display nicht in die Arbeitssicht ragt.
    holder.position.set(cx - 0.42, 1.16, cz + 0.46);
    holder.rotation.y = 2.55; // Bildfläche zum Fahrer gedreht
    holder.rotation.x = -0.3; // leicht nach hinten gekippt, wie im Armaturenbrett
    this.cabLiftGroup.add(holder);
    this.drawInstruments();
  }

  /** Anzeigen auffrischen (aus der Hauptschleife, gedrosselt). */
  updateInstruments(dt: number): void {
    this.instrT += dt;
    if (this.instrT < 0.25) return;
    this.instrT = 0;
    this.drawInstruments();
  }

  private drawInstruments(): void {
    const c = this.instrCanvas;
    if (!c) return;
    const x = c.getContext("2d");
    if (!x) return;
    const W = c.width;
    const H = c.height;
    x.fillStyle = "#0f1417";
    x.fillRect(0, 0, W, H);

    // Kopfzeile
    x.fillStyle = "#1b2429";
    x.fillRect(0, 0, W, 30);
    x.fillStyle = "#7ec96a";
    x.font = "bold 17px Consolas, monospace";
    x.fillText("PRIPADA", 10, 21);
    x.fillStyle = "#8d979d";
    x.font = "13px Consolas, monospace";
    x.fillText(this.outriggerDown > 0.85 ? "ABGESTÜTZT" : "FAHRBETRIEB", 108, 21);

    const deg = (r: number): number => Math.round(THREE.MathUtils.radToDeg(r));
    const rows: Array<[string, string]> = [
      ["Oberwagen", `${Math.abs(deg(this.cabYaw) % 360)}°`],
      ["Hauptarm", `${deg(this.boomAngle)}°`],
      ["Ausleger", `${deg(this.stickAngle)}°`],
    ];
    x.font = "14px Consolas, monospace";
    rows.forEach(([label, value], i) => {
      const y = 54 + i * 26;
      x.fillStyle = "#8d979d";
      x.fillText(label, 10, y);
      x.fillStyle = "#e8e8e4";
      x.fillText(value, 130, y);
    });

    // Hydraulikdruck steigt mit Last und Achsbewegung
    const bar = Math.round(90 + this.activity * 120 + Math.min(this.carriedMassKg / 40, 90));
    x.fillStyle = "#8d979d";
    x.fillText("Hydraulik", 10, 132);
    x.fillStyle = bar > 260 ? "#e0864a" : "#e8e8e4";
    x.fillText(`${bar} bar`, 130, 132);
    // Balken
    x.fillStyle = "#232c31";
    x.fillRect(10, 140, 180, 8);
    x.fillStyle = bar > 260 ? "#e0864a" : "#7ec96a";
    x.fillRect(10, 140, Math.min(180, (bar / 320) * 180), 8);

    // Greiferstatus
    x.fillStyle = "#8d979d";
    x.fillText("Spinne", 10, 172);
    const zu = this.closure > 0.85;
    x.fillStyle = zu ? "#e0c14a" : "#7ec96a";
    x.fillText(
      this.carriedCount > 0
        ? `beladen · ${Math.round(this.carriedMassKg)} kg`
        : zu
          ? "geschlossen"
          : this.closure < 0.15
            ? "offen"
            : `${Math.round(this.closure * 100)} %`,
      130,
      172
    );

    // Öltemperatur — steigt langsam mit der Arbeit
    x.fillStyle = "#8d979d";
    x.fillText("Öltemperatur", 10, 200);
    x.fillStyle = "#e8e8e4";
    x.fillText(`${Math.round(44 + this.activity * 14)} °C`, 130, 200);

    if (this.instrTex) this.instrTex.needsUpdate = true;
  }

  getSensorPosition(out: THREE.Vector3): THREE.Vector3 {
    return out
      .set(0, -GRAPPLE_LINK - 0.2 - PALM_TO_SENSOR, 0)
      .applyQuaternion(this.grappleGroup.quaternion)
      .add(this.grappleGroup.position);
  }

  private basketTmp = new THREE.Vector3();
  private basketTip = new THREE.Vector3();
  private basketQuatInv = new THREE.Quaternion();

  /**
   * Liegt der Weltpunkt wirklich im Schalenkorb?
   *
   * Vorher genügte eine Kugel um den Greifer, wodurch Material angehoben wurde,
   * das gar nicht zwischen den Schalen lag — es schwebte sichtbar darunter.
   * Jetzt wird gegen die tatsächliche Krallengeometrie geprüft: oben der
   * Gelenkring, unten die Spitzen, seitlich der Kreis, den die Krallen bei der
   * aktuellen Öffnung aufspannen.
   */
  isInsideGrapple(worldPoint: THREE.Vector3): boolean {
    const p = this.basketTmp
      .copy(worldPoint)
      .sub(this.grappleGroup.position)
      .applyQuaternion(this.basketQuatInv.copy(this.grappleGroup.quaternion).invert());
    // clawPoint legt den Umfangswinkel auf x/z: bei a = 0 steht der Radius in z
    clawPoint(0, this.currentSplay(), CLAW_SEGMENTS, this.basketTip);
    const tipY = this.basketTip.y;
    const tipR = Math.max(this.basketTip.z, 0);
    // etwas Luft nach oben und unten, damit sperrige Teile noch gefasst werden
    if (p.y > CLAW_RING_Y + 0.45 || p.y < tipY - 0.35) return false;
    // Radius des Korbs auf dieser Höhe: vom Gelenkring zur Spitze verjüngt
    const t = THREE.MathUtils.clamp((CLAW_RING_Y - p.y) / Math.max(CLAW_RING_Y - tipY, 0.01), 0, 1);
    const r = THREE.MathUtils.lerp(CLAW_RING_R, tipR, t) + 0.45;
    return Math.hypot(p.x, p.z) <= r;
  }

  /** Zielpunkt für die Kamera (Oberwagen). */
  getCameraTarget(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.position).add(new THREE.Vector3(0, 2.6, 0));
  }

  /** Augpunkt der Kabinenkamera (Weltkoordinaten). */
  getCabinEye(out: THREE.Vector3): THREE.Vector3 {
    return this.cabinEye.getWorldPosition(out);
  }

  /** Blickrichtungs-Basis der Kabine (Fahrwerk + Oberwagen). */
  get cabinBaseYaw(): number {
    return this.heading + this.cabYaw;
  }
}

/** Wert schrittweise Richtung Ziel bewegen (lineare Rampe). */
function ramp(current: number, target: number, maxStep: number): number {
  const diff = target - current;
  return current + THREE.MathUtils.clamp(diff, -maxStep, maxStep);
}

function clamp1(v: number): number {
  return THREE.MathUtils.clamp(v, -1, 1);
}

/** Zwei Tastenpaare auf eine Achse summieren (Haupt- + Zweitbelegung). */
function axis2(input: Input, n1: string, p1: string, n2: string, p2: string): number {
  return THREE.MathUtils.clamp(input.axis(n1, p1) + input.axis(n2, p2), -1, 1);
}
