/**
 * WER FAEHRT DURCH WEN — der Bericht.
 *
 * Anlass, woertlich (Patrick am Geraet, 17.09.2026): „LKWS fahren durch
 * Muellcontainer. Objekte fahren durch einander hindurch".
 *
 * Gerechnet wird in `tools/durchfahrt-kern.ts`; hier steht nur, was
 * ausgegeben wird. Vier Abschnitte:
 *
 *   NULLPROBE     Ein Fall, dessen Ergebnis feststeht. Kommt er falsch heraus,
 *                 misst das Geraet sich selbst und keine Zahl des Laufs gilt.
 *   KOLLIDERBILD  Gibt es Kollider — und kann Rapier mit ihnen ueberhaupt
 *                 jemanden aufhalten? Das sind zwei Fragen.
 *   HINDERNISLISTE Was die Fahrer sehen, und was NICHT darin steht.
 *   FAHRPROBEN    Eine ganze Fuhre je Fahrzeugart, jedes Bild abgetastet.
 *
 * Aufruf:  npx vite-node tools/durchfahrt.ts
 */
import { leinwandAttrappe } from "./leinwand-attrappe";
leinwandAttrappe();
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import type { DeliveryKind } from "../src/delivery/vehicles";
import { alleHindernisse, setBuildingObstacles } from "../src/world/obstacles";
import { CONFIGS } from "../src/world/containers";
import { umrissUeberlappung } from "../src/delivery/umriss";
import { fahrzeugUmriss } from "../src/delivery/umriss";
import { bedLenFor, PARK_SLOTS, routeInRev, neueAbladestelle } from "../src/delivery/routes";
import {
  bauePlatz,
  behaelterKoerper,
  fahre,
  kinTempo,
  kontaktPunkte,
  legeSchrott,
  stelleBehaelter,
  takt,
  tiefstePro,
  wagen,
  wirkungZwischen,
  type Platz,
  type Treffer,
} from "./durchfahrt-kern";
/*
 * Die Pruef-Kundschaft steht in `test/pruefkunde.ts` — so wie schon bei
 * `tools/kipper-messreihe.ts` und `tools/rangier-wirkung.ts`. Ohne sie
 * wuerfelt der Fuhrpark die Fuhre aus, und ein sortenreiner Kipper faehrt in
 * sein Lagersilo statt an den Abladeplatz. Dann misst der Lauf mal das eine
 * und mal das andere.
 */
import { pruefKunde } from "../test/pruefkunde";

await initPhysics();
neueAbladestelle();

function m(x: number): string {
  return `${x.toFixed(2).padStart(6)} m`;
}

let nullprobeOk = true;

/* ------------------------------------------------------------ NULLPROBE -- */
console.log("NULLPROBE — ein Fall, dessen Ergebnis feststeht");
{
  // Ein Kipper-Umriss, 40 m neben allem. Muss 0 ergeben.
  const frei = fahrzeugUmriss({ x: 0, z: 90, rot: 0 }, bedLenFor("kipper"));
  let tiefFrei = 0;
  setBuildingObstacles([]);
  for (const o of alleHindernisse()) tiefFrei = Math.max(tiefFrei, umrissUeberlappung(frei, o));
  console.log(`  Umriss 90 m noerdlich des Hofes:      ${m(tiefFrei)}  (soll 0)`);
  if (tiefFrei !== 0) nullprobeOk = false;

  /*
   * Und die Gegenprobe zur Nullprobe: derselbe Umriss mitten auf einem
   * Bauwerk MUSS anschlagen. Genommen wird der Kaffeewagen — er steht in
   * `STATIC_OBSTACLES` mit `KAFFEE_FUSS` als Halbmass.
   */
  const kaffee = alleHindernisse().find((o) => o.label === "Kaffeewagen")!;
  const drauf = fahrzeugUmriss({ x: kaffee.x, z: kaffee.z, rot: 0 }, bedLenFor("kipper"));
  const tiefDrauf = umrissUeberlappung(drauf, kaffee);
  const sollDrauf = Math.min(2 * kaffee.hw, 2 * kaffee.hd, 3.1);
  console.log(
    `  derselbe Umriss auf dem Kaffeewagen:  ${m(tiefDrauf)}  (soll ${sollDrauf.toFixed(2)})`
  );
  if (Math.abs(tiefDrauf - sollDrauf) > 0.01) nullprobeOk = false;
}
console.log("");

/* --------------------------------------------------------- KOLLIDERBILD -- */
console.log("KOLLIDERBILD — gibt es einen Kollider, und haelt er jemanden auf?");
const p: Platz = bauePlatz();
for (let i = 0; i < 60; i++) takt(p);
{
  const muell = behaelterKoerper(p, "r_rubble")!;
  p.m.spawnNow("kipper");
  for (let i = 0; i < 5; i++) takt(p);
  const w = wagen(p)!;
  const arten = ["dynamisch", "fest", "kinematisch (Pose)", "kinematisch (Tempo)"];
  const zeile = (name: string, b: RAPIER.RigidBody): void =>
    console.log(
      `  ${name.padEnd(22)} ${arten[b.bodyType()]!.padEnd(20)} ${String(b.numColliders()).padStart(2)} Kollider`
    );
  zeile("MUELL-Container", muell);
  zeile("LKW Rahmen", w.chassisBody);
  zeile("LKW Ladeflaeche", w.bedBody);
  console.log("");
  console.log(`  LKW gegen MUELL:        ${wirkungZwischen(w.chassisBody, muell)}`);
  console.log(`  LKW gegen LKW:          ${wirkungZwischen(w.chassisBody, w.chassisBody)}`);
  console.log("  LKW gegen Bauwerk:      keiner weicht (Mauern sind feste Koerper)");
  console.log("  MUELL gegen Bauwerk:    einer weicht (der Container ist dynamisch)");
}
console.log("");

/* ------------------------------------------------------- HINDERNISLISTE -- */
console.log("HINDERNISLISTE — was die Fahrer sehen");
{
  setBuildingObstacles(p.containers.hindernisse());
  const alle = alleHindernisse();
  const beweglich = p.containers.hindernisse();
  console.log(`  ${alle.length} Eintraege, davon ${beweglich.length} beweglich`);
  for (const h of beweglich) {
    const cfg = CONFIGS.find((c) => c.label === h.label);
    console.log(
      `  beweglich: ${h.label} auf (${h.x.toFixed(2)} | ${h.z.toFixed(2)}) ` +
        `halb ${h.hw.toFixed(2)} x ${h.hd.toFixed(2)}, Oberkante ${h.top.toFixed(2)} m` +
        (cfg ? `  [cfg.size ${cfg.size.join(" x ")}]` : "")
    );
  }
  const fehlend = CONFIGS.filter(
    (c) => (c.kind === "rolloff" || c.kind === "grosscontainer") && !beweglich.some((h) => h.label === c.label)
  );
  console.log(
    fehlend.length === 0
      ? "  kein beweglicher Behaelter fehlt in der Liste"
      : `  FEHLT IN DER LISTE: ${fehlend.map((c) => c.label).join(", ")}`
  );
}
console.log("");

/* ---------------------------------------------------------- FAHRPROBEN -- */
console.log("FAHRPROBEN — eine ganze Fuhre je Lage, jedes Bild abgetastet");
console.log("Der MUELL-Container steht dort, wo Patrick ihn am 17.09.2026 stehen hatte.");
console.log("");

interface Probe {
  name: string;
  bauen: () => Platz;
}

const MUELL_PATRICK: [number, number] = [-2.8, -15.4];

function platzMitContainer(x: number, z: number): Platz {
  const q = bauePlatz();
  for (let i = 0; i < 30; i++) takt(q);
  stelleBehaelter(q, "r_rubble", x, z);
  for (let i = 0; i < 30; i++) takt(q);
  return q;
}

const muellStart = CONFIGS.find((k) => k.id === "r_rubble")!;
const proben: Array<Probe & { kind: DeliveryKind; parkSpot: [number, number] | null }> = [];
for (const kind of ["kipper", "pritsche", "abholer"] as DeliveryKind[]) {
  for (const slot of [...PARK_SLOTS, null]) {
    proben.push({
      name: `${kind}, Warteplatz ${slot ? `(${slot[0]} | ${slot[1]})` : "keiner"}`,
      kind,
      parkSpot: slot,
      bauen: () => platzMitContainer(...MUELL_PATRICK),
    });
  }
}
proben.push({
  name: "kipper, Warteplatz (-26 | 6), Container auf seinem STARTPLATZ",
  kind: "kipper",
  parkSpot: [-26.0, 6],
  bauen: () => platzMitContainer(muellStart.x, muellStart.z),
});

function bericht(name: string, treffer: Treffer[]): void {
  console.log(`  ${name}`);
  const tief = [...tiefstePro(treffer).values()].sort((a, b) => b.tiefe - a.tiefe);
  if (tief.length === 0) {
    console.log("     —  keine Durchdringung");
    return;
  }
  for (const t of tief) {
    console.log(
      `     ${m(t.tiefe)}  ${t.phase.padEnd(14)} ${t.gegen.padEnd(22)} ` +
        `Umriss bei (${t.x.toFixed(1)} | ${t.z.toFixed(1)}), Bild ${t.f}`
    );
  }
}

for (const pr of proben) {
  const q = pr.bauen();
  const start = { ...behaelterKoerper(q, "r_rubble")!.translation() };
  const phasen = new Set<string>();
  const treffer = fahre(q, {
    kind: pr.kind,
    kunde: pruefKunde({
      vehicle: pr.kind === "kipper" ? "kipper" : "pritsche",
      aufbau: "flach",
      sortenrein: null,
      fuellgrad: 0.6,
    }),
    parkSpot: pr.parkSpot,
    bisPhase: pr.parkSpot ? "parked" : "—",
    bilder: 60 * 120,
    beobachter: (w) => phasen.add(w),
  });
  bericht(pr.name, treffer);
  /*
   * WELCHE PHASEN UEBERHAUPT VORKAMEN. Ohne diese Zeile liest sich „keine
   * Durchdringung" wie eine Entwarnung — dabei erreichen Pritsche und Abholer
   * den Warteplatz innerhalb der Messzeit gar nicht: Sie warten am
   * Abladeplatz die volle Standzeit von 240 s ab (`STANDZEIT_S`).
   */
  console.log(`     erreichte Phasen: ${[...phasen].join(", ")}`);
  const jetzt = behaelterKoerper(q, "r_rubble")!.translation();
  console.log(
    `     Container hat sich um ${Math.hypot(jetzt.x - start.x, jetzt.z - start.z).toFixed(3)} m bewegt`
  );
  console.log("");
}

/* ------------------------------------------------ DIE KEHRE AM PLATZ ----- */
console.log("DIE KEHRE — was der Umriss beim Eindrehen auf der Stelle ueberstreicht");
console.log("Kein Wegpunkt, keine Strecke: `test/fahrumriss.test.ts` sieht diese Lagen nie.");
{
  setBuildingObstacles([]);
  const bauten = alleHindernisse();
  for (const [name, ort] of [
    ["Abladeplatz, Wechsel Anfahrt/Rangieren", routeInRev()[0]!],
    ["Abladeplatz, Halt", routeInRev()[1]!],
  ] as Array<[string, [number, number]]>) {
    let tief = 0;
    let wo = "";
    let grad = 0;
    for (let g = 0; g < 360; g++) {
      const u = fahrzeugUmriss(
        { x: ort[0], z: ort[1], rot: (g * Math.PI) / 180 },
        bedLenFor("kipper")
      );
      for (const o of bauten) {
        const d = umrissUeberlappung(u, o);
        if (d > tief) {
          tief = d;
          wo = o.label;
          grad = g;
        }
      }
    }
    console.log(
      `  ${name} (${ort[0]} | ${ort[1]}): tiefstens ${m(tief)} in ${wo || "nichts"} bei ${grad} Grad`
    );
  }
}
console.log("");

/* -------------------------------------------- BEWEIS: KONTAKT OHNE FOLGE -- */
console.log("BEWEIS — beruehren sich die Kollider waehrend der Durchfahrt?");
{
  const q = platzMitContainer(...MUELL_PATRICK);
  const muell = behaelterKoerper(q, "r_rubble")!;
  q.m.spawnNow("kipper", pruefKunde({ vehicle: "kipper", aufbau: "flach", sortenrein: null, fuellgrad: 0.6 }));
  wagen(q)!.parkSpot = [-26.0, 6];
  let gemeldet = false;
  for (let f = 0; f < 60 * 200 && !gemeldet; f++) {
    takt(q);
    const w = wagen(q);
    if (!w || w.phaseName !== "toPark") continue;
    const d = Math.hypot(w.group.position.x - MUELL_PATRICK[0], w.group.position.z - MUELL_PATRICK[1]);
    if (d > 1.6) continue;
    gemeldet = true;
    const n = kontaktPunkte(q.world, w.chassisBody, muell) + kontaktPunkte(q.world, w.bedBody, muell);
    console.log(`  Bild ${f}, Wagenmitte ${d.toFixed(2)} m vom Containermittelpunkt:`);
    console.log(`     Beruehrpunkte, die Rapier fuehrt: ${n}`);
    console.log(`     abgeleitetes Tempo des LKW-Rahmens: ${kinTempo(w.chassisBody).toFixed(3)} m/s`);
    console.log(`     Tempo des Containers:               ${kinTempo(muell).toFixed(3)} m/s`);
  }
  if (!gemeldet) console.log("  der Wagen kam dem Container nie naeher als 1,6 m");
}
console.log("");

/* ----------------------------------------- VERGLEICH: TEMPO JE PHASE ----- */
console.log("VERGLEICH — abgeleitetes Tempo des LKW-Rahmens je Phase");
console.log("Null heisst: versetzt statt bewegt. Der Loeser sieht dann keinen Stoss.");
{
  const q = bauePlatz();
  for (let i = 0; i < 30; i++) takt(q);
  q.m.spawnNow("kipper", pruefKunde({ vehicle: "kipper", aufbau: "flach", sortenrein: null, fuellgrad: 0.6 }));
  wagen(q)!.parkSpot = [-26.0, 6];
  const proPhase = new Map<string, number>();
  for (let f = 0; f < 60 * 200; f++) {
    takt(q);
    const w = wagen(q);
    if (!w) continue;
    const v = kinTempo(w.chassisBody);
    proPhase.set(w.phaseName, Math.max(proPhase.get(w.phaseName) ?? 0, v));
    if (w.phaseName === "parked") break;
  }
  for (const [ph, v] of proPhase) console.log(`  ${ph.padEnd(18)} ${v.toFixed(3)} m/s`);
}
console.log("");

/* ------------------------------------------- FAHRZEUG GEGEN SCHROTT ------ */
console.log("FAHRZEUG GEGEN LIEGENDEN SCHROTT auf dem Weg zum Warteplatz");
{
  const q = bauePlatz();
  for (let i = 0; i < 30; i++) takt(q);
  // Auf die Luftlinie Abladeplatz (6,3 | −23) → Warteplatz-Anfahrt (−26 | −2).
  const koerper = legeSchrott(q, 1.0, -18.4, 400);
  const vor = { ...koerper.translation() };
  q.m.spawnNow("kipper", pruefKunde({ vehicle: "kipper", aufbau: "flach", sortenrein: null, fuellgrad: 0.6 }));
  wagen(q)!.parkSpot = [-26.0, 6];
  for (let f = 0; f < 60 * 200; f++) {
    takt(q);
    const w = wagen(q);
    if (w && w.phaseName === "parked") break;
  }
  const nach = koerper.translation();
  console.log(
    `  400-kg-Brocken auf (1,0 | −18,4): verschoben um ` +
      `${Math.hypot(nach.x - vor.x, nach.z - vor.z).toFixed(2)} m ` +
      `auf (${nach.x.toFixed(2)} | ${nach.z.toFixed(2)})`
  );
}
console.log("");

/* --------------------------------------- BEHAELTER GEGEN BEHAELTER ------- */
console.log("BEHAELTER GEGEN BAUWERK — die Gegenprobe: hier haelt die Physik");
{
  const q = bauePlatz();
  for (let i = 0; i < 30; i++) takt(q);
  const muell = behaelterKoerper(q, "r_rubble")!;
  // Vor die Westmauer stellen und mit Schwung dagegen schicken.
  stelleBehaelter(q, "r_rubble", -34.0, -20.0);
  for (let i = 0; i < 60; i++) takt(q);
  const vor = { ...muell.translation() };
  muell.setLinvel({ x: -6, y: 0, z: 0 }, true);
  for (let i = 0; i < 240; i++) takt(q);
  const nach = muell.translation();
  console.log(
    `  Container mit 6 m/s gegen die Westmauer: von x ${vor.x.toFixed(2)} auf ` +
      `x ${nach.x.toFixed(2)} — ${nach.x < -36 ? "DURCH DIE MAUER" : "von der Mauer gehalten"}`
  );
}
console.log("");

console.log(nullprobeOk ? "Nullprobe bestanden." : "NULLPROBE GESCHEITERT — keine Zahl dieses Laufs gilt.");
if (!nullprobeOk) process.exitCode = 1;
void THREE;
