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
 * Seit E-093 (16.09.2026, Ansage Patrick) sind es wieder ACHT: SCHILDER ist
 * ins Pausenmenue umgezogen, weil es eine Anzeigeeinstellung ist. Die
 * reparierte Geometrie bleibt — sie war der eigentliche Befund.
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

describe("Funktionskranz: acht Eintraege, und was der neunte und zehnte kosten", () => {
  const labels = eintraege();
  const r = radius();

  it("KIPPEN ist dabei — sonst ist das Seitwaertskippen auf dem iPad nicht da", () => {
    expect(labels, "kein KIPPEN im Kranz").toContain("KIPPEN");
    expect(labels.length, "der Kranz hat nicht mehr acht Eintraege").toBe(8);
  });

  it("SCHILDER ist NICHT mehr dabei — es steht im Pausenmenue (E-093)", () => {
    /*
     * Ansage Patrick am Geraet, 16.09.2026: „Nimm Schild (Markierungen) aus
     * dem Menue raus, das kann ueber Hauptmenue geloest werden." Gemeint sind
     * die Zonenmarkierungen (`btn-marks`, Taste M) — eine Anzeigeeinstellung.
     * NICHT gemeint ist SCHILD (`btn-blade`, Taste I), das Raeumschild des
     * Baggers; das ist eine Maschinenfunktion und bleibt im Kranz. Die zwei
     * Namen sind einander so aehnlich, dass dieser Test beide nennt.
     */
    expect(labels, "SCHILDER steht wieder im Kranz").not.toContain("SCHILDER");
    expect(labels, "SCHILD — das Raeumschild — ist aus dem Kranz verschwunden").toContain("SCHILD");
    expect(
      seite.slice(seite.indexOf('<div class="hidden-actions" id="menu-actions">')),
      "SCHILDER ist nirgends im Menueblock — dann ist Taste M auf dem iPad unerreichbar"
    ).toContain('<span id="btn-marks">SCHILDER</span>');
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

  it("ein NEUNTER Eintrag passt noch, ein ZEHNTER nicht — mit Zahlen", () => {
    /*
     * Die Antwort auf die Frage, die zu diesem Waechter gefuehrt hat, neu
     * gemessen am 16.09.2026, nachdem SCHILDER ins Menue umgezogen ist
     * (E-093). Am iPad, R = 112, Kasten 62 x 34, scharf x1,10:
     *
     *    acht   14,1 px Luft   (iPhone mini quer: 18,3)
     *    neun    6,9 px         (11,1)
     *    zehn    0,7 px         ( 4,9)  -> unter der Schranke
     *    elf    -4,5 px         (-0,3)  -> Ueberlappung
     *
     * Ein Platz ist also frei: Der Kranz vertruege einen neunten Eintrag, ohne
     * dass sich etwas beruehrt. Was dort hineinkommt, entscheidet Patrick —
     * dieser Test fuellt den Platz nicht, er haelt ihn nur offen. Wer einen
     * ZEHNTEN will, aendert nicht diese Zahl, sondern die Gliederung: ein
     * Eintrag wandert ins Menue, oder der Kranz bekommt zwei Ringe.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    const acht = engste(8, r, w, h, s);
    const neun = engste(9, r, w, h, s);
    const zehn = engste(10, r, w, h, s);
    expect(acht, `acht Eintraege haben ${acht.toFixed(1)} px Luft`).toBeGreaterThanOrEqual(MIN_LUFT);
    expect(
      neun,
      `der freie neunte Platz haette nur ${neun.toFixed(1)} px — er ist NICHT mehr frei`
    ).toBeGreaterThanOrEqual(MIN_LUFT);
    expect(zehn, `zehn Eintraege haetten ${zehn.toFixed(1)} px Luft`).toBeLessThan(MIN_LUFT);
  });

  it("R = 112 waere fuer acht Eintraege nicht noetig — die Zahl, die das belegt", () => {
    /*
     * Zur Frage „kann RADIAL_R wieder kleiner werden?" (Auftrag 16.09.2026).
     * Rechnerisch ja: Mit acht Eintraegen reicht R = 101, um die 6-px-Schranke
     * in allen drei Fassungen zu halten. Gemacht wird es nicht — der
     * Halbmesser ist reine Ansicht (gewaehlt wird ueber die RICHTUNG des
     * Daumenzugs), und 112 haelt den neunten Platz offen. Der Test haelt die
     * Herleitung fest, damit die Zahl 101 nicht beim naechsten Mal wieder
     * geschaetzt werden muss.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    let kleinstes = 0;
    for (let rr = 60; rr <= r; rr++) {
      const eng = Math.min(
        ...FASSUNGEN.map((f) => {
          const m = sektorMass(f);
          return engste(8, rr, m.w, m.h, skala(f));
        })
      );
      if (eng >= MIN_LUFT) {
        kleinstes = rr;
        break;
      }
    }
    expect(kleinstes, "kein Halbmesser unter 112 haelt acht Eintraege auseinander").toBeGreaterThan(0);
    expect(kleinstes, `rechnerisches Minimum liegt bei R = ${kleinstes}`).toBe(101);
    expect(r, "RADIAL_R steht nicht mehr auf 112 — dann gehoert E-093 fortgeschrieben").toBe(112);
    // Und der gewaehlte Halbmesser hat mehr Luft als das Minimum, nicht weniger
    expect(engste(8, r, w, h, s)).toBeGreaterThan(MIN_LUFT);
  });

  it("GEGENPROBE: die Masse von gestern wuerden gemeldet", () => {
    /*
     * R = 104, Kasten 76 x 30 als INHALT (also 80 x 34 sichtbar), scharf
     * x1,15 — der Stand bis zum 16.09.2026. Schon mit ACHT Eintraegen faellt
     * er durch: -6,1 px, die Kaesten ueberlappten sich. Genau darum ist der
     * Rueckweg auf acht Eintraege KEIN Rueckweg auf die alte Geometrie.
     * Ohne diese Gegenprobe koennte die Rechnung oben stillschweigend immer
     * gruen sein.
     */
    expect(engste(8, 104, 80, 34, 1.15), "die alten Masse fallen nicht auf").toBeLessThan(0);
    expect(engste(9, 104, 80, 34, 1.15)).toBeLessThan(0);
  });

  it("GEGENPROBE: ein zu kleiner Halbmesser wird gemeldet", () => {
    /*
     * Zur Zahl 101 oben. Bei R = 100 bleiben acht Eintraegen auf dem iPad nur
     * 5,6 px — unter der Schranke. Faellt das hier NICHT auf, misst die Suche
     * nach dem kleinsten Halbmesser nichts.
     */
    const ipad = FASSUNGEN[0];
    const { w, h } = sektorMass(ipad);
    const s = skala(ipad);
    expect(engste(8, 100, w, h, s), "R = 100 faellt nicht auf").toBeLessThan(MIN_LUFT);
    expect(engste(8, 101, w, h, s), "R = 101 sollte gerade reichen").toBeGreaterThanOrEqual(MIN_LUFT);
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
