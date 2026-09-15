/**
 * Schüttdichten — was eine Fuhre wiegt, die man nach Volumen belädt.
 *
 * Anlass (Patrick, 15.09.2026): „Es ist halt bei Händlern halt auch nicht
 * immer das Gewicht, sondern eher das Volumen auf der Ladefläche."
 *
 * Bis dahin kannte das Spiel nur Kilogramm. Zwei Fuhren mit je 2.500 kg sahen
 * deshalb gleich aus — obwohl 2.500 kg Aluminiumprofile über die Bordwand
 * ragen und 2.500 kg Messingarmaturen als flacher Fleck auf dem Boden der
 * Pritsche liegen. Diese Tabelle ist der Unterschied.
 *
 * ACHTUNG, Schüttdichte ist nicht Feststoffdichte. Loser Schrott ist zur
 * Hälfte Luft: Stahl selbst wiegt 7.850 kg/m³, loser Stahlschrott 600 bis 900.
 * Der Branchen-Faustwert lautet „eine Tonne Stahlschrott sind 1,2 bis 1,5 m³"
 * (= 667 bis 833 kg/m³); die Werte unten liegen in diesem Rahmen.
 *
 * Herkunft je Zahl steht am Eintrag. Wo keine belastbare Quelle vorlag, steht
 * `SW` (Startwert zum Austesten, Projektregel 3) mit der Überlegung dahinter.
 */
import { normalizeMaterialId } from "./catalog";

/**
 * Schüttdichte in kg/m³, so wie das Material lose auf der Ladefläche liegt —
 * ungepresst, unzerkleinert, wie es beim Kunden anfällt.
 */
export const SCHUETTDICHTE: Record<string, number> = {
  // Sammelschrott E1/E3, lose: Faustwert 1 t = 1,2–1,5 m³, also 667–833 kg/m³.
  // 750 ist die Mitte dieses Bandes.
  steel: 750,
  // VA kommt als Blech, Rohr und Behälterteil — sperriger als Stahlschrott,
  // obwohl das Material selbst schwerer ist. SW.
  va: 700,
  // Alu: Profile, Felgen, Bleche, Fensterrahmen. Alu wiegt ein Drittel von
  // Stahl (2.700 gegen 7.850 kg/m³) und liegt genauso locker. SW, abgeleitet
  // aus steel × (2700/7850) = 258.
  alu: 250,
  // Kupfer: Rohre und Wickel, dicht gepackt, aber hohl. SW.
  copper: 900,
  // Messing: Armaturen, Hähne, Ventile — kompakte Vollteile, das schwerste,
  // was in normalen Mengen ankommt. SW.
  brass: 1400,
  // Zink: Dachrinnen, Fallrohre, Verzinktes. Röhren und Bleche, viel Luft. SW.
  zinc: 350,
  // Bleiakkus stehen dicht an dicht auf der Palette, praktisch ohne Lücke.
  // Ein 60-Ah-Akku wiegt 16 kg bei rund 0,01 m³, macht 1.600 kg/m³.
  battery: 1600,
  // Kabelbunde und Trommelreste: viel Luft zwischen den Windungen. SW.
  cable: 450,
  // Mischschrott, wie ein Händler ihn lose auflädt: überwiegend Stahl,
  // dazwischen Blech, Hohlkörper und Kleinkram. Leichter als sortenreiner
  // Stahlschrott, weil nichts gestapelt wird. SW.
  mixed: 620,

  // --- Abfallfraktionen: fressen Volumen, wiegen fast nichts ---
  // Altholz lose, unzerkleinert: 0,2–0,3 t/m³.
  wood: 250,
  // PKW-Reifen lose geschüttet: 0,1–0,2 t/m³.
  tires: 150,
  // Baumischabfall lose: 0,25–0,35 t/m³.
  rubble: 300,
  // Kunststoff lose (Folie, Hohlkörper, Formteile): unter 0,1 t/m³.
  plastic: 90,
};

/** Fallwert für eine Fraktion ohne Eintrag — so schwer wie Mischschrott. SW. */
const STANDARD_DICHTE = 620;

/** Schüttdichte einer Fraktion in kg/m³. */
export function schuettdichte(id: string): number {
  return SCHUETTDICHTE[id] ?? SCHUETTDICHTE[normalizeMaterialId(id)] ?? STANDARD_DICHTE;
}

/**
 * Störstoff ist kein Material, sondern ein Gemisch: Holz, Reifen,
 * Baumischabfall, Kunststoff. Als Schüttdichte zählt ihr Mittel — und das ist
 * der Grund, warum eine verunreinigte Fuhre voller aussieht, als sie wiegt.
 */
export const STOERSTOFFE = ["wood", "tires", "rubble", "plastic"] as const;

export function stoerstoffDichte(): number {
  return STOERSTOFFE.reduce((s, id) => s + schuettdichte(id), 0) / STOERSTOFFE.length;
}

/**
 * Mischdichte einer Ladung aus Volumenanteilen.
 *
 * Die Anteile sind **Volumen**anteile, nicht Gewichtsanteile — genau darum
 * geht es: Wer ein Viertel der Ladefläche mit Kunststoff belegt, hat ein
 * Viertel weniger Platz und kaum mehr Gewicht. Die Anteile werden auf 1
 * normiert; eine leere Angabe ergibt Mischschrott.
 */
export function mischDichte(anteile: Record<string, number>): number {
  let summe = 0;
  let masse = 0;
  for (const [id, anteil] of Object.entries(anteile)) {
    if (!(anteil > 0)) continue;
    summe += anteil;
    masse += anteil * schuettdichte(id);
  }
  return summe > 0 ? masse / summe : STANDARD_DICHTE;
}

/**
 * Dichte einer Anlieferung aus Hauptfraktion und Störstoffanteil.
 *
 * @param hauptfraktion Fraktions-ID, oder null für eine gemischte Fuhre
 * @param stoerstoffAnteil Volumenanteil Holz/Reifen/Kunststoff/Baumisch (0–1)
 */
export function ladungsDichte(
  hauptfraktion: string | null,
  stoerstoffAnteil: number
): number {
  // NaN käme aus einem halb gefüllten Profil und würde sich durch die ganze
  // Rechenkette ziehen, ohne dass ein Vergleich je fehlschlägt (Lehre
  // 15.09.2026). Deshalb hier abfangen, nicht weiterreichen.
  const stoer = Number.isFinite(stoerstoffAnteil)
    ? Math.min(1, Math.max(0, stoerstoffAnteil))
    : 0;
  const haupt = schuettdichte(hauptfraktion ?? "mixed");
  return haupt * (1 - stoer) + stoerstoffDichte() * stoer;
}
