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
const vehicles = lies("src/delivery/vehicles.ts");

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

  it("und beide Wiegungen des Abholers kommen im HUD an", () => {
    /*
     * Dieselbe Klasse zum vierten Mal (E-064). `vehicles.ts` wiegt den
     * Abholer jetzt leer herein und voll hinaus und meldet beides ueber
     * `onAbholerTara` / `onAbholerBrutto`. Fehlt eine der beiden Zeilen in
     * `main.ts`, faellt genau die halbe Wiegung aus — und zwar stumm: Der
     * Wagen haelt trotzdem auf der Bruecke, es sagt nur niemand etwas dazu.
     *
     * Geprueft wird mit einer Funktion, damit es dieselbe Pruefung ist, die
     * gleich darunter die Gegenprobe bekommt.
     */
    const verdrahtet = (quelle: string, name: string): boolean => {
      const stelle = quelle.search(new RegExp(`vehicles\\.${name}\\s*=`));
      if (stelle < 0) return false;
      return quelle.slice(stelle, stelle + 300).includes("hud.toast");
    };
    for (const name of ["onAbholerTara", "onAbholerBrutto"]) {
      expect(verdrahtet(main, name), `${name} landet nicht im HUD`).toBe(true);
      expect(vehicles, `vehicles.ts kennt ${name} nicht`).toContain(name);
    }

    /*
     * GEGENPROBE mit dem kaputten Eingang: Wer die Zeile herausnimmt, muss
     * gemeldet werden — sonst prueft die Schleife oben nur, dass es die Datei
     * gibt.
     */
    const ohne = main.replace(/vehicles\.onAbholerBrutto\s*=/, "const weg =");
    expect(ohne, "die Gegenprobe hat gar nichts veraendert").not.toBe(main);
    expect(verdrahtet(ohne, "onAbholerBrutto"), "die Gegenprobe meldet nichts").toBe(false);
    // Und eine Verdrahtung, die ins Leere laeuft, gilt auch nicht.
    const stumm = main.replace(/vehicles\.onAbholerTara = \(tara\) =>[\s\S]{0,200}?;/, "");
    expect(verdrahtet(stumm, "onAbholerTara"), "eine stumme Meldung gilt als verdrahtet").toBe(
      false
    );
  });

  it("und die Wiegung des Abholers ruehrt das Konto nicht an", () => {
    /*
     * Patrick, mehrfach: „Kreislaufsachen noch nicht." Die Wiegung ist eine
     * Meldung — kein Geld, kein Konto, keine Preisaenderung. Bezahlt wird die
     * Fuhre weiterhin beim Losfahren vom Verladeplatz (`onPickupDepart`).
     */
    const stelle = main.search(/vehicles\.onAbholerTara\s*=/);
    expect(stelle, "onAbholerTara fehlt ganz").toBeGreaterThan(0);
    const block = main.slice(stelle, main.indexOf("vehicles.onCustomerArrived", stelle));
    expect(block.length, "der Block ist leer — so prueft das hier nichts").toBeGreaterThan(50);
    for (const verboten of ["account.", "preisFaktor", "shift."]) {
      expect(block, `die Wiegung fasst ${verboten} an`).not.toContain(verboten);
    }
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
