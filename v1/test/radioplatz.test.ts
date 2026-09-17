/**
 * Waechter fuer das Radiofeld mit fuenf Sendern (E-093).
 *
 * Die Gefahr ist nicht, dass etwas haesslich aussieht, sondern dass das Menue
 * zur Falle wird: Rutschen „Radio ausschalten" und „Zurueck" unter den
 * Bildrand, kommt man nicht mehr heraus — und auf dem iPhone mini quer bleiben
 * fuer die Tafel nur 345 px.
 *
 * Gerechnet wird mit `test/radiomass.ts`, derselben Rechnung, mit der auch
 * `tools/radiobild.ts` zeichnet.
 */
import { describe, it, expect } from "vitest";
import { FASSUNGEN, wert } from "./cssmass";
import { alleMasse, radioMass } from "./radiomass";

describe("Das Radiofeld passt in jede Fassung", () => {
  for (const f of FASSUNGEN) {
    it(`${f.name}: die Knoepfe unter der Liste bleiben im Bild`, () => {
      const m = radioMass(f);
      const zeilen = m.bloecke.map((b) => `${b.name}: ${b.hoehe.toFixed(1)} px`).join(" · ");
      expect(
        m.luft,
        `${f.name}: ${m.gebraucht.toFixed(1)} px auf ${m.platz.toFixed(1)} px Platz — ${zeilen}`
      ).toBeGreaterThanOrEqual(0);
    });

    it(`${f.name}: man sieht mindestens zwei Sender, ohne zu schieben`, () => {
      const m = radioMass(f);
      expect(
        m.sichtbar,
        `nur ${m.sichtbar} Eintrag(e) sichtbar (Liste ${m.bloecke[3]!.hoehe.toFixed(1)} px, ` +
          `Eintrag ${m.eintrag.toFixed(1)} px)`
      ).toBeGreaterThanOrEqual(2);
    });

    it(`${f.name}: ein Sendereintrag ist mindestens 44 px hoch`, () => {
      // Tippziel — gilt auf dem Telefon genauso wie auf dem Tablet.
      const m = radioMass(f);
      expect(m.eintrag).toBeGreaterThanOrEqual(44);
    });
  }

  it("die Liste hat einen eigenen Scrollbereich — sonst waechst die Tafel mit", () => {
    for (const f of FASSUNGEN) {
      expect(wert(["#radio-list"], "max-height", f), `${f.name}: keine Hoehengrenze`).toBeTruthy();
      expect(wert(["#radio-list"], "overflow-y", f), `${f.name}: kein Scrollbereich`).toBe("auto");
    }
  });

  it("und sie darf als einziger Kasten mit dem Finger geschoben werden", () => {
    /*
     * Die Seite steht auf `touch-action: none` (Safari-Lehre aus v2: sonst
     * zoomt und wippt alles). Ein Scrollbereich braucht die Ausnahme, sonst
     * laesst er sich mit dem Finger nicht bewegen — man saehe die unteren
     * Sender nie.
     */
    expect(wert(["#radio-list"], "touch-action", FASSUNGEN[1]!)).toBe("pan-y");
  });

  it("die Schrift bleibt lesbar: nichts unter 11 px", () => {
    // Barrierefreiheit: Fliesstext >= 14 px, Kleingedrucktes nicht unter 11.
    for (const f of FASSUNGEN) {
      for (const sel of ["#radio button", "#radio .sub", "#radio button small"]) {
        const v = wert([sel], "font-size", f) ?? wert([sel], "font", f);
        const m = v ? /(\d+(?:\.\d+)?)px/.exec(v) : null;
        expect(m, `${sel} hat keine Schriftgroesse in ${f.name}`).toBeTruthy();
        expect(Number(m![1]), `${sel} in ${f.name}`).toBeGreaterThanOrEqual(11);
      }
    }
  });

  it("Messwerte fuer den Bericht", () => {
    // Kein Urteil, nur Zahlen — sie stehen im Uebergabebericht und im Log.
    for (const m of alleMasse()) {
      const zeilen = m.bloecke.map((b) => `${b.name} ${b.hoehe.toFixed(0)}`).join(" | ");
      console.log(
        `${m.fassung.name}: Platz ${m.platz.toFixed(0)} px, gebraucht ` +
          `${m.gebraucht.toFixed(0)} px, Luft ${m.luft.toFixed(0)} px, ` +
          `${m.sichtbar} Sender sichtbar · ${zeilen}`
      );
      expect(Number.isFinite(m.gebraucht), "die Rechnung liefert NaN").toBe(true);
    }
  });
});
