/**
 * STECKEN AM LKW ZWEI TEILE INEINANDER — und wenn ja, wie tief?
 *
 * Anlass, wörtlich (Patrick, 13.09.2026): „Also ich habe mir nochmal den
 * Kipper angeguckt. Die Ladefläche geht … durch. … dass die Ladefläche durch
 * den Kran läuft, wenn es einen Kran gibt."
 *
 * Zwei Tage lang ist das liegengeblieben, und der Grund ist banal: Es hat
 * niemand gemessen, weil es nichts gab, womit man es hätte messen können. Ein
 * Durchdringungsfehler ist nicht sichtbar, wenn man ihn nicht sucht — die
 * Überschneidung von Kranbock und Muldenboden ist 12 cm hoch und liegt UNTER
 * dem Blech. Zu sehen ist sie erst, wenn der Kipper kippt.
 *
 * Gerechnet wird in `tools/fahrzeugteile.ts` (Paare und Stellungen) und
 * `tools/durchdringung.ts` (Trennachsensatz). Hier steht nur der Bericht.
 *
 * Aufruf:  npx vite-node tools/fahrzeug-durchdringung.ts
 *          npx vite-node tools/fahrzeug-durchdringung.ts --fein
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { leinwandAttrappe } from "./leinwand-attrappe";
import { initPhysics } from "../src/physics/physicsWorld";
import {
  alleBauarten,
  auslegerUeberFlaeche,
  inventarLuft,
  ladungOberkante,
  messeBauart,
  rangierknick,
} from "./fahrzeugteile";
import { BAUGRUPPE } from "../src/delivery/vehicleModel";

function m(x: number): string {
  return `${(x * 100).toFixed(1).padStart(6)} cm`;
}

leinwandAttrappe();
await initPhysics();
const fein = process.argv.includes("--fein");
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

console.log("FAHRZEUG-DURCHDRINGUNG — tragende Teile gegeneinander");
console.log("Trennachsensatz über die echten Netze; runde Teile (~) messen bis 8 % zu wenig.");
console.log("");

let nullprobeOk = true;
let befundeGesamt = 0;
const zeilen: string[] = [];
for (const bauart of alleBauarten()) {
  const { fz, teile, befunde, lagen } = messeBauart(world, bauart, fein);
  const titel = `${bauart.kind}/${bauart.aufbau}/${bauart.mitKran ? "mit Kran" : "ohne Kran"}`;
  const kopf =
    `${titel.padEnd(30)} ${String(teile.length).padStart(3)} Teile, ` +
    `${String(lagen).padStart(5)} Stellungen`;
  if (befunde.length === 0) {
    zeilen.push(`${kopf}   —  frei`);
  } else {
    zeilen.push(kopf);
    for (const b of befunde) {
      const schlimm = b.tiefe > b.erlaubt;
      if (schlimm) befundeGesamt++;
      zeilen.push(
        `  ${schlimm ? "!!" : "ok"}${b.paar.padEnd(24)} ${m(b.tiefe)}` +
          `${b.gerundet ? " ~" : "  "}(erlaubt ${(b.erlaubt * 100).toFixed(0)}) ` +
          `${b.stellung}   [${b.teile}]`
      );
    }
  }
  // NULLPROBE: ohne Kran darf kein einziges Kranteil auftauchen
  if (!bauart.mitKran) {
    const kranTeile = teile.filter(
      (t) => t.gruppe === BAUGRUPPE.kranbock || t.gruppe === BAUGRUPPE.kransaeule
    );
    if (kranTeile.length !== 0) nullprobeOk = false;
    if (befunde.some((b) => b.gruppen.some((g) => g.startsWith("kran")))) nullprobeOk = false;
  } else {
    const unten = auslegerUeberFlaeche(fz, teile);
    const ladung = ladungOberkante(bauart.kind, bauart.aufbau);
    if (unten !== null) {
      zeilen.push(
        `    ${"Ausleger über Ladung".padEnd(24)} ${m(unten - ladung)}    ` +
          `(Ausleger unten ${unten.toFixed(2)} m, Ladung bis ${ladung.toFixed(2)} m)`
      );
    }
  }
  fz.group.removeFromParent();
}
console.log(zeilen.join("\n"));
console.log("");
console.log(
  `NULLPROBE (Fahrzeuge ohne Kran melden kein Kranteil): ${nullprobeOk ? "bestanden" : "GESCHEITERT"}`
);
console.log(`VERSTOESSE (tiefer als erlaubt): ${befundeGesamt}`);
console.log("");

console.log("RANGIERKNICK — wie weit der Wagen in EINEM Rechenschritt abknickt");
console.log("(E-073, nicht Auftrag dieses Pakets — hier nur mitgemessen)");
console.log("");
for (const r of rangierknick().slice(0, 10)) {
  console.log(
    `  ${r.strecke.padEnd(26)} ${r.knickGrad.toFixed(1).padStart(6)}°   ` +
      `Umrissecke springt ${r.heckSprungM.toFixed(2)} m`
  );
}

console.log("");
console.log("PLATZINVENTAR-FENSTER (E-070)");
console.log(
  `  Ein Behälter auf dem Boden meldet y = 0; das Fenster beginnt ${inventarLuft().toFixed(2)} m höher.`
);
