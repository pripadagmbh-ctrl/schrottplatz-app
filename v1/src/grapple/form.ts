/**
 * Fünfzinken-Mehrschalengreifer — die Maße des exportierbaren Modells.
 *
 * Die Form kommt NICHT aus dieser Datei. Sie kommt aus
 * `src/excavator/clawGeometry.ts`, also aus derselben Quelle, aus der auch die
 * Spinne im Spiel gebaut wird: Sichelkralle aus acht Segmenten am Zapfen,
 * Stand 14.09.2026.
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
 *   offen (Spreizung 1,555)      Spitzenweite 3,3805 m, Spitzen 2,3413 m tief
 *   geschlossen (Spreizung 0,5495) Spitzen treffen sich auf der Achse
 *                                  (Restweite 0,0015 m), 2,8312 m tief
 *   Korbtiefe geschlossen 1,78 m (Spitze unter dem Lagerkranz auf −1,05)
 *
 * Die tiefste Stelle ist NICHT die geschlossene: Über den ganzen Weg abgetastet
 * liegt sie bei 2,8754 m, erreicht bei Spreizung 0,7702 — genau das ist der
 * Wert, den `GROESSTE_TIEFE` (= `CLAW_MAX_DEPTH`) meldet und aus dem der
 * Bodenanschlag kommt. Wer nach der geschlossenen Spitze absetzt, rechnet sich
 * 4 cm zu hoch.
 *
 * „Geschlossen" ist nicht mehr die Spreizung 0. Wer hier rechnet, muss ZU
 * benutzen und nicht die Null — an dieser Verwechslung hing der Fehler, der
 * die gezeichnete Schale 31 Grad neben die gerechnete stellte.
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
export const SEG_BREITE = [0.4, 0.37, 0.33, 0.28, 0.22, 0.18, 0.15, 0.13];
/** Dicke der Krallensegmente, von der Wurzel zur Spitze (m). */
export const SEG_DICKE = [0.16, 0.15, 0.135, 0.12, 0.105, 0.095, 0.085, 0.075];
/** Dicke des Verschleißblechs auf dem Rücken eines Segments (m). */
export const VERSCHLEISSBLECH = 0.045;

/**
 * Der Zapfen: Saeule von der Traverse herunter und Lagerkranz darunter (m).
 *
 * Bis zum 13.09. war das ein Torus von 0,757 m Radius mit 0,075 m Rohr — ein
 * Reifen, an dessen Aussenkante die Krallen hingen. Die Werte hier sind
 * dieselben wie in `src/excavator/grappleParts.ts`; der Zapfenradius selbst
 * kommt als GELENKRING aus der Spielgeometrie.
 */
export const ZAPFEN = { saeuleOben: 0.22, saeuleUnten: 0.26, kranzHoehe: 0.22 };
/** Mittelstück: Radius oben und unten sowie Höhe (m). */
export const MITTELSTUECK = { oben: 0.68, unten: 0.46, hoehe: 0.3, y: -0.65 };
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
 * des Öffnungsmoments und lief durch den Gussblock.
 *
 * Nachgemessen am 14.09.2026 über 21 Stützstellen des ganzen Weges, mit den
 * Rechenwegen aus `rig.ts` (`zylinderLaenge`, `zylinderNeigung`, `hebelarm`);
 * Protokoll in `docs/messungen/2026-09-14_greifer-anlenkung.md`:
 *
 *   Länge geschlossen 0,7332 m, offen 0,4571 m → Hub 0,2761 m
 *   Neigung gegen die Senkrechte höchstens 7,15° (bei ganz offen)
 *   Hebelarm 0,2848 m zu, 0,1969 m offen — nirgends unter 0,1969 m
 *   Luft zum Gussblock: Achse 0,1164 m, Rohrmantel 0,0504 m
 *
 * Sie läuft also frei am Gussblock vorbei, steht überall steiler als 7,2°, hat
 * nirgends einen Totpunkt und fährt zum SCHLIESSEN AUS — volle Kolbenfläche,
 * Momentverhältnis Schließen zu Öffnen 1,446.
 *
 * Bis zum 14.09. stand hier „bis 14° steil, nirgends weniger als 11 cm
 * Hebelarm, Faktor 1,70". Das waren die Werte vom 13.09., gesucht für den
 * breiten Gelenkring und den Schwenkbereich 0…1,25 — am Zapfen gelten sie
 * nicht mehr.
 */
export const ZYLINDERKREIS = 0.68;
export const ZYLINDER_OBEN_Y = -0.40;
export const LASCHE = { y: -0.22, z: 0.2 };
export const ROHRLAENGE = 0.28;
/** Außenradius von Rohr und Kolbenstange (m). */
export const ROHR_R = 0.066;
export const STANGE_R = 0.042;

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return CLAW_CLOSED_SPLAY + (CLAW_OPEN_SPLAY - CLAW_CLOSED_SPLAY) * t;
}
