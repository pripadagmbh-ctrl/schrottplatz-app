import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getMaterial } from "../materials/catalog";

/**
 * Schrottteile mit materialtypischen Formen (Briefing Kap. 7).
 * Generische Form-Fabrik: dieselben Specs erzeugen Starthaufen, Fahrzeug-
 * Ladungen (M3) und beim Laden den gespeicherten Zustand.
 */

/** Serialisierbare Formbeschreibung eines Teils */
export interface ScrapShape {
  kind: "box" | "cyl" | "torus" | "wire";
  /** box: [w,h,d] · cyl: [radius, länge] · torus: [radius, rohrRadius] · wire (Drahtknäuel): [radius] */
  dims: number[];
  color: number;
  /** true = wurde in der Presse plattgedrückt (persistiert im Save) */
  flat?: boolean;
}

/**
 * Aufgerolltes Kabel: ein Strang, der sich mehrfach um sich selbst windet.
 * Der Radius schwankt leicht, damit die Rolle nicht wie gedrechselt wirkt.
 */
/**
 * Kabelbund, wie er auf dem Schrottplatz liegt.
 *
 * Die frühere Wicklung sah aus wie ein aufgerollter Gartenschlauch: zu
 * gleichmäßig, zu dünn, zu ordentlich. Ein Kabelbund ist ein grob
 * zusammengelegter Strang, der in mehreren Lagen übereinanderfällt, sich
 * kreuzt und an den Rändern ausbeult. Dafür bekommt die Kurve jetzt eine
 * unregelmäßige Wicklung mit wechselnder Höhe und ein deutlich dickeres
 * Rohr — Starkstromkabel haben Finger- bis Armdicke (Wunsch 02.09.2026).
 */
function cableCoilGeometry(r: number, tube: number): THREE.BufferGeometry {
  const TURNS = 2.7;
  const STEPS = 150;
  const pts: THREE.Vector3[] = [];
  // fester Zufall je Bund, damit nicht alle gleich aussehen
  let seed = Math.floor(r * 1000) % 97;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  const wobbleA = rnd() * 0.9;
  const wobbleB = rnd() * 0.9;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const a = t * Math.PI * 2 * TURNS;
    // Der Strang läuft nicht sauber spiralig, sondern legt sich in Lagen
    // übereinander und beult dabei aus
    const rad =
      r * (0.72 + 0.3 * Math.sin(t * Math.PI)) +
      Math.sin(a * 1.7 + wobbleA) * r * 0.16 +
      Math.cos(a * 2.9 + wobbleB) * r * 0.1;
    // Höhe schwingt: der Bund liegt in zwei, drei Lagen
    const y = Math.sin(t * Math.PI * 2.2 + wobbleA) * tube * 1.5 + (t - 0.5) * tube * 0.6;
    pts.push(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  // Deutlich dicker: ein Kabel ist kein Draht
  return new THREE.TubeGeometry(curve, STEPS, tube * 0.78, 7, false);
}

/** Kollider für ein plattgedrücktes Teil (flacher Quader über der Grundfläche). */
/**
 * Dämpfung nach Masse. Physikalisch bremst Luftwiderstand leichte Körper
 * viel stärker als schwere; eine feste Bremse für alles ließ 2-Tonnen-Teile
 * so zahm wirken wie Bleche.
 */
/**
 * Höchstgeschwindigkeit QUER nach Masse.
 *
 * Die Grenze gibt es, weil die Spinne ein kinematischer Körper ist: Sie
 * überträgt beim Anschlagen beliebig viel Schwung, und ohne Deckelung fliegt
 * ein Motorblock so weit wie ein Blech.
 *
 * Sie war aber viel zu eng und galt für JEDE Richtung, also auch fürs Fallen.
 * Gemessen (11.09.2026): Ein 180-kg-Teil fiel mit konstant 1,5 m/s statt mit
 * 9,81 m/s² zu beschleunigen — genau das Schweben, das im Spiel zu sehen war.
 * Und ein weggeschleudertes Teil verlor seinen Schwung sofort wieder, statt
 * seitlich davonzufliegen. Der alte Kommentar behauptete, Fallen bleibe
 * unberührt; das stimmte nicht.
 *
 * Jetzt: Ein 20-kg-Blech kommt auf 12 m/s, ein 500-kg-Brocken auf 4 m/s. Nach
 * unten gilt die Grenze gar nicht (siehe FALL_MAX) — dort arbeitet die
 * Schwerkraft.
 */
/** Fraktionen ohne metallischen Glanz — Abfall eben. */
const NICHTMETALLE = new Set(["wood", "tires", "rubble", "plastic"]);

export function maxSpeedFor(massKg: number): number {
  return Math.min(8, Math.max(3.5, 45 / Math.sqrt(Math.max(massKg, 1))));
}

/**
 * Wie viel Tempo ein Teil in EINEM Schritt dazugewinnen darf (m/s).
 *
 * Das ist die eigentliche Bremse gegen wegspringende Teile (Befund
 * 11.09.2026). Die Spinne ist kinematisch: Klemmt ein Stueck zwischen zwei
 * Schalen, loest der Loeser die Ueberlappung mit einem einzigen, sehr grossen
 * Stoss auf — das Teil schiesst weg wie ein Kern aus der Seife. Eine
 * Hoechstgeschwindigkeit faengt das schlecht ab: Sie muesste so niedrig sein,
 * dass auch Fallen und Werfen darunter leiden (genau das war bis heute Morgen
 * der Fall).
 *
 * Eine Grenze fuer den ZUWACHS trifft dagegen nur den Stoss. Die Schwerkraft
 * gibt je Schritt 0,16 m/s dazu und bleibt unberuehrt; ein Wurf behaelt seinen
 * Schwung, weil er beim Loslassen gesetzt und nicht gewonnen wird.
 */
const MAX_ZUWACHS = 0.6;

/** Ab diesem Tempoverlust in einem Schritt gilt es als Aufprall (m/s) */
const AUFPRALL_DV = 1.1;
/** So lange meldet dasselbe Teil keinen zweiten Aufprall (s) */
const AUFPRALL_PAUSE_S = 0.18;

/**
 * Deckelung nach unten — nur als Netz gegen Rechenausreisser. Aus 5 m freiem
 * Fall kommt ein Teil auf 10 m/s; hier ist viel Luft bis dahin.
 */
export const FALL_MAX = 35;

/**
 * Achtkant-Prisma statt Zylinder (v2 E-011).
 *
 * Rapier kennt keinen Rollwiderstand. Ein mathematisch perfekter Zylinder rollt
 * deshalb endlos weiter — v2 mass 0,45 m/s noch nach 40 s, auch mit hoher
 * Daempfung. Acht Kanten stoppen das von selbst und sehen an verbeultem
 * Altmetall ohnehin richtiger aus. Das Mesh bleibt 14-seitig, nur der Kollider
 * bekommt Ecken; die Masse wird ohnehin per setMass gesetzt.
 */
function achtkant(radius: number, halbHoehe: number): RAPIER.ColliderDesc {
  const punkte: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    punkte.push(x, halbHoehe, z, x, -halbHoehe, z);
  }
  return (
    RAPIER.ColliderDesc.convexHull(new Float32Array(punkte)) ??
    RAPIER.ColliderDesc.cylinder(halbHoehe, radius)
  );
}

/**
 * Drehdaempfung. Kurze runde Teile — Felge, Coil, Reifen — trudeln sonst wie
 * eine Muenze auf dem Tisch minutenlang aus und halten ueber die gemeinsame
 * Schlafregel den ganzen Haufen wach (v2 mass 128 Koerper).
 */
function dampAngFuer(shape: ScrapShape, massKg: number): number {
  const rund =
    shape.kind === "torus" ||
    shape.kind === "wire" ||
    (shape.kind === "cyl" && shape.dims[1] <= shape.dims[0] * 2.5);
  return rund ? Math.max(dampAng(massKg), 4.0) : dampAng(massKg);
}

/** Luft zwischen zwei Teilen beim Setzen (v2: spawnGapM). */
const SPAWN_ABSTAND = 0.06;

/**
 * Radius der Umkugel einer Form. Beim Spawn wird jedes Teil zufaellig verdreht,
 * darum ist die Kugel das richtige Mass — ein Quader ragt in der Diagonale
 * weiter als seine laengste Kante halbiert.
 */
export function umkugelRadius(shape: ScrapShape): number {
  const d = shape.dims;
  if (shape.kind === "box") return Math.hypot(d[0], d[1], d[2]) / 2;
  if (shape.kind === "cyl") return Math.hypot(d[0], d[1] / 2);
  if (shape.kind === "torus") return d[0] + d[1];
  return d[0];
}

export function dampLin(massKg: number): number {
  return Math.min(0.45, Math.max(0.02, 8 / Math.max(massKg, 1)));
}
export function dampAng(massKg: number): number {
  return Math.min(0.9, Math.max(0.05, 16 / Math.max(massKg, 1)));
}

function flatColliderDesc(shape: ScrapShape): RAPIER.ColliderDesc {
  const H = 0.18;
  if (shape.kind === "box") return RAPIER.ColliderDesc.cuboid(shape.dims[0] / 2, H, shape.dims[2] / 2);
  if (shape.kind === "cyl") {
    const [r, len] = shape.dims;
    return len > r * 2.5 ? RAPIER.ColliderDesc.cuboid(r, H, len / 2) : RAPIER.ColliderDesc.cuboid(r, H, r);
  }
  if (shape.kind === "torus") {
    const r = shape.dims[0] + shape.dims[1];
    return RAPIER.ColliderDesc.cuboid(r, H, r);
  }
  return RAPIER.ColliderDesc.cuboid(shape.dims[0], H * 2, shape.dims[0]); // wire
}

/**
 * Wie stark ein Teil beim Quetschen zusammengeht. 0,18 hat die Ursprungsform
 * völlig ausgelöscht — aus allem wurde eine Platte. 0,55 verbeult das Stück
 * sichtbar, man erkennt aber noch, was es einmal war.
 */
const FLAT_SCALE_Y = 0.55;

interface PileSpec {
  materialId: string;
  massKg: number;
  kind: ScrapShape["kind"];
  dims: number[];
}

// Basis-Sortiment (SW) — Starthaufen und Zufalls-Ladungen speisen sich hieraus
const SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 60, kind: "box", dims: [0.15, 0.15, 1.3] }, // Profilstahl
  { materialId: "steel", massKg: 45, kind: "cyl", dims: [0.09, 1.1] }, // Rohr
  { materialId: "steel", massKg: 35, kind: "box", dims: [0.12, 0.12, 0.9] },
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.7, 0.06, 0.9] }, // Blech
  { materialId: "steel", massKg: 90, kind: "box", dims: [0.7, 0.5, 0.15] }, // Heizkörper (früher Guss)
  { materialId: "steel", massKg: 110, kind: "box", dims: [0.4, 0.4, 0.4] }, // Motorblock-Rest
  { materialId: "steel", massKg: 70, kind: "box", dims: [0.18, 0.18, 1.1] },
  { materialId: "va", massKg: 26, kind: "box", dims: [0.9, 0.18, 0.6] }, // Spülbecken
  { materialId: "va", massKg: 34, kind: "cyl", dims: [0.34, 0.8] }, // VA-Behälter
  { materialId: "va", massKg: 18, kind: "box", dims: [0.06, 0.06, 1.5] }, // VA-Geländerrohr
  { materialId: "alu", massKg: 12, kind: "cyl", dims: [0.32, 0.22] }, // Felge
  { materialId: "alu", massKg: 8, kind: "box", dims: [0.08, 0.08, 1.4] }, // Profil
  { materialId: "alu", massKg: 10, kind: "box", dims: [0.6, 0.04, 0.8] }, // Tafel
  { materialId: "alu", massKg: 11, kind: "cyl", dims: [0.3, 0.2] },
  { materialId: "copper", massKg: 12, kind: "cyl", dims: [0.05, 0.8] }, // Kupferrohr
  { materialId: "copper", massKg: 18, kind: "torus", dims: [0.14, 0.05] }, // Kupferbund
  { materialId: "copper", massKg: 15, kind: "box", dims: [0.3, 0.25, 0.3] }, // Messingarmaturen
  { materialId: "cable", massKg: 9, kind: "torus", dims: [0.18, 0.07] },
  { materialId: "cable", massKg: 7, kind: "torus", dims: [0.15, 0.06] },
  { materialId: "cable", massKg: 12, kind: "torus", dims: [0.2, 0.08] },
  { materialId: "wood", massKg: 14, kind: "box", dims: [0.12, 0.12, 1.2] },
  { materialId: "plastic", massKg: 8, kind: "box", dims: [0.5, 0.05, 0.9] },
  // Maschendraht-Bündel: sperrig + leicht — eignet sich als „Kehrbesen" zum
  // Freischieben von Pritsche und Boden (Design-Wunsch 2026-08-27)
  { materialId: "steel", massKg: 22, kind: "wire", dims: [0.55] },

  // Was auf einem Schrottplatz sonst noch liegt (Wunsch 10.09.2026). Vorher
  // war das Sortiment sehr nach Baustelle: Profile, Rohre, Bleche. Ein Platz
  // lebt aber von dem, was die Leute anschleppen — Hausrat, Zweiraeder,
  // Landmaschinen, ausgeschlachtete Fahrzeugteile.
  { materialId: "steel", massKg: 42, kind: "box", dims: [0.55, 0.85, 0.55] }, // Waschmaschine
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.6, 0.85, 0.6] }, // Spuelmaschine
  { materialId: "steel", massKg: 30, kind: "box", dims: [0.65, 0.9, 0.6] }, // Elektroherd
  { materialId: "steel", massKg: 52, kind: "cyl", dims: [0.28, 1.4] }, // Warmwasserspeicher
  { materialId: "steel", massKg: 48, kind: "box", dims: [1.6, 0.55, 0.7] }, // Badewanne
  { materialId: "steel", massKg: 26, kind: "box", dims: [0.6, 0.9, 1.9] }, // Motorradrahmen
  { materialId: "steel", massKg: 14, kind: "box", dims: [0.5, 0.7, 1.6] }, // Mopedrahmen
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.1, 0.35, 0.9] }, // Pflugschar
  { materialId: "steel", massKg: 85, kind: "cyl", dims: [0.34, 1.7] }, // Eggenwalze
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.5, 0.5, 1.4] }, // Traktor-Frontgewicht
  { materialId: "steel", massKg: 95, kind: "box", dims: [2.1, 0.25, 0.35] }, // Heuwender-Ausleger
  { materialId: "steel", massKg: 210, kind: "cyl", dims: [0.16, 2.2] }, // LKW-Achse
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.8, 0.7, 0.9] }, // LKW-Getriebe
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.9, 0.75, 0.12] }, // LKW-Kuehler
  { materialId: "steel", massKg: 46, kind: "cyl", dims: [0.28, 0.32] }, // LKW-Felge
  { materialId: "alu", massKg: 16, kind: "box", dims: [0.7, 0.5, 0.15] }, // Motorradmotor
  { materialId: "copper", massKg: 22, kind: "box", dims: [0.45, 0.4, 0.35] }, // Elektromotor
  { materialId: "tires", massKg: 11, kind: "torus", dims: [0.31, 0.11] }, // Traktorreifen
];

/**
 * Großteile für Händler-Anlieferungen (Design-Wunsch 2026-08-29): sperrig und
 * schwer — genau das Material, für das sich Schere und Presse lohnen.
 */
/**
 * Schwergewichte, die einen ganzen Auflieger füllen: Tanks, Fahrzeugteile,
 * Zug- und Flugzeugbauteile. Sie sind absichtlich sperrig — so ein Stück
 * einzufädeln ist die eigentliche Aufgabe am Bagger (Wunsch 29.08.2026).
 */
const HUGE_SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 1.1, 1.9] }, // Waggon-Drehgestell
  { materialId: "steel", massKg: 2200, kind: "box", dims: [3.2, 0.9, 0.8] }, // Kettenlaufwerk
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.1, 3.6] }, // Kesselwagen-Segment
  { materialId: "steel", massKg: 1400, kind: "cyl", dims: [1.2, 3.1] }, // Lagertank
  { materialId: "steel", massKg: 1100, kind: "cyl", dims: [0.9, 2.0] }, // Turbinengehäuse
  { materialId: "steel", massKg: 900, kind: "box", dims: [2.2, 1.9, 1.8] }, // LKW-Fahrerhaus
  { materialId: "steel", massKg: 1600, kind: "box", dims: [2.8, 1.2, 1.1] }, // Pressenrahmen
  { materialId: "va", massKg: 950, kind: "cyl", dims: [1.0, 2.8] }, // VA-Prozesstank
  { materialId: "va", massKg: 700, kind: "box", dims: [2.6, 0.9, 1.2] }, // VA-Behälter
  { materialId: "alu", massKg: 700, kind: "box", dims: [3.5, 0.35, 1.6] }, // Tragflächenstück
  { materialId: "alu", massKg: 800, kind: "cyl", dims: [1.3, 3.0] }, // Rumpfsegment
  { materialId: "alu", massKg: 550, kind: "box", dims: [2.9, 1.1, 0.9] }, // Aufbau/Kofferaufbau
];

const BIG_SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 180, kind: "box", dims: [0.28, 0.28, 2.9] }, // Doppel-T-Träger
  { materialId: "steel", massKg: 220, kind: "box", dims: [1.9, 0.08, 1.5] }, // Blechtafel
  { materialId: "steel", massKg: 160, kind: "cyl", dims: [0.22, 2.6] }, // dickes Rohr
  { materialId: "steel", massKg: 140, kind: "box", dims: [1.2, 0.9, 0.75] }, // Kessel
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.75, 1.5, 0.7] }, // Waschmaschine
  { materialId: "steel", massKg: 420, kind: "box", dims: [0.9, 0.7, 0.95] }, // Maschinenblock
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.6, 0.9] }, // Schwungrad
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.1, 0.8] }, // Stahlschrank
  { materialId: "steel", massKg: 195, kind: "box", dims: [2.4, 0.9, 0.12] }, // Stahltür/Tor
  { materialId: "steel", massKg: 240, kind: "cyl", dims: [0.75, 1.9] }, // Öltank/Boiler
  { materialId: "steel", massKg: 150, kind: "wire", dims: [1.15] }, // Drahtballen
  { materialId: "va", massKg: 210, kind: "cyl", dims: [0.7, 1.8] }, // VA-Tank
  { materialId: "va", massKg: 130, kind: "box", dims: [1.8, 0.1, 1.1] }, // VA-Tafel
  { materialId: "va", massKg: 95, kind: "box", dims: [1.2, 0.85, 0.7] }, // Gastro-Spültisch
  { materialId: "va", massKg: 70, kind: "box", dims: [0.14, 0.14, 2.6] }, // VA-Rohrbündel
  { materialId: "alu", massKg: 60, kind: "box", dims: [0.3, 0.3, 2.8] }, // Profilbündel
  { materialId: "alu", massKg: 45, kind: "box", dims: [1.6, 0.06, 1.2] }, // Alutafel
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.4, 1.2, 0.25] }, // Alu-Fensterrahmen
  { materialId: "alu", massKg: 110, kind: "cyl", dims: [0.55, 1.4] }, // Alu-Kessel
  { materialId: "copper", massKg: 65, kind: "cyl", dims: [0.35, 1.2] }, // Kupfer-Boiler
  { materialId: "copper", massKg: 48, kind: "torus", dims: [0.45, 0.16] }, // Kupferrohr-Bund
  { materialId: "cable", massKg: 55, kind: "torus", dims: [0.55, 0.22] }, // Kabelbund
  { materialId: "cable", massKg: 120, kind: "cyl", dims: [0.85, 0.9] }, // Kabeltrommel
  { materialId: "wood", massKg: 90, kind: "box", dims: [1.4, 0.5, 0.9] }, // Holzkiste
  { materialId: "rubble", massKg: 130, kind: "box", dims: [1.1, 1.1, 1.1] }, // Betonblock
];

const CABLE_COLORS = [0xb0682a, 0x71646a, 0x315e75];

function colorFor(spec: PileSpec, seed: number): number {
  return spec.materialId === "cable"
    ? CABLE_COLORS[seed % CABLE_COLORS.length]
    : getMaterial(spec.materialId).color;
}

/**
 * Zufalls-Ladung für Anlieferungen.
 * @param bigShare 0..1 — Anteil Großteile (Händler liefern überwiegend groß)
 */
export function randomCargo(
  count: number,
  bigShare = 0,
  /** Anteil Schwergewichte (Tanks, Zug-/Flugzeugteile) an der Ladung */
  hugeShare = 0,
  /**
   * Sortenrein: Händler liefern ihre Ware oft schon getrennt an. Ist eine
   * Fraktion gesetzt, besteht die ganze Ladung daraus.
   */
  onlyMaterial?: string
): Array<{ materialId: string; massKg: number; shape: ScrapShape }> {
  const out = [];
  for (let i = 0; i < count; i++) {
    const pool =
      Math.random() < hugeShare
        ? HUGE_SPECS
        : Math.random() < bigShare
          ? BIG_SPECS
          : SPECS;
    // Fraktionsmix der Anlieferungen (SW): 60 % Misch-/Stahlschrott,
    // 20 % Aluminium, der Rest verteilt sich auf VA, Kupfer, Kabel, Störstoff
    const r = Math.random();
    const wanted =
      onlyMaterial ??
      (r < 0.6
        ? "steel"
        : r < 0.8
          ? "alu"
          : ["va", "copper", "cable", "wood", "plastic", "rubble"][Math.floor(Math.random() * 6)]);
    let matching = pool.filter((s) => s.materialId === wanted);
    // Sortenreine Ladung: notfalls in der anderen Größenklasse suchen, damit
    // die Fraktion auf jeden Fall stimmt
    if (onlyMaterial && matching.length === 0) {
      matching = [...SPECS, ...BIG_SPECS].filter((s) => s.materialId === wanted);
    }
    const spec =
      matching.length > 0
        ? matching[Math.floor(Math.random() * matching.length)]
        : pool[Math.floor(Math.random() * pool.length)];
    out.push({
      materialId: spec.materialId,
      massKg: spec.massKg,
      shape: { kind: spec.kind, dims: spec.dims, color: colorFor(spec, i) },
    });
  }
  return out;
}

export interface ScrapItem {
  id: string;
  materialId: string;
  massKg: number;
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
  /** aktuell zugeordneter Container (per Zonen-Zählung), null = lose */
  containerId: string | null;
  /** Form für Save/Load — Objekte ohne shape (Karossen) sichert das Composite-System */
  shape?: ScrapShape;
  /**
   * Nur bei Presspaketen: woraus das Paket besteht. Ein Mischpaket bleibt
   * damit auch nach dem Pressen als Mischung erkennbar und bringt beim
   * Verkauf weniger als ein sortenrein gepresstes.
   */
  composition?: Array<{ materialId: string; massKg: number }>;
}

/**
 * Schwellen der Schlafhilfe. Rapiers eigene Werte (0,4 m/s) sind nicht
 * einstellbar und greifen erst, wenn eine ganze Kontakt-Insel ruht — bei einem
 * Haufen ist das nie der Fall, weil immer irgendwo ein Teil zittert.
 */
/**
 * Die Werte aus v2 (0,06 / 0,12) passen dort zu weichen Kontakten (6 Iterationen,
 * Frequenz 30). Der Prototyp rechnet bewusst haerter (12 Iterationen, Frequenz 40,
 * zugelassener Fehler 0,001), damit Teile nicht ineinander einsinken — das
 * erzeugt aber ein Grundrauschen: gemessen bleiben einzelne Teile dauerhaft bei
 * rund 0,007 m/s und 0,25 rad/s stehen, ohne sich wirklich zu bewegen. Die
 * Schwellen liegen darum ueber diesem Rauschen und nicht darunter.
 */
const SCHLAF_LIN = 0.09; // m/s
const SCHLAF_ANG = 0.45; // rad/s
/** So oft hintereinander muss alles unter den Schwellen liegen (à 0,25 s). */
const SCHLAF_PRUEFUNGEN = 4;
/**
 * Anteil der Teile, der still liegen muss, damit der Stapel schlafen geht.
 * Gemessen: bei Einstimmigkeit schlief je nach Haufen gar nichts, weil immer
 * genau ein (wechselndes) Teil zuckte.
 */
const SCHLAF_MEHRHEIT = 0.92;
/**
 * Darueber ist es echte Bewegung — etwas faellt, rollt oder wird getragen.
 * Ein einziges solches Teil haelt den ganzen Haufen wach, und das ist richtig so.
 */
const BEWEGUNG_LIN = 0.5; // m/s
const BEWEGUNG_ANG = 2.5; // rad/s
const SCHLAF_TAKT_S = 0.25;
/** Teile so nah an der Spinne bleiben wach (v2 E-041: schlafend durch den Boden gesackt). */
const SCHLAF_ABSTAND_SPINNE = 3.0;

export class ItemManager {
  readonly items: ScrapItem[] = [];
  private byHandle = new Map<number, ScrapItem>();
  private highlighted: ScrapItem | null = null;
  private nextId = 0;
  private schlafUhr = 0;
  private schlafZaehler = 0;

  constructor(
    private scene: THREE.Scene,
    private world: RAPIER.World
  ) {}

  register(params: {
    materialId: string;
    massKg: number;
    mesh: THREE.Object3D;
    body: RAPIER.RigidBody;
    shape?: ScrapShape;
    composition?: Array<{ materialId: string; massKg: number }>;
  }): ScrapItem {
    const item: ScrapItem = {
      id: `item_${this.nextId++}`,
      materialId: params.materialId,
      massKg: params.massKg,
      mesh: params.mesh,
      body: params.body,
      containerId: null,
      shape: params.shape,
      composition: params.composition,
    };
    this.items.push(item);
    this.byHandle.set(params.body.handle, item);
    return item;
  }

  /**
   * Schlafhilfe (v2 E-012): legt lose Körper **nur gemeinsam** schlafen.
   *
   * Einzeln schlafen zu legen klingt naheliegend, zerstört aber den Haufen: Ein
   * Körper unter Last, den man allein stilllegt, verliert den Kontakt zum Boden
   * und sinkt durch den Platz. Deshalb die Alles-oder-nichts-Regel — erst wenn
   * jedes lose Teil drei Prüfungen lang unter den Schwellen liegt, schlafen alle
   * zusammen ein. Danach weckt sie jede Berührung von selbst wieder.
   *
   * `spinnePos` schützt die Umgebung des Greifers: Teile dort bleiben wach,
   * sonst sackt ein „schlafendes" Teil unter der arbeitenden Spinne weg.
   */
  settleSleep(dt: number, spinnePos?: { x: number; y: number; z: number }): void {
    this.schlafUhr += dt;
    if (this.schlafUhr < SCHLAF_TAKT_S) return;
    this.schlafUhr = 0;

    const kandidaten: RAPIER.RigidBody[] = [];
    let still = 0;
    for (const item of this.items) {
      const b = item.body;
      if (!b.isDynamic()) continue; // auf der Mulde mitgefuehrte Teile sind kinematisch
      if (spinnePos) {
        const t = b.translation();
        const d = Math.hypot(t.x - spinnePos.x, t.y - spinnePos.y, t.z - spinnePos.z);
        // Teile am Greifer bleiben aussen vor — sie schlafen nicht mit ein, und
        // ihre Bewegung darf den Rest des Haufens nicht wachhalten. Sonst
        // schliefe nie etwas, weil die Spinne fast immer ueber dem Haufen steht.
        if (d < SCHLAF_ABSTAND_SPINNE) continue;
      }
      if (b.isSleeping()) continue;
      const v = b.linvel();
      const w = b.angvel();
      const lin = Math.hypot(v.x, v.y, v.z);
      const ang = Math.hypot(w.x, w.y, w.z);

      // Echte Bewegung: etwas faellt, rollt oder wird getragen. Dann schlaeft
      // niemand — der Haufen ist in Arbeit.
      if (lin > BEWEGUNG_LIN || ang > BEWEGUNG_ANG) {
        this.schlafZaehler = 0;
        return;
      }
      kandidaten.push(b);
      if (lin <= SCHLAF_LIN && ang <= SCHLAF_ANG) still++;
    }

    if (kandidaten.length === 0) return;
    // Mehrheitsregel statt Einstimmigkeit: Gemessen ist bei jeder Pruefung genau
    // ein Teil ueber der Schwelle — aber jedes Mal ein anderes. Die Restenergie
    // wandert durch den Stapel, also wird nie alles gleichzeitig still, und mit
    // Einstimmigkeit schlief je nach Haufen gar nichts (bis 98 von 113 wach).
    // E-012 verbietet, ein *einzelnes* Teil unter Last schlafen zu legen; hier
    // geht der ganze Stapel gemeinsam schlafen, die Zucker eingeschlossen.
    if (still / kandidaten.length < SCHLAF_MEHRHEIT) {
      this.schlafZaehler = 0;
      return;
    }
    if (++this.schlafZaehler < SCHLAF_PRUEFUNGEN) return;
    this.schlafZaehler = 0;
    for (const b of kandidaten) {
      // Restgeschwindigkeit vorher wegnehmen, sonst traegt ein Zucker seinen
      // Schwung mit in den Schlaf und stoesst beim Aufwachen den Nachbarn an.
      b.setLinvel({ x: 0, y: 0, z: 0 }, false);
      b.setAngvel({ x: 0, y: 0, z: 0 }, false);
      b.sleep();
    }
  }

  /**
   * Vorsimulation: den Haufen sich setzen lassen, bevor das erste Bild steht.
   * Ohne das beginnt jede Partie mit einem zappelnden Berg, und der Spieler
   * sieht die Teile erst zurechtrutschen (v2: `Simulation.settle()`).
   */
  settle(world: RAPIER.World, schritte = 240): void {
    for (let i = 0; i < schritte; i++) {
      world.step();
      this.settleSleep(1 / 60);
    }
    for (const item of this.items) if (item.body.isDynamic()) item.body.sleep();
    this.syncMeshes();
  }

  /** Teil aus Form-Spec erzeugen (Haufen, Ladung, Save-Restore). */
  spawnScrap(
    materialId: string,
    massKg: number,
    shape: ScrapShape,
    pos: THREE.Vector3,
    rot?: THREE.Quaternion
  ): ScrapItem {
    const material = new THREE.MeshStandardMaterial({
      color: shape.color,
      roughness: materialId === "copper" || materialId === "alu" ? 0.35 : 0.75,
      metalness: NICHTMETALLE.has(materialId) || materialId === "cable" ? 0 : 0.4,
    });
    let geo: THREE.BufferGeometry;
    let collider: RAPIER.ColliderDesc;
    if (shape.kind === "box") {
      const [w, h, d] = shape.dims;
      geo = new THREE.BoxGeometry(w, h, d);
      collider = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
    } else if (shape.kind === "cyl") {
      const [r, len] = shape.dims;
      geo = new THREE.CylinderGeometry(r, r, len, 14);
      if (len > r * 2.5) {
        geo.rotateX(Math.PI / 2); // langes Rohr, liegend
        collider = RAPIER.ColliderDesc.cuboid(r, r, len / 2);
      } else {
        collider = achtkant(r, len / 2); // Felge/Scheibe
      }
    } else if (shape.kind === "torus") {
      const [r, tube] = shape.dims;
      // Kabel wird als mehrfach gewickelter Strang gebaut — ein glatter Ring
      // sah aus wie ein Donut, nicht wie aufgerolltes Kabel.
      geo =
        materialId === "cable"
          ? cableCoilGeometry(r, tube)
          : (() => {
              const g = new THREE.TorusGeometry(r, tube, 8, 16);
              g.rotateX(Math.PI / 2);
              return g;
            })();
      collider = achtkant(r + tube, tube);
    } else {
      // Drahtknäuel: verrauschte Kugel im Wireframe liest sich als Maschendraht
      const [r] = shape.dims;
      geo = new THREE.IcosahedronGeometry(r, 2);
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const n = 0.75 + Math.random() * 0.45;
        pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
      }
      // Kollider aus genau den verbeulten Ecken, die man auch sieht. Als glatte
      // Kugel rollte das Knaeuel endlos weiter (gemessen: 0,44 m/s nach 10 s bei
      // 150 kg) und hielt ueber die gemeinsame Schlafregel den ganzen Haufen
      // wach — dieselbe Ursache wie bei den Zylindern, E-011. Federn darf es
      // weiterhin, die Restitution bleibt.
      collider =
        RAPIER.ColliderDesc.convexHull(pos.array as Float32Array) ??
        RAPIER.ColliderDesc.ball(r * 0.95);
    }
    const isWire = shape.kind === "wire";
    const mesh = new THREE.Mesh(
      geo,
      isWire
        ? new THREE.MeshStandardMaterial({ color: shape.color, roughness: 0.6, metalness: 0.5, wireframe: true })
        : material
    );
    if (isWire) {
      // zweites, kleineres Knäuel innen für Dichte
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(shape.dims[0] * 0.7, 1), mesh.material);
      inner.rotation.set(0.7, 1.3, 0.4);
      mesh.add(inner);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (shape.flat) {
      mesh.scale.y = shape.kind === "wire" ? 0.5 : FLAT_SCALE_Y;
      collider = flatColliderDesc(shape);
    }
    const q = rot ?? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0));
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        // Dämpfung nach Masse: eine feste Bremse für alles nahm schweren
        // Teilen ihr Gewicht — ein Motorblock kam so schnell zur Ruhe wie ein
        // Blech. Leichtes bremst stark, Schweres behält seinen Schwung.
        .setLinearDamping(dampLin(massKg))
        .setAngularDamping(dampAngFuer(shape, massKg))
        // Ohne durchgehende Prüfung schlagen schnelle Teile durch Boden,
        // Bordwände und Bagger hindurch
        .setCcdEnabled(true)
    );
    // Restitution 0: Metall auf Beton springt nicht, es klatscht und liegt
    // Sperrig ineinander: viel Reibung, und bei zwei Teilen zählt der
    // höhere Wert. Schrott rutscht nicht auseinander, er verhakt sich.
    this.world.createCollider(
      collider
        .setMass(massKg)
        .setFriction(2.2)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
        // Nur Drahtknäuel federn — die sind elastisch. Alles andere ist
        // Metall auf Beton: das klatscht und bleibt liegen.
        .setRestitution(shape.kind === "wire" ? 0.55 : 0)
        .setRestitutionCombineRule(
          shape.kind === "wire"
            ? RAPIER.CoefficientCombineRule.Max
            : RAPIER.CoefficientCombineRule.Min
        ),
      body
    );
    return this.register({ materialId, massKg, mesh, body, shape });
  }

  /**
   * Großer Schrottberg zum Spielstart. Liegt auf der Stahlschrottfläche, nicht
   * auf der Annahmefläche — dort müssen die Pritschen abladen können.
   *
   * Die Teile werden überlappungsfrei gesetzt: klemmen sie beim Spawn
   * ineinander, schleudert die Physik sie über den halben Platz.
   */
  spawnPile(pileCenter: THREE.Vector3, count = 150, spread = 4.0): void {
    const placed: Array<{ x: number; y: number; z: number; r: number }> = [];
    const specs = randomCargo(count, 0.45);
    for (const s of specs) {
      // Umkugel, nicht halbe Kantenlaenge: Ein Teil wird zufaellig verdreht
      // gesetzt, also zaehlt der groesste Abstand von der Mitte zur Ecke. Die
      // alte Rechnung (max(dims)/2) war bei jeder Kiste zu klein — bei einem
      // 1,2-m-Blech um 40 % —, deshalb klemmten Teile trotz Pruefung
      // ineinander und der Solver trieb sie auseinander (v2 E-010).
      const r = umkugelRadius(s.shape) + SPAWN_ABSTAND;
      let spot: { x: number; y: number; z: number; r: number } | null = null;
      // Mehr Lagen und Versuche als frueher: seit der Abstand ehrlich gerechnet
      // wird, braucht dieselbe Teilezahl mehr Raum. Mit den alten 14 Lagen
      // blieben 69 von 150 Teilen auf der Strecke.
      for (let layer = 0; layer < 24 && !spot; layer++) {
        const y = 0.5 + layer * 0.62;
        // innen dichter, außen weiter — das ergibt die Kegelform eines Haufens
        const maxRad = spread * (1 - layer * 0.03);
        for (let attempt = 0; attempt < 90; attempt++) {
          const a = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * maxRad;
          const x = pileCenter.x + Math.cos(a) * rad;
          const z = pileCenter.z + Math.sin(a) * rad;
          // echter Abstand: der Faktor 1,2 auf der Hochachse hat den Abstand
          // groesser gerechnet, als er war, und Ueberlappungen durchgelassen
          const clash = placed.some(
            (p) => Math.hypot(p.x - x, p.y - y, p.z - z) < p.r + r
          );
          if (!clash) {
            spot = { x, y, z, r };
            break;
          }
        }
      }
      if (!spot) continue;
      placed.push(spot);
      // zufällig verdreht spawnen: nichts liegt sauber ausgerichtet auf dem Hof
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (Math.random() - 0.5) * 1.6,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 1.6
        )
      );
      this.spawnScrap(
        s.materialId,
        s.massKg,
        s.shape,
        new THREE.Vector3(spot.x, spot.y, spot.z),
        q
      );
    }
  }

  /**
   * Lässt sich das Teil in der Spinne zusammendrücken?
   *
   * Bleche, Kabel, Fässer, Buntmetall und Draht geben nach. Massiver
   * Stahlschrott — Träger und dicke Platten — nicht: den bekommt man nur in
   * der Presse klein.
   */
  isCrushable(item: ScrapItem): boolean {
    if (!item.shape || item.shape.flat) return false;
    if (item.materialId !== "steel") return true;
    // Stahl gibt nur nach, solange er dünn und leicht ist (Blech statt Träger)
    const dims = item.shape.dims;
    const dickste = Math.min(...dims);
    return item.massKg < 140 && dickste < 0.22;
  }

  /**
   * Gepresstes Paket: ein fester Ballen aus mehreren Teilen. Die Kantenlänge
   * wächst mit der Masse, bleibt aber im Rahmen dessen, was ein Container
   * fasst. Die zerknautschte Oberfläche entsteht aus einem verrauschten
   * Quader — glatt sähe es aus wie ein Umzugskarton.
   */
  spawnBale(
    materialId: string,
    massKg: number,
    pos: THREE.Vector3,
    composition?: Array<{ materialId: string; massKg: number }>
  ): ScrapItem {
    // Richtwert: rund 1,2 t je Kubikmeter Paket
    const vol = THREE.MathUtils.clamp(massKg / 1200, 0.12, 1.5);
    const w = Math.cbrt(vol);
    const dims: [number, number, number] = [w * 1.25, w * 0.85, w];
    const geo = new THREE.BoxGeometry(dims[0], dims[1], dims[2], 3, 2, 3);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      // Kraeftiger verbeult als frueher: Ein Paket kommt nicht glatt aus der
      // Kammer, es quillt an den Kanten.
      const n = 0.1 * w;
      p.setXYZ(
        i,
        p.getX(i) + (Math.random() - 0.5) * n,
        p.getY(i) + (Math.random() - 0.5) * n,
        p.getZ(i) + (Math.random() - 0.5) * n
      );
    }
    geo.computeVertexNormals();
    const mat = getMaterial(materialId);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: mat.color, roughness: 0.9, metalness: 0.3 })
    );
    /*
     * Ein Presspaket ist kein sauberes Paket (Wunsch 11.09.2026): Aus den
     * Kanten haengen Blechfetzen, Rohrenden und Kabelschwaenze heraus, und man
     * sieht noch, woraus es gepresst wurde. Die Fransen tragen deshalb die
     * Farben der Zusammensetzung — ein gemischtes Paket ist auch bunt.
     */
    const farben = (composition ?? [{ materialId, massKg }])
      .filter((c) => c.massKg > 0)
      .map((c) => getMaterial(c.materialId).color);
    const fransen = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < fransen; i++) {
      const lang = w * (0.3 + Math.random() * 0.5);
      const duenn = w * (0.03 + Math.random() * 0.06);
      const zipfel = new THREE.Mesh(
        new THREE.BoxGeometry(duenn, duenn * (0.5 + Math.random()), lang),
        new THREE.MeshStandardMaterial({
          color: farben[Math.floor(Math.random() * farben.length)] ?? mat.color,
          roughness: 0.95,
          metalness: 0.25,
        })
      );
      // Aus einer Seitenflaeche heraus, schraeg — nicht ordentlich angesetzt
      const seite = Math.floor(Math.random() * 6);
      const rand = (a: number): number => (Math.random() - 0.5) * a;
      const [hx, hy, hz] = [dims[0] / 2, dims[1] / 2, dims[2] / 2];
      const punkte: Array<[number, number, number]> = [
        [hx, rand(dims[1]), rand(dims[2])],
        [-hx, rand(dims[1]), rand(dims[2])],
        [rand(dims[0]), hy, rand(dims[2])],
        [rand(dims[0]), -hy, rand(dims[2])],
        [rand(dims[0]), rand(dims[1]), hz],
        [rand(dims[0]), rand(dims[1]), -hz],
      ];
      const [px, py, pz] = punkte[seite];
      zipfel.position.set(px * 0.92, py * 0.92, pz * 0.92);
      zipfel.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      zipfel.castShadow = true;
      mesh.add(zipfel);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(dampLin(massKg))
        .setAngularDamping(dampAng(massKg))
        .setCcdEnabled(true)
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(dims[0] / 2, dims[1] / 2, dims[2] / 2)
        .setMass(massKg)
        .setFriction(2.4)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setRestitution(0),
      body
    );
    // `flat` markiert es als gepresst: es geht nicht noch einmal durch die Presse
    return this.register({
      materialId,
      massKg,
      mesh,
      body,
      shape: { kind: "box", dims, color: mat.color, flat: true },
      composition,
    });
  }

  /** Teil in der Presse plattdrücken: Mesh stauchen, Kollider tauschen. */
  flattenItem(item: ScrapItem): boolean {
    if (!item.shape || item.shape.flat) return false;
    item.shape.flat = true;
    // Zusätzlich leicht in die Breite gehen — gequetschtes Metall quillt aus
    item.mesh.scale.y = item.shape.kind === "wire" ? 0.5 : FLAT_SCALE_Y;
    item.mesh.scale.x *= 1.12;
    item.mesh.scale.z *= 1.12;
    while (item.body.numColliders() > 0) {
      this.world.removeCollider(item.body.collider(0), false);
    }
    this.world.createCollider(flatColliderDesc(item.shape).setMass(item.massKg), item.body);
    item.body.wakeUp();
    return true;
  }

  /**
   * Teil entfernen (Verkauf/Despawn).
   * @param destroyBody false, wenn Körper+Mesh schon anderweitig entsorgt wurden (Karosse)
   */
  /**
   * Kleinkram zusammenfassen, wenn zu viele Einzelteile herumliegen.
   *
   * Der Umschlagbetrieb füllt den Platz laufend, und jedes Teil kostet
   * Rechenzeit — bei 400 Körpern wäre auf einem Mittelklasse-Handy Schluss.
   * Statt die Bildrate einbrechen zu lassen, werden die leichtesten Teile
   * eines Haufens zu einem Bündel verschmolzen: gleiche Masse, gleiche
   * Fraktion, ein Körper statt vieler. Große Stücke bleiben unangetastet,
   * die machen den Reiz aus (Design 02.09.2026).
   *
   * @param limit    ab so vielen losen Teilen wird zusammengefasst
   * @param maxKg    nur Teile bis zu dieser Masse
   * @returns wie viele Teile eingespart wurden
   */
  consolidate(limit = 260, maxKg = 45): number {
    const klein = this.items.filter(
      (it) => it.body.isValid() && it.body.isDynamic() && it.massKg <= maxKg && !it.composition
    );
    if (this.items.length <= limit || klein.length < 6) return 0;

    // Nach Fraktion UND Zone gruppieren: Verschmolzen wird nur Gleiches mit
    // Gleichem am selben Ort — sonst ginge Sortenreinheit oder Zuordnung
    // verloren. Auch einsortierte Teile werden zusammengefasst; sie kosten
    // dieselbe Rechenzeit wie lose.
    const nachMaterial = new Map<string, ScrapItem[]>();
    for (const it of klein) {
      const key = `${it.materialId}|${it.containerId ?? "lose"}`;
      const l = nachMaterial.get(key);
      if (l) l.push(it);
      else nachMaterial.set(key, [it]);
    }
    let gespart = 0;
    for (const [key, list] of nachMaterial) {
      if (list.length < 6) continue;
      const materialId = key.split("|")[0];
      // Nur so viele zusammenfassen, wie über dem Limit liegen
      const nehmen = Math.min(list.length, Math.max(6, this.items.length - limit));
      const gruppe = list.slice(0, nehmen);
      const kg = gruppe.reduce((a, it) => a + it.massKg, 0);
      const p = gruppe[0].body.translation();
      const pos = new THREE.Vector3(p.x, p.y + 0.3, p.z);
      for (const it of gruppe) this.remove(it, true);
      this.spawnBale(materialId, kg, pos);
      gespart += gruppe.length - 1;
      if (this.items.length <= limit) break;
    }
    return gespart;
  }

  remove(item: ScrapItem, destroyBody = true): void {
    const idx = this.items.indexOf(item);
    if (idx < 0) return;
    this.items.splice(idx, 1);
    this.byHandle.delete(item.body.handle);
    if (this.highlighted === item) this.highlighted = null;
    if (destroyBody) {
      this.world.removeRigidBody(item.body);
      item.mesh.removeFromParent();
    }
  }

  itemByBody(body: RAPIER.RigidBody): ScrapItem | undefined {
    return this.byHandle.get(body.handle);
  }

  /** Nächstes greifbares Item am Sensor (für Highlight + Griff-Info). */
  findNearest(pos: THREE.Vector3, maxDist: number): ScrapItem | null {
    let best: ScrapItem | null = null;
    let bestD = maxDist;
    for (const item of this.items) {
      const p = item.body.translation();
      const d = Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  /** Highlight (Greif-Hilfe Briefing Kap. 5.3): dezentes Aufhellen des Zielobjekts. */
  setHighlight(item: ScrapItem | null): void {
    if (this.highlighted === item) return;
    if (this.highlighted) setEmissive(this.highlighted.mesh, 0x000000);
    if (item) setEmissive(item.mesh, 0x2a2a1a);
    this.highlighted = item;
  }

  /**
   * Sicherheitsnetz gegen Physik-Explosionen: Klemmt ein Teil (Greifer, Presse,
   * Spawn in einem Kollider), löst Rapier das mit extremem Impuls auf und das
   * Teil verlässt den Platz. Harte Deckelung hält alles im Spiel.
   */
  /**
   * Geschwindigkeiten deckeln. Vorher flogen Teile beim Aufprall der Spinne
   * weit durch die Gegend — schwerer Schrott springt nicht, er rutscht.
   */
  private tempoVorher = new Map<number, number>();
  /** Wann ein Teil zuletzt einen Aufprall gemeldet hat (Sekunden seit Start) */
  private letzterAufprall = new Map<number, number>();
  private aufprallUhr = 0;
  private gesamtVorher = new Map<number, number>();

  /**
   * Aufprall eines Teils (Wunsch 11.09.2026: Kollisionen mit Ladeflaeche,
   * Bordwaenden, Fallenlassen).
   *
   * Erkannt wird an der Vollbremsung: Wer in einem Schritt viel Tempo
   * verliert, ist auf etwas getroffen. Das braucht keine Kontaktereignisse in
   * der Physik — die kosten fuer jedes Teil im Haufen, und gebraucht wird nur
   * der eine Moment.
   *
   * @param wucht Tempoverlust in m/s — daraus macht der Ton die Lautstaerke
   */
  onAufprall: ((item: ScrapItem, wucht: number) => void) | null = null;
  /**
   * Messschalter: Mit `true` gilt die Zuwachsgrenze nicht mehr. Nur fuer den
   * Vorher-Nachher-Vergleich im Labor; im Spiel bleibt sie an.
   */
  zuwachsGrenzeAus = false;

  clampSpeeds(dt = 1 / 60): void {
    this.aufprallUhr += dt;
    for (const item of this.items) {
      if (!item.body.isDynamic()) {
        // Getragene Teile sind kinematisch. Beim Loslassen sollen sie ihren
        // Schwung behalten, also faengt die Zuwachsregel bei ihnen neu an.
        this.tempoVorher.delete(item.body.handle);
        this.gesamtVorher.delete(item.body.handle);
        continue;
      }
      // Trägheit nach Masse: Die Spinne ist ein kinematischer Körper und
      // überträgt beim Anschlagen praktisch beliebig viel Schwung — ohne
      // Grenze fliegt ein Motorblock so weit wie ein Blech. Ein schwerer
      // Brocken darf sich deshalb nur langsam bewegen lassen, ein leichter
      // schneller. Das erzeugt den Widerstand, den Masse haben muss.
      const maxLinear = maxSpeedFor(item.massKg);
      const maxAngular = maxLinear * 1.4;
      const v = item.body.linvel();
      // Zuwachs deckeln: nur was in diesem Schritt dazukommt, nicht der Stand.
      // Frisch losgelassene Teile stehen noch nicht in der Liste — ihr Schwung
      // ist gewollt und geht ungebremst durch.
      const handle = item.body.handle;
      /*
       * Nur QUER deckeln, nie senkrecht.
       *
       * Die erste Fassung bremste den Zuwachs in alle Richtungen — und
       * verhinderte damit genau das, was ein steckengebliebenes Teil rettet:
       * Der Loeser drueckt es mit einem kraeftigen Stoss nach oben aus dem
       * Boden heraus. Gebremst sank es stattdessen weiter ein (Befund
       * 11.09.2026: "Objekte verschwinden im Boden").
       *
       * Weggeschleudert wird ohnehin quer, nicht nach oben — die Bremse trifft
       * also weiterhin den Fall, um den es geht.
       */
      const quer0 = Math.hypot(v.x, v.z);
      const vorher = this.tempoVorher.get(handle);
      if (
        !this.zuwachsGrenzeAus &&
        vorher !== undefined &&
        quer0 > vorher + MAX_ZUWACHS &&
        quer0 > 1e-4
      ) {
        const f = (vorher + MAX_ZUWACHS) / quer0;
        item.body.setLinvel({ x: v.x * f, y: v.y, z: v.z * f }, true);
      }
      // Quer und nach oben wird gedeckelt, nach unten nicht: Fallen ist
      // Schwerkraft und keine Uebertragung aus der Spinne.
      const quer = Math.hypot(v.x, v.z);
      const f = quer > maxLinear ? maxLinear / quer : 1;
      const y = Math.min(Math.max(v.y, -FALL_MAX), maxLinear);
      if (f < 1 || y !== v.y) {
        item.body.setLinvel({ x: v.x * f, y, z: v.z * f }, true);
      }
      const w = item.body.angvel();
      const a = Math.hypot(w.x, w.y, w.z);
      if (a > maxAngular) {
        const f = maxAngular / a;
        item.body.setAngvel({ x: w.x * f, y: w.y * f, z: w.z * f }, true);
      }
      const jetzt = item.body.linvel();
      // Aufprall: In einem Schritt viel Tempo verloren. Der Betrag zaehlt in
      // alle Richtungen — ein Teil faellt senkrecht auf die Ladeflaeche.
      if (this.onAufprall) {
        const vorherGesamt = this.gesamtVorher.get(handle);
        const jetztGesamt = Math.hypot(jetzt.x, jetzt.y, jetzt.z);
        if (vorherGesamt !== undefined) {
          const verlust = vorherGesamt - jetztGesamt;
          const letzte = this.letzterAufprall.get(handle) ?? -9;
          if (verlust > AUFPRALL_DV && this.aufprallUhr - letzte > AUFPRALL_PAUSE_S) {
            this.letzterAufprall.set(handle, this.aufprallUhr);
            this.onAufprall(item, verlust);
          }
        }
        this.gesamtVorher.set(handle, jetztGesamt);
      }
      this.tempoVorher.set(handle, Math.hypot(jetzt.x, jetzt.z));
      // Ausreißer einsammeln: Material geht nie verloren, es landet auf der
      // Annahmefläche. Die Grenzen liegen weit außerhalb der LKW-Route.
      const p = item.body.translation();
      if (
        !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z) ||
        Math.abs(p.x) > 45 || Math.abs(p.z) > 60 || p.y < -5 || p.y > 60
      ) {
        item.body.setTranslation(
          { x: (Math.random() - 0.5) * 4, y: 3 + Math.random() * 2, z: 1 + (Math.random() - 0.5) * 4 },
          true
        );
        item.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        item.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  syncMeshes(): void {
    for (const item of this.items) {
      const p = item.body.translation();
      const r = item.body.rotation();
      item.mesh.position.set(p.x, p.y, p.z);
      item.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}

/** Emissive auf allen Standard-Materialien eines Objekts setzen (Glas auslassen). */
function setEmissive(obj: THREE.Object3D, hex: number): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      if (!o.material.transparent) o.material.emissive.setHex(hex);
    }
  });
}
