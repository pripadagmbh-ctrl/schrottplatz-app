/**
 * Das Blatt zur Greiferfrage: beide Greifer im selben Massstab nebeneinander.
 *
 * Ergebnis: `docs/greifer-vergleich-2026-09-15.svg` — zum Ansehen auf dem
 * iPhone in der Planmappe unter `/v1/plaene/`. Es soll ohne Begleittext
 * verstaendlich sein: grosse Schrift, vier klar getrennte Bilder, kein
 * Fliesstext.
 *
 * WAS GEZEICHNET IST. Kein Seitenriss aus Bahnfunktionen, sondern die
 * SCHATTENRISSE der wirklich gebauten Netze: Jede Figur ist die senkrechte
 * Projektion aller Dreiecke des Modells auf die z-y-Ebene, zeilenweise als
 * Vereinigung von Strecken gerechnet. Was auf dem Blatt steht, steht so auch
 * im Spiel — eine Zeichnung kann hier nicht schoener sein als das Modell.
 *
 * Projiziert wird auf die z-y-Ebene und nicht auf x-y, weil beide Modelle ihre
 * erste Schale auf den Umfangswinkel 0 legen und dort der Radius in z zeigt
 * (`clawPoint`: `(sin a · r, y, cos a · r)`). In der x-y-Ebene staende genau
 * diese Schale hochkant und man saehe sie nicht.
 *
 * WAS AN ZAHLEN DARAUFSTEHT, ist nicht aus der Zeichnung abgegriffen, sondern
 * kommt aus `greifer-modelle.miss()` — derselben Messung, die
 * `greifer-gegenueber.ts` als Tabelle druckt.
 *
 * Aufruf:  npx vite-node tools/greifer-vergleich-blatt.ts
 */
import { writeFileSync } from "node:fs";
import { Messung, Pruefling, dreiecke, fuenfschalen, miss, sichelkralle } from "./greifer-modelle";
import { PRESS_INNER } from "../src/world/press";
import { CONFIGS } from "../src/world/containers";

/* --------------------------------------------------------------- Der Rahmen */

const BREITE = 1240;
const HOEHE = 2080;
/** Pixel je Meter. ALLE vier Bilder im selben Massstab — sonst taeuscht das Blatt. */
const PX = 132;
/** Mitte der beiden Spalten (Drehachse des jeweiligen Greifers). */
const SPALTE = [336, 918];
/**
 * Halbe Breite eines Bildfeldes. Muss unter dem halben Spaltenabstand bleiben,
 * sonst laufen die Meterlinien der beiden Spalten ineinander — beim ersten
 * Entwurf taten sie das und das Blatt las sich wie EIN Bild.
 */
const FELD_HALB = 258;
/** Hoehe der Aufhaengung (y = 0) je Zeile. */
const ZEILE = [290, 800];

const FARBE = {
  papier: "#f4f2ee",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#9aa2a7",
  sichel: "#3f4a52",
  fuenf: "#1f5d86",
  gut: "#1d6f34",
  schlecht: "#9c2717",
  band: "#e5e0d8",
  feld: "#ffffff",
};

const teile: string[] = [];
const zeichne = (s: string): void => {
  teile.push(s);
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Deutsches Komma — das Blatt liest ein Mensch, keine Konsole. */
function zahl(x: number, stellen: number): string {
  return x.toFixed(stellen).replace(".", ",").replace("-", "−");
}

/** Ganze Zentimeter mit echtem Minuszeichen — der Bindestrich liest sich als Trennstrich. */
function cm(x: number): string {
  return `${(x * 100).toFixed(0).replace("-", "−")} cm`;
}

/** Tausenderpunkt, wie bei „1.523 l" in den bisherigen Blättern. */
function tausend(x: number): string {
  return Math.round(x)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function text(
  x: number,
  y: number,
  s: string,
  groesse: number,
  farbe = FARBE.linie,
  anker: "start" | "middle" | "end" = "start",
  fett = false
): void {
  zeichne(
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${groesse}" fill="${farbe}" ` +
      `text-anchor="${anker}" font-family="Helvetica,Arial,sans-serif"` +
      `${fett ? ' font-weight="700"' : ""}>${esc(s)}</text>`
  );
}

function linie(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  farbe: string,
  dicke: number,
  gestrichelt = false
): void {
  zeichne(
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
      `stroke="${farbe}" stroke-width="${dicke}" stroke-linecap="round"` +
      `${gestrichelt ? ' stroke-dasharray="8 7"' : ""}/>`
  );
}

/* ------------------------------------------------------------ Schattenriss */

/**
 * Der Schattenriss eines gebauten Greifers, zeilenweise.
 *
 * Fuer jede waagrechte Zeile werden alle Dreiecke geschnitten, die sie
 * kreuzen; jedes liefert eine z-Strecke. Die Vereinigung dieser Strecken ist
 * die Breite des Koerpers in dieser Hoehe. Das ist exakt — anders als ein
 * „aeusserster Punkt", der bei einer nach innen gekruemmten Sichel auf der
 * Rueckseite liegt und schon einmal ein Werkzeug gekostet hat (14.09.2026).
 */
function schattenriss(p: Pruefling, oeffnung: number, zeilenhoehe = 0.006): string {
  p.setOeffnung(oeffnung);
  const tris = dreiecke(p.wurzel).map((t) => [t[2]!, t[1]!, t[5]!, t[4]!, t[8]!, t[7]!]);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const t of tris) {
    for (const j of [1, 3, 5]) {
      yMin = Math.min(yMin, t[j]!);
      yMax = Math.max(yMax, t[j]!);
    }
  }
  const stuecke: string[] = [];
  for (let y = yMin; y < yMax; y += zeilenhoehe) {
    const mitte = y + zeilenhoehe / 2;
    const spannen: Array<[number, number]> = [];
    for (const t of tris) {
      const zs: number[] = [];
      for (let k = 0; k < 3; k++) {
        const az = t[k * 2]!;
        const ay = t[k * 2 + 1]!;
        const bz = t[((k + 1) % 3) * 2]!;
        const by = t[((k + 1) % 3) * 2 + 1]!;
        if (ay === by) continue;
        const u = (mitte - ay) / (by - ay);
        if (u < 0 || u > 1) continue;
        zs.push(az + (bz - az) * u);
      }
      if (zs.length < 2) continue;
      spannen.push([Math.min(...zs), Math.max(...zs)]);
    }
    if (!spannen.length) continue;
    spannen.sort((a, b) => a[0] - b[0]);
    let von = spannen[0]![0];
    let bis = spannen[0]![1];
    const raus: Array<[number, number]> = [];
    for (const s of spannen.slice(1)) {
      if (s[0] <= bis + 1e-4) bis = Math.max(bis, s[1]);
      else {
        raus.push([von, bis]);
        von = s[0];
        bis = s[1];
      }
    }
    raus.push([von, bis]);
    for (const [a, b] of raus) stuecke.push([a, mitte, b - a, zeilenhoehe].join(" "));
  }
  return stuecke.join("|");
}

/** Groesster gezeichneter Durchmesser in DIESER Stellung (m). */
function durchmesser(p: Pruefling, oeffnung: number): number {
  p.setOeffnung(oeffnung);
  let weit = 0;
  for (const t of dreiecke(p.wurzel)) {
    for (const j of [0, 3, 6]) weit = Math.max(weit, 2 * Math.hypot(t[j]!, t[j + 2]!));
  }
  return weit;
}

/** Den Schattenriss an seinen Platz zeichnen. */
function malen(riss: string, mx: number, my: number, farbe: string): void {
  const d: string[] = [];
  for (const s of riss.split("|")) {
    const [z, y, w, h] = s.split(" ").map(Number) as [number, number, number, number];
    const px = mx + z * PX;
    const py = my - y * PX;
    d.push(
      `M${px.toFixed(1)} ${py.toFixed(1)}h${(w * PX).toFixed(1)}v${(h * PX + 0.4).toFixed(1)}h${(-w * PX).toFixed(1)}Z`
    );
  }
  zeichne(`<path d="${d.join("")}" fill="${farbe}" fill-rule="nonzero"/>`);
}

/* ------------------------------------------------------------- Eine Figur */

function figur(
  p: Pruefling,
  m: Messung,
  oeffnung: number,
  spalte: number,
  zeile: number,
  farbe: string,
  ueberschrift: string
): void {
  const mx = SPALTE[spalte]!;
  const my = ZEILE[zeile]!;
  /* Hoehenband: Meterraster als Hilfe, damit man Tiefen ablesen kann. */
  for (let mtr = 0; mtr <= 3; mtr++) {
    const y = my + mtr * PX;
    linie(mx - FELD_HALB, y, mx + FELD_HALB, y, mtr === 0 ? FARBE.linie : FARBE.band, mtr === 0 ? 2.5 : 1.5);
    if (spalte === 0) text(mx - FELD_HALB - 12, y + 7, `${mtr} m`, 19, FARBE.hilfe, "end");
  }
  linie(mx, my - 24, mx, my + 3.2 * PX, FARBE.hilfe, 1.2, true);

  malen(schattenriss(p, oeffnung), mx, my, farbe);

  /* Grabtiefe dieser Stellung, als Strich mit Zahl. */
  const tief = oeffnung >= 0.999 ? m.tiefenweg[10]! : m.tiefenweg[0]!;
  const ty = my + tief * PX;
  linie(mx - FELD_HALB + 10, ty, mx + FELD_HALB - 10, ty, farbe, 2.4, true);
  text(mx + FELD_HALB - 6, ty - 10, `${zahl(tief, 2)} m tief`, 21, farbe, "end", true);

  /*
   * Der Durchmesser RUNDUM, nicht die Breite des Bildes.
   *
   * Fuenf Schalen auf einem Kreis: Es gibt keine zwei, die sich genau
   * gegenueberstehen. Die Schale bei 144 Grad liegt im Seitenriss nur auf
   * cos 144 Grad = 0,809 ihres Radius — der Schattenriss ist deshalb um rund
   * ein Zehntel schmaler als der Kreis, den die Maschine wirklich ueberstreicht.
   * Beim ersten Entwurf stand der Massstrich an der richtigen Zahl und ragte
   * sichtbar ueber das Bild hinaus. Jetzt zeigen zwei gestrichelte Lote, wo
   * dieser Kreis liegt; der Strich gehoert erkennbar zu ihnen und nicht zum
   * Umriss.
   */
  const breite = durchmesser(p, oeffnung);
  const halb = (breite / 2) * PX;
  const by = my - 36;
  linie(mx - halb, by, mx - halb, my + tief * PX, farbe, 1.2, true);
  linie(mx + halb, by, mx + halb, my + tief * PX, farbe, 1.2, true);
  linie(mx - halb, by, mx + halb, by, farbe, 3);
  linie(mx - halb, by - 9, mx - halb, by + 9, farbe, 3);
  linie(mx + halb, by - 9, mx + halb, by + 9, farbe, 3);
  text(mx, by - 15, `${zahl(breite, 2)} m rundum`, 23, farbe, "middle", true);

  text(mx, my - 68, ueberschrift, 26, FARBE.linie, "middle", true);
}

/* ------------------------------------------------------------- Das Blatt */

function main(): void {
  const sp = sichelkralle();
  const fp = fuenfschalen();
  const ms = miss(sp);
  const mf = miss(fp);

  zeichne(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  text(40, 60, "Welcher Greifer soll an den Bagger?", 40, FARBE.linie, "start", true);
  text(
    40,
    94,
    "Beide im selben Maßstab, am selben Punkt aufgehängt · Schattenrisse der gebauten Modelle · 15.09.2026",
    21,
    FARBE.grau
  );
  text(SPALTE[0]!, 150, "SICHELKRALLE — heute am Bagger", 28, FARBE.sichel, "middle", true);
  text(SPALTE[1]!, 150, "FÜNFSCHALENGREIFER", 28, FARBE.fuenf, "middle", true);
  text(SPALTE[0]!, 178, "fünf Sicheln an einem Zapfen", 20, FARBE.grau, "middle");
  text(SPALTE[1]!, 178, "fünf Schalen am Stempel", 20, FARBE.grau, "middle");

  figur(sp, ms, 1, 0, 0, FARBE.sichel, "OFFEN");
  figur(fp, mf, 1, 1, 0, FARBE.fuenf, "OFFEN");
  figur(sp, ms, 0, 0, 1, FARBE.sichel, "GESCHLOSSEN");
  figur(fp, mf, 0, 0 + 1, 1, FARBE.fuenf, "GESCHLOSSEN");

  /* ------------------------------------------------------------- Tabelle */
  const tabY = 1300;
  zeichne(
    `<rect x="30" y="${tabY - 46}" width="${BREITE - 60}" height="440" fill="${FARBE.feld}" ` +
      `stroke="#ccd0d4" stroke-width="1.5" rx="10"/>`
  );
  text(56, tabY - 12, "Die Zahlen, gleich gemessen", 26, FARBE.linie, "start", true);
  text(700, tabY - 12, "Sichelkralle", 22, FARBE.sichel, "middle", true);
  text(940, tabY - 12, "Fünfschalen", 22, FARBE.fuenf, "middle", true);
  text(1170, tabY - 12, "Unterschied", 22, FARBE.grau, "end", true);

  const zeilen: Array<[string, string, string, string, string]> = [
    [
      "Grabtiefe (tiefste Stellung)",
      `${zahl(ms.grabtiefe, 2)} m`,
      `${zahl(mf.grabtiefe, 2)} m`,
      cm(mf.grabtiefe - ms.grabtiefe),
      FARBE.schlecht,
    ],
    [
      "breiteste Stelle über den ganzen Weg",
      `${zahl(ms.huellkreis, 2)} m`,
      `${zahl(mf.huellkreis, 2)} m`,
      cm(mf.huellkreis - ms.huellkreis),
      FARBE.gut,
    ],
    [
      "Öffnungsweite über die Zähne",
      `${zahl(ms.spitzenweiteOffen, 2)} m`,
      `${zahl(mf.spitzenweiteOffen, 2)} m`,
      cm(mf.spitzenweiteOffen - ms.spitzenweiteOffen),
      FARBE.grau,
    ],
    [
      "Korbinhalt, Eisen abgezogen",
      `${tausend(ms.nettokorb * 1000)} l`,
      `${tausend(mf.nettokorb * 1000)} l`,
      `+${(((mf.nettokorb - ms.nettokorb) / ms.nettokorb) * 100).toFixed(0)} %`,
      FARBE.gut,
    ],
    [
      "Korbmündung (Durchmesser)",
      `${zahl(ms.aequator, 2)} m`,
      `${zahl(mf.aequator, 2)} m`,
      `+${cm(mf.aequator - ms.aequator)}`,
      FARBE.gut,
    ],
    [
      "Bauhöhe geschlossen",
      `${zahl(ms.bauhoehe, 2)} m`,
      `${zahl(mf.bauhoehe, 2)} m`,
      cm(mf.bauhoehe - ms.bauhoehe),
      FARBE.grau,
    ],
    [
      "Bauteile (Netze) — der Preis fürs Bild",
      `${ms.netze}`,
      `${mf.netze}`,
      `+${mf.netze - ms.netze}`,
      FARBE.schlecht,
    ],
  ];
  zeilen.forEach(([name, a, b, diff, farbe], i) => {
    const y = tabY + 34 + i * 54;
    if (i % 2 === 1) {
      zeichne(`<rect x="44" y="${y - 30}" width="${BREITE - 88}" height="46" fill="#f7f6f3"/>`);
    }
    text(56, y, name, 23, FARBE.linie);
    text(700, y, a, 25, FARBE.sichel, "middle", true);
    text(940, y, b, 25, FARBE.fuenf, "middle", true);
    text(1170, y, diff, 25, farbe, "end", true);
  });

  /* ------------------------------------------------------ Was enger wird */
  const fussY = 1800;
  zeichne(
    `<rect x="30" y="${fussY - 44}" width="${BREITE - 60}" height="252" fill="${FARBE.feld}" ` +
      `stroke="#ccd0d4" stroke-width="1.5" rx="10"/>`
  );
  text(56, fussY - 10, "Passt er überall hin, wo der heutige hinpasst?", 26, FARBE.linie, "start", true);
  text(700, fussY - 10, "Sichelkralle", 22, FARBE.sichel, "middle", true);
  text(1000, fussY - 10, "Fünfschalen", 22, FARBE.fuenf, "middle", true);
  const muell = CONFIGS.find((c) => c.kind === "rolloff");
  const eng: Array<[string, number]> = [
    ["Presskammer, schmale Richtung", PRESS_INNER.tiefe],
    ["Presskammer, lange Richtung", PRESS_INNER.laenge],
    [`Müllcontainer „${muell ? muell.label : "MUELL"}"`, (muell ? Math.min(muell.size[0], muell.size[1]) : 3.6) - 0.18],
    ["Sortiermulde / Silo", 4.2],
  ];
  eng.forEach(([name, weite], i) => {
    const y = fussY + 32 + i * 42;
    const ls = (weite - ms.huellkreis) / 2;
    const lf = (weite - mf.huellkreis) / 2;
    text(56, y, `${name} — ${zahl(weite, 2)} m frei`, 23, FARBE.linie);
    text(
      700,
      y,
      ls < 0 ? `${cm(ls)} — nicht ganz offen` : `${cm(ls)} Luft`,
      23,
      ls < 0 ? FARBE.schlecht : ls < 0.3 ? FARBE.linie : FARBE.gut,
      "middle",
      true
    );
    text(
      1000,
      y,
      lf < 0 ? `${cm(lf)} — nicht ganz offen` : `${cm(lf)} Luft`,
      23,
      lf < 0 ? FARBE.schlecht : lf < 0.3 ? FARBE.linie : FARBE.gut,
      "middle",
      true
    );
  });
  text(
    56,
    fussY + 32 + 4 * 42 + 10,
    "Luft je Seite gegen den größten Durchmesser über den ganzen Öffnungsweg. Minus heißt: Er kommt hinein, aber nicht ganz geöffnet.",
    21,
    FARBE.grau
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">${teile.join("")}</svg>\n`;
  writeFileSync("docs/greifer-vergleich-2026-09-15.svg", svg, "utf8");
  console.log(`geschrieben: docs/greifer-vergleich-2026-09-15.svg (${(svg.length / 1024).toFixed(0)} kB)`);
}

main();
