import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EM_BREITE, FASSUNGEN, luft, seite, wert, schriftgroesse, type Fassung, type Kasten } from "./cssmass";

/*
 * Wieviel Platz der Funktionskranz braucht — und ob der naechste Eintrag noch
 * hineinpasst.
 *
 * Der Kranz klappt um den rechten Daumen auf; seine Eintraege sitzen auf einem
 * Kreis und werden durch Ziehen in ihre Richtung gewaehlt. Jeder neue Eintrag
 * rueckt alle anderen naeher zusammen: acht stehen 45 Grad auseinander, neun
 * nur noch 40, zehn nur noch 36.
 *
 * Nachgemessen am 16.09.2026, als KIPPEN als neunter Eintrag dazukam (E-088),
 * und der Befund war unangenehm: Schon die ACHT Eintraege ueberlappten sich —
 * um 3,5 px an den Ecken, auf dem iPad. Der Grund war kein Rechenfehler,
 * sondern `box-sizing`: `width: 76px` war die Breite des INHALTS, der
 * 2-px-Rahmen kam obendrauf, und der negative Rand (-38px) traf damit nicht
 * die Mitte, sondern lag 2 px daneben. Dazu waechst der scharfgestellte
 * Eintrag per `transform: scale` — auch das war nie mitgerechnet.
 *
 * Deshalb rechnet dieser Waechter mit dem, was der Browser wirklich zeichnet:
 * Randbox, Vergroesserung, echte Zeichenbreite der Schrift.
 */

const wurzel = resolve(__dirname, "..");
const touchTs = readFileSync(resolve(wurzel, "src/core/touch.ts"), "utf8");

/**
 * Mindestluft zwischen zwei Eintraegen in px.
 *
 * // SW: Startwert zum Austesten auf dem Geraet. Hergeleitet aus dem, was man
 * sieht: Jeder Eintrag hat einen 2 px starken Rahmen. Bleiben weniger als
 * 2 + 2 px Abstand, beruehren sich die Rahmen zweier Nachbarn und werden zu
 * EINEM Strich — dann sieht der Kranz aus wie ein Band statt wie neun
 * Knoepfe. 6 px sind zwei Rahmen plus 2 px sichtbarer Spalt.
 */
const MIN_LUFT = 6;

/** Halbmesser des Kranzes, aus dem Quelltext statt aus dem Gedaechtnis. */
function radius(): number {
  const m = /const RADIAL_R = (\d+);/.exec(touchTs);
  if (!m) throw new Error("RADIAL_R steht nicht mehr in touch.ts");
  return Number(m[1]);
}

/** Die Beschriftungen des Kranzes, in der Reihenfolge der Seite. */
function eintraege(): string[] {
  const von = seite.indexOf('<div class="hidden-actions">');
  const bis = seite.indexOf('<div class="hidden-actions" id="menu-actions">');
  if (von < 0 || bis < 0) throw new Error("Traegerblock des Kranzes nicht gefunden");
  return [...seite.slice(von, bis).matchAll(/<span id="[\w-]+">([^<]+)<\/span>/g)].map((m) => m[1]);
}

const SEKTOR = ["#radial .sektor"];
const SEL = ["#radial .sektor.sel"];

/** Breite/Hoehe eines Eintrags, so wie er auf dem Glas steht (Randbox). */
function sektorMass(f: Fassung): { w: number; h: number; schrift: number } {
  /*
   * Ohne `border-box` waere `width` der Inhalt und der Rahmen kaeme obendrauf
   * — genau der Fehler, der bis zum 16.09.2026 3,5 px Ueberlappung erzeugt
   * hat. Der Waechter besteht darauf, statt still falsch zu rechnen.
   */
  expect(wert(SEKTOR, "box-sizing", f), "der Sektor steht nicht auf border-box").toBe(
    "border-box"
  );
  const w = Number(/(\d+)px/.exec(wert(SEKTOR, "width", f) ?? "")?.[1]);
  const h = Number(/(\d+)px/.exec(wert(SEKTOR, "height", f) ?? "")?.[1]);
  expect(Number.isFinite(w) && Number.isFinite(h), "Sektormass fehlt").toBe(true);
  return { w, h, schrift: schriftgroesse(SEKTOR, f) };
}

/** Der negative Rand MUSS die halbe Randbox sein, sonst sitzt nichts mittig. */
function randPruefen(f: Fassung, w: number, h: number): void {
  const m = wert(SEKTOR, "margin", f);
  const zahlen = (m ?? "").split(/\s+/).map((t) => Number(/(-?\d+)px/.exec(t)?.[1] ?? 0));
  expect(zahlen.length, `margin unerwartet: ${m}`).toBe(4);
  expect(zahlen[0], "oberer Rand trifft die Mitte nicht").toBe(-h / 2);
  expect(zahlen[3], "linker Rand trifft die Mitte nicht").toBe(-w / 2);
}

/** Vergroesserung des scharfgestellten Eintrags (`transform: scale(...)`). */
function skala(f: Fassung): number {
  const t = wert(SEL, "transform", f);
  const m = /scale\(([\d.]+)\)/.exec(t ?? "");
  if (!m) throw new Error(`transform des gewaehlten Eintrags unklar: ${t}`);
  return Number(m[1]);
}

/** Die n Kaesten auf dem Ring; `gross` ist der scharfgestellte. */
function ring(n: number, r: number, w: number, h: number, gross: number, s: number): Kasten[] {
  const out: Kasten[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; // 0 = oben, im Uhrzeigersinn — wie buildRadial
    const cx = Math.sin(a) * r;
    const cy = -Math.cos(a) * r;
    const bw = i === gross ? w * s : w;
    const bh = i === gross ? h * s : h;
    out.push({ name: `E${i}`, x0: cx - bw / 2, x1: cx + bw / 2, y0: cy - bh / 2, y1: cy + bh / 2 });
  }
  return out;
}

/**
 * Engste Stelle des Kranzes: jeder Eintrag einmal scharfgestellt, gegen alle
 * anderen. Negativ heisst Ueberlappung.
 */
export function engste(n: number, r: number, w: number, h: number, s: number): number {
  let min = Infinity;
  for (let g = 0; g < n; g++) {
    const k = ring(n, r, w, h, g, s);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) min = Math.min(min, luft(k[i], k[j]));
    }
  }
  return min;
}

describe("Funktionskranz: neun Eintraege, und was der zehnte kostet", () => {
  const labels = eintraege();
  const r = radius();

  it("KIPPEN ist dabei — sonst ist das Seitwaertskippen auf dem iPad nicht da", () => {
    expect(labels, "kein KIPPEN im Kranz").toContain("KIPPEN");
    expect(labels.length, "der Kranz hat nicht mehr neun Eintraege").toBe(9);
  });

  for (const f of FASSUNGEN) {
    it(`${f.name}: kein Eintrag ueberlappt einen anderen`, () => {
      const { w, h } = sektorMass(f);
      randPruefen(f, w, h);
      const s = skala(f);
      const gemessen = engste(labels.length, r, w, h, s);
      expect(
        gemessen,
        `engste Stelle ${gemessen.toFixed(1)} px bei ${labels.length} Eintraegen ` +
          `(R=${r}, Kasten ${w}x${h}, scharf x${s})`
      ).toBeGreaterThanOrEqual(MIN_LUFT);
    });

    it(`${f.name}: die laengste Beschriftung passt in den Kasten`, () => {
      const { w, schrift } = sektorMass(f);
      const innen = w - 2 * 2; // 2 px Rahmen je Seite
      const laengste = labels.reduce((a, b) => (a.length >= b.length ? a : b));
      const breite = laengste.length * schrift * EM_BREITE;
      expect(
        breite,
        `"${laengste}" braucht ${breite.toFixed(1)} px, im Kasten sind ${innen} px ` +
          `— der Text bricht um und sprengt die Hoehe`
      ).toBeLessThanOrEqual(innen);
    });
  }

  it("ein ZEHNTER Eintrag passt NICHT mehr — mit Zahlen", () => {
    /*
     * Die Antwort auf die Frage, die zu diesem Waechter gefuehrt hat. Zehn
     * Eintraege ueberlappen sich zwar nicht (0,7 px bleiben auf dem iPad),
     * aber die Rahmen zweier Nachbarn stossen aneinander. Wer einen zehnten
     * will, aendert nicht diese Zahl, sondern die Gliederung: ein Eintrag
     * wandert ins Menue, oder der Kranz bekommt zwei Ringe. Das entscheidet
     * Patrick, nicht dieser Test.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    const neun = engste(9, r, w, h, s);
    const zehn = engste(10, r, w, h, s);
    expect(neun).toBeGreaterThanOrEqual(MIN_LUFT);
    expect(zehn, `zehn Eintraege haetten ${zehn.toFixed(1)} px Luft`).toBeLessThan(MIN_LUFT);
  });

  it("GEGENPROBE: die Masse von gestern wuerden gemeldet", () => {
    /*
     * R = 104, Kasten 76 x 30 als INHALT (also 80 x 34 sichtbar), scharf
     * x1,15 — der Stand bis zum 16.09.2026. Schon mit ACHT Eintraegen faellt
     * er durch. Ohne diese Gegenprobe koennte die Rechnung oben stillschweigend
     * immer gruen sein.
     */
    expect(engste(8, 104, 80, 34, 1.15), "die alten Masse fallen nicht auf").toBeLessThan(0);
    expect(engste(9, 104, 80, 34, 1.15)).toBeLessThan(0);
  });

  it("GEGENPROBE: ein groesserer Kasten faellt durch", () => {
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    expect(
      engste(labels.length, r, w + 12, h, s),
      "12 px breiter faellt nicht auf — dann misst der Test nichts"
    ).toBeLessThan(MIN_LUFT);
  });

  it("und der Kranz passt aufs Bild, wenn der Daumen mittig aufsetzt", () => {
    /*
     * Der Kranz erscheint dort, wo der Daumen liegt, und wird NICHT an den
     * Bildrand gerueckt. Setzt der Daumen ganz unten auf, haengt der unterste
     * Eintrag unter dem Bildrand — lesen kann man ihn dann nicht mehr (waehlen
     * schon, die Richtung stimmt trotzdem).
     *
     * Gemessen wird deshalb das BAND in der rechten Bildhaelfte, in dem ein
     * Daumen einen vollstaendig sichtbaren Kranz erzeugt. Es muss ein Band
     * geben; wie breit es ist, steht in der Meldung und im Log.
     */
    for (const f of FASSUNGEN) {
      const { w, h } = sektorMass(f);
      const s = skala(f);
      const hoch = r + (h * s) / 2;
      const breit = r + (w * s) / 2;
      const bandH = f.h - f.sa.t - f.sa.b - 2 * hoch;
      /*
       * Die rechte Zone ist die halbe Bildbreite (`#touch .zone: width 50%`),
       * der Daumen setzt also zwischen w/2 und dem rechten sicheren Rand auf.
       * Sichtbar bleibt der Kranz, wo auch links noch Platz ist.
       */
      const bandB = f.w - f.sa.r - breit - Math.max(f.w / 2, f.sa.l + breit);
      expect(
        bandH,
        `${f.name}: kein Streifen, in dem der Kranz ganz sichtbar ist ` +
          `(Ring ${hoch.toFixed(0)} px hoch ueber/unter dem Daumen, Bild ${f.h} px)`
      ).toBeGreaterThan(0);
      expect(bandB, `${f.name}: der Kranz passt in keiner Daumenlage in die Breite`).toBeGreaterThan(0);
    }
  });
});
