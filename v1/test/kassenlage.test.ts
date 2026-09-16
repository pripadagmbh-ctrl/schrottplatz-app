import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Account, CREDIT_LIMIT_EUR } from "../src/economy/account";

/*
 * DIE ZEILE, DIE SAGT, WARUM NICHTS MEHR PASSIERT (E-081).
 *
 * Es gibt zwei Tore, die Anlieferer aufhalten: der volle Platz
 * (`Shift.acceptsDeliveries`) und das leere Konto (`Account.canBuy`). Fuer den
 * vollen Platz stand seit jeher eine Zeile im Bild. Fuer das leere Konto gab
 * es nur einen Toast, der nach 2,6 s weg war — waehrend der Zustand blieb.
 * Der Spieler stand auf einem Hof, auf dem nichts mehr passierte, und sah
 * nirgends, warum (Befund E-070).
 *
 * DIESELBE FEHLERKLASSE WIE IN `platzinventar-verdrahtung.test.ts`: Eine
 * HUD-Zeile, die niemand setzt, sieht im Quelltext aus wie fertige Arbeit.
 * `Account.lowOnCash` war seit dem 02.09.2026 gebaut und wurde NIRGENDS
 * benutzt — genau so geht so etwas verloren.
 *
 * Deshalb pruefen die Faelle unten drei Dinge, und zu jedem gehoert eine
 * GEGENPROBE: eine herausgeschnittene Zeile MUSS gemeldet werden.
 */

const wurzel = resolve(__dirname, "..");
const lies = (p: string) => readFileSync(resolve(wurzel, p), "utf8");

const main = lies("src/main.ts");
const hud = lies("src/ui/hud.ts");

/**
 * Wird die Zahlungslage an die stehende Zeile uebergeben?
 *
 * Geprueft wird als Funktion, damit gleich darunter dieselbe Pruefung auf
 * einen absichtlich kaputten Quelltext laufen kann.
 */
function verdrahtet(quelle: string): boolean {
  const stelle = quelle.search(/hud\.updateShift\(/);
  if (stelle < 0) return false;
  // 1. Die Lage muss WIRKLICH uebergeben werden, nicht nur danebenstehen.
  const aufruf = quelle.slice(stelle, stelle + 400);
  const ende = aufruf.indexOf(");");
  if (ende < 0) return false;
  if (!aufruf.slice(0, ende).includes("kassenlage")) return false;
  // 2. Und sie muss aus beiden Stufen des Kontos gebaut sein.
  const davor = quelle.slice(Math.max(0, stelle - 600), stelle);
  return davor.includes("account.canBuy") && davor.includes("account.lowOnCash");
}

describe("Konto leer: der Zustand steht im Bild, nicht nur im Toast", () => {
  it("das Wirtschaftsmodul kennt beide Stufen", () => {
    const a = new Account();
    a.moneyEur = 5000;
    expect(a.canBuy, "5000 EUR und trotzdem zahlungsunfaehig").toBe(true);
    expect(a.lowOnCash, "5000 EUR und trotzdem knapp bei Kasse").toBe(false);

    a.moneyEur = 500; // unter der Vorwarnschwelle, aber weit ueber der Grenze
    expect(a.lowOnCash, "500 EUR gelten nicht als knapp").toBe(true);
    expect(a.canBuy, "bei 500 EUR wird schon nicht mehr geliefert").toBe(true);

    a.moneyEur = CREDIT_LIMIT_EUR - 1;
    expect(a.canBuy, "unter der Kreditgrenze wird weiter angekauft").toBe(false);
  });

  it("das HUD hat fuer alle drei Stufen ein Wort", () => {
    // Die Stufen stehen als Typ im HUD — ohne sie gibt es nichts anzuzeigen.
    expect(hud, "hud.ts kennt keine Zahlungslage").toContain("Zahlungslage");
    for (const stufe of ["ok", "knapp", "leer"]) {
      expect(hud, `die Stufe "${stufe}" fehlt im HUD`).toMatch(
        new RegExp(`\\b${stufe}:\\s*\\{`)
      );
    }
    /*
     * FARBE IST NIE DER EINZIGE KANAL (Briefing Kap. 20). Beide Warnstufen
     * tragen ein Zeichen UND einen Satz — auf einem Bildschirm in der Sonne
     * geht die Farbe als Erste verloren.
     */
    expect(hud, "die Vorwarnung hat kein Zeichen").toContain("! Kasse wird knapp");
    expect(hud, "der Stillstand hat kein Zeichen").toContain("✗ Konto leer");
  });

  it("und main.ts uebergibt sie — sonst steht die Zeile nie da", () => {
    expect(verdrahtet(main), "die Zahlungslage erreicht das HUD nicht").toBe(true);

    /*
     * GEGENPROBE 1: die Vorwarnstufe herausgeschnitten. Genau das war der
     * Zustand vor E-081 — `lowOnCash` gebaut, nirgends benutzt.
     */
    const ohneVorwarnung = main.replace(/account\.lowOnCash/g, "false");
    expect(ohneVorwarnung, "die Gegenprobe hat nichts veraendert").not.toBe(main);
    expect(verdrahtet(ohneVorwarnung), "die Gegenprobe meldet nichts").toBe(false);

    /*
     * GEGENPROBE 2: der ganze dritte Aufrufparameter weg, also wieder der
     * alte Aufruf mit nur zwei Angaben.
     */
    const alterAufruf = main.replace(
      /hud\.updateShift\([\s\S]{0,300}?\);/,
      "hud.updateShift(`x`, shift.jammed);"
    );
    expect(alterAufruf, "die Gegenprobe hat nichts veraendert").not.toBe(main);
    expect(verdrahtet(alterAufruf), "die Gegenprobe meldet nichts").toBe(false);
  });

  it("die Anzeige ruehrt den Kreislauf nicht an", () => {
    /*
     * Patrick, mehrfach: „Kreislaufsachen noch nicht." Die Zeile ZEIGT, was
     * ist — sie aendert nichts. Weder Schwelle noch Kreditgrenze noch Preis
     * stehen im HUD, und der Block in `main.ts` schreibt kein Geld.
     */
    expect(hud, "das HUD greift ins Wirtschaftsmodul hinein").not.toMatch(
      /^import[^\n]*economy/m
    );
    // Und es rechnet auch selbst keine Schwelle nach.
    expect(hud, "eine Schwelle steht als Zahl im HUD").not.toMatch(
      /(moneyEur|kontoEur)\s*[<>]/
    );
    const stelle = main.search(/const kassenlage/);
    expect(stelle, "der Block fehlt ganz").toBeGreaterThan(0);
    const block = main.slice(stelle, main.indexOf("hud.updateShift", stelle));
    expect(block.length, "der Block ist leer — so prueft das hier nichts").toBeGreaterThan(20);
    expect(block, "die Anzeige schreibt aufs Konto").not.toMatch(/moneyEur\s*[-+]?=/);
    expect(block, "die Anzeige faengt an zu handeln").not.toContain("payDelivery");
  });
});
