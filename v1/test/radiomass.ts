/*
 * Wie hoch das Radiofeld mit fuenf Sendern wird — ohne Browser gerechnet.
 *
 * Anlass: E-093. Bis zum 16.09.2026 standen zwei Sender in der Liste, und das
 * Feld passte ueberall. Fuenf Eintraege sind auf dem iPhone mini quer (375 px
 * hoch) hoeher als die Tafel — ohne eigenen Scrollbereich rutschen „Radio
 * ausschalten" und „Zurueck" nach unten aus dem Bild, und dann ist das Menue
 * eine Falle: Man kommt hinein und nicht mehr heraus.
 *
 * Diese Datei ist die EINE Rechnung. Der Waechter `test/radioplatz.test.ts`
 * prueft mit ihr, und `tools/radiobild.ts` zeichnet mit ihr — zwei Kopien
 * einer Rechnung driften auseinander, und dann glaubt man der falschen (Lehre
 * aus `cssmass.ts`, 15.09.2026).
 *
 * Sie traegt kein `.test.` im Namen und wird darum nicht als Testlauf
 * eingesammelt.
 *
 * WAS SIE IST UND WAS NICHT: eine Rechnung, kein Bildschirmfoto. Sie kennt
 * Schriftgroessen, Polster, Raender und Mindesthoehen aus `index.html` und
 * rechnet daraus die Hoehen aus. Wie es auf dem Geraet wirklich aussieht,
 * entscheidet Patrick.
 */
import { FASSUNGEN, fassungInnen, schriftgroesse, wert, zeilen, type Fassung } from "./cssmass";
import { SENDER } from "../src/audio/songs";

/** Zeilenabstand, wenn keiner gesetzt ist. Browser rechnen mit rund 1,2. */
const NORMAL_ZEILE = 1.2;

/** Zahl aus einem Wert holen, `!important` und Einheiten abgestreift. */
function zahl(v: string | null): number | null {
  if (v === null) return null;
  const m = /(-?\d+(?:\.\d+)?)\s*(px|vh|vw)?/.exec(v.replace("!important", "").trim());
  return m ? Number(m[1]) : null;
}

/** Ein Laengenwert in Pixeln, `vh`/`vw` auf die Fassung bezogen. */
function laenge(v: string | null, f: Fassung): number | null {
  if (v === null) return null;
  const s = v.replace("!important", "").trim();
  const m = /(-?\d+(?:\.\d+)?)(px|vh|vw)/.exec(s);
  if (!m) return zahl(s);
  if (m[2] === "vh") return (Number(m[1]) * f.h) / 100;
  if (m[2] === "vw") return (Number(m[1]) * f.w) / 100;
  return Number(m[1]);
}

/** Aussenabstand oben und unten aus der Kurzform `margin: a b` bzw. `a b c`. */
function aussen(sel: string[], f: Fassung): { oben: number; unten: number } {
  const kurz = wert(sel, "margin", f);
  let oben = 0;
  let unten = 0;
  if (kurz) {
    const teile = kurz
      .replace("!important", "")
      .trim()
      .split(/\s+/)
      .map((t) => zahl(t) ?? 0);
    oben = teile[0] ?? 0;
    unten = teile.length >= 3 ? teile[2]! : (teile[0] ?? 0);
  }
  const extraOben = zahl(wert(sel, "margin-top", f));
  if (extraOben !== null) oben = extraOben;
  return { oben, unten };
}

/** Rahmenstaerke oben plus unten. */
function rahmen(sel: string[], f: Fassung): number {
  const b = wert(sel, "border", f);
  const m = b ? /(\d+(?:\.\d+)?)px/.exec(b) : null;
  return m ? Number(m[1]) * 2 : 0;
}

/** Ein Baustein des Feldes, von oben nach unten. */
export interface Block {
  name: string;
  hoehe: number;
}

export interface RadioMass {
  fassung: Fassung;
  /** Was die Tafel hoechstens hoch sein darf */
  platz: number;
  /** Breite des Inhalts (fuer den Textumbruch) */
  inhaltBreite: number;
  bloecke: Block[];
  /** Summe aller Bloecke samt Polster und Rahmen */
  gebraucht: number;
  /** Was uebrig bleibt; negativ heisst: etwas rutscht aus dem Bild */
  luft: number;
  /** Hoehe eines Sendereintrags samt Abstand */
  eintrag: number;
  /** Wie viele Eintraege man ohne Schieben sieht */
  sichtbar: number;
}

/**
 * Die laengste Zeile, die in einem Senderknopf steht — sie bestimmt, wie breit
 * die Tafel wird, und damit, wie oft der Untertitel umbricht.
 */
function laengsteZeile(): string {
  let lang = "";
  for (const s of SENDER) {
    for (const zeile of [`▶ ${s.sender} ${s.frequenz} wählen`, s.beschreibung]) {
      if (zeile.length > lang.length) lang = zeile;
    }
  }
  return lang;
}

/** Die Zeile unter der Ueberschrift — dieselbe wie in `ui/radio.ts`. */
export const INFOZEILE = `${SENDER.length} Sender, alle selbst gespielt. MUSIK schaltet weiter.`;

export function radioMass(f: Fassung): RadioMass {
  const tafel = ["#radio .panel"];
  const polster = fassungInnen(tafel, f); // [oben/unten, links/rechts]
  const tafelRahmen = rahmen(tafel, f);

  /*
   * Wie hoch die Tafel sein darf: `max-height` der Tafel, und hoechstens der
   * Streifen zwischen den sicheren Raendern — der Ueberzug hat sie als
   * Polster, die Tafel steht innerhalb davon.
   */
  const maxHoehe = laenge(wert(tafel, "max-height", f), f) ?? f.h;
  const platz = Math.min(maxHoehe, f.h - f.sa.t - f.sa.b);

  /*
   * Wie breit der Inhalt wird. Die Knoepfe stehen auf 100 %, die Tafel waechst
   * also mit dem laengsten Text — begrenzt durch `min-width`, `max-width` und
   * den Platz zwischen den sicheren Raendern.
   */
  const knopfPolsterX = fassungInnen(["#radio button"], f)[1];
  const kleinGroesse = schriftgroesse(["#radio button small"], f);
  const textBreite = laengsteZeile().length * kleinGroesse * 0.55;
  const minW = laenge(wert(tafel, "min-width", f), f) ?? 0;
  const maxW = Math.min(
    laenge(wert(tafel, "max-width", f), f) ?? f.w,
    f.w - f.sa.l - f.sa.r
  );
  const tafelBreite = Math.min(maxW, Math.max(minW, textBreite + 2 * knopfPolsterX + 2 * polster[1]));
  const inhaltBreite = tafelBreite - 2 * polster[1];

  // Ueberschrift
  const h2Sel = ["#radio h2"];
  const h2 = schriftgroesse(h2Sel, f) * NORMAL_ZEILE + aussen(h2Sel, f).unten;

  // Die Zeile darunter — sie bricht um, und genau das kostet auf dem Telefon
  const subSel = ["#radio .sub"];
  const subGroesse = schriftgroesse(subSel, f);
  const subAbstand = Number(wert(subSel, "line-height", f) ?? NORMAL_ZEILE);
  const subZeilen = zeilen(INFOZEILE, inhaltBreite, subGroesse);
  const sub = subZeilen * subGroesse * subAbstand + aussen(subSel, f).unten;

  // Die Liste: so hoch, wie sie hoechstens werden darf
  const liste = laenge(wert(["#radio-list"], "max-height", f), f) ?? Infinity;

  // Ein Sendereintrag: Titelzeile, Kleingedrucktes, Polster, Rahmen, Abstand
  const knopfSel = ["#radio button"];
  const knopfPolsterY = fassungInnen(knopfSel, f)[0];
  const knopfGroesse = schriftgroesse(knopfSel, f);
  const knopfRahmen = rahmen(knopfSel, f);
  const kleinAbstand = zahl(wert(["#radio button small"], "margin-top", f)) ?? 0;
  const mindest = zahl(wert(knopfSel, "min-height", f)) ?? 0;
  const knopfAussen = aussen(knopfSel, f);
  const eintragInhalt =
    2 * knopfPolsterY +
    knopfRahmen +
    knopfGroesse * NORMAL_ZEILE +
    kleinGroesse * NORMAL_ZEILE +
    kleinAbstand;
  const eintrag = Math.max(mindest, eintragInhalt) + knopfAussen.oben + knopfAussen.unten;

  // Die beiden Knoepfe darunter: eine Zeile, kein Kleingedrucktes
  const einzeiler = (id: string): number => {
    const sel = [`#${id}`, "#radio button"];
    const a = aussen([`#${id}`], f);
    const eigen = 2 * knopfPolsterY + knopfRahmen + schriftgroesse(sel, f) * NORMAL_ZEILE;
    return Math.max(mindest, eigen) + a.oben + (a.unten || knopfAussen.unten);
  };

  const bloecke: Block[] = [
    { name: "Polster + Rahmen", hoehe: 2 * polster[0] + tafelRahmen },
    { name: "Überschrift RADIO", hoehe: h2 },
    { name: `Infozeile (${subZeilen} Zeilen)`, hoehe: sub },
    { name: "Senderliste", hoehe: liste },
    { name: "Radio ausschalten", hoehe: einzeiler("radio-power") },
    { name: "Zurück", hoehe: einzeiler("radio-close") },
  ];
  const gebraucht = bloecke.reduce((a, b) => a + b.hoehe, 0);

  return {
    fassung: f,
    platz,
    inhaltBreite,
    bloecke,
    gebraucht,
    luft: platz - gebraucht,
    eintrag,
    sichtbar: Math.floor(liste / eintrag),
  };
}

/** Alle drei Fassungen auf einmal. */
export function alleMasse(): RadioMass[] {
  return FASSUNGEN.map(radioMass);
}
