import * as THREE from "three";

/**
 * Radlader für den Platzwart (Wunsch 02.09.2026).
 *
 * Damit räumt Lambert, was er von Hand nicht heben kann: schwere Brocken, die
 * eine Fahrspur blockieren, und größere Mengen zwischen Haufen und Mulden.
 *
 * Knickgelenkt wie ein echter Radlader — Vorder- und Hinterwagen drehen
 * gegeneinander, statt dass die Räder einschlagen. Das prägt die Silhouette
 * und macht die Bewegung erkennbar.
 */

/** Abstand Knickgelenk → Vorderachse */
const FRONT_LEN = 1.15;
/** Fahrgeschwindigkeit (m/s) — deutlich flotter als zu Fuß */
export const LOADER_SPEED = 4.2;
/** Wie schnell der Knick einlenkt (rad/s) */
const ARTICULATION_RATE = 0.9;
/** Maximaler Knickwinkel */
const ARTICULATION_MAX = 0.62;

export class WheelLoader {
  readonly group = new THREE.Group();
  /** Vorderwagen mit Schaufel — dreht am Knickgelenk mit */
  private front = new THREE.Group();
  private armPivot = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  /** aktueller Knickwinkel */
  private articulation = 0;
  /** 0 = Schaufel am Boden, 1 = gehoben */
  private lift = 0;
  private liftTarget = 0;

  constructor(scene: THREE.Scene) {
    const yellow = new THREE.MeshStandardMaterial({ color: 0xd8a72a, roughness: 0.6, metalness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8d959b, roughness: 0.55, metalness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xa8c4cc,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
    });

    // --- Hinterwagen: Motor, Kabine, Gegengewicht ---
    const rear = new THREE.Group();
    const rearBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.9), yellow);
    rearBody.position.set(0, 0.95, -0.95);
    rearBody.castShadow = true;
    rear.add(rearBody);
    // Motorhaube läuft nach hinten schmaler zu
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.7), yellow);
    hood.position.set(0, 0.78, -2.05);
    rear.add(hood);
    const counterweight = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.5, 0.3), dark);
    counterweight.position.set(0, 0.62, -2.42);
    rear.add(counterweight);

    // Kabine
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.1), dark);
    cab.position.set(0, 1.9, -0.6);
    rear.add(cab);
    for (const [px, pz, sx, sz] of [
      [0, 0.56, 1.0, 0.04],
      [0, -0.56, 1.0, 0.04],
      [0.58, 0, 0.04, 1.0],
      [-0.58, 0, 0.04, 1.0],
    ] as Array<[number, number, number, number]>) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.78, sz), glass);
      pane.position.set(px, 1.95, -0.6 + pz);
      rear.add(pane);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 1.2), yellow);
    roof.position.set(0, 2.47, -0.6);
    rear.add(roof);
    // Rundumleuchte
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xe08a1a, emissive: 0xc06000, emissiveIntensity: 0.6 })
    );
    beacon.position.set(0.42, 2.58, -0.6);
    rear.add(beacon);
    this.group.add(rear);

    // --- Vorderwagen: dreht am Knickgelenk ---
    const frontBody = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.62, 1.5), yellow);
    frontBody.position.set(0, 0.82, 0.72);
    frontBody.castShadow = true;
    this.front.add(frontBody);
    // Das Knickgelenk selbst
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10), steel);
    joint.position.set(0, 0.85, 0);
    this.front.add(joint);

    // Hubarm und Schaufel hängen am Vorderwagen
    this.armPivot.position.set(0, 0.95, 1.1);
    this.front.add(this.armPivot);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 1.7), yellow);
      arm.position.set(side * 0.52, 0.1, 0.82);
      arm.castShadow = true;
      this.armPivot.add(arm);
      // Hubzylinder darunter
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), steel);
      cyl.rotation.x = Math.PI / 2 - 0.35;
      cyl.position.set(side * 0.52, -0.16, 0.55);
      this.armPivot.add(cyl);
    }
    // Schaufel: Rückwand, Boden und Schneide
    const bucket = new THREE.Group();
    bucket.position.set(0, 0.02, 1.72);
    const bBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.1), steel);
    bBack.position.set(0, 0.24, -0.02);
    bucket.add(bBack);
    const bFloor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.72), steel);
    bFloor.position.set(0, -0.04, 0.34);
    bucket.add(bFloor);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.16), dark);
    edge.position.set(0, -0.07, 0.72);
    bucket.add(edge);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.72), steel);
      wall.position.set(side * 0.85, 0.18, 0.34);
      bucket.add(wall);
    }
    bucket.castShadow = true;
    this.armPivot.add(bucket);
    this.group.add(this.front);

    // --- Räder: vorne am Vorderwagen, hinten am Hinterwagen ---
    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.42, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.44, 10);
    rimGeo.rotateZ(Math.PI / 2);
    for (const [px, pz, vorne] of [
      [0.72, 0.72, true],
      [-0.72, 0.72, true],
      [0.72, -1.15, false],
      [-0.72, -1.15, false],
    ] as Array<[number, number, boolean]>) {
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.position.set(px, 0.52, pz);
      wheel.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, yellow);
      wheel.add(rim);
      this.wheels.push(wheel);
      (vorne ? this.front : rear).add(wheel);
    }

    this.group.visible = false; // erst sichtbar, wenn gekauft
    scene.add(this.group);
  }

  /** Schaufel heben oder senken. */
  setLift(v: boolean): void {
    this.liftTarget = v ? 1 : 0;
  }

  get bucketRaised(): boolean {
    return this.lift > 0.7;
  }

  /**
   * Fahrzeug an Position und Blickrichtung setzen.
   *
   * @param heading gewünschte Fahrtrichtung (rad)
   * @param moving true, solange gefahren wird — dann drehen die Räder
   */
  update(dt: number, pos: THREE.Vector3, heading: number, moving: boolean): void {
    this.group.position.set(pos.x, 0, pos.z);

    // Knicklenkung: Der Hinterwagen zieht der Richtung hinterher, der
    // Vorderwagen zeigt schon dorthin, wo es hingeht.
    let diff = heading - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const knick = THREE.MathUtils.clamp(diff, -ARTICULATION_MAX, ARTICULATION_MAX);
    this.articulation += THREE.MathUtils.clamp(
      knick - this.articulation,
      -ARTICULATION_RATE * dt,
      ARTICULATION_RATE * dt
    );
    this.front.rotation.y = this.articulation;
    this.front.position.set(0, 0, 0);
    // Der Hinterwagen folgt nach, langsamer als der Knick
    this.group.rotation.y += diff * Math.min(dt * 2.2, 1);

    if (moving) {
      for (const w of this.wheels) w.rotation.x -= dt * 6;
    }

    const step = dt / 1.1;
    this.lift += THREE.MathUtils.clamp(this.liftTarget - this.lift, -step, step);
    this.armPivot.rotation.x = -this.lift * 0.55;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  /** Wo die Schaufel gerade steht — dorthin wandert aufgenommenes Material. */
  bucketPosition(out: THREE.Vector3): THREE.Vector3 {
    this.armPivot.updateWorldMatrix(true, false);
    return out.set(0, 0.3, 1.72).applyMatrix4(this.armPivot.matrixWorld);
  }

  /** Grundfläche für die Hindernisprüfung anderer Figuren. */
  get footprintRadius(): number {
    return 2.2;
  }
}

/** Vorne am Knick: dort sitzt die Achse, um die der Vorderwagen dreht. */
export const LOADER_FRONT_LEN = FRONT_LEN;
