import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

/** Position der Brückenwaage in der Nordspur (SW) */
/** Brückenwaage direkt hinter der Einfahrt */
export const WEIGH_X = -22;
export const WEIGH_Z = 24;
/** Platzmaße (SW) — deutlich größer als die Ausgangsfläche */
/**
 * Platzgrenzen. Der Platz ist NICHT um x = 0 zentriert (Wunsch 10.09.2026):
 * Im Osten, wo die Sortiermulden stehen, ruecken Wand und Zaun bis dicht an
 * die Mulden heran — dort war zwischen letzter Mulde (x 8,5) und Wand (x 40)
 * gut 30 m Leere. Im Westen bleibt es, wie es war: Dort liegen Tor, Waage und
 * die Zufahrt.
 */
export const YARD_MIN_X = -40;
export const YARD_MAX_X = 10.5;
export const YARD_W = YARD_MAX_X - YARD_MIN_X;
/** Mitte des Platzes in x — der Boden liegt nicht mehr im Ursprung. */
export const YARD_CX = (YARD_MIN_X + YARD_MAX_X) / 2;
export const YARD_D = 58;
/** Einfahrt in der linken hinteren Ecke (Nordwesten) */
export const GATE_X = -22;

/**
 * Janines Kaffeewagen steht an der Nordwand vor den Graffiti, oestlich der
 * Einfahrt — dort, wo die Fahrer nach dem Abladen ohnehin warten (Wunsch
 * 11.09.2026). Laengsseite an der Mauer, Verkaufsklappe nach Sueden zum Platz,
 * die Warteplaetze links und rechts daneben.
 */
export const KAFFEE_POS = new THREE.Vector3(-10.5, 0, 27.0);
/** Gedreht, damit die Klappe nach Sueden zeigt und der Wagen laengs zur Wand steht. */
export const KAFFEE_ROT = Math.PI / 2;
/** Grundriss des Wagens [halbe Breite in x, halbe Tiefe in z] — dreht mit. */
export const KAFFEE_FUSS: [number, number] =
  Math.abs(Math.sin(KAFFEE_ROT)) > 0.5 ? [2.5, 1.4] : [1.4, 2.5];
/** Wo die Fahrer ihren Kaffee trinken: vor der Theke, Suedseite. */
export const KAFFEE_THEKE = new THREE.Vector3(KAFFEE_POS.x, 0, KAFFEE_POS.z - 2.4);

/**
 * Platz-Grundfläche Stufe A (60 × 40 m, Briefing Kap. 12):
 * Sandboden, Betonwände, Annahmefläche, Fahrspuren und Brückenwaage.
 */
export class Yard {
  /** Zentrum der Annahmefläche (nördlich vor dem Bagger) — hier landet die Anlieferung */
  /** Vorplatz vor dem Bagger — dort haelt der LKW zum Abladen. */
  readonly pileCenter = new THREE.Vector3(-4.0, 0, -10);

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.buildGround(scene, world);
    this.buildWalls(scene, world);
    this.buildGraffiti(scene);
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
    /*
     * Neben der Einfahrt statt hinter der Suedwand (Ansage 12.09.2026: „das
     * PRIPADA Schild soll eh immer im sichtbaren Bereich der Default-
     * Baggerauslegung sein, ich wuerde es in der Naehe der Toreinfahrt
     * platzieren").
     *
     * Der Bagger steht auf (−8 | −16) und blickt nach +z. Bei x −10 liegt die
     * Tafel damit knapp rechts der Blickachse und ist im Startbild zu sehen.
     * Die Schauflaeche muss dafuer herumgedreht werden — sie zeigte bisher
     * nach +z, jetzt nach −z, also auf den Platz.
     */
    const schildX = -10;
    const z = YARD_D / 2 + 3;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(boardW, boardH),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide })
    );
    board.position.set(schildX, 7.5, z);
    board.rotation.y = Math.PI;
    scene.add(board);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.8 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(boardW + 0.5, boardH + 0.5, 0.25), frameMat);
    frame.position.set(schildX, 7.5, z + 0.2);
    frame.castShadow = true;
    scene.add(frame);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // Pfeiler liegen hinter der Tafel, nicht davor: Sonst schneiden ihre
    // Kanten in die Schrift. Die Schaufläche bleibt plan (Wunsch 02.09.2026).
    for (const px of [-4.5, 4.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), frameMat);
      post.position.set(schildX + px, 4, z + 0.62);
      post.castShadow = true;
      scene.add(post);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.25, 4, 0.25).setTranslation(schildX + px, 4, z + 0.62),
        body
      );
    }
  }

  /**
   * Eingefahrene Reifenspuren auf den Wegen, die tatsächlich befahren werden:
   * von der Einfahrt über die Waage zum Abladeplatz und weiter zur Schere.
   * Ein Platz, über den täglich Tonnen gehen, hat dort dunkle Bahnen.
   */
  private buildTireTracks(scene: THREE.Scene): void {
    const spur = new THREE.MeshStandardMaterial({
      color: 0x6b6357,
      roughness: 1,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    // Streckenzüge, die den echten Fahrspuren folgen
    const wege: Array<Array<[number, number]>> = [
      [[GATE_X, 34], [GATE_X, 24], [-14, 18.5], [0, 19], [0, 7]],
      [[-14, 18.5], [-9, 13], [-9, 7.5]],
      [[-14, 18.5], [-3.5, 19], [-3.5, 8]],
    ];
    for (const weg of wege) {
      for (let i = 0; i < weg.length - 1; i++) {
        const [x1, z1] = weg[i];
        const [x2, z2] = weg[i + 1];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        // Zwei Spurrinnen im Achsabstand eines LKW
        for (const off of [-0.95, 0.95]) {
          const nx = (-dz / len) * off;
          const nz = (dx / len) * off;
          const bahn = new THREE.Mesh(new THREE.PlaneGeometry(0.55, len), spur);
          bahn.rotation.x = -Math.PI / 2;
          bahn.rotation.z = -Math.atan2(dx, dz);
          bahn.position.set(x1 + dx / 2 + nx, 0.012, z1 + dz / 2 + nz);
          scene.add(bahn);
        }
      }
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
        x = YARD_MIN_X + t * YARD_W;
        z = hz + 5 + rnd() * 26;
        if (Math.abs(x - GATE_X) < 9) continue; // Einfahrt freihalten
      } else if (side === 1) {
        x = YARD_MIN_X + t * YARD_W;
        z = -hz - 5 - rnd() * 26;
      } else if (side === 2) {
        x = YARD_MIN_X - 5 - rnd() * 26;
        z = -hz + t * YARD_D;
      } else {
        x = YARD_MAX_X + 5 + rnd() * 26;
        z = -hz + t * YARD_D;
      }
      placeTree(x, z, 0.85 + rnd() * 0.8);
    }

    // Auf einem der Bäume nördlich vom Platz steht ein Storchenhorst
    this.buildStorkNest(scene, placeTree);

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
    this.buildTireTracks(scene);
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
  /**
   * Schrottberge — Kulisse, kein Material.
   *
   * Sie standen mitten auf dem Platz und sahen aus wie Schrott, waren aber
   * feste Kegel: Man fuhr hin, griff zu und bekam nichts (Befund 10.09.2026).
   * Alles, was auf dem Platz nach Material aussieht, muss auch welches sein.
   * Jetzt liegen sie JENSEITS der Westmauer — dort liest man sie als Nachbars
   * Halde, und niemand versucht, sie abzutragen.
   */
  readonly moundCenters = [new THREE.Vector3(-47, 0, -9), new THREE.Vector3(-44, 0, 9)];

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
    // Sandboden mit dezentem Raster (Canvas-Textur, kein Asset nötig).
    // Dazu Gebrauchsspuren: Der Platz sah aus wie frisch gegossen, obwohl
    // täglich Tonnen darüber gehen (Wunsch 02.09.2026).
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8b8071";
    ctx.fillRect(0, 0, 256, 256);
    // Fleckige Verwitterung: hellere und dunklere Zonen, wie ausgewaschener
    // Beton
    for (let i = 0; i < 26; i++) {
      const r = 14 + Math.random() * 46;
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(120,112,98,0.3)" : "rgba(104,96,84,0.3)";
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ölflecken — dunkel, mit weichem Rand
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 5 + Math.random() * 13;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(28,24,20,0.5)");
      g.addColorStop(1, "rgba(28,24,20,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rostabrieb, wo Schrott gelegen hat
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = "rgba(122,74,42,0.18)";
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Kratzspuren vom Greifer, der über den Beton schleift
    ctx.strokeStyle = "rgba(150,142,128,0.35)";
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const len = 12 + Math.random() * 34;
      const a = Math.random() * Math.PI;
      ctx.lineWidth = 0.6 + Math.random() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
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
    ground.position.x = YARD_CX; // der Platz liegt nicht mehr im Ursprung
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
  /**
   * Graffiti auf der Betonwand westlich der Einfahrt.
   *
   * Ortsbezug Niederrhein: Abteiberg, Stadtteil Eicken, Kurvenparolen. Bewusst
   * Wahrzeichen und Ortsnamen statt Vereinsmarke — Vereinsnamen, Wappen und
   * Farben sind geschützt, Ortsnamen nicht (Wunsch 10.09.2026).
   */
  private buildGraffiti(scene: THREE.Scene): void {
    // Die ganze Nordwand ist besprueht, nicht ein Feld davon (Wunsch
    // 10.09.2026). Mehrere Tafeln nebeneinander, jede mit eigenem Startwert:
    // So wiederholt sich nichts, und die Einfahrt bleibt frei.
    const wandZ = YARD_D / 2 - 0.32;
    const felder: number[] = [];
    for (let x = YARD_MIN_X + 4; x < YARD_MAX_X - 4; x += 6.4) {
      if (Math.abs(x - GATE_X) < 7) continue; // Einfahrt freihalten
      felder.push(x);
    }
    felder.forEach((x, i) => this.buildGraffitiFeld(scene, x, wandZ, i * 977 + 13));
  }

  /** Eine Tafel Graffiti. `saat` steuert Auswahl und Lage der Motive. */
  private buildGraffitiFeld(scene: THREE.Scene, x: number, z: number, saat: number): void {
    let seed = saat;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 384;
    const c = cv.getContext("2d")!;
    c.clearRect(0, 0, cv.width, cv.height);

    // Sprühnebel-Untergrund, damit es nicht wie ein Aufkleber wirkt
    c.globalAlpha = 0.18;
    for (let i = 0; i < 300; i++) {
      c.fillStyle = i % 2 ? "#0f0f12" : "#e8e8e4";
      const r = 6 + rnd() * 26;
      c.beginPath();
      c.arc(80 + rnd() * 880, 60 + rnd() * 260, r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // Ortsbezug statt Vereinsmarke (Wunsch 10.09.2026): Der Platz liegt am
    // Niederrhein. Was auf so einer Wand steht, sind Ortsnamen, Wahrzeichen und
    // Kurvenparolen — nicht das Wappen eines Vereins. Vereinsnamen, Wappen und
    // Farben sind geschuetzt; Stadt- und Stadtteilnamen sind es nicht.
    //
    // Eine echte Wand ist nie EIN Schriftzug, sondern viele uebereinander: ein
    // grosses Stueck, drumherum Tags, Sprueche und Gekritzel, teils
    // uebersprueht. Darum ist die ganze Flaeche belegt.

    /** Farbnasen unter einem Element — das, was die Wand alt aussehen laesst. */
    const nasen = (x: number, y: number, breite: number, farbe: string, n = 4): void => {
      c.fillStyle = farbe;
      for (let i = 0; i < n; i++) {
        const nx = x + Math.random() * breite;
        c.fillRect(nx, y, 3 + Math.random() * 3, 14 + Math.random() * 42);
      }
    };

    /** Tag: schneller Zug mit der Dose, leicht schraeg. */
    const tag = (
      text: string,
      x: number,
      y: number,
      groesse: number,
      farbe: string,
      neigung: number
    ): void => {
      c.save();
      c.translate(x, y);
      c.rotate(neigung);
      c.font = `italic 900 ${groesse}px Impact, 'Arial Black', sans-serif`;
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.fillStyle = "rgba(12,12,16,0.75)";
      c.fillText(text, 4, 5);
      c.fillStyle = farbe;
      c.fillText(text, 0, 0);
      c.restore();
    };

    // --- Abteiberg: nicht auf jeder Tafel, sonst wirkt die Wand wie tapeziert
    const mitBerg = rnd() < 0.45;
    c.save();
    c.translate(96, 268);
    c.fillStyle = "#101014";
    const turm = (x: number, breite: number, hoehe: number, spitze: number): void => {
      c.fillRect(x, -hoehe, breite, hoehe);
      c.beginPath();
      c.moveTo(x - 4, -hoehe);
      c.lineTo(x + breite / 2, -hoehe - spitze);
      c.lineTo(x + breite + 4, -hoehe);
      c.closePath();
      c.fill();
    };
    if (mitBerg) {
      turm(0, 24, 104, 36);
      turm(32, 20, 78, 28);
    }
    if (mitBerg) {
      c.fillRect(-12, -54, 76, 54); // Kirchenschiff darunter
    }
    c.restore();

    // --- Hauptstueck in der Mitte
    c.save();
    c.translate(548, 132);
    c.rotate(-0.05);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "italic 900 132px Impact, 'Arial Black', sans-serif";
    c.fillStyle = "#101014";
    const HAUPT = ["GLADBACH", "MG", "EICKEN", "ABTEIBERG"];
    const wort = HAUPT[Math.floor(rnd() * HAUPT.length)]!;
    c.fillText(wort, 9, 11);
    c.fillStyle = "#f2f2ee";
    c.fillText(wort, 0, 0);
    c.lineWidth = 7;
    c.strokeStyle = "#101014";
    c.strokeText(wort, 0, 0);
    c.restore();
    nasen(330, 178, 430, "rgba(16,16,20,0.5)", 7);

    // --- Kurvenparolen und Stadtteil
    // Kleinere Parolen: je Tafel eine andere Auswahl aus demselben Vorrat
    const PAROLEN = [
      "EICKEN",
      "ULTRAS",
      "NORDKURVE",
      "BÖKELBERG",
      "NIEDERRHEIN",
      "BUNTER GARTEN",
      "WICKRATH",
      "HARDTER WALD",
      "GLADBACH BLEIBT",
    ];
    const gewaehlt: string[] = [];
    while (gewaehlt.length < 4) {
      const w = PAROLEN[Math.floor(rnd() * PAROLEN.length)]!;
      if (!gewaehlt.includes(w)) gewaehlt.push(w);
    }
    const FARBEN = ["#7fc24a", "#e8e8e4", "#c9ccc4", "#9aa2a8", "#d9c15a"];
    gewaehlt.forEach((w, i) => {
      const gx = 290 + (i % 2) * 320;
      const gy = 244 + Math.floor(i / 2) * 68;
      tag(w, gx, gy, i % 2 ? 52 : 40, FARBEN[Math.floor(rnd() * FARBEN.length)]!, (rnd() - 0.5) * 0.1);
      if (rnd() < 0.6) nasen(gx, gy + 20, 160, "rgba(232,232,228,0.4)", 4);
    });

    // --- Kleines Gekritzel rechts: Krone, Stern, Herz, ein Kuerzel
    tag("MG", 872, 118, 96, "#7fc24a", 0.06);
    nasen(874, 152, 96, "rgba(127,194,74,0.5)", 4);
    // Stern
    c.save();
    c.translate(910, 232);
    c.fillStyle = "#f2f2ee";
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 11 : 26;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const fn = i === 0 ? "moveTo" : "lineTo";
      c[fn](Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.restore();
    // Herz
    c.save();
    c.translate(838, 300);
    c.scale(1.1, 1.1);
    c.fillStyle = "#c0392b";
    c.beginPath();
    c.moveTo(0, 8);
    c.bezierCurveTo(-16, -8, -22, 10, 0, 24);
    c.bezierCurveTo(22, 10, 16, -8, 0, 8);
    c.fill();
    c.restore();

    // --- Ein uebersprayter Tag: erst gekritzelt, dann durchgestrichen
    tag("1861 EV", 148, 128, 30, "rgba(180,180,175,0.5)", 0.12);
    c.strokeStyle = "rgba(200,60,45,0.75)";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(140, 146);
    c.lineTo(272, 108);
    c.stroke();

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const plane = new THREE.Mesh(
      // Die Umrandung ist 1,8 m hoch — eine 2,8-m-Tafel ragte darueber hinaus
      new THREE.PlaneGeometry(6.2, 1.6),
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    );
    // Innenseite der Nordwand — von der Waage und aus der Kabine gut zu sehen
    plane.position.set(x, 0.94, z);
    plane.rotation.y = Math.PI;
    scene.add(plane);
  }

  /**
   * Storchenhorst auf einem Baum nördlich des Platzes (Wunsch 29.08.2026).
   * Aus der Kabine blickt man in diese Richtung, der Vogel steht also im Bild.
   * Er nickt gelegentlich und dreht den Kopf — reine Kulisse, keine Physik.
   */
  private buildStorkNest(
    scene: THREE.Scene,
    placeTree: (x: number, z: number, scale: number) => void
  ): void {
    const X = -6.5;
    const Z = 37;
    const SCALE = 1.45; // ein kräftiger, alter Baum — Störche nehmen die höchsten
    placeTree(X, Z, SCALE);

    // Horst: Reisighaufen auf der Krone
    const nestY = 5.6 * SCALE;
    const twigMat = new THREE.MeshStandardMaterial({ color: 0x6b573c, roughness: 1, flatShading: true });
    const nest = new THREE.Group();
    nest.position.set(X, nestY, Z);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.72, 0.5, 9), twigMat);
    nest.add(bowl);
    // ein paar abstehende Äste, damit es zottelig wirkt
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5 + Math.random() * 0.7, 4), twigMat);
      twig.position.set(Math.sin(a) * 0.95, 0.2 + Math.random() * 0.18, Math.cos(a) * 0.95);
      twig.rotation.set(Math.random() * 0.6 - 0.3, a, Math.PI / 2 - 0.35 - Math.random() * 0.4);
      nest.add(twig);
    }
    scene.add(nest);

    // --- Der Storch ---
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.75 });
    const black = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.7 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.55 });

    const stork = new THREE.Group();
    stork.position.set(X - 0.12, nestY + 0.3, Z + 0.1);
    stork.rotation.y = -0.5; // schaut schräg über den Platz
    scene.add(stork);

    // Rumpf, hinten spitz zulaufend
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 4, 10), white);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.46;
    body.castShadow = true;
    stork.add(body);
    // Angelegte Flügel und Schwanz sind beim Weißstorch schwarz
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 3, 8), black);
      wing.rotation.z = Math.PI / 2;
      wing.position.set(-0.1, 0.47, side * 0.19);
      stork.add(wing);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 7), black);
    tail.rotation.z = Math.PI / 2 + 0.25;
    tail.position.set(-0.5, 0.5, 0);
    stork.add(tail);

    // Hals und Kopf hängen an einem Drehpunkt, damit er sich bewegen kann
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0.2, 0.56, 0);
    stork.add(neckPivot);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.5, 7), white);
    neck.position.y = 0.24;
    neck.rotation.z = -0.28;
    neckPivot.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 9, 7), white);
    head.position.set(0.14, 0.5, 0);
    neckPivot.add(head);
    // Der lange rote Schnabel macht den Storch aus
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.46, 6), red);
    beak.rotation.z = -Math.PI / 2 + 0.12;
    beak.position.set(0.38, 0.48, 0);
    neckPivot.add(beak);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), black);
      eye.position.set(0.19, 0.53, side * 0.07);
      neckPivot.add(eye);
    }

    // Stelzen
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.44, 5), red);
      leg.position.set(0.02, 0.22, side * 0.1);
      stork.add(leg);
    }

    // Sanftes Leben: der Kopf wandert langsam hin und her und nickt dabei
    const start = performance.now();
    const tick = (): void => {
      const t = (performance.now() - start) / 1000;
      neckPivot.rotation.y = Math.sin(t * 0.31) * 0.55 + Math.sin(t * 0.13) * 0.3;
      neckPivot.rotation.z = Math.sin(t * 0.47) * 0.12 - 0.05;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private buildWalls(scene: THREE.Scene, world: RAPIER.World): void {
    const BL = 1.6; // Blocklänge
    const BH = 0.6;
    const BT = 0.6;
    const ROWS = 3;
    // Die Umrandung besteht aus 498 Bloecken mit je zwei Nieten — rund 1.500
    // Meshes, und jedes einzeln gezeichnet war der groesste Posten in der
    // Bildzeit (iPad: 34 ms je Bild). Als InstancedMesh sind es zwei Zeichenrufe.
    // Die Farbe kommt je Exemplar dazu, damit die Blockreihe gescheckt bleibt.
    const farben = [0x9b9b94, 0x92928b, 0xa4a49c].map((c) => new THREE.Color(c));
    const blockGeo = new THREE.BoxGeometry(BL, BH, BT);
    const studGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 8);
    const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const hz = YARD_D / 2;
    let n = 0;

    const bloecke: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
    const nieten: Array<{ m: THREE.Matrix4; f: THREE.Color }> = [];
    const block = new THREE.Object3D();
    const niete = new THREE.Object3D();

    const place = (x: number, z: number, alongX: boolean): void => {
      for (let r = 0; r < ROWS; r++) {
        const f = farben[n++ % 3]!;
        block.position.set(x, BH / 2 + r * BH, z);
        block.rotation.set(0, alongX ? 0 : Math.PI / 2, 0);
        block.updateMatrix();
        bloecke.push({ m: block.matrix.clone(), f });
        for (const s of [-0.45, 0.45]) {
          niete.position.set(alongX ? s : 0, BH / 2 + 0.045, alongX ? 0 : s);
          niete.updateMatrix();
          // Block-Matrix mal lokale Matrix — genau die Rechnung, die vorher die
          // Eltern-Kind-Beziehung gemacht hat. So sitzt jede Niete auf den
          // Millimeter dort, wo sie vorher sass.
          nieten.push({ m: block.matrix.clone().multiply(niete.matrix), f });
        }
      }
    };

    // Nord- und Südwand (Einfahrtslücke im Norden bei GATE_X)
    for (let x = YARD_MIN_X + BL / 2; x < YARD_MAX_X; x += BL) {
      if (!(Math.abs(x - GATE_X) < 4.5)) place(x, hz, true);
      place(x, -hz, true);
    }
    // Ost- und Westwand
    for (let z = -hz + BL / 2; z < hz; z += BL) {
      place(YARD_MIN_X, z, false);
      place(YARD_MAX_X, z, false);
    }

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const bauen = (geo: THREE.BufferGeometry, liste: Array<{ m: THREE.Matrix4; f: THREE.Color }>): void => {
      const im = new THREE.InstancedMesh(geo, wallMat, liste.length);
      liste.forEach((e, i) => {
        im.setMatrixAt(i, e.m);
        im.setColorAt(i, e.f);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      // Die Umrandung laeuft um den ganzen Platz und ist praktisch immer
      // teilweise im Bild; die Huellkugel umspannt alles, Aussortieren brachte
      // nichts und koennte bei Instanzen sogar faelschlich wegblenden.
      im.frustumCulled = false;
      scene.add(im);
    };
    bauen(blockGeo, bloecke);
    bauen(studGeo, nieten);

    // Kollider als durchgehende Quader (Einfahrt ausgespart)
    const wallH = ROWS * BH;
    const addWall = (x: number, z: number, sx: number, sz: number): void => {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(sx / 2, wallH / 2, sz / 2).setTranslation(x, wallH / 2, z),
        wallBody
      );
    };
    addWall(YARD_CX, -hz, YARD_W, BT);
    addWall(YARD_MIN_X, 0, BT, YARD_D);
    addWall(YARD_MAX_X, 0, BT, YARD_D);
    // Nordwand in zwei Stücken links und rechts der Einfahrt
    const gateL = GATE_X - 4.5;
    const gateR = GATE_X + 4.5;
    addWall((YARD_MIN_X + gateL) / 2, hz, gateL - YARD_MIN_X, BT);
    addWall((gateR + YARD_MAX_X) / 2, hz, YARD_MAX_X - gateR, BT);

    this.buildGate(scene, gateL, gateR, hz);
  }

  /**
   * Einfahrtstor aus Stahl (Wunsch 10.09.2026).
   *
   * Vorher stand hier ein gelber Torbogen quer über der Einfahrt — der sah
   * aus wie eine Schranke und hing dem Kranausleger im Weg. Jetzt sind es
   * zwei Flügel aus Vierkantrohr, die tagsüber offen an der Mauer stehen:
   * Man sieht, dass der Platz ein Tor hat, und trotzdem ist die Durchfahrt
   * in voller Höhe frei.
   */
  private buildGate(scene: THREE.Scene, gateL: number, gateR: number, hz: number): void {
    const stahl = new THREE.MeshStandardMaterial({
      color: 0x5d666d,
      roughness: 0.45,
      metalness: 0.75,
    });
    const FL = 4.2; // Flügellänge
    const FH = 2.4; // Flügelhöhe
    // Angelpfosten links und rechts der Lücke
    for (const px of [gateL, gateR]) {
      const pf = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.0, 0.26), stahl);
      pf.position.set(px, 1.5, hz);
      pf.castShadow = true;
      scene.add(pf);
      const kappe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.34), stahl);
      kappe.position.set(px, 3.04, hz);
      scene.add(kappe);
    }
    // Zwei Flügel, offen an die Mauer geschwenkt
    for (const [px, dir] of [
      [gateL, -1],
      [gateR, 1],
    ] as const) {
      const fl = new THREE.Group();
      fl.position.set(px, 0, hz - 0.5);
      fl.rotation.y = dir < 0 ? Math.PI : 0;
      // Rahmen: oben, unten, aussen
      for (const [y, h] of [
        [0.35, 0.12],
        [FH, 0.14],
      ] as const) {
        const holm = new THREE.Mesh(new THREE.BoxGeometry(FL, h, 0.1), stahl);
        holm.position.set(FL / 2, y, 0);
        holm.castShadow = true;
        fl.add(holm);
      }
      const kante = new THREE.Mesh(new THREE.BoxGeometry(0.12, FH - 0.2, 0.1), stahl);
      kante.position.set(FL - 0.06, (FH + 0.35) / 2, 0);
      fl.add(kante);
      // Senkrechte Fuellstaebe
      for (let i = 1; i < 14; i++) {
        const stab = new THREE.Mesh(new THREE.BoxGeometry(0.06, FH - 0.4, 0.06), stahl);
        stab.position.set((i * FL) / 14, (FH + 0.35) / 2, 0);
        fl.add(stab);
      }
      // Diagonalstrebe — die haelt so ein Tor erst gerade
      const strebe = new THREE.Mesh(
        new THREE.BoxGeometry(Math.hypot(FL, FH - 0.5), 0.08, 0.07),
        stahl
      );
      strebe.position.set(FL / 2, (FH + 0.35) / 2, 0.06);
      strebe.rotation.z = Math.atan2(FH - 0.5, FL);
      fl.add(strebe);
      scene.add(fl);
    }
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
