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
 * Es wächst in drei Stufen mit dem Betrieb mit:
 *
 *   CONTAINER      Ein Bürocontainer auf Kanthölzern. Mehr ist am Anfang
 *                  nicht drin.
 *   BÜRO           Ein Flachbau: Schreibtisch, Marktnotierungen an der Wand,
 *                  Fensterband zum Platz. Wer hier arbeitet, kennt die Preise
 *                  und sieht einer gemischten Ladung an, was drinsteckt.
 *   BÜRO MIT HALLE Daneben eine offene Halle mit Tor. Dort stehen die
 *                  Maschinen — erst damit lohnt sich der Kauf von Bulldozer,
 *                  Stapler und Magnet.
 *
 * Alle Stufen öffnen sich nach Norden, also zum Platz hin: Von der Kabine aus
 * sieht man Fenster und Hallentor, nicht die Rückwand.
 */

export type OfficeStage = "container" | "office" | "hall";

/** Mitte des Betriebsgebäudes — hintere rechte Ecke, an der Wand. */
export const OFFICE_X = 6.2;
export const OFFICE_Z = -23.6;
/** Janines Klapptisch steht vor der Bürotür, unter dem Vordach. */
export const KAFFEE_POS = new THREE.Vector3(OFFICE_X - 2.6, 0, OFFICE_Z + 3.4);

/** Büro: Breite (x), Tiefe (z), Höhe */
const B = 7.2;
const T = 4.4;
const H = 2.9;
/** Container: Breite, Tiefe, Höhe */
const CB = 6.0;
const CT = 2.8;
const CH = 2.7;
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
export function officeFootprints(stage: OfficeStage): Array<[number, number, number, number]> {
  const f: Array<[number, number, number, number]> = [];
  if (stage === "container") f.push([OFFICE_X, OFFICE_Z, CB / 2 + 0.15, CT / 2 + 0.15]);
  else f.push([OFFICE_X, OFFICE_Z, B / 2 + 0.25, T / 2 + 0.25]);
  if (stage === "hall") {
    f.push([OFFICE_X + HALLE_DX, OFFICE_Z + HALLE_DZ, HB / 2 + 0.1, HT / 2 + 0.1]);
  }
  return f;
}

export class OfficeBuilding {
  private containerGroup = new THREE.Group();
  private officeGroup = new THREE.Group();
  private hallGroup = new THREE.Group();
  private stage: OfficeStage = "container";

  private klotz: RAPIER.Collider[] = [];

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

    // --- Stufe 1: Bürocontainer auf Kanthölzern ---
    const conMat = new THREE.MeshStandardMaterial({ color: 0x9fb4bd, roughness: 0.8, metalness: 0.2 });
    const korb = new THREE.Mesh(new THREE.BoxGeometry(CB, CH, CT), conMat);
    korb.position.set(0, CH / 2 + 0.2, 0);
    korb.castShadow = true;
    korb.receiveShadow = true;
    this.containerGroup.add(korb);
    // Sicken: senkrechte Rippen, daran erkennt man den Container
    for (let i = -6; i <= 6; i++) {
      const rippe = new THREE.Mesh(new THREE.BoxGeometry(0.09, CH - 0.3, 0.06), sockel);
      rippe.position.set(i * 0.42, CH / 2 + 0.2, CT / 2 + 0.02);
      this.containerGroup.add(rippe);
      const hinten = rippe.clone();
      hinten.position.z = -CT / 2 - 0.02;
      this.containerGroup.add(hinten);
    }
    // Kanthölzer unter den Ecken
    for (const kx of [-CB / 2 + 0.5, CB / 2 - 0.5]) {
      const balken = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, CT), sockel);
      balken.position.set(kx, 0.1, 0);
      this.containerGroup.add(balken);
    }
    // Tür und Fenster nach Norden
    const ctuer = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.08), dach);
    ctuer.position.set(-CB / 2 + 1.1, 1.2, CT / 2 + 0.05);
    this.containerGroup.add(ctuer);
    const cfenster = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.06), glas);
    cfenster.position.set(CB / 2 - 1.6, 1.75, CT / 2 + 0.05);
    this.containerGroup.add(cfenster);
    const stufe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.6), sockel);
    stufe.position.set(-CB / 2 + 1.1, 0.09, CT / 2 + 0.4);
    this.containerGroup.add(stufe);
    this.containerGroup.position.set(this.x, 0, this.z);
    scene.add(this.containerGroup);

    // --- Stufe 2: Flachbau mit Büro ---
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
    this.officeGroup.visible = false;
    scene.add(this.officeGroup);

    // --- Stufe 3: offene Halle, schließt westlich an, Tor nach Norden ---
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
    this.hallGroup.visible = false;
    scene.add(this.hallGroup);

    /*
     * Feste Kollider je Ausbaustufe. Nur der sichtbare Bau ist aktiv — sonst
     * stünde die Halle schon als unsichtbare Wand da, bevor sie gebaut ist.
     * Reihenfolge: [Container, Büro, Halle] — setStage schaltet danach.
     */
    if (world) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      const quader = (
        cx: number,
        cz: number,
        hw: number,
        hh: number,
        hd: number
      ): RAPIER.Collider =>
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(hw, hh, hd).setTranslation(cx, hh, cz),
          body
        );
      this.klotz = [
        quader(this.x, this.z, CB / 2, CH / 2, CT / 2),
        quader(this.x, this.z, B / 2, H / 2, T / 2),
        quader(this.x + HALLE_DX, this.z + HALLE_DZ, HB / 2, HH / 2, HT / 2),
      ];
    }
    this.setStage("container");
  }

  /** Ausbaustufe setzen. Höhere Stufen lösen die niedrigeren ab. */
  setStage(stage: OfficeStage): void {
    this.stage = stage;
    this.containerGroup.visible = stage === "container";
    this.officeGroup.visible = stage !== "container";
    this.hallGroup.visible = stage === "hall";
    this.klotz[0]?.setEnabled(stage === "container");
    this.klotz[1]?.setEnabled(stage !== "container");
    this.klotz[2]?.setEnabled(stage === "hall");
  }

  get current(): OfficeStage {
    return this.stage;
  }

  /** Grundfläche für die Hindernisprüfung: [x, z, halbeBreite, halbeTiefe] */
  footprints(): Array<[number, number, number, number]> {
    return officeFootprints(this.stage);
  }
}
