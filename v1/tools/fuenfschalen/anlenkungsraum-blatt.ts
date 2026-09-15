/**
 * „Es kann nicht sein, dass wir da keine Lösung finden." — die Karte und die
 * beiden Lösungen, die sie zeigt. GERECHNET UND GEZEICHNET, NICHT GEBAUT.
 *
 * Anlass, wörtlich (Patrick, 15.09.2026, vor `docs/f5-anlenkung-2026-09-15.svg`):
 *
 *   „Also ich glaube, das liegt halt ein bisschen an deinem oberen Aufbau. …
 *    dass der Stempel breiter sein muss oder die Traverse, was auch immer, als
 *    der obere Teil, wo die Zylinder da sind. … Aber es kann nicht sein, dass
 *    wir da keine Lösung finden."
 *
 * ER HAT MIT DEM ERSTEN TEIL RECHT UND MIT DEM ZWEITEN AUCH: Es gibt eine
 * Lösung. Nur liegt sie in der ANDEREN Richtung als vermutet — nicht Stempel
 * breiter als der Kopf, sondern Kopf so breit wie der Stempel. Gerechnet ist
 * das in `anlenkungsraum.ts`, gezeichnet hier.
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/anlenkungsraum-blatt.ts
 * Ergebnis: docs/f5-anlenkungsraum-2026-09-15.svg + die Karte auf der Konsole
 */
import { writeFileSync } from "node:fs";
import { MASS, OBERE_ANBINDUNG, STEMPEL_AUGE, ZYLINDER_AUFNAHME } from "../../src/fuenfschalen/teile";
import {
  DR_HEUTE,
  HEUTE,
  ROHR,
  SAEULE_HEUTE,
  type Fund,
  type Kennwert,
  kennwert,
  kleinsteSaeule,
  kopfDurchmesser,
  kurve,
  probe,
  schalenmass,
  type Schalenmass,
} from "./anlenkungsraum";
import {
  FARBE,
  type Riss,
  type Werkzeug,
  bahnprobe,
  kreis,
  linie,
  risszeichnen,
} from "./anlenkungsriss";

const GRAD = 180 / Math.PI;
/** Größter Sektor je Schale, bevor sich fünf Schalen berühren: 360/5/2. */
const SEKTOR_GRENZE = 36;

/* ----------------------------------------------------------- Die Varianten */

interface Vorschlag {
  nr: string;
  titel: string;
  ruf: string;
  rOben: number;
  rUnten: number;
  saeule: number;
  Ay: number;
  Az: number;
  k: Kennwert;
  m: Schalenmass;
  farbe: string;
}

function bauen(
  nr: string,
  titel: string,
  ruf: string,
  rOben: number,
  rUnten: number,
  f: Fund,
  farbe: string
): Vorschlag {
  return {
    nr,
    titel,
    ruf,
    rOben,
    rUnten,
    saeule: f.saeule!,
    Ay: f.Ay,
    Az: f.Az,
    k: f.k!,
    m: schalenmass(rUnten),
    farbe,
  };
}

/** Höhe des Schalenbolzens bei gegebener Säule — der Kopf bleibt, wo er ist. */
function bolzenY(saeule: number): number {
  return -0.865 - saeule;
}

function zuRiss(v: Vorschlag): Riss {
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

const BREITE = 1880;
const HOEHE = 1790;
const ACHSE = [150, 590, 1030];
const FELD_X = [40, 480, 920];
const FELD_B = 420;
const VORBILD_X = 1360;
const VORBILD_B = 480;
const PX = 155;
const OBEN = 200;

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
function spalte(i: number, v: Vorschlag): void {
  const mx = ACHSE[i]!;
  const fx = FELD_X[i]!;
  const w = werkzeug(mx);
  const id = `s${clipNr++}`;
  teile.push(
    `<rect x="${fx}" y="150" width="${FELD_B}" height="600" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`,
    `<clipPath id="${id}"><rect x="${fx + 2}" y="176" width="${FELD_B - 4}" height="572"/></clipPath>`,
    `<g clip-path="url(#${id})">`
  );
  risszeichnen(w, zuRiss(v));

  /* Winkelmaß: Senkrechte, 25°-Grenze, wirkliche größte Neigung */
  const Z = { r: v.rOben, y: ZYLINDER_AUFNAHME.y };
  const L = 0.6;
  linie(w, w.P(Z.r, Z.y), w.P(Z.r, Z.y - L), FARBE.hilfe, 1.5, "4 4");
  const gr = 25 / GRAD;
  linie(w, w.P(Z.r, Z.y), w.P(Z.r + Math.sin(gr) * L, Z.y - Math.cos(gr) * L), FARBE.gut, 2, "6 4");
  const ne = v.k.neigungMax / GRAD;
  linie(
    w,
    w.P(Z.r, Z.y),
    w.P(Z.r + Math.sin(ne) * L, Z.y - Math.cos(ne) * L),
    v.k.neigungMax < 25 ? FARBE.gut : FARBE.schlecht,
    2.5
  );
  /* Die Säule als Maß */
  const yT = OBEN - (ZYLINDER_AUFNAHME.y - 0.23) * PX;
  const yB = OBEN - bolzenY(v.saeule) * PX;
  linie(w, [mx - 0.30 * PX, yT], [mx - 0.30 * PX, yB], FARBE.schlecht, 3);
  linie(w, [mx - 0.34 * PX, yT], [mx - 0.26 * PX, yT], FARBE.schlecht, 3);
  linie(w, [mx - 0.34 * PX, yB], [mx - 0.26 * PX, yB], FARBE.schlecht, 3);
  teile.push("</g>");

  T(fx + 14, 176, `${v.nr}  ${v.titel}`, 19, v.farbe, "start", true);
  T(fx + 14, 196, v.ruf, 13, FARBE.grau, "start");
  T(mx - 0.37 * PX, (yT + yB) / 2 + 5, `${(v.saeule * 100).toFixed(0)} cm`, 16, FARBE.schlecht, "end", true);
  T(
    mx + Math.sin(ne) * L * PX + 6,
    OBEN - (Z.y - Math.cos(ne) * L) * PX + 14,
    `${v.k.neigungMax.toFixed(1)}°`,
    15,
    v.k.neigungMax < 25 ? FARBE.gut : FARBE.schlecht,
    "start",
    true
  );
  T(fx + 14, 726, "voll = GESCHLOSSEN · hell = OFFEN · rote Strecke = Säule", 12, FARBE.grau, "start");
  T(fx + 14, 742, "grün gestrichelt = Wächtergrenze 25°", 12, FARBE.grau, "start");
}

/**
 * Die Anlenkung des Vorbilds, schematisch — unverändert aus E-074 übernommen.
 *
 * Quelle: `docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`. Aus dem Foto
 * ablesbar: kurzer Kopf, Schalenbolzen unmittelbar an seinem unteren Rand,
 * dazwischen eine kurze Lasche, AUSSEN KEIN ZYLINDER. Gedeutet (rot
 * gestrichelt): ein Zylinder senkrecht im Kopf, der eine bewegliche Traverse
 * zieht. KEINE MASSZEICHNUNG — aus einer Fotografie lassen sich keine Maße
 * nehmen.
 */
function vorbild(mx: number, oben: number): void {
  const S = 172;
  const p = (r: number, y: number): [number, number] => [mx + r * S, oben - y * S];
  const w: Werkzeug = { teile, px: S, P: p };
  teile.push(
    `<rect x="${p(-0.22, -0.02)[0]}" y="${p(0, -0.02)[1]}" width="${0.44 * S}" height="${0.34 * S}" fill="#3a4148" stroke="#22282d"/>`
  );
  T(mx, oben + 0.18 * S + 4, "Rotator", 12, "#ffffff");
  teile.push(
    `<polygon points="${[p(-0.3, -0.36), p(0.3, -0.36), p(0.52, -0.86), p(-0.52, -0.86)]
      .map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`)
      .join(" ")}" fill="${FARBE.stahl}" stroke="#5d666d" stroke-width="1.2"/>`
  );
  T(mx, oben + 0.62 * S, "Kopf (Guss)", 12, "#ffffff");
  teile.push(
    `<rect x="${p(-0.075, 0)[0]}" y="${p(0, -0.3)[1]}" width="${0.15 * S}" height="${0.34 * S}" ` +
      `fill="none" stroke="${FARBE.schlecht}" stroke-width="2" stroke-dasharray="5 4"/>`,
    `<rect x="${p(-0.035, 0)[0]}" y="${p(0, -0.64)[1]}" width="${0.07 * S}" height="${0.12 * S}" ` +
      `fill="none" stroke="${FARBE.schlecht}" stroke-width="2" stroke-dasharray="5 4"/>`
  );
  T(mx + 0.34 * S, oben + 0.24 * S, "Zylinder im Kopf", 11, FARBE.schlecht, "start");
  T(mx + 0.34 * S, oben + 0.24 * S + 14, "(gedeutet, nicht sichtbar)", 11, FARBE.schlecht, "start");
  kreis(w, p(0, -0.78), 0.05 * S, "#ffffff", FARBE.schlecht, 2.5);
  T(mx - 0.09 * S, oben + 0.8 * S, "bewegliche", 11, FARBE.schlecht, "end");
  T(mx - 0.09 * S, oben + 0.8 * S + 14, "Traverse", 11, FARBE.schlecht, "end");
  const B: [number, number] = p(0.5, -0.86);
  const bogen: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = t * 1.5;
    bogen.push(p(0.5 + 0.55 * Math.sin(a) * (1 - 0.25 * t), -0.86 - 0.62 * (1 - Math.cos(a))));
  }
  teile.push(
    `<polyline points="${bogen.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="${FARBE.stahl}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`
  );
  const A: [number, number] = p(0.3, -1.04);
  teile.push(
    `<line x1="${p(0, -0.78)[0]}" y1="${p(0, -0.78)[1]}" x2="${A[0]}" y2="${A[1]}" ` +
      `stroke="${FARBE.gelb}" stroke-width="13" stroke-linecap="round"/>`
  );
  kreis(w, p(0, -0.78), 0.035 * S, "#ffffff", FARBE.linie, 2);
  kreis(w, A, 0.035 * S, "#ffffff", FARBE.linie, 2);
  kreis(w, B, 0.055 * S, "#ffffff", FARBE.bolzen, 3);
  T(mx + 0.6 * S, oben + 0.86 * S - 10, "Schalenbolzen", 12, FARBE.linie, "start", true);
  T(mx + 0.6 * S, oben + 0.86 * S + 5, "direkt am Kopf", 11, FARBE.grau, "start");
  T(mx + 0.06 * S, oben + 1.02 * S, "kurze Lasche", 12, FARBE.gelb, "start", true);
  T(mx + 0.06 * S, oben + 1.02 * S + 15, "statt langem Zylinder", 11, FARBE.gelb, "start");
  T(mx, oben + 1.62 * S, "Aus dem Foto ablesbar: kein äußerer Zylinder,", 12, FARBE.grau);
  T(mx, oben + 1.62 * S + 16, "Bolzen unmittelbar unter dem Kopf.", 12, FARBE.grau);
  T(mx, oben + 1.62 * S + 38, "Rot gestrichelt = gedeutet, nicht gesehen.", 12, FARBE.schlecht);
  T(mx, oben + 1.62 * S + 54, "Skizze nach einer Fotografie, ohne Maße.", 12, FARBE.schlecht);
}

/**
 * Die Karte selbst: kleinste Säule über dem Radiusabstand.
 *
 * Eine Kurve und kein Schachbrett, weil die Anlenkung von den beiden Radien nur
 * ihre DIFFERENZ sieht — ein Feld über (rOben, rUnten) wäre entlang seiner
 * Diagonalen konstant und würde eine Genauigkeit vortäuschen, die es nicht hat.
 */
function zeichneKarte(kur: Fund[]): void {
  const x0 = 120;
  const x1 = 1180;
  const y0 = 810;
  const y1 = 960;
  const dr = (v: number): number => x0 + ((v + 0.4) / 0.7) * (x1 - x0);
  const sy = (cm: number): number => y1 - (cm / 80) * (y1 - y0);
  teile.push(
    `<rect x="40" y="768" width="${BREITE - 80}" height="222" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`,
    `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fbfaf8" stroke="#e4e0d8"/>`
  );
  T(54, 792, "DIE KARTE — kleinste Säule, die alle Wächter hält", 13, FARBE.grau, "start");
  /* Das Gebiet ohne jede Lösung */
  const ohne = kur.filter((f) => f.saeule === null);
  if (ohne.length) {
    const von = dr(Math.min(...ohne.map((f) => f.dr0)));
    teile.push(
      `<rect x="${von.toFixed(1)}" y="${y0}" width="${(x1 - von).toFixed(1)}" height="${y1 - y0}" ` +
        `fill="#f6e2de"/>`
    );
    T((von + x1) / 2, (y0 + y1) / 2, "gar keine Lösung", 15, FARBE.schlecht, "middle", true);
    T((von + x1) / 2, (y0 + y1) / 2 + 18, "(Neigung, Hebelarm, Zylinderlänge)", 12, FARBE.schlecht);
  }
  const pts = kur
    .filter((f) => f.saeule !== null)
    .map((f) => `${dr(f.dr0).toFixed(1)},${sy(f.saeule! * 100).toFixed(1)}`);
  teile.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${FARBE.linie}" stroke-width="3"/>`);
  for (const cm of [0, 20, 40, 60, 80]) {
    teile.push(
      `<line x1="${x0}" y1="${sy(cm)}" x2="${x1}" y2="${sy(cm)}" stroke="#e4e0d8" stroke-width="1"/>`
    );
    T(x0 - 8, sy(cm) + 4, `${cm}`, 11, FARBE.hilfe, "end");
  }
  for (const v of [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]) {
    T(dr(v), y1 + 16, v.toFixed(1), 11, FARBE.hilfe);
  }
  T(x0 - 8, y0 - 8, "Säule (cm)", 12, FARBE.grau, "end");
  T((x0 + x1) / 2, y1 + 34, "Bolzenkreis minus Kopfradius (m)  —  rechts: Bolzen weiter außen als der Kopf", 12, FARBE.grau);
  /* Die drei Punkte */
  const marke = (v: number, cm: number, name: string, f: string): void => {
    teile.push(
      `<circle cx="${dr(v).toFixed(1)}" cy="${sy(cm).toFixed(1)}" r="7" fill="#ffffff" stroke="${f}" stroke-width="3"/>`
    );
    T(dr(v), sy(cm) - 14, name, 13, f, "middle", true);
  };
  marke(DR_HEUTE, SAEULE_HEUTE * 100, "1 heute", "#3f4a52");
  marke(0, 49, "2 und 3", "#1d6f34");
  T(
    1220,
    830,
    "Rechts von +0,15 m hält keine Bauart mehr:",
    13,
    FARBE.schlecht,
    "start",
    true
  );
  T(1220, 850, "Der Zylinder steht zu flach, der Hebelarm bricht ein.", 12, FARBE.grau, "start");
  T(1220, 874, "Heute liegt der Greifer bei +0,125 m — ganz am Rand.", 12, FARBE.grau, "start");
  T(1220, 898, "Links davon wird die Säule kürzer, aber der Kopf breiter:", 12, FARBE.grau, "start");
  T(1220, 918, "bei −0,40 m wären es 37 cm Säule und Kopf Ø 2,0 m.", 12, FARBE.grau, "start");
  T(1220, 942, "Die Kurve ist flach zwischen −0,25 und +0,05: dort kostet", 12, FARBE.grau, "start");
  T(1220, 962, "mehr Kopfbreite fast nichts mehr an Säule.", 12, FARBE.grau, "start");
}

/* ------------------------------------------------------------------ Ablauf */

function main(): void {
  const p = probe();
  if (p.fehler > 1e-12) throw new Error("Die Anlenkungsrechnung trifft rig.ts nicht mehr.");
  if (p.gegenprobe < 1e-6) throw new Error("Die Gegenprobe ist blind.");
  const bf = bahnprobe(STEMPEL_AUGE.y, STEMPEL_AUGE.r);
  if (bf > 1e-12) throw new Error(`Die Schalenbahn trifft mittellinie() nicht: ${bf}`);

  /* ------------------------------------------------------- Die Karte */
  console.log("Der Anlenkungsraum — die kleinste Säule über dem Radiusabstand\n");
  console.log(`  Gegenprobe gegen rig.ts ${p.fehler.toExponential(1)}, Schalenbahn ${bf.toExponential(1)}`);
  console.log(`  HEUTE: rOben ${ZYLINDER_AUFNAHME.r.toFixed(3)}  rUnten ${STEMPEL_AUGE.r.toFixed(3)}  ` +
    `Abstand ${DR_HEUTE.toFixed(3)}  Säule ${(SAEULE_HEUTE * 100).toFixed(1)} cm\n`);
  const kur = kurve(-0.4, 0.3, 0.025, true);
  console.log("  rUnten−rOben | kleinste Säule | Ay     Az    | Neigung Hebel HebelZu | woran es scheitert");
  console.log("  " + "-".repeat(94));
  for (const f of kur) {
    if (f.saeule === null) {
      console.log(
        `  ${f.dr0.toFixed(3).padStart(12)} |       —        |              |                        | ` +
          `${f.grund} (${(f.luft * 100).toFixed(0)} % daneben)`
      );
      continue;
    }
    const k = f.k!;
    console.log(
      `  ${f.dr0.toFixed(3).padStart(12)} | ${(f.saeule * 100).toFixed(0).padStart(9)} cm   | ` +
        `${f.Ay.toFixed(2).padStart(5)} ${f.Az.toFixed(2).padStart(5)}  | ` +
        `${k.neigungMax.toFixed(1).padStart(6)}° ${(k.hebelMin * 1000).toFixed(0).padStart(5)} ` +
        `${(k.hebelZu * 1000).toFixed(0).padStart(6)}  |`
    );
  }
  console.log("");
  console.log("  Die Anlenkung sieht von den beiden Radien NUR IHRE DIFFERENZ. Die Karte über");
  console.log("  (rOben, rUnten) ist deshalb entlang ihrer Diagonalen konstant — was die zweite");
  console.log("  Richtung entscheidet, ist nicht die Hydraulik, sondern die Kopfbreite.");
  console.log("");
  console.log("  Und die Richtung stimmt NICHT mit der Vermutung: Je weiter der Bolzenkreis");
  console.log("  ÜBER den Kopf hinausragt (Abstand grösser), desto LÄNGER muss die Säule sein.");
  console.log("  Ab +0,15 m gibt es überhaupt keine Lösung mehr.");

  /* ------------------------------------------------- Die zwei Vorschläge */
  const fNull = kleinsteSaeule(0, true);
  const l1 = bauen(
    "2",
    "KOPF = BOLZENKREIS, schlank",
    "rOben = rUnten = 0,50 m",
    0.5,
    0.5,
    fNull,
    "#1d6f34"
  );
  const l2 = bauen(
    "3",
    "KOPF = BOLZENKREIS, Maul bleibt",
    "rOben = rUnten = 0,59 m",
    0.59,
    0.59,
    fNull,
    "#1f5d86"
  );
  const heute: Vorschlag = {
    nr: "1",
    titel: "HEUTE",
    ruf: `rOben ${ZYLINDER_AUFNAHME.r.toFixed(3)} / rUnten ${STEMPEL_AUGE.r.toFixed(3)} m`,
    rOben: ZYLINDER_AUFNAHME.r,
    rUnten: STEMPEL_AUGE.r,
    saeule: SAEULE_HEUTE,
    Ay: OBERE_ANBINDUNG.y,
    Az: OBERE_ANBINDUNG.z,
    k: kennwert(HEUTE, 80),
    m: schalenmass(STEMPEL_AUGE.r),
    farbe: "#3f4a52",
  };
  const alle = [heute, l1, l2];

  console.log("\n=== Die beiden Lösungen, am gebauten Netz nachgemessen ===\n");
  const z = (n: string, w: string[]): string => `  ${n.padEnd(34)}${w.map((x) => x.padStart(15)).join("")}`;
  console.log(z("", alle.map((v) => `${v.nr} ${v.titel.slice(0, 12)}`)));
  console.log("  " + "-".repeat(79));
  console.log(z("rOben (Zylinderaufnahme, m)", alle.map((v) => v.rOben.toFixed(3))));
  console.log(z("rUnten (Bolzenkreis, m)", alle.map((v) => v.rUnten.toFixed(3))));
  console.log(z("Kopf-Durchmesser (m)", alle.map((v) => kopfDurchmesser(v.rOben).toFixed(3))));
  console.log(z("SÄULE (cm)", alle.map((v) => (v.saeule * 100).toFixed(1))));
  console.log(z("Schalenauge Ay / Az (m)", alle.map((v) => `${v.Ay.toFixed(2)} / ${v.Az.toFixed(2)}`)));
  console.log("");
  console.log(z("Neigung größte (< 25°)", alle.map((v) => v.k.neigungMax.toFixed(1))));
  console.log(z("Hebelarm kleinster (> 115 mm)", alle.map((v) => (v.k.hebelMin * 1000).toFixed(0))));
  console.log(z("Hebelarm zu (> 200 mm)", alle.map((v) => (v.k.hebelZu * 1000).toFixed(0))));
  console.log(z(`Zylinder offen (Rohr ${ROHR.toFixed(3)} m)`, alle.map((v) => v.k.laengeMin.toFixed(3))));
  console.log(z("Hub (mm)", alle.map((v) => (v.k.hub * 1000).toFixed(0))));
  console.log("");
  console.log(z("Bauhöhe des Greifers (m)", alle.map((v) => (-bolzenY(v.saeule) + v.m.maxTiefe).toFixed(3))));
  console.log(z("Maulweite offen (m)", alle.map((v) => v.m.maul.toFixed(3))));
  console.log(z("Korbtiefe geschlossen (m)", alle.map((v) => v.m.tiefeZu.toFixed(3))));
  console.log(z("Hüllkreis (m)", alle.map((v) => v.m.huellkreis.toFixed(3))));
  console.log(z("Schwebehöhe (cm)", alle.map((v) => (v.m.schwebt * 100).toFixed(1))));
  console.log(z(`Sektor je Schale (< ${SEKTOR_GRENZE}°)`, alle.map((v) => v.m.sektor.toFixed(2))));

  /* ------------------------------------------------------------- Zeichnen */
  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 50, "Es gibt eine Lösung — sie liegt in der anderen Richtung", 30, FARBE.linie, "start", true);
  T(
    40,
    78,
    "Fünfschalengreifer · Seitenriss in der Ebene einer Schale · die drei gerechneten Spalten im SELBEN Maßstab · 15.09.2026",
    14,
    FARBE.grau,
    "start"
  );
  T(
    40,
    100,
    '„Aber es kann nicht sein, dass wir da keine Lösung finden."  (Patrick, 15.09.2026)',
    14,
    FARBE.grau,
    "start"
  );

  alle.forEach((v, i) => spalte(i, v));

  teile.push(
    `<rect x="${VORBILD_X}" y="150" width="${VORBILD_B}" height="600" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(VORBILD_X + 14, 176, "4  DAS VORBILD", 19, FARBE.gelb, "start", true);
  T(VORBILD_X + 14, 196, "Skizze nach dem Foto — KEINE Maßzeichnung", 13, FARBE.grau, "start");
  vorbild(VORBILD_X + 185, 246);

  /* ------------------------------------------------------------ Die Karte */
  zeichneKarte(kur);

  /* -------------------------------------------------------- Die Maßtafel */
  teile.push(
    `<rect x="40" y="1008" width="${BREITE - 80}" height="424" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(54, 1032, "Die Maße unter jeder Spalte", 13, FARBE.grau, "start");
  const reihen: Array<[string, (v: Vorschlag) => string, (v: Vorschlag) => boolean | null]> = [
    ["r oben — Zylinderaufnahme am Kopf", (v) => `${v.rOben.toFixed(3)} m`, () => null],
    ["r unten — Schalenbolzenkreis", (v) => `${v.rUnten.toFixed(3)} m`, () => null],
    ["Kopf-Durchmesser", (v) => `${kopfDurchmesser(v.rOben).toFixed(2)} m`, () => null],
    ["SÄULE", (v) => `${(v.saeule * 100).toFixed(0)} cm`, () => null],
    ["Bauhöhe des Greifers", (v) => `${(-bolzenY(v.saeule) + v.m.maxTiefe).toFixed(3)} m`, () => null],
    ["Neigung größte (Wächter < 25°)", (v) => `${v.k.neigungMax.toFixed(1)}°`, (v) => v.k.neigungMax < 25],
    ["Hebelarm kleinster (> 115 mm)", (v) => `${(v.k.hebelMin * 1000).toFixed(0)} mm`, (v) => v.k.hebelMin > 0.115],
    ["Hebelarm geschlossen (> 200 mm)", (v) => `${(v.k.hebelZu * 1000).toFixed(0)} mm`, (v) => v.k.hebelZu > 0.2],
    [`Zylinder offen (Rohr ${ROHR.toFixed(2)} m)`, (v) => `${v.k.laengeMin.toFixed(3)} m`, (v) => v.k.laengeMin > ROHR + 0.05],
    ["Hub", (v) => `${(v.k.hub * 1000).toFixed(0)} mm`, (v) => v.k.hub > 0.15],
    ["Maulweite offen", (v) => `${v.m.maul.toFixed(3)} m`, () => null],
    ["Korbtiefe geschlossen", (v) => `${v.m.tiefeZu.toFixed(3)} m`, () => null],
    ["Hüllkreis", (v) => `${v.m.huellkreis.toFixed(3)} m`, () => null],
    ["Schwebehöhe geschlossen", (v) => `${(v.m.schwebt * 100).toFixed(1)} cm`, () => null],
    [`Sektor je Schale (< ${SEKTOR_GRENZE}°)`, (v) => `${v.m.sektor.toFixed(1)}°`, (v) => v.m.sektor < SEKTOR_GRENZE],
    ["Schlund 5 cm über den Bolzen", () => "unverändert", () => null],
  ];
  reihen.forEach((r, k) => {
    const y = 1064 + k * 23;
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

  /* ------------------------------------------------------------- Urteil */
  teile.push(
    `<rect x="40" y="1448" width="${BREITE - 80}" height="280" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(54, 1472, "Was die Karte sagt", 13, FARBE.grau, "start");
  const text: Array<[string, boolean]> = [
    [
      "ES GIBT EINE LÖSUNG. Die Säule fällt von 66,9 auf 49 cm, der Greifer wird 18 bis 24 cm kürzer — und die Wächter von E-039 bleiben unangetastet.",
      true,
    ],
    [
      "ABER SIE LIEGT IN DER ANDEREN RICHTUNG als vermutet. Nicht der Stempel breiter als der Kopf, sondern der KOPF SO BREIT WIE DER STEMPEL.",
      true,
    ],
    [
      "Je weiter der Bolzenkreis über den Kopf hinausragt, desto länger muss die Säule sein — heute ragt er 12,5 cm hinaus, und ab 15 cm gibt es gar keine Lösung mehr.",
      false,
    ],
    ["", false],
    [
      "Die Anlenkung sieht von den beiden Radien NUR IHRE DIFFERENZ. Was die absolute Breite entscheidet, ist nicht die Hydraulik, sondern der Korb:",
      false,
    ],
    [
      "Spalte 2 zieht beide Kreise auf 0,50 m ein — der Kopf bleibt fast so schlank wie heute (Ø 1,02 statt 0,95) und die Schwebehöhe fällt von 19,4 auf 13,6 cm.",
      false,
    ],
    [
      "Der Preis steht daneben: 20 cm weniger Maulweite. Spalte 3 behält den Bolzenkreis und damit das Maul, dafür wird der Kopf Ø 1,20 m.",
      false,
    ],
    ["", false],
    [
      "WAS DAS VORBILD WEITERHIN ANDERS MACHT: Dort gibt es außen gar keinen Zylinder, sondern eine kurze Lasche und einen Zylinder im Kopf. Diese Bauart braucht",
      false,
    ],
    [
      "überhaupt keine Säule. Die Karte spricht NICHT zwingend für den großen Umbau — 49 cm sind mit der heutigen Bauart zu haben —, aber sie zeigt seine Grenze: unter 37 cm",
      false,
    ],
    ["kommt die Außenzylinder-Bauart nicht, und dafür müsste der Kopf Ø 2,0 m werden.", false],
  ];
  text.forEach((zeile, k) =>
    T(54, 1504 + k * 22, zeile[0]!, 14, zeile[1] ? FARBE.linie : FARBE.grau, "start", zeile[1])
  );

  T(
    40,
    1762,
    "Gerechnet mit tools/fuenfschalen/anlenkungsraum.ts, gezeichnet mit anlenkungsraum-blatt.ts · Rechnung und Schalenbahn prüfen sich bei jedem Lauf gegen rig.ts · src/ unberührt",
    12,
    FARBE.hilfe,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-anlenkungsraum-2026-09-15.svg", svg);
  console.log(`\ndocs/f5-anlenkungsraum-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
  void MASS;
}

if (!process.env.VITEST) main();
