/**
 * Was Lambert tut, wenn er selbständig aufräumt — gemessen, nicht geschätzt.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/lambert-aufraeumen.ts
 *
 * Gemessen wird in der Welt des Spiels (`PhysicsWorld`, `Yard`,
 * `ContainerManager`), nur ohne Bild. Vier Fragen, alle aus dem Auftrag vom
 * 17.09.2026:
 *
 *  1. RÄUMT ER AUF?  Wie viele Abfallstücke liegen am Anfang herum, wie viele
 *     am Ende — und wo landen sie.
 *  2. STEHT ER IM WEG?  Kleinster Abstand zu jeder Fahrspur (`routes.ts`) und
 *     wie viel Zeit er innerhalb einer LKW-Breite davon verbringt. Dazu: wie
 *     oft er im Sperrgebiet des Baggers und im Schwenkband steht.
 *  3. MACHT ER ETWAS KAPUTT?  Ein Prüfstück wird genau in seine Fahrlinie
 *     gelegt; gemessen wird, wie weit es sich verschiebt und wie schnell es
 *     dabei wird.
 *  4. WAS KOSTET ES?  Körper wach/gesamt, Physik-Millisekunden, und ob der
 *     Haufen zur Ruhe kommt.
 */
import * as THREE from "three";

function leinwandAttrappe(): void {
  if (typeof (globalThis as Record<string, unknown>).document !== "undefined") return;
  const attrappe = (): unknown =>
    new Proxy(
      {},
      {
        get: (ziel: Record<string, unknown>, feld: string) =>
          feld in ziel ? ziel[feld] : attrappe,
        set: (ziel: Record<string, unknown>, feld: string, wert: unknown) => {
          ziel[feld] = wert;
          return true;
        },
      }
    );
  const ctx = attrappe() as Record<string, unknown>;
  ctx.measureText = (): { width: number } => ({ width: 0 });
  (globalThis as Record<string, unknown>).requestAnimationFrame = (): number => 0;
  (globalThis as Record<string, unknown>).document = {
    createElement: (): unknown => ({
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: () => "",
      style: {},
    }),
  };
}

import { initPhysics, PhysicsWorld } from "../src/physics/physicsWorld";
import { Yard } from "../src/world/yard";
import { ContainerManager, CONFIGS } from "../src/world/containers";
import { ItemManager } from "../src/world/scrapItems";
import { OfficeBuilding } from "../src/world/office";
import { StaffManager, imBaggerrevier } from "../src/world/people";
import { EventBus } from "../src/core/events";
import { BAGGER_STAND, SCHWENK_INNEN, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { abstandZurStrecke } from "../src/world/weg";
import {
  ROUTE_IN_FWD,
  routeApproach,
  routeInRev,
  pickupApproach,
  pickupInRev,
} from "../src/delivery/routes";
import { getMaterial, ABFALLFRAKTIONEN } from "../src/materials/catalog";
import { fuellgrad } from "../src/world/fuellstand";
import { WEIGH_X, WEIGH_Z, KAFFEE_POS } from "../src/world/yard";
import { START_HAUFEN } from "../src/world/startplatz";
import { OFFICE_X } from "../src/world/office";

/** Halbe Spurbreite eines LKW — dieselbe Zahl wie `LANE_HALF_W` in `delivery/laneWatch.ts`. */
const SPUR_HALB = 2.6;

function spuren(): Array<[string, Array<[number, number]>]> {
  return [
    ["Einfahrt", ROUTE_IN_FWD],
    ["Zufahrt", routeApproach()],
    ["Abladeplatz", routeInRev()],
    ["Abholerspur", pickupApproach()],
    ["Verladeplatz", pickupInRev()],
  ];
}

function abstandZurSpur(x: number, z: number): { name: string; d: number } {
  let best = { name: "-", d: Infinity };
  for (const [name, pts] of spuren()) {
    for (let i = 0; i < pts.length - 1; i++) {
      const d = abstandZurStrecke(x, z, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]);
      if (d < best.d) best = { name, d };
    }
  }
  return best;
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const scene = new THREE.Scene();
  const phys = new PhysicsWorld();
  const world = phys.world;
  new Yard(scene, world);
  new OfficeBuilding(scene, world);
  const items = new ItemManager(scene, world);
  const bus = new EventBus();
  const container = new ContainerManager(scene, world, bus);
  const staff = new StaffManager(
    scene,
    items,
    new THREE.Vector3(WEIGH_X, 0, WEIGH_Z),
    KAFFEE_POS,
    new THREE.Vector3(OFFICE_X + 4.5, 0, 25)
  );
  staff.setLoader(true);
  staff.getMuldenOrt = (id) => container.ortVon(id);
  const bagger = new THREE.Vector3(BAGGER_STAND.x, 0, BAGGER_STAND.z);
  staff.getExcavatorPos = () => bagger;
  const funk: string[] = [];
  staff.onFunk = (wer, spruch) => funk.push(`${wer}: ${spruch}`);

  /*
   * ABFALL AUF DEM HOF. Zwölf Stücke, gleichmäßig über den Arbeitsteil des
   * Platzes verteilt — so, wie er nach ein paar Fuhren und einem zerlegten
   * Wrack tatsächlich herumliegt. Die Stellen sind ein Raster, kein Wurf:
   * Zufall würde die Messung von Lauf zu Lauf verschieben.
   */
  const ABFALLORTE: Array<[number, number]> = [
    [-2, 2], [4, -4], [-10, 4], [8, 6], [-16, -2], [2, 12],
    [-6, -8], [10, -2], [-13, 10], [0, 18], [-20, 2], [6, 14],
  ];
  /*
   * Mit `HAUFEN=85` liegt zusaetzlich ein voller Starthaufen da. Das ist
   * die Frage aus dem Physik-Budget: Weckt Lambert mit seinen Fahrten den
   * Haufen wieder auf? Gemessen wird das mit `geweckteProMinute` — dieselbe
   * Zahl, die auch im Debug-Overlay steht.
   */
  if (Number(process.env.HAUFEN ?? 0) > 0) {
    items.spawnPile(
      new THREE.Vector3(START_HAUFEN.x, 0, START_HAUFEN.z),
      Number(process.env.HAUFEN),
      START_HAUFEN.streuung
    );
  }
  const abfallIds: string[] = [];
  /* Mit `OHNEABFALL=1` findet Lambert nichts zu tun — das ist die Nullmessung. */
  if (process.env.OHNEABFALL !== "1") ABFALLORTE.forEach(([x, z], i) => {
    const frakt = ABFALLFRAKTIONEN[i % ABFALLFRAKTIONEN.length]!;
    const it = items.spawnScrap(
      frakt,
      60 + (i % 4) * 20,
      { kind: "box", dims: [0.7, 0.5, 0.7], color: getMaterial(frakt).color, name: "Prüfabfall" },
      new THREE.Vector3(x, 0.6, z)
    );
    if (it) abfallIds.push(it.id);
  });

  /*
   * DAS PRÜFSTÜCK. Es liegt an der Stelle, an der Lambert vom Ostposten
   * (−15,0 | −18,0) zum ersten Abfallstück fährt — also genau unter seiner
   * Fahrlinie. Gemessen wird, ob ein Fahrzeug ohne Kollider daran zerrt.
   */
  /*
   * Mit `SCHIEB=1` liegen schwere Brocken auf der Bueroseite — die zweite
   * Aufgabe. Gemessen wird, wie nahe sie am Ende am Bagger liegen.
   */
  const schiebOrte: Array<[number, number]> = [
    [-28, 6], [-25, 14], [-20, 0], [-16, 16], [-30, 2], [-12, 18], [-24, -6], [-8, 14],
  ];
  const schiebIds: string[] = [];
  if (process.env.SCHIEB === "1") {
    schiebOrte.forEach(([x, z], i) => {
      const it = items.spawnScrap(
        "steel",
        400 + i * 50,
        { kind: "box", dims: [1.0, 0.6, 1.0], color: getMaterial("steel").color, name: "Brocken" },
        new THREE.Vector3(x, 0.6, z)
      );
      schiebIds.push(it.id);
    });
  }

  const pruef = items.spawnScrap(
    "steel",
    20, // unter SCHIEB_MIN_KG: Er soll es nicht aufnehmen, nur daran vorbei
    { kind: "box", dims: [0.8, 0.5, 0.8], color: getMaterial("steel").color, name: "Prüfstück" },
    new THREE.Vector3(-13.0, 0.5, -12.0)
  );
  /*
   * Erst liegen lassen, dann messen: Die ersten Sekunden faellt das Stueck
   * aus 0,5 m und setzt sich. Wer ab Schritt 0 misst, misst den Wurf und
   * nicht Lambert.
   */
  const PRUEF_AB = 300;
  let pruefStart: { x: number; y: number; z: number } | null = null;
  let pruefTempo = 0;
  let pruefWeg = 0;

  const dt = 1 / 60;
  const SCHRITTE = Number(process.env.SCHRITTE ?? 60 * 60 * 6); // 6 Minuten Spielzeit
  /*
   * Mit `LKW=1` faehrt ein Fahrzeug die Zufahrt ab — hin und zurueck, ohne
   * Pause. Das ist der HAERTESTE Fall: In Wirklichkeit steht die Spur die
   * meiste Zeit leer. Gemessen wird damit die Vorfahrtsregel.
   */
  const mitLkw = process.env.LKW === "1";
  const zufahrt = routeApproach();
  const lkwPos = new THREE.Vector3();
  let lkwT = 0;
  const AUFWAERMEN = 60;
  let summe = 0;
  let gezaehlt = 0;
  let spitze = 0;
  let ruheAb = -1;

  const spurNah = new Map<string, number>();
  let spurMin = Infinity;
  let spurMinName = "-";
  let schritteAufSpur = 0;
  let schritteImRevier = 0;
  let schritteImBand = 0;
  const taetigkeiten = new Map<string, number>();
  /* Stehen zaehlt schaerfer als Fahren: Durchfahren sieht ein Fahrer kommen. */
  let spurMinStehend = Infinity;
  let schritteStehendAufSpur = 0;
  let schritteStehend = 0;
  const vorher = new THREE.Vector3();

  for (let i = 0; i < SCHRITTE; i++) {
    const a = Date.now();
    items.clampSpeeds(dt);
    phys.step();
    const ms = Date.now() - a;
    let lkw: THREE.Vector3 | null = null;
    if (mitLkw) {
      lkwT += dt * 4.8; // SPEED aus routes.ts
      const laenge = zufahrt.reduce(
        (sum, p, k) => (k === 0 ? 0 : sum + Math.hypot(p[0] - zufahrt[k - 1]![0], p[1] - zufahrt[k - 1]![1])),
        0
      );
      let rest = lkwT % (laenge * 2);
      if (rest > laenge) rest = laenge * 2 - rest;
      for (let k = 1; k < zufahrt.length; k++) {
        const a0 = zufahrt[k - 1]!;
        const a1 = zufahrt[k]!;
        const l = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
        if (rest <= l) {
          const f = rest / l;
          lkwPos.set(a0[0] + (a1[0] - a0[0]) * f, 0, a0[1] + (a1[1] - a0[1]) * f);
          break;
        }
        rest -= l;
      }
      lkw = lkwPos;
    }
    staff.update(dt, lkw);
    container.recount(items, new Set());

    if (i >= AUFWAERMEN) {
      summe += ms;
      gezaehlt++;
      spitze = Math.max(spitze, ms);
      const p = staff.lambertOrt;
      const s = abstandZurSpur(p.x, p.z);
      if (s.d < spurMin) {
        spurMin = s.d;
        spurMinName = s.name;
      }
      if (s.d < SPUR_HALB) {
        schritteAufSpur++;
        spurNah.set(s.name, (spurNah.get(s.name) ?? 0) + 1);
      }
      if (imBaggerrevier(p.x, p.z)) schritteImRevier++;
      const r = Math.hypot(p.x - BAGGER_STAND.x, p.z - BAGGER_STAND.z);
      if (r >= SCHWENK_INNEN && r <= SCHWENK_AUSSEN) schritteImBand++;
      taetigkeiten.set(staff.taetigkeit, (taetigkeiten.get(staff.taetigkeit) ?? 0) + 1);
      if (vorher.distanceTo(p) < 0.005) {
        schritteStehend++;
        if (s.d < spurMinStehend) spurMinStehend = s.d;
        if (s.d < SPUR_HALB) schritteStehendAufSpur++;
      }
      vorher.copy(p);
    }
    const { dynAwake: wach } = phys.counts();
    if (wach === 0 && ruheAb < 0) ruheAb = i;
    if (pruef && pruef.body.isValid() && i >= PRUEF_AB) {
      const q = pruef.body.translation();
      if (!pruefStart) pruefStart = { x: q.x, y: q.y, z: q.z };
      const lv = pruef.body.linvel();
      pruefTempo = Math.max(pruefTempo, Math.hypot(lv.x, lv.y, lv.z));
      pruefWeg = Math.max(pruefWeg, Math.hypot(q.x - pruefStart.x, q.z - pruefStart.z));
    }
  }

  const c = phys.counts();
  console.log("=== 1  Räumt er auf? ===");
  const nochDraussen = abfallIds.filter((id) => {
    const it = items.items.find((x) => x.id === id);
    if (!it) return false;
    return !it.containerId || !CONFIGS.some((cc) => cc.id === it.containerId && (cc.lager || cc.platzinventar));
  });
  console.log(`  Abfall gelegt: ${abfallIds.length}, nach ${(SCHRITTE / 60).toFixed(0)} s noch lose: ${nochDraussen.length}`);
  for (const id of nochDraussen) {
    const it = items.items.find((x) => x.id === id)!;
    const q = it.body.translation();
    console.log(`    liegen geblieben: ${it.materialId} auf (${q.x.toFixed(1)} | ${q.z.toFixed(1)})`);
  }
  for (const id of ["r_rubble", "c_rubble"]) {
    const cfg = CONFIGS.find((x) => x.id === id)!;
    const drin = items.items.filter((x) => x.containerId === id);
    const kg = drin.reduce((s, x) => s + x.massKg, 0);
    const massen = new Map<string, number>();
    for (const x of drin) massen.set(x.materialId, (massen.get(x.materialId) ?? 0) + x.massKg);
    console.log(
      `  ${cfg.label.padEnd(8)} ${String(drin.length).padStart(2)} Stk  ${kg.toFixed(0).padStart(5)} kg  ` +
        `Füllgrad ${(fuellgrad(cfg, massen) * 100).toFixed(1)} %`
    );
  }
  console.log("  Funk:");
  for (const f of funk) console.log(`    ${f}`);

  if (schiebIds.length > 0) {
    console.log("  Bueroseite — Abstand zum Bagger vorher/nachher:");
    schiebIds.forEach((id, i) => {
      const it = items.items.find((x) => x.id === id)!;
      const q = it.body.translation();
      const vor = Math.hypot(schiebOrte[i]![0] - BAGGER_STAND.x, schiebOrte[i]![1] - BAGGER_STAND.z);
      const nach = Math.hypot(q.x - BAGGER_STAND.x, q.z - BAGGER_STAND.z);
      console.log(
        `    (${schiebOrte[i]![0]} | ${schiebOrte[i]![1]})  ${vor.toFixed(1)} m → ${nach.toFixed(1)} m` +
          (nach < vor - 0.5 ? "   GESCHOBEN" : "")
      );
    });
  }
  console.log("=== 2  Steht er im Weg? ===");
  console.log(`  Kleinster Abstand zu einer Fahrspur: ${spurMin.toFixed(2)} m (${spurMinName})`);
  console.log(
    `  Schritte innerhalb ${SPUR_HALB} m einer Spur: ${schritteAufSpur} von ${gezaehlt} ` +
      `(${((schritteAufSpur / gezaehlt) * 100).toFixed(1)} %)`
  );
  for (const [name, n] of spurNah) console.log(`    ${name}: ${((n / gezaehlt) * 100).toFixed(1)} %`);
  console.log(
    `  Im STEHEN: kleinster Abstand ${spurMinStehend === Infinity ? "-" : spurMinStehend.toFixed(2)} m, ` +
      `${schritteStehendAufSpur} von ${schritteStehend} Standschritten auf einer Spur`
  );
  console.log(
    `  Im Sperrgebiet des Baggers: ${((schritteImRevier / gezaehlt) * 100).toFixed(1)} %, ` +
      `im Schwenkband: ${((schritteImBand / gezaehlt) * 100).toFixed(1)} %`
  );
  console.log("  Zeitanteile:");
  for (const [t, n] of [...taetigkeiten].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(22)} ${((n / gezaehlt) * 100).toFixed(1)} %`);
  }

  console.log("=== 3  Macht er etwas kaputt? ===");
  console.log(
    `  Prüfstück in der Fahrlinie: höchstes Tempo ${pruefTempo.toFixed(3)} m/s, ` +
      `Verschiebung ${pruefWeg.toFixed(3)} m`
  );

  console.log("=== 4  Was kostet es? ===");
  console.log(`  Körper: ${c.dynAwake} von ${c.dynamic} dynamischen wach, ${c.bodies} gesamt`);
  console.log(`  Physik je Schritt: ${(summe / gezaehlt).toFixed(2)} ms im Mittel, ${spitze} ms Spitze`);
  console.log(`  Von Lambert geweckte Koerper je Minute: ${staff.geweckteProMinute.toFixed(1)}`);
  console.log(
    ruheAb >= 0
      ? `  Ruhig ab Schritt ${ruheAb} (${(ruheAb / 60).toFixed(1)} s)`
      : `  ACHTUNG: kommt in ${SCHRITTE} Schritten nicht zur Ruhe`
  );
  if (ruheAb < 0) {
    const wach: Array<{ x: number; y: number; z: number; v: number }> = [];
    world.bodies.forEach((b) => {
      if (!b.isDynamic() || b.isSleeping()) return;
      const q = b.translation();
      const lv = b.linvel();
      wach.push({ x: q.x, y: q.y, z: q.z, v: Math.hypot(lv.x, lv.y, lv.z) });
    });
    wach.sort((a, b) => b.v - a.v);
    console.log("  Wach geblieben (die zehn schnellsten):");
    for (const w of wach.slice(0, 10)) {
      console.log(`    (${w.x.toFixed(1)} | ${w.y.toFixed(2)} | ${w.z.toFixed(1)})  ${w.v.toFixed(3)} m/s`);
    }
  }
}

void main();
