import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Das Betriebsgebäude (Wunsch 02.09.2026, neu verortet 10.09.2026).
 *
 * Vorher standen drei Bauten verstreut: Wiegehäuschen an der Waage,
 * Kaffeebude irgendwo an der Fahrspur, Büro dazwischen. Das zerfaserte den
 * Platz. Jetzt sitzt alles Gebaute in der hinteren rechten Ecke an der Wand
 * beisammen — der Rest der Fläche gehört dem Schrott.
 *
 * Zwei Bauteile: der Flachbau mit dem Büro — Schreibtisch, Marktnotierungen
 * an der Wand, Fensterband zum Platz — und die offene Halle daneben, in der
 * die Maschinen stehen.
 *
 * Sie stehen von Anfang an da (Befund 10.09.2026: "ich seh kein Büro"). Erst
 * waren sie an Ausbaustufen gehängt und blieben unsichtbar; ein Betriebshof
 * hat aber ein Gebäude, auch wenn drin noch nicht viel passiert. Was man
 * kauft, ist die Einrichtung, nicht der Rohbau.
 *
 * Beide öffnen sich nach Norden, also zum Platz hin: Von der Kabine aus sieht
 * man Fenster und Hallentor, nicht die Rückwand.
 */

/** Mitte des Betriebsgebäudes — hintere rechte Ecke, an der Wand. */
export const OFFICE_X = 6.2;
export const OFFICE_Z = -23.6;
/** Janines Klapptisch steht vor der Bürotür, unter dem Vordach. */
export const KAFFEE_POS = new THREE.Vector3(OFFICE_X - 2.6, 0, OFFICE_Z + 3.4);

/** Büro: Breite (x), Tiefe (z), Höhe */
const B = 7.2;
const T = 4.4;
const H = 2.9;
/** Halle: Breite, Tiefe, Höhe */
const HB = 9.0;
const HT = 7.0;
const HH = 5.2;
/** Abstand zwischen Büro und Halle */
const LUECKE = 0.6;
/** Die Halle schließt westlich an; ihre Front liegt auf einer Linie mit dem Büro */
const HALLE_DX = -(B / 2 + LUECKE + HB / 2);
const HALLE_DZ = -(HT - T) / 2;

/**
 * Grundflächen für die Hindernisprüfung: [x, z, halbeBreite, halbeTiefe].
 *
 * Steht hier als freie Funktion, damit obstacles.ts denselben Grundriss
 * benutzen kann, ohne eine Szene bauen zu müssen.
 */
export function officeFootprints(): Array<[number, number, number, number]> {
  return [
    [OFFICE_X, OFFICE_Z, B / 2 + 0.25, T / 2 + 0.25],
    [OFFICE_X + HALLE_DX, OFFICE_Z + HALLE_DZ, HB / 2 + 0.1, HT / 2 + 0.1],
  ];
}

export class OfficeBuilding {
  private officeGroup = new THREE.Group();
  private hallGroup = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    world?: RAPIER.World,
    private x = OFFICE_X,
    private z = OFFICE_Z
  ) {
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

    // --- Flachbau mit Büro ---
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
    // Fensterband zum Platz (Nordseite)
    const band = new THREE.Mesh(new THREE.BoxGeometry(B - 2.6, 1.15, 0.08), glas);
    band.position.set(0.6, 1.75, T / 2 + 0.02);
    this.officeGroup.add(band);
    // Tür mit Vordach, westlich neben dem Fensterband
    const tuer = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, 0.1), dach);
    tuer.position.set(-B / 2 + 1.0, 1.02, T / 2 + 0.02);
    this.officeGroup.add(tuer);
    const vordach = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.1), dach);
    vordach.position.set(-B / 2 + 1.0, 2.35, T / 2 + 0.5);
    this.officeGroup.add(vordach);
    // Schreibtisch und Notierungstafel hinter der Scheibe
    const tisch = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.08, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.8 })
    );
    tisch.position.set(0.6, 0.78, T / 2 - 0.9);
    this.officeGroup.add(tisch);
    const tafel = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x1d2427, roughness: 0.9 })
    );
    tafel.position.set(2.4, 1.7, -T / 2 + 0.1);
    this.officeGroup.add(tafel);
    this.officeGroup.position.set(this.x, 0, this.z);
    scene.add(this.officeGroup);

    // --- Offene Halle, schließt westlich an, Tor nach Norden ---
    const stahl = new THREE.MeshStandardMaterial({ color: 0x7d858b, roughness: 0.6, metalness: 0.5 });
    const wellblech = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.75, metalness: 0.3 });
    // Rückwand im Süden, Seitenwände Ost und West, nach Norden offen
    const rueck = new THREE.Mesh(new THREE.BoxGeometry(HB, HH, 0.18), wellblech);
    rueck.position.set(0, HH / 2, -HT / 2);
    rueck.castShadow = true;
    this.hallGroup.add(rueck);
    for (const sx of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(0.18, HH, HT), wellblech);
      seite.position.set((sx * HB) / 2, HH / 2, 0);
      seite.castShadow = true;
      this.hallGroup.add(seite);
    }
    // Pultdach, nach vorn abfallend
    const hdach = new THREE.Mesh(new THREE.BoxGeometry(HB + 0.4, 0.2, HT + 0.4), dach);
    hdach.position.set(0, HH + 0.1, 0);
    hdach.rotation.x = 0.06;
    hdach.castShadow = true;
    this.hallGroup.add(hdach);
    // Torrahmen an der offenen Seite
    for (const sx of [-1, 1]) {
      const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.26, HH, 0.26), stahl);
      pfosten.position.set((sx * (HB - 0.6)) / 2, HH / 2, HT / 2);
      this.hallGroup.add(pfosten);
    }
    const sturz = new THREE.Mesh(new THREE.BoxGeometry(HB, 0.4, 0.26), stahl);
    sturz.position.set(0, HH - 0.3, HT / 2);
    this.hallGroup.add(sturz);
    this.hallGroup.position.set(this.x + HALLE_DX, 0, this.z + HALLE_DZ);
    scene.add(this.hallGroup);

    // Feste Kollider: Durch ein Gebäude fährt niemand hindurch.
    if (world) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const quader = (cx: number, cz: number, hw: number, hh: number, hd: number): void => {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hw, hh, hd).setTranslation(cx, hh, cz),
          body
        );
      };
      quader(this.x, this.z, B / 2, H / 2, T / 2);
      // Die Halle ist offen: nur Rück- und Seitenwände, damit man hineinfahren
      // kann und nicht gegen eine unsichtbare Front stösst.
      quader(this.x + HALLE_DX, this.z + HALLE_DZ - HT / 2, HB / 2, HH / 2, 0.12);
      for (const sx of [-1, 1]) {
        quader(this.x + HALLE_DX + (sx * HB) / 2, this.z + HALLE_DZ, 0.12, HH / 2, HT / 2);
      }
    }
  }

  /** Grundfläche für die Hindernisprüfung: [x, z, halbeBreite, halbeTiefe] */
  footprints(): Array<[number, number, number, number]> {
    return officeFootprints();
  }
}
