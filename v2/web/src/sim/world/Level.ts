import type { LevelDef, Rect } from "@/data/types";
import { RAPIER, type PhysicsWorld } from "./PhysicsWorld";
import { COLLISION } from "./collisionGroups";
import { inRect } from "@/shared/math";

/**
 * Baut aus `level_yard.json` die statische Physik (Boden, Wände, Mulden) und beantwortet
 * Zonenfragen. Eine Wahrheit statt drei (Prototyp: yard.ts, obstacles.ts, containers.ts).
 * Die Sichtgeometrie in view/ liest dieselbe Definition — nie eigene Zahlen.
 */
export interface WallBox { cx: number; cz: number; hx: number; hy: number; hz: number; rotY: number; kind: "wall" | "container" | "ground"; }

export class Level {
  readonly boxes: WallBox[] = [];

  constructor(readonly def: LevelDef, physics: PhysicsWorld) {
    const w = physics.world;
    // Boden: dicke Platte, Oberkante y = 0
    this.addBox(w, { cx: 0, cz: 0, hx: def.size.w / 2, hy: 0.5, hz: def.size.d / 2, rotY: 0, kind: "ground" }, -0.5);
    for (const wall of def.walls) {
      const [x1, z1] = wall.from, [x2, z2] = wall.to;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const rotY = Math.atan2(x2 - x1, z2 - z1); // 0 = entlang +Z
      this.addBox(w, { cx: (x1 + x2) / 2, cz: (z1 + z2) / 2, hx: wall.thickness / 2, hy: wall.height / 2, hz: len / 2, rotY, kind: "wall" }, wall.height / 2);
    }
    for (const c of def.containers.filter((c) => c.stage === 1)) this.addContainerWalls(w, c.rect, c.wallHeight, c.kind === "pile" ? c.openSide : null);
  }

  /** Mulde = 4 Wände, Haufen (Betonlego) = 3 Wände, offene Seite frei. Wandstärke 0,3 m (SW). */
  private addContainerWalls(w: RAPIER.World, r: Rect, height: number, openSide: "north" | "south" | "east" | "west" | null): void {
    const t = 0.15; const hy = height / 2;
    const sides: { side: "north" | "south" | "east" | "west"; cx: number; cz: number; hx: number; hz: number }[] = [
      { side: "north", cx: r.x, cz: r.z + r.hd - t, hx: r.hw, hz: t },
      { side: "south", cx: r.x, cz: r.z - r.hd + t, hx: r.hw, hz: t },
      { side: "east", cx: r.x + r.hw - t, cz: r.z, hx: t, hz: r.hd },
      { side: "west", cx: r.x - r.hw + t, cz: r.z, hx: t, hz: r.hd },
    ];
    for (const s of sides) {
      if (s.side === openSide) continue;
      this.addBox(w, { cx: s.cx, cz: s.cz, hx: s.hx, hy, hz: s.hz, rotY: 0, kind: "container" }, hy);
    }
  }

  private addBox(w: RAPIER.World, b: WallBox, cy: number): void {
    const half = Math.sin(b.rotY / 2), cos = Math.cos(b.rotY / 2);
    w.createCollider(
      RAPIER.ColliderDesc.cuboid(b.hx, b.hy, b.hz)
        .setTranslation(b.cx, cy, b.cz)
        .setRotation({ x: 0, y: half, z: 0, w: cos })
        .setCollisionGroups(COLLISION.static)
        .setFriction(0.8),
    );
    this.boxes.push(b);
  }

  zone(id: string): Rect {
    const z = this.def.zones.find((z) => z.id === id);
    if (!z) throw new Error(`Zone unbekannt: ${id}`);
    return z.rect;
  }
  inZone(id: string, x: number, z: number): boolean {
    const r = this.zone(id);
    return inRect(x, z, r.x, r.z, r.hw, r.hd);
  }
  /** Container, in dessen Grundriss (x,z) liegt — oder null. */
  containerAt(x: number, z: number): string | null {
    for (const c of this.def.containers) if (inRect(x, z, c.rect.x, c.rect.z, c.rect.hw, c.rect.hd)) return c.id;
    return null;
  }
  /** Liegt (x,z) innerhalb des Platzes? Für den Fuzz-Test. */
  insideYard(x: number, z: number): boolean {
    return Math.abs(x) <= this.def.size.w / 2 + 1 && Math.abs(z) <= this.def.size.d / 2 + 1;
  }
}
