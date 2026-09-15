/**
 * DIE FEDERUNG DER LKW (E-044).
 *
 * Ansage Patrick, 15.09.2026: „Ich hätte gerne, dass LKWs federn, wenn ich
 * ablade. Also sollen nicht hundertprozentig starr sein, die Ladeflächen."
 * Und als Notiz am 14.09.: „federnde LKW beim Abladen, je nach
 * Kraftübertragung durch Bagger/Körper."
 *
 * Bewacht wird genau das, und in dieser Reihenfolge:
 *
 *   0. Es kommen ZAHLEN heraus. Am 15.09. waren drei Wächter grün, obwohl
 *      sie nichts geprüft haben — zwei, weil ihre Eingaben `NaN` waren, und
 *      jeder Vergleich mit NaN ist falsch. Deshalb steht diese Prüfung vorn.
 *   1. Ohne Anlass steht die Feder STILL. Ein Wagen, der leer wippt, wäre
 *      kein Detail, sondern ein Fehler.
 *   2. Die Amplitude hängt an der Masse.
 *   3. Sie hängt am Ort: am Heck mehr als über der Achse.
 *   4. Beladen federt weicher (längere Schwingung) als leer.
 *   5. Sie ist gedämpft und kommt zur Ruhe.
 *   6. Anfahren setzt das Heck, Bremsen taucht die Nase.
 */
import { describe, it, expect } from "vitest";
import { Federung, federungsDatenFuer } from "../src/delivery/federung";
import { bedLenFor } from "../src/delivery/routes";

const DT = 1 / 60;

/** Der Kipper — das schwerste Fahrzeug, das vorfährt. */
function kipper(): Federung {
  return new Federung(federungsDatenFuer("kipper", bedLenFor("kipper")));
}

/** Längslage des Ladeflächen-HECKS in Fahrzeugkoordinaten. */
const HECK_Z = -bedLenFor("kipper") / 2;

/** n Sekunden rechnen und dabei die Einfederung an einer Stelle mitschreiben. */
function verlauf(f: Federung, z: number, sekunden: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.round(sekunden / DT); i++) {
    out.push(f.einfederung(z));
    f.schritt(DT);
  }
  return out;
}

describe("Federung: es kommen Zahlen heraus", () => {
  it("jede Ausgabe ist endlich — auch nach unsinnigen Eingaben", () => {
    const f = kipper();
    expect(Number.isFinite(f.k)).toBe(true);
    expect(Number.isFinite(f.c)).toBe(true);
    expect(Number.isFinite(f.ruhe)).toBe(true);
    expect(f.k).toBeGreaterThan(0);
    expect(f.c).toBeGreaterThan(0);
    // Jetzt alles falsch machen, was man falsch machen kann
    f.setzeLast(NaN, NaN);
    f.stoss(NaN, NaN, NaN);
    f.meldeTempo(NaN, NaN);
    f.schritt(NaN);
    f.schritt(-1);
    f.schritt(Infinity);
    f.stoss(Infinity, Infinity, Infinity);
    f.schritt(DT);
    for (const z of [HECK_Z, 0, 4.1]) {
      expect(Number.isFinite(f.einfederung(z)), `Einfederung bei z=${z}`).toBe(true);
    }
    expect(Number.isFinite(f.neigung)).toBe(true);
  });

  it("ein Fahrzeug ohne brauchbare Daten bekommt trotzdem eine brauchbare Feder", () => {
    const f = new Federung(federungsDatenFuer("gibtesnicht", NaN));
    expect(Number.isFinite(f.radstand)).toBe(true);
    expect(Math.abs(f.radstand)).toBeGreaterThan(0.5);
    f.setzeLast(3000, 0);
    f.schritt(DT);
    expect(Number.isFinite(f.einfederung(0))).toBe(true);
  });

  it("die Achslagen sind aus dem Modell abgeschrieben, nicht geraten", () => {
    /*
     * `vehicleModel.ts` baut die Achsen auf bedLen/2 + 1,1 (vorn) sowie 0,1
     * und −bedLen/2 + 0,8 (die beiden hinteren). Läuft eines von beiden weg,
     * federt der Wagen um eine Achse, die gar nicht da ist.
     */
    const l = bedLenFor("kipper");
    const d = federungsDatenFuer("kipper", l);
    expect(d.achseVornZ).toBeCloseTo(l / 2 + 1.1, 10);
    expect(d.achseHintenZ).toBeCloseTo((0.1 + (-l / 2 + 0.8)) / 2, 10);
    // Der Anhänger stützt sich auf Achse und Kupplung
    const a = federungsDatenFuer("pkw", bedLenFor("pkw"));
    expect(a.achseVornZ, "die Kupplung ist der zweite Auflagepunkt").toBe(0);
    expect(a.achseHintenZ).toBeCloseTo(-(bedLenFor("pkw") / 2 + 1.05), 10);
  });
});

describe("Ohne Anlass steht sie still", () => {
  it("ein leerer Wagen wippt nicht — zehn Sekunden lang keine Bewegung", () => {
    const f = kipper();
    const reihe = verlauf(f, HECK_Z, 10);
    const spanne = Math.max(...reihe) - Math.min(...reihe);
    expect(spanne, `${(spanne * 1000).toFixed(3)} mm Bewegung ohne Anlass`).toBeLessThan(1e-6);
    expect(f.ruhig).toBe(true);
  });

  it("und ein beladener Wagen ebenso, solange sich die Ladung nicht ändert", () => {
    const f = kipper();
    f.setzeLast(7000, 0);
    f.setzeRuhe();
    const reihe = verlauf(f, HECK_Z, 10);
    const spanne = Math.max(...reihe) - Math.min(...reihe);
    expect(spanne, `${(spanne * 1000).toFixed(3)} mm Bewegung ohne Anlass`).toBeLessThan(1e-6);
    // Er steht aber TIEFER als der leere — das ist der Unterschied
    expect(f.einfederung(HECK_Z)).toBeGreaterThan(0.01);
  });

  it("gleichmäßige Fahrt rüttelt nicht", () => {
    /*
     * Die Feder reagiert auf BESCHLEUNIGUNG, nicht auf Tempo. Wer mit
     * konstanten 4,8 m/s über den Hof rollt, bekommt nach dem Anfahren nichts
     * mehr zu sehen.
     */
    const f = kipper();
    f.setzeLast(5000, 0);
    f.setzeRuhe();
    for (let i = 0; i < 300; i++) {
      f.meldeTempo(4.8, DT);
      f.schritt(DT);
    }
    const reihe: number[] = [];
    for (let i = 0; i < 120; i++) {
      f.meldeTempo(4.8, DT);
      f.schritt(DT);
      reihe.push(f.einfederung(HECK_Z));
    }
    const spanne = Math.max(...reihe) - Math.min(...reihe);
    expect(spanne, `${(spanne * 1000).toFixed(2)} mm bei gleichmäßiger Fahrt`).toBeLessThan(5e-4);
  });
});

describe("Die Amplitude hängt an der Masse", () => {
  /** Erste Einfederungsspitze am Heck, wenn dort ein Teil aufsetzt. */
  function spitze(kg: number, vAuf = 2.0, grundlast = 0): number {
    const f = kipper();
    f.setzeLast(grundlast, 0);
    f.setzeRuhe();
    const vorher = f.einfederung(HECK_Z);
    f.setzeLast(grundlast + kg, grundlast > 0 ? -1 : HECK_Z + 1);
    f.stoss(kg, vAuf, HECK_Z + 1);
    return Math.max(...verlauf(f, HECK_Z, 3)) - vorher;
  }

  it("eine Karosse gibt deutlich mehr als ein Blech", () => {
    const blech = spitze(120);
    const karosse = spitze(950);
    expect(blech, "das Blech tut gar nichts").toBeGreaterThan(0.001);
    expect(
      karosse / blech,
      `Blech ${(blech * 100).toFixed(1)} cm, Karosse ${(karosse * 100).toFixed(1)} cm`
    ).toBeGreaterThan(4);
  });

  it("wer fallen lässt, sieht mehr als wer absetzt", () => {
    /*
     * „je nach Kraftübertragung durch Bagger/Körper" (Notiz 14.09.2026). Ein
     * sanft abgesetztes Teil bringt nur seine Last ein, ein fallengelassenes
     * zusätzlich seinen Impuls.
     */
    const sanft = spitze(950, 0.1);
    const fallen = spitze(950, 3.0);
    expect(fallen, `sanft ${(sanft * 100).toFixed(1)} cm, fallen gelassen ${(fallen * 100).toFixed(1)} cm`)
      .toBeGreaterThan(sanft * 1.8);
  });

  it("ein voll beladener Wagen federt WEICHER als ein leerer", () => {
    /*
     * Der Dämpfer ist fest, die Masse nicht: Mit Ladung sinkt die
     * Eigenfrequenz, die Schwingung wird länger und weicher. Gemessen an der
     * Zeit bis zur ersten Umkehr nach demselben Stoß.
     */
    const zeitBisUmkehr = (grundlast: number): number => {
      const f = kipper();
      f.setzeLast(grundlast, 0);
      f.setzeRuhe();
      f.stoss(900, 2.0, HECK_Z + 1);
      const r = verlauf(f, HECK_Z, 3);
      let i = 1;
      while (i < r.length && r[i]! >= r[i - 1]!) i++;
      return i * DT;
    };
    const leer = zeitBisUmkehr(0);
    const voll = zeitBisUmkehr(9000);
    expect(voll, `leer ${leer.toFixed(3)} s, voll ${voll.toFixed(3)} s`).toBeGreaterThan(leer * 1.2);
  });
});

describe("Die Amplitude hängt am Ort", () => {
  it("am Heck gibt es mehr nach als über der Achse", () => {
    const f = kipper();
    f.setzeLast(1500, HECK_Z);
    f.setzeRuhe();
    const amHeck = f.einfederung(HECK_Z);
    const amRad = f.einfederung(f.achseHintenZ);
    expect(amHeck, `Heck ${(amHeck * 100).toFixed(1)} cm, Achse ${(amRad * 100).toFixed(1)} cm`)
      .toBeGreaterThan(amRad * 1.2);
  });

  it("Last hinter der Hinterachse hebt die Vorderachse an", () => {
    /*
     * Das ist der Hebel, und er ist der Unterschied zwischen „es federt" und
     * „es ist ein LKW": Was hinter der letzten Achse liegt, drückt hinten
     * herunter UND vorn herauf.
     */
    const f = kipper();
    f.setzeLast(2000, HECK_Z - 0.5);
    f.setzeRuhe();
    expect(f.einfederung(f.achseHintenZ)).toBeGreaterThan(0);
    expect(f.einfederung(f.achseVornZ), "die Nase müsste sich heben").toBeLessThan(0);
  });

  it("Last genau über der Hinterachse lässt die Nase in Ruhe", () => {
    const f = kipper();
    f.setzeLast(2000, f.achseHintenZ);
    f.setzeRuhe();
    expect(Math.abs(f.einfederung(f.achseVornZ))).toBeLessThan(1e-9);
    expect(f.einfederung(f.achseHintenZ)).toBeGreaterThan(0.005);
  });
});

describe("Sie ist gedämpft und kommt zur Ruhe", () => {
  it("nach zwei Sekunden ist die Bewegung praktisch vorbei", () => {
    const f = kipper();
    f.setzeLast(3000, -1);
    f.setzeRuhe();
    f.stoss(1200, 3.0, HECK_Z);
    const r = verlauf(f, HECK_Z, 4);
    const ruhelage = r[r.length - 1]!;
    const anfang = Math.max(...r.slice(0, 30)) - ruhelage;
    const spaet = r.slice(120).map((x) => Math.abs(x - ruhelage));
    expect(anfang, "der Stoß hat gar nichts bewirkt").toBeGreaterThan(0.005);
    expect(
      Math.max(...spaet),
      `nach 2 s noch ${(Math.max(...spaet) * 1000).toFixed(1)} mm Ausschlag`
    ).toBeLessThan(anfang * 0.05);
  });

  it("sie schwingt sich nicht auf — höchstens drei Umkehrpunkte", () => {
    const f = kipper();
    f.setzeLast(8000, 0);
    f.setzeRuhe();
    f.stoss(1500, 3.0, HECK_Z);
    const r = verlauf(f, HECK_Z, 4);
    const ruhelage = r[r.length - 1]!;
    const amplitude = Math.max(...r.map((x) => Math.abs(x - ruhelage)));
    /*
     * Gezählt werden nur SICHTBARE Schwingungen: Ausschläge über 5 % der
     * ersten Amplitude. Ohne diesen Totbereich zählte das Rauschen der
     * letzten Mikrometer mit, und der Wächter maß Rundungsfehler.
     */
    const tot = amplitude * 0.05;
    let wechsel = 0;
    let vorzeichen = 0;
    for (const x of r) {
      const d = x - ruhelage;
      if (Math.abs(d) < tot) continue;
      const s = Math.sign(d);
      if (vorzeichen !== 0 && s !== vorzeichen) wechsel++;
      vorzeichen = s;
    }
    expect(amplitude, "der Stoß hat gar nichts bewirkt").toBeGreaterThan(0.005);
    expect(wechsel, `${wechsel} sichtbare Schwingungen in vier Sekunden`).toBeLessThanOrEqual(3);
  });

  it("der Federweg ist begrenzt — auch wenn eine Halle darauf fällt", () => {
    const f = kipper();
    f.setzeLast(500000, HECK_Z);
    f.stoss(500000, 3.5, HECK_Z);
    for (let i = 0; i < 300; i++) f.schritt(DT);
    for (const z of [HECK_Z, 0, 4.1]) {
      const e = f.einfederung(z);
      expect(Number.isFinite(e), `Einfederung bei z=${z}`).toBe(true);
      // 11 cm je Achse, am Überhang entsprechend mehr — aber nie unbegrenzt
      expect(Math.abs(e), `${(e * 100).toFixed(1)} cm bei z=${z}`).toBeLessThan(0.35);
    }
  });

  it("das Ergebnis hängt nicht an der Bildrate", () => {
    /*
     * Auf dem Telefon kommen längere Bilder vor. Mit 20 statt 60 Bildern je
     * Sekunde muss dieselbe Ruhelage herauskommen — sonst steht der Wagen bei
     * Rucklern woanders.
     */
    const lauf = (dt: number): number => {
      const f = kipper();
      f.setzeLast(6000, -0.5);
      f.stoss(800, 2.0, HECK_Z);
      for (let t = 0; t < 4; t += dt) f.schritt(dt);
      return f.einfederung(HECK_Z);
    };
    const schnell = lauf(1 / 60);
    const langsam = lauf(1 / 20);
    expect(langsam, `1/60: ${(schnell * 100).toFixed(2)} cm · 1/20: ${(langsam * 100).toFixed(2)} cm`)
      .toBeCloseTo(schnell, 3);
  });
});

describe("Anfahren und Bremsen", () => {
  it("beim Anfahren setzt sich das Heck und die Nase geht hoch", () => {
    const f = kipper();
    f.setzeLast(5000, 0);
    f.setzeRuhe();
    const heck0 = f.einfederung(HECK_Z);
    const nase0 = f.einfederung(f.achseVornZ);
    let heckMax = heck0;
    let naseMin = nase0;
    for (let i = 0; i < 60; i++) {
      f.meldeTempo(4.8, DT);
      f.schritt(DT);
      heckMax = Math.max(heckMax, f.einfederung(HECK_Z));
      naseMin = Math.min(naseMin, f.einfederung(f.achseVornZ));
    }
    expect(heckMax - heck0, `Heck setzt ${((heckMax - heck0) * 100).toFixed(1)} cm`).toBeGreaterThan(
      0.005
    );
    expect(nase0 - naseMin, `Nase hebt ${((nase0 - naseMin) * 100).toFixed(1)} cm`).toBeGreaterThan(
      0.005
    );
  });

  it("beim Bremsen taucht die Nase", () => {
    const f = kipper();
    f.setzeLast(5000, 0);
    f.setzeRuhe();
    for (let i = 0; i < 120; i++) {
      f.meldeTempo(4.8, DT);
      f.schritt(DT);
    }
    const nase0 = f.einfederung(f.achseVornZ);
    let naseMax = nase0;
    for (let i = 0; i < 60; i++) {
      f.meldeTempo(0, DT);
      f.schritt(DT);
      naseMax = Math.max(naseMax, f.einfederung(f.achseVornZ));
    }
    expect(naseMax - nase0, `Nase taucht ${((naseMax - nase0) * 100).toFixed(1)} cm`).toBeGreaterThan(
      0.005
    );
  });

  it("ein Sprung auf der Route wirft die Feder nicht an den Anschlag", () => {
    /*
     * Beim Routenwechsel springt der Wagen gelegentlich ein Stück. Die
     * Zustandsmaschine deckelt das Tempo, bevor es hier ankommt — geprüft
     * wird, dass selbst ein ungedeckelter Ausreißer nichts Absurdes anrichtet.
     */
    const f = kipper();
    f.setzeLast(6000, 0);
    f.setzeRuhe();
    f.meldeTempo(400, DT);
    for (let i = 0; i < 180; i++) {
      f.meldeTempo(0, DT);
      f.schritt(DT);
      expect(Math.abs(f.einfederung(HECK_Z))).toBeLessThan(0.35);
    }
  });
});
