import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { ItemManager } from "./scrapItems";

/**
 * Platzpersonal (Design 2026-08-29):
 * - Mario Baer sitzt im Wiegehäuschen an der Brückenwaage.
 * - Janine Prison gibt in der Kaffeebude Kaffee an die Händler aus.
 * - Lambert Prison ist Platzwart: Er weist ankommende LKW ein und räumt
 *   zwischendurch herumliegende Kleinteile auf.
 * Alle Figuren sind stilisierte Low-Poly-Figuren aus runden Grundformen.
 */

export interface PersonColors {
  shirt: number;
  trousers: number;
  hair: number;
  skin?: number;
}

interface PersonParts {
  group: THREE.Group;
  armLeft: THREE.Mesh;
  armRight: THREE.Mesh;
  legLeft: THREE.Mesh;
  legRight: THREE.Mesh;
}

/** Stehende Figur, Ursprung an den Füßen. */
export function buildPerson(colors: PersonColors): PersonParts {
  const skin = new THREE.MeshStandardMaterial({
    color: colors.skin ?? 0xe3b18c,
    roughness: 0.8,
  });
  const shirt = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.85 });
  const trousers = new THREE.MeshStandardMaterial({ color: colors.trousers, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: colors.hair, roughness: 0.95 });

  const group = new THREE.Group();
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // Beine (Drehpunkt oben, damit sie beim Laufen pendeln können)
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.4, 4, 10);
  legGeo.translate(0, -0.25, 0);
  const legLeft = add(legGeo, trousers, -0.1, 0.78, 0);
  const legRight = add(legGeo.clone(), trousers, 0.1, 0.78, 0);
  // Rumpf + Schultern
  add(new THREE.CapsuleGeometry(0.16, 0.32, 4, 12), shirt, 0, 1.06, 0);
  add(new THREE.SphereGeometry(0.17, 12, 10), shirt, 0, 1.22, 0);
  // Arme (Drehpunkt an der Schulter)
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.38, 4, 10);
  armGeo.translate(0, -0.24, 0);
  const armLeft = add(armGeo, shirt, -0.22, 1.24, 0);
  const armRight = add(armGeo.clone(), shirt, 0.22, 1.24, 0);
  // Hals, Kopf, Haare
  add(new THREE.CapsuleGeometry(0.05, 0.06, 4, 10), skin, 0, 1.38, 0);
  const head = add(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 1.52, 0);
  head.scale.set(1, 1.12, 1.02);
  const cap = add(new THREE.SphereGeometry(0.122, 14, 12), hair, 0, 1.55, -0.01);
  cap.scale.set(1, 0.95, 1.02);

  return { group, armLeft, armRight, legLeft, legRight };
}

/** Kleines Häuschen mit Fenster — für Waage und Kaffeebude. */
function buildHut(
  scene: THREE.Scene,
  pos: THREE.Vector3,
  rotY: number,
  wallColor: number,
  sign: string,
  signColor: string,
  width = 2.6,
  world?: RAPIER.World
): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos);
  g.rotation.y = rotY;
  scene.add(g);
  // Gebäude sind physische Hindernisse — nichts darf hindurchfahren
  if (world) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(pos.x, 0, pos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2 + 0.15, 1.35, 1.25).setTranslation(0, 1.35, 0),
      body
    );
  }

  const wall = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2f3336, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0xbfe3f0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.35,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, 2.5, 2.2), wall);
  body.position.y = 1.35;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.2, 2.5), trim);
  base.position.y = 0.1;
  g.add(base);
  // Flachdach mit Überstand
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.16, 2.9), trim);
  roof.position.y = 2.68;
  roof.castShadow = true;
  g.add(roof);
  // Schalterfenster nach vorn (+z)
  const win = new THREE.Mesh(new THREE.BoxGeometry(width - 0.8, 1.0, 0.06), glass);
  win.position.set(0, 1.6, 1.11);
  g.add(win);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(width - 0.6, 0.12, 0.3), trim);
  sill.position.set(0, 1.05, 1.18);
  g.add(sill);

  // Beschriftung über dem Fenster
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#15181a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = signColor;
  ctx.font = "bold 62px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sign, canvas.width / 2, canvas.height / 2 + 4);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.4, 0.55),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 0.6 })
  );
  board.position.set(0, 2.35, 1.13);
  g.add(board);
  return g;
}

type LambertState = "patrol" | "guide" | "fetch" | "carry";

export class StaffManager {
  private lambert: PersonParts;
  private lambertState: LambertState = "patrol";
  private lambertTarget = new THREE.Vector3();
  private walkPhase = 0;
  private waveT = 0;
  private carriedItemId: string | null = null;
  private stateT = 0;
  private patrolIdx = 0;

  /** Wegpunkte für die Runde des Platzwarts (SW) */
  private readonly patrol = [
    new THREE.Vector3(-4, 0, 12),
    new THREE.Vector3(9, 0, 6),
    new THREE.Vector3(10, 0, -4),
    new THREE.Vector3(-2, 0, -5),
  ];
  /** Einweisplatz neben dem Abkippplatz */
  private readonly guidePos = new THREE.Vector3(3.6, 0, 8.5);

  /** Baggerposition — Lambert hält Abstand vom Arbeitsbereich */
  getExcavatorPos: (() => THREE.Vector3) | null = null;
  /** Karossen — durch die läuft er nicht hindurch */
  getObstaclePositions: (() => THREE.Vector3[]) | null = null;

  constructor(
    scene: THREE.Scene,
    private items: ItemManager,
    weighPos: THREE.Vector3,
    world?: RAPIER.World,
    gateX = -22
  ) {
    // Wiegehäuschen links neben der Einfahrt, breit, Schalter zur Fahrspur
    const weighHut = buildHut(
      scene,
      new THREE.Vector3(weighPos.x + 4.6, 0, weighPos.z), // direkt an der Wiegeplatte
      Math.PI * -0.5, // Schalter zeigt zur Waage
      0xb9c0c4,
      "WAAGE",
      "#f0d060",
      4.4,
      world
    );
    const mario = buildPerson({ shirt: 0x2f5c8a, trousers: 0x2b2f33, hair: 0x39312b });
    mario.group.position.set(0, 0.45, 0.35); // sitzt am Schalter
    mario.group.rotation.y = Math.PI;
    mario.legLeft.visible = false;
    mario.legRight.visible = false;
    weighHut.add(mario.group);
    this.addNameTag(weighHut, "MARIO", 0, 2.0, 1.16);

    // Kaffeebude mit Janine Prison, an der Fahrspur zur Annahme
    const coffeeHut = buildHut(
      scene,
      // an einer ruhigen Ecke abseits der Fahrspur, Schalter zum Platz
      new THREE.Vector3(gateX - 6, 0, weighPos.z - 13),
      Math.PI * 0.75,
      0xc8743a,
      "KAFFEE",
      "#ffffff",
      4.0,
      world
    );
    const janine = buildPerson({ shirt: 0xe8e2d5, trousers: 0x4a3b52, hair: 0x8a5a2b });
    janine.group.position.set(0, 0.45, 0.35);
    janine.group.rotation.y = Math.PI;
    janine.legLeft.visible = false;
    janine.legRight.visible = false;
    coffeeHut.add(janine.group);
    this.addNameTag(coffeeHut, "JANINE", 0, 2.0, 1.16);
    // Klapptisch mit Kaffeekannen vor der Bude
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.08, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8d6a4a, roughness: 0.9 })
    );
    table.position.set(0, 0.95, 1.6);
    coffeeHut.add(table);
    for (const tx of [-0.5, -0.1, 0.35]) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 0.26, 10),
        new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.4, metalness: 0.5 })
      );
      pot.position.set(tx, 1.12, 1.6);
      coffeeHut.add(pot);
    }

    // Lambert Prison — Platzwart in Warnweste
    this.lambert = buildPerson({ shirt: 0xf2c018, trousers: 0x2f3a45, hair: 0x5a4632 });
    this.lambert.group.position.copy(this.patrol[0]);
    scene.add(this.lambert.group);
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.36, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xf2f26a, roughness: 0.7, emissive: 0x2a2a05 })
    );
    vest.position.set(0, 1.08, 0);
    this.lambert.group.add(vest);
    this.addNameTagToObject(this.lambert.group, "LAMBERT", 0, 2.1, 0);
    this.lambertTarget.copy(this.patrol[1]);
  }

  private addNameTag(parent: THREE.Object3D, text: string, x: number, y: number, z: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(20,24,26,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8e8e4";
    ctx.font = "bold 46px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.32),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 0.7 })
    );
    plate.position.set(x, y, z);
    parent.add(plate);
  }

  private addNameTagToObject(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(20,24,26,0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f2c018";
    ctx.font = "bold 44px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false })
    );
    sprite.scale.set(1.6, 0.3, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = 11;
    parent.add(sprite);
  }

  /**
   * @param truck Position des aktiven Fahrzeugs, wenn es gerade rangiert/ablädt
   */
  update(dt: number, truck: THREE.Vector3 | null): void {
    this.stateT += dt;
    const g = this.lambert.group;

    // Einweisen hat Vorrang: sobald ein LKW auf dem Platz rangiert
    if (truck && this.lambertState !== "carry") {
      if (this.lambertState !== "guide") {
        this.lambertState = "guide";
        this.stateT = 0;
      }
      this.lambertTarget.copy(this.guidePos);
    } else if (this.lambertState === "guide") {
      this.lambertState = "patrol";
      this.stateT = 0;
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
    }

    // Ziel erreicht?
    const toTarget = this.lambertTarget.clone().sub(g.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    const walking = dist > 0.4;

    if (walking) {
      toTarget.normalize();
      // Ausweichen: nicht in den Schwenkbereich des Baggers und nicht durch
      // Karossen hindurch — im Zweifel seitlich am Hindernis vorbei
      const step = this.avoid(g.position, toTarget);
      g.position.addScaledVector(step, 1.5 * dt); // 1,5 m/s (SW)
      g.rotation.y = Math.atan2(step.x, step.z);
      this.walkPhase += dt * 7;
      // Festgefahren? Wenn das Ausweichen ihn im Kreis schickt, kommt er dem
      // Ziel nicht näher — dann lieber aufgeben als endlos am Hindernis kleben.
      this.stuckT += dt;
      if (dist < this.bestDist - 0.3) {
        this.bestDist = dist;
        this.stuckT = 0;
      } else if (this.stuckT > 5) {
        this.giveUpTarget();
      }
    } else {
      this.walkPhase = 0;
      this.resetStuck();
      this.onArrived();
    }

    // Beine pendeln beim Laufen
    const swing = walking ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.lambert.legLeft.rotation.x = swing;
    this.lambert.legRight.rotation.x = -swing;

    // Arme: winken beim Einweisen, sonst mitschwingen
    if (this.lambertState === "guide" && !walking) {
      this.waveT += dt * 6;
      this.lambert.armLeft.rotation.x = -2.1 + Math.sin(this.waveT) * 0.5;
      this.lambert.armRight.rotation.x = -2.1 - Math.sin(this.waveT) * 0.5;
      if (truck) {
        const look = truck.clone().sub(g.position);
        g.rotation.y = Math.atan2(look.x, look.z);
      }
    } else if (this.lambertState === "carry") {
      this.lambert.armLeft.rotation.x = -1.5;
      this.lambert.armRight.rotation.x = -1.5;
    } else {
      this.lambert.armLeft.rotation.x = -swing * 0.6;
      this.lambert.armRight.rotation.x = swing * 0.6;
    }

    // Getragenes Teil mitführen
    if (this.carriedItemId) {
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid()) {
        it.body.setTranslation(
          { x: g.position.x, y: 1.15, z: g.position.z + 0.35 },
          true
        );
        it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      } else {
        this.carriedItemId = null;
      }
    }
  }

  private stuckT = 0;
  private bestDist = Infinity;

  private resetStuck(): void {
    this.stuckT = 0;
    this.bestDist = Infinity;
  }

  /**
   * Ziel aufgeben und weiterziehen. Ein aufgesammeltes Teil legt er dabei ab,
   * sonst würde er es ewig mit sich herumtragen.
   */
  private giveUpTarget(): void {
    this.resetStuck();
    this.carriedItemId = null;
    this.lambertState = "patrol";
    this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
    this.lambertTarget.copy(this.patrol[this.patrolIdx]);
  }

  /** Reaktion beim Erreichen des Ziels — je nach Aufgabe. */
  private onArrived(): void {
    if (this.lambertState === "guide") return;

    if (this.lambertState === "fetch") {
      // Kleinteil aufnehmen und zur Annahmefläche tragen
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it) {
        this.lambertState = "carry";
        this.lambertTarget.set(0, 0, 7); // Annahmefläche
      } else {
        this.carriedItemId = null;
        this.lambertState = "patrol";
      }
      return;
    }
    if (this.lambertState === "carry") {
      // ablegen
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid()) {
        it.body.setTranslation(
          { x: (Math.random() - 0.5) * 2, y: 0.6, z: 7 + (Math.random() - 0.5) * 2 },
          true
        );
      }
      this.carriedItemId = null;
      this.lambertState = "patrol";
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
      return;
    }

    // Patrouille: regelmäßig nach einem verirrten Kleinteil sehen
    if (this.stateT > 1.5) {
      this.stateT = 0;
      const stray = this.findStray();
      if (stray) {
        this.carriedItemId = stray.id;
        const p = stray.body.translation();
        this.lambertTarget.set(p.x, 0, p.z);
        this.lambertState = "fetch";
        return;
      }
      this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
    }
  }

  /** Sicherheitsabstand zum schwenkenden Ausleger (SW) */
  private static readonly EXCAVATOR_KEEPOUT = 8;
  private avoidTmp = new THREE.Vector3();

  /**
   * Laufrichtung um Hindernisse herumlenken: Bagger-Schwenkbereich und
   * Karossen werden umgangen statt durchquert.
   */
  private avoid(pos: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const out = this.avoidTmp.copy(dir);
    const push = (ox: number, oz: number, radius: number): void => {
      const dx = pos.x - ox;
      const dz = pos.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > radius || d < 0.01) return;
      // radial wegdrücken und tangential vorbeiführen
      const strength = (radius - d) / radius;
      out.x += (dx / d) * strength * 2.2 - (dz / d) * strength;
      out.z += (dz / d) * strength * 2.2 + (dx / d) * strength;
    };
    const ex = this.getExcavatorPos?.();
    if (ex) push(ex.x, ex.z, StaffManager.EXCAVATOR_KEEPOUT);
    for (const c of this.getObstaclePositions?.() ?? []) push(c.x, c.z, 3.2);
    out.y = 0;
    return out.normalize();
  }

  /** Kleinteil, das frei herumliegt (nicht in einer Zone, nicht gegriffen). */
  private findStray(): (typeof this.items.items)[number] | null {
    const ex = this.getExcavatorPos?.();
    for (const it of this.items.items) {
      // Lambert kümmert sich nur um kleine Buntmetalle & Co. — Stahlschrott
      // ist Sache des Baggers
      // Kleinteile und Buntmetalle sind seine Aufgabe — schwerer Stahlschrott
      // bleibt beim Bagger
      if (it.containerId || it.massKg > 60 || it.materialId === "steel") continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const p = it.body.translation();
      if (p.y > 1.2) continue;
      if (Math.abs(p.x) > 22 || p.z < -10 || p.z > 22) continue;
      // niemals im Schwenkbereich des Auslegers arbeiten
      if (ex && Math.hypot(p.x - ex.x, p.z - ex.z) < StaffManager.EXCAVATOR_KEEPOUT) continue;
      return it;
    }
    return null;
  }
}
