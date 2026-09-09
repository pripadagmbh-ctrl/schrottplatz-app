import * as THREE from "three";
import type { CompositeDef } from "@/data/types";
import type { WorldState } from "@/sim/world/WorldState";

/**
 * Baugruppen an Wracks (M5): Raeder, Batterie, Motor … als kleine Koerper am Anker des Rumpfs. Der Rumpf selbst ist ein
 * normales Schrottteil (ScrapView, Form hull_*). Abgerissene Baugruppen verschwinden hier und tauchen als eigenes Teil auf.
 * Liest nur; Pose = interpolierte Pose des Rumpf-Teils.
 */
interface Model { root: THREE.Group; parts: Map<string, THREE.Mesh>; yOffset: number }

export class CompositeView {
  private readonly models = new Map<string, Model>();
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly defs = new Map<string, CompositeDef>();
  private readonly tmpQ = new THREE.Quaternion(); private readonly tmpP = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene, defs: readonly CompositeDef[]) { for (const d of defs) this.defs.set(d.id, d); }

  update(world: WorldState, alpha: number): void {
    const seen = new Set<string>();
    for (const st of world.composites.values()) {
      const item = world.items.get(st.hullItemId); const def = this.defs.get(st.defId); if (!item || !def) continue;
      seen.add(st.id);
      let m = this.models.get(st.id); if (!m) { m = this.build(def); this.models.set(st.id, m); }
      // Pose wie die Teile: zwischen vorherigem und aktuellem Schritt
      this.tmpP.set(item.prevPos.x + (item.pos.x - item.prevPos.x) * alpha, item.prevPos.y + (item.pos.y - item.prevPos.y) * alpha, item.prevPos.z + (item.pos.z - item.prevPos.z) * alpha);
      this.tmpQ.set(item.prevRot.x, item.prevRot.y, item.prevRot.z, item.prevRot.w).slerp(new THREE.Quaternion(item.rot.x, item.rot.y, item.rot.z, item.rot.w), alpha);
      m.root.position.copy(this.tmpP); m.root.quaternion.copy(this.tmpQ);
      for (const [id, mesh] of m.parts) { const on = st.remainingParts.includes(id); if (mesh.visible !== on) mesh.visible = on; }
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m.root); this.models.delete(id); }
  }

  private mat(color: string): THREE.MeshStandardMaterial {
    let m = this.mats.get(color); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 }); this.mats.set(color, m); } return m;
  }

  private build(def: CompositeDef): Model {
    const root = new THREE.Group(); const parts = new Map<string, THREE.Mesh>();
    for (const p of def.parts) {
      if ((p.tier ?? "MVP") !== "MVP") continue;
      const s = p.shape.size;
      const geo = p.shape.kind === "wheel" ? new THREE.CylinderGeometry(s[0], s[0], s[1], 12).rotateZ(Math.PI / 2)
        : p.shape.kind === "cylinder" ? new THREE.CylinderGeometry(s[0], s[0], s[2] ?? s[1]!, 10).rotateX(Math.PI / 2)
        : new THREE.BoxGeometry(s[0], s[1], s[2]);
      const mesh = new THREE.Mesh(geo, this.mat(p.color)); mesh.castShadow = true;
      mesh.position.set(p.anchor[0], p.anchor[1] - def.hull.yOffset, p.anchor[2]);
      root.add(mesh); parts.set(p.id, mesh);
    }
    // Dach/Kabine als Andeutung, damit der Rumpf nicht nur ein Kasten ist
    const roof = new THREE.Mesh(new THREE.BoxGeometry(def.hull.half[0] * 1.6, 0.5, def.hull.half[2] * 0.9), this.mat("#6b7a86")); roof.position.set(0, def.hull.half[1] + 0.25, -0.3); roof.castShadow = true; root.add(roof);
    this.scene.add(root);
    return { root, parts, yOffset: def.hull.yOffset };
  }

  dispose(): void { for (const m of this.models.values()) this.scene.remove(m.root); this.models.clear(); }
}
