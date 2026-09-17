/**
 * WAS KOSTET EINE GRENZE AUF AUSLEGER + STIEL? — der Preiszettel zu E-095.
 *
 * Der Befund: Sobald der Arm über rund 20° einknickt (`Ausleger + Stiel`, also
 * die Neigung des Stiels über der Waagerechten), läuft der Stielkasten schräg
 * durch den Kreis, den der lotrecht hängende Greifer beim Drehen beschreibt.
 * Gemessen im laufenden Spiel (`tools/greifer-betrieb.ts`): Mit gestrecktem
 * Stiel berührt die Sichelkralle ab Ausleger 53,2° und bleibt bis 70° in
 * Berührung — 67 % einer einzigen Tastenbewegung.
 *
 * Die naheliegende Abhilfe ist eine Sperre auf die SUMME der beiden Winkel,
 * so wie eine echte Maschine einen Anschlag hat. Sie ist aber nicht umsonst:
 * Sie nimmt Hubhöhe weg. WIE VIEL, rechnet dieses Werkzeug aus — und zwar
 * gegen genau die Zahlen, an denen der Platz hängt:
 *
 *   - das Schwenkband 5,80…9,20 m (E-022, E-029, E-063),
 *   - die vier Stützstellen aus `test/reach.test.ts`
 *     (3,0 m < 0 · 4,6 m < 3,0 · 6,0 m > 3,0 · 7,5 m > 4,0),
 *   - die Wandhöhen aller selbst befüllten Behälter.
 *
 * GEMESSEN, NICHT ABGESCHRIEBEN: Auslegerlänge, Stiellänge und Drehpunkt
 * stehen hier nirgends als Zahl. Die Maschine wird gebaut, in jede Stellung
 * gesetzt und ihre Stielspitze ausgelesen — so kann die Rechnung nicht von
 * `excavator.ts` weglaufen.
 *
 * Aufruf: npx vite-node tools/knickgrenze.ts
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { Excavator } from "../src/excavator/excavator";
import { initPhysics } from "../src/physics/physicsWorld";
import { SICHELKRALLE } from "../src/excavator/greiferform";
import { FUENFSCHALEN } from "../src/excavator/greiferFuenfschalen";
import { CONFIGS } from "../src/world/containers";

const GRAD = 180 / Math.PI;

/** Gelenkgrenzen wie in `excavator.ts`. */
const BOOM_MIN = 5;
const BOOM_MAX = 70;
const STICK_MIN = -140;
const STICK_MAX = -25;

/** Behälter, die der Spieler selbst befüllt — wie in `test/reach.test.ts`. */
const SELBST_BEFUELLT = ["c_mixed", "c_steel", "r_bunt", "r_rubble"];

interface Stellung {
  boom: number;
  stick: number;
  /** Waagerechter Abstand der Stielspitze vom Drehmittelpunkt (m). */
  weite: number;
  /** Höhe der Stielspitze über Grund (m). */
  hoch: number;
}

async function main(): Promise<void> {
  leinwandAttrappe();
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const boden = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 60), boden);
  const szene = new THREE.Scene();
  const bagger = new Excavator(szene, world);
  const stand = bagger.position.clone();
  const b = bagger as unknown as { boomAngle: number; stickAngle: number; rotatorYaw: number };
  const sync = (bagger as unknown as { syncMeshes(): void }).syncMeshes.bind(bagger);

  /*
   * Das ganze Gelenkfeld einmal AUSMESSEN. 0,5°-Raster; feiner bringt nichts,
   * weil die Stützstellen unten ohnehin auf 5 cm Abstand gerundet werden.
   */
  const alle: Stellung[] = [];
  b.rotatorYaw = 0;
  for (let bg = BOOM_MIN; bg <= BOOM_MAX + 1e-9; bg += 0.5) {
    for (let sg = STICK_MIN; sg <= STICK_MAX + 1e-9; sg += 0.5) {
      b.boomAngle = bg / GRAD;
      b.stickAngle = sg / GRAD;
      sync();
      const u = bagger.grappleGroup.position;
      alle.push({
        boom: bg,
        stick: sg,
        weite: Math.hypot(u.x - stand.x, u.z - stand.z),
        hoch: u.y - stand.y,
      });
    }
  }
  console.log(`=== Was kostet eine Grenze auf Ausleger + Stiel? ===\n`);
  console.log(`  ${alle.length.toLocaleString("de-DE")} Gelenkstellungen ausgemessen (0,5°-Raster).`);

  for (const form of [SICHELKRALLE, FUENFSCHALEN]) {
    console.log(
      `  ${form.name.padEnd(20)} Greifertiefe ${form.maxTiefe.toFixed(4)} m,` +
        ` Bodenanschlag hält die Spitze auf ${(form.maxTiefe + 0.02).toFixed(2)} m`
    );
  }
  console.log("");

  /**
   * Höchste Krallenspitze bei einem Abstand — dieselbe Frage wie
   * `hoechsteKrallenspitze` in `excavator.ts`, aber mit einer Sperre auf die
   * Winkelsumme und aus den GEMESSENEN Stellungen.
   */
  const hoechste = (abstand: number, knick: number, tief: number): number => {
    let best = -Infinity;
    for (const s of alle) {
      if (s.boom + s.stick > knick) continue;
      if (Math.abs(s.weite - abstand) > 0.05) continue;
      best = Math.max(best, s.hoch - tief);
    }
    return best;
  };

  const KNICKE = [Infinity, 30, 25, 20, 15];
  const STUETZ = [3.0, 4.6, 6.0, 7.5, 9.5];

  for (const form of [SICHELKRALLE, FUENFSCHALEN]) {
    console.log(`\n################  ${form.name}  ################`);
    console.log("\n  Höchste Krallenspitze über Grund, je Abstand vom Drehmittelpunkt:\n");
    console.log(
      `  Sperre  | ${STUETZ.map((d) => `${d.toFixed(1)} m`.padStart(8)).join(" |")} | höchste | dort bei | weiteste`
    );
    console.log(
      `  Knick   | ${STUETZ.map(() => "        ").join(" |")} | Spitze  | Abstand  | Reichweite`
    );
    console.log(`  --------+${STUETZ.map(() => "---------").join("+")}+---------+----------+-----------`);
    for (const knick of KNICKE) {
      const zeile = STUETZ.map((d) => {
        const v = hoechste(d, knick, form.maxTiefe);
        return (v === -Infinity ? "—" : v.toFixed(2)).padStart(8);
      });
      let hoch = -Infinity;
      let hochBei = 0;
      let weit = -Infinity;
      for (const s of alle) {
        if (s.boom + s.stick > knick) continue;
        const spitze = s.hoch - form.maxTiefe;
        if (spitze > hoch) {
          hoch = spitze;
          hochBei = s.weite;
        }
        /*
         * Die weiteste Reichweite heisst: wie weit kommt die Krallenspitze noch
         * auf den BODEN. Eine Stellung, in der der Greifer drei Meter ueber
         * dem Beton in der Luft steht, ist keine Reichweite.
         */
        if (spitze <= 0.3 && s.weite > weit) weit = s.weite;
      }
      console.log(
        `  ${(knick === Infinity ? "keine" : `${knick}°`).padStart(7)} | ${zeile.join(" |")} |` +
          ` ${hoch.toFixed(2).padStart(7)} | ${hochBei.toFixed(2).padStart(8)} |` +
          ` ${weit.toFixed(2).padStart(10)}`
      );
    }

    console.log("\n  Die Behälter, die der Spieler selbst befüllt (Wand + 0,40 m Luft):\n");
    for (const cfg of CONFIGS) {
      if (!SELBST_BEFUELLT.includes(cfg.id)) continue;
      const noetig = cfg.size[2] + 0.4;
      const zeile = KNICKE.map((knick) => {
        /*
         * Reicht IRGENDEIN Abstand im Schwenkband? Genau die Frage stellt
         * `test/reach.test.ts` — nur dass es dort die Arbeitslinie abfaehrt.
         * Hier genuegt das Band, weil der Platz darum herum gebaut ist.
         */
        let ok = false;
        for (let d = 5.8; d <= 9.2 + 1e-9; d += 0.1) {
          if (hoechste(d, knick, SICHELKRALLE.maxTiefe) > noetig) ok = true;
        }
        return (ok ? "ja" : "NEIN").padStart(7);
      });
      console.log(
        `  ${cfg.label.padEnd(26)} Wand ${cfg.size[2].toFixed(2)} m →` +
          ` ${KNICKE.map((k, i) => `${k === Infinity ? "ohne" : `${k}°`}: ${zeile[i].trim()}`).join("  ·  ")}`
      );
    }
  }

  console.log(
    "\n  Lesehilfe: der Knick ist Ausleger + Stiel, also die Neigung des Stiels über\n" +
      "  der Waagerechten. Ohne Sperre geht sie bis 70 − 25 = 45°. Die Berührung am\n" +
      "  Stielkasten beginnt im Rasterlauf bei 20,6° und im laufenden Spiel (Rotator\n" +
      "  auf 0) bei 28,2°."
  );
}

if (!process.env.VITEST) void main();
