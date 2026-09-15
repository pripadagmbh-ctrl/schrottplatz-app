/**
 * Die Verkleidung, vorher gegen nachher — damit Patrick sieht, was gebaut ist.
 *
 * Zwei Spalten im selben Maßstab, offen und geschlossen, Schattenrisse der
 * GEBAUTEN Netze. Links ohne, rechts mit dem Zylinderschutz; in der rechten
 * Spalte ist das neue Blech eingefärbt, damit man erkennt, was dazugekommen
 * ist und was nicht.
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/verkleidung-blatt.ts
 * Ergebnis: docs/f5-verkleidung-2026-09-15.svg
 */
import { writeFileSync } from "node:fs";
import { stoffe } from "../../src/fuenfschalen/teile";
import { baueGreiferInTeilen } from "../../src/fuenfschalen/rig";
import { rissTeilung, schattenriss, type Strecke } from "../schattenriss";
import { freigang } from "./verkleidung-messen";

const BREITE = 1200;
const HOEHE = 1230;
const PX = 140;
const SPALTE = [330, 870];
const FARBE = {
  papier: "#f4f2ee",
  feld: "#ffffff",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#b3bac0",
  stahl: "#5a646c",
  neu: "#c07a12",
};

const teile: string[] = [];
const T = (
  x: number,
  y: number,
  s: string,
  groesse = 14,
  f: string = FARBE.linie,
  anker = "middle",
  fett = false
): void => {
  teile.push(
    `<text x="${x}" y="${y}" font-size="${groesse}" fill="${f}" text-anchor="${anker}" ` +
      `font-family="Helvetica,Arial,sans-serif"${fett ? ' font-weight="700"' : ""}>` +
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</text>"
  );
};

function male(st: Strecke[], mx: number, my: number, farbe: string): void {
  const d = st
    .map(
      ([z, y, b, h]) =>
        `M${(mx + z * PX).toFixed(1)},${(my - y * PX - h * PX).toFixed(1)}` +
        `h${(b * PX).toFixed(1)}v${(h * PX).toFixed(1)}h${(-b * PX).toFixed(1)}Z`
    )
    .join("");
  teile.push(`<path d="${d}" fill="${farbe}"/>`);
}

/** Der Greifer, wahlweise ohne den Zylinderschutz. */
function bauen(mitHut: boolean): ReturnType<typeof baueGreiferInTeilen> {
  const g = baueGreiferInTeilen(stoffe());
  if (!mitHut) {
    const hut = g.traverse.getObjectByName("08_ZYLINDERSCHUTZ");
    if (hut) g.traverse.remove(hut);
  }
  return g;
}

function main(): void {
  const ohne = bauen(false);
  const mit = bauen(true);
  const f = freigang();

  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 48, "Der Zylinderschutz — vorher gegen nachher", 28, FARBE.linie, "start", true);
  T(
    40,
    74,
    "Fünfschalengreifer · Schattenrisse der gebauten Netze · beide Spalten im selben Maßstab · 15.09.2026",
    13,
    FARBE.grau,
    "start"
  );
  T(40, 96, '„Der Kopf ist zu schlank."  (Patrick, 15.09.2026)', 13, FARBE.grau, "start");

  const zeilen: Array<[string, number, number]> = [
    ["GESCHLOSSEN", 0, 130],
    ["OFFEN", 1, 600],
  ];
  for (const [titel, t, y] of zeilen) {
    for (let i = 0; i < 2; i++) {
      const mx = SPALTE[i]!;
      teile.push(
        `<rect x="${mx - 260}" y="${y}" width="520" height="450" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
      );
      T(mx - 246, y + 22, `${titel} — ${i === 0 ? "ohne" : "mit"} Verkleidung`, 14, FARBE.grau, "start");
      const g = i === 0 ? ohne : mit;
      g.setOeffnung(t);
      const riss = schattenriss(g.wurzel, 0.004);
      const oben = y + 54;
      if (i === 0) {
        male(riss, mx, oben, FARBE.stahl);
      } else {
        /*
         * Rechts wird geteilt: Was beide Spalten gemeinsam haben, bleibt
         * stahlfarben; NUR das neue Blech ist eingefärbt. So ist ohne Zweifel
         * zu sehen, was dazugekommen ist — und dass sonst nichts anders ist.
         */
        ohne.setOeffnung(t);
        const teilung = rissTeilung(schattenriss(ohne.wurzel, 0.004), riss);
        male(teilung.beides, mx, oben, FARBE.stahl);
        male(teilung.nurA, mx, oben, FARBE.hilfe);
        male(teilung.nurB, mx, oben, FARBE.neu);
      }
    }
  }
  T(SPALTE[1]!, 570, "orange = neu (das Blech) · grau = unverändert", 13, FARBE.neu);
  T(SPALTE[1]!, 1040, "orange = neu (das Blech) · grau = unverändert", 13, FARBE.neu);

  teile.push(
    `<rect x="40" y="1080" width="${BREITE - 80}" height="120" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(
    62,
    1112,
    "Sie trägt nichts: kein Kollider, kein Körper, keine Masse. Sie hängt am Kopf und dreht nur mit ihm.",
    14,
    FARBE.linie,
    "start",
    true
  );
  T(
    62,
    1140,
    `Sie kostet KEIN Netz (58 vorher, 58 nachher) — nur 77 Eckpunkte und 120 Dreiecke. Kleinster Freigang zu Schalen und Zylindern über den ganzen Schließweg: ${(f.abstand * 1000).toFixed(0)} mm.`,
    13,
    FARBE.grau,
    "start"
  );
  T(
    62,
    1168,
    "Sie verkleidet genau die 25,8 cm nackte Säule zwischen Traversenrand und Stempel — für die Zylinder ist zwischen Traverse und Anlenkung kein Platz (E-077).",
    13,
    FARBE.grau,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-verkleidung-2026-09-15.svg", svg);
  console.log(`docs/f5-verkleidung-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
}

if (!process.env.VITEST) main();
