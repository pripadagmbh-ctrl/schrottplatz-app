import { gehoertHierhin, lagerMuldeFuer } from "../world/containers";

/**
 * Was gehoert beim VERKAUF zusammen? (E-094, 17.09.2026)
 *
 * Bis zum 16.09.2026 rechneten Schild und Kasse ueber verschiedene Begriffe:
 * Das Muldenschild fragte `gehoertHierhin` — also die Fraktionen, die in DIESE
 * Mulde duerfen —, die Kasse kannte nur die eine schwerste Fraktion in der
 * Ladung und zahlte alles andere als Verunreinigung. Eine korrekt befuellte
 * KUPFER-LAGER-Mulde stand mit 1150 € auf dem Schild und brachte 180 € an der
 * Kasse (`docs/fraktionen.md`, W-3).
 *
 * Diese Datei ist die Bruecke. Sie legt **keine zweite Liste** an: Welche
 * Fraktionen zusammen abgerechnet werden, steht schon in `world/containers.ts`
 * — naemlich in der Silo-Reihe (`lager: true`) und ihrem Feld `mitFraktionen`.
 *
 * WARUM DIE SILOS UND NICHT DIE MULDEN AM BAGGER:
 *
 * Die BUNT+VA-Mulde nimmt sieben Fraktionen auf. Sie ist aber ausdruecklich
 * **Durchgang, nicht Abrechnung** (`containers.ts`, E-028: „Die Mulde am
 * Bagger ist Durchgang, nicht Abrechnung. Solange die SILOS getrennt bleiben,
 * ist die Euro-Differenz aus dem Zusammenlegen genau null."). Lambert traegt
 * jedes Stueck in das Silo SEINER Fraktion. Wer die Buntmulde in einem Zug auf
 * den Abholer kippt, verkauft eine Mischung — und soll das auch bezahlen.
 *
 * Die Silos dagegen sind die Sorte, die der Abnehmer kauft: KUPFER-LAGER nimmt
 * Kupfer und Messing (E-010), ALU-LAGER Alu und Zink, ABFALL alle vier
 * Abfallsorten. Was dort zusammenliegt, ist eine Sorte — jede zu ihrem eigenen
 * Preis, keine drueckt die Reinheit der anderen.
 *
 * Fraktionen ohne Silo (Stahlschrott, Mischschrott) stehen fuer sich allein.
 */

/**
 * Die Fraktionen, die zusammen mit dieser abgerechnet werden — inklusive ihrer
 * selbst. Leitfraktion `null` oder unbekannt: nur sie selbst.
 */
export function abrechnungsgruppe(leitfraktion: string): string[] {
  const silo = lagerMuldeFuer(leitfraktion);
  if (!silo) return [leitfraktion];
  return [silo.fractionId, ...(silo.mitFraktionen ?? [])];
}

/**
 * Gehoert `materialId` in dieselbe Abrechnung wie `leitfraktion`?
 *
 * Genau das Praedikat, das das Muldenschild an `containerValueGemischt`
 * uebergibt (`containers.ts`, `Container.value`) — nur dass hier die Mulde
 * ueber die Leitfraktion gesucht wird, weil auf dem Abholer keine steht.
 */
export function zaehltZu(leitfraktion: string, materialId: string): boolean {
  if (leitfraktion === materialId) return true;
  const silo = lagerMuldeFuer(leitfraktion);
  return silo ? gehoertHierhin(silo, materialId) : false;
}

/**
 * Die Leitfraktion einer Ladung, wenn keine bestellt wurde.
 *
 * Die schwerste — aber **deterministisch**: Bis zum 16.09.2026 lief die Suche
 * mit `kg > dominantKg` ueber eine `Map` in Ladereihenfolge, und bei gleich
 * schweren Fraktionen gewann die, deren erstes Stueck zuerst in den Container
 * fiel. Gemessen an einer Fuhre aus je 100 kg Alu, Zink, Kupfer, Messing,
 * Kabel: 28,80 € oder 6,00 €, je nach Greifreihenfolge — Faktor 4,8 fuer
 * dieselbe Ladung (`docs/fraktionen.md`, W-10).
 *
 * Gleichstand bricht deshalb der hoehere Warenwert (kg x Preis), danach der
 * Name. Beides haengt nur an der Ladung, nicht an ihrer Geschichte.
 */
export function leitfraktion(
  massen: Iterable<[string, number]>,
  preis: (materialId: string) => number
): string {
  let beste = "";
  let besteKg = 0;
  let besterWert = 0;
  for (const [id, kg] of massen) {
    if (kg <= 0) continue;
    const wert = kg * preis(id);
    const gewinnt =
      beste === "" ||
      kg > besteKg + 1e-9 ||
      (Math.abs(kg - besteKg) <= 1e-9 &&
        (wert > besterWert + 1e-9 ||
          (Math.abs(wert - besterWert) <= 1e-9 && id < beste)));
    if (gewinnt) {
      beste = id;
      besteKg = kg;
      besterWert = wert;
    }
  }
  return beste;
}
