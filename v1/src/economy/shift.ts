/**
 * Der Betrieb auf dem Platz (Briefing Kap. 21, Fassung 29.08.2026).
 *
 * Früher machte die Einfahrt zu, sobald genug Material dalag, und es gab eine
 * Sortierpause. Das hat den Platz leergespielt und war am Ende zäh. Jetzt
 * läuft der Umschlag durch: Es kommt immer Material nach, und woran man sich
 * misst, ist der Durchsatz — wie viele Tonnen an einem Tag über den Platz
 * gehen.
 *
 * Gesteuert wird nur noch die Dichte des Verkehrs. Ist der Platz voll,
 * kommen die Fuhren etwas seltener, aber sie hören nie ganz auf. Erst wenn
 * gar nichts mehr geht, macht die Einfahrt kurz zu — als Sicherheitsventil
 * gegen einen Platz, der sich selbst zustellt.
 *
 * ## Der Tag hat seit dem 22.09.2026 ein Ende (E-113)
 *
 * Bis dahin zählte diese Klasse den Durchsatz hoch und hörte nie auf: ein
 * Punktestand ohne Anzeigetafel. Jetzt gibt es Torschluss und Feierabend,
 * eine Tagesbilanz mit den drei Kennzahlen aus Briefing Kap. 11 und einen
 * nächsten Tag.
 *
 * DIE UHR STEHT NICHT HIER. Sie steht in `world/daylight.ts` und nirgends
 * sonst: `DAY_LENGTH_S = 900` (ein voller Tag in 15 Minuten Echtzeit),
 * `START_TIME = 0.28` (6:43, früher Morgen). Diese Klasse bekommt die
 * Tageszeit in `update()` gereicht und vergleicht sie mit zwei Schwellen —
 * sie zählt keine eigene Zeit mit. Eine zweite Uhr wäre der häufigste Fehler
 * dieses Projekts: zwei Stellen, die dasselbe wissen müssten, wissen es
 * verschieden.
 */

/** Ab hier gilt der Platz als gut gefüllt — der Verkehr wird etwas ruhiger. */
export const BUSY_KG = 6000;
/** Ab hier ist dicht: die Einfahrt macht zu, bis wieder Luft ist. */
export const JAM_KG = 16000;
/** Darunter läuft der Verkehr wieder normal an. */
export const JAM_CLEAR_KG = 11000;

// ------------------------------------------------------ Torschluss und Schluss

/**
 * Wann Feierabend ist — Tageszeit 0..1, dieselbe Zahl wie `daylight.time`.
 *
 * SW: 0,75 = 18:00. Das ist im Modell von `world/daylight.ts` genau der
 * Sonnenuntergang (`height = sin((time − 0,25) · 2π)` wird bei 0,75 negativ),
 * und ein Schrottplatz macht abends zu, nicht nachts. Ab 17:34 brennt in
 * diesem Modell schon das Flutlicht — der Spieler sieht den Tag zu Ende
 * gehen, bevor er es liest.
 *
 * Dauer einer Schicht daraus, mit der Tageslänge aus `daylight.ts`:
 * (0,75 − 0,28) · 900 s = 423 s ≈ 7 Minuten Echtzeit. Wer länger arbeiten
 * will, verschiebt DIESE Zahl — nicht die Tageslänge, sonst wandert mit ihr
 * auch der Sonnenstand.
 */
export const FEIERABEND_TIME = 0.75;

/**
 * Ab hier kommt keine neue Fuhre mehr aufs Gelände — der Verkehr läuft aus.
 *
 * SW: 0,7083 = 17:00, eine Stunde vor Feierabend, das sind 37,5 s Echtzeit.
 * Kurz genug, dass es keine Wartezeit ist, lang genug, dass die letzte Fuhre
 * noch gewogen und abgekippt wird, statt beim Abpfiff im Tor zu stehen.
 */
export const TORSCHLUSS_TIME = 0.7083;

// ------------------------------------------------------------- Die Sortierquote

/**
 * Ab hier ist eine Ladung sortenrein — grün im HUD, dritter Stern möglich.
 *
 * Dieselbe Zahl, die die Ladezeile des HUD grün färbt (`hud.updateLoad`), und
 * dieselbe, die Kap. 7 als lohnende Reinheit nennt: Der Erlös geht mit
 * Reinheit², unter 90 % frisst der Abschlag den Aufwand. Die Zeile im HUD
 * importiert diese Konstante, damit die Farbe am Container und der Stern am
 * Abend nicht von zwei Zahlen abhängen.
 */
export const REIN_GUT = 0.9;

/**
 * Darunter ist eine Ladung zusammengekippt — orange im HUD, kein zweiter Stern.
 *
 * SW: 0,65, wie bisher in der Ladezeile.
 */
export const REIN_MITTEL = 0.65;

/**
 * Die Sterne des Tages (Briefing Kap. 11: „Meilenstein-Sterne 1–3 je Tag nach
 * Gewinn + Sortierquote").
 *
 * Beide Bedingungen müssen zutreffen — ein Tag mit Gewinn und Schüttgut-Chaos
 * ist kein Drei-Sterne-Tag, und ein sauber sortierter Tag ohne Gewinn auch
 * nicht. Ein Stern ist der Boden: Der Tag hat stattgefunden, es gibt kein
 * Scheitern (Kap. 11, „Kein Game Over").
 *
 * Woher die Geldschwellen kommen: Stahlschrott bringt 0,25 €/kg × Reinheit²,
 * angekauft wird der Mischpreis 0,16 €/kg (`account.ts`). Sortenrein sind das
 * 90 € Rohertrag je Tonne.
 *  - 300 € ≈ 3,5 t sortenrein abgefahren. Das ist ein Tag, an dem gearbeitet
 *    wurde, ohne dass alles stimmen musste.
 *  - 800 € ≈ 9 t sortenrein — oder deutlich weniger, wenn Buntmetall dabei
 *    war (Kupfer 7,2 €/kg). Beides soll gelten: Masse oder Köpfchen.
 * Beide SW, am Gerät zu bestätigen.
 */
export const STERN_2_GEWINN_EUR = 300;
export const STERN_3_GEWINN_EUR = 800;

export function sterne(gewinnEur: number, sortierquote: number): 1 | 2 | 3 {
  if (gewinnEur >= STERN_3_GEWINN_EUR && sortierquote >= REIN_GUT) return 3;
  if (gewinnEur >= STERN_2_GEWINN_EUR && sortierquote >= REIN_MITTEL) return 2;
  return 1;
}

/**
 * Ø Kundenzufriedenheit, die dritte Kennzahl aus Kap. 11 — aus dem Ruf.
 *
 * Es gibt im Spiel keine zweite Zahl dafür, und es soll auch keine geben:
 * `economy/reputation.ts` führt den Ruf der drei Kundengruppen von −100 bis
 * +100, das IST die Zufriedenheit der Kundschaft. Hier wird sie nur auf
 * 0..1 gestreckt gemittelt, damit sie sich in Prozent anschreiben lässt.
 * Neutral (0) ergibt 50 % — das stimmt: Wer weder gelobt noch verstimmt ist,
 * ist mittelmäßig zufrieden.
 */
export function zufriedenheit(ruf: { get(gruppe: "privat" | "haendler" | "gewerbe"): number }): number {
  const mittel = (ruf.get("privat") + ruf.get("haendler") + ruf.get("gewerbe")) / 3;
  return Math.max(0, Math.min(1, (mittel + 100) / 200));
}

/** Die Abrechnung eines Tages, fertig zum Anzeigen. */
export interface Tagesbilanz {
  /** Welcher Arbeitstag zu Ende geht (1 = der erste) */
  tag: number;
  /** Heute abgefahrenes Material in kg */
  umschlagKg: number;
  /** Korrekt einsortierter Anteil des heute Abgefahrenen (0..1) */
  sortierquote: number;
  /** Kontostand jetzt minus Kontostand am Morgen */
  gewinnEur: number;
  /** Kontostand nach Feierabend */
  kontoEur: number;
  /** Ø Kundenzufriedenheit (0..1) */
  zufriedenheit: number;
  /** abgeschlossene Abholungen heute */
  pickups: number;
  /** Anlieferungen heute */
  deliveries: number;
  /** 1 bis 3 */
  sterne: 1 | 2 | 3;
}

export class Shift {
  /** Sekunden seit Tagesbeginn */
  t = 0;
  /**
   * Umgeschlagenes Material in kg, ÜBER ALLE TAGE.
   *
   * ACHTUNG, das ist der Karrierezähler und wird am Feierabend NICHT genullt:
   * Der Platzausbau hängt daran (`economy/upgrades.ts`: ab 15 t das Büro, ab
   * 160 t der Kran). Würde diese Zahl täglich bei null anfangen, wären alle
   * Ausbaustufen ab dem zweiten Tag wieder gesperrt — eine Tagesleistung sind
   * wenige Tonnen. Was heute über den Platz ging, steht in `heuteKg`.
   */
  turnoverKg = 0;
  /** Heute abgefahrenes Material in kg — die Tageswertung */
  heuteKg = 0;
  /**
   * Davon korrekt einsortiert (kg). Zähler der Sortierquote, siehe
   * `sortierquote`. Wächst nur in `noteTurnover()`.
   */
  heuteReinKg = 0;
  /** abgeschlossene Abholungen heute */
  pickups = 0;
  /** Anlieferungen heute */
  deliveries = 0;
  /** Welcher Arbeitstag läuft (1 = der erste) */
  tag = 1;
  /**
   * Kontostand am Morgen — Bezugspunkt für den Gewinn des Tages.
   *
   * null heißt: Dieser Stand kennt keinen Morgen (frisches Spiel, alter
   * Spielstand). Dann setzt `starte()` ihn beim Hochfahren auf den aktuellen
   * Kontostand; der Gewinn beginnt bei null statt beim Startkapital.
   */
  startKontoEur: number | null = null;
  /** true, solange der Platz zugestellt ist */
  jammed = false;
  /** true ab Torschluss: Es kommt nichts mehr herein. */
  torZu = false;
  /** true ab Feierabend, bis der nächste Tag beginnt. */
  feierabend = false;
  /**
   * Flanken für den Aufrufer. Beide bleiben stehen, bis jemand sie
   * zurücksetzt — dasselbe Muster wie `daylight.neuerTag`: So holt sie der
   * Aufrufer in seinem eigenen Takt ab, ohne dass hier ein Bus hängt.
   */
  torZuFlanke = false;
  feierabendFlanke = false;

  /**
   * @param timeOfDay Tageszeit 0..1 aus `daylight.time`. Fehlt sie, gibt es
   *   keinen Feierabend — so laufen alte Tests und Messläufe weiter, die den
   *   Tagesablauf nicht kennen.
   */
  update(dt: number, looseKg: number, timeOfDay?: number): void {
    this.t += dt;
    // Hysterese, damit die Einfahrt nicht im Sekundentakt auf und zu geht
    if (this.jammed) {
      if (looseKg < JAM_CLEAR_KG) this.jammed = false;
    } else if (looseKg > JAM_KG) {
      this.jammed = true;
    }
    if (timeOfDay === undefined) return;
    /*
     * Kein Vergleich mit der letzten Tageszeit, sondern ein Merker: Die Uhr
     * läuft um Mitternacht über (`% 1` in daylight.ts), und der Spielstand
     * kann mitten am Tag geladen werden. Ein Merker trifft in beiden Fällen
     * dieselbe Entscheidung — er fragt nur, ob es nach Torschluss ist.
     */
    if (!this.torZu && timeOfDay >= TORSCHLUSS_TIME && timeOfDay < 1) {
      this.torZu = true;
      this.torZuFlanke = true;
    }
    if (!this.feierabend && timeOfDay >= FEIERABEND_TIME && timeOfDay < 1) {
      this.feierabend = true;
      this.feierabendFlanke = true;
    }
  }

  /** Kommen gerade Anlieferer? Nach Torschluss nicht mehr. */
  get acceptsDeliveries(): boolean {
    return !this.jammed && !this.torZu;
  }

  /**
   * Faktor auf die Wartezeit zwischen zwei Fuhren. Auf einem leeren Platz
   * drängeln sie sich, auf einem vollen lassen sie etwas Luft — aber sie
   * kommen weiter.
   */
  intervalFactor(looseKg: number): number {
    if (looseKg <= 0) return 0.6;
    const f = 0.6 + (looseKg / BUSY_KG) * 0.9;
    return Math.min(f, 2.2);
  }

  /**
   * Abgefahrene Ladung verbuchen — die einzige Stelle, an der der Umschlag
   * und die Sortierquote wachsen.
   *
   * @param reinheit Sortenreinheit dieser Ladung (0..1), wie sie
   *   `account.sellContainer` zurückgibt: passende Masse durch Gesamtmasse.
   *   Ohne Angabe gilt die Ladung als sauber — damit bleibt jeder ältere
   *   Aufruf gültig, statt die Quote stillschweigend auf null zu ziehen.
   */
  noteTurnover(massKg: number, reinheit = 1): void {
    this.turnoverKg += massKg;
    this.heuteKg += massKg;
    this.heuteReinKg += massKg * Math.max(0, Math.min(1, reinheit));
    this.pickups++;
  }

  /**
   * DIE SORTIERQUOTE — eine Definition, hier und nur hier.
   *
   * Briefing Kap. 11 nennt sie „% korrekt einsortierte Masse". Also:
   *
   *     Sortierquote = Summe(Masse_Fuhre × Reinheit_Fuhre) / Summe(Masse_Fuhre)
   *
   * Nach Masse gewichtet, nicht je Fuhre gemittelt: Zehn saubere Kisten
   * Kabel wiegen die eine zusammengekippte Mulde Stahl nicht auf, wenn diese
   * zehnmal so schwer ist.
   *
   * Gemessen wird am AUSGANG, nicht am Behälter. Was in einer Box liegt, ist
   * noch nichts wert und noch nicht entschieden — man kann nachsortieren.
   * Gewertet wird, was den Platz verlässt; das ist auch die Masse, für die es
   * Geld gibt. Beides steigt in `noteTurnover()`, aus derselben Zahl, aus der
   * die Kasse den Erlös rechnet. Jede Anzeige leitet sich hiervon ab — auch
   * die Sterne.
   *
   * Ein Tag ohne Abfuhr hat keine Quote; er wird als sauber gezählt (1),
   * nicht als schlecht (0). Sonst stünde vor der ersten Abholung „✗ 0 %" im
   * Bild, obwohl niemand etwas falsch gemacht hat.
   */
  get sortierquote(): number {
    return this.heuteKg > 0 ? Math.min(this.heuteReinKg / this.heuteKg, 1) : 1;
  }

  /**
   * Bezugspunkt für den Gewinn festlegen, falls der Stand keinen kennt.
   *
   * Beim Hochfahren zu rufen. Absichtlich ohne Überschreiben: Ein Spielstand,
   * der mitten am Tag gespeichert wurde, bringt seinen Morgen mit, und der
   * darf nicht durch den Kontostand am Ladezeitpunkt ersetzt werden — sonst
   * zeigte die Abrechnung nur den Rest des Tages.
   */
  starte(kontoEur: number): void {
    if (this.startKontoEur === null) this.startKontoEur = kontoEur;
  }

  /** Die Abrechnung des Tages. Rechnet nur zusammen, verändert nichts. */
  bilanz(kontoEur: number, zufriedenheit01: number): Tagesbilanz {
    const quote = this.sortierquote;
    const gewinn = kontoEur - (this.startKontoEur ?? kontoEur);
    return {
      tag: this.tag,
      umschlagKg: this.heuteKg,
      sortierquote: quote,
      gewinnEur: gewinn,
      kontoEur,
      zufriedenheit: zufriedenheit01,
      pickups: this.pickups,
      deliveries: this.deliveries,
      sterne: sterne(gewinn, quote),
    };
  }

  /**
   * Nächster Tag. Die Tageszähler fangen bei null an, das Konto und der
   * Karrierezähler `turnoverKg` laufen weiter — man wacht nicht ärmer auf,
   * und ein gekaufter Kran bleibt gekauft.
   */
  naechsterTag(kontoEur: number): void {
    this.tag++;
    this.t = 0;
    this.heuteKg = 0;
    this.heuteReinKg = 0;
    this.pickups = 0;
    this.deliveries = 0;
    this.startKontoEur = kontoEur;
    this.torZu = false;
    this.feierabend = false;
    this.torZuFlanke = false;
    this.feierabendFlanke = false;
  }

  /** Kurztext fürs HUD. */
  statusText(looseKg: number): string {
    const t = (this.heuteKg / 1000).toFixed(1);
    if (this.jammed) return `Platz dicht · ${t} t umgeschlagen · erst räumen!`;
    // Nach Torschluss ist die Nachricht, dass nichts mehr kommt — der
    // Spieler soll nicht am Tor auf eine Fuhre warten, die ausbleibt.
    if (this.torZu) return `Tor zu · letzte Fuhre · ${t} t umgeschlagen`;
    return `${t} t umgeschlagen · ${Math.round(looseKg)} kg liegen`;
  }

  toJSON(): {
    t: number;
    turnoverKg: number;
    pickups: number;
    deliveries: number;
    heuteKg: number;
    heuteReinKg: number;
    tag: number;
    startKontoEur: number | null;
  } {
    return {
      t: this.t,
      turnoverKg: this.turnoverKg,
      pickups: this.pickups,
      deliveries: this.deliveries,
      heuteKg: this.heuteKg,
      heuteReinKg: this.heuteReinKg,
      tag: this.tag,
      startKontoEur: this.startKontoEur,
    };
  }

  /**
   * Betriebszahlen aus dem Spielstand.
   *
   * Ein Stand von vor dem 22.09.2026 kennt keinen Tag: Sein `turnoverKg` ist
   * über alle Sitzungen gewachsen (es wurde nie genullt) und bleibt darum der
   * Karrierezähler. Für heute gilt er als noch nicht abgefahren — es gibt
   * keine Angabe, wie viel davon von heute war. `heuteReinKg` fehlt dann
   * ebenfalls und wird gleich `heuteKg` gesetzt: kein Grund, einem alten
   * Stand nachträglich Chaos anzurechnen.
   *
   * Torschluss und Feierabend stehen bewusst NICHT im Stand. Sie kommen aus
   * der gespeicherten Tageszeit, sobald `update()` das erste Mal läuft — eine
   * Quelle, kein zweiter Merker, der ihr widersprechen könnte.
   */
  load(
    d:
      | {
          t?: number;
          turnoverKg?: number;
          pickups?: number;
          deliveries?: number;
          heuteKg?: number;
          heuteReinKg?: number;
          tag?: number;
          startKontoEur?: number | null;
        }
      | undefined
  ): void {
    if (!d) return;
    this.t = d.t ?? 0;
    this.turnoverKg = d.turnoverKg ?? 0;
    this.pickups = d.pickups ?? 0;
    this.deliveries = d.deliveries ?? 0;
    this.heuteKg = d.heuteKg ?? 0;
    this.heuteReinKg = d.heuteReinKg ?? this.heuteKg;
    this.tag = d.tag ?? 1;
    this.startKontoEur = typeof d.startKontoEur === "number" ? d.startKontoEur : null;
  }
}
