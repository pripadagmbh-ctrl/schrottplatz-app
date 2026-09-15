/**
 * WOHIN DER ABHOLER WIRKLICH FAEHRT — ein Messgeraet, kein Waechter.
 *
 * Ansage Patrick am Geraet, 15.09.2026: „abholung faehrt immer noch falsch."
 * E-056 hatte den Halteplatz schon einmal umgebaut; die Waechter dazu sind
 * gruen. Ein gruener Waechter, der das Falsche behauptet, ist kein Befund —
 * deshalb faehrt dieses Werkzeug den Wagen WIRKLICH: `VehicleManager.update()`
 * Schritt fuer Schritt, bis er steht, und misst dann nach.
 *
 * Es berichtet je Fall:
 *
 *   - wo er tatsaechlich haelt (x | z) und wie er dabei steht,
 *   - wo die BESTELLTE Mulde liegt (Mitte, Oeffnungsseite, Vorderkante),
 *   - den Abstand zwischen Halt und bestellter Mulde,
 *   - die vier Ladeflaechenecken, gemessen vom Baggersitz des Platzes
 *     (Schwenkband 5,80 … 9,20 m, harte Bodengrenze 9,50 m),
 *   - ob die GEFAHRENE Bahn ein Bauwerk schneidet (Trennachsensatz aus
 *     `src/delivery/umriss.ts`, dieselbe Figur, mit der der Wagen faehrt),
 *   - und ob er ueberhaupt beim erwarteten Schenkel ankommt.
 *
 * NULLPROBE ZUERST. Der Fall „keine Fraktion bestellt" MUSS am Abladeplatz
 * (6,3 | −23,0) enden — das ist die Stelle, die seit E-029 im Spiel steht und
 * die Patrick abgenommen hat. Kommt dort etwas anderes heraus, misst das
 * Geraet nicht den Platz, sondern sich selbst; dann ist keine andere Zahl aus
 * diesem Lauf gueltig, und das Werkzeug bricht mit Fehlercode ab.
 *
 * Aufruf: npx vite-node tools/abholfahrt.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import {
  setBaggerOrt,
  abholPlatzFuer,
  bedLenFor,
  BED_HALF_W,
  ABLADE_SPUR_X,
  ABLADE_HALT_Z,
} from "../src/delivery/routes";
import { CONFIGS, bayVorderkante, bayOeffnung } from "../src/world/containers";
import { alleHindernisse } from "../src/world/obstacles";
import { fahrzeugUmriss, umrissUeberlappung, UMRISS_TOLERANZ } from "../src/delivery/umriss";

/**
 * Bis hierher erreicht der Arm ueberhaupt noch den Boden (m).
 *
 * Aus `test/reach.test.ts`, uebernommen wie in `test/abholplatz.test.ts`:
 * 5,80 … 9,20 ist das bequeme Band, 9,50 die harte Grenze.
 */
const REICHT_BODEN = 9.5;

/** Ein gefahrener Zustand: Lage und Phase. */
interface Spur {
  x: number;
  z: number;
  rot: number;
  phase: string;
}

/** Alles, was eine Messfahrt hergibt. */
interface Messung {
  order: string | null;
  halt: [number, number];
  rot: number;
  dauer: number;
  steht: boolean;
  spur: Spur[];
}

/**
 * Eine Abholung wirklich fahren lassen, bis der Wagen an seinem Platz steht.
 *
 * Aufbau wie in `tools/fuhren.ts` (dort seit E-010 bewaehrt): eigene Szene,
 * eigene Welt, ein Boden, der Bagger auf seinem Hauptstandplatz. Der Wagen
 * kommt leer — was er mitnimmt, laedt im Spiel der Spieler.
 */
function fahre(order: string | null): Messung {
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
  m.getExcavatorPos = () => new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  setBaggerOrt(() => BAGGER_STAND);
  m.pickupOrder = order;
  m.spawnNow("abholer");
  const dt = 1 / 60;
  const spur: Spur[] = [];
  const MAX = 60 * 400;
  const zeiger = m as unknown as {
    active: { phase: string; group: THREE.Group } | null;
  };
  for (let i = 0; i < MAX; i++) {
    m.update(dt);
    items.clampSpeeds(dt);
    world.step();
    const a = zeiger.active;
    if (!a) break;
    spur.push({ x: a.group.position.x, z: a.group.position.z, rot: a.group.rotation.y, phase: a.phase });
    /*
     * „Steht" heisst: Er wartet auf Beladung. Das ist der Zustand, in dem der
     * Spieler ihn auf dem Platz vorfindet — jede Messung danach (Abstand zur
     * Mulde, Ecken der Ladeflaeche) bezieht sich auf genau diese Lage.
     */
    if (a.phase === "waitLoad") {
      return {
        order,
        halt: [a.group.position.x, a.group.position.z],
        rot: a.group.rotation.y,
        dauer: i / 60,
        steht: true,
        spur,
      };
    }
  }
  const letzte = spur.at(-1);
  return {
    order,
    halt: [letzte?.x ?? NaN, letzte?.z ?? NaN],
    rot: letzte?.rot ?? 0,
    dauer: MAX / 60,
    steht: false,
    spur,
  };
}

/** Die vier Ecken der Ladeflaeche in der gemessenen Lage. */
function ecken(halt: [number, number], rot: number): Array<[number, number]> {
  const bl = bedLenFor("abholer");
  // Der Ursprung des Wagens liegt in der Mitte der Ladeflaeche (`umriss.ts`).
  const vx = Math.sin(rot);
  const vz = Math.cos(rot);
  const out: Array<[number, number]> = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      out.push([
        halt[0] + a * (bl / 2) * vx + b * BED_HALF_W * vz,
        halt[1] + a * (bl / 2) * vz - b * BED_HALF_W * vx,
      ]);
    }
  return out;
}

/** Tiefste Durchdringung der GEFAHRENEN Bahn samt Bauwerk, das sie trifft. */
function bahnDurchdringung(spur: Spur[]): { tief: number; label: string } {
  const bl = bedLenFor("abholer");
  let tief = 0;
  let label = "—";
  const bauten = alleHindernisse();
  /*
   * Nicht jeder Schritt: Bei 60 Lagen je Sekunde und 280 s Fahrt waeren es
   * 17.000 Umrisse gegen 60 Bauwerke. Alle 6 Schritte ist dichter als das
   * 50-cm-Raster des Waechters (der Wagen faehrt 4,8 m/s, also 8 cm je
   * Schritt) und kostet nichts.
   */
  for (let i = 0; i < spur.length; i += 6) {
    const s = spur[i]!;
    const u = fahrzeugUmriss({ x: s.x, z: s.z, rot: s.rot }, bl);
    for (const o of bauten) {
      const d = umrissUeberlappung(u, o);
      if (d > tief) {
        tief = d;
        label = `${o.label} (${s.phase})`;
      }
    }
  }
  return { tief, label };
}

/**
 * Wieviel Luft der HALT noch hat, und zu welchem Bauwerk (m).
 *
 * Gerechnet, weil „keine Durchdringung" zweierlei heisst: einen Meter Luft
 * oder einen Zentimeter. Der Abstand wird gesucht statt gerechnet — das
 * Bauwerk wird so lange aufgeblasen, bis es den Wagenumriss beruehrt.
 * Das unterschaetzt den echten Abstand an den Ecken leicht und ist damit die
 * vorsichtige Seite.
 */
function luftAmHalt(halt: [number, number], rot: number): { luft: number; label: string } {
  const u = fahrzeugUmriss({ x: halt[0], z: halt[1], rot }, bedLenFor("abholer"));
  let beste = Infinity;
  let label = "—";
  for (const o of alleHindernisse()) {
    if (Math.hypot(o.x - halt[0], o.z - halt[1]) > 20) continue;
    let lo = 0;
    let hi = 5;
    if (umrissUeberlappung(u, { ...o, hw: o.hw + hi, hd: o.hd + hi }) <= 0) continue;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (umrissUeberlappung(u, { ...o, hw: o.hw + mid, hd: o.hd + mid }) > 0) hi = mid;
      else lo = mid;
    }
    if (hi < beste) {
      beste = hi;
      label = o.label;
    }
  }
  return { luft: beste, label };
}

/** Alle bestellbaren Faelle — datengetrieben aus den Behaeltern. */
function faelle(): Array<string | null> {
  const out: Array<string | null> = [null, "steel", "mixed"];
  for (const c of CONFIGS.filter((s) => s.lager === true)) {
    out.push(c.fractionId);
    for (const mit of c.mitFraktionen ?? []) out.push(mit);
  }
  return out;
}

function z2(v: number): string {
  return v.toFixed(2).padStart(7);
}

async function main(): Promise<void> {
  await initPhysics();

  /* ------------------------------------------------------- NULLPROBE ---- */
  const null0 = fahre(null);
  const sollNull: [number, number] = [ABLADE_SPUR_X, ABLADE_HALT_Z];
  const abwNull = Math.hypot(null0.halt[0] - sollNull[0], null0.halt[1] - sollNull[1]);
  console.log("NULLPROBE — 'keine Fraktion' muss am Abladeplatz beim Bagger enden");
  console.log(
    `  erwartet (${sollNull[0].toFixed(2)} | ${sollNull[1].toFixed(2)}), ` +
      `gemessen (${null0.halt[0].toFixed(2)} | ${null0.halt[1].toFixed(2)}), ` +
      `Abweichung ${abwNull.toFixed(3)} m, steht=${null0.steht}`
  );
  if (!null0.steht || abwNull > 0.05) {
    console.log("  NULLPROBE NICHT BESTANDEN — keine Zahl aus diesem Lauf ist gueltig.");
    process.exitCode = 1;
    return;
  }
  console.log("  bestanden.\n");

  /* --------------------------------------------------------- MESSUNG ---- */
  console.log(
    "Bestellung   Halt (x|z)        bestellte Mulde        Mitte (x|z)      Vorderkante      Halt→Mulde   Ecken vom Sitz (m)                 Bahn"
  );
  for (const order of faelle()) {
    const mess = fahre(order);
    const platz = abholPlatzFuer(order);
    const ziel = platz.ziel;
    const k = ziel ? bayVorderkante(ziel) : null;
    const o = ziel ? bayOeffnung(ziel) : null;
    const dMulde = k ? Math.hypot(mess.halt[0] - k.x, mess.halt[1] - k.z) : NaN;
    const de = ecken(mess.halt, mess.rot)
      .map(([x, z]) => Math.hypot(x - platz.stand.x, z - platz.stand.z))
      .sort((a, b) => a - b);
    const bahn = bahnDurchdringung(mess.spur);
    const luft = luftAmHalt(mess.halt, mess.rot);
    const bandOk = de.every((v) => v >= SCHWENK_INNEN && v <= SCHWENK_AUSSEN);
    const bodenOk = de.every((v) => v >= SCHWENK_INNEN && v <= REICHT_BODEN);
    const seite = o ? (o.x === 1 ? "nach Osten" : o.z === 1 ? "nach Norden" : "nach Westen") : "—";
    console.log(
      `${(order ?? "gemischt").padEnd(12)} ` +
        `(${mess.halt[0].toFixed(2)}|${mess.halt[1].toFixed(2)})`.padEnd(18) +
        `${(ziel?.label ?? "kein Silo → Bagger").padEnd(22)} ` +
        `${ziel ? `(${ziel.x.toFixed(1)}|${ziel.z.toFixed(1)})` : "—"}`.padEnd(16) +
        `${k ? `(${k.x.toFixed(1)}|${k.z.toFixed(1)}) ${seite}` : "—"}`.padEnd(29) +
        `${Number.isFinite(dMulde) ? `${dMulde.toFixed(2)} m` : "—"}`.padEnd(12) +
        `${de.map(z2).join(" ")}  ${bandOk ? "Band" : bodenOk ? "nur Boden" : "AUSSER REICHWEITE"}`.padEnd(
          52
        ) +
        `${bahn.tief > UMRISS_TOLERANZ ? `${bahn.tief.toFixed(2)} m ${bahn.label}` : "frei"}` +
        `   Luft am Halt ${
          Number.isFinite(luft.luft) ? `${luft.luft.toFixed(2)} m (${luft.label})` : "> 5 m"
        }` +
        `${mess.steht ? "" : "   STECKT"}`
    );
  }

  /* ---------------------------------------------- KOMMT ER AN? ---------- */
  console.log("\nSchenkel: haelt er vor der BESTELLTEN Mulde oder woanders?");
  for (const order of faelle()) {
    const platz = abholPlatzFuer(order);
    if (!platz.ziel) continue;
    const mess = fahre(order);
    /*
     * Laengs = die Achse, in der die Reihe steht (quer zur Oeffnung). Nur
     * darin kann der Wagen an seinem Silo vorbeifahren; quer dazu ist der
     * Abstand die Spurbreite und soll gerade NICHT null sein.
     */
    const o = bayOeffnung(platz.ziel);
    const laengs = o.x !== 0 ? mess.halt[1] - platz.ziel.z : mess.halt[0] - platz.ziel.x;
    const davor = CONFIGS.filter((c) => c.lager === true && c.facing === platz.ziel!.facing)
      .map((c) => ({
        c,
        d: Math.abs(o.x !== 0 ? mess.halt[1] - c.z : mess.halt[0] - c.x),
      }))
      .sort((a, b) => a.d - b.d)[0]!;
    console.log(
      `  ${(order ?? "gemischt").padEnd(10)} bestellt ${platz.ziel.label.padEnd(14)} ` +
        `steht ${Math.abs(laengs).toFixed(2)} m daneben, ` +
        `am naechsten liegt ${davor.c.label}` +
        `${davor.c.id === platz.ziel.id ? "" : "   ← FALSCHE MULDE"}`
    );
  }
}

void main();
