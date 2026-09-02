import * as THREE from "three";
import type { ItemManager, ScrapItem } from "../world/scrapItems";
import {
  ROUTE_IN_FWD,
  ROUTE_APPROACH,
  ROUTE_IN_REV,
  PICKUP_APPROACH,
  PICKUP_IN_REV,
  TIP_APPROACH,
  TIP_IN_REV,
} from "./routes";

/**
 * Überwachung der Fahrspuren (Wunsch 02.09.2026).
 *
 * Die Wege über den Platz müssen frei bleiben. Liegt dort Schrott — von einer
 * Fuhre gefallen, beim Abkippen weggerollt oder vom Greifer verloren —, dann
 * ist das ein Störfall: Die Fahrer kommen nicht durch, der Betrieb steht.
 *
 * Diese Überwachung findet die blockierenden Teile, damit das Spiel es melden
 * und der Platzwart sie wegräumen kann. Sie ersetzt nicht die Blockadeprüfung
 * der Fahrzeuge — die stoppt den einzelnen LKW; hier geht es darum, den
 * Zustand sichtbar zu machen und aufzulösen.
 */

/** Halbe Breite der Fahrspur — so viel Platz braucht ein LKW. */
const LANE_HALF_W = 2.6;
/** Darunter überfährt ein LKW ein Teil einfach. */
const BLOCKING_MASS_KG = 120;
/** Nur was am Boden liegt zählt; darüber ist es auf einer Ladefläche. */
const MAX_Y = 1.3;

/** Alle Spuren, die frei bleiben müssen. */
const LANES: Array<[string, Array<[number, number]>]> = [
  ["Einfahrt", ROUTE_IN_FWD],
  ["Zufahrt", ROUTE_APPROACH],
  ["Abladeplatz", ROUTE_IN_REV],
  ["Abholerspur", PICKUP_APPROACH],
  ["Verladeplatz", PICKUP_IN_REV],
  ["Kipperspur", TIP_APPROACH],
  ["Kipperhalt", TIP_IN_REV],
];

export interface Blockage {
  item: ScrapItem;
  lane: string;
  x: number;
  z: number;
}

/** Kürzester Abstand von (px,pz) zur Strecke (x1,z1)–(x2,z2). */
function distToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return Math.hypot(px - x1, pz - z1);
  let t = ((px - x1) * dx + (pz - z1) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}

export class LaneWatch {
  /** Was gerade im Weg liegt, nächstliegendes zuerst. */
  blockages: Blockage[] = [];
  private t = 0;

  constructor(private items: ItemManager) {}

  /** Alle halbe Sekunde prüfen — häufiger lohnt bei liegendem Schrott nicht. */
  update(dt: number): void {
    this.t += dt;
    if (this.t < 0.5) return;
    this.t = 0;
    this.scan();
  }

  private scan(): void {
    this.blockages = [];
    for (const it of this.items.items) {
      if (it.massKg < BLOCKING_MASS_KG) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const p = it.body.translation();
      if (p.y > MAX_Y) continue;
      const lane = this.laneAt(p.x, p.z);
      if (lane) this.blockages.push({ item: it, lane, x: p.x, z: p.z });
    }
  }

  /** Auf welcher Spur liegt (x,z)? null, wenn frei. */
  private laneAt(x: number, z: number): string | null {
    for (const [name, pts] of LANES) {
      for (let i = 0; i < pts.length - 1; i++) {
        const d = distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        if (d < LANE_HALF_W) return name;
      }
    }
    return null;
  }

  get blocked(): boolean {
    return this.blockages.length > 0;
  }

  /** Kurztext für die Meldung. */
  get message(): string {
    if (!this.blocked) return "";
    const spuren = [...new Set(this.blockages.map((b) => b.lane))];
    const n = this.blockages.length;
    // Ohne Artikel formuliert: die Spurnamen haben unterschiedliche
    // Geschlechter ("die Einfahrt", "der Abladeplatz").
    return n === 1
      ? `Störfall: ein Teil blockiert ${spuren[0]}`
      : `Störfall: ${n} Teile blockieren ${spuren.join(" und ")}`;
  }

  /**
   * Das Teil, um das sich als Nächstes gekümmert werden sollte — das
   * nächstgelegene zum Platzwart.
   */
  nearest(to: THREE.Vector3): Blockage | null {
    let best: Blockage | null = null;
    let bestD = Infinity;
    for (const b of this.blockages) {
      const d = Math.hypot(b.x - to.x, b.z - to.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** Liegt dieses Teil auf einer Spur? Für Lamberts Auswahl. */
  isBlocking(item: ScrapItem): boolean {
    return this.blockages.some((b) => b.item === item);
  }
}
