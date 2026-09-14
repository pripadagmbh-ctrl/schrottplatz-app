import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Der Betriebshof: Bürogebäude mit zwei Hallen (Wunsch 11.09.2026).
 *
 * Er steht in der hinteren Ecke an der Westwand, gleich neben der Waage —
 * dort, wo ein Betrieb sein Gebäude hat: Wer über die Brückenwaage fährt,
 * schaut darauf, und der Rest des Platzes bleibt Arbeitsfläche.
 *
 * Drei Bauteile in einer Flucht, bündig aneinander, Fronten nach Osten zum
 * Platz, alle mit Satteldach:
 *
 *   BÜRO    Zweigeschossig, Fensterbänder über beide Etagen, Eingang mit
 *           Vordach, Aussentreppe zum Obergeschoss. Es überragt die Hallen —
 *           erst dadurch liest es sich als Gebäude und nicht als Container.
 *   HALLE 1 Offene Halle mit Stahltor-Rahmen, für die Maschinen.
 *   HALLE 2 Gleiche Halle, direkt angebaut.
 *
 * Kein Spalt zwischen den Teilen: gemeinsame Wandflucht, durchlaufende Front.
 * Was hier vorher stand — ein einzelner flacher Kasten — sah aus wie eine
 * Kaffeebude, nicht wie ein Betriebshof (Befund 11.09.2026).
 */

/** Innenkante der Westwand: daran steht die Rückwand des Komplexes. */
const WAND_X = -39.6;
/** Innenkante der Nordwand: daran steht das Büro. */
const WAND_Z = 28.6;

/** Tiefe aller Bauteile (x, von der Wand zum Platz) — die Front läuft durch. */
const TIEFE = 9.0;
/** Büro: Breite (z), Geschosshöhe, Traufhöhe */
const BUERO_B = 6.2;
const GESCHOSS = 3.1;
const BUERO_H = GESCHOSS * 2;
/** Halle: Breite (z) und Traufhöhe */
const HALLE_B = 7.2;
const HALLE_H = 5.0;
/** Wie hoch der First über der Traufe sitzt */
const FIRST_BUERO = 1.7;
const FIRST_HALLE = 1.9;

/** Mitte des Bürogebäudes — Bezugspunkt des ganzen Komplexes. */
export const OFFICE_X = WAND_X + TIEFE / 2;
export const OFFICE_Z = WAND_Z - BUERO_B / 2;
/** Mitten der beiden Hallen, südlich anschliessend. */
export const HALL1_Z = OFFICE_Z - BUERO_B / 2 - HALLE_B / 2;
export const HALL2_Z = HALL1_Z - HALLE_B;
/** Front des Komplexes (Ostseite) — davor ist freie Fläche. */
export const OFFICE_FRONT_X = WAND_X + TIEFE;

/**
 * Die Bürotür an der Ostfront. Mario sitzt drinnen und kommt hier heraus,
 * wenn ein LKW auf die Waage fährt.
 */
export const BUERO_TUER = new THREE.Vector3(
  OFFICE_FRONT_X + 0.9,
  0,
  OFFICE_Z + BUERO_B / 2 - 1.2
);

/**
 * Grundflächen für die Hindernisprüfung: [x, z, halbeBreite, halbeTiefe].
 *
 * Steht hier als freie Funktion, damit obstacles.ts denselben Grundriss
 * benutzen kann, ohne eine Szene bauen zu müssen.
 */
export function officeFootprints(): Array<[number, number, number, number]> {
  return [
    [OFFICE_X, OFFICE_Z, TIEFE / 2 + 0.2, BUERO_B / 2 + 0.2],
    [OFFICE_X, HALL1_Z, TIEFE / 2 + 0.1, HALLE_B / 2],
    [OFFICE_X, HALL2_Z, TIEFE / 2 + 0.1, HALLE_B / 2],
  ];
}

export class OfficeBuilding {
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene, world?: RAPIER.World) {
    const wand = new THREE.MeshStandardMaterial({ color: 0xc3c8ca, roughness: 0.9 });
    const sockel = new THREE.MeshStandardMaterial({ color: 0x5f666b, roughness: 0.95 });
    const dach = new THREE.MeshStandardMaterial({ color: 0x3c4247, roughness: 0.8 });
    const ziegel = new THREE.MeshStandardMaterial({ color: 0x6d4a3c, roughness: 0.85 });
    const stahl = new THREE.MeshStandardMaterial({
      color: 0x7d858b,
      roughness: 0.6,
      metalness: 0.5,
    });
    const wellblech = new THREE.MeshStandardMaterial({
      color: 0x9aa2a8,
      roughness: 0.75,
      metalness: 0.3,
    });
    const glas = new THREE.MeshPhysicalMaterial({
      color: 0xd6ecf4,
      roughness: 0.06,
      metalness: 0,
      transmission: 0.82,
      thickness: 0.05,
      transparent: true,
      opacity: 0.34,
    });

    this.buildBuero(wand, sockel, dach, ziegel, glas, stahl);
    for (const z of [HALL1_Z, HALL2_Z]) this.buildHalle(z, wellblech, dach, stahl);
    scene.add(this.group);

    if (world) this.buildCollider(world);
  }

  /**
   * Satteldach: zwei geneigte Flächen über einem First, der in x läuft — die
   * Giebel zeigen also nach Osten zum Platz und nach Westen zur Mauer. Die
   * Giebelflächen sind Dreiecke aus einer Shape; ohne sie stünde das Dach auf
   * zwei offenen Enden.
   */
  private satteldach(
    g: THREE.Group,
    breite: number,
    tiefe: number,
    traufe: number,
    first: number,
    deckung: THREE.Material,
    giebel: THREE.Material
  ): void {
    const halb = breite / 2;
    const laenge = Math.hypot(halb, first);
    const winkel = Math.atan2(first, halb);
    for (const sz of [-1, 1]) {
      const flaeche = new THREE.Mesh(
        new THREE.BoxGeometry(tiefe + 0.5, 0.16, laenge + 0.35),
        deckung
      );
      flaeche.position.set(0, traufe + first / 2, (sz * halb) / 2);
      // Traufe aussen, First in der Mitte — mit umgekehrtem Vorzeichen wird
      // daraus eine Rinne statt eines Dachs (Befund beim ersten Rendern).
      flaeche.rotation.x = sz * winkel;
      flaeche.castShadow = true;
      g.add(flaeche);
    }
    const form = new THREE.Shape();
    form.moveTo(-halb, 0);
    form.lineTo(halb, 0);
    form.lineTo(0, first);
    form.closePath();
    const dreieck = new THREE.ExtrudeGeometry(form, { depth: 0.18, bevelEnabled: false });
    for (const sx of [-1, 1]) {
      const wandDreieck = new THREE.Mesh(dreieck, giebel);
      wandDreieck.rotation.y = Math.PI / 2;
      wandDreieck.position.set((sx * tiefe) / 2, traufe, 0);
      wandDreieck.castShadow = true;
      g.add(wandDreieck);
    }
  }

  /** Zweigeschossiges Bürogebäude, Front nach Osten. */
  private buildBuero(
    wand: THREE.Material,
    sockel: THREE.Material,
    dach: THREE.Material,
    ziegel: THREE.Material,
    glas: THREE.Material,
    stahl: THREE.Material
  ): void {
    const g = new THREE.Group();
    g.position.set(OFFICE_X, 0, OFFICE_Z);
    const korpus = new THREE.Mesh(new THREE.BoxGeometry(TIEFE, BUERO_H, BUERO_B), wand);
    korpus.position.set(0, BUERO_H / 2, 0);
    korpus.castShadow = true;
    korpus.receiveShadow = true;
    g.add(korpus);
    // Sockel und Geschossband — ohne die sieht jeder Quader nach Kiste aus
    const fuss = new THREE.Mesh(new THREE.BoxGeometry(TIEFE + 0.25, 0.5, BUERO_B + 0.25), sockel);
    fuss.position.set(0, 0.25, 0);
    g.add(fuss);
    const band = new THREE.Mesh(new THREE.BoxGeometry(TIEFE + 0.3, 0.3, BUERO_B + 0.3), sockel);
    band.position.set(0, GESCHOSS, 0);
    g.add(band);
    this.satteldach(g, BUERO_B, TIEFE, BUERO_H, FIRST_BUERO, ziegel, wand);

    const F = TIEFE / 2; // Frontkante nach Osten
    // Fensterbänder in beiden Geschossen, zum Platz
    for (const y of [1.75, 1.75 + GESCHOSS]) {
      const scheibe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, BUERO_B - 2.4), glas);
      scheibe.position.set(F + 0.02, y, -0.4);
      g.add(scheibe);
      // Teiler, damit es ein Band aus Fenstern wird und keine Glaswand
      for (const dz of [-1.0, 0.4]) {
        const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), sockel);
        pfosten.position.set(F + 0.04, y, -0.4 + dz);
        g.add(pfosten);
      }
    }
    // Seitenfenster nach Süden — die sieht man von der Zufahrt aus
    for (const y of [1.75, 1.75 + GESCHOSS]) {
      for (const dx of [-2.2, 0.6]) {
        const seitenfenster = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.08), glas);
        seitenfenster.position.set(dx, y, -BUERO_B / 2 - 0.02);
        g.add(seitenfenster);
      }
    }
    // Eingang mit Vordach und zwei Stufen
    const tuer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.15, 1.1), dach);
    tuer.position.set(F + 0.02, 1.08, BUERO_B / 2 - 1.2);
    g.add(tuer);
    const vordach = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 2.0), dach);
    vordach.position.set(F + 0.7, 2.5, BUERO_B / 2 - 1.2);
    vordach.castShadow = true;
    g.add(vordach);
    for (const [i, breite] of [[0, 1.8], [1, 1.4]] as Array<[number, number]>) {
      const stufe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, breite), sockel);
      stufe.position.set(F + 0.25 + i * 0.4, 0.07 + (1 - i) * 0.14, BUERO_B / 2 - 1.2);
      g.add(stufe);
    }
    // Aussentreppe zum Obergeschoss an der Nordseite — typisch für so einen Hof
    const podest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.2), stahl);
    podest.position.set(F - 1.2, GESCHOSS + 0.2, BUERO_B / 2 + 0.6);
    g.add(podest);
    for (let i = 0; i < 9; i++) {
      const stufe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.32), stahl);
      stufe.position.set(F - 2.6, 0.42 + i * 0.32, BUERO_B / 2 + 0.6);
      g.add(stufe);
    }
    for (const dx of [-3.1, -0.4]) {
      const gelaender = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.07), stahl);
      gelaender.position.set(F + dx, GESCHOSS + 0.75, BUERO_B / 2 + 1.1);
      g.add(gelaender);
    }
    const handlauf = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 0.07), stahl);
    handlauf.position.set(F - 1.75, GESCHOSS + 1.25, BUERO_B / 2 + 1.1);
    g.add(handlauf);
    const obereTuer = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.1), dach);
    obereTuer.position.set(F - 1.2, GESCHOSS + 1.2, BUERO_B / 2 + 0.02);
    g.add(obereTuer);
    // Schornstein neben dem First
    const kamin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), sockel);
    kamin.position.set(-2.6, BUERO_H + 1.2, 0.5);
    kamin.castShadow = true;
    g.add(kamin);
    this.group.add(g);
  }

  /** Offene Halle mit Satteldach, Tor nach Osten — Rückwand an der Platzmauer. */
  private buildHalle(
    z: number,
    wellblech: THREE.Material,
    dach: THREE.Material,
    stahl: THREE.Material
  ): void {
    const g = new THREE.Group();
    g.position.set(OFFICE_X, 0, z);
    const rueck = new THREE.Mesh(new THREE.BoxGeometry(0.18, HALLE_H, HALLE_B), wellblech);
    rueck.position.set(-TIEFE / 2, HALLE_H / 2, 0);
    rueck.castShadow = true;
    g.add(rueck);
    for (const sz of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(TIEFE, HALLE_H, 0.18), wellblech);
      seite.position.set(0, HALLE_H / 2, (sz * HALLE_B) / 2);
      seite.castShadow = true;
      g.add(seite);
    }
    this.satteldach(g, HALLE_B, TIEFE, HALLE_H, FIRST_HALLE, dach, wellblech);
    // Torrahmen an der offenen Seite; der Giebel darüber bleibt frei
    for (const sz of [-1, 1]) {
      const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.26, HALLE_H, 0.26), stahl);
      pfosten.position.set(TIEFE / 2, HALLE_H / 2, (sz * (HALLE_B - 0.7)) / 2);
      g.add(pfosten);
    }
    const sturz = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.45, HALLE_B), stahl);
    sturz.position.set(TIEFE / 2, HALLE_H - 0.3, 0);
    g.add(sturz);
    this.group.add(g);
  }

  /**
   * Feste Kollider: Durch ein Gebäude fährt niemand hindurch. Die Hallen
   * bekommen nur Rück- und Seitenwände — sonst stünde vor dem Tor eine
   * unsichtbare Front.
   */
  private buildCollider(world: RAPIER.World): void {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const quader = (cx: number, cz: number, hw: number, hh: number, hd: number): void => {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(hw, hh, hd).setTranslation(cx, hh, cz),
        body
      );
    };
    quader(OFFICE_X, OFFICE_Z, TIEFE / 2, BUERO_H / 2, BUERO_B / 2);
    for (const z of [HALL1_Z, HALL2_Z]) {
      quader(WAND_X, z, 0.12, HALLE_H / 2, HALLE_B / 2);
      for (const sz of [-1, 1]) {
        quader(OFFICE_X, z + (sz * HALLE_B) / 2, TIEFE / 2, HALLE_H / 2, 0.12);
      }
    }
  }

  /** Grundfläche für die Hindernisprüfung: [x, z, halbeBreite, halbeTiefe] */
  footprints(): Array<[number, number, number, number]> {
    return officeFootprints();
  }
}
