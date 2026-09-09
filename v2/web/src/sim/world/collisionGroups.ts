/**
 * Kollisionsgruppen als Bitmasken (Briefing Kap. 6.2, Entscheidung E-008).
 * Rapier: obere 16 Bit = Mitgliedschaft, untere 16 Bit = mit wem kollidiert wird.
 * Gehaltene Teile kollidieren nur mit Boden und Fahrzeugen — nie mit dem Bagger, nie untereinander und seit E-025 auch
 * nicht mit losen Teilen (sonst kämpft die Spinne gegen ihre eigene Ladung bzw. die Ladung schleudert den Haufen weg).
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
  /** Spinne 2.0 (E-038): der dynamische Spinnenkoerper und seine Krallen — Boden, lose Teile, Fahrzeuge; nie die eigene Ladung (HELD) */
  grapple: groups(GROUP.EXCAVATOR, GROUP.STATIC | GROUP.LOOSE | GROUP.VEHICLE),
  /** Krallen bei schliessender/geschlossener Spinne: keine losen Teile mehr wegschleudern (E-025) — nur Boden/Fahrzeuge */
  clawsClosed: groups(GROUP.EXCAVATOR, GROUP.STATIC | GROUP.VEHICLE),
  /** Gehaltene Teile sind kinematisch (= unendlich schwer): Kontakt mit losen Teilen wuerde diese wegschleudern —
   *  beim Einziehen in die Haltepose und beim Absenken in den Haufen (iPad-Test 08.09., E-025). Daher nur Boden/Fahrzeuge. */
  held: groups(GROUP.HELD, GROUP.STATIC | GROUP.VEHICLE),
  /** Gerade losgelassen: kurz ohne Bagger-Kontakt, damit die noch geschlossenen Krallen das Teil nicht wegschnippen (E-018) */
  released: groups(GROUP.LOOSE, GROUP.STATIC | GROUP.LOOSE | GROUP.HELD | GROUP.VEHICLE),
  vehicle: groups(GROUP.VEHICLE, GROUP.STATIC | GROUP.LOOSE | GROUP.EXCAVATOR | GROUP.HELD),
} as const;
