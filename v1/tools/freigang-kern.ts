/**
 * Freigang auf DREIECKSEBENE — der Rechenkern.
 *
 * Warum es diese Datei gibt: `tools/greifer-kippen.ts` hat die Kollisionsfrage
 * mit KAESTEN beantwortet und ist daran gescheitert (E-065). Der Kasten um ein
 * verschmolzenes Netz ist groesser als das Netz; die Nullgrad-Zeile — dort
 * haengt der Greifer nachweislich frei — meldete **−0,071 m**. Absolute Zahlen
 * waren damit unbrauchbar.
 *
 * Hier wird gegen die gezeichneten DREIECKE gemessen, wie es E-050 beim
 * Auslegerbock getan hat (594 Armstellungen, 432.824 Punkte, kleinster
 * Freigang 0,027 m). Das Verfahren ist dasselbe:
 *
 *   - Die eine Seite (hier: der Greifer) wird im Raster abgetastet.
 *   - Die andere Seite (hier: der Arm) bleibt EXAKT — Dreieckssuppe, kein
 *     Kasten, keine Huelle.
 *   - Gemessen wird der Abstand Punkt → naechstes Dreieck.
 *
 * ## WARUM DAS EINE OBERE SCHRANKE IST, UND WIE GROSS IHR FEHLER IST
 *
 * Jedes Greiferdreieck wird so lange an seiner laengsten Kante geteilt, bis
 * alle Kanten <= `h` sind. Von jedem Teildreieck werden die Eckpunkte genommen.
 * Fuer ein Dreieck mit laengster Kante `h` liegt JEDER seiner Punkte hoechstens
 * `h/sqrt(3)` von einer seiner Ecken entfernt (spitzwinklig: Umkreisradius,
 * hoechstens h/sqrt(3); stumpfwinklig: der Umkreismittelpunkt liegt draussen,
 * der weiteste Punkt ist die Mitte der laengsten Kante, h/2). Also:
 *
 *     EPS = h / sqrt(3)
 *     wahrer Abstand >= gemessener Abstand − EPS
 *     wahrer Abstand <= gemessener Abstand
 *
 * Und — das ist der Punkt, der die Messung ENTSCHEIDBAR macht: Durchdringen
 * sich zwei Koerper, so schneiden sich ihre OBERFLAECHEN; auf der Schnittkurve
 * ist der Abstand der Greiferoberflaeche zur Armoberflaeche null. Ein
 * gemessener Abstand > EPS schliesst Durchdringung also aus. Der
 * Punkt-Abstand kann nie negativ werden, aber er muss es auch nicht:
 *
 *     gemessen > EPS  ⟹  beruehrungsfrei, Freigang mindestens (gemessen − EPS)
 *     gemessen <= EPS ⟹  Beruehrung moeglich, im Zweifel Beruehrung
 *
 * (Die eine Luecke in diesem Schluss: ein Armnetz, das VOLLSTAENDIG im Greifer
 * steckt, ohne dass sich die Oberflaechen schneiden. Der Greifer ist offen und
 * der Arm ist ein durchgehender Traeger — das kann nicht vorkommen.)
 */
import * as THREE from "three";

/** Ein Dreieck als neun Zahlen, so wie es im Raster liegt. */
export interface Suppe {
  /** 9 Zahlen je Dreieck: ax ay az bx by bz cx cy cz */
  tri: Float64Array;
  /** Zu welchem Netz das Dreieck `i` gehoert. */
  netz: Int32Array;
  /** Namen der Netze, Index wie in `netz`. */
  namen: string[];
}

/** Alle Dreiecke unter `wurzel`, in Weltkoordinaten. `nimm` filtert die Netze. */
export function dreieckssuppe(
  wurzel: THREE.Object3D,
  nimm: (m: THREE.Mesh) => boolean
): Suppe {
  wurzel.updateWorldMatrix(true, true);
  const tri: number[] = [];
  const netz: number[] = [];
  const namen: string[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  wurzel.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // Unsichtbares zaehlt nicht — auch nicht ueber einen unsichtbaren Vater.
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) return;
    if (!nimm(m)) return;
    const idx = namen.length;
    namen.push(m.name || m.parent?.name || "?");
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const ix = m.geometry.index;
    const n = ix ? ix.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = ix ? ix.getX(i) : i;
      const i1 = ix ? ix.getX(i + 1) : i + 1;
      const i2 = ix ? ix.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      netz.push(idx);
    }
  });
  return { tri: new Float64Array(tri), netz: new Int32Array(netz), namen };
}

/** Dieselbe Suppe, aber in einem gewaehlten Frame (Matrix = Inverse davon). */
export function suppeUmrechnen(s: Suppe, inv: THREE.Matrix4): Suppe {
  const p = new THREE.Vector3();
  const t = new Float64Array(s.tri.length);
  for (let i = 0; i < s.tri.length; i += 3) {
    p.set(s.tri[i], s.tri[i + 1], s.tri[i + 2]).applyMatrix4(inv);
    t[i] = p.x;
    t[i + 1] = p.y;
    t[i + 2] = p.z;
  }
  return { tri: t, netz: s.netz, namen: s.namen };
}

/* --------------------------------------------------------- Abtastung */

/**
 * Ein Dreieck an der laengsten Kante teilen, bis alle Kanten <= `h` sind,
 * und die Eckpunkte einsammeln.
 */
function teilen(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  h2: number,
  raus: number[]
): void {
  const ab = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
  const bc = (bx - cx) ** 2 + (by - cy) ** 2 + (bz - cz) ** 2;
  const ca = (cx - ax) ** 2 + (cy - ay) ** 2 + (cz - az) ** 2;
  const max = Math.max(ab, bc, ca);
  if (max <= h2) {
    raus.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    return;
  }
  if (max === ab) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    teilen(ax, ay, az, mx, my, mz, cx, cy, cz, h2, raus);
    teilen(mx, my, mz, bx, by, bz, cx, cy, cz, h2, raus);
  } else if (max === bc) {
    const mx = (bx + cx) / 2, my = (by + cy) / 2, mz = (bz + cz) / 2;
    teilen(ax, ay, az, bx, by, bz, mx, my, mz, h2, raus);
    teilen(ax, ay, az, mx, my, mz, cx, cy, cz, h2, raus);
  } else {
    const mx = (cx + ax) / 2, my = (cy + ay) / 2, mz = (cz + az) / 2;
    teilen(ax, ay, az, bx, by, bz, mx, my, mz, h2, raus);
    teilen(mx, my, mz, bx, by, bz, cx, cy, cz, h2, raus);
  }
}

/**
 * Oberflaeche einer Suppe im Raster `h` abtasten, auf `h`-Gitter ausgeduennt.
 * Rueckgabe: 3 Zahlen je Punkt.
 */
export function abtasten(s: Suppe, h: number): Float64Array {
  const h2 = h * h;
  const fein: number[] = [];
  for (let i = 0; i < s.tri.length; i += 9) {
    teilen(
      s.tri[i], s.tri[i + 1], s.tri[i + 2],
      s.tri[i + 3], s.tri[i + 4], s.tri[i + 5],
      s.tri[i + 6], s.tri[i + 7], s.tri[i + 8],
      h2, fein
    );
  }
  const gesehen = new Set<string>();
  const raus: number[] = [];
  for (let i = 0; i < fein.length; i += 3) {
    const x = fein[i], y = fein[i + 1], z = fein[i + 2];
    const k = `${Math.round(x / h)}|${Math.round(y / h)}|${Math.round(z / h)}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    raus.push(x, y, z);
  }
  return new Float64Array(raus);
}

/** Der Fehler der Abtastung: so viel kann der wahre Abstand kleiner sein. */
export function eps(h: number): number {
  return h / Math.sqrt(3);
}

/**
 * Die abgetastete Oberflaeche des Greifers im GREIFERFRAME, ueber mehrere
 * Oeffnungsstellungen zusammengelegt.
 *
 * Im Greiferframe, weil Kippen und Drehen dann eine Rechnung je Punkt sind
 * statt ein neuer Matrixdurchlauf je Netz. NICHTS wird ausgelassen: Auch der
 * Rotatorstummel ganz oben gehoert dazu, denn der Ursprung der `grappleGroup`
 * IST das Kardangelenk (`grappleParts.ts`) — es haengt alles darunter, und
 * alles darunter kippt mit.
 */
export function greiferwolkeImFrame(
  bagger: {
    grappleGroup: THREE.Object3D;
  },
  form: { schalen: number; zu: number; offen: number },
  h: number,
  stufen: number
): Float64Array {
  const g = bagger.grappleGroup;
  const bau = (bagger as unknown as {
    greiferbau: { setWinkel(i: number, w: number): void; nachfuehren(): void };
  }).greiferbau;
  const gesehen = new Set<string>();
  const raus: number[] = [];
  const p = new THREE.Vector3();
  for (let s = 0; s < stufen; s++) {
    const w = form.zu + ((form.offen - form.zu) * s) / Math.max(1, stufen - 1);
    for (let i = 0; i < form.schalen; i++) bau.setWinkel(i, w);
    bau.nachfuehren();
    g.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const welt = dreieckssuppe(g, () => true);
    for (let i = 0; i < welt.tri.length; i += 3) {
      p.set(welt.tri[i], welt.tri[i + 1], welt.tri[i + 2]).applyMatrix4(inv);
      welt.tri[i] = p.x;
      welt.tri[i + 1] = p.y;
      welt.tri[i + 2] = p.z;
    }
    const punkte = abtasten(welt, h);
    for (let i = 0; i < punkte.length; i += 3) {
      const k = `${Math.round(punkte[i] / h)}|${Math.round(punkte[i + 1] / h)}|${Math.round(punkte[i + 2] / h)}`;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      raus.push(punkte[i], punkte[i + 1], punkte[i + 2]);
    }
  }
  return new Float64Array(raus);
}

/* ------------------------------------------------------- Abstandsgitter */

/** Gleichfoermiges Raster ueber eine Dreieckssuppe, fuer die Nachbarsuche. */
export class Gitter {
  readonly zelle: number;
  private min = [Infinity, Infinity, Infinity];
  private max = [-Infinity, -Infinity, -Infinity];
  private n = [0, 0, 0];
  private kopf: Int32Array;
  private naechst: Int32Array;
  readonly suppe: Suppe;

  constructor(s: Suppe, zelle: number) {
    this.suppe = s;
    this.zelle = zelle;
    const t = s.tri;
    for (let i = 0; i < t.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (t[i + a] < this.min[a]) this.min[a] = t[i + a];
        if (t[i + a] > this.max[a]) this.max[a] = t[i + a];
      }
    }
    for (let a = 0; a < 3; a++) {
      this.n[a] = Math.max(1, Math.ceil((this.max[a] - this.min[a]) / zelle) + 1);
    }
    const zellen = this.n[0] * this.n[1] * this.n[2];
    this.kopf = new Int32Array(zellen).fill(-1);
    const anzahl = t.length / 9;
    // Jedes Dreieck in ALLE Zellen seines Kastens — Mehrfacheintraege sind
    // gewollt, sonst wird ein langes Dreieck in der Nachbarsuche uebersehen.
    const liste: number[] = [];
    const listeNext: number[] = [];
    for (let d = 0; d < anzahl; d++) {
      const o = d * 9;
      const lo = [0, 0, 0];
      const hi = [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        const v0 = t[o + a], v1 = t[o + 3 + a], v2 = t[o + 6 + a];
        lo[a] = this.zelleVon(Math.min(v0, v1, v2), a);
        hi[a] = this.zelleVon(Math.max(v0, v1, v2), a);
      }
      for (let x = lo[0]; x <= hi[0]; x++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let z = lo[2]; z <= hi[2]; z++) {
            const c = (x * this.n[1] + y) * this.n[2] + z;
            liste.push(d);
            listeNext.push(this.kopf[c]);
            this.kopf[c] = liste.length - 1;
          }
    }
    this.eintrag = new Int32Array(liste);
    this.naechst = new Int32Array(listeNext);
  }

  private eintrag: Int32Array;

  private zelleVon(v: number, a: number): number {
    return Math.max(0, Math.min(this.n[a] - 1, Math.floor((v - this.min[a]) / this.zelle)));
  }

  /** Abstand des Punktes zum Kasten des ganzen Gitters (0 = drin). */
  kastenAbstand(px: number, py: number, pz: number): number {
    const dx = Math.max(this.min[0] - px, px - this.max[0], 0);
    const dy = Math.max(this.min[1] - py, py - this.max[1], 0);
    const dz = Math.max(this.min[2] - pz, pz - this.max[2], 0);
    return Math.hypot(dx, dy, dz);
  }

  /**
   * Abstand des Punktes zum naechsten Dreieck.
   * `deckel`: groesser als das interessiert nicht — dann kommt `deckel` zurueck.
   */
  abstand(px: number, py: number, pz: number, deckel: number): { d: number; netz: number } {
    if (this.kastenAbstand(px, py, pz) >= deckel) return { d: deckel, netz: -1 };
    const cx = this.zelleVon(px, 0), cy = this.zelleVon(py, 1), cz = this.zelleVon(pz, 2);
    let best = deckel;
    let bestNetz = -1;
    const maxRing = Math.ceil(deckel / this.zelle) + 1;
    for (let ring = 0; ring <= maxRing; ring++) {
      // Sobald der naechste Ring garantiert weiter weg ist als das Gefundene:
      if (best <= (ring - 1) * this.zelle) break;
      const x0 = cx - ring, x1 = cx + ring;
      const y0 = cy - ring, y1 = cy + ring;
      const z0 = cz - ring, z1 = cz + ring;
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= this.n[0]) continue;
        const randX = x === x0 || x === x1;
        for (let y = y0; y <= y1; y++) {
          if (y < 0 || y >= this.n[1]) continue;
          const randY = y === y0 || y === y1;
          for (let z = z0; z <= z1; z++) {
            if (z < 0 || z >= this.n[2]) continue;
            // Nur die Schale des Rings — das Innere war im letzten Durchlauf dran
            if (!randX && !randY && !(z === z0 || z === z1)) continue;
            const c = (x * this.n[1] + y) * this.n[2] + z;
            for (let e = this.kopf[c]; e !== -1; e = this.naechst[e]) {
              const d = this.eintrag[e] * 9;
              const q = punktDreieck(px, py, pz, this.suppe.tri, d);
              if (q < best) {
                best = q;
                bestNetz = this.suppe.netz[this.eintrag[e]];
              }
            }
          }
        }
      }
    }
    return { d: best, netz: bestNetz };
  }
}

/**
 * Grobsieb: ein Wuerfel von Stuetzwerten um einen Mittelpunkt, aus dem sich
 * eine UNTERE SCHRANKE des wahren Abstands ablesen laesst.
 *
 * Warum. Die eigentliche Frage („kommt sich irgendetwas naeher als X") stellt
 * sich hundertmillionenfach, und in weit ueber 99 % der Faelle lautet die
 * Antwort „nein, weit weg". Eine Ringsuche im Raster kostet dafuer jedesmal
 * hundert Zellenbesuche. Das Feld beantwortet genau diese Faelle mit einem
 * einzigen Feldzugriff.
 *
 * Warum es nichts uebersehen kann. Gespeichert wird der exakte Abstand des
 * ZELLENMITTELPUNKTS, gedeckelt. Ein Punkt in der Zelle liegt hoechstens die
 * halbe Raumdiagonale vom Mittelpunkt entfernt; nach der Dreiecksungleichung
 * ist sein Abstand also mindestens `wert − halbeDiagonale`. Wer diese Schranke
 * ueberschreitet, ist sicher weiter weg — wer sie unterschreitet, wird exakt
 * nachgerechnet.
 */
export class Naehefeld {
  /*
   * Float64, nicht Float32. Mit Float32 rundet der gespeicherte Deckel um
   * 3e−8 nach unten, und die Schranke `wert − halbeDiagonale` faellt genau um
   * diesen Betrag unter den Deckel — dann kommt JEDER Punkt durchs Sieb und
   * die Beschleunigung ist weg. Gemessen: bei Zellweite 0,15 kamen 15.608 von
   * 15.608 Punkten durch, bei 0,20 nur 920. Der Unterschied war nicht die
   * Geometrie, sondern die Rundung.
   */
  private werte: Float64Array;
  private n: number;
  private o: [number, number, number];
  private zelle: number;
  private halbdiag: number;
  private deckel: number;
  private kap: number;

  constructor(
    gitter: Gitter,
    mitte: { x: number; y: number; z: number },
    reichweite: number,
    zelle: number,
    deckel: number
  ) {
    this.zelle = zelle;
    this.halbdiag = (zelle * Math.sqrt(3)) / 2;
    this.n = Math.ceil((2 * reichweite) / zelle) + 2;
    this.o = [mitte.x - reichweite - zelle, mitte.y - reichweite - zelle, mitte.z - reichweite - zelle];
    this.werte = new Float64Array(this.n * this.n * this.n);
    this.deckel = deckel;
    const kap = deckel + this.halbdiag;
    this.kap = kap;
    for (let ix = 0; ix < this.n; ix++) {
      const x = this.o[0] + (ix + 0.5) * zelle;
      for (let iy = 0; iy < this.n; iy++) {
        const y = this.o[1] + (iy + 0.5) * zelle;
        for (let iz = 0; iz < this.n; iz++) {
          const z = this.o[2] + (iz + 0.5) * zelle;
          this.werte[(ix * this.n + iy) * this.n + iz] = gitter.abstand(x, y, z, kap).d;
        }
      }
    }
  }

  /** Untere Schranke des wahren Abstands an dieser Stelle. */
  untere(px: number, py: number, pz: number): number {
    const ix = Math.floor((px - this.o[0]) / this.zelle);
    const iy = Math.floor((py - this.o[1]) / this.zelle);
    const iz = Math.floor((pz - this.o[2]) / this.zelle);
    // Ausserhalb des Feldes: keine Aussage, also die schwaechstmoegliche.
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.n || iy >= this.n || iz >= this.n) return 0;
    const w = this.werte[(ix * this.n + iy) * this.n + iz];
    /*
     * „Nichts in der Naehe" wird als DECKEL zurueckgegeben, nicht als
     * `kap − halbeDiagonale`. Der Unterschied ist ein Rundungsschritt — und
     * genau der hat das Sieb einmal vollstaendig ausgehebelt: `0,15 + 0,10392…`
     * und davon wieder `0,10392…` abgezogen ergibt **0,14999999999999997**,
     * und damit war jeder Punkt „naeher als 0,15". Gemessen kamen 13.929 von
     * 13.929 Punkten durch; die Uebersicht rechnete danach jede einzelne
     * Abstandsfrage exakt aus und lief ueber eine Stunde.
     */
    if (w >= this.kap) return this.deckel;
    const v = w - this.halbdiag;
    return v > 0 ? v : 0;
  }
}

/* --------------------------------------------------------- Das Drehprofil */

/**
 * DAS DREHPROFIL — die Frage „beruehrt es sich bei IRGENDEINER
 * Rotatorstellung" in ZWEI Zahlen je Punkt statt 24 Durchgaengen.
 *
 * Bei Kippwinkel 0 dreht der Rotator den Greifer um die LOTRECHTE durch das
 * Kardangelenk. Ein Greiferpunkt laeuft dabei auf einem waagerechten Kreis:
 * seine Hoehe `y` unter dem Gelenk und sein Achsabstand `r` bleiben, nur der
 * Winkel wandert. Fuer zwei Punkte A (fest, am Arm) und P (am Greifer) gilt
 * deshalb
 *
 *     min ueber alle Rotatorstellungen von |A − P| = |(r_A, y_A) − (r_P, y_P)|
 *
 * — der kleinste raeumliche Abstand ueber den ganzen Rotatorweg ist der
 * ebene Abstand in der Halbebene (Achsabstand | Hoehe). Das Kleinstmass ueber
 * einen KONTINUIERLICHEN Rotator kostet damit weniger als ein einziger der
 * 24 Durchgaenge — und ist strenger als sie, weil zwischen zwei Stichproben
 * nichts mehr durchrutschen kann.
 *
 * WOFUER: `test/greifer-nullgrad.test.ts`. Die Messung selbst
 * (`tools/greifer-freigang.ts`) rechnet weiter raeumlich, weil sie auch
 * GEKIPPTE Greifer misst — und sobald der Greifer kippt, laeuft ein Punkt
 * nicht mehr auf einem waagerechten Kreis und die Abkuerzung gilt nicht.
 */
export class Drehprofil {
  private zelle: number;
  private r0 = Infinity;
  private y0 = Infinity;
  private nr = 0;
  private ny = 0;
  private kopf: Int32Array = new Int32Array(0);
  private naechst: Int32Array = new Int32Array(0);
  /** (r | y) je Punkt. */
  readonly rz: Float64Array;

  /**
   * @param wolke Greiferpunkte im Greiferframe, 3 Zahlen je Punkt
   * @param ab    erster Punkt, der zaehlt (alles davor ist die Aufhaengung)
   * @param zelle Rasterweite der Nachbarsuche (m)
   */
  constructor(wolke: Float64Array, ab: number, zelle: number) {
    this.zelle = zelle;
    const n = wolke.length / 3 - ab;
    this.rz = new Float64Array(n * 2);
    let rHi = -Infinity;
    let yHi = -Infinity;
    for (let i = 0; i < n; i++) {
      const o = (ab + i) * 3;
      const r = Math.hypot(wolke[o], wolke[o + 2]);
      const y = wolke[o + 1];
      this.rz[i * 2] = r;
      this.rz[i * 2 + 1] = y;
      if (r < this.r0) this.r0 = r;
      if (y < this.y0) this.y0 = y;
      if (r > rHi) rHi = r;
      if (y > yHi) yHi = y;
    }
    this.nr = Math.max(1, Math.ceil((rHi - this.r0) / zelle) + 1);
    this.ny = Math.max(1, Math.ceil((yHi - this.y0) / zelle) + 1);
    this.kopf = new Int32Array(this.nr * this.ny).fill(-1);
    this.naechst = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const c = this.zellenNr(this.rz[i * 2], this.rz[i * 2 + 1]);
      this.naechst[i] = this.kopf[c];
      this.kopf[c] = i;
    }
  }

  private zellenNr(r: number, y: number): number {
    const ir = Math.max(0, Math.min(this.nr - 1, Math.floor((r - this.r0) / this.zelle)));
    const iy = Math.max(0, Math.min(this.ny - 1, Math.floor((y - this.y0) / this.zelle)));
    return ir * this.ny + iy;
  }

  /**
   * Kleinster Abstand des Armpunktes (Achsabstand `r`, Hoehe `y` relativ zum
   * Kardangelenk) zum naechsten Greiferpunkt — ueber ALLE Rotatorstellungen.
   */
  abstand(r: number, y: number, deckel: number): number {
    const ir = Math.floor((r - this.r0) / this.zelle);
    const iy = Math.floor((y - this.y0) / this.zelle);
    let best = deckel;
    const maxRing = Math.ceil(deckel / this.zelle) + 1;
    for (let ring = 0; ring <= maxRing; ring++) {
      if (best <= (ring - 1) * this.zelle) break;
      const a0 = ir - ring, a1 = ir + ring;
      const b0 = iy - ring, b1 = iy + ring;
      for (let a = a0; a <= a1; a++) {
        if (a < 0 || a >= this.nr) continue;
        const randA = a === a0 || a === a1;
        for (let b = b0; b <= b1; b++) {
          if (b < 0 || b >= this.ny) continue;
          if (!randA && b !== b0 && b !== b1) continue;
          for (let e = this.kopf[a * this.ny + b]; e !== -1; e = this.naechst[e]) {
            const d = Math.hypot(this.rz[e * 2] - r, this.rz[e * 2 + 1] - y);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }
}

/** Abstand Punkt → Dreieck (Ericson, Real-Time Collision Detection, 5.1.5). */
export function punktDreieck(px: number, py: number, pz: number, t: Float64Array, o: number): number {
  const ax = t[o], ay = t[o + 1], az = t[o + 2];
  const bx = t[o + 3], by = t[o + 4], bz = t[o + 5];
  const cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return Math.hypot(apx, apy, apz);
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return Math.hypot(bpx, bpy, bpz);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return Math.hypot(apx - v * abx, apy - v * aby, apz - v * abz);
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return Math.hypot(cpx, cpy, cpz);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return Math.hypot(apx - w * acx, apy - w * acy, apz - w * acz);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    // naechster Punkt ist b + w·(c−b); Abstand also |bp − w·(c−b)|
    return Math.hypot(bpx - w * (cx - bx), bpy - w * (cy - by), bpz - w * (cz - bz));
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return Math.hypot(apx - (v * abx + w * acx), apy - (v * aby + w * acy), apz - (v * abz + w * acz));
}
