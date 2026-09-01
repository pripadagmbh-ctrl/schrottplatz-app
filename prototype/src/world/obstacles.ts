import { YARD_W, YARD_D, GATE_X, WEIGH_X, WEIGH_Z } from "./yard";

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

const HX = YARD_W / 2;
const HZ = YARD_D / 2;
/** Breite der Einfahrtslücke in der Nordwand */
const GATE_HALF = 4.5;
/** Dicke der Betonlego-Umrandung (drei Reihen à 0,6 m) */
const WALL_T = 0.6;
/** Höhe der Umrandung: drei Reihen */
const WALL_H = 1.8;

/** Mittelachse der Boxenreihe */
const BAY_X = 5.6;
/** halbe Boxentiefe (x) und -breite (z) */
const BAY_HW = 2.85;
const BAY_HD = 2.45;
/** Wanddicke der Betonlego-Boxen */
const BAY_T = 0.35;
const BAY_TOP = 2.5;

/** Die drei Wände einer Box — vorn nach Westen bleibt sie offen. */
function bayWalls(z: number, name: string): Obstacle[] {
  return [
    { x: BAY_X, z: z - BAY_HD, hw: BAY_HW, hd: BAY_T, top: BAY_TOP, label: `Box ${name} Süd` },
    { x: BAY_X, z: z + BAY_HD, hw: BAY_HW, hd: BAY_T, top: BAY_TOP, label: `Box ${name} Nord` },
    { x: BAY_X + BAY_HW, z, hw: BAY_T, hd: BAY_HD, top: BAY_TOP, label: `Box ${name} Ost` },
  ];
}

export const STATIC_OBSTACLES: Obstacle[] = [
  // --- Umrandung aus Betonlego, Einfahrt im Nordwesten ausgespart ---
  { x: 0, z: -HZ, hw: HX, hd: WALL_T / 2, top: WALL_H, label: "Südwand" },
  { x: -HX, z: 0, hw: WALL_T / 2, hd: HZ, top: WALL_H, label: "Westwand" },
  { x: HX, z: 0, hw: WALL_T / 2, hd: HZ, top: WALL_H, label: "Ostwand" },
  // Nordwand in zwei Stücken links und rechts der Einfahrt
  {
    x: (-HX + (GATE_X - GATE_HALF)) / 2,
    z: HZ,
    hw: (GATE_X - GATE_HALF + HX) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Nordwand West",
  },
  {
    x: (GATE_X + GATE_HALF + HX) / 2,
    z: HZ,
    hw: (HX - GATE_X - GATE_HALF) / 2,
    hd: WALL_T / 2,
    top: WALL_H,
    label: "Nordwand Ost",
  },

  // --- Betonlego-Boxen für die Buntmetalle ---
  // Je drei Wände, vorn (Westen) offen. Als Vollfläche eingetragen wäre der
  // Innenraum gesperrt und man käme mit der Spinne nicht mehr hinein.
  ...bayWalls(-7.35, "VA"),
  ...bayWalls(-2.45, "Alu"),
  ...bayWalls(2.45, "Kupfer"),
  ...bayWalls(7.35, "Kabel"),

  // --- Schere und Presse, südlich hinter dem Bagger ---
  { x: -4.6, z: -9.8, hw: 4.4, hd: 3.8, top: 2.2, label: "Schere" },

  // --- Gebäude: Wiegehäuschen an der Waage, Kaffeebude abseits ---
  { x: WEIGH_X + 4.6, z: WEIGH_Z, hw: 2.4, hd: 1.7, top: 3.2, label: "Wiegehäuschen" },
  { x: GATE_X - 6, z: WEIGH_Z - 13, hw: 2.6, hd: 1.8, top: 3.2, label: "Kaffeebude" },
];

/**
 * Liegt (x,z) in einem festen Bauwerk? `pad` erweitert es um einen
 * Sicherheitsrand. Mit `y` wird die Höhe geprüft: Der Baggerarm darf über
 * eine Mauer schwenken, nur eben nicht hindurch.
 */
export function hitsObstacle(x: number, z: number, pad = 0, y?: number): Obstacle | null {
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
