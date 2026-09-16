/**
 * DER ZWEITE SPRUNG: `nearestS` setzt den Wagen auf die Strecke — mit einem Satz.
 *
 *     npx vite-node tools/einfaedeln.ts
 *
 * E-081 hat die DREHUNG gefuehrt. Es gibt aber noch einen Versatz, und der
 * ist ein ORTSsprung: An zwei Stellen faengt ein Fahrzeug eine Strecke nicht
 * an ihrem Anfang an, sondern dort, wo es ihr gerade am naechsten steht
 * (`vehicles.nearestS`):
 *
 *   `parked` → `out`   der Wagen steht auf einem Warteplatz und faehrt ab
 *   `nudge()`          der Bagger bittet einen Wartenden, ein Stueck
 *                      weiterzurollen
 *
 * `nearestS` liefert die Bogenlaenge des naechsten Punktes, und der naechste
 * Schritt setzt den Wagen genau dorthin — quer ueber den Abstand, der
 * dazwischen liegt. Dieses Werkzeug misst diesen Abstand je Warteplatz.
 *
 * Es AENDERT NICHTS. Ob der Sprung gross genug ist, um etwas anzurichten, ist
 * eine Entscheidung; die Zahl dafuer steht hier.
 */
import { PARK_SLOTS, routeOut, neueAbladestelle } from "../src/delivery/routes";

neueAbladestelle();
const route = routeOut();

/** Naechster Punkt auf der Polylinie — dieselbe Rechnung wie `vehicles.nearestS`. */
function naechster(px: number, pz: number): { x: number; z: number; d: number } {
  let best = { x: route[0]![0], z: route[0]![1], d: Infinity };
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i]!;
    const [bx, bz] = route[i + 1]!;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len * len)));
    const x = ax + dx * t;
    const z = az + dz * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < best.d) best = { x, z, d };
  }
  return best;
}

console.log("Warteplatz        | naechster Punkt der Ausfahrt | Ortssprung");
for (const [i, p] of PARK_SLOTS.entries()) {
  const n = naechster(p[0], p[1]);
  console.log(
    `${i + 1}: (${p[0].toFixed(1)} | ${p[1].toFixed(1)})   ` +
      `| (${n.x.toFixed(2)} | ${n.z.toFixed(2)})        | ${n.d.toFixed(2)} m`
  );
}
