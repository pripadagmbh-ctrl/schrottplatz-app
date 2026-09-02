import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { STATIC_OBSTACLES, hitsObstacle, slideAround } from "../src/world/obstacles";
import {
  CLAW_OPEN_SPLAY,
  CLAW_SEGMENTS,
  clawPoint,
  clawSpan,
  clawTipDepth,
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
} from "../src/delivery/vehicles";

/**
 * Die Kollisionsprüfung hat schon mehrfach echte Fehler produziert: ein
 * Bauwerk sperrte versehentlich eine Fahrspur, eine Mulde lag außerhalb der
 * Reichweite, der Innenraum einer Box war als Vollfläche gesperrt. Diese
 * Tests halten genau diese Fälle fest.
 */

/** Gemessene Reichweite des Auslegers am Boden */
const REICHWEITE_M = 9.8;

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
    for (const pflicht of ["Südwand", "Westwand", "Ostwand", "Schere", "Wiegehäuschen", "Kaffeebude"]) {
      expect(labels, `${pflicht} fehlt in der Hindernisliste`).toContain(pflicht);
    }
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

  it("lässt die Mulden von vorn offen, sperrt aber ihre Wände", () => {
    for (const z of [-7.35, -2.45, 2.45, 7.35]) {
      expect(hitsObstacle(5.6, z, 0), "Innenraum frei").toBeNull();
      expect(hitsObstacle(2.4, z, 0), "Öffnung nach Westen frei").toBeNull();
      expect(hitsObstacle(5.6, z + 2.45, 0), "Nordwand sperrt").not.toBeNull();
      expect(hitsObstacle(5.6, z - 2.45, 0), "Südwand sperrt").not.toBeNull();
      expect(hitsObstacle(5.6 + 2.85, z, 0), "Ostwand sperrt").not.toBeNull();
    }
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
    // Von Westen frontal auf eine Muldenwand zu
    const abgelenkt = slideAround(5.6, -2.45 - 3.2, 0, 1, 0.7, out);
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
      ["VA", 5.6, -7.35],
      ["Alu", 5.6, -2.45],
      ["Kupfer", 5.6, 2.45],
      ["Kabel", 5.6, 7.35],
    ] as Array<[string, number, number]>) {
      expect(Math.hypot(x, z), `${name} muss in Reichweite liegen`).toBeLessThan(REICHWEITE_M);
    }
  });

  it("erreicht die offene Seite der Schere", () => {
    // Nächster Punkt der Kammer, nicht deren Mitte
    expect(Math.hypot(-4.6 + 3.5, -9.8 + 3.0)).toBeLessThan(REICHWEITE_M);
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
