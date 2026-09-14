import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * Wo die Anzeigen am oberen Bildrand stehen — und dass sie einander nicht
 * verdecken.
 *
 * Befund Patrick 14.09.2026, iPad quer: im Bild stand "Konto: 1.25(Menue) EUR".
 * Der Menueknopf und die Kontoanzeige hatten beide "top: 12px; right: 12px" —
 * sie sassen exakt aufeinander. Der Knopf liegt mit "z-index: 3" obenauf, also
 * schnitt er mitten durch die Zahl.
 *
 * Diese Datei liest die Seite als Text, wie es test/fahrpedale.test.ts tut:
 * Die Anordnung steckt allein im CSS, und die echte Seite braucht einen
 * Browser, den es hier nicht gibt.
 */

const wurzel = resolve(__dirname, "..");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");

/** Der Regelblock zu einem Bezeichner, ohne umschliessende Klammern. */
function regel(quelle: string, wahl: string): string {
  const i = quelle.indexOf(wahl + " {");
  expect(i, `Regel ${wahl} fehlt`).toBeGreaterThanOrEqual(0);
  const auf = quelle.indexOf("{", i);
  const zu = quelle.indexOf("}", auf);
  return quelle.slice(auf + 1, zu);
}

/** Zahl hinter einer CSS-Eigenschaft in einem Regelblock. */
function px(block: string, eigenschaft: string): number {
  const m = new RegExp(`(?:^|[;{\\s])${eigenschaft}:\\s*(\\d+)px`).exec(block);
  expect(m, `${eigenschaft} fehlt`).not.toBeNull();
  return Number(m![1]);
}

describe("HUD oben rechts", () => {
  it("Menueknopf und Kontoanzeige haben denselben Abstand zum rechten Rand — das war der Fehler", () => {
    /*
     * Dieser Test haelt die Ursache fest, damit sie erkennbar bleibt: Solange
     * beide auf denselben 12 px sitzen, MUSS eine Ausnahme fuer Touch dafuer
     * sorgen, dass sie sich nicht treffen. Faellt die Ausnahme weg, faellt der
     * naechste Test.
     */
    expect(px(regel(seite, "#btn-menu"), "right")).toBe(12);
    expect(px(regel(seite, "#money"), "right")).toBe(12);
  });

  it("auf Touchgeraeten weichen Konto und Tagesablauf dem Knopf aus", () => {
    const ausnahme = /body\.touch #money,\s*body\.touch #shift \{([^}]*)\}/.exec(seite);
    expect(ausnahme, "Ausweichregel fuer Touch fehlt").not.toBeNull();
    const frei = px(ausnahme![1], "right");

    const knopf = regel(seite, "#btn-menu");
    const knopfRechts = px(knopf, "right");
    const knopfBreite = px(knopf, "width");

    // Die Anzeige muss links der linken Knopfkante enden, mit etwas Luft.
    expect(frei).toBeGreaterThanOrEqual(knopfRechts + knopfBreite);
    expect(frei - (knopfRechts + knopfBreite)).toBeGreaterThanOrEqual(6);
  });

  it("die Ausweichregel gilt nur oberhalb der flachen Fassung", () => {
    /*
     * In der flachen Fassung (max-height: 430px, iPhone quer) stehen Konto und
     * Tagesablauf schon links oben, mit "right: auto". Wuerde die
     * Ausweichregel auch dort greifen, gewaenne sie nach Spezifitaet
     * (body.touch #money schlaegt #money) und schoebe beide wieder nach rechts.
     */
    const i = seite.indexOf("body.touch #money");
    const davor = seite.slice(0, i);
    const letzteAbfrage = davor.lastIndexOf("@media");
    expect(letzteAbfrage, "Ausweichregel steht in keiner Medienabfrage").toBeGreaterThan(0);
    const kopf = seite.slice(letzteAbfrage, seite.indexOf("{", letzteAbfrage));
    expect(kopf).toContain("min-height: 431px");
  });

  it("der Tagesablauf steht unter dem Konto, nicht darauf", () => {
    const kontoOben = px(regel(seite, "#money"), "top");
    const schichtOben = px(regel(seite, "#shift"), "top");
    // 15px-Schrift plus 8px Innenrand oben und unten ergibt rund 34 px Hoehe.
    expect(schichtOben - kontoOben).toBeGreaterThanOrEqual(30);
  });
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
});
