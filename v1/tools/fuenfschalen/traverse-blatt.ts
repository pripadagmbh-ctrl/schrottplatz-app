/**
 * Das Blatt: drei Traversen nebeneinander, offen und geschlossen.
 *
 * Ergebnis: `docs/f5-traverse-2026-09-15.svg` — zum Ansehen auf dem iPhone in
 * der Planmappe unter `/v1/plaene/`. Es soll ohne Begleittext verstaendlich
 * sein: grosse Schrift, drei klar getrennte Spalten, kein Fliesstext im Bild.
 *
 * WAS GEZEICHNET IST UND WAS GEMESSEN. Die Umrisse sind ein Seitenriss aus den
 * Bahnfunktionen von `teile.ts` (`feineStationen`, `fersenStationen`,
 * `zahnBahn`, `mittellinie`) — dieselben Kurven, aus denen das Netz gebaut
 * wird, in der Radialebene. Die Querschnittshoehen daneben sind die der
 * Teileliste (400 x 280 mm am Bolzen, 220 x 130 an Station 0, 120 x 80 am
 * Zahnfuss). Die ZAHLEN auf dem Blatt sind nicht aus der Zeichnung abgegriffen,
 * sondern gerechnet (`traverse-rechnen.ts`) bzw. am gebauten Modell gemessen
 * (`traverse-messen.ts`).
 *
 * Aufruf:  npx vite-node tools/fuenfschalen/traverse-blatt.ts
 */
import { writeFileSync } from "node:fs";
import {
  MASS,
  OFFEN,
  SCHALEN_ABSCHNITTE,
  STEMPEL_AUGE,
  ZU,
  feineStationen,
  fersenStationen,
  schalenEnde,
  schwenkFuer,
  zahnBahn,
} from "../../src/fuenfschalen/teile";
import { Kennwert, kennwerte } from "./traverse-rechnen";
import { A, A_NACHGESTELLT, B, C, Variante, traverseHoehe } from "./traverse-varianten";
import { Messung, miss } from "./traverse-messen";

/* --------------------------------------------------------------- Der Rahmen */

const BREITE = 1240;
const HOEHE = 1800;
/** Pixel je Meter. Beide Ansichten im SELBEN Massstab — sonst taeuscht das Blatt. */
const PX = 104;
const SPALTE = [20, 430, 840];
const SPALTE_B = 380;

const FARBE = {
  papier: "#f4f2ee",
  linie: "#1d2124",
  guss: "#6f787e",
  gussHell: "#98a1a7",
  schale: "#454d52",
  zylinder: "#b8410f",
  hilfe: "#8d9599",
  gut: "#1d6f34",
  schlecht: "#9c2717",
  band: "#e3ded6",
  /* Das Bauteil, um das es geht, ist das einzige in eigener Farbe. */
  traverse: "#1f5d86",
};

const teile: string[] = [];
const zeichne = (s: string): void => {
  teile.push(s);
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function pfad(punkte: Array<[number, number]>, fuellung: string, strich = "none", dicke = 0): void {
  const d = punkte.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  zeichne(
    `<path d="${d} Z" fill="${fuellung}" stroke="${strich}" stroke-width="${dicke}" ` +
      `stroke-linejoin="round"/>`
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
      `${gestrichelt ? ' stroke-dasharray="7 6"' : ""}/>`
  );
}

/* ------------------------------------------------------------ Der Seitenriss */

interface Riss {
  /** Bildmitte (Drehachse) in Pixeln. */
  mx: number;
  /** Hoehe y = 0 (Aufhaengepunkt) in Pixeln. */
  my: number;
}

const umR = (r: Riss, meterR: number): number => r.mx + meterR * PX;
const umY = (r: Riss, meterY: number): number => r.my - meterY * PX;

/** Die Schalenbahn in der Radialebene, fuer einen Schwenk (Meter). */
export function bahn(schwenk: number): Array<{ r: number; y: number; h: number }> {
  const c = Math.cos(-schwenk);
  const s = Math.sin(-schwenk);
  const dreh = (y: number, z: number): { r: number; y: number } => ({
    r: STEMPEL_AUGE.r + (y * s + z * c),
    y: STEMPEL_AUGE.y + (y * c - z * s),
  });
  const raus: Array<{ r: number; y: number; h: number }> = [];
  /*
   * Die FERSE — vom Bolzen an das obere Schalenende. Dort ist der Gusskoerper
   * am dicksten (280 mm nach der Teileliste) und laeuft auf 130 mm zusammen.
   */
  const ferse = fersenStationen(8, 0.3);
  for (let i = 0; i < ferse.length - 1; i++) {
    const p = ferse[i]!;
    const t = i / (ferse.length - 1);
    raus.push({ ...dreh(p.y, p.z), h: 0.28 + (0.13 - 0.28) * t });
  }
  /* Und weiter bis zur Spitze; die Hoehe folgt derselben Verjuengung wie das Netz. */
  const fein = feineStationen(4);
  for (const p of fein) {
    const v = 1 - 0.7 * (Math.min(SCHALEN_ABSCHNITTE, p.k) / SCHALEN_ABSCHNITTE) ** 1.3;
    raus.push({ ...dreh(p.y, p.z), h: 0.13 * v + 0.045 });
  }
  /*
   * Der Zahn — EIN Gussstueck mit der Schale (E-013), kein aufgesetzter
   * Stempel.
   *
   * `zahnBahn` liegt im Rahmen der GREIFERSPITZE, nicht im Rahmen des
   * Drehpunkts: `rig.ts` haengt sie an `schalenEnde()` und dreht sie um deren
   * Tangente (`spitze.rotation.x = ende.th`). Ohne diese Kette landet die
   * Spitze geschlossen auf r 0,668 statt auf r 0,14 — der Waechter „zeichnet
   * die Schale dort, wo die Kinematik sie rechnet" hat genau das gemeldet.
   */
  const ende = schalenEnde();
  const ce = Math.cos(ende.th);
  const se = Math.sin(ende.th);
  const zahn = zahnBahn(4, OFFEN);
  for (let i = 0; i < zahn.length; i++) {
    const p = zahn[i]!;
    const t = i / (zahn.length - 1);
    const y = ende.y + (p.y * ce - p.z * se);
    const z = ende.z + (p.y * se + p.z * ce);
    raus.push({ ...dreh(y, z), h: 0.08 + (0.02 - 0.08) * t });
  }
  return raus;
}

/** Ein Sichelzug als gefuellter Umriss, an der Seite `seite` (+1 rechts, −1 links). */
function zeichneSchale(r: Riss, schwenk: number, seite: number): void {
  const b = bahn(schwenk);
  const oben: Array<[number, number]> = [];
  const unten: Array<[number, number]> = [];
  for (let i = 0; i < b.length; i++) {
    const p = b[i]!;
    const q = b[Math.min(i + 1, b.length - 1)]!;
    const o = b[Math.max(i - 1, 0)]!;
    const dr = q.r - o.r;
    const dy = q.y - o.y;
    const l = Math.hypot(dr, dy) || 1;
    /* Normale in der Radialebene. */
    const nr = (-dy / l) * (p.h / 2);
    const ny = (dr / l) * (p.h / 2);
    oben.push([umR(r, seite * (p.r + nr)), umY(r, p.y + ny)]);
    unten.push([umR(r, seite * (p.r - nr)), umY(r, p.y - ny)]);
  }
  pfad([...oben, ...unten.reverse()], FARBE.schale, FARBE.linie, 1.6);
}

/** Wo die Kolbenstange an der Schale angreift (Meter) — wie `anbindungspunkt`. */
function anbindung(v: Variante, schwenk: number): { r: number; y: number } {
  const c = Math.cos(-schwenk);
  const s = Math.sin(-schwenk);
  return {
    r: STEMPEL_AUGE.r + (v.Ay * s + v.Az * c),
    y: STEMPEL_AUGE.y + (v.Ay * c - v.Az * s),
  };
}

/** Ein Rechteck in Metern. */
function kasten(
  r: Riss,
  rMitte: number,
  yMitte: number,
  breite: number,
  hoehe: number,
  fuellung: string
): void {
  pfad(
    [
      [umR(r, rMitte - breite / 2), umY(r, yMitte + hoehe / 2)],
      [umR(r, rMitte + breite / 2), umY(r, yMitte + hoehe / 2)],
      [umR(r, rMitte + breite / 2), umY(r, yMitte - hoehe / 2)],
      [umR(r, rMitte - breite / 2), umY(r, yMitte - hoehe / 2)],
    ],
    fuellung,
    FARBE.linie,
    1.6
  );
}

function zeichneRiss(r: Riss, v: Variante, oeffnung: number): void {
  const schwenk = schwenkFuer(oeffnung);
  const tY = traverseHoehe(v.Zy);

  /* Aufhaengung, Rotator, Drehwerksgehaeuse — unveraendert in allen Varianten. */
  kasten(r, 0, -0.2, MASS.aufhaengung.breite, MASS.aufhaengung.hoehe, FARBE.gussHell);
  kasten(r, 0, -0.51, MASS.rotator.breite, MASS.rotator.hoehe, FARBE.gussHell);
  kasten(r, 0, -0.73, MASS.drehwerksgehaeuse.breite, MASS.drehwerksgehaeuse.hoehe, FARBE.gussHell);

  /* Die Saeule von der Traverse zum Stempel. */
  kasten(r, 0, (tY + STEMPEL_AUGE.y + MASS.stempel.hoehe) / 2, 0.24, tY - STEMPEL_AUGE.y - MASS.stempel.hoehe, FARBE.guss);

  /* Die Mitteltraverse — das Bauteil, um das es geht. Darum hervorgehoben. */
  const tH = MASS.traverse.hoehe * 0.75;
  pfad(
    [
      [umR(r, -v.durchmesser / 2), umY(r, tY + tH / 2)],
      [umR(r, v.durchmesser / 2), umY(r, tY + tH / 2)],
      [umR(r, (v.durchmesser / 2) * 0.86), umY(r, tY - tH / 2)],
      [umR(r, (-v.durchmesser / 2) * 0.86), umY(r, tY - tH / 2)],
    ],
    FARBE.traverse,
    FARBE.linie,
    3
  );
  kasten(r, 0, tY + MASS.traverse.hoehe * 0.38, v.durchmesser * 0.62, 0.05, FARBE.traverse);

  /* Der Stempel — sitzt vollstaendig UEBER der Bolzenebene (E-009). */
  kasten(
    r,
    0,
    STEMPEL_AUGE.y + MASS.stempel.hoehe / 2,
    MASS.stempel.breite,
    MASS.stempel.hoehe,
    FARBE.guss
  );

  /* Die fuenf Schalen — in der Seitenansicht zwei davon, links und rechts. */
  for (const seite of [1, -1]) {
    zeichneSchale(r, schwenk, seite);
    /* Der Ausleger vom Stempel an den Bolzen (Position 10). */
    linie(
      umR(r, seite * MASS.stempel.breite * 0.35),
      umY(r, STEMPEL_AUGE.y),
      umR(r, seite * STEMPEL_AUGE.r),
      umY(r, STEMPEL_AUGE.y),
      FARBE.guss,
      11
    );
    /* Der Zylinder. */
    const a = anbindung(v, schwenk);
    for (const [von, bis, dicke, farbe] of [
      [0, 0.55, 15, FARBE.zylinder],
      [0.45, 1, 7, "#d8d2c9"],
    ] as Array<[number, number, number, string]>) {
      linie(
        umR(r, seite * (v.Zr + (a.r - v.Zr) * von)),
        umY(r, v.Zy + (a.y - v.Zy) * von),
        umR(r, seite * (v.Zr + (a.r - v.Zr) * bis)),
        umY(r, v.Zy + (a.y - v.Zy) * bis),
        farbe,
        dicke
      );
    }
    /* Die beiden Augen. */
    for (const [pr, py] of [
      [v.Zr, v.Zy],
      [a.r, a.y],
    ]) {
      zeichne(
        `<circle cx="${umR(r, seite * pr!).toFixed(1)}" cy="${umY(r, py!).toFixed(1)}" r="7" ` +
          `fill="${FARBE.papier}" stroke="${FARBE.linie}" stroke-width="2"/>`
      );
    }
    /* Der Bolzen, um den die Schale dreht. */
    zeichne(
      `<circle cx="${umR(r, seite * STEMPEL_AUGE.r).toFixed(1)}" cy="${umY(r, STEMPEL_AUGE.y).toFixed(1)}" ` +
        `r="8" fill="${FARBE.papier}" stroke="${FARBE.linie}" stroke-width="2.4"/>`
    );
  }

  /* Die Drehachse — nur so weit, wie in dieser Stellung Bauteil da ist. */
  const tiefste = Math.min(...bahn(schwenk).map((p) => p.y - p.h / 2));
  linie(umR(r, 0), umY(r, 0.1), umR(r, 0), umY(r, tiefste - 0.08), FARBE.hilfe, 1.4, true);
}

/**
 * Die Zylinderneigung ins Bild schreiben — mit Lot, Winkelbogen und Zahl.
 *
 * Das Lot ist die Senkrechte durch die Zylinderaufnahme. Gegen sie wird
 * gemessen, genau wie `zylinderNeigung` in `rig.ts` es rechnet.
 */
function zeichneNeigung(r: Riss, v: Variante, oeffnung: number): void {
  const schwenk = schwenkFuer(oeffnung);
  const a = anbindung(v, schwenk);
  const x0 = umR(r, v.Zr);
  const y0 = umY(r, v.Zy);
  const x1 = umR(r, a.r);
  const y1 = umY(r, a.y);
  const winkel = (Math.atan2(Math.abs(a.r - v.Zr), Math.abs(a.y - v.Zy)) * 180) / Math.PI;
  linie(x0, y0, x0, y0 + 66, FARBE.hilfe, 1.8, true);
  const l = Math.hypot(x1 - x0, y1 - y0);
  const bx = x0 + ((x1 - x0) / l) * 52;
  const by = y0 + ((y1 - y0) / l) * 52;
  zeichne(
    `<path d="M${x0.toFixed(1)} ${(y0 + 52).toFixed(1)} A52 52 0 0 ${x1 > x0 ? 0 : 1} ` +
      `${bx.toFixed(1)} ${by.toFixed(1)}" fill="none" stroke="${FARBE.zylinder}" stroke-width="2.6"/>`
  );
  /*
   * Die Zahl steht AUSSEN neben der Aufnahme, nicht unter ihr: Unter der
   * Aufnahme liegen Saeule, Stempel und Schalen dicht beieinander, und eine
   * Beschriftung dort ist auf dem Telefon nicht mehr zu lesen.
   */
  text(
    x0 + 46,
    y0 + 10,
    `${winkel.toFixed(1).replace(".", ",")}°`,
    29,
    FARBE.zylinder,
    "start",
    true
  );
}

/**
 * Die Massketten an der Traverse: Ø quer darueber, dazu die Beschriftung.
 *
 * Steht ueber dem Bauteil, nicht darunter — unter der Traverse laufen Saeule,
 * Zylinder und Schalen, und eine Masslinie dort waere zwischen ihnen nicht zu
 * lesen.
 */
function zeichneMass(r: Riss, v: Variante): void {
  const tY = traverseHoehe(v.Zy);
  const y = umY(r, tY);
  const l = umR(r, -v.durchmesser / 2);
  const re = umR(r, v.durchmesser / 2);
  /* Heller Untergrund, damit die Masslinie auf dem dunklen Bauteil lesbar bleibt. */
  linie(l, y, re, y, FARBE.papier, 9);
  linie(l, y, re, y, FARBE.traverse, 2.6);
  for (const x of [l, re]) linie(x, y - 11, x, y + 11, FARBE.traverse, 2.6);
  text(
    l - 14,
    y + 10,
    `Ø ${v.durchmesser.toFixed(2).replace(".", ",")}`,
    27,
    FARBE.traverse,
    "end",
    true
  );
}

/**
 * Legendenband: Massstab und was welche Farbe bedeutet.
 *
 * Steht einmal quer unter den sechs Rissen, nicht dreimal daneben — das Blatt
 * soll ohne Begleittext verstaendlich sein, aber nicht dreimal dasselbe sagen.
 */
function zeichneLegende(y: number): void {
  linie(24, y, 24 + PX, y, FARBE.linie, 3.5);
  linie(24, y - 9, 24, y + 9, FARBE.linie, 3.5);
  linie(24 + PX, y - 9, 24 + PX, y + 9, FARBE.linie, 3.5);
  text(24 + PX + 12, y + 9, "1 m", 23, FARBE.linie, "start", true);
  const marke = (x: number, farbe: string, was: string, gestrichelt = false): void => {
    linie(x, y, x + 40, y, farbe, gestrichelt ? 4.5 : 9, gestrichelt);
    text(x + 50, y + 9, was, 23, "#3a4146", "start");
  };
  marke(232, FARBE.zylinder, "Zylinder, Neigung gegen das Lot");
  marke(620, FARBE.gut, "Hebelarm am Bolzen", true);
  marke(910, FARBE.traverse, "Mitteltraverse");
}

/** Der Hebelarm als Lot vom Bolzen auf die Wirkungslinie. */
function zeichneHebel(r: Riss, v: Variante, oeffnung: number): void {
  const schwenk = schwenkFuer(oeffnung);
  const a = anbindung(v, schwenk);
  const dr = a.r - v.Zr;
  const dy = a.y - v.Zy;
  const l = Math.hypot(dr, dy);
  const ur = dr / l;
  const uy = dy / l;
  const t = (STEMPEL_AUGE.r - v.Zr) * ur + (STEMPEL_AUGE.y - v.Zy) * uy;
  const fr = v.Zr + ur * t;
  const fy = v.Zy + uy * t;
  linie(
    umR(r, STEMPEL_AUGE.r),
    umY(r, STEMPEL_AUGE.y),
    umR(r, fr),
    umY(r, fy),
    FARBE.gut,
    4.5,
    true
  );
  zeichne(
    `<circle cx="${umR(r, fr).toFixed(1)}" cy="${umY(r, fy).toFixed(1)}" r="5" fill="${FARBE.gut}"/>`
  );
}

/* ------------------------------------------------------------------ Zahlen */

/** Deutsche Schreibweise — Patrick liest das Blatt, nicht der Rechner. */
function komma(x: number, stellen: number): string {
  return x.toFixed(stellen).replace(".", ",");
}

/** Vorzeichen mitschreiben, damit „gegen heute" ohne Nachdenken zu lesen ist. */
function delta(x: number, stellen: number, einheit: string): string {
  if (Math.abs(x) < 0.5 / 10 ** stellen) return "±0 " + einheit;
  return `${x > 0 ? "+" : "−"}${komma(Math.abs(x), stellen)} ${einheit}`;
}

function zahl(x: number, y: number, was: string, wert: string, farbe = FARBE.linie): void {
  text(x, y, was, 21, "#5a6166");
  text(x + SPALTE_B - 24, y, wert, 25, farbe, "end", true);
}

/* ------------------------------------------------------------------ Das Blatt */

function main(): void {
  const varianten = [A, B, C];
  const k: Kennwert[] = varianten.map(kennwerte);
  /*
   * `varianten.map(miss)` waere ein Fehler: `map` reicht den Index als
   * zweites Argument durch, und das ist hier der Schalter `korb`. Bei Index 0
   * stuende dann ueberall 0 Liter.
   */
  const m: Messung[] = varianten.map((v) => miss(v));
  const kA = kennwerte(A);
  const mNach = miss(A_NACHGESTELLT);
  const kNach = kennwerte(A_NACHGESTELLT);

  zeichne(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);

  /* Kopf. */
  text(24, 52, "Fünfschalengreifer — welche Mitteltraverse?", 40, FARBE.linie, "start", true);
  text(24, 88, "Seitenriss, alle drei im gleichen Maßstab · 15.09.2026 · E-009", 23, "#5a6166");
  text(
    BREITE - 24,
    52,
    "nur Vorschau — am Bagger ändert sich nichts",
    22,
    FARBE.schlecht,
    "end",
    true
  );
  text(BREITE - 24, 82, "Grabtiefe in allen drei gleich: 2,751 m", 22, FARBE.gut, "end", true);
  linie(24, 104, BREITE - 24, 104, FARBE.linie, 2);

  /* Kopfband, dann beide Ansichten dicht untereinander, dann die Zahlen. */
  const kopfY = 158;
  const offenY = 254;
  const zuY = 604;

  for (let i = 0; i < 3; i++) {
    const v = varianten[i]!;
    const x = SPALTE[i]!;
    const mitte = x + SPALTE_B / 2;

    /* Spaltenkopf. */
    zeichne(
      `<rect x="${x}" y="${kopfY - 46}" width="${SPALTE_B}" height="76" rx="8" fill="${FARBE.band}"/>`
    );
    text(mitte, kopfY - 12, v.name, 40, FARBE.linie, "middle", true);
    text(mitte, kopfY + 18, v.ruf, 23, "#5a6166", "middle");

    /* Offen. */
    text(x + 6, offenY - 26, "OFFEN", 24, "#5a6166", "start", true);
    const rOffen: Riss = { mx: mitte, my: offenY };
    zeichneRiss(rOffen, v, 1);
    zeichneHebel(rOffen, v, 1);
    zeichneNeigung(rOffen, v, 1);
    zeichneMass(rOffen, v);

    /* Geschlossen. */
    text(x + 6, zuY - 26, "GESCHLOSSEN", 24, "#5a6166", "start", true);
    const rZu: Riss = { mx: mitte, my: zuY };
    zeichneRiss(rZu, v, 0);
    zeichneHebel(rZu, v, 0);
    zeichneNeigung(rZu, v, 0);
    zeichneMass(rZu, v);

    /* Trennlinie zwischen den Spalten. */
    if (i < 2) linie(x + SPALTE_B + 15, kopfY - 50, x + SPALTE_B + 15, 1570, "#cfc9c0", 2);

    /* Zahlen. */
    let y = 984;
    const K = k[i]!;
    const M = m[i]!;
    text(x, y, "ZYLINDERNEIGUNG   Ziel unter 20°", 22, FARBE.linie, "start", true);
    y += 30;
    zahl(x, y, "offen", `${komma(K.neigungOffen, 1)}°`);
    y += 30;
    zahl(x, y, "geschlossen", `${komma(K.neigungZu, 1)}°`);
    y += 30;
    zahl(
      x,
      y,
      "größte über den Weg",
      `${komma(K.neigungMax, 1)}°`,
      K.neigungMax < 20 ? FARBE.gut : FARBE.schlecht
    );

    y += 50;
    text(x, y, "HEBELARM   Ziel über 0,10 m", 22, FARBE.linie, "start", true);
    y += 30;
    zahl(x, y, "geschlossen", `${komma(K.hebelZu, 3)} m`);
    y += 30;
    zahl(x, y, "offen (schwächste Stelle)", `${komma(K.hebelOffen, 3)} m`);
    y += 30;
    zahl(
      x,
      y,
      "Schließkraft gegen heute",
      delta(((K.hebelMin - kA.hebelMin) / kA.hebelMin) * 100, 0, "%"),
      K.hebelMin >= kA.hebelMin ? FARBE.gut : FARBE.schlecht
    );

    y += 50;
    text(x, y, "KORB   nimmt die Traverse Ladung weg?", 22, FARBE.linie, "start", true);
    y += 30;
    zahl(x, y, "Korbinhalt netto", `${(M.nettokorb * 1000).toFixed(0)} l`);
    y += 30;
    zahl(
      x,
      y,
      "gegen heute",
      delta((M.nettokorb - m[0]!.nettokorb) * 1000, 0, "l"),
      FARBE.gut
    );
    y += 30;
    zahl(
      x,
      y,
      "Mündung zugebaut",
      `${((M.schatten / M.muendung) * 100).toFixed(0)} %`,
      M.schatten / M.muendung > 0.62 ? FARBE.schlecht : FARBE.linie
    );

    y += 50;
    text(x, y, "AUSSEHEN UND BAU", 22, FARBE.linie, "start", true);
    y += 30;
    zahl(
      x,
      y,
      "Kopf gegen Korbweite",
      `${((v.durchmesser / M.breiteZu) * 100).toFixed(0)} %`,
      v.durchmesser / M.breiteZu > 0.5 ? FARBE.schlecht : FARBE.linie
    );
    y += 30;
    zahl(x, y, "Kopf wirkt", v.aussehen, v.durchmesser > 1 ? FARBE.schlecht : FARBE.linie);
    y += 30;
    /*
     * Gegen die Traverse der Variante A, nicht gegen `TRAVERSE_Y`.
     *
     * `TRAVERSE_Y` ist die Einbauhoehe des GEBAUTEN Standes, und der ist seit
     * E-039 die Variante B. Gegen ihn gerechnet meldete das Blatt fuer B „0 cm"
     * und fuer A „−10 cm" — richtig gerechnet und trotzdem falsch: Das Blatt
     * vergleicht drei Vorschlaege gegen den Stand VOR der Entscheidung.
     */
    zahl(
      x,
      y,
      "Traverse rückt hoch um",
      `${((traverseHoehe(v.Zy) - traverseHoehe(A.Zy)) * 100).toFixed(0)} cm`
    );
    y += 30;
    zahl(
      x,
      y,
      "Zylinderauge im Guss",
      M.augeImGuss ? "ja" : `Konsole ${(M.augeAbstand * 1000).toFixed(0)} mm`,
      M.augeImGuss ? FARBE.gut : FARBE.schlecht
    );
  }

  zeichneLegende(922);

  /* Fussband. */
  linie(24, 1600, BREITE - 24, 1600, FARBE.linie, 2);
  text(24, 1638, "Unverändert in allen drei", 23, FARBE.linie, "start", true);
  text(
    24,
    1668,
    `Grabtiefe 2,751 m · Bauhöhe zu 2,505 m · Hüllkreis 3,232 m · Bruttokorb 1.615 l · ` +
      `Sektor 26,3° von 36° · fünf Spitzen treffen sich (142 mm von der Achse, wie heute)`,
    22,
    "#5a6166"
  );
  text(24, 1706, "Gemessen am gebauten Modell über die Knotennamen", 23, FARBE.linie, "start", true);
  text(
    24,
    1736,
    `Zahn = Knoten 07_ZAHN, nicht „äußerster Punkt" — bei einer nach innen gekrümmten Sichel ` +
      `liegt der außen auf der Rückseite. Zahlen aus tools/fuenfschalen/traverse-rechnen.ts und traverse-messen.ts`,
    22,
    "#5a6166"
  );
  text(
    24,
    1774,
    `Fußnote: Ø 0,70 mit bester Anlenkung käme auf ${komma(kNach.neigungMax, 1)}° und ` +
      `${komma(kNach.hebelMin, 3)} m — Hebelarm erreicht, Neigung nicht. Auch dort verlässt ` +
      `das Zylinderauge den Guss (Konsole ${(mNach.augeAbstand * 1000).toFixed(0)} mm).`,
    22,
    "#5a6166"
  );

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>
` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BREITE} ${HOEHE}" ` +
    `width="${BREITE}" height="${HOEHE}">\n` +
    teile.join("\n") +
    "\n</svg>\n";
  writeFileSync("docs/f5-traverse-2026-09-15.svg", svg);
  console.log(`docs/f5-traverse-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`);
  console.log("");
  console.log("Die Zahlen des Blattes");
  for (let i = 0; i < 3; i++) {
    const v = varianten[i]!;
    console.log(
      `  ${v.name}  Neigung zu/offen/max ${k[i]!.neigungZu.toFixed(1)}/${k[i]!.neigungOffen.toFixed(1)}/` +
        `${k[i]!.neigungMax.toFixed(1)}°   Hebel zu/offen ${k[i]!.hebelZu.toFixed(3)}/${k[i]!.hebelOffen.toFixed(3)} m   ` +
        `Zyl ${k[i]!.laengeZu.toFixed(3)}/${k[i]!.laengeOffen.toFixed(3)} Hub ${k[i]!.hub.toFixed(3)}   ` +
        `Netto ${(m[i]!.nettokorb * 1000).toFixed(0)} l   Muendung zu ${((m[i]!.schatten / m[i]!.muendung) * 100).toFixed(0)} %`
    );
  }
  console.log(
    `  ${A_NACHGESTELLT.name}  max ${kNach.neigungMax.toFixed(1)}°  Hebel ${kNach.hebelMin.toFixed(3)} m  ` +
      `Konsole ${(mNach.augeAbstand * 1000).toFixed(0)} mm`
  );
  void ZU;
}

/*
 * Nur als Werkzeug ausfuehren. `test/traverse.test.ts` importiert `bahn`, um
 * die gezeichnete Grabtiefe gegen die gemessene zu halten — dabei soll kein
 * Blatt geschrieben werden.
 */
if (!process.env.VITEST) main();
