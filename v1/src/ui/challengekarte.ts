/**
 * DIE KARTE MIT DEM LERNSCHRITT (E-125) — dieselbe Karte wie der gefuehrte
 * Einstieg des Betriebs (`#tutorial`): gleiche Stelle, gleiche Bauart, kein
 * zweites Kaertchen. In einer Challenge gehoert sie der Challenge; der
 * Handelskreislauf ist dort nicht angeschlossen.
 *
 * Haengt nur am Bus (Regel 10). Die Platzhalter im Text werden HIER zu den
 * Namen der Bedienelemente, und zwar aus der Stickbelegung, die gerade gilt:
 * Wer im Steuerungsmenue umbelegt hat, liest seine eigene Belegung.
 */
import type { EventBus } from "../core/events";
import type { AxisId, ControlConfig, ControlFunction } from "../core/controlConfig";

const STICK: Record<AxisId, string> = {
  leftY: "linker Stick",
  leftX: "linker Stick",
  rightY: "rechter Stick",
  rightX: "rechter Stick",
};

/** Welche Achse fuehrt die Funktion? (die erste, wenn doppelt belegt) */
function achseVon(fn: ControlFunction, c: ControlConfig): AxisId | null {
  return (Object.keys(c) as AxisId[]).find((id) => c[id].fn === fn) ?? null;
}

/** „rechter Stick nach rechts" — die Richtung, in der die Funktion positiv laeuft. */
function richtung(id: AxisId, c: ControlConfig, plus: boolean): string {
  // Positiv ist der Bildschirmausschlag nach rechts bzw. nach unten (`touch.ts`),
  // die Umkehr dreht ihn; fuer die Spinne heisst positiv „schliessen".
  const rechtsOderUnten = plus !== c[id].invert;
  const quer = id.endsWith("X");
  return `${STICK[id]} nach ${quer ? (rechtsOderUnten ? "rechts" : "links") : rechtsOderUnten ? "unten" : "oben"}`;
}

/** Platzhalter `{schwenken}` usw. durch die Bedienelemente ersetzen. */
export function bedientext(text: string, c: ControlConfig): string {
  const achse = (fn: ControlFunction): string => {
    const id = achseVon(fn, c);
    if (!id) return "(im Menü unter Steuerung belegen)";
    return `${STICK[id]} ${id.endsWith("X") ? "seitlich" : "hoch/runter"}`;
  };
  const spinne = (plus: boolean): string => {
    const id = achseVon("grapple", c);
    return id ? richtung(id, c, plus) : "(im Menü unter Steuerung belegen)";
  };
  const fertig = text
    .replace(/\{schwenken\}/g, achse("cab"))
    .replace(/\{hauptarm\}/g, achse("boom"))
    .replace(/\{ausleger\}/g, achse("stick"))
    .replace(/\{schliessen\}/g, spinne(true))
    .replace(/\{oeffnen\}/g, spinne(false));
  // Jede Zeile beginnt gross, auch wenn sie mit einem Platzhalter anfaengt
  return fertig.replace(/(^|\n)(\S)/g, (_, a: string, b: string) => a + b.toUpperCase());
}

export function installChallengeKarte(m: {
  bus: EventBus;
  steuerung: () => ControlConfig;
  audio: { playCorrect(): void };
}): void {
  const karte = document.getElementById("tutorial");
  const schritt = document.getElementById("tut-schritt");
  const titel = document.getElementById("tut-titel");
  const text = document.getElementById("tut-text");
  const pause = document.getElementById("tut-pause");
  const skip = document.getElementById("tut-skip");
  if (!karte || !schritt || !titel || !text || !pause) return;
  // Ueberspringen gibt es hier nicht: ein Schritt ist geschafft, wenn er gesehen wurde
  if (skip) skip.style.display = "none";
  pause.addEventListener("click", () => {
    const zu = karte.classList.toggle("pausiert");
    pause.textContent = zu ? "weiter" : "Pause";
  });
  m.bus.on("challenge:schritt", (e) => {
    if (e.nr > 1) m.audio.playCorrect(); // der vorige Schritt ist geschafft
    schritt.textContent = `${e.nr}/${e.von}`;
    titel.textContent = e.titel;
    text.textContent = bedientext(e.text, m.steuerung());
    karte.classList.add("open");
  });
  m.bus.on("challenge:geschafft", () => karte.classList.remove("open"));
}
