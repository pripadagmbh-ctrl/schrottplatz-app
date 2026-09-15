/**
 * Waechter fuer Achim Kurtenbach, den Abholfahrer.
 *
 * Entscheidung Patrick, 15.09.2026: Der Abholer wird ein wiederkehrender
 * Fahrer mit Namen statt einer Rolle. Verworfen: „mehrere, wechselnd".
 *
 * Geprueft wird DREIERLEI, und der dritte Punkt ist der wichtigste:
 *
 *  1. Die Figur selbst: ein Name statt einer Rolle, je Lage genug Saetze,
 *     alle kurz genug fuer eine Zeile auf dem iPhone mini.
 *  2. Die Ton-Leitplanke (Projektregel 7): Milieu aus Beruf, Familie,
 *     Geschaeft — nie aus Herkunft, nie eine Gruppe als kriminell markiert.
 *  3. DIE VERDRAHTUNG. Ein Fahrer, dessen Sprueche nirgends ankommen, sieht
 *     im Quelltext aus wie fertige Arbeit. Deshalb wird der ganze Weg einer
 *     Abholung wirklich abgefahren und mitgeschrieben, was durchgefunkt wird
 *     — und nicht, ob im Quelltext ein Rueckruf steht.
 *
 * Jede Schranke mit einer Zahl bekommt hier ihre GEGENPROBE: derselbe
 * Pruefcode auf einen absichtlich kaputten Eingang muss melden. Sonst prueft
 * eine Schleife ueber eine leere Liste dreissigmal nichts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager, type ScrapShape } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import {
  ABHOLFAHRER,
  fahrerfunk,
  abholerFunk,
  type Fahrerlage,
  type Abholfahrer,
} from "../src/delivery/customers";
import { CONFIGS } from "../src/world/containers";

beforeAll(async () => {
  await initPhysics();
});

const LAGEN: Fahrerlage[] = [
  "angekommen",
  "wartet",
  "abfahrtVoll",
  "abfahrtLeer",
  "containerZurueck",
];

/**
 * Laenge einer HUD-Zeile.
 *
 * Herkunft: `test/abholplatz.test.ts` haelt seit E-056 dieselbe Schranke fuer
 * den Ankunftsspruch (< 45 Zeichen, gemessen am schmalsten Geraet, dem
 * iPhone mini). Vor dem Spruch steht im HUD noch der Name — der ist mit
 * „Achim" kuerzer als das alte „Abholer", die Zeile wird also nicht laenger.
 */
const ZEILE_MAX = 45;

/* --------------------------------------------------- Die Figur selbst --- */

describe("Der Abholer ist ein Fahrer mit Namen, keine Rolle", () => {
  it("hat einen Vornamen am Funk und einen vollen Namen dahinter", () => {
    expect(ABHOLFAHRER.funkname.length, "kein Funkname").toBeGreaterThan(2);
    // Eine Rolle ist kein Name. Genau das stand bis zum 15.09.2026 hier.
    for (const rolle of ["Abholer", "Fahrer", "LKW", "Spedition"]) {
      expect(ABHOLFAHRER.funkname, `„${rolle}" ist eine Rolle, kein Name`).not.toBe(rolle);
    }
    // Der Funkname ist Teil des vollen Namens — sonst sind es zwei Personen.
    expect(ABHOLFAHRER.name, "Funkname und Name gehoeren nicht zusammen").toContain(
      ABHOLFAHRER.funkname
    );
    expect(ABHOLFAHRER.name.trim().split(/\s+/).length, "kein Nachname").toBeGreaterThan(1);
    // Milieu: Beruf und Geschaeft, nicht „Rolle: Abholer".
    expect(ABHOLFAHRER.subtitle.length, "kein Milieu hinterlegt").toBeGreaterThan(8);
  });

  it("und es ist EINER, nicht eine wechselnde Besetzung", () => {
    /*
     * Patrick hat „mehrere, wechselnd" ausdruecklich verworfen. Wuerde
     * irgendwo gewuerfelt, wer heute faehrt, kaeme hier mal dieser und mal
     * jener Name heraus.
     */
    const namen = new Set<string>();
    for (let i = 0; i < 200; i++) namen.add(ABHOLFAHRER.funkname);
    expect(namen.size, "der Fahrer wechselt").toBe(1);
  });
});

describe("Er hat fuer jede Lage eigene Saetze", () => {
  it("jede Lage ist besetzt, mit Auswahl und ohne Dopplung", () => {
    for (const lage of LAGEN) {
      const liste = ABHOLFAHRER.sprueche[lage];
      expect(liste, `Lage „${lage}" fehlt ganz`).toBeDefined();
      // Zwei ist das Mindeste: Bei einem Satz merkt man ihn nach der zweiten
      // Fuhre auswendig.
      expect(liste.length, `Lage „${lage}" hat nur ${liste.length} Satz`).toBeGreaterThanOrEqual(3);
      expect(new Set(liste).size, `Lage „${lage}" sagt zweimal dasselbe`).toBe(liste.length);
      for (const s of liste) {
        expect(s.trim().length, `leerer Satz in „${lage}"`).toBeGreaterThan(5);
        expect(s.length, `„${s}" ist zu lang fuer eine Zeile`).toBeLessThan(ZEILE_MAX);
      }
    }
  });

  it("und kein Satz taucht in zwei Lagen auf", () => {
    /*
     * Sonst sagt er beim Losfahren dasselbe wie beim Ankommen, und der
     * Spieler kann die Lagen nicht mehr auseinanderhalten.
     */
    const gesehen = new Map<string, Fahrerlage>();
    for (const lage of LAGEN) {
      for (const s of ABHOLFAHRER.sprueche[lage]) {
        const schon = gesehen.get(s);
        expect(schon, `„${s}" steht in „${lage}" und in „${schon}"`).toBeUndefined();
        gesehen.set(s, lage);
      }
    }
  });

  it("GEGENPROBE: ein zu langer oder doppelter Satz wird gemeldet", () => {
    /*
     * Derselbe Pruefcode auf einen absichtlich kaputten Fahrer. Ohne diesen
     * Fall wuerden die beiden Pruefungen oben auch eine leere Liste
     * durchwinken.
     */
    const pruefe = (f: Abholfahrer): string[] => {
      const klagen: string[] = [];
      for (const lage of LAGEN) {
        const liste = f.sprueche[lage] ?? [];
        if (liste.length < 3) klagen.push(`${lage}: zu wenige`);
        if (new Set(liste).size !== liste.length) klagen.push(`${lage}: doppelt`);
        for (const s of liste) if (s.length >= ZEILE_MAX) klagen.push(`${lage}: zu lang`);
      }
      return klagen;
    };
    expect(pruefe(ABHOLFAHRER), "der echte Fahrer hat Maengel").toEqual([]);

    const kaputt: Abholfahrer = {
      ...ABHOLFAHRER,
      sprueche: {
        ...ABHOLFAHRER.sprueche,
        wartet: [
          "Doppelt.",
          "Doppelt.",
          "Ich warte hier, bis du fertig bist, und dann fahre ich auch schon wieder los.",
        ],
        abfahrtLeer: [],
      },
    };
    const klagen = pruefe(kaputt);
    expect(klagen, "die Gegenprobe meldet nichts").toContain("wartet: doppelt");
    expect(klagen).toContain("wartet: zu lang");
    expect(klagen).toContain("abfahrtLeer: zu wenige");
  });
});

/* -------------------------------------------------- Die Ton-Leitplanke --- */

/**
 * Woerter, die in keinem Spruch dieser Figur vorkommen duerfen.
 *
 * Projektregel 7: Das Milieu entsteht aus Beruf, Familie und Geschaeft — nie
 * aus Herkunft; keine Gruppe wird als kriminell markiert. Die Liste ist
 * bewusst grob: Sie faengt den ganzen Themenbereich ab, nicht einzelne
 * Formulierungen. Wer hier einen Fehlalarm bekommt, hat fast immer wirklich
 * am falschen Faden gezogen.
 */
const VERBOTEN = [
  "auslaender",
  "ausländer",
  "zigeuner",
  "russe",
  "pole",
  "tuerke",
  "türke",
  "araber",
  "clan",
  "sippe",
  "mafia",
  "geklaut",
  "gestohlen",
  "hehler",
  "schwarz",
  "illegal",
  "bullen",
  "razzia",
];

/** Was gesprochen wird — Vorlagen mit einem Beispielschild eingesetzt. */
function alleSaetze(f: Abholfahrer): string[] {
  const out: string[] = [];
  for (const lage of LAGEN) out.push(...(f.sprueche[lage] ?? []));
  for (const v of f.amSchild) out.push(v("KUPFER-LAGER"));
  return out;
}

describe("Ton-Leitplanke: Milieu aus Beruf, Familie, Geschaeft", () => {
  const anstoss = (saetze: string[]): string[] =>
    saetze.filter((s) => VERBOTEN.some((w) => s.toLowerCase().includes(w)));

  it("kein Satz von ihm redet ueber Herkunft oder Halbseidenes", () => {
    const saetze = alleSaetze(ABHOLFAHRER);
    // Erst pruefen, dass ueberhaupt etwas geprueft wird.
    expect(saetze.length, "es gibt gar keine Saetze zu pruefen").toBeGreaterThan(15);
    expect(anstoss(saetze), "diese Saetze verletzen die Ton-Leitplanke").toEqual([]);
  });

  it("GEGENPROBE: ein Spruch ueber Herkunft MUSS auffallen", () => {
    const kaputt = [...alleSaetze(ABHOLFAHRER), "Die Russen zahlen mehr, aber geklaut."];
    expect(anstoss(kaputt).length, "die Gegenprobe meldet nichts").toBe(1);
  });

  it("und er bewertet den Spieler nicht", () => {
    /*
     * Er ist Dienstleister und Bekannter, kein Aufseher. Ein Fahrer, der
     * beim Leerabholen schimpft, macht aus einer Leerfahrt einen Vorwurf.
     */
    for (const s of alleSaetze(ABHOLFAHRER)) {
      for (const w of ["faul", "lahm", "endlich", "beeil", "zu langsam"]) {
        expect(s.toLowerCase(), `„${s}" draengelt`).not.toContain(w);
      }
    }
  });
});

/* ---------------------------------------- Der Ort kommt aus dem Schild --- */

describe("Die Kopplung an das Schild bleibt (E-056)", () => {
  it("die Ankunft am Silo nennt die Aufschrift, nicht eine zweite Liste", () => {
    for (const c of CONFIGS.filter((s) => s.lager === true)) {
      for (let i = 0; i < 20; i++) {
        const spruch = fahrerfunk("angekommen", c.label);
        expect(spruch, `„${spruch}" nennt ${c.label} nicht`).toContain(c.label);
        expect(spruch.length, `„${spruch}" ist zu lang`).toBeLessThan(ZEILE_MAX);
      }
    }
    // Und der alte Name fuehrt auf denselben Weg — `abholPlatzFuer` ruft ihn.
    const ueberDenAltenNamen = abholerFunk("ALU-LAGER");
    expect(ueberDenAltenNamen).toContain("ALU-LAGER");
  });

  it("in jeder anderen Lage nennt er kein Schild — da steht er ja schon", () => {
    for (const lage of LAGEN.filter((l) => l !== "angekommen")) {
      for (let i = 0; i < 20; i++) {
        const spruch = fahrerfunk(lage, "KUPFER-LAGER");
        expect(spruch, `„${spruch}" schleppt das Schild mit`).not.toContain("KUPFER-LAGER");
        expect(ABHOLFAHRER.sprueche[lage], `„${spruch}" steht in keiner Liste`).toContain(spruch);
      }
    }
  });
});

/* ------------------------------------------- Verdrahtungs-Waechter ------- */

interface Platz {
  m: VehicleManager;
  items: ItemManager;
  world: RAPIER.World;
}

function bauePlatz(): Platz {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  const m = new VehicleManager(
    scene,
    world,
    items,
    new CompositeManager(scene, world, items, new EventBus())
  );
  return { m, items, world };
}

function takt(p: Platz, dt = 1 / 60): void {
  p.m.update(dt);
  p.items.clampSpeeds(dt);
  p.world.step();
}

function kiste(): ScrapShape {
  return { kind: "box", dims: [0.5, 0.4, 0.6], color: 0x8899aa };
}

/** Mitschrift des Funkverkehrs einer Fuhre. */
function funkmitschrift(p: Platz): Array<{ wer: string; spruch: string }> {
  const log: Array<{ wer: string; spruch: string }> = [];
  p.m.onPickupFunk = (wer, spruch) => log.push({ wer, spruch });
  return log;
}

/** Zu welcher Lage gehoert dieser Satz? Null, wenn zu keiner. */
function lageVon(spruch: string): Fahrerlage | null {
  for (const lage of LAGEN) {
    if (ABHOLFAHRER.sprueche[lage].includes(spruch)) return lage;
  }
  for (const v of ABHOLFAHRER.amSchild) {
    for (const c of CONFIGS.filter((s) => s.lager === true)) {
      if (v(c.label) === spruch) return "angekommen";
    }
  }
  return null;
}

describe("Und seine Sprueche kommen wirklich an", () => {
  it("eine volle Fuhre: ankommen, warten, beladen losfahren", () => {
    const p = bauePlatz();
    const log = funkmitschrift(p);
    p.m.requestPickup("steel");
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    const wagen = p.m.pickupTruck!;
    expect(wagen.waitingForLoad, "der Abholer ist nie angekommen").toBe(true);

    // Angekommen ist gemeldet, und zwar von ihm.
    expect(log.length, "beim Ankommen kam nichts durch").toBeGreaterThan(0);
    expect(log[0].wer, "es funkt jemand anderes").toBe(ABHOLFAHRER.funkname);
    expect(lageVon(log[0].spruch), `„${log[0].spruch}" gehoert zu keiner Lage`).toBe("angekommen");

    // Warten: Nach der Standzeit sagt er einmal etwas — und nur einmal.
    for (let i = 0; i < 60 * 40; i++) takt(p);
    const gewartet = log.filter((z) => lageVon(z.spruch) === "wartet");
    expect(gewartet.length, "beim Warten kam nichts oder zu viel durch").toBe(1);

    // Ladung drauf und losschicken.
    for (const [i, kg] of [180, 240, 130].entries()) {
      p.items.spawnScrap(
        "steel",
        kg,
        kiste(),
        new THREE.Vector3(wagen.group.position.x, 1.6, wagen.group.position.z - 1.2 + i * 1.2),
        new THREE.Quaternion()
      );
    }
    for (let i = 0; i < 60 * 3; i++) takt(p);
    expect(wagen.ladeflaecheKg(), "die Pruefladung liegt nicht auf der Flaeche").toBeGreaterThan(0);

    p.m.requestPickup();
    for (let i = 0; i < 60 * 60 && wagen.phaseName === "waitLoad"; i++) takt(p);
    const lagen = log.map((z) => lageVon(z.spruch));
    expect(lagen, "er verabschiedet sich nicht").toContain("abfahrtVoll");
    expect(lagen, "eine volle Fuhre gilt ihm als leer").not.toContain("abfahrtLeer");
    // Und jede Zeile kommt unter seinem Namen.
    for (const z of log) expect(z.wer).toBe(ABHOLFAHRER.funkname);
  });

  it("GEGENPROBE: leer wieder raus — dann sagt er genau das", () => {
    /*
     * Derselbe Weg, nur ohne Ladung. Kaeme hier „abfahrtVoll" heraus, haette
     * der Fall oben nichts geprueft: Dann saehe er jede Abfahrt als voll an.
     * Seit E-064 sieht der Spieler dazu „0 kg abgeholt" an der Waage — beide
     * Meldungen muessen dasselbe sagen.
     */
    const p = bauePlatz();
    const log = funkmitschrift(p);
    let differenz: number | null = null;
    p.m.onAbholerBrutto = (t, b) => (differenz = b - t);
    p.m.requestPickup("alu");
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    expect(p.m.pickupTruck?.waitingForLoad, "nie angekommen").toBe(true);
    p.m.requestPickup();
    for (let i = 0; i < 60 * 300 && differenz === null; i++) takt(p);

    const lagen = log.map((z) => lageVon(z.spruch));
    expect(lagen, "eine Leerfahrt gilt ihm als volle Fuhre").not.toContain("abfahrtVoll");
    expect(lagen, "er sagt zur Leerfahrt nichts").toContain("abfahrtLeer");
    expect(differenz, "die Waage hat nichts gemeldet").not.toBeNull();
    expect(differenz!, "Waage und Fahrer sagen Verschiedenes").toBeCloseTo(0, 6);
  });

  it("und die Wanne, die er zurueckgibt, meldet er auch (E-034)", () => {
    /*
     * Das Platzinventar faehrt nicht mit: Achim kippt es aus und setzt es
     * wieder ab. Ohne Meldung sucht der Spieler den Muellcontainer dort, wo
     * er ihn hingestellt hatte.
     *
     * Geprueft wird mit einem Doppelgaenger des Platzinventar-Zugangs — der
     * echte haengt an `ContainerManager` und braucht den halben Platz.
     */
    const p = bauePlatz();
    const log = funkmitschrift(p);
    let abgesetzt: [number, number] | null = null;
    p.m.requestPickup("steel");
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    const wagen = p.m.pickupTruck!;
    expect(wagen.waitingForLoad).toBe(true);

    // Eine Wanne, die auf seiner Flaeche steht: gemeldet wird ihre Lage in
    // Weltkoordinaten, genau wie beim echten Zugang.
    const pos = wagen.group.position;
    wagen.platzinventar = {
      stellungen: () => [{ id: "c_muell", x: pos.x, y: 1.6, z: pos.z }],
      leeren: () => ({ kg: 240, stueck: 6, rest: 0 }),
      absetzen: (_id, x, z) => {
        abgesetzt = [x, z];
      },
    };

    p.m.requestPickup();
    for (let i = 0; i < 60 * 60 && wagen.phaseName === "waitLoad"; i++) takt(p);
    expect(abgesetzt, "die Wanne wurde gar nicht abgesetzt").not.toBeNull();
    const lagen = log.map((z) => lageVon(z.spruch));
    expect(lagen, "er gibt die Wanne stumm zurueck").toContain("containerZurueck");
  });

  it("GEGENPROBE: ohne Wanne auf der Flaeche sagt er nichts dazu", () => {
    const p = bauePlatz();
    const log = funkmitschrift(p);
    p.m.requestPickup("steel");
    for (let i = 0; i < 60 * 300 && !p.m.pickupTruck?.waitingForLoad; i++) takt(p);
    const wagen = p.m.pickupTruck!;
    // Eine Wanne, die NEBEN dem Wagen steht — 12 m daneben, nicht darauf.
    wagen.platzinventar = {
      stellungen: () => [
        { id: "c_muell", x: wagen.group.position.x + 12, y: 0, z: wagen.group.position.z },
      ],
      leeren: () => ({ kg: 240, stueck: 6, rest: 0 }),
      absetzen: () => {},
    };
    p.m.requestPickup();
    for (let i = 0; i < 60 * 60 && wagen.phaseName === "waitLoad"; i++) takt(p);
    const lagen = log.map((z) => lageVon(z.spruch));
    expect(lagen, "er gibt eine Wanne zurueck, die er nie hatte").not.toContain(
      "containerZurueck"
    );
  });
});
