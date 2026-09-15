/**
 * Wächter für die Erreichbarkeit der Mulden.
 *
 * Anlass (10.09.2026): Aluminium liess sich von der Standposition aus nicht in
 * seine Mulde bugsieren — man stiess gegen die Kopfwand. Nachgerechnet war es
 * nicht knapp, sondern unmöglich: Bei 4,6 m Abstand kommt die Krallenspitze auf
 * 1,43 m, die Wand ist 2,50 m hoch.
 *
 * Der Arm hat einen scharfen Knick bei rund 6,5 m — näher dran bleibt er
 * eingeklappt, jenseits von 9,5 m reicht er nicht mehr. Wer eine Mulde
 * verschiebt, muss dieses Fenster treffen; der Test sagt es sofort.
 */
import { describe, it, expect } from "vitest";
// Nur noch `hoechsteKrallenspitze`: `THREE`, `tempoFaktor`, `anlaufZeit` und
// `CAB_MAX` wurden hier eingefuehrt, aber nie gelesen — gemeldet von der neuen
// Typpruefung fuer `test/` (E-038). Wer das Fahrtempo wachen will, braucht
// einen eigenen Waechter, keinen ungenutzten Import.
import { hoechsteKrallenspitze } from "../src/excavator/excavator";
import { CONFIGS } from "../src/world/containers";
import {
  neueAbholstelle,
  setBaggerOrt,
  ABKIPP_ZONE,
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
  BED_HALF_W,
  TIP_CREEP_M,
} from "../src/delivery/routes";
import { baleYard, PRESS_CENTER as PRESSE } from "../src/world/press";
import { BAGGER_STAND, VERLADE_STAND } from "../src/world/baggerstand";
/** Vorderkante der Silo-Reihe — die Seite, auf der der Bagger das Silo hat. */
const SILO_KANTE_X = Math.min(
  ...CONFIGS.filter((c) => c.lager === true).map((c) => c.x - c.size[0] / 2)
);

/*
 * Standplatz des Baggers — aus `world/baggerstand.ts`, nicht abgeschrieben.
 *
 * Die Zahl stand hier als Kopie aus `excavator.ts`. Beim Platzumbau (E-010)
 * ist der Standplatz von (−2,5 | −19,5) auf (−0,5 | −22,5) gewandert; eine
 * Kopie wandert nicht mit, und der Test prueft dann Reichweiten von einer
 * Stelle aus, an der niemand steht. Gelesen wird `BAGGER_STAND` seitdem
 * direkt, siehe `LINIE` weiter unten; die Zwischenkopie `BAGGER` ist am
 * 15.09.2026 mit dem toten Helfer `abstand()` weggefallen (E-038).
 */

/**
 * Mulden, die der Spieler von seinem Standplatz aus selbst befüllt.
 *
 * Seit E-010 sind das die beiden Halden in der Ausbuchtung und die drei
 * Mulden an der Westflanke (Kupfer+Messing, Kabel, Alu+Zink). Die Silo-Reihe
 * steht bewusst ausserhalb — dorthin faehrt der Bagger, oder Lambert traegt
 * es hin.
 */
/*
 * Seit E-028 ist aus den drei Metallmulden EINE geworden. Die alten Namen
 * standen hier noch drin — der Test lief weiter gruen und prueft dabei drei
 * Behaelter, die es nicht mehr gibt, also faktisch nur noch die beiden Halden.
 */
const SELBST_BEFUELLT = ["c_mixed", "c_steel", "r_bunt", "r_rubble"];

/**
 * Die Arbeitslinie des Baggers.
 *
 * Er arbeitet nicht von einem Punkt: Ein Ring von 4,0 bis 9,5 m fasst keine
 * zehn Ziele. Geprueft wird deshalb, ob jedes Ziel von IRGENDEINEM Punkt
 * dieser kurzen Linie aus ueber seine Wand zu befuellen ist.
 *
 * Nach dem Umbau (E-010) ist sie viel kuerzer als vorher: Der Standplatz
 * liegt in der Oeffnung der Ausbuchtung, und alle acht Ziele liegen ringsum
 * im Schwenkband. Der lange Umweg zur offenen Westseite der alten Stahlmulde
 * entfaellt damit ersatzlos — die Halde ist jetzt hinter dem Sitz, nicht
 * neben der Presse.
 */
const HUB_CACHE = new Map<number, number>();
const LINIE: Array<[number, number]> = [];
// Fünf Meter nach vorn, wie bisher — so weit setzt man im Arbeiten um.
for (let t = 0; t <= 1.0001; t += 0.05)
  LINIE.push([BAGGER_STAND.x, BAGGER_STAND.z + t * 5]);
// Und zwei Meter nach links und rechts, fuer die beiden Halden nebenan.
for (let t = -1; t <= 1.0001; t += 0.25) LINIE.push([BAGGER_STAND.x + t * 2, BAGGER_STAND.z]);

// Ein Helfer `abstand(x, z)` stand hier, ohne je gerufen zu werden — die
// Schleife weiter unten rechnet ihren Abstand selbst. Entfernt am 15.09.2026,
// gemeldet von der neuen Typpruefung fuer `test/` (E-038).

describe("Reichweite des Arms", () => {
  it("der Arm hat eine tote Zone in Baggernähe", () => {
    /*
     * Der Befund, der die Muldenreihe zum Umziehen gezwungen hat: Ganz nah am
     * Bagger bleibt der Arm eingeklappt. Seit der Drehpunkt hoeher sitzt und
     * der Ausleger steiler stehen darf (11.09.2026), reicht er frueher hoch —
     * die tote Zone ist kleiner, aber es gibt sie:
     *
     *          3,0 m   4,6 m   6,0 m   7,5 m   9,5 m
     *   vorher  -1,68    1,48    2,52    6,28    1,73
     *   nachher -1,28    2,55    8,11    6,68    2,13
     */
    expect(hoechsteKrallenspitze(3.0)).toBeLessThan(0);
    expect(hoechsteKrallenspitze(4.6)).toBeLessThan(3.0);
    expect(hoechsteKrallenspitze(7.5)).toBeGreaterThan(4.0);
    // ... und ueber eine 3-m-Muldenwand kommt er jetzt schon bei 6 m
    expect(hoechsteKrallenspitze(6.0)).toBeGreaterThan(3.0);
  });

  it("alles, was ein Kipper ablaedt, bleibt in Reichweite", () => {
    /*
     * Der Arm erreicht den BODEN nur zwischen 3,0 und 9,5 m. Der Kipper dockt
     * an, kippt und zieht dann gekippt an — der Rest der Fuhre rutscht auf
     * dieser Strecke heraus. Reicht sie ueber 9,5 m hinaus, liegt dort
     * Schrott, den man nicht mehr wegbekommt (Befund 10.09.2026).
     *
     * Bis zum 14.09.2026 abends wanderte die Abladestelle mit dem Bagger, und
     * der Test fuhr fuenf Baggerstellungen ab. Seitdem sind beide Orte FEST:
     * der Selbstabkipper auf der Spur x 2,0 (`ABKIPP_ZONE`), der Haendler in
     * der Suedostecke. Gemessen wird deshalb vom Standplatz aus — und zwar
     * ueber die ganze Strecke, auf der die Fuhre herausrutscht: von der
     * Abkippstelle bis zum Ende des Anziehens.
     */
    const [zx, zz] = ABKIPP_ZONE;
    for (const weg of [0, TIP_CREEP_M]) {
      const d = Math.hypot(zx - BAGGER_STAND.x, zz + weg - BAGGER_STAND.z);
      expect(
        d,
        `Abwurf bei ${d.toFixed(1)} m — dort kommt der Arm nicht mehr auf den Boden`
      ).toBeLessThan(9.5);
      expect(d, `Abwurf bei ${d.toFixed(1)} m — dort ist der Arm zu eng`).toBeGreaterThan(3.0);
    }
  });

  it("und die Ladefläche des Händlers liegt ganz im Greifbereich", () => {
    /*
     * Der zweite Teil desselben Gedankens, seit der Wagen quer steht
     * (14.09.2026 abends): Was auf seiner Flaeche liegt, muss man auch
     * herunterbekommen. Vorher lag die hintere Haelfte bei 10 bis 13,5 m.
     */
    /*
     * Die Flaeche liegt UM den Haltepunkt herum: Der Ursprung eines Fahrzeugs
     * ist die Mitte der Ladeflaeche (`vehicleModel.ts`). Bis zum 15.09.2026
     * rechnete dieser Test sie noerdlich davon — und pruefte damit einen Ort,
     * an dem keine Ladung liegt.
     */
    const laenge = 5.4;
    for (const dx of [-BED_HALF_W, 0, BED_HALF_W]) {
      for (const dz of [-laenge / 2, 0, laenge / 2]) {
        const d = Math.hypot(
          ABLADE_SPUR_X + dx - BAGGER_STAND.x,
          ABLADE_HALT_Z + dz - BAGGER_STAND.z
        );
        expect(d, `Ladefläche bei ${d.toFixed(1)} m`).toBeLessThan(9.5);
      }
    }
  });

  it("jenseits von zehn Metern reicht er gar nicht", () => {
    expect(hoechsteKrallenspitze(10.5)).toBe(-Infinity);
  });

  for (const cfg of CONFIGS) {
    if (!SELBST_BEFUELLT.includes(cfg.id)) continue;
    it(`${cfg.label}: der Arm kommt über die Wand`, () => {
      const wandH = cfg.size[2];
      const [w, d] = cfg.size;
      /*
       * Geprueft wird, ob IRGENDEIN Punkt der Zone von IRGENDEINEM Punkt der
       * Arbeitslinie aus zu treffen ist — nicht nur die naechste Ecke.
       *
       * Vorher stand hier die naechste Ecke, und das ergab einen falschen
       * Alarm, sobald ein Behaelter dicht an der Linie steht: Bei einem
       * 3,6-m-Container liegt die nahe Kante dann in der toten Zone (3,3 m),
       * die Mitte aber bei 6,1 m mit 8,1 m Hubhoehe. Man greift auch nicht die
       * Kante an, sondern laesst in den Kasten fallen.
       */
      let beste: { d: number; h: number; p: [number, number] } | null = null;
      const SCHRITT = 0.5;
      // `hoechsteKrallenspitze` rechnet die ganze Armgeometrie ab; ueber ein
      // Raster aufgerufen dauert der Test sonst Minuten. Auf 10 cm gerundet
      // gemerkt — feiner als die Schrittweite des Rasters ohnehin ist.
      const hubBei = (dist: number): number => {
        const k = Math.round(dist * 10);
        let v = HUB_CACHE.get(k);
        if (v === undefined) {
          v = hoechsteKrallenspitze(k / 10);
          HUB_CACHE.set(k, v);
        }
        return v;
      };
      for (const [px, pz] of LINIE) {
        for (let zx = cfg.x - w / 2; zx <= cfg.x + w / 2 + 1e-6; zx += SCHRITT) {
          for (let zz = cfg.z - d / 2; zz <= cfg.z + d / 2 + 1e-6; zz += SCHRITT) {
            const dist = Math.hypot(zx - px, zz - pz);
            const hoch = hubBei(dist);
            if (hoch > wandH + 0.4 && (beste === null || dist < beste.d)) {
              beste = { d: dist, h: hoch, p: [px, pz] };
            }
          }
        }
      }
      expect(
        beste,
        `${cfg.label} (Wand ${wandH.toFixed(2)} m) ist von keinem Punkt der ` +
          `Arbeitslinie aus zu befuellen`
      ).not.toBeNull();
    });
  }

  /*
   * Zwei Stellen, die der Spieler nicht selbst waehlt und trotzdem erreichen
   * muss: der Halteplatz des Abholers und die Stelle, an der die Presse das
   * fertige Paket auswirft. Beide werden zur Laufzeit aus der Baggerstellung
   * gerechnet, beide koennten dabei aus dem Greifring rutschen — und beide
   * waeren dann eine Sackgasse: Was man nicht greifen kann, kann man weder
   * verladen noch verkaufen.
   */
  it("der Abholer haelt im Greifring des Verladeplatzes", () => {
    /*
     * Bis zum 14.09.2026 hielt der Abholer dort, wo der Bagger gerade stand —
     * der Test prüfte deshalb vier Baggerstellungen durch. Mit E-010 ist das
     * umgedreht: Der Verladeplatz ist ein ORT, und wer laden will, fährt hin
     * („Silo zu Abholer — der Spieler mit dem Bagger am Verladeplatz", E-011).
     * Die alte Rechnung ginge hier gar nicht mehr auf; vom Hauptstandplatz
     * sind es 26 m bis zur Silo-Reihe.
     *
     * Geprüft wird jetzt die Eigenschaft, die davon übrig bleibt und auf die
     * es ankommt: Steht der Bagger auf seinem zweiten Standplatz, liegt der
     * Container im Greifring, und der Arm kommt über die Bordwand.
     */
    setBaggerOrt(() => BAGGER_STAND);
    const [x, z] = neueAbholstelle();
    const d = Math.hypot(x - VERLADE_STAND.x, z - VERLADE_STAND.z);
    expect(d, `Abholer ${d.toFixed(1)} m vom Verladeplatz`).toBeGreaterThanOrEqual(4.0);
    expect(d, `Abholer ${d.toFixed(1)} m vom Verladeplatz`).toBeLessThanOrEqual(9.5);
    expect(hoechsteKrallenspitze(d), `Hubhoehe bei ${d.toFixed(1)} m`).toBeGreaterThan(2.5);
    /*
     * Und er steht auf der dem Silo ABGEWANDTEN Seite des Baggers — sonst
     * stuende er in der Reihe. Seit dem 15.09.2026 liegen die Silos oestlich
     * des Verladeplatzes, der Abholer also westlich davon; bis dahin war es
     * umgekehrt. Geprueft wird die Eigenschaft, nicht die Himmelsrichtung.
     */
    const siloSeite = Math.sign(SILO_KANTE_X - VERLADE_STAND.x);
    expect(
      Math.sign(x - VERLADE_STAND.x),
      "der Abholer steht auf derselben Seite wie die Silo-Reihe"
    ).toBe(-siloSeite);
  });

  it("das Presspaket bleibt in der Kammer", () => {
    /*
     * "Ballen bleiben in Presse, ohne Abscheiden" (12.09.2026). Dazwischen
     * warf die Presse zum Bagger hin aus; der Test hielt fest, dass die
     * Auswurfstelle im Greifring liegt. Jetzt haelt er das Gegenteil fest:
     * Es gibt keine Auswurfstelle, das Paket liegt in der Kammer — und weil
     * es dort liegt, blockiert es die naechste Fuhre. Das ist gewollt.
     */
    const y = baleYard();
    expect(y.x).toBeCloseTo(PRESSE.x, 5);
    expect(y.z).toBeCloseTo(PRESSE.z, 5);
  });
});
