/**
 * Zwei Handgriffe gegen den Fehler, der am 15.09.2026 dreimal zugeschlagen hat.
 *
 * DAS MUSTER. Ein Wächter rechnet mit Zahlen, die aus dem Quelltext kommen.
 * Ändert sich dort etwas — eine Funktion nimmt jetzt einen Datensatz statt
 * einer Zahl, eine Konstante fällt weg —, kommt `NaN` oder `undefined` heraus.
 * Und jetzt kommt die Tücke: **Jeder Vergleich mit `NaN` ist falsch.**
 * `NaN < 0.01` ist falsch, `NaN > 0.01` ist auch falsch. Ein Wächter, der auf
 * „kleiner als" prüft, bleibt also grün — er prüft nur nichts mehr.
 *
 * Am 15.09.2026 war das dreimal so:
 *   - `test/fahrumriss.test.ts` rief `bayApproach(c.z)` statt `bayApproach(c)`.
 *     Zwei Stunden lang meldete der Wächter „null Durchdringungen" — von null
 *     geprüften Strecken. Genau dieser Wächter soll verhindern, dass LKW durch
 *     Mauern fahren.
 *   - `test/fahrstrecke.test.ts` hatte denselben Aufruf.
 *   - `test/platzinventar.test.ts` rechnete gegen eine gelöschte Konstante.
 *
 * DIE ZWEITE HÄLFTE des Musters ist aber nicht `NaN`, sondern: **Niemand merkt
 * es.** Ein Wächter, der null Fälle prüft, meldet dasselbe wie einer, der
 * tausend Fälle prüft und nichts findet. Deshalb gibt es hier zwei Funktionen
 * und nicht eine:
 *
 *   `endlich(...)`  — die Eingaben sind Zahlen, keine `NaN`.
 *   `mindestens(...)` — es wurden überhaupt Fälle geprüft.
 *
 * Seit dem 15.09.2026 sorgt zusätzlich `tsconfig.test.json` dafür, dass `tsc`
 * `test/` und `tools/` überhaupt ansieht (E-038). Die Typprüfung fängt den
 * Aufruf mit dem falschen Argument; diese Helfer fangen alles, was erst zur
 * Laufzeit `NaN` wird — eine Division durch null, ein fehlendes Feld aus einem
 * alten Spielstand.
 */
import { expect } from "vitest";

/**
 * Sind alle Zahlen endlich? Wenn nicht, sagt die Meldung, welche.
 *
 * Nimmt einzelne Zahlen, Punkte (`[x, z]`) und ganze Streckenzüge.
 * Gibt den Wert zurück, damit man ihn in einem Rutsch weiterverwenden kann.
 */
export function endlich<T extends number | readonly number[] | ReadonlyArray<readonly number[]>>(
  wert: T,
  name: string
): T {
  const schlecht: string[] = [];
  const pruefe = (v: unknown, pfad: string): void => {
    if (Array.isArray(v)) {
      v.forEach((e, i) => pruefe(e, `${pfad}[${i}]`));
      return;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) schlecht.push(`${pfad} = ${String(v)}`);
  };
  pruefe(wert, name);
  expect(
    schlecht,
    `${name}: keine endliche Zahl — ${schlecht.join(", ")}. ` +
      `Jeder Vergleich damit ist falsch, der Waechter prueft also nichts.`
  ).toEqual([]);
  return wert;
}

/**
 * Wurden überhaupt genug Fälle geprüft?
 *
 * Gegen den Wächter, der grün ist, weil seine Schleife leer blieb. Die
 * Untergrenze gehört in den Test und nicht hierher: Sie sagt, womit der Autor
 * gerechnet hat.
 */
export function mindestens(anzahl: number, untergrenze: number, name: string): void {
  expect(
    anzahl,
    `${name}: nur ${anzahl} Faelle geprueft, erwartet mindestens ${untergrenze}. ` +
      `Ein Waechter, der nichts prueft, ist gruen und wertlos.`
  ).toBeGreaterThanOrEqual(untergrenze);
}
