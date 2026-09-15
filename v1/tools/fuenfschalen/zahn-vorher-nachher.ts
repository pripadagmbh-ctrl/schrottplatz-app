/**
 * Vorher gegen nachher: der Zahn des Fuenfschalengreifers, E-069.
 *
 * Anlass, woertlich (Patrick, 15.09.2026):
 *
 *   „Also, wir sind uns doch einig, dass die Zacken direkt an der Traverse
 *    sein sollen. Und das ist aktuell nicht der Fall. Deshalb weiss ich
 *    ueberhaupt nicht, woran der Agent gearbeitet hat. Zeigt mir einen
 *    Vorher-Nachher-Vergleich."
 *
 * Dieses Blatt beantwortet die ZWEITE Haelfte des Satzes: Was wurde am
 * 15.09.2026 wirklich gebaut? Die erste Haelfte — die Mittelsaeule zwischen
 * Traverse und Schalenbolzen — beantwortet `mittelsaeule.ts`; sie ist NICHT
 * gebaut worden, und das Blatt hier verschweigt es nicht.
 *
 * DIE REGEL DIESES BLATTES: EHRLICH ZEICHNEN.
 *
 * Patricks Verdacht ist, es sei gar nichts gebaut worden. Ein geschoentes
 * Blatt wuerde diesen Verdacht bestaetigen, nicht ausraeumen. Deshalb
 *
 *   - stehen beide Spalten in JEDER Zeile im SELBEN Massstab,
 *   - liegt in der dritten Spalte die eine Form UEBER der anderen, damit man
 *     sieht, wie viel sich ueberhaupt bewegt,
 *   - steht der Unterschied als ZAHL da: wie weit die Zahnspitze wandert und
 *     wie viel Prozent der Schattenflaeche ueberhaupt betroffen sind,
 *   - und steht der Satz „der Unterschied ist klein" auf dem Blatt, wenn er
 *     klein ist. Er ist klein.
 *
 * Gemessen wird am GEBAUTEN NETZ ueber `zahnformen.ts` — dieselbe Quelle wie
 * `zahnknick.ts`, keine abgeschriebene Zahl.
 *
 * Aufruf:   npx vite-node tools/fuenfschalen/zahn-vorher-nachher.ts
 * Ergebnis: docs/f5-zahn-vorher-nachher-2026-09-15.svg + Tabelle auf der Konsole
 */
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { FORMEN, GRAD, baue, miss, zahnspitze, type Form, type Mass } from "./zahnformen";
import {
  rissFlaeche,
  rissTeilung,
  rissUnterschied,
  schattenriss,
  type Strecke,
} from "../schattenriss";
import { TRAVERSE_Y, STEMPEL_AUGE } from "../../src/fuenfschalen/teile";

/** Nur A (bis 15.09.) und B (seit E-069) — C ist verworfen und gehoert nicht hierher. */
const VORHER = FORMEN[0]!;
const NACHHER = FORMEN[1]!;

/* ----------------------------------------------------------------- Messen */

interface Unterschied {
  /** Weg der Zahnspitze zwischen A und B (m). */
  spitzeOffen: number;
  spitzeZu: number;
  /** Schattenflaeche des ganzen Greifers (m²) und der Teil, der sich unterscheidet. */
  flaecheOffen: [number, number, number];
  flaecheZu: [number, number, number];
  /** Dasselbe nur fuer den Zahn (`SHELL_TIP_01`). */
  zahnOffen: [number, number, number];
}

/**
 * Wie viel zweier Risse deckungsgleich ist (0..1).
 *
 * Schnittmenge geteilt durch Vereinigungsmenge, aus den drei gemessenen
 * Flaechen. Diese Zahl ist ehrlicher als „x Prozent Unterschied": Bei einem
 * kleinen Teil, das sich dreht, kann die Differenzflaeche GROESSER werden als
 * das Teil selbst — beim Zahn ist genau das der Fall, und „129 % Unterschied"
 * liest sich dann wie ein Fehler statt wie ein Befund.
 */
function deckung([a, b, diff]: [number, number, number]): number {
  const schnitt = (a + b - diff) / 2;
  const vereinigung = (a + b + diff) / 2;
  return vereinigung > 0 ? schnitt / vereinigung : 1;
}

function vergleiche(): Unterschied {
  const a = baue(VORHER);
  const b = baue(NACHHER);

  const weg = (t: number): number => zahnspitze(a, t).distanceTo(zahnspitze(b, t));

  const flaechen = (t: number, teil: boolean, zeile: number): [number, number, number] => {
    a.setOeffnung(t);
    b.setOeffnung(t);
    const wa = teil ? a.schalen[0]!.gelenk.getObjectByName("SHELL_TIP_01")! : a.wurzel;
    const wb = teil ? b.schalen[0]!.gelenk.getObjectByName("SHELL_TIP_01")! : b.wurzel;
    const ra = schattenriss(wa, zeile);
    const rb = schattenriss(wb, zeile);
    return [rissFlaeche(ra), rissFlaeche(rb), rissUnterschied(ra, rb)];
  };

  return {
    spitzeOffen: weg(1),
    spitzeZu: weg(0),
    flaecheOffen: flaechen(1, false, 0.002),
    flaecheZu: flaechen(0, false, 0.002),
    zahnOffen: flaechen(1, true, 0.0005),
  };
}

/* ------------------------------------------------------------------ Blatt */

const BREITE = 1560;
const HOEHE = 2110;
const SPALTE = [270, 780, 1290];
const FELD_B = 470;
const FARBE = {
  papier: "#f4f2ee",
  feld: "#ffffff",
  linie: "#1d2124",
  grau: "#6b7378",
  hilfe: "#b3bac0",
  beton: "#8a6a3a",
  gut: "#1d6f34",
  schlecht: "#9c2717",
  vorher: "#3f4a52",
  nachher: "#1f5d86",
  /* Was beide Formen gemeinsam haben — tritt zurueck, damit der Rest auffaellt. */
  gemeinsam: "#d8d4cc",
};

/** Massstaebe — je Zeile EINER fuer alle drei Spalten, sonst taeuscht das Blatt. */
const PX_GANZ = 128;
const PX_DETAIL = 520;

const teile: string[] = [];

const T = (
  x: number,
  y: number,
  s: string,
  groesse = 16,
  f = FARBE.linie,
  anker = "middle",
  fett = false
): void => {
  teile.push(
    `<text x="${x}" y="${y}" font-size="${groesse}" fill="${f}" text-anchor="${anker}" ` +
      `font-family="Helvetica,Arial,sans-serif"${fett ? ' font-weight="700"' : ""}>` +
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</text>"
  );
};

function male(st: Strecke[], mx: number, my: number, px: number, farbe: string, deckung = 1): void {
  const d = st
    .map(
      ([z, y, b, h]) =>
        `M${(mx + z * px).toFixed(1)},${(my - y * px - h * px).toFixed(1)}` +
        `h${(b * px).toFixed(1)}v${(h * px).toFixed(1)}h${(-b * px).toFixed(1)}Z`
    )
    .join("");
  teile.push(`<path d="${d}" fill="${farbe}" fill-opacity="${deckung}"/>`);
}

function feld(x: number, y: number, w: number, h: number, titel: string): void {
  teile.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FARBE.feld}" stroke="#d6d2ca" rx="6"/>`
  );
  if (titel) T(x + 12, y + 20, titel, 13, FARBE.grau, "start");
}

/**
 * Passt der Riss ins Feld? — die Gegenprobe zum Beschnitt.
 *
 * `beschnitten` schneidet ab, was nicht hineinpasst. Bei den Vergroesserungen
 * ist das gewollt; beim GANZEN Greifer waere es eine Luege, weil dann ein Teil
 * der Form fehlt, ohne dass man es sieht. Deshalb wird jeder Riss nachgemessen
 * und Ueberstand gemeldet — mit Zahl, nicht als Gefuehl.
 */
const ueberstand: string[] = [];
function passtInsFeld(
  wo: string,
  st: Strecke[],
  mx: number,
  my: number,
  px: number,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [z, yy, b, hh] of st) {
    x0 = Math.min(x0, mx + z * px);
    x1 = Math.max(x1, mx + (z + b) * px);
    y0 = Math.min(y0, my - (yy + hh) * px);
    y1 = Math.max(y1, my - yy * px);
  }
  const raus = Math.max(x - x0, x1 - (x + w), y - y0, y1 - (y + h));
  if (raus > 0.5) ueberstand.push(`${wo}: ${raus.toFixed(0)} px ueber den Feldrand`);
}

let clipNr = 0;
function beschnitten(x: number, y: number, w: number, h: number, zeichne: () => void): void {
  const id = `k${clipNr++}`;
  teile.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`);
  teile.push(`<g clip-path="url(#${id})">`);
  zeichne();
  teile.push("</g>");
}

/* ------------------------------------------------------------------ Zeilen */

interface Spalte {
  form: Form;
  mass: Mass;
  farbe: string;
  g: ReturnType<typeof baue>;
}

/** Zeile 1 und 2: ganzer Greifer, mit Aufhaengelinie und Betonkante. */
function zeileGanz(
  y: number,
  h: number,
  titel: string,
  oeffnung: (s: Spalte) => number,
  spalten: Spalte[],
  massband: boolean
): void {
  const oben = y + 52; // Hoehe der Aufhaengung im Bild
  /* Drei Spalten, aber nur zwei Formen: die dritte legt beide uebereinander. */
  SPALTE.forEach((mx, i) => {
    const s = spalten[Math.min(i, 1)]!;
    feld(mx - FELD_B / 2, y, FELD_B, h, i === 2 ? "" : titel);
    beschnitten(mx - FELD_B / 2 + 2, y + 26, FELD_B - 4, h - 28, () => {
      const zeichne = (sp: Spalte, deckung: number): void => {
        sp.g.setOeffnung(oeffnung(sp));
        const st = schattenriss(sp.g.wurzel, 0.005);
        passtInsFeld(
          `${titel} / ${sp.form.kurz}`,
          st,
          mx,
          oben,
          PX_GANZ,
          mx - FELD_B / 2 + 2,
          y + 26,
          FELD_B - 4,
          h - 28
        );
        male(st, mx, oben, PX_GANZ, sp.farbe, deckung);
      };
      if (i === 2) {
        spalten[0]!.g.setOeffnung(oeffnung(spalten[0]!));
        spalten[1]!.g.setOeffnung(oeffnung(spalten[1]!));
        const t = rissTeilung(
          schattenriss(spalten[0]!.g.wurzel, 0.005),
          schattenriss(spalten[1]!.g.wurzel, 0.005)
        );
        male(t.beides, mx, oben, PX_GANZ, FARBE.gemeinsam);
        male(t.nurA, mx, oben, PX_GANZ, FARBE.vorher);
        male(t.nurB, mx, oben, PX_GANZ, FARBE.nachher);
      } else {
        zeichne(s, 1);
      }
    });
    /* Aufhaengung: der Punkt, an dem der Greifer am Stiel haengt. */
    teile.push(
      `<line x1="${mx - 40}" y1="${oben}" x2="${mx + 40}" y2="${oben}" stroke="${FARBE.hilfe}" stroke-width="2"/>`
    );
    /* Betonkante: dorthin setzt der Arm ab — tiefster Punkt ueber den Schliessweg. */
    const m = i === 2 ? spalten[1]!.mass : s.mass;
    const betonY = oben + m.maxTiefe * PX_GANZ;
    if (i === 2) {
      const bA = oben + spalten[0]!.mass.maxTiefe * PX_GANZ;
      teile.push(
        `<line x1="${mx - FELD_B / 2 + 12}" y1="${bA}" x2="${mx + FELD_B / 2 - 12}" y2="${bA}" ` +
          `stroke="${FARBE.vorher}" stroke-width="2" stroke-dasharray="6 5"/>`
      );
    }
    teile.push(
      `<line x1="${mx - FELD_B / 2 + 12}" y1="${betonY}" x2="${mx + FELD_B / 2 - 12}" y2="${betonY}" ` +
        `stroke="${FARBE.beton}" stroke-width="4"/>`
    );
    T(mx + FELD_B / 2 - 16, betonY + 18, "Beton", 12, FARBE.beton, "end");
    if (massband && i < 2) {
      const zahnY = oben + m.tiefeZu * PX_GANZ;
      teile.push(
        `<line x1="${mx - 160}" y1="${zahnY}" x2="${mx - 160}" y2="${betonY}" stroke="${FARBE.schlecht}" stroke-width="3"/>` +
          `<line x1="${mx - 172}" y1="${zahnY}" x2="${mx - 148}" y2="${zahnY}" stroke="${FARBE.schlecht}" stroke-width="3"/>`
      );
      T(
        mx - 178,
        (zahnY + betonY) / 2 + 5,
        `${(m.schwebt * 100).toFixed(1)} cm`,
        16,
        FARBE.schlecht,
        "end",
        true
      );
    }
  });
}

/** Zeile 3 und 4: der Uebergang Schale → Zahn, vergroessert. */
function zeileDetail(
  y: number,
  h: number,
  titel: string,
  t: number,
  spalten: Spalte[]
): void {
  const sitz = new THREE.Vector3();
  spalten[0]!.g.setOeffnung(t);
  spalten[0]!.g.wurzel.updateMatrixWorld(true);
  spalten[0]!.g.schalen[0]!.gelenk.getObjectByName("SHELL_TIP_01")!.getWorldPosition(sitz);
  /* Der Sitz liegt im oberen Drittel — darunter braucht der 25-cm-Zahn Platz. */
  const my = y + h * 0.38;
  SPALTE.forEach((mx, i) => {
    const s = spalten[Math.min(i, 1)]!;
    feld(mx - FELD_B / 2, y, FELD_B, h, i === 2 ? "" : titel);
    beschnitten(mx - FELD_B / 2 + 2, y + 26, FELD_B - 4, h - 28, () => {
      const zeichne = (sp: Spalte, deckung: number): void => {
        sp.g.setOeffnung(t);
        male(
          schattenriss(sp.g.schalen[0]!.gelenk, 0.0012),
          mx - sitz.z * PX_DETAIL,
          my + sitz.y * PX_DETAIL,
          PX_DETAIL,
          sp.farbe,
          deckung
        );
      };
      if (i === 2) {
        spalten[0]!.g.setOeffnung(t);
        spalten[1]!.g.setOeffnung(t);
        const teilung = rissTeilung(
          schattenriss(spalten[0]!.g.schalen[0]!.gelenk, 0.0012),
          schattenriss(spalten[1]!.g.schalen[0]!.gelenk, 0.0012)
        );
        const ox = mx - sitz.z * PX_DETAIL;
        const oy = my + sitz.y * PX_DETAIL;
        male(teilung.beides, ox, oy, PX_DETAIL, FARBE.gemeinsam);
        male(teilung.nurA, ox, oy, PX_DETAIL, FARBE.vorher);
        male(teilung.nurB, ox, oy, PX_DETAIL, FARBE.nachher);
      } else {
        zeichne(s, 1);
      }
    });
    /* Der Sitz — die Stelle, um die es geht. */
    teile.push(
      `<circle cx="${mx}" cy="${my}" r="30" fill="none" stroke="${
        i === 0 ? FARBE.schlecht : FARBE.gut
      }" stroke-width="2.5"/>`
    );
  });
}

/* ------------------------------------------------------------------ Ablauf */

function main(): void {
  const spalten: Spalte[] = [
    { form: VORHER, mass: miss(VORHER), farbe: FARBE.vorher, g: baue(VORHER) },
    { form: NACHHER, mass: miss(NACHHER), farbe: FARBE.nachher, g: baue(NACHHER) },
  ];
  const u = vergleiche();
  const [A, B] = [spalten[0]!.mass, spalten[1]!.mass];

  /* --------------------------------------------------- Tabelle auf Konsole */
  const z = (n: string, a: string, b: string): string =>
    `  ${n.padEnd(36)}${a.padStart(14)}${b.padStart(14)}`;
  console.log("Der Zahn des Fuenfschalengreifers — vorher gegen nachher (E-069)\n");
  console.log(z("", "VORHER", "NACHHER"));
  console.log("  " + "-".repeat(64));
  console.log(z("Zahn gegen Schalenende (Grad)", (VORHER.anstellung * GRAD).toFixed(2), "0.00"));
  console.log(z("Schwebehoehe geschlossen (cm)", (A.schwebt * 100).toFixed(1), (B.schwebt * 100).toFixed(1)));
  console.log(z("Maulweite offen (m)", A.maul.toFixed(3), B.maul.toFixed(3)));
  console.log(z("Korbtiefe geschlossen (m)", A.korbtiefe.toFixed(4), B.korbtiefe.toFixed(4)));
  console.log(z("Zahnwinkel bei Bodenkontakt (Grad)", A.zahnBoden.toFixed(1), B.zahnBoden.toFixed(1)));
  console.log("");
  console.log("  WIE GROSS IST DER UNTERSCHIED WIRKLICH?");
  console.log(`  Zahnspitze wandert, offen        : ${(u.spitzeOffen * 1000).toFixed(0)} mm`);
  console.log(`  Zahnspitze wandert, geschlossen  : ${(u.spitzeZu * 1000).toFixed(0)} mm`);
  console.log(
    `  Ganzer Greifer offen, deckungsgleich : ${(deckung(u.flaecheOffen) * 100).toFixed(1)} %` +
      `  (${u.flaecheOffen[2].toFixed(4)} von ${u.flaecheOffen[0].toFixed(4)} m2 daneben)`
  );
  console.log(
    `  Ganzer Greifer zu, deckungsgleich    : ${(deckung(u.flaecheZu) * 100).toFixed(1)} %` +
      `  (${u.flaecheZu[2].toFixed(4)} m2 daneben)`
  );
  console.log(
    `  Nur der Zahn, offen, deckungsgleich  : ${(deckung(u.zahnOffen) * 100).toFixed(1)} %` +
      `  (${u.zahnOffen[2].toFixed(4)} von ${u.zahnOffen[0].toFixed(4)} m2 daneben)`
  );
  console.log("");
  console.log(`  NICHT GEBAUT: die Mittelsaeule. Traverse ${TRAVERSE_Y.toFixed(4)} m,`);
  console.log(
    `  Schalenbolzen ${STEMPEL_AUGE.y.toFixed(4)} m — ${((TRAVERSE_Y - STEMPEL_AUGE.y) * 100).toFixed(1)} cm dazwischen, unveraendert.`
  );

  /* -------------------------------------------------------------- Zeichnen */
  teile.push(`<rect width="${BREITE}" height="${HOEHE}" fill="${FARBE.papier}"/>`);
  T(40, 50, "Der Zahn: vorher gegen nachher", 30, FARBE.linie, "start", true);
  T(
    40,
    78,
    "Fünfschalengreifer · Schattenrisse der gebauten Netze · je Zeile EIN Maßstab für alle Spalten · 15.09.2026 (E-069)",
    14,
    FARBE.grau,
    "start"
  );
  T(
    40,
    100,
    '„Zeigt mir einen Vorher-Nachher-Vergleich."  (Patrick, 15.09.2026)',
    14,
    FARBE.grau,
    "start"
  );

  /* Spaltenköpfe */
  const kopf = [
    ["VORHER", "bis 15.09. mittags · Zahn 12,15° abgewinkelt", FARBE.vorher],
    ["NACHHER", "seit E-069 · Zahn tangential", FARBE.nachher],
    ["ÜBEREINANDER", "beide Formen, dieselbe Stelle, 60 % deckend", FARBE.linie],
  ];
  kopf.forEach((k, i) => {
    T(SPALTE[i]!, 146, k[0]!, 20, k[2]!, "middle", true);
    T(SPALTE[i]!, 168, k[1]!, 13, FARBE.grau);
  });

  zeileGanz(182, 430, "1  Greifer OFFEN", () => 1, spalten, false);
  zeileGanz(624, 430, "2  Greifer GESCHLOSSEN, aufgesetzt", () => 0, spalten, true);
  zeileDetail(1066, 330, "3  Übergang Schale → Zahn, offen (5-fach)", 1, spalten);
  zeileDetail(1408, 300, "4  derselbe Übergang, geschlossen", 0, spalten);

  /* Hinweis zur gestrichelten Linie in Spalte 3 */
  T(
    SPALTE[2]!,
    624 + 430 - 12,
    "gestrichelt: wo der Beton VORHER lag — 4,4 cm tiefer",
    12,
    FARBE.vorher
  );

  /* ------------------------------------------------------- Zeile 5: Maße */
  const mY = 1722;
  const masse: Array<[string, string, string, boolean]> = [
    ["Schwebehöhe geschlossen", `${(A.schwebt * 100).toFixed(1)} cm`, `${(B.schwebt * 100).toFixed(1)} cm`, true],
    ["Maulweite offen", `${A.maul.toFixed(3)} m`, `${B.maul.toFixed(3)} m`, true],
    ["Korbtiefe geschlossen", `${A.korbtiefe.toFixed(3)} m`, `${B.korbtiefe.toFixed(3)} m`, false],
    ["Zahnwinkel bei Bodenkontakt", `${A.zahnBoden.toFixed(1)}°`, `${B.zahnBoden.toFixed(1)}°`, true],
  ];
  for (let i = 0; i < 2; i++) {
    const mx = SPALTE[i]!;
    feld(mx - FELD_B / 2, mY, FELD_B, 200, i === 0 ? "5  Die vier Maße" : "");
    masse.forEach((m, k) => {
      T(mx - FELD_B / 2 + 18, mY + 62 + k * 36, m[0]!, 14, FARBE.grau, "start");
      T(
        mx + FELD_B / 2 - 18,
        mY + 62 + k * 36,
        (i === 0 ? m[1] : m[2])!,
        19,
        m[3] ? FARBE.linie : FARBE.hilfe,
        "end",
        true
      );
    });
  }
  /* Dritte Spalte: der Unterschied als Zahl. */
  const mx3 = SPALTE[2]!;
  feld(mx3 - FELD_B / 2, mY, FELD_B, 200, "");
  T(mx3, mY + 34, "WIE GROSS IST DER UNTERSCHIED?", 14, FARBE.linie, "middle", true);
  const zeilen: Array<[string, string]> = [
    ["Zahnspitze wandert, offen", `${(u.spitzeOffen * 1000).toFixed(0)} mm`],
    ["Zahnspitze wandert, geschlossen", `${(u.spitzeZu * 1000).toFixed(0)} mm`],
    [
      "Ganzer Greifer offen:\ndavon deckungsgleich",
      `${(deckung(u.flaecheOffen) * 100).toFixed(1)} %`,
    ],
    ["nur der Zahn: davon\ndeckungsgleich", `${(deckung(u.zahnOffen) * 100).toFixed(1)} %`],
  ];
  zeilen.forEach((r, k) => {
    const teil = r[0]!.split("\n");
    teil.forEach((s, j) =>
      T(mx3 - FELD_B / 2 + 18, mY + 62 + k * 36 + j * 15, s, 13, FARBE.grau, "start")
    );
    T(mx3 + FELD_B / 2 - 18, mY + 62 + k * 36, r[1]!, 19, FARBE.linie, "end", true);
  });

  /* ---------------------------------------------------------- Das Urteil */
  T(
    40,
    1966,
    "DER UNTERSCHIED IST KLEIN — und das ist keine Ausrede, sondern das Maß: der ganze Greifer deckt sich zu " +
      `${(deckung(u.flaecheOffen) * 100).toFixed(1)} % mit vorher, der Zahn nur zu ` +
      `${(deckung(u.zahnOffen) * 100).toFixed(0)} %. Die Spitze wandert ${(u.spitzeOffen * 1000).toFixed(0)} mm.`,
    16,
    FARBE.linie,
    "start",
    true
  );
  T(
    40,
    1990,
    'Gebaut wurde genau eine Zahl: der Term „+ zahnEigenwinkel()" in zahnAnstellung ist weg. ' +
      "Der Zahn setzt die Krümmung der Schale fort, statt gegen sie zu stehen.",
    14,
    FARBE.grau,
    "start"
  );
  T(
    40,
    2014,
    "NICHT GEBAUT — und das ist Patricks eigentlicher Einwand: Die Mittelsäule zwischen Traverse (−0,865 m) und Schalenbolzen (−1,5335 m) steht unverändert. " +
      `${((TRAVERSE_Y - STEMPEL_AUGE.y) * 100).toFixed(1)} cm.`,
    14,
    FARBE.schlecht,
    "start"
  );
  T(
    40,
    2038,
    "Was das kostet, wenn sie fällt, steht auf dem zweiten Blatt: docs/f5-mittelsaeule-2026-09-15.svg (gerechnet, nicht gebaut).",
    14,
    FARBE.schlecht,
    "start"
  );
  T(
    40,
    2074,
    "Gemessen mit tools/fuenfschalen/zahn-vorher-nachher.ts über tools/fuenfschalen/zahnformen.ts · src/ ist von diesem Blatt unberührt",
    12,
    FARBE.hilfe,
    "start"
  );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE}" height="${HOEHE}" ` +
    `viewBox="0 0 ${BREITE} ${HOEHE}">` +
    teile.join("") +
    "</svg>";
  writeFileSync("docs/f5-zahn-vorher-nachher-2026-09-15.svg", svg);
  console.log("");
  if (ueberstand.length) for (const s of ueberstand) console.log(`  ÜBERSTAND  ${s}`);
  else console.log("  Feldprobe: jeder ganze Riss liegt vollstaendig in seinem Feld.");
  console.log(
    `\ndocs/f5-zahn-vorher-nachher-2026-09-15.svg  ${(svg.length / 1024).toFixed(0)} kB`
  );
}

main();
