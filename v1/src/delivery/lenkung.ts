/**
 * EINLENKEN STATT SPRINGEN — die Drehung eines Fahrzeugs ueber mehrere
 * Rechenschritte gefuehrt.
 *
 * WAS VORHER WAR (gemessen, E-073 und E-080). `vehicles.placeAt` hat
 * `group.rotation.y` HART auf die Richtung des aktuellen Streckenstuecks
 * gesetzt. An einer Ecke der Polylinie wechselt diese Richtung zwischen zwei
 * Bildern — der Wagen lag also in EINEM Rechenschritt in der neuen Richtung:
 *
 *   Kipper, Wechsel `shiftPause` → `reverseIn`   168,7 Grad in einem Schritt
 *   Abholer, Ausfahrt am Muellcontainer          119,9 Grad in einem Schritt
 *   neun weitere Strecken                         90,0 Grad
 *
 * Das ist dieselbe Bauart wie der Kipper-Katapult: Ein Koerper wird VERSETZT
 * statt BEWEGT. Rapier leitet die Geschwindigkeit eines kinematischen Koerpers
 * aus der Posenaenderung ab; bei 119,9 Grad springt die weiteste Ecke des
 * Umrisses 10,75 m weit, und aus 10,75 m in 1/60 s werden 645 m/s. Was auf dem
 * Weg liegt, steckt im naechsten Bild tief im Fahrzeug, und der Loeser raeumt
 * die Durchdringung in einem einzigen Bild aus. Gemessen an schon liegendem
 * Schrott: 6.596 km/h und bis zu 9,3 m Verschiebung (E-073, 12 Saaten).
 *
 * WAS JETZT GILT. Die Gierlage folgt der Streckenrichtung mit BEGRENZTER
 * DREHRATE. Damit ist der Sprung eine Bewegung, und die Bewegung ist so
 * langsam, dass der Loeser sie als Beruehrung sieht und nicht als
 * Entdurchdringung.
 *
 * Die Rechnung steht hier und nicht in `vehicles.ts`, weil drei Stellen
 * dasselbe Gesetz brauchen und keine davon ihre eigene Abschrift fuehren darf:
 * die Fahrt (`vehicles.advance`), der Waechter (`test/rangierknick.test.ts`)
 * und das Messwerkzeug (`tools/rangierknick.ts`).
 */

/**
 * WIE SCHNELL GELENKT WERDEN DARF (rad/s).
 *
 * SW, aber hergeleitet und nicht gegriffen: Ein LKW dreht sich nicht um seine
 * Hochachse, er faehrt einen Kreis. Die Gierrate eines fahrenden Fahrzeugs ist
 *
 *     omega = v / R
 *
 * mit R dem Wendekreisradius. Der Dreiachser in `vehicleModel.ts` hat seine
 * Vorderachse bei `bedLen/2 + 1,1` und die beiden Hinterachsen bei 0,10 und
 * `−bedLen/2 + 0,80`; ihr Mittel liegt bei −0,90 m. Der Radstand (Vorderachse
 * bis Mitte der Hinterachsen) ist damit
 *
 *     Pritsche (bedLen 5,4)   3,80 − (−0,90) = 4,70 m
 *     Kipper   (bedLen 6,0)   4,10 − (−0,90) = 5,00 m
 *
 * Ein gelenktes Vorderrad schlaegt rund 40 Grad ein; daraus folgt
 * R = 4,70 / tan 40 Grad = 5,60 m. Bei Umschlagstempo SPEED = 4,8 m/s
 * (`routes.ts`) sind das
 *
 *     omega = 4,8 / 5,60 = 0,857 rad/s = 49 Grad/s.
 *
 * Gerundet 0,85 rad/s. Eine Viertelwendung (90 Grad) dauert damit 1,8 s, die
 * volle Kehre (180 Grad) 3,7 s. Ab welcher Rate der gemessene Schaden
 * verschwindet, steht in `tools/rangier-wirkung.ts` und im Log (E-081).
 */
export const LENK_RATE = 0.85;

/**
 * Ab diesem Restwinkel dreht der Wagen erst ein und faehrt dann los (rad).
 *
 * 1,75 rad = 100 Grad. Die Zahl trennt zwei verschiedene Vorgaenge:
 *
 *   Eine ECKE faehrt man durch. Der Wagen laeuft weiter und zieht seine
 *   Gierlage nach; ein bis zwei Wagenlaengen lang steht er dabei etwas
 *   schraeg zur Bahn. Das ist, was ein LKW auch auf dem Hof tut.
 *
 *   Eine KEHRE faehrt man nicht durch. Am Uebergang `shiftPause` →
 *   `reverseIn` verlangt die Strecke 168,7 Grad: Der Wagen kommt von Norden
 *   an und soll rueckwaerts weiter nach Sueden. Wer das im Fahren nachzieht,
 *   schiebt seinen Umriss quer ueber die halbe Abladespur.
 *
 * 100 Grad liegt zwischen den 90 Grad der neun Ecken und den 119,9 Grad der
 * Abholer-Ausfahrt: Alle rechten Winkel werden gefahren, die Kehren gedreht.
 *
 * DAZU KOMMT EINE REGEL OHNE ZAHL: VOR JEDER RUECKWAERTSFAHRT wird
 * eingedreht, auch bei 90 Grad. Das ist gemessen (E-081) und nicht aus
 * Anschauung: Wer 90 Grad im Rueckwaertsfahren nachzieht, braucht dafuer
 * 1,9 s und legt in dieser Zeit 5,3 m zurueck — die Silogasse ist aber nur
 * 7,4 m tief. Sein Umriss stand dabei 0,70 m tief in den Flanken der
 * Nachbarsilos. Ein Fahrer, der rueckwaerts in eine Box setzt, richtet
 * ebenfalls erst aus und stoesst dann zurueck.
 */
export const PIVOT_AB = 1.75;

/**
 * WIE WEIT DER FAHRER VORAUSSCHAUT, BEVOR ER EINLENKT (m).
 *
 * Ohne Vorausschau lenkt der Wagen erst ein, wenn er die Ecke schon erreicht
 * hat — er haelt dort an (siehe `fahrtFaktor`), dreht sich und faehrt weiter.
 * Das ist kein LKW, das ist ein Gabelstapler. Ein Fahrer sieht die Ecke
 * kommen und zieht vorher am Lenkrad.
 *
 * Die Zahl folgt aus der Rate: Bei 0,85 rad/s braucht eine Viertelwendung
 * 1,85 s, und in dieser Zeit legt der Wagen bei 4,8 m/s 8,9 m zurueck. So weit
 * vorauszuschauen hiesse, die Ecke um Meter abzuschneiden. Gemessen (E-081,
 * `tools/lenkrate.ts`) ist die beste Wahl viel kuerzer, weil der Wagen in der
 * Kurve ohnehin langsamer wird: Bei 3,0 m schneidet er die Ecke sichtbar,
 * unter 1,0 m bleibt er stehen und dreht sich.
 */
export const VORAUS_M = 1.5;

/**
 * WIE SCHNELL EIN WAGEN FAEHRT, DER NOCH NICHT IN DER BAHN LIEGT — als Anteil.
 *
 * Das ist der zweite Teil der Reparatur, und ohne ihn taugt der erste nicht.
 * Wer nur die Drehrate begrenzt, faehrt mit voller Geschwindigkeit geradeaus
 * weiter, waehrend er sich noch dreht: Der Wagen laeuft quer aus der Bahn, und
 * gemessen steckte sein Umriss dabei bis zu 0,70 m in den Silowaenden (E-081).
 * Ein LKW macht das nicht — er wird in der Kurve langsam.
 *
 * Die Rechnung ist der Kosinus des Restwinkels, also der Anteil des Schubs,
 * der ueberhaupt in Bahnrichtung zeigt:
 *
 *     Rest    0 Grad  →  voll         Rest  60 Grad  →  halbes Tempo
 *     Rest   30 Grad  →  87 %         Rest  90 Grad  →  steht, dreht nur
 *
 * Damit braucht es keine zweite Zahl fuer „wann wird gedreht statt gefahren":
 * Bei einer Kehre geht der Anteil von selbst auf null. `PIVOT_AB` entscheidet
 * nur noch, ob die DREHRICHTUNG frei gewaehlt werden darf.
 */
export function fahrtFaktor(rest: number): number {
  const c = Math.cos(rest);
  return c > 0 ? c : 0;
}

/** Der Weg von `ist` nach `soll` in einer festen Drehrichtung (rad, >= 0). */
export function restInRichtung(ist: number, soll: number, richtung: 1 | -1): number {
  const d = winkelRest(ist, soll) * richtung;
  return d >= 0 ? d : d + Math.PI * 2;
}

/**
 * IN WELCHE RICHTUNG DER FAHRER EINDREHT — dorthin, wo Platz ist.
 *
 * Eine Kehre auf der Stelle ueberstreicht einen Kreis mit dem Radius der
 * weitesten Umrissecke: beim Kipper 5,14 m (1,55 x 4,90 m Halbmasse). Welche
 * Haelfte dieses Kreises frei ist, haengt vom Ort ab — und die Kehre am
 * Abladeplatz zeigt, dass es nicht gleichgueltig ist: Rechtsherum schwenkt
 * die Kabine nach OSTEN und 0,60 m in die Ostmauer, linksherum nach WESTEN
 * ueber den offenen Hof. Der Winkel ist dabei laenger (191 statt 169 Grad,
 * also 0,3 s mehr), und das ist der Preis.
 *
 * `tiefeBei` liefert, wie tief der Umriss bei DIESER Gierlage in einem
 * Bauwerk steckt. Es kommt von aussen, weil `vehicles.ts` dafuer seinen
 * eigenen Umriss samt Anhaenger baut und der Waechter denselben Kreis ohne
 * Fahrzeug abtastet.
 *
 * Bei Gleichstand gewinnt der kuerzere Weg — sonst drehte sich ein Wagen auf
 * freiem Feld ohne Grund einmal fast herum.
 */
export function drehRichtung(
  ist: number,
  soll: number,
  tiefeBei: (gier: number) => number,
  schritte = 32
): 1 | -1 {
  let bestRichtung: 1 | -1 = 1;
  let bestTiefe = Infinity;
  let bestWeg = Infinity;
  for (const r of [1, -1] as const) {
    const weg = restInRichtung(ist, soll, r);
    let tief = 0;
    for (let i = 1; i <= schritte; i++) {
      const t = tiefeBei(ist + r * (weg * i) / schritte);
      if (t > tief) tief = t;
    }
    // 1 cm Toleranz: darunter ist es Rundung, nicht Blech in Beton
    // (`UMRISS_TOLERANZ` in `umriss.ts`).
    if (tief < bestTiefe - 0.01 || (tief < bestTiefe + 0.01 && weg < bestWeg)) {
      bestTiefe = tief;
      bestWeg = weg;
      bestRichtung = r;
    }
  }
  return bestRichtung;
}

/** Der kuerzeste Weg von `ist` nach `soll`, in (−pi, pi]. */
export function winkelRest(ist: number, soll: number): number {
  let d = soll - ist;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Einen Schritt in Richtung `soll` — hoechstens `maxSchritt` rad weit.
 *
 * `maxSchritt = Infinity` liefert genau den alten Sprungzustand. Das ist kein
 * Versehen, sondern die Gegenprobe: Ein Waechter, der den reparierten Stand
 * misst, muss am kaputten Stand melden.
 */
export function lenkeEin(ist: number, soll: number, maxSchritt: number): number {
  const d = winkelRest(ist, soll);
  if (!(maxSchritt < Math.abs(d))) return soll;
  return ist + Math.sign(d) * maxSchritt;
}

/**
 * Ein Schritt einer Kehre — wie `lenkeEin`, aber in vorgegebener Drehrichtung.
 *
 * Getrennt, weil `lenkeEin` immer den kuerzeren Weg nimmt und eine Kehre
 * genau das nicht darf: Sie geht dorthin, wo Platz ist (`drehRichtung`).
 */
export function dreheWeiter(
  ist: number,
  soll: number,
  maxSchritt: number,
  richtung: 1 | -1
): number {
  const rest = restInRichtung(ist, soll, richtung);
  if (!(maxSchritt < rest)) return soll;
  return ist + richtung * maxSchritt;
}
