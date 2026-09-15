/**
 * Läuft die Kontur des Zinken durch — vom Lagerauge bis in die Zahnspitze?
 *
 * Patrick am 15.09.2026, vor dem Vorbildfoto mit dem gelben Kringel auf dem
 * Übergang Schale → Lager: „dieser harte Knick im Zahn, den gibt es nicht."
 * Am Vorbild ist das Bauteil EINE Linie, vom Bolzen bis zur Spitze.
 *
 * WIE GEMESSEN WIRD. Die Seitensilhouette der Schale wird als 1-mm-Maske
 * gerastert (dasselbe Verfahren wie in `test/schalenform.test.ts`). Dann läuft
 * ein Strahl längs der AUSSENNORMALEN der Bahn — Ferse, Schalenkreis, Zahnachse
 * nacheinander — und greift ab, wo der Werkstoff anfängt und aufhört. Aus den
 * äußeren Treffern entsteht ein Polygonzug, und dessen RICHTUNGSWECHSEL je
 * Schritt ist die Zahl, um die es geht: Ein Bogen wechselt gleichmäßig wenig,
 * ein Knick springt.
 *
 * Gemessen wird an der GEBAUTEN Schale, nicht an den Bahnfunktionen. Eine
 * Kontur, die nur in der Rechnung glatt ist, nützt nichts.
 *
 * Diese Datei MISST nur. Den Bericht druckt `kontur-bericht.ts` — sie wird
 * von `test/zahnkontur.test.ts` eingebunden, und ein Modul, das beim Laden
 * eine Tabelle ausgibt, macht jede Testausgabe unlesbar.
 */
import * as THREE from "three";
import {
  SCHALEN_ABSCHNITTE,
  baueGreiferschale,
  baueGreiferspitze,
  feineStationen,
  fersenStationen,
  schalenEnde,
  stoffe,
  zahnBahn,
} from "../../src/fuenfschalen/teile";

const GRAD = 180 / Math.PI;

/* ------------------------------------------------------------- Silhouette */

/**
 * Seitensilhouette als Maske, 0,5 mm je Pixel.
 *
 * Feiner als die 1 mm des Wächters: Hier wird ein RICHTUNGSWECHSEL gesucht,
 * und der ist eine Ableitung — das Raster geht doppelt in seinen Fehler ein.
 *
 * `anstellung` erlaubt, denselben Zinken mit einem anders angesetzten Zahn zu
 * bauen, ohne `teile.ts` anzufassen: `baueGreiferspitze(st, offen)` leitet die
 * Anstellung aus `offen` ab, also wird der Wert eingesetzt, der sie ergibt.
 */
function silhouette(anstellung: number, PX = 0.0005): (z: number, y: number) => boolean {
  const st = stoffe();
  const g = new THREE.Group();
  g.add(baueGreiferschale(st));
  const ende = schalenEnde();
  /* zahnAnstellung(offen) = offen − schalenEnde().th  →  offen = anstellung + th */
  const spitze = baueGreiferspitze(st, anstellung + ende.th);
  spitze.position.set(0, ende.y, ende.z);
  spitze.rotation.x = ende.th;
  g.add(spitze);
  g.updateMatrixWorld(true);

  const tri: Array<Array<[number, number]>> = [];
  const v = new THREE.Vector3();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    /* Die Augen sind hohl — ihr Loch ist kein Formfehler. */
    if (!m.isMesh || /AUGE/.test(m.name)) return;
    const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const p: Array<[number, number]> = [];
      for (let j = 0; j < 3; j++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j).applyMatrix4(m.matrixWorld);
        p.push([-v.z, v.y]);
      }
      tri.push(p);
    }
  });

  let ax = Infinity;
  let ay = Infinity;
  let bx = -Infinity;
  let by = -Infinity;
  for (const t of tri)
    for (const q of t) {
      ax = Math.min(ax, q[0]!);
      bx = Math.max(bx, q[0]!);
      ay = Math.min(ay, q[1]!);
      by = Math.max(by, q[1]!);
    }
  const W = Math.ceil((bx - ax) / PX) + 4;
  const H = Math.ceil((by - ay) / PX) + 4;
  const maske = new Uint8Array(W * H);
  for (const t of tri) {
    const [a, b, c] = t.map((q) => [(q[0]! - ax) / PX + 2, (q[1]! - ay) / PX + 2]) as [
      [number, number],
      [number, number],
      [number, number],
    ];
    const fl = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(fl) < 1e-12) continue;
    for (
      let y = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
      y <= Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
        x <= Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
        x++
      ) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / fl;
        const w1 = ((c[0] - b[0]) * (py - b[1]) - (px - b[0]) * (c[1] - b[1])) / fl;
        const w2 = ((a[0] - c[0]) * (py - c[1]) - (px - c[0]) * (a[1] - c[1])) / fl;
        if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) maske[y * W + x] = 1;
      }
  }
  return (z, y) => {
    const i = Math.round((z - ax) / PX + 1.5);
    const j = Math.round((y - ay) / PX + 1.5);
    return i >= 0 && j >= 0 && i < W && j < H && maske[j * W + i] === 1;
  };
}

/* ------------------------------------------------------------------ Bahn */

/* ------------------------------------------- Der Schalenkreis als Bezug */

/**
 * Mittelpunkt und Radius des Kreises, auf dem die Schale liegt — in der
 * Seitenansicht (x = −z, y = y).
 *
 * WARUM DIESER BEZUG. Der Knick wird als Bruch in der AUSSENKONTUR gesucht,
 * und dafür braucht es eine Bezugslinie, die von der gesuchten Größe
 * unabhängig ist. Die Bahn des Zahns ist es nicht — sie dreht sich mit ihm,
 * und eine Kontur, längs ihrer eigenen gedrehten Normalen gemessen, sieht
 * immer gerade aus. Der erste Anlauf hat genau daran den Knick VERKEHRT HERUM
 * gemeldet (8,46° für die glatte Form, 3,44° für die geknickte).
 *
 * Der Kreis der Schale steht fest, ganz gleich wie der Zahn sitzt. Über ihm
 * ist die Aussenkontur eine Funktion r(θ), und ein Knick ist ein Sprung in
 * ihrer Steigung.
 */
function schalenkreis(): { cz: number; cy: number; R: number } {
  const fein = feineStationen(18);
  const bogen = fein[1]!.th - fein[0]!.th;
  const R = Math.hypot(fein[1]!.y - fein[0]!.y, fein[1]!.z - fein[0]!.z) / (2 * Math.sin(bogen / 2));
  const Cy = fein[0]!.y + R * Math.sin(fein[0]!.th);
  const Cz = fein[0]!.z - R * Math.cos(fein[0]!.th);
  return { cz: -Cz, cy: Cy, R };
}

export interface Aussenpunkt {
  /** Stationsmaß auf dem Schalenkreis: 0 = Station 0, 6 = Schalenende. */
  k: number;
  /** Abstand der Aussenkontur vom Kreismittelpunkt (m). */
  r: number;
}

/**
 * Die Aussenkontur über dem Schalenkreis, r(k).
 *
 * Für jedes Stationsmaß ein Strahl vom Kreismittelpunkt nach aussen; genommen
 * wird der weiteste Treffer im Werkstoff. Läuft über das Schalenende hinaus
 * bis ans Ende des Zahns — dort liegt der Zahn bei Variante B auf demselben
 * Kreis und bei Variante A daneben, und genau das soll die Kurve zeigen.
 */
export function aussenkontur(anstellung: number, bis = 7.2, px = 0.0005): Aussenpunkt[] {
  const drin = silhouette(anstellung, px);
  const { cz, cy, R } = schalenkreis();
  const fein = feineStationen(18);
  const bogen = fein[1]!.th - fein[0]!.th;
  const aus: Aussenpunkt[] = [];
  for (let k = 0; k <= bis; k += 1 / 60) {
    const th = fein[0]!.th + k * 18 * bogen;
    /* Aussennormale des Kreises in der Seitenansicht — wie in `profil`. */
    /*
     * Aussennormale des Kreises in der Seitenansicht — dieselbe Umrechnung wie
     * in `profil` (`test/schalenform.test.ts`): Der Kreispunkt liegt bei
     * Mittelpunkt + Normale · R, nicht minus. Beim ersten Anlauf stand hier ein
     * Minus, der Strahl lief nach innen und traf nie Werkstoff.
     */
    const nz = -Math.cos(th);
    const ny = -Math.sin(th);
    let weit = 0;
    for (let d = R - 0.02; d <= R + 0.36; d += 0.0005) {
      if (drin(cz + nz * d, cy + ny * d)) weit = d;
    }
    if (weit > 0) aus.push({ k, r: weit });
  }
  return aus;
}

/**
 * Der Knick an einer Fuge (Grad).
 *
 * Über dem Kreis ist die Aussenkontur r(k). Eine Gerade durch r(k) vor und
 * eine hinter der Fuge; die Differenz ihrer Steigungen, umgerechnet in einen
 * Winkel über die Bogenlänge, ist der Richtungswechsel der Kontur.
 *
 * Eine Ausgleichsgerade, weil das Netz Facetten hat: `feineStationen(3)` legt
 * alle 0,33 Stationen eine Kante, und der Bogen wechselt dort um 5,83° auf
 * einen Schlag. Punkt für Punkt gemessen war dieses Rauschen mit 9,30° größer
 * als der gesuchte Knick — eine Ausgleichsgerade mittelt es weg, weil die
 * Facetten abwechselnd darüber und darunter liegen.
 */
export function knickBei(k: Aussenpunkt[], fuge: number, luecke = 0.1, spanne = 0.55): number {
  const { R } = schalenkreis();
  const fein = feineStationen(18);
  const bogen = (fein[1]!.th - fein[0]!.th) * 18; // Bogen je Stationsmaß (rad)
  const steigung = (von: number, bis: number): number => {
    const p = k.filter((q) => q.k >= von && q.k <= bis);
    if (p.length < 4) return NaN;
    const n = p.length;
    const mk = p.reduce((a, q) => a + q.k, 0) / n;
    const mr = p.reduce((a, q) => a + q.r, 0) / n;
    let sk = 0;
    let sr = 0;
    for (const q of p) {
      sk += (q.k - mk) ** 2;
      sr += (q.k - mk) * (q.r - mr);
    }
    return sr / sk; // dr / dk
  };
  const a = steigung(fuge - luecke - spanne, fuge - luecke);
  const b = steigung(fuge + luecke, fuge + luecke + spanne);
  /*
   * dr/dk gegen die Bogenlänge R·bogen je Stationsmaß — das ist der Tangens
   * des Winkels, um den die Kontur von der Kreistangente abweicht.
   */
  return Math.abs(Math.atan2(b, R * bogen) - Math.atan2(a, R * bogen)) * GRAD;
}

export interface Stelle {
  /** Wegmarke: −1…0 Ferse, 0…6 Schale, 6…7 Zahn. */
  s: number;
  /** Was für ein Stück — für die Ausgabe. */
  teil: string;
  /** Aussenkontur (z, y) in der Seitenansicht (x = −z). */
  aussen: [number, number] | null;
  /** Innenkontur (z, y). */
  innen: [number, number] | null;
  /** Dicke längs der Aussennormalen (mm). */
  dicke: number;
}

/**
 * Die Bahn des Bauteils, in EINEM Zug: Ferse, Schalenkreis, Zahnachse.
 *
 * Jede der drei kommt aus ihrer eigenen Quelle in `teile.ts`, damit die
 * Messung nicht auf einer Nachbildung läuft.
 */
function bahn(anstellung: number): Array<{ s: number; teil: string; px: number; py: number; nx: number; ny: number }> {
  const aus: Array<{ s: number; teil: string; px: number; py: number; nx: number; ny: number }> = [];
  for (const f of fersenStationen(40)) {
    if (f.t < 0) continue;
    aus.push({ s: f.t - 1, teil: "Ferse", px: -f.z, py: f.y, nx: -Math.cos(f.th), ny: -Math.sin(f.th) });
  }
  const fein = feineStationen(30);
  for (const f of fein) {
    if (f.k === 0) continue; // Station 0 kommt aus der Ferse
    aus.push({ s: f.k, teil: "Schale", px: -f.z, py: f.y, nx: -Math.cos(f.th), ny: -Math.sin(f.th) });
  }
  const ende = schalenEnde();
  const c = Math.cos(ende.th);
  const sn = Math.sin(ende.th);
  for (const f of zahnBahn(8, anstellung + ende.th)) {
    if (f.k === 0) continue; // der Sitz liegt schon im Schalenende
    const y = ende.y + f.y * c - f.z * sn;
    const z = ende.z + f.y * sn + f.z * c;
    const th = f.th + ende.th;
    aus.push({ s: SCHALEN_ABSCHNITTE + f.k, teil: "Zahn", px: -z, py: y, nx: -Math.cos(th), ny: -Math.sin(th) });
  }
  return aus;
}

/** Aussen- und Innenkontur längs der Bahn abgreifen. */
export function kontur(anstellung: number, px = 0.0005): Stelle[] {
  const drin = silhouette(anstellung, px);
  return bahn(anstellung).map(({ s, teil, px, py, nx, ny }) => {
    /*
     * Nur der zusammenhängende Streifen um die Bahn herum — derselbe Grund wie
     * in `fersenProfil`: Am eingerollten Ende trifft ein durchlaufender Strahl
     * weiter aussen die GEGENÜBERLIEGENDE Seite der Sichel wieder.
     */
    const trifft = (d: number): boolean => drin(px + nx * d, py + ny * d);
    /*
     * Angesetzt wird 5 mm AUSSERHALB der Bahn, nicht auf ihr. Die Mittellinie
     * ist über weite Strecken genau die Innenhaut des Körpers — sie liegt also
     * auf der Kante, und eine Maske zählt eine Kante mal dazu und mal nicht.
     * Ohne diesen Versatz meldete die Messung acht „Lücken" mitten in einer
     * durchgehenden Schale. Derselbe Kunstgriff und derselbe Grund wie in
     * `fersenProfil` (`test/schalenform.test.ts`).
     */
    const ANSATZ = 0.005;
    const lauf = (schritt: number): number => {
      let d = ANSATZ;
      let luft = 0;
      while (Math.abs(d) < 0.34) {
        d += schritt;
        if (trifft(d)) luft = 0;
        else if ((luft += Math.abs(schritt)) > 0.003) return d - schritt * (luft / Math.abs(schritt));
      }
      return d;
    };
    if (!trifft(ANSATZ)) return { s, teil, aussen: null, innen: null, dicke: 0 };
    const hi = lauf(0.0005);
    const lo = lauf(-0.0005);
    return {
      s,
      teil,
      aussen: [px + nx * hi, py + ny * hi],
      innen: [px + nx * lo, py + ny * lo],
      dicke: (hi - lo) * 1000,
    };
  });
}

/**
 * Richtung der Aussenkontur über einen Abschnitt, als Ausgleichsgerade (rad).
 *
 * WARUM NICHT PUNKT FÜR PUNKT. Die erste Fassung hat den Richtungswechsel
 * zwischen zwei 20-mm-Sehnen gemessen. Das Netz der Schale hat aber Facetten —
 * `feineStationen(3)` legt alle 0,33 Stationen eine Kante, und der Bogen
 * wechselt dort um 5,83° auf einen Schlag. Gemessen wurden dadurch bis zu
 * **9,30° Rauschen mitten in der glatten Schale**, mehr als der gesuchte Knick
 * von 8,3° am Sitz. Ein Maß, dessen Rauschen größer ist als sein Signal, ist
 * keins.
 *
 * Eine Ausgleichsgerade über 40 mm mittelt die Facetten weg — sie liegen
 * abwechselnd darüber und darunter — und lässt einen echten Richtungswechsel
 * stehen, weil der alle Punkte einer Seite verschiebt.
 */
function richtung(k: Stelle[], von: number, bis: number): number {
  const p = k.filter((q) => q.aussen && q.s >= von && q.s <= bis).map((q) => q.aussen!);
  if (p.length < 3) return NaN;
  const n = p.length;
  const mx = p.reduce((a, q) => a + q[0], 0) / n;
  const my = p.reduce((a, q) => a + q[1], 0) / n;
  /* Hauptachse der Punktwolke — trägt auch senkrechte Abschnitte. */
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const q of p) {
    sxx += (q[0] - mx) ** 2;
    syy += (q[1] - my) ** 2;
    sxy += (q[0] - mx) * (q[1] - my);
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

/**
 * Der Knick an einer Fuge (Grad): Winkel zwischen der Kontur davor und danach.
 *
 * `lueckeVon`/`lueckeBis` lassen die Fuge selbst aus — dort liegen Punkte
 * beider Seiten gemischt, und die würden den Knick kleinrechnen.
 */
export function knick(
  k: Stelle[],
  lueckeVon: number,
  lueckeBis: number,
  spanne = 0.55
): number {
  const a = richtung(k, lueckeVon - spanne, lueckeVon);
  const b = richtung(k, lueckeBis, lueckeBis + spanne);
  let d = b - a;
  while (d > Math.PI / 2) d -= Math.PI;
  while (d < -Math.PI / 2) d += Math.PI;
  return Math.abs(d) * GRAD;
}

/** Der Zahnsitz auf dem Stationsmaß des Schalenkreises. */
export const ZAHNSITZ = 6;

/**
 * Wie scharf der Arm seine Dicke verliert — die Zahl zur Schulter.
 *
 * Gemessen in Fenstern von einem Zehntel der Fersenkurve, nicht von Stelle zu
 * Stelle: Die Maske hat 0,5 mm, und ein Abfall von 2 mm je Stelle ist damit
 * zur Hälfte Rundung. Über ein Zehntel (rund 30 mm) mittelt sich das weg.
 *
 * Ein gleichmäßiger Übergang hat ein Verhältnis um 1,5 — das ist die steilste
 * Stelle einer Glättung gegen ihren Mittelwert. Ein Knie sticht darüber
 * heraus; das Knie vom 14.09.2026 lag bei 3,8.
 */
export function schulterstufe(k: Stelle[]): {
  groesst: number;
  bei: number;
  mittel: number;
  verhaeltnis: number;
} {
  const ferse = k.filter((q) => q.teil === "Ferse");
  const fenster: Array<{ t: number; ab: number }> = [];
  for (let i = 0; i < 10; i++) {
    const von = ferse.find((q) => q.s + 1 >= i / 10);
    const bis = [...ferse].reverse().find((q) => q.s + 1 <= (i + 1) / 10);
    if (!von || !bis) continue;
    fenster.push({ t: i / 10, ab: von.dicke - bis.dicke });
  }
  const groesst = fenster.reduce((x, y) => (y.ab > x.ab ? y : x));
  const mittel = fenster.reduce((a, q) => a + Math.max(0, q.ab), 0) / fenster.length;
  return {
    groesst: groesst.ab,
    bei: groesst.t,
    mittel,
    verhaeltnis: groesst.ab / Math.max(mittel, 1e-6),
  };
}
