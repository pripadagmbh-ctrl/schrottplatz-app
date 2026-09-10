import * as THREE from "three";
import type { ItemManager } from "./scrapItems";
import { hitsObstacle, slideAround } from "./obstacles";
import { CONFIGS, type ContainerConfig } from "./containers";
import {
  WheelLoader,
  LOADER_SPEED,
  brauchtSchieben,
  anstellPunkt,
  schiebeZiel,
  SCHIEB_MIN_M,
  SCHIEB_MIN_KG,
} from "./loader";

/**
 * Platzpersonal (Design 2026-08-29):
 * - Mario Baer steht an der Brückenwaage und wiegt ein und aus.
 * - Janine Prison schenkt am Klapptisch vor dem Büro Kaffee aus.
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

/**
 * Was Lambert gerade tut.
 *
 *   patrol  wartet und sieht sich um
 *   guide   weist einen LKW ein
 *   fetch   holt ein Teil (zu Fuss oder mit der Schaufel)
 *   carry   bringt es in seine Mulde
 *   shove   faehrt hinter ein Teil, das der Bagger nicht erreicht
 *   shoving schiebt es in die Reichweite des Baggers
 *
 * Die beiden letzten gibt es nur mit Radlader — von Hand schiebt niemand
 * einen halben Motorblock ueber den Platz.
 */
type LambertState = "patrol" | "guide" | "fetch" | "carry" | "shove" | "shoving";

export class StaffManager {
  private lambert: PersonParts;
  private lambertState: LambertState = "patrol";
  private lambertTarget = new THREE.Vector3();
  private walkPhase = 0;
  private waveT = 0;
  private carriedItemId: string | null = null;
  private stateT = 0;
  private patrolIdx = 0;

  /**
   * Warteposten am Rand des Schrottfelds. Ist gerade nichts wegzuräumen,
   * stellt er sich dorthin, statt sinnlos Runden zu drehen.
   */
  private readonly patrol = [
    new THREE.Vector3(-1.5, 0, 14),
    new THREE.Vector3(1.5, 0, 14.5),
  ];
  /** Einweisplatz neben dem Abkippplatz */
  private readonly guidePos = new THREE.Vector3(3.6, 0, 8.5);

  /** Baggerposition — um die Maschine selbst geht er herum */
  getExcavatorPos: (() => THREE.Vector3) | null = null;
  /**
   * Position der Spinne. Lambert arbeitet mitten im Schrottfeld — das liegt
   * nun einmal vor dem Bagger. Ausweichen muss er nur dem, was sich gerade
   * über ihm bewegt, nicht der ganzen Maschine (Design-Fix 29.08.2026).
   */
  getGrapplePos: (() => THREE.Vector3) | null = null;
  /** Liegt (x,z) auf einer Sortierflaeche — Haufen oder Mulde? */
  private static inZone(x: number, z: number): boolean {
    for (const c of CONFIGS) {
      const [w, d] = c.size;
      if (Math.abs(x - c.x) < w / 2 + 1.0 && Math.abs(z - c.z) < d / 2 + 1.0) return true;
    }
    return false;
  }

  /**
   * Teil, das gerade eine Fahrspur blockiert. Das hat Vorrang vor allem
   * anderen: Solange es dort liegt, steht der Betrieb.
   */
  getBlockingItem: (() => (typeof this.items.items)[number] | null) | null = null;

  /**
   * Was Lambert bewegen kann. Von Hand sind das Kleinteile; mit dem Radlader
   * räumt er auch schwere Brocken von der Fahrspur.
   */
  get tragkraft(): number {
    return (this.hasLoader ? 900 : 60) * (this.getLiftBonus?.() ?? 1);
  }
  /** Tempofaktor aus dem Bulldozer — von main gesetzt */
  getSpeedBonus: (() => number) | null = null;
  /** Traglastfaktor aus dem Stapler — von main gesetzt */
  getLiftBonus: (() => number) | null = null;

  /** Radlader vorhanden? Wird vom Upgrade-System gesetzt. */
  private _hasLoader = false;
  private loader: WheelLoader | null = null;

  get hasLoader(): boolean {
    return this._hasLoader;
  }

  /**
   * Radlader freischalten. Von da an fährt Lambert statt zu laufen und kann
   * auch schwere Brocken von den Fahrspuren räumen.
   */
  setLoader(on: boolean): void {
    this._hasLoader = on;
    this.loader?.setVisible(on);
    // Zu Fuß oder auf der Maschine — nicht beides sichtbar
    this.lambert.group.visible = !on;
  }
  /** Karossen — durch die läuft er nicht hindurch */
  getObstaclePositions: (() => THREE.Vector3[]) | null = null;

  /**
   * @param weighPos Mitte der Wiegeplatte — dort steht Mario
   * @param kaffeePos Klapptisch vor dem Büro — dort steht Janine
   */
  constructor(
    scene: THREE.Scene,
    private items: ItemManager,
    weighPos: THREE.Vector3,
    kaffeePos: THREE.Vector3
  ) {
    /*
     * Mario steht neben der Wiegeplatte, nicht mehr in einem Häuschen: Die
     * Buden auf dem Platz sind weg, gebaut wird nur noch hinten rechts
     * (Wunsch 10.09.2026). Die Waage bleibt — er bedient sie im Stehen, mit
     * dem Klemmbrett am Anzeigemast.
     */
    const mario = buildPerson({ shirt: 0x2f5c8a, trousers: 0x2b2f33, hair: 0x39312b });
    // 3,8 m neben der Plattenmitte: neben dem Anzeigemast und knapp
    // ausserhalb der Spur, in der die LKW auf die Waage rollen
    mario.group.position.set(weighPos.x + 3.8, 0, weighPos.z - 2.4);
    mario.group.rotation.y = -Math.PI / 2; // schaut quer zur Fahrspur auf die Platte
    scene.add(mario.group);
    this.addNameTagToObject(mario.group, "MARIO", 0, 2.1, 0);
    const brett = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.9 })
    );
    brett.position.set(0.16, 1.05, 0.18);
    brett.rotation.z = 0.35;
    mario.group.add(brett);

    // Janine mit ihrem Klapptisch vor dem Büro — die Bude ist ersatzlos weg
    const janine = buildPerson({ shirt: 0xe8e2d5, trousers: 0x4a3b52, hair: 0x8a5a2b });
    janine.group.position.set(kaffeePos.x, 0, kaffeePos.z - 0.8);
    scene.add(janine.group);
    this.addNameTagToObject(janine.group, "JANINE", 0, 2.1, 0);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.08, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8d6a4a, roughness: 0.9 })
    );
    table.position.set(kaffeePos.x, 0.95, kaffeePos.z);
    table.castShadow = true;
    scene.add(table);
    for (const bx of [-0.6, 0.6]) {
      for (const bz of [-0.22, 0.22]) {
        const bein = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.9, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x5a5f64, roughness: 0.9 })
        );
        bein.position.set(kaffeePos.x + bx, 0.46, kaffeePos.z + bz);
        scene.add(bein);
      }
    }
    for (const tx of [-0.5, -0.1, 0.35]) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 0.26, 10),
        new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.4, metalness: 0.5 })
      );
      pot.position.set(kaffeePos.x + tx, 1.12, kaffeePos.z);
      scene.add(pot);
    }

    // Lambert Prison — Platzwart in Warnweste
    this.lambert = buildPerson({ shirt: 0xf2c018, trousers: 0x2f3a45, hair: 0x5a4632 });
    this.loader = new WheelLoader(scene);
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

    // Einweisen hat Vorrang: sobald ein LKW auf dem Platz rangiert. Was er
    // gerade in der Schaufel hat oder vor sich herschiebt, laesst er dafuer
    // aber nicht mitten auf dem Platz stehen.
    const gebunden = this.lambertState === "carry" || this.lambertState === "shoving";
    if (truck && !gebunden) {
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
      // zügiges Arbeitstempo: die Wege um den Schwenkbereich herum sind lang,
      // bei Schlendertempo käme er kaum hinterher
      const vorher = { x: g.position.x, z: g.position.z };
      // Mit dem Radlader ist er deutlich schneller unterwegs als zu Fuß
      const tempo = (this.hasLoader ? LOADER_SPEED : 2.2) * (this.getSpeedBonus?.() ?? 1);
      g.position.addScaledVector(step, tempo * dt);
      // Sicherheitsnetz: landet der Schritt trotz Ausweichen in einem
      // Bauwerk, wird er verworfen — Lambert läuft durch nichts hindurch
      if (hitsObstacle(g.position.x, g.position.z, 0.35)) {
        g.position.x = vorher.x;
        g.position.z = vorher.z;
      }
      g.rotation.y = Math.atan2(step.x, step.z);
      this.walkPhase += dt * 7;
      this.loader?.update(dt, g.position, g.rotation.y, true);
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
      this.loader?.update(dt, g.position, g.rotation.y, false);
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

    // Schaufelstellung: gesenkt zum Aufnehmen und Schieben, gehoben zum Fahren
    if (this.hasLoader) {
      this.loader?.setLift(this.lambertState === "carry");
    }

    this.fuehreLast(g);
  }

  /**
   * Was Lambert gerade bewegt, mit ihm mitfuehren.
   *
   * Zu Fuss traegt er es vor der Brust. Mit dem Radlader liegt es in der
   * Schaufel — und beim Schieben eben davor am Boden: Ein Radlader hebt einen
   * Traeger nicht auf Brusthoehe, er schiebt ihn ueber den Beton.
   */
  private fuehreLast(g: THREE.Object3D): void {
    if (!this.carriedItemId || !this.lastAufgenommen) return;
    const it = this.items.items.find((i) => i.id === this.carriedItemId);
    if (!it || !it.body.isValid()) {
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      return;
    }
    let ziel: THREE.Vector3;
    if (this.hasLoader && this.loader) {
      ziel = this.loader.bucketPosition(this.lastTmp);
      if (this.lambertState === "shoving") {
        // vor der Schneide, am Boden — nicht in der Schaufel
        ziel.set(
          g.position.x + Math.sin(g.rotation.y) * 2.4,
          0.35,
          g.position.z + Math.cos(g.rotation.y) * 2.4
        );
      }
    } else {
      ziel = this.lastTmp.set(g.position.x, 1.15, g.position.z + 0.35);
    }
    it.body.setTranslation({ x: ziel.x, y: ziel.y, z: ziel.z }, true);
    it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  private lastTmp = new THREE.Vector3();
  /**
   * Erst ab dem Moment, in dem er beim Teil steht, nimmt er es mit. Ohne das
   * sprang es ihm quer ueber den Platz entgegen, sobald er es sich vorgenommen
   * hatte — beim Schieben faellt so etwas sofort auf.
   */
  private lastAufgenommen = false;

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
    this.lastAufgenommen = false;
    this.lambertState = "patrol";
    this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
    this.lambertTarget.copy(this.patrol[this.patrolIdx]);
  }

  /** Reaktion beim Erreichen des Ziels — je nach Aufgabe. */
  private onArrived(): void {
    if (this.lambertState === "guide") return;

    if (this.lambertState === "shove") {
      // Hinter dem Teil angekommen: aufnehmen und in Richtung Bagger schieben
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      const ex = this.getExcavatorPos?.();
      if (it && it.body.isValid() && ex) {
        const p = it.body.translation();
        const [zx, zz] = schiebeZiel(p.x, p.z, ex.x, ex.z);
        this.lambertState = "shoving";
        this.lastAufgenommen = true;
        this.lambertTarget.set(zx, 0, zz);
      } else {
        this.carriedItemId = null;
        this.lastAufgenommen = false;
        this.lambertState = "patrol";
      }
      return;
    }
    if (this.lambertState === "shoving") {
      // Abgeliefert: Teil liegt jetzt im Arbeitsbereich des Baggers
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid()) {
        it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      this.lambertState = "patrol";
      // Ein Stueck zuruecksetzen, sonst steht er dem Bagger im Schwenkbereich
      this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
      return;
    }
    if (this.lambertState === "fetch") {
      // Aufgenommen — jetzt zur Box, in die das Material gehört
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it) {
        const mulde = StaffManager.muldeFuer(it.materialId);
        if (mulde) {
          this.lambertState = "carry";
          this.lastAufgenommen = true;
          // vor der Mulde stehen bleiben, nicht mitten hinein fahren
          const [ax, az] = StaffManager.anlieferPunkt(mulde);
          this.lambertTarget.set(ax, 0, az);
        } else {
          this.carriedItemId = null;
          this.lastAufgenommen = false;
          this.lambertState = "patrol";
        }
      } else {
        this.carriedItemId = null;
        this.lastAufgenommen = false;
        this.lambertState = "patrol";
      }
      return;
    }
    if (this.lambertState === "carry") {
      // In die Box legen: Lambert wirft es über die Wand hinein
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid()) {
        const mulde = StaffManager.muldeFuer(it.materialId);
        if (mulde) {
          // Ueber die Wand gekippt: aus Schaufelhoehe in die Mulde fallen
          // lassen, nicht am Boden absetzen — sonst haengt es in der Wand.
          it.body.setTranslation(
            {
              x: mulde.x + (Math.random() - 0.5) * 1.2,
              y: mulde.size[2] - 0.6,
              z: mulde.z + (Math.random() - 0.5) * 1.2,
            },
            true
          );
          it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      this.lambertState = "patrol";
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
      return;
    }

    // Patrouille: regelmäßig nach einem verirrten Kleinteil sehen
    if (this.stateT > 0.8) {
      this.stateT = 0;
      const hol = (it: (typeof this.items.items)[number]): void => {
        this.carriedItemId = it.id;
        const p = it.body.translation();
        this.lambertTarget.set(p.x, 0, p.z);
        this.lambertState = "fetch";
      };
      // Reihenfolge mit Absicht: Eine blockierte Fahrspur legt den Betrieb
      // lahm. Danach kommt, was der Bagger nicht erreicht — daran kommt sonst
      // niemand heran, waehrend Sortierteile nur liegenbleiben und warten.
      // Stuende das Sortieren davor, wuerde nie geschoben: Es liegt immer
      // irgendwo noch ein Stueck Buntmetall herum (gemessen 10.09.2026).
      const blocker = this.findBlocker();
      if (blocker) {
        hol(blocker);
        return;
      }
      const weit = this.findSchiebegut();
      if (weit) {
        const p = weit.body.translation();
        const ex = this.getExcavatorPos!();
        const [ax, az] = anstellPunkt(p.x, p.z, ex.x, ex.z);
        this.carriedItemId = weit.id;
        this.lambertTarget.set(ax, 0, az);
        this.lambertState = "shove";
        return;
      }
      const stray = this.findStray();
      if (stray) {
        hol(stray);
        return;
      }
      this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
    }
  }

  /**
   * Schrott, an den der Bagger nicht herankommt.
   *
   * Der Wunsch dahinter (10.09.2026): "Der soll den Schrott, der nicht
   * erreichbar ist, zu mir schieben." Gesucht wird deshalb nach Gewicht und
   * Entfernung, nicht nach Material — was zu weit draussen liegt, blockiert
   * den Betrieb, egal was drinsteckt. Ganz kleine Teile bleiben aussen vor —
   * dafuer lohnt die Fahrt nicht.
   */
  private findSchiebegut(): (typeof this.items.items)[number] | null {
    if (!this.hasLoader) return null;
    const ex = this.getExcavatorPos?.();
    if (!ex) return null;
    const gr = this.getGrapplePos?.();
    const von = this.lambert.group.position;
    let best: (typeof this.items.items)[number] | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      // Fuer eine Schraube faehrt niemand den Lader an
      if (it.massKg < SCHIEB_MIN_KG) continue;
      const p = it.body.translation();
      if (p.y > 1.4) continue;
      if (!brauchtSchieben(p.x, p.z, ex.x, ex.z)) continue;
      // Was in einer Mulde oder auf einer Ladeflaeche liegt, liegt richtig
      if (hitsObstacle(p.x, p.z, 0.4)) continue;
      // Und was auf einer Sortierflaeche liegt — vor allem im Stahlhaufen —
      // liegt ebenfalls richtig. Dessen Rand ist gut 9 m vom Bagger entfernt;
      // ohne diese Regel schob Lambert den Haufen endlos in sich zusammen
      // (gemessen 10.09.2026).
      if (StaffManager.inZone(p.x, p.z)) continue;
      // Nur auf dem Arbeitsteil des Platzes, nicht hinten bei den Gebaeuden
      if (p.z < -12 || p.z > 22 || p.x < -24 || p.x > 4) continue;
      if (gr && Math.hypot(p.x - gr.x, p.z - gr.z) < StaffManager.GRAPPLE_KEEPOUT) continue;
      // Das Ziel muss frei sein, sonst schiebt er es gegen den naechsten Haufen
      const [zx, zz] = schiebeZiel(p.x, p.z, ex.x, ex.z);
      if (Math.hypot(zx - ex.x, zz - ex.z) < SCHIEB_MIN_M) continue;
      if (hitsObstacle(zx, zz, 0.8)) continue;
      const [ax, az] = anstellPunkt(p.x, p.z, ex.x, ex.z);
      if (!this.reachable(ax, az)) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  /**
   * Wohin gehört welche Fraktion? Direkt aus containers.ts gelesen.
   *
   * Vorher standen die Koordinaten hier abgeschrieben — und blieben beim
   * Verschieben der Muldenzeile zurueck: Lambert trug Buntmetall zu einer
   * Stelle, an der seit dem Umbau nur noch Beton war. Zwei Wahrheiten ueber
   * dieselbe Sache halten nie. Stahl fehlt bewusst: der bleibt Sache des
   * Baggers, und das Ballenlager ist keine Mulde.
   */
  private static muldeFuer(materialId: string): ContainerConfig | undefined {
    return CONFIGS.find((c) => c.kind === "bay" && c.fractionId === materialId);
  }

  /** Halteplatz vor einer Mulde: vor ihrer offenen Seite, nicht darin. */
  private static anlieferPunkt(c: ContainerConfig): [number, number] {
    const [w, d] = c.size;
    if (c.facing === "north") return [c.x, c.z + d / 2 + 2.2];
    if (c.facing === "east") return [c.x + w / 2 + 2.2, c.z];
    return [c.x - w / 2 - 2.2, c.z];
  }

  /**
   * Freier Weg von Lambert zum Ziel? Abgetastet wird die Luftlinie in
   * Meterschritten gegen die festen Bauten. Was nur um Ecken erreichbar wäre,
   * lässt er stehen — dafür ist der Bagger da.
   */
  private reachable(tx: number, tz: number): boolean {
    const from = this.lambert.group.position;
    const dx = tx - from.x;
    const dz = tz - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.reichweite) return false;
    const steps = Math.ceil(dist);
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      if (hitsObstacle(from.x + dx * f, from.z + dz * f, 0.5)) return false;
    }
    return true;
  }


  /**
   * So weit macht er sich auf den Weg. Zu Fuss ist bei 26 m Schluss — alles
   * Weitere waere ein halber Arbeitstag fuer ein Kleinteil. Mit dem Radlader
   * faehrt er den ganzen Platz ab; genau dafuer ist er da, denn was ganz
   * aussen liegt, erreicht sonst niemand (Wunsch 10.09.2026).
   */
  private get reichweite(): number {
    return this.hasLoader ? 60 : 26;
  }

  /** Wo Lambert gerade steht — der Baggerarm weicht ihm aus. */
  lambertPosition(): THREE.Vector3 {
    return this.lambert.group.position;
  }

  /** Abstand zur Maschine selbst — sie steht, er geht drumherum */
  private static readonly EXCAVATOR_KEEPOUT = 4.2;
  /** Abstand zur arbeitenden Spinne — darunter macht er Platz */
  private static readonly GRAPPLE_KEEPOUT = 5.5;
  private avoidTmp = new THREE.Vector3();
  private slideTmp = { x: 0, z: 0 };

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
    const gr = this.getGrapplePos?.();
    if (gr) push(gr.x, gr.z, StaffManager.GRAPPLE_KEEPOUT);
    for (const c of this.getObstaclePositions?.() ?? []) push(c.x, c.z, 3.2);
    /*
     * Sperrige Schrottteile: zu Fuss steigt er nicht darueber, er geht
     * drumherum. Mit dem Radlader gilt das nur noch fuer richtige Brocken —
     * Kleinzeug schiebt so eine Maschine beiseite. Ohne diese Ausnahme blieb
     * er im Stahlhaufen stehen: Ringsum drueckte ihn alles gleichzeitig weg,
     * unterm Strich bewegte er sich nicht mehr (gemessen 10.09.2026).
     */
    const schwelle = this.hasLoader ? 400 : 120;
    for (const it of this.items.items) {
      if (it.massKg < schwelle || !it.body.isValid()) continue;
      const q = it.body.translation();
      if (Math.abs(q.x - pos.x) > 3 || Math.abs(q.z - pos.z) > 3) continue;
      if (it.id === this.carriedItemId) continue; // sein eigenes Ziel nicht
      push(q.x, q.z, this.hasLoader ? 1.2 : 1.5);
    }
    out.y = 0;
    out.normalize();
    // Feste Bauten — Betonlego, Boxen, Schere — laufen lassen sich nicht
    // wegdrücken: hier wird die Richtung an der Wand entlang umgelenkt.
    if (slideAround(pos.x, pos.z, out.x, out.z, 0.7, this.slideTmp)) {
      out.set(this.slideTmp.x, 0, this.slideTmp.z);
    }
    return out.normalize();
  }

  /**
   * Teil, das gerade eine Fahrspur blockiert. Daran haengt der ganze Betrieb,
   * deshalb hat es Vorrang vor allem anderen.
   */
  private findBlocker(): (typeof this.items.items)[number] | null {
    const stoerfall = this.getBlockingItem?.();
    if (
      stoerfall &&
      stoerfall.body.isValid() &&
      stoerfall.massKg <= this.tragkraft &&
      this.reachable(stoerfall.body.translation().x, stoerfall.body.translation().z)
    ) {
      return stoerfall;
    }
    return null;
  }

  /** Kleinteil, das frei herumliegt (nicht in einer Zone, nicht gegriffen). */
  private findStray(): (typeof this.items.items)[number] | null {
    // Lamberts Hauptaufgabe: Buntmetall aus dem Stahlschrott holen und in die
    // passende Box legen. Stahl und Störstoff lässt er liegen — der eine ist
    // Sache des Baggers, der andere kommt gesondert weg. Das nächstgelegene
    // Teil hat Vorrang, damit er nicht quer über den Platz läuft, während
    // Vorrang hat immer, was eine Fahrspur blockiert — daran hängt der
    // ganze Betrieb, und ein Kleinteil in der Box kann warten.
    const stoerfall = this.findBlocker();
    if (stoerfall) return stoerfall;

    // neben ihm etwas liegt.
    const ex = this.getExcavatorPos?.();
    const gr = this.getGrapplePos?.();
    const von = this.lambert.group.position;
    let best: (typeof this.items.items)[number] | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      // Was er heben kann, hängt am Ausbau: von Hand nur Kleinteile, mit
      // Stapler auch schwerere Stücke, mit Radlader ganze Brocken.
      if (it.massKg > this.tragkraft) continue;
      const mulde = StaffManager.muldeFuer(it.materialId);
      if (!mulde) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const p = it.body.translation();
      if (p.y > 1.4) continue;
      // Liegt es schon in seiner Box, bleibt es dort. Alles andere — auch was
      // im Stahlhaufen steckt — holt er heraus; genau das ist seine Aufgabe.
      if (Math.hypot(p.x - mulde.x, p.z - mulde.z) < 2.8) continue;
      // Der Arbeitsteil des Platzes. Nach Sueden reicht er bis hinter die
      // letzte Mulde — die Zeile endet bei z = -17,65, und was daneben liegt,
      // soll er einraeumen duerfen.
      if (Math.abs(p.x) > 22 || p.z < -20 || p.z > 22) continue;
      // Nicht dort zugreifen, wo die Spinne gerade arbeitet
      if (gr && Math.hypot(p.x - gr.x, p.z - gr.z) < StaffManager.GRAPPLE_KEEPOUT) continue;
      if (ex && Math.hypot(p.x - ex.x, p.z - ex.z) < StaffManager.EXCAVATOR_KEEPOUT) continue;
      // Nur holen, wohin ein freier Weg führt — was hinter Boxen oder Mauern
      // liegt, ist Baggerarbeit
      if (!this.reachable(p.x, p.z)) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}
