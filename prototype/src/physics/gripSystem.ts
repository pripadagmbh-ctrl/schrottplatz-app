import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { TearTarget } from "../dismantle/composites";

/**
 * Greifsystem nach Briefing Kap. 6.2:
 * - Beim Schließen (Schwelle 70 %) einmalige Sensorabfrage (Kugel am Greifer-Palm).
 * - Für jedes getroffene dynamische Objekt: Fixed Joint an den kinematischen Greiferkörper.
 * - Limits: max. 5 Objekte, max. 2000 kg gesamt (Startwerte).
 * - Öffnen löst alle Joints, Objekte fallen mit aktueller Geschwindigkeit weiter.
 * Abrutschen (8 %/s unter Last) kommt in M1 — M0 hält, was gegriffen ist.
 */

const MAX_ITEMS = 5; // (SW)
const MAX_TOTAL_KG = 3500; // (SW) — eine ganze Karosse muss hochgehen
// Greif-Fenster: solange die Spinne schließt und noch nicht ganz zu ist, wird
// kontinuierlich zugepackt — so lassen sich fallende Objekte auffangen.
const GRAB_WINDOW_START = 0.6;
const GRAB_WINDOW_END = 0.98;
const SENSOR_RADIUS = 1.05; // m (SW) — Wirkradius der größeren Spinne
/** So lange muss die Spinne ganz zu gehalten werden, bis das Teil nachgibt */
const CRUSH_TIME = 1.1;

interface GrippedItem {
  body: RAPIER.RigidBody;
  joint: RAPIER.ImpulseJoint;
  massKg: number;
}

export class GripSystem {
  private items: GrippedItem[] = [];
  private sensorShape = new RAPIER.Ball(SENSOR_RADIUS);
  /** Traglast-Faktor aus dem Baggerausbau — von main gesetzt */
  getCapacityBonus: (() => number) | null = null;

  /** Hooks für Events (Audio/HUD) — von main verdrahtet, kein Modul-Import nötig */
  onGrabbed: ((bodies: RAPIER.RigidBody[]) => void) | null = null;
  onReleased: ((count: number) => void) | null = null;
  onTear: ((name: string) => void) | null = null;
  /** liefert eine abreißbare Baugruppe nahe des Sensors (Verbundobjekte, Kap. 8) */
  partResolver: ((pos: THREE.Vector3) => TearTarget | null) | null = null;
  /**
   * Prüft, ob ein Weltpunkt im Schalenkorb der Spinne liegt. Ohne diese Prüfung
   * würde alles im Sensorradius angehoben, auch was neben dem Greifer liegt.
   */
  insideGrapple: ((worldPos: THREE.Vector3) => boolean) | null = null;
  private probe = new THREE.Vector3();
  private tearState: { id: string; name: string; seconds: number; progress: number } | null = null;

  constructor(
    private world: RAPIER.World,
    private grappleBody: RAPIER.RigidBody
  ) {}

  get grippedCount(): number {
    return this.items.length;
  }

  get totalMassKg(): number {
    return this.items.reduce((s, i) => s + i.massKg, 0);
  }

  get grippedBodies(): RAPIER.RigidBody[] {
    return this.items.map((i) => i.body);
  }

  /**
   * Pro Physik-Step aufrufen.
   * @param closure aktueller Schließgrad 0..1
   * @param closing true solange der Spieler die Greif-Taste hält
   * @param sensorPos Weltposition des Sensor-Zentrums (zwischen den Fingern)
   */
  /** Aktueller Reiß-Fortschritt (fürs HUD), null wenn nicht am Reißen. */
  get tearing(): { name: string; progress01: number } | null {
    if (!this.tearState) return null;
    return {
      name: this.tearState.name,
      progress01: Math.min(this.tearState.progress / this.tearState.seconds, 1),
    };
  }

  /**
   * Zusammendrücken: Hält der Spieler die Spinne ganz zu, quetscht sie, was
   * sie gefasst hat. Der Aufrufer entscheidet über `crusher`, welche Teile
   * nachgeben — Stahlträger tun das nicht.
   */
  crusher: ((body: RAPIER.RigidBody) => boolean) | null = null;
  private crushT = 0;

  private updateCrush(closure: number, dt: number): void {
    if (!this.crusher || this.items.length === 0 || closure < 0.93) {
      this.crushT = 0;
      return;
    }
    this.crushT += dt;
    if (this.crushT < CRUSH_TIME) return;
    this.crushT = 0;
    for (const it of this.items) {
      if (it.body.isValid()) this.crusher(it.body);
    }
  }

  update(closure: number, closing: boolean, sensorPos: THREE.Vector3, dt: number): void {
    this.updateCrush(closure, dt);
    if (!closing) {
      // Loslassen wirft sofort ab — und die Spinne ist direkt wieder scharf
      // (schnelles Auf/Zu zum Auffangen und Umsortieren im Fallen).
      if (this.items.length > 0) this.releaseAll();
      this.tearState = null;
      return;
    }

    // Reiß-Mechanik: Baugruppe nahe des Sensors? Dann Part statt Rumpf fassen.
    if (closure >= GRAB_WINDOW_START && this.items.length === 0) {
      const target = this.partResolver?.(sensorPos) ?? null;
      if (target) {
        if (!this.tearState || this.tearState.id !== target.id) {
          this.tearState = {
            id: target.id,
            name: target.name,
            seconds: target.tearSeconds,
            progress: 0,
          };
        }
        const d = sensorPos.distanceTo(target.anchorWorld);
        if (d < 2.5) {
          // Gefasst halten reißt: voller Fortschritt, solange die Part im
          // Lösebereich bleibt. (Echte Zug-Kopplung des Arms kommt später.)
          this.tearState.progress += dt;
          if (this.tearState.progress >= this.tearState.seconds) {
            const body = target.tear();
            this.attachBody(body);
            this.onTear?.(target.name);
            this.tearState = null;
          }
          return; // solange die Part gefasst ist, nicht zusätzlich den Rumpf greifen
        }
        this.tearState = null;
      } else {
        this.tearState = null;
      }
    }

    if (closure >= GRAB_WINDOW_START && closure <= GRAB_WINDOW_END) {
      this.tryGrab(sensorPos);
    }
  }

  private tryGrab(sensorPos: THREE.Vector3): void {
    const candidates: RAPIER.RigidBody[] = [];
    this.world.intersectionsWithShape(
      { x: sensorPos.x, y: sensorPos.y, z: sensorPos.z },
      { x: 0, y: 0, z: 0, w: 1 },
      this.sensorShape,
      (collider) => {
        const body = collider.parent();
        if (body && body.isDynamic() && !candidates.includes(body)) {
          // Nur fassen, was wirklich zwischen den Schalen liegt. Geprüft wird
          // der nächstgelegene Punkt der Oberfläche, nicht der Schwerpunkt:
          // bei einem Auto liegt der in der Fahrzeugmitte und damit nie im
          // Schalenkorb — Karossen waren deshalb kaum zu fassen.
          if (this.insideGrapple) {
            const proj = collider.projectPoint(
              { x: sensorPos.x, y: sensorPos.y, z: sensorPos.z },
              true
            );
            if (!proj) return true;
            this.probe.set(proj.point.x, proj.point.y, proj.point.z);
            if (!this.insideGrapple(this.probe)) return true;
          }
          candidates.push(body);
        }
        return true; // weitersuchen
      }
    );

    // Schwerstes zuerst greifen — wer in einen Haufen greift, bekommt das große Teil sicher.
    candidates.sort((a, b) => b.mass() - a.mass());

    let added = 0;
    for (const body of candidates) {
      if (this.attachBody(body)) added++;
    }
    if (added > 0) this.onGrabbed?.(this.grippedBodies);
  }

  /** Körper per Fixed Joint an den Greifer koppeln (auch von der Reiß-Mechanik genutzt). */
  attachBody(body: RAPIER.RigidBody): boolean {
    if (this.items.length >= MAX_ITEMS) return false;
    if (this.items.some((it) => it.body.handle === body.handle)) return false; // schon gegriffen
    if (this.totalMassKg + body.mass() > MAX_TOTAL_KG * (this.getCapacityBonus?.() ?? 1))
      return false;

    const gPos = this.grappleBody.translation();
    const gRot = this.grappleBody.rotation();
    const gQuat = new THREE.Quaternion(gRot.x, gRot.y, gRot.z, gRot.w);
    const gQuatInv = gQuat.clone().invert();

    // Objekt-Transform relativ zum Greifer → Joint hält die aktuelle Lage exakt fest.
    const p = body.translation();
    const r = body.rotation();
    const relPos = new THREE.Vector3(p.x - gPos.x, p.y - gPos.y, p.z - gPos.z).applyQuaternion(
      gQuatInv
    );
    const relRot = gQuatInv.clone().multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w));

    const jointData = RAPIER.JointData.fixed(
      { x: relPos.x, y: relPos.y, z: relPos.z },
      { x: relRot.x, y: relRot.y, z: relRot.z, w: relRot.w },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 }
    );
    const joint = this.world.createImpulseJoint(jointData, this.grappleBody, body, true);
    this.items.push({ body, joint, massKg: body.mass() });
    return true;
  }

  releaseAll(): void {
    const count = this.items.length;
    for (const item of this.items) {
      this.world.removeImpulseJoint(item.joint, true);
      item.body.wakeUp();
    }
    this.items = [];
    if (count > 0) this.onReleased?.(count);
  }
}
