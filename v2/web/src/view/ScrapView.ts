import * as THREE from "three";
import type { GameData } from "@/data/types";
import type { WorldState } from "@/sim/world/WorldState";

/**
 * Lose Teile als InstancedMesh je Form (Briefing Kap. 19.1 Punkt 2): ein Draw Call pro Form,
 * Farbe je Instanz aus der Fraktion. Interpolation zwischen prevPos und pos mit alpha.
 * Keine Allokationen pro Bild: Matrix, Vektoren und Quaternionen sind Felder.
 */
export class ScrapView {
  private meshes = new Map<string, THREE.InstancedMesh>();
  private capacity: number;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly qa = new THREE.Quaternion();
  private readonly qb = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly color = new THREE.Color();
  private colors = new Map<string, THREE.Color>();
  private readonly geoBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly geoCyl: THREE.CylinderGeometry;
  private readonly geoSphere = new THREE.SphereGeometry(1, 12, 8);
  private readonly material = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.25, flatShading: true });

  constructor(private readonly scene: THREE.Scene, data: GameData, capacity: number) {
    this.capacity = capacity;
    // Zylinderachse entlang Z, wie der Rapier-Kollider im ScrapSystem
    this.geoCyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    this.geoCyl.rotateX(Math.PI / 2);
    for (const mat of data.materials.materials) this.colors.set(mat.id, new THREE.Color(mat.color));
    for (const shape of data.materials.shapes) {
      const geo = shape.collider === "cylinder" ? this.geoCyl : shape.collider === "sphere" ? this.geoSphere : this.geoBox;
      const im = new THREE.InstancedMesh(geo, this.material, capacity);
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.set(shape.id, im);
      scene.add(im);
    }
  }

  update(world: WorldState, alpha: number): void {
    const counts = new Map<string, number>();
    for (const item of world.items.values()) {
      const im = this.meshes.get(item.shapeId);
      if (!im) continue;
      const i = counts.get(item.shapeId) ?? 0;
      if (i >= this.capacity) continue;
      counts.set(item.shapeId, i + 1);
      this.p.set(
        item.prevPos.x + (item.pos.x - item.prevPos.x) * alpha,
        item.prevPos.y + (item.pos.y - item.prevPos.y) * alpha,
        item.prevPos.z + (item.pos.z - item.prevPos.z) * alpha,
      );
      this.qa.set(item.prevRot.x, item.prevRot.y, item.prevRot.z, item.prevRot.w);
      this.qb.set(item.rot.x, item.rot.y, item.rot.z, item.rot.w);
      this.q.slerpQuaternions(this.qa, this.qb, alpha);
      this.s.set(item.size[0], item.size[1], item.size[2]);
      this.m.compose(this.p, this.q, this.s);
      im.setMatrixAt(i, this.m);
      const c = this.colors.get(item.materialId) ?? this.color.set("#ff00ff");
      im.setColorAt(i, item.sleeping ? this.color.copy(c).multiplyScalar(0.85) : c);
    }
    for (const [shapeId, im] of this.meshes) {
      im.count = counts.get(shapeId) ?? 0;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const im of this.meshes.values()) { this.scene.remove(im); im.dispose(); }
    this.geoBox.dispose(); this.geoCyl.dispose(); this.geoSphere.dispose(); this.material.dispose();
  }
}
