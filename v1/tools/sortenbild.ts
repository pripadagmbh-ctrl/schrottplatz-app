/**
 * SORTENBILD — sieht man einem Teil seine Sorte an? (E-123, 06.10.2026)
 *
 * Patrick: „Kupfer, Va, Aluminium, misschrott und stahlschrott müssen als
 * solches besser erkennbar sein." Bilder macht das Spiel selbst (Bildschalter
 * im Dev-Server); dieses Werkzeug liefert die Zahlen daneben, damit das Bild
 * nicht allein am Geschmack haengt.
 *
 * Fuer jede der sechs Sorten werden ALLE gebauten Katalogteile dieser Sorte
 * gebaut (`baueGeometrie`, mit Fraktion), und gemittelt wird nach FLAECHE —
 * nicht nach Ecken, sonst zaehlte ein Zylinder mit 18 Seiten mehr als eine
 * Wand. Ausgegeben wird:
 *
 *   Flaeche   mittlere Eckfarbe, wie sie im Netz steht
 *   diffus    dieselbe mal (1 − Metallglanz): Ohne Umgebungskarte ist das
 *             der Teil, den Halbkugel- und Sonnenlicht ueberhaupt aufhellen
 *             (`farbabstand.unterLicht`, dort steht die Begruendung)
 *   bunt      Flaechenanteil, der mehr als ΔE 15 vom Mittel des eigenen
 *             Stuecks abweicht — wie „gemischt" ein Teil aussieht
 *
 * und die Abstaende der diffusen Mittel untereinander (ΔE2000).
 *
 * Laeuft vor und nach E-123 gleich: Wo es `fraktionsbild` noch nicht gibt,
 * nimmt es die alte Regel aus `scrapItems.spawnScrap`.
 *
 *     npx vite-node tools/sortenbild.ts
 */
import * as THREE from "three";
import * as objektbau from "../src/world/objektbau";
import { SPECS, BIG_SPECS, HUGE_SPECS } from "../src/world/scrapItems";
import { deltaEHex, hexZuLab, deltaE2000, linearZuSrgb, rgbZuHex } from "./farbabstand";

type Bild = { rauheit: number; glanz: number } | undefined;
const neu = (objektbau as unknown as { fraktionsbild?: (id: string) => Bild }).fraktionsbild;

/** Oberflaeche wie im Spiel — neu aus dem Fraktionsbild, alt aus der festen Regel. */
function oberflaeche(id: string): { rauheit: number; glanz: number } {
  const b = neu?.(id);
  if (b) return b;
  return { rauheit: id === "copper" || id === "brass" || id === "alu" ? 0.35 : 0.75, glanz: 0.4 };
}

export const SORTEN = ["steel", "mixed", "va", "alu", "copper", "brass"];
const NAME: Record<string, string> = {
  steel: "Stahlschrott",
  mixed: "Mischschrott",
  va: "VA",
  alu: "Alu",
  copper: "Kupfer",
  brass: "Messing",
};

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();

/** Flaechengewichtete Dreiecke eines Netzes: [Flaeche, r, g, b (linear)]. */
function dreiecke(geo: THREE.BufferGeometry): Array<[number, number, number, number]> {
  const pos = geo.getAttribute("position");
  const col = geo.getAttribute("color");
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const ecke = (k: number): number => (idx ? idx.getX(k) : k);
  const out: Array<[number, number, number, number]> = [];
  for (let k = 0; k + 2 < n; k += 3) {
    const [i, j, l] = [ecke(k), ecke(k + 1), ecke(k + 2)];
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j);
    c.fromBufferAttribute(pos, l);
    const f = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    if (!(f > 0)) continue;
    const m = (s: number): number => (col.getComponent(i, s) + col.getComponent(j, s) + col.getComponent(l, s)) / 3;
    out.push([f, m(0), m(1), m(2)]);
  }
  return out;
}

function zuHex(r: number, g: number, bl: number): number {
  return rgbZuHex(linearZuSrgb(r), linearZuSrgb(g), linearZuSrgb(bl));
}

/** Mittel je Sorte — von Werkzeug und Waechter (`test/grossteileNeu.test.ts`) gleich gerechnet. */
export interface SortenMittel {
  teile: number;
  flaeche: number;
  diffus: number;
  /** Flaechenanteil 0..1, der mehr als ΔE 15 vom Mittel des eigenen Stuecks abweicht */
  bunt: number;
  rauheit: number;
  glanz: number;
}

export function sortenMittel(): Record<string, SortenMittel> {
  const alle = [...SPECS, ...BIG_SPECS, ...HUGE_SPECS];
  const raus: Record<string, SortenMittel> = {};
  for (const id of SORTEN) {
    const teile = alle.filter((s) => s.materialId === id && s.bau);
    let F = 0;
    let R = 0;
    let G = 0;
    let B = 0;
    let buntF = 0;
    for (const sp of teile) {
      const geo = objektbau.baueGeometrie(sp.bau!, sp.dims, sp.kind, id).koerper;
      const ds = dreiecke(geo);
      let f0 = 0;
      let r0 = 0;
      let g0 = 0;
      let b0 = 0;
      for (const [f, r, g, bl] of ds) {
        f0 += f;
        r0 += f * r;
        g0 += f * g;
        b0 += f * bl;
      }
      const mittelLab = hexZuLab(zuHex(r0 / f0, g0 / f0, b0 / f0));
      for (const [f, r, g, bl] of ds) if (deltaE2000(hexZuLab(zuHex(r, g, bl)), mittelLab) > 15) buntF += f / f0;
      // Jedes Teil zaehlt gleich, egal wie gross — man greift Stuecke, keine Quadratmeter.
      F += 1;
      R += r0 / f0;
      G += g0 / f0;
      B += b0 / f0;
      geo.dispose();
    }
    const o = oberflaeche(id);
    raus[id] = {
      teile: teile.length,
      flaeche: zuHex(R / F, G / F, B / F),
      diffus: zuHex((R / F) * (1 - o.glanz), (G / F) * (1 - o.glanz), (B / F) * (1 - o.glanz)),
      bunt: buntF / F,
      rauheit: o.rauheit,
      glanz: o.glanz,
    };
  }
  return raus;
}

function main(): void {
  const m = sortenMittel();
  const hex = (h: number): string => `#${h.toString(16).padStart(6, "0")}`;
  console.log("Sorte          Teile  Flaeche   diffus    bunt   Rauheit  Glanz");
  for (const id of SORTEN) {
    const x = m[id]!;
    console.log(
      `${NAME[id]!.padEnd(14)}${String(x.teile).padStart(5)}  ${hex(x.flaeche)}  ${hex(x.diffus)}` +
        `${(x.bunt * 100).toFixed(0).padStart(6)} %${x.rauheit.toFixed(2).padStart(9)}${x.glanz.toFixed(2).padStart(7)}`
    );
  }
  console.log("\nΔE2000 der diffusen Mittel (unter 10 = dieselbe Farbe):");
  console.log("".padEnd(14) + SORTEN.map((s) => NAME[s]!.slice(0, 8).padStart(10)).join(""));
  for (const x of SORTEN)
    console.log(
      NAME[x]!.padEnd(14) +
        SORTEN.map((y) => (x === y ? "—" : deltaEHex(m[x]!.diffus, m[y]!.diffus).toFixed(1)).padStart(10)).join("")
    );
}

// Als Werkzeug drucken, als Import im Waechter still bleiben (vite-node
// reicht den Skriptnamen nicht in `process.argv` durch, Vitest setzt VITEST).
if (!process.env.VITEST) main();
