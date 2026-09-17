/**
 * Das Radiofeld als Bild — je Fassung eines, zum Ansehen.
 *
 * Ein Bildschirmfoto gaebe es nur mit Safari auf dem Geraet. Was hier geht:
 * das Feld aus den CSS-Werten aufzeichnen, Kasten fuer Kasten, in der
 * Geraetegroesse. Man sieht damit, ob etwas ueber den Rand laeuft oder etwas
 * anderes verdeckt — nicht, wie es aussieht. Das entscheidet Patrick.
 *
 * Gerechnet wird mit `test/radiomass.ts`, derselben Rechnung, mit der auch
 * `test/radioplatz.test.ts` prueft. Zwei Kopien einer Rechnung driften
 * auseinander.
 *
 * Aufruf:  npx vite-node tools/radiobild.ts
 */
import { mkdirSync } from "node:fs";
import { FASSUNGEN } from "../test/cssmass";
import { radioMass } from "../test/radiomass";
import { SENDER } from "../src/audio/songs";
import { Blatt, farbe } from "./fuenfschalen/png";

const AUS = "docs/messungen/2026-09-17-radio";
mkdirSync(AUS, { recursive: true });

/** Farben: Bild, Ueberzug, Tafel, Kasten, Liste, Knopf, Warnung. */
const BILD = farbe("#3a4248");
const UEBERZUG = farbe("#20262a");
const TAFEL = farbe("#181b1e");
const RAHMEN = farbe("#4e5358");
const UEBERSCHRIFT = farbe("#f0b429");
const TEXT = farbe("#9aa2a8");
const KNOPF = farbe("#2e3439");
const KNOPF_RAND = farbe("#6b7278");
const GEWAEHLT = farbe("#f0b429");
const WARNUNG = farbe("#c94a3a");
const SICHER = farbe("#2a3034");

for (const f of FASSUNGEN) {
  const m = radioMass(f);
  const b = new Blatt(f.w, f.h, BILD);

  // Sichere Raender als dunkler Streifen — dort darf nichts Wichtiges stehen
  b.rechteck(0, 0, f.w, f.sa.t, SICHER);
  b.rechteck(0, f.h - f.sa.b, f.w, f.sa.b, SICHER);
  b.rechteck(0, 0, f.sa.l, f.h, SICHER);
  b.rechteck(f.w - f.sa.r, 0, f.sa.r, f.h, SICHER);

  // Der Ueberzug liegt ueber dem ganzen Bild
  b.rechteck(f.sa.l, f.sa.t, f.w - f.sa.l - f.sa.r, f.h - f.sa.t - f.sa.b, UEBERZUG);

  // Die Tafel, mittig
  const tafelBreite = m.inhaltBreite + 2 * 26;
  const hoehe = Math.min(m.gebraucht, m.platz);
  const x0 = Math.round((f.w - tafelBreite) / 2);
  const y0 = Math.round((f.h - hoehe) / 2);
  b.rechteck(x0, y0, Math.round(tafelBreite), Math.round(hoehe), TAFEL);
  for (const [dx, dy, w, h] of [
    [0, 0, tafelBreite, 2],
    [0, hoehe - 2, tafelBreite, 2],
    [0, 0, 2, hoehe],
    [tafelBreite - 2, 0, 2, hoehe],
  ] as Array<[number, number, number, number]>) {
    b.rechteck(Math.round(x0 + dx), Math.round(y0 + dy), Math.round(w), Math.round(h), RAHMEN);
  }

  /*
   * Die Bloecke von oben nach unten. Das erste Element der Liste ist das
   * Polster; es wird nicht gezeichnet, sondern als Abstand verbraucht.
   */
  const polster = m.bloecke[0]!.hoehe / 2;
  const innenX = x0 + Math.round((tafelBreite - m.inhaltBreite) / 2);
  const innenB = Math.round(m.inhaltBreite);
  let y = y0 + polster;

  const zeichne = (h: number, f1: [number, number, number], rand?: [number, number, number]): void => {
    const oben = Math.round(y);
    const hoehePx = Math.max(1, Math.round(h));
    b.rechteck(innenX, oben, innenB, hoehePx, f1);
    if (rand) {
      b.rechteck(innenX, oben, innenB, 2, rand);
      b.rechteck(innenX, oben + hoehePx - 2, innenB, 2, rand);
    }
    y += h;
  };

  // Ueberschrift und Infozeile
  zeichne(m.bloecke[1]!.hoehe * 0.72, UEBERSCHRIFT);
  y += m.bloecke[1]!.hoehe * 0.28;
  zeichne(m.bloecke[2]!.hoehe * 0.7, TEXT);
  y += m.bloecke[2]!.hoehe * 0.3;

  // Die Senderliste: so viele Eintraege, wie hineinpassen — der Rest ist
  // hinter dem Rand und wird angeschnitten gezeichnet.
  const listeOben = y;
  const listeHoehe = m.bloecke[3]!.hoehe;
  for (let i = 0; i < SENDER.length; i++) {
    const oben = listeOben + i * m.eintrag;
    if (oben >= listeOben + listeHoehe) break;
    const sichtbar = Math.min(m.eintrag, listeOben + listeHoehe - oben);
    const alt = y;
    y = oben;
    zeichne(sichtbar - 6, KNOPF, i === 0 ? GEWAEHLT : KNOPF_RAND);
    y = alt;
  }
  y = listeOben + listeHoehe;

  // Die beiden Knoepfe darunter
  zeichne(m.bloecke[4]!.hoehe - 10, KNOPF, KNOPF_RAND);
  y += 10;
  zeichne(m.bloecke[5]!.hoehe - 10, KNOPF, KNOPF_RAND);

  // Laeuft etwas ueber den Rand? Dann ein roter Streifen am unteren Rand.
  if (m.luft < 0) b.rechteck(0, f.h - 8, f.w, 8, WARNUNG);

  const datei = `${AUS}/radio-${f.name.replace(/\s+/g, "-").toLowerCase()}.png`;
  b.schreibe(datei);
  console.log(
    `${f.name}: ${datei} — Platz ${m.platz.toFixed(0)} px, gebraucht ` +
      `${m.gebraucht.toFixed(0)} px, Luft ${m.luft.toFixed(0)} px, ` +
      `${m.sichtbar} von ${SENDER.length} Sendern ohne Schieben sichtbar`
  );
}
