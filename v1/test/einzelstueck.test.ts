/**
 * DIE EINZELSTÜCK-FUHRE (E-126): ein Laster, ein großes Teil.
 *
 * Patrick, 06.10.2026: „Die Schrottsorten sollen mehr grossteile beinhalten,
 * container, gerüste, kleine bagger." E-123 hat sie in den Katalog gebracht;
 * gemessen kamen die schweren 0,04 bis 0,08 Mal je 100 Fuhren an — einmal in
 * 100 bis 250 Spieltagen. Dieser Wächter hält vier Dinge fest:
 *
 *   1. EINE Höhenregel: Schüttgut endet bei Bordwand + 0,35 m, ein Stück
 *      allein darf bis 4,00 m Gesamthöhe (StVZO § 32). Beides liest dieselbe
 *      Stelle, und es gibt keine zweite Abschrift.
 *   2. Die Liste der Einzelstücke enthält die schweren E-123-Teile, und jedes
 *      davon passt allein — aber NICHT als Schüttgut auf die flache Pritsche
 *      (Gegenprobe: sonst bräuchte es die erhöhte Grenze gar nicht).
 *   3. Der Anteil erfüllt das Ziel „jedes Teil einmal je Sandkastenstunde".
 *   4. Gefahren: Jedes Teil kommt am Abladeplatz an, liegt noch auf der
 *      Fläche, liegt still und steht nicht schief — die Spinne findet es da.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  EINZELSTUECKE,
  EINZELSTUECK_ANTEIL,
  EINZELSTUECK_BAU,
  EINZELSTUECK_FLAECHE,
  MINDEST_FUHRE_KG,
  FAMILIES,
  rollAnlieferung,
  rollEinzelstueck,
  type CustomerProfile,
} from "../src/delivery/customers";
import {
  GESAMTHOEHE_MAX,
  LADEBODEN_UEBER_STRASSE,
  LADUNG_UEBERSTAND,
  WAND_HOEHE,
  ladeHoeheGrenze,
} from "../src/delivery/fuellgrad";
import { packeLadung, stueckMass } from "../src/delivery/ladung";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BED_HALF_W } from "../src/delivery/routes";
import type { PileSpec } from "../src/world/objektkatalog";

const quelle = (datei: string): string =>
  readFileSync(resolve(__dirname, "..", "src", "delivery", datei), "utf8");

/** Fester Zufall — eine Messung ohne Saat ist keine. */
function mitSaat<T>(saat: number, f: () => T): T {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  try {
    return f();
  } finally {
    Math.random = echt;
  }
}

/** Die schweren E-123-Teile — die, um die es Patrick ging. */
const E123_SCHWER = [
  "Werkzeugcontainer (Baustelle)",
  "Absetzmulde 5 m³ (Klappdeckel)",
  "Schuttcontainer (Absetzmulde)",
  "Gerüstrahmen (Paket, verzinkt)",
  "Minibagger-Raupenunterwagen",
  "Minibagger 1,5 t (ohne Arm/Dach)",
  "Minibagger (ausgeschlachtet)",
];

describe("Einzelstück: eine Höhenregel", () => {
  it("Schüttgut endet bei Bordwand + Überstand, ein Stück allein bei 4,00 m Gesamthöhe", () => {
    expect(ladeHoeheGrenze(0.64)).toBeCloseTo(0.64 + LADUNG_UEBERSTAND, 9);
    expect(ladeHoeheGrenze(0.64, true)).toBeCloseTo(GESAMTHOEHE_MAX - LADEBODEN_UEBER_STRASSE, 9);
    expect(ladeHoeheGrenze(0.64, true)).toBeCloseTo(2.85, 9);
    expect(EINZELSTUECK_FLAECHE.maxHoehe).toBe(ladeHoeheGrenze(WAND_HOEHE.flach, true));
  });

  it("die Flächenhöhe 1,15 m ist die aus vehicleModel und vehicles", () => {
    expect(quelle("vehicleModel.ts")).toContain("bedGroup.position.set(0, 1.05, -v.bedLen / 2)");
    expect(quelle("vehicles.ts")).toContain("const LADE_BODEN = 0.1;");
    expect(LADEBODEN_UEBER_STRASSE).toBeCloseTo(1.05 + 0.1, 9);
  });

  it("keine zweite Abschrift: Laderaum und Kran fragen dieselbe Regel", () => {
    expect(quelle("vehicles.ts")).not.toMatch(/const LADUNG_UEBERSTAND\s*=/);
    expect(quelle("vehicles.ts")).toMatch(/ladeHoeheGrenze\(\s*\n?\s*anhaenger/);
    expect(quelle("vehicleModel.ts")).toContain("ladeHoeheGrenze(wandHoehe(kind, bodyStyle))");
    expect(quelle("vehicleModel.ts")).not.toMatch(/wandHoehe\(kind, bodyStyle\) \+ 0\.35/);
  });
});

describe("Einzelstück: welche Teile", () => {
  it("die schweren E-123-Teile sind alle dabei", () => {
    const namen = EINZELSTUECKE.map((s) => s.name);
    for (const n of E123_SCHWER) expect(namen, n).toContain(n);
  });

  it("jedes erfüllt die drei Bedingungen: Bauart, Mindestmenge, passt allein", () => {
    expect(EINZELSTUECKE.length).toBeGreaterThanOrEqual(E123_SCHWER.length);
    for (const sp of EINZELSTUECKE) {
      expect(EINZELSTUECK_BAU.has(sp.bau ?? ""), sp.name).toBe(true);
      expect(sp.massKg, sp.name).toBeGreaterThanOrEqual(MINDEST_FUHRE_KG);
      const platz = packeLadung(
        [stueckMass(sp.kind, sp.dims)],
        EINZELSTUECK_FLAECHE.halbBreite,
        EINZELSTUECK_FLAECHE.nutzLaenge,
        EINZELSTUECK_FLAECHE.maxHoehe
      )[0];
      expect(platz, `${sp.name} passt nicht allein auf die Pritsche`).not.toBeNull();
    }
  });

  it("GEGENPROBE: Container und Minibagger passen NICHT als Schüttgut auf die flache Pritsche", () => {
    // Sonst wäre die erhöhte Grenze wirkungslos und dieser Wächter prüfte nichts.
    const flach = ladeHoeheGrenze(WAND_HOEHE.flach);
    const zuHoch = EINZELSTUECKE.filter((sp) => stueckMass(sp.kind, sp.dims).hoehe > flach);
    const namen = zuHoch.map((s) => s.name);
    for (const n of [
      "Werkzeugcontainer (Baustelle)",
      "Absetzmulde 5 m³ (Klappdeckel)",
      "Minibagger 1,5 t (ohne Arm/Dach)",
      "Minibagger (ausgeschlachtet)",
    ])
      expect(namen, n).toContain(n);
  });

  it("GEGENPROBE: leichte Teile und die 2,40 m breiten Container bleiben draußen", () => {
    const namen = EINZELSTUECKE.map((s) => s.name);
    expect(namen).not.toContain("Gerüstfeld (ausgerissen)"); // 105 kg
    expect(namen).not.toContain("Seecontainer 20 Fuß"); // Breite, E-106
  });
});

describe("Einzelstück: wie oft", () => {
  it("der Anteil erfüllt das Ziel: jedes Teil im Mittel einmal je Sandkastenstunde", () => {
    /*
     * Die Rechnung aus dem Kommentar an `EINZELSTUECK_ANTEIL`: eine
     * Schüttgut-Fuhre alle 3 Minuten, ein Einzelstück in 1,5 Minuten.
     */
    const minuten = (p: number): number => p * 1.5 + (1 - p) * 3;
    const jeTeilUndStunde = (p: number): number =>
      ((60 / minuten(p)) * p) / EINZELSTUECKE.length;
    expect(jeTeilUndStunde(EINZELSTUECK_ANTEIL)).toBeGreaterThanOrEqual(1);
    // Und nicht großzügiger als nötig: 5 Prozentpunkte weniger reichen nicht.
    expect(jeTeilUndStunde(EINZELSTUECK_ANTEIL - 0.05)).toBeLessThan(1);
  });

  it("gewürfelt kommt der Anteil auch an (4000 Ankünfte)", () => {
    const n = 4000;
    const einzel = mitSaat(20261006, () =>
      Array.from({ length: n }, () => rollAnlieferung()).filter((c) => c.einzelstueck).length
    );
    expect(einzel / n).toBeGreaterThan(EINZELSTUECK_ANTEIL - 0.03);
    expect(einzel / n).toBeLessThan(EINZELSTUECK_ANTEIL + 0.03);
  });

  it("das Profil: Händler, flache Pritsche, die Waage wiegt das Teil", () => {
    const familien = FAMILIES.map((f) => f.firstName);
    for (let i = 0; i < 200; i++) {
      const c = rollEinzelstueck();
      expect(c.group).toBe("haendler");
      expect(familien).toContain(c.name);
      expect(c.vehicle).toBe("pritsche");
      expect(c.aufbau).toBe("flach");
      expect(c.sortedMaterial).toBeNull();
      expect(c.massKg).toBe(c.einzelstueck!.massKg);
      expect(Number.isFinite(c.fuellgrad) && c.fuellgrad > 0 && c.fuellgrad <= 1).toBe(true);
      expect(Number.isFinite(c.dichte) && c.dichte > 0).toBe(true);
    }
  });
});

/* ---------------------------------------------------------------------- */
/* Gefahren: kommt es an, und liegt es da, wo die Spinne es sucht?          */
/* ---------------------------------------------------------------------- */

beforeAll(async () => {
  await initPhysics();
});

interface Befund {
  name: string;
  ankunftS: number;
  ladungen: number;
  hatKran: boolean;
  /** Lage des Teils in Ladeflächen-Koordinaten, 5 s nach der Ankunft. */
  lokal: THREE.Vector3;
  /** Kippung gegen die Fläche (Grad). */
  kippGrad: number;
  tempo: number;
  /** Lag das Teil auf der ganzen Fahrt auf der Fläche? */
  immerDrauf: boolean;
}

function fahre(teil: PileSpec): Befund {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(scene, world, items, new CompositeManager(scene, world, items, new EventBus()));
  const kunde: CustomerProfile = { ...rollEinzelstueck(), einzelstueck: teil, massKg: teil.massKg };
  m.spawnNow(kunde.vehicle, kunde);
  m.acceptDeliveries = false;
  const v = (m as unknown as {
    active: {
      phase: string;
      bedGroup: THREE.Group;
      bedLen: number;
      cargo: { items: Array<{ body: RAPIER.RigidBody }> };
      crane: THREE.Group | null;
    };
  }).active;
  const dt = 1 / 60;
  const lokal = new THREE.Vector3();
  const body = v.cargo.items[0]?.body;
  let immerDrauf = true;
  const drauf = (): boolean => {
    const p = body!.translation();
    lokal.set(p.x, p.y, p.z);
    v.bedGroup.worldToLocal(lokal);
    return Math.abs(lokal.x) < BED_HALF_W && lokal.z > 0 && lokal.z < v.bedLen && lokal.y > 0;
  };
  let t = 0;
  let ankunft = Infinity;
  for (let i = 0; i < 60 * 240; i++) {
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    scene.updateMatrixWorld(true);
    t += dt;
    if (body && !drauf()) immerDrauf = false;
    if (ankunft === Infinity && v.phase === "waitUnload") ankunft = t;
    if (ankunft !== Infinity && t > ankunft + 5) break;
  }
  if (body) drauf();
  const q = body?.rotation() ?? { x: 0, y: 0, z: 0, w: 1 };
  const flaecheQ = new THREE.Quaternion();
  v.bedGroup.getWorldQuaternion(flaecheQ);
  const oben = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  const flaecheOben = new THREE.Vector3(0, 1, 0).applyQuaternion(flaecheQ);
  const lv = body?.linvel() ?? { x: 0, y: 0, z: 0 };
  return {
    name: teil.name ?? "?",
    ankunftS: ankunft,
    ladungen: v.cargo.items.length,
    hatKran: v.crane !== null,
    lokal: lokal.clone(),
    kippGrad: (Math.acos(Math.min(1, Math.abs(oben.dot(flaecheOben)))) * 180) / Math.PI,
    tempo: Math.hypot(lv.x, lv.y, lv.z),
    immerDrauf,
  };
}

describe("Einzelstück: gefahren bis zum Abladeplatz", () => {
  let befunde: Befund[] = [];
  beforeAll(() => {
    befunde = EINZELSTUECKE.map((sp, i) => mitSaat(4711 + i * 7919, () => fahre(sp)));
  }, 240_000);

  it("jeder Wagen kommt an und bringt genau ein Stück, ohne Kran", () => {
    for (const b of befunde) {
      expect(b.ankunftS, `${b.name}: nicht angekommen`).toBeLessThan(150);
      expect(b.ladungen, b.name).toBe(1);
      expect(b.hatKran, `${b.name}: Kran über dem Teil`).toBe(false);
    }
  });

  it("das Teil liegt die ganze Fahrt auf der Fläche, am Ende mittig, still und gerade", () => {
    for (const b of befunde) {
      expect(b.immerDrauf, `${b.name}: unterwegs von der Fläche`).toBe(true);
      expect(Math.abs(b.lokal.x), `${b.name}: nicht mittig quer`).toBeLessThan(0.25);
      expect(b.tempo, `${b.name}: liegt nicht still`).toBeLessThan(0.05);
      expect(b.kippGrad, `${b.name}: steht schief`).toBeLessThan(5);
    }
  });
});
