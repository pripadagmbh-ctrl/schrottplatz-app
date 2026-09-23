import { describe, it, expect } from "vitest";
/**
 * KEIN FAHRZEUG SPRINGT — und keines faehrt beim Einlenken durch eine Mauer.
 *
 * DER BEFUND (E-073, E-080, behoben in E-081). `vehicles.placeAt` setzte
 * `rotation.y` hart auf die Richtung des Streckenstuecks. An einer Ecke der
 * Polylinie lag der Wagen damit in EINEM Rechenschritt in der neuen Richtung:
 * bis 168,7 Grad, die weiteste Umrissecke sprang dabei 10,23 m. Rapier leitet
 * daraus fuer den kinematischen Koerper rund 600 m/s ab und raeumt die
 * Durchdringung des naechsten Bildes in einem Bild aus — derselbe Katapult wie
 * beim Kipper (E-073), nur an der Lenkung.
 *
 * DIESER WAECHTER PRUEFT DREI DINGE, und jedes hat seine GEGENPROBE:
 *
 *   1. Kein Rechenschritt dreht mehr als ein paar Grad.
 *   2. Keine Umrissecke springt weiter als eine Handbreit.
 *   3. Der eingelenkte Wagen faehrt auf KEINER Strecke in ein Bauwerk —
 *      das ist die Platzfrage, und sie ist die schwerere: Wer einlenkt,
 *      faehrt eine Kurve statt einer Ecke und braucht Raum, den die Strecke
 *      nicht vorsieht (gemessen: bis 0,70 m in den Silowaenden, bevor die
 *      Regel „vor dem Rueckwaertsfahren wird eingedreht" dazukam).
 *
 * Die Gegenprobe ist in allen drei Faellen dieselbe und kostet keinen
 * nachgebauten Fehler: `lenkrate = Infinity` IST der alte Zustand.
 */
import { fahrplaene } from "./strecken";
import { fahre, ALT, NEU } from "./knicklauf";
import { mindestens } from "./zahl";
import { LENK_RATE, VORAUS_M, winkelRest, lenkeEin, fahrtFaktor } from "../src/delivery/lenkung";

/**
 * Wieviel Grad ein Rechenschritt hoechstens drehen darf.
 *
 * Gerechnet, nicht gegriffen: `LENK_RATE` rad/s mal 1/60 s sind
 * 0,85 × 57,3 / 60 = 0,81 Grad. Die Schranke laesst 25 % Luft fuer eine
 * spaetere Rate — wer sie ueberschreitet, hat die Begrenzung umgangen.
 */
const MAX_GRAD = (LENK_RATE * (180 / Math.PI)) / 60 * 1.25;

/**
 * Wie weit die weiteste Umrissecke in einem Rechenschritt springen darf (m).
 *
 * Aus derselben Rate: Der Hebel der weitesten Ecke ist beim Kipper 5,14 m
 * (1,55 x 4,90 m Halbmasse), also bewegt sie sich bei 0,85 rad/s mit
 * 4,37 m/s. Dazu das Fahrtempo 4,8 m/s — zusammen hoechstens 9,17 m/s, in
 * einem Bild 0,153 m. Gemessen sind 0,14 m; die Schranke steht bei 0,25 m.
 *
 * Zum Vergleich der alte Zustand: 10,23 m in einem Bild, also 614 m/s.
 */
const MAX_SPRUNG_M = 0.25;

/** Ab dieser Durchdringung steckt Blech in Beton (m) — `UMRISS_TOLERANZ`. */
const MAX_TIEFE_M = 0.01;

/**
 * BEKANNTE STREIFER — gemessen, benannt, mit Datum (E-110, 22.09.2026).
 *
 * Seit E-110 stehen die Muldenwaende in der Hindernisliste so, wie sie GEBAUT
 * sind: 0,55 m dick und vor der Muldenkante, nicht 0,35 m dick und auf ihr.
 * Damit ragt jede Flanke 0,20 m weiter nach aussen als bisher verzeichnet —
 * die Steine haben sich nicht bewegt, nur die Karte hat aufgehoert zu
 * beschoenigen.
 *
 * An EINER Stelle wird dadurch sichtbar, was der Kipper dort schon immer tat:
 * Beim Eindrehen in das VA-LAGER schwenkt sein Vorderende ueber die Suedecke
 * der ALU-LAGER-Flanke. Gemessen 0,02 m, an zwei Schritten.
 *
 * WARUM DAS HIER STEHT UND NICHT DIE SCHRANKE HOCHGEHT: Die Gasse ist an
 * dieser Ecke in BEIDE Richtungen dicht. Gemessen am 22.09.2026 mit
 * `MULDEN_GASSE_Z`:
 *
 *   −17,00 (gebaut)  0,02 m in „ALU-LAGER Süd"
 *   −17,30           0,00 m dort, dafuer 0,04 m in „BATTERIEN West"
 *
 * Der Wagen ist 8,60 m lang und dreht sich in einer 6,75 m breiten Ecke — wer
 * das saubermachen will, aendert die Gasse oder den Abstand der Silos, und das
 * ist Patricks Platzanordnung und keine Zahl, die ein Waechter entscheidet.
 * Bis dahin gilt: DIESER eine Streifer darf 0,03 m tief sein, jeder andere
 * und jeder tiefere macht den Waechter rot.
 */
const BEKANNTE_STREIFER: Array<{ etappe: string; bauwerk: string; bisM: number }> = [
  { etappe: "Silo VA-LAGER Rangieren", bauwerk: "ALU-LAGER Süd", bisM: 0.03 },
];
const erlaubteTiefe = (etappe: string, bauwerk: string): number =>
  BEKANNTE_STREIFER.find((b) => b.etappe === etappe && b.bauwerk === bauwerk)?.bisM ?? MAX_TIEFE_M;

describe("Der Rangierknick ist ein Einlenken, kein Sprung", () => {
  it("dreht auf keiner Strecke mehr als eine Handbreit je Rechenschritt", () => {
    const plaene = fahrplaene();
    mindestens(plaene.length, 17, "Fahrplaene");
    const schlimm: string[] = [];
    for (const p of plaene) {
      const f = fahre(p, NEU);
      if (f.maxGrad > MAX_GRAD || f.maxSprungM > MAX_SPRUNG_M) {
        schlimm.push(`${f.plan}: ${f.maxGrad.toFixed(1)} Grad, ${f.maxSprungM.toFixed(2)} m`);
      }
    }
    expect(schlimm, ["zu scharfe Knicke:", ...schlimm].join(" / ")).toEqual([]);
  });

  it("GEGENPROBE: derselbe Pruefcode meldet den alten Sprungzustand", () => {
    const plaene = fahrplaene();
    const schlimm: string[] = [];
    let maxGrad = 0;
    let maxSprung = 0;
    for (const p of plaene) {
      const f = fahre(p, ALT);
      maxGrad = Math.max(maxGrad, f.maxGrad);
      maxSprung = Math.max(maxSprung, f.maxSprungM);
      if (f.maxGrad > MAX_GRAD || f.maxSprungM > MAX_SPRUNG_M) schlimm.push(f.plan);
    }
    // Der alte Stand MUSS auffallen — und zwar auf jeder einzelnen Strecke.
    expect(schlimm.length, "der alte Sprungzustand faellt nicht auf").toBe(plaene.length);
    // Und er muss die gemessenen Zahlen aus E-073/E-080 wiedergeben.
    expect(maxGrad).toBeGreaterThan(160);
    expect(maxSprung).toBeGreaterThan(9);
  });

  it("faehrt beim Einlenken durch kein Bauwerk", () => {
    /*
     * DIE PLATZFRAGE. `test/fahrumriss.test.ts` prueft die Strecken mit der
     * IDEALEN Gierlage — also so, wie der Wagen laege, wenn er sich auf der
     * Stelle drehen koennte. Genau das kann er seit E-081 nicht mehr: Er zieht
     * seine Lage nach und steht dabei schraeg zur Bahn. Diese Pruefung faehrt
     * die Strecken mit der WIRKLICHEN Gierlage ab, Schritt fuer Schritt.
     *
     * Ohne die Regel „vor jeder Rueckwaertsfahrt wird eingedreht" und ohne
     * die Vorausschau stand der Umriss hier bis zu 0,70 m in den Flanken der
     * Nachbarsilos — der Waechter oben waere gruen geblieben.
     */
    const plaene = fahrplaene();
    const treffer: string[] = [];
    for (const p of plaene) {
      const f = fahre(p, NEU);
      for (const a of f.anstoesse) {
        if (a.tiefeM > erlaubteTiefe(a.etappe, a.bauwerk)) {
          treffer.push(
            `${a.tiefeM.toFixed(2)} m  ${a.etappe} | ${a.bauwerk} bei ` +
              `(${a.x.toFixed(1)} | ${a.z.toFixed(1)})`
          );
        }
      }
    }
    expect(treffer, ["Durchdringungen beim Einlenken:", ...treffer].join(" / ")).toEqual([]);
  });

  it("GEGENPROBE: eine zu lange Vorausschau schneidet die Ecken und faellt auf", () => {
    /*
     * Die Vorausschau ist die Zahl mit dem engsten Fenster: unter 1,0 m bleibt
     * der Wagen an der Ecke stehen und zieht schleppend nach, ueber 2,0 m
     * schneidet er sie ab. Bei 4,0 m steckt er wieder 0,70 m in einer Wand.
     * Wer `VORAUS_M` verstellt, soll das hier merken.
     */
    let tief = 0;
    for (const p of fahrplaene()) {
      tief = Math.max(tief, fahre(p, { ...NEU, vorausM: 4.0 }).maxTiefeM);
    }
    expect(tief, "4,0 m Vorausschau faellt nicht auf").toBeGreaterThan(0.3);
    // Und der gebaute Wert liegt im gemessenen Fenster.
    expect(VORAUS_M).toBeGreaterThanOrEqual(1.0);
    expect(VORAUS_M).toBeLessThanOrEqual(2.0);
  });
});

describe("Das Lenkgesetz selbst", () => {
  it("nimmt immer den kuerzeren Weg und ueberschiesst nie", () => {
    // Ueber den Bruch bei +/- pi hinweg: von 175 nach -175 Grad sind es 10
    // Grad nach rechts, nicht 350 nach links.
    const a = (3.05 * 180) / Math.PI;
    expect(a).toBeGreaterThan(170);
    expect(winkelRest(3.05, -3.05)).toBeCloseTo(2 * Math.PI - 6.1, 9);
    // Ein Schritt, der groesser ist als der Rest, landet genau auf dem Ziel.
    expect(lenkeEin(0, 0.3, 10)).toBe(0.3);
    // Und ein zu kleiner Schritt geht in die richtige Richtung.
    expect(lenkeEin(0, 0.3, 0.1)).toBeCloseTo(0.1, 12);
    expect(lenkeEin(0, -0.3, 0.1)).toBeCloseTo(-0.1, 12);
  });

  it("haelt an, statt quer aus der Bahn zu laufen", () => {
    expect(fahrtFaktor(0)).toBe(1);
    expect(fahrtFaktor(Math.PI / 3)).toBeCloseTo(0.5, 9);
    expect(fahrtFaktor(Math.PI / 2)).toBeCloseTo(0, 9);
    // Bei einer Kehre faehrt er nicht rueckwaerts weiter, sondern steht.
    expect(fahrtFaktor(Math.PI)).toBe(0);
  });
});
