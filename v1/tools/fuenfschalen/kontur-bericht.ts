/**
 * Der Bericht zur Konturmessung — druckt, was `kontur.ts` misst.
 *
 * Getrennt von der Messung, damit `test/zahnkontur.test.ts` die Funktionen
 * einbinden kann, ohne dass dabei eine Tabelle in die Testausgabe laeuft.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/kontur-bericht.ts
 */
import {
  schalenEnde,
  zahnAnstellung,
  zahnEigenwinkel,
} from "../../src/fuenfschalen/teile";
import { ZAHNSITZ, aussenkontur, knickBei, kontur, schulterstufe } from "./kontur";

const GRAD = 180 / Math.PI;
void schalenEnde;




function bericht(name: string, anstellung: number): void {
  const a = aussenkontur(anstellung);
  const k = kontur(anstellung);
  console.log(`\n=== ${name} — Zahn ${(anstellung * GRAD).toFixed(2)}° gegen das Schalenende ===\n`);
  const luecken = k.filter((q) => !q.aussen);
  console.log(`  Bahn: ${k.length} Stellen, davon ${luecken.length} ohne Werkstoff` +
    (luecken.length ? ` (s = ${luecken.map((q) => q.s.toFixed(2)).join(", ")})` : ""));
  console.log(`  Aussenkontur: ${a.length} Stellen, bis k = ${a[a.length - 1]!.k.toFixed(2)}`);
  console.log(`  KNICK AM ZAHNSITZ: ${knickBei(a, ZAHNSITZ).toFixed(2)}°`);
  console.log("");
  console.log("     k    r aussen   Dicke auf der Bahn");
  for (const q of a) {
    if (q.k < 5.4 || q.k > 7.0) continue;
    if (Math.round(q.k * 60) % 12 !== 0) continue;
    const d = k.find((x) => Math.abs(x.s - q.k) < 0.02);
    console.log(`  ${q.k.toFixed(2).padStart(5)}   ${q.r.toFixed(4)}   ${d ? d.dicke.toFixed(1) + " mm" : ""}`);
  }
  /*
   * Die SCHULTER — der Absatz, den das Messprotokoll vom 14.09.2026 absichtlich
   * gebaut hat (`SCHULTER_AB` 0,42 · `SCHULTER_BIS` 0,74 · `SCHULTER_VOR` 0,22)
   * und auf den Patricks gelber Kringel im Vorbildfoto zeigt. Gemessen an der
   * Dicke längs der Fersenbahn: wo verliert der Arm sein Material?
   */
  console.log("\n  Schulter — Dicke längs der Ferse (t 0 = Bolzen, 1 = Station 0)");
  const ferse = k.filter((q) => q.teil === "Ferse");
  let zeile = "   ";
  for (const q of ferse) {
    const t = q.s + 1;
    if (Math.round(t * 40) % 4 !== 0) continue;
    zeile += `${t.toFixed(1)}:${q.dicke.toFixed(0)}mm  `;
  }
  console.log(zeile);
  const s = schulterstufe(k);
  console.log(
    `   stärkster Abfall ${s.groesst.toFixed(1)} mm je Zehntel bei t = ${s.bei.toFixed(1)}, ` +
      `im Mittel ${s.mittel.toFixed(1)} mm — VERHÄLTNIS ${s.verhaeltnis.toFixed(2)}`
  );
}



function main(): void {
  console.log(`Gebaute Anstellung: ${(zahnAnstellung() * GRAD).toFixed(4)}°`);
  console.log(`Eigenbiegung des Zahns: ${(zahnEigenwinkel() * GRAD).toFixed(2)}°`);
  bericht("GEBAUT (B)", zahnAnstellung());
  bericht("VORHER (A)", zahnEigenwinkel());
  bericht("GEGENPROBE: doppelt geknickt", 2 * zahnEigenwinkel());
}

main();
