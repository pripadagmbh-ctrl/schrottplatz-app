import * as THREE from "three";
import type { Rect } from "@/data/types";

/**
 * Pressenstation (M5b, Briefing Kap. 12): Grundplatte mit zwei Seitenwangen und einem Stempel, der beim Auslösen
 * herunterfährt. Der Stempel ist das einzige bewegte Teil — daran sieht man ohne HUD, dass die Presse arbeitet.
 * Reine Anzeige: die Simulation kennt diese Klasse nicht, sie bekommt nur den Fortschritt (0…1) gereicht.
 */
export class PressView {
  private readonly ram: THREE.Mesh;
  private readonly lamp: THREE.Mesh;
  private readonly lampMat: THREE.MeshStandardMaterial;
  private readonly ramTop: number;
  private readonly ramBottom: number;

  constructor(scene: THREE.Scene, rect: Rect) {
    // Maschinenfarbe statt Betongrau: zwischen den grauen Mulden war die Presse nicht als Station zu erkennen
    // (Patrick 09.09.: „ich sehe keine Presse"). Briefing Kap. 16 — Farbe trennt Stationen von Lagerflaechen.
    const steel = new THREE.MeshStandardMaterial({ color: "#c8892a", roughness: 0.55, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: "#3b3f44", roughness: 0.8, metalness: 0.3 });
    const g = new THREE.Group(); g.position.set(rect.x, 0, rect.z); scene.add(g);

    const w = rect.hw * 2, d = rect.hd * 2;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), dark);
    bed.position.y = 0.175; bed.receiveShadow = true; g.add(bed);

    // Wangen links und rechts, dazwischen faehrt der Stempel
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, d), steel);
      cheek.position.set(sx * (rect.hw - 0.22), 1.6, 0); cheek.castShadow = true; g.add(cheek);
    }
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d * 0.6), steel);
    yoke.position.y = 3.4; yoke.castShadow = true; g.add(yoke);

    this.ramTop = 2.7; this.ramBottom = 0.6;
    this.ram = new THREE.Mesh(new THREE.BoxGeometry(w - 0.9, 0.55, d - 0.5), dark);
    this.ram.position.y = this.ramTop; this.ram.castShadow = true; g.add(this.ram);

    this.lampMat = new THREE.MeshStandardMaterial({ color: "#3a5c3a", emissive: "#000000" });
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.lampMat);
    this.lamp.position.set(rect.hw - 0.22, 3.75, -rect.hd + 0.35); g.add(this.lamp);
  }

  /**
   * @param progress 0…1 während des Pressens
   * @param running läuft gerade
   * @param blocked Batterie/Motor noch drin — Warnlampe rot
   */
  update(progress: number, running: boolean, blocked: boolean): void {
    this.ram.position.y = running ? this.ramTop - (this.ramTop - this.ramBottom) * Math.min(1, progress) : this.ramTop;
    const col = running ? "#c8a13a" : blocked ? "#a83232" : "#3a5c3a";
    if (this.lampMat.color.getHexString() !== col.slice(1)) {
      this.lampMat.color.set(col);
      this.lampMat.emissive.set(running || blocked ? col : "#000000");
    }
    void this.lamp;
  }
}
