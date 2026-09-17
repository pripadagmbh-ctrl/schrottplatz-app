import { getMaterial } from "../materials/catalog";
import { containerValueGemischt } from "../materials/purity";
import { leitfraktion, zaehltZu } from "./fraktionsgruppen";
import type { ItemManager, ScrapItem } from "../world/scrapItems";
import type { CompositeManager } from "../dismantle/composites";

/**
 * Wirtschaft (Design 2026-08-29, Briefing Kap. 9/10):
 * 1. ANKAUF — Anlieferer werden voll und leer gewogen; für die Nettomenge
 *    bekommt der Kunde Geld (Ausgabe des Spielers).
 * 2. SORTIERPRÄMIE — jedes korrekt einsortierte Teil bringt sofort etwas Geld.
 * 3. VERKAUF — der Abhol-LKW nimmt den beladenen Container mit; bezahlt wird
 *    nach Materialwert × Sortenreinheit² (sortenrein lohnt sich deutlich).
 * Alle Preise sind Startwerte (SW).
 */

/** Mischpreis, den der Anlieferer je kg bekommt */
export const PURCHASE_PRICE_PER_KG = 0.16;
/** Sofortprämie fürs korrekte Einsortieren je kg */
export const SORTING_BONUS_PER_KG = 0.05;

export interface SaleResult {
  eur: number;
  massKg: number;
  purity: number;
  dominant: string;
}

/**
 * Ab diesem Kontostand ist Schluss: Wer die Ware nicht bezahlen kann, bekommt
 * keine mehr geliefert. Ein kleiner Dispo bleibt — sonst steht das Spiel beim
 * ersten Fehlgriff (Design 02.09.2026).
 */
export const CREDIT_LIMIT_EUR = -1500;

export class Account {
  moneyEur = 5000; // Startkapital (SW)
  /** Statistik für HUD/Bilanz */
  purchasedKg = 0;
  sortedKg = 0;
  /** Magnet gekauft? Wird vom Ausbau gesetzt und wirkt beim Verkauf. */
  hasMagnet = false;

  /** Ankauf nach der Ausfahrtswiegung: Kunde erhält Geld. */
  /**
   * Ankauf nach der Ausfahrtswiegung.
   * @param factor ausgehandelter Anteil des Marktpreises (1 = voll)
   */
  payDelivery(netKg: number, factor = 1): number {
    const eur = netKg * PURCHASE_PRICE_PER_KG * factor;
    this.moneyEur -= eur;
    this.purchasedKg += netKg;
    return eur;
  }

  /**
   * Sortiertes Material festhalten. Geld gibt es dafür bewusst NICHT mehr:
   * verdient wird ausschließlich, wenn eine Ladung abgeholt und abgefahren
   * ist (Design-Fix 29.08.2026). Sonst trug sich das Spiel über Kleinkram
   * statt über den Verkauf.
   */
  noteSorted(massKg: number): void {
    this.sortedKg += massKg;
  }

  /**
   * Containerinhalt verkaufen — nach derselben Rechnung, die auf dem
   * Muldenschild steht (`containerValueGemischt`, E-094): jede Fraktion, die
   * zur Leitfraktion gehört, zu ihrem eigenen Preis; alles andere drückt die
   * Reinheit, und die zählt quadratisch.
   */
  /**
   * Kann noch angekauft werden? Händler wollen bezahlt werden, und wer nichts
   * hat, bekommt nichts. Erst wenn wieder Geld hereinkommt, geht es weiter.
   */
  get canBuy(): boolean {
    return this.moneyEur > CREDIT_LIMIT_EUR;
  }

  /** Wie knapp es ist — für die Warnung im HUD. */
  get lowOnCash(): boolean {
    return this.moneyEur < 800;
  }

  sellContainer(
    loaded: ScrapItem[],
    items: ItemManager,
    composites: CompositeManager,
    /** Bestellte Fraktion; null = der Abnehmer nimmt, was dominiert */
    order?: string | null
  ): SaleResult {
    const ware = loaded;
    if (ware.length === 0) return { eur: 0, massKg: 0, purity: 1, dominant: "" };
    /*
     * Gezaehlt wird nach FRAKTIONEN, gewogen nach der Zusammensetzung (E-094).
     *
     * Bis zum 16.09.2026 stand hier `c.materialId` — die Kasse rechnete ueber
     * ROHSTOFFE, das Muldenschild ueber FRAKTIONEN. Ein Kuehlschrank wog
     * danach 28,6 kg Stahl + 5,5 kg Alu + 3,3 kg Kupfer + 17,6 kg Kunststoff
     * und brachte 1,93 €; auf dem Schild der Mischschrott-Halde standen fuer
     * dasselbe Stueck 8,80 € (55 kg x 0,16 €/kg). 22 % — der teuerste der zehn
     * Widersprueche aus `docs/fraktionen.md`.
     *
     * Massgeblich ist das Schild. Drei Gruende, keiner davon Geschmack:
     *  1. `docs/02_Briefing.md` Kap. 9/10 schreibt „Erloes = Inhalt x
     *     Verkaufspreis x Reinheit²" — das rechnet das Schild, nicht die Kasse
     *     (die hatte hoch drei, ohne Quelle).
     *  2. E-091 hat dieselbe Frage an der PRESSE schon entschieden: „Der
     *     Unterschied ist der zwischen ‚woraus ist das gemacht' und ‚wohin
     *     gehoert das'. … danach sortiert der Spieler, danach rechnet das
     *     Muldenschild, danach bestellt der Abholer." Hier stand die letzte
     *     Stelle, die noch die Rohstoffe las.
     *  3. Der Ankaufspreis 0,16 €/kg ist genau der Verkaufspreis von
     *     Mischschrott (`PURCHASE_PRICE_PER_KG`, Kommentar in
     *     `docs/fraktionen.md` 1.4): „wer nur Mischschrott macht, arbeitet fuer
     *     null". Das geht nur auf, wenn ein Kuehlschrank als 55 kg
     *     Mischschrott abgerechnet wird. Ueber Rohstoffe brachte er 0,035 €/kg
     *     — der Spieler machte bei jedem Stueck Verlust, ohne dass das je
     *     jemand entschieden haette.
     *
     * Die GEWICHTE kommen weiter aus der Zusammensetzung, genau wie in
     * `press.ts` (E-079): Platzinventar — der Kehrbesen wiegt 14 kg und
     * besteht aus nichts — darf weder Geld bringen noch das Etikett stellen.
     */
    const massByMaterial = new Map<string, number>();
    let totalKg = 0;
    for (const it of ware) {
      // Presspakete bringen ihre Zusammensetzung mit: sie sagt, wie schwer das
      // Stueck wirtschaftlich ist. WOHIN es gehoert, sagt seine Fraktion.
      const wirtKg = (it.composition ?? [{ massKg: it.massKg }]).reduce(
        (s, c) => s + c.massKg,
        0
      );
      if (wirtKg <= 0) continue;
      /*
       * Ein Presspaket ist kein Stueck, sondern ein Buendel: `fraktionsmix`
       * sagt, welche Sortierarbeit darin steckt (E-094). Nur damit bleibt die
       * Zusage aus E-091 stehen — „ein Paket ist so sortenrein wie das, was
       * hineinging", und der Erloes vor und nach dem Zuschlagen derselbe.
       */
      for (const f of it.fraktionsmix ?? [{ materialId: it.materialId, massKg: wirtKg }]) {
        if (f.massKg <= 0) continue;
        massByMaterial.set(f.materialId, (massByMaterial.get(f.materialId) ?? 0) + f.massKg);
        totalKg += f.massKg;
      }
    }
    /*
     * Null Kilo heisst null Euro — und zwar bevor irgendetwas gerechnet wird.
     *
     * Das kommt seit dem 15.09.2026 wirklich vor: Platzinventar (der Besen,
     * spaeter der Muellcontainer) traegt die Zusammensetzung
     * `[{ materialId, massKg: 0 }]` und wiegt fuer die Wirtschaft nichts.
     * Faehrt der Abholer NUR damit los, bleibt hier eine leere Massentabelle
     * uebrig; ohne diese Zeile suchte `getMaterial("")` weiter unten eine
     * Fraktion, die es nicht gibt, und das Spiel bliebe stehen.
     *
     * Entfernt werden die Stuecke trotzdem — was auf dem Wagen liegt, faehrt
     * mit. Das Inventar ist am naechsten Tag wieder da
     * (`ItemManager.inventarNachtragen`).
     */
    if (totalKg <= 0) {
      for (const it of ware) {
        const wasCar = composites.despawnByBody(it.body);
        items.remove(it, !wasCar);
      }
      return { eur: 0, massKg: 0, purity: 1, dominant: "" };
    }
    // Wurde für eine Fraktion bestellt, zählt genau die — alles andere ist
    // Verunreinigung, auch wenn es zufällig mehr wiegt. Ohne Bestellung
    // entscheidet die schwerste Fraktion, Gleichstand deterministisch
    // gebrochen (W-10, `fraktionsgruppen.ts`).
    const preis = (id: string): number => getMaterial(id).sellPricePerKg;
    const dominant =
      order && massByMaterial.has(order) ? order : leitfraktion(massByMaterial, preis);
    /*
     * Was zur Leitfraktion gehoert, sagt die Silo-Reihe in `containers.ts`:
     * Messing gehoert zu Kupfer (KUPFER-LAGER), Zink zu Alu (ALU-LAGER), die
     * vier Abfallsorten zusammen (ABFALL). Keine zweite Liste — dieselbe
     * Quelle, aus der das Muldenschild sein „100 % sortenrein" nimmt.
     */
    const gehoert = (id: string): boolean => zaehltZu(dominant, id);
    // Der Magnet trennt Eisen von Nichteisen — und zwar in beide Richtungen:
    // Aus einer Buntmetallladung zieht er den Stahl heraus (der wird separat
    // vergütet, der Rest wird sortenreiner), aus einer Stahlladung bleibt
    // umgekehrt nur das Eisen übrig.
    const verkauftKg = totalKg; // fürs Umschlagskonto zählt die ganze Fuhre
    let magnetEur = 0;
    let bewertet = massByMaterial;
    const steelKg = massByMaterial.get("steel") ?? 0;
    if (this.hasMagnet && steelKg > 0 && steelKg < totalKg) {
      if (gehoert("steel")) {
        // Stahlfuhre: der Kran hebt nur das Eisen auf den Wagen, der Rest
        // bleibt liegen — was verkauft wird, ist sortenrein.
        bewertet = new Map([["steel", steelKg]]);
      } else {
        // Buntfuhre: das Eisen geht heraus und wird für sich vergütet.
        bewertet = new Map(massByMaterial);
        bewertet.delete("steel");
        magnetEur = steelKg * getMaterial("steel").sellPricePerKg;
      }
    }
    let wertKg = 0;
    let passendKg = 0;
    for (const [id, kg] of bewertet) {
      wertKg += kg;
      if (gehoert(id)) passendKg += kg;
    }
    const purity = wertKg > 0 ? passendKg / wertKg : 1;
    /*
     * DIESELBE Funktion, die das Muldenschild rechnet (`containers.ts`,
     * `Container.value`): jede passende Fraktion zu ihrem EIGENEN Preis, das
     * Fremde drueckt quadratisch (Briefing Kap. 7/10). Entsorgungsgebuehren
     * bleiben dabei ungedaempft — vier Abfallsorten gemischt kosten wieder
     * 17,00 € statt 0,25 € (W-9).
     */
    const eur = containerValueGemischt(bewertet, gehoert, preis) + magnetEur;
    this.moneyEur += eur;

    for (const it of ware) {
      const wasCar = composites.despawnByBody(it.body);
      items.remove(it, !wasCar);
    }
    return { eur, massKg: verkauftKg, purity, dominant };
  }
}
