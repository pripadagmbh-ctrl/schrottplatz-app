/**
 * Der Raum, den ein Rad überstreicht — und wie weit ein Bauteil davon weg ist.
 *
 * Hier liegt die Rechnung, die sowohl das Werkzeug `tools/pratzenfreigang.ts`
 * als auch der Wächter `test/fahrwerk.test.ts` benutzen. EINE Quelle: Ein
 * Wächter, der seine eigene Messung mitbringt, prüft am Ende die Messung und
 * nicht die Maschine.
 *
 * ZWEI GEDANKEN STECKEN DARIN, und beide sind der Grund, warum man das nicht
 * mit zwei Zahlen erschlägt:
 *
 * 1. DAS RAD IST KEIN ZYLINDER. Über die Stollen gemessen hat es 0,62 m
 *    Halbmesser, an der Flanke 0,594, am Felgenhorn nur 0,42 — und genau
 *    dort, an der Flanke, liegt die Ecke des Tellerfußes. Wer mit dem
 *    Zylinder rechnet, misst eine Durchdringung, die es nicht gibt.
 *    Deshalb wird das Profil aus den ECHTEN Netzpunkten gelesen: für jede
 *    Stelle der Radachse der grösste vorkommende Halbmesser. Weil sich das
 *    Rad dreht, ist dieser Drehkörper genau der Raum, den es beansprucht.
 *
 * 2. DER FUSS FÄHRT AUS. Er bewegt sich dabei nur in der Höhe. Ein Prüfpunkt
 *    ist deshalb keine Stelle, sondern eine senkrechte STRECKE — und für die
 *    lässt sich der engste Punkt geschlossen ausrechnen, statt den
 *    Ausfahrgrad in Stufen abzutasten.
 */
import * as THREE from "three";

export type Dreieck = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

/** Dreiecke einer nackten Geometrie. */
export function dreieckeGeo(geo: THREE.BufferGeometry): Dreieck[] {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const idx = geo.getIndex();
  const n = idx ? idx.count : pos.count;
  const out: Dreieck[] = [];
  for (let i = 0; i < n; i += 3) {
    out.push(
      [0, 1, 2].map((k) => {
        const j = idx ? idx.getX(i + k) : i + k;
        return new THREE.Vector3().fromBufferAttribute(pos, j);
      }) as Dreieck
    );
  }
  return out;
}

/** Ein Dreieck in Punkte zerlegen, bis kein Gitterschritt grösser als `fein` ist. */
export function punkte(tris: Dreieck[], fein = 0.02): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const [a, b, c] of tris) {
    const n = Math.max(
      1,
      Math.ceil(Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) / fein)
    );
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        out.push(
          new THREE.Vector3()
            .addScaledVector(a, 1 - i / n - j / n)
            .addScaledVector(b, i / n)
            .addScaledVector(c, j / n)
        );
      }
    }
  }
  return out;
}

/** Feinheit der Achsfächer des Radprofils (m). */
export const FACH = 0.005;

export interface Radprofil {
  /** Achslage des ersten Fachs (m). */
  b0: number;
  /** Grösster Halbmesser je Fach (m). */
  faecher: number[];
}

/**
 * Das Profil des überstrichenen Raums eines Rades, gelesen aus seinen Netzen.
 *
 * ABGETASTET, NICHT NUR DIE ECKEN: Der Reifen hat zwischen Flanke und
 * Felgenhorn nur ZWEI Netzpunkte, dazwischen liegt eine schräge Fläche. Wer
 * nur Eckpunkte einsortiert, bekommt leere Fächer und misst durch den Reifen
 * hindurch.
 *
 * @param rad die Radgruppe (`02_RAD_VL`); gelesen wird die rohe Geometrie, in
 *        der die Radachse in Y liegt — die Drehung der Gruppe spielt keine
 *        Rolle, weil ein Drehkörper herauskommt.
 */
export function radProfil(rad: THREE.Object3D): Radprofil {
  const tris: Dreieck[] = [];
  rad.traverse((k) => {
    const m = k as THREE.Mesh;
    if (!m.isMesh) return;
    tris.push(...dreieckeGeo(m.geometry as THREE.BufferGeometry));
  });
  const ps = punkte(tris, 0.004);
  let bMax = 0;
  for (const p of ps) bMax = Math.max(bMax, Math.abs(p.y));
  const n = Math.ceil((2 * bMax) / FACH) + 1;
  const faecher = new Array<number>(n).fill(0);
  for (const p of ps) {
    const r = Math.hypot(p.x, p.z);
    const i = Math.min(n - 1, Math.max(0, Math.floor((p.y + bMax) / FACH)));
    if (r > faecher[i]!) faecher[i] = r;
  }
  // Löcher schliessen: eher zu viel Rad annehmen als zu wenig
  for (let i = 1; i < n - 1; i++) {
    if (faecher[i]! > 0) continue;
    let l = i - 1;
    while (l >= 0 && faecher[l]! === 0) l--;
    let r = i + 1;
    while (r < n && faecher[r]! === 0) r++;
    if (l >= 0 && r < n) faecher[i] = Math.max(faecher[l]!, faecher[r]!);
  }
  return { b0: -bMax, faecher };
}

/**
 * Abstand eines Punktes (Achslage `b`, Halbmesser `r`) zum Drehkörper.
 * Negativ = innen; der Betrag ist dann die Tiefe, um die er heraus müsste.
 */
export function profilAbstand(profil: Radprofil, b: number, r: number): number {
  const { b0, faecher } = profil;
  const n = faecher.length;
  const mitte = Math.floor((b - b0) / FACH);
  let best = Infinity;
  let drin = false;
  // Von der eigenen Achslage aus nach aussen suchen und früh abbrechen
  for (let d = 0; d <= n; d++) {
    let fertig = true;
    for (const i of d === 0 ? [mitte] : [mitte - d, mitte + d]) {
      if (i < 0 || i >= n) continue;
      fertig = false;
      const R = faecher[i]!;
      if (R <= 0) continue;
      const u0 = b0 + i * FACH;
      const u1 = u0 + FACH;
      if (b >= u0 && b <= u1 && r <= R) drin = true;
      const db = b < u0 ? u0 - b : b > u1 ? b - u1 : 0;
      const dr = r > R ? r - R : 0;
      const e = Math.sqrt(db * db + dr * dr);
      if (e < best) best = e;
    }
    if (fertig) break;
    if ((d - 1) * FACH > best) break;
  }
  if (!drin) return best;
  const R0 = faecher[Math.min(n - 1, Math.max(0, mitte))]!;
  let tiefe = R0 - r;
  for (let i = mitte; i < n; i++) {
    if (faecher[i]! >= r) continue;
    tiefe = Math.min(tiefe, b0 + i * FACH - b);
    break;
  }
  for (let i = mitte; i >= 0; i--) {
    if (faecher[i]! >= r) continue;
    tiefe = Math.min(tiefe, b - (b0 + (i + 1) * FACH));
    break;
  }
  return -Math.max(0, tiefe);
}

/** Ein Prüfpunkt, der eine senkrechte Strecke sein darf (ausfahrender Fuß). */
export interface Strecke {
  x: number;
  z: number;
  yLo: number;
  yHi: number;
}

/** Die vier Radmitten des Baggers — aus `RAD_ECKEN` in `excavator.ts`. */
export const RAD_MITTEN: ReadonlyArray<{
  x: number;
  z: number;
  vorn: boolean;
  links: boolean;
  name: string;
}> = [
  { x: -1.25, z: 1.5, vorn: true, links: false, name: "VR" },
  { x: 1.25, z: 1.5, vorn: true, links: true, name: "VL" },
  { x: -1.25, z: -1.5, vorn: false, links: false, name: "HR" },
  { x: 1.25, z: -1.5, vorn: false, links: true, name: "HL" },
];

/** Höhe der Radmitte über dem Boden (m) = Radhalbmesser. */
export const RAD_Y = 0.62;
/** Grösster Lenkeinschlag (rad) — gerechnet wie `LENK_MAX` in `excavator.ts`. */
export const LENK_MAX = Math.atan(3.0 / (3.2 / 0.7));

/**
 * Kleinster Abstand einer Streckenwolke zum überstrichenen Raum EINES Rades
 * bei gegebenem Lenkeinschlag.
 */
export function radAbstand(
  st: readonly Strecke[],
  profil: Radprofil,
  rad: { x: number; z: number; links: boolean },
  lenk: number
): { abstand: number; stelle: THREE.Vector3 } {
  const c = Math.cos(-lenk);
  const s = Math.sin(-lenk);
  let best = Infinity;
  let stelle = new THREE.Vector3();
  for (const p of st) {
    const dx = p.x - rad.x;
    const dz = p.z - rad.z;
    const ux = dx * c + dz * s;
    const uz = -dx * s + dz * c;
    const b = rad.links ? -ux : ux;
    if (Math.abs(b) - 0.3 > best) continue;
    // die Höhe auf der Strecke, die der Radmitte am nächsten kommt
    const y = Math.min(Math.max(RAD_Y, p.yLo), p.yHi);
    const d = profilAbstand(profil, b, Math.hypot(y - RAD_Y, uz));
    if (d < best) {
      best = d;
      stelle = new THREE.Vector3(p.x, y, p.z);
    }
  }
  return { abstand: best, stelle };
}

/**
 * Kleinster Abstand zu ALLEN vier Rädern über ALLE Lenkstellungen.
 *
 * Die Vorderräder schlagen bis ±33,3° ein, die hinteren gar nicht. Abgetastet
 * wird in `lenkSchritte` Stufen von Anschlag zu Anschlag.
 */
export function kleinsterRadfreigang(
  st: readonly Strecke[],
  profil: Radprofil,
  lenkSchritte = 135
): { abstand: number; wo: string } {
  let best = Infinity;
  let wo = "";
  for (let j = 0; j < lenkSchritte; j++) {
    const lenk = -LENK_MAX + (2 * LENK_MAX * j) / (lenkSchritte - 1);
    for (const rad of RAD_MITTEN) {
      if (!rad.vorn && j > 0) continue;
      const l = rad.vorn ? lenk : 0;
      const nah = st.filter((p) => Math.hypot(p.x - rad.x, p.z - rad.z) < 1.7);
      if (nah.length === 0) continue;
      const r = radAbstand(nah, profil, rad, l);
      if (r.abstand < best) {
        best = r.abstand;
        wo =
          `Rad ${rad.name}, Einschlag ${((l * 180) / Math.PI).toFixed(1)}°, ` +
          `engste Stelle x ${r.stelle.x.toFixed(2)} y ${r.stelle.y.toFixed(2)} z ${r.stelle.z.toFixed(2)}`;
      }
    }
  }
  return { abstand: best, wo };
}

/**
 * Die Prüfstrecken der vier Pratzenfüße für eine Lage — der ganze Ausfahrweg.
 *
 * @param fussPunkte Punktwolke EINES Fußes in Fußkoordinaten
 * @param hub Ausfahrweg des Fußes (m), `syncMeshes` in `excavator.ts`
 */
export function fussStrecken(
  lage: { x: number; z: number },
  fussPunkte: readonly THREE.Vector3[],
  hub: number
): Strecke[] {
  const out: Strecke[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const p of fussPunkte) {
        out.push({ x: sx * lage.x + p.x, z: sz * lage.z + p.z, yLo: p.y, yHi: p.y + hub });
      }
    }
  }
  return out;
}

/** Feste Punkte als Strecken der Länge null (Ausleger, Kragarm, Stiel). */
export function festeStrecken(tris: Dreieck[], fein = 0.02): Strecke[] {
  return punkte(tris, fein).map((p) => ({ x: p.x, z: p.z, yLo: p.y, yHi: p.y }));
}
