/**
 * Wächter für den AUSLEGERBOCK — E-050.
 *
 * DER BEFUND, den dieser Wächter festhält (Patrick am Gerät, 15.09.2026:
 * „Keine Verbindung des Arms am Turm"): Der Auslegerfuß hing auf y 2,641 über
 * Grund, das nächste Bauteil darunter war die Deckplatte auf y 1,955.
 * Dazwischen standen über die ganze Breite **0,686 m Luft** — der Arm schwebte
 * über dem Aufbau.
 *
 * Was hier still verlorengehen kann:
 *   1. Der Bock selbst — dann ist die Lücke zurück, und das sieht man erst auf
 *      dem iPad. Die Gegenprobe unten baut den Oberwagen ausdrücklich OHNE
 *      Bock und zeigt, dass der Wächter dann rot wird. Ein Wächter, den man
 *      nicht scheitern gesehen hat, prüft nichts.
 *   2. Der Drehpunkt. `BOOM_LEN` 5,20, `STICK_LEN` 4,00 und `BOOM_PIVOT` sind
 *      gemessen, und der ganze Platz ist um die Reichweite herum gebaut
 *      (Schwenkband 5,80…9,20 m). Der Bock wird um den Drehpunkt HERUM gebaut;
 *      er verschiebt ihn nicht. Dass beide dieselbe Zahl benutzen, steht unten
 *      als Prüfung.
 *   3. Die Breite. Nach innen klemmt der Auslegerfuß, nach außen die Kabine.
 *      Beides sind gemessene Grenzen (`npx vite-node tools/auslegerbock.ts`),
 *      keine gewählten.
 *   4. Das Netzbudget aus E-025: Der Bock bewegt sich nicht gegen den
 *      Oberwagen und liegt deshalb in dessen Stahl-Netz. Er darf kein
 *      einziges Netz kosten.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { AUSLEGER_FUSS, AUSLEGER_FUSS_AUSSEN } from "../src/excavator/armParts";
import { BOCK, DECK_OBEN, auslegerbockTeile, oberwagenStahl } from "../src/excavator/oberwagenParts";

let scene: THREE.Scene;
let bagger: Excavator;

/** Ursprung des Oberwagens über Grund (`cabGroup.position` in excavator.ts). */
const OBER_Y = 1.6;
/** Fußanker der Hubzylinder (`HUB_FUSS_*` in excavator.ts). */
const HUB_FUSS: Array<[number, number, number]> = [
  [-0.52, 0.02, 1.05],
  [0.52, 0.02, 1.05],
];

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
  // Für die Messung an den Ursprung stellen: die Maschine steht sonst auf (−0,5 | −22,5).
  bagger.root.position.set(0, 0, 0);
  bagger.root.quaternion.identity();
  bagger.root.updateMatrixWorld(true);
});

/** Der Drehpunkt des Auslegers, aus der GEBAUTEN Maschine gelesen. */
function drehpunkt(): THREE.Vector3 {
  const arm = scene.getObjectByName("07_AUSLEGER")!;
  return new THREE.Vector3().setFromMatrixPosition(arm.matrixWorld);
}

/**
 * Trifft ein waagerechter Strahl auf Höhe `y` von außen den Oberwagen?
 *
 * Das ist die Prüffrage in ihrer einfachsten Form: Wer von der Seite auf die
 * Maschine sieht, muss zwischen Deckplatte und Auslegerfuß Material finden.
 * Der Strahl läuft in der Ebene des Drehpunkts (z = 0,55) von x = +3 nach
 * innen; auf diesem Weg steht sonst nichts (Haube ab z −0,15, Geländer ab
 * z −0,35, Tank bei z −1,45).
 */
function trifftVonDerSeite(y: number, ziel: THREE.Object3D): THREE.Intersection | undefined {
  const rc = new THREE.Raycaster();
  rc.set(new THREE.Vector3(3, y, drehpunkt().z), new THREE.Vector3(-1, 0, 0));
  return rc.intersectObject(ziel, true)[0];
}

describe("Auslegerbock — die Verbindung des Arms zum Oberwagen", () => {
  it("baut den Bock um den vorhandenen Drehpunkt, ohne ihn zu verschieben", () => {
    const p = drehpunkt();
    // Der Drehpunkt selbst — unverändert seit dem 11.09.2026 (E-006).
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(2.95, 6);
    expect(p.z).toBeCloseTo(0.55, 6);

    // Und das Lagerauge des Bocks sitzt GENAU dort.
    const teile = auslegerbockTeile(p.y - OBER_Y, p.z);
    const auge = teile.find((t) => t.name === "LAGERAUGE_R");
    if (!auge || auge.art !== "walze") throw new Error("Lagerauge fehlt");
    expect(auge.y + OBER_Y).toBeCloseTo(p.y, 6);
    expect(auge.z).toBeCloseTo(p.z, 6);
  });

  it("schließt die 0,69-m-Lücke zwischen Deckplatte und Auslegerfuß", () => {
    const deck = scene.getObjectByName("04_DREHKRANZ")!;
    const yDeck = OBER_Y + DECK_OBEN; // 1,955
    const yFuss = 2.641; // gemessen, tiefster Punkt des Fußes über den Schwenkbereich
    expect(yFuss - yDeck).toBeGreaterThan(0.6); // die Lücke, um die es geht

    /*
     * Auf JEDER Höhe dazwischen muss der Bock stehen. 5 cm Raster, und der
     * Strahl muss das Stahlnetz des Oberwagens treffen — nicht den Arm.
     */
    for (let y = yDeck + 0.03; y < yFuss; y += 0.05) {
      const treffer = trifftVonDerSeite(y, deck);
      expect(treffer, `Höhe y ${y.toFixed(2)}: nichts zu sehen`).toBeDefined();
      expect(Math.abs(treffer!.point.x), `Höhe y ${y.toFixed(2)}`).toBeLessThan(0.45);
    }
  });

  it("GEGENPROBE: ohne den Bock ist die Lücke wieder da", () => {
    /*
     * Derselbe Strahl gegen einen Oberwagen, der ausdrücklich ohne Bock gebaut
     * wurde. Fände er auch dort etwas, prüfte die Messung oben nichts.
     */
    const ohne = new THREE.Mesh(
      oberwagenStahl(HUB_FUSS, { y: 2.95 - OBER_Y, z: 0.55 }, true),
      new THREE.MeshBasicMaterial()
    );
    ohne.position.y = OBER_Y;
    ohne.updateMatrixWorld(true);
    let leer = 0;
    for (let y = OBER_Y + DECK_OBEN + 0.03; y < 2.641; y += 0.05) {
      if (!trifftVonDerSeite(y, ohne)) leer++;
    }
    expect(leer, "ohne Bock muss der Strahl ins Leere gehen").toBeGreaterThan(10);
  });

  it("nimmt den Auslegerfuß ZWISCHEN seine Wangen, mit Luft", () => {
    // Innen: die Wange darf den Arm nicht berühren.
    expect(BOCK.xInnen).toBeGreaterThan(AUSLEGER_FUSS_AUSSEN);
    expect(BOCK.xInnen - AUSLEGER_FUSS_AUSSEN).toBeGreaterThanOrEqual(0.025);
    // Das Lagerauge muss größer sein als die Fußlasche — sonst sitzt der Fuß
    // nicht IM Bock, sondern schaut daraus hervor.
    expect(BOCK.augeR).toBeGreaterThan(AUSLEGER_FUSS.r + 0.03);
  });

  it("hat einen durchgehenden Bolzen, der beide Wangen verbindet", () => {
    const teile = auslegerbockTeile(2.95 - OBER_Y, 0.55);
    const bolzen = teile.find((t) => t.name === "BOLZEN");
    if (!bolzen || bolzen.art !== "walze") throw new Error("Bolzen fehlt");
    const aussen = BOCK.xInnen + BOCK.augeDicke;
    expect(bolzen.x[0], "Bolzen muss links über das Auge hinausstehen").toBeLessThan(-aussen);
    expect(bolzen.x[1], "Bolzen muss rechts über das Auge hinausstehen").toBeGreaterThan(aussen);
    // Und er umschließt den Fußbolzen des Auslegers (r 0,0989), statt neben ihm zu liegen.
    expect(bolzen.r).toBeGreaterThan(AUSLEGER_FUSS.r * 0.38);
    // Sicherung: an jedem Bolzenende ein Flachstahl mit zwei Schrauben.
    expect(teile.filter((t) => t.name.startsWith("BOLZENSICHERUNG")).length).toBe(2);
    expect(teile.filter((t) => t.name.startsWith("SICHERUNGSSCHRAUBE")).length).toBe(4);
  });

  it("steht auf der Deckplatte, nicht daneben und nicht darin", () => {
    const teile = auslegerbockTeile(2.95 - OBER_Y, 0.55);
    for (const t of teile) {
      const yUnten =
        t.art === "quader"
          ? t.y[0]
          : t.art === "blech"
            ? Math.min(...t.umriss.map((p) => p[1]))
            : t.y - t.r;
      expect(yUnten, `${t.name} reicht unter die Deckplatte`).toBeGreaterThanOrEqual(DECK_OBEN - 1e-9);
    }
    // Wange und Fußflansch setzen GENAU auf der Deckplatte auf.
    const wange = teile.find((t) => t.name === "LAGERWANGE_R");
    if (!wange || wange.art !== "blech") throw new Error("Lagerwange fehlt");
    expect(Math.min(...wange.umriss.map((p) => p[1]))).toBeCloseTo(DECK_OBEN, 6);
  });

  it("bleibt in der Breite zwischen Arm und Kabine", () => {
    /*
     * 0,490 ist der nächste Punkt der Kabine im Bockfenster, gemessen über 21
     * Hubstellungen (`tools/auslegerbock.ts`, Abschnitt 2). Die Kabine bewegt
     * sich beim Heben nur in y und z, nie in x — die Zahl gilt deshalb für
     * jede Stellung.
     */
    const KABINE = 0.49;
    const teile = auslegerbockTeile(2.95 - OBER_Y, 0.55);
    let aussen = 0;
    for (const t of teile) aussen = Math.max(aussen, Math.abs(t.x[0]), Math.abs(t.x[1]));
    expect(aussen, "Bock stößt an die Kabine").toBeLessThan(KABINE - 0.03);
  });

  it("kostet kein einziges Netz", () => {
    let netze = 0;
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === bagger.grappleGroup) return;
      netze++;
    });
    // Ziel aus E-025; vor dem Bock waren es dieselben 57.
    expect(netze, "Netzbudget des Baggers").toBe(57);
    // Der Bock steckt im Stahl-Netz des Oberwagens und hat keinen eigenen Knoten.
    expect(scene.getObjectByName("07_AUSLEGERBOCK")).toBeUndefined();
  });
});
