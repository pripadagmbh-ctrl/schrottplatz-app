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
  drehwerksgehaeuse: { breite: 0.5, tiefe: 0.45, hoehe: 0.3 },
  traverse: { breite: 0.75, tiefe: 0.55, hoehe: 0.4 },
  zylinder: { laenge: 0.7, breite: 0.2, durchmesser: 0.12 },
  schale: { laenge: 1.2, breite: 0.4, tiefe: 0.3 },
  spitze: { laenge: 0.25, breite: 0.12, dicke: 0.08 },
  stempel: { breite: 0.6, tiefe: 0.5, hoehe: 0.35 },
  gesamt: { hoehe: 2.4, breite: 2.3, volumen: 1.2 },
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
 * Die Kinematik — und der Befund, der sie umgeworfen hat.
 *
 * Die zweite Fassung der Zeichnung hat zwei Positionen, die vorher fehlten:
 *
 *   9  Zentrale untere Gelenk-/Führungseinheit (Stempel)   1x, 600×500×350
 *   10 Untere Schalenanbindung                             5x, Gelenkpunkt am Stempel
 *
 * Damit hängen die Schalen NICHT an der Mitteltraverse, wie ich es gebaut
 * hatte. Das Verbindungsprinzip der Zeichnung sagt es Punkt für Punkt: oberer
 * Zylinderanschluss an der Mitteltraverse, obere Schalenanbindung am Zylinder,
 * untere Schalenanbindung an der zentralen Gelenkeinheit. Jede Schale hat also
 * genau einen Drehpunkt — unten in der Mitte, am Stempel — und wird oben vom
 * Zylinder geschoben. Ein Winkelhebel, keine hängende Schale.
 *
 * Genau das ist auch der Grund, warum der Greifer geschlossen wie eine Birne
 * aussieht: Der Drehpunkt sitzt tief und mittig, die Schale wickelt sich um
 * ihn herum, und unten schaut der Stempel heraus.
 *
 * Abgetastet ergibt sich:
 *
 *   Drehpunkt   an Station 1 der Schale, 0,24 m nach innen versetzt
 *   Stempelauge r 0,48 m, y −1,66 m
 *   Anschläge   20° geschlossen, 85° offen
 *   geschlossen 1,36 m breit, 2,40 m hoch  (Zeichnung: 2,40 m)
 *   offen       rund 2,0 m Spitzenweite    (Zeichnung: 2,30 m Greiferbreite)
 *   Zylinder    0,90 m geschlossen, 0,62 m offen — fährt zum SCHLIESSEN aus
 *   Moment      Schließen 3,0-mal Öffnen
 */
/** Station der Schale, an der ihr Drehpunkt sitzt, und dessen Versatz nach innen. */
export const DREHPUNKT = { station: 1, versatz: 0.24 };
/** Lage des Stempelauges im Frame des Greifers (m). */
export const STEMPEL_AUGE = { r: 0.48, y: -1.66 };
/** Anschläge der Schalen (rad): 20° geschlossen, 85° offen. */
export const ZU = (20 * Math.PI) / 180;
export const OFFEN = (85 * Math.PI) / 180;
/** Obere Schalenanbindung — wo der Zylinder angreift, im Frame des Drehpunkts. */
export const OBERE_ANBINDUNG = { y: 0.06, z: 0.3 };
/** Oberer Zylinderanschluss an der Mitteltraverse, im Frame des Greifers. */
export const ZYLINDER_AUFNAHME = { r: 0.18, y: -0.8 };

/** Schwenkwinkel zu einem Öffnungsgrad 0 (zu) … 1 (offen). */
export function schwenkFuer(oeffnung: number): number {
  const t = Math.min(1, Math.max(0, oeffnung));
  return ZU + (OFFEN - ZU) * t;
}

/**
 * Stützstellen der Schale im Frame ihres Drehpunkts.
 *
 * Station 0 ist das obere Ende, `SCHALEN_ABSCHNITTE` die Spitze. Der Ursprung
 * liegt am unteren Gelenk — dort, wo die Schale am Stempel hängt.
 */
export function schalenStationen(): Array<{ y: number; z: number; th: number }> {
  const roh: Array<{ y: number; z: number; th: number }> = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i <= SCHALEN_ABSCHNITTE; i++) {
    roh.push({ y, z, th: i * SCHALEN_BOGEN });
    y -= ABSCHNITT * Math.cos(i * SCHALEN_BOGEN);
    z -= ABSCHNITT * Math.sin(i * SCHALEN_BOGEN);
  }
  const st = roh[DREHPUNKT.station]!;
  const px = st.y - DREHPUNKT.versatz * Math.sin(st.th);
  const pz = st.z - DREHPUNKT.versatz * Math.cos(st.th);
  return roh.map((r) => ({ y: r.y - px, z: r.z - pz, th: r.th }));
}

/** Mittellinie einer Schale im Frame des Greifers, bei gegebenem Schwenk. */
export function mittellinie(schwenk: number): Array<{ r: number; y: number }> {
  const c = Math.cos(-schwenk);
  const sn = Math.sin(-schwenk);
  return schalenStationen().map((p) => ({
    r: STEMPEL_AUGE.r + (p.y * sn + p.z * c),
    y: STEMPEL_AUGE.y + (p.y * c - p.z * sn),
  }));
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

/**
 * Strang mit Rechteckquerschnitt entlang einer Stationsfolge.
 *
 * Fuer alles, was der Schalenkruemmung folgt: Seitenwangen, Verstaerkungen.
 * `versatz` misst von der Mittellinie nach aussen.
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
 * Mitteltraverse — 0,75 × 0,55 × 0,40 m, die zentrale Baugruppe.
 *
 * Oben der Flansch zum Drehwerk, rundum fünf Gabeln für die oberen
 * Zylinderanschlüsse. Die Schalen hängen NICHT hier — das war mein Fehler bis
 * zur zweiten Fassung der Zeichnung. Sie hängen am Stempel (Position 9); die
 * Traverse trägt nur die Zylinder und den Stempel selbst.
 */
export function baueMitteltraverse(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "04_MITTELTRAVERSE";
  const M = MASS.traverse;
  const R = M.breite / 2;
  const koerper = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R * 0.86, M.hoehe * 0.75, 10),
    st.guss
  );
  koerper.name = "04_GRUNDKOERPER";
  koerper.rotation.y = Math.PI / 10;
  g.add(koerper);
  const flansch = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.05, 16), st.guss);
  flansch.name = "04_OBERFLANSCH";
  flansch.position.y = M.hoehe * 0.38;
  g.add(flansch);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.024, 0.013, 0.06), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * R * 0.5, M.hoehe * 0.38, Math.cos(a) * R * 0.5);
    g.add(sitz);
  }
  // Fuenf Gabeln fuer die oberen Zylinderanschluesse
  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    const gabelTeil = gabel(st, 0.1, 0.07, 0.036, 0.16, 0.04);
    gabelTeil.name = `04_ZYLINDERAUFNAHME_${nr}`;
    gabelTeil.position.set(
      Math.sin(a) * ZYLINDER_AUFNAHME.r,
      -M.hoehe * 0.34,
      Math.cos(a) * ZYLINDER_AUFNAHME.r
    );
    gabelTeil.rotation.y = a;
    g.add(gabelTeil);
  }
  return g;
}

/* ------------------------------------- 09 Zentrale untere Gelenkeinheit */

/**
 * Stempel — die zentrale untere Gelenk- und Führungseinheit, 0,60 × 0,50 × 0,35 m.
 *
 * Position 9 der Zeichnung, und das Bauteil, das mir gefehlt hat. An ihm hängen
 * alle fünf Schalen: Jede hat unten ihre eigene Gabel („untere Schalenanbindung",
 * Position 10). Nach unten läuft er in einen Kegel aus — das ist die halbe
 * Abrissbirne, die geschlossen zwischen den Schalen herausschaut.
 *
 * Der Stempel hängt über eine Säule an der Mitteltraverse; die Säule ist das,
 * was auf der Zeichnung zwischen Traverse und Gelenkeinheit zu sehen ist.
 */
export function baueStempel(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "09_STEMPEL";
  const M = MASS.stempel;
  const R = M.breite / 2;
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 8), st.guss);
  saeule.name = "09_SAEULE";
  saeule.position.y = M.hoehe * 0.5 + 0.17;
  g.add(saeule);
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.9, M.hoehe, 10), st.guss);
  koerper.name = "09_KOERPER";
  koerper.rotation.y = Math.PI / 10;
  g.add(koerper);
  const kegel = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.18, 0.26, 10), st.guss);
  kegel.name = "09_KEGEL";
  kegel.position.y = -M.hoehe * 0.5 - 0.13;
  g.add(kegel);
  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");
    const anbindung = gabel(st, 0.3, 0.095, 0.045, 0.18, 0.045);
    anbindung.name = `10_SCHALENANBINDUNG_${nr}`;
    anbindung.position.set(Math.sin(a) * R * 0.95, 0, Math.cos(a) * R * 0.95);
    anbindung.rotation.y = a;
    g.add(anbindung);
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
  /*
   * Untere Schalenanbindung — der Drehpunkt am Stempel (Position 10). Er liegt
   * im Ursprung der Schale, denn genau darum dreht sie sich.
   */
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.18), st.guss);
  kasten.name = "06_UNTERE_ANBINDUNG";
  kasten.position.set(0, 0.02, -0.02);
  g.add(kasten);
  const unteresAuge = new THREE.Mesh(rohr(0.085, 0.042, 0.26), st.guss);
  unteresAuge.name = "06_UNTERES_AUGE";
  g.add(unteresAuge);
  for (const seite of [-1, 1]) {
    const n = naht(0.13);
    n.rotation.z = Math.PI / 2;
    n.position.set(seite * 0.09, 0.04, -0.04);
    g.add(n);
  }

  // Konsole mit Anlenkauge fuer die Kolbenstange
  /*
   * Konsole mit Anlenkauge — auf dem RUECKEN der Schale, nicht im Trog.
   * Ihre Lage ist gerechnet, nicht gegriffen: `ANLENKPUNKT` kommt aus der
   * Abtastung der ganzen Kinematik.
   */
  /*
   * Obere Schalenanbindung — hier greift die Kolbenstange an (Position 6 der
   * Zeichnung, orange markiert). Sie sitzt aussen am oberen Ende der Schale.
   */
  const konsole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.14), st.guss);
  konsole.name = "06_OBERE_ANBINDUNG";
  konsole.position.set(0, OBERE_ANBINDUNG.y + 0.02, OBERE_ANBINDUNG.z * 0.75);
  g.add(konsole);
  const oberesAuge = new THREE.Mesh(rohr(0.055, 0.03, 0.11), st.guss);
  oberesAuge.name = "06_OBERES_AUGE";
  oberesAuge.position.set(0, OBERE_ANBINDUNG.y, OBERE_ANBINDUNG.z);
  g.add(oberesAuge);
  const nk = naht(0.12);
  nk.rotation.z = Math.PI / 2;
  nk.position.set(0, OBERE_ANBINDUNG.y - 0.08, OBERE_ANBINDUNG.z * 0.6);
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

/*
 * Weggelassen, auf Ansage vom 13.09.2026:
 *
 *   - Hydraulikleitungen und Verbindungsschläuche („kannst weglassen").
 *   - Zylinderschutzbleche. Sie liegen ZWISCHEN den Zylindern, nicht davor —
 *     und weil ich sie zweimal falsch herum gebaut habe, bleiben sie erst mal
 *     draußen („im Zweifel weglassen").
 *   - Schalenverstärkung. Sie steht in der zweiten Fassung der Zeichnung nicht
 *     mehr in der Positionsliste.
 */

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
    { name: "02  Rotator / Drehwerk", anzahl: 1, teil: baueRotator(st) },
    { name: "03  Drehwerksgehaeuse", anzahl: 1, teil: baueDrehwerksgehaeuse(st) },
    { name: "04  Mitteltraverse", anzahl: 1, teil: baueMitteltraverse(st) },
    { name: "05  Hydraulikzylinder", anzahl: 5, teil: baueZylinder(st).gruppe },
    { name: "06  Greiferschale (HO)", anzahl: 5, teil: baueGreiferschale(st) },
    { name: "07  Greiferspitze", anzahl: 5, teil: baueGreiferspitze(st) },
    { name: "09  Zentrale untere Einheit", anzahl: 1, teil: baueStempel(st) },
  ];
}
