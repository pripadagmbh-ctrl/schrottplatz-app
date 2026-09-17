import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fahrplaene } from "./strecken";

/**
 * DIE STRECKENLISTE KENNT JEDE ETAPPE, DIE WIRKLICH GEFAHREN WIRD.
 *
 * DER BLINDE FLECK, DEN DIESER WAECHTER SCHLIESST (E-097, repariert in E-098).
 * Patricks Befund vom 17.09.2026 lautete „LKWS fahren durch Muellcontainer".
 * Gesucht wurde der Fehler zuerst in der Hindernisliste — dort war keiner: Der
 * Container stand vollstaendig drin, mit fuenf Kollidern, und Rapier fuehrte
 * waehrend der Durchfahrt 32 Beruehrpunkte.
 *
 * Der Fehler sass in der STRECKENLISTE. `test/strecken.ts` kannte VIER Etappen
 * je Fuhre — Einfahrt, Anfahrt, Rangieren, Ausfahrt. Gefahren wurden FUENF:
 * Nach dem Abladen rollt ein Teil der Wagen auf einen Warteplatz, und diese
 * fuenfte Etappe rechnete sich in `vehicles.toPark` mit `dx/dz` ihre eigene
 * Luftlinie. Was auf dieser Linie stand, kam in keiner Liste vor, die
 * irgendjemand prueft — und `test/fahrumriss.test.ts` blieb gruen, waehrend der
 * Kipper 3,10 m tief durch den Container fuhr.
 *
 * DAS IST DIESELBE FEHLERKLASSE WIE E-041 UND E-091: zwei Stellen, die
 * dasselbe wissen sollen, und sie wissen es verschieden. Ein Waechter, der
 * eine unvollstaendige Liste abfaehrt, meldet dasselbe wie einer, der alles
 * geprueft hat.
 *
 * DER WAECHTER FRAGT DESHALB DIE QUELLE UND NICHT EINE ZWEITE LISTE: Er liest
 * `src/delivery/vehicles.ts` und sucht jede Phase, in deren Zweig `advance()`
 * steht — denn genau das heisst „hier wird eine Strecke abgefahren". Jede
 * davon muss in `fahrplaene()` vorkommen.
 *
 * JEDE ZAHLENSCHRANKE HAT IHRE GEGENPROBE, und hier sind es zwei: Der
 * Abtaster muss eine erfundene Phase FINDEN, und die Pruefung muss eine
 * fehlende Etappe MELDEN.
 */

const QUELLE = fileURLToPath(new URL("../src/delivery/vehicles.ts", import.meta.url));

/**
 * Jede Phase, in deren `case`-Zweig `this.advance(` steht.
 *
 * Absichtlich stumpf: Ein Zweig reicht bis zum naechsten `case "…":` auf
 * derselben Ebene. Steht darin ein Aufruf von `advance`, faehrt diese Phase
 * eine Strecke ab. Andere `switch`-Anweisungen derselben Datei (Funksprueche,
 * Fahrzeugarten) fallen von selbst heraus — in ihren Zweigen faehrt niemand.
 */
export function phasenMitStrecke(quelltext: string): string[] {
  const treffer: string[] = [];
  const marke = /^[ \t]*case "([A-Za-z]+)":/gm;
  const stellen: Array<[string, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = marke.exec(quelltext)) !== null) stellen.push([m[1]!, m.index]);
  for (let i = 0; i < stellen.length; i++) {
    const von = stellen[i]![1];
    const bis = i + 1 < stellen.length ? stellen[i + 1]![1] : quelltext.length;
    if (quelltext.slice(von, bis).includes("this.advance(")) treffer.push(stellen[i]![0]!);
  }
  return [...new Set(treffer)].sort();
}

/** Welche Phasen die Streckenliste kennt. */
function phasenInDerListe(): string[] {
  const out = new Set<string>();
  for (const f of fahrplaene()) for (const e of f.etappen) for (const p of e.phasen) out.add(p);
  return [...out].sort();
}

describe("Die Streckenliste kennt jede gefahrene Etappe", () => {
  it("jede Phase, die `advance` ruft, steht in `fahrplaene()`", () => {
    const quelle = readFileSync(QUELLE, "utf8");
    const gefahren = phasenMitStrecke(quelle);

    /*
     * ERST DIE FRAGE, OB UEBERHAUPT ETWAS GEFUNDEN WURDE. Ein Abtaster, der
     * ins Leere greift — weil jemand `advance` umbenannt oder den `switch`
     * umgebaut hat —, meldete sonst dasselbe wie einer, der alles gefunden
     * hat. Stand 17.09.2026 sind es sechs: `in`, `approach`, `reverseIn`,
     * `toPark`, `parkRueck`, `nudging`, `out`.
     */
    expect(
      gefahren.length,
      `keine einzige Fahrphase in ${QUELLE} gefunden — ist advance() umbenannt?`
    ).toBeGreaterThanOrEqual(6);
    // Und die fuenfte Etappe namentlich: Sie ist der Anlass dieses Waechters.
    expect(gefahren, "`toPark` faehrt keine Strecke mehr ab").toContain("toPark");
    expect(gefahren, "`parkRueck` faehrt keine Strecke mehr ab").toContain("parkRueck");

    const kennt = phasenInDerListe();
    const fehlend = gefahren.filter((p) => !kennt.includes(p));
    expect(
      fehlend,
      `gefahren, aber in keiner Streckenliste: ${fehlend.join(", ")} ` +
        `(bekannt: ${kennt.join(", ")})`
    ).toEqual([]);
  });

  it("GEGENPROBE 1: der Abtaster findet eine erfundene Phase", () => {
    /*
     * Waere die Regex kaputt, faende sie gar nichts und der Fall oben waere
     * gruen, ohne etwas zu pruefen. Hier bekommt sie einen Quelltext, in dem
     * die Antwort feststeht.
     */
    const erfunden = [
      "    switch (this.phase) {",
      '      case "zumWaschplatz": {',
      "        this.advance(this.routeWasch, SPEED * dt, false, dt);",
      "        break;",
      "      }",
      '      case "traeumt":',
      "        break;",
      "    }",
    ].join("\n");
    const gefunden = phasenMitStrecke(erfunden);
    expect(gefunden, "der Abtaster sieht eine fahrende Phase nicht").toContain("zumWaschplatz");
    expect(gefunden, "der Abtaster haelt eine stehende Phase faelschlich fuer fahrend").not.toContain(
      "traeumt"
    );
  });

  it("GEGENPROBE 2: eine fehlende Etappe faellt auf", () => {
    /*
     * Der eigentliche Beweis, dass dieser Waechter den Befund von heute
     * gefunden HAETTE: Die Liste wird auf den Stand vom 16.09.2026
     * zurueckgedreht — vier Etappen je Fuhre, ohne den Weg zum Warteplatz —
     * und dieselbe Pruefung muss `toPark` und `parkRueck` melden.
     */
    const quelle = readFileSync(QUELLE, "utf8");
    const gefahren = phasenMitStrecke(quelle);
    const alteListe = new Set<string>();
    for (const f of fahrplaene()) {
      for (const e of f.etappen) {
        if (e.phasen.includes("toPark") || e.phasen.includes("parkRueck")) continue;
        for (const p of e.phasen) alteListe.add(p);
      }
    }
    const fehlend = gefahren.filter((p) => !alteListe.has(p));
    expect(fehlend.sort(), "die verkuerzte Liste faellt nicht auf").toEqual([
      "parkRueck",
      "toPark",
    ]);
  });
});
