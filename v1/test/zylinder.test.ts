/**
 * Wächter für die drei Pakete des Baggerumbaus vom 15.09.2026
 * (E-029, aus E-025): Zylinder · Drehkranz · Ausleger und Stiel.
 *
 * DER FEHLER, DER NICHT ZURÜCKKOMMEN DARF: Bis zum 15.09.2026 wurde die
 * „Kolbenstange" mit `rod.scale.y` auf den Ankerabstand GEDEHNT — am
 * Hubzylinder von 0,97 auf 2,21 m, also um +128 %. Solange die Stange ein
 * glattes Rohr war, fiel das kaum auf; mit Gabelkopf und Bolzen daran wäre der
 * Bolzen zur Wurst geworden.
 *
 * Ein echter Zylinder hält Rohr- und Stangenlänge fest und SCHIEBT die Stange.
 * Deshalb prüft dieser Wächter drei Dinge über den ganzen Bewegungsbereich:
 *
 *   1. kein `scale` auf Rohr oder Stange,
 *   2. die Rohrlänge bleibt konstant,
 *   3. der Kolben bleibt im Rohr — er schaut weder hinten heraus noch fährt
 *      er vorn aus der Führung.
 *
 * Und weil das Verschmelzen (E-025) Netze spart, die man beim nächsten Detail
 * leicht wieder verliert: die Netzzahl je Baugruppe steht hier ebenfalls.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { baueZylinder, rohrLaenge, stangeLaenge } from "../src/excavator/zylinderParts";
import { HUB_MAX, ZYL_MASSE } from "../src/excavator/kabinenhubParts";
import {
  drehkranzRing,
  DREHKRANZ_D,
  DREHKRANZ_Y_OBEN,
  DREHKRANZ_Y_UNTEN,
} from "../src/excavator/drehkranzParts";

/** Achsgrenzen — wie in `tools/zylinderhub.ts`, Kopien aus `excavator.ts`. */
const BOOM_MIN = THREE.MathUtils.degToRad(5);
const BOOM_MAX = THREE.MathUtils.degToRad(70);
const STICK_MIN = THREE.MathUtils.degToRad(-140);
const STICK_MAX = THREE.MathUtils.degToRad(-25);

/**
 * ALLE Zylinder der Maschine — seit E-040 ohne Ausnahme.
 *
 * BIS ZUM 15.09.2026 STAND HIER EINE AUSNAHME, und sie ist der Grund, warum
 * diese Liste jetzt vollständig ist: Der Kabinenhub (`06_ZYLINDER_KABINE_A/B`)
 * verlangte ein Hubverhältnis von **5,18 : 1** (Ankerabstand 0,650 → 3,368 m).
 * Das kann kein einstufiger Zylinder — sein Rohr war mit 1,10 m sogar länger
 * als der Spalt von 0,65 m, in dem es stand, und ragte durch den Kabinenboden.
 * Deshalb blieb er auf der alten Streckbauweise, und dieser Wächter musste ihn
 * ausnehmen.
 *
 * Eine Ausnahme in einem Wächter ist eine offene Tür: Sie schützt nicht vor
 * dem Fehler, sie beschreibt ihn nur. Seit E-040 gibt es sie nicht mehr — der
 * Kabinenhub ist ein Schwenkwerk mit Hebel geworden, aus 5,18 : 1 sind
 * **1,47 : 1** geworden, und aus ZWEI unmöglichen Zylindern EINER, der gebaut
 * werden könnte. Er wird hier ab jetzt geprüft wie jeder andere.
 *
 * Die Maße des Kabinenhubzylinders werden nicht abgeschrieben, sondern aus
 * `kabinenhubParts.ts` geholt: Sie folgen dort aus Hebellänge und Fußabstand
 * und wären als Kopie beim nächsten Handgriff still falsch.
 */
const ECHTE_ZYLINDER = [
  { name: "07_ZYLINDER_HUB_R", kurz: 2.518, lang: 3.757, rRohr: 0.1 },
  { name: "07_ZYLINDER_HUB_L", kurz: 2.518, lang: 3.757, rRohr: 0.1 },
  { name: "07_ZYLINDER_STIEL", kurz: 1.809, lang: 2.235, rRohr: 0.08 },
  { name: "06_ZYLINDER_KABINE", ...ZYL_MASSE },
];

let bagger: Excavator;
let scene: THREE.Scene;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  scene = new THREE.Scene();
  bagger = new Excavator(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
});

function finde(name: string): THREE.Object3D {
  const o = scene.getObjectByName(name);
  if (!o) throw new Error(`${name} nicht gefunden`);
  return o;
}

/** Alle Meshes des Baggers ohne die Spinne — wie in `baggerteile.test.ts`. */
function baggerMeshes(): THREE.Mesh[] {
  const raus: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === bagger.grappleGroup) return;
    raus.push(o);
  });
  return raus;
}

/**
 * Die Maschine in eine Stellung bringen und die Hydraulik nachziehen.
 *
 * SEIT E-040 GEHÖRT DER KABINENHUB DAZU. Vorher genügte es, Ausleger und Stiel
 * zu drehen — der Kabinenhubzylinder war ja ausgenommen. Jetzt fährt auch die
 * Kabine mit: Ohne das bliebe ihr Zylinder in jeder Prüfung auf derselben
 * Länge stehen, und „die Stange fährt sichtbar aus" wäre keine Aussage,
 * sondern eine Höflichkeit.
 *
 * `step` rechnet die ganze Kinematik; hier genügen die Winkel und
 * `syncMeshes`, das `step` ohnehin ruft.
 */
function stelle(boom: number, stick: number, hub = 0): void {
  const b = bagger as unknown as {
    cabLift: number;
    syncMeshes(): void;
    updateHydraulics(): void;
  };
  b.cabLift = hub;
  b.syncMeshes();
  finde("07_AUSLEGER").rotation.x = -boom;
  finde("07_STIEL").rotation.x = -stick;
  bagger.root.updateWorldMatrix(true, true);
  b.updateHydraulics();
}

/** Länge des Rohrs, wie sie im Bild zu messen wäre: Weltabstand der Endpunkte. */
function rohrLaengeGemessen(mesh: THREE.Mesh): number {
  const geo = mesh.geometry as THREE.BufferGeometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  mesh.updateWorldMatrix(true, false);
  const unten = new THREE.Vector3(0, bb.min.y, 0).applyMatrix4(mesh.matrixWorld);
  const oben = new THREE.Vector3(0, bb.max.y, 0).applyMatrix4(mesh.matrixWorld);
  return unten.distanceTo(oben);
}

describe("Hydraulikzylinder — Stange schiebt, Rohr dehnt sich nicht", () => {
  it("die Rechnung geht auf: Auge + Rohr + Auge = kürzester Ankerabstand", () => {
    /*
     * Die Probe des Konzepts (`docs/baggerkonzept.md`, Abschnitt 6a):
     * 0,11 + 2,30 + 0,11 = 2,52 m — der gemessene kürzeste Ankerabstand des
     * Hubzylinders ist 2,518 m. Stimmt die Rechnung nicht, steht das Rohr in
     * der eingefahrenen Stellung über seinen eigenen Anker hinaus.
     */
    for (const z of ECHTE_ZYLINDER) {
      const auge = z.rRohr * 1.1;
      expect(2 * auge + rohrLaenge(z), `${z.name}: Baulänge eingefahren`).toBeCloseTo(z.kurz, 6);
      expect(rohrLaenge(z), `${z.name}: Rohrlänge`).toBeGreaterThan(0.3);
      // Die Stange muss mindestens den Hub abdecken, sonst reißt sie ab
      expect(stangeLaenge(z), `${z.name}: Stangenlänge`).toBeGreaterThan(z.lang - z.kurz);
    }
  });

  it("weder Rohr noch Stange werden je skaliert", () => {
    for (let i = 0; i <= 12; i++) {
      const b = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / 12;
      for (let j = 0; j <= 12; j++) {
        stelle(b, STICK_MIN + ((STICK_MAX - STICK_MIN) * j) / 12, (HUB_MAX * j) / 12);
        for (const z of ECHTE_ZYLINDER) {
          for (const teil of ["ROHR", "STANGE"]) {
            const m = finde(`${z.name}_${teil}`);
            expect(
              [m.scale.x, m.scale.y, m.scale.z],
              `${z.name}_${teil} wird skaliert — genau das war der Fehler bis 15.09.2026`
            ).toEqual([1, 1, 1]);
          }
        }
      }
    }
  });

  it("die Rohrlänge bleibt über den ganzen Hub konstant", () => {
    for (const z of ECHTE_ZYLINDER) {
      const rohr = finde(`${z.name}_ROHR`) as THREE.Mesh;
      const werte: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const b = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / 8;
        for (let j = 0; j <= 8; j++) {
          stelle(b, STICK_MIN + ((STICK_MAX - STICK_MIN) * j) / 8, (HUB_MAX * j) / 8);
          werte.push(rohrLaengeGemessen(rohr));
        }
      }
      const min = Math.min(...werte);
      const max = Math.max(...werte);
      expect(max - min, `${z.name}: Rohrlänge schwankt um ${(max - min) * 1000} mm`).toBeLessThan(
        1e-6
      );
    }
  });

  it("die Stange fährt aus — und zwar sichtbar", () => {
    /*
     * Das ist der Punkt, den man von außen sehen soll. Gemessen wird, wie weit
     * die Stange aus dem Führungskopf heraussteht: eingefahren ein Stummel,
     * ausgefahren ein gutes Stück. Bliebe der Wert konstant, wäre der Zylinder
     * starr und nur die Lage hätte sich geändert.
     */
    for (const z of ECHTE_ZYLINDER) {
      const a = finde(`${z.name}_FUSS`);
      const b = finde(`${z.name}_KOPF`);
      const auge = z.rRohr * 1.1;
      const rl = rohrLaenge(z);
      const pa = new THREE.Vector3();
      const pb = new THREE.Vector3();
      let kleinste = Infinity;
      let groesste = -Infinity;
      for (let i = 0; i <= 10; i++) {
        const bw = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / 10;
        for (let j = 0; j <= 10; j++) {
          stelle(bw, STICK_MIN + ((STICK_MAX - STICK_MIN) * j) / 10, (HUB_MAX * j) / 10);
          a.getWorldPosition(pa);
          b.getWorldPosition(pb);
          const d = pa.distanceTo(pb);
          kleinste = Math.min(kleinste, d - auge - rl);
          groesste = Math.max(groesste, d - auge - rl);
        }
      }
      expect(kleinste, `${z.name}: Stange verschwindet im Rohr`).toBeGreaterThan(0);
      expect(groesste - kleinste, `${z.name}: sichtbarer Hub`).toBeGreaterThan(0.3);
    }
  });

  it("der Kolben bleibt im Rohr — vorn wie hinten", () => {
    for (const z of ECHTE_ZYLINDER) {
      const a = finde(`${z.name}_FUSS`);
      const b = finde(`${z.name}_KOPF`);
      const auge = z.rRohr * 1.1;
      const rl = rohrLaenge(z);
      const sl = stangeLaenge(z);
      const pa = new THREE.Vector3();
      const pb = new THREE.Vector3();
      for (let i = 0; i <= 10; i++) {
        const bw = BOOM_MIN + ((BOOM_MAX - BOOM_MIN) * i) / 10;
        for (let j = 0; j <= 10; j++) {
          stelle(bw, STICK_MIN + ((STICK_MAX - STICK_MIN) * j) / 10, (HUB_MAX * j) / 10);
          a.getWorldPosition(pa);
          b.getWorldPosition(pb);
          const kolben = pa.distanceTo(pb) - sl; // Abstand Kolbenboden vom Fußanker
          expect(kolben, `${z.name}: Stange steht hinten aus dem Rohr`).toBeGreaterThan(auge);
          expect(kolben, `${z.name}: Kolben verlässt die Führung`).toBeLessThan(auge + rl);
        }
      }
    }
  });

  it("ein Zylinder besteht aus genau ZWEI Netzen", () => {
    /*
     * Sechs benannte Teile (Bodenauge, Rohr, Führungskopf, Anschlüsse,
     * Kolbenstange, Gabelkopf) — aber nur zwei Starrkörper, also zwei Netze
     * (E-025). Wer ein Detail als eigenes Mesh anhängt, merkt es hier.
     */
    for (const z of ECHTE_ZYLINDER) {
      for (const teil of ["ROHR", "STANGE"]) {
        const m = finde(`${z.name}_${teil}`);
        expect(m.children.length, `${z.name}_${teil} hat Unterteile`).toBe(0);
      }
    }
    const alle = baggerMeshes().filter((m) => /^0[67]_ZYLINDER_/.test(m.name));
    expect(alle.length, "Zylinder-Netze am Bagger (4 Zylinder × 2)").toBe(8);
  });

  it("es wird gar nichts mehr gestreckt — die letzte Ausnahme ist weg", () => {
    /*
     * HIER STAND BIS ZUM 15.09.2026 DAS GEGENTEIL: „gestreckt wird nur noch
     * der Kabinenhub — und der begründet". Der Test ERLAUBTE genau zwei
     * gedehnte Kolbenstangen. Er hielt einen Fehler fest, statt ihn zu
     * verbieten.
     *
     * Die Begründung war richtig und ist es immer noch: `baueZylinder`
     * weigerte sich zu Recht, für 0,650 m Ankerabstand ein Rohr zu bauen — bei
     * 2 × 0,0605 m Auge blieben 0,529 m Rohr, die Stange hätte 2,85 m lang
     * sein und eingefahren 2,2 m hinten herausstehen müssen. Nur war die
     * Antwort darauf nicht „dann strecken wir eben", sondern: die MECHANIK
     * ändern. Seit E-040 sitzt der Zylinder an einem Hebel auf der
     * Lenkerwelle; aus 5,18 : 1 sind 1,47 : 1 geworden.
     *
     * Deshalb steht hier jetzt eine leere Liste und keine Ausnahme. Wer wieder
     * streckt, fällt auf — an welchem Zylinder auch immer.
     */
    stelle(BOOM_MIN, STICK_MIN, HUB_MAX / 2);
    const gestreckt = baggerMeshes().filter(
      (m) => /_(STANGE|ROHR)$/.test(m.name) && m.scale.toArray().some((v) => Math.abs(v - 1) > 1e-9)
    );
    expect(gestreckt.map((m) => m.name).sort(), "gestreckte Zylinderteile").toEqual([]);
    /*
     * Und die Kabine hängt auch nicht mehr an gedehnten Lenkern: Deren
     * Ankerabstand wuchs von 0,647 auf 3,139 m — Faktor 4,8. Jetzt ist es EIN
     * Netz mit fester Länge, das sich dreht.
     */
    const lenker = baggerMeshes().filter((m) => /KABINENLENKER/.test(m.name));
    expect(lenker.length, "Netze für die Kabinenlenker (vorher zwei gedehnte)").toBe(1);
    expect(
      lenker[0]!.scale.toArray(),
      "der Kabinenlenker wird gedehnt — genau das war der alte Fehler"
    ).toEqual([1, 1, 1]);
  });

  it("ein unmöglicher Zylinder wird nicht still gebaut, sondern gemeldet", () => {
    // Der ALTE Kabinenhub als echter Zylinder: 0,650 m Ankerabstand, Rohrradius 0,4
    expect(() => baueZylinder({ kurz: 0.65, lang: 3.368, rRohr: 0.4 })).toThrow(/E-025/);
  });

  it("der neue Kabinenhubzylinder ist kein Sonderfall mehr", () => {
    /*
     * Die Probe, dass der Umbau die Sache gelöst und nicht nur verschoben hat:
     * Sein Hubverhältnis liegt zwischen denen der beiden anderen Zylinder
     * (1,24 und 1,49) — also im Bereich des Gewöhnlichen.
     */
    const v = ZYL_MASSE.lang / ZYL_MASSE.kurz;
    expect(v, "Hubverhältnis des Kabinenhubs").toBeGreaterThan(1.24);
    expect(v, "Hubverhältnis des Kabinenhubs").toBeLessThan(1.6);
    expect(rohrLaenge(ZYL_MASSE), "Rohrlänge").toBeGreaterThan(0.5);
    expect(stangeLaenge(ZYL_MASSE), "Stangenlänge").toBeGreaterThan(ZYL_MASSE.lang - ZYL_MASSE.kurz);
  });
});

describe("Drehkranz — die Taille, an der man das Schwenken sieht", () => {
  it("der Ring steht zwischen Unterwagen und Oberwagen", () => {
    /*
     * Seit dem Unterwagen-Paket liegt der Ring im Netz `01_UNTERWAGEN_STAHL`
     * (Konzept Abschnitt 04: „0 eigene Netze"). Gemessen wird er deshalb nicht
     * mehr über seinen Namen, sondern über seine LAGE: Was steht im Band
     * zwischen Rahmenoberkante (1,60) und Ringoberkante (1,78), und wie weit
     * reicht es vom Drehmittelpunkt?
     */
    const stahl = finde("01_UNTERWAGEN_STAHL") as THREE.Mesh;
    const pos = (stahl.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let rMax = 0;
    let treffer = 0;
    let hoechstes = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < DREHKRANZ_Y_UNTEN + 0.01 || y > DREHKRANZ_Y_OBEN + 0.01) continue;
      treffer++;
      rMax = Math.max(rMax, Math.hypot(pos.getX(i), pos.getZ(i)));
      hoechstes = Math.max(hoechstes, y);
    }
    expect(treffer, "im Drehkranzband steht gar nichts").toBeGreaterThan(200);
    expect(hoechstes, "Ringoberkante").toBeCloseTo(DREHKRANZ_Y_OBEN, 2);
    expect(rMax * 2, "Außendurchmesser").toBeGreaterThan(DREHKRANZ_D);

    /*
     * Der Ring selbst wird am Bauteil gemessen, nicht im verschmolzenen Netz:
     * Dort steht im selben Höhenband auch der Handlauf des Aufstiegs (r 1,82),
     * und der hat mit dem Drehkranz nichts zu tun. Erst am Bauteil lässt sich
     * sagen, wie dick die Taille wirklich ist.
     */
    const ring = drehkranzRing();
    ring.computeBoundingBox();
    const bb = ring.boundingBox!;
    const d = Math.max(bb.max.x, bb.max.z) * 2;
    expect(d, "Ringdurchmesser mit Flansch").toBeGreaterThan(DREHKRANZ_D);
    // Er darf nicht über den Unterwagenkasten (2,40 m breit) hinausragen
    expect(d, "Ringdurchmesser mit Flansch").toBeLessThan(2.4);
    expect(bb.max.y, "Bauhöhe des Rings").toBeCloseTo(DREHKRANZ_Y_OBEN - DREHKRANZ_Y_UNTEN, 2);
  });

  it("der Ring dreht NICHT mit — er gehört zum Unterwagen", () => {
    /*
     * Genau das ist der Sinn der Sache: Der Oberwagen dreht sich gegen den
     * Ring. Läge der Ring im Netz des Oberwagens, drehte sich die Taille mit
     * und man sähe von der Drehung nichts.
     */
    const stahl = finde("01_UNTERWAGEN_STAHL");
    let amOberwagen = false;
    for (let p: THREE.Object3D | null = stahl; p; p = p.parent) {
      if (p.name === "05_OBERWAGEN") amOberwagen = true;
    }
    expect(amOberwagen, "der Drehkranzring hängt am Oberwagen").toBe(false);
    // ... und der Deckel dreht mit, er gehört zum Oberwagen
    let deckelAmOberwagen = false;
    for (let p: THREE.Object3D | null = finde("04_DREHKRANZ"); p; p = p.parent) {
      if (p.name === "05_OBERWAGEN") deckelAmOberwagen = true;
    }
    expect(deckelAmOberwagen, "der Drehkranzdeckel dreht nicht mit").toBe(true);
  });

  it("die Deckplatte des Oberwagens behält ihre Oberkante bei y 1,955", () => {
    /*
     * Sie wurde dünner und rückte nach oben, damit der Ring Platz hat. Ihre
     * OBERKANTE musste dabei bleiben, wo sie war — auf ihr stehen Motorhaube,
     * Gegengewicht und Kabine, und darüber liegt der Auslegerdrehpunkt.
     *
     * Gemessen wird am Rand: Seit dem Oberwagen-Paket liegt im Netz
     * `04_DREHKRANZ` der ganze Stahl des Oberwagens (Geländer, Auspuff,
     * Gegengewicht). Nur die Deckplatte reicht bis x ±1,45 — dort steht sonst
     * nichts, und deshalb lässt sich ihre Dicke dort ablesen.
     */
    const deck = finde("04_DREHKRANZ") as THREE.Mesh;
    const pos = (deck.geometry as THREE.BufferGeometry).getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    let oben = -Infinity;
    let unten = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)) < 1.3) continue;
      oben = Math.max(oben, pos.getY(i));
      unten = Math.min(unten, pos.getY(i));
    }
    // Oberwagen-Ursprung liegt bei y 1,60
    expect(1.6 + oben, "Oberkante der Deckplatte").toBeCloseTo(1.955, 3);
    expect(1.6 + unten, "Unterkante — über der Ringoberkante 1,78").toBeGreaterThan(
      DREHKRANZ_Y_OBEN - 0.001
    );
  });
});

describe("Ausleger und Stiel — Kastenprofil statt Quader", () => {
  it("beide verjüngen sich zur Spitze", () => {
    for (const [name, laenge, hFuss, hKopf] of [
      ["07_AUSLEGER_KASTEN", 5.2, 0.62, 0.44],
      ["07_STIEL_KASTEN", 4.0, 0.45, 0.3],
    ] as const) {
      const m = finde(name) as THREE.Mesh;
      const pos = (m.geometry as THREE.BufferGeometry).getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      let amFuss = 0;
      let amKopf = 0;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const y = Math.abs(pos.getY(i));
        if (z < -laenge / 2 + 0.01) amFuss = Math.max(amFuss, y * 2);
        if (z > laenge / 2 - 0.01) amKopf = Math.max(amKopf, y * 2);
      }
      expect(amFuss, `${name}: Bauhöhe am Fuß`).toBeCloseTo(hFuss, 2);
      expect(amKopf, `${name}: Bauhöhe am Kopf`).toBeCloseTo(hKopf, 2);
    }
  });

  it("die Kästen sitzen weiter in der Mitte — dort hängt der Kollider", () => {
    /*
     * `armShapes` und `syncMeshes` führen die Arm-Kollider den Kasten-Meshes
     * nach. Wanderte das Mesh, wanderte der Kollider mit, und der Arm schöbe
     * Schrott an einer Stelle beiseite, an der er gar nicht ist.
     */
    expect(finde("07_AUSLEGER_KASTEN").position.toArray(), "Auslegerkasten").toEqual([0, 0, 2.6]);
    expect(finde("07_STIEL_KASTEN").position.toArray(), "Stielkasten").toEqual([0, 0, 2.0]);
  });

  it("die Netzzahl je Baugruppe stimmt mit dem Konzept überein", () => {
    /*
     * E-025, Abschnitt 07: Ausleger 5 Netze (Lack, Stahl, Schlauch, Logo,
     * Leuchte), Stiel 3 (Lack, Stahl, Schlauch). Ein Detail als eigenes Mesh
     * anzuhängen kostet zwei Zeichenrufe — hier fällt es auf.
     */
    const namen = baggerMeshes().map((m) => m.name);
    const ausleger = namen.filter((n) =>
      /^(07_AUSLEGER|08_LOGO_AUSLEGER|07_SCHLAUCH_AUSLEGER)/.test(n)
    );
    expect(ausleger.sort(), "Netze des Auslegers").toEqual([
      "07_AUSLEGER_KASTEN",
      "07_AUSLEGER_LEUCHTEN",
      "07_AUSLEGER_STAHL",
      "07_SCHLAUCH_AUSLEGER",
      "08_LOGO_AUSLEGER",
    ]);
    const stiel = namen.filter((n) => /^(07_STIEL_|07_SCHLAUCH_STIEL)/.test(n));
    expect(stiel.sort(), "Netze des Stiels").toEqual([
      "07_SCHLAUCH_STIEL",
      "07_STIEL_KASTEN",
      "07_STIEL_STAHL",
    ]);
  });

  it("die Reichweite hängt nicht an der Hülle", () => {
    /*
     * Der ganze Platz ist um die gemessene Reichweite gebaut (Schwenkband
     * innen 5,80 m, außen 9,20 m). Dieses Paket ändert nur die Hülle. Zur
     * Sicherheit: Die tragenden Längen stehen weiterhin an den Gelenken, nicht
     * an den Netzen.
     */
    const stiel = finde("07_STIEL");
    expect(stiel.position.z, "Stielgelenk am Auslegerkopf").toBeCloseTo(5.2, 6);
    expect(finde("07_STIELSPITZE").position.z, "Stielspitze").toBeCloseTo(4.0, 6);
  });
});
