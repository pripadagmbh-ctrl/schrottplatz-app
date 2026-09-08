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
  containerSold: { containerId: ContainerId; kg: number; purity: number; eur: number };
  vehicleArrived: { deliveryId: DeliveryId };
  vehicleWeighed: { deliveryId: DeliveryId; grossKg: number };
  vehicleDumped: { deliveryId: DeliveryId; itemCount: number };
  vehicleLeft: { deliveryId: DeliveryId; secondsOnSite: number };
  dayPhaseChanged: { day: number; phase: "morning" | "work" | "evening" | "ended" };
  missionCompleted: { missionId: string; bonusEur: number };
  moneyChanged: { deltaEur: number; totalEur: number; reason: string };
  pressUsed: { compositeId: CompositeId; crushStage: number };
  upgradeBought: { upgradeId: string };
  saveRequested: { reason: "day" | "hidden" | "manual" | "interval" };
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
