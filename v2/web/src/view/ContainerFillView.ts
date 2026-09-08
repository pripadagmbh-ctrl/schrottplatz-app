import * as THREE from "three";
import type { GameData } from "@/data/types";
import type { WorldState } from "@/sim/world/WorldState";

/**
 * Fuellstand der Container (M4a): ein flacher Quader je Box in Fraktionsfarbe, Hoehe = verbuchte Masse / Kapazitaet × Wandhoehe.
 * Verbuchte Teile verschwinden nach kurzer Zeit (ContainerSystem) — der Quader ist ihre Masse.
 */
export class ContainerFillView {
  private readonly meshes = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>();
  private readonly cap = new Map<string, number>(); private readonly wallH = new Map<string, number>();

  constructor(scene: THREE.Scene, data: GameData) {
    for (const c of data.level.containers) {
      const mat = data.materials.materials.find((m) => m.id === c.materialId);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.rect.hw * 2 - 0.4, 1, c.rect.hd * 2 - 0.4), new THREE.MeshStandardMaterial({ color: mat?.color ?? "#888", roughness: 0.9 }));
      mesh.position.set(c.rect.x, 0, c.rect.z); mesh.visible = false; mesh.receiveShadow = true;
      scene.add(mesh); this.meshes.set(c.id, mesh);
      this.cap.set(c.id, c.kind === "pile" ? Number(data.balancing.containers["pileCapacityKg"] ?? 20000) : Number(data.balancing.containers["muldeCapacityKg"] ?? 6000));
      this.wallH.set(c.id, c.wallHeight);
    }
  }

  update(world: WorldState): void {
    for (const [id, mesh] of this.meshes) {
      const c = world.containers.get(id as never); const total = c ? c.contentKg + c.contaminationKg : 0;
      if (total <= 0) { mesh.visible = false; continue; }
      const h = Math.max(0.08, Math.min(1, total / (this.cap.get(id) ?? 6000)) * (this.wallH.get(id) ?? 1.5));
      mesh.visible = true; mesh.scale.y = h; mesh.position.y = h / 2 + 0.02;
    }
  }
  dispose(): void { for (const m of this.meshes.values()) { m.geometry.dispose(); m.material.dispose(); m.removeFromParent(); } }
}
