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
function cableCoilGeometry(r: number, tube: number): THREE.BufferGeometry {
  const TURNS = 3.6;
  const STEPS = 132;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const a = t * Math.PI * 2 * TURNS;
    // nach außen auslaufende Wicklung, dazu etwas Höhenversatz je Lage
    const rad = r * (0.62 + 0.38 * t) + Math.sin(a * 3) * r * 0.05;
    pts.push(new THREE.Vector3(Math.cos(a) * rad, (t - 0.5) * tube * 1.6, Math.sin(a) * rad));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, STEPS, tube * 0.42, 6, false);
}

/** Kollider für ein plattgedrücktes Teil (flacher Quader über der Grundfläche). */
/**
 * Dämpfung nach Masse. Physikalisch bremst Luftwiderstand leichte Körper
 * viel stärker als schwere; eine feste Bremse für alles ließ 2-Tonnen-Teile
 * so zahm wirken wie Bleche.
 */
export function dampLin(massKg: number): number {
  return Math.min(0.45, Math.max(0.02, 8 / Math.max(massKg, 1)));
}
export function dampAng(massKg: number): number {
  return Math.min(0.9, Math.max(0.05, 16 / Math.max(massKg, 1)));
}

function flatColliderDesc(shape: ScrapShape): RAPIER.ColliderDesc {
  const H = 0.06;
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

const FLAT_SCALE_Y = 0.18;

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
  { materialId: "contaminant", massKg: 14, kind: "box", dims: [0.12, 0.12, 1.2] },
  { materialId: "contaminant", massKg: 8, kind: "box", dims: [0.5, 0.05, 0.9] },
  // Maschendraht-Bündel: sperrig + leicht — eignet sich als „Kehrbesen" zum
  // Freischieben von Pritsche und Boden (Design-Wunsch 2026-08-27)
  { materialId: "steel", massKg: 22, kind: "wire", dims: [0.55] },
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
  { materialId: "contaminant", massKg: 90, kind: "box", dims: [1.4, 0.5, 0.9] }, // Holzkiste
  { materialId: "contaminant", massKg: 130, kind: "box", dims: [1.1, 1.1, 1.1] }, // Betonblock
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
      (r < 0.6 ? "steel" : r < 0.8 ? "alu" : ["va", "copper", "cable", "contaminant"][Math.floor(Math.random() * 4)]);
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

export class ItemManager {
  readonly items: ScrapItem[] = [];
  private byHandle = new Map<number, ScrapItem>();
  private highlighted: ScrapItem | null = null;
  private nextId = 0;

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
      metalness: materialId === "contaminant" || materialId === "cable" ? 0 : 0.4,
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
        collider = RAPIER.ColliderDesc.cylinder(len / 2, r); // Felge/Scheibe
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
      collider = RAPIER.ColliderDesc.cylinder(tube, r + tube);
    } else {
      // Drahtknäuel: verrauschte Kugel im Wireframe liest sich als Maschendraht
      const [r] = shape.dims;
      geo = new THREE.IcosahedronGeometry(r, 2);
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const n = 0.75 + Math.random() * 0.45;
        pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
      }
      collider = RAPIER.ColliderDesc.ball(r * 0.95);
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
      mesh.scale.y = shape.kind === "wire" ? 0.35 : FLAT_SCALE_Y;
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
        .setAngularDamping(dampAng(massKg))
        // Ohne durchgehende Prüfung schlagen schnelle Teile durch Boden,
        // Bordwände und Bagger hindurch
        .setCcdEnabled(true)
    );
    // Restitution 0: Metall auf Beton springt nicht, es klatscht und liegt
    this.world.createCollider(collider.setMass(massKg).setFriction(1.1).setRestitution(0), body);
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
      const dims = s.shape.dims;
      const half = s.shape.kind === "wire" ? dims[0] : Math.max(...dims) / 2;
      // Nur so viel Abstand, dass beim Spawn nichts klemmt. Beim Setzen
      // rutschen und verkanten die Teile dann ineinander — genau so, wie ein
      // gewachsener Schrottberg aussieht.
      const r = half + 0.04;
      let spot: { x: number; y: number; z: number; r: number } | null = null;
      for (let layer = 0; layer < 14 && !spot; layer++) {
        const y = 0.5 + layer * 0.62;
        // innen dichter, außen weiter — das ergibt die Kegelform eines Haufens
        const maxRad = spread * (1 - layer * 0.055);
        for (let attempt = 0; attempt < 40; attempt++) {
          const a = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * maxRad;
          const x = pileCenter.x + Math.cos(a) * rad;
          const z = pileCenter.z + Math.sin(a) * rad;
          const clash = placed.some(
            (p) => Math.hypot(p.x - x, (p.y - y) * 1.2, p.z - z) < p.r + r
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
      const n = 0.055 * w;
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
      new THREE.MeshStandardMaterial({ color: mat.color, roughness: 0.85, metalness: 0.35 })
    );
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
        .setFriction(1.2)
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
    item.mesh.scale.y = item.shape.kind === "wire" ? 0.35 : FLAT_SCALE_Y;
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
  clampSpeeds(maxLinear = 11, maxAngular = 12): void {
    for (const item of this.items) {
      if (!item.body.isDynamic()) continue;
      const v = item.body.linvel();
      const s = Math.hypot(v.x, v.y, v.z);
      if (s > maxLinear) {
        const f = maxLinear / s;
        item.body.setLinvel({ x: v.x * f, y: v.y * f, z: v.z * f }, true);
      }
      const w = item.body.angvel();
      const a = Math.hypot(w.x, w.y, w.z);
      if (a > maxAngular) {
        const f = maxAngular / a;
        item.body.setAngvel({ x: w.x * f, y: w.y * f, z: w.z * f }, true);
      }
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
