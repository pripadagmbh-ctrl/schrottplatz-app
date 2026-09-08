/**
 * Branded Ids: ein `ItemId` lässt sich nicht versehentlich als `ContainerId` verwenden,
 * obwohl beides zur Laufzeit ein String ist. Kostet nichts, fängt Vertauschungen im Typ-Check.
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ItemId = Brand<string, "ItemId">;
export type ContainerId = Brand<string, "ContainerId">;
export type CompositeId = Brand<string, "CompositeId">;
export type DeliveryId = Brand<string, "DeliveryId">;
export type VehicleId = Brand<string, "VehicleId">;

let counter = 0;
/** Fortlaufende Id mit Präfix; deterministisch innerhalb eines Laufs (wichtig für Tests und Spielstände). */
export function nextId<T extends Brand<string, string>>(prefix: string): T {
  counter += 1;
  return `${prefix}_${counter}` as T;
}
/** Nur für Tests und Laden eines Spielstands: Zähler zurücksetzen bzw. hinter die höchste Id legen. */
export function resetIdCounter(to = 0): void {
  counter = to;
}
