/**
 * Frei belegbare Steuerung (Briefing Kap. 5.1).
 *
 * Jede der vier Stickachsen bekommt eine Funktion zugewiesen und lässt sich
 * einzeln umkehren. Wer lieber wie im echten Bagger fährt, stellt sich das
 * hier um; die Einstellung bleibt im Browser gespeichert.
 */
export type ControlFunction = "boom" | "stick" | "cab" | "grapple" | "rotator" | "none";

export type AxisId = "leftY" | "leftX" | "rightY" | "rightX";

export interface AxisBinding {
  fn: ControlFunction;
  /** true kehrt die Richtung um */
  invert: boolean;
}

export type ControlConfig = Record<AxisId, AxisBinding>;

/** Klartext für das Menü. */
export const FUNCTION_LABELS: Record<ControlFunction, string> = {
  boom: "Hauptarm heben/senken",
  stick: "Ausleger heran/weg",
  cab: "Oberwagen drehen",
  grapple: "Spinne öffnen/schließen",
  rotator: "Spinne drehen",
  none: "— nichts —",
};

export const AXIS_LABELS: Record<AxisId, string> = {
  leftY: "Linker Stick ↕",
  leftX: "Linker Stick ↔",
  rightY: "Rechter Stick ↕",
  rightX: "Rechter Stick ↔",
};

/** Werkseinstellung: Hauptarm links, Ausleger und Spinne rechts. */
export function defaultConfig(): ControlConfig {
  return {
    leftY: { fn: "boom", invert: false },
    leftX: { fn: "cab", invert: false },
    rightY: { fn: "stick", invert: false },
    rightX: { fn: "grapple", invert: false },
  };
}

const KEY = "schrottplatz.controls.v1";

export function loadConfig(): ControlConfig {
  const base = defaultConfig();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<ControlConfig>;
    for (const id of Object.keys(base) as AxisId[]) {
      const b = d[id];
      if (!b) continue;
      if (typeof b.fn === "string" && b.fn in FUNCTION_LABELS) base[id].fn = b.fn;
      base[id].invert = b.invert === true;
    }
  } catch {
    // defekter oder gesperrter Speicher: dann eben die Werkseinstellung
  }
  return base;
}

export function saveConfig(c: ControlConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Speichern nicht möglich (privates Fenster) — die Einstellung gilt
    // trotzdem für diese Sitzung
  }
}
