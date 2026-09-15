/**
 * „Der Kopf ist zu schlank." — was am Vorbild wirklich anders ist.
 * GERECHNET UND GEZEICHNET, NICHT GEBAUT.
 *
 * Anlass: Patrick hat am 15.09.2026 abends sieben Vorbildaufnahmen geschickt,
 * eine davon von Hand markiert, mit dem Satz „Der Kopf ist zu schlank." Und
 * dazu die Korrektur, ohne die alles Weitere falsch gewesen wäre:
 *
 *   „Das, was du als Guss … verortet hat, das ist im Grunde genommen nur eine
 *    Abblendung. Das ist ein Zylinderschutz. Also es ist kein Gusskörper. Das
 *    heißt, alles, was da ausgekantet ist, das ist die eigentliche
 *    Konstruktion. Also das musst du dir wegdenken."
 *
 * Quellen (alle in `v1/docs/`, alle Standbilder aus einem SENNEBOGEN-Video
 * bzw. Fotos, die Patrick markiert hat):
 *   f5-vorbild-kopf-markiert-2026-09-15.jpg      seine Handmarkierung
 *   f5-vorbild-kopf-konisch-2026-09-15.jpg       Seitenansicht mit Mann daneben
 *   f5-vorbild-offen-halle-2026-09-15.png        ganze Silhouette, offen
 *   f5-vorbild-geschlossen-beladen-2026-09-15.png  Anlenkung von nah
 *
 * ALLE ZAHLEN AUS DIESEN BILDERN SIND SCHÄTZUNGEN AUS EINER FOTOGRAFIE,
 * KEINE MASSE. Sie stehen unten als `VORBILD_GESCHAETZT` beisammen, jede mit
 * dem Bild, aus dem sie kommt, und alle nur als VERHÄLTNIS — aus einem Foto
 * ohne bekannten Maßstab lässt sich nichts anderes ablesen.
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/kopfbreite-blatt.ts
 * Ergebnis: docs/f5-kopfbreite-2026-09-15.svg + die Tabellen auf der Konsole
 */
import { writeFileSync } from "node:fs";
import { OFFEN, STEMPEL_AUGE, ZYLINDER_AUFNAHME } from "../../src/fuenfschalen/teile";
import { AUGPUNKT_UNTEN } from "../../src/world/containers";
import {
  DR_HEUTE,
  HEUTE,
  ROHR,
  SAEULE_HEUTE,
  armRadius,
  augenHoch,
  kennwert,
  kleinsteSaeule,
  kleinsteSaeuleBeiArm,
  kopfDurchmesser,
  probe,
  schalenmass,
  type Kennwert,
  type Schalenmass,
} from "./anlenkungsraum";

import {
  FARBE,
  type Riss,
  type Werkzeug,
  auge,
  bahnprobe,
  kreis,
  linie,
  risszeichnen,
  verdeckung,
  verkleidung,
} from "./anlenkungsriss";

const GRAD = 180 / Math.PI;

/* ------------------------------------------ Was in den Bildern zu sehen ist */

/**
 * Am Bild abgeschätzt — KEINE Maße.
 *
 * Alles als Verhältnis, damit der fehlende Maßstab nicht hineinlügt. Die
 * Pixelzahlen stehen dabei, damit jeder nachmessen kann, ob ich mich verguckt
 * habe.
 */
export const VORBILD_GESCHAETZT = {
  /**
   * Deckplatte oben zur Höhe Platte↔Bolzenebene.
   * `kopf-konisch`: Platte 1235…1510 px (275), Platte y≈630, Bolzenebene
   * y≈1110 → 480 px. 275/480 = 0,57. Bei uns: 0,95 m / 0,899 m = 1,06.
   */
  plattenbreiteZuHoehe: 275 / 480,
  /**
   * Höhe Platte↔Bolzen zur offenen Maulweite.
   * `offen-halle`: Verkleidung oben y≈560, Nabe y≈880 → 320 px; Spitzen
   * 555…1420 px → 865 px. 320/865 = 0,37. Bei uns: 0,899 / 3,095 = 0,29.
   */
  hoeheZuMaul: 320 / 865,
  /**
   * Verkleidung oben zur offenen Maulweite.
   * `offen-halle`: 930…1105 px (175) gegen 865 px = 0,20. Bei uns hat der Kopf
   * gar keine Verkleidung; die Traverse allein misst 0,95/3,095 = 0,31.
   */
  verkleidungZuMaul: 175 / 865,
  /**
   * Verkleidung oben zu Verkleidung unten — die Verjüngung.
   * `offen-halle`: oben 175 px, unten (an der Nabe) ≈ 100 px → 0,57.
   */
  verjuengung: 100 / 175,
  /**
   * Sitzt das untere Zylinderauge ÜBER oder UNTER dem Schalenbolzen?
   * `geschlossen-beladen`, die schärfste Aufnahme der Anlenkung: Beide liegen
   * im selben Band (y 570…620 px) — ein Arm, der weit über den Bolzen
   * hinaufragt, ist dort NICHT zu sehen. Am 3,2-m-Greifer sind 50 px keine
   * 5 cm; die Aufnahme kann 10 cm in beide Richtungen nicht ausschließen.
   */
  augeUeberBolzen: "nicht entscheidbar",
} as const;

/* ------------------------------------------------------------- Die Sichten */

/**
 * Wie weit die Aufhängung steht, wenn die Zähne den Beton berühren.
 *
 * Aus E-065, am kopflos gebauten Bagger gemessen: Fünfschalengreifer
 * aufgesetzt, Aufhängung auf y 2,766 m. Das ist die schlechteste Sicht, weil
 * der Greifer dann am tiefsten und am nächsten steht.
 */
const AUFHAENGUNG_AUFGESETZT = 2.766;
/** Augpunkt mit HOCHGEFAHRENER Kabine (2,60 m Hub, `kabinenhubParts.ts`). */
const AUGPUNKT_OBEN = AUGPUNKT_UNTEN + 2.6;

/* ------------------------------------------------------------ Die Spalten */

interface Spalte {
  nr: string;
  titel: string;
  ruf: string;
  rOben: number;
  rUnten: number;
  saeule: number;
  Ay: number;
  Az: number;
  /** Halbmesser der Verkleidung oben; 0 = keine. */
  hutR: number;
  k: Kennwert;
  m: Schalenmass;
  farbe: string;
}

function bolzenY(saeule: number): number {
  return -0.865 - saeule;
}

function zuRiss(v: Spalte): Riss {
  return {
    rOben: v.rOben,
    rUnten: v.rUnten,
    Zy: ZYLINDER_AUFNAHME.y,
    By: bolzenY(v.saeule),
    Ay: v.Ay,
    Az: v.Az,
    kopfD: kopfDurchmesser(v.rOben),
    kopfRunter: 0,
  };
}

/* ------------------------------------------------------------------ Blatt */

const BREITE = 1900;
const HOEHE = 1600;
const ACHSE = [160, 600, 1040];
const FELD_X = [40, 480, 920];
const FELD_B = 420;
const VORBILD_X = 1360;
const VORBILD_B = 500;
const PX = 165;
const OBEN = 190;

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
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${groesse}" fill="${f}" ` +
      `text-anchor="${anker}" font-family="Helvetica,Arial,sans-serif"` +
      `${fett ? ' font-weight="700"' : ""}>` +
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</text>"
  );
};

function werkzeug(mx: number): Werkzeug {
  return { teile, px: PX, P: (r, y) => [mx + r * PX, OBEN - y * PX] };
}

let clipNr = 0;
function spalte(i: number, v: Spalte): void {
  const mx = ACHSE[i]!;
  const fx = FELD_X[i]!;
  const w = werkzeug(mx);
  const id = `k${clipNr++}`;
  teile.push(
    `<rect x="${fx}" y="150" width="${FELD_B}" height="640" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`,
    `<clipPath id="${id}"><rect x="${fx + 2}" y="176" width="${FELD_B - 4}" height="612"/></clipPath>`,
    `<g clip-path="url(#${id})">`
  );
  risszeichnen(w, zuRiss(v));
  if (v.hutR > 0) {
    /* Blech, kein Guss: gestrichelt, nie gefüllt. */
    verkleidung(w, v.hutR, -0.72, 0.26, bolzenY(v.saeule) + 0.05);
  }
  /* Die Säule als Maß */
  const yT = OBEN - (ZYLINDER_AUFNAHME.y - 0.23) * PX;
  const yB = OBEN - bolzenY(v.saeule) * PX;
  linie(w, [mx - 0.26 * PX, yT], [mx - 0.26 * PX, yB], FARBE.schlecht, 3);
  linie(w, [mx - 0.3 * PX, yT], [mx - 0.22 * PX, yT], FARBE.schlecht, 3);
  linie(w, [mx - 0.3 * PX, yB], [mx - 0.22 * PX, yB], FARBE.schlecht, 3);
  teile.push("</g>");

  T(fx + 14, 176, `${v.nr}  ${v.titel}`, 19, v.farbe, "start", true);
  T(fx + 14, 196, v.ruf, 13, FARBE.grau, "start");
  T(mx - 0.33 * PX, (yT + yB) / 2 + 5, `${(v.saeule * 100).toFixed(0)} cm`, 16, FARBE.schlecht, "end", true);
  T(fx + 14, 764, "Volllinie = tragend · gestrichelt = Verkleidung (Blech)", 12, FARBE.grau, "start");
  T(fx + 14, 780, "voll = geschlossen · hell = offen", 12, FARBE.grau, "start");
}

/** Das Vorbild, schematisch — tragend voll, Blech gestrichelt. */
function vorbild(mx: number, oben: number): void {
  const S = 190;
  const p = (r: number, y: number): [number, number] => [mx + r * S, oben - y * S];
  const w: Werkzeug = { teile, px: S, P: p };
  /* Rotator */
  teile.push(
    `<rect x="${p(-0.2, 0)[0]}" y="${p(0, 0)[1]}" width="${0.4 * S}" height="${0.3 * S}" fill="#3a4148" stroke="#22282d"/>`
  );
  T(mx, oben + 0.16 * S, "Rotator", 11, "#ffffff");
  /* Deckplatte — TRAGEND */
  teile.push(
    `<rect x="${p(-0.42, -0.3)[0]}" y="${p(0, -0.3)[1]}" width="${0.84 * S}" height="${0.08 * S}" fill="${FARBE.stahl}" stroke="#4a5560" stroke-width="1.5"/>`
  );
  T(mx + 0.46 * S, oben + 0.34 * S, "Deckplatte — trägt", 11, FARBE.linie, "start", true);
  /* Verkleidung — BLECH */
  verkleidung(w, 0.5, -0.3, 0.18, -1.18);
  T(mx + 0.46 * S, oben + 0.62 * S, "Verkleidung: Blech,", 11, FARBE.gelb, "start", true);
  T(mx + 0.46 * S, oben + 0.62 * S + 14, "Zylinderschutz — trägt nicht", 11, FARBE.gelb, "start");
  /* Säule und Nabe */
  teile.push(
    `<rect x="${p(-0.06, -0.38)[0]}" y="${p(0, -0.38)[1]}" width="${0.12 * S}" height="${0.8 * S}" fill="${FARBE.stahlHell}" stroke="#8d959b"/>`,
    `<rect x="${p(-0.22, -1.18)[0]}" y="${p(0, -1.18)[1]}" width="${0.44 * S}" height="${0.16 * S}" fill="${FARBE.stahl}" stroke="#4a5560"/>`
  );
  /* Zylinder von der Plattenecke zum Schalenarm */
  const Z = { r: 0.38, y: -0.34 };
  const A = { r: 0.30, y: -1.12 };
  teile.push(
    `<line x1="${p(Z.r, Z.y)[0]}" y1="${p(Z.r, Z.y)[1]}" x2="${p(A.r, A.y)[0]}" y2="${p(A.r, A.y)[1]}" ` +
      `stroke="${FARBE.rohr}" stroke-width="16" stroke-linecap="round"/>`
  );
  kreis(w, p(Z.r, Z.y), 0.035 * S, "#ffffff", FARBE.linie, 2);
  kreis(w, p(A.r, A.y), 0.035 * S, "#ffffff", FARBE.schlecht, 2.5);
  /* Bolzen und Schale */
  const B: [number, number] = p(0.26, -1.26);
  kreis(w, B, 0.05 * S, "#ffffff", FARBE.bolzen, 3);
  const bogen: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a2 = t * 1.5;
    bogen.push(p(0.26 + 0.6 * Math.sin(a2) * (1 - 0.22 * t), -1.26 - 0.66 * (1 - Math.cos(a2))));
  }
  teile.push(
    `<polyline points="${bogen.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="${FARBE.stahl}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  T(mx + 0.36 * S, oben + 1.28 * S, "Bolzen", 11, FARBE.linie, "start", true);
  T(mx + 0.40 * S, oben + 1.10 * S, "unteres Auge", 11, FARBE.schlecht, "start");
  T(mx, oben + 1.62 * S, "Skizze nach Fotografien, OHNE Maße.", 12, FARBE.schlecht);
  T(mx, oben + 1.62 * S + 17, "Die Verkleidung ist das, was den Kopf breit", 12, FARBE.grau);
  T(mx, oben + 1.62 * S + 33, "aussehen lässt — sie trägt nichts.", 12, FARBE.grau);
}

/* ------------------------------------------------------------------ Ablauf */

function main(): void {
  const p = probe();
  if (p.fehler > 1e-12) throw new Error("Die Anlenkungsrechnung trifft rig.ts nicht mehr.");
  if (p.gegenprobe < 1e-6) throw new Error("Die Gegenprobe ist blind.");
  if (bahnprobe(STEMPEL_AUGE.y, STEMPEL_AUGE.r) > 1e-12) throw new Error("Schalenbahn falsch.");

  console.log("Der Kopf ist zu schlank — was am Vorbild wirklich anders ist\n");
  console.log("=== 1. Am Bild geschätzt (KEINE Maße, nur Verhältnisse) ===\n");
  const g = VORBILD_GESCHAETZT;
  const unsPlatte = kopfDurchmesser(ZYLINDER_AUFNAHME.r) / (ZYLINDER_AUFNAHME.y - STEMPEL_AUGE.y);
  const unsHoehe = (ZYLINDER_AUFNAHME.y - STEMPEL_AUGE.y) / 3.095;
  console.log(`  Deckplatte : Höhe Platte↔Bolzen   Vorbild ${g.plattenbreiteZuHoehe.toFixed(2)}   wir ${unsPlatte.toFixed(2)}`);
  console.log(`  Höhe Platte↔Bolzen : Maulweite     Vorbild ${g.hoeheZuMaul.toFixed(2)}   wir ${unsHoehe.toFixed(2)}`);
  console.log(`  Verkleidung oben : Maulweite       Vorbild ${g.verkleidungZuMaul.toFixed(2)}   wir — (keine)`);
  console.log(`  Verjüngung der Verkleidung         Vorbild ${g.verjuengung.toFixed(2)}`);
  console.log(`  Auge über dem Bolzen?              ${g.augeUeberBolzen}`);
  console.log("");
  console.log("  DER BEFUND: Der Abstand Platte↔Bolzen ist beim Vorbild NICHT kleiner als bei uns,");
  console.log("  gemessen an der Maulweite ist er GRÖSSER (0,37 gegen 0,29). Was fehlt, ist die");
  console.log("  Verkleidung: Beim Vorbild steckt dieser Bereich in einem sich verjüngenden Blech,");
  console.log("  bei uns steht dort eine nackte Säule von Ø 0,26 m.");

  console.log("\n=== 2. Hilft ein hochstehender Schalenarm? ===\n");
  console.log(
    `  Heute ragt der Arm ${armRadius(HEUTE.Ay, HEUTE.Az).toFixed(3)} m über seinen Bolzen hinaus, ` +
      `und zwar um ${(Math.atan2(HEUTE.Ay, HEUTE.Az) * GRAD).toFixed(0)}° nach UNTEN gekippt.`
  );
  console.log(
    `  Beim Öffnen steigt sein Auge dabei um ${augenHoch(HEUTE.Ay, HEUTE.Az).toFixed(3)} m — fast den ganzen Armradius.`
  );
  console.log("");
  console.log("  Armradius | Arm nach UNTEN erlaubt | nur Arm nach OBEN");
  console.log("  ----------+------------------------+-------------------");
  for (const r of [0.2, 0.2577, 0.3, 0.35, 0.4]) {
    const frei = kleinsteSaeuleBeiArm(r, true);
    const hoch = kleinsteSaeuleBeiArm(r, true, -0.6, 0.3, 10, 90);
    console.log(
      `  ${r.toFixed(3)}    | ${
        frei.saeule === null
          ? "       keine Lösung    "
          : `${(frei.saeule * 100).toFixed(0).padStart(6)} cm (Arm ${(Math.atan2(frei.Ay, frei.Az) * GRAD).toFixed(0)}°)`.padEnd(23)
      }| ${hoch.saeule === null ? "KEINE Lösung" : `${(hoch.saeule * 100).toFixed(0)} cm`}`
    );
  }
  console.log("");
  console.log("  DAS ERGEBNIS IST EINDEUTIG: Mit hochstehendem Arm gibt es in keiner Kombination");
  console.log("  eine Lösung — nicht bei einer Säule bis 95 cm, keiner Kopfbreite, keinem Radius.");
  console.log("  Der Grund ist eine Zeile Geometrie: Das Auge läuft auf einem Kreis um den Bolzen,");
  console.log("  seine größte Höhe über ihm ist IMMER der Armradius, ganz gleich wo es beginnt.");
  console.log("  Ein hochstehender Arm verschiebt nur, WANN der Scheitel kommt, nicht wie hoch.");
  console.log("  Und weil der Hebelarm nie größer sein kann als der Armradius, ist der nach unten");
  console.log("  durch den 115-mm-Wächter gedeckelt. Unter 0,258 m gibt es überhaupt nichts mehr.");

  /* ------------------------------------------------- Die drei Spalten */
  const fNull = kleinsteSaeule(0, true);
  const fBreit = kleinsteSaeuleBeiArm(0.4, true);
  const heute: Spalte = {
    nr: "1",
    titel: "HEUTE",
    ruf: "Platte Ø 0,95 · nackte Säule",
    rOben: ZYLINDER_AUFNAHME.r,
    rUnten: STEMPEL_AUGE.r,
    saeule: SAEULE_HEUTE,
    Ay: HEUTE.Ay,
    Az: HEUTE.Az,
    hutR: 0,
    k: kennwert(HEUTE, 80),
    m: schalenmass(STEMPEL_AUGE.r),
    farbe: "#3f4a52",
  };
  const schlank: Spalte = {
    nr: "2",
    titel: "SCHLANK + VERKLEIDUNG",
    ruf: "Platte Ø 1,02 · Säule im Blech",
    rOben: 0.5,
    rUnten: 0.5,
    saeule: fNull.saeule!,
    Ay: fNull.Ay,
    Az: fNull.Az,
    hutR: 0.62,
    k: fNull.k!,
    m: schalenmass(0.5),
    farbe: "#1d6f34",
  };
  const breit: Spalte = {
    nr: "3",
    titel: "BREIT — das Äußerste",
    ruf: `Platte Ø ${kopfDurchmesser(0.5 - fBreit.dr0).toFixed(2)} · Säule ${(fBreit.saeule! * 100).toFixed(0)} cm`,
    rOben: 0.5 - fBreit.dr0,
    rUnten: 0.5,
    saeule: fBreit.saeule!,
    Ay: fBreit.Ay,
    Az: fBreit.Az,
    hutR: 0.5 - fBreit.dr0 + 0.12,
    k: fBreit.k!,
    m: schalenmass(0.5),
    farbe: "#9c2717",
  };
  const alle = [heute, schlank, breit];

  console.log("\n=== 3. Was der breite Kopf der SICHT kostet ===\n");
  console.log("  Anteil des Spitzenrings, den der Kopf dem Fahrer verdeckt — Greifer aufgesetzt,");
  console.log(`  Aufhängung ${AUFHAENGUNG_AUFGESETZT} m (E-065), Augpunkt ${AUGPUNKT_UNTEN} m unten / ${AUGPUNKT_OBEN.toFixed(2)} m oben.\n`);
  console.log("  Kopf-Ø | Abstand 4 m         | Abstand 7 m");
  console.log("         | Kabine unten  oben  | unten  oben");
  console.log("  -------+---------------------+---------------");
  for (const D of [0.9, 1.2, 1.6, 2.0, 2.4, 2.8]) {
    const z = [4, 7].map((abst) =>
      [AUGPUNKT_UNTEN, AUGPUNKT_OBEN]
        .map(
          (h) =>
            `${(verdeckung(D / 2, h, abst, AUFHAENGUNG_AUFGESETZT, 0.72, 2.5, 3.0) * 100).toFixed(0).padStart(5)} %`
        )
        .join(" ")
    );
    console.log(`  ${D.toFixed(2)}   | ${z[0]}       | ${z[1]}`);
  }

  /* Wo genau reisst die Sicht? */
  let grenze25 = 0;
  for (let D = 0.6; D <= 3.5; D += 0.01) {
    if (verdeckung(D / 2, AUGPUNKT_OBEN, 4, AUFHAENGUNG_AUFGESETZT, 0.72, 2.5, 3.0) < 0.25) grenze25 = D;
  }
  console.log("");
  console.log(
    `  DIE GRENZE: Bis Ø ${grenze25.toFixed(2)} m bleiben über 75 % des Spitzenrings sichtbar — im`
  );
  console.log("  schlechtesten Fall, den es gibt (Kabine oben, Greifer aufgesetzt, 4 m Abstand).");
  console.log("  Mit ABGESENKTER Kabine verdeckt der Kopf in KEINER Breite etwas: Das Auge liegt");
  console.log("  dann nur 0,5 m über ihm, der Blick streift flach daran vorbei.");

  /* ------------------------------------------------------------- Zeichnen */
  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 50, "Der Kopf ist zu schlank — es ist die Verkleidung, nicht die Säule", 29, FARBE.linie, "start", true);
  T(
    40,
    78,
    "Fünfschalengreifer · Seitenriss · die drei gerechneten Spalten im SELBEN Maßstab · tragend = Volllinie, Blech = gestrichelt · 15.09.2026",
    14,
    FARBE.grau,
    "start"
  );
  T(40, 100, '„Der Kopf ist zu schlank."  ·  „Das ist ein Zylinderschutz, kein Gusskörper."  (Patrick, 15.09.2026)', 14, FARBE.grau, "start");

  alle.forEach((v, i) => spalte(i, v));
  teile.push(
    `<rect x="${VORBILD_X}" y="150" width="${VORBILD_B}" height="640" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(VORBILD_X + 14, 176, "4  DAS VORBILD", 19, FARBE.gelb, "start", true);
  T(VORBILD_X + 14, 196, "Skizze nach Fotografien — KEINE Maßzeichnung", 13, FARBE.grau, "start");
  vorbild(VORBILD_X + 175, 250);

  /* Tafel */
  teile.push(
    `<rect x="40" y="808" width="${BREITE - 80}" height="372" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(54, 832, "Die Maße unter jeder Spalte", 13, FARBE.grau, "start");
  const reihen: Array<[string, (v: Spalte) => string, (v: Spalte) => boolean | null]> = [
    ["Deckplatte Ø (trägt)", (v) => `${kopfDurchmesser(v.rOben).toFixed(2)} m`, () => null],
    ["Verkleidung Ø oben (Blech)", (v) => (v.hutR ? `${(2 * v.hutR).toFixed(2)} m` : "keine"), () => null],
    ["Schalenbolzenkreis Ø", (v) => `${(2 * v.rUnten).toFixed(2)} m`, () => null],
    ["SÄULE (Platte bis Bolzen)", (v) => `${(v.saeule * 100).toFixed(0)} cm`, () => null],
    ["Arm über dem Bolzen (Radius)", (v) => `${armRadius(v.Ay, v.Az).toFixed(3)} m`, () => null],
    ["Arm gekippt um", (v) => `${(Math.atan2(v.Ay, v.Az) * GRAD).toFixed(0)}°`, () => null],
    ["Neigung größte (Wächter < 25°)", (v) => `${v.k.neigungMax.toFixed(1)}°`, (v) => v.k.neigungMax < 25],
    ["Hebelarm kleinster (> 115 mm)", (v) => `${(v.k.hebelMin * 1000).toFixed(0)} mm`, (v) => v.k.hebelMin > 0.115],
    ["Hebelarm geschlossen (> 200 mm)", (v) => `${(v.k.hebelZu * 1000).toFixed(0)} mm`, (v) => v.k.hebelZu > 0.2],
    [`Zylinder offen (Rohr ${ROHR.toFixed(2)} m)`, (v) => `${v.k.laengeMin.toFixed(3)} m`, (v) => v.k.laengeMin > ROHR + 0.05],
    ["Maulweite offen", (v) => `${v.m.maul.toFixed(3)} m`, () => null],
    ["Hüllkreis", (v) => `${v.m.huellkreis.toFixed(3)} m`, () => null],
    ["Schwebehöhe geschlossen", (v) => `${(v.m.schwebt * 100).toFixed(1)} cm`, () => null],
    [
      "Sicht: verdeckt bei 4 m, Kabine oben",
      (v) =>
        `${(verdeckung(Math.max(v.hutR, v.rOben + 0.01), AUGPUNKT_OBEN, 4, AUFHAENGUNG_AUFGESETZT, 0.72, 2.5, v.m.maul) * 100).toFixed(0)} %`,
      (v) =>
        verdeckung(Math.max(v.hutR, v.rOben + 0.01), AUGPUNKT_OBEN, 4, AUFHAENGUNG_AUFGESETZT, 0.72, 2.5, v.m.maul) < 0.25,
    ],
  ];
  reihen.forEach((r, k) => {
    const y = 864 + k * 23;
    T(54, y, r[0]!, 13, FARBE.grau, "start");
    alle.forEach((v, i) => {
      const ok = r[2]!(v);
      T(
        FELD_X[i]! + FELD_B - 30,
        y,
        r[1]!(v),
        14,
        ok === null ? FARBE.linie : ok ? FARBE.gut : FARBE.schlecht,
        "end",
        ok === false
      );
    });
  });

  /* Urteil */
  teile.push(
    `<rect x="40" y="1196" width="${BREITE - 80}" height="330" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(54, 1220, "Was die Bilder sagen", 13, FARBE.grau, "start");
  const kopfHeute = verdeckung(0.475, AUGPUNKT_OBEN, 4, AUFHAENGUNG_AUFGESETZT, 0.72, 2.5, 3.095) * 100;
  const kopfBreitV =
    verdeckung(breit.hutR, AUGPUNKT_OBEN, 4, AUFHAENGUNG_AUFGESETZT, 0.72, 2.5, breit.m.maul) * 100;
  const text: Array<[string, boolean]> = [
    [
      "DIE SÄULE IST NICHT DAS PROBLEM. Am Vorbild ist der Abstand Deckplatte↔Bolzen sogar GRÖSSER als bei uns: 0,37 der Maulweite gegen unsere 0,29 (am Bild geschätzt).",
      true,
    ],
    [
      "Was fehlt, ist die VERKLEIDUNG. Beim Vorbild steckt dieser ganze Bereich in einem sich nach unten verjüngenden Blech, das die fünf Zylinder abdeckt; bei uns steht dort",
      true,
    ],
    ["eine nackte Säule von Ø 0,26 m neben fünf freistehenden Zylindern. Das ist der ganze Unterschied im Bild — und er kostet keine Zeile Kinematik.", false],
    ["", false],
    [
      "EIN HOCHSTEHENDER SCHALENARM HILFT NICHT. Über alle Kopfbreiten, alle Armradien und Säulen bis 95 cm gibt es damit KEINE einzige Lösung. Der Grund ist eine Zeile",
      true,
    ],
    [
      "Geometrie: Das Zylinderauge läuft auf einem Kreis um den Bolzen, und seine größte Höhe über ihm ist immer der Armradius — gleich, ob der Arm oben oder unten beginnt.",
      false,
    ],
    ["Ein hochstehender Arm verschiebt nur, WANN der Scheitel kommt. Und weil der Hebelarm nie größer sein kann als der Armradius, ist der nach unten gedeckelt.", false],
    ["", false],
    [
      `DER BREITE KOPF IST BEZAHLBAR, ABER ER KOSTET SICHT. Spalte 3 drückt die Säule auf ${(breit.saeule! * 100).toFixed(0)} cm — dafür misst die Platte Ø ${kopfDurchmesser(breit.rOben).toFixed(2)} m, breiter als der geschlossene Korb.`,
      false,
    ],
    [
      `Mit hochgefahrener Kabine verdeckt der Kopf dann ${kopfBreitV.toFixed(0)} % des Spitzenrings statt ${kopfHeute.toFixed(0)} % heute. Material kostet er fast nichts — es ist Platte und Blech, kein Guss.`,
      false,
    ],
    ["", false],
    [
      "EMPFEHLUNG: Spalte 2. Säule 49 cm, Platte Ø 1,02 (fast wie heute), und die Verkleidung darüber. Das ist die Silhouette aus den Bildern, ohne die Anlenkung anzufassen.",
      true,
    ],
  ];
  text.forEach((z, k) => T(54, 1252 + k * 22, z[0]!, 14, z[1] ? FARBE.linie : FARBE.grau, "start", z[1]));

  T(
    40,
    1556,
    "Gerechnet mit tools/fuenfschalen/anlenkungsraum.ts, gezeichnet mit kopfbreite-blatt.ts · Rechnung und Schalenbahn prüfen sich gegen rig.ts · src/ unberührt · Bildzahlen sind Schätzungen",
    12,
    FARBE.hilfe,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-kopfbreite-2026-09-15.svg", svg);
  console.log(`\ndocs/f5-kopfbreite-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
  void auge;
  void OFFEN;
  void DR_HEUTE;
}

if (!process.env.VITEST) main();
