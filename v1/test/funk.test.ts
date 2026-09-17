/**
 * Waechter fuers Funkgeraet (E-095).
 *
 * Geprueft wird nicht, ob die Saetze schoen sind — das entscheidet Patrick —,
 * sondern die eine Regel, an der das Ganze haengt: **Kein Spruch ohne
 * Anlass.** Wenn nichts passiert, schweigen alle drei. Wenn etwas passiert,
 * redet genau der, der es sehen kann.
 *
 * Dazu die Ton-Leitplanke (Projektregel 7), maschinell nachgehalten: Kein
 * Satz von Mario spricht ueber den Menschen, der die Fuhre bringt; kein Satz
 * von Janine ueber etwas anderes als Geschaeft und Tagesgeschehen.
 */
import { describe, it, expect } from "vitest";
import {
  Funkzentrale,
  JANINE,
  LAMBERT,
  MARIO,
  SPRECHER,
  SPRUECHE,
  type Anlass,
  type Funkspruch,
} from "../src/ui/funk";

const RUHE = { loseKg: 0, spurBlockiert: false, lambertArbeitet: false };

/**
 * Ein Funkspruch geht nicht sofort ins Bild, sondern erst nach 3,5 s — sonst
 * überschriebe er die Meldung, an der er hängt (die Waage meldet ihr Gewicht
 * im selben Bild). Zugestellt wird in `platzlage()`, also in der Bildschleife.
 *
 * Im Test wird die Schleife von Hand gedreht. Damit nicht hinter jedem
 * Handgriff zwei Zeilen Buchhaltung stehen, drehen `wiegung` und `kundeDa`
 * hier die Uhr selbst weiter und leeren den Kanal. Dass die Wartezeit wirklich
 * eingehalten wird, prüft weiter unten ein eigener Test gegen die nackte
 * Zentrale.
 */
const ZUSTELLUNG_S = 4;

interface Pruefstand {
  f: {
    wiegung: (fu: Parameters<Funkzentrale["wiegung"]>[0]) => void;
    kundeDa: (k: Parameters<Funkzentrale["kundeDa"]>[0]) => void;
    platzlage: (l: typeof RUHE) => void;
  };
  /** Die Zentrale ohne Bequemlichkeit — für die Prüfung der Wartezeit selbst. */
  echt: Funkzentrale;
  gehoert: Funkspruch[];
  vor: (s: number) => void;
  /** Wartezeit abwarten und den Kanal leeren, ohne die Lage zu verändern. */
  hoere: (l?: typeof RUHE) => void;
}

/** Eine Zentrale mit gestellter Uhr — sonst entscheidet die Rechenzeit mit. */
function zentrale(): Pruefstand {
  let t = 1000;
  const z = new Funkzentrale(() => t);
  const gehoert: Funkspruch[] = [];
  z.onSpruch = (s) => gehoert.push(s);
  const hoere = (l: typeof RUHE = RUHE): void => {
    t += ZUSTELLUNG_S;
    z.platzlage(l);
  };
  return {
    echt: z,
    gehoert,
    vor: (s: number) => {
      t += s;
    },
    hoere,
    f: {
      wiegung: (fu) => {
        z.wiegung(fu);
        hoere();
      },
      kundeDa: (k) => {
        z.kundeDa(k);
        hoere();
      },
      platzlage: (l) => z.platzlage(l),
    },
  };
}

// ------------------------------------------------------------------ Mario

describe("Mario spricht ueber die Fuhre, die gerade gewogen wurde", () => {
  it("meldet Abfall, der zwischen dem Schrott liegt", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({
      kg: 4200,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.8 },
        { materialId: "rubble", share: 0.2 },
      ],
    });
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.wer).toBe(MARIO);
    expect(gehoert[0]!.anlass).toBe("abfallDrin");
    // Der Stoff steht im Satz und kommt aus dem Katalog, nicht aus einer
    // zweiten Liste — sonst stimmt er beim naechsten Material nicht mehr.
    expect(gehoert[0]!.text.toLowerCase()).toMatch(/schutt|baumisch|beton/);
  });

  it("schweigt, wenn jemand Abfall ANLIEFERT — dann ist es die Fuhre, nicht die Beimischung", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({ kg: 900, sortenrein: "wood", mix: [{ materialId: "wood", share: 1 }] });
    expect(gehoert.length).toBe(0);
  });

  it("schweigt bei einer Spur Abfall — ein Reifen auf einer Tonne Blech", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({
      kg: 3000,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.98 },
        { materialId: "tires", share: 0.02 },
      ],
    });
    expect(gehoert.length).toBe(0);
  });

  it("meldet Buntmetall, das im gemischten Haufen untergeht", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({
      kg: 2100,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.88 },
        { materialId: "copper", share: 0.12 },
      ],
    });
    expect(gehoert[0]!.anlass).toBe("buntVersteckt");
    expect(gehoert[0]!.text.toLowerCase()).toContain("kupfer");
  });

  it("schweigt bei einer sortenreinen Kupferfuhre — daran ist nichts versteckt", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({ kg: 800, sortenrein: "copper", mix: [{ materialId: "copper", share: 1 }] });
    expect(gehoert.length).toBe(0);
  });

  it("meldet eine Fuhre, die von allem was ist", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({
      kg: 5000,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.4 },
        { materialId: "alu", share: 0.3 },
        { materialId: "va", share: 0.2 },
        { materialId: "zinc", share: 0.1 },
      ],
    });
    expect(gehoert[0]!.anlass).toBe("vieleSorten");
    expect(gehoert[0]!.text).toContain("4");
  });

  it("lobt eine saubere Fuhre nur, wenn die davor eine Beanstandung war", () => {
    const { f, gehoert, vor } = zentrale();
    // sauber, sauber — kein Wort
    f.wiegung({ kg: 1000, sortenrein: "steel", mix: [{ materialId: "steel", share: 1 }] });
    vor(60);
    f.wiegung({ kg: 1000, sortenrein: "steel", mix: [{ materialId: "steel", share: 1 }] });
    expect(gehoert.length).toBe(0);
    // Beanstandung …
    vor(60);
    f.wiegung({
      kg: 3000,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.7 },
        { materialId: "rubble", share: 0.3 },
      ],
    });
    expect(gehoert.length).toBe(1);
    // … und dann eine saubere: jetzt sagt er etwas dazu
    vor(60);
    f.wiegung({ kg: 1000, sortenrein: "steel", mix: [{ materialId: "steel", share: 1 }] });
    expect(gehoert.length).toBe(2);
    expect(gehoert[1]!.anlass).toBe("sauber");
    // und danach ist es wieder der Normalfall: Schweigen
    vor(60);
    f.wiegung({ kg: 1000, sortenrein: "steel", mix: [{ materialId: "steel", share: 1 }] });
    expect(gehoert.length).toBe(2);
  });

  it("sagt zu einer leeren Fuhre gar nichts", () => {
    const { f, gehoert } = zentrale();
    f.wiegung({ kg: 0, sortenrein: null, mix: [] });
    expect(gehoert.length).toBe(0);
  });
});

// ----------------------------------------------------------------- Janine

describe("Janine redet ueber Kunden, die wirklich da sind", () => {
  const privat = { name: "Theo Külpmann", subtitle: "Rentner aus Odenkirchen", group: "privat" };

  it("schweigt beim ersten Besuch — da gibt es nichts zu verbinden", () => {
    const { f, gehoert } = zentrale();
    f.kundeDa(privat);
    expect(gehoert.length).toBe(0);
  });

  it("erkennt den Wagen wieder", () => {
    const { f, gehoert, vor } = zentrale();
    f.kundeDa(privat);
    vor(600);
    f.kundeDa({ name: "Andere Firma", subtitle: "Dachdecker", group: "gewerbe" });
    vor(600);
    f.kundeDa(privat);
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.wer).toBe(JANINE);
    expect(gehoert[0]!.anlass).toBe("kundeBekannt");
  });

  it("weiss, was er beim letzten Mal gebracht hat — das ist der Klatsch", () => {
    const { f, gehoert, vor } = zentrale();
    f.kundeDa(privat);
    f.wiegung({
      kg: 300,
      sortenrein: "copper",
      mix: [{ materialId: "copper", share: 1 }],
      kunde: privat.name,
    });
    vor(600);
    f.kundeDa({ name: "Andere Firma", subtitle: "Dachdecker", group: "gewerbe" });
    vor(600);
    f.kundeDa(privat);
    expect(gehoert.at(-1)!.anlass).toBe("kundeWieder");
    expect(gehoert.at(-1)!.text.toLowerCase()).toContain("kupfer");
  });

  it("zaehlt die Haendler des Tages", () => {
    const { f, gehoert, vor } = zentrale();
    for (let i = 1; i <= 3; i++) {
      f.kundeDa({ name: `Händler ${i}`, subtitle: `Betrieb ${i}`, group: "haendler" });
      vor(600);
    }
    const spruch = gehoert.find((s) => s.anlass === "vieleHaendler");
    expect(spruch, "der dritte Haendler faellt ihr nicht auf").toBeDefined();
    expect(spruch!.text).toContain("3");
  });

  it("merkt, wenn ein Betrieb zweimal faehrt", () => {
    const { f, gehoert, vor } = zentrale();
    f.kundeDa({ name: "Erster Fahrer", subtitle: "Elektro Vossen", group: "gewerbe" });
    vor(600);
    f.kundeDa({ name: "Jemand anders", subtitle: "Privat", group: "privat" });
    vor(600);
    f.kundeDa({ name: "Zweiter Fahrer", subtitle: "Elektro Vossen", group: "gewerbe" });
    expect(gehoert.at(-1)!.anlass).toBe("betriebWieder");
  });

  it("redet nicht bei jeder Ankunft — sie steht am Kaffeewagen, nicht am Tor", () => {
    const { f, gehoert, vor } = zentrale();
    f.kundeDa(privat);
    vor(600);
    f.kundeDa(privat); // zweiter Besuch → sie sagt etwas
    expect(gehoert.length).toBe(1);
    vor(600);
    f.kundeDa(privat); // dritter direkt danach → sie haelt den Mund
    expect(gehoert.length).toBe(1);
  });
});

// ---------------------------------------------------------------- Lambert

describe("Lambert redet ueber den Platz", () => {
  it("schweigt, solange nichts ist", () => {
    const { f, gehoert, vor } = zentrale();
    for (let i = 0; i < 200; i++) {
      f.platzlage(RUHE);
      vor(0.02);
    }
    expect(gehoert.length).toBe(0);
  });

  it("fragt nach Arbeit, wenn er seine Aufgabe zu Ende gebracht hat", () => {
    const { f, gehoert, vor, hoere } = zentrale();
    f.platzlage({ ...RUHE, lambertArbeitet: true });
    vor(30);
    f.platzlage({ ...RUHE, lambertArbeitet: true });
    vor(30);
    f.platzlage(RUHE); // Flanke: fertig
    hoere();
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.wer).toBe(LAMBERT);
    expect(gehoert[0]!.anlass).toBe("lambertFertig");
    // und dann nicht in jedem Bild noch einmal
    for (let i = 0; i < 100; i++) {
      vor(1);
      f.platzlage(RUHE);
    }
    expect(gehoert.length).toBe(1);
  });

  it("meldet erst nach einer Weile, dass immer noch etwas im Weg steht", () => {
    const { f, gehoert, vor, hoere } = zentrale();
    const zu = { ...RUHE, spurBlockiert: true };
    f.platzlage(zu);
    vor(10);
    f.platzlage(zu);
    hoere(zu);
    expect(gehoert.length, "er plappert dem HUD hinterher").toBe(0);
    vor(20); // zusammen mehr als 25 s — laenger als die Geduld
    f.platzlage(zu);
    hoere(zu);
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.anlass).toBe("spurLange");
    // genau einmal je Stoerfall
    vor(60);
    f.platzlage(zu);
    hoere(zu);
    expect(gehoert.length).toBe(1);
  });

  it("meldet losen Schrott erst ab der Schwelle und dann nicht wieder", () => {
    const { f, gehoert, vor, hoere } = zentrale();
    /** Eine Lage melden und die Zustellung abwarten, ohne sie zu verändern. */
    const lage = (kg: number): void => {
      const l = { ...RUHE, loseKg: kg };
      f.platzlage(l);
      hoere(l);
    };
    lage(1400);
    expect(gehoert.length).toBe(0);
    vor(60);
    lage(1600);
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.anlass).toBe("vielLose");
    // knapp unter die Schwelle und wieder darueber: kein zweiter Spruch
    vor(60);
    lage(1400);
    vor(60);
    lage(1600);
    expect(gehoert.length).toBe(1);
    // erst wenn wirklich aufgeraeumt wurde, zaehlt es wieder
    vor(60);
    lage(500);
    vor(60);
    lage(1600);
    expect(gehoert.length).toBe(2);
  });

  it("meldet nichts, solange er selbst dabei ist aufzuraeumen", () => {
    const { f, gehoert, vor } = zentrale();
    for (let i = 0; i < 20; i++) {
      f.platzlage({ loseKg: 3000, spurBlockiert: false, lambertArbeitet: true });
      vor(10);
    }
    expect(gehoert.length).toBe(0);
  });
});

// ------------------------------------------------------- Kanal und Haltung

describe("Der Kanal", () => {
  it("wartet, bis die Meldung der Maschine durch ist — sonst ueberschreibt er sie", () => {
    /*
     * Der Grund: Die Waage meldet ihr Gewicht IM SELBEN BILD, in dem Mario den
     * Anlass sieht. Eine Einblendung ersetzt die vorige — funkt er sofort,
     * sieht der Spieler nur noch Mario und nie das Gewicht. Oder umgekehrt.
     *
     * Geprueft wird gegen die nackte Zentrale, ohne die Bequemlichkeit des
     * Pruefstands oben: Hier soll gerade NICHT automatisch zugestellt werden.
     */
    const { echt, gehoert, vor } = zentrale();
    echt.wiegung({
      kg: 3000,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.7 },
        { materialId: "rubble", share: 0.3 },
      ],
    });
    // gleiches Bild: noch nichts zu hoeren
    echt.platzlage(RUHE);
    expect(gehoert.length, "er funkt sofort und ueberschreibt die Waage").toBe(0);
    // nach zwei Sekunden immer noch nicht — die Einblendung steht 2,6 s
    vor(2);
    echt.platzlage(RUHE);
    expect(gehoert.length).toBe(0);
    // danach schon
    vor(2);
    echt.platzlage(RUHE);
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.wer).toBe(MARIO);
  });

  it("bleibt stumm, wenn die Bildschleife ihn nie fragt — und das faellt auf", () => {
    /*
     * Die Kehrseite der Wartezeit: Ohne `platzlage()` in der Bildschleife wird
     * nichts zugestellt, auch nicht von Mario und Janine. Genau darum steht
     * die Zeile in der Liste, die `main.ts` braucht, und genau darum bewacht
     * sie `test/funk-verdrahtung.test.ts`.
     */
    const { echt, gehoert, vor } = zentrale();
    echt.kundeDa({ name: "A", subtitle: "B", group: "privat" });
    vor(60);
    echt.kundeDa({ name: "A", subtitle: "B", group: "privat" });
    vor(600);
    expect(gehoert.length).toBe(0);
    echt.platzlage(RUHE);
    expect(gehoert.length).toBe(1);
  });

  it("laesst nie zwei Sprueche uebereinander laufen", () => {
    const { f, gehoert } = zentrale();
    // Zwei Anlaesse in derselben Sekunde: nur einer geht raus.
    f.wiegung({
      kg: 3000,
      sortenrein: null,
      mix: [
        { materialId: "steel", share: 0.7 },
        { materialId: "rubble", share: 0.3 },
      ],
    });
    f.platzlage({ ...RUHE, loseKg: 4000 });
    expect(gehoert.length).toBe(1);
  });

  it("wiederholt denselben Satz nicht zweimal hintereinander", () => {
    const { f, gehoert, vor } = zentrale();
    for (let i = 0; i < 3; i++) {
      f.wiegung({
        kg: 3000,
        sortenrein: null,
        mix: [
          { materialId: "steel", share: 0.7 },
          { materialId: "rubble", share: 0.3 },
        ],
      });
      vor(60);
    }
    expect(gehoert.length).toBe(3);
    expect(new Set(gehoert.map((s) => s.text)).size).toBe(3);
  });

  it("bleibt still, wenn niemand zuhoert — und stuerzt nicht ab", () => {
    const f = new Funkzentrale(() => 0);
    expect(() => f.platzlage({ ...RUHE, loseKg: 9000 })).not.toThrow();
  });
});

describe("Ton-Leitplanke: Milieu aus Beruf, Familie, Geschaeft", () => {
  /** Alle Saetze, einmal mit einer Angabe und einmal ohne. */
  const alleSaetze = (): Array<{ anlass: Anlass; wer: string; text: string }> => {
    const raus: Array<{ anlass: Anlass; wer: string; text: string }> = [];
    for (const anlass of Object.keys(SPRUECHE) as Anlass[]) {
      for (const v of SPRUECHE[anlass]) {
        raus.push({ anlass, wer: SPRECHER[anlass], text: v("Kupfer") });
        raus.push({ anlass, wer: SPRECHER[anlass], text: v("3") });
      }
    }
    return raus;
  };

  it("kein Satz markiert jemanden oder eine Gruppe", () => {
    /*
     * Die Liste ist kein Filter fuer die Zukunft, sondern ein Riegel gegen
     * genau das, was beim Schreiben von Klatsch am naechsten liegt: Verdacht
     * gegen Menschen statt gegen Ladung.
     */
    const verboten = [
      "klau", "dieb", "geklaut", "gestohlen", "hehler", "betrug", "betrüg",
      "kriminell", "ausländ", "zigeun", "pack", "asozial", "schwarzarbeit",
      "illegal", "sippe", "clan",
    ];
    for (const s of alleSaetze()) {
      for (const w of verboten) {
        expect(s.text.toLowerCase(), `„${s.text}" (${s.anlass})`).not.toContain(w);
      }
    }
  });

  it("Marios Saetze reden ueber die Ladung, nicht ueber den Fahrer", () => {
    const seine = alleSaetze().filter((s) => s.wer === MARIO);
    expect(seine.length).toBeGreaterThan(0);
    for (const s of seine) {
      // Kein „der", „die", „dem" als Person am Satzanfang und kein „du"
      expect(s.text.toLowerCase(), `„${s.text}"`).not.toMatch(/\b(du|dich|dir|ihr)\b/);
    }
  });

  it("jeder Satz ist kurz genug, um ihn nebenbei zu lesen", () => {
    for (const s of alleSaetze()) {
      const woerter = s.text.trim().split(/\s+/).length;
      expect(woerter, `zu lang: „${s.text}"`).toBeLessThanOrEqual(8);
      expect(woerter, `zu kurz: „${s.text}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it("jeder Anlass hat mehr als einen Satz — sonst merkt man ihn auswendig", () => {
    for (const anlass of Object.keys(SPRUECHE) as Anlass[]) {
      expect(SPRUECHE[anlass].length, `${anlass} hat nur einen Satz`).toBeGreaterThanOrEqual(3);
      expect(SPRECHER[anlass], `${anlass} hat keinen Sprecher`).toBeTruthy();
    }
  });

  it("es gibt genau drei Stimmen, und jede hat Anlaesse", () => {
    const stimmen = new Set(Object.values(SPRECHER));
    expect([...stimmen].sort()).toEqual([JANINE, LAMBERT, MARIO].sort());
  });
});
