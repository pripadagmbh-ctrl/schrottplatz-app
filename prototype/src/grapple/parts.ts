/**
 * Die Bauteile des Mehrschalengreifers.
 *
 * Jede Funktion liefert genau ein Bauteil, gebaut um seinen eigenen Ursprung.
 * Das ist keine Ordnungsliebe, sondern die Bedingung für alles Weitere: Der
 * Ursprung eines Teils ist im glTF sein Pivot. Eine Schale, die um ihren
 * Drehbolzen gebaut ist, dreht sich in jeder Engine um genau diesen Bolzen —
 * ohne Korrekturwerte, ohne Nachrechnen.
 *
 * Maße kommen ausnahmslos aus `form.ts`.
 */
import * as THREE from "three";
import {
  ABSCHNITT,
  BOLZENKREIS,
  KOPF_OBERKANTE,
  TASCHE_HALBWINKEL,
  kopfKontur,
  HAUT,
  KOPFHOEHE,
  LASCHE,
  MASSSTAB,
  ROHRLAENGE,
  ZYLINDER_RADIUS,
  SCHALEN,
  SCHALE_HALBWINKEL,
  STATIONEN,
  WANGE,
  ZU,
  ZYLINDER_AUFNAHME,
  halbbreite,
  mittellinie,
} from "./form";

/* ------------------------------------------------------------------ Stoffe */

/**
 * Die Werkstoffe, als PBR-Materialien.
 *
 * Die Farben sind vom Prospektfoto abgenommen: dunkelgrauer Lack am
 * Grundkörper, fast schwarzer Stahl an den hochbelasteten Stellen, das
 * Maschinengrün ausschließlich an den Zylinderrohren. Genau diese Sparsamkeit
 * macht das Gerät industriell — drei Farben, nicht zehn.
 */
export interface Stoffe {
  lack: THREE.MeshStandardMaterial;
  stahl: THREE.MeshStandardMaterial;
  bolzen: THREE.MeshStandardMaterial;
  gruen: THREE.MeshStandardMaterial;
  chrom: THREE.MeshStandardMaterial;
  gummi: THREE.MeshStandardMaterial;
  verschleiss: THREE.MeshStandardMaterial;
  ventil: THREE.MeshStandardMaterial;
}

export function stoffe(): Stoffe {
  const m = (
    name: string,
    color: number,
    roughness: number,
    metalness: number
  ): THREE.MeshStandardMaterial => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    mat.name = name;
    return mat;
  };
  return {
    lack: m("Stahl_lackiert", 0x3c4246, 0.55, 0.35),
    stahl: m("Stahl_dunkel", 0x23282b, 0.48, 0.72),
    bolzen: m("Stahl_blank", 0xc2c8ce, 0.22, 0.94),
    gruen: m("Lack_gruen", 0x6db33f, 0.42, 0.3),
    chrom: m("Kolbenstange_chrom", 0xd7dce1, 0.11, 0.95),
    gummi: m("Hydraulikschlauch", 0x15181a, 0.85, 0.05),
    verschleiss: m("Verschleissflaeche", 0x8b9299, 0.35, 0.85),
    /* Der Ventilblock unter dem Zapfen ist auf dem Foto gelb — das einzige
     * Gelb am Geraet, und genau deshalb faellt er auf. */
    ventil: m("Ventilblock_gelb", 0xc9a81f, 0.5, 0.4),
  };
}

/* ------------------------------------------------------- Hilfe für Flächen */

interface Netz {
  pos: number[];
  uv: number[];
  idx: number[];
}

function netz(): Netz {
  return { pos: [], uv: [], idx: [] };
}

function punkt(n: Netz, x: number, y: number, z: number, u: number, v: number): number {
  const i = n.pos.length / 3;
  n.pos.push(x, y, z);
  n.uv.push(u, v);
  return i;
}

function viereck(n: Netz, a: number, b: number, c: number, d: number): void {
  n.idx.push(a, b, c, a, c, d);
}

function fertig(n: Netz, name: string): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(n.pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(n.uv, 2));
  g.setIndex(n.idx);
  g.computeVertexNormals();
  g.name = name;
  return g;
}

/**
 * Ein Punkt der Schale im Frame ihres Gelenks.
 *
 * Die Umrechnung ist einfacher, als sie aussieht: Ein Punkt, der im Frame des
 * Greifers bei Radius `r`, Umfangswinkel `u` und Höhe `y` liegt, hat im Frame
 * des Gelenks — das auf dem Bolzenkreis sitzt und um seinen eigenen Winkel
 * gedreht ist — immer die Koordinaten
 *
 *     (r·sin u, y + Kopfhöhe, r·cos u − Bolzenkreis)
 *
 * unabhängig davon, um welche der Schalen es geht. Deshalb wird die Schale
 * einmal gebaut und für jede Position wiederverwendet.
 */
function amGelenk(r: number, u: number, y: number): [number, number, number] {
  return [r * Math.sin(u), y + KOPFHOEHE, r * Math.cos(u) - BOLZENKREIS];
}

/** Querschnitt: die Winkel-Stützstellen über die Breite. */
const QUER = 4;

interface Rippe {
  y: number;
  r: number;
  u: number;
}

/**
 * Die Stützstellen der Schale, gebaut im GESCHLOSSENEN Zustand.
 *
 * Warum geschlossen und nicht bei Schwenk 0: Bei 0 stünde die Schale senkrecht
 * unter ihrem Bolzen und liefe durch die Drehachse hindurch auf die Gegenseite
 * — die Radien würden negativ. Geschlossen bleiben sie durchweg positiv, und
 * gedreht wird später nur die Abweichung vom geschlossenen Zustand.
 */
function schalenRippen(): Rippe[] {
  return mittellinie(ZU).map((st, k) => ({
    y: st.y,
    r: st.r,
    u: Math.asin(Math.min(0.999, halbbreite(k, st.r) / Math.max(st.r, 0.05))),
  }));
}

/* ------------------------------------------------------------ (1) ADAPTER */

/**
 * Aufhängung: Adapterplatte und Gabel mit Bolzen.
 *
 * Das oberste Bauteil, mit dem der Greifer am Stiel hängt. Auf dem Prospektfoto
 * sind es zwei hochstehende Bleche mit einer Bohrung, dazwischen der Bolzen —
 * daran erkennt man, dass das Gerät abnehmbar ist.
 */
export function baueAdapter(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "ADAPTER";
  const R = BOLZENKREIS;
  for (const seite of [-1, 1]) {
    const ohr = new THREE.Mesh(new THREE.BoxGeometry(0.1 * R, 0.3 * R, 0.42 * R), st.stahl);
    ohr.name = `ADAPTER_OHR_${seite < 0 ? "L" : "R"}`;
    ohr.position.set(seite * 0.17 * R, -0.13 * R, 0);
    g.add(ohr);
  }
  const bolzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075 * R, 0.075 * R, 0.52 * R, 12),
    st.bolzen
  );
  bolzen.name = "ADAPTER_BOLZEN";
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.y = -0.06 * R;
  g.add(bolzen);
  const platte = new THREE.Mesh(new THREE.BoxGeometry(0.66 * R, 0.1 * R, 0.66 * R), st.lack);
  platte.name = "ADAPTER_PLATTE";
  platte.position.y = -0.33 * R;
  g.add(platte);
  return g;
}

/* ------------------------------------------------------------ (2) ROTATOR */

/**
 * Drehwerk: Motorgehäuse, Drehkranz, Drehdurchführung.
 *
 * Der Drehkranz ist das Erkennungsmerkmal — der breite Flansch, auf dem der
 * ganze Greiferkopf sitzt. Ohne ihn liest sich das Teil als Kiste.
 *
 * Der Ursprung liegt auf der Drehachse: Das Bauteil ist zugleich der Pivot für
 * die Rotationsanimation.
 */
export function baueRotator(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "ROTATOR";
  const R = BOLZENKREIS;
  const gehaeuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * R, 0.34 * R, 0.24 * R, 12),
    st.stahl
  );
  gehaeuse.name = "ROTATOR_GEHAEUSE";
  gehaeuse.position.y = -0.15 * R;
  g.add(gehaeuse);
  const kranz = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4 * R, 0.4 * R, 0.09 * R, 16),
    st.lack
  );
  kranz.name = "ROTATOR_DREHKRANZ";
  kranz.position.y = -0.31 * R;
  g.add(kranz);
  const stutzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06 * R, 0.06 * R, 0.24 * R, 8),
    st.stahl
  );
  stutzen.name = "ROTATOR_DURCHFUEHRUNG";
  stutzen.rotation.z = Math.PI / 2;
  stutzen.position.set(0.33 * R, -0.13 * R, 0);
  g.add(stutzen);
  return g;
}

/* ------------------------------------------------------- (3) GRAPPLE_HEAD */

/**
 * Greiferkopf (Mitteltraverse): Gussblock mit gefrästen Taschen, Unterflansch,
 * Lagerböcke und Gusszapfen.
 *
 * „Mitteltraverse aus hochfestem Stahlguss" (Prospekt) — ein Teil, nicht
 * mehrere.
 *
 * Der Kopf war bis zum 13.09.2026 ein glatter Kegelstumpf, an dem die Zylinder
 * außen an Ohren hingen. Befund dazu, im Klartext: „Der Greiferkopf ist kein
 * Vollklotz, wo die Hülsen angeschweißt bzw. die Hydraulikzylinder außen
 * angebracht sind. Die Zylinder laufen nach innen, weil es entsprechende
 * Fräsungen für die Zylinder gibt."
 *
 * Genau so ist es jetzt gebaut: In den Block ist je Schale eine senkrechte
 * Tasche gefräst, in der der Zylinder liegt; zwischen den Taschen stehen die
 * Rippen. Deshalb ist der Kopf von oben gezahnt und nicht rund, und deshalb
 * sieht man von außen die Zylinder in ihren Nischen statt davor.
 *
 * Das hat die Anlenkung mitgezogen: Versenkt rückt die Zylinderachse von 0,92
 * auf 0,72 Bolzenkreisradien nach innen, und der Zylinder steht dadurch fast
 * senkrecht (5° statt 12°) — wie auf dem Foto.
 *
 * Unter dem Block hängt der Gusszapfen. Er war zwischendurch ganz entfallen,
 * weil ich ihn für den Träger der Schalen gehalten hatte — das ist er nicht,
 * die Schalen hängen an den Lagerböcken am Blockrand. Er ist trotzdem da: der
 * mittige Gusskegel, um den sich die Schalen schließen.
 */
export function baueKopf(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  g.name = "GRAPPLE_HEAD";
  const R = BOLZENKREIS;
  const OBEN = KOPF_OBERKANTE * KOPFHOEHE;
  const UNTEN = -KOPFHOEHE;
  /*
   * Ungleiche Hoehenstufen, dichter dort, wo sich die Kontur aendert: am Bauch
   * des Zapfens und im Auslauf der Fraesung. Gleichmaessige Stufen haetten
   * genau diese beiden Knicke verschmiert.
   */
  const STUFEN = [KOPF_OBERKANTE, -0.4, -0.55, -0.7, -0.8, -0.86, -0.93, -1.0];
  /*
   * Wenige Stützstellen, aber die Kanten zwischen Rippe und Tasche doppelt:
   * Dort stehen zwei Ecken auf demselben Punkt, jede nur mit ihrer eigenen
   * Fläche verbunden. `computeVertexNormals` mittelt dann nicht über die Kante
   * hinweg, und die Fräsung bekommt einen scharfen Rand statt eines weichen
   * Übergangs — ohne dass das Netz insgesamt feiner werden muss.
   */
  const RIPPE_N = 3;
  const TASCHE_N = 4;
  const winkel: number[] = [];
  const sektor = (Math.PI * 2) / SCHALEN;
  for (let i = 0; i < SCHALEN; i++) {
    const a = (i / SCHALEN) * Math.PI * 2;
    const rippeVon = a + TASCHE_HALBWINKEL;
    const rippeBis = a + sektor - TASCHE_HALBWINKEL;
    for (let k = 0; k <= RIPPE_N; k++) {
      winkel.push(rippeVon + ((rippeBis - rippeVon) * k) / RIPPE_N);
    }
    for (let k = 0; k <= TASCHE_N; k++) {
      winkel.push(rippeBis + ((2 * TASCHE_HALBWINKEL) * k) / TASCHE_N);
    }
  }

  const n = netz();
  const lagen: number[][] = [];
  for (let h = 0; h < STUFEN.length; h++) {
    const y = STUFEN[h]! * KOPFHOEHE;
    const reihe: number[] = [];
    for (const th of winkel) {
      const r = kopfKontur(th, y);
      reihe.push(
        punkt(n, r * Math.sin(th), y, r * Math.cos(th), th / (Math.PI * 2), h / (STUFEN.length - 1))
      );
    }
    lagen.push(reihe);
  }
  for (let h = 0; h < STUFEN.length - 1; h++) {
    for (let j = 0; j < winkel.length; j++) {
      const j2 = (j + 1) % winkel.length;
      viereck(n, lagen[h]![j]!, lagen[h]![j2]!, lagen[h + 1]![j2]!, lagen[h + 1]![j]!);
    }
  }
  // Deckel oben und unten, als Fächer auf die Achse
  const mitteOben = punkt(n, 0, OBEN, 0, 0.5, 0);
  const mitteUnten = punkt(n, 0, UNTEN, 0, 0.5, 1);
  for (let j = 0; j < winkel.length; j++) {
    const j2 = (j + 1) % winkel.length;
    n.idx.push(mitteOben, lagen[0]![j2]!, lagen[0]![j]!);
    const letzte = lagen[STUFEN.length - 1]!;
    n.idx.push(mitteUnten, letzte[j]!, letzte[j2]!);
  }
  const block = new THREE.Mesh(fertig(n, "GreiferkopfGeo"), st.lack);
  block.name = "HEAD_GRUNDKOERPER";
  g.add(block);

  /*
   * Ventilblock unter dem Zapfen.
   *
   * Auf dem Foto von unten (13.09.2026) sitzt mittig unter dem Guss ein gelber
   * Block mit den Schlauchanschluessen — der Oelverteiler, von dem die vier
   * bzw. fuenf Zylinder gespeist werden. Er ist klein, aber er ist das
   * einzige, was unten aus der Mitte herausschaut, und ohne ihn wirkt die
   * Unterseite wie abgesaegt.
   */
  const ventil = new THREE.Mesh(
    new THREE.BoxGeometry(0.3 * R, 0.14 * KOPFHOEHE, 0.3 * R),
    st.ventil
  );
  ventil.name = "HEAD_VENTILBLOCK";
  ventil.position.y = UNTEN - 0.05 * KOPFHOEHE;
  g.add(ventil);
  const deckel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * R, 0.14 * R, 0.07 * KOPFHOEHE, SCHALEN * 2),
    st.stahl
  );
  deckel.name = "HEAD_ZAPFEN_DECKEL";
  deckel.position.y = UNTEN + 0.01 * KOPFHOEHE;
  g.add(deckel);

  for (let i = 0; i < SCHALEN; i++) {
    const a = (i / SCHALEN) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const nr = String(i + 1).padStart(2, "0");

    // Lagerbock: die Gabel am Blockrand, die den Schalenbolzen hält
    const lagerbock = new THREE.Mesh(
      new THREE.BoxGeometry(0.32 * R, 0.2 * KOPFHOEHE, 0.4 * R),
      st.stahl
    );
    lagerbock.name = `HEAD_LAGERBOCK_${nr}`;
    lagerbock.position.set(sin * 0.9 * R, UNTEN + 0.06 * KOPFHOEHE, cos * 0.9 * R);
    lagerbock.rotation.y = a;
    g.add(lagerbock);

    // Bolzen, auf dem das Zylinderrohr in seiner Tasche schwenkt
    const bolzen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06 * R, 0.06 * R, 0.42 * R, 10),
      st.bolzen
    );
    bolzen.name = `HEAD_ZYLINDERBOLZEN_${nr}`;
    bolzen.position.set(
      sin * ZYLINDER_AUFNAHME.r * R,
      ZYLINDER_AUFNAHME.y * KOPFHOEHE,
      cos * ZYLINDER_AUFNAHME.r * R
    );
    bolzen.rotation.y = a;
    bolzen.rotation.z = Math.PI / 2;
    g.add(bolzen);
  }
  return g;
}

/* ------------------------------------------------------- (6) GELENKBOLZEN */

/**
 * Gelenkbolzen einer Schale, quer zur Drehachse.
 *
 * „Lagerstellen groß dimensioniert mit hochfesten Bolzen und Buchsen"
 * (Prospekt). Der Bolzen liegt auf genau der Achse, um die die Schale schwenkt
 * — er ist damit die sichtbare Begründung für den Pivot.
 */
export function baueGelenkbolzen(st: Stoffe): THREE.Mesh {
  const R = BOLZENKREIS;
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085 * R, 0.085 * R, 0.62 * R, 12),
    st.bolzen
  );
  m.rotation.z = Math.PI / 2;
  return m;
}

/* ----------------------------------------------------------- (5) SHELL_0n */

/**
 * Schalenkörper: Außenhaut, Innenhaut, zwei Seitenwangen, Rand und Spitze.
 *
 * Die Schale ist ein geschweißter Trog („Greifer-Schalen in Hardox
 * Schweißkonstruktion"), kein Ausschnitt aus einem Rotationskörper. Als
 * Spaltstück hätte sie keine eigene Form und keine Kanten, und geschlossen
 * ergäbe sie zwangsläufig ein Ei.
 *
 * UV: u läuft über die Breite, v vom Bolzen zur Spitze. Damit liegt eine
 * Verschleiß- oder Rostmaske später in Laufrichtung der Schale, nicht quer.
 */
export function baueSchalenkoerper(st: Stoffe): THREE.Mesh {
  const rippen = schalenRippen();
  const n = netz();
  const aussen: number[][] = [];
  const innen: number[][] = [];

  for (const lage of [0, 1]) {
    const ziel = lage === 0 ? aussen : innen;
    for (let k = 0; k <= STATIONEN; k++) {
      const rp = rippen[k]!;
      const r = Math.max(0.03, rp.r - lage * HAUT);
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const u = -rp.u + t * 2 * rp.u;
        const [x, y, z] = amGelenk(r, u, rp.y);
        reihe.push(punkt(n, x, y, z, t, k / STATIONEN));
      }
      ziel.push(reihe);
    }
  }

  for (let k = 0; k < STATIONEN; k++) {
    for (let j = 0; j < QUER; j++) {
      viereck(n, aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      viereck(n, innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    viereck(n, aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    viereck(n, innen[k]![QUER]!, aussen[k]![QUER]!, aussen[k + 1]![QUER]!, innen[k + 1]![QUER]!);
  }
  for (let j = 0; j < QUER; j++) {
    viereck(n, innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    const e = STATIONEN;
    viereck(n, aussen[e]![j]!, aussen[e]![j + 1]!, innen[e]![j + 1]!, innen[e]![j]!);
  }

  const m = new THREE.Mesh(fertig(n, "SchalenkoerperGeo"), st.lack);
  return m;
}

/**
 * Seitenwange einer Schale — das tragende Blech an der Kante.
 *
 * Sie steht ein Stück über die Haut hinaus und reicht nach innen. Daran sieht
 * man von der Seite, dass da Blech steht und nicht eine gewölbte Fläche; und
 * sie ist es, die beim Schließen an die Nachbarschale stößt.
 */
export function baueWange(st: Stoffe, seite: number): THREE.Mesh {
  const rippen = schalenRippen();
  const n = netz();
  const reihen: number[][] = [];
  for (let k = 0; k <= STATIONEN; k++) {
    const rp = rippen[k]!;
    const u = seite * rp.u;
    /*
     * Wie weit die Wange nach innen reicht, als Winkel.
     *
     * Gedeckelt auf die halbe Schalenbreite. Ohne den Deckel wuchs der Winkel
     * zur Spitze hin ins Unermessliche — bei 6 cm Radius ergaben 10 cm Wange
     * 96°, und die Wange schwenkte quer durch den Sektor der Nachbarschale.
     * Die Bewegungspruefung hat genau das gefangen.
     */
    const du =
      -seite *
      Math.min(WANGE / Math.max(rp.r, 0.05), Math.max(rp.u * 0.9, 0.02));
    const reihe: number[] = [];
    // vier Ecken des Wangenprofils: aussen/innen × Kante/eingerückt
    for (const [r, uu] of [
      [rp.r + WANGE * 0.35, u],
      [rp.r + WANGE * 0.35, u + du],
      [rp.r - HAUT * 1.6, u + du],
      [rp.r - HAUT * 1.6, u],
    ] as Array<[number, number]>) {
      const [x, y, z] = amGelenk(Math.max(0.03, r), uu, rp.y);
      reihe.push(punkt(n, x, y, z, (uu - u) / Math.max(du, 1e-6), k / STATIONEN));
    }
    reihen.push(reihe);
  }
  for (let k = 0; k < STATIONEN; k++) {
    for (let e = 0; e < 4; e++) {
      const f = (e + 1) % 4;
      viereck(n, reihen[k]![e]!, reihen[k]![f]!, reihen[k + 1]![f]!, reihen[k + 1]![e]!);
    }
  }
  viereck(n, reihen[0]![3]!, reihen[0]![2]!, reihen[0]![1]!, reihen[0]![0]!);
  const e = STATIONEN;
  viereck(n, reihen[e]![0]!, reihen[e]![1]!, reihen[e]![2]!, reihen[e]![3]!);
  return new THREE.Mesh(fertig(n, "WangeGeo"), st.stahl);
}

/* ------------------------------------------------------ (8) WEAR_PLATE_0n */

/**
 * Verschleißmesser an der Schneide.
 *
 * „Lange Lebensdauer der Spitzen durch hochfesten Schmiedestahl" (Prospekt).
 * Das Messer liegt auf den letzten beiden Stationen, ein paar Millimeter über
 * der Haut, in blankem Material — im Spiel ist das der helle Streifen, der die
 * Schale unten abschließt und ihr eine Richtung gibt.
 */
export function baueVerschleissmesser(st: Stoffe): THREE.Mesh {
  const rippen = schalenRippen();
  const n = netz();
  const VON = STATIONEN - 3;
  const aussen: number[][] = [];
  const innen: number[][] = [];
  for (const lage of [0, 1]) {
    const ziel = lage === 0 ? aussen : innen;
    for (let k = VON; k <= STATIONEN; k++) {
      const rp = rippen[k]!;
      const r = Math.max(0.025, rp.r + (lage === 0 ? 0.02 * MASSSTAB : -HAUT * 0.8));
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const u = (-rp.u + t * 2 * rp.u) * 0.94;
        const [x, y, z] = amGelenk(r, u, rp.y);
        reihe.push(punkt(n, x, y, z, t, (k - VON) / (STATIONEN - VON)));
      }
      ziel.push(reihe);
    }
  }
  const lagen = STATIONEN - VON;
  for (let k = 0; k < lagen; k++) {
    for (let j = 0; j < QUER; j++) {
      viereck(n, aussen[k]![j]!, aussen[k]![j + 1]!, aussen[k + 1]![j + 1]!, aussen[k + 1]![j]!);
      viereck(n, innen[k]![j + 1]!, innen[k]![j]!, innen[k + 1]![j]!, innen[k + 1]![j + 1]!);
    }
    viereck(n, aussen[k]![0]!, innen[k]![0]!, innen[k + 1]![0]!, aussen[k + 1]![0]!);
    viereck(n, innen[k]![QUER]!, aussen[k]![QUER]!, aussen[k + 1]![QUER]!, innen[k + 1]![QUER]!);
  }
  for (let j = 0; j < QUER; j++) {
    viereck(n, innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    viereck(n, aussen[lagen]![j]!, aussen[lagen]![j + 1]!, innen[lagen]![j + 1]!, innen[lagen]![j]!);
  }
  return new THREE.Mesh(fertig(n, "VerschleissmesserGeo"), st.verschleiss);
}

/**
 * Schalenspitze: der geschmiedete Zahn am Ende.
 *
 * Er ist kein aufgesetzter Dorn, sondern der letzte Abschnitt der Schale
 * selbst — gebaut aus denselben Stationen und derselben Breitenfunktion, nur
 * ein Stück proud und aus blankem Material. Genau so sieht es auf dem
 * Prospektfoto aus: Die Schale läuft in ihre Spitze aus, sie trägt keine.
 *
 * Der erste Anlauf war ein Keil, der über die letzte Station hinausragte. Die
 * Bewegungsprüfung hat ihn sofort gefangen: Er schoss über die Drehachse
 * hinaus, landete im Sektor der gegenüberliegenden Schale und steckte dort
 * drin. Gebaut aus der Breitenfunktion kann das nicht passieren — sie deckelt
 * die Breite auf `r · sin(Halbwinkel)`, und damit schrumpft die Spitze
 * zwangsläufig mit dem Radius.
 */
export function baueSpitze(st: Stoffe): THREE.Mesh {
  const rippen = schalenRippen();
  const VON = STATIONEN - 1;
  const n = netz();
  const aussen: number[][] = [];
  const innen: number[][] = [];
  for (const lage of [0, 1]) {
    const ziel = lage === 0 ? aussen : innen;
    for (let k = VON; k <= STATIONEN; k++) {
      const rp = rippen[k]!;
      // Am Ende laeuft die Spitze auf eine Schneide zu, nicht auf eine Flaeche
      const schmaler = k === STATIONEN ? 0.55 : 0.95;
      const r = Math.max(0.02, rp.r + (lage === 0 ? 0.03 * MASSSTAB : -HAUT * 0.7));
      const reihe: number[] = [];
      for (let j = 0; j <= QUER; j++) {
        const t = j / QUER;
        const u = (-rp.u + t * 2 * rp.u) * schmaler;
        const [x, y, z] = amGelenk(r, u, rp.y);
        reihe.push(punkt(n, x, y, z, t, k - VON));
      }
      ziel.push(reihe);
    }
  }
  for (let j = 0; j < QUER; j++) {
    viereck(n, aussen[0]![j]!, aussen[0]![j + 1]!, aussen[1]![j + 1]!, aussen[1]![j]!);
    viereck(n, innen[0]![j + 1]!, innen[0]![j]!, innen[1]![j]!, innen[1]![j + 1]!);
    viereck(n, innen[0]![j]!, innen[0]![j + 1]!, aussen[0]![j + 1]!, aussen[0]![j]!);
    viereck(n, aussen[1]![j]!, aussen[1]![j + 1]!, innen[1]![j + 1]!, innen[1]![j]!);
  }
  viereck(n, aussen[0]![0]!, innen[0]![0]!, innen[1]![0]!, aussen[1]![0]!);
  viereck(n, innen[0]![QUER]!, aussen[0]![QUER]!, aussen[1]![QUER]!, innen[1]![QUER]!);
  return new THREE.Mesh(fertig(n, "SpitzeGeo"), st.verschleiss);
}

/* --------------------------------------------------------- (4) CYLINDER_0n */

/**
 * Hydraulikzylinder: Rohr und Kolbenstange, je ein eigenes Objekt.
 *
 * Beide sind um ihren eigenen Ursprung gebaut und zeigen nach −y, damit sie
 * sich im Rig einfach aufhängen lassen: Das Rohr hängt am Kopfgelenk, die
 * Stange fährt aus ihm heraus.
 */
export function baueZylinder(st: Stoffe): { rohr: THREE.Mesh; stange: THREE.Mesh } {
  const rohr = new THREE.Mesh(
    new THREE.CylinderGeometry(ZYLINDER_RADIUS * 0.96, ZYLINDER_RADIUS, ROHRLAENGE, 14),
    st.gruen
  );
  rohr.position.y = -ROHRLAENGE / 2;
  const stange = new THREE.Mesh(
    new THREE.CylinderGeometry(ZYLINDER_RADIUS * 0.5, ZYLINDER_RADIUS * 0.5, 1, 10),
    st.chrom
  );
  stange.position.y = -0.5;
  return { rohr, stange };
}

/**
 * Lasche an der Schale, an der die Kolbenstange angreift.
 *
 * Sitzt oberhalb und innerhalb des Drehbolzens. Der kurze Hebelarm zwischen
 * den beiden Bolzen ist der Grund für die Schließkraft — deshalb ist er kurz
 * und deshalb steht der Zylinder steil.
 */
export function baueLasche(st: Stoffe): THREE.Group {
  const g = new THREE.Group();
  const R = BOLZENKREIS;
  const laenge = Math.hypot(LASCHE.y, LASCHE.z);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.14 * R, laenge * 1.15, 0.16 * R),
    st.stahl
  );
  arm.name = "LASCHE_ARM";
  arm.position.set(0, LASCHE.y * 0.5, LASCHE.z * 0.5);
  arm.rotation.x = Math.atan2(LASCHE.z, LASCHE.y);
  g.add(arm);
  const bolzen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055 * R, 0.055 * R, 0.4 * R, 10),
    st.bolzen
  );
  bolzen.name = "LASCHE_BOLZEN";
  bolzen.rotation.z = Math.PI / 2;
  bolzen.position.set(0, LASCHE.y, LASCHE.z);
  g.add(bolzen);
  return g;
}

/* --------------------------------------------------- (7) HYDRAULIC_LINES */

/**
 * Hydraulikleitungen — ein Bogen je Zylinder, vom Kopf zum Rohranschluss.
 *
 * Bewusst grob: vier Schläuche mit sechs Ecken Querschnitt. Sie sind das, was
 * den Kopf als Hydraulikgerät lesbar macht; einzeln sichtbar sind sie in einer
 * Spielkamera nie. Verlegt werden sie als Bézierbogen, damit sie hängen und
 * nicht wie Rohre stehen.
 */
export function baueLeitungen(st: Stoffe, anschluesse: THREE.Vector3[]): THREE.Group {
  const g = new THREE.Group();
  g.name = "HYDRAULIC_LINES";
  const R = BOLZENKREIS;
  anschluesse.forEach((ziel, i) => {
    const start = new THREE.Vector3(
      ziel.x * 0.32,
      -0.2 * KOPFHOEHE,
      ziel.z * 0.32
    );
    const bauch = new THREE.Vector3(
      (start.x + ziel.x) * 0.5 * 1.18,
      (start.y + ziel.y) * 0.5 - 0.1 * KOPFHOEHE,
      (start.z + ziel.z) * 0.5 * 1.18
    );
    const kurve = new THREE.QuadraticBezierCurve3(start, bauch, ziel);
    const rohr = new THREE.Mesh(
      new THREE.TubeGeometry(kurve, 6, 0.035 * R, 6, false),
      st.gummi
    );
    rohr.name = `HYDRAULIC_LINE_${String(i + 1).padStart(2, "0")}`;
    g.add(rohr);
  });
  return g;
}

/** Die Winkel-Halbbreite einer Schale, für Prüfungen von außen sichtbar. */
export { SCHALE_HALBWINKEL, ABSCHNITT };
