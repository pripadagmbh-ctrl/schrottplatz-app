/**
 * DAS MESSGERÄT FÜR DEN KIPPER — ab jetzt gibt es genau eines.
 *
 *     npx vite-node tools/kipper-messreihe.ts
 *     npx vite-node tools/kipper-messreihe.ts -- --saaten=8
 *
 * ANLASS (15.09.2026, E-062). Zwei Geräte haben denselben Vorgang gemessen,
 * mit denselben 24 Saaten, und sich um den Faktor zwei widersprochen — 149/463
 * gegen 122/228 km/h. Beide waren deterministisch, beide waren grün, beide
 * haben ihre Zahl in eine Entscheidung geschrieben. Das ist schlimmer als gar
 * nicht zu messen: Man kann sich die Zahl aussuchen, die passt.
 *
 * SEIT E-071 STEHT DER LAUFAPPARAT NICHT MEHR HIER, sondern in
 * `test/kipperlauf.ts` — Wächter und Werkzeug fahren jetzt denselben Ablauf.
 * Hier steht nur noch, was gegen was gestellt und wie es gedruckt wird.
 *
 * DREI REGELN, DIE DIESES WERKZEUG EINHÄLT:
 *
 *   1. NULLPROBE ZUERST. Wer eine Größe verstellen kann, muss zeigen, dass er
 *      sie auf den gebauten Wert gestellt dasselbe misst wie „gar nicht
 *      angefasst". Ein Gerät, das seinen eigenen Nullpunkt verfehlt, misst
 *      nichts. Läuft vor jeder Reihe.
 *   2. DIE FUHRE KOMMT AUS EINER QUELLE (`test/pruefkunde.ts`). Füllgrad ODER
 *      Masse wird vorgegeben, nie beides — die andere Zahl folgt aus der
 *      Spielregel Masse = Füllgrad × Laderaum × Schüttdichte (E-033). Die
 *      gewürfelte Händlerfuhre kommt über `spielFuhre()` aus `rollCustomer()`,
 *      also aus derselben Quelle wie im Spiel.
 *   3. GEPAARTE VERGLEICHE. Kollider werden am FERTIGEN Körper gestellt, nicht
 *      im Quelltext. Ein Eingriff in `vehicles.ts` verschiebt den Zufallsstrom
 *      und würfelt eine andere Ladung — dann vergleicht man Rauschen.
 *
 * Es steht bewusst in `tools/` und nicht in `test/`: Es behauptet nichts, es
 * berichtet. Der Wächter mit den Schranken ist `test/kipper.test.ts`.
 * `tsconfig.test.json` prüft diese Datei bei jedem `npm test` mit, damit sie
 * nicht still verrottet.
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { BRUECKE_DICKE_VORN, BRUECKE_DICKE_HINTEN } from "../src/delivery/vehicleModel";
import { TIP_ANGLE } from "../src/delivery/routes";
import type { CustomerProfile } from "../src/delivery/customers";
import { pruefKunde, spielFuhre } from "../test/pruefkunde";
import { SAATEN, reihe, paarweise, type Reihe, type Stand } from "../test/kipperlauf";

function zeile(r: Reihe): string {
  return (
    `${r.name.padEnd(34)} Mittel ${r.mittel.toFixed(0).padStart(4)}` +
    `  Median ${r.median.toFixed(0).padStart(4)}  Hoechst ${r.hoechst.toFixed(0).padStart(4)}` +
    `  | liegt ${(r.rest * 100).toFixed(0).padStart(3)}%  durch ${(r.durch * 100).toFixed(0).padStart(3)}%` +
    `  | Endabstand ${r.abstandMittel.toFixed(1)}/${r.abstandMax.toFixed(1)} m` +
    `  | ${r.teile.toFixed(1)} Stk  ${r.masseKg.toFixed(0)} kg  Fuell ${r.fuellgrad.toFixed(2)}`
  );
}

/**
 * NULLPROBE: Der Eingriff auf den GEBAUTEN Wert gestellt muss dasselbe messen
 * wie kein Eingriff.
 *
 * Geprüft wird `muldeNeuAnmelden` — das tut `vehicles.releaseCargo` seit E-071
 * selbst, der Eingriff also ein zweites Mal, und zweimal darf nicht anders
 * messen als einmal. Er arbeitet an Ort und Stelle und ist deshalb bitgleich.
 *
 * NICHT geprüft wird `keil`: Der schaltet den gebauten Kollider ab und trägt
 * einen neuen ein, der eine andere Nummer bekommt und in anderer Reihenfolge
 * gelöst wird. Auf dieselbe Form gestellt kommt deshalb eine andere Reihe
 * heraus — nicht weil sich etwas geändert hätte, sondern weil Kippen chaotisch
 * ist. Zur Anschauung wird er trotzdem mitgedruckt.
 */
function nullprobe(saaten: number[]): boolean {
  const kunde = (): CustomerProfile => pruefKunde({ massKg: 5000, vehicle: "kipper" });
  const ohne = reihe({ name: "N0 ohne Eingriff", kunde }, saaten);
  const anm = reihe({ name: "N1 noch einmal neu angemeldet", kunde, muldeNeuAnmelden: true }, saaten);
  const form = reihe(
    {
      name: "   (Keil noch einmal gesetzt)",
      kunde,
      keil: { vorn: BRUECKE_DICKE_VORN, hinten: BRUECKE_DICKE_HINTEN },
    },
    saaten
  );
  for (const r of [ohne, anm, form]) console.log(zeile(r));
  const ok = ohne.werte.every((x, i) => Math.abs(x - anm.werte[i]!) < 1e-9);
  console.log(
    ok ? "  NULLPROBE bestanden\n" : "  NULLPROBE FEHLGESCHLAGEN — alles darunter ist wertlos\n"
  );
  return ok;
}

function hauptlauf(): void {
  const n = Number(process.argv.find((a) => /^--saaten=/.test(a))?.split("=")[1] ?? 0);
  const saaten = n > 0 ? SAATEN.slice(0, n) : SAATEN;
  const grad = ((TIP_ANGLE * 180) / Math.PI).toFixed(1);
  console.log(`Kipper, ${saaten.length} Saaten, km/h — Kippwinkel ${grad} Grad\n`);
  if (!nullprobe(saaten)) return;

  const gruppen: Array<[string, () => CustomerProfile]> = [
    ["Pruefladung 5000 kg", () => pruefKunde({ massKg: 5000, vehicle: "kipper" })],
    ["gewuerfelte Haendlerfuhre", spielFuhre],
  ];
  for (const [gname, kunde] of gruppen) {
    console.log(`\n### ${gname}`);
    const staende: Stand[] = [
      { name: "gebaut: Keil 0,60/0,12", kunde },
      { name: "Quader 0,60 (Form vor E-071)", kunde, keil: { vorn: 0.6, hinten: 0.6 } },
      { name: "Quader 0,16 (E-062)", kunde, keil: { vorn: 0.16, hinten: 0.16 } },
      { name: "GEGENPROBE: Bruecke koerperlos", kunde, brueckeAbschalten: true },
    ];
    const ergebnisse = staende.map((s) => reihe(s, saaten));
    for (const r of ergebnisse) console.log(zeile(r));
    console.log("Paarweise gegen den gebauten Stand (positiv = gebaut ist schlechter):");
    for (const r of ergebnisse.slice(1)) {
      const p = paarweise(ergebnisse[0]!, r);
      console.log(
        `  ${r.name.padEnd(34)} ${p.delta.toFixed(0).padStart(5)} +/- ${p.se.toFixed(0)} km/h` +
          `  · besser in ${p.besser} von ${saaten.length}`
      );
    }
  }
}

await initPhysics();
hauptlauf();
