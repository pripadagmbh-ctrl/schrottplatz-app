/**
 * Waechter fuer die vier Fassons (E-093) und fuer die Taste MUSIK (E-094).
 *
 * Auftrag: „Techno, Rap, Schlager, Pop". Die Gefahr dabei steht im Auftrag
 * selbst: „Vier Sender, die alle gleich klingen, sind schlimmer als zwei, die
 * sich unterscheiden."
 *
 * Hoeren kann eine Pruefung nicht. Sie kann aber nachrechnen, WORIN sich zwei
 * Stuecke unterscheiden — und genau das passiert hier: Aus jedem Sender wird
 * ein Steckbrief aus sechs Merkmalen gezogen (Schlagzeugmuster, Tempo,
 * Tongeschlecht, Besetzung, Klangfarbe, Shuffle), und je zwei Sender muessen
 * sich in mindestens drei davon unterscheiden. Das ersetzt das Ohr nicht,
 * aber es faengt den Fall ab, dass jemand einen Sender kopiert und nur die
 * Melodie tauscht.
 *
 * Dazu die Merkmale, an denen man die einzelnen Fassons erkennt, jedes
 * einzeln festgenagelt.
 */
import { describe, it, expect } from "vitest";
import {
  BLUESROCK,
  POP,
  RAP,
  SCHLAGER,
  SENDER,
  STANDARD_SENDER,
  TECHNO,
  findeSender,
  type Song,
} from "../src/audio/songs";
import { naechsterSender, radioWeiter, senderListe } from "../src/ui/radio";

// ------------------------------------------------------------- Steckbrief

/** Die Schlaege, auf denen die Bassdrum sitzt — „—" heisst: gar keine. */
function kickMuster(s: Song): string {
  const kick = s.spuren.filter((p) => p.stimme === "kick");
  if (kick.length === 0) return "—";
  const schlaege = new Set<number>();
  for (const spur of kick) {
    for (const takt of spur.musterProTakt ?? [spur.muster ?? []]) {
      for (const t of takt) schlaege.add(t.schlag);
    }
  }
  return [...schlaege].sort((a, b) => a - b).join("|");
}

/** Dur oder Moll — am ersten Akkord der Schleife abgelesen. */
function geschlecht(s: Song): string {
  const a = s.akkorde[0]!;
  const terz = a.map((h) => ((h - a[0]!) % 12 + 12) % 12);
  if (terz.includes(4)) return "dur";
  if (terz.includes(3)) return "moll";
  return "offen";
}

function steckbrief(s: Song): string[] {
  return [
    `kick:${kickMuster(s)}`,
    `tempo:${Math.round(s.bpm / 10) * 10}`,
    `geschlecht:${geschlecht(s)}`,
    `besetzung:${[...new Set(s.spuren.map((p) => p.stimme))].sort().join(",")}`,
    `klang:${JSON.stringify(s.klang)}`,
    `shuffle:${s.shuffle > 0}`,
  ];
}

describe("Fuenf Sender, und man haelt sie auseinander", () => {
  it("die vier bestellten Fassons sind da und stehen im Kranz", () => {
    for (const s of [SCHLAGER, POP, TECHNO, RAP]) {
      expect(SENDER, `${s.sender} fehlt in der Senderliste`).toContain(s);
    }
    // Der Bluesrock von frueher bleibt: ihn wegzunehmen entscheidet Patrick.
    expect(SENDER).toContain(BLUESROCK);
    // Und der Schlager bleibt der Standard (Ansage Patrick, 14.09.2026).
    expect(SENDER[0]).toBe(SCHLAGER);
    expect(STANDARD_SENDER).toBe(SCHLAGER.id);
  });

  it("je zwei Sender unterscheiden sich in mindestens drei Merkmalen", () => {
    for (let i = 0; i < SENDER.length; i++) {
      for (let j = i + 1; j < SENDER.length; j++) {
        const a = steckbrief(SENDER[i]!);
        const b = steckbrief(SENDER[j]!);
        const anders = a.filter((m, k) => m !== b[k]!);
        expect(
          anders.length,
          `${SENDER[i]!.sender} und ${SENDER[j]!.sender} unterscheiden sich nur in ` +
            `${anders.length} Merkmal(en): ${anders.join(" · ")}`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("jeder Sender hat eine eigene Frequenz und eine eigene Kennung", () => {
    expect(new Set(SENDER.map((s) => s.id)).size).toBe(SENDER.length);
    expect(new Set(SENDER.map((s) => s.frequenz)).size).toBe(SENDER.length);
    expect(new Set(SENDER.map((s) => s.sender)).size).toBe(SENDER.length);
  });
});

describe("Woran man die einzelnen Fassons erkennt", () => {
  it("Techno: Bassdrum auf JEDEM Schlag — und nur er hat das", () => {
    expect(kickMuster(TECHNO)).toBe("0|1|2|3");
    for (const s of SENDER) {
      if (s === TECHNO) continue;
      expect(kickMuster(s), `${s.sender} stampft wie der Technosender`).not.toBe("0|1|2|3");
    }
    // Der Bass faellt in die Luecken, nie auf den Schlag — der Wechselschritt
    const bass = TECHNO.spuren.find((p) => p.stimme === "bass")!;
    for (const t of bass.muster!) expect(t.schlag % 1).toBeCloseTo(0.5, 6);
  });

  it("Rap: das langsamste Stueck im Kranz, mit deutlichem Abstand", () => {
    for (const s of SENDER) {
      if (s === RAP) continue;
      expect(
        s.bpm - RAP.bpm,
        `${s.sender} liegt zu dicht am Rap-Tempo`
      ).toBeGreaterThanOrEqual(20);
    }
    // Snare hart auf zwei und vier
    const snare = RAP.spuren.find((p) => p.stimme === "snare")!;
    expect(snare.muster!.map((t) => t.schlag)).toEqual([1, 3]);
    // und dumpf: oben ist bei 3000 Hz Schluss
    expect(RAP.klang.tiefpassHz!).toBeLessThanOrEqual(3200);
  });

  it("Pop: die gebrochene Achtelfigur laeuft durch, acht Toene je Takt", () => {
    const figur = POP.spuren.find(
      (p) => p.stimme === "zupf" && p.musterProTakt?.[0]?.length === 8
    );
    expect(figur, "die Arpeggio-Spur fehlt").toBeDefined();
    for (const takt of figur!.musterProTakt!) {
      expect(takt.map((t) => t.schlag)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
      // gebrochen heisst: nicht immer derselbe Ton
      expect(new Set(takt.map((t) => t.halbton)).size).toBeGreaterThan(2);
    }
  });

  it("Pop klingt breit, der Schlager klingt nach Kofferradio", () => {
    // Das ist der Unterschied, den man ohne Musikgehoer hoert.
    expect(SCHLAGER.klang.bandpass?.hz).toBe(1100);
    expect(POP.klang.bandpass).toBeUndefined();
    expect(POP.klang.tiefpassHz!).toBeGreaterThan(6000);
    // und nur der Schlager laeuft durch das Nadeloehr
    for (const s of SENDER) {
      if (s === SCHLAGER) continue;
      expect(s.klang.bandpass, `${s.sender} klingt auch nach Kofferradio`).toBeUndefined();
    }
  });

  it("kein Ton faellt aus dem Takt, und jede Spur hat ein Muster", () => {
    for (const s of [TECHNO, RAP, POP]) {
      for (const spur of s.spuren) {
        const takte = spur.musterProTakt ?? [spur.muster ?? []];
        expect(takte.length, `${s.sender}: Spur ohne Muster`).toBeGreaterThan(0);
        for (const takt of takte) {
          expect(takt.length).toBeGreaterThan(0);
          for (const t of takt) {
            expect(t.schlag).toBeGreaterThanOrEqual(0);
            expect(t.schlag).toBeLessThan(s.schlaegeProTakt);
            expect(t.laenge).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

// ------------------------------------------------- MUSIK schaltet weiter

/** Ein Radio zum Anfassen ohne Lautsprecher. */
interface Attrappe {
  musicOn: boolean;
  songId: string;
  toggleMusic(): boolean;
  setSong(id: string): boolean;
}

function attrappe(songId = STANDARD_SENDER, an = true): Attrappe {
  const t: Attrappe = {
    musicOn: an,
    songId,
    toggleMusic: (): boolean => {
      t.musicOn = !t.musicOn;
      return t.musicOn;
    },
    setSong: (id: string): boolean => {
      if (id === t.songId) return false;
      t.songId = id;
      return true;
    },
  };
  return t;
}

describe("Die Taste MUSIK dreht durch den Kranz", () => {
  it("geht der Reihe nach durch alle Sender und dann aus", () => {
    const t = attrappe();
    const gesehen: string[] = [t.songId];
    for (let i = 0; i < SENDER.length - 1; i++) {
      radioWeiter(t);
      expect(t.musicOn).toBe(true);
      gesehen.push(t.songId);
    }
    expect(gesehen).toEqual(SENDER.map((s) => s.id));
    // Nach dem letzten Sender: aus
    const ansage = radioWeiter(t);
    expect(t.musicOn).toBe(false);
    expect(ansage).toContain("aus");
  });

  it("nach dem Ausschalten steht die Wahl wieder am Anfang — keine Sackgasse", () => {
    const t = attrappe(SENDER.at(-1)!.id, true);
    radioWeiter(t); // aus
    expect(t.musicOn).toBe(false);
    expect(t.songId).toBe(STANDARD_SENDER);
    radioWeiter(t); // wieder an, mit dem Standard
    expect(t.musicOn).toBe(true);
    expect(t.songId).toBe(STANDARD_SENDER);
    // und von dort geht es weiter, nicht wieder aus
    radioWeiter(t);
    expect(t.musicOn).toBe(true);
    expect(t.songId).toBe(SENDER[1]!.id);
  });

  it("aus dem Stillstand macht ein Tipp Musik, kein Umschalten", () => {
    const t = attrappe(TECHNO.id, false);
    const ansage = radioWeiter(t);
    expect(t.musicOn).toBe(true);
    expect(t.songId).toBe(TECHNO.id); // derselbe Sender, der gewaehlt war
    expect(ansage).toContain(TECHNO.sender);
  });

  it("die Ansage nennt den Sender beim Namen, nicht nur die Farbe", () => {
    for (const s of SENDER) {
      const w = naechsterSender(s.id, false);
      expect(w.ansage).toContain(findeSender(w.songId).sender);
      expect(w.ansage).toContain(findeSender(w.songId).frequenz);
    }
  });

  it("das Menue zeigt alle fuenf Sender mit Zeichen, Wort und Beschreibung", () => {
    const liste = senderListe(TECHNO.id, true);
    expect(liste.length).toBe(SENDER.length);
    expect(liste.filter((e) => e.gewaehlt).length).toBe(1);
    for (const e of liste) {
      expect(e.marke.trim().length).toBeGreaterThan(0);
      expect(e.stand.length).toBeGreaterThan(0);
      expect(e.beschreibung.length).toBeGreaterThan(0);
    }
  });
});
