/**
 * Zehn Fuhren in Folge — kommt jedes Fahrzeug wieder vom Platz?
 *
 * Gebaut am 14.09.2026 fuer den Platzumbau (E-010). Das Streckennetz haengt an
 * der Platzgeometrie, und ein einziger Punkt, der zu dicht an einem Bauwerk
 * liegt, setzt ein Fahrzeug fest: Feste Bauten kennen keine Aufgeben-Regel,
 * was sie versperren, bleibt versperrt. Beim Umbau ist genau das passiert —
 * Janines Kaffeewagen stand 3,9 m neben der Sehne, mit der ein LKW vier Meter
 * vorausschaut, und der erste Kipper blieb 292 Sekunden hinter der Waage
 * stehen. Im Test war nur zu sehen, dass die Ladeflaeche voll blieb.
 *
 * Der Wagen geht jede Fahrzeugart durch und meldet, wie lange sie gebraucht
 * hat und wo sie steckengeblieben ist.
 *
 * Aufruf: npx vite-node tools/fuhren.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager, type DeliveryKind } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import type { CustomerProfile } from "../src/delivery/customers";
import { BAGGER_STAND } from "../src/world/baggerstand";
import { setBaggerOrt } from "../src/delivery/routes";
import { STATIC_OBSTACLES } from "../src/world/obstacles";
import { EventBus } from "../src/core/events";
import { ladeVolumen, type Fahrzeugart } from "../src/delivery/fuellgrad";
import { ladungsDichte } from "../src/materials/schuettdichte";

function kunde(sortenrein: string | null, kind: DeliveryKind): CustomerProfile {
  // Die vier Ladefelder fehlten hier; gemeldet von der Typpruefung fuer
  // `test/` und `tools/` (E-038). Gerechnet statt geschaetzt.
  const art: Fahrzeugart = kind === "abholer" ? "kipper" : kind;
  const dichte = ladungsDichte(sortenrein, 0.06);
  return {
    group: "haendler",
    name: "Pruefstand",
    subtitle: "Messfahrt",
    massKg: 4000,
    vehicle: art,
    aufbau: "flach",
    fuellgrad: Math.min(1, 4000 / (ladeVolumen(art, "flach") * dichte)),
    dichte,
    sortedMaterial: sortenrein,
    contaminantShare: 0.06,
    hardness: 1,
    greeting: "",
  };
}

/** Eine Fuhre fahren lassen und beobachten, bis sie den Platz verlaesst. */
function fuhre(
  kind: DeliveryKind,
  sortenrein: string | null,
  mitBagger: boolean
): { ok: boolean; dauer: number; letztePhase: string; ort: string } {
  /*
   * Beim Abholer ist `sortenrein` die BESTELLUNG und nicht die Ladung — seit
   * E-056 haengt sein Halteplatz daran. Er kommt leer; was er mitnimmt,
   * bestimmt der Spieler.
   */
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0), boden);
  const items = new ItemManager(scene, world);
  // EventBus als viertes Argument — fehlte bis 15.09.2026 (E-038).
  const m = new VehicleManager(
    scene,
    world,
    items,
    new CompositeManager(scene, world, items, new EventBus())
  );
  /*
   * Der Bagger steht auf seinem Platz — oder eben nicht. Beides gehoert
   * gemessen: Ein Fahrzeug, das nur durchkommt, solange die Maschine weg ist,
   * ist kein Fahrzeug, das durchkommt.
   */
  if (mitBagger) {
    m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  }
  setBaggerOrt(() => BAGGER_STAND);
  if (kind === "abholer") m.pickupOrder = sortenrein;
  m.spawnNow(kind, kunde(sortenrein, kind));
  const v = (m as unknown as { active: { phase: string; group: THREE.Group } | null }).active;
  const dt = 1 / 60;
  let letzte = "";
  let ort = "";
  const MAX = 60 * 300; // fuenf Minuten Spielzeit
  for (let i = 0; i < MAX; i++) {
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    const a = (m as unknown as { active: { phase: string; group: THREE.Group } | null }).active;
    if (!a) return { ok: true, dauer: i / 60, letztePhase: letzte, ort };
    if (process.env.LAUT && a.phase !== letzte) console.log(`      t=${(i/60).toFixed(1)}s -> ${a.phase} bei (${a.group.position.x.toFixed(1)}|${a.group.position.z.toFixed(1)})`);
    letzte = a.phase;
    ort = `${a.group.position.x.toFixed(1)}|${a.group.position.z.toFixed(1)}`;
  }
  void v;
  /*
   * Steckt sie, wird gleich mitgesagt, WORAN — sonst sucht man den Grund
   * hinterher von Hand. Aufgezaehlt wird jedes feste Bauwerk, das naeher als
   * acht Meter am Wagen steht, und ob es ihn mit dem Sicherheitsabstand von
   * 1,4 m schon sperrt.
   */
  const a = (m as unknown as { active: { group: THREE.Group; phase: string } | null }).active;
  if (a && a.phase !== "waitUnload" && a.phase !== "waitLoad") {
    const q = a as unknown as Record<string, unknown>;
    console.log(`      blockedT=${String(q.blockedT)} gaveUp=${String(q.gaveUpWaiting)} routeS=${String(q.routeS)} parkT=${String(q.parkT)}`);
    const p = a.group.position;
    for (const o of STATIC_OBSTACLES) {
      if (Math.hypot(o.x - p.x, o.z - p.z) > 8) continue;
      const sperrt =
        Math.abs(p.x - o.x) < o.hw + 1.4 && Math.abs(p.z - o.z) < o.hd + 1.4 ? " SPERRT" : "";
      console.log(
        `      nah: ${o.label} (${o.x.toFixed(1)}|${o.z.toFixed(1)}) ` +
          `hw=${o.hw.toFixed(2)} hd=${o.hd.toFixed(2)}${sperrt}`
      );
    }
  }
  return { ok: false, dauer: MAX / 60, letztePhase: letzte, ort };
}

async function main(): Promise<void> {
  await initPhysics();
  const fahrten: Array<[string, DeliveryKind, string | null, boolean]> = [
    ["Kipper gemischt, Bagger steht", "kipper", null, true],
    ["Kipper gemischt, Platz frei", "kipper", null, false],
    ["Kipper Batterien sortenrein", "kipper", "battery", true],
    ["Kipper Kunststoff sortenrein", "kipper", "plastic", true],
    ["Kipper Alu sortenrein", "kipper", "alu", true],
    ["Kipper Kupfer sortenrein", "kipper", "copper", true],
    ["Kipper Holz sortenrein", "kipper", "wood", true],
    ["Kipper Stahl (kein Silo mehr)", "kipper", "steel", true],
    ["Pritsche mit Kran", "pritsche", null, true],
    ["Wrackanlieferung", "wrack", null, true],
    ["Privat-PKW", "pkw", null, true],
    /*
     * JEDER HALTEPLATZ DES ABHOLERS (E-056) — sie sind neu, und ein
     * Halteplatz, den niemand anfaehrt, ist eine Vermutung.
     */
    ["Abholer gemischt (Bagger)", "abholer", null, true],
    ["Abholer Stahlschrott (Bagger)", "abholer", "steel", true],
    ["Abholer Kupfer (West-Silos)", "abholer", "copper", true],
    ["Abholer Kabel (West-Silos)", "abholer", "cable", true],
    ["Abholer Alu (West-Silos)", "abholer", "alu", true],
    ["Abholer Edelstahl (Sued-Silos)", "abholer", "va", true],
    ["Abholer Batterien (Sued-Silos)", "abholer", "battery", true],
  ];
  /*
   * Wer auf den Spieler wartet, steckt nicht fest. Pritsche, Wrackwagen und
   * Privat-PKW werden vom Bagger ausgeraeumt; in dieser Messung arbeitet
   * niemand, also stehen sie zu Recht. Das ist ein eigenes Ergebnis und kein
   * Fehler — sonst suchte man beim naechsten Umbau an der falschen Stelle.
   */
  const wartet = (ph: string): boolean => ph === "waitUnload" || ph === "waitLoad";
  let gut = 0;
  console.log("Fuhre                             Ergebnis   Dauer   letzte Phase / Ort");
  for (const [name, kind, rein, bagger] of fahrten) {
    const r = fuhre(kind, rein, bagger);
    if (r.ok || wartet(r.letztePhase)) gut++;
    console.log(
      `${name.padEnd(33)} ${(r.ok ? "durch" : wartet(r.letztePhase) ? "wartet" : "STECKT").padEnd(9)} ${r.dauer
        .toFixed(1)
        .padStart(5)} s  ${r.ok ? "" : `${r.letztePhase} bei (${r.ort})`}`
    );
  }
  console.log(`\n${gut} von ${fahrten.length} Fuhren sind durchgelaufen.`);
}

void main();
