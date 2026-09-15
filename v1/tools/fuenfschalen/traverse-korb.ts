/**
 * Die Messtabelle zur Traversenfrage — druckt, was `traverse-messen.ts` misst.
 *
 * Getrennt von der Messung, damit `traverse-blatt.ts` `miss()` aufrufen kann,
 * ohne dass dabei eine Tabelle in die Ausgabe laeuft.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/traverse-korb.ts
 */
import { miss } from "./traverse-messen";
import { A_NACHGESTELLT, VARIANTEN } from "./traverse-varianten";

function main(): void {
  const zeile = (n: string, w: string[]): string =>
    `  ${n.padEnd(34)}${w.map((x) => x.padStart(14)).join("")}`;
  /*
   * Nicht `.map(miss)`: `map` reicht den Index als zweites Argument durch, und
   * das ist hier der Schalter `korb`. Bei Index 0 kaeme die ganze Korbspalte
   * mit null heraus.
   */
  const m = [...VARIANTEN, A_NACHGESTELLT].map((v) => miss(v));
  console.log("Fuenfschalengreifer — drei Traversen, gemessen am gebauten Modell");
  console.log("");
  console.log(zeile("", m.map((x) => x.name)));
  console.log(zeile("Traverse Ø (m)", m.map((x) => x.durchmesser.toFixed(2))));
  console.log(zeile("Kopfradius gemessen (m)", m.map((x) => x.kopfradius.toFixed(3))));
  console.log(zeile("Grabtiefe unter Aufhaengung (m)", m.map((x) => x.grabtiefe.toFixed(4))));
  console.log(zeile("Bauhoehe geschlossen (m)", m.map((x) => x.bauhoehe.toFixed(3))));
  console.log(zeile("Breite geschlossen (m)", m.map((x) => x.breiteZu.toFixed(3))));
  console.log(zeile("Huellkreis ueber den Weg (m)", m.map((x) => x.huellkreis.toFixed(3))));
  console.log(zeile("Bruttokorb (l)", m.map((x) => (x.bruttokorb * 1000).toFixed(0))));
  console.log(zeile("Nettokorb (l)", m.map((x) => (x.nettokorb * 1000).toFixed(0))));
  console.log(zeile("Muendungsflaeche (m²)", m.map((x) => x.muendung.toFixed(3))));
  console.log(zeile("Schlund, Eisen +5 cm (m²)", m.map((x) => x.schlund.toFixed(3))));
  console.log(zeile("Einwurfschatten (m²)", m.map((x) => x.schatten.toFixed(3))));
  console.log(
    zeile("Einwurfschatten (% der Muendung)", m.map((x) => ((x.schatten / x.muendung) * 100).toFixed(1)))
  );
  console.log(zeile("Spitzen von der Achse, zu (mm)", m.map((x) => (x.spitzenAufAchse * 1000).toFixed(1))));
  console.log(zeile("Sektor genutzt (° von 36)", m.map((x) => x.sektor.toFixed(2))));
  console.log(zeile("  davon Traverse (m²)", m.map((x) => x.schattenTraverse.toFixed(3))));
  console.log(zeile("  davon Stempel + Saeule (m²)", m.map((x) => x.schattenStempel.toFixed(3))));
  console.log(zeile("  davon Zylinder (m²)", m.map((x) => x.schattenZylinder.toFixed(3))));
  console.log(zeile("  davon Schalenkoepfe (m²)", m.map((x) => x.schattenSchalen.toFixed(3))));
  console.log(zeile("Traverse sitzt auf (m)", m.map((x) => x.traverseY.toFixed(3))));
  console.log(zeile("Zylinderauge im Guss (E-013)", m.map((x) => (x.augeImGuss ? "ja" : "NEIN"))));
  console.log(zeile("  steht vor dem Guss (mm)", m.map((x) => (x.augeAbstand * 1000).toFixed(0))));
}

main();
