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

/** Eine Zentrale mit gestellter Uhr — sonst entscheidet die Rechenzeit mit. */
function zentrale(): { f: Funkzentrale; gehoert: Funkspruch[]; vor: (s: number) => void } {
  let t = 1000;
  const f = new Funkzentrale(() => t);
  const gehoert: Funkspruch[] = [];
  f.onSpruch = (s) => gehoert.push(s);
  return { f, gehoert, vor: (s: number) => (t += s) };
}

const RUHE = { loseKg: 0, spurBlockiert: false, lambertArbeitet: false };

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
    const { f, gehoert, vor } = zentrale();
    f.platzlage({ ...RUHE, lambertArbeitet: true });
    vor(30);
    f.platzlage({ ...RUHE, lambertArbeitet: true });
    vor(30);
    f.platzlage(RUHE); // Flanke: fertig
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
    const { f, gehoert, vor } = zentrale();
    f.platzlage({ ...RUHE, spurBlockiert: true });
    vor(10);
    f.platzlage({ ...RUHE, spurBlockiert: true });
    expect(gehoert.length, "er plappert dem HUD hinterher").toBe(0);
    vor(20); // zusammen 30 s — laenger als die Geduld
    f.platzlage({ ...RUHE, spurBlockiert: true });
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.anlass).toBe("spurLange");
    // genau einmal je Stoerfall
    vor(60);
    f.platzlage({ ...RUHE, spurBlockiert: true });
    expect(gehoert.length).toBe(1);
  });

  it("meldet losen Schrott erst ab der Schwelle und dann nicht wieder", () => {
    const { f, gehoert, vor } = zentrale();
    f.platzlage({ ...RUHE, loseKg: 1400 });
    expect(gehoert.length).toBe(0);
    vor(60);
    f.platzlage({ ...RUHE, loseKg: 1600 });
    expect(gehoert.length).toBe(1);
    expect(gehoert[0]!.anlass).toBe("vielLose");
    // knapp unter die Schwelle und wieder darueber: kein zweiter Spruch
    vor(60);
    f.platzlage({ ...RUHE, loseKg: 1400 });
    vor(60);
    f.platzlage({ ...RUHE, loseKg: 1600 });
    expect(gehoert.length).toBe(1);
    // erst wenn wirklich aufgeraeumt wurde, zaehlt es wieder
    vor(60);
    f.platzlage({ ...RUHE, loseKg: 500 });
    vor(60);
    f.platzlage({ ...RUHE, loseKg: 1600 });
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
