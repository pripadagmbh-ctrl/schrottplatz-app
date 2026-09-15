/**
 * DAS MESSGERÄT FÜR DEN KIPPER-KATAPULT — ab jetzt gibt es genau eines.
 *
 *     npx vite-node tools/kipper-messreihe.ts
 *     npx vite-node tools/kipper-messreihe.ts -- --saaten 8
 *
 * ANLASS (15.09.2026, E-062). Zwei Geräte haben denselben Vorgang gemessen,
 * mit denselben 24 Saaten, und sich um den Faktor zwei widersprochen — 149/463
 * gegen 122/228 km/h. Beide waren deterministisch, beide waren grün, beide
 * haben ihre Zahl in eine Entscheidung geschrieben. Das ist schlimmer als gar
 * nicht zu messen: Man kann sich die Zahl aussuchen, die passt.
 *
 * Aufgelöst wurde es mit einem Laufapparat und EINEM Schalter zur Zeit. Das
 * Ergebnis steht unten in `nullprobe()` und in `docs/entscheidungen.md`,
 * E-062. Kurz:
 *
 *   Messfenster (5,2 s gegen „bis zur Abfahrt")   ändert NICHTS, Zeichen für Zeichen
 *   Filter auf dynamische Körper                  ändert NICHTS, Zeichen für Zeichen
 *   Solver-Einstellungen wie im Spiel             ändert die Bahn, nicht die Höhe
 *   die FUHRE                                     ändert alles
 *
 * DREI REGELN, DIE DIESES WERKZEUG EINHÄLT und die jedes künftige einhalten
 * sollte:
 *
 *   1. NULLPROBE ZUERST. Wer eine Größe verstellen kann, muss zeigen, dass er
 *      sie auf den gebauten Wert gestellt dasselbe misst wie „gar nicht
 *      angefasst". Ein Gerät, das seinen eigenen Nullpunkt verfehlt, misst
 *      nichts. Läuft hier vor jeder Reihe.
 *   2. DIE FUHRE KOMMT AUS EINER QUELLE (`test/pruefkunde.ts`). Füllgrad ODER
 *      Masse wird vorgegeben, nie beides — die andere Zahl folgt aus der
 *      Spielregel Masse = Füllgrad × Laderaum × Schüttdichte (E-033).
 *   3. GEPAARTE VERGLEICHE. Die Bodendicke wird am FERTIGEN Kollider gestellt,
 *      nicht im Quelltext. Ein Eingriff in `vehicles.ts` verschiebt den
 *      Zufallsstrom und würfelt eine andere Ladung — dann vergleicht man
 *      Rauschen. So trägt jeder Stand Stück für Stück dieselbe Fuhre.
 *
 * Es steht bewusst in `tools/` und nicht in `test/`: Es behauptet nichts, es
 * berichtet. Der Wächter mit den Schranken ist `test/kipper.test.ts`.
 * `tsconfig.test.json` prüft diese Datei bei jedem `npm test` mit, damit sie
 * nicht still verrottet.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { VehicleManager } from "../src/delivery/vehicles";
import { ItemManager } from "../src/world/scrapItems";
import { CompositeManager } from "../src/dismantle/composites";
import { EventBus } from "../src/core/events";
import { FLAECHE_KOLLIDER_OBEN } from "../src/delivery/vehicleModel";
import type { CustomerProfile } from "../src/delivery/customers";
import { pruefKunde } from "../test/pruefkunde";

/** Die 24 Saaten, auf die sich alle Kipper-Messungen seit E-044 beziehen. */
export const SAATEN = [20260913, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

export interface Stand {
  name: string;
  kunde: () => CustomerProfile;
  /** Dicke des Muldenboden-Kolliders in m; `null` = nicht anfassen (gebaut: 0,60). */
  bodendicke?: number | null;
  /** Oberkante des Bodenkolliders; Standard +0,04 wie gebaut. */
  oberkante?: number;
  /** Solver-Werte aus `PhysicsWorld` setzen statt Rapier-Vorgaben zu nehmen. */
  solverWieSpiel?: boolean;
  /** Messen bis zur Abfahrt statt 5,2 s ab Kippbeginn. */
  langesFenster?: boolean;
}

function festerZufall(saat: number): () => void {
  const echt = Math.random;
  let z = saat >>> 0;
  Math.random = () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
  return () => {
    Math.random = echt;
  };
}

export interface Lauf {
  vmaxKmh: number;
  teile: number;
  masseKg: number;
  fuellgrad: number;
}

export function lauf(s: Stand, saat: number): Lauf {
  const zurueck = festerZufall(saat);
  try {
    const scene = new THREE.Scene();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    if (s.solverWieSpiel) {
      // Abschrift aus `physics/physicsWorld.ts` — dort ist die Quelle.
      world.timestep = 1 / 60;
      const p = world.integrationParameters;
      p.numSolverIterations = 6;
      p.contact_natural_frequency = 30;
      p.normalizedAllowedLinearError = 0.005;
      p.numAdditionalFrictionIterations = 2;
    }
    const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(400, 0.5, 400).setTranslation(0, -0.5, 0),
      boden
    );
    const items = new ItemManager(scene, world);
    const m = new VehicleManager(
      scene,
      world,
      items,
      new CompositeManager(scene, world, items, new EventBus())
    );
    const c = s.kunde();
    m.spawnNow("kipper", c);
    const v = (m as unknown as { active: Record<string, unknown> }).active;
    if (s.bodendicke != null || s.oberkante != null) {
      /*
       * Der Muldenboden ist der ERSTE Kollider des `bedBody` (`vehicles.ts`:
       * Boden, dann Stirnwand). Ein Quader ist durch Halbmaß und Versatz
       * vollständig beschrieben; die Ladung liegt zu diesem Zeitpunkt schon
       * und hängt nur an der Oberkante.
       */
      const bedBody = (v as unknown as { bedBody: RAPIER.RigidBody }).bedBody;
      const boden0 = bedBody.collider(0);
      const he = boden0.halfExtents();
      const halb = (s.bodendicke ?? he.y * 2) / 2;
      const oben = s.oberkante ?? FLAECHE_KOLLIDER_OBEN;
      boden0.setHalfExtents({ x: he.x, y: halb, z: he.z });
      // Der Quader ist genau so lang wie die Fläche: halbe Länge = lokales z.
      boden0.setTranslationWrtParent({ x: 0, y: oben - halb, z: he.z });
    }
    const dt = 1 / 60;
    let vmax = 0;
    let phase = "";
    let t = -1;
    for (let i = 0; i < 60 * 240; i++) {
      m.update(dt);
      items.clampSpeeds(dt);
      world.step();
      const p = String(v.phase);
      if (p !== phase) {
        if (p === "tipping") t = 0;
        phase = p;
      }
      if (t < 0) continue;
      for (const it of items.items) {
        const lv = it.body.linvel();
        vmax = Math.max(vmax, Math.hypot(lv.x, lv.y, lv.z));
      }
      t += dt;
      if (!s.langesFenster && t > 5.2) break;
      if (s.langesFenster && (p === "out" || p === "toPark")) break;
    }
    return {
      vmaxKmh: vmax * 3.6,
      teile: items.items.length,
      masseKg: items.items.reduce((a, it) => a + it.massKg, 0),
      fuellgrad: c.fuellgrad,
    };
  } finally {
    zurueck();
  }
}

export interface Reihe {
  name: string;
  mittel: number;
  hoechst: number;
  median: number;
  werte: number[];
  teile: number;
  masseKg: number;
  fuellgrad: number;
}

const mittelwert = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const abweichung = (a: number[]): number => {
  const mu = mittelwert(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, a.length - 1));
};

export function reihe(s: Stand, saaten: number[] = SAATEN): Reihe {
  const r = saaten.map((x) => lauf(s, x));
  const werte = r.map((x) => x.vmaxKmh);
  const sortiert = [...werte].sort((a, b) => a - b);
  return {
    name: s.name,
    mittel: mittelwert(werte),
    hoechst: Math.max(...werte),
    median: sortiert[Math.floor(sortiert.length / 2)]!,
    werte,
    teile: mittelwert(r.map((x) => x.teile)),
    masseKg: mittelwert(r.map((x) => x.masseKg)),
    fuellgrad: mittelwert(r.map((x) => x.fuellgrad)),
  };
}

/** Paarweiser Vergleich — nur gültig, weil beide Stände dieselbe Ladung tragen. */
export function paarweise(a: Reihe, b: Reihe): { delta: number; se: number; besser: number } {
  const d = a.werte.map((x, i) => x - b.werte[i]!);
  return {
    delta: mittelwert(d),
    se: abweichung(d) / Math.sqrt(d.length),
    besser: d.filter((x) => x > 0).length,
  };
}

function zeile(r: Reihe): string {
  return (
    `${r.name.padEnd(36)} Mittel ${r.mittel.toFixed(0).padStart(4)}` +
    `  Hoechst ${r.hoechst.toFixed(0).padStart(4)}  Median ${r.median.toFixed(0).padStart(4)}` +
    `  | ${r.teile.toFixed(1)} Stk  ${r.masseKg.toFixed(0)} kg  Fuellgrad ${r.fuellgrad.toFixed(2)}`
  );
}

/**
 * NULLPROBE: Der Eingriff auf den gebauten Wert gestellt muss dasselbe messen
 * wie kein Eingriff. Gibt `false` zurück, wenn nicht — dann ist jede Zahl
 * darunter wertlos.
 */
function nullprobe(saaten: number[]): boolean {
  const kunde = (): CustomerProfile => pruefKunde({ massKg: 5000, vehicle: "kipper" });
  const ohne = reihe({ name: "N0 ohne Eingriff", kunde }, saaten);
  const mit = reihe({ name: "N1 Eingriff auf 0,60 (gebaut)", kunde, bodendicke: 0.6 }, saaten);
  console.log(zeile(ohne));
  console.log(zeile(mit));
  const gleich = ohne.werte.every((x, i) => Math.abs(x - mit.werte[i]!) < 1e-9);
  console.log(gleich ? "  NULLPROBE bestanden\n" : "  NULLPROBE FEHLGESCHLAGEN — alles darunter ist wertlos\n");
  return gleich;
}

function hauptlauf(): void {
  const n = Number(process.argv.find((a) => /^--saaten=/.test(a))?.split("=")[1] ?? 0);
  const saaten = n > 0 ? SAATEN.slice(0, n) : SAATEN;
  console.log(`Kipper-Katapult, ${saaten.length} Saaten, km/h\n`);
  if (!nullprobe(saaten)) return;

  const staende: Stand[] = [
    {
      name: "Pruefladung 5000 kg (kipper.test.ts)",
      kunde: () => pruefKunde({ massKg: 5000, vehicle: "kipper" }),
      bodendicke: 0.6,
    },
    {
      name: "Pruefladung, Boden 0,16 m",
      kunde: () => pruefKunde({ massKg: 5000, vehicle: "kipper" }),
      bodendicke: 0.16,
    },
    {
      name: "randvoll konsistent (Fuellgrad 0,90)",
      kunde: () => pruefKunde({ fuellgrad: 0.9, vehicle: "kipper" }),
      bodendicke: 0.6,
    },
    {
      name: "E-051: Kollider 2 cm dicker (0,06)",
      kunde: () => pruefKunde({ massKg: 5000, vehicle: "kipper" }),
      bodendicke: 0.62,
      oberkante: 0.06,
    },
  ];
  const ergebnisse = staende.map((s) => reihe(s, saaten));
  for (const r of ergebnisse) console.log(zeile(r));
  console.log("\nPaarweise gegen den gebauten Stand (positiv = gebaut ist schlechter):");
  for (const r of ergebnisse.slice(1)) {
    const p = paarweise(ergebnisse[0]!, r);
    console.log(
      `  ${r.name.padEnd(36)} ${p.delta.toFixed(0).padStart(5)} +/- ${p.se.toFixed(0)} km/h` +
        `  · besser in ${p.besser} von ${saaten.length}`
    );
  }
}

await initPhysics();
hauptlauf();
