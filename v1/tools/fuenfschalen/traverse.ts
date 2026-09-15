/**
 * Die Tabellen zur Traversenfrage — druckt, was `traverse-rechnen.ts` rechnet.
 *
 * Getrennt von der Rechnung, damit `traverse-blatt.ts` die Funktionen
 * importieren kann, ohne dass dabei eine Tabelle in die Ausgabe laeuft.
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/traverse.ts
 */
import {
  VOR_E039,
  alleZu,
  arbeitspunkt,
  aufnahmeFuer,
  haeltVertrag,
  kennwerte,
  staerkste,
  traverseAus,
} from "./traverse-rechnen";

const DURCHMESSER: number[] = [];
for (let i = 0; i <= 12; i++) DURCHMESSER.push(Math.round((0.7 + i * 0.05) * 100) / 100);

function main(): void {
  const h = kennwerte(VOR_E039);
  console.log("1  Der Stand bis E-039 (bis 15.09.2026 gebaut)");
  console.log(
    `   Ø ${traverseAus(VOR_E039.Zr).toFixed(2)}  Neigung ${h.neigungZu.toFixed(2)}°/${h.neigungOffen.toFixed(2)}° ` +
      `(max ${h.neigungMax.toFixed(2)}°)  Hebel ${h.hebelZu.toFixed(4)}/${h.hebelOffen.toFixed(4)} ` +
      `(min ${h.hebelMin.toFixed(4)})  Zyl ${h.laengeZu.toFixed(3)}/${h.laengeOffen.toFixed(3)} Hub ${h.hub.toFixed(3)}`
  );
  console.log("");

  console.log("2  Nur der Durchmesser — sonst alles wie bis E-039 (Zy −0,730, Ay 0, Az 0,310)");
  console.log("   Ø      Neigung zu/offen/max      Hebel zu/offen/min           Zyl zu/offen   Vertrag");
  for (const D of DURCHMESSER) {
    const k = kennwerte({ ...VOR_E039, Zr: aufnahmeFuer(D) });
    console.log(
      `  ${D.toFixed(2)}   ${k.neigungZu.toFixed(2)}°/${k.neigungOffen.toFixed(2)}°/${k.neigungMax.toFixed(2)}°`.padEnd(
        32
      ) +
        `${k.hebelZu.toFixed(4)}/${k.hebelOffen.toFixed(4)}/${k.hebelMin.toFixed(4)}`.padEnd(29) +
        `${k.laengeZu.toFixed(3)}/${k.laengeOffen.toFixed(3)}   ${haeltVertrag(k) ? "ok" : "NEIN"}`
    );
  }
  console.log("");

  console.log("3  Durchmesser + Schalenauge, Aufnahmehoehe FEST auf −0,730 (Traverse bleibt, wo sie ist)");
  console.log("   Ø      Ay     Az      Neigung zu/offen/max      Hebel zu/offen/min");
  for (const D of DURCHMESSER) {
    const l = arbeitspunkt(aufnahmeFuer(D), 0.1, VOR_E039.Zy);
    if (!l) {
      console.log(`  ${D.toFixed(2)}   — nichts mit Hebel > 0,10 —`);
      continue;
    }
    console.log(
      `  ${D.toFixed(2)}   ${l.a.Ay.toFixed(2).padStart(5)}  ${l.a.Az.toFixed(3)}   ` +
        `${l.k.neigungZu.toFixed(2)}°/${l.k.neigungOffen.toFixed(2)}°/${l.k.neigungMax.toFixed(2)}°`.padEnd(26) +
        `${l.k.hebelZu.toFixed(4)}/${l.k.hebelOffen.toFixed(4)}/${l.k.hebelMin.toFixed(4)}`
    );
  }
  console.log("");

  console.log("4  Durchmesser + Schalenauge + Aufnahmehoehe frei (die 4.567er Suche, je Ø)");
  console.log("   Ø      Zy      Ay     Az      Neigung zu/offen/max      Hebel zu/offen/min   beide Ziele");
  for (const D of DURCHMESSER) {
    const l = arbeitspunkt(aufnahmeFuer(D));
    if (!l) {
      console.log(`  ${D.toFixed(2)}   — nichts mit Hebel > 0,10 —`);
      continue;
    }
    console.log(
      `  ${D.toFixed(2)}   ${l.a.Zy.toFixed(3)}  ${l.a.Ay.toFixed(2).padStart(5)}  ${l.a.Az.toFixed(3)}   ` +
        `${l.k.neigungZu.toFixed(2)}°/${l.k.neigungOffen.toFixed(2)}°/${l.k.neigungMax.toFixed(2)}°`.padEnd(26) +
        `${l.k.hebelZu.toFixed(4)}/${l.k.hebelOffen.toFixed(4)}/${l.k.hebelMin.toFixed(4)}   ` +
        (l.k.neigungMax < 20 ? "JA" : "nein")
    );
  }
  console.log("");

  console.log("5  Groesster Hebelarm je Durchmesser (was an Schliesskraft ueberhaupt drin ist)");
  for (const D of DURCHMESSER) {
    const l = staerkste(aufnahmeFuer(D));
    console.log(
      `  ${D.toFixed(2)}   Hebel ${l.k.hebelMin.toFixed(4)} m bei Neigung ${l.k.neigungMax.toFixed(2)}°  ` +
        `(Zy ${l.a.Zy.toFixed(3)} Ay ${l.a.Ay.toFixed(2)} Az ${l.a.Az.toFixed(3)})`
    );
  }
  console.log("");

  /*
   * Was kostet es, das Schalenauge auf dem Gussteil zu lassen?
   *
   * `Ay` verschiebt das Auge LAENGS der Schale, weg vom Bolzen. Alles ausser
   * null heisst: angeschweisste Konsole statt Auge im Guss — und E-013 hat den
   * Zinken gerade erst zu EINEM Gussstueck gemacht. Darum getrennt ausgewiesen.
   */
  console.log("6  Dasselbe, aber das Auge bleibt im Guss (Ay = 0)");
  console.log("   Ø      Zy      Az      Neigung zu/offen/max      Hebel zu/offen/min   beide Ziele");
  for (const D of DURCHMESSER) {
    const alle = alleZu(aufnahmeFuer(D)).filter(
      (l) => Math.abs(l.a.Ay) < 1e-9 && l.k.hebelMin > 0.1
    );
    if (alle.length === 0) {
      console.log(`  ${D.toFixed(2)}   — nichts mit Ay 0 und Hebel > 0,10 —`);
      continue;
    }
    const flach = Math.min(...alle.map((l) => l.k.neigungMax));
    const l = alle
      .filter((x) => x.k.neigungMax <= flach + 0.1)
      .reduce((a, b) => (b.k.hebelMin > a.k.hebelMin ? b : a));
    console.log(
      `  ${D.toFixed(2)}   ${l.a.Zy.toFixed(3)}  ${l.a.Az.toFixed(3)}   ` +
        `${l.k.neigungZu.toFixed(2)}°/${l.k.neigungOffen.toFixed(2)}°/${l.k.neigungMax.toFixed(2)}°`.padEnd(26) +
        `${l.k.hebelZu.toFixed(4)}/${l.k.hebelOffen.toFixed(4)}/${l.k.hebelMin.toFixed(4)}   ` +
        (l.k.neigungMax < 20 ? "JA" : "nein")
    );
  }
}

main();

