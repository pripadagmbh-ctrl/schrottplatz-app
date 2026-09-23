/**
 * WIEVIELE NETZE KOSTET EIN WRACK? — und sieht es nach dem Umbau gleich aus?
 *
 * Anlass (E-111): Ein Wrack bestand aus 25 Netzen, weil die dreizehn
 * Anbauteile — Stoßstangen, Grill, Leuchten, Radläufe, Spiegel — jedes ein
 * eigenes Netz mit eigenem Material waren. Mit Schattenwurf sind das 50
 * Zeichenrufe je Wrack, bei zwei Wracks 100, und damit 7,6 % der auf Patricks
 * Gerät gemessenen 1322. Zeichenrufe sind hier der Engpass, nicht Dreiecke
 * (E-025). Die dreizehn gehen nie einzeln ab, also gehören sie in EIN Netz mit
 * Eckpunktfarben.
 *
 * DIESER WÄCHTER PRÜFT DREI DINGE, und das dritte ist das eigentliche:
 *
 *   1. Die Netzzahl je Wrack bleibt bei 13. Wächst sie zurück, meldet er es.
 *   2. Die Zerlegemechanik ist unberührt: Motor, Getriebe und die vier Räder
 *      sind weiter EIGENE Netze und gehen weiter einzeln ab. Genau die dürfen
 *      NICHT verschmolzen werden.
 *   3. Das Auto sieht genauso aus wie vorher. Der Umbau hat die Maße nach
 *      `CarDef.karosserie` gehoben; die Prüfung baut die dreizehn Teile noch
 *      einmal nach dem ALTEN, fest verdrahteten Code und vergleicht jeden
 *      Eckpunkt. Erlaubt ist Rechenrauschen, nichts weiter.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager, baueAnbauteile, formeKarosserie } from "../src/dismantle/composites";
import { CAR_DEF } from "../src/dismantle/carDef";
import { EventBus } from "../src/core/events";

/** Gemessen mit `tools/wrackbild.ts` nach E-111. Vorher waren es 25. */
const NETZE_JE_WRACK = 13;

function netze(wurzel: THREE.Object3D): THREE.Mesh[] {
  const liste: THREE.Mesh[] = [];
  wurzel.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) liste.push(o as THREE.Mesh);
  });
  return liste;
}

/** Alle Eckpunkte einer Geometrie in Weltlage, sortiert — als Multimenge. */
function eckpunkte(geos: THREE.BufferGeometry[]): number[][] {
  const alle: number[][] = [];
  for (const g of geos) {
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) alle.push([p.getX(i), p.getY(i), p.getZ(i)]);
  }
  return alle.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
}

/** Größte Abweichung zweier Eckpunktmengen, in Metern. */
function abweichung(a: number[][], b: number[][]): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < 3; k++) max = Math.max(max, Math.abs(a[i]![k]! - b[i]![k]!));
  }
  return max;
}

/**
 * DIE DREIZEHN ANBAUTEILE, GEBAUT WIE VOR E-111 — Zeile für Zeile aus dem
 * alten `baueAnbauteile` übernommen, mit allen zwanzig festen Koordinaten.
 * Diese Funktion ist der Maßstab; sie darf nie „nachgezogen" werden, sonst
 * prüft der Vergleich nichts mehr.
 */
function altesAnbauteil(): THREE.BufferGeometry[] {
  const raus: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number): void => {
    geo.translate(x, y, z);
    raus.push(geo);
  };
  add(new THREE.BoxGeometry(1.5, 0.16, 0.16), 0, 0.22, 1.94);
  add(new THREE.BoxGeometry(1.5, 0.16, 0.16), 0, 0.22, -1.94);
  add(new THREE.BoxGeometry(1.0, 0.16, 0.06), 0, 0.42, 1.92);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.3, 0.16, 0.06), sx * 0.52, 0.44, 1.9);
    add(new THREE.BoxGeometry(0.26, 0.18, 0.06), sx * 0.55, 0.42, -1.9);
  }
  for (const sx of [-1, 1]) {
    for (const z of [1.25, -1.25]) {
      const g = new THREE.TorusGeometry(0.42, 0.055, 6, 12, Math.PI);
      g.rotateY(Math.PI / 2);
      add(g, sx * 0.83, 0.34, z);
    }
  }
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.16, 0.1, 0.08), sx * 0.92, 1.0, 0.62);
  }
  return raus;
}

describe("Ein Wrack im Zeichenruf-Budget", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  function wrack() {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    return { comps, car: comps.spawnCar(new THREE.Vector3(0, 1, 0)) };
  }

  it(`besteht aus ${NETZE_JE_WRACK} Netzen, nicht mehr`, () => {
    const { car } = wrack();
    expect(netze(car.group).length).toBe(NETZE_JE_WRACK);
  });

  it("hat die dreizehn Anbauteile in EINEM Netz", () => {
    const gruppe = new THREE.Group();
    baueAnbauteile(gruppe, CAR_DEF, 0x8c2f24);
    expect(netze(gruppe).length, "die Anbauteile sind wieder einzelne Netze").toBe(1);
    // 9 Kästen à 24 Ecken + 4 Halbtori à 91 = 580. Weniger heißt: ein Teil fehlt.
    const p = netze(gruppe)[0]!.geometry.getAttribute("position");
    expect(p.count).toBe(580);
  });

  it("zeigt jedes Anbauteil genau da, wo es vor dem Umbau war", () => {
    const gruppe = new THREE.Group();
    baueAnbauteile(gruppe, CAR_DEF, 0x8c2f24);
    const neu = eckpunkte([netze(gruppe)[0]!.geometry]);
    const alt = eckpunkte(altesAnbauteil());
    expect(neu.length).toBe(alt.length);
    /*
     * 1e-9 m = ein Nanometer. Mehr als Rundungsrauschen der Gleitkommazahlen
     * kann nicht herauskommen: Die Anteile in `CarDef` stehen als Division da
     * (`1.94 / 2.0`) und werden mit demselben Nenner wieder multipliziert.
     */
    expect(abweichung(neu, alt), "die Anbauteile sitzen nicht mehr wie vorher").toBeLessThan(1e-9);
  });

  it("hat Chassis und Kabine unverändert, obwohl die Maße jetzt in CarDef stehen", () => {
    const { car } = wrack();
    const alleNetze = netze(car.group);
    // Chassis: 5x3x10 = 150 Ecken -> BoxGeometry(…,4,2,9) hat 190; Kabine 126.
    const chassisNeu = alleNetze.find((m) => m.geometry.getAttribute("position").count === 190)!;
    const kabineNeu = alleNetze.find((m) => m.geometry.getAttribute("position").count === 126)!;
    expect(chassisNeu, "kein Chassis gefunden").toBeTruthy();
    expect(kabineNeu, "keine Kabine gefunden").toBeTruthy();

    const chassisAlt = new THREE.BoxGeometry(1.7, 0.55, 4.0, 4, 2, 9);
    formeKarosserie(chassisAlt);
    chassisAlt.translate(0, 0.28, 0);
    const kabineAlt = new THREE.BoxGeometry(1.5, 0.55, 2.0, 4, 2, 5);
    kabineAlt.translate(0, 0.83, -0.2);

    for (const [neuMesh, altGeo] of [
      [chassisNeu, chassisAlt],
      [kabineNeu, kabineAlt],
    ] as const) {
      const g = neuMesh.geometry.clone();
      g.translate(neuMesh.position.x, neuMesh.position.y, neuMesh.position.z);
      expect(abweichung(eckpunkte([g]), eckpunkte([altGeo]))).toBeLessThan(1e-9);
    }
  });
});

describe("Was NICHT verschmolzen werden darf", () => {
  beforeAll(async () => {
    await initPhysics();
  });

  it("Motor, Getriebe und vier Räder bleiben sechs eigene Netze und gehen einzeln ab", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    const car = comps.spawnCar(new THREE.Vector3(0, 1, 0));

    const zerlegbar = CAR_DEF.parts.map((p) => p.id);
    expect(zerlegbar.length, "Motor, Getriebe und vier Räder").toBe(6);
    const vorher = netze(car.group).length;
    for (const id of zerlegbar) {
      expect(car.tearPart(id), `${id} ließ sich nicht abreißen`).not.toBeNull();
    }
    // Jedes abgerissene Teil verlässt die Wrackgruppe: sechs Netze weniger.
    expect(netze(car.group).length).toBe(vorher - 6);
  });

  it("Pressen bringt das Wrack weiter auf Stufe 2, mit Radauswurf", () => {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const comps = new CompositeManager(scene, world, new ItemManager(scene, world), new EventBus());
    const car = comps.spawnCar(new THREE.Vector3(0, 1, 0));
    car.pressCrush();
    expect(car.crushStage).toBe(2);
    // Die Anbauteile werden mitgequetscht — sie hängen im crushGroup, dessen
    // y-Maßstab auf die Quetschstufe geht.
    const gequetscht = netze(car.group).filter(
      (m) => m.parent !== car.group && m.parent!.scale.y === CAR_DEF.crushScales[2]
    );
    expect(gequetscht.length, "nichts hängt mehr im crushGroup").toBeGreaterThan(0);
    expect(
      gequetscht.some((m) => m.geometry.getAttribute("position").count === 580),
      "die Anbauteile werden nicht mitgequetscht"
    ).toBe(true);
  });
});

/**
 * GEGENPROBE — der Eckpunktvergleich muss auch melden. Ohne diese Zeilen wäre
 * „Abweichung unter einem Nanometer" ein Satz, der auch bei einem Vergleich
 * zweier leerer Listen grün wird.
 */
describe("Gegenprobe: der Eckpunktvergleich meldet", () => {
  it("einen um einen Zentimeter verrutschten Anbau", () => {
    const echt = altesAnbauteil();
    const schief = altesAnbauteil();
    schief[0]!.translate(0, 0.01, 0);
    expect(abweichung(eckpunkte(echt), eckpunkte(schief))).toBeGreaterThan(1e-9);
  });

  it("und zählt nicht null Eckpunkte als Übereinstimmung", () => {
    expect(eckpunkte(altesAnbauteil()).length).toBe(580);
  });
});
