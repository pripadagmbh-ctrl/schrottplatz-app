/**
 * ERKLAERT DER RANGIERKNICK PATRICKS DURCHFALL?
 *
 *     npx vite-node tools/knick-und-durchfall.ts
 *     npx vite-node tools/knick-und-durchfall.ts -- --saaten=8
 *
 * DIE FRAGE, woertlich (Patrick, 15.09.2026, nach der Reparatur des
 * Kipper-Katapults E-073): „Es ist auf jeden Fall besser, nicht alles faellt
 * durch, aber immer noch ein paar Teile."
 *
 * Gemessen war der Durchfall danach 0 %. Der Rangierknick war der beste
 * verbliebene Kandidat: Waehrend der Fahrt haengt die Fuhre KINEMATISCH an der
 * Mulde (`lockToBed`), und bei einem Knick von 168,7 Grad in einem
 * Rechenschritt legt ein Stueck in 3 m Abstand rund 6 m in einem Bild zurueck.
 * Wenn das die Paarung zwischen Ladung und Muldenboden zerreisst, muesste sich
 * der Durchfall mit der Reparatur aendern.
 *
 * Dieses Werkzeug stellt genau diese beiden Staende gegeneinander — derselbe
 * Laufapparat (`test/kipperlauf.ts`), dieselben Saaten, dieselbe Fuhre. Der
 * einzige Unterschied ist die Lenkrate.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { reihe, paarweise, SAATEN, type Stand } from "../test/kipperlauf";
import { spielFuhre } from "../test/pruefkunde";
import { LENK_RATE } from "../src/delivery/lenkung";

const arg = (n: string): string | null => {
  const t = process.argv.find((a) => a.startsWith(`--${n}=`));
  return t ? t.slice(n.length + 3) : null;
};

await RAPIER.init();

const saaten = SAATEN.slice(0, Number(arg("saaten") ?? SAATEN.length));
const staende: Stand[] = [
  { name: "SPRUNG (vor 16.09.)", kunde: spielFuhre, solverWieSpiel: true, lenkrate: Infinity },
  { name: `EINLENKEN (${LENK_RATE})`, kunde: spielFuhre, solverWieSpiel: true },
];
const z = (x: number, n = 1): string => x.toFixed(n).padStart(8);
console.log(`${saaten.length} Saaten, gewuerfelte Haendlerfuhre (rollCustomer)`);
console.log(
  "Stand                |  Mittel  Median Hoechst km/h | durch % | frueh % | Rest % | Abstand max/mittel m"
);
const r = staende.map((s) => reihe(s, saaten));
for (const x of r) {
  console.log(
    `${x.name.padEnd(20)} |${z(x.mittel)}${z(x.median)}${z(x.hoechst)}     |` +
      `${z(x.durch * 100)} |${z(x.durchFrueh * 100)} |${z(x.rest * 100)} |` +
      `${z(x.abstandMax, 2)}${z(x.abstandMittel, 2)}`
  );
}
const d = paarweise(r[0]!, r[1]!);
console.log(
  `\nGepaart (Sprung minus Einlenken): ${d.delta.toFixed(1)} +/- ${d.se.toFixed(1)} km/h, ` +
    `Sprung schlechter in ${d.besser} von ${saaten.length}`
);
console.log(
  `Durchfall beim Kippen: ${(r[0]!.durch * 100).toFixed(1)} % gegen ` +
    `${(r[1]!.durch * 100).toFixed(1)} %; vor dem Kippen: ` +
    `${(r[0]!.durchFrueh * 100).toFixed(1)} % gegen ${(r[1]!.durchFrueh * 100).toFixed(1)} %`
);
