import type { System, SimContext } from "./System";
import type { CompositeSystem } from "./CompositeSystem";
import type { ScrapSystem } from "./ScrapSystem";
import type { GripSystem } from "./GripSystem";
import type { ItemId } from "@/shared/ids";
import type { Level } from "@/sim/world/Level";
import { RAPIER } from "@/sim/world/PhysicsWorld";
import { COLLISION } from "@/sim/world/collisionGroups";
import { clamp } from "@/shared/math";

/**
 * Paketierpresse (M5b) — Bauart und Ablauf nach dem Prototyp (`prototype/src/world/press.ts`, Design 29.08./02.09.2026),
 * weil die erste v2-Fassung (Stempel von oben, nur für Wracks) am Kern vorbeiging: Die Presse ist in erster Linie eine
 * MULDE, in die man losen Schrott mit der Spinne einfüllt.
 *
 * Zyklus: Deckelklappen schließen von beiden Längsseiten → Stempel fährt längs durch die Mulde und presst gegen die
 * linke Stirnwand → hält → fährt zurück → Klappen auf. Auf halbem Stempelweg wird „zugeschlagen": alles in der Kammer
 * wird zu EINEM Paket.
 *
 * Klemmschutz (Prototyp Kap. 6): Klappen und Stempel sind kinematisch und halten VOR dem Material an — die Klappen
 * über der Materialoberkante, der Stempel bei einer Enddicke, die mit der Menge wächst. Nichts wird gegen eine Wand
 * zerquetscht; das Plattdrücken selbst ist ein Zustandswechsel der Teile, keine echte Verformung.
 *
 * Wracks: Hängt noch eine Baugruppe mit `blocksPress` dran (Batterie, Motor), verweigert die Presse den Start und
 * sagt, was im Weg ist (Briefing Kap. 8.3).
 */
export type PressPhase = "idle" | "lidsClose" | "ramFwd" | "hold" | "ramBack" | "lidsOpen";

export interface PressStatus {
  phase: PressPhase;
  running: boolean;
  /** Anzahl loser Teile in der Kammer */
  items: number;
  /** Wracks in der Kammer */
  wrecks: number;
  /** Auslösen möglich */
  ready: boolean;
  /** Baugruppen, die das Pressen verhindern */
  blockedBy: string[];
  /** Klappenwinkel (rad, groß = offen) und Stempelposition (lokal, x) für die Anzeige */
  lidAngle: number;
  ramX: number;
}

export class PressSystem implements System {
  readonly name = "press";
  readonly phase = "preStep" as const;
  readonly order = 16; // vor den Verbundteilen: die Werkzeuge stehen, bevor gegriffen wird

  private ctx!: SimContext;
  private composites!: CompositeSystem;
  private scrap!: ScrapSystem;
  private grip!: GripSystem;

  // Maße (aus data/balancing.json)
  private innerW = 6; private innerD = 2.8; private wallH = 1.9; private plateT = 0.3;
  private lidOpen = 2.65; private lidTime = 1.6; private ramFwdTime = 3; private ramHoldTime = 0.9; private ramBackTime = 2;
  private baleBase = 0.4; private balePerItem = 0.14; private balePerCar = 1.4;
  private baleHalf: [number, number, number] = [0.75, 0.42, 0.6];
  private cx = 0; private cz = 0;

  private ph: PressPhase = "idle";
  private t = 0;
  private lidAngle = 2.65;
  private ramX = 0; private ramHome = 0; private ramTarget = 0; private ramBackFrom = 0;
  private stamped = false;

  private lidBodies: RAPIER.RigidBody[] = [];
  private ramBody!: RAPIER.RigidBody;

  constructor(private readonly level: Level) {}

  init(ctx: SimContext): void {
    this.ctx = ctx;
    this.composites = ctx.get<CompositeSystem>("composites");
    this.scrap = ctx.get<ScrapSystem>("scrap");
    this.grip = ctx.get<GripSystem>("grip");
    const p = ctx.data.balancing.press;
    const n = (k: string, d: number) => Number(p[k] ?? d);
    this.innerW = n("innerW", 6); this.innerD = n("innerD", 2.8); this.wallH = n("wallH", 1.9); this.plateT = n("plateT", 0.3);
    this.lidOpen = n("lidOpenAngle", 2.65); this.lidTime = n("lidTimeS", 1.6);
    this.ramFwdTime = n("ramFwdTimeS", 3); this.ramHoldTime = n("ramHoldTimeS", 0.9); this.ramBackTime = n("ramBackTimeS", 2);
    this.baleBase = n("baleThicknessBase", 0.4); this.balePerItem = n("baleThicknessPerItem", 0.14); this.balePerCar = n("baleThicknessPerCar", 1.4);
    const bh = p["baleHalf"] as number[]; this.baleHalf = [bh[0]!, bh[1]!, bh[2]!];
    const z = this.level.zone("press"); this.cx = z.x; this.cz = z.z;
    this.lidAngle = this.lidOpen;
    this.ramHome = this.innerW / 2 - 0.35; this.ramX = this.ramHome; this.ramTarget = this.ramHome;
    this.build(ctx); // Startpose steckt schon in build() — kein sync() noetig, das wuerde nur einen Sprung erzeugen
  }

  /** Mulde als feste Wände, Klappen und Stempel als kinematische Körper (wie der Prototyp). */
  private build(ctx: SimContext): void {
    const w = ctx.physics.world;
    const fixed = w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(this.cx, 0, this.cz));
    const iw = this.innerW, id = this.innerD, h = this.wallH, t = 0.35;
    w.createCollider(RAPIER.ColliderDesc.cuboid((iw + 0.7) / 2, 0.15, (id + 0.7) / 2).setTranslation(0, 0.15, 0).setCollisionGroups(COLLISION.static), fixed);
    const walls: [number, number, number, number][] = [
      [0, -(id / 2 + t / 2), iw + 0.7, t],
      [0, id / 2 + t / 2, iw + 0.7, t],
      [-(iw / 2 + t / 2), 0, t, id],
      [iw / 2 + t / 2, 0, t, id],
    ];
    for (const [x, z, sx, sz] of walls) {
      w.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, h / 2, sz / 2).setTranslation(x, h / 2 + 0.3, z).setCollisionGroups(COLLISION.static), fixed);
    }
    // Klappen und Stempel gleich an ihrer Startpose erzeugen. Wer sie am Weltursprung anlegt und erst per
    // setNextKinematicTranslation versetzt, erzeugt einen Sprung ueber den halben Platz — Rapier leitet daraus eine
    // Geschwindigkeit von ueber 2000 m/s ab und schleudert jedes Teil weg, das auf der Strecke liegt
    // (Messung 09.09.: zwei Teile mit 80 m/s ins Nichts, Vorsimulation lief nie zur Ruhe).
    const lidReach = id / 2 + 0.14, lidLen = iw + 0.25;
    const hingeY0 = h - 0.1 + 0.3, sa0 = Math.sin(this.lidAngle), ca0 = Math.cos(this.lidAngle);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const th = side * this.lidAngle;
      const b = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(this.cx, hingeY0 + (lidReach / 2) * sa0, this.cz + side * (id / 2 + 0.12) - side * (lidReach / 2) * ca0)
        .setRotation({ x: Math.sin(th / 2), y: 0, z: 0, w: Math.cos(th / 2) }));
      w.createCollider(RAPIER.ColliderDesc.cuboid(lidLen / 2, this.plateT / 2, lidReach / 2).setCollisionGroups(COLLISION.excavator), b);
      this.lidBodies.push(b);
    }
    this.ramBody = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.cx + this.ramX, h / 2 + 0.3, this.cz));
    w.createCollider(RAPIER.ColliderDesc.cuboid((this.plateT * 1.4) / 2, (h - 0.1) / 2, (id - 0.1) / 2).setCollisionGroups(COLLISION.excavator), this.ramBody);
  }

  /** Liegt der Punkt in der Muldenkammer? */
  private inChamber(p: { x: number; y: number; z: number }): boolean {
    return Math.abs(p.x - this.cx) < this.innerW / 2 + 0.2 && Math.abs(p.z - this.cz) < this.innerD / 2 + 0.2 && p.y < this.wallH + 1.0;
  }

  /** Oberkante des Materials — bis knapp darüber drücken die Klappen. */
  private pileTop(): number {
    let top = 0.3;
    for (const it of this.ctx.world.items.values()) {
      if (it.state !== "loose" || !this.inChamber(it.pos)) continue;
      top = Math.max(top, it.pos.y + (this.isHull(it.id) ? 0.75 : 0.3));
    }
    return top;
  }
  private isHull(id: ItemId): boolean {
    for (const st of this.ctx.world.composites.values()) if (st.hullItemId === id) return true;
    return false;
  }

  private contents(): { items: ItemId[]; wrecks: string[] } {
    const items: ItemId[] = []; const wrecks: string[] = [];
    for (const st of this.ctx.world.composites.values()) {
      const hull = this.composites.hullItem(st);
      if (hull && hull.state === "loose" && this.inChamber(hull.pos)) wrecks.push(st.id);
    }
    for (const it of this.ctx.world.items.values()) {
      if (it.state !== "loose" || !this.inChamber(it.pos) || this.isHull(it.id)) continue;
      items.push(it.id);
    }
    return { items, wrecks };
  }

  status(): PressStatus {
    const c = this.contents();
    const blockedBy: string[] = [];
    for (const id of c.wrecks) {
      const st = this.ctx.world.composites.get(id as never);
      if (st) blockedBy.push(...this.composites.blocksPress(st));
    }
    const running = this.ph !== "idle";
    return {
      phase: this.ph, running, items: c.items.length, wrecks: c.wrecks.length,
      ready: !running && blockedBy.length === 0 && c.items.length + c.wrecks.length > 0,
      blockedBy: [...new Set(blockedBy)], lidAngle: this.lidAngle, ramX: this.ramX,
    };
  }

  /** Vom Menü gerufen. */
  trigger(): boolean {
    const s = this.status();
    if (s.running) return false;
    if (s.blockedBy.length) { this.ctx.bus.emit("pressDenied", { reason: "blocked", blockedBy: s.blockedBy }); return false; }
    if (s.items + s.wrecks === 0) { this.ctx.bus.emit("pressDenied", { reason: "empty", blockedBy: [] }); return false; }
    this.ph = "lidsClose"; this.t = 0; this.stamped = false;
    this.ctx.bus.emit("pressStarted", { items: s.items, wrecks: s.wrecks });
    return true;
  }

  /** Kleinster Klappenwinkel, bei dem die Platte noch nicht ins Material drückt. */
  private lidLimit(): number {
    const need = this.pileTop() + 0.08 - (this.wallH - 0.1 + 0.3);
    if (need <= 0) return 0;
    return Math.min(this.lidOpen, Math.asin(Math.min(need / (this.innerD / 2), 1)));
  }

  /** Enddicke des Pakets wächst mit der Menge — es wird nie mehr hineingedrückt, als hineinpasst. */
  private computeRamTarget(): number {
    const c = this.contents();
    const thickness = this.baleBase + this.balePerItem * c.items.length + this.balePerCar * c.wrecks.length;
    return clamp(-this.innerW / 2 + thickness, -this.innerW / 2 + 1.1, this.ramHome - 0.4);
  }

  update(ctx: SimContext, dt: number): void {
    // Im Leerlauf werden die kinematischen Koerper NICHT neu gesetzt: ein jeden Schritt neu gesetzter kinematischer
    // Koerper gilt fuer Rapier als bewegt und haelt die Kontakte ringsum wach — der Haufen kam dadurch nie zur Ruhe
    // (Messung 09.09.: settle() lief in die Obergrenze von 600 Schritten, 4 Koerper blieben wach).
    if (this.ph === "idle") return;
    this.t += dt;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    switch (this.ph) {
      case "lidsClose": {
        const k = Math.min(this.t / this.lidTime, 1);
        this.lidAngle = lerp(this.lidOpen, this.lidLimit(), k);
        if (k >= 1) { this.ph = "ramFwd"; this.t = 0; this.stamped = false; this.ramTarget = this.computeRamTarget(); ctx.bus.emit("pressLidsClosed", {}); }
        break;
      }
      case "ramFwd": {
        const k = Math.min(this.t / this.ramFwdTime, 1);
        this.ramX = lerp(this.ramHome, this.ramTarget, k);
        if (k >= 0.5 && !this.stamped) { this.stamped = true; this.stamp(); } // auf halbem Weg zuschlagen
        if (k >= 1) { this.ph = "hold"; this.t = 0; }
        break;
      }
      case "hold":
        if (this.t >= this.ramHoldTime) { this.ph = "ramBack"; this.ramBackFrom = this.ramX; this.t = 0; }
        break;
      case "ramBack": {
        const k = Math.min(this.t / this.ramBackTime, 1);
        this.ramX = lerp(this.ramBackFrom, this.ramHome, k);
        if (k >= 1) { this.ph = "lidsOpen"; this.t = 0; }
        break;
      }
      case "lidsOpen": {
        const k = Math.min(this.t / this.lidTime, 1);
        this.lidAngle = lerp(this.lidLimit(), this.lidOpen, k);
        if (k >= 1) { this.ph = "idle"; this.lidAngle = this.lidOpen; }
        break;
      }
    }
    this.sync();
  }

  /**
   * Zuschlagen: Alles in der Kammer wird zu EINEM Paket — die Presse sortiert nicht. Wer gemischt einfüllt, bekommt
   * ein Paket aus der schwersten Fraktion; der Rest geht als Masse mit ein, ohne eigenen Preis (Prototyp-Regel
   * „sortenrein einlegen lohnt"). Wracks werden mitgepresst.
   */
  private stamp(): void {
    const ctx = this.ctx;
    const c = this.contents();
    if (c.items.length + c.wrecks.length === 0) return;

    const anteile = new Map<string, number>();
    let kg = 0;
    const entfernen: ItemId[] = [];
    for (const id of c.items) {
      const it = ctx.world.items.get(id); if (!it) continue;
      anteile.set(it.materialId, (anteile.get(it.materialId) ?? 0) + it.massKg);
      kg += it.massKg; entfernen.push(id);
    }
    const verpressteWracks: string[] = [];
    for (const cid of c.wrecks) {
      const st = ctx.world.composites.get(cid as never); if (!st) continue;
      const def = this.composites.def(st.defId)!;
      verpressteWracks.push(st.defId);
      const m = def.hull.massKg + this.composites.remaining(st).reduce((s, p) => s + p.massKg, 0);
      anteile.set(def.hull.materialId, (anteile.get(def.hull.materialId) ?? 0) + m);
      kg += m;
      const hull = this.composites.hullItem(st);
      if (hull) entfernen.push(hull.id);
      ctx.world.composites.delete(st.id);
    }
    if (kg <= 0) return;

    let dominant = "steel", best = -1;
    for (const [mat, m] of anteile) if (m > best) { best = m; dominant = mat; }

    for (const id of entfernen) {
      const it = ctx.world.items.get(id); if (!it) continue;
      if (this.grip.heldIds.includes(id)) continue; // was die Spinne hält, bleibt heil
      if (it.bodyHandle !== undefined) ctx.physics.requestRemove(it.bodyHandle);
      ctx.world.items.delete(id);
    }

    const shape = this.scrap.shape("block");
    const pos = { x: this.cx - this.innerW / 2 + 1.2, y: this.baleHalf[1] + 0.35, z: this.cz };
    const size: [number, number, number] = [this.baleHalf[0] * 2, this.baleHalf[1] * 2, this.baleHalf[2] * 2];
    const bale = shape ? this.scrap.spawnExact(dominant, shape, size, pos, { x: 0, y: 0, z: 0, w: 1 }, { massKg: kg }) : null;
    if (bale) bale.origin = "torn";

    const rein = (anteile.get(dominant) ?? 0) / kg;
    ctx.bus.emit("pressDone", {
      itemId: (bale?.id ?? "") as ItemId,
      kg,
      purity: rein,
      compositeDefIds: verpressteWracks,
    });
    ctx.bus.emit("toast", {
      text: rein > 0.95 ? `Paket gepresst · ${Math.round(kg)} kg sortenrein` : `Paket gepresst · ${Math.round(kg)} kg gemischt (${Math.round(rein * 100)} % ${dominant})`,
      kind: rein > 0.95 ? "good" : "info",
    });
  }

  /**
   * Klappen- und Stempelpose auf die kinematischen Körper übertragen. Die Platte hängt am Scharnier auf der
   * Längsseite und ragt zur Muldenmitte; gedreht wird um die Längsachse (X), Süd- und Nordklappe gegenläufig.
   */
  private sync(): void {
    const id = this.innerD, hingeY = this.wallH - 0.1 + 0.3, reach = id / 2 + 0.14;
    const sa = Math.sin(this.lidAngle), ca = Math.cos(this.lidAngle);
    for (let i = 0; i < this.lidBodies.length; i++) {
      const side = i === 0 ? -1 : 1;
      const th = side * this.lidAngle;
      this.lidBodies[i]!.setNextKinematicTranslation({
        x: this.cx,
        y: hingeY + (reach / 2) * sa,
        z: this.cz + side * (id / 2 + 0.12) - side * (reach / 2) * ca,
      });
      this.lidBodies[i]!.setNextKinematicRotation({ x: Math.sin(th / 2), y: 0, z: 0, w: Math.cos(th / 2) });
    }
    this.ramBody.setNextKinematicTranslation({ x: this.cx + this.ramX, y: this.wallH / 2 + 0.3, z: this.cz });
  }

  save(): unknown { return this.ph === "idle" ? null : { ph: this.ph, t: this.t }; }
  load(data: unknown): void {
    const d = data as { ph?: PressPhase; t?: number } | null;
    if (d && typeof d.ph === "string") { this.ph = d.ph; this.t = Number(d.t) || 0; }
    else { this.ph = "idle"; this.t = 0; this.lidAngle = this.lidOpen; this.ramX = this.ramHome; }
    this.sync();
  }
}
