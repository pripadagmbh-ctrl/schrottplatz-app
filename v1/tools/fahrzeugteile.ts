/**
 * DIE MESSUNG SELBST — welche Paare gemessen werden, in welchen Stellungen.
 *
 * Anlass, wörtlich (Patrick, 13.09.2026): „Also ich habe mir nochmal den
 * Kipper angeguckt. Die Ladefläche geht … durch. … dass die Ladefläche durch
 * den Kran läuft, wenn es einen Kran gibt."
 *
 * Zwei Tage lang ist das liegengeblieben, und der Grund ist banal: Es hat
 * niemand gemessen, weil es nichts gab, womit man es hätte messen können. Ein
 * Durchdringungsfehler ist nicht sichtbar, wenn man ihn nicht sucht — der Kran
 * steht hinter dem Fahrerhaus, die Überschneidung ist 12 cm hoch und liegt
 * UNTER dem Muldenboden. Auf dem iPad sieht man sie erst, wenn der Kipper
 * kippt und der Muldenboden durch die Kransäule hindurchfährt.
 *
 * WAS DIESES WERKZEUG TUT. Es baut jedes Fahrzeug einmal auf, zerlegt jedes
 * tragende Teil in seine Ecken und misst mit dem Trennachsensatz
 * (`tools/durchdringung.ts`) jedes Paar — und zwar nicht nur im Stand,
 * sondern in einem Raster über ALLE Stellungen, die das Fahrzeug im Spiel
 * einnimmt:
 *
 *     Kippgrad       0 … 1          (nur Kipper, 58° Endwinkel)
 *     Kranschwenk    0 … ±78°       (Schwenk beim Andocken, E-044)
 *     Bordwände      zu … offen     (Pritschen klappen beim Abladen auf)
 *
 * DIE NULLPROBE steht am Anfang und nicht am Ende: Derselbe Wagen OHNE Kran
 * muss null melden. Tut er das nicht, misst das Werkzeug sich selbst.
 *
 * Getrennt vom Bericht (`tools/fahrzeug-durchdringung.ts`), weil der Wächter
 * `test/fahrzeugteile.test.ts` genau diese Funktionen braucht und keinen
 * Bericht: Ein Werkzeug, das beim Einlesen losläuft, macht jeden Testlauf um
 * eine Minute länger.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { baueMessfahrzeug, type Aufbau, type Messfahrzeug } from "./fahrzeugbau-attrappe";
import {
  messeStellung,
  sammleTeile,
  type Pruefteil,
} from "./durchdringung";
import { BAUGRUPPE, BAUGRUPPEN, wandHoehe } from "../src/delivery/vehicleModel";
import {
  BED_HALF_W,
  CRANE_SWING,
  alleAbholPlaetze,
  bayApproach,
  bayInRev,
  bayOut,
  bedLenFor,
  routeApproach,
  routeInRev,
  routeOut,
} from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";
import { poseAuf, streckenLaenge } from "../src/delivery/umriss";

/**
 * Paare, die einander berühren DÜRFEN — mit Grund, nicht aus Bequemlichkeit.
 *
 * Wer hier etwas einträgt, schaltet eine Meldung ab. Deshalb steht zu jedem
 * Paar dabei, warum es am echten Fahrzeug genauso ist.
 */
export const ERLAUBTE_PAARE: ReadonlyArray<{
  a: string;
  b: string;
  /** Wie tief es hier höchstens sein darf (m) — gemessen, mit Aufschlag. */
  bis: number;
  grund: string;
}> = [
  {
    a: BAUGRUPPE.rad,
    b: BAUGRUPPE.rahmen,
    bis: 0.35,
    grund:
      "Gemessen 30,0 cm am inneren Zwillingsreifen der Hinterachse: Er liegt " +
      "bei x 0,52 … 0,82 und damit ganz im Rahmenquader (±1,10 m). Der Rahmen " +
      "ist hier eine durchgehende Platte, kein Leiterrahmen — ein echter hat " +
      "zwei Längsträger auf ±0,43 m, und dazwischen läuft das Rad frei durch. " +
      "Bekannt und offen (siehe `docs/offene-punkte.md`), aber kein Kranbefund.",
  },
  {
    a: BAUGRUPPE.rad,
    b: BAUGRUPPE.kotfluegel,
    bis: 0.05,
    grund: "Der Kotflügel sitzt über dem Rad; die Stollen dürfen ihn streifen.",
  },
  {
    a: BAUGRUPPE.kranbock,
    b: BAUGRUPPE.rahmen,
    bis: 0.3,
    grund: "Der Kranbock ist auf den Rahmen geschraubt — er MUSS ihn berühren.",
  },
  {
    a: BAUGRUPPE.kranbock,
    b: BAUGRUPPE.kransaeule,
    bis: 0.4,
    grund: "Die Säule steckt im Bock und dreht sich darin.",
  },
  {
    a: BAUGRUPPE.kotfluegel,
    b: BAUGRUPPE.rahmen,
    bis: 0.15,
    grund: "Der Kotflügel hängt am Rahmen.",
  },
  {
    a: BAUGRUPPE.fahrerhaus,
    b: BAUGRUPPE.rahmen,
    bis: 0.1,
    grund: "Das Haus steht auf dem Rahmen.",
  },
  {
    a: BAUGRUPPE.heckklappe,
    b: BAUGRUPPE.bordwand,
    bis: 0.1,
    grund: "Die Klappe schlägt beim Öffnen an den Bordwänden vorbei — selber Rahmen.",
  },
  {
    a: BAUGRUPPE.flaeche,
    b: BAUGRUPPE.stirnwand,
    bis: 0.06,
    grund:
      "Gemessen 4,0 cm: Die Stirnwand steht auf dem Bodenblech und ragt mit " +
      "ihrer hinteren Hälfte darüber — so ist eine angeschweisste Wand gebaut. " +
      "Zu sehen ist davon nichts, die Überschneidung liegt vollständig im Blech.",
  },
  {
    a: BAUGRUPPE.flaeche,
    b: BAUGRUPPE.kotfluegel,
    bis: 0.08,
    grund:
      "Gemessen 6,5 cm, und es ist kein Platz da: Zwischen Radscheitel (0,96 m) " +
      "und Muldenunterkante (0,97 m) liegt ein Zentimeter. Der Kotflügel liegt " +
      "ganz unter der Mulde zwischen den Rädern — von aussen ist keine " +
      "Kante davon zu sehen. Wer die Mulde je höher legt, bekommt hier Luft.",
  },
];

const erlaubt = new Map(ERLAUBTE_PAARE.map((p) => [[p.a, p.b].sort().join("|"), p]));

/**
 * Wie tief dieses Paar einander berühren darf (m).
 *
 * 0 heisst „gar nicht", `Infinity` heisst „geht diesen Wächter nichts an" —
 * das ist der Fall für Teile derselben Baugruppe: Ob der Verriegelungsbügel
 * in der Bordwand steckt, ist keine Frage, er ist daran festgeschweisst.
 */
export function erlaubteTiefe(a: string, b: string): number {
  if (a === b) return Infinity;
  return erlaubt.get([a, b].sort().join("|"))?.bis ?? 0;
}

/** Sind das zwei Teile, deren Durchdringung überhaupt gemeldet werden soll? */
export function meldepflichtig(a: Pruefteil, b: Pruefteil): boolean {
  return Number.isFinite(erlaubteTiefe(a.gruppe, b.gruppe));
}

/** Alle Bauarten, die im Spiel vorkommen können — plus die Nullproben. */
export interface Bauart {
  kind: string;
  aufbau: Aufbau;
  mitKran: boolean;
}

export function alleBauarten(): Bauart[] {
  const out: Bauart[] = [];
  for (const kind of ["kipper", "pritsche", "wrack", "abholer"]) {
    for (const aufbau of ["flach", "rungen", "koffer"] as Aufbau[]) {
      // Nur Händler fahren einen Kran mit, und nur auf Kipper und Pritsche
      // (`vehicles.ts`, `withCrane`). Aufbau und Kran werden hier trotzdem
      // gekreuzt: Das Werkzeug soll auch messen, was das Spiel (noch) nicht baut.
      const kranMoeglich = kind === "kipper" || kind === "pritsche";
      out.push({ kind, aufbau, mitKran: false });
      if (kranMoeglich) out.push({ kind, aufbau, mitKran: true });
    }
  }
  return out;
}

/**
 * Das Stellungsraster.
 *
 * Grob ist die Regel, fein die Ausnahme: Das grobe Raster (3° Schwenk, 2°
 * Kippwinkel) findet jede Durchdringung, die dicker als ein Blech ist; das
 * feine ist zum Nachmessen, wenn eine Zahl knapp aussieht.
 */
export function stellungen(fz: Messfahrzeug, fein: boolean): Array<[string, number, number, number]> {
  const out: Array<[string, number, number, number]> = [];
  const kippSchritte = fz.kind === "kipper" ? (fein ? 116 : 29) : 0;
  const schwenkSchritte = fz.mitKran ? (fein ? 52 : 26) : 0;
  const seiten = schwenkSchritte > 0 ? [1, -1] : [1];
  const nimm = (tip: number, schwenk: number, offen: number): void => {
    out.push([
      `Kipp ${(tip * 58).toFixed(0)}° / Schwenk ${((schwenk * 180) / Math.PI).toFixed(0)}°` +
        ` / Wand ${offen ? "auf" : "zu"}`,
      tip,
      schwenk,
      offen,
    ]);
  };

  // 1. Im Stand: der ganze Schwenkweg, Bordwände zu und auf
  for (let s = 0; s <= schwenkSchritte; s++) {
    const schwenk = schwenkSchritte > 0 ? (s / schwenkSchritte) * CRANE_SWING : 0;
    for (const vz of seiten) {
      for (const offen of [0, 1]) nimm(0, vz * schwenk, offen);
    }
  }

  /*
   * 2. Beim Kippen: der Kran ist dann IMMER ganz ausgeschwenkt.
   *
   * Das ist keine Annahme, sondern eine Regel des Ablaufs: `vehicles.ts`
   * lässt die Mulde erst steigen, wenn der Schwenk steht (`kranSteht`). Ohne
   * diese Regel wäre die Stellung „gekippt und Kran noch über der Mulde"
   * erreichbar, und dann fährt der Muldenboden durch den Ausleger — gemessen
   * am 15.09.2026 12,0 cm bei 20° Kippwinkel. Der Wächter
   * `test/fahrzeugteile.test.ts` prüft deshalb BEIDES: hier die Geometrie,
   * dort die Regel.
   */
  for (let k = 1; k <= kippSchritte; k++) {
    const tip = k / kippSchritte;
    if (schwenkSchritte === 0) nimm(tip, 0, 0);
    else for (const vz of seiten) nimm(tip, vz * CRANE_SWING, 0);
  }
  return out;
}

/** Das tiefste Vorkommen je Paar von Baugruppen. */
export interface Paarbefund {
  paar: string;
  tiefe: number;
  stellung: string;
  teile: string;
  gerundet: boolean;
  /** Was für dieses Paar erlaubt ist (m) — 0 heisst: gar nichts. */
  erlaubt: number;
  /** Beide Baugruppen, für Auswertung ohne Zeichenkettensuche. */
  gruppen: [string, string];
}

/** Befunde, die über ihrer Erlaubnis liegen — genau das, was ein Fehler ist. */
export function verstoesse(befunde: readonly Paarbefund[]): Paarbefund[] {
  return befunde.filter((b) => b.tiefe > b.erlaubt);
}

export function messeBauart(
  world: RAPIER.World,
  bauart: Bauart,
  fein = false
): { fz: Messfahrzeug; teile: Pruefteil[]; befunde: Paarbefund[]; lagen: number } {
  const fz = baueMessfahrzeug(world, bauart.kind, bauart.aufbau, bauart.mitKran);
  const teile = sammleTeile(fz.group, BAUGRUPPEN);
  const tiefste = new Map<string, Paarbefund>();
  const lagen = stellungen(fz, fein);
  for (const [name, tip, schwenk, offen] of lagen) {
    fz.stelle(tip, schwenk, offen);
    for (const b of messeStellung(teile, name, meldepflichtig)) {
      const paar = [b.gruppeA, b.gruppeB].sort().join(" × ");
      const da = tiefste.get(paar);
      if (!da || b.tiefe > da.tiefe) {
        tiefste.set(paar, {
          paar,
          tiefe: b.tiefe,
          stellung: b.stellung,
          teile: `${b.a} / ${b.b}`,
          gerundet: b.gerundet,
          erlaubt: erlaubteTiefe(b.gruppeA, b.gruppeB),
          gruppen: [b.gruppeA, b.gruppeB],
        });
      }
    }
  }
  fz.stelle(0, 0, 0);
  return {
    fz,
    teile,
    befunde: [...tiefste.values()].sort((a, b) => b.tiefe - a.tiefe),
    lagen: lagen.length,
  };
}

/* ------------------------------------------------------------------ *
 *  Zusatzmass 1: Wie viel Luft hat der Ausleger über der Ladung?
 * ------------------------------------------------------------------ */

/**
 * Oberkante der Ladung über dem Boden des Fahrzeugs (m).
 *
 * Gerechnet mit den Zahlen aus `vehicles.ts`: Die Ladefläche sitzt auf y 1,05
 * (`bedGroup.position.y`), die Stücke stehen auf `LADE_BODEN` 0,10 darüber und
 * dürfen bis `wandHoehe + LADUNG_UEBERSTAND` hoch stapeln.
 */
export function ladungOberkante(kind: string, aufbau: Aufbau): number {
  const LADE_BODEN = 0.1; // vehicles.ts
  const LADUNG_UEBERSTAND = 0.35; // vehicles.ts
  return 1.05 + LADE_BODEN + wandHoehe(kind, aufbau) + LADUNG_UEBERSTAND;
}

/**
 * Tiefster Punkt des Auslegers über der Ladefläche, im Transportzustand
 * (Schwenk 0). Kleiner als `ladungOberkante` heisst: Der Ausleger steht in
 * der Ladung.
 */
export function auslegerUeberFlaeche(fz: Messfahrzeug, teile: Pruefteil[]): number | null {
  if (!fz.mitKran) return null;
  fz.stelle(0, 0, 0);
  let tiefster = Infinity;
  const p = new THREE.Vector3();
  for (const t of teile) {
    if (t.gruppe !== BAUGRUPPE.kransaeule) continue;
    for (const e of t.ecken) {
      p.copy(e).applyMatrix4(t.objekt.matrixWorld);
      // Nur was über der Ladefläche hängt zählt
      if (Math.abs(p.x) > BED_HALF_W) continue;
      if (p.z < -fz.bedLen / 2 || p.z > fz.bedLen / 2) continue;
      if (p.y < tiefster) tiefster = p.y;
    }
  }
  return tiefster === Infinity ? null : tiefster;
}

/* ------------------------------------------------------------------ *
 *  Zusatzmass 2: Der Rangierknick (E-073, NICHT Auftrag dieses Pakets)
 * ------------------------------------------------------------------ */

/**
 * Wie weit sich ein Fahrzeug an der schärfsten Streckenecke in EINEM
 * Rechenschritt dreht.
 *
 * `placeAt` setzt `rotation.y` hart auf die Richtung des Streckenstücks. An
 * einer Ecke wechselt die Richtung sprunghaft — der Wagen knickt also
 * zwischen zwei Bildern um den vollen Eckwinkel ab, und alles, was auf oder
 * neben ihm liegt, wird in diesem einen Schritt mitgerissen.
 *
 * Gemessen wird der grösste Winkelsprung zwischen zwei aufeinanderfolgenden
 * Streckenstücken, ausserdem, wie weit die Heckecke des Umrisses dabei
 * springt (das ist die Strecke, die ein Schrottteil an der Bordwand in einem
 * Schritt zurücklegen müsste).
 */
export function rangierknick(): Array<{
  strecke: string;
  knickGrad: number;
  heckSprungM: number;
}> {
  const bedLen = bedLenFor("kipper");
  // Halbe Diagonale des Umrisses — der Punkt, der beim Knicken am weitesten wandert
  const halbLaenge = bedLen / 2 + 1.9;
  const radius = Math.hypot(halbLaenge, 1.55);
  /*
   * Dieselbe Streckenliste, die `test/fahrumriss.test.ts` abfährt — aus den
   * Quellen selbst, nicht abgeschrieben. Wer ein Silo dazustellt, bekommt
   * seine drei Strecken hier automatisch mitgemessen.
   */
  const strecken: Array<[string, Array<[number, number]>]> = [
    ["Abladeplatz Anfahrt", routeApproach()],
    ["Abladeplatz Rückwärts", routeInRev()],
    ["Abladeplatz Ausfahrt", routeOut()],
  ];
  for (const p of alleAbholPlaetze()) {
    const wie = p.order ?? "gemischt";
    strecken.push([`Abholer ${wie} Anfahrt`, p.anfahrt]);
    strecken.push([`Abholer ${wie} Rückwärts`, p.rueckweg]);
    strecken.push([`Abholer ${wie} Ausfahrt`, p.ausfahrt]);
  }
  for (const c of CONFIGS.filter((k) => k.lager === true)) {
    strecken.push([`Silo ${c.label} Anfahrt`, bayApproach(c)]);
    strecken.push([`Silo ${c.label} Rückwärts`, bayInRev(c)]);
    strecken.push([`Silo ${c.label} Ausfahrt`, bayOut(c)]);
  }
  const out: Array<{ strecke: string; knickGrad: number; heckSprungM: number }> = [];
  for (const [name, route] of strecken) {
    if (!route || route.length < 2) continue;
    let groesster = 0;
    const len = streckenLaenge(route);
    // In sehr feinen Schritten abtasten — der Sprung liegt zwischen zwei
    // Abtastpunkten, die auf verschiedenen Streckenstücken liegen
    const schritt = 0.01;
    let vorher = poseAuf(route, 0, false).rot;
    for (let s = schritt; s <= len; s += schritt) {
      const rot = poseAuf(route, s, false).rot;
      let d = Math.abs(rot - vorher);
      while (d > Math.PI) d = Math.abs(d - 2 * Math.PI);
      if (d > groesster) groesster = d;
      vorher = rot;
    }
    out.push({
      strecke: name,
      knickGrad: (groesster * 180) / Math.PI,
      // Bogenlänge, die die weiteste Umrissecke bei diesem Knick zurücklegt
      heckSprungM: groesster * radius,
    });
  }
  return out.sort((a, b) => b.knickGrad - a.knickGrad);
}

/* ------------------------------------------------------------------ *
 *  Zusatzmass 3: Das Fenster des Platzinventars (E-070)
 * ------------------------------------------------------------------ */

/**
 * Wie hoch der Fuss eines Behälters stehen müsste, damit
 * `gibPlatzinventarZurueck` ihn fälschlich als „auf der Fläche" zählt.
 *
 * Das Fenster verlangt in Flächenkoordinaten y ≥ −0,20. Die Fläche sitzt auf
 * y 1,05 über dem Boden (`vehicleModel`: `bedGroup.position.y`), und ein
 * Absetzcontainer hat seinen Körperursprung am BODEN (`containers.ts`:
 * `setTranslation(cfg.x, 0, cfg.z)`, `absetzen` setzt y = 0). Ein Behälter,
 * der neben dem Wagen steht, meldet also y = 0.
 */
export const FLAECHE_UEBER_GRUND = 1.05;
export const INVENTAR_FENSTER_UNTEN = -0.2;
export function inventarLuft(): number {
  return FLAECHE_UEBER_GRUND + INVENTAR_FENSTER_UNTEN;
}

