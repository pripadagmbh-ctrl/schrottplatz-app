/**
 * EIN LAUFAPPARAT FÜR DEN RANGIERKNICK — Waechter und Messwerkzeug benutzen ihn.
 *
 * Er faehrt einen Fahrplan KINEMATISCH ab, Rechenschritt fuer Rechenschritt,
 * genau so, wie `vehicles.advance` es tut — nur ohne Physik, ohne Ladung und
 * ohne Blockadepruefung. Das ist Absicht: Der Knick ist eine reine Frage der
 * Pose, und eine Messung ohne Physik streut nicht. Was der Knick in der
 * Physik ANRICHTET, misst `tools/rangier-wirkung.ts` mit echten Koerpern.
 *
 * DREI ZAHLEN je Schritt, und die zweite ist die, auf die es ankommt:
 *
 *   Grad je Schritt   wie weit sich die Gierlage in EINEM Bild dreht
 *   Sprung (m)        wie weit die WEITESTE Umrissecke dabei springt
 *   Tiefe (m)         wie tief der Umriss dabei in einem Bauwerk steckt
 *
 * Der Winkel allein sagt nichts: Eine Drehung um 90 Grad versetzt die Mitte
 * des Wagens um null und seine vordere Ecke um 7,3 m. Rapier sieht die Ecke.
 *
 * DER ALTE ZUSTAND IST EIN EINGANGSWERT, kein geloeschter Code:
 * `lenkrate = Infinity` liefert Zeichen fuer Zeichen die Fahrt von vor dem
 * 16.09.2026 (hartes Setzen von `rotation.y`). Damit hat jeder Waechter hier
 * seine Gegenprobe, ohne dass jemand eine kaputte Fassung nachbauen muss.
 */
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { bedLenFor } from "../src/delivery/routes";
import {
  fahrzeugUmriss,
  poseAuf,
  streckenLaenge,
  eckenSprung,
  umrissUeberlappung,
  type Rechteck,
} from "../src/delivery/umriss";
import {
  lenkeEin,
  dreheWeiter,
  drehRichtung,
  winkelRest,
  fahrtFaktor,
  LENK_RATE,
  PIVOT_AB,
  VORAUS_M,
} from "../src/delivery/lenkung";
import type { Fahrplan } from "./strecken";

/** Rechenschritt des Spiels (s) — `PhysicsWorld.timestep`, 60 Bilder je Sekunde. */
export const SCHRITT_S = 1 / 60;

/** Ein einzelner Knick: wo, wie scharf, wie weit springt die Ecke. */
export interface Knick {
  etappe: string;
  x: number;
  z: number;
  grad: number;
  sprungM: number;
}

/** Wo ein Umriss in einem Bauwerk steckt. */
export interface Anstoss {
  etappe: string;
  bauwerk: string;
  tiefeM: number;
  x: number;
  z: number;
}

export interface Fahrt {
  plan: string;
  /** Schaerfster Knick eines einzelnen Rechenschritts. */
  maxGrad: number;
  /** Weitester Sprung einer Umrissecke in einem Rechenschritt (m). */
  maxSprungM: number;
  /** Tiefste Durchdringung eines Bauwerks ueber die ganze Fahrt (m). */
  maxTiefeM: number;
  /** Wie lange die Fahrt dauert (s) — Einlenken kostet Zeit. */
  dauerS: number;
  /** Alle Knicke ueber 1 Grad je Schritt, absteigend. */
  knicke: Knick[];
  /** Alle Durchdringungen ueber der Toleranz, absteigend. */
  anstoesse: Anstoss[];
}

export interface Fahrweise {
  /** rad/s; `Infinity` ist der alte Sprungzustand. */
  lenkrate: number;
  /** Restwinkel, ab dem erst eingedreht und dann gefahren wird (rad). */
  pivotAb: number;
  /** Wie weit der Fahrer vorausschaut, bevor er einlenkt (m). */
  vorausM: number;
}

/** Tiefste Durchdringung dieses Umrisses in dieser Bauwerksliste (m). */
function tiefsteTiefe(
  b: ReturnType<typeof fahrzeugUmriss>,
  hindernisse: ReadonlyArray<Rechteck>
): number {
  let tief = 0;
  for (const o of hindernisse) {
    const d = umrissUeberlappung(b, o);
    if (d > tief) tief = d;
  }
  return tief;
}

/** Wie das Spiel seit dem 16.09.2026 faehrt. */
export const NEU: Fahrweise = { lenkrate: LENK_RATE, pivotAb: PIVOT_AB, vorausM: VORAUS_M };
/** Wie es bis dahin fuhr — die Gegenprobe jedes Waechters hier. */
export const ALT: Fahrweise = { lenkrate: Infinity, pivotAb: Infinity, vorausM: 0 };

/**
 * Einen Fahrplan abfahren und dabei jeden Schritt vermessen.
 *
 * `hindernisse` ist ein Eingang und keine feste Liste, damit derselbe Apparat
 * auch gegen einen versetzten Container gerechnet werden kann.
 */
export function fahre(
  f: Fahrplan,
  w: Fahrweise = NEU,
  hindernisse: ReadonlyArray<Rechteck & { label: string }> = STATIC_OBSTACLES
): Fahrt {
  const bedLen = bedLenFor(f.kind);
  const knicke: Knick[] = [];
  const anstoesse: Anstoss[] = [];
  let maxGrad = 0;
  let maxSprung = 0;
  let maxTiefe = 0;
  let schritte = 0;
  // Startlage: der Wagen wird an der Einfahrt GESETZT, nicht eingelenkt
  // (`vehicles.ts`, Konstruktor: `placeAt(this.routeIn, 0)`).
  const start = poseAuf(f.etappen[0]!.route, 0, f.etappen[0]!.rueckwaerts);
  let gier = start.rot;
  let box = fahrzeugUmriss(start, bedLen);
  const messe = (name: string, neu: typeof box, gradSchritt: number): void => {
    const sprung = eckenSprung(box, neu);
    if (gradSchritt > maxGrad) maxGrad = gradSchritt;
    if (sprung > maxSprung) maxSprung = sprung;
    if (gradSchritt > 1 || sprung > 0.5) {
      knicke.push({ etappe: name, x: neu.x, z: neu.z, grad: gradSchritt, sprungM: sprung });
    }
    for (const o of hindernisse) {
      const d = umrissUeberlappung(neu, o);
      if (d > maxTiefe) maxTiefe = d;
      if (d > 0.01) {
        anstoesse.push({ etappe: name, bauwerk: o.label, tiefeM: d, x: neu.x, z: neu.z });
      }
    }
    box = neu;
    schritte++;
  };
  for (const e of f.etappen) {
    const laenge = streckenLaenge(e.route);
    const step = e.tempo * SCHRITT_S;
    let s = 0;
    /** Laeuft gerade eine Kehre? Dann steht die Drehrichtung fest. */
    let kehre: 1 | -1 | null = null;
    // Deckel gegen Endlosschleifen: die laengste Strecke ist 90 m, die
    // groesste Kehre 360 Grad. 20.000 Schritte sind 5,5 Minuten Fahrzeit.
    for (let i = 0; i < 20000 && s < laenge; i++) {
      const ziel = poseAuf(e.route, Math.min(s + Math.max(step, w.vorausM), laenge), e.rueckwaerts);
      const rest = Math.abs(winkelRest(gier, ziel.rot));
      const vorher = gier;
      const q = poseAuf(e.route, s, e.rueckwaerts);
      /*
       * WANN EINGEDREHT WIRD, in derselben Reihenfolge wie `vehicles.advance`:
       * jede Rueckwaertsfahrt von Anfang an, sonst erst ab `pivotAb`. Eine
       * begonnene Kehre laeuft zu Ende — sonst kippte die Richtungswahl
       * mitten im Schwenk.
       */
      const muss = rest > w.pivotAb || (e.rueckwaerts && s === 0 && rest > 0.035);
      if (kehre !== null || muss) {
        if (kehre === null) {
          kehre = drehRichtung(gier, ziel.rot, (g2) =>
            tiefsteTiefe(fahrzeugUmriss({ x: q.x, z: q.z, rot: g2 }, bedLen), hindernisse)
          );
        }
        gier = dreheWeiter(gier, ziel.rot, w.lenkrate * SCHRITT_S, kehre);
        messe(
          e.name,
          fahrzeugUmriss({ x: q.x, z: q.z, rot: gier }, bedLen),
          Math.abs(winkelRest(vorher, gier)) * (180 / Math.PI)
        );
        if (Math.abs(winkelRest(gier, ziel.rot)) < 1e-9) kehre = null;
        continue;
      }
      s = Math.min(s + step * fahrtFaktor(rest), laenge);
      const p = poseAuf(e.route, s, e.rueckwaerts);
      gier = lenkeEin(gier, ziel.rot, w.lenkrate * SCHRITT_S);
      messe(
        e.name,
        fahrzeugUmriss({ x: p.x, z: p.z, rot: gier }, bedLen),
        Math.abs(winkelRest(vorher, gier)) * (180 / Math.PI)
      );
    }
  }
  knicke.sort((a, b) => b.sprungM - a.sprungM);
  anstoesse.sort((a, b) => b.tiefeM - a.tiefeM);
  return {
    plan: f.name,
    maxGrad,
    maxSprungM: maxSprung,
    maxTiefeM: maxTiefe,
    dauerS: schritte * SCHRITT_S,
    knicke: knicke.slice(0, 12),
    anstoesse: anstoesse.slice(0, 12),
  };
}
