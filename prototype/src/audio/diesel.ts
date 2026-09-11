/**
 * Ein Diesel, aus Zündungen gebaut.
 *
 * Bisher war der Motor ein Sägezahn-Oszillator bei 48 Hz hinter einem
 * Tiefpass. Das ist ein Synthesizerton, kein Motor — und weil man ihn
 * praktisch immer hört, klang der ganze Platz nach Synthesizer (Befund
 * 11.09.2026: „nichts davon klingt nach Schrottplatz").
 *
 * Ein Diesel klingt nicht, weil er eine Tonhöhe hätte, sondern weil er
 * **schlägt**. Ein Sechszylinder-Viertakter bei 900 Umdrehungen zündet
 * 45-mal je Sekunde; jede Zündung ist ein Schlag, der den Block und den
 * Auspuff anregt. Das Ohr hört daraus:
 *
 * - den **Takt** (die Schlagfolge — das ist die wahrgenommene „Tonhöhe"),
 * - das **Nageln** (die harte, hohe Komponente jeder Zündung; sie wächst mit
 *   der Last und ist das, was einen Diesel von einem Benziner trennt),
 * - die **Unruhe**: Kein Zylinder ist wie der andere. Jeder hat seine eigene
 *   Stärke und liegt ein paar Tausendstel neben dem Raster. Diese
 *   Ungleichmäßigkeit wiederholt sich alle zwei Umdrehungen — genau das ist
 *   das charakteristische Bollern, und genau das fehlt jedem Oszillator.
 *
 * Darum wird hier eine Schleife über einen ganzen Arbeitszyklus (zwei
 * Umdrehungen) ausgerechnet und danach in Ruhe abgespielt. Das ist billig:
 * Die Rechnung läuft einmal beim Start, im Betrieb kostet der Motor einen
 * einzigen Abspielknoten statt fünfzig neuer Knoten je Sekunde.
 *
 * Die Datei kennt kein WebAudio — sie rechnet Zahlen. Damit ist der Motor in
 * Node testbar.
 */

/** Eine abklingende Eigenschwingung. */
export interface Teilton {
  /** Frequenz (Hz) */
  f: number;
  /** Abklingzeit bis auf 1/e (s) */
  tau: number;
  /** Stärke */
  a: number;
}

export interface DieselForm {
  /** Zylinderzahl */
  zylinder: number;
  /** Zündungen je Umdrehung: Viertakter = 0,5 je Zylinder */
  takt: number;
  /** Drehzahl (1/min) */
  drehzahl: number;
  /** Eigenschwingungen des Blocks — der Klang der Maschine */
  block: Teilton[];
  /**
   * Länge des Auspuffstoßes, als Anteil am Zündabstand (0..0,5).
   *
   * Der tiefe Ton eines Diesels ist keine feste Frequenz, sondern **die
   * Zündfolge selbst**: Bei 700/min sind das 35 Hz, bei 1700/min 85 Hz. Er
   * entsteht darum nicht aus einem Teilton, sondern daraus, dass sich der
   * Stoß wiederholt. Als feste Frequenz modelliert war er bei hoher Drehzahl
   * ein Brummen, das den Takt zugedeckt hat (Befund beim Test).
   */
  stossAnteil: number;
  /** Das Nageln — kurz und hoch, wächst mit der Last */
  klopfen: Teilton[];
  /** Ungleichmäßigkeit zwischen den Zylindern (0 = Uhrwerk, 1 = Schrott) */
  streuung: number;
}

/**
 * Der Motor des Umschlagbaggers: sechs Zylinder, schwerer Block.
 *
 * Die Frequenzen sind keine Messwerte an einer echten Maschine, sondern die
 * Lage, an der ein großer Dieselblock seine Eigenschwingungen hat: der
 * Auspuff ganz unten, darüber der Block, das Nageln zwischen 1 und 4 kHz.
 */
export const UMSCHLAGBAGGER: Omit<DieselForm, "drehzahl"> = {
  zylinder: 6,
  takt: 4,
  streuung: 0.22,
  stossAnteil: 0.34,
  block: [
    { f: 92, tau: 0.034, a: 0.5 },
    { f: 148, tau: 0.025, a: 0.4 },
    { f: 255, tau: 0.017, a: 0.27 },
    { f: 420, tau: 0.011, a: 0.17 },
  ],
  klopfen: [
    { f: 1120, tau: 0.0065, a: 0.55 },
    { f: 1760, tau: 0.005, a: 0.42 },
    { f: 2640, tau: 0.0038, a: 0.3 },
    { f: 3850, tau: 0.0026, a: 0.18 },
  ],
};

/** Zündungen je Sekunde. */
export function zuendrate(form: Pick<DieselForm, "zylinder" | "takt" | "drehzahl">): number {
  return (form.drehzahl / 60) * (form.zylinder / (form.takt / 2));
}

/** Dauer eines vollen Arbeitszyklus (s) — beim Viertakter zwei Umdrehungen. */
export function zyklusDauer(form: Pick<DieselForm, "takt" | "drehzahl">): number {
  return (60 / form.drehzahl) * (form.takt / 2);
}

/**
 * Fester Zufall je Zylinder.
 *
 * Absichtlich kein `Math.random`: Die Unruhe eines Motors ist nicht zufällig,
 * sie ist eine Eigenschaft der Maschine und wiederholt sich in jedem Zyklus.
 * Zwei Bagger klingen verschieden, derselbe Bagger klingt gleich.
 */
function streu(zylinder: number, welle: number): number {
  const x = Math.sin(zylinder * 12.9898 + welle * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Eine Schleife über einen Arbeitszyklus.
 *
 * Das Ergebnis ist bewusst nahtlos: Was am Ende noch nachklingt, wird vorne
 * wieder aufaddiert (`(i + k) % laenge`). Dadurch ist das Signal exakt
 * periodisch, und die Schleife läuft ohne Knacken.
 *
 * @param rate Abtastrate (Hz)
 * @param form Motorform
 * @param anteil Welche Teiltöne — der Block oder das Nageln. Beide werden
 *   getrennt gerechnet, damit sich die Last im Betrieb einblenden lässt,
 *   ohne dass irgendetwas neu berechnet werden müsste.
 */
export function dieselSchleife(
  rate: number,
  form: DieselForm,
  anteil: "block" | "klopfen" = "block",
  zyklen = ZYKLEN_JE_SCHLEIFE
): Float32Array {
  const dauer = zyklusDauer(form);
  const laenge = Math.max(64, Math.round(rate * dauer * zyklen));
  const buf = new Float32Array(laenge);
  const teile = anteil === "block" ? form.block : form.klopfen;
  const zuendungen = form.zylinder * zyklen;
  const abstand = laenge / zuendungen;

  for (let i = 0; i < zuendungen; i++) {
    const z = i % form.zylinder;
    /*
     * Jeder Zylinder hat seine feste Eigenart — die wiederholt sich in jedem
     * Zyklus. Dazu kommt eine kleine Schwankung von Zyklus zu Zyklus: Ein
     * Motor arbeitet nie zweimal genau gleich, und ohne diese Schwankung
     * klingt die Schleife nach Summer statt nach Maschine.
     */
    const staerke =
      (1 + streu(z, 1) * form.streuung) * (1 + streu(i, 7) * form.streuung * 0.3);
    const versatz =
      (streu(z, 2) * form.streuung + streu(i, 8) * form.streuung * 0.35) * abstand * 0.12;
    const start = Math.round(i * abstand + versatz);

    for (const t of teile) {
      const zerfall = Math.exp(-1 / (t.tau * rate));
      const w = (2 * Math.PI * t.f * (1 + streu(z, t.f) * form.streuung * 0.06)) / rate;
      // Phase je Zylinder leicht verschoben — sonst addieren sich alle
      // Zündungen zu einem sauberen Ton statt zu Schlägen.
      const phase = streu(z, t.f + 1) * Math.PI;
      let huelle = t.a * staerke;
      for (let k = 0; huelle > 1e-4 && k < laenge * 4; k++) {
        buf[(start + k) % laenge] += huelle * Math.sin(w * k + phase);
        huelle *= zerfall;
      }
    }

    /*
     * Der Auspuffstoß. Seine Tonhöhe steht nirgends — sie entsteht daraus,
     * dass er sich im Zündtakt wiederholt, und steigt darum von selbst mit
     * der Drehzahl.
     *
     * Wichtig ist, dass er **zweiseitig** ist: erst Überdruck, dann Unterdruck.
     * Zuerst war er ein reiner Druckberg, und ein einseitiger Pulszug hat
     * einen Gleichanteil — gemessen 0,125 bei 0,318 Effektivwert. Das ist
     * physikalisch kein Auspuff, sondern eine Hupe, und genau so klang es
     * auch. Der Stoß wird darum um seinen eigenen Mittelwert bereinigt.
     */
    if (anteil === "block") {
      const stossLaenge = Math.max(6, Math.round(abstand * form.stossAnteil));
      const stoss = new Float32Array(stossLaenge);
      let summe = 0;
      for (let k = 0; k < stossLaenge; k++) {
        const x = k / stossLaenge;
        // Positive Flanke kurz und steil, negative lang und flach
        stoss[k] = Math.sin(2 * Math.PI * Math.pow(x, 0.72));
        summe += stoss[k];
      }
      const mittel = summe / stossLaenge;
      for (let k = 0; k < stossLaenge; k++) {
        buf[(start + k) % laenge] += (stoss[k] - mittel) * staerke;
      }
    }

    // Einspritzer: ein sehr kurzer Knack direkt vor der Zündung. Ohne ihn
    // klingt der Motor rund statt mechanisch.
    if (anteil === "klopfen") {
      const knackLaenge = Math.max(2, Math.round(rate * 0.0012));
      for (let k = 0; k < knackLaenge; k++) {
        const ab = 1 - k / knackLaenge;
        buf[(start + k) % laenge] += streu(z, 90 + k) * 0.35 * staerke * ab * ab;
      }
    }
  }

  // Gleichanteil restlos raus: Was übrig bleibt, kostet nur Aussteuerung und
  // lässt jeden Kompressor dahinter arbeiten, ohne dass man es hört.
  let mittel = 0;
  for (const x of buf) mittel += x;
  mittel /= laenge;
  let spitze = 0;
  for (let i = 0; i < laenge; i++) {
    buf[i] -= mittel;
    spitze = Math.max(spitze, Math.abs(buf[i]));
  }
  if (spitze > 0) for (let i = 0; i < laenge; i++) buf[i] /= spitze;
  return buf;
}

/**
 * Die Drehzahlen, für die eine Schleife vorgerechnet wird.
 *
 * Zwischen ihnen wird überblendet und die Abspielgeschwindigkeit
 * nachgeführt. Drei Stützstellen reichen: Innerhalb eines Abschnitts muss die
 * Geschwindigkeit höchstens um ein Fünftel verstellt werden, und so weit
 * verschiebt sich der Klang des Blocks noch nicht hörbar.
 */
export const DREHZAHL_STUETZEN = [700, 1150, 1700];

/**
 * Wie viele Arbeitszyklen in einer Schleife stehen.
 *
 * Mit einem einzigen Zyklus wiederholt sich alles exakt alle 167 ms. Exakte
 * Wiederholung ist genau das, was eine Maschine von einem Summer
 * unterscheidet — und zwar zugunsten des Summers: Kein Motor arbeitet zwei
 * Zyklen lang gleich. Sechs Zyklen ergeben rund eine Sekunde, und jeder
 * bekommt seine eigene kleine Abweichung.
 */
export const ZYKLEN_JE_SCHLEIFE = 6;

/** Drehzahl aus Bedienung und Last (1/min). */
export function drehzahlFuer(aktivitaet: number, last: number): number {
  const a = Math.min(Math.max(aktivitaet, 0), 1);
  const l = Math.min(Math.max(last, 0), 1);
  return 720 + 820 * a + 180 * l;
}

/**
 * Überblendung zwischen den Stützstellen.
 *
 * Liefert je Stützstelle ihren Anteil (0..1). Die Summe ist immer 1, damit
 * der Motor beim Gasgeben nicht lauter wird, nur weil zwei Schleifen zugleich
 * laufen.
 */
export function mischung(drehzahl: number, stuetzen = DREHZAHL_STUETZEN): number[] {
  const a = stuetzen.map(() => 0);
  if (drehzahl <= stuetzen[0]) {
    a[0] = 1;
    return a;
  }
  const letzte = stuetzen.length - 1;
  if (drehzahl >= stuetzen[letzte]) {
    a[letzte] = 1;
    return a;
  }
  for (let i = 0; i < letzte; i++) {
    if (drehzahl >= stuetzen[i] && drehzahl <= stuetzen[i + 1]) {
      const t = (drehzahl - stuetzen[i]) / (stuetzen[i + 1] - stuetzen[i]);
      a[i] = 1 - t;
      a[i + 1] = t;
      return a;
    }
  }
  return a;
}
