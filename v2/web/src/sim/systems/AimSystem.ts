import type { System, SimContext } from "./System";
import type { ExcavatorSystem } from "./ExcavatorSystem";
import type { GripSystem } from "./GripSystem";
import type { ItemId } from "@/shared/ids";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { GROUP } from "@/sim/world/collisionGroups";
import type { Level } from "@/sim/world/Level";
import { clawTipRadius } from "@/shared/clawGeometry";

/**
 * Zielhilfe (Briefing Kap. 5.4, 14.1, 16.2): Was liegt unter der Spinne, und passt die Ladung dorthin?
 * Ein Strahl vom Sensor senkrecht nach unten trifft das oberste lose Teil oder den Boden/eine Mulde.
 * Daraus entstehen die Daten für Bodenring und Griff-Info-Chip — Farben wählt die Ansicht, nicht die Simulation.
 *
 *  verdict  neutral   nichts Greifbares, kein Container
 *           item      greifbares Teil unter der Spinne (Ring in Fraktionsfarbe)
 *           ok        Ladung über dem passenden Container (grün)
 *           tolerated Metall über der Störstoffbox — erlaubt, aber Verlust (gelb)
 *           wrong     Ladung passt nicht (rot)
 */
export type AimVerdict = "neutral" | "item" | "ok" | "tolerated" | "wrong";

export interface AimState {
  /** Auftreffpunkt des Strahls (Welt) */
  x: number; y: number; z: number;
  /** Ring-Radius = aktuelle Greiferöffnung an den Spitzen */
  radiusM: number;
  /** Teil direkt unter dem Sensor (lose), sonst null */
  hoverItemId: ItemId | null; hoverMaterialId: string | null; hoverKg: number;
  /** Container, über dessen Grundriss der Sensor steht */
  containerId: string | null;
  verdict: AimVerdict;
  /** Chip: Ladung in der Spinne — Material (oder "mixed"), Gesamtmasse */
  heldMaterialId: string | null; heldKg: number; heldCount: number;
}

export class AimSystem implements System {
  readonly name = "aim";
  readonly phase = "postStep" as const;
  readonly order = 20;

  readonly state: AimState = { x: 0, y: 0, z: 0, radiusM: 1, hoverItemId: null, hoverMaterialId: null, hoverKg: 0, containerId: null, verdict: "neutral", heldMaterialId: null, heldKg: 0, heldCount: 0 };
  private ex!: ExcavatorSystem; private grip!: GripSystem;
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private maxToi = 14;
  /** Nur Boden/Wände/Mulden und lose Teile — nie den Bagger selbst oder die eigene Ladung */
  private readonly filter = (GROUP.STATIC | GROUP.LOOSE) | ((GROUP.STATIC | GROUP.LOOSE | GROUP.EXCAVATOR | GROUP.HELD | GROUP.VEHICLE) << 16);

  constructor(private readonly level: Level) {}

  init(ctx: SimContext): void {
    this.ex = ctx.get<ExcavatorSystem>("excavator");
    this.grip = ctx.get<GripSystem>("grip");
    this.maxToi = Number(ctx.data.balancing.assist["aimRayMaxM"]);
  }

  update(ctx: SimContext): void {
    const p = this.ex.pose, st = this.state;
    st.radiusM = Math.max(0.3, clawTipRadius(p.splay));
    // Strahl ab Sensor nach unten; die Spinne selbst ist über Kollisionsgruppen ausgeschlossen
    this.ray.origin.x = p.sensorPos.x; this.ray.origin.y = p.sensorPos.y + 0.3; this.ray.origin.z = p.sensorPos.z;
    const hit = ctx.physics.world.castRay(this.ray, this.maxToi, true, undefined, this.filter);
    st.hoverItemId = null; st.hoverMaterialId = null; st.hoverKg = 0;
    if (hit) {
      st.x = this.ray.origin.x; st.y = this.ray.origin.y - hit.timeOfImpact; st.z = this.ray.origin.z;
      const body = hit.collider.parent();
      const id = body ? ctx.physics.itemOf(body.handle) : null;
      const item = id ? ctx.world.items.get(id) : undefined;
      if (item && item.state === "loose") { st.hoverItemId = item.id; st.hoverMaterialId = item.materialId; st.hoverKg = item.massKg; }
    } else { st.x = p.sensorPos.x; st.y = 0; st.z = p.sensorPos.z; }
    st.containerId = this.level.containerAt(st.x, st.z);

    // Ladung
    const ids = this.grip.heldIds;
    st.heldCount = ids.length; st.heldKg = this.grip.totalMassKg; st.heldMaterialId = null;
    for (const id of ids) {
      const it = ctx.world.items.get(id); if (!it) continue;
      st.heldMaterialId = st.heldMaterialId === null || st.heldMaterialId === it.materialId ? it.materialId : "mixed";
    }

    // Urteil
    if (st.containerId && st.heldCount > 0) st.verdict = this.judge(ctx, ids, st.containerId);
    else if (st.hoverItemId && st.heldCount === 0) st.verdict = "item";
    else st.verdict = "neutral";
  }

  /** Schlechtestes Urteil über alle gehaltenen Teile (Briefing Kap. 16.2). */
  private judge(ctx: SimContext, ids: ItemId[], containerId: string): AimVerdict {
    const cont = ctx.data.level.containers.find((c) => c.id === containerId);
    if (!cont) return "neutral";
    let worst: AimVerdict = "ok";
    for (const id of ids) {
      const it = ctx.world.items.get(id); if (!it) continue;
      const mat = ctx.data.materials.materials.find((m) => m.id === it.materialId);
      if (!mat) continue;
      const target = mat.containerId;
      let v: AimVerdict;
      if (target === containerId) v = "ok";
      else if (cont.materialId === "contaminant" && mat.sellPricePerKg > 0) v = "tolerated";
      else v = "wrong";
      if (v === "wrong") return "wrong";
      if (v === "tolerated") worst = "tolerated";
    }
    return worst;
  }
}
