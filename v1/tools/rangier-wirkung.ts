/**
 * WAS DER RANGIERKNICK AM LIEGENDEN SCHROTT ANRICHTET — die Messreihe.
 *
 *     npx vite-node tools/rangier-wirkung.ts
 *     npx vite-node tools/rangier-wirkung.ts -- --saaten=4
 *     npx vite-node tools/rangier-wirkung.ts -- --raten=0.4,0.85,2,6
 *
 * Nullprobe zuerst, dann der alte Sprungzustand, dann der gebaute. Alle drei
 * fahren dieselben Saaten und damit denselben Haufen — anders waere der
 * Vergleich wertlos (E-062).
 *
 * Mit `--raten` faehrt es zusaetzlich eine Reihe je Lenkrate. Das ist die
 * Antwort auf „ab welcher Rate verschwindet der Schaden": Die Rate ist eine
 * Spielgefuehl-Zahl, aber wo sie WEHTUT, ist eine Messung.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { reihe, staende, SAATEN_12, type WirkungsStand } from "../test/wirkungslauf";
import { LENK_RATE } from "../src/delivery/lenkung";

const arg = (n: string): string | null => {
  const t = process.argv.find((a) => a.startsWith(`--${n}=`));
  return t ? t.slice(n.length + 3) : null;
};

await RAPIER.init();

const wieviele = Number(arg("saaten") ?? SAATEN_12.length);
const saaten = SAATEN_12.slice(0, wieviele);
const raten = (arg("raten") ?? "")
  .split(",")
  .filter((x) => x.length > 0)
  .map(Number);

const z = (x: number, n = 1): string => x.toFixed(n).padStart(8);
console.log(`${saaten.length} Saaten, Lenkrate gebaut ${LENK_RATE} rad/s`);
console.log(
  "Stand                          |  Mittel  Median  Hoechst km/h |  weiteste  mittlere m"
);
for (const ort of ["abkippzone", "kehre", "kehre_fern"] as const) {
  for (const s of staende(ort)) {
    const r = reihe(s, saaten);
    console.log(
      `${r.name.padEnd(30)} |${z(r.mittel)}${z(r.median)}${z(r.hoechst)}      |` +
        `${z(r.weiteste, 2)}  ${z(r.weitesteMittel, 2)}`
    );
  }
  for (const rate of raten) {
    const s: WirkungsStand = {
      name: `Rate ${rate} (${ort})`,
      lenkrate: rate,
      mitFahrzeug: true,
      ort,
    };
    const r = reihe(s, saaten);
    console.log(
      `${r.name.padEnd(30)} |${z(r.mittel)}${z(r.median)}${z(r.hoechst)}      |` +
        `${z(r.weiteste, 2)}  ${z(r.weitesteMittel, 2)}`
    );
  }
}
