/**
 * Eingabe als Datensatz (Architektur Kap. 5). Die Simulation kennt keine Tasten:
 * Tastatur, Touch, Gamepad und später ein Replay schreiben alle in dieses Format.
 * Achsen −1..+1, schon mit Invertierung und Deadzone aus controls.json verrechnet.
 */
export type Action =
  | "grabHold" | "grabRelease" | "toggleCabLift" | "toggleOutriggers" | "toggleBlade"
  | "press" | "orderPickup" | "shop" | "toggleLabels" | "toggleMusic"
  | "pause" | "cycleCamera" | "endDay" | "confirm" | "cancel" | "toggleDriveMode" | "toggleDebug";

export interface ControlFrame {
  drive: number; steer: number;
  cab: number; boom: number; stick: number;
  /** +1 schließen … −1 öffnen; 0 = halten */
  grapple: number;
  /** Dauerdrehung −1..+1 */
  rotator: number;
  /** Diskrete Aktionen, gelten genau einen Frame */
  actions: Set<Action>;
  /** Kamera — wird nur transportiert, sim wertet es nicht aus */
  camOrbit: { dx: number; dy: number }; camZoom: number;
}

export function emptyControlFrame(): ControlFrame {
  return { drive: 0, steer: 0, cab: 0, boom: 0, stick: 0, grapple: 0, rotator: 0, actions: new Set(), camOrbit: { dx: 0, dy: 0 }, camZoom: 0 };
}
/** In-place zurücksetzen — keine Allokation pro Bild. */
export function resetControlFrame(f: ControlFrame): void {
  f.drive = f.steer = f.cab = f.boom = f.stick = f.grapple = f.rotator = 0;
  f.actions.clear();
  f.camOrbit.dx = f.camOrbit.dy = 0; f.camZoom = 0;
}
