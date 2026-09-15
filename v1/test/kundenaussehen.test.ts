/**
 * DER TON-WÄCHTER FÜRS AUSSEHEN.
 *
 * Projektregel 7: „Milieu aus Beruf, Familie, Geschäft — nie aus Herkunft.
 * Keine Gruppe wird als kriminell markiert." Bei Sprüchen kann man das lesen.
 * Bei Figuren nicht: Ob über 23 Kunden hinweg alle Öligen zufällig auch die
 * Harten sind, sieht kein Mensch beim Durchscrollen — das muss man ausrechnen.
 *
 * Dieser Wächter rechnet es aus. Er verlangt:
 *
 *   1. Kein stufenloses Merkmal (Größe, Fülle, Pflege, Warnweste) hängt am
 *      Härtegrad.
 *   2. Keine Gruppe hat einen anderen Mittelwert — und keine deckt nur die
 *      Mitte der Spanne ab. In jeder Gruppe gibt es Kleine und Lange, Dünne
 *      und Dicke, Gepflegte und Ölige.
 *   3. Kein Hautton, keine Haarfarbe und kein Wiedererkennungsmerkmal ist auf
 *      eine Gruppe beschränkt oder sagt etwas über den Härtegrad.
 *
 * UND DIE GEGENPROBE. Ein Wächter, der nie rot werden kann, bewacht nichts
 * (dieselbe Lehre wie in `kundenprofil.test.ts`, E-062). Deshalb steht unter
 * jeder Prüfung eine absichtlich verdorbene Kundschaft, die gemeldet werden
 * MUSS — und zwar mit dem richtigen Merkmal und dem richtigen Bezug, nicht nur
 * irgendwie.
 */
import { describe, it, expect } from "vitest";
import {
  aussehensBefunde,
  korrelation,
  groesseNormiert,
  HAUTTOENE,
  HAARTOENE,
  JACKENTOENE,
  MERKMALE,
  STATUR_KLEIN,
  STATUR_LANG,
  type KundenEintrag,
} from "../src/delivery/aussehen";
import {
  alleKunden,
  FAMILIES,
  TRADES,
  PRIVATLEUTE,
  rollCustomer,
  HAERTE_GEWERBE,
  HAERTE_PRIVAT,
} from "../src/delivery/customers";

const KUNDEN = alleKunden();

/** Die Kundschaft mit einer eingebauten Korrelation — für die Gegenproben. */
function verdorben(f: (k: KundenEintrag, i: number) => KundenEintrag): KundenEintrag[] {
  return KUNDEN.map((k, i) => f({ ...k, aussehen: { ...k.aussehen } }, i));
}

function befundeZu(liste: KundenEintrag[], merkmalStartsWith: string, bezug: string): string[] {
  return aussehensBefunde(liste)
    .filter((b) => b.merkmal.startsWith(merkmalStartsWith) && b.bezug === bezug)
    .map((b) => b.text);
}

describe("Die Kundschaft ist vollzählig und hat ein Gesicht", () => {
  it("23 Kunden in drei Gruppen", () => {
    expect(FAMILIES.length, "Händlerfamilien").toBe(8);
    expect(TRADES.length, "Betriebe").toBe(7);
    expect(PRIVATLEUTE.length, "Privatleute").toBe(8);
    expect(KUNDEN.length).toBe(23);
  });

  it("jeder Name kommt genau einmal vor", () => {
    const namen = KUNDEN.map((k) => k.name);
    expect(new Set(namen).size, `doppelt: ${namen.join(", ")}`).toBe(namen.length);
  });

  it("jedes Aussehen ist in sich gültig", () => {
    for (const k of KUNDEN) {
      const a = k.aussehen;
      expect(a.groesse, `${k.name} Größe`).toBeGreaterThanOrEqual(STATUR_KLEIN);
      expect(a.groesse, `${k.name} Größe`).toBeLessThanOrEqual(STATUR_LANG);
      for (const [feld, wert] of [
        ["fuelle", a.fuelle],
        ["pflege", a.pflege],
      ] as const) {
        expect(wert, `${k.name} ${feld}`).toBeGreaterThanOrEqual(0);
        expect(wert, `${k.name} ${feld}`).toBeLessThanOrEqual(1);
      }
      expect(HAUTTOENE[a.haut], `${k.name} Hautton ${a.haut}`).toBeDefined();
      expect(HAARTOENE[a.haar], `${k.name} Haarfarbe ${a.haar}`).toBeDefined();
      expect(JACKENTOENE[a.jacke], `${k.name} Jacke ${a.jacke}`).toBeDefined();
      expect(MERKMALE, `${k.name} Merkmal`).toContain(a.merkmal);
    }
  });

  it("die gewürfelte Kundschaft trägt das Aussehen ihres Namens mit sich", () => {
    /*
     * Die Probe auf „keine zweite Liste": Wer aus `rollCustomer()` kommt, muss
     * DASSELBE Aussehen haben wie sein Eintrag in FAMILIES/TRADES/PRIVATLEUTE.
     * Hätte `rollCustomer` sich irgendwo ein eigenes gewürfelt, käme hier ein
     * anderes heraus.
     */
    const nachName = new Map(KUNDEN.map((k) => [k.name, k.aussehen]));
    let geprueft = 0;
    for (let i = 0; i < 400; i++) {
      const c = rollCustomer();
      // Händler heißen im Profil nur mit Vornamen, Familie steht im Untertitel
      const voll = c.group === "haendler" ? `${c.name} ${c.subtitle}` : c.name;
      const soll = nachName.get(voll);
      expect(soll, `kein Datensatz zu "${voll}"`).toBeDefined();
      expect(c.aussehen, voll).toEqual(soll);
      geprueft++;
    }
    expect(geprueft).toBe(400);
  });

  it("der Härtegrad steht nur an einer Stelle", () => {
    for (let i = 0; i < 200; i++) {
      const c = rollCustomer();
      if (c.group === "gewerbe") expect(c.hardness).toBe(HAERTE_GEWERBE);
      if (c.group === "privat") expect(c.hardness).toBe(HAERTE_PRIVAT);
    }
    expect(KUNDEN.filter((k) => k.gruppe === "gewerbe").every((k) => k.haerte === HAERTE_GEWERBE));
    expect(KUNDEN.filter((k) => k.gruppe === "privat").every((k) => k.haerte === HAERTE_PRIVAT));
  });
});

describe("Aus dem Aussehen ist nichts abzulesen", () => {
  it("die ganze Kundschaft kommt ohne einen einzigen Befund durch", () => {
    const befunde = aussehensBefunde(KUNDEN);
    expect(befunde.map((b) => b.text).join("\n"), "Ton-Leitplanke verletzt").toBe("");
  });

  /* ------------------------------------------------ Gegenproben ---------- */

  it("GEGENPROBE: Pflegegrad am Härtegrad wird gemeldet", () => {
    /*
     * Das Klischee, um das es geht: „Wer ölig aussieht, feilscht." Hier wird
     * es absichtlich eingebaut — Pflege = 1 minus Härte. Wenn der Wächter das
     * durchgehen lässt, bewacht er nichts.
     */
    const schief = verdorben((k) => {
      k.aussehen.pflege = 1 - (k.haerte - 1) / 4;
      return k;
    });
    const texte = befundeZu(schief, "pflege", "haerte");
    expect(texte.length, "nicht gemeldet").toBeGreaterThan(0);
    const r = korrelation(
      schief.map((k) => k.aussehen.pflege),
      schief.map((k) => k.haerte)
    );
    expect(Math.abs(r), "die eingebaute Korrelation ist tatsächlich stark").toBeGreaterThan(0.95);
  });

  it("GEGENPROBE: Statur an der Gruppe wird gemeldet", () => {
    // „Händler sind die Dicken." Alle Händler auf 0,95, alle anderen auf 0,05.
    const schief = verdorben((k) => {
      k.aussehen.fuelle = k.gruppe === "haendler" ? 0.95 : 0.05;
      return k;
    });
    expect(befundeZu(schief, "fuelle", "gruppe").length, "nicht gemeldet").toBeGreaterThan(0);
  });

  it("GEGENPROBE: eine Gruppe ohne Ausreißer wird gemeldet", () => {
    /*
     * Der heimtückische Fall: Der MITTELWERT stimmt, nur die Spanne nicht —
     * alle Privatleute liegen zwischen 0,45 und 0,55. Am Bildschirm hieße das
     * „Privatleute sind alle gleich groß", und das ist genauso ein Muster.
     */
    const schief = verdorben((k, i) => {
      if (k.gruppe === "privat") k.aussehen.groesse = 1.74 + (i % 2) * 0.02;
      return k;
    });
    const texte = befundeZu(schief, "groesse", "gruppe");
    expect(texte.join("\n"), "nicht gemeldet").toMatch(/Spanne/);
  });

  it("GEGENPROBE: ein Hautton nur in einer Gruppe wird gemeldet", () => {
    /*
     * DER FALL, WEGEN DEM DIESER WÄCHTER ÜBERHAUPT EXISTIERT. Hautfarbe darf
     * mit gar nichts zusammenhängen — und wenn doch, muss es lautstark
     * auffallen, nicht in einer Tabelle versickern.
     */
    const schief = verdorben((k) => {
      k.aussehen.haut = k.gruppe === "privat" ? 3 : k.aussehen.haut % 3;
      return k;
    });
    const texte = befundeZu(schief, "haut=", "gruppe");
    expect(texte.join("\n"), "nicht gemeldet").toMatch(/Gruppenabzeichen/);
  });

  it("GEGENPROBE: die Goldkette nur bei den Harten wird gemeldet", () => {
    const schief = verdorben((k) => {
      k.aussehen.merkmal = k.haerte >= 4 ? "goldkette" : "keins";
      return k;
    });
    const texte = befundeZu(schief, "merkmal=goldkette", "haerte");
    expect(texte.length, "nicht gemeldet").toBeGreaterThan(0);
  });

  it("GEGENPROBE: die Warnweste als Gewerbeabzeichen wird gemeldet", () => {
    const schief = verdorben((k) => {
      k.aussehen.weste = k.gruppe === "gewerbe";
      return k;
    });
    expect(befundeZu(schief, "weste", "gruppe").length, "nicht gemeldet").toBeGreaterThan(0);
  });
});

describe("Die Kundschaft ist trotzdem bunt", () => {
  /*
   * Die Kehrseite des Wächters oben: Man kann jede Korrelation dadurch
   * erschlagen, dass alle gleich aussehen. Diese Prüfungen verlangen das
   * Gegenteil — Vielfalt, und zwar die, die Patrick genannt hat.
   */
  it("es gibt Kleine und Lange, Dünne und Dicke, Gepflegte und Ölige", () => {
    const g = KUNDEN.map((k) => groesseNormiert(k.aussehen));
    expect(Math.min(...g), "kein Kleiner dabei").toBeLessThan(0.1);
    expect(Math.max(...g), "kein Langer dabei").toBeGreaterThan(0.9);
    for (const feld of ["fuelle", "pflege"] as const) {
      const w = KUNDEN.map((k) => k.aussehen[feld]);
      expect(Math.min(...w), `${feld}: unteres Ende fehlt`).toBeLessThanOrEqual(0.2);
      expect(Math.max(...w), `${feld}: oberes Ende fehlt`).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("jeder Hautton, jede Haarfarbe und jede Jacke der Tafel kommt vor", () => {
    const haut = new Set(KUNDEN.map((k) => k.aussehen.haut));
    const haar = new Set(KUNDEN.map((k) => k.aussehen.haar));
    const jacke = new Set(KUNDEN.map((k) => k.aussehen.jacke));
    expect(haut.size, "ungenutzte Hauttöne").toBe(HAUTTOENE.length);
    expect(haar.size, "ungenutzte Haarfarben").toBe(HAARTOENE.length);
    expect(jacke.size, "ungenutzte Jackenfarben").toBe(JACKENTOENE.length);
  });

  it("jedes Wiedererkennungsmerkmal kommt vor, und die meisten haben keins", () => {
    const zaehler = new Map<string, number>();
    for (const k of KUNDEN) {
      zaehler.set(k.aussehen.merkmal, (zaehler.get(k.aussehen.merkmal) ?? 0) + 1);
    }
    for (const m of MERKMALE) expect(zaehler.get(m), `${m} kommt nie vor`).toBeGreaterThan(0);
    /*
     * „Nicht jeder bekommt eines; eines pro Figur reicht, zwei sind zu viel."
     * Der Typ lässt schon nur eines zu. Hier steht die andere Hälfte: Wenn
     * jeder Zweite eine Goldkette trägt, ist sie kein Erkennungszeichen mehr.
     */
    const ohne = zaehler.get("keins") ?? 0;
    expect(ohne / KUNDEN.length, "zu viele Kunden ohne Merkmal").toBeLessThanOrEqual(0.45);
    expect(ohne, "jeder trägt etwas — dann trägt es niemand").toBeGreaterThanOrEqual(5);
  });

  it("höchstens jeder Fünfte bringt einen Hund mit", () => {
    /*
     * Der Hund ist der einzige, der ein eigenes Netz kostet (`kundenfigur.ts`).
     * Drei von 23 heißt: Er ist eine Überraschung, kein Dauerposten im Budget.
     */
    const hunde = KUNDEN.filter((k) => k.aussehen.merkmal === "hund").length;
    expect(hunde, "kein Hund dabei").toBeGreaterThan(0);
    expect(hunde / KUNDEN.length, "zu viele Hunde").toBeLessThanOrEqual(0.2);
  });
});
