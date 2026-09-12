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
  /** Wie es heißt — steht im Greifer, damit man weiß, was man gefasst hat. */
  name?: string;
}

/* ------------------------------------------------------------------------ */
/* Klein und mittel — Starthaufen und gewöhnliche Ladungen                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_SPECS: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.9, 1.1, 0.3], bau: "stapel", name: "Silo-Blechsegment" },
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.45, 0.45, 2.2], bau: "rahmenbox", name: "Melkstand-Gitterwerk" },
  { materialId: "steel", massKg: 180, kind: "cyl", dims: [0.3, 1.8], bau: "rohrFlansch", name: "Häcksler-Auswurfkrümmer" },
  { materialId: "steel", massKg: 150, kind: "box", dims: [1.0, 0.14, 2.1], bau: "platte", name: "Kartoffelroder-Siebkette" },

  // --- Industrie ---
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.2, 0.8, 0.8], bau: "rahmenbox", name: "Gitterbox" },
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.9, 0.55, 0.8], bau: "elektromotor", name: "Kreiselpumpe mit Grundplatte" },
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.65, 0.6, 0.7], bau: "maschine", name: "Großgetriebe (Industrie)" },
  { materialId: "steel", massKg: 190, kind: "box", dims: [1.1, 1.0, 0.75], bau: "maschine", name: "Schraubenkompressor" },
  { materialId: "steel", massKg: 130, kind: "cyl", dims: [0.32, 1.6], bau: "rohrFlansch", name: "Wärmetauscher-Bündel" },
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.7, 0.7, 1.9], bau: "buendel", name: "Lüftungskanäle (Bündel)" },
  { materialId: "steel", massKg: 160, kind: "box", dims: [1.3, 0.45, 2.2], bau: "ausleger", name: "Späneförderer" },
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.85, 0.7, 0.9], bau: "maschine", name: "Hallenkran-Laufkatze" },
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.25, 0.25, 2.2], bau: "buendel", name: "Palettenregal-Traversen (Bund)" },

  // --- Haushalt ---
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.6, 1.7, 0.6], bau: "weisseWare", name: "Kühlschrank" },
  { materialId: "steel", massKg: 62, kind: "box", dims: [1.3, 0.85, 0.65], bau: "weisseWare", name: "Gefriertruhe" },
  { materialId: "steel", massKg: 33, kind: "box", dims: [0.6, 0.85, 0.6], bau: "weisseWare", name: "Wäschetrockner" },
  { materialId: "steel", massKg: 28, kind: "box", dims: [0.6, 0.6, 0.6], bau: "weisseWare", name: "Einbauherd mit Umluftofen" },
  { materialId: "va", massKg: 14, kind: "box", dims: [0.9, 0.5, 0.5], bau: "weisseWare", name: "Dunstabzugshaube" },
  { materialId: "steel", massKg: 36, kind: "box", dims: [0.45, 0.8, 0.35], bau: "maschine", name: "Gastherme" },
  { materialId: "plastic", massKg: 45, kind: "box", dims: [1.2, 1.5, 0.75], bau: "tank", name: "Öltank (Keller, Kunststoff)" },
  { materialId: "copper", massKg: 34, kind: "box", dims: [0.9, 0.65, 0.35], bau: "maschine", name: "Split-Klimagerät" },
  { materialId: "steel", massKg: 24, kind: "box", dims: [0.45, 0.65, 0.25], bau: "container", name: "Ölradiator" },
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.55, 0.7, 0.5], bau: "maschine", name: "Gusseiserner Badeofen" },
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.6, 0.8, 0.55], bau: "maschine", name: "Kachelofen-Einsatz" },
  { materialId: "steel", massKg: 40, kind: "box", dims: [1.45, 0.35, 2.05], bau: "rahmenbox", name: "Doppelbett-Gestell" },
  { materialId: "wood", massKg: 48, kind: "box", dims: [0.95, 0.45, 2.0], bau: "stapel", name: "Lattenrost-Stapel" },
  { materialId: "plastic", massKg: 55, kind: "box", dims: [1.4, 0.7, 2.0], bau: "stapel", name: "Matratzenstapel" },
  { materialId: "plastic", massKg: 70, kind: "box", dims: [2.1, 0.9, 0.95], bau: "moebel", name: "Sofa (Dreisitzer)" },
  { materialId: "wood", massKg: 65, kind: "box", dims: [1.0, 2.0, 0.6], bau: "moebel", name: "Schrankwand-Segment" },
  { materialId: "alu", massKg: 26, kind: "box", dims: [0.9, 1.9, 0.12], bau: "platte", name: "Duschkabine" },
  { materialId: "alu", massKg: 42, kind: "cyl", dims: [0.28, 1.5], bau: "rohrFlansch", name: "Rollladenpanzer (aufgerollt)" },
  { materialId: "wood", massKg: 85, kind: "box", dims: [2.1, 1.9, 0.12], bau: "platte", name: "Gartenhaus-Wandelement" },
  { materialId: "steel", massKg: 180, kind: "box", dims: [1.0, 0.9, 1.7], bau: "maschine", name: "Aufsitzmäher" },

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.55, 0.4, 0.6], bau: "achse", name: "Wohnwagen-Achse" },
  { materialId: "alu", massKg: 60, kind: "box", dims: [2.2, 1.9, 0.06], bau: "platte", name: "Wohnwagen-Wandelement" },
  { materialId: "alu", massKg: 24, kind: "box", dims: [0.2, 0.2, 2.2], bau: "buendel", name: "Vorzelt-Gestänge (Bund)" },
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.55, 0.6, 0.5], bau: "weisseWare", name: "Wohnwagen-Kühlschrank (Absorber)" },
  { materialId: "plastic", massKg: 160, kind: "box", dims: [1.1, 0.75, 2.2], bau: "kleinfahrzeug", name: "Jetski" },
  { materialId: "steel", massKg: 210, kind: "box", dims: [1.15, 1.0, 1.85], bau: "kleinfahrzeug", name: "Quad" },
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.2, 1.7, 2.2], bau: "kabine", name: "Golfwagen" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.7, 1.05, 1.9], bau: "kleinfahrzeug", name: "Motorroller (komplett)" },
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.15, 1.1, 2.2], bau: "kleinfahrzeug", name: "Schneemobil" },
  { materialId: "alu", massKg: 55, kind: "box", dims: [1.2, 0.45, 2.2], bau: "tank", name: "Ruderboot (Alu)" },

  // --- Fahrzeugschrott ---
  { materialId: "tires", massKg: 45, kind: "cyl", dims: [0.32, 1.0], bau: "stapel", name: "Reifenstapel (Pkw)" },
  { materialId: "tires", massKg: 120, kind: "cyl", dims: [0.55, 1.2], bau: "stapel", name: "Reifenstapel (LKW)" },
  { materialId: "steel", massKg: 95, kind: "cyl", dims: [0.28, 1.1], bau: "stapel", name: "Felgenstapel (Stahl)" },
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.75, 0.7, 0.8], bau: "motor", name: "Motorblock (V8, ausgebaut)" },
  { materialId: "alu", massKg: 85, kind: "box", dims: [0.6, 0.65, 0.9], bau: "maschine", name: "Automatikgetriebe" },
  { materialId: "steel", massKg: 185, kind: "box", dims: [1.55, 0.5, 0.45], bau: "achse", name: "Hinterachse mit Differenzial" },
  { materialId: "va", massKg: 38, kind: "box", dims: [0.5, 0.4, 0.9], bau: "buendel", name: "Katalysator-Bündel" },
  { materialId: "plastic", massKg: 32, kind: "box", dims: [1.7, 0.6, 0.7], bau: "stapel", name: "Stoßfänger-Stapel" },
  { materialId: "steel", massKg: 88, kind: "box", dims: [1.5, 0.35, 1.3], bau: "stapel", name: "Motorhauben-Stapel" },
  { materialId: "steel", massKg: 110, kind: "box", dims: [1.1, 0.55, 1.2], bau: "buendel", name: "Fahrzeugtüren-Bund" },
  { materialId: "plastic", massKg: 30, kind: "box", dims: [1.35, 0.75, 0.7], bau: "moebel", name: "Fahrzeug-Sitzbank" },

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.1, 0.85, 0.95], bau: "schaufel", name: "Baggerlöffel" },
  { materialId: "alu", massKg: 70, kind: "box", dims: [0.8, 0.45, 2.1], bau: "buendel", name: "Gerüstrahmen (Bund)" },
  { materialId: "wood", massKg: 110, kind: "box", dims: [0.6, 0.4, 2.2], bau: "stapel", name: "Gerüstbohlen (Stapel)" },
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.35, 0.35, 2.2], bau: "buendel", name: "Stahlstützen-Bund" },
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.6, 0.9, 0.35], bau: "rahmenbox", name: "Bauzaun-Felder (Stapel)" },
  { materialId: "steel", massKg: 85, kind: "box", dims: [1.9, 0.7, 0.25], bau: "rahmenbox", name: "Absperrgitter (Bund)" },

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.7, 0.55, 0.6], bau: "maschine", name: "Aufzugs-Antriebsmaschine" },
  { materialId: "alu", massKg: 48, kind: "box", dims: [1.6, 1.1, 0.1], bau: "platte", name: "Fassadenelement (Metall)" },
  { materialId: "steel", massKg: 115, kind: "box", dims: [0.6, 1.9, 0.55], bau: "kabine", name: "Tankstellen-Zapfsäule" },
  { materialId: "va", massKg: 160, kind: "box", dims: [0.9, 1.1, 0.85], bau: "weisseWare", name: "Krankenhaus-Sterilisator" },
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.4, 1.1, 0.4], bau: "kabine", name: "Parkhaus-Schrankenanlage" },
  { materialId: "va", massKg: 145, kind: "box", dims: [2.2, 1.1, 0.75], bau: "weisseWare", name: "Supermarkt-Kühlregal" },
  { materialId: "steel", massKg: 70, kind: "box", dims: [1.8, 0.9, 0.7], bau: "rahmenbox", name: "Supermarkt-Kassentheke" },

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 80, kind: "box", dims: [1.5, 1.6, 0.15], bau: "platte", name: "Flugzeug-Seitenleitwerk" },
  { materialId: "alu", massKg: 110, kind: "box", dims: [2.2, 0.15, 0.8], bau: "platte", name: "Flugzeug-Höhenleitwerk" },
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.45, 1.5, 0.5], bau: "achse", name: "Flugzeug-Fahrwerksbein" },
  { materialId: "alu", massKg: 65, kind: "cyl", dims: [0.8, 1.6], bau: "tank", name: "Triebwerksverkleidung" },
  { materialId: "alu", massKg: 90, kind: "box", dims: [2.2, 0.25, 2.2], bau: "platte", name: "Propeller (Metall)" },
  { materialId: "steel", massKg: 205, kind: "cyl", dims: [0.45, 0.6], bau: "motor", name: "Rotorkopf" },
  { materialId: "alu", massKg: 75, kind: "box", dims: [0.35, 0.25, 2.2], bau: "buendel", name: "Rotorblätter (Bund)" },
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.5, 1.3, 1.6], bau: "rahmenbox", name: "Flughafen-Gepäckwagen" },
  { materialId: "alu", massKg: 130, kind: "box", dims: [1.5, 1.5, 2.0], bau: "container", name: "Luftfracht-Container (ULD)" },

  // --- Schiene ---
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.6, 0.5, 0.6], bau: "achse", name: "Eisenbahn-Puffer (Paar)" },
  { materialId: "steel", massKg: 175, kind: "box", dims: [0.35, 0.35, 2.2], bau: "buendel", name: "Schienenbündel" },
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.3, 0.3, 2.2], bau: "buendel", name: "Weichenzunge" },
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.4, 2.2, 0.4], bau: "buendel", name: "Oberleitungsmast" },
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.5, 2.1, 0.5], bau: "buendel", name: "Signalmast mit Schirm" },
  { materialId: "wood", massKg: 190, kind: "box", dims: [0.9, 0.55, 2.2], bau: "stapel", name: "Bahnschwellen (Holzstapel)" },

  // --- Hafen ---
  { materialId: "copper", massKg: 180, kind: "box", dims: [1.1, 0.3, 1.1], bau: "platte", name: "Schiffsschraube" },
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.4, 0.2, 1.1], bau: "platte", name: "Ruderblatt" },
  { materialId: "steel", massKg: 205, kind: "wire", dims: [0.7], bau: "haufen", name: "Ankerkette (Haufen)" },
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.9, 1.3, 0.7], bau: "motor", name: "Stockanker" },
  { materialId: "steel", massKg: 190, kind: "cyl", dims: [0.3, 0.8], bau: "motor", name: "Poller" },
  { materialId: "steel", massKg: 165, kind: "box", dims: [1.9, 0.2, 1.4], bau: "platte", name: "Schiffsluke (Deckel)" },

  // --- Lose Schrottmaterialien (nur Metall, Holz, Reifen) ---
  { materialId: "wood", massKg: 120, kind: "box", dims: [1.4, 0.9, 1.5], bau: "haufen", name: "Holzbruch-Haufen" },
  { materialId: "mixed", massKg: 175, kind: "box", dims: [1.2, 0.9, 1.2], bau: "haufen", name: "Mischschrott-Haufen" },
  { materialId: "steel", massKg: 190, kind: "wire", dims: [0.75], bau: "haufen", name: "Stahlteile-Haufen" },
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.7, 0.7, 0.7], bau: "stapel", name: "Metallpaket (gepresst)" },
  { materialId: "tires", massKg: 95, kind: "wire", dims: [0.85], bau: "haufen", name: "Reifenhaufen" },
  { materialId: "steel", massKg: 205, kind: "box", dims: [0.55, 0.55, 1.3], bau: "stapel", name: "Schrottschere-Abschnitte" },
];

/* ------------------------------------------------------------------------ */
/* Großteile — Händleranlieferungen                                           */
/* ------------------------------------------------------------------------ */

export const KATALOG_BIG: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 320, kind: "box", dims: [1.6, 1.7, 1.5], bau: "kabine", name: "Traktorkabine" },
  { materialId: "steel", massKg: 480, kind: "box", dims: [2.4, 0.7, 0.7], bau: "achse", name: "Traktor-Hinterachse" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.9, 0.5, 0.6], bau: "achse", name: "Traktor-Vorderachse" },
  { materialId: "steel", massKg: 380, kind: "box", dims: [1.3, 0.5, 2.9], bau: "ausleger", name: "Frontlader-Schwinge" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.1, 0.8, 0.9], bau: "schaufel", name: "Frontlader-Schaufel" },
  { materialId: "steel", massKg: 480, kind: "cyl", dims: [0.42, 0.85], bau: "motor", name: "Häcksler-Trommel" },
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.8, 0.9, 0.7], bau: "maschine", name: "Güllefass-Pumpwerk" },
  { materialId: "steel", massKg: 340, kind: "cyl", dims: [0.4, 1.5], bau: "buendel", name: "Presskammerwalzen (Bund)" },
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 1.3, 1.0], bau: "gitterturm", name: "Sämaschine mit Saatkasten" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.8, 0.35, 0.7], bau: "platte", name: "Mähwerk-Scheibenbalken" },
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 0.4, 0.4], bau: "buendel", name: "Feldspritze-Gestänge" },

  // --- Industrie ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.5, 1.6, 1.4], bau: "maschine", name: "Exzenterpresse" },
  { materialId: "steel", massKg: 280, kind: "box", dims: [1.0, 0.7, 3.0], bau: "ausleger", name: "Förderband-Segment" },
  { materialId: "steel", massKg: 390, kind: "box", dims: [1.1, 0.9, 0.95], bau: "maschine", name: "Förderband-Antriebsstation" },
  { materialId: "steel", massKg: 310, kind: "cyl", dims: [0.5, 2.4], bau: "tank", name: "Druckluftbehälter" },
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.9, 1.1, 0.95], bau: "maschine", name: "Notstromaggregat" },
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.5, 1.3], bau: "maschine", name: "Industrieofen-Kammer" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.2, 1.5, 1.6], bau: "maschine", name: "Lüftungsaggregat (Dachgerät)" },
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.85, 2.2], bau: "tank", name: "Zyklonabscheider" },
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.2, 1.0, 3.2], bau: "gitterturm", name: "Rohrbrücke-Segment" },
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.25, 2.6, 0.85], bau: "rahmenbox", name: "Gitterbox-Stapel" },
  { materialId: "steel", massKg: 350, kind: "box", dims: [1.1, 3.0, 0.9], bau: "rahmenbox", name: "Palettenregal-Rahmen" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.6, 2.4, 0.2], bau: "platte", name: "Industrie-Rolltor" },
  { materialId: "steel", massKg: 330, kind: "box", dims: [2.4, 0.7, 1.1], bau: "buendel", name: "Sektionaltor-Panele (Bund)" },
  { materialId: "plastic", massKg: 210, kind: "box", dims: [2.2, 2.0, 2.0], bau: "tank", name: "Kühlturm-Zelle" },

  // --- Haushalt ---
  { materialId: "steel", massKg: 230, kind: "cyl", dims: [0.6, 2.4], bau: "tank", name: "Heizöltank (Stahl, liegend)" },
  { materialId: "wood", massKg: 240, kind: "box", dims: [2.6, 0.9, 0.65], bau: "moebel", name: "Küchenzeile (Segment)" },

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.0, 0.6, 3.4], bau: "fahrgestell", name: "Wohnwagen-Chassis" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.8, 0.8, 3.2], bau: "fahrgestell", name: "Bootsanhänger" },
  { materialId: "plastic", massKg: 340, kind: "box", dims: [1.7, 1.1, 3.4], bau: "tank", name: "Sportboot-Rumpf (GFK)" },
  { materialId: "plastic", massKg: 280, kind: "box", dims: [2.0, 1.4, 2.6], bau: "tank", name: "Kajütboot-Aufbau" },
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.0, 1.5, 3.0], bau: "fahrgestell", name: "Campinganhänger (Faltcaravan)" },

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.9, 0.9, 3.4], bau: "fahrgestell", name: "Pritschenwagen-Fahrgestell" },
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.3, 1.2, 3.0], bau: "container", name: "Kipper-Mulde" },
  { materialId: "alu", massKg: 300, kind: "cyl", dims: [1.0, 2.8], bau: "tank", name: "Tankauflieger-Segment" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [0.6, 0.25, 3.2], bau: "stapel", name: "Autotransporter-Rampen" },
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.0, 2.8], bau: "fahrgestell", name: "Anhänger (Einachs, Plane)" },
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 2.2, 0.08], bau: "platte", name: "Kofferauflieger-Seitenwand" },

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.1, 3.2], bau: "ausleger", name: "Baggerausleger" },
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 0.9, 1.0], bau: "schaufel", name: "Radlader-Schaufel" },
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.55, 1.1], bau: "buendel", name: "Raupenlaufwerk-Ketten (Bund)" },
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.4, 2.9], bau: "gitterturm", name: "Turmdrehkran-Mastschuss" },
  { materialId: "steel", massKg: 390, kind: "box", dims: [2.4, 1.5, 0.25], bau: "platte", name: "Betonfertigteil-Wand" },
  { materialId: "rubble", massKg: 520, kind: "box", dims: [1.3, 0.9, 2.0], bau: "beton", name: "Betontreppenlauf" },
  { materialId: "rubble", massKg: 380, kind: "cyl", dims: [0.75, 1.2], bau: "beton", name: "Betonrohr (Kanal)" },
  { materialId: "rubble", massKg: 340, kind: "cyl", dims: [0.7, 0.9], bau: "beton", name: "Schachtring" },
  { materialId: "wood", massKg: 220, kind: "box", dims: [3.2, 1.4, 0.2], bau: "gitterturm", name: "Dachstuhl-Binder" },
  { materialId: "alu", massKg: 280, kind: "box", dims: [2.6, 2.2, 0.2], bau: "platte", name: "Fensterfront (Pfosten-Riegel)" },
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 1.3, 3.2], bau: "container", name: "Schuttcontainer (Absetzmulde)" },
  { materialId: "wood", massKg: 340, kind: "box", dims: [2.1, 2.1, 3.2], bau: "kabine", name: "Bauwagen (alt, Holz)" },

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.5, 2.2, 1.5], bau: "container", name: "Aufzugskabine" },
  { materialId: "steel", massKg: 580, kind: "box", dims: [0.5, 1.8, 0.6], bau: "motor", name: "Aufzugs-Gegengewicht" },
  { materialId: "alu", massKg: 260, kind: "box", dims: [0.9, 0.5, 3.2], bau: "ausleger", name: "Rolltreppen-Stufenband" },
  { materialId: "steel", massKg: 430, kind: "box", dims: [2.6, 1.8, 2.2], bau: "maschine", name: "Großklimagerät (Dach)" },
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.2, 1.4, 1.6], bau: "maschine", name: "Rückkühler (Dachaufbau)" },
  { materialId: "alu", massKg: 250, kind: "box", dims: [2.4, 2.4, 0.15], bau: "platte", name: "Glasfassaden-Element" },
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.2, 2.8, 1.0], bau: "maschine", name: "Werkstatt-Hebebühne" },
  { materialId: "alu", massKg: 210, kind: "box", dims: [3.0, 2.2, 0.18], bau: "platte", name: "Autohaus-Schaufensterrahmen" },
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.4, 1.2], bau: "maschine", name: "Schul-Heizkesselanlage" },
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.6, 1.2, 0.2], bau: "stapel", name: "Kühlhaus-Paneele (Stapel)" },
  { materialId: "steel", massKg: 300, kind: "box", dims: [3.0, 0.4, 1.6], bau: "platte", name: "Tankstellen-Dachkonstruktion" },

  // --- Luftfahrt ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.2, 1.0, 3.0], bau: "karosserie", name: "Flughafen-Schleppfahrzeug" },
  { materialId: "alu", massKg: 260, kind: "box", dims: [1.6, 2.4, 2.6], bau: "gitterturm", name: "Fluggasttreppe" },
  { materialId: "alu", massKg: 300, kind: "box", dims: [1.7, 1.9, 2.4], bau: "elektromotor", name: "Cateringwagen-Aufbau" },
  { materialId: "alu", massKg: 420, kind: "box", dims: [2.0, 1.7, 2.6], bau: "kabine", name: "Hubschrauber-Zelle" },
  { materialId: "alu", massKg: 230, kind: "cyl", dims: [0.35, 3.2], bau: "rohrFlansch", name: "Hubschrauber-Heckausleger" },

  // --- Schiene ---
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.6, 1.3, 0.9], bau: "motor", name: "Prellbock" },
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.48, 1.5], bau: "achse", name: "Radsatz (Eisenbahn)" },
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 2.0, 1.6], bau: "kabine", name: "Lokomotiv-Führerstand" },
  { materialId: "rubble", massKg: 590, kind: "box", dims: [1.0, 0.7, 2.6], bau: "stapel", name: "Bahnschwellen (Betonstapel)" },
  { materialId: "steel", massKg: 470, kind: "box", dims: [2.8, 1.9, 0.15], bau: "platte", name: "Schiebewand-Waggon-Seitenteil" },

  // --- Hafen ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.4, 1.2, 3.2], bau: "tank", name: "Ponton-Segment" },
  { materialId: "steel", massKg: 580, kind: "box", dims: [2.6, 0.9, 1.4], bau: "maschine", name: "Reachstacker-Spreader" },
  { materialId: "steel", massKg: 490, kind: "box", dims: [1.6, 1.4, 3.2], bau: "tank", name: "Bootsrumpf (Stahl)" },
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.0, 1.0, 3.4], bau: "ausleger", name: "Hafenkran-Ausleger" },
];

/* ------------------------------------------------------------------------ */
/* Schwergewichte — füllen einen Auflieger                                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_HUGE: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 1300, kind: "box", dims: [4.6, 0.9, 1.3], bau: "schaufel", name: "Mähdrescher-Schneidwerk" },
  { materialId: "steel", massKg: 620, kind: "cyl", dims: [0.65, 1.5], bau: "tank", name: "Mähdrescher-Dreschtrommel" },
  { materialId: "steel", massKg: 640, kind: "box", dims: [2.6, 1.6, 2.2], bau: "tank", name: "Mähdrescher-Korntank" },
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [0.95, 3.4], bau: "tank", name: "Güllefass" },
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.3, 3.2], bau: "tank", name: "Ballenpresse (Rundballen)" },
  { materialId: "steel", massKg: 760, kind: "box", dims: [3.0, 1.0, 1.4], bau: "gitterturm", name: "Grubber mit Zinkenfeld" },
  { materialId: "steel", massKg: 840, kind: "box", dims: [2.9, 0.9, 1.6], bau: "gitterturm", name: "Scheibenegge" },
  { materialId: "steel", massKg: 720, kind: "box", dims: [2.6, 0.8, 1.1], bau: "gitterturm", name: "Kreiselegge" },
  { materialId: "steel", massKg: 880, kind: "box", dims: [3.4, 1.1, 1.5], bau: "schaufel", name: "Maispflücker-Vorsatz" },
  { materialId: "steel", massKg: 830, kind: "box", dims: [2.4, 2.0, 3.4], bau: "rahmenbox", name: "Ladewagen-Aufbau" },
  { materialId: "steel", massKg: 920, kind: "box", dims: [1.6, 1.5, 2.4], bau: "maschine", name: "Miststreuer-Streuwerk" },
  { materialId: "steel", massKg: 1700, kind: "box", dims: [2.6, 2.0, 3.0], bau: "tank", name: "Futtermischwagen-Behälter" },
  { materialId: "steel", massKg: 900, kind: "cyl", dims: [0.55, 2.2], bau: "tank", name: "Futtermischwagen-Mischschnecke" },

  // --- Industrie ---
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.2, 2.4, 2.6], bau: "maschine", name: "CNC-Fräsmaschine" },
  { materialId: "steel", massKg: 2100, kind: "box", dims: [1.2, 1.4, 3.6], bau: "maschine", name: "Drehmaschine mit Bett" },
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.6, 1.9, 4.4], bau: "maschine", name: "Spritzgussmaschine" },
  { materialId: "steel", massKg: 1600, kind: "cyl", dims: [1.0, 3.2], bau: "tank", name: "Dampfkessel" },

  // --- Wohnwagen und Freizeit ---
  { materialId: "alu", massKg: 950, kind: "box", dims: [2.3, 2.5, 4.6], bau: "karosserie", name: "Wohnwagen (komplett)" },
  { materialId: "alu", massKg: 1100, kind: "box", dims: [2.4, 2.6, 4.6], bau: "karosserie", name: "Wohnmobil-Aufbau" },
  { materialId: "alu", massKg: 620, kind: "box", dims: [2.3, 1.4, 2.4], bau: "karosserie", name: "Wohnmobil-Alkoven" },

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 700, kind: "box", dims: [1.6, 1.4, 3.4], bau: "karosserie", name: "Kleinwagen-Karosserie" },
  { materialId: "steel", massKg: 980, kind: "box", dims: [1.8, 1.5, 4.6], bau: "karosserie", name: "Kombi-Karosserie" },
  { materialId: "steel", massKg: 1250, kind: "box", dims: [1.9, 1.8, 4.4], bau: "karosserie", name: "SUV-Karosserie" },
  { materialId: "steel", massKg: 1400, kind: "box", dims: [2.0, 2.4, 4.8], bau: "karosserie", name: "Transporter-Kastenwagen" },
  { materialId: "steel", massKg: 620, kind: "box", dims: [1.7, 1.4, 4.2], bau: "karosserie", name: "Ausgebranntes Fahrzeug" },
  { materialId: "steel", massKg: 1050, kind: "box", dims: [1.8, 1.5, 4.0], bau: "karosserie", name: "Unfallfahrzeug (Front eingedrückt)" },
  { materialId: "steel", massKg: 1800, kind: "box", dims: [2.1, 2.5, 4.8], bau: "karosserie", name: "Kleinbus" },
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.5, 2.8, 3.6], bau: "karosserie", name: "Reisebus-Heckteil" },
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.5, 1.2, 4.8], bau: "fahrgestell", name: "Sattelauflieger-Chassis" },

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.2, 2.2, 3.4], bau: "karosserie", name: "Minibagger (ausgeschlachtet)" },
  { materialId: "steel", massKg: 2200, kind: "cyl", dims: [0.85, 2.1], bau: "tank", name: "Vibrationswalze (Bandage)" },
  { materialId: "steel", massKg: 1200, kind: "box", dims: [1.4, 1.4, 4.8], bau: "gitterturm", name: "Turmdrehkran-Ausleger" },
  { materialId: "rubble", massKg: 2400, kind: "box", dims: [2.4, 0.8, 1.8], bau: "beton", name: "Kranballast-Platten" },
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [1.1, 2.6], bau: "tank", name: "Betonmischer-Trommel" },
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.6, 4.8], bau: "container", name: "Baustellencontainer" },
  { materialId: "rubble", massKg: 2500, kind: "box", dims: [2.4, 0.25, 4.6], bau: "beton", name: "Hohlkammerdecke (Element)" },

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 2400, kind: "box", dims: [1.4, 2.6, 4.6], bau: "gitterturm", name: "Rolltreppen-Segment" },
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.2, 3.6], bau: "tank", name: "Tankstellen-Erdtank" },

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 900, kind: "box", dims: [2.6, 1.9, 4.6], bau: "karosserie", name: "Kleinflugzeug (komplett)" },
  { materialId: "steel", massKg: 1900, kind: "cyl", dims: [0.95, 2.8], bau: "tank", name: "Strahltriebwerk (ausgebaut)" },

  // --- Schiene ---
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 2.6, 4.6], bau: "karosserie", name: "Rangierlok (ausgeschlachtet)" },
  { materialId: "steel", massKg: 2500, kind: "box", dims: [1.5, 1.6, 2.8], bau: "motor", name: "Diesellok-Motorblock" },
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.6, 2.6, 4.8], bau: "container", name: "Personenwaggon-Kasten" },
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.6, 0.6, 4.8], bau: "fahrgestell", name: "Güterwaggon-Boden" },
  { materialId: "steel", massKg: 2000, kind: "cyl", dims: [1.2, 3.4], bau: "tank", name: "Kesselwagen-Kessel" },
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.4, 2.6, 4.4], bau: "container", name: "Straßenbahn-Wagenkasten" },
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 1.2, 2.2], bau: "achse", name: "U-Bahn-Drehgestell (angetrieben)" },

  // --- Hafen ---
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.4, 2.6, 4.8], bau: "container", name: "Seecontainer 20 Fuß" },
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.7, 4.8], bau: "container", name: "Kühlcontainer" },
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 2.6, 4.6], bau: "container", name: "Bürocontainer" },
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.6, 4.6], bau: "container", name: "Werkstattcontainer" },
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.8, 1.9, 3.2], bau: "motor", name: "Schiffsmotor (Diesel)" },
];
