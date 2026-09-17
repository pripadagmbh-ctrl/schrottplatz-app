/**
 * WIEVIEL LUFT BRAUCHT DIE FUHRE? — Messreihe zu `ladung.LUFT` (E-105).
 *
 * Seit die Ladung ihr wirkliches Rechteck belegt und nicht mehr ein Quadrat
 * ihrer Grundriss-Diagonale, liegen die Stücke dicht an dicht. Zu dicht:
 * `test/kipper.test.ts` wurde rot. Dieses Werkzeug fährt dieselbe Messreihe
 * wie der Wächter und schreibt die Zahlen hin, statt sie nur zu bewerten —
 * damit im Log steht, WARUM 0,12 m und nicht 0,06 m.
 *
 * `LUFT` ist eine Konstante im Modul und lässt sich von außen nicht drehen;
 * dieses Werkzeug misst deshalb den JEWEILS GEBAUTEN Stand. Für eine Reihe
 * den Wert in `ladung.ts` ändern und erneut laufen lassen.
 *
 * Aufruf, aus `v1/`:
 *
 *     npx vite-node tools/kipp-luft.ts
 */
import { initPhysics } from "../src/physics/physicsWorld";
import { spielFuhre } from "../test/pruefkunde";
import { SAATEN, reihe } from "../test/kipperlauf";

async function main(): Promise<void> {
  await initPhysics();
  const r = reihe({ name: "gewuerfelte Haendlerfuhre", kunde: spielFuhre }, SAATEN);
  console.log(`Saaten: ${SAATEN.length}   Stuecke auf der Flaeche: ${r.teile}   Masse: ${r.masseKg} kg`);
  console.log(`Tempo  Mittel ${r.mittel.toFixed(0)} / Median ${r.median.toFixed(0)} / Hoechst ${r.hoechst.toFixed(0)} km/h`);
  console.log(`       Schranke des Waechters: 55 / 40 / 200`);
  console.log(`Durchfall ${(r.durch * 100).toFixed(0)} %   (erlaubt 10 %)`);
  console.log(`Liegt am Ende noch auf der Bruecke: ${(r.rest * 100).toFixed(0)} %   (erlaubt 45 %)`);
  console.log(`Endabstand Mittel ${r.abstandMittel.toFixed(1)} m / Hoechst ${r.abstandMax.toFixed(1)} m   (erlaubt 12 m)`);
  console.log(`Einzelwerte: ${r.werte.map((w) => w.toFixed(0)).join(" ")}`);
}

void main();
