/**
 * Ein Presspaket sieht aus wie das, was hineingegangen ist — und kostet
 * trotzdem einen Zeichenruf.
 *
 * Befund Patrick (`docs/offene-punkte.md`, Gerätetest): „Ballen sehen zu
 * sauber aus — Fransen, Reste der Ursprungsform, unterschiedliche Farben."
 *
 * Fransen und Farben sind am 12.09.2026 gebaut worden, die **Ursprungsform**
 * nicht: Ein Paket war ein gebeulter Quader mit Zipfeln daran, und man sah ihm
 * nicht an, ob Bleche, Rohre oder Felgen darin steckten. Seit E-071 zeigt
 * jede Fraktion mit mindestens einem Sechstel der Masse ein Stück von sich.
 *
 * Geprüft werden vier Dinge, und jede Zahlenschranke bekommt eine Gegenprobe
 * — derselbe Prüfcode auf einen absichtlich kaputten Eingang, der melden MUSS:
 *
 *  1. Ein Paket ist EIN verschmolzenes Netz (E-025). Netze sind der Engpass,
 *     nicht Dreiecke: gemessen 1322 Zeichenrufe und 21,0 ms je Bild, und der
 *     Schattenwurf verdoppelt die Zeichenrufe.
 *  2. Ein sortenreines Paket trägt die Farbe seiner Fraktion — ein
 *     Kupferballen ist kupfern.
 *  3. Ein gemischtes Paket ist NICHT einfarbig, und seine Farben sind genau
 *     die seiner Zusammensetzung. Keine Zufallsfarbe: Die Zusammensetzung ist
 *     die ehrlichere Quelle.
 *  4. Welche Reste erscheinen, folgt der Masse, nicht dem Würfel.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ItemManager, resteFuerPaket, REST_SCHWELLE } from "../src/world/scrapItems";
import { getMaterial } from "../src/materials/catalog";

/**
 * Eckpunkt-Deckel je Paket.
 *
 * Gemessen am 15.09.2026 über je 40 Würfe: der teuerste Fall ist ein
 * Kabelpaket (14 bis 22 Fransen, kein Rest) mit höchstens 650 Ecken; der
 * Schnitt über alle Fraktionen liegt bei 409. Der Deckel liegt mit 750 rund
 * 15 % darüber — genug Luft für die Streuung, eng genug, dass eine neue Form
 * ohne Messung auffällt.
 */
const ECKEN_DECKEL = 750;

/** Netze, Ecken und die Farben eines fertigen Pakets auszählen. */
function zaehle(mesh: THREE.Object3D): {
  netze: number;
  ecken: number;
  farben: Set<string>;
} {
  let netze = 0;
  let ecken = 0;
  const farben = new Set<string>();
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    netze++;
    const g = m.geometry as THREE.BufferGeometry;
    ecken += g.getAttribute("position").count;
    const c = g.getAttribute("color");
    if (!c) return;
    for (let i = 0; i < c.count; i++)
      farben.add(`${c.getX(i).toFixed(3)},${c.getY(i).toFixed(3)},${c.getZ(i).toFixed(3)}`);
  });
  return { netze, ecken, farben };
}

/** Eine Fraktionsfarbe in derselben Schreibweise wie `zaehle`. */
function tonVon(materialId: string): string {
  const c = new THREE.Color().set(getMaterial(materialId).color);
  return `${c.r.toFixed(3)},${c.g.toFixed(3)},${c.b.toFixed(3)}`;
}

/**
 * Prüfung: Stecken im Netz nur Farben aus dieser Zusammensetzung — und bei
 * mehr als einer Fraktion auch mehr als eine?
 *
 * @returns Klartext des Befunds, leerer String = in Ordnung
 */
function farbBefund(farben: Set<string>, fraktionen: string[]): string {
  if (farben.size === 0) return "das Netz trägt gar keine Farben";
  const erlaubt = new Set(fraktionen.map(tonVon));
  const fremd = [...farben].filter((f) => !erlaubt.has(f));
  if (fremd.length > 0) return `${fremd.length} Farbe(n) stehen in keiner Fraktion des Pakets`;
  if (fraktionen.length > 1 && farben.size < 2) return "gemischtes Paket ist einfarbig";
  return "";
}

let items: ItemManager;
let scene: THREE.Scene;

async function werkbank(): Promise<ItemManager> {
  if (items) return items;
  await RAPIER.init();
  scene = new THREE.Scene();
  items = new ItemManager(scene, new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
  return items;
}

describe("Presspaket: ein Netz, die richtigen Farben, Reste der Ursprungsform", () => {
  it("jedes Paket ist EIN verschmolzenes Netz und bleibt unter dem Eckendeckel", async () => {
    const m = await werkbank();
    const faelle: Array<[string, number]> = [
      ["steel", 900],
      ["copper", 400],
      ["alu", 600],
      ["cable", 300],
      ["va", 700],
    ];
    let hoechst = 0;
    for (const [id, kg] of faelle) {
      for (let i = 0; i < 40; i++) {
        const ballen = m.spawnBale(id, kg, new THREE.Vector3(0, 2, 0));
        const { netze, ecken } = zaehle(ballen.mesh);
        expect(netze, `${id}: ein Paket muss EIN Netz sein (E-025)`).toBe(1);
        hoechst = Math.max(hoechst, ecken);
        m.remove(ballen, true);
      }
    }
    console.log(`höchste Eckenzahl über 200 Pakete: ${hoechst} (Deckel ${ECKEN_DECKEL})`);
    expect(hoechst, "ein Paket ist zu aufwendig geworden").toBeLessThanOrEqual(ECKEN_DECKEL);
  });

  it("GEGENPROBE: der Zähler meldet ein Paket aus zwei Netzen und ein zu teures", () => {
    const zwei = new THREE.Group();
    for (let i = 0; i < 2; i++) zwei.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    expect(zaehle(zwei).netze, "der Zähler hätte zwei Netze durchgelassen").toBe(2);
    // 40 × 40 Segmente = 3362 Ecken, weit über dem Deckel
    const teuer = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 40));
    expect(
      zaehle(teuer).ecken,
      "der Deckel hätte ein viel zu feines Netz durchgelassen"
    ).toBeGreaterThan(ECKEN_DECKEL);
  });

  it("ein Kupferballen ist kupfern, ein Alupaket alufarben", async () => {
    const m = await werkbank();
    for (const id of ["copper", "alu", "brass", "va", "steel"]) {
      const ballen = m.spawnBale(id, 500, new THREE.Vector3(0, 2, 0));
      const { farben } = zaehle(ballen.mesh);
      expect(farbBefund(farben, [id]), `${id}: falscher Grundton`).toBe("");
      expect(farben.size, `${id}: ein sortenreines Paket hat genau einen Ton`).toBe(1);
      expect([...farben][0], `${id}: nicht die Fraktionsfarbe aus dem Katalog`).toBe(tonVon(id));
      m.remove(ballen, true);
    }
  });

  it("ein gemischt gepresster Ballen trägt seine Zusammensetzung, nicht eine Zufallsfarbe", async () => {
    const m = await werkbank();
    const zusammensetzung = [
      { materialId: "steel", massKg: 700 },
      { materialId: "copper", massKg: 300 },
      { materialId: "plastic", massKg: 200 },
    ];
    const ballen = m.spawnBale("mixed", 1200, new THREE.Vector3(0, 2, 0), zusammensetzung);
    const { farben } = zaehle(ballen.mesh);
    expect(
      farbBefund(
        farben,
        zusammensetzung.map((c) => c.materialId)
      ),
      "das Mischpaket zeigt Farben, die nicht drin waren"
    ).toBe("");
    expect(farben.size, "ein Mischpaket darf nicht einfarbig sein").toBeGreaterThan(1);
    m.remove(ballen, true);
  });

  it("GEGENPROBE: der Farbprüfer meldet Einfarbigkeit und fremde Farben", () => {
    const fraktionen = ["steel", "copper", "plastic"];
    expect(
      farbBefund(new Set([tonVon("steel")]), fraktionen),
      "der Prüfer hätte ein einfarbiges Mischpaket durchgelassen"
    ).toBe("gemischtes Paket ist einfarbig");
    expect(
      farbBefund(new Set([tonVon("steel"), tonVon("brass")]), fraktionen),
      "der Prüfer hätte eine Zufallsfarbe durchgelassen"
    ).toContain("keiner Fraktion");
    expect(farbBefund(new Set(), fraktionen), "der Prüfer hätte ein farbloses Netz durchgelassen").toBe(
      "das Netz trägt gar keine Farben"
    );
  });

  it("welche Reste erscheinen, folgt der Masse", () => {
    // sortenrein: die eigene Fraktion zeigt sich
    expect(resteFuerPaket([{ materialId: "copper", massKg: 400 }])).toEqual(["copper"]);
    // Kabelknäuel und Reifenballen haben keine Form mehr, die man benennen kann
    expect(resteFuerPaket([{ materialId: "cable", massKg: 400 }])).toEqual([]);
    expect(resteFuerPaket([{ materialId: "tires", massKg: 400 }])).toEqual([]);
    // gemischt: die beiden stärksten, stärkste zuerst
    expect(
      resteFuerPaket([
        { materialId: "copper", massKg: 300 },
        { materialId: "steel", massKg: 700 },
        { materialId: "plastic", massKg: 200 },
      ])
    ).toEqual(["steel", "copper"]);
    // eine Beimischung von 5 % zeigt sich nicht
    expect(
      resteFuerPaket([
        { materialId: "steel", massKg: 950 },
        { materialId: "copper", massKg: 50 },
      ])
    ).toEqual(["steel"]);
    // leeres Paket bringt nichts zum Absturz
    expect(resteFuerPaket([])).toEqual([]);
    expect(resteFuerPaket([{ materialId: "steel", massKg: 0 }])).toEqual([]);
  });

  it("GEGENPROBE: die Schwelle greift genau am Sechstel", () => {
    // knapp darüber: das Kupfer zeigt sich
    const drueber = resteFuerPaket([
      { materialId: "steel", massKg: 830 },
      { materialId: "copper", massKg: 170 },
    ]);
    expect(170 / 1000, "der Fall liegt nicht über der Schwelle").toBeGreaterThan(REST_SCHWELLE);
    expect(drueber, "knapp über der Schwelle fehlt das Kupfer").toEqual(["steel", "copper"]);
    // knapp darunter: es zeigt sich nicht
    const drunter = resteFuerPaket([
      { materialId: "steel", massKg: 840 },
      { materialId: "copper", massKg: 160 },
    ]);
    expect(160 / 1000, "der Fall liegt nicht unter der Schwelle").toBeLessThan(REST_SCHWELLE);
    expect(drunter, "unter der Schwelle wird ein Rest behauptet, den es nicht gibt").toEqual([
      "steel",
    ]);
    // nie mehr als zwei
    expect(
      resteFuerPaket([
        { materialId: "steel", massKg: 250 },
        { materialId: "copper", massKg: 250 },
        { materialId: "brass", massKg: 250 },
        { materialId: "alu", massKg: 250 },
      ]).length,
      "vier Reste an einem Paket machen ein Mobile daraus"
    ).toBe(2);
  });

  it("der Rest ragt sichtbar aus dem Paket heraus, aber bleibt am Paket", async () => {
    const m = await werkbank();
    let kleinster = Infinity;
    let groesster = 0;
    for (let i = 0; i < 40; i++) {
      const ballen = m.spawnBale("steel", 900, new THREE.Vector3(0, 2, 0));
      const dims = ballen.shape!.dims as [number, number, number];
      const box = new THREE.Box3().setFromObject(ballen.mesh);
      // Überstand als Anteil der längsten Paketkante
      const kante = Math.max(...dims);
      const ueber =
        Math.max(
          box.max.x - dims[0] / 2,
          box.max.y - dims[1] / 2,
          box.max.z - dims[2] / 2,
          -dims[0] / 2 - box.min.x,
          -dims[1] / 2 - box.min.y,
          -dims[2] / 2 - box.min.z
        ) / kante;
      kleinster = Math.min(kleinster, ueber);
      groesster = Math.max(groesster, ueber);
      m.remove(ballen, true);
    }
    console.log(
      `Überstand über den Kollider-Quader: ${(100 * kleinster).toFixed(1)} bis ${(100 * groesster).toFixed(1)} % der längsten Kante`
    );
    expect(kleinster, "das Paket ist wieder ein glatter Quader").toBeGreaterThan(0.02);
    expect(groesster, "am Paket hängt etwas wie ein Mast").toBeLessThan(0.55);
  });
});
