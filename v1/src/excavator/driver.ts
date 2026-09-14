import * as THREE from "three";

/**
 * Der Fahrer in der Kabine — Daniel.
 *
 * Aus der Innensicht ist absichtlich wenig von ihm zu sehen: Der Blick geht
 * vom Augpunkt aus, Kopf und Rumpf liegen hinter der Kamera. Sichtbar
 * bleiben die Unterarme an den Joysticks.
 *
 * @returns die Körperteile, die beim Wechsel in die Innensicht ausgeblendet
 *          werden — von außen soll Daniel sichtbar bleiben.
 */
export function buildDriver(
  parent: THREE.Object3D,
  cx: number,
  cz: number
): THREE.Object3D[] {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe3b18c, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.85 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x3d4b5c, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.95 });
    const boot = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.95 });

    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    parent.add(g);

    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0
    ): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Von außen ist Daniel komplett zu sehen; in der Ego-Sicht bleiben nur die
    // Unterarme stehen. Alles aus runden Grundformen (Kapseln/Kugeln).
    const body: THREE.Object3D[] = [];
    body.push(add(new THREE.CapsuleGeometry(0.16, 0.3, 4, 12), shirt, 0, 1.42, -0.24));
    body.push(add(new THREE.SphereGeometry(0.17, 12, 10), shirt, 0, 1.58, -0.24)); // Schultern
    // Sitzende Beine (nur von außen sichtbar)
    body.push(add(new THREE.CapsuleGeometry(0.12, 0.12, 4, 10), jeans, 0, 1.12, -0.16));
    for (const sx of [-0.1, 0.1]) {
      body.push(add(new THREE.CapsuleGeometry(0.07, 0.26, 4, 10), jeans, sx, 1.1, 0.02, Math.PI / 2));
      body.push(add(new THREE.CapsuleGeometry(0.065, 0.24, 4, 10), jeans, sx, 0.88, 0.2));
      body.push(add(new THREE.SphereGeometry(0.075, 10, 8), boot, sx, 0.7, 0.26));
    }
    for (const sx of [-1, 1] as const) {
      // Oberarm gehört zum Körper, Unterarm + Hand bleiben in der Ego-Sicht
      body.push(
        add(new THREE.CapsuleGeometry(0.058, 0.22, 4, 10), shirt, sx * 0.29, 1.44, -0.18, 0, sx * 0.28)
      );
      // Unterarm und Hand sitzen am Joystick selbst (siehe buildCabin) und
      // bewegen sich mit ihm — der Oberarm bleibt am Körper.
    }
    // Hals, Kopf, Haare, Lederband
    body.push(add(new THREE.CapsuleGeometry(0.05, 0.06, 4, 10), skin, 0, 1.73, -0.25));
    const head = add(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 1.87, -0.25);
    head.scale.set(1, 1.12, 1.02);
    body.push(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 12), hair);
    hairCap.position.set(0, 1.9, -0.26);
    hairCap.scale.set(1, 0.95, 1.02);
    g.add(hairCap);
    body.push(hairCap);
    // kurze Haare — nur ein flacher Nackenansatz, kein Zopf
    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), hair);
    nape.position.set(0, 1.84, -0.3);
    nape.scale.set(1, 0.7, 0.7);
    g.add(nape);
    body.push(nape);
    const necklace = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.01, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.7 })
    );
    necklace.rotation.x = Math.PI / 2;
    necklace.position.set(0, 1.65, -0.23);
    g.add(necklace);
    body.push(necklace);
    return body;
}
