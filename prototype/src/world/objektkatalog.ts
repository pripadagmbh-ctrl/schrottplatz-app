/**
 * Objektkatalog — die Erweiterung des Sortiments (12.09.2026).
 *
 * Hier stehen die Objekte aus `docs/objektpool-erweiterung.md`, in genau der
 * Struktur, die `scrapItems.ts` schon kennt: `PileSpec` mit Fraktion, Masse,
 * Form und Maßen. Keine neuen Felder, keine neue Mechanik — die drei Listen
 * unten werden in `scrapItems.ts` einfach an die vorhandenen angehängt.
 *
 * Warum eine eigene Datei: `scrapItems.ts` ist die Werkstatt für Physik,
 * Dämpfung und Kollider. Ein Katalog von zweihundert Gegenständen gehört da
 * nicht mitten hinein — er ändert sich nach anderen Regeln und wird von
 * anderen Leuten gepflegt.
 *
 * **Einteilung nach Masse und Maß**, nicht nach Thema:
 *
 * - `KATALOG_SPECS` — bis rund 210 kg, längste Kante bis 2,2 m. Landet im
 *   Starthaufen und in gewöhnlichen Ladungen.
 * - `KATALOG_BIG` — bis rund 600 kg, bis 3,4 m. Großteile für
 *   Händleranlieferungen.
 * - `KATALOG_HUGE` — bis rund 2600 kg, bis 4,8 m. Schwergewichte, die einen
 *   Auflieger füllen.
 *
 * Die Obergrenzen sind keine Willkür: Der Ausleger reicht gut acht Meter, und
 * die schwerste Last im Bestand wiegt 2400 kg. Ein Objekt, das niemand heben
 * oder das keiner um die eigene Achse schwenken kann, ist im Spiel kein
 * Objekt, sondern ein Hindernis. Reale Riesen (Waggonkasten, 40-Fuß-Container,
 * Rangierlok) stehen deshalb in der Größe drin, in der ein Umschlagbagger sie
 * tatsächlich noch bewegt — als Kasten, Segment oder ausgeschlachteter Rest.
 *
 * Lose Schüttgüter — Beton, Ziegel, Asphalt, Naturstein, Schotter, Kies, Sand,
 * Erde — sind bewusst **nicht** dabei (Ansage 12.09.2026). Was rieselt, ist
 * mit einem Greifer nicht zu fassen und bräuchte eigene Mechanik.
 */
import type { ScrapShape } from "./scrapItems";
import type { BauId } from "./objektbau";

export interface PileSpec {
  materialId: string;
  massKg: number;
  kind: ScrapShape["kind"];
  dims: number[];
  /** Aus welchen Bauteilen — ohne Angabe bleibt es der nackte Grundkörper. */
  bau?: BauId;
}

/* ------------------------------------------------------------------------ */
/* Klein und mittel — Starthaufen und gewöhnliche Ladungen                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_SPECS: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.9, 1.1, 0.3], bau: "stapel" }, // Silo-Blechsegment
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.45, 0.45, 2.2], bau: "rahmenbox" }, // Melkstand-Gitterwerk
  { materialId: "steel", massKg: 180, kind: "cyl", dims: [0.3, 1.8], bau: "rohrFlansch" }, // Häcksler-Auswurfkrümmer
  { materialId: "steel", massKg: 150, kind: "box", dims: [1.0, 0.14, 2.1], bau: "platte" }, // Kartoffelroder-Siebkette

  // --- Industrie ---
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.2, 0.8, 0.8], bau: "rahmenbox" }, // Gitterbox
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.9, 0.55, 0.8], bau: "elektromotor" }, // Kreiselpumpe mit Grundplatte
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.65, 0.6, 0.7], bau: "maschine" }, // Großgetriebe (Industrie)
  { materialId: "steel", massKg: 190, kind: "box", dims: [1.1, 1.0, 0.75], bau: "maschine" }, // Schraubenkompressor
  { materialId: "steel", massKg: 130, kind: "cyl", dims: [0.32, 1.6], bau: "rohrFlansch" }, // Wärmetauscher-Bündel
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.7, 0.7, 1.9], bau: "buendel" }, // Lüftungskanäle (Bündel)
  { materialId: "steel", massKg: 160, kind: "box", dims: [1.3, 0.45, 2.2], bau: "ausleger" }, // Späneförderer
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.85, 0.7, 0.9], bau: "maschine" }, // Hallenkran-Laufkatze
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.25, 0.25, 2.2], bau: "buendel" }, // Palettenregal-Traversen (Bund)

  // --- Haushalt ---
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.6, 1.7, 0.6], bau: "weisseWare" }, // Kühlschrank
  { materialId: "steel", massKg: 62, kind: "box", dims: [1.3, 0.85, 0.65], bau: "weisseWare" }, // Gefriertruhe
  { materialId: "steel", massKg: 33, kind: "box", dims: [0.6, 0.85, 0.6], bau: "weisseWare" }, // Wäschetrockner
  { materialId: "steel", massKg: 28, kind: "box", dims: [0.6, 0.6, 0.6], bau: "weisseWare" }, // Einbauherd mit Umluftofen
  { materialId: "va", massKg: 14, kind: "box", dims: [0.9, 0.5, 0.5], bau: "weisseWare" }, // Dunstabzugshaube
  { materialId: "steel", massKg: 36, kind: "box", dims: [0.45, 0.8, 0.35], bau: "maschine" }, // Gastherme
  { materialId: "plastic", massKg: 45, kind: "box", dims: [1.2, 1.5, 0.75], bau: "tank" }, // Öltank (Keller, Kunststoff)
  { materialId: "copper", massKg: 34, kind: "box", dims: [0.9, 0.65, 0.35], bau: "maschine" }, // Split-Klimagerät
  { materialId: "steel", massKg: 24, kind: "box", dims: [0.45, 0.65, 0.25], bau: "container" }, // Ölradiator
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.55, 0.7, 0.5], bau: "maschine" }, // Gusseiserner Badeofen
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.6, 0.8, 0.55], bau: "maschine" }, // Kachelofen-Einsatz
  { materialId: "steel", massKg: 40, kind: "box", dims: [1.45, 0.35, 2.05], bau: "rahmenbox" }, // Doppelbett-Gestell
  { materialId: "wood", massKg: 48, kind: "box", dims: [0.95, 0.45, 2.0], bau: "stapel" }, // Lattenrost-Stapel
  { materialId: "plastic", massKg: 55, kind: "box", dims: [1.4, 0.7, 2.0], bau: "stapel" }, // Matratzenstapel
  { materialId: "plastic", massKg: 70, kind: "box", dims: [2.1, 0.9, 0.95], bau: "moebel" }, // Sofa (Dreisitzer)
  { materialId: "wood", massKg: 65, kind: "box", dims: [1.0, 2.0, 0.6], bau: "moebel" }, // Schrankwand-Segment
  { materialId: "alu", massKg: 26, kind: "box", dims: [0.9, 1.9, 0.12], bau: "platte" }, // Duschkabine
  { materialId: "alu", massKg: 42, kind: "cyl", dims: [0.28, 1.5], bau: "rohrFlansch" }, // Rollladenpanzer (aufgerollt)
  { materialId: "wood", massKg: 85, kind: "box", dims: [2.1, 1.9, 0.12], bau: "platte" }, // Gartenhaus-Wandelement
  { materialId: "steel", massKg: 180, kind: "box", dims: [1.0, 0.9, 1.7], bau: "maschine" }, // Aufsitzmäher

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.55, 0.4, 0.6], bau: "achse" }, // Wohnwagen-Achse
  { materialId: "alu", massKg: 60, kind: "box", dims: [2.2, 1.9, 0.06], bau: "platte" }, // Wohnwagen-Wandelement
  { materialId: "alu", massKg: 24, kind: "box", dims: [0.2, 0.2, 2.2], bau: "buendel" }, // Vorzelt-Gestänge (Bund)
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.55, 0.6, 0.5], bau: "weisseWare" }, // Wohnwagen-Kühlschrank (Absorber)
  { materialId: "plastic", massKg: 160, kind: "box", dims: [1.1, 0.75, 2.2], bau: "kleinfahrzeug" }, // Jetski
  { materialId: "steel", massKg: 210, kind: "box", dims: [1.15, 1.0, 1.85], bau: "kleinfahrzeug" }, // Quad
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.2, 1.7, 2.2], bau: "kabine" }, // Golfwagen
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.7, 1.05, 1.9], bau: "kleinfahrzeug" }, // Motorroller (komplett)
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.15, 1.1, 2.2], bau: "kleinfahrzeug" }, // Schneemobil
  { materialId: "alu", massKg: 55, kind: "box", dims: [1.2, 0.45, 2.2], bau: "tank" }, // Ruderboot (Alu)

  // --- Fahrzeugschrott ---
  { materialId: "tires", massKg: 45, kind: "cyl", dims: [0.32, 1.0], bau: "stapel" }, // Reifenstapel (Pkw)
  { materialId: "tires", massKg: 120, kind: "cyl", dims: [0.55, 1.2], bau: "stapel" }, // Reifenstapel (LKW)
  { materialId: "steel", massKg: 95, kind: "cyl", dims: [0.28, 1.1], bau: "stapel" }, // Felgenstapel (Stahl)
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.75, 0.7, 0.8], bau: "motor" }, // Motorblock (V8, ausgebaut)
  { materialId: "alu", massKg: 85, kind: "box", dims: [0.6, 0.65, 0.9], bau: "maschine" }, // Automatikgetriebe
  { materialId: "steel", massKg: 185, kind: "box", dims: [1.55, 0.5, 0.45], bau: "achse" }, // Hinterachse mit Differenzial
  { materialId: "va", massKg: 38, kind: "box", dims: [0.5, 0.4, 0.9], bau: "buendel" }, // Katalysator-Bündel
  { materialId: "plastic", massKg: 32, kind: "box", dims: [1.7, 0.6, 0.7], bau: "stapel" }, // Stoßfänger-Stapel
  { materialId: "steel", massKg: 88, kind: "box", dims: [1.5, 0.35, 1.3], bau: "stapel" }, // Motorhauben-Stapel
  { materialId: "steel", massKg: 110, kind: "box", dims: [1.1, 0.55, 1.2], bau: "buendel" }, // Fahrzeugtüren-Bund
  { materialId: "plastic", massKg: 30, kind: "box", dims: [1.35, 0.75, 0.7], bau: "moebel" }, // Fahrzeug-Sitzbank

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.1, 0.85, 0.95], bau: "schaufel" }, // Baggerlöffel
  { materialId: "alu", massKg: 70, kind: "box", dims: [0.8, 0.45, 2.1], bau: "buendel" }, // Gerüstrahmen (Bund)
  { materialId: "wood", massKg: 110, kind: "box", dims: [0.6, 0.4, 2.2], bau: "stapel" }, // Gerüstbohlen (Stapel)
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.35, 0.35, 2.2], bau: "buendel" }, // Stahlstützen-Bund
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.6, 0.9, 0.35], bau: "rahmenbox" }, // Bauzaun-Felder (Stapel)
  { materialId: "steel", massKg: 85, kind: "box", dims: [1.9, 0.7, 0.25], bau: "rahmenbox" }, // Absperrgitter (Bund)

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.7, 0.55, 0.6], bau: "maschine" }, // Aufzugs-Antriebsmaschine
  { materialId: "alu", massKg: 48, kind: "box", dims: [1.6, 1.1, 0.1], bau: "platte" }, // Fassadenelement (Metall)
  { materialId: "steel", massKg: 115, kind: "box", dims: [0.6, 1.9, 0.55], bau: "kabine" }, // Tankstellen-Zapfsäule
  { materialId: "va", massKg: 160, kind: "box", dims: [0.9, 1.1, 0.85], bau: "weisseWare" }, // Krankenhaus-Sterilisator
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.4, 1.1, 0.4], bau: "kabine" }, // Parkhaus-Schrankenanlage
  { materialId: "va", massKg: 145, kind: "box", dims: [2.2, 1.1, 0.75], bau: "weisseWare" }, // Supermarkt-Kühlregal
  { materialId: "steel", massKg: 70, kind: "box", dims: [1.8, 0.9, 0.7], bau: "rahmenbox" }, // Supermarkt-Kassentheke

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 80, kind: "box", dims: [1.5, 1.6, 0.15], bau: "platte" }, // Flugzeug-Seitenleitwerk
  { materialId: "alu", massKg: 110, kind: "box", dims: [2.2, 0.15, 0.8], bau: "platte" }, // Flugzeug-Höhenleitwerk
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.45, 1.5, 0.5], bau: "achse" }, // Flugzeug-Fahrwerksbein
  { materialId: "alu", massKg: 65, kind: "cyl", dims: [0.8, 1.6], bau: "tank" }, // Triebwerksverkleidung
  { materialId: "alu", massKg: 90, kind: "box", dims: [2.2, 0.25, 2.2], bau: "platte" }, // Propeller (Metall)
  { materialId: "steel", massKg: 205, kind: "cyl", dims: [0.45, 0.6], bau: "motor" }, // Rotorkopf
  { materialId: "alu", massKg: 75, kind: "box", dims: [0.35, 0.25, 2.2], bau: "buendel" }, // Rotorblätter (Bund)
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.5, 1.3, 1.6], bau: "rahmenbox" }, // Flughafen-Gepäckwagen
  { materialId: "alu", massKg: 130, kind: "box", dims: [1.5, 1.5, 2.0], bau: "container" }, // Luftfracht-Container (ULD)

  // --- Schiene ---
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.6, 0.5, 0.6], bau: "achse" }, // Eisenbahn-Puffer (Paar)
  { materialId: "steel", massKg: 175, kind: "box", dims: [0.35, 0.35, 2.2], bau: "buendel" }, // Schienenbündel
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.3, 0.3, 2.2], bau: "buendel" }, // Weichenzunge
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.4, 2.2, 0.4], bau: "buendel" }, // Oberleitungsmast
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.5, 2.1, 0.5], bau: "buendel" }, // Signalmast mit Schirm
  { materialId: "wood", massKg: 190, kind: "box", dims: [0.9, 0.55, 2.2], bau: "stapel" }, // Bahnschwellen (Holzstapel)

  // --- Hafen ---
  { materialId: "copper", massKg: 180, kind: "box", dims: [1.1, 0.3, 1.1], bau: "platte" }, // Schiffsschraube
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.4, 0.2, 1.1], bau: "platte" }, // Ruderblatt
  { materialId: "steel", massKg: 205, kind: "wire", dims: [0.7], bau: "haufen" }, // Ankerkette (Haufen)
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.9, 1.3, 0.7], bau: "motor" }, // Stockanker
  { materialId: "steel", massKg: 190, kind: "cyl", dims: [0.3, 0.8], bau: "motor" }, // Poller
  { materialId: "steel", massKg: 165, kind: "box", dims: [1.9, 0.2, 1.4], bau: "platte" }, // Schiffsluke (Deckel)

  // --- Lose Schrottmaterialien (nur Metall, Holz, Reifen) ---
  { materialId: "wood", massKg: 120, kind: "box", dims: [1.4, 0.9, 1.5], bau: "haufen" }, // Holzbruch-Haufen
  { materialId: "mixed", massKg: 175, kind: "box", dims: [1.2, 0.9, 1.2], bau: "haufen" }, // Mischschrott-Haufen
  { materialId: "steel", massKg: 190, kind: "wire", dims: [0.75], bau: "haufen" }, // Stahlteile-Haufen
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.7, 0.7, 0.7], bau: "stapel" }, // Metallpaket (gepresst)
  { materialId: "tires", massKg: 95, kind: "wire", dims: [0.85], bau: "haufen" }, // Reifenhaufen
  { materialId: "steel", massKg: 205, kind: "box", dims: [0.55, 0.55, 1.3], bau: "stapel" }, // Schrottschere-Abschnitte
];

/* ------------------------------------------------------------------------ */
/* Großteile — Händleranlieferungen                                           */
/* ------------------------------------------------------------------------ */

export const KATALOG_BIG: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 320, kind: "box", dims: [1.6, 1.7, 1.5], bau: "kabine" }, // Traktorkabine
  { materialId: "steel", massKg: 480, kind: "box", dims: [2.4, 0.7, 0.7], bau: "achse" }, // Traktor-Hinterachse
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.9, 0.5, 0.6], bau: "achse" }, // Traktor-Vorderachse
  { materialId: "steel", massKg: 380, kind: "box", dims: [1.3, 0.5, 2.9], bau: "ausleger" }, // Frontlader-Schwinge
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.1, 0.8, 0.9], bau: "schaufel" }, // Frontlader-Schaufel
  { materialId: "steel", massKg: 480, kind: "cyl", dims: [0.42, 0.85], bau: "motor" }, // Häcksler-Trommel
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.8, 0.9, 0.7], bau: "maschine" }, // Güllefass-Pumpwerk
  { materialId: "steel", massKg: 340, kind: "cyl", dims: [0.4, 1.5], bau: "buendel" }, // Presskammerwalzen (Bund)
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 1.3, 1.0], bau: "gitterturm" }, // Sämaschine mit Saatkasten
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.8, 0.35, 0.7], bau: "platte" }, // Mähwerk-Scheibenbalken
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 0.4, 0.4], bau: "buendel" }, // Feldspritze-Gestänge

  // --- Industrie ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.5, 1.6, 1.4], bau: "maschine" }, // Exzenterpresse
  { materialId: "steel", massKg: 280, kind: "box", dims: [1.0, 0.7, 3.0], bau: "ausleger" }, // Förderband-Segment
  { materialId: "steel", massKg: 390, kind: "box", dims: [1.1, 0.9, 0.95], bau: "maschine" }, // Förderband-Antriebsstation
  { materialId: "steel", massKg: 310, kind: "cyl", dims: [0.5, 2.4], bau: "tank" }, // Druckluftbehälter
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.9, 1.1, 0.95], bau: "maschine" }, // Notstromaggregat
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.5, 1.3], bau: "maschine" }, // Industrieofen-Kammer
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.2, 1.5, 1.6], bau: "maschine" }, // Lüftungsaggregat (Dachgerät)
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.85, 2.2], bau: "tank" }, // Zyklonabscheider
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.2, 1.0, 3.2], bau: "gitterturm" }, // Rohrbrücke-Segment
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.25, 2.6, 0.85], bau: "rahmenbox" }, // Gitterbox-Stapel
  { materialId: "steel", massKg: 350, kind: "box", dims: [1.1, 3.0, 0.9], bau: "rahmenbox" }, // Palettenregal-Rahmen
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.6, 2.4, 0.2], bau: "platte" }, // Industrie-Rolltor
  { materialId: "steel", massKg: 330, kind: "box", dims: [2.4, 0.7, 1.1], bau: "buendel" }, // Sektionaltor-Panele (Bund)
  { materialId: "plastic", massKg: 210, kind: "box", dims: [2.2, 2.0, 2.0], bau: "tank" }, // Kühlturm-Zelle

  // --- Haushalt ---
  { materialId: "steel", massKg: 230, kind: "cyl", dims: [0.6, 2.4], bau: "tank" }, // Heizöltank (Stahl, liegend)
  { materialId: "wood", massKg: 240, kind: "box", dims: [2.6, 0.9, 0.65], bau: "moebel" }, // Küchenzeile (Segment)

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.0, 0.6, 3.4], bau: "fahrgestell" }, // Wohnwagen-Chassis
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.8, 0.8, 3.2], bau: "fahrgestell" }, // Bootsanhänger
  { materialId: "plastic", massKg: 340, kind: "box", dims: [1.7, 1.1, 3.4], bau: "tank" }, // Sportboot-Rumpf (GFK)
  { materialId: "plastic", massKg: 280, kind: "box", dims: [2.0, 1.4, 2.6], bau: "tank" }, // Kajütboot-Aufbau
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.0, 1.5, 3.0], bau: "fahrgestell" }, // Campinganhänger (Faltcaravan)

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.9, 0.9, 3.4], bau: "fahrgestell" }, // Pritschenwagen-Fahrgestell
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.3, 1.2, 3.0], bau: "container" }, // Kipper-Mulde
  { materialId: "alu", massKg: 300, kind: "cyl", dims: [1.0, 2.8], bau: "tank" }, // Tankauflieger-Segment
  { materialId: "steel", massKg: 240, kind: "box", dims: [0.6, 0.25, 3.2], bau: "stapel" }, // Autotransporter-Rampen
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.0, 2.8], bau: "fahrgestell" }, // Anhänger (Einachs, Plane)
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 2.2, 0.08], bau: "platte" }, // Kofferauflieger-Seitenwand

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.1, 3.2], bau: "ausleger" }, // Baggerausleger
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 0.9, 1.0], bau: "schaufel" }, // Radlader-Schaufel
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.55, 1.1], bau: "buendel" }, // Raupenlaufwerk-Ketten (Bund)
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.4, 2.9], bau: "gitterturm" }, // Turmdrehkran-Mastschuss
  { materialId: "steel", massKg: 390, kind: "box", dims: [2.4, 1.5, 0.25], bau: "platte" }, // Betonfertigteil-Wand
  { materialId: "rubble", massKg: 520, kind: "box", dims: [1.3, 0.9, 2.0], bau: "beton" }, // Betontreppenlauf
  { materialId: "rubble", massKg: 380, kind: "cyl", dims: [0.75, 1.2], bau: "beton" }, // Betonrohr (Kanal)
  { materialId: "rubble", massKg: 340, kind: "cyl", dims: [0.7, 0.9], bau: "beton" }, // Schachtring
  { materialId: "wood", massKg: 220, kind: "box", dims: [3.2, 1.4, 0.2], bau: "gitterturm" }, // Dachstuhl-Binder
  { materialId: "alu", massKg: 280, kind: "box", dims: [2.6, 2.2, 0.2], bau: "platte" }, // Fensterfront (Pfosten-Riegel)
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 1.3, 3.2], bau: "container" }, // Schuttcontainer (Absetzmulde)
  { materialId: "wood", massKg: 340, kind: "box", dims: [2.1, 2.1, 3.2], bau: "kabine" }, // Bauwagen (alt, Holz)

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.5, 2.2, 1.5], bau: "container" }, // Aufzugskabine
  { materialId: "steel", massKg: 580, kind: "box", dims: [0.5, 1.8, 0.6], bau: "motor" }, // Aufzugs-Gegengewicht
  { materialId: "alu", massKg: 260, kind: "box", dims: [0.9, 0.5, 3.2], bau: "ausleger" }, // Rolltreppen-Stufenband
  { materialId: "steel", massKg: 430, kind: "box", dims: [2.6, 1.8, 2.2], bau: "maschine" }, // Großklimagerät (Dach)
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.2, 1.4, 1.6], bau: "maschine" }, // Rückkühler (Dachaufbau)
  { materialId: "alu", massKg: 250, kind: "box", dims: [2.4, 2.4, 0.15], bau: "platte" }, // Glasfassaden-Element
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.2, 2.8, 1.0], bau: "maschine" }, // Werkstatt-Hebebühne
  { materialId: "alu", massKg: 210, kind: "box", dims: [3.0, 2.2, 0.18], bau: "platte" }, // Autohaus-Schaufensterrahmen
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.4, 1.2], bau: "maschine" }, // Schul-Heizkesselanlage
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.6, 1.2, 0.2], bau: "stapel" }, // Kühlhaus-Paneele (Stapel)
  { materialId: "steel", massKg: 300, kind: "box", dims: [3.0, 0.4, 1.6], bau: "platte" }, // Tankstellen-Dachkonstruktion

  // --- Luftfahrt ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.2, 1.0, 3.0], bau: "karosserie" }, // Flughafen-Schleppfahrzeug
  { materialId: "alu", massKg: 260, kind: "box", dims: [1.6, 2.4, 2.6], bau: "gitterturm" }, // Fluggasttreppe
  { materialId: "alu", massKg: 300, kind: "box", dims: [1.7, 1.9, 2.4], bau: "elektromotor" }, // Cateringwagen-Aufbau
  { materialId: "alu", massKg: 420, kind: "box", dims: [2.0, 1.7, 2.6], bau: "kabine" }, // Hubschrauber-Zelle
  { materialId: "alu", massKg: 230, kind: "cyl", dims: [0.35, 3.2], bau: "rohrFlansch" }, // Hubschrauber-Heckausleger

  // --- Schiene ---
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.6, 1.3, 0.9], bau: "motor" }, // Prellbock
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.48, 1.5], bau: "achse" }, // Radsatz (Eisenbahn)
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 2.0, 1.6], bau: "kabine" }, // Lokomotiv-Führerstand
  { materialId: "rubble", massKg: 590, kind: "box", dims: [1.0, 0.7, 2.6], bau: "stapel" }, // Bahnschwellen (Betonstapel)
  { materialId: "steel", massKg: 470, kind: "box", dims: [2.8, 1.9, 0.15], bau: "platte" }, // Schiebewand-Waggon-Seitenteil

  // --- Hafen ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.4, 1.2, 3.2], bau: "tank" }, // Ponton-Segment
  { materialId: "steel", massKg: 580, kind: "box", dims: [2.6, 0.9, 1.4], bau: "maschine" }, // Reachstacker-Spreader
  { materialId: "steel", massKg: 490, kind: "box", dims: [1.6, 1.4, 3.2], bau: "tank" }, // Bootsrumpf (Stahl)
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.0, 1.0, 3.4], bau: "ausleger" }, // Hafenkran-Ausleger
];

/* ------------------------------------------------------------------------ */
/* Schwergewichte — füllen einen Auflieger                                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_HUGE: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 1300, kind: "box", dims: [4.6, 0.9, 1.3], bau: "schaufel" }, // Mähdrescher-Schneidwerk
  { materialId: "steel", massKg: 620, kind: "cyl", dims: [0.65, 1.5], bau: "tank" }, // Mähdrescher-Dreschtrommel
  { materialId: "steel", massKg: 640, kind: "box", dims: [2.6, 1.6, 2.2], bau: "tank" }, // Mähdrescher-Korntank
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [0.95, 3.4], bau: "tank" }, // Güllefass
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.3, 3.2], bau: "tank" }, // Ballenpresse (Rundballen)
  { materialId: "steel", massKg: 760, kind: "box", dims: [3.0, 1.0, 1.4], bau: "gitterturm" }, // Grubber mit Zinkenfeld
  { materialId: "steel", massKg: 840, kind: "box", dims: [2.9, 0.9, 1.6], bau: "gitterturm" }, // Scheibenegge
  { materialId: "steel", massKg: 720, kind: "box", dims: [2.6, 0.8, 1.1], bau: "gitterturm" }, // Kreiselegge
  { materialId: "steel", massKg: 880, kind: "box", dims: [3.4, 1.1, 1.5], bau: "schaufel" }, // Maispflücker-Vorsatz
  { materialId: "steel", massKg: 830, kind: "box", dims: [2.4, 2.0, 3.4], bau: "rahmenbox" }, // Ladewagen-Aufbau
  { materialId: "steel", massKg: 920, kind: "box", dims: [1.6, 1.5, 2.4], bau: "maschine" }, // Miststreuer-Streuwerk
  { materialId: "steel", massKg: 1700, kind: "box", dims: [2.6, 2.0, 3.0], bau: "tank" }, // Futtermischwagen-Behälter
  { materialId: "steel", massKg: 900, kind: "cyl", dims: [0.55, 2.2], bau: "tank" }, // Futtermischwagen-Mischschnecke

  // --- Industrie ---
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.2, 2.4, 2.6], bau: "maschine" }, // CNC-Fräsmaschine
  { materialId: "steel", massKg: 2100, kind: "box", dims: [1.2, 1.4, 3.6], bau: "maschine" }, // Drehmaschine mit Bett
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.6, 1.9, 4.4], bau: "maschine" }, // Spritzgussmaschine
  { materialId: "steel", massKg: 1600, kind: "cyl", dims: [1.0, 3.2], bau: "tank" }, // Dampfkessel

  // --- Wohnwagen und Freizeit ---
  { materialId: "alu", massKg: 950, kind: "box", dims: [2.3, 2.5, 4.6], bau: "karosserie" }, // Wohnwagen (komplett)
  { materialId: "alu", massKg: 1100, kind: "box", dims: [2.4, 2.6, 4.6], bau: "karosserie" }, // Wohnmobil-Aufbau
  { materialId: "alu", massKg: 620, kind: "box", dims: [2.3, 1.4, 2.4], bau: "karosserie" }, // Wohnmobil-Alkoven

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 700, kind: "box", dims: [1.6, 1.4, 3.4], bau: "karosserie" }, // Kleinwagen-Karosserie
  { materialId: "steel", massKg: 980, kind: "box", dims: [1.8, 1.5, 4.6], bau: "karosserie" }, // Kombi-Karosserie
  { materialId: "steel", massKg: 1250, kind: "box", dims: [1.9, 1.8, 4.4], bau: "karosserie" }, // SUV-Karosserie
  { materialId: "steel", massKg: 1400, kind: "box", dims: [2.0, 2.4, 4.8], bau: "karosserie" }, // Transporter-Kastenwagen
  { materialId: "steel", massKg: 620, kind: "box", dims: [1.7, 1.4, 4.2], bau: "karosserie" }, // Ausgebranntes Fahrzeug
  { materialId: "steel", massKg: 1050, kind: "box", dims: [1.8, 1.5, 4.0], bau: "karosserie" }, // Unfallfahrzeug (Front eingedrückt)
  { materialId: "steel", massKg: 1800, kind: "box", dims: [2.1, 2.5, 4.8], bau: "karosserie" }, // Kleinbus
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.5, 2.8, 3.6], bau: "karosserie" }, // Reisebus-Heckteil
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.5, 1.2, 4.8], bau: "fahrgestell" }, // Sattelauflieger-Chassis

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.2, 2.2, 3.4], bau: "karosserie" }, // Minibagger (ausgeschlachtet)
  { materialId: "steel", massKg: 2200, kind: "cyl", dims: [0.85, 2.1], bau: "tank" }, // Vibrationswalze (Bandage)
  { materialId: "steel", massKg: 1200, kind: "box", dims: [1.4, 1.4, 4.8], bau: "gitterturm" }, // Turmdrehkran-Ausleger
  { materialId: "rubble", massKg: 2400, kind: "box", dims: [2.4, 0.8, 1.8], bau: "beton" }, // Kranballast-Platten
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [1.1, 2.6], bau: "tank" }, // Betonmischer-Trommel
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.6, 4.8], bau: "container" }, // Baustellencontainer
  { materialId: "rubble", massKg: 2500, kind: "box", dims: [2.4, 0.25, 4.6], bau: "beton" }, // Hohlkammerdecke (Element)

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 2400, kind: "box", dims: [1.4, 2.6, 4.6], bau: "gitterturm" }, // Rolltreppen-Segment
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.2, 3.6], bau: "tank" }, // Tankstellen-Erdtank

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 900, kind: "box", dims: [2.6, 1.9, 4.6], bau: "karosserie" }, // Kleinflugzeug (komplett)
  { materialId: "steel", massKg: 1900, kind: "cyl", dims: [0.95, 2.8], bau: "tank" }, // Strahltriebwerk (ausgebaut)

  // --- Schiene ---
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 2.6, 4.6], bau: "karosserie" }, // Rangierlok (ausgeschlachtet)
  { materialId: "steel", massKg: 2500, kind: "box", dims: [1.5, 1.6, 2.8], bau: "motor" }, // Diesellok-Motorblock
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.6, 2.6, 4.8], bau: "container" }, // Personenwaggon-Kasten
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.6, 0.6, 4.8], bau: "fahrgestell" }, // Güterwaggon-Boden
  { materialId: "steel", massKg: 2000, kind: "cyl", dims: [1.2, 3.4], bau: "tank" }, // Kesselwagen-Kessel
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.4, 2.6, 4.4], bau: "container" }, // Straßenbahn-Wagenkasten
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 1.2, 2.2], bau: "achse" }, // U-Bahn-Drehgestell (angetrieben)

  // --- Hafen ---
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.4, 2.6, 4.8], bau: "container" }, // Seecontainer 20 Fuß
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.7, 4.8], bau: "container" }, // Kühlcontainer
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 2.6, 4.6], bau: "container" }, // Bürocontainer
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.6, 4.6], bau: "container" }, // Werkstattcontainer
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.8, 1.9, 3.2], bau: "motor" }, // Schiffsmotor (Diesel)
];
