import * as THREE from "three";
import {
  CLAW_COUNT,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  CLAW_SEG_BEND,
  CLAW_SEG_LEN,
  clawPoint,
} from "@/shared/clawGeometry";

/**
 * Prozedurales 3D-Modell des Umschlagbaggers — reine Darstellungsschicht.
 *
 * Portiert aus dem Prototyp (excavator.ts / driver.ts). Hier gibt es keine
 * Physik, keine Eingabe und keine Spiellogik: `update()` bekommt eine fertige
 * Pose und setzt daraus alle Gruppen, Krallen, Hydraulikzylinder und Joysticks.
 *
 * Hierarchie:
 *   root (Chassis, Ursprung am Boden)
 *     └ cabGroup (Oberwagen, dreht um Y)
 *         ├ cabLiftGroup (Hochkabine, fährt hoch/vor)
 *         └ boomGroup (Ausleger, dreht um X = −boomAngle)
 *             └ stickGroup (Stiel, dreht um X = −stickAngle)
 *                 └ stickTip (Stielspitze)
 *   grappleGroup (Spinne, TOP-LEVEL — Pose kommt von außen, Kardan)
 *
 * Alle Meshes, die zwei Gruppen verbinden (Hydraulikzylinder Oberwagen↔Ausleger,
 * Ausleger↔Stiel), liegen als Kinder der Szene in Weltkoordinaten.
 */

export interface ExcavatorPose {
  pos: { x: number; y: number; z: number };
  /** rad, 0 = +Z */
  heading: number;
  cabYaw: number;
  boomAngle: number;
  stickAngle: number;
  rotatorYaw: number;
  /** rad; 0 = zu, CLAW_OPEN_SPLAY = offen */
  splay: number;
  /** Kabinenhub in m */
  cabLift: number;
  /** 0 = eingefahren, 1 = ausgefahren */
  outriggerDown: number;
  /** 0 = gehoben, 1 = am Boden */
  bladeDown: number;
  /** −1..1 für die Joystick-Animation in der Kabine */
  inputs: { cab: number; boom: number; stick: number; grapple: number };
}

export interface ExcavatorModelOptions {
  boomLen: number;
  stickLen: number;
  /** Auslegerfuß relativ zum Chassis-Ursprung (Boden) */
  boomPivot: [number, number, number];
  /** Abstand Stielspitze → Traversen-Oberkante */
  grappleLink: number;
  colors: { machine: string; dark: string; accent: string };
}

/** Zylinder zwischen zwei Ankern, die in verschiedenen Gruppen hängen (Weltraum). */
interface HydraulicCylinder {
  a: THREE.Object3D;
  b: THREE.Object3D;
  barrel: THREE.Mesh;
  rod: THREE.Mesh;
  barrelLen: number;
  /** Überstand der Kolbenstange in den Zylinder hinein */
  overlap: number;
}

/** Greiferzylinder: Traverse → Krallen-Lagerbock, im lokalen Spinnenraum. */
interface GrappleCylinder {
  pivot: THREE.Group;
  fromLocal: THREE.Vector3;
  toLocalOnShell: THREE.Vector3;
  barrel: THREE.Mesh;
  rod: THREE.Mesh;
  barrelLen: number;
}

/** Parallelogramm-Lenker der Kabine, beide Anker im Oberwagen-Raum. */
interface CabLink {
  base: THREE.Vector3;
  tipRest: THREE.Vector3;
  mesh: THREE.Mesh;
}

// Oberwagen-Höhe über dem Chassis-Ursprung
const CAB_Y = 1.6;
// Kabinenzentrum im Oberwagen (nach links versetzt, damit der Ausleger nicht ins Blickfeld ragt)
const CAB_CX = -1.05;
const CAB_CZ = 0.6;
// Kabinenhub: pro Meter Hub fährt die Kabine 0,34 m nach vorn
const CAB_LIFT_FORWARD = 0.34;

// Räumschild vorn am Unterwagen
const BLADE_W = 2.9;
const BLADE_Z = 2.55;
const BLADE_UP_Y = 0.62;

// Abstützpratzen: eingefahren = so weit angehoben
const OUTRIGGER_LIFT = 0.72;

// Joystick-Neigung bei Vollausschlag
const JOY_TILT = 0.35;

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

export class ExcavatorModel {
  readonly root = new THREE.Group();
  readonly grappleGroup = new THREE.Group();

  private readonly scene: THREE.Scene;
  private readonly cabGroup = new THREE.Group();
  private readonly cabLiftGroup = new THREE.Group();
  private readonly boomGroup = new THREE.Group();
  private readonly stickGroup = new THREE.Group();
  private readonly stickTip = new THREE.Object3D();
  private readonly cabinEye = new THREE.Object3D();
  private readonly bladeGroup = new THREE.Group();
  private readonly outriggerFeet: THREE.Group[] = [];
  private readonly fingerPivots: THREE.Group[] = [];
  private readonly hydraulics: HydraulicCylinder[] = [];
  private readonly grappleCylinders: GrappleCylinder[] = [];
  private readonly cabLinks: CabLink[] = [];
  private joyLeft: THREE.Group | null = null;
  private joyRight: THREE.Group | null = null;
  /** Alles am Fahrer außer Unterarmen/Händen — in der Ego-Sicht unsichtbar */
  private readonly driverBody: THREE.Object3D[] = [];

  // Ressourcen für dispose()
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  /** Objekte, die direkt in der Szene hängen (Zylinder zwischen Gruppen) */
  private readonly sceneObjects: THREE.Object3D[] = [];

  // Geteilte Materialien
  private readonly matMachine: THREE.MeshStandardMaterial;
  private readonly matDark: THREE.MeshStandardMaterial;
  private readonly matAccent: THREE.MeshStandardMaterial;
  private readonly matShell: THREE.MeshStandardMaterial;
  private readonly matEdge: THREE.MeshStandardMaterial;
  private readonly matRod: THREE.MeshStandardMaterial;
  private readonly matGlass: THREE.MeshStandardMaterial;
  private readonly matHose: THREE.MeshStandardMaterial;
  private readonly matSkin: THREE.MeshStandardMaterial;

  // Rechenpuffer — keine Allokationen in update()
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();

  private readonly opts: ExcavatorModelOptions;

  constructor(scene: THREE.Scene, opts: ExcavatorModelOptions) {
    this.scene = scene;
    this.opts = opts;

    this.matMachine = this.mat({ color: opts.colors.machine, roughness: 0.55 });
    this.matDark = this.mat({ color: opts.colors.dark, roughness: 0.8 });
    this.matAccent = this.mat({ color: opts.colors.accent, roughness: 0.5, metalness: 0.2 });
    // Greiferschalen: Akzentfarbe, beidseitig — die Innenseite ist bei offener Spinne sichtbar
    this.matShell = this.mat({
      color: opts.colors.accent,
      roughness: 0.5,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    this.matEdge = this.mat({ color: opts.colors.dark, roughness: 0.45, metalness: 0.7 });
    this.matRod = this.mat({ color: 0xb8bec4, roughness: 0.25, metalness: 0.8 });
    this.matGlass = this.mat({
      color: 0x9fc4d8,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });
    this.matHose = this.mat({ color: 0x1c1e20, roughness: 0.9 });
    this.matSkin = this.mat({ color: 0xe3b18c, roughness: 0.8 });

    this.buildChassis();
    this.buildUpperCarriage();
    this.buildArm();
    this.buildGrapple();
    this.buildHydraulics();

    scene.add(this.root);
    scene.add(this.grappleGroup);
  }

  // ---------- Hilfen für Ressourcenverwaltung ----------

  private mat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ flatShading: true, ...params });
    this.materials.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
    shadow = false
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    parent.add(mesh);
    return mesh;
  }

  // ---------- Aufbau ----------

  /** Unterwagen: Chassis, vier Räder, Abstützpratzen, Räumschild. */
  private buildChassis(): void {
    const chassis = this.mesh(this.geo(new THREE.BoxGeometry(2.4, 0.9, 4.4)), this.matMachine, this.root, 0, 1.15, 0, true);
    chassis.name = "chassis";

    const wheelGeo = this.geo(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 20));
    wheelGeo.rotateZ(Math.PI / 2);
    for (const [x, z] of [
      [-1.25, 1.5],
      [1.25, 1.5],
      [-1.25, -1.5],
      [1.25, -1.5],
    ] as const) {
      this.mesh(wheelGeo, this.matDark, this.root, x, 0.62, z, true);
    }

    this.buildOutriggers();
    this.buildBlade();
  }

  /**
   * Abstützpratzen: vier ausgestellte Stützbeine mit Hydraulikzylinder und
   * Tellerfuß. Stempel + Teller fahren als Gruppe ein und aus.
   */
  private buildOutriggers(): void {
    const cylGeo = this.geo(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10));
    const rodGeo = this.geo(new THREE.CylinderGeometry(0.085, 0.085, 0.35, 8));
    const padGeo = this.geo(new THREE.CylinderGeometry(0.44, 0.38, 0.14, 12));
    const from = new THREE.Vector3();
    const to = new THREE.Vector3();
    const dir = new THREE.Vector3();
    for (const [sx, sz] of [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ] as const) {
      // Ansatz am Unterwagen → Fußpunkt schräg nach außen unten
      from.set(sx * 1.05, 0.95, sz * 1.5);
      to.set(sx * 2.35, 0.62, sz * 2.5);
      dir.copy(to).sub(from);
      const len = dir.length();
      dir.normalize();
      const arm = this.mesh(this.geo(new THREE.BoxGeometry(0.28, 0.26, len)), this.matDark, this.root, 0, 0, 0, true);
      arm.position.copy(from).addScaledVector(dir, len / 2);
      arm.quaternion.setFromUnitVectors(FWD, dir);

      const foot = new THREE.Group();
      foot.position.set(to.x, 0, to.z);
      this.root.add(foot);
      this.outriggerFeet.push(foot);
      this.mesh(cylGeo, this.matAccent, foot, 0, 0.42, 0);
      this.mesh(rodGeo, this.matRod, foot, 0, 0.14, 0);
      this.mesh(padGeo, this.matDark, foot, 0, 0.07, 0, true);
    }
  }

  /** Räumschild vorn am Unterwagen: Blatt, Schneide, Seitenwangen, Lenker mit Zylindern. */
  private buildBlade(): void {
    const g = this.bladeGroup;
    g.position.set(0, 0, BLADE_Z);
    this.root.add(g);

    const blade = this.mesh(this.geo(new THREE.BoxGeometry(BLADE_W, 0.72, 0.16)), this.matDark, g, 0, 0.42, 0, true);
    blade.rotation.x = -0.22;
    this.mesh(this.geo(new THREE.BoxGeometry(BLADE_W, 0.14, 0.2)), this.matRod, g, 0, 0.07, 0.03);
    const wingGeo = this.geo(new THREE.BoxGeometry(0.14, 0.62, 0.5));
    const armGeo = this.geo(new THREE.BoxGeometry(0.16, 0.16, 0.9));
    const cylGeo = this.geo(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8));
    const pistonGeo = this.geo(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8));
    for (const s of [-1, 1] as const) {
      this.mesh(wingGeo, this.matDark, g, (s * BLADE_W) / 2, 0.4, 0.22);
      this.mesh(armGeo, this.matMachine, g, s * 0.7, 0.5, -0.45);
      const cyl = this.mesh(cylGeo, this.matMachine, g, s * 0.42, 0.78, -0.3);
      cyl.rotation.x = 0.9;
      const piston = this.mesh(pistonGeo, this.matRod, g, s * 0.42, 0.55, -0.16);
      piston.rotation.x = 0.9;
    }
  }

  /** Oberwagen: Deck, Hochkabine, Motorhaube mit Lüftungsgittern, Gegengewicht. */
  private buildUpperCarriage(): void {
    this.cabGroup.position.set(0, CAB_Y, 0);
    this.root.add(this.cabGroup);

    this.mesh(this.geo(new THREE.BoxGeometry(2.9, 0.35, 3.2)), this.matDark, this.cabGroup, 0, 0.18, 0, true);
    this.buildCabin();

    this.mesh(this.geo(new THREE.BoxGeometry(2.5, 1.0, 1.7)), this.matMachine, this.cabGroup, 0, 0.85, -1.0, true);
    const slotGeo = this.geo(new THREE.BoxGeometry(0.04, 0.5, 0.12));
    for (const sx of [-1.27, 1.27] as const) {
      for (let i = 0; i < 4; i++) {
        this.mesh(slotGeo, this.matHose, this.cabGroup, sx, 0.9, -1.55 + i * 0.32);
      }
    }
    this.mesh(this.geo(new THREE.BoxGeometry(2.4, 0.75, 0.7)), this.matDark, this.cabGroup, 0, 0.5, -2.0, true);
    // Warnstreifen am Gegengewicht (Akzentfarbe)
    this.mesh(this.geo(new THREE.BoxGeometry(2.42, 0.12, 0.72)), this.matAccent, this.cabGroup, 0, 0.5, -2.0);
  }

  /**
   * Verglaste Hochkabine mit Innenausbau: Parallelogramm-Lenker, Boden mit
   * Fußscheibe, Dach mit Dachscheibe, vier Säulen, Glasflächen, Sitz, zwei
   * Konsolen mit Joysticks samt Unterarmen, Fahrerfigur und Augpunkt.
   */
  private buildCabin(): void {
    const cx = CAB_CX;
    const cz = CAB_CZ;
    const lift = this.cabLiftGroup;
    this.cabGroup.add(lift);

    // Kabinenausleger: zwei Lenker heben die Kabine nach vorn-oben, sie bleibt waagerecht
    const linkGeo = this.geo(new THREE.BoxGeometry(0.14, 1, 0.16));
    for (const rx of [-0.42, 0.42] as const) {
      const link = this.mesh(linkGeo, this.matMachine, this.cabGroup, 0, 0, 0, true);
      this.cabLinks.push({
        base: new THREE.Vector3(cx + rx, 0.35, cz - 1.35),
        tipRest: new THREE.Vector3(cx + rx, 0.5, cz - 0.72),
        mesh: link,
      });
    }

    // Boden: hinten Blech, vorn eine schräge Glasscheibe im Fußbereich
    this.mesh(this.geo(new THREE.BoxGeometry(1.1, 0.07, 0.75)), this.matDark, lift, cx, 0.58, cz - 0.33);
    const footPane = new THREE.Group();
    footPane.position.set(cx, 0.6, cz + 0.36);
    footPane.rotation.x = -0.42;
    lift.add(footPane);
    this.mesh(this.geo(new THREE.BoxGeometry(1.02, 0.035, 0.7)), this.matGlass, footPane);
    this.mesh(this.geo(new THREE.BoxGeometry(1.04, 0.028, 0.045)), this.matDark, footPane, 0, 0.03, 0);
    const footEdgeGeo = this.geo(new THREE.BoxGeometry(0.05, 0.045, 0.72));
    for (const sx of [-0.5, 0.5] as const) {
      this.mesh(footEdgeGeo, this.matDark, footPane, sx, 0.02, 0);
    }

    // Dach mit geneigter Dachscheibe (Blick nach oben auf den Ausleger)
    this.mesh(this.geo(new THREE.BoxGeometry(1.2, 0.09, 0.85)), this.matMachine, lift, cx, 2.1, cz - 0.32, true);
    const roofGlass = this.mesh(this.geo(new THREE.BoxGeometry(1.06, 0.04, 0.78)), this.matGlass, lift, cx, 1.98, cz + 0.42);
    roofGlass.rotation.x = THREE.MathUtils.degToRad(40);
    this.mesh(this.geo(new THREE.BoxGeometry(1.16, 0.05, 0.06)), this.matMachine, lift, cx, 2.06, cz + 0.3);

    const pillarGeo = this.geo(new THREE.BoxGeometry(0.08, 1.45, 0.08));
    for (const [px, pz] of [
      [-0.52, -0.66],
      [0.52, -0.66],
      [-0.52, 0.66],
      [0.52, 0.66],
    ] as const) {
      this.mesh(pillarGeo, this.matMachine, lift, cx + px, 1.33, cz + pz, true);
    }

    // Glas: Front (bis in den Fußbereich), Heck, links, rechts
    const panes: Array<[number, number, number, number, number, number]> = [
      [cx, 1.28, cz + 0.69, 1.0, 1.52, 0.03],
      [cx, 1.33, cz - 0.69, 1.0, 1.42, 0.03],
      [cx - 0.54, 1.33, cz, 0.03, 1.42, 1.3],
      [cx + 0.54, 1.33, cz, 0.03, 1.42, 1.3],
    ];
    for (const [x, y, z, sx, sy, sz] of panes) {
      this.mesh(this.geo(new THREE.BoxGeometry(sx, sy, sz)), this.matGlass, lift, x, y, z);
    }

    // Sitz mit Lehne und Kopfstütze
    const seatMat = this.mat({ color: 0x24272a, roughness: 0.9 });
    this.mesh(this.geo(new THREE.BoxGeometry(0.5, 0.12, 0.5)), seatMat, lift, cx, 0.95, cz - 0.2);
    this.mesh(this.geo(new THREE.BoxGeometry(0.5, 0.62, 0.1)), seatMat, lift, cx, 1.3, cz - 0.48);
    this.mesh(this.geo(new THREE.BoxGeometry(0.34, 0.22, 0.12)), seatMat, lift, cx, 1.76, cz - 0.47);
    const postGeo = this.geo(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8));
    for (const sx of [-0.09, 0.09] as const) {
      this.mesh(postGeo, this.matDark, lift, cx + sx, 1.63, cz - 0.47);
    }

    // Konsolen mit ISO-Joysticks: Faltenbalg, Schaft, ergonomischer Griff,
    // Daumentaste, Fingerwippe — und daran Unterarm + Faust des Fahrers
    const consoleGeo = this.geo(new THREE.BoxGeometry(0.16, 0.28, 0.44));
    const rubber = this.mat({ color: 0x17191b, roughness: 0.95 });
    const gripMat = this.mat({ color: 0x24282c, roughness: 0.45 });
    const buttonMat = this.mat({ color: 0xd97a1f, roughness: 0.35, emissive: 0x3a1f00 });
    const bellowGeos = [0, 1, 2].map((b) =>
      this.geo(new THREE.CylinderGeometry(0.055 - b * 0.006, 0.062 - b * 0.006, 0.035, 12))
    );
    const shaftGeo = this.geo(new THREE.CylinderGeometry(0.021, 0.025, 0.12, 10));
    const gripGeo = this.geo(new THREE.CapsuleGeometry(0.048, 0.1, 4, 12));
    const thumbGeo = this.geo(new THREE.CylinderGeometry(0.019, 0.019, 0.014, 10));
    const triggerGeo = this.geo(new THREE.BoxGeometry(0.05, 0.032, 0.018));
    const forearmGeo = this.geo(new THREE.CapsuleGeometry(0.054, 0.34, 4, 10));
    const fistGeo = this.geo(new THREE.CapsuleGeometry(0.052, 0.075, 4, 10));
    const thumbFingerGeo = this.geo(new THREE.CapsuleGeometry(0.02, 0.055, 4, 8));

    for (const side of [-1, 1] as const) {
      this.mesh(consoleGeo, this.matDark, lift, cx + side * 0.36, 1.02, cz + 0.02);
      const pivot = new THREE.Group();
      pivot.position.set(cx + side * 0.36, 1.16, cz + 0.1);
      lift.add(pivot);

      bellowGeos.forEach((bg, b) => this.mesh(bg, rubber, pivot, 0, 0.03 + b * 0.037, 0));
      this.mesh(shaftGeo, gripMat, pivot, 0, 0.18, 0);
      const grip = this.mesh(gripGeo, gripMat, pivot, 0, 0.29, -0.012);
      grip.rotation.x = -0.22;
      const thumb = this.mesh(thumbGeo, buttonMat, pivot, 0, 0.365, 0.012);
      thumb.rotation.x = -0.22;
      const trigger = this.mesh(triggerGeo, buttonMat, pivot, 0, 0.285, 0.05);
      trigger.rotation.x = 0.25;

      // Unterarm läuft schräg von hinten-unten heran, die Faust liegt auf dem Griff
      const forearm = this.mesh(forearmGeo, this.matSkin, pivot, side * 0.06, 0.28, -0.28);
      forearm.rotation.set(1.28, 0, side * 0.18);
      const fist = this.mesh(fistGeo, this.matSkin, pivot, 0, 0.315, -0.01);
      fist.rotation.set(Math.PI / 2, 0, 0);
      const thumbFinger = this.mesh(thumbFingerGeo, this.matSkin, pivot, -side * 0.042, 0.318, 0.035);
      thumbFinger.rotation.set(1.35, 0, side * 0.35);

      if (side < 0) this.joyLeft = pivot;
      else this.joyRight = pivot;
    }

    this.buildDriver(lift, cx, cz);

    // Augpunkt der Kabinenkamera: Kopf an der Lehne, Konsolen liegen im Blickfeld
    this.cabinEye.position.set(cx, 1.68, cz - 0.4);
    lift.add(this.cabinEye);
  }

  /**
   * Fahrerfigur im Sitz — stilisierte Low-Poly-Figur aus Kapseln und Kugeln.
   * Unterarme und Hände hängen an den Joysticks (siehe buildCabin); alles
   * Übrige landet in `driverBody` und lässt sich für die Ego-Sicht ausblenden.
   */
  private buildDriver(parent: THREE.Object3D, cx: number, cz: number): void {
    const shirt = this.mat({ color: 0xf4f3ee, roughness: 0.85 });
    const jeans = this.mat({ color: 0x3d4b5c, roughness: 0.9 });
    const hair = this.mat({ color: 0x6b4a2e, roughness: 0.95 });
    const boot = this.mat({ color: 0x2a2724, roughness: 0.95 });

    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    parent.add(g);
    const body = this.driverBody;

    const add = (
      geo: THREE.BufferGeometry,
      m: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0
    ): THREE.Mesh => {
      const mesh = this.mesh(geo, m, g, x, y, z);
      mesh.rotation.set(rx, 0, rz);
      body.push(mesh);
      return mesh;
    };

    // Rumpf und Schultern
    add(this.geo(new THREE.CapsuleGeometry(0.16, 0.3, 4, 12)), shirt, 0, 1.42, -0.24);
    add(this.geo(new THREE.SphereGeometry(0.17, 12, 10)), shirt, 0, 1.58, -0.24);
    // Sitzende Beine
    add(this.geo(new THREE.CapsuleGeometry(0.12, 0.12, 4, 10)), jeans, 0, 1.12, -0.16);
    const thighGeo = this.geo(new THREE.CapsuleGeometry(0.07, 0.26, 4, 10));
    const shinGeo = this.geo(new THREE.CapsuleGeometry(0.065, 0.24, 4, 10));
    const bootGeo = this.geo(new THREE.SphereGeometry(0.075, 10, 8));
    for (const sx of [-0.1, 0.1] as const) {
      add(thighGeo, jeans, sx, 1.1, 0.02, Math.PI / 2);
      add(shinGeo, jeans, sx, 0.88, 0.2);
      add(bootGeo, boot, sx, 0.7, 0.26);
    }
    // Oberarme (Unterarme sitzen am Joystick)
    const upperArmGeo = this.geo(new THREE.CapsuleGeometry(0.058, 0.22, 4, 10));
    for (const sx of [-1, 1] as const) {
      add(upperArmGeo, shirt, sx * 0.29, 1.44, -0.18, 0, sx * 0.28);
    }
    // Hals, Kopf, Haare
    add(this.geo(new THREE.CapsuleGeometry(0.05, 0.06, 4, 10)), this.matSkin, 0, 1.73, -0.25);
    const head = add(this.geo(new THREE.SphereGeometry(0.115, 14, 12)), this.matSkin, 0, 1.87, -0.25);
    head.scale.set(1, 1.12, 1.02);
    const hairCap = add(this.geo(new THREE.SphereGeometry(0.122, 14, 12)), hair, 0, 1.9, -0.26);
    hairCap.scale.set(1, 0.95, 1.02);
    const nape = add(this.geo(new THREE.SphereGeometry(0.1, 12, 10)), hair, 0, 1.84, -0.3);
    nape.scale.set(1, 0.7, 0.7);
  }

  /** Ausleger und Stiel als Kette am Auslegerfuß, dazu Hydraulikschläuche. */
  private buildArm(): void {
    const { boomLen, stickLen, boomPivot } = this.opts;
    this.boomGroup.position.set(boomPivot[0], boomPivot[1] - CAB_Y, boomPivot[2]);
    this.cabGroup.add(this.boomGroup);
    this.mesh(this.geo(new THREE.BoxGeometry(0.42, 0.62, boomLen)), this.matMachine, this.boomGroup, 0, 0, boomLen / 2, true);

    this.stickGroup.position.z = boomLen;
    this.boomGroup.add(this.stickGroup);
    this.mesh(this.geo(new THREE.BoxGeometry(0.32, 0.45, stickLen)), this.matMachine, this.stickGroup, 0, 0, stickLen / 2, true);
    this.stickTip.position.z = stickLen;
    this.stickGroup.add(this.stickTip);

    // Hydraulikschläuche oben auf dem Ausleger (2×) + Bogen über das Stielgelenk
    for (const hx of [-0.07, 0.07] as const) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx, 0.38, 0.25),
        new THREE.Vector3(hx, 0.52, boomLen * 0.35),
        new THREE.Vector3(hx, 0.46, boomLen * 0.7),
        new THREE.Vector3(hx, 0.32, boomLen - 0.15),
      ]);
      this.mesh(this.geo(new THREE.TubeGeometry(curve, 24, 0.028, 6)), this.matHose, this.boomGroup);
    }
    const stickCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.34, -0.45),
      new THREE.Vector3(0, 0.3, 0.1),
      new THREE.Vector3(0, 0.24, 0.9),
    ]);
    this.mesh(this.geo(new THREE.TubeGeometry(stickCurve, 16, 0.028, 6)), this.matHose, this.stickGroup);
  }

  /**
   * Greifspinne (Umschlagbagger-Bauart), Ursprung = Stielspitze. Von oben nach
   * unten: Kardan-Gabeln, Rotatorgehäuse, Guss-Traverse, Gelenkring, fünf
   * Sichelkrallen mit je einem Zylinder und der zentrale Eindringdorn.
   *
   * Y-Offsets relativ zur Stielspitze (grappleLink = 0.55 wie im Prototyp):
   *   Stummel −0.05, obere Gabel −0.10, untere Gabel −0.30, Rotator −0.48,
   *   Rotatorkappe −0.30, Zylinderanker −0.56, Traverse −(grappleLink+0.2) = −0.75,
   *   Gelenkring CLAW_RING_Y.
   */
  private buildGrapple(): void {
    const g = this.grappleGroup;
    const palmY = -(this.opts.grappleLink + 0.2);

    // Kardan-Aufhängung: zwei ineinandergreifende Gelenkgabeln (90° verdreht)
    this.mesh(this.geo(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10)), this.matDark, g, 0, -0.05, 0);
    const plateGeo = this.geo(new THREE.BoxGeometry(0.05, 0.2, 0.16));
    const pinGeo = this.geo(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10));
    for (const [y, alongX] of [
      [-0.1, true],
      [-0.3, false],
    ] as const) {
      const yoke = new THREE.Group();
      yoke.position.y = y;
      if (!alongX) yoke.rotation.y = Math.PI / 2;
      for (const side of [-1, 1] as const) {
        this.mesh(plateGeo, this.matDark, yoke, side * 0.1, -0.09, 0);
      }
      const pin = this.mesh(pinGeo, this.matDark, yoke, 0, -0.16, 0);
      pin.rotation.z = Math.PI / 2;
      g.add(yoke);
    }

    // Rotatorgehäuse + Kappe, Traverse (Stahlgussblock, nach unten verjüngt), Gelenkring
    this.mesh(this.geo(new THREE.BoxGeometry(0.5, 0.36, 0.5)), this.matEdge, g, 0, palmY + 0.27, 0, true);
    this.mesh(this.geo(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 12)), this.matShell, g, 0, palmY + 0.45, 0);
    const traverse = this.mesh(this.geo(new THREE.CylinderGeometry(0.72, 0.5, 0.4, 5)), this.matShell, g, 0, palmY, 0, true);
    traverse.rotation.y = Math.PI / 5;
    const ring = this.mesh(this.geo(new THREE.TorusGeometry(CLAW_RING_R, 0.075, 8, 22)), this.matEdge, g, 0, CLAW_RING_Y, 0);
    ring.rotation.x = Math.PI / 2;

    // Zentraler Eindringdorn: Spitze endet knapp über dem Treffpunkt der geschlossenen Krallen
    const closedTip = clawPoint(0, 0, CLAW_SEGMENTS, this.tmpA);
    const spikeLen = Math.max(0.3, CLAW_RING_Y - closedTip.y - 0.2);
    const spike = this.mesh(this.geo(new THREE.ConeGeometry(0.14, spikeLen, 4)), this.matEdge, g, 0, CLAW_RING_Y - spikeLen / 2 + 0.05, 0, true);
    spike.rotation.x = Math.PI;

    // Krallen: Kette gebogener Schalensegmente, zur Spitze verjüngt — Geometrien je Segment geteilt
    const segWidth = [0.4, 0.37, 0.33, 0.28, 0.22, 0.15];
    const segThick = [0.16, 0.15, 0.135, 0.12, 0.105, 0.085];
    const segGeos: THREE.BoxGeometry[] = [];
    const edgeGeos: THREE.BoxGeometry[] = [];
    for (let s = 0; s < CLAW_SEGMENTS; s++) {
      const w = segWidth[Math.min(s, segWidth.length - 1)] ?? 0.2;
      const t = segThick[Math.min(s, segThick.length - 1)] ?? 0.1;
      segGeos.push(this.geo(new THREE.BoxGeometry(w, CLAW_SEG_LEN + 0.04, t)));
      edgeGeos.push(this.geo(new THREE.BoxGeometry(w + 0.03, CLAW_SEG_LEN + 0.05, 0.045)));
    }
    const knuckleGeo = this.geo(new THREE.BoxGeometry(0.3, 0.18, 0.22));
    const tipGeo = this.geo(new THREE.ConeGeometry(0.075, 0.24, 4));
    const barrelGeo = this.geo(new THREE.CylinderGeometry(0.066, 0.066, 1, 10));
    const rodGeo = this.geo(new THREE.CylinderGeometry(0.042, 0.042, 1, 8));
    const CYL_R = 0.42; // Anlenkkreis der Zylinder am Gehäuse

    for (let i = 0; i < CLAW_COUNT; i++) {
      const a = (i / CLAW_COUNT) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(a) * CLAW_RING_R, CLAW_RING_Y, Math.cos(a) * CLAW_RING_R);
      pivot.rotation.order = "YXZ";
      pivot.rotation.y = a; // lokales +Z zeigt radial nach außen
      this.mesh(knuckleGeo, this.matEdge, pivot, 0, 0.02, 0);

      let parent: THREE.Object3D = pivot;
      for (let s = 0; s < CLAW_SEGMENTS; s++) {
        const seg = new THREE.Group();
        if (s > 0) {
          seg.position.y = -CLAW_SEG_LEN;
          seg.rotation.x = CLAW_SEG_BEND;
        }
        const segGeo = segGeos[s];
        const edgeGeo = edgeGeos[s];
        if (segGeo && edgeGeo) {
          this.mesh(segGeo, this.matShell, seg, 0, -CLAW_SEG_LEN / 2, 0, true);
          // dunkler Steg auf der Außenseite gibt der Schale Profil
          const t = segThick[Math.min(s, segThick.length - 1)] ?? 0.1;
          this.mesh(edgeGeo, this.matEdge, seg, 0, -CLAW_SEG_LEN / 2, t / 2);
        }
        parent.add(seg);
        parent = seg;
      }
      const tip = this.mesh(tipGeo, this.matEdge, parent, 0, -CLAW_SEG_LEN - 0.08, 0);
      tip.rotation.x = Math.PI;

      // Hydraulikzylinder: Traverse → Krallen-Lagerbock (im Spinnenraum)
      const barrel = this.mesh(barrelGeo, this.matMachine, g);
      const rod = this.mesh(rodGeo, this.matRod, g);
      this.grappleCylinders.push({
        pivot,
        fromLocal: new THREE.Vector3(Math.sin(a) * CYL_R, palmY + 0.19, Math.cos(a) * CYL_R),
        toLocalOnShell: new THREE.Vector3(0, -0.3, 0.19),
        barrel,
        rod,
        barrelLen: 0.3,
      });

      g.add(pivot);
      this.fingerPivots.push(pivot);
    }
  }

  /**
   * Sichtbare Hydraulik zwischen Gruppen: Hubzylinder Oberwagen→Ausleger (2×),
   * Kabinenhub-Zylinder (2×), Stielzylinder Ausleger→Stiel. Zylinder = Rohr +
   * Kolbenstange, die sich zwischen zwei Ankern längt/kürzt (Weltkoordinaten).
   */
  private buildHydraulics(): void {
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
      const barrel = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(rBarrel, rBarrel, 1, 10)), this.matDark);
      const rod = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(rBarrel * 0.55, rBarrel * 0.55, 1, 8)), this.matRod);
      this.scene.add(barrel, rod);
      this.sceneObjects.push(barrel, rod);
      this.hydraulics.push({ a, b, barrel, rod, barrelLen, overlap: 0.15 });
    };
    const boomLen = this.opts.boomLen;
    // Hubzylinder des Auslegers: tief am Oberwagen-Deck links und rechts neben dem Auslegerfuß
    addCyl(this.cabGroup, [-0.52, 0.02, 1.05], this.boomGroup, [-0.28, -0.2, boomLen * 0.5], 1.7, 0.1);
    addCyl(this.cabGroup, [0.52, 0.02, 1.05], this.boomGroup, [0.28, -0.2, boomLen * 0.5], 1.7, 0.1);
    // Kabinenhub: zwei kleine Zylinder unten an der Kabine
    addCyl(this.cabGroup, [-1.5, 0.3, 0.1], this.cabLiftGroup, [-1.5, 0.95, 0.1], 1.1, 0.055);
    addCyl(this.cabGroup, [-0.6, 0.3, 0.1], this.cabLiftGroup, [-0.6, 0.95, 0.1], 1.1, 0.055);
    // Stielzylinder: Ausleger-Oberseite → Stiel-Anlenkung
    addCyl(this.boomGroup, [0, 0.34, boomLen * 0.65], this.stickGroup, [0, 0.2, 0.35], 1.2, 0.08);
  }

  // ---------- Laufzeit ----------

  /** Ego-Sicht: nur Unterarme an den Joysticks bleiben sichtbar. */
  setFirstPerson(active: boolean): void {
    for (const o of this.driverBody) o.visible = !active;
  }

  /**
   * Alle Gruppen und Rotationen aus der Pose setzen, Spinne auf die Weltpose
   * legen, dann Krallen, Hydraulikzylinder, Kabinenlenker und Joysticks nachführen.
   */
  update(
    pose: ExcavatorPose,
    grappleWorld: { x: number; y: number; z: number },
    grappleQuat: { x: number; y: number; z: number; w: number }
  ): void {
    this.root.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    this.root.rotation.y = pose.heading;
    this.cabGroup.rotation.y = pose.cabYaw;
    this.boomGroup.rotation.x = -pose.boomAngle;
    this.stickGroup.rotation.x = -pose.stickAngle;

    // Kabine fährt am Ausleger nach oben UND ein Stück nach vorn
    this.cabLiftGroup.position.y = pose.cabLift;
    this.cabLiftGroup.position.z = pose.cabLift * CAB_LIFT_FORWARD;
    for (const l of this.cabLinks) {
      this.tmpB.set(l.tipRest.x, l.tipRest.y + pose.cabLift, l.tipRest.z + pose.cabLift * CAB_LIFT_FORWARD);
      this.tmpDir.copy(this.tmpB).sub(l.base);
      const len = Math.max(this.tmpDir.length(), 0.2);
      this.tmpDir.normalize();
      l.mesh.position.copy(l.base).addScaledVector(this.tmpDir, len / 2);
      l.mesh.quaternion.setFromUnitVectors(UP, this.tmpDir);
      l.mesh.scale.set(1, len, 1);
    }

    // Abstützpratzen und Räumschild
    const outrigger = THREE.MathUtils.clamp(pose.outriggerDown, 0, 1);
    for (const f of this.outriggerFeet) f.position.y = (1 - outrigger) * OUTRIGGER_LIFT;
    const blade = THREE.MathUtils.clamp(pose.bladeDown, 0, 1);
    this.bladeGroup.position.y = (1 - blade) * BLADE_UP_Y;
    this.bladeGroup.rotation.x = (1 - blade) * 0.35; // gehoben angewinkelt

    // Spinne: Weltpose von außen (Kardan); rotatorYaw steckt in grappleQuat,
    // wird aber zusätzlich akzeptiert, falls der Aufrufer ihn nicht einrechnet.
    this.grappleGroup.position.set(grappleWorld.x, grappleWorld.y, grappleWorld.z);
    this.grappleGroup.quaternion.set(grappleQuat.x, grappleQuat.y, grappleQuat.z, grappleQuat.w);
    const splay = THREE.MathUtils.clamp(pose.splay, 0, CLAW_OPEN_SPLAY);
    for (const p of this.fingerPivots) p.rotation.x = -splay;

    this.updateHydraulics();
    this.updateGrappleCylinders();

    // Joysticks samt Unterarmen kippen so, wie gesteuert wird:
    // links Ausleger/Oberwagen, rechts Stiel/Spinne
    if (this.joyLeft && this.joyRight) {
      this.joyLeft.rotation.x = pose.inputs.boom * JOY_TILT;
      this.joyLeft.rotation.z = pose.inputs.cab * JOY_TILT;
      this.joyRight.rotation.x = pose.inputs.stick * JOY_TILT;
      this.joyRight.rotation.z = pose.inputs.grapple * JOY_TILT;
    }
  }

  /** Zylinder zwischen zwei Ankern in verschiedenen Gruppen (Weltraum) ausrichten. */
  private updateHydraulics(): void {
    // Weltmatrizen frisch berechnen — sonst sitzen die Zylinder auf der Pose des letzten Bilds
    this.root.updateWorldMatrix(true, true);
    for (const h of this.hydraulics) {
      h.a.getWorldPosition(this.tmpA);
      h.b.getWorldPosition(this.tmpB);
      this.tmpDir.copy(this.tmpB).sub(this.tmpA);
      const dist = Math.max(this.tmpDir.length(), 0.2);
      this.tmpDir.normalize();
      this.tmpQ.setFromUnitVectors(UP, this.tmpDir);
      h.barrel.position.copy(this.tmpA).addScaledVector(this.tmpDir, h.barrelLen / 2);
      h.barrel.quaternion.copy(this.tmpQ);
      h.barrel.scale.set(1, h.barrelLen, 1);
      const rodLen = Math.max(dist - h.barrelLen + h.overlap, h.overlap);
      h.rod.position.copy(this.tmpB).addScaledVector(this.tmpDir, -rodLen / 2);
      h.rod.quaternion.copy(this.tmpQ);
      h.rod.scale.set(1, rodLen, 1);
    }
  }

  /**
   * Greiferzylinder zwischen Traversen-Gelenk und Schale ausrichten — alles im
   * lokalen Spinnenraum, damit sie beim Pendeln nicht nachhinken.
   */
  private updateGrappleCylinders(): void {
    for (const c of this.grappleCylinders) {
      this.tmpA.copy(c.fromLocal);
      this.tmpB.copy(c.toLocalOnShell).applyEuler(c.pivot.rotation).add(c.pivot.position);
      this.tmpDir.copy(this.tmpB).sub(this.tmpA);
      const dist = Math.max(this.tmpDir.length(), 0.2);
      this.tmpDir.normalize();
      this.tmpQ.setFromUnitVectors(UP, this.tmpDir);
      c.barrel.position.copy(this.tmpA).addScaledVector(this.tmpDir, c.barrelLen / 2);
      c.barrel.quaternion.copy(this.tmpQ);
      c.barrel.scale.set(1, c.barrelLen, 1);
      const rodLen = Math.max(dist - c.barrelLen + 0.08, 0.08);
      c.rod.position.copy(this.tmpB).addScaledVector(this.tmpDir, -rodLen / 2);
      c.rod.quaternion.copy(this.tmpQ);
      c.rod.scale.set(1, rodLen, 1);
    }
  }

  /** Augpunkt der Kabinenkamera in Weltkoordinaten. */
  cabinEyeWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.cabinEye.getWorldPosition(out);
  }

  /** Alles aus der Szene nehmen und Geometrien/Materialien freigeben. */
  dispose(): void {
    this.scene.remove(this.root, this.grappleGroup);
    for (const o of this.sceneObjects) this.scene.remove(o);
    this.sceneObjects.length = 0;
    for (const g of this.geometries) g.dispose();
    this.geometries.length = 0;
    for (const m of this.materials) m.dispose();
    this.materials.length = 0;
    this.hydraulics.length = 0;
    this.grappleCylinders.length = 0;
    this.cabLinks.length = 0;
    this.fingerPivots.length = 0;
    this.outriggerFeet.length = 0;
    this.driverBody.length = 0;
  }
}
