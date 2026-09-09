import * as THREE from "three";
import type { GameData, LevelDef } from "@/data/types";
import type { WorldState } from "@/sim/world/WorldState";
import type { WallBox } from "@/sim/world/Level";
import { ScrapView } from "./ScrapView";
import { ExcavatorModel, type ExcavatorPose as ModelPose } from "./ExcavatorModel";
import { CameraRig } from "./CameraRig";
import { AimRing } from "./AimRing";
import { VehicleView } from "./VehicleView";
import { PressView } from "./PressView";
import { CompositeView } from "./CompositeView";
import { ContainerFillView } from "./ContainerFillView";
import type { VehicleRun } from "@/sim/systems/VehicleSystem";
import type { AimState } from "@/sim/systems/AimSystem";
import type { ExcavatorPose } from "@/sim/systems/ExcavatorSystem";
import type { ControlFrame } from "@/sim/control/ControlFrame";

const AXIS_Y = new THREE.Vector3(0, 1, 0);

/**
 * Leere Szene für M0: Boden in Platzgröße, Himmelsverlauf als Hintergrundfarbe, Sonne + Hemisphäre,
 * ACES-Tone-Mapping (Stilguide 1.4). Draw-Call- und Dreieckszähler fürs Overlay.
 * Ab M2: ViewRegistry, Instancing, Interpolation, gemergte Statik.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  drawCalls = 0; triangles = 0;
  private readonly ground: THREE.Mesh;
  readonly scrap: ScrapView; private readonly compositeView: CompositeView;
  readonly excavator: ExcavatorModel;
  readonly rig: CameraRig;
  readonly aimRing: AimRing;
  readonly vehicles: VehicleView; readonly fills: ContainerFillView;
  private runs: readonly VehicleRun[] = [];
  private aim: AimState | null = null;
  private readonly modelPose: ModelPose = { pos: { x: 0, y: 0, z: 0 }, heading: 0, cabYaw: 0, boomAngle: 0, stickAngle: 0, rotatorYaw: 0, splay: 0, cabLift: 0, outriggerDown: 0, bladeDown: 0, inputs: { cab: 0, boom: 0, stick: 0, grapple: 0 } };
  private readonly cabPos = { x: 0, y: 0, z: 0 };
  private readonly eye = new THREE.Vector3(); private firstPerson = false;

  constructor(canvas: HTMLCanvasElement, data: GameData, walls: readonly WallBox[], pixelRatioMax: number) {
    const level: LevelDef = data.level;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioMax));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene.background = new THREE.Color("#cfd9e0");
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.camera.position.set(0, 12, -22);
    this.camera.lookAt(0, 0, 0);

    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(20, 30, -10);
    this.scene.add(sun, new THREE.HemisphereLight("#dde6ec", "#6b6257", 1.0));

    const groundGeo = new THREE.PlaneGeometry(level.size.w, level.size.d);
    const groundMat = new THREE.MeshStandardMaterial({ color: level.ground.color, roughness: 0.95 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    // Zonen als flache Markierungen — reine Orientierung, damit man auf dem iPad sieht, dass level_yard.json greift.
    const zoneMat = new THREE.MeshBasicMaterial({ color: "#9c9a92", transparent: true, opacity: 0.5 });
    for (const z of level.zones) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.rect.hw * 2, z.rect.hd * 2), zoneMat);
      m.rotation.x = -Math.PI / 2; m.position.set(z.rect.x, 0.01, z.rect.z);
      this.scene.add(m);
    }
    // Wände und Muldenwände aus derselben Definition wie die Physik (Level.boxes) — eine Wahrheit.
    const wallMat = new THREE.MeshStandardMaterial({ color: "#9c9a92", roughness: 0.9, flatShading: true });
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const wallsOnly = walls.filter((b) => b.kind !== "ground");
    const im = new THREE.InstancedMesh(unit, wallMat, wallsOnly.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    wallsOnly.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rotY);
      p.set(b.cx, b.hy, b.cz); sc.set(b.hx * 2, b.hy * 2, b.hz * 2);
      im.setMatrixAt(i, m.compose(p, q, sc));
    });
    this.scene.add(im);
    this.scrap = new ScrapView(this.scene, data, Number(data.balancing.scrap["maxLooseItems"]) + 50);
    this.compositeView = new CompositeView(this.scene, data.composites.composites);
    const pz = level.zones.find((z) => z.id === "press");
    if (pz) this.pressView = new PressView(this.scene, pz.rect);
    const ex = data.balancing.excavator as Record<string, number | number[]>;
    this.excavator = new ExcavatorModel(this.scene, {
      boomLen: Number(ex["boomLenM"]), stickLen: Number(ex["stickLenM"]), boomPivot: ex["boomPivot"] as [number, number, number], grappleLink: Number(ex["grappleLinkM"]),
      colors: { machine: "#4fbf3f", dark: "#1e2124", accent: "#f2b632" },
    });
    this.rig = new CameraRig(this.camera);
    const assist = data.balancing.assist;
    this.rig.followFraction = Number(assist["cabinFollowFraction"] ?? 0.6); this.rig.followSeconds = Number(assist["cabinFollowSeconds"] ?? 0.4);
    this.aimRing = new AimRing(this.scene, data.materials.materials);
    this.vehicles = new VehicleView(this.scene); this.fills = new ContainerFillView(this.scene, data);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; sun.shadow.camera.far = 80;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.ground.receiveShadow = true;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Bagger-Pose aus der Simulation übernehmen (Kinematik läuft mit 60 Hz; Interpolation kommt mit dem Pendel in M3). */
  private readonly gPos = { x: 0, y: 0, z: 0 };
  private readonly gQuat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly qYaw = new THREE.Quaternion(); private readonly qTilt = new THREE.Quaternion(); private readonly eTilt = new THREE.Euler();
  private exState: WorldState["excavator"] | null = null; private exPose: ExcavatorPose | null = null; private exPrev: { x: number; y: number; z: number; heading: number; cab: number; boom: number; stick: number; rotator: number; splay: number; gx: number; gy: number; gz: number; swingX: number; swingZ: number } | null = null;

  /** Quellen für die Bagger-Darstellung merken; die Interpolation passiert pro Bild in render(). */
  syncExcavator(world: WorldState, pose: ExcavatorPose, prev: typeof this.exPrev, control: ControlFrame, aim?: AimState, runs?: readonly VehicleRun[]): void {
    this.exState = world.excavator; this.exPose = pose; this.exPrev = prev; if (aim) this.aim = aim; if (runs) this.runs = runs;
    const m = this.modelPose;
    m.inputs.cab = control.cab; m.inputs.boom = control.boom; m.inputs.stick = control.stick; m.inputs.grapple = control.grapple;
  }

  /** Bagger zwischen vorherigem und aktuellem Physikschritt interpolieren (alpha 0..1) — gleiche Regel wie bei den Teilen. */
  private updateExcavator(alpha: number): void {
    const s = this.exState, p = this.exPose, v = this.exPrev;
    if (!s || !p || !v) return;
    const m = this.modelPose, a = alpha;
    const L = (x0: number, x1: number) => x0 + (x1 - x0) * a;
    m.pos.x = L(v.x, s.pos.x); m.pos.y = L(v.y, s.pos.y); m.pos.z = L(v.z, s.pos.z);
    m.heading = L(v.heading, s.heading); m.cabYaw = L(v.cab, s.cab); m.boomAngle = L(v.boom, s.boom); m.stickAngle = L(v.stick, s.stick); m.rotatorYaw = L(v.rotator, s.rotator);
    m.splay = L(v.splay, p.splay); m.cabLift = s.cabLift;
    this.gPos.x = L(v.gx, p.grapplePos.x); this.gPos.y = L(v.gy, p.grapplePos.y); this.gPos.z = L(v.gz, p.grapplePos.z);
    // Spinne: Gieren zuerst, dann Pendelneigung um Weltachsen (gleiche Reihenfolge wie ExcavatorSystem.computePose)
    const yaw = m.heading + m.cabYaw + m.rotatorYaw;
    this.qYaw.setFromAxisAngle(AXIS_Y, yaw);
    this.eTilt.set(L(v.swingX, p.swingX), 0, L(v.swingZ, p.swingZ), "XYZ");
    this.qTilt.setFromEuler(this.eTilt).multiply(this.qYaw);
    this.gQuat.x = this.qTilt.x; this.gQuat.y = this.qTilt.y; this.gQuat.z = this.qTilt.z; this.gQuat.w = this.qTilt.w;
    this.excavator.update(m, this.gPos, this.gQuat);
    this.cabPos.x = m.pos.x; this.cabPos.y = m.pos.y + 2.6; this.cabPos.z = m.pos.z;
  }

  /** Zustand der Presse fuer die Anzeige (Stempel, Warnlampe) — wird von der App vor render() gesetzt. */
  press = { progress: 0, running: false, blocked: false };
  private pressView: PressView | null = null;

  render(world: WorldState, alpha: number, frameDt: number, control?: ControlFrame): void {
    this.pressView?.update(this.press.progress, this.press.running, this.press.blocked);
    this.scrap.update(world, alpha);
    this.compositeView.update(world, alpha);
    this.updateExcavator(alpha);
    if (this.aim) { this.aimRing.update(this.aim, frameDt); this.fills.updateAim(this.aim, frameDt); }
    this.vehicles.update(this.runs); this.fills.update(world);
    const m = this.modelPose;
    const cabin = this.rig.mode === "cabin";
    if (cabin !== this.firstPerson) { this.firstPerson = cabin; this.excavator.setFirstPerson(cabin); }
    if (cabin) this.excavator.cabinEyeWorld(this.eye);
    this.rig.update(frameDt, m.heading + m.cabYaw, this.excavator.grappleGroup.position, this.cabPos, control?.camOrbit ?? { dx: 0, dy: 0 }, control?.camZoom ?? 0, cabin ? this.eye : undefined);
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
  }

  dispose(): void {
    this.scrap.dispose();
    this.aimRing.dispose(); this.vehicles.dispose(); this.fills.dispose();
    this.excavator.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material; if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose(); }
    });
    this.renderer.dispose();
  }
}
