import * as THREE from "three";
import type { LevelDef } from "@/data/types";

/**
 * Leere Szene für M0: Boden in Platzgröße, Himmelsverlauf als Hintergrundfarbe, Sonne + Hemisphäre,
 * ACES-Tone-Mapping (Stilguide 1.4). Draw-Call- und Dreieckszähler fürs Overlay.
 * Ab M2: ViewRegistry, Instancing, Interpolation, gemergte Statik.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  drawCalls = 0; triangles = 0;
  private readonly ground: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement, level: LevelDef, pixelRatioMax: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioMax));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = false; // M0: keine Schatten; kommt mit dem Bagger in M2

    this.scene.background = new THREE.Color("#cfd9e0");
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.camera.position.set(0, 12, -22);
    this.camera.lookAt(0, 0, 0);

    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(20, 30, -10);
    this.scene.add(sun, new THREE.HemisphereLight("#dde6ec", "#6b6257", 1.0));

    const groundGeo = new THREE.PlaneGeometry(level.size.w, level.size.d);
    const groundMat = new THREE.MeshStandardMaterial({ color: level.ground.color, roughness: 0.95 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    // Zonen als flache Markierungen — reine Orientierung, damit man auf dem iPad sieht, dass level_yard.json greift.
    const zoneMat = new THREE.MeshBasicMaterial({ color: "#9c9a92", transparent: true, opacity: 0.5 });
    for (const z of level.zones) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(z.rect.hw * 2, z.rect.hd * 2), zoneMat);
      m.rotation.x = -Math.PI / 2; m.position.set(z.rect.x, 0.01, z.rect.z);
      this.scene.add(m);
    }
    for (const c of level.containers.filter((c) => c.stage === 1)) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(c.rect.hw * 2, c.wallHeight, c.rect.hd * 2), new THREE.MeshStandardMaterial({ color: "#9c9a92" }));
      m.position.set(c.rect.x, c.wallHeight / 2, c.rect.z);
      this.scene.add(m);
    }
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(_alpha: number, _frameDt: number): void {
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = this.renderer.info.render.calls;
    this.triangles = this.renderer.info.render.triangles;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material; if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose(); }
    });
    this.renderer.dispose();
  }
}
