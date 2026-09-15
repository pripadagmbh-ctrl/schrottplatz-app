/**
 * Der Seitenriss einer Anlenkung — Kopf, Säule, Bolzen, Schale und der
 * Zylinder ALS ZYLINDER.
 *
 * Herausgelöst aus `anlenkung-blatt.ts` (E-074) am 15.09.2026, weil ein
 * zweites Blatt dieselbe Zeichnung mit FREIEN Radien braucht. Zwei Kopien
 * derselben Zeichnung wären zwei Wahrheiten über dieselbe Maschine.
 *
 * WARUM DER ZYLINDER ALS ZYLINDER GEZEICHNET WIRD und nicht als Strich: Nur so
 * sieht man, ob die Stange in ihr Rohr passt. Und deshalb wird das ROHR IMMER
 * IN SEINER VOLLEN LÄNGE gezeichnet — der erste Entwurf von E-074 hat es auf
 * den Augenabstand gekürzt und damit genau das versteckt, worum es geht. Ein
 * Rohr wird nicht kürzer, weil die Anlenkung es gern hätte.
 */
import { MASS, OFFEN, ZU, mittellinie, schalenStationen } from "../../src/fuenfschalen/teile";
import { LAGE } from "../../src/fuenfschalen/rig";
import { AEQUATOR, ROHR } from "./anlenkungsraum";

/** Außenmaße von Rohr und Stange (m) — aus `MASS.zylinder`. */
const ROHR_D = MASS.zylinder.breite;
const STANGE_D = MASS.zylinder.durchmesser;

export const FARBE = {
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
} as const;

/** Eine zu zeichnende Anlenkung, in Weltmaßen des Greiferframes. */
export interface Riss {
  /** Radius der Zylinderaufnahme am Kopf (m). */
  rOben: number;
  /** Radius des Schalenbolzenkreises (m). */
  rUnten: number;
  /** Höhe der Zylinderaufnahme (m, unter der Aufhängung). */
  Zy: number;
  /** Höhe des Schalenbolzens (m). */
  By: number;
  /** Schalenauge gegen den Bolzen, längs und quer (m). */
  Ay: number;
  Az: number;
  /** Durchmesser der Mitteltraverse (m). */
  kopfD: number;
  /** Um so viel wandert der ganze Kopf nach unten (m) — Variante „Traverse herunter". */
  kopfRunter: number;
}

export interface Werkzeug {
  teile: string[];
  /** Weltpunkt (r, y) in Bildkoordinaten. */
  P(r: number, y: number): [number, number];
  px: number;
}

/** Wo das obere Schalenauge bei Schwenk `s` steht. */
export function auge(r: Riss, s: number): { r: number; y: number } {
  const c = Math.cos(-s);
  const sn = Math.sin(-s);
  return {
    r: r.rUnten + (r.Ay * sn + r.Az * c),
    y: r.By + (r.Ay * c - r.Az * sn),
  };
}

function polygon(w: Werkzeug, pts: Array<[number, number]>, fuell: string, rand: string): void {
  w.teile.push(
    `<polygon points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" ` +
      `fill="${fuell}" stroke="${rand}" stroke-width="1"/>`
  );
}

export function linie(
  w: Werkzeug,
  a: [number, number],
  b: [number, number],
  f: string,
  d = 2,
  strich = ""
): void {
  w.teile.push(
    `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" ` +
      `y2="${b[1].toFixed(1)}" stroke="${f}" stroke-width="${d}"` +
      (strich ? ` stroke-dasharray="${strich}"` : "") +
      "/>"
  );
}

export function kreis(
  w: Werkzeug,
  p: [number, number],
  r: number,
  fuell: string,
  rand = "none",
  dick = 1.5
): void {
  w.teile.push(
    `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r.toFixed(1)}" ` +
      `fill="${fuell}" stroke="${rand}" stroke-width="${dick}"/>`
  );
}

/** Ein liegender Kasten um die Achse. */
export function kasten(
  w: Werkzeug,
  y: number,
  b: number,
  h: number,
  f: string,
  rand = "none"
): void {
  const [x0, y0] = w.P(-b / 2, y + h / 2);
  w.teile.push(
    `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(b * w.px).toFixed(1)}" ` +
      `height="${(h * w.px).toFixed(1)}" fill="${f}" stroke="${rand}" stroke-width="1.2"/>`
  );
}

/**
 * Der Zylinder. Rohr dick, Stange dünn, beide Augen als Kreise.
 *
 * Ist der Augenabstand KLEINER als das Rohr, wird das untere Auge dorthin
 * gezeichnet, wo es rechnerisch liegt — also mitten ins Rohr hinein, rot
 * umkreist. Das ist keine Übertreibung, das ist der Befund.
 */
export function zylinder(
  w: Werkzeug,
  Z: { r: number; y: number },
  A: { r: number; y: number },
  geist: boolean
): void {
  const dr = A.r - Z.r;
  const dy = A.y - Z.y;
  const L = Math.hypot(dr, dy);
  const ux = dr / L;
  const uy = dy / L;
  const qx = -uy;
  const qy = ux;
  const rohrEnde = { r: Z.r + ux * ROHR, y: Z.y + uy * ROHR };
  const balken = (
    von: { r: number; y: number },
    bis: { r: number; y: number },
    dicke: number,
    f: string
  ): void => {
    const h = dicke / 2;
    polygon(
      w,
      [
        w.P(von.r + qx * h, von.y + qy * h),
        w.P(bis.r + qx * h, bis.y + qy * h),
        w.P(bis.r - qx * h, bis.y - qy * h),
        w.P(von.r - qx * h, von.y - qy * h),
      ],
      f,
      geist ? "none" : "#2b3238"
    );
  };
  if (L > ROHR) balken(rohrEnde, A, STANGE_D, geist ? FARBE.geist : FARBE.stange);
  balken({ r: Z.r, y: Z.y }, rohrEnde, ROHR_D, geist ? FARBE.geist : FARBE.rohr);
  kreis(w, w.P(Z.r, Z.y), 0.055 * w.px, "none", geist ? FARBE.geist : FARBE.linie, 2.5);
  kreis(
    w,
    w.P(A.r, A.y),
    0.05 * w.px,
    L <= ROHR ? (geist ? "none" : "#ffe8e4") : "none",
    L <= ROHR ? FARBE.schlecht : geist ? FARBE.geist : FARBE.linie,
    2.5
  );
}

/**
 * Der Schalenumriss aus der Mittellinie — als dicker Strich, nicht als Fläche.
 *
 * Bei freiem Bolzenkreis wird die Bahn selbst gerechnet: `mittellinie()` kennt
 * nur den gebauten Kreis. Gegenprobe im Werkzeug: Beim heutigen Bolzenkreis
 * muss die Rechnung hier `mittellinie()` treffen.
 */
export function schalenbahn(rUnten: number, By: number, s: number): Array<{ r: number; y: number }> {
  const versatz = AEQUATOR - rUnten;
  const c = Math.cos(-s);
  const sn = Math.sin(-s);
  /*
   * `schalenStationen()` legt den Drehpunkt an Station 0 und schiebt ihn um
   * `DREHPUNKT.versatz` nach innen. Ein anderer Versatz verschiebt die ganze
   * Bahn um die Differenz — mehr passiert nicht, die Kette der Sehnen bleibt.
   */
  return schalenStationen().map((p) => {
    const z = p.z + (versatz - 0.3);
    return { r: rUnten + (p.y * sn + z * c), y: By + (p.y * c - z * sn) };
  });
}

/** Gegenprobe: beim gebauten Bolzenkreis trifft `schalenbahn` `mittellinie`. */
export function bahnprobe(byHeute: number, rHeute: number): number {
  let fehler = 0;
  for (let i = 0; i <= 20; i++) {
    const s = ZU + ((OFFEN - ZU) * i) / 20;
    const a = schalenbahn(rHeute, byHeute, s);
    const b = mittellinie(s);
    for (let k = 0; k < a.length; k++) {
      fehler = Math.max(fehler, Math.abs(a[k]!.r - b[k]!.r), Math.abs(a[k]!.y - b[k]!.y));
    }
  }
  return fehler;
}

export function schale(w: Werkzeug, r: Riss, s: number, f: string, dick: number): void {
  const pts = schalenbahn(r.rUnten, r.By, s).map((p) => w.P(p.r, p.y));
  w.teile.push(
    `<polyline points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="${f}" stroke-width="${dick}" stroke-linejoin="round" stroke-linecap="round"/>`
  );
}

/**
 * Eine ganze Anlenkung zeichnen: Kopf, Säule, Stempel, Schale, Zylinder.
 *
 * Gezeichnet werden ZWEI Stellungen: geschlossen voll, offen als Geist. Nur so
 * sieht man den Hub.
 */
export function risszeichnen(w: Werkzeug, r: Riss): void {
  /* Greiferachse */
  linie(w, w.P(0, 0.05), w.P(0, -3.0), FARBE.hilfe, 1, "5 5");

  /* Schale offen als Geist, geschlossen kräftig */
  schale(w, r, OFFEN, FARBE.geist, 9);
  schale(w, r, ZU, FARBE.stahlHell, 11);
  schale(w, r, ZU, FARBE.stahl, 3);

  /* Kopf */
  const k = r.kopfRunter;
  kasten(w, LAGE.adapter, 0.3, 0.34, FARBE.stahl, "#5d666d");
  kasten(w, LAGE.rotator - k, 0.44, 0.3, FARBE.stahl, "#5d666d");
  kasten(w, LAGE.drehwerksgehaeuse - k, 0.56, 0.3, FARBE.stahl, "#5d666d");
  kasten(w, r.Zy - 0.23, r.kopfD, 0.3, FARBE.stahl, "#5d666d");

  /* Säule und Stempel */
  const saeule = r.Zy - 0.23 - (r.By + MASS.stempel.hoehe);
  if (saeule > 0.005) {
    kasten(w, r.By + MASS.stempel.hoehe + saeule / 2, 0.24, saeule, FARBE.stahlHell, "#8d959b");
  }
  kasten(
    w,
    r.By + MASS.stempel.hoehe / 2,
    MASS.stempel.breite,
    MASS.stempel.hoehe,
    FARBE.stahl,
    "#5d666d"
  );
  kasten(w, r.By, 2 * r.rUnten, 0.12, FARBE.stahl, "#5d666d");

  /* Zylinder: offen als Geist, geschlossen voll */
  const Z = { r: r.rOben, y: r.Zy };
  zylinder(w, Z, auge(r, OFFEN), true);
  zylinder(w, Z, auge(r, ZU), false);

  /* Bolzen zuletzt, er liegt obenauf */
  kreis(w, w.P(r.rUnten, r.By), 0.062 * w.px, "#ffffff", FARBE.bolzen, 3);
}

/**
 * Die VERKLEIDUNG — Blech, kein Guss.
 *
 * Patrick, 15.09.2026, zu den Vorbildbildern: „Das, was du als Guss … verortet
 * hat, das ist im Grunde genommen nur eine Abblendung. Das ist ein
 * Zylinderschutz. Also es ist kein Gusskörper."
 *
 * Deshalb wird sie GESTRICHELT gezeichnet und nie gefüllt: Sie trägt nichts,
 * sie deckt die fünf Zylinder ab. Ihr Umriss läuft von der Deckplatte (oben,
 * so weit außen wie die Zylinderaugen plus halbe Zylinderbreite) schräg
 * hinunter zur Nabe.
 */
export function verkleidung(
  w: Werkzeug,
  rOben: number,
  yOben: number,
  rUnten: number,
  yUnten: number
): void {
  const pts = [
    w.P(-rOben, yOben),
    w.P(rOben, yOben),
    w.P(rUnten, yUnten),
    w.P(-rUnten, yUnten),
  ];
  w.teile.push(
    `<polygon points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}" ` +
      `fill="none" stroke="${FARBE.gelb}" stroke-width="2.5" stroke-dasharray="9 6"/>`
  );
}

/**
 * Wie viel vom Ring der Schalenspitzen der Kopf dem Fahrer verdeckt (0..1).
 *
 * Strahlensatz in drei Dimensionen: Das Auge steht auf `augHoehe` über Grund,
 * der Greifer haengt in `abstand` Metern, seine Aufhaengung auf `aufhaengung`.
 * Der Kopf ist eine Scheibe vom Halbmesser `R` auf `kopfY` unter der
 * Aufhaengung; die Spitzen liegen auf `tiefe` unter ihr, auf einem Kreis vom
 * Halbmesser `maul/2`. Gezaehlt wird, welcher Anteil dieses Kreises hinter der
 * Scheibe verschwindet.
 *
 * Dieselbe Rechenart wie `totenStreifen` in `world/containers.ts` (E-034), nur
 * mit einer runden Blende statt einer Wand.
 */
export function verdeckung(
  R: number,
  augHoehe: number,
  abstand: number,
  aufhaengung: number,
  kopfUnterAufhaengung: number,
  tiefe: number,
  maul: number
): number {
  const K = aufhaengung - kopfUnterAufhaengung;
  const T = aufhaengung - tiefe;
  if (K >= augHoehe || T >= K) return 0; // Auge unter dem Kopf: nichts verdeckt
  const f = (augHoehe - K) / (augHoehe - T);
  const rho = maul / 2;
  let verdeckt = 0;
  const N = 720;
  for (let i = 0; i < N; i++) {
    const phi = (i / N) * Math.PI * 2;
    const x = f * (abstand + rho * Math.cos(phi)) - abstand;
    const z = f * (rho * Math.sin(phi));
    if (x * x + z * z < R * R) verdeckt++;
  }
  return verdeckt / N;
}
