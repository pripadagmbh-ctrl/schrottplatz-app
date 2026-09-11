/**
 * Wie eine Fuhre auf der Ladefläche liegt (Wunsch 11.09.2026).
 *
 * Vorher wurde jedes Stück auf einen zufälligen freien Platz gewürfelt, und
 * was keinen fand, kam auf einen Stapel in der Mitte — daher die Türme, die
 * weit über die Bordwand ragten. Ein beladener LKW sieht anders aus: Die
 * Ladung folgt dem Kasten, liegt dicht und endet knapp über der Bordwand.
 *
 * Gepackt wird deshalb wie in einer Kiste: Die Fläche ist ein Raster, jede
 * Spalte merkt sich ihre Füllhöhe, und jedes Stück kommt an die tiefste
 * Stelle, an der es noch unter die Höhengrenze passt. Was nicht mehr passt,
 * bleibt liegen — sein Gewicht verteilt der Aufrufer auf die übrigen Stücke,
 * damit die Fuhre trotzdem ihre Tonnage hat.
 */

/** Rasterweite der Höhenkarte (m) — fein genug für Kleinteile. */
const RASTER = 0.2;

export interface LadeStueck {
  /** halbe Grundfläche (m) — das Stück belegt ein Quadrat dieser Halbweite */
  r: number;
  /** Bauhöhe (m) */
  hoehe: number;
}

export interface LadePlatz {
  /** quer zur Fahrtrichtung, 0 = Mitte */
  x: number;
  /** Höhe der Unterkante über dem Flächenboden */
  y: number;
  /** in Fahrtrichtung, 0 = vorderes Ende der Fläche */
  z: number;
}

/**
 * Plätze für eine Ladung suchen. Reihenfolge bleibt erhalten: `plaetze[i]`
 * gehört zu `stuecke[i]`, `null` heißt "passt nicht mehr".
 *
 * @param halbBreite halbe Innenbreite der Fläche
 * @param laenge nutzbare Länge der Fläche
 * @param maxHoehe Oberkante der Ladung über dem Flächenboden
 */
export function packeLadung(
  stuecke: LadeStueck[],
  halbBreite: number,
  laenge: number,
  maxHoehe: number
): Array<LadePlatz | null> {
  const nx = Math.max(1, Math.floor((halbBreite * 2) / RASTER));
  const nz = Math.max(1, Math.floor(laenge / RASTER));
  const hoehen = new Float64Array(nx * nz);
  const plaetze: Array<LadePlatz | null> = [];

  // Große Stücke zuerst: Sie brauchen den freien Boden, Kleinkram füllt
  // hinterher die Lücken. Die Ausgabereihenfolge bleibt davon unberührt.
  const reihenfolge = stuecke
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.r * b.s.hoehe - a.s.r * a.s.hoehe);

  for (const { s, i } of reihenfolge) {
    const felder = Math.max(1, Math.ceil((s.r * 2) / RASTER));
    let bestIx = -1;
    let bestIz = -1;
    let bestH = Infinity;
    for (let iz = 0; iz + felder <= nz; iz++) {
      for (let ix = 0; ix + felder <= nx; ix++) {
        let h = 0;
        for (let b = 0; b < felder && h < bestH; b++) {
          for (let a = 0; a < felder; a++) {
            const v = hoehen[(iz + b) * nx + ix + a];
            if (v > h) h = v;
          }
        }
        if (h + s.hoehe > maxHoehe) continue;
        if (h < bestH) {
          bestH = h;
          bestIx = ix;
          bestIz = iz;
        }
      }
    }
    if (bestIx < 0) {
      plaetze[i] = null;
      continue;
    }
    // Spalten unter dem Stück auf die neue Oberkante heben
    const oben = bestH + s.hoehe;
    for (let b = 0; b < felder; b++) {
      for (let a = 0; a < felder; a++) hoehen[(bestIz + b) * nx + bestIx + a] = oben;
    }
    plaetze[i] = {
      x: -halbBreite + (bestIx + felder / 2) * RASTER,
      y: bestH,
      z: (bestIz + felder / 2) * RASTER,
    };
  }
  return plaetze;
}

/**
 * Höchste Oberkante einer fertig gepackten Ladung — zum Nachrechnen, ob die
 * Fuhre so vom Hof fahren darf.
 */
export function ladeHoehe(
  stuecke: LadeStueck[],
  plaetze: Array<LadePlatz | null>
): number {
  let max = 0;
  plaetze.forEach((p, i) => {
    if (!p) return;
    const oben = p.y + stuecke[i].hoehe;
    if (oben > max) max = oben;
  });
  return max;
}

/**
 * Grundfläche und Bauhöhe eines Schrottteils, so wie es flach auf der Fläche
 * liegt. Der Radius ist die halbe Diagonale im Grundriss — damit passt das
 * Stück in jeder Drehung.
 */
export function stueckMass(kind: string, dims: number[]): LadeStueck {
  switch (kind) {
    case "box":
      return { r: Math.hypot(dims[0], dims[2]) / 2, hoehe: dims[1] };
    case "cyl":
      // Rohre liegen auf der Seite: Länge im Grundriss, Durchmesser als Höhe
      return { r: Math.max(dims[0], dims[1] / 2), hoehe: dims[0] * 2 };
    case "torus":
      return { r: dims[0] + dims[1], hoehe: dims[1] * 2 };
    default:
      // Draht und Kabel liegen als Bund flach
      return { r: dims[0], hoehe: Math.max(0.18, dims[0] * 0.7) };
  }
}
