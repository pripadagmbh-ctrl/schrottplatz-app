import type { System, SimContext } from "./System";
import type { ScrapSystem } from "./ScrapSystem";
import type { VehicleSystem } from "./VehicleSystem";
import type { ItemId } from "@/shared/ids";
import type { Level } from "@/sim/world/Level";
import { Rng } from "@/shared/rng";

/**
 * Einweisung an Tag 0 (E-026, E-027): drei Lektionen mit blockierenden Schritten, neutrale Systemtexte.
 *  Lektion 1 — vier grosse Stahlteile liegen auf dem Abladeplatz. Schritte 1–4 fuehren einzeln an die Achsen
 *              (Hauptarm, Oberwagen, Stiel, Spinne) heran: jeder Schritt gilt, wenn die Achse `inputHoldS` lang
 *              bewegt wurde. Dann greifen, fahren (Fahrmodus, `driveDistanceM`), in die Stahlmulde legen —
 *              fertig bei `lesson1NeedBooked` verbuchten Teilen.
 *  Lektion 2 — Kipper der Giesserei (sortenrein Stahl, erzwungen). Warten bis abgekippt, dann `lesson2NeedShare`
 *              der Ladung in die Stahlmulde.
 *  Lektion 3 — Kipper Schrotthandel (Mischfuhre, erzwungen). `lesson3NeedShare` der Ladung richtig verbucht.
 * Danach `done`; der Spieler beendet den Tag selbst. Ueberspringen jederzeit (UI → `skip()`).
 * Die Simulation kennt keine Tasten: Texte waehlt die UI aus i18n `tutorial.l{lesson}s{step}[_touch|_kbd]`.
 * Nur aktiv an Tag 0 und nicht aus einem Spielstand mit Tag ≥ 1.
 */
export interface TutorialState { active: boolean; lesson: 1 | 2 | 3; step: number; done: number; need: number; wrong: number; finished: boolean }

export class TutorialSystem implements System {
  readonly name = "tutorial";
  readonly phase = "slow" as const;
  readonly order = 50;
  readonly every = 6;

  readonly state: TutorialState = { active: false, lesson: 1, step: 1, done: 0, need: 0, wrong: 0, finished: false };
  private ctx!: SimContext; private scrap!: ScrapSystem; private vehicles!: VehicleSystem;
  private t!: Record<string, number | string>;
  private hold = 0; private grabbed = false; private driveStart: { x: number; z: number } | null = null;
  private lessonItems = new Set<ItemId>(); private booked = new Set<ItemId>(); private wrongIds = new Set<ItemId>();
  private deliveryId: string | null = null; private dumped = false;
  private spawnedLesson1 = false; private resetOnBegin = false;

  constructor(private readonly level: Level) {}

  init(ctx: SimContext): void {
    this.ctx = ctx; this.scrap = ctx.get<ScrapSystem>("scrap"); this.vehicles = ctx.get<VehicleSystem>("vehicles");
    this.t = ctx.data.balancing.tutorial;
    ctx.bus.on("itemGrabbed", ({ itemId }) => { if (this.state.active && this.lessonItems.has(itemId)) this.grabbed = true; });
    ctx.bus.on("itemSorted", ({ itemId, containerId, correct }) => {
      if (!this.state.active || !this.lessonItems.has(itemId)) return;
      const wantSteel = this.state.lesson < 3;
      if (wantSteel ? containerId === "pile_steel" : correct) this.booked.add(itemId); else this.wrongIds.add(itemId);
    });
    ctx.bus.on("vehicleDumped", ({ deliveryId }) => { if (deliveryId === this.deliveryId) this.dumped = true; });
  }

  /** Von der App: Tutorial beginnen, wenn Tag 0 und Arbeitsphase (nach dem Laden nicht, wenn Tag ≥ 1). */
  begin(): void {
    if (this.state.finished || this.state.active || this.ctx.world.day.day !== 0) return;
    if (this.resetOnBegin) { // halb fertige Einweisung aus dem Spielstand: Tutorial-Teile weg, sauber neu
      for (const it of this.ctx.world.items.values()) if (it.origin === "tutorial") this.scrap.requestRemove(it.id, "cleanup");
      this.resetOnBegin = false; this.spawnedLesson1 = false;
    }
    this.state.active = true; this.setStep(1, 1);
    if (!this.spawnedLesson1) this.spawnLesson1();
  }
  skip(): void { if (this.state.finished) return; this.finish(); }

  private spawnLesson1(): void {
    this.spawnedLesson1 = true;
    const zone = this.level.zone("intake_pile"); const rng = new Rng(2026);
    const shapes = ["beam", "casting", "tank", "beam"]; const n = Number(this.t["lesson1ItemCount"] ?? 4);
    for (let i = 0; i < n; i++) {
      const fx = (i % 2) * 2 - 1, fz = (Math.floor(i / 2) % 2) * 2 - 1;
      const it = this.scrap.spawn({ materialId: "steel", shapeId: shapes[i % shapes.length]!, pos: { x: zone.x + fx * zone.hw * 0.45, y: 1.2, z: zone.z + fz * zone.hd * 0.45 }, origin: "tutorial", rng });
      if (it) this.lessonItems.add(it.id);
    }
    this.state.need = Math.min(n, Number(this.t["lesson1NeedBooked"] ?? 3));
  }

  private setStep(lesson: 1 | 2 | 3, step: number): void {
    const s = this.state; s.lesson = lesson; s.step = step; this.hold = 0;
    this.ctx.bus.emit("tutorialStep", { lesson, step, done: false });
  }

  update(ctx: SimContext, dt: number): void {
    const s = this.state; if (s.finished) return;
    if (ctx.world.day.phase !== "work") return;
    if (!s.active) { if (ctx.world.day.day === 0) this.begin(); return; }
    const c = ctx.control; const holdS = Number(this.t["inputHoldS"] ?? 1);
    const held = (v: number) => { this.hold += Math.abs(v) > 0.2 ? dt : 0; return this.hold >= holdS; };
    s.done = this.booked.size; s.wrong = this.wrongIds.size;
    if (s.lesson === 1) {
      switch (s.step) {
        case 1: if (held(c.boom)) this.setStep(1, 2); break;
        case 2: if (held(c.cab)) this.setStep(1, 3); break;
        case 3: if (held(c.stick)) this.setStep(1, 4); break;
        case 4: if (ctx.world.excavator.grapple > 0.6) this.hold = 1; if (this.hold >= 1 && ctx.world.excavator.grapple < 0.2) this.setStep(1, 5); break;
        case 5: if (this.grabbed) { this.setStep(1, 6); this.driveStart = { x: ctx.world.excavator.pos.x, z: ctx.world.excavator.pos.z }; } break;
        case 6: {
          const p = ctx.world.excavator.pos, d0 = this.driveStart!;
          if (Math.hypot(p.x - d0.x, p.z - d0.z) >= Number(this.t["driveDistanceM"] ?? 3) || this.booked.size > 0) this.setStep(1, 7);
          break;
        }
        case 7: if (this.booked.size >= s.need) this.startLesson(2); break;
      }
    } else if (s.lesson === 2 || s.lesson === 3) {
      if (s.step === 1) {
        if (!this.deliveryId) this.orderDelivery(s.lesson === 2 ? "hallmann" : "baering", s.lesson === 2);
        if (this.dumped) { s.need = Math.max(1, Math.ceil(this.lessonItems.size * Number(this.t[s.lesson === 2 ? "lesson2NeedShare" : "lesson3NeedShare"] ?? 0.8))); this.setStep(s.lesson, 2); }
      } else if (s.step === 2 && this.booked.size >= s.need) {
        if (s.lesson === 2) this.startLesson(3); else this.finish();
      }
    }
  }

  private startLesson(lesson: 2 | 3): void {
    this.lessonItems.clear(); this.booked.clear(); this.wrongIds.clear(); this.deliveryId = null; this.dumped = false;
    this.state.done = 0; this.state.need = 0; this.state.wrong = 0;
    this.setStep(lesson, 1);
  }

  private orderDelivery(customerId: string, sorted: boolean): void {
    const run = this.vehicles.requestDelivery(customerId, sorted);
    if (!run) { this.deliveryId = "none"; return; }
    this.deliveryId = run.delivery.id; for (const l of run.loads) this.lessonItems.add(l.itemId);
  }

  private finish(): void {
    const s = this.state; s.active = false; s.finished = true;
    this.ctx.bus.emit("tutorialStep", { lesson: s.lesson, step: s.step, done: true });
  }

  save(): unknown { return { finished: this.state.finished, started: this.state.active }; }
  load(data: unknown): void {
    const d = data as { finished?: boolean; started?: boolean } | undefined;
    if (d?.finished === true) { this.state.finished = true; this.state.active = false; }
    else if (d?.started === true) this.resetOnBegin = true;
  }
}
