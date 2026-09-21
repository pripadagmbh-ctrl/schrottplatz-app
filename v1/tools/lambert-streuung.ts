/**
 * WIE LANGE BRAUCHT LAMBERT WIRKLICH, bis zwei Abfallstücke in der Mulde sind?
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/lambert-streuung.ts -- [Anzahl Saaten]
 *
 * ANLASS (E-109): `test/lambertAufraeumen.test.ts` ließ ihn 120 s laufen und
 * prüfte danach, ob beide Stücke drin sind. In einem von fünf vollen
 * `npm test`-Läufen waren es nur eins. Der Verdacht lautete „Zeitschranke
 * reißt unter Last" — der Test hängt aber an keiner Wanduhr, sondern an
 * gerechneten Schritten (dt = 1/60). Was streut, ist der Zufall im
 * Produktivcode: die Gierlage frisch abgelegter Stücke
 * (`scrapItems.ts:1647`) und das Prüfintervall (`people.ts:1390`).
 *
 * Dieses Werkzeug misst die Verteilung, damit die Schranke des Wächters eine
 * Herkunft hat statt einer Schätzung.
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { abfallLauf } from "../test/lambertlauf";

const HOECHSTENS_S = Number(process.argv.find((a) => a.startsWith("bis="))?.slice(4)) || 300;

async function main(): Promise<void> {
  await initPhysics();
  const n = Number(process.argv[2]) || 40;
  // `echt` = ohne feste Saat, also so, wie der Wächter bis E-109 lief.
  const echt = process.argv.includes("echt");
  const zeiten: number[] = [];
  let nie = 0;
  for (let saat = 1; saat <= n; saat++) {
    const r = abfallLauf(echt ? 0 : saat, HOECHSTENS_S);
    if (r.fertigS === null) {
      nie++;
      console.log(`Saat ${String(saat).padStart(3)}  —  nicht fertig in ${HOECHSTENS_S} s`);
    } else {
      zeiten.push(r.fertigS);
      const tief = Math.min(...r.verlauf.filter(([t]) => t >= 25).map(([, n]) => n));
      const bei120 = r.verlauf.find(([t]) => t === 120)?.[1] ?? -1;
      console.log(
        `Saat ${String(saat).padStart(3)}  fertig ${r.fertigS.toFixed(1).padStart(6)} s  ` +
          `danach mindestens ${tief} drin, bei 120 s ${bei120}, am Ende ${r.amEnde}`
      );
    }
  }
  const s = [...zeiten].sort((a, b) => a - b);
  const mittel = zeiten.reduce((a, b) => a + b, 0) / Math.max(1, zeiten.length);
  const p = (q: number): number => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? NaN;
  console.log("");
  console.log(`Saaten ${n}, davon nie fertig: ${nie}`);
  console.log(
    `min ${s[0]?.toFixed(1)}  Median ${p(0.5).toFixed(1)}  Mittel ${mittel.toFixed(1)}  ` +
      `p90 ${p(0.9).toFixed(1)}  max ${s[s.length - 1]?.toFixed(1)} s`
  );
  for (const grenze of [60, 90, 120, 150, 180, 240]) {
    const drin = s.filter((x) => x <= grenze).length;
    console.log(
      `  bis ${String(grenze).padStart(3)} s fertig: ${drin}/${zeiten.length} ` +
        `(${((drin / Math.max(1, zeiten.length)) * 100).toFixed(0)} %)`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
