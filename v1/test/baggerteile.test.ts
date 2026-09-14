/**
 * Waechter: Jedes Bauteil am Bagger traegt einen Namen.
 *
 * Anlass (14.09.2026): Der Bagger hatte 0 benannte Knoten von 117. Beim
 * Fuenfschalengreifer heissen die Teile `SHELL_01`, `07_ZAHN`, `ADAPTER` —
 * deshalb kann man ueber ihn reden, ihn messen und gezielt aendern. Am Bagger
 * ging das nicht: Ein Befund wie „das kleine Teil unten am Rad flimmert" liess
 * sich keinem Mesh zuordnen, und eine Messung wie
 * `tools/fuenfschalen/zahnlage.ts` — die den Zahn ueber seinen NAMEN sucht,
 * statt den aeussersten Punkt zu raten — war gar nicht moeglich.
 *
 * Namen verfallen leise: Wer ein Teil hinzufuegt und den Namen vergisst, merkt
 * nichts. Darum dieser Waechter.
 *
 * Er prueft KEIN Verhalten und kein Aussehen. Er prueft nur, dass jedes Mesh
 * einen Namen nach dem Muster `NN_...` traegt, mit NN aus den acht Baugruppen
 * des Baggerkonzepts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";

/**
 * Die acht Baugruppen. Die Nummer steht vorn, damit eine alphabetische Liste
 * automatisch von unten nach oben durch die Maschine laeuft.
 */
const BAUGRUPPEN: Record<string, string> = {
  "01": "Unterwagen (samt Raeumschild)",
  "02": "Raeder",
  "03": "Pratzen",
  "04": "Drehkranz",
  "05": "Oberwagen",
  "06": "Kabine (samt Fahrer)",
  "07": "Ausleger, Stiel, Greiferhalter",
  "08": "Kleinteile (Logos, Schilder)",
};

let bagger: Excavator;
let scene: THREE.Scene;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
});

/**
 * Alle Meshes des Baggers.
 *
 * Zwei Fundorte, und der zweite ist der Grund, warum hier die SZENE abgelaufen
 * wird und nicht nur `root`: Hydraulikzylinder und Kabinenlenker rechnen in
 * Weltkoordinaten und haengen deshalb lose in der Szene. Gerade die brauchen
 * Namen — im Szenengraph sind sie sonst von Platzobjekten nicht zu
 * unterscheiden.
 *
 * Die Spinne (`grappleGroup`) bleibt aussen vor: Sie hat ihre eigene
 * Teileliste in `grappleParts.ts` und wird von `test/spinnenmodell.test.ts`
 * gehuetet.
 */
function baggerMeshes(): THREE.Mesh[] {
  const raus: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p === bagger.grappleGroup) return;
    }
    raus.push(o);
  });
  return raus;
}

describe("Positionsliste des Baggers", () => {
  it("jedes Mesh traegt einen Namen", () => {
    const ohne = baggerMeshes().filter((m) => !m.name);
    expect(
      ohne.length,
      `${ohne.length} unbenannte Meshes, z. B. unter ` +
        ohne
          .slice(0, 5)
          .map((m) => m.parent?.name || "(namenlose Gruppe)")
          .join(", ")
    ).toBe(0);
  });

  it("jeder Name nennt seine Baugruppe", () => {
    /*
     * `05_MOTORHAUBE`, `07_ZYLINDER_HUB_L` — die fuehrende Nummer sagt, wo am
     * Bagger das Teil sitzt. Ohne sie waere es wieder eine Liste ohne Ordnung.
     */
    const falsch = baggerMeshes().filter((m) => !/^(0[1-8])_[A-Z0-9_]+$/.test(m.name));
    expect(
      falsch.map((m) => m.name),
      "Namen ausserhalb des Musters NN_TEIL mit NN = 01…08"
    ).toEqual([]);
  });

  it("kein Name kommt zweimal vor", () => {
    /*
     * Zwei gleiche Namen sind schlimmer als gar keiner: `getObjectByName`
     * liefert dann irgendeines von beiden, und eine Messung daran ist ein
     * Zufallswert.
     */
    const zaehler = new Map<string, number>();
    for (const m of baggerMeshes()) zaehler.set(m.name, (zaehler.get(m.name) ?? 0) + 1);
    const doppelt = [...zaehler.entries()].filter(([, n]) => n > 1);
    expect(doppelt, "doppelt vergebene Namen").toEqual([]);
  });

  it("alle acht Baugruppen sind besetzt", () => {
    const gefunden = new Set(baggerMeshes().map((m) => m.name.slice(0, 2)));
    for (const [nr, was] of Object.entries(BAUGRUPPEN)) {
      expect(gefunden.has(nr), `Baugruppe ${nr} (${was}) hat kein einziges Teil`).toBe(true);
    }
  });

  it("die tragenden Teile lassen sich ueber ihren Namen finden", () => {
    /*
     * Die Probe aufs Exempel: Wer misst, sucht ueber den Namen. Diese hier
     * muessen deshalb da sein — an ihnen haengen Kollider, Kamera und Kinematik.
     */
    for (const name of [
      "01_UNTERWAGEN",
      "01_RAEUMSCHILD_BLATT",
      "02_RAD_VL",
      "02_RAD_VR",
      "02_RAD_HL",
      "02_RAD_HR",
      "03_PRATZE_VL_TELLER",
      "04_DREHKRANZ",
      "05_MOTORHAUBE",
      "05_GEGENGEWICHT",
      "06_SITZ",
      "06_SCHEIBE_FRONT",
      "07_AUSLEGER_KASTEN",
      "07_STIEL_KASTEN",
      "07_HALTER_BOLZEN",
    ]) {
      expect(scene.getObjectByName(name), `${name} nicht gefunden`).toBeDefined();
    }
  });

  it("das Zaehlwerk stimmt mit der Messung vom 14.09.2026 ueberein", () => {
    /*
     * Kein Verbot, nur ein Melder: Wer Bauteile hinzufuegt, soll es merken und
     * die Zahl hier mitziehen — samt Datum und Grund.
     *
     * Die Budgetregel kommt von Patricks Geraet (14.09.2026: FPS 48 · Frame
     * 21,0 ms · 1322 Zeichenrufe · 240k Dreiecke · Physik 0,5 ms): Dreiecke
     * sind fast gratis, BAUTEILE sind teuer, und jedes schattenwerfende Teil
     * wird zweimal gezeichnet.
     *
     * Stand 14.09.2026 (Benennung, unveraendertes Modell):
     *   117 Meshes unter root + 12 lose in der Szene = 129
     *   9 980 Dreiecke, 167 Zeichenrufe (nur unter root gezaehlt)
     */
    const meshes = baggerMeshes();
    expect(meshes.length, "Bauteilzahl am Bagger").toBe(129);
  });
});
