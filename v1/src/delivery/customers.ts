/**
 * Kundschaft des Platzes (Briefing Kap. 26, Fassung 02.09.2026).
 *
 * Drei Gruppen liefern an, und sie unterscheiden sich in allem: Menge,
 * Material, Fahrzeug, Preiswissen, Verhandlungsstil und darin, was sie sich
 * merken.
 *
 *   PRIVAT    kleine Mengen, wechselnde Gesichter, kein Preiswissen. Bringen
 *             unwissentlich Störstoff mit und merken sich grob, ob man sie
 *             fair behandelt hat.
 *   HAENDLER  Stammfiguren aus wiederkehrenden Familien. Kennen jeden Preis,
 *             drücken hart zurück, sind lang nachtragend.
 *   GEWERBE   Betriebe, liefern sortenrein je Branche. Der Preis ist ihnen
 *             zweitrangig, entscheidend ist ein reibungsloser Ablauf.
 *
 * Ton-Leitplanke (verbindlich): Das Milieu entsteht aus Beruf, Familie und
 * Geschäft — nie aus Herkunft. Keine Gruppe wird als kriminell markiert.
 */

import {
  baueFuhre,
  rollAufbau,
  rollFuellgrad,
  type Aufbau,
  type Fahrzeugart,
} from "./fuellgrad";

export type CustomerGroup = "privat" | "haendler" | "gewerbe";

export interface CustomerProfile {
  group: CustomerGroup;
  /** Anzeigename am Fahrzeug und in Meldungen */
  name: string;
  /** Untertitel: Familie, Branche oder Herkunftsort */
  subtitle: string;
  /** Liefermenge in kg — folgt aus Füllgrad × Laderaum × Schüttdichte */
  massKg: number;
  /** Fahrzeug, mit dem er kommt — steht vor der Menge fest, denn es bestimmt sie */
  vehicle: Fahrzeugart;
  /** Aufbau der Ladefläche (nur Händler fahren Rungen oder Koffer) */
  aufbau: Aufbau;
  /** Wie voll die Ladefläche ist (0–1) — das, was der Spieler sieht */
  fuellgrad: number;
  /** Schüttdichte der Ladung in kg/m³ */
  dichte: number;
  /** Fraktion, wenn sortenrein geliefert wird; sonst null für Mischladung */
  sortedMaterial: string | null;
  /** Anteil Störstoff an der Ladung */
  contaminantShare: number;
  /** 1 = lässt sich alles gefallen, 5 = drückt hart zurück */
  hardness: number;
  /** Spruch bei der Ankunft */
  greeting: string;
}

/**
 * Die Händlerfamilien. Wiederkehrende Stammfiguren, die sich untereinander
 * kennen.
 *
 * ERSTFASSUNG — Vornamen, Alter und Marotten sind Platzhalter aus dem
 * Charakter-Briefing (Kap. 26.7, noch offen). Zum Überschreiben gedacht:
 * gesetzt sind bisher nur die Familiennamen.
 */
export interface Family {
  family: string;
  firstName: string;
  /** 1–5, wie hart verhandelt wird */
  hardness: number;
  /** Was dieser Händler typischerweise bringt */
  typical: string | null;
  greetings: string[];
}

export const FAMILIES: Family[] = [
  {
    family: "Bäring",
    firstName: "Willi",
    hardness: 5,
    typical: null,
    greetings: ["Na, was zahlst du heute?", "Ich hab was Gutes dabei.", "Der Preis von gestern gilt noch?"],
  },
  {
    family: "Lorsbach",
    firstName: "Kurt",
    hardness: 4,
    typical: "steel",
    greetings: ["Volle Fuhre, wie besprochen.", "Wiegen wir gleich?", "Steht alles bereit?"],
  },
  {
    family: "Prieser",
    firstName: "Heiner",
    hardness: 5,
    typical: null,
    greetings: ["Du kennst mich ja.", "Machen wir es kurz.", "Was geht heute?"],
  },
  {
    family: "Hardwig",
    firstName: "Rudi",
    hardness: 3,
    typical: "alu",
    greetings: ["Alles sauber getrennt.", "Nur das Gute heute.", "Wo soll ich hin?"],
  },
  {
    family: "Boxmann",
    firstName: "Ewald",
    hardness: 4,
    typical: "steel",
    greetings: ["Schwer beladen, pass auf.", "Der Kipper ist randvoll.", "Lange Fahrt gehabt."],
  },
  {
    family: "Zöllner",
    firstName: "Fritz",
    hardness: 5,
    typical: "copper",
    greetings: ["Guck erst mal rein.", "Das ist was Feines.", "Nicht drücken heute."],
  },
  {
    family: "Adorf",
    firstName: "Manni",
    hardness: 3,
    typical: null,
    greetings: ["Zusammengesammelt die Woche.", "Bisschen von allem.", "Passt das so?"],
  },
  {
    family: "Schmikatz",
    firstName: "Toni",
    hardness: 4,
    typical: "va",
    greetings: ["Sortenrein, wie immer.", "Da staunst du.", "Was bietest du?"],
  },
];

/**
 * Gewerbekunden nach Branche. Jede Branche bringt ihr eigenes Material —
 * sortenrein, weil es im Betrieb schon getrennt anfällt.
 */
export interface Trade {
  name: string;
  material: string;
  /** Anteil Beifang, der nicht zur Hauptfraktion gehört */
  beifang: number;
  greetings: string[];
}

export const TRADES: Trade[] = [
  {
    name: "Gießerei Hallmann",
    material: "steel",
    beifang: 0.25, // Schlacke kommt als Beifang mit
    greetings: ["Guss und Schlacke, wie immer.", "Der Ofen war gut ausgelastet."],
  },
  {
    name: "Dreherei Kessel",
    material: "steel",
    beifang: 0.05, // Späne sind sauber, aber ölig
    greetings: ["Späne, noch ölig.", "Frisch aus der Halle."],
  },
  {
    name: "Maschinenbau Voigt",
    material: "steel",
    beifang: 0.12,
    greetings: ["Große Teile heute, Vorsicht.", "Zwei Motoren sind dabei."],
  },
  {
    name: "Kfz-Werkstatt Rehm",
    material: "alu",
    beifang: 0.18,
    greetings: ["Felgen und Kleinkram.", "Wenig, aber gut."],
  },
  {
    name: "Elektro Sander",
    material: "cable",
    beifang: 0.15,
    greetings: ["Kabel vom Umbau.", "Kupferanteil ist ordentlich."],
  },
  {
    name: "Schlosserei Timm",
    material: "va",
    beifang: 0.06,
    greetings: ["V2A, sauber getrennt.", "Wie immer sortenrein."],
  },
  {
    name: "Abbruch Kranz",
    material: "steel",
    beifang: 0.32, // viel Störstoff aus dem Abriss
    greetings: ["Heizkörper und Rohre.", "Da ist auch Dreck dabei, ich weiß."],
  },
];

/**
 * Herkunftsorte für Privatleute: Mönchengladbacher Stadtteile und die
 * Nachbarorte am Niederrhein. Die Kundschaft kommt aus der Gegend, nicht
 * von irgendwoher — das verankert den Platz da, wo er steht.
 */
const PRIVAT_ORTE = [
  // Mönchengladbacher Stadtteile
  "aus Eicken",
  "aus Rheydt",
  "aus Hardt",
  "aus Neuwerk",
  "aus Odenkirchen",
  "aus Giesenkirchen",
  "aus Lürrip",
  "aus Waldhausen",
  "aus Windberg",
  "aus Wickrath",
  "aus Venn",
  "aus Hehn",
  "aus Holt",
  "aus Bettrath",
  "aus Schelsen",
  "vom Westend",
  "vom Bunten Garten",
  "aus dem Volksgarten",
  // Nachbarschaft
  "aus Korschenbroich",
  "aus Viersen",
  "aus Jüchen",
  "aus Wegberg",
  "aus Schwalmtal",
  "aus Willich",
  "aus Erkelenz",
];

const PRIVAT_NAMEN = [
  "Herr Kowalik",
  "Frau Dettmer",
  "Herr Sievers",
  "Frau Lindqvist",
  "Herr Baumgart",
  "Frau Öztürk",
  "Herr Reinhold",
  "Frau Waldmann",
];

const PRIVAT_SPRUECHE = [
  "Keller ausgeräumt.",
  "Was ist das denn wert?",
  "Lag alles noch in der Scheune.",
  "Meine Frau wollte das weghaben.",
  "Ist da was Gutes dabei?",
  "Sagen Sie einfach, wo hin.",
];

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Unter dieser Menge fährt niemand vor.
 *
 * Bis 15.09.2026 stand hier 600 kg — als gewürfelte Untergrenze (E-030). Seit
 * die Masse aus dem Füllgrad folgt, ist sie keine Regel mehr, sondern ein
 * Ergebnis: Ein viertelvoller PKW-Anhänger mit viel Holz und Kunststoff wiegt
 * rechnerisch 280 kg, und das ist richtig so — der Füllgrad gewinnt
 * (Ansage Patrick 15.09.2026). Geblieben ist nur die Notbremse: Wer für eine
 * Handvoll Blech den Weg auf sich nimmt, ist kein Kunde.
 *
 * SW. Betroffen ist allein der Privatmann im Viertel-Fall; jeder LKW liegt
 * um Größenordnungen darüber.
 */
export const MINDEST_FUHRE_KG = 300;

/**
 * Fahrzeug zur Kundschaft würfeln. Steht vor der Menge, weil es sie bestimmt:
 * Ein PKW-Anhänger fasst 2,4 m³, ein Kipper mit Rungen 20 m³.
 */
function rollFahrzeug(group: CustomerGroup): Fahrzeugart {
  if (group === "privat") {
    // PKW mit Anhänger oder Kastenwagen. Gelegentlich schleppt jemand ein
    // Altauto an — dann kommt der Abschleppwagen.
    return Math.random() < 0.15 ? "wrack" : "pkw";
  }
  if (group === "gewerbe") return Math.random() < 0.65 ? "kipper" : "pritsche";
  // Händler: alles unterwegs, was Räder hat
  const r = Math.random();
  return r < 0.5 ? "kipper" : r < 0.85 ? "pritsche" : "wrack";
}

/**
 * Die Ladung eines Kunden bestimmen — Füllgrad zuerst, Masse zuletzt.
 *
 * Reihenfolge (Ansage Patrick 15.09.2026): Wie voll ist die Ladefläche? Wie
 * groß ist sie bei diesem Wagen? Was wiegt das Material, das darin liegt?
 * Erst daraus kommen die Kilogramm.
 */
function fuhreFuer(
  group: CustomerGroup,
  sortedMaterial: string | null,
  contaminantShare: number
): {
  vehicle: Fahrzeugart;
  aufbau: Aufbau;
  fuellgrad: number;
  massKg: number;
  dichte: number;
} {
  const vehicle = rollFahrzeug(group);
  const aufbau = rollAufbau(group);
  const fuhre = baueFuhre({
    kind: vehicle,
    aufbau,
    fuellgrad: rollFuellgrad(group),
    hauptfraktion: sortedMaterial,
    stoerstoffAnteil: contaminantShare,
  });
  return {
    vehicle,
    aufbau,
    fuellgrad: fuhre.fuellgrad,
    massKg: Math.max(MINDEST_FUHRE_KG, fuhre.massKg),
    dichte: fuhre.dichte,
  };
}

/**
 * Nächsten Kunden würfeln.
 *
 * Die Mischung ist bewusst ungleich: Händler bringen die großen Mengen und
 * tragen den Umschlag, Privatleute sorgen für Abwechslung und Kleinkram,
 * Gewerbe liefert das sortenreine Material, mit dem sich sauber verdienen
 * lässt.
 */
export function rollCustomer(): CustomerProfile {
  const r = Math.random();
  // Weniger Privatleute (Wunsch 10.09.2026): Sie bringen Kleinkram im
  // Anhaenger, und wenn jeder Dritte einer ist, steht der Platz voller
  // Kofferraumladungen. Ein Schrottplatz lebt vom Haendler — der bringt die
  // Fuhren, an denen Schere und Presse ueberhaupt lohnen.
  if (r < 0.18) return rollPrivat();
  if (r < 0.78) return rollHaendler();
  return rollGewerbe();
}

function rollPrivat(): CustomerProfile {
  // Haushaltsauflösung ist immer gemischt, und Privatleute bringen
  // unwissentlich Störstoff mit: Holz, Kunststoff, Reifen. Der Störstoff frisst
  // Volumen und wiegt fast nichts — ihr Anhänger sieht voller aus, als er wiegt.
  const contaminantShare = 0.15 + Math.random() * 0.2;
  const fuhre = fuhreFuer("privat", null, contaminantShare);
  return {
    group: "privat",
    name: pick(PRIVAT_NAMEN),
    subtitle: pick(PRIVAT_ORTE),
    /*
     * Die Menge wird nicht mehr gewürfelt, sie wird gerechnet (Ansage Patrick
     * 15.09.2026): „Es ist halt bei Händlern halt auch nicht immer das
     * Gewicht, sondern eher das Volumen auf der Ladefläche."
     *
     * Ein PKW-Anhänger fasst 2,4 m³ (1,74 m innen × 2,0 m nutzbar × 0,69 m
     * Ladehöhe, Maße aus `vehicleModel.buildCarAndTrailer`). Voll mit
     * gemischtem Haushaltsschrott sind das rund 1,3 t, ein Viertel voll rund
     * 350 kg. Der Privatmann bleibt damit das untere Ende der Spanne, ohne
     * dass eine Zahl das anordnet.
     */
    massKg: fuhre.massKg,
    vehicle: fuhre.vehicle,
    aufbau: fuhre.aufbau,
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial: null,
    contaminantShare,
    hardness: 1,
    greeting: pick(PRIVAT_SPRUECHE),
  };
}

function rollHaendler(): CustomerProfile {
  const f = pick(FAMILIES);
  // Auch wenn er eine Vorliebe hat: der Händler nimmt mit, was er kriegt
  const sortedMaterial = f.typical && Math.random() < 0.45 ? f.typical : null;
  const contaminantShare = 0.05 + Math.random() * 0.08;
  const fuhre = fuhreFuer("haendler", sortedMaterial, contaminantShare);
  return {
    group: "haendler",
    name: f.firstName,
    subtitle: f.family,
    /*
     * „Eigentlich kommen Händler erst, wenn ihre LKWs randvoll sind."
     * Zwei von drei Fuhren sind deshalb randvoll (siehe `FUELL_GEWICHTE`).
     * Was das wiegt, hängt am Aufbau und am Material: ein flacher Kipper voll
     * Mischschrott rund 8 t, derselbe Wagen mit Rungen wäre über 12 t — da
     * geht vorher die Nutzlast aus, und dann liegt die Ladung flacher.
     */
    massKg: fuhre.massKg,
    vehicle: fuhre.vehicle,
    aufbau: fuhre.aufbau,
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial,
    contaminantShare,
    hardness: f.hardness,
    greeting: pick(f.greetings),
  };
}

function rollGewerbe(): CustomerProfile {
  const t = pick(TRADES);
  // Der Betrieb ruft, wenn sein Container voll ist — nicht, wenn der LKW voll
  // ist. Deshalb streut sein Füllgrad breiter als der des Händlers.
  const fuhre = fuhreFuer("gewerbe", t.material, t.beifang);
  return {
    group: "gewerbe",
    name: t.name,
    subtitle: "Gewerbe",
    massKg: fuhre.massKg,
    vehicle: fuhre.vehicle,
    aufbau: fuhre.aufbau,
    fuellgrad: fuhre.fuellgrad,
    dichte: fuhre.dichte,
    sortedMaterial: t.material,
    contaminantShare: t.beifang,
    hardness: 2, // sachlich, wenig Spielraum
    greeting: pick(t.greetings),
  };
}

/**
 * Fahrzeugart, die zu dieser Kundschaft passt.
 *
 * Seit 15.09.2026 steht sie schon im Profil: Das Fahrzeug bestimmt den
 * Laderaum und damit die Menge, es muss also VOR der Menge feststehen.
 *
 * HIER STAND EIN `?? rollFahrzeug(c.group)`, UND ES WAR EIN FEHLER (E-044).
 *
 * Gemeint war es als Bequemlichkeit für von Hand gebaute Profile aus Tests
 * und Tutorial. Was es tat, war schlimmer als ein Absturz: Es WÜRFELTE das
 * Fahrzeug. Ein Prüfstand, dessen einziger Zweck der Kipper ist, bekam
 * dadurch zwei Wochen lang gelegentlich eine Pritsche untergeschoben, und der
 * Wächter war trotzdem grün. Dieselbe Klasse Selbsttäuschung wie ein Wächter,
 * der `NaN` vergleicht.
 *
 * Außerdem ist ein Profil ohne Fahrzeug nicht unvollständig, sondern
 * WIDERSPRÜCHLICH: Seine Kilogramm sind aus einem Laderaum gerechnet, den es
 * angeblich nicht gibt. Da ist nichts zu retten, also wird auch nichts
 * gerettet. Das Feld ist pflichtig, der Typlauf über `test/` (E-038) setzt es
 * durch, und wer es mit einer Umtypung umgeht, bekommt es gesagt.
 */
/* ------------------------------------------------- Der Abholfahrer ------- */

/**
 * ACHIM KURTENBACH — der Fahrer, der den Container holt.
 *
 * Entscheidung Patrick, 15.09.2026: Der Abholer wird **ein wiederkehrender
 * Fahrer mit Namen** statt einer Rolle. Ausdruecklich verworfen: „mehrere,
 * wechselnd" — auf diesem Hof steht jeden Tag derselbe Wagen mit demselben
 * Mann darin, und man erkennt ihn an der Stimme, nicht am Schriftzug.
 *
 * Gebaut ist er wie die Haendlerfamilien weiter oben in dieser Datei: ein
 * Datensatz mit Namen, Milieu und Spruechen, aus dem `pick()` zieht. Keine
 * zweite Bauweise daneben.
 *
 * WER ER IST. Achim Kurtenbach, 54, faehrt den Abrollkipper fuer die
 * Spedition seines Schwagers in Wickrath (Ortsliste dieser Datei). Kommt
 * jeden Tag auf denselben Hof, kennt die Wege, redet wenig und nie umsonst.
 * Kaffeebecher in der Tuerablage, Tochter Lena macht naechstes Jahr Abitur
 * und uebt gerade Fahrstunden, und zur Dauerbaustelle auf der A61 hat er eine
 * Meinung.
 *
 * TON-LEITPLANKE (Projektregel 7, hier woertlich genommen): Das Milieu
 * entsteht aus BERUF, FAMILIE und GESCHAEFT — Standzeit, Lieferschein,
 * Fahrstunde, Stau. Nie aus Herkunft. Er ist Dienstleister und Bekannter
 * zugleich: knapp, routiniert, freundlich, nicht geschwaetzig. Kein Spruch
 * von ihm bewertet den Spieler, keiner deutet etwas an.
 *
 * WAS ER NICHT HAT (Ansage Patrick, mehrfach: „Kreislaufsachen noch nicht"):
 * keinen Preis, keinen Ruf-Wert, keine Verhandlung, kein Konto. Er hat eine
 * Stimme — mehr nicht. In diesem Abschnitt steht kein Eurozeichen.
 */
export interface Abholfahrer {
  /** Wie er sich am Funk meldet — das steht vor dem Spruch im HUD. */
  funkname: string;
  /** Vollstaendig, fuer Papiere und spaetere Verwendung am Wagen. */
  name: string;
  /** Milieu: Beruf, Familie, Geschaeft. */
  subtitle: string;
  /**
   * Ankunft AN EINEM SILO. Der Ort kommt aus dem Schild des Behaelters und
   * aus keiner zweiten Liste (E-056) — deshalb Vorlagen, keine festen Saetze.
   */
  amSchild: Array<(schild: string) => string>;
  /** Alles andere: feste Saetze je Lage. */
  sprueche: Record<Fahrerlage, string[]>;
}

/**
 * Die Lagen, in denen er etwas sagt — und nur die, die es wirklich gibt.
 *
 *   angekommen        er steht am Halteplatz und meldet, wo (E-056)
 *   wartet            es wird beladen, er hat Standzeit
 *   abfahrtVoll       beladen vom Hof
 *   abfahrtLeer       leer vom Hof — seit E-064 sichtbar als „0 kg abgeholt"
 *   containerZurueck  er hatte Platzinventar auf der Flaeche und setzt es
 *                     leer wieder ab (E-034)
 */
export type Fahrerlage =
  | "angekommen"
  | "wartet"
  | "abfahrtVoll"
  | "abfahrtLeer"
  | "containerZurueck";

export const ABHOLFAHRER: Abholfahrer = {
  funkname: "Achim",
  name: "Achim Kurtenbach",
  subtitle: "Abrollkipper, Spedition aus Wickrath",
  /*
   * Diese drei Vorlagen stehen seit E-056 im Spiel und sind am Geraet
   * abgenommen — sie bleiben Wort fuer Wort, wie sie sind. Neu ist nur, wer
   * sie sagt.
   */
  amSchild: [
    (s) => `Bin am ${s}.`,
    (s) => `Steh am ${s}, kannst kommen.`,
    (s) => `${s}, ich warte.`,
  ],
  sprueche: {
    // Ankunft ohne Schild: vorn beim Bagger, wo kein Silo steht. Ebenfalls
    // seit E-056 unveraendert.
    angekommen: [
      "Bin vorn bei dir, Motor laeuft.",
      "Steh am Abladeplatz, lad auf.",
      "Bin da, laengsseits wie immer.",
    ],
    // Standzeit. Er draengelt nicht — Draengeln waere eine Aufforderung, und
    // der Spieler soll hier in Ruhe arbeiten koennen.
    wartet: [
      "Lass dir Zeit, ich hab noch Standzeit.",
      "Kaffee ist noch warm, mach in Ruhe.",
      "Pack ruhig voll, die Achsen halten das.",
      "Ich warte. Die A61 ist eh wieder dicht.",
    ],
    abfahrtVoll: [
      "Passt so. Bis morgen, selbe Zeit.",
      "Ist gesichert, ich fahr raus.",
      "Gute Fuhre. Ich melde mich.",
      "Muss los, Lena hat gleich Fahrstunde.",
    ],
    // Leer wieder raus (E-064). Kein Vorwurf: Eine Leerfahrt ist sein
    // Berufsrisiko, nicht das Versagen des Spielers.
    abfahrtLeer: [
      "Leer wieder raus. Kommt vor.",
      "Nichts drin. Ruf an, wenn was liegt.",
      "Dann schreib ich Standzeit auf.",
      "Kein Gramm drauf. Bis morgen.",
    ],
    // Platzinventar (E-034): Der Muellcontainer faehrt nicht mit. Er kippt
    // ihn aus und setzt die leere Wanne wieder ab.
    containerZurueck: [
      "Wanne ist leer, steht wieder bei dir.",
      "Abfall ist runter, Wanne steht vorn.",
      "Ausgekippt. Die Wanne steht wieder da.",
    ],
  },
};

/**
 * Was Achim in dieser Lage durchgibt.
 *
 * Man darf es UEBERHOEREN. Eine Zeile im Durchlauf, nichts zum Wegklicken,
 * nichts, was stehen bleibt — wer nicht hinhoert, sucht halt.
 *
 * DER ORT KOMMT AUS DEM SCHILD, nicht aus einer zweiten Liste (E-056).
 * Uebergeben wird das `label` des Behaelters, also genau das, was an der
 * Mulde steht; ein neues Silo bekommt seinen Spruch damit von selbst richtig.
 * Bei einer Abholung ohne Lagersilo (Stahlschrott, Mischschrott, „Gemischt")
 * ist es `null` — dann steht er vorn beim Bagger. Das Schild zaehlt nur bei
 * der Ankunft: Wo er steht, ist beim Losfahren keine Frage mehr.
 *
 * Ton: Funkverkehr auf einem Platz, kein Ansagetext. Kurz, gesprochen, aus
 * dem Mund eines Fahrers, der seit dreissig Jahren Container faehrt.
 */
export function fahrerfunk(lage: Fahrerlage, schild: string | null = null): string {
  if (lage === "angekommen" && schild) return pick(ABHOLFAHRER.amSchild)(schild);
  return pick(ABHOLFAHRER.sprueche[lage]);
}

/**
 * Die Ankunftsmeldung — der Fall, den es seit E-056 gibt.
 *
 * Bleibt als eigener Name stehen, weil genau an ihm die Kopplung an das
 * Schild haengt und `test/abholplatz.test.ts` sie dort prueft.
 */
export function abholerFunk(schild: string | null): string {
  return fahrerfunk("angekommen", schild);
}

/*
 * HIER STAND `ABHOLER_FUNKNAME = "Abholer"` — eine Rolle, kein Mensch.
 *
 * Ersatzlos gestrichen und nicht etwa auf „Achim" umgebogen: Wer da funkt,
 * steht seit dem 15.09.2026 in `ABHOLFAHRER.funkname`, und zwei Namen fuer
 * denselben Mann sind genau die zweite Liste, die beim naechsten Umbau
 * zurueckbleibt.
 */

export function vehicleForCustomer(c: CustomerProfile): Fahrzeugart {
  if (!c.vehicle) {
    throw new Error(
      `Kundenprofil ohne Fahrzeug: "${c.name}". Das Fahrzeug bestimmt den Laderaum ` +
        `und damit die Menge — es gehört ins Profil (siehe fuhreFuer/rollCustomer).`
    );
  }
  return c.vehicle;
}
