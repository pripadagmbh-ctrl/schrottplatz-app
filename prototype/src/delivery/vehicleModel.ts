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
  group: THREE.Group;
  bedGroup: THREE.Group;
  world: RAPIER.World;
  sideWalls: Array<{ hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody; dir: number }>;
  tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null;
}

/** Die beweglichen Teile, die der Ablauf danach ansteuert. */
export interface VehicleModelParts {
  tailGate: { hinge: THREE.Group; mesh: THREE.Mesh; body: RAPIER.RigidBody } | null;
}

function buildCarAndTrailer(
v: VehicleModelContext,
  paint: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
  bedMat: THREE.MeshStandardMaterial
): void {
  void paint;
  // Jeder Privatwagen sieht etwas anders aus
  const farben = [0x8a3b32, 0x2f4858, 0x6b7a52, 0xa8a49c, 0x3c3f45, 0x7a5c3a];
  const lack = new THREE.MeshStandardMaterial({
    color: farben[Math.floor(Math.random() * farben.length)],
    roughness: 0.45,
    metalness: 0.2,
  });
  const glas = new THREE.MeshPhysicalMaterial({
    color: 0xd6ecf4,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.82,
    thickness: 0.05,
    transparent: true,
    opacity: 0.32,
  });
  const kombi = Math.random() < 0.7;
  const zugZ = v.bedLen / 2 + 2.6; // Mitte des Zugfahrzeugs
  const len = kombi ? 4.3 : 5.0;
  const hoehe = kombi ? 0.72 : 1.35;

  // Karosserie: Kombi flach mit Dachaufbau, Kastenwagen ein hoher Kasten
  const wanne = new THREE.Mesh(new THREE.BoxGeometry(1.82, hoehe, len), lack);
  wanne.position.set(0, 0.62 + hoehe / 2, zugZ);
  wanne.castShadow = true;
  v.group.add(wanne);
  if (kombi) {
    const dach = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.62, len - 1.5), lack);
    dach.position.set(0, 1.65, zugZ + 0.15);
    dach.castShadow = true;
    v.group.add(dach);
    for (const sx of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, len - 1.9), glas);
      seite.position.set(sx * 0.87, 1.68, zugZ + 0.15);
      v.group.add(seite);
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), glas);
    front.position.set(0, 1.66, zugZ + len / 2 - 0.72);
    front.rotation.x = 0.34;
    v.group.add(front);
  } else {
    // Kastenwagen: verglaste Fahrerkabine vorn, geschlossener Aufbau
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.62, 0.06), glas);
    front.position.set(0, 1.6, zugZ + len / 2 - 0.35);
    front.rotation.x = 0.22;
    v.group.add(front);
    for (const sx of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 1.0), glas);
      seite.position.set(sx * 0.89, 1.56, zugZ + len / 2 - 1.15);
      v.group.add(seite);
    }
  }
  const haut = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
  const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), haut);
  kopf.position.set(-0.42, kombi ? 1.6 : 1.55, zugZ + len / 2 - 1.1);
  v.group.add(kopf);

  // Anhänger: offener Kasten auf einer Achse
  const rahmen = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, v.bedLen + 0.5), dark);
  rahmen.position.set(0, 0.72, v.bedLen / 2 - 0.1);
  v.group.add(rahmen);
  const boden = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, v.bedLen), bedMat);
  boden.position.set(0, 0.86, v.bedLen / 2);
  v.group.add(boden);
  const deichsel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), dark);
  deichsel.position.set(0, 0.66, v.bedLen + 0.85);
  v.group.add(deichsel);

  // Räder: zwei am Anhänger, vier am Zugfahrzeug
  const radGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12);
  radGeo.rotateZ(Math.PI / 2);
  const gummi = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.9 });
  const raeder: Array<[number, number]> = [
    [-0.98, v.bedLen / 2],
    [0.98, v.bedLen / 2],
    [-0.86, zugZ + len / 2 - 0.9],
    [0.86, zugZ + len / 2 - 0.9],
    [-0.86, zugZ - len / 2 + 0.9],
    [0.86, zugZ - len / 2 + 0.9],
  ];
  for (const [rx, rz] of raeder) {
    const rad = new THREE.Mesh(radGeo, gummi);
    rad.position.set(rx, 0.33, rz);
    rad.castShadow = true;
    v.group.add(rad);
  }
}

export function buildVehicleModel(v: VehicleModelContext): VehicleModelParts {
  const paint = new THREE.MeshStandardMaterial({ color: 0x35618f, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.8 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.7, metalness: 0.4 });

  // Was der Ablauf danach ansteuert, wird hier gesammelt und zurückgegeben
  const teile: VehicleModelParts = { tailGate: null };

  if (v.kind === "pkw") {
    buildCarAndTrailer(v, paint, dark, bedMat);
    return teile;
  }
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, v.bedLen + 1.6), dark);
  chassis.position.set(0, 0.65, 0.8);
  v.group.add(chassis);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 1.5), paint);
  cab.position.set(0, 1.5, v.bedLen / 2 + 0.9);
  cab.castShadow = true;
  v.group.add(cab);
  // Verglasung: Frontscheibe und zwei Seitenfenster
  // Klar durchsichtig, damit man den Fahrer dahinter sitzen sieht
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6ecf4,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.82,
    thickness: 0.05,
    transparent: true,
    opacity: 0.32,
  });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 0.06), windowMat);
  windshield.position.set(0, 1.72, v.bedLen / 2 + 1.66);
  v.group.add(windshield);
  for (const sx of [-1, 1]) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 1.0), windowMat);
    sideWin.position.set(sx * 1.06, 1.68, v.bedLen / 2 + 0.85);
    v.group.add(sideWin);
  }
  // Fahrer hinterm Steuer
  const driverSkin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
  const driverShirt = new THREE.MeshStandardMaterial({ color: 0x35506b, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.28, 4, 10), driverShirt);
  torso.position.set(-0.45, 1.5, v.bedLen / 2 + 0.75);
  v.group.add(torso);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), driverSkin);
  dHead.position.set(-0.45, 1.8, v.bedLen / 2 + 0.75);
  v.group.add(dHead);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.116, 12, 10), driverShirt);
  cap.scale.set(1, 0.6, 1);
  cap.position.set(-0.45, 1.85, v.bedLen / 2 + 0.74);
  v.group.add(cap);
  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const z of [v.bedLen / 2 + 1.1, 0.1, -v.bedLen / 2 + 0.8]) {
    for (const x of [-1.0, 1.0]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(x, 0.48, z);
      v.group.add(w);
    }
  }

  // Ladefläche: Ursprung am Heck-Kipp-Gelenk (Boden-Höhe der Fläche)
  const bedW = BED_HALF_W * 2;
  v.bedGroup.position.set(0, 1.05, -v.bedLen / 2); // schließt bündig mit dem Heck ab
  v.group.add(v.bedGroup);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.12, v.bedLen), bedMat);
  floor.position.set(0, 0, v.bedLen / 2);
  floor.castShadow = true;
  v.bedGroup.add(floor);
  const isContainer = v.kind === "abholer";
  const wallH = isContainer ? 2.5 : 0.64;
  const sideMat = isContainer
    ? new THREE.MeshStandardMaterial({ color: 0x2f7a4f, roughness: 0.75, metalness: 0.35 })
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

  return teile;
}
