import type { System, SimContext } from "./System";
import type { CompositeSystem } from "./CompositeSystem";
import type { ScrapSystem } from "./ScrapSystem";
import type { GripSystem } from "./GripSystem";
import type { CompositeState } from "@/sim/world/WorldState";
import type { ItemId } from "@/shared/ids";
import type { Level } from "@/sim/world/Level";

/**
 * Presse (M5b, Briefing Kap. 8.2/8.3): Station am Platz. Der Spieler legt einen Wrack-Rumpf hinein und loest ueber das
 * Menue aus; die Presse quetscht ihn in drei Stufen (`crushScales`) zu einem Stahlpaket.
 *
 * Zwei Regeln aus dem Briefing:
 *  - Verweigerung, solange eine Baugruppe mit `blocksPress` dranhaengt (Batterie: Saeure, Motor: Oel). Kein stiller
 *    Fehlschlag — die Presse sagt, WAS im Weg ist, damit der Spieler weiss, was zu tun ist.
 *  - Der Rumpf muss liegen, nicht haengen: ein Rumpf in der Spinne wird nicht gepresst.
 *
 * Das Pressen selbst ist bewusst NICHT physikalisch simuliert (Briefing Kap. 6 „was wird gefaked"): Der Rumpf wird
 * fuer die Dauer stillgelegt, optisch gestaucht und am Ende gegen ein Paket-Teil getauscht. Eine echte Verformung
 * waere teuer und im Ergebnis nicht unterscheidbar.
 */
export interface PressStatus {
  /** Rumpf liegt in der Presse */
  loaded: boolean;
  /** Auslösen möglich */
  ready: boolean;
  /** Warum nicht — Baugruppen-Ids, die im Weg sind */
  blockedBy: string[];
  /** läuft gerade */
  running: boolean;
  /** 0…1 */
  progress: number;
}

export class PressSystem implements System {
  readonly name = "press";
  readonly phase = "slow" as const;
  readonly order = 35;
  readonly every = 6; // wie die anderen Slow-Systeme: 10x pro Sekunde reicht fuer eine Station

  private ctx!: SimContext;
  private composites!: CompositeSystem;
  private scrap!: ScrapSystem;
  private grip!: GripSystem;
  constructor(private readonly level: Level) {}
  private stageSeconds = 1.2;
  private packHalf: [number, number, number] = [0.8, 0.3, 0.4];

  /** laufender Vorgang */
  private run: { compositeId: string; t: number; hullH: number } | null = null;

  init(ctx: SimContext): void {
    this.ctx = ctx;
    this.composites = ctx.get<CompositeSystem>("composites");
    this.scrap = ctx.get<ScrapSystem>("scrap");
    this.grip = ctx.get<GripSystem>("grip");
    const p = ctx.data.balancing.press;
    this.stageSeconds = Number(p["stageSeconds"]);
    const h = p["packHalf"] as number[];
    this.packHalf = [h[0]!, h[1]!, h[2]!];
  }

  /** Wrack, das gerade in der Presse liegt (nicht in der Spinne). */
  private loaded(): CompositeState | null {
    for (const st of this.ctx.world.composites.values()) {
      const hull = this.composites.hullItem(st);
      if (!hull || hull.state !== "loose") continue;
      if (this.level.inZone("press", hull.pos.x, hull.pos.z)) return st;
    }
    return null;
  }

  status(): PressStatus {
    if (this.run) {
      const st = this.ctx.world.composites.get(this.run.compositeId as never);
      const total = this.stageSeconds * 3;
      return { loaded: !!st, ready: false, blockedBy: [], running: true, progress: Math.min(1, this.run.t / total) };
    }
    const st = this.loaded();
    if (!st) return { loaded: false, ready: false, blockedBy: [], running: false, progress: 0 };
    const blockedBy = this.composites.blocksPress(st);
    return { loaded: true, ready: blockedBy.length === 0, blockedBy, running: false, progress: 0 };
  }

  /** Vom Menue gerufen. Gibt zurueck, ob der Vorgang startet; sonst sagt das Ereignis, was im Weg ist. */
  trigger(): boolean {
    if (this.run) return false;
    const st = this.loaded();
    if (!st) { this.deny("empty", []); return false; }
    const blockedBy = this.composites.blocksPress(st);
    if (blockedBy.length) { this.deny("blocked", blockedBy); return false; }
    const h = this.composites.hullItem(st);
    this.run = { compositeId: st.id, t: 0, hullH: h ? h.size[1] : 1 };
    st.crushStage = 0;
    this.ctx.bus.emit("pressStarted", { compositeId: st.id });
    return true;
  }

  private deny(reason: "empty" | "blocked", blockedBy: string[]): void {
    this.ctx.bus.emit("pressDenied", { reason, blockedBy });
  }

  update(ctx: SimContext, dt: number): void {
    if (!this.run) return;
    const st = ctx.world.composites.get(this.run.compositeId as never);
    const hull = st ? this.composites.hullItem(st) : undefined;
    if (!st || !hull) { this.run = null; return; } // Wrack ist weg (Laden, Verkauf) — Vorgang verfaellt

    this.run.t += dt;
    // Rumpf liegt still, solange die Presse arbeitet
    const body = hull.bodyHandle !== undefined ? ctx.physics.safeBody(hull.bodyHandle) : null;
    if (body) { body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); }

    const stage = Math.min(2, Math.floor(this.run.t / this.stageSeconds)) as 0 | 1 | 2;
    if (stage !== st.crushStage) {
      st.crushStage = stage;
      // Gequetscht wird ueber die HOEHE des Rumpf-Teils: Anzeige und Simulation lesen dieselbe Zahl, es gibt also
      // keine zweite Wahrheit. Der Kollider bleibt in Originalgroesse — der Rumpf liegt waehrenddessen still, und
      // ein mitschrumpfender Kollider brachte im Test nur Zittern (bewusst gefaked, Briefing Kap. 6).
      const def = this.composites.def(st.defId)!;
      const scale = def.crushScales[stage] ?? 1;
      const h = this.composites.hullItem(st);
      if (h && body) {
        h.size[1] = this.run.hullH * scale;
        const t = body.translation();
        body.setTranslation({ x: t.x, y: Math.max(h.size[1] / 2, t.y - (this.run.hullH * 0.12)), z: t.z }, true);
      }
      ctx.bus.emit("pressStage", { compositeId: st.id, stage });
    }
    if (this.run.t >= this.stageSeconds * 3) this.finish(st);
  }

  /** Rumpf gegen ein Stahlpaket tauschen; das Wrack hoert damit auf zu existieren. */
  private finish(st: CompositeState): void {
    const ctx = this.ctx;
    const def = this.composites.def(st.defId)!;
    const hull = this.composites.hullItem(st)!;
    // Alles, was noch dranhaengt und nicht blockiert (Raeder, Kat), wandert als Masse ins Paket
    const massKg = def.hull.massKg + this.composites.remaining(st).reduce((s, p) => s + p.massKg, 0);
    const pos = { ...hull.pos }; const rot = { ...hull.rot };
    pos.y = this.packHalf[1] + 0.02;

    if (hull.bodyHandle !== undefined) ctx.physics.requestRemove(hull.bodyHandle);
    ctx.world.items.delete(hull.id);
    ctx.world.composites.delete(st.id);

    const shape = this.scrap.shape("block");
    const size: [number, number, number] = [this.packHalf[0] * 2, this.packHalf[1] * 2, this.packHalf[2] * 2];
    const pack = shape ? this.scrap.spawnExact("steel", shape, size, pos, rot, { massKg }) : null;
    if (pack) { pack.origin = "torn"; }

    this.run = null;
    ctx.bus.emit("pressDone", { compositeId: st.id, itemId: (pack?.id ?? "") as ItemId, kg: massKg });
    ctx.bus.emit("toast", { text: `Paket gepresst · ${Math.round(massKg)} kg Stahl`, kind: "good" });
    void this.grip;
  }

  save(): unknown { return this.run ? { compositeId: this.run.compositeId, t: this.run.t, hullH: this.run.hullH } : null; }
  load(data: unknown): void {
    const d = data as { compositeId?: string; t?: number; hullH?: number } | null;
    this.run = d && typeof d.compositeId === "string"
      ? { compositeId: d.compositeId, t: Number(d.t) || 0, hullH: Number(d.hullH) || 1 }
      : null;
  }
}
