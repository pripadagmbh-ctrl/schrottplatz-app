/**
 * Das Abrechnungsbild als Bild — je Fassung eines, zum Ansehen (E-113).
 *
 * Ein echtes Bildschirmfoto gäbe es nur mit Safari auf dem Gerät. Was hier
 * geht: das Feld aus den CSS-Werten aufzeichnen, Kasten für Kasten, in der
 * Gerätegröße. Man sieht, ob etwas über den Rand läuft oder etwas verdeckt —
 * nicht, wie es aussieht. Das entscheidet Patrick.
 *
 * Gerechnet wird mit `test/abrechnungsmass.ts`, derselben Rechnung, mit der
 * `test/abrechnungsplatz.test.ts` prüft.
 *
 * Aufruf:  npx vite-node tools/abrechnungsbild.ts
 */
import { mkdirSync } from "node:fs";
import { FASSUNGEN } from "../test/cssmass";
import { abrechnungsMass } from "../test/abrechnungsmass";
import { Blatt, farbe } from "./fuenfschalen/png";

const AUS = "docs/messungen/2026-09-22-abrechnung";
mkdirSync(AUS, { recursive: true });

const BILD = farbe("#3a4248");
const UEBERZUG = farbe("#20262a");
const TAFEL = farbe("#181b1e");
const RAHMEN = farbe("#4e5358");
const UEBERSCHRIFT = farbe("#f0b429");
const STERN = farbe("#f0b429");
const NAME = farbe("#9aa2a8");
const ZAHL = farbe("#e8e8e4");
const TRENN = farbe("#2e3439");
const KNOPF = farbe("#2e3439");
const KNOPF_RAND = farbe("#6b7278");
const WARNUNG = farbe("#c94a3a");
const SICHER = farbe("#2a3034");

for (const f of FASSUNGEN) {
  const m = abrechnungsMass(f);
  const b = new Blatt(f.w, f.h, BILD);

  // Sichere Raender — dort darf nichts Wichtiges stehen
  b.rechteck(0, 0, f.w, f.sa.t, SICHER);
  b.rechteck(0, f.h - f.sa.b, f.w, f.sa.b, SICHER);
  b.rechteck(0, 0, f.sa.l, f.h, SICHER);
  b.rechteck(f.w - f.sa.r, 0, f.sa.r, f.h, SICHER);
  b.rechteck(f.sa.l, f.sa.t, f.w - f.sa.l - f.sa.r, f.h - f.sa.t - f.sa.b, UEBERZUG);

  const hoehe = Math.min(m.gebraucht, m.platz);
  const x0 = Math.round((f.w - m.tafelBreite) / 2);
  const y0 = Math.round((f.h - hoehe) / 2);
  const breite = Math.round(m.tafelBreite);
  b.rechteck(x0, y0, breite, Math.round(hoehe), TAFEL);
  for (const [dx, dy, w, h] of [
    [0, 0, breite, 2],
    [0, hoehe - 2, breite, 2],
    [0, 0, 2, hoehe],
    [breite - 2, 0, 2, hoehe],
  ] as Array<[number, number, number, number]>) {
    b.rechteck(Math.round(x0 + dx), Math.round(y0 + dy), Math.round(w), Math.round(h), RAHMEN);
  }

  const polster = m.bloecke[0]!.hoehe / 2;
  const innenX = x0 + Math.round((breite - m.inhaltBreite) / 2);
  const innenB = Math.round(m.inhaltBreite);
  let y = y0 + polster;

  /** Ein Textkasten in der Breite, die der Text wirklich braucht. */
  const text = (h: number, anteil: number, f1: [number, number, number], rechts = false): void => {
    const w = Math.max(4, Math.round(innenB * anteil));
    b.rechteck(rechts ? innenX + innenB - w : innenX, Math.round(y), w, Math.max(1, Math.round(h)), f1);
  };

  // Ueberschrift FEIERABEND · TAG n
  text(m.bloecke[1]!.hoehe * 0.7, 0.55, UEBERSCHRIFT);
  y += m.bloecke[1]!.hoehe;
  // Sternzeile
  text(m.bloecke[2]!.hoehe * 0.72, 0.62, STERN);
  y += m.bloecke[2]!.hoehe;

  // Die sechs Zahlenzeilen: links das Wort, rechts die Zahl, darunter die Linie
  const zeilen = Math.round(m.bloecke[3]!.hoehe / m.zeilenHoehe);
  for (let i = 0; i < zeilen; i++) {
    const schrift = m.zeilenSchrift;
    const versatz = (m.zeilenHoehe - schrift) / 2;
    const alt = y;
    y += versatz;
    text(schrift, 0.34, NAME);
    text(schrift, i === 1 ? 0.4 : 0.22, ZAHL, true);
    y = alt + m.zeilenHoehe - 1;
    b.rechteck(innenX, Math.round(y), innenB, 1, TRENN);
    y = alt + m.zeilenHoehe;
  }

  // WEITER
  y += m.bloecke[4]!.hoehe - m.knopfHoehe;
  const knopfOben = Math.round(y);
  const knopfH = Math.round(m.knopfHoehe);
  b.rechteck(innenX, knopfOben, innenB, knopfH, KNOPF);
  b.rechteck(innenX, knopfOben, innenB, 2, KNOPF_RAND);
  b.rechteck(innenX, knopfOben + knopfH - 2, innenB, 2, KNOPF_RAND);

  if (m.luft < 0) b.rechteck(0, f.h - 8, f.w, 8, WARNUNG);

  const datei = `${AUS}/abrechnung-${f.name.replace(/\s+/g, "-").toLowerCase()}.png`;
  b.schreibe(datei);
  console.log(
    `${f.name}: ${datei} — Tafel ${breite}x${hoehe.toFixed(0)} px, Platz ` +
      `${m.platz.toFixed(0)} px, gebraucht ${m.gebraucht.toFixed(0)} px, Luft ` +
      `${m.luft.toFixed(0)} px, WEITER ${m.knopfHoehe.toFixed(0)} px hoch`
  );
}
