import type { Tagesbilanz } from "../economy/shift";

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
  /**
   * Der Greifer wurde im Pausenmenue gewechselt (E-059).
   *
   * `greifer` ist die Kennung, die auch im Spielstand steht („sichel" oder
   * „fuenfschalen"), `name` der Klartext fuers HUD. Ton und Anzeige haengen
   * nur hier dran, nicht an der Maschine (Projektregel 10).
   */
  "greifer:gewechselt": { greifer: string; name: string };
  /**
   * Die Spinne hat mit Druck auf etwas zugedrueckt (E-112, 22.09.2026).
   *
   * Gemeldet wird EIN Biss je Koerper: `handle` ist der Rapier-Handle des
   * Getroffenen (vor dem Zugriff `isValid()` pruefen, E-103), `kraftKN` die
   * Schliesskraft in Kilonewton zum Zeitpunkt des Bisses, `x/y/z` der Ort des
   * Koerpers — dieselbe Form wie bei `crushed`.
   *
   * `kraftKN` ist abgestuft, keine Ja/Nein-Meldung: Wer haerter und laenger
   * zudrueckt, meldet mehr. Was mit dem Koerper passiert, entscheidet der
   * Zuhoerer; der Greifer sagt nur, wie hart er gedrueckt hat. Kein Wertabzug
   * haengt daran (Ansage Patrick 22.09.2026: „kaputt machen verliert keinen
   * wert").
   */
  "greifer:zugedrueckt": { handle: number; kraftKN: number; x: number; y: number; z: number };
  /**
   * Torschluss — es kommt keine Fuhre mehr herein (E-113, 22.09.2026).
   *
   * Eine Stunde vor Feierabend (`TORSCHLUSS_TIME` in `economy/shift.ts`). Das
   * ist der Anlass, an dem der Verkehr ausläuft; Mario sagt es durchs Funk,
   * die Tagesablaufzeile schreibt es hin. Payload leer: Wer mehr wissen will,
   * fragt `shift`.
   */
  "tag:torschluss": Record<string, never>;
  /**
   * Feierabend — der Arbeitstag ist zu Ende, hier ist die Abrechnung (E-113).
   *
   * Kommt genau einmal je Tag, zur Zeit `FEIERABEND_TIME`. Die Zahlen sind
   * fertig gerechnet (`shift.bilanz()`); Anzeige und Ton lesen sie nur ab und
   * rechnen nichts nach — die Sortierquote hat eine Quelle, und das ist
   * `economy/shift.ts`.
   */
  "tag:feierabend": Tagesbilanz;
  /**
   * Der nächste Tag beginnt (E-113).
   *
   * Nach der Abrechnung: Tageszähler auf null, Uhr auf den frühen Morgen, der
   * Kontostand bleibt. Wer etwas je Tag zurücksetzt, hängt sich hier an.
   */
  "tag:neu": { tag: number };
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
