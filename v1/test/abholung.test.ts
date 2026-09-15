/**
 * Wächter für den Vorrang der Abholung.
 *
 * Anlass (12.09.2026): „Abholung soll Vorrang bekommen." Vorher fiel eine
 * Bestellung ersatzlos aus, solange noch ein Anlieferer auf dem Hof stand —
 * `requestPickup` gab „belegt" zurück und vergass den Auftrag. Wer den
 * Container leeren wollte, musste sich selbst merken, es später nochmal zu
 * versuchen, und traf dabei oft wieder auf einen frischen Anlieferer.
 *
 * Geprüft wird die Eigenschaft, nicht der Weg: Eine Bestellung geht nie
 * verloren, und was als nächstes durchs Tor kommt, ist der Abholer — auch
 * dann, wenn die übliche Wartezeit noch läuft oder die Einfahrt für
 * Anlieferer zu ist.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { verladeHaltFuer } from "../src/delivery/routes";
import { CONFIGS } from "../src/world/containers";

beforeAll(async () => {
  await initPhysics();
});

function bauePlatz(): VehicleManager {
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const items = new ItemManager(scene, world);
  // Der EventBus ist das vierte Argument und fehlte hier: `this.bus` war
  // `undefined`, und jeder Riss an einer Karosse (`partTorn`, `glassShattered`,
  // `crushed`) haette den Test mit einem TypeError beendet — nur erreicht ihn
  // dieser Weg nicht. Von der Typpruefung gemeldet (E-038).
  const composites = new CompositeManager(scene, world, items, new EventBus());
  return new VehicleManager(scene, world, items, composites);
}

describe("Vorrang der Abholung", () => {
  it("nimmt die Bestellung an, auch wenn ein Anlieferer auf dem Platz ist", () => {
    const m = bauePlatz();
    m.spawnNow("kipper");
    expect(m.activeKind).toBe("kipper");

    expect(m.requestPickup("alu")).toBe("vorgemerkt");
    expect(m.abholungVorgemerkt).toBe(true);
  });

  it("schickt den Anlieferer dafür nicht weg", () => {
    /*
     * Vorrang heisst: als nächster dran, nicht: den Laufenden abwürgen. Der
     * steht mit gewogener Ladung auf dem Platz — ihn wegzuschicken wäre kein
     * Vorrang, sondern ein Verlust.
     */
    const m = bauePlatz();
    m.spawnNow("kipper");
    m.requestPickup("alu");
    expect(m.activeKind).toBe("kipper");
  });

  it("lässt den Abholer als nächsten vorfahren, ohne Wartezeit", () => {
    const m = bauePlatz();
    m.spawnNow("kipper");
    m.requestPickup("copper");
    // Platz wird frei
    m.raeumePlatz();
    // Ein einziger Takt genügt — die übliche Pause zwischen zwei Fuhren
    // (7 bis 15 s) gilt für die Abholung nicht.
    m.update(0.016);
    expect(m.activeKind).toBe("abholer");
    expect(m.pickupOrder).toBe("copper");
    expect(m.abholungVorgemerkt).toBe(false);
  });

  it("fährt auch dann vor, wenn die Einfahrt für Anlieferer zu ist", () => {
    // Während der Sortierphase kommt kein Anlieferer mehr. Die Abholung ruft
    // der Spieler selbst — sie muss weiter durchkommen.
    const m = bauePlatz();
    m.acceptDeliveries = false;
    m.spawnNow("kipper");
    m.requestPickup(null);
    m.raeumePlatz();
    m.update(0.016);
    expect(m.activeKind).toBe("abholer");
  });

  it("faehrt an den Platz der Bestellung und funkt von dort durch", () => {
    /*
     * DER GANZE WEG, NICHT NUR DIE RECHNUNG (E-056).
     *
     * `test/abholplatz.test.ts` prueft kopflos, WO der Halteplatz liegt.
     * Hier faehrt ein Abholer wirklich hin: Er wird fuer Aluminium bestellt,
     * und am Ende muss er vor dem Westschenkel der Silo-Reihe stehen und
     * gemeldet haben, wo er ist.
     *
     * Ohne diesen Fall waere die Verdrahtung ungeprueft — der Halteplatz
     * koennte richtig gerechnet und trotzdem nie benutzt werden.
     */
    const m = bauePlatz();
    let gefunkt: string | null = null;
    m.onPickupFunk = (_wer, spruch) => {
      gefunkt = spruch;
    };
    m.requestPickup("alu");
    expect(m.activeKind).toBe("abholer");
    // Fuenf Minuten Spielzeit genuegen bei weitem; er braucht rund 45 s.
    for (let i = 0; i < 60 * 300 && gefunkt === null; i++) m.update(1 / 60);
    expect(gefunkt, "der Abholer hat nie durchgefunkt").not.toBeNull();
    expect(gefunkt!, `„${gefunkt}"`).toContain("ALU-LAGER");
    const halt = verladeHaltFuer(CONFIGS.find((c) => c.id === "c_alu_lager")!);
    const p = m.pickupTruck!.group.position;
    expect(Math.hypot(p.x - halt[0], p.z - halt[1]), "steht nicht am Verladeplatz").toBeLessThan(
      0.5
    );
  });

  it("merkt nur eine Abholung vor, nicht jede Bestellung einzeln", () => {
    const m = bauePlatz();
    m.spawnNow("kipper");
    m.requestPickup("alu");
    m.requestPickup("steel");
    m.raeumePlatz();
    m.update(0.016);
    // Die letzte Bestellung gilt — sie ist die jüngste Absicht des Spielers.
    expect(m.pickupOrder).toBe("steel");
    m.update(0.016);
    // Und es kommt kein zweiter Abholer hinterher.
    expect(m.abholungVorgemerkt).toBe(false);
  });
});
