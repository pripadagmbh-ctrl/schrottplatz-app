import type { ScrapShape } from "../world/scrapItems";
import { normalizeMaterialId } from "../materials/catalog";

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

export interface SaveData {
  schemaVersion: 1;
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
  items: SavedItem[];
  cars: SavedCar[];
  fencesBroken: boolean[];
}

export const SAVE_KEY = "schrottplatz_save";
export const CURRENT_SCHEMA = 1;

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
  // Ab Version 2 hängen hier Migrationsschritte v1→v2→…
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
  return d as unknown as SaveData;
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
