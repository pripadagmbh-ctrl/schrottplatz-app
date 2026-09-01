import * as THREE from "three";

/**
 * Tageslauf über dem Platz (Wunsch 29.08.2026).
 *
 * Ein Arbeitstag dauert eine Viertelstunde Echtzeit und läuft von Sonnen-
 * aufgang bis in die Nacht. Damit bekommt der Wechsel aus Annahme und
 * Sortieren ein sichtbares Gegenstück: Man sieht am Licht, wie weit der Tag
 * ist, statt nur eine Zahl im HUD zu lesen.
 *
 * Sobald es dämmert, geht das Flutlicht an — vier Masten an den Ecken,
 * allesamt nach innen auf die Arbeitsfläche gerichtet.
 */

/** Länge eines vollen Tages in Sekunden */
export const DAY_LENGTH_S = 900;
/** Tageszeit, bei der das Spiel beginnt: früher Morgen */
export const START_TIME = 0.28;

/** Farben für Himmel und Sonne über den Tag */
const SKY_NIGHT = new THREE.Color(0x151b26);
const SKY_DAWN = new THREE.Color(0xd8a07a);
const SKY_DAY = new THREE.Color(0xb8c4cc);
const SUN_LOW = new THREE.Color(0xffb066);
const SUN_HIGH = new THREE.Color(0xfff4e0);

export class Daylight {
  /** 0 = Mitternacht, 0.25 = Sonnenaufgang, 0.5 = Mittag, 0.75 = Sonnenuntergang */
  time = START_TIME;
  /** 0 = tiefe Nacht, 1 = heller Tag — auch fürs Flutlicht ausgewertet */
  daylight = 1;
  private sky = new THREE.Color();
  private sunColor = new THREE.Color();

  constructor(
    private scene: THREE.Scene,
    private hemi: THREE.HemisphereLight,
    private sun: THREE.DirectionalLight
  ) {}

  /** Uhrzeit als Text fürs HUD. */
  get clock(): string {
    const min = Math.floor(this.time * 24 * 60);
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  get isNight(): boolean {
    return this.daylight < 0.35;
  }

  update(dt: number): void {
    this.time = (this.time + dt / DAY_LENGTH_S) % 1;

    // Sonnenhöhe: sin über den Tagbogen, negativ heißt unter dem Horizont
    const angle = (this.time - 0.25) * Math.PI * 2;
    const height = Math.sin(angle);
    this.daylight = THREE.MathUtils.clamp(height * 1.35 + 0.3, 0, 1);

    // Sonne wandert von Ost nach West, im Sommerbogen leicht nach Süden
    const r = 46;
    this.sun.position.set(Math.cos(angle) * r, Math.max(height * 38, -6), 14 + height * 8);
    this.sun.intensity = Math.max(height, 0) * 1.9;

    // Tief stehende Sonne färbt warm, Mittagssonne neutral
    const warmth = THREE.MathUtils.clamp(1 - Math.max(height, 0) * 2.4, 0, 1);
    this.sunColor.copy(SUN_HIGH).lerp(SUN_LOW, warmth);
    this.sun.color.copy(this.sunColor);

    // Himmel: nachts dunkel, in der Dämmerung warm, tagsüber hell bedeckt
    if (this.daylight < 0.5) {
      this.sky.copy(SKY_NIGHT).lerp(SKY_DAWN, this.daylight * 2);
    } else {
      this.sky.copy(SKY_DAWN).lerp(SKY_DAY, (this.daylight - 0.5) * 2);
    }
    (this.scene.background as THREE.Color).copy(this.sky);
    if (this.scene.fog) (this.scene.fog as THREE.Fog).color.copy(this.sky);

    // Grundhelligkeit: nachts bleibt genug, um sich zu orientieren
    this.hemi.intensity = 0.1 + this.daylight * 0.8;
  }
}

/**
 * Flutlichtmasten am Rand des Platzes, alle nach innen auf die Arbeits-
 * flächen gerichtet. Sie stehen bewusst an der Umrandung, damit auf dem
 * Platz selbst nichts im Weg steht. Zuschalten passiert bei Dämmerung
 * von allein.
 */
export class Floodlights {
  private lights: THREE.SpotLight[] = [];
  private lamps: THREE.Mesh[] = [];
  private lampOn = new THREE.MeshStandardMaterial({
    color: 0xfff0c8,
    emissive: 0xffe9b0,
    emissiveIntensity: 1.4,
  });
  private lampOff = new THREE.MeshStandardMaterial({ color: 0x6e7276, roughness: 0.7 });

  constructor(scene: THREE.Scene, positions: Array<[number, number]>) {
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x5d666c, roughness: 0.8 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3d4347, roughness: 0.7 });
    const MAST_H = 12;

    for (const [x, z] of positions) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      // Fundament und Mast
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), headMat);
      base.position.y = 0.17;
      group.add(base);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, MAST_H, 8),
        mastMat
      );
      mast.position.y = MAST_H / 2;
      mast.castShadow = true;
      group.add(mast);

      // Der Kopf neigt sich zur Platzmitte
      const toCenter = Math.atan2(-x, -z);
      const head = new THREE.Group();
      head.position.y = MAST_H;
      head.rotation.y = toCenter;
      group.add(head);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.3), headMat);
      bar.position.y = 0.2;
      head.add(bar);

      // Vier Strahler nebeneinander, alle nach innen und unten
      for (const off of [-0.95, -0.32, 0.32, 0.95]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.28), this.lampOff);
        lamp.position.set(off, 0.02, 0.16);
        lamp.rotation.x = 0.5;
        head.add(lamp);
        this.lamps.push(lamp);
      }

      // Ein Scheinwerfer je Mast reicht für die Beleuchtung — vier echte
      // Lichtquellen je Mast wären für Mobilgeräte zu teuer
      const spot = new THREE.SpotLight(0xfff2d0, 0, 130, Math.PI / 5.2, 0.45, 1.35);
      spot.position.set(x, MAST_H, z);
      spot.target.position.set(x * 0.12, 0, z * 0.12); // zur Platzmitte hin
      scene.add(spot.target);
      this.lights.push(spot);
      scene.add(spot);
      scene.add(group);
    }
  }

  /** @param daylight 0..1 — unter 0,45 wird zugeschaltet */
  update(daylight: number): void {
    const an = THREE.MathUtils.clamp((0.45 - daylight) / 0.3, 0, 1);
    // Am Bild abgestimmt. Die Masten stehen am Zaun und leuchten quer über
    // den ganzen Platz — entsprechend viel Leistung brauchen sie.
    for (const l of this.lights) l.intensity = an * 900;
    const mat = an > 0.15 ? this.lampOn : this.lampOff;
    for (const lamp of this.lamps) lamp.material = mat;
  }
}
