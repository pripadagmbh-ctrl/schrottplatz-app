import * as THREE from "three";
import type { VehicleRun } from "@/sim/systems/VehicleSystem";

/**
 * Kundenfahrzeuge (M4a): Kabine, Fahrgestell, Mulde (kippt ums Heckgelenk), Raeder — aus Grundkoerpern, Farbe je Typ.
 * Liest pro Bild die Laufdaten des VehicleSystems (Position, Heading, Kippwinkel); keine Logik.
 * Rahmen wie in der Simulation: Ursprung = Kippgelenk, +z = Fahrtrichtung.
 */
const COLORS: Record<string, string> = { tipper: "#c8452a", trailer: "#3b6ea5", lowloader: "#6a6f78", flatbed: "#8a7a3a", rolloff: "#2f6b3a" };

interface Model { root: THREE.Group; bed: THREE.Group; wheels: THREE.Mesh[]; }

export class VehicleView {
  private readonly models = new Map<string, Model>();
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly dark = new THREE.MeshStandardMaterial({ color: "#1e2124", roughness: 0.9 });
  private readonly rubber = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 1 });
  private readonly glass = new THREE.MeshStandardMaterial({ color: "#8fb3c9", roughness: 0.2, metalness: 0.3 });
  private readonly wheelGeo = new THREE.CylinderGeometry(1, 1, 0.4, 12);

  constructor(private readonly scene: THREE.Scene) { this.wheelGeo.rotateZ(Math.PI / 2); }

  update(runs: readonly VehicleRun[]): void {
    const seen = new Set<string>();
    for (const r of runs) {
      seen.add(r.delivery.id);
      let m = this.models.get(r.delivery.id);
      if (!m) { m = this.build(r); this.models.set(r.delivery.id, m); }
      m.root.position.set(r.pos.x, r.pos.y, r.pos.z);
      m.root.rotation.y = r.heading;
      m.bed.rotation.x = -r.bedAngle; // Front hoch (gleiche Konvention wie VehicleSystem.frameQuat)
      const roll = r.speed / Math.max(0.2, r.def.body.wheelR);
      for (const w of m.wheels) w.rotation.x += roll * (1 / 60);
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m.root); this.models.delete(id); }
  }

  private build(r: VehicleRun): Model {
    const b = r.def.body;
    const color = COLORS[r.def.id] ?? "#888";
    let mat = this.mats.get(color); if (!mat) { mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 }); this.mats.set(color, mat); }
    const root = new THREE.Group();
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    // Fahrgestell (Rahmen) und Kabine
    const frameY = b.floorY - 0.25;
    box(b.bedW * 0.5, 0.25, b.bedLen + b.cabLen + 0.3, this.dark, 0, frameY, (b.bedLen + b.cabLen + 0.3) / 2, root);
    const cabZ = b.bedLen + 0.15 + b.cabLen / 2;
    box(b.bedW * 0.95, 1.6, b.cabLen, mat, 0, b.floorY + 0.8, cabZ, root);
    box(b.bedW * 0.9, 0.6, 0.05, this.glass, 0, b.floorY + 1.1, cabZ + b.cabLen / 2 + 0.03, root); // Frontscheibe
    // Mulde: Gruppe am Heckgelenk (Ursprung), Boden + 3 Waende (Heck offen); flache Pritschen bekommen niedrige Waende
    const bed = new THREE.Group(); root.add(bed);
    box(b.bedW, 0.1, b.bedLen, this.dark, 0, b.floorY - 0.05, b.bedLen / 2, bed);
    box(0.08, b.wallH, b.bedLen, mat, -b.bedW / 2 + 0.04, b.floorY + b.wallH / 2, b.bedLen / 2, bed);
    box(0.08, b.wallH, b.bedLen, mat, b.bedW / 2 - 0.04, b.floorY + b.wallH / 2, b.bedLen / 2, bed);
    box(b.bedW, b.wallH, 0.08, mat, 0, b.floorY + b.wallH / 2, b.bedLen - 0.04, bed);
    // Raeder: 2 Achsen hinten (Kipper/Lkw) bzw. 1 (Anhaenger), 1 vorn
    const wheels: THREE.Mesh[] = [];
    const axles = r.def.id === "trailer" ? [b.bedLen * 0.45] : [b.bedLen * 0.2, b.bedLen * 0.45, b.bedLen + b.cabLen * 0.6];
    for (const z of axles) for (const side of [-1, 1]) {
      const w = new THREE.Mesh(this.wheelGeo, this.rubber); w.scale.set(1, b.wheelR, b.wheelR); w.position.set(side * (b.bedW / 2 + 0.05), b.wheelR, z); w.castShadow = true; root.add(w); wheels.push(w);
    }
    this.scene.add(root);
    return { root, bed, wheels };
  }

  dispose(): void { for (const m of this.models.values()) this.scene.remove(m.root); this.models.clear(); }
}
