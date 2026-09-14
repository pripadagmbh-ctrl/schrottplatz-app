import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { BED_HALF_W } from "./routes";

/**
 * Modellbau der Anlieferfahrzeuge.
 *
 * Hier entsteht, was man sieht: Fahrerhaus, Ladefläche, Bordwände,
 * Heckklappe, Räder — und für Privatkundschaft ein PKW mit Anhänger statt
 * eines LKW. Reine Geometrie ohne Ablauflogik; bewegliche Teile wie die
 * Bordwände bekommen eigene Körper und werden als Ergebnis zurückgereicht.
 */

/** Was das Fahrzeug dem Modellbau zur Verfügung stellt. */
export interface VehicleModelContext {
  kind: string;
  bedLen: number;
  /** Schrotthändler fahren ihren eigenen Ladekran mit */
  withCrane?: boolean;
  /**
   * Aufbau der Ladefläche. Händler fahren nicht alle denselben Wagen:
   *   flach   niedrige Bordwände, wie ein Baustellenpritsche
   *   rungen  hohe Seitenwände mit Rungen — der klassische Schrottaufbau
   *   koffer  geschlossener Kastenaufbau, fast schon ein Container
   */
  bodyStyle?: "flach" | "rungen" | "koffer";
  /**
   * Name des Kunden. Aus ihm kommt der Lackton — derselbe Händler fährt
   * damit immer denselben Wagen vor, ohne dass die Farbe gespeichert werden
   * müsste. Genauso macht es `lackton` beim Schrott (E-061).
   */
  halter?: string;
  group: THREE.Group;
  bedGroup: THREE.Group;
  world: RAPIER.World;
  sideWalls: Array<{ hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody; dir: number }>;
  tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null;
}

/** Die beweglichen Teile, die der Ablauf danach ansteuert. */
export interface VehicleModelParts {
  tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null;
  /** Drehbare Kransäule — der Ablauf schwenkt sie beim Andocken zur Seite */
  crane: THREE.Group | null;
  /** Anhänger des PKW — hängt gelenkig an der Kupplung und wird nachgeführt */
  trailer: THREE.Group | null;
}

/**
 * Lacktöne, wie sie auf einem Schrottplatz vorfahren.
 *
 * Kein Weiß aus dem Prospekt und kein Metallic: Die Wagen sind alt, die Farbe
 * ist stumpf. Bisher war jeder LKW derselbe blaue Kasten (0x35618f) — bei
 * vier Fuhren am Tag sah der Platz aus wie ein Fuhrpark aus einer Hand.
 */
const LKW_LACK = [0xcfcdc6, 0x35618f, 0x8d3128, 0x3f6b34, 0xb08a3a, 0x6b6f73, 0x2f4f5e];

/** Lackton fest aus dem Halternamen — gleicher Händler, gleicher Wagen. */
function lackFuer(halter: string | undefined): number {
  if (!halter) return LKW_LACK[1];
  let k = 7;
  for (let i = 0; i < halter.length; i++) k = (k * 31 + halter.charCodeAt(i)) % 100003;
  return LKW_LACK[k % LKW_LACK.length];
}

/**
 * Ein Rad aus Reifen, Felge und Nabe — bei Bedarf als Zwilling.
 *
 * Vorher war jedes Rad eine schwarze Scheibe. Aus zehn Metern sieht man an
 * einem LKW vor allem zwei Dinge: die Farbe der Kabine und die Räder. Ein
 * Dreiachser hat hinten Zwillingsbereifung, und genau das macht ihn zum LKW
 * statt zum Lieferwagen.
 */
function baueRad(
  ziel: THREE.Group,
  x: number,
  y: number,
  z: number,
  r: number,
  breite: number,
  zwilling: boolean
): void {
  const gummi = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.95 });
  const felge = new THREE.MeshStandardMaterial({
    color: 0x8b9197,
    roughness: 0.45,
    metalness: 0.65,
  });
  const reifen = new THREE.CylinderGeometry(r, r, breite, 14);
  reifen.rotateZ(Math.PI / 2);
  // Die Felge sass zuerst mittig im Reifen und ragte anderthalb Zentimeter
  // heraus — unsichtbar. Sie gehoert auf die Aussenseite, dort sieht man sie.
  const scheibe = new THREE.CylinderGeometry(r * 0.62, r * 0.62, breite * 0.4, 10);
  scheibe.rotateZ(Math.PI / 2);
  const nabe = new THREE.CylinderGeometry(r * 0.22, r * 0.22, breite * 0.5, 8);
  nabe.rotateZ(Math.PI / 2);
  const seite = Math.sign(x) || 1;
  const plaetze = zwilling ? [x, x - seite * (breite + 0.03)] : [x];
  for (const px of plaetze) {
    const rad = new THREE.Mesh(reifen, gummi);
    rad.position.set(px, y, z);
    rad.castShadow = true;
    ziel.add(rad);
  }
  // Felge und Nabe nur aussen: innen sieht sie ohnehin niemand
  const rim = new THREE.Mesh(scheibe, felge);
  rim.position.set(x + seite * breite * 0.36, y, z);
  ziel.add(rim);
  const hub = new THREE.Mesh(nabe, felge);
  hub.position.set(x + seite * breite * 0.45, y, z);
  ziel.add(hub);
}

/**
 * Das Gesicht des Wagens: Stoßstange, Grill, Leuchten, Spiegel, Auspuff.
 *
 * Ein LKW-Fahrerhaus ist nie ein Quader. Es hat unten eine Stoßstange, davor
 * ein Nummernschild, oben ein Dachspoiler, seitlich Spiegel auf Auslegern und
 * hinten den Auspuffrohr-Stapel. Ohne das steht dort ein blauer Block, und
 * jede Fuhre sieht aus wie die vorige.
 */
function baueFahrerhaus(
  v: VehicleModelContext,
  lack: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  glas: THREE.Material
): void {
  const chrom = new THREE.MeshStandardMaterial({
    color: 0xb9bec3,
    roughness: 0.3,
    metalness: 0.85,
  });
  const klar = new THREE.MeshStandardMaterial({
    color: 0xf2eddc,
    roughness: 0.25,
    emissive: 0x2a2418,
  });
  const bernstein = new THREE.MeshStandardMaterial({
    color: 0xd08a1e,
    roughness: 0.4,
    emissive: 0x3a2205,
  });
  const cz = v.bedLen / 2 + 0.9; // Mitte des Fahrerhauses
  const front = cz + 0.76; // Vorderkante
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    schatten = false
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (schatten) m.castShadow = true;
    v.group.add(m);
    return m;
  };

  // Stoßstange, Nummernschild, Unterfahrschutz
  add(new THREE.BoxGeometry(2.16, 0.28, 0.18), dark, 0, 0.95, front + 0.06, true);
  add(new THREE.BoxGeometry(0.4, 0.13, 0.03), chrom, -0.55, 0.95, front + 0.16);
  // Kühlergrill: waagerechte Lamellen, nicht eine glatte Platte
  for (let i = 0; i < 4; i++) {
    add(new THREE.BoxGeometry(1.5, 0.07, 0.05), dark, 0, 1.18 + i * 0.12, front + 0.02);
  }
  // Scheinwerfer und Blinker
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, 0.2, 0.05), klar, sx * 0.86, 1.18, front + 0.03);
    add(new THREE.BoxGeometry(0.16, 0.1, 0.05), bernstein, sx * 0.86, 0.99, front + 0.05);
  }
  // Dachspoiler: vorn niedrig, hinten hoch — damit der Aufbau nicht anströmt
  const spoiler = add(new THREE.BoxGeometry(1.95, 0.42, 0.7), lack, 0, 2.28, cz - 0.3, true);
  spoiler.rotation.x = -0.18;
  // Sonnenblende über der Frontscheibe
  const blende = add(new THREE.BoxGeometry(2.0, 0.1, 0.3), lack, 0, 2.12, front - 0.08, true);
  blende.rotation.x = 0.3;
  // Außenspiegel auf Auslegern — das Erkennungszeichen jedes LKW
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.24, 0.04, 0.04), dark, sx * 1.18, 1.98, front - 0.2);
    add(new THREE.BoxGeometry(0.07, 0.46, 0.16), dark, sx * 1.3, 1.78, front - 0.2, true);
    add(new THREE.BoxGeometry(0.07, 0.18, 0.13), dark, sx * 1.28, 1.42, front - 0.22);
  }
  // Türfuge und Griff — ohne sie ist die Seite eine Wand
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.02, 1.1, 0.03), dark, sx * 1.06, 1.48, cz + 0.42);
    add(new THREE.BoxGeometry(0.03, 0.06, 0.22), chrom, sx * 1.07, 1.45, cz + 0.1);
    // Einstieg: zwei Tritte unter der Tür
    for (let i = 0; i < 2; i++) {
      add(new THREE.BoxGeometry(0.1, 0.04, 0.42), dark, sx * 0.98, 0.62 + i * 0.24, cz + 0.15);
    }
  }
  // Auspuffrohr hinter dem Fahrerhaus, rechts — steht senkrecht hoch
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 1.7, 8), chrom);
  rohr.position.set(1.02, 1.6, cz - 0.82);
  rohr.castShadow = true;
  v.group.add(rohr);
  // Dachleuchten als Reihe
  for (const sx of [-0.62, -0.21, 0.21, 0.62]) {
    add(new THREE.BoxGeometry(0.1, 0.06, 0.08), bernstein, sx, 2.14, front - 0.05);
  }
  void glas;
}

/**
 * Alles unterhalb der Ladefläche: Tank, Werkzeugkasten, Kotflügel, Rückleuchten.
 *
 * Der Rahmen war eine durchgehende dunkle Platte, und die Räder klebten daran
 * wie an einem Brett. Was einen LKW von unten ausmacht, hängt seitlich am
 * Rahmen — und ein Kotflügel über den Zwillingsrädern ist der Unterschied
 * zwischen Fahrzeug und Kiste.
 */
function baueFahrgestell(
  v: VehicleModelContext,
  dark: THREE.MeshStandardMaterial,
  bedMat: THREE.MeshStandardMaterial
): void {
  const alu = new THREE.MeshStandardMaterial({
    color: 0xa9aeb3,
    roughness: 0.4,
    metalness: 0.7,
  });
  const rot = new THREE.MeshStandardMaterial({
    color: 0x8e2318,
    roughness: 0.35,
    emissive: 0x2a0806,
  });
  // Kraftstofftank links, Werkzeugkasten rechts
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.1, 10), alu);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(-1.08, 0.72, 0.55);
  tank.castShadow = true;
  v.group.add(tank);
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.85), dark);
  kasten.position.set(1.08, 0.74, 0.55);
  kasten.castShadow = true;
  v.group.add(kasten);
  // Kotflügel über den beiden hinteren Achsen
  for (const sx of [-1, 1]) {
    const kotfluegel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 2.3), dark);
    kotfluegel.position.set(sx * 1.02, 1.0, -v.bedLen / 2 + 1.45);
    v.group.add(kotfluegel);
    // Spritzlappen hinter der letzten Achse
    const lappen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.03), dark);
    lappen.position.set(sx * 1.02, 0.78, -v.bedLen / 2 + 0.35);
    v.group.add(lappen);
  }
  // Unterfahrschutz und Rückleuchten am Heck
  // Buendig ans Rahmenende: 72 cm dahinter hing er in der Luft
  const heckZ = -v.bedLen / 2 - 0.14;
  const schutz = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.1), bedMat);
  schutz.position.set(0, 0.52, heckZ);
  v.group.add(schutz);
  for (const sx of [-1, 1]) {
    const leuchte = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.06), rot);
    leuchte.position.set(sx * 0.85, 0.78, heckZ);
    v.group.add(leuchte);
  }
}

/**
 * Ladekran hinter dem Fahrerhaus, wie ihn Schrotthändler auf dem LKW haben.
 *
 * Er lädt nichts ab — das macht der Spieler. Er steht da, weil ein
 * Schrotthändler ohne Kran nicht nach Schrotthändler aussieht. Beim Andocken
 * schwenkt der Ausleger zur Seite, damit er nicht über der Ladefläche hängt und
 * dem Baggerfahrer im Weg ist.
 *
 * Zurückgegeben wird die Säule: Alles darüber dreht mit, der Sockel bleibt stehen.
 */
function buildCrane(v: VehicleModelContext, dark: THREE.MeshStandardMaterial): THREE.Group {
  const stahl = new THREE.MeshStandardMaterial({ color: 0x6d7276, roughness: 0.7, metalness: 0.5 });
  const gelb = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6, metalness: 0.3 });
  // Sockel: sitzt fest auf dem Rahmen, direkt hinter der Kabine
  const sockelZ = v.bedLen / 2 + 0.05;
  const sockel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.7), dark);
  sockel.position.set(0, 1.05, sockelZ);
  sockel.castShadow = true;
  v.group.add(sockel);
  // Zwei Abstützungen seitlich — ohne die steht kein Kran auf einem LKW
  for (const sx of [-1, 1]) {
    const stuetze = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.22), stahl);
    stuetze.position.set(sx * 1.05, 0.95, sockelZ);
    v.group.add(stuetze);
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 8), dark);
    fuss.position.set(sx * 1.05, 0.72, sockelZ);
    v.group.add(fuss);
  }

  const saeule = new THREE.Group();
  saeule.position.set(0, 1.22, sockelZ);
  v.group.add(saeule);
  const turm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.15, 0.46), gelb);
  turm.position.y = 0.58;
  turm.castShadow = true;
  saeule.add(turm);

  // Hauptausleger: schräg nach hinten über die Ladefläche, wie im Transportzustand
  const ausleger = new THREE.Group();
  ausleger.position.y = 1.05;
  ausleger.rotation.x = 0.42;
  saeule.add(ausleger);
  const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 2.5), gelb);
  arm1.position.z = -1.15;
  arm1.castShadow = true;
  ausleger.add(arm1);
  // Knickarm: eingeklappt, zeigt wieder nach unten — so fahren die Dinger herum
  const knick = new THREE.Group();
  knick.position.z = -2.3;
  knick.rotation.x = -1.15;
  ausleger.add(knick);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.9), gelb);
  arm2.position.z = -0.9;
  arm2.castShadow = true;
  knick.add(arm2);
  // Hydraulikzylinder am Hauptarm — das Detail, das den Kran erst glaubhaft macht
  const zylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 8), stahl);
  zylinder.rotation.x = Math.PI / 2 - 0.25;
  zylinder.position.set(0, -0.26, -0.75);
  ausleger.add(zylinder);
  // Kleiner Sortiergreifer an der Spitze
  const greifer = new THREE.Group();
  greifer.position.z = -1.75;
  knick.add(greifer);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 8), stahl);
  greifer.add(kopf);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const schale = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.14), dark);
    schale.position.set(Math.cos(a) * 0.17, -0.28, Math.sin(a) * 0.17);
    schale.rotation.z = -Math.cos(a) * 0.45;
    schale.rotation.x = Math.sin(a) * 0.45;
    greifer.add(schale);
  }
  return saeule;
}

/**
 * PKW mit Anhänger — zwei Körper, gelenkig an der Kupplung.
 *
 * Vorher war beides ein starres Gebilde, und die Maße überlappten sogar: Das
 * Zugfahrzeug stand mit seinem Heck über dem Anhängerboden. Jetzt sitzt vorn
 * der Wagen, dahinter die Deichsel, und der Anhänger hängt in einer eigenen
 * Gruppe, deren Ursprung genau die Kupplung ist. Wer sie dreht, schwenkt den
 * Anhänger um den Kupplungspunkt — so, wie ein Anhänger es tut.
 *
 * Zurückgegeben wird diese Gruppe; der Ablauf führt sie beim Fahren nach.
 */
/**
 * Hoehe der Bordwand. Steht als eigene Funktion da, weil nicht nur der Aufbau
 * sie braucht: Auch die Ladung richtet sich danach — sie darf nur knapp
 * darueber hinausragen (Wunsch 11.09.2026).
 */
export function wandHoehe(kind: string, bodyStyle?: string): number {
  if (kind === "abholer") return 2.5;
  if (bodyStyle === "koffer") return 1.55;
  if (bodyStyle === "rungen") return 1.05;
  return 0.64;
}

function buildCarAndTrailer(
  v: VehicleModelContext,
  _paint: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  bedMat: THREE.MeshStandardMaterial
): THREE.Group {
  const farben = [0x35618f, 0x7a2f2a, 0x2f5c3a, 0x8a8f95, 0xb08a3a, 0x2b2f36];
  const lack = new THREE.MeshStandardMaterial({
    color: farben[Math.floor(Math.random() * farben.length)],
    roughness: 0.45,
    metalness: 0.2,
  });
  /*
   * Getönt statt klar. Klarglas war hier unsichtbar: Die Scheibe liegt vor
   * dem Blech, und durch 82 % Transmission sah man genau dieses Blech —
   * die Kabine war ein einfarbiger Block ohne Fenster. Eine dunkle Scheibe
   * zeichnet sich gegen jeden Lackton ab, und der Fahrer bleibt sichtbar.
   */
  const glas = new THREE.MeshPhysicalMaterial({
    color: 0x30505e,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.3,
    thickness: 0.05,
    transparent: true,
    opacity: 0.72,
  });
  const chrom = new THREE.MeshStandardMaterial({
    color: 0xb9bec3,
    roughness: 0.3,
    metalness: 0.85,
  });
  const klar = new THREE.MeshStandardMaterial({
    color: 0xf2eddc,
    roughness: 0.25,
    emissive: 0x2a2418,
  });
  const rotLicht = new THREE.MeshStandardMaterial({
    color: 0x8e2318,
    roughness: 0.35,
    emissive: 0x2a0806,
  });
  const kombi = Math.random() < 0.7;
  const len = kombi ? 4.3 : 4.7;
  // Kupplung: ein Stück vor der Anhängerfront, dort greift die Deichsel an
  const kupplungZ = v.bedLen + 1.05;
  // Zugfahrzeug steht davor, mit Luft zwischen Heck und Kupplung
  const zugZ = kupplungZ + 0.35 + len / 2;
  /** z in Wagenkoordinaten: 0 = Mitte, positiv nach vorn. */
  const w = (z: number): number => zugZ + z;

  /*
   * --- Zugfahrzeug ---
   *
   * Vorher waren das zwei Quader übereinander, und die Limousine war ein
   * 1,35 m hoher Block ohne Dach. Ein Auto liest sich aus der Entfernung an
   * drei Dingen: der Bordkante über den Rädern, dem abgesetzten Dachaufbau
   * und den Lichtern vorn und hinten. Genau die gibt es jetzt.
   */
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    schatten = false
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (schatten) m.castShadow = true;
    v.group.add(m);
    return m;
  };

  // Wagenkasten bis Fensterunterkante
  add(new THREE.BoxGeometry(1.82, 0.62, len), lack, 0, 0.76, w(0), true);
  // Motorhaube vorn und — beim Stufenheck — der Kofferraum hinten
  add(new THREE.BoxGeometry(1.74, 0.14, len * 0.3), lack, 0, 1.13, w(len * 0.33), true);
  if (!kombi) {
    add(new THREE.BoxGeometry(1.74, 0.14, len * 0.24), lack, 0, 1.13, w(-len * 0.36), true);
  }
  // Dachaufbau: beim Kombi bis ans Heck, beim Stufenheck kürzer und mittiger
  const dachLen = kombi ? len * 0.62 : len * 0.46;
  const dachZ = kombi ? -len * 0.12 : -len * 0.06;
  add(new THREE.BoxGeometry(1.7, 0.56, dachLen), lack, 0, 1.42, w(dachZ), true);
  // Scheiben: Front geneigt, Seiten längs, hinten senkrecht
  const front = add(
    new THREE.BoxGeometry(1.62, 0.52, 0.05),
    glas,
    0,
    1.42,
    w(dachZ + dachLen / 2 + 0.06)
  );
  front.rotation.x = 0.36;
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.05, 0.4, dachLen - 0.5), glas, sx * 0.89, 1.44, w(dachZ));
  }
  add(new THREE.BoxGeometry(1.58, 0.44, 0.05), glas, 0, 1.42, w(dachZ - dachLen / 2 - 0.05));
  // Radläufe — ohne sie kleben die Räder am Kasten
  const bogen = new THREE.TorusGeometry(0.4, 0.05, 6, 10, Math.PI);
  const radZ = [len / 2 - 0.95, -len / 2 + 0.95];
  for (const sx of [-1, 1]) {
    for (const rz of radZ) {
      const m = new THREE.Mesh(bogen, lack);
      m.position.set(sx * 0.84, 0.46, w(rz));
      m.rotation.y = Math.PI / 2;
      v.group.add(m);
    }
  }
  // Stoßstangen, Kennzeichen, Leuchten
  add(new THREE.BoxGeometry(1.8, 0.2, 0.14), dark, 0, 0.56, w(len / 2 + 0.02), true);
  add(new THREE.BoxGeometry(1.8, 0.2, 0.14), dark, 0, 0.56, w(-len / 2 - 0.02), true);
  add(new THREE.BoxGeometry(0.4, 0.12, 0.03), chrom, 0, 0.56, w(len / 2 + 0.1));
  add(new THREE.BoxGeometry(0.9, 0.1, 0.05), dark, 0, 0.82, w(len / 2 + 0.01));
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, 0.16, 0.05), klar, sx * 0.66, 0.86, w(len / 2 + 0.01));
    add(new THREE.BoxGeometry(0.3, 0.18, 0.05), rotLicht, sx * 0.7, 0.88, w(-len / 2 - 0.01));
  }
  // Außenspiegel und Türfuge
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.14, 0.09, 0.07), dark, sx * 0.95, 1.2, w(dachZ + dachLen / 2 - 0.2));
    add(new THREE.BoxGeometry(0.02, 0.5, 0.03), dark, sx * 0.92, 0.8, w(0.15));
  }
  const haut = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), haut);
  kopf.position.set(-0.42, 1.36, w(dachZ + dachLen / 2 - 0.45));
  v.group.add(kopf);
  // Anhängerkupplung am Heck des Wagens
  const kugel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), dark);
  kugel.position.set(0, 0.5, kupplungZ);
  v.group.add(kugel);

  for (const rx of [-0.86, 0.86]) {
    for (const rz of radZ) baueRad(v.group, rx, 0.33, w(rz), 0.33, 0.2, false);
  }

  // --- Anhänger (eigene Gruppe, Ursprung = Kupplung) ---
  const anhaenger = new THREE.Group();
  anhaenger.position.set(0, 0, kupplungZ);
  v.group.add(anhaenger);
  // Alles Folgende in Anhänger-Koordinaten: z = 0 ist die Kupplung,
  // der Anhänger liegt dahinter (negatives z).
  const zu = (zImRahmen: number): number => zImRahmen - kupplungZ;

  const deichsel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.05), dark);
  deichsel.position.set(0, 0.5, zu(v.bedLen + 0.525));
  anhaenger.add(deichsel);
  const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, v.bedLen + 0.5), dark);
  rahmen.position.set(0, 0.72, zu(v.bedLen / 2 - 0.1));
  anhaenger.add(rahmen);
  const boden = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, v.bedLen), bedMat);
  boden.position.set(0, 0.86, zu(v.bedLen / 2));
  boden.castShadow = true;
  anhaenger.add(boden);
  // Bordwände — ohne sie ist es ein Brett, kein Anhänger
  for (const [bx, bz, bw, bd] of [
    [0, zu(0.02), 1.86, 0.06],
    [0, zu(v.bedLen - 0.02), 1.86, 0.06],
    [-0.9, zu(v.bedLen / 2), 0.06, v.bedLen],
    [0.9, zu(v.bedLen / 2), 0.06, v.bedLen],
  ] as Array<[number, number, number, number]>) {
    const wand = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.34, bd), bedMat);
    wand.position.set(bx, 1.07, bz);
    wand.castShadow = true;
    anhaenger.add(wand);
  }
  for (const rx of [-0.98, 0.98]) {
    baueRad(anhaenger, rx, 0.33, zu(v.bedLen / 2), 0.33, 0.2, false);
    // Kotflügel — ein Anhänger ohne sie ist ein Brett auf Rollen
    const kotfluegel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.96), dark);
    kotfluegel.position.set(rx, 0.72, zu(v.bedLen / 2));
    anhaenger.add(kotfluegel);
  }
  // Stützrad an der Deichsel und Rückleuchten am Heck
  const stuetze = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), dark);
  stuetze.position.set(0.18, 0.29, zu(v.bedLen + 0.35));
  anhaenger.add(stuetze);
  for (const sx of [-1, 1]) {
    const leuchte = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8e2318, roughness: 0.35, emissive: 0x2a0806 })
    );
    leuchte.position.set(sx * 0.78, 0.82, zu(-0.06));
    anhaenger.add(leuchte);
  }

  // Die Ladefläche gehört an den Anhänger, nicht an den Rahmen: Sie muss beim
  // Einlenken mitschwenken, sonst bleibt die Ladung in der Luft stehen.
  // Höhe = Oberkante des Anhängerbodens; z = 0 des Bodens, der von 0 bis
  // bedLen reicht (beim LKW liegt er um bedLen/2 versetzt).
  v.bedGroup.position.set(0, 0.9, zu(0));
  anhaenger.add(v.bedGroup);

  return anhaenger;
}

export function buildVehicleModel(v: VehicleModelContext): VehicleModelParts {
  const paint = new THREE.MeshStandardMaterial({ color: lackFuer(v.halter), roughness: 0.62 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.7, metalness: 0.4 });

  // Was der Ablauf danach ansteuert, wird hier gesammelt und zurückgegeben
  const teile: VehicleModelParts = { tailGate: null, crane: null, trailer: null };

  if (v.kind === "pkw") {
    teile.trailer = buildCarAndTrailer(v, paint, dark, bedMat);
    return teile;
  }
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, v.bedLen + 1.6), dark);
  chassis.position.set(0, 0.65, 0.8);
  v.group.add(chassis);
  // Fahrerhaus in zwei Höhen: unten schmaler als oben, so wie ein Fernfahrer-
  // haus über dem Rahmen auskragt. Ein einzelner Quader sieht aus wie ein
  // Container mit Fenstern.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 1.5), paint);
  cab.position.set(0, 1.28, v.bedLen / 2 + 0.9);
  cab.castShadow = true;
  v.group.add(cab);
  // Das obere Haus steht hinter der Frontscheibe zurück, damit die Scheibe
  // eine Fläche für sich ist und nicht mit dem Blech in einer Ebene liegt.
  const cabOben = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.62, 1.4), paint);
  cabOben.position.set(0, 1.92, v.bedLen / 2 + 0.82);
  cabOben.castShadow = true;
  v.group.add(cabOben);
  // Verglasung: Frontscheibe und zwei Seitenfenster
  // Klar durchsichtig, damit man den Fahrer dahinter sitzen sieht
  // Getönt, aus demselben Grund wie beim PKW: Klarglas vor Blech ist kein Fenster.
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x30505e,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.3,
    thickness: 0.05,
    transparent: true,
    opacity: 0.72,
  });
  /*
   * Verglasung. Sie sass bis 12.09.2026 im Blech: Die Frontscheibe lag zwei
   * Zentimeter hinter der Kabinenvorderkante und war schlicht nicht zu sehen.
   * Jetzt sitzt sie auf der Flucht des oberen Hauses, und zwar dort, wo sie
   * hingehoert — in dessen oberer Haelfte, nicht auf halber Kabinenhoehe.
   */
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 0.06), windowMat);
  windshield.position.set(0, 1.94, v.bedLen / 2 + 1.7);
  v.group.add(windshield);
  for (const sx of [-1, 1]) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 1.1), windowMat);
    sideWin.position.set(sx * 1.11, 1.92, v.bedLen / 2 + 0.92);
    v.group.add(sideWin);
  }
  // Fahrer hinterm Steuer
  const driverSkin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
  const driverShirt = new THREE.MeshStandardMaterial({ color: 0x35506b, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.28, 4, 10), driverShirt);
  torso.position.set(-0.45, 1.62, v.bedLen / 2 + 0.75);
  v.group.add(torso);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), driverSkin);
  dHead.position.set(-0.45, 1.92, v.bedLen / 2 + 0.75);
  v.group.add(dHead);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.116, 12, 10), driverShirt);
  cap.scale.set(1, 0.6, 1);
  cap.position.set(-0.45, 1.97, v.bedLen / 2 + 0.74);
  v.group.add(cap);
  // Dreiachser: vorn Einzelrad und lenkbar, hinten Zwillinge auf beiden Achsen
  const achsen: Array<[number, boolean]> = [
    [v.bedLen / 2 + 1.1, false],
    [0.1, true],
    [-v.bedLen / 2 + 0.8, true],
  ];
  for (const [z, zwilling] of achsen) {
    for (const x of [-1.0, 1.0]) {
      baueRad(v.group, x, 0.48, z, 0.48, 0.3, zwilling);
    }
  }
  baueFahrerhaus(v, paint, dark, windowMat);
  baueFahrgestell(v, dark, bedMat);

  // Ladefläche: Ursprung am Heck-Kipp-Gelenk (Boden-Höhe der Fläche)
  const bedW = BED_HALF_W * 2;
  v.bedGroup.position.set(0, 1.05, -v.bedLen / 2); // schließt bündig mit dem Heck ab
  v.group.add(v.bedGroup);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.12, v.bedLen), bedMat);
  floor.position.set(0, 0, v.bedLen / 2);
  floor.castShadow = true;
  v.bedGroup.add(floor);
  const isContainer = v.kind === "abholer";
  const aufbau = v.bodyStyle ?? "flach";
  const wallH = wandHoehe(v.kind, v.bodyStyle);
  const sideMat = isContainer
    ? new THREE.MeshStandardMaterial({ color: 0x2f7a4f, roughness: 0.75, metalness: 0.35 })
    : aufbau === "koffer"
      ? new THREE.MeshStandardMaterial({ color: 0x53585d, roughness: 0.8, metalness: 0.3 })
      : bedMat;
  // Bordwände links und rechts als aufklappbare Klappen (Scharnier unten
  // außen). Beim Abladen fallen sie zur Seite — der Schrott darf herunter.
  for (const dir of [-1, 1] as const) {
    const hinge = new THREE.Group();
    hinge.position.set(dir * (BED_HALF_W + 0.05), 0.02, v.bedLen / 2);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallH, v.bedLen), sideMat);
    side.position.y = wallH / 2;
    side.castShadow = true;
    hinge.add(side);
    // Verriegelungsbügel als Detail
    for (const lz of [-v.bedLen * 0.3, v.bedLen * 0.3]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), bedMat);
      latch.position.set(dir * 0.06, wallH - 0.2, lz);
      hinge.add(latch);
    }
    // Rungen: senkrechte Steher aussen an der Wand — daran erkennt man den
    // Schrottaufbau schon von weitem
    if (aufbau === "rungen") {
      for (let i = 0; i < 4; i++) {
        const rz = -v.bedLen / 2 + 0.5 + (i / 3) * (v.bedLen - 1.0);
        const runge = new THREE.Mesh(new THREE.BoxGeometry(0.1, wallH + 0.3, 0.12), dark);
        runge.position.set(dir * 0.1, (wallH + 0.3) / 2, rz);
        runge.castShadow = true;
        hinge.add(runge);
      }
    }
    v.bedGroup.add(hinge);
    const wallBody = v.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)
    );
    // 12 cm statt 6: dünne Wände liessen die Ladung beim Kippen
    // durchschlagen, als wäre der Wagen Luft
    v.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.12, wallH / 2, v.bedLen / 2),
      wallBody
    );
    v.sideWalls.push({ hinge, mesh: side, body: wallBody, dir });
  }
  const front = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallH, 0.08), sideMat);
  front.position.set(0, wallH / 2, v.bedLen);
  v.bedGroup.add(front);
  if (v.kind !== "kipper") {
    // Heckklappe sitzt ganz am hinteren Rand und klappt nach unten weg
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.02, -0.04);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(bedW, wallH, 0.08), sideMat);
    rear.position.y = wallH / 2;
    rear.castShadow = true;
    hinge.add(rear);
    v.bedGroup.add(hinge);
    const rearBody = v.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setCcdEnabled(true)
    );
    v.world.createCollider(
      RAPIER.ColliderDesc.cuboid(bedW / 2, wallH / 2, 0.12),
      rearBody
    );
    teile.tailGate = { hinge, mesh: rear, body: rearBody };
  }
  if (isContainer) {
    // Sicken auf den Containerwänden
    for (const sx of [-BED_HALF_W - 0.11, BED_HALF_W + 0.11]) {
      for (let z = 0.6; z < v.bedLen; z += 1.0) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallH - 0.2, 0.12), sideMat);
        rib.position.set(sx, wallH / 2, z);
        v.bedGroup.add(rib);
      }
    }
  }

  if (v.withCrane) teile.crane = buildCrane(v, dark);

  return teile;
}
