import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getMaterial } from "../materials/catalog";
import { maxSpeedFor } from "./scrapItems";
import { computePurity, containerValueGemischt } from "../materials/purity";
import { reihenstuecke } from "./legoreihe";
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
  /**
   * Weitere Fraktionen, die hier ebenfalls richtig liegen.
   *
   * E-010 legt zwei Paare zusammen: Kupfer + Messing in eine Mulde, Alu +
   * Zink in eine. Beide Fraktionen stehen schon im Katalog; es braucht nur
   * ein gemeinsames Ziel. Ohne dieses Feld zaehlte der halbe Inhalt als
   * Verunreinigung — Messing im Kupferbehaelter druecke die Reinheit und
   * damit den Erlös (Reinheit² , Briefing Kap. 7).
   *
   * Abgerechnet wird nach `fractionId`: Wer Kupfer und Messing zusammen
   * abgibt, bekommt fuer alles den Kupferpreis. Das ist die bewusste
   * Vereinfachung dieser Zusammenlegung.
   */
  mitFraktionen?: string[];
  /**
   * Baulich fertig, aber noch ohne Fraktion.
   *
   * Das E-Motoren-Silo steht in der Reihe (E-010), aber Material, Preis und
   * Herkunft von Elektromotoren sind offen (E-011). Es wird deshalb gebaut
   * und beschriftet, zaehlt aber nichts: kein Ziel fuer Lambert, kein Ziel
   * fuer einen sortenreinen Kipper, keine Abrechnung. Eine erfundene Fraktion
   * waere schlimmer als eine leere Box.
   */
  nurHuelle?: boolean;
  /**
   * Niedrige Schwelle auf der dem BAGGER zugewandten Seite, in Metern.
   *
   * Wunsch Patrick 14.09.2026, bestaetigt am 15.09.: „vorn niedrig zumauern,
   * damit nichts zurueckrollt — aber bei abgesenkter Kabine muss man noch
   * hineinsehen koennen." Das ist keine Geschmacksfrage, sondern eine
   * Sichtlinie, und sie ist gerechnet (`AUGPUNKT_UNTEN`, siehe unten).
   *
   * Sie ersetzt NICHT die volle Stirnwand: `shareEast` bleibt gesetzt, der
   * Greifer faehrt weiter frei von der Baggerseite hinein. Was dazukommt, ist
   * eine Bordkante.
   */
  niedrigeStirn?: number;
  /**
   * Lagermulde in der Silo-Reihe: das ENDE des Materialwegs.
   *
   * Dorthin faehrt ein sortenreiner Kipper, und dorthin traegt Lambert aus
   * den Mulden am Bagger. Bis zum 14.09.2026 wurde das aus `kind === "bay" &&
   * !sortierbox` erschlossen und haing damit an der Reihenfolge in dieser
   * Liste — wer eine Mulde davorschob, schickte den halben Verkehr an den
   * falschen Ort. Jetzt steht es dran.
   */
  lager?: boolean;
}

/**
 * Gehoert diese Fraktion in diesen Behaelter? Beruecksichtigt die
 * zusammengelegten Paare (`mitFraktionen`).
 */
export function gehoertHierhin(cfg: ContainerConfig, fractionId: string): boolean {
  return cfg.fractionId === fractionId || (cfg.mitFraktionen?.includes(fractionId) ?? false);
}

/* ------------------------------------------- Muldengeometrie, einmalig ---- */
/*
 * `size` ist in MULDENachsen angegeben, nicht in Weltachsen: `size[0]` ist die
 * Tiefe von der Oeffnung bis zur Rueckwand, `size[1]` die Laenge an der Wand
 * entlang. Solange alle Mulden nach Westen zeigten, war beides dasselbe, und
 * die Umrechnung stand an fuenf Stellen abgeschrieben.
 *
 * Mit der L-Reihe von E-028 zeigt die Haelfte der Silos nach NORDEN — dort
 * sind Tiefe und Laenge vertauscht. Jede abgeschriebene Umrechnung waere
 * damit an einem halben Platz falsch, und zwar stumm: Ein um 90 Grad
 * verdrehtes Rechteck sieht fuer sich genommen richtig aus. Deshalb steht die
 * Rechnung ab hier EINMAL, und Bau, Hindernisliste, Routen und Tests lesen
 * sie.
 */

/** Wohin die Mulde offen ist, als Einheitsvektor. Standard: nach Westen. */
export function bayOeffnung(cfg: ContainerConfig): { x: number; z: number } {
  if (cfg.facing === "north") return { x: 0, z: 1 };
  if (cfg.facing === "east") return { x: 1, z: 0 };
  return { x: -1, z: 0 };
}

/** Halbe Ausdehnung in WELTachsen — bei Oeffnung nach Norden sind sie getauscht. */
export function bayHalb(cfg: ContainerConfig): { hw: number; hd: number } {
  const [w, d] = cfg.size;
  const nord = cfg.facing === "north";
  return { hw: (nord ? d : w) / 2, hd: (nord ? w : d) / 2 };
}

/** Mitte der offenen Vorderkante — dorthin schaut der Bagger, dort faehrt der Kipper an. */
export function bayVorderkante(cfg: ContainerConfig): { x: number; z: number } {
  const o = bayOeffnung(cfg);
  const t = cfg.size[0] / 2;
  return { x: cfg.x + o.x * t, z: cfg.z + o.z * t };
}

/** Mitte der geschlossenen Rueckwand — die Seite, die an der Platzmauer steht. */
export function bayRuecken(cfg: ContainerConfig): { x: number; z: number } {
  const o = bayOeffnung(cfg);
  const t = cfg.size[0] / 2;
  return { x: cfg.x - o.x * t, z: cfg.z - o.z * t };
}

/** Drehung der Mulde um die Hochachse (0 = Oeffnung nach Westen). */
export function bayDrehung(cfg: ContainerConfig): number {
  if (cfg.facing === "north") return Math.PI / 2;
  if (cfg.facing === "east") return Math.PI;
  return 0;
}

/**
 * Platzanordnung (Design 2026-08-29): Der Bagger steht auf (0, −1) im Zentrum.
 * LINKS (Westen) der riesige Stahlschrott-Haufen, RECHTS (Osten) die Boxen in
 * einer Reihe — alles im Schwenkbereich, damit kaum gefahren werden muss.
 */
export const CONFIGS: ContainerConfig[] = [
  /*
   * PLATZORDNUNG NACH E-010 (14.09.2026) — die Ausbuchtung.
   *
   * Aus der Sicht des Fahrers beschrieben. Der Code nennt +z Norden und +x
   * Osten, aber wer nach +z blickt, hat +x LINKS auf dem Schirm (gemessen am
   * 12.09.2026 mit der Spielkamera). Es gilt also:
   *
   *   rechts vom Sitz = −x        links vom Sitz = +x
   *   vor dem Sitz    = +z        hinter dem Sitz = −z
   *
   * Der Bagger steht auf (−0,5 | −22,5) (`world/baggerstand.ts`) und schaut
   * nach Norden. Hinter ihm woelbt sich die Platzgrenze nach Sueden aus; in
   * dieser Ausbuchtung liegen die beiden Halden, nur durch niedrige
   * Trennsteine getrennt. Rechts vom Sitz (−x) die drei Mulden an der
   * Westflanke, links (+x) Presse, Muell und Reifen. Alles im Schwenkband
   * 5,8 bis 9,2 m — nachgerechnet in `test/platz.test.ts`, gezeichnet mit
   * `tools/platzkonzept.mjs`.
   *
   * Die Silo-Reihe an der Westwand liegt bewusst AUSSERHALB des Bandes. Das
   * war frueher totes Gewicht; seit die Haendler selbst in die Hallen fahren
   * und Lambert von dort in die Silos raeumt, ist es richtig (E-010): Der
   * Schwenkkreis muss nur fassen, was durch die Haende des Spielers geht.
   */

  /*
   * MISCHSCHROTT — in der Ausbuchtung, links hinter dem Bagger.
   *
   * Hier liegt der Mengenstrom. Die Halde hat keine eigenen Waende mehr: Was
   * sie haelt, ist die Ausbuchtung selbst (`yard.ts`, `BUCHT_*`), rundum
   * 4,8 m hoch. Eine zweite Wand innen daneben waere ein Baufehler.
   *
   * Bei einer Halde zaehlt die VORDERE Kante, nicht die Mitte — man graebt
   * sich von vorn hinein (E-010). Die liegt bei z −29,2 und damit 8,1 m vom
   * Sitz.
   */
  /*
   * Nachtrag 14.09.2026 abends: 6,0 m tief statt 9,0 (Ansage: „Die
   * Ausbuchtung ist vielleicht ein bisschen zu tief, die vielleicht ein
   * bisschen verkuerzen"). Die vordere Kante bleibt auf z −29,0 und damit die
   * Entfernung zum Sitz; was sich aendert, ist der Stauraum: 40,8 statt
   * 61,2 m² je Halde.
   */
  { id: "c_mixed", fractionId: "mixed", label: "MISCHSCHROTT", kind: "halde", x: 4.0,
    z: -32.0, size: [6.8, 6.0, 5.0],
    haldeWaende: { rueck: false, aussen: false, nord: false, trenn: false } },

  /*
   * STAHLSCHROTT — die zweite Halde, rechts daneben, gleich gross.
   *
   * Zwischen beiden stehen nur die Trennsteine (`yard.ts`, `TRENNSTEINE`):
   * in der Mitte 2,4 m, zu beiden Seiten auf 0,6 m ablaufend. Ansage
   * 14.09.2026: „sodass der Zugriff von Mischschrott zu Stahlschrott
   * fluessig laeuft."
   *
   * Stahl bekommt kein Silo mehr (E-010): Er ist der groesste Mengenstrom
   * und wird direkt an der Halde verladen; ein Silo dafuer waere ein Umweg.
   */
  { id: "c_steel", fractionId: "steel", label: "STAHLSCHROTT", kind: "halde", x: -3.0,
    z: -32.0, size: [6.8, 6.0, 5.0],
    haldeWaende: { rueck: false, aussen: false, nord: false, trenn: false } },

  /*
   * DIE BUNTMETALL-MULDE AN DER WESTFLANKE — rechts vom Sitz, EINE statt drei.
   *
   * Ansage Patrick 15.09.2026: „Das mit der Buntmetallmulde ist in Ordnung.
   * Das heisst, du kannst da die Mulden alle wegmachen und machst nur noch
   * eine Buntmetallmulde."
   *
   * Vorher standen hier drei: ALU + ZINK (7,28 m), KABEL (9,17 m) und
   * KUPFER + MESSING (12,26 m). Die dritte lag seit dem 14.09. ausserhalb des
   * Schwenkbands 5,8 bis 9,2 m und war damit nicht zu befuellen — der offene
   * Punkt aus E-024. Drei Mulden neben die Presse zu stellen und alle drei im
   * Band zu halten geht nicht: Zwischen Pressenrahmen (Nordkante −23,55) und
   * der aeusseren Grenze liegen keine drei Muldenlaengen.
   *
   * WAS DAS KOSTET — nachgerechnet, nicht geschaetzt (E-028):
   *
   * Verdient wird NICHT an dieser Mulde, sondern erst beim Verkauf aus dem
   * Container des Abholers (`economy/account.ts`, `sellContainer`). Dort
   * zaehlt jedes STUECK mit seiner eigenen Fraktion, und Lambert traegt jedes
   * Stueck einzeln in das Silo seiner Fraktion (`people.ts`, `muldeFuer` liest
   * `item.materialId`). Die Mulde am Bagger ist Durchgang, nicht Abrechnung.
   * Solange die SILOS getrennt bleiben, ist die Euro-Differenz aus dem
   * Zusammenlegen deshalb **genau null** — gerechnet an einer Fuhre von je
   * 100 kg Alu, Zink, Kupfer, Messing und Kabel: 437,50 € vorher wie nachher.
   *
   * Was verlorengeht, ist die AMPEL: Wer hier Kupfer ablegt, bekommt kein
   * „falsche Zone" mehr, wenn Kabel danebenliegt. Das Sortieren zwischen den
   * sechs Fraktionen verschiebt sich vom Spieler zu Lambert — und genau das
   * ist gewollt (Ansage 15.09.2026: „erstmal alles rausfischen in die Mulde
   * tun und dann spaeter entweder ich oder Lambert das sortieren").
   *
   * BATTERIEN LIEGEN MIT DRIN (Entscheidung Patrick, 15.09.2026, E-029).
   *
   * Sie hatten dasselbe Problem wie VA: ein Lagersilo, aber am Bagger kein
   * Ziel — wer einen Akku aus einem Wrack fischte, bekam ueberall „falsche
   * Zone". Vorgeschlagen war eine eigene kleine Batteriemulde (Gefahrgut, und
   * Blei im Kupfer drueckt die Reinheit); Patrick hat sich fuer die
   * gemeinsame Mulde entschieden, beide Folgen lagen ihm vor.
   *
   * WAS DAS KOSTET — gerechnet, nicht behauptet (`test/blei.test.ts`):
   *
   *  - In der MULDE: null Euro. Verdient wird beim Verkauf aus dem Container
   *    des Abholers, je Stueck nach seiner eigenen Fraktion, und Lambert
   *    traegt jeden Akku in das BATTERIEN-Silo (`people.ts`, `muldeFuer`
   *    liest `item.materialId`). Das Silo bleibt getrennt — sortiert wird auf
   *    dem Weg dorthin, nicht in der Mulde (E-028).
   *  - Wenn das Blei doch MITGEHT, also in demselben Container verkauft wird:
   *    Eine Kupferfuhre von 200 kg bringt 180,00 €; dieselbe Fuhre mit
   *    100 kg Akku dazwischen bringt 80,00 € — 100,00 € weniger, obwohl
   *    100 kg mehr drin sind (Reinheit hoch drei, `sellContainer`). Getrennt
   *    verkauft haetten die Akkus selbst 55,00 € gebracht: 235,00 € statt
   *    80,00 €, also 155,00 € Unterschied je 100 kg Blei.
   *  - Am SCHILD der Mulde: Vorher zaehlte ein Akku als Fremdstoff und drueckte
   *    500 kg Buntmetall von 1602,00 € auf 1112,50 € (Reinheit²). Jetzt steht
   *    1657,00 € da. Die Ampel warnt also nicht mehr vor Blei — das ist der
   *    Preis der Entscheidung, und er ist kein Geldbetrag, sondern ein
   *    fehlendes Signal.
   *
   * EDELSTAHL LIEGT MIT DRIN (Entscheidung Patrick, 15.09.2026). VA hatte am
   * Bagger bis heute ueberhaupt kein Ziel: Wer ihn aus einem Wrack fischte,
   * bekam ueberall „falsche Zone" — offener Punkt seit dem 14.09. Fachlich
   * ist Edelstahl kein Buntmetall, sondern legierter Stahl; deshalb heisst die
   * Mulde `BUNT + VA` und nicht „BUNTMETALL". Zwei Woerter, wie „VA-LAGER"
   * daneben, und beides ist die Abkuerzung, die auf einem Platz wirklich
   * gesagt wird. Sein Lagersilo bleibt getrennt — dort findet das Sortieren
   * statt.
   *
   * Der Preis auf dem Schild rechnet seit E-028 je Stoff einzeln
   * (`containerValueGemischt`) — sonst staende derselbe Inhalt je nach
   * gewaehlter Leitfraktion zwischen 410 € (Zink) und 3600 € (Kupfer) da.
   *
   * LAGE. x −7,6 bleibt (das ist die Flucht neben der Presse, die schon
   * stand). 6,0 m lang statt 4,0 — sie fasst jetzt, was vorher auf drei
   * Mulden lag. Die Mitte liegt auf z −19,2, also 7,83 m vom Sitz, mitten im
   * Band; ihre Suedwand endet auf −22,55 und laesst dem Pressenrahmen 1,00 m.
   * Auf der Muldenachse sind 5,56 der 6,00 m vom Sitz aus erreichbar.
   *
   * Sie hat wie ihre Vorgaenger keine Rueckwand (`shareEast`, E-006, Ansage
   * 13.09.2026: „Rueckwaende raus, nur Seitenwaende"): Der Greifer setzt von
   * oben ein, Lambert faehrt mit dem Radlader von Westen hinein.
   */
  { id: "r_bunt", fractionId: "copper",
    mitFraktionen: ["brass", "alu", "zinc", "cable", "va", "battery"],
    label: "BUNT + VA", kind: "bay", x: -7.6, z: -19.2, size: [4.2, 6.0, 2.0],
    sortierbox: true, shareEast: true, niedrigeStirn: 0.5 },

  /*
   * MUELL — nicht mehr in der Suedostecke, sondern in der Luecke zwischen
   * Kabel-Mulde und Kipperspur (15.09.2026).
   *
   * Ansage Patrick: „Die Muellmulde muss weg. Die LKWs fahren in die
   * Muellmulde und ich kann noch nicht mal die LKWs vollstaendig abladen, weil
   * ich in die Wand greife. … Sie stehen mitten im Arbeitsweg des LKWs und
   * Arbeitsbereich des Baggers."
   *
   * NACHGEMESSEN an der alten Stelle (7,0 | −27,0), gegen den echten Umriss
   * des LKW (`vehicles.ts`: Ursprung = Muldenmitte, Ladeflaeche ± bedLen/2,
   * Standflaeche ± (bedLen/2 + 1,6)):
   *
   *   Ladeflaeche im Halt        z −26,70 … −21,30 auf x 4,95 … 7,65
   *   Nordwand der Muellmulde    z −26,15 … −25,45 auf x 5,20 … 8,80
   *   → Ueberschneidung          2,45 m x 0,70 m — die Pritsche steckt in der
   *                              Wand, genau so, wie es zu sehen war.
   *   Standflaeche des Wagens    z −28,30 … −19,70
   *   → ueberdeckt die Mulde     2,65 m x 2,85 m, also fast ganz.
   *   Greifen an der SO-Ecke     Abstand Ladeflaechenecke (7,65 | −26,70) zur
   *                              Stirnwand der Mulde (x 8,45): 0,80 m. Die
   *                              offene Spinne misst 3,38 m, braucht also
   *                              1,69 m Halbmass — „ich greife in die Wand".
   *
   * DIE NEUE STELLE ist gesucht, nicht gegriffen. Frei im Schwenkband 5,8 bis
   * 9,2 m ist nach dem Umbau nur noch der Streifen zwischen der Kabel-Mulde
   * (Ostkante x −5,5) und der Kipperspur (x 2,0, Wagenflanke x 0,45):
   *
   *   Mitte (−3,2 | −14,6)   8,35 m vom Sitz — im Band
   *   Westkante x −5,0       0,50 m bis zur Kabel-Mulde
   *   Stirnwand bis x −1,05  1,50 m bis zur Flanke des Kippers (Schranke 1,40)
   *
   * z −14,6 ist dabei nicht frei gewaehlt: Die Mulde steht zwischen den
   * Oeffnungen von KABEL (Mitte z −16,7) und KUPFER + MESSING (−12,5), und
   * ihre Flanken duerfen vor keiner der beiden stehen. Bei −14,6 liegen sie
   * auf z −16,15 … −15,45 und −13,75 … −13,05 — beide Oeffnungen bleiben frei
   * (`test/platz.test.ts` tastet sie ab).
   *
   * `facing: "east"` — die geschlossene Stirnwand steht nach WESTEN, zur
   * Kabel-Mulde hin, die Oeffnung nach Osten zum Bagger und zur Kipperspur.
   * Andersherum staende eine 2,2 m hohe Wand zwischen Sitz und Mulde, und die
   * Oeffnung schaute 0,5 m weit auf die Flanke des Nachbarn.
   *
   * Sie liegt damit WESTLICH der Rueckfahrspur zum Abladeplatz (x 6,3) und
   * ausserhalb jeder Wagenflaeche. Vierte Pflichtstation (Ansage: „vor allem
   * an Mischschrott drankommen, an die Presse, an Stahlschrott und an den
   * Muell") — geprueft in `test/platz.test.ts`.
   */
  /*
   * Reifen gehoeren seit dem 14.09.2026 abends hierhin, Holz und Kunststoff
   * seit dem 15.09. (`mitFraktionen`): Ohne diese Eintraege zaehlte jedes
   * solche Stueck als Verunreinigung und druecke die Reinheit des ganzen
   * Behaelters (Briefing Kap. 7, Reinheit²). Abgerechnet wird nach
   * `fractionId`, also zum Baumisch-Satz (−0,04 €/kg) — dieselbe bewusste
   * Vereinfachung wie bei Kupfer + Messing. Der Muell am Bagger und das
   * ABFALL-Silo fassen damit genau dieselben vier Fraktionen; was der Spieler
   * hier hineinwirft, darf Lambert eins zu eins weitertragen.
   */
  { id: "r_rubble", fractionId: "rubble", mitFraktionen: ["tires", "wood", "plastic"],
    label: "MUELL", kind: "bay", x: -3.2, z: -14.6, size: [3.6, 2.4, 2.2], facing: "east" },

  /*
   * REIFEN ist ersatzlos weg (Ansage 14.09.2026 abends: „Der Reifencontainer
   * entfaellt ersatzlos"). Er stand auf (4,1 | −17,6) — genau in der Spur, in
   * der jetzt der LKW an seinen Abladeplatz zurueckstoesst. Reifen zaehlen
   * damit vorerst zum Muell; das Sortieren des Abfalls ist ausdruecklich
   * vertagt.
   */

  /*
   * DIE SILO-REIHE — ein L: neben den Hallen die Westwand hinunter, dann um
   * die Suedwestecke an der Suedmauer entlang (15.09.2026, E-028).
   *
   * Ansage Patrick: „Die Silos, die da links stehen, die sollen neben den
   * Hallen stehen und dann ums Eck ueber die Suedseite weitergehen, damit
   * links die Seite erstmal frei ist."
   *
   * LINKS UND RECHTS. Aus dem Sitz beschrieben ist +x LINKS und −x RECHTS:
   * Der Bagger schaut nach +z, und wer mit +y oben nach +z blickt, hat +x auf
   * der linken Bildhaelfte (rechts = vorn × oben = z × y = −x). Die Reihe
   * stand seit dem Morgen auf x +6,5 an der Ostwand — das ist die Seite, die
   * Patrick „links" nennt, und die wird jetzt frei.
   *
   * ZWEI SCHENKEL, je drei Silos:
   *
   *   WEST  x −36,0, Oeffnung nach OSTEN, auf z −3,4 · −8,0 · −12,6. Dieselbe
   *         Flucht wie die Hallen (deren Suedkante liegt auf z −0,10); das
   *         noerdlichste Silo haelt mit seiner Flanke auf −1,025 und laesst
   *         der Hallenwand 0,675 m.
   *   SUED  z −25,0, Oeffnung nach NORDEN, auf x −30,0 · −25,4 · −20,8.
   *
   * Die Masse sind nicht gegriffen, sondern gespiegelt: Die Ostreihe stand
   * 1,00 m vor der Mauer (Ruecken 9,50, Mauer 10,50). Westmauer −40,0 →
   * Ruecken −39,0 → Mitte −36,0. Suedmauer −29,0 → Ruecken −28,0 → Mitte
   * −25,0. Achsabstand 4,60 wie bisher.
   *
   * WARUM DREI UND DREI — und nicht vier und zwei. Beides ist nachgerechnet:
   *
   *  - Auf der Westwand allein passten SECHS (von Mitte −2,725 bis −25,725);
   *    die L-Form ist also Patricks Bild, nicht Platznot.
   *  - Mit VIER Westsilos reichte das unterste bis z −19,575 hinunter. Die
   *    Gasse der Suedreihe muss 5,0 m vor deren Oeffnung liegen, also auf
   *    z −17,0, und ein LKW ist dort 3,10 m breit — er fuehre mitten durch
   *    das vierte Silo. Bei drei endet das unterste auf −14,975 und laesst
   *    der Gasse 0,475 m Luft. Das ist die Zahl, an der die Aufteilung haengt.
    *  - Die SUEDWESTECKE bleibt frei, und das ist gerechnet, nicht vergessen:
   *    Ein Kipper, der in der Suedgasse (z −17,0) nach Westen faehrt, steht
   *    mit der Kabine 4,90 m vor seinem Haltepunkt. Bei einem Silo auf x −36,0
   *    reichte er bis −40,9 und damit 1,20 m in die Westmauer; und beim
   *    Zurueckstossen ragte er 4,90 m nach Norden in die Suedflanke des
   *    untersten Westsilos. Die Suedreihe beginnt deshalb erst auf x −30,0 —
   *    dort liegt der Wagen 1,45 m neben der Westreihe. In der Ecke wendet
   *    die Gasse; sie ist kein verlorener Platz, sondern die Kurve.
   *  - Im Osten hoert sie bei −20,8 auf. Weiter oestlich waere Platz bis zur
   *    Presse (deren Rahmen beginnt auf x −10,375, die offene Deckelklappe
   *    schwingt bis −11,85) — dort passten noch ZWEI weitere. Die Reihe kann
   *    also ohne Umbau wachsen.
   *
   * IM SCHWENKBAND liegt keines: das naechste (−20,8 | −25,0) ist 20,5 m vom
   * Sitz. Die Reihe ist bewusst draussen — dorthin wird gefahren (E-010).
   *
   * WAS AM VERLADEPLATZ HAENGT. Er zieht mit auf (−25,5 | −8,0): 7,5 m zur
   * Silo-Vorderkante (x −33,0), 7,5 m zur LKW-Spur (x −18,0). Von dort
   * erreicht der Arm den GANZEN Westschenkel (8,80 · 7,50 · 8,80 m). Die drei
   * Suedsilos nicht — sie sind 15 bis 20 m weg. Das ist kein Rueckschritt: An
   * der Ostwand waren es ebenfalls drei von sechs, und es waren dieselben drei
   * Fraktionen (Kupfer, Kabel, Alu). Ein ZWEITER Verladestand fuer den
   * Suedschenkel waere (−30,0 | −14,5) mit LKW-Spur auf z −7,0; er ist
   * gerechnet, aber nicht gebaut — der Abholer haelt an genau einem Ort, und
   * das zu aendern ist ein eigenes Paket.
   */
  { id: "c_copper_lager", fractionId: "copper", mitFraktionen: ["brass"],
    label: "KUPFER-LAGER", kind: "bay", x: -36.0, z: -3.4, size: [6.0, 4.2, 3.0],
    facing: "east", lager: true },
  { id: "c_cable_lager", fractionId: "cable", label: "KABEL-LAGER", kind: "bay",
    x: -36.0, z: -8.0, size: [6.0, 4.2, 3.0], facing: "east", lager: true },
  { id: "c_alu_lager", fractionId: "alu", mitFraktionen: ["zinc"], label: "ALU-LAGER",
    kind: "bay", x: -36.0, z: -12.6, size: [6.0, 4.2, 3.0], facing: "east", lager: true },
  /* Um die Ecke, Oeffnung nach Norden. */
  { id: "c_va_lager", fractionId: "va", label: "VA-LAGER", kind: "bay", x: -30.0,
    z: -25.0, size: [6.0, 4.2, 3.5], facing: "north", lager: true },
  { id: "c_battery", fractionId: "battery", label: "BATTERIEN", kind: "bay",
    x: -25.4, z: -25.0, size: [6.0, 4.2, 3.0], facing: "north", lager: true },
  { id: "c_rubble", fractionId: "rubble", mitFraktionen: ["tires", "wood", "plastic"],
    label: "ABFALL", kind: "bay", x: -20.8, z: -25.0, size: [6.0, 4.2, 3.0],
    facing: "north", lager: true },
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
   * Nur die Silo-Reihe zaehlt als Lager (`lager: true`).
   *
   * Die Mulden am Bagger sind ebenfalls Betonlego-Boxen und standen in dieser
   * Liste vorher davor — ohne Unterscheidung schickte die Suche jeden
   * sortenreinen Kipper und jede Fuhre Lamberts dorthin, wo das Material
   * schon liegt: gemessen 0 von 11 Stueck im Lager, und Lambert trug aus der
   * Alu-Box in die Alu-Box. Bis zum 14.09.2026 hing die Unterscheidung an
   * `!sortierbox` und damit an der Reihenfolge; jetzt steht sie am Datensatz.
   *
   * Zusammengelegte Paare zaehlen mit: Messing findet das Kupferlager
   * (`gehoertHierhin`).
   */
  return CONFIGS.find((c) => c.lager === true && gehoertHierhin(c, fractionId)) ?? null;
}

/* ------------------------------------------------- Sicht in die Mulde ---- */
/**
 * Augpunkt des Fahrers bei ABGESENKTER Kabine, in Metern ueber Grund.
 *
 * Gelesen, nicht geschaetzt: `excavator.ts` setzt `cabGroup.position.y = 1,60`
 * und den Augpunkt lokal auf 1,68 — zusammen 3,28 m. Dieselbe Zahl steht in
 * `docs/baggerkonzept.md`, Tabelle „Augpunkt Kabine: y 3,28, z 0,20 (Kabine
 * unten)". Mit Kabinenhub kaemen 2,60 m dazu; gerechnet wird mit dem
 * schlechtesten Fall, also unten.
 */
export const AUGPUNKT_UNTEN = 3.28;

/**
 * Wie breit der tote Streifen hinter einer Wand ist.
 *
 * Der Blick streift die Wandkrone und trifft den Boden erst dahinter. Aus
 * Strahlensatz: `blind = h × D / (H − h)`, mit H = Augenhoehe, h = Wandhoehe,
 * D = waagerechter Abstand vom Auge zur Wand.
 *
 * Beispiel Buntmetall-Mulde (E-028): Ihre Baggerseite laeuft von (−5,5 |
 * −22,2) bis (−5,5 | −16,2), also 5,01 bis 8,04 m vom Sitz.
 *
 *   Wandhoehe 0,50 m (EINE Lage):  blind 0,90 bis 1,45 m  →  65–79 % des
 *                                  4,20 m tiefen Bodens bleiben sichtbar
 *   Wandhoehe 1,00 m (ZWEI Lagen): blind 2,20 bis 3,53 m  →  16–48 %
 *
 * Deshalb steht dort EINE Lage und nicht zwei. Ab 1,13 m sieht man vom
 * hinteren Ende der Mulde ueberhaupt keinen Boden mehr.
 */
export function totenStreifen(wandHoehe: number, abstand: number, augHoehe = AUGPUNKT_UNTEN): number {
  if (wandHoehe >= augHoehe) return Infinity;
  return (wandHoehe * abstand) / (augHoehe - wandHoehe);
}

/* ------------------------------------------------------ Muldenwände ------ */
/** Maße eines Betonlegosteins in den Mulden (Bestand seit 27.08.2026). */
export const MULDE_STEIN = { laenge: 1.5, hoehe: 0.5, dicke: 0.55 };

/**
 * Von wo bis wo die Steinreihen einer Mulde laufen.
 *
 * Steht als eigene Funktion da, damit `test/muldenwand.test.ts` dieselben
 * Zahlen prüfen kann, die gebaut werden — der Bau selbst braucht eine Szene
 * und eine Physikwelt und ist kopflos nicht zu messen.
 *
 * Die Flanken hören an der INNENkante der Rückwand auf, die Rückwand läuft
 * dafür über die volle Breite durch (T-Stoß). Vorher überlappten sich beide
 * an der Ecke und standen zugleich an beiden Enden über — Befund 14.09.2026.
 */
export function muldenWandSpannen(
  w: number,
  d: number,
  hatRueckwand: boolean
): { flanke: [number, number]; rueck: [number, number] } {
  const T = MULDE_STEIN.dicke;
  return {
    // von der offenen Vorderkante bis an die Rückwand
    flanke: [-w / 2, w / 2],
    // quer darüber, bündig mit den Außenflächen der Flanken
    rueck: hatRueckwand ? [-(d / 2 + T), d / 2 + T] : [0, 0],
  };
}

/** Fangbereich über einer Haufen-Zone (Zonen-Zählung + Ampel) */
const PILE_CATCH_HEIGHT = 2.4;

const WALL = 0.1;

export type AmpelState = "green" | "yellow" | "red";

class GameContainer {
  contentKg = 0;
  contaminationKg = 0;
  /**
   * Was genau drinliegt, je Fraktion. Gebraucht, seit eine Mulde mehrere
   * Fraktionen fasst: Ohne diese Aufstellung muesste das Schild den ganzen
   * Inhalt zum Preis der Leitfraktion rechnen — bei der Buntmetall-Mulde
   * waere das zwischen 410 und 3600 € fuer denselben Inhalt (E-028).
   */
  readonly massen = new Map<string, number>();
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
    /*
     * Die Zaehlzone dreht mit der Mulde. `containsPoint` misst in
     * MULDENachsen (`size[0]` quer zur Wand, `size[1]` an ihr entlang); bei
     * einer nach Norden offenen Mulde sind das nicht die Weltachsen. Ohne
     * diese Zeile zaehlte ein Silo der Suedreihe ein 6,0 x 4,2 m grosses
     * Rechteck quer zu sich selbst — ein Teil in der Mulde faellt heraus,
     * eines daneben zaehlt mit. Die Halden bleiben bei 0: Sie werden
     * ausdruecklich in Weltachsen gebaut (siehe unten).
     */
    if (cfg.kind === "bay") this.pyaw = bayDrehung(cfg);

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
      const BLOCK_L = MULDE_STEIN.laenge;
      const BLOCK_H = MULDE_STEIN.hoehe;
      const BLOCK_T = MULDE_STEIN.dicke;
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
      /**
       * Einen Stein setzen. `laenge` ist die tatsächliche Länge: Ein
       * Endstein ist kürzer als ein voller, damit die Reihe an der Wandkante
       * aufhört und nicht darüber hinaus (Befund 14.09.2026).
       *
       * Gestreckt wird die Instanz, nicht die Geometrie — sonst bräuchte
       * jede Länge ihre eigene und die Mulde wieder mehr Zeichenrufe. Die
       * Noppen sitzen dafür auf einer ungestreckten Grundmatrix, sonst wären
       * sie am Endstein zu Ovalen gequetscht.
       */
      const placeBlock = (
        x: number,
        y: number,
        z: number,
        alongX: boolean,
        laenge = BLOCK_L
      ): void => {
        const f = farben[bi % 5]!;
        // Jeder Block sitzt ein wenig anders — von Hand mit dem Stapler
        // gesetzt, nicht gegossen. Reiner Aufbau, keine Laufzeitkosten.
        const j = (n: number): number => (((bi * 9301 + n * 49297) % 233280) / 233280 - 0.5);
        block.position.set(x + j(1) * 0.05, y + j(2) * 0.02, z + j(3) * 0.05);
        block.rotation.set(j(4) * 0.02, (alongX ? 0 : Math.PI / 2) + j(5) * 0.035, j(6) * 0.018);
        block.scale.set(1, 1, 1);
        block.updateMatrix();
        const ohneStreckung = block.matrix.clone();
        block.scale.set(laenge / BLOCK_L, 1, 1);
        block.updateMatrix();
        bi++;
        bloecke.push({ m: block.matrix.clone(), f });
        // Ein kurzer Stein trägt eine Noppe in der Mitte, ein langer zwei —
        // „quasi ein einzelner Legostein mit einem Element" (Ansage).
        const anteil = laenge / BLOCK_L;
        const noppen = anteil < 0.7 ? [0] : [-0.4 * anteil, 0.4 * anteil];
        for (const s of noppen) {
          niete.position.set(alongX ? s : 0, BLOCK_H / 2 + 0.045, alongX ? 0 : s);
          niete.updateMatrix();
          // Block-Matrix mal lokale Matrix — dieselbe Rechnung wie vorher die
          // Eltern-Kind-Beziehung, also sitzt jede Niete unveraendert
          nieten.push({ m: ohneStreckung.clone().multiply(niete.matrix), f });
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
      /*
       * Jede Lage wird von Wandkante zu Wandkante ausgelegt (`reihenstuecke`),
       * mit halbem Versatz in jeder zweiten Lage. Vorher lief hier eine
       * Schleife in ganzen Steinlängen mit 0,4 m Zugabe: An einer Mulde von
       * 4,2 m Front stand die versetzte Lage vorn 0,75 m über die offene
       * Kante und hinten 0,50 m über die Rückwand hinaus — „die Außenteile
       * stehen immer ab" (Befund 14.09.2026).
       */
      const spannen = muldenWandSpannen(w, d, !cfg.shareEast);
      for (let r = 0; r < REIHEN_HINTEN; r++) {
        const y = BLOCK_H / 2 + r * BLOCK_H;
        const versatz = (r % 2) * (BLOCK_L / 2);
        if (r < ROWS) {
          for (const s of reihenstuecke(spannen.flanke[0], spannen.flanke[1], BLOCK_L, versatz)) {
            if (!cfg.shareNorth) placeBlock(s.mitte, y, d / 2 + BLOCK_T / 2, true, s.laenge);
            if (!cfg.shareSouth) placeBlock(s.mitte, y, -(d / 2 + BLOCK_T / 2), true, s.laenge);
          }
        }
        // Rückwand: entfällt, wenn die Nachbarmulde dahinter sie schon stellt
        if (!cfg.shareEast) {
          for (const s of reihenstuecke(spannen.rueck[0], spannen.rueck[1], BLOCK_L, versatz)) {
            placeBlock(w / 2 + BLOCK_T / 2, y, s.mitte, false, s.laenge);
          }
        }
        /*
         * Die niedrige Schwelle auf der Baggerseite (E-028). Aus derselben
         * Quelle wie jede andere Reihe seit E-018 (`reihenstuecke`), damit der
         * letzte Stein an der Wandkante endet und nicht uebersteht.
         */
        if (cfg.niedrigeStirn && y < cfg.niedrigeStirn) {
          const bord = muldenWandSpannen(w, d, true).rueck;
          for (const s of reihenstuecke(bord[0], bord[1], BLOCK_L, versatz)) {
            placeBlock(w / 2 + BLOCK_T / 2, y, s.mitte, false, s.laenge);
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

      // Öffnung nach Norden oder Osten: die ganze Mulde wird gedreht, statt
      // die Wandlogik zu verdoppeln
      const drehung = bayDrehung(cfg);
      group.rotation.y = drehung;
      /*
       * DER KOERPER DREHT MIT — bis zum 15.09.2026 tat er das nicht.
       *
       * Die sichtbaren Steine steckten in einer gedrehten Gruppe, die
       * Kollider hingen an einem ungedrehten Koerper. Bei `facing: "east"`
       * (Drehung 180°) lag die physische Rueckwand damit genau dort, wo die
       * sichtbare OEFFNUNG war: An der Muellmulde (−3,2 | −14,6) stand eine
       * 2,2 m hohe unsichtbare Wand quer vor dem Einwurf, waehrend die
       * sichtbare Stirnwand aus Beton ohne Wirkung dastand. Dieselbe Klasse
       * Fehler wie die „unsichtbare Barriere" vom 12.09.2026 — nur diesmal
       * zwischen Bau und Physik statt zwischen Bau und Hindernisliste.
       *
       * Aufgefallen ist es beim Drehen der halben Silo-Reihe nach Norden
       * (E-028): Ohne Drehung des Koerpers haette dort JEDES Silo seine
       * Rueckwand im Weg gehabt.
       */
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(cfg.x, 0, cfg.z)
          .setRotation({ x: 0, y: Math.sin(drehung / 2), z: 0, w: Math.cos(drehung / 2) })
      );
      const wallH = ROWS * BLOCK_H;
      for (const sz of [-1, 1]) {
        // Genau so lang wie die Steine, die man sieht: von der offenen
        // Vorderkante bis an die Rückwand. Vorher stand der Kollider 0,55 m
        // länger als die Wand — vorn eine unsichtbare Barriere in der
        // Einfüllöffnung, hinten eine hinter der Rückwand.
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(w / 2, wallH / 2, BLOCK_T / 2).setTranslation(
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
      /*
       * Die niedrige Schwelle auf der Baggerseite (E-028). Sie sitzt an
       * derselben Stelle wie die volle Stirnwand, nur eine Lage hoch.
       */
      if (cfg.niedrigeStirn) {
        const hoehe = Math.max(1, Math.round(cfg.niedrigeStirn / BLOCK_H)) * BLOCK_H;
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(BLOCK_T / 2, hoehe / 2, d / 2 + BLOCK_T).setTranslation(
            w / 2 + BLOCK_T / 2,
            hoehe / 2,
            0
          ),
          body
        );
      }
      this.label = new ContainerLabel(cfg.label, fraction.color);
      /*
       * Schild am hinteren (geschlossenen) Ende — so steht es nicht im
       * Blickfeld. Die Seite kommt aus `bayRuecken`, nicht aus `+ w/2`: Bei
       * einer nach Norden oder Osten offenen Mulde stand es sonst mitten in
       * der Einfuelloeffnung.
       */
      const schild = bayRuecken(cfg);
      const auf = bayOeffnung(cfg);
      this.label.sprite.position.set(
        schild.x - auf.x * 0.6,
        wallH + 1.1,
        schild.z - auf.z * 0.6
      );
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
    /*
     * Je Stoff zu seinem eigenen Preis (E-028). `containerValue` bleibt als
     * reine Funktion bestehen und wird von den Wirtschaftstests geprueft;
     * hier zaehlt, was wirklich in der Mulde liegt.
     */
    return containerValueGemischt(
      this.massen,
      (id) => gehoertHierhin(this.cfg, id),
      (id) => getMaterial(id).sellPricePerKg
    );
  }

  setLabelVisible(v: boolean): void {
    this.label.sprite.visible = v;
  }

  /** Nach dem Verkauf: Aggregat leeren (Items wurden bereits entfernt). */
  clearAfterSale(): void {
    this.itemIds.clear();
    this.contentKg = 0;
    this.contaminationKg = 0;
    this.massen.clear();
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
      c.massen.clear();
    }
    for (const item of itemManager.items) {
      if (!item.containerId) continue;
      const c = this.byId(item.containerId);
      c.itemIds.add(item.id);
      c.contentKg += item.massKg;
      c.massen.set(item.materialId, (c.massen.get(item.materialId) ?? 0) + item.massKg);
      if (!gehoertHierhin(c.cfg, item.materialId)) c.contaminationKg += item.massKg;
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
          correct: gehoertHierhin(c.cfg, item.materialId),
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
      const correct = carriedMaterialIds.filter((m) => gehoertHierhin(over.cfg, m)).length;
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
