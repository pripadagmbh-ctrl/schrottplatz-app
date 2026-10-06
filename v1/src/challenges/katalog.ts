import type { ChallengeDaten } from "./challenge";
import { START_AUTOS } from "../world/startplatz";
import { PRESS_CENTER } from "../world/press";

/**
 * DIE CHALLENGES — Daten, kein Code (E-125, 06.10.2026).
 *
 * Patrick: „Mit Challenges soll das Spiel anfangen, damit die Steuerung klar
 * wird. Wir starten bswp. mit dem verladen eines autos in die Presse."
 *
 * Bewusst nur EINE. Patrick beurteilt erst diese; die naechste ist ein
 * weiterer Eintrag in dieser Liste (Aufbau, Schritte aus dem Vorrat in
 * `challenge.ts`, Schwellen), keine neue Datei.
 *
 * Die erste der Liste ist die, mit der das Spiel beim allerersten Start
 * beginnt (`ui/hauptmenue.ts`).
 */
export const CHALLENGES: readonly ChallengeDaten[] = [
  {
    id: "verladen",
    name: "AUTO IN DIE PRESSE",
    beschreibung: "Ein Wrack greifen, zur Presse schwenken, einlegen, pressen. Hier lernst du die Steuerung.",
    /*
     * Das Wrack steht auf dem Platz des zweiten Startautos: im Schwenkband
     * (8,7 m vom Sitz), nicht in der Presse, frei von den Trennsteinen —
     * gerechnet und bewacht in `test/startplatz.test.ts`. Von dort sind es
     * rund 55 Grad Schwenk bis zur Presse; fahren muss man nicht.
     */
    aufbau: { wracks: [START_AUTOS[1]!] },
    // Ablageziel ist die Kammermitte — dieselbe Zahl, um die die Presse gebaut ist
    ablageziel: { x: PRESS_CENTER.x, z: PRESS_CENTER.z },
    schritte: [
      {
        beobachtet: "wrack_gefasst",
        titel: "Greif das Wrack",
        /*
         * „hinter dir": Der Bagger schaut beim Start nach +z (`heading = 0`),
         * das Wrack steht 8,5 m in −z — also hinter der Kabine, ausserhalb des
         * ersten Bilds. Ohne diesen Satz sucht man es.
         */
        text:
          "Das Wrack steht hinter dir.\n" +
          "{schwenken}: Oberwagen drehen\n" +
          "{hauptarm}: Hauptarm heben/senken\n" +
          "{ausleger}: Ausleger heran/weg\n" +
          "Spinne aufs Wrack senken, dann\n" +
          "{schliessen}: Spinne schließen",
      },
      {
        // Die Griffe kennt er jetzt — hier steht nur noch das Ziel
        beobachtet: "wrack_ueber_kammer",
        titel: "Ab zur Presse",
        // Die Presse steht bei x −8 neben dem Sitz (x −0,5) — vom Fahrer aus rechts
        text: "Heb das Wrack an und schwenk es über die offene Kammer der Presse, rechts neben dem Bagger.",
      },
      {
        beobachtet: "wrack_in_kammer",
        titel: "Ablegen",
        text: "Absenken, dann\n" + "{oeffnen}: Spinne öffnen\n" + "Ruhig und mittig gibt Sterne.",
      },
      {
        beobachtet: "wrack_gepresst",
        titel: "Pressen",
        text: "Rechten Daumen auflegen und stillhalten: Der Funktionskranz klappt auf. Zu SCHERE ziehen und loslassen.",
      },
    ],
    /*
     * Sterne: einer fuer geschafft. Zwei fuer SAUBER abgelegt, drei fuer
     * sauber UND zuegig. Alle Zahlen SW, nach Patricks ersten Laeufen
     * nachzustellen.
     *
     * Ruhe (Grad Pendel beim Loslassen, E-119). Gemessen mit
     * `tools/pendelausschlag.ts` (06.10.2026, 900 kg in der Spinne): Wer aus
     * vollem Schwenk loslaesst, hat 13,9–14,8 Grad; haelt der Oberwagen an,
     * ist das Pendel nach 2,5 s unter 1 Grad. Also: unter 10 Grad = vor dem
     * Loslassen abgebremst (zwei), unter 3 Grad = gewartet, bis die Spinne
     * still haengt, oder auf dem Kammerboden abgesetzt (drei).
     *
     * Praezision (cm von der Kammermitte, E-119). Die Kammer ist 4,20 x 4,05 m
     * (`PRESS_INNER`), das Wrack 4,0 x 1,7 m: Quer bleiben je Seite 1,17 m
     * bis zur Wand. Unter 100 cm liegt es also ganz drin, ohne anzustossen
     * (zwei); unter 40 cm — einem Drittel davon — liegt es mittig (drei).
     *
     * Zeit (s vom Start bis zum Stempel, ohne Pause, mit den rund 5 s, die die
     * Presse selbst braucht). Nicht gemessen, geschaetzt: Schwenk 55 Grad bei
     * 33 Grad/s sind keine 2 s, Greifen, Heben, Absenken, Liegen und Pressen
     * zusammen eine knappe Minute fuer Geuebte. Zwei Minuten (drei Sterne)
     * schafft man im zweiten Lauf; im ersten liest man die Karten.
     */
    wertung: {
      zwei: { ruheGrad: 10, praezisionCm: 100 }, // SW, Herkunft oben
      drei: { ruheGrad: 3, praezisionCm: 40, zeitS: 120 }, // SW, Herkunft oben
    },
  },
];

export function challengeNach(id: string): ChallengeDaten | null {
  return CHALLENGES.find((c) => c.id === id) ?? null;
}
