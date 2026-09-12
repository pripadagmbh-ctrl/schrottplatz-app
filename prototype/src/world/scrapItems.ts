import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getMaterial } from "../materials/catalog";
import { type Anteil, fraktionAus, istPressbar } from "../materials/purity";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { baueGeometrie, type BauId } from "./objektbau";
import {
  KATALOG_BIG,
  KATALOG_HUGE,
  KATALOG_SPECS,
  type PileSpec,
} from "./objektkatalog";

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
  /**
   * Aus welchen Bauteilen das Ding zusammengesetzt wird (world/objektbau.ts).
   * Ohne Angabe bleibt es der nackte Grundkörper mit Fraktionsfarbe — so
   * bleiben die alten Einträge unverändert.
   */
  bau?: BauId;
  /**
   * Wie das Ding heißt — „Kühlschrank", „Traktor-Hinterachse".
   *
   * Steht hier und nicht nur im Kommentar des Katalogs, weil der Spieler im
   * Greifer lesen soll, was er gefasst hat (Wunsch 12.09.2026). Liegt in der
   * Form und nicht am Teil, damit es ohne Zutun im Spielstand landet.
   */
  name?: string;
  /**
   * Braucht Werkzeug statt roher Gewalt.
   *
   * Manches trennt sich nicht durch Zusammendruecken, sondern nur mit Flex
   * oder Abdrueckmaschine — eine Alufelge etwa gibt man nicht mit der Spinne
   * vom Reifen frei, dabei ginge die Felge kaputt (Ansage 12.09.2026). Solche
   * Stuecke sind Arbeit fuer Lambert, nicht fuer den Bagger.
   */
  nurWerkzeug?: boolean;
  /**
   * Faellt es beim Zerquetschen in seine Bestandteile?
   *
   * Manche Verbundteile trennen sich von selbst, wenn man sie zusammendrueckt
   * (Ansage 12.09.2026): Bei einer Kabeltrommel ist das Holz zerbrochen, bevor
   * das Kabel auch nur nachgibt — danach liegt beides getrennt da. Aus einem
   * Mischschrott-Teil werden so sortenreine, und genau darin liegt der Gewinn.
   */
  trennbar?: boolean;
  /**
   * Sind die Scheiben schon hin?
   *
   * Fehlt der Wert, ist alles heil — so bleiben alte Spielstaende gueltig.
   * Steht er auf true, wird beim Anlegen gar kein Glas mehr gebaut: Ein Wrack,
   * das gestern die Scheiben verloren hat, hat sie heute immer noch nicht.
   */
  glasKaputt?: boolean;
  /**
   * Woraus es besteht, nach Massenanteilen.
   *
   * Ein Objekt aus Verbundteilen ist nie sortenrein (Ansage 12.09.2026): Ein
   * Kühlschrank ist Blech, Alu, Kupfer, Styropor und Kunststoff — das ist
   * Mischschrott, bis jemand es trennt. Eine Baggerschaufel mit Gumminoppen
   * bleibt dagegen Stahlschrott, weil der Gummi nicht ins Gewicht fällt.
   * Wo die Grenze liegt, steht in `SORTENREIN_AB`.
   */
  zusammensetzung?: Anteil[];
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
 * Jetzt gilt zusaetzlich eine harte Obergrenze: WERKZEUG_MAX.
 *
 * Ein geschobenes Teil kann nicht schneller sein als das, was es geschoben
 * hat — bei einem Stoss ohne Federung gibt es nichts, woraus mehr Tempo
 * kommen koennte. Gemessen am 11.09.2026 flog ein 7-kg-Stueck mit 9,33 m/s
 * (33,6 km/h), waehrend die Spitze der Spinne sich mit 3,8 m/s bewegte — das
 * Zweieinhalbfache des Werkzeugs. Der Grund ist kein Fehler in der Physik,
 * sondern die kinematische Spinne: Sie kann beliebig viel Schwung abgeben,
 * und der Loeser schiesst eingeklemmte Stuecke heraus.
 *
 * Die alte Formel gab leichten Teilen ausserdem MEHR Tempo — genau denen,
 * die als Geschosse auffallen. Physikalisch stimmt das fuer einen festen
 * Stoss; hier ist der Stoss aber ein Rechenartefakt, kein Impuls. Darum die
 * Deckelung.
 *
 * Nach unten gilt die Grenze weiterhin gar nicht (siehe FALL_MAX) — dort
 * arbeitet die Schwerkraft.
 */

/**
 * So schnell wird ein Teil hoechstens, wenn die Maschine es anstoesst (m/s).
 *
 * Die Spitze der Spinne laeuft im Schwenk mit 3,8 m/s, die Schalen beim
 * Schliessen mit gut 4. Schneller darf nichts werden, was sie beruehrt.
 */
export const WERKZEUG_MAX = 4.2;
/**
 * Wie eine Fraktion aussieht, wenn sie aus einem Verbundteil faellt.
 *
 * Kein Katalogeintrag, sondern eine Form nach Fraktion: Kabel rollt sich zum
 * Bund, Holz bricht in Latten, Blech bleibt Blech. Die Groesse kommt aus der
 * Masse — bei rund 900 kg je Kubikmeter losem Schrott.
 */
function trennForm(materialId: string, massKg: number, herkunft?: string): ScrapShape {
  const vol = Math.max(massKg / 900, 0.004);
  const w = Math.cbrt(vol);
  const farbe = getMaterial(materialId).color;
  if (materialId === "cable")
    return { kind: "torus", dims: [w * 1.1, w * 0.42], color: farbe, name: "Kabelbund" };
  if (materialId === "tires")
    return { kind: "torus", dims: [w * 1.0, w * 0.38], color: farbe, name: "Reifen" };
  // Was aus einem Rad faellt, ist eine Felge — nicht "Aluminium-Reste".
  if (/felge|rad/i.test(herkunft ?? "") && (materialId === "alu" || materialId === "steel"))
    return {
      kind: "cyl",
      dims: [w * 1.1, w * 0.7],
      color: farbe,
      name: materialId === "alu" ? "Alufelge" : "Stahlfelge",
    };
  if (materialId === "wood")
    return { kind: "box", dims: [w * 0.8, w * 0.7, w * 2.4], color: farbe, name: "Holzbruch" };
  if (materialId === "plastic")
    return { kind: "box", dims: [w * 1.6, w * 0.5, w * 1.4], color: farbe, name: "Kunststoffreste" };
  return {
    kind: "box",
    dims: [w * 1.2, w * 0.8, w * 1.3],
    color: farbe,
    name: `${getMaterial(materialId).name}-Reste`,
  };
}

/**
 * Ab diesem Tempoverlust in einem Schritt zerspringt Glas (m/s).
 *
 * Absichtlich niedrig (Ansage 12.09.2026: „je nach Einwirkung eigentlich
 * immer"). Ein Aufschlag, den man ueberhaupt hoert, reicht — Glas ist das
 * Erste, was auf einem Schrottplatz kaputtgeht, und ein Wrack mit heilen
 * Scheiben sieht falsch aus.
 */
const GLAS_BRUCH_DV = 0.7;

/**
 * Eine Scheibe fuer alle: geteiltes Material, damit nicht jedes Objekt mit
 * Fenstern ein eigenes anlegt.
 */
let glasMaterial: THREE.MeshStandardMaterial | null = null;
function glasStoff(): THREE.MeshStandardMaterial {
  glasMaterial ??= new THREE.MeshStandardMaterial({
    color: 0x9fc2d2,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.42,
  });
  return glasMaterial;
}

/** Was der Katalog zu einem geladenen Teil noch weiss. */
interface KatalogZusatz {
  bau?: BauId;
  name?: string;
  zusammensetzung?: Anteil[];
  trennbar?: boolean;
  nurWerkzeug?: boolean;
}

/** Fraktionen ohne metallischen Glanz — Abfall eben. */
const NICHTMETALLE = new Set(["wood", "tires", "rubble", "plastic"]);

export function maxSpeedFor(massKg: number): number {
  return Math.min(WERKZEUG_MAX, Math.max(1.4, 22 / Math.sqrt(Math.max(massKg, 1))));
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
const MAX_ZUWACHS = 0.35;

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
 * Wie sich eine Fraktion pressen laesst.
 *
 * `dichte` in kg je Kubikmeter Paket — daraus ergibt sich die Groesse bei
 * gegebener Masse. `fransen` ist die Spanne, `lang` und `dick` sind Anteile
 * der Paketkante, `beule` die Unruhe der Oberflaeche.
 */
interface Pressprofil {
  dichte: number;
  fransen: [number, number];
  lang: number;
  dick: number;
  beule: number;
  rauheit: number;
  glanz: number;
}

const PRESSPROFIL: Record<string, Pressprofil> = {
  // Stahl federt zurueck: mittlere Dichte, viele Blechfetzen, kraeftig gebeult
  steel: { dichte: 1250, fransen: [7, 13], lang: 0.45, dick: 0.05, beule: 0.11, rauheit: 0.9, glanz: 0.3 },
  // Mischschrott ist das Unruhigste, was aus der Kammer kommt
  mixed: { dichte: 1050, fransen: [10, 17], lang: 0.55, dick: 0.06, beule: 0.15, rauheit: 0.95, glanz: 0.25 },
  // Edelstahl ist stur: bleibt sperrig, spreizt lange Zipfel ab
  va: { dichte: 1150, fransen: [9, 15], lang: 0.6, dick: 0.04, beule: 0.12, rauheit: 0.55, glanz: 0.7 },
  // Alu geht weich zusammen: dicht, klein, fast glatt
  alu: { dichte: 1450, fransen: [3, 6], lang: 0.3, dick: 0.045, beule: 0.07, rauheit: 0.5, glanz: 0.55 },
  // Kupfer noch dichter — das schwerste Paket bei gleichem Volumen
  copper: { dichte: 1900, fransen: [3, 7], lang: 0.28, dick: 0.05, beule: 0.06, rauheit: 0.45, glanz: 0.65 },
  brass: { dichte: 1800, fransen: [3, 6], lang: 0.26, dick: 0.055, beule: 0.05, rauheit: 0.4, glanz: 0.7 },
  zinc: { dichte: 1450, fransen: [4, 8], lang: 0.34, dick: 0.035, beule: 0.09, rauheit: 0.55, glanz: 0.4 },
  battery: { dichte: 1600, fransen: [2, 4], lang: 0.18, dick: 0.09, beule: 0.03, rauheit: 0.7, glanz: 0.1 },
  // Kabel bleibt ein Knaeuel: locker, ueberall Schwaenze
  cable: { dichte: 800, fransen: [14, 22], lang: 0.75, dick: 0.035, beule: 0.16, rauheit: 0.95, glanz: 0.1 },
  // Nichtmetalle pressen sich schlecht und sehen zerfetzt aus
  wood: { dichte: 620, fransen: [12, 18], lang: 0.6, dick: 0.07, beule: 0.17, rauheit: 1.0, glanz: 0 },
  plastic: { dichte: 540, fransen: [10, 16], lang: 0.5, dick: 0.06, beule: 0.15, rauheit: 0.85, glanz: 0.05 },
  tires: { dichte: 700, fransen: [8, 14], lang: 0.4, dick: 0.09, beule: 0.13, rauheit: 1.0, glanz: 0 },
  rubble: { dichte: 1400, fransen: [6, 11], lang: 0.3, dick: 0.08, beule: 0.14, rauheit: 1.0, glanz: 0 },
};

/**
 * Wie stark ein Teil beim Quetschen zusammengeht. 0,18 hat die Ursprungsform
 * völlig ausgelöscht — aus allem wurde eine Platte. 0,55 verbeult das Stück
 * sichtbar, man erkennt aber noch, was es einmal war.
 */
const FLAT_SCALE_Y = 0.55;


// Basis-Sortiment (SW) — Starthaufen und Zufalls-Ladungen speisen sich hieraus
const SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 60, kind: "box", dims: [0.15, 0.15, 1.3], bau: "buendel", name: "Profilstahl" },
  { materialId: "steel", massKg: 45, kind: "cyl", dims: [0.09, 1.1], bau: "rohrFlansch", name: "Rohr" },
  { materialId: "steel", massKg: 35, kind: "box", dims: [0.12, 0.12, 0.9] },
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.7, 0.06, 0.9], bau: "platte", name: "Blech" },
  { materialId: "steel", massKg: 90, kind: "box", dims: [0.7, 0.5, 0.15], bau: "platte", name: "Heizkörper (früher Guss)" },
  { materialId: "steel", massKg: 110, kind: "box", dims: [0.4, 0.4, 0.4], bau: "motor", name: "Motorblock-Rest", zusammensetzung: [{ materialId: "steel", anteil: 0.82 }, { materialId: "alu", anteil: 0.14 }, { materialId: "copper", anteil: 0.04 }] },
  { materialId: "steel", massKg: 70, kind: "box", dims: [0.18, 0.18, 1.1] },
  { materialId: "va", massKg: 26, kind: "box", dims: [0.9, 0.18, 0.6], bau: "weisseWare", name: "Spülbecken" },
  { materialId: "va", massKg: 34, kind: "cyl", dims: [0.34, 0.8], bau: "tank", name: "VA-Behälter" },
  { materialId: "va", massKg: 18, kind: "box", dims: [0.06, 0.06, 1.5], bau: "buendel", name: "VA-Geländerrohr" },
  { materialId: "alu", massKg: 12, kind: "cyl", dims: [0.32, 0.22], name: "Felge" },
  { materialId: "alu", massKg: 8, kind: "box", dims: [0.08, 0.08, 1.4], name: "Profil" },
  { materialId: "alu", massKg: 10, kind: "box", dims: [0.6, 0.04, 0.8], bau: "platte", name: "Tafel" },
  { materialId: "alu", massKg: 11, kind: "cyl", dims: [0.3, 0.2] },
  { materialId: "copper", massKg: 12, kind: "cyl", dims: [0.05, 0.8], bau: "buendel", name: "Kupferrohr" },
  { materialId: "copper", massKg: 18, kind: "torus", dims: [0.14, 0.05], name: "Kupferbund" },
  { materialId: "brass", massKg: 15, kind: "box", dims: [0.3, 0.25, 0.3], bau: "maschine", name: "Messingarmaturen" },
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
  { materialId: "steel", massKg: 42, kind: "box", dims: [0.55, 0.85, 0.55], bau: "weisseWare", name: "Waschmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "rubble", anteil: 0.18 }, { materialId: "copper", anteil: 0.08 }, { materialId: "plastic", anteil: 0.12 }] },
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.6, 0.85, 0.6], bau: "weisseWare", name: "Spuelmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.6 }, { materialId: "plastic", anteil: 0.28 }, { materialId: "copper", anteil: 0.06 }, { materialId: "alu", anteil: 0.06 }] },
  { materialId: "steel", massKg: 30, kind: "box", dims: [0.65, 0.9, 0.6], bau: "weisseWare", name: "Elektroherd" },
  { materialId: "steel", massKg: 52, kind: "cyl", dims: [0.28, 1.4], bau: "tank", name: "Warmwasserspeicher" },
  { materialId: "steel", massKg: 48, kind: "box", dims: [1.6, 0.55, 0.7], name: "Badewanne" },
  { materialId: "steel", massKg: 26, kind: "box", dims: [0.6, 0.9, 1.9], bau: "kleinfahrzeug", name: "Motorradrahmen" },
  { materialId: "steel", massKg: 14, kind: "box", dims: [0.5, 0.7, 1.6], bau: "kleinfahrzeug", name: "Mopedrahmen" },
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.1, 0.35, 0.9], bau: "schaufel", name: "Pflugschar" },
  { materialId: "steel", massKg: 85, kind: "cyl", dims: [0.34, 1.7], bau: "trommel", name: "Eggenwalze" },
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.5, 0.5, 1.4], bau: "motor", name: "Traktor-Frontgewicht" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [2.1, 0.25, 0.35], bau: "ausleger", name: "Heuwender-Ausleger" },
  { materialId: "steel", massKg: 210, kind: "cyl", dims: [0.16, 2.2], bau: "achse", name: "LKW-Achse" },
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.8, 0.7, 0.9], bau: "motor", name: "LKW-Getriebe" },
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.9, 0.75, 0.12], bau: "maschine", name: "LKW-Kuehler" },
  { materialId: "steel", massKg: 46, kind: "cyl", dims: [0.28, 0.32], name: "LKW-Felge" },
  { materialId: "alu", massKg: 16, kind: "box", dims: [0.7, 0.5, 0.15], bau: "motor", name: "Motorradmotor" },
  { materialId: "copper", massKg: 22, kind: "box", dims: [0.45, 0.4, 0.35], bau: "elektromotor", name: "Elektromotor", trennbar: true, zusammensetzung: [{ materialId: "steel", anteil: 0.58 }, { materialId: "copper", anteil: 0.38 }, { materialId: "alu", anteil: 0.04 }] },
  { materialId: "tires", massKg: 11, kind: "torus", dims: [0.31, 0.11], name: "Traktorreifen" },

  // Erweiterung 12.09.2026 — siehe world/objektkatalog.ts
  ...KATALOG_SPECS,
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
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 1.1, 1.9], bau: "achse", name: "Waggon-Drehgestell" },
  { materialId: "steel", massKg: 2200, kind: "box", dims: [3.2, 0.9, 0.8], bau: "fahrgestell", name: "Kettenlaufwerk" },
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.1, 3.6], bau: "tank", name: "Kesselwagen-Segment" },
  { materialId: "steel", massKg: 1400, kind: "cyl", dims: [1.2, 3.1], bau: "tank", name: "Lagertank" },
  { materialId: "steel", massKg: 1100, kind: "cyl", dims: [0.9, 2.0], bau: "tank", name: "Turbinengehäuse" },
  { materialId: "steel", massKg: 900, kind: "box", dims: [2.2, 1.9, 1.8], bau: "karosserie", name: "LKW-Fahrerhaus" },
  { materialId: "steel", massKg: 1600, kind: "box", dims: [2.8, 1.2, 1.1], bau: "motor", name: "Pressenrahmen" },
  { materialId: "va", massKg: 950, kind: "cyl", dims: [1.0, 2.8], bau: "tank", name: "VA-Prozesstank" },
  { materialId: "va", massKg: 700, kind: "box", dims: [2.6, 0.9, 1.2], bau: "tank", name: "VA-Behälter" },
  { materialId: "alu", massKg: 700, kind: "box", dims: [3.5, 0.35, 1.6], bau: "platte", name: "Tragflächenstück" },
  { materialId: "alu", massKg: 800, kind: "cyl", dims: [1.3, 3.0], bau: "rohrFlansch", name: "Rumpfsegment" },
  { materialId: "alu", massKg: 550, kind: "box", dims: [2.9, 1.1, 0.9], bau: "container", name: "Aufbau/Kofferaufbau" },

  // Erweiterung 12.09.2026 — siehe world/objektkatalog.ts
  ...KATALOG_HUGE,
];

const BIG_SPECS: PileSpec[] = [
  { materialId: "steel", massKg: 180, kind: "box", dims: [0.28, 0.28, 2.9], bau: "traeger", name: "Doppel-T-Träger" },
  { materialId: "steel", massKg: 220, kind: "box", dims: [1.9, 0.08, 1.5], bau: "platte", name: "Blechtafel" },
  { materialId: "steel", massKg: 160, kind: "cyl", dims: [0.22, 2.6], bau: "rohrFlansch", name: "dickes Rohr" },
  { materialId: "steel", massKg: 140, kind: "box", dims: [1.2, 0.9, 0.75], bau: "tank", name: "Kessel" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.75, 1.5, 0.7], bau: "weisseWare", name: "Waschmaschine", zusammensetzung: [{ materialId: "steel", anteil: 0.62 }, { materialId: "rubble", anteil: 0.18 }, { materialId: "copper", anteil: 0.08 }, { materialId: "plastic", anteil: 0.12 }] },
  { materialId: "steel", massKg: 420, kind: "box", dims: [0.9, 0.7, 0.95], bau: "motor", name: "Maschinenblock" },
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.6, 0.9], bau: "trommel", name: "Schwungrad" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.1, 0.8], bau: "moebel", name: "Stahlschrank" },
  { materialId: "steel", massKg: 195, kind: "box", dims: [2.4, 0.9, 0.12], bau: "platte", name: "Stahltür/Tor" },
  { materialId: "steel", massKg: 240, kind: "cyl", dims: [0.75, 1.9], bau: "tank", name: "Öltank/Boiler" },
  { materialId: "steel", massKg: 150, kind: "wire", dims: [1.15], bau: "haufen", name: "Drahtballen" },
  { materialId: "va", massKg: 210, kind: "cyl", dims: [0.7, 1.8], bau: "tank", name: "VA-Tank" },
  { materialId: "va", massKg: 130, kind: "box", dims: [1.8, 0.1, 1.1], bau: "platte", name: "VA-Tafel" },
  { materialId: "va", massKg: 95, kind: "box", dims: [1.2, 0.85, 0.7], bau: "moebel", name: "Gastro-Spültisch" },
  { materialId: "va", massKg: 70, kind: "box", dims: [0.14, 0.14, 2.6], bau: "buendel", name: "VA-Rohrbündel" },
  { materialId: "alu", massKg: 60, kind: "box", dims: [0.3, 0.3, 2.8], bau: "buendel", name: "Profilbündel" },
  { materialId: "alu", massKg: 45, kind: "box", dims: [1.6, 0.06, 1.2], bau: "platte", name: "Alutafel" },
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.4, 1.2, 0.25], bau: "fensterflaeche", name: "Alu-Fensterrahmen" },
  { materialId: "alu", massKg: 110, kind: "cyl", dims: [0.55, 1.4], bau: "tank", name: "Alu-Kessel" },
  { materialId: "copper", massKg: 65, kind: "cyl", dims: [0.35, 1.2], bau: "tank", name: "Kupfer-Boiler" },
  { materialId: "copper", massKg: 48, kind: "torus", dims: [0.45, 0.16], bau: "buendel", name: "Kupferrohr-Bund" },
  { materialId: "cable", massKg: 55, kind: "torus", dims: [0.55, 0.22], name: "Kabelbund" },
  { materialId: "cable", massKg: 120, kind: "cyl", dims: [0.85, 0.9], bau: "trommel", name: "Kabeltrommel", trennbar: true, zusammensetzung: [{ materialId: "cable", anteil: 0.62 }, { materialId: "wood", anteil: 0.38 }] },
  { materialId: "wood", massKg: 90, kind: "box", dims: [1.4, 0.5, 0.9], bau: "moebel", name: "Holzkiste" },
  { materialId: "rubble", massKg: 130, kind: "box", dims: [1.1, 1.1, 1.1], bau: "beton", name: "Betonblock" },

  // Erweiterung 12.09.2026 — siehe world/objektkatalog.ts
  ...KATALOG_BIG,
];

/*
 * Auch die drei urspruenglichen Listen bekommen ihre Fraktion aus der
 * Zusammensetzung. Sonst stuende die Kabeltrommel als "cable" im Katalog und
 * waere zugleich Mischschrott — die Ableitung lief zuerst nur ueber den neuen
 * Katalog (Befund 12.09.2026).
 */
for (const liste of [SPECS, BIG_SPECS, HUGE_SPECS]) {
  for (const sp of liste) {
    if (sp.zusammensetzung) sp.materialId = fraktionAus(sp.zusammensetzung, sp.materialId);
  }
}

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
    /*
     * Fraktionsmix der Anlieferungen.
     *
     * "mixed" musste dazu (Befund 12.09.2026): Seit ein Objekt aus
     * Verbundteilen als Mischschrott gilt — Kuehlschrank, Karosserie, Kabine,
     * Wohnwagen —, haengen daran neunundvierzig Eintraege. Ohne die Fraktion
     * in dieser Liste wurde keiner davon je gezogen, und sie waren mit einem
     * Schlag aus dem Spiel.
     *
     * 42 % Stahl, 22 % Mischschrott, 16 % Alu, der Rest verteilt sich.
     */
    const r = Math.random();
    const wanted =
      onlyMaterial ??
      (r < 0.42
        ? "steel"
        : r < 0.64
          ? "mixed"
          : r < 0.8
            ? "alu"
            : ["va", "copper", "brass", "zinc", "battery", "cable", "wood", "plastic", "rubble"][
                Math.floor(Math.random() * 9)
              ]);
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
      shape: {
        kind: spec.kind,
        dims: spec.dims,
        color: colorFor(spec, i),
        bau: spec.bau,
        name: spec.name,
        zusammensetzung: spec.zusammensetzung,
        trennbar: spec.trennbar,
        nurWerkzeug: spec.nurWerkzeug,
      },
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
  /**
   * Den Platz setzen lassen, bevor das erste Bild kommt.
   *
   * Der erste Durchgang allein genuegte nicht. Gemessen am 12.09.2026 hing
   * nach dem Setzen ein 75-kg-Stueck in **7,01 m Hoehe** und fiel 6,66 m,
   * sobald es geweckt wurde. Der Grund steckt in der gemeinsamen Schlafregel:
   * Wird eine Gruppe als ruhig eingestuft, schlaeft auch ein Stueck ein, das
   * noch faellt — und wer in der Luft einschlaeft, bleibt in der Luft, bis
   * ihn zufaellig etwas weckt. Im Spiel sah das aus, als fiele Schrott vom
   * Himmel.
   *
   * Darum wird nach dem Setzen noch einmal alles geweckt und weitergerechnet,
   * bis nichts mehr faellt. Wer wirklich liegt, schlaeft sofort wieder ein;
   * wer in der Luft hing, faellt jetzt. Das kostet nur Ladezeit, keine
   * Bildzeit.
   */
  settle(world: RAPIER.World, schritte = 240): void {
    const runde = (n: number) => {
      for (let i = 0; i < n; i++) {
        world.step();
        this.settleSleep(1 / 60);
      }
    };
    runde(schritte);
    for (let durchgang = 0; durchgang < 4; durchgang++) {
      let geweckt = 0;
      for (const item of this.items) {
        if (item.body.isDynamic() && item.body.isSleeping()) {
          item.body.wakeUp();
          geweckt++;
        }
      }
      if (geweckt === 0) break;
      runde(90);
      // Faellt noch etwas nennenswert? Dann noch eine Runde.
      let faellt = 0;
      for (const item of this.items) {
        if (!item.body.isDynamic()) continue;
        const v = item.body.linvel();
        if (Math.abs(v.y) > 0.25) faellt++;
      }
      if (faellt === 0) break;
    }
    for (const item of this.items) if (item.body.isDynamic()) item.body.sleep();
    this.syncMeshes();
  }

  /** Teil aus Form-Spec erzeugen (Haufen, Ladung, Save-Restore). */
  /**
   * Bau aus dem Katalog nachtragen.
   *
   * Ein Spielstand speichert die Form eines Teils, wie sie beim Anlegen war —
   * und aeltere Staende kennen das Feld `bau` noch nicht. Ohne diesen Nachtrag
   * blieben auf jedem vorhandenen Platz alle Teile Quader, egal wie viele
   * Bauten es gibt (Befund 12.09.2026: "ich seh sie nicht auf dem iPad").
   *
   * Gesucht wird ueber Fraktion, Masse, Form und Masse — genau die vier Werte,
   * mit denen das Teil einmal aus dem Katalog gezogen wurde. Findet sich nichts,
   * bleibt es der Grundkoerper; falsch wird dadurch nichts.
   */
  private static katalogKarte: Map<string, KatalogZusatz> | null = null;

  private static katalogFuer(
    materialId: string,
    massKg: number,
    shape: ScrapShape
  ): KatalogZusatz | undefined {
    if (!ItemManager.katalogKarte) {
      const karte = new Map<string, KatalogZusatz>();
      for (const liste of [SPECS, BIG_SPECS, HUGE_SPECS]) {
        for (const sp of liste) {
          if (!sp.bau && !sp.name) continue;
          karte.set(`${sp.materialId}|${sp.massKg}|${sp.kind}|${sp.dims.join(",")}`, {
            bau: sp.bau,
            name: sp.name,
            zusammensetzung: sp.zusammensetzung,
            trennbar: sp.trennbar,
            nurWerkzeug: sp.nurWerkzeug,
          });
        }
      }
      ItemManager.katalogKarte = karte;
    }
    return ItemManager.katalogKarte.get(
      `${materialId}|${massKg}|${shape.kind}|${shape.dims.join(",")}`
    );
  }

  spawnScrap(
    materialId: string,
    massKg: number,
    shape: ScrapShape,
    pos: THREE.Vector3,
    rot?: THREE.Quaternion
  ): ScrapItem {
    /*
     * Bei einem Bau steckt die Farbe in den Eckpunkten, nicht im Material —
     * darum Grundfarbe weiss und `vertexColors`. Nur so bleibt ein Objekt aus
     * zwoelf Bauteilen ein einziger Zeichenruf mit einem einzigen Material.
     */
    // Aus einem alten Spielstand geladen? Dann fehlt alles, was der Katalog
    // seither dazubekommen hat — nachtragen.
    if (!shape.bau || !shape.name || !shape.zusammensetzung) {
      const k = ItemManager.katalogFuer(materialId, massKg, shape);
      if (k) {
        shape = {
          ...shape,
          bau: shape.bau ?? k.bau,
          name: shape.name ?? k.name,
          zusammensetzung: shape.zusammensetzung ?? k.zusammensetzung,
          trennbar: shape.trennbar ?? k.trennbar,
          nurWerkzeug: shape.nurWerkzeug ?? k.nurWerkzeug,
        };
      }
    }
    const material = new THREE.MeshStandardMaterial({
      color: shape.bau ? 0xffffff : shape.color,
      vertexColors: !!shape.bau,
      roughness:
        materialId === "copper" || materialId === "brass" || materialId === "alu" ? 0.35 : 0.75,
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
    /*
     * Der Bau ersetzt nur das Aussehen. Der Kollider bleibt der Grundkoerper
     * aus dem Katalog — Physik und Aussehen sind getrennt, und das Aussehen
     * darf darum beliebig fein werden, ohne dass die Physik teurer wird.
     */
    let glasGeo: THREE.BufferGeometry | null = null;
    if (shape.bau) {
      geo.dispose();
      const bauteil = baueGeometrie(shape.bau, shape.dims, shape.kind);
      geo = bauteil.koerper;
      glasGeo = bauteil.glas;
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
    /*
     * Scheiben haengen als eigenes Kind am Teil — nicht verschmolzen, sonst
     * liessen sie sich nie entfernen. Das kostet einen zweiten Zeichenruf,
     * aber nur bei Objekten, die ueberhaupt Fenster haben.
     */
    if (glasGeo) {
      if (shape.glasKaputt) {
        glasGeo.dispose();
      } else {
        const scheibe = new THREE.Mesh(glasGeo, glasStoff());
        scheibe.name = "glas";
        mesh.add(scheibe);
      }
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
    /*
     * Die Zusammensetzung wandert als absolute Massen ans Teil. Sie stand
     * bisher nur im Katalog, und damit wusste ein Kuehlschrott-Teil im Spiel
     * nicht, woraus es besteht — die Presse rechnete die Reinheit eines
     * Pakets aus lauter Einzelstuecken, als waere jedes sortenrein.
     */
    const composition = shape.zusammensetzung
      ? shape.zusammensetzung.map((a) => ({ materialId: a.materialId, massKg: a.anteil * massKg }))
      : undefined;
    return this.register({ materialId, massKg, mesh, body, shape, composition });
  }

  /**
   * Großer Schrottberg zum Spielstart. Liegt auf der Stahlschrottfläche, nicht
   * auf der Annahmefläche — dort müssen die Pritschen abladen können.
   *
   * Die Teile werden überlappungsfrei gesetzt: klemmen sie beim Spawn
   * ineinander, schleudert die Physik sie über den halben Platz.
   */
  /*
   * `spread` ist der Radius, ueber den der Haufen verteilt wird. Er stand auf
   * 4,0 m. Mit dem erweiterten Sortiment sind die Stuecke im Mittel sperriger,
   * und bei gleicher Flaeche fand ein Fuenftel keinen Platz mehr. Die
   * Stahlschrottflaeche misst 11 x 12 m — fuer 5,2 m Radius ist also Platz.
   *
   * `count` stand auf 150. Die Stuecke aus dem Objektkatalog haben realistische
   * Massen, und damit wog der Starthaufen ploetzlich 17,6 t — ueber der
   * Stauschwelle von 16 t. Der Platz waere mit geschlossener Einfahrt
   * gestartet, und nicht einmal der Tutorial-Kunde waere hereingekommen.
   * Weniger Stuecke, dafuer schwerere: Das Gesamtgewicht bleibt, wo die
   * Wirtschaft es erwartet, ohne dass an ihr gedreht wird.
   */
  spawnPile(pileCenter: THREE.Vector3, count = 85, spread = 5.2): void {
    const placed: Array<{ x: number; y: number; z: number; r: number }> = [];
    /*
     * Anteil Grossteile im Starthaufen.
     *
     * Stand auf 0,45. Seit der Objektkatalog dazugekommen ist, enthaelt
     * BIG_SPECS auch Baggerausleger, Schuttmulden und Kipperbruecken — Stuecke
     * von ueber drei Metern. Mit 45 Prozent davon fand fast die Haelfte der
     * Teile keinen Platz mehr (gemessen: 64 statt ueber 90 von 150), und der
     * Haufen sah aus wie ein Maschinenfriedhof statt wie ein Schrotthaufen.
     * Grossteile kommen jetzt vor allem mit den Anlieferungen; im Starthaufen
     * liegen ein paar davon, nicht die Haelfte.
     */
    const specs = randomCargo(count, 0.12);
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
  /**
   * Laesst sich das Ding zusammendruecken — in der Spinne wie in der Presse?
   *
   * Die Regel steht in materials/purity.ts und rechnet mit Dichte und Dicke:
   * Was hohl ist, geht zusammen; was massiv ist, bleibt (Ansage 12.09.2026:
   * "starre und massive Traeger sollten von der Presse unberuehrt bleiben").
   */
  /** Faellt das Ding beim Zusammendruecken auseinander? */
  istTrennbar(item: ScrapItem): boolean {
    return (
      !!item.shape?.trennbar &&
      !item.shape?.nurWerkzeug &&
      (item.composition?.length ?? 0) >= 2
    );
  }

  /** Trennbar, aber nur mit Werkzeug — Arbeit fuer den Platzwart. */
  brauchtWerkzeug(item: ScrapItem): boolean {
    return !!item.shape?.trennbar && !!item.shape?.nurWerkzeug;
  }

  isCrushable(item: ScrapItem): boolean {
    if (!item.shape || item.shape.flat) return false;
    return istPressbar(item.massKg, item.shape.dims);
  }

  /**
   * Gepresstes Paket: ein fester Ballen aus mehreren Teilen. Die Kantenlänge
   * wächst mit der Masse, bleibt aber im Rahmen dessen, was ein Container
   * fasst. Die zerknautschte Oberfläche entsteht aus einem verrauschten
   * Quader — glatt sähe es aus wie ein Umzugskarton.
   */
  /**
   * Presspaket.
   *
   * Ein Paket ist kein Quader von der Stange (Wunsch 12.09.2026): „Je Material
   * und Stauchung sollten die farblich anders fransen, aussehen und
   * unterschiedlich gross sein." Drei Dinge richten sich deshalb nach dem, was
   * hineingegangen ist:
   *
   * - **Dichte** — Alu und Kupfer lassen sich weich zusammenschieben und
   *   ergeben ein dichtes, kleines Paket. Stahl federt zurueck, VA ist stur,
   *   Kabel bleibt ein Knaeuel. Bei gleicher Masse kommt darum ein sehr
   *   unterschiedlich grosser Wuerfel heraus.
   * - **Fransen** — wie viele, wie lang, wie duenn. Ein Kabelpaket haengt
   *   ueberall voll Schwaenze, ein Alupaket ist fast glatt.
   * - **Farbe** — nicht die dominante Fraktion, sondern Flecken aus allem, was
   *   drin ist, gewichtet nach Masse. Ein gemischtes Paket ist auch bunt.
   *
   * Dazu eine Toleranz von rund einem Zehntel auf Groesse und Seitenverhaeltnis:
   * Zwei Pakete aus derselben Fuhre sehen nie gleich aus.
   *
   * Alles wird zu **einer** Geometrie verschmolzen, die Farben stecken in den
   * Eckpunkten. Ein Paket mit vierzehn Fransen kostet damit einen Zeichenruf
   * statt fuenfzehn.
   */
  spawnBale(
    materialId: string,
    massKg: number,
    pos: THREE.Vector3,
    composition?: Array<{ materialId: string; massKg: number }>
  ): ScrapItem {
    const profil = PRESSPROFIL[materialId] ?? PRESSPROFIL.steel;
    const streu = (a: number): number => (Math.random() - 0.5) * 2 * a;

    /*
     * Groesse aus Dichte und Masse, mit Toleranz.
     *
     * Die Toleranz war zuerst zu breit: plus/minus zwoelf Prozent auf jede
     * Kante ergeben zusammen einen Faktor zwei aufs Volumen — damit kam ein
     * Alupaket groesser heraus als ein Stahlpaket, obwohl Alu dichter presst
     * (gemessen 12.09.2026: 0,86 gegen 0,54 Kubikmeter bei je 900 kg). Die
     * Streuung soll zwei Pakete derselben Fuhre unterscheiden, nicht die
     * Materialien vertauschen. Jetzt rund plus/minus fuenfzehn Prozent aufs
     * Volumen, waehrend die Dichten von 540 bis 1900 reichen.
     */
    const vol = THREE.MathUtils.clamp(massKg / (profil.dichte * (1 + streu(0.05))), 0.1, 1.8);
    const w = Math.cbrt(vol);
    const dims: [number, number, number] = [
      w * (1.25 + streu(0.06)),
      w * (0.85 + streu(0.06)),
      w * (1.0 + streu(0.05)),
    ];

    // Farbanteile nach Masse — daraus werden die Flecken und die Fransen
    const anteile = (composition ?? [{ materialId, massKg }]).filter((c) => c.massKg > 0);
    const summe = anteile.reduce((a, c) => a + c.massKg, 0) || 1;
    const paletteFarben = anteile.map((c) => getMaterial(c.materialId).color);
    const paletteAnteil = anteile.map((c) => c.massKg / summe);
    const waehleFarbe = (r: number): number => {
      let acc = 0;
      for (let i = 0; i < paletteFarben.length; i++) {
        acc += paletteAnteil[i];
        if (r <= acc) return paletteFarben[i];
      }
      return paletteFarben[paletteFarben.length - 1] ?? getMaterial(materialId).color;
    };

    const stuecke: THREE.BufferGeometry[] = [];
    const farbeHilf = new THREE.Color();
    const faerbe = (geo: THREE.BufferGeometry, waehler: (i: number) => number): void => {
      const p2 = geo.getAttribute("position");
      const c = new Float32Array(p2.count * 3);
      for (let i = 0; i < p2.count; i++) {
        farbeHilf.set(waehler(i));
        c[i * 3] = farbeHilf.r;
        c[i * 3 + 1] = farbeHilf.g;
        c[i * 3 + 2] = farbeHilf.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
      geo.deleteAttribute("uv1");
      stuecke.push(geo);
    };

    // Koerper: gebeult, und die Beule ist materialabhaengig
    const geo = new THREE.BoxGeometry(dims[0], dims[1], dims[2], 4, 3, 4);
    const p = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const n = profil.beule * w;
      p.setXYZ(i, p.getX(i) + streu(n), p.getY(i) + streu(n), p.getZ(i) + streu(n));
    }
    geo.computeVertexNormals();
    // Flecken: benachbarte Eckpunkte bekommen dieselbe Farbe, sonst flimmert es
    faerbe(geo, (i) => {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = Math.abs(Math.sin(x * 12.1 + y * 7.3 + z * 9.7) * 43758.5);
      return waehleFarbe(k - Math.floor(k));
    });

    // Fransen: Zahl, Laenge und Dicke nach Profil
    const fransen = profil.fransen[0] + Math.floor(Math.random() * (profil.fransen[1] - profil.fransen[0] + 1));
    const [hx, hy, hz] = [dims[0] / 2, dims[1] / 2, dims[2] / 2];
    const rand = (a: number): number => (Math.random() - 0.5) * a;
    for (let i = 0; i < fransen; i++) {
      const lang = w * profil.lang * (0.6 + Math.random() * 0.8);
      const duenn = w * profil.dick * (0.6 + Math.random() * 0.9);
      const zipfel = new THREE.BoxGeometry(duenn, duenn * (0.5 + Math.random()), lang);
      zipfel.rotateX(Math.random() * Math.PI);
      zipfel.rotateY(Math.random() * Math.PI);
      zipfel.rotateZ(Math.random() * Math.PI);
      const punkte: Array<[number, number, number]> = [
        [hx, rand(dims[1]), rand(dims[2])],
        [-hx, rand(dims[1]), rand(dims[2])],
        [rand(dims[0]), hy, rand(dims[2])],
        [rand(dims[0]), -hy, rand(dims[2])],
        [rand(dims[0]), rand(dims[1]), hz],
        [rand(dims[0]), rand(dims[1]), -hz],
      ];
      const [px, py, pz] = punkte[Math.floor(Math.random() * 6)];
      zipfel.translate(px * 0.92, py * 0.92, pz * 0.92);
      const farbe = waehleFarbe(Math.random());
      faerbe(zipfel, () => farbe);
    }

    const gesamt = mergeGeometries(stuecke, false) ?? geo;
    gesamt.computeVertexNormals();
    for (const g2 of stuecke) if (g2 !== gesamt) g2.dispose();

    const mat = getMaterial(materialId);
    const mesh = new THREE.Mesh(
      gesamt,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: profil.rauheit,
        metalness: profil.glanz,
      })
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
    // Was in die Presse geht, hat danach keine Scheiben mehr.
    this.zerbrichGlas(item);
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
  /** Eine Scheibe ist zersprungen — Ort fuer Klang und Splitter. */
  onGlasBruch: ((x: number, y: number, z: number) => void) | null = null;

  /**
   * Ein Verbundteil in seine Fraktionen zerlegen.
   *
   * Das Stueck verschwindet und an seiner Stelle liegen so viele neue, wie es
   * Bestandteile hatte — jedes sortenrein und darum mehr wert. Anteile unter
   * fuenf Prozent fallen unter den Tisch: Ein Gramm Kupfer als eigenes Teil
   * herumliegen zu lassen, hilft niemandem.
   */
  zerlege(item: ScrapItem): ScrapItem[] | null {
    const shape = item.shape;
    if (!shape?.trennbar || !item.composition || item.composition.length < 2) return null;
    const p = item.body.translation();
    const summe = item.composition.reduce((a, c) => a + c.massKg, 0);
    if (summe <= 0) return null;
    const grosse = item.composition.filter((c) => c.massKg / summe >= 0.05);
    if (grosse.length < 2) return null;
    /*
     * Die Reste werden auf die verbleibenden Fraktionen verteilt, nicht
     * weggeworfen: Sonst verschwaende beim Zerlegen stillschweigend Masse —
     * beim Elektromotor waeren das die vier Prozent Alu. Was zu klein fuer ein
     * eigenes Stueck ist, bleibt eben am groesseren haengen.
     */
    const rest = grosse.reduce((a, c) => a + c.massKg, 0);
    const teile: Array<{ materialId: string; massKg: number }> = grosse.map((c) => ({
      materialId: c.materialId,
      massKg: (c.massKg / rest) * item.massKg,
    }));

    this.remove(item);
    const neu: ScrapItem[] = [];
    teile.forEach((c, i) => {
      const winkel = (i / teile.length) * Math.PI * 2;
      const ort = new THREE.Vector3(
        p.x + Math.cos(winkel) * 0.45,
        p.y + 0.25,
        p.z + Math.sin(winkel) * 0.45
      );
      neu.push(
        this.spawnScrap(c.materialId, c.massKg, trennForm(c.materialId, c.massKg, shape.name), ort)
      );
    });
    return neu;
  }

  /**
   * Scheiben zerspringen lassen. Gibt true zurueck, wenn tatsaechlich etwas
   * kaputtgegangen ist — sonst wuerde bei jedem Anstossen ein Klirren kommen,
   * auch beim zwanzigsten Mal am selben Wrack.
   */
  zerbrichGlas(item: ScrapItem): boolean {
    if (!item.shape || item.shape.glasKaputt) return false;
    const scheibe = item.mesh.getObjectByName("glas") as THREE.Mesh | undefined;
    if (!scheibe) return false;
    const ort = new THREE.Vector3();
    scheibe.getWorldPosition(ort);
    scheibe.removeFromParent();
    scheibe.geometry.dispose();
    item.shape.glasKaputt = true;
    this.onGlasBruch?.(ort.x, ort.y, ort.z);
    return true;
  }
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
      /*
       * Nach oben noch enger als quer. Ein geschobenes Teil rutscht und
       * kippt; es huepft nicht auf. Die Aufwaertsspitzen kamen fast alle aus
       * dem Loeser, nicht aus dem Spiel — zusammen mit dem Querwert ergaben
       * zwei volle Grenzen die gemessenen 9,33 m/s.
       */
      const y = Math.min(Math.max(v.y, -FALL_MAX), maxLinear * 0.55);
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
          // Glas ist empfindlicher als das Ohr: Es bricht schon darunter.
          if (verlust > GLAS_BRUCH_DV) this.zerbrichGlas(item);
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
