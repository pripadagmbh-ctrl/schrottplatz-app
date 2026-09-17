/**
 * Was Lambert über Funk durchgibt, wenn er selbständig aufräumt.
 *
 * Vorbild ist Achim (E-066, `delivery/customers.ts`: `ANLIEFERER_SPRUECHE` /
 * `anliefererfunk`) — dieselbe Bauart, damit es sich im HUD gleich anhört:
 * Lagen als Schlüssel, je Lage eine Handvoll Sätze, einer wird gezogen. Und
 * derselbe KANAL: Der Text geht über `StaffManager.onFunk` an dieselbe
 * Meldezeile wie der Abholerfunk, es gibt keinen zweiten (Auftrag
 * 17.09.2026: „Kein zweiter Kanal").
 *
 * TON-LEITPLANKE (Projektregel 7). Lambert Prison ist Platzwart, seit Jahren
 * auf dem Hof, mit Janine verwandt. Er redet aus dem BERUF heraus — was er
 * sieht, was er als Nächstes macht, wann Schluss ist. Kein Wort über
 * Herkunft, keine Sprüche über Leute. Wer hier einen Satz ergänzt, prüft ihn
 * an dieser Regel.
 */

/** In welcher Lage meldet er sich? */
export type Lambertlage =
  /** Er fängt an, Abfall einzusammeln. */
  | "abfallAn"
  /** Es liegt kein Abfall mehr herum. */
  | "abfallFertig"
  /** Die Mulde nimmt nichts mehr — er lässt den Abfall liegen. */
  | "muldeVoll"
  /** Er fängt an, Schrott zum Bagger heranzuschieben. */
  | "schiebenAn"
  /** Der Brocken liegt jetzt in Reichweite. */
  | "schiebenFertig";

export const LAMBERT_SPRUECHE: Record<Lambertlage, string[]> = {
  abfallAn: [
    "Hier liegt wieder alles voll, ich sammel das ein.",
    "Ich fahr den Abfall zusammen, bevor das einer breitfährt.",
    "Der Kram gehört in die Mulde, ich mach das.",
  ],
  abfallFertig: [
    "Abfall ist weg, der Hof ist sauber.",
    "Fertig, es liegt nichts mehr rum.",
    "Das war der letzte Rest, ich bin durch.",
  ],
  muldeVoll: [
    "Die Mulde ist voll, da kriegst du nichts mehr rein.",
    "In der Mulde ist Schluss — die muss erst weg.",
    "Voll bis oben. Ich lass den Rest liegen, bis Platz ist.",
  ],
  schiebenAn: [
    "Ich schieb dir was ran, du kommst da sonst nicht hin.",
    "Das liegt zu weit draußen, ich bring's dir vor die Maschine.",
    "Wart kurz, ich hol dir den Brocken näher.",
  ],
  schiebenFertig: [
    "So, den hast du jetzt im Griff.",
    "Liegt vor dir, greif zu.",
    "Der ist drin in deinem Bereich, ich fahr wieder rüber.",
  ],
};

/** Lamberts Name auf dem Funk — wie `ABHOLFAHRER.funkname` beim Abholer. */
export const LAMBERT_FUNKNAME = "Lambert";

/** Einen Spruch zur Lage ziehen. */
export function lambertfunk(lage: Lambertlage, rnd: () => number = Math.random): string {
  const liste = LAMBERT_SPRUECHE[lage];
  return liste[Math.floor(rnd() * liste.length) % liste.length]!;
}
