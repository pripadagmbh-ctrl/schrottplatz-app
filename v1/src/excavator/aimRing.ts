/**
 * Bodenring unter der Spinne (Vorbild Bagerana/v2, `view/AimRing.ts`).
 *
 * Auf dem Tablet ist die Tiefe kaum zu schätzen: Man sieht die Spinne über dem
 * Platz schweben, aber nicht, worüber genau. Der Ring liegt flach auf dem
 * obersten Ding unter dem Greifer und beantwortet beides — wo und was.
 *
 * Farbe erzählt, aber nie allein (die Griff-Info in der HUD schreibt Klartext
 * mit ✓ / ! / ✕ dazu, für alle, die Farben schlecht unterscheiden):
 *   weiß              nichts Besonderes darunter
 *   Fraktionsfarbe    ein greifbares Teil
 *   grün/gelb/rot     Ladung über einer Mulde — passt, gemischt, falsch
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { clawSpan } from "./clawGeometry";
import { getMaterial } from "../materials/catalog";
import type { ScrapItem } from "../world/scrapItems";
import type { AmpelState } from "../world/containers";

const NEUTRAL = 0xeef0ec;
const AMPEL: Record<AmpelState, number> = {
  green: 0x4fbf3f,
  yellow: 0xf2b632,
  red: 0xe0483a,
};
/** So weit reicht der Strahl nach unten, bevor der Ring auf den Boden fällt. */
const MAX_REICHWEITE = 14;

export class AimRing {
  private readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private readonly ziel = new THREE.Vector3();
  private readonly farbe = new THREE.Color();
  private gesetzt = false;

  constructor(scene: THREE.Scene) {
    // Innenradius 0,82 von 1: ein schmaler Reif, der nicht zudeckt, was darunter liegt
    const geo = new THREE.RingGeometry(0.82, 1, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: NEUTRAL,
      transparent: true,
      opacity: 0.85,
      // Ohne depthWrite: false verdeckt der Ring Teile, die eigentlich davor liegen
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  set visible(v: boolean) {
    this.mesh.visible = v;
  }

  /**
   * Je Bild aufrufen. Der Strahl startet am Sensor und sucht das oberste Ding
   * darunter; der Bagger selbst und die eigene Ladung werden übersprungen,
   * sonst läge der Ring auf der eigenen Kralle.
   */
  update(o: {
    world: RAPIER.World;
    sensorPos: THREE.Vector3;
    splay: number;
    selfHandles: Set<number>;
    grippedHandles: Set<number>;
    hoverItem: ScrapItem | null;
    ampel: AmpelState | null;
    dt: number;
  }): void {
    this.ray.origin.x = o.sensorPos.x;
    this.ray.origin.y = o.sensorPos.y + 0.3;
    this.ray.origin.z = o.sensorPos.z;
    const treffer = o.world.castRay(
      this.ray,
      MAX_REICHWEITE,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) => {
        const b = c.parent();
        if (!b) return true;
        return !o.selfHandles.has(b.handle) && !o.grippedHandles.has(b.handle);
      }
    );
    this.ziel.set(
      this.ray.origin.x,
      (treffer ? this.ray.origin.y - treffer.timeOfImpact : 0) + 0.03,
      this.ray.origin.z
    );
    // Weich nachführen: Der Strahl springt, sobald er an einer Kante vorbeigeht.
    // Ohne Glättung zappelt der Ring, und genau das soll er nicht.
    if (!this.gesetzt) {
      this.mesh.position.copy(this.ziel);
      this.gesetzt = true;
    } else {
      this.mesh.position.lerp(this.ziel, 1 - Math.exp(-o.dt / 0.05));
    }

    const r = Math.max(0.3, clawSpan(o.splay) / 2);
    this.mesh.scale.set(r, r, 1);

    if (o.ampel) this.farbe.setHex(AMPEL[o.ampel]);
    else if (o.hoverItem) this.farbe.setHex(getMaterial(o.hoverItem.materialId).color);
    else this.farbe.setHex(NEUTRAL);
    // Stahl und Störstoff sind dunkelbraun und auf dem Beton kaum zu sehen
    const hsl = { h: 0, s: 0, l: 0 };
    this.farbe.getHSL(hsl);
    if (hsl.l < 0.45) this.farbe.offsetHSL(0, 0.05, 0.45 - hsl.l);
    this.mesh.material.color.copy(this.farbe);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}
