import { YARD_W, YARD_D, YARD_MIN_X, YARD_MAX_X, YARD_CX, GATE_X, WEIGH_X, WEIGH_Z } from "./yard";
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

function bayObstacles(cfg: ContainerConfig): Obstacle[] {
  if (cfg.kind !== "bay") return []; // Haufen und offene Flächen haben keine Wände
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
  // Öffnung nach Westen (Standard) oder Osten — die andere Stirnseite ist zu
  const stirn = cfg.facing === "east" ? -hw : hw;
  return [
    { x: cfg.x, z: cfg.z - hd, hw, hd: BAY_T, top, label: `${L} Süd` },
    { x: cfg.x, z: cfg.z + hd, hw, hd: BAY_T, top, label: `${L} Nord` },
    { x: cfg.x + stirn, z: cfg.z, hw: BAY_T, hd, top, label: `${L} Stirn` },
  ];
}

export const STATIC_OBSTACLES: Obstacle[] = [
  // --- Umrandung aus Betonlego, Einfahrt im Nordwesten ausgespart ---
  { x: YARD_CX, z: -HZ, hw: YARD_W / 2, hd: WALL_T / 2, top: WALL_H, label: "Südwand" },
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

  // --- Schere und Presse, südlich hinter dem Bagger ---
  { x: -8.5, z: -7.0, hw: 5.4, hd: 2.4, top: 2.2, label: "Schere" },


  // --- Gebäude: Kaffeebude abseits ---
  // Das Wiegehäuschen steht nicht hier, sondern in BUILDING_HUT: Es weicht
  // beim Ausbau dem Büro, und dann gilt dessen größerer Grundriss.
  { x: GATE_X - 6, z: WEIGH_Z - 13, hw: 2.6, hd: 1.8, top: 3.2, label: "Kaffeebude" },
];

/** Grundriss des Wiegehäuschens — gilt, solange nicht ausgebaut wurde. */
export const BUILDING_HUT: Obstacle[] = [
  { x: WEIGH_X - 4.6, z: WEIGH_Z, hw: 2.4, hd: 1.7, top: 3.2, label: "Wiegehäuschen" },
];

/**
 * Bauwerke, die sich im Laufe des Spiels ändern: Aus dem Wiegehäuschen wird
 * ein Büro, später mit Halle daneben. Zu Beginn gilt das Häuschen — so ist
 * die Einfahrt auch ohne Ausbau richtig verstellt.
 */
let dynamicObstacles: Obstacle[] = BUILDING_HUT;

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
