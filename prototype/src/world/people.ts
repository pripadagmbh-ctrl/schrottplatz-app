import * as THREE from "three";
import { umkugelRadius, type ItemManager } from "./scrapItems";
import { hitsObstacle, slideAround } from "./obstacles";
import { CONFIGS, type ContainerConfig } from "./containers";
import { KAFFEE_ROT } from "./yard";
import { findeBox, ausBox, type Box } from "./boxen";
import { wegFrei, SCHAUFEL_BREITE, type WegTeil } from "./weg";
import { KAFFEE_THEKE } from "./yard";
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

export interface PersonParts {
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
 *   zurBude geht zu Janine, weil gerade nichts zu holen ist
 *   kaffee  steht an der Theke
 *   zurueckZurMaschine geht zurueck zum Radlader
 *
 * Die beiden letzten gibt es nur mit Radlader — von Hand schiebt niemand
 * einen halben Motorblock ueber den Platz.
 */
/**
 * Janines Kaffeewagen (Wunsch 11.09.2026).
 *
 * Ein alter Anhänger mit runder Alu-Haube, Verkaufsklappe zur Hofseite, die
 * als Vordach hochsteht, Theke mit Siebträgermaschine, zwei Hockern und einer
 * Lichterkette. Auf einem Schrottplatz ist so ein Wagen der einzige Ort mit
 * Farbe — deshalb Mintgrün und Messing statt Grau.
 */
function buildKaffeewagen(scene: THREE.Scene, pos: THREE.Vector3, rot: number): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos);
  // Klappe und Theke sitzen in +x; die Drehung richtet sie zum Platz aus
  g.rotation.y = rot;
  scene.add(g);

  const alu = new THREE.MeshStandardMaterial({ color: 0xd8dee0, roughness: 0.25, metalness: 0.85 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x5fbfa8, roughness: 0.5, metalness: 0.2 });
  const messing = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.8 });
  const holz = new THREE.MeshStandardMaterial({ color: 0x8d6a4a, roughness: 0.85 });
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.8 });

  // Wagenkasten: unten Mintband, oben die runde Aluhaube
  const L = 4.2; // Länge in z
  const B = 2.1; // Breite in x
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(B, 1.05, L), mint);
  kasten.position.set(0, 1.05, 0);
  kasten.castShadow = true;
  g.add(kasten);
  const haube = new THREE.Mesh(new THREE.CylinderGeometry(B / 2, B / 2, L, 16, 1, false, 0, Math.PI), alu);
  haube.rotation.z = Math.PI / 2;
  haube.rotation.y = Math.PI / 2;
  haube.position.set(0, 1.58, 0);
  haube.castShadow = true;
  g.add(haube);
  // Zierstreifen auf halber Höhe
  const streifen = new THREE.Mesh(new THREE.BoxGeometry(B + 0.04, 0.12, L + 0.04), messing);
  streifen.position.set(0, 1.55, 0);
  g.add(streifen);

  // Verkaufsklappe zur Ostseite, hochgestellt als Vordach
  const klappe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, L - 1.2), alu);
  klappe.position.set(B / 2 + 0.55, 2.35, 0);
  klappe.rotation.z = -1.15;
  klappe.castShadow = true;
  g.add(klappe);
  const oeffnung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, L - 1.4), dunkel);
  oeffnung.position.set(B / 2 + 0.01, 1.55, 0);
  g.add(oeffnung);
  // Theke: Brett vor der Öffnung
  const theke = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, L - 1.4), holz);
  theke.position.set(B / 2 + 0.28, 1.12, 0);
  theke.castShadow = true;
  g.add(theke);
  // Siebträgermaschine und Mühle auf der Theke
  const maschine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.6), messing);
  maschine.position.set(B / 2 + 0.25, 1.36, -0.8);
  g.add(maschine);
  const muehle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 10), dunkel);
  muehle.position.set(B / 2 + 0.25, 1.37, 0.1);
  g.add(muehle);
  for (const tz of [0.7, 0.95, 1.2]) {
    const tasse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8), alu);
    tasse.position.set(B / 2 + 0.35, 1.2, tz);
    g.add(tasse);
  }

  // Räder und Deichsel — es ist ein Anhänger, kein Kiosk
  for (const rz of [-0.9, 0.9]) {
    const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 14), dunkel);
    rad.rotation.z = Math.PI / 2;
    rad.position.set(B / 2 - 0.05, 0.34, rz);
    g.add(rad);
    const links = rad.clone();
    links.position.x = -B / 2 + 0.05;
    g.add(links);
  }
  const stuetzen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), dunkel);
  stuetzen.position.set(0, 0.25, -L / 2 + 0.3);
  g.add(stuetzen);
  const deichsel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3), dunkel);
  deichsel.position.set(0, 0.55, L / 2 + 0.6);
  g.add(deichsel);

  // Zwei Hocker und ein Stehtisch davor
  for (const hz of [-0.9, 0.6]) {
    const sitz = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10), holz);
    sitz.position.set(B / 2 + 1.5, 0.75, hz);
    g.add(sitz);
    const bein = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.72, 8), messing);
    bein.position.set(B / 2 + 1.5, 0.36, hz);
    g.add(bein);
  }

  // Lichterkette über der Klappe
  for (let i = 0; i < 7; i++) {
    const birne = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffe2a8,
        emissive: 0xffc25a,
        emissiveIntensity: 0.85,
        roughness: 0.4,
      })
    );
    const t = i / 6 - 0.5;
    birne.position.set(B / 2 + 0.95, 2.25 - Math.cos(t * 2.4) * 0.16, t * (L - 1.4));
    g.add(birne);
  }

  // Kleine Tafel an der Wagenwand
  const tafel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.5), dunkel);
  tafel.position.set(B / 2 + 0.02, 0.9, -L / 2 + 0.5);
  g.add(tafel);
  return g;
}

/*
 * Lamberts Pausen (Auftrag 11.09.2026, Phase 0.2). Wenn nichts zu holen ist,
 * sitzt er nicht untaetig im Radlader — er geht zu Janine einen Kaffee
 * trinken und sieht danach wieder nach.
 */
/** Mindestabstand zwischen zwei Pausen (s) */
const PAUSE_ABSTAND_S = 180;
/** Pausendauer (s) — gewuerfelt */
const PAUSE_DAUER_S: [number, number] = [30, 90];
/** Kommt ein LKW, trinkt er aus: Rest halbiert, hoechstens so lange (s) */
const PAUSE_KURZ_MAX_S = 15;
/** So oft sieht er nach neuer Arbeit, wenn gerade nichts geht (s) */
const PRUEF_INTERVALL_S: [number, number] = [3, 5];
/** Korridorbreite zu Fuss — ein Mensch steigt ueber Kleinteile */
const FUSS_BREITE = 0.9;
/** Bis hierher traegt er von Hand, wenn der Radlader nicht hinkommt (kg) */
const HANDLAST_KG = 60;
/** In diesem Umkreis zaehlt ein Aufwachen als "von Lambert verursacht" (m) */
const WECK_RADIUS = 4;
/** So weit im Voraus werden schlafende Teile gemerkt (m) */
const WECK_MERK_RADIUS = 12;

/** Marios Gehtempo (m/s) — zuegig, er hat einen LKW warten. */
const MARIO_TEMPO = 2.0;

type LambertState =
  | "patrol"
  | "guide"
  | "fetch"
  | "carry"
  | "shove"
  | "shoving"
  | "zurBude"
  | "kaffee"
  | "zurueckZurMaschine";

export class StaffManager {
  private lambert: PersonParts;
  private mario!: PersonParts;
  /** Wohin Mario zur Kontrolle geht und wohin er zurueckkehrt */
  private readonly pruefPos = new THREE.Vector3();
  private readonly bueroTuer = new THREE.Vector3();
  private marioState: "innen" | "raus" | "pruefen" | "zurueck" = "innen";
  private marioT = 0;
  private marioPhase = 0;
  /**
   * Steht gerade ein Fahrzeug zur Kontrolle auf der Waage? Liefert dessen
   * Position — von main aus der Fahrzeugverwaltung gesetzt.
   */
  getWeighTruck: (() => THREE.Vector3 | null) | null = null;
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
    return (this.faehrt ? 900 : HANDLAST_KG) * (this.getLiftBonus?.() ?? 1);
  }

  /** Sitzt er gerade im Radlader? Zu Fuss gelten andere Regeln. */
  private get faehrt(): boolean {
    return this.hasLoader && !this.zuFuss;
  }
  /** Tempofaktor aus dem Bulldozer — von main gesetzt */
  getSpeedBonus: (() => number) | null = null;
  /** Traglastfaktor aus dem Stapler — von main gesetzt */
  getLiftBonus: (() => number) | null = null;

  /**
   * Zu Fuss unterwegs, obwohl der Radlader da ist: Wenn mit der Maschine
   * nichts zu erreichen ist, steigt er aus und sortiert Kleinteile von Hand
   * oder geht Kaffee trinken (Auftrag 11.09.2026, Rangfolge in Phase 0.2).
   */
  private zuFuss = false;
  /** Wo der Radlader steht, solange Lambert zu Fuss unterwegs ist. */
  private readonly maschinePos = new THREE.Vector3();
  /** Restliche Pausenzeit (s) */
  private pauseRestS = 0;
  /** Zeit seit der letzten Pause (s) — siehe PAUSE_ABSTAND_S */
  private seitPauseS = PAUSE_ABSTAND_S;
  /** Wann er das naechste Mal nach Arbeit sieht (s) */
  private naechstePruefung = 0;
  /** Zeit seit der letzten Arbeitssuche (s) */
  private pruefUhr = 0;
  /** Fuer das Debug-Overlay: von ihm aufgeweckte Koerper je Minute */
  private weckSpur: number[] = [];
  private schlafendeHandles = new Set<number>();
  private weckUhr = 0;
  /** Blickrichtung des abgestellten Radladers */
  private loaderYaw = 0;

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
    if (on) this.maschinePos.copy(this.lambert.group.position);
    this.zeigeRichtige();
  }

  /**
   * Zu Fuss oder auf der Maschine — nie beides. Steigt er aus, bleibt der
   * Radlader stehen, wo er ihn abgestellt hat.
   */
  private zeigeRichtige(): void {
    this.lambert.group.visible = !this.faehrt;
  }
  /** Karossen — durch die läuft er nicht hindurch */
  getObstaclePositions: (() => THREE.Vector3[]) | null = null;
  /**
   * Standflächen der Fahrzeuge. Weder zu Fuss noch mit dem Radlader geht es
   * durch einen stehenden LKW hindurch (Befund 11.09.2026).
   */
  getVehicleBoxes: (() => Box[]) | null = null;

  /**
   * @param weighPos Mitte der Wiegeplatte — dorthin geht Mario zur Kontrolle
   * @param kaffeePos Standplatz von Janines Kaffeewagen
   * @param bueroTuer Tür des Betriebsgebäudes — Marios Kommen und Gehen
   */
  constructor(
    scene: THREE.Scene,
    private items: ItemManager,
    weighPos: THREE.Vector3,
    kaffeePos: THREE.Vector3,
    bueroTuer: THREE.Vector3
  ) {
    /*
     * Mario arbeitet im Büro und kommt nur heraus, wenn ein LKW auf der Waage
     * steht (Wunsch 11.09.2026). Dann geht er an die Platte, sieht sich die
     * Ladung an und verschwindet wieder. Vorher stand er den ganzen Tag im
     * Freien neben der Waage — niemand macht das.
     */
    this.mario = buildPerson({ shirt: 0x2f5c8a, trousers: 0x2b2f33, hair: 0x39312b });
    this.bueroTuer.copy(bueroTuer);
    // Kontrollplatz: Westseite der Platte, also die Bueroseite — so laeuft er
    // nicht durch die Spur, in der der LKW gerade steht.
    this.pruefPos.set(weighPos.x - 3.2, 0, weighPos.z);
    this.mario.group.position.copy(bueroTuer);
    this.mario.group.visible = false;
    scene.add(this.mario.group);
    this.addNameTagToObject(this.mario.group, "MARIO", 0, 2.1, 0);
    const brett = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.9 })
    );
    brett.position.set(0.16, 1.05, 0.18);
    brett.rotation.z = 0.35;
    this.mario.group.add(brett);

    // Janine verkauft aus einem Kaffeewagen — kein Klapptisch mehr
    const wagen = buildKaffeewagen(scene, kaffeePos, KAFFEE_ROT);
    const janine = buildPerson({ shirt: 0xe8e2d5, trousers: 0x4a3b52, hair: 0x8a5a2b });
    /*
     * Janine haengt im Wagen, nicht daneben: Vorher stand sie in Weltkoordinaten
     * hinter der Aussenwand und war schlicht nicht zu sehen (Befund
     * 11.09.2026). Als Kind des Wagens dreht sie mit ihm mit, und der Platz
     * gilt im Wageninneren — direkt an der Klappe, Oberkoerper ueber der Theke.
     */
    janine.group.position.set(0.45, 0.55, 0);
    janine.group.rotation.y = Math.PI / 2; // schaut aus der Klappe heraus
    janine.legLeft.visible = false; // steht hinter der Theke
    janine.legRight.visible = false;
    wagen.add(janine.group);
    this.addNameTagToObject(janine.group, "JANINE", 0, 1.35, 0);

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
    this.seitPauseS += dt;
    this.pruefUhr += dt;
    const g = this.lambert.group;
    this.zaehleGeweckte(dt);

    // --- Kaffeepause ---
    if (this.lambertState === "kaffee") {
      // Kommt ein LKW, trinkt er aus: Rest halbiert, hoechstens 15 Sekunden.
      if (truck && this.pauseRestS > PAUSE_KURZ_MAX_S) {
        this.pauseRestS = Math.min(this.pauseRestS / 2, PAUSE_KURZ_MAX_S);
      }
      this.pauseRestS -= dt;
      if (this.pauseRestS <= 0) {
        this.lambert.armRight.rotation.x = 0;
        // Gemaechlich zurueck zur Maschine — oder gleich weiterarbeiten
        this.lambertState = this.hasLoader ? "zurueckZurMaschine" : "patrol";
        this.lambertTarget.copy(this.hasLoader ? this.maschinePos : this.patrol[this.patrolIdx]);
      }
      this.loader?.update(dt, this.maschinePos, this.loaderYaw, false);
      return; // waehrend der Pause keine Wegpruefungen
    }

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
      const fahrzeug = this.getVehicleBoxes?.();
      if (
        hitsObstacle(g.position.x, g.position.z, 0.35) ||
        (fahrzeug && findeBox(g.position.x, g.position.z, fahrzeug, this.eigenRadius))
      ) {
        g.position.x = vorher.x;
        g.position.z = vorher.z;
      }
      g.rotation.y = Math.atan2(step.x, step.z);
      this.walkPhase += dt * 7;
      if (this.faehrt) {
        this.loaderYaw = g.rotation.y;
        this.loader?.update(dt, g.position, g.rotation.y, true);
      } else {
        this.loader?.update(dt, this.maschinePos, this.loaderYaw, false);
      }
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
      this.loader?.update(dt, this.faehrt ? g.position : this.maschinePos, this.loaderYaw, false);
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
    this.updateMario(dt);
  }

  /**
   * Mario zwischen Büro und Waage.
   *
   *   innen    unsichtbar im Gebäude — sein Normalzustand
   *   raus     unterwegs zur Platte, sobald dort ein LKW steht
   *   pruefen  steht an der Ladung und sieht sie durch
   *   zurueck  geht wieder hinein
   *
   * Gerufen wird er von der Fahrzeugverwaltung: bei der Einfahrtswiegung
   * immer, bei der Ausfahrt nur für Abholer — die fahren voll vom Hof, und
   * was rausgeht, sieht er sich an (Wunsch 11.09.2026).
   */
  private updateMario(dt: number): void {
    const m = this.mario.group;
    const lkw = this.getWeighTruck?.() ?? null;
    this.marioT += dt;

    switch (this.marioState) {
      case "innen":
        if (lkw) {
          this.marioState = "raus";
          this.marioT = 0;
          m.visible = true;
          m.position.copy(this.bueroTuer);
        }
        break;
      case "raus":
        if (this.geheZu(m, this.pruefPos, dt)) {
          this.marioState = "pruefen";
          this.marioT = 0;
        }
        // Laeuft der LKW weg, bevor er da ist, dreht er wieder um
        if (!lkw && this.marioT > 1.5) {
          this.marioState = "zurueck";
          this.marioT = 0;
        }
        break;
      case "pruefen": {
        // Zur Ladung schauen und das Klemmbrett halten
        const ziel = lkw ?? this.pruefPos;
        const dx = ziel.x - m.position.x;
        const dz = ziel.z - m.position.z;
        if (Math.hypot(dx, dz) > 0.2) m.rotation.y = Math.atan2(dx, dz);
        this.mario.armLeft.rotation.x = -1.15;
        this.mario.armRight.rotation.x = -1.25;
        // Fertig, wenn der LKW weg ist — oder nach einer halben Minute, damit
        // er nicht draussen stehen bleibt, falls das Signal haengt
        if (!lkw || this.marioT > 30) {
          this.marioState = "zurueck";
          this.marioT = 0;
          this.mario.armLeft.rotation.x = 0;
          this.mario.armRight.rotation.x = 0;
        }
        break;
      }
      case "zurueck":
        // Kommt der naechste, dreht er auf dem Absatz um
        if (lkw) {
          this.marioState = "raus";
          this.marioT = 0;
          break;
        }
        if (this.geheZu(m, this.bueroTuer, dt)) {
          this.marioState = "innen";
          this.marioT = 0;
          m.visible = false;
        }
        break;
    }
  }

  /**
   * Einen Schritt Richtung Ziel gehen. Liefert true, sobald er da ist.
   * Bewusst ohne Ausweichlogik: Sein Weg führt über den freien Vorplatz.
   */
  private geheZu(m: THREE.Object3D, ziel: THREE.Vector3, dt: number): boolean {
    const dx = ziel.x - m.position.x;
    const dz = ziel.z - m.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      this.mario.legLeft.rotation.x = 0;
      this.mario.legRight.rotation.x = 0;
      return true;
    }
    const schritt = Math.min(MARIO_TEMPO * dt, d);
    m.position.x += (dx / d) * schritt;
    m.position.z += (dz / d) * schritt;
    m.rotation.y = Math.atan2(dx, dz);
    this.marioPhase += dt * 7;
    const swing = Math.sin(this.marioPhase) * 0.5;
    this.mario.legLeft.rotation.x = swing;
    this.mario.legRight.rotation.x = -swing;
    this.mario.armLeft.rotation.x = -swing * 0.6;
    this.mario.armRight.rotation.x = swing * 0.6;
    return false;
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

    if (this.lambertState === "zurBude") {
      // An der Theke angekommen: Kaffee, und in der Zeit keine Wegpruefungen
      this.lambertState = "kaffee";
      this.pauseRestS =
        PAUSE_DAUER_S[0] + Math.random() * (PAUSE_DAUER_S[1] - PAUSE_DAUER_S[0]);
      this.lambert.armRight.rotation.x = -1.3;
      const zx = KAFFEE_THEKE.x - this.lambert.group.position.x;
      const zz = KAFFEE_THEKE.z + 1.2 - this.lambert.group.position.z;
      this.lambert.group.rotation.y = Math.atan2(zx, zz);
      return;
    }
    if (this.lambertState === "kaffee") return; // wird in update() abgezaehlt
    if (this.lambertState === "zurueckZurMaschine") {
      // Wieder aufgestiegen
      this.zuFuss = false;
      this.zeigeRichtige();
      this.lambertState = "patrol";
      this.naechstePruefung = 0;
      return;
    }

    // Nichts zu tun: In festem Takt nach Arbeit sehen, nicht jedes Bild.
    // Die Uhr laeuft in update() mit; hier wird nur abgelesen.
    if (this.pruefUhr < this.naechstePruefung) return;
    this.pruefUhr = 0;
    this.stateT = 0;
    this.naechstePruefung =
      PRUEF_INTERVALL_S[0] + Math.random() * (PRUEF_INTERVALL_S[1] - PRUEF_INTERVALL_S[0]);
    this.waehleAufgabe();
  }

  /**
   * Rangfolge seiner Arbeit (Auftrag 11.09.2026, Phase 0.2):
   *
   *   1. erreichbare Radlader-Arbeit
   *   2. sonst aussteigen und Kleinteile von Hand sortieren
   *   3. sonst Kaffeepause bei Janine
   *   4. sonst warten und gleich wieder nachsehen
   *
   * "Erreichbar" heisst: Der Fahrweg ist frei (siehe world/weg.ts). Vorher
   * fuhr er auf das naechstgelegene Teil zu, egal was dazwischen lag — und
   * pfluegte dabei durch den Haufen.
   */
  private waehleAufgabe(): void {
    const hol = (it: (typeof this.items.items)[number]): void => {
      this.carriedItemId = it.id;
      const p = it.body.translation();
      this.lambertTarget.set(p.x, 0, p.z);
      this.lambertState = "fetch";
    };
    // Eine blockierte Fahrspur legt den Betrieb lahm und hat Vorrang. Danach
    // kommt, was der Bagger nicht erreicht — daran kommt sonst niemand heran,
    // waehrend Sortierteile nur liegenbleiben. Stuende das Sortieren davor,
    // wuerde nie geschoben: Es liegt immer noch irgendwo Buntmetall herum.
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
    /*
     * Mit der Maschine ist nichts zu erreichen? Dann aussteigen und von Hand
     * sortieren — zu Fuss ist der Korridor schmal, er steigt ja drueber.
     * Erst nachsehen, dann absteigen: Sonst stand er neben dem Radlader und
     * hatte trotzdem nichts zu tun (Befund beim Messen 11.09.2026).
     */
    if (this.faehrt) {
      this.zuFuss = true; // nur fuer die Suche
      const kleinteil = this.findStray();
      this.zuFuss = false;
      if (kleinteil) {
        this.steigeAb();
        hol(kleinteil);
        return;
      }
    }
    if (this.gehePause()) return;
    this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
    this.lambertTarget.copy(this.patrol[this.patrolIdx]);
  }

  /**
   * Wie viele schlafende Koerper Lambert aufweckt (Auftrag 11.09.2026,
   * Phase 0.2: Debug-Overlay vorher/nachher).
   *
   * Gezaehlt wird, was in seiner Naehe von schlafend auf wach springt —
   * genau das kostet Rechenzeit, und genau das soll die Wegregel verhindern.
   * Gemessen wird viermal je Sekunde, das reicht fuer eine Rate je Minute.
   */
  private zaehleGeweckte(dt: number): void {
    this.weckUhr += dt;
    if (this.weckUhr < 0.25) return;
    this.weckUhr = 0;
    const p = this.lambert.group.position;
    let neu = 0;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const q = it.body.translation();
      const d = Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z));
      // Im weiteren Umkreis merken, im engeren zaehlen: Sonst entgeht das
      // Aufwachen genau der Teile, auf die er gerade zufaehrt.
      if (d > WECK_MERK_RADIUS) continue;
      const h = it.body.handle;
      if (it.body.isSleeping()) {
        this.schlafendeHandles.add(h);
      } else if (this.schlafendeHandles.delete(h) && d <= WECK_RADIUS) {
        neu++;
      }
    }
    this.weckSpur.push(neu);
    // Ein Fenster von einer Minute: 240 Messungen a 0,25 s
    if (this.weckSpur.length > 240) this.weckSpur.shift();
  }

  /** Von Lambert aufgeweckte Koerper je Minute (gleitendes Fenster). */
  get geweckteProMinute(): number {
    if (this.weckSpur.length === 0) return 0;
    const summe = this.weckSpur.reduce((a, b) => a + b, 0);
    return (summe / this.weckSpur.length) * 240;
  }

  /** Was Lambert gerade tut — fuers Debug-Overlay. */
  get taetigkeit(): string {
    return `${this.lambertState}${this.zuFuss ? " (zu Fuss)" : ""}`;
  }

  /** Aus dem Radlader steigen; die Maschine bleibt stehen, wo sie steht. */
  private steigeAb(): void {
    if (!this.hasLoader || this.zuFuss) return;
    this.maschinePos.copy(this.lambert.group.position);
    this.zuFuss = true;
    this.zeigeRichtige();
  }

  /**
   * Kaffeepause, wenn nichts zu holen ist — aber nicht ununterbrochen:
   * zwischen zwei Pausen liegen mindestens drei Minuten.
   */
  private gehePause(): boolean {
    if (this.seitPauseS < PAUSE_ABSTAND_S) return false;
    this.steigeAb();
    this.seitPauseS = 0;
    this.lambertState = "zurBude";
    this.lambertTarget.set(KAFFEE_THEKE.x + (Math.random() - 0.5) * 2.0, 0, KAFFEE_THEKE.z - 0.6);
    return true;
  }

  /**
   * Messschalter: Mit `true` faehrt er wieder wie vorher, quer durch alles.
   * Der Auftrag verlangt einen Vorher-Nachher-Vergleich der aufgeweckten
   * Koerper (Phase 0.2) — dafuer muss sich das alte Verhalten herstellen
   * lassen, ohne den Code zurueckzubauen. Im Spiel bleibt der Schalter aus.
   */
  pfluegenErlaubt = false;

  /**
   * Ist der Weg von Lambert zu (x,z) frei? Mit der Maschine gilt die
   * Schaufelbreite, zu Fuss ein schmaler Korridor — ein Mensch steigt ueber
   * Kleinteile, ein Radlader schiebt sie vor sich her.
   */
  private wegIstFrei(zielX: number, zielZ: number, ausser?: { id: string }): boolean {
    if (this.pfluegenErlaubt) return true;
    const von = this.lambert.group.position;
    this.wegTeile.length = 0;
    let ausserTeil: WegTeil | undefined;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const p = it.body.translation();
      if (p.y > 1.6) continue;
      const eintrag: WegTeil = {
        x: p.x,
        z: p.z,
        r: it.shape ? umkugelRadius(it.shape) : 0.3,
        massKg: it.massKg,
        schlaeft: it.body.isSleeping(),
      };
      this.wegTeile.push(eintrag);
      if (ausser && it.id === ausser.id) ausserTeil = eintrag;
    }
    return wegFrei(
      von.x,
      von.z,
      zielX,
      zielZ,
      this.wegTeile,
      this.faehrt ? SCHAUFEL_BREITE : FUSS_BREITE,
      ausserTeil
    );
  }

  private wegTeile: WegTeil[] = [];

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
      // Nicht durch den Haufen pfluegen: Der Anstellpunkt muss anfahrbar sein
      if (!this.wegIstFrei(ax, az, it)) continue;
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
  /** Wie breit er selbst baut: zu Fuss schmal, mit dem Radlader eine Maschine. */
  private get eigenRadius(): number {
    return this.hasLoader ? 1.9 : 0.5;
  }
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
    // Fahrzeuge: an der Kante entlang statt hinein. Sie stehen schraeg auf
    // dem Hof, deshalb die gedrehte Box und nicht nur ein Umkreis.
    const boxen = this.getVehicleBoxes?.();
    if (boxen) {
      const vorn = findeBox(
        pos.x + out.x * (this.eigenRadius + 1.2),
        pos.z + out.z * (this.eigenRadius + 1.2),
        boxen,
        this.eigenRadius
      );
      if (vorn) {
        ausBox(pos.x, pos.z, vorn, this.slideTmp);
        out.set(this.slideTmp.x, 0, this.slideTmp.z);
      }
    }

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
      if (!this.wegIstFrei(p.x, p.z, it)) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}
