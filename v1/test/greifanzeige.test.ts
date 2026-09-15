import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { griffLadung, griffZiel, type GriffStueck } from "../src/ui/hud";

/*
 * Waechter fuer den unteren HUD-Block (Ladeanzeige + Griff-Info).
 *
 * Anlass (Patrick, 15.09.2026, iPhone mini): "Bei iPhone Mini wird auch durch
 * die Greifanzeige, also was gegriffen worden ist, die Sicht verdeckt."
 *
 * Geprueft werden DREI Fassungen, nicht zwei — das war der Denkfehler bis
 * gestern: Die Abfrage "max-height: 430px" fasst nur das Querformat der
 * Telefone. Ein iPhone mini im HOCHFORMAT ist 812 px hoch und lief bisher mit
 * den Tablet-Regeln, obwohl es nur 375 px breit ist. Genau diese Fassung stand
 * auf Patricks Bildschirmfoto.
 *
 * Gerechnet wird aus dem CSS, weil es hier keinen Browser gibt. Die Rechnung
 * nimmt darum ausdruecklich RAHMEN UND FASSUNG mit: Die Drehtasten stehen auf
 * content-box, ihre 54 px Breite sind ohne den 2-px-Rahmen gemessen. Eine
 * fruehere Fassung lag um genau diese 4 px daneben (Messung 14.09.2026).
 */

const wurzel = resolve(__dirname, "..");
const seite = readFileSync(resolve(wurzel, "index.html"), "utf8");
/** CSS ohne Kommentare — in den Kommentaren stehen Beispielwerte. */
const css = seite.slice(seite.indexOf("<style>"), seite.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------------------
// Ein sehr kleines Stueck CSS-Kaskade: genug fuer Medienabfragen und Gewichte.
// ---------------------------------------------------------------------------

interface Regel {
  media: string | null;
  selektoren: string[];
  decls: string;
  reihenfolge: number;
}

function parse(quelle: string): Regel[] {
  const out: Regel[] = [];
  let media: string | null = null;
  let n = 0;
  const re = /([^{}]+)\{|\}/g;
  for (let m = re.exec(quelle); m; m = re.exec(quelle)) {
    if (m[0] === "}") {
      media = null; // Ende einer Medienabfrage
      continue;
    }
    const kopf = m[1].trim();
    if (kopf.startsWith("@media")) {
      media = kopf.slice("@media".length).trim();
      continue;
    }
    const zu = quelle.indexOf("}", re.lastIndex);
    out.push({
      media,
      selektoren: kopf.split(",").map((s) => s.trim()),
      decls: quelle.slice(re.lastIndex, zu),
      reihenfolge: n++,
    });
    re.lastIndex = zu + 1;
  }
  return out;
}

const regeln = parse(css);

function mediaPasst(media: string | null, w: number, h: number): boolean {
  if (!media) return true;
  return media.split(" and ").every((teil) => {
    const m = /\((max|min)-(width|height):\s*(\d+)px\)/.exec(teil);
    expect(m, `unbekannte Medienabfrage: ${teil}`).not.toBeNull();
    const ist = m![2] === "width" ? w : h;
    return m![1] === "max" ? ist <= Number(m![3]) : ist >= Number(m![3]);
  });
}

/** Grobes Selektorgewicht: Bezeichner vor Klassen vor allem anderen. */
function gewicht(sel: string): number {
  return (sel.match(/#/g) ?? []).length * 100 + (sel.match(/\.[a-zA-Z]/g) ?? []).length * 10;
}

/**
 * Wert einer Eigenschaft, so wie ihn der Browser fuer ein Element mit diesen
 * Selektoren in diesem Bildformat nehmen wuerde: das schwerste, bei gleichem
 * Gewicht das spaeteste.
 */
function wert(selektoren: string[], prop: string, w: number, h: number): string | null {
  const treffer = regeln
    .filter((r) => mediaPasst(r.media, w, h) && r.selektoren.some((s) => selektoren.includes(s)))
    .map((r) => ({
      r,
      g: Math.max(...r.selektoren.filter((s) => selektoren.includes(s)).map(gewicht)),
    }))
    .sort((a, b) => a.g - b.g || a.r.reihenfolge - b.r.reihenfolge);
  let gefunden: string | null = null;
  for (const t of treffer) {
    const m = new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+)`).exec(t.r.decls);
    if (m) gefunden = m[1].trim();
  }
  return gefunden;
}

function px(selektoren: string[], prop: string, w: number, h: number): number {
  const v = wert(selektoren, prop, w, h);
  expect(v, `${prop} fehlt fuer ${selektoren[0]} bei ${w}x${h}`).not.toBeNull();
  const m = /^(\d+)px/.exec(v!);
  expect(m, `${prop} ist keine Pixelangabe: ${v}`).not.toBeNull();
  return Number(m![1]);
}

/** Innenrand als [oben/unten, links/rechts]. */
function fassung(selektoren: string[], w: number, h: number): [number, number] {
  const v = wert(selektoren, "padding", w, h)!;
  // "0" steht ohne Einheit da — darum ist "px" hier freigestellt.
  const zahlen = [...v.matchAll(/(\d+)(?:px)?/g)].map((m) => Number(m[1]));
  return zahlen.length > 1 ? [zahlen[0], zahlen[1]] : [zahlen[0], zahlen[0]];
}

// ---------------------------------------------------------------------------
// Schriftmass
// ---------------------------------------------------------------------------

/*
 * Consolas ist eine Festbreitenschrift: Jede Figur ist 1126 von 2048
 * Einheiten breit, also 0,5498 em. Bei 14 px sind das 7,70 px je Zeichen.
 * Damit laesst sich der Umbruch ohne Browser ausrechnen.
 */
const EM_BREITE = 0.55;

/** Zeilen, die ein Text bei dieser Breite braucht — gierig an Leerzeichen umgebrochen. */
function zeilen(text: string, breitePx: number, schriftPx: number): number {
  const proZeile = Math.floor(breitePx / (schriftPx * EM_BREITE));
  expect(proZeile, "Streifen zu schmal fuer auch nur ein Zeichen").toBeGreaterThan(0);
  let n = 1;
  let voll = 0;
  for (const wort of text.split(" ")) {
    const laenge = wort.length;
    if (voll === 0) {
      voll = laenge;
    } else if (voll + 1 + laenge <= proZeile) {
      voll += 1 + laenge;
    } else {
      n++;
      voll = laenge;
    }
    // Ein einzelnes Wort, das laenger ist als die Zeile, bricht hart um.
    while (voll > proZeile) {
      n++;
      voll -= proZeile;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Die laengsten Texte, die das Spiel erzeugen kann
// ---------------------------------------------------------------------------

/*
 * Nicht geschaetzt, sondern aus den Quellen geholt: der laengste Stuecknamen
 * und die laengste Muldenaufschrift. Kommt ein laengerer dazu, faellt der Test
 * "die Annahmen ueber die laengsten Texte stimmen noch" weiter unten.
 */
const LANGER_NAME = "Unfallfahrzeug (Front eingedrückt)";
const LANGE_MULDE = "KUPFER + MESSING";

const stueck = (
  name: string,
  massKg: number,
  materialId = "mixed",
  composition?: Array<{ materialId: string; massKg: number }>
): GriffStueck => ({ materialId, massKg, shape: { name }, composition });

/** Die volle Spinne: drei benannte Brocken, mehrere Fraktionen, ein Rest. */
const schlimmsteLadung: GriffStueck[] = [
  // Groesster Anteil ist NICHT die eigene Fraktion — nur dann haengt
  // hauptMaterial() die lange Form "Mischschrott · 58 % Baumischabfall" an.
  stueck(LANGER_NAME, 900, "mixed", [
    { materialId: "mixed", massKg: 380 },
    { materialId: "rubble", massKg: 520 },
  ]),
  stueck("Wohnwagen-Kühlschrank (Absorber)", 120),
  stueck("U-Bahn-Drehgestell (angetrieben)", 400),
  stueck("Blech", 10, "steel"),
  stueck("Blech", 10, "va"),
  stueck("Draht", 10, "cable"),
  stueck("Rohr", 10, "brass"),
  stueck("Klotz", 10, "wood"),
];

const langeLadung = griffLadung(schlimmsteLadung, { container: LANGE_MULDE, ampel: "red" });
const langesZiel = griffZiel(
  stueck(LANGER_NAME, 1200, "mixed", [
    { materialId: "mixed", massKg: 500 },
    { materialId: "rubble", massKg: 700 },
  ])
);
/** Laengste Ladeanzeige: Fraktionsname, Masse, Balken, Prozent (vgl. hud.ts). */
const LANGE_LADEZEILE = "Baumischabfall: 12.4 t · ██████████ 100 % sortenrein";

// ---------------------------------------------------------------------------
// Die drei Fassungen
// ---------------------------------------------------------------------------

interface Fassung {
  name: string;
  w: number;
  h: number;
}

const FASSUNGEN: Fassung[] = [
  // iPad quer, schmalste gebraeuchliche Fassung (iPad 9. Gen. in Safari).
  { name: "iPad quer", w: 1024, h: 768 },
  // iPhone mini quer — die flache Fassung.
  { name: "iPhone mini quer", w: 812, h: 375 },
  // iPhone mini hoch — Patricks Bildschirmfoto vom 15.09.2026.
  { name: "iPhone mini hoch", w: 375, h: 812 },
];

interface Kasten {
  name: string;
  x0: number;
  x1: number;
  /** Abstand zur Unterkante des Bildes; y1 ist die Oberkante. */
  y0: number;
  y1: number;
}

/** Die Fahrpedale samt Fassung. */
function pedalKasten(f: Fassung): Kasten {
  const halter = ["#pedals"];
  const pedal = ["#touch .pedal"];
  const [pad] = fassung(halter, f.w, f.h);
  const breite =
    2 * pad + 2 * px(pedal, "width", f.w, f.h) + px(halter, "gap", f.w, f.h);
  // .pedal steht auf border-box — width/height sind schon das Sichtbare.
  const hoehe = 2 * pad + px(pedal, "height", f.w, f.h);
  const links = px(halter, "left", f.w, f.h);
  const unten = px(halter, "bottom", f.w, f.h);
  return { name: "Pedale", x0: links, x1: links + breite, y0: unten, y1: unten + hoehe };
}

/** Eine Drehtaste. Content-box: Der 2-px-Rahmen kommt auf width/height obendrauf. */
function drehKasten(id: string, f: Fassung): Kasten {
  const sel = ["#touch .btn", `#touch #${id}`];
  const rahmen = 2;
  // Ohne padding: 0 waeren die Tasten 22 px hoeher als ihre Angabe — dann
  // stimmt die ganze Rechnung nicht mehr (Kommentar in index.html).
  expect(fassung(sel, f.w, f.h)).toEqual([0, 0]);
  const breite = px(sel, "width", f.w, f.h) + 2 * rahmen;
  const hoehe = px(sel, "height", f.w, f.h) + 2 * rahmen;
  const rechts = px(sel, "right", f.w, f.h);
  const unten = px(sel, "bottom", f.w, f.h);
  return { name: id, x0: f.w - rechts - breite, x1: f.w - rechts, y0: unten, y1: unten + hoehe };
}

/**
 * Der untere HUD-Block mit dem laengsten Text, den das Spiel erzeugen kann:
 * Ladeanzeige (wartender Abholer) UND Griff-Info (volle Spinne ueber der
 * falschen Mulde) gleichzeitig.
 */
function blockKasten(f: Fassung, kopf: string, liste: string): Kasten {
  const halter = ["#hudunten", "body.touch #hudunten"];
  const links = px(halter, "left", f.w, f.h);
  const rechts = px(halter, "right", f.w, f.h);
  const unten = px(halter, "bottom", f.w, f.h);
  const luecke = px(halter, "gap", f.w, f.h);
  const breite = f.w - links - rechts;

  const rahmen = 1; // .hud: 1px Rand
  /** Hoehe eines Kastens aus einer gegebenen Zeilenzahl. */
  const hoehe = (selektoren: string[], anzahlZeilen: number): number => {
    const schrift = px(selektoren, "font-size", f.w, f.h);
    const [padY] = fassung(selektoren, f.w, f.h);
    const zeilenHoehe = Math.ceil(schrift * 1.35); // line-height 1.35 (index.html)
    return anzahlZeilen * zeilenHoehe + 2 * padY + 2 * rahmen;
  };
  /** Wie viele Zeilen ein Text in diesem Kasten braucht. */
  const umbruch = (selektoren: string[], text: string): number => {
    const schrift = px(selektoren, "font-size", f.w, f.h);
    const [, padX] = fassung(selektoren, f.w, f.h);
    return zeilen(text, breite - 2 * padX - 2 * rahmen, schrift);
  };

  const grip = ["#gripinfo", "#hudunten .hud", ".hud"];
  const load = ["#load", "#hudunten .hud", ".hud"];
  // Kopf darf umbrechen, die Liste steht immer auf genau einer Zeile.
  const gripHoehe = hoehe(grip, umbruch(grip, kopf) + (liste ? 1 : 0));
  const gesamt = gripHoehe + luecke + hoehe(load, umbruch(load, LANGE_LADEZEILE));
  return { name: "HUD unten", x0: links, x1: f.w - rechts, y0: unten, y1: unten + gesamt };
}

function ueberlappt(a: Kasten, b: Kasten): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

describe("Unterer HUD-Block: Griff-Info und Ladeanzeige", () => {
  it("die Annahmen ueber die laengsten Texte stimmen noch", () => {
    /*
     * Faellt dieser Test, ist ein laengerer Name oder eine laengere
     * Muldenaufschrift dazugekommen — dann ist die Platzrechnung weiter unten
     * mit dem falschen Wert gemacht und muss nachgezogen werden.
     */
    const quellen = [
      "src/world/objektkatalog.ts",
      "src/world/scrapItems.ts",
      "src/world/containers.ts",
      "src/world/yard.ts",
      "src/dismantle/carDef.ts",
    ]
      .map((p) => {
        try {
          return readFileSync(resolve(wurzel, p), "utf8");
        } catch {
          return "";
        }
      })
      .join("\n");
    const namen = [...quellen.matchAll(/name: "([^"]*)"/g)].map((m) => m[1]);
    const labels = [...quellen.matchAll(/label: "([^"]*)"/g)].map((m) => m[1]);
    for (const n of namen) expect(n.length, `laengerer Name: ${n}`).toBeLessThanOrEqual(LANGER_NAME.length);
    for (const l of labels) expect(l.length, `laengere Aufschrift: ${l}`).toBeLessThanOrEqual(LANGE_MULDE.length);
  });

  it("stapelt beide Zeilen, statt sie einzeln an den Rand zu haengen", () => {
    /*
     * Der eigentliche Fehler vom 14.09.2026: Jede Zeile hatte ihren eigenen
     * Abstand zum Bildrand (118 / 163 px). Wuchs die untere auf zwei Zeilen,
     * schob sie sich unter die obere. Im Stapel kann das nicht passieren —
     * darum wird hier die Bauform bewacht und nicht nur das Ergebnis.
     */
    const halter = ["#hudunten"];
    expect(wert(halter, "display", 1024, 768)).toBe("flex");
    expect(wert(halter, "flex-direction", 1024, 768)).toBe("column");
    expect(px(halter, "gap", 1024, 768)).toBeGreaterThanOrEqual(4);
    // Und keine der beiden Zeilen haengt noch selbst am Rand.
    expect(css).not.toMatch(/body\.touch #gripinfo\s*\{/);
    expect(css).not.toMatch(/body\.touch #load\s*\{/);
  });

  it("waechst nicht mehr nach beiden Seiten aus der Bildmitte", () => {
    /*
     * Beide Zeilen waren mittig zentriert (left: 50% + translateX(-50%)) und
     * ohne Breitengrenze. Auf 375 px Breite wurde daraus eine schmale, hohe
     * Saeule mitten im Bild. Auf Touchgeraeten haengt der Block jetzt links im
     * freien Streifen; ohne Touch bleibt die Mitte, dort steht nichts im Weg.
     */
    expect(wert(["#gripinfo"], "transform", 1024, 768)).toBeNull();
    expect(wert(["#load"], "transform", 1024, 768)).toBeNull();
    expect(wert(["#hudunten", "body.touch #hudunten"], "align-items", 1024, 768)).toBe("flex-start");
  });

  it("schneidet nur die Aufzaehlung ab, nie Gewicht, Preis oder Ampel", () => {
    // Die Liste ist die einzige Zeile mit Ellipse. Alles, was der Spieler zum
    // Entscheiden braucht, steht im Kopf und darf statt dessen umbrechen.
    const liste = ["#grip-liste"];
    expect(wert(liste, "white-space", 1024, 768)).toBe("nowrap");
    expect(wert(liste, "text-overflow", 1024, 768)).toBe("ellipsis");
    expect(wert(liste, "overflow", 1024, 768)).toBe("hidden");
    expect(wert(["#grip-kopf"], "white-space", 1024, 768)).toBeNull();

    expect(langeLadung.kopf).toContain("1.5 t");
    expect(langeLadung.kopf).toContain(LANGE_MULDE);
    expect(langeLadung.kopf).toContain("✕ falsche Zone");
    // Preis und Gewicht des anvisierten Stuecks stehen ebenfalls im Kopf.
    expect(langesZiel.kopf).toContain("1.2 t");
    expect(langesZiel.kopf).toContain("€/t");
    // Und das Material bleibt in Klammern hinter dem Namen (Ansage 12.09.2026).
    expect(langesZiel.kopf).toContain(`${LANGER_NAME} (Mischschrott · 58 % Baumischabfall)`);
  });

  it("blendet die zweite Zeile aus, wenn nichts in der Spinne liegt", () => {
    // "Greifer: offen" braucht keine Aufzaehlung — und eine leere Zeile im Bild
    // waere genau das, was Patrick stoert.
    expect(griffZiel(stueck("Kühlschrank", 84)).liste).toBe("");
    expect(css).toContain("#grip-liste:empty { display: none; }");
  });

  for (const f of FASSUNGEN) {
    describe(f.name, () => {
      const block = blockKasten(f, langeLadung.kopf, langeLadung.liste);
      const zielBlock = blockKasten(f, langesZiel.kopf, langesZiel.liste);
      const nachbarn = [pedalKasten(f), drehKasten("btn-rot-l", f), drehKasten("btn-rot-r", f)];

      it("ueberlappt weder Pedale noch Drehtasten", () => {
        for (const n of nachbarn) {
          expect(ueberlappt(block, n), `${block.name} auf ${n.name}: ${JSON.stringify([block, n])}`).toBe(false);
          expect(ueberlappt(zielBlock, n), `Zielzeile auf ${n.name}`).toBe(false);
        }
      });

      it("haelt mindestens 8 px Luft zum naechsten Bedienelement", () => {
        // Beruehren reicht nicht: Ein Daumen, der die Zeile streift, soll nicht
        // das Gefuehl haben, er tippe daneben.
        for (const n of nachbarn) {
          const luft = Math.max(n.x0 - block.x1, block.x0 - n.x1, n.y0 - block.y1, block.y0 - n.y1);
          expect(luft, `zu dicht an ${n.name}`).toBeGreaterThanOrEqual(8);
        }
      });

      it("bleibt mit dem laengsten Text im unteren Drittel des Bildes", () => {
        // Das ist die eigentliche Beschwerde: Der Block darf nicht ins Bild
        // wachsen. Gemessen mit voller Spinne UND wartendem Abholer, also
        // beide Zeilen gleichzeitig und beide am laengsten.
        const hoechste = Math.max(block.y1, zielBlock.y1);
        expect(hoechste / f.h, `Block reicht bis ${hoechste} px von ${f.h}`).toBeLessThan(0.35);
      });
    });
  }
});
