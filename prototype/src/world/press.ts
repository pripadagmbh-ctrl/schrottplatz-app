import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ItemManager } from "./scrapItems";
import type { CompositeManager } from "../dismantle/composites";

/**
 * Schrottschere / Paketierpresse (Design 2026-08-29):
 * Aufbau wie eine oben offene Containermulde — Schrott wird von oben mit der
 * Spinne eingefüllt. Der Zyklus:
 *   1. Zwei dicke Eisenplatten (Deckelklappen) schließen von beiden Seiten von
 *      oben und drücken dabei teilweise von oben ins Material.
 *   2. Der Pressstempel läuft von RECHTS nach LINKS durch die Mulde und presst
 *      das Paket gegen die linke Stirnwand.
 *   3. Stempel zurück, Klappen auf — das Paket liegt fertig in der Mulde.
 *
 * Sicherheitsprinzip (Kap. 6): Beide Werkzeuge sind kinematisch und stoppen vor
 * dem Material (Klemmgrenze), das eigentliche Plattdrücken ist ein
 * Zustandswechsel der Teile — nichts wird gegen eine Wand zerquetscht.
 */

const CENTER = new THREE.Vector3(0, 0, -9.5); // (SW) südlich hinter dem Bagger, im Schwenkbereich
/**
 * Die Mulde ist um 90° gedreht aufgestellt: Die lange Achse läuft Nord–Süd, die
 * aufstehenden Deckelplatten stehen dadurch östlich und westlich — die Stirnseite
 * zum Baggerplatz bleibt frei zum Befüllen (Design-Fix 2026-08-29).
 */
const ROT = Math.PI / 2;
// Große Mulde: die lange offene Seite zeigt nach Norden zum Baggerplatz,
// damit von dort bequem eingefüllt werden kann (Design 2026-08-29).
const INNER_W = 7.0; // x — Länge, Pressweg (rechts → links)
const INNER_D = 6.0; // z — Breite (verdoppelt)
const WALL_H = 1.9;
const PLATE_T = 0.3; // dicke Eisenplatten (SW)
const LID_HINGE_Y = WALL_H - 0.1;
// Offen legen sich die Klappen nach außen weg, statt hochkant über der Mulde
// zu stehen — so bleibt der Blick auf die Schere frei (Design-Fix 29.08.2026)
const LID_OPEN_ANGLE = 2.65; // rad ≈ 152°, die Platten liegen fast flach außen
const RAM_HOME_X = INNER_W / 2 - 0.35;
const RAM_END_X = -INNER_W / 2 + 1.1; // Restdicke = Paketdicke (SW)

const LID_TIME = 1.6; // s (SW)
const RAM_FWD_TIME = 3.0;
const RAM_HOLD_TIME = 0.9;
const RAM_BACK_TIME = 2.0;

type Phase = "idle" | "lidsClose" | "ramFwd" | "hold" | "ramBack" | "lidsOpen";

export class PressManager {
  private lidLeft = new THREE.Group();
  private lidRight = new THREE.Group();
  /** Hubzylinder der Deckelplatten (Winkelhebel-Antrieb) */
  private linkages: Array<{
    a: THREE.Object3D;
    b: THREE.Object3D;
    barrel: THREE.Mesh;
    rod: THREE.Mesh;
    barrelLen: number;
  }> = [];
  private lidLeftBody: RAPIER.RigidBody;
  private lidRightBody: RAPIER.RigidBody;
  private ram: THREE.Mesh;
  private ramBody: RAPIER.RigidBody;
  private group!: THREE.Group;
  private localP = new THREE.Vector3();
  private phase: Phase = "idle";
  private t = 0;
  private lidAngle = LID_OPEN_ANGLE; // 0 = zu
  private ramX = RAM_HOME_X;
  private ramBackFrom = RAM_END_X;
  private ramTarget = RAM_END_X;
  private stamped = false;

  onStart: (() => void) | null = null;
  onLidsClosed: (() => void) | null = null;
  /** (Anzahl gepresster Teile, Position) */
  onStamp: ((count: number, pos: THREE.Vector3) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    private items: ItemManager,
    private composites: CompositeManager
  ) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a5157, roughness: 0.6, metalness: 0.55 });
    const heavy = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.5, metalness: 0.7 });
    const warn = new THREE.MeshStandardMaterial({ color: 0xd7a71f, roughness: 0.7 });

    const group = new THREE.Group();
    group.position.copy(CENTER);
    group.rotation.y = ROT;
    scene.add(group);
    this.group = group;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ROT, 0));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(CENTER.x, 0, CENTER.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );

    // --- Mulde: Boden + vier Wände, oben offen ---
    const floor = new THREE.Mesh(new THREE.BoxGeometry(INNER_W + 0.7, 0.3, INNER_D + 0.7), steel);
    floor.position.y = 0.15;
    floor.receiveShadow = true;
    group.add(floor);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((INNER_W + 0.7) / 2, 0.15, (INNER_D + 0.7) / 2).setTranslation(0, 0.15, 0),
      body
    );
    // [x, z, sx, sz] — Längswände (z±) und Stirnwände (x±)
    const walls: Array<[number, number, number, number]> = [
      [0, -(INNER_D / 2 + 0.175), INNER_W + 0.7, 0.35],
      [0, INNER_D / 2 + 0.175, INNER_W + 0.7, 0.35],
      [-(INNER_W / 2 + 0.175), 0, 0.35, INNER_D],
      [INNER_W / 2 + 0.175, 0, 0.35, INNER_D],
    ];
    for (const [wx, wz, sx, sz] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, WALL_H, sz), steel);
      wall.position.set(wx, WALL_H / 2 + 0.3, wz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(sx / 2, WALL_H / 2, sz / 2).setTranslation(wx, WALL_H / 2 + 0.3, wz),
        body
      );
    }
    // Warnstreifen auf der Muldenkante (Längsseite zum Platz)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(INNER_W + 0.7, 0.16, 0.38), warn);
    stripe.position.set(0, WALL_H + 0.34, INNER_D / 2 + 0.175);
    group.add(stripe);

    // --- Zwei LÄNGS liegende Deckelplatten (Design 2026-08-29) ---
    // Scharniere laufen entlang der langen Muldenseiten; bewegt werden die
    // Platten über Winkelhebel, die von je zwei Hubzylindern angetrieben werden.
    const lidReach = INNER_D / 2 + 0.14; // wie weit die Platte zur Mitte reicht
    const lidLen = INNER_W + 0.25; // über die ganze Muldenlänge
    const leverX = [-INNER_W / 2 + 0.9, INNER_W / 2 - 0.9];
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0xb8bec4,
      roughness: 0.22,
      metalness: 0.85,
    });

    const makeLid = (side: -1 | 1): { pivot: THREE.Group; body: RAPIER.RigidBody } => {
      const pivot = new THREE.Group();
      pivot.position.set(0, LID_HINGE_Y + 0.3, side * (INNER_D / 2 + 0.12));
      const plate = new THREE.Mesh(new THREE.BoxGeometry(lidLen, PLATE_T, lidReach), heavy);
      plate.position.z = -side * (lidReach / 2); // ragt zur Muldenmitte
      plate.castShadow = true;
      pivot.add(plate);
      // Quer-Versteifungen auf der Platte
      for (const rx of [-2.4, -0.8, 0.8, 2.4]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, lidReach - 0.25), warn);
        rib.position.set(rx, PLATE_T / 2 + 0.05, -side * (lidReach / 2));
        pivot.add(rib);
      }
      // Scharnierrohr längs
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, lidLen + 0.2, 10),
        warn
      );
      hinge.rotation.z = Math.PI / 2;
      pivot.add(hinge);
      // Winkelhebel: stehen nach außen-oben ab und werden von den Zylindern gezogen
      for (const lx of leverX) {
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.18), warn);
        lever.position.set(lx, 0.34, side * 0.2);
        lever.rotation.x = -side * 0.42;
        lever.castShadow = true;
        pivot.add(lever);
        const anchor = new THREE.Object3D();
        anchor.position.set(lx, 0.68, side * 0.42);
        pivot.add(anchor);
        // Fester Zylinderbock unten außen an der Mulde
        const base = new THREE.Object3D();
        base.position.set(lx, 0.6, side * (INNER_D / 2 + 1.25));
        group.add(base);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), steel);
        stand.position.copy(base.position);
        stand.position.y = 0.6;
        stand.castShadow = true;
        group.add(stand);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 10), heavy);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 8), rodMat);
        barrel.castShadow = true;
        scene.add(barrel);
        scene.add(rod);
        this.linkages.push({ a: base, b: anchor, barrel, rod, barrelLen: 1.1 });
      }
      group.add(pivot);
      const lidBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(lidLen / 2, PLATE_T / 2, lidReach / 2),
        lidBody
      );
      return { pivot, body: lidBody };
    };
    const south = makeLid(-1);
    const north = makeLid(1);
    this.lidLeft = south.pivot;
    this.lidLeftBody = south.body;
    this.lidRight = north.pivot;
    this.lidRightBody = north.body;

    // --- Pressstempel: fährt längs durch die Mulde ---
    this.ram = new THREE.Mesh(new THREE.BoxGeometry(PLATE_T * 1.4, WALL_H - 0.1, INNER_D - 0.1), heavy);
    this.ram.position.set(RAM_HOME_X, WALL_H / 2 + 0.3, 0);
    this.ram.castShadow = true;
    group.add(this.ram); // im Muldenrahmen — dreht mit
    this.ramBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((PLATE_T * 1.4) / 2, (WALL_H - 0.1) / 2, (INNER_D - 0.1) / 2),
      this.ramBody
    );
    // Zylinderbock rechts hinter dem Stempel
    const ramHousing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, INNER_D), warn);
    ramHousing.position.set(INNER_W / 2 + 0.9, WALL_H / 2 + 0.4, 0);
    ramHousing.castShadow = true;
    group.add(ramHousing);

    this.syncTools();
  }

  start(): boolean {
    if (this.phase !== "idle") return false;
    this.phase = "lidsClose";
    this.t = 0;
    this.onStart?.();
    return true;
  }

  get running(): boolean {
    return this.phase !== "idle";
  }

  /** Ist der Punkt in der Muldenkammer? (Prüfung im gedrehten Muldenrahmen) */
  private inChamber(p: { x: number; y: number; z: number }): boolean {
    const l = this.toLocal(p);
    return (
      Math.abs(l.x) < INNER_W / 2 + 0.2 &&
      Math.abs(l.z) < INNER_D / 2 + 0.2 &&
      l.y < WALL_H + 1.0
    );
  }

  private toLocal(p: { x: number; y: number; z: number }): THREE.Vector3 {
    this.localP.set(p.x, p.y, p.z);
    return this.group.worldToLocal(this.localP);
  }

  /** Oberkante des Materials — die Klappen drücken nur bis knapp darüber. */
  private pileTop(): number {
    let top = 0.3;
    for (const item of this.items.items) {
      const p = item.body.translation();
      if (this.inChamber(p)) top = Math.max(top, p.y + 0.3);
    }
    for (const car of this.composites.cars) {
      const p = car.body.translation();
      if (this.inChamber(p)) top = Math.max(top, p.y + 0.75);
    }
    return top;
  }

  /** Weltposition des Muldenzentrums auf Arbeitshöhe (für Partikel/Toasts). */
  get centerWorld(): THREE.Vector3 {
    return CENTER.clone().setY(1.0);
  }

  /**
   * Endposition des Stempels = linke Stirnwand + Paketdicke. Die Dicke wächst
   * mit der Materialmenge — so wird nie mehr Material in den Raum gedrückt, als
   * hineinpasst (Klemmschutz), und der Stempel fährt trotzdem sichtbar durch.
   */
  private computeRamTarget(): number {
    let count = 0;
    let cars = 0;
    for (const item of this.items.items) {
      if (this.inChamber(item.body.translation())) count++;
    }
    for (const car of this.composites.cars) {
      if (this.inChamber(car.body.translation())) cars++;
    }
    const thickness = 0.4 + 0.14 * count + 1.4 * cars;
    return THREE.MathUtils.clamp(-INNER_W / 2 + thickness, RAM_END_X, RAM_HOME_X - 0.4);
  }

  /** Kleinstmöglicher Klappenwinkel, damit die Platte nicht ins Material presst. */
  private lidLimit(): number {
    const need = this.pileTop() + 0.08 - (LID_HINGE_Y + 0.3);
    const arm = INNER_D / 2;
    if (need <= 0) return 0;
    return Math.min(LID_OPEN_ANGLE, Math.asin(Math.min(need / arm, 1)));
  }

  update(dt: number): void {
    if (this.phase !== "idle") this.t += dt;
    switch (this.phase) {
      case "lidsClose": {
        const target = this.lidLimit();
        const k = Math.min(this.t / LID_TIME, 1);
        this.lidAngle = THREE.MathUtils.lerp(LID_OPEN_ANGLE, target, k);
        if (k >= 1) {
          this.phase = "ramFwd";
          this.t = 0;
          this.stamped = false;
          this.ramTarget = this.computeRamTarget();
          this.onLidsClosed?.();
        }
        break;
      }
      case "ramFwd": {
        const k = Math.min(this.t / RAM_FWD_TIME, 1);
        this.ramX = THREE.MathUtils.lerp(RAM_HOME_X, this.ramTarget, k);
        // Auf halbem Weg zuschlagen: ab hier ist alles flach und braucht Platz
        if (k >= 0.5 && !this.stamped) {
          this.stamped = true;
          this.stamp();
        }
        if (k >= 1) {
          this.phase = "hold";
          this.t = 0;
        }
        break;
      }
      case "hold":
        if (this.t >= RAM_HOLD_TIME) {
          this.phase = "ramBack";
          this.ramBackFrom = this.ramX;
          this.t = 0;
        }
        break;
      case "ramBack": {
        const k = Math.min(this.t / RAM_BACK_TIME, 1);
        this.ramX = THREE.MathUtils.lerp(this.ramBackFrom, RAM_HOME_X, k);
        if (k >= 1) {
          this.phase = "lidsOpen";
          this.t = 0;
        }
        break;
      }
      case "lidsOpen": {
        const k = Math.min(this.t / LID_TIME, 1);
        this.lidAngle = THREE.MathUtils.lerp(this.lidLimit(), LID_OPEN_ANGLE, k);
        if (k >= 1) this.phase = "idle";
        break;
      }
      case "idle":
        return;
    }
    this.syncTools();
  }

  /** Klappen- und Stempelpose auf Meshes + kinematische Körper übertragen. */
  private syncTools(): void {
    // Klappen schwenken um die Längsachse (X): Süd negativ, Nord positiv
    this.lidLeft.rotation.x = -this.lidAngle;
    this.lidRight.rotation.x = this.lidAngle;
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    for (const [pivot, lidBody] of [
      [this.lidLeft, this.lidLeftBody],
      [this.lidRight, this.lidRightBody],
    ] as const) {
      const plate = pivot.children[0];
      plate.updateWorldMatrix(true, false);
      plate.getWorldPosition(wp);
      plate.getWorldQuaternion(wq);
      lidBody.setNextKinematicTranslation({ x: wp.x, y: wp.y, z: wp.z });
      lidBody.setNextKinematicRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w });
    }
    this.ram.position.x = this.ramX;
    this.ram.updateWorldMatrix(true, false);
    this.ram.getWorldPosition(wp);
    this.ram.getWorldQuaternion(wq);
    this.ramBody.setNextKinematicTranslation({ x: wp.x, y: wp.y, z: wp.z });
    this.ramBody.setNextKinematicRotation({ x: wq.x, y: wq.y, z: wq.z, w: wq.w });
    this.updateLinkages();
  }

  private linkA = new THREE.Vector3();
  private linkB = new THREE.Vector3();
  private linkDir = new THREE.Vector3();
  private static UP = new THREE.Vector3(0, 1, 0);

  /** Hubzylinder zwischen festem Bock und Winkelhebel nachführen. */
  private updateLinkages(): void {
    for (const l of this.linkages) {
      l.a.getWorldPosition(this.linkA);
      l.b.getWorldPosition(this.linkB);
      this.linkDir.copy(this.linkB).sub(this.linkA);
      const dist = Math.max(this.linkDir.length(), 0.25);
      this.linkDir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(PressManager.UP, this.linkDir);
      l.barrel.position.copy(this.linkA).addScaledVector(this.linkDir, l.barrelLen / 2);
      l.barrel.quaternion.copy(q);
      l.barrel.scale.set(1, l.barrelLen, 1);
      const rodLen = Math.max(dist - l.barrelLen + 0.12, 0.12);
      l.rod.position.copy(this.linkB).addScaledVector(this.linkDir, -rodLen / 2);
      l.rod.quaternion.copy(q);
      l.rod.scale.set(1, rodLen, 1);
    }
  }

  /**
   * Zuschlagen: alles in der Mulde wird zu Paketen.
   *
   * Alles in der Kammer wird zu EINEM Paket — die Presse sortiert nicht.
   * Wer ein sortenreines Paket will, muss sortenrein einlegen; das Paket
   * merkt sich seine Zusammensetzung und bringt gemischt entsprechend
   * weniger (Design-Fix 29.08.2026).
   */
  private stamp(): void {
    const inChamber = this.items.items.filter((it) => this.inChamber(it.body.translation()));
    let count = 0;
    if (inChamber.length === 1) {
      // ein einzelnes Teil ergibt noch kein Paket — das wird nur gestaucht
      if (this.items.flattenItem(inChamber[0])) count++;
    } else if (inChamber.length > 1) {
      // Zusammensetzung festhalten, auch die von schon gepressten Paketen
      const anteile = new Map<string, number>();
      for (const it of inChamber) {
        for (const c of it.composition ?? [{ materialId: it.materialId, massKg: it.massKg }]) {
          anteile.set(c.materialId, (anteile.get(c.materialId) ?? 0) + c.massKg);
        }
      }
      const composition = [...anteile].map(([materialId, massKg]) => ({ materialId, massKg }));
      // Die dominante Fraktion gibt dem Paket Farbe und Namen
      const dominant = composition.reduce((a, b) => (b.massKg > a.massKg ? b : a));
      const kg = composition.reduce((s, c) => s + c.massKg, 0);
      const p = inChamber[0].body.translation();
      for (const it of inChamber) {
        const wasCar = this.composites.despawnByBody(it.body);
        this.items.remove(it, !wasCar);
      }
      this.items.spawnBale(
        dominant.materialId,
        kg,
        new THREE.Vector3(p.x, 1.0, CENTER.z),
        composition
      );
      count += inChamber.length;
    }
    for (const car of this.composites.cars) {
      if (!this.inChamber(car.body.translation())) continue;
      if (car.crushStage < 2) {
        car.pressCrush();
        count++;
      }
    }
    this.onStamp?.(count, CENTER.clone().setY(1.0));
  }
}
