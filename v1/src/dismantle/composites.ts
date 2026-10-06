import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CAR_DEF, type CarDef, type PartDef } from "./carDef";
import type { ItemManager } from "../world/scrapItems";
import type { EventBus } from "../core/events";
import { AUTOLACK, lackton, verwittert } from "../world/objektbau";
import { farbstoff, verschmelzeBunt, type Bauteil } from "../excavator/bauteile";
import {
  WRACKFORMEN,
  baueWrackform,
  type BlechDef,
  type Druckrichtung,
  type WrackformDef,
  type WrackformId,
} from "./wrackformen";

/**
 * Verbundobjekt-System (Briefing Kap. 8, M2-Umfang):
 * - Rumpf = ein dynamischer Körper; Parts (Motor, Räder) hängen als Meshes dran.
 * - Aufprall-Erkennung über Geschwindigkeitssprung (Δv pro Step): Scheiben
 *   bersten, Karosse nimmt Quetschstufen (Modell-Squash + Kollidertausch).
 * - Abreißen: Spinne fasst nahe eines Part-Ankers die Part statt des Rumpfs,
 *   Ziehen über tearSeconds reißt sie heraus → eigenständiges ScrapItem.
 */

/**
 * Wieviel Schliesskraft einem Aufprall-Delta-V entspricht (kN je m/s).
 *
 * EINE Zahl, damit Zudruecken und Aufprall dieselben drei Schwellen benutzen
 * (siehe `CarComposite.beissen`). Hergeleitet aus der Messung in E-112: ein
 * voller Biss auf ein Autowrack sind 15,70 kN und soll `crushImpactDv` (7)
 * genau erreichen.
 */
const KN_JE_MS = 15.7 / 7;

/** Reiß-Ziel für das Greifsystem */
export interface TearTarget {
  id: string;
  name: string;
  tearSeconds: number;
  anchorWorld: THREE.Vector3;
  tear: () => RAPIER.RigidBody;
}

interface AttachedPart {
  def: PartDef;
  mesh: THREE.Object3D;
  attached: boolean;
}

const SETTLE_GRACE_STEPS = 90; // nach Spawn keine Aufprall-Events (Setzen des Wracks)

/* ------------------------------------------------------------------------- */
/* DER HOHLKOERPER (E-124)                                                    */
/* ------------------------------------------------------------------------- */

/** Achse (0 x, 1 y, 2 z) und Vorzeichen einer Druckrichtung. */
const ACHSE: Record<Druckrichtung, { k: 0 | 1 | 2; sg: 1 | -1 }> = {
  "-y": { k: 1, sg: -1 },
  "+x": { k: 0, sg: 1 },
  "-x": { k: 0, sg: -1 },
  "+z": { k: 2, sg: 1 },
  "-z": { k: 2, sg: -1 },
};

/**
 * Duenner wird kein Blech, in m — darunter wandert es als Platte weiter.
 * Rapier-Lehre „Bleche mit Mindestdicke": Eine Schale ist eine Kapsel mit
 * 9 cm Radius; 12 cm Blech plus 18 cm Kapsel lassen ihr rund 30 cm, bevor sie
 * in einem Bild hindurchspringen koennte. // SW
 */
const MIN_DICKE = 0.12;

/**
 * Wie weit neben einem Blech die Haut noch mitgeht, in m: Ein eingedruecktes
 * Dach zieht den Rand der Windschutzscheibe ein Stueck mit, statt an einer
 * scharfen Kante abzureissen. // SW
 */
const HAUT_RAND = 0.3;

/**
 * Wie uneben ein eingedruecktes Blech wird: Jeder Eckpunkt geht um bis zu so
 * viel mehr oder weniger mit (Anteil). Fest je Eckpunkt statt gewuerfelt — die
 * Haut sieht nach jedem Biss gleich zerknittert aus, und am Zufallsstrom der
 * anderen Waechter aendert sich nichts. // SW
 */
const KNITTER = 0.2;

/**
 * Wie lange ein Schalenkontakt als Druckstelle gilt, in Physikschritten.
 *
 * Der Biss kommt 0,7 s nach Beginn des Zudrueckens (`DRUCK_S` am Bagger). Hat
 * die Spinne das Wrack bis dahin gefasst, sind ihre Schalen-Kollider aus, und
 * Rapier meldet keinen Kontakt mehr — die letzte Stelle davor ist dann die
 * richtige. Solange das Wrack in der Spinne haengt, gilt sie weiter. // SW
 */
const DRUCK_GEDAECHTNIS = 60;

/** Fester Wert −1…1 je Eckpunkt (fuer `KNITTER`). */
function rauschen(i: number): number {
  let h = Math.imul(i + 1, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h % 2001) / 1000 - 1;
}

/**
 * In welcher Hoehe eine Spinne, die NEBEN dem Wrack steht, seitlich
 * hineindrueckt (m) — mitten in den Tueren (0,58…0,92). // SW
 */
const SEITEN_HOEHE = 0.75;

/**
 * Abstand eines Punkts von einem Blech, wie es AB WERK sitzt (m).
 *
 * Gezielt wird auf die Stelle, nicht auf das, was davon noch uebrig ist: Ist
 * eine Tuer schon eingedrueckt, liegt sie weiter innen — wer erneut auf sie
 * zielt, soll trotzdem sie treffen und nicht die Bodenwanne darunter
 * (gemessen: sonst gab die Tuer beim zweiten Biss nicht mehr nach).
 */
function abstand(p: [number, number, number], b: BlechDef): number {
  let d2 = 0;
  for (let j = 0; j < 3; j++) {
    const d = Math.max(0, Math.abs(p[j] - b.mitte[j]!) - b.halb[j]!);
    d2 += d * d;
  }
  return Math.sqrt(d2);
}

/** Wo gedrueckt wird: welches Blech und wo darauf (Wrack-lokal, ungequetscht). */
interface Druckstelle {
  blech: number;
  ort: THREE.Vector3;
}

/**
 * WELCHEN LACK HAT DIESES WRACK?
 *
 * Fest am Standort, nicht gewürfelt — dieselbe Regel wie bei `lackton` für
 * Bauteile: „Dasselbe Objekt sieht nach dem Laden eines Spielstands wieder
 * gleich aus, ohne dass die Farbe gespeichert werden müsste." Zwei Wracks, die
 * nebeneinander auf dem Hof stehen, haben verschiedene Standorte und deshalb
 * verschiedene Farben; dasselbe Wrack an derselben Stelle hat nach dem Laden
 * wieder seine.
 *
 * Das Alter kommt aus derselben Zahl, damit ein blaues Wrack nicht einmal
 * frisch und einmal durchgerostet dasteht: 0,25 bis 0,85. Ganz unten wäre ein
 * Neuwagen, ganz oben wäre nichts mehr von der Farbe zu sehen. // SW
 */
function lackSchluessel(x: number, z: number): number {
  // Zentimeter statt Meter: Zwei Wracks 30 cm auseinander sollen sich
  // unterscheiden, und `lackton` rechnet mit gerundeten Zahlen.
  const cx = Math.round(x * 100);
  const cz = Math.round(z * 100);
  /*
   * Erst mischen, dann ziehen — und das ist nicht Zierde.
   *
   * Der erste Versuch gab `lackton` die Koordinaten direkt (cx, cz, cx+cz).
   * `lackton` wichtet sie mit 977, 613 und 419, rechnet also
   * 1396·cx + 1032·cz; beide Faktoren sind durch 4 teilbar, und von einer
   * Palette aus 16 Farben blieben davon 4 übrig. Gemessen kamen aus zwanzig
   * Standorten ZWEI verschiedene Lacke heraus.
   *
   * Zwei Stufen dagegen, beide nötig (jede einzeln nachgemessen mit
   * `tools/wracklack.ts` an zwölf Standorten auf einer Geraden — so stehen
   * Wracks auf einem Hof nämlich, in einer Reihe):
   *
   *   nur Koordinaten                    2 Grundtöne
   *   + Vormischen (Knuth-Faktoren)      2 Grundtöne — LINEAR bleibt linear
   *   + Lawine (xxHash-Nachmischen)      9 Grundtöne
   *
   * Die mittlere Zeile ist der Grund, warum die Lawine drin ist: Eine lineare
   * Abbildung, so gut ihre Faktoren auch sind, bildet eine Gerade wieder auf
   * eine Gerade ab. Erst das Schieben und Verodern bricht das auf.
   */
  let misch = (Math.imul(cx, 374761393) + Math.imul(cz, 2654435761)) >>> 0;
  misch ^= misch >>> 15;
  misch = Math.imul(misch, 2246822519) >>> 0;
  misch ^= misch >>> 13;
  misch = Math.imul(misch, 3266489917) >>> 0;
  misch ^= misch >>> 16;
  return misch;
}

/**
 * Der LACKTON ohne Verwitterung — ab Werk. Getrennt herausgereicht, weil ein
 * Wächter sonst die Grundfarbe nicht von der Alterung unterscheiden kann und
 * „zwölf verschiedene Farben" auch dann meldet, wenn es zwei Grundtöne in
 * zwölf Alterungsstufen sind. Genau das ist am 17.09. passiert.
 */
export function wrackGrundton(x: number, z: number): number {
  // 100000 ist durch 16 teilbar, die durchgerührten unteren Bits bleiben also
  // erhalten — und an ihnen hängt die Wahl aus der Palette.
  const k = lackSchluessel(x, z) % 100000;
  return lackton(AUTOLACK, k, k, k);
}

export function wrackLack(x: number, z: number): number {
  const streu = (lackSchluessel(x, z) >>> 11) % 100;
  return verwittert(wrackGrundton(x, z), 0.25 + (streu / 100) * 0.6);
}

/**
 * Aus dem Quader eine Karosserie formen.
 *
 * Der Rumpf war ein glatter Kasten von 1,7 x 0,55 x 4,0 m — daher der Eindruck
 * "sehr eckig". Statt neue Geometrie zu bauen, werden die Eckpunkte des
 * vorhandenen Quaders verschoben: Die Schnauze faellt ab und zieht sich ein,
 * das Heck ebenso etwas, die Schweller ruecken nach innen, die Flanken bauchen
 * leicht aus. Das muss vor dem Erfassen der Beul-Ausgangslage passieren, sonst
 * beulte die Physik gegen die alte Form.
 *
 * Der Weg ueber die Eckpunkte ist Absicht: Die Beul-Mechanik rechnet auf dem
 * regelmaessigen Gitter des Quaders, und das bleibt so erhalten.
 */
export function formeKarosserie(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  /*
   * Die halbe Laenge kommt aus der Geometrie selbst, nicht aus einer Konstante
   * (E-111). Vorher stand hier fest 2.0 — richtig fuer genau ein Modell. Ein
   * kuerzeres Chassis haette damit seine Schnauze im Nichts gehabt: Bei 3,60 m
   * Laenge liegt der vordere Rand bei z = 1,80, und `t > 0.5` haette erst ab
   * 1,00 statt ab 0,90 gegriffen.
   */
  geo.computeBoundingBox();
  const HALB_L = geo.boundingBox!.max.z;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const t = z / HALB_L; // -1 Heck ... +1 Schnauze
    const oben = y > 0;

    // Schnauze: schmaler und vorn abfallend (Motorhaube)
    if (t > 0.5) {
      const k = (t - 0.5) / 0.5;
      x *= 1 - 0.26 * k;
      if (oben) y -= 0.16 * k * k;
    }
    // Heck: leicht eingezogen, Kante gebrochen
    if (t < -0.55) {
      const k = (-t - 0.55) / 0.45;
      x *= 1 - 0.18 * k;
      if (oben) y -= 0.07 * k;
    }
    // Schweller: unten schmaler als auf Tuerhoehe — sonst steht das Auto
    // auf einem Brett
    if (!oben) x *= 0.9;
    // Flanken bauchen auf halber Hoehe leicht aus
    else x *= 1.04;

    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/**
 * Stossstangen, Leuchten, Kuehlergrill, Radlaeufe, Spiegel — EIN NETZ (E-111).
 *
 * Nichts davon ist noetig, damit das Wrack funktioniert — aber ein Kasten mit
 * Raedern liest sich erst als Auto, wenn vorne ein Gesicht dran ist. Alles
 * haengt im crushGroup, wird beim Pressen also mitgequetscht.
 *
 * WARUM EIN NETZ. Es waren dreizehn, jedes mit eigenem Material: ein Wrack
 * kostete 25 Netze und mit Schattenwurf 50 Zeichenrufe, zwei Wracks 100 — 7,6 %
 * der auf Patricks Geraet gemessenen 1322. Zeichenrufe sind hier der Engpass,
 * nicht Dreiecke (E-025). Keines der dreizehn Teile geht je einzeln ab; sie
 * gehoeren also zusammen, mit der Farbe an den Eckpunkten statt am Material —
 * dieselbe Rechnung wie am Bagger (E-025) und am Leiterrahmen (E-108).
 *
 * Die Radlaeufe stehen nicht in der Datenliste, sondern FOLGEN DEN RAEDERN:
 * Bogenradius = Radradius + `radlaufLuft`, Sitz = Radanker, 1 cm weiter aussen
 * und hoeher. Vier Koordinatenpaare weniger, die beim naechsten Modell
 * nachgezogen werden muessten.
 */
export function baueAnbauteile(
  gruppe: THREE.Group,
  def: CarDef,
  lack: number,
  /**
   * Halbtori über den Rädern bauen. Beim Bestand ja — dort ist die Karosserie
   * ein Kasten ohne Radlauf, und der Bogen ist das einzige, was einen andeutet.
   * Bei den Fassungen aus E-116 nein: Die Karosserie hat dort einen echten
   * Ausschnitt, und der Bogen läge mitten im Blech.
   */
  radlaufBogen = true
): THREE.Mesh {
  const k = def.karosserie;
  const halbeBreite = k.chassis[0] / 2;
  const halbeLaenge = k.chassis[2] / 2;
  const teile: Bauteil[] = [];

  for (const a of def.karosserie.anbau) {
    // Nicht paarweise heisst: einmal, an seinem x-Anteil (der dann 0 ist).
    for (const seite of a.paarweise ? [-1, 1] : [1]) {
      const geo = new THREE.BoxGeometry(a.size[0] * k.chassis[0], a.size[1], a.size[2]);
      geo.translate(seite * a.anchor[0] * halbeBreite, a.anchor[1], a.anchor[2] * halbeLaenge);
      teile.push({ geo, farbe: a.farbe });
    }
  }
  for (const rad of radlaufBogen ? def.parts : []) {
    if (rad.kind !== "wheel") continue;
    const [rx, ry, rz] = rad.anchor;
    const geo = new THREE.TorusGeometry(rad.size[0] + k.radlaufLuft, k.radlaufDicke, 6, 12, Math.PI);
    geo.rotateY(Math.PI / 2);
    geo.translate(rx + Math.sign(rx) * k.radlaufVersatz, ry + k.radlaufVersatz, rz);
    teile.push({ geo, farbe: lack });
  }

  const mesh = new THREE.Mesh(verschmelzeBunt(teile, "Anbauteile"), anbauStoff());
  mesh.castShadow = true;
  gruppe.add(mesh);
  return mesh;
}

/**
 * DAS EINE MATERIAL FUER ALLE ANBAUTEILE — einmal fuer das ganze Spiel.
 *
 * Es traegt keine wrackeigene Zahl (die Farben stecken in den Eckpunkten),
 * also braucht kein Wrack ein eigenes: zwei Wracks kommen mit 17 statt 24
 * Materialien aus, und der Renderer kann die Anbauteile beider Wracks
 * hintereinander zeichnen, ohne den Zustand zu wechseln.
 *
 * Rauheit 0,7 und Metallglanz 0,2 liegen zwischen den fuenf Materialien von
 * vorher (Kunststoff 0,85/0 bis Chrom 0,35/0,8). `flatShading` ist Absicht und
 * nicht Bequemlichkeit: Die Radlaeufe trugen vorher das Lackmaterial, und das
 * ist flach schattiert. Ohne diese Zeile waeren sie als einzige Teile am Wrack
 * glatt gerundet.
 */
let ANBAU_STOFF: THREE.MeshStandardMaterial | null = null;
function anbauStoff(): THREE.MeshStandardMaterial {
  if (!ANBAU_STOFF) {
    ANBAU_STOFF = farbstoff(0.7, 0.2); // SW, Mittel der fuenf Materialien von vorher
    ANBAU_STOFF.flatShading = true;
  }
  return ANBAU_STOFF;
}

/* ------------------------------------------------------------------------- */
/* WELCHE KAROSSERIEFORM GILT? (E-116)                                       */
/* ------------------------------------------------------------------------- */

/**
 * Die Karosserieform, in der Wracks gebaut werden, wenn nichts anderes verlangt
 * ist (E-117).
 *
 * GEWAEHLT VON PATRICK, 01.10.2026, am Bild: drei Fassungen aus dem laufenden
 * Spiel nebeneinander, dieselbe Stelle, derselbe Lack, dieselbe Kamera — er hat
 * "C, weich mit Sicken" genommen. Bis dahin war `"bestand"` die Vorgabe, damit
 * sich das Spiel nicht von selbst aendert, solange nichts entschieden ist.
 *
 * EINE Stelle fuer diese Wahl: Der Startwert unten und der Vorgabewert im
 * Bauplan (`CarComposite`) lesen beide diese Konstante. Vorher standen dort zwei
 * `"bestand"` — wer nur eines umgestellt haette, haette Spiel und Tests
 * verschiedene Autos bauen lassen.
 */
export const VORGABE_FORM: WrackformId = "c";

/**
 * Die Fassung, in der neue Wracks gerade gebaut werden.
 *
 * Umgeschaltet wird zur Laufzeit (`__game.composites.zeigeForm("a")`) oder beim
 * Laden ueber die Adresse (`?wrackform=a`) — letzteres, damit die Fassungen auch
 * auf dem iPad zu sehen sind, wo es keine Entwicklerkonsole gibt. Auch
 * `?wrackform=bestand` geht, damit der alte Stand zum Vergleich erreichbar bleibt.
 */
let AKTIVE_FORM: WrackformId = ((): WrackformId => {
  if (typeof location === "undefined") return VORGABE_FORM;
  const wunsch = new URLSearchParams(location.search).get("wrackform");
  return wunsch === "a" || wunsch === "b" || wunsch === "c" || wunsch === "bestand"
    ? wunsch
    : VORGABE_FORM;
})();

export function aktiveWrackform(): WrackformId {
  return AKTIVE_FORM;
}

/** Die Formbeschreibung zu einer Fassung; `null` heißt: Bestand, zwei Quader. */
export function wrackform(id: WrackformId): WrackformDef | null {
  return id === "bestand" ? null : WRACKFORMEN[id];
}

/**
 * Die Fahrzeugdaten für eine Fassung.
 *
 * Nur die Räder können sich unterscheiden (Fassung B hat dicke Reifen). Radius
 * und Ankerhöhe werden dabei GEMEINSAM gesetzt: Die Räder hängen als Netze am
 * Rumpf, dessen Kollider mit der Unterkante auf y = 0 sitzt — ein dickeres Rad,
 * dessen Anker nicht mitwandert, stünde im Boden. Alles Weitere (Masse,
 * Zugzeit, Greifradius, Material) bleibt, damit Zerlegen und Wirtschaft
 * unberührt sind.
 */
export function wrackDaten(basis: CarDef, id: WrackformId): CarDef {
  const form = wrackform(id);
  if (!form) return basis;
  const parts = !form.rad
    ? basis.parts
    : basis.parts.map((p) =>
        p.kind === "wheel"
          ? {
              ...p,
              size: [form.rad![0], form.rad![1]],
              anchor: [p.anchor[0]!, form.rad![0], p.anchor[2]!] as [number, number, number],
            }
          : p
      );
  const karosserie = form.anbau ? { ...basis.karosserie, anbau: form.anbau } : basis.karosserie;
  return { ...basis, parts, karosserie };
}

/**
 * Das Karosseriematerial je Fassung — EINES für alle Wracks.
 *
 * Möglich, weil der Lack an den Eckpunkten sitzt (E-105/E-111): Das Material
 * trägt keine wrackeigene Zahl mehr, also braucht kein Wrack ein eigenes. Zwei
 * Wracks derselben Fassung kann der Renderer damit hintereinander zeichnen.
 */
const LACK_STOFF = new Map<WrackformId, THREE.MeshStandardMaterial>();
function lackStoff(form: WrackformDef, id: WrackformId): THREE.MeshStandardMaterial {
  let stoff = LACK_STOFF.get(id);
  if (!stoff) {
    // Dieselben Werte wie beim Bestand: Ein Lack, der zehn Jahre auf dem Hof
    // steht, glänzt nicht mehr (17.09.2026).
    stoff = farbstoff(0.74, 0.12);
    stoff.flatShading = !form.glatt;
    LACK_STOFF.set(id, stoff);
  }
  return stoff;
}


export class CarComposite {
  readonly body: RAPIER.RigidBody;
  readonly group = new THREE.Group();
  private crushGroup = new THREE.Group();
  /**
   * Die Kollider des Wracks. Beim Quader (Bestand, A, B) genau einer; bei
   * einer Fassung mit `bleche` (C, E-124) einer je Blech, in derselben
   * Reihenfolge — Kollider 0 ist der Boden und traegt die Masse.
   */
  private kollider: RAPIER.Collider[] = [];
  /** Der Hohlkoerper dieser Fassung; `null` = ein Quader wie bisher. */
  private bleche: BlechDef[] | null;
  /** Wie weit jedes Blech eingedrueckt ist, in m (Index wie `bleche`). */
  private eindruck: number[] = [];
  /**
   * Wo die Spinne zuletzt am Wrack anlag: ihr Gelenk und ihre Achse
   * (Wrack-lokal, ungequetscht), und wie viele Schritte das her ist.
   */
  private spinne: { ort: THREE.Vector3; achse: THREE.Vector3 } | null = null;
  private druckAlter = Infinity;
  private parts: AttachedPart[] = [];
  private windows: { id: string; mesh: THREE.Object3D; anchor: THREE.Vector3; intact: boolean }[] = [];
  crushStage = 0;
  private prevVel = new THREE.Vector3();
  private grace = SETTLE_GRACE_STEPS;
  private currentMassKg: number;
  /**
   * Was die Karosse jetzt noch wiegt.
   *
   * Nur zum Nachlesen: Herausgeloeste Teile leben als eigene Stuecke weiter,
   * die Masse wandert also, sie verschwindet nicht (`test/greiferschaden.test.ts`,
   * Ansage Patrick 22.09.2026: "kaputt machen verliert keinen wert").
   */
  get massKg(): number {
    return this.currentMassKg;
  }
  /**
   * Netze, deren Eckpunkte sich bewegen: `base` die Form ab Werk, `stoss` die
   * Beulen aus Aufprall und Biss (kumulativ, gedeckelt), `blech` was die
   * eingedrueckten Bleche mitnehmen (E-124, aus `eindruck` neu gerechnet).
   * `beult` = falsch fuer die Scheiben: Sie folgen den Blechen, damit sie auf
   * dem Dach liegen bleiben, beulen aber nicht selbst.
   */
  private dentables: {
    mesh: THREE.Mesh;
    base: Float32Array;
    stoss: Float32Array;
    blech: Float32Array;
    beult: boolean;
  }[] = [];
  /** Die Karosserieform dieses Wracks; `null` = Bestand, zwei Quader (E-116). */
  private form: WrackformDef | null;

  constructor(
    private def: CarDef,
    private scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private bus: EventBus,
    pos: THREE.Vector3,
    /** In welcher Fassung dieses Wrack gebaut wird (E-116). */
    readonly formId: WrackformId = VORGABE_FORM
  ) {
    this.form = wrackform(formId);
    this.bleche = this.form?.bleche ?? null;
    this.eindruck = (this.bleche ?? []).map(() => 0);
    this.def = def = wrackDaten(def, formId);
    this.currentMassKg = def.totalMassKg;
    this.buildMeshes(wrackLack(pos.x, pos.z));
    this.group.position.copy(pos);
    scene.add(this.group);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true)
        .setTranslation(pos.x, pos.y, pos.z)
        .setAngularDamping(0.8)
        .setLinearDamping(0.05)
    );
    this.legeKolliderAn();
    /*
     * Der Rumpf zaehlt mit seiner Zusammensetzung, nicht nur mit einer
     * Fraktion. Ohne sie rechnete die Presse ein Paket aus lauter Karossen
     * als sortenrein — und genau das soll nicht passieren (E-071).
     */
    items.register({
      materialId: def.hullMaterialId,
      massKg: def.hullMassKg,
      mesh: this.group,
      body: this.body,
      composition: def.hullZusammensetzung?.map((a) => ({
        materialId: a.materialId,
        massKg: a.anteil * def.hullMassKg,
      })),
    });
  }

  /** Wie viele Kollider dieses Wrack hat (fuer Messung und Waechter). */
  get kolliderZahl(): number {
    return this.kollider.length;
  }

  /** Wie weit jedes Blech eingedrueckt ist, mit Namen (fuer Messung und Waechter). */
  get eindrueckung(): { name: string; m: number; max: number }[] {
    return (this.bleche ?? []).map((b, i) => ({ name: b.name, m: this.eindruck[i]!, max: b.max }));
  }

  private get skala(): number {
    return this.def.crushScales[this.crushStage];
  }

  /** Kollider fuer die aktuelle Quetschstufe anlegen. */
  private legeKolliderAn(): void {
    const s = this.skala;
    if (!this.bleche) {
      const [hx, hy, hz] = this.def.colliderHalf;
      this.kollider = [
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy * s, hz)
            .setTranslation(0, this.def.colliderYOffset * s, 0)
            .setMass(this.currentMassKg),
          this.body
        ),
      ];
      return;
    }
    this.kollider = this.bleche.map((_, i) => {
      const { mitte, halb } = this.blechQuader(i);
      return this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(halb[0]!, halb[1]! * s, halb[2]!)
          .setTranslation(mitte[0]!, mitte[1]! * s, mitte[2]!)
          .setDensity(0),
        this.body
      );
    });
    this.masseSetzen();
  }

  /**
   * Kollider an Quetschstufe und Eindrueckung anpassen.
   *
   * Der Quader wird getauscht wie bisher. Die Bleche werden AN ORT UND STELLE
   * umgeformt statt neu angelegt: So bleibt Kollider 0 der Boden, und die
   * Reihenfolge stimmt weiter mit `bleche` ueberein.
   */
  private kolliderNachfuehren(): void {
    if (!this.bleche) {
      this.world.removeCollider(this.kollider[0]!, true);
      this.legeKolliderAn();
      return;
    }
    const s = this.skala;
    this.kollider.forEach((c, i) => {
      const { mitte, halb } = this.blechQuader(i);
      c.setHalfExtents({ x: halb[0]!, y: halb[1]! * s, z: halb[2]! });
      c.setTranslationWrtParent({ x: mitte[0]!, y: mitte[1]! * s, z: mitte[2]! });
    });
    this.masseSetzen();
    this.body.wakeUp();
  }

  /**
   * DIESELBE MASSE WIE DER QUADER VORHER — auch beim Hohlkoerper.
   *
   * Ein Verbund aus duennen Blechen haette Schwerpunkt und Traegheit anderswo
   * als der volle Klotz; das Wrack fiele, kippte und floege anders als bisher.
   * Deshalb tragen die Bleche keine Masse (Dichte 0), und der Boden traegt
   * genau die Masseeigenschaften des alten Quaders `colliderHalf`: Masse,
   * Schwerpunkt auf `colliderYOffset`, Traegheit m/12 · (b² + c²). Werfen und
   * Fallen bleiben, wie sie waren — hohl ist das Wrack nur fuer die Schalen.
   */
  private masseSetzen(): void {
    if (!this.bleche) {
      this.kollider[0]!.setMass(this.currentMassKg);
      return;
    }
    const s = this.skala;
    const m = this.currentMassKg;
    const [hx, hy, hz] = this.def.colliderHalf;
    const a = 2 * hx;
    const b = 2 * hy * s;
    const c = 2 * hz;
    this.kollider[0]!.setMassProperties(
      m,
      // Schwerpunkt im Rahmen des Bodens, der selbst auf mitte[1] · s sitzt
      { x: 0, y: (this.def.colliderYOffset - this.bleche[0]!.mitte[1]) * s, z: 0 },
      { x: (m / 12) * (b * b + c * c), y: (m / 12) * (a * a + c * c), z: (m / 12) * (a * a + b * b) },
      { x: 0, y: 0, z: 0, w: 1 }
    );
  }

  /**
   * Ein Blech, wie es nach der Eindrueckung liegt (ungequetscht).
   *
   * Die Aussenflaeche wandert um `eindruck` nach innen. Die Innenflaeche
   * bleibt stehen, bis das Blech `MIN_DICKE` hat — ein dicker Block wird also
   * gestaucht, eine Platte wandert.
   */
  private blechQuader(i: number): { mitte: number[]; halb: number[] } {
    const b = this.bleche![i]!;
    const { k, sg } = ACHSE[b.nach];
    const mitte = [...b.mitte];
    const halb = [...b.halb];
    const aussen = mitte[k]! - sg * halb[k]!;
    const innen = mitte[k]! + sg * halb[k]!;
    const aussenNeu = aussen + sg * this.eindruck[i]!;
    const innenNeu =
      sg > 0 ? Math.max(innen, aussenNeu + MIN_DICKE) : Math.min(innen, aussenNeu - MIN_DICKE);
    mitte[k] = (aussenNeu + innenNeu) / 2;
    halb[k] = Math.abs(innenNeu - aussenNeu) / 2;
    return { mitte, halb };
  }

  /**
   * Wie stark ein Eckpunkt der Haut einem Blech folgt, 0…1.
   *
   * Quer zur Druckrichtung: voll ueber dem Blech, auslaufend bis `HAUT_RAND`
   * daneben. In Druckrichtung: voll bis `voll` hinter der Aussenflaeche, dann
   * auslaufend bis `fuss`. Beim Dach heisst das: Dachkante und Dach gehen
   * ganz mit, der Scheibenrahmen zum Teil, die Guertellinie gar nicht.
   */
  private blechGewicht(i: number, x: number, y: number, z: number): number {
    const b = this.bleche![i]!;
    const { k, sg } = ACHSE[b.nach];
    const v = [x, y, z];
    const t = sg * (v[k]! - (b.mitte[k]! - sg * b.halb[k]!));
    const wn = t <= b.voll ? 1 : t >= b.fuss ? 0 : (b.fuss - t) / (b.fuss - b.voll);
    if (wn <= 0) return 0;
    let quer = 0;
    for (let j = 0; j < 3; j++) {
      if (j === k) continue;
      const d = Math.max(0, Math.abs(v[j]! - b.mitte[j]!) - b.halb[j]!);
      quer += d * d;
    }
    return wn * Math.max(0, 1 - Math.sqrt(quer) / HAUT_RAND);
  }

  /** Haut und Scheiben neu stellen: Form ab Werk + Beulen + Bleche. */
  private hautNachfuehren(): void {
    for (const d of this.dentables) {
      const attr = d.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      d.blech.fill(0);
      for (let i = 0; i < attr.count; i++) {
        const bi = i * 3;
        const x = d.base[bi]! + d.mesh.position.x;
        const y = d.base[bi + 1]! + d.mesh.position.y;
        const z = d.base[bi + 2]! + d.mesh.position.z;
        for (let p = 0; p < this.eindruck.length; p++) {
          const e = this.eindruck[p]!;
          if (e <= 0) continue;
          const w = this.blechGewicht(p, x, y, z);
          if (w <= 0) continue;
          const { k, sg } = ACHSE[this.bleche![p]!.nach];
          d.blech[bi + k] += sg * e * w * (1 + KNITTER * rauschen(i));
        }
        attr.setXYZ(
          i,
          d.base[bi]! + d.stoss[bi]! + d.blech[bi]!,
          d.base[bi + 1]! + d.stoss[bi + 1]! + d.blech[bi + 1]!,
          d.base[bi + 2]! + d.stoss[bi + 2]! + d.blech[bi + 2]!
        );
      }
      attr.needsUpdate = true;
      if (this.form?.glatt) d.mesh.geometry.computeVertexNormals();
    }
  }

  /** Weltpunkt → Wrack-lokal, ungequetscht. */
  private lokal(welt: { x: number; y: number; z: number }): THREE.Vector3 {
    const p = this.body.translation();
    const r = this.body.rotation();
    const v = new THREE.Vector3(welt.x - p.x, welt.y - p.y, welt.z - p.z).applyQuaternion(
      new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()
    );
    v.y /= this.skala;
    return v;
  }

  /** Wrack-lokal, ungequetscht → Weltpunkt. */
  private welt(lokal: THREE.Vector3): THREE.Vector3 {
    const p = this.body.translation();
    const r = this.body.rotation();
    return new THREE.Vector3(lokal.x, lokal.y * this.skala, lokal.z)
      .applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
      .add(new THREE.Vector3(p.x, p.y, p.z));
  }

  /**
   * WO STEHT DIE SPINNE? — je Physikschritt, nur am wachen Wrack.
   *
   * Rapier meldet, welcher fremde Kollider gerade am Wrack anliegt. Eine
   * Kapsel an einem kinematischen Koerper ist eine Schale der Spinne (die
   * Fahrzeuge und der Arm sind Quader) — und ihr Koerper IST die Spinne: Sein
   * Ursprung ist das Gelenk, seine Achse zeigt nach unten in den Korb
   * (`grappleBody` folgt `grappleGroup`). Mehr braucht es nicht, um zu wissen,
   * wohin der Spieler drueckt.
   *
   * Gemessen, warum nicht die Kontaktpunkte selbst (`tools/wrackdruck.ts`):
   * Die offene Spinne ist breiter als das Wrack; ueber dem Kofferraum lag ihre
   * erste Schale auf dem DACH an, ueber der rechten Flanke gab die LINKE Tuer
   * nach. Was die Schalen beruehren, ist nicht, worauf der Spieler zielt.
   *
   * Erst gesammelt, dann ausgewertet (v2 E-044): In den Rueckrufen wird nur
   * gelesen.
   */
  private tasteDruck(): void {
    const paare: Array<[RAPIER.Collider, RAPIER.Collider]> = [];
    for (const c of this.kollider) {
      this.world.contactPairsWith(c, (anderer) => {
        const b = anderer.parent();
        if (b && b.isKinematic() && anderer.shapeType() === RAPIER.ShapeType.Capsule) {
          paare.push([c, anderer]);
        }
      });
    }
    let spinne: RAPIER.RigidBody | null = null;
    for (const [c, anderer] of paare) {
      let beruehrt = false;
      this.world.contactPair(c, anderer, (mf) => {
        if (mf.numSolverContacts() > 0) beruehrt = true;
      });
      if (beruehrt) {
        spinne = anderer.parent();
        break;
      }
    }
    if (!spinne) {
      this.druckAlter++;
      return;
    }
    const s = spinne as RAPIER.RigidBody;
    const r = s.rotation();
    const q = this.body.rotation();
    const achse = new THREE.Vector3(0, -1, 0)
      .applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
      .applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w).invert());
    achse.y /= this.skala;
    this.spinne = { ort: this.lokal(s.translation()), achse: achse.normalize() };
    this.druckAlter = 0;
  }

  /**
   * Wo trifft ein Strahl zuerst ein Blech? (Wrack-lokal, ungequetscht)
   * Schlichter Quadertest je Blech — acht Quader, keine Abfrage an Rapier.
   */
  private strahl(o: THREE.Vector3, d: THREE.Vector3): Druckstelle | null {
    let best: Druckstelle | null = null;
    let tBest = Infinity;
    const po = [o.x, o.y, o.z];
    const pd = [d.x, d.y, d.z];
    this.bleche!.forEach((_, i) => {
      const { mitte, halb } = this.blechQuader(i);
      let t0 = 0;
      let t1 = Infinity;
      for (let j = 0; j < 3; j++) {
        const lo = mitte[j]! - halb[j]!;
        const hi = mitte[j]! + halb[j]!;
        if (Math.abs(pd[j]!) < 1e-9) {
          if (po[j]! < lo || po[j]! > hi) return;
          continue;
        }
        const a = (lo - po[j]!) / pd[j]!;
        const b = (hi - po[j]!) / pd[j]!;
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
      }
      if (t0 <= t1 && t0 < tBest) {
        tBest = t0;
        best = { blech: i, ort: o.clone().addScaledVector(d, t0) };
      }
    });
    return best;
  }

  /**
   * Welches Blech gibt an diesem Punkt nach? Das getroffene selbst — oder,
   * wenn es nicht nachgibt (die Bodenwanne), das naechste nachgiebige bis
   * `HAUT_RAND` daneben. Wer auf den Schweller drueckt, drueckt die Tuer
   * darueber ein; wer durchs Seitenfenster in den Innenraum greift
   * (gemessen: die Spinne kommt dort 37 cm tiefer), drueckt die Tuer daneben.
   */
  private nachgiebig(st: Druckstelle): Druckstelle {
    if (this.bleche![st.blech]!.max > 0) return st;
    const p: [number, number, number] = [st.ort.x, st.ort.y, st.ort.z];
    let naechst = HAUT_RAND;
    let bestes = st.blech;
    this.bleche!.forEach((b, i) => {
      if (b.max <= 0) return;
      const d = abstand(p, b);
      if (d <= naechst) {
        naechst = d;
        bestes = i;
      }
    });
    return { blech: bestes, ort: st.ort };
  }

  /**
   * Wo ein Biss ankommt.
   *
   * 1. Lag die Spinne eben noch am Wrack (oder haengt es in ihr): ihre Achse
   *    entlang, das erste Blech, das sie trifft — worauf der Spieler zielt.
   *    Steht sie neben dem Wrack, drueckt sie seitlich hinein, in
   *    `SEITEN_HOEHE` auf die Wagenmitte zu.
   * 2. Sonst der gemeldete Ort, und zwar das naechste Blech. Der Bagger meldet
   *    dort heute den URSPRUNG DES GETROFFENEN KOERPERS (`greifer:zugedrueckt`,
   *    E-112), die Mitte der Unterkante — dann wird von oben gedrueckt, wie
   *    E-114 es fuer diesen Fall festgelegt hat: aufs Dach.
   */
  private druckstelle(at: THREE.Vector3): Druckstelle {
    if (this.spinne && (this.druckAlter <= DRUCK_GEDAECHTNIS || this.body.isKinematic())) {
      const { ort, achse } = this.spinne;
      const vonOben = this.strahl(ort, achse);
      if (vonOben) return this.nachgiebig(vonOben);
      const t = Math.abs(achse.y) > 1e-3 ? (SEITEN_HOEHE - ort.y) / achse.y : 0;
      const seitlich = ort.clone().addScaledVector(achse, Math.max(0, t));
      seitlich.y = SEITEN_HOEHE;
      const hin = new THREE.Vector3(0, SEITEN_HOEHE, THREE.MathUtils.clamp(seitlich.z, -1.6, 1.6))
        .sub(seitlich)
        .normalize();
      const vonDerSeite = this.strahl(seitlich, hin);
      if (vonDerSeite) return this.nachgiebig(vonDerSeite);
    }
    const p = this.body.translation();
    let ort = this.lokal(at);
    if (Math.hypot(at.x - p.x, at.y - p.y, at.z - p.z) < 1e-3) {
      let oben = 0;
      for (const b of this.bleche!) oben = Math.max(oben, b.mitte[1] + b.halb[1]);
      ort = new THREE.Vector3(0, oben, 0);
    }
    let bestes = 0;
    let naechst = Infinity;
    this.bleche!.forEach((b, i) => {
      const d = abstand([ort.x, ort.y, ort.z], b);
      if (d < naechst) {
        naechst = d;
        bestes = i;
      }
    });
    return this.nachgiebig({ blech: bestes, ort });
  }

  private buildMeshes(lack: number): void {
    // Klar durchsichtig: Man soll durch die Scheiben hindurchsehen, nicht
    // gegen eine milchige Fläche schauen. Der leichte Blaustich und die
    // Spiegelung machen es trotzdem als Glas erkennbar.
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd6ecf4,
      roughness: 0.06,
      metalness: 0,
      transmission: 0.82,
      thickness: 0.05,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });

    this.group.add(this.crushGroup);
    if (this.form) this.baueFassung(this.form, lack, glassMat);
    else this.baueBestand(lack, glassMat);

    baueAnbauteile(this.crushGroup, this.def, lack, this.form ? !!this.form.radlaufBogen : true);

    // Parts (nicht quetschbar): Motor + Räder
    for (const p of this.def.parts) {
      let mesh: THREE.Object3D;
      if (p.kind === "wheel") {
        const geo = new THREE.CylinderGeometry(p.size[0], p.size[0], p.size[1], 16);
        geo.rotateZ(Math.PI / 2);
        mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.9 }));
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]),
          new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7, metalness: 0.4 })
        );
      }
      mesh.position.set(...p.anchor);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.parts.push({ def: p, mesh, attached: true });
    }
  }

  /**
   * DER BESTAND: zwei Quader plus vier Scheibenplatten (Stand vor E-116).
   *
   * Unverändert, bis Patrick eine Fassung gewählt hat — solange nichts
   * entschieden ist, darf sich das Spiel nicht von selbst ändern.
   */
  private baueBestand(lack: number, glassMat: THREE.Material): void {
    /*
     * DER LACK KOMMT VOM STANDORT, NICHT AUS EINER KONSTANTEN (17.09.2026).
     *
     * Rauheit 0,74 statt 0,50 und Metallglanz 0,12 statt 0,30: Ein Lack, der
     * zehn Jahre auf dem Hof steht, glänzt nicht mehr.
     */
    const paint = new THREE.MeshStandardMaterial({
      color: lack,
      roughness: 0.74, // SW, siehe oben
      metalness: 0.12, // SW, siehe oben
      flatShading: true,
    });
    // Quetschbare Teile (Chassis, Kabine, Scheiben) — Ursprung an der Unterkante.
    // Die MASSE stehen in `CarDef.karosserie` (E-111), die UNTERTEILUNG bleibt
    // hier: 4x2x9 und 4x2x5 sind keine Karosseriemaße, sondern die Auflösung,
    // auf der `dent()` beult — die haengt am Rechenbudget, nicht am Modell.
    const k = this.def.karosserie;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(...k.chassis, 4, 2, 9), paint);
    formeKarosserie(chassis.geometry);
    chassis.position.y = k.chassisY;
    chassis.castShadow = true;
    this.crushGroup.add(chassis);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(...k.kabine, 4, 2, 5), paint);
    cabin.position.set(0, k.kabineY, k.kabineZ * (k.chassis[2] / 2));
    cabin.castShadow = true;
    this.crushGroup.add(cabin);
    for (const m of [chassis, cabin]) this.beulbar(m, true);
    for (const w of this.def.windows) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w.size[0], w.size[1], 0.03), glassMat);
      pane.position.set(...w.anchor);
      pane.rotation.y = w.rotY;
      this.crushGroup.add(pane);
      this.windows.push({ id: w.id, mesh: pane, anchor: new THREE.Vector3(...w.anchor), intact: true });
    }
  }

  /**
   * EINE DER FASSUNGEN AUS E-116: ein Längsschnitt als EIN Netz, die Scheiben
   * als Felder in derselben Haut.
   *
   * Der ganze Wagen ist ein Netz — also EIN Beulkörper statt zwei, und ein
   * Druck auf die A-Säule verformt Haube und Dach zusammen, statt an der Naht
   * zwischen Rumpf und Kabine aufzureißen.
   */
  private baueFassung(form: WrackformDef, lack: number, glassMat: THREE.Material): void {
    const bau = baueWrackform(form, lack);
    const karosse = new THREE.Mesh(bau.koerper, lackStoff(form, this.formId));
    karosse.castShadow = true;
    this.crushGroup.add(karosse);
    this.beulbar(karosse, true);
    for (const s of bau.scheiben) {
      const pane = new THREE.Mesh(s.geo, glassMat);
      this.crushGroup.add(pane);
      // Am Hohlkoerper folgen die Scheiben den Blechen (E-124) — sonst
      // schwebte das Glas ueber einem eingedrueckten Dach.
      if (form.bleche) this.beulbar(pane, false);
      // Der Ankerpunkt ist nur für den Splitter-Partikel da: die Mitte der
      // Scheibe, hier aus ihrer eigenen Geometrie statt aus einer Zahlenliste.
      s.geo.computeBoundingSphere();
      this.windows.push({
        id: s.id,
        mesh: pane,
        anchor: s.geo.boundingSphere!.center.clone(),
        intact: true,
      });
    }
  }

  private beulbar(mesh: THREE.Mesh, beult: boolean): void {
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const n = pos.array.length;
    this.dentables.push({
      mesh,
      base: new Float32Array(pos.array as Float32Array),
      stoss: new Float32Array(n),
      blech: new Float32Array(n),
      beult,
    });
  }

  /** Pro Physik-Step: Mesh-Sync + Aufprall-Erkennung über Δv. */
  update(): void {
    const p = this.body.translation();
    const r = this.body.rotation();
    this.group.position.set(p.x, p.y, p.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);

    // Während der kinematischen Anlieferung (auf der Pritsche): keine Aufprall-Logik
    if (this.body.isKinematic()) {
      this.prevVel.set(0, 0, 0);
      return;
    }

    if (this.bleche && !this.body.isSleeping()) this.tasteDruck();

    const v = this.body.linvel();
    const dv = Math.hypot(v.x - this.prevVel.x, v.y - this.prevVel.y, v.z - this.prevVel.z);
    const impactDir = this.prevVel.clone(); // Bewegungsrichtung VOR dem Aufprall
    this.prevVel.set(v.x, v.y, v.z);
    if (this.grace > 0) {
      this.grace--;
      return;
    }

    if (dv > 3 && impactDir.length() > 2) {
      this.dent(impactDir, dv); // Blech beult am Auftreffpunkt
    }
    if (dv > this.def.glassImpactDv) {
      this.shatterWindows(dv > this.def.glassImpactDv * 1.6 ? 2 : 1);
    }
    if (dv > this.def.crushImpactDv && this.crushStage < 2) {
      this.crush();
    }
  }

  /**
   * Formbares Blech (Design-Wunsch 2026-08-27): Vertices im Umkreis des
   * Auftreffpunkts werden entlang der Aufprallrichtung eingedrückt — mit
   * Falloff, Zufalls-Knittern und Deckel, kumulativ über viele Treffer.
   */
  private dent(impactDirWorld: THREE.Vector3, dv: number): void {
    const amount = Math.min(0.2, 0.035 * dv); // (SW)
    const RADIUS = 0.95; // (SW)
    const MAX_OFFSET = 0.3; // maximale Gesamt-Eindrückung je Vertex (SW)
    const qInv = this.group.quaternion.clone().invert();
    const dirL = impactDirWorld.clone().normalize().applyQuaternion(qInv);
    // Kontaktpunkt ≈ Schnitt der Aufprallrichtung mit dem Kolliderquader
    const [hx, hy, hz] = this.def.colliderHalf;
    const t =
      1 /
      Math.max(Math.abs(dirL.x) / hx, Math.abs(dirL.y) / hy, Math.abs(dirL.z) / hz, 1e-4);
    const contact = dirL
      .clone()
      .multiplyScalar(t)
      .add(new THREE.Vector3(0, this.def.colliderYOffset, 0));

    for (const d of this.dentables) {
      if (!d.beult) continue;
      const attr = d.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const lx = contact.x - d.mesh.position.x;
      const ly = contact.y - d.mesh.position.y;
      const lz = contact.z - d.mesh.position.z;
      let touched = false;
      for (let i = 0; i < attr.count; i++) {
        // Gebeult wird die Form ohne die Bleche (E-124); die kommen danach dazu.
        const vx = d.base[i * 3]! + d.stoss[i * 3]!;
        const vy = d.base[i * 3 + 1]! + d.stoss[i * 3 + 1]!;
        const vz = d.base[i * 3 + 2]! + d.stoss[i * 3 + 2]!;
        const dist = Math.hypot(vx - lx, vy - ly, vz - lz);
        if (dist > RADIUS) continue;
        const w = (1 - dist / RADIUS) ** 2;
        let nx = vx + (dirL.x + (Math.random() - 0.5) * 0.3) * amount * w;
        let ny = vy + (dirL.y + (Math.random() - 0.5) * 0.3) * amount * w;
        let nz = vz + (dirL.z + (Math.random() - 0.5) * 0.3) * amount * w;
        // Deckel: Gesamtverschiebung gegenüber der Ausgangsform begrenzen
        const bi = i * 3;
        const ox = nx - d.base[bi];
        const oy = ny - d.base[bi + 1];
        const oz = nz - d.base[bi + 2];
        const off = Math.hypot(ox, oy, oz);
        if (off > MAX_OFFSET) {
          const s = MAX_OFFSET / off;
          nx = d.base[bi] + ox * s;
          ny = d.base[bi + 1] + oy * s;
          nz = d.base[bi + 2] + oz * s;
        }
        d.stoss[bi] = nx - d.base[bi]!;
        d.stoss[bi + 1] = ny - d.base[bi + 1]!;
        d.stoss[bi + 2] = nz - d.base[bi + 2]!;
        attr.setXYZ(i, nx + d.blech[bi]!, ny + d.blech[bi + 1]!, nz + d.blech[bi + 2]!);
        touched = true;
      }
      if (!touched) continue;
      attr.needsUpdate = true;
      /*
       * Flach schattiert holt sich der Renderer die Normale aus der Fläche
       * selbst — da ist nach einer Beule nichts nachzurechnen. Eine GLATT
       * schattierte Haut (Fassung C, E-116) liest die Normalen dagegen aus dem
       * Puffer: ohne diese Zeile bliebe eine Beule dort unsichtbar, weil die
       * Beleuchtung weiter die alte Wölbung zeigt. Die Rechnung läuft nur im
       * Treffer-Bild und nur über die Karosserie (bis 300 Eckpunkte).
       */
      if (this.form?.glatt) d.mesh.geometry.computeVertexNormals();
    }
  }

  private shatterWindows(count: number): void {
    const tmp = new THREE.Vector3();
    for (const w of this.windows) {
      if (count <= 0) break;
      if (!w.intact) continue;
      w.intact = false;
      w.mesh.getWorldPosition(tmp);
      w.mesh.removeFromParent();
      this.bus.emit("glassShattered", { x: tmp.x, y: tmp.y, z: tmp.z });
      count--;
    }
  }

  private crush(): void {
    this.crushStage++;
    const s = this.def.crushScales[this.crushStage];
    this.crushGroup.scale.y = s;
    this.shatterWindows(4); // was noch heil ist, birst spätestens jetzt
    this.kolliderNachfuehren();
    const p = this.body.translation();
    this.bus.emit("crushed", { stage: this.crushStage, x: p.x, y: p.y, z: p.z });
    // Stufe 2: der Schlag drückt bis zu 2 Räder aus der Aufhängung
    if (this.crushStage === 2) {
      let ejected = 0;
      for (const part of this.parts) {
        if (ejected >= 2) break;
        if (!part.attached || part.def.kind !== "wheel") continue;
        const body = this.tearPart(part.def.id)!;
        body.applyImpulse(
          { x: (Math.random() - 0.5) * 260, y: 130 + Math.random() * 90, z: (Math.random() - 0.5) * 260 },
          true
        );
        ejected++;
      }
    }
  }

  /** In der Presse: sofort auf Stufe 2 quetschen (inkl. Radauswurf, Events). */
  pressCrush(): void {
    while (this.crushStage < 2) this.crush();
  }

  /** Part lösen → eigenständiges ScrapItem; liefert den neuen Körper. */
  tearPart(partId: string): RAPIER.RigidBody | null {
    const part = this.parts.find((p) => p.def.id === partId && p.attached);
    if (!part) return null;
    part.attached = false;

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    part.mesh.getWorldPosition(worldPos);
    part.mesh.getWorldQuaternion(worldQuat);
    part.mesh.removeFromParent();
    this.scene.add(part.mesh);
    part.mesh.position.copy(worldPos);
    part.mesh.quaternion.copy(worldQuat);

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true)
        .setTranslation(worldPos.x, worldPos.y, worldPos.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w })
    );
    const d = part.def;
    const colliderDesc =
      d.kind === "wheel"
        ? RAPIER.ColliderDesc.cuboid(d.size[1] / 2, d.size[0], d.size[0])
        : RAPIER.ColliderDesc.cuboid(d.size[0] / 2, d.size[1] / 2, d.size[2] / 2);
    this.world.createCollider(colliderDesc.setMass(d.massKg), body);
    /*
     * Auch ein abgerissenes Teil braucht seine Form: Ohne sie weiss das Spiel
     * weder, wie es heisst, noch woraus es besteht — und ein Rad liesse sich
     * nie in Reifen und Felge zerlegen.
     */
    this.items.register({
      materialId: d.materialId,
      massKg: d.massKg,
      mesh: part.mesh,
      body,
      shape: {
        kind: d.kind === "wheel" ? "cyl" : "box",
        dims: d.kind === "wheel" ? [d.size[0], d.size[1]] : [...d.size],
        color: d.color,
        name: d.name,
        zusammensetzung: d.zusammensetzung,
        trennbar: d.trennbar,
      },
      composition: d.zusammensetzung?.map((a) => ({
        materialId: a.materialId,
        massKg: a.anteil * d.massKg,
      })),
    });

    // Rumpf wird leichter
    this.currentMassKg = Math.max(this.def.hullMassKg, this.currentMassKg - d.massKg);
    this.masseSetzen();
    this.bus.emit("partTorn", { name: d.name });
    return body;
  }

  /** Zustand für den Spielstand (Kap. 18). Beulen werden bewusst nicht gesichert. */
  get saveState(): { pos: number[]; rot: number[]; crushStage: number; torn: string[]; brokenWindows: string[] } {
    const p = this.body.translation();
    const r = this.body.rotation();
    return {
      pos: [p.x, p.y, p.z],
      rot: [r.x, r.y, r.z, r.w],
      crushStage: this.crushStage,
      torn: this.parts.filter((pt) => !pt.attached).map((pt) => pt.def.id),
      brokenWindows: this.windows.filter((w) => !w.intact).map((w) => w.id),
    };
  }

  /** Zustand aus dem Spielstand herstellen (ohne Events/Partikel/Impulse). */
  restoreState(s: { crushStage: number; torn: string[]; brokenWindows: string[] }): void {
    for (const w of this.windows) {
      if (s.brokenWindows.includes(w.id)) {
        w.intact = false;
        w.mesh.removeFromParent();
      }
    }
    for (const id of s.torn) {
      const part = this.parts.find((p) => p.def.id === id && p.attached);
      if (!part) continue;
      part.attached = false;
      part.mesh.removeFromParent(); // das gelöste Teil selbst wird als generisches Item wiederhergestellt
      this.currentMassKg = Math.max(this.def.hullMassKg, this.currentMassKg - part.def.massKg);
    }
    this.crushStage = s.crushStage;
    if (s.crushStage > 0) {
      this.crushGroup.scale.y = this.def.crushScales[s.crushStage];
      this.kolliderNachfuehren();
    } else {
      this.masseSetzen();
    }
  }

  /** Komplett entfernen (Verkauf). Registry-Eintrag räumt der Aufrufer ab. */
  despawn(): void {
    this.group.removeFromParent();
    this.world.removeRigidBody(this.body); // nimmt Kollider mit; Part-Meshes hängen im group
  }

  /** Nächste greifbare Part nahe der Sensorposition (für die Reiß-Mechanik). */
  /**
   * Ein Biss der Spinne (E-114, 22.09.2026).
   *
   * ANSAGE PATRICK, 22.09.2026: "nein, kaputt machen verliert keinen wert.
   * warum auch, Motor entfernen durch rohe Gewalt ist eine art sortierung,
   * auch ein kaputtes auto bringt gleich viel geld." Deshalb nimmt diese
   * Rechnung KEINE Masse weg und kennt keinen Preisfaktor: `currentMassKg`
   * sinkt nur, wenn ein Teil wirklich herausgeht — und dann lebt es als
   * eigenes Stueck weiter. Gewalt ist hier ein zweiter Weg zu zerlegen, keine
   * Strafe.
   *
   * WARUM DIE KRAFT IN EIN DELTA-V UMGERECHNET WIRD, statt eigene Schwellen
   * zu bekommen. Beulen, Scheiben und Quetschstufen haengen seit dem
   * 27.08.2026 an DREI Schwellen (`dv > 3`, `glassImpactDv`,
   * `crushImpactDv`). Eigene Kraftschwellen daneben waeren ein zweiter Satz
   * Zahlen fuer dieselbe Sache — genau die Fehlerklasse, die dieses Projekt
   * neun Mal geplagt hat. Es gibt deshalb EINEN Umrechnungsfaktor, und die
   * Schwellen bleiben, wo sie sind.
   *
   * Der Faktor kommt aus der Messung in E-112 (`tools/greifkraft.ts`): Ein
   * voller Biss auf ein Autowrack sind 15,70 kN. Genau dieser Biss soll die
   * Quetschschwelle erreichen, nicht ueberspringen — also
   *     15,70 kN / 7 (m/s) = 2,243 kN je (m/s).
   * Damit ergibt sich von selbst eine Abstufung, ohne eine einzige weitere
   * Zahl (gemessene Kraefte aus E-112):
   *
   *   Blech    8,14 kN -> dv 3,63  beult
   *   Traeger  9,05 kN -> dv 4,03  beult
   *   Brocken 10,64 kN -> dv 4,74  beult, Scheiben bersten
   *   Wrack   15,70 kN -> dv 7,00  beult, Scheiben, eine Quetschstufe
   *   Luft     0,00 kN -> dv 0     nichts
   */
  beissen(kraftKN: number, at: THREE.Vector3): void {
    const dv = kraftKN / KN_JE_MS;
    if (dv <= 0) return;
    if (this.bleche) {
      this.beissenHohl(dv, at);
      return;
    }

    /*
     * Die Druckrichtung ist die Achse Biss -> Karossenmitte: Wer von oben auf
     * die Haube drueckt, beult nach unten, wer seitlich zufasst, nach innen.
     * `dent` erwartet die Bewegungsrichtung VOR dem Aufprall, und das ist beim
     * Zudruecken genau diese Achse. Faellt sie zusammen (Biss genau in der
     * Mitte), wird von oben gedrueckt — der uebliche Fall.
     */
    const p = this.body.translation();
    const richtung = new THREE.Vector3(p.x - at.x, p.y - at.y, p.z - at.z);
    if (richtung.lengthSq() < 1e-6) richtung.set(0, -1, 0);

    if (dv > 3) this.dent(richtung, dv);
    if (dv > this.def.glassImpactDv) {
      this.shatterWindows(dv > this.def.glassImpactDv * 1.6 ? 2 : 1);
    }

    /*
     * ROHE GEWALT ALS SORTIERUNG. Was unter den Schalen liegt, geht heraus —
     * dieselbe Suche, mit der die Spinne auch zum Abschrauben ansetzt
     * (`findPartNear`), und dasselbe Herausloesen (`tearPart`). Es gibt also
     * keinen zweiten Weg, ein Teil vom Wrack zu trennen; es gibt nur einen
     * zweiten Anlass.
     *
     * Der Stoss danach ist klein gehalten (SW 40): Das Teil soll sichtbar
     * wegkippen, aber nicht ueber den Platz fliegen — geworfen wird mit dem
     * Schwenk, nicht mit dem Druck.
     */
    if (dv >= this.def.crushImpactDv) {
      const ziel = this.findPartNear(at);
      if (ziel) {
        const koerper = ziel.tear();
        koerper.applyImpulse(
          { x: richtung.x * -40, y: 40, z: richtung.z * -40 },
          true
        );
      } else if (this.crushStage < 2) {
        // Nichts zu holen — dann trifft es die Karosse selbst.
        this.crush();
      }
    }
  }

  /**
   * DER BISS AM HOHLKOERPER (E-124) — oertlich statt im Ganzen.
   *
   * Patrick, 06.10.2026: „Autos müssen hole elemente werden, die man
   * zerdrücken kann." Dieselben drei Schwellen wie bisher, nur mit einem Ort
   * (`druckstelle`: das Blech, auf das die Spinne zielt):
   *
   *  - ab der Beulschwelle (3 m/s) gibt dieses Blech um `min(0,2; 0,035 · dv)`
   *    nach — dieselbe Menge, um die `dent` die Haut eindrueckt. Der Kollider
   *    wandert mit; die Schalen kommen beim naechsten Mal tiefer.
   *  - ab der Scheibenschwelle bersten Scheiben, wie bisher.
   *  - ab der Quetschschwelle geht heraus, was unter der Druckstelle liegt
   *    (`findPartNear`, wie bisher, jetzt am Zielpunkt statt am
   *    Koerperursprung). Liegt dort nichts und hat das Blech nicht mehr
   *    nachgegeben — die Stelle ist schon ganz eingedrueckt —, gibt die
   *    Karosse als Ganzes eine Quetschstufe nach.
   *
   * Erst die Stelle, dann das Ganze: Ein voller Biss aufs Dach drueckt das
   * Dach ein, nicht das ganze Auto um ein Viertel flach.
   */
  private beissenHohl(dv: number, at: THREE.Vector3): void {
    const st = this.druckstelle(at);
    let nachgegeben = false;
    if (dv > 3) {
      const vorher = this.eindruck[st.blech]!;
      this.eindruck[st.blech] = Math.min(this.bleche![st.blech]!.max, vorher + Math.min(0.2, 0.035 * dv));
      nachgegeben = this.eindruck[st.blech]! > vorher;
      if (nachgegeben) {
        this.kolliderNachfuehren();
        this.hautNachfuehren();
      }
    }
    if (dv > this.def.glassImpactDv) {
      this.shatterWindows(dv > this.def.glassImpactDv * 1.6 ? 2 : 1);
    }
    if (dv < this.def.crushImpactDv) return;
    const ort = this.welt(st.ort);
    const ziel = this.findPartNear(ort);
    if (ziel) {
      const p = this.body.translation();
      const richtung = new THREE.Vector3(p.x - ort.x, p.y - ort.y, p.z - ort.z);
      ziel.tear().applyImpulse({ x: richtung.x * -40, y: 40, z: richtung.z * -40 }, true);
    } else if (!nachgegeben && this.crushStage < 2) {
      this.crush();
    }
  }

  findPartNear(pos: THREE.Vector3): TearTarget | null {
    const tmp = new THREE.Vector3();
    for (const part of this.parts) {
      if (!part.attached) continue;
      part.mesh.getWorldPosition(tmp);
      // Von oben zu greifen ist der übliche Fall: Die Spinne kommt senkrecht
      // über die Motorhaube und fasst hinein. Deshalb zählt der waagerechte
      // Abstand voll, der senkrechte nur zur Hälfte — sonst müsste man die
      // Bauteilmitte auf den Zentimeter treffen (Design 02.09.2026).
      const dx = pos.x - tmp.x;
      const dy = (pos.y - tmp.y) * 0.5;
      const dz = pos.z - tmp.z;
      if (Math.hypot(dx, dy, dz) <= part.def.grabRadius) {
        const anchorWorld = tmp.clone();
        return {
          id: `${this.body.handle}_${part.def.id}`,
          name: part.def.name,
          tearSeconds: part.def.tearSeconds,
          anchorWorld,
          tear: () => this.tearPart(part.def.id)!,
        };
      }
    }
    return null;
  }
}

export class CompositeManager {
  readonly cars: CarComposite[] = [];

  constructor(
    private scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private bus: EventBus
  ) {
    /*
     * Der Biss der Spinne kommt ueber den Bus (Regel 10), nicht als Aufruf aus
     * `main.ts`: Der Bagger kennt keine Wracks, und die Wracks kennen keinen
     * Bagger. Die Zuordnung laeuft ueber `handle` — dasselbe Muster wie
     * `despawnByBody`.
     *
     * Kein `isValid()` noetig: Verglichen wird nur eine Zahl mit einer Zahl,
     * es wird nichts auf dem fremden Koerper abgefragt (E-103).
     */
    bus.on("greifer:zugedrueckt", (e) => {
      const car = this.cars.find((c) => c.body.handle === e.handle);
      if (!car) return; // gebissen wird viel, ein Wrack ist selten dabei
      car.beissen(e.kraftKN, new THREE.Vector3(e.x, e.y, e.z));
    });
  }

  spawnCar(pos: THREE.Vector3): CarComposite {
    const car = new CarComposite(CAR_DEF, this.scene, this.world, this.items, this.bus, pos, AKTIVE_FORM);
    this.cars.push(car);
    return car;
  }

  /**
   * DIE KAROSSERIEFORM ZUR LAUFZEIT UMSTELLEN (E-116) — zum Vorzeigen.
   *
   * Aufruf aus der Konsole: `__game.composites.zeigeForm("a")`. Alle Wracks,
   * die auf dem Platz stehen, werden an ihrer Stelle und in ihrer Lage neu
   * gebaut; neue Anlieferungen kommen ab jetzt in dieser Fassung.
   *
   * ZWEI GRENZEN, absichtlich:
   *  - Ein Wrack, das gerade auf einer Pritsche liegt (kinematisch), bleibt
   *    unangetastet. Der Lkw hält einen Verweis darauf; ein Austausch mitten
   *    in der Fahrt würde seine Ladung ins Nichts zeigen lassen.
   *  - Ein neu gebautes Wrack ist wieder heil. Schon abgerissene Teile liegen
   *    weiter daneben — das ist eine Vorführhilfe, kein Spielstand.
   */
  zeigeForm(id: WrackformId): string {
    AKTIVE_FORM = id;
    const alt = this.cars.splice(0, this.cars.length);
    let neu = 0;
    for (const car of alt) {
      if (!car.body.isValid() || car.body.isKinematic()) {
        this.cars.push(car);
        continue;
      }
      const t = car.body.translation();
      const r = car.body.rotation();
      const eintrag = this.items.itemByBody(car.body);
      if (eintrag) this.items.remove(eintrag, false);
      car.despawn();
      this.spawnCar(new THREE.Vector3(t.x, t.y, t.z)).body.setRotation(r, true);
      neu++;
    }
    const form = wrackform(id);
    return `${form ? form.name : "Bestand (zwei Quader)"} — ${neu} Wrack(s) neu gebaut`;
  }

  update(): void {
    for (const car of this.cars) car.update();
  }

  findPartNear(pos: THREE.Vector3): TearTarget | null {
    for (const car of this.cars) {
      const t = car.findPartNear(pos);
      if (t) return t;
    }
    return null;
  }

  /** Gehört der Körper zu einer Karosse? Dann entsorgen (Verkauf) — liefert true. */
  despawnByBody(body: RAPIER.RigidBody): boolean {
    const idx = this.cars.findIndex((c) => c.body.handle === body.handle);
    if (idx < 0) return false;
    this.cars[idx].despawn();
    this.cars.splice(idx, 1);
    return true;
  }
}
