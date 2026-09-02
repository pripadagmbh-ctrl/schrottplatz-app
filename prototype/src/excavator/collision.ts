import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { hitsObstacle } from "../world/obstacles";

/**
 * Kollisionsprüfung des Baggers.
 *
 * Unterwagen, Ausleger, Stiel und Spinne sind kinematische Körper: Die Physik
 * hält sie nicht auf, sie würden einfach durch Mauern, Mulden und Fahrzeuge
 * hindurchfahren. Deshalb prüft der Bagger vor jedem Bild selbst, ob seine
 * Bauteile irgendwo hineinragen, und nimmt die Bewegung dann zurück.
 *
 * Zwei Dinge sind dabei entscheidend und waren beide schon einmal falsch:
 *
 * 1. Fahrwerk und Arm werden getrennt geprüft. Sonst legt ein Hindernis neben
 *    den Rädern auch den Ausleger stillt.
 * 2. Es muss einen Fluchtweg geben. Steckt ein Bauteil wirklich fest, werden
 *    Bewegungen wieder durchgelassen — sonst verkantet der Arm unrettbar,
 *    weil auch die befreiende Bewegung zurückgenommen würde.
 */

/** Ein Armglied als Quader: Mesh für die Pose, Halbmaße für die Abfrage. */
export interface ArmShape {
  mesh: () => THREE.Mesh;
  half: [number, number, number];
}

export interface CollisionContext {
  world: RAPIER.World;
  /** Standort des Unterwagens */
  position: THREE.Vector3;
  grappleGroup: THREE.Object3D;
  armShapes: ArmShape[];
  /** Körper des Fahrzeugs auf dem Platz */
  obstacleBodies: Set<number>;
  /** Was in der Spinne hängt, blockiert sie nicht selbst */
  grippedHandles: Set<number>;
  /** Position des Platzwarts, damit der Arm ihn verschont */
  getStaffPos: () => THREE.Vector3 | null;
}

/** Sicherheitsabstand des Unterwagens zu festen Bauten */
const CHASSIS_PAD = 1.3;
/** Sicherheitsabstand von Ausleger und Stiel */
const ARM_PAD = 0.2;
/** Sicherheitsabstand der Spinne zu Bauten */
const GRAPPLE_PAD = 0.9;
/** Radius der Prüfkugel im Schalenkorb */
const PROBE_R = 0.62;
/**
 * Radius, in dem die Spinne Material verdrängt. Größer als die Prüfkugel:
 * Beim Pflügen durch einen Haufen schiebt sie auch, was sie nur streift.
 */
const PLOW_R = 1.45;
/**
 * Masse, bei der die Achsen auf die Hälfte einbrechen. Am Bild abgestimmt:
 * Bei 750 kg war der Unterschied kaum zu merken, weil die Spinne beim
 * Schwenken ohnehin aus dem Haufen herausläuft und der Widerstand dabei
 * abfällt. Bei 350 kg pflügt man spürbar zäh.
 */
const PLOW_HALF_KG = 350;
/** Ab dieser Masse ist ein Brocken nicht mehr wegzuschieben */
const HEAVY_BLOCK_KG = 700;
/** So nah darf die tief hängende Spinne an den Platzwart heran */
const STAFF_CLEARANCE = 1.9;

const IDENT_QUAT = { x: 0, y: 0, z: 0, w: 1 };
/**
 * Prüfkugel im Schalenkorb, kleiner als die Spinne: Ein Stück weit dürfen
 * sich die Krallen eingraben — sie schneiden ja auch mal durch Blech —, aber
 * sie sollen nicht im Objekt verschwinden. Sie wird erst beim ersten Gebrauch
 * angelegt, weil beim Laden des Moduls das Rapier-WASM noch nicht
 * initialisiert ist.
 */
let probe: RAPIER.Ball | null = null;
let plowProbe: RAPIER.Ball | null = null;

export class ExcavatorCollision {
  /**
   * Zuletzt gültiger Zustand war frei. Ist das false, sitzt das Bauteil fest
   * und darf sich frei herausbewegen — der Fluchtweg.
   */
  armFree = true;
  chassisFree = true;

  private pos = new THREE.Vector3();
  private local = new THREE.Vector3();
  private armPos = new THREE.Vector3();
  private armQuat = new THREE.Quaternion();

  constructor(private ctx: CollisionContext) {}

  /**
   * Wie viel Masse die Spinne gerade vor sich herschiebt.
   *
   * Wer mit dem Greifer durch einen Schrottberg pflügt, muss den Widerstand
   * spüren: Gewicht und Reibung des verdrängten Materials summieren sich.
   * Ohne das gleitet die Spinne durch den Haufen, als wäre er Luft — sie ist
   * ja ein kinematischer Körper und wird von der Physik nicht gebremst.
   */
  plowMassKg(): number {
    plowProbe ??= new RAPIER.Ball(PLOW_R);
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    this.pos.y -= 1.35;
    let masse = 0;
    this.ctx.world.intersectionsWithShape(this.pos, IDENT_QUAT, plowProbe, (collider) => {
      const b = collider.parent();
      // Nie vorzeitig abbrechen — sonst bleibt der Rapier-Borrow offen
      if (!b || !b.isDynamic()) return true;
      // Was in der Spinne hängt, zählt separat als Traglast
      if (this.ctx.grippedHandles.has(b.handle)) return true;
      masse += b.mass();
      return true;
    });
    return masse;
  }

  /**
   * Faktor auf die Achsgeschwindigkeit durch verdrängtes Material.
   * 1 = freie Luft, gegen 0,2 = tief im Haufen.
   */
  plowFactor(): number {
    const m = this.plowMassKg();
    return Math.max(0.14, 1 / (1 + m / PLOW_HALF_KG));
  }

  /** Steht der Unterwagen in einem festen Bauwerk? Rein zweidimensional. */
  chassisHits(): boolean {
    const p = this.ctx.position;
    return hitsObstacle(p.x, p.z, CHASSIS_PAD) !== null;
  }

  /** Ragt irgendein Teil des Arms in etwas hinein, wo es nicht hingehört? */
  armHits(): boolean {
    if (this.grappleHitsBuilding()) return true;
    if (this.grappleHitsBody()) return true;
    if (this.armHitsBuilding()) return true;
    if (this.armHitsStaff()) return true;
    return this.ctx.obstacleBodies.size > 0 && this.armHitsVehicle();
  }

  /** Spinne gegen Mauern, Mulden und Schere. */
  private grappleHitsBuilding(): boolean {
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    return hitsObstacle(this.pos.x, this.pos.z, GRAPPLE_PAD, this.pos.y - 1.2) !== null;
  }

  /**
   * Steckt die Spinne in einem Fahrzeug oder einem schweren Brocken?
   *
   * Leichter Schrott wird bewusst nicht geprüft, sonst käme man nicht mehr in
   * einen Haufen hinein; den schieben die Krallen-Kollider ohnehin beiseite.
   */
  private grappleHitsBody(): boolean {
    probe ??= new RAPIER.Ball(PROBE_R);
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    this.pos.y -= 1.35; // Mitte des Schalenkorbs
    let hit = false;
    this.ctx.world.intersectionsWithShape(this.pos, IDENT_QUAT, probe, (collider) => {
      const b = collider.parent();
      // Nie vorzeitig abbrechen: Rapier hält die Welt während der Abfrage
      // geborgt, und ein offener Borrow lässt den nächsten schreibenden
      // Zugriff mit "recursive use of an object" abstürzen.
      if (!b || hit) return true;
      if (this.ctx.obstacleBodies.has(b.handle)) {
        hit = true; // Fahrzeug auf dem Platz
        return true;
      }
      if (this.ctx.grippedHandles.has(b.handle)) return true; // eigene Ladung
      // Feste Körper (Bauten) blockieren, nur der Boden zählt nicht mit
      if (b.isFixed() && collider.translation().y > -0.05) hit = true;
      else if (b.isDynamic() && b.mass() > HEAVY_BLOCK_KG) hit = true;
      return true;
    });
    return hit;
  }

  /** Ausleger und Stiel an mehreren Punkten entlang abtasten. */
  private armHitsBuilding(): boolean {
    for (const s of this.ctx.armShapes) {
      const mesh = s.mesh();
      mesh.updateWorldMatrix(true, false);
      for (const t of [-0.8, -0.3, 0.2, 0.7]) {
        this.local.set(0, 0, s.half[2] * 2 * t);
        this.pos.copy(this.local).applyMatrix4(mesh.matrixWorld);
        if (hitsObstacle(this.pos.x, this.pos.z, ARM_PAD, this.pos.y - s.half[1])) return true;
      }
    }
    return false;
  }

  /** Der Platzwart darf nicht vom Ausleger überfahren werden. */
  private armHitsStaff(): boolean {
    const lam = this.ctx.getStaffPos();
    if (!lam) return false;
    this.ctx.grappleGroup.getWorldPosition(this.pos);
    if (this.pos.y - 2.2 >= 2.4) return false; // Spinne hängt hoch genug
    return Math.hypot(this.pos.x - lam.x, this.pos.z - lam.z) < STAFF_CLEARANCE;
  }

  /** Schneidet Ausleger oder Stiel das Fahrzeug auf dem Platz? */
  private armHitsVehicle(): boolean {
    for (const s of this.ctx.armShapes) {
      const mesh = s.mesh();
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(this.armPos);
      mesh.getWorldQuaternion(this.armQuat);
      const shape = new RAPIER.Cuboid(s.half[0], s.half[1], s.half[2]);
      let hit = false;
      this.ctx.world.intersectionsWithShape(this.armPos, this.armQuat, shape, (collider) => {
        const b = collider.parent();
        if (b && this.ctx.obstacleBodies.has(b.handle)) hit = true;
        return true; // nie vorzeitig abbrechen, siehe grappleHitsBody
      });
      if (hit) return true;
    }
    return false;
  }
}
