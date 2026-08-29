import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ItemManager } from "./scrapItems";
import type { EventBus } from "../core/events";

/**
 * Zerstörbare Zaunfelder (M2, Design-Pivot): stehen verankert (gelockte
 * Dynamik-Körper). Ein harter Treffer (schnelles Objekt) oder ein Griff der
 * Spinne reißt sie aus der Verankerung — dann kippen sie physisch um und
 * werden zu greif-/sortierbarem Stahlschrott.
 */

interface FenceSegment {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  broken: boolean;
}

const SEGMENT_MASS_KG = 18;
const BREAK_SPEED = 2.5; // m/s des auftreffenden Objekts (SW)

export class FenceManager {
  /** null = beim Laden bereits als gebrochen übersprungen */
  private segments: Array<FenceSegment | null> = [];

  constructor(
    scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private bus: EventBus,
    /** aus dem Spielstand: bereits gebrochene Felder werden nicht neu gebaut */
    alreadyBroken: boolean[] = []
  ) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.6, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.8 });
    // Zaunreihe an der Ostseite (SW-Position — Süden gehört jetzt Presse + Schrottbergen)
    for (let i = 0; i < 6; i++) {
      if (alreadyBroken[i]) {
        this.segments.push(null);
        continue;
      }
      const x = 12 + i * 2.05;
      const z = -8;
      const group = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.05, 0.05), metal);
      panel.position.y = 0.12;
      panel.castShadow = true;
      group.add(panel);
      for (const px of [-0.95, 0.95]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.3, 0.07), dark);
        post.position.set(px, 0, 0);
        post.castShadow = true;
        group.add(post);
      }
      group.position.set(x, 0.65, z);
      scene.add(group);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.65, z)
      );
      body.lockTranslations(true, false);
      body.lockRotations(true, false);
      const collider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.98, 0.66, 0.05).setMass(SEGMENT_MASS_KG),
        body
      );
      this.segments.push({ body, collider, mesh: group, broken: false });
    }
  }

  /** Jeden Step: prüfen, ob ein schnelles Objekt ein verankertes Feld trifft.
   *  (Abprall-Kontakte leben oft nur 1–2 Steps — seltener prüfen verpasst sie.) */
  /** Für den Spielstand: welche Felder sind (oder waren) gebrochen? */
  get brokenFlags(): boolean[] {
    return this.segments.map((s) => s === null || s.broken);
  }

  update(): void {
    for (const seg of this.segments) {
      if (!seg || seg.broken) continue;
      let hit = false;
      this.world.contactPairsWith(seg.collider, (other) => {
        const body = other.parent();
        if (!body || body.handle === seg.body.handle) return;
        const v = body.linvel();
        if (Math.hypot(v.x, v.y, v.z) > BREAK_SPEED) hit = true;
      });
      if (hit) this.break(seg);
    }
  }

  /** Die Spinne hat ein verankertes Feld gepackt → sofort losreißen. */
  notifyGrabbed(body: RAPIER.RigidBody): void {
    const seg = this.segments.find((s) => s && !s.broken && s.body.handle === body.handle);
    if (seg) this.break(seg);
  }

  private break(seg: FenceSegment): void {
    seg.broken = true;
    seg.body.lockTranslations(false, true);
    seg.body.lockRotations(false, true);
    this.items.register({
      materialId: "steel",
      massKg: SEGMENT_MASS_KG,
      mesh: seg.mesh,
      body: seg.body,
      // fürs Save/Load: nach dem Laden wird das Feld zur schlichten Stahlplatte
      shape: { kind: "box", dims: [1.9, 1.15, 0.1], color: 0x8a9096 },
    });
    const p = seg.body.translation();
    this.bus.emit("fenceBroken", { x: p.x, y: p.y, z: p.z });
  }
}
