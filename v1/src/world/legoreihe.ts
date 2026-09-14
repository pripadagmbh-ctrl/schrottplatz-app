/**
 * Wie eine Reihe Betonlegosteine eine Strecke ausfüllt — mit Endstein.
 *
 * Befund 14.09.2026 (Patrick, auf dem Gerät): „Bei jeder Mulde werden immer
 * vollständige Legosteine gebaut. Das führt dazu, dass die Außenteile immer
 * abstehen. Da würde ja auch quasi ein einzelner Legostein mit einem Element
 * reichen."
 *
 * Genau so war es gebaut: Die Wandschleifen liefen in Schritten von einer
 * ganzen Steinlänge los und hörten erst auf, wenn die Mitte des nächsten
 * Steins über das Ende hinausgelaufen war. Am Ende der Reihe stand deshalb
 * ein ganzer Stein über die Wandkante hinaus — an einer Mulde von 4,2 m
 * Front bis zu 0,75 m, also ein halber Stein in der Luft.
 *
 * Ein Maurer macht das anders: Er legt volle Steine, und wo keiner mehr
 * hinpasst, kommt ein kürzerer hin. Genau das tut diese Funktion. Sie rechnet
 * nur Längen und Mitten aus — wer daraus Steine baut, entscheidet selbst, ob
 * sie in eine InstancedMesh, in einen Kollider oder in eine Zeichnung gehen.
 *
 * Zwei Regeln, die man im Bild sofort sieht:
 *
 * 1. **Kein Stück ist länger als ein ganzer Stein.** Sonst stünde wieder
 *    etwas über.
 * 2. **Kein Stück ist kürzer als `MIN_STUECK`.** Ein 4-cm-Splitter am
 *    Wandende sieht aus wie ein Bauteil, das abgebrochen ist. Fällt so ein
 *    Rest an, wird er mit dem vorletzten Stück zusammengelegt und beides
 *    halbiert — dann stehen dort zwei gleich lange, etwas kürzere Steine.
 */

export interface Steinstueck {
  /** Mitte des Steins auf der Laufachse. */
  mitte: number;
  /** Länge dieses Steins; höchstens die volle Steinlänge. */
  laenge: number;
}

/**
 * Kürzestes Stück, das noch als Stein durchgeht (SW, 14.09.2026).
 *
 * 0,25 m ist rund ein Sechstel des 1,6-m-Steins der Umrandung und knapp die
 * Dicke einer Wand — darunter liest man es als Bruchstück, nicht als Stein.
 */
export const MIN_STUECK = 0.25;

const EPS = 1e-6;

/**
 * Eine Steinreihe von `von` bis `bis` auslegen.
 *
 * @param versatz Länge des ersten, kürzeren Steins. Damit liegen die Fugen
 *   benachbarter Lagen im Verband statt übereinander — bei einer Trockenmauer
 *   aus Betonlego ist das nicht Zierde, sondern der Grund, warum sie steht.
 *   `0` heisst: mit einem vollen Stein anfangen.
 */
export function reihenstuecke(
  von: number,
  bis: number,
  steinLaenge: number,
  versatz = 0
): Steinstueck[] {
  let rest = bis - von;
  if (rest <= EPS || steinLaenge <= EPS) return [];
  const laengen: number[] = [];
  if (versatz > EPS && rest > versatz + EPS) {
    laengen.push(versatz);
    rest -= versatz;
  }
  while (rest > steinLaenge + EPS) {
    laengen.push(steinLaenge);
    rest -= steinLaenge;
  }
  if (rest > MIN_STUECK || laengen.length === 0) {
    laengen.push(rest);
  } else {
    // Splitter vermeiden: letzten Stein und Rest zusammenlegen, dann teilen.
    const letzter = laengen.pop()!;
    const haelfte = (letzter + rest) / 2;
    laengen.push(haelfte, haelfte);
  }
  const stuecke: Steinstueck[] = [];
  let x = von;
  for (const laenge of laengen) {
    stuecke.push({ mitte: x + laenge / 2, laenge });
    x += laenge;
  }
  return stuecke;
}
