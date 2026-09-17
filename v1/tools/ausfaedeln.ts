/**
 * DIE SPRUNGTABELLE DER ABFAHRT — jeder Rechenschritt eines ganzen Zyklus.
 *
 *     npx vite-node tools/ausfaedeln.ts
 *     npx vite-node tools/ausfaedeln.ts -- --kind=pritsche
 *
 * `tools/einfaedeln.ts` misst den ABSTAND zwischen Warteplatz und Ausfahrt —
 * eine reine Geometriezahl. Dieses Werkzeug misst, was daraus im Spiel wird:
 * Es laesst das echte Fahrzeug seinen Zyklus fahren und schreibt auf, wie weit
 * es sich in einem einzigen Bild bewegt.
 *
 * Es ist ein WERKZEUG und kein Waechter: Es misst und druckt, es hat keine
 * Schranken. Die Schranken stehen in `test/ausfaedeln.test.ts`.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { abfahrt, staende, FAHRSCHRITT_M } from "../test/abfahrtslauf";
import type { DeliveryKind } from "../src/delivery/vehicles";

const arg = (n: string): string | null => {
  const t = process.argv.find((a) => a.startsWith(`--${n}=`));
  return t ? t.slice(n.length + 3) : null;
};

await RAPIER.init();

const kind = (arg("kind") ?? "kipper") as DeliveryKind;
const g = (x: number, n = 2): string => x.toFixed(n).padStart(8);

console.log(
  `Fahrzeugart ${kind}; ein regulaerer Fahrschritt ist ${FAHRSCHRITT_M.toFixed(3)} m`
);
console.log("");
console.log(
  "Stand                          |  Mitte  Ecke  Tiefe m | Spruenge | schlimmster Schritt"
);
for (const s of staende()) {
  const r = abfahrt({ ...s, kind });
  const w = r.schlimmster;
  console.log(
    `${r.name.padEnd(30)} |${g(r.maxSprungM)}${g(r.maxEckeM)}${g(r.maxTiefeM)} |` +
      `${String(r.spruenge.length).padStart(9)} | ` +
      (w ? `${w.vorherige} -> ${w.phase} bei (${w.x.toFixed(1)} | ${w.z.toFixed(1)})` : "-")
  );
}

console.log("");
console.log("ALLE SPRUENGE UEBER EINEM FAHRSCHRITT, je Stand");
for (const s of staende()) {
  const r = abfahrt({ ...s, kind });
  if (r.spruenge.length === 0) {
    console.log(`${r.name}: keiner`);
  } else {
    console.log(`${r.name}:`);
    for (const k of r.spruenge) {
      console.log(
        `   ${g(k.sprungM)} m Mitte  ${g(k.eckeM)} m Ecke   ` +
          `${k.vorherige} -> ${k.phase}   bei (${k.x.toFixed(1)} | ${k.z.toFixed(1)})`
      );
    }
  }
  for (const a of r.anstoesse) {
    console.log(
      `   ANSTOSS ${g(a.tiefeM)} m   ${a.phase.padEnd(12)} ${a.bauwerk.padEnd(22)} ` +
        `bei (${a.x.toFixed(1)} | ${a.z.toFixed(1)})`
    );
  }
}
