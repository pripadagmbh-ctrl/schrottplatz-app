/**
 * Einzelteile nach der Explosionszeichnung — Hauptkomponenten.
 *
 * Auftrag 13.09.2026: „Dann baust du gemäß der Explosionszeichnung, vor allem
 * erst mal die Einzelteile und so originalgetreu wie möglich, was die Form und
 * die Aufnahmen und Schweißnähte und Platzierung für Hülsengelenke etc. sind.
 * … die versuchen wir später zusammenzusetzen."
 *
 * Diese Datei baut deshalb NUR Teile, keinen Greifer. Jedes Teil steht für
 * sich, um seinen eigenen Ursprung, mit seinen Aufnahmen. Zusammengesetzt wird
 * später — und zwar an den Augen, die hier schon sitzen.
 *
 * Positionsliste der Zeichnung, und was davon hier gebaut ist:
 *
 *   01 Aufhängung / Anschraubplatte   gebaut
 *   02 Aufnahmebolzen                 gebaut
 *   03 Rotator                        gebaut
 *   04 Hydraulikzylinder              gebaut (Gehäuse + Stange, beide mit Auge)
 *   05 Hydraulikschlauch              gebaut (mit Verschraubungen)
 *   06 Schutzabdeckung                gebaut
 *   07 Mittelstück                    gebaut (mit Zylinder- und Lageraufnahmen)
 *   08 Greiferschale                  gebaut
 *   09 Verschleißblech                gebaut (eigenes Teil, angeschraubt)
 *   10 Greiferspitze                  gebaut (eigenes Teil, austauschbar)
 *   11 Gelenkbolzen                   gebaut
 *   12 Buchse                         gebaut
 *   13 Sicherungsring                 gebaut
 *
 * Nicht gebaut: 14 Verschraubung, 16 Kolben, 17 Dichtungen. Die stecken im
 * Zylinder und sind auch auf der Zeichnung nur in der Schnittdarstellung zu
 * sehen.
 *
 * Zwei Dinge macht diese Datei anders als alles bisher:
 *
 *   - **Hülsengelenke sind echte Hülsen.** Ein Auge ist ein Rohr mit Bohrung,
 *     kein voller Zylinder. Daran steckt später der Bolzen wirklich, und man
 *     sieht auch, dass er steckt.
 *   - **Schweißnähte sind sichtbar.** Wo ein Blech an ein anderes gesetzt ist,
 *     liegt eine Kehlnaht. Das ist der Unterschied zwischen einem Gussteil und
 *     einer Schweißkonstruktion, und die Zeichnung zeigt beides nebeneinander.
 */
import * as THREE from "three";
import {
  GELENKRING,
  SEGMENTBOGEN,
  SEGMENTE,
  SEGMENTLAENGE,
} from "./form";

/* ------------------------------------------------------------------ Stoffe */

export interface Stoffe {
  guss: THREE.MeshStandardMaterial;
  blech: THREE.MeshStandardMaterial;
  naht: THREE.MeshStandardMaterial;
  bolzen: THREE.MeshStandardMaterial;
  buchse: THREE.MeshStandardMaterial;
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
    guss: m("Stahlguss", 0x454b50, 0.55, 0.5),
    blech: m("Hardox_Blech", 0x343a3e, 0.45, 0.68),
    naht: m("Schweissnaht", 0x6a7076, 0.72, 0.55),
    bolzen: m("Bolzen_blank", 0xb9c0c6, 0.24, 0.92),
    buchse: m("Buchse_Bronze", 0x9c7a4a, 0.42, 0.8),
    gruen: m("Lack_gruen", 0x62c94b, 0.4, 0.35),
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
      [rAussen, true],
      [rBohrung, false],
    ] as Array<[number, boolean]>) {
      const a = p(-h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 0);
      const b = p(-h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 0);
      const c = p(h, Math.sin(w1) * r, Math.cos(w1) * r, u1, 1);
      const d = p(h, Math.sin(w0) * r, Math.cos(w0) * r, u0, 1);
      if (aussen) quad(a, b, c, d);
      else quad(d, c, b, a);
    }
    // Stirnflächen als Ringe
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

/**
 * Kehlnaht als schmale Dreikantleiste entlang einer Strecke.
 *
 * Eine Schweißnaht ist kein Rohr, sondern eine Kehle: dreieckig im Schnitt,
 * mit den beiden Schenkeln an den Blechen. Drei Seiten reichen dafür, und sie
 * kosten fast nichts — eine Naht hat neun Dreiecke.
 */
export function naht(laenge: number, dicke = 0.028): THREE.Mesh {
  const g = new THREE.CylinderGeometry(dicke, dicke, laenge, 3);
  g.rotateY(Math.PI / 6);
  const m = new THREE.Mesh(g, NAHT_STOFF);
  m.name = "SCHWEISSNAHT";
  return m;
}
let NAHT_STOFF: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial();
/** Muss einmal gesetzt werden, bevor `naht` benutzt wird. */
export function nahtStoff(st: Stoffe): void {
  NAHT_STOFF = st.naht;
}

/**
 * Gabelaufnahme: zwei Laschen mit fluchtenden Augen.
 *
 * Die Standardaufnahme dieses Greifers — sie kommt am Mittelstück für die
 * Zylinder vor, an der Schale für die Kolbenstange und oben an der
 * Anschraubplatte. Auf der Zeichnung sind das die überall wiederkehrenden
 * Doppellaschen mit Bohrung.
 *
 * `spalt` ist der lichte Abstand zwischen den Laschen, also der Platz für das
 * Gegenstück.
 */
export function gabel(
  st: Stoffe,
  spalt: number,
  augeR: number,
  bohrung: number,
  hoehe: number,
  dicke = 0.055
): THREE.Group {
  const g = new THREE.Group();
  for (const seite of [-1, 1]) {
    const x = seite * (spalt / 2 + dicke / 2);
    const platte = new THREE.Mesh(
      new THREE.BoxGeometry(dicke, hoehe, augeR * 1.7),
      st.blech
    );
    platte.position.set(x, -hoehe / 2 + augeR * 0.2, 0);
    g.add(platte);
    const auge = new THREE.Mesh(rohr(augeR, bohrung, dicke), st.guss);
    auge.position.set(x, 0, 0);
    g.add(auge);
    // Kehlnaht, wo die Lasche auf dem Grundkörper steht
    const n = naht(augeR * 1.6);
    n.rotation.z = Math.PI / 2;
    n.position.set(x - seite * (dicke / 2 + 0.02), -hoehe + augeR * 0.2, 0);
    g.add(n);
  }
  return g;
}

/**
 * Strang mit Rechteckquerschnitt entlang einer Stationsfolge.
 *
 * Gebraucht fuer alles, was der Schalenkruemmung folgt: Seitenwangen,
 * Verschleissbleche, Kantenschutz. Der erste Anlauf hat sie als Kette
 * einzelner Kaesten gebaut — auf dem Teileblatt sah das aus wie eine Treppe
 * mit Luecken. Ein Strang ist ein durchgehendes Netz.
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
    const st0 = stationen[k]!;
    // Normale der Kruemmung: nach innen zeigt (sin th, cos th)
    const nz = Math.cos(st0.th);
    const ny = Math.sin(st0.th);
    const reihe: number[] = [];
    for (const [dx, dn] of [
      [-breite / 2, versatz],
      [breite / 2, versatz],
      [breite / 2, versatz + dicke],
      [-breite / 2, versatz + dicke],
    ] as Array<[number, number]>) {
      reihe.push(
        p(x + dx, st0.y + dn * ny, st0.z + dn * nz, (dx + breite / 2) / breite, k / stationen.length)
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

/** Die Stationen der Schalenkruemmung, im Frame des Lagerauges. */
export function schalenStationen(): Array<{ y: number; z: number; th: number }> {
  const out: Array<{ y: number; z: number; th: number }> = [];
  let y = 0;
  let z = 0;
  for (let i = 0; i <= SEGMENTE; i++) {
    out.push({ y, z, th: i * SEGMENTBOGEN });
    y -= SEGMENTLAENGE * Math.cos(i * SEGMENTBOGEN);
    z -= SEGMENTLAENGE * Math.sin(i * SEGMENTBOGEN);
  }
  return out;
}

/* ------------------------------------------- 01 Aufhängung / Anschraubplatte */

/**
 * Anschraubplatte mit Gabel — das oberste Bauteil.
 *
 * Auf der Zeichnung eine geschweißte Konstruktion: eine Grundplatte mit
 * Lochkreis, darauf zwei hochstehende Laschen mit fluchtenden Augen, dazwischen
 * der Aufnahmebolzen, und zwischen Laschen und Platte je zwei Knotenbleche.
 * Die Knotenbleche sind das Erkennungszeichen — ohne sie sieht die Gabel aus
 * wie angeklebt.
 */
export function baueAnschraubplatte(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "01_ANSCHRAUBPLATTE";
  const platte = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.62), st.guss);
  platte.name = "01_GRUNDPLATTE";
  g.add(platte);
  // Lochkreis: acht Schraubensitze, als Senkungen angedeutet
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.036, 0.019, 0.075), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * 0.23, 0, Math.cos(a) * 0.23);
    g.add(sitz);
  }

  const laschen = gabel(st, 0.2, 0.115, 0.055, 0.42, 0.06);
  laschen.name = "01_GABEL";
  laschen.position.y = 0.38;
  g.add(laschen);

  // Knotenbleche zwischen Gabel und Platte
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const knoten = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.24, 0.16), st.blech);
      knoten.position.set(sx * 0.13, 0.16, sz * 0.14);
      knoten.rotation.x = sz * 0.5;
      g.add(knoten);
    }
  }
  return g;
}

/* ------------------------------------------------------ 02 Aufnahmebolzen */

/**
 * Aufnahmebolzen mit Kopf und Sicherungsmutter.
 *
 * Auf der Zeichnung liegen Bolzen, Scheibe und Mutter als eigene Positionen
 * nebeneinander. Gebaut ist der Bolzen mit angesetztem Kopf; Scheibe und Mutter
 * sitzen am anderen Ende.
 */
export function baueAufnahmebolzen(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "02_AUFNAHMEBOLZEN";
  const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.46, 14), st.bolzen);
  schaft.rotation.z = Math.PI / 2;
  g.add(schaft);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.05, 6), st.bolzen);
  kopf.rotation.z = Math.PI / 2;
  kopf.position.x = -0.25;
  g.add(kopf);
  const mutter = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 6), st.blech);
  mutter.rotation.z = Math.PI / 2;
  mutter.position.x = 0.245;
  g.add(mutter);
  return g;
}

/* --------------------------------------------------------------- 12/13 */

/** Buchse — die Bronzehülse, die im Auge sitzt und den Bolzen führt. */
export function baueBuchse(st: Stoffe): THREE.Mesh {
  const m = new THREE.Mesh(rohr(0.07, 0.053, 0.13), st.buchse);
  m.name = "12_BUCHSE";
  return m;
}

/** Sicherungsring — die flache Scheibe, die den Bolzen im Auge hält. */
export function baueSicherungsring(st: Stoffe): THREE.Mesh {
  const m = new THREE.Mesh(rohr(0.085, 0.054, 0.012), st.blech);
  m.name = "13_SICHERUNGSRING";
  return m;
}

/* ------------------------------------------------------------- 03 Rotator */

/**
 * Rotator — Drehwerk mit Ober- und Unterflansch.
 *
 * Auf der Zeichnung ein gestapeltes Gerät und deutlich höher als breit: oben
 * ein Flansch mit Lochkreis, darunter das Gehäuse mit dem Hydraulikmotor an
 * der Seite, unten der zweite Flansch mit Lochkreis, an dem das Mittelstück
 * angeschraubt wird. Dazu die Drehdurchführung mit zwei Anschlüssen.
 *
 * Bis eben war das ein flacher Kasten von 0,36 m Höhe. Auf der Zeichnung ist
 * der Rotator das zweitgrößte Einzelteil nach dem Mittelstück.
 */
export function baueRotator(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "03_ROTATOR";
  const oben = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.055, 16), st.guss);
  oben.name = "03_OBERFLANSCH";
  oben.position.y = 0.28;
  g.add(oben);
  const gehaeuse = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.46, 10), st.blech);
  gehaeuse.name = "03_GEHAEUSE";
  gehaeuse.rotation.y = Math.PI / 10;
  g.add(gehaeuse);
  const unten = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 16), st.guss);
  unten.name = "03_UNTERFLANSCH";
  unten.position.y = -0.27;
  g.add(unten);
  for (const [y, r] of [
    [0.28, 0.24],
    [-0.27, 0.28],
  ] as Array<[number, number]>) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const schraube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.075, 6),
        st.bolzen
      );
      schraube.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      g.add(schraube);
    }
  }
  // Hydraulikmotor, seitlich angeflanscht
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), st.guss);
  motor.name = "03_MOTOR";
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.3, 0.06, 0);
  g.add(motor);
  // Drehdurchfuehrung mit zwei Anschluessen
  for (const z of [-0.07, 0.07]) {
    const stutzen = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), st.bolzen);
    stutzen.rotation.z = Math.PI / 2;
    stutzen.position.set(-0.28, -0.05, z);
    g.add(stutzen);
  }
  return g;
}

/* -------------------------------------------------- 06 Schutzabdeckung */

/**
 * Schutzabdeckung — die Haube über den Zylinderaufnahmen.
 *
 * Auf der Zeichnung liegt sie als eigenes Teil neben dem Mittelstück: eine
 * flache Kuppel mit umlaufendem Rand und Schraubenlöchern. Sie hält Schrott
 * aus den Anlenkungen.
 */
export function baueSchutzabdeckung(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "06_SCHUTZABDECKUNG";
  const kuppel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 0.16, 10), st.blech);
  kuppel.rotation.y = Math.PI / 10;
  g.add(kuppel);
  const rand = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.035, 10), st.blech);
  rand.rotation.y = Math.PI / 10;
  rand.position.y = -0.08;
  g.add(rand);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    const loch = new THREE.Mesh(rohr(0.035, 0.019, 0.045), st.blech);
    loch.rotation.z = Math.PI / 2;
    loch.position.set(Math.sin(a) * 0.39, -0.08, Math.cos(a) * 0.39);
    g.add(loch);
  }
  return g;
}

/* --------------------------------------------------------- 07 Mittelstück */

/**
 * Mittelstück — der Grundkörper mit allen Aufnahmen.
 *
 * Das größte Einzelteil und das, an dem sich alles andere festmacht. Auf der
 * Zeichnung hat es drei Merkmale, die es ausmachen:
 *
 *   1. einen Oberflansch mit Lochkreis für den Rotator,
 *   2. fünf Zylinderaufnahmen als Doppellaschen am oberen Rand,
 *   3. fünf Lageraufnahmen als Doppellaschen am unteren Rand, deren Augen
 *      zusammen den Gelenkkreis bilden.
 *
 * Der Gelenkring als freischwebender Torus, den das Modell bisher hatte, kommt
 * auf der Zeichnung nicht vor. Dort ist der Kreis nichts Gebautes, sondern das,
 * was die fünf Augenpaare beschreiben — genau der Einwand vom 12.09.2026:
 * „dieser Ring, den Du da zeichnest, der existiert gar nicht."
 */
export function baueMittelstueck(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "07_MITTELSTUECK";
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.46, 0.44, 10), st.guss);
  koerper.name = "07_GRUNDKOERPER";
  koerper.rotation.y = Math.PI / 10;
  g.add(koerper);
  const flansch = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 16), st.guss);
  flansch.name = "07_OBERFLANSCH";
  flansch.position.y = 0.25;
  g.add(flansch);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sitz = new THREE.Mesh(rohr(0.03, 0.018, 0.07), st.blech);
    sitz.rotation.z = Math.PI / 2;
    sitz.position.set(Math.sin(a) * 0.28, 0.25, Math.cos(a) * 0.28);
    g.add(sitz);
  }
  // Boden: der Guss laeuft nach unten in eine Kuppe aus
  const kuppe = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), st.guss);
  kuppe.name = "07_ZAPFEN";
  kuppe.position.y = -0.22;
  kuppe.scale.y = 0.8;
  g.add(kuppe);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const nr = String(i + 1).padStart(2, "0");

    // Zylinderaufnahme oben: Doppellasche, Auge nach aussen gerichtet
    const oben = gabel(st, 0.13, 0.095, 0.05, 0.3, 0.05);
    oben.name = `07_ZYLINDERAUFNAHME_${nr}`;
    oben.position.set(Math.sin(a) * 0.62, 0.1, Math.cos(a) * 0.62);
    oben.rotation.y = a;
    g.add(oben);

    // Lageraufnahme unten: der Arm hinaus zum Gelenkkreis, mit Doppellasche
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.34), st.guss);
    arm.name = `07_LAGERARM_${nr}`;
    arm.position.set(Math.sin(a) * 0.56, -0.22, Math.cos(a) * 0.56);
    arm.rotation.y = a;
    g.add(arm);
    const lager = gabel(st, 0.24, 0.13, 0.062, 0.26, 0.07);
    lager.name = `07_LAGERAUFNAHME_${nr}`;
    lager.position.set(Math.sin(a) * 0.72, -0.3, Math.cos(a) * 0.72);
    lager.rotation.y = a;
    g.add(lager);
  }
  return g;
}

/* ------------------------------------------------- 04 Hydraulikzylinder */

/**
 * Hydraulikzylinder — Gehäuse und Kolbenstange, beide mit Auge.
 *
 * Auf der Zeichnung ist der Zylinder das einzige farbige Teil, und die
 * Detailansicht zeigt, woran man ihn erkennt: das Auge am Boden des Gehäuses,
 * der Führungskopf am offenen Ende, die blanke Stange und das zweite Auge an
 * ihrem Ende. Dazu zwei Anschlüsse am Gehäuse.
 *
 * Gebaut mit `laenge` als Gehäuselänge; die Stange ist ein eigenes Objekt und
 * lässt sich getrennt verschieben.
 */
export function baueZylinder(
  st: Stoffe,
  laenge = 0.62,
  auszug = 0.3
): { gruppe: THREE.Group; gehaeuse: THREE.Group; stange: THREE.Group } {
  const gruppe = new THREE.Group();
  gruppe.name = "04_HYDRAULIKZYLINDER";

  const gehaeuse = new THREE.Group();
  gehaeuse.name = "15_ZYLINDERGEHAEUSE";
  const rohrKoerper = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, laenge, 14),
    st.gruen
  );
  rohrKoerper.position.y = -laenge / 2;
  gehaeuse.add(rohrKoerper);
  const boden = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.06, 14), st.gruen);
  gehaeuse.add(boden);
  const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 14), st.blech);
  kopf.position.y = -laenge;
  gehaeuse.add(kopf);
  // Auge am Boden — das Hülsengelenk zum Mittelstück
  const augeOben = new THREE.Mesh(rohr(0.075, 0.05, 0.11), st.guss);
  augeOben.position.y = 0.085;
  gehaeuse.add(augeOben);
  const n1 = naht(0.14);
  n1.rotation.z = Math.PI / 2;
  n1.position.y = 0.03;
  gehaeuse.add(n1);
  // Zwei Anschluesse
  for (const y of [-0.1, -laenge + 0.12]) {
    const anschluss = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 6), st.bolzen);
    anschluss.rotation.z = Math.PI / 2;
    anschluss.position.set(0.08, y, 0);
    gehaeuse.add(anschluss);
  }
  gruppe.add(gehaeuse);

  const stange = new THREE.Group();
  stange.name = "18_KOLBENSTANGE";
  const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, auszug, 12), st.chrom);
  stab.position.y = -auszug / 2;
  stange.add(stab);
  const augeUnten = new THREE.Mesh(rohr(0.068, 0.045, 0.1), st.guss);
  augeUnten.position.y = -auszug - 0.05;
  stange.add(augeUnten);
  stange.position.y = -laenge;
  gruppe.add(stange);

  return { gruppe, gehaeuse, stange };
}

/* ------------------------------------------------- 05 Hydraulikschlauch */

/**
 * Hydraulikschlauch mit Verschraubungen an beiden Enden.
 *
 * Auf der Zeichnung liegen sie als eigene Positionen gebogen neben dem Gerät,
 * jeweils mit Sechskant-Verschraubung und gebogenem Anschlussstück. Genau das
 * macht sie als Schlauch erkennbar und nicht als Rohr.
 */
export function baueSchlauch(st: Stoffe, laenge = 0.9): THREE.Group {
  const g = new THREE.Group();
  g.name = "05_HYDRAULIKSCHLAUCH";
  const kurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(laenge * 0.3, -laenge * 0.22, 0),
    new THREE.Vector3(laenge * 0.7, -laenge * 0.3, 0),
    new THREE.Vector3(laenge, -laenge * 0.06, 0)
  );
  const schlauch = new THREE.Mesh(new THREE.TubeGeometry(kurve, 14, 0.024, 8, false), st.gummi);
  g.add(schlauch);
  for (const t of [0, 1]) {
    const punkt = kurve.getPoint(t);
    const mutter = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 6), st.bolzen);
    const richtung = kurve.getTangent(t);
    mutter.position.copy(punkt).addScaledVector(richtung, t === 0 ? 0.05 : -0.05);
    mutter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung);
    g.add(mutter);
  }
  return g;
}

/* --------------------------------------------------- 08 Greiferschale */

/**
 * Greiferschale — der Schalenkörper mit Lagerauge und Anlenkauge.
 *
 * Die Detailansicht der Zeichnung zeigt eine Schweißkonstruktion, keinen Guss:
 * eine gewölbte Haut zwischen zwei Seitenwangen, darüber ein Kastenprofil mit
 * den beiden Lageraugen, hinten die Konsole mit dem Anlenkauge für die
 * Kolbenstange, unten die geschraubte Spitze. Überall dazwischen Kehlnähte.
 *
 * Die Krümmung ist dieselbe wie bisher — sechs Abschnitte, jeder um
 * `SEGMENTBOGEN` weiter gekippt. Neu ist die Breite: Auf der Zeichnung ist die
 * Schale oben rund doppelt so breit wie die schmale Sichelkralle und läuft erst
 * zur Spitze hin zusammen. Genau das unterscheidet eine Greiferschale von
 * einem Zinken.
 */
const SCHALE_BREITE = [0.74, 0.7, 0.62, 0.52, 0.4, 0.26, 0.16];

export function baueGreiferschale(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "08_GREIFERSCHALE";

  /* Stuetzstellen der Mittellinie im eigenen Frame: der Ursprung liegt im
   * Lagerauge, die Schale haengt darunter. */
  const stationen = schalenStationen();

  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = (x: number, yy: number, zz: number, u: number, v: number): number => {
    const i = pos.length / 3;
    pos.push(x, yy, zz);
    uv.push(u, v);
    return i;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  const QUER = 4;
  const TIEFE = 0.17; // wie weit die Haut nach innen durchhaengt
  const HAUT = 0.045;

  const lagen: number[][][] = [];
  for (const seite of [0, 1]) {
    const reihen: number[][] = [];
    for (let k = 0; k <= SEGMENTE; k++) {
      const st0 = stationen[k]!;
      const halb = (SCHALE_BREITE[k] ?? 0.16) / 2;
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const x = -halb + t * 2 * halb;
        // Wölbung: in der Mitte am tiefsten, an den Wangen bündig
        const woelbung = TIEFE * (1 - ((x / Math.max(halb, 1e-3)) ** 2));
        const versatz = woelbung + seite * HAUT;
        reihe.push(
          p(
            x,
            st0.y + versatz * Math.sin(st0.th),
            st0.z + versatz * Math.cos(st0.th),
            t,
            k / SEGMENTE
          )
        );
      }
      reihen.push(reihe);
    }
    lagen.push(reihen);
  }
  const [aussen, innen] = lagen as [number[][], number[][]];
  for (let k = 0; k < SEGMENTE; k++) {
    for (let j = 0; j < QUER; j++) {
      quad(aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      quad(innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    quad(aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    quad(innen[k]![QUER]!, aussen[k]![QUER]!, aussen[k + 1]![QUER]!, innen[k + 1]![QUER]!);
  }
  for (let j = 0; j < QUER; j++) {
    quad(innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    quad(aussen[SEGMENTE]![j]!, aussen[SEGMENTE]![j + 1]!, innen[SEGMENTE]![j + 1]!, innen[SEGMENTE]![j]!);
  }
  const haut = new THREE.BufferGeometry();
  haut.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  haut.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  haut.setIndex(idx);
  haut.computeVertexNormals();
  const hautMesh = new THREE.Mesh(haut, st.blech);
  hautMesh.name = "08_HAUT";
  g.add(hautMesh);

  /*
   * Seitenwangen: die tragenden Bleche an den Kanten.
   *
   * Als Strang entlang der Kruemmung, nicht als extrudierte Flaeche. Der erste
   * Anlauf hat sie mit `ExtrudeGeometry` aus einem Profil in der yz-Ebene
   * gebaut und dann gedreht — auf dem Teileblatt haengten sie als lose Lappen
   * neben der Schale.
   *
   * Die Wange folgt der Breite der Haut: Weil die Schale zur Spitze hin
   * schmaler wird, wandert sie nach innen. Gebaut wird sie darum in Abschnitten
   * mit je eigener x-Lage.
   */
  for (const seite of [-1, 1]) {
    for (let k = 0; k < SEGMENTE; k++) {
      const halb = ((SCHALE_BREITE[k] ?? 0.16) + (SCHALE_BREITE[k + 1] ?? 0.16)) / 4;
      /*
       * Versatz negativ: Die Wange steht IN den Trog hinein, nicht aus ihm
       * heraus. Andersherum verschwindet sie hinter der Haut, und die Schale
       * liest sich als flaches Blech statt als Trog — genau so sah sie auf dem
       * ersten Teileblatt aus.
       */
      const wange = new THREE.Mesh(
        strang(stationen.slice(k, k + 2), seite * halb, 0.055, 0.24, -0.24),
        st.blech
      );
      wange.name = `08_WANGE_${seite < 0 ? "L" : "R"}_${k + 1}`;
      g.add(wange);
    }
  }

  /* Kastenprofil mit den Lageraugen — das Hülsengelenk zum Mittelstück */
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), st.guss);
  kasten.name = "08_LAGERKASTEN";
  kasten.position.set(0, 0.02, 0.06);
  g.add(kasten);
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(rohr(0.13, 0.062, 0.12), st.guss);
    auge.name = `08_LAGERAUGE_${seite < 0 ? "L" : "R"}`;
    auge.position.set(seite * 0.3, 0, 0);
    g.add(auge);
    const n = naht(0.26);
    n.rotation.z = Math.PI / 2;
    n.position.set(seite * 0.24, 0, 0.02);
    g.add(n);
  }

  /* Konsole mit Anlenkauge fuer die Kolbenstange */
  const konsole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.26), st.guss);
  konsole.name = "08_KONSOLE";
  konsole.position.set(0, -0.04, 0.22);
  g.add(konsole);
  const anlenkauge = new THREE.Mesh(rohr(0.075, 0.046, 0.16), st.guss);
  anlenkauge.name = "08_ANLENKAUGE";
  anlenkauge.position.set(0, -0.04, 0.32);
  g.add(anlenkauge);
  const nahtKonsole = naht(0.2);
  nahtKonsole.rotation.z = Math.PI / 2;
  nahtKonsole.position.set(0, -0.11, 0.12);
  g.add(nahtKonsole);

  return g;
}

/* ------------------------------------------------- 09 Verschleißblech */

/**
 * Verschleißblech — der seitliche Schutz auf der Wange.
 *
 * Eigenes Teil, weil es das auf der Zeichnung auch ist: ein geschraubtes Blech,
 * das man wechselt, wenn es durch ist. Es liegt außen auf der Wange und folgt
 * ihrer Krümmung.
 */
export function baueVerschleissblech(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "09_VERSCHLEISSBLECH";
  const stationen = schalenStationen();
  // Positiver Versatz: Das Blech liegt AUSSEN auf dem Ruecken, wo es scheuert.
  const blech = new THREE.Mesh(strang(stationen.slice(1), 0, 0.13, 0.04, 0.19), st.blech);
  blech.name = "09_BLECH";
  g.add(blech);
  // Zwei Senkschrauben, mit denen es auf der Wange sitzt
  for (const k of [2, 4]) {
    const st0 = stationen[k]!;
    const schraube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 6), st.bolzen);
    schraube.position.set(0, st0.y + 0.21 * Math.sin(st0.th), st0.z + 0.21 * Math.cos(st0.th));
    schraube.rotation.x = -st0.th + Math.PI / 2;
    g.add(schraube);
  }
  return g;
}

/* ---------------------------------------------------- 10 Greiferspitze */

/**
 * Greiferspitze — der austauschbare Zahn am Schalenende.
 *
 * Auf der Zeichnung ein eigenes Teil mit zwei Schraubenlöchern: ein
 * Schmiedeteil, das über das Schalenende geschoben und verschraubt wird. Es
 * läuft auf eine Schneide zu, nicht auf einen Punkt.
 */
export function baueGreiferspitze(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "10_GREIFERSPITZE";
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.085, 0.34, 4), st.bolzen);
  koerper.scale.set(1.35, 1, 0.55);
  koerper.rotation.y = Math.PI / 4;
  g.add(koerper);
  const kragen = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.13), st.bolzen);
  kragen.position.y = 0.18;
  g.add(kragen);
  for (const x of [-0.09, 0.09]) {
    const loch = new THREE.Mesh(rohr(0.024, 0.013, 0.15), st.blech);
    loch.rotation.x = Math.PI / 2;
    loch.rotation.z = Math.PI / 2;
    loch.position.set(x, 0.18, 0);
    g.add(loch);
  }
  return g;
}

/* ------------------------------------------------------ 11 Gelenkbolzen */

/**
 * Gelenkbolzen — der Bolzen, der Schale und Mittelstück verbindet.
 *
 * Länger als das Auge, mit Bund am einen und Nut für den Sicherungsring am
 * anderen Ende. Der Durchmesser passt in die Buchse, nicht direkt ins Auge —
 * das ist der Sinn der Buchse.
 */
export function baueGelenkbolzen(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "11_GELENKBOLZEN";
  const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.56, 14), st.bolzen);
  schaft.rotation.z = Math.PI / 2;
  g.add(schaft);
  const bund = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 14), st.bolzen);
  bund.rotation.z = Math.PI / 2;
  bund.position.x = -0.28;
  g.add(bund);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.02, 14), st.blech);
  nut.rotation.z = Math.PI / 2;
  nut.position.x = 0.25;
  g.add(nut);
  return g;
}

/** Alle Einzelteile, in der Reihenfolge der Positionsliste. */
export function einzelteile(st: Stoffe = stoffe()): Array<{ name: string; teil: THREE.Object3D }> {
  nahtStoff(st);
  const zyl = baueZylinder(st);
  return [
    { name: "01  Anschraubplatte", teil: baueAnschraubplatte(st) },
    { name: "02  Aufnahmebolzen", teil: baueAufnahmebolzen(st) },
    { name: "03  Rotator", teil: baueRotator(st) },
    { name: "04  Hydraulikzylinder", teil: zyl.gruppe },
    { name: "05  Hydraulikschlauch", teil: baueSchlauch(st) },
    { name: "06  Schutzabdeckung", teil: baueSchutzabdeckung(st) },
    { name: "07  Mittelstueck", teil: baueMittelstueck(st) },
    { name: "08  Greiferschale", teil: baueGreiferschale(st) },
    { name: "09  Verschleissblech", teil: baueVerschleissblech(st) },
    { name: "10  Greiferspitze", teil: baueGreiferspitze(st) },
    { name: "11  Gelenkbolzen", teil: baueGelenkbolzen(st) },
    { name: "12  Buchse", teil: baueBuchse(st) },
    { name: "13  Sicherungsring", teil: baueSicherungsring(st) },
  ];
}

/** Der Gelenkkreis, den die fünf Lageraufnahmen beschreiben (m). */
export const LAGERKREIS = GELENKRING;
