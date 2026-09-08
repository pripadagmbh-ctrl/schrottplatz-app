import * as THREE from "three";

/**
 * Orbit-Kamera hinter der Kabine (Briefing Kap. 5.3, Stilguide 1.3): dreht mit dem Oberwagen, Ziel = Greifer,
 * weich nachgeführt (Zeitkonstante 0,3 s). Spieler kann per Ziehen um den Bagger orbiten und per Rad zoomen;
 * die Orbit-Abweichung zum Oberwagen bleibt erhalten, bis er sie ändert.
 * M3: Draufsicht (Briefing Kap. 5.3: fast senkrecht, 25 m, 60° Pitch, folgt dem Oberwagen; Rückfrage M3-3).
 * Beim Umschalten werden Distanz/Pitch weich (0,4 s) überblendet, damit kein Schnitt entsteht. Kabine [V1].
 */
export type CameraMode = "orbit" | "top";

export class CameraRig {
  distance = 11; pitch = (24 * Math.PI) / 180; yawOffset = 0;
  mode: CameraMode = "orbit";
  private orbitDistance = 11; private orbitPitch = (24 * Math.PI) / 180;
  readonly topDistance = 25; readonly topPitch = (60 * Math.PI) / 180;
  private readonly target = new THREE.Vector3(); private readonly tmp = new THREE.Vector3();
  private readonly minDist = 3; maxDist = 18; minPitch = (5 * Math.PI) / 180; maxPitch = (75 * Math.PI) / 180;
  private initialised = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Ansicht wechseln: Orbit ↔ Draufsicht. Orbit-Einstellungen bleiben für die Rückkehr erhalten. */
  cycle(): void { this.mode = this.mode === "orbit" ? "top" : "orbit"; }

  update(dt: number, baseYaw: number, grapple: { x: number; y: number; z: number }, cab: { x: number; y: number; z: number }, orbit: { dx: number; dy: number }, zoom: number): void {
    const k = 1 - Math.exp(-dt / 0.4);
    if (this.mode === "orbit") {
      this.yawOffset -= orbit.dx * 0.005;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + orbit.dy * 0.005, this.minPitch, this.maxPitch);
      this.orbitDistance = THREE.MathUtils.clamp(this.orbitDistance * Math.pow(1.12, zoom), this.minDist, this.maxDist);
      this.pitch += (this.orbitPitch - this.pitch) * k; this.distance += (this.orbitDistance - this.distance) * k;
    } else {
      // Draufsicht: feste Höhe und Neigung, Gesten wirken nicht; Kamera steht hinter dem Oberwagen
      this.yawOffset += (0 - this.yawOffset) * k;
      this.pitch += (this.topPitch - this.pitch) * k;
      this.distance += (this.topDistance - this.distance) * k;
    }
    // Ziel: zwischen Kabine und Greifer, näher am Greifer (dort passiert die Arbeit)
    this.tmp.set(cab.x * 0.35 + grapple.x * 0.65, cab.y * 0.35 + grapple.y * 0.65 + 0.5, cab.z * 0.35 + grapple.z * 0.65);
    if (!this.initialised) { this.target.copy(this.tmp); this.initialised = true; }
    else this.target.lerp(this.tmp, 1 - Math.exp(-dt / 0.3));
    const yaw = baseYaw + Math.PI + this.yawOffset; // hinter der Kabine
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(yaw) * cp * this.distance,
    );
    this.camera.lookAt(this.target);
  }
}
