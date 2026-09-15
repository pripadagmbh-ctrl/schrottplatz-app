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
  | "einspurig"
  | "wasserfahrzeug"
  | "kufenRaupe"
  | "moebel"
  | "beton"
  | "trommel"
  | "fensterflaeche"
  /** Der Kehrbesen aus zusammengequetschtem Maschendraht (E-031, 15.09.2026). */
  | "besen";

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

/**
 * Ein Draht von A nach B — fuer Geflechte, die nicht achsparallel laufen.
 *
 * `q()` setzt nur achsparallele Quader; ein Maschendraht laeuft aber schraeg.
 * Der Stab wird als duenner Quader entlang der eigenen Z-Achse gebaut, in die
 * Richtung gedreht und auf die Mitte der Strecke gesetzt. Ein Draht kostet
 * damit dasselbe wie ein Quader: 12 Dreiecke, und alles verschmilzt am Ende
 * zu einer einzigen Geometrie.
 */
const DRAHT_ACHSE = new THREE.Vector3(0, 0, 1);
function draht(
  a: THREE.Vector3,
  b: THREE.Vector3,
  dick: number,
  farbe: number
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  // Zu kurze Stuecke ergeben entartete Dreiecke — und die haben schon einmal
  // NaN in die konvexe Huelle getragen (scrapItems.ts, `sauber`).
  if (!Number.isFinite(len) || len < 0.006) return;
  const geo = new THREE.BoxGeometry(dick, dick, len);
  geo.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      DRAHT_ACHSE,
      new THREE.Vector3(dx / len, dy / len, dz / len)
    )
  );
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  teile.push({ geo, farbe });
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
  /**
   * Mehrere konvexe Huellen statt einer — fuer Formen mit Taille.
   *
   * `scrapItems.ts` baut den Kollider sonst als EINE konvexe Huelle um alle
   * Eckpunkte. Das trifft die meisten Objekte gut, versagt aber bei allem, was
   * eingeschnuert ist: Eine konvexe Huelle kennt keine Taille, sie ueberbrueckt
   * sie. Beim Kehrbesen in seiner Trichterform war der schmale Hals dadurch
   * 0,61 m dick statt 0,22 m, und die Schalen der Spinne schlossen sichtbar
   * neben dem Draht. Seit er ein Ballen ist (E-037), hat er keine Taille mehr
   * und braucht das nicht; das Feld bleibt fuer den naechsten Gegenstand mit
   * Hals.
   *
   * Wer hier mehrere Punktwolken liefert, bekommt mehrere Kollider an einem
   * Koerper. Die Masse wird nach dem Rauminhalt ihrer Huellquader aufgeteilt —
   * so sitzt der Schwerpunkt dort, wo das Material ist.
   */
  huellen?: Float32Array[];
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
/**
 * Verzinkter Draht — matt, hellgrau, ein Hauch blaeulich.
 *
 * Kein neuer Ton, sondern derselbe wie die Fraktion Zink in
 * `materials/catalog.ts` (0x9aa6ad). Wer den Besen sieht, sieht dieselbe Farbe
 * wie an der Zink-Mulde.
 */
const VERZINKT = 0x9aa6ad;
/** Wo der Draht schon Flugrost angesetzt hat — ein Zaun steht draussen. */
const VERZINKT_ALT = 0x7e7368;
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

/**
 * Quad, Aufsitzmaeher: kleiner Koerper mit Sitz und vier Raedern.
 *
 * Mit `raeder: "keine"` faellt das Radwerk weg — fuer Wasserfahrzeuge, die
 * denselben gedrungenen Koerper haben, aber eben keine Reifen.
 */
function kleinfahrzeug(w: number, h: number, d: number, raeder: "vier" | "keine" = "vier"): Bauteil {
  const lack = lackton([LACK_ROT, LACK_BLAU, LACK_GRUEN, 0x1f2226], w, h, d);
  q(w * 0.7, h * 0.34, d * 0.8, lack, 0, -h * 0.06);
  q(w * 0.5, h * 0.2, d * 0.3, 0x24262a, 0, h * 0.2, -d * 0.08);
  q(w * 0.62, h * 0.16, d * 0.25, lack, 0, h * 0.12, d * 0.34);
  q(w * 0.9, 0.05, 0.05, CHROM, 0, h * 0.34, d * 0.26);
  if (raeder === "vier") {
    const rr = Math.min(h * 0.32, d * 0.14);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) z(rr, w * 0.16, GUMMI, "x", sx * w * 0.42, -h * 0.3, sz * d * 0.3, 10);
  }
  return fertig();
}

/**
 * Motorrad, Moped: einspurig — zwei Raeder HINTEREINANDER, nicht vier.
 *
 * Ansage 14.09.2026: „Motorraeder kommen aktuell mit vier Reifen an." Sie
 * liefen bis dahin ueber `kleinfahrzeug`, und das setzt seine Raeder in einer
 * doppelten Schleife ueber beide Vorzeichen — vier Stueck, fest verdrahtet.
 * Fuer ein Quad ist das richtig, fuer ein Motorrad nicht.
 *
 * Die Raeder stehen auf der Mittellinie (x = 0) und sind gross im Verhaeltnis
 * zum Koerper: Bei einem Motorrad reicht das Rad fast bis zur Tankoberkante,
 * waehrend beim Quad die Karosserie darueber steht. Genau daran erkennt man von
 * weitem, was man vor sich hat.
 *
 * Dass ein einspuriges Fahrzeug nicht von selbst steht, ist eine Frage der
 * Physik und nicht dieser Geometrie — es liegt auf dem Platz auf der Seite.
 */
function einspurig(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_ROT, LACK_BLAU, LACK_GRUEN, 0x1f2226], w, h, d);
  const rr = Math.min(h * 0.4, d * 0.21);
  // Rahmenrohr vom Lenkkopf nach hinten, schmal — ein Motorrad ist duenn
  q(w * 0.26, h * 0.2, d * 0.72, 0x3a3d41, 0, -h * 0.02);
  // Tank vorn, Sitzbank dahinter
  q(w * 0.38, h * 0.22, d * 0.3, lack, 0, h * 0.2, d * 0.16);
  q(w * 0.34, h * 0.14, d * 0.26, 0x24262a, 0, h * 0.18, -d * 0.2);
  // Motorblock tief zwischen den Raedern
  q(w * 0.44, h * 0.24, d * 0.22, 0x4a4d52, 0, -h * 0.18, d * 0.02);
  // Gabel und Lenker
  q(w * 0.14, h * 0.5, w * 0.14, CHROM, 0, h * 0.14, d * 0.36);
  q(w * 0.92, 0.045, 0.045, CHROM, 0, h * 0.4, d * 0.34);
  // Zwei Raeder in einer Linie, vorn und hinten
  for (const sz of [-1, 1]) z(rr, w * 0.17, GUMMI, "x", 0, -h * 0.26, sz * d * 0.36, 12);
  return fertig();
}

/**
 * Schneemobil: vorn zwei Kufen, hinten eine Raupe — und kein einziges Rad.
 *
 * Befund 14.09.2026: Das Schneemobil lief über `kleinfahrzeug` und kam damit
 * „mit vier Gummirädern" auf den Platz, wie das Motorrad vor ihm. Ein
 * Schneemobil hat aber gar keine Räder: vorn zwei lenkbare Kufen, hinten ein
 * Gummiband über Umlenkrollen. Das ist die Form, an der man es von weitem
 * erkennt, und deshalb eine eigene Bauform statt einer Fallunterscheidung in
 * `kleinfahrzeug`.
 *
 * Die Kufen stehen vorn weit auseinander (±0,40 · Breite), die Raupe läuft
 * hinten auf der Mittellinie — vorn breit, hinten schmal. Genau das misst
 * `test/kufenRaupe.test.ts`.
 */
function kufenRaupe(w: number, h: number, d: number): Bauteil {
  const lack = lackton([LACK_ROT, LACK_BLAU, LACK_GRUEN, 0x1f2226], w, h, d);
  // Wanne mit abfallender Haube nach vorn (+z)
  q(w * 0.62, h * 0.3, d * 0.62, lack, 0, -h * 0.04);
  q(w * 0.56, h * 0.24, d * 0.3, lack, 0, h * 0.14, d * 0.3);
  // Sitzbank hinten, Lenker und Lenksäule
  q(w * 0.42, h * 0.2, d * 0.4, 0x24262a, 0, h * 0.2, -d * 0.16);
  q(w * 0.1, h * 0.26, w * 0.1, STAHL_DUNKEL, 0, h * 0.34, d * 0.2);
  q(w * 0.88, 0.05, 0.05, CHROM, 0, h * 0.46, d * 0.2);
  // Windschutz — dunkles Polycarbonat, keine Scheibe (kein zweiter Zeichenruf)
  q(w * 0.46, h * 0.2, 0.04, 0x3a3f44, 0, h * 0.42, d * 0.34);
  // Zwei Kufen vorn, mit Federbein und hochgezogener Spitze
  for (const sx of [-1, 1]) {
    q(w * 0.12, h * 0.06, d * 0.44, CHROM, sx * w * 0.4, -h * 0.46, d * 0.18);
    q(w * 0.12, h * 0.16, 0.06, CHROM, sx * w * 0.4, -h * 0.38, d * 0.4);
    q(w * 0.07, h * 0.3, w * 0.07, STAHL_DUNKEL, sx * w * 0.36, -h * 0.28, d * 0.18);
    // Querlenker zur Wanne hin
    q(w * 0.3, h * 0.05, w * 0.07, STAHL, sx * w * 0.25, -h * 0.38, d * 0.18);
  }
  // Raupe hinten: breites Gummiband auf der Mittellinie, über zwei Rollen
  q(w * 0.44, h * 0.26, d * 0.58, GUMMI, 0, -h * 0.33, -d * 0.18);
  for (const sz of [-1, 1])
    z(h * 0.13, w * 0.42, GUMMI, "x", 0, -h * 0.33, -d * 0.18 + sz * d * 0.29, 10);
  // Schneefänger hinten über der Raupe
  q(w * 0.4, h * 0.16, 0.05, 0x24262a, 0, -h * 0.08, -d * 0.46);
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
/* Der Kehrbesen: ein Ballen aus zusammengetretenem Maschendraht              */
/* ------------------------------------------------------------------------ */

/**
 * Die Form des Ballens — eine Tabelle, keine verstreuten Zahlen.
 *
 * `test/besen.test.ts` und `tools/plan-2026-09-15-besen-2.ts` rechnen mit
 * denselben Werten; wer hier dreht, dreht Blatt und Waechter mit.
 *
 * ## Warum der Ballen so aussieht, wie er aussieht
 *
 * Befund Patrick am Geraet, 15.09.2026: „Der Maschendrahtzaun ist viel zu
 * klein. Er soll fast so breit sein wie eine Pritsche und viel voluminoeser.
 * Das Breite ist eigentlich das am meisten Volumen einnehmende. Stell dir
 * einfach vor, da werden sehr viele Maschendraehte zusammengepresst worden,
 * und oben natuerlich durch das Greifergewicht ist das alles wie eine Kugel
 * geformt, aber auch nicht so sauber. Und vor allem wird quasi immer wieder
 * der Maschendraht zwischen Spinne, Birne und Boden gedrueckt, und so wuerde
 * es halt auch die Form annehmen. Also es ist halt ein bisschen wie ein
 * Tee-Ei."
 *
 * Das Ding ist also nicht GEFERTIGT, sondern ENTSTANDEN. Aus dieser Geschichte
 * folgt jede Kante:
 *
 * - **Unten platt** — er hat hundertmal auf dem Beton gelegen, waehrend von
 *   oben gedrueckt wurde. Die breiteste Stelle liegt deshalb AUF dem Boden,
 *   nicht auf halber Hoehe: Teig, den man niederdrueckt, quillt unten heraus.
 *   Das ist zugleich die Schleppkante, und sie ist der Grund fuer den
 *   Superellipsen-Exponenten 4 (`pUnten`): lange gerade Flanken mit
 *   gerundeten Ecken. Eine Ellipse waere vorn gewoelbt und schoebe Kleinteile
 *   nach aussen weg, statt sie zusammenzukehren.
 * - **Oben kugelig** — die Spinne und die Birne formen die Kuppe. Darum
 *   laeuft der Umriss nach oben in eine gedrueckte Halbkugel aus
 *   (`steil`/`rund`), und der Querschnitt geht vom Rechteckigen ins Runde
 *   (`pUnten` nach `pOben`).
 * - **Aber nicht sauber** — eine gepresste Kugel hat Dellen dort, wo die
 *   Schalen aufgesetzt haben, und Beulen dazwischen. Beides steht in
 *   `beule` und `dellen`, beides ist FEST an Winkel und Hoehe geknuepft und
 *   nicht gewuerfelt: Derselbe Ballen sieht nach dem Laden eines Spielstands
 *   wieder gleich aus.
 */
export const BESEN_FORM = {
  /**
   * Schlankheit ueber die Hoehe: `f(v) = (1 - v^steil)^rund`, v = 0 am Boden.
   *
   * `steil` 2,2 haelt die Flanke unten fast senkrecht (auf den ersten 30 % der
   * Hoehe verliert sie 4 % Breite) und laesst sie erst oben einbiegen.
   * `rund` 0,5 ist der Kugelschnitt — das ist die Kuppe.
   */
  steil: 2.2,
  rund: 0.5,
  /** Superellipsen-Exponent unten (gerade Flanke) und an der Kuppe (rund). */
  pUnten: 4.0,
  pOben: 2.2,
  /** Kleinster Halbmesser an der Kuppe, als Anteil der halben Breite. */
  kuppe: 0.16,
  /** Ausschlag der gleichmaessigen Beulen, als Anteil des Halbmessers. */
  beule: 0.075,
  /**
   * Die Dellen der Schalen: Winkel (rad), Hoehe (0..1), Tiefe (Anteil).
   *
   * Drei Stellen, an denen die Spinne beim Niederdruecken aufgesessen hat —
   * unterschiedlich tief, unterschiedlich hoch, absichtlich unregelmaessig
   * verteilt. Mehr als drei liest sich aus der Kabine als Rauschen.
   */
  dellen: [
    [0.8, 0.86, 0.13],
    [2.95, 0.6, 0.1],
    [4.85, 0.92, 0.09],
  ] as ReadonlyArray<readonly [number, number, number]>,
  /**
   * Staerke eines gezeichneten Strangs (m).
   *
   * Das ist KEIN Einzeldraht — echter Zaundraht misst 2,8 mm, und 56 m davon
   * je Quadratmeter kann niemand zeichnen. Ein Strang steht fuer ein Buendel
   * aus rund zehn Draehten; 26 mm ist die Staerke, bei der das Geflecht auf
   * dem iPhone mini noch als Geflecht und nicht als Gitterrost liest
   * (Blattprobe 15.09.2026, vorher 22 mm bei halb so grossem Ballen).
   */
  draht: 0.026,
  /** Straenge je Schar der Rautenmasche, Teilstuecke je Strang, Drall (rad). */
  straenge: 18,
  stufen: 7,
  drall: 0.75,
  /** Hoehen der Maschenreihen (Anteil der Hoehe) und Ecken je Reihe. */
  ringe: [0, 0.16, 0.33, 0.52, 0.72, 0.88] as ReadonlyArray<number>,
  ringEcken: 20,
} as const;

/**
 * Der Kehrbesen als Ballen.
 *
 * Unten eine breite, flache Platte mit fast senkrechter Schleppkante, oben
 * eine verbeulte Kuppe — ein Tee-Ei, auf das jemand getreten ist.
 *
 * ## Das Geflecht
 *
 * Zwei Scharen schraeger Straenge laufen gegenlaeufig um den Ballen und
 * kreuzen sich — die Rautenmasche eines Maschendrahtzauns. Dazu Maschenreihen,
 * die den Umriss halten, ein doppelt gelegter Saum unten (die Schleppkante),
 * ein Boden aus Ringen und Speichen und ein paar lose Enden, die sich um den
 * Ballen legen. Alles sind Quader, alles verschmilzt zu EINER Geometrie mit
 * Farbe in den Eckpunkten — ein Zeichenruf.
 *
 * ## Warum EINE konvexe Huelle genuegt
 *
 * Der Vorgaenger war ein Trichter mit Hals und Wulst und brauchte zwei
 * Huellen, weil eine einzige die Taille ueberbrueckt haette (0,61 m statt
 * 0,22 m am Hals). Der Ballen hat keine Taille: `f(v)` faellt von unten nach
 * oben streng monoton. Die einzige Abweichung von der Konvexitaet sind die
 * Dellen, und die sind hoechstens 13 % tief. Gemessen wird das in
 * `test/besen.test.ts` — die Huelle folgt dem gezeichneten Umriss auf jeder
 * Hoehe; die Gegenprobe mit einer Sanduhr faellt durch.
 */
function besen(w: number, h: number, d: number): Bauteil {
  const F = BESEN_FORM;
  const DICK = F.draht;
  /** Saum unten, doppelt gelegt — der Teil, der ueber den Boden schleift. */
  const SAUM = DICK * 2.2;
  /** Mittellinie der Schleppkante: der Saum soll genau auf -h/2 aufliegen. */
  const ySaum = -h / 2 + SAUM / 2;
  /** Mittellinie der obersten Masche: die Kuppe endet genau auf +h/2. */
  const yKuppe = h / 2 - DICK / 2;
  const hoehe = yKuppe - ySaum;

  /** Schlankheit auf Hoehe v (0 = Schleppkante, 1 = Kuppe). */
  const flanke = (v: number): number =>
    Math.max(Math.pow(Math.max(1 - Math.pow(v, F.steil), 0), F.rund), F.kuppe);

  /**
   * Beulen und Dellen — fest an Winkel und Hoehe, nie gewuerfelt.
   *
   * Drei ueberlagerte Wellen geben die allgemeine Unruhe (ein getretener
   * Ballen ist nirgends rund), die drei Dellen die Abdruecke der Schalen.
   */
  const beule = (theta: number, v: number): number => {
    let f =
      1 +
      F.beule *
        (0.55 * Math.sin(3 * theta + 0.7) +
          0.3 * Math.sin(5 * theta - 1.9) * (0.35 + 0.65 * v) +
          0.35 * Math.cos(2 * theta + 2.4) * Math.sin(Math.PI * v));
    for (const [t0, v0, tief] of F.dellen) {
      let dt = theta - t0;
      while (dt > Math.PI) dt -= Math.PI * 2;
      while (dt < -Math.PI) dt += Math.PI * 2;
      f *= 1 - tief * Math.exp(-((dt / 0.75) ** 2 + ((v - v0) / 0.24) ** 2));
    }
    return f;
  };

  /** Superellipsen-Exponent: unten 4 (gerade Flanke), oben 2,2 (rund). */
  const pBei = (v: number): number => F.pUnten + (F.pOben - F.pUnten) * Math.pow(v, 0.8);

  /** Roher Umriss, Halbmesser noch in Einheiten von 1. */
  const roh = (theta: number, v: number, out: THREE.Vector3): THREE.Vector3 => {
    const r = flanke(v) * beule(theta, v);
    const e = 2 / pBei(v);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return out.set(
      r * Math.sign(c) * Math.pow(Math.abs(c), e),
      ySaum + v * hoehe,
      r * Math.sign(s) * Math.pow(Math.abs(s), e)
    );
  };

  /*
   * Massstab abtasten statt rechnen.
   *
   * Die Beulen schieben die breiteste Stelle vom Winkel 0 weg — wer stumpf mit
   * `w/2` skaliert, bekommt einen Ballen, der breiter ist als sein
   * Katalogmass, und damit einen Kollider, der nicht mehr zu den Zahlen passt,
   * mit denen der Platz gerechnet wurde. Also: Umriss abtasten, groessten
   * Ausschlag suchen, darauf normieren.
   */
  const probe = new THREE.Vector3();
  let maxX = 1e-6;
  let maxZ = 1e-6;
  for (let i = 0; i < 144; i++) {
    const th = (i / 144) * Math.PI * 2;
    for (let k = 0; k <= 48; k++) {
      roh(th, k / 48, probe);
      maxX = Math.max(maxX, Math.abs(probe.x));
      maxZ = Math.max(maxZ, Math.abs(probe.z));
    }
  }
  const skaX = (w / 2 - DICK) / maxX;
  const skaZ = (d / 2 - DICK) / maxZ;

  const pkt = (theta: number, v: number, out = new THREE.Vector3()): THREE.Vector3 => {
    roh(theta, v, out);
    out.x *= skaX;
    out.z *= skaZ;
    return out;
  };

  /** Draehte altern unregelmaessig — fest an der Nummer, nicht zufaellig. */
  const ton = (i: number): number => ((i * 7) % 5 === 0 ? VERZINKT_ALT : VERZINKT);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  /* --- Rautenmasche: zwei Scharen gegenlaeufig um den Ballen -------------- */
  for (let s = 0; s < F.straenge; s++) {
    const theta0 = (s / F.straenge) * Math.PI * 2;
    for (const richtung of [1, -1]) {
      for (let k = 0; k < F.stufen; k++) {
        const v0 = k / F.stufen;
        const v1 = (k + 1) / F.stufen;
        pkt(theta0 + richtung * F.drall * v0, v0, a);
        pkt(theta0 + richtung * F.drall * v1, v1, b);
        draht(a, b, DICK, ton(s + k + (richtung > 0 ? 0 : 3)));
      }
    }
  }

  /* --- Maschenreihen: sie halten den Umriss ------------------------------- */
  for (const [i, v] of F.ringe.entries()) {
    const dickRing = v === 0 ? SAUM : DICK;
    for (let e = 0; e < F.ringEcken; e++) {
      pkt((e / F.ringEcken) * Math.PI * 2, v, a);
      pkt(((e + 1) / F.ringEcken) * Math.PI * 2, v, b);
      draht(a, b, dickRing, v === 0 ? VERZINKT : ton(e + i));
    }
  }

  /* --- Der Boden: platt vom vielen Draufdruecken -------------------------- */
  /*
   * Zwei innere Ringe und acht Speichen auf der Hoehe der Schleppkante. Ohne
   * sie waere der Ballen unten hohl — und genau das ist er nicht: Was da liegt,
   * ist plattgetretener Draht, keine Haube.
   */
  const boden = (theta: number, f: number, out: THREE.Vector3): THREE.Vector3 => {
    pkt(theta, 0, out);
    out.x *= f;
    out.z *= f;
    return out;
  };
  for (const f of [0.72, 0.42]) {
    for (let e = 0; e < 12; e++) {
      boden((e / 12) * Math.PI * 2, f, a);
      boden(((e + 1) / 12) * Math.PI * 2, f, b);
      draht(a, b, DICK, ton(e + Math.round(f * 10)));
    }
  }
  for (let e = 0; e < 8; e++) {
    const th = (e / 8) * Math.PI * 2 + 0.2;
    boden(th, 0.12, a);
    boden(th, 0.96, b);
    draht(a, b, DICK, ton(e + 2));
  }

  /* --- Die Kuppe: gedrueckt, nicht gedreht -------------------------------- */
  /*
   * Ueber den Scheitel gelegte Straenge schliessen den Ballen oben. Sie laufen
   * nicht durch die Mitte, sondern versetzt aneinander vorbei — so entsteht
   * die unsaubere Kuppe statt einer sauberen Rosette.
   */
  for (let e = 0; e < 5; e++) {
    const th = (e / 5) * Math.PI;
    pkt(th, 0.93, a);
    pkt(th + Math.PI, 0.93, b);
    const m = pkt(th + 0.35, 1, new THREE.Vector3());
    draht(a, m, DICK * 1.15, ton(e));
    draht(m, b, DICK * 1.15, ton(e + 1));
  }

  /* --- Lose Enden: der Draht ist gerissen, nicht geschnitten -------------- */
  /*
   * Sie legen sich um den Ballen, statt abzustehen: Ein abstehendes Ende
   * machte den Kollider groesser als das Katalogmass, und daran haengt der
   * ganze Platz (passt er zwischen die Bordwaende, passt er auf seinen Fleck).
   */
  for (let e = 0; e < 7; e++) {
    const th = (e / 7) * Math.PI * 2 + 1.1;
    const v = 0.1 + (e % 4) * 0.18;
    pkt(th, v, a);
    pkt(th + 0.55, v + 0.09, b);
    draht(a, b, DICK * 0.8, VERZINKT_ALT);
  }

  const teil = fertig();

  /*
   * Zum Schluss auf das Katalogmass ziehen.
   *
   * Das Abtasten oben normiert den GEDACHTEN Umriss, gezeichnet werden aber
   * Sehnen zwischen 20 Ringecken — die breiteste Stelle des Umrisses liegt
   * selten genau auf einer Ecke. Gemessen fehlten dadurch 5 cm in der Breite
   * und 3,5 cm in der Tiefe, waehrend die dickeren Kuppenstraenge 7,6 mm nach
   * oben ueberstanden.
   *
   * Das ist kein Schoenheitsfehler: Der Kollider kommt aus genau diesen
   * Eckpunkten, und mit ihm ist gerechnet worden, ob der Ballen zwischen die
   * Bordwaende einer Pritsche passt (2,40 gegen 2,70 m) und auf seinen Fleck.
   * Ein Bau, der 2,35 m breit ist, obwohl im Katalog 2,40 steht, macht jede
   * dieser Rechnungen zur Vermutung. Also: fertig zeichnen, messen, auf Mass
   * ziehen. Die Korrektur liegt bei rund 2 % und ist am Draht nicht zu sehen.
   */
  const geo = teil.koerper;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  geo.translate(
    -(bb.max.x + bb.min.x) / 2,
    -(bb.max.y + bb.min.y) / 2,
    -(bb.max.z + bb.min.z) / 2
  );
  geo.scale(
    w / Math.max(bb.max.x - bb.min.x, 1e-6),
    h / Math.max(bb.max.y - bb.min.y, 1e-6),
    d / Math.max(bb.max.z - bb.min.z, 1e-6)
  );
  // Ungleichmaessiges Skalieren verdreht die Normalen — neu rechnen.
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  /*
   * EINE Huelle, gemessen statt uebernommen: siehe Kopfkommentar. `huellen`
   * bleibt leer, und `scrapItems.ts` baut die konvexe Huelle ueber alle
   * Eckpunkte — genau den Umriss, den man sieht.
   *
   * Das rohe Eckpunktfeld auszuduennen (10 104 Punkte, davon zwei Drittel
   * Doppelte) waere naheliegend, ist aber gemessen ein Nullsummenspiel:
   * `createCollider` faellt damit von 10,8 auf 4,6 ms, das Ausduennen selbst
   * kostet 4,6 ms. Der teure Teil ist ein ganz anderer — das Verschmelzen der
   * rund 450 Quader, 49 ms. Einmal beim Neuen Spiel, einmal um Mitternacht,
   * falls der Besen fehlt.
   */
  return teil;
}

/**
 * Alle Eckpunkte einer Geometrie zwischen zwei Hoehen — fuer Teilhuellen.
 *
 * Doppelte werden auf den Millimeter genau aussortiert. Das ist kein
 * Schoenheitsfehler, sondern Rechenzeit: Ein `BoxGeometry` bringt 24
 * Eckpunkte fuer 8 Ecken mit (je Flaeche eigene, wegen der Normalen), und ein
 * Geflecht besteht aus einigen hundert solchen Quadern. Gemessen 15.09.2026
 * sank der Bau des Kolliders dadurch von 54 auf 20 ms — einmalig beim Setzen,
 * aber einmalig an der Stelle, an der das Spiel startet.
 *
 * **Derzeit nutzt kein Bau das Werkzeug.** Bis zum 15.09.2026 abends war der
 * Kehrbesen ein Trichter mit Taille und brauchte zwei Huellen; als Ballen
 * braucht er nur noch eine (E-037, gemessen). Die Maschinerie bleibt trotzdem
 * stehen — sie ist die einzige Antwort auf „konvexe Huelle ueberbrueckt die
 * Einschnuerung", und der naechste Gegenstand mit Hals braucht sie wieder.
 * Damit sie nicht verrottet, prueft `test/besen.test.ts` sie an einer
 * Sanduhr-Attrappe nach.
 */
export function punkteBis(geo: THREE.BufferGeometry, y0: number, y1: number): Float32Array {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const out: number[] = [];
  const gesehen = new Set<string>();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < y0 || y > y1) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const schluessel = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    out.push(x, y, z);
  }
  return new Float32Array(out);
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
    case "einspurig":
      return einspurig(w, h, d);
    case "wasserfahrzeug":
      return kleinfahrzeug(w, h, d, "keine");
    case "kufenRaupe":
      return kufenRaupe(w, h, d);
    case "moebel":
      return moebel(w, h, d);
    case "beton":
      return beton(w, h, d);
    case "trommel":
      return trommel(kind === "cyl" ? a : Math.min(w, h) / 2, kind === "cyl" ? b : d);
    case "fensterflaeche":
      return fensterflaeche(w, h, d) as Bauteil;
    case "besen":
      return besen(w, h, d);
    default:
      return { koerper: new THREE.BoxGeometry(w, h, d), glas: null };
  }
}
