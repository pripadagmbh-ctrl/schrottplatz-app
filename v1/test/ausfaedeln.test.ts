import { describe, it, expect } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
/**
 * KEIN FAHRZEUG WIRD VERSETZT — auch nicht beim Abfahren.
 *
 * DER BEFUND (E-093). `vehicles.nearestS` liefert die Bogenlaenge des
 * Routenpunktes, der der aktuellen Position am naechsten liegt. An fuenf
 * Stellen wurde diese Zahl in `routeS` geschrieben, und der naechste
 * Rechenschritt SETZTE den Wagen dorthin — quer ueber den Abstand, der
 * dazwischen liegt. Gemessen mit dem echten Fahrzeug:
 *
 *   Abfahrt vom Warteplatz 1   5,59 m in EINEM Bild  (335 m/s)
 *   Abfahrt vom Warteplatz 2   8,74 m               (524 m/s)
 *   Abfahrt vom Warteplatz 3   6,63 m               (398 m/s)
 *   nach dem Kippkriechen      1,32 m               ( 79 m/s)
 *
 * Der letzte ist der wichtigste: Er faellt bei JEDER Kipperfuhre an, und er
 * faellt genau dort, wo die frische Fuhre liegt.
 *
 * DIE GEGENPROBE kostet keinen nachgebauten Fehler: `faedeltAus = false` IST
 * Zeichen fuer Zeichen der alte Zustand (Lehre aus E-054 und E-062 — eine
 * abgeschriebene kaputte Fassung altert getrennt vom Quelltext).
 *
 * DER LAUFAPPARAT IST DER DES SPIELS: `test/abfahrtslauf.ts` laesst den
 * echten `VehicleManager` seinen Zyklus fahren und misst jeden Schritt. Ein
 * nachgebauter Fahrplan wuerde die Stelle gar nicht sehen — der Sprung
 * entsteht nicht AUF einer Strecke, sondern beim WECHSEL auf eine.
 */
import { abfahrt, staende, FAHRSCHRITT_M } from "./abfahrtslauf";
import { mindestens, endlich } from "./zahl";
import { PARK_SLOTS } from "../src/delivery/routes";

await RAPIER.init();

/**
 * JEDER STAND WIRD GENAU EINMAL GEFAHREN.
 *
 * Ein Lauf ist ein ganzer Zyklus mit echter Physik — Einfahrt, Wiegen,
 * Rangieren, Kippen, Pause, Ausfahrt. Das dauert. Vier Pruefungen, die
 * dieselben sechzehn Staende je einzeln faehren, wuerden `npm test` um
 * Minuten verlaengern, ohne eine einzige Zahl mehr zu liefern: Die Laeufe
 * sind mit fester Saat bitgleich.
 */
const gemessen = new Map<string, ReturnType<typeof abfahrt>>();
const lauf = (s: ReturnType<typeof staende>[number]): ReturnType<typeof abfahrt> => {
  const da = gemessen.get(s.name);
  if (da) return da;
  const r = abfahrt(s);
  gemessen.set(s.name, r);
  return r;
};

/**
 * Wie weit sich die Fahrzeugmitte in einem Rechenschritt bewegen darf (m).
 *
 * Gerechnet, nicht gegriffen: Das hoechste Tempo des Platzes ist SPEED =
 * 4,8 m/s, bei 60 Bildern je Sekunde also 0,080 m. Die Schranke laesst 25 %
 * Luft fuer Rundung und eine spaetere Temposchraube. Alles darueber ist kein
 * Fahren mehr, sondern ein Versetzen.
 */
const MAX_SCHRITT_M = FAHRSCHRITT_M * 1.25;

/**
 * Wie weit die weiteste Umrissecke in einem Rechenschritt springen darf (m).
 *
 * Dieselbe Rechnung wie in `test/rangierknick.test.ts` (E-084): Der Hebel der
 * weitesten Ecke ist beim Kipper 5,14 m, bei LENK_RATE 0,85 rad/s also
 * 4,37 m/s, dazu 4,8 m/s Fahrtempo — zusammen 0,153 m je Bild.
 *
 * HIER STEHT SIE HOEHER, bei 0,50 m, und das ist kein Nachlassen, sondern
 * ehrlich: Dieser Apparat faehrt den GANZEN Zyklus, also auch `parkRueck`.
 * Dort dreht der Wagen mit `diff x min(dt x 1,6; 1)` und damit schneller als
 * `LENK_RATE` — gemessen 0,36 m Ecksprung. Das ist ein eigener Befund und
 * steht im Log; dieser Waechter deckelt ihn, damit er nicht waechst, und
 * bewacht mit `MAX_SCHRITT_M` die Frage, um die es hier geht.
 */
const MAX_ECKE_M = 0.5;

describe("Kein Fahrzeug springt auf seine Ausfahrt", () => {
  it("faehrt in jedem Bild hoechstens einen Fahrschritt weit", () => {
    const alle = staende().filter((s) => s.faedeltAus !== false);
    mindestens(alle.length, 8, "Abfahrtsstaende");
    const schlimm: string[] = [];
    for (const s of alle) {
      const r = lauf(s);
      endlich([r.maxSprungM, r.maxEckeM], `Abfahrt ${s.name}`);
      mindestens(r.phasen.length, 8, `Phasen in ${s.name}`);
      if (r.maxSprungM > MAX_SCHRITT_M) {
        schlimm.push(
          `${r.name}: ${r.maxSprungM.toFixed(2)} m in einem Bild ` +
            `(${r.schlimmster?.vorherige} -> ${r.schlimmster?.phase})`
        );
      }
      if (r.maxEckeM > MAX_ECKE_M) {
        schlimm.push(`${r.name}: Umrissecke ${r.maxEckeM.toFixed(2)} m in einem Bild`);
      }
    }
    expect(schlimm.join("\n")).toBe("");
  });

  /**
   * DIE GEGENPROBE. Sie MUSS melden — und zwar auf jedem der drei
   * Warteplaetze und auf beiden Wegen (Abladeplatz und Silo). Ein Waechter,
   * der den alten Zustand nicht mehr erkennt, prueft nichts (E-062).
   */
  it("meldet den alten Sprungzustand auf jedem Warteplatz", () => {
    const alt = staende().filter((s) => s.faedeltAus === false && s.platz !== null);
    mindestens(alt.length, 2 * PARK_SLOTS.length, "Gegenproben mit Warteplatz");
    const gemeldet: string[] = [];
    for (const s of alt) {
      const r = lauf(s);
      endlich(r.maxSprungM, `Gegenprobe ${s.name}`);
      if (r.maxSprungM > MAX_SCHRITT_M) gemeldet.push(`${r.name}: ${r.maxSprungM.toFixed(2)} m`);
    }
    expect(gemeldet.length).toBe(alt.length);
    // Und der groesste davon ist ein Vielfaches des Fahrschritts, kein Rauschen.
    const groesster = Math.max(
      ...gemeldet.map((g) => Number(g.split(": ")[1]!.replace(" m", "")))
    );
    expect(groesster).toBeGreaterThan(5);
  });

  /**
   * DIE ZWEITE GEGENPROBE — und sie zielt auf den Sprung, der JEDE Fuhre
   * trifft: `leaveUnloadingBay` setzte `routeS = 0` und damit den Kipper um
   * die 1,4 m des Kippkriechens zurueck, mitten in den frischen Haufen.
   */
  it("meldet den Rueckversatz nach dem Kippkriechen auch ohne Warteplatz", () => {
    const alt = staende().filter((s) => s.faedeltAus === false && s.platz === null);
    mindestens(alt.length, 2, "Gegenproben ohne Warteplatz");
    for (const s of alt) {
      const r = lauf(s);
      endlich(r.maxSprungM, `Gegenprobe ${s.name}`);
      // TIP_CREEP_M ist 1,4 m; gemessen springt er 1,32 m zurueck.
      expect(r.maxSprungM).toBeGreaterThan(1.0);
      expect(r.schlimmster?.phase).toBe("out");
    }
  });

  /**
   * DIE PLATZFRAGE. Ein Wagen, der faehrt statt zu springen, ueberstreicht
   * Flaeche, die der Sprung uebersprungen hat. Er darf dabei in KEIN Bauwerk
   * geraten, in dem er vorher nicht war.
   *
   * Gemessen wird gepaart — alter gegen neuer Stand, derselbe Warteplatz,
   * dieselbe Fuhre. Absolute Schranken taugen hier nicht: `toPark` faehrt seit
   * jeher 0,70 m durch das KUPFER-LAGER Nord (eigener Befund, E-093, nicht in
   * diesem Paket behoben). Wer absolut prueft, prueft diesen Altbestand mit
   * und erfaehrt nichts ueber das Ausfaedeln.
   */
  it("faehrt beim Ausfaedeln in kein Bauwerk, in dem der Sprung nicht auch war", () => {
    const paare = staende().filter((s) => s.faedeltAus !== false);
    mindestens(paare.length, 8, "Paare");
    const schlimm: string[] = [];
    for (const neu of paare) {
      const altName = neu.name.replace("AUSFAEDELN", "SPRUNG");
      const alt = staende().find((s) => s.name === altName);
      expect(alt, `Gegenstueck zu ${neu.name}`).toBeDefined();
      const a = lauf(alt!);
      const n = lauf(neu);
      endlich([a.maxTiefeM, n.maxTiefeM], `Tiefen ${neu.name}`);
      // 1 cm Toleranz wie `UMRISS_TOLERANZ`: darunter ist es Rundung.
      if (n.maxTiefeM > a.maxTiefeM + 0.01) {
        schlimm.push(
          `${neu.name}: ${n.maxTiefeM.toFixed(2)} m statt ${a.maxTiefeM.toFixed(2)} m ` +
            `(${n.anstoesse[0]?.bauwerk} in Phase ${n.anstoesse[0]?.phase})`
        );
      }
    }
    expect(schlimm.join("\n")).toBe("");
  });

  /**
   * UND ER KOMMT AN. Ein Wagen, der sich beim Ausfaedeln festfaehrt, haelt den
   * ganzen Betrieb an — das waere schlimmer als der Sprung. Geprueft wird
   * ueber `done`: Der Zyklus ist zu Ende gefahren.
   */
  it("kommt vom Hof, ohne steckenzubleiben", () => {
    const alle = staende().filter((s) => s.faedeltAus !== false);
    mindestens(alle.length, 8, "Abfahrtsstaende");
    for (const s of alle) {
      const r = lauf(s);
      expect(r.phasen, `${s.name}: hat ausgefaedelt`).toContain("ausfaedeln");
      expect(r.phasen[r.phasen.length - 1], `${s.name}: letzte Phase`).toBe("out");
      /*
       * Die Fahrzeit darf nicht davonlaufen. Gemessen liegt ein voller Zyklus
       * mit Kaffeepause bei rund 120 s; 300 s waeren das Zweieinhalbfache und
       * hiessen: Er dreht sich irgendwo im Kreis.
       */
      expect(r.dauerS, `${s.name}: Fahrzeit`).toBeLessThan(300);
    }
  });
});
