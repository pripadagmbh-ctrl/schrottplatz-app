/**
 * Die Netze des Fünfschalengreifers zusammenlegen — ein Netz je Starrkörper
 * und Werkstoff.
 *
 * WARUM. Gemessen auf Patricks Gerät (14.09.2026: 48 Bilder, 21,0 ms je Bild,
 * 1322 Zeichenrufe, 240k Dreiecke): Dreiecke sind fast gratis, NETZE sind der
 * Engpass — jedes schattenwerfende Netz wird zweimal gezeichnet. Der Bagger
 * ist deshalb nach dieser Regel gebaut (E-025, umgesetzt in E-036: 137 → 57
 * Netze). Der Fünfschalengreifer stand vor diesem Paket bei 217 Netzen gegen
 * 105 der Sichelkralle; angehängt wäre der Bagger von 169 auf 281 Netze
 * gesprungen.
 *
 * WAS HIER PASSIERT — UND WAS AUSDRÜCKLICH NICHT.
 *
 * Es wird KEINE Form geändert. Diese Datei baut nichts; sie nimmt die fertig
 * gebauten Netze, rechnet jedes in den Frame seines Starrkörpers um und legt
 * sie dort je Werkstoff zu einem einzigen Netz zusammen. Punkt für Punkt
 * dieselben Eckpunkte, dieselben Dreiecke, dieselbe Reihenfolge innerhalb
 * jedes Teils. Der Wächter `test/verschmelzen.test.ts` vergleicht beide
 * Fassungen Eckpunkt für Eckpunkt.
 *
 * Zwei Dinge werden deshalb bewusst NICHT getan:
 *
 *   * **Keine Normalen neu rechnen.** `bauteile.verschmelze` des Baggers ruft
 *     `computeVertexNormals()` auf dem Ergebnis. Das wäre hier ein Fehler: Die
 *     Schalenhaut, der Zinken und der Zahn tragen ihre eigenen, beim Bau
 *     gerechneten Normalen. Wer sie über Teilgrenzen hinweg neu mittelt,
 *     ändert die Schattierung — und damit das Aussehen.
 *   * **Keine Werkstoffe zusammenlegen.** Der Bagger legt beim Fahrer fünf
 *     Farben über Eckfarben in EIN Netz. Das geht dort, weil alle fünf
 *     dieselbe Rauheit haben. Hier haben die sechs Werkstoffe verschiedene
 *     Rauheit und Metallanteil (Kolbenstange 0,16/0,90 gegen Schweissnaht
 *     0,72/0,55) — ein gemeinsames Netz müsste sich für einen Wert
 *     entscheiden, und die Kolbenstange sähe nicht mehr verchromt aus. Das
 *     wäre sichtbar, und sichtbar darf dieses Paket nicht sein.
 *
 * ERST SAMMELN, DANN ANWENDEN. Die Netze werden vollständig eingesammelt und
 * erst danach aus dem Baum genommen — dieselbe Regel wie bei den
 * Rapier-Abfragen (v2 E-044). Wer beim Durchlaufen aus demselben Baum
 * entfernt, überspringt Geschwister.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Ein Starrkörper: alles, was sich nicht gegeneinander bewegt.
 *
 * `quellen` müssen im selben starren Frame liegen wie `ziel` — dazwischen darf
 * kein Knoten stehen, der sich bewegt. Sonst friert das Zusammenlegen eine
 * Stellung ein.
 */
export interface Starrkoerper {
  /** Knoten, in dessen Frame die zusammengelegten Netze landen. */
  ziel: THREE.Object3D;
  /** Teilbäume, deren Netze zu diesem Starrkörper gehören. */
  quellen: THREE.Object3D[];
  /** Namensstamm der entstehenden Netze: `<marke>_<WERKSTOFF>`. */
  marke: string;
}

/** Die Attribute, die jedes Netz dieses Greifers trägt. */
const KANON = ["position", "normal", "uv"] as const;

/** Oberster Knoten über `o` — dort muss die Weltmatrix gerechnet werden. */
function oberste(o: THREE.Object3D): THREE.Object3D {
  let p = o;
  while (p.parent) p = p.parent;
  return p;
}

/**
 * Die Form eines Netzes, umgerechnet in den Frame des Starrkörpers.
 *
 * `applyMatrix4` dreht die Normalen mit (Normalenmatrix), und weil alle
 * Matrizen hier starr sind — Drehung und Verschiebung, keine Skalierung —,
 * bleiben sie Einheitsvektoren. Eine gespiegelte Matrix würde die Wicklung
 * umdrehen und das Teil von innen zeigen; sie kommt hier nicht vor, und wenn
 * sie je vorkäme, soll das auffallen statt stillschweigend zu wirken.
 */
function formIm(m: THREE.Mesh, rel: THREE.Matrix4): THREE.BufferGeometry {
  const q = m.geometry;
  for (const a of KANON) {
    if (!q.getAttribute(a)) {
      throw new Error(`Verschmelzen: ${m.name || "Netz ohne Namen"} hat kein Attribut "${a}"`);
    }
  }
  const idx = q.getIndex();
  if (!idx) throw new Error(`Verschmelzen: ${m.name || "Netz ohne Namen"} hat keinen Index`);
  if (rel.determinant() <= 0) {
    throw new Error(`Verschmelzen: ${m.name} sitzt gespiegelt — die Wicklung würde kippen`);
  }
  const g = new THREE.BufferGeometry();
  for (const a of KANON) g.setAttribute(a, q.getAttribute(a).clone());
  g.setIndex(idx.clone());
  g.applyMatrix4(rel);
  return g;
}

/** Werkstoffname zu Netzname: `Hardox_Blech` → `HARDOX_BLECH`. */
function werkstoffmarke(mat: THREE.Material): string {
  return (mat.name || "STOFF").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

/**
 * Einen Starrkörper zusammenlegen. Gibt die entstandenen Netze zurück.
 *
 * Die alten Netze werden aus dem Baum genommen; die Gruppen, in denen sie
 * standen, bleiben stehen. Das ist Absicht: `09_STEMPEL`, `02_ROTATOR` und
 * `03_DREHWERKSGEHAEUSE` sind die Knoten der Stückliste und der
 * `Greifer`-Schnittstelle. Eine leere Gruppe kostet keinen Zeichenruf.
 */
export function verschmilzKoerper(k: Starrkoerper): THREE.Mesh[] {
  oberste(k.ziel).updateMatrixWorld(true);
  const invZiel = new THREE.Matrix4().copy(k.ziel.matrixWorld).invert();

  /* --- sammeln --- */
  const nachStoff = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const alt: THREE.Mesh[] = [];
  for (const q of k.quellen) {
    q.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const rel = new THREE.Matrix4().multiplyMatrices(invZiel, m.matrixWorld);
      const stoff = m.material as THREE.Material;
      const liste = nachStoff.get(stoff);
      const form = formIm(m, rel);
      if (liste) liste.push(form);
      else nachStoff.set(stoff, [form]);
      alt.push(m);
    });
  }

  /* --- dann anwenden --- */
  for (const m of alt) m.removeFromParent();
  const neu: THREE.Mesh[] = [];
  for (const [stoff, formen] of nachStoff) {
    const g = formen.length === 1 ? formen[0]! : mergeGeometries(formen, false);
    if (!g) throw new Error(`Verschmelzen: ${k.marke}/${stoff.name} liess sich nicht zusammenlegen`);
    const netz = new THREE.Mesh(g, stoff);
    netz.name = `${k.marke}_${werkstoffmarke(stoff)}`;
    k.ziel.add(netz);
    neu.push(netz);
  }
  return neu;
}

/** Mehrere Starrkörper zusammenlegen; gibt die Zahl der entstandenen Netze. */
export function verschmilz(koerper: Starrkoerper[]): number {
  let n = 0;
  for (const k of koerper) n += verschmilzKoerper(k).length;
  return n;
}
