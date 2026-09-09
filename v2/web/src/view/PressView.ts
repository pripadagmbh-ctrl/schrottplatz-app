import * as THREE from "three";
import type { Rect } from "@/data/types";

/**
 * Paketierpresse, Bauart nach dem Prototyp (`prototype/src/world/press.ts`): eine oben offene Mulde, in die mit der
 * Spinne eingefüllt wird. Zwei lange Deckelplatten schwenken um Scharniere auf den Längsseiten; ein Stempel fährt
 * längs durch die Mulde. Die Hubzylinder sind bewusst kräftig gezeichnet — sie sollen die Mechanik erzählen und
 * nicht als Striche verschwinden (Prototyp-Notiz 02.09.2026).
 *
 * Reine Anzeige: Winkel und Stempelweg kommen aus dem PressSystem, hier wird nichts gerechnet.
 */
interface Linkage { a: THREE.Object3D; b: THREE.Object3D; barrel: THREE.Mesh; rod: THREE.Mesh; barrelLen: number }

export class PressView {
  private readonly lids: THREE.Group[] = [];
  private readonly ram: THREE.Mesh;
  private readonly lampMat: THREE.MeshStandardMaterial;
  private readonly linkages: Linkage[] = [];
  private readonly innerW: number;
  private readonly a = new THREE.Vector3(); private readonly b = new THREE.Vector3(); private readonly dir = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, rect: Rect, dim: { innerW: number; innerD: number; wallH: number; plateT: number }) {
    const steel = new THREE.MeshStandardMaterial({ color: "#4a5157", roughness: 0.6, metalness: 0.55 });
    const heavy = new THREE.MeshStandardMaterial({ color: "#3a4045", roughness: 0.5, metalness: 0.7 });
    const warn = new THREE.MeshStandardMaterial({ color: "#d7a71f", roughness: 0.7 });
    const rodMat = new THREE.MeshStandardMaterial({ color: "#b8bec4", roughness: 0.22, metalness: 0.85 });

    const { innerW: iw, innerD: id, wallH: h, plateT: t } = dim;
    this.innerW = iw;
    const g = new THREE.Group(); g.position.set(rect.x, 0, rect.z); scene.add(g);

    // Mulde: Boden und vier Wände, oben offen
    const floor = new THREE.Mesh(new THREE.BoxGeometry(iw + 0.7, 0.3, id + 0.7), steel);
    floor.position.y = 0.15; floor.receiveShadow = true; g.add(floor);
    const walls: [number, number, number, number][] = [
      [0, -(id / 2 + 0.175), iw + 0.7, 0.35],
      [0, id / 2 + 0.175, iw + 0.7, 0.35],
      [-(iw / 2 + 0.175), 0, 0.35, id],
      [iw / 2 + 0.175, 0, 0.35, id],
    ];
    for (const [wx, wz, sx, sz] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), steel);
      wall.position.set(wx, h / 2 + 0.3, wz); wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    }
    // Warnstreifen auf der Muldenkante zur Platzseite
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(iw + 0.7, 0.16, 0.38), warn);
    stripe.position.set(0, h + 0.34, -(id / 2 + 0.175)); g.add(stripe);

    // Zwei längs liegende Deckelplatten samt Scharnier, Rippen, Winkelhebel und Hubzylindern
    const reach = id / 2 + 0.14, lidLen = iw + 0.25;
    const leverX = [-iw / 2 + 1.0, iw / 2 - 1.0];
    for (const side of [-1, 1] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(0, h - 0.1 + 0.3, side * (id / 2 + 0.12));
      const plate = new THREE.Mesh(new THREE.BoxGeometry(lidLen, t, reach), heavy);
      plate.position.z = -side * (reach / 2); plate.castShadow = true; pivot.add(plate);
      for (const rx of [-2.2, -0.8, 0.8, 2.2]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, reach - 0.25), warn);
        rib.position.set(rx, t / 2 + 0.05, -side * (reach / 2)); pivot.add(rib);
      }
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, lidLen + 0.2, 10), warn);
      hinge.rotation.z = Math.PI / 2; pivot.add(hinge);
      for (const lx of leverX) {
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.86, 0.26), warn);
        lever.position.set(lx, 0.34, side * 0.2); lever.rotation.x = -side * 0.42; lever.castShadow = true; pivot.add(lever);
        const anchor = new THREE.Object3D(); anchor.position.set(lx, 0.68, side * 0.42); pivot.add(anchor);
        const base = new THREE.Object3D(); base.position.set(lx, 0.6, side * (id / 2 + 1.25)); g.add(base);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.2, 0.44), steel);
        stand.position.copy(base.position); stand.position.y = 0.6; stand.castShadow = true; g.add(stand);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1, 12), heavy);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1, 10), rodMat);
        barrel.castShadow = true; g.add(barrel); g.add(rod);
        this.linkages.push({ a: base, b: anchor, barrel, rod, barrelLen: 1.1 });
      }
      g.add(pivot); this.lids.push(pivot);
    }

    // Pressstempel und sein Zylinderbock an der rechten Stirnseite
    this.ram = new THREE.Mesh(new THREE.BoxGeometry(t * 1.4, h - 0.1, id - 0.1), heavy);
    this.ram.position.set(iw / 2 - 0.35, h / 2 + 0.3, 0); this.ram.castShadow = true; g.add(this.ram);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, id), warn);
    housing.position.set(iw / 2 + 0.9, h / 2 + 0.4, 0); housing.castShadow = true; g.add(housing);

    this.lampMat = new THREE.MeshStandardMaterial({ color: "#3a5c3a", emissive: "#000000" });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.lampMat);
    lamp.position.set(iw / 2 + 0.9, h + 1.1, 0); g.add(lamp);
  }

  update(lidAngle: number, ramX: number, running: boolean, blocked: boolean): void {
    this.lids[0]!.rotation.x = -lidAngle;
    this.lids[1]!.rotation.x = lidAngle;
    this.ram.position.x = ramX;
    void this.innerW;
    for (const l of this.linkages) {
      l.a.getWorldPosition(this.a); l.b.getWorldPosition(this.b);
      this.dir.copy(this.b).sub(this.a);
      const dist = Math.max(this.dir.length(), 0.25);
      this.dir.normalize();
      this.q.setFromUnitVectors(PressView.UP, this.dir);
      l.barrel.position.copy(this.a).addScaledVector(this.dir, l.barrelLen / 2);
      l.barrel.quaternion.copy(this.q); l.barrel.scale.set(1, l.barrelLen, 1);
      const rodLen = Math.max(dist - l.barrelLen + 0.12, 0.12);
      l.rod.position.copy(this.b).addScaledVector(this.dir, -rodLen / 2);
      l.rod.quaternion.copy(this.q); l.rod.scale.set(1, rodLen, 1);
    }
    const col = running ? "#c8a13a" : blocked ? "#a83232" : "#3a5c3a";
    if (this.lampMat.color.getHexString() !== col.slice(1)) {
      this.lampMat.color.set(col);
      this.lampMat.emissive.set(running || blocked ? col : "#000000");
    }
  }
}
