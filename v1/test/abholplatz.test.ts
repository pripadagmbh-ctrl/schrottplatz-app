/**
 * Waechter fuer E-056: Der Abholer haelt dort, wo das bestellte Material liegt.
 *
 * Ansage Patrick am Geraet, 15.09.2026: „Der Abholer ist in der falschen Spur.
 * Wenn ich Stahlschrott oder Mischschrott beauftrage, soll er zu mir zum
 * Baggerstand kommen. Und wenn ich ein sortenreines Metall zur Abholung
 * ausrufe, soll er genau dahin fahren, wo die entsprechende Mulde ist."
 *
 * Geprueft wird nicht die Koordinate, sondern die EIGENSCHAFT, an der alles
 * haengt: Von dem Platz, an dem der Bagger dazu steht, muss der Spieler
 * sowohl das Material als auch die Ladeflaeche erreichen, ohne umzusetzen.
 * Ein Halteplatz, der das nicht erfuellt, ist eine Sackgasse — man bestellt
 * eine Abholung und kann sie nicht beladen.
 */
import { describe, it, expect } from "vitest";
import {
  abholPlatzFuer,
  alleAbholPlaetze,
  verladeStandFuer,
  verladeHaltFuer,
  neueAbholstelle,
  abholstelle,
  pickupApproach,
  pickupInRev,
  pickupOut,
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  BED_HALF_W,
  bedLenFor,
  VERLADE_SPUR_X,
  WORK_ZONES,
} from "../src/delivery/routes";
import { CONFIGS, bayVorderkante, lagerMuldeFuer } from "../src/world/containers";
import { abholerFunk } from "../src/delivery/customers";
import {
  BAGGER_STAND,
  VERLADE_STAND,
  SCHWENK_INNEN,
  SCHWENK_AUSSEN,
} from "../src/world/baggerstand";

/**
 * Bis hierher erreicht der Arm ueberhaupt noch den Boden (m).
 *
 * Aus `test/reach.test.ts`: „Der Arm hat einen scharfen Knick bei rund 6,5 m —
 * naeher dran bleibt er eingeklappt, jenseits von 9,5 m reicht er nicht mehr."
 * Das Schwenkband 5,80 … 9,20 ist die bequeme Zone, 9,50 die harte Grenze.
 */
const REICHT_BODEN = 9.5;

/** Die vier Ecken der Ladeflaeche an einem Halteplatz. */
function ladeflaechenEcken(p: ReturnType<typeof abholPlatzFuer>): Array<[number, number]> {
  const bl = bedLenFor("abholer");
  const [hx, hz] = p.halt;
  // Der Wagen steht mit der Laengsseite zum Bagger; seine lange Achse zeigt
  // in die Richtung, in der er zurueckgesetzt hat.
  const laengsX = p.rueckweg[0]![0] !== p.rueckweg[1]![0];
  const out: Array<[number, number]> = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      out.push(
        laengsX
          ? [hx + a * (bl / 2), hz + b * BED_HALF_W]
          : [hx + a * BED_HALF_W, hz + b * (bl / 2)]
      );
    }
  return out;
}

describe("Wohin der Abholer faehrt", () => {
  it("Stahlschrott, Mischschrott und 'gemischt' kommen an den Abladeplatz beim Bagger", () => {
    /*
     * Stahlschrott hat mit E-010 ausdruecklich KEIN Lagersilo („Stahl
     * entfaellt — Stahlschrott wird direkt an der Halde verladen"), und
     * Mischschrott ebenso wenig. Wer sie bestellt, bekommt den Wagen an die
     * Halde; eine Bestellung ohne Fraktion („Gemischt, schlechter Preis")
     * gehoert in dieselbe Klasse.
     */
    for (const order of [null, "steel", "mixed"]) {
      const p = abholPlatzFuer(order);
      expect(p.ziel, `${order ?? "gemischt"} hat ein Lagersilo bekommen`).toBeNull();
      expect(p.halt, `${order ?? "gemischt"} haelt woanders`).toEqual([
        ABLADE_SPUR_X,
        ABLADE_HALT_Z,
      ]);
      expect(p.stand.x).toBeCloseTo(BAGGER_STAND.x, 6);
      expect(p.stand.z).toBeCloseTo(BAGGER_STAND.z, 6);
    }
  });

  it("und jede Fraktion mit Lagersilo an den Verladeplatz ihres Schenkels", () => {
    // Datengetrieben: Die Liste kommt aus den Behaeltern, nicht aus dem Test.
    for (const c of CONFIGS.filter((s) => s.lager === true)) {
      const p = abholPlatzFuer(c.fractionId);
      expect(p.ziel?.id, `${c.fractionId} findet sein Silo nicht`).toBe(c.id);
      expect(p.halt, `${c.label}`).toEqual(verladeHaltFuer(c));
      // Beide Silos eines zusammengelegten Paares fuehren an denselben Platz.
      for (const mit of c.mitFraktionen ?? []) {
        expect(abholPlatzFuer(mit).halt, `${mit} haelt woanders als ${c.label}`).toEqual(
          p.halt
        );
      }
    }
  });

  it("und jede dieser Regeln steht am Platz, nicht im Fahrzeugcode", () => {
    /*
     * Die Gegenprobe: Der Halteplatz haengt an EINER Frage, und die
     * beantwortet der Platz — gibt es fuer diese Fraktion ein Lagersilo? Wer
     * eines Tages ein Stahlsilo baut, bekommt den Abholer dorthin, ohne dass
     * eine Zeile geaendert wird.
     */
    for (const p of alleAbholPlaetze()) {
      expect(p.ziel?.id ?? null).toBe(lagerMuldeFuer(p.order)?.id ?? null);
    }
  });
});

describe("Von seinem Stand aus kommt der Spieler an alles heran", () => {
  it("am Abladeplatz liegen alle vier Ecken der Ladeflaeche im Schwenkband", () => {
    /*
     * Dieselbe Bedingung, die E-022/E-029 fuer den Anlieferer gerechnet
     * haben: 5,88 · 6,32 · 8,44 · 8,76 m. Sie gilt fuer den Abholer
     * unveraendert — er hat dieselbe Ladeflaechenlaenge wie die Pritsche
     * (5,40 m). Deshalb bekommt er KEINEN eigenen Platz: Zwei Plaetze, wo
     * einer reicht, sind eine zweite Wahrheit.
     */
    const p = abholPlatzFuer("steel");
    const d = ladeflaechenEcken(p)
      .map(([x, z]) => Math.hypot(x - p.stand.x, z - p.stand.z))
      .sort((a, b) => a - b);
    expect(d.map((v) => Number(v.toFixed(2)))).toEqual([5.88, 6.32, 8.44, 8.76]);
    for (const v of d) {
      expect(v, `Ecke ${v.toFixed(2)} m`).toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(v, `Ecke ${v.toFixed(2)} m`).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    }
  });

  it("und an jedem Verladeplatz sind ALLE Silos des Schenkels im Band", () => {
    /*
     * DAS IST DIE FRAGE, DIE DEN ZWEITEN VERLADEPLATZ NOETIG GEMACHT HAT.
     *
     * Bis heute gab es einen einzigen, auf (−25,5 | −8,0). Von dort sind die
     * drei WESTsilos 8,80 · 7,50 · 8,80 m entfernt — die drei SUEDsilos aber
     * 14,0 bis 14,8 m. Drei von sechs. Wer Edelstahl bestellte, bekam den
     * Wagen an eine Stelle, von der aus sein Silo unerreichbar war.
     *
     * Der Stand steht deshalb je Schenkel vor dessen MITTLEREM Silo, und von
     * dort sind es wieder 8,80 · 7,50 · 8,80 m — dieselben drei Zahlen, weil
     * dieselbe Geometrie.
     */
    for (const p of alleAbholPlaetze()) {
      if (!p.ziel) continue;
      const schenkel = CONFIGS.filter(
        (c) => c.lager === true && c.facing === p.ziel!.facing
      );
      expect(schenkel.length, `Schenkel ${p.ziel.facing} ist leer`).toBeGreaterThan(0);
      for (const s of schenkel) {
        const k = bayVorderkante(s);
        const d = Math.hypot(k.x - p.stand.x, k.z - p.stand.z);
        expect(d, `${s.label} ist ${d.toFixed(2)} m vom Stand`).toBeGreaterThanOrEqual(
          SCHWENK_INNEN
        );
        expect(d, `${s.label} ist ${d.toFixed(2)} m vom Stand`).toBeLessThanOrEqual(
          SCHWENK_AUSSEN
        );
      }
    }
  });

  it("und die Ladeflaeche bleibt in Reichweite, auch an ihren fernen Ecken", () => {
    /*
     * GEMESSEN UND OFFEN GELEGT: An den Verladeplaetzen liegen die beiden
     * FERNEN Ecken der Ladeflaeche auf 9,25 m — 5 cm ueber der Obergrenze des
     * bequemen Schwenkbands (9,20 m). Sie sind nicht unerreichbar: Der Arm
     * kommt bis 9,50 m an den Boden, und die hoechste Krallenspitze steht
     * dort noch 2,33 m hoch, also klar ueber der Bordwand von 1,00 m
     * (gemessen mit `tools/verladeplaetze.ts`).
     *
     * Die 5 cm sind kein Zufall, sondern Arithmetik: 7,50 m Spurabstand plus
     * 1,35 m halbe Ladeflaechenbreite ergeben quer 8,85 m, dazu 2,70 m laengs
     * — hypot(8,85 | 2,70) = 9,25. Wer sie loswerden will, rueckt die Spur um
     * 10 cm naeher an den Stand (7,40 m); dann sind es 9,16 m. Das bricht die
     * Symmetrie „7,5 zum Silo, 7,5 zur Spur" und ist deshalb eine
     * Entscheidung, keine Reparatur.
     */
    for (const p of alleAbholPlaetze()) {
      const d = ladeflaechenEcken(p).map(([x, z]) =>
        Math.hypot(x - p.stand.x, z - p.stand.z)
      );
      for (const v of d) {
        expect(v, `${p.name}: Ecke ${v.toFixed(2)} m zu nah`).toBeGreaterThanOrEqual(
          SCHWENK_INNEN
        );
        expect(v, `${p.name}: Ecke ${v.toFixed(2)} m ausser Reichweite`).toBeLessThanOrEqual(
          REICHT_BODEN
        );
      }
    }
  });

  it("und der Bagger steht zwischen Silo und Lastwagen, nie daneben", () => {
    for (const p of alleAbholPlaetze()) {
      if (!p.ziel) continue;
      const k = bayVorderkante(p.ziel);
      // Silo und Halt liegen auf entgegengesetzten Seiten des Stands.
      const zumSilo = [k.x - p.stand.x, k.z - p.stand.z];
      const zumLkw = [p.halt[0] - p.stand.x, p.halt[1] - p.stand.z];
      const skalar = zumSilo[0]! * zumLkw[0]! + zumSilo[1]! * zumLkw[1]!;
      expect(skalar, `${p.name}: Silo und LKW auf derselben Seite`).toBeLessThan(0);
    }
  });
});

describe("Der Westschenkel behaelt genau die Zahlen, die er hatte", () => {
  it("der gerechnete Stand ist der alte VERLADE_STAND", () => {
    /*
     * Die Halteplaetze werden seit E-056 aus der Silo-Geometrie gerechnet und
     * stehen nicht mehr als Zahl da. Damit daraus keine zweite Wahrheit wird,
     * haelt dieser Fall fest: Fuer den Westschenkel kommt genau heraus, was
     * `world/baggerstand.ts` und `VERLADE_SPUR_X` seit E-028 sagen.
     */
    const kabel = CONFIGS.find((c) => c.id === "c_cable_lager")!;
    const stand = verladeStandFuer(kabel);
    expect(stand.x).toBeCloseTo(VERLADE_STAND.x, 6);
    expect(stand.z).toBeCloseTo(VERLADE_STAND.z, 6);
    const [hx, hz] = verladeHaltFuer(kabel);
    expect(hx).toBeCloseTo(VERLADE_SPUR_X, 6);
    expect(hz).toBeCloseTo(VERLADE_STAND.z, 6);
  });

  it("und der Suedschenkel bekommt seinen eigenen, 6,5 m daneben", () => {
    const va = CONFIGS.find((c) => c.id === "c_va_lager")!;
    const sued = verladeStandFuer(va);
    // Mittleres Silo des Suedschenkels ist BATTERIEN auf x −25,4; die
    // Oeffnungen liegen auf z −22,0, der Stand also 7,5 m davor.
    expect(sued.x).toBeCloseTo(-25.4, 6);
    expect(sued.z).toBeCloseTo(-14.5, 6);
    const weg = Math.hypot(sued.x - VERLADE_STAND.x, sued.z - VERLADE_STAND.z);
    expect(weg, `${weg.toFixed(2)} m zwischen den beiden Verladeplaetzen`).toBeLessThan(7);
  });
});

describe("Jeder Halteplatz hat seine eigene Arbeitszone", () => {
  it("sonst haelt der Abholer vor seinem eigenen Verladeplatz an und hupt", () => {
    /*
     * In den Arbeitszonen gilt liegender Schrott NICHT als Blockade — dorthin
     * muss der Wagen ja gerade. Fehlt die Zone, ist der erste Brocken, den
     * der Spieler danebenlegt, ein Sperrgrund.
     */
    for (const p of alleAbholPlaetze()) {
      const [hx, hz] = p.halt;
      const drin = WORK_ZONES.some(([zx, zz, zr]) => Math.hypot(zx - hx, zz - hz) < zr);
      expect(drin, `${p.name} (${hx} | ${hz}) liegt in keiner Arbeitszone`).toBe(true);
    }
  });
});

describe("Der Abholer funkt durch, wo er steht", () => {
  /*
   * Entscheidung Patrick, 15.09.2026: „Er funkt es an, wie ein Fahrer" —
   * eine kurze Zeile beim Eintreffen, in der Art von „Bin am Kupfer-Silo".
   * Verworfen: ein Zeiger am Bildrand und gar nichts.
   *
   * Geprueft wird die Eigenschaft, nicht der Wortlaut: Im Spruch steht die
   * AUFSCHRIFT des Behaelters, an dem er haelt. Damit gibt es keine zweite
   * Liste, die beim naechsten Umzug der Silo-Reihe zurueckbleibt.
   */
  it("und nennt dabei das Schild, das an der Mulde steht", () => {
    for (const c of CONFIGS.filter((s) => s.lager === true)) {
      const p = abholPlatzFuer(c.fractionId);
      for (let i = 0; i < 30; i++) {
        const spruch = abholerFunk(p.ziel?.label ?? null);
        expect(spruch, `„${spruch}" nennt ${c.label} nicht`).toContain(c.label);
        // Kurz genug fuer eine Zeile auf dem iPhone mini.
        expect(spruch.length, `„${spruch}" ist zu lang fuer eine Zeile`).toBeLessThan(45);
      }
    }
  });

  it("und beim Bagger sagt er, dass er vorn steht — ohne Schild", () => {
    const p = abholPlatzFuer("steel");
    expect(p.ziel).toBeNull();
    for (let i = 0; i < 30; i++) {
      const spruch = abholerFunk(p.ziel?.label ?? null);
      expect(spruch.length).toBeGreaterThan(5);
      expect(spruch.length).toBeLessThan(45);
      // Kein Schildname, den es an dieser Stelle gar nicht gibt.
      for (const c of CONFIGS.filter((s) => s.lager === true)) {
        expect(spruch, `„${spruch}" nennt ${c.label}, obwohl er beim Bagger steht`).not.toContain(
          c.label
        );
      }
    }
  });
});

describe("Die Strecken folgen der Bestellung", () => {
  it("nach der Bestellung stehen Anfahrt, Rangieren und Ausfahrt auf denselben Platz", () => {
    for (const c of CONFIGS.filter((s) => s.lager === true)) {
      neueAbholstelle(c.fractionId);
      const halt = verladeHaltFuer(c);
      expect(abholstelle()).toEqual(halt);
      // Die Rangierstrecke endet am Halt, die Ausfahrt beginnt dort.
      expect(pickupInRev().at(-1)).toEqual(halt);
      expect(pickupOut()[0]).toEqual(halt);
      // Und die Anfahrt endet dort, wo das Rangieren beginnt.
      expect(pickupApproach().at(-1)).toEqual(pickupInRev()[0]);
    }
    // Zurueck auf den Ausgangszustand fuer alles, was danach laeuft.
    neueAbholstelle();
    expect(abholstelle()).toEqual([ABLADE_SPUR_X, ABLADE_HALT_Z]);
  });

  it("und der Rangierpunkt liegt in keinem Silo", () => {
    /*
     * Je Schenkel gibt es zwei moegliche Anfahrtsrichtungen, und eine davon
     * endet im Bauwerk: Am Suedschenkel laege der Rangierpunkt bei Anfahrt
     * von Westen auf (−33,4 | −7,0) und damit mitten im KABEL-LAGER (x −39,0
     * … −33,0, z −10,1 … −5,9). Dieser Fall haelt fest, dass die andere
     * gewaehlt ist; die ganze Strecke prueft `test/fahrumriss.test.ts`.
     */
    const va = abholPlatzFuer("va");
    const rangier = va.rueckweg[0]!;
    expect(rangier[0], "der Suedschenkel wird von Osten angefahren").toBeGreaterThan(
      va.halt[0]
    );
  });
});
