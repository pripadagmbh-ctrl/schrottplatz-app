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
import type { EventBus } from "../core/events";

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

  const zeige = (b: Tagesbilanz): void => {
    m.audio.playFeierabend();
    m.audio.playSterne(b.sterne);
    if (!feld || !kopf || !sterneEl || !zahlen) {
      // Ohne Markup bleibt die Abrechnung eine Einblendung — das Spiel läuft
      // weiter, statt am fehlenden Feld hängenzubleiben.
      m.hud.toast(`Feierabend · ${tonnen(b.umschlagKg)} · ${sterneZeile(b.sterne)}`);
      return;
    }
    kopf.textContent = `FEIERABEND · TAG ${b.tag}`;
    sterneEl.textContent = sterneZeile(b.sterne);
    zahlen.innerHTML = "";
    for (const z of abrechnungszeilen(b)) {
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
  };

  const weiterSpielen = (): void => {
    if (!offen) return;
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
