/**
 * Senderwahl fuers Kabinenradio.
 *
 * Bedienung wie beim Platzausbau: ein eigenes Feld, aus dem Pausenmenue
 * geoeffnet, ganzflaechige Knoepfe untereinander. Das ist der Weg, den es hier
 * schon gibt — ein Ausklappmenue oder eine Liste im Ausbaufeld waere ein
 * zweites Muster fuer dieselbe Sache, und auf dem iPad trifft der Daumen einen
 * breiten Knopf sicherer als eine Zeile in einer Liste.
 *
 * Farbe ist nie der einzige Kanal: Der laufende Sender traegt ein Zeichen und
 * das Wort dazu, nicht nur einen anderen Hintergrund.
 */
import { SENDER, findeSender, type Song } from "../audio/songs";
import { speichereRadio } from "../core/save";

/** Ein Eintrag der Senderliste, fertig zum Anzeigen. */
export interface SenderEintrag {
  id: string;
  /** Zeichen vorn: laufender Sender, gewaehlter Sender, sonst nichts */
  marke: string;
  /** Sendername und Frequenz */
  titel: string;
  /** Rechts: was dieser Sender gerade ist */
  stand: string;
  /** Kleingedruckt: wie er klingt */
  beschreibung: string;
  /** Der gewaehlte Sender ist im Menue hervorgehoben */
  gewaehlt: boolean;
}

/**
 * Die Liste, wie sie im Menue steht — ohne DOM, damit sie pruefbar bleibt.
 *
 * `an` ist der vorhandene Ein/Aus-Schalter. Er bleibt unangetastet: Ist das
 * Radio aus, laesst sich ein Sender trotzdem waehlen, er bleibt nur still.
 */
export function senderListe(aktivId: string, an: boolean): SenderEintrag[] {
  const aktiv = findeSender(aktivId).id;
  return SENDER.map((s) => {
    const gewaehlt = s.id === aktiv;
    return {
      id: s.id,
      marke: gewaehlt ? (an ? "▶" : "✓") : "·",
      titel: `${s.sender} ${s.frequenz}`,
      stand: gewaehlt ? (an ? "läuft" : "gewählt · Radio aus") : "wählen",
      beschreibung: s.beschreibung,
      gewaehlt,
    };
  });
}

/** Ansage nach einem Senderwechsel — kurz, neutral, ohne Ausrufezeichen. */
export function senderAnsage(s: Song, an: boolean): string {
  return an
    ? `${s.sender} ${s.frequenz} — ${s.beschreibung}`
    : `${s.sender} gewählt. Radio ist aus.`;
}

/** Was das Menue vom Ton braucht — mehr nicht. */
export interface RadioTon {
  readonly musicOn: boolean;
  readonly songId: string;
  toggleMusic(): boolean;
  setSong(id: string): boolean;
}

export interface RadioMenue {
  audio: RadioTon;
  toast: (text: string) => void;
  /** Pause verlassen, bevor das Feld aufgeht — wie beim Platzausbau */
  verlassePause: () => void;
  /** Sender aus dem Spielstand; fehlt er, bleibt es beim Standard */
  gewaehlt?: string;
}

/**
 * Menue anhaengen. Liefert die Oeffnen-Funktion, falls sie noch woanders
 * gebraucht wird (Taste, Funktionskranz).
 */
export function installRadio(m: RadioMenue): () => void {
  if (m.gewaehlt) m.audio.setSong(m.gewaehlt);

  const feld = document.getElementById("radio");
  const liste = document.getElementById("radio-list");
  const info = document.getElementById("radio-info");
  const schalter = document.getElementById("radio-power");
  const zurueck = document.getElementById("radio-close");
  const knopf = document.getElementById("pause-radio");
  // Ohne Markup passiert nichts — das Spiel laeuft weiter, nur ohne Senderwahl
  if (!feld || !liste || !info || !schalter || !zurueck) return () => {};

  const zeichne = (): void => {
    const an = m.audio.musicOn;
    info.textContent = an
      ? "Zwei Sender, beide selbst gespielt."
      : "Radio ist aus — der gewählte Sender bleibt still.";
    schalter.textContent = an ? "Radio ausschalten" : "Radio einschalten";
    liste.innerHTML = "";
    for (const e of senderListe(m.audio.songId, an)) {
      const b = document.createElement("button");
      b.className = e.gewaehlt ? "laeuft" : "";
      b.innerHTML =
        `${e.marke} ${e.titel}<span class="stand">${e.stand}</span>` +
        `<small>${e.beschreibung}</small>`;
      b.addEventListener("click", () => {
        if (m.audio.setSong(e.id)) {
          // Sofort in den vorhandenen Stand nachtragen, damit die Wahl auch
          // ohne ausdrueckliches Speichern einen Neustart uebersteht
          speichereRadio({ songId: e.id });
          m.toast(senderAnsage(findeSender(e.id), m.audio.musicOn));
        }
        zeichne();
      });
      liste.appendChild(b);
    }
  };

  schalter.addEventListener("click", () => {
    m.toast(m.audio.toggleMusic() ? "Musik an." : "Musik aus.");
    zeichne();
  });
  zurueck.addEventListener("click", () => feld.classList.remove("open"));

  const oeffne = (): void => {
    zeichne();
    feld.classList.add("open");
  };
  knopf?.addEventListener("click", () => {
    m.verlassePause();
    oeffne();
  });
  return oeffne;
}
