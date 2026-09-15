import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Die Zeile, ohne die das Platzinventar nicht wiederkommt.
 *
 * E-031 hat drei Stuecke gebaut, die zusammengehoeren: die Gattung
 * `ScrapShape.inventar` samt `inventarNachtragen()` in `scrapItems.ts`, den
 * Tageszaehler `neuerTag` in `daylight.ts` — und die Verdrahtung in `main.ts`,
 * die beide verbindet. Die ersten beiden hat der Agent geliefert; die dritte
 * lag ausserhalb seines Bereichs und wurde beim Zusammenfuehren nachgetragen.
 *
 * Genau so etwas geht verloren. Zwei fertige Haelften und eine fehlende Zeile
 * sehen im Quelltext aus wie fertige Arbeit — und auf dem Geraet merkt man es
 * erst, wenn der Besen nach dem ersten Missgeschick nie wiederkommt, also
 * fruehestens am naechsten Spieltag.
 *
 * Deshalb wird hier der Zusammenhang bewacht, nicht die Funktion: Gibt es die
 * beiden Haelften, muss es auch die Verdrahtung geben.
 */

const wurzel = resolve(__dirname, "..");
const lies = (p: string) => readFileSync(resolve(wurzel, p), "utf8");

const main = lies("src/main.ts");
const daylight = lies("src/world/daylight.ts");
const scrapItems = lies("src/world/scrapItems.ts");

describe("Platzinventar kommt am naechsten Tag wieder", () => {
  it("beide Haelften sind da: der Tageszaehler und das Nachlegen", () => {
    expect(daylight, "daylight.ts kennt keinen Tageswechsel").toContain("neuerTag");
    expect(scrapItems, "scrapItems.ts kann nichts nachlegen").toContain("inventarNachtragen");
  });

  it("und main.ts verbindet sie — sonst ist beides wirkungslos", () => {
    expect(main, "main.ts fragt `neuerTag` nie ab").toContain("daylight.neuerTag");
    expect(main, "main.ts legt nie nach").toContain("items.inventarNachtragen()");
  });

  it("der Zaehler wird zurueckgesetzt, sonst legt jedes Bild nach", () => {
    /*
     * `neuerTag` ist ein Merker, kein Ereignis: Wer ihn abfragt, muss ihn
     * loeschen. Bliebe er stehen, liefe `inventarNachtragen()` in jedem Bild
     * — es ist zwar idempotent, aber es waere eine Schleife ueber alle Teile
     * des Platzes, 48-mal je Sekunde, bis zum naechsten Mitternacht.
     */
    const block = main.slice(main.indexOf("if (daylight.neuerTag)"));
    const ende = block.indexOf("}");
    expect(block.slice(0, ende), "der Merker wird nicht geloescht").toContain(
      "daylight.neuerTag = false"
    );
  });

  it("und der Abholer bringt Platzinventar zurueck, statt es mitzunehmen", () => {
    /*
     * Dieselbe Klasse Fehler, ein Paket spaeter: `ContainerAbholung` in
     * `delivery/` und `leereBehaelter` in `world/containers.ts` waren beide
     * gebaut und haben sich nicht gekannt. Ohne die Zeile in `main.ts` faehrt
     * der Muellcontainer mit dem Abholer davon und ist weg — gemerkt haette man
     * es erst, wenn er fehlt.
     */
    expect(main, "main.ts kennt ContainerAbholung nicht").toContain("ContainerAbholung");
    expect(main, "vehicles.platzinventar wird nie gesetzt").toMatch(
      /vehicles\.platzinventar\s*=\s*new ContainerAbholung\(/
    );
  });

  it("und der Abholer-Funkspruch kommt im HUD an", () => {
    /*
     * Dieselbe Klasse zum dritten Mal: `onPickupFunk` ist in `vehicles.ts`
     * gebaut und feuert, wenn der Abholer steht — aber ohne die Zeile in
     * `main.ts` hoert es niemand. Zwei fertige Haelften, eine fehlende Zeile.
     *
     * Und hier faellt es besonders spaet auf: Der Funkspruch ist seit E-056
     * der EINZIGE Weg, auf dem der Spieler erfaehrt, wo der Abholer haelt.
     * Ohne ihn sucht er den halben Platz ab und haelt es fuer einen Fehler
     * der Wegfindung.
     */
    expect(main, "onPickupFunk wird nie verdrahtet").toMatch(
      /vehicles\.onPickupFunk\s*=/
    );
    const block = main.slice(main.indexOf("vehicles.onPickupFunk"));
    expect(block.slice(0, 200), "der Spruch landet nirgends").toContain("hud.toast");
  });

  it("der Spieler erfaehrt davon", () => {
    /*
     * Ein Werkzeug, das ueber Nacht zurueckkommt, ohne dass es jemand sagt,
     * sucht man am naechsten Morgen an der falschen Stelle.
     */
    const block = main.slice(main.indexOf("if (daylight.neuerTag)"));
    expect(block.slice(0, block.indexOf("}") + 200)).toContain("hud.toast");
  });
});
