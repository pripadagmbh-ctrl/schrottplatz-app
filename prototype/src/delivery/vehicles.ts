import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { randomCargo, type ItemManager, type ScrapItem } from "../world/scrapItems";
import type { CompositeManager, CarComposite } from "../dismantle/composites";
import { GATE_X, WEIGH_Z } from "../world/yard";
import { hitsObstacle } from "../world/obstacles";

/**
 * Anlieferungen M3: Kundenfahrzeuge auf fester Route (kinematisch).
 * - KIPPER: Mulde hebt sich, die Ladung rutscht physisch herunter.
 * - PRITSCHE: parkt — der Spieler lädt selbst mit der Spinne ab; leer → Abfahrt.
 * - TIEFLADER: Pritsche mit Wrack (Auto), Spieler hebt es herunter.
 * Die Ladung liegt als echte Physik-Objekte auf der (kinematischen) Ladefläche
 * und fährt per Reibung mit.
 */

export type DeliveryKind = "kipper" | "pritsche" | "wrack" | "abholer";

/**
 * Fahrspur (SW, Design-Fix 2026-08-29): Die Route läuft ausschließlich über die
 * östliche Spur und endet in einer Sackgasse — sie kreuzt WEDER die Haufen-Zonen
 * (z ≈ 8–12) NOCH den Bagger-Standplatz. Abfahrt erfolgt vorwärts über dieselbe
 * Spur, also weg vom frisch abgekippten Schrott.
 */
// ANLIEFERUNG: Nordspur über die Brückenwaage, dann rückwärts an den
// Abkippplatz vor dem Bagger. Ausfahrt vorwärts wieder über die Waage.
// Einfahrt → Brückenwaage (dort wird brutto gewogen)
const ROUTE_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 24],
];
// Nach dem Wiegen weiter zum Rangierpunkt vor dem Abkippplatz
const ROUTE_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-14, 21],
  [0, 19],
];
const ROUTE_IN_REV: Array<[number, number]> = [
  [0, 19],
  [0, 9.5], // näher an den Abkippplatz — die Blockadeprüfung stoppt bei Bedarf
];
const ROUTE_OUT: Array<[number, number]> = [
  [0, 9.5],
  [0, 19],
  [-14, 21],
  [GATE_X, 24],
  [GATE_X, 40],
];

// ABHOLUNG: Ostspur nach Süden, dann rückwärts an den Verladeplatz neben der
// Presse — dort lädt der Spieler den Container mit sortenreinem Material.
const PICKUP_IN_FWD: Array<[number, number]> = [
  [GATE_X, 40],
  [GATE_X, 24],
];
const PICKUP_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-10, 22],
  [16, 22],
  [16, -9.5],
];
// Rückwärts nach Westen direkt neben die Presse — Heck (Container-Öffnung)
// zeigt zur Schere, der Bagger lädt von dort um (Design-Fix 2026-08-29)
const PICKUP_IN_REV: Array<[number, number]> = [
  [16, -9.5],
  [8.5, -9.5],
];
const PICKUP_OUT: Array<[number, number]> = [
  [8.5, -9.5],
  [16, -9.5],
  [16, 22],
  [GATE_X, 24],
  [GATE_X, 40],
];
// KIPPER: Wer selbst abkippen kann, muss nicht vor dem Bagger halten. Er fährt
// rückwärts an die Nordkante des Stahlschrotthaufens (Mitte bei x −9, z 1) und
// kippt seine Ladung direkt dort ab (Design-Fix 29.08.2026).
const TIP_APPROACH: Array<[number, number]> = [
  [GATE_X, 24],
  [-14, 20],
  [-9, 13],
];
const TIP_IN_REV: Array<[number, number]> = [
  [-9, 13],
  [-9, 7.5],
];
const TIP_OUT: Array<[number, number]> = [
  [-9, 7.5],
  [-9, 13],
  [-14, 20],
  [GATE_X, 24],
  [GATE_X, 40],
];

const SPEED = 3.5; // m/s (SW)
const FIRST_DELAY_S = 12; // (SW)
const NEXT_DELAY_S: [number, number] = [12, 24]; // (SW) — dichter Verkehr
/** Sicherheitsabstand zum Bagger: darunter wartet der Fahrer (Briefing Kap. 13) */
const BLOCK_RADIUS = 5.5;
/** Ab diesem Gewicht gilt ein liegendes Teil als echtes Hindernis (SW) */
const BLOCKING_MASS_KG = 120;
const HONK_AFTER_S = 10;
/** Halbe Innenbreite der Ladefläche (SW) — größer als das breiteste Großteil */
const BED_HALF_W = 1.35;
/**
 * Arbeitszonen, in denen liegender Schrott NICHT als Blockade gilt: Genau
 * dorthin wird abgekippt bzw. verladen — dort muss das Fahrzeug hin.
 * [x, z, radius]
 */
export const WORK_ZONES: Array<[number, number, number]> = [
  [0, 9, 11], // Abkippplatz vor dem Bagger inkl. Halteposition
  [11, -9.5, 9], // Verladeplatz neben der Presse
  [-9, 4, 10], // Stahlschrotthaufen — dorthin kippen die Kipper selbst ab
];
/** Nach so langer Blockade fährt der Fahrer vorsichtig weiter (kein Deadlock) */
const BLOCK_GIVEUP_S = 35;

const TIP_ANGLE = THREE.MathUtils.degToRad(58); // (SW) steil genug für sperrige Großteile

type Phase =
  | "settleCargo"
  | "in"
  | "weighIn"
  | "approach"
  | "shiftPause"
  | "reverseIn"
  | "pauseBeforeUnload"
  | "tipping"
  | "tipHold"
  | "tipBack"
  | "waitUnload"
  | "waitLoad"
  | "nudging"
  | "out";

interface Cargo {
  items: ScrapItem[];
  car: CarComposite | null;
}

/** Ladung fährt während des Transports kinematisch verriegelt mit (kein
 *  Herunterfallen bei Kurven) und wird erst am Abladepunkt freigegeben. */
interface RidingBody {
  body: RAPIER.RigidBody;
  localPos: THREE.Vector3;
  localQuat: THREE.Quaternion;
}

class DeliveryVehicle {
  readonly group = new THREE.Group();
  private bedGroup = new THREE.Group();
  private chassisBody: RAPIER.RigidBody;
  private bedBody: RAPIER.RigidBody;
  private phase: Phase = "settleCargo";
  private routeS = 0;
  private phaseT = 0;
  private tip = 0;
  cargo: Cargo = { items: [], car: null };
  done = false;
  private bedLen: number;
  private riding: RidingBody[] = [];
  private cargoReleased = false;
  private blockedT = 0;
  private honked = false;
  private gaveUpWaiting = false;
  /** Aufklappbare Bordwände (links/rechts) */
  private sideWalls: Array<{
    hinge: THREE.Group;
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    dir: -1 | 1;
  }> = [];
  private sideOpen = 0; // 0 = zu, 1 = ganz aufgeklappt
  private sideOpenTarget = 0;
  private tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null = null;
  /** Bruttogewicht der Anlieferung (Wiegung bei der Einfahrt) */
  bruttoKg = 0;
  private weighedOut = false;
  /** true, sobald der Abhol-LKW abfahrbereit ist (Spieler drückt V) */
  private releaseRequested = false;
  private justDeparted = false;

  /** einmalig true, wenn der Abholer gerade losgefahren ist (→ abrechnen) */
  consumeDeparted(): boolean {
    if (!this.justDeparted) return false;
    this.justDeparted = false;
    return true;
  }

  /**
   * Vom Hof schicken. Geht nur, solange noch nichts abgeladen ist — wer schon
   * gekippt hat, muss auch bezahlt werden.
   */
  /**
   * Ein Stück vorfahren, damit man an Schrott herankommt, der unter dem
   * Fahrzeug liegt. Fährt entlang der Ausfahrtsroute und hält wieder an.
   */
  nudgeForward(meters = 3.5): boolean {
    if (this.phase === "out" || this.phase === "nudging") return false;
    this.nudgeReturn = this.phase;
    this.nudgeTargetS = this.nearestS(this.routeOut) + meters;
    this.routeS = this.nearestS(this.routeOut);
    this.phase = "nudging";
    return true;
  }

  private nudgeReturn: Phase = "waitUnload";
  private nudgeTargetS = 0;

  sendAway(): boolean {
    if (this.cargoReleased || this.phase === "out") return false;
    this.phase = "out";
    this.phaseT = 0;
    // Dort in die Ausfahrt einfädeln, wo der Wagen gerade steht — sonst
    // würde er an den Anfang der Ausfahrtsroute springen.
    this.routeS = this.nearestS(this.routeOut);
    this.sideOpenTarget = 0;
    return true;
  }

  /** Bogenlänge des Routenpunkts, der der aktuellen Position am nächsten liegt. */
  private nearestS(route: Array<[number, number]>): number {
    const px = this.group.position.x;
    const pz = this.group.position.z;
    let best = 0;
    let bestD = Infinity;
    let s = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, az] = route[i];
      const [bx, bz] = route[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      // Projektion des Fahrzeugs auf dieses Segment
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len * len)));
      const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
      if (d < bestD) {
        bestD = d;
        best = s + len * t;
      }
      s += len;
    }
    return best;
  }

  private get isPickup(): boolean {
    return this.kind === "abholer";
  }
  /** Fährt selbst ab: dann geht es direkt auf den Stahlschrotthaufen. */
  private get isSelfTipping(): boolean {
    return this.kind === "kipper";
  }

  /**
   * Sortenreine Ladung, falls der Händler seine Ware schon getrennt hat —
   * in der Praxis kommt Schrott oft vorsortiert an. Für den Spieler heißt
   * das: durchladen statt sortieren.
   */
  readonly sortedMaterial: string | null = DeliveryVehicle.rollSortedMaterial();

  private static rollSortedMaterial(): string | null {
    // gut ein Drittel der Anlieferungen kommt sortenrein
    if (Math.random() > 0.36) return null;
    const r = Math.random();
    if (r < 0.4) return "steel";
    if (r < 0.65) return "alu";
    if (r < 0.82) return "va";
    return r < 0.94 ? "copper" : "cable";
  }
  private get routeIn(): Array<[number, number]> {
    return this.isPickup ? PICKUP_IN_FWD : ROUTE_IN_FWD;
  }
  private get routeApproach(): Array<[number, number]> {
    if (this.isPickup) return PICKUP_APPROACH;
    return this.isSelfTipping ? TIP_APPROACH : ROUTE_APPROACH;
  }
  private get routeRev(): Array<[number, number]> {
    if (this.isPickup) return PICKUP_IN_REV;
    return this.isSelfTipping ? TIP_IN_REV : ROUTE_IN_REV;
  }
  private get routeOut(): Array<[number, number]> {
    if (this.isPickup) return PICKUP_OUT;
    return this.isSelfTipping ? TIP_OUT : ROUTE_OUT;
  }

  constructor(
    readonly kind: DeliveryKind,
    scene: THREE.Scene,
    private world: RAPIER.World,
    /** Ist an (x,z) etwas im Weg (Bagger oder liegender Schrott)? Dann wird gewartet. */
    private getBlocker:
      | ((x: number, z: number, r: number, ignore: Set<number>) => boolean)
      | null = null,
    private onHonk: (() => void) | null = null,
    /** Wiegung bei Einfahrt (brutto) bzw. Ausfahrt (netto = brutto − tara) */
    private onWeighIn: ((kg: number) => void) | null = null,
    private onWeighOut: ((netKg: number) => void) | null = null
  ) {
    this.bedLen = kind === "wrack" ? 5.4 : kind === "kipper" ? 6.0 : 5.4;
    this.buildMeshes();
    scene.add(this.group);
    this.chassisBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    // Oberkante MUSS unter dem Muldenboden (0,99 m) liegen UND das Chassis darf
    // NICHT hinter das Muldenheck ragen — sonst landet abgekippte Ladung auf dem
    // Chassis und fährt mit dem LKW davon
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.1, 0.42, (this.bedLen + 1.6) / 2).setTranslation(0, 0.5, 0.8),
      this.chassisBody
    );
    this.bedBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    // Ladefläche: Boden + Wände. Innenbreite MUSS über dem breitesten Großteil
    // liegen (Blechtafel 1,9 m), sonst klemmt die Ladung und die Physik explodiert.
    const halfW = BED_HALF_W;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, 0.14, this.bedLen / 2).setTranslation(0, -0.08, this.bedLen / 2),
      this.bedBody
    );
    // Abhol-LKW trägt einen hohen Container, damit geladenes Material hält
    const wh = kind === "abholer" ? 1.25 : 0.32;
    // Seitenwände sind eigene bewegliche Körper (siehe buildMeshes) — hier nur
    // die feste Stirnwand und ggf. die Heckklappe
    const walls: Array<[number, number, number, number, number]> = [
      [0, wh, this.bedLen, halfW, 0.05], // vordere Wand (zur Kabine)
    ];
    if (kind !== "kipper") walls.push([0, wh, 0, halfW, 0.05]); // Heckklappe nur bei Pritschen
    for (const [wx, wy, wz, hx, hz] of walls) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, wh, hz).setTranslation(wx, wy, wz),
        this.bedBody
      );
    }
    this.placeAt(this.routeIn, 0);
    // Kinematische Körper SOFORT an den Routenstart setzen. Ohne das stehen sie
    // einen Frame lang im Ursprung — mitten auf der Annahmefläche — und
    // schleudern den dort liegenden Schrott quer über den Platz.
    this.snapBodiesToPose();
  }

  /** Chassis + Ladefläche hart auf die aktuelle Mesh-Pose setzen (kein Interpolieren). */
  private snapBodiesToPose(): void {
    this.group.updateWorldMatrix(true, true);
    const cq = new THREE.Quaternion();
    this.group.getWorldQuaternion(cq);
    this.chassisBody.setTranslation(this.group.position, false);
    this.chassisBody.setRotation({ x: cq.x, y: cq.y, z: cq.z, w: cq.w }, false);
    const bp = new THREE.Vector3();
    const bq = new THREE.Quaternion();
    this.bedGroup.getWorldPosition(bp);
    this.bedGroup.getWorldQuaternion(bq);
    this.bedBody.setTranslation({ x: bp.x, y: bp.y, z: bp.z }, false);
    this.bedBody.setRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w }, false);
  }

  private buildMeshes(): void {
    const paint = new THREE.MeshStandardMaterial({ color: 0x35618f, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8 });
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.7, metalness: 0.4 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, this.bedLen + 1.6), dark);
    chassis.position.set(0, 0.65, 0.8);
    this.group.add(chassis);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 1.5), paint);
    cab.position.set(0, 1.5, this.bedLen / 2 + 0.9);
    cab.castShadow = true;
    this.group.add(cab);
    // Verglasung: Frontscheibe und zwei Seitenfenster
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x9fc4d8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.45,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 0.06), windowMat);
    windshield.position.set(0, 1.72, this.bedLen / 2 + 1.66);
    this.group.add(windshield);
    for (const sx of [-1, 1]) {
      const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 1.0), windowMat);
      sideWin.position.set(sx * 1.06, 1.68, this.bedLen / 2 + 0.85);
      this.group.add(sideWin);
    }
    // Fahrer hinterm Steuer
    const driverSkin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
    const driverShirt = new THREE.MeshStandardMaterial({ color: 0x35506b, roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.28, 4, 10), driverShirt);
    torso.position.set(-0.45, 1.5, this.bedLen / 2 + 0.75);
    this.group.add(torso);
    const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), driverSkin);
    dHead.position.set(-0.45, 1.8, this.bedLen / 2 + 0.75);
    this.group.add(dHead);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.116, 12, 10), driverShirt);
    cap.scale.set(1, 0.6, 1);
    cap.position.set(-0.45, 1.85, this.bedLen / 2 + 0.74);
    this.group.add(cap);
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const z of [this.bedLen / 2 + 1.1, 0.1, -this.bedLen / 2 + 0.8]) {
      for (const x of [-1.0, 1.0]) {
        const w = new THREE.Mesh(wheelGeo, dark);
        w.position.set(x, 0.48, z);
        this.group.add(w);
      }
    }

    // Ladefläche: Ursprung am Heck-Kipp-Gelenk (Boden-Höhe der Fläche)
    const bedW = BED_HALF_W * 2;
    this.bedGroup.position.set(0, 1.05, -this.bedLen / 2); // schließt bündig mit dem Heck ab
    this.group.add(this.bedGroup);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.12, this.bedLen), bedMat);
    floor.position.set(0, 0, this.bedLen / 2);
    floor.castShadow = true;
    this.bedGroup.add(floor);
    const isContainer = this.kind === "abholer";
    const wallH = isContainer ? 2.5 : 0.64;
    const sideMat = isContainer
      ? new THREE.MeshStandardMaterial({ color: 0x2f7a4f, roughness: 0.75, metalness: 0.35 })
      : bedMat;
    // Bordwände links und rechts als aufklappbare Klappen (Scharnier unten
    // außen). Beim Abladen fallen sie zur Seite — der Schrott darf herunter.
    for (const dir of [-1, 1] as const) {
      const hinge = new THREE.Group();
      hinge.position.set(dir * (BED_HALF_W + 0.05), 0.02, this.bedLen / 2);
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallH, this.bedLen), sideMat);
      side.position.y = wallH / 2;
      side.castShadow = true;
      hinge.add(side);
      // Verriegelungsbügel als Detail
      for (const lz of [-this.bedLen * 0.3, this.bedLen * 0.3]) {
        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), bedMat);
        latch.position.set(dir * 0.06, wallH - 0.2, lz);
        hinge.add(latch);
      }
      this.bedGroup.add(hinge);
      const wallBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
      );
      // 12 cm statt 6: dünne Wände liessen die Ladung beim Kippen
      // durchschlagen, als wäre der Wagen Luft
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.12, wallH / 2, this.bedLen / 2),
        wallBody
      );
      this.sideWalls.push({ hinge, mesh: side, body: wallBody, dir });
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallH, 0.08), sideMat);
    front.position.set(0, wallH / 2, this.bedLen);
    this.bedGroup.add(front);
    if (this.kind !== "kipper") {
      // Heckklappe sitzt ganz am hinteren Rand und klappt nach unten weg
      const hinge = new THREE.Group();
      hinge.position.set(0, 0.02, -0.04);
      const rear = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallH, 0.08), sideMat);
      rear.position.y = wallH / 2;
      rear.castShadow = true;
      hinge.add(rear);
      this.bedGroup.add(hinge);
      const rearBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(bedW / 2, wallH / 2, 0.12),
        rearBody
      );
      this.tailGate = { hinge, mesh: rear, body: rearBody };
    }
    if (isContainer) {
      // Sicken auf den Containerwänden
      for (const sx of [-BED_HALF_W - 0.11, BED_HALF_W + 0.11]) {
        for (let z = 0.6; z < this.bedLen; z += 1.0) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallH - 0.2, 0.12), sideMat);
          rib.position.set(sx, wallH / 2, z);
          this.bedGroup.add(rib);
        }
      }
    }
  }

  /**
   * Ladung auf der Fläche platzieren — DYNAMISCH: sie setzt sich in der
   * settleCargo-Phase erst physisch auf die Mulde (löst Überlappungen auf),
   * dann wird sie für die Fahrt verriegelt. Kinematisch spawnen würde beim
   * Freigeben explodieren.
   */
  loadCargo(items: ItemManager, composites: CompositeManager): void {
    this.group.updateWorldMatrix(true, true);
    if (this.isPickup) return; // Abholer kommt leer — der Spieler belädt ihn
    if (this.kind === "wrack") {
      const pos = new THREE.Vector3(0, 0.25, this.bedLen / 2);
      this.bedGroup.localToWorld(pos);
      this.cargo.car = composites.spawnCar(pos);
      const q = new THREE.Quaternion();
      this.group.getWorldQuaternion(q);
      this.cargo.car.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      return;
    }
    // Händler liefern volle Ladungen mit viel Großteil-Anteil (SW)
    // Nicht bis unter die Bordwand vollpacken: zu volle Ladungen quollen beim
    // Kippen über und blieben halb auf der Fläche hängen.
    // Jede vierte Fuhre bringt ein Schwergewicht — Tank, Fahrerhaus,
    // Drehgestell. Dann passt weniger daneben, das ist gewollt.
    const schwer = !this.sortedMaterial && Math.random() < 0.28;
    const count = schwer ? 4 : this.kind === "kipper" ? 13 : 10;
    const specs = randomCargo(
      count,
      0.5,
      schwer ? 0.55 : 0,
      this.sortedMaterial ?? undefined
    );
    const bedQuat = new THREE.Quaternion();
    this.bedGroup.getWorldQuaternion(bedQuat);
    // Überlappungsfrei stapeln: jedes Teil bekommt einen Platz, der von allen
    // bereits gesetzten weit genug entfernt ist — sonst klemmt die Ladung
    // ineinander und die Physik schleudert sie beim Freigeben weg.
    const placed: Array<{ x: number; y: number; z: number; r: number }> = [];
    specs.forEach((s) => {
      const dims = s.shape.dims;
      const halfLen = s.shape.kind === "wire" ? dims[0] : Math.max(...dims) / 2;
      const r = halfLen + 0.12;
      const maxX = Math.max(BED_HALF_W - r, 0.05);
      const minZ = r + 0.15;
      const maxZ = Math.max(this.bedLen - r - 0.15, minZ + 0.05);
      let spot: { x: number; y: number; z: number; r: number } | null = null;
      // Flach stapeln: die Ladung liegt gleich an ihrem Platz, statt aus der
      // Luft auf die Pritsche zu fallen
      for (let layer = 0; layer < 6 && !spot; layer++) {
        const y = 0.3 + layer * 0.45;
        for (let attempt = 0; attempt < 24; attempt++) {
          const x = (Math.random() * 2 - 1) * maxX;
          const z = minZ + Math.random() * (maxZ - minZ);
          const clash = placed.some(
            (p) => Math.hypot(p.x - x, (p.y - y) * 1.6, p.z - z) < p.r + r
          );
          if (!clash) {
            spot = { x, y, z, r };
            break;
          }
        }
      }
      const fin = spot ?? { x: 0, y: 0.45 + placed.length * 0.6, z: this.bedLen / 2, r };
      placed.push(fin);
      const local = new THREE.Vector3(fin.x, fin.y, fin.z);
      this.bedGroup.localToWorld(local);
      const it = items.spawnScrap(s.materialId, s.massKg, s.shape, local, bedQuat);
      // Das Setzen soll niemand sehen: erst wenn die Ladung ruhig liegt,
      // taucht der LKW fertig beladen auf.
      it.mesh.visible = false;
      this.cargo.items.push(it);
    });
  }

  /**
   * Masse, die tatsächlich AUF der Ladefläche liegt — das wiegt die Brückenwaage.
   * Abgekippter Schrott neben dem Fahrzeug darf nicht mitzählen, sonst fiele
   * das Nettogewicht zu niedrig aus.
   */
  cargoMassKg(): number {
    let sum = 0;
    const local = new THREE.Vector3();
    const onBed = (b: RAPIER.RigidBody, extra = 0): boolean => {
      if (!b.isValid()) return false;
      const p = b.translation();
      local.set(p.x, p.y, p.z);
      this.bedGroup.worldToLocal(local);
      return (
        Math.abs(local.x) < BED_HALF_W + 0.5 + extra &&
        local.z > -0.5 - extra &&
        local.z < this.bedLen + 0.5 + extra &&
        local.y > -0.4 &&
        local.y < 5.0 // hoch aufgetürmte Ladung zählt mit
      );
    };
    for (const it of this.cargo.items) {
      if (onBed(it.body)) sum += it.massKg;
    }
    if (this.cargo.car && onBed(this.cargo.car.body, 0.6)) sum += 950;
    return sum;
  }

  /** Chassis + Ladefläche + Bordwände — Hindernisse für den Baggerarm. */
  collectBodyHandles(out: Set<number>): void {
    out.add(this.chassisBody.handle);
    out.add(this.bedBody.handle);
    for (const w of this.sideWalls) out.add(w.body.handle);
  }

  /** Abfahrt des Abhol-LKW freigeben (Taste V). */
  requestRelease(): void {
    this.releaseRequested = true;
  }

  get waitingForLoad(): boolean {
    return this.phase === "waitLoad";
  }

  get phaseName(): string {
    return this.phase;
  }

  /** Teile, die im Container auf der Ladefläche liegen (Abhol-LKW). */
  containedItems(items: ItemManager): ScrapItem[] {
    if (!this.isPickup) return [];
    const local = new THREE.Vector3();
    const out: ScrapItem[] = [];
    for (const it of items.items) {
      if (!it.body.isValid()) continue;
      const p = it.body.translation();
      local.set(p.x, p.y, p.z);
      this.bedGroup.worldToLocal(local);
      if (
        Math.abs(local.x) < BED_HALF_W + 0.25 &&
        local.z > -0.3 &&
        local.z < this.bedLen + 0.3 &&
        local.y > -0.4 &&
        local.y < 2.6
      ) {
        out.push(it);
      }
    }
    return out;
  }

  /** Ladung liegt ruhig? Erst dann wird für die Fahrt verriegelt. */
  private cargoAtRest(): boolean {
    for (const it of this.cargo.items) {
      if (!it.body.isValid()) continue;
      const v = it.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) > 0.9) return false;
    }
    return true;
  }

  /** Nach dem Setzen: alles für die Fahrt an die Mulde koppeln. */
  private lockAllCargo(): void {
    if (this.cargo.car) this.lockToBed(this.cargo.car.body);
    for (const it of this.cargo.items) {
      this.lockToBed(it.body);
      it.mesh.visible = true; // jetzt liegt sie sauber — ab hier sichtbar
    }
  }

  private lockToBed(body: RAPIER.RigidBody): void {
    const p = body.translation();
    const q = body.rotation();
    const worldPos = new THREE.Vector3(p.x, p.y, p.z);
    const localPos = this.bedGroup.worldToLocal(worldPos.clone());
    const bedQuat = new THREE.Quaternion();
    this.bedGroup.getWorldQuaternion(bedQuat);
    const localQuat = bedQuat.clone().invert().multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    this.riding.push({ body, localPos, localQuat });
  }

  /** Ladung physisch freigeben (Kipper: beim Anheben; Pritsche: bei Ankunft). */
  private releaseCargo(): void {
    if (this.cargoReleased) return;
    this.cargoReleased = true;
    for (const r of this.riding) {
      if (r.body.isValid()) r.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    }
    this.riding = [];
  }

  /**
   * true, wenn alle Ladungsteile von der Fläche herunter sind (>4 m vom Fahrzeug).
   * Bereits entfernte Körper (verkauft/gepresst) zählen als abgeladen — ihre
   * translation() abzufragen würde die Physik-Engine zum Absturz bringen.
   */
  private isUnloaded(): boolean {
    const gp = this.group.position;
    const far = (b: RAPIER.RigidBody): boolean => {
      if (!b.isValid()) return true;
      const p = b.translation();
      return Math.hypot(p.x - gp.x, p.z - gp.z) > 4;
    };
    if (this.cargo.car) return far(this.cargo.car.body);
    return this.cargo.items.every((it) => far(it.body));
  }

  private placeAt(route: Array<[number, number]>, s: number, reverse = false): void {
    // Punkt + Richtung entlang der Polylinie bei Bogenlänge s
    let rest = s;
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, az] = route[i];
      const [bx, bz] = route[i + 1];
      const segLen = Math.hypot(bx - ax, bz - az);
      if (rest <= segLen || i === route.length - 2) {
        const t = Math.min(rest / segLen, 1);
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        this.group.position.set(x, 0, z);
        // Kabine (+Z) zeigt in Fahrtrichtung — rückwärts: Heck voran
        this.group.rotation.y = Math.atan2(bx - ax, bz - az) + (reverse ? Math.PI : 0);
        return;
      }
      rest -= segLen;
    }
  }

  private routeLength(route: Array<[number, number]>): number {
    let len = 0;
    for (let i = 0; i < route.length - 1; i++) {
      len += Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]);
    }
    return len;
  }

  /**
   * Steht der Bagger (oder etwas anderes Blockierendes) auf dem nächsten
   * Streckenabschnitt? Dann hält der Fahrer an und hupt — er fährt nie hindurch.
   */
  private isBlocked(route: Array<[number, number]>, aheadS: number, reverse: boolean): boolean {
    if (!this.getBlocker) return false;
    const ax = this.group.position.x;
    const az = this.group.position.z;
    const probe = this.probePoint(route, aheadS, reverse);
    const bx = probe.x;
    const bz = probe.z;
    // Strecke abtasten: Bagger ODER liegender Schrott stoppen den Fahrer.
    // Die eigene (verlorene) Ladung zählt nicht — sonst blockiert sich der
    // Fahrer selbst und käme nie vom Platz.
    const own = new Set<number>();
    for (const it of this.cargo.items) {
      if (it.body.isValid()) own.add(it.body.handle);
    }
    for (let t = 0.3; t <= 1.001; t += 0.235) {
      if (this.getBlocker(ax + (bx - ax) * t, az + (bz - az) * t, BLOCK_RADIUS, own)) return true;
    }
    return false;
  }

  private probeVec = new THREE.Vector3();

  /** Position, die das Fahrzeug bei Bogenlänge s einnehmen würde (ohne zu setzen). */
  private probePoint(route: Array<[number, number]>, s: number, reverse: boolean): THREE.Vector3 {
    const saveP = this.group.position.clone();
    const saveR = this.group.rotation.y;
    this.placeAt(route, s, reverse);
    this.probeVec.copy(this.group.position);
    this.group.position.copy(saveP);
    this.group.rotation.y = saveR;
    return this.probeVec;
  }

  /** Fahrschritt mit Blockade-Prüfung; liefert true, wenn tatsächlich gefahren wurde. */
  private advance(route: Array<[number, number]>, step: number, reverse: boolean, dt: number): boolean {
    // Sicherheitsabstand: 4 m vorausschauen (Heck bzw. Front)
    if (!this.gaveUpWaiting && this.isBlocked(route, this.routeS + 4, reverse)) {
      this.blockedT += dt;
      if (this.blockedT > HONK_AFTER_S && !this.honked) {
        this.honked = true;
        this.onHonk?.();
      }
      // Nach langer Blockade fährt der Fahrer vorsichtig weiter — sonst würde
      // ein liegen gebliebenes Teil das Fahrzeug für immer festsetzen.
      if (this.blockedT > BLOCK_GIVEUP_S) this.gaveUpWaiting = true;
      return false;
    }
    if (!this.gaveUpWaiting) {
      this.blockedT = 0;
      this.honked = false;
    }
    this.routeS += step;
    this.placeAt(route, this.routeS, reverse);
    return true;
  }

  update(dt: number): void {
    this.phaseT += dt;
    switch (this.phase) {
      case "settleCargo":
        // warten, bis sich der Ladungsberg gesetzt hat (max. 4 s)
        if (this.isPickup || (this.phaseT > 1.2 && this.cargoAtRest()) || this.phaseT > 4) {
          this.lockAllCargo();
          this.phase = "in";
          this.phaseT = 0;
        }
        break;
      case "in":
        this.advance(this.routeIn, SPEED * dt, false, dt);
        if (this.routeS >= this.routeLength(this.routeIn)) {
          // Anlieferer stehen jetzt auf der Brückenwaage
          this.phase = this.isPickup ? "approach" : "weighIn";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      case "weighIn":
        // Der Fahrer geht bei Mario ins Wiegehäuschen — das dauert einen Moment
        if (this.phaseT > 6) {
          this.bruttoKg = this.cargoMassKg();
          this.onWeighIn?.(this.bruttoKg);
          this.phase = "approach";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      case "approach": {
        const r = this.routeApproach;
        this.advance(r, SPEED * dt, false, dt);
        if (this.routeS >= this.routeLength(r)) {
          this.phase = "shiftPause";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      }
      case "shiftPause":
        if (this.phaseT > 1) {
          this.phase = "reverseIn";
          this.phaseT = 0;
        }
        break;
      case "reverseIn":
        this.advance(this.routeRev, SPEED * 0.55 * dt, true, dt); // rückwärts langsamer (SW)
        if (this.routeS >= this.routeLength(this.routeRev)) {
          this.phase = "pauseBeforeUnload";
          this.phaseT = 0;
        }
        break;
      case "pauseBeforeUnload":
        // Pritschen klappen die Bordwände auf — der Schrott darf herunter.
        // Kipper braucht das nicht (er kippt), der Container bleibt zu.
        if (this.kind === "pritsche" || this.kind === "wrack") this.sideOpenTarget = 1;
        if (!this.isPickup) this.releaseCargo();
        if (this.phaseT > 1.8) {
          this.phase = this.isPickup ? "waitLoad" : this.kind === "kipper" ? "tipping" : "waitUnload";
          this.phaseT = 0;
          this.routeS = 0;
        }
        break;
      case "nudging": {
        this.advance(this.routeOut, SPEED * 0.45 * dt, false, dt);
        // am Ziel oder am Ende der Route: wieder anhalten und weitermachen
        if (this.routeS >= this.nudgeTargetS || this.routeS >= this.routeLength(this.routeOut)) {
          this.phase = this.nudgeReturn;
          this.phaseT = 0;
        }
        break;
      }
      case "waitLoad":
        // Abhol-LKW wartet, bis der Spieler den Container beladen hat und
        // die Abfahrt freigibt (Taste V) — oder bis die Standzeit abläuft.
        if (this.releaseRequested || this.phaseT > 240) {
          this.justDeparted = true; // Container wird jetzt abgerechnet
          this.phase = "out";
          this.routeS = 0;
        }
        break;
      case "tipping":
        this.tip = Math.min(this.tip + dt / 4.5, 1);
        if (this.tip >= 1) {
          this.phase = "tipHold";
          this.phaseT = 0;
        }
        break;
      case "tipHold":
        if (this.phaseT > 4) {
          this.phase = "tipBack";
        }
        break;
      case "tipBack":
        this.tip = Math.max(this.tip - dt / 1.5, 0);
        if (this.tip <= 0) {
          this.phase = "out";
          this.routeS = 0;
        }
        break;
      case "waitUnload":
        if (this.phaseT > 1 && this.isUnloaded()) {
          this.phase = "out";
          this.routeS = 0;
        }
        break;
      case "out":
        this.sideOpenTarget = 0; // Bordwände zu, bevor es vom Platz geht
        this.advance(this.routeOut, SPEED * dt, false, dt);
        // Ausfahrtswiegung: leer über die Brückenwaage → Netto steht fest
        if (!this.isPickup && !this.weighedOut && this.group.position.z >= WEIGH_Z) {
          this.weighedOut = true;
          const tara = this.cargoMassKg();
          this.onWeighOut?.(Math.max(this.bruttoKg - tara, 0));
        }
        if (this.routeS >= this.routeLength(this.routeOut)) this.done = true;
        break;
    }

    // Kippwinkel: Fläche hebt sich vorn (Kabinenseite), Ladung rutscht hinten ab
    this.bedGroup.rotation.x = -this.tip * TIP_ANGLE;

    // Bordwände auf-/zuklappen
    const openStep = dt / 1.6; // ~1,6 s für den vollen Weg (SW)
    this.sideOpen += THREE.MathUtils.clamp(this.sideOpenTarget - this.sideOpen, -openStep, openStep);
    // Klappen hängen im geöffneten Zustand senkrecht nach unten (90°)
    for (const w of this.sideWalls) {
      w.hinge.rotation.z = -w.dir * this.sideOpen * (Math.PI / 2);
    }
    if (this.tailGate) this.tailGate.hinge.rotation.x = this.sideOpen * (Math.PI / 2);

    // Kinematische Körper nachführen
    this.group.updateWorldMatrix(true, true);
    const cq = new THREE.Quaternion();
    this.group.getWorldQuaternion(cq);
    this.chassisBody.setNextKinematicTranslation(this.group.position);
    this.chassisBody.setNextKinematicRotation({ x: cq.x, y: cq.y, z: cq.z, w: cq.w });
    const bp = new THREE.Vector3();
    const bq = new THREE.Quaternion();
    this.bedGroup.getWorldPosition(bp);
    this.bedGroup.getWorldQuaternion(bq);
    this.bedBody.setNextKinematicTranslation({ x: bp.x, y: bp.y, z: bp.z });
    this.bedBody.setNextKinematicRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w });

    // Bordwand- und Heckklappen-Kollider nachführen
    const flaps = this.tailGate ? [...this.sideWalls, this.tailGate] : this.sideWalls;
    for (const w of flaps) {
      w.mesh.updateWorldMatrix(true, false);
      w.mesh.getWorldPosition(bp);
      w.mesh.getWorldQuaternion(bq);
      w.body.setNextKinematicTranslation({ x: bp.x, y: bp.y, z: bp.z });
      w.body.setNextKinematicRotation({ x: bq.x, y: bq.y, z: bq.z, w: bq.w });
    }

    // mitfahrende Ladung nachführen
    if (this.riding.length > 0) {
      const wp = new THREE.Vector3();
      for (const r of this.riding) {
        if (!r.body.isValid()) continue;
        wp.copy(r.localPos);
        this.bedGroup.localToWorld(wp);
        const wq = bq.clone().multiply(r.localQuat);
        r.body.setNextKinematicTranslation({ x: wp.x, y: wp.y, z: wp.z });
        r.body.setNextKinematicRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w });
      }
    }
  }

  despawn(): void {
    for (const w of this.sideWalls) this.world.removeRigidBody(w.body);
    this.sideWalls = [];
    // Was noch auf der Fläche klemmt, setzt der Fahrer am Abladeplatz ab —
    // sonst führe er Material vom Platz und es wäre für den Spieler weg.
    const [dx, dz] = this.routeRev[this.routeRev.length - 1];
    let k = 0;
    for (const it of this.cargo.items) {
      if (!it.body.isValid()) continue;
      const p = it.body.translation();
      if (Math.hypot(p.x - this.group.position.x, p.z - this.group.position.z) > 6) continue;
      it.body.setTranslation(
        { x: dx - 3.5 + (k % 3) * 1.2, y: 0.6 + Math.floor(k / 3) * 0.5, z: dz + ((k % 2) - 0.5) * 1.6 },
        true
      );
      it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      k++;
    }
    this.group.removeFromParent();
    this.world.removeRigidBody(this.chassisBody);
    this.world.removeRigidBody(this.bedBody);
  }
}

export class VehicleManager {
  private active: DeliveryVehicle | null = null;
  private nextSpawnT = FIRST_DELAY_S;
  private t = 0;
  /** Anlieferungs-Zähler (für Tests/Statistik) */
  deliveries = 0;
  /**
   * Während der Sortierphase macht die Einfahrt zu — es kommt kein Anlieferer
   * mehr, bis der Platz wieder aufgeräumt ist. Abholer ruft der Spieler
   * weiterhin selbst.
   */
  acceptDeliveries = true;

  /** Baggerposition für die Blockade-Prüfung; von main gesetzt. */
  getExcavatorPos: (() => THREE.Vector3) | null = null;
  /** Hupe, wenn etwas zu lange im Weg steht. */
  onHonk: (() => void) | null = null;
  onWeighIn: ((kg: number) => void) | null = null;
  onWeighOut: ((netKg: number) => void) | null = null;
  /** Abhol-LKW fährt los → Containerinhalt abrechnen */
  onPickupDepart: ((truck: DeliveryVehicle) => void) | null = null;

  constructor(
    private scene: THREE.Scene,
    private world: RAPIER.World,
    private items: ItemManager,
    private composites: CompositeManager
  ) {}

  /**
   * Steht an (x,z) etwas im Weg? Der Bagger blockiert, und ebenso am Boden
   * liegender Schrott ab 25 kg — LKW fahren nicht darüber hinweg.
   */
  private blockedAt = (x: number, z: number, r: number, ignore: Set<number>): boolean => {
    // Feste Bauten: Betonlego-Umrandung, Boxen, Schere. Ein LKW fährt da
    // nicht hindurch — die Physik hält ihn nicht auf, er fährt kinematisch.
    if (hitsObstacle(x, z, 1.4)) return true;
    const ex = this.getExcavatorPos?.();
    if (ex && Math.hypot(ex.x - x, ex.z - z) < r) return true;
    // In den Arbeitszonen (Abkipp-/Verladeplatz) darf Schrott liegen — dorthin
    // muss das Fahrzeug ja gerade hin.
    for (const [zx, zz, zr] of WORK_ZONES) {
      if (Math.hypot(zx - x, zz - z) < zr) return false;
    }
    for (const it of this.items.items) {
      // Nur wirklich sperrige Brocken halten einen LKW auf. Vorher blockierte
      // schon jedes 25-kg-Teil, wodurch die Fahrspur nach dem Abkippen fast
      // immer als versperrt galt — kleineres Zeug wird jetzt überrollt.
      if (it.massKg < BLOCKING_MASS_KG || !it.body.isDynamic()) continue;
      if (ignore.has(it.body.handle)) continue; // eigene Ladung
      const p = it.body.translation();
      if (p.y > 1.3) continue; // auf einer Ladefläche, nicht auf dem Fahrweg
      if (Math.hypot(p.x - x, p.z - z) < r * 0.5) return true;
    }
    return false;
  };

  /** Sofort ein Fahrzeug schicken (Tests, Tutorial). */
  spawnNow(kind?: DeliveryKind): void {
    if (this.active) return;
    const k: DeliveryKind =
      kind ?? (["kipper", "pritsche", "wrack"] as DeliveryKind[])[Math.floor(Math.random() * 3)];
    this.active = new DeliveryVehicle(
      k,
      this.scene,
      this.world,
      this.blockedAt,
      () => this.onHonk?.(),
      (kg) => this.onWeighIn?.(kg),
      (kg) => this.onWeighOut?.(kg)
    );
    this.active.loadCargo(this.items, this.composites);
    if (k !== "abholer") this.deliveries++;
  }

  /** Abholung anfordern bzw. wartenden Abhol-LKW abfahren lassen. */
  /**
   * Fraktion, für die der Abholer bestellt wurde (null = gemischte Ladung).
   * Danach richtet sich die Abrechnung: Wer Alu bestellt und Alu lädt,
   * bekommt den vollen Preis.
   */
  pickupOrder: string | null = null;

  requestPickup(order?: string | null): "gerufen" | "abgefahren" | "belegt" {
    if (this.active) {
      if (this.active.kind === "abholer" && this.active.waitingForLoad) {
        this.active.requestRelease();
        return "abgefahren";
      }
      return "belegt";
    }
    this.pickupOrder = order ?? null;
    this.spawnNow("abholer");
    return "gerufen";
  }

  /** Position des Fahrzeugs, solange es auf dem Platz rangiert/ablädt (für den Platzwart). */
  maneuveringTruck(): THREE.Vector3 | null {
    if (!this.active) return null;
    const p = this.active.phaseName;
    if (p === "reverseIn" || p === "shiftPause" || p === "pauseBeforeUnload" || p === "tipping") {
      return this.active.group.position;
    }
    return null;
  }

  /** Der wartende Abhol-LKW (für Beladung/Verkauf), sonst null. */
  get pickupTruck(): DeliveryVehicle | null {
    return this.active && this.active.kind === "abholer" ? this.active : null;
  }

  /**
   * Anlieferer vom Hof schicken — etwa wenn der Wagen offensichtlich leer ist
   * oder man gerade keinen Platz hat. Er dreht ab und fährt zur Ausfahrt.
   */
  sendAway(): "weggeschickt" | "zuSpaet" | "niemandDa" {
    if (!this.active || this.active.kind === "abholer") return "niemandDa";
    return this.active.sendAway() ? "weggeschickt" : "zuSpaet";
  }

  /**
   * „Mach mal Platz": Vor dem Abladen dreht der Fahrer ab, danach fährt er
   * nur ein Stück vor — so kommt man an Schrott heran, der unter dem
   * Fahrzeug liegt.
   */
  makeRoom(): "vorgefahren" | "weggeschickt" | "niemandDa" {
    if (!this.active) return "niemandDa";
    if (this.active.sendAway()) return "weggeschickt";
    return this.active.nudgeForward() ? "vorgefahren" : "niemandDa";
  }

  /** Körper-Handles des aktiven Fahrzeugs — der Baggerarm taucht da nicht ein. */
  obstacleHandles(out: Set<number>): Set<number> {
    out.clear();
    if (this.active) this.active.collectBodyHandles(out);
    return out;
  }

  get activeKind(): DeliveryKind | null {
    return this.active?.kind ?? null;
  }

  /** Fraktion der laufenden Anlieferung, falls sie sortenrein ist. */
  get activeSortedMaterial(): string | null {
    return this.active?.sortedMaterial ?? null;
  }

  update(dt: number): void {
    this.t += dt;
    if (!this.active) {
      if (this.acceptDeliveries && this.t >= this.nextSpawnT) this.spawnNow();
      return;
    }
    this.active.update(dt);
    if (this.active.consumeDeparted()) this.onPickupDepart?.(this.active);
    if (this.active.done) {
      this.active.despawn();
      this.active = null;
      this.t = 0;
      this.nextSpawnT =
        NEXT_DELAY_S[0] + Math.random() * (NEXT_DELAY_S[1] - NEXT_DELAY_S[0]);
    }
  }
}
