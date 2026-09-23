/*
 * Wie hoch das Abrechnungsbild wird — ohne Browser gerechnet (E-113).
 *
 * Vorbild und Begründung: `test/radiomass.ts`. Diese Datei ist die EINE
 * Rechnung; der Wächter `test/abrechnungsplatz.test.ts` prüft mit ihr,
 * `tools/abrechnungsbild.ts` zeichnet mit ihr. Zwei Kopien einer Rechnung
 * driften auseinander, und dann glaubt man der falschen.
 *
 * Sie trägt kein `.test.` im Namen und wird nicht als Testlauf eingesammelt.
 *
 * WAS SIE IST UND WAS NICHT: eine Rechnung, kein Bildschirmfoto. Wie es auf
 * dem Gerät aussieht, entscheidet Patrick.
 */
import { FASSUNGEN, fassungInnen, schriftgroesse, wert, type Fassung } from "./cssmass";
import { abrechnungszeilen } from "../src/ui/abrechnung";
import { Shift } from "../src/economy/shift";

/** Zeilenabstand, wenn keiner gesetzt ist. Browser rechnen mit rund 1,2. */
const NORMAL_ZEILE = 1.2;

/** Zahl aus einem Wert holen, `!important`, `vh` und Einheiten abgestreift. */
function laenge(v: string | null, f: Fassung): number {
  if (v === null) return 0;
  const s = v.replace("!important", "").trim();
  const m = /(-?\d+(?:\.\d+)?)(px|vh|vw)?/.exec(s);
  if (!m) return 0;
  const z = Number(m[1]);
  if (m[2] === "vh") return (z * f.h) / 100;
  if (m[2] === "vw") return (z * f.w) / 100;
  return z;
}

/** Unterer Aussenabstand aus `margin: a b [c]` bzw. `margin-top`. */
function aussen(sel: string[], f: Fassung): { oben: number; unten: number } {
  const kurz = wert(sel, "margin", f);
  let oben = 0;
  let unten = 0;
  if (kurz) {
    const teile = kurz
      .replace("!important", "")
      .trim()
      .split(/\s+/)
      .map((t) => laenge(t, f));
    oben = teile[0] ?? 0;
    unten = teile.length >= 3 ? teile[2]! : (teile[0] ?? 0);
  }
  const mt = wert(sel, "margin-top", f);
  if (mt !== null) oben = laenge(mt, f);
  return { oben, unten };
}

/** Rahmenstärke oben plus unten. */
function rahmen(sel: string[], f: Fassung): number {
  const b = wert(sel, "border", f);
  const m = b ? /(\d+(?:\.\d+)?)px/.exec(b) : null;
  return m ? Number(m[1]) * 2 : 0;
}

export interface Block {
  name: string;
  hoehe: number;
}

export interface AbrechnungsMass {
  fassung: Fassung;
  /** Was die Tafel höchstens hoch sein darf */
  platz: number;
  /** Breite der Tafel und ihres Inhalts */
  tafelBreite: number;
  inhaltBreite: number;
  /** Breite, die die längste Zeile braucht (Name + Zahl + Abstand) */
  gebrauchteBreite: number;
  bloecke: Block[];
  gebraucht: number;
  /** Was übrig bleibt; negativ heißt: etwas rutscht aus dem Bild */
  luft: number;
  /** Höhe einer Zahlenzeile und die Schrift darin */
  zeilenHoehe: number;
  zeilenSchrift: number;
  /** Höhe des WEITER-Knopfes — die Daumenfläche */
  knopfHoehe: number;
}

/** Eine Bilanz, wie sie am Abend im Bild steht — für die längste Zeile. */
function beispielZeilen(): Array<{ name: string; wert: string }> {
  const s = new Shift();
  s.starte(5000);
  s.deliveries = 12;
  s.noteTurnover(8400, 0.72); // „durchwachsen" ist das längste Urteil
  return abrechnungszeilen(s.bilanz(-12480, 0.62));
}

export function abrechnungsMass(f: Fassung): AbrechnungsMass {
  const tafel = ["#abrechnung .panel"];
  const polster = fassungInnen(tafel, f); // [oben/unten, links/rechts]
  const platz = Math.min(
    laenge(wert(tafel, "max-height", f), f) || f.h,
    f.h - f.sa.t - f.sa.b
  );

  // --- Breite: die Zahlenzeile ist ein Flexkasten, Name links, Zahl rechts
  const zeileSel = ["#abrechnung .zeile"];
  const zeilenSchrift = schriftgroesse(zeileSel, f);
  const spalt = laenge(wert(zeileSel, "gap", f), f);
  const zeilePolster = fassungInnen(zeileSel, f);
  const laengste = beispielZeilen().reduce(
    (a, z) => Math.max(a, (z.name.length + z.wert.length) * zeilenSchrift * 0.55),
    0
  );
  const gebrauchteBreite = laengste + spalt + 2 * zeilePolster[1];
  const minW = laenge(wert(tafel, "min-width", f), f);
  const maxW = Math.min(laenge(wert(tafel, "max-width", f), f) || f.w, f.w - f.sa.l - f.sa.r);
  const tafelBreite = Math.min(maxW, Math.max(minW, gebrauchteBreite + 2 * polster[1]));
  const inhaltBreite = tafelBreite - 2 * polster[1];

  // --- Höhe, von oben nach unten
  const h2Sel = ["#abrechnung h2"];
  const sterneSel = ["#abr-sterne"];
  const knopfSel = ["#abr-weiter", "#abrechnung button"];
  const knopfPolster = fassungInnen(knopfSel, f);
  const knopfEigen =
    2 * knopfPolster[0] + rahmen(knopfSel, f) + schriftgroesse(knopfSel, f) * NORMAL_ZEILE;
  const knopfHoehe = Math.max(laenge(wert(knopfSel, "min-height", f), f), knopfEigen);
  const zeilenAbstand = Number(wert(zeileSel, "line-height", f) ?? NORMAL_ZEILE);
  const zeilenHoehe = zeilenSchrift * zeilenAbstand + 2 * zeilePolster[0] + 1; // + Trennlinie
  const anzahl = beispielZeilen().length;

  const bloecke: Block[] = [
    { name: "Polster + Rahmen", hoehe: 2 * polster[0] + rahmen(tafel, f) },
    {
      name: "Überschrift FEIERABEND",
      hoehe: schriftgroesse(h2Sel, f) * NORMAL_ZEILE + aussen(h2Sel, f).unten,
    },
    {
      name: "Sternzeile",
      hoehe: schriftgroesse(sterneSel, f) * NORMAL_ZEILE + aussen(sterneSel, f).unten,
    },
    { name: `${anzahl} Zahlenzeilen`, hoehe: anzahl * zeilenHoehe },
    { name: "WEITER", hoehe: knopfHoehe + aussen(knopfSel, f).oben },
  ];
  const gebraucht = bloecke.reduce((a, b) => a + b.hoehe, 0);

  return {
    fassung: f,
    platz,
    tafelBreite,
    inhaltBreite,
    gebrauchteBreite,
    bloecke,
    gebraucht,
    luft: platz - gebraucht,
    zeilenHoehe,
    zeilenSchrift,
    knopfHoehe,
  };
}

export function alleMasse(): AbrechnungsMass[] {
  return FASSUNGEN.map(abrechnungsMass);
}
