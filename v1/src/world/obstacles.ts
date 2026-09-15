import { pressWaende } from "./press";
import {
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  SUED_HOCH,
  SUED_HOCH_VON,
  SUED_HOCH_RAMPE,
  OST_HOCH_BIS,
  GATE_X,
  KAFFEE_POS,
  KAFFEE_FUSS,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  TRENNSTEINE,
  TRENNSTEIN_X,
  TRENNSTEIN_L,
  TRENNSTEIN_T,
} from "./yard";
import { officeFootprints, hallenWaende } from "./office";
import { CONFIGS, type ContainerConfig } from "./containers";

/**
 * Feste Bauten auf dem Platz — alles, wodurch niemand hindurchlaufen oder
 * -fahren darf (Design-Fix 29.08.2026).
 *
 * Die Physik kennt diese Bauwerke als Kollider, aber Lambert und die LKW
 * bewegen sich kinematisch nach Skript: sie werden von Kollidern nicht
 * aufgehalten, sondern müssen ihre Wege selbst darum herum planen. Diese
 * Liste ist die gemeinsame Grundlage dafür.
 *
 * Achsenparallele Rechtecke, Maße als Halbweiten ab Mittelpunkt.
 */
export interface Obstacle {
  x: number;
  z: number;
  /** halbe Ausdehnung in x */
  hw: number;
  /** halbe Ausdehnung in z */
  hd: number;
  /** Oberkante über Grund — darüber darf der Baggerarm frei schwenken */
  top: number;
  label: string;
}

const HZ = YARD_D / 2;
/** Breite der Einfahrtslücke in der Nordwand */
const GATE_HALF = 4.5;
/** Dicke der Betonlego-Umrandung (drei Reihen à 0,6 m) */
const WALL_T = 0.6;
/** Höhe der Umrandung: drei Reihen */
const WALL_H = 1.8;

/**
 * Wände einer Mulde, aus ihrer eigenen Konfiguration gerechnet.
 *
 * Vorher stand die Muldengeometrie hier ein zweites Mal, von Hand gepflegt.
 * Beim Verschieben der Sortierreihe blieb sie zurück: Der Arm stiess gegen
 * unsichtbare Wände am alten Platz und fuhr durch die echten hindurch. Und die
 * Wände des Ballenlagers standen noch in der Liste, obwohl daraus längst eine
 * offene Fläche geworden war. Zwei Wahrheiten über dieselbe Sache halten nie.
 *
 * Die Öffnung bleibt frei — als Vollfläche eingetragen wäre der Innenraum
 * gesperrt und man käme mit der Spinne nicht mehr hinein.
 */
const BAY_T = 0.35;
/** Die Rueckwand steht zwei Betonlego-Lagen hoeher als die Flanken. */
const RUECKWAND_PLUS = 1.0;

function bayObstacles(cfg: ContainerConfig): Obstacle[] {
  if (cfg.kind === "halde") {
    /*
     * Der Mischschrottplatz: drei doppelt gesetzte Wände, nach Norden offen.
     * Er steht hier, weil sonst Lambert, die Streife und die LKW quer
     * hindurchliefen — die Wände sind fünf Meter hoch und sehr real.
     */
    const [hw, hd, top] = cfg.size;
    const T = 0.55;
    const L = cfg.label;
    /*
     * Rückwand, Aussenwand und eine halbe Trennwand zur Maschine hin
     * (12.09.2026). Die vordere Hälfte bleibt frei — dort greift der Bagger
     * hinein und dort setzt der Kipper zurück.
     */
    const wnd = cfg.haldeWaende ?? { rueck: true, aussen: true, trenn: true };
    const out: Obstacle[] = [];
    /*
     * Die Eintraege muessen den Steinen folgen, die man sieht — sonst steht da
     * eine Mauer, die niemand erkennt.
     *
     * Befund 12.09.2026: „zwischen der Presse und dem Mischschrottplatz gibt es
     * eine unsichtbare Barriere." Nachgemessen war der Eintrag der angedeuteten
     * Trennwand z −28,00 bis −24,00 bei 5 m Hoehe, die Steine reichen aber nur
     * von −28,00 bis −25,00 und sind 2,50 m hoch. Einen Meter weiter und
     * doppelt so hoch wie das, was dasteht — und das genau in der Luecke
     * zwischen Presse und Halde, durch die der Arm schwenkt.
     *
     * Dasselbe galt fuer die auslaufenden Waende: Sie sind am offenen Ende nur
     * noch 40 % hoch (E-091), standen hier aber als ein Kasten auf voller
     * Hoehe. Der Kollider in containers.ts macht daraus laengst zwei Stufen;
     * diese Liste zieht jetzt nach.
     */
    const BL = 1.5; // Steinlaenge, wie in containers.ts
    const halb = top * 0.55; // dieselbe Stufe wie beim Kollider
    if (wnd.rueck !== false) {
      // Laeuft zur Maschinenseite (−x) hin aus
      out.push({ x: cfg.x + hw / 4, z: cfg.z - hd / 2 - T, hw: hw / 4 + T, hd: T, top, label: `${L} Rueck` });
      out.push({
        x: cfg.x - hw / 4,
        z: cfg.z - hd / 2 - T,
        hw: hw / 4 + T,
        hd: T,
        top: halb,
        label: `${L} Rueck flach`,
      });
    }
    if (wnd.aussen !== false) {
      // Laeuft nach vorn (+z) hin aus
      out.push({ x: cfg.x + hw / 2 + T, z: cfg.z - hd / 4, hw: T, hd: hd / 4 + T, top, label: `${L} Aussen` });
      out.push({
        x: cfg.x + hw / 2 + T,
        z: cfg.z + hd / 4,
        hw: T,
        hd: hd / 4 + T,
        top: halb,
        label: `${L} Aussen flach`,
      });
    }
    if (wnd.nord === true)
      out.push({
        x: cfg.x,
        z: cfg.z + hd / 2 + T,
        hw: hw / 2 + T,
        hd: T,
        // Halbe Hoehe — der Arm greift darueber hinweg (siehe containers.ts)
        top: top / 2,
        label: `${L} Nord`,
      });
    if (wnd.trenn !== false)
      out.push({
        x: cfg.x - hw / 2 - T,
        // Nur die zwei Steinlaengen ab der hinteren Ecke, halbe Hoehe — genau
        // die Andeutung, die gebaut wird.
        z: cfg.z - hd / 2 + BL,
        hw: T,
        hd: BL,
        top: top / 2,
        label: `${L} Trenn`,
      });
    return out;
  }
  if (cfg.kind !== "bay") return []; // Haufen, Container und offene Flächen haben keine Wände
  const [w, d, top] = cfg.size;
  // Bei Öffnung nach Norden ist die Mulde gedreht: Breite und Tiefe tauschen
  const nord = cfg.facing === "north";
  const hw = (nord ? d : w) / 2;
  const hd = (nord ? w : d) / 2;
  const L = cfg.label;
  if (nord) {
    return [
      { x: cfg.x, z: cfg.z - hd, hw, hd: BAY_T, top, label: `${L} Süd` },
      { x: cfg.x - hw, z: cfg.z, hw: BAY_T, hd, top, label: `${L} West` },
      { x: cfg.x + hw, z: cfg.z, hw: BAY_T, hd, top, label: `${L} Ost` },
    ];
  }
  // Öffnung nach Westen (Standard) oder Osten — die andere Stirnseite ist zu.
  // Sie steht zwei Lagen hoeher als die Flanken (siehe containers.ts), damit
  // beim Einfuellen nichts dahinterfaellt.
  const stirn = cfg.facing === "east" ? -hw : hw;
  /*
   * `shareSouth`/`shareNorth` nehmen eine Flanke heraus — dort steht schon
   * etwas: bei der ersten Mulde der Westflanke die Aussenmauer, bei den
   * beiden anderen die Nordwand ihres Nachbarn (E-010). Die Steine dafuer
   * entfallen schon in containers.ts; ohne diese Zeilen bliebe hier eine
   * unsichtbare Wand stehen. Genau so ein Paar aus gebautem und verzeichnetem
   * Stand ist am 12.09.2026 als „unsichtbare Barriere" aufgefallen.
   */
  const waende: Obstacle[] = [];
  if (!cfg.shareSouth)
    waende.push({ x: cfg.x, z: cfg.z - hd, hw, hd: BAY_T, top, label: `${L} Süd` });
  if (!cfg.shareNorth)
    waende.push({ x: cfg.x, z: cfg.z + hd, hw, hd: BAY_T, top, label: `${L} Nord` });
  /*
   * `shareEast` nimmt die Stirnwand heraus (Ansage 13.09.2026: „Rueckwaende
   * raus, nur Seitenwaende"). Die Steine dafuer entfallen schon in
   * containers.ts; ohne diese Zeile bliebe hier eine unsichtbare Wand stehen,
   * durch die der Greifer nicht kaeme.
   */
  if (!cfg.shareEast) {
    waende.push({
      x: cfg.x + stirn,
      z: cfg.z,
      hw: BAY_T,
      hd,
      top: top + RUECKWAND_PLUS,
      label: `${L} Stirn`,
    });
  } else if (cfg.niedrigeStirn) {
    /*
     * Die niedrige Schwelle auf der Baggerseite (E-028). Sie steht an
     * derselben Stelle wie die volle Stirnwand, ist aber nur `niedrigeStirn`
     * hoch — `hitsObstacle` laesst Arm und Spinne darueber hinweg, und der
     * Blick aus der abgesenkten Kabine geht ebenfalls darueber (gerechnet in
     * `containers.ts`, `totenStreifen`).
     *
     * Sie MUSS hier stehen: Was gebaut ist und nicht verzeichnet, faellt
     * Lambert und den LKW nicht auf — und was verzeichnet ist und nicht
     * gebaut, ist die unsichtbare Barriere vom 12.09.2026.
     */
    waende.push({
      x: cfg.x + stirn,
      z: cfg.z,
      hw: BAY_T,
      hd,
      top: cfg.niedrigeStirn,
      label: `${L} Schwelle`,
    });
  }
  return waende;
}

export const STATIC_OBSTACLES: Obstacle[] = [
  /*
   * --- Umrandung aus Betonlego, Einfahrt im Nordwesten ausgespart ---
   *
   * Die Suedmauer steht seit E-010 in ZWEI Stuecken: Zwischen `BUCHT_X_VON`
   * und `BUCHT_X_BIS` geht die Ausbuchtung nach Sueden auf. Als ein Eintrag
   * ueber die ganze Breite laege quer vor ihrer Oeffnung eine unsichtbare
   * Wand, und der Bagger kaeme nicht in die Bucht.
   */
  {
    x: (YARD_MIN_X + BUCHT_X_VON) / 2,
    z: -HZ,
    hw: (BUCHT_X_VON - YARD_MIN_X) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Südwand West",
  },
  {
    x: (BUCHT_X_BIS + YARD_MAX_X) / 2,
    z: -HZ,
    hw: (YARD_MAX_X - BUCHT_X_BIS) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Südwand Ost",
  },
  /*
   * Hinter den Mulden steht die Suedmauer hoeher (yard.ts). Ohne diesen
   * Eintrag liesse `hitsObstacle` den Greifer auf 2 m durch sie hindurch, weil
   * die Mauer dort nur mit 1,8 m verzeichnet waere.
   */
  {
    x: (SUED_HOCH_VON - SUED_HOCH_RAMPE + BUCHT_X_VON) / 2,
    z: -HZ,
    hw: (BUCHT_X_VON - (SUED_HOCH_VON - SUED_HOCH_RAMPE)) / 2,
    hd: WALL_T / 2,
    top: SUED_HOCH,
    label: "Südwand hoch",
  },
  {
    x: (BUCHT_X_BIS + YARD_MAX_X) / 2,
    z: -HZ,
    hw: (YARD_MAX_X - BUCHT_X_BIS) / 2,
    hd: WALL_T / 2,
    top: SUED_HOCH,
    label: "Südwand hoch Ost",
  },
  /*
   * Die Ausbuchtung: zwei Schenkel nach Sueden und die Rueckwand quer dazu,
   * alle auf `SUED_HOCH` — „rundum mit hoher Wand" (E-010).
   */
  {
    x: BUCHT_X_VON,
    z: (-HZ + BUCHT_Z) / 2,
    hw: WALL_T / 2,
    hd: (-HZ - BUCHT_Z) / 2,
    top: SUED_HOCH,
    label: "Buchtwand West",
  },
  {
    x: BUCHT_X_BIS,
    z: (-HZ + BUCHT_Z) / 2,
    hw: WALL_T / 2,
    hd: (-HZ - BUCHT_Z) / 2,
    top: SUED_HOCH,
    label: "Buchtwand Ost",
  },
  {
    x: (BUCHT_X_VON + BUCHT_X_BIS) / 2,
    z: BUCHT_Z,
    hw: (BUCHT_X_BIS - BUCHT_X_VON) / 2,
    hd: WALL_T / 2,
    top: SUED_HOCH,
    label: "Buchtwand Süd",
  },
  /*
   * Die Trennsteine zwischen den beiden Halden. Sie stehen hier mit ihrer
   * WIRKLICHEN Hoehe je Saeule (0,6 bis 2,4 m) — `hitsObstacle` laesst den
   * Arm ueber alles hinweg, was niedriger ist als er selbst, und genau das
   * soll hier passieren: „sodass der Zugriff von Mischschrott zu
   * Stahlschrott fluessig laeuft."
   */
  ...TRENNSTEINE.map((s, i) => ({
    x: TRENNSTEIN_X,
    z: s.z,
    hw: TRENNSTEIN_T / 2,
    hd: TRENNSTEIN_L / 2,
    top: s.hoehe,
    label: `Trennstein ${i + 1}`,
  })),
  /* Dasselbe an der Ostmauer, hinter der Presse (yard.ts). */
  {
    x: YARD_MAX_X,
    z: (-HZ + OST_HOCH_BIS) / 2,
    hw: WALL_T / 2,
    hd: (OST_HOCH_BIS + HZ) / 2,
    top: SUED_HOCH,
    label: "Ostwand hoch",
  },
  { x: YARD_MIN_X, z: 0, hw: WALL_T / 2, hd: HZ, top: WALL_H, label: "Westwand" },
  { x: YARD_MAX_X, z: 0, hw: WALL_T / 2, hd: HZ, top: WALL_H, label: "Ostwand" },
  // Nordwand in zwei Stücken links und rechts der Einfahrt
  {
    x: (YARD_MIN_X + (GATE_X - GATE_HALF)) / 2,
    z: HZ,
    hw: (GATE_X - GATE_HALF - YARD_MIN_X) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Nordwand West",
  },
  {
    x: (GATE_X + GATE_HALF + YARD_MAX_X) / 2,
    z: HZ,
    hw: (YARD_MAX_X - GATE_X - GATE_HALF) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Nordwand Ost",
  },

  // --- Mulden: aus CONFIGS erzeugt, damit sie nicht auseinanderlaufen ---
  ...CONFIGS.flatMap(bayObstacles),

  /*
   * PRESSE — WAENDE JA, DECKEL NEIN (15.09.2026, E-029).
   *
   * Befund Patrick: „Es war auch nicht moeglich, ein zusammengepresstes Auto
   * wieder aus der Presse zu holen." Hier stand die Maschine als EIN volles
   * Rechteck von 4,75 x 4,90 m auf 2,20 m Hoehe. `hitsObstacle` laesst alles
   * ueber `top` hinweg und nichts darunter hindurch — der Greifer galt damit
   * als „im Bauwerk steckend", sobald er unter die Wandkrone kam, und das
   * fertige Paket lag unerreichbar in der eigenen Kammer.
   *
   * Jetzt genau wie bei den Sortiermulden: nur der Wandring sperrt, der
   * Innenraum ist offen. Die Eintraege kommen aus `pressWaende()` und damit
   * aus derselben Rechnung wie die Rapier-Kollider — physisch war die Kammer
   * die ganze Zeit richtig gebaut (Boden plus vier Waende, oben offen), nur
   * diese Liste sagte etwas anderes.
   *
   * FUER FAHRZEUGE BLEIBT SIE ZU: Der Ring ist lueckenlos, und die lichte
   * Kammer ist 4,05 x 4,20 m — ein LKW ist 3,10 m breit und 8,04 m lang, er
   * bekommt seinen Umriss dort nicht hinein, ohne eine Wand zu schneiden
   * (`test/presse.test.ts`, `test/fahrumriss.test.ts`).
   *
   * Bis 13.09.2026 stand hier fest (−3,0 | −26,0) mit 7,8 x 5,0 m. Als die
   * Presse morgens in die Ecke gezogen ist, blieb dieser Eintrag stehen: eine
   * unsichtbare Wand mitten auf dem Platz. Seitdem kommen Lage und Mass aus
   * press.ts.
   */
  ...pressWaende().map((w) => ({
    x: w.x,
    z: w.z,
    hw: w.hw,
    hd: w.hd,
    top: w.top,
    label: `Presse ${w.teil}`,
  })),


  // --- Betriebsgebäude: Büro und Halle, hinten rechts an der Wand ---
  // Der Grundriss kommt aus office.ts, damit Bau, Kollider und Hindernis
  // nicht auseinanderlaufen.
  // Janines Kaffeewagen steht auf dem Vorplatz — ein Anhaenger ist ein
  // Hindernis wie jedes andere.
  {
    x: KAFFEE_POS.x,
    z: KAFFEE_POS.z,
    hw: KAFFEE_FUSS[0],
    hd: KAFFEE_FUSS[1],
    top: 2.6,
    label: "Kaffeewagen",
  },

  ...officeFootprints().map(([x, z, hw, hd]) => ({
    x,
    z,
    hw,
    hd,
    top: 5.4,
    label: "Betriebsgebäude",
  })),

  /*
   * Die drei Sortierhallen — nur ihre WAENDE, nicht ihre Grundflaeche.
   *
   * Bis zum 15.09.2026 stand hier je ein Vollrechteck von 7,5 x 9,0 m. Damit
   * war eine Halle nicht anfahrbar: Jeder LKW haelt 1,4 m vor einem Hindernis
   * an und hupt, und der ganze Weg aus E-011 („Haendler fahren ueber die Waage
   * in ihre Halle und laden selbst ab") lief ins Leere. Jetzt ist es wie bei
   * den Sortiermulden: drei Waende, das Tor bleibt frei.
   *
   * Die Waende kommen aus `hallenWaende()` — derselben Quelle, aus der auch
   * der Rapier-Kollider gebaut wird. Vorher waren es zwei Listen, und sie
   * zeigten in entgegengesetzte Richtungen.
   */
  ...hallenWaende().map((w) => ({
    x: w.x,
    z: w.z,
    hw: w.hw,
    hd: w.hd,
    top: 6.9,
    label: `Halle ${w.nr} ${w.teil}`,
  })),
];

/**
 * Bauwerke, die im Spiel dazukommen können. Zurzeit keine — die Ausbaustufen
 * verändern nur noch die Einrichtung, nicht den Bau (Stand 10.09.2026).
 */
let dynamicObstacles: Obstacle[] = [];

/** Gebäude-Hindernisse austauschen (Ausbaustufe geändert). */
export function setBuildingObstacles(list: Obstacle[]): void {
  dynamicObstacles = list;
}

/**
 * Liegt (x,z) in einem festen Bauwerk? `pad` erweitert es um einen
 * Sicherheitsrand. Mit `y` wird die Höhe geprüft: Der Baggerarm darf über
 * eine Mauer schwenken, nur eben nicht hindurch.
 */
export function hitsObstacle(x: number, z: number, pad = 0, y?: number): Obstacle | null {
  for (const o of dynamicObstacles) {
    if (Math.abs(x - o.x) >= o.hw + pad || Math.abs(z - o.z) >= o.hd + pad) continue;
    if (y !== undefined && y > o.top) continue;
    return o;
  }
  for (const o of STATIC_OBSTACLES) {
    if (Math.abs(x - o.x) >= o.hw + pad || Math.abs(z - o.z) >= o.hd + pad) continue;
    if (y !== undefined && y > o.top) continue;
    return o;
  }
  return null;
}

/**
 * Richtung so ablenken, dass sie an einem Bauwerk vorbeiführt statt hinein.
 * Geliefert wird ein Ausweichvektor entlang der Wand — an der Seite, an der
 * das Hindernis am nächsten endet.
 */
export function slideAround(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  pad: number,
  out: { x: number; z: number }
): boolean {
  const o = hitsObstacle(x + dirX * pad, z + dirZ * pad, pad);
  if (!o) return false;
  // An der schmaleren Seite herauslaufen: das ist der kürzere Weg heraus
  const dx = x - o.x;
  const dz = z - o.z;
  const outX = o.hw + pad - Math.abs(dx);
  const outZ = o.hd + pad - Math.abs(dz);
  if (outX < outZ) {
    out.x = Math.sign(dx) || 1;
    out.z = dirZ * 0.35;
  } else {
    out.x = dirX * 0.35;
    out.z = Math.sign(dz) || 1;
  }
  const len = Math.hypot(out.x, out.z) || 1;
  out.x /= len;
  out.z /= len;
  return true;
}
