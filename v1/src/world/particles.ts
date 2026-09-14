import * as THREE from "three";

/**
 * Minimales gepooltes Partikelsystem (ein THREE.Points-Objekt).
 * Genutzt für Boden-Staub und Funken (M2: zusätzlich Glas, Späne).
 * Budget: 400 Partikel gesamt (SW) — weit unter Mobile-Budget.
 */
const MAX = 400;
const GRAVITY = 7; // m/s² (SW, bewusst weicher als 9.81 — liest sich besser)

export class Particles {
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private next = 0;
  private geo = new THREE.BufferGeometry();
  private tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999; // unsichtbar parken
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const points = new THREE.Points(this.geo, mat);
    points.frustumCulled = false;
    scene.add(points);
  }

  /**
   * @param speed horizontale Streugeschwindigkeit (m/s)
   * @param up vertikaler Anfangsimpuls (m/s)
   * @param lifeSec Lebensdauer (± 30 % Zufall)
   */
  spawn(
    at: THREE.Vector3,
    count: number,
    colorHex: number,
    speed: number,
    up: number,
    lifeSec = 0.7
  ): void {
    this.tmpColor.setHex(colorHex);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.2;
      this.pos[i * 3 + 1] = at.y + Math.random() * 0.1;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.2;
      this.vel[i * 3] = Math.cos(a) * s;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.col[i * 3] = this.tmpColor.r;
      this.col[i * 3 + 1] = this.tmpColor.g;
      this.col[i * 3 + 2] = this.tmpColor.b;
      this.life[i] = lifeSec * (0.7 + Math.random() * 0.6);
    }
    (this.geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= GRAVITY * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) {
        this.pos[i * 3 + 1] = 0.02; // Boden ist auch für Partikel hart
        this.vel[i * 3 + 1] *= -0.2;
      }
    }
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }
}
