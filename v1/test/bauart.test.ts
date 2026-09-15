/**
 * Waechter: Ein Teil muss das sein, wonach es aussieht (E-061, 15.09.2026).
 *
 * Anlass, woertlich (Patrick):
 *
 * > „Was auch irgendwie nicht mehr aufgeht, sind die Beschreibungen und die
 * > Teile im Materialtypen und wie die aussehen. Ich habe jetzt eben eine
 * > Couch gehabt, da hat mir einer gesagt, das waere VA. Das passt ja
 * > natuerlich nicht zusammen. Da soll schon das Objekt beschreiben, was man
 * > da sieht."
 *
 * ## Woher die Couch kam
 *
 * Nicht aus `randomCargo` — der wuerfelt zwar die Fraktion vor dem Stueck,
 * gibt aber immer die Fraktion des gezogenen Stuecks zurueck und kann darum
 * nicht luegen (der Waechter „Was eine Fuhre ansagt" unten haelt das fest).
 *
 * Die Couch kam aus dem Katalog. `objektbau.ts` waehlt beim Bau `moebel`
 * seinen Zweig nach den MASSEN: flach und tief genug heisst Polster, sonst
 * Korpus. Der `Gastro-Spültisch` (1,20 × 0,85 × 0,70 m, Fraktion VA) erfuellte
 * die Bedingung und stand als Polstersofa auf dem Platz. Weil die VA-Auswahl
 * duenn ist — zehn erreichbare Eintraege —, war er in einer sortenreinen
 * VA-Fuhre zugleich das HAEUFIGSTE Stueck: gemessen 12,7 % von 3000 Zuegen.
 * Eine Couch, zu der die Waage „sortenrein Edelstahl" sagte.
 *
 * ## Was hier bewacht wird
 *
 * Nicht der Einzelfall, sondern die Regel dahinter: **Kein Stueck traegt eine
 * Fraktion, die seiner Bauart widerspricht.** Ein Polstermoebel ist kein
 * Metall, weisse Ware ist kein Premium-Stahlschrott, eine Karosserie ist nie
 * sortenrein, ein Betonteil ist kein Buntmetall.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { alleEintraege, huellVolumen, leitstoff } from "../tools/stahlschrott";
import { fraktionVonTeil } from "../src/materials/purity";
import { feststoffdichte } from "../src/materials/schuettdichte";
import { randomCargo } from "../src/world/scrapItems";
import { griffLadung, griffZiel } from "../src/ui/hud";
import type { PileSpec } from "../src/world/objektkatalog";

const wurzel = resolve(__dirname, "..");
const objektbau = readFileSync(resolve(wurzel, "src/world/objektbau.ts"), "utf8");

/** Jeder Eintrag des Spiels mit der Fraktion, die die Regel ihm gibt. */
interface Eintrag {
  spec: PileSpec;
  liste: string;
  frak: string;
  name: string;
}
const ALLE: Eintrag[] = alleEintraege().map(({ spec, liste }) => ({
  spec,
  liste,
  frak: fraktionVonTeil(spec),
  name: spec.name ?? "(ohne Namen)",
}));

/* ------------------------------------------------------------------------ */
/* Das Messwerkzeug: welcher Zweig von `moebel` greift                        */
/* ------------------------------------------------------------------------ */

/**
 * Die Bedingung wird aus dem QUELLTEXT von `objektbau.ts` gelesen, nicht hier
 * abgeschrieben.
 *
 * Eine Kopie einer Regel driftet von ihrem Original weg, und dann glaubt man
 * der falschen — dieselbe Lehre, aus der `test/cssmass.ts` entstanden ist.
 * Aendert jemand den Zweig, faellt zuerst dieser Test und nicht irgendwann
 * Patrick eine Couch auf.
 */
function polsterSchwellen(): { a: number; b: number } {
  const m = /const weich = h < w \* ([\d.]+) && d > h \* ([\d.]+);/.exec(objektbau);
  if (!m) throw new Error("Der Polster-Zweig von `moebel` steht nicht mehr da, wo er stand");
  return { a: Number(m[1]), b: Number(m[2]) };
}

/** Wird dieses Stueck als Polstermoebel gebaut — in Stoff bezogen, mit Lehne? */
function istPolster(spec: PileSpec): boolean {
  if (spec.bau !== "moebel") return false;
  const { a, b } = polsterSchwellen();
  const [w, h, d] = spec.dims;
  return h < w * a && d > h * b;
}

describe("Das Messwerkzeug trifft den richtigen Zweig", () => {
  it("liest die Bedingung aus objektbau.ts statt sie abzuschreiben", () => {
    const { a, b } = polsterSchwellen();
    expect(a).toBeCloseTo(0.75, 6);
    expect(b).toBeCloseTo(0.7, 6);
  });

  it("erkennt das Sofa als Polster und die Schrankwand als Korpus", () => {
    // Ohne diese beiden Proben koennte `istPolster` immer `false` liefern und
    // der Waechter waere gruen, ohne etwas zu pruefen.
    const sofa = ALLE.find((e) => e.name === "Couch (Dreisitzer)")!;
    const schrank = ALLE.find((e) => e.name === "Schrankwand-Segment")!;
    expect(istPolster(sofa.spec)).toBe(true);
    expect(istPolster(schrank.spec)).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */
/* Die Regel: keine Fraktion, die der Bauart widerspricht                     */
/* ------------------------------------------------------------------------ */

/**
 * Was als METALL gilt — die Fraktionen, die man einem Polstermoebel nie
 * ansehen wuerde. `mixed` gehoert ausdruecklich NICHT dazu: Ein Sofa hat einen
 * Stahlrahmen, und Mischschrott ist genau die richtige Antwort darauf.
 */
const METALL = new Set(["steel", "va", "alu", "copper", "brass", "zinc", "battery", "cable"]);

/**
 * Verbotene Paare aus Bauart und Fraktion.
 *
 * Eine Liste ist der einfachste Weg und ehrlicher als gar nichts: Sie faengt
 * nicht jeden denkbaren Widerspruch, aber jeden, den wir benennen koennen —
 * und sie waechst mit jedem, der auffaellt.
 */
const VERBOTEN: Array<{
  was: string;
  trifft: (e: Eintrag) => boolean;
  erlaubt: (frak: string) => boolean;
  warum: string;
}> = [
  {
    was: "Polstermoebel",
    trifft: (e) => istPolster(e.spec),
    erlaubt: (f) => !METALL.has(f),
    warum: "Was in Stoff bezogen dasteht, ist nie sortenreines Metall (Patricks Couch)",
  },
  {
    was: "weisse Ware",
    trifft: (e) => e.spec.bau === "weisseWare",
    erlaubt: (f) => f !== "steel",
    warum: "Haushaltsgeraete sind Blech, nie Premium-Stahlschrott (E-042)",
  },
  {
    was: "Karosserie, Kabine und Fahrzeug",
    trifft: (e) =>
      ["karosserie", "kabine", "kleinfahrzeug", "einspurig", "wasserfahrzeug", "kufenRaupe"].includes(
        e.spec.bau ?? ""
      ),
    erlaubt: (f) => f === "mixed" || f === "wood",
    warum: "Ein zusammengebautes Fahrzeug ist nie sortenrein, solange es niemand zerlegt",
  },
  {
    was: "Betonteil",
    trifft: (e) => e.spec.bau === "beton",
    erlaubt: (f) => f === "rubble" || f === "mixed",
    warum: "Ein Betonkoerper mit Bewehrungsstummeln ist kein Buntmetall",
  },
];

describe("Kein Stueck traegt eine Fraktion, die seiner Bauart widerspricht", () => {
  for (const regel of VERBOTEN) {
    it(`${regel.was}: ${regel.warum}`, () => {
      const betroffen = ALLE.filter(regel.trifft);
      expect(betroffen.length, `keine Eintraege der Bauart ${regel.was}`).toBeGreaterThan(0);
      const verstoesse = betroffen
        .filter((e) => !regel.erlaubt(e.frak))
        .map((e) => `${e.name} → ${e.frak} (${e.liste})`);
      expect(verstoesse).toEqual([]);
    });
  }

  it("der Gastro-Spueltisch steht nicht mehr als Couch da (E-061)", () => {
    /*
     * Der Einzelfall bekommt seinen eigenen Waechter, weil er Patricks Befund
     * ist. Faellt er, ist genau die Couch zurueck, ueber die er gestolpert
     * ist — und man muss nicht erst raten, welche Regel gemeint war.
     */
    const e = ALLE.find((x) => x.name === "Gastro-Spültisch")!;
    expect(e.frak).toBe("va");
    expect(istPolster(e.spec)).toBe(false);
    expect(e.spec.bau).toBe("weisseWare");
  });
});

describe("Was noch als Polster gebaut wird, obwohl es keins ist (BEFUND)", () => {
  it("vier Stuecke sehen aus wie eine Couch und heissen anders", () => {
    /*
     * BEFUND, nicht Soll-Zustand. Diese vier tragen keine Metallfraktion und
     * verletzen die Regel oben darum nicht — aber ein Stahlschrank, eine
     * Holzkiste und eine Kuechenzeile als Polstersofa sind trotzdem falsch.
     *
     * Aus dem Katalog allein ist das nicht zu heilen: `moebel` hat nur die
     * beiden Zweige, und der andere faerbt in Holztoenen. Der saubere Weg ist
     * ein eigener Bau `polster`, den nur echte Polstermoebel tragen — das ist
     * eine Aenderung in `objektbau.ts` und gehoert dem Orchestrator vorgelegt.
     *
     * Wird die Liste LAENGER, hat jemand den Fehler vermehrt. Wird sie
     * kuerzer, ist er behoben, und dann gehoert dieser Waechter angepasst.
     */
    const falsch = ALLE.filter((e) => istPolster(e.spec) && e.name !== "Couch (Dreisitzer)")
      .map((e) => e.name)
      .sort();
    expect(falsch).toEqual([
      "Fahrzeug-Sitzbank",
      "Holzkiste",
      "Küchenzeile (Segment)",
      "Stahlschrank",
    ]);
  });
});

/* ------------------------------------------------------------------------ */
/* Der Name nennt einen Stoff — dann muss die Fraktion dazu passen            */
/* ------------------------------------------------------------------------ */

describe("Was der Name verspricht, haelt die Fraktion", () => {
  const NAMENSSTOFF: Array<[RegExp, string[], string]> = [
    [/\bHolz(?!bruch)|Lattenrost|Bohlen|Dachstuhl/i, ["wood", "mixed"], "Holz"],
    [/\bAlu(?!minium-?frei)/i, ["alu", "mixed"], "Aluminium"],
    [/\bVA-|Edelstahl|V2A/i, ["va"], "Edelstahl"],
    [/Kupfer/i, ["copper", "mixed"], "Kupfer"],
    [/Messing/i, ["brass"], "Messing"],
    [/Zink|Verzinkte/i, ["zinc", "mixed"], "Zink"],
    [/Reifen(?!haufen)|Reifenhaufen/i, ["tires"], "Reifen"],
    [/Kunststoff|GFK/i, ["plastic", "mixed"], "Kunststoff"],
    [/Batterie|Starterbatterie/i, ["battery"], "Batterie"],
    [/Kabel(?!trommel)/i, ["cable", "mixed"], "Kabel"],
  ];

  it("kein Stueck nennt im Namen einen Stoff, den es nicht ist", () => {
    const verstoesse: string[] = [];
    for (const e of ALLE)
      for (const [re, ok, stoff] of NAMENSSTOFF)
        if (re.test(e.name) && !ok.includes(e.frak))
          verstoesse.push(`${e.name} verspricht ${stoff}, ist aber ${e.frak}`);
    expect(verstoesse).toEqual([]);
  });

  it("der Waechter greift wirklich — eine erfundene Couch aus VA faellt durch", () => {
    // Die Probe aufs Exempel: Ohne sie koennte jeder Ausdruck oben ins Leere
    // laufen und die Liste waere leer, weil nichts geprueft wird.
    const erfunden = { name: "VA-Sofa", frak: "mixed" };
    const treffer = NAMENSSTOFF.filter(([re, ok]) => re.test(erfunden.name) && !ok.includes(erfunden.frak));
    expect(treffer.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Die Ladung: was angesagt wird, liegt auch drauf                            */
/* ------------------------------------------------------------------------ */

/**
 * Ein berechenbarer Zufall.
 *
 * `randomCargo` greift direkt auf `Math.random`. Ein Waechter, der mit echtem
 * Zufall misst, ist mal gruen und mal rot — und ein Test, dem man nicht
 * glaubt, ist keiner. Der Generator hier ist ein gewoehnlicher linearer
 * Kongruenzgenerator; auf seine Zahlenqualitaet kommt es nicht an, nur darauf,
 * dass jeder Lauf dieselbe Folge sieht.
 */
function festerZufall(saat: number): () => number {
  let s = saat >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Was eine Fuhre ansagt, liegt auch drauf", () => {
  it("jedes Stueck traegt die Fraktion, die die Regel ihm gibt", () => {
    vi.spyOn(Math, "random").mockImplementation(festerZufall(20260915));
    const ladung = randomCargo(2000, 0.4, 0.1);
    for (const c of ladung) {
      const gerechnet = fraktionVonTeil({
        materialId: c.materialId,
        massKg: c.massKg,
        kind: c.shape.kind,
        dims: c.shape.dims,
        zusammensetzung: c.shape.zusammensetzung,
        massiv: c.shape.massiv,
      });
      expect(gerechnet, `${c.shape.name ?? "(ohne Namen)"} luegt ueber seine Fraktion`).toBe(
        c.materialId
      );
    }
  });

  it("eine sortenreine VA-Fuhre bringt nur VA — und keine Polstermoebel", () => {
    /*
     * Genau der Fall aus Patricks Befund: Der Haendler sagt „sortenrein
     * Edelstahl", und die Waage sagt es ihm nach. Was dann auf der Pritsche
     * liegt, darf ihm nicht widersprechen — weder im Stoff noch im Anblick.
     */
    vi.spyOn(Math, "random").mockImplementation(festerZufall(4711));
    const ladung = randomCargo(1500, 0.5, 0, "va");
    expect(new Set(ladung.map((c) => c.materialId))).toEqual(new Set(["va"]));
    const polster = ladung.filter((c) =>
      ALLE.some((e) => e.name === c.shape.name && istPolster(e.spec))
    );
    expect(polster.map((c) => c.shape.name)).toEqual([]);
  });

  it("BEFUND: die feste Fraktionstabelle liefert Baumischabfall nicht aus", () => {
    /*
     * Die Tabelle in `randomCargo` verspricht 42 % Stahl, 22 % Mischschrott,
     * 16 % Alu und den Rest zu gleichen Teilen auf neun Fraktionen — also je
     * 2,2 %. Bei `rubble` geht das nicht auf: In der Liste der Kleinteile
     * steht kein einziger Eintrag dieser Fraktion, und dann greift der
     * Notausgang (`pool[Math.random() …]`) und zieht irgendetwas.
     *
     * Er LUEGT dabei nicht — das gezogene Stueck traegt seine eigene Fraktion,
     * das prueft der Waechter oben. Aber die Mischung stimmt nicht mit dem
     * ueberein, was daneben als Absicht steht. Gemessen ohne Grossteile:
     * 0,0 % statt 2,2 %.
     *
     * Nicht behoben, weil jede Aenderung an dieser Tabelle den Verdienst
     * verschiebt (E-042: Der Stahlanteil haengt daran) und das eine
     * Entscheidung von Patrick ist, keine Aufraeumarbeit.
     */
    vi.spyOn(Math, "random").mockImplementation(festerZufall(1));
    const ladung = randomCargo(4000, 0, 0);
    const anteil = (id: string) => ladung.filter((c) => c.materialId === id).length / ladung.length;
    expect(anteil("rubble")).toBe(0);
    // Der Stahlanteil dagegen sitzt: Stahl gibt es in jeder Groessenklasse.
    expect(anteil("steel")).toBeGreaterThan(0.38);
    expect(anteil("steel")).toBeLessThan(0.47);
  });
});

/* ------------------------------------------------------------------------ */
/* Die Griff-Info sagt die Sortierklasse nicht mehr an                        */
/* ------------------------------------------------------------------------ */

/* ------------------------------------------------------------------------ */
/* Die Griff-Info: Fraktion ja, Prozente nein, Zielhinweis nein               */
/* ------------------------------------------------------------------------ */

describe("Was die Griff-Info sagt und was nicht (E-061)", () => {
  const kopfVon = (e: Eintrag): string =>
    griffZiel({
      materialId: e.frak,
      massKg: e.spec.massKg,
      shape: { name: e.spec.name, zusammensetzung: e.spec.zusammensetzung },
    }).kopf;

  it("nennt die Fraktion, wo man sich irren kann", () => {
    /*
     * Patrick, 15.09.2026: „Ich muss natuerlich sehen, was ich greife. Wenn es
     * Mischschrott ist, muss ich das sehen. Wenn es VA ist, muss ich das
     * sehen." Genau diese drei Faelle stehen hier — Verwechslungsgefahr in
     * Person: Alu gegen VA, Blech gegen Traeger, ein Name ohne jeden Hinweis.
     */
    expect(kopfVon(ALLE.find((e) => e.name === "Fluggasttreppe")!)).toContain(
      "Fluggasttreppe (Aluminium)"
    );
    expect(kopfVon(ALLE.find((e) => e.name === "Kühlschrank")!)).toContain(
      "Kühlschrank (Mischschrott)"
    );
    expect(kopfVon(ALLE.find((e) => e.name === "Doppel-T-Träger")!)).toContain(
      "Doppel-T-Träger (Stahlschrott)"
    );
  });

  it("schweigt, wo der Gegenstand schon alles sagt", () => {
    /*
     * „Ausser es ist bei dem Objekt schon klar, was es ist — eine Couch ist
     * Muell, da brauche ich keine Materialbeschreibung zu."
     *
     * Zwei Gruende, nie ein dritter: Abfall braucht keine Klasse, und ein
     * Name, der den Stoff schon nennt, braucht ihn nicht zweimal.
     */
    for (const n of ["Couch (Dreisitzer)", "Matratzenstapel", "Reifenhaufen", "Betonblock"]) {
      const kopf = kopfVon(ALLE.find((e) => e.name === n)!);
      expect(kopf, `${n} sollte ohne Klammer stehen`).toContain(`▼ ${n} ·`);
    }
    expect(kopfVon(ALLE.find((e) => e.name === "Alutafel")!)).toContain("▼ Alutafel ·");
    expect(kopfVon(ALLE.find((e) => e.name === "Kupferrohr-Bund")!)).toContain(
      "▼ Kupferrohr-Bund ·"
    );
  });

  it("der Waechter greift wirklich — die Regel unterscheidet die Faelle", () => {
    // Waeren beide Zweige gleich, stuende oben und hier dasselbe. Der
    // Gegenbeweis: derselbe Aufruf, zwei verschiedene Ergebnisse.
    const mitKlammer = kopfVon(ALLE.find((e) => e.name === "Fluggasttreppe")!);
    const ohneKlammer = kopfVon(ALLE.find((e) => e.name === "Matratzenstapel")!);
    expect(mitKlammer).toContain("(");
    expect(ohneKlammer.split(" · ")[0]).not.toContain("(");
  });

  it("nennt nirgends im Katalog eine Prozentzahl", () => {
    // „Dann sind mir die Anteile, zu wie viel Prozent das Mischschrott ist,
    // relativ egal." Auch nicht bei den 56 Stuecken mit Stueckliste.
    const mitProzent = ALLE.filter((e) => kopfVon(e).includes("%")).map((e) => e.name);
    expect(mitProzent).toEqual([]);
  });

  it("sagt beim Tragen nicht mehr, in welche Mulde es gehoert", () => {
    /*
     * „Ich brauche jetzt nicht die Info, ob ich das zum Mischschrott hinladen
     * soll oder zum Stahlschrott. … weil ich sehe es ja quasi, weil es gruen
     * aufleuchtet auf dem Feld."
     *
     * Der Parameter bleibt in der Signatur — die Zone wird weiter gemeldet,
     * nur nicht mehr geschrieben. Darum wird hier ausdruecklich MIT Zone
     * gerufen und geprueft, dass trotzdem nichts davon ankommt.
     */
    const z = griffLadung(
      [{ materialId: "steel", massKg: 180, shape: { name: "Doppel-T-Träger" } }],
      { container: "MISCHSCHROTT", ampel: "red" }
    );
    expect(z.kopf).toBe("Greifer: 180 kg");
    for (const wort of ["MISCHSCHROTT", "passt", "falsche Zone", "gemischt", "über", "›"])
      expect(z.kopf, `„${wort}" steht wieder im Kopf`).not.toContain(wort);
  });
});

/* ------------------------------------------------------------------------ */
/* Das Gewicht muss zum Stoff passen                                          */
/* ------------------------------------------------------------------------ */

describe("Kein Stueck wiegt mehr, als sein Stoff in seinem Volumen wiegen kann", () => {
  /*
   * Patrick, 15.09.2026: „Ganz oft sind Aluminium-Sachen, die haben dann zwei
   * Tonnen. Aber Aluminium ist ja leicht, das ist ja die Eigenschaft von
   * Aluminium." Gewicht ist einer seiner drei Erkennungskanaele fuer Alu
   * (neben Farbe und Zusammensetzung) — und ein Kanal, der luegt, ist keiner.
   *
   * Die Obergrenze ist keine Setzung: Ein Koerper von V Kubikmetern aus einem
   * Stoff der Dichte rho kann hoechstens rho x V wiegen. Alles darueber ist
   * unmoeglich, nicht bloss ungewoehnlich.
   */
  const grenze = (e: Eintrag): number =>
    feststoffdichte(leitstoff(e.spec).id) * huellVolumen(e.spec.kind, e.spec.dims);

  it("kein Katalogeintrag ueberschreitet die Feststoffdichte", () => {
    const zuSchwer = ALLE.filter((e) => e.spec.massKg > grenze(e) * 1.001).map(
      (e) => `${e.name}: ${e.spec.massKg} kg, moeglich waeren ${grenze(e).toFixed(0)} kg`
    );
    expect(zuSchwer).toEqual([]);
  });

  it("der Waechter greift wirklich — ein erfundener Alu-Wuerfel faellt durch", () => {
    // 0,4 x 0,3 x 0,2 m Aluminium = 0,024 m3 x 2700 = 65 kg. 1800 kg waeren
    // das Achtundzwanzigfache — genau Patricks „kleines Aluminiumteil mit 1,8
    // Tonnen".
    const moeglich = feststoffdichte("alu") * huellVolumen("box", [0.4, 0.3, 0.2]);
    expect(moeglich).toBeCloseTo(64.8, 1);
    expect(1800).toBeGreaterThan(moeglich);
  });

  it("ein Alupaket ist leichter als ein Stahlpaket gleicher Groesse (E-061)", () => {
    /*
     * Die Presse gab bis zum 15.09.2026 dem Alupaket die Dichte 1450 und dem
     * Stahlpaket 1250 — Alu war das SCHWERERE von beiden. Ein Alupaket von
     * 1,8 t mass damit 1,24 m3: der kleine, schwere Klotz aus Patricks Befund.
     *
     * Geprueft wird das Verhaeltnis, nicht die Zahl: Ein Paket packt sich auf
     * einen Anteil seines Feststoffs zusammen, und dieser Anteil darf bei Alu
     * nicht hoeher sein als bei Stahl.
     */
    const quelle = readFileSync(resolve(wurzel, "src/world/scrapItems.ts"), "utf8");
    const dichteVon = (frak: string): number => {
      const m = new RegExp(`^\\s*${frak}: \\{ dichte: (\\d+)`, "m").exec(quelle);
      if (!m) throw new Error(`Pressprofil ${frak} nicht gefunden`);
      return Number(m[1]);
    };
    const stahl = dichteVon("steel");
    const alu = dichteVon("alu");
    expect(alu, "ein Alupaket war schwerer als ein Stahlpaket").toBeLessThan(stahl);
    // Und zwar ungefaehr im Verhaeltnis der Feststoffe: 1250 x 2700/7850 = 430.
    const erwartet = stahl * (feststoffdichte("alu") / feststoffdichte("steel"));
    expect(alu).toBeGreaterThan(erwartet * 0.8);
    expect(alu).toBeLessThan(erwartet * 1.25);
  });

  it("der Deckel auf die Paketgroesse schneidet erst weit oben ab (E-061)", () => {
    /*
     * Die zweite Haelfte desselben Fehlers. Die Dichte allein genuegt nicht:
     * `spawnBale` deckelt das Volumen, und ein Deckel ist eine Luege in
     * Kilogramm — ueber ihm sieht jedes Paket gleich gross aus, egal wie
     * schwer es ist.
     *
     * Geprueft wird an Patricks Zahl: Ein Alupaket von 1,8 t muss deutlich
     * groesser werden als der Wuerfel von gut einem Meter, den er gesehen hat.
     */
    const quelle = readFileSync(resolve(wurzel, "src/world/scrapItems.ts"), "utf8");
    const m = /clamp\(massKg \/ \(profil\.dichte \* \(1 \+ streu\(0\.05\)\)\), 0\.1, ([\d.]+)\)/.exec(
      quelle
    );
    if (!m) throw new Error("Die Groessenrechnung in `spawnBale` steht nicht mehr da, wo sie stand");
    const deckel = Number(m[1]);
    const aluDichte = Number(/^\s*alu: \{ dichte: (\d+)/m.exec(quelle)![1]);
    const volumen = Math.min(1800 / aluDichte, deckel);
    expect(volumen, "ein Alupaket von 1,8 t bleibt ein kleiner schwerer Klotz").toBeGreaterThan(3.5);
    // Und die Kante bleibt unter der des Seecontainers (4,8 m), den es im
    // Katalog gibt — ein Paket soll ein Paket bleiben.
    expect(Math.cbrt(volumen) * 1.25).toBeLessThan(4.8);
  });
});


/* ------------------------------------------------------------------------ */
/* Die Ampel an der Mulde ist der letzte Kanal — sie muss zu sehen sein       */
/* ------------------------------------------------------------------------ */

describe("Die Ampel leuchtet auch aus der Naehe (E-061)", () => {
  const containers = readFileSync(resolve(wurzel, "src/world/containers.ts"), "utf8");

  it("das Schild blendet sich nicht aus, solange es ein Urteil traegt", () => {
    /*
     * Patrick, 15.09.2026: „Die Info brauche ich nicht, weil ich sehe es ja
     * quasi, weil es gruen aufleuchtet auf dem Feld." Genau darauf hin ist der
     * Zielhinweis aus dem HUD verschwunden — und damit haengt alles an diesem
     * Rahmen.
     *
     * Der Fehler, den das hier verhindert: `updateDistance` blendete das
     * Schild unter 4,5 m Kameraabstand vollstaendig aus. Wer die Spinne ueber
     * eine Mulde schwenkt, steht nah dran. Es gab also genau dann keine
     * Antwort, wenn man sie braucht.
     */
    expect(containers).toMatch(/this\.zeigtAmpel \? 1 : THREE\.MathUtils\.smoothstep\(d, 4\.5, 9\)/);
    // Und die Marke wird beim Zeichnen gesetzt, nicht irgendwo nebenbei.
    expect(containers).toContain("this.zeigtAmpel = ampel !== null;");
  });

  it("der Rahmen ist im Urteilsfall dreimal so dick wie sonst", () => {
    // Ein duenner Rahmen in Ampelfarbe ist aus zehn Metern kein Signal.
    expect(containers).toContain("ctx.lineWidth = ampel ? 12 : 4;");
  });

  it("die Fernausblendung bleibt — sonst kostet jedes Schild in jedem Bild Zeit", () => {
    expect(containers).toContain("1 - THREE.MathUtils.smoothstep(d, 38, 52)");
  });
});
