import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

/** Position der Brückenwaage in der Nordspur (SW) */
/** Brückenwaage direkt hinter der Einfahrt, neben dem Wiegehäuschen */
export const WEIGH_X = -22;
export const WEIGH_Z = 24;
/** Platzmaße (SW) — deutlich größer als die Ausgangsfläche */
export const YARD_W = 80;
export const YARD_D = 58;
/** Einfahrt in der linken hinteren Ecke (Nordwesten) */
export const GATE_X = -22;

/**
 * Platz-Grundfläche Stufe A (60 × 40 m, Briefing Kap. 12):
 * Sandboden, Betonwände, Annahmefläche, Fahrspuren und Brückenwaage.
 */
export class Yard {
  /** Zentrum der Annahmefläche (nördlich vor dem Bagger) — hier landet die Anlieferung */
  readonly pileCenter = new THREE.Vector3(0, 0, 7);

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.buildGround(scene, world);
    this.buildWalls(scene, world);
    this.buildReceivingArea(scene);
    this.buildScrapMounds(scene, world);
    this.buildDeliveryLane(scene);
    this.buildWeighbridge(scene);
    this.buildLandscape(scene);
    this.buildBillboard(scene, world);
  }

  /**
   * Großes Firmenschild als Werbefläche an der hinteren Platzgrenze:
   * PRIPADA-Wortmarke mit dem Kreis-Signet.
   */
  private buildBillboard(scene: THREE.Scene, world: RAPIER.World): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f4f2ee";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Signet: zwei ineinandergreifende Bögen (stilisiertes „P" im Kreis)
    const cxp = canvas.width / 2;
    const cyp = 190;
    ctx.strokeStyle = "#b8b0a2";
    ctx.lineCap = "butt";
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.arc(cxp, cyp, 110, -Math.PI / 2, Math.PI * 0.75);
    ctx.stroke();
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.arc(cxp - 18, cyp - 6, 58, Math.PI * 0.5, Math.PI * 1.75);
    ctx.stroke();
    ctx.fillStyle = "#b8b0a2";
    ctx.fillRect(cxp - 33, cyp - 6, 30, 130);
    // Wortmarke
    ctx.fillStyle = "#111820";
    ctx.textAlign = "center";
    ctx.font = "300 116px 'Segoe UI', Helvetica, Arial, sans-serif";
    ctx.letterSpacing = "26px";
    ctx.fillText("PRIPADA", cxp, 400);
    ctx.fillStyle = "#8d8676";
    ctx.font = "300 46px 'Segoe UI', Helvetica, Arial, sans-serif";
    ctx.letterSpacing = "18px";
    ctx.fillText("GMBH", cxp, 465);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const boardW = 14;
    const boardH = 7;
    const z = -YARD_D / 2 - 3;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(boardW, boardH),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide })
    );
    board.position.set(6, 7.5, z);
    scene.add(board);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.8 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.5, boardH + 0.5, 0.25), frameMat);
    frame.position.set(6, 7.5, z - 0.2);
    frame.castShadow = true;
    scene.add(frame);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const px of [-4.5, 4.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), frameMat);
      post.position.set(6 + px, 4, z - 0.2);
      post.castShadow = true;
      scene.add(post);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.25, 4, 0.25).setTranslation(6 + px, 4, z - 0.2),
        body
      );
    }
  }

  /**
   * Umland hinter der Platzmauer (Design 2026-08-29): Wiesenring, Baumgruppen
   * und ein paar Hügel am Horizont. Reine Kulisse ohne Kollider.
   */
  private buildLandscape(scene: THREE.Scene): void {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 320),
      new THREE.MeshStandardMaterial({ color: 0x6f8b4e, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.06; // knapp unter dem Platzboden
    scene.add(grass);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
    const leafMats = [0x3f6b34, 0x4a7a3c, 0x355c2c].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })
    );
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 7);
    const hx = YARD_W / 2;
    const hz = YARD_D / 2;

    // Bäume ringsum, mit Lücke bei der Einfahrt
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const placeTree = (x: number, z: number, scale: number): void => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.scale.setScalar(scale);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 3; i++) {
        // Index muss positiv bleiben — bei negativem x liefert % sonst -1 und
        // die Krone fiele auf das weiße Standardmaterial zurück
        const mi = (((i + Math.floor(x)) % 3) + 3) % 3;
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 - i * 0.28, 0), leafMats[mi]);
        crown.position.set((rnd() - 0.5) * 0.5, 2.6 + i * 1.0, (rnd() - 0.5) * 0.5);
        crown.castShadow = true;
        g.add(crown);
      }
      scene.add(g);
    };

    for (let i = 0; i < 46; i++) {
      const side = i % 4;
      const t = rnd();
      let x: number;
      let z: number;
      if (side === 0) {
        x = -hx + t * YARD_W;
        z = hz + 5 + rnd() * 26;
        if (Math.abs(x - GATE_X) < 9) continue; // Einfahrt freihalten
      } else if (side === 1) {
        x = -hx + t * YARD_W;
        z = -hz - 5 - rnd() * 26;
      } else if (side === 2) {
        x = -hx - 5 - rnd() * 26;
        z = -hz + t * YARD_D;
      } else {
        x = hx + 5 + rnd() * 26;
        z = -hz + t * YARD_D;
      }
      placeTree(x, z, 0.85 + rnd() * 0.8);
    }

    // Hügelkette am Horizont
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x63784f, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 120 + rnd() * 35;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + rnd() * 14, 8, 6), hillMat);
      hill.position.set(Math.cos(a) * r, -6 - rnd() * 4, Math.sin(a) * r);
      hill.scale.y = 0.5;
      scene.add(hill);
    }
  }

  /**
   * Zwei markierte Fahrspuren (Design 2026-08-29):
   * - NORDSPUR (x ≈ 0): Anlieferer über die Brückenwaage bis zum Abkippplatz.
   * - OSTSPUR (x = 16): Abhol-LKW mit Container bis zum Verladeplatz im Süden.
   */
  private buildDeliveryLane(scene: THREE.Scene): void {
    const dash = new THREE.MeshStandardMaterial({ color: 0xcfc06a, roughness: 0.9 });
    const mark = (x: number, z: number, alongZ: boolean): void => {
      const m = new THREE.Mesh(
        alongZ ? new THREE.BoxGeometry(0.25, 0.02, 1.2) : new THREE.BoxGeometry(1.2, 0.02, 0.25),
        dash
      );
      m.position.set(x, 0.02, z);
      scene.add(m);
    };
    // Nordspur: Randmarkierungen links/rechts der Fahrgasse
    for (let z = 20; z > 10; z -= 2.4) {
      mark(-2.4, z, true);
      mark(2.4, z, true);
    }
    // Ostspur nach Süden
    for (let z = 20; z > -12; z -= 2.4) mark(16, z, true);
    // Abzweig nach Westen zum Verladeplatz
    for (let x = 15; x > 6; x -= 2.2) mark(x, -13, false);
  }

  /**
   * Brückenwaage in der Nordspur (Briefing Kap. 9): Anlieferer werden hier bei
   * der Einfahrt voll und bei der Ausfahrt leer gewogen.
   */
  private buildWeighbridge(scene: THREE.Scene): void {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.12, 9),
      new THREE.MeshStandardMaterial({ color: 0x62676b, roughness: 0.5, metalness: 0.6 })
    );
    plate.position.set(WEIGH_X, 0.06, WEIGH_Z);
    plate.receiveShadow = true;
    scene.add(plate);
    const rail = new THREE.MeshStandardMaterial({ color: 0xd7a71f, roughness: 0.8 });
    for (const sx of [-2.4, 2.4]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 9), rail);
      kerb.position.set(WEIGH_X + sx, 0.15, WEIGH_Z);
      kerb.castShadow = true;
      scene.add(kerb);
    }
    // Anzeigetafel am Rand
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x53585c, roughness: 0.8 })
    );
    pole.position.set(WEIGH_X + 3.4, 1.6, WEIGH_Z);
    scene.add(pole);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.0, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1d2124, roughness: 0.6 })
    );
    board.position.set(WEIGH_X + 3.4, 3.0, WEIGH_Z);
    scene.add(board);
  }

  /**
   * Permanente Schrottberge links und rechts hinter dem Bagger-Startplatz
   * (Design-Wunsch 2026-08-27) — statische Kulissen-Hügel mit Kollidern,
   * obendrauf liegt loser Schrott (spawnt in main).
   */
  /** Kulissen-Berge am Platzrand (nicht mehr Arbeitsfläche — die ist jetzt der Stahlhaufen) */
  readonly moundCenters = [new THREE.Vector3(-22, 0, -10), new THREE.Vector3(23, 0, 6)];

  private buildScrapMounds(scene: THREE.Scene, world: RAPIER.World): void {
    const rust = new THREE.MeshStandardMaterial({ color: 0x5f5248, roughness: 1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x46413c, roughness: 1 });
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const c of this.moundCenters) {
      const cones: Array<[number, number, number, number, number, THREE.Material]> = [
        // [dx, dz, radius, höhe, yaw, mat]
        [0, 0, 2.6, 1.9, 0, rust],
        [1.4, 0.8, 1.6, 1.4, 0.7, dark],
        [-1.2, -0.6, 1.8, 1.2, 1.9, dark],
      ];
      cones.forEach(([dx, dz, r, h, yaw, mat], idx) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), mat);
        cone.position.set(c.x + dx, h / 2, c.z + dz);
        cone.rotation.y = yaw;
        cone.castShadow = true;
        cone.receiveShadow = true;
        scene.add(cone);
        // Nur der Hauptkegel bekommt einen Kollider: überlappende Kegel-Kollider
        // erzeugen Klemmtaschen, in denen Schrott eingequetscht und
        // herausgeschleudert wird. Die Nebenkegel sind reine Kulisse.
        if (idx === 0) {
          world.createCollider(
            RAPIER.ColliderDesc.cone(h / 2, r).setTranslation(c.x + dx, h / 2, c.z + dz),
            body
          );
        }
      });
    }
  }

  private buildGround(scene: THREE.Scene, world: RAPIER.World): void {
    // Sandboden mit dezentem Raster (Canvas-Textur, kein Asset nötig)
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8b8071";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(60,55,45,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(30, 20);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(YARD_W, YARD_D),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Kollider deutlich größer als der sichtbare Platz: Nichts darf je ins Leere fallen,
    // auch wenn etwas über die Mauer geworfen wird.
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0),
      groundBody
    );
  }

  /**
   * Der Platz ist ringsum mit Betonlego-Blöcken eingefasst (Design 2026-08-29).
   * In der linken hinteren Ecke (Nordwesten) bleibt eine Lücke als Einfahrt.
   */
  private buildWalls(scene: THREE.Scene, world: RAPIER.World): void {
    const BL = 1.6; // Blocklänge
    const BH = 0.6;
    const BT = 0.6;
    const ROWS = 3;
    const cols = [0x9b9b94, 0x92928b, 0xa4a49c].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })
    );
    const blockGeo = new THREE.BoxGeometry(BL, BH, BT);
    const studGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 8);
    const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const hx = YARD_W / 2;
    const hz = YARD_D / 2;
    let n = 0;

    const place = (x: number, z: number, alongX: boolean): void => {
      for (let r = 0; r < ROWS; r++) {
        const b = new THREE.Mesh(blockGeo, cols[n++ % 3]);
        b.position.set(x, BH / 2 + r * BH, z);
        if (!alongX) b.rotation.y = Math.PI / 2;
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        for (const s of [-0.45, 0.45]) {
          const stud = new THREE.Mesh(studGeo, b.material);
          stud.position.set(alongX ? s : 0, BH / 2 + 0.045, alongX ? 0 : s);
          b.add(stud);
        }
      }
    };

    // Nord- und Südwand (Einfahrtslücke im Norden bei GATE_X)
    for (let x = -hx + BL / 2; x < hx; x += BL) {
      if (!(Math.abs(x - GATE_X) < 4.5)) place(x, hz, true);
      place(x, -hz, true);
    }
    // Ost- und Westwand
    for (let z = -hz + BL / 2; z < hz; z += BL) {
      place(-hx, z, false);
      place(hx, z, false);
    }

    // Kollider als durchgehende Quader (Einfahrt ausgespart)
    const wallH = ROWS * BH;
    const addWall = (x: number, z: number, sx: number, sz: number): void => {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(sx / 2, wallH / 2, sz / 2).setTranslation(x, wallH / 2, z),
        wallBody
      );
    };
    addWall(0, -hz, YARD_W, BT);
    addWall(-hx, 0, BT, YARD_D);
    addWall(hx, 0, BT, YARD_D);
    // Nordwand in zwei Stücken links und rechts der Einfahrt
    const gateL = GATE_X - 4.5;
    const gateR = GATE_X + 4.5;
    addWall((-hx + gateL) / 2, hz, gateL + hx, BT);
    addWall((gateR + hx) / 2, hz, hx - gateR, BT);

    // Einfahrtstor-Pfosten
    const post = new THREE.MeshStandardMaterial({ color: 0xd7a71f, roughness: 0.8 });
    for (const px of [gateL, gateR]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.2, 0.35), post);
      p.position.set(px, 2.1, hz);
      p.castShadow = true;
      scene.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(gateR - gateL, 0.35, 0.35), post);
    beam.position.set(GATE_X, 4.0, hz);
    scene.add(beam);
  }

  /** Markierte Annahmefläche 8 × 8 m (Kap. 12) — rein visuell. */
  private buildReceivingArea(scene: THREE.Scene): void {
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ color: 0x776b58, roughness: 1 })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(this.pileCenter.x, 0.01, this.pileCenter.z);
    marker.receiveShadow = true;
    scene.add(marker);
    // gelbe Eckwinkel als Markierung
    const corner = new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.9 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      for (const [w, d, ox, oz] of [
        [1.2, 0.15, 0.6, 0.075],
        [0.15, 1.2, 0.075, 0.6],
      ] as const) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), corner);
        m.position.set(
          this.pileCenter.x + sx * (4 - ox),
          0.02,
          this.pileCenter.z + sz * (4 - oz)
        );
        scene.add(m);
      }
    }
  }
}
