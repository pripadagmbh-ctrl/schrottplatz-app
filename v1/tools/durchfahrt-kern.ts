/**
 * WER FAEHRT DURCH WEN — der kopflose Platz, einmal aufgebaut, von zwei
 * Geraeten benutzt.
 *
 * Anlass, woertlich (Patrick am Geraet, 17.09.2026): „LKWS fahren durch
 * Muellcontainer. Objekte fahren durch einander hindurch".
 *
 * WARUM DIE RECHNUNG HIER STEHT UND NICHT IM WAECHTER. Dieselbe Lehre wie bei
 * `tools/durchdringung.ts` (E-080) und `tools/engstellen-kern.ts` (E-091): Ein
 * Waechter, der seine eigene Messung mitbringt, prueft am Ende die Messung und
 * nicht die Maschine. `tools/durchfahrt.ts` schreibt den Bericht,
 * `test/durchfahrt.test.ts` haelt die Zahlen fest — beide rufen die Funktionen
 * von hier.
 *
 * DREI FRAGEN, DIE AUSEINANDERGEHALTEN WERDEN MUESSEN, weil sie zu drei ganz
 * verschiedenen Reparaturen fuehren:
 *
 *   1. STEHT ES IN DER HINDERNISLISTE?  `alleHindernisse()` ist das, was die
 *      Fahrer sehen. Was nicht drinsteht, existiert fuer sie nicht.
 *   2. FRAGT DIE FAHRT DIE LISTE UEBERHAUPT?  Nur `DeliveryVehicle.advance`
 *      ruft `isBlockedByBuilding`. Phasen, die den Wagen an `advance` vorbei
 *      versetzen, fahren blind.
 *   3. GIBT ES EINEN KOLLIDER, UND WIRKT ER?  Ein Fahrzeug ist kinematisch.
 *      Rapier haelt einen kinematischen Koerper NIE auf — an keiner Wand, an
 *      keinem Container, an keinem zweiten Fahrzeug. Der Kollider kann also
 *      lueckenlos da sein und trotzdem nichts ausrichten. Genau diese
 *      Unterscheidung — „kein Kollider" gegen „Kollider, aber wirkungslos" —
 *      beantwortet `kollisionsbild()`.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { VehicleManager, type DeliveryKind } from "../src/delivery/vehicles";
import type { CustomerProfile } from "../src/delivery/customers";
import { ItemManager, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { ContainerManager } from "../src/world/containers";
import { ContainerAbholung } from "../src/delivery/platzinventarAbholung";
import { alleHindernisse, setBuildingObstacles, type Obstacle } from "../src/world/obstacles";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { setBaggerOrt } from "../src/delivery/routes";
import { umrissUeberlappung, UMRISS_TOLERANZ } from "../src/delivery/umriss";
import type { Box } from "../src/world/boxen";

/** Der kopflose Platz: alles, was `main.ts` an Fahrenden und Stehendem aufbaut. */
export interface Platz {
  scene: THREE.Scene;
  world: RAPIER.World;
  items: ItemManager;
  containers: ContainerManager;
  composites: CompositeManager;
  m: VehicleManager;
  bus: EventBus;
}

/** Ein innen liegender Behaelter, so weit die Messung ihn braucht. */
interface BehaelterInnen {
  cfg: { id: string; label: string; kind: string; size: [number, number, number] };
  koerper: RAPIER.RigidBody | null;
}

/** Ein Fahrzeug, so weit die Messung es braucht — ohne die Modulgrenze zu brechen. */
interface WagenInnen {
  phaseName: string;
  parkSpot: [number, number] | null;
  group: THREE.Group;
  chassisBody: RAPIER.RigidBody;
  bedBody: RAPIER.RigidBody;
  boxen(out: Box[]): void;
}

/**
 * Der Platz ohne Fenster: Boden, Behaelter, Fuhrpark.
 *
 * Kein `new Yard(...)` — der braucht eine Zeichenflaeche und liefert nur
 * Kulisse. Was die Fahrer an Bauwerken sehen, steht in `obstacles.ts`, und das
 * sind Moduldaten. Genauso macht es `tools/abholung-abrechnung.ts`.
 */
export function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const bus = new EventBus();
  const items = new ItemManager(scene, world);
  const containers = new ContainerManager(scene, world, bus);
  const composites = new CompositeManager(scene, world, items, bus);
  const m = new VehicleManager(scene, world, items, composites);
  m.platzinventar = new ContainerAbholung(containers, items, world);
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  return { scene, world, items, containers, composites, m, bus };
}

/**
 * Ein Bild, in der Reihenfolge von `main.ts`.
 *
 * WICHTIG UND NICHT KOSMETISCH: `setBuildingObstacles` steht in `main.ts` in
 * Zeile 1396, `vehicles.update` in Zeile 988 — die Fahrer sehen also die
 * Behaelterlage des VORIGEN Bildes. Bei 1,4 m/s Schiebetempo (`maxSpeedFor`)
 * sind das 2,3 cm; das ist hier nachgebaut und nicht wegsortiert, damit die
 * Messung dasselbe misst, was das Spiel tut.
 */
export function takt(p: Platz, dt = 1 / 60): void {
  setBuildingObstacles(p.containers.hindernisse());
  p.containers.bremseAlle();
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
  p.scene.updateMatrixWorld(true);
}

/** Zugriff auf die Behaelter, ohne die Modulgrenze aufzubrechen. */
function behaelter(p: Platz): BehaelterInnen[] {
  return (p.containers as unknown as { containers: BehaelterInnen[] }).containers;
}

/** Der Koerper eines beweglichen Behaelters (nur `rolloff`/`grosscontainer`). */
export function behaelterKoerper(p: Platz, id: string): RAPIER.RigidBody | null {
  return behaelter(p).find((c) => c.cfg.id === id)?.koerper ?? null;
}

/** Einen beweglichen Behaelter dorthin stellen, wo der Spieler ihn hingestellt hat. */
export function stelleBehaelter(p: Platz, id: string, x: number, z: number): void {
  const b = behaelterKoerper(p, id);
  if (!b) throw new Error(`Behaelter ${id} ist nicht beweglich — kein Koerper`);
  b.setTranslation({ x, y: 0, z }, true);
}

/** Das aktive oder wartende Fahrzeug; `null`, wenn keins auf dem Hof ist. */
export function wagen(p: Platz): WagenInnen | null {
  const innen = p.m as unknown as { active: WagenInnen | null; parked: WagenInnen[] };
  return innen.active ?? innen.parked[0] ?? null;
}

/**
 * Alle Fahrzeuge EINZELN — und darauf kommt es an.
 *
 * `VehicleManager.fahrzeugBoxen()` liefert eine flache Liste. Wer darin Paare
 * bildet, vergleicht auch ZUGFAHRZEUG UND ANHAENGER DESSELBEN WAGENS
 * miteinander. Die beruehren sich an der Deichsel natuerlich, und der Bericht
 * meldete dann 3,10 m „Fahrzeug gegen Fahrzeug", sobald ein Privatmann mit
 * Anhaenger auf den Hof rollt (gemessen 17.09.2026, erste Fassung dieses
 * Geraets). Ein Messgeraet, das das meldet, ist unbrauchbar: Der echte Fall
 * geht im falschen unter.
 */
export function alleWagen(p: Platz): WagenInnen[] {
  const innen = p.m as unknown as { active: WagenInnen | null; parked: WagenInnen[] };
  return innen.active ? [innen.active, ...innen.parked] : [...innen.parked];
}

/**
 * ABGELEITETES TEMPO EINES KINEMATISCHEN KOERPERS (m/s).
 *
 * Rapier rechnet es aus `naechste Pose − jetzige Pose` je Schritt. Wer die
 * jetzige Pose vorher selbst umsetzt (`setTranslation`) und danach dieselbe
 * als naechste meldet (`setNextKinematicTranslation`), bekommt hier NULL —
 * der Koerper wird versetzt statt bewegt, und der Loeser sieht keinen Stoss,
 * sondern eine ruhende Ueberdeckung.
 */
export function kinTempo(b: RAPIER.RigidBody): number {
  const v = b.linvel();
  return Math.hypot(v.x, v.y, v.z);
}

/** Wieviele Beruehrpunkte Rapier zwischen zwei Koerpern gerade fuehrt. */
export function kontaktPunkte(world: RAPIER.World, a: RAPIER.RigidBody, b: RAPIER.RigidBody): number {
  let n = 0;
  for (let i = 0; i < a.numColliders(); i++) {
    for (let j = 0; j < b.numColliders(); j++) {
      world.contactPair(a.collider(i), b.collider(j), (mf) => {
        n += mf.numContacts();
      });
    }
  }
  return n;
}

/** Wie Rapier ein Paar behandelt — die Antwort auf „Kollider, aber wirkungslos?". */
export type Wirkung = "beide starr" | "einer weicht" | "keiner weicht" | "kein Kollider";

/**
 * Was zwei Koerper einander antun KOENNEN, allein aus ihrer Bauart.
 *
 * Rapier kennt drei Arten: 0 = dynamisch, 1 = fest, 2 = kinematisch (Pose),
 * 3 = kinematisch (Tempo). Daraus folgt ohne jede Messung:
 *
 *   dynamisch × irgendwas   der dynamische weicht aus   → „einer weicht"
 *   fest × fest             nichts bewegt sich          → „beide starr"
 *   kinematisch × fest      DER KINEMATISCHE FAEHRT HINDURCH
 *   kinematisch × kinemat.  BEIDE FAHREN HINDURCHEINANDER
 *
 * Die letzten beiden Faelle sind „keiner weicht": Es gibt Kollider, Rapier
 * meldet auch Beruehrungen — nur haelt niemanden etwas auf. Wer hier
 * „keiner weicht" liest, sucht den Fehler NICHT an den Kollidern, sondern an
 * der Wegplanung.
 */
export function wirkungZwischen(a: RAPIER.RigidBody, b: RAPIER.RigidBody): Wirkung {
  if (a.numColliders() === 0 || b.numColliders() === 0) return "kein Kollider";
  const kin = (t: number): boolean => t === 2 || t === 3;
  const dyn = (t: number): boolean => t === 0;
  const ta = a.bodyType();
  const tb = b.bodyType();
  if (dyn(ta) || dyn(tb)) return "einer weicht";
  if (kin(ta) || kin(tb)) return "keiner weicht";
  return "beide starr";
}

/** Ein Fund: wer, wo, wie tief, in welcher Phase. */
export interface Treffer {
  /** Bildnummer seit Messbeginn */
  f: number;
  /** Phase des Fahrzeugs, das den Fund verursacht (`vehicles.phaseName`) */
  phase: string;
  /** Was durchdringt */
  wer: string;
  /** Was durchdrungen wird (Schild aus der Hindernisliste) */
  gegen: string;
  /** Tiefe im Grundriss (m) */
  tiefe: number;
  /** Mitte des durchdringenden Umrisses */
  x: number;
  z: number;
}

/**
 * Alle Durchdringungen dieses Bildes einsammeln.
 *
 * Gerechnet mit `umrissUeberlappung` aus `src/delivery/umriss.ts` — derselben
 * Funktion, mit der `isBlockedByBuilding` waehrend der Fahrt nach vorn schaut.
 * Eine zweite Rechnung waere eine zweite Wahrheit.
 */
export function scanneBild(p: Platz, f: number, out: Treffer[]): void {
  const phase = wagen(p)?.phaseName ?? "—";
  const hind: readonly Obstacle[] = alleHindernisse();
  const boxen = p.m.fahrzeugBoxen();
  for (const b of boxen) {
    for (const o of hind) {
      const d = umrissUeberlappung(b, o);
      if (d > UMRISS_TOLERANZ) {
        out.push({ f, phase, wer: "Fahrzeug", gegen: o.label, tiefe: d, x: b.x, z: b.z });
      }
    }
  }
  /*
   * Fahrzeug gegen Fahrzeug — und zwar nur VERSCHIEDENE Fahrzeuge. Das Paar
   * steht in KEINER der beiden Abfragen der Fahrt: `blockedAt` kennt Bagger
   * und liegenden Schrott, `isBlockedByBuilding` kennt Bauwerke und
   * bewegliche Behaelter. Ein zweiter LKW kommt in beiden nicht vor.
   */
  const jeWagen = alleWagen(p).map((w) => {
    const eigene: Box[] = [];
    w.boxen(eigene);
    return eigene;
  });
  for (let i = 0; i < jeWagen.length; i++) {
    for (let j = i + 1; j < jeWagen.length; j++) {
      for (const a of jeWagen[i]!) {
        for (const b of jeWagen[j]!) {
          const d = ueberlappungZweierUmrisse(a, b);
          if (d > UMRISS_TOLERANZ) {
            out.push({ f, phase, wer: "Fahrzeug", gegen: "Fahrzeug", tiefe: d, x: a.x, z: a.z });
          }
        }
      }
    }
  }
}

/**
 * Zwei gedrehte Rechtecke gegeneinander.
 *
 * `umrissUeberlappung` kann nur gedreht gegen achsparallel. Fuer Fahrzeug
 * gegen Fahrzeug wird das zweite deshalb auf seinen Huellkasten gebracht —
 * die Zahl faellt damit im Zweifel zu GROSS aus, nie zu klein, und taugt
 * genau dafuer: „hier lohnt das Hinsehen".
 */
function ueberlappungZweierUmrisse(a: Box, b: Box): number {
  const c = Math.abs(Math.cos(b.rot));
  const s = Math.abs(Math.sin(b.rot));
  return umrissUeberlappung(a, {
    x: b.x,
    z: b.z,
    hw: b.hw * c + b.hd * s,
    hd: b.hw * s + b.hd * c,
  });
}

/** Nur die tiefste Durchdringung je Paar „Phase | Gegenstand". */
export function tiefstePro(treffer: readonly Treffer[]): Map<string, Treffer> {
  const out = new Map<string, Treffer>();
  for (const t of treffer) {
    const k = `${t.phase} | ${t.gegen}`;
    const alt = out.get(k);
    if (!alt || t.tiefe > alt.tiefe) out.set(k, t);
  }
  return out;
}

/** Was eine Messfahrt einstellen kann. */
export interface Fahrtplan {
  /** Fahrzeugart (`kipper`, `pritsche`, `abholer`, `pkw`, `wrack`) */
  kind: DeliveryKind;
  /** Warteplatz erzwingen — sonst wuerfelt der Fuhrpark ihn aus. */
  parkSpot?: [number, number] | null;
  /** Hoechstzahl Bilder */
  bilder?: number;
  /** Bis zu dieser Phase fahren (danach abbrechen) */
  bisPhase?: string;
  /**
   * Kundschaft vorgeben statt wuerfeln.
   *
   * Notwendig und nicht bequem: Ein Kipper mit SORTENREINER Fuhre faehrt in
   * sein Lagersilo statt an den Abladeplatz (`routes.faehrtInsSilo`), und
   * damit beginnt sein Weg zum Warteplatz an einer ganz anderen Stelle des
   * Hofes. Wer das dem Zufall ueberlaesst, misst mal das eine und mal das
   * andere. `test/pruefkunde.ts` liefert passende Profile.
   */
  kunde?: CustomerProfile;
  /** Wird je Bild mit dem Phasennamen gerufen — fuer „was kam ueberhaupt vor?". */
  beobachter?: (phase: string) => void;
}

/**
 * Eine Fuhre fahren und dabei jedes Bild abtasten.
 *
 * Der Warteplatz wird gesetzt und nicht gewuerfelt: `spawnNow` vergibt ihn mit
 * 35 bis 75 Prozent Wahrscheinlichkeit (`vehicles.ts`), und eine Messung, die
 * nur manchmal misst, ist keine.
 */
export function fahre(p: Platz, plan: Fahrtplan): Treffer[] {
  const out: Treffer[] = [];
  p.m.spawnNow(plan.kind, plan.kunde);
  const w = wagen(p);
  if (!w) throw new Error("kein Fahrzeug gespawnt");
  if (plan.parkSpot !== undefined) w.parkSpot = plan.parkSpot;
  const grenze = plan.bilder ?? 60 * 200;
  for (let f = 0; f < grenze; f++) {
    takt(p);
    scanneBild(p, f, out);
    const a = wagen(p);
    if (a) plan.beobachter?.(a.phaseName);
    if (a && plan.bisPhase && a.phaseName === plan.bisPhase) break;
  }
  return out;
}

/** Eine Kiste Schrott an einer Stelle — fuer „Fahrzeug gegen liegenden Schrott". */
export function legeSchrott(p: Platz, x: number, z: number, kg: number): RAPIER.RigidBody {
  const form: ScrapShape = { kind: "box", dims: [0.9, 0.7, 1.1], color: 0x8899aa };
  const it = p.items.spawnScrap("steel", kg, form, new THREE.Vector3(x, 0.6, z), new THREE.Quaternion());
  for (let i = 0; i < 90; i++) takt(p);
  return it.body;
}
