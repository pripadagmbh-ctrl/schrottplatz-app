import type { System, SimContext } from "./System";
import type { UpgradeDef } from "@/data/types";

/**
 * Ausbau des Platzes (Briefing Kap. 10.4, Roadmap 3.6).
 *
 * Verdientes Geld bekommt eine Verwendung: Wer genug Sterne gesammelt hat und
 * das Geld aufbringt, baut das Wiegehäuschen zum Büro aus, später mit Halle.
 * Bezahlt wird mit **beidem** — Sterne belegen, dass man den Betrieb im Griff
 * hat, Geld allein reicht nicht.
 *
 * Die Wirkungen stehen als benannte Modifikatoren in `upgrades.json` und
 * werden hier gebündelt abgefragt. Der Grund für dieses System: Im Prototyp
 * lagen Kaufliste und Wirkung getrennt, und drei von acht Stufen bewirkten
 * am Ende nichts — sie wurden verkauft, ohne dass irgendwo jemand nachsah
 * (Prüfbericht 03.09.2026). Deshalb liest hier alles durch **eine** Stelle,
 * und ein Test prüft, dass jede in den Daten genannte Wirkung auch gelesen
 * wird.
 */
export type BuyResult = "gekauft" | "schonVorhanden" | "zuWenigSterne" | "zuWenigGeld" | "vorstufeFehlt" | "unbekannt";

export class UpgradeSystem implements System {
  readonly name = "upgrades";
  readonly phase = "slow" as const;
  readonly order = 90;
  readonly every = 30;

  private ctx!: SimContext;

  init(ctx: SimContext): void {
    this.ctx = ctx;
  }

  /** Nichts zu tun je Schritt — der Ausbau ändert sich nur beim Kauf. */
  update(): void {}

  private get gekaufte(): string[] {
    return this.ctx.world.economy.upgrades;
  }

  /** Alle Stufen, die im MVP angeboten werden. */
  angebot(): UpgradeDef[] {
    return this.ctx.data.upgrades.upgrades.filter((u) => u.tier === "MVP");
  }

  def(id: string): UpgradeDef | undefined {
    return this.ctx.data.upgrades.upgrades.find((u) => u.id === id);
  }

  has(id: string): boolean {
    return this.gekaufte.includes(id);
  }

  /** Warum ein Kauf (nicht) geht — dieselbe Prüfung, die `buy` benutzt. */
  pruefe(id: string): BuyResult {
    const d = this.def(id);
    if (!d) return "unbekannt";
    if (this.has(id)) return "schonVorhanden";
    if (d.requires && !this.has(d.requires)) return "vorstufeFehlt";
    const e = this.ctx.world.economy;
    if (e.starsTotal < d.requiresStars) return "zuWenigSterne";
    if (e.moneyEur < d.priceEur) return "zuWenigGeld";
    return "gekauft";
  }

  /** Kaufen. Bucht nur ab, wenn wirklich alles stimmt. */
  buy(id: string): BuyResult {
    const urteil = this.pruefe(id);
    if (urteil !== "gekauft") return urteil;
    const d = this.def(id)!;
    this.ctx.world.economy.moneyEur -= d.priceEur;
    this.gekaufte.push(id);
    this.ctx.bus.emit("upgradeBought", { upgradeId: id, priceEur: d.priceEur, stage: d.stage ?? 0 });
    return "gekauft";
  }

  // --- Wirkungen. Jede Abfrage hier, nirgends verstreut. ---

  /** Höchste erreichte Ausbaustufe: 1 = Wiegehäuschen, 2 = Büro, 3 = Halle. */
  get stage(): number {
    let s = 1;
    for (const id of this.gekaufte) {
      const d = this.def(id);
      if (d?.kind === "stage" && d.stage && d.stage > s) s = d.stage;
    }
    return s;
  }

  /** Erster Wert aus den gekauften Stufen, sonst `fallback`. */
  private zahl(key: string, fallback: number): number {
    let out = fallback;
    for (const id of this.gekaufte) {
      const v = this.def(id)?.effects?.[key];
      if (typeof v === "number") out = v;
    }
    return out;
  }

  private flagge(key: string): boolean {
    return this.gekaufte.some((id) => this.def(id)?.effects?.[key] === true);
  }

  /** Mit Büro sieht man einer gemischten Ladung an, was drinsteckt. */
  get showComposition(): boolean {
    return this.flagge("showComposition");
  }
  /** Wie viele Abholer gleichzeitig auf dem Platz sein dürfen. */
  get pickupsParallel(): number {
    return this.zahl("pickupsParallel", 1);
  }
  /** Fuhren je Tag, sobald ausgebaut ist — sonst entscheidet der Tagesplan. */
  get deliveriesPerDayOverride(): number | null {
    const v = this.zahl("deliveriesPerDay", -1);
    return v > 0 ? v : null;
  }
  /** Schnellere Hydraulik (Halle). */
  get speedFactor(): number {
    return this.zahl("speedFactor", 1);
  }
  /** Mehr Traglast der Spinne (Halle). */
  get capacityFactor(): number {
    return this.zahl("capacityFactor", 1);
  }
  /** Größere Presse. */
  get pressCapacityFactor(): number {
    return this.zahl("pressCapacityFactor", 1);
  }
  /** Radlader für den Platzwart. */
  get staffLoader(): boolean {
    return this.flagge("staffLoader");
  }
  /** Anbaugerät vorhanden? (`shear`, `magnet`) */
  hasTool(tool: string): boolean {
    return this.gekaufte.some((id) => this.def(id)?.effects?.["tool"] === tool);
  }

  // Der Bestand liegt in `economy.upgrades` und wird dort mitgespeichert;
  // ein eigenes save() würde ihn doppelt führen.
}
