/**
 * Der Anlenkungsraum — wo es überhaupt Lösungen gibt. GERECHNET, NICHT GEBAUT.
 *
 * Anlass, wörtlich (Patrick, 15.09.2026, vor `docs/f5-anlenkung-2026-09-15.svg`):
 *
 *   „Also ich glaube, das liegt halt ein bisschen an deinem oberen Aufbau. Das
 *    Problem, das ursprüngliche Problem ist ja, dass der Stempel breiter sein
 *    muss oder die Traverse, was auch immer, als der obere Teil, wo die
 *    Zylinder da sind. Da muss er die Spinne halt ein bisschen anders bauen,
 *    damit wir das gelöst bekommen. Aber es kann nicht sein, dass wir da keine
 *    Lösung finden."
 *
 * ER HAT RECHT, UND UNSER BISHERIGER ANSATZ WAR ZU ENG. E-072 und E-074 haben
 * immer nur EINE Größe verschoben — die Höhe — und alles andere festgehalten.
 * Dann bleibt zwangsläufig „nicht baubar". Hier sind VIER Größen frei:
 *
 *   rOben   Radius der Zylinderaufnahme am Kopf        (heute 0,465 m)
 *   rUnten  Radius des Schalenbolzenkreises            (heute 0,590 m)
 *   Ay, Az  Lage des oberen Schalenauges gegen den Bolzen, längs und quer
 *                                                      (heute −0,08 / 0,245)
 *
 * und gesucht wird die kleinste SÄULE, die alle Schranken hält. Die Säule ist
 * `d − 0,23`: Zwischen Zylinderaufnahme und Traversenmitte liegen fest 0,23 m
 * (E-039), darunter beginnt der Abstand zum Bolzen. Säule 0 heißt d = 0,23.
 *
 * `Ay`/`Az` sind mit dabei, weil E-039 sie selbst als Stellschraube benutzt hat
 * (von 0/0,31 auf −0,08/0,245). Ohne sie ist die Karte fast leer, und das wäre
 * keine Antwort, sondern die Wiederholung der alten Annahme.
 *
 * DER BEFUND, DER DIE KARTE ERKLÄRT: Die Anlenkung sieht von den beiden Radien
 * nur ihre DIFFERENZ `rUnten − rOben`. In `zylinderLaenge`, `zylinderNeigung`
 * und `hebelarm` stehen ausschließlich Differenzen — dieselbe Lehre wie in
 * E-074, eine Ebene höher. Die Karte über (rOben, rUnten) ist deshalb entlang
 * ihrer Diagonalen konstant, und die zweite Richtung entscheidet nicht die
 * Hydraulik, sondern die Kopfbreite: was der Kopf von oben zubaut.
 *
 * `src/` ist unberührt. Die Rechnung prüft sich bei jedem Lauf gegen `rig.ts`.
 */
import {
  DREHPUNKT,
  MASS,
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  ZU,
  ZYLINDER_AUFNAHME,
  schwenkFuer,
} from "../../src/fuenfschalen/teile";
import { hebelarm, zylinderLaenge, zylinderNeigung } from "../../src/fuenfschalen/rig";

export const GRAD = 180 / Math.PI;

/** Länge des Zylinderrohrs (m) — dieselbe Ableitung wie in `rig.stelleSchale`. */
export const ROHR = MASS.zylinder.laenge * 0.6;
/** Äquator der geschlossenen Kugel: `drehpunktR + versatz` (rig.Formsatz). */
export const AEQUATOR = STEMPEL_AUGE.r + DREHPUNKT.versatz;
/** Fester Abstand Zylinderaufnahme ↔ Traversenmitte (m), seit E-039. */
export const AUFNAHME_UEBER_TRAVERSE = ZYLINDER_AUFNAHME.y - -0.865;
/** Heutiger senkrechter Abstand Aufnahme ↔ Bolzen (m). */
export const D_HEUTE = ZYLINDER_AUFNAHME.y - STEMPEL_AUGE.y;
/** Heutige Säulenhöhe (m). */
export const SAEULE_HEUTE = -0.865 - STEMPEL_AUGE.y;
/** Heutiger Abstand der beiden Radien (m) — positiv heißt: Bolzen weiter außen. */
export const DR_HEUTE = STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r;

/* ------------------------------------------------------------- Die Rechnung */

export interface Anlenkung {
  /** Abstand der beiden Radien: `rUnten − rOben` (m). */
  dr0: number;
  /** Senkrechter Abstand Aufnahme ↔ Bolzen (m). */
  d: number;
  /** Schalenauge gegen den Bolzen, längs der Schale (m). */
  Ay: number;
  /** Schalenauge gegen den Bolzen, quer dazu (m). */
  Az: number;
}

export interface Kennwert {
  neigungMax: number;
  hebelMin: number;
  hebelZu: number;
  laengeZu: number;
  laengeOffen: number;
  laengeMin: number;
  laengeMax: number;
  hub: number;
  /** Wie weit die Stange im ungünstigsten Fall aus dem Rohr schaut (m). */
  ueberstand: number;
}

/**
 * Kennwerte der Anlenkung über den ganzen Schließweg.
 *
 * Wortgleich mit `anbindungspunkt`/`zylinderNeigung`/`hebelarm` in `rig.ts`,
 * nur dass dort vier Zahlen Konstanten sind. Die Kopie ist zulässig, WEIL sie
 * sich gegen das Original prüfen lässt — `probe()` tut das bei jedem Lauf und
 * bricht ab, wenn sie abweicht.
 */
export function kennwert(a: Anlenkung, stufen = 40): Kennwert {
  let neigungMax = 0;
  let hebelMin = Infinity;
  let laengeMin = Infinity;
  let laengeMax = 0;
  let hebelZu = 0;
  let laengeZu = 0;
  let laengeOffen = 0;
  for (let i = 0; i <= stufen; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / stufen;
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    /* Alles relativ: Aufnahme im Ursprung, Bolzen bei (dr0, −d). */
    const dr = a.dr0 + (a.Ay * sn + a.Az * c);
    const dy = -a.d + (a.Ay * c - a.Az * sn);
    const l = Math.hypot(dr, dy);
    const neigung = Math.atan2(Math.abs(dr), Math.abs(dy)) * GRAD;
    const hebel = Math.abs((a.dr0 * dy + a.d * dr) / Math.max(l, 1e-9));
    if (neigung > neigungMax) neigungMax = neigung;
    if (hebel < hebelMin) hebelMin = hebel;
    if (l < laengeMin) laengeMin = l;
    if (l > laengeMax) laengeMax = l;
    if (i === 0) {
      hebelZu = hebel;
      laengeZu = l;
    }
    if (i === stufen) laengeOffen = l;
  }
  return {
    neigungMax,
    hebelMin,
    hebelZu,
    laengeZu,
    laengeOffen,
    laengeMin,
    laengeMax,
    hub: laengeZu - laengeOffen,
    ueberstand: laengeMin - ROHR,
  };
}

/** Die heutige Anlenkung, aus `teile.ts` gelesen statt abgeschrieben. */
export const HEUTE: Anlenkung = {
  dr0: DR_HEUTE,
  d: D_HEUTE,
  Ay: OBERE_ANBINDUNG.y,
  Az: OBERE_ANBINDUNG.z,
};

/**
 * Die Gegenprobe: bei den heutigen Maßen muss die Kopie das Original treffen.
 *
 * Und sie darf nicht blind sein — deshalb wird auch gemessen, was ein um 1 cm
 * verschobener Radiusabstand ausmacht. Wäre das null, prüfte der Vergleich
 * oben nichts.
 */
export function probe(): { fehler: number; gegenprobe: number } {
  let fehler = 0;
  for (let i = 0; i <= 60; i++) {
    const s = schwenkFuer(i / 60);
    const c = Math.cos(-s);
    const sn = Math.sin(-s);
    const dr = HEUTE.dr0 + (HEUTE.Ay * sn + HEUTE.Az * c);
    const dy = -HEUTE.d + (HEUTE.Ay * c - HEUTE.Az * sn);
    const l = Math.hypot(dr, dy);
    fehler = Math.max(fehler, Math.abs(l - zylinderLaenge(s)));
    fehler = Math.max(fehler, Math.abs(Math.atan2(Math.abs(dr), Math.abs(dy)) - zylinderNeigung(s)));
    fehler = Math.max(fehler, Math.abs(Math.abs((HEUTE.dr0 * dy + HEUTE.d * dr) / l) - hebelarm(s)));
  }
  const a = kennwert(HEUTE);
  const b = kennwert({ ...HEUTE, dr0: HEUTE.dr0 + 0.01 });
  return { fehler, gegenprobe: Math.abs(a.hebelMin - b.hebelMin) };
}

/* ------------------------------------------------------------ Die Schranken */

/**
 * Die Bedingungen — alle aus dem Bestand, KEINE nachgezogen.
 *
 *   neigungMax  < 25°      `test/fuenfschalen.test.ts`, E-039
 *   hebelMin    > 0,115 m  dieselbe Stelle
 *   hebelZu     > 0,2 m    dieselbe Stelle („kein Totpunkt beim Schließen")
 *   laengeMin   ≥ Rohr+…   `haeltVertrag`; dort +0,02, hier zusätzlich +0,05
 *                          als „echter Überstand" — beides wird ausgewiesen
 *   hub         ≥ 0,15 m   `haeltVertrag`
 *   laengeMax   ≤ 1,05 m   `haeltVertrag`
 */
export const SCHRANKE = {
  neigung: 25,
  hebel: 0.115,
  hebelZu: 0.2,
  ueberstandKnapp: 0.02,
  ueberstandEcht: 0.05,
  hub: 0.15,
  laengeMax: 1.05,
} as const;

export type Grund = "" | "Neigung" | "Hebelarm" | "Hebel zu" | "Stange" | "Hub" | "zu lang";

/**
 * Wie viel Luft eine Lösung zu jeder Schranke hat, in Anteilen der Schranke.
 *
 * Negativ heißt gerissen. Der KLEINSTE Wert entscheidet — und sein Name ist die
 * Antwort auf „woran scheitert es hier". Ohne diese Normierung ließe sich ein
 * Winkel in Grad nicht gegen einen Hebelarm in Millimetern abwägen, und die
 * Karte müsste sich für eine Schranke entscheiden, statt zu zeigen, welche
 * zuerst bricht.
 */
export function schwaechste(k: Kennwert, echterUeberstand: boolean): [Grund, number] {
  const noetig = echterUeberstand ? SCHRANKE.ueberstandEcht : SCHRANKE.ueberstandKnapp;
  const alle: Array<[Grund, number]> = [
    ["Neigung", (SCHRANKE.neigung - k.neigungMax) / SCHRANKE.neigung],
    ["Hebelarm", (k.hebelMin - SCHRANKE.hebel) / SCHRANKE.hebel],
    ["Hebel zu", (k.hebelZu - SCHRANKE.hebelZu) / SCHRANKE.hebelZu],
    ["Stange", (k.ueberstand - noetig) / 0.1],
    ["Hub", (k.hub - SCHRANKE.hub) / SCHRANKE.hub],
    ["zu lang", (SCHRANKE.laengeMax - k.laengeMax) / SCHRANKE.laengeMax],
  ];
  let best: [Grund, number] = ["", Infinity];
  for (const e of alle) if (e[1] < best[1]) best = e;
  return best;
}

export function haelt(k: Kennwert, echterUeberstand: boolean): boolean {
  return schwaechste(k, echterUeberstand)[1] > 0;
}

/* ---------------------------------------------------------------- Die Suche */

export interface Fund {
  dr0: number;
  /** Kleinste Säule, die alles hält (m) — null, wenn es keine gibt. */
  saeule: number | null;
  Ay: number;
  Az: number;
  k: Kennwert | null;
  /** Woran es scheitert, wenn nichts geht — an der besten Stelle. */
  grund: Grund;
  /** Wie knapp es dort war (Anteil der Schranke, negativ = gerissen). */
  luft: number;
}

/**
 * Für einen Radiusabstand: die kleinste Säule, die alles hält — über alle
 * Lagen des Schalenauges.
 *
 * Abgetastet, nicht optimiert. Bei vier Größen ist ein Raster ehrlicher als
 * ein Suchlauf, der in ein lokales Loch fällt; und es kann sagen, WORAN es
 * scheitert, wo nichts geht. Ein Fund wird mit doppelt so feiner Abtastung des
 * Schließwegs gegengerechnet — sonst rutscht eine Lösung durch, die nur
 * zwischen den Stützstellen hält.
 */
/**
 * Die Raster fuer die Lage des Schalenauges — und warum die heutigen Werte
 * ausdruecklich darinstehen.
 *
 * Die erste Fassung rasterte in 2-cm-Schritten und meldete fuer den HEUTIGEN
 * Radiusabstand „keine Loesung" — obwohl der gebaute Greifer genau dort steht.
 * Grund: `OBERE_ANBINDUNG.z` ist 0,245 und lag zwischen zwei Rasterpunkten.
 * Der heutige Stand ist eine NADEL im Raum; ein Raster, das ihn nicht trifft,
 * behauptet, es gaebe ihn nicht. Deshalb sind seine beiden Zahlen jetzt Teil
 * des Rasters — und `test/anlenkungsraum.test.ts` prueft, dass er gefunden wird.
 */
const AY_RASTER: number[] = (() => {
  const a: number[] = [];
  for (let y = -0.44; y <= 0.0601; y += 0.01) a.push(Math.round(y * 1e4) / 1e4);
  if (!a.includes(OBERE_ANBINDUNG.y)) a.push(OBERE_ANBINDUNG.y);
  return a.sort((x, y) => x - y);
})();
const AZ_RASTER: number[] = (() => {
  const a: number[] = [];
  for (let z = 0.1; z <= 0.4001; z += 0.01) a.push(Math.round(z * 1e4) / 1e4);
  if (!a.includes(OBERE_ANBINDUNG.z)) a.push(OBERE_ANBINDUNG.z);
  return a.sort((x, y) => x - y);
})();

export function kleinsteSaeule(
  dr0: number,
  echterUeberstand: boolean,
  maxSaeule = 0.95,
  stufen = 21
): Fund {
  let besteLuft = -Infinity;
  let besterGrund: Grund = "";
  for (let saeule = 0; saeule <= maxSaeule + 1e-9; saeule += 0.01) {
    const d = saeule + AUFNAHME_UEBER_TRAVERSE;
    for (const Az of AZ_RASTER) {
      for (const Ay of AY_RASTER) {
        const k = kennwert({ dr0, d, Ay, Az }, stufen);
        const [g, v] = schwaechste(k, echterUeberstand);
        if (v > 0) {
          const fein = kennwert({ dr0, d, Ay, Az }, 80);
          if (haelt(fein, echterUeberstand)) {
            return { dr0, saeule, Ay, Az, k: fein, grund: "", luft: v };
          }
        }
        if (v > besteLuft) {
          besteLuft = v;
          besterGrund = g;
        }
      }
    }
  }
  return { dr0, saeule: null, Ay: 0, Az: 0, k: null, grund: besterGrund, luft: besteLuft };
}

/** Die Kurve über den Radiusabstand — daraus wird die Karte gefüllt. */
export function kurve(von: number, bis: number, schritt: number, echterUeberstand: boolean): Fund[] {
  const raus: Fund[] = [];
  for (let dr0 = von; dr0 <= bis + 1e-9; dr0 += schritt) {
    raus.push(kleinsteSaeule(Math.round(dr0 * 1e4) / 1e4, echterUeberstand));
  }
  return raus;
}

/** Durchmesser der Mitteltraverse zu einem Aufnahmeradius (m) — `traverseAus`. */
export function kopfDurchmesser(rOben: number): number {
  return 2 * rOben + 0.02;
}
