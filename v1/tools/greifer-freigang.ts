/**
 * Bis zu welchem Winkel kann der Greifer zur Seite kippen, ohne den eigenen
 * Arm zu beruehren? — auf DREIECKSEBENE gemessen.
 *
 * Wunsch Patrick 15.09.2026: „Greifer muss komplett zur seite kippen können,
 * zum kehren und schleudern."
 *
 * `tools/greifer-kippen.ts` hat diese Frage mit KAESTEN versucht und ist
 * gescheitert (E-065): Die Nullgrad-Zeile, an der der Greifer nachweislich
 * frei haengt, meldete −0,071 m. Hier wird gegen die gezeichneten Dreiecke
 * gerechnet, wie bei E-050 (Auslegerbock, 594 Armstellungen, 432.824 Punkte,
 * kleinster Freigang 0,027 m). Rechenkern und Fehlerschranke stehen in
 * `tools/freigang-kern.ts`.
 *
 * DIE KIPPUNG, DIE HIER GEMESSEN WIRD, ist die, die gebaut werden soll:
 *
 *     q = qPendel · qGier · qKipp        (qKipp GANZ RECHTS)
 *
 * Ein Punkt p des Greifers landet damit bei  Aufhaengung + R_y(ψ)·R_x(θ)·p.
 * `qKipp` steht rechts, damit die Kipprichtung MIT DEM ROTATOR mitdreht —
 * Patrick: „breite so lassen, ich kann die Spinne ja drehen damit es passt."
 * Das Pendel bleibt hier aussen vor; es kommt als eigener Zuschlag dazu.
 *
 * ## DIE EICHUNG — und warum sie hier nicht bei null anfangen kann
 *
 * Der Ursprung der `grappleGroup` IST das Kardangelenk, und das Kardangelenk
 * sitzt in der Stielspitze. Was ganz oben am Greifer haengt — der
 * Rotatorstummel — steckt deshalb BAUARTBEDINGT im Stiel, auch bei Kippwinkel
 * 0, wo der Greifer im Spiel seit Monaten nachweislich frei haengt. Eine
 * Messung, die das mitzaehlt, meldet schon bei 0° Beruehrung und ist damit
 * wertlos (genau daran ist die Kastenmessung von E-065 gestorben).
 *
 * Statt einen Grenzwert zu RATEN, wird er GEMESSEN: `eichung()` sucht den
 * kleinsten Halbmesser R0 um das Kardangelenk, ab dem bei Kippwinkel 0 in
 * JEDER Armstellung und JEDER Rotatorstellung alles frei ist. Alles innerhalb
 * von R0 ist die Aufhaengung; sie bleibt beim Kippen innerhalb von R0 (eine
 * Drehung um den Ursprung erhaelt den Halbmesser) und damit dort, wo sie
 * schon bei 0° steckt. Gemessen wird ab R0 nach aussen.
 *
 * Aufruf: npx vite-node tools/greifer-freigang.ts [probe|fein|nullgrad]
 *
 *   (ohne)    Uebersicht: 19 Kippwinkel, Raster 6 cm
 *   fein      Nachmessung: 5 Kippwinkel, Raster 2,5 cm
 *   probe     eine einzige Armstellung, zum Ausprobieren
 *   nullgrad  KEINE Kippung, dafuer Eindringtiefe, Ort und die Frage, ob die
 *             Armstellung vom Bodenanschlag ueberhaupt erlaubt ist (E-095)
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import type { Greiferform } from "../src/excavator/greiferform";
import {
  Gitter,
  Naehefeld,
  dreieckssuppe,
  eps,
  greiferwolkeImFrame,
  punktDreieck,
  type Suppe,
} from "./freigang-kern";

const GRAD = 180 / Math.PI;

/**
 * WAS ZUM ARM GEHOERT — und was nicht.
 *
 * Genommen wird ALLES ausserhalb der `grappleGroup`: Stiel, Ausleger, alle
 * vier Zylinder, Kabine, Oberwagen, Drehkranz, Unterwagen, Raeder,
 * Raeumschild, Pratzen. Die Kastenmessung musste aussortieren, weil ihre
 * Kaesten die Luft zwischen den Raedern einschlossen; auf Dreiecksebene ist
 * das nicht noetig — ein Rad ist ein Rad.
 *
 * Die beiden SCHLAEUCHE zaehlen nicht als Hindernis: Ein Hydraulikschlauch
 * gibt nach, haengt lose durch, wird mitgezogen. Sie werden aber im selben
 * Durchgang GETRENNT gemessen und ausgewiesen, damit sie nicht
 * stillschweigend verschwinden.
 */
const SCHLAUCH = /SCHLAUCH/;

/** Grenzwinkel der Gelenke — wie in `excavator.ts` (Z. 195-198). */
export const BOOM_MIN = 5;
export const BOOM_MAX = 70;
export const STICK_MIN = -140;
export const STICK_MAX = -25;

/**
 * Weiter als das interessiert die Frage „beruehrt es sich" nicht.
 *
 * 0,15 m, nicht 0,30. Die Frage lautet nicht „wie viel Luft ist da", sondern
 * „ist da Luft"; 15 cm sind dafuer reichlich. Der Deckel geht dreifach in die
 * Kosten ein — er entscheidet, wie viele Punkte durchs Grobsieb kommen, wie
 * weit die Ringsuche im Raster laufen muss und wie gross das Sieb sein muss.
 * Mit 0,30 lief die Uebersicht ueber eine Stunde und war nicht fertig; mit
 * 0,15 ist sie es in Minuten.
 */
export const DECKEL = 0.15;

/**
 * WELCHE ARMSTELLUNGEN DAS SPIEL UEBERHAUPT ERREICHT — die Regel ist nicht
 * erfunden, sondern die des Bodenanschlags selbst.
 *
 * `resolveGroundClamp` haelt die Stielspitze auf
 *     tipY >= Flaeche + Greifertiefe + 0,02.
 * Auf dem Beton (Flaeche 0) heisst das: unter rund 3,0 m kommt die
 * Stielspitze nie. Wer die Gelenkgrenzen stur abrastert, misst deshalb zu
 * einem grossen Teil Stellungen, in denen der Greifer im Boden steckt — und
 * dort steckt er heute schon, bei Kippwinkel 0, im Oberwagen mit drin. Die
 * erste Fassung dieser Messung hat genau das getan: Ihre Eichung meldete
 * R0 = 3,071 m, also „der ganze Greifer steckt irgendwo im Bagger". Das war
 * kein Befund ueber den Greifer, sondern ueber die Auswahl der Stellungen.
 *
 * ZUGABE: Der Greifer steht nicht immer auf dem Beton. Eine Ladeflaeche liegt
 * 1,05 m hoch (`delivery/routes.ts`), ein Muldenboden aehnlich; dann darf die
 * Spitze entsprechend tiefer. 1,50 m Zugabe deckt das mit Reserve ab.
 */
export const HOCHSTAND = 1.5;

export function reihe(von: number, bis: number, schritt: number): number[] {
  const r: number[] = [];
  for (let v = von; v <= bis + 1e-9; v += schritt) r.push(Math.round(v * 100) / 100);
  return r;
}

interface Lauf {
  name: string;
  boom: number[];
  stick: number[];
  gier: number[];
  kipp: number[];
  /** Abtastraster des Greifers (m) */
  h: number;
  /** Zahl der Oeffnungsstellungen */
  splay: number;
}

const UEBERSICHT: Lauf = {
  name: "Uebersicht",
  boom: reihe(BOOM_MIN, BOOM_MAX, 8.125), // 9
  stick: reihe(STICK_MIN, STICK_MAX, 14.375), // 9
  gier: reihe(0, 345, 15), // 24
  kipp: reihe(0, 90, 5), // 19
  h: 0.06,
  splay: 4,
};

/**
 * Die NACHMESSUNG — feineres Raster, dafuer nur die Winkel, auf die es
 * ankommt.
 *
 * Die Uebersicht tastet mit 6 cm ab; ihr Abtastfehler ist damit 34,6 mm, und
 * jede Freigangzahl ist um so viel unsicher. Fuer die Frage „geht 90 Grad
 * ueberhaupt" reicht das, fuer die Zahl dahinter nicht. Hier wird mit 2,5 cm
 * abgetastet (Fehler 14,4 mm), dafuer nur bei drei Kippwinkeln: lotrecht, auf
 * halbem Weg, und ganz zur Seite. Die Kosten bleiben damit dieselben — fuenfmal
 * so viele Punkte, ein Sechstel der Winkelpaare.
 */
const FEIN: Lauf = {
  name: "Nachmessung",
  boom: reihe(BOOM_MIN, BOOM_MAX, 8.125), // 9, wie die Uebersicht
  stick: reihe(STICK_MIN, STICK_MAX, 14.375), // 9
  gier: reihe(0, 345, 15), // 24
  /*
   * NEGATIVE Winkel, weil der Bagger um −x kippt (`KIPP_ACHSE`). Der
   * Unterschied ist nicht nur ein Vorzeichen: Der Greifer ist um seine Achse
   * fuenfzaehlig, nicht zweizaehlig — nach der einen Seite gekippt steht eine
   * Schale unten, nach der anderen eine Luecke. Wer das Vorzeichen falsch
   * misst, misst eine Lage, die es nicht gibt.
   */
  kipp: [0, -22.5, -45, -67.5, -90],
  h: 0.025,
  splay: 6,
};

const PROBE: Lauf = { ...UEBERSICHT, name: "Probe", boom: [30], stick: [-70] };

/**
 * Der NULLGRAD-BERICHT — dieselbe Messung, aber ohne Kippung und mit Tiefe.
 *
 * Anlass: E-085 hat als Nebenbefund gemeldet, dass der Greifer in 13 von 62
 * erreichbaren Armstellungen SCHON BEI 0° den Arm beruehrt. Diese Zeile kam
 * aus `vorprobe()` und sagt nur JA/NEIN — nicht, wie tief, nicht wo, und
 * nicht, ob die Stellung im Betrieb ueberhaupt vorkommt.
 *
 * Der Bericht rechnet mit DENSELBEN Punkten, DEMSELBEN Raster und DEMSELBEN
 * Ausschluss (`VORHALT`) wie die Vorprobe — die Zahl muss also mit ihr
 * uebereinstimmen — und legt drei Dinge daneben:
 *
 *   1. die EINDRINGTIEFE (Windungszahl + Abstand zur Netzoberflaeche),
 *   2. WO es klemmt (Armnetz, Greifernetz, Ort im Greiferframe),
 *   3. ob die Stellung im BETRIEB erreichbar ist (Ausladung, Spitzenhoehe).
 */
const NULLGRAD: Lauf = {
  name: "Nullgrad-Bericht",
  boom: reihe(BOOM_MIN, BOOM_MAX, 8.125), // 9, wie die Nachmessung
  stick: reihe(STICK_MIN, STICK_MAX, 14.375), // 9
  gier: reihe(0, 345, 15), // 24
  kipp: [0],
  h: 0.025,
  splay: 6,
};

/* ------------------------------------------------------------- Messkoerper */

export interface Form {
  form: Greiferform;
  /** Punktwolke im Greiferframe, 3 Zahlen je Punkt, nach Halbmesser sortiert. */
  wolke: Float64Array;
  /** Halbmesser je Punkt (aufsteigend). */
  rho: Float64Array;
  /** Kleinster Halbmesser, ab dem bei 0° alles frei ist (aus `eichung`). */
  r0: number;
  /** Index des ersten Punktes mit rho > r0. */
  ab: number;
}

/** Ein Ergebnisfeld: je (Kipp|Gier) der kleinste Abstand ueber alle Posen. */
type Feld = Map<string, { d: number; wo: string; pose: string }>;

/**
 * Eine Greiferform abtasten und die Punkte nach Halbmesser um das
 * Kardangelenk sortieren.
 *
 * Steht als eigene Funktion da, seit `test/greifer-nullgrad.test.ts` dieselbe
 * Wolke braucht. Sortiert wird, weil zwei Auswertungen einen Ausschnitt
 * „alles jenseits von R" brauchen — der ist in einer sortierten Liste ein
 * Index statt einer Bedingung je Punkt.
 */
export function formVermessen(
  bagger: Excavator,
  g: Greiferform,
  h: number,
  splay: number
): Form {
  bagger.setGreifer(g);
  const roh = greiferwolkeImFrame(bagger, g, h, splay);
  const n = roh.length / 3;
  const idx = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) =>
      Math.hypot(roh[a * 3], roh[a * 3 + 1], roh[a * 3 + 2]) -
      Math.hypot(roh[b * 3], roh[b * 3 + 1], roh[b * 3 + 2])
  );
  const wolke = new Float64Array(roh.length);
  const rho = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = idx[i];
    wolke[i * 3] = roh[j * 3];
    wolke[i * 3 + 1] = roh[j * 3 + 1];
    wolke[i * 3 + 2] = roh[j * 3 + 2];
    rho[i] = Math.hypot(roh[j * 3], roh[j * 3 + 1], roh[j * 3 + 2]);
  }
  return { form: g, wolke, rho, r0: 0, ab: 0 };
}

/**
 * Ein Grobsieb, wie `Naehefeld` eines ist — als Schnittstelle, damit es sich
 * ABSCHALTEN laesst.
 *
 * Das Sieb ist je Armstellung das teuerste Stueck (35.937 Stuetzwerte, rund
 * eine Drittelsekunde; 62 Armstellungen sind 19 s). Es lohnt sich, wenn danach
 * hundertmillionenfach gefragt wird — bei der Kippmessung also. Wer die Suppe
 * nur EINMAL durchlaeuft (`test/greifer-nullgrad.test.ts`), zahlt den Bau
 * umsonst.
 */
export interface Sieb {
  untere(px: number, py: number, pz: number): number;
}

/** Das Sieb, das nie siebt: „ueber den Abstand ist nichts bekannt." */
export const OHNE_SIEB: Sieb = { untere: () => 0 };

export interface Pose {
  boom: number;
  stick: number;
  u: THREE.Vector3;
  arm: Gitter;
  schlauch: Gitter | null;
  naehe: Sieb;
  namen: string[];
}

export function posenBauen(
  bagger: Excavator,
  szene: THREE.Scene,
  bg: number,
  sg: number,
  greiferR: number,
  /** Grobsieb bauen? Ohne es ist der Bau schnell, jede Abfrage danach teuer. */
  mitSieb = true
): Pose | null {
  const b = bagger as unknown as { boomAngle: number; stickAngle: number; rotatorYaw: number };
  b.boomAngle = bg / GRAD;
  b.stickAngle = sg / GRAD;
  b.rotatorYaw = 0;
  /*
   * Nur die Netze in ihre Pose bringen — NICHT `update()`. `update()` liefe
   * durch `resolveGroundClamp` und hoebe den Arm an, sobald die Spitzen unter
   * den Boden kaemen; die Armstellung waere dann nicht die gemessene.
   */
  (bagger as unknown as { syncMeshes(): void }).syncMeshes();
  const u = bagger.grappleGroup.position.clone();
  const inReichweite = (m: THREE.Mesh): boolean => {
    for (let p: THREE.Object3D | null = m; p; p = p.parent) {
      if (p === bagger.grappleGroup) return false;
    }
    m.geometry.computeBoundingSphere();
    const bs = m.geometry.boundingSphere!;
    const c = bs.center.clone().applyMatrix4(m.matrixWorld);
    const s = m.getWorldScale(new THREE.Vector3());
    return c.distanceTo(u) < bs.radius * Math.max(s.x, s.y, s.z) + greiferR + DECKEL;
  };
  const armSuppe: Suppe = dreieckssuppe(szene, (m) => inReichweite(m) && !SCHLAUCH.test(m.name));
  const schlauchSuppe: Suppe = dreieckssuppe(szene, (m) => inReichweite(m) && SCHLAUCH.test(m.name));
  if (armSuppe.tri.length === 0) return null;
  const arm = new Gitter(armSuppe, 0.2);
  const schlauch = schlauchSuppe.tri.length ? new Gitter(schlauchSuppe, 0.2) : null;
  /*
   * Das Grobsieb wird ueber BEIDE Suppen gebaut, damit es fuer beide eine
   * gueltige untere Schranke ist — ein Sieb, das den Schlauch nicht kennt,
   * wuerde Punkte wegwerfen, die nur dem Schlauch nahe sind.
   */
  const beide: Suppe = schlauchSuppe.tri.length
    ? {
        tri: Float64Array.from([...armSuppe.tri, ...schlauchSuppe.tri]),
        netz: Int32Array.from([...armSuppe.netz, ...schlauchSuppe.netz]),
        namen: armSuppe.namen,
      }
    : armSuppe;
  const naehe: Sieb = mitSieb
    ? new Naehefeld(new Gitter(beide, 0.2), u, greiferR + 0.05, 0.2, DECKEL)
    : OHNE_SIEB;
      /*
       * Zellweite 0,20 — nicht feiner. Das Sieb wird je Armstellung EINMAL
       * gebaut und danach hundertmillionenfach abgefragt; feiner siebt es
       * schaerfer, kostet aber im Wuerfel. Gemessen: 0,12 m sind 157.464
       * Stuetzwerte je Armstellung und liessen den Bau der 81 Stellungen ueber
       * zwoelf Minuten laufen, ohne fertig zu werden; 0,20 m sind 35.937 und
       * brauchen rund eine Drittelsekunde.
       */
  return { boom: bg, stick: sg, u, arm, schlauch, naehe, namen: armSuppe.namen };
}

/**
 * Die Eichung: der kleinste Halbmesser um das Kardangelenk, ab dem bei
 * Kippwinkel 0 alles frei ist.
 *
 * Gerechnet wird ueber alle Armstellungen und alle Rotatorstellungen. Fuer
 * jeden Punkt wird sein kleinster Abstand gemerkt; R0 ist dann der groesste
 * Halbmesser eines Punktes, der irgendwo naeher als EPS herankommt.
 */
/**
 * Vorprobe: Welche Armstellungen sind HEUTE, bei Kippwinkel 0, sauber?
 *
 * Gemessen wird nur mit Punkten jenseits von `VORHALT` — die Aufhaengung
 * darunter steckt bauartbedingt im Stiel. Ob `VORHALT` gross genug gewaehlt
 * ist, prueft die Eichung danach selbst nach: Kommt R0 groesser heraus als
 * VORHALT, ist die Vorprobe blind gewesen und meldet das.
 */
export const VORHALT = 0.8;

function vorprobe(
  f: Form,
  posen: Pose[],
  gier: number[],
  h: number
): { sauber: Pose[]; beruehrend: Pose[] } {
  const E = eps(h);
  const n = f.wolke.length / 3;
  let ab = 0;
  while (ab < n && f.rho[ab] <= VORHALT) ab++;
  const sauber: Pose[] = [];
  const beruehrend: Pose[] = [];
  const dreckig: string[] = [];
  for (const p of posen) {
    let min = DECKEL;
    for (const g of gier) {
      const cy = Math.cos(g / GRAD);
      const sy = Math.sin(g / GRAD);
      for (let i = ab; i < n; i++) {
        const px = f.wolke[i * 3];
        const py = f.wolke[i * 3 + 1];
        const pz = f.wolke[i * 3 + 2];
        const wx = p.u.x + px * cy + pz * sy;
        const wy = p.u.y + py;
        const wz = p.u.z - px * sy + pz * cy;
        if (p.naehe.untere(wx, wy, wz) >= min) continue;
        const d = p.arm.abstand(wx, wy, wz, min).d;
        if (d < min) min = d;
      }
    }
    if (min > E) sauber.push(p);
    else {
      beruehrend.push(p);
      dreckig.push(`${p.boom}°/${p.stick}°`);
    }
  }
  console.log(
    `  Vorprobe ${f.form.name}: ${sauber.length} von ${posen.length} Armstellungen sind bei 0° frei.`
  );
  if (dreckig.length) {
    console.log(
      `    HEUTE SCHON BERUEHRUNG bei 0° in: ${dreckig.join(", ")} — dort ist die Kippfrage nicht stellbar.`
    );
  }
  return { sauber, beruehrend };
}

function eichung(f: Form, posen: Pose[], gier: number[], h: number): void {
  const E = eps(h);
  const n = f.wolke.length / 3;
  const naeheste = new Float64Array(n).fill(DECKEL);
  for (const p of posen) {
    for (const g of gier) {
      const cy = Math.cos(g / GRAD);
      const sy = Math.sin(g / GRAD);
      for (let i = 0; i < n; i++) {
        if (naeheste[i] <= E) continue;
        const px = f.wolke[i * 3];
        const py = f.wolke[i * 3 + 1];
        const pz = f.wolke[i * 3 + 2];
        const wx = p.u.x + px * cy + pz * sy;
        const wy = p.u.y + py;
        const wz = p.u.z - px * sy + pz * cy;
        if (p.naehe.untere(wx, wy, wz) >= naeheste[i]) continue;
        const d = p.arm.abstand(wx, wy, wz, naeheste[i]).d;
        if (d < naeheste[i]) naeheste[i] = d;
      }
    }
  }
  let r0 = 0;
  for (let i = 0; i < n; i++) if (naeheste[i] <= E && f.rho[i] > r0) r0 = f.rho[i];
  f.r0 = r0;
  let ab = 0;
  while (ab < n && f.rho[ab] <= r0) ab++;
  f.ab = ab;
  console.log(
    `  Eichung ${f.form.name}: R0 = ${r0.toFixed(3)} m um das Kardangelenk.` +
      ` ${ab} von ${n} Punkten liegen darin (Aufhaengung, steckt bauartbedingt im Stiel),` +
      ` ${n - ab} werden gemessen.`
  );
  if (r0 >= VORHALT) {
    console.log(
      `    ACHTUNG: R0 >= VORHALT (${VORHALT} m). Die Vorprobe war blind — ihre` +
        ` Auswahl sauberer Armstellungen ist nicht belastbar.`
    );
  }
}

/* ----------------------------------------------- Nullgrad: wie tief steckt es */

/**
 * Ein einzelnes Armnetz als eigene Dreiecksliste mit Kasten.
 *
 * Fuer die Frage „wie tief" reicht der Punktabstand nicht: Er wird NIE
 * negativ. Ein Punkt einen halben Meter tief im Stiel meldet „einen halben
 * Meter Abstand" — genau wie einer einen halben Meter daneben. Die Tiefe
 * braucht ein VORZEICHEN, und das Vorzeichen braucht die Frage „liegt der
 * Punkt innen".
 */
interface Netzteil {
  name: string;
  tri: Float64Array;
  lo: [number, number, number];
  hi: [number, number, number];
}

function netzteile(s: Suppe): Netzteil[] {
  const nach = new Map<number, number[]>();
  for (let d = 0; d < s.netz.length; d++) {
    const o = d * 9;
    let l = nach.get(s.netz[d]);
    if (!l) nach.set(s.netz[d], (l = []));
    for (let k = 0; k < 9; k++) l.push(s.tri[o + k]);
  }
  const raus: Netzteil[] = [];
  for (const [idx, zahlen] of nach) {
    const tri = Float64Array.from(zahlen);
    const lo: [number, number, number] = [Infinity, Infinity, Infinity];
    const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tri.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (tri[i + a] < lo[a]) lo[a] = tri[i + a];
        if (tri[i + a] > hi[a]) hi[a] = tri[i + a];
      }
    }
    raus.push({ name: s.namen[idx] ?? "?", tri, lo, hi });
  }
  return raus;
}

/**
 * WINDUNGSZAHL statt Strahlenzaehlung.
 *
 * Der uebliche Innentest schiesst einen Strahl und zaehlt Durchstiche: ungerade
 * = innen. Er versagt hier an zwei Stellen. Erstens sind die Armnetze
 * VERSCHMOLZEN (E-025): `07_STIEL_STAHL` ist EIN Netz aus Gusskopf, zwei
 * Laschen, Bolzen und zwei Scheiben. Stecken zwei davon ineinander, zaehlt ein
 * Strahl durch die Ueberschneidung ZWEI Durchstiche je Seite — gerade, also
 * „aussen", obwohl der Punkt mitten im Stahl liegt. Zweitens trifft ein Strahl
 * hin und wieder genau eine Kante, und dann ist die Antwort Muenzwurf.
 *
 * Die Windungszahl summiert stattdessen die Raumwinkel aller Dreiecke. Sie ist
 * 0 draussen, 1 in einem Koerper, 2 in der Ueberschneidung zweier Koerper —
 * die Ueberdeckung faellt also nicht heraus, sondern zaehlt hoch. Und sie ist
 * stetig: Kantentreffer geben keinen Sprung, sondern einen Zwischenwert.
 * (Jacobson u. a., „Robust Inside-Outside Segmentation using Generalized
 * Winding Numbers", 2013.) Gewertet wird ab 0,5.
 */
function windungszahl(px: number, py: number, pz: number, t: Float64Array): number {
  let w = 0;
  for (let i = 0; i < t.length; i += 9) {
    const ax = t[i] - px, ay = t[i + 1] - py, az = t[i + 2] - pz;
    const bx = t[i + 3] - px, by = t[i + 4] - py, bz = t[i + 5] - pz;
    const cx = t[i + 6] - px, cy = t[i + 7] - py, cz = t[i + 8] - pz;
    const la = Math.hypot(ax, ay, az);
    const lb = Math.hypot(bx, by, bz);
    const lc = Math.hypot(cx, cy, cz);
    if (la === 0 || lb === 0 || lc === 0) return 1; // genau auf einer Ecke
    const zaehler =
      ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    const nenner =
      la * lb * lc +
      (ax * bx + ay * by + az * bz) * lc +
      (bx * cx + by * cy + bz * cz) * la +
      (cx * ax + cy * ay + cz * az) * lb;
    w += 2 * Math.atan2(zaehler, nenner);
  }
  return w / (4 * Math.PI);
}

/** Abstand eines Punktes zur Oberflaeche EINES Netzes — ungedeckelt. */
function abstandZumNetz(px: number, py: number, pz: number, t: Float64Array): number {
  let best = Infinity;
  for (let i = 0; i < t.length; i += 9) {
    const d = punktDreieck(px, py, pz, t, i);
    if (d < best) best = d;
  }
  return best;
}

interface Befund {
  boom: number;
  stick: number;
  /** Kleinster Punktabstand ueber alle Rotatorstellungen (m). */
  abstand: number;
  /** Rotatorstellungen, in denen es sich beruehrt. */
  gierTreffer: number[];
  /** Tiefste Eindringung ueber alle Rotatorstellungen (m, 0 = nur streifend). */
  tiefe: number;
  /** Zahl der Greiferpunkte, die in einem Armnetz stecken (schlimmste Gierlage). */
  drin: number;
  /** Welches Armnetz. */
  armnetz: string;
  /** Wo am Greifer, im Greiferframe: Hoehe unter dem Kardan und Achsabstand. */
  greiferOrt: { unter: number; achse: number; rho: number };
  /** Ausladung der Stielspitze vom Drehmittelpunkt (m) und ihre Hoehe (m). */
  ausladung: number;
  spitzeY: number;
}

/**
 * Kommt die Armstellung im Betrieb ueberhaupt vor? — die Regel des
 * Bodenanschlags selbst, ohne die Zugabe von `HOCHSTAND`.
 *
 * `resolveGroundClamp` haelt die Stielspitze auf
 *     Weltspitze >= Flaeche + maxAusladung(kipp) + 0,02.
 * `flaeche` kommt aus einem Strahl NACH UNTEN auf tragenden Grund; das
 * Tiefste, was er treffen kann, ist der Beton auf 0. Bei Kippwinkel 0 ist
 * `maxAusladung(0)` Ziffer fuer Ziffer `maxTiefe`. Die tiefste Stellung, die
 * das Spiel je haelt, ist also `maxTiefe + 0,02` — und zwar unabhaengig davon,
 * wo die Maschine steht.
 *
 * WARUM DAS ANDERS AUSFAELLT ALS DER FILTER DER MESSUNG: `HOCHSTAND` laesst
 * 1,50 m tiefer zu, mit der Begruendung, eine Ladeflaeche liege 1,05 m hoch.
 * Die Rechnung geht aber in die andere Richtung — steht der Greifer auf einer
 * Ladeflaeche, ist `flaeche` GROESSER und die Spitze muss HOEHER stehen, nicht
 * tiefer. Der Filter der Messung ist damit zu grosszuegig; er wird hier NICHT
 * geaendert (an ihm haengt die Zahl „62 von 81" aus E-085), sondern nur
 * danebengestellt.
 */
export function amBodenErreichbar(spitzeY: number, maxTiefe: number): boolean {
  return spitzeY >= maxTiefe + 0.02;
}

/**
 * Der Bericht fuer EINE Armstellung: wie nah, wie tief, wo.
 *
 * Gemessen wird mit demselben Ausschluss wie die Vorprobe (`VORHALT`), damit
 * die Zahl der beruehrenden Stellungen mit ihrer uebereinstimmt.
 */
function nullgradBefund(
  f: Form,
  p: Pose,
  gier: number[],
  h: number,
  /** Drehmittelpunkt der Maschine in der Welt — sie steht NICHT im Ursprung. */
  stand: THREE.Vector3
): Befund {
  const E = eps(h);
  const n = f.wolke.length / 3;
  let ab = 0;
  while (ab < n && f.rho[ab] <= VORHALT) ab++;
  const teile = netzteile(p.arm.suppe);
  // Ein Kasten ueber ALLE Armnetze — ein Vergleich wirft die meisten
  // Greiferpunkte weg, bevor die Einzelkaesten drankommen.
  const gLo = [Infinity, Infinity, Infinity];
  const gHi = [-Infinity, -Infinity, -Infinity];
  for (const t of teile)
    for (let a = 0; a < 3; a++) {
      if (t.lo[a] < gLo[a]) gLo[a] = t.lo[a];
      if (t.hi[a] > gHi[a]) gHi[a] = t.hi[a];
    }

  const b: Befund = {
    boom: p.boom,
    stick: p.stick,
    abstand: DECKEL,
    gierTreffer: [],
    tiefe: 0,
    drin: 0,
    armnetz: "—",
    greiferOrt: { unter: 0, achse: 0, rho: 0 },
    /*
     * Ausladung vom DREHMITTELPUNKT, nicht vom Weltursprung: Die Maschine
     * steht auf ihrem Standplatz (−0,5 | −22,5), und `p.u` ist eine
     * Weltkoordinate. Ohne den Abzug meldete die Uebersicht Ausladungen um
     * 18 m — die ganze Maschine reicht 9,5 m.
     */
    ausladung: Math.hypot(p.u.x - stand.x, p.u.z - stand.z),
    spitzeY: p.u.y - stand.y,
  };

  for (const g of gier) {
    const cy = Math.cos(g / GRAD);
    const sy = Math.sin(g / GRAD);
    let minG = DECKEL;
    let drinG = 0;
    let tiefG = 0;
    let netzG = "—";
    let ortG = { unter: 0, achse: 0, rho: 0 };
    for (let i = ab; i < n; i++) {
      const px = f.wolke[i * 3];
      const py = f.wolke[i * 3 + 1];
      const pz = f.wolke[i * 3 + 2];
      const wx = p.u.x + px * cy + pz * sy;
      const wy = p.u.y + py;
      const wz = p.u.z - px * sy + pz * cy;
      // (a) der kleinste Abstand — wie in der Vorprobe
      if (p.naehe.untere(wx, wy, wz) < minG) {
        const d = p.arm.abstand(wx, wy, wz, minG);
        if (d.d < minG) {
          minG = d.d;
          if (d.netz >= 0) netzG = p.namen[d.netz] ?? "?";
          ortG = { unter: -py, achse: Math.hypot(px, pz), rho: f.rho[i] };
        }
      }
      // (b) steckt der Punkt in einem Armnetz?
      if (wx < gLo[0] || wx > gHi[0] || wy < gLo[1] || wy > gHi[1] || wz < gLo[2] || wz > gHi[2])
        continue;
      for (const t of teile) {
        if (wx < t.lo[0] || wx > t.hi[0]) continue;
        if (wy < t.lo[1] || wy > t.hi[1]) continue;
        if (wz < t.lo[2] || wz > t.hi[2]) continue;
        if (windungszahl(wx, wy, wz, t.tri) < 0.5) continue;
        drinG++;
        const tief = abstandZumNetz(wx, wy, wz, t.tri);
        if (tief > tiefG) {
          tiefG = tief;
          netzG = t.name;
          ortG = { unter: -py, achse: Math.hypot(px, pz), rho: f.rho[i] };
        }
      }
    }
    if (minG <= E || drinG > 0) b.gierTreffer.push(g);
    if (minG < b.abstand) b.abstand = minG;
    if (tiefG > b.tiefe || (b.tiefe === 0 && drinG > b.drin)) {
      b.tiefe = Math.max(b.tiefe, tiefG);
      b.drin = drinG;
      b.armnetz = netzG;
      b.greiferOrt = ortG;
    } else if (b.armnetz === "—" && minG <= E) {
      b.armnetz = netzG;
      b.greiferOrt = ortG;
    }
  }
  return b;
}

/* --------------------------------------------------------------- Messlauf */

function messen(
  f: Form,
  posen: Pose[],
  lauf: Lauf
): { arm: Feld; schlauch: Feld; grob: number; genau: number } {
  const arm: Feld = new Map();
  const schlauch: Feld = new Map();
  let grob = 0;
  let genau = 0;
  const n = f.wolke.length / 3;
  const cK = lauf.kipp.map((d) => Math.cos(d / GRAD));
  const sK = lauf.kipp.map((d) => Math.sin(d / GRAD));
  const cG = lauf.gier.map((d) => Math.cos(d / GRAD));
  const sG = lauf.gier.map((d) => Math.sin(d / GRAD));

  let n0 = 0;
  for (const p of posen) {
    const t0 = Date.now();
    const pose = `Ausleger ${p.boom}°/Stiel ${p.stick}°`;
    for (let ki = 0; ki < lauf.kipp.length; ki++) {
      const ck = cK[ki];
      const sk = sK[ki];
      for (let gi = 0; gi < lauf.gier.length; gi++) {
        const cy = cG[gi];
        const sy = sG[gi];
        const key = `${lauf.kipp[ki]}|${lauf.gier[gi]}`;
        const altA = arm.get(key);
        const altS = schlauch.get(key);
        let minA = altA ? altA.d : DECKEL;
        let minS = altS ? altS.d : DECKEL;
        let woA = -1;
        let trefferA = false;
        let trefferS = false;
        const sieb = Math.max(minA, minS);
        for (let i = f.ab; i < n; i++) {
          const px = f.wolke[i * 3];
          const py = f.wolke[i * 3 + 1];
          const pz = f.wolke[i * 3 + 2];
          const y1 = py * ck - pz * sk;
          const z1 = py * sk + pz * ck;
          const wx = p.u.x + px * cy + z1 * sy;
          const wy = p.u.y + y1;
          const wz = p.u.z - px * sy + z1 * cy;
          grob++;
          if (p.naehe.untere(wx, wy, wz) >= sieb) continue;
          genau++;
          const q = p.arm.abstand(wx, wy, wz, minA);
          if (q.d < minA) {
            minA = q.d;
            woA = q.netz;
            trefferA = true;
          }
          if (p.schlauch) {
            const s = p.schlauch.abstand(wx, wy, wz, minS);
            if (s.d < minS) {
              minS = s.d;
              trefferS = true;
            }
          }
        }
        if (!altA || minA < altA.d) {
          arm.set(key, {
            d: minA,
            wo: trefferA && woA >= 0 ? p.namen[woA] : (altA?.wo ?? "—"),
            pose: trefferA ? pose : (altA?.pose ?? "—"),
          });
        }
        if (!altS || minS < altS.d) {
          schlauch.set(key, {
            d: minS,
            wo: "Schlauch",
            pose: trefferS ? pose : (altS?.pose ?? "—"),
          });
        }
      }
    }
    n0++;
    process.stderr.write(
      `    ${f.form.name} ${n0}/${posen.length} (${pose}) ${((Date.now() - t0) / 1000).toFixed(1)} s, ${(genau / 1000).toFixed(0)}k genau\n`
    );
  }
  return { arm, schlauch, grob, genau };
}

function auswerten(titel: string, lauf: Lauf, feld: Feld, schlauch: Feld, f: Form): number {
  const E = eps(lauf.h);
  console.log(`\n--- ${titel} ---`);
  console.log(
    `  Raster ${(lauf.h * 100).toFixed(1)} cm → Abtastfehler EPS = ${(E * 1000).toFixed(1)} mm` +
      `  ·  R0 = ${f.r0.toFixed(3)} m  ·  ${(f.wolke.length / 3 - f.ab).toLocaleString("de-DE")} Punkte gemessen\n`
  );
  console.log("  Kipp  | beste Rotatorstellung          | dort  | schlechteste Rotator- | zum");
  console.log("  winkel| Freigang mindestens            | Gier  | stellung              | Schlauch");
  console.log("  ------+--------------------------------+-------+-----------------------+---------");
  let grenze = -1;
  for (const d of lauf.kipp) {
    let hoch = { d: -Infinity, gier: 0, wo: "—", pose: "—" };
    let tief = { d: Infinity, gier: 0, wo: "—", pose: "—" };
    let sMin = Infinity;
    for (const g of lauf.gier) {
      const e = feld.get(`${d}|${g}`);
      if (e) {
        if (e.d > hoch.d) hoch = { d: e.d, gier: g, wo: e.wo, pose: e.pose };
        if (e.d < tief.d) tief = { d: e.d, gier: g, wo: e.wo, pose: e.pose };
      }
      const s = schlauch.get(`${d}|${g}`);
      if (s && s.d < sMin) sMin = s.d;
    }
    const frei = hoch.d > E;
    if (frei) grenze = d;
    const txt = frei
      ? `${(hoch.d - E).toFixed(3)} m ${hoch.d >= DECKEL ? "(nichts in Reichweite)" : `(${hoch.wo})`}`
      : `BERUEHRUNG an ${hoch.wo}`;
    const ttxt = tief.d > E ? `${(tief.d - E).toFixed(3)} m` : `BERUEHRUNG (${tief.wo})`;
    console.log(
      `  ${String(d).padStart(4)}° | ${txt.padEnd(31)}| ${String(hoch.gier).padStart(4)}° | ${ttxt.padEnd(22)}| ${
        sMin > E ? `${(sMin - E).toFixed(3)} m` : "beruehrt"
      }`
    );
  }
  console.log("\n  Welche Rotatorstellungen bei welchem Kippwinkel frei bleiben:");
  for (const d of lauf.kipp) {
    const frei = lauf.gier.filter((g) => (feld.get(`${d}|${g}`)?.d ?? 0) > E);
    const txt =
      frei.length === 0
        ? "keine"
        : frei.length === lauf.gier.length
          ? `alle ${lauf.gier.length}`
          : `${frei.length} von ${lauf.gier.length}: ${frei.join("°, ")}°`;
    console.log(`   ${String(d).padStart(4)}° | ${txt}`);
  }
  return grenze;
}

async function main(): Promise<void> {
  const nullgrad = process.argv.includes("nullgrad");
  const lauf = nullgrad
    ? NULLGRAD
    : process.argv.includes("fein")
      ? FEIN
      : process.argv.includes("probe")
        ? PROBE
        : UEBERSICHT;
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  const bagger = new Excavator(szene, world);
  /*
   * Der Drehmittelpunkt der Maschine. Sie steht auf ihrem Standplatz
   * (`world/baggerstand.ts`), NICHT im Ursprung — wer Ausladungen aus den
   * Weltkoordinaten der Stielspitze rechnet, muss ihn abziehen.
   */
  const stand = bagger.position.clone();

  console.log(`=== Freigang des gekippten Greifers — auf Dreiecksebene (${lauf.name}) ===\n`);
  console.log(
    `  ${lauf.boom.length} x ${lauf.stick.length} = ${lauf.boom.length * lauf.stick.length} Armstellungen` +
      ` · ${lauf.kipp.length} Kippwinkel · ${lauf.gier.length} Rotatorstellungen · ${lauf.splay} Oeffnungen`
  );

  // Beide Formen einmal abtasten, nach Halbmesser sortiert
  const formen: Form[] = [];
  let greiferR = 0;
  for (const g of [SICHELKRALLE, FUENFSCHALEN]) {
    const f = formVermessen(bagger, g, lauf.h, lauf.splay);
    const n = f.rho.length;
    greiferR = Math.max(greiferR, f.rho[n - 1]);
    formen.push(f);
    console.log(
      `  ${g.name}: ${n.toLocaleString("de-DE")} Punkte, groesster Halbmesser ${f.rho[n - 1].toFixed(3)} m`
    );
  }

  console.log("\n  Armstellungen werden gebaut …");
  const t0 = Date.now();
  const posen: Pose[] = [];
  let verworfen = 0;
  const tiefste = Math.max(SICHELKRALLE.maxTiefe, FUENFSCHALEN.maxTiefe);
  for (const bg of lauf.boom) {
    for (const sg of lauf.stick) {
      const p = posenBauen(bagger, szene, bg, sg, greiferR);
      if (!p) continue;
      if (p.u.y < tiefste + 0.02 - HOCHSTAND) {
        verworfen++;
        continue;
      }
      posen.push(p);
    }
  }
  console.log(
    `  ${posen.length} Armstellungen erreichbar, ${verworfen} verworfen` +
      ` (Stielspitze unter ${(tiefste + 0.02 - HOCHSTAND).toFixed(2)} m — dort steckt der Greifer im Boden),` +
      ` ${((Date.now() - t0) / 1000).toFixed(0)} s\n`
  );

  const sauber = new Map<string, Pose[]>();
  const beruehrend = new Map<string, Pose[]>();
  for (const f of formen) {
    const s = vorprobe(f, posen, lauf.gier, lauf.h);
    sauber.set(f.form.id, s.sauber);
    beruehrend.set(f.form.id, s.beruehrend);
    eichung(f, s.sauber, lauf.gier, lauf.h);
  }

  if (nullgrad) {
    for (const f of formen) {
      console.log(`\n\n################  ${f.form.name} — Nullgrad  ################`);
      const treffer = beruehrend.get(f.form.id)!;
      console.log(
        `  ${treffer.length} von ${posen.length} erreichbaren Armstellungen beruehren den Arm` +
          ` schon bei Kippwinkel 0 (Ausschluss: alles innerhalb ${VORHALT} m um das Kardangelenk,` +
          ` gemessenes R0 = ${f.r0.toFixed(3)} m).\n`
      );
      if (treffer.length === 0) continue;
      console.log(
        `  Der Bodenanschlag laesst die Stielspitze bei Kippwinkel 0 nie unter` +
          ` ${(f.form.maxTiefe + 0.02).toFixed(2)} m ueber Beton (maxTiefe ${f.form.maxTiefe.toFixed(4)} m + 0,02).\n`
      );
      console.log(
        "  Ausleger | Stiel   | Abstand | Eindring- | Punkte | Rotator-  | Armnetz               | Greiferpunkt     | Ausladung | Spitze | im"
      );
      console.log(
        "           |         | (m)     | tiefe (m) | drin   | stellungen|                       | unter / Achse    | (m)       | (m)    | Betrieb"
      );
      console.log(
        "  ---------+---------+---------+-----------+--------+-----------+-----------------------+------------------+-----------+--------+--------"
      );
      let echt = 0;
      for (const p of treffer) {
        const t = Date.now();
        const b = nullgradBefund(f, p, lauf.gier, lauf.h, stand);
        const erreichbar = amBodenErreichbar(b.spitzeY, f.form.maxTiefe);
        if (erreichbar && b.tiefe > 0) echt++;
        console.log(
          `  ${String(b.boom).padStart(7)}° | ${String(b.stick).padStart(6)}° |` +
            ` ${b.abstand >= DECKEL ? " >0.15 " : b.abstand.toFixed(3).padStart(7)} |` +
            ` ${b.tiefe.toFixed(3).padStart(9)} | ${String(b.drin).padStart(6)} |` +
            ` ${`${b.gierTreffer.length}/${lauf.gier.length}`.padStart(9)} | ${b.armnetz.padEnd(21)} |` +
            ` ${`${b.greiferOrt.unter.toFixed(2)} / ${b.greiferOrt.achse.toFixed(2)}`.padEnd(16)} |` +
            ` ${b.ausladung.toFixed(2).padStart(9)} | ${b.spitzeY.toFixed(2).padStart(6)} | ${erreichbar ? "ja" : "NEIN"}`
        );
        process.stderr.write(`    (${((Date.now() - t) / 1000).toFixed(1)} s)\n`);
      }
      console.log(
        `\n  Davon mit echter Durchdringung UND vom Bodenanschlag erlaubt: ${echt}.`
      );
    }
    return;
  }

  for (const f of formen) {
    console.log(`\n\n################  ${f.form.name}  ################`);
    const t = Date.now();
    const r = messen(f, sauber.get(f.form.id)!, lauf);
    console.log(
      `  ${r.grob.toLocaleString("de-DE")} Abstandsfragen, davon ${r.genau.toLocaleString("de-DE")} genau gerechnet` +
        `  (${((Date.now() - t) / 1000).toFixed(0)} s)`
    );
    const grenze = auswerten(f.form.name, lauf, r.arm, r.schlauch, f);
    console.log(
      `\n  >>> ${f.form.name}: GROESSTER KIPPWINKEL, der in JEDER Armstellung frei laeuft` +
        ` (bei passender Rotatorstellung): ${grenze}°`
    );
  }
}

/*
 * NUR beim Aufruf von Hand messen, nicht beim Importieren.
 *
 * `test/greifer-nullgrad.test.ts` holt sich aus dieser Datei die
 * Armstellungen und den Ausschluss (`posenBauen`, `VORHALT`, die
 * Gelenkgrenzen), damit der Waechter dieselbe Auswahl prueft, die hier
 * gemessen wird — und nicht eine zweite, die auseinanderlaufen kann.
 * Ohne diese Zeile liefe beim `import` die ganze Messung los (Minuten).
 *
 * `process.env.VITEST` setzt Vitest selbst auf `"true"`; nachgeprueft am
 * 16.09.2026 mit einem Wegwerftest.
 */
if (!process.env.VITEST) void main();
