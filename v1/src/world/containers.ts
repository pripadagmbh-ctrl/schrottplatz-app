import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getMaterial } from "../materials/catalog";
import { maxSpeedFor } from "./scrapItems";
import { computePurity, containerValue } from "../materials/purity";
import type { ItemManager, ScrapItem } from "./scrapItems";
import type { EventBus } from "../core/events";

/**
 * Sortierziele (Design-Pivot 2026-08-27): offene **Haufen-Zonen** für die großen
 * Fraktionen (Schrott einfach draufwerfen) + 2 Kleinboxen für Kupfer/Kabel.
 * Zuordnung per Zonen-Zählung: Ein Item „zählt", sobald es (nicht gegriffen)
 * in der Zone liegt — Herausgreifen macht die Zählung rückgängig (Nachsortieren).
 */

export interface ContainerConfig {
  id: string;
  fractionId: string;
  label: string;
  /**
   * pile   offene Fläche, nur markiert — Reifendepot
   * halde  Mischschrottplatz: doppelt gesetzte, sehr hohe Wände, nach Norden offen
   * bay    Betonlego-Box (3 Wände, vorn offen) — Silos und Batteriemulde
   * box    feste Kleinbox
   * rolloff        kleiner Absetzcontainer, vom Bagger versetzbar
   * grosscontainer 40-m³-Abrollcontainer, fest — den zieht der LKW herauf
   */
  kind: "pile" | "halde" | "bay" | "box" | "rolloff" | "grosscontainer";
  x: number;
  z: number;
  /** Zonenmaße [Breite, Tiefe, Wandhöhe] */
  size: [number, number, number];
  /**
   * Wohin die offene Seite zeigt. Standard ist Westen (die Boxenreihe im
   * Osten öffnet sich zum Bagger); die Nichtmetall-Mulden im Süden öffnen
   * nach Norden.
   */
  facing?: "west" | "north" | "east";
  /**
   * Seitenwände weglassen, wo eine Nachbarmulde direkt anschließt — dort
   * genügt eine Trennwand statt zweier nebeneinanderstehender.
   */
  shareSouth?: boolean;
  shareNorth?: boolean;
  /**
   * Welche Wände eine `halde` bekommt. Ohne Angabe alle drei.
   *
   * Zwei Halden nebeneinander teilen sich eine Trennwand — die zweite
   * daneben zu stellen sähe aus wie ein Baufehler.
   */
  haldeWaende?: {
    rueck?: boolean;
    aussen?: boolean;
    /**
     * Wand auf der rechten Seite (−x).
     *
     * `true` ist der zwei Steine lange Stummel auf halber Hoehe, mit dem eine
     * Kante nur angedeutet wird. `"voll"` ist eine richtige Wand ueber die
     * ganze Tiefe und auf voller Hoehe — die neue Grenze, die aus der offenen
     * Flaeche hinter dem Bagger eine Box macht (Ansage 13.09.2026: „dann wird
     * quasi rechts eine neue Grenze gezogen, damit du quasi zwei gleiche
     * Boxen hast").
     */
    trenn?: boolean | "voll";
    nord?: boolean;
  };
  /**
   * Um wie viele Meter die Aussenwand ueber die Halde hinaus auf voller Hoehe
   * weiterlaeuft (Ansage 13.09.2026: „bei der Mischschrottseite noch 10 Meter
   * laenger hoch sein"). Erst danach laeuft sie aus.
   */
  wandPlus?: number;
  /** Rückwand weglassen — die Nachbarmulde dahinter bringt sie mit */
  shareEast?: boolean;
  shareWest?: boolean;
  /**
   * Sortierbox: eine offene Zone, die ihre Waende von den Trennsteinen
   * zwischen den Nachbarn bekommt (`Yard.buildTrennsteine`).
   *
   * Ansage 13.09.2026: „wir lassen die Container weg und nutzen die
   * Trennwaende als Mulden." Vorher standen hier Absetzcontainer; jetzt ist
   * die Flaeche selbst die Mulde, und was sie begrenzt, sind die Steinreihen,
   * die ohnehin zwischen den Behaeltern standen.
   */
  sortierbox?: boolean;
}

/**
 * Platzanordnung (Design 2026-08-29): Der Bagger steht auf (0, −1) im Zentrum.
 * LINKS (Westen) der riesige Stahlschrott-Haufen, RECHTS (Osten) die Boxen in
 * einer Reihe — alles im Schwenkbereich, damit kaum gefahren werden muss.
 */
export const CONFIGS: ContainerConfig[] = [
  /*
   * ORTSKONZEPT (Ansage 12.09.2026, aus der Sicht des Fahrers beschrieben):
   * „Der Bagger steht und schaut Richtung Janine, rechts neben mir der
   * Stahlschrottcontainer, hinter mir die Presse im Süden, und in
   * West-West-Süd-Richtung der Mischschrott."
   *
   * Janine steht bei +z, also blickt die Maschine dorthin.
   *
   * ACHTUNG, hier ist zweimal etwas schiefgegangen: Der Code nennt +z Norden
   * und +x Osten, aber wer nach +z blickt, hat +x LINKS auf dem Schirm.
   * Gemessen am 12.09.2026 durch Projektion mit der echten Spielkamera. Die
   * Himmelsrichtungen im Quelltext bilden also einen gespiegelten Kompass —
   * verlass dich nicht darauf, sondern auf diese Regel:
   *
   *   rechts vom Sitz = −x        links vom Sitz = +x
   *   vor dem Sitz    = +z        hinter dem Sitz = −z
   *
   * Daraus folgt der Platz (Ansage 12.09.2026, aus der Sicht des Fahrers):
   *
   *   hinten   Presse (an der Wand)        rechts        Stahlcontainer 40 m³
   *   rechts hinten  Reifendepot           links hinten  Mischschrott
   *   rechts vorne   sechs Absetzcontainer links vorne   Batteriemulde
   *   rechts aussen  Silos, am Büro vorbei fährt der Abholer sie ab
   *
   * Der Bagger arbeitet auf einer kurzen Linie von (−5 | −18,5) nach
   * (−5 | −13,5). Alles steht bewusst eng beieinander (Ansage 12.09.2026:
   * „Du kannst das alles viel enger aneinanderstellen, der Bagger braucht
   * nicht so viel Abstand zu der Presse") — die Untergrenze setzt der Arm
   * selbst: Unter 4,0 m kommt er gar nicht auf den Boden, und über eine Wand
   * muss die Krallenspitze 40 cm Luft behalten. Ein Ring von 4,0 bis 9,5 m fasst nicht elf Ziele, und ein
   * Umschlagbagger fährt im Betrieb ohnehin ein paar Meter hin und her.
   * Geprüft wird das in `test/reach.test.ts`.
   */

  /*
   * MISCHSCHROTT — links hinten, eine von zwei gleich grossen Boxen.
   *
   * Hier kippt jeder ab, der gemischt anliefert, und von hier holt der Bagger
   * alles Weitere. Die Wände sind doppelt gesetzt und fünf Meter hoch (Ansage
   * 12.09.2026: „da müssten natürlich die Wände doppelt sein und sehr hoch,
   * damit wir den Mischschrott auch ohne Probleme stapeln können").
   *
   * Aber nur EINE Wand, und zwar die, die ohnehin Platzgrenze ist (Ansage
   * 12.09.2026: „die natürlichen Abgrenzungen vom Mischschrott soll eigentlich
   * nur die Außenwand sein und daneben der Bagger, anders braucht's eigentlich
   * keine Abgrenzung"). Hinten übernimmt die erhöhte Südmauer.
   *
   * Auch die Rückwand zur Presse ist weg (Ansage 13.09.2026: „da, wo der
   * Mischschrott ist, da kommt einfach die Presse hin … und der Mischschrott
   * liegt einfach nur daneben, ohne dass das irgendwie abgegrenzt wird").
   * Die Presse steht damit in der Ecke und der Haufen reicht bis an sie heran.
   */
  { id: "c_mixed", fractionId: "mixed", label: "MISCHSCHROTT", kind: "halde", x: 6.2,
    z: -19.7, size: [8.0, 6.0, 5.0], wandPlus: 10.0,
    haldeWaende: { rueck: false, aussen: true, trenn: false } },

  /*
   * STAHLSCHROTT — die zweite Box, rechts neben dem Mischschrott.
   *
   * Ansage 13.09.2026: „hinter mir bzw. im Suedosten, da war ja eine Mulde
   * quasi, die wird abgerissen, die Wand wird erhoeht, die Aussenwand vom
   * Platz. Und dann wird quasi rechts eine neue Grenze gezogen, damit du
   * quasi zwei gleiche Boxen hast. Also einmal Mischschrott und dann einmal
   * Stahlschrott."
   *
   * Die alte Mulde hatte eine eigene Aussenwand und einen abgewinkelten
   * Schenkel nach rechts, 6,5 x 5,0 m und 3 m hoch. Beides faellt weg. Was
   * bleibt, ist spiegelbildlich zum Mischschrott: gleiche Groesse, gleiche
   * Wandhoehe, hinten die erhoehte Platzmauer, und statt der Ostmauer eine
   * neue Wand auf der rechten Seite. Zum Bagger hin (+z) und zum Mischschrott
   * hin (+x) bleibt sie offen.
   *
   * Die Stahlbox hat am 13.09.2026 ihre eigene Wand verloren (Ansage: „Wand
   * entfernen lassen") und ist dabei von 8 auf 4 m Breite zurueckgegangen:
   * Dort, wo sie stand, liegt jetzt die Reihe der vier Lego-Mulden. Was sie
   * haelt, ist die erhoehte Suedmauer im Ruecken.
   */
  { id: "c_steel", fractionId: "steel", label: "STAHLSCHROTT", kind: "halde", x: -5.5,
    z: -25.7, size: [4.0, 6.0, 5.0],
    haldeWaende: { rueck: false, aussen: false, nord: false, trenn: false } },

  /*
   * SCHUTT — Absetzcontainer neben der Presse, zum Vorsammeln.
   *
   * Ansage 13.09.2026: „neben der Presse kommt ein Schuttcontainer zum
   * Vorsammeln." Was beim Sortieren an Bauschutt anfaellt, soll nicht quer
   * ueber den Platz zu den Silos, sondern gleich neben der Maschine liegen —
   * von dort holt es der Abholer ab.
   *
   * Der Platz ist die Luecke zwischen Presse und Stahlbox an der Suedmauer.
   * Vier Meter Behaelter brauchen dort Raum: Die Presse beginnt bei x 1,23,
   * also muss die Stahlbox bis −3,8 zurueck. Sie ist deshalb von x −1,8 auf
   * −7,8 gewandert; es bleiben 50 cm Luft auf jeder Seite.
   */
  { id: "r_rubble", fractionId: "rubble", label: "SCHUTT", kind: "bay", x: -1.3,
    z: -26.0, size: [4.0, 4.0, 2.0], shareNorth: true },

  /*
   * GROSSTEILE — offene Fläche rechts neben der Stahlmulde.
   *
   * Ansage 12.09.2026: „neben der rechten Muldenbegrenzung würde ich Metalle,
   * die größer sind, also größere Aluminiumteile und so was, da platzieren,
   * und damit kann Lambert mit dem Radlader genau die Teile aufladen und in
   * die Silos bringen." Keine Wände: Was hier liegt, soll der Lader von der
   * Seite aufnehmen können.
   */
  /*
   * Am 13.09.2026 von (−16,6 | −22,0) nach (−20,0 | −14,0) gerueckt: Sie lag
   * genau vor den offenen Seiten der neuen Sortiermulden. Lambert haette quer
   * durch sie hindurchfahren muessen, um sie zu erreichen — und durch eine
   * Zone, in der Material liegt, faehrt er nicht. Zwischen ihr und der
   * Muldenreihe bleibt jetzt eine Gasse von 4,5 m; dort steht auch sein
   * Posten.
   */
  { id: "c_alu_gross", fractionId: "alu", label: "GROSSTEILE ALU", kind: "pile", x: -20.0,
    z: -14.0, size: [6.5, 5.0, 0] },
  /*
   * REIFENDEPOT — rechts hinten, offene Fläche ohne Wände.
   *
   * Reifen fallen ständig an und werden selten abgeholt; sie brauchen Fläche,
   * keine Mulde. Heinz kümmert sich darum (Ansage 12.09.2026).
   */
  { id: "c_tires", fractionId: "tires", label: "REIFEN", kind: "pile", x: -24.0,
    z: -25.0, size: [8.0, 7.0, 0] },

  /*
   * ABSETZCONTAINER — sechs Stück rechts vorne, in Reichweite.
   *
   * Kabel, VA, Kupfer, Alu, Zink, Messing. Beweglich, damit man sich den
   * heranzieht, mit dem man gerade arbeitet. Kupfer und Messing bleiben
   * getrennt: doppelter Preisunterschied, und wer beides in einen Behälter
   * wirft, bekommt für alles den Messingpreis.
   *
   * Das Mass kommt nicht aus dem Gefuehl, sondern aus dem Greifer (Ansage
   * 12.09.2026: „Container und Presse muessen mindestens so gross sein, dass
   * ich mit der Spinne reinfassen kann"). Offen ist die Spinne 3,38 m breit;
   * mit 30 cm Luft beidseits ergibt das die lichte Weite. Das Aussenmass liegt
   * darueber, weil die Waende Dicke haben.
   *
   * Seit die Schale die Sichelform der Vorlage hat (12.09.2026), oeffnet die
   * Spinne 3,50 statt 3,38 m — und prompt war der Container 4 cm zu klein.
   * Gefunden hat das `test/spinnenmass.test.ts`, nicht das Auge. Genau dafuer
   * steht er da: Wer an der Spinne dreht, merkt es hier. `test/spinnenmass.test.ts` haelt das
   * fest, damit kein spaeterer Umbau sie wieder zu eng macht.
   *
   * Vorher waren es 2,8 x 1,8 und zuletzt 3,6 x 2,3 m. In beiden Faellen kam
   * der Greifer offen nicht hinein: Er setzte auf den Raendern auf. Befuellen
   * ging noch — man laesst von oben fallen —, Ausraeumen nicht mehr. Ein
   * Behaelter, den man nicht leeren kann, ist eine Sackgasse.
   *
   * Der Preis steht in E-106: Bei dieser Groesse liegt die linke Spalte
   * ausserhalb des Greifrings. Sie ist beweglich (E-081) — man zieht sich den
   * Behaelter heran, mit dem man gerade arbeitet.
   */
  /*
   * ABSETZCONTAINER — fuenf Stueck, einzeln, in einer Reihe vom Bagger weg.
   *
   * Ansage 13.09.2026: „Container sollen massiver werden und sind nie
   * zusammenhaengend sondern einzeln. Neue Anordnung: Aluminium und VA am
   * naechsten zum Bagger, dann Kabel, dann Kupfer, dann Messing; Zink erstmal
   * weglassen."
   *
   * Vorher standen sie als Block 2x3 dicht beieinander bei x −7,5/−11,8 — mit
   * 4,3 m Abstand bei 4,7 m Breite beruehrten sie sich sogar. Jetzt hat jeder
   * 1,1 m Luft zum naechsten, und die Reihenfolge folgt dem Abstand zum
   * Bagger (der auf x −5 arbeitet):
   *
   *   ALU      5,0 m
   *   VA       5,5 m   — das Paar direkt neben der Maschine
   *   KABEL    5,5 m
   *   KUPFER   8,5 m
   *   MESSING  9,3 m
   *
   * Die Plaetze sind nicht gegriffen, sondern gesucht: Fuenf Behaelter von
   * 4,7 m passen ueberhaupt nicht alle in den Reichweitenring von 9,8 m um
   * die 5 m kurze Arbeitslinie — nachgerechnet blieben nur drei uebrig. Mit
   * 4,0 m gehen alle fuenf, und der Greifer passt weiterhin hinein: Er misst
   * offen 3,02 m ueber die Spitzen, lichte Weite sind 3,88 m. Dass die
   * Behaelter kleiner werden duerfen, ist die Folge davon, dass die Spinne
   * nach der Zeichnung gebaut ist statt vergroessert — vorher waren es
   * 3,38 m Spitzenweite.
   *
   * Zink faellt weg. Die Fraktion bleibt im Katalog, sie hat nur keinen
   * eigenen Behaelter mehr.
   */
  /*
   * Nachtrag 13.09.2026: zurueck zu ZWEI NEBENEINANDER, aber getrennt.
   *
   * „Ansonsten die Container so wie die angeordnet waren vorher, zwei
   * nebeneinander. Das war okay. Die sollen nur nicht zusammenhaengen. Und
   * der erste Container soll Alu sein, rechts daneben VA. Dann kommt Kabel,
   * dann Kupfer. Und ich denke, das reicht erst mal."
   *
   * Also wieder das Raster von vorher (Spalten bei x −7,3 und −11,8), nur mit
   * Luft: Die alten Behaelter waren 4,7 m breit bei 4,3 m Abstand — sie
   * beruehrten einander. Mit 4,0 m bleiben 0,5 m zwischen den Spalten und
   * 0,7 m zwischen den Reihen.
   *
   * Vier statt fuenf. Messing faellt damit weg wie vorher schon Zink; beide
   * Fraktionen bleiben im Katalog, sie haben nur keinen eigenen Behaelter.
   *
   * Reihenfolge nach der Ansage, rechts ist −x:
   *
   *   ALU    (−7,3 | −12,8)   5,1 m    VA     (−11,8 | −12,8)   9,5 m
   *   KABEL  (−7,3 | −17,5)   4,8 m    KUPFER (−11,8 | −17,5)   9,3 m
   *
   * Die Abstaende sind gesucht, nicht gegriffen: Bei x −12,2 lagen VA und
   * Kupfer mit 9,8 und 9,7 m ausserhalb des Rings von 9,5 m.
   */
  /*
   * Die vier Sortiermulden haben nur SEITENWAENDE, keine Rueckwand.
   *
   * Ansage 13.09.2026: „Rueckwaende raus, nur Seitenwaende." Es bleiben also
   * die beiden Flanken je Mulde — sie trennen die Fraktionen, und mehr braucht
   * es nicht: Der Greifer setzt von oben ein, der Radlader faehrt von vorn
   * hinein, und nach hinten haelt die Nachbarreihe.
   *
   * Die vier Mulden sind offen zu LAMBERT hin, nicht zum Bagger.
   *
   * Ansage 13.09.2026: „Lego-Mulden fuer Alu, VA, Kabel und Kupfer dort
   * hinsetzen" — und davor: „Lambert faehrt von der Ostseite ran … und macht
   * die Mulden leer." Der Bagger fuellt von oben, ueber die Wand; der Radlader
   * braucht die offene Seite, sonst kommt er mit der Schaufel nicht hinein.
   * Mit Oeffnung zum Bagger stand er hinter der Rueckwand und die Box wurde
   * nie leer (gemessen: 4 von 4 blieben liegen).
   */
  { id: "r_alu", fractionId: "alu", label: "ALU", kind: "bay", x: -10.0,
    z: -10.0, size: [4.5, 4.6, 2.0], sortierbox: true, shareEast: true },
  { id: "r_va", fractionId: "va", label: "EDELSTAHL VA", kind: "bay", x: -10.0,
    z: -14.6, size: [4.5, 4.6, 2.0], sortierbox: true, shareEast: true, shareSouth: true },
  { id: "r_cable", fractionId: "cable", label: "KABEL", kind: "bay", x: -10.0,
    z: -19.2, size: [4.5, 4.6, 2.0], sortierbox: true, shareEast: true, shareSouth: true },
  { id: "r_copper", fractionId: "copper", label: "KUPFER", kind: "bay", x: -10.0,
    z: -23.8, size: [4.5, 4.6, 2.0], sortierbox: true, shareEast: true, shareSouth: true },

  /*
   * MULDENREIHE an der Ostwand — acht statt vier.
   *
   * Bisher lagen hier vier Lagermulden, die der Radlader fuellt: Holz,
   * Baumisch, Kunststoff, VA. Dazu kommen jetzt vier fuer die Fraktionen, die
   * sortenrein angeliefert werden (Ansage 13.09.2026: „sortenreine Kipper
   * sollen direkt in den Mulden auf der Ostseite rechts kippen, nicht bei
   * mir"). Der Fahrer setzt selbst zurueck und kippt dort ab; der
   * Arbeitsbereich vor dem Bagger bleibt frei.
   *
   * Die Reihe konnte dafuer nicht laenger werden, sie war schon voll: Zwischen
   * der Suedmauer (z −28,7) und der ersten Halle (z +8,0) liegen 36,7 m, und
   * vier weitere mit dem alten Abstand von 7,0 m haetten 56 m gebraucht. Die
   * Mulden ruecken deshalb zusammen: 4,2 m Front statt 6,0 bei 4,6 m
   * Achsabstand, acht davon brauchen 36,4 m.
   *
   * Was die Front verliert, holt die TIEFE zurueck — sie kostet nichts, weil
   * die Reihe an der Wand steht und nach hinten Platz ist: 7,0 m statt 4,4.
   * Das ist kein Schoenheitsmass, sondern noetig: Die Ladeflaeche eines
   * Kippers ist 6,0 m lang, und bei 4,4 m Tiefe landete gemessen nur ein
   * Drittel der Fuhre in der Mulde, der Rest davor.
   *
   * Die Front bleibt ueber 3,02 m: Daran haengt die Spinne, die zwischen die
   * Flanken passen muss (`spinnenmass`).
   *
   * Reihenfolge von der Einfahrt her: erst die vier, die der LKW anfaehrt,
   * dann die vier, die der Radlader bedient. So kreuzt kein Anlieferer die
   * halbe Reihe, und keiner faehrt an den Reifen (x −28 .. −20) vorbei.
   */
  { id: "c_steel_lager", fractionId: "steel", label: "STAHL-LAGER", kind: "bay", x: -34.5,
    z: 5.6, size: [7.0, 4.2, 3.5], facing: "east" },
  { id: "c_alu_lager", fractionId: "alu", label: "ALU-LAGER", kind: "bay", x: -34.5,
    z: 1.0, size: [7.0, 4.2, 3.0], facing: "east" },
  { id: "c_cable_lager", fractionId: "cable", label: "KABEL-LAGER", kind: "bay", x: -34.5,
    z: -3.6, size: [7.0, 4.2, 3.0], facing: "east" },
  { id: "c_copper_lager", fractionId: "copper", label: "KUPFER-LAGER", kind: "bay", x: -34.5,
    z: -8.2, size: [7.0, 4.2, 3.0], facing: "east" },
  { id: "c_va_lager", fractionId: "va", label: "VA-LAGER", kind: "bay", x: -34.5,
    z: -12.8, size: [7.0, 4.2, 3.5], facing: "east" },
  { id: "c_wood", fractionId: "wood", label: "HOLZ", kind: "bay", x: -34.5,
    z: -17.4, size: [7.0, 4.2, 3.0], facing: "east" },
  { id: "c_rubble", fractionId: "rubble", label: "BAUMISCH", kind: "bay", x: -34.5,
    z: -22.0, size: [7.0, 4.2, 3.0], facing: "east" },
  { id: "c_plastic", fractionId: "plastic", label: "KUNSTSTOFF", kind: "bay", x: -34.5,
    z: -26.6, size: [7.0, 4.2, 3.0], facing: "east" },
];

/**
 * Die Mulde, in die eine sortenreine Fuhre dieser Fraktion gehoert.
 *
 * `null` heisst: fuer diese Fraktion gibt es keine — dann kippt der Wagen wie
 * bisher in den Mischschrott vor dem Bagger.
 */
export function lagerMuldeFuer(fractionId: string | null): ContainerConfig | null {
  if (!fractionId) return null;
  /*
   * Sortierboxen zaehlen NICHT als Lager.
   *
   * Seit dem 13.09.2026 sind die vier Sortierplaetze am Bagger ebenfalls
   * Betonlego-Mulden (`kind: "bay"`) — und stehen in CONFIGS vor der Reihe an
   * der Ostwand. Ohne diese Zeile schickte die Suche jeden sortenreinen
   * Kipper und jede Fuhre Lamberts dorthin, wo das Material schon liegt:
   * gemessen 0 von 11 Stueck im Ostlager, und Lambert trug aus der Alu-Box in
   * die Alu-Box.
   */
  return (
    CONFIGS.find(
      (c) => c.kind === "bay" && !c.sortierbox && c.fractionId === fractionId
    ) ?? null
  );
}

/** Fangbereich über einer Haufen-Zone (Zonen-Zählung + Ampel) */
const PILE_CATCH_HEIGHT = 2.4;

const WALL = 0.1;

export type AmpelState = "green" | "yellow" | "red";

class GameContainer {
  contentKg = 0;
  contaminationKg = 0;
  readonly itemIds = new Set<string>();
  private label: ContainerLabel;
  /**
   * Wo der Behälter gerade steht.
   *
   * Für Mulden und Haufen ist das die Angabe aus CONFIGS und ändert sich nie.
   * Ein Absetzcontainer dagegen wird vom Bagger über den Platz geschleift
   * (Ansage 12.09.2026) — dann wandert die Zählzone mit ihm, sonst zählte
   * weiter das Loch, an dem er einmal stand.
   */
  private px: number;
  private pz: number;
  private pyaw = 0;
  /** Der bewegliche Körper eines Absetzcontainers, sonst null. */
  private koerper: RAPIER.RigidBody | null = null;
  private group: THREE.Group;

  /** Schild nach Entfernung zur Kamera ein- oder ausblenden. */
  updateLabelDistance(camPos: THREE.Vector3): void {
    this.label.updateDistance(camPos);
  }

  constructor(
    readonly cfg: ContainerConfig,
    scene: THREE.Scene,
    world: RAPIER.World
  ) {
    const [w, d, h] = cfg.size;
    const fraction = getMaterial(cfg.fractionId);
    const gray = new THREE.MeshStandardMaterial({ color: 0x70757a, roughness: 0.8, metalness: 0.3 });
    const band = new THREE.MeshStandardMaterial({ color: fraction.color, roughness: 0.7 });

    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    scene.add(group);
    this.group = group;
    this.px = cfg.x;
    this.pz = cfg.z;

    if (cfg.kind === "halde") {
      /*
       * Mischschrottplatz: drei Wände aus doppelt gesetzten Betonlegos, fünf
       * Meter hoch, nach Norden offen.
       *
       * Doppelt heißt wirklich zwei Steinreihen hintereinander, nicht ein
       * dickerer Stein — wer ein paar Tonnen dagegen kippt, drückt eine
       * einreihige Wand um. Gebaut in Weltachsen ohne die Drehung der Mulden:
       * bei fünf Metern Höhe waere eine gedrehte Gruppe nur schwerer
       * nachzurechnen.
       */
      const [hw, hd, hh] = cfg.size;
      /*
       * Keine getönte Bodenfläche mehr (Ansage 12.09.2026: „diese Andeutung
       * von den Plätzen, die braucht's eigentlich gar nicht, das kann gerne
       * durch Dreck und Verschmutzung ersichtlich sein"). Ein Schrottplatz
       * hat keine eingefärbten Felder; er hat Spuren.
       */

      const BL = 1.5;
      const BH = 0.5;
      const BT = 0.55;
      const REIHEN = Math.round(hh / BH);
      const farben = [0x9b9b94, 0x8d8d86, 0xa4a49c, 0x94908a, 0xaaa89f].map(
        (c) => new THREE.Color(c)
      );
      const bloecke: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const nieten: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const block = new THREE.Object3D();
      const niete = new THREE.Object3D();
      let bi = 0;
      const setze = (bx: number, by: number, bz: number, alongX: boolean): void => {
        const f = farben[bi % 5]!;
        const j = (n: number): number => ((bi * 9301 + n * 49297) % 233280) / 233280 - 0.5;
        block.position.set(bx + j(1) * 0.05, by + j(2) * 0.02, bz + j(3) * 0.05);
        block.rotation.set(j(4) * 0.02, (alongX ? 0 : Math.PI / 2) + j(5) * 0.035, j(6) * 0.018);
        block.updateMatrix();
        bi++;
        bloecke.push({ m: block.matrix.clone(), f });
        for (const sv of [-0.4, 0.4]) {
          niete.position.set(alongX ? sv : 0, BH / 2 + 0.045, alongX ? 0 : sv);
          niete.updateMatrix();
          nieten.push({ m: block.matrix.clone().multiply(niete.matrix), f });
        }
      };
      /*
       * Nur die zwei Wände, die ohnehin Platzgrenze sind: hinten und die
       * Seite, die von der Maschine wegzeigt. Zum Bagger hin bleibt offen —
       * dort ist er selbst die Abgrenzung.
       *
       * Und sie hören nicht auf einen Schlag auf, sondern laufen zum offenen
       * Ende hin treppenförmig aus (Ansage 12.09.2026: „wär cool, wenn das so
       * nicht auf einmal weggeht, sondern so leicht abfallend schräg tiefer
       * wird"). Eine Wand, die mit voller Höhe endet, sieht aus wie ein
       * abgebrochenes Bauteil; eine auslaufende sieht aus, als hätte sie
       * jemand so gesetzt.
       */
      const AUSLAUF = 0.4; // Resthöhe am offenen Ende
      const reihenBei = (t: number): number =>
        Math.max(2, Math.round(REIHEN * (AUSLAUF + (1 - AUSLAUF) * t)));
      const wnd = cfg.haldeWaende ?? { rueck: true, aussen: true, trenn: true };
      for (let lage = 0; lage < 2; lage++) {
        const tt = BT * (0.5 + lage);
        // Rückwand: läuft zur Maschinenseite (−x) hin aus
        if (wnd.rueck !== false)
        for (let bx = -hw / 2 + BL / 2; bx < hw / 2 + 0.4; bx += BL) {
          const n = reihenBei((bx + hw / 2) / hw);
          for (let r = 0; r < n; r++) {
            const off = (r % 2) * (BL / 2);
            setze(bx - off, BH / 2 + r * BH, -(hd / 2 + tt), true);
          }
        }
        // Aussenwand: läuft nach vorn (+z) hin aus
        /*
         * `wandPlus` haengt vorn ein Stueck auf VOLLER Hoehe an, bevor die
         * Wand auslaeuft — beim Mischschrott zehn Meter. Ohne das endet die
         * hohe Wand dort, wo die Halde endet, und der Haufen kann nicht mehr
         * gestapelt werden, sobald er ueber sie hinauswaechst.
         */
        if (wnd.aussen !== false) {
          const plus = cfg.wandPlus ?? 0;
          for (let bz = -hd / 2 + BL / 2; bz < hd / 2 + plus + 0.4; bz += BL) {
            /*
             * Voll hoch bis drei Meter vor dem Ende, dann auslaufen — eine
             * Wand, die mit voller Hoehe abbricht, sieht aus wie ein
             * abgebrochenes Bauteil (dieselbe Regel wie ohne Verlaengerung).
             */
            const ende = hd / 2 + plus;
            const rest = ende - bz;
            const n = rest > 3 ? REIHEN : reihenBei(rest / 3);
            for (let r = 0; r < n; r++) {
              const off = (r % 2) * (BL / 2);
              setze(hw / 2 + tt, BH / 2 + r * BH, bz - off, false);
            }
          }
        }
        /*
         * Trennwand zur Maschine hin — nur noch angedeutet (Ansage
         * 12.09.2026: „ich würde aber trotzdem noch ein Element wegsetzen,
         * also wirklich nur, dass es andeutet, dass da eine Abgrenzung ist …
         * die Abgrenzung flacher zum Mischschrottplatz und nur die Hälfte
         * hoch"). Zwei Steinlängen ab der hinteren Ecke, halbe Höhe. Das
         * genügt, um die Kante zu lesen, und versperrt nichts.
         */
        /*
         * Nordwand — der abgewinkelte Schenkel (Ansage 12.09.2026: "die rechte
         * Abgrenzung wird verlaengert und nach rechts im 90-Grad-Winkel
         * erweitert, und schliesst mit Container-Positionen ab").
         *
         * Sie laeuft zur offenen Seite (−x) hin aus wie die anderen auch, und
         * sie ist der Grund, warum die Presse ueberhaupt in eine Fassung
         * passt: Aussenwand und Nordwand bilden zusammen das Winkeleisen, das
         * Presse und Stahlmulde voneinander trennt.
         */
        if (wnd.nord === true)
        for (let bx = -hw / 2 + BL / 2; bx < hw / 2 + 0.4; bx += BL) {
          // Halbe Hoehe: Sie zeigt zur Maschine, und darueber muss der Greifer
          // kommen. Auf voller Hoehe waere die Mulde dicht — gemessen reicht
          // der Arm aus dem Gang dahinter (6,2 m) auf 8,1 m ueber Grund, also
          // ueber 1,5 m locker und ueber 3,0 m gerade so.
          const n = Math.max(2, Math.round(reihenBei((bx + hw / 2) / hw) / 2));
          for (let r = 0; r < n; r++) {
            const off = (r % 2) * (BL / 2);
            setze(bx - off, BH / 2 + r * BH, hd / 2 + tt, true);
          }
        }
        const andeutung = Math.max(2, Math.round(REIHEN / 2));
        /*
         * `"voll"` ist eine richtige Wand: ganze Tiefe, volle Hoehe, und sie
         * laeuft zum offenen Ende hin aus wie die Aussenwand gegenueber. So
         * werden die beiden Boxen gleich — die eine haelt die Platzmauer, die
         * andere diese Wand, hinten beide die erhoehte Aussenmauer.
         */
        if (wnd.trenn === "voll") {
          for (let bz = -hd / 2 + BL / 2; bz < hd / 2 + 0.4; bz += BL) {
            const rest = hd / 2 - bz;
            const n = rest > 3 ? REIHEN : reihenBei(Math.max(0, rest) / 3);
            for (let r = 0; r < n; r++) {
              const off = (r % 2) * (BL / 2);
              setze(-(hw / 2 + tt), BH / 2 + r * BH, bz - off, false);
            }
          }
        } else if (wnd.trenn !== false) {
          for (let bz = -hd / 2 + BL / 2; bz < -hd / 2 + 2 * BL; bz += BL) {
            for (let r = 0; r < andeutung; r++) {
              const off = (r % 2) * (BL / 2);
              setze(-(hw / 2 + tt), BH / 2 + r * BH, bz - off, false);
            }
          }
        }
      }
      const wandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 });
      const bauen = (
        geo: THREE.BufferGeometry,
        liste: Array<{ m: THREE.Matrix4; f: THREE.Color }>
      ): void => {
        const im = new THREE.InstancedMesh(geo, wandMat, liste.length);
        liste.forEach((e, i) => {
          im.setMatrixAt(i, e.m);
          im.setColorAt(i, e.f);
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        group.add(im);
      };
      bauen(new THREE.BoxGeometry(BL, BH, BT), bloecke);
      bauen(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10), nieten);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      /*
       * Je Wand zwei Kollider, damit der Kollisionskörper dem Auslaufen folgt:
       * die geschlossene Hälfte auf voller Höhe, die auslaufende auf gut der
       * halben. Ein einziger Quader auf voller Höhe wäre eine unsichtbare Wand
       * dort, wo man die Steine schon aufhören sieht.
       */
      const halb = hh * 0.55;
      // Die angedeutete Trennwand bekommt ihren eigenen Kollider — halbe Höhe,
      // zwei Steinlängen ab der hinteren Ecke.
      if (wnd.trenn === "voll") {
        /*
         * Zwei Quader wie bei den anderen Waenden, damit der Kollider dem
         * Auslaufen folgt — ein einziger auf voller Hoehe waere eine
         * unsichtbare Wand dort, wo man die Steine schon aufhoeren sieht.
         */
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(BT, hh / 2, hd / 4).setTranslation(
            -(hw / 2 + BT),
            hh / 2,
            -hd / 4
          ),
          body
        );
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(BT, halb / 2, hd / 4).setTranslation(
            -(hw / 2 + BT),
            halb / 2,
            hd / 4
          ),
          body
        );
      } else if (wnd.trenn !== false) {
        const andeutungH = hh / 2;
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(BT, andeutungH / 2, BL).setTranslation(
            -(hw / 2 + BT),
            andeutungH / 2,
            -hd / 2 + BL
          ),
          body
        );
      }
      for (const [hoch, vorz] of [
        [hh, 1],
        [halb, -1],
      ] as Array<[number, number]>) {
        if (wnd.rueck !== false)
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(hw / 4 + BT / 2, hoch / 2, BT).setTranslation(
              (vorz * hw) / 4,
              hoch / 2,
              -(hd / 2 + BT)
            ),
            body
          );
        if (wnd.aussen !== false)
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(BT, hoch / 2, hd / 4 + BT / 2).setTranslation(
              hw / 2 + BT,
              hoch / 2,
              (-vorz * hd) / 4
            ),
            body
          );
        if (wnd.nord === true)
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(hw / 4 + BT / 2, hoch / 4, BT).setTranslation(
              (vorz * hw) / 4,
              hoch / 4,
              hd / 2 + BT
            ),
            body
          );
      }
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, hh + 1.4, cfg.z + hd / 2 + 1.0);
    } else if (cfg.kind === "bay") {
      // Betonlego-Box (Design-Wunsch 2026-08-27): drei Wände aus gestapelten
      // Beton-Legosteinen mit Noppen, vorn offen — wie auf echten Schrottplätzen.
      // Flachere Betonsteine, dafür eine Reihe mehr: wirkt weniger klotzig
      const BLOCK_L = 1.5;
      const BLOCK_H = 0.5;
      const BLOCK_T = 0.55;
      // Reihen aus der angegebenen Wandhöhe statt fest verdrahtet: Die Zahl in
      // CONFIGS hatte bisher keine Wirkung, jede Mulde bekam 5 Reihen à 0,5 m,
      // also 2,50 m Wand. Gemessen an der Armgeometrie ist das unerreichbar —
      // über der Muldenmitte (4,6 m vom Bagger) kommt die Spinne auf 1,58 m.
      const ROWS = Math.max(2, Math.round(h / BLOCK_H));
      // Fünf Grautöne statt drei: schon das lässt die Wand gebraucht
      // wirken, weil Blöcke aus verschiedenen Chargen nebeneinanderstehen.
      // Kostet nichts — die Materialien werden ohnehin geteilt.
      // Fuenf Grautoene als Exemplarfarben statt fuenf Materialien: Jede Mulde
      // stand vorher mit ein paar hundert einzeln gezeichneten Bloecken und
      // doppelt so vielen Nieten im Bild. Als zwei InstancedMesh je Mulde sind
      // es zwei Zeichenrufe — das Aussehen bleibt Block fuer Block dasselbe.
      const farben = [0x9b9b94, 0x8d8d86, 0xa4a49c, 0x94908a, 0xaaa89f].map(
        (col) => new THREE.Color(col)
      );
      const blockGeo = new THREE.BoxGeometry(BLOCK_L, BLOCK_H, BLOCK_T);
      const studGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10);
      const bloecke: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const nieten: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
      const block = new THREE.Object3D();
      const niete = new THREE.Object3D();
      let bi = 0;
      const placeBlock = (x: number, y: number, z: number, alongX: boolean): void => {
        const f = farben[bi % 5]!;
        // Jeder Block sitzt ein wenig anders — von Hand mit dem Stapler
        // gesetzt, nicht gegossen. Reiner Aufbau, keine Laufzeitkosten.
        const j = (n: number): number => (((bi * 9301 + n * 49297) % 233280) / 233280 - 0.5);
        block.position.set(x + j(1) * 0.05, y + j(2) * 0.02, z + j(3) * 0.05);
        block.rotation.set(j(4) * 0.02, (alongX ? 0 : Math.PI / 2) + j(5) * 0.035, j(6) * 0.018);
        block.updateMatrix();
        bi++;
        bloecke.push({ m: block.matrix.clone(), f });
        for (const s of [-0.4, 0.4]) {
          niete.position.set(alongX ? s : 0, BLOCK_H / 2 + 0.045, alongX ? 0 : s);
          niete.updateMatrix();
          // Block-Matrix mal lokale Matrix — dieselbe Rechnung wie vorher die
          // Eltern-Kind-Beziehung, also sitzt jede Niete unveraendert
          nieten.push({ m: block.matrix.clone().multiply(niete.matrix), f });
        }
      };
      // Wände: Ostseite + Nord + Süd. Die WESTseite bleibt offen — dorthin
      // schaut der Bagger, von dort wird eingefüllt und ausgeräumt.
      //
      // Die Rückwand steht zwei Lagen höher als die Flanken: Wer von oben
      // einfüllt, wirft regelmäßig ein Stück über die hintere Kante, und
      // dahinter ist es verloren. Vorn ändert das nichts — dort wird
      // eingefüllt, und die Reichweite des Arms haengt an der Muldenmitte.
      const REIHEN_HINTEN = ROWS + 2;
      for (let r = 0; r < REIHEN_HINTEN; r++) {
        const y = BLOCK_H / 2 + r * BLOCK_H;
        const off = (r % 2) * (BLOCK_L / 2);
        if (r < ROWS) {
          for (let x = -w / 2 + BLOCK_L / 2 - off; x < w / 2 + 0.4; x += BLOCK_L) {
            if (!cfg.shareNorth) placeBlock(x, y, d / 2 + BLOCK_T / 2, true);
            if (!cfg.shareSouth) placeBlock(x, y, -(d / 2 + BLOCK_T / 2), true);
          }
        }
        // Rückwand: entfällt, wenn die Nachbarmulde dahinter sie schon stellt
        if (!cfg.shareEast) {
          for (let z = -d / 2 + BLOCK_L / 2 - off; z < d / 2 + 0.4; z += BLOCK_L) {
            placeBlock(w / 2 + BLOCK_T / 2, y, z, false);
          }
        }
      }
      const wandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 });
      const bauen = (
        geo: THREE.BufferGeometry,
        liste: Array<{ m: THREE.Matrix4; f: THREE.Color }>
      ): void => {
        if (liste.length === 0) return;
        const im = new THREE.InstancedMesh(geo, wandMat, liste.length);
        liste.forEach((e, i) => {
          im.setMatrixAt(i, e.m);
          im.setColorAt(i, e.f);
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        group.add(im);
      };
      bauen(blockGeo, bloecke);
      bauen(studGeo, nieten);

      // Öffnung nach Norden: die ganze Mulde wird gedreht, statt die
      // Wandlogik zu verdoppeln
      if (cfg.facing === "north") group.rotation.y = Math.PI / 2;
      else if (cfg.facing === "east") group.rotation.y = Math.PI;
      // Kollider: drei Wandquader (Ostseite offen)
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      const wallH = ROWS * BLOCK_H;
      for (const sz of [-1, 1]) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(w / 2 + BLOCK_T, wallH / 2, BLOCK_T / 2).setTranslation(
            0,
            wallH / 2,
            sz * (d / 2 + BLOCK_T / 2)
          ),
          body
        );
      }
      // Rückwand-Kollider so hoch wie ihre Blöcke, sonst fliegt der Schrott
      // durch die zwei zusätzlichen Lagen hindurch
      const wallHinten = REIHEN_HINTEN * BLOCK_H;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(BLOCK_T / 2, wallHinten / 2, d / 2 + BLOCK_T).setTranslation(
          w / 2 + BLOCK_T / 2,
          wallHinten / 2,
          0
        ),
        body
      );
      this.label = new ContainerLabel(cfg.label, fraction.color);
      // Schild am hinteren (geschlossenen) Ende — so steht es nicht im Blickfeld
      this.label.sprite.position.set(cfg.x + w / 2 + 0.6, wallH + 1.1, cfg.z);
    } else if (cfg.kind === "rolloff" || cfg.kind === "grosscontainer") {
      /*
       * Absetzcontainer: flache Wanne auf zwei Kufen, Rungen außen, vorn die
       * Öse für den Haken des Abrollkippers. Er ist ein dynamischer Körper
       * und damit für den Greifer nichts anderes als ein sehr großes, sehr
       * schweres Schrottteil — der Bagger fasst ihn an und zieht ihn weg,
       * ohne dass die Greiflogik davon wissen muss.
       *
       * Kippen kann er nicht: nur die Hochachse ist freigegeben. Ein
       * umgefallener Container voller Kupfer wäre kein Spiel, sondern eine
       * Aufräumstrafe. Geschleift statt gehoben ist ohnehin das Richtige —
       * eine volle Mulde hebt kein Umschlagbagger am Greifer an.
       */
      /*
       * MASSIVER (Ansage 13.09.2026: „Container sollen massiver werden").
       *
       * Wandstaerke von 55 auf 90 mm, Kufen von 160 auf 220 mm, Rungen von
       * 120 x 70 auf 180 x 110 mm und fuenf statt drei je Laengsseite, dazu
       * ein schwererer Oberriegel. Der Behaelter liest sich damit als Stahlbau
       * und nicht als Blechkiste.
       *
       * Die lichte Weite sinkt dadurch von 3,89 auf 3,82 m — der Greifer misst
       * offen 3,02 m ueber die Spitzen, es bleiben also 40 cm auf jeder Seite.
       * `test/spinnenmass.test.ts` rechnet das mit.
       */
      const T = 0.09;
      const KUFE = 0.22;
      const stahl = new THREE.MeshStandardMaterial({
        color: fraction.color,
        roughness: 0.62,
        metalness: 0.35,
      });
      const rahmen = new THREE.MeshStandardMaterial({
        color: 0x474c52,
        roughness: 0.78,
        metalness: 0.45,
      });
      const boden = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), rahmen);
      boden.position.y = KUFE + T / 2;
      boden.castShadow = true;
      boden.receiveShadow = true;
      group.add(boden);
      for (const sx of [-1, 1]) {
        const kufe = new THREE.Mesh(new THREE.BoxGeometry(0.22, KUFE, d), rahmen);
        kufe.position.set((sx * (w - 0.3)) / 2, KUFE / 2, 0);
        kufe.castShadow = true;
        group.add(kufe);
      }
      const wandY = KUFE + T + h / 2;
      const waende: Array<[number, number, number, number]> = [
        [0, -(d / 2 - T / 2), w, T],
        [0, d / 2 - T / 2, w, T],
        [-(w / 2 - T / 2), 0, T, d],
        [w / 2 - T / 2, 0, T, d],
      ];
      for (const [wx, wz, sx, sz] of waende) {
        const wand = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), stahl);
        wand.position.set(wx, wandY, wz);
        wand.castShadow = true;
        wand.receiveShadow = true;
        group.add(wand);
      }
      // Rungen: senkrechte Profile außen auf den Längsseiten
      for (const sz of [-1, 1]) {
        for (const rx of [-w / 2 + 0.3, -w / 4, 0, w / 4, w / 2 - 0.3]) {
          const runge = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.11), rahmen);
          runge.position.set(rx, wandY, sz * (d / 2 + 0.05));
          group.add(runge);
        }
      }
      // Obere Kante als durchlaufender Riegel — daran erkennt man die Mulde
      for (const sz of [-1, 1]) {
        const kante = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, 0.13, 0.18), rahmen);
        kante.position.set(0, KUFE + T + h, sz * (d / 2));
        group.add(kante);
      }
      // Haken-Öse an der Stirnseite: ohne sie ist es eine Kiste, keine Mulde
      const oese = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 12), rahmen);
      oese.rotation.y = Math.PI / 2;
      oese.position.set(0, KUFE + T + h * 0.75, -(d / 2 + 0.16));
      group.add(oese);

      /*
       * Auch der grosse Stahlcontainer ist beweglich (Ansage 12.09.2026: „ich
       * kann die auch bewegen mit dem Bagger, natürlich, wenn sie voll sind,
       * gemäß des Gewichtes wahrscheinlich nicht mehr, vielleicht kann ich sie
       * da nur noch schieben, aber nicht mehr anheben").
       *
       * Genau so ist es gebaut: Das Eigengewicht steht in der Dichte, das
       * Ladegewicht kommt in `recount` als Zusatzmasse dazu. Ob man ihn noch
       * hebt, entscheidet damit die Physik und keine Abfrage — leer geht es,
       * voll zieht ihn die Schwerkraft aus der Spinne.
       */
      const gross = cfg.kind === "grosscontainer";
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(cfg.x, 0, cfg.z)
          // Stark gedämpft und nur um die Hochachse drehbar. Gemessen
          // (12.09.2026): Mit 1,8 rutschte die leere Wanne nach einem Ruck
          // 48 m weit bis an die Westwand — ein Schlitten, kein Container.
          // Eine Stahlwanne auf Sand kommt nach einem Meter zum Stehen.
          .setLinearDamping(6.0)
          .setAngularDamping(8.0)
          .enabledRotations(false, true, false)
      );
      const teil = (hx: number, hy: number, hz: number, x: number, y: number, z: number): void => {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz)
            // Rund 640 kg für eine 7-m³-Wanne, gut 2,4 t für den 40er — so
            // schwer, dass der Greifer sie schleift statt sie zu werfen.
            .setDensity(gross ? 620 : 300)
            .setFriction(1.4)
            .setTranslation(x, y, z),
          body
        );
      };
      teil(w / 2, (KUFE + T) / 2, d / 2, 0, (KUFE + T) / 2, 0);
      for (const [wx, wz, sx, sz] of waende) {
        teil(sx / 2, h / 2, sz / 2, wx, wandY, wz);
      }
      this.koerper = body;
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, KUFE + T + h + 0.9, cfg.z);
    } else if (cfg.kind === "pile") {
      /*
       * Offene Zone ohne jede Markierung (Ansage 12.09.2026): kein getönter
       * Boden, kein farbiger Rahmen. Nur das Schild am Pfosten sagt, wofür
       * die Fläche gedacht ist — den Rest macht der Dreck.
       */
      // Schild an Pfosten hinter der Zone
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), gray);
      pole.position.set(0, 1.15, d / 2 + 0.3);
      pole.castShadow = true;
      group.add(pole);
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, 2.9, cfg.z + d / 2 + 0.3);
    } else {
      // Kleinbox mit Wänden + Kollidern (Kupfer/Kabel)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * WALL, WALL, d + 2 * WALL), gray);
      floor.position.y = WALL / 2;
      floor.receiveShadow = true;
      group.add(floor);
      const walls: Array<[number, number, number, number]> = [
        [0, -(d / 2 + WALL / 2), w + 2 * WALL, WALL],
        [0, d / 2 + WALL / 2, w + 2 * WALL, WALL],
        [-(w / 2 + WALL / 2), 0, WALL, d],
        [w / 2 + WALL / 2, 0, WALL, d],
      ];
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid((w + 2 * WALL) / 2, WALL / 2, (d + 2 * WALL) / 2).setTranslation(0, WALL / 2, 0),
        body
      );
      for (const [wx, wz, sx, sz] of walls) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), gray);
        wall.position.set(wx, h / 2, wz);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
        const bandMesh = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, 0.22, sz + 0.02), band);
        bandMesh.position.set(wx, h - 0.11, wz);
        group.add(bandMesh);
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(sx / 2, h / 2, sz / 2).setTranslation(wx, h / 2, wz),
          body
        );
      }
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, h + 1.15, cfg.z);
    }
    scene.add(this.label.sprite);
    this.refreshLabel();
  }

  /**
   * Stellung eines beweglichen Behälters übernehmen. Einmal je Bild.
   *
   * Für alles Feststehende passiert hier nichts — die Abfrage kostet einen
   * Vergleich, und dafür steht die Position der Zone an einer einzigen
   * Stelle statt zweimal.
   */
  /**
   * Trägheit eines Behälters — dieselbe Bremse, die Schrottteile längst haben.
   *
   * Befund 12.09.2026: „die Container bewegen sich zu leicht und zittern zu
   * schnell." Die Ursache ist dieselbe wie damals beim Schrott: Die Spinne ist
   * ein kinematischer Körper. Sie überträgt beim Anstoßen praktisch beliebig
   * viel Schwung, weil der Löser eingeklemmte Körper herausdrückt, statt einen
   * Impuls zu rechnen. `ItemManager` deckelt das seit dem 11.09.2026 — aber
   * nur für seine eigenen Teile, und ein Behälter ist keines. Er bekam die
   * Bremse nie und schoss deshalb davon, wo ein Blech längst nur noch rutscht.
   *
   * Gemessen wiegt eine leere 4,2-m-Wanne 1637 kg; daraus ergibt die
   * Massenformel 1,4 m/s. Ein geschobener Container kriecht damit, statt zu
   * schlittern. Die Drehung ist enger gefasst als beim Schrott: Ein Container
   * steht auf einer Fläche und dreht sich schwerfällig, er trudelt nicht.
   */
  bremseTraegheit(): void {
    const b = this.koerper;
    if (!b || !b.isDynamic()) return;
    const grenze = maxSpeedFor(b.mass());
    const v = b.linvel();
    const quer = Math.hypot(v.x, v.z);
    if (quer > grenze) {
      const f = grenze / quer;
      // Nach unten nicht bremsen — das ist Schwerkraft, kein Stoß.
      b.setLinvel({ x: v.x * f, y: Math.min(v.y, grenze * 0.5), z: v.z * f }, true);
    }
    const a = b.angvel();
    const dreh = Math.abs(a.y);
    const DREH_MAX = 0.6; // rad/s — eine Wanne trudelt nicht
    if (dreh > DREH_MAX) {
      b.setAngvel({ x: a.x, y: (a.y / dreh) * DREH_MAX, z: a.z }, true);
    }
  }

  syncBeweglich(): void {
    const b = this.koerper;
    if (!b) return;
    const t = b.translation();
    const r = b.rotation();
    this.px = t.x;
    this.pz = t.z;
    // Nur die Hochachse ist freigegeben, also genügt der Gierwinkel
    this.pyaw = Math.atan2(2 * (r.w * r.y), 1 - 2 * r.y * r.y);
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
    const [, , h] = this.cfg.size;
    this.label.sprite.position.set(t.x, t.y + h + 1.1, t.z);
  }

  /**
   * Umriss für die Hindernisliste — nur bewegliche Behälter liefern einen.
   *
   * Feststehendes steht schon in `obstacles.ts`; bewegliche können dort nicht
   * stehen, weil die Liste statisch ist. Stattdessen melden sie sich jedes
   * Bild neu (Ansage 12.09.2026: „das sollen natürlich auch Elemente sein, die
   * Störer sind, ich darf da nicht durchfahren können").
   */
  get hindernis(): { x: number; z: number; hw: number; hd: number; top: number } | null {
    if (!this.koerper) return null;
    const [w, d, h] = this.cfg.size;
    // Gedreht geschleift: der Umriss waechst auf den Hüllkreis, statt sich zu
    // drehen — eine achsenparallele Liste kann keinen schiefen Kasten führen.
    const schief = Math.abs(Math.sin(this.pyaw)) > 0.15;
    const hw = schief ? Math.max(w, d) / 2 : w / 2;
    const hd = schief ? Math.max(w, d) / 2 : d / 2;
    return { x: this.px, z: this.pz, hw, hd, top: h + 0.2 };
  }

  /**
   * Ladegewicht als Zusatzmasse an den Körper geben.
   *
   * Damit wird ein voller Behälter von selbst zu schwer zum Anheben, ohne dass
   * es dafür eine Sonderabfrage im Greifer bräuchte.
   */
  wiegeLadung(): void {
    this.koerper?.setAdditionalMass(this.contentKg, true);
  }

  /** Wo der Behälter gerade wirklich steht — bei beweglichen wandert das. */
  get ort(): { x: number; z: number } {
    return { x: this.px, z: this.pz };
  }

  /** Liegt der Punkt in der Zone (Haufen/Bay: bis Fanghöhe; Box: bis knapp überm Rand)? */
  containsPoint(p: { x: number; y: number; z: number }, marginXZ = 0, marginY = 0.4): boolean {
    const [w, d, h] = this.cfg.size;
    // Offene Flaechen fangen bis Fanghoehe, umwandete bis Oberkante: In einer
    // 5-m-Halde liegt der Schrott sonst zur Haelfte ausserhalb der Zaehlung.
    const offen = this.cfg.kind === "pile";
    const maxY = offen ? PILE_CATCH_HEIGHT : Math.max(PILE_CATCH_HEIGHT, h) + marginY;
    const mXZ = marginXZ + (this.cfg.kind === "pile" ? 0.35 : 0);
    const [lx, lz] = this.lokal(p.x, p.z);
    return Math.abs(lx) < w / 2 + mXZ && Math.abs(lz) < d / 2 + mXZ && p.y < maxY;
  }

  /** Punkt in die Achsen des Behälters drehen — ein gezogener Container steht schief. */
  private lokal(x: number, z: number): [number, number] {
    const dx = x - this.px;
    const dz = z - this.pz;
    if (this.pyaw === 0) return [dx, dz];
    const c = Math.cos(-this.pyaw);
    const s = Math.sin(-this.pyaw);
    return [dx * c - dz * s, dx * s + dz * c];
  }

  /** Für die Abwurf-Ampel: großzügigere XZ-Zone, Höhe egal. */
  isOverhead(x: number, z: number): boolean {
    const [w, d] = this.cfg.size;
    const [lx, lz] = this.lokal(x, z);
    return Math.abs(lx) < w / 2 + 0.35 && Math.abs(lz) < d / 2 + 0.35;
  }

  get purity(): number {
    return computePurity(this.contentKg, this.contaminationKg);
  }

  get value(): number {
    return containerValue(getMaterial(this.cfg.fractionId), this.contentKg, this.contaminationKg);
  }

  setLabelVisible(v: boolean): void {
    this.label.sprite.visible = v;
  }

  /** Nach dem Verkauf: Aggregat leeren (Items wurden bereits entfernt). */
  clearAfterSale(): void {
    this.itemIds.clear();
    this.contentKg = 0;
    this.contaminationKg = 0;
    this.refreshLabel();
  }

  /**
   * Die Mulden sind zum Sortieren da, das Schild ist nur Hilfe. Es zeigt
   * darum im Normalfall bloß, wofür die Mulde ist. Erst wenn der Greifer
   * darüber steht, kommen Füllung, Sortenreinheit und Erlös dazu — dann
   * braucht man sie auch (Design-Fix 29.08.2026).
   */
  refreshLabel(ampel: AmpelState | null = null): void {
    if (ampel === null) {
      this.label.draw([this.cfg.label], null);
      return;
    }
    this.label.draw(
      [
        this.cfg.label,
        `${this.contentKg.toFixed(0)} kg · ${(this.purity * 100).toFixed(0)} %`,
        `≈ ${this.value.toFixed(0)} €`,
      ],
      ampel
    );
  }
}

/** World-Space-Label als Canvas-Sprite (Name, Füllung, Reinheit, Erlös + Ampelrahmen). */
class ContainerLabel {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement("canvas");
  private texture: THREE.CanvasTexture;

  constructor(_title: string, private fractionColor: number) {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.texture = new THREE.CanvasTexture(this.canvas);
    // Tiefentest an: das Schild gehört zur Szene und verschwindet hinter
    // Bagger oder Haufen. Ohne ihn schwebte es über allem und beherrschte
    // jede Einstellung (Design-Fix 29.08.2026).
    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(2.3, 1.15, 1);
  }

  /**
   * Sichtbarkeit nach Entfernung. Aus der Nähe wächst ein Sprite ins Bild,
   * bis es alles verdeckt — dort wird ausgeblendet, denn wer davorsteht,
   * braucht die Aufschrift nicht mehr. Von weit weg ist sie ohnehin nicht
   * zu lesen.
   */
  updateDistance(camPos: THREE.Vector3): void {
    const d = this.sprite.position.distanceTo(camPos);
    const nah = THREE.MathUtils.smoothstep(d, 4.5, 9);
    const fern = 1 - THREE.MathUtils.smoothstep(d, 38, 52);
    const a = Math.min(nah, fern);
    (this.sprite.material as THREE.SpriteMaterial).opacity = a;
    this.sprite.visible = a > 0.02;
  }

  draw(lines: string[], ampel: AmpelState | null): void {
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 128);
    const kurz = lines.length === 1;
    // Nur-Name-Schild ist flach und ruhig, das ausführliche nutzt die
    // ganze Tafel
    const h = kurz ? 52 : 128;
    const y0 = kurz ? 38 : 128;
    ctx.fillStyle = kurz ? "rgba(20,22,24,0.62)" : "rgba(20,22,24,0.82)";
    ctx.fillRect(0, 0, 256, h);
    ctx.strokeStyle =
      ampel === "green" ? "#35c24d" : ampel === "yellow" ? "#e0b528" : ampel === "red" ? "#d84a38" :
      "#" + this.fractionColor.toString(16).padStart(6, "0");
    ctx.lineWidth = ampel ? 12 : 4;
    ctx.strokeRect(0, 0, 256, h);
    ctx.fillStyle = "#e8e8e4";
    ctx.textAlign = "center";
    if (kurz) {
      ctx.font = "bold 27px Consolas, monospace";
      ctx.fillText(lines[0], 128, y0);
    } else {
      ctx.font = "bold 30px Consolas, monospace";
      ctx.fillText(lines[0], 128, 42);
      ctx.font = "24px Consolas, monospace";
      ctx.fillText(lines[1], 128, 76);
      ctx.fillText(lines[2], 128, 108);
    }
    this.sprite.scale.set(2.3, kurz ? 0.47 : 1.15, 1);
    this.sprite.center.set(0.5, kurz ? 0.79 : 0.5);
    this.texture.needsUpdate = true;
  }
}

export class ContainerManager {
  readonly containers: GameContainer[] = [];
  private hovered: GameContainer | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World, private bus: EventBus) {
    for (const cfg of CONFIGS) {
      this.containers.push(new GameContainer(cfg, scene, world));
    }
  }

  /**
   * Zonen-Zählung (alle ~10 Steps): Items den Containern zuordnen, Aggregate
   * neu berechnen, Enter/Leave-Events feuern. Gegriffene Items zählen nicht.
   */
  /**
   * Schilder nach Entfernung ein- und ausblenden und bewegliche Behälter
   * ihrer Physik nachführen. Jedes Bild aufrufen.
   */
  updateLabels(camPos: THREE.Vector3): void {
    for (const c of this.containers) {
      c.syncBeweglich();
      c.updateLabelDistance(camPos);
    }
  }

  /**
   * Trägheitsbremse für alle beweglichen Behälter — in JEDEN Physikschritt.
   *
   * Sie hing zuerst in `syncBeweglich`, und das lief nur mit der Zählung, also
   * alle paar Schritte. Gemessen half sie so gar nichts: Ein Stoß trieb die
   * 1,6-t-Wanne weiter auf 4,3 m/s, weil die Spitze längst vorbei war, wenn
   * die Bremse das nächste Mal hinsah. Eine Bremse, die nur jedes zehnte Bild
   * greift, ist keine.
   */
  bremseAlle(): void {
    for (const c of this.containers) c.bremseTraegheit();
  }

  recount(itemManager: ItemManager, grippedBodies: Set<number>): void {
    /*
     * Erst die Stellung der beweglichen Behälter holen, dann zählen. Sonst
     * zählt die Zählung gegen den Ort des vorigen Bildes — beim Schleifen
     * eines vollen Containers wandert die Zone dann eine Fuhre hinterher.
     */
    for (const c of this.containers) c.syncBeweglich();
    const changes: Array<{ item: ScrapItem; from: string | null; to: string | null }> = [];
    for (const item of itemManager.items) {
      let to: string | null = null;
      if (!grippedBodies.has(item.body.handle)) {
        const p = item.body.translation();
        for (const c of this.containers) {
          if (c.containsPoint(p)) {
            to = c.cfg.id;
            break;
          }
        }
      }
      if (to !== item.containerId) {
        changes.push({ item, from: item.containerId, to });
        item.containerId = to;
      }
    }
    if (changes.length === 0) return;

    for (const c of this.containers) {
      c.itemIds.clear();
      c.contentKg = 0;
      c.contaminationKg = 0;
    }
    for (const item of itemManager.items) {
      if (!item.containerId) continue;
      const c = this.byId(item.containerId);
      c.itemIds.add(item.id);
      c.contentKg += item.massKg;
      if (item.materialId !== c.cfg.fractionId) c.contaminationKg += item.massKg;
    }
    for (const c of this.containers) {
      c.refreshLabel(c === this.hovered ? this.hoverAmpel : null);
      c.wiegeLadung();
    }

    for (const { item, from, to } of changes) {
      if (from) this.bus.emit("itemLeft", { itemId: item.id, containerId: from });
      if (to) {
        const c = this.byId(to);
        this.bus.emit("itemEntered", {
          itemId: item.id,
          materialId: item.materialId,
          containerId: to,
          correct: item.materialId === c.cfg.fractionId,
        });
      }
    }
  }

  private hoverAmpel: AmpelState = "green";

  /**
   * Abwurf-Ampel (Briefing Kap. 5.3): Container unterm Greifer + Bewertung der
   * getragenen Ladung. Grün = alles richtig, Gelb = gemischt, Rot = alles falsch.
   */
  updateHover(sensorX: number, sensorZ: number, carriedMaterialIds: string[]): {
    container: string;
    ampel: AmpelState;
  } | null {
    let over: GameContainer | null = null;
    if (carriedMaterialIds.length > 0) {
      over = this.containers.find((c) => c.isOverhead(sensorX, sensorZ)) ?? null;
    }
    let result: { container: string; ampel: AmpelState } | null = null;
    if (over) {
      const correct = carriedMaterialIds.filter((m) => m === over.cfg.fractionId).length;
      const ampel: AmpelState =
        correct === carriedMaterialIds.length ? "green" : correct > 0 ? "yellow" : "red";
      this.hoverAmpel = ampel;
      result = { container: over.cfg.label, ampel };
    }
    if (over !== this.hovered) {
      this.hovered?.refreshLabel(null);
      over?.refreshLabel(this.hoverAmpel);
      this.hovered = over;
    } else if (over) {
      over.refreshLabel(this.hoverAmpel);
    }
    return result;
  }

  /** Zonen-Schilder ein-/ausblenden (Taste M bzw. Touch-Knopf). */
  setLabelsVisible(v: boolean): void {
    for (const c of this.containers) c.setLabelVisible(v);
  }

  /** Umrisse aller beweglichen Behälter, für `setBuildingObstacles`. */
  hindernisse(): Array<{ x: number; z: number; hw: number; hd: number; top: number; label: string }> {
    const out: Array<{ x: number; z: number; hw: number; hd: number; top: number; label: string }> = [];
    for (const c of this.containers) {
      const h = c.hindernis;
      if (h) out.push({ ...h, label: c.cfg.label });
    }
    return out;
  }

  /** Aktuelle Stellung eines Behälters, oder null wenn es ihn nicht gibt. */
  ortVon(id: string): { x: number; z: number } | null {
    const c = this.containers.find((k) => k.cfg.id === id);
    return c ? c.ort : null;
  }

  byId(id: string): GameContainer {
    const c = this.containers.find((c) => c.cfg.id === id);
    if (!c) throw new Error(`Unbekannter Container: ${id}`);
    return c;
  }

  /** Summe der prognostizierten Erlöse — die „Sortierwert"-Anzeige im HUD. */
  totalValue(): number {
    return this.containers.reduce((s, c) => s + c.value, 0);
  }
}
