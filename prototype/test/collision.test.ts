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
import { PRESS_CENTER } from "../src/world/press";
import { WEIGH_X, WEIGH_Z } from "../src/world/yard";
import {
  CLAW_OPEN_SPLAY,
  CLAW_SEGMENTS,
  clawPoint,
  clawSpan,
  CLAW_CLOSED_SPLAY,
  clawTipDepth,
  CLAW_MAX_DEPTH,
  naechsteSpreizung,
  NACHDRUECK_RESERVE,
} from "../src/excavator/clawGeometry";
import {
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  routeOut,
  pickupApproach,
  pickupInRev,
  pickupOut,
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
/** Was der Spieler selbst befuellt (Platzordnung 12.09.2026). */
const SORTIERMULDEN = CONFIGS.filter((c) =>
  ["r_cable", "r_va", "r_copper", "r_alu", "r_zinc", "r_brass"].includes(c.id)
);
/** Standplatz des Baggers — siehe `position` in excavator.ts. */
const BAGGER_X = -2.5;
const BAGGER_Z = -19.5;
/** Die Silos an der Ostwand, an denen der Abholer entlangfaehrt. */
const SILOS = CONFIGS.filter((c) =>
  ["c_wood", "c_rubble", "c_plastic", "c_va_lager"].includes(c.id)
);

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
    for (const pflicht of ["Südwand", "Westwand", "Ostwand", "Presse"]) {
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
      ["Anfahrt", routeApproach()],
      ["Rangieren", routeInRev()],
      ["Ausfahrt", routeOut()],
      ["Abholer-Anfahrt", pickupApproach()],
      ["Abholer-Rangieren", pickupInRev()],
      ["Abholer-Ausfahrt", pickupOut()],
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

  it("die Absetzcontainer stehen bewusst in keiner Hindernisliste", () => {
    /*
     * Sie sind bewegliche Koerper (E-081) und wandern, sobald der Bagger sie
     * zieht. Ein fester Eintrag zeigte nach dem ersten Zug auf leeren Boden —
     * und der Container selbst waere unsichtbar geworden. Ihre Kollision
     * kommt aus der Physik, nicht aus dieser Liste.
     */
    for (const c of SORTIERMULDEN) {
      expect(hitsObstacle(c.x, c.z, 0), `${c.label}: darf nicht fest eingetragen sein`).toBeNull();
    }
  });

  it("kein Absetzcontainer steht in einer Fahrspur", () => {
    // Sie sind fuer die LKW unsichtbar. Steht einer im Weg, faehrt ihm der
    // naechste Kipper hinein, statt zu warten.
    const spuren: Array<[string, Array<[number, number]>]> = [
      ["Anfahrt", routeApproach()],
      ["Rangieren", routeInRev()],
      ["Abholer", pickupApproach()],
      ["Abholer-Rangieren", pickupInRev()],
      ["Kipper", TIP_APPROACH],
      ["Kipper-Rangieren", TIP_IN_REV],
    ];
    for (const c of SORTIERMULDEN) {
      const [w, d] = c.size;
      for (const [name, punkte] of spuren) {
        for (const [x, z] of punkte) {
          const zu =
            Math.abs(x - c.x) < w / 2 + 1.8 && Math.abs(z - c.z) < d / 2 + 1.8;
          expect(zu, `${c.label} steht auf der Spur ${name} bei (${x}, ${z})`).toBe(false);
        }
      }
    }
  });

  it("lässt die Silos zum Platz hin offen", () => {
    // Sie stehen an der Ostwand und oeffnen sich zum Platz. Waere die Oeffnung
    // zugestellt, kaeme weder Radlader noch Abholer hinein.
    for (const c of SILOS) {
      const [w] = c.size;
      expect(hitsObstacle(c.x, c.z, 0), `${c.label}: Innenraum frei`).toBeNull();
      expect(hitsObstacle(c.x + w / 2 + 0.9, c.z, 0), `${c.label}: Öffnung frei`).toBeNull();
      expect(hitsObstacle(c.x - w / 2, c.z, 0), `${c.label}: Rückwand sperrt`).not.toBeNull();
    }
  });

  it("der Mischschrottplatz hat nur die Aussenmauer, sonst nichts", () => {
    /*
     * Ansage 13.09.2026: „die Abgrenzung, die du da neu gezogen hast, die
     * gehoeren da eigentlich gar nicht hin bzw. koennen weg … die Presse
     * kommt da hin und der Mischschrott liegt einfach nur daneben, ohne dass
     * das irgendwie abgegrenzt wird."
     *
     * Damit faellt auch die Rueckwand zur Presse. Uebrig bleibt genau das,
     * was am 12.09. schon die Regel war: „die natuerlichen Abgrenzungen vom
     * Mischschrott soll eigentlich nur die Aussenwand sein und daneben der
     * Bagger, anders braucht's eigentlich keine Abgrenzung."
     */
    const h = CONFIGS.find((c) => c.id === "c_mixed")!;
    const [w, d] = h.size;
    expect(hitsObstacle(h.x, h.z, 0), "Innenraum frei").toBeNull();
    expect(hitsObstacle(h.x, h.z + d / 2 + 1.2, 0), "Vorderseite offen").toBeNull();
    expect(hitsObstacle(h.x + w / 2 + 0.4, h.z, 0), "Aussenwand sperrt").not.toBeNull();
    /*
     * Die Probe liegt NEBEN der Presse, nicht in ihr: Die Presse steht selbst
     * dort hinten und ist zu Recht ein Hindernis. Gesucht ist die Wand, die
     * frueher ueber die ganze Breite lief — bei x 2,7 stand sie, die Presse
     * beginnt erst bei 3,3.
     */
    expect(
      hitsObstacle(h.x - w / 2 + 0.5, h.z - d / 2 - 0.4, 0),
      "zur Presse hin darf keine Wand mehr stehen"
    ).toBeNull();
    for (const [name, z] of [
      ["vorn", h.z + d / 2 - 1],
      ["hinten", h.z - d / 4],
    ] as Array<[string, number]>) {
      expect(
        hitsObstacle(h.x - w / 2 - 0.4, z, 0),
        `zur Stahlbox hin muss es ${name} offen sein`
      ).toBeNull();
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

  it("die Westgrenze steht dicht hinter den Silos", () => {
    // Der Sinn des Verkleinerns: keine Leere mehr zwischen letzter Mulde und
    // Mauer. Frueher lagen dort ueber 30 m.
    const hinterste = Math.min(...SILOS.map((c) => c.x - c.size[0] / 2));
    const luft = hinterste - YARD_MIN_X;
    expect(luft, `${luft.toFixed(1)} m Leere hinter der letzten Mulde`).toBeLessThan(4);
    expect(luft, "die Mauer steht auf der Mulde").toBeGreaterThan(0.8);
  });

  it("das Reifendepot hat keine Wände", () => {
    const depot = CONFIGS.find((c) => c.id === "c_tires")!;
    // Offene Flaeche, begrenzt nur von Presse und Stahlcontainer. Stuenden hier
    // Waende in der Hindernisliste, stiesse der Arm gegen nichts Sichtbares.
    for (const dz of [-3, 0, 3]) {
      expect(hitsObstacle(depot.x, depot.z + dz, 0), "unsichtbare Wand").toBeNull();
    }
  });

  it("lässt den Arm über niedrige Mauern schwenken, aber nicht hindurch", () => {
    // Umrandung ist 1,8 m hoch
    // Eine Stelle der Suedwand, an der keine Mulde dahintersteht
    expect(hitsObstacle(-30, -29, 0, 1.0), "unterhalb sperrt").not.toBeNull();
    expect(hitsObstacle(-30, -29, 0, 2.5), "darüber ist frei").toBeNull();
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
    const mulde = SILOS[0]!;
    const abgelenkt = slideAround(mulde.x, mulde.z - mulde.size[1] / 2 - 0.9, 0, 1, 0.7, out);
    expect(abgelenkt).toBe(true);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(1, 3);
  });

  it("meldet freie Fläche als frei", () => {
    const out = { x: 0, z: 0 };
    expect(slideAround(-10, 2, 0, 1, 0.7, out)).toBe(false);
  });
});

describe("Reichweite des Baggers", () => {
  it("erreicht die Absetzcontainer von der Arbeitslinie aus", () => {
    /*
     * Reine Entfernungsprobe gegen die kurze Arbeitslinie (−6 | −16) bis
     * (−6 | −11,5). Wie hoch der Arm dabei kommt, prueft test/reach.test.ts —
     * das ist die schaerfere Bedingung.
     */
    for (const c of SORTIERMULDEN) {
      let naechste = Infinity;
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const pz = BAGGER_Z + t * 5;
        naechste = Math.min(naechste, Math.hypot(c.x - BAGGER_X, c.z - pz));
      }
      expect(naechste, `${c.label} muss in Reichweite liegen`).toBeLessThan(REICHWEITE_M);
    }
  });

  it("erreicht die offene Seite der Presse", () => {
    // Naechster Punkt der Kammer, nicht deren Mitte. Sie steht seit dem
    // Umbau vom 13.09.2026 in der Ecke, nicht mehr in der Sitzachse.
    const presse = STATIC_OBSTACLES.find((o) => o.label === "Presse")!;
    const dz = Math.abs(presse.z + presse.hd - BAGGER_Z);
    const dx = Math.max(0, Math.abs(presse.x - BAGGER_X) - presse.hw);
    expect(Math.hypot(dx, dz)).toBeLessThan(REICHWEITE_M);
  });

  it("die Silos stehen in einer Flucht an der Ostwand", () => {
    // Der Abholer faehrt sie in einem Zug ab (Ansage 12.09.2026). Steht eine
    // aus der Reihe, muss er rangieren, und die Spur trifft sie nicht mehr.
    const reiheX = SILOS[0]!.x;
    for (const c of SILOS) {
      expect(c.x, `${c.label} steht nicht in der Flucht`).toBeCloseTo(reiheX, 3);
    }
  });

  it("die Ruecknwand ist hoeher als die Flanken", () => {
    // Beim Einfuellen von oben fliegt regelmaessig ein Stueck ueber die hintere
    // Kante — dahinter ist es verloren.
    const c = SILOS[0]!;
    const wand = STATIC_OBSTACLES.find((o) => o.label === `${c.label} Stirn`)!;
    const flanke = STATIC_OBSTACLES.find((o) => o.label === `${c.label} Süd`)!;
    expect(wand.top).toBeGreaterThan(flanke.top);
  });

  it("die Presse steht in der Ecke, davor zwei gleich grosse Boxen", () => {
    /*
     * Ansage 13.09.2026: „da, wo der Mischschrott ist, da kommt einfach die
     * Presse hin … und dann wird quasi rechts eine neue Grenze gezogen, damit
     * du quasi zwei gleiche Boxen hast. Also einmal Mischschrott und dann
     * einmal Stahlschrott."
     *
     * Geprueft wird die Anordnung aus der Sitzperspektive, nicht die
     * Koordinate — links vom Sitz ist +x (E-086). Die Presse liegt links
     * aussen in der Ecke, die Mischschrottbox daneben, die Stahlbox rechts
     * davon, und beide Boxen sind gleich gross.
     */
    const halde = CONFIGS.find((c) => c.id === "c_mixed")!;
    const stahl = CONFIGS.find((c) => c.id === "c_steel")!;
    const presse = STATIC_OBSTACLES.find((o) => o.label === "Presse")!;
    expect(presse.x, "Presse nicht links aussen in der Ecke").toBeGreaterThan(stahl.x);
    expect(halde.x, "Mischschrott nicht links von der Stahlbox").toBeGreaterThan(stahl.x);
    expect(
      [stahl.size[0], stahl.size[1], stahl.size[2]],
      "die beiden Boxen sind nicht gleich gross"
    ).toEqual([halde.size[0], halde.size[1], halde.size[2]]);
    for (const [name, z] of [
      ["Mischschrott", halde.z],
      ["Stahlbox", stahl.z],
      ["Presse", presse.z],
    ] as Array<[string, number]>) {
      expect(z, `${name} liegt nicht hinter dem Bagger`).toBeLessThan(BAGGER_Z);
    }
  });

  it("kein Hindernis steht dort, wo gar nichts gebaut ist", () => {
    /*
     * Die Presse ist am 13.09.2026 von (−3,0 | −26,0) in die Ecke auf
     * (6,6 | −26,0) gezogen — ihr Eintrag in STATIC_OBSTACLES blieb stehen.
     * Einen halben Tag lang stand damit eine unsichtbare Wand von 7,8 x 5,0 m
     * hinter dem Bagger, und an der Presse selbst gar keine. Seitdem kommen
     * Lage und Mass aus press.ts; dieser Test haelt fest, dass sie
     * zusammenbleiben.
     */
    const presse = STATIC_OBSTACLES.find((o) => o.label === "Presse")!;
    expect(presse.x).toBeCloseTo(PRESS_CENTER.x, 6);
    expect(presse.z).toBeCloseTo(PRESS_CENTER.z, 6);
    expect(hitsObstacle(PRESS_CENTER.x, PRESS_CENTER.z, 0), "Presse ist kein Hindernis")
      .not.toBeNull();
    // Die alte Stelle muss frei sein — dort liegt jetzt die Stahlbox.
    expect(hitsObstacle(-3.0, -26.0, 0), "alte Pressenstelle sperrt noch").toBeNull();
  });

  it("schließt mittig, mit dem kleinen Loch der halboffenen Bauform", () => {
    /*
     * Geschlossen ist seit dem 13.09.2026 wieder Spreizung 0 — aber die
     * Spitzen treffen sich nicht exakt auf der Achse, sondern lassen ein Loch
     * von Ø 0,12 m. Das ist gewollt und keine Ungenauigkeit: Fünf Spitzen
     * endlicher Breite können sich auf einem Punkt gar nicht treffen, ohne
     * einander zu durchdringen. Die halboffene Bauform der Zeichnung macht
     * genau das.
     *
     * Die Schranke prüft beides: klein genug, dass nichts durchrieselt, und
     * größer als null, damit die Spitzen einander nicht überlappen.
     */
    const p = clawPoint(0, CLAW_CLOSED_SPLAY, CLAW_SEGMENTS, new THREE.Vector3());
    const r = Math.hypot(p.x, p.z);
    expect(r, "die Spitzen überfahren die Drehachse").toBeGreaterThan(0.02);
    expect(2 * r, "unnötig viel Loch in der Mitte").toBeLessThan(0.2);
  });

  it("öffnet weit genug, um etwas zu fassen", () => {
    /*
     * Hier stand auch eine Obergrenze: „Innenbreite der Mulde ist 3,8 m".
     * Eine abgeschriebene Zahl, die nach jedem Umbau der Behälter falsch war —
     * zuletzt schlug sie an, obwohl die Behälter längst 4,7 m messen. Ob die
     * Spinne in einen Behälter passt, prüft `test/spinnenmass.test.ts` gegen
     * die echten Maße aus CONFIGS. Eine Regel, ein Besitzer.
     */
    /*
     * 2,30 m Spitzenweite — die Zahl der Positionsliste, jetzt im Maßstab 1:1
     * statt vergrößert. Die alte Sichelkralle öffnete 3,38 m, weil sie eine um
     * ein Viertel aufgeblasene MG4.1-800 war.
     *
     * Die Schranke steht bei 2,0 m, und der Grund ist nachgemessen: Von den 44
     * Schrottsorten hat die sperrigste eine mittlere Kante von 1,90 m (Waggon-
     * Drehgestell, LKW-Fahrerhaus). Was darunter fällt, passt nicht mehr
     * zwischen die Spitzen — dann ist im Spiel etwas nicht mehr aufnehmbar,
     * und das soll auffallen, bevor es jemand beim Spielen merkt.
     */
    expect(clawSpan(CLAW_OPEN_SPLAY)).toBeGreaterThan(2.0);
  });

  it("öffnet weiter, als es schließt", () => {
    expect(clawSpan(CLAW_OPEN_SPLAY)).toBeGreaterThan(clawSpan(0));
  });

  it("liefert eine Spitzentiefe, die zum Bodenanschlag passt", () => {
    /*
     * Hier stand zweimal eine Behauptung darueber, welche Stellung die tiefere
     * ist — erst „zu ist tiefer", dann „offen ist tiefer". Beide waren fuer
     * ihre jeweilige Form richtig und wurden beim naechsten Formwechsel
     * falsch. Die Frage ist ohnehin die falsche: Fuer den Bodenanschlag zaehlt
     * nicht, welche Stellung tiefer ist, sondern dass mit der tiefsten
     * gerechnet wird.
     */
    const offen = clawTipDepth(CLAW_OPEN_SPLAY);
    const zu = clawTipDepth(CLAW_CLOSED_SPLAY);
    expect(offen).toBeGreaterThan(1.5);
    expect(zu).toBeGreaterThan(1.5);
    expect(CLAW_MAX_DEPTH, "Maximum liegt unter einer Einzelstellung").toBeGreaterThanOrEqual(
      Math.max(offen, zu) - 1e-9
    );
    for (let i = 0; i <= 20; i++) {
      expect(clawTipDepth((CLAW_OPEN_SPLAY * i) / 20)).toBeLessThanOrEqual(CLAW_MAX_DEPTH + 1e-9);
    }
    /*
     * Obergrenze der Spitzentiefe. Sie huetet, dass der Greifer nicht so lang
     * wird, dass der Arm ihn nicht mehr ueber eine Wand hebt. Dass es reicht,
     * prueft nicht diese Zahl, sondern `test/reach.test.ts`: dort wird fuer
     * jede Mulde nachgerechnet, ob der Arm ueber ihre Wand kommt.
     */
    expect(CLAW_MAX_DEPTH).toBeLessThan(3.0);
  });

  it("läuft vom Gelenk bis zur Spitze durchgehend abwärts", () => {
    /*
     * Die Schale ist ein gleichmäßiger Bogen von 86°, kein Haken: Sie krümmt
     * sich zur Achse hin, läuft dabei aber bis zur Spitze weiter nach unten.
     *
     * Am 13.09.2026 stand hier kurz das Gegenteil — ein Rücklauf nach oben.
     * Der kam aus einer 170°-Form, die aus nur zwei Datenblattmaßen
     * zurückgerechnet war. Gegen alle sechs Maße gerechnet bleibt der flache
     * Bogen übrig, und der hakt nicht.
     */
    let vorher = 0;
    for (let k = 1; k <= CLAW_SEGMENTS; k++) {
      const tiefe = -clawPoint(0, CLAW_CLOSED_SPLAY, k, new THREE.Vector3()).y;
      expect(tiefe, `Station ${k} läuft nicht weiter abwärts`).toBeGreaterThan(vorher);
      vorher = tiefe;
    }
  });

  it("nimmt für den Bodenanschlag den tiefsten Punkt der Schale", () => {
    /*
     * Heute ist das die Spitze. Die Rechnung geht trotzdem über alle Stationen,
     * und das ist Absicht: Sobald jemand am Krümmungsprofil dreht und die
     * Schale am Ende nach innen hakt, wandert der tiefste Punkt nach oben.
     * Wer dann noch nach der Spitze absetzt, fährt mit dem Bauch der Schale in
     * den Beton, ohne dass ein Test anschlägt.
     */
    for (const splay of [CLAW_CLOSED_SPLAY, CLAW_OPEN_SPLAY]) {
      let tiefste = 0;
      for (let k = 1; k <= CLAW_SEGMENTS; k++) {
        tiefste = Math.max(tiefste, -clawPoint(0, splay, k, new THREE.Vector3()).y);
      }
      expect(clawTipDepth(splay)).toBeCloseTo(tiefste, 6);
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
