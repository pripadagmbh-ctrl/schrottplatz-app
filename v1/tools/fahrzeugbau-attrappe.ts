/**
 * EIN LKW OHNE SPIEL — Modell bauen, Stellung setzen, messen.
 *
 * `vehicles.ts` ist eine Zustandsmaschine von 2.600 Zeilen: Sie fährt Routen,
 * würfelt Kunden, packt Ladung und wiegt. Wer die GEOMETRIE messen will,
 * braucht davon nichts — er braucht das Modell und die drei Stellgrössen, die
 * es bewegen. Genau die stehen hier.
 *
 * Wichtig: Die drei Stellgrössen werden nicht nachgebaut, sondern aus
 * `vehicles.ts` abgeschrieben, und der Wächter `test/fahrzeugteile.test.ts`
 * hält beide Fassungen zusammen — sonst misst das Werkzeug irgendwann eine
 * Kippbewegung, die es im Spiel nicht gibt.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { buildVehicleModel, type VehicleModelParts } from "../src/delivery/vehicleModel";
import { bedLenFor, TIP_ANGLE } from "../src/delivery/routes";

export type Aufbau = "flach" | "rungen" | "koffer";

export interface Messfahrzeug {
  kind: string;
  aufbau: Aufbau;
  mitKran: boolean;
  bedLen: number;
  group: THREE.Group;
  bedGroup: THREE.Group;
  teile: VehicleModelParts;
  /** Stellung setzen: Kippgrad 0–1, Kranschwenk in rad, Bordwände 0–1 offen */
  stelle(tip: number, kranSchwenk: number, bordwandOffen: number): void;
}

/**
 * Ein Fahrzeugmodell bauen. `mitKran` wird bewusst von aussen gegeben und
 * nicht aus dem Kunden geschlossen: Das Werkzeug muss auch den Fall „derselbe
 * Wagen ohne Kran" messen können — das ist die Nullprobe.
 */
export function baueMessfahrzeug(
  world: RAPIER.World,
  kind: string,
  aufbau: Aufbau,
  mitKran: boolean
): Messfahrzeug {
  const bedLen = bedLenFor(kind);
  const group = new THREE.Group();
  const bedGroup = new THREE.Group();
  const sideWalls: Array<{
    hinge: THREE.Group;
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    dir: number;
  }> = [];
  const teile = buildVehicleModel({
    kind,
    bedLen,
    withCrane: mitKran,
    bodyStyle: aufbau,
    halter: "Messstand",
    group,
    bedGroup,
    world,
    sideWalls,
    tailGate: null,
  });
  const fz: Messfahrzeug = {
    kind,
    aufbau,
    mitKran,
    bedLen,
    group,
    bedGroup,
    teile,
    stelle(tip: number, kranSchwenk: number, bordwandOffen: number): void {
      // Abgeschrieben aus `vehicles.update`: Kippwinkel, Kranschwenk, Klappen
      bedGroup.rotation.x = -tip * TIP_ANGLE;
      if (teile.crane) teile.crane.rotation.y = kranSchwenk;
      for (const w of sideWalls) w.hinge.rotation.z = -w.dir * bordwandOffen * (Math.PI / 2);
      group.updateWorldMatrix(true, true);
    },
  };
  fz.stelle(0, 0, 0);
  return fz;
}
