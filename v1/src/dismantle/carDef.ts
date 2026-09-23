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

/**
 * EIN ANGEBAUTES TEIL — Stoßstange, Grill, Leuchte, Spiegel.
 *
 * Nichts davon geht je einzeln ab (anders als `PartDef`: Motor, Getriebe,
 * Räder). Alle Anbauteile landen deshalb in EINEM Netz mit Eckpunktfarben
 * (E-111) und sind im Szenengraph nicht mehr einzeln ansprechbar. Das ist der
 * Preis; dafür kostet ein Wrack 26 statt 50 Zeichenrufe.
 *
 * ANTEILE STATT METER — und zwar nur waagerecht. Damit ein neues Modell
 * (Kleinwagen, Kombi, Transporter) nur andere Maße braucht und keinen Code,
 * stehen x und z als Anteile: x vom HALBEN `chassis`-Breitenmaß, z von der
 * HALBEN `chassis`-Länge, die Breite eines Teils vom GANZEN Breitenmaß.
 *
 * Die HÖHE bleibt in Metern. Eine Stoßstange sitzt beim Kleinwagen so hoch wie
 * bei der Limousine — Stoßstangenhöhe und Scheinwerferhöhe sind in
 * Zulassungsvorschriften absolut festgelegt, nicht als Anteil der Fahrzeuglänge.
 * Wer das für ein Modell doch verschieben will, schreibt eine andere Zahl hin.
 */
export interface AnbauDef {
  name: string;
  /** [Breite als ANTEIL der Karosseriebreite, Höhe in m, Tiefe in m] */
  size: [number, number, number];
  /** [x als Anteil der HALBEN Breite, y in m, z als Anteil der HALBEN Länge] */
  anchor: [number, number, number];
  /** Auch spiegelbildlich auf der anderen Seite bauen (Leuchten, Spiegel). */
  paarweise?: boolean;
  /** sRGB-Hex; wandert in die Eckpunktfarben des gemeinsamen Netzes. */
  farbe: number;
}

/**
 * DIE KAROSSERIEMASSE — bis E-111 standen sie als `BoxGeometry(1.7, 0.55, 4.0)`
 * mitten im Code, dazu zwanzig feste Koordinaten in `baueAnbauteile`. Regel 3
 * (jede Zahl hat eine Herkunft) war damit nur halb erfüllt, und ein zweites
 * Modell hätte einen zweiten Codepfad gebraucht.
 */
export interface KarosserieDef {
  /** Chassis [Breite, Höhe, Länge] in m */
  chassis: [number, number, number];
  /** Mitte des Chassis über dem Rumpfursprung, in m */
  chassisY: number;
  /** Kabine [Breite, Höhe, Länge] in m */
  kabine: [number, number, number];
  /** Mitte der Kabine über dem Rumpfursprung, in m */
  kabineY: number;
  /** Längssitz der Kabine als Anteil der HALBEN Chassislänge (0 = Mitte) */
  kabineZ: number;
  /** Bogenradius eines Radlaufs = Radradius + diese Luft, in m */
  radlaufLuft: number;
  /** Rohrdicke des Bogens, in m */
  radlaufDicke: number;
  /** Der Bogen sitzt so viel weiter außen UND höher als die Radmitte, in m */
  radlaufVersatz: number;
  anbau: AnbauDef[];
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
  /** Chassis, Kabine, Anbauteile — alles, was das Wrack aussehen lässt */
  karosserie: KarosserieDef;
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
  /*
   * ALLE ZAHLEN HIER SIND DIE, DIE VORHER IM CODE STANDEN (E-111, reiner
   * Umbau, Abweichung null). Die Anteile stehen absichtlich als Division da:
   * So ist links die Zahl von vorher zu lesen und rechts, worauf sie sich
   * bezieht — `1.94 / 2.0` heißt „1,94 m bei 2,0 m halber Länge".
   */
  karosserie: {
    chassis: [1.7, 0.55, 4.0],
    chassisY: 0.28,
    kabine: [1.5, 0.55, 2.0],
    kabineY: 0.83,
    kabineZ: -0.2 / 2.0,
    // 0,42 m Bogen über einem 0,33 m Rad; der Bogen sitzt 1 cm weiter außen
    // und höher als die Radmitte, sonst schneidet er den Reifen.
    radlaufLuft: 0.09,
    radlaufDicke: 0.055,
    radlaufVersatz: 0.01,
    anbau: [
      { name: "Stoßstange vorn", size: [1.5 / 1.7, 0.16, 0.16], anchor: [0, 0.22, 1.94 / 2.0], farbe: 0x24262a },
      { name: "Stoßstange hinten", size: [1.5 / 1.7, 0.16, 0.16], anchor: [0, 0.22, -1.94 / 2.0], farbe: 0x24262a },
      { name: "Kühlergrill", size: [1.0 / 1.7, 0.16, 0.06], anchor: [0, 0.42, 1.92 / 2.0], farbe: 0x9aa0a6 },
      /*
       * Leuchten: Vorher trugen sie ein eigenes Material mit schwachem
       * Eigenleuchten (0x2a2418 bzw. 0x2a0806). Eckpunktfarben können kein
       * Eigenleuchten tragen, deshalb ist es hier in die Farbe hineingerechnet
       * — aufgehellt um genau diesen Betrag. Aus der Entfernung, in der man ein
       * Wrack sieht, ist das derselbe Anblick (E-111).
       */
      { name: "Scheinwerfer", size: [0.3 / 1.7, 0.16, 0.06], anchor: [0.52 / 0.85, 0.44, 1.9 / 2.0], paarweise: true, farbe: 0xfffff4 },
      { name: "Rückleuchte", size: [0.26 / 1.7, 0.18, 0.06], anchor: [0.55 / 0.85, 0.42, -1.9 / 2.0], paarweise: true, farbe: 0xb82b1e },
      // Der Spiegel steht über die Karosserie hinaus, sein Anteil ist > 1.
      { name: "Außenspiegel", size: [0.16 / 1.7, 0.1, 0.08], anchor: [0.92 / 0.85, 1.0, 0.62 / 2.0], paarweise: true, farbe: 0x24262a },
    ],
  },
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
