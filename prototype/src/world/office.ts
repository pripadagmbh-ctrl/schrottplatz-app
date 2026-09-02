import * as THREE from "three";

/**
 * Das Betriebsgebäude an der Waage (Wunsch 02.09.2026).
 *
 * Es wächst in drei Stufen mit dem Betrieb mit:
 *
 *   WIEGEHÄUSCHEN  Ein Kabuff mit Schalter. Mario wiegt, mehr passiert hier
 *                  nicht.
 *   BÜRO           Ein Flachbau: Schreibtisch, Marktnotierungen an der Wand,
 *                  ein Fenster zum Platz. Wer hier arbeitet, kennt die Preise
 *                  und sieht einer gemischten Ladung an, was drinsteckt.
 *   BÜRO MIT HALLE Daneben eine offene Halle mit Tor. Dort stehen die
 *                  Maschinen — erst damit lohnt sich der Kauf von Bulldozer,
 *                  Stapler und Magnet.
 */

export type OfficeStage = "hut" | "office" | "hall";

export class OfficeBuilding {
  private hutGroup = new THREE.Group();
  private officeGroup = new THREE.Group();
  private hallGroup = new THREE.Group();
  private stage: OfficeStage = "hut";

  /**
   * @param x Mitte des Gebäudes; die Halle schließt nach Westen an
   * @param z Höhe der Wiegeplatte
   */
  constructor(scene: THREE.Scene, private x: number, private z: number) {
    const wand = new THREE.MeshStandardMaterial({ color: 0xb9c0c4, roughness: 0.85 });
    const sockel = new THREE.MeshStandardMaterial({ color: 0x6b7176, roughness: 0.95 });
    const dach = new THREE.MeshStandardMaterial({ color: 0x3c4247, roughness: 0.8 });
    const glas = new THREE.MeshPhysicalMaterial({
      color: 0xd6ecf4,
      roughness: 0.06,
      metalness: 0,
      transmission: 0.82,
      thickness: 0.05,
      transparent: true,
      opacity: 0.32,
    });

    // --- Stufe 2: Flachbau mit Büro ---
    const B = 7.2; // Breite
    const T = 4.4; // Tiefe
    const H = 2.9;
    const korpus = new THREE.Mesh(new THREE.BoxGeometry(B, H, T), wand);
    korpus.position.set(0, H / 2, 0);
    korpus.castShadow = true;
    korpus.receiveShadow = true;
    this.officeGroup.add(korpus);
    const fuss = new THREE.Mesh(new THREE.BoxGeometry(B + 0.3, 0.35, T + 0.3), sockel);
    fuss.position.set(0, 0.17, 0);
    this.officeGroup.add(fuss);
    // Flachdach mit Attika
    const platte = new THREE.Mesh(new THREE.BoxGeometry(B + 0.5, 0.18, T + 0.5), dach);
    platte.position.set(0, H + 0.09, 0);
    platte.castShadow = true;
    this.officeGroup.add(platte);
    // Fensterband zum Platz (Ostseite)
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, T - 1.2), glas);
    band.position.set(B / 2 + 0.02, 1.75, -0.2);
    this.officeGroup.add(band);
    // Tür mit Vordach
    const tuer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.05, 1.0), dach);
    tuer.position.set(B / 2 + 0.02, 1.02, T / 2 - 1.0);
    this.officeGroup.add(tuer);
    const vordach = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.6), dach);
    vordach.position.set(B / 2 + 0.5, 2.35, T / 2 - 1.0);
    this.officeGroup.add(vordach);
    // Schreibtisch und Notierungstafel hinter der Scheibe
    const tisch = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.8 })
    );
    tisch.position.set(B / 2 - 1.0, 0.78, -0.2);
    this.officeGroup.add(tisch);
    const tafel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.9, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x1d2427, roughness: 0.9 })
    );
    tafel.position.set(B / 2 - 2.4, 1.7, -0.2);
    this.officeGroup.add(tafel);
    this.officeGroup.position.set(this.x, 0, this.z);
    this.officeGroup.visible = false;
    scene.add(this.officeGroup);

    // --- Stufe 3: offene Halle, schließt westlich an ---
    const HB = 9.0; // Hallenbreite
    const HT = 7.0;
    const HH = 5.2;
    const stahl = new THREE.MeshStandardMaterial({ color: 0x7d858b, roughness: 0.6, metalness: 0.5 });
    const wellblech = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.75, metalness: 0.3 });
    // Rückwand und zwei Seitenwände, nach Osten offen (zum Platz)
    const rueck = new THREE.Mesh(new THREE.BoxGeometry(0.18, HH, HT), wellblech);
    rueck.position.set(-HB / 2, HH / 2, 0);
    rueck.castShadow = true;
    this.hallGroup.add(rueck);
    for (const sz of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(HB, HH, 0.18), wellblech);
      seite.position.set(0, HH / 2, (sz * HT) / 2);
      seite.castShadow = true;
      this.hallGroup.add(seite);
    }
    // Pultdach, nach vorn abfallend
    const hdach = new THREE.Mesh(new THREE.BoxGeometry(HB + 0.4, 0.2, HT + 0.4), dach);
    hdach.position.set(0, HH + 0.1, 0);
    hdach.rotation.z = -0.06;
    hdach.castShadow = true;
    this.hallGroup.add(hdach);
    // Torrahmen an der offenen Seite
    for (const sz of [-1, 1]) {
      const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.26, HH, 0.26), stahl);
      pfosten.position.set(HB / 2, HH / 2, (sz * (HT - 0.6)) / 2);
      this.hallGroup.add(pfosten);
    }
    const sturz = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.4, HT), stahl);
    sturz.position.set(HB / 2, HH - 0.3, 0);
    this.hallGroup.add(sturz);
    // Die Halle steht westlich neben dem Büro
    this.hallGroup.position.set(this.x - B / 2 - HB / 2 - 0.6, 0, this.z);
    this.hallGroup.visible = false;
    scene.add(this.hallGroup);
  }

  /** Das vorhandene Wiegehäuschen anmelden — es weicht dem Büro. */
  setHut(group: THREE.Object3D): void {
    this.hutGroup = group as THREE.Group;
  }

  /** Ausbaustufe setzen. Höhere Stufen schließen die niedrigeren ein. */
  setStage(stage: OfficeStage): void {
    this.stage = stage;
    this.hutGroup.visible = stage === "hut";
    this.officeGroup.visible = stage !== "hut";
    this.hallGroup.visible = stage === "hall";
  }

  get current(): OfficeStage {
    return this.stage;
  }

  /** Grundfläche für die Hindernisprüfung: [x, z, halbeBreite, halbeTiefe] */
  footprints(): Array<[number, number, number, number]> {
    const f: Array<[number, number, number, number]> = [];
    if (this.stage !== "hut") f.push([this.x, this.z, 3.85, 2.45]);
    if (this.stage === "hall") f.push([this.x - 8.4, this.z, 4.6, 3.6]);
    return f;
  }
}
