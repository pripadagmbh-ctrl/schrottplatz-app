import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { randomCargo, type ItemManager, type ScrapItem } from "../world/scrapItems";
import type { CompositeManager, CarComposite } from "../dismantle/composites";
import { WEIGH_Z, KAFFEE_THEKE } from "../world/yard";
import { buildPerson, type PersonParts } from "../world/people";

/** So lange haelt ein beladener Abholer auf der Waage fuer Marios Kontrolle. */
const WIEGE_HALT_S = 6;
/** Rueckwaertstempo beim Einparken (m/s) — Schrittgeschwindigkeit. */
const PARK_RUECK_SPEED = 1.6;
/** Gehtempo des Fahrers (m/s) */
const FAHRER_TEMPO = 1.5;
import { hitsObstacle } from "../world/obstacles";
import { rollCustomer, vehicleForCustomer, type CustomerProfile } from "./customers";
import { buildVehicleModel } from "./vehicleModel";

/**
 * Anlieferungen M3: Kundenfahrzeuge auf fester Route (kinematisch).
 * - KIPPER: Mulde hebt sich, die Ladung rutscht physisch herunter.
 * - PRITSCHE: parkt — der Spieler lädt selbst mit der Spinne ab; leer → Abfahrt.
 * - TIEFLADER: Pritsche mit Wrack (Auto), Spieler hebt es herunter.
 * Die Ladung liegt als echte Physik-Objekte auf der (kinematischen) Ladefläche
 * und fährt per Reibung mit.
 */

export type DeliveryKind = "kipper" | "pritsche" | "wrack" | "abholer" | "pkw";

import {
  ROUTE_IN_FWD,
  ROUTE_APPROACH,
  ROUTE_IN_REV,
  ROUTE_OUT,
  PICKUP_IN_FWD,
  PICKUP_APPROACH,
  PICKUP_IN_REV,
  PICKUP_OUT,
  TIP_APPROACH,
  TIP_IN_REV,
  TIP_OUT,
  PARK_SLOTS,
  PARK_ANFAHRT_M,
  PARK_TIME_S,
  SPEED,
  FIRST_DELAY_S,
  NEXT_DELAY_S,
  BLOCK_RADIUS,
  BLOCKING_MASS_KG,
  HONK_AFTER_S,
  BED_HALF_W,
  WORK_ZONES,
  BLOCK_GIVEUP_S,
  TIP_ANGLE,
  TIP_CREEP_M,
  TIP_CREEP_SPEED,
  CRANE_SWING,
} from "./routes";

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
  | "tipCreep"
  | "tipBack"
  | "waitUnload"
  | "waitLoad"
  | "nudging"
  | "toPark"
  | "parkRueck"
  | "parked"
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
  /** Anhänger des PKW — eigener Körper, Gelenk an der Kupplung */
  private trailer: THREE.Group | null = null;
  private trailerYawRel = 0;
  private letztePos = new THREE.Vector3();
  private letzterYaw = 0;
  /** Ladekran der Händler — nur Bild, schwenkt beim Andocken zur Seite */
  private crane: THREE.Group | null = null;
  private craneSide = 1;
  private craneSwing = 0;
  /** Restweg des gekippten Anziehens (Phase tipCreep) */
  private creepLeft = 0;
  /** true, solange die Mulde waehrend der Abfahrt noch heruntergefahren wird */
  private senken = false;
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
  /** Restzeit des Kontrollhalts auf der Waage (nur Abholer) */
  private wiegeHaltS = 0;
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

  /**
   * Abladeplatz räumen. Wer einen Warteplatz zugewiesen bekommen hat, stellt
   * sich dort ab und macht Pause; alle anderen fahren gleich vom Hof.
   */
  /**
   * Anhänger nachführen. Ein Anhänger hat keinen eigenen Willen: Er dreht sich
   * um seine Achse in die Richtung, in die die Kupplung ihn zieht. Das ist die
   * übliche Einspur-Kinematik — je Meter Fahrweg dreht er um sin(Knickwinkel)
   * geteilt durch den Abstand Kupplung–Achse.
   *
   * Rückwärts gilt sie nicht: Dort ist die Gleichung instabil, der Anhänger
   * knickt ein. Ein Fahrer hält beim Rangieren dagegen, und genau das tut hier
   * die Rückstellung — sonst stünde der Anhänger nach dem Andocken quer.
   */
  private updateTrailer(dt: number): void {
    if (!this.trailer || dt <= 0) return;
    const p = this.group.position;
    const psi = this.group.rotation.y;
    const dx = p.x - this.letztePos.x;
    const dz = p.z - this.letztePos.z;
    const strecke = Math.hypot(dx, dz);
    const vorwaerts = Math.sin(psi) * dx + Math.cos(psi) * dz;
    let dpsi = psi - this.letzterYaw;
    while (dpsi > Math.PI) dpsi -= Math.PI * 2;
    while (dpsi < -Math.PI) dpsi += Math.PI * 2;
    this.letztePos.copy(p);
    this.letzterYaw = psi;

    const L = this.bedLen / 2 + 1.05; // Kupplung bis Anhängerachse
    if (strecke > 1e-5 && vorwaerts > 0) {
      this.trailerYawRel += -Math.sin(this.trailerYawRel) * (strecke / L) - dpsi;
    } else {
      this.trailerYawRel += (0 - this.trailerYawRel) * Math.min(1, dt * 2.5);
    }
    // Ein Anhänger knickt irgendwann an der Deichsel an — weiter geht es nicht
    this.trailerYawRel = THREE.MathUtils.clamp(this.trailerYawRel, -0.75, 0.75);
    this.trailer.rotation.y = this.trailerYawRel;
  }

  /**
   * Aussteigen und zum Kaffeewagen hinuebergehen (Wunsch 11.09.2026).
   *
   * Der Fahrer klettert an der Fahrerseite heraus, geht zur Theke, steht dort
   * mit seinem Becher und kommt zurueck, bevor die Pause endet. Erst wenn er
   * wieder im Haus ist, faehrt der LKW los — ein LKW faehrt nicht ohne Fahrer.
   */
  private steigeAus(): void {
    if (!this.fahrer) {
      this.fahrer = buildPerson({ shirt: 0x3c4f63, trousers: 0x2b2f33, hair: 0x4a3a2e });
      this.scene.add(this.fahrer.group);
      // Becher in der Hand
      const becher = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8e2d5, roughness: 0.6 })
      );
      becher.position.set(0.2, 1.02, 0.18);
      this.fahrer.group.add(becher);
    }
    // Fahrerseite: links neben der Kabine, in Fahrtrichtung gesehen
    const seite = new THREE.Vector3(-1.9, 0, 1.6).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.group.rotation.y
    );
    this.fahrerTuer.set(
      this.group.position.x + seite.x,
      0,
      this.group.position.z + seite.z
    );
    // Platz an der Theke, leicht versetzt, damit sich zwei nicht überlagern
    this.fahrerTheke.set(
      KAFFEE_THEKE.x + (Math.random() - 0.5) * 2.4,
      0,
      KAFFEE_THEKE.z - Math.random() * 0.8
    );
    this.fahrer.group.position.copy(this.fahrerTuer);
    this.fahrer.group.visible = true;
    this.fahrerState = "raus";
    this.kaffeeGehabt = true;
  }

  /** Ein Schritt des Fahrers; ausserhalb der Pause ist nichts zu tun. */
  private updateFahrer(dt: number): void {
    const f = this.fahrer;
    if (!f || this.fahrerState === "drin") return;
    const ziel = this.fahrerState === "rein" ? this.fahrerTuer : this.fahrerTheke;
    const g = f.group;
    const dx = ziel.x - g.position.x;
    const dz = ziel.z - g.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.3 && this.fahrerState !== "kaffee") {
      const schritt = Math.min(FAHRER_TEMPO * dt, d);
      g.position.x += (dx / d) * schritt;
      g.position.z += (dz / d) * schritt;
      g.rotation.y = Math.atan2(dx, dz);
      this.fahrerPhase += dt * 7;
      const swing = Math.sin(this.fahrerPhase) * 0.45;
      f.legLeft.rotation.x = swing;
      f.legRight.rotation.x = -swing;
      f.armLeft.rotation.x = -swing * 0.5;
      return;
    }
    f.legLeft.rotation.x = 0;
    f.legRight.rotation.x = 0;
    if (this.fahrerState === "raus") {
      this.fahrerState = "kaffee";
      // zur Theke schauen und den Becher heben
      const zx = KAFFEE_THEKE.x - g.position.x;
      const zz = KAFFEE_THEKE.z + 1.2 - g.position.z;
      g.rotation.y = Math.atan2(zx, zz);
      f.armRight.rotation.x = -1.35;
    } else if (this.fahrerState === "rein") {
      this.fahrerState = "drin";
      f.armRight.rotation.x = 0;
      g.visible = false;
    }
  }

  private leaveUnloadingBay(): void {
    this.phaseT = 0;
    if (this.parkSpot) {
      this.phase = "toPark";
    } else {
      this.phase = "out";
      this.routeS = 0;
    }
  }

  /** true, solange über den Preis verhandelt wird — der Fahrer wartet dann. */
  awaitingDeal = false;
  /** Wird gerufen, wenn die Verhandlung in die Zeitgrenze läuft. */
  onDealTimeout: (() => void) | null = null;
  /** Bruttowiegung erledigt; verhindert, dass sie sich wiederholt */
  private weighedIn = false;

  /**
   * Der Fahrer. Er entsteht erst, wenn er gebraucht wird — also beim ersten
   * Halt auf dem Warteplatz. Fuer die meisten Fuhren gibt es ihn nie.
   */
  private fahrer: PersonParts | null = null;
  private fahrerState: "drin" | "raus" | "kaffee" | "rein" = "drin";
  private fahrerPhase = 0;
  /** Pause schon gemacht? Sonst steigt er endlos wieder aus. */
  private kaffeeGehabt = false;
  private readonly fahrerTuer = new THREE.Vector3();
  private readonly fahrerTheke = new THREE.Vector3();

  /** Zugewiesener Warteplatz, null = fährt direkt vom Hof. */
  parkSpot: [number, number] | null = null;
  /** Wie lange die Pause dauert */
  parkSeconds = 60;

  /** Steht das Fahrzeug auf dem Warteplatz und macht Pause? */
  get isParked(): boolean {
    return this.phase === "parked" || this.phase === "toPark" || this.phase === "parkRueck";
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
   * Wer da anliefert. Bestimmt Menge, Material, Störstoffanteil und den Ton
   * an der Waage. Abholer haben kein Profil — die kommen leer.
   */
  readonly customer: CustomerProfile | null;

  /** Sortenreine Ladung? Ergibt sich aus der Kundschaft. */
  get sortedMaterial(): string | null {
    return this.customer?.sortedMaterial ?? null;
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
    private scene: THREE.Scene,
    private world: RAPIER.World,
    /** Ist an (x,z) etwas im Weg (Bagger oder liegender Schrott)? Dann wird gewartet. */
    private getBlocker:
      | ((x: number, z: number, r: number, ignore: Set<number>) => boolean)
      | null = null,
    private onHonk: (() => void) | null = null,
    /** Wiegung bei Einfahrt (brutto) bzw. Ausfahrt (netto = brutto − tara) */
    private onWeighIn: ((kg: number) => void) | null = null,
    private onWeighOut: ((netKg: number) => void) | null = null,
    customer: CustomerProfile | null = null
  ) {
    this.customer = kind === "abholer" ? null : (customer ?? rollCustomer());
    // Der PKW-Anhänger ist kurz — ein Kofferraum voll, keine Fuhre
    this.bedLen = kind === "pkw" ? 2.4 : kind === "wrack" ? 5.4 : kind === "kipper" ? 6.0 : 5.4;
    const teile = buildVehicleModel({
      kind: this.kind,
      bedLen: this.bedLen,
      // Schrotthändler fahren ihren eigenen Ladekran mit — Gewerbe und
      // Privatleute nicht. Der Kran laedt nichts ab, er gehoert zum Bild.
      withCrane:
        this.customer?.group === "haendler" &&
        (this.kind === "kipper" || this.kind === "pritsche"),
      // Haendler fahren nicht alle denselben Wagen: mal flache Bordwaende, mal
      // der klassische Rungenaufbau, mal ein geschlossener Kasten. Gewerbe und
      // Privat bleiben flach — sie liefern kein Schuettgut.
      bodyStyle:
        this.customer?.group === "haendler"
          ? (["rungen", "rungen", "koffer", "flach"] as const)[Math.floor(Math.random() * 4)]
          : "flach",
      group: this.group,
      bedGroup: this.bedGroup,
      world: this.world,
      sideWalls: this.sideWalls,
      tailGate: null,
    });
    this.tailGate = teile.tailGate;
    this.crane = teile.crane;
    this.trailer = teile.trailer;
    // Zu welcher Seite geschwenkt wird, entscheidet das Fahrzeug einmal —
    // sonst schwenken alle gleich und es sieht nach Choreografie aus.
    this.craneSide = Math.random() < 0.5 ? -1 : 1;
    scene.add(this.group);
    this.chassisBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    // Oberkante MUSS unter dem Muldenboden (0,99 m) liegen UND das Chassis darf
    // NICHT hinter das Muldenheck ragen — sonst landet abgekippte Ladung auf dem
    // Chassis und fährt mit dem LKW davon
    if (kind === "pkw") {
      // Nur das Zugfahrzeug haengt am starren Rahmen. Der LKW-Kollider entfaellt
      // hier: Er deckte die Anhaengerflaeche ab, und die schwenkt jetzt am
      // Gelenk weg — ein starrer Kasten darueber waere schlicht falsch. Der
      // Anhaenger ist ueber die Ladeflaechen-Koerper vorhanden, die dem Gelenk
      // folgen.
      const zugZ = this.bedLen + 1.05 + 0.35 + 2.15;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.95, 0.8, 2.3).setTranslation(0, 0.9, zugZ),
        this.chassisBody
      );
    } else {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(1.1, 0.42, (this.bedLen + 1.6) / 2).setTranslation(0, 0.5, 0.8),
        this.chassisBody
      );
    }
    this.bedBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)
    );
    // Ladefläche: Boden + Wände. Innenbreite MUSS über dem breitesten Großteil
    // liegen (Blechtafel 1,9 m), sonst klemmt die Ladung und die Physik explodiert.
    const halfW = BED_HALF_W;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfW, 0.3, this.bedLen / 2).setTranslation(0, -0.26, this.bedLen / 2),
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

  /**
   * Privatleute kommen nicht mit dem LKW, sondern mit dem eigenen Wagen und
   * einem Anhänger — oder mit einem Kastenwagen. Das macht sie auf den ersten
   * Blick von Gewerbe und Händlern unterscheidbar (Wunsch 02.09.2026).
   */

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
    // Menge nach Kundschaft: der Privatmann bringt einen Kofferraum voll,
    // der Händler eine ganze Fuhre.
    const c = this.customer;
    const klein = c?.group === "privat";
    // Jede vierte große Fuhre bringt ein Schwergewicht — Tank, Fahrerhaus,
    // Drehgestell. Dann passt weniger daneben, das ist gewollt.
    const schwer = !klein && !this.sortedMaterial && Math.random() < 0.28;
    const count = schwer ? 4 : klein ? 5 : this.kind === "kipper" ? 13 : 10;
    const specs = randomCargo(
      count,
      0.5,
      schwer ? 0.55 : 0,
      this.sortedMaterial ?? undefined
    );
    // Ladung auf die Liefermenge des Kunden bringen. Auf eine Ladefläche
    // passen nur begrenzt Stücke, also werden sie schwerer statt zahlreicher
    // — ein Händler bringt eben Brocken, kein Kleinzeug. Der Faktor ist
    // gedeckelt, damit kein Blech zwei Tonnen wiegt (Design 02.09.2026).
    if (c) {
      const summe = specs.reduce((a, sp) => a + sp.massKg, 0);
      if (summe > 0) {
        const faktor = THREE.MathUtils.clamp(c.massKg / summe, 0.3, 8);
        for (const sp of specs) sp.massKg = Math.round(sp.massKg * faktor);
        // Greift die Deckelung — etwa wenn nur vier Schwergewichte geladen
        // sind —, wird die angekündigte Menge nach unten korrigiert. Sonst
        // verspricht der Kunde an der Waage mehr, als auf dem Wagen liegt.
        (c as { massKg: number }).massKg = specs.reduce((a, sp) => a + sp.massKg, 0);
      }
    }
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
      // Luft auf die Pritsche zu fallen.
      // Hoehe begrenzt: Mit sechs Lagen a 0,45 m tuermte sich die Fuhre bis
      // 2,55 m ueber den Boden der Mulde — ueber drei Meter ueber der Strasse.
      // So faehrt niemand vom Hof. Drei Lagen reichen bis knapp einen Meter,
      // etwa Bordwandhoehe plus Haufen obendrauf. Was nicht mehr passt, faellt
      // weg; die Liefermenge des Kunden wird ohnehin ueber die Massen der
      // gesetzten Stuecke erreicht, nicht ueber ihre Zahl.
      for (let layer = 0; layer < 2 && !spot; layer++) {
        const y = 0.22 + layer * 0.34;
        for (let attempt = 0; attempt < 40; attempt++) {
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
  /**
   * Ist die Ladeflaeche leer?
   *
   * Vorher galt der LKW erst als entladen, wenn JEDES Ladungsteil mehr als 4 m
   * vom Fahrzeug entfernt lag. Wer den Schrott gleich neben dem LKW ablegte —
   * und das tut man, der Haufen ist ja da —, sperrte ihn damit fest: Der
   * Fahrer wartete auf etwas, das laengst nicht mehr auf seiner Flaeche lag.
   * Genau das war "der LKW sieht leer aus und faehrt trotzdem nicht".
   *
   * Massgeblich ist jetzt, was auf der Flaeche liegt, nicht was daneben liegt.
   * Ein Rest von 20 kg bleibt zulaessig — ein einzelnes verklemmtes Blech soll
   * den Betrieb nicht anhalten.
   */
  private isUnloaded(): boolean {
    return this.cargoMassKg() <= 20;
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
  /**
   * Steht ein festes Bauwerk im Weg? Das gilt immer — anders als loser Schrott
   * laesst es sich nicht wegraeumen, und hindurchfahren darf niemand.
   */
  private isBlockedByBuilding(
    route: Array<[number, number]>,
    aheadS: number,
    reverse: boolean
  ): boolean {
    const ax = this.group.position.x;
    const az = this.group.position.z;
    const probe = this.probePoint(route, aheadS, reverse);
    for (let t = 0.3; t <= 1.001; t += 0.235) {
      if (hitsObstacle(ax + (probe.x - ax) * t, az + (probe.z - az) * t, 1.4)) return true;
    }
    return false;
  }

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

  /** Steht es gerade zur Kontrolle auf der Waage? (siehe VehicleManager) */
  get aufDerWaage(): boolean {
    if (this.phase === "weighIn") return true;
    return this.isPickup && this.wiegeHaltS > 0;
  }

  /** Fahrschritt mit Blockade-Prüfung; liefert true, wenn tatsächlich gefahren wurde. */
  private advance(route: Array<[number, number]>, step: number, reverse: boolean, dt: number): boolean {
    // Bauten zuerst und ohne Ausnahme: Die Aufgeben-Regel unten ist fuer losen
    // Schrott gedacht, der irgendwann weggeraeumt wird. Auf Mauern, Mulden und
    // das Betriebsgebaeude darf sie nicht durchschlagen — sonst faehrt der LKW
    // nach der Wartezeit einfach hindurch, und genau das war zu sehen.
    if (this.isBlockedByBuilding(route, this.routeS + 4, reverse)) {
      this.blockedT += dt;
      if (this.blockedT > HONK_AFTER_S && !this.honked) {
        this.honked = true;
        this.onHonk?.();
      }
      return false;
    }
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
        // Der Fahrer gibt Mario an der Waage die Papiere — das dauert einen
        // Moment. Danach wird über den Preis geredet, und erst wenn man sich
        // einig ist, fährt er auf den Platz. Solange bleibt er auf der Waage
        // stehen (Design 02.09.2026).
        if (this.phaseT > 2.5 && !this.weighedIn) {
          this.weighedIn = true;
          this.bruttoKg = this.cargoMassKg();
          this.onWeighIn?.(this.bruttoKg); // kann awaitingDeal setzen
        }
        // Notausstieg: Bleibt die Antwort aus — weil der Spieler das Fenster
        // übersieht oder wegklickt —, fährt der Fahrer nach einer halben
        // Minute zum Marktpreis weiter. Ein wartender LKW darf den Betrieb
        // nicht dauerhaft anhalten (Design-Fix 02.09.2026).
        if (this.awaitingDeal && this.phaseT > 32) {
          this.awaitingDeal = false;
          this.onDealTimeout?.();
        }
        if (this.weighedIn && !this.awaitingDeal) {
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
        if (this.phaseT > 0.5) {
          this.phase = "reverseIn";
          this.phaseT = 0;
        }
        break;
      case "reverseIn":
        this.advance(this.routeRev, SPEED * 0.6 * dt, true, dt); // rückwärts langsamer (SW)
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
        if (this.phaseT > 1.2) {
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
        this.tip = Math.min(this.tip + dt / 4.2, 1);
        if (this.tip >= 1) {
          this.phase = "tipHold";
          this.phaseT = 0;
        }
        break;
      case "tipHold":
        if (this.phaseT > 2.2) {
          this.phase = "tipCreep";
          this.creepLeft = TIP_CREEP_M;
        }
        break;
      case "tipCreep": {
        // Gekippt ein Stueck geradeaus ziehen, bevor die Mulde sinkt (v2-Vorbild).
        // Senkt der LKW im Stand, bleibt Schrott auf der Flaeche liegen, sobald
        // unten schon etwas im Weg ist — der Haufen wird ja mit jeder Fuhre
        // hoeher. Zieht er gekippt weg, rutscht der Rest ueber die Kante nach.
        const schritt = Math.min(TIP_CREEP_SPEED * dt, this.creepLeft);
        this.group.position.x += Math.sin(this.group.rotation.y) * schritt;
        this.group.position.z += Math.cos(this.group.rotation.y) * schritt;
        this.creepLeft -= schritt;
        this.snapBodiesToPose();
        if (this.creepLeft <= 1e-6) {
          // Die Mulde sinkt jetzt waehrend der Abfahrt weiter, nicht im Stand
          this.senken = true;
          this.leaveUnloadingBay();
        }
        break;
      }
      case "tipBack":
        this.tip = Math.max(this.tip - dt / 1.5, 0);
        if (this.tip <= 0) this.leaveUnloadingBay();
        break;
      case "waitUnload":
        if (this.phaseT > 1 && this.isUnloaded()) this.leaveUnloadingBay();
        break;
      case "toPark": {
        /*
         * Zum Warteplatz rollen — aber nicht bis an die Wand: Der Fahrer
         * haelt davor, dreht sich und setzt dann rueckwaerts an die
         * Graffitiwand neben den Kaffeewagen (Wunsch 11.09.2026). Niemand
         * stellt sich mit der Schnauze an die Mauer.
         */
        this.sideOpenTarget = 0;
        const ziel = this.parkSpot!;
        const dx = ziel[0] - this.group.position.x;
        const dz = ziel[1] - PARK_ANFAHRT_M - this.group.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.6) {
          this.phase = "parkRueck";
          this.phaseT = 0;
          break;
        }
        const schritt = Math.min(SPEED * dt, d);
        this.group.position.x += (dx / d) * schritt;
        this.group.position.z += (dz / d) * schritt;
        this.group.rotation.y = Math.atan2(dx, dz);
        this.snapBodiesToPose();
        break;
      }
      case "parkRueck": {
        // Rueckwaerts an die Wand, dabei in die Laengsrichtung eindrehen.
        const ziel = this.parkSpot!;
        const dx = ziel[0] - this.group.position.x;
        const dz = ziel[1] - this.group.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) {
          this.group.rotation.y = Math.PI; // Front zum Platz, Heck zur Wand
          this.phase = "parked";
          this.phaseT = 0;
          this.snapBodiesToPose();
          break;
        }
        const schritt = Math.min(PARK_RUECK_SPEED * dt, d);
        this.group.position.x += (dx / d) * schritt;
        this.group.position.z += (dz / d) * schritt;
        // Die Front zeigt beim Zurueckstossen nach Sueden; sie dreht sich
        // waehrend der Fahrt dorthin ein, statt zu springen.
        const soll = Math.PI;
        let diff = soll - this.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.group.rotation.y += diff * Math.min(dt * 1.6, 1);
        this.snapBodiesToPose();
        break;
      }
      case "parked":
        // Kaffeepause: Der Fahrer steigt aus und geht zu Janine hinueber.
        // Einmal pro Pause. Ohne diese Sperre stieg er sofort wieder aus,
        // sobald er drin war, und der LKW fuhr nie los.
        if (this.fahrerState === "drin" && !this.kaffeeGehabt && this.phaseT > 1.2) {
          this.steigeAus();
        }
        // Rechtzeitig zurueck, sonst faehrt der LKW ohne ihn los
        if (this.fahrerState === "kaffee" && this.phaseT > this.parkSeconds - 12) {
          this.fahrerState = "rein";
        }
        if (this.phaseT > this.parkSeconds && this.fahrerState === "drin") {
          this.phase = "out";
          this.routeS = this.nearestS(this.routeOut);
        }
        break;
      case "out":
        this.sideOpenTarget = 0; // Bordwände zu, bevor es vom Platz geht
        // Abholer halten auf der Waage, solange Mario die Ladung ansieht
        if (this.wiegeHaltS > 0) {
          this.wiegeHaltS -= dt;
          break;
        }
        this.advance(this.routeOut, SPEED * dt, false, dt);
        if (!this.weighedOut && this.group.position.z >= WEIGH_Z) {
          this.weighedOut = true;
          if (this.isPickup) {
            // Voll vom Hof: kurz stehen bleiben, damit die Ladung geprüft wird
            this.wiegeHaltS = WIEGE_HALT_S;
          } else {
            // Ausfahrtswiegung: leer über die Brückenwaage → Netto steht fest
            const tara = this.cargoMassKg();
            this.onWeighOut?.(Math.max(this.bruttoKg - tara, 0));
          }
        }
        if (this.routeS >= this.routeLength(this.routeOut)) this.done = true;
        break;
    }

    this.updateTrailer(dt);
    this.updateFahrer(dt);

    // Ladekran: beim Andocken zur Seite schwenken, damit der Ausleger nicht ueber
    // der Ladeflaeche haengt und dem Baggerfahrer die Sicht und den Weg nimmt.
    if (this.crane) {
      const amPlatz =
        this.phase === "pauseBeforeUnload" ||
        this.phase === "waitUnload" ||
        this.phase === "waitLoad" ||
        this.phase === "tipping" ||
        this.phase === "tipHold";
      const ziel = amPlatz ? this.craneSide * CRANE_SWING : 0;
      // Langsam: ein Kran schwenkt nicht, er dreht sich gemaechlich
      this.craneSwing += THREE.MathUtils.clamp(ziel - this.craneSwing, -dt * 0.5, dt * 0.5);
      this.crane.rotation.y = this.craneSwing;
    }

    // Nach dem gekippten Anziehen sinkt die Mulde waehrend der Abfahrt, nicht im
    // Stand — der LKW haelt den Betrieb nicht auf, und der Rest rutscht unterwegs
    // noch nach.
    if (this.senken) {
      this.tip = Math.max(this.tip - dt / 2.4, 0);
      if (this.tip <= 0) this.senken = false;
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
    // Was noch auf der Ladeflaeche klemmt, stellt der Fahrer beim Wegfahren ab —
    // sonst fuehre er Material vom Platz und es waere fuer den Spieler weg.
    //
    // Frueher landete es auf einem FESTEN Punkt am Abladeplatz, in 0,6 bis 1,6 m
    // Hoehe. Wer gerade woanders arbeitete, sah dort unvermittelt Schrott vom
    // Himmel fallen — ohne Fahrzeug, ohne Zusammenhang. Jetzt wird nur abgesetzt,
    // was wirklich auf der Flaeche liegt, und zwar dicht neben dem Fahrzeug auf
    // dem Boden: Das liest sich als Abladen, nicht als Regen.
    const gp = this.group.position;
    const quer = { x: Math.cos(this.group.rotation.y), z: -Math.sin(this.group.rotation.y) };
    const local = new THREE.Vector3();
    let k = 0;
    for (const it of this.cargo.items) {
      if (!it.body.isValid()) continue;
      const p = it.body.translation();
      local.set(p.x, p.y, p.z);
      this.bedGroup.worldToLocal(local);
      const aufDerFlaeche =
        Math.abs(local.x) < BED_HALF_W + 0.5 &&
        local.z > -0.5 &&
        local.z < this.bedLen + 0.5 &&
        local.y > -0.4 &&
        local.y < 5.0;
      if (!aufDerFlaeche) continue; // liegt schon auf dem Platz — nicht anfassen
      // Seitlich neben das Fahrzeug, knapp ueber dem Boden
      const seite = 3.2 + (k % 3) * 0.9;
      it.body.setTranslation(
        { x: gp.x + quer.x * seite, y: 0.35, z: gp.z + quer.z * seite },
        true
      );
      it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      k++;
    }
    this.group.removeFromParent();
    this.world.removeRigidBody(this.chassisBody);
    this.world.removeRigidBody(this.bedBody);
  }
}

export class VehicleManager {
  private active: DeliveryVehicle | null = null;
  /**
   * Fahrzeuge, die abgeladen haben und auf dem Warteplatz stehen. Sie
   * blockieren den Abladeplatz nicht mehr, sind aber weiter auf dem Hof —
   * so ist immer Betrieb, statt dass der Platz zwischen zwei Fuhren
   * leersteht (Wunsch 02.09.2026).
   */
  private parked: DeliveryVehicle[] = [];
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
  /**
   * Faktor auf die Wartezeit bis zur nächsten Fuhre. Ein voller Platz
   * bekommt etwas Luft, ein leerer Nachschub im Minutentakt.
   */
  intervalFactor = 1;

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
    // Feste Bauten pruefen NICHT mehr hier: Sie haengen an isBlockedByBuilding,
    // damit die Aufgeben-Regel nicht auf sie durchschlaegt.
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
  /** Meldung, wenn ein Kunde eintrifft — für Begrüßung und HUD. */
  onCustomerArrived: ((c: CustomerProfile) => void) | null = null;

  spawnNow(kind?: DeliveryKind, kunde?: CustomerProfile): void {
    if (this.active) return;
    // Erst die Kundschaft, dann das Fahrzeug dazu: ein Privatmann kommt nicht
    // mit dem Sattelzug, und ein Abbruchbetrieb nicht mit dem PKW-Anhänger.
    // Zweimal zu würfeln hätte Fahrzeug und Kunde entkoppelt.
    const gezogen = kunde ?? rollCustomer();
    const k: DeliveryKind =
      kind ?? vehicleForCustomer(gezogen);
    const c = k === "abholer" ? null : gezogen;
    this.active = new DeliveryVehicle(
      k,
      this.scene,
      this.world,
      this.blockedAt,
      () => this.onHonk?.(),
      (kg) => this.onWeighIn?.(kg),
      (kg) => this.onWeighOut?.(kg),
      c
    );
    if (c) this.onCustomerArrived?.(c);
    // Händler bleiben gern noch auf einen Kaffee; Gewerbe hat es eilig.
    // Nur freie Plätze vergeben, sonst stünde einer im anderen.
    if (c && c.group !== "gewerbe" && Math.random() < (c.group === "haendler" ? 0.75 : 0.35)) {
      const frei = PARK_SLOTS.filter(
        (p) => !this.parked.some((v) => v.parkSpot?.[0] === p[0] && v.parkSpot?.[1] === p[1])
      );
      if (frei.length > 0) {
        this.active.parkSpot = frei[Math.floor(Math.random() * frei.length)];
        this.active.parkSeconds =
          PARK_TIME_S[0] + Math.random() * (PARK_TIME_S[1] - PARK_TIME_S[0]);
      }
    }
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

  /**
   * Steht gerade ein Fahrzeug zur Kontrolle auf der Waage? Dann kommt Mario
   * aus dem Büro und sieht sich die Ladung an (Wunsch 11.09.2026).
   *
   * Bei der Einfahrt gilt das für jeden Anlieferer. Bei der Ausfahrt nur für
   * Abholer: Die fahren beladen vom Hof, und was rausgeht, wird geprüft. Wer
   * leer rausfährt, hat nichts vorzuzeigen — dafür bleibt er drin.
   */
  wiegeKontrolle(): THREE.Vector3 | null {
    for (const v of [this.active, ...this.parked]) {
      if (v && v.aufDerWaage) return v.group.position;
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
    // Auch die Wartenden stehen im Weg — der Arm darf nicht hindurchfahren
    for (const v of this.parked) v.collectBodyHandles(out);
    return out;
  }

  /** Verhandlung läuft: Das Fahrzeug wartet an der Waage. */
  set dealPending(v: boolean) {
    if (this.active) this.active.awaitingDeal = v;
  }

  /** Rückmeldung, wenn die Verhandlung in die Zeitgrenze läuft. */
  set onDealTimeout(fn: () => void) {
    if (this.active) this.active.onDealTimeout = fn;
  }

  /** Wer gerade an der Waage steht — für die Verhandlung. */
  get activeCustomer(): CustomerProfile | null {
    return this.active?.customer ?? null;
  }

  get activeKind(): DeliveryKind | null {
    return this.active?.kind ?? null;
  }

  /** Fraktion der laufenden Anlieferung, falls sie sortenrein ist. */
  get activeSortedMaterial(): string | null {
    return this.active?.sortedMaterial ?? null;
  }

  /**
   * Zusammensetzung der wartenden Ladung nach Fraktion, absteigend nach
   * Masse. Sichtbar wird das erst mit dem Büro — ohne Marktkenntnis sieht man
   * einem gemischten Haufen auf der Ladefläche nicht an, was drinsteckt.
   */
  get activeCargoMix(): Array<{ materialId: string; kg: number; share: number }> {
    const items = this.active?.cargo.items ?? [];
    if (items.length === 0) return [];
    const kgJe = new Map<string, number>();
    let gesamt = 0;
    for (const it of items) {
      kgJe.set(it.materialId, (kgJe.get(it.materialId) ?? 0) + it.massKg);
      gesamt += it.massKg;
    }
    if (gesamt <= 0) return [];
    return [...kgJe.entries()]
      .map(([materialId, kg]) => ({ materialId, kg, share: kg / gesamt }))
      .sort((a, b) => b.kg - a.kg);
  }

  update(dt: number): void {
    this.t += dt;
    // Wartende Fahrzeuge weiterlaufen lassen: Pause, dann Ausfahrt
    for (let i = this.parked.length - 1; i >= 0; i--) {
      const v = this.parked[i];
      v.update(dt);
      if (v.done) {
        v.despawn();
        this.parked.splice(i, 1);
      }
    }
    if (!this.active) {
      if (this.acceptDeliveries && this.t >= this.nextSpawnT) this.spawnNow();
      return;
    }
    this.active.update(dt);
    if (this.active.consumeDeparted()) this.onPickupDepart?.(this.active);
    // Sobald das Fahrzeug den Abladeplatz Richtung Warteplatz verlässt, ist
    // der Platz frei und der Nächste darf kommen — auch wenn der Vorige noch
    // beim Kaffee steht.
    if (this.active.isParked) {
      this.parked.push(this.active);
      this.active = null;
      this.t = 0;
      this.nextSpawnT =
        (NEXT_DELAY_S[0] + Math.random() * (NEXT_DELAY_S[1] - NEXT_DELAY_S[0])) *
        this.intervalFactor;
      return;
    }
    if (this.active.done) {
      this.active.despawn();
      this.active = null;
      this.t = 0;
      this.nextSpawnT =
        (NEXT_DELAY_S[0] + Math.random() * (NEXT_DELAY_S[1] - NEXT_DELAY_S[0])) *
        this.intervalFactor;
    }
  }
}
