/**
 * Der Verdrahtungswaechter fuers Funkgeraet (E-095).
 *
 * Vorbild: `test/platzinventar-verdrahtung.test.ts`. Dieselbe Klasse Fehler,
 * und bei Sprueche ist sie besonders tueckisch: Eine Liste schoener Saetze im
 * Quelltext SIEHT aus wie fertige Arbeit. Ob sie jemals jemand hoert, haengt
 * an zwei Stellen — an einer Abfrage, die den Anlass erkennt, und an einer
 * Zeile in `main.ts`, die den Kanal ans HUD haengt. Fehlt eine davon, merkt
 * man es nie: Es ist ja nicht kaputt, es sagt nur niemand etwas.
 *
 * Deshalb drei Ebenen:
 *  1. Jeder Anlass hat einen Weg im Quelltext (`melde("…")`) — mit Gegenprobe.
 *  2. Jeder Anlass ist wirklich erreichbar: Er wird hier einzeln ausgeloest.
 *  3. Der Kanal haengt in `main.ts` am HUD — oder es steht ausdruecklich im
 *     Log, dass die Verdrahtung noch offen ist. Genau eines von beidem.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Funkzentrale, SPRUECHE, type Anlass, type Funkspruch } from "../src/ui/funk";

const wurzel = resolve(__dirname, "..");
const lies = (p: string): string => readFileSync(resolve(wurzel, p), "utf8");

const funkQuelle = lies("src/ui/funk.ts");
const main = lies("src/main.ts");
const log = lies("docs/entscheidungen.md");

const ALLE = Object.keys(SPRUECHE) as Anlass[];

/**
 * Gibt es im Quelltext eine REGEL, die diesen Anlass ausloest?
 *
 * Gesucht wird ausdruecklich nur unterhalb von `export class Funkzentrale` —
 * oberhalb stehen die Sprueche und die Sprecherliste, und dort kommt jeder
 * Anlass ohnehin vor. Genau das ist der Fehler, den dieser Waechter sucht:
 * eine schoene Liste ohne eine einzige Stelle, die sie benutzt.
 */
function hatRegel(quelle: string, anlass: Anlass): boolean {
  const ab = quelle.indexOf("export class Funkzentrale");
  if (ab < 0) return false;
  return quelle.slice(ab).includes(`"${anlass}"`);
}

describe("Kein Spruch ohne Regel, die ihn ausloest", () => {
  it("jeder Anlass kommt in einer Regel vor, nicht nur in der Spruchliste", () => {
    for (const a of ALLE) {
      expect(hatRegel(funkQuelle, a), `„${a}" steht in der Liste, loest aber nie aus`).toBe(true);
    }
  });

  it("GEGENPROBE: nimmt man eine Regel heraus, faellt es auf", () => {
    const kaputt = funkQuelle.replace('this.melde("vielLose", "")', "const weg = 0");
    expect(kaputt, "die Gegenprobe hat gar nichts veraendert").not.toBe(funkQuelle);
    expect(hatRegel(kaputt, "vielLose"), "die Gegenprobe meldet nichts").toBe(false);
    // und die anderen Regeln sind davon unberuehrt — die Pruefung ist nicht stumpf
    expect(hatRegel(kaputt, "spurLange")).toBe(true);
    expect(hatRegel(kaputt, "abfallDrin")).toBe(true);
  });
});

describe("Jeder Anlass ist wirklich erreichbar", () => {
  /**
   * Je Anlass ein Ablauf, der ihn ausloest. Das ist die Gegenprobe zur
   * Textsuche oben: Ein `melde("…")`, das hinter einer Bedingung liegt, die
   * nie wahr wird, bestuende die erste Pruefung und faellt hier durch.
   */
  const ablaeufe: Record<
    Anlass,
    (f: Funkzentrale, vor: (s: number) => void, hoere: () => void) => void
  > = {
    abfallDrin: (f) =>
      f.wiegung({
        kg: 3000,
        sortenrein: null,
        mix: [
          { materialId: "steel", share: 0.7 },
          { materialId: "rubble", share: 0.3 },
        ],
      }),
    buntVersteckt: (f) =>
      f.wiegung({
        kg: 2000,
        sortenrein: null,
        mix: [
          { materialId: "steel", share: 0.9 },
          { materialId: "copper", share: 0.1 },
        ],
      }),
    vieleSorten: (f) =>
      f.wiegung({
        kg: 5000,
        sortenrein: null,
        mix: [
          { materialId: "steel", share: 0.4 },
          { materialId: "alu", share: 0.3 },
          { materialId: "va", share: 0.2 },
          { materialId: "zinc", share: 0.1 },
        ],
      }),
    sauber: (f, vor, hoere) => {
      f.wiegung({
        kg: 3000,
        sortenrein: null,
        mix: [
          { materialId: "steel", share: 0.7 },
          { materialId: "rubble", share: 0.3 },
        ],
      });
      // Die Beanstandung erst durchgeben — die Leitung hat nur einen Platz
      hoere();
      vor(60);
      f.wiegung({ kg: 900, sortenrein: "steel", mix: [{ materialId: "steel", share: 1 }] });
    },
    kundeWieder: (f, vor) => {
      const k = { name: "Bertram Nolden", subtitle: "Dachdeckerei", group: "gewerbe" };
      f.kundeDa(k);
      f.wiegung({
        kg: 400,
        sortenrein: "copper",
        mix: [{ materialId: "copper", share: 1 }],
        kunde: k.name,
      });
      vor(300);
      f.kundeDa({ name: "Jemand anders", subtitle: "Privat", group: "privat" });
      vor(300);
      f.kundeDa(k);
    },
    kundeBekannt: (f, vor) => {
      const k = { name: "Theo Külpmann", subtitle: "Rentner", group: "privat" };
      f.kundeDa(k);
      vor(300);
      f.kundeDa({ name: "Jemand anders", subtitle: "Privat", group: "privat" });
      vor(300);
      f.kundeDa(k);
    },
    vieleHaendler: (f, vor) => {
      for (let i = 1; i <= 3; i++) {
        f.kundeDa({ name: `Händler ${i}`, subtitle: `Betrieb ${i}`, group: "haendler" });
        vor(300);
      }
    },
    betriebWieder: (f, vor) => {
      f.kundeDa({ name: "Fahrer eins", subtitle: "Elektro Vossen", group: "gewerbe" });
      vor(300);
      f.kundeDa({ name: "Dazwischen", subtitle: "Privat", group: "privat" });
      vor(300);
      f.kundeDa({ name: "Fahrer zwei", subtitle: "Elektro Vossen", group: "gewerbe" });
    },
    lambertFertig: (f, vor) => {
      f.platzlage({ loseKg: 0, spurBlockiert: false, lambertArbeitet: true });
      vor(30);
      f.platzlage({ loseKg: 0, spurBlockiert: false, lambertArbeitet: false });
    },
    spurLange: (f, vor) => {
      f.platzlage({ loseKg: 0, spurBlockiert: true, lambertArbeitet: false });
      vor(40);
      f.platzlage({ loseKg: 0, spurBlockiert: true, lambertArbeitet: false });
    },
    vielLose: (f) => f.platzlage({ loseKg: 2500, spurBlockiert: false, lambertArbeitet: false }),
  };

  for (const anlass of ALLE) {
    it(`„${anlass}" kommt beim Spieler an`, () => {
      let t = 5000;
      const f = new Funkzentrale(() => t);
      const gehoert: Funkspruch[] = [];
      f.onSpruch = (s) => gehoert.push(s);
      const ruhe = { loseKg: 0, spurBlockiert: false, lambertArbeitet: false };
      const hoere = (): void => {
        t += 5;
        f.platzlage(ruhe);
      };
      ablaeufe[anlass](f, (s: number) => (t += s), hoere);
      /*
       * Zustellen. Ein Funkspruch wartet 3,5 s, damit er die Meldung nicht
       * überschreibt, an der er hängt; herausgegeben wird er in
       * `platzlage()`, also in der Bildschleife. Hier wird sie von Hand
       * gedreht — und genau dieser Schritt ist der Grund, warum
       * `funk.platzlage(…)` in `main.ts` stehen MUSS.
       */
      hoere();
      expect(
        gehoert.map((s) => s.anlass),
        `der Ablauf loest „${anlass}" nicht aus`
      ).toContain(anlass);
      // und der Satz ist gefuellt, nicht die leere Vorlage
      const spruch = gehoert.find((s) => s.anlass === anlass)!;
      expect(spruch.text.trim().length).toBeGreaterThan(5);
      expect(spruch.wer.length).toBeGreaterThan(0);
      expect(spruch.text, "eine Vorlage ist nicht ersetzt worden").not.toContain("undefined");
    });
  }

  it("es gibt keinen Anlass ohne Ablauf — die Tabelle ist vollstaendig", () => {
    expect(Object.keys(ablaeufe).sort()).toEqual([...ALLE].sort());
  });
});

describe("Der Kanal haengt am HUD", () => {
  /**
   * DIE FEHLENDE ZEILE. `Funkzentrale` ist gebaut und geprueft — aber ohne
   * die Verdrahtung in `main.ts` hoert niemand etwas.
   *
   * `main.ts` gehoert diesem Paket nicht (dort arbeitet gleichzeitig ein
   * anderer Agent), deshalb darf der Waechter heute noch gruen sein — aber
   * nur, solange im Log ausdruecklich steht, dass die Verdrahtung offen ist.
   * Wer sie einbaut, muss den Vermerk entfernen; wer den Vermerk entfernt,
   * muss sie einbauen. Beides zugleich oder keines von beidem faellt hier auf.
   */
  const NOTNAGEL = "FUNK-VERDRAHTUNG OFFEN";
  const teile = [
    /new Funkzentrale\(/,
    /funk\.onSpruch\s*=/,
    /funk\.wiegung\(/,
    /funk\.kundeDa\(/,
    /funk\.platzlage\(/,
  ];
  const verdrahtet = teile.every((r) => r.test(main));
  const vermerkt = log.includes(NOTNAGEL);

  it("entweder verdrahtet oder ausdruecklich als offen vermerkt — nie beides, nie keines", () => {
    expect(
      verdrahtet !== vermerkt,
      verdrahtet
        ? `Der Funk ist verdrahtet, aber im Log steht noch „${NOTNAGEL}" — Vermerk entfernen.`
        : `Der Funk ist NICHT in main.ts verdrahtet und im Log steht kein „${NOTNAGEL}".` +
          ` Fehlend: ${teile.filter((r) => !r.test(main)).map(String).join(", ")}`
    ).toBe(true);
  });

  it.runIf(verdrahtet)("und der Spruch landet wirklich in einer Einblendung", () => {
    const stelle = main.search(/funk\.onSpruch\s*=/);
    expect(stelle, "onSpruch wird nie gesetzt").toBeGreaterThan(0);
    expect(
      main.slice(stelle, stelle + 200),
      "der Spruch landet nirgends — kein hud.toast"
    ).toContain("hud.toast");
  });

  it.runIf(verdrahtet)("und die Lage wird laufend gemeldet, nicht einmalig", () => {
    // `platzlage` gehoert in die Bildschleife; steht sie im Aufbau, meldet
    // Lambert genau einmal im Leben etwas.
    const stelle = main.search(/funk\.platzlage\(/);
    const schleife = main.search(/function frame|requestAnimationFrame/);
    expect(stelle).toBeGreaterThan(schleife);
  });
});
