/**
 * Einzelteile nach der Explosionszeichnung „5-Schalen-Mehrschalengreifer,
 * 1.200 Liter" (Vorlage 13.09.2026).
 *
 * Diese Datei baut NUR Teile, keinen Greifer — so war der Auftrag: „erst mal
 * die Einzelteile und so originalgetreu wie möglich … die versuchen wir später
 * zusammenzusetzen."
 *
 * Neu gegenüber dem ersten Anlauf ist, dass die Zeichnung jetzt eine Maßtabelle
 * hat. Damit ist nichts mehr geschätzt, und drei Dinge stellten sich als falsch
 * heraus:
 *
 *   - Die **Mitteltraverse misst Ø 700 mm**, nicht Ø 1514 mm. Der Bolzenkreis
 *     ist damit weniger als halb so groß wie im bisherigen Modell.
 *   - Die **Schale ist 400 mm breit**, nicht 740. Damit hatte die schmale
 *     Sichelkralle vom 12.09. mittags an dieser Stelle recht — was sie zur
 *     Schale macht, ist nicht die Breite, sondern die Tiefe von 300 mm.
 *   - Zwei Positionen fehlten ganz: **Zylinderschutzblech** und
 *     **Schalenverstärkung**, beide fünfmal.
 *
 * Hauptmaße aus der Tabelle, in Metern:
 *
 *   1  Aufhängung / Adapter    1x   0,45 × 0,35 × 0,40
 *   2  Rotator (Drehwerk)      1x   0,40 × 0,40 × 0,30
 *   3  Drehwerksgehäuse        1x   0,45 × 0,35 × 0,25
 *   4  Mitteltraverse          1x   Ø 0,70 × 0,45
 *   5  Hydraulikzylinder       5x   0,70 × 0,20 × 0,12
 *   6  Greiferschale (HO)      5x   1,20 × 0,40 × 0,30
 *   7  Greiferspitze           5x   0,25 × 0,12 × 0,08
 *   8  Zylinderschutzblech     5x   0,50 × 0,18 × 0,10
 *   9  Hydraulikleitungen      1 Satz
 *   10 Schalenverstärkung      5x   0,40 × 0,15 × 0,08
 *
 *   Gesamt geschlossen: 1,85 m hoch, 1,60 m breit, 1.200 l Schüttgut
 *
 * Zwei Dinge macht die Datei anders als das Spielmodell:
 *
 *   - **Hülsengelenke sind echte Hülsen.** Ein Auge ist ein Rohr mit Bohrung,
 *     kein voller Zapfen. Daran steckt später der Bolzen wirklich.
 *   - **Schweißnähte sind sichtbar.** Wo ein Blech an ein anderes gesetzt ist,
 *     liegt eine Kehlnaht — der Unterschied zwischen Gussteil und
 *     Schweißkonstruktion.
 */
import * as THREE from "three";

/* ------------------------------------------------------------- Hauptmaße */

/** Die Maßtabelle der Zeichnung, in Metern. Einzige Quelle für alles unten. */
export const MASS = {
  aufhaengung: { breite: 0.45, tiefe: 0.35, hoehe: 0.4 },
  rotator: { breite: 0.4, tiefe: 0.4, hoehe: 0.3 },
  drehwerksgehaeuse: { breite: 0.45, tiefe: 0.35, hoehe: 0.25 },
  traverse: { durchmesser: 0.7, hoehe: 0.45 },
  zylinder: { laenge: 0.7, breite: 0.2, durchmesser: 0.12 },
  schale: { laenge: 1.2, breite: 0.4, tiefe: 0.3 },
  spitze: { laenge: 0.25, breite: 0.12, dicke: 0.08 },
  schutzblech: { laenge: 0.5, breite: 0.18, hoehe: 0.1 },
  verstaerkung: { laenge: 0.4, breite: 0.15, hoehe: 0.08 },
  gesamt: { hoehe: 1.85, breite: 1.6, volumen: 1.2 },
  schalen: 5,
} as const;

/** Abschnitte, in die die Schale unterteilt ist. */
export const SCHALEN_ABSCHNITTE = 6;
/**
 * Länge eines Abschnitts und Krümmung je Abschnitt.
 *
 * Beides folgt aus dem Hauptmaß der Schale — und zwar erst, seit klar ist, wie
 * die 1.200 × 300 mm gemeint sind: als **Hüllmaß entlang der eigenen Sehne**,
 * so wie man ein gebogenes Blech misst, nicht als Bogenlänge.
 *
 * Als Bogenlänge gelesen ging die Rechnung nicht auf: Eine 1,20-m-Schale auf
 * einer Ø-700-Traverse müsste die Achse um 42 cm überfahren, um sich zu
 * schließen. Als Hüllmaß bleibt genau eine Lösung übrig, und sie trifft die
 * Tabelle auf den Millimeter:
 *
 *   6 Abschnitte à 230 mm = 1,38 m Bogen, 17,5° Krümmung je Abschnitt
 *   Hüllmaß daraus: 1,199 × 0,296 m   (Soll 1,20 × 0,30)
 */
export const ABSCHNITT = 0.23;
export const SCHALEN_BOGEN = (17.5 * Math.PI) / 180;

/* ------------------------------------------------------------- Kinematik */

/**
 * Die Kinematik des Zusammenbaus — abgetastet, nicht gegriffen.
 *
 * Gesucht wurde über Bolzenkreis, beide Anschläge, Laschenlage und
 * Zylinderaufnahme gleichzeitig, unter sechs Bedingungen:
 *
 *   1. Die Spitzen lassen geschlossen ein Loch von 16 cm — halboffene Bauform.
 *   2. Die Lasche sitzt auf dem RÜCKEN der Schale, nicht im Trog. Dort läge
 *      sie da, wo das Material hinsoll.
 *   3. Der Zylinder steht steil (hier bis 26°), nicht quer über dem Kopf.
 *   4. Kein Totpunkt: Der Hebelarm bleibt überall über 8 cm; hier sind es 29.
 *   5. Der Zylinder bleibt zwischen 0,42 und 0,80 m — die Tabelle nennt 0,70 m.
 *   6. Zum Schließen fährt er AUS, also mit voller Kolbenfläche.
 *
 * Dazu kam am Ende die wichtigste Bedingung, und die kam nicht aus der
 * Zeichnung, sondern aus einem Satz: „Stell dir die Spinne von der Form wie
 * eine Glocke vor, wo unten eine halbe Abrissbirne rausguckt. Sollte die Form
 * oben also breiter sein als unten, ist was falsch."
 *
 * Genau das war der Fall. Die Zylinder saßen auf Auslegern bei Radius 0,58 und
 * machten den Kopf 1,5 m breit — breiter als die geschlossenen Schalen mit
 * 1,02 m. Der Greifer war oben am breitesten, also eine Glocke auf dem Kopf.
 *
 * Jetzt bleibt die ganze Anlenkung zwischen Radius 0,16 und 0,29, also im
 * Schatten der Mitteltraverse (Ø 0,70). Der Kopf ist damit schmaler als die
 * Schalen darunter, und die Silhouette läuft nach unten auf.
 *
 * Nachgerechnet: Bolzenkreis Ø 0,68 gegen Ø 0,70 Traverse — die Lageraugen
 * sitzen an ihrem Rand. Zylinder 0,54 m geschlossen bis 0,69 m offen (Tabelle
 * 0,70 m über alles), Hub 15 cm, Neigung höchstens 9°, kein Totpunkt,
 * Schließmoment 1,66-mal Öffnungsmoment. Spitzenweite 0,16 m geschlossen bis
 * 2,47 m offen.
 */
/** Bolzenkreis der Schalen (m) — Ø 0,68, also der Rand der Mitteltraverse. */
export const BOLZENKREIS = 0.34;
/** Höhe der Schalenbolzen unter der Oberkante des Adapters (m). */
export const BOLZEN_Y = -1.155;
/** Anschläge der Schalen (rad): 31° geschlossen, 92° offen — 2,47 m Spitzenweite. */
export const ZU = (31 * Math.PI) / 180;
export const OFFEN = (92 * Math.PI) / 180;
/** Angriffspunkt der Kolbenstange auf dem Schalenrücken, im Frame des Lagerauges. */
export const ANLENKPUNKT = { y: 0.0927, z: -0.1543 };
/** Aufnahme des Zylinders an der Mitteltraverse, im Frame des Greifers. */
export const ZYLINDER_AUFNAHME = { r: 0.24, y: -0.62 };
/** Hoehenlage der Mitteltraverse — hier gebraucht, um ihre Aufnahmen zu setzen. */
export const LAGE_TRAVERSE = -1.005;

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return ZU + (OFFEN - ZU) * t;
}

/** Mittellinie einer Schale im Frame des Greifers, bei gegebenem Schwenk. */
export function mittellinie(schwenk: number): Array<{ r: number; y: number }> {
  const out = [{ r: BOLZENKREIS, y: BOLZEN_Y }];
  let r = BOLZENKREIS;
  let y = BOLZEN_Y;
  for (let i = 0; i < SCHALEN_ABSCHNITTE; i++) {
    const th = i * SCHALEN_BOGEN - schwenk;
    y -= ABSCHNITT * Math.cos(th);
    r -= ABSCHNITT * Math.sin(th);
    out.push({ r, y });
  }
  return out;
}

/* ------------------------------------------------------------------ Stoffe */

export interface Stoffe {
  guss: THREE.MeshStandardMaterial;
  blech: THREE.MeshStandardMaterial;
  naht: THREE.MeshStandardMaterial;
  bolzen: THREE.MeshStandardMaterial;
  gruen: THREE.MeshStandardMaterial;
  chrom: THREE.MeshStandardMaterial;
  gummi: THREE.MeshStandardMaterial;
}

export function stoffe(): Stoffe {
  const m = (n: string, c: number, r: number, me: number): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: me });
    mat.name = n;
    return mat;
  };
  return {
    guss: m("Stahlguss", 0x41474c, 0.55, 0.5),
    blech: m("Hardox_Blech", 0x2f3438, 0.45, 0.68),
    naht: m("Schweissnaht", 0x6a7076, 0.72, 0.55),
    bolzen: m("Bolzen_blank", 0xb9c0c6, 0.24, 0.92),
    gruen: m("Lack_gruen", 0x5ec23f, 0.4, 0.35),
    chrom: m("Kolbenstange_chrom", 0xc6ccd2, 0.16, 0.9),
    gummi: m("Hydraulikschlauch", 0x15181a, 0.86, 0.05),
  };
}

/* -------------------------------------------------------------- Bausteine */

/**
 * Hohlzylinder — die Grundform jedes Hülsengelenks.
 *
 * Ein Auge mit Bohrung, nicht ein voller Zapfen. Genau daran erkennt man auf
 * der Zeichnung ein Gelenk: Man sieht durch. Die Achse liegt auf x, weil alle
 * Gelenke dieses Greifers quer stehen.
 */
export function rohr(
  rAussen: number,
  rBohrung: number,
  laenge: number,
  seiten = 14
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const h = laenge / 2;
  for (let s = 0; s < seiten; s++) {
    const w0 = (s / seiten) * Math.PI * 2;
    const w1 = ((s + 1) / seiten) * Math.PI * 2;
    const u0 = s / seiten;
    const u1 = (s + 1) / seiten;
    for (const [r, aussen] of [
      [rAussen, 1],
      [rBohrung, 0],
    ] as Array<[number, number]>) {
      const a = p(-h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 0);
      const b = p(-h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 0);
      const c = p(h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 1);
      const d = p(h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 1);
      if (aussen) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
    for (const x of [-h, h]) {
      const a = p(x, Math.sin(w0) * rAussen, Math.cos(w0) * rAussen, u0, 0);
      const b = p(x, Math.sin(w1) * rAussen, Math.cos(w1) * rAussen, u1, 0);
      const c = p(x, Math.sin(w1) * rBohrung, Math.cos(w1) * rBohrung, u1, 1);
      const d = p(x, Math.sin(w0) * rBohrung, Math.cos(w0) * rBohrung, u0, 1);
      if (x > 0) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let NAHT_STOFF: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial();
/** Muss einmal gesetzt werden, bevor `naht` benutzt wird. */
export function nahtStoff(st: Stoffe): void {
  NAHT_STOFF = st.naht;
}

/**
 * Kehlnaht als schmale Dreikantleiste.
 *
 * Eine Schweißnaht ist kein Rohr, sondern eine Kehle: dreieckig im Schnitt,
 * die beiden Schenkel an den Blechen. Neun Dreiecke je Naht — billiger als
 * jedes Detail, das man dafür weglassen müsste.
 */
export function naht(laenge: number, dicke = 0.022): THREE.Mesh {
  const g = new THREE.CylinderGeometry(dicke, dicke, laenge, 3);
  g.rotateY(Math.PI / 6);
  const m = new THREE.Mesh(g, NAHT_STOFF);
  m.name = "SCHWEISSNAHT";
  return m;
}

/**
 * Gabelaufnahme: zwei Laschen mit fluchtenden Augen, dazwischen der Spalt für
 * das Gegenstück.
 *
 * Die Standardaufnahme dieses Greifers — sie kommt an der Mitteltraverse für
 * Zylinder und Schalen vor und oben am Adapter.
 */
export function gabel(
  st: Stoffe,
  spalt: number,
  augeR: number,
  bohrung: number,
  hoehe: number,
  dicke = 0.05
): THREE.Group {
  const g = new THREE.Group();
  for (const seite of [-1, 1]) {
    const x = seite * (spalt / 2 + dicke / 2);
    const platte = new THREE.Mesh(new THREE.BoxGeometry(dicke, hoehe, augeR * 1.8), st.blech);
    platte.position.set(x, -hoehe / 2 + augeR * 0.25, 0);
    g.add(platte);
    const auge = new THREE.Mesh(rohr(augeR, bohrung, dicke), st.guss);
    auge.position.set(x, 0, 0);
    g.add(auge);
    const n = naht(augeR * 1.7);
    n.rotation.z = Math.PI / 2;
    n.position.set(x - seite * (dicke / 2 + 0.016), -hoehe + augeR * 0.25, 0);
    g.add(n);
  }
  return g;
}

/** Stützstellen der Schalenkrümmung, im Frame des Lagerauges. */
export function schalenStationen(): Array<{ y: number; z: number; th: number }> {
  const out: Array<{ y: number; z: number; th: number }> = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i <= SCHALEN_ABSCHNITTE; i++) {
    out.push({ y, z, th: i * SCHALEN_BOGEN });
    y -= ABSCHNITT * Math.cos(i * SCHALEN_BOGEN);
    z -= ABSCHNITT * Math.sin(i * SCHALEN_BOGEN);
  }
  return out;
}

/**
 * Strang mit Rechteckquerschnitt entlang einer Stationsfolge.
 *
 * Für alles, was der Schalenkrümmung folgt: Seitenwangen, Verstärkungen,
 * Schutzbleche. `versatz` misst von der Mittellinie nach außen.
 */
export function strang(
  stationen: Array<{ y: number; z: number; th: number }>,
  x: number,
  breite: number,
  dicke: number,
  versatz = 0
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (px: number, py: number, pz: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(px, py, pz);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const ecken: number[][] = [];
  for (let k = 0; k < stationen.length; k++) {
    const s0 = stationen[k]!;
    const ny = Math.sin(s0.th);
    const nz = Math.cos(s0.th);
    const reihe: number[] = [];
    for (const [dx, dn] of [
      [-breite / 2, versatz],
      [breite / 2, versatz],
      [breite / 2, versatz + dicke],
      [-breite / 2, versatz + dicke],
    ] as Array<[number, number]>) {
      reihe.push(
        p(x + dx, s0.y + dn * ny, s0.z + dn * nz, (dx + breite / 2) / breite, k / stationen.length)
      );
    }
    ecken.push(reihe);
  }
  for (let k = 0; k < ecken.length - 1; k++) {
    for (let e = 0; e < 4; e++) {
      const f = (e + 1) % 4;
      quad(ecken[k]![e]!, ecken[k]![f]!, ecken[k + 1]![f]!, ecken[k + 1]![e]!);
    }
  }
  const letzte = ecken.length - 1;
  quad(ecken[0]![3]!, ecken[0]![2]!, ecken[0]![1]!, ecken[0]![0]!);
  quad(ecken[letzte]![0]!, ecken[letzte]![1]!, ecken[letzte]![2]!, ecken[letzte]![3]!);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------- 01 Aufhängung / Adapter */

/**
 * Aufhängung / Adapter — 0,45 × 0,35 × 0,40 m.
 *
 * Auf der Zeichnung eine geschweißte Konstruktion mit zwei hochstehenden
 * Laschen und großen Augen, dazwischen der Bolzen zum Stiel, unten die
 * Anschraubplatte zum Rotator. Die Knotenbleche zwischen Laschen und Platte
 * sind das Erkennungszeichen — ohne sie sieht die Gabel aus wie angeklebt.
 */
export function baueAufhaengung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "01_AUFHAENGUNG";
  const M = MASS.aufhaengung;
  const platte = new THREE.Mesh(new THREE.BoxGeometry(M.breite, 0.05, M.tiefe), st.guss);
  platte.name = "01_ANSCHRAUBPLATTE";
  platte.position.y = -M.hoehe / 2;
  g.add(platte);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.026, 0.014, 0.055), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * 0.16, -M.hoehe / 2, Math.cos(a) * 0.12);
    g.add(sitz);
  }
  const ohren = gabel(st, 0.14, 0.095, 0.05, 0.26, 0.055);
  ohren.name = "01_GABEL";
  ohren.position.y = M.hoehe / 2 - 0.1;
  g.add(ohren);
  const bolzen = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.32, 14), st.bolzen);
  bolzen.name = "01_BOLZEN";
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.y = M.hoehe / 2 - 0.1;
  g.add(bolzen);
  for (const sz of [-1, 1]) {
    const knoten = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.04), st.blech);
    knoten.position.set(0, -0.06, sz * 0.1);
    knoten.rotation.x = sz * 0.55;
    g.add(knoten);
  }
  return g;
}

/* ------------------------------------------------------------ 02 Rotator */

/**
 * Rotator (Drehwerk) — 0,40 × 0,40 × 0,30 m.
 *
 * Der Drehantrieb: ein gedrungener Block mit Flansch oben und unten, dem
 * Hydraulikmotor an der Seite und der Drehdurchführung. Nicht zu verwechseln
 * mit Position 3, dem Gehäuse darum herum.
 */
export function baueRotator(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "02_ROTATOR";
  const M = MASS.rotator;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2, M.breite / 2, M.hoehe * 0.62, 8),
    st.blech
  );
  koerper.name = "02_GEHAEUSE";
  koerper.rotation.y = Math.PI / 8;
  g.add(koerper);
  for (const [y, r] of [
    [M.hoehe / 2 - 0.02, M.breite / 2 - 0.03],
    [-M.hoehe / 2 + 0.02, M.breite / 2 + 0.01],
  ] as Array<[number, number]>) {
    const flansch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 16), st.guss);
    flansch.position.y = y;
    g.add(flansch);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const schraube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6),
        st.bolzen
      );
      schraube.position.set(Math.sin(a) * (r - 0.035), y, Math.cos(a) * (r - 0.035));
      g.add(schraube);
    }
  }
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 10), st.guss);
  motor.name = "02_MOTOR";
  motor.rotation.z = Math.PI / 2;
  motor.position.set(M.breite / 2 + 0.04, 0.02, 0);
  g.add(motor);
  for (const z of [-0.05, 0.05]) {
    const stutzen = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 6), st.bolzen);
    stutzen.rotation.z = Math.PI / 2;
    stutzen.position.set(-M.breite / 2 - 0.02, -0.03, z);
    g.add(stutzen);
  }
  return g;
}

/* --------------------------------------------------- 03 Drehwerksgehäuse */

/**
 * Drehwerksgehäuse — 0,45 × 0,35 × 0,25 m.
 *
 * Die Schutzabdeckung um das Drehwerk. Auf der Zeichnung ist es der gerippte
 * Ring zwischen Rotator und Mitteltraverse; die senkrechten Rippen sind das,
 * woran man es erkennt — sie halten den Schrott von der Dichtung fern.
 */
export function baueDrehwerksgehaeuse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "03_DREHWERKSGEHAEUSE";
  const M = MASS.drehwerksgehaeuse;
  const mantel = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2, M.tiefe / 2, M.hoehe, 12),
    st.guss
  );
  mantel.name = "03_MANTEL";
  g.add(mantel);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rippe = new THREE.Mesh(new THREE.BoxGeometry(0.035, M.hoehe * 0.86, 0.05), st.blech);
    rippe.position.set(Math.sin(a) * (M.breite / 2 - 0.005), 0, Math.cos(a) * (M.breite / 2 - 0.005));
    rippe.rotation.y = a;
    g.add(rippe);
  }
  const rand = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite / 2 + 0.02, M.breite / 2 + 0.02, 0.03, 12),
    st.blech
  );
  rand.position.y = M.hoehe / 2;
  g.add(rand);
  return g;
}

/* ------------------------------------------------------ 04 Mitteltraverse */

/**
 * Mitteltraverse — Ø 0,70 × 0,45 m, die zentrale Baugruppe.
 *
 * Das Teil, an dem alles andere hängt: oben der Flansch zum Drehwerk, am
 * oberen Rand fünf Gabeln für die Zylinder, am unteren Rand fünf Gabeln für
 * die Schalen, unten mittig der Gusskegel, um den sich die Schalen schließen.
 *
 * Ø 700 mm ist der wichtigste Einzelwert der ganzen Tabelle. Das bisherige
 * Modell hatte hier 1514 mm — mehr als das Doppelte —, weil die Zahl aus einem
 * Datenblatt einer anderen Baugröße stammte. Der Bolzenkreis der Schalen hängt
 * unmittelbar daran, und damit die ganze Kinematik.
 *
 * Einen freischwebenden Gelenkring gibt es nicht: Der Kreis ist das, was die
 * fünf Gabeln beschreiben.
 */
export function baueMitteltraverse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "04_MITTELTRAVERSE";
  const M = MASS.traverse;
  const R = M.durchmesser / 2;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.82, M.hoehe * 0.72, 10),
    st.guss
  );
  koerper.name = "04_GRUNDKOERPER";
  koerper.rotation.y = Math.PI / 10;
  g.add(koerper);
  const flansch = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.6, 0.05, 16), st.guss);
  flansch.name = "04_OBERFLANSCH";
  flansch.position.y = M.hoehe * 0.36 + 0.02;
  g.add(flansch);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.024, 0.013, 0.06), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * R * 0.48, M.hoehe * 0.36 + 0.02, Math.cos(a) * R * 0.48);
    g.add(sitz);
  }
  // Gusskegel unten — der Kern, um den sich die Schalen schliessen
  const kegel = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.2, 0.16, 10), st.guss);
  kegel.name = "04_KEGEL";
  kegel.position.y = -M.hoehe * 0.36 - 0.06;
  g.add(kegel);

  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    /*
     * Zylinderaufnahme: Ausleger von der Schulter der Traverse nach oben und
     * aussen, oben die Gabel. Ihre Lage ist gerechnet (`ZYLINDER_AUFNAHME`) —
     * der Zylinder braucht dort oben Platz, sonst steht er quer.
     */
    const oben = gabel(st, 0.1, 0.07, 0.036, 0.14, 0.04);
    oben.name = `04_ZYLINDERAUFNAHME_${nr}`;
    oben.position.set(
      Math.sin(a) * ZYLINDER_AUFNAHME.r,
      ZYLINDER_AUFNAHME.y - LAGE_TRAVERSE,
      Math.cos(a) * ZYLINDER_AUFNAHME.r
    );
    oben.rotation.y = a;
    g.add(oben);
    // Schalengabel am unteren Rand — ihre Augen bilden den Bolzenkreis
    const unten = gabel(st, 0.17, 0.085, 0.042, 0.18, 0.05);
    unten.name = `04_SCHALENAUFNAHME_${nr}`;
    unten.position.set(Math.sin(a) * R * 0.9, -M.hoehe * 0.3, Math.cos(a) * R * 0.9);
    unten.rotation.y = a;
    g.add(unten);
  }
  return g;
}

/* --------------------------------------------------- 05 Hydraulikzylinder */

/**
 * Hydraulikzylinder — 0,70 × 0,20 × Ø 0,12 m, fünfmal radial.
 *
 * Gehäuse und Kolbenstange sind getrennte Objekte, beide mit Auge. Kolben und
 * Dichtungen stecken darin und sind nicht gebaut — in einer Spielkamera sieht
 * man sie nie.
 */
export function baueZylinder(st: Stoffe): {
  gruppe: THREE.Group;
  gehaeuse: THREE.Group;
  stange: THREE.Group;
} {
  const gruppe = new THREE.Group();
  gruppe.name = "05_HYDRAULIKZYLINDER";
  const M = MASS.zylinder;
  const rR = M.durchmesser / 2;
  const rohrLaenge = M.laenge * 0.6;

  const gehaeuse = new THREE.Group();
  gehaeuse.name = "05_ZYLINDERGEHAEUSE";
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(rR, rR, rohrLaenge, 14),
    st.gruen
  );
  koerper.position.y = -rohrLaenge / 2;
  gehaeuse.add(koerper);
  const boden = new THREE.Mesh(new THREE.CylinderGeometry(rR * 1.12, rR * 1.12, 0.05, 14), st.gruen);
  gehaeuse.add(boden);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(rR * 1.08, rR * 1.08, 0.055, 14), st.blech);
  kopf.position.y = -rohrLaenge;
  gehaeuse.add(kopf);
  const augeOben = new THREE.Mesh(rohr(rR * 0.95, rR * 0.42, M.breite * 0.45), st.guss);
  augeOben.position.y = 0.07;
  gehaeuse.add(augeOben);
  const n = naht(M.breite * 0.5);
  n.rotation.z = Math.PI / 2;
  n.position.y = 0.026;
  gehaeuse.add(n);
  for (const y of [-0.08, -rohrLaenge + 0.1]) {
    const anschluss = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6), st.bolzen);
    anschluss.rotation.z = Math.PI / 2;
    anschluss.position.set(rR + 0.02, y, 0);
    gehaeuse.add(anschluss);
  }
  gruppe.add(gehaeuse);

  const stange = new THREE.Group();
  stange.name = "05_KOLBENSTANGE";
  const auszug = M.laenge - rohrLaenge - 0.12;
  const stab = new THREE.Mesh(new THREE.CylinderGeometry(rR * 0.5, rR * 0.5, auszug, 12), st.chrom);
  stab.position.y = -auszug / 2;
  stange.add(stab);
  const augeUnten = new THREE.Mesh(rohr(rR * 0.85, rR * 0.38, M.breite * 0.4), st.guss);
  augeUnten.position.y = -auszug - 0.04;
  stange.add(augeUnten);
  stange.position.y = -rohrLaenge;
  gruppe.add(stange);

  return { gruppe, gehaeuse, stange };
}

/* ------------------------------------------------ 06 Greiferschale (HO) */

/**
 * Greiferschale, halboffene Bauform — 1,20 × 0,40 × 0,30 m, fünfmal.
 *
 * Ein geschweißter Trog: gewölbte Haut zwischen zwei Seitenwangen, oben der
 * Lagerkasten mit den beiden Augen, hinten die Konsole mit dem Anlenkauge für
 * die Kolbenstange. Dazwischen Kehlnähte.
 *
 * 400 mm Breite — nicht 740, wie im ersten Anlauf geschätzt. Was die Schale von
 * einem Zinken unterscheidet, ist damit nicht die Breite, sondern die Tiefe:
 * 300 mm, verteilt auf 120 mm Wölbung der Haut und 180 mm hohe Wangen.
 */
export function baueGreiferschale(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "06_GREIFERSCHALE";
  const M = MASS.schale;
  const stationen = schalenStationen();
  const HALB = M.breite / 2;
  const WOELBUNG = M.tiefe * 0.4;
  const WANGE = M.tiefe * 0.6;
  const HAUT = 0.03;
  const sektorHalb = Math.PI / MASS.schalen;

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, y: number, z: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, y, z);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const QUER = 4;
  /*
   * Zur Spitze hin laeuft die Schale schmaler zu — und zwar aus zwei Gruenden
   * gleichzeitig, von denen der zweite zwingend ist.
   *
   * Der erste ist die Form: Eine Greiferschale ist oben breit und laeuft unten
   * aus, das zeigt jede Vorlage.
   *
   * Der zweite ist Platz. Fuenf Schalen teilen sich den Kreis, jede hat 72°.
   * Nahe der Drehachse wird dieser Sektor eng: Bei 20 cm Radius sind 72° nur
   * noch 23 cm Bogen. Eine Schale von 40 cm Breite passt dort nicht mehr —
   * sie griffe in den Sektor der Nachbarin. Die Breite wird deshalb auf
   * `r · sin(0,9 · Halbsektor)` gedeckelt, mit dem Radius, den die Station im
   * GESCHLOSSENEN Zustand hat. Damit kann es gar nicht mehr passieren.
   *
   * Ungedeckelt nutzte die Schale geschlossen 49° von 36° — die Pruefung hat
   * es gefangen, im Bild war davon nichts zu sehen.
   */
  const breiteBei = (k: number): number => {
    /*
     * Gedeckelt wird am kleinsten Radius, den das Teil an dieser Station
     * ueberhaupt erreicht — ueber die GANZE Schwenkbewegung, und gemessen an
     * der INNENKANTE der Seitenwange, die 18 cm in den Trog hineinragt.
     *
     * Beide Verschaerfungen kamen aus der Pruefung, eine nach der anderen: Mit
     * dem Radius der Mittellinie im geschlossenen Zustand nutzte die Schale
     * noch 47° von 36°, mit der Wangenkante im geschlossenen Zustand immer
     * noch 43° — dann aber bei drei Vierteln geoeffnet, weil die Wange dort
     * am weitesten nach innen zeigt.
     */
    let innen = Infinity;
    for (let i = 0; i <= 8; i++) {
      const schwenk = ZU + ((OFFEN - ZU) * i) / 8;
      const bahn = mittellinie(schwenk);
      const th = k * SCHALEN_BOGEN - schwenk;
      innen = Math.min(innen, (bahn[k]?.r ?? 0.05) - WANGE * Math.cos(th));
    }
    return Math.min(
      HALB * (1 - 0.45 * (k / SCHALEN_ABSCHNITTE) ** 1.6),
      Math.max(innen, 0.04) * Math.sin(sektorHalb * 0.9)
    );
  };

  const lagen: number[][][] = [];
  for (const seite of [0, 1]) {
    const reihen: number[][] = [];
    for (let k = 0; k <= SCHALEN_ABSCHNITTE; k++) {
      const s0 = stationen[k]!;
      const halb = breiteBei(k);
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const x = -halb + t * 2 * halb;
        const w = WOELBUNG * (1 - (x / Math.max(halb, 1e-3)) ** 2) + seite * HAUT;
        reihe.push(
          p(x, s0.y + w * Math.sin(s0.th), s0.z + w * Math.cos(s0.th), t, k / SCHALEN_ABSCHNITTE)
        );
      }
      reihen.push(reihe);
    }
    lagen.push(reihen);
  }
  const [aussen, innen] = lagen as [number[][], number[][]];
  for (let k = 0; k < SCHALEN_ABSCHNITTE; k++) {
    for (let j = 0; j < QUER; j++) {
      quad(aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      quad(innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    quad(aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    quad(innen[k]![QUER]!, aussen[k]![QUER]!, aussen[k + 1]![QUER]!, innen[k + 1]![QUER]!);
  }
  const e = SCHALEN_ABSCHNITTE;
  for (let j = 0; j < QUER; j++) {
    quad(innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    quad(aussen[e]![j]!, aussen[e]![j + 1]!, innen[e]![j + 1]!, innen[e]![j]!);
  }
  const haut = new THREE.BufferGeometry();
  haut.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  haut.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  haut.setIndex(idx);
  haut.computeVertexNormals();
  const hautMesh = new THREE.Mesh(haut, st.blech);
  hautMesh.name = "06_HAUT";
  g.add(hautMesh);

  /*
   * Seitenwangen: der Versatz ist NEGATIV, die Wange steht also in den Trog
   * hinein. Andersherum verschwindet sie hinter der Haut, und die Schale liest
   * sich als flaches Blech — genau so sah sie im ersten Anlauf aus.
   */
  for (const seite of [-1, 1]) {
    for (let k = 0; k < SCHALEN_ABSCHNITTE; k++) {
      const halb = (breiteBei(k) + breiteBei(k + 1)) / 2;
      const wange = new THREE.Mesh(
        strang(stationen.slice(k, k + 2), seite * halb, 0.035, WANGE, -WANGE),
        st.guss
      );
      wange.name = `06_WANGE_${seite < 0 ? "L" : "R"}_${k + 1}`;
      g.add(wange);
    }
  }

  // Lagerkasten mit den beiden Augen — das Hülsengelenk zur Mitteltraverse
  /*
   * Lagerkasten und Augen — schmaler, als es die Schalenbreite zuliesse.
   *
   * Bei fuenf Schalen hat jede 72°. Auf dem Bolzenkreis von 0,34 m sind das
   * 43 cm Bogen. Die Augen sassen bei ±0,24 m, der Kasten war also 48 cm
   * breit — und griff damit in den Sektor der Nachbarin. Die Pruefung hat es
   * bei drei Vierteln geoeffnet gefangen, mit 43° von 36°.
   */
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.2), st.guss);
  kasten.name = "06_LAGERKASTEN";
  kasten.position.set(0, 0.01, 0.05);
  g.add(kasten);
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(rohr(0.075, 0.038, 0.07), st.guss);
    auge.name = `06_LAGERAUGE_${seite < 0 ? "L" : "R"}`;
    auge.position.set(seite * 0.14, 0, 0);
    g.add(auge);
    const n = naht(0.14);
    n.rotation.z = Math.PI / 2;
    n.position.set(seite * 0.1, 0, 0.02);
    g.add(n);
  }

  // Konsole mit Anlenkauge fuer die Kolbenstange
  /*
   * Konsole mit Anlenkauge — auf dem RUECKEN der Schale, nicht im Trog.
   * Ihre Lage ist gerechnet, nicht gegriffen: `ANLENKPUNKT` kommt aus der
   * Abtastung der ganzen Kinematik.
   */
  const konsole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.22), st.guss);
  konsole.name = "06_KONSOLE";
  konsole.position.set(0, ANLENKPUNKT.y + 0.01, ANLENKPUNKT.z * 0.5);
  g.add(konsole);
  const anlenkauge = new THREE.Mesh(rohr(0.055, 0.03, 0.11), st.guss);
  anlenkauge.name = "06_ANLENKAUGE";
  anlenkauge.position.set(0, ANLENKPUNKT.y, ANLENKPUNKT.z);
  g.add(anlenkauge);
  const nk = naht(0.14);
  nk.rotation.z = Math.PI / 2;
  nk.position.set(0, 0.02, 0.12);
  g.add(nk);

  return g;
}

/* ------------------------------------------------------ 07 Greiferspitze */

/**
 * Greiferspitze — 0,25 × 0,12 × 0,08 m, austauschbar, fünfmal.
 *
 * Ein Schmiedeteil, das über das Schalenende geschoben und verschraubt wird.
 * Es läuft auf eine Schneide zu, nicht auf einen Punkt.
 */
export function baueGreiferspitze(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "07_GREIFERSPITZE";
  const M = MASS.spitze;
  /*
   * Die Spitze zeigt nach −y, der Kragen sitzt am breiten Ende bei +y.
   *
   * Erst war es umgekehrt: Die Kegelspitze lag bei +y und der Kragen darauf.
   * Im Zusammenbau zeigte damit der Kragen nach vorn und die Spitze nach
   * hinten in die Schale — und weil er weiter aussteht als der Zahn, schob er
   * sich über die Drehachse in den Sektor der gegenüberliegenden Schale.
   */
  const zahn = new THREE.Mesh(
    new THREE.CylinderGeometry(M.breite * 0.5, M.dicke * 0.2, M.laenge * 0.66, 4),
    st.bolzen
  );
  zahn.scale.set(1, 1, M.dicke / M.breite);
  zahn.rotation.y = Math.PI / 4;
  zahn.position.y = -M.laenge * 0.18;
  g.add(zahn);
  const kragen = new THREE.Mesh(
    new THREE.BoxGeometry(M.breite * 1.15, M.laenge * 0.3, M.dicke * 1.3),
    st.bolzen
  );
  kragen.name = "07_KRAGEN";
  kragen.position.y = 0;
  g.add(kragen);
  for (const x of [-M.breite * 0.32, M.breite * 0.32]) {
    const loch = new THREE.Mesh(rohr(0.016, 0.009, M.dicke * 1.4), st.blech);
    loch.rotation.x = Math.PI / 2;
    loch.rotation.z = Math.PI / 2;
    loch.position.set(x, 0, 0);
    g.add(loch);
  }
  return g;
}

/* ------------------------------------------------ 08 Zylinderschutzblech */

/**
 * Zylinderschutzblech — 0,50 × 0,18 × 0,10 m, fünfmal.
 *
 * Die gekantete Haube über jedem Zylinder. Auf der Zeichnung liegen die fünf
 * als eigene Position daneben; sie halten Schrott von Rohr und Kolbenstange
 * fern. Dieses Teil fehlte im ersten Anlauf vollständig.
 */
export function baueZylinderschutzblech(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "08_ZYLINDERSCHUTZBLECH";
  const M = MASS.schutzblech;
  const ruecken = new THREE.Mesh(new THREE.BoxGeometry(M.breite, M.laenge, 0.02), st.blech);
  ruecken.position.z = M.hoehe / 2;
  g.add(ruecken);
  for (const seite of [-1, 1]) {
    const flanke = new THREE.Mesh(new THREE.BoxGeometry(0.02, M.laenge, M.hoehe), st.blech);
    flanke.position.set((seite * M.breite) / 2, 0, 0);
    g.add(flanke);
    const n = naht(M.laenge);
    n.position.set((seite * M.breite) / 2, 0, M.hoehe / 2 - 0.012);
    g.add(n);
  }
  // Anschraublaschen oben und unten
  for (const y of [-M.laenge / 2 + 0.03, M.laenge / 2 - 0.03]) {
    const lasche = new THREE.Mesh(new THREE.BoxGeometry(M.breite * 0.7, 0.035, 0.07), st.blech);
    lasche.position.set(0, y, -M.hoehe * 0.2);
    g.add(lasche);
  }
  return g;
}

/* ------------------------------------------------- 09 Hydraulikleitungen */

/**
 * Hydraulikleitung — Schlauch mit Verschraubungen an beiden Enden.
 *
 * Auf der Zeichnung ein Satz gebogener Schläuche mit Sechskant-Verschraubung
 * und Winkelstück. Genau das macht sie als Schlauch erkennbar und nicht als
 * Rohr.
 */
export function baueHydraulikleitung(st: Stoffe, laenge = 0.8): THREE.Group {
  const g = new THREE.Group();
  g.name = "09_HYDRAULIKLEITUNG";
  const kurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(laenge * 0.3, -laenge * 0.24, 0),
    new THREE.Vector3(laenge * 0.7, -laenge * 0.3, 0),
    new THREE.Vector3(laenge, -laenge * 0.05, 0)
  );
  const schlauch = new THREE.Mesh(new THREE.TubeGeometry(kurve, 14, 0.019, 8, false), st.gummi);
  g.add(schlauch);
  for (const t of [0, 1]) {
    const punkt = kurve.getPoint(t);
    const richtung = kurve.getTangent(t);
    const mutter = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.06, 6), st.bolzen);
    mutter.position.copy(punkt).addScaledVector(richtung, t === 0 ? 0.04 : -0.04);
    mutter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung);
    g.add(mutter);
  }
  return g;
}

/* ------------------------------------------------- 10 Schalenverstärkung */

/**
 * Schalenverstärkung — 0,40 × 0,15 × 0,08 m, fünfmal.
 *
 * Das Verstärkungsblech auf dem Rücken der Schale, dort wo sie sich in den
 * Haufen wühlt. Es folgt der Krümmung und ist geschraubt, damit man es
 * wechseln kann. Zweite Position, die im ersten Anlauf fehlte.
 */
export function baueSchalenverstaerkung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "10_SCHALENVERSTAERKUNG";
  const M = MASS.verstaerkung;
  const stationen = schalenStationen();
  const abschnitte = Math.max(2, Math.round((M.laenge / MASS.schale.laenge) * SCHALEN_ABSCHNITTE) + 1);
  const teil = stationen.slice(1, 1 + abschnitte);
  const blech = new THREE.Mesh(
    strang(teil, 0, M.breite, M.hoehe * 0.45, MASS.schale.tiefe * 0.4),
    st.guss
  );
  blech.name = "10_BLECH";
  g.add(blech);
  for (const k of [0, teil.length - 1]) {
    const s0 = teil[k]!;
    const versatz = MASS.schale.tiefe * 0.4 + M.hoehe * 0.45;
    const schraube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 6), st.bolzen);
    schraube.position.set(
      0,
      s0.y + versatz * Math.sin(s0.th),
      s0.z + versatz * Math.cos(s0.th)
    );
    schraube.rotation.x = -s0.th + Math.PI / 2;
    g.add(schraube);
  }
  return g;
}

/* ------------------------------------------------------------- Übersicht */

/** Alle Einzelteile, in der Reihenfolge der Positionsliste. */
export function einzelteile(st: Stoffe = stoffe()): Array<{
  name: string;
  anzahl: number;
  teil: THREE.Object3D;
}> {
  nahtStoff(st);
  return [
    { name: "01  Aufhaengung / Adapter", anzahl: 1, teil: baueAufhaengung(st) },
    { name: "02  Rotator (Drehwerk)", anzahl: 1, teil: baueRotator(st) },
    { name: "03  Drehwerksgehaeuse", anzahl: 1, teil: baueDrehwerksgehaeuse(st) },
    { name: "04  Mitteltraverse", anzahl: 1, teil: baueMitteltraverse(st) },
    { name: "05  Hydraulikzylinder", anzahl: 5, teil: baueZylinder(st).gruppe },
    { name: "06  Greiferschale (HO)", anzahl: 5, teil: baueGreiferschale(st) },
    { name: "07  Greiferspitze", anzahl: 5, teil: baueGreiferspitze(st) },
    { name: "08  Zylinderschutzblech", anzahl: 5, teil: baueZylinderschutzblech(st) },
    { name: "09  Hydraulikleitung", anzahl: 1, teil: baueHydraulikleitung(st) },
    { name: "10  Schalenverstaerkung", anzahl: 5, teil: baueSchalenverstaerkung(st) },
  ];
}
