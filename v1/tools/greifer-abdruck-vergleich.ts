/**
 * Zwei Abdruecke der Sichelkralle gegeneinanderhalten (siehe
 * `tools/greifer-abdruck.ts`).
 *
 * Aufruf:  npx vite-node tools/greifer-abdruck-vergleich.ts alt.json neu.json
 */
import { readFileSync } from "node:fs";

interface Abdruck {
  netze: string[];
  bewegung: number[];
  kollider: number[];
  korb: number[];
}

const [, , aPfad, bPfad] = process.argv;
if (!aPfad || !bPfad) throw new Error("zwei Dateien angeben");
const a = JSON.parse(readFileSync(aPfad, "utf8")) as Abdruck;
const b = JSON.parse(readFileSync(bPfad, "utf8")) as Abdruck;

function zahlen(name: string, x: number[], y: number[]): void {
  if (x.length !== y.length) {
    console.log(`${name}: VERSCHIEDEN LANG — ${x.length} gegen ${y.length}`);
    return;
  }
  let groesste = 0;
  let wo = -1;
  for (let i = 0; i < x.length; i++) {
    const d = Math.abs(x[i]! - y[i]!);
    if (d > groesste) {
      groesste = d;
      wo = i;
    }
  }
  console.log(
    `${name}: ${x.length} Werte, groesster Unterschied ${groesste.toExponential(3)}` +
      (wo >= 0 && groesste > 0 ? ` an Stelle ${wo} (${x[wo]} gegen ${y[wo]})` : "")
  );
}

console.log(
  `Netze: ${a.netze.length} gegen ${b.netze.length}, Reihenfolge und Art ${
    a.netze.join("|") === b.netze.join("|") ? "gleich" : "VERSCHIEDEN"
  }`
);
zahlen("Bewegung", a.bewegung, b.bewegung);
zahlen("Kollider", a.kollider, b.kollider);
zahlen("Korb", a.korb, b.korb);
