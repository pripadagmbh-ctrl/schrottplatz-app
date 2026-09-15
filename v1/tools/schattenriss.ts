/**
 * Schattenriss eines Teilbaums in der z-y-Ebene, zeilenweise.
 *
 * Herausgeloest aus `tools/fuenfschalen/zahnknick.ts` am 15.09.2026, weil ein
 * ZWEITES Blatt (`zahn-vorher-nachher.ts`) denselben Riss braucht. Zwei Kopien
 * derselben Projektion waeren zwei Wahrheiten ueber dieselbe Form — und genau
 * an einer solchen Kopie ist an dieser Baugruppe schon einmal eine Messung
 * gescheitert.
 *
 * Das Verfahren: die senkrechte Projektion aller Dreiecke, je Zeile als
 * Vereinigung von Strecken. Es braucht keinen Tiefenpuffer und kann deshalb
 * nicht das, woran die Malerreihenfolge bei einer sich selbst ueberdeckenden
 * Schale scheitert — es zeigt genau die KONTUR, und um die geht es.
 *
 * Projiziert wird auf z-y und nicht auf x-y, weil die erste Schale des
 * Fuenfschalengreifers auf Umfangswinkel 0 liegt und ihr Radius dort in z
 * zeigt.
 */
import * as THREE from "three";

/** Ein Rechteck des Risses: z, y (Zeilenmitte), Breite, Zeilenhoehe — alles in m. */
export type Strecke = [number, number, number, number];

export function schattenriss(wurzel: THREE.Object3D, zeile = 0.004): Strecke[] {
  wurzel.updateMatrixWorld(true);
  const tris: number[][] = [];
  const v = new THREE.Vector3();
  wurzel.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const anz = idx ? idx.count : pos.count;
    for (let i = 0; i < anz; i += 3) {
      const e: number[] = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        e.push(v.z, v.y);
      }
      tris.push(e);
    }
  });
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const t of tris) for (const j of [1, 3, 5]) {
    yMin = Math.min(yMin, t[j]!);
    yMax = Math.max(yMax, t[j]!);
  }
  const raus: Strecke[] = [];
  for (let y = yMin; y < yMax; y += zeile) {
    const mitte = y + zeile / 2;
    const spannen: Array<[number, number]> = [];
    for (const t of tris) {
      const zs: number[] = [];
      for (let k = 0; k < 3; k++) {
        const az = t[k * 2]!;
        const ay = t[k * 2 + 1]!;
        const bz = t[((k + 1) % 3) * 2]!;
        const by = t[((k + 1) % 3) * 2 + 1]!;
        if (ay === by) continue;
        const u = (mitte - ay) / (by - ay);
        if (u < 0 || u > 1) continue;
        zs.push(az + (bz - az) * u);
      }
      if (zs.length < 2) continue;
      spannen.push([Math.min(...zs), Math.max(...zs)]);
    }
    if (!spannen.length) continue;
    spannen.sort((a, b) => a[0] - b[0]);
    let von = spannen[0]![0];
    let bis = spannen[0]![1];
    for (const s of spannen.slice(1)) {
      if (s[0] <= bis + 1e-4) bis = Math.max(bis, s[1]);
      else {
        raus.push([von, mitte, bis - von, zeile]);
        von = s[0];
        bis = s[1];
      }
    }
    raus.push([von, mitte, bis - von, zeile]);
  }
  return raus;
}

/**
 * Flaeche eines Schattenrisses (m²) — die Summe seiner Rechtecke.
 *
 * Damit laesst sich beziffern, wie GROSS ein Formunterschied wirklich ist:
 * Zwei Risse, ihre Flaechen und die Flaeche dessen, was nur in einem von
 * beiden liegt. Ein Blatt, das behauptet „da hat sich etwas getan", muss diese
 * Zahl aushalten.
 */
export function rissFlaeche(st: Strecke[]): number {
  let a = 0;
  for (const [, , b, h] of st) a += b * h;
  return a;
}

/**
 * Flaeche, die in genau EINEM der beiden Risse liegt (m²).
 *
 * Beide muessen mit derselben Zeilenhoehe und aus demselben Ursprung gerechnet
 * sein — sonst vergleicht man Raster statt Formen. Geprueft wird das hier
 * nicht; wer zwei verschiedene Zeilenhoehen hineingibt, bekommt Unsinn.
 */
/**
 * Zwei Risse in drei Teile zerlegen: nur A, nur B, beides.
 *
 * Damit laesst sich ein Vorher-Nachher-Bild zeichnen, das nicht taeuscht. Legt
 * man die beiden Risse einfach halbdurchsichtig uebereinander, deckt die
 * spaeter gezeichnete Form die fruehere zu und der Unterschied verschwindet —
 * genau das ist beim ersten Entwurf dieses Blattes passiert. Hier bekommt
 * jeder der drei Teile seine eigene Farbe, und was gemeinsam ist, tritt zurueck.
 */
export function rissTeilung(
  a: Strecke[],
  b: Strecke[]
): { nurA: Strecke[]; nurB: Strecke[]; beides: Strecke[] } {
  const zeilen = new Map<number, { a: Array<[number, number]>; b: Array<[number, number]> }>();
  const eintragen = (st: Strecke[], welche: "a" | "b"): void => {
    for (const [z, y, br, h] of st) {
      const k = Math.round(y / h);
      let e = zeilen.get(k);
      if (!e) zeilen.set(k, (e = { a: [], b: [] }));
      e[welche].push([z, z + br]);
    }
  };
  eintragen(a, "a");
  eintragen(b, "b");
  const hoehe = a.length ? a[0]![3] : b.length ? b[0]![3] : 0;
  const nurA: Strecke[] = [];
  const nurB: Strecke[] = [];
  const beides: Strecke[] = [];
  for (const [k, e] of zeilen) {
    const y = k * hoehe - hoehe / 2;
    const kanten: Array<[number, number, number]> = [];
    for (const [v, w] of e.a) kanten.push([v, 1, 0], [w, -1, 0]);
    for (const [v, w] of e.b) kanten.push([v, 0, 1], [w, 0, -1]);
    kanten.sort((x, y2) => x[0] - y2[0]);
    let na = 0;
    let nb = 0;
    let letzte = kanten.length ? kanten[0]![0] : 0;
    for (const [x, da, db] of kanten) {
      const br = x - letzte;
      if (br > 1e-9) {
        if (na > 0 && nb > 0) beides.push([letzte, y, br, hoehe]);
        else if (na > 0) nurA.push([letzte, y, br, hoehe]);
        else if (nb > 0) nurB.push([letzte, y, br, hoehe]);
      }
      na += da;
      nb += db;
      letzte = x;
    }
  }
  return { nurA, nurB, beides };
}

export function rissUnterschied(a: Strecke[], b: Strecke[]): number {
  const zeilen = new Map<number, { a: Array<[number, number]>; b: Array<[number, number]> }>();
  const eintragen = (st: Strecke[], welche: "a" | "b"): void => {
    for (const [z, y, br, h] of st) {
      const k = Math.round(y / h);
      let e = zeilen.get(k);
      if (!e) zeilen.set(k, (e = { a: [], b: [] }));
      e[welche].push([z, z + br]);
    }
  };
  eintragen(a, "a");
  eintragen(b, "b");
  const hoehe = a.length ? a[0]![3] : 0;
  let flaeche = 0;
  for (const e of zeilen.values()) {
    /* Laenge der symmetrischen Differenz zweier Streckenmengen auf einer Zeile. */
    const kanten: Array<[number, number, number]> = [];
    for (const [v, w] of e.a) kanten.push([v, 1, 0], [w, -1, 0]);
    for (const [v, w] of e.b) kanten.push([v, 0, 1], [w, 0, -1]);
    kanten.sort((x, y) => x[0] - y[0]);
    let na = 0;
    let nb = 0;
    let letzte = kanten.length ? kanten[0]![0] : 0;
    for (const [x, da, db] of kanten) {
      if ((na > 0) !== (nb > 0)) flaeche += (x - letzte) * hoehe;
      na += da;
      nb += db;
      letzte = x;
    }
  }
  return flaeche;
}
