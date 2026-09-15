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
      "04_DREHKRANZ_RING",
      "05_MOTORHAUBE",
      "05_GEGENGEWICHT",
      "06_SITZ",
      "06_SCHEIBE_FRONT",
      "07_AUSLEGER_KASTEN",
      "07_AUSLEGER_STAHL",
      "07_STIEL_KASTEN",
      /*
       * Der Greiferhalter hiess bis zum 15.09.2026 `07_HALTER_BOLZEN` und war
       * eines von acht Meshes am Stiel. Seit E-029 liegt er samt Gusskopf,
       * Laschen und Scheiben im verschmolzenen Stahl-Netz des Stiels; jedes
       * Teil steht weiterhin als benannte Funktion in `armParts.ts`.
       */
      "07_STIEL_STAHL",
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
     * Stand 14.09.2026 nach dem Radumbau:
     *   125 Meshes unter root + 12 lose in der Szene = 137
     *   15 036 Dreiecke, 175 Zeichenrufe (nur unter root gezaehlt)
     *
     * Davor, bei der reinen Benennung: 117 + 12 = 129, 9 980 Dreiecke,
     * 167 Zeichenrufe.
     *
     * Stand 15.09.2026 nach E-029 (Zylinder, Drehkranz, Ausleger/Stiel):
     *   133 Netze, 19 212 Dreiecke, 188 Zeichenrufe.
     * Die Rechnung dahinter: Stiel 8 → 3, Ausleger 5 → 5 (bei sechsmal so viel
     * Inhalt), Auslegerschlauch 2 → 1, Logo 2 → 1, Drehkranz 1 → 2 (der Ring
     * ist bis zum Unterwagen-Paket ein eigenes Netz). Macht −4.
     *
     * Stand 15.09.2026 nach dem Fahrer-Paket: 119 Netze, 17 772 Dreiecke,
     * 162 Zeichenrufe. Daniel kostete 16 Netze und 4 648 Dreiecke und kostet
     * jetzt zwei Netze — Haut und Kleidung.
     */
    const meshes = baggerMeshes();
    expect(meshes.length, "Bauteilzahl am Bagger").toBe(119);
  });
});

/**
 * Waechter fuer das Rad — die Budgetregel und die Groesse.
 *
 * Beides kann still verlorengehen: Wer dem Reifen noch ein Detail gibt, macht
 * schnell ein zweites Mesh daraus; wer an den Stollen dreht, aendert leicht den
 * Aussenradius. Das eine kostet Zeichenrufe, das andere die Bodenfreiheit der
 * ganzen Maschine.
 */
describe("Rad", () => {
  const raeder = () => ["VL", "VR", "HL", "HR"].map((e) => scene.getObjectByName(`02_RAD_${e}`)!);

  it("hat je Rad genau drei Bauteile: Reifen, Felge, Nabe", () => {
    for (const rad of raeder()) {
      const teile: string[] = [];
      rad.traverse((o) => {
        if (o instanceof THREE.Mesh) teile.push(o.name.replace(/^02_RAD_[VH][LR]_/, ""));
      });
      expect(teile.sort(), `${rad.name}`).toEqual(["FELGE", "NABE", "REIFEN"]);
    }
  });

  it("der Reifen bleibt EIN Mesh und unter 800 Dreiecken", () => {
    /*
     * Die Budgetregel, gemessen auf Patricks Geraet (14.09.2026: FPS 48 ·
     * Frame 21,0 ms · 1322 Zeichenrufe · 240k Dreiecke): Dreiecke sind fast
     * gratis, BAUTEILE sind teuer. Der Reifen darf deshalb 800 Dreiecke haben
     * statt der 60, die er als Zylinder hatte — solange er ein Mesh bleibt.
     *
     * Heute sind es 768: Karkasse 384 (32 Umfangssegmente x 6 Baender x 2),
     * Stollen 384 (32 Quader x 12).
     */
    const reifen = scene.getObjectByName("02_RAD_VL_REIFEN") as THREE.Mesh;
    expect(reifen, "Reifen nicht gefunden").toBeDefined();
    expect(reifen.children.length, "der Reifen hat Unterteile — er muss EIN Mesh sein").toBe(0);
    const geo = reifen.geometry as THREE.BufferGeometry;
    const idx = geo.getIndex();
    const n = Math.floor((idx ? idx.count : geo.getAttribute("position").count) / 3);
    expect(n, `Reifen ${n} Dreiecke`).toBeLessThanOrEqual(800);
    // ... und nicht wieder ein Zwanzigeck: unter 200 waere das Profil weg
    expect(n, `Reifen ${n} Dreiecke — das Profil fehlt`).toBeGreaterThan(200);
  });

  it("nur der Reifen wirft Schatten", () => {
    /*
     * Jedes schattenwerfende Teil wird zweimal gezeichnet. Felge und Nabe
     * liegen vollstaendig in der Silhouette des Reifens; ihr Schatten waere
     * nicht zu sehen, wuerde aber acht Zeichenrufe kosten (vier Raeder x zwei).
     */
    for (const rad of raeder()) {
      rad.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        expect(o.castShadow, `${o.name} wirft Schatten`).toBe(o.name.endsWith("_REIFEN"));
      });
    }
  });

  it("behaelt Durchmesser 1,24 m und Breite 0,50 m", () => {
    /*
     * Der Raddurchmesser stimmt mit dem Vorbild (Sennebogen 840 E) ueberein
     * und ist ausdruecklich NICHT Gegenstand des Umbaus. Gemessen wird ueber
     * die Eckpunkte des Reifens, nicht ueber die Konstanten — sonst prueft der
     * Test wieder nur sich selbst.
     */
    const reifen = scene.getObjectByName("02_RAD_VL_REIFEN") as THREE.Mesh;
    reifen.updateMatrixWorld(true);
    const pos = (reifen.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    let rMax = 0;
    let breite = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      // Lokal: Achse in Y (die Gruppendrehung macht daraus X)
      rMax = Math.max(rMax, Math.hypot(p.x, p.z));
      breite = Math.max(breite, Math.abs(p.y) * 2);
    }
    expect(rMax * 2, "Raddurchmesser").toBeCloseTo(1.24, 2);
    expect(breite, "Reifenbreite").toBeCloseTo(0.5, 2);
  });

  it("der Bagger steht auf seinen Raedern, nicht darueber oder darin", () => {
    /*
     * Die Raeder haengen an der Achshoehe RAD_R ueber Grund. Weicht der
     * Aussenradius davon ab, schwebt die Maschine oder saegt sich ein — und
     * das faellt beim Fahren sofort auf, aber erst auf dem Geraet.
     */
    for (const rad of raeder()) {
      expect(rad.position.y, `${rad.name} Achshoehe`).toBeCloseTo(0.62, 6);
    }
  });

  it("die Raeder haben keinen eigenen Kollider — die Physik bleibt unberuehrt", () => {
    /*
     * Der Unterwagen ist fuer Rapier ein Quader; die Raeder waren dort nie
     * vertreten. Optische Tiefe darf keine Physik kosten. Geprueft wird das
     * hier so weit es kopflos geht: Kein Radknoten traegt einen Verweis auf
     * einen Koerper, und die Radgruppen sind reine Anzeige.
     */
    for (const rad of raeder()) {
      rad.traverse((o) => {
        expect(o.userData.collider ?? null, `${o.name} traegt einen Kollider`).toBeNull();
      });
    }
  });
});
