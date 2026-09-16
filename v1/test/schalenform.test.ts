/**
 * Wächter für die Sichelform: ein Trog, der nach unten dünner wird, ohne Loch.
 *
 * ACHTUNG, WER DAS HIER „REPARIEREN" WILL: Die Regel „von der Aufhängung bis
 * zum Schalenende NUR dünner" ist am 16.09.2026 (E-090) absichtlich gefallen.
 * Sie war für ein flaches Blech geschrieben und hat jeden Versuch verhindert,
 * der Schale Tiefe zu geben — es gibt keine Randhöhe, die sie hält. An ihrer
 * Stelle stehen zwei Prüfungen: „zwischen Schulter und Saum nur dünner" und
 * „hat einen Trog, keinen flachen Teller", letztere mit Gegenprobe. Die
 * Begründung steht bei den Prüfungen selbst.
 *
 * Ansage 13.09.2026, nach mehreren Anläufen: „schau dir die dünnsten Stellen
 * bei den äusseren Zähnen an. die dünnsten Stellen sollten am Ende sein, nicht
 * mittig oben" und, auf das winkelfreie Bild: „die mitte ist zu dün, das hat
 * nichts mit dem blech zu tun".
 *
 * Ursache war die Richtung, in der Wölbung, Strebe und Zahn von der Bahn
 * abgetragen wurden. Die Stationen liegen auf einem Kreis mit
 * y = Cy − R·sin θ und z = Cz + R·cos θ; die Aussennormale ist damit
 * (−sin θ, cos θ). Gerechnet war (+sin θ, cos θ) — bei θ = 0 dasselbe, danach
 * um 2θ verdreht: bei Station 3 (43,8°) fast parallel zur Bahn, an der Spitze
 * (80,2°) rückwärts. Die Strebe lag dadurch nicht AUF dem Blech, sondern längs
 * daneben, und in der Seitenansicht klaffte die Schale in der Mitte auf.
 *
 * Der Test misst, was man sieht: die Silhouette längs der Aussennormalen.
 *
 * Nachtrag 14.09.2026 — der Wächter prüft eine Eigenschaft mehr.
 *
 * Bis dahin lag zwischen Bolzen und Schalenanfang ein Kasten
 * (`06_UNTERE_ANBINDUNG`) und darauf eine Konsole (`06_OBERE_ANBINDUNG`) für
 * das Zylinderauge. Beide trugen „ANBINDUNG" im Namen und wurden von der
 * Silhouette unten AUSGENOMMEN — der Wächter hat den Kopf der Schale also gar
 * nicht angesehen. Genau dort sass der Befund: „der Zinken und dieser
 * Metallblock, wo auch der Hubzylinder angeht, das ist eigentlich EIN
 * Gusselement. Das sind nicht zwei Elemente."
 *
 * Jetzt ist es eins (`06_ZINKEN`), und der Wächter läuft bis an den Bolzen
 * mit: `fersenProfil` misst dieselbe Dicke längs derselben Aussennormalen über
 * die Fersenkurve. Ausgenommen bleiben nur noch die Augen — eine Hülse ist
 * hohl, ihr Loch ist kein Formfehler.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  SCHALEN_ABSCHNITTE,
  ZU,
  baueGreiferschale,
  baueGreiferspitze,
  feineStationen,
  fersenStationen,
  halbbreiteBei,
  mittellinie,
  randhoehe,
  schalenEnde,
  stoffe,
  zahnBahn,
} from "../src/fuenfschalen/teile";

/** Seitensilhouette (Blick längs der Breitenachse) als Maske, 1 mm je Pixel. */
function silhouette(): {
  drin: (z: number, y: number) => boolean;
} {
  const st = stoffe();
  const g = new THREE.Group();
  g.add(baueGreiferschale(st));
  const ende = schalenEnde();
  const spitze = baueGreiferspitze(st);
  spitze.position.set(0, ende.y, ende.z);
  spitze.rotation.x = ende.th;
  g.add(spitze);
  g.updateMatrixWorld(true);

  const tri: Array<Array<[number, number]>> = [];
  const v = new THREE.Vector3();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    /*
     * Nur noch die Augen sind ausgenommen. `ANBINDUNG` und `NAHT` trafen die
     * beiden Quader und die Kehlnähte am Kopf der Schale — seit dem 14.09.2026
     * gibt es beide nicht mehr, und die Ausnahme hätte den neuen Gusskörper
     * nur wieder unsichtbar gemacht.
     */
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

  const PX = 0.001;
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
  return {
    drin: (z, y) => {
      const i = Math.round((z - ax) / PX + 1.5);
      const j = Math.round((y - ay) / PX + 1.5);
      return i >= 0 && j >= 0 && i < W && j < H && maske[j * W + i] === 1;
    },
  };
}

/** Dicke und Lochzahl je Station, längs der Aussennormalen gemessen. */
function profil(): Array<{ k: number; dicke: number; loecher: number }> {
  const { drin } = silhouette();
  const fein = feineStationen(18);
  const BOGEN = fein[1]!.th - fein[0]!.th;
  const R =
    Math.hypot(fein[1]!.y - fein[0]!.y, fein[1]!.z - fein[0]!.z) / (2 * Math.sin(BOGEN / 2));
  const Cy = fein[0]!.y + R * Math.sin(fein[0]!.th);
  const Cz = fein[0]!.z - R * Math.cos(fein[0]!.th);
  const aus: Array<{ k: number; dicke: number; loecher: number }> = [];
  /*
   * Bis ans Schalenende, nicht darüber hinaus.
   *
   * Hier standen `+ 30` Schritte mehr — die Verlängerung des Schalenkreises
   * über die Spitze hinaus, auf der der Zahn bis zum 14.09.2026 weiterlief. Seit
   * er seine eigene Anstellung hat (`zahnAnstellung`), tut er das nicht mehr:
   * Ein Strahl längs der SCHALENnormalen trifft ihn schräg und misst die
   * Schräge als Dicke — gemeldet wurden 104 … 122 mm für einen Zahn, der an
   * keiner Stelle dicker als 39 mm ist. Der Zahn wird deshalb längs SEINER
   * Achse gemessen, in `zahnProfil`.
   */
  for (let i = 0; i <= 18 * SCHALEN_ABSCHNITTE; i += 3) {
    const th = fein[0]!.th + i * BOGEN;
    const px = -(Cz + R * Math.cos(th));
    const py = Cy - R * Math.sin(th);
    const nx = -Math.cos(th);
    const ny = -Math.sin(th);
    let lo = 0;
    let hi = 0;
    let loecher = 0;
    let letzt = -999;
    for (let d = -0.06; d <= 0.32; d += 0.001) {
      if (!drin(px + nx * d, py + ny * d)) continue;
      if (letzt > -900 && d - letzt > 0.0035) loecher++;
      letzt = d;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    const dicke = (hi - lo) * 1000;
    if (dicke < 1) break;
    aus.push({ k: i / 18, dicke, loecher });
  }
  return aus;
}

/**
 * Die FERSE, vom Bolzen bis an Station 0 — Dicke um die Mittellinie herum.
 *
 * Gemessen wird der zusammenhängende Materialstreifen, durch den die
 * Mittellinie läuft: Strahl längs der Aussennormalen, und gezählt nur der
 * Abschnitt, der die Station selbst enthält. Das ist der Unterschied zu
 * `profil`, das einfach von −60 bis +320 mm misst: Am Übergang zur Schale zeigt
 * die Normale fast senkrecht, und ein Strahl nach unten trifft dort die
 * GEGENÜBERLIEGENDE Seite der Sichel. Ohne diese Einschränkung meldete der
 * Wächter 390 mm Dicke und eine Lücke, wo in Wahrheit 190 mm massiver Guss
 * stehen — die Sichel ist nur weiter unten wieder im Weg.
 */
function fersenProfil(): Array<{ t: number; dicke: number; drauf: boolean }> {
  const { drin } = silhouette();
  const aus: Array<{ t: number; dicke: number; drauf: boolean }> = [];
  for (const f of fersenStationen(24)) {
    if (f.t < 0) continue; // die runde Nase hinter dem Bolzen zählt nicht mit
    const px = -f.z;
    const py = f.y;
    /*
     * In der Silhouette ist x = −z und y = y. Die Aussennormale (−sin θ, cos θ)
     * des (y, z)-Rahmens wird damit zu (−cos θ, −sin θ) — dieselbe Umrechnung
     * wie in `profil`.
     */
    const nx = -Math.cos(f.th);
    const ny = -Math.sin(f.th);
    const trifft = (d: number): boolean => drin(px + nx * d, py + ny * d);
    /*
     * Angesetzt wird 5 mm AUSSERHALB der Mittellinie, nicht auf ihr. Ab
     * t = 0,63 liegt die Mittellinie genau auf der Innenhaut des Körpers — auf
     * der Kante also —, und eine Maske mit 1 mm Raster zählt die Kante mal
     * dazu und mal nicht. Fünf Millimeter tiefer im Werkstoff ist die Antwort
     * eindeutig, und für die Dicke fällt es nicht ins Gewicht.
     */
    const ANSATZ = 0.005;
    const lauf = (schritt: number): number => {
      let d = ANSATZ;
      let luft = 0;
      while (Math.abs(d) < 0.32) {
        d += schritt;
        if (trifft(d)) luft = 0;
        else if ((luft += Math.abs(schritt)) > 0.0035) return d - schritt * (luft / Math.abs(schritt));
      }
      return d;
    };
    const drauf = trifft(ANSATZ);
    aus.push({
      t: f.t,
      dicke: drauf ? (lauf(0.001) - lauf(-0.001)) * 1000 : 0,
      drauf,
    });
  }
  return aus;
}

/**
 * Der ZAHN, längs seiner eigenen Achse gemessen.
 *
 * Seit dem 14.09.2026 sitzt er mit `zahnAnstellung()` schräg auf dem
 * Schalenende, damit er bei voll geöffnetem Greifer lotrecht steht (so zeigt
 * ihn die Herstellerzeichnung). Damit läuft er nicht mehr auf dem Kreis der
 * Schale weiter, und `profil` kann ihn nicht mehr mitmessen.
 *
 * Gemessen wird wie an der Ferse: der zusammenhängende Materialstreifen, durch
 * den die Zahnachse läuft. Ein Strahl ohne diese Einschränkung verlässt den
 * Zahn und trifft weiter aussen die Sichel wieder — das wäre eine Lücke, die
 * keine ist.
 */
function zahnProfil(): Array<{ k: number; dicke: number; drauf: boolean }> {
  const { drin } = silhouette();
  const ende = schalenEnde();
  const c = Math.cos(ende.th);
  const s = Math.sin(ende.th);
  const aus: Array<{ k: number; dicke: number; drauf: boolean }> = [];
  for (const f of zahnBahn(6)) {
    /* Aus dem Rahmen der Greiferspitze in den der Schale — dieselbe Montage wie oben. */
    const y = ende.y + f.y * c - f.z * s;
    const z = ende.z + f.y * s + f.z * c;
    const th = f.th + ende.th;
    const px = -z;
    const py = y;
    const nx = -Math.cos(th);
    const ny = -Math.sin(th);
    const trifft = (d: number): boolean => drin(px + nx * d, py + ny * d);
    const lauf = (schritt: number): number => {
      let d = 0;
      let luft = 0;
      while (Math.abs(d) < 0.12) {
        d += schritt;
        if (trifft(d)) luft = 0;
        else if ((luft += Math.abs(schritt)) > 0.0035)
          return d - schritt * (luft / Math.abs(schritt));
      }
      return d;
    };
    const drauf = trifft(0);
    aus.push({ k: f.k, dicke: drauf ? (lauf(0.001) - lauf(-0.001)) * 1000 : 0, drauf });
  }
  return aus;
}

describe("Form der Greiferschale in der Seitenansicht", () => {
  const p = profil();
  const zp = zahnProfil();

  /*
   * ======================================================================
   * 16.09.2026 (E-090): DIE ALTE REGEL IST GEFALLEN — UND ZWAR ABSICHTLICH.
   *
   * Bis heute stand hier: „von der Aufhängung bis zum Schalenende wird der
   * Schattenriss NUR dünner." Die Regel kam aus dem 13.09.2026 („die dünnsten
   * Stellen sollten am Ende sein, nicht mittig oben") und war für ein flaches
   * Blech geschrieben.
   *
   * SIE WAR DER GRUND, WARUM DIE SCHALE NICHT TIEFER WERDEN KONNTE. Jeder
   * aufgestellte Rand macht den Schattenriss dort dicker, wo er aufsteht — das
   * ist sein Zweck. Durchgemessen am 16.09.2026: Es gibt KEINE Randhöhe
   * zwischen 16 mm und 120 mm, die diese Regel hält. Ohne Rand: grün. Damit
   * hat die Regel jeden Anlauf flach gehalten, und Patricks Befund „das sieht
   * immer alles gleich aus" hatte hier seine Ursache.
   *
   * Patrick am 16.09.2026, gefragt, welcher Wächter weichen soll: „Beide."
   *
   * WAS STATTDESSEN STIMMEN MUSS — die Regel fällt nicht ersatzlos weg:
   *   1. Zwischen Schulter und Saum wird der Riss weiter nur dünner. Die zwei
   *      Stellen, an denen er wächst, sind benannt und begründet: der Rand,
   *      der über die erste Station aufsteht, und der Saum, der auf 60 %
   *      verbreitert ist.
   *   2. Der Saum ist deutlich dünner als die Schulter — kein Klotz am Ende.
   *   3. Der Querschnitt ist ein TROG und kein Teller (eigene Prüfung unten).
   * ======================================================================
   */
  it("wird zwischen Schulter und Saum nur dünner", () => {
    /*
     * Gemessen ab Station 1 — davor steht der Rand erst auf (`WANGE_RAMPE`),
     * und bis Station 5, danach verbreitert sich der Saum. Beide Bereiche sind
     * gewollt und je eine eigene Zeile im Bau; dazwischen darf nichts wachsen.
     * Gemessen 246 mm bei k=1 auf 195 mm bei k=5, Schritt für Schritt fallend.
     */
    const mitte = p.filter((s) => s.k >= 1 && s.k <= 5);
    expect(mitte.length, "genug Stützstellen zwischen Schulter und Saum").toBeGreaterThan(20);
    const rueck = mitte.filter((s, i) => i > 0 && s.dicke > mitte[i - 1]!.dicke + 0.5);
    expect(rueck.map((s) => `k=${s.k.toFixed(2)}: ${s.dicke.toFixed(0)} mm`)).toEqual([]);
    /* Und über alles: der Saum ist ein gutes Fünftel dünner als die Schulter. */
    const schulter = p.find((s) => s.k >= 1)!.dicke;
    const saum = p[p.length - 1]!.dicke;
    expect(saum, `Saum ${saum.toFixed(0)} mm gegen Schulter ${schulter.toFixed(0)} mm`).toBeLessThan(
      0.9 * schulter
    );
  });

  it("hat einen TROG, keinen flachen Teller — und meldet, wenn er flach wird", () => {
    /*
     * Die Eigenschaft, die die alte Regel ersetzt. Ein Trog ist daran zu
     * erkennen, dass sein Rand im Verhältnis zur Breite aufsteht; dass er zur
     * Spitze hin schmaler wird, prüft die Zeile darüber.
     *
     * Gemessen (Rand einschließlich Wölbung, gegen die volle Breite an der
     * Stelle): Station 1: 0,35 · Station 3: 0,36 · Station 5: 0,42. Die
     * Schranke steht auf 0,30 — sie lässt den gebauten Stand mit reichlich
     * Luft durch und fängt jedes Zurückfallen in die Fläche.
     */
    for (let k = 1; k <= SCHALEN_ABSCHNITTE; k++) {
      const anteil = randhoehe(k) / (2 * halbbreiteBei(k));
      expect(anteil, `Randanteil an Station ${k}: ${anteil.toFixed(3)}`).toBeGreaterThan(0.3);
    }
  });

  it("GEGENPROBE: das alte flache Profil fiele durch diese Schranke", () => {
    /*
     * Die Gegenprobe MUSS melden, sonst misst die Schranke nichts. Gerechnet
     * wird hier das Profil, das bis zum 16.09.2026 gebaut wurde: nur die
     * Wölbung `halb²/(2r)`, kein aufgestellter Rand. Dieselbe Formel, dieselben
     * Stationen — nur ohne den Rand.
     *
     * Gemessen käme es auf 0,06 bis 0,11 statt auf 0,35 bis 0,42, also überall
     * unter der Schranke von 0,25. Wer den Rand wieder ausbaut, bekommt genau
     * diese Zahlen und der Wächter oben schlägt an.
     */
    const bahn = mittellinie(ZU);
    let groesster = 0;
    for (let k = 1; k <= SCHALEN_ABSCHNITTE; k++) {
      const halb = halbbreiteBei(k);
      const r = Math.max(bahn[k]!.r, 0.12);
      const flach = (halb * halb) / (2 * r);
      groesster = Math.max(groesster, flach / (2 * halb));
    }
    expect(groesster, `flaches Profil käme auf höchstens ${groesster.toFixed(3)}`).toBeLessThan(0.3);
  });

  /*
   * Zwei Prüfungen statt einer — die zweite Hälfte der alten Zusage „bis zur
   * Zahnspitze". Sie ist nicht weggefallen, sie wird nur längs der richtigen
   * Achse gemessen. Der Zahn ist am Sitz im Schalenende vergraben; dort misst
   * der Strahl Schale UND Zahn, deshalb fängt der Vergleich erst hinter dem
   * Sitz an (k ≥ 0,5, rund 45 mm hinter der Trennfuge).
   */
  it("läuft vom Zahnsitz bis zur Zahnspitze nur dünner", () => {
    /*
     * 16.09.2026 (E-090): Toleranz von 0,5 auf 1,5 mm.
     *
     * Nicht der Zahn hat sich geändert — er ist weiterhin 120 mm breit (jetzt
     * aus der Positionsliste statt vom Schalenende). Er sitzt aber auf einem
     * anderen Untergrund: Der Saum ist doppelt so breit und stärker gewölbt,
     * und der Messstrahl läuft dadurch anders durch die Maske. Gemessen bleibt
     * EIN Ausschlag von 1 mm (24 → 25 mm bei k = 2,17) — bei 1 mm Rasterweite
     * ist das eine Pixelkante, kein Absatz. Die Toleranz deckt jetzt genau ein
     * Rasterfeld ab; eine echte Verdickung wäre ein Vielfaches davon.
     */
    const frei = zp.filter((s) => s.k >= 0.5);
    const rueck = frei.filter((s, i) => i > 0 && s.dicke > frei[i - 1]!.dicke + 1.5);
    expect(rueck.map((s) => `k=${s.k.toFixed(2)}: ${s.dicke.toFixed(0)} mm`)).toEqual([]);
  });

  it("setzt den Zahn ohne Absatz auf das Schalenende", () => {
    /* Der Zahn darf am Sitz nicht dicker sein als die Schale, auf der er sitzt. */
    expect(zp[0]!.dicke).toBeLessThan(p[p.length - 1]!.dicke + 1);
  });

  it("ist am Ende am dünnsten, nicht in der Mitte", () => {
    const alle = [...p.map((s) => ({ k: s.k, dicke: s.dicke })), ...zp.map((s) => ({ k: 6 + s.k, dicke: s.dicke }))];
    const duennste = alle.reduce((a, b) => (b.dicke < a.dicke ? b : a));
    expect(duennste.k).toBe(alle[alle.length - 1]!.k);
    expect(p[0]!.dicke).toBeGreaterThan(2.5 * duennste.dicke);
  });

  const f = fersenProfil();

  it("läuft von der Lagerhülse ohne Fuge in die Schale", () => {
    /*
     * Die Eigenschaft, um die es am 14.09.2026 ging: Zinken und Anlenkklotz
     * sind EIN Körper. Geprüft wird das an der Mittellinie — vom Bolzen bis an
     * Station 0 darf keine Station im Leeren liegen, und nirgends darf der
     * Körper auf weniger als 100 mm einschnüren.
     */
    expect(f.length).toBeGreaterThan(20);
    expect(f.filter((s) => !s.drauf).map((s) => s.t.toFixed(2))).toEqual([]);
    expect(f.filter((s) => s.dicke < 100).map((s) => `t=${s.t.toFixed(2)}: ${s.dicke.toFixed(0)} mm`)).toEqual([]);
  });

  it("ist am Bolzen am dicksten — der Kopf trägt, die Spitze schneidet", () => {
    const amBolzen = f[0]!.dicke;
    expect(amBolzen).toBeGreaterThan(Math.max(...p.map((s) => s.dicke)));
    expect(f.filter((s) => s.dicke > amBolzen + 1).map((s) => s.t.toFixed(2))).toEqual([]);
    /* Und er nimmt bis an die Schale spürbar ab — kein Klotz, der einfach aufhört. */
    expect(f[f.length - 1]!.dicke).toBeLessThan(0.8 * amBolzen);
  });

  it("hat kein Loch im Querschnitt — die Schale ist ein Guss", () => {
    /* An den Stirnkappen liegt der Strahl in der Flaeche; die zaehlen nicht. */
    const innen = p.filter(
      (s) => Math.abs(s.k) > 0.01 && Math.abs(s.k - SCHALEN_ABSCHNITTE) > 0.01
    );
    expect(innen.filter((s) => s.loecher > 0).map((s) => s.k)).toEqual([]);
    /*
     * Und im Zahn steht auf jeder Station Werkstoff auf der Achse — ohne die
     * Stirnkappe an der Spitze, wo der Strahl in der Fläche liegt. Das ist
     * dieselbe Ausnahme und derselbe Grund wie eine Zeile höher.
     */
    const letzte = zp[zp.length - 1]!.k;
    expect(zp.filter((s) => s.k < letzte - 0.01 && !s.drauf).map((s) => s.k.toFixed(2))).toEqual([]);
  });
});
