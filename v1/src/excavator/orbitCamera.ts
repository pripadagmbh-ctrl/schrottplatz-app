import * as THREE from "three";
import type { Input } from "../core/input";

/**
 * Kamerasystem (Briefing Kap. 5.2), Taste C wechselt zyklisch:
 * - Orbit: folgt dem Oberwagen, MMB-Ziehen dreht, Shift+Mausrad zoomt (3–18 m, SW)
 * - Draufsicht: 25 m Höhe, 60° Neigung (SW)
 * - Kabine: Ego-Sicht vom Fahrersitz, MMB-Ziehen = Kopfblick (±120° / ±45°)
 */
export type ViewMode = "orbit" | "top" | "cabin" | "side";

export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;
  mode: ViewMode = "orbit";
  private yaw = Math.PI; // Blick von hinten auf den Bagger
  private pitch = 0.42;
  private dist = 11;
  private headYaw = 0;
  private headPitch = 0;
  private smoothedTarget = new THREE.Vector3();
  private tmpTarget = new THREE.Vector3();
  private tmpEye = new THREE.Vector3();
  /** von main gesetzt, wenn der Ansicht-Button per Touch gedrückt wurde */
  touchViewPress = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 300);
    this.camera.rotation.order = "YXZ";
  }

  update(
    dt: number,
    input: Input,
    getTarget: (out: THREE.Vector3) => THREE.Vector3,
    getCabin: (out: THREE.Vector3) => number // füllt Augpunkt, liefert Basis-Yaw
  ): void {
    if (input.wasPressed("KeyC") || this.touchViewPress) {
      this.touchViewPress = false;
      this.mode =
        this.mode === "orbit"
          ? "top"
          : this.mode === "top"
            ? "cabin"
            : this.mode === "cabin"
              ? "side"
              : "orbit";
      const fov = this.mode === "cabin" ? 80 : 55;
      if (this.camera.fov !== fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      if (this.mode === "cabin") {
        this.headYaw = 0;
        this.headPitch = -0.22; // leicht gesenkt: Joysticks + Arbeitsbereich im Bild
      }
    }

    if (this.mode === "cabin") {
      this.headYaw = THREE.MathUtils.clamp(
        this.headYaw - input.orbitDX * 0.004,
        -3.2, // volle Rundumsicht (±180° + etwas Schulterblick)
        3.2
      );
      this.headPitch = THREE.MathUtils.clamp(
        this.headPitch - input.orbitDY * 0.004,
        -1.15, // weit genug nach unten, um auf die Konsolen zu schauen
        0.8
      );
      const baseYaw = getCabin(this.tmpEye);
      this.camera.position.copy(this.tmpEye);
      // Kamera schaut entlang -Z → π Versatz, damit Blick = Kabinenfront (+Z)
      this.camera.rotation.set(this.headPitch, baseYaw + this.headYaw + Math.PI, 0);
      return;
    }

    this.yaw -= input.orbitDX * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.orbitDY * 0.005, 0.08, 1.35);
    if (input.shiftHeld && input.wheelDelta !== 0) {
      this.dist = THREE.MathUtils.clamp(this.dist + input.wheelDelta * 1.2, 3, 18);
    }

    getTarget(this.tmpTarget);
    this.smoothedTarget.lerp(this.tmpTarget, Math.min(dt * 6, 1));

    if (this.mode === "top") {
      // Draufsicht: hoch über dem Platz, 60° geneigt
      const off = new THREE.Vector3(0, 25, -14.4); // atan(14.4/25) ≈ 30° von der Senkrechten → 60° Neigung
      this.camera.position.copy(this.smoothedTarget).add(off);
    } else if (this.mode === "side") {
      // Seitenansicht zum Baggern: rechtwinklig zur Arbeitsrichtung, flach —
      // hier lassen sich Auslegerhöhe und Greiferabstand gut abschätzen
      const off = new THREE.Vector3(
        Math.sin(this.yaw + Math.PI / 2) * 15,
        6.5,
        Math.cos(this.yaw + Math.PI / 2) * 15
      );
      this.camera.position.copy(this.smoothedTarget).add(off);
    } else {
      const off = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      ).multiplyScalar(this.dist);
      this.camera.position.copy(this.smoothedTarget).add(off);
    }
    this.camera.lookAt(this.smoothedTarget);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
