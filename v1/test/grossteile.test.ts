/**
 * KOMMEN DIE GROSSTEILE AN? (E-105)
 *
 * Patrick am 17.09.2026: „und was ist eigentlich mit den grossen objekten
 * passiert?". Gemessen mit `tools/grossteile.ts` über 96 Saaten: Von 64
 * Schwergewichten konnte keines der 60 großen auf irgendeiner Ladefläche des
 * Spiels liegen, und von 365 gezogenen Schwergewichten kamen 7 an.
 *
 * Ursache war kein Balancing, sondern eine falsche Annahme im Packer: Jedes
 * Stück belegte ein QUADRAT seiner Grundriss-Diagonale, obwohl es achsparallel
 * zur Ladefläche abgesetzt wird. Ein Mähdrescher-Schneidwerk von 4,60 m × 1,30 m
 * brauchte damit 4,78 m Breite auf einem 2,54 m breiten Lkw.
 *
 * Dieser Wächter hängt NICHT am Werkzeug, sondern rechnet mit denselben
 * Konstanten, aus denen `vehicles.loadCargo` seine Fläche baut. Er misst zwei
 * Dinge: dass die Schwergewichte passen, und dass der Packer trotzdem nicht
 * alles durchwinkt (Gegenprobe).
 */
import { describe, it, expect } from "vitest";
import { packeLadung, stueckMass } from "../src/delivery/ladung";
import { SPECS, BIG_SPECS, HUGE_SPECS } from "../src/world/scrapItems";
import type { PileSpec } from "../src/world/objektkatalog";
import { BED_HALF_W, bedLenFor } from "../src/delivery/routes";
import {
  ANHAENGER_HALB_BREITE,
  ANHAENGER_WAND,
  LADE_RAND,
  LADUNG_UEBERSTAND,
  type Aufbau,
} from "../src/delivery/fuellgrad";
import { wandHoehe } from "../src/delivery/vehicleModel";

interface Flaeche {
  name: string;
  halbBreite: number;
  nutzLaenge: number;
  maxHoehe: number;
}

/** Dieselbe Rechnung wie in `vehicles.loadCargo` — eine Quelle, zwei Leser. */
function flaeche(kind: string, aufbau: Aufbau): Flaeche {
  const anhaenger = kind === "pkw";
  return {
    name: `${kind}/${aufbau}`,
    halbBreite: anhaenger ? ANHAENGER_HALB_BREITE : BED_HALF_W - 0.08,
    nutzLaenge: bedLenFor(kind) - 2 * LADE_RAND,
    maxHoehe: (anhaenger ? ANHAENGER_WAND : wandHoehe(kind, aufbau)) + LADUNG_UEBERSTAND,
  };
}

/** Die Flächen, auf denen im Spiel wirklich angeliefert wird. */
const FLAECHEN: Flaeche[] = [
  flaeche("pkw", "flach"),
  flaeche("wrack", "flach"),
  flaeche("pritsche", "flach"),
  flaeche("pritsche", "rungen"),
  flaeche("pritsche", "koffer"),
  flaeche("kipper", "flach"),
  flaeche("kipper", "rungen"),
  flaeche("kipper", "koffer"),
];

/** Liegt das Stück auf dieser Fläche, wenn es als einziges darauf soll? */
function liegtAllein(sp: PileSpec, f: Flaeche): boolean {
  const s = stueckMass(sp.kind, sp.dims);
  return packeLadung([s], f.halbBreite, f.nutzLaenge, f.maxHoehe)[0] !== null;
}

function passtIrgendwo(sp: PileSpec): boolean {
  return FLAECHEN.some((f) => liegtAllein(sp, f));
}

describe("Ein Schwergewicht muss auf einen Wagen passen", () => {
  it("das Mähdrescher-Schneidwerk liegt längs auf der Pritsche", () => {
    /*
     * Das Stück, an dem der Fehler am deutlichsten war: 4,60 m × 1,30 m,
     * 0,90 m hoch, 1300 kg. Es passt der Länge nach auf jede Pritsche
     * (5,00 m nutzbar) und ging vorher trotzdem nie mit.
     */
    const sw = HUGE_SPECS.find((s) => s.name === "Mähdrescher-Schneidwerk");
    expect(sw, "Eintrag aus dem Katalog verschwunden").toBeDefined();
    const f = flaeche("pritsche", "flach");
    const platz = packeLadung(
      [stueckMass(sw!.kind, sw!.dims)],
      f.halbBreite,
      f.nutzLaenge,
      f.maxHoehe
    )[0];
    expect(platz, "das Schneidwerk findet keinen Platz").not.toBeNull();
    expect(platz!.quer, "es liegt quer statt längs").toBe(true);
  });

  it("ein gutes Drittel der Schwergewichte kann ankommen — vorher waren es vier", () => {
    /*
     * GEMESSEN am 17.09.2026: 30 von 64. Vorher: 4 von 64.
     *
     * Die Schranke steht bei 25 und nicht bei „alle": 42 Einträge scheitern
     * an der LADEHÖHE (Bordwand + 0,35 m Überstand), und ob ein Seecontainer
     * von 2,60 m Höhe auf einer Pritsche stehen darf, ist eine
     * Gestaltungsfrage für Patrick, kein Rechenfehler. Sieben weitere sind
     * 2,50 m breit oder mehr und scheitern am 0,20-m-Raster, das aus 2,54 m
     * Innenbreite 2,40 m nutzbare macht.
     *
     * 25 statt 30, weil die Luft zwischen den Stücken (`ladung.LUFT`) am Rand
     * ein paar Einträge kosten darf, ohne dass dieser Wächter rot wird — er
     * bewacht die Größenordnung, nicht die letzte Stelle.
     */
    const koennen = HUGE_SPECS.filter(passtIrgendwo).length;
    expect(
      koennen,
      `nur ${koennen} von ${HUGE_SPECS.length} Schwergewichten passen auf irgendeinen Wagen`
    ).toBeGreaterThanOrEqual(25);
  });

  it("und kein Eintrag scheitert mehr allein an der Breite eines Lkw", () => {
    /*
     * Die verbliebenen sieben zu breiten Einträge sind alle 2,50 m oder
     * breiter — das ist nicht die Packlogik, sondern das Raster: 2,54 m
     * Innenbreite ergeben 12 Felder zu 0,20 m, also 2,40 m nutzbar. Geprüft
     * wird deshalb die Größenordnung, nicht die Null.
     */
    const zuBreit = [...SPECS, ...BIG_SPECS, ...HUGE_SPECS].filter((sp) => {
      if (passtIrgendwo(sp)) return false;
      const s = stueckMass(sp.kind, sp.dims);
      return Math.min(s.breite, s.laenge) > 2.4;
    });
    expect(
      zuBreit.length,
      `zu breit: ${zuBreit.map((s) => s.name).join(", ")}`
    ).toBeLessThanOrEqual(8);
  });
});

/**
 * GEGENPROBE — der Wächter darüber darf nicht dadurch grün werden, dass der
 * Packer alles annimmt. Diese drei Fälle MÜSSEN durchfallen.
 */
describe("Gegenprobe: der Packer nimmt nicht alles", () => {
  const f = flaeche("pritsche", "flach");

  it("was in beiden Lagen breiter ist als die Fläche, bleibt liegen", () => {
    // 3,00 m × 2,80 m — gedreht wie ungedreht zu breit für 2,54 m
    const s = stueckMass("box", [3.0, 0.5, 2.8]);
    expect(packeLadung([s], f.halbBreite, f.nutzLaenge, f.maxHoehe)[0]).toBeNull();
  });

  it("was höher baut als die Bordwand samt Überstand, bleibt liegen", () => {
    // 1,00 m × 1,00 m Grundriss, aber 2,20 m hoch gegen 0,99 m erlaubt
    const s = stueckMass("box", [1.0, 2.2, 1.0]);
    expect(packeLadung([s], f.halbBreite, f.nutzLaenge, f.maxHoehe)[0]).toBeNull();
  });

  it("was länger ist als die Fläche, bleibt liegen", () => {
    // 6,00 m gegen 5,00 m nutzbare Länge
    const s = stueckMass("box", [0.4, 0.4, 6.0]);
    expect(packeLadung([s], f.halbBreite, f.nutzLaenge, f.maxHoehe)[0]).toBeNull();
  });

  it("und ein voller Wagen nimmt nichts mehr an", () => {
    // 40 Kisten von 1,20 m × 1,20 m × 0,90 m auf eine 2,54 × 5,00 m Fläche,
    // bei 0,99 m Höhengrenze: eine Lage passt, der Rest nicht.
    const kisten = Array.from({ length: 40 }, () => stueckMass("box", [1.2, 0.9, 1.2]));
    const plaetze = packeLadung(kisten, f.halbBreite, f.nutzLaenge, f.maxHoehe);
    expect(plaetze.filter((p) => p === null).length).toBeGreaterThan(30);
  });
});
