/**
 * Typisierter Event-Bus (Briefing Kap. 17): Module kommunizieren nur über Events,
 * kein Modul greift in ein anderes hinein.
 */
export interface GameEvents {
  /** Ein Item ist in einen Container gefallen (per Zonen-Zählung erkannt) */
  itemEntered: { itemId: string; materialId: string; containerId: string; correct: boolean };
  /** Ein Item wurde aus einem Container entfernt (Nachsortieren) */
  itemLeft: { itemId: string; containerId: string };
  /** Greifer hat zugepackt */
  grabbed: { count: number; massKg: number };
  /** Greifer hat losgelassen */
  released: { count: number };
  /** Eine Scheibe ist geborsten (Position für Partikel/Sound) */
  glassShattered: { x: number; y: number; z: number };
  /** Karosse hat eine Quetschstufe genommen */
  crushed: { stage: number; x: number; y: number; z: number };
  /** Baugruppe wurde abgerissen */
  partTorn: { name: string };
  /** Zaunfeld aus der Verankerung gerissen/gefahren */
  fenceBroken: { x: number; y: number; z: number };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Handler<keyof GameEvents>[]>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as Handler<keyof GameEvents>);
    this.handlers.set(event, list);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    for (const h of this.handlers.get(event) ?? []) {
      (h as Handler<K>)(payload);
    }
  }
}
