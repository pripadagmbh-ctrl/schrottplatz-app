/**
 * Verbundobjekt-Definitionen (Briefing Kap. 8): datengetrieben — ein neues
 * Wrack braucht nur eine neue Def + Maße, keinen Code.
 * Alle Zahlen Startwerte (SW).
 */

import { type Anteil } from "../materials/purity";

export interface PartDef {
  id: string;
  name: string;
  materialId: string;
  massKg: number;
  /** Woraus das Teil besteht — ein Rad ist Reifen plus Felge. */
  zusammensetzung?: Anteil[];
  /** Faellt beim Zerquetschen auseinander (Rad: Reifen und Felge). */
  trennbar?: boolean;
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
  /** Rumpf ohne Parts — zählt als Mischschrott auf dem Haufen */
  hullMassKg: number;
  hullMaterialId: string;
  /** Woraus der Rumpf besteht — ein Auto ist nie sortenrein. */
  hullZusammensetzung?: Anteil[];
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
  /*
   * Ein Auto ist Mischschrott — auch gepresst (Ansage 12.09.2026: „ein Auto
   * ist immer Mischschrott, da sind so viele Komponenten dran mit Sitzen und
   * so was, das kann gar kein Stahlschrott sein, auch gepresst kein
   * Stahlschrott, es bleibt Mischschrott").
   *
   * Bisher stand hier „steel", und damit zaehlte eine ausgeschlachtete
   * Karosse als sortenreiner Stahl und ging als Stahlpaket aus der Presse.
   * Die Zusammensetzung sagt, warum das nicht stimmt: Unter dem Blech stecken
   * Sitze, Verkleidung, Daemmung, Scheiben und Kabelbaum. Nach der Regel aus
   * E-065 (sortenrein erst ab 95 %) faellt das Ganze auf Mischschrott — und
   * so bleibt es auch, wenn es durch die Presse geht.
   */
  hullMaterialId: "mixed",
  hullZusammensetzung: [
    { materialId: "steel", anteil: 0.68 },
    { materialId: "plastic", anteil: 0.14 },
    { materialId: "rubble", anteil: 0.08 },
    { materialId: "alu", anteil: 0.05 },
    { materialId: "cable", anteil: 0.03 },
    { materialId: "tires", anteil: 0.02 },
  ],
  colliderHalf: [0.85, 0.55, 2.0],
  colliderYOffset: 0.55,
  crushScales: [1, 0.76, 0.55],
  glassImpactDv: 4.5,
  crushImpactDv: 7,
  parts: [
    {
      id: "engine",
      name: "Motorblock",
      /*
       * Alu, nicht Stahl (Ansage 12.09.2026: „einzelne Teile wie der Motor
       * sind Alubloecke, die, wenn man die rausreisst, hat man Aluminium").
       * Ein moderner Motorblock ist aus Aluminiumguss; das Stahlinnenleben
       * bleibt im Rumpf. Genau darum lohnt es, ihn herauszureissen, statt das
       * Auto am Stueck in die Presse zu geben.
       */
      materialId: "alu",
      massKg: 150,
      // Zäher als ein Rad: der Motor hängt an Lagern und Leitungen. Mit
      // gedrehter Spinne geht es deutlich schneller.
      tearSeconds: 2.6,
      grabRadius: 1.0,
      anchor: [0, 0.62, 1.45],
      size: [0.9, 0.42, 0.7],
      kind: "box",
      color: 0x3e4247,
    },
    {
      id: "gearbox",
      name: "Getriebe",
      // „Getriebe ist eigentlich auch Alu" (12.09.2026). Sitzt hinter dem
      // Motor und haengt weniger fest — eine Sekunde weniger Zugzeit.
      materialId: "alu",
      massKg: 70,
      tearSeconds: 1.8,
      grabRadius: 0.85,
      anchor: [0, 0.5, 0.55],
      size: [0.62, 0.4, 0.75],
      kind: "box",
      color: 0x9aa0a6,
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
        /*
         * Reifen mit Stahlfelge gehen ungetrennt in die Reifenmulde (Ansage
         * 12.09.2026: „Reifen muessen nicht zerlegt werden, es sei denn, es
         * ist ne Alufelge"). Das Trennen lohnt hier auch rechnerisch nicht:
         * Gemessen brachte ein Rad ungetrennt 160 €/t und zerlegt weniger,
         * weil die Reifen Entsorgung kosten.
         */
        materialId: "tires",
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
