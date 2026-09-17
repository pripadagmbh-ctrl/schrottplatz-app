/**
 * ERKLAERT DER AUSFAEDEL-SPRUNG PATRICKS DURCHFALL?
 *
 *     npx vite-node tools/sprung-und-durchfall.ts
 *     npx vite-node tools/sprung-und-durchfall.ts -- --saaten=8 --nachlauf=6
 *
 * DIE FRAGE, woertlich (Patrick, 15.09.2026, nach der Reparatur des
 * Kipper-Katapults E-073): „Es ist auf jeden Fall besser, nicht alles faellt
 * durch, aber immer noch ein paar Teile."
 *
 * E-084 hat den Rangierknick als Ursache ausgeschlossen (0,0 % gegen 0,0 %).
 * Uebrig blieb der Ortssprung — und dabei ist etwas aufgefallen, das die
 * bisherige Messung wertlos macht: `test/kipperlauf.ts` bricht in dem
 * Rechenschritt ab, in dem der Wagen die Abladespur raeumt. Der Sprung von
 * `leaveUnloadingBay` (1,32 m rueckwaerts in den frischen Haufen) faellt EINEN
 * SCHRITT SPAETER. Er lag also die ganze Zeit ausserhalb des Messfensters.
 *
 * Dieses Werkzeug misst deshalb ueber die Abfahrt HINAUS (`nachlaufS`) und
 * stellt Sprung gegen Ausfaedeln — derselbe Laufapparat, dieselben Saaten,
 * dieselbe Fuhre, einziger Unterschied `faedeltAus`.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { reihe, paarweise, SAATEN, type Stand } from "../test/kipperlauf";
import { spielFuhre } from "../test/pruefkunde";

const arg = (n: string): string | null => {
  const t = process.argv.find((a) => a.startsWith(`--${n}=`));
  return t ? t.slice(n.length + 3) : null;
};

await RAPIER.init();

const saaten = SAATEN.slice(0, Number(arg("saaten") ?? SAATEN.length));
/**
 * Wie lange nach dem Raeumen der Spur noch gemessen wird (s).
 *
 * SW 6 s, hergeleitet: Der Sprung faellt im ersten Bild danach. Sechs
 * Sekunden sind bei SPEED 4,8 m/s knapp 29 m Fahrweg — der Wagen ist dann
 * laengst ueber den halben Hof und weit weg von seinem Haufen. Was in dieser
 * Zeit nicht durchgefallen ist, faellt auch nicht mehr durch.
 */
const nachlaufS = Number(arg("nachlauf") ?? 6);

const staende: Stand[] = [
  {
    name: "MESSFENSTER ALT (bis Spur frei)",
    kunde: spielFuhre,
    solverWieSpiel: true,
    ohnePause: true,
  },
  {
    name: "SPRUNG (vor 17.09.)",
    kunde: spielFuhre,
    solverWieSpiel: true,
    faedeltAus: false,
    ohnePause: true,
    nachlaufS,
  },
  {
    name: "AUSFAEDELN (gebaut)",
    kunde: spielFuhre,
    solverWieSpiel: true,
    faedeltAus: true,
    ohnePause: true,
    nachlaufS,
  },
];
const z = (x: number, n = 1): string => x.toFixed(n).padStart(8);
console.log(
  `${saaten.length} Saaten, gewuerfelte Haendlerfuhre (rollCustomer), Nachlauf ${nachlaufS} s`
);
console.log(
  "Stand                           |  Mittel  Median Hoechst km/h | durch % | frueh % | Rest % | Abstand max/mittel m"
);
const r = staende.map((s) => reihe(s, saaten));
for (const x of r) {
  console.log(
    `${x.name.padEnd(31)} |${z(x.mittel)}${z(x.median)}${z(x.hoechst)}     |` +
      `${z(x.durch * 100)} |${z(x.durchFrueh * 100)} |${z(x.rest * 100)} |` +
      `${z(x.abstandMax, 2)}${z(x.abstandMittel, 2)}`
  );
}
const d = paarweise(r[1]!, r[2]!);
console.log(
  `\nGepaart (Sprung minus Ausfaedeln): ${d.delta.toFixed(1)} +/- ${d.se.toFixed(1)} km/h, ` +
    `Sprung schlechter in ${d.besser} von ${saaten.length}`
);
console.log(
  `Durchfall beim Kippen: ${(r[1]!.durch * 100).toFixed(1)} % gegen ` +
    `${(r[2]!.durch * 100).toFixed(1)} %; vor dem Kippen: ` +
    `${(r[1]!.durchFrueh * 100).toFixed(1)} % gegen ${(r[2]!.durchFrueh * 100).toFixed(1)} %`
);
console.log(
  `Endabstand des entferntesten Stuecks: ${r[1]!.abstandMax.toFixed(2)} m gegen ` +
    `${r[2]!.abstandMax.toFixed(2)} m (Hoechstwert), ` +
    `${r[1]!.abstandMittel.toFixed(2)} gegen ${r[2]!.abstandMittel.toFixed(2)} m (Mittel)`
);
