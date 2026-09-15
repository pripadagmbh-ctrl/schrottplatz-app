/**
 * Wie voll ein Wagen ankommt — und was das wiegt.
 *
 * Ansage Patrick, 15.09.2026, wörtlich:
 *
 *   „Es ist halt bei Händlern halt auch nicht immer das Gewicht, sondern eher
 *    das Volumen auf der Ladefläche. Und da sollte in der Regel immer ein
 *    vollgepackter LKW ankommen. Halb voll, mittelvoll, dreiviertel voll, voll
 *    voll. Aber so ein Viertel voll ist schon eher selten bis schwierig."
 *
 * Damit ist die Reihenfolge umgedreht. Bisher wurden Kilogramm gewürfelt und
 * die Ladefläche danach irgendwie vollgelegt. Jetzt wird zuerst der Füllgrad
 * gewürfelt, daraus das Volumen gerechnet und erst daraus die Masse:
 *
 *   Masse = Füllgrad × Laderaum (m³) × Schüttdichte (kg/m³)
 *
 * Das erklärt auf einmal, was auf einem Schrottplatz jeder weiß: Eine Fuhre
 * Alu türmt sich über die Bordwand und wiegt zwei Tonnen, dieselbe Pritsche
 * mit Messingarmaturen ist halb leer und wiegt acht. Es entscheidet, was
 * zuerst ausgeht — Platz oder Nutzlast.
 */
import { ladungsDichte } from "../materials/schuettdichte";
import { bedLenFor } from "./routes";

/** Aufbau der Ladefläche (Quelle: `vehicleModel.VehicleModelContext.bodyStyle`). */
export type Aufbau = "flach" | "rungen" | "koffer";

/** Fahrzeugarten, die anliefern (Quelle: `vehicleForCustomer`). */
export type Fahrzeugart = "kipper" | "pritsche" | "wrack" | "pkw";

/** Gruppe der Kundschaft — dieselben drei wie in `customers.ts`. */
export type LadeGruppe = "privat" | "haendler" | "gewerbe";

/* ------------------------------------------------------------------ *
 *  1. Der Füllgrad
 * ------------------------------------------------------------------ */

/**
 * Die vier Füllklassen sind Patricks eigene Worte, in Zahlen übersetzt.
 * Innerhalb einer Klasse wird gleichverteilt gewürfelt, damit zwei „dreiviertel
 * volle" Wagen nicht identisch aussehen.
 *
 * Die Untergrenze von 0,22 ist kein leerer Wagen: Ein Viertel der Fläche liegt
 * voll, der Rest ist frei. Tiefer geht es nicht — „unter einem Viertel" wäre
 * ein Wagen, für den niemand losfährt.
 */
export const FUELL_KLASSEN = {
  viertel: { von: 0.22, bis: 0.38 },
  halb: { von: 0.38, bis: 0.58 },
  dreiviertel: { von: 0.58, bis: 0.8 },
  randvoll: { von: 0.8, bis: 1.0 },
} as const;

export type FuellKlasse = keyof typeof FUELL_KLASSEN;

export const FUELL_REIHE: FuellKlasse[] = ["viertel", "halb", "dreiviertel", "randvoll"];

/**
 * Wie oft welche Klasse vorkommt, je Gruppe. Das ist der Kern dieses Pakets.
 *
 * Der Schwerpunkt liegt oben, der Schwanz nach unten ist dünn — kein
 * Gleichverteilen zwischen leer und voll. Begründung je Gruppe:
 *
 *   HAENDLER  „Eigentlich kommen Händler erst, wenn ihre LKWs randvoll sind."
 *             Er fährt nicht zweimal dieselbe Strecke: gut zwei von drei
 *             Fuhren randvoll, ein Viertel voll praktisch nie (1 %) — das ist
 *             die Panne, nicht der Normalfall.
 *   GEWERBE   Der Betrieb ruft, wenn der Container voll ist, nicht wenn der
 *             LKW voll ist. Deshalb breiter gestreut als beim Händler, mit
 *             dem Schwerpunkt weiter oben als beim Privatmann.
 *   PRIVAT    Ein Anhänger nimmt, was im Keller stand. Hier ist ein Viertel
 *             voll wirklich möglich (12 %) — aber auch hier ist die volle
 *             Ladung der häufigste Einzelfall nach „dreiviertel".
 *
 * Über alle Anlieferer zusammen (18 % privat, 60 % Händler, 22 % Gewerbe)
 * ergibt das: randvoll 56 %, dreiviertel 29 %, halb 12 %, viertel 3,4 %.
 * „Selten bis schwierig", aber nicht ausgeschlossen — rund jede 30. Fuhre.
 */
export const FUELL_GEWICHTE: Record<LadeGruppe, Record<FuellKlasse, number>> = {
  haendler: { viertel: 0.01, halb: 0.06, dreiviertel: 0.25, randvoll: 0.68 },
  gewerbe: { viertel: 0.03, halb: 0.14, dreiviertel: 0.33, randvoll: 0.5 },
  privat: { viertel: 0.12, halb: 0.28, dreiviertel: 0.35, randvoll: 0.25 },
};

/** In welche Klasse fällt ein Füllgrad? */
export function fuellKlasse(f: number): FuellKlasse {
  if (f < FUELL_KLASSEN.viertel.bis) return "viertel";
  if (f < FUELL_KLASSEN.halb.bis) return "halb";
  if (f < FUELL_KLASSEN.dreiviertel.bis) return "dreiviertel";
  return "randvoll";
}

/** Füllgrad der Ladefläche würfeln (0–1). */
export function rollFuellgrad(gruppe: LadeGruppe, rnd: () => number = Math.random): number {
  const gewichte = FUELL_GEWICHTE[gruppe] ?? FUELL_GEWICHTE.haendler;
  let r = rnd();
  for (const klasse of FUELL_REIHE) {
    r -= gewichte[klasse];
    if (r < 0) {
      const { von, bis } = FUELL_KLASSEN[klasse];
      return von + rnd() * (bis - von);
    }
  }
  return FUELL_KLASSEN.randvoll.bis;
}

/* ------------------------------------------------------------------ *
 *  2. Der Laderaum — gerechnet mit den Maßen, die im Spiel stehen
 * ------------------------------------------------------------------ */

/**
 * Länge der Ladefläche je Fahrzeugart, in Metern.
 *
 * Keine eigene Tabelle mehr: Am 15.09.2026 haben zwei Pakete am selben Tag
 * dieselbe Zahlenreihe angelegt — dieses hier als Abschrift aus `vehicles.ts`,
 * das Kipper-Paket (E-029) als **gemeinsame Quelle** in `routes.ts`. Beim
 * Zusammenführen wurde daraus ein roter Wächter, und das war die richtige
 * Meldung: Vier Abschriften derselben Länge sind drei zu viel.
 *
 * Es gilt die Quelle aus `routes.ts`. Hier steht nur die engere Typangabe:
 * Dort ist es ein `Record<string, number>` (es kennt auch den Abholer), hier
 * sind es genau die vier Fahrzeugarten, die eine Ladung bekommen.
 */
export const BED_LEN: Record<Fahrzeugart, number> = {
  pkw: bedLenFor("pkw"),
  wrack: bedLenFor("wrack"),
  kipper: bedLenFor("kipper"),
  pritsche: bedLenFor("pritsche"),
};

/** Halbe Innenbreite der LKW-Ladefläche. Quelle: `routes.BED_HALF_W` 1,35 − 0,08 Wandstärke (`vehicles.ts`). */
export const LKW_HALB_BREITE = 1.35 - 0.08;

/**
 * Der PKW-Anhänger ist schmaler und flacher als jeder LKW.
 * Quelle: `vehicleModel.buildCarAndTrailer` — Boden 1,86 m breit, Bordwände
 * 0,06 m stark bei x = ±0,90 (Innenmaß 1,74 m), Wandhöhe 0,34 m.
 */
export const ANHAENGER_HALB_BREITE = 0.9 - 0.03;
export const ANHAENGER_WAND = 0.34;

/** Rand, der an beiden Enden frei bleibt. Quelle: `vehicles.LADE_RAND`. */
export const LADE_RAND = 0.2;
/** Wie weit die Ladung über die Bordwand darf. Quelle: `vehicles.LADUNG_UEBERSTAND`. */
export const LADUNG_UEBERSTAND = 0.35;

/**
 * Bordwandhöhe je Aufbau. Quelle: `vehicleModel.wandHoehe`.
 * Hier gespiegelt statt importiert, damit `customers.ts` nicht three.js und
 * Rapier mitziehen muss; `test/fuellgrad.test.ts` vergleicht beide.
 */
export const WAND_HOEHE: Record<Aufbau, number> = {
  flach: 0.64,
  rungen: 1.05,
  koffer: 1.55,
};

/**
 * Aufbau würfeln. Gespiegelt aus `vehicles.ts` („Haendler fahren nicht alle
 * denselben Wagen … Gewerbe und Privat bleiben flach"): vier Lose, zweimal
 * Rungen. `test/fuellgrad.test.ts` vergleicht die Zeile dort mit dieser.
 */
export function rollAufbau(gruppe: LadeGruppe, rnd: () => number = Math.random): Aufbau {
  if (gruppe !== "haendler") return "flach";
  return (["rungen", "rungen", "koffer", "flach"] as const)[Math.floor(rnd() * 4)];
}

/** Nutzbarer Laderaum in m³ — Innenmaß mal Ladehöhe inklusive Überstand. */
export function ladeVolumen(kind: Fahrzeugart, aufbau: Aufbau = "flach"): number {
  const laenge = Math.max(0, BED_LEN[kind] - 2 * LADE_RAND);
  const halbBreite = kind === "pkw" ? ANHAENGER_HALB_BREITE : LKW_HALB_BREITE;
  const wand = kind === "pkw" ? ANHAENGER_WAND : WAND_HOEHE[aufbau];
  return halbBreite * 2 * laenge * (wand + LADUNG_UEBERSTAND);
}

/**
 * Nutzlast in kg — was der Wagen tragen darf, bevor der Platz ausgeht.
 *
 * SW, aber mit Grund: Ein echter Dreiachs-Kipper trägt 14 bis 15 t. Patrick
 * hat die Spanne der Anlieferungen aber auf „zwischen 1 und 10 Tonnen"
 * festgelegt (15.09.2026), und `test/lademenge.test.ts` hält 10 t als Decke
 * fest. Die Nutzlast liegt deshalb unter dem realen Wert.
 *
 * Sie ist kein Deckel auf einer Zufallszahl, sondern eine Aussage: Bei
 * schwerem Material (Messing, Batterien) ist der Wagen voll, bevor er voll
 * ist — dann liegt die Ladung als flacher Fleck auf dem Boden.
 */
export const NUTZLAST: Record<Fahrzeugart, number> = {
  kipper: 9500,
  pritsche: 8500,
  // Anhänger hinter dem PKW: 2,7 t zulässig, rund 0,9 t Leergewicht.
  pkw: 1800,
  // Der Abschleppwagen trägt ein Auto, keine Schüttung — siehe WRACK_KG.
  wrack: 2000,
};

/**
 * Was ein Altauto auf der Brückenwaage wiegt.
 * Quelle: `vehicles.cargoMassKg` rechnet das abgestellte Wrack mit 950 kg.
 */
export const WRACK_KG = 950;

export interface Fuhre {
  /** Anteil der Ladefläche, der belegt ist (0–1) — was man sieht */
  fuellgrad: number;
  /** Masse der Ladung in kg */
  massKg: number;
  /** Schüttdichte der Mischung in kg/m³ */
  dichte: number;
  /** Laderaum des Wagens in m³ */
  volumen: number;
  /** Ging die Nutzlast vor dem Platz aus? Dann liegt die Fuhre flach. */
  nutzlastBegrenzt: boolean;
}

/**
 * Eine Fuhre ausrechnen: Füllgrad rein, Kilogramm raus.
 *
 * Reicht die Nutzlast nicht, wird nicht die Masse gekappt, sondern der
 * Füllgrad heruntergerechnet — der Fahrer hört auf zu laden, wenn die Waage
 * es sagt. Was man sieht und was die Waage sagt, bleibt so dasselbe.
 */
export function baueFuhre(args: {
  kind: Fahrzeugart;
  aufbau?: Aufbau;
  fuellgrad: number;
  hauptfraktion: string | null;
  stoerstoffAnteil: number;
}): Fuhre {
  const aufbau = args.aufbau ?? "flach";
  const volumen = ladeVolumen(args.kind, aufbau);
  const dichte = ladungsDichte(args.hauptfraktion, args.stoerstoffAnteil);
  if (args.kind === "wrack") {
    // Ein Wrack ist keine Schüttung: Es wiegt, was es wiegt.
    return { fuellgrad: 1, massKg: WRACK_KG, dichte, volumen, nutzlastBegrenzt: false };
  }
  let fuellgrad = Math.min(1, Math.max(0, args.fuellgrad));
  let massKg = volumen * fuellgrad * dichte;
  const nutzlast = NUTZLAST[args.kind];
  let begrenzt = false;
  if (massKg > nutzlast) {
    begrenzt = true;
    massKg = nutzlast;
    fuellgrad = nutzlast / (volumen * dichte);
  }
  return { fuellgrad, massKg: Math.round(massKg), dichte, volumen, nutzlastBegrenzt: begrenzt };
}
