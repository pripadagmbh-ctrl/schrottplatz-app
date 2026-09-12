/**
 * Objektbau — aus Grundkörpern werden erkennbare Gegenstände.
 *
 * Anlass (12.09.2026): „Die neuen Teile sehen alle wie Würfel aus, das macht
 * die Vielfalt der Objekte unnötig, wenn sie nicht erkennbar sind." Stimmt:
 * 189 der 221 neuen Objekte waren `kind: "box"`, und daraus wurde eine nackte
 * `BoxGeometry`. Ein Kühlschrank und ein Motorblock unterschieden sich nur in
 * den Kantenlängen.
 *
 * ## Wie es funktioniert
 *
 * Ein Bau setzt drei bis zwölf Grundkörper zusammen — Korpus, Tür, Griff,
 * Sockel — und **verschmilzt sie zu einer einzigen Geometrie**. Die Farbe
 * steckt danach in den Eckpunkten, nicht im Material. Deshalb kostet ein
 * Objekt aus zwölf Teilen genau so viel wie der Quader vorher: einen
 * Zeichenruf, ein Material.
 *
 * Der Kollider bleibt der Quader aus dem Katalog. Physik und Aussehen sind im
 * Spiel ohnehin getrennt — das Aussehen darf beliebig fein werden, ohne dass
 * die Physik teurer wird.
 *
 * ## Farbe nach Zweck, nicht nach Fraktion
 *
 * Ansage 12.09.2026: Unlackiertes bleibt unlackiert — Stahlträger, Rohre,
 * Aluminiumleisten behalten ihren Metallton. Weiße Ware ist weiß. Maschinen
 * sind lackiert, und zwar so, wie ihre Branche lackiert: Landmaschinen grün
 * und rot, Baumaschinen gelb, Container blau und rostrot.
 *
 * Die Farbe steht darum **im Bau**, nicht im Katalog: Der Bau weiß, was das
 * Ding ist. Ein Katalogeintrag ohne Bau bekommt weiterhin die Fraktionsfarbe.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Welcher Bau — steht am Katalogeintrag. */
export type BauId =
  | "weisseWare"
  | "kabine"
  | "rahmenbox"
  | "container"
  | "motor"
  | "maschine"
  | "tank"
  | "traeger"
  | "rohrFlansch"
  | "buendel"
  | "stapel"
  | "elektromotor"
  | "achse"
  | "platte"
  | "karosserie"
  | "fahrgestell"
  | "ausleger"
  | "schaufel"
  | "gitterturm"
  | "haufen"
  | "kleinfahrzeug"
  | "moebel"
  | "beton"
  | "trommel"
  | "fensterflaeche";

/* ------------------------------------------------------------------------ */
/* Werkzeug                                                                   */
/* ------------------------------------------------------------------------ */

interface Teil {
  geo: THREE.BufferGeometry;
  farbe: number;
}

const teile: Teil[] = [];
/**
 * Scheiben liegen getrennt.
 *
 * Sie sollen zerspringen koennen (Ansage 12.09.2026: „Glas zerspringt beim
 * Greifen, Fallenlassen ... sollte immer angewandt sein"), und was zerspringt,
 * muss verschwinden koennen. Waere es in den Koerper verschmolzen, bliebe es
 * fuer immer drin. Ein Objekt mit Scheiben kostet darum einen zweiten
 * Zeichenruf — das ist der Preis fuers Brechen.
 */
const scheiben: Teil[] = [];

/** Quader an eine Stelle setzen. */
function q(w: number, h: number, d: number, farbe: number, x = 0, y = 0, z = 0): void {
  const geo = new THREE.BoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01));
  geo.translate(x, y, z);
  (farbe === GLAS ? scheiben : teile).push({ geo, farbe });
}

/** Zylinder, wahlweise liegend. */
function z(
  r: number,
  len: number,
  farbe: number,
  achse: "x" | "y" | "z",
  x = 0,
  y = 0,
  zz = 0,
  seiten = 12
): void {
  const geo = new THREE.CylinderGeometry(r, r, len, seiten);
  if (achse === "x") geo.rotateZ(Math.PI / 2);
  if (achse === "z") geo.rotateX(Math.PI / 2);
  geo.translate(x, y, zz);
  teile.push({ geo, farbe });
}

/**
 * Alles zu einer Geometrie verschmelzen und die Farben in die Eckpunkte
 * schreiben.
 *
 * `new THREE.Color(hex)` rechnet den Wert von sRGB nach linear um — genau das,
 * was ein `MeshStandardMaterial` mit `vertexColors` erwartet. Ohne diese
 * Umrechnung wären alle Farben zu hell.
 */
function faerbeUndVerschmelze(liste: Teil[]): THREE.BufferGeometry | null {
  if (liste.length === 0) return null;
  const farbe = new THREE.Color();
  for (const t of liste) {
    const n = t.geo.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    farbe.set(t.farbe);
    for (let i = 0; i < n; i++) {
      c[i * 3] = farbe.r;
      c[i * 3 + 1] = farbe.g;
      c[i * 3 + 2] = farbe.b;
    }
    t.geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    // Alle Teile brauchen dieselben Attribute, sonst weigert sich das
    // Verschmelzen. BoxGeometry und CylinderGeometry bringen uv mit.
    t.geo.deleteAttribute("uv1");
  }
  const geo = mergeGeometries(
    liste.map((t) => t.geo),
    false
  );
  for (const t of liste) t.geo.dispose();
  liste.length = 0;
  if (!geo) return null;
  geo.computeVertexNormals();
  return geo;
}

/** Was ein Bau liefert: Koerper und, wenn vorhanden, die Scheiben. */
export interface Bauteil {
  koerper: THREE.BufferGeometry;
  glas: THREE.BufferGeometry | null;
}

function fertig(): Bauteil {
  const glas = faerbeUndVerschmelze(scheiben);
  const koerper = faerbeUndVerschmelze(teile) ?? new THREE.BoxGeometry(1, 1, 1);
  return { koerper, glas };
}

/* ------------------------------------------------------------------------ */
/* Farbtöne                                                                   */
/* ------------------------------------------------------------------------ */

/** Unlackiert: was nie Farbe gesehen hat. */
const STAHL = 0x6f6a63;
const STAHL_DUNKEL = 0x4a4642;
const GUSS = 0x55514c;
const ALU = 0xa8adb2;
const CHROM = 0xc2c7cb;
const ROST = 0x7a4a2c;
/** Lackiert. */
const WEISS = 0xe6e4de;
const WEISS_GRAU = 0xcfcdc7;
const GLAS = 0x8fb4c4;
const GUMMI = 0x2b2a29;
const LACK_GRUEN = 0x3f6b34;
const LACK_GELB = 0xb8912a;
const LACK_BLAU = 0x2f5a86;
const LACK_ROT = 0x8d3128;

/**
 * Lackton aus einer Palette wählen — fest an den Maßen, nicht zufällig.
 *
 * Sonst stünden zwanzig grüne Kabinen auf dem Platz. Fest heißt: Dasselbe
 * Objekt sieht nach dem Laden eines Spielstands wieder gleich aus, ohne dass
 * die Farbe gespeichert werden müsste.
 */
function lackton(palette: number[], w: number, h: number, d: number): number {
  const k = Math.abs(Math.round(w * 977 + h * 613 + d * 419));
  return palette[k % palette.length];
}

/* ------------------------------------------------------------------------ */
/* Die Bauten                                                                 */
/* ------------------------------------------------------------------------ */

/** Weiße Ware: Kühlschrank, Truhe, Trockner, Spülmaschine, Herd. */
function weisseWare(w: number, h: number, d: number): Bauteil {
  const stehend = h > w * 1.4;
  q(w, h * 0.94, d, WEISS, 0, h * 0.03);
  q(w * 1.01, h * 0.06, d * 1.01, STAHL_DUNKEL, 0, -h * 0.47);
  if (stehend) {
    // zwei Türen übereinander, dazwischen eine Fuge
    q(w * 0.94, h * 0.55, 0.03, WEISS_GRAU, 0, h * 0.19, d / 2);
    q(w * 0.94, h * 0.33, 0.03, WEISS_GRAU, 0, -h * 0.2, d / 2);
    q(w * 0.94, 0.015, 0.04, STAHL_DUNKEL, 0, h * 0.005, d / 2 + 0.005);
    q(0.035, h * 0.4, 0.05, CHROM, -w * 0.4, h * 0.2, d / 2 + 0.02);
    q(0.035, h * 0.22, 0.05, CHROM, -w * 0.4, -h * 0.2, d / 2 + 0.02);
  } else {
    // Deckel und Griffmulde — Truhe, Trockner, Spülmaschine
    q(w * 0.96, 0.04, d * 0.96, WEISS_GRAU, 0, h * 0.47, 0);
    q(w * 0.5, 0.05, 0.06, CHROM, 0, h * 0.42, d / 2 + 0.01);
    q(w * 0.8, h * 0.4, 0.03, WEISS_GRAU, 0, 0, d / 2);
  }
  // Kühlgitter hinten: das ist der Blick, den man auf dem Platz hat
  q(w * 0.8, h * 0.34, 0.04, STAHL_DUNKEL, 0, h * 0.2, -d / 2 - 0.01);
  return fertig();
}

/** Fahrerkabine oder Führerstand: Rahmen mit Glas und Dach. */
function kabine(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_GRUEN, LACK_ROT, LACK_GELB, LACK_BLAU], w, h, d);
  q(w, h * 0.22, d, lack, 0, -h * 0.39);
  const s = Math.min(0.1, w * 0.07);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) q(s, h * 0.62, s, STAHL_DUNKEL, sx * (w / 2 - s / 2), h * 0.03, sz * (d / 2 - s / 2));
  q(w * 1.06, h * 0.09, d * 1.06, STAHL_DUNKEL, 0, h * 0.39);
  for (const sz of [-1, 1]) q(w * 0.9, h * 0.55, 0.02, GLAS, 0, h * 0.05, sz * (d / 2 - 0.02));
  for (const sx of [-1, 1]) q(0.02, h * 0.55, d * 0.9, GLAS, sx * (w / 2 - 0.02), h * 0.05);
  z(0.05, h * 0.7, STAHL_DUNKEL, "y", w / 2 - 0.14, h * 0.3, -d / 2 + 0.2);
  q(w * 0.5, 0.05, 0.16, STAHL_DUNKEL, 0, h * 0.44, d * 0.28);
  return fertig();
}

/** Gitterbox, Regalrahmen, Bauzaun: ein Rahmen aus Kanten. */
function rahmenbox(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_BLAU, ROST, STAHL], w, h, d);
  const p = Math.min(0.08, w * 0.07);
  q(w, 0.06, d, lack, 0, -h / 2 + 0.03);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) q(p, h, p, lack, sx * (w / 2 - p / 2), 0, sz * (d / 2 - p / 2));
  for (const y of [h * 0.46, -h * 0.12]) {
    for (const sz of [-1, 1]) q(w, 0.05, 0.05, lack, 0, y, sz * (d / 2 - 0.03));
    for (const sx of [-1, 1]) q(0.05, 0.05, d, lack, sx * (w / 2 - 0.03), y);
  }
  const nx = Math.max(3, Math.round(w / 0.22));
  const nz = Math.max(3, Math.round(d / 0.22));
  for (const sz of [-1, 1])
    for (let i = 1; i < nx; i++) q(0.022, h * 0.85, 0.022, STAHL_DUNKEL, -w / 2 + (i * w) / nx, -h * 0.02, sz * (d / 2 - 0.03));
  for (const sx of [-1, 1])
    for (let i = 1; i < nz; i++) q(0.022, h * 0.85, 0.022, STAHL_DUNKEL, sx * (w / 2 - 0.03), -h * 0.02, -d / 2 + (i * d) / nz);
  return fertig();
}

/** Seecontainer, Büro- und Baustellencontainer: Rippen und Türflügel. */
function container(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_BLAU, ROST, LACK_GRUEN, 0x8a5a2b, LACK_ROT], w, h, d);
  q(w * 0.96, h * 0.96, d * 0.96, lack);
  // Eckbeschläge — daran erkennt man einen Container auf hundert Meter
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        q(0.22, 0.22, 0.22, STAHL_DUNKEL, sx * (w / 2 - 0.11), sy * (h / 2 - 0.11), sz * (d / 2 - 0.11));
  // Rahmenkanten oben und unten
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) q(w, 0.1, 0.1, STAHL_DUNKEL, 0, sy * (h / 2 - 0.05), sz * (d / 2 - 0.05));
    for (const sx of [-1, 1]) q(0.1, 0.1, d, STAHL_DUNKEL, sx * (w / 2 - 0.05), sy * (h / 2 - 0.05));
  }
  // Sicken in den Längswänden
  const n = Math.max(4, Math.round(d / 0.35));
  for (const sx of [-1, 1])
    for (let i = 0; i < n; i++)
      q(0.03, h * 0.86, 0.09, lack, sx * (w / 2 + 0.005), 0, -d / 2 + (d * (i + 0.5)) / n);
  // Türflügel an einer Stirnseite
  for (const sx of [-1, 1]) q(w * 0.46, h * 0.86, 0.04, lack, sx * w * 0.24, 0, d / 2 + 0.01);
  for (const sx of [-1, 1]) z(0.025, h * 0.8, STAHL_DUNKEL, "y", sx * w * 0.1, 0, d / 2 + 0.04, 8);
  return fertig();
}

/** Motorblock: Block, Zylinderkopf, Ölwanne, Anbauteile. */
function motor(w: number, h: number, d: number): Bauteil {
  q(w * 0.8, h * 0.5, d * 0.8, GUSS, 0, -h * 0.08);
  q(w * 0.72, h * 0.22, d * 0.74, STAHL_DUNKEL, 0, h * 0.28); // Zylinderkopf
  q(w * 0.6, h * 0.08, d * 0.6, ALU, 0, h * 0.42); // Ventildeckel
  q(w * 0.66, h * 0.18, d * 0.6, GUSS, 0, -h * 0.42); // Ölwanne
  // Krümmer: vier kurze Rohre an der Flanke
  for (let i = 0; i < 4; i++) z(0.05, w * 0.3, ROST, "x", w * 0.48, h * 0.24, -d * 0.3 + (i * d * 0.2), 8);
  z(0.12, w * 0.22, ALU, "x", -w * 0.46, h * 0.05, d * 0.2, 10); // Lichtmaschine
  z(0.1, w * 0.2, STAHL_DUNKEL, "x", -w * 0.46, -h * 0.2, -d * 0.2, 10); // Anlasser
  z(0.16, 0.06, STAHL, "z", 0, -h * 0.08, d * 0.44, 14); // Schwungrad
  return fertig();
}

/** Werkzeugmaschine, Aggregat, Pumpenstation: Körper, Verkleidung, Sockel. */
function maschine(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_GELB, LACK_BLAU, 0x5a6a5c, STAHL], w, h, d);
  q(w, h * 0.16, d, STAHL_DUNKEL, 0, -h * 0.42); // Grundrahmen
  q(w * 0.94, h * 0.66, d * 0.94, lack, 0, h * 0.02); // Verkleidung
  q(w * 0.6, h * 0.2, d * 0.6, STAHL, 0, h * 0.44); // Aufbau
  q(w * 0.5, h * 0.34, 0.05, STAHL_DUNKEL, 0, h * 0.08, d / 2 + 0.02); // Klappe
  q(w * 0.22, h * 0.2, 0.06, 0x1d2124, w * 0.3, h * 0.2, d / 2 + 0.03); // Bedienpult
  for (const sx of [-1, 1]) q(0.06, h * 0.5, 0.06, STAHL_DUNKEL, sx * (w / 2 - 0.04), h * 0.05, -d / 2 + 0.05);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) q(0.16, h * 0.08, 0.16, STAHL_DUNKEL, sx * (w / 2 - 0.1), -h * 0.5, sz * (d / 2 - 0.1)); // Füße
  return fertig();
}

/** Tank, Kessel, Behälter: liegender Zylinder mit Sattel und Stutzen. */
function tank(r: number, len: number): Bauteil {
  z(r, len * 0.92, STAHL, "z", 0, 0, 0, 16);
  for (const sz of [-1, 1]) z(r * 0.99, len * 0.04, STAHL_DUNKEL, "z", 0, 0, sz * len * 0.46, 16); // Böden
  for (const sz of [-1, 1]) q(r * 1.7, r * 0.5, r * 0.5, STAHL_DUNKEL, 0, -r * 0.85, sz * len * 0.3); // Sattel
  z(r * 0.3, r * 0.5, STAHL_DUNKEL, "y", 0, r * 0.95, -len * 0.2, 10); // Domdeckel
  z(r * 0.12, r * 0.6, ROST, "y", 0, r * 0.9, len * 0.25, 8); // Stutzen
  for (let i = 0; i < 3; i++) z(r * 1.03, len * 0.03, STAHL_DUNKEL, "z", 0, 0, -len * 0.25 + i * len * 0.25, 16); // Ringe
  return fertig();
}

/** Doppel-T-Träger: drei Platten statt eines Balkens. */
function traeger(w: number, h: number, d: number): Bauteil {
  const lang = Math.max(w, h, d);
  const dick = Math.min(w, h, d);
  const flansch = dick * 2.6;
  // Länge liegt auf der größten Kante
  if (lang === d) {
    q(flansch, dick * 0.45, d, STAHL, 0, flansch * 0.5);
    q(flansch, dick * 0.45, d, STAHL, 0, -flansch * 0.5);
    q(dick * 0.5, flansch, d, STAHL_DUNKEL, 0, 0);
  } else {
    q(lang, dick * 0.45, flansch, STAHL, 0, flansch * 0.5);
    q(lang, dick * 0.45, flansch, STAHL, 0, -flansch * 0.5);
    q(lang, flansch, dick * 0.5, STAHL_DUNKEL, 0, 0);
  }
  return fertig();
}

/** Rohr mit Flanschen an beiden Enden. */
function rohrFlansch(r: number, len: number): Bauteil {
  z(r * 0.82, len, STAHL, "z", 0, 0, 0, 14);
  for (const sz of [-1, 1]) z(r * 1.15, len * 0.05, ROST, "z", 0, 0, sz * len * 0.48, 14);
  z(r * 0.9, len * 0.06, STAHL_DUNKEL, "z", 0, 0, 0, 14);
  return fertig();
}

/** Bund: mehrere Stäbe oder Rohre, mit Spanngurten zusammengehalten. */
function buendel(w: number, h: number, d: number): Bauteil {
  const lang = Math.max(w, h, d);
  const r = Math.min(w, h) * 0.16;
  let i = 0;
  for (let sx = -1; sx <= 1; sx++) {
    for (let sy = -1; sy <= 1; sy++) {
      const versatz = (i % 3) * 0.03 - 0.03;
      z(r, lang * (0.9 + (i % 4) * 0.03), i % 3 === 0 ? ROST : STAHL, lang === d ? "z" : "x",
        lang === d ? sx * r * 2.1 : versatz * 4,
        sy * r * 2.1,
        lang === d ? versatz * 4 : sx * r * 2.1,
        10);
      i++;
    }
  }
  for (const t of [-1, 1]) {
    if (lang === d) q(r * 7, r * 7, 0.05, GUMMI, 0, 0, t * lang * 0.3);
    else q(0.05, r * 7, r * 7, GUMMI, t * lang * 0.3, 0, 0);
  }
  return fertig();
}

/** Stapel: mehrere Platten übereinander, leicht versetzt. */
function stapel(w: number, h: number, d: number): Bauteil {
  const lack = lackton([STAHL, ROST, LACK_ROT, LACK_BLAU], w, h, d);
  const n = Math.max(3, Math.min(7, Math.round(h / 0.12)));
  const dicke = h / n;
  for (let i = 0; i < n; i++) {
    const vx = (((i * 37) % 11) / 11 - 0.5) * w * 0.12;
    const vz = (((i * 53) % 13) / 13 - 0.5) * d * 0.12;
    q(w * 0.96, dicke * 0.82, d * 0.96, i % 2 ? lack : STAHL_DUNKEL, vx, -h / 2 + dicke * (i + 0.5), vz);
  }
  return fertig();
}

/** Elektromotor, Pumpe: Zylinder mit Rippen, Klemmkasten, Fußplatte. */
function elektromotor(w: number, h: number, d: number): Bauteil {
  const r = Math.min(w, h) * 0.42;
  z(r, d * 0.72, STAHL_DUNKEL, "z", 0, h * 0.06, 0, 14);
  for (let i = 0; i < 7; i++) z(r * 1.12, d * 0.035, STAHL_DUNKEL, "z", 0, h * 0.06, -d * 0.3 + i * d * 0.1, 14);
  for (const sz of [-1, 1]) z(r * 0.72, d * 0.1, ALU, "z", 0, h * 0.06, sz * d * 0.4, 14); // Lagerschilde
  z(r * 0.16, d * 0.22, CHROM, "z", 0, h * 0.06, d * 0.5, 10); // Welle
  q(w * 0.45, h * 0.26, d * 0.4, STAHL, 0, h * 0.42, 0); // Klemmkasten
  q(w, h * 0.12, d * 0.8, STAHL_DUNKEL, 0, -h * 0.44, 0); // Fußplatte
  return fertig();
}

/** Achse: Rohr mit Naben und Bremstrommeln. */
function achse(w: number, h: number, d: number): Bauteil {
  const lang = Math.max(w, d);
  const achsRichtung = lang === w ? "x" : "z";
  const r = Math.min(h, Math.min(w, d)) * 0.3;
  z(r, lang * 0.72, STAHL_DUNKEL, achsRichtung, 0, 0, 0, 12);
  for (const s of [-1, 1]) {
    const x = achsRichtung === "x" ? s * lang * 0.38 : 0;
    const zz = achsRichtung === "z" ? s * lang * 0.38 : 0;
    z(r * 2.4, lang * 0.1, GUSS, achsRichtung, x, 0, zz, 14); // Trommel
    z(r * 1.4, lang * 0.06, ROST, achsRichtung, x * 1.12, 0, zz * 1.12, 12); // Nabe
  }
  q(lang * 0.3, r * 1.2, r * 1.2, STAHL, 0, -r * 1.6, 0); // Federbock
  return fertig();
}

/** Blech, Tafel, Wandelement: Platte mit umgekanteten Rändern. */
function platte(w: number, h: number, d: number): Bauteil {
  const lack = lackton([STAHL, ROST, ALU], w, h, d);
  const duenn = Math.min(w, h, d);
  const flach = duenn === h;
  const a = flach ? w : w;
  const b = flach ? d : h;
  if (flach) {
    q(a, duenn * 0.7, b, lack);
    for (const s of [-1, 1]) q(a, duenn * 2.2, duenn * 1.5, STAHL_DUNKEL, 0, 0, s * (b / 2 - duenn));
    for (let i = 1; i < 4; i++) q(a * 0.9, duenn * 1.4, duenn * 1.1, lack, 0, duenn * 0.5, -b / 2 + (i * b) / 4);
  } else {
    q(a, b, duenn * 0.7, lack);
    for (const s of [-1, 1]) q(a, duenn * 1.5, duenn * 2.2, STAHL_DUNKEL, 0, s * (b / 2 - duenn), 0);
    for (let i = 1; i < 4; i++) q(a * 0.9, duenn * 1.1, duenn * 1.4, lack, 0, -b / 2 + (i * b) / 4, duenn * 0.5);
  }
  return fertig();
}

/** Karosserie: Wanne, Kabine mit Glas, Raeder. Die Laenge liegt auf Z. */
function karosserie(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_ROT, LACK_BLAU, WEISS_GRAU, 0x2f3a32, ROST], w, h, d);
  q(w, h * 0.34, d, lack, 0, -h * 0.2);
  q(w * 0.92, h * 0.34, d * 0.44, lack, 0, h * 0.16, -d * 0.05);
  q(w * 0.86, h * 0.3, 0.03, GLAS, 0, h * 0.16, d * 0.17);
  q(w * 0.86, h * 0.3, 0.03, GLAS, 0, h * 0.16, -d * 0.27);
  for (const sx of [-1, 1]) q(0.03, h * 0.26, d * 0.4, GLAS, sx * w * 0.46, h * 0.16, -d * 0.05);
  q(w * 0.9, h * 0.06, d * 0.42, STAHL_DUNKEL, 0, h * 0.34, -d * 0.05);
  q(w * 0.8, h * 0.12, d * 0.1, STAHL_DUNKEL, 0, -h * 0.06, d * 0.48);
  const rr = Math.min(h * 0.3, d * 0.11);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) z(rr, w * 0.14, GUMMI, "x", sx * w * 0.46, -h * 0.36, sz * d * 0.3, 10);
  return fertig();
}

/** Fahrgestell: zwei Laengstraeger, Quertraeger, Achse, Raeder, Deichsel. */
function fahrgestell(w: number, h: number, d: number): Bauteil {
  for (const sx of [-1, 1]) q(w * 0.12, h * 0.3, d * 0.92, STAHL_DUNKEL, sx * w * 0.34, h * 0.1, 0);
  const n = Math.max(3, Math.round(d / 1.1));
  for (let i = 0; i < n; i++) q(w * 0.78, h * 0.12, 0.1, ROST, 0, h * 0.1, -d * 0.4 + (i * d * 0.8) / (n - 1));
  z(Math.min(w, h) * 0.09, w * 0.8, STAHL_DUNKEL, "x", 0, -h * 0.14, d * 0.1, 10);
  const rr = Math.min(h * 0.42, d * 0.1);
  for (const sx of [-1, 1]) z(rr, w * 0.12, GUMMI, "x", sx * w * 0.46, -h * 0.14, d * 0.1, 12);
  q(w * 0.1, h * 0.12, d * 0.3, STAHL, 0, h * 0.05, -d * 0.55);
  return fertig();
}

/** Ausleger, Schwinge, Gitterausleger: langer Kasten mit Gelenkaugen. */
function ausleger(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_GELB, LACK_GRUEN, ROST, STAHL], w, h, d);
  const lang = Math.max(w, d);
  const laengs: "x" | "z" = lang === d ? "z" : "x";
  const dick = Math.min(w, h, d);
  if (laengs === "z") {
    q(w * 0.7, h * 0.8, d * 0.92, lack);
    for (const sy of [-1, 1]) q(w * 0.78, h * 0.14, d * 0.9, STAHL_DUNKEL, 0, sy * h * 0.36, 0);
  } else {
    q(w * 0.92, h * 0.8, d * 0.7, lack);
    for (const sy of [-1, 1]) q(w * 0.9, h * 0.14, d * 0.78, STAHL_DUNKEL, 0, sy * h * 0.36, 0);
  }
  for (const s2 of [-1, 1]) {
    const x = laengs === "x" ? s2 * lang * 0.47 : 0;
    const zz = laengs === "z" ? s2 * lang * 0.47 : 0;
    z(dick * 0.45, w * 0.9, GUSS, "x", x, 0, zz, 12);
  }
  z(dick * 0.22, lang * 0.5, CHROM, laengs, 0, h * 0.5, 0, 10);
  return fertig();
}

/** Schaufel oder Loeffel: Rueckwand, Boden, Seitenwaende, Zaehne. */
function schaufel(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_GELB, STAHL, ROST], w, h, d);
  q(w, h * 0.9, d * 0.12, lack, 0, 0, -d * 0.42);
  q(w, h * 0.14, d * 0.85, lack, 0, -h * 0.38, d * 0.04);
  for (const sx of [-1, 1]) q(w * 0.06, h * 0.85, d * 0.85, lack, sx * w * 0.47, 0, d * 0.04);
  q(w, h * 0.1, d * 0.1, STAHL_DUNKEL, 0, -h * 0.42, d * 0.44);
  const n = Math.max(3, Math.round(w / 0.35));
  for (let i = 0; i < n; i++)
    q(w * 0.06, h * 0.1, d * 0.16, GUSS, -w * 0.42 + (i * w * 0.84) / (n - 1), -h * 0.42, d * 0.52);
  q(w * 0.5, h * 0.2, d * 0.2, STAHL_DUNKEL, 0, h * 0.42, -d * 0.3);
  return fertig();
}

/** Gitterturm, Mastschuss, Geruestrahmen: Gurte mit Riegeln. */
function gitterturm(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_GELB, ROST, STAHL], w, h, d);
  const lang = Math.max(w, h, d);
  const senkrecht = lang === h;
  const g = Math.min(w, h, d) * 0.14;
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      if (senkrecht) q(g, h, g, lack, a * (w / 2 - g), 0, b * (d / 2 - g));
      else q(lang, g, g, lack, 0, a * (h / 2 - g), b * (d / 2 - g));
    }
  const n = Math.max(3, Math.round(lang / 0.6));
  for (let i = 0; i <= n; i++) {
    const u = -lang / 2 + (i * lang) / n;
    if (senkrecht) {
      q(w - g, g * 0.7, g * 0.7, lack, 0, u, d / 2 - g);
      q(w - g, g * 0.7, g * 0.7, lack, 0, u, -(d / 2 - g));
      q(g * 0.7, g * 0.7, d - g, lack, w / 2 - g, u, 0);
    } else {
      q(g * 0.7, h - g, g * 0.7, lack, u, 0, d / 2 - g);
      q(g * 0.7, g * 0.7, d - g, lack, u, h / 2 - g, 0);
      q(g * 0.7, g * 0.7, d - g, lack, u, -(h / 2 - g), 0);
    }
  }
  return fertig();
}

/** Loser Haufen: viele kleine Brocken durcheinander. */
function haufen(w: number, h: number, d: number): Bauteil {
  const toene = [STAHL, ROST, STAHL_DUNKEL, GUSS];
  for (let i = 0; i < 26; i++) {
    const f = (k: number) => (((i * 7919 + k * 104729) % 1000) / 1000 - 0.5) * 2;
    const s2 = 0.12 + Math.abs(f(3)) * 0.22;
    q(
      w * s2,
      h * s2 * 1.4,
      d * s2,
      toene[i % toene.length],
      f(1) * w * 0.34,
      -h * 0.5 + h * (0.12 + Math.abs(f(4)) * 0.7),
      f(2) * d * 0.34
    );
  }
  return fertig();
}

/** Quad, Roller, Jetski, Aufsitzmaeher: kleiner Koerper mit Sitz und Raedern. */
function kleinfahrzeug(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_ROT, LACK_BLAU, LACK_GRUEN, 0x1f2226], w, h, d);
  q(w * 0.7, h * 0.34, d * 0.8, lack, 0, -h * 0.06);
  q(w * 0.5, h * 0.2, d * 0.3, 0x24262a, 0, h * 0.2, -d * 0.08);
  q(w * 0.62, h * 0.16, d * 0.25, lack, 0, h * 0.12, d * 0.34);
  q(w * 0.9, 0.05, 0.05, CHROM, 0, h * 0.34, d * 0.26);
  const rr = Math.min(h * 0.32, d * 0.14);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) z(rr, w * 0.16, GUMMI, "x", sx * w * 0.42, -h * 0.3, sz * d * 0.3, 10);
  return fertig();
}

/** Sofa, Schrank, Kuechenzeile: Korpus mit Front und Fuessen. */
function moebel(w: number, h: number, d: number): Bauteil {
  const holz = lackton([0x7a5a3a, 0x8d7250, 0xbdb5a6, 0x4c4a46], w, h, d);
  const polster = lackton([0x5c6a58, 0x6b5a52, 0x47506a], w, h, d);
  const weich = h < w * 0.75 && d > h * 0.7;
  if (weich) {
    q(w, h * 0.45, d, polster, 0, -h * 0.22);
    q(w, h * 0.55, d * 0.3, polster, 0, h * 0.22, -d * 0.34);
    for (const sx of [-1, 1]) q(w * 0.1, h * 0.5, d, polster, sx * w * 0.45, h * 0.05, 0);
  } else {
    q(w, h * 0.92, d, holz, 0, h * 0.04);
    const n = Math.max(2, Math.round(h / 0.55));
    for (let i = 0; i < n; i++) {
      q(w * 0.92, (h * 0.86) / n - 0.03, 0.03, STAHL_DUNKEL, 0, -h * 0.42 + ((i + 0.5) * h * 0.86) / n, d / 2);
      q(w * 0.12, 0.03, 0.04, CHROM, w * 0.3, -h * 0.42 + ((i + 0.5) * h * 0.86) / n, d / 2 + 0.02);
    }
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) q(0.07, h * 0.1, 0.07, STAHL_DUNKEL, sx * (w / 2 - 0.06), -h * 0.47, sz * (d / 2 - 0.06));
  return fertig();
}

/** Betonteil: rauer Koerper mit Bewehrungsstummeln. */
function beton(w: number, h: number, d: number): Bauteil {
  q(w, h, d, 0x9a958c);
  for (let i = 0; i < 6; i++) {
    const f = (k: number) => (((i * 6151 + k * 24593) % 997) / 997 - 0.5) * 2;
    q(w * 0.18, h * 0.16, d * 0.18, 0x86817a, f(1) * w * 0.4, f(2) * h * 0.4, f(3) * d * 0.4);
  }
  const lang = Math.max(w, d);
  for (let i = 0; i < 5; i++)
    z(0.02, lang * 0.3, ROST, lang === d ? "z" : "x", (i - 2) * w * 0.18, h * 0.3, lang === d ? d * 0.55 : (i - 2) * d * 0.18, 6);
  return fertig();
}

/** Kabeltrommel, Seiltrommel: zwei Scheiben mit Wickel dazwischen. */
function trommel(r: number, len: number): Bauteil {
  for (const s2 of [-1, 1]) z(r, len * 0.12, 0x6b5433, "x", s2 * len * 0.44, 0, 0, 18);
  z(r * 0.72, len * 0.72, 0x3a3330, "x", 0, 0, 0, 18);
  z(r * 0.26, len * 1.02, 0x6b5433, "x", 0, 0, 0, 12);
  return fertig();
}

/**
 * Fensterfront, Schaufenster, Glasfassade, Duschkabine: Rahmen mit Scheiben.
 *
 * Eigener Bau statt `platte`, weil hier das Glas die Hauptsache ist — und Glas
 * gehoert in den Scheibenteil, damit es zerspringen kann.
 */
function fensterflaeche(w: number, h: number, d: number): THREE.BufferGeometry | Bauteil {
  const rahmen = lackton([ALU, STAHL_DUNKEL, WEISS_GRAU], w, h, d);
  const duenn = Math.min(w, h, d);
  const flach = duenn === d;
  const a = flach ? w : w;
  const b = flach ? h : d;
  const r = Math.max(0.05, Math.min(a, b) * 0.06);
  // Aussenrahmen
  if (flach) {
    for (const sy of [-1, 1]) q(a, r, duenn * 1.6, rahmen, 0, sy * (b / 2 - r / 2), 0);
    for (const sx of [-1, 1]) q(r, b, duenn * 1.6, rahmen, sx * (a / 2 - r / 2), 0, 0);
  } else {
    for (const sy of [-1, 1]) q(a, duenn * 1.6, r, rahmen, 0, sy * (h / 2 - duenn), 0);
    for (const sx of [-1, 1]) q(r, duenn * 1.6, b, rahmen, sx * (a / 2 - r / 2), 0, 0);
  }
  // Sprossen und Scheiben dazwischen
  const felder = Math.max(2, Math.round(a / 1.1));
  for (let i = 1; i < felder; i++) {
    const x = -a / 2 + (i * a) / felder;
    if (flach) q(r * 0.7, b - r * 2, duenn * 1.4, rahmen, x, 0, 0);
    else q(r * 0.7, duenn * 1.4, b - r * 2, rahmen, x, 0, 0);
  }
  for (let i = 0; i < felder; i++) {
    const x = -a / 2 + ((i + 0.5) * a) / felder;
    if (flach) q(a / felder - r, b - r * 2.4, duenn * 0.5, GLAS, x, 0, 0);
    else q(a / felder - r, duenn * 0.5, b - r * 2.4, GLAS, x, 0, 0);
  }
  return fertig();
}

/* ------------------------------------------------------------------------ */

/**
 * Geometrie für einen Bau. `dims` ist dasselbe wie im Katalog:
 * box = [w,h,d], cyl = [r,len].
 */
export function baueGeometrie(bau: BauId, dims: number[], kind: string): Bauteil {
  const [a, b, c] = dims;
  const w = kind === "cyl" ? a * 2 : a;
  const h = kind === "cyl" ? a * 2 : b;
  const d = kind === "cyl" ? b : c;
  teile.length = 0;
  switch (bau) {
    case "weisseWare":
      return weisseWare(w, h, d);
    case "kabine":
      return kabine(w, h, d);
    case "rahmenbox":
      return rahmenbox(w, h, d);
    case "container":
      return container(w, h, d);
    case "motor":
      return motor(w, h, d);
    case "maschine":
      return maschine(w, h, d);
    case "tank":
      return tank(kind === "cyl" ? a : Math.min(w, h) / 2, kind === "cyl" ? b : d);
    case "traeger":
      return traeger(w, h, d);
    case "rohrFlansch":
      return rohrFlansch(kind === "cyl" ? a : Math.min(w, h) / 2, kind === "cyl" ? b : d);
    case "buendel":
      return buendel(w, h, d);
    case "stapel":
      return stapel(w, h, d);
    case "elektromotor":
      return elektromotor(w, h, d);
    case "achse":
      return achse(w, h, d);
    case "platte":
      return platte(w, h, d);
    case "karosserie":
      return karosserie(w, h, d);
    case "fahrgestell":
      return fahrgestell(w, h, d);
    case "ausleger":
      return ausleger(w, h, d);
    case "schaufel":
      return schaufel(w, h, d);
    case "gitterturm":
      return gitterturm(w, h, d);
    case "haufen":
      return haufen(w, h, d);
    case "kleinfahrzeug":
      return kleinfahrzeug(w, h, d);
    case "moebel":
      return moebel(w, h, d);
    case "beton":
      return beton(w, h, d);
    case "trommel":
      return trommel(kind === "cyl" ? a : Math.min(w, h) / 2, kind === "cyl" ? b : d);
    case "fensterflaeche":
      return fensterflaeche(w, h, d) as Bauteil;
    default:
      return { koerper: new THREE.BoxGeometry(w, h, d), glas: null };
  }
}
