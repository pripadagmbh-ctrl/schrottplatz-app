/**
 * WIE TIEF STECKEN ZWEI BAUTEILE INEINANDER — in Metern, nicht in „sieht man".
 *
 * Hier liegt die Rechnung, die sowohl das Werkzeug
 * `tools/fahrzeug-durchdringung.ts` als auch der Wächter
 * `test/fahrzeugdurchdringung.test.ts` benutzen. EINE Quelle, aus demselben
 * Grund wie bei `tools/radraum.ts`: Ein Wächter, der seine eigene Messung
 * mitbringt, prüft am Ende die Messung und nicht die Maschine.
 *
 * DAS VERFAHREN ist der Trennachsensatz (SAT) über konvexe Körper, also
 * dasselbe, was `umriss.ts` im Grundriss über vier Achsen tut — nur im Raum
 * und mit der ECHTEN Netzgeometrie statt einem Ersatzkasten:
 *
 *   1. Jedes Netz wird einmal zerlegt in: seine Eckpunkte (entdoppelt), die
 *      Normalen seiner Dreiecke und die Richtungen seiner Kanten. Alles in
 *      Teilkoordinaten, alles nur EINMAL — beim Abtasten einer Bewegung
 *      werden nur noch Matrizen angewandt.
 *   2. Für ein Paar wird geprüft: Gibt es eine Achse, auf der sich die
 *      Schatten der beiden Körper NICHT überlappen? Dann berühren sie sich
 *      nicht. Für konvexe Vielflächner reicht dafür ein endlicher Satz:
 *      die Flächennormalen beider plus die Kreuzprodukte aller Kantenpaare.
 *   3. Gibt es keine solche Achse, ist die kleinste Überlappung über alle
 *      Achsen genau die Strecke, um die man das eine Teil verschieben müsste,
 *      damit sie sich gerade nicht mehr berühren. Das ist die Zahl, die
 *      gemeldet wird.
 *
 * WAS DIE ZAHL NICHT IST. Für Zylinder und Kugeln ist das Netz ein Vieleck,
 * das INNEN liegt (ein Achtkant ist kleiner als sein Kreis). Bei runden
 * Teilen misst das Verfahren deshalb bis zu 8 % zu WENIG — es meldet im
 * Zweifel zu spät, nie zu früh. Für Quader, und das sind bei den LKW fast
 * alle tragenden Teile, ist die Zahl exakt.
 */
import * as THREE from "three";

/** Ein Netz, für die Trennachsenrechnung vorbereitet. */
export interface Pruefteil {
  /** Baugruppe, zu der das Teil gehört (`rahmen`, `flaeche`, `kransaeule`, …) */
  gruppe: string;
  /** Name für die Meldung — Baugruppe und laufende Nummer */
  name: string;
  /** Das Objekt selbst; seine `matrixWorld` liefert die jeweilige Lage */
  objekt: THREE.Object3D;
  /** Eckpunkte in Teilkoordinaten, entdoppelt */
  ecken: THREE.Vector3[];
  /** Dreiecke als Indexdreier in `ecken` — für Normalen und Kanten je Lage */
  dreiecke: Array<[number, number, number]>;
  /** Ist die Form gerundet? Dann misst das Vieleck etwas zu wenig. */
  gerundet: boolean;
}

/** Eine Lage: Weltpunkte, Weltachsen und die achsparallele Hülle dazu. */
export interface Lage {
  punkte: THREE.Vector3[];
  achsen: THREE.Vector3[];
  kanten: THREE.Vector3[];
  huelle: THREE.Box3;
}

/** Zwei Richtungen gelten als dieselbe Achse, wenn sie so nah beieinander liegen. */
const ACHS_TOLERANZ = 1e-6;

/**
 * Ab wann eine Überschneidung als Durchdringung gilt (m).
 *
 * Nicht null, und das hat einen gemessenen Grund: Heckklappe und Muldenboden
 * stossen an derselben Kante aneinander (lokal z = 0). Die Kette aus
 * Gruppenmatrizen trifft diese Null nicht auf die letzte Stelle genau, und
 * ohne Schranke meldet der Wächter dort ewig „0,0 cm".
 *
 * Ein Millimeter ist zugleich weit unter allem, was man sehen kann: Das
 * dünnste Blech am LKW ist die Türfuge mit 2 cm, das dünnste TRAGENDE Teil
 * das Bodenblech mit 12 cm.
 */
export const BLECH_TOLERANZ = 0.001;

function fuegeAchse(liste: THREE.Vector3[], v: THREE.Vector3): void {
  const len = v.length();
  if (len < 1e-7) return;
  v.divideScalar(len);
  for (const a of liste) {
    // Gegenrichtung ist dieselbe Trennachse
    if (Math.abs(Math.abs(a.dot(v)) - 1) < ACHS_TOLERANZ) return;
  }
  liste.push(v);
}

/**
 * Ein Netz zerlegen. Eckpunkte werden auf 0,1 mm gerundet entdoppelt — drei
 * Wände eines Quaders teilen sich dieselbe Ecke, three legt sie dreimal ab.
 */
export function zerlegeNetz(
  mesh: THREE.Mesh,
  gruppe: string,
  name: string
): Pruefteil | null {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return null;
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const ecken: THREE.Vector3[] = [];
  const schluessel = new Map<string, number>();
  const nimm = (j: number): number => {
    const v = new THREE.Vector3().fromBufferAttribute(pos, j);
    const k = `${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`;
    const da = schluessel.get(k);
    if (da !== undefined) return da;
    schluessel.set(k, ecken.length);
    ecken.push(v);
    return ecken.length - 1;
  };
  const dreiecke: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i += 3) {
    const a = nimm(idx ? idx.getX(i) : i);
    const b = nimm(idx ? idx.getX(i + 1) : i + 1);
    const c = nimm(idx ? idx.getX(i + 2) : i + 2);
    if (a !== b && b !== c && a !== c) dreiecke.push([a, b, c]);
  }
  if (ecken.length < 4 || dreiecke.length === 0) return null;
  const typ = (geo as { type?: string }).type ?? "";
  return {
    gruppe,
    name,
    objekt: mesh,
    ecken,
    dreiecke,
    gerundet: /Cylinder|Sphere|Capsule|Torus|Lathe/.test(typ),
  };
}

/**
 * Die aktuelle Lage eines Teils: Punkte, Flächennormalen und Kantenrichtungen
 * in Weltkoordinaten. Normalen werden aus den WELTPUNKTEN gerechnet und nicht
 * aus der Normalmatrix — ein Teil mit ungleichmäßiger Skalierung (die
 * Fahrermütze ist eine gestauchte Kugel) hätte sonst schiefe Achsen.
 */
export function lageVon(teil: Pruefteil): Lage {
  const m = teil.objekt.matrixWorld;
  const punkte = teil.ecken.map((v) => v.clone().applyMatrix4(m));
  const achsen: THREE.Vector3[] = [];
  const kanten: THREE.Vector3[] = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (const [ia, ib, ic] of teil.dreiecke) {
    const a = punkte[ia]!;
    const b = punkte[ib]!;
    const c = punkte[ic]!;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    fuegeAchse(achsen, new THREE.Vector3().crossVectors(ab, ac));
    fuegeAchse(kanten, ab.clone());
    fuegeAchse(kanten, ac.clone());
    fuegeAchse(kanten, new THREE.Vector3().subVectors(c, b));
  }
  const huelle = new THREE.Box3().setFromPoints(punkte);
  return { punkte, achsen, kanten, huelle };
}

function schatten(punkte: THREE.Vector3[], achse: THREE.Vector3): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of punkte) {
    const d = p.dot(achse);
    if (d < lo) lo = d;
    if (d > hi) hi = d;
  }
  return [lo, hi];
}

/**
 * Wie tief zwei Teile ineinanderstecken (m); 0 = sie berühren sich nicht.
 *
 * Die Hüllenprüfung vorweg ist nicht Zierde, sondern der Grund, warum das
 * Abtasten einer ganzen Kippbewegung über alle Paare in Sekunden läuft: Von
 * rund 5.000 Paaren je Lage bleiben nach ihr ein paar Dutzend übrig.
 */
export function durchdringung(a: Lage, b: Lage): number {
  if (!a.huelle.intersectsBox(b.huelle)) return 0;
  let kleinste = Infinity;
  const pruefe = (achse: THREE.Vector3): boolean => {
    const [alo, ahi] = schatten(a.punkte, achse);
    const [blo, bhi] = schatten(b.punkte, achse);
    const ueb = Math.min(ahi, bhi) - Math.max(alo, blo);
    if (ueb <= 0) return false;
    if (ueb < kleinste) kleinste = ueb;
    return true;
  };
  for (const achse of a.achsen) if (!pruefe(achse)) return 0;
  for (const achse of b.achsen) if (!pruefe(achse)) return 0;
  const kreuz = new THREE.Vector3();
  for (const ka of a.kanten) {
    for (const kb of b.kanten) {
      kreuz.crossVectors(ka, kb);
      const len = kreuz.length();
      // Parallele Kanten liefern keine eigene Achse
      if (len < 1e-6) continue;
      if (!pruefe(kreuz.clone().divideScalar(len))) return 0;
    }
  }
  return kleinste === Infinity ? 0 : kleinste;
}

/**
 * Alle Teile unter einer Wurzel einsammeln, jedes mit seiner Baugruppe.
 *
 * Die Baugruppe steht am Netz oder an einem seiner Väter (`object.name`) —
 * so gehören Bordwand, Verriegelungsbügel und Rungen automatisch zu
 * „bordwand", ohne dass jedes Blech einzeln beschriftet werden müsste.
 * Was keinen benannten Vater hat, ist Zierrat und bekommt die Gruppe `""`.
 */
export function sammleTeile(wurzel: THREE.Object3D, bekannt: ReadonlySet<string>): Pruefteil[] {
  const out: Pruefteil[] = [];
  const zaehler = new Map<string, number>();
  wurzel.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let gruppe = "";
    for (let p: THREE.Object3D | null = o; p; p = p.parent) {
      if (p.name && bekannt.has(p.name)) {
        gruppe = p.name;
        break;
      }
    }
    if (!gruppe) return;
    const nr = (zaehler.get(gruppe) ?? 0) + 1;
    zaehler.set(gruppe, nr);
    const teil = zerlegeNetz(o as THREE.Mesh, gruppe, `${gruppe}#${nr}`);
    if (teil) out.push(teil);
  });
  return out;
}

/** Ein Befund: welche beiden Teile, wie tief, in welcher Stellung. */
export interface Befund {
  a: string;
  b: string;
  gruppeA: string;
  gruppeB: string;
  tiefe: number;
  stellung: string;
  gerundet: boolean;
}

/**
 * Alle Paare einer Stellung messen; `erlaubt` entscheidet, welche Paare
 * überhaupt gemeldet werden.
 */
export function messeStellung(
  teile: Pruefteil[],
  stellung: string,
  interessant: (a: Pruefteil, b: Pruefteil) => boolean
): Befund[] {
  const lagen = teile.map((t) => lageVon(t));
  const out: Befund[] = [];
  for (let i = 0; i < teile.length; i++) {
    for (let j = i + 1; j < teile.length; j++) {
      const ta = teile[i]!;
      const tb = teile[j]!;
      if (!interessant(ta, tb)) continue;
      const tiefe = durchdringung(lagen[i]!, lagen[j]!);
      if (tiefe > BLECH_TOLERANZ) {
        out.push({
          a: ta.name,
          b: tb.name,
          gruppeA: ta.gruppe,
          gruppeB: tb.gruppe,
          tiefe,
          stellung,
          gerundet: ta.gerundet || tb.gerundet,
        });
      }
    }
  }
  return out;
}
