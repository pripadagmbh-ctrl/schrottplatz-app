import * as THREE from "three";
import type { GameData } from "@/data/types";
import type { WorldState } from "@/sim/world/WorldState";
import type { AimState } from "@/sim/systems/AimSystem";

/**
 * Fuellstand der Container (M4a): ein flacher Quader je Box in Fraktionsfarbe, Hoehe = verbuchte Masse / Kapazitaet × Wandhoehe.
 * Verbuchte Teile verschwinden nach kurzer Zeit (ContainerSystem) — der Quader ist ihre Masse.
 * Dazu die Box-Ampel (Patrick 08.09.: „richtige Box aus der Kabine kaum sichtbar"): eine leuchtende Platte auf den Waenden —
 * weiss auf der Zielbox der aktuellen Ladung, Ampelfarbe (gruen/gelb/rot) auf der Box unter der Spinne.
 */
const AMPEL = { ok: "#4fbf3f", tolerated: "#f2b632", wrong: "#e0483a", target: "#eef0ec" } as const;
export class ContainerFillView {
  private readonly meshes = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>>();
  private readonly cap = new Map<string, number>(); private readonly wallH = new Map<string, number>();
  private readonly rims = new Map<string, THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>>();
  private readonly targetOf = new Map<string, string>(); // materialId → containerId
  private pulse = 0;

  constructor(scene: THREE.Scene, data: GameData) {
    for (const c of data.level.containers) {
      const mat = data.materials.materials.find((m) => m.id === c.materialId);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.rect.hw * 2 - 0.4, 1, c.rect.hd * 2 - 0.4), new THREE.MeshStandardMaterial({ color: mat?.color ?? "#888", roughness: 0.9 }));
      mesh.position.set(c.rect.x, 0, c.rect.z); mesh.visible = false; mesh.receiveShadow = true;
      scene.add(mesh); this.meshes.set(c.id, mesh);
      this.cap.set(c.id, c.kind === "pile" ? Number(data.balancing.containers["pileCapacityKg"] ?? 20000) : Number(data.balancing.containers["muldeCapacityKg"] ?? 6000));
      this.wallH.set(c.id, c.wallHeight);
      // Ampel-Platte knapp ueber den Waenden
      const rim = new THREE.Mesh(new THREE.BoxGeometry(c.rect.hw * 2 + 0.2, 0.12, c.rect.hd * 2 + 0.2), new THREE.MeshBasicMaterial({ color: AMPEL.target, transparent: true, opacity: 0.75, depthWrite: false }));
      rim.position.set(c.rect.x, c.wallHeight + 0.1, c.rect.z); rim.visible = false; rim.renderOrder = 4;
      scene.add(rim); this.rims.set(c.id, rim);
    }
    for (const m of data.materials.materials) {
      const target = m.containerId ?? data.materials.materials.find((x) => x.id === m.sortsAs)?.containerId;
      if (target) this.targetOf.set(m.id, target);
    }
  }

  /** Box-Ampel: Zielbox der Ladung weiss (pulsierend), Box unter der Spinne in Ampelfarbe. */
  updateAim(a: AimState, dt: number): void {
    this.pulse += dt;
    const target = a.heldCount > 0 && a.heldMaterialId && a.heldMaterialId !== "mixed" ? this.targetOf.get(a.heldMaterialId) : undefined;
    for (const [id, rim] of this.rims) {
      const under = a.containerId === id && a.heldCount > 0 && (a.verdict === "ok" || a.verdict === "tolerated" || a.verdict === "wrong");
      if (under) { rim.visible = true; rim.material.color.set(AMPEL[a.verdict as "ok" | "tolerated" | "wrong"]); rim.material.opacity = 0.85; }
      else if (target === id) { rim.visible = true; rim.material.color.set(AMPEL.target); rim.material.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(this.pulse * 4)); }
      else rim.visible = false;
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
  dispose(): void { for (const m of [...this.meshes.values(), ...this.rims.values()]) { m.geometry.dispose(); m.material.dispose(); m.removeFromParent(); } }
}
