/**
 * NIEMAND FAEHRT DURCH NIEMANDEN — und wo es heute doch passiert, steht die
 * Zahl hier.
 *
 * Anlass, woertlich (Patrick am Geraet, 17.09.2026): „LKWS fahren durch
 * Muellcontainer. Objekte fahren durch einander hindurch".
 *
 * WAS BISHER GEWACHT WAR UND WARUM ES NICHT GEREICHT HAT.
 * `test/fahrumriss.test.ts` faehrt seit E-054 jede STRECKE ab und prueft den
 * echten Fahrzeugumriss gegen jedes Bauwerk. Er ist gruen — zu Recht: Auf den
 * Strecken faehrt niemand durch etwas hindurch. Nur verlaesst ein Wagen den
 * Abladeplatz Richtung Warteplatz gar nicht auf einer Strecke. `toPark` und
 * `parkRueck` rechnen in `src/delivery/vehicles.ts` mit `dx/dz` eine Luftlinie
 * aus und schreiben sie direkt auf `group.position` — an `advance` vorbei und
 * damit an `isBlockedByBuilding` vorbei. Was auf dieser Luftlinie steht, kommt
 * in keiner Liste vor, die irgendjemand prueft.
 *
 * DAS IST DIESELBE FEHLERKLASSE WIE E-091: zwei Stellen, die dasselbe wissen
 * sollen, und sie wissen es verschieden. Dort war es die lichte Weite, hier
 * ist es „welche Wege ein Fahrzeug faehrt". Die Streckenliste
 * (`test/strecken.ts`) kennt vier Etappen je Fuhre; das Fahrzeug fuegt eine
 * fuenfte hinzu, die dort nicht steht.
 *
 * DREI FRAGEN, GETRENNT GEHALTEN — sie fuehren zu drei Reparaturen:
 *   1. Steht es in der Hindernisliste?   (Abschnitt „Die Hindernisliste")
 *   2. Fragt die Fahrt die Liste?        (Abschnitt „Der Weg zum Warteplatz")
 *   3. Gibt es einen Kollider, wirkt er? (Abschnitt „Kollider ohne Wirkung")
 *
 * ZU JEDER ZAHLENSCHRANKE GEHOERT EINE GEGENPROBE, DIE MELDEN MUSS. Sie steht
 * jeweils im selben Fall darunter.
 *
 * Gerechnet wird in `tools/durchfahrt-kern.ts` — derselben Datei, aus der auch
 * `tools/durchfahrt.ts` seinen Bericht zieht. Ein Waechter mit eigener Messung
 * prueft am Ende die Messung und nicht die Maschine (Lehre aus E-054).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import { CONFIGS } from "../src/world/containers";
import { alleHindernisse, setBuildingObstacles } from "../src/world/obstacles";
import { fahrzeugUmriss, umrissUeberlappung, UMRISS_TOLERANZ } from "../src/delivery/umriss";
import { bedLenFor, neueAbladestelle, routeInRev } from "../src/delivery/routes";
import {
  bauePlatz,
  behaelterKoerper,
  fahre,
  kinTempo,
  kontaktPunkte,
  stelleBehaelter,
  takt,
  tiefstePro,
  wagen,
  wirkungZwischen,
  type Platz,
  type Treffer,
} from "../tools/durchfahrt-kern";
import { pruefKunde } from "./pruefkunde";

leinwandAttrappe();

beforeAll(async () => {
  await initPhysics();
});

afterAll(() => {
  // Die beweglichen Bauwerke sind Modulzustand. Bliebe der Container stehen,
  // pruefte die naechste Datei gegen einen, den niemand dorthin gestellt hat.
  setBuildingObstacles([]);
});

/**
 * WO DER CONTAINER AM 17.09.2026 STAND.
 *
 * Aus Patricks Spielstand abgelesen und im Auftrag genannt: (−2,80 | −15,40).
 * Er ist seit E-034 frei versetzbar; das hier ist also kein Sollwert, sondern
 * die Lage, in der der Befund aufgetreten ist.
 */
const MUELL_PATRICK: [number, number] = [-2.8, -15.4];

/**
 * DER WARTEPLATZ, AUF DEN ES ANKOMMT.
 *
 * `PARK_SLOTS` in `src/delivery/routes.ts` fuehrt drei: (−18,5 | 24),
 * (−14,5 | 24) und (−26,0 | 6). Die ersten beiden liegen im Norden, der Weg
 * dorthin fuehrt am Container vorbei. Der dritte liegt im Westen, und die
 * Luftlinie vom Abladeplatz (6,3 | −23) zu seinem Anfahrtspunkt (−26 | −2)
 * schneidet die Stelle (−2,80 | −17,08) — 1,68 m innerhalb des Containers,
 * der von z −17,55 bis −13,25 reicht. Gemessen, nicht geschaetzt: siehe
 * `tools/durchfahrt.ts`.
 */
const WARTEPLATZ_WEST: [number, number] = [-26.0, 6];

/**
 * DIE FUHRE WIRD VORGEGEBEN, NICHT GEWUERFELT.
 *
 * Ein Kipper mit SORTENREINER Ladung faehrt in sein Lagersilo
 * (`routes.faehrtInsSilo`) und nicht an den Abladeplatz — sein Weg zum
 * Warteplatz beginnt dann an einer ganz anderen Ecke des Hofes. Ohne diese
 * Vorgabe waere der Waechter mal gruen und mal rot, und niemand wuesste,
 * welche der beiden Antworten gilt.
 */
function mischkipper(): ReturnType<typeof pruefKunde> {
  return pruefKunde({ vehicle: "kipper", aufbau: "flach", sortenrein: null, fuellgrad: 0.6 });
}

function platzMitContainer(x: number, z: number): Platz {
  const q = bauePlatz();
  for (let i = 0; i < 30; i++) takt(q);
  stelleBehaelter(q, "r_rubble", x, z);
  for (let i = 0; i < 30; i++) takt(q);
  return q;
}

/** Tiefste Durchdringung gegen einen bestimmten Gegenstand. */
function tiefsteGegen(treffer: readonly Treffer[], gegen: string): number {
  let tief = 0;
  for (const t of treffer) if (t.gegen === gegen && t.tiefe > tief) tief = t.tiefe;
  return tief;
}

/* ====================================================================== */

describe("Das Messgeraet misst nicht sich selbst", () => {
  it("NULLPROBE: ein Umriss neben dem Hof durchdringt nichts, einer auf einem Bauwerk schon", () => {
    setBuildingObstacles([]);
    const bauten = alleHindernisse();
    // Ohne diese Zeile waere der Fall gruen, wenn die Liste leer waere.
    expect(bauten.length, "die Hindernisliste ist leer").toBeGreaterThan(40);

    // 90 m noerdlich der Einfahrt steht nichts. Der Hof endet bei z 40.
    const frei = fahrzeugUmriss({ x: 0, z: 90, rot: 0 }, bedLenFor("kipper"));
    let tiefFrei = 0;
    for (const o of bauten) tiefFrei = Math.max(tiefFrei, umrissUeberlappung(frei, o));
    expect(tiefFrei, "ein Umriss 90 m neben dem Hof durchdringt etwas").toBe(0);

    /*
     * DIE GEGENPROBE, DIE MELDEN MUSS: derselbe Umriss mitten auf dem
     * Kaffeewagen. Sein Fussabdruck steht als `KAFFEE_FUSS` in
     * `src/world/yard.ts`; die Durchdringung ist die kleinere der beiden
     * vollen Ausdehnungen, gedeckelt auf die Fahrzeugbreite von 3,10 m
     * (`UMRISS_HALB_B` mal zwei).
     */
    const kaffee = bauten.find((o) => o.label === "Kaffeewagen")!;
    const drauf = fahrzeugUmriss({ x: kaffee.x, z: kaffee.z, rot: 0 }, bedLenFor("kipper"));
    const soll = Math.min(2 * kaffee.hw, 2 * kaffee.hd, 3.1);
    expect(
      umrissUeberlappung(drauf, kaffee),
      "das Messverfahren meldet eine offensichtliche Durchdringung nicht"
    ).toBeCloseTo(soll, 2);
  });
});

/* ====================================================================== */

describe("Die Hindernisliste", () => {
  it("fuehrt jeden beweglichen Behaelter — und meldet es, wenn einer fehlt", () => {
    const p = platzMitContainer(...MUELL_PATRICK);
    setBuildingObstacles(p.containers.hindernisse());
    const beweglich = p.containers.hindernisse();

    /*
     * DER BLINDE FLECK, NACH DEM GESUCHT WURDE (E-091 hatte ihn:
     * `test/spinnenmass.test.ts` prueft `kind: "rolloff"` gar nicht).
     * Hier ist er NICHT: Jeder Behaelter mit eigenem Koerper meldet sich.
     * Stand 17.09.2026 ist das genau einer — der MUELL-Container.
     */
    const sollBeweglich = CONFIGS.filter(
      (c) => c.kind === "rolloff" || c.kind === "grosscontainer"
    );
    expect(sollBeweglich.length, "kein beweglicher Behaelter mehr in CONFIGS").toBeGreaterThan(0);
    const fehlend = sollBeweglich
      .filter((c) => !beweglich.some((h) => h.label === c.label))
      .map((c) => c.label);
    expect(fehlend, `beweglich, aber nicht in der Hindernisliste: ${fehlend.join(", ")}`).toEqual(
      []
    );

    // Und die Gegenprobe: Ohne die Meldung ist die Liste um genau diese
    // Eintraege kuerzer. Bliebe sie gleich lang, pruefte der Fall nichts.
    const mit = alleHindernisse().length;
    setBuildingObstacles([]);
    const ohne = alleHindernisse().length;
    expect(mit - ohne, "die beweglichen Behaelter landen gar nicht in der Liste").toBe(
      beweglich.length
    );
  });

  it("BEFUND: der gemeldete Umriss ist 7 cm schmaler und 17,5 cm flacher als der gebaute Container", () => {
    /*
     * ZWEI STELLEN, DIE DASSELBE WISSEN SOLLEN.
     *
     * `ContainerManager.hindernisse()` meldet `size[0]/2 x size[1]/2` und
     * `top = size[2] + 0,2`. Gebaut wird in `containers.ts` aber mehr:
     *
     *   Rungen   sitzen auf `d/2 + 0,05` und sind 0,11 m tief  → 0,105 m ueber
     *   Riegel   ist `w + 0,14` breit                          → 0,07 m ueber
     *   Oberkante des Riegels liegt auf KUFE + T + h + 0,065
     *            = 0,22 + 0,09 + 0,80 + 0,065 = 1,175 m
     *   gemeldete Oberkante                                    = 1,00 m
     *
     * FOLGE: Der Baggerarm darf ueber `top` hinwegschwenken (`hitsObstacle`
     * mit `y`). Zwischen 1,00 und 1,175 m schwenkt er durch den Oberriegel,
     * den man sieht. Das ist klein, aber es ist genau die Bauart Fehler, die
     * Patrick am Geraet findet und kein Test.
     *
     * Dieser Fall haelt den IST-Stand fest. Wird er repariert, wird er ROT —
     * dann gehoert er umgeschrieben, nicht geloescht.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const h = p.containers.hindernisse().find((x) => x.label === "MUELL")!;
    const cfg = CONFIGS.find((c) => c.id === "r_rubble")!;
    const KUFE = 0.22; // containers.ts, rolloff-Zweig
    const WAND = 0.09; // ebenda, `const T`
    const RIEGEL = 0.13 / 2; // halbe Riegelhoehe, ebenda

    const gebauteOberkante = KUFE + WAND + cfg.size[2] + RIEGEL;
    expect(gebauteOberkante).toBeCloseTo(1.175, 3);
    expect(h.top, "die gemeldete Oberkante").toBeCloseTo(1.0, 3);
    expect(gebauteOberkante - h.top, "Luecke zwischen gebauter und gemeldeter Oberkante").toBeCloseTo(
      0.175,
      3
    );

    // In der Breite: der Riegel ragt 7 cm ueber den gemeldeten Umriss hinaus.
    expect(h.hw).toBeCloseTo(cfg.size[0] / 2, 3);
    expect((cfg.size[0] + 0.14) / 2 - h.hw, "Riegelueberstand in x").toBeCloseTo(0.07, 3);
    // In der Tiefe: die Rungen ragen 10,5 cm hinaus.
    expect(cfg.size[1] / 2 + 0.05 + 0.11 / 2 - h.hd, "Rungenueberstand in z").toBeCloseTo(0.105, 3);
  });
});

/* ====================================================================== */

describe("Der Weg zum Warteplatz", () => {
  /*
   * Eine ganze Fuhre dauert rund 2.600 Bilder mit Physik. Zwei Fahrten je
   * Lauf sind rund 10 s — vertretbar fuer den Fall, der den Befund haelt.
   */
  it("BEFUND: der Kipper faehrt auf dem Weg zum Westwarteplatz voll durch den MUELL-Container", () => {
    const p = platzMitContainer(...MUELL_PATRICK);
    const koerper = behaelterKoerper(p, "r_rubble")!;
    const vor = { ...koerper.translation() };
    const treffer = fahre(p, {
      kind: "kipper",
      kunde: mischkipper(),
      parkSpot: WARTEPLATZ_WEST,
      bisPhase: "parked",
      // Die Durchfahrt liegt bei Bild 2259 (gemessen). 3.000 Bilder reichen
      // fuer die ganze Fuhre samt Weg zum Warteplatz und halten den Waechter
      // bei rund 10 s — laenger wartet niemand gern auf `npm test`.
      bilder: 3000,
    });

    // Ohne diese Zeile waere der Fall gruen, wenn gar nicht gefahren worden waere.
    const phasen = new Set(treffer.map((t) => t.phase));
    expect(
      [...tiefstePro(treffer).keys()].length,
      "keine einzige Durchdringung aufgezeichnet — ist der Wagen ueberhaupt gefahren?"
    ).toBeGreaterThan(0);

    /*
     * GEMESSEN am 17.09.2026, `tools/durchfahrt.ts`: 3,10 m. Das ist die
     * volle Fahrzeugbreite (`UMRISS_HALB_B` 1,55 mal zwei) — der Wagen steckt
     * also nicht halb drin, er ist mittendurch. Bild 2259, Umrissmitte
     * (−2,0 | −16,5).
     */
    const tief = tiefsteGegen(treffer, "MUELL");
    expect(tief, "der Kipper geht nicht mehr durch den Container — Befund behoben?").toBeGreaterThan(
      3.0
    );
    expect(phasen.has("toPark"), "die Durchdringung passiert nicht in `toPark`").toBe(true);

    /*
     * UND DER CONTAINER BLEIBT DABEI STEHEN. 3,10 m Blech im Stahl, und er
     * weicht keine Handbreit aus — gemessen 0,035 m. Das ist die zweite
     * Haelfte des Befunds: Es liegt NICHT an fehlenden Kollidern.
     */
    const nach = koerper.translation();
    const versatz = Math.hypot(nach.x - vor.x, nach.z - vor.z);
    expect(versatz, "der Container weicht jetzt aus — Befund behoben?").toBeLessThan(0.2);
  });

  it("GEGENPROBE: ohne Warteplatz faehrt derselbe Kipper am Container vorbei", () => {
    /*
     * Die Gegenprobe zur Zahlenschranke darueber. Sie MUSS das Gegenteil
     * zeigen, sonst misst der Fall nur „irgendwas durchdringt irgendwas".
     *
     * Derselbe Wagen, derselbe Container, dieselbe Abtastung — nur ohne
     * Warteplatz. Dann faehrt er von `waitUnload`/`tipCreep` auf `out` und
     * damit auf eine STRECKE, und auf Strecken prueft `isBlockedByBuilding`
     * jedes Bild. Ergebnis: keine Durchdringung.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const treffer = fahre(p, {
      kind: "kipper",
      kunde: mischkipper(),
      parkSpot: null,
      bisPhase: "—",
      // Dieselbe Zahl wie oben: Bis Bild 3.000 waere die Durchfahrt laengst
      // passiert. Ein kuerzerer Lauf wuerde den Vergleich schief machen.
      bilder: 3000,
    });
    const phasen = new Set(treffer.map((t) => t.phase));
    expect(phasen.has("toPark"), "der Wagen ist doch auf einen Warteplatz gefahren").toBe(false);
    expect(
      tiefsteGegen(treffer, "MUELL"),
      "auch ohne Warteplatz faehrt er durch den Container"
    ).toBeLessThan(UMRISS_TOLERANZ);
  });
});

/* ====================================================================== */

describe("Kollider ohne Wirkung", () => {
  it("BEFUND: Kollider sind da, sie beruehren sich — nur haelt niemand niemanden auf", () => {
    /*
     * DIE WICHTIGSTE AUSKUNFT DES GANZEN PAKETS: Der Unterschied zwischen
     * „kein Kollider" und „Kollider, aber wirkungslos".
     *
     * Hier ist es zweifelsfrei das Zweite:
     *   - Der Container hat 5 Kollider (Boden und vier Waende), der LKW 3
     *     (Rahmen, Kippbruecke, Stirnwand).
     *   - Rapier fuehrt waehrend der Durchfahrt 32 Beruehrpunkte.
     *   - Das abgeleitete Tempo des LKW-Rahmens ist dabei 0,000 m/s.
     *
     * Der letzte Punkt ist der Grund. Ein kinematischer Koerper bekommt sein
     * Tempo aus `naechste Pose − jetzige Pose`. `toPark` ruft erst
     * `snapBodiesToPose()` (`setTranslation`, versetzt die JETZIGE Pose) und
     * meldet danach dieselbe Pose als NAECHSTE — die Differenz ist null. Der
     * Loeser sieht damit keinen Stoss, sondern eine ruhende Ueberdeckung, und
     * schiebt den Container nur traege heraus, waehrend der Wagen laengst
     * weitergesetzt ist.
     *
     * DAZU KOMMT DIE BAUART: kinematisch gegen dynamisch heisst „einer
     * weicht", und wer weicht, ist immer der dynamische. Ein LKW wird von
     * NICHTS aufgehalten — nicht vom Container, nicht von einer Mauer, nicht
     * von einem zweiten LKW. Nur die Wegplanung kann ihn anhalten.
     */
    const p = platzMitContainer(...MUELL_PATRICK);
    const muell = behaelterKoerper(p, "r_rubble")!;
    p.m.spawnNow("kipper", mischkipper());
    const w0 = wagen(p)!;
    w0.parkSpot = WARTEPLATZ_WEST;

    expect(muell.numColliders(), "der Container hat keine Kollider").toBe(5);
    expect(w0.chassisBody.numColliders() + w0.bedBody.numColliders()).toBeGreaterThan(0);
    expect(wirkungZwischen(w0.chassisBody, muell)).toBe("einer weicht");
    expect(wirkungZwischen(w0.chassisBody, w0.bedBody)).toBe("keiner weicht");

    /*
     * NICHT AN EINEM EINZELNEN BILD FESTMACHEN. Standzeit, Kippdauer und die
     * gewaehlte Drehrichtung wuerfeln bei jedem Lauf ein wenig anders; ein
     * Fall, der genau Bild 2268 ansieht, ist mal gruen und mal rot. Gesucht
     * wird deshalb ueber die ganze Fahrt das Bild mit der TIEFSTEN
     * Durchdringung — und von DEM werden Beruehrpunkte und Tempo genommen.
     */
    let tiefste = 0;
    let punkte = 0;
    let tempoImDurchfahren = Number.NaN;
    let tempoAufDerStrecke = 0;
    for (let f = 0; f < 3000; f++) {
      takt(p);
      const w = wagen(p);
      if (!w) break;
      if (w.phaseName === "approach") {
        tempoAufDerStrecke = Math.max(tempoAufDerStrecke, kinTempo(w.chassisBody));
      }
      if (w.phaseName !== "toPark") continue;
      const hind = alleHindernisse().find((o) => o.label === "MUELL");
      if (!hind) continue;
      for (const b of p.m.fahrzeugBoxen()) {
        const d = umrissUeberlappung(b, hind);
        if (d <= tiefste) continue;
        tiefste = d;
        punkte =
          kontaktPunkte(p.world, w.chassisBody, muell) + kontaktPunkte(p.world, w.bedBody, muell);
        tempoImDurchfahren = kinTempo(w.chassisBody);
      }
    }

    expect(tiefste, "der Wagen kam dem Container gar nicht nahe").toBeGreaterThan(1.0);
    expect(punkte, "Rapier fuehrt gar keine Beruehrung — dann WAERE es ein Kolliderproblem").toBeGreaterThan(10);
    /*
     * Auf der Strecke bewegt sich derselbe Koerper mit rund 4,9 m/s
     * (gemessen 4,890). Im `toPark` mit 0,000. Derselbe Wagen, dasselbe
     * Tempo ueber Grund — nur einmal bewegt und einmal versetzt.
     */
    expect(tempoAufDerStrecke, "auch auf der Strecke steht das Tempo auf null").toBeGreaterThan(3);
    expect(
      tempoImDurchfahren,
      "der Wagen bewegt sich jetzt auch im `toPark` — Befund behoben?"
    ).toBeLessThan(0.5);
  });

  it("GEGENPROBE: derselbe Container wird von der Westmauer sehr wohl gehalten", () => {
    /*
     * Waere der Container ein Gespenst, ginge er auch durch die Mauer. Er
     * geht nicht: dynamisch gegen fest loest Rapier auf. Damit ist bewiesen,
     * dass die Kollider des Containers wirken — und der Befund oben allein am
     * kinematischen Fahrzeug haengt.
     */
    const p = bauePlatz();
    for (let i = 0; i < 30; i++) takt(p);
    const muell = behaelterKoerper(p, "r_rubble")!;
    stelleBehaelter(p, "r_rubble", -34.0, -20.0);
    for (let i = 0; i < 60; i++) takt(p);
    muell.setLinvel({ x: -6, y: 0, z: 0 }, true);
    for (let i = 0; i < 240; i++) takt(p);
    // Die Westmauer der Betonlego-Umrandung steht auf x −36 (`YARD_MIN_X`).
    expect(muell.translation().x, "der Container ist durch die Westmauer gefahren").toBeGreaterThan(
      -36
    );
  });
});

/* ====================================================================== */

describe("Die Kehre auf der Stelle", () => {
  it("BEFUND: beim Eindrehen am Abladeplatz streift der Umriss bis 0,60 m durch die Ostwand", () => {
    /*
     * DIE DRITTE BEWEGUNG, DIE KEINE STRECKE IST.
     *
     * Seit E-081 dreht ein Wagen vor dem Rueckwaertsfahren AUF DER STELLE ein
     * (`lenkung.ts`, `PIVOT_AB` und die Regel „vor jeder Rueckwaertsfahrt").
     * Waehrend dieser Drehung steht er auf einem Wegpunkt, aber in einer
     * Gierlage, die auf KEINER Strecke vorkommt — `test/fahrumriss.test.ts`
     * tastet Strecken ab und bekommt genau diese Lagen nie zu sehen.
     *
     * Der Umriss ist 3,10 x rund 7,4 m. Auf der Stelle gedreht ueberstreicht
     * er einen Kreis von 4,0 m Halbmesser; der Abladeplatz liegt auf
     * x 6,30, die Ostwand beginnt bei x 8,45 (`YARD_MAX_X` minus
     * Wanddicke). Ueber alle 360 Grad abgetastet steckt der Wagen im
     * schlimmsten Fall 0,60 m in der Wand — und im gefahrenen Bogen wurden
     * 0,27 m gemessen (17.09.2026, `tools/durchfahrt.ts`, Bild 4341,
     * Umrissmitte 8,4 | −16,8).
     *
     * `lenkung.drehRichtung` waehlt bereits die Seite mit der GERINGEREN
     * Durchdringung (`tiefeBeiGier`). Der Rest bleibt trotzdem stehen; das
     * hier ist die Zahl dafuer.
     */
    setBuildingObstacles([]);
    neueAbladestelle();
    const halt = routeInRev()[0]!;
    const bauten = alleHindernisse();
    let tief = 0;
    let wo = "";
    for (let g = 0; g < 360; g++) {
      const u = fahrzeugUmriss(
        { x: halt[0], z: halt[1], rot: (g * Math.PI) / 180 },
        bedLenFor("kipper")
      );
      for (const o of bauten) {
        const d = umrissUeberlappung(u, o);
        if (d > tief) {
          tief = d;
          wo = o.label;
        }
      }
    }
    expect(wo, "die tiefste Durchdringung steckt nicht mehr in der Ostwand").toBe("Ostwand");
    expect(tief, "der Wagen dreht sich jetzt frei — Befund behoben?").toBeGreaterThan(0.5);

    /*
     * GEGENPROBE, DIE MELDEN MUSS: Derselbe Wagen auf demselben Punkt, aber
     * in der Gierlage, die die Strecke vorschreibt (rueckwaerts nach Sueden,
     * also 180 Grad). Dort ist er frei — und genau deshalb hat der
     * Streckenwaechter nichts gemeldet.
     */
    const aufDerStrecke = fahrzeugUmriss({ x: halt[0], z: halt[1], rot: Math.PI }, bedLenFor("kipper"));
    let tiefStrecke = 0;
    for (const o of bauten) tiefStrecke = Math.max(tiefStrecke, umrissUeberlappung(aufDerStrecke, o));
    expect(
      tiefStrecke,
      "auch in der Streckenlage steckt der Wagen in etwas — dann misst der Fall nicht die Kehre"
    ).toBeLessThan(UMRISS_TOLERANZ);
  });
});

/* ====================================================================== */

describe("Der Bagger gegen bewegliche Behaelter", () => {
  it("BEFUND: der Unterwagen darf 1,30 m in den Container hineinfahren", () => {
    /*
     * ZWEI ZAHLEN FUER DIESELBE MASCHINE, und sie widersprechen einander:
     *
     *   `src/excavator/collision.ts`  CHASSIS_PAD  = 1,30 m  (gegen Bauwerke)
     *   `src/excavator/excavator.ts`  UNTERWAGEN_R = 2,60 m  (gegen Fahrzeuge)
     *
     * `chassisHits()` fragt `hitsObstacle(p.x, p.z, CHASSIS_PAD)` — die Mitte
     * des Unterwagens haelt also 1,30 m vor der Aussenkante eines Bauwerks.
     * Gegen einen LKW haelt dieselbe Mitte 2,60 m Abstand. Der Unterschied,
     * 1,30 m, ist genau die Tiefe, um die der Unterwagen in den
     * MUELL-Container hineinragt, bevor irgendetwas anschlaegt.
     *
     * Das ist nicht gefahren, sondern aus den beiden Konstanten gerechnet.
     * Einfuehren lassen sie sich nicht: `CHASSIS_PAD` und `UNTERWAGEN_R` sind
     * beide modulintern. Deshalb stehen sie hier als Zahl MIT Fundstelle —
     * wer eine davon aendert, muss diesen Fall mitziehen.
     */
    const CHASSIS_PAD = 1.3; // src/excavator/collision.ts, Zeile 43
    const UNTERWAGEN_R = 2.6; // src/excavator/excavator.ts, Zeile 540
    expect(UNTERWAGEN_R - CHASSIS_PAD, "Ueberstand des Unterwagens ueber seinen Bauwerkspuffer").toBeCloseTo(
      1.3,
      3
    );

    // Gegenprobe: Waere der Puffer so gross wie der Unterwagen, waere es null.
    expect(UNTERWAGEN_R - UNTERWAGEN_R).toBe(0);
  });
});
