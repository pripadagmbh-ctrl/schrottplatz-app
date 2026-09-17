/**
 * ZEHN FUHREN AUF DEN WARTEPLATZ — faehrt jeder hin, und wie?
 *
 * Anlass: E-098. Der Weg zum Warteplatz lief bis zum 17.09.2026 als Luftlinie
 * an `advance()` vorbei und damit an jeder Hindernispruefung. Jetzt ist es
 * eine Strecke. Dieses Geraet fragt drei Dinge, die ein Waechter allein nicht
 * beantwortet:
 *
 *   BLEIBT EINER STECKEN?  Zehn Fuhren in Folge, jede bis `parked`. Wer die
 *                          Frist reisst, steht in der Liste.
 *   IST DAS GESPENST WEG?  Abgeleitetes Tempo des LKW-Rahmens je Phase.
 *                          `toPark` und `parkRueck` standen auf 0,000 m/s —
 *                          versetzt statt bewegt, der Loeser sah keinen Stoss.
 *   WAS KOSTET ES?         Koerper wach/gesamt und Physikzeit je Bild.
 *
 * Aufruf:  npx vite-node tools/parkfahrten.ts
 */
import { leinwandAttrappe } from "./leinwand-attrappe";
leinwandAttrappe();
import { initPhysics } from "../src/physics/physicsWorld";
import { PARK_SLOTS, neueAbladestelle } from "../src/delivery/routes";
import { alleHindernisse, setBuildingObstacles } from "../src/world/obstacles";
import { umrissUeberlappung, UMRISS_TOLERANZ } from "../src/delivery/umriss";
import { bauePlatz, kinTempo, stelleBehaelter, takt, type Platz } from "./durchfahrt-kern";
import { pruefKunde } from "../test/pruefkunde";

await initPhysics();
neueAbladestelle();

/** Die Lage, in der Patricks Befund aufgetreten ist (E-097). */
const MUELL_PATRICK: [number, number] = [-2.8, -15.4];

/** Innenansicht des Fuhrparks — dieselbe Abkuerzung wie in `durchfahrt-kern`. */
interface WagenInnen {
  phaseName: string;
  parkSpot: [number, number] | null;
  group: { position: { x: number; z: number }; rotation: { y: number } };
  chassisBody: { linvel(): { x: number; y: number; z: number }; isValid(): boolean };
  cargo: { items: Array<{ body: { isValid(): boolean; setTranslation(p: unknown, w: boolean): void } }> };
}

/**
 * DER BAGGERFAHRER, DEN ES KOPFLOS NICHT GIBT.
 *
 * Ein Wagen faehrt erst zum Warteplatz, wenn seine Flaeche leer ist
 * (`isUnloaded`). Kopflos raeumt niemand ab; ein Kipper, dessen letztes Blech
 * an der Bordwand haengenbleibt, wartet die volle Standzeit von 240 s aus und
 * faehrt dann unverrichteter Dinge vom Hof — gemessen im ersten Lauf dieses
 * Geraets: 6 von 10 Fuhren kamen deshalb nie am Warteplatz an. Das ist kein
 * Steckenbleiben, sondern eine fehlende Maschine.
 *
 * Also raeumt dieses Geraet ab: Was nach dem Kippen noch auf der Flaeche
 * liegt, wird beiseite gesetzt — 60 m noerdlich, weit hinter dem Hof. Die
 * Fahrt selbst ist davon unberuehrt.
 */
function raeumeFlaeche(w: WagenInnen): void {
  for (const it of w.cargo.items) {
    if (!it.body.isValid()) continue;
    it.body.setTranslation({ x: 0, y: 0.5, z: 60 }, true);
  }
}

function aktiver(p: Platz): WagenInnen | null {
  return (p.m as unknown as { active: WagenInnen | null }).active;
}

const platz = bauePlatz();
for (let i = 0; i < 60; i++) takt(platz);
stelleBehaelter(platz, "r_rubble", ...MUELL_PATRICK);
for (let i = 0; i < 60; i++) takt(platz);

const tempoJePhase = new Map<string, number>();
let tiefsteJe = 0;
let tiefstesSchild = "";
let physikMs = 0;
let bilderGesamt = 0;
let wachSpitze = 0;
let koerperGesamt = 0;

interface Fuhre {
  nr: number;
  platzNr: number;
  bilder: number;
  ziel: boolean;
  tiefe: number;
  abstandZumPlatz: number;
  gierGrad: number;
  letztePhase: string;
}
const fuhren: Fuhre[] = [];

/**
 * Ein Bild mit Stoppuhr um `world.step()` herum.
 *
 * DER FUHRPARK SPAWNT HIER NICHT VON SELBST. Sonst steht mitten in einer
 * gemessenen Fuhre ein zweiter Wagen auf dem Hof, `spawnNow` findet den Platz
 * belegt, und das Geraet verfolgt den falschen — im ersten Lauf kamen dadurch
 * drei Fuhren „nicht an", die in Wahrheit gar nicht die gemessenen waren.
 */
function taktGemessen(p: Platz): void {
  (p.m as unknown as { nextSpawnT: number }).nextSpawnT = 1e9;
  const t0 = performance.now();
  takt(p);
  physikMs += performance.now() - t0;
  bilderGesamt++;
  let wach = 0;
  p.world.bodies.forEach((b) => {
    if (!b.isSleeping() && b.isDynamic()) wach++;
  });
  if (wach > wachSpitze) wachSpitze = wach;
  koerperGesamt = p.world.bodies.len();
}

for (let n = 0; n < 10; n++) {
  const platzNr = n % PARK_SLOTS.length;
  platz.m.spawnNow("kipper", pruefKunde({ vehicle: "kipper", aufbau: "flach", sortenrein: null, fuellgrad: 0.6 }));
  const w = aktiver(platz)!;
  w.parkSpot = PARK_SLOTS[platzNr]!;
  let bilder = 0;
  let ziel = false;
  let tiefe = 0;
  // 6.000 Bilder sind 100 s — mehr als das Dreifache einer vollen Fuhre.
  while (bilder < 6000) {
    taktGemessen(platz);
    bilder++;
    // Auch dieses Geraet fragt keinen entfernten Koerper mehr — genau daran
    // ist es beim ersten Lauf abgestuerzt, und genau das ist der Fehler, den
    // `ItemManager.raeumeVerwaiste` im Spiel behebt (E-098).
    if (!w.chassisBody.isValid()) break;
    const phase = w.phaseName;
    if (phase === "waitUnload" || phase === "tipHold") raeumeFlaeche(w);
    const v = kinTempo(w.chassisBody as never);
    if (v > (tempoJePhase.get(phase) ?? 0)) tempoJePhase.set(phase, v);
    for (const b of platz.m.fahrzeugBoxen()) {
      for (const o of alleHindernisse()) {
        const d = umrissUeberlappung(b, o);
        if (d <= UMRISS_TOLERANZ) continue;
        if (d > tiefe) tiefe = d;
        if (d > tiefsteJe) {
          tiefsteJe = d;
          tiefstesSchild = `${o.label} in Phase ${phase}`;
        }
      }
    }
    if (phase === "parked") {
      ziel = true;
      break;
    }
  }
  const soll = PARK_SLOTS[platzNr]!;
  fuhren.push({
    nr: n + 1,
    platzNr: platzNr + 1,
    bilder,
    ziel,
    tiefe,
    abstandZumPlatz: Math.hypot(w.group.position.x - soll[0], w.group.position.z - soll[1]),
    gierGrad: ((w.group.rotation.y * 180) / Math.PI + 720) % 360,
    letztePhase: w.phaseName,
  });
  // Den Wagen wegraeumen, damit der naechste denselben Platz bekommt.
  (platz.m as unknown as { parked: Array<{ despawn(): void }> }).parked.forEach((v) => v.despawn());
  (platz.m as unknown as { parked: unknown[] }).parked.length = 0;
  for (let i = 0; i < 30; i++) taktGemessen(platz);
}

console.log("ZEHN FUHREN AUF DEN WARTEPLATZ");
console.log("  Nr  Platz  Bilder  angekommen  tiefste Durchdringung  Restabstand  Gierlage");
for (const f of fuhren) {
  console.log(
    `  ${String(f.nr).padStart(2)}  ${String(f.platzNr).padStart(5)}  ` +
      `${String(f.bilder).padStart(6)}  ${f.ziel ? "     ja    " : "    NEIN   "}  ` +
      `${f.tiefe.toFixed(2).padStart(19)} m  ${f.abstandZumPlatz.toFixed(2).padStart(9)} m  ` +
      `${f.gierGrad.toFixed(1).padStart(6)} Grad  ${f.letztePhase}`
  );
}
console.log(
  `  angekommen: ${fuhren.filter((f) => f.ziel).length} von ${fuhren.length}` +
    `   tiefste Durchdringung ueberhaupt: ${tiefsteJe.toFixed(2)} m ${tiefstesSchild}`
);

console.log("\nABGELEITETES TEMPO DES LKW-RAHMENS JE PHASE (Spitze, m/s)");
console.log("Null heisst: versetzt statt bewegt — der Loeser sieht keinen Stoss.");
for (const [ph, v] of [...tempoJePhase.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ph.padEnd(18)} ${v.toFixed(3)}`);
}

console.log("\nWAS ES KOSTET");
console.log(`  Bilder gerechnet:      ${bilderGesamt}`);
console.log(`  Koerper gesamt:        ${koerperGesamt}`);
console.log(`  wache dynamische max:  ${wachSpitze}`);
console.log(`  Physik je Bild:        ${(physikMs / bilderGesamt).toFixed(3)} ms (Mittel)`);

setBuildingObstacles([]);
