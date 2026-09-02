import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CAR_DEF, type CarDef, type PartDef } from "./carDef";
import type { ItemManager } from "../world/scrapItems";
import type { EventBus } from "../core/events";

/**
 * Verbundobjekt-System (Briefing Kap. 8, M2-Umfang):
 * - Rumpf = ein dynamischer Körper; Parts (Motor, Räder) hängen als Meshes dran.
 * - Aufprall-Erkennung über Geschwindigkeitssprung (Δv pro Step): Scheiben
 *   bersten, Karosse nimmt Quetschstufen (Modell-Squash + Kollidertausch).
 * - Abreißen: Spinne fasst nahe eines Part-Ankers die Part statt des Rumpfs,
 *   Ziehen über tearSeconds reißt sie heraus → eigenständiges ScrapItem.
 */

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
    this.buildMeshes();
    this.group.position.copy(pos);
    scene.add(this.group);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true)
        .setTranslation(pos.x, pos.y, pos.z)
        .setAngularDamping(0.8)
        .setLinearDamping(0.05)
    );
    this.collider = this.makeCollider(0);
    // Rumpf zählt als Stahlschrott-Item (Haufen-Zählung, HUD, Greifen)
    items.register({
      materialId: def.hullMaterialId,
      massKg: def.hullMassKg,
      mesh: this.group,
      body: this.body,
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

  private buildMeshes(): void {
    // flatShading: verbeulte Flächen lesen sich als geknautschtes Blech
    const paint = new THREE.MeshStandardMaterial({
      color: 0x8c2f24,
      roughness: 0.5,
      metalness: 0.3,
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
    this.group.add(this.crushGroup);
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 4.0, 4, 2, 9), paint);
    chassis.position.y = 0.28;
    chassis.castShadow = true;
    this.crushGroup.add(chassis);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.0, 4, 2, 5), paint);
    cabin.position.set(0, 0.83, -0.2);
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
    this.items.register({ materialId: d.materialId, massKg: d.massKg, mesh: part.mesh, body });

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
  findPartNear(pos: THREE.Vector3): TearTarget | null {
    const tmp = new THREE.Vector3();
    for (const part of this.parts) {
      if (!part.attached) continue;
      part.mesh.getWorldPosition(tmp);
      if (pos.distanceTo(tmp) <= part.def.grabRadius) {
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
  ) {}

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
