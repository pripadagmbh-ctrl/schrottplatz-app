import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { CONFIGS } from "../src/world/containers";
import { YARD_MIN_X, YARD_MAX_X, YARD_D } from "../src/world/yard";
import {
  STATIC_OBSTACLES,
  hitsObstacle,
  slideAround,
} from "../src/world/obstacles";
import { OFFICE_X, OFFICE_Z, officeFootprints } from "../src/world/office";
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
/**
 * Muldenlage NICHT hier eintragen — sie kommt aus CONFIGS.
 *
 * Vorher standen die Koordinaten hier fest, und beim Verschieben der
 * Sortierreihe prüfte der Test die alte Stelle: grün, obwohl die Wände
 * woanders standen. Ein Test, der seine eigene Wahrheit mitbringt, prüft
 * nichts.
 */
const SORTIERMULDEN = CONFIGS.filter((c) =>
  ["c_va", "c_alu", "c_copper", "c_cable"].includes(c.id)
);
/** Standplatz des Baggers — siehe `position` in excavator.ts. */
const BAGGER_X = 0;
const BAGGER_Z = -1;
const NICHTMETALLE = CONFIGS.filter((c) => ["c_wood", "c_tires", "c_rubble"].includes(c.id));

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
    for (const pflicht of ["Südwand", "Westwand", "Ostwand", "Schere"]) {
      expect(labels, `${pflicht} fehlt in der Hindernisliste`).toContain(pflicht);
    }
  });

  it("stellt Büro und Halle von Anfang an in den Weg", () => {
    // Sie stehen von der ersten Sekunde an da — nicht erst nach einem Kauf.
    expect(hitsObstacle(OFFICE_X, OFFICE_Z, 0)?.label).toBe("Betriebsgebäude");
    const [, halle] = officeFootprints();
    expect(hitsObstacle(halle[0], halle[1], 0)?.label).toBe("Betriebsgebäude");
  });

  it("stellt den Betriebshof neben die Waage in die hintere Ecke", () => {
    // Ausdruecklicher Wunsch (11.09.2026): an die Westwand, nahe der Ecke,
    // in Sichtweite der Waage. Sonst wandert der Bau beim naechsten Umbau
    // wieder mitten auf den Platz.
    for (const [x, z, hw, hd] of officeFootprints()) {
      expect(x - hw, "steht in der Westwand").toBeGreaterThanOrEqual(YARD_MIN_X);
      expect(x + hw, "ragt zu weit auf den Platz").toBeLessThan(-28);
      expect(z + hd, "steht in der Nordwand").toBeLessThanOrEqual(YARD_D / 2);
    }
    // Das Buero schaut auf die Waage
    expect(Math.hypot(OFFICE_X - WEIGH_X, OFFICE_Z - WEIGH_Z)).toBeLessThan(20);
  });

  it("lässt die Zufahrt zur Waage frei", () => {
    // Zwischen Gebaeudefront und Wiegeplatte muss ein LKW durchpassen.
    for (let z = 14; z <= 27; z += 1) {
      expect(hitsObstacle(WEIGH_X, z, 2.0), `Waagenspur bei z=${z}`).toBeNull();
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

  it("lässt die Sortiermulden von vorn offen, sperrt aber ihre Wände", () => {
    for (const c of SORTIERMULDEN) {
      const [w, d] = c.size;
      expect(hitsObstacle(c.x, c.z, 0), `${c.label}: Innenraum frei`).toBeNull();
      // Öffnung nach Westen: knapp vor der Mulde muss man hineinlangen können
      expect(hitsObstacle(c.x - w / 2 - 0.9, c.z, 0), `${c.label}: Öffnung frei`).toBeNull();
      expect(hitsObstacle(c.x, c.z + d / 2, 0), `${c.label}: Nordwand sperrt`).not.toBeNull();
      expect(hitsObstacle(c.x, c.z - d / 2, 0), `${c.label}: Südwand sperrt`).not.toBeNull();
      // Rückwand: Seit die Nichtmetalle weggezogen sind, stellt jede Mulde ihre
      // eigene. Ohne sie wäre die Reihe nach hinten offen.
      expect(hitsObstacle(c.x + w / 2, c.z, 0), `${c.label}: Rückwand sperrt`).not.toBeNull();
    }
  });

  it("lässt die Nichtmetall-Mulden nach Norden offen", () => {
    for (const c of NICHTMETALLE) {
      const [, d] = c.size;
      expect(hitsObstacle(c.x, c.z, 0), `${c.label}: Innenraum frei`).toBeNull();
      expect(hitsObstacle(c.x, c.z + d / 2 + 0.9, 0), `${c.label}: Öffnung frei`).toBeNull();
      expect(hitsObstacle(c.x, c.z - d / 2, 0), `${c.label}: Südwand sperrt`).not.toBeNull();
    }
  });

  it("alles steht innerhalb der Platzgrenzen", () => {
    // Seit die Ostgrenze an die Mulden herangerueckt ist (x 10,5 statt 40),
    // muss geprueft werden, dass nichts jenseits davon liegt — sonst stuende
    // eine Mulde oder ein Schrottberg ausserhalb der Mauer.
    for (const c of CONFIGS) {
      const [w, d] = c.size;
      expect(c.x + w / 2, `${c.label} ragt ueber die Ostgrenze`).toBeLessThan(YARD_MAX_X);
      expect(c.x - w / 2, `${c.label} ragt ueber die Westgrenze`).toBeGreaterThan(YARD_MIN_X);
      expect(Math.abs(c.z) + d / 2, `${c.label} ragt ueber Nord/Sued`).toBeLessThan(YARD_D / 2);
    }
  });

  it("die Ostgrenze steht dicht hinter der Sortierreihe", () => {
    // Der Sinn des Verkleinerns: keine Leere mehr zwischen letzter Mulde und
    // Mauer. Frueher lagen dort ueber 30 m.
    const hinterste = Math.max(...SORTIERMULDEN.map((c) => c.x + c.size[0] / 2));
    const luft = YARD_MAX_X - hinterste;
    expect(luft, `${luft.toFixed(1)} m Leere hinter der letzten Mulde`).toBeLessThan(4);
    expect(luft, "die Mauer steht auf der Mulde").toBeGreaterThan(0.8);
  });

  it("das Ballenlager hat keine Wände mehr", () => {
    const lager = CONFIGS.find((c) => c.id === "c_bales")!;
    // Es ist eine markierte Fläche geworden. Stünden seine Wände noch in der
    // Hindernisliste, stiesse der Arm neben der Presse gegen nichts Sichtbares.
    for (const dz of [-2.3, 0, 2.3]) {
      expect(hitsObstacle(lager.x, lager.z + dz, 0), "unsichtbare Wand").toBeNull();
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
    // Von Süden frontal auf die Südwand einer Sortiermulde zu
    const mulde = SORTIERMULDEN[0]!;
    const abgelenkt = slideAround(mulde.x, mulde.z - mulde.size[1] / 2 - 0.9, 0, 1, 0.7, out);
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
    // Reine Entfernungsprobe. Wie hoch der Arm dabei kommt, prueft
    // test/reach.test.ts — das ist die schaerfere Bedingung.
    for (const c of SORTIERMULDEN) {
      expect(
        Math.hypot(c.x - BAGGER_X, c.z - BAGGER_Z),
        `${c.label} muss in Reichweite liegen`
      ).toBeLessThan(REICHWEITE_M);
    }
  });

  it("erreicht die offene Seite der Schere", () => {
    // Nächster Punkt der Kammer, nicht deren Mitte
    expect(Math.hypot(-8.5 + 2.5, -9.8 + 3.0)).toBeLessThan(REICHWEITE_M);
  });

  it("die Nichtmetall-Mulden setzen die Sortierreihe fort", () => {
    // Eine durchgehende Zeile statt eines Ausweichquartiers: gleiche Flucht wie
    // die Buntmetalle, nur weiter suedlich.
    const reiheX = SORTIERMULDEN[0]!.x;
    for (const c of NICHTMETALLE) {
      expect(c.x, `${c.label} steht nicht in der Flucht`).toBeCloseTo(reiheX, 3);
      expect(c.z, `${c.label} liegt nicht suedlich der Buntmetalle`).toBeLessThan(
        Math.min(...SORTIERMULDEN.map((m) => m.z))
      );
    }
  });

  it("die Ruecknwand ist hoeher als die Flanken", () => {
    // Beim Einfuellen von oben fliegt regelmaessig ein Stueck ueber die hintere
    // Kante — dahinter ist es verloren.
    const c = SORTIERMULDEN[0]!;
    const wand = STATIC_OBSTACLES.find((o) => o.label === `${c.label} Stirn`)!;
    const flanke = STATIC_OBSTACLES.find((o) => o.label === `${c.label} Süd`)!;
    expect(wand.top).toBeGreaterThan(flanke.top);
  });

  it("das Ballenlager liegt nicht mehr an der Presskammer", () => {
    const lager = CONFIGS.find((c) => c.id === "c_bales")!;
    const presse = STATIC_OBSTACLES.find((o) => o.label === "Schere")!;
    const luecke = lager.x - lager.size[0] / 2 - (presse.x + presse.hw);
    expect(luecke, `nur ${luecke.toFixed(2)} m zwischen Presse und Ballen`).toBeGreaterThan(0.8);
  });

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
