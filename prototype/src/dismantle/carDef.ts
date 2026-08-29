/**
 * Verbundobjekt-Definitionen (Briefing Kap. 8): datengetrieben — ein neues
 * Wrack braucht nur eine neue Def + Maße, keinen Code.
 * Alle Zahlen Startwerte (SW).
 */

export interface PartDef {
  id: string;
  name: string;
  materialId: string;
  massKg: number;
  /** Sekunden Ziehen über der Lösekraft bis zum Abriss */
  tearSeconds: number;
  /** Greifradius um den Ankerpunkt, in dem die Spinne die Part statt des Rumpfs fasst */
  grabRadius: number;
  /** Ankerpunkt lokal zum Rumpf */
  anchor: [number, number, number];
  /** Box-Maße der losgelösten Part [w,h,d] bzw. Rad [radius, breite] */
  size: number[];
  kind: "box" | "wheel";
  color: number;
}

export interface WindowDef {
  id: string;
  anchor: [number, number, number];
  /** [Breite, Höhe] */
  size: [number, number];
  rotY: number;
}

export interface CarDef {
  /** Physik-Gesamtmasse beim Spawn (Rumpf + Parts) */
  totalMassKg: number;
  /** Rumpf ohne Parts — zählt als Stahlschrott auf dem Haufen */
  hullMassKg: number;
  hullMaterialId: string;
  /** Kollider-Halbmaße [x,y,z] + y-Offset */
  colliderHalf: [number, number, number];
  colliderYOffset: number;
  /** Quetschstufen: Y-Skalierung der Karosse je Stufe (0 = heil) */
  crushScales: [number, number, number];
  /** Aufprall-Schwellen (Δv in m/s): Scheiben / Quetschstufe */
  glassImpactDv: number;
  crushImpactDv: number;
  parts: PartDef[];
  windows: WindowDef[];
}

export const CAR_DEF: CarDef = {
  totalMassKg: 950,
  hullMassKg: 600,
  hullMaterialId: "steel",
  colliderHalf: [0.85, 0.55, 2.0],
  colliderYOffset: 0.55,
  crushScales: [1, 0.76, 0.55],
  glassImpactDv: 4.5,
  crushImpactDv: 7,
  parts: [
    {
      id: "engine",
      name: "Motor",
      materialId: "steel", // Guss läuft im Stahlschrott mit
      massKg: 210,
      tearSeconds: 2.0,
      grabRadius: 0.65,
      anchor: [0, 0.62, 1.45],
      size: [0.9, 0.42, 0.7],
      kind: "box",
      color: 0x3e4247,
    },
    ...([
      [-0.82, 1.25],
      [0.82, 1.25],
      [-0.82, -1.25],
      [0.82, -1.25],
    ] as const).map(
      ([x, z], i): PartDef => ({
        id: `wheel_${i}`,
        name: "Rad",
        materialId: "contaminant", // Reifen mit Felge → Störstoff (eigene Fraktion erst V1)
        massKg: 25,
        tearSeconds: 1.2,
        grabRadius: 0.5,
        anchor: [x, 0.33, z],
        size: [0.33, 0.24],
        kind: "wheel",
        color: 0x1e2022,
      })
    ),
  ],
  windows: [
    { id: "front", anchor: [0, 1.0, 0.85], size: [1.3, 0.5], rotY: 0 },
    { id: "rear", anchor: [0, 1.0, -1.22], size: [1.3, 0.5], rotY: 0 },
    { id: "left", anchor: [-0.77, 0.98, -0.2], size: [1.8, 0.44], rotY: Math.PI / 2 },
    { id: "right", anchor: [0.77, 0.98, -0.2], size: [1.8, 0.44], rotY: Math.PI / 2 },
  ],
};
