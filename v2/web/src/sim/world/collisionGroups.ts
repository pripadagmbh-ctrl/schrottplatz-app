/**
 * Kollisionsgruppen als Bitmasken (Briefing Kap. 6.2, Entscheidung E-008).
 * Rapier: obere 16 Bit = Mitgliedschaft, untere 16 Bit = mit wem kollidiert wird.
 * Gehaltene Teile kollidieren mit Boden, losen Teilen und Fahrzeugen — nie mit dem Bagger
 * und nie untereinander (sonst kämpft die Spinne gegen ihre eigene Ladung, Prototyp-Fehler).
 */
export const GROUP = {
  STATIC: 0x0001,    // Boden, Wände, Mulden, Gebäude
  LOOSE: 0x0002,     // lose Schrottteile, Wracks
  EXCAVATOR: 0x0004, // kinematische Bagger-Kollider
  HELD: 0x0008,      // Teile in der Spinne (kinematisch mitgeführt)
  VEHICLE: 0x0010,   // Lkw, Anhänger (kinematisch)
} as const;

const ALL = 0xffff;

function groups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

export const COLLISION = {
  static: groups(GROUP.STATIC, ALL),
  loose: groups(GROUP.LOOSE, GROUP.STATIC | GROUP.LOOSE | GROUP.EXCAVATOR | GROUP.HELD | GROUP.VEHICLE),
  excavator: groups(GROUP.EXCAVATOR, GROUP.STATIC | GROUP.LOOSE | GROUP.VEHICLE),
  held: groups(GROUP.HELD, GROUP.STATIC | GROUP.LOOSE | GROUP.VEHICLE),
  /** Gerade losgelassen: kurz ohne Bagger-Kontakt, damit die noch geschlossenen Krallen das Teil nicht wegschnippen (E-018) */
  released: groups(GROUP.LOOSE, GROUP.STATIC | GROUP.LOOSE | GROUP.HELD | GROUP.VEHICLE),
  vehicle: groups(GROUP.VEHICLE, GROUP.STATIC | GROUP.LOOSE | GROUP.EXCAVATOR | GROUP.HELD),
} as const;
