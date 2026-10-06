import type RAPIER from "@dimforge/rapier3d-compat";
import type { EventBus, GameEvents } from "../core/events";

/**
 * DER CHALLENGE-RAHMEN (E-125, 06.10.2026).
 *
 * Patrick: „Mit Challenges soll das Spiel anfangen, damit die Steuerung klar
 * wird." Eine Challenge ist DATEN (`katalog.ts`): was liegt wo, welche
 * Lernschritte, welche Schwellen fuer die Sterne. Hier steht nur, was alle
 * gemeinsam haben — das Beobachten, das Weiterruecken, das Werten.
 *
 * NUR BEOBACHTEN. Nichts hier bewegt einen Koerper, eine Spinne oder ein
 * Pendel (Regel 2). Ein Schritt gilt erst als geschafft, wenn das Spiel ihn
 * gesehen hat — nie nach Zeit.
 *
 * WAS BEOBACHTET WERDEN KANN — heute vier Dinge, und nur so viele, wie
 * Challenge 1 braucht. Die naechste Challenge waehlt aus dieser Liste; wer
 * etwas Neues beobachten will, setzt hier eine Zeile dazu.
 *
 *   wrack_gefasst          das Wrack haengt in der Spinne
 *   wrack_ueber_kammer     es haengt in der Spinne und steht waagerecht ueber
 *                          der Presskammer (Pruefung der Presse selbst)
 *   wrack_in_kammer        losgelassen und in der Kammer — genau das, was die
 *                          Presse beim Stempeln als „drin" zaehlt
 *                          (`inChamber`). Bewusst NICHT „still": Quer
 *                          aufgelegt ruht ein Wrack auf Wandkrone und Klappe
 *                          und schlaeft dort nie ein (gemessen,
 *                          `tools/challenge-ruhe.ts`); die Presse quetscht
 *                          es trotzdem.
 *   wrack_gepresst         die Presse hat zugeschlagen, nachdem sie mit dem
 *                          Wrack in der Kammer gestartet wurde
 */

export type Beobachtung =
  | "wrack_gefasst"
  | "wrack_ueber_kammer"
  | "wrack_in_kammer"
  | "wrack_gepresst";

export interface Lernschritt {
  /** Woran das Spiel erkennt, dass der Schritt geschafft ist */
  beobachtet: Beobachtung;
  titel: string;
  /**
   * Bildschirmtext. Platzhalter fuer die Bedienung — `{schwenken}`,
   * `{hauptarm}`, `{ausleger}`, `{schliessen}`, `{oeffnen}` — setzt die
   * Anzeige aus der Stickbelegung ein (`ui/challengekarte.ts`).
   */
  text: string;
}

/** Was am Ende gemessen vorliegt. `null` = nicht gemessen (kein Zyklus). */
export interface ChallengeMessung {
  /** Spielzeit vom Start bis zum letzten Schritt (s), ohne Pause */
  zeitS: number;
  /** Fahrkunst Ruhe (E-119): Pendelausschlag beim Loslassen (Grad) */
  ruheGrad: number | null;
  /** Fahrkunst Praezision (E-119): Abstand zum Ablageziel im Liegen (cm) */
  praezisionCm: number | null;
}

/** Obergrenzen je Messgroesse. Was fehlt, zaehlt fuer diesen Stern nicht. */
export type Schwellen = Partial<Record<keyof ChallengeMessung, number>>;

/** Ein Stern ist der Boden (geschafft). Zwei und drei verlangen ALLE ihre Schwellen. */
export interface ChallengeWertung {
  zwei: Schwellen;
  drei: Schwellen;
}

export interface ChallengeDaten {
  id: string;
  /** Knopf im Hauptmenue und Kopf des Abschlussbilds */
  name: string;
  /** Kleingedrucktes im Hauptmenue */
  beschreibung: string;
  /** Was auf dem sonst leeren Platz steht */
  aufbau: { wracks: ReadonlyArray<{ x: number; z: number }> };
  /** Ablageziel fuer die Praezision (`Fahrkunst.ziel`); null = keins */
  ablageziel: { x: number; z: number } | null;
  schritte: readonly Lernschritt[];
  wertung: ChallengeWertung;
}

/** Erfuellt die Messung alle diese Schwellen? Ungemessen erfuellt keine. */
export function erfuellt(s: Schwellen, m: ChallengeMessung): boolean {
  return (Object.keys(s) as Array<keyof ChallengeMessung>).every((k) => {
    const v = m[k];
    return v !== null && v <= s[k]!;
  });
}

/** Ein bis drei Sterne — die einzige Stelle, an der sie entstehen. */
export function sterne(w: ChallengeWertung, m: ChallengeMessung): number {
  return erfuellt(w.drei, m) ? 3 : erfuellt(w.zwei, m) ? 2 : 1;
}

/** Was der Lauf von der Welt liest — mehr nicht. */
export interface ChallengeQuellen {
  /** Der Koerper des Wracks der Aufgabe, null wenn es ihn nicht mehr gibt */
  wrack(): RAPIER.RigidBody | null;
  /** Was gerade in der Spinne haengt */
  gegriffen(): readonly RAPIER.RigidBody[];
  /** `PressManager.ueberKammer` */
  ueberKammer(p: { x: number; z: number }): boolean;
  /** `PressManager.inChamber` */
  inKammer(p: { x: number; y: number; z: number }): boolean;
}

export class ChallengeLauf {
  zeitS = 0;
  geschafft = false;
  /** Hoechster beobachteter Schritt (Index), −1 = noch keiner */
  private erreicht = -1;
  private gemeldet = -1;
  private inKammer = false;
  private freigegeben = false;
  private gepresst = false;
  /** Letzter Fahrkunst-Zyklus, der ueber der Kammer zur Ruhe kam */
  private zyklus: GameEvents["fahrkunst:zyklus"] | null = null;

  constructor(
    readonly daten: ChallengeDaten,
    private q: ChallengeQuellen,
    private bus: EventBus
  ) {}

  /** Den ersten Schritt zeigen. */
  start(): void {
    this.melde();
  }

  /** Einmal je Bild, ausserhalb der Pause. */
  takt(dt: number): void {
    if (this.geschafft) return;
    this.zeitS += dt;
    const w = this.q.wrack();
    const p = w?.translation();
    const gefasst = !!w && this.q.gegriffen().some((b) => b.handle === w.handle);
    this.inKammer = !!w && !gefasst && this.q.inKammer(p!);
    const jetzt: Record<Beobachtung, boolean> = {
      wrack_gefasst: gefasst,
      wrack_ueber_kammer: gefasst && this.q.ueberKammer(p!),
      wrack_in_kammer: this.inKammer,
      wrack_gepresst: this.gepresst,
    };
    // Was der Spieler schon richtig macht, wird uebersprungen: Ein spaeterer
    // Schritt, der schon zu sehen ist, nimmt die frueheren mit.
    this.daten.schritte.forEach((s, i) => {
      if (jetzt[s.beobachtet] && i > this.erreicht) this.erreicht = i;
    });
    this.melde();
  }

  /** Fahrkunst-Zyklus vom Bus. Gilt nur, wenn die Ladung ueber der Kammer liegt. */
  zyklusGemessen(e: GameEvents["fahrkunst:zyklus"]): void {
    if (this.q.ueberKammer(e)) this.zyklus = e;
  }

  /**
   * Darf die Presse jetzt laufen? Erst, wenn das Wrack losgelassen in der
   * Kammer ist — eine leere Presse waere kein Lernschritt.
   */
  pressenErlaubt(): boolean {
    if (this.inKammer) this.freigegeben = true;
    return this.inKammer;
  }

  /** `press.onStamp` — zaehlt nur nach einem freigegebenen Start. */
  presseHatGestempelt(): void {
    if (this.freigegeben) this.gepresst = true;
  }

  private melde(): void {
    const n = this.daten.schritte.length;
    const nr = this.erreicht + 1;
    if (nr === this.gemeldet) return;
    this.gemeldet = nr;
    if (nr < n) {
      const s = this.daten.schritte[nr]!;
      this.bus.emit("challenge:schritt", { id: this.daten.id, nr: nr + 1, von: n, titel: s.titel, text: s.text });
      return;
    }
    this.geschafft = true;
    const messung: ChallengeMessung = {
      zeitS: this.zeitS,
      ruheGrad: this.zyklus?.ruheGrad ?? null,
      praezisionCm: this.zyklus?.praezisionCm ?? null,
    };
    this.bus.emit("challenge:geschafft", {
      id: this.daten.id,
      name: this.daten.name,
      sterne: sterne(this.daten.wertung, messung),
      messung,
      wertung: this.daten.wertung,
    });
  }
}
