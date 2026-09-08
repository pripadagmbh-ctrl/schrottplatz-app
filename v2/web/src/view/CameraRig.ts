import * as THREE from "three";

/**
 * Orbit-Kamera hinter der Kabine (Briefing Kap. 5.3, Stilguide 1.3): dreht mit dem Oberwagen, Ziel = Greifer,
 * weich nachgeführt (Zeitkonstante 0,3 s). Spieler kann per Ziehen um den Bagger orbiten und per Rad zoomen;
 * die Orbit-Abweichung zum Oberwagen bleibt erhalten, bis er sie ändert.
 * M3: Draufsicht (Briefing Kap. 5.3: fast senkrecht, 25 m, 60° Pitch, folgt dem Oberwagen; Rückfrage M3-3).
 * Beim Umschalten werden Distanz/Pitch weich (0,4 s) überblendet, damit kein Schnitt entsteht.
 * Kabine (vorgezogen aus V1, iPad-Test 08.09.: aus 11 m Orbit sind die Teile zum Sortieren zu klein) wie im
 * Prototyp (orbitCamera.ts:47-72): starre Fahrersicht in Oberwagen-Richtung, leicht gesenkt (−0,22 rad), 80° Sichtfeld,
 * Wischen dreht den Kopf (±120° / ±45°), Pinch stellt das Sichtfeld 60–95°. Dazu folgt der Kopf der Spinne sanft
 * und nur teilweise (followFraction, followSeconds — Patrick 08.09.: „Nachführen ist cool, evtl. minimal starrer").
 */
export type CameraMode = "orbit" | "top" | "cabin";

export class CameraRig {
  distance = 11; pitch = (24 * Math.PI) / 180; yawOffset = 0;
  mode: CameraMode = "orbit";
  private orbitDistance = 11; private orbitPitch = (24 * Math.PI) / 180;
  readonly topDistance = 25; readonly topPitch = (60 * Math.PI) / 180;
  private readonly target = new THREE.Vector3(); private readonly tmp = new THREE.Vector3();
  private readonly minDist = 3; maxDist = 18; minPitch = (5 * Math.PI) / 180; maxPitch = (75 * Math.PI) / 180;
  private initialised = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Ansicht wechseln: Orbit → Draufsicht → Kabine → Orbit. Orbit-Einstellungen bleiben für die Rückkehr erhalten. */
  cycle(): void { this.mode = this.mode === "orbit" ? "top" : this.mode === "top" ? "cabin" : "orbit"; }

  private headYaw = 0; private headPitch = -0.22; private cabinFov = 80;
  /** manueller Kopfversatz (Wischen) zusätzlich zur sanften Nachführung */
  private headYawUser = 0; private headPitchUser = 0;
  followFraction = 0.6; followSeconds = 0.4;

  update(dt: number, baseYaw: number, grapple: { x: number; y: number; z: number }, cab: { x: number; y: number; z: number }, orbit: { dx: number; dy: number }, zoom: number, eye?: { x: number; y: number; z: number }): void {
    const k = 1 - Math.exp(-dt / 0.4);
    if (this.mode === "cabin" && eye) {
      // Kabine: Auge in der Kabine, Blick = Oberwagen-Richtung + Kopfdrehung; three schaut entlang −Z, daher + π
      this.camera.position.set(eye.x, eye.y, eye.z);
      this.headYawUser = THREE.MathUtils.clamp(this.headYawUser - orbit.dx * 0.004, -2.1, 2.1);
      this.headPitchUser = THREE.MathUtils.clamp(this.headPitchUser - orbit.dy * 0.004, -0.8, 0.8);
      // Sanfte Nachführung: Richtung Auge → Spinne relativ zur Oberwagen-Achse, nur zum Teil und verzögert
      const dx = grapple.x - eye.x, dy = grapple.y - 0.5 - eye.y, dz = grapple.z - eye.z;
      let relYaw = Math.atan2(dx, dz) - baseYaw; relYaw = Math.atan2(Math.sin(relYaw), Math.cos(relYaw));
      const relPitch = Math.atan2(dy, Math.hypot(dx, dz));
      const kf = 1 - Math.exp(-dt / this.followSeconds);
      this.headYaw += (relYaw * this.followFraction - this.headYaw) * kf;
      this.headPitch += ((-0.22 * (1 - this.followFraction) + relPitch * this.followFraction) - this.headPitch) * kf;
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.set(THREE.MathUtils.clamp(this.headPitch + this.headPitchUser, -1.2, 1.2), baseYaw + this.headYaw + this.headYawUser + Math.PI, 0);
      this.cabinFov = THREE.MathUtils.clamp(this.cabinFov * Math.pow(1.08, zoom), 60, 95);
      if (this.camera.fov !== this.cabinFov) { this.camera.fov = this.cabinFov; this.camera.updateProjectionMatrix(); }
      this.initialised = false; // Orbit-Ziel beim Zurückwechseln neu setzen (kein Schwenk aus der Kabine heraus)
      return;
    }
    if (this.camera.fov !== 50) { this.camera.fov = 50; this.camera.updateProjectionMatrix(); }
    this.headYaw = 0; this.headPitch = -0.22; this.headYawUser = 0; this.headPitchUser = 0; // Kopf beim nächsten Einstieg wieder geradeaus
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
