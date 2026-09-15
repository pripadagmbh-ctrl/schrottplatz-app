/**
 * Der Knick im Zahn — was er kostet, und was es kostet, ihn wegzunehmen.
 *
 * Anlass: Patrick am 15.09.2026 vor `docs/f5-greiferschale.png` und vor einem
 * Vorbildfoto (`docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`, gelber
 * Kringel auf dem Übergang Schale → Lager):
 *
 *   „dieser harte Knick im Zahn, den gibt es nicht. Das ist nicht so."
 *   „das Problem ist ja die Aufnahme an dem Zahn. Der Zahn ist falsch gebogen,
 *    weshalb du diese Abstände zur Traverse brauchst."
 *
 * DER KNICK IST EINE ZAHL, und sie steht seit dem 14.09.2026 im Quelltext:
 *
 *   zahnAnstellung(offen) = offen − schalenEnde().th + zahnEigenwinkel()
 *
 * Mit `OFFEN` = `schalenEnde().th` bleiben davon die −12,15° der Eigenbiegung
 * des Zahns übrig. Um genau diesen Winkel ist der Zahn gegen das Schalenende
 * verdreht — das ist der Absatz, den man im Schattenriss sieht. Er wurde
 * eingebaut, damit der Zahn bei OFFENEM Greifer lotrecht steht (Ansage
 * 13.09.2026, Messprotokoll `docs/messungen/2026-09-14_fuenfschalen-zahnwinkel.md`
 * Abschnitt 2).
 *
 * BEIDES ZUSAMMEN GEHT NICHT — jedenfalls nicht mit diesem Anschlag. Deshalb
 * zeigt dieses Blatt drei Formen, misst sie am gebauten Netz und schreibt den
 * Preis dazu. Gebaut ist keine davon; `src/` ist unangetastet.
 *
 *   A  HEUTE        Anschlag 96,25°, Zahn 12,15° angestellt — der Knick
 *   B  KNICKFREI    Anschlag 96,25°, Zahn tangential — Zahn offen 12° schräg
 *   C  KNICKFREI    Anschlag 108,40°, Zahn tangential — Zahn offen lotrecht
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/zahnknick.ts
 * Ergebnis: docs/f5-zahnknick-2026-09-15.svg + die Tabelle auf der Konsole
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
/*
 * Formen und Messung stehen seit dem 15.09.2026 in `zahnformen.ts`, der
 * Schattenriss in `tools/schattenriss.ts` — beide werden vom
 * Vorher-Nachher-Blatt mitbenutzt. Eine zweite Kopie waere eine zweite
 * Wahrheit ueber dieselbe Form.
 */
import { FORMEN, GRAD, baue, miss } from "./zahnformen";
import { schattenriss, type Strecke } from "../schattenriss";

/* ------------------------------------------------------------------ Blatt */

const BREITE = 1560;
const HOEHE = 1840;
const SPALTE = [300, 780, 1260];
const FARBE = {
  papier: "#f4f2ee",
  feld: "#ffffff",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#b3bac0",
  beton: "#8a6a3a",
  gut: "#1d6f34",
  schlecht: "#9c2717",
  heute: "#3f4a52",
  neu: "#1f5d86",
};

const teile: string[] = [];
const T = (
  x: number,
  y: number,
  s: string,
  groesse = 18,
  f = FARBE.linie,
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

/** Einen Schattenriss zeichnen: y = 0 ist die Aufhängung, Maßstab px/m. */
function male(
  st: Strecke[],
  mx: number,
  my: number,
  px: number,
  farbe: string,
  deckung = 1
): void {
  const d = st
    .map(
      ([z, y, b, h]) =>
        `M${(mx + z * px).toFixed(1)},${(my - y * px - h * px).toFixed(1)}` +
        `h${(b * px).toFixed(1)}v${(h * px).toFixed(1)}h${(-b * px).toFixed(1)}Z`
    )
    .join("");
  teile.push(`<path d="${d}" fill="${farbe}" fill-opacity="${deckung}"/>`);
}

function feld(x: number, y: number, w: number, h: number, titel: string): void {
  teile.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  if (titel) T(x + 12, y + 20, titel, 14, FARBE.grau, "start");
}

function main(): void {
  const masse = FORMEN.map(miss);

  /* ------------------------------------------------ Tabelle auf der Konsole */
  const zeile = (n: string, w: string[]): string =>
    `  ${n.padEnd(38)}${w.map((x) => x.padStart(16)).join("")}`;
  console.log("Der Knick im Zahn — drei Formen, gemessen am gebauten Netz\n");
  console.log(zeile("", FORMEN.map((f) => f.kurz)));
  console.log("  " + "-".repeat(86));
  console.log(zeile("Anschlag offen (°)", FORMEN.map((f) => (f.form.offen * GRAD).toFixed(2))));
  console.log(zeile("Zahn gegen Schalenende (°)", FORMEN.map((f) => (f.anstellung * GRAD).toFixed(2))));
  console.log("");
  console.log(zeile("SCHWEBEHÖHE geschlossen (cm)", masse.map((m) => (m.schwebt * 100).toFixed(1))));
  console.log(zeile("MAULWEITE offen (m)", masse.map((m) => m.maul.toFixed(3))));
  console.log(zeile("KORBTIEFE geschlossen (m)", masse.map((m) => m.korbtiefe.toFixed(4))));
  console.log(zeile("ZAHNWINKEL bei Bodenkontakt (°)", masse.map((m) => m.zahnBoden.toFixed(1))));
  console.log("");
  console.log(zeile("Zahn offen gegen die Senkrechte (°)", masse.map((m) => m.zahnOffen.toFixed(2))));
  console.log(zeile("Hebelarm offen (mm)  Ziel > 100", masse.map((m) => (m.hebelOffen * 1000).toFixed(0))));
  console.log(zeile("Hebelarm kleinster (mm)  nie < 50", masse.map((m) => (m.hebelMin * 1000).toFixed(0))));
  console.log(zeile("Hüllkreis (m)  Grenze 3,38", masse.map((m) => m.huellkreis.toFixed(3))));
  console.log(zeile("Sektor (°)  Grenze 36", masse.map((m) => m.sektor.toFixed(2))));
  console.log(zeile("tiefe(zu) / maxTiefe (m)", masse.map((m) => `${m.tiefeZu.toFixed(3)}/${m.maxTiefe.toFixed(3)}`)));
  console.log(zeile("Tiefpunkt bei (% des Weges)", masse.map((m) => (m.bei * 100).toFixed(0))));

  /* ------------------------------------------------------------- Das Blatt */
  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 52, "Der Knick im Zahn — und was es kostet, ihn wegzunehmen", 32, FARBE.linie, "start", true);
  T(
    40,
    82,
    "Fünfschalengreifer · Schattenrisse der gebauten Netze, alle im selben Maßstab · B ist seit E-069 gebaut · 15.09.2026",
    15,
    FARBE.grau,
    "start"
  );
  T(
    40,
    104,
    "Anlass: „dieser harte Knick im Zahn, den gibt es nicht. Das ist nicht so." + '"' + "  (Patrick, 15.09.2026)",
    15,
    FARBE.grau,
    "start"
  );

  /*
   * Zwei Maßstäbe, und beide sind begründet: Der Übergang Schale → Zahn misst
   * 25 cm, der ganze Greifer 3,4 m. In einem Maßstab wäre entweder der Knick
   * unsichtbar oder der Greifer nicht im Feld. Beide gelten aber je Zeile für
   * ALLE drei Spalten — sonst täuscht das Blatt.
   */
  const PX_DETAIL = 560;
  const PX_GANZ = 118;

  FORMEN.forEach((f, i) => {
    const g = baue(f);
    const mx = SPALTE[i]!;
    const farbe = i === 0 ? FARBE.heute : FARBE.neu;

    T(mx, 150, f.name, 20, farbe, "middle", true);
    T(mx, 172, f.ruf, 15, FARBE.grau);

    /* ---- Zeile 1: der Übergang, offen, gross ---- */
    feld(mx - 220, 190, 440, 330, "1  Schale und Zahn, offen — der Übergang");
    g.setOeffnung(1);
    const detail = schattenriss(g.schalen[0]!.gelenk, 0.0012);
    /*
     * Zentriert auf den SITZ des Zahns, nicht auf die Spitze — dort sitzt der
     * Knick. Der Sitz ist der Ursprung der Gruppe `SHELL_TIP_01`, in Weltlage
     * abgegriffen; kein geschätzter Bildausschnitt.
     */
    const sitz = new THREE.Vector3();
    g.schalen[0]!.gelenk.getObjectByName("SHELL_TIP_01")!.getWorldPosition(sitz);
    teile.push(
      `<clipPath id="c${i}"><rect x="${mx - 218}" y="${196}" width="436" height="300"/></clipPath>` +
        `<g clip-path="url(#c${i})">`
    );
    male(detail, mx - sitz.z * PX_DETAIL, 320 + sitz.y * PX_DETAIL, PX_DETAIL, farbe);
    teile.push("</g>");
    /* Die Naht selbst markieren, damit klar ist, wovon die Rede ist. */
    teile.push(
      `<circle cx="${mx}" cy="${320}" r="34" fill="none" stroke="${f.anstellung === 0 ? FARBE.gut : FARBE.schlecht}" stroke-width="3"/>`
    );
    T(mx, 510, `Zahn ${(f.anstellung * GRAD).toFixed(2)}° gegen das Schalenende`, 14, f.anstellung === 0 ? FARBE.gut : FARBE.schlecht);

    /* ---- Zeile 2: ganzer Greifer, offen ---- */
    feld(mx - 220, 534, 440, 320, "2  Greifer offen");
    g.setOeffnung(1);
    male(schattenriss(g.wurzel, 0.006), mx, 585, PX_GANZ, farbe);

    /* ---- Zeile 3: geschlossen, aufgesetzt, mit Betonkante ---- */
    feld(mx - 220, 868, 440, 420, "3  Greifer geschlossen, aufgesetzt");
    const m = masse[i]!;
    const oben = 900;
    /* Der Arm setzt so ab, dass der tiefste Punkt ÜBER DEN WEG den Beton berührt. */
    const betonY = oben + m.maxTiefe * PX_GANZ;
    /* Erst der Schatten der tiefsten Stellung, dann die geschlossene Form. */
    g.setOeffnung(m.bei);
    male(schattenriss(g.wurzel, 0.008), mx, oben, PX_GANZ, FARBE.hilfe, 0.55);
    g.setOeffnung(0);
    male(schattenriss(g.wurzel, 0.006), mx, oben, PX_GANZ, farbe);
    teile.push(
      `<line x1="${mx - 210}" y1="${betonY}" x2="${mx + 210}" y2="${betonY}" ` +
        `stroke="${FARBE.beton}" stroke-width="4"/>`
    );
    T(mx + 206, betonY + 18, "Beton", 13, FARBE.beton, "end");
    /* Das Mass der Schwebehoehe, als Klammer. */
    const zahnY = oben + m.tiefeZu * PX_GANZ;
    teile.push(
      `<line x1="${mx - 150}" y1="${zahnY}" x2="${mx - 150}" y2="${betonY}" stroke="${FARBE.schlecht}" stroke-width="3"/>` +
        `<line x1="${mx - 162}" y1="${zahnY}" x2="${mx - 138}" y2="${zahnY}" stroke="${FARBE.schlecht}" stroke-width="3"/>`
    );
    T(mx - 168, (zahnY + betonY) / 2 + 5, `${(m.schwebt * 100).toFixed(0)} cm`, 17, FARBE.schlecht, "end", true);
    T(mx, 1276, "grau: die tiefste Stellung auf dem Schließweg", 13, FARBE.grau);

    /* ---- Zeile 4: die Zahlen ---- */
    feld(mx - 220, 1302, 440, 300, "4  Die Maße");
    const z = (n: number, was: string, wert: string, f2 = FARBE.linie, gross = false): void => {
      T(mx - 200, 1340 + n * 34, was, gross ? 17 : 15, FARBE.grau, "start");
      T(mx + 200, 1340 + n * 34, wert, gross ? 24 : 16, f2, "end", gross);
    };
    z(0, "Schwebehöhe geschlossen", `${(m.schwebt * 100).toFixed(1)} cm`, m.schwebt < 0.2 ? FARBE.gut : FARBE.schlecht, true);
    z(1.3, "Maulweite offen", `${m.maul.toFixed(2)} m`, FARBE.linie, true);
    z(2.6, "Korbtiefe geschlossen", `${m.korbtiefe.toFixed(2)} m`, FARBE.linie, true);
    z(3.9, "Zahnwinkel bei Bodenkontakt", `${m.zahnBoden.toFixed(0)}°`, FARBE.linie, true);
    teile.push(
      `<line x1="${mx - 200}" y1="${1482}" x2="${mx + 200}" y2="${1482}" stroke="#e0dcd4" stroke-width="1"/>`
    );
    z(5.0, "Zahn offen gegen die Senkrechte", `${m.zahnOffen.toFixed(1)}°`, Math.abs(m.zahnOffen) < 0.5 ? FARBE.gut : FARBE.schlecht);
    z(5.9, "Hebelarm offen (Ziel > 100 mm)", `${(m.hebelOffen * 1000).toFixed(0)} mm`, m.hebelOffen > 0.1 ? FARBE.gut : FARBE.schlecht);
    z(6.8, "Hüllkreis (Grenze 3,38 m)", `${m.huellkreis.toFixed(2)} m`, m.huellkreis < 3.38 ? FARBE.gut : FARBE.schlecht);

    /* ---- Das Urteil ---- */
    const urteil =
      i === 0
        ? ["Der Knick ist da.", "Alles andere stimmt.", "Bis 15.09. gebaut."]
        : i === 1
          ? ["GEBAUT. Knick weg, alle", "Kennwerte bleiben — der Zahn", "steht offen 12° schief."]
          : ["Knick weg, Zahn lotrecht —", "aber der Hebelarm offen fällt", "von 118 auf 52 mm."];
    urteil.forEach((s, k) => T(mx, 1640 + k * 24, s, 16, i === 0 ? FARBE.grau : FARBE.schlecht));
  });

  T(
    40,
    1770,
    "Was an allen dreien gleich bleibt: Bolzenkreis 0,59 m · Korbtiefe 0,98 m · Bruttokorb 1.615 l · Sektor 26,3° · Schalenlücke.",
    15,
    FARBE.grau,
    "start"
  );
  T(
    40,
    1794,
    "Von den 24 cm Schwebehöhe sitzen 12,7 cm in der SCHALE selbst — ein Zahn, wie auch immer gebogen, kommt darunter nicht.",
    15,
    FARBE.grau,
    "start"
  );
  T(
    40,
    1818,
    "Gemessen mit tools/fuenfschalen/zahnknick.ts · src/ ist unverändert · Vorbild: docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg",
    13,
    FARBE.hilfe,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-zahnknick-2026-09-15.svg", svg);
  console.log(`\ndocs/f5-zahnknick-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
}

main();
