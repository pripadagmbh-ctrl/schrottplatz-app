/**
 * DER TASTRAND DES UNTERWAGENS — wie weit faehrt die Maschine in etwas hinein,
 * und was kostet ein groesserer Rand an Fahrspur?
 *
 * Anlass (offener Punkt aus `docs/offene-punkte.md`, gefunden bei E-093):
 *
 *   `src/excavator/collision.ts`   CHASSIS_PAD  = 1,30 m
 *   `src/excavator/excavator.ts`   UNTERWAGEN_R = 2,60 m
 *
 * Zwei Zahlen fuer dieselbe Maschine. `chassisHits()` tastet mit der KLEINEN
 * gegen Bauwerke, `findeBox()` sperrt mit der GROSSEN gegen Fahrzeuge. Der
 * Unterschied ist die Tiefe, um die der Unterwagen in den MUELL-Container
 * hineinragt, bevor irgendetwas anschlaegt.
 *
 * DREI ABSCHNITTE, und sie beantworten drei verschiedene Fragen:
 *
 *   HERKUNFT      Wie gross ist der Unterwagen WIRKLICH? Gemessen am gebauten
 *                 Netz und an den gebauten Kollidern, nicht abgeschrieben.
 *   EINDRINGTIEFE Wie tief kommt er mit einem gegebenen Rand in jedes
 *                 Bauwerk? Gefahren wird nicht — abgesucht wird jede Lage, die
 *                 `hitsObstacle` noch durchlaesst.
 *   FAHRSPUREN    Was kostet der groessere Rand? Flutfuellung ueber den Platz:
 *                 Was ist vom Standplatz aus noch erreichbar, und kommt der
 *                 Arm noch an jeden Behaelter heran?
 *
 * Aufruf:  npx vite-node tools/unterwagen-rand.ts
 */
import { leinwandAttrappe } from "./leinwand-attrappe";
leinwandAttrappe();
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { initPhysics } from "../src/physics/physicsWorld";
import { Excavator } from "../src/excavator/excavator";
import {
  UNTERWAGEN_HALB_B,
  UNTERWAGEN_HALB_L,
  UNTERWAGEN_R,
} from "../src/excavator/unterwagenParts";
import { alleHindernisse, hitsObstacle, setBuildingObstacles, type Obstacle } from "../src/world/obstacles";
import { umrissUeberlappung } from "../src/delivery/umriss";
import { BAGGER_STAND, VERLADE_STAND, SCHWENK_AUSSEN } from "../src/world/baggerstand";
import { CONFIGS } from "../src/world/containers";
import { bauePlatz, stelleBehaelter, takt, type Platz } from "./durchfahrt-kern";

await initPhysics();

function m(x: number): string {
  return `${x.toFixed(2).padStart(6)} m`;
}

/* ------------------------------------------------------------- HERKUNFT -- */
console.log("HERKUNFT — wie gross der Unterwagen gebaut ist");
{
  const scene = new THREE.Scene();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const bagger = new Excavator(scene, world);
  bagger.root.updateMatrixWorld(true);

  /*
   * Nur die Teile, die MITFAHREN und nicht mitschwenken: Rahmen, Wangen,
   * Achsen, Raeder. Der Oberwagen dreht sich und hat seine eigene Huelle; der
   * Arm ebenso. Gefragt ist hier der Kreis, den das Fahrwerk beim Rangieren
   * ueberstreicht.
   */
  const jeTeil = new Map<string, { hw: number; hd: number; r: number }>();
  const v = new THREE.Vector3();
  // In den Rahmen des Baggers zurueckrechnen: `root` steht auf dem Standplatz
  // (−0,5 | −22,5), sonst misst man den Abstand zum Hofmittelpunkt.
  const inDenBagger = bagger.root.matrixWorld.clone().invert();
  for (const kind of bagger.root.children) {
    const name = kind.name || "(ohne Namen)";
    if (!/^0?1_UNTERWAGEN|^02_RAD/.test(name)) continue;
    kind.updateWorldMatrix(true, true);
    const kurz = name.startsWith("02_RAD") ? "02_RAD (alle vier)" : name;
    const e = jeTeil.get(kurz) ?? { hw: 0, hd: 0, r: 0 };
    jeTeil.set(kurz, e);
    kind.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inDenBagger);
        e.hw = Math.max(e.hw, Math.abs(v.x));
        e.hd = Math.max(e.hd, Math.abs(v.z));
        e.r = Math.max(e.r, Math.hypot(v.x, v.z));
      }
    });
  }
  console.log("  Netz je Teil            halbe Breite   halbe Laenge   Huellkreis");
  for (const [name, e] of jeTeil) {
    console.log(`  ${name.padEnd(22)}  ${m(e.hw)}     ${m(e.hd)}     ${m(e.r)}`);
  }
  /*
   * Ohne den PRATZENAUSLEGER: Er liegt im Stahl-Netz, steht aber nur im Weg,
   * wenn die Maschine aufgebockt ist — und dann faehrt sie nicht
   * (`blockedByOutriggers`). Genommen wird deshalb das Groesste aus Lack-Netz
   * und Raedern.
   */
  let fahrend = 0;
  for (const [name, e] of jeTeil) if (!name.includes("STAHL")) fahrend = Math.max(fahrend, e.r);
  console.log("");
  console.log(`  Huellkreis des FAHRENDEN Unterwagens (ohne Pratzen): ${m(fahrend)}`);
  console.log(`  Kollider (Quader 2,4 x 4,4):                         ${m(Math.hypot(1.2, 2.2))}`);
  console.log(`  UNTERWAGEN_R im Quelltext:                           ${m(UNTERWAGEN_R)}`);
}
console.log("");

/* -------------------------------------------------------- EINDRINGTIEFE -- */
/** Halbmasse des Unterwagens — aus derselben Quelle wie die Pruefung selbst. */
const UMRISS_HW = UNTERWAGEN_HALB_B;
const UMRISS_HD = UNTERWAGEN_HALB_L;

/**
 * Die drei Bauarten der Bauwerkspruefung, gegeneinander gemessen.
 *
 *   1,30 / 2,66  PUNKT MIT RAND, wie `hitsObstacle` es kann: das Bauwerk auf
 *                beiden Achsen um `pad` erweitert. Der Rand ist damit ein
 *                QUADRAT, kein Kreis.
 *   „Umriss"     DAS GEDREHTE RECHTECK, wie `chassisHits()` seit dem
 *                21.09.2026 prueft. Es gibt keinen Rand — es gibt die
 *                Maschine.
 */
type Art = { name: string; frei: (x: number, z: number, rot: number) => boolean };
const ARTEN: Art[] = [
  { name: "Rand 1.30", frei: (x, z) => hitsObstacle(x, z, 1.3) === null },
  {
    name: `Rand ${UNTERWAGEN_R.toFixed(2)}`,
    frei: (x, z) => hitsObstacle(x, z, UNTERWAGEN_R) === null,
  },
  {
    name: "Umriss    ",
    frei: (x, z, rot) => {
      const b = { x, z, hw: UMRISS_HW, hd: UMRISS_HD, rot };
      for (const o of alleHindernisse()) if (umrissUeberlappung(b, o) > 0) return false;
      return true;
    },
  },
];

/**
 * Tiefste Ueberdeckung des Unterwagens mit diesem Bauwerk ueber alle Lagen,
 * die `hitsObstacle(x, z, pad)` noch durchlaesst.
 *
 * Abgesucht wird ein Raster um das Bauwerk, in 24 Gierlagen. Gerechnet wird
 * mit `umrissUeberlappung` — derselben Funktion, mit der auch die Fahrzeuge
 * gemessen werden. Eine zweite Rechnung waere eine zweite Wahrheit.
 */
function eindringtiefe(o: Obstacle, art: Art): { tiefe: number; luft: number } {
  const SCHRITT = 0.05;
  const r = UNTERWAGEN_R + 0.5;
  let tiefe = 0;
  /*
   * ZU FRUEH GEBREMST — und zwar je Gierlage einzeln.
   *
   * Erste Fassung nahm das Kleinste ueber ALLE Lagen und bekam fuer den
   * Huellkreis 0,03 m heraus. Das war kein Lob, sondern ein Messfehler: Bei
   * rund 56 Grad ist die x-Ausdehnung des gedrehten Rechtecks GENAU
   * `hypot(1,50 | 2,20)`, also gleich dem Rand — in dieser einen Lage passt
   * der Kreis auf den Millimeter. Gefragt ist aber, wie weit sie im
   * SCHLIMMSTEN Fall vorher stehenbleibt.
   */
  let schlimmste = 0;
  for (let g = 0; g < 180; g += 180 / 24) {
    const rot = (g * Math.PI) / 180;
    let luft = Infinity;
    const c = Math.abs(Math.cos(rot));
    const si = Math.abs(Math.sin(rot));
    for (let x = o.x - o.hw - r; x <= o.x + o.hw + r; x += SCHRITT) {
      for (let z = o.z - o.hd - r; z <= o.z + o.hd + r; z += SCHRITT) {
        if (!art.frei(x, z, rot)) continue; // dort haelt die Maschine an
        const b = { x, z, hw: UMRISS_HW, hd: UMRISS_HD, rot };
        const d = umrissUeberlappung(b, o);
        if (d > tiefe) tiefe = d;
        if (d > 0) continue;
        // Abstand der beiden Rechtecke, untere Schranke (achsweise).
        const ab = Math.max(
          Math.abs(x - o.x) - (UMRISS_HW * c + UMRISS_HD * si + o.hw),
          Math.abs(z - o.z) - (UMRISS_HW * si + UMRISS_HD * c + o.hd)
        );
        if (ab >= 0 && ab < luft) luft = ab;
      }
    }
    if (luft !== Infinity && luft > schlimmste) schlimmste = luft;
  }
  return { tiefe, luft: schlimmste };
}

console.log("EINDRINGTIEFE — wie tief der Unterwagen in ein Bauwerk kommt");
console.log(`Umriss 2 x ${UMRISS_HW.toFixed(2)} x ${UMRISS_HD.toFixed(2)} m, 24 Gierlagen, 5-cm-Raster.`);
console.log("");

const p: Platz = bauePlatz();
for (let i = 0; i < 60; i++) takt(p);
setBuildingObstacles(p.containers.hindernisse());

const muell = alleHindernisse().find((o) => o.label === "MUELL")!;
const proben: Obstacle[] = [
  muell,
  alleHindernisse().find((o) => o.label === "Westwand")!,
  alleHindernisse().find((o) => o.label === "Kaffeewagen")!,
  alleHindernisse().find((o) => o.label.startsWith("Presse"))!,
  alleHindernisse().find((o) => o.label.includes("Stirn"))!,
];
console.log("  Bauwerk                  Bauart       tiefste Eindringung   frueheste Sperre");
for (const o of proben) {
  for (const art of ARTEN) {
    const e = eindringtiefe(o, art);
    console.log(
      `  ${o.label.padEnd(24)} ${art.name}    ${m(e.tiefe)}          ` +
        `${m(e.luft)} zu frueh`
    );
  }
}
console.log("");

/* ----------------------------------------------------------- FAHRSPUREN -- */
/**
 * Flutfuellung vom Standplatz aus: Welche Felder sind mit diesem Rand noch
 * anfahrbar?
 *
 * Nicht die freie Flaeche ist die Frage, sondern die ERREICHBARE: Ein
 * groesserer Rand macht keine Flaeche kleiner, er schnuert Durchlaesse zu.
 * Eine Flaeche, die nur noch ueber einen zugeschnuerten Durchlass zu haben
 * waere, faellt in dieser Rechnung heraus — in einer reinen Flaechenzahl
 * nicht.
 */
const RASTER = 0.25;
const X0 = -37;
const X1 = 15;
const Z0 = -32;
const Z1 = 30;
const NX = Math.round((X1 - X0) / RASTER);
const NZ = Math.round((Z1 - Z0) / RASTER);

function flut(art: Art, start: { x: number; z: number }): Uint8Array {
  const frei = new Uint8Array(NX * NZ);
  /*
   * Fuer den gedrehten Umriss zaehlt ein Feld als frei, wenn es in EINER von
   * zwoelf Gierlagen frei ist — die guenstige Lesart. Die unguenstige („in
   * JEDER Lage frei") ist genau die Rechnung mit dem Huellkreis, und die steht
   * schon als eigene Zeile da. Der Wahrheit liegt dazwischen: Die Maschine
   * kann sich drehen, aber nicht ueberall.
   */
  const LAGEN = 12;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const x = X0 + i * RASTER;
      const z = Z0 + j * RASTER;
      let f = 0;
      for (let g = 0; g < LAGEN && f === 0; g++) {
        if (art.frei(x, z, (g * Math.PI) / LAGEN)) f = 1;
      }
      frei[i * NZ + j] = f;
    }
  }
  const si = Math.round((start.x - X0) / RASTER);
  const sj = Math.round((start.z - Z0) / RASTER);
  const erreicht = new Uint8Array(NX * NZ);
  if (!frei[si * NZ + sj]) return erreicht; // der Standplatz selbst waere gesperrt
  const stapel = [si * NZ + sj];
  erreicht[si * NZ + sj] = 1;
  while (stapel.length > 0) {
    const k = stapel.pop()!;
    const i = Math.floor(k / NZ);
    const j = k % NZ;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as Array<[number, number]>) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const nk = ni * NZ + nj;
      if (erreicht[nk] || !frei[nk]) continue;
      erreicht[nk] = 1;
      stapel.push(nk);
    }
  }
  return erreicht;
}

/** Naechstes erreichbares Feld zu (x,z) — fuer „kommt der Arm noch heran?". */
function naechsteAnfahrt(erreicht: Uint8Array, x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      if (!erreicht[i * NZ + j]) continue;
      const d = Math.hypot(X0 + i * RASTER - x, Z0 + j * RASTER - z);
      if (d < best) best = d;
    }
  }
  return best;
}

console.log("FAHRSPUREN — was der groessere Rand an Platz kostet");
console.log(`Flutfuellung ab dem Standplatz (${BAGGER_STAND.x} | ${BAGGER_STAND.z}), ${RASTER * 100} cm Raster.`);
console.log("");

for (const [wo, xz] of [
  ["MUELL auf seinem Startplatz", null],
  ["MUELL dort, wo Patrick ihn hatte (−2,8 | −15,4)", [-2.8, -15.4]],
] as Array<[string, [number, number] | null]>) {
  if (xz) {
    stelleBehaelter(p, "r_rubble", xz[0], xz[1]);
    for (let i = 0; i < 30; i++) takt(p);
  }
  setBuildingObstacles(p.containers.hindernisse());
  console.log(`  ${wo}`);
  for (const art of ARTEN) {
    const erreicht = flut(art, BAGGER_STAND);
    let n = 0;
    for (const e of erreicht) n += e;
    const zumVerlade = naechsteAnfahrt(erreicht, VERLADE_STAND.x, VERLADE_STAND.z);
    const unerreichbar: string[] = [];
    for (const c of CONFIGS) {
      const d = naechsteAnfahrt(erreicht, c.x, c.z);
      if (d > SCHWENK_AUSSEN) unerreichbar.push(`${c.label} (${d.toFixed(1)} m)`);
    }
    console.log(
      `     ${art.name}:  ${(n * RASTER * RASTER).toFixed(0).padStart(4)} m² anfahrbar` +
        `   Verladeplatz ${zumVerlade < RASTER ? "erreichbar" : `${zumVerlade.toFixed(2)} m daneben`}` +
        `   ausser Reichweite: ${unerreichbar.length === 0 ? "keiner" : unerreichbar.join(", ")}`
    );
  }
  console.log("");
}

/* --------------------------------------------------------------- TASCHE -- */
/**
 * DIE TASCHE DES MUELL-CONTAINERS, NEU GERECHNET.
 *
 * `world/containers.ts` leitet den Startplatz (−3,79 | −14,11) aus VIER
 * Schranken her, und eine davon ist der Tastrand des Baggers. Waechst der
 * Rand, wandert die Tasche — sonst steht der Container ploetzlich in der
 * Fahrlinie, und das ist derselbe Fehler noch einmal.
 *
 *   1  Mitte im Schwenkband 5,80 … 9,20 m vom Sitz
 *   2  kein Kontakt mit einem Bauwerk
 *   3  Fahrlinie nach vorn frei:  |x + 0,5| ≥ 1,80 + Rand
 *   4  Rueckfahrspur frei:        x + 1,80 ≤ 3,35
 *
 * Gesucht wird die Lage mit dem groessten Abstand zur naechstliegenden
 * Schranke — derselbe „Mittelpunkt der Tasche" wie in E-041, nur abgesucht
 * statt von Hand aufgeloest.
 */
console.log("TASCHE — wo der MUELL-Container mit diesem Rand stehen darf");
{
  setBuildingObstacles([]); // der Container selbst zaehlt nicht als Bauwerk
  const bauten = alleHindernisse();
  const cfg = CONFIGS.find((c) => c.id === "r_rubble")!;
  const HW = cfg.size[0] / 2;
  const HD = cfg.size[1] / 2;
  const RUECKSPUR_X = 3.35; // world/containers.ts: 6,30 − 1,55 − 1,40

  /*
   * BELEGT IST NICHT NUR DIE WAND, SONDERN DIE GANZE MULDE. `obstacles.ts`
   * fuehrt von einer Sortiermulde nur den Wandring — der Innenraum bleibt
   * frei, damit der Greifer hineinkommt. Fuer einen Absetzcontainer ist er
   * natuerlich trotzdem besetzt: Dort liegt Schrott, dort steht ein Sockel.
   * Ohne diese Zeilen stellt die Suche den MUELL-Container mitten in die
   * BUNT-Mulde und meldet 0,50 m Luft (erste Fassung dieses Geraets).
   */
  const flaechen = CONFIGS.filter((c) => c.id !== "r_rubble").map((c) => {
    const nord = c.kind === "bay" && c.facing === "north";
    return {
      x: c.x,
      z: c.z,
      hw: (nord ? c.size[1] : c.size[0]) / 2,
      hd: (nord ? c.size[0] : c.size[1]) / 2,
      label: c.label,
    };
  });

  /** Luft zwischen dem Containergrundriss und dem naechsten Bauwerk (m). */
  const luftZuBauten = (x: number, z: number): number => {
    let min = Infinity;
    for (const o of [...bauten, ...flaechen]) {
      const d = Math.max(Math.abs(x - o.x) - (HW + o.hw), Math.abs(z - o.z) - (HD + o.hd));
      if (d < min) min = d;
    }
    return min;
  };

  /*
   * Fuer den gedrehten Umriss ist die Schranke „Fahrlinie" die halbe BREITE:
   * Der Bagger faehrt vom Standplatz geradeaus nach +z, quer zu ihm steht
   * `UNTERWAGEN_HALB_B`. Nichts anderes tut die Pruefung dann auch.
   */
  const SCHRANKEN: Array<[string, number]> = [
    ["Rand 1.30", 1.3],
    [`Rand ${UNTERWAGEN_R.toFixed(2)}`, UNTERWAGEN_R],
    ["Umriss geradeaus", UNTERWAGEN_HALB_B],
  ];
  for (const [name, pad] of SCHRANKEN) {
    let beste: { x: number; z: number; luft: number; welche: string } | null = null;
    for (let x = -14; x <= 8; x += 0.05) {
      for (let z = -34; z <= -6; z += 0.05) {
        const d = Math.hypot(x - BAGGER_STAND.x, z - BAGGER_STAND.z);
        const s: Array<[string, number]> = [
          ["Schwenkband innen", d - 5.8],
          ["Schwenkband aussen", 9.2 - d],
          ["Bauwerk", luftZuBauten(x, z)],
          ["Fahrlinie", Math.abs(x - BAGGER_STAND.x) - (HW + pad)],
          ["Rueckfahrspur", RUECKSPUR_X - (x + HW)],
        ];
        let luft = Infinity;
        let welche = "";
        for (const [n, v] of s) {
          if (v < luft) {
            luft = v;
            welche = n;
          }
        }
        if (luft <= 0) continue;
        if (!beste || luft > beste.luft) beste = { x, z, luft, welche };
      }
    }
    console.log(
      beste
        ? `  ${name.padEnd(18)}  Mitte (${beste.x.toFixed(2)} | ${beste.z.toFixed(2)}), ` +
            `engste Schranke „${beste.welche}" mit ${beste.luft.toFixed(2)} m Luft`
        : `  ${name.padEnd(18)}  KEINE LAGE ERFUELLT ALLE VIER SCHRANKEN`
    );
  }
  // Und was der heutige Startplatz unter dem neuen Rand wert ist:
  for (const [name, pad] of SCHRANKEN) {
    const frei = Math.abs(cfg.x - BAGGER_STAND.x) - (HW + pad);
    console.log(
      `  Startplatz (${cfg.x} | ${cfg.z}) bei ${name.padEnd(18)}: Fahrlinie ` +
        `${frei >= 0 ? "frei    " : "GESPERRT"} (${frei.toFixed(2)} m)`
    );
  }
}
console.log("");

/* --------------------------------------------------------------- KOSTEN -- */
/**
 * WAS DIE PRUEFUNG JE BILD KOSTET.
 *
 * Der Punkt mit Rand war eine Rechteckabfrage je Bauwerk, der Umriss ist ein
 * Trennachsensatz ueber vier Achsen. Das ist mehr — die Frage ist nur, ob man
 * es auf dem iPhone mini merkt. `chassisHits()` laeuft hoechstens dreimal je
 * Bild (Pruefung, Ruecknahme, Fluchtwegprobe).
 */
console.log("KOSTEN — was eine Pruefung kostet");
{
  setBuildingObstacles([]);
  const n = alleHindernisse().length;
  const RUNDEN = 200000;
  const messe = (was: string, f: (i: number) => void): void => {
    for (let i = 0; i < 20000; i++) f(i); // warmlaufen
    const t0 = performance.now();
    for (let i = 0; i < RUNDEN; i++) f(i);
    const ms = (performance.now() - t0) / RUNDEN;
    console.log(`  ${was.padEnd(28)} ${(ms * 1000).toFixed(2).padStart(6)} µs je Aufruf` +
      `   ${(ms * 3).toFixed(4)} ms je Bild (dreimal)`);
  };
  messe("Punkt mit Rand (frueher)", (i) => {
    hitsObstacle(-0.5 + (i % 50) * 0.1, -22.5, 1.3);
  });
  messe("gedrehter Umriss (jetzt)", (i) => {
    const b = { x: -0.5 + (i % 50) * 0.1, z: -22.5, hw: UMRISS_HW, hd: UMRISS_HD, rot: i * 0.01 };
    for (const o of alleHindernisse()) if (umrissUeberlappung(b, o) > 0) break;
  });
  console.log(`  (${n} Bauwerke in der Liste)`);
}
console.log("");
