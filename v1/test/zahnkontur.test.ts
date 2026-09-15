/**
 * Wächter: Der Zahn sitzt tangential — kein harter Knick am Übergang (E-069).
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

  it("die Aussenkontur läuft über den Zahnsitz durch", () => {
    /*
     * WOHER DIE SCHRANKE KOMMT. Gemessen am gebauten Stand mit 0,5-mm-Raster:
     * 0,94°. Das ist nicht null, sondern das Eigenrauschen des Verfahrens —
     * das Netz der Schale hat alle 0,33 Stationen eine Facette, und die
     * Ausgleichsgerade mittelt sie nicht restlos weg. Mit dem gröberen
     * 1-mm-Raster dieses Wächters sind es rund 1,5°.
     *
     * Die Schranke steht auf 4°. Sie lässt den gebauten Stand mit gut dem
     * Doppelten seines Rauschens durch und meldet den alten Stand (11,9°)
     * dreifach sicher. Enger gesetzt würde sie beim nächsten Facettenwechsel
     * grundlos ausschlagen; weiter gesetzt ließe sie den halben Knick durch.
     */
    const grad = knickBei(gebaut, ZAHNSITZ);
    expect(grad, `Knick am Zahnsitz: ${grad.toFixed(2)}°`).toBeLessThan(4);
  });

  it("GEGENPROBE: dieselbe Messung meldet den Knick von vor E-069", () => {
    /*
     * Derselbe Zinken, nur der Zahn wieder um seine Eigenbiegung gegengedreht
     * — der Stand, den Patrick beanstandet hat. Gemessen 11,90° mit 0,5 mm.
     */
    const grad = knickBei(altA, ZAHNSITZ);
    expect(grad, `alter Stand: ${grad.toFixed(2)}°`).toBeGreaterThan(8);
  });

  it("GEGENPROBE: und sie wächst mit dem Knick, statt nur anzuschlagen", () => {
    /*
     * Eine Gegenprobe, die bei jedem Fehler dasselbe meldet, misst nichts. Bei
     * doppelter Gegendrehung muss auch der gemessene Knick ungefähr doppelt so
     * groß sein — gemessen 24,62° gegen 11,90°.
     */
    const einfach = knickBei(altA, ZAHNSITZ);
    const zweifach = knickBei(doppelt, ZAHNSITZ);
    expect(zweifach).toBeGreaterThan(1.7 * einfach);
    /* Und beide treffen den wirklich eingestellten Winkel auf ein Grad genau. */
    expect(einfach).toBeCloseTo(Math.abs(zahnEigenwinkel() * GRAD), 0);
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
