import { rollCustomer, type CustomerProfile } from "./customers";
import type { Fahrzeugart } from "./fuellgrad";

/**
 * NACHSCHUB IM SANDKASTEN (E-118).
 *
 * Im Simulator gibt es kein Geld und keine Kundschaft — aber Material soll
 * trotzdem kommen. Der kleinste Weg: dieselbe Anlieferung wie bisher
 * (`VehicleManager.spawnNow`), nur auf Knopfdruck statt nach Uhr, und ohne
 * dass jemand an der Waage bezahlt oder verhandelt (das hängt `main.ts` ab).
 *
 * Reihum statt gewürfelt: Wer dreimal NACHSCHUB tippt, bekommt einen Kipper,
 * eine Pritsche und ein Wrack. Beim Zufall der Kundschaft käme ein Wrack nur
 * bei rund jeder neunten Fuhre — zu selten für einen Platz, auf dem es ums
 * Zerlegen geht.
 */
export const NACHSCHUB_FOLGE: readonly Fahrzeugart[] = ["kipper", "pritsche", "wrack"];

/**
 * So oft wird höchstens gewürfelt, bis das Fahrzeug passt.
 * // SW: Ein Wrack kommt bei etwa 12 % der Würfe (Händler 60 % × 15 % +
 * Privat 18 % × 15 %, `customers.ts`); 200 Fehlwürfe in Folge sind
 * praktisch ausgeschlossen (0,88^200 ≈ 1e-11).
 */
const MAX_WUERFE = 200;

/** Was im HUD steht, wenn die Fuhre losfährt — Fahrzeug, kein Kundenname. */
export const NACHSCHUB_MELDUNG: Record<Fahrzeugart, string> = {
  kipper: "Nachschub: Ein Kipper ist unterwegs.",
  pritsche: "Nachschub: Eine Pritsche ist unterwegs.",
  wrack: "Nachschub: Ein Wrack ist unterwegs.",
  pkw: "Nachschub: Ein Anhänger ist unterwegs.",
};

/**
 * Ein Profil für die nächste Fuhre, dessen Fahrzeug `art` ist.
 *
 * Gewürfelt wird mit der gewohnten Kundschaft, damit Menge, Füllgrad und
 * Ladung zum Fahrzeug passen — ein Profil mit fremdem Fahrzeug hätte eine
 * Anhängerladung auf einen Kipper gelegt. Passt nach `MAX_WUERFE` keins,
 * kommt das letzte: lieber eine andere Fuhre als keine.
 */
export function profilFuer(
  art: Fahrzeugart,
  wuerfle: () => CustomerProfile = rollCustomer
): CustomerProfile {
  let c = wuerfle();
  for (let i = 1; i < MAX_WUERFE && c.vehicle !== art; i++) c = wuerfle();
  return c;
}
