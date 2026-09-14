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

/**
 * Werkseinstellung nach dem Bedienschema echter Umschlagbagger:
 *   linker Stick   ↕ Hauptarm hoch/runter   ↔ Oberwagen links/rechts
 *   rechter Stick  ↕ Ausleger hoch/runter   ↔ Spinne öffnen/schließen
 *
 * Beide Y-Achsen sind umgekehrt, weil ein Stick nach vorne einen negativen
 * Bildschirmwert liefert, „nach oben drücken" aber „Arm heben" bedeuten soll.
 *
 * Auch das Drehen ist umgekehrt (Ansage 14.09.2026: Patrick hatte sich diese
 * Belegung auf dem iPad eingestellt und wollte sie als Werkseinstellung). Der
 * Grund liegt in der Blickrichtung: Der Spieler sitzt in der Kabine und dreht
 * MIT dem Oberwagen. Stick nach links soll die Welt nach rechts wandern
 * lassen — also den Oberwagen nach links schwenken. Ohne Umkehr fuehlt es sich
 * an, als schoebe man die Landschaft statt die Maschine zu drehen.
 */
export function defaultConfig(): ControlConfig {
  return {
    leftY: { fn: "boom", invert: true },
    leftX: { fn: "cab", invert: true },
    rightY: { fn: "stick", invert: true },
    rightX: { fn: "grapple", invert: false },
  };
}

// v3: auch das Drehen laeuft jetzt umgekehrt (14.09.2026). Der Schluessel
// wandert mit, damit bestehende Staende die neue Werkseinstellung bekommen,
// statt die alte weiterzuschleppen — dieselbe Ueberlegung wie bei v2, als die
// Y-Achsen gedreht wurden.
const KEY = "schrottplatz.controls.v3";

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
