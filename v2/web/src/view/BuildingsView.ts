import * as THREE from "three";
import type { LevelDef } from "@/data/types";

/**
 * Die Betriebsgebäude an der Waage (Roadmap 3.6).
 *
 * Aus dem Wiegehäuschen wird mit dem Ausbau ein Büro, später kommt die Halle
 * dazu. Welche Gebäude zu welcher Stufe gehören, steht in `level_yard.json`
 * (`buildings[].stage`) — die Ansicht zeigt schlicht alles bis zur erreichten
 * Stufe. Die Modelle sind bewusst einfach gehalten: Sockel, Wände, Dach,
 * Fenster zum Platz. Ein Hero-Asset kommt erst mit dem Stilpass (Phase 4).
 */
export class BuildingsView {
  private readonly gruppen = new Map<string, THREE.Group>();
  private stufe = -1;

  constructor(scene: THREE.Scene, level: LevelDef) {
    for (const b of level.buildings) {
      const g = b.model === "hall" ? this.halle(b.rect.hw, b.rect.hd, b.height) : this.haus(b.rect.hw, b.rect.hd, b.height, b.model === "office");
      g.position.set(b.rect.x, 0, b.rect.z);
      g.visible = false;
      g.userData["stage"] = b.stage;
      scene.add(g);
      this.gruppen.set(b.id, g);
    }
  }

  /** Sichtbarkeit an die erreichte Ausbaustufe anpassen. */
  setStage(stage: number): void {
    if (stage === this.stufe) return;
    this.stufe = stage;
    for (const g of this.gruppen.values()) {
      const s = g.userData["stage"] as number;
      // Das Häuschen weicht dem Büro; alles andere bleibt stehen, sobald es steht.
      g.visible = s === 1 ? stage < 2 : s <= stage;
    }
  }

  /** Flachbau mit Sockel, Fensterband und flachem Dach. */
  private haus(hw: number, hd: number, h: number, buero: boolean): THREE.Group {
    const g = new THREE.Group();
    const wand = new THREE.MeshStandardMaterial({ color: "#b9c0c4", roughness: 0.85, flatShading: true });
    const sockel = new THREE.MeshStandardMaterial({ color: "#6b7176", roughness: 0.95, flatShading: true });
    const dach = new THREE.MeshStandardMaterial({ color: "#3c4247", roughness: 0.8, flatShading: true });
    const glas = new THREE.MeshStandardMaterial({ color: "#cfe6ef", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.5 });

    const s = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.3, 0.35, hd * 2 + 0.3), sockel);
    s.position.y = 0.17; s.receiveShadow = true; g.add(s);

    const k = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, hd * 2), wand);
    k.position.y = h / 2 + 0.3; k.castShadow = true; k.receiveShadow = true; g.add(k);

    const d = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.5, 0.22, hd * 2 + 0.5), dach);
    d.position.y = h + 0.4; d.castShadow = true; g.add(d);

    // Fenster zur Platzseite (nach +x, dort steht der Bagger)
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.34, hd * (buero ? 1.5 : 1.0)), glas);
    fb.position.set(hw + 0.02, h * 0.62, 0); g.add(fb);
    if (buero) {
      // zweites Fensterband zur Einfahrt hin
      const f2 = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.2, h * 0.3, 0.08), glas);
      f2.position.set(0, h * 0.62, hd + 0.02); g.add(f2);
    }
    return g;
  }

  /** Offene Halle: drei Wände, Pultdach, Torrahmen zur Platzseite. */
  private halle(hw: number, hd: number, h: number): THREE.Group {
    const g = new THREE.Group();
    const blech = new THREE.MeshStandardMaterial({ color: "#8d949a", roughness: 0.7, metalness: 0.25, flatShading: true });
    const stahl = new THREE.MeshStandardMaterial({ color: "#4a5157", roughness: 0.6, metalness: 0.5, flatShading: true });
    const dach = new THREE.MeshStandardMaterial({ color: "#3c4247", roughness: 0.8, flatShading: true });

    const rueck = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, hd * 2), blech);
    rueck.position.set(-hw, h / 2, 0); rueck.castShadow = true; g.add(rueck);
    for (const sz of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, 0.2), blech);
      seite.position.set(0, h / 2, sz * hd); seite.castShadow = true; g.add(seite);
    }
    const d = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.6, 0.24, hd * 2 + 0.6), dach);
    d.position.set(0, h + 0.12, 0); d.rotation.z = -0.05; d.castShadow = true; g.add(d);
    // Torrahmen an der offenen Seite
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), stahl);
      p.position.set(hw, h / 2, sz * (hd - 0.4)); g.add(p);
    }
    const sturz = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, hd * 2), stahl);
    sturz.position.set(hw, h - 0.3, 0); g.add(sturz);
    return g;
  }

  dispose(): void {
    for (const g of this.gruppen.values()) {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      g.removeFromParent();
    }
    this.gruppen.clear();
  }
}
