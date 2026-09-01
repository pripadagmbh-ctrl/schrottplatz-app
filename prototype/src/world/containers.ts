import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { getMaterial } from "../materials/catalog";
import { computePurity, containerValue } from "../materials/purity";
import type { ItemManager, ScrapItem } from "./scrapItems";
import type { EventBus } from "../core/events";

/**
 * Sortierziele (Design-Pivot 2026-08-27): offene **Haufen-Zonen** für die großen
 * Fraktionen (Schrott einfach draufwerfen) + 2 Kleinboxen für Kupfer/Kabel.
 * Zuordnung per Zonen-Zählung: Ein Item „zählt", sobald es (nicht gegriffen)
 * in der Zone liegt — Herausgreifen macht die Zählung rückgängig (Nachsortieren).
 */

interface ContainerConfig {
  id: string;
  fractionId: string;
  label: string;
  /** pile = offener Haufen · bay = Betonlego-Box (3 Wände, vorn offen) · box = Kleinbox */
  kind: "pile" | "bay" | "box";
  x: number;
  z: number;
  /** Zonenmaße [Breite, Tiefe, Wandhöhe] */
  size: [number, number, number];
}

/**
 * Platzanordnung (Design 2026-08-29): Der Bagger steht auf (0, −1) im Zentrum.
 * LINKS (Westen) der riesige Stahlschrott-Haufen, RECHTS (Osten) die Boxen in
 * einer Reihe — alles im Schwenkbereich, damit kaum gefahren werden muss.
 */
const CONFIGS: ContainerConfig[] = [
  // Riesiger Stahlhaufen direkt links neben dem Bagger (Guss läuft mit)
  { id: "c_steel", fractionId: "steel", label: "STAHLSCHROTT", kind: "pile", x: -9, z: 1, size: [11, 12, 0] },
  // Boxenreihe rechts, von Süd nach Nord aufgereiht
  { id: "c_contaminant", fractionId: "contaminant", label: "STÖRSTOFF", kind: "pile", x: -6, z: -7, size: [3, 3, 0] },
  // Vier Betonlego-Mulden in einer Reihe, Öffnung zeigt nach Westen zum Bagger
  // Nach Norden gerückt: die westliche Öffnung darf nicht von der Presse
  // versperrt werden
  { id: "c_va", fractionId: "va", label: "EDELSTAHL VA", kind: "bay", x: 5.9, z: -4.4, size: [4.6, 4.6, 2.5] },
  { id: "c_alu", fractionId: "alu", label: "ALU", kind: "bay", x: 5.9, z: 0.7, size: [4.6, 4.6, 2.5] },
  { id: "c_copper", fractionId: "copper", label: "KUPFER/MS", kind: "bay", x: 5.9, z: 5.8, size: [4.6, 4.6, 2.5] },
  { id: "c_cable", fractionId: "cable", label: "KABEL", kind: "bay", x: 5.9, z: 10.9, size: [4.6, 4.6, 2.5] },
];

/** Fangbereich über einer Haufen-Zone (Zonen-Zählung + Ampel) */
const PILE_CATCH_HEIGHT = 2.4;

const WALL = 0.1;

export type AmpelState = "green" | "yellow" | "red";

class GameContainer {
  contentKg = 0;
  contaminationKg = 0;
  readonly itemIds = new Set<string>();
  private label: ContainerLabel;

  /** Schild nach Entfernung zur Kamera ein- oder ausblenden. */
  updateLabelDistance(camPos: THREE.Vector3): void {
    this.label.updateDistance(camPos);
  }

  constructor(
    readonly cfg: ContainerConfig,
    scene: THREE.Scene,
    world: RAPIER.World
  ) {
    const [w, d, h] = cfg.size;
    const fraction = getMaterial(cfg.fractionId);
    const gray = new THREE.MeshStandardMaterial({ color: 0x70757a, roughness: 0.8, metalness: 0.3 });
    const band = new THREE.MeshStandardMaterial({ color: fraction.color, roughness: 0.7 });

    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    scene.add(group);

    if (cfg.kind === "bay") {
      // Betonlego-Box (Design-Wunsch 2026-08-27): drei Wände aus gestapelten
      // Beton-Legosteinen mit Noppen, vorn offen — wie auf echten Schrottplätzen.
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({
          color: fraction.color,
          roughness: 1,
          transparent: true,
          opacity: 0.24,
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.02;
      group.add(ground);

      // Flachere Betonsteine, dafür eine Reihe mehr: wirkt weniger klotzig
      const BLOCK_L = 1.5;
      const BLOCK_H = 0.5;
      const BLOCK_T = 0.55;
      const ROWS = 5;
      const concrete = [0x9b9b94, 0x92928b, 0xa4a49c].map(
        (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 })
      );
      const blockGeo = new THREE.BoxGeometry(BLOCK_L, BLOCK_H, BLOCK_T);
      const studGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10);
      let bi = 0;
      const placeBlock = (x: number, y: number, z: number, alongX: boolean): void => {
        const b = new THREE.Mesh(blockGeo, concrete[bi++ % 3]);
        b.position.set(x, y, z);
        if (!alongX) b.rotation.y = Math.PI / 2;
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        for (const s of [-0.4, 0.4]) {
          const stud = new THREE.Mesh(studGeo, b.material);
          stud.position.set(alongX ? s : 0, BLOCK_H / 2 + 0.045, alongX ? 0 : s);
          b.add(stud);
        }
      };
      // Wände: Ostseite + Nord + Süd. Die WESTseite bleibt offen — dorthin
      // schaut der Bagger, von dort wird eingefüllt und ausgeräumt.
      for (let r = 0; r < ROWS; r++) {
        const y = BLOCK_H / 2 + r * BLOCK_H;
        const off = (r % 2) * (BLOCK_L / 2);
        for (let x = -w / 2 + BLOCK_L / 2 - off; x < w / 2 + 0.4; x += BLOCK_L) {
          placeBlock(x, y, d / 2 + BLOCK_T / 2, true); // Nordwand
          placeBlock(x, y, -(d / 2 + BLOCK_T / 2), true); // Südwand
        }
        for (let z = -d / 2 + BLOCK_L / 2 - off; z < d / 2 + 0.4; z += BLOCK_L) {
          placeBlock(w / 2 + BLOCK_T / 2, y, z, false); // Ostwand
        }
      }
      // Kollider: drei Wandquader (Ostseite offen)
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      const wallH = ROWS * BLOCK_H;
      for (const sz of [-1, 1]) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(w / 2 + BLOCK_T, wallH / 2, BLOCK_T / 2).setTranslation(
            0,
            wallH / 2,
            sz * (d / 2 + BLOCK_T / 2)
          ),
          body
        );
      }
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(BLOCK_T / 2, wallH / 2, d / 2 + BLOCK_T).setTranslation(
          w / 2 + BLOCK_T / 2,
          wallH / 2,
          0
        ),
        body
      );
      this.label = new ContainerLabel(cfg.label, fraction.color);
      // Farbband oben auf den Wänden: Die Fraktion soll auch ohne Aufschrift
      // erkennbar sein — vier gleiche graue Kästen ließen sich nicht
      // auseinanderhalten.
      const bandMat = new THREE.MeshStandardMaterial({
        color: fraction.color,
        roughness: 0.85,
        metalness: 0.1,
      });
      for (const [bx, bz, bw, bd] of [
        [0, -d / 2 - BLOCK_T / 2, w + 2 * BLOCK_T, BLOCK_T],
        [0, d / 2 + BLOCK_T / 2, w + 2 * BLOCK_T, BLOCK_T],
        [w / 2 + BLOCK_T / 2, 0, BLOCK_T, d + 2 * BLOCK_T],
      ] as Array<[number, number, number, number]>) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.16, bd), bandMat);
        band.position.set(bx, wallH + 0.08, bz);
        group.add(band);
      }
      // Schild am hinteren (geschlossenen) Ende — so steht es nicht im Blickfeld
      this.label.sprite.position.set(cfg.x + w / 2 + 0.6, wallH + 1.1, cfg.z);
    } else if (cfg.kind === "pile") {
      // Offene Haufen-Zone: getönte Bodenfläche + farbiger Rahmen, keine Wände
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({
          color: fraction.color,
          roughness: 1,
          transparent: true,
          opacity: 0.28,
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0.02;
      group.add(ground);
      const frames: Array<[number, number, number, number]> = [
        [0, -d / 2, w + 0.14, 0.14],
        [0, d / 2, w + 0.14, 0.14],
        [-w / 2, 0, 0.14, d],
        [w / 2, 0, 0.14, d],
      ];
      for (const [fx, fz, sx, sz] of frames) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), band);
        strip.position.set(fx, 0.03, fz);
        group.add(strip);
      }
      // Schild an Pfosten hinter der Zone
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), gray);
      pole.position.set(0, 1.15, d / 2 + 0.3);
      pole.castShadow = true;
      group.add(pole);
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, 2.9, cfg.z + d / 2 + 0.3);
    } else {
      // Kleinbox mit Wänden + Kollidern (Kupfer/Kabel)
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * WALL, WALL, d + 2 * WALL), gray);
      floor.position.y = WALL / 2;
      floor.receiveShadow = true;
      group.add(floor);
      const walls: Array<[number, number, number, number]> = [
        [0, -(d / 2 + WALL / 2), w + 2 * WALL, WALL],
        [0, d / 2 + WALL / 2, w + 2 * WALL, WALL],
        [-(w / 2 + WALL / 2), 0, WALL, d],
        [w / 2 + WALL / 2, 0, WALL, d],
      ];
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cfg.x, 0, cfg.z)
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid((w + 2 * WALL) / 2, WALL / 2, (d + 2 * WALL) / 2).setTranslation(0, WALL / 2, 0),
        body
      );
      for (const [wx, wz, sx, sz] of walls) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), gray);
        wall.position.set(wx, h / 2, wz);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
        const bandMesh = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.02, 0.22, sz + 0.02), band);
        bandMesh.position.set(wx, h - 0.11, wz);
        group.add(bandMesh);
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(sx / 2, h / 2, sz / 2).setTranslation(wx, h / 2, wz),
          body
        );
      }
      this.label = new ContainerLabel(cfg.label, fraction.color);
      this.label.sprite.position.set(cfg.x, h + 1.15, cfg.z);
    }
    scene.add(this.label.sprite);
    this.refreshLabel();
  }

  /** Liegt der Punkt in der Zone (Haufen/Bay: bis Fanghöhe; Box: bis knapp überm Rand)? */
  containsPoint(p: { x: number; y: number; z: number }, marginXZ = 0, marginY = 0.4): boolean {
    const [w, d, h] = this.cfg.size;
    const open = this.cfg.kind !== "box";
    const maxY = open ? PILE_CATCH_HEIGHT : h + marginY;
    const mXZ = marginXZ + (this.cfg.kind === "pile" ? 0.35 : 0);
    return (
      Math.abs(p.x - this.cfg.x) < w / 2 + mXZ &&
      Math.abs(p.z - this.cfg.z) < d / 2 + mXZ &&
      p.y < maxY
    );
  }

  /** Für die Abwurf-Ampel: großzügigere XZ-Zone, Höhe egal. */
  isOverhead(x: number, z: number): boolean {
    const [w, d] = this.cfg.size;
    return Math.abs(x - this.cfg.x) < w / 2 + 0.35 && Math.abs(z - this.cfg.z) < d / 2 + 0.35;
  }

  get purity(): number {
    return computePurity(this.contentKg, this.contaminationKg);
  }

  get value(): number {
    return containerValue(getMaterial(this.cfg.fractionId), this.contentKg, this.contaminationKg);
  }

  setLabelVisible(v: boolean): void {
    this.label.sprite.visible = v;
  }

  /** Nach dem Verkauf: Aggregat leeren (Items wurden bereits entfernt). */
  clearAfterSale(): void {
    this.itemIds.clear();
    this.contentKg = 0;
    this.contaminationKg = 0;
    this.refreshLabel();
  }

  refreshLabel(ampel: AmpelState | null = null): void {
    this.label.draw(
      [
        this.cfg.label,
        `${this.contentKg.toFixed(0)} kg · ${(this.purity * 100).toFixed(0)} %`,
        `≈ ${this.value.toFixed(0)} €`,
      ],
      ampel
    );
  }
}

/** World-Space-Label als Canvas-Sprite (Name, Füllung, Reinheit, Erlös + Ampelrahmen). */
class ContainerLabel {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement("canvas");
  private texture: THREE.CanvasTexture;

  constructor(_title: string, private fractionColor: number) {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.texture = new THREE.CanvasTexture(this.canvas);
    // Tiefentest an: das Schild gehört zur Szene und verschwindet hinter
    // Bagger oder Haufen. Ohne ihn schwebte es über allem und beherrschte
    // jede Einstellung (Design-Fix 29.08.2026).
    const mat = new THREE.SpriteMaterial({ map: this.texture, transparent: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(2.3, 1.15, 1);
  }

  /**
   * Sichtbarkeit nach Entfernung. Aus der Nähe wächst ein Sprite ins Bild,
   * bis es alles verdeckt — dort wird ausgeblendet, denn wer davorsteht,
   * braucht die Aufschrift nicht mehr. Von weit weg ist sie ohnehin nicht
   * zu lesen.
   */
  updateDistance(camPos: THREE.Vector3): void {
    const d = this.sprite.position.distanceTo(camPos);
    const nah = THREE.MathUtils.smoothstep(d, 4.5, 9);
    const fern = 1 - THREE.MathUtils.smoothstep(d, 38, 52);
    const a = Math.min(nah, fern);
    (this.sprite.material as THREE.SpriteMaterial).opacity = a;
    this.sprite.visible = a > 0.02;
  }

  draw(lines: string[], ampel: AmpelState | null): void {
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = "rgba(20,22,24,0.78)";
    ctx.fillRect(0, 0, 256, 128);
    const border =
      ampel === "green" ? "#35c24d" : ampel === "yellow" ? "#e0b528" : ampel === "red" ? "#d84a38" :
      "#" + this.fractionColor.toString(16).padStart(6, "0");
    ctx.strokeStyle = border;
    ctx.lineWidth = ampel ? 12 : 6;
    ctx.strokeRect(0, 0, 256, 128);
    ctx.fillStyle = "#e8e8e4";
    ctx.font = "bold 30px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(lines[0], 128, 42);
    ctx.font = "24px Consolas, monospace";
    ctx.fillText(lines[1], 128, 76);
    ctx.fillText(lines[2], 128, 108);
    this.texture.needsUpdate = true;
  }
}

export class ContainerManager {
  readonly containers: GameContainer[] = [];
  private hovered: GameContainer | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World, private bus: EventBus) {
    for (const cfg of CONFIGS) {
      this.containers.push(new GameContainer(cfg, scene, world));
    }
  }

  /**
   * Zonen-Zählung (alle ~10 Steps): Items den Containern zuordnen, Aggregate
   * neu berechnen, Enter/Leave-Events feuern. Gegriffene Items zählen nicht.
   */
  /** Schilder nach Entfernung ein- und ausblenden. Jedes Bild aufrufen. */
  updateLabels(camPos: THREE.Vector3): void {
    for (const c of this.containers) c.updateLabelDistance(camPos);
  }

  recount(itemManager: ItemManager, grippedBodies: Set<number>): void {
    const changes: Array<{ item: ScrapItem; from: string | null; to: string | null }> = [];
    for (const item of itemManager.items) {
      let to: string | null = null;
      if (!grippedBodies.has(item.body.handle)) {
        const p = item.body.translation();
        for (const c of this.containers) {
          if (c.containsPoint(p)) {
            to = c.cfg.id;
            break;
          }
        }
      }
      if (to !== item.containerId) {
        changes.push({ item, from: item.containerId, to });
        item.containerId = to;
      }
    }
    if (changes.length === 0) return;

    for (const c of this.containers) {
      c.itemIds.clear();
      c.contentKg = 0;
      c.contaminationKg = 0;
    }
    for (const item of itemManager.items) {
      if (!item.containerId) continue;
      const c = this.byId(item.containerId);
      c.itemIds.add(item.id);
      c.contentKg += item.massKg;
      if (item.materialId !== c.cfg.fractionId) c.contaminationKg += item.massKg;
    }
    for (const c of this.containers) c.refreshLabel(c === this.hovered ? this.hoverAmpel : null);

    for (const { item, from, to } of changes) {
      if (from) this.bus.emit("itemLeft", { itemId: item.id, containerId: from });
      if (to) {
        const c = this.byId(to);
        this.bus.emit("itemEntered", {
          itemId: item.id,
          materialId: item.materialId,
          containerId: to,
          correct: item.materialId === c.cfg.fractionId,
        });
      }
    }
  }

  private hoverAmpel: AmpelState = "green";

  /**
   * Abwurf-Ampel (Briefing Kap. 5.3): Container unterm Greifer + Bewertung der
   * getragenen Ladung. Grün = alles richtig, Gelb = gemischt, Rot = alles falsch.
   */
  updateHover(sensorX: number, sensorZ: number, carriedMaterialIds: string[]): {
    container: string;
    ampel: AmpelState;
  } | null {
    let over: GameContainer | null = null;
    if (carriedMaterialIds.length > 0) {
      over = this.containers.find((c) => c.isOverhead(sensorX, sensorZ)) ?? null;
    }
    let result: { container: string; ampel: AmpelState } | null = null;
    if (over) {
      const correct = carriedMaterialIds.filter((m) => m === over.cfg.fractionId).length;
      const ampel: AmpelState =
        correct === carriedMaterialIds.length ? "green" : correct > 0 ? "yellow" : "red";
      this.hoverAmpel = ampel;
      result = { container: over.cfg.label, ampel };
    }
    if (over !== this.hovered) {
      this.hovered?.refreshLabel(null);
      over?.refreshLabel(this.hoverAmpel);
      this.hovered = over;
    } else if (over) {
      over.refreshLabel(this.hoverAmpel);
    }
    return result;
  }

  /** Zonen-Schilder ein-/ausblenden (Taste M bzw. Touch-Knopf). */
  setLabelsVisible(v: boolean): void {
    for (const c of this.containers) c.setLabelVisible(v);
  }

  byId(id: string): GameContainer {
    const c = this.containers.find((c) => c.cfg.id === id);
    if (!c) throw new Error(`Unbekannter Container: ${id}`);
    return c;
  }

  /** Summe der prognostizierten Erlöse — die „Sortierwert"-Anzeige im HUD. */
  totalValue(): number {
    return this.containers.reduce((s, c) => s + c.value, 0);
  }
}
