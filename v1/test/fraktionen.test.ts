/**
 * Wächter über die Sortierregel — und über den Abstand zwischen Schild und Kasse.
 *
 * Anlass (Patrick, 15.09.2026, nach dem Gerätetest): „Es ist nicht wirklich
 * erkennbar, was Stahlschrott ist und was Mischschrott ist. Auch die
 * Kategorisierung ist mir nicht ganz bewusst."
 *
 * Die Bestandsaufnahme dazu steht in `docs/fraktionen.md`. Sie hat zwei Löcher
 * gefunden, die dieser Wächter schließt:
 *
 *  1. `fraktionAus` und `SORTENREIN_AB` entscheiden für JEDES Teil im Spiel, ob
 *     es Stahlschrott oder Mischschrott ist — und hatten am 15.09.2026 **keinen
 *     einzigen Test**. Die Regel, an der Patricks Frage hängt, war ungewacht.
 *  2. Schild und Kasse rechnen verschieden (Befund W-1 bis W-10). Das ist NICHT
 *     behoben; dieser Wächter hält den Abstand als Zahl fest, damit er nicht
 *     stillschweigend wandert und damit auffällt, wenn ihn jemand schließt.
 *
 * Wo ein Abschnitt einen BEFUND festhält statt einer Soll-Eigenschaft, steht das
 * dabei. Solche Erwartungen sind grün, weil der Zustand heute so ist — sie
 * gehören angepasst, sobald der Befund behoben wird, und dann absichtlich.
 */
import { describe, it, expect } from "vitest";
import { MATERIALS, getMaterial } from "../src/materials/catalog";
import {
  SORTENREIN_AB,
  containerValueGemischt,
  fraktionAus,
  fraktionVonTeil,
  type Anteil,
} from "../src/materials/purity";
import { Account } from "../src/economy/account";
import { SPECS } from "../src/world/scrapItems";
import { KATALOG_BIG, KATALOG_HUGE, type PileSpec } from "../src/world/objektkatalog";
import { baueGeometrie } from "../src/world/objektbau";
import { CONFIGS, gehoertHierhin } from "../src/world/containers";
import { deltaEHex, pruefeDeltaE } from "../tools/farbabstand";

const ALLE: PileSpec[] = [...SPECS, ...KATALOG_BIG, ...KATALOG_HUGE];
const preis = (id: string): number => getMaterial(id).sellPricePerKg;

/** Verkauf ohne Physik — dieselben Stummel wie in `upgradeEffects.test.ts`. */
const items = { remove: () => {} } as never;
const comps = { despawnByBody: () => false } as never;
function verkauf(inhalt: Array<[string, number]>, order?: string | null): number {
  const ladung = inhalt.map(([materialId, massKg]) => ({
    materialId,
    massKg,
    body: null,
    composition: undefined,
  }));
  return new Account().sellContainer(ladung as never, items, comps, order ?? null).eur;
}
function schild(containerId: string, inhalt: Array<[string, number]>): number {
  const cfg = CONFIGS.find((c) => c.id === containerId);
  if (!cfg) throw new Error(`kein Behaelter ${containerId}`);
  return containerValueGemischt(inhalt, (m) => gehoertHierhin(cfg, m), preis);
}

/* ------------------------------------------------------------------------ */

describe("Die Regel: ab wann ist ein Teil sortenrein", () => {
  const a = (materialId: string, anteil: number): Anteil => ({ materialId, anteil });

  it("die Schwelle liegt bei 95 % und nirgends sonst", () => {
    expect(SORTENREIN_AB).toBe(0.95);
  });

  it("genau auf der Schwelle gilt noch als sortenrein", () => {
    expect(fraktionAus([a("steel", 0.95), a("plastic", 0.05)])).toBe("steel");
  });

  it("einen Hauch darunter ist es Mischschrott — das ist der Fehlerfall", () => {
    expect(fraktionAus([a("steel", 0.9499), a("plastic", 0.0501)])).toBe("mixed");
    // Und auch dann, wenn der Rest lächerlich klein verteilt ist.
    expect(fraktionAus([a("steel", 0.94), a("plastic", 0.03), a("wood", 0.03)])).toBe("mixed");
  });

  it("74 % Stahl sind Mischschrott — genau der Fall, der verwirrt", () => {
    // Kleinwagen-Karosserie, objektkatalog.ts:323
    expect(
      fraktionAus([
        a("steel", 0.74),
        a("plastic", 0.14),
        a("alu", 0.05),
        a("rubble", 0.04),
        a("copper", 0.03),
      ])
    ).toBe("mixed");
  });

  it("ohne Stückliste bleibt die Vorgabe stehen — auch das entscheidet mit", () => {
    expect(fraktionAus([], "va")).toBe("va");
    expect(fraktionAus([])).toBe("steel");
  });

  it("der größte gewinnt, nicht der erste", () => {
    expect(fraktionAus([a("steel", 0.02), a("copper", 0.98)])).toBe("copper");
  });

  it("die Regel gilt für jeden Stoff, nicht nur für Stahl", () => {
    expect(fraktionAus([a("alu", 0.96), a("steel", 0.04)])).toBe("alu");
    expect(fraktionAus([a("alu", 0.94), a("steel", 0.06)])).toBe("mixed");
  });
});

describe("Was der Katalog daraus macht", () => {
  /*
   * BEFUND (docs/fraktionen.md, 1.1): Fast alle Teile sind sortenrein, weil
   * niemand ihre Stückliste eingetragen hat — nicht, weil sie es wären. Diese
   * Zahlen halten den Stand fest. Wandern sie, hat jemand den Katalog
   * umgebaut, und dann gehört die Bestandsaufnahme nachgezogen.
   */
  it("327 erreichbare Einträge, davon 55 mit Stückliste", () => {
    // 271 waren es bis E-042; neun massive Kleinteile sind dazugekommen
    // (Bremsscheibe, Bahnschwelle, Schienenabschnitt, Kurbelwelle …), weil
    // Patricks eigene Premium-Beispiele im Katalog fehlten.
    //
    // 56 waren es bis E-061. Die Couch hat ihre Stückliste verloren und ist
    // damit Kunststoff statt Mischschrott — „eine Couch ist Müll, dann ist es
    // kein VA" (Patrick, 15.09.2026). Eine Stückliste, die aus Sperrmüll eine
    // Fraktion macht, die Geld bringt, ist rechnerisch richtig und sachlich
    // falsch.
    //
    // 280 waren es bis E-063. Dreiunddreissig sind dazugekommen: sechs Kupfer,
    // sechs Messing, fuenf Kabel, sechs VA, vier Zink, vier Batterien und zwei
    // Polstermoebel („Auffuellen, mindestens acht je Fraktion", 15.09.2026).
    // Keiner davon hat eine Stueckliste — es sind sortenreine Einzelteile, und
    // genau deshalb bleibt die zweite Zahl stehen.
    //
    // 313 waren es bis E-067. Vierzehn sind dazugekommen, als „Stoerstoff"
    // aufgeloest wurde (16.09.2026): acht Baumischabfall (die Fraktion hatte
    // in der Kleinteil-Klasse **null** Gegenstaende), vier Reifen, zwei Holz.
    // Keiner davon hat eine Stueckliste — ein Reifen ist ein Reifen —, und
    // genau deshalb bleibt die zweite Zahl stehen.
    expect(ALLE.length).toBe(327);
    expect(ALLE.filter((s) => s.zusammensetzung).length).toBe(55);
  });

  it("von den 55 werden 53 zu Mischschrott, genau 2 bleiben sortenrein", () => {
    const mitZus = ALLE.filter((s) => s.zusammensetzung);
    expect(mitZus.filter((s) => s.materialId === "mixed").length).toBe(53);
    const rein = mitZus.filter((s) => s.materialId !== "mixed").map((s) => s.name);
    expect(rein.sort()).toEqual(["Baggerlöffel", "Seecontainer 20 Fuß"]);
  });

  it("die abgeleitete Fraktion stimmt mit der Regel überein — bei jedem Eintrag", () => {
    // Der Fehlerfall wäre eine Liste, die nach dem Ableiten nicht mehr passt.
    // Seit E-042 ist die Regel `fraktionVonTeil` und nicht mehr `fraktionAus`:
    // Sie sieht auch Masse und Maß, nicht nur die Stückliste.
    for (const s of ALLE) {
      expect(fraktionVonTeil(s), s.name ?? "(ohne Namen)").toBe(s.materialId);
    }
  });

  it("derselbe Küchenherd, EINE Fraktion — der Widerspruch ist weg (E-042)", () => {
    /*
     * BEFUND BEHOBEN, und dieser Wächter ist dabei absichtlich rot geworden.
     *
     * Bis zum 15.09.2026 stand hier `herd === "steel"` und
     * `einbau === "mixed"`: derselbe Küchenherd, dieselbe Bauart, dieselbe
     * Farbe — und zwei Mulden, nur weil an einem Eintrag jemand eine
     * Stückliste getippt hatte und am anderen nicht. Seit die Regel aus Masse
     * und Maß rechnet, sind beide Blech (1,3 und 1,7 mm) und beide
     * Mischschrott.
     */
    const herd = ALLE.find((s) => s.name === "Elektroherd");
    const einbau = ALLE.find((s) => s.name === "Einbauherd mit Umluftofen");
    expect(herd?.materialId).toBe("mixed");
    expect(einbau?.materialId).toBe("mixed");
    expect(herd?.bau).toBe(einbau?.bau); // beide `weisseWare`, gleiche Farben
  });
});

describe("Jede Fraktion hat ein Ziel — und eine hat keins in Reichweite", () => {
  it("für jede Fraktion gibt es irgendwo einen Behälter", () => {
    for (const id of Object.keys(MATERIALS)) {
      const ziele = CONFIGS.filter((c) => gehoertHierhin(c, id));
      expect(ziele.length, `${id} hat nirgends ein Ziel`).toBeGreaterThan(0);
    }
  });

  it("jede Fraktion hat auch am Bagger ein Ziel — seit dem 15.09.2026 lückenlos", () => {
    /*
     * BEFUND V-6, behoben noch am selben Tag. Die ursprüngliche Fassung dieses
     * Wächters hielt den Mangel fest: Am Bagger stehen nur die Behälter ohne
     * `lager`, und wer eine Starterbatterie aus einem Wrack fischte, bekam dort
     * überall „falsche Zone" — derselbe offene Punkt, den VA bis zum Vormittag
     * desselben Tages hatte. Sie erwartete ausdrücklich `["battery"]` und trug
     * den Satz „wird das behoben, wird dieser Test rot, und dann gehört er
     * umgeschrieben, und zwar bewusst".
     *
     * Genau das ist passiert: E-029 hat Batterien in „BUNT + VA" gelegt
     * (Patricks Entscheidung, gegen die Empfehlung einer eigenen Mulde — die
     * Folgen lagen ihm vor). Beim Zusammenführen der beiden Pakete wurde dieser
     * Test rot, und das war die Meldung „der Mangel ist weg".
     *
     * Er bewacht jetzt die Lückenlosigkeit statt der Lücke. Fällt künftig eine
     * Fraktion am Bagger heraus, nennt er sie beim Namen.
     */
    const amBagger = CONFIGS.filter((c) => !c.lager);
    const ohneZiel = Object.keys(MATERIALS).filter(
      (id) => !amBagger.some((c) => gehoertHierhin(c, id))
    );
    expect(ohneZiel, `ohne Ziel am Bagger: ${ohneZiel.join(", ")}`).toEqual([]);
  });
});

describe("Schild und Kasse rechnen verschieden (Befund W-1 bis W-10)", () => {
  it("bei einer einzigen Fraktion stimmen sie überein", () => {
    // 760 kg Stahl, 240 kg Fremdes: Reinheit 76 %.
    const inhalt: Array<[string, number]> = [
      ["steel", 760],
      ["mixed", 240],
    ];
    expect(schild("c_steel", inhalt)).toBeCloseTo(109.744, 3);
    expect(verkauf(inhalt, "steel")).toBeCloseTo(109.744, 3);
  });

  it("BEFUND: bei einer Mulde mit mehreren Fraktionen um Faktor 87 auseinander", () => {
    const inhalt: Array<[string, number]> = [
      ["copper", 100],
      ["brass", 100],
      ["alu", 100],
      ["zinc", 100],
      ["cable", 100],
      ["va", 100],
    ];
    // Das Schild zählt alle sechs als „gehört hierhin" — 100 % rein.
    expect(schild("r_bunt", inhalt)).toBeCloseTo(1742, 2);
    // Die Kasse kennt `mitFraktionen` nicht: Kupfer dominiert, Reinheit 1/6.
    expect(verkauf(inhalt)).toBeCloseTo(20, 2);
  });

  it("BEFUND: auch die zusammengelegten Lagersilos liegen um das Sechsfache daneben", () => {
    const kupfer: Array<[string, number]> = [
      ["copper", 100],
      ["brass", 100],
    ];
    expect(schild("c_copper_lager", kupfer)).toBeCloseTo(1150, 2);
    expect(verkauf(kupfer)).toBeCloseTo(180, 2);

    const alu: Array<[string, number]> = [
      ["alu", 100],
      ["zinc", 100],
    ];
    expect(schild("c_alu_lager", alu)).toBeCloseTo(232, 2);
    expect(verkauf(alu)).toBeCloseTo(37.5, 2);
  });

  it("BEFUND W-9: gemischter Abfall kostet weniger Gebühr als sortenreiner", () => {
    /*
     * `containerValue` und `containerValueGemischt` fangen negative Preise
     * ausdrücklich ab; `sellContainer` nicht. Wer sauber trennt, zahlt mehr.
     */
    const rein: Array<[string, number]> = [["rubble", 400]];
    const gemischt: Array<[string, number]> = [
      ["rubble", 100],
      ["tires", 100],
      ["wood", 100],
      ["plastic", 100],
    ];
    expect(schild("r_rubble", gemischt)).toBeCloseTo(-17, 2);
    expect(verkauf(gemischt)).toBeCloseTo(-0.25, 2);
    // Sortenrein ist die Gebühr voll fällig — und damit 68-mal so hoch.
    expect(verkauf(rein)).toBeCloseTo(-16, 2);
    expect(verkauf(gemischt)).toBeGreaterThan(verkauf(rein));
  });

  it("BEFUND W-10: bei Gleichstand entscheidet die Ladereihenfolge", () => {
    const kupferZuerst: Array<[string, number]> = [
      ["copper", 100],
      ["alu", 100],
      ["zinc", 100],
      ["brass", 100],
      ["cable", 100],
    ];
    const aluZuerst: Array<[string, number]> = [
      ["alu", 100],
      ["zinc", 100],
      ["copper", 100],
      ["brass", 100],
      ["cable", 100],
    ];
    expect(verkauf(kupferZuerst)).toBeCloseTo(28.8, 2);
    expect(verkauf(aluZuerst)).toBeCloseTo(6, 2);
  });
});

describe("Die Farbe trägt die Fraktion nicht", () => {
  it("das Messwerkzeug misst richtig — gegen Sharma/Wu/Dalal (2005)", () => {
    /*
     * Zuerst das Werkzeug, dann die Messung. Am 14.09.2026 ist an diesem
     * Projekt ein Messwerkzeug weggeworfen worden, weil es falsch maß.
     */
    const p = pruefeDeltaE();
    expect(p.faelle).toBeGreaterThanOrEqual(16);
    expect(p.maxFehler).toBeLessThan(1e-4);
  });

  it("Stahlschrott und Mischschrott liegen unter ΔE 10", () => {
    const d = deltaEHex(MATERIALS.steel!.color, MATERIALS.mixed!.color);
    expect(d).toBeCloseTo(7.58, 1);
    expect(d, "über 10 wäre eine klar andere Farbe").toBeLessThan(10);
  });

  it("23 von 327 Teilen tragen die Fraktionsfarbe unmittelbar", () => {
    /*
     * Alles mit `bau` wird nach Zweck gefärbt (objektbau.ts:22-30).
     * 16 waren es bis E-042; Bremsscheibe und Großzahnrad sind absichtlich
     * ohne `bau` dazugekommen — zwei Stücke mehr, an denen man die
     * Fraktionsfarbe überhaupt sieht. 21 seit E-063: die drei neuen
     * Kupfer- und Kabelringe.
     *
     * Der BEFUND daran ist seit E-063 entschärft, aber nicht durch diese Zahl:
     * Buntmetall zeigt seine Farbe jetzt auch DURCH den Bau (`metallton` in
     * `objektbau.ts`). Ein Kupferkessel ist kupfern, obwohl er `bau: "tank"`
     * trägt. Was dieser Wächter zählt, ist nur noch der unmittelbare Weg.
     *
     * 23 seit dem 16.09.2026: LKW-Reifen und Erdbaureifen sind wie der
     * Traktorreifen nackte Ringe. Und `metallton` trägt seither auch die vier
     * Abfallsorten — ein Lattenrost-Stapel ist braun, ein Reifenstapel
     * schwarz (`test/abfall.test.ts`).
     */
    expect(ALLE.filter((s) => !s.bau).length).toBe(23);
  });

  it("Aluminium ist nicht mehr mit Edelstahl zu verwechseln (E-042)", () => {
    /*
     * Patrick am 15.09.2026: „Aluminium ist in den meisten Fällen grau."
     *
     * Der messbare Teil dahinter: Alu und VA lagen bei ΔE 6,98 — zwei Farben
     * unter 10 sind dieselbe Farbe, und die beiden gehen in VERSCHIEDENE
     * Silos. Zink darf dagegen nah sein: ALU-LAGER nimmt es mit.
     */
    const alu = MATERIALS.alu!.color;
    expect(deltaEHex(alu, MATERIALS.va!.color)).toBeGreaterThan(20);
    expect(deltaEHex(alu, MATERIALS.steel!.color)).toBeGreaterThan(15);
    expect(deltaEHex(alu, MATERIALS.mixed!.color)).toBeGreaterThan(15);
    // Und Alu muss dunkler sein als Zink, sonst ist es wieder das helle Blech.
    const hell = (c: number) => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);
    expect(hell(alu)).toBeLessThan(hell(MATERIALS.zinc!.color));
  });

  it("B-3 behoben: kein Bau liefert mehr ein Netz mit NaN-Ecken (E-063)", () => {
    /*
     * BEFUND bis E-063: `baueGeometrie` las `dims[1]` und `dims[2]`; bei
     * `kind: "wire"` hat `dims` aber nur EINEN Wert — den Kugelradius. Drei
     * Haufen (Ankerkette, Reifenhaufen, Stahlteile-Haufen) bekamen dadurch
     * `undefined` als Kantenlänge und ein Netz voller NaN. Der Kollider fing
     * das ab, das Netz nicht.
     *
     * Behoben, weil der neue „Datenkabel-Verhau" denselben Weg geht — und weil
     * ein Gegenstand, den man nicht sieht, die schärfste Form von „Aussehen und
     * Name gehen auseinander" ist. Bei `wire` ist die Kantenlänge jetzt der
     * Durchmesser.
     */
    const kaputt: string[] = [];
    let geprueft = 0;
    for (const s of ALLE) {
      if (!s.bau) continue;
      geprueft++;
      const t = baueGeometrie(s.bau, s.dims, s.kind);
      const p = t.koerper.getAttribute("position").array as Float32Array;
      if (!p.every((v) => Number.isFinite(v))) kaputt.push(s.name ?? "(ohne Namen)");
      t.koerper.dispose();
      t.glas?.dispose();
    }
    // Ohne diese Zeile wäre der Wächter grün, wenn die Schleife nichts fände.
    expect(geprueft).toBeGreaterThan(250);
    expect(kaputt.sort()).toEqual([]);
  });

  it("die Gegenprobe: ein `wire` mit einer einzigen Kante ergibt einen Würfel", () => {
    /*
     * Beweist, dass die Behebung wirkt und nicht bloß der Zufall. Ein Ballen
     * mit Radius 0,55 m muss 1,10 m Kantenlänge bekommen — und keine NaN.
     */
    const t = baueGeometrie("haufen", [0.55], "wire");
    const p = t.koerper.getAttribute("position").array as Float32Array;
    expect(p.every((v) => Number.isFinite(v))).toBe(true);
    let max = 0;
    for (let i = 0; i < p.length; i += 3) max = Math.max(max, Math.abs(p[i]!));
    expect(max).toBeGreaterThan(0.2);
    expect(max).toBeLessThan(0.75);
    t.koerper.dispose();
  });
});
