import * as THREE from "three";

/**
 * Orientierungstexte auf dem Platz (Briefing Kap. 5.3).
 *
 * Wer neu auf dem Hof ist, weiß nicht, wo abgeladen, gepresst oder verladen
 * wird. Diese Schilder sagen es. Sie hängen an derselben Umschaltung wie die
 * Boxenbeschriftung (Taste M), damit der Platz für ein sauberes Bild ohne
 * jede Beschriftung gezeigt werden kann.
 */

interface SignSpec {
  text: string;
  hint: string;
  x: number;
  z: number;
  y?: number;
  /** Drehung um die Hochachse, damit die Schrift zum Bagger zeigt */
  rot?: number;
}

/** Die Beschriftungen. Positionen folgen dem Platzplan aus yard.ts. */
const SIGNS: SignSpec[] = [
  { text: "STAHLSCHROTT", hint: "alles Eisen — hierher kippen die Kipper", x: -9, z: 8.5, rot: 0 },
  { text: "ANNAHME", hint: "Pritschen laden hier ab", x: 0, z: 12.5, rot: 0 },
  { text: "BOXEN", hint: "Alu · Kupfer · VA · Kabel", x: 9.5, z: 6.5, rot: -0.6 },
  { text: "SCHERE / PRESSE", hint: "Mischschrott pressen (Taste B)", x: -4.6, z: -13.4, rot: Math.PI },
  { text: "VERLADUNG", hint: "Abholer beladen (Taste V)", x: -7.5, z: 13.5, rot: -0.4 },
  { text: "WAAGE", hint: "brutto rein, tara raus", x: -20, z: 20, rot: 0.5 },
  { text: "EINFAHRT", hint: "hier kommen die Kunden", x: -26, z: 27, rot: 0.4 },
];

export class Signage {
  private group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    for (const s of SIGNS) this.group.add(this.makeSign(s));
    scene.add(this.group);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  private makeSign(s: SignSpec): THREE.Object3D {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1b2024";
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = "#f0b429";
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, 502, 150);
    ctx.fillStyle = "#f0b429";
    ctx.font = "bold 54px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(s.text, 256, 68);
    ctx.fillStyle = "#c8ced2";
    ctx.font = "26px Consolas, monospace";
    ctx.fillText(s.hint, 256, 112);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Zwei Flächen Rücken an Rücken statt einer doppelseitigen: sonst liest
    // sich die Rückseite spiegelverkehrt. Selbstleuchtend, damit die Schrift
    // auch im Schatten lesbar bleibt.
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const y = s.y ?? 2.4;
    const board = new THREE.Group();
    for (const rot of [0, Math.PI]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1), mat);
      face.rotation.y = rot;
      board.add(face);
    }
    board.position.set(0, y, 0);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, y, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a5157, roughness: 0.8 })
    );
    post.position.y = y / 2;

    const g = new THREE.Group();
    g.add(board, post);
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.rot ?? 0;
    return g;
  }
}
