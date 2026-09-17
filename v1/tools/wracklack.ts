/**
 * WELCHE FARBEN STEHEN AUF DEM HOF? — Sichtprobe zu `composites.wrackLack`.
 *
 * Eine Palette liest sich als Zahlenliste nicht. Dieses Werkzeug schreibt die
 * Lacke hin, die zwölf nebeneinanderliegende Standorte ergeben, jeweils roh
 * und verwittert — damit Patrick vor dem Gerätetest weiß, was er sehen müsste.
 *
 * Aufruf, aus `v1/`:
 *
 *     npx vite-node tools/wracklack.ts
 */
import { wrackLack } from "../src/dismantle/composites";
import { AUTOLACK, verwittert } from "../src/world/objektbau";

const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

console.log("Die Palette (AUTOLACK), roh und nach zehn Jahren Hof:");
for (const lack of AUTOLACK) {
  console.log(`  ${hex(lack)}  ->  ${hex(verwittert(lack, 0.55))}`);
}

console.log("\nZwoelf Standorte auf dem Hof:");
const gesehen = new Set<string>();
for (let i = 0; i < 12; i++) {
  const x = -8 + i * 1.3;
  const z = 5 - i * 0.9;
  const c = wrackLack(x, z);
  gesehen.add(hex(c));
  console.log(`  (${x.toFixed(1).padStart(5)}, ${z.toFixed(1).padStart(5)})  ${hex(c)}`);
}
console.log(`\nVerschiedene Lacke: ${gesehen.size} von 12`);
