/**
 * DAS FUNKGERAET IM FUEHRERHAUS (E-095).
 *
 * Drei Leute vom Platz melden sich: Mario von der Waage, Janine vom
 * Kaffeewagen, Lambert vom Radlader. Sie laufen ueber denselben Kanal wie
 * Achims Funk — eine Zeile im Durchlauf, zum Ueberhoeren, nichts zum
 * Wegklicken.
 *
 * ## Die eine Regel, nach der hier alles gebaut ist
 *
 * **Kein Spruch ohne Anlass.** Jeder Satz haengt an etwas, das wirklich
 * passiert ist: Mario an einer Fuhre, die gerade auf der Bruecke stand,
 * Janine an einem Kunden, der da ist und schon einmal da war, Lambert an
 * Schrott, der wirklich herumliegt. Es gibt in dieser Datei keinen Zaehler,
 * der von sich aus hochlaeuft, und keinen Zufallsauslöser.
 *
 * Der Grund ist nicht Sauberkeit, sondern Nerven: Geplapper, das an nichts
 * haengt, faellt nach zehn Minuten auf und ist danach nur noch Laerm. Ein
 * Satz, der stimmt, wird beim dritten Mal nicht falsch.
 *
 * Wenn nichts anliegt, schweigen alle drei. Das ist der Normalfall.
 *
 * ## Ton-Leitplanke (Projektregel 7)
 *
 * Milieu aus Beruf, Familie, Geschaeft — nie aus Herkunft. Besonders hier:
 *
 *  - **Mario misstraut der LADUNG, nie dem Menschen.** Kein Satz von ihm
 *    sagt etwas ueber den, der sie bringt. Er sieht Bauschutt zwischen dem
 *    Blech und schreibt es auf — das ist seine Arbeit an der Waage.
 *  - **Janine redet ueber das Geschaeft**, nicht ueber Leute: wer wie oft
 *    kommt, was einer sonst bringt, wie viele Haendler heute da waren.
 *  - **Lambert redet ueber den Platz**: was herumliegt, was im Weg steht, ob
 *    er noch gebraucht wird.
 *
 * Jeder Satz muss auch dann stimmen, wenn jemand ihn einzeln liest.
 *
 * ## Was hier NICHT steht
 *
 * Lambert nimmt hier keine Anweisungen an. Sein Verhalten liegt in
 * `world/people.ts` und wird gerade umgebaut; ein Befehlskanal waere eine
 * zweite Stelle, an der sein Kopf sitzt. Er fragt nach Arbeit und verweist
 * auf den Ruf, den es schon gibt (Taste Y / Knopf LAMBERT).
 */
import { getMaterial, istAbfall, normalizeMaterialId } from "../materials/catalog";

// --------------------------------------------------------------- Die Zahlen

/**
 * Mindestabstand zwischen zwei Funksprueche (s).
 *
 * SW: 8 s. Eine Einblendung steht 2,6 s (`hud.toast`); kaeme die naechste
 * frueher, ueberschriebe sie die laufende, und man haette zwei halbe Saetze
 * gelesen. Acht Sekunden lassen dazwischen noch Platz fuer eine Meldung der
 * Maschine.
 */
const FUNK_SPERRE_S = 8;

/**
 * So lange wartet ein Funkspruch, bevor er ins Bild geht (s).
 *
 * SW: 3,5 s. Der Anlass selbst erzeugt fast immer schon eine Einblendung —
 * die Waage meldet das Gewicht, der Kunde grüßt, das HUD meldet den Störfall.
 * Alles im selben Bild. Wer sofort funkt, überschreibt sie: Eine Einblendung
 * ersetzt die vorige, und der Spieler sieht nur die letzte. Beide Meldungen
 * wären dann halb verloren.
 *
 * Deshalb wartet der Funk, bis die Meldung der Maschine ausgeklungen ist
 * (2,6 s) und noch eine knappe Sekunde dazu. Das klingt obendrein richtig: Der
 * Waagemeister schaut erst hin und greift dann zum Hörer.
 */
const VORLAUF_S = 3.5;

/**
 * Ab diesem Anteil an der Fuhre faellt Mario der Abfall auf (0..1).
 *
 * SW: 0,06. Ein einzelner Reifen auf einer Tonne Blech sind rund 1 % — das
 * sieht niemand und das sagt auch keiner an. Sechs Prozent sind ein halber
 * Kubikmeter Bauschutt; das faellt beim Abkippen auf.
 */
const ABFALL_SCHWELLE = 0.06;

/**
 * Ab so vielen Fraktionen gilt eine Fuhre als „von allem was".
 *
 * SW: 4. Drei Sorten sind ein normaler Haufen (Blech, Profil, ein bisschen
 * Guss). Ab vier ist es nicht mehr sortiert, sondern zusammengekippt.
 */
const SORTEN_VIEL = 4;

/** Buntmetall, das in einem gemischten Haufen untergeht. Quelle: materials/catalog.ts */
const BUNTMETALL = ["copper", "brass", "cable"];

/**
 * Bis zu diesem Anteil gilt Buntmetall als „drin, aber nicht angemeldet".
 *
 * SW: 0,3. Darueber ist es der Hauptteil der Fuhre und jedem klar; darunter
 * liegt es zwischen dem Stahl, und genau danach schaut ein Waegemeister.
 */
const BUNT_VERSTECKT_BIS = 0.3;

/**
 * Ab so viel losem Schrott meldet Lambert sich (kg).
 *
 * SW: 1500 kg. Das ist ungefaehr eine volle Spinne mal zehn — so viel liegt
 * herum, wenn jemand eine Weile nicht aufgeraeumt hat. Darunter sieht ein
 * Schrottplatz aus wie ein Schrottplatz.
 */
const LOSE_SCHWELLE_KG = 1500;

/** Erst darunter meldet er es wieder (kg). SW: 900 — ein Drittel Luft, damit
 *  die Meldung nicht an der Schwelle flattert. */
const LOSE_RUHE_KG = 900;

/**
 * So lange darf etwas in der Fahrspur stehen, bevor Lambert es anspricht (s).
 *
 * SW: 25 s. Das HUD meldet die blockierte Spur sofort selbst; Lambert
 * wiederholte das nur. Nach einer halben Minute ist es dagegen eine neue
 * Nachricht: Es liegt immer noch da.
 */
const SPUR_GEDULD_S = 25;

/** Mindestabstand zwischen zwei Sprueche von Lambert (s). SW: 45 — er faehrt,
 *  er kommentiert nicht. */
const LAMBERT_SPERRE_S = 45;

// ------------------------------------------------------------- Die Sprecher

/** Wie sie sich am Funk melden. Der Name steht vor dem Spruch im HUD. */
export const MARIO = "Mario";
export const JANINE = "Janine";
export const LAMBERT = "Lambert";

/**
 * Die Anlaesse — und nur die, die es wirklich gibt.
 *
 * Jeder Anlass hier muss von einer der drei Eingangsmethoden erreichbar sein;
 * `test/funk-verdrahtung.test.ts` faehrt jeden einzeln an. Ein Anlass ohne
 * Weg dorthin ist ein Spruch, den nie jemand hoert — und der sieht im
 * Quelltext aus wie fertige Arbeit.
 */
export type Anlass =
  /** Mario: Abfall zwischen dem Schrott */
  | "abfallDrin"
  /** Mario: Buntmetall im gemischten Haufen */
  | "buntVersteckt"
  /** Mario: die Fuhre ist von allem was */
  | "vieleSorten"
  /** Mario: nach einem Befund kam eine saubere Fuhre */
  | "sauber"
  /** Janine: der Kunde war heute schon da, und wir wissen, was er brachte */
  | "kundeWieder"
  /** Janine: der Kunde war heute schon da */
  | "kundeBekannt"
  /** Janine: der dritte Haendler an einem Tag */
  | "vieleHaendler"
  /** Janine: von dem Betrieb war heute schon einer da */
  | "betriebWieder"
  /** Lambert: er hat seine Aufgabe zu Ende gebracht */
  | "lambertFertig"
  /** Lambert: in der Fahrspur steht seit einer Weile etwas */
  | "spurLange"
  /** Lambert: es liegt viel lose herum */
  | "vielLose";

/** Ein Funkspruch, fertig zum Anzeigen. */
export interface Funkspruch {
  /** Wer spricht */
  wer: string;
  /** Was er sagt */
  text: string;
  /** Woran es hing — fuer Tests und das Debug-Overlay */
  anlass: Anlass;
}

/**
 * Die Saetze.
 *
 * Feste Saetze stehen als Zeichenkette, Saetze mit einer Angabe aus der Lage
 * als Vorlage — genau wie bei Achim (`delivery/customers.ts`): Der Stoff kommt
 * aus dem Materialkatalog und aus keiner zweiten Liste, ein neues Material
 * bekommt seinen Spruch damit von selbst richtig.
 *
 * Laenge: zwei bis acht Woerter. Wer am Hebel sitzt, liest nebenbei.
 */
type Vorlage = (angabe: string) => string;

export const SPRUECHE: Record<Anlass, Vorlage[]> = {
  // --- Mario, Waage. Er redet ueber die Ladung, nie ueber den Fahrer. ------
  abfallDrin: [
    (n) => `${n} liegt mit drin. Kostet Entsorgung.`,
    (n) => `Ich seh ${n} auf der Fuhre.`,
    (n) => `${n} zwischen dem Schrott. Schreib ich auf.`,
  ],
  buntVersteckt: [
    (n) => `${n} unter dem Blech. Wiegen wir einzeln.`,
    (n) => `Da ist ${n} drin. Guck ich mir an.`,
    (n) => `${n} im gemischten Haufen. Ungewöhnlich.`,
  ],
  vieleSorten: [
    (z) => `${z} Sorten auf einer Fuhre. Ich schau nach.`,
    () => `Das ist von allem was. Langsam abladen.`,
    (z) => `${z} Sorten. Sortiert sich nicht von allein.`,
  ],
  sauber: [
    () => `Die hier ist sauber. Geht durch.`,
    () => `Sortenrein. Selten genug.`,
    () => `Nichts zu beanstanden. Weiter.`,
  ],
  // --- Janine, Kaffeewagen. Geschaeft und Tagesgeschehen, nichts ueber Leute.
  kundeWieder: [
    (n) => `Der hatte letztes Mal ${n}.`,
    (n) => `Bringt der wieder ${n}?`,
    (n) => `Beim letzten Mal war ${n} drauf.`,
  ],
  kundeBekannt: [
    () => `Den Wagen hatten wir heute schon.`,
    () => `Der ist heute zum zweiten Mal da.`,
    () => `Zweite Fuhre heute von dem.`,
  ],
  vieleHaendler: [
    (z) => `${z} Händler heute. Die Preise ziehen an.`,
    (z) => `Schon der ${z}. heute. Da ist was los.`,
    () => `Die Händler geben sich die Klinke.`,
  ],
  betriebWieder: [
    () => `Von denen war heute schon einer da.`,
    () => `Die fahren heute im Pendel.`,
    () => `Zweiter Wagen von der Firma.`,
  ],
  // --- Lambert, Radlader. Platz, Wege, Arbeit. ----------------------------
  lambertFertig: [
    () => `Boxen sind leer. Was noch?`,
    () => `Bin durch. Sag an.`,
    () => `Fertig hier. Brauchst du mich?`,
  ],
  spurLange: [
    () => `Da steht immer noch was im Weg.`,
    () => `Die Spur ist weiter dicht.`,
    () => `Der Weg ist immer noch zu.`,
  ],
  vielLose: [
    () => `Hier liegt einiges rum. Ruf mich.`,
    () => `Wird voll auf dem Platz. Sag Bescheid.`,
    () => `Da liegt was für mich. Ruf durch.`,
  ],
};

/** Wer welchen Anlass spricht. Eine Stelle, damit Anzeige und Test dasselbe sehen. */
export const SPRECHER: Record<Anlass, string> = {
  abfallDrin: MARIO,
  buntVersteckt: MARIO,
  vieleSorten: MARIO,
  sauber: MARIO,
  kundeWieder: JANINE,
  kundeBekannt: JANINE,
  vieleHaendler: JANINE,
  betriebWieder: JANINE,
  lambertFertig: LAMBERT,
  spurLange: LAMBERT,
  vielLose: LAMBERT,
};

// ------------------------------------------------------------------ Die Lage

/** Eine Fuhre, so wie die Waage sie sieht. */
export interface Fuhre {
  /** Bruttogewicht, wie es auf der Bruecke stand */
  kg: number;
  /** Fraktion, wenn die Fuhre sortenrein ist, sonst null */
  sortenrein: string | null;
  /** Zusammensetzung nach Masse, absteigend (`vehicles.activeCargoMix`) */
  mix: Array<{ materialId: string; share: number }>;
  /** Wer sie bringt — nur, damit Janine sich merkt, wer was bringt */
  kunde?: string;
}

/** Ein Kunde, so wie er auf den Hof faehrt. */
export interface Kunde {
  name: string;
  /** Milieu: Beruf, Betrieb, Geschaeft */
  subtitle: string;
  /** „privat", „haendler", „gewerbe" */
  group: string;
}

/** Was auf dem Platz los ist — einmal je Bild. */
export interface Platzlage {
  /** Schrott, der frei herumliegt (kg, `measureLoose()` in main.ts) */
  loseKg: number;
  /** Steht etwas in der Fahrspur? (`lanes.blocked`) */
  spurBlockiert: boolean;
  /** Hat Lambert gerade eine Aufgabe? (`staff.lambertArbeitet`) */
  lambertArbeitet: boolean;
}

// ------------------------------------------------------------ Die Zentrale

/**
 * Die Funkzentrale.
 *
 * Sie kennt weder Fahrzeuge noch Figuren noch Behaelter — sie bekommt
 * Tatsachen gereicht und entscheidet, ob daraus ein Satz wird. Deshalb laesst
 * sie sich ohne Browser, ohne Physik und ohne Welt pruefen.
 */
export class Funkzentrale {
  /** Hier kommt heraus, was gesendet wird. Ohne Empfaenger bleibt es still. */
  onSpruch: ((s: Funkspruch) => void) | null = null;

  /** Zeitquelle in Sekunden — im Test von aussen gestellt. */
  constructor(private jetzt: () => number = () => performance.now() / 1000) {}

  private letzterSpruch = -Infinity;
  /** Was gleich gesendet wird. Höchstens einer — der Kanal hat eine Leitung. */
  private wartend: { spruch: Funkspruch; ab: number } | null = null;
  /** Laufender Zeiger je Anlass: derselbe Satz kommt nie zweimal hintereinander. */
  private zeiger = new Map<Anlass, number>();

  // Mario
  private letzterBefund = false;

  // Janine
  private besuche = new Map<string, number>();
  private betriebe = new Map<string, number>();
  private gebracht = new Map<string, string>();
  private haendlerHeute = 0;
  private ankuenfte = 0;
  private janineZuletzt = -99;
  private letzterKunde: string | null = null;

  // Lambert
  private loseGemeldet = false;
  private spurSeit: number | null = null;
  private spurGemeldet = false;
  private lambertWarDran = false;
  private letzterLambert = -Infinity;

  // ---------------------------------------------------------------- Mario

  /**
   * Eine Fuhre steht auf der Bruecke (`vehicles.onWeighIn`).
   *
   * Mario sagt NUR etwas, wenn an der Ladung etwas ist. Zu jeder Fuhre einen
   * Satz waere das Geplapper, das hier ausdruecklich nicht gebaut wird — und
   * die Waage meldet das Gewicht ohnehin schon selbst.
   */
  wiegung(f: Fuhre): void {
    if (f.kunde) this.letzterKunde = f.kunde;
    const befund = this.befund(f);
    if (befund) {
      this.letzterBefund = true;
      this.merkeFuhre(f);
      this.melde(befund.anlass, befund.angabe);
      return;
    }
    // Sauber — das ist nur dann eine Nachricht, wenn die Fuhre davor es
    // nicht war. Sonst lobte er jede zweite Lieferung, und das nutzt sich ab.
    if (f.sortenrein && this.letzterBefund) {
      this.letzterBefund = false;
      this.merkeFuhre(f);
      this.melde("sauber", "");
      return;
    }
    if (f.sortenrein) this.letzterBefund = false;
    this.merkeFuhre(f);
  }

  /** Der erste Befund, der zutrifft — oder keiner. */
  private befund(f: Fuhre): { anlass: Anlass; angabe: string } | null {
    const mix = f.mix.map((m) => ({ ...m, materialId: normalizeMaterialId(m.materialId) }));
    const rein = f.sortenrein ? normalizeMaterialId(f.sortenrein) : null;

    // 1. Abfall zwischen dem Schrott. Wer Holz ANLIEFERT, bekommt dazu
    //    nichts zu hoeren — dann ist es keine Beimischung, sondern die Fuhre.
    if (!(rein && istAbfall(rein))) {
      const abfall = mix.filter((m) => istAbfall(m.materialId));
      const anteil = abfall.reduce((a, m) => a + m.share, 0);
      if (anteil >= ABFALL_SCHWELLE && abfall[0]) {
        return { anlass: "abfallDrin", angabe: getMaterial(abfall[0].materialId).name };
      }
    }
    // 2. Buntmetall, das im Haufen untergeht — nur bei gemischter Fuhre.
    if (!rein) {
      const bunt = mix.find(
        (m) => BUNTMETALL.includes(m.materialId) && m.share > 0 && m.share < BUNT_VERSTECKT_BIS
      );
      if (bunt) return { anlass: "buntVersteckt", angabe: getMaterial(bunt.materialId).name };
    }
    // 3. Von allem was.
    if (!rein && mix.length >= SORTEN_VIEL) {
      return { anlass: "vieleSorten", angabe: String(mix.length) };
    }
    return null;
  }

  /** Was dieser Kunde gebracht hat — Janines Gedaechtnis. */
  private merkeFuhre(f: Fuhre): void {
    const wer = f.kunde ?? this.letzterKunde;
    if (!wer) return;
    const haupt = f.sortenrein ?? f.mix[0]?.materialId;
    if (haupt) this.gebracht.set(wer, getMaterial(normalizeMaterialId(haupt)).name);
  }

  // --------------------------------------------------------------- Janine

  /**
   * Ein Kunde faehrt auf den Hof (`vehicles.onCustomerArrived`).
   *
   * Janine sagt nur dann etwas, wenn sie etwas ZU VERBINDEN hat: derselbe
   * Wagen wie vorhin, derselbe Betrieb, der dritte Haendler an einem Tag. Ein
   * Kunde, den sie heute zum ersten Mal sieht, ist kein Gespraechsstoff — und
   * genau das trennt Gerede von Klatsch.
   */
  kundeDa(k: Kunde): void {
    this.ankuenfte++;
    this.letzterKunde = k.name;
    const besuch = (this.besuche.get(k.name) ?? 0) + 1;
    this.besuche.set(k.name, besuch);
    const betrieb = k.subtitle ? (this.betriebe.get(k.subtitle) ?? 0) + 1 : 0;
    if (k.subtitle) this.betriebe.set(k.subtitle, betrieb);
    if (k.group === "haendler") this.haendlerHeute++;

    // Nicht bei jeder Ankunft — sonst steht sie am Tor statt am Kaffeewagen.
    if (this.ankuenfte - this.janineZuletzt < 2) return;

    let anlass: Anlass | null = null;
    let angabe = "";
    if (besuch >= 2 && this.gebracht.has(k.name)) {
      anlass = "kundeWieder";
      angabe = this.gebracht.get(k.name)!;
    } else if (besuch >= 2) {
      anlass = "kundeBekannt";
    } else if (k.group === "haendler" && this.haendlerHeute >= 3) {
      anlass = "vieleHaendler";
      angabe = String(this.haendlerHeute);
    } else if (betrieb >= 2) {
      anlass = "betriebWieder";
    }
    if (!anlass) return;
    if (this.melde(anlass, angabe)) this.janineZuletzt = this.ankuenfte;
  }

  // -------------------------------------------------------------- Lambert

  /**
   * Was auf dem Platz los ist — einmal je Bild, aus der Bildschleife.
   *
   * Alle drei Anlaesse haengen an einer FLANKE oder an einer Dauer, nie am
   * blossen Zustand: Sonst spraeche Lambert 48-mal je Sekunde dasselbe.
   */
  platzlage(l: Platzlage): void {
    const t = this.jetzt();
    // Erst durchgeben, was ansteht — das gilt für alle drei Stimmen.
    this.zustellen(t);

    // Merker pflegen — unabhaengig davon, ob gerade gesendet werden darf.
    if (l.lambertArbeitet) this.lambertWarDran = true;
    if (l.spurBlockiert) {
      if (this.spurSeit === null) this.spurSeit = t;
    } else {
      this.spurSeit = null;
      this.spurGemeldet = false;
    }
    if (this.loseGemeldet && l.loseKg < LOSE_RUHE_KG) this.loseGemeldet = false;

    // Sperrfrist: Er faehrt, er kommentiert nicht.
    if (t - this.letzterLambert < LAMBERT_SPERRE_S) return;

    /*
     * Ein Anlass je Durchgang, in dieser Reihenfolge. Und: Ein Merker wird
     * erst dann als „erledigt" gesetzt, wenn der Spruch auch WIRKLICH
     * hinausgegangen ist — sonst verschluckt eine Sperrfrist die Meldung
     * still, und zwar genau die, auf die es ankommt.
     */
    // 1. Er hat seine Aufgabe zu Ende gebracht und fragt nach der naechsten.
    if (this.lambertWarDran && !l.lambertArbeitet) {
      if (this.melde("lambertFertig", "")) {
        this.lambertWarDran = false;
        this.letzterLambert = t;
      }
      return;
    }
    // 2. In der Fahrspur steht seit einer Weile etwas. Das HUD meldet den
    //    Stoerfall sofort selbst — Lambert meldet, dass er noch besteht.
    if (!this.spurGemeldet && this.spurSeit !== null && t - this.spurSeit >= SPUR_GEDULD_S) {
      if (this.melde("spurLange", "")) {
        this.spurGemeldet = true;
        this.letzterLambert = t;
      }
      return;
    }
    // 3. Es liegt viel lose herum. Mit Rueckstellung, damit die Meldung nicht
    //    an der Schwelle flattert, und nur, wenn er gerade nichts zu tun hat.
    if (!this.loseGemeldet && l.loseKg >= LOSE_SCHWELLE_KG && !l.lambertArbeitet) {
      if (this.melde("vielLose", "")) {
        this.loseGemeldet = true;
        this.letzterLambert = t;
      }
    }
  }

  // ------------------------------------------------------------- Ausgang

  /**
   * Auf die Leitung legen — wenn sie frei ist. Liefert true, wenn der Spruch
   * angenommen wurde; heraus geht er `VORLAUF_S` später über `zustellen()`.
   */
  private melde(anlass: Anlass, angabe: string): boolean {
    const t = this.jetzt();
    if (this.wartend) return false; // es steht schon einer an
    if (t - this.letzterSpruch < FUNK_SPERRE_S) return false;
    this.letzterSpruch = t;
    const liste = SPRUECHE[anlass];
    const i = this.zeiger.get(anlass) ?? 0;
    this.zeiger.set(anlass, i + 1);
    const spruch: Funkspruch = {
      wer: SPRECHER[anlass],
      text: liste[i % liste.length]!(angabe),
      anlass,
    };
    this.wartend = { spruch, ab: t + VORLAUF_S };
    return true;
  }

  /**
   * Einen anstehenden Spruch durchgeben, sobald seine Zeit gekommen ist.
   *
   * Steht am Anfang von `platzlage()` und wird damit in jedem Bild gerufen.
   * Ohne diese Verbindung bliebe der Funk stumm — auch der von Mario und
   * Janine. Genau darum steht `funk.platzlage(…)` in der Liste der Zeilen, die
   * `main.ts` braucht, und genau darum bewacht `test/funk-verdrahtung.test.ts`
   * sie.
   */
  private zustellen(t: number): void {
    if (!this.wartend || t < this.wartend.ab) return;
    const s = this.wartend.spruch;
    this.wartend = null;
    this.onSpruch?.(s);
  }
}
