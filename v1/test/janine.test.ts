/**
 * Wächter für Janines Kaffeewagen — der Platz, der schon zweimal etwas
 * blockiert hat.
 *
 * Vorgeschichte, aus der dieser Wächter entstanden ist:
 *
 *  - 13.09.2026, (−22,5 | 19,5): Der Wagen stand 3,9 m neben der Sehne, mit
 *    der ein LKW vier Meter vorausschaut. Der erste Kipper blieb **292
 *    Sekunden** hinter der Waage stehen und kam nie auf den Platz. Feste
 *    Bauten kennen keine Aufgeben-Regel.
 *  - 14.09.2026, (−9,5 | 15,5): Dort hat er die Abholer-Spur gedreht (der
 *    Wagen wäre sonst durch ihn hindurchgefahren) und den dritten Warteplatz
 *    von der Nordwand vertrieben.
 *
 * Seit E-028 steht er an der Nordmauer östlich der Einfahrt, neben den beiden
 * Warteplätzen — „an die Außengrenze, links neben dem Tor, da wo auch die
 * LKWs parkieren" (Ansage 15.09.2026). Geprüft wird mit dem echten
 * Fahrzeugumriss, nicht nach Gefühl.
 */
import { describe, it, expect } from "vitest";
import { KAFFEE_POS, KAFFEE_FUSS, KAFFEE_THEKE, GATE_X, WEIGH_X, YARD_D } from "../src/world/yard";
import { STATIC_OBSTACLES, hitsObstacle } from "../src/world/obstacles";
import {
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  ROUTE_IN_FWD,
  routeApproach,
  pickupApproach,
  WAAGE_HALT,
} from "../src/delivery/routes";
import { imBaggerrevier } from "../src/world/people";

/** Umriss eines LKW um seinen Bezugspunkt (vehicleModel.ts). */
const LKW_HALB_B = 1.55;
const LKW_VORN = 5.4 / 2 + 1.9;
const LKW_HINTEN = 5.4 / 2 + 0.14;

/** Rechteck-Abstand: negativ heißt Überschneidung. */
function luft(
  ax: number,
  az: number,
  ahw: number,
  ahd: number,
  bx: number,
  bz: number,
  bhw: number,
  bhd: number
): number {
  return Math.max(Math.abs(ax - bx) - (ahw + bhw), Math.abs(az - bz) - (ahd + bhd));
}

describe("Janine steht an der Außengrenze neben dem Tor", () => {
  it("mit dem Rücken an der Nordmauer, aber nicht darin", () => {
    const nordkante = KAFFEE_POS.z + KAFFEE_FUSS[1];
    const mauerInnen = YARD_D / 2 - 0.3;
    expect(nordkante, `steht ${(nordkante - mauerInnen).toFixed(2)} m in der Mauer`).toBeLessThan(
      mauerInnen
    );
    expect(
      mauerInnen - nordkante,
      `${(mauerInnen - nordkante).toFixed(2)} m Leere hinter dem Wagen`
    ).toBeLessThan(1.5);
  });

  it("östlich der Einfahrt — aus dem Sitz gesehen LINKS vom Tor", () => {
    /*
     * Der Bagger schaut nach +z; wer so blickt, hat +x links. „Links neben
     * dem Tor" heißt damit: x größer als die Torkante.
     */
    const torOst = GATE_X + 4.5;
    expect(
      KAFFEE_POS.x - KAFFEE_FUSS[0],
      "der Wagen ragt in die Toroeffnung"
    ).toBeGreaterThan(torOst);
  });

  it("steht in keiner Torspur und in keiner Waagenspur", () => {
    for (const [name, x] of [
      ["Torspur", GATE_X],
      ["Waagenspur", WEIGH_X],
    ] as Array<[string, number]>) {
      const d = luft(
        KAFFEE_POS.x,
        KAFFEE_POS.z,
        KAFFEE_FUSS[0],
        KAFFEE_FUSS[1],
        x,
        KAFFEE_POS.z,
        LKW_HALB_B,
        0.1
      );
      expect(d, `${name}: ${d.toFixed(2)} m`).toBeGreaterThan(1.0);
    }
  });

  it("verdrängt keinen Warteplatz — auch nicht dessen Standfläche", () => {
    /*
     * Ein wartender LKW setzt von (x | z − 8) nach Norden zurück und steht am
     * Ende mit dem Heck zur Wand. Seine Standfläche reicht deshalb von
     * z + 3,04 (Heck) bis z − 4,60 (Kabine).
     */
    for (const [i, [px, pz]] of PARK_SLOTS.entries()) {
      const mitte = pz + (LKW_HINTEN - LKW_VORN) / 2;
      const d = luft(
        KAFFEE_POS.x,
        KAFFEE_POS.z,
        KAFFEE_FUSS[0],
        KAFFEE_FUSS[1],
        px,
        mitte,
        LKW_HALB_B,
        (LKW_VORN + LKW_HINTEN) / 2
      );
      expect(d, `Warteplatz ${i + 1} (${px} | ${pz}): ${d.toFixed(2)} m`).toBeGreaterThan(0.3);
      // Und die Anfahrt dorthin ist frei.
      expect(
        hitsObstacle(px, pz - PARK_ANFAHRT_M, 1.4),
        `Anfahrt zu Warteplatz ${i + 1} versperrt`
      ).toBeNull();
    }
  });

  it("liegt auf keiner Sehne der drei Anfahrten — das war der 292-Sekunden-Fehler", () => {
    /*
     * Ein LKW schaut vier Meter voraus, und zwar auf der SEHNE zum
     * Vorausschaupunkt. Abgetastet wird jede Route in 50-cm-Schritten mit dem
     * vollen Wagenumriss quer zur Fahrtrichtung; der Kaffeewagen muss überall
     * mehr als einen halben Meter danebenliegen.
     */
    const routen: Array<[string, Array<[number, number]>]> = [
      ["Einfahrt", ROUTE_IN_FWD],
      ["Anlieferung", routeApproach()],
      ["Abholer", pickupApproach()],
    ];
    for (const [name, route] of routen) {
      for (let i = 0; i < route.length - 1; i++) {
        const [ax, az] = route[i]!;
        const [bx, bz] = route[i + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        for (let t = 0; t <= 1.0001; t += 0.5 / Math.max(len, 0.001)) {
          const tt = Math.min(1, t);
          const x = ax + (bx - ax) * tt;
          const z = az + (bz - az) * tt;
          const d = luft(
            KAFFEE_POS.x,
            KAFFEE_POS.z,
            KAFFEE_FUSS[0],
            KAFFEE_FUSS[1],
            x,
            z,
            LKW_HALB_B,
            LKW_HALB_B
          );
          expect(
            d,
            `${name}: der Kaffeewagen liegt bei (${x.toFixed(1)} | ${z.toFixed(1)}) ` +
              `nur ${d.toFixed(2)} m neben der Spur`
          ).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it("steht als Hindernis in der Liste — und die Theke davor ist frei", () => {
    const eintrag = STATIC_OBSTACLES.find((o) => o.label === "Kaffeewagen");
    expect(eintrag, "der Kaffeewagen fehlt in der Hindernisliste").toBeTruthy();
    expect(eintrag!.x).toBeCloseTo(KAFFEE_POS.x, 6);
    expect(eintrag!.z).toBeCloseTo(KAFFEE_POS.z, 6);
    // Wo die Fahrer stehen: südlich vor der Klappe, auf dem freien Platz.
    expect(hitsObstacle(KAFFEE_THEKE.x, KAFFEE_THEKE.z, 0.6), "vor der Theke steht etwas")
      .toBeNull();
  });

  it("Fahrer und Lambert erreichen sie, ohne durch den Arbeitsbereich zu laufen", () => {
    /*
     * Lamberts Sperrgebiet ist der Arbeitsbereich des Baggers (`people.ts`).
     * Läge die Theke darin, ginge er nie Kaffee holen; läge der Weg dorthin
     * hindurch, liefe er durch die schwenkende Spinne.
     */
    expect(imBaggerrevier(KAFFEE_THEKE.x, KAFFEE_THEKE.z), "die Theke liegt im Sperrgebiet")
      .toBe(false);
    const von = WAAGE_HALT;
    const schritte = 60;
    for (let i = 0; i <= schritte; i++) {
      const f = i / schritte;
      const x = von[0] + (KAFFEE_THEKE.x - von[0]) * f;
      const z = von[1] + (KAFFEE_THEKE.z - von[1]) * f;
      expect(
        imBaggerrevier(x, z),
        `der Weg zur Theke führt bei (${x.toFixed(1)} | ${z.toFixed(1)}) durch den Arbeitsbereich`
      ).toBe(false);
      expect(
        hitsObstacle(x, z, 0.3),
        `der Weg zur Theke ist bei (${x.toFixed(1)} | ${z.toFixed(1)}) verbaut`
      ).toBeNull();
    }
  });
});
