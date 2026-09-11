import { describe, expect, it } from "vitest";
import {
  DREHZAHL_STUETZEN,
  ZYKLEN_JE_SCHLEIFE,
  UMSCHLAGBAGGER,
  dieselSchleife,
  drehzahlFuer,
  mischung,
  zuendrate,
  zyklusDauer,
} from "../src/audio/diesel";

const RATE = 44100;
const form = (drehzahl: number) => ({ ...UMSCHLAGBAGGER, drehzahl });

/**
 * Wie viele Schlaege liegen in einer Schleife?
 *
 * Nicht ueber Schwellen gezaehlt: Bei hoher Drehzahl klingt eine Zuendung
 * noch, waehrend die naechste schon kommt, und jede Schwelle zaehlt dann
 * falsch. Stattdessen wird gefragt, mit welcher Periode sich die Huellkurve
 * wiederholt — das ist genau die Groesse, die das Ohr als Takt hoert.
 */
function schlaege(buf: Float32Array, rate: number): number {
  const fenster = Math.round(rate * 0.003);
  const huelle = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    let m = 0;
    for (let k = 0; k < fenster; k++) m = Math.max(m, Math.abs(buf[(i + k) % buf.length]));
    huelle[i] = m;
  }
  let mittel = 0;
  for (const x of huelle) mittel += x;
  mittel /= huelle.length;
  let besteK = 1;
  let bestes = -1;
  // Bin k der Fourierzerlegung heisst: k Schlaege je Zyklus.
  for (let k = 1; k <= 16; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < huelle.length; i++) {
      const w = (2 * Math.PI * k * i) / huelle.length;
      re += (huelle[i] - mittel) * Math.cos(w);
      im += (huelle[i] - mittel) * Math.sin(w);
    }
    const betrag = Math.hypot(re, im);
    if (betrag > bestes) {
      bestes = betrag;
      besteK = k;
    }
  }
  return besteK;
}

describe("Diesel", () => {
  it("zündet so oft wie ein Sechszylinder-Viertakter", () => {
    // 900/min, sechs Zylinder, Viertakt: 45 Zündungen je Sekunde
    expect(zuendrate({ zylinder: 6, takt: 4, drehzahl: 900 })).toBeCloseTo(45, 5);
    // Ein Arbeitszyklus sind zwei Umdrehungen
    expect(zyklusDauer({ takt: 4, drehzahl: 900 })).toBeCloseTo(2 / 15, 5);
  });

  it("legt genau einen Schlag je Zylinder in die Schleife", () => {
    for (const drehzahl of DREHZAHL_STUETZEN) {
      const buf = dieselSchleife(RATE, form(drehzahl), "klopfen", 1);
      expect(schlaege(buf, RATE)).toBe(UMSCHLAGBAGGER.zylinder);
    }
  });

  it("ist eine Schleife über einen vollen Arbeitszyklus", () => {
    const drehzahl = 1150;
    const buf = dieselSchleife(RATE, form(drehzahl), "block", 1);
    expect(buf.length).toBe(Math.round(RATE * zyklusDauer({ takt: 4, drehzahl })));
    // Im Betrieb stehen mehrere Zyklen in einer Schleife, damit sich nicht
    // alles alle 167 ms exakt wiederholt.
    const lang = dieselSchleife(RATE, form(drehzahl), "block");
    expect(lang.length).toBe(
      Math.round(RATE * zyklusDauer({ takt: 4, drehzahl }) * ZYKLEN_JE_SCHLEIFE)
    );
  });

  it("läuft nahtlos: der Nachklang wird vorne wieder aufaddiert", () => {
    const buf = dieselSchleife(RATE, form(700), "block");
    // Ohne Umlauf waere der Anfang der Schleife still (die erste Zuendung
    // faengt erst bei Null an) und das Ende voller Nachklang — beim Springen
    // knackt es. Mit Umlauf ist beides gleich belebt.
    const kopf = buf.slice(0, 200).reduce((a, x) => a + Math.abs(x), 0);
    const schwanz = buf.slice(-200).reduce((a, x) => a + Math.abs(x), 0);
    expect(kopf).toBeGreaterThan(schwanz * 0.2);
    expect(kopf).toBeLessThan(schwanz * 5);
  });

  it("läuft unrund — kein Zylinder wie der andere", () => {
    const buf = dieselSchleife(RATE, form(900), "block");
    const n = UMSCHLAGBAGGER.zylinder;
    const teil = Math.floor(buf.length / n);
    const staerken: number[] = [];
    for (let z = 0; z < n; z++) {
      let m = 0;
      for (let i = z * teil; i < (z + 1) * teil; i++) m = Math.max(m, Math.abs(buf[i]));
      staerken.push(m);
    }
    const mittel = staerken.reduce((a, b) => a + b, 0) / n;
    const streuung = Math.sqrt(
      staerken.reduce((a, x) => a + (x - mittel) ** 2, 0) / n
    ) / mittel;
    // Ein Oszillator haette hier exakt null. Ein Motor bollert.
    expect(streuung).toBeGreaterThan(0.03);
    expect(streuung).toBeLessThan(0.6);
  });

  it("ist ausgesteuert, aber nicht übersteuert", () => {
    for (const anteil of ["block", "klopfen"] as const) {
      const buf = dieselSchleife(RATE, form(1150), anteil);
      let spitze = 0;
      for (const x of buf) spitze = Math.max(spitze, Math.abs(x));
      expect(spitze).toBeCloseTo(1, 3);
    }
  });

  it("hat keinen Gleichanteil", () => {
    // Ein einseitiger Pulszug ist keine Maschine, sondern eine Hupe: Er hat
    // einen Gleichanteil, kostet Aussteuerung und klingt danach (gemessen
    // 11.09.2026: 0,125 bei 0,318 Effektivwert).
    for (const anteil of ["block", "klopfen"] as const) {
      const buf = dieselSchleife(RATE, form(720), anteil);
      let mittel = 0;
      let quadrat = 0;
      for (const x of buf) {
        mittel += x;
        quadrat += x * x;
      }
      mittel /= buf.length;
      const rms = Math.sqrt(quadrat / buf.length);
      expect(Math.abs(mittel)).toBeLessThan(rms * 0.02);
    }
  });

  it("wiederholt sich nicht in jedem Zyklus gleich", () => {
    const buf = dieselSchleife(RATE, form(900), "block");
    const zyklus = Math.floor(buf.length / ZYKLEN_JE_SCHLEIFE);
    const staerken: number[] = [];
    for (let c = 0; c < ZYKLEN_JE_SCHLEIFE; c++) {
      let m = 0;
      for (let i = c * zyklus; i < (c + 1) * zyklus; i++) m = Math.max(m, Math.abs(buf[i]));
      staerken.push(m);
    }
    const mittel = staerken.reduce((a, b) => a + b, 0) / staerken.length;
    const streuung =
      Math.sqrt(staerken.reduce((a, x) => a + (x - mittel) ** 2, 0) / staerken.length) / mittel;
    expect(streuung).toBeGreaterThan(0.005);
  });

  it("blendet zwischen den Stützstellen über, ohne lauter zu werden", () => {
    for (const drehzahl of [500, 700, 900, 1150, 1400, 1700, 2200]) {
      const a = mischung(drehzahl);
      expect(a.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 6);
      expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
    }
    expect(mischung(700)[0]).toBe(1);
    expect(mischung(1150)[1]).toBe(1);
    // In der Mitte zwischen zwei Stuetzstellen liegen beide gleichauf
    const mitte = mischung((700 + 1150) / 2);
    expect(mitte[0]).toBeCloseTo(0.5, 6);
    expect(mitte[1]).toBeCloseTo(0.5, 6);
  });

  it("dreht im Stand niedrig und unter Last hoch", () => {
    expect(drehzahlFuer(0, 0)).toBeLessThan(800);
    expect(drehzahlFuer(1, 1)).toBeGreaterThan(1600);
    expect(drehzahlFuer(1, 1)).toBeLessThan(2000);
    // Last allein gibt kein Vollgas, Bedienen schon eher
    expect(drehzahlFuer(1, 0)).toBeGreaterThan(drehzahlFuer(0, 1));
  });

  it("klingt bei jeder Drehzahl gleich, nur schneller", () => {
    // Dieselbe Maschine: Die Form der Zuendung haengt nicht von der Drehzahl
    // ab, nur ihr Abstand. Sonst waere es ein anderer Motor je Gasstellung.
    const langsam = dieselSchleife(RATE, form(700), "block", 1);
    const schnell = dieselSchleife(RATE, form(1700), "block", 1);
    expect(langsam.length).toBeGreaterThan(schnell.length);
    expect(schlaege(langsam, RATE)).toBe(schlaege(schnell, RATE));
  });
});
