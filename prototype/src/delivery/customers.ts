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

export type CustomerGroup = "privat" | "haendler" | "gewerbe";

export interface CustomerProfile {
  group: CustomerGroup;
  /** Anzeigename am Fahrzeug und in Meldungen */
  name: string;
  /** Untertitel: Familie, Branche oder Herkunftsort */
  subtitle: string;
  /** Liefermenge in kg */
  massKg: number;
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

/** Herkunftsorte für Privatleute — sie kommen aus der Gegend. */
const PRIVAT_ORTE = [
  "aus Beckum",
  "aus Ahlen",
  "vom Nachbarort",
  "aus der Siedlung",
  "vom Hof",
  "aus der Stadt",
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
 * Nächsten Kunden würfeln.
 *
 * Die Mischung ist bewusst ungleich: Händler bringen die großen Mengen und
 * tragen den Umschlag, Privatleute sorgen für Abwechslung und Kleinkram,
 * Gewerbe liefert das sortenreine Material, mit dem sich sauber verdienen
 * lässt.
 */
export function rollCustomer(): CustomerProfile {
  const r = Math.random();
  if (r < 0.34) return rollPrivat();
  if (r < 0.74) return rollHaendler();
  return rollGewerbe();
}

function rollPrivat(): CustomerProfile {
  return {
    group: "privat",
    name: pick(PRIVAT_NAMEN),
    subtitle: pick(PRIVAT_ORTE),
    massKg: 50 + Math.random() * 750,
    sortedMaterial: null, // Haushaltsauflösung ist immer gemischt
    // Privatleute bringen unwissentlich Störstoff mit: Holz, Kunststoff, Reifen
    contaminantShare: 0.15 + Math.random() * 0.2,
    hardness: 1,
    greeting: pick(PRIVAT_SPRUECHE),
  };
}

function rollHaendler(): CustomerProfile {
  const f = pick(FAMILIES);
  return {
    group: "haendler",
    name: f.firstName,
    subtitle: f.family,
    massKg: 3000 + Math.random() * 17000,
    // Auch wenn er eine Vorliebe hat: der Händler nimmt mit, was er kriegt
    sortedMaterial: f.typical && Math.random() < 0.45 ? f.typical : null,
    contaminantShare: 0.05 + Math.random() * 0.08,
    hardness: f.hardness,
    greeting: pick(f.greetings),
  };
}

function rollGewerbe(): CustomerProfile {
  const t = pick(TRADES);
  return {
    group: "gewerbe",
    name: t.name,
    subtitle: "Gewerbe",
    massKg: 1000 + Math.random() * 14000,
    sortedMaterial: t.material,
    contaminantShare: t.beifang,
    hardness: 2, // sachlich, wenig Spielraum
    greeting: pick(t.greetings),
  };
}

/** Fahrzeugart, die zu dieser Kundschaft passt. */
export function vehicleForCustomer(c: CustomerProfile): "kipper" | "pritsche" | "wrack" {
  if (c.group === "privat") {
    // PKW mit Anhänger — im Modell die kleine Pritsche; gelegentlich schleppt
    // jemand ein Altauto an
    return Math.random() < 0.2 ? "wrack" : "pritsche";
  }
  if (c.group === "gewerbe") return Math.random() < 0.65 ? "kipper" : "pritsche";
  // Händler: alles unterwegs, was Räder hat
  const r = Math.random();
  return r < 0.5 ? "kipper" : r < 0.85 ? "pritsche" : "wrack";
}
