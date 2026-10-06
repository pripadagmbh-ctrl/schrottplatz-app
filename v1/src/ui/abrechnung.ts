/**
 * DER FEIERABEND UND SEINE ABRECHNUNG (E-113, 22.09.2026).
 *
 * Der Platz zählte seinen Durchsatz hoch und hörte nie auf — ein Punktestand
 * ohne Anzeigetafel. Hier ist die Tafel: Um 18:00 ist Schluss, das Bild
 * zeigt die drei Kennzahlen aus Briefing Kap. 11 (Sortierquote, Gewinn,
 * ø Kundenzufriedenheit) und ein bis drei Sterne, danach fängt der nächste
 * Tag an.
 *
 * ## Was hier NICHT entschieden wird
 *
 * Keine Zahl. Die Uhr steht in `world/daylight.ts`, Torschluss, Feierabend,
 * Sortierquote und Sterne stehen in `economy/shift.ts`. Dieses Modul zeigt an
 * und macht Geräusche; es rechnet nichts nach. Sonst gäbe es zwei
 * Sortierquoten, und eine davon wäre falsch.
 *
 * ## Der Weg eines Feierabends
 *
 * 1. `shift.update(dt, lose, daylight.time)` setzt die Flanken (Spiellogik).
 * 2. `takt()` liest sie ab und schickt `tag:torschluss` / `tag:feierabend`
 *    über den Bus (Projektregel 10: Anzeige und Ton hängen nur an Events).
 * 3. Wer will, hängt sich an: das Feld hier, die Glocke, das Funkgerät.
 * 4. WEITER stellt die Uhr auf den frühen Morgen und nullt die Tageszähler.
 */
import { START_TIME } from "../world/daylight";
import { platzwache } from "../world/platzinventar";
import { zufriedenheit, type Shift, type Tagesbilanz } from "../economy/shift";
import { reinheitsUrteil } from "./hud";
import type { EventBus, GameEvents } from "../core/events";
import { erfuellt, type ChallengeMessung, type Schwellen } from "../challenges/challenge";
import { nochmal, zumMenue } from "./hauptmenue";

/** Eine Zeile der Abrechnung: links das Wort, rechts die Zahl. */
export interface Abrechnungszeile {
  name: string;
  wert: string;
  /** Farbe der Zahl, wenn sie ein Urteil trägt (sonst der Grundton) */
  farbe?: string;
}

/** Tonnen, Prozent und Euro, wie man sie hier schreibt. */
function tonnen(kg: number): string {
  return `${(kg / 1000).toFixed(1).replace(".", ",")} t`;
}
function prozent(anteil01: number): string {
  return `${Math.round(anteil01 * 100)} %`;
}
function euro(eur: number): string {
  return `${Math.round(eur).toLocaleString("de-DE")} €`;
}

/**
 * Die Sternzeile: Zeichen UND Wort (Briefing Kap. 20 — Farbe und Symbol sind
 * nie der einzige Kanal, und drei Sternchen sind auf einem Handy klein).
 */
export function sterneZeile(sterne: number): string {
  const wort = ["kein", "ein", "zwei", "drei"][Math.max(0, Math.min(3, sterne))]!;
  return `${"★".repeat(sterne)}${"☆".repeat(3 - sterne)}  ${wort} von drei Sternen`;
}

/**
 * Die Zahlen des Tages als Zeilen — ohne DOM, damit sie prüfbar bleiben.
 *
 * Sechs Zeilen, keine sieben: Auf dem iPhone mini quer (375 px hoch) bleiben
 * neben Überschrift, Sternzeile und dem WEITER-Knopf keine mehr übrig. Darum
 * stehen Anlieferungen und Abholungen in einer Zeile.
 */
export function abrechnungszeilen(b: Tagesbilanz): Abrechnungszeile[] {
  const urteil = reinheitsUrteil(b.sortierquote);
  return [
    { name: "Umschlag heute", wert: tonnen(b.umschlagKg) },
    {
      name: "Sortierquote",
      wert: `${urteil.zeichen} ${prozent(b.sortierquote)} ${urteil.wort}`,
      farbe: urteil.farbe,
    },
    {
      name: "Gewinn",
      wert: `${b.gewinnEur >= 0 ? "+" : ""}${euro(b.gewinnEur)}`,
      // Das Vorzeichen ist der zweite Kanal, die Farbe nur die Bestätigung
      farbe: b.gewinnEur > 0 ? "#7ec96a" : b.gewinnEur < 0 ? "#e08a5a" : undefined,
    },
    { name: "Kontostand", wert: euro(b.kontoEur) },
    { name: "ø Zufriedenheit", wert: prozent(b.zufriedenheit) },
    { name: "Fuhren", wert: `${b.deliveries} rein · ${b.pickups} raus` },
  ];
}

/** Minuten:Sekunden, wie auf einer Stoppuhr. */
function uhr(s: number): string {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")} min`;
}

/**
 * Je Messgroesse ein Name und eine Schreibweise (E-125). Die Namen sind die
 * der Fahrkuenste (E-119); `wort` steht nur hinter dem eigenen Wert, nicht
 * hinter der Schwelle — sonst wird die Zeile zu breit fuers iPhone mini.
 */
const KRITERIEN: Record<keyof ChallengeMessung, { name: string; zahl: (v: number) => string; wort: string }> = {
  zeitS: { name: "Zeit", zahl: uhr, wort: "" },
  ruheGrad: { name: "Ruhe", zahl: (v) => `${Math.round(v)}°`, wort: " Pendel" },
  praezisionCm: { name: "Präzision", zahl: (v) => `${Math.round(v)} cm`, wort: " daneben" },
};

/**
 * Die Zahlen einer Challenge als Zeilen — ohne DOM, damit sie prüfbar bleiben.
 * Eine Zeile je Messgroesse, nach der die Challenge wertet; dahinter, was es
 * für drei Sterne braucht. Ob eine Schwelle erfuellt ist, entscheidet
 * `erfuellt` aus `challenges/challenge.ts` — hier wird nichts nachgerechnet.
 * Zeichen UND Farbe (Kap. 20): ✓ reicht für drei Sterne, ✗ nicht einmal für zwei.
 */
export function challengeZeilen(e: GameEvents["challenge:geschafft"]): Abrechnungszeile[] {
  const { zwei, drei } = e.wertung;
  const arten = (Object.keys(KRITERIEN) as Array<keyof ChallengeMessung>).filter(
    (k) => k in zwei || k in drei
  );
  return arten.map((k) => {
    const v = e.messung[k];
    const kr = KRITERIEN[k];
    if (v === null) return { name: kr.name, wert: "✗ nicht gemessen", farbe: "#e08a5a" };
    const wert = `${kr.zahl(v)}${kr.wort}${drei[k] === undefined ? "" : ` (★★★ bis ${kr.zahl(drei[k]!)})`}`;
    const nur = (s: Schwellen): Schwellen => ({ [k]: s[k] });
    if (k in drei && erfuellt(nur(drei), e.messung)) return { name: kr.name, wert: `✓ ${wert}`, farbe: "#7ec96a" };
    if (k in zwei && !erfuellt(nur(zwei), e.messung)) return { name: kr.name, wert: `✗ ${wert}`, farbe: "#e08a5a" };
    return { name: kr.name, wert };
  });
}

/** Was das Feld von außen braucht — mehr nicht. */
export interface AbrechnungsAnschluss {
  bus: EventBus;
  shift: Shift;
  hud: { toast(msg: string): void };
  audio: { playFeierabend(): void; playSterne(anzahl: number): void };
  funk: { torschluss(): void; neuerTag(): void };
  /** Kontostand jetzt — für Gewinn und den nächsten Morgen */
  konto: () => number;
  /** Der Ruf der drei Kundengruppen (`economy/reputation.ts`) */
  ruf: { get(gruppe: "privat" | "haendler" | "gewerbe"): number };
  /** Die Uhr aus `world/daylight.ts` — wird auf den Morgen zurückgestellt */
  daylight: { time: number; neuerTag: boolean };
}

export interface Abrechnung {
  /** Einmal je Bild aus der Bildschleife: holt die Flanken ab. */
  takt(): void;
  /** Steht das Feld im Bild? Solange ruht die Simulation. */
  readonly offen: boolean;
}

export function installAbrechnung(m: AbrechnungsAnschluss): Abrechnung {
  const feld = document.getElementById("abrechnung");
  const kopf = document.getElementById("abr-kopf");
  const sterneEl = document.getElementById("abr-sterne");
  const zahlen = document.getElementById("abr-zahlen");
  const weiter = document.getElementById("abr-weiter");
  let offen = false;

  /** Kopf, Sternzeile und Zahlen in die Tafel — fuer Feierabend und Challenge (E-125). */
  const fuelle = (kopfText: string, sterne: number, zeilen: Abrechnungszeile[]): boolean => {
    if (!feld || !kopf || !sterneEl || !zahlen) return false;
    kopf.textContent = kopfText;
    sterneEl.textContent = sterneZeile(sterne);
    zahlen.innerHTML = "";
    for (const z of zeilen) {
      const zeile = document.createElement("div");
      zeile.className = "zeile";
      const name = document.createElement("span");
      name.textContent = z.name;
      const wert = document.createElement("span");
      wert.className = "wert";
      wert.textContent = z.wert;
      if (z.farbe) wert.style.color = z.farbe;
      zeile.append(name, wert);
      zahlen.appendChild(zeile);
    }
    feld.classList.add("open");
    offen = true;
    return true;
  };

  const zeige = (b: Tagesbilanz): void => {
    m.audio.playFeierabend();
    m.audio.playSterne(b.sterne);
    if (!fuelle(`FEIERABEND · TAG ${b.tag}`, b.sterne, abrechnungszeilen(b))) {
      // Ohne Markup bleibt die Abrechnung eine Einblendung — das Spiel läuft
      // weiter, statt am fehlenden Feld hängenzubleiben.
      m.hud.toast(`Feierabend · ${tonnen(b.umschlagKg)} · ${sterneZeile(b.sterne)}`);
    }
  };

  /*
   * Das Ende einer Challenge (E-125) — dieselbe Tafel, keine zweite Art
   * Abschlussbild. WEITER heisst hier NOCHMAL, darunter steht ZUM MENÜ.
   * Ohne Glocke: Es ist kein Feierabend, nur die Sterntöne.
   */
  let challengeId: string | null = null;
  const menue = document.getElementById("abr-menue");
  m.bus.on("challenge:geschafft", (e) => {
    m.audio.playSterne(e.sterne);
    challengeId = e.id;
    if (!fuelle(`GESCHAFFT · ${e.name}`, e.sterne, challengeZeilen(e))) {
      m.hud.toast(`Geschafft · ${sterneZeile(e.sterne)}`);
      return;
    }
    if (weiter) weiter.textContent = "NOCHMAL";
    if (menue) menue.hidden = false;
  });
  menue?.addEventListener("click", zumMenue);

  const weiterSpielen = (): void => {
    if (!offen) return;
    if (challengeId) {
      nochmal(challengeId);
      return;
    }
    offen = false;
    feld?.classList.remove("open");
    /*
     * Der neue Morgen. Die Uhr springt auf `START_TIME` (6:43) — dieselbe
     * Zahl, mit der das Spiel anfängt.
     *
     * Achtung, hier hängen zwei ältere Sachen dran: Weil die Uhr nun nie mehr
     * über Mitternacht läuft, würde der Tageswechsel in `daylight.update()`
     * nie wieder auslösen — der Kehrbesen käme nach einem Missgeschick nie
     * zurück (E-031) und der Müllcontainer würde nie geleert (E-034). Darum
     * werden beide Wege hier von Hand angestoßen. Sie zusammenzulegen ist ein
     * eigenes Paket; `world/daylight.ts` vermerkt das seit dem 15.09.2026.
     */
    m.daylight.time = START_TIME;
    m.daylight.neuerTag = true;
    platzwache.neuerTag();
    m.shift.naechsterTag(m.konto());
    m.bus.emit("tag:neu", { tag: m.shift.tag });
  };

  weiter?.addEventListener("click", weiterSpielen);
  /*
   * Eingabetaste als Beigabe, nicht als Weg: Beschriftet ist die Fläche
   * („WEITER"), und auf dem iPad gibt es keine Tastatur. Eine Taste ohne
   * Fläche wäre hier ein Sackgasse.
   */
  window.addEventListener("keydown", (e) => {
    if (!offen) return;
    if (e.code === "Enter" || e.code === "NumpadEnter") weiterSpielen();
  });

  m.bus.on("tag:torschluss", () => m.funk.torschluss());
  m.bus.on("tag:feierabend", (b) => zeige(b));
  m.bus.on("tag:neu", (e) => {
    m.funk.neuerTag();
    m.hud.toast(`Tag ${e.tag} — die Einfahrt ist wieder offen.`);
  });

  return {
    takt(): void {
      if (m.shift.torZuFlanke) {
        m.shift.torZuFlanke = false;
        m.bus.emit("tag:torschluss", {});
      }
      if (m.shift.feierabendFlanke) {
        m.shift.feierabendFlanke = false;
        m.bus.emit("tag:feierabend", m.shift.bilanz(m.konto(), zufriedenheit(m.ruf)));
      }
    },
    get offen(): boolean {
      return offen;
    },
  };
}
