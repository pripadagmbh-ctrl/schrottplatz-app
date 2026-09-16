/**
 * Wächter: Der Zahn sitzt tangential, und sein Absatz sitzt nur an seinem Sitz
 * (E-069, umgeschrieben mit E-090).
 *
 * ACHTUNG, WER DAS HIER „REPARIEREN" WILL: Die Regel „kein Knick am Zahnsitz"
 * ist am 16.09.2026 ABSICHTLICH gefallen. Patrick hat sie selbst aufgehoben —
 * beide Ansagen stehen weiter unten mit Datum. Der Zahn ist ein eigenes
 * Verschleißteil auf einem breiteren Saum; dass er sich absetzt, ist jetzt
 * gewollt und wird geprüft, statt verboten.
 *
 * Patrick am 15.09.2026, vor `docs/f5-greiferschale.png` und einem Vorbildfoto
 * (`docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`, gelber Kringel auf dem
 * Übergang Schale → Lager):
 *
 *   „dieser harte Knick im Zahn, den gibt es nicht. Das ist nicht so."
 *
 * Der Knick war eine Zahl: `zahnAnstellung()` = −12,15°, eingebaut am
 * 14.09.2026, damit die ACHSE des Zahns bei offenem Greifer lotrecht steht.
 * Seit E-069 ist die Anstellung null, der Zahn setzt das Schalenende
 * tangential fort — und steht offen dafür 12,15° nach innen. Das ist Patricks
 * bewusste Entscheidung gegen seine eigene Ansage vom 13.09.2026, getroffen am
 * Blatt `docs/f5-zahnknick-2026-09-15.svg`.
 *
 * Geprüft wird auf ZWEI Ebenen, und beide brauchen es:
 *
 *   1. AN DER ZAHL. `zahnAnstellung()` ist null. Exakt, schnell, und die
 *      Ursache selbst.
 *   2. AM GEBAUTEN NETZ. Die Aussenkontur über dem Schalenkreis knickt am
 *      Zahnsitz nicht. Das fängt auch, was die Zahl nicht sieht — einen Zahn,
 *      der anders gebaut wird, oder ein Schalenende, das sich verzieht.
 *
 * Jede Schranke hat eine Gegenprobe, die MELDEN muss.
 */
import { describe, it, expect } from "vitest";
import {
  OFFEN,
  schalenEnde,
  zahnAnstellung,
  zahnEigenwinkel,
} from "../src/fuenfschalen/teile";
import { aussenkontur, knickBei, kontur, schulterstufe, ZAHNSITZ } from "../tools/fuenfschalen/kontur";

const GRAD = 180 / Math.PI;

/**
 * Auflösung der Maske für die Wächter: 1 mm.
 *
 * Das Werkzeug misst mit 0,5 mm und kommt damit auf 0,94° Eigenrauschen. Ein
 * Wächter darf `npm test` nicht um Minuten verlängern — die Maske ist bei
 * halber Kantenlänge viermal so groß —, und die Schranke unten hat genug Luft
 * für das gröbere Raster. Beide Zahlen stehen in den Prüfungen selbst.
 */
const RASTER = 0.001;

describe("Der Zahn setzt das Schalenende fort — kein Knick (E-069)", () => {
  it("sitzt tangential: die Anstellung gegen das Schalenende ist null", () => {
    /*
     * Das ist die Ursache, nicht die Wirkung. Steht hier etwas anderes als
     * null, ist der Zahn gegen die Schale verdreht — und genau das hat Patrick
     * beanstandet.
     */
    expect(zahnAnstellung() * GRAD).toBeCloseTo(0, 6);
    /* Und zwar, weil `OFFEN` und die Tangente am Schalenende dasselbe sind. */
    expect(OFFEN).toBeCloseTo(schalenEnde().th, 9);
  });

  it("GEGENPROBE: ein anderer Anschlag stellt den Zahn wieder schief", () => {
    /*
     * Die Formel `offen − schalenEnde().th` hält beides zusammen. Wer am
     * Anschlag dreht, ohne es zu wollen, bekommt den Knick zurück — und diese
     * Prüfung zeigt, dass die Formel das auch meldet.
     */
    expect(Math.abs(zahnAnstellung(OFFEN + 0.2) * GRAD)).toBeGreaterThan(11);
  });

  /*
   * Die Kontur am gebauten Netz. Einmal gerechnet, dreimal geprüft — jede
   * Silhouette kostet eine Rasterung.
   */
  const gebaut = aussenkontur(zahnAnstellung(), 7.2, RASTER);
  const altA = aussenkontur(zahnEigenwinkel(), 7.2, RASTER);
  const doppelt = aussenkontur(2 * zahnEigenwinkel(), 7.2, RASTER);

  /*
   * ======================================================================
   * 16.09.2026 (E-090): DIE ALTE REGEL IST GEFALLEN — UND ZWAR ABSICHTLICH.
   *
   * Bis heute stand hier: „der Knick am Zahnsitz ist kleiner als 4°." Die
   * Regel kam aus E-069 und aus Patricks Foto vom 15.09.2026, auf dem der
   * Übergang Schale → Zahn durchläuft.
   *
   * Seit E-090 ist der Saum 240 mm breit und der Zahn 120 mm. Der Zahn ist ein
   * eigenes VERSCHLEISSTEIL und sitzt als schmaler Keil mittig auf dem breiten
   * Saum — links und rechts bleibt eine Schulter stehen. Patrick am 16.09.2026,
   * ausdrücklich gefragt, ob dieser Absatz bleiben soll:
   *
   *     „Absatz ist richtig, wie auf dem Foto."
   *
   * Damit hat er seine eigene Ansage vom 15.09.2026 aufgehoben — nicht ich.
   * BEIDE DATEN STEHEN HIER, damit niemand in vier Wochen die alte Regel
   * „repariert": 15.09. „dieser harte Knick im Zahn, den gibt es nicht",
   * 16.09. „Absatz ist richtig, wie auf dem Foto."
   *
   * Der Wächter prüft deshalb nicht mehr, dass es den Absatz NICHT gibt,
   * sondern dass er GENAU DORT und NUR DORT sitzt.
   * ======================================================================
   */

  it("hat den Absatz am Zahnsitz — der Zahn ist ein eigenes Verschleißteil", () => {
    /*
     * WOHER DAS FENSTER KOMMT. Gemessen am gebauten Stand: 9,68°. Die
     * Schranken stehen auf 6° und 14° — je gut ein Drittel Luft nach beiden
     * Seiten.
     *
     * Nach UNTEN: Unter 6° wäre der Absatz verschwunden, und das hieße, dass
     * der Zahn wieder mit der Schale mitgewachsen ist (`zahnBasis` hängt seit
     * E-090 an `MASS.spitze.breite`, nicht mehr am Schalenende). Genau dieser
     * Rückfall ist das, was der Wächter fangen soll — die Gegenprobe unten
     * zeigt, dass er ihn fängt: mit gegengedrehtem Zahn sind es 3,91°.
     *
     * Nach OBEN: Über 14° stünde der Zahn schief statt nur schmal. Die
     * Gegenprobe mit doppelter Gegendrehung liefert 17,13° und schlägt an.
     */
    const grad = knickBei(gebaut, ZAHNSITZ);
    expect(grad, `Absatz am Zahnsitz: ${grad.toFixed(2)}°`).toBeGreaterThan(6);
    expect(grad, `Absatz am Zahnsitz: ${grad.toFixed(2)}°`).toBeLessThan(14);
  });

  it("und die Kontur bleibt überall sonst glatt — der Absatz sitzt NUR am Sitz", () => {
    /*
     * Die Hälfte der neuen Regel, und die wichtigere: Ein Absatz am Zahnsitz
     * ist gewollt, eine knickende Schale nicht. Gemessen über die Stationen 2,
     * 3 und 4: 0,17°, 0,48°, 0,92° — glatt.
     *
     * Warum erst ab Station 4 und nicht bis 5: `knickBei` legt seine
     * Ausgleichsgeraden über ±0,55 Stationen um die Fuge. Bei Station 5 liegt
     * das Fenster schon zur Hälfte im Absatz (gemessen 7,81°) — das ist
     * derselbe Absatz, nicht ein zweiter. Wer hier bis 5 prüfte, prüfte den
     * Zahnsitz ein zweites Mal und nennte ihn einen Fehler.
     */
    for (const wo of [2, 3, 4]) {
      const grad = knickBei(gebaut, wo);
      expect(grad, `Knick bei Station ${wo}: ${grad.toFixed(2)}°`).toBeLessThan(4);
    }
  });

  it("GEGENPROBE: ohne den eigenen Zahn verschwindet der Absatz und der Wächter meldet", () => {
    /*
     * Derselbe Zinken, der Zahn um seine Eigenbiegung gegengedreht. Gemessen
     * 3,91° — unter der Schranke von 6°, der Wächter oben würde also anschlagen.
     * Das ist der Beweis, dass das Fenster nicht jeden Stand durchlässt.
     */
    const grad = knickBei(altA, ZAHNSITZ);
    expect(grad, `gegengedreht: ${grad.toFixed(2)}°`).toBeLessThan(6);
  });

  it("GEGENPROBE: und der Absatz wächst mit der Schiefstellung, statt nur anzuschlagen", () => {
    /*
     * Eine Gegenprobe, die bei jedem Fehler dasselbe meldet, misst nichts. Bei
     * doppelter Gegendrehung muss der gemessene Winkel deutlich größer werden —
     * gemessen 17,13° gegen 9,68° am gebauten Stand, und damit über der oberen
     * Schranke von 14°.
     */
    const gemessen = knickBei(gebaut, ZAHNSITZ);
    const zweifach = knickBei(doppelt, ZAHNSITZ);
    expect(zweifach).toBeGreaterThan(1.6 * gemessen);
    expect(zweifach, `doppelt gegengedreht: ${zweifach.toFixed(2)}°`).toBeGreaterThan(14);
    /* Der Zahn hat weiterhin seine Eigenbiegung von 12,15° — die Ursache selbst. */
    expect(Math.abs(zahnEigenwinkel() * GRAD)).toBeCloseTo(12.15, 1);
  });
});

describe("Die Schulter am Arm ist ein Absatz — und das ist bekannt (E-069)", () => {
  /*
   * KEIN VERBOT, SONDERN EINE MELDUNG. Patricks Kringel auf dem Vorbildfoto
   * liegt auf dem Übergang Schale → Lager, und dort sitzt seit dem 14.09.2026
   * ein absichtlicher Absatz (`SCHULTER_AB` 0,42 · `SCHULTER_BIS` 0,74 ·
   * `SCHULTER_VOR` 0,22). Ihn auszulaufen ist gerechnet und gemessen: Der
   * Absatz ginge von 3,8 auf 1,7 zurück, und das Zylinderauge stünde danach
   * 60 statt 26 mm vor dem Gusskörper — die Eigenschaft, für die E-013 die
   * Konsole abgeschafft hat.
   *
   * Der Wächter hält deshalb fest, WIE GROSS der Absatz heute ist. Ändert ihn
   * jemand, sei es beabsichtigt oder als Nebenwirkung, meldet er es.
   */
  const k = kontur(zahnAnstellung(), RASTER);

  it("hält den gemessenen Absatz fest: das 3,8-fache des mittleren Abfalls", () => {
    /*
     * 16.09.2026 (E-090): UNVERÄNDERT bei 3,77 — und das ist eine Nachricht.
     *
     * Der Trog hätte diese Zahl fast verdoppelt: Ein Rand, der schon an
     * Station 0 voll aufsteht, steckt im Fersenguss, und `schulterstufe` mass
     * dann 8,8 statt 3,8. Weil der Rand jetzt über die erste Station aufsteht
     * (`WANGE_RAMPE`), bleibt die Ferse, wie sie war. Die Zahl ist damit die
     * Probe darauf, dass der Umbau der SCHALE die FERSE nicht mitgenommen hat.
     */
    const s = schulterstufe(k);
    expect(s.verhaeltnis, `Schulterabsatz ${s.verhaeltnis.toFixed(2)}-fach`).toBeGreaterThan(3);
    expect(s.verhaeltnis).toBeLessThan(4.6);
    /* Und er sitzt im zweiten Drittel der Ferse, wo die Zeichnung ihn zeigt. */
    expect(s.bei).toBeGreaterThanOrEqual(0.4);
    expect(s.bei).toBeLessThanOrEqual(0.7);
  });

  it("der Arm hat auf der ganzen Ferse Werkstoff — ein Guss, keine Kette", () => {
    const ferse = k.filter((q) => q.teil === "Ferse");
    expect(ferse.length).toBeGreaterThan(20);
    expect(ferse.filter((q) => !q.aussen).map((q) => q.s.toFixed(2))).toEqual([]);
    expect(ferse.filter((q) => q.dicke < 100).map((q) => q.s.toFixed(2))).toEqual([]);
  });
});
