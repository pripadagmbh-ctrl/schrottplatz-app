import type { ScrapShape } from "../world/scrapItems";
import { normalizeMaterialId } from "../materials/catalog";
import { STANDARD_SENDER } from "../audio/songs";

/**
 * Spielstand M3 (Briefing Kap. 18): JSON mit Schema-Version + Migrationspfad.
 * Strategie: Laden = Seite bootet aus dem Save statt aus den Defaults —
 * kein Welt-Teardown zur Laufzeit nötig.
 */

export interface SavedItem {
  materialId: string;
  massKg: number;
  shape: ScrapShape;
  pos: number[]; // [x,y,z]
  rot: number[]; // [x,y,z,w]
}

export interface SavedCar {
  pos: number[];
  rot: number[];
  crushStage: number;
  torn: string[];
  brokenWindows: string[];
}

/** Was das Kabinenradio sich merkt. */
export interface RadioState {
  /** Kennung des Senders aus `audio/songs.ts` */
  songId: string;
}

export interface SaveData {
  schemaVersion: 2;
  savedAt: string;
  moneyEur: number;
  /** Betriebszahlen — fehlen in alten Ständen, dann wird bei null begonnen */
  shift?: { t: number; turnoverKg: number; pickups: number; deliveries: number };
  /** Tageszeit 0..1 (0,25 = Sonnenaufgang) */
  timeOfDay?: number;
  /** Wie weit der geführte Einstieg ist */
  tutorial?: { index?: number; finished?: boolean };
  /** Ruf bei den drei Kundengruppen */
  reputation?: { privat?: number; haendler?: number; gewerbe?: number };
  /** Gekaufte Ausbaustufen */
  upgrades?: string[];
  /** Gewaehlter Radiosender (ab Schema 2) */
  radio?: RadioState;
  items: SavedItem[];
  cars: SavedCar[];
  fencesBroken: boolean[];
}

export const SAVE_KEY = "schrottplatz_save";
export const CURRENT_SCHEMA = 2;

/**
 * Rohdaten validieren und auf das aktuelle Schema migrieren.
 * Liefert null bei unbrauchbaren Daten (dann: neues Spiel).
 */
export function migrate(raw: unknown): SaveData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.schemaVersion !== "number" || d.schemaVersion < 1 || d.schemaVersion > CURRENT_SCHEMA) {
    return null;
  }
  if (
    typeof d.moneyEur !== "number" ||
    !Array.isArray(d.items) ||
    !Array.isArray(d.cars) ||
    !Array.isArray(d.fencesBroken)
  ) {
    return null;
  }
  // Fraktionen aus älteren Ständen umschlüsseln (Guss → Stahlschrott usw.)
  for (const it of d.items as SavedItem[]) {
    it.materialId = normalizeMaterialId(it.materialId);
  }
  /*
   * v1 → v2 (14.09.2026): Das Kabinenradio hat mehrere Sender bekommen und
   * merkt sich, welcher läuft. Alte Stände kannten nur ein Stück — sie
   * bekommen den Standardsender, also die Schlagermelodie. Bewusst nicht der
   * Bluesrock, der zuletzt lief: Standard ist ab jetzt der Schlager (Ansage
   * Patrick, 14.09.2026), und ein alter Stand soll sich anhören wie ein neuer.
   */
  if (d.schemaVersion === 1) {
    d.schemaVersion = 2;
    d.radio = { songId: STANDARD_SENDER };
  }
  // Ein unbekannter Sender (Stand aus einer neueren Fassung, Tippfehler von
  // Hand) darf nicht ins Leere greifen — dann eben der Standard.
  const r = d.radio as Record<string, unknown> | undefined;
  if (!r || typeof r.songId !== "string") d.radio = { songId: STANDARD_SENDER };
  return d as unknown as SaveData;
}

/**
 * Die Senderwahl im vorhandenen Stand nachtragen, ohne sonst etwas anzufassen.
 *
 * Zweiter Speicherort wäre der falsche Weg: Es gibt genau einen Spielstand mit
 * genau einem Schema. Existiert noch keiner, wird auch keiner angelegt — die
 * Wahl steht dann im Arbeitsspeicher und wandert beim nächsten Speichern mit.
 * Liefert true, wenn sie auf der Platte gelandet ist.
 */
export function speichereRadio(radio: RadioState): boolean {
  const d = readSave();
  if (!d) return false;
  d.radio = radio;
  return storeSave(d);
}

export function storeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* egal */
  }
}
