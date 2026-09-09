import type { ItemId, ContainerId, CompositeId, DeliveryId } from "./ids";

/**
 * Alle Spiel-Ereignisse mit ihren Nutzdaten (Briefing Kap. 17.2, Architektur Kap. 13).
 * Sender wissen nicht, wer zuhört. Neue Events werden hier eingetragen — nirgends sonst.
 */
export interface GameEvents {
  itemGrabbed: { itemId: ItemId; kg: number };
  itemReleased: { itemId: ItemId; kg: number };
  itemSorted: { itemId: ItemId; containerId: ContainerId; correct: boolean; kg: number };
  itemRemoving: { itemId: ItemId; reason: "press" | "sold" | "bundled" | "cleanup" };
  partTorn: { compositeId: CompositeId; partId: string; itemId: ItemId; kg: number };
  pressStarted: { items: number; wrecks: number };
  pressLidsClosed: Record<string, never>;
  /**
   * `compositeDefIds` nennt die Bauarten der mitverpressten Wracks (leer, wenn
   * nur loser Schrott drin war). Ohne diese Angabe könnte der Auftrag
   * „Auto pressen" auch von einem Blechpaket erfüllt werden.
   */
  pressDone: { itemId: ItemId; kg: number; purity: number; compositeDefIds: string[] };
  pressDenied: { reason: "empty" | "blocked"; blockedBy: string[] };
  containerSold: { containerId: ContainerId; kg: number; purity: number; eur: number };
  vehicleArrived: { deliveryId: DeliveryId };
  vehicleWeighed: { deliveryId: DeliveryId; grossKg: number };
  vehicleDumped: { deliveryId: DeliveryId; itemCount: number };
  vehicleLeft: { deliveryId: DeliveryId; secondsOnSite: number };
  dayPhaseChanged: { day: number; phase: "morning" | "work" | "evening" | "ended" };
  missionCompleted: { missionId: string; bonusEur: number };
  moneyChanged: { deltaEur: number; totalEur: number; reason: string };
  sortPointsChanged: { delta: number; total: number; itemId: ItemId; correct: boolean };
  pickupOrdered: { containerId: ContainerId };
  toast: { text: string; kind: "info" | "good" | "bad" };
  pressUsed: { compositeId: CompositeId; crushStage: number };
  upgradeBought: { upgradeId: string; priceEur: number; stage: number };
  saveRequested: { reason: "day" | "hidden" | "manual" | "interval" };
  /** M4b */
  missionsRolled: { day: number; missionIds: string[] };
  tutorialStep: { lesson: number; step: number; done: boolean };
  dayEnded: { day: number; bankrupt: boolean; campaignDone: boolean };
}
export type EventName = keyof GameEvents;
export type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

/**
 * Minimaler typisierter EventBus. `emit` liefert sofort aus (synchron), damit Reihenfolge
 * innerhalb eines Schritts vorhersehbar bleibt. Für Ansichten gibt es `drain()`-Queues nicht:
 * view/ui hören direkt zu und lesen den Snapshot beim nächsten Bild.
 */
export class EventBus {
  private handlers = new Map<EventName, Set<Handler<EventName>>>();
  private counts = new Map<EventName, number>();

  on<K extends EventName>(name: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) { set = new Set(); this.handlers.set(name, set); }
    set.add(fn as Handler<EventName>);
    return () => this.off(name, fn);
  }
  once<K extends EventName>(name: K, fn: Handler<K>): () => void {
    const off = this.on(name, (p) => { off(); fn(p); });
    return off;
  }
  off<K extends EventName>(name: K, fn: Handler<K>): void {
    this.handlers.get(name)?.delete(fn as Handler<EventName>);
  }
  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<K>)(payload);
  }
  /** Zählstatistik fürs Debug-Overlay und für Tests („wurde itemSorted genau 5× gefeuert?"). */
  count(name: EventName): number { return this.counts.get(name) ?? 0; }
  clear(): void { this.handlers.clear(); this.counts.clear(); }
}
