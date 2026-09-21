/**
 * WIE STABIL SIND DIE DREI KIPPER-ZAHLEN? — Mittel, Median, Höchstwert.
 *
 * Aufruf aus `v1/`:
 *
 *     npx vite-node tools/kipper-streuung.ts -- [Anzahl Saaten]
 *
 * ANLASS (E-076, ausgeführt in E-109): `test/kipper.test.ts` urteilt über 24
 * feste Saaten. Jedes `THREE.Object3D` zieht beim Anlegen vier Zufallszahlen
 * (`MathUtils.generateUUID`) aus demselben Strom, aus dem auch die Ladung
 * gewürfelt wird — ein Netz mehr oder weniger am Lkw verschiebt den Strom und
 * würfelt 24 ANDERE Fuhren. Die 24 Saaten sind also keine 24 festen Ladungen,
 * sondern 24 Stichproben aus einer chaotischen Größe, und sie wechseln bei
 * jedem Umbau, der irgendwo ein Netz anlegt.
 *
 * Dieses Werkzeug misst, wie weit eine solche Stichprobe streut: Es fährt N
 * frische Saaten und zieht daraus per Ziehen-mit-Zurücklegen viele Gruppen zu
 * 24. Für jede Gruppe werden Mittel, Median und Höchstwert gebildet. Was dabei
 * herauskommt, ist die Antwort auf die einzige Frage, die zählt: Wie oft wird
 * ein Wächter rot, ohne dass sich am Spiel etwas geändert hat?
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { spielFuhre } from "../test/pruefkunde";
import { lauf } from "../test/kipperlauf";

const GRUPPE = 24;
const ZIEHUNGEN = 20000;

const mittelwert = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
};
const p = (a: number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};

async function main(): Promise<void> {
  await initPhysics();
  const n = Number(process.argv[2]) || 96;
  /*
   * FRISCHE SAATEN, nicht die 24 aus `SAATEN`: Die Frage ist ja gerade, wie
   * eine BELIEBIGE Stichprobe von 24 ausfällt.
   */
  const werte: number[] = [];
  const abstaende: number[] = [];
  const durchfall: number[] = [];
  const liegt: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = lauf({ name: "streuung", kunde: spielFuhre }, 100000 + i);
    werte.push(r.vmaxKmh);
    abstaende.push(r.endAbstand);
    durchfall.push(r.durchAnteil);
    liegt.push(r.restAnteil);
    if ((i + 1) % 12 === 0) console.log(`  ${i + 1}/${n} …`);
  }
  const s = [...werte].sort((a, b) => a - b);
  console.log("");
  console.log(`EINZELLÄUFE (${n} frische Saaten), km/h:`);
  console.log(
    `  min ${s[0]!.toFixed(0)}  Median ${median(werte).toFixed(0)}  Mittel ${mittelwert(werte).toFixed(0)}  ` +
      `p90 ${p(werte, 0.9).toFixed(0)}  p99 ${p(werte, 0.99).toFixed(0)}  max ${s[s.length - 1]!.toFixed(0)}`
  );
  console.log(`  die zehn höchsten: ${s.slice(-10).map((x) => x.toFixed(0)).join(" ")}`);

  const zeile = (name: string, a: number[], einheit = ""): void =>
    console.log(
      `  ${name.padEnd(12)} p01 ${p(a, 0.01).toFixed(1).padStart(6)}  p05 ${p(a, 0.05).toFixed(1).padStart(6)}` +
        `  Median ${median(a).toFixed(1).padStart(6)}  p95 ${p(a, 0.95).toFixed(1).padStart(6)}` +
        `  p99 ${p(a, 0.99).toFixed(1).padStart(6)}  max ${Math.max(...a).toFixed(1).padStart(7)}${einheit}` +
        `  | p99/p05 = ${(p(a, 0.99) / Math.max(0.01, p(a, 0.05))).toFixed(2)}`
    );
  const quote = (a: number[], grenze: number): string =>
    `${((a.filter((x) => x >= grenze).length / a.length) * 100).toFixed(2).padStart(6)} %`;

  /*
   * ZIEHEN MIT ZURUECKLEGEN: so viele Gruppen zu 24 (und zu 48), wie es
   * Stichproben gaebe. Jede Gruppe ist ein moeglicher Wächterlauf nach einem
   * Umbau, der den Zufallsstrom verschoben hat.
   */
  for (const gr of [GRUPPE, GRUPPE * 2, GRUPPE * 4]) {
    const gm: number[] = [];
    const gmed: number[] = [];
    const gh: number[] = [];
    const g75: number[] = [];
    const g90: number[] = [];
    const gab: number[] = [];
    const gdurch: number[] = [];
    const gliegt: number[] = [];
    for (let k = 0; k < ZIEHUNGEN; k++) {
      const g: number[] = [];
      const a: number[] = [];
      const d: number[] = [];
      const l: number[] = [];
      for (let j = 0; j < gr; j++) {
        const i = Math.floor(Math.random() * werte.length);
        g.push(werte[i]!);
        a.push(abstaende[i]!);
        d.push(durchfall[i]!);
        l.push(liegt[i]!);
      }
      gm.push(mittelwert(g));
      gmed.push(median(g));
      gh.push(Math.max(...g));
      g75.push(p(g, 0.75));
      g90.push(p(g, 0.9));
      gab.push(Math.max(...a));
      gdurch.push(mittelwert(d));
      gliegt.push(mittelwert(l));
    }
    console.log("");
    console.log(`GRUPPEN ZU ${gr} (${ZIEHUNGEN} Ziehungen), km/h:`);
    zeile("Mittel", gm);
    zeile("Median", gmed);
    zeile("p75", g75);
    zeile("p90", g90);
    zeile("Hoechst", gh);
    zeile("Endabst. max", gab, " m");
    zeile("durch %", gdurch.map((x) => x * 100));
    zeile("liegt %", gliegt.map((x) => x * 100));
    console.log("  wie oft reisst eine Schranke, ohne dass sich etwas geaendert hat:");
    for (const s of [55, 70, 90]) console.log(`    Mittel  >= ${String(s).padStart(4)}: ${quote(gm, s)}`);
    for (const s of [40, 50]) console.log(`    Median  >= ${String(s).padStart(4)}: ${quote(gmed, s)}`);
    for (const s of [60, 80, 100]) console.log(`    p75     >= ${String(s).padStart(4)}: ${quote(g75, s)}`);
    for (const s of [100, 140, 180]) console.log(`    p90     >= ${String(s).padStart(4)}: ${quote(g90, s)}`);
    for (const s of [280, 400, 600]) console.log(`    Hoechst >= ${String(s).padStart(4)}: ${quote(gh, s)}`);
    for (const s of [12, 16, 20]) console.log(`    Endabst >= ${String(s).padStart(4)}: ${quote(gab, s)}`);
    for (const s of [0.1, 0.05]) console.log(`    durch   >= ${String(s).padStart(4)}: ${quote(gdurch, s)}`);
    for (const s of [0.45, 0.4]) console.log(`    liegt   >= ${String(s).padStart(4)}: ${quote(gliegt, s)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
