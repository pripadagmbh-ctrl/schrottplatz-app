/**
 * E-120 — Patrick, 06.10.2026, wörtlich: „Er soll immer noch an der Waage
 * halten. LKW fährt automatisch weg, sobald vollbeladen. Schrott soll auch
 * nicht direkt verschwinden."
 *
 * Drei Punkte, drei Wächter:
 *
 *  1. JEDER Laster hält bei der Ausfahrt auf der Waage — auch der Anlieferer.
 *  2. Der Abholer fährt voll von selbst los, und zwar über DENSELBEN Ausgang
 *     wie ZUR WAAGE (`sendAway`). E-087: Zwei Ausgänge für ein Ereignis, und
 *     einer fuhr an der Abrechnung vorbei. Ein dritter darf nicht entstehen —
 *     der Vergleich unten hat eine Gegenprobe, die rot werden MUSS.
 *  3. Die Ladung verschwindet erst am Ende der Ausfahrt; der Müllcontainer
 *     leert sich im Sandkasten nicht nachts; `consolidate` bündelt nichts, was
 *     auf dem fahrenden Abholer liegt.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import {
  ItemManager,
  type ScrapItem,
  type ScrapShape,
} from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { ContainerManager, CONFIGS } from "../src/world/containers";
import { platzwache } from "../src/world/platzinventar";
import { EventBus } from "../src/core/events";
import { bedLenFor } from "../src/delivery/routes";
import { wandHoehe } from "../src/delivery/vehicleModel";
import { deckelVolumen } from "../src/delivery/ladung";
import {
  FUELL_KLASSEN,
  LKW_HALB_BREITE,
  LADE_RAND,
  LADUNG_UEBERSTAND,
  NUTZLAST,
} from "../src/delivery/fuellgrad";

type Abholer = NonNullable<VehicleManager["pickupTruck"]>;

beforeAll(async () => {
  await initPhysics();
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** Fester Zufall, damit zwei Läufe Bild für Bild dasselbe tun. */
function festerZufall(): void {
  let s = 12345;
  vi.spyOn(Math, "random").mockImplementation(() => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  });
}

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
  scene: THREE.Scene;
  schritte: number;
}

function bauePlatz(vollFaehrtLos: boolean): Platz {
  festerZufall();
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
    boden,
  );
  const items = new ItemManager(scene, world);
  const composites = new CompositeManager(scene, world, items, new EventBus());
  const m = new VehicleManager(scene, world, items, composites);
  // Wie im Sandkasten (main.ts, Block „Simulator: abhängen")
  m.vollFaehrtLos = vollFaehrtLos;
  m.acceptDeliveries = false;
  return { m, items, world, scene, schritte: 0 };
}

const DT = 1 / 60;

/** Ein Takt; `nachFuhrpark` sieht den Zustand direkt nach `m.update`. */
function takt(p: Platz, nachFuhrpark?: () => void): void {
  p.m.update(DT);
  nachFuhrpark?.();
  p.items.clampSpeeds(DT);
  p.world.step();
  p.scene.updateMatrixWorld(true);
  p.schritte++;
}

function holeAbholer(p: Platz): Abholer {
  p.m.requestPickup(null);
  for (let i = 0; i < 60 * 400 && !p.m.pickupTruck?.waitingForLoad; i++)
    takt(p);
  const t = p.m.pickupTruck;
  expect(
    t?.waitingForLoad,
    "der Abholer ist nie an seinem Platz angekommen",
  ).toBe(true);
  return t!;
}

function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

/** Teile in die Mulde fallen lassen — über die Physik, nicht per Zuweisung. */
function ladeAuf(
  p: Platz,
  t: Abholer,
  stuecke: Array<{
    kg: number;
    shape: ScrapShape;
    x?: number;
    y?: number;
    z: number;
  }>,
): ScrapItem[] {
  const innen = t as unknown as { bedGroup: THREE.Group };
  const drauf: ScrapItem[] = [];
  for (const s of stuecke) {
    const wo = innen.bedGroup.localToWorld(
      new THREE.Vector3(s.x ?? 0, s.y ?? 1.2, s.z),
    );
    drauf.push(
      p.items.spawnScrap("steel", s.kg, s.shape, wo, new THREE.Quaternion()),
    );
    for (let i = 0; i < 45; i++) takt(p);
  }
  for (let i = 0; i < 120; i++) takt(p);
  return drauf;
}

/** Sechs Stück Stahl à 1 500 kg = 9 000 kg — über `NUTZLAST.pritsche`. */
function schwereLadung(p: Platz, t: Abholer): ScrapItem[] {
  const len = bedLenFor("abholer");
  return ladeAuf(
    p,
    t,
    [0, 1, 2, 3, 4, 5].map((i) => ({
      kg: 1500,
      shape: kiste(),
      z: len * (0.25 + 0.1 * i),
    })),
  );
}

/** Was ein Ausgang vom Hof hinterlässt — alles, woran E-087 hing. */
interface Abfahrt {
  phase: string;
  abfahrtGemeldet: boolean;
  folge: string;
  route: Array<[number, number]> | null;
  weg: Array<[number, number]>;
  mitfahrend: number[];
}

function abfahrt(t: Abholer, drauf: ScrapItem[]): Abfahrt {
  const i = t as unknown as {
    abfahrtGemeldet: boolean;
    ausfaedelFolge: string;
    ausfaedelRoute: Array<[number, number]> | null;
    ausfaedelWeg: Array<[number, number]>;
    riding: Array<{ body: RAPIER.RigidBody }>;
  };
  const h = new Set(i.riding.map((r) => r.body.handle));
  return {
    phase: t.phaseName,
    abfahrtGemeldet: i.abfahrtGemeldet,
    folge: i.ausfaedelFolge,
    route: i.ausfaedelRoute
      ? i.ausfaedelRoute.map((q) => [q[0], q[1]] as [number, number])
      : null,
    weg: i.ausfaedelWeg.map((q) => [q[0], q[1]] as [number, number]),
    mitfahrend: drauf
      .map((it, k) => (h.has(it.body.handle) ? k : -1))
      .filter((k) => k >= 0),
  };
}

/** Phase des Wagens auf dem Platz, ob Abholer oder Anlieferer. */
function aktivePhase(p: Platz): string | null {
  return (
    (p.m as unknown as { active: { phaseName: string } | null }).active
      ?.phaseName ?? null
  );
}

/** Bis der Wagen vom Hof ist; zählt die Sekunden Halt auf der AUSFAHRTSwaage. */
function fahreVomHof(
  p: Platz,
  jedenTakt?: () => void,
): { haltS: number; vomHof: boolean } {
  let haltS = 0;
  for (let i = 0; i < 60 * 200 && p.m.activeKind !== null; i++) {
    if (aktivePhase(p) === "out" && p.m.wiegeKontrolle() !== null) haltS += DT;
    jedenTakt?.();
    takt(p);
  }
  return { haltS, vomHof: p.m.activeKind === null };
}

/** Unterschiede zweier Abfahrten — leer heißt: derselbe Ausgang. */
function unterschiede(a: Abfahrt, b: Abfahrt): string[] {
  const out: string[] = [];
  if (a.phase !== b.phase) out.push(`Phase ${a.phase} / ${b.phase}`);
  if (a.abfahrtGemeldet !== b.abfahrtGemeldet) out.push("abfahrtGemeldet");
  if (a.folge !== b.folge) out.push(`Folge ${a.folge} / ${b.folge}`);
  if (JSON.stringify(a.route) !== JSON.stringify(b.route))
    out.push("Ausfahrtsroute");
  if (JSON.stringify(a.weg) !== JSON.stringify(b.weg))
    out.push("Einfädelweg/Startpunkt");
  if (JSON.stringify(a.mitfahrend) !== JSON.stringify(b.mitfahrend))
    out.push("mitfahrende Teile");
  return out;
}

/**
 * Ein voller Abholer, der von selbst losfährt. Liefert den Schritt der
 * Abfahrt und was der Ausgang hinterlassen hat — gesehen DIREKT nach dem
 * Fuhrpark, also im selben Physikstand wie ein Knopfdruck davor.
 */
function laufAuto(patch?: (t: Abholer) => void): {
  p: Platz;
  t: Abholer;
  drauf: ScrapItem[];
  n: number;
  a: Abfahrt;
} {
  const p = bauePlatz(true);
  const t = holeAbholer(p);
  patch?.(t);
  const drauf = schwereLadung(p, t);
  let a: Abfahrt | null = null;
  let n = -1;
  for (let i = 0; i < 60 * 30 && a === null; i++) {
    const vorher = p.schritte;
    takt(p, () => {
      if (t.phaseName !== "waitLoad") {
        a = abfahrt(t, drauf);
        n = vorher;
      }
    });
  }
  expect(a, "der volle Abholer ist nie von selbst losgefahren").not.toBeNull();
  return { p, t, drauf, n, a: a! };
}

describe("Punkt 1 — jeder hält bei der Ausfahrt auf der Waage", () => {
  it("auch der Anlieferer, so lange wie der Abholer", () => {
    const p = bauePlatz(true);
    p.m.spawnNow("pritsche");
    // Abladen lässt hier niemand — sobald er steht, wird er weggeschickt
    for (let i = 0; i < 60 * 300 && aktivePhase(p) !== "waitUnload"; i++)
      takt(p);
    expect(aktivePhase(p), "die Pritsche kam nie am Abladeplatz an").toBe(
      "waitUnload",
    );
    expect(p.m.zurWaage()).toBe("geschickt");
    const { haltS, vomHof } = fahreVomHof(p);
    expect(vomHof).toBe(true);
    const warAufWaage = haltS > 0;
    expect(
      warAufWaage,
      "der Anlieferer ist ohne Halt über die Ausfahrtswaage gefahren",
    ).toBe(true);
    // WIEGE_HALT_S = 6 (vehicles.ts); ein Bild Toleranz
    expect(haltS).toBeGreaterThan(6 - 2 * DT);
    expect(haltS).toBeLessThan(6 + 2 * DT);
  }, 120_000);
});

describe("Punkt 2 — voll fährt der Abholer von selbst, über den Ausgang von ZUR WAAGE", () => {
  it("der Laderaum ist die Formel aus fuellgrad.ts, mit Länge und Wand des Abholers", () => {
    const p = bauePlatz(true);
    const t = holeAbholer(p);
    const len = bedLenFor("abholer");
    const raum =
      LKW_HALB_BREITE *
      2 *
      (len - 2 * LADE_RAND) *
      (wandHoehe("abholer") + LADUNG_UEBERSTAND);
    // Drei große, leichte Kisten: zwei unten, eine oben
    const gross: ScrapShape = {
      kind: "box",
      dims: [2.2, 1.2, 2.4],
      color: 0x8899aa,
    };
    const je = deckelVolumen("box", gross.dims);
    const zwei = ladeAuf(p, t, [
      { kg: 150, shape: gross, z: 1.35 },
      { kg: 150, shape: { ...gross, dims: [...gross.dims] }, z: len - 1.35 },
    ]);
    expect(zwei.every((it) => p.items.items.includes(it))).toBe(true);
    expect(t.ladeflaecheFuellgrad()).toBeCloseTo((2 * je) / raum, 6);
    expect(
      (2 * je) / raum,
      "zwei Kisten wären schon voll — so prüft das nichts",
    ).toBeLessThan(FUELL_KLASSEN.randvoll.von);
    expect(t.abholerVoll()).toBe(false);
    for (let i = 0; i < 60 * 6; i++) takt(p);
    expect(t.phaseName, "halb voll ist er losgefahren").toBe("waitLoad");

    ladeAuf(p, t, [
      {
        kg: 150,
        shape: { ...gross, dims: [...gross.dims] },
        y: 2.6,
        z: len / 2,
      },
    ]);
    // Leicht, aber voll: der Füllgrad entscheidet, nicht das Gewicht
    expect(t.ladeflaecheKg()).toBeLessThan(NUTZLAST.pritsche);
    expect(t.ladeflaecheFuellgrad()).toBeGreaterThanOrEqual(
      FUELL_KLASSEN.randvoll.von,
    );
    for (let i = 0; i < 60 * 5 && t.phaseName === "waitLoad"; i++) takt(p);
    expect(
      t.phaseName,
      "voll (nach Füllgrad) ist er nicht losgefahren",
    ).not.toBe("waitLoad");
  }, 120_000);

  it("automatisch und ZUR WAAGE hinterlassen denselben Zustand — und dieselbe Waage", () => {
    const auto = laufAuto();
    expect(auto.t.ladeflaecheKg()).toBeGreaterThanOrEqual(NUTZLAST.pritsche);

    // Derselbe Platz, ohne Automatik: ZUR WAAGE genau im Schritt der Abfahrt
    const p = bauePlatz(false);
    const t = holeAbholer(p);
    const drauf = schwereLadung(p, t);
    while (p.schritte < auto.n) takt(p);
    expect(t.phaseName, "ohne Automatik ist er trotzdem losgefahren").toBe(
      "waitLoad",
    );
    expect(p.m.zurWaage()).toBe("geschickt");
    const hand = abfahrt(t, drauf);

    expect(unterschiede(auto.a, hand)).toEqual([]);
    expect(
      auto.a.abfahrtGemeldet,
      "die Abfahrt ging an abholerFaehrtRaus vorbei",
    ).toBe(true);
    expect(auto.a.mitfahrend.length, "die Ladung fährt nicht mit").toBe(6);

    const fa = fahreVomHof(auto.p);
    const fh = fahreVomHof(p);
    expect(
      fa.vomHof && fh.vomHof,
      "einer der beiden ist nie vom Hof gekommen",
    ).toBe(true);
    expect(fa.haltS, "automatisch: kein Halt an der Waage").toBeGreaterThan(
      6 - 2 * DT,
    );
    expect(Math.abs(fa.haltS - fh.haltS)).toBeLessThan(2 * DT);
  }, 180_000);

  it('GEGENPROBE: ein bloßes phase = "out" statt sendAway MUSS auffallen', () => {
    const echt = laufAuto();
    const kaputt = laufAuto((t) => {
      (t as unknown as { sendAway: () => boolean }).sendAway = function (this: {
        phase: string;
      }) {
        this.phase = "out";
        return true;
      };
    });
    const u = unterschiede(echt.a, kaputt.a);
    expect(u).toContain("abfahrtGemeldet");
    expect(u).toContain("mitfahrende Teile");
  }, 180_000);

  it("nie mit einem Teil in der Spinne über der Fläche — und nie halb voll", () => {
    const p = bauePlatz(true);
    let gehalten: RAPIER.RigidBody[] = [];
    p.m.gegriffen = () => gehalten;
    const t = holeAbholer(p);
    const len = bedLenFor("abholer");
    ladeAuf(p, t, [{ kg: 2000, shape: kiste(), z: len * 0.3 }]);
    for (let i = 0; i < 60 * 8; i++) takt(p);
    expect(t.phaseName, "mit 2 t ist er losgefahren").toBe("waitLoad");

    const drauf = schwereLadung(p, t);
    // Die Spinne „hält" ein Teil, das über der Fläche liegt
    gehalten = [drauf[0].body];
    for (let i = 0; i < 60 * 8; i++) takt(p);
    expect(
      t.phaseName,
      "er fuhr los, während die Spinne ein Teil über ihm hielt",
    ).toBe("waitLoad");
    gehalten = [];
    let s = 0;
    for (; s < 60 * 8 && t.phaseName === "waitLoad"; s++) takt(p);
    expect(t.phaseName).not.toBe("waitLoad");
    // 3 s Wartezeit (VOLL_WARTE_S), geprueft im Takt VOLL_PRUEF_S = 0,25 s
    expect(s / 60).toBeGreaterThan(3 - 0.25 - 2 * DT);
    expect(s / 60).toBeLessThan(3 + 0.25 + 2 * DT);
  }, 180_000);
});

describe("Punkt 3 — nichts verschwindet direkt", () => {
  it("die Ladung fährt sichtbar mit und geht erst am Ende der Ausfahrt", () => {
    const { p, drauf } = laufAuto();
    let unterwegsWeg = 0;
    let gebuendelt = 0;
    const r = fahreVomHof(p, () => {
      if (p.m.activeKind === null) return;
      unterwegsWeg += drauf.filter((it) => !p.items.items.includes(it)).length;
      // Auch bei Teileflut: was auf dem fahrenden Abholer liegt, bündelt niemand
      gebuendelt += p.items.consolidate(0, 1e9);
    });
    expect(r.vomHof).toBe(true);
    expect(unterwegsWeg, "Teile verschwanden schon während der Fahrt").toBe(0);
    expect(gebuendelt, "consolidate hat mitfahrende Teile gebündelt").toBe(0);
    for (const it of drauf) {
      expect(
        p.items.items.includes(it),
        "Leiche: Teil liegt nach der Abfahrt noch im Spiel",
      ).toBe(false);
      expect(it.body.isValid(), "Leiche: Körper steht noch in der Welt").toBe(
        false,
      );
    }
  }, 180_000);

  it("GEGENPROBE: dieselben Teile, frei liegend, bündelt consolidate sehr wohl", () => {
    const p = bauePlatz(true);
    for (let i = 0; i < 6; i++) {
      p.items.spawnScrap(
        "steel",
        1500,
        kiste(),
        new THREE.Vector3(i * 2, 0.5, 0),
        new THREE.Quaternion(),
      );
    }
    expect(p.items.consolidate(0, 1e9)).toBeGreaterThan(0);
  });

  it("der Müllcontainer leert sich nachts nicht, wenn die Nachtschicht aus ist", () => {
    // Die Schilder zeichnen auf ein Canvas — kopflos eine Attrappe, wie in
    // containerrueckgabe.test.ts. Gemessen werden nur Koordinaten.
    if (
      typeof (globalThis as { document?: unknown }).document === "undefined"
    ) {
      const ctx = new Proxy(
        {},
        {
          get: (_t, k) =>
            k === "measureText" ? () => ({ width: 10 }) : () => undefined,
          set: () => true,
        },
      );
      const canvas = {
        width: 256,
        height: 128,
        getContext: () => ctx,
        style: {},
      };
      (globalThis as { document?: unknown }).document = {
        createElement: () => canvas,
      };
    }
    const muell = CONFIGS.find((c) => c.id === "r_rubble")!;
    for (const aktiv of [false, true]) {
      const p = bauePlatz(true);
      const c = new ContainerManager(p.scene, p.world, new EventBus());
      c.nachtschichtAktiv = aktiv;
      const stueck = p.items.spawnScrap(
        "rubble",
        40,
        { kind: "box", dims: [0.4, 0.3, 0.4], color: 0x6b6357 },
        new THREE.Vector3(muell.x, 0.6, muell.z),
        new THREE.Quaternion(),
      );
      for (let i = 0; i < 30; i++) takt(p);
      c.recount(p.items, new Set());
      const vorher = stueck.body.translation();
      platzwache.neuerTag();
      c.recount(p.items, new Set());
      const nachher = stueck.body.translation();
      const gewandert =
        Math.hypot(nachher.x - vorher.x, nachher.z - vorher.z) > 1;
      expect(
        gewandert,
        aktiv
          ? "Gegenprobe: die Nachtschicht räumt nicht"
          : "aus, und doch geräumt",
      ).toBe(aktiv);
    }
  });
});
