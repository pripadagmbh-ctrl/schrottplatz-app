import { CONFIGS } from "../src/world/containers";
const B = { x: -2.5, z: -19.5 };
function dist(x: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i <= 20; i++) d = Math.min(d, Math.hypot(x - B.x, z - (B.z + (5 * i) / 20)));
  return d;
}
console.log("Objekt              Position        Groesse      Abstand Bagger");
for (const c of CONFIGS) {
  console.log(
    `${c.label.padEnd(18)} (${c.x.toFixed(1).padStart(6)} |${c.z.toFixed(1).padStart(6)})  ${c.size[0]!.toFixed(1)} x ${c.size[1]!.toFixed(1)}   ${dist(c.x, c.z).toFixed(1)} m`
  );
}
console.log("\nUeberschneidungen:");
let n = 0;
for (let i = 0; i < CONFIGS.length; i++) {
  for (let j = i + 1; j < CONFIGS.length; j++) {
    const a = CONFIGS[i]!;
    const b = CONFIGS[j]!;
    const dx = Math.abs(a.x - b.x) - (a.size[0]! + b.size[0]!) / 2;
    const dz = Math.abs(a.z - b.z) - (a.size[1]! + b.size[1]!) / 2;
    if (dx < 0 && dz < 0) {
      console.log(`  ${a.label} / ${b.label}: ${(-Math.max(dx, dz)).toFixed(2)} m Ueberlappung`);
      n++;
    }
  }
}
console.log(n === 0 ? "  keine" : `  ${n} Stueck`);
