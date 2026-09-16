/**
 * WIE SCHNELL DARF GELENKT WERDEN — die Tabelle hinter der Zahl.
 *
 *     npx vite-node tools/lenkrate.ts
 *
 * Zwei Stellschrauben, und sie ziehen gegeneinander:
 *
 *   LENKRATE   Je langsamer gelenkt wird, desto kleiner der Sprung je
 *              Rechenschritt — und desto weiter laeuft der Wagen mit schraeg
 *              stehendem Umriss aus der Bahn. Zu langsam heisst: er faehrt
 *              wie ein Schiff und schiebt seine Ecke in die Mauer.
 *   PIVOT_AB   Ab welchem Restwinkel er stehen bleibt und sich eindreht,
 *              statt im Fahren nachzuziehen. Klein heisst: dreht sich an
 *              jeder Ecke auf der Stelle (sieht aus wie ein Gabelstapler,
 *              braucht aber nur einen Kreis Platz). Gross heisst: zieht alles
 *              im Fahren nach und braucht Kurvenraum.
 *
 * Gedruckt wird ueber ALLE Fahrplaene das jeweils Schlimmste: der schaerfste
 * Knick, der weiteste Ecksprung, die tiefste Durchdringung eines Bauwerks und
 * die laengste Fahrzeit. Die Durchdringung ist die Spalte, die entscheidet —
 * ein Fahrbild, das durch die Mauer geht, ist keins.
 */
import { fahrplaene } from "../test/strecken";
import { fahre } from "../test/knicklauf";

const plaene = fahrplaene();
const zeilen: string[] = [];
zeilen.push(
  "Rate rad/s | Voraus m | Eindrehen ab | Grad/Schritt | Sprung m | Tiefe m | Dauer s | Stellen"
);
for (const rate of [0.4, 0.6, 0.85, 1.2, 2.0, 3.0, Infinity]) {
  for (const vor of [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
    const pa = 1.75;
    const r = plaene.map((p) => fahre(p, { lenkrate: rate, pivotAb: pa, vorausM: vor }));
    const mg = Math.max(...r.map((x) => x.maxGrad));
    const ms = Math.max(...r.map((x) => x.maxSprungM));
    const mt = Math.max(...r.map((x) => x.maxTiefeM));
    const md = Math.max(...r.map((x) => x.dauerS));
    const na = new Set(
      r.flatMap((x) => x.anstoesse.map((a) => `${a.etappe}|${a.bauwerk}`))
    ).size;
    zeilen.push(
      `${String(rate).padStart(10)} | ${vor.toFixed(1).padStart(8)} | ` +
        `${((pa * 180) / Math.PI).toFixed(0).padStart(9)} Grad | ` +
        `${mg.toFixed(2).padStart(12)} | ${ms.toFixed(3).padStart(8)} | ${mt
          .toFixed(2)
          .padStart(7)} | ${md.toFixed(1).padStart(7)} | ${na}`
    );
  }
}
console.log(zeilen.join("\n"));
