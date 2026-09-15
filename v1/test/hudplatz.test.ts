import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EM_BREITE,
  FASSUNGEN,
  fassungInnen,
  hudHoehe,
  knopfKasten,
  luft,
  px,
  pxOderNull,
  schriftgroesse,
  seite,
  ueberlappt,
  wert,
  wurzel,
  type Fassung,
  type Kasten,
} from "./cssmass";

/*
 * Wo die Anzeigen am oberen Bildrand stehen — und dass sie einander nicht
 * verdecken.
 *
 * Befund Patrick 14.09.2026, iPad quer: im Bild stand "Konto: 1.25(Menue) EUR".
 * Der Menueknopf und die Kontoanzeige hatten beide "top: 12px; right: 12px" —
 * sie sassen exakt aufeinander. Der Knopf liegt mit "z-index: 3" obenauf, also
 * schnitt er mitten durch die Zahl.
 *
 * Zweiter Befund, 15.09.2026 (E-027, offener Punkt 3): Konto und Tagesablauf
 * ueberlappten sich um rund 6 px. `#money` stand auf top 12 und ist wegen
 * Zeilenabstand 1,5 tatsaechlich 40,5 px hoch; `#shift` begann bei 46. Die
 * Zahlen 12 / 46 / 80 waren geschaetzte Kastenhoehen — und eine geschaetzte
 * Kastenhoehe ist genau das, was nie stimmt.
 *
 * Die Antwort ist dieselbe wie unten: ein Stapel. Deshalb pruefen die Tests
 * hier ab dem 15.09.2026 nicht mehr "steht #shift 30 px unter #money" (die
 * Kaesten haben keine eigenen Abstaende mehr), sondern die Bauform und das
 * Ergebnis: Der Halter stapelt, und die Kaesten ueberlappen einander und den
 * Menueknopf in keiner der drei Fassungen.
 */

/** Realistisch lange Zeilen fuer die beiden oberen Kaesten. */
const KONTO = "Konto: 1250 € · Haufen ≈ 3480 €";
const SCHICHT = "Sortieren — 12:40 (Abholer wartet)";

/** Mit Beruehrungseingabe (iPad/iPhone) — dort gilt die Ausweichregel. */
const HALTER = ["#hudoben", "body.touch #hudoben"];
/** Ohne Beruehrungseingabe (Maus und Tastatur) — die blanke Grundregel. */
const HALTER_MAUS = ["#hudoben"];
const MONEY = ["#money", "#hudoben .hud", ".hud"];
const SHIFT = ["#shift", "#hudoben .hud", ".hud"];
const DEBUG = ["#debug", "#hudoben .hud", ".hud"];

/**
 * Die Kaesten des oberen Stapels.
 *
 * `mitDebug` = F3 gedrueckt. Der Debugblock ist Teil desselben Stapels; ein
 * ausgeblendetes Flex-Kind nimmt keinen Platz ein, ein eingeblendetes rutscht
 * unter den Tagesablauf — ohne dass irgendwo eine Zahl nachgezogen wird.
 */
function obenStapel(f: Fassung, mitDebug: boolean): Kasten[] {
  const oben = px(HALTER, "top", f);
  const rechts = pxOderNull(HALTER, "right", f);
  const links = pxOderNull(HALTER, "left", f);
  const luecke = px(HALTER, "gap", f);
  if (rechts === null && links === null) throw new Error("Halter haengt an keiner Seite");
  /* Nur ein waagerechter Anker: Der fixierte Kasten ist "shrink to fit" —
     so breit wie noetig, hoechstens bis zur gegenueberliegenden Bildkante. */
  const verfuegbar = f.w - (links ?? 0) - (rechts ?? 0);

  /* Ein Kasten mit einem waagerechten Anker ist so breit wie sein Text —
     Consolas, 0,55 em je Zeichen — plus Fassung und Rahmen. */
  const breiteVon = (sel: string[], text: string): number => {
    const schrift = schriftgroesse(sel, f);
    const [, padX] = fassungInnen(sel, f);
    return Math.min(verfuegbar, text.length * schrift * EM_BREITE + 2 * padX + 2);
  };

  const zeilen: Array<[string, string[], string]> = [
    ["Konto", MONEY, KONTO],
    ["Tagesablauf", SHIFT, SCHICHT],
  ];
  if (mitDebug) zeilen.push(["Debug", DEBUG, "Koerper 812 / wach 34 · 61 fps"]);

  const out: Kasten[] = [];
  let y = f.h - oben; // Oberkante des Stapels, von unten gezaehlt
  for (const [name, sel, text] of zeilen) {
    const { hoehe } = hudHoehe(sel, f, verfuegbar, [{ text }]);
    const breite = breiteVon(sel, text);
    const x0 = rechts === null ? links! : f.w - rechts - breite;
    out.push({ name, x0, x1: x0 + breite, y0: y - hoehe, y1: y });
    y -= hoehe + luecke;
  }
  return out;
}

describe("HUD oben rechts", () => {
  it("Menueknopf und Kontoanzeige haben denselben Abstand zum rechten Rand — das war der Fehler", () => {
    /*
     * Dieser Test haelt die Ursache fest, damit sie erkennbar bleibt: Solange
     * beide auf denselben 12 px sitzen, MUSS eine Ausnahme fuer Touch dafuer
     * sorgen, dass sie sich nicht treffen. Faellt die Ausnahme weg, faellt der
     * naechste Test.
     *
     * Gemessen wird auf dem iPad (alle sicheren Raender null) — dort sind es
     * wirklich beide Male die blanken 12 px.
     */
    const iPad = FASSUNGEN[0];
    expect(px(["#btn-menu"], "right", iPad)).toBe(12);
    expect(px(HALTER_MAUS, "right", iPad)).toBe(12);
  });

  it("auf Touchgeraeten weicht der obere Stapel dem Menueknopf aus", () => {
    const ausnahme = /body\.touch #hudoben \{([^}]*)\}/.exec(seite);
    expect(ausnahme, "Ausweichregel fuer Touch fehlt").not.toBeNull();

    const iPad = FASSUNGEN[0];
    const frei = px(HALTER, "right", iPad);
    const knopfRechts = px(["#btn-menu"], "right", iPad);
    const knopfBreite = px(["#touch .btn", "#btn-menu"], "width", iPad);
    // Die Anzeige muss links der linken Knopfkante enden, mit etwas Luft.
    expect(frei).toBeGreaterThanOrEqual(knopfRechts + knopfBreite);
    expect(frei - (knopfRechts + knopfBreite)).toBeGreaterThanOrEqual(6);
  });

  it("die Ausweichregel gilt nur oberhalb der flachen Fassung", () => {
    /*
     * In der flachen Fassung (max-height: 430px, iPhone quer) steht der Stapel
     * schon links oben, mit "right: auto". Wuerde die Ausweichregel auch dort
     * greifen, gewaenne sie nach Spezifitaet (body.touch #hudoben schlaegt
     * #hudoben) und schoebe ihn wieder nach rechts.
     */
    const i = seite.indexOf("body.touch #hudoben");
    expect(i, "Ausweichregel fehlt").toBeGreaterThan(0);
    const davor = seite.slice(0, i);
    const letzteAbfrage = davor.lastIndexOf("@media");
    expect(letzteAbfrage, "Ausweichregel steht in keiner Medienabfrage").toBeGreaterThan(0);
    const kopf = seite.slice(letzteAbfrage, seite.indexOf("{", letzteAbfrage));
    expect(kopf).toContain("min-height: 431px");
  });

  it("stapelt oben genauso wie unten, statt Kastenhoehen zu schaetzen", () => {
    /*
     * Der Kern von E-032, Punkt 2. Vorher: drei Kaesten auf top 12 / 46 / 80,
     * jede Zahl eine Schaetzung der Hoehe des Kastens darueber. Die erste
     * Schaetzung lag um 7 px daneben.
     *
     * Im Stapel gibt es keine Schaetzung mehr — und deshalb wird hier die
     * Bauform bewacht: Halter mit Spalte und Zwischenraum, Kinder ohne eigene
     * Verankerung.
     */
    const iPad = FASSUNGEN[0];
    expect(wert(["#hudoben"], "display", iPad)).toBe("flex");
    expect(wert(["#hudoben"], "flex-direction", iPad)).toBe("column");
    expect(px(["#hudoben"], "gap", iPad)).toBeGreaterThanOrEqual(4);
    expect(wert(["#hudoben .hud"], "position", iPad)).toBe("static");
    // Keiner der drei haengt noch selbst am Rand.
    for (const id of ["#money", "#shift", "#debug"]) {
      expect(wert([id], "top", iPad), `${id} haengt noch selbst oben`).toBeNull();
      expect(wert([id], "right", iPad), `${id} haengt noch selbst rechts`).toBeNull();
    }
  });

  it("nimmt den Debugblock mit in den Stapel, damit er nicht der naechste Fall wird", () => {
    // Er stand auf top: 80 — bei zweizeiligem Tagesablauf waere er getroffen
    // worden. Im Markup steht er jetzt im Halter.
    const halter = seite.slice(seite.indexOf('<div id="hudoben">'));
    const ende = halter.indexOf("</div>", halter.indexOf('id="debug"'));
    expect(halter.slice(0, ende)).toContain('id="debug"');
    // Und er wird weiter ueber display ein- und ausgeschaltet — ein
    // ausgeblendetes Flex-Kind nimmt keinen Platz ein.
    const overlay = readFileSync(resolve(wurzel, "src/core/debugOverlay.ts"), "utf8");
    expect(overlay).toContain('this.el.style.display = this.visible ? "block" : "none"');
  });

  for (const f of FASSUNGEN) {
    describe(f.name, () => {
      for (const mitDebug of [false, true]) {
        const wie = mitDebug ? "mit F3-Zahlen" : "ohne F3-Zahlen";
        it(`Konto, Tagesablauf und Menueknopf ueberlappen einander nicht (${wie})`, () => {
          const kaesten = obenStapel(f, mitDebug);
          const menue = knopfKasten("btn-menu", f);
          for (let i = 0; i < kaesten.length; i++) {
            for (let j = i + 1; j < kaesten.length; j++)
              expect(
                ueberlappt(kaesten[i], kaesten[j]),
                `${kaesten[i].name} auf ${kaesten[j].name}: ${JSON.stringify([kaesten[i], kaesten[j]])}`
              ).toBe(false);
            expect(
              ueberlappt(kaesten[i], menue),
              `${kaesten[i].name} auf dem Menueknopf: ${JSON.stringify([kaesten[i], menue])}`
            ).toBe(false);
            expect(
              luft(kaesten[i], menue),
              `${kaesten[i].name} zu dicht am Menueknopf`
            ).toBeGreaterThanOrEqual(6);
          }
        });
      }

      it("laesst die Tutorialkarte unter dem Stapel beginnen, wo sie ihn kreuzt", () => {
        /*
         * Die Karte haengt auf Touchgeraeten oben und traegt eine feste Zahl
         * (`top`). Diese Zahl war bis zum 15.09.2026 im Hochformat 84 px —
         * gerechnet als "12 Rand + 41 Konto + 31 Tagesablauf", also mit einer
         * geschaetzten Hoehe und ohne den Zwischenraum. Richtig sind 105.
         * Dieselbe Klasse Fehler wie beim Stapel selbst, darum hier bewacht.
         *
         * Auf dem iPad steht der Stapel rechts und die Karte links — dort
         * kreuzen sie sich in der Breite gar nicht, und die Karte darf oben
         * bleiben.
         */
        const kaesten = obenStapel(f, false);
        const tut = ["#tutorial", "body.touch #tutorial"];
        const tLinks = px(tut, "left", f);
        const tRechts = tLinks + px(["#tutorial"], "max-width", f);
        const tOben = f.h - px(tut, "top", f);
        const unterster = Math.min(...kaesten.map((k) => k.y0));
        const kreuzt = kaesten.some((k) => tLinks < k.x1 && k.x0 < tRechts);
        if (kreuzt)
          expect(
            unterster - tOben,
            `Tutorialkarte beginnt ${unterster - tOben} px unter dem Stapel`
          ).toBeGreaterThanOrEqual(8);
      });
    });
  }
});

describe("HUD schreibt nur, was sich geaendert hat", () => {
  const hud = readFileSync(resolve(wurzel, "src/ui/hud.ts"), "utf8");

  it("kein textContent wird ungeprueft gesetzt", () => {
    /*
     * Befund 14.09.2026: Griff-Info, Konto, Ladung und Tagesablauf schrieben in
     * jedem Bild neu, auch wenn dieselbe Zeile schon dastand. Alles laeuft
     * jetzt ueber schreib(), das den letzten Stand merkt. Ausgenommen ist die
     * Einblendung (toast), die per Definition jedes Mal neu ist.
     */
    const zeilen = hud
      .split("\n")
      .filter((z) => z.includes(".textContent =") && !z.trim().startsWith("*"));
    for (const z of zeilen) {
      const roh = z.trim();
      // Einzige erlaubte Ausnahmen: schreib() selbst und die Einblendung.
      const erlaubt = roh === "el.textContent = text;" || roh === "el.textContent = msg;";
      expect(erlaubt, `ungeprueftes Schreiben: ${roh}`).toBe(true);
    }
    // Und die Ausnahme fuer die Einblendung darf nicht stillschweigend
    // wachsen: genau eine Stelle schreibt msg.
    expect(hud.split("el.textContent = msg;").length - 1).toBe(1);
  });

  it("load und shift werden einmal geholt, nicht je Bild gesucht", () => {
    expect(hud).toMatch(/private loadEl = document\.getElementById\("load"\)/);
    expect(hud).toMatch(/private shiftEl = document\.getElementById\("shift"\)/);
    // In den Aktualisierungen darf getElementById nicht mehr vorkommen.
    const aktualisierungen = hud.slice(hud.indexOf("updateLoad("));
    expect(aktualisierungen).not.toContain('getElementById("load")');
    expect(aktualisierungen).not.toContain('getElementById("shift")');
  });

  it("schaltet die Griff-Info ueber Klassen, nicht ueber style", () => {
    // Sonst stuende der Zustand an zwei Orten (Klasse und Stilattribut) und
    // ein Stilattribut schlaegt jede Medienabfrage — dieselbe Falle, in die
    // die Einblendung mit ihrem style="top: 56px" geraten war.
    expect(hud).toContain('this.gripEl.classList.add("weg")');
    expect(hud).toContain('this.gripEl.classList.remove("weg")');
    expect(hud).not.toContain("this.gripEl.style.display");
  });
});
