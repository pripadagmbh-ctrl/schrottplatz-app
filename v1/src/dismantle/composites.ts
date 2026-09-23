import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CAR_DEF, type CarDef, type PartDef } from "./carDef";
import type { ItemManager } from "../world/scrapItems";
import type { EventBus } from "../core/events";
import { AUTOLACK, lackton, verwittert } from "../world/objektbau";
import { farbstoff, verschmelzeBunt, type Bauteil } from "../excavator/bauteile";

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
export function baueAnbauteile(gruppe: THREE.Group, def: CarDef, lack: number): THREE.Mesh {
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
  for (const rad of def.parts) {
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


export class CarComposite {
  readonly body: RAPIER.RigidBody;
  readonly group = new THREE.Group();
  private crushGroup = new THREE.Group();
  private collider: RAPIER.Collider;
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
  /** Blech-Meshes, die sich am Aufprallpunkt verbeulen (Vertex-Verformung) */
  private dentables: { mesh: THREE.Mesh; base: Float32Array }[] = [];

  constructor(
    private def: CarDef,
    private scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private bus: EventBus,
    pos: THREE.Vector3
  ) {
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
    this.collider = this.makeCollider(0);
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

  private makeCollider(stage: number): RAPIER.Collider {
    const [hx, hy, hz] = this.def.colliderHalf;
    const s = this.def.crushScales[stage];
    return this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy * s, hz)
        .setTranslation(0, this.def.colliderYOffset * s, 0)
        .setMass(this.currentMassKg),
      this.body
    );
  }

  private buildMeshes(lack: number): void {
    /*
     * DER LACK KOMMT VOM STANDORT, NICHT AUS EINER KONSTANTEN (17.09.2026).
     *
     * Hier stand 0x8c2f24 — jedes Wrack auf dem Platz war derselbe rote
     * Kasten. `wrackLack` zieht einen der sechzehn Autolacke aus
     * `objektbau.AUTOLACK` und lässt ihn verwittern.
     *
     * Rauheit 0,74 statt 0,50 und Metallglanz 0,12 statt 0,30: Ein Lack, der
     * zehn Jahre auf dem Hof steht, glänzt nicht mehr. Der alte Wert war für
     * einen Neuwagen gewählt und ließ jedes Wrack wie frisch poliert aussehen.
     */
    const paint = new THREE.MeshStandardMaterial({
      color: lack,
      roughness: 0.74, // SW, siehe oben
      metalness: 0.12, // SW, siehe oben
      flatShading: true,
    });
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

    // Quetschbare Teile (Chassis, Kabine, Scheiben) — Ursprung an der Unterkante.
    // Unterteilte Geometrie, damit Aufprall-Beulen (dent) greifen können.
    // Die MASSE stehen in `CarDef.karosserie` (E-111), die UNTERTEILUNG bleibt
    // hier: 4x2x9 und 4x2x5 sind keine Karosseriemaße, sondern die Auflösung,
    // auf der `dent()` beult — die haengt am Rechenbudget, nicht am Modell.
    this.group.add(this.crushGroup);
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
    for (const m of [chassis, cabin]) {
      const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
      this.dentables.push({ mesh: m, base: new Float32Array(pos.array as Float32Array) });
    }
    for (const w of this.def.windows) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(w.size[0], w.size[1], 0.03), glassMat);
      pane.position.set(...w.anchor);
      pane.rotation.y = w.rotY;
      this.crushGroup.add(pane);
      this.windows.push({ id: w.id, mesh: pane, anchor: new THREE.Vector3(...w.anchor), intact: true });
    }

    baueAnbauteile(this.crushGroup, this.def, lack);

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
      const attr = d.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const lx = contact.x - d.mesh.position.x;
      const ly = contact.y - d.mesh.position.y;
      const lz = contact.z - d.mesh.position.z;
      let touched = false;
      for (let i = 0; i < attr.count; i++) {
        const vx = attr.getX(i);
        const vy = attr.getY(i);
        const vz = attr.getZ(i);
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
        attr.setXYZ(i, nx, ny, nz);
        touched = true;
      }
      if (touched) attr.needsUpdate = true; // flatShading → keine Normalen-Neuberechnung nötig
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
    this.world.removeCollider(this.collider, true);
    this.collider = this.makeCollider(this.crushStage);
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
    this.collider.setMass(this.currentMassKg);
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
      this.world.removeCollider(this.collider, true);
      this.collider = this.makeCollider(s.crushStage);
    } else {
      this.collider.setMass(this.currentMassKg);
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
    const car = new CarComposite(CAR_DEF, this.scene, this.world, this.items, this.bus, pos);
    this.cars.push(car);
    return car;
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
