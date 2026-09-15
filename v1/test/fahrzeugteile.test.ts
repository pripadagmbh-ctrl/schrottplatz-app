/**
 * KEIN TEIL EINES FAHRZEUGS STECKT IN EINEM ANDEREN (E-076).
 *
 * Anlass, wörtlich (Patrick, 13.09.2026): „Also ich habe mir nochmal den
 * Kipper angeguckt. Die Ladefläche geht … durch. … dass die Ladefläche durch
 * den Kran läuft, wenn es einen Kran gibt."
 *
 * Der Befund stand zwei Tage in `docs/offene-punkte.md`. Er ist nicht deshalb
 * liegengeblieben, weil ihn niemand ernst nahm, sondern weil NICHTS DANACH
 * SUCHTE: Es gab am LKW keinen einzigen Wächter über die Geometrie. Genau das
 * ist diese Datei — und sie prüft nicht „Kran gegen Ladefläche", sondern jedes
 * tragende Teil gegen jedes andere, in jeder Stellung, an jeder Bauart.
 *
 * GEMESSEN WIRD MIT `tools/durchdringung.ts` (Trennachsensatz über die echten
 * Netze), AUFGESTELLT MIT `tools/fahrzeugteile.ts`. Der Wächter bringt seine
 * Messung also nicht selbst mit — er benutzt dieselbe wie das Werkzeug, mit
 * dem die Zahlen im Log entstanden sind.
 *
 * DREI PROBEN GEHÖREN ZUSAMMEN:
 *   Nullprobe   — ein Fahrzeug ohne Kran meldet nichts über einen Kran.
 *   Hauptprobe  — kein Paar steckt tiefer ineinander, als `ERLAUBTE_PAARE`
 *                 mit Begründung zulässt.
 *   Gegenprobe  — ein absichtlich versetzter Kran MUSS gemeldet werden.
 *                 Ohne sie wäre ein Wächter, der nichts findet, kein Beweis.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { describe, it, expect, beforeAll } from "vitest";
import { leinwandAttrappe } from "../tools/leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  alleBauarten,
  auslegerUeberFlaeche,
  erlaubteTiefe,
  inventarLuft,
  ladungOberkante,
  messeBauart,
  verstoesse,
  type Bauart,
} from "../tools/fahrzeugteile";
import { baueMessfahrzeug } from "../tools/fahrzeugbau-attrappe";
import { sammleTeile, messeStellung, BLECH_TOLERANZ } from "../tools/durchdringung";
import { BAUGRUPPE, BAUGRUPPEN } from "../src/delivery/vehicleModel";
import { endlich } from "./zahl";

let welt: RAPIER.World;

beforeAll(async () => {
  leinwandAttrappe();
  await initPhysics();
  welt = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
});

/**
 * Die Bauarten, die das Spiel wirklich baut.
 *
 * `vehicles.ts`: `withCrane = Händler && (kipper || pritsche)`. Alles andere
 * aus `alleBauarten()` ist Vorrat des Werkzeugs — geprüft wird hier, was
 * vorfahren kann.
 */
/**
 * Alle Teile des Krans — Bockplatte, Stützen, Füße und die drehbare Säule.
 *
 * Sie hängen seit E-076 einzeln am Fahrzeug und nicht in einer gemeinsamen
 * Gruppe: Jedes `THREE.Object3D` zieht beim Anlegen vier Zufallszahlen
 * (`MathUtils.generateUUID`), und eine Gruppe mehr verschiebt den Zufallsstrom
 * so weit, dass `test/kipper.test.ts` andere Ladungen würfelt.
 */
function kranTeileVon(group: THREE.Object3D): THREE.Object3D[] {
  return group.children.filter(
    (k) => k.name === BAUGRUPPE.kranbock || k.name === BAUGRUPPE.kransaeule
  );
}

function gebauteBauarten(): Bauart[] {
  return alleBauarten().filter(
    (b) => !b.mitKran || b.kind === "kipper" || b.kind === "pritsche"
  );
}

describe("Am Fahrzeug steckt kein Teil im anderen", () => {
  for (const bauart of gebauteBauarten()) {
    const titel = `${bauart.kind}/${bauart.aufbau}/${bauart.mitKran ? "mit Kran" : "ohne Kran"}`;
    it(`${titel}: keine Durchdringung über der Erlaubnis`, () => {
      const { befunde, teile, lagen } = messeBauart(welt, bauart);
      expect(teile.length, "keine tragenden Teile gefunden — misst der Wächter überhaupt etwas?")
        .toBeGreaterThan(20);
      expect(lagen, "keine Stellung abgetastet").toBeGreaterThan(0);
      for (const b of befunde) endlich(b.tiefe, `Tiefe ${b.paar}`);
      const schlimm = verstoesse(befunde);
      expect(
        schlimm.map(
          (b) =>
            `${b.paar} ${(b.tiefe * 100).toFixed(1)} cm ` +
            `(erlaubt ${(b.erlaubt * 100).toFixed(0)}) bei ${b.stellung} [${b.teile}]`
        ),
        `${titel} hat Teile, die ineinanderstecken`
      ).toEqual([]);
    }, 240000);
  }

  it("NULLPROBE: ohne Kran gibt es kein Kranteil und keinen Kranbefund", () => {
    let geprueft = 0;
    for (const bauart of gebauteBauarten().filter((b) => !b.mitKran)) {
      const { teile, befunde } = messeBauart(welt, bauart);
      const kran = teile.filter((t) => t.gruppe.startsWith("kran"));
      expect(kran.map((t) => t.name), `${bauart.kind} ohne Kran hat Kranteile`).toEqual([]);
      expect(
        befunde.filter((b) => b.gruppen.some((g) => g.startsWith("kran"))),
        `${bauart.kind} ohne Kran meldet einen Kranbefund`
      ).toEqual([]);
      geprueft++;
    }
    expect(geprueft, "die Nullprobe hat gar kein Fahrzeug gesehen").toBeGreaterThan(5);
  }, 240000);

  it("GEGENPROBE: ein um 40 cm versetzter Kran MUSS gemeldet werden", () => {
    /*
     * Die Verschiebung ist nicht gegriffen: 0,40 m zurück bringt den Kranbock
     * genau dorthin, wo er bis zum 15.09.2026 stand — `bedLen/2 + 0,05` statt
     * `bedLen/2 + 0,33` und damit in den Muldenboden. Der Wächter muss den
     * Fehler von gestern wiederfinden, sonst prüft er nichts.
     */
    const fz = baueMessfahrzeug(welt, "kipper", "rungen", true);
    const teile = sammleTeile(fz.group, BAUGRUPPEN);
    const vorher = messeStellung(teile, "Stand", () => true);
    expect(
      vorher.filter((b) => b.gruppeA === BAUGRUPPE.flaeche || b.gruppeB === BAUGRUPPE.flaeche)
        .filter((b) => b.gruppeA.startsWith("kran") || b.gruppeB.startsWith("kran")),
      "vor dem Versetzen steckt der Kran schon in der Fläche"
    ).toEqual([]);

    // Kran versetzen — Bockteile UND Säule, sie gehören zusammen
    for (const teil of kranTeileVon(fz.group)) teil.position.z -= 0.4;
    fz.group.updateWorldMatrix(true, true);
    const nachher = messeStellung(teile, "Kran 40 cm versetzt", () => true).filter(
      (b) =>
        (b.gruppeA.startsWith("kran") || b.gruppeB.startsWith("kran")) &&
        erlaubteTiefe(b.gruppeA, b.gruppeB) === 0
    );
    expect(
      nachher.length,
      "der versetzte Kran wurde NICHT gemeldet — der Wächter findet nichts, weil er nichts sucht"
    ).toBeGreaterThan(0);
    const tiefste = Math.max(...nachher.map((b) => b.tiefe));
    expect(tiefste, "gemeldet, aber als Berührung statt als Durchdringung").toBeGreaterThan(0.05);
  }, 120000);

  it("GEGENPROBE zur Schranke: ein Zentimeter Versatz reicht schon zur Meldung", () => {
    /*
     * Die zweite Hälfte der Gegenprobe: Der Wächter darf weder bei jedem
     * Rundungsfehler schreien noch erst bei groben Fehlern.
     *
     * Der engste Spalt am Kran ist gerechnet und nachgemessen: Die Bockplatte
     * endet auf `bedLen/2 + 0,33 − 0,50/2 = +0,08`, die Aussenfläche der
     * Stirnwand liegt auf `+0,04` — vier Zentimeter Luft. Geprüft wird also,
     * dass 3,8 cm Versatz noch still bleiben und 5 cm schon melden.
     */
    const fz = baueMessfahrzeug(welt, "pritsche", "flach", true);
    const teile = sammleTeile(fz.group, BAUGRUPPEN);
    const kranTeile = kranTeileVon(fz.group);
    // Fünf Bockteile (Platte, zwei Stützen, zwei Füße) und die Säule
    expect(kranTeile.length, "kein Kran am Prüfstand").toBe(6);
    const ruhe = kranTeile.map((k) => k.position.z);
    const zaehle = (versatz: number): number => {
      kranTeile.forEach((k, i) => (k.position.z = ruhe[i]! - versatz));
      fz.group.updateWorldMatrix(true, true);
      return messeStellung(teile, `Versatz ${versatz}`, () => true).filter(
        (b) =>
          (b.gruppeA.startsWith("kran") || b.gruppeB.startsWith("kran")) &&
          erlaubteTiefe(b.gruppeA, b.gruppeB) === 0
      ).length;
    };
    const spalt = 0.04; // Bockplatte +0,08 gegen Stirnwand-Aussenfläche +0,04
    expect(zaehle(spalt - 2 * BLECH_TOLERANZ), "schreit schon vor der Berührung").toBe(0);
    expect(zaehle(spalt + 0.01), "meldet einen Zentimeter Durchdringung nicht").toBeGreaterThan(0);
    expect(zaehle(0.4), "meldet den Kran von gestern nicht").toBeGreaterThan(0);
  }, 120000);

  it("der Ausleger liegt über der Ladung, nicht darin", () => {
    /*
     * Eigene Prüfung, weil die Ladung kein Bauteil ist: Sie entsteht erst,
     * wenn ein Kunde vorfährt. Geprüft wird der Raum, den sie belegen DARF
     * (`vehicles.ts`: 1,05 + LADE_BODEN + Bordwand + LADUNG_UEBERSTAND).
     */
    for (const bauart of gebauteBauarten().filter((b) => b.mitKran)) {
      const { fz, teile } = messeBauart(welt, bauart);
      const unten = auslegerUeberFlaeche(fz, teile);
      const ladung = ladungOberkante(bauart.kind, bauart.aufbau);
      if (unten === null) continue; // gar kein Kranteil über der Fläche: noch besser
      endlich(unten, "tiefster Kranpunkt");
      expect(
        unten - ladung,
        `${bauart.kind}/${bauart.aufbau}: der Kran hängt ${((ladung - unten) * 100).toFixed(0)} cm ` +
          `in die Fuhre (Kran unten ${unten.toFixed(2)} m, Ladung bis ${ladung.toFixed(2)} m)`
      ).toBeGreaterThan(0.1);
    }
  }, 240000);

  it("ein Behälter neben dem Wagen fällt nicht ins Ladeflächenfenster (E-070)", () => {
    /*
     * Der Verdacht aus E-070: `gibPlatzinventarZurueck` zählt alles ab lokal
     * y > −0,20 als „auf der Fläche". Gemessen ist der Verdacht unbegründet —
     * die Fläche sitzt 1,05 m über dem Boden, und ein Absetzcontainer meldet
     * seinen Körperursprung am BODEN (`containers.ts`: `setTranslation(x, 0,
     * z)`, `absetzen` setzt y = 0). Zwischen beiden liegen 0,85 m.
     *
     * Die Schranke von 0,50 m ist nicht die Messung, sondern ihr Rest: Die
     * Federung senkt den Wagen um wenige Zentimeter, und ein Behälter, den
     * jemand halb auf einen Haufen geschoben hat, steht höher als auf dem
     * Hof. Unter einem halben Meter Luft wäre das eine Frage; darüber nicht.
     */
    endlich(inventarLuft(), "Luft unter dem Fenster");
    expect(
      inventarLuft(),
      "das Fenster beginnt so tief, dass ein Behälter auf dem Boden hineinfällt"
    ).toBeGreaterThan(0.5);
  });

  it("die Baugruppen sind vollständig — jedes tragende Teil hat einen Namen", () => {
    /*
     * Ein Wächter, der nur benannte Teile sieht, ist genau so gut wie die
     * Namensvergabe. Diese Probe zählt: Ein LKW muss Rahmen, Fahrerhaus,
     * Fläche, zwei Bordwände, Stirnwand, drei Achsen und die Kotflügel haben.
     * Wer eines davon vergisst, macht den Wächter blind, ohne dass er rot wird.
     */
    const fz = baueMessfahrzeug(welt, "pritsche", "rungen", true);
    const teile = sammleTeile(fz.group, BAUGRUPPEN);
    const zahl = new Map<string, number>();
    for (const t of teile) zahl.set(t.gruppe, (zahl.get(t.gruppe) ?? 0) + 1);
    for (const g of Object.values(BAUGRUPPE)) {
      expect(zahl.get(g) ?? 0, `Baugruppe „${g}" hat kein einziges Netz`).toBeGreaterThan(0);
    }
    expect(zahl.get(BAUGRUPPE.bordwand), "es gibt nicht zwei Bordwände").toBeGreaterThanOrEqual(2);
    // Drei Achsen, vorn einfach, hinten Zwillinge: 6 + 8 + 8 Netze
    expect(zahl.get(BAUGRUPPE.rad), "es fehlen Radteile").toBe(22);
  });
});

describe("Der Kipper kippt erst, wenn der Kran aus dem Weg ist", () => {
  it("die Regel steht im Ablauf und nicht nur im Werkzeug", async () => {
    /*
     * Die Geometrie oben wird in dem Raster gemessen, das `stellungen()`
     * aufspannt — und dort ist „gekippt" immer mit „Kran ganz aussen"
     * gepaart. Diese Paarung ist eine ANNAHME über den Ablauf. Hier wird sie
     * geprüft: Am ersten Bild, in dem sich die Mulde hebt, muss der Schwenk
     * stehen. Ohne diese Probe wäre das Raster eine Selbstbestätigung.
     */
    const { VehicleManager } = await import("../src/delivery/vehicles");
    const { ItemManager } = await import("../src/world/scrapItems");
    const { CompositeManager } = await import("../src/dismantle/composites");
    const { EventBus } = await import("../src/core/events");
    const { pruefKunde } = await import("./pruefkunde");
    const { CRANE_SWING } = await import("../src/delivery/routes");

    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
      boden
    );
    const items = new ItemManager(scene, world);
    const vm = new VehicleManager(
      scene,
      world,
      items,
      new CompositeManager(scene, world, items, new EventBus())
    );
    vm.spawnNow("kipper", pruefKunde({ fuellgrad: 0.85, vehicle: "kipper", aufbau: "rungen" }));
    const v = (vm as unknown as { active: { crane: THREE.Group | null; tip: number } }).active;
    expect(v.crane, "der Prüfkunde ist kein Händler — kein Kran, nichts zu prüfen").toBeTruthy();

    let schwenkBeimAnheben: number | null = null;
    for (let i = 0; i < 60 * 600 && schwenkBeimAnheben === null; i++) {
      vm.update(1 / 60);
      items.clampSpeeds(1 / 60);
      world.step();
      if (v.tip > 0) schwenkBeimAnheben = Math.abs(v.crane!.rotation.y);
    }
    expect(schwenkBeimAnheben, "die Mulde hat sich nie gehoben").not.toBeNull();
    endlich(schwenkBeimAnheben!, "Schwenk beim Anheben");
    expect(
      schwenkBeimAnheben!,
      `die Mulde hebt sich, während der Kran erst bei ` +
        `${((schwenkBeimAnheben! * 180) / Math.PI).toFixed(0)}° von ` +
        `${((CRANE_SWING * 180) / Math.PI).toFixed(0)}° steht`
    ).toBeGreaterThan(CRANE_SWING - 0.03);
  }, 300000);
});
