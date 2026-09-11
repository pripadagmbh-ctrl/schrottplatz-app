/**
 * Ist der Fahrweg frei? (Auftrag 11.09.2026, Phase 0.2)
 *
 * Lambert pflügte mit dem Radlader quer durch den Haufen: Er fuhr auf das
 * nächstgelegene Teil zu, egal was dazwischen lag, weckte dabei den halben
 * Haufen auf — jedes aufgeweckte Teil kostet Rechenzeit — und wühlte den
 * Platz um. Ein Radlader arbeitet aber am Rand: Er nimmt, woran er
 * herankommt, und lässt den Rest dem Bagger.
 *
 * Geprüft wird ein Korridor in Schaufelbreite von seiner Position zum Ziel.
 * Was darin liegt, zählt Punkte: ein Teil einen, ein schlafendes zwei (es
 * aufzuwecken ist teuer), ein schwerer Brocken sofort so viel, dass der Weg
 * gesperrt ist. Über drei Punkten gilt das Ziel als nicht erreichbar.
 *
 * Gerechnet statt per Rapier-`castShape` (siehe E-044): Die Teileliste wird
 * ohnehin jede Sekunde durchlaufen, die Wirkung ist dieselbe, und so lässt
 * sich die Regel ohne Physikwelt prüfen.
 */

/** Ein Teil, wie es die Wegprüfung braucht. */
export interface WegTeil {
  x: number;
  z: number;
  /** Umkugelradius — ein Blech liegt breiter als ein Bolzen */
  r: number;
  massKg: number;
  /** Schlafende Teile aufzuwecken kostet am meisten */
  schlaeft: boolean;
}

/** Schaufelbreite des Radladers plus Sicherheitsrand (m). */
export const SCHAUFEL_BREITE = 2.2;
/** Darüber gilt der Weg als verstellt. */
export const WEG_MAX_PUNKTE = 3;
/** Ab dieser Masse sperrt ein einzelnes Teil den Weg. */
export const WEG_SCHWER_KG = 300;
/** Punkte je Teil im Korridor. */
export const PUNKT_WACH = 1;
export const PUNKT_SCHLAF = 2;
export const PUNKT_SCHWER = WEG_MAX_PUNKTE + 1;

/** Abstand eines Punktes von einer Strecke. */
export function abstandZurStrecke(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-9) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * Punkte für alles, was im Korridor liegt. Das Zielteil selbst zählt nicht —
 * er will es ja holen.
 *
 * @param ausser Teil, das übersprungen wird (das Ziel)
 */
export function wegPunkte(
  vonX: number,
  vonZ: number,
  nachX: number,
  nachZ: number,
  teile: WegTeil[],
  breite = SCHAUFEL_BREITE,
  ausser?: WegTeil
): number {
  const halb = breite / 2;
  let punkte = 0;
  for (const t of teile) {
    if (t === ausser) continue;
    if (abstandZurStrecke(t.x, t.z, vonX, vonZ, nachX, nachZ) > halb + t.r) continue;
    if (t.massKg >= WEG_SCHWER_KG) punkte += PUNKT_SCHWER;
    else punkte += t.schlaeft ? PUNKT_SCHLAF : PUNKT_WACH;
    if (punkte > WEG_MAX_PUNKTE) return punkte; // früher Ausstieg, das reicht
  }
  return punkte;
}

/** Kommt er durch, ohne sich durch den Haufen zu wühlen? */
export function wegFrei(
  vonX: number,
  vonZ: number,
  nachX: number,
  nachZ: number,
  teile: WegTeil[],
  breite = SCHAUFEL_BREITE,
  ausser?: WegTeil
): boolean {
  return wegPunkte(vonX, vonZ, nachX, nachZ, teile, breite, ausser) <= WEG_MAX_PUNKTE;
}

/**
 * Eine Fläche, die der Radlader nicht durchfahren darf: Abkippplatz,
 * Stahlhaufen, Ballenlager. Er arbeitet an ihren Aussengrenzen — hinein fährt
 * er nicht (Wunsch 11.09.2026: "er darf nur an aussengrenzen ran").
 */
export interface Zone {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

/**
 * Schneidet die Strecke das Rechteck? Slab-Verfahren: Für jede Achse wird
 * ausgerechnet, in welchem Abschnitt der Strecke sie innerhalb der Grenzen
 * liegt; überlappen sich beide Abschnitte, geht die Strecke hindurch.
 *
 * `schrumpf` verkleinert die Zone. Damit bleibt Arbeit am Rand möglich: Wer
 * ein Teil an der Kante holt, streift die Zone zwangsläufig.
 */
export function streckeSchneidetZone(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  zone: Zone,
  schrumpf = 0
): boolean {
  const hw = zone.hw - schrumpf;
  const hd = zone.hd - schrumpf;
  if (hw <= 0 || hd <= 0) return false;
  const minX = zone.x - hw;
  const maxX = zone.x + hw;
  const minZ = zone.z - hd;
  const maxZ = zone.z + hd;
  let t0 = 0;
  let t1 = 1;
  const achse = (start: number, delta: number, min: number, max: number): boolean => {
    if (Math.abs(delta) < 1e-9) return start >= min && start <= max;
    let n0 = (min - start) / delta;
    let n1 = (max - start) / delta;
    if (n0 > n1) [n0, n1] = [n1, n0];
    t0 = Math.max(t0, n0);
    t1 = Math.min(t1, n1);
    return t0 <= t1;
  };
  if (!achse(ax, bx - ax, minX, maxX)) return false;
  if (!achse(az, bz - az, minZ, maxZ)) return false;
  return t0 <= t1;
}

/** Liegt der Punkt in einer der Zonen? */
export function inZonen(x: number, z: number, zonen: Zone[], schrumpf = 0): boolean {
  for (const zo of zonen) {
    if (Math.abs(x - zo.x) < zo.hw - schrumpf && Math.abs(z - zo.z) < zo.hd - schrumpf) {
      return true;
    }
  }
  return false;
}

/** Wie viele andere Teile liegen im Umkreis? Damit erkennt man den Rand. */
export function nachbarn(
  x: number,
  z: number,
  teile: WegTeil[],
  radius: number,
  ausser?: WegTeil
): number {
  let n = 0;
  for (const t of teile) {
    if (t === ausser) continue;
    if (Math.hypot(t.x - x, t.z - z) <= radius) n++;
  }
  return n;
}
