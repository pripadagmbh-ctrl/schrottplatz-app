/**
 * Was kann welcher Traversendurchmesser? — die Abtastung hinter dem Blatt
 * `docs/f5-traverse-2026-09-15.svg`.
 *
 * Offen seit E-009: Die Mitteltraverse traegt oben die fuenf
 * Zylinderaufnahmen. Ihr Radius IST `ZYLINDER_AUFNAHME.r`, und an dem haengen
 * die beiden Kennwerte, die die Form heute verfehlt:
 *
 *   Zylinderneigung  38,90° gegen Ziel < 20°
 *   Hebelarm         0,0924 m gegen Ziel > 0,10 m
 *
 * `anlenkung.ts` hat am 14.09.2026 die Frage „gibt es ueberhaupt eine Loesung?"
 * beantwortet: 4.567 Anlenkungen halten beide Ziele und den Vertrag, die
 * kleinste bei Aufnahmeradius 0,540 m — Traverse Ø 1,10 m. Was dort NICHT steht,
 * ist die Zwischenfrage, an der Patrick entscheidet:
 *
 *   Was bekommt man fuer Ø 0,80, Ø 0,90, Ø 1,00? Und was kostet es an Korb?
 *
 * Dieses Werkzeug rastert deshalb je Durchmesser getrennt ab und meldet drei
 * Dinge:
 *
 *   1. den kleinsten Neigungswinkel, der bei dieser Traverse mit einem
 *      Hebelarm ueber 0,10 m zu haben ist — und wenn keiner, den kleinsten
 *      ueberhaupt und den Hebelarm dazu;
 *   2. den groessten Hebelarm, der bei dieser Traverse zu haben ist;
 *   3. ob die Loesung das Zylinderauge auf dem Gussteil laesst (Ay = 0,
 *      Az <= 0,31) oder eine angeschweisste Konsole braucht.
 *
 * Die Rechnung ist Zeile fuer Zeile dieselbe wie in `rig.ts`
 * (`anbindungspunkt`, `zylinderLaenge`, `zylinderNeigung`, `hebelarm`) und
 * wird gegen sie geprueft — siehe `test/traverse.test.ts`.
 *
 * Diese Datei rechnet nur. Die Tabellen dazu druckt `traverse.ts`.
 */
import {
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  ZYLINDER_AUFNAHME,
} from "../../src/fuenfschalen/teile";

/** Rohrlaenge des Zylinders: MASS.zylinder.laenge * 0,6 — wie in `anlenkung.ts`. */
const ROHR = 0.42;

/**
 * Traversendurchmesser aus dem Aufnahmeradius.
 *
 * Die Gabel sitzt auf dem RAND des Grundkoerpers — so steht es in `MASS.traverse`
 * („mit Ø 0,75 stand der Rand des Koerpers auf r 0,375, also AUSSERHALB der
 * Zylinderaufnahme auf r 0,34"). Ø 0,70 und r 0,34 gehoeren also zusammen, und
 * die 0,02 m sind der Rand, der dabei ueberbleibt.
 */
export function traverseAus(Zr: number): number {
  return 2 * Zr + 0.02;
}

/** Und zurueck. */
export function aufnahmeFuer(durchmesser: number): number {
  return (durchmesser - 0.02) / 2;
}

export interface Anlenkung {
  /** Zylinderaufnahme an der Traverse: Radius (m). */
  Zr: number;
  /** Zylinderaufnahme an der Traverse: Hoehe im Greiferframe (m). */
  Zy: number;
  /** Schalenauge gegen den Bolzen, laengs der Schale (m). */
  Ay: number;
  /** Schalenauge gegen den Bolzen, quer dazu (m). */
  Az: number;
}

export interface Kennwert {
  neigungZu: number;
  neigungOffen: number;
  neigungMax: number;
  hebelZu: number;
  hebelOffen: number;
  hebelMin: number;
  laengeZu: number;
  laengeOffen: number;
  laengeMin: number;
  laengeMax: number;
  hub: number;
}

/**
 * Kennwerte einer Anlenkung ueber den ganzen Oeffnungsweg.
 *
 * Wortgleich mit `anbindungspunkt` in `rig.ts`, nur ohne Formsatz: Bolzen und
 * Schalenversatz bleiben, wo sie sind — dieses Blatt aendert allein die Traverse.
 */
export function kennwerte(a: Anlenkung): Kennwert {
  let neigungMax = 0;
  let hebelMin = Infinity;
  let laengeMin = Infinity;
  let laengeMax = 0;
  let neigungZu = 0;
  let neigungOffen = 0;
  let hebelZu = 0;
  let hebelOffen = 0;
  let laengeZu = 0;
  let laengeOffen = 0;
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / N;
    const cs = Math.cos(s);
    const sn = Math.sin(s);
    /* cos(−s)/sin(−s) wie in `anbindungspunkt`; OBERE_ANBINDUNG.y ist hier Ay. */
    const r = STEMPEL_AUGE.r + (a.Ay * -sn + a.Az * cs);
    const y = STEMPEL_AUGE.y + (a.Ay * cs - a.Az * -sn);
    const dr = r - a.Zr;
    const dy = y - a.Zy;
    const l = Math.hypot(dr, dy);
    const neigung = (Math.atan2(Math.abs(dr), Math.abs(dy)) * 180) / Math.PI;
    const hebel = Math.abs(
      ((STEMPEL_AUGE.r - a.Zr) * dy - (STEMPEL_AUGE.y - a.Zy) * dr) / Math.max(l, 1e-6)
    );
    laengeMin = Math.min(laengeMin, l);
    laengeMax = Math.max(laengeMax, l);
    neigungMax = Math.max(neigungMax, neigung);
    hebelMin = Math.min(hebelMin, hebel);
    if (i === 0) {
      neigungZu = neigung;
      hebelZu = hebel;
      laengeZu = l;
    }
    if (i === N) {
      neigungOffen = neigung;
      hebelOffen = hebel;
      laengeOffen = l;
    }
  }
  return {
    neigungZu,
    neigungOffen,
    neigungMax,
    hebelZu,
    hebelOffen,
    hebelMin,
    laengeZu,
    laengeOffen,
    laengeMin,
    laengeMax,
    hub: laengeZu - laengeOffen,
  };
}

/** Der Vertrag aus `anlenkung.ts`, unveraendert uebernommen. */
export function haeltVertrag(k: Kennwert): boolean {
  return k.hub >= 0.15 && k.laengeMin >= ROHR + 0.02 && k.laengeMax <= 1.05 && k.hebelZu > 0.2;
}

/**
 * Der Stand BIS E-039 — Variante A, Ø 0,70.
 *
 * Hieß bis zum 15.09.2026 `HEUTE` und las `Ay`/`Az` aus `teile.ts`. Beides ist
 * mit dem Umbau falsch geworden: Gebaut ist seitdem B, und ein `HEUTE`, das
 * gestern meint, ist genau die Art Name, an der man sich verrechnet. Die vier
 * Zahlen stehen jetzt ausgeschrieben da, weil dieses Blatt sie als FESTEN
 * Vergleichspunkt braucht — die Tabellen in `traverse.ts` zeigen, was ein
 * Durchmesser gegenueber diesem Stand bringt.
 */
export const VOR_E039: Anlenkung = { Zr: 0.34, Zy: -0.73, Ay: 0, Az: 0.31 };

/**
 * Der GEBAUTE Stand — abgelesen aus `teile.ts`, nicht abgeschrieben.
 *
 * Beim Laden des Moduls gelesen, also bevor `traverse-messen.ts` irgendetwas
 * umsetzen kann. Daran haengt der Waechter, der die Rechnung dieses Blattes
 * gegen `rig.ts` haelt: Beide muessen dieselbe Anlenkung meinen, sonst prueft
 * er nichts.
 */
export const GEBAUT: Anlenkung = {
  Zr: ZYLINDER_AUFNAHME.r,
  Zy: ZYLINDER_AUFNAHME.y,
  Ay: OBERE_ANBINDUNG.y,
  Az: OBERE_ANBINDUNG.z,
};

/* --------------------------------------------------- Suche je Durchmesser */

export interface Loesung {
  a: Anlenkung;
  k: Kennwert;
}

/** Alle Anlenkungen zu einem Aufnahmeradius, die den Vertrag halten. */
export function alleZu(Zr: number, ZyFest: number | null = null): Loesung[] {
  const raus: Loesung[] = [];
  const ZyVon = ZyFest ?? -0.95;
  const ZyBis = ZyFest ?? -0.55;
  for (let Zy = ZyVon; Zy <= ZyBis + 1e-9; Zy += 0.005)
    for (let Ay = -0.16; Ay <= 0.16001; Ay += 0.02)
      for (let Az = 0.2; Az <= 0.5001; Az += 0.005) {
        const a: Anlenkung = {
          Zr,
          Zy: Math.round(Zy * 1000) / 1000,
          Ay: Math.round(Ay * 1000) / 1000,
          Az: Math.round(Az * 1000) / 1000,
        };
        const k = kennwerte(a);
        if (haeltVertrag(k)) raus.push({ a, k });
      }
  return raus;
}

/**
 * Der Arbeitspunkt eines Durchmessers — nach EINER Regel, fuer alle gleich.
 *
 * Regel: flachster Zylinder unter allen, die einen Hebelarm ueber `hebelZiel`
 * halten; unter den gleich flachen (±0,1°, also gleich gedruckt) der staerkste Hebel.
 *
 * Die zweite Stufe muss eine EIGENE Runde sein. Im ersten Anlauf stand beides
 * in einer Schleife („besser, wenn flacher ODER fast gleich flach und
 * staerker") — damit wandert der Bestwert Schritt fuer Schritt um je 0,5° nach
 * oben und landet bei Ø 1,20 auf 27,3° statt auf 15,8°. Ein Vergleich, der von
 * der Reihenfolge der Schleife abhaengt, ist kein Vergleich.
 */
export function arbeitspunkt(
  Zr: number,
  hebelZiel = 0.1,
  ZyFest: number | null = null
): Loesung | null {
  const tragfaehig = alleZu(Zr, ZyFest).filter((l) => l.k.hebelMin > hebelZiel);
  if (tragfaehig.length === 0) return null;
  const flachste = Math.min(...tragfaehig.map((l) => l.k.neigungMax));
  const eng = tragfaehig.filter((l) => l.k.neigungMax <= flachste + 0.1);
  return eng.reduce((a, b) => (b.k.hebelMin > a.k.hebelMin ? b : a));
}

/** Groesster Hebelarm, den ein Durchmesser ueberhaupt hergibt. */
export function staerkste(Zr: number, ZyFest: number | null = null): Loesung {
  const alle = alleZu(Zr, ZyFest);
  return alle.reduce((a, b) => (b.k.hebelMin > a.k.hebelMin ? b : a));
}

