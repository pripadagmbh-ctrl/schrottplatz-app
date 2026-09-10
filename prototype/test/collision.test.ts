import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  STATIC_OBSTACLES,
  BUILDING_HUT,
  hitsObstacle,
  slideAround,
  setBuildingObstacles,
} from "../src/world/obstacles";
import { WEIGH_X, WEIGH_Z } from "../src/world/yard";
import {
  CLAW_OPEN_SPLAY,
  CLAW_SEGMENTS,
  clawPoint,
  clawSpan,
  clawTipDepth,
  naechsteSpreizung,
  NACHDRUECK_RESERVE,
} from "../src/excavator/clawGeometry";
import {
  ROUTE_IN_FWD,
  ROUTE_APPROACH,
  ROUTE_IN_REV,
  ROUTE_OUT,
  PICKUP_APPROACH,
  PICKUP_IN_REV,
  PICKUP_OUT,
  TIP_APPROACH,
  TIP_IN_REV,
  TIP_OUT,
} from "../src/delivery/routes";

/**
 * Die Kollisionsprüfung hat schon mehrfach echte Fehler produziert: ein
 * Bauwerk sperrte versehentlich eine Fahrspur, eine Mulde lag außerhalb der
 * Reichweite, der Innenraum einer Box war als Vollfläche gesperrt. Diese
 * Tests halten genau diese Fälle fest.
 */

/** Gemessene Reichweite des Auslegers am Boden */
const REICHWEITE_M = 9.8;
/** Mitten der vier Sortiermulden (Reihe im Osten) */
const SORTIERMULDEN_Z = [-5.6, -1.9, 1.9, 5.6];
/** Mitte der Sortiermuldenreihe in x */
const SORTIER_X = 4.6;
/** Mitten der drei Nichtmetall-Mulden (dahinter, Öffnung nach Osten) */
const NICHTMETALL_Z = [-3.9, 0, 3.9];
const NICHTMETALL_X = 7.9;

describe("Feste Bauten", () => {
  it("sperrt jedes eingetragene Bauwerk an seinem Platz", () => {
    // Aus der Liste selbst geprüft statt gegen abgeschriebene Koordinaten:
    // So bricht der Test nicht, wenn ein Gebäude umzieht — er prüft die
    // Zusicherung, nicht den Standort.
    for (const o of STATIC_OBSTACLES) {
      expect(hitsObstacle(o.x, o.z, 0), `${o.label} muss sperren`).not.toBeNull();
    }
  });

  it("führt die erwarteten Bauwerke", () => {
    const labels = STATIC_OBSTACLES.map((o) => o.label).join(" ");
    for (const pflicht of ["Südwand", "Westwand", "Ostwand", "Schere", "Kaffeebude"]) {
      expect(labels, `${pflicht} fehlt in der Hindernisliste`).toContain(pflicht);
    }
  });

  it("stellt das Wiegehäuschen von Anfang an in den Weg", () => {
    // Es steht nicht in der festen Liste, weil es beim Ausbau dem Büro
    // weicht. Geprüft wird deshalb die Wirkung, nicht der Listeneintrag.
    const treffer = hitsObstacle(WEIGH_X - 4.6, WEIGH_Z, 0);
    expect(treffer?.label).toBe("Wiegehäuschen");
  });

  it("übernimmt den größeren Grundriss, sobald das Büro steht", () => {
    setBuildingObstacles([
      { x: WEIGH_X - 4.6, z: WEIGH_Z, hw: 3.85, hd: 2.45, top: 4.2, label: "Betriebsgebäude" },
    ]);
    // Drei Meter neben der Hausmitte: am Häuschen noch frei, am Büro belegt
    expect(hitsObstacle(WEIGH_X - 4.6 + 3.0, WEIGH_Z, 0)?.label).toBe("Betriebsgebäude");
    setBuildingObstacles(BUILDING_HUT);
    expect(hitsObstacle(WEIGH_X - 4.6 + 3.0, WEIGH_Z, 0)).toBeNull();
  });

  it("lässt die Einfahrt offen", () => {
    expect(hitsObstacle(-22, 29, 0)).toBeNull();
    // beidseits davon steht die Nordwand
    expect(hitsObstacle(-32, 29, 0)).not.toBeNull();
    expect(hitsObstacle(-10, 29, 0)).not.toBeNull();
  });

  it("hält jeden Punkt der echten Fahrspuren frei", () => {
    // Geprüft werden die Routen, die die LKW tatsächlich abfahren — nicht
    // abgeschriebene Werte. Ein blockierter Punkt legt den Verkehr lahm,
    // und genau das ist zweimal passiert: erst durch das Wiegehäuschen,
    // dann durch die zusammengerückten Mulden.
    const routen: Array<[string, Array<[number, number]>]> = [
      ["Einfahrt", ROUTE_IN_FWD],
      ["Anfahrt", ROUTE_APPROACH],
      ["Rangieren", ROUTE_IN_REV],
      ["Ausfahrt", ROUTE_OUT],
      ["Abholer-Anfahrt", PICKUP_APPROACH],
      ["Abholer-Rangieren", PICKUP_IN_REV],
      ["Abholer-Ausfahrt", PICKUP_OUT],
      ["Kipper-Anfahrt", TIP_APPROACH],
      ["Kipper-Rangieren", TIP_IN_REV],
      ["Kipper-Ausfahrt", TIP_OUT],
    ];
    for (const [name, punkte] of routen) {
      for (const [x, z] of punkte) {
        // 1,4 m ist der Sicherheitsabstand, mit dem die LKW prüfen
        expect(hitsObstacle(x, z, 1.4), `${name} bei (${x}, ${z})`).toBeNull();
      }
    }
  });

  it("lässt die Sortiermulden von vorn offen, sperrt aber ihre Wände", () => {
    for (const z of SORTIERMULDEN_Z) {
      expect(hitsObstacle(SORTIER_X, z, 0), "Innenraum frei").toBeNull();
      expect(hitsObstacle(2.4, z, 0), "Öffnung nach Westen frei").toBeNull();
      expect(hitsObstacle(SORTIER_X, z + 2.0, 0), "Nordwand sperrt").not.toBeNull();
      expect(hitsObstacle(SORTIER_X, z - 2.0, 0), "Südwand sperrt").not.toBeNull();
    }
  });

  it("lässt die Nichtmetall-Mulden nach Osten offen", () => {
    for (const z of NICHTMETALL_Z) {
      expect(hitsObstacle(NICHTMETALL_X, z, 0), "Innenraum frei").toBeNull();
      expect(hitsObstacle(10.2, z, 0), "Öffnung nach Osten frei").toBeNull();
    }
    // Die gemeinsame Wand zwischen beiden Reihen steht
    expect(hitsObstacle(6.4, 0, 0), "Mittelwand sperrt").not.toBeNull();
  });

  it("lässt den Arm über niedrige Mauern schwenken, aber nicht hindurch", () => {
    // Umrandung ist 1,8 m hoch
    expect(hitsObstacle(0, -29, 0, 1.0), "unterhalb sperrt").not.toBeNull();
    expect(hitsObstacle(0, -29, 0, 2.5), "darüber ist frei").toBeNull();
  });

  it("hat für jedes Bauwerk eine sinnvolle Höhe", () => {
    for (const o of STATIC_OBSTACLES) {
      expect(o.top, `${o.label} braucht eine Höhe`).toBeGreaterThan(0);
      expect(o.hw, `${o.label} braucht Breite`).toBeGreaterThan(0);
      expect(o.hd, `${o.label} braucht Tiefe`).toBeGreaterThan(0);
    }
  });

  it("lenkt eine Richtung an der Wand entlang, statt hindurch", () => {
    const out = { x: 0, z: 0 };
    // Von Süden frontal auf die Südwand einer Sortiermulde zu
    const abgelenkt = slideAround(SORTIER_X, SORTIERMULDEN_Z[0] - 2.9, 0, 1, 0.7, out);
    expect(abgelenkt).toBe(true);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(1, 3);
  });

  it("meldet freie Fläche als frei", () => {
    const out = { x: 0, z: 0 };
    expect(slideAround(0, 14, 0, 1, 0.7, out)).toBe(false);
  });
});

describe("Reichweite des Baggers", () => {
  it("erreicht alle vier Sortiermulden vom Standplatz aus", () => {
    // Der Bagger steht im Ursprung. Lag eine Mulde außerhalb, war sie im
    // Spiel schlicht nicht bedienbar.
    for (const [name, x, z] of [
      ["VA", SORTIER_X, SORTIERMULDEN_Z[0]],
      ["Alu", SORTIER_X, SORTIERMULDEN_Z[1]],
      ["Kupfer", SORTIER_X, SORTIERMULDEN_Z[2]],
      ["Kabel", SORTIER_X, SORTIERMULDEN_Z[3]],
    ] as Array<[string, number, number]>) {
      expect(Math.hypot(x, z), `${name} muss in Reichweite liegen`).toBeLessThan(REICHWEITE_M);
    }
  });

  it("erreicht die offene Seite der Schere", () => {
    // Nächster Punkt der Kammer, nicht deren Mitte
    expect(Math.hypot(-8.5 + 2.5, -9.8 + 3.0)).toBeLessThan(REICHWEITE_M);
  });

  it("erreicht auch die drei Nichtmetall-Mulden dahinter", () => {
    for (const z of NICHTMETALL_Z) {
      expect(Math.hypot(NICHTMETALL_X, z), `Mulde bei z ${z}`).toBeLessThan(REICHWEITE_M);
    }
  });
});

describe("Greifergeometrie", () => {
  it("schließt mittig, ohne dass die Spitzen sich überlappen", () => {
    const p = clawPoint(0, 0, CLAW_SEGMENTS, new THREE.Vector3());
    // Radius nahe null heißt: die Spitzen treffen sich in der Mitte
    expect(Math.abs(Math.hypot(p.x, p.z))).toBeLessThan(0.05);
  });

  it("passt geöffnet zwischen die Muldenwände", () => {
    const span = clawSpan(CLAW_OPEN_SPLAY);
    expect(span).toBeGreaterThan(3); // muss ordentlich fassen
    expect(span, "Innenbreite der Mulde ist 3,8 m").toBeLessThan(3.8);
  });

  it("öffnet weiter, als es schließt", () => {
    expect(clawSpan(CLAW_OPEN_SPLAY)).toBeGreaterThan(clawSpan(0));
  });

  it("liefert eine Spitzentiefe, die zum Bodenanschlag passt", () => {
    // Offen ist die Spinne flacher als geschlossen — sie streckt sich erst
    // beim Schließen nach unten
    const offen = clawTipDepth(CLAW_OPEN_SPLAY);
    const zu = clawTipDepth(0);
    expect(offen).toBeGreaterThan(1.5);
    expect(zu).toBeGreaterThan(offen);
    expect(zu).toBeLessThan(2.6);
  });

  it("wächst monoton vom Gelenk zur Spitze", () => {
    let vorher = 0;
    for (let k = 1; k <= CLAW_SEGMENTS; k++) {
      const tiefe = -clawPoint(0, 0, k, new THREE.Vector3()).y;
      expect(tiefe).toBeGreaterThan(vorher);
      vorher = tiefe;
    }
  });
});

/**
 * Ungleichmäßiges Schließen der Spinne (Wunsch 10.09.2026).
 *
 * Steckt eine Stange zwischen zwei Zähnen, sollen genau die beiden stehen
 * bleiben und die anderen drei weiter zugehen. Ein Greifer bleibt dabei nicht
 * schlagartig stehen — er drückt noch ein Stück nach, bis der Druck steht.
 * Kleinerer Winkel heißt weiter geschlossen.
 */
describe("Krallen schließen einzeln", () => {
  const SCHRITT = 0.1;
  const R = NACHDRUECK_RESERVE;

  it("eine freie Kralle geht weiter zu", () => {
    expect(naechsteSpreizung(1.0, 0.4, SCHRITT, false, R).winkel).toBeCloseTo(0.9, 6);
  });

  it("oeffnen geht auch dann, wenn etwas im Weg ist", () => {
    // Sonst bliebe eine Kralle fuer immer stecken, sobald sie einmal aufsitzt
    expect(naechsteSpreizung(0.5, 1.25, SCHRITT, true, 0).winkel).toBeCloseTo(0.6, 6);
  });

  it("das Ziel wird nicht ueberschossen", () => {
    expect(naechsteSpreizung(0.45, 0.4, SCHRITT, false, R).winkel).toBeCloseTo(0.4, 6);
    expect(naechsteSpreizung(1.2, 1.25, SCHRITT, false, R).winkel).toBeCloseTo(1.25, 6);
  });

  it("blockiert wird nachgedrueckt, langsam und begrenzt", () => {
    // Erstes Bild: die Kralle steht nicht, sie setzt nach
    const a = naechsteSpreizung(1.0, 0.4, SCHRITT, true, R);
    expect(a.winkel, "die Kralle bleibt schlagartig stehen").toBeLessThan(1.0);
    expect(1.0 - a.winkel, "sie drueckt so schnell nach wie sonst").toBeLessThan(SCHRITT);
    expect(a.reserve).toBeLessThan(R);
  });

  it("das Nachdruecken ist irgendwann zu Ende", () => {
    let winkel = 1.0;
    let reserve = R;
    for (let i = 0; i < 200; i++) {
      const r = naechsteSpreizung(winkel, 0.4, SCHRITT, true, reserve);
      winkel = r.winkel;
      reserve = r.reserve;
    }
    expect(reserve).toBe(0);
    // Nachgedrueckt hat sie genau ihre Reserve, nicht mehr
    expect(1.0 - winkel).toBeCloseTo(R, 6);
    // ... und ist damit weit vom kommandierten Winkel entfernt geblieben
    expect(winkel).toBeGreaterThan(0.8);
  });

  it("wer loslaesst, bekommt seine Reserve zurueck", () => {
    const zu = naechsteSpreizung(1.0, 0.4, SCHRITT, true, 0.01);
    expect(zu.reserve).toBeLessThanOrEqual(0.01);
    const auf = naechsteSpreizung(zu.winkel, 1.25, SCHRITT, true, zu.reserve);
    expect(auf.reserve, "sonst drueckt sie beim naechsten Griff nicht mehr nach").toBe(R);
  });

  it("die Stange zwischen zwei Zaehnen: drei gehen zu, zwei bleiben", () => {
    const blockiert = [false, true, true, false, false];
    let winkel = [1.25, 1.25, 1.25, 1.25, 1.25];
    let reserve = [R, R, R, R, R];
    for (let i = 0; i < 60; i++) {
      const neu = winkel.map((w, k) =>
        naechsteSpreizung(w, 0.3, SCHRITT, blockiert[k]!, reserve[k]!)
      );
      winkel = neu.map((n) => n.winkel);
      reserve = neu.map((n) => n.reserve);
    }
    expect(winkel[0]).toBeCloseTo(0.3, 6);
    expect(winkel[3]).toBeCloseTo(0.3, 6);
    // Die blockierten haben nachgedrueckt, aber nur um ihre Reserve
    expect(winkel[1]).toBeCloseTo(1.25 - R, 6);
    expect(winkel[2]).toBeCloseTo(1.25 - R, 6);
    const spanne = Math.max(...winkel) - Math.min(...winkel);
    expect(spanne, "die Spinne geht wieder gleichmaessig zu").toBeGreaterThan(0.5);
  });
});
