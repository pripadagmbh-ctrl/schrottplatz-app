/**
 * Die Anlenkung — drei Wege, den Abstand Traverse ↔ Schalenbolzen zu schließen,
 * und das Vorbild daneben. GERECHNET UND GEZEICHNET, NICHT GEBAUT.
 *
 * Anlass, wörtlich (Patrick, 15.09.2026):
 *
 *   „Das kann ich so nicht beurteilen. Also ich hab dir ein Bild geschickt von
 *    den Originalteilen, und ich kann nicht sagen, ob dann der Zylinder falsch
 *    ist. Also ich bräuchte schon irgendwie ne Zeichnung, ob das passt."
 *
 * Er hat recht: E-072 hat eine Hydraulikfrage in Worten gestellt. Entschieden
 * wird am Bild. Also ein Bild — vier Spalten, alle drei gerechneten im SELBEN
 * Maßstab, dazu das Vorbild als ausdrücklich schematische Skizze.
 *
 *   1  HEUTE              Bolzen 66,9 cm unter der Traverse
 *   2  BOLZEN HINAUF      Schalenbolzen an die Traverse
 *   3  TRAVERSE HERUNTER  Kopf zum Bolzen, Bolzen bleibt
 *   4  VORBILD            Skizze nach dem Foto, KEINE Maßzeichnung
 *
 * WARUM DER ZYLINDER ALS ZYLINDER GEZEICHNET WIRD und nicht als Strich: Nur
 * dann sieht man, ob die Stange in ihr Rohr passt. Bei Variante 2 und 3 tut
 * sie es nicht — das Auge der Kolbenstange läge 24 cm INNERHALB des Rohrs.
 * Das ist die ganze Antwort auf „ob das passt", und sie lässt sich nicht
 * beschreiben, nur zeigen.
 *
 * Gezeichnet wird aus den Maßen von `teile.ts` und der Anlenkungsrechnung aus
 * `saeulenrechnung.ts` — dieselbe Rechnung, die sich bei jedem Lauf gegen
 * `rig.ts` prüft. `src/` ist unberührt.
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/anlenkung-blatt.ts
 * Ergebnis: docs/f5-anlenkung-2026-09-15.svg + die Tabelle auf der Konsole
 */
import { writeFileSync } from "node:fs";
import {
  MASS,
  OFFEN,
  STEMPEL_AUGE,
  TRAVERSE_Y,
  ZU,
  ZYLINDER_AUFNAHME,
  mittellinie,
} from "../../src/fuenfschalen/teile";
import { LAGE } from "../../src/fuenfschalen/rig";
import {
  SAEULE_HEUTE,
  anbindung,
  anlenkungAus,
  kopfHerunter,
  probe,
  type Anlenkwert,
} from "./saeulenrechnung";

const GRAD = 180 / Math.PI;

/** Länge des Zylinderrohrs (m) — dieselbe Ableitung wie in `rig.stelleSchale`. */
const ROHR = MASS.zylinder.laenge * 0.6;
/** Außenmaße von Rohr und Stange (m) — aus `MASS.zylinder`. */
const ROHR_D = MASS.zylinder.breite;
const STANGE_D = MASS.zylinder.durchmesser;

/* ------------------------------------------------------------- Varianten */

interface Variante {
  nr: string;
  titel: string;
  ruf: string;
  /** Höhe der Zylinderaufnahme an der Traverse (m). */
  Zy: number;
  /** Höhe des Schalenbolzens (m). */
  By: number;
  /** Um so viel wandert der ganze Kopf nach unten (m) — nur Variante 3. */
  kopfRunter: number;
  farbe: string;
}

const VARIANTEN: Variante[] = [
  {
    nr: "1",
    titel: "HEUTE",
    ruf: "Bolzen 66,9 cm unter der Traverse",
    Zy: ZYLINDER_AUFNAHME.y,
    By: STEMPEL_AUGE.y,
    kopfRunter: 0,
    farbe: "#3f4a52",
  },
  {
    nr: "2",
    titel: "BOLZEN HINAUF",
    ruf: "Schalenbolzen an die Traverse",
    Zy: ZYLINDER_AUFNAHME.y,
    By: TRAVERSE_Y,
    kopfRunter: 0,
    farbe: "#9c2717",
  },
  {
    nr: "3",
    titel: "TRAVERSE HERUNTER",
    ruf: "Kopf zum Bolzen, Bolzen bleibt",
    Zy: ZYLINDER_AUFNAHME.y - SAEULE_HEUTE,
    By: STEMPEL_AUGE.y,
    kopfRunter: SAEULE_HEUTE,
    farbe: "#9c2717",
  },
];

/* ---------------------------------------------------------------- Zeichnen */

const BREITE = 1860;
const HOEHE = 1420;
/** Mittellinie (Greiferachse) jeder Spalte, in px. */
const ACHSE = [152, 592, 1032];
const FELD = { x: [40, 480, 920], b: 420 };
const VORBILD_X = 1370;
const VORBILD_B = 450;

/** Maßstab aller DREI gerechneten Spalten — einer für alle, sonst täuscht es. */
const PX = 170;
/** Bildhöhe der Aufhängung (y = 0). */
const OBEN = 205;

const FARBE = {
  papier: "#f4f2ee",
  feld: "#ffffff",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#b9bec3",
  stahl: "#8d959b",
  stahlHell: "#c9cdd1",
  rohr: "#4a5560",
  stange: "#9aa3ab",
  bolzen: "#1d2124",
  gut: "#1d6f34",
  schlecht: "#9c2717",
  geist: "#cfd4d8",
  gelb: "#d8a200",
};

const teile: string[] = [];

const T = (
  x: number,
  y: number,
  s: string,
  groesse = 14,
  f = FARBE.linie,
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

/** Weltpunkt (r, y) in Bildkoordinaten. */
function P(mx: number, r: number, y: number): [number, number] {
  return [mx + r * PX, OBEN - y * PX];
}

function polygon(pts: Array<[number, number]>, fuell: string, rand = "none", dick = 1): void {
  teile.push(
    `<polygon points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" ` +
      `fill="${fuell}" stroke="${rand}" stroke-width="${dick}"/>`
  );
}

function linie(a: [number, number], b: [number, number], f: string, d = 2, strich = ""): void {
  teile.push(
    `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" ` +
      `y2="${b[1].toFixed(1)}" stroke="${f}" stroke-width="${d}"` +
      (strich ? ` stroke-dasharray="${strich}"` : "") +
      "/>"
  );
}

function kreis(p: [number, number], r: number, fuell: string, rand = "none", dick = 1.5): void {
  teile.push(
    `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}" ` +
      `fill="${fuell}" stroke="${rand}" stroke-width="${dick}"/>`
  );
}

/** Ein liegender Kasten um die Achse: von r=−b/2 bis +b/2, Höhe h um y. */
function kasten(mx: number, y: number, b: number, h: number, f: string, rand = "none"): void {
  const [x0, y0] = P(mx, -b / 2, y + h / 2);
  teile.push(
    `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(b * PX).toFixed(1)}" ` +
      `height="${(h * PX).toFixed(1)}" fill="${f}" stroke="${rand}" stroke-width="1.2"/>`
  );
}

/**
 * Der Zylinder, als Zylinder.
 *
 * Rohr dick, Stange dünn, beide Augen als Kreise — die Forderung des Auftrags,
 * und sie hat einen handfesten Grund: Nur so sieht man, ob die Stange in ihr
 * Rohr passt. Ist der Abstand der beiden Augen KLEINER als das Rohr, wird das
 * untere Auge dorthin gezeichnet, wo es rechnerisch liegt — also mitten ins
 * Rohr hinein. Das ist keine Übertreibung, das ist der Befund.
 */
function zylinder(
  mx: number,
  Z: { r: number; y: number },
  A: { r: number; y: number },
  geist: boolean
): { passt: boolean; ueberstand: number } {
  const dr = A.r - Z.r;
  const dy = A.y - Z.y;
  const L = Math.hypot(dr, dy);
  const ux = dr / L;
  const uy = dy / L;
  /* Quer zur Achse, für die Breite des Rohrs. */
  const qx = -uy;
  const qy = ux;
  /*
   * DAS ROHR WIRD IMMER IN SEINER VOLLEN LAENGE GEZEICHNET.
   *
   * Der erste Entwurf hat es auf den Augenabstand gekuerzt, wenn der kleiner
   * war — und damit genau das versteckt, worum es geht. Ein Rohr wird nicht
   * kuerzer, weil die Anlenkung es gern haette.
   */
  const rohrEnde = { r: Z.r + ux * ROHR, y: Z.y + uy * ROHR };
  const balken = (
    von: { r: number; y: number },
    bis: { r: number; y: number },
    dicke: number,
    f: string
  ): void => {
    const h = dicke / 2;
    polygon(
      [
        P(mx, von.r + qx * h, von.y + qy * h),
        P(mx, bis.r + qx * h, bis.y + qy * h),
        P(mx, bis.r - qx * h, bis.y - qy * h),
        P(mx, von.r - qx * h, von.y - qy * h),
      ],
      f,
      geist ? "none" : "#2b3238",
      1
    );
  };
  /* Erst die Stange (sie steckt im Rohr), dann das Rohr darueber. */
  if (L > ROHR) balken(rohrEnde, A, STANGE_D, geist ? FARBE.geist : FARBE.stange);
  balken({ r: Z.r, y: Z.y }, rohrEnde, ROHR_D, geist ? FARBE.geist : FARBE.rohr);
  kreis(P(mx, Z.r, Z.y), 0.055 * PX, "none", geist ? FARBE.geist : FARBE.linie, 2.5);
  kreis(
    P(mx, A.r, A.y),
    0.05 * PX,
    L <= ROHR ? (geist ? "none" : "#ffe8e4") : "none",
    L <= ROHR ? FARBE.schlecht : geist ? FARBE.geist : FARBE.linie,
    2.5
  );
  return { passt: L > ROHR, ueberstand: L - ROHR };
}

/** Der Schalenumriss aus der Mittellinie — als dicker Strich, nicht als Fläche. */
function schale(mx: number, schwenk: number, By: number, f: string, dick: number): void {
  const versatz = By - STEMPEL_AUGE.y;
  const pts = mittellinie(schwenk).map((p) => P(mx, p.r, p.y + versatz));
  teile.push(
    `<polyline points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="${f}" stroke-width="${dick}" stroke-linejoin="round" stroke-linecap="round"/>`
  );
}

/** Eine Spalte zeichnen. */
function spalte(i: number, v: Variante, a: Anlenkwert): void {
  const mx = ACHSE[i]!;
  const fx = FELD.x[i]!;
  const id = `c${i}`;
  teile.push(
    `<clipPath id="${id}"><rect x="${fx + 2}" y="150" width="${FELD.b - 4}" height="580"/></clipPath>`,
    `<g clip-path="url(#${id})">`
  );

  /* --- Greiferachse --- */
  linie(P(mx, 0, 0.05), P(mx, 0, -2.6), FARBE.hilfe, 1, "5 5");

  /* --- Schale offen als Geist, geschlossen kräftig --- */
  schale(mx, OFFEN, v.By, FARBE.geist, 9);
  schale(mx, ZU, v.By, FARBE.stahlHell, 11);
  schale(mx, ZU, v.By, FARBE.stahl, 3);

  /* --- Kopf: Adapter, Rotator, Gehäuse, Traverse --- */
  const k = v.kopfRunter;
  kasten(mx, LAGE.adapter, 0.30, 0.34, FARBE.stahl, "#5d666d");
  if (k > 0) {
    /* Was zwischen Adapter und Rotator aufreisst — die Luecke ist der Befund. */
    const [x1, y1] = P(mx, -0.06, -0.37);
    teile.push(
      `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(0.12 * PX).toFixed(1)}" ` +
        `height="${(k * PX).toFixed(1)}" fill="none" stroke="${FARBE.schlecht}" ` +
        `stroke-width="2" stroke-dasharray="6 4"/>`
    );
  }
  kasten(mx, LAGE.rotator - k, 0.44, 0.30, FARBE.stahl, "#5d666d");
  kasten(mx, LAGE.drehwerksgehaeuse - k, 0.56, 0.30, FARBE.stahl, "#5d666d");
  kasten(mx, TRAVERSE_Y - k, MASS.traverse.breite, 0.30, FARBE.stahl, "#5d666d");

  /* --- Säule und Stempel --- */
  const saeuleOben = Math.min(TRAVERSE_Y - k, STEMPEL_AUGE.y);
  if (v.By < TRAVERSE_Y - 0.01) {
    const l = TRAVERSE_Y - k - (v.By + MASS.stempel.hoehe);
    if (l > 0.005) {
      kasten(mx, v.By + MASS.stempel.hoehe + l / 2, 0.24, l, FARBE.stahlHell, "#8d959b");
    }
  }
  void saeuleOben;
  kasten(mx, v.By + MASS.stempel.hoehe / 2, MASS.stempel.breite, MASS.stempel.hoehe, FARBE.stahl, "#5d666d");
  /* Ausleger vom Stempel zum Bolzen */
  kasten(mx, v.By, 2 * STEMPEL_AUGE.r, 0.12, FARBE.stahl, "#5d666d");

  /* --- Zylinder: offen als Geist, geschlossen voll --- */
  const Z = { r: ZYLINDER_AUFNAHME.r, y: v.Zy };
  const Aoffen = anbindung(OFFEN, v.By);
  zylinder(mx, Z, Aoffen, true);
  zylinder(mx, Z, anbindung(ZU, v.By), false);

  /* --- Bolzen zuletzt, er liegt obenauf --- */
  kreis(P(mx, STEMPEL_AUGE.r, v.By), 0.062 * PX, "#ffffff", FARBE.bolzen, 3);

  /* --- Winkelmass: Senkrechte, 25°-Grenze, wirkliche groesste Neigung --- */
  const L = 0.62;
  linie(P(mx, Z.r, Z.y), P(mx, Z.r, Z.y - L), FARBE.hilfe, 1.5, "4 4");
  const gr = 25 / GRAD;
  linie(
    P(mx, Z.r, Z.y),
    P(mx, Z.r + Math.sin(gr) * L, Z.y - Math.cos(gr) * L),
    FARBE.gut,
    2,
    "6 4"
  );
  const ne = a.neigungMax / GRAD;
  linie(
    P(mx, Z.r, Z.y),
    P(mx, Z.r + Math.sin(ne) * L, Z.y - Math.cos(ne) * L),
    a.neigungMax < 25 ? FARBE.gut : FARBE.schlecht,
    2.5
  );
  teile.push("</g>");

  /* --- Beschriftungen ausserhalb des Beschnitts --- */
  if (a.laengeOffen <= ROHR) {
    /*
     * Der Befund, angeschrieben: Offen laege das Auge der Kolbenstange
     * INNERHALB des Rohrs. Ein Zylinder kann das nicht.
     */
    const [ax, ay] = P(mx, Aoffen.r, Aoffen.y);
    linie([ax, ay], [ax + 54, ay - 46], FARBE.schlecht, 1.8);
    T(ax + 58, ay - 48, "Auge der Stange", 13, FARBE.schlecht, "start", true);
    T(ax + 58, ay - 32, `läge ${((ROHR - a.laengeOffen) * 1000).toFixed(0)} mm IM Rohr`, 12, FARBE.schlecht, "start");
  }
  if (v.kopfRunter > 0) {
    const [lx, ly] = P(mx, 0.08, -0.37 - v.kopfRunter / 2);
    T(lx + 6, ly, `Lücke ${(v.kopfRunter * 100).toFixed(1)} cm`, 13, FARBE.schlecht, "start", true);
    T(lx + 6, ly + 15, "zwischen Adapter", 11, FARBE.schlecht, "start");
    T(lx + 6, ly + 28, "und Rotator", 11, FARBE.schlecht, "start");
  }

  T(
    mx + Math.sin(ne) * L * PX + (a.neigungMax > 60 ? 6 : 0),
    OBEN - (Z.y - Math.cos(ne) * L) * PX + (a.neigungMax > 60 ? 0 : 16),
    `${a.neigungMax.toFixed(1)}°`,
    15,
    a.neigungMax < 25 ? FARBE.gut : FARBE.schlecht,
    "start",
    true
  );
}

/* ------------------------------------------------------------------ Ablauf */

function main(): void {
  const p = probe();
  if (p.fehler > 1e-12) throw new Error("Die Anlenkungsrechnung trifft rig.ts nicht mehr.");
  if (p.gegenprobe < 1e-6) throw new Error("Die Gegenprobe ist blind.");

  const werte = VARIANTEN.map((v) => anlenkungAus(v.Zy, v.By));
  /** Wie weit 2 und 3 auseinanderliegen — die Probe auf die Identität. */
  const abstand23 = (): number => {
    const a = werte[1]!;
    const b = werte[2]!;
    return Math.max(
      Math.abs(a.laengeZu - b.laengeZu),
      Math.abs(a.laengeOffen - b.laengeOffen),
      Math.abs(a.neigungMax - b.neigungMax),
      Math.abs(a.hebelMin - b.hebelMin)
    );
  };
  const drei = kopfHerunter(SAEULE_HEUTE);

  /* -------------------------------------------------- Tabelle auf Konsole */
  console.log("Die Anlenkung — drei Wege, gerechnet\n");
  const z = (n: string, w: string[]): string =>
    `  ${n.padEnd(34)}${w.map((x) => x.padStart(16)).join("")}`;
  console.log(z("", VARIANTEN.map((v) => `${v.nr} ${v.titel.slice(0, 13)}`)));
  console.log("  " + "-".repeat(82));
  console.log(z("Zylinderaufnahme (m)", VARIANTEN.map((v) => v.Zy.toFixed(4))));
  console.log(z("Schalenbolzen (m)", VARIANTEN.map((v) => v.By.toFixed(4))));
  console.log(z("Abstand dazwischen (m)", VARIANTEN.map((v) => (v.By - v.Zy).toFixed(4))));
  console.log("");
  console.log(z("Rohrlaenge (m)", VARIANTEN.map(() => ROHR.toFixed(3))));
  console.log(z("Zylinder GESCHLOSSEN (m)", werte.map((w) => w.laengeZu.toFixed(3))));
  console.log(z("Zylinder OFFEN (m)", werte.map((w) => w.laengeOffen.toFixed(3))));
  console.log(z("Hub (mm)", werte.map((w) => (w.hub * 1000).toFixed(0))));
  console.log(
    z(
      "Stange schaut aus dem Rohr (mm)",
      werte.map((w) => ((w.laengeOffen - ROHR) * 1000).toFixed(0))
    )
  );
  console.log("");
  console.log(z("Neigung groesste (Grad)  < 25", werte.map((w) => w.neigungMax.toFixed(1))));
  console.log(z("Hebelarm kleinster (mm)  > 115", werte.map((w) => (w.hebelMin * 1000).toFixed(0))));
  console.log(
    z(
      "URTEIL",
      werte.map((w) =>
        w.neigungMax < 25 && w.hebelMin > 0.115 && w.laengeOffen > ROHR ? "baubar" : "NICHT baubar"
      )
    )
  );

  console.log("\n  Variante 2 und 3 liefern dieselben Zylinderzahlen — das ist kein Fehler:");
  console.log("  Die Anlenkung kennt nur den ABSTAND zwischen Aufnahme und Bolzen, nicht,");
  console.log(
    `  wer von beiden sich bewegt hat. Beide schliessen ihn um ${(SAEULE_HEUTE * 100).toFixed(1)} cm.`
  );
  console.log(`  Probe: groesster Unterschied zwischen 2 und 3 = ${abstand23().toExponential(1)}`);
  console.log("  (nicht bitgenau null: dieselben Zahlen in anderer Reihenfolge addiert)");

  console.log("\n=== Was Variante 3 ZUSÄTZLICH anrichtet (am gebauten Netz gemessen) ===\n");
  console.log(`  Mitteltraverse wandert von ${TRAVERSE_Y.toFixed(3)} auf ${drei.traverseYneu.toFixed(3)} m`);
  console.log(`  Rotator wandert von ${LAGE.rotator.toFixed(3)} auf ${drei.rotatorY.toFixed(3)} m`);
  console.log(
    `  Tiefster Punkt des Kopfes  ${drei.tiefsterKopf.toFixed(3)} m — das sind ` +
      `${(drei.unterBolzen * 100).toFixed(1)} cm UNTER der Bolzenebene, also IM KORB`
  );
  console.log(`  Schlund 5 cm über den Bolzen versperrt: ${(drei.schlund * 1e4).toFixed(0)} cm²`);
  console.log(`  Kleinster Abstand Kopf ↔ Schale: ${(drei.freiZuSchale * 1000).toFixed(0)} mm`);
  console.log(
    `  Und oben klafft eine Lücke von ${(drei.luecke * 100).toFixed(1)} cm zwischen Adapter und Rotator:`
  );
  console.log("  die Säule ist nicht verschwunden, sie ist nur umgezogen.");

  /* ------------------------------------------------------------- Zeichnen */
  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 50, "Die Anlenkung: passt der Zylinder?", 30, FARBE.linie, "start", true);
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
    '„Ich bräuchte schon irgendwie ne Zeichnung, ob das passt."  (Patrick, 15.09.2026)',
    14,
    FARBE.grau,
    "start"
  );

  VARIANTEN.forEach((v, i) => {
    const fx = FELD.x[i]!;
    teile.push(
      `<rect x="${fx}" y="150" width="${FELD.b}" height="580" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
    );
    T(fx + 14, 176, `${v.nr}  ${v.titel}`, 19, v.farbe, "start", true);
    T(fx + 14, 196, v.ruf, 13, FARBE.grau, "start");
    spalte(i, v, werte[i]!);
    /* Legende — ohne sie ist nicht zu erkennen, was der helle Zylinder ist. */
    T(fx + 14, 706, "voll = GESCHLOSSEN · hell = OFFEN", 12, FARBE.grau, "start");
    T(
      fx + 14,
      722,
      "grün gestrichelt = Wächtergrenze 25° · Linie = größte Neigung",
      12,
      FARBE.grau,
      "start"
    );
  });

  /* ------------------------------------------------------- Vorbild-Spalte */
  teile.push(
    `<rect x="${VORBILD_X}" y="150" width="${VORBILD_B}" height="580" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(VORBILD_X + 14, 176, "4  DAS VORBILD", 19, FARBE.gelb, "start", true);
  T(VORBILD_X + 14, 196, "Skizze nach dem Foto — KEINE Maßzeichnung", 13, FARBE.grau, "start");
  vorbild(VORBILD_X + 172, 234);

  /* --------------------------------------------------------- Die Maßtafel */
  teile.push(
    `<rect x="40" y="748" width="${BREITE - 80}" height="286" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(54, 772, "Der Hub — die Zahlen unter jeder Spalte", 13, FARBE.grau, "start");
  const reihen: Array<[string, (w: Anlenkwert) => string, (w: Anlenkwert) => boolean]> = [
    ["Rohrlänge (fest, aus MASS.zylinder)", () => `${ROHR.toFixed(3)} m`, () => true],
    ["Augenabstand GESCHLOSSEN", (w) => `${w.laengeZu.toFixed(3)} m`, (w) => w.laengeZu > ROHR],
    ["Augenabstand OFFEN", (w) => `${w.laengeOffen.toFixed(3)} m`, (w) => w.laengeOffen > ROHR],
    ["Hub (Stangenweg)", (w) => `${(w.hub * 1000).toFixed(0)} mm`, () => true],
    [
      "Stange schaut aus dem Rohr, offen",
      (w) => `${((w.laengeOffen - ROHR) * 1000).toFixed(0)} mm`,
      (w) => w.laengeOffen > ROHR,
    ],
    ["Neigung größte (Wächter < 25°)", (w) => `${w.neigungMax.toFixed(1)}°`, (w) => w.neigungMax < 25],
    [
      "Hebelarm kleinster (Wächter > 115 mm)",
      (w) => `${(w.hebelMin * 1000).toFixed(0)} mm`,
      (w) => w.hebelMin > 0.115,
    ],
  ];
  reihen.forEach((r, k) => {
    const y = 806 + k * 28;
    T(54, y, r[0]!, 14, FARBE.grau, "start");
    werte.forEach((w, i) => {
      const ok = r[2]!(w);
      T(FELD.x[i]! + FELD.b - 30, y, r[1]!(w), 16, ok ? FARBE.linie : FARBE.schlecht, "end", !ok);
    });
  });
  const urteilY = 806 + reihen.length * 28 + 8;
  T(54, urteilY, "URTEIL", 16, FARBE.linie, "start", true);
  werte.forEach((w, i) => {
    const ok = w.neigungMax < 25 && w.hebelMin > 0.115 && w.laengeOffen > ROHR;
    T(
      FELD.x[i]! + FELD.b - 30,
      urteilY,
      ok ? "baubar" : "NICHT baubar",
      18,
      ok ? FARBE.gut : FARBE.schlecht,
      "end",
      true
    );
  });

  /* ------------------------------------------------------------ Das Urteil */
  teile.push(
    `<rect x="40" y="1052" width="${BREITE - 80}" height="300" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  T(54, 1076, "Was das Blatt zeigt", 13, FARBE.grau, "start");
  const text = [
    [
      `2 UND 3 SIND DIESELBE RECHNUNG. Die Anlenkung kennt nur den Abstand zwischen Zylinderaufnahme und Schalenbolzen — nicht, wer von beiden sich bewegt hat.`,
      true,
    ],
    [
      `Beide schließen ihn um ${(SAEULE_HEUTE * 100).toFixed(1)} cm, beide enden bei ${werte[1]!.laengeOffen.toFixed(3)} m Augenabstand offen. Probe: der größte Unterschied zwischen 2 und 3 ist ${abstand23().toExponential(0)} — Rundungsrest des Rechners.`,
      false,
    ],
    [
      `Das Rohr misst ${ROHR.toFixed(3)} m. Offen läge das untere Auge also ${Math.abs((werte[1]!.laengeOffen - ROHR) * 1000).toFixed(0)} mm INNERHALB des Rohrs — im Bild ist es rot eingekreist. Genau das ist „passt nicht".`,
      true,
    ],
    ["", false],
    [
      `Variante 3 richtet ZUSÄTZLICH an: Der Kopf steht dann ${(drei.unterBolzen * 100).toFixed(1)} cm unter der Bolzenebene, also im Korb; er versperrt ${(drei.schlund * 1e4).toFixed(0)} cm² vom Schlund`,
      false,
    ],
    [
      `und kommt den Schalen auf ${(drei.freiZuSchale * 1000).toFixed(0)} mm nahe. Und oben klafft eine Lücke von ${(drei.luecke * 100).toFixed(1)} cm zwischen Adapter und Rotator: DIE SÄULE IST NICHT WEG, SIE IST UMGEZOGEN.`,
      false,
    ],
    ["", false],
    [
      `WAS DAS VORBILD ANDERS MACHT (Spalte 4): Auf dem Foto ist AUSSEN GAR KEIN ZYLINDER zu sehen. Was vom Kopf zur Schale geht, ist eine kurze Lasche.`,
      true,
    ],
    [
      `Bei dieser Bauart sitzt EIN Zylinder senkrecht IM Kopf und zieht eine bewegliche Traverse; von ihr laufen fünf kurze Laschen zu den Schalen. Deshalb darf dort`,
      false,
    ],
    [
      `der Bolzen dicht unter dem Kopf sitzen: Es gibt keinen langen Zylinder, der dazwischen Platz braucht. Unsere Anlenkung ist eine andere Maschine, nicht eine schlechter gebaute.`,
      false,
    ],
  ];
  text.forEach((zeile, k) =>
    T(54, 1108 + k * 24, zeile[0] as string, 14, (zeile[1] as boolean) ? FARBE.linie : FARBE.grau, "start", zeile[1] as boolean)
  );

  T(
    40,
    1382,
    "Gezeichnet mit tools/fuenfschalen/anlenkung-blatt.ts · die Anlenkungsrechnung prüft sich bei jedem Lauf gegen rig.ts (Fehler " +
      p.fehler.toExponential(1) +
      ") · src/ unberührt",
    12,
    FARBE.hilfe,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-anlenkung-2026-09-15.svg", svg);
  console.log(`\ndocs/f5-anlenkung-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
}

/* ---------------------------------------------------------------- Vorbild */

/**
 * Die Anlenkung des Vorbilds, schematisch.
 *
 * QUELLE: `docs/f5-vorbild-aufnahme-patrick-2026-09-15.jpg`, rechte Bildhälfte
 * — ein Mehrschalengreifer in Kinshofer-Bauart, gelb eingekringelt der
 * Übergang Schale → Lager.
 *
 * WAS SICH AUS DEM FOTO ABLESEN LÄSST, und nur das steht hier:
 *   - Der Kopf ist ein kurzer, nach unten auslaufender Guss.
 *   - Die Schalenbolzen sitzen unmittelbar an seinem unteren Rand. Es gibt
 *     KEINE sichtbare Säule zwischen Kopf und Bolzen.
 *   - Zwischen Kopf und Schale läuft eine kurze, zweiseitig verbolzte LASCHE.
 *   - Ein Hydraulikzylinder ist AUSSEN NICHT ZU SEHEN.
 *
 * WAS DARAUS FOLGT — und als Deutung gekennzeichnet ist: Bei dieser Bauart
 * sitzt der Zylinder senkrecht im Kopf und zieht eine bewegliche Traverse, von
 * der die Laschen zu den Schalen gehen. Anders ließe sich ein Greifer ohne
 * äußere Zylinder nicht schließen.
 *
 * DIESE SKIZZE IST KEINE MASSZEICHNUNG. Aus einer Fotografie lassen sich keine
 * Maße nehmen; es geht allein um die ANORDNUNG, damit unsere drei Varianten
 * etwas haben, woneben man sie halten kann.
 */
function vorbild(mx: number, oben: number): void {
  const S = 168; // eigener Massstab — die Skizze ist massstabslos
  const p = (r: number, y: number): [number, number] => [mx + r * S, oben - y * S];

  /* Rotator oben */
  teile.push(
    `<rect x="${p(-0.22, -0.02)[0]}" y="${p(0, -0.02)[1]}" width="${0.44 * S}" height="${0.34 * S}" fill="#3a4148" stroke="#22282d"/>`
  );
  T(mx, oben + 0.18 * S + 4, "Rotator", 12, "#ffffff");

  /* Kopf als kurzer Konus */
  polygon(
    [p(-0.30, -0.36), p(0.30, -0.36), p(0.52, -0.86), p(-0.52, -0.86)],
    FARBE.stahl,
    "#5d666d",
    1.2
  );
  T(mx, oben + 0.62 * S, "Kopf (Guss)", 12, "#ffffff");

  /* Der Zylinder IM Kopf, gestrichelt — er ist auf dem Foto nicht zu sehen */
  teile.push(
    `<rect x="${p(-0.075, 0)[0]}" y="${p(0, -0.30)[1]}" width="${0.15 * S}" height="${0.34 * S}" ` +
      `fill="none" stroke="${FARBE.schlecht}" stroke-width="2" stroke-dasharray="5 4"/>`
  );
  teile.push(
    `<rect x="${p(-0.035, 0)[0]}" y="${p(0, -0.64)[1]}" width="${0.07 * S}" height="${0.12 * S}" ` +
      `fill="none" stroke="${FARBE.schlecht}" stroke-width="2" stroke-dasharray="5 4"/>`
  );
  T(mx + 0.34 * S, oben + 0.24 * S, "Zylinder im Kopf", 11, FARBE.schlecht, "start");
  T(mx + 0.34 * S, oben + 0.24 * S + 14, "(gedeutet, nicht sichtbar)", 11, FARBE.schlecht, "start");

  /* Bewegliche Traverse, unten aus dem Kopf heraus */
  kreisRoh(p(0, -0.78), 0.05 * S, "#ffffff", FARBE.schlecht, 2.5);
  T(mx - 0.09 * S, oben + 0.80 * S, "bewegliche", 11, FARBE.schlecht, "end");
  T(mx - 0.09 * S, oben + 0.80 * S + 14, "Traverse", 11, FARBE.schlecht, "end");

  /* Schalenbolzen unmittelbar am Kopfrand */
  const B: [number, number] = p(0.50, -0.86);
  kreisRoh(B, 0.055 * S, "#ffffff", FARBE.bolzen, 3);
  T(mx + 0.60 * S, oben + 0.86 * S - 10, "Schalenbolzen", 12, FARBE.linie, "start", true);
  T(mx + 0.60 * S, oben + 0.86 * S + 5, "direkt am Kopf", 11, FARBE.grau, "start");

  /* Schale, als dicker Bogen */
  const bogen: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const w = t * 1.5;
    bogen.push(p(0.50 + 0.55 * Math.sin(w) * (1 - 0.25 * t), -0.86 - 0.62 * (1 - Math.cos(w))));
  }
  teile.push(
    `<polyline points="${bogen.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="${FARBE.stahl}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  /* Die kurze LASCHE: bewegliche Traverse → oberes Schalenauge */
  const A: [number, number] = p(0.30, -1.04);
  teile.push(
    `<line x1="${p(0, -0.78)[0]}" y1="${p(0, -0.78)[1]}" x2="${A[0]}" y2="${A[1]}" ` +
      `stroke="${FARBE.gelb}" stroke-width="13" stroke-linecap="round"/>`
  );
  kreisRoh(p(0, -0.78), 0.035 * S, "#ffffff", FARBE.linie, 2);
  kreisRoh(A, 0.035 * S, "#ffffff", FARBE.linie, 2);
  T(mx + 0.06 * S, oben + 1.02 * S, "kurze Lasche", 12, FARBE.gelb, "start", true);
  T(mx + 0.06 * S, oben + 1.02 * S + 15, "statt langem Zylinder", 11, FARBE.gelb, "start");

  T(
    mx,
    oben + 1.62 * S,
    "Aus dem Foto ablesbar: kein äußerer Zylinder,",
    12,
    FARBE.grau
  );
  T(mx, oben + 1.62 * S + 16, "Bolzen unmittelbar unter dem Kopf.", 12, FARBE.grau);
  T(mx, oben + 1.62 * S + 38, "Rot gestrichelt = gedeutet, nicht gesehen.", 12, FARBE.schlecht);
  T(mx, oben + 1.62 * S + 54, "Skizze nach einer Fotografie, ohne Maße.", 12, FARBE.schlecht);
}

/** Kreis mit Bildkoordinaten (die Vorbildskizze hat ihren eigenen Maßstab). */
function kreisRoh(
  p: [number, number],
  r: number,
  fuell: string,
  rand: string,
  dick: number
): void {
  teile.push(
    `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}" ` +
      `fill="${fuell}" stroke="${rand}" stroke-width="${dick}"/>`
  );
}

if (!process.env.VITEST) main();
