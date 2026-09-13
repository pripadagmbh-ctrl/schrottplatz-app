/**
 * Fünfzinken-Mehrschalengreifer — die Maße des exportierbaren Modells.
 *
 * Die Form kommt NICHT aus dieser Datei. Sie kommt aus
 * `src/excavator/clawGeometry.ts`, also aus derselben Quelle, aus der auch die
 * Spinne im Spiel gebaut wird: Sichelkralle aus sechs Segmenten am Gelenkring,
 * Stand 12.09.2026 mittags.
 *
 * Das ist der ganze Punkt. Zwischen dem 12. und dem 13.09. gab es zeitweise
 * zwei Greifer nebeneinander — den im Spiel und einen eigenen fürs GLB — und
 * die liefen auseinander, sobald an einem von beiden etwas geändert wurde. Hier
 * stehen deshalb nur noch die Maße, die das Modell zusätzlich braucht: wie dick
 * ein Segment ist, wie groß das Mittelstück, wo die Zylinder angreifen. Alles
 * andere wird importiert.
 *
 * Nachgemessen ergibt die Kette:
 *
 *   offen (Spreizung 1,25)    Spitzenweite 3,38 m   Höhe über alles 2,30 m
 *   geschlossen (Spreizung 0) Spitzen treffen sich auf der Achse
 *   tiefste Spitze über alle Stellungen 2,35 m
 */
export {
  CLAW_COUNT as SCHALEN,
  CLAW_RING_R as GELENKRING,
  CLAW_RING_Y as RING_Y,
  CLAW_SEGMENTS as SEGMENTE,
  CLAW_SEG_LEN as SEGMENTLAENGE,
  CLAW_SEG_BEND as SEGMENTBOGEN,
  CLAW_OPEN_SPLAY as OFFEN,
  CLAW_CLOSED_SPLAY as ZU,
  CLAW_MAX_DEPTH as GROESSTE_TIEFE,
  clawPoint,
  clawSpan,
  clawWidth,
  clawTipDepth,
} from "../excavator/clawGeometry";

import { CLAW_CLOSED_SPLAY, CLAW_OPEN_SPLAY } from "../excavator/clawGeometry";

/** Breite der Krallensegmente, von der Wurzel zur Spitze (m). */
export const SEG_BREITE = [0.4, 0.37, 0.33, 0.28, 0.22, 0.15];
/** Dicke der Krallensegmente, von der Wurzel zur Spitze (m). */
export const SEG_DICKE = [0.16, 0.15, 0.135, 0.12, 0.105, 0.085];
/** Dicke des Verschleißblechs auf dem Rücken eines Segments (m). */
export const VERSCHLEISSBLECH = 0.045;

/** Rohrradius des Gelenkrings (m). */
export const RING_ROHR = 0.075;
/** Mittelstück: Radius oben und unten sowie Höhe (m). */
export const MITTELSTUECK = { oben: 0.72, unten: 0.5, hoehe: 0.4, y: -0.75 };
/** Rotator: Gehäusemaße und Höhe unter dem Adapter (m). */
export const ROTATOR = { breite: 0.5, hoehe: 0.36, y: -0.48 };

/**
 * Anlenkung der Zylinder.
 *
 * Oben am Anlenkbock über dem Mittelstück, unten an der Lasche auf dem Rücken
 * der Schale. Die Werte sind dieselben wie in `src/excavator/grappleParts.ts`,
 * damit das exportierte Modell sich nicht anders bewegt als das gespielte.
 *
 * Abgetastet, nicht gegriffen: Die Anlenkung vom 12.09. mittags hatte bei 20 %
 * Öffnung einen Totpunkt (Hebelarm 7 mm), ein Schließmoment von einem Fünftel
 * des Öffnungsmoments und lief durch den Gussblock. Diese hier läuft frei
 * daran vorbei, steht bis 14° steil, hat nirgends weniger als 11 cm Hebelarm
 * und fährt zum SCHLIESSEN AUS — volle Kolbenfläche, Faktor 1,70.
 */
export const ZYLINDERKREIS = 0.84;
export const ZYLINDER_OBEN_Y = -0.38;
export const LASCHE = { y: -0.04, z: 0.2 };
export const ROHRLAENGE = 0.28;
/** Außenradius von Rohr und Kolbenstange (m). */
export const ROHR_R = 0.066;
export const STANGE_R = 0.042;

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return CLAW_CLOSED_SPLAY + (CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * t;
}
