import { getMaterial } from "../materials/catalog";
import { euroIndicator, masseText, preisProTonne } from "../materials/purity";
import type { ScrapItem } from "../world/scrapItems";
import type { AmpelState } from "../world/containers";

/**
 * HUD M1 (Briefing Kap. 14): Griff-Info (Material, Gewicht, €-Indikator),
 * Sortierwert-Anzeige mit Ticker, Abwurf-Ampel-Text.
 */
/**
 * Ab dieser Masse wird ein Stueck beim Namen genannt statt nur nach Fraktion
 * gezaehlt. Darunter sind es Bleche und Profile, bei denen der Name nichts
 * hilft.
 */
const GROSS_AB_KG = 60;
/** So viele Namen hoechstens — danach wird zusammengefasst. */
const GROSS_MAX = 3;

/**
 * Woraus das Stueck vorwiegend besteht.
 *
 * Ansage 12.09.2026: „Bei Spinne sollte immer das Hauptmaterial wie Alu, VA
 * etc. mit angezeigt werden." Bei sortenreinem Schrott ist das die Fraktion
 * selbst; bei einem Verbundteil die groesste Fraktion darin — sonst stuende da
 * nur „Mischschrott", und man wuesste nicht, ob man eine Waschmaschine oder
 * einen Kupfermotor in der Schale hat.
 */
function hauptMaterial(item: GriffStueck): string {
  const eigen = getMaterial(item.materialId).name;
  if (!item.composition || item.composition.length === 0) return eigen;
  let groesster = item.composition[0];
  let summe = 0;
  for (const c of item.composition) {
    summe += c.massKg;
    if (c.massKg > groesster.massKg) groesster = c;
  }
  if (groesster.materialId === item.materialId || summe <= 0) return eigen;
  const anteil = Math.round((groesster.massKg / summe) * 100);
  return `${eigen} · ${anteil} % ${getMaterial(groesster.materialId).name}`;
}

/**
 * Ein Stueck, soweit die Griff-Info es braucht.
 *
 * Absichtlich kein `ScrapItem`: Das traegt Netz und Starrkoerper mit sich und
 * laesst sich ausserhalb eines Browsers nicht bauen. Mit diesem schmalen
 * Ausschnitt sind die Textfunktionen ohne Fenster und ohne Physik pruefbar —
 * und genau das braucht der Waechter in `test/greifanzeige.test.ts`, der die
 * laengstmoegliche Zeile ausrechnet.
 */
export interface GriffStueck {
  materialId: string;
  massKg: number;
  shape?: { name?: string };
  composition?: Array<{ materialId: string; massKg: number }>;
}

/**
 * Die Griff-Info in zwei Zeilen.
 *
 * Anlass (Patrick, 15.09.2026, iPhone mini): „Bei iPhone Mini wird auch durch
 * die Greifanzeige, also was gegriffen worden ist, die Sicht verdeckt."
 *
 * Ursache war nicht die Position allein, sondern dass die Zeile keine Obergrenze
 * hatte: Drei benannte Teile mit Materialangabe, zwei Fraktionen, ein Rest und
 * die Ampel ergeben rund 210 Zeichen. Auf einem 375 px breiten Bildschirm sind
 * das sieben Zeilen — ein Textklotz mitten im Bild.
 *
 * Darum die Trennung: Der **Kopf** traegt, was nie verlorengehen darf (Zustand,
 * Gewicht, Preis, Ampelurteil) und darf umbrechen. Die **Liste** ist die
 * Aufzaehlung; sie steht auf genau einer Zeile und wird am Ende abgeschnitten,
 * wenn sie nicht passt. Verloren geht dabei immer nur der Schwanz der
 * Aufzaehlung — Gesamtgewicht und Ampel stehen im Kopf.
 */
export interface GriffZeilen {
  kopf: string;
  /** Leer = keine zweite Zeile (die CSS-Regel `#grip-liste:empty` blendet sie aus). */
  liste: string;
}

/**
 * Text fuer ein anvisiertes Stueck.
 *
 * Wortlaut unveraendert gegenueber dem 12.09.2026: Name zuerst, Material in
 * Klammern dahinter („Fluggasttreppe sagt nichts über das Material aus"),
 * dann Gewicht und Preis je Tonne. Es ist ein einzelnes Stueck, also eine
 * begrenzte Zeile — hier gibt es nichts zu kuerzen.
 */
export function griffZiel(item: GriffStueck): GriffZeilen {
  const mat = getMaterial(item.materialId);
  const name = item.shape?.name;
  const kopf = name ? `${name} (${hauptMaterial(item)})` : hauptMaterial(item);
  return {
    kopf: `▼ ${kopf} · ${masseText(item.massKg)} · ${preisProTonne(mat)} ${euroIndicator(mat)}`,
    liste: "",
  };
}

/**
 * Text fuer die getragene Ladung.
 *
 * Grosse Stuecke werden beim Namen genannt, kleine nach Fraktion
 * zusammengefasst (Wunsch 12.09.2026: „evtl. Listenbeschreibung einbauen, was
 * in Spinne liegt, zumindest fuer grosse Teile").
 */
export function griffLadung(
  items: GriffStueck[],
  hover: { container: string; ampel: AmpelState } | null
): GriffZeilen {
  const byMat = new Map<string, number>();
  const gross: string[] = [];
  let total = 0;
  for (const it of items) {
    total += it.massKg;
    const name = it.shape?.name;
    if (name && it.massKg >= GROSS_AB_KG && gross.length < GROSS_MAX) {
      // Auch in der Ladungsliste: Name ohne Material sagt nichts.
      gross.push(`${name} (${hauptMaterial(it)})`);
      continue;
    }
    byMat.set(it.materialId, (byMat.get(it.materialId) ?? 0) + 1);
  }
  const parts = [
    ...gross,
    ...[...byMat.entries()].map(([id, n]) => `${n}× ${getMaterial(id).name}`),
  ];
  const gezeigt = parts.slice(0, GROSS_MAX + 2);
  if (parts.length > gezeigt.length) gezeigt.push(`+${parts.length - gezeigt.length} weitere`);
  // Gewicht in den Kopf, nicht ans Ende der Aufzaehlung: Es ist die Zahl, nach
  // der man den Abwurf entscheidet, und darf nie mit abgeschnitten werden.
  let kopf = `Greifer: ${masseText(total)}`;
  if (hover) {
    // Zielzone unter dem Greifer samt Bewertung — nicht das Material selbst
    const verdict =
      hover.ampel === "green" ? "✓ passt" : hover.ampel === "yellow" ? "! gemischt" : "✕ falsche Zone";
    kopf += `  ›  über ${hover.container}: ${verdict}`;
  }
  return { kopf, liste: gezeigt.join(", ") };
}

/**
 * Schreibt Text und Farbe nur, wenn sie sich geaendert haben.
 *
 * Befund 14.09.2026: Das HUD schrieb `textContent` und `style.color` in jedem
 * Bild neu — auch dann, wenn genau dieselbe Zeile schon dastand. Jedes
 * Schreiben zwingt den Browser, den Textknoten zu ersetzen und den Bereich neu
 * zu setzen. Bei 48 Bildern je Sekunde sind das rund 250 Schreibvorgaenge, von
 * denen die allermeisten nichts aendern: Das Konto steht still, sobald der
 * Ticker eingelaufen ist, und „Auftrag: Kupfer — Container ist leer" aendert
 * sich minutenlang nicht.
 *
 * Das Lesen von `textContent` und `style.color` waere selbst nicht umsonst,
 * darum merkt sich die Tabelle den letzten Stand, statt am Element
 * nachzuschauen.
 */
const zuletztGeschrieben = new WeakMap<HTMLElement, { text: string; farbe: string }>();
function schreib(el: HTMLElement, text: string, farbe = ""): void {
  const alt = zuletztGeschrieben.get(el);
  if (alt && alt.text === text && alt.farbe === farbe) return;
  el.textContent = text;
  if (farbe) el.style.color = farbe;
  zuletztGeschrieben.set(el, { text, farbe });
}

export class Hud {
  private gripEl = document.getElementById("gripinfo")!;
  /*
   * Die Griff-Info hat seit dem 15.09.2026 zwei Zeilen: Kopf und Liste (siehe
   * `GriffZeilen`). Beide werden einzeln geschrieben, damit die Liste ihre
   * eigene CSS-Regel bekommt — eine Zeile, am Ende abgeschnitten.
   */
  private gripKopfEl = document.getElementById("grip-kopf")!;
  private gripListeEl = document.getElementById("grip-liste")!;
  /** Startwert passend zum Markup: Dort traegt die Griff-Info schon `ruhig`. */
  private ruhig = true;
  private moneyEl = document.getElementById("money")!;
  /*
   * Einmal geholt statt in jedem Bild neu gesucht (Befund 14.09.2026):
   * `updateLoad` und `updateShift` riefen `getElementById` je Bild auf,
   * waehrend `gripEl` und `moneyEl` seit jeher hier stehen. Beide Elemente
   * stehen fest im `index.html` und koennen nicht verschwinden.
   */
  private loadEl = document.getElementById("load");
  private shiftEl = document.getElementById("shift");
  private displayedValue = 0;

  /**
   * Schreibt beide Zeilen der Griff-Info.
   *
   * `ruhig` heisst: Der Greifer hat gerade nichts zu melden. Dann faellt der
   * Kasten optisch zurueck (blasser Grund, kaum Rand) — er bleibt lesbar, tritt
   * aber nicht mehr als Meldung auf. Die Klasse wird nur bei Wechsel gesetzt,
   * aus demselben Grund, aus dem `schreib()` existiert: kein Schreiben je Bild.
   */
  private setzeGriff(z: GriffZeilen, ruhig: boolean): void {
    schreib(this.gripKopfEl, z.kopf);
    schreib(this.gripListeEl, z.liste);
    if (ruhig !== this.ruhig) {
      this.ruhig = ruhig;
      this.gripEl.classList.toggle("ruhig", ruhig);
    }
  }

  /** Griff-Info bei offenem Greifer: anvisiertes Objekt. */
  showTarget(item: ScrapItem | null): void {
    if (!item) {
      this.setzeGriff({ kopf: "Greifer: offen", liste: "" }, true);
      return;
    }
    this.setzeGriff(griffZiel(item), false);
  }

  /** Griff-Info beim Tragen: Ladungsliste + Ampel. */
  showCarry(items: ScrapItem[], hover: { container: string; ampel: AmpelState } | null): void {
    this.setzeGriff(griffLadung(items, hover), false);
  }

  showClosedEmpty(): void {
    this.setzeGriff({ kopf: "Greifer: geschlossen (leer)", liste: "" }, true);
  }

  /** Hinweis bei offener Spinne über einer abreißbaren Baugruppe. */
  showPartHint(name: string): void {
    this.setzeGriff({ kopf: `▼ ${name} — greifen + halten zum Abreißen`, liste: "" }, false);
  }

  /** Reiß-Fortschritt während des Abreißens. */
  showTearing(name: string, progress01: number): void {
    const blocks = Math.round(progress01 * 10);
    this.setzeGriff(
      {
        kopf: `${name} abreißen ${"█".repeat(blocks)}${"░".repeat(10 - blocks)} ${(progress01 * 100).toFixed(0)} %`,
        liste: "",
      },
      false
    );
  }

  /** Konto (echtes Geld) + Haufen-Prognose, Konto mit weichem Ticker. */
  updateMoney(kontoEur: number, pilesValue: number): void {
    this.displayedValue += (kontoEur - this.displayedValue) * 0.12;
    if (Math.abs(this.displayedValue - kontoEur) < 0.5) this.displayedValue = kontoEur;
    schreib(
      this.moneyEl,
      `Konto: ${this.displayedValue.toFixed(0)} € · Haufen ≈ ${pilesValue.toFixed(0)} €`
    );
  }

  /**
   * Ladezustand des wartenden Abholers. Sortenrein zu laden entscheidet über
   * den Erlös — deshalb steht es dauerhaft im Bild, solange einer wartet.
   */
  updateLoad(kg: number | null, purity: number, bestellt: string | null): void {
    const el = this.loadEl;
    if (!el) return;
    if (kg === null) {
      if (el.style.display !== "none") el.style.display = "none";
      return;
    }
    if (el.style.display !== "block") el.style.display = "block";
    const p = Math.round(purity * 100);
    const ziel = bestellt ? getMaterial(bestellt).name : "Gemischt";
    if (kg === 0) {
      schreib(el, `Auftrag: ${ziel} — Container ist leer`, "#9aa2a8");
      return;
    }
    const balken = "█".repeat(Math.round(p / 10)) + "░".repeat(10 - Math.round(p / 10));
    // Ab 90 % lohnt das Abfahren, darunter drückt die Reinheit den Preis
    schreib(
      el,
      `${ziel}: ${masseText(kg)} · ${balken} ${p} % sortenrein`,
      p >= 90 ? "#7ec96a" : p >= 65 ? "#f0d060" : "#e08a5a"
    );
  }

  /** Phase des Tagesablaufs samt Fortschritt. */
  updateShift(text: string, sortierphase: boolean): void {
    const el = this.shiftEl;
    if (!el) return;
    schreib(el, text, sortierphase ? "#7ec96a" : "#f0d060");
  }

  /** Kurze Einblendung (Verkauf, Speichern, Anlieferung). */
  toast(msg: string): void {
    const el = document.getElementById("toast")!;
    el.textContent = msg;
    el.style.opacity = "1";
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.style.opacity = "0"), 2600);
  }
  private toastTimer = 0;
}
