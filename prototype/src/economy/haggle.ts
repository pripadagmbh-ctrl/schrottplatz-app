import type { CustomerGroup, CustomerProfile } from "../delivery/customers";

/**
 * Verhandeln über den Ankaufspreis (Briefing Kap. 26.2, Fassung 02.09.2026).
 *
 * Nach der Wiegung nennt der Spieler seinen Preis — in Prozent des
 * Marktpreises. Wie weit er drücken kann, hängt an drei Dingen:
 *
 *   WER      Privatleute kennen die Notierung nicht und nehmen fast alles;
 *            Gewerbe verhandelt kaum, ist aber sachlich; die Händlerfamilien
 *            kennen jeden Preis und drücken zurück. Sie sind die schwerste
 *            Gruppe, und ihre Härte ist von Familie zu Familie verschieden.
 *   WAS      Sortenreine Ware hat einen klaren Marktwert — da lässt sich
 *            wenig behaupten. Bei gemischtem Schrott ist mehr Spielraum,
 *            weil der Aufwand im Preis steckt.
 *   RUF      Wer sich einen Namen gemacht hat, bekommt mehr Spielraum. Wer
 *            ihn verspielt hat, weniger.
 *
 * Wird zu hart gedrückt, lehnt der Kunde ab. Händler fahren dann wieder vom
 * Hof — mit ihrer Ladung und einem langen Gedächtnis.
 */

export type Offer = "markt" | "leicht" | "hart";

/** Was der Spieler zahlt, als Anteil des Marktpreises. */
export const OFFER_FACTOR: Record<Offer, number> = {
  markt: 1.0,
  leicht: 0.85,
  hart: 0.68,
};

export const OFFER_LABEL: Record<Offer, string> = {
  markt: "Marktpreis zahlen",
  leicht: "Etwas drücken (−15 %)",
  hart: "Hart drücken (−32 %)",
};

/**
 * Wie viel Abschlag eine Gruppe grundsätzlich hinnimmt, bevor sie ablehnt.
 * Privatleute merken es kaum, Händler sofort.
 */
const TOLERANZ: Record<CustomerGroup, number> = {
  // Privatleute kennen die Notierung nicht und nehmen fast alles hin
  privat: 0.5,
  // Gewerbe verhandelt kaum, lässt aber ein kleines Entgegenkommen zu —
  // ganz stur wäre es nicht, der Preis ist ihnen ja zweitrangig
  gewerbe: 0.3,
  // Händler kennen jeden Preis; ihre Härte (1–5) schlägt hier voll durch
  haendler: 0.31,
};

export interface HaggleResult {
  /** Nimmt der Kunde an? */
  accepted: boolean;
  /** Tatsächlich gezahlter Anteil des Marktpreises */
  factor: number;
  /** Was der Kunde dazu sagt */
  reply: string;
  /** Wie sehr das dem Ruf schadet (0 = gar nicht, 1 = deutlich) */
  offense: number;
}

/**
 * Angebot prüfen.
 *
 * @param c        wer gerade an der Waage steht
 * @param offer    das Angebot des Spielers
 * @param purity   Sortenreinheit der Ladung (0..1) — sauber getrennte Ware
 *                 lässt sich schlechter drücken
 * @param repBonus Rufbonus −1..1; guter Ruf verschafft Spielraum
 */
export function haggle(
  c: CustomerProfile,
  offer: Offer,
  purity: number,
  repBonus = 0
): HaggleResult {
  const abschlag = 1 - OFFER_FACTOR[offer];
  // Sortenreine Ware hat einen klaren Marktwert: Da glaubt niemand an
  // Aufwandszuschläge. Bei Mischschrott ist mehr Verhandlungsspielraum.
  const reinheitsMalus = purity * 0.18;
  // Härte der Figur (1–5) schlägt bei Händlern voll durch
  const haerteMalus = (c.hardness - 1) * 0.035;
  const grenze = Math.max(
    0.05,
    TOLERANZ[c.group] - reinheitsMalus - haerteMalus + repBonus * 0.1
  );

  if (abschlag <= grenze) {
    return {
      accepted: true,
      factor: OFFER_FACTOR[offer],
      reply: zusage(c, offer),
      // Auch angenommenes Drücken bleibt in Erinnerung
      offense: abschlag > 0.05 ? abschlag * 0.6 : 0,
    };
  }
  return {
    accepted: false,
    factor: OFFER_FACTOR.markt,
    reply: absage(c),
    offense: abschlag,
  };
}

/**
 * Fährt der Kunde bei Ablehnung wieder vom Hof? Händler nehmen ihre Ware
 * wieder mit — Privatleute und Gewerbe laden trotzdem ab, murren aber.
 */
export function leavesOnRefusal(c: CustomerProfile): boolean {
  return c.group === "haendler";
}

function zusage(c: CustomerProfile, offer: Offer): string {
  if (offer === "markt") {
    return c.group === "haendler" ? "Geht in Ordnung." : "Danke, passt.";
  }
  if (c.group === "privat") return "Wenn Sie meinen.";
  if (c.group === "gewerbe") return "Einverstanden, aber knapp.";
  return offer === "leicht" ? "Na gut, diesmal." : "Du bist hart, aber es geht.";
}

function absage(c: CustomerProfile): string {
  if (c.group === "privat") return "Das ist aber wenig …";
  if (c.group === "gewerbe") return "Dafür fahren wir nicht.";
  return [
    "Nicht mit mir. Ich fahr wieder.",
    "Dann nehm ich es woanders hin.",
    "Für den Preis? Bestimmt nicht.",
  ][Math.floor(Math.random() * 3)];
}

/** Wie viel Spielraum diese Kundschaft überhaupt zulässt — für den Hinweis. */
export function hint(c: CustomerProfile): string {
  if (c.group === "privat") return "kennt die Preise nicht";
  if (c.group === "gewerbe") return "will vor allem Verlässlichkeit";
  return c.hardness >= 5 ? "kennt jeden Preis, drückt zurück" : "handelt, aber fair";
}
