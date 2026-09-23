/**
 * DER TAG HAT EIN ENDE (E-113, 22.09.2026).
 *
 * Vier Wächter, einer je Zusage der Übergabe:
 *
 *  1. Der Tag endet zur richtigen Zeit — und die Zeit kommt aus der Uhr, die
 *     es schon gibt (`world/daylight.ts`), nicht aus einer zweiten.
 *  2. Die Sterne folgen den Schwellen, in BEIDE Richtungen geprüft: knapp
 *     darüber drei, knapp darunter zwei.
 *  3. Die Tageszähler stehen danach auf null, der Kontostand nicht.
 *  4. Die Sortierquote kommt aus einer Quelle — nachgerechnet und im
 *     Quelltext gegengelesen.
 *
 * Die Quelltextprüfungen sind KOMMENTARBLIND. Ein Wächter, der einen
 * Kommentartext durchsucht, wird von seinem eigenen Kommentar rot (teuer
 * gelernt am 15.09. und 17.09.2026).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  Shift,
  FEIERABEND_TIME,
  TORSCHLUSS_TIME,
  REIN_GUT,
  REIN_MITTEL,
  STERN_2_GEWINN_EUR,
  STERN_3_GEWINN_EUR,
  sterne,
  zufriedenheit,
} from "../src/economy/shift";
import { DAY_LENGTH_S, START_TIME } from "../src/world/daylight";
import { abrechnungszeilen, sterneZeile } from "../src/ui/abrechnung";
import { migrate, type SaveData } from "../src/core/save";

const wurzel = resolve(__dirname, "..");
const lies = (p: string): string => readFileSync(resolve(wurzel, p), "utf8");

/** Quelltext ohne Kommentare — Vorbild: `test/tagesablaufzeile.test.ts`. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// ------------------------------------------------------------------ 1. Die Zeit

describe("Der Tag endet zur richtigen Zeit", () => {
  /** Einen Tag durchlaufen lassen und die Tageszeiten sammeln, an denen es knackt. */
  function tagesLauf(): { torZuBei: number | null; feierabendBei: number | null } {
    const s = new Shift();
    s.starte(1000);
    let torZuBei: number | null = null;
    let feierabendBei: number | null = null;
    const schritt = 1 / 60;
    for (let time = START_TIME; time < 0.999; time += schritt / DAY_LENGTH_S) {
      s.update(schritt, 0, time);
      if (s.torZuFlanke) {
        s.torZuFlanke = false;
        torZuBei = time;
      }
      if (s.feierabendFlanke) {
        s.feierabendFlanke = false;
        feierabendBei = time;
      }
    }
    return { torZuBei, feierabendBei };
  }

  it("Torschluss um 17:00, Feierabend um 18:00", () => {
    const { torZuBei, feierabendBei } = tagesLauf();
    expect(torZuBei).not.toBeNull();
    expect(feierabendBei).not.toBeNull();
    // in Stunden nachgerechnet, damit die Zusage lesbar dasteht
    expect(torZuBei! * 24).toBeCloseTo(17, 1);
    expect(feierabendBei! * 24).toBeCloseTo(18, 1);
  });

  it("die Flanke kommt genau einmal, nicht in jedem Bild", () => {
    const s = new Shift();
    let feierabende = 0;
    for (let i = 0; i < 600; i++) {
      s.update(1 / 60, 0, FEIERABEND_TIME + 0.001);
      if (s.feierabendFlanke) {
        s.feierabendFlanke = false;
        feierabende++;
      }
    }
    expect(feierabende).toBe(1);
  });

  it("nach Torschluss kommt niemand mehr herein", () => {
    const s = new Shift();
    s.update(1, 0, TORSCHLUSS_TIME - 0.01);
    expect(s.acceptsDeliveries).toBe(true);
    s.update(1, 0, TORSCHLUSS_TIME + 0.001);
    expect(s.acceptsDeliveries).toBe(false);
    expect(s.statusText(0)).toContain("Tor zu");
  });

  it("ein Stand, der nach Feierabend geladen wird, bekommt seine Abrechnung sofort", () => {
    const s = new Shift();
    s.load({ t: 500, turnoverKg: 9000, pickups: 2, deliveries: 4, heuteKg: 3000, heuteReinKg: 2900 });
    s.update(1 / 60, 0, 0.8); // gespeichert war 19:12
    expect(s.feierabendFlanke).toBe(true);
  });

  it("vor Torschluss laeuft der Betrieb wie bisher weiter", () => {
    const s = new Shift();
    s.update(1, 0, 0.4);
    expect(s.feierabend).toBe(false);
    expect(s.torZu).toBe(false);
    expect(s.acceptsDeliveries).toBe(true);
  });

  /**
   * DIE UHR HAT EINE QUELLE. `economy/shift.ts` bekommt die Tageszeit gereicht
   * und vergleicht sie — es zählt keine eigene. Wäre hier eine zweite Uhr,
   * liefe sie irgendwann auseinander, und niemand wüsste, welche stimmt.
   */
  it("shift.ts fuehrt keine eigene Uhr", () => {
    const q = ohneKommentare(lies("src/economy/shift.ts"));
    expect(q, "shift.ts setzt eine eigene Tageszeit").not.toMatch(/timeOfDay\s*(\+|-)?=[^=]/);
    expect(q, "shift.ts kennt eine eigene Tageslaenge").not.toMatch(/DAY_LENGTH|900\s*;/);
    // und nimmt sie stattdessen entgegen
    expect(q).toMatch(/update\(dt: number, looseKg: number, timeOfDay\?: number\)/);
  });

  it("die Schicht passt in den Tag, den daylight.ts vorgibt", () => {
    expect(FEIERABEND_TIME).toBeGreaterThan(START_TIME);
    expect(TORSCHLUSS_TIME).toBeLessThan(FEIERABEND_TIME);
    // (0,75 − 0,28) × 900 s = 423 s ≈ 7 Minuten Echtzeit je Arbeitstag
    const schichtS = (FEIERABEND_TIME - START_TIME) * DAY_LENGTH_S;
    expect(schichtS).toBeCloseTo(423, 0);
    // und der Nachlauf bis Torschluss ist keine Wartezeit
    expect((FEIERABEND_TIME - TORSCHLUSS_TIME) * DAY_LENGTH_S).toBeCloseTo(37.5, 0);
  });
});

// ----------------------------------------------------------------- 2. Die Sterne

describe("Die Sterne folgen den Schwellen — in beide Richtungen", () => {
  const eps = 0.001;
  const faelle: Array<[number, number, 1 | 2 | 3, string]> = [
    [STERN_3_GEWINN_EUR, REIN_GUT, 3, "beides erreicht"],
    [STERN_3_GEWINN_EUR - 1, REIN_GUT, 2, "ein Euro zu wenig"],
    [STERN_3_GEWINN_EUR, REIN_GUT - eps, 2, "ein Promille zu unsauber"],
    [STERN_2_GEWINN_EUR, REIN_MITTEL, 2, "die mittlere Stufe genau getroffen"],
    [STERN_2_GEWINN_EUR - 1, REIN_GUT, 1, "sauber, aber nichts verdient"],
    [STERN_3_GEWINN_EUR * 2, REIN_MITTEL - eps, 1, "reich und zusammengekippt"],
    [-500, 1, 1, "Verlust bleibt ein Stern, nie null"],
  ];
  for (const [gewinn, quote, erwartet, warum] of faelle) {
    it(`${gewinn} EUR / ${(quote * 100).toFixed(1)} % → ${erwartet} (${warum})`, () => {
      expect(sterne(gewinn, quote)).toBe(erwartet);
    });
  }

  it("es gibt keinen vierten Stern und keinen nullten", () => {
    expect(sterne(1e9, 1)).toBe(3);
    expect(sterne(-1e9, 0)).toBe(1);
  });

  it("die Sternzeile nennt die Zahl auch in Worten (Farbe ist nie der einzige Kanal)", () => {
    expect(sterneZeile(3)).toContain("drei");
    expect(sterneZeile(3)).toContain("★★★");
    expect(sterneZeile(1)).toContain("ein");
    expect(sterneZeile(1)).toContain("★☆☆");
  });
});

// ------------------------------------------------- 3. Zaehler null, Konto nicht

describe("Nach der Abrechnung faengt der Tag bei null an — das Konto nicht", () => {
  function einTag(): Shift {
    const s = new Shift();
    s.starte(5000);
    s.deliveries = 9;
    s.noteTurnover(2000, 1);
    s.noteTurnover(1000, 0.5);
    s.update(60, 0, FEIERABEND_TIME);
    return s;
  }

  it("Tageszaehler auf null, Karrierezaehler und Tag laufen weiter", () => {
    const s = einTag();
    expect(s.heuteKg).toBe(3000);
    expect(s.turnoverKg).toBe(3000);
    s.naechsterTag(5900);
    expect(s.heuteKg).toBe(0);
    expect(s.heuteReinKg).toBe(0);
    expect(s.pickups).toBe(0);
    expect(s.deliveries).toBe(0);
    expect(s.t).toBe(0);
    expect(s.tag).toBe(2);
    expect(s.feierabend).toBe(false);
    expect(s.torZu).toBe(false);
    expect(s.acceptsDeliveries).toBe(true);
    // Der Ausbau haengt daran (15 t das Buero, 160 t der Kran) — diese Zahl
    // darf nie zurueckgesetzt werden, sonst waeren gekaufte Stufen gesperrt.
    expect(s.turnoverKg).toBe(3000);
  });

  it("der Gewinn des neuen Tages faengt beim Kontostand von heute Abend an", () => {
    const s = einTag();
    expect(s.bilanz(5900, 0.5).gewinnEur).toBe(900);
    s.naechsterTag(5900);
    expect(s.bilanz(5900, 0.5).gewinnEur).toBe(0);
    expect(s.bilanz(5900, 0.5).kontoEur).toBe(5900);
  });

  it("ohne bekannten Morgen ist der Gewinn null, nicht das Startkapital", () => {
    const s = new Shift(); // frisch geladen, kein starte()
    expect(s.bilanz(5000, 0.5).gewinnEur).toBe(0);
  });

  it("starte() ueberschreibt einen gespeicherten Morgen nicht", () => {
    const s = new Shift();
    s.load({ t: 0, turnoverKg: 0, pickups: 0, deliveries: 0, startKontoEur: 4000 });
    s.starte(4600); // Hochfahren mitten am Tag
    expect(s.bilanz(4600, 0.5).gewinnEur).toBe(600);
  });
});

// ------------------------------------------------------------ 4. Die Sortierquote

describe("Die Sortierquote kommt aus EINER Quelle", () => {
  it("nach Masse gewichtet, nicht je Fuhre gemittelt", () => {
    const s = new Shift();
    s.noteTurnover(9000, 1.0); // eine schwere, saubere Mulde
    s.noteTurnover(1000, 0.0); // eine leichte, voellig gemischte
    // je Fuhre gemittelt waeren es 50 %; nach Masse sind es 90 %
    expect(s.sortierquote).toBeCloseTo(0.9, 6);
  });

  it("ein Tag ohne Abfuhr gilt als sauber, nicht als Fehler", () => {
    expect(new Shift().sortierquote).toBe(1);
  });

  it("klemmt auf 0..1, auch wenn eine Reinheit ausserhalb gemeldet wird", () => {
    const s = new Shift();
    s.noteTurnover(1000, 1.4);
    expect(s.sortierquote).toBe(1);
    const t = new Shift();
    t.noteTurnover(1000, -0.3);
    expect(t.sortierquote).toBe(0);
  });

  it("ohne Reinheitsangabe gilt eine Fuhre als sauber (alte Aufrufe bleiben gueltig)", () => {
    const s = new Shift();
    s.noteTurnover(500);
    expect(s.sortierquote).toBe(1);
  });

  /**
   * Die Gegenlese: Niemand sonst rechnet diese Quote. Gesucht wird die
   * Division selbst — wer `heuteReinKg` durch `heuteKg` teilt, hat eine
   * zweite Quote gebaut, auch wenn sie dasselbe Ergebnis hätte.
   */
  it("niemand ausser shift.ts teilt die Reinmasse durch die Tagesmasse", () => {
    const dateien: string[] = [];
    const sammle = (dir: string): void => {
      for (const e of readdirSync(resolve(wurzel, dir))) {
        const p = `${dir}/${e}`;
        if (statSync(resolve(wurzel, p)).isDirectory()) sammle(p);
        else if (e.endsWith(".ts")) dateien.push(p);
      }
    };
    sammle("src");
    expect(dateien.length).toBeGreaterThan(20);
    for (const p of dateien) {
      if (p === "src/economy/shift.ts") continue;
      const q = ohneKommentare(lies(p));
      expect(q, `${p} rechnet die Sortierquote selbst`).not.toMatch(/heuteReinKg\s*\//);
    }
    // GEGENPROBE: in shift.ts steht sie wirklich
    expect(ohneKommentare(lies("src/economy/shift.ts"))).toMatch(/heuteReinKg \/ this\.heuteKg/);
  });

  /**
   * Die zwei Reinheitsschwellen stehen zweimal im Quelltext: in
   * `economy/shift.ts` (Stern) und in `ui/hud.ts` (Farbe der Ladezeile). Das
   * HUD darf nichts aus dem Wirtschaftsmodul importieren — der Wächter „die
   * Anzeige ruehrt den Kreislauf nicht an" (E-081) verbietet es. Also werden
   * die Zahlen hier gegeneinander gelesen, statt sie auseinanderlaufen zu
   * lassen: Die Ladezeile wird grün, wo der dritte Stern möglich wird.
   */
  it("HUD und Stern verwenden dieselben zwei Schwellen", () => {
    const hud = lies("src/ui/hud.ts");
    const zahl = (name: string): number => {
      const t = hud.match(new RegExp(`const ${name} = (0\\.\\d+);`));
      if (!t) throw new Error(`${name} steht nicht mehr in hud.ts`);
      return Number(t[1]);
    };
    expect(zahl("REIN_GUT")).toBe(REIN_GUT);
    expect(zahl("REIN_MITTEL")).toBe(REIN_MITTEL);
  });

  it("die Anzeige leitet sich von der Bilanz ab, sie rechnet nicht nach", () => {
    const q = ohneKommentare(lies("src/ui/abrechnung.ts"));
    expect(q).toMatch(/b\.sortierquote/);
    expect(q, "die Anzeige rechnet selbst").not.toMatch(/heuteReinKg|heuteKg\s*\//);
  });
});

// --------------------------------------------------------- Die Abrechnungstafel

describe("Das Abrechnungsbild", () => {
  const bilanz = (() => {
    const s = new Shift();
    s.starte(5000);
    s.deliveries = 7;
    s.noteTurnover(3200, 0.95);
    s.noteTurnover(1000, 0.6);
    return s.bilanz(5480, 0.62);
  })();

  it("zeigt sechs Zeilen — mehr passen auf dem iPhone mini quer nicht", () => {
    expect(abrechnungszeilen(bilanz)).toHaveLength(6);
  });

  it("nennt alle drei Kennzahlen aus Briefing Kap. 11", () => {
    const namen = abrechnungszeilen(bilanz).map((z) => z.name);
    expect(namen).toContain("Sortierquote");
    expect(namen).toContain("Gewinn");
    expect(namen).toContain("ø Zufriedenheit");
  });

  it("jede gefaerbte Zahl traegt auch ein Zeichen (Farbe ist nie der einzige Kanal)", () => {
    for (const z of abrechnungszeilen(bilanz)) {
      if (!z.farbe) continue;
      expect(z.wert, `„${z.name}" faerbt, sagt es aber nicht`).toMatch(/[✓!✗+−-]/);
    }
  });

  it("schreibt deutsche Zahlen: Tonnen mit Komma, Euro mit Punkt", () => {
    const zeilen = abrechnungszeilen(bilanz);
    expect(zeilen[0]!.wert).toBe("4,2 t");
    expect(zeilen.find((z) => z.name === "Gewinn")!.wert).toBe("+480 €");
    expect(zeilen.find((z) => z.name === "Kontostand")!.wert).toBe("5.480 €");
  });

  it("ein Verlust steht mit Vorzeichen da", () => {
    const s = new Shift();
    s.starte(5000);
    const zeilen = abrechnungszeilen(s.bilanz(4200, 0.5));
    expect(zeilen.find((z) => z.name === "Gewinn")!.wert).toContain("-800");
  });

  it("die Zufriedenheit kommt aus dem Ruf und aus keiner zweiten Zahl", () => {
    expect(zufriedenheit({ get: () => 0 })).toBe(0.5); // neutral ist die Mitte
    expect(zufriedenheit({ get: () => 100 })).toBe(1);
    expect(zufriedenheit({ get: () => -100 })).toBe(0);
  });
});

// ------------------------------------------------------------- Der Spielstand

describe("Ein Stand von mittags bekommt abends dieselbe Abrechnung", () => {
  it("Tageszahlen ueberleben Speichern und Laden", () => {
    const s = new Shift();
    s.starte(5000);
    s.deliveries = 4;
    s.noteTurnover(2500, 0.8);
    s.update(120, 0, 0.5);
    const b = new Shift();
    b.load(s.toJSON());
    expect(b.bilanz(5300, 0.5)).toEqual(s.bilanz(5300, 0.5));
    expect(b.heuteKg).toBe(2500);
    expect(b.tag).toBe(1);
  });

  it("ein Stand von vor dem 22.09.2026 laedt ohne Tageszahlen weiter", () => {
    const s = new Shift();
    s.load({ t: 300, turnoverKg: 42000, pickups: 3, deliveries: 6 });
    // turnoverKg war schon immer der Gesamtumschlag — der Ausbau bleibt frei
    expect(s.turnoverKg).toBe(42000);
    // und heute faengt bei null an, statt 42 t als Tagesleistung zu behaupten
    expect(s.heuteKg).toBe(0);
    expect(s.sortierquote).toBe(1);
    expect(s.tag).toBe(1);
    expect(s.bilanz(5000, 0.5).sterne).toBe(1);
  });

  it("die neuen Felder gehen durch die Spielstand-Migration hindurch", () => {
    const stand: SaveData = {
      schemaVersion: 2,
      savedAt: "2026-09-22T12:00:00Z",
      moneyEur: 5200,
      radio: { songId: "werkhof" },
      shift: {
        t: 200,
        turnoverKg: 12000,
        pickups: 2,
        deliveries: 5,
        heuteKg: 2000,
        heuteReinKg: 1700,
        tag: 3,
        startKontoEur: 4800,
      },
      items: [],
      cars: [],
      fencesBroken: [],
    };
    const d = migrate(JSON.parse(JSON.stringify(stand)));
    expect(d).not.toBeNull();
    const s = new Shift();
    s.load(d!.shift);
    expect(s.tag).toBe(3);
    expect(s.sortierquote).toBeCloseTo(0.85, 6);
    expect(s.bilanz(5200, 0.5).gewinnEur).toBe(400);
  });
});

// ------------------------------------------------------------- Die Verdrahtung

/**
 * DIE FEHLENDEN ZEILEN IN `main.ts`.
 *
 * Vorbild: `test/funk-verdrahtung.test.ts`. `main.ts` gehört diesem Paket
 * nicht (Patrick verdrahtet selbst), deshalb darf der Wächter heute grün sein
 * — aber nur, solange im Log ausdrücklich steht, dass der Einbau offen ist.
 * Wer einbaut, entfernt den Vermerk; wer den Vermerk entfernt, baut ein.
 */
describe("Der Feierabend haengt in main.ts", () => {
  const NOTNAGEL = "EINBAU OFFEN";
  const main = ohneKommentare(lies("src/main.ts"));
  /*
   * Das Log ist `docs/entscheidungen.md`, nicht mehr die Zwischendatei
   * `docs/_e113.md`: Agenten liefern ihren Eintrag einzeln ab, damit sich
   * mehrere Pakete an einem Abend nicht am Dateiende ins Gehege kommen, und
   * beim Zusammenfuehren wird angehaengt und die Zwischendatei geloescht.
   * Ein Waechter, der auf die Zwischendatei zeigt, wird also genau dann rot,
   * wenn alles richtig gelaufen ist (beobachtet 23.09.2026).
   */
  const log = lies("docs/entscheidungen.md");
  const teile: Array<[string, RegExp]> = [
    ["Uhrzeit in shift.update", /shift\.update\([^)]*daylight\.time/],
    ["Reinheit in noteTurnover", /shift\.noteTurnover\([^)]*purity/],
    ["Feld angemeldet", /installAbrechnung\(/],
    ["Takt in der Bildschleife", /abrechnung\.takt\(\)/],
    ["Simulation ruht im Abrechnungsbild", /paused \|\| abrechnung\.offen/],
    ["Bezugspunkt fuer den Gewinn", /shift\.starte\(/],
  ];
  const fehlt = teile.filter(([, r]) => !r.test(main)).map(([n]) => n);
  const verdrahtet = fehlt.length === 0;
  const vermerkt = log.includes(NOTNAGEL);

  it("entweder verdrahtet oder ausdruecklich als offen vermerkt — nie beides, nie keines", () => {
    expect(
      verdrahtet !== vermerkt,
      verdrahtet
        ? `Der Feierabend ist verdrahtet, aber steht im Log noch „${NOTNAGEL}".`
        : `Nicht in main.ts verdrahtet und kein Vermerk „${NOTNAGEL}". Fehlend: ${fehlt.join(", ")}`
    ).toBe(true);
  });

  it("die Abrechnung wird nach dem Bau genau einmal angemeldet", () => {
    expect((main.match(/installAbrechnung\(/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  /**
   * Glocke, Sterne und Funk hängen am Bus, nicht an der Spiellogik
   * (Projektregel 10). Das ist hier zu prüfen und nicht in main.ts: Die
   * Verdrahtung liegt vollständig in `ui/abrechnung.ts`.
   */
  it("Ton und Funk haengen am Ereignis, nicht an der Uhr", () => {
    const q = ohneKommentare(lies("src/ui/abrechnung.ts"));
    expect(q).toMatch(/bus\.on\("tag:feierabend"/);
    expect(q).toMatch(/bus\.on\("tag:torschluss"/);
    expect(q).toMatch(/bus\.on\("tag:neu"/);
    expect(q).toMatch(/playFeierabend\(\)/);
    expect(q).toMatch(/playSterne\(/);
    expect(q).toMatch(/funk\.torschluss\(\)/);
    expect(q).toMatch(/funk\.neuerTag\(\)/);
  });
});
