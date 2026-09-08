import * as THREE from "three";
import type { AimState } from "@/sim/systems/AimSystem";
import type { MaterialDef } from "@/data/types";

/**
 * Bodenring (Briefing Kap. 14.1, 16.2): flacher Ring unter der Spinne, Ø = Greiferöffnung, auf dem obersten
 * Objekt/Boden. Weiß neutral, Fraktionsfarbe über greifbarem Teil, Ampel über Container.
 * Farbe ist nie der einzige Kanal (Kap. 20): dazu kommt ein Symbol ✓ / ✗ / ! im Chip.
 * Position wird pro Bild weich nachgeführt (0,05 s), damit der Ring bei Sprüngen des Strahls nicht flackert.
 */
const COLORS = { neutral: "#eef0ec", ok: "#4fbf3f", tolerated: "#f2b632", wrong: "#e0483a" } as const;

export class AimRing {
  private readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly color = new THREE.Color();
  private readonly matColors = new Map<string, string>();
  private readonly pos = new THREE.Vector3(); private init = false;

  constructor(scene: THREE.Scene, materials: readonly MaterialDef[]) {
    for (const m of materials) this.matColors.set(m.id, m.color);
    const geo = new THREE.RingGeometry(0.82, 1, 48);
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.neutral, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  update(a: AimState, dt: number): void {
    const target = this.pos.set(a.x, a.y + 0.03, a.z);
    if (!this.init) { this.mesh.position.copy(target); this.init = true; }
    else this.mesh.position.lerp(target, 1 - Math.exp(-dt / 0.05));
    const s = a.radiusM; this.mesh.scale.set(s, s, 1);
    const hex = a.verdict === "item" ? (this.matColors.get(a.hoverMaterialId ?? "") ?? COLORS.neutral) : COLORS[a.verdict];
    this.color.set(hex);
    // Störstoff-Grau ist auf Beton kaum zu sehen → leicht aufhellen
    if (a.verdict === "item" && this.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.25) this.color.offsetHSL(0, 0, 0.25);
    this.mesh.material.color.copy(this.color);
  }

  dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.removeFromParent(); }
}
