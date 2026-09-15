import { describe, it, expect, afterEach } from "vitest";
/**
 * Kein Fahrzeug faehrt durch eine Wand — gemessen am ECHTEN Umriss.
 *
 * Bis zum 15.09.2026 gab es diese Pruefung nicht. `test/fahrstrecke.test.ts`
 * haelt fest, DASS ein LKW ankommt, `test/collision.test.ts` prueft die
 * Wegpunkte als Punkte — beide sehen nicht, WO der Wagen durchfaehrt. Genau
 * dort ist der Fehler entstanden, den Patrick gemeldet hat: „Die fahren ja
 * durch die Wand, halb durch die Mulde."
 *
 * SEIT E-054 RECHNET DIESER WAECHTER NICHT MEHR SELBST. Umriss, Bahn und
 * Trennachsensatz stehen in `src/delivery/umriss.ts`, und `vehicles.ts`
 * benutzt dieselben Funktionen — fuer seine Standflaechen (`boxen`) und fuer
 * die Bauwerkspruefung waehrend der Fahrt (`isBlockedByBuilding`). Vorher
 * standen hier Abschriften, und sie waren nicht dieselbe Figur: Der Waechter
 * prueft ein Rechteck von 1,55 x ~4 m, die Fahrt prueft einen Punkt mit 1,40 m
 * Radius. Ein Waechter, der eine andere Figur prueft als die Fahrt, ist der
 * vierte gruene Waechter an einem Tag, der nichts prueft.
 *
 * Toleranz 1 cm: Darunter ist es Rundung, darueber steckt Blech in Beton.
 */

import { STATIC_OBSTACLES, setBuildingObstacles } from "../src/world/obstacles";
import { CONFIGS } from "../src/world/containers";
import { endlich, mindestens } from "./zahl";
// Kein Import aus `world/baggerstand` mehr: Seit E-029 rechnet dieser Waechter
// nicht mehr gegen den Baggerstand. Die drei Namen standen bis 15.09.2026 als
// tote Einfuhr hier und wurden von der neuen Typpruefung gemeldet (E-038).
import {
  routeApproach,
  routeInRev,
  routeOut,
  bayApproach,
  bayInRev,
  bayOut,
  ROUTE_IN_FWD,
  PICKUP_IN_FWD,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  neueAbladestelle,
  neueAbholstelle,
  alleAbholPlaetze,
  bedLenFor,
} from "../src/delivery/routes";
import {
  umrisseEntlang,
  umrissUeberlappung,
  fahrzeugUmriss,
  poseAuf,
  UMRISS_HALB_B,
  UMRISS_TOLERANZ,
  type Rechteck,
} from "../src/delivery/umriss";

/**
 * Alle Strecken, die auf dem Platz wirklich gefahren werden.
 *
 * Steht als eigene Funktion da, seit ein zweiter Waechter dieselbe Liste
 * braucht (E-041, der Startplatz des Muellcontainers). Zwei Abschriften
 * derselben Liste laufen auseinander, sobald eine Route dazukommt — und der
 * zweite Waechter prueft dann eine Strecke weniger, ohne es zu sagen.
 */
function alleStrecken(): Array<[string, Array<[number, number]>, string, boolean]> {
  neueAbladestelle();
  neueAbholstelle();
  const lager = CONFIGS.filter((c) => c.lager === true);
  const strecken: Array<[string, Array<[number, number]>, string, boolean]> = [
    ["Einfahrt", ROUTE_IN_FWD, "pritsche", false],
    ["Anfahrt", routeApproach(), "pritsche", false],
    ["Rangieren", routeInRev(), "pritsche", true],
    ["Ausfahrt", routeOut(), "pritsche", false],
    /*
     * DIESELBEN DREI STRECKEN NOCH EINMAL MIT DEM KIPPER (E-029).
     *
     * Er faehrt seit dem 15.09.2026 den Abladeplatz an wie alle anderen,
     * ist aber mit 6,00 m Ladeflaeche der LAENGSTE Wagen auf dem Platz —
     * 0,60 m mehr als die Pritsche, also 0,30 m mehr nach jeder Seite. Wer
     * nur die Pritsche abfaehrt, prueft die Strecke, auf der nichts
     * passiert.
     */
    ["Kipper-Anfahrt", routeApproach(), "kipper", false],
    ["Kipper-Rangieren", routeInRev(), "kipper", true],
    ["Kipper-Ausfahrt", routeOut(), "kipper", false],
    ["Abholer-Einfahrt", PICKUP_IN_FWD, "abholer", false],
  ];
  /*
   * JEDER HALTEPLATZ DES ABHOLERS, NICHT NUR EINER (E-056).
   *
   * Seit heute haengt er an der bestellten Fraktion: Stahlschrott und
   * Mischschrott an den Abladeplatz beim Bagger, alles mit Lagersilo an den
   * Verladeplatz vor dem Schenkel dieses Silos. Die Liste kommt aus
   * `routes.ts` selbst — wer ein Silo dazustellt, bekommt seine drei
   * Strecken hier automatisch mitgeprueft.
   */
  for (const p of alleAbholPlaetze()) {
    const wie = p.order ?? "gemischt";
    strecken.push([`Abholer ${wie} Anfahrt`, p.anfahrt, "abholer", false]);
    strecken.push([`Abholer ${wie} Rangieren`, p.rueckweg, "abholer", true]);
    strecken.push([`Abholer ${wie} Ausfahrt`, p.ausfahrt, "abholer", false]);
  }
  for (const c of lager) {
    strecken.push([`Silo ${c.label} Anfahrt`, bayApproach(c), "kipper", false]);
    strecken.push([`Silo ${c.label} Rangieren`, bayInRev(c), "kipper", true]);
    strecken.push([`Silo ${c.label} Ausfahrt`, bayOut(c), "kipper", false]);
  }
  for (const [i, p] of PARK_SLOTS.entries()) {
    strecken.push([
      `Parken ${i + 1}`,
      [
        [p[0], p[1] - PARK_ANFAHRT_M],
        [p[0], p[1]],
      ],
      "pritsche",
      true,
    ]);
  }
  return strecken;
}

/** Alle Fahrzeuglagen einer Streckenliste, mit ihrem Streckennamen. */
function alleLagen(): Array<[string, ReturnType<typeof fahrzeugUmriss>]> {
  const out: Array<[string, ReturnType<typeof fahrzeugUmriss>]> = [];
  for (const [name, route, kind, rev] of alleStrecken()) {
    for (const u of umrisseEntlang(route, bedLenFor(kind), rev)) out.push([name, u]);
  }
  return out;
}

afterEach(() => {
  // Der versetzte Muellcontainer unten setzt die Liste der beweglichen
  // Bauwerke. Bliebe er stehen, prueften die folgenden Dateien gegen einen
  // Container, den niemand dorthin gestellt hat.
  setBuildingObstacles([]);
});

describe("Kein Fahrzeugumriss schneidet ein festes Bauwerk", () => {
  it("auf keiner Route und in keinem Halt", () => {
    const strecken = alleStrecken();
    /*
     * ERST PRUEFEN, OB DIE STRECKE EINE IST.
     *
     * Am 15.09.2026 hat dieser Waechter zwei Stunden lang nichts gemeldet,
     * weil die Silo-Routen `NaN` enthielten: `bayApproach` bekam seit dem
     * Umbau einen Datensatz statt einer z-Koordinate, der Test uebergab
     * weiter `c.z` — und jeder Vergleich mit NaN ist falsch, also fand die
     * Trennachsenpruefung nie eine Ueberschneidung. Ein Test, der wegen
     * kaputter Eingaben gruen ist, ist schlimmer als keiner.
     *
     * Seit dem 15.09.2026 sieht `tsc` die Testordner an (E-038,
     * `tsconfig.test.json`) und faengt genau diesen Aufruf. Die Pruefung hier
     * bleibt trotzdem: Sie faengt, was erst zur Laufzeit `NaN` wird.
     *
     * Und die zweite Haelfte des Musters, die kein Typ faengt: Wieviele Faelle
     * sind es ueberhaupt? Ein Waechter, dessen Schleife leer blieb, meldet
     * dasselbe wie einer, der alles geprueft hat. Darum `mindestens(...)` —
     * Stand 15.09.2026 sind es 8 feste Strecken, drei je Halteplatz des
     * Abholers (9 Stueck), drei je Lagersilo und eine je Parkbucht.
     */
    mindestens(strecken.length, 40, "Fahrstrecken im Umrissbild");
    for (const [name, route] of strecken) {
      expect(route.length, `${name}: leere Strecke`).toBeGreaterThan(1);
      endlich(route, name);
    }
    const treffer = new Map<string, number>();
    /** Wieviele Fahrzeugumrisse tatsaechlich gegen Bauten gerechnet wurden. */
    let geprueft = 0;
    for (const [name, u] of alleLagen()) {
      geprueft++;
      for (const o of STATIC_OBSTACLES) {
        const d = umrissUeberlappung(u, o);
        if (d > UMRISS_TOLERANZ) {
          const k = `${name} | ${o.label}`;
          treffer.set(k, Math.max(treffer.get(k) ?? 0, d));
        }
      }
    }
    // Erst die Frage „wurde ueberhaupt gerechnet?", dann das Ergebnis. In der
    // Reihenfolge, weil „null Durchdringungen" sonst zweierlei heissen kann.
    mindestens(geprueft, 500, "gerechnete Fahrzeugumrisse");
    const zeilen = [...treffer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, d]) => `${d.toFixed(2)} m  ${k}`);
    expect(zeilen, ["Durchdringungen:", ...zeilen].join(" / ")).toEqual([]);
  });

  it("und keiner faehrt durch den Startplatz des Muellcontainers", () => {
    /*
     * DER MUELLCONTAINER STEHT IN KEINER FESTEN LISTE (E-034) — er ist
     * versetzbar und meldet seinen Umriss zur Laufzeit
     * (`ContainerManager.hindernisse`). Der Waechter oben laeuft deshalb an
     * ihm vorbei, ohne ihn je anzufassen: Bis E-041 stand in der Uebergabe
     * „kein Fahrzeugumriss schneidet den Container", geprueft hatte das
     * niemand.
     *
     * Hier wird er geprueft, und zwar nur an seinem STARTPLATZ. Wohin der
     * Spieler ihn stellt, ist seine Sache — auch mitten in die Einfahrt; dann
     * hupt der Fahrer, und das ist richtig so (der Fall darunter).
     *
     * Gemessen am 15.09.2026: 3,62 m Luft, am naechsten kommt ihm der Kipper
     * auf der Anfahrt.
     */
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    expect(muell.kind, "der MUELL ist kein versetzbarer Container mehr").toBe("rolloff");
    expect(
      Number.isFinite(muell.x) && Number.isFinite(muell.z),
      `Startplatz (${muell.x} | ${muell.z}) ist keine Koordinate`
    ).toBe(true);
    const platz: Rechteck & { label: string } = {
      x: muell.x,
      z: muell.z,
      hw: muell.size[0] / 2,
      hd: muell.size[1] / 2,
      label: "MUELL Startplatz",
    };
    const treffer = new Map<string, number>();
    let schritte = 0;
    for (const [name, u] of alleLagen()) {
      schritte++;
      const d = umrissUeberlappung(u, platz);
      if (d > UMRISS_TOLERANZ) treffer.set(name, Math.max(treffer.get(name) ?? 0, d));
    }
    // Ohne diese Zeile waere der Test gruen, wenn die Streckenliste leer waere.
    expect(schritte, "keine einzige Fahrzeuglage geprueft").toBeGreaterThan(500);
    const zeilen = [...treffer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, d]) => `${d.toFixed(2)} m  ${k}`);
    expect(zeilen, ["Durchfahrten durch den Container:", ...zeilen].join(" / ")).toEqual([]);
  });
});

/**
 * DER VERSETZTE MUELLCONTAINER — der Fall, den der alte Korridor verschlafen
 * hat (E-054).
 *
 * Der Container ist Platzinventar: Er steht dort, wo der Spieler ihn
 * hingestellt hat, und er meldet sich als bewegliches Bauwerk
 * (`setBuildingObstacles`). Ein Fahrer muss davor halten und hupen — er darf
 * nicht hindurchfahren.
 *
 * Geprueft wird an genau der Stelle, an der die beiden Korridore sich
 * unterscheiden: Der Container wird SEITLICH an die Rangierstrecke gestellt,
 * so dass er die Mittellinie nicht beruehrt, die Flanke des Wagens aber sehr
 * wohl. Der alte Korridor — ein Punkt mit 1,40 m Radius auf der Mittellinie —
 * ging daran vorbei; das Rechteck mit 1,55 m Halbbreite nicht.
 */
describe("Der versetzte Muellcontainer haelt einen Fahrer auf", () => {
  /**
   * Die Eckenfassung des Trennachsensatzes — langsam, aber offensichtlich
   * richtig. Sie steht hier als Massstab fuer die schnelle Fassung im
   * Quelltext und wird sonst von niemandem benutzt.
   */
  function ueberlappungAusEcken(
    r: { x: number; z: number; hw: number; hd: number; rot: number },
    o: Rechteck
  ): number {
    const c = Math.cos(r.rot);
    const s = Math.sin(r.rot);
    const A: Array<[number, number]> = [];
    for (const dx of [-r.hw, r.hw])
      for (const dz of [-r.hd, r.hd]) A.push([r.x + dx * c + dz * s, r.z - dx * s + dz * c]);
    const B: Array<[number, number]> = [
      [o.x - o.hw, o.z - o.hd],
      [o.x + o.hw, o.z - o.hd],
      [o.x + o.hw, o.z + o.hd],
      [o.x - o.hw, o.z + o.hd],
    ];
    const achsen: Array<[number, number]> = [
      [1, 0],
      [0, 1],
      [c, -s],
      [s, c],
    ];
    let min = Infinity;
    for (const [ax, az] of achsen) {
      let a0 = Infinity;
      let a1 = -Infinity;
      let b0 = Infinity;
      let b1 = -Infinity;
      for (const [x, z] of A) {
        const p = x * ax + z * az;
        a0 = Math.min(a0, p);
        a1 = Math.max(a1, p);
      }
      for (const [x, z] of B) {
        const p = x * ax + z * az;
        b0 = Math.min(b0, p);
        b1 = Math.max(b1, p);
      }
      const ov = Math.min(a1, b1) - Math.max(a0, b0);
      if (ov <= 0) return 0;
      min = Math.min(min, ov);
    }
    return min;
  }

  /** Der alte Korridor, zum Vergleich nachgebaut: Punkt auf der Mittellinie. */
  function alterKorridor(
    pose: { x: number; z: number },
    ziel: { x: number; z: number },
    o: Rechteck
  ): boolean {
    for (let t = 0.3; t <= 1.001; t += 0.235) {
      const x = pose.x + (ziel.x - pose.x) * t;
      const z = pose.z + (ziel.z - pose.z) * t;
      if (Math.abs(x - o.x) < o.hw + 1.4 && Math.abs(z - o.z) < o.hd + 1.4) return true;
    }
    return false;
  }

  it("der neue Umriss sieht ihn, der alte Korridor sah ihn nicht", () => {
    neueAbholstelle();
    const route = routeInRev();
    const bedLen = bedLenFor("pritsche");
    /*
     * DIE STELLE IST GERECHNET, NICHT GEGRIFFEN.
     *
     * Der Wagen setzt von (6,3 | −17,5) nach (6,3 | −23,0) zurueck, das Heck
     * voran; seine Flanken liegen auf x 4,75 und 7,85. Der Container misst
     * 3,60 x 4,30 m (`CONFIGS`, `r_rubble`), hat also 1,80 m halbe Breite.
     *
     *   Mitte x 3,05  →  Container reicht bis x 4,85, das sind 10 cm
     *                    INNERHALB der westlichen Flanke des Wagens.
     *   Mittellinie   →  3,25 m entfernt. Der alte Korridor tastete mit
     *                    1,40 m um den Punkt, zusammen mit der halben
     *                    Containerbreite reichte er bis 3,20 m. Er kam
     *                    5 cm zu kurz.
     *
     * Genau in diesem Streifen von 5 cm sitzt der Befund: Der Wagen faehrt
     * dem Container in die Flanke, und der Fahrer merkt nichts davon.
     */
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    const versetzt = {
      x: 3.05,
      z: -20.0,
      hw: muell.size[0] / 2,
      hd: muell.size[1] / 2,
      top: 2.0,
      label: "MUELL versetzt",
    };
    setBuildingObstacles([versetzt]);

    // Der neue Umriss: irgendwo auf der Rangierstrecke steckt Blech im Container.
    let tiefNeu = 0;
    for (const u of umrisseEntlang(route, bedLen, true)) {
      tiefNeu = Math.max(tiefNeu, umrissUeberlappung(u, versetzt));
    }
    expect(
      tiefNeu,
      `der Umriss faehrt frei am versetzten Container vorbei (${tiefNeu.toFixed(2)} m)`
    ).toBeGreaterThan(UMRISS_TOLERANZ);

    /*
     * DERSELBE FALL MIT DEM ALTEN KORRIDOR — und er bleibt stumm.
     *
     * Das ist die Gegenprobe, die verlangt ist: „Sieh jeden Waechter einmal
     * scheitern." Der alte Korridor tastet vom Ursprung aus vier Punkte
     * zwischen 1,2 und 4,0 m voraus ab, mit 1,40 m Radius. Bliebe er, waere
     * der Fall hier gruen und der Container unsichtbar.
     */
    let alterTreffer = false;
    for (let s = 0; s <= 5.5; s += 0.25) {
      const jetzt = poseAuf(route, s, true);
      const voraus = poseAuf(route, s + 4, true);
      if (alterKorridor(jetzt, voraus, versetzt)) alterTreffer = true;
    }
    expect(
      alterTreffer,
      "der alte 1,40-m-Korridor haette den Container gesehen — dann war er nicht der Fehler"
    ).toBe(false);
  });

  it("und der schnelle Trennachsensatz rechnet dasselbe wie die Eckenfassung", () => {
    /*
     * DER FEHLER, DEN DIESER FALL GEFUNDEN HAT (15.09.2026).
     *
     * Die Pruefung laeuft jetzt in jedem Bild fuer jedes Fahrzeug, deshalb
     * rechnet sie ohne Zwischenlisten: statt acht Ecken zu projizieren,
     * werden auf jeder Achse die halben Ausdehnungen addiert. Die erste
     * Fassung davon war falsch — bei TIEFER Ueberdeckung meldete sie 4,05 m
     * Durchdringung, wo die Eckenfassung 3,10 m sagt. Der Grund ist eine
     * Zeile Schulmathematik: Die Ueberlappung zweier Strecken ist nicht
     * einfach „Summe der Haelften minus Mittenabstand", sondern hoechstens
     * die ganze Laenge der kuerzeren.
     *
     * Aufgefallen ist es nicht beim Nachdenken, sondern beim Gegenrechnen.
     * Deshalb steht das Gegenrechnen jetzt hier: 20.000 Zufallslagen, beide
     * Fassungen, Unterschied unter einem Zehntelmillimeter.
     */
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    const o: Rechteck = { x: 0, z: 0, hw: muell.size[0] / 2, hd: muell.size[1] / 2 };
    let schlimmst = 0;
    let treffer = 0;
    // Feste Folge statt Math.random: ein Waechter, der bei jedem Lauf etwas
    // anderes prueft, ist kein Waechter.
    let saat = 12345;
    const wuerfel = (): number => {
      saat = (saat * 1103515245 + 12345) % 2147483648;
      return saat / 2147483648;
    };
    for (let i = 0; i < 20000; i++) {
      const u = fahrzeugUmriss(
        {
          x: (wuerfel() - 0.5) * 16,
          z: (wuerfel() - 0.5) * 16,
          rot: wuerfel() * Math.PI * 2,
        },
        bedLenFor("pritsche")
      );
      const a = ueberlappungAusEcken(u, o);
      if (a > 0) treffer++;
      schlimmst = Math.max(schlimmst, Math.abs(a - umrissUeberlappung(u, o)));
    }
    // Erst: wurde ueberhaupt etwas getroffen? Sonst vergleicht man Nullen.
    mindestens(treffer, 2000, "ueberlappende Zufallslagen");
    expect(schlimmst, `groesster Unterschied ${schlimmst.toExponential(2)} m`).toBeLessThan(
      1e-4
    );
  });

  it("und die Flanke, die er verfehlt hat, ist 15 cm breit", () => {
    /*
     * Die Zahl hinter dem Befund, damit sie nicht wieder verlorengeht: Der
     * Wagen ist 1,55 m halb breit, der alte Korridor tastete mit 1,40 m
     * Radius. Die aeusseren 15 cm jeder Flanke wurden nie geprueft — und an
     * den Ecken deutlich mehr, weil ein Kreis keine Ecken hat: Die Diagonale
     * eines Rechtecks von 1,55 x 3,72 m misst 4,03 m.
     */
    expect(UMRISS_HALB_B - 1.4).toBeCloseTo(0.15, 6);
    const u = fahrzeugUmriss({ x: 0, z: 0, rot: 0 }, bedLenFor("pritsche"));
    expect(Math.hypot(u.hw, u.hd), "Diagonale des Umrisses").toBeGreaterThan(4.0);
  });
});
