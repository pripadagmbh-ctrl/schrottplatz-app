import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager } from "../src/world/scrapItems";

/**
 * EIN EINTRAG OHNE KOERPER LEGT DAS SPIEL LAHM — und zwar sofort und ganz.
 *
 * DER BEFUND (E-097, Nebenbefund; repariert in E-098). In einem kopflosen
 * Dauerlauf stuerzte Rapier nach rund 5,5 Minuten ab, bei Bild 19.766:
 * `ItemManager.clampSpeeds` fragte `item.body.isDynamic()` an einem Eintrag,
 * dessen Koerper laengst entfernt war.
 *
 * DAS IST KEIN SCHOENHEITSFEHLER, und das ist der Grund, warum er vor allen
 * anderen drankam. Gemessen am 17.09.2026 (`tools/absturz-probe.ts`):
 *
 *   `isValid()`   auf dem entfernten Koerper  →  `false`   (gutartig)
 *   `isDynamic()` auf demselben Koerper       →  `RuntimeError: unreachable`
 *   danach `world.step()`                     →  „recursive use of an object
 *                                                detected which would lead to
 *                                                unsafe aliasing in rust"
 *
 * Die WELT ist danach hin, nicht nur das Teil. Ein Durchdringen sieht falsch
 * aus; das hier haelt das ganze Spiel an.
 *
 * DIE FRAGE, DIE DIESER WAECHTER STELLT: Ueberlebt der Fuhrpark-Takt einen
 * Eintrag, dessen Koerper ihm hinter dem Ruecken entfernt wurde? Und die
 * GEGENPROBE steht darunter: Ohne `isValid()` stuerzt genau dieser Aufruf ab.
 */

beforeAll(async () => {
  await RAPIER.init();
});

/** Ein frischer Platz mit Boden — jeder Fall bekommt seinen eigenen. */
function werkbank(): { items: ItemManager; world: RAPIER.World } {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0));
  return { items: new ItemManager(scene, world), world };
}

/** Drei Bleche auf den Boden legen. */
function dreiTeile(items: ItemManager): void {
  for (let i = 0; i < 3; i++) {
    items.spawnScrap(
      "steel",
      40,
      { kind: "box", dims: [0.8, 0.05, 0.6], color: 0x8899aa },
      new THREE.Vector3(i * 1.5, 0.6, 0)
    );
  }
}

describe("Ein Eintrag ohne Koerper haelt das Spiel nicht an", () => {
  it("`clampSpeeds` ueberlebt ihn und raeumt ihn weg", () => {
    const { items, world } = werkbank();
    dreiTeile(items);
    expect(items.items.length, "die Werkbank ist leer").toBe(3);

    /*
     * DER FEHLERFALL, NACHGESTELLT: Der Koerper wird aus der Welt genommen,
     * der Eintrag bleibt in der Liste. Genau diese Paarung hat den Dauerlauf
     * beendet. Wie sie im Spiel entsteht, ist nicht abschliessend geklaert —
     * dass sie das Spiel anhaelt, schon.
     */
    const verwaist = items.items[1]!;
    world.removeRigidBody(verwaist.body);
    expect(verwaist.body.isValid(), "der Koerper ist noch da — der Fall stellt nichts nach").toBe(
      false
    );

    // Ein ganzer Takt, wie ihn `main.ts` je Bild faehrt.
    expect(() => {
      items.clampSpeeds(1 / 60);
      items.settleSleep(1 / 60);
      items.syncMeshes();
      items.findNearest(new THREE.Vector3(0, 0, 0), 50);
    }, "der Takt stuerzt an einem verwaisten Eintrag ab").not.toThrow();

    // Und der Eintrag ist weg, nicht bloss uebersprungen.
    expect(items.items.length, "der verwaiste Eintrag steht noch in der Liste").toBe(2);
    expect(items.items.includes(verwaist)).toBe(false);
    // Die beiden anderen leben weiter — weggeraeumt wird nur, was tot ist.
    for (const it of items.items) expect(it.body.isValid()).toBe(true);
    // Und die Welt laeuft: Der Absturz nimmt sie sonst mit.
    expect(() => world.step(), "die Welt ist hin").not.toThrow();
  });

  it("und `byHandle` verliert dabei kein lebendes Teil", () => {
    /*
     * DIE FALLE BEIM AUFRAEUMEN, und sie ist beim Bauen dieses Waechters
     * zugeschnappt: `body.handle` eines ENTFERNTEN Koerpers liefert keinen
     * Fehler, sondern Unsinn — gemessen 2,1e−314 statt 0. Wer damit aus
     * `byHandle` loescht, trifft entweder nichts (dann bleibt die Leiche in
     * der Karte) oder den Eintrag eines LEBENDEN Teils, das die Nummer
     * inzwischen geerbt hat — und dann findet der Greifer es nicht mehr.
     * `raeumeVerwaiste` nimmt die Nummer deshalb aus der Karte.
     */
    const { items, world } = werkbank();
    dreiTeile(items);
    const verwaist = items.items[0]!;
    const lebende = items.items.slice(1);
    world.removeRigidBody(verwaist.body);
    expect(items.raeumeVerwaiste(), "es wurde nichts weggeraeumt").toBe(1);

    // Die Leiche ist aus der Karte heraus …
    expect([...(items as unknown as { byHandle: Map<number, unknown> }).byHandle.values()]).not.toContain(
      verwaist
    );
    // … und jedes lebende Teil ist ueber seinen Koerper weiter auffindbar.
    for (const it of lebende) {
      expect(items.itemByBody(it.body), "ein lebendes Teil ist aus `byHandle` verschwunden").toBe(it);
    }
  });
});

describe("GEGENPROBE: ohne `isValid()` ist es ein harter Absturz", () => {
  /*
   * ZULETZT, UND ZWAR ABSICHTLICH. Der Fehlschlag zerstoert die Rapier-Welt,
   * in der er passiert („recursive use of an object"). Eine frische Welt
   * laeuft danach wieder — gemessen —, aber kein Fall in dieser Datei soll
   * sich darauf verlassen muessen.
   */
  it("`isDynamic()` auf einem entfernten Koerper wirft, `isValid()` nicht", () => {
    const { items, world } = werkbank();
    dreiTeile(items);
    const tot = items.items[0]!.body;
    world.removeRigidBody(tot);
    // Die gutartige Frage — sie ist der ganze Unterschied.
    expect(tot.isValid()).toBe(false);
    // Und die boesartige. Bliebe sie stumm, waere die Reparatur ueberfluessig.
    expect(
      () => tot.isDynamic(),
      "Rapier beantwortet `isDynamic` auf einem entfernten Koerper friedlich — dann ist der Waechter oben unnoetig"
    ).toThrow();
  });
});
