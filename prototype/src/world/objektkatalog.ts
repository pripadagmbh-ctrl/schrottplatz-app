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

export interface PileSpec {
  materialId: string;
  massKg: number;
  kind: ScrapShape["kind"];
  dims: number[];
}

/* ------------------------------------------------------------------------ */
/* Klein und mittel — Starthaufen und gewöhnliche Ladungen                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_SPECS: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.9, 1.1, 0.3] }, // Silo-Blechsegment
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.45, 0.45, 2.2] }, // Melkstand-Gitterwerk
  { materialId: "steel", massKg: 180, kind: "cyl", dims: [0.3, 1.8] }, // Häcksler-Auswurfkrümmer
  { materialId: "steel", massKg: 150, kind: "box", dims: [1.0, 0.14, 2.1] }, // Kartoffelroder-Siebkette

  // --- Industrie ---
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.2, 0.8, 0.8] }, // Gitterbox
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.9, 0.55, 0.8] }, // Kreiselpumpe mit Grundplatte
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.65, 0.6, 0.7] }, // Großgetriebe (Industrie)
  { materialId: "steel", massKg: 190, kind: "box", dims: [1.1, 1.0, 0.75] }, // Schraubenkompressor
  { materialId: "steel", massKg: 130, kind: "cyl", dims: [0.32, 1.6] }, // Wärmetauscher-Bündel
  { materialId: "steel", massKg: 75, kind: "box", dims: [0.7, 0.7, 1.9] }, // Lüftungskanäle (Bündel)
  { materialId: "steel", massKg: 160, kind: "box", dims: [1.3, 0.45, 2.2] }, // Späneförderer
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.85, 0.7, 0.9] }, // Hallenkran-Laufkatze
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.25, 0.25, 2.2] }, // Palettenregal-Traversen (Bund)

  // --- Haushalt ---
  { materialId: "steel", massKg: 55, kind: "box", dims: [0.6, 1.7, 0.6] }, // Kühlschrank
  { materialId: "steel", massKg: 62, kind: "box", dims: [1.3, 0.85, 0.65] }, // Gefriertruhe
  { materialId: "steel", massKg: 33, kind: "box", dims: [0.6, 0.85, 0.6] }, // Wäschetrockner
  { materialId: "steel", massKg: 28, kind: "box", dims: [0.6, 0.6, 0.6] }, // Einbauherd mit Umluftofen
  { materialId: "va", massKg: 14, kind: "box", dims: [0.9, 0.5, 0.5] }, // Dunstabzugshaube
  { materialId: "steel", massKg: 36, kind: "box", dims: [0.45, 0.8, 0.35] }, // Gastherme
  { materialId: "plastic", massKg: 45, kind: "box", dims: [1.2, 1.5, 0.75] }, // Öltank (Keller, Kunststoff)
  { materialId: "copper", massKg: 34, kind: "box", dims: [0.9, 0.65, 0.35] }, // Split-Klimagerät
  { materialId: "steel", massKg: 24, kind: "box", dims: [0.45, 0.65, 0.25] }, // Ölradiator
  { materialId: "steel", massKg: 130, kind: "box", dims: [0.55, 0.7, 0.5] }, // Gusseiserner Badeofen
  { materialId: "steel", massKg: 165, kind: "box", dims: [0.6, 0.8, 0.55] }, // Kachelofen-Einsatz
  { materialId: "steel", massKg: 40, kind: "box", dims: [1.45, 0.35, 2.05] }, // Doppelbett-Gestell
  { materialId: "wood", massKg: 48, kind: "box", dims: [0.95, 0.45, 2.0] }, // Lattenrost-Stapel
  { materialId: "plastic", massKg: 55, kind: "box", dims: [1.4, 0.7, 2.0] }, // Matratzenstapel
  { materialId: "plastic", massKg: 70, kind: "box", dims: [2.1, 0.9, 0.95] }, // Sofa (Dreisitzer)
  { materialId: "wood", massKg: 65, kind: "box", dims: [1.0, 2.0, 0.6] }, // Schrankwand-Segment
  { materialId: "alu", massKg: 26, kind: "box", dims: [0.9, 1.9, 0.12] }, // Duschkabine
  { materialId: "alu", massKg: 42, kind: "cyl", dims: [0.28, 1.5] }, // Rollladenpanzer (aufgerollt)
  { materialId: "wood", massKg: 85, kind: "box", dims: [2.1, 1.9, 0.12] }, // Gartenhaus-Wandelement
  { materialId: "steel", massKg: 180, kind: "box", dims: [1.0, 0.9, 1.7] }, // Aufsitzmäher

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 95, kind: "box", dims: [1.55, 0.4, 0.6] }, // Wohnwagen-Achse
  { materialId: "alu", massKg: 60, kind: "box", dims: [2.2, 1.9, 0.06] }, // Wohnwagen-Wandelement
  { materialId: "alu", massKg: 24, kind: "box", dims: [0.2, 0.2, 2.2] }, // Vorzelt-Gestänge (Bund)
  { materialId: "steel", massKg: 38, kind: "box", dims: [0.55, 0.6, 0.5] }, // Wohnwagen-Kühlschrank (Absorber)
  { materialId: "plastic", massKg: 160, kind: "box", dims: [1.1, 0.75, 2.2] }, // Jetski
  { materialId: "steel", massKg: 210, kind: "box", dims: [1.15, 1.0, 1.85] }, // Quad
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.2, 1.7, 2.2] }, // Golfwagen
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.7, 1.05, 1.9] }, // Motorroller (komplett)
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.15, 1.1, 2.2] }, // Schneemobil
  { materialId: "alu", massKg: 55, kind: "box", dims: [1.2, 0.45, 2.2] }, // Ruderboot (Alu)

  // --- Fahrzeugschrott ---
  { materialId: "tires", massKg: 45, kind: "cyl", dims: [0.32, 1.0] }, // Reifenstapel (Pkw)
  { materialId: "tires", massKg: 120, kind: "cyl", dims: [0.55, 1.2] }, // Reifenstapel (LKW)
  { materialId: "steel", massKg: 95, kind: "cyl", dims: [0.28, 1.1] }, // Felgenstapel (Stahl)
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.75, 0.7, 0.8] }, // Motorblock (V8, ausgebaut)
  { materialId: "alu", massKg: 85, kind: "box", dims: [0.6, 0.65, 0.9] }, // Automatikgetriebe
  { materialId: "steel", massKg: 185, kind: "box", dims: [1.55, 0.5, 0.45] }, // Hinterachse mit Differenzial
  { materialId: "va", massKg: 38, kind: "box", dims: [0.5, 0.4, 0.9] }, // Katalysator-Bündel
  { materialId: "plastic", massKg: 32, kind: "box", dims: [1.7, 0.6, 0.7] }, // Stoßfänger-Stapel
  { materialId: "steel", massKg: 88, kind: "box", dims: [1.5, 0.35, 1.3] }, // Motorhauben-Stapel
  { materialId: "steel", massKg: 110, kind: "box", dims: [1.1, 0.55, 1.2] }, // Fahrzeugtüren-Bund
  { materialId: "plastic", massKg: 30, kind: "box", dims: [1.35, 0.75, 0.7] }, // Fahrzeug-Sitzbank

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 205, kind: "box", dims: [1.1, 0.85, 0.95] }, // Baggerlöffel
  { materialId: "alu", massKg: 70, kind: "box", dims: [0.8, 0.45, 2.1] }, // Gerüstrahmen (Bund)
  { materialId: "wood", massKg: 110, kind: "box", dims: [0.6, 0.4, 2.2] }, // Gerüstbohlen (Stapel)
  { materialId: "steel", massKg: 145, kind: "box", dims: [0.35, 0.35, 2.2] }, // Stahlstützen-Bund
  { materialId: "steel", massKg: 120, kind: "box", dims: [1.6, 0.9, 0.35] }, // Bauzaun-Felder (Stapel)
  { materialId: "steel", massKg: 85, kind: "box", dims: [1.9, 0.7, 0.25] }, // Absperrgitter (Bund)

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 190, kind: "box", dims: [0.7, 0.55, 0.6] }, // Aufzugs-Antriebsmaschine
  { materialId: "alu", massKg: 48, kind: "box", dims: [1.6, 1.1, 0.1] }, // Fassadenelement (Metall)
  { materialId: "steel", massKg: 115, kind: "box", dims: [0.6, 1.9, 0.55] }, // Tankstellen-Zapfsäule
  { materialId: "va", massKg: 160, kind: "box", dims: [0.9, 1.1, 0.85] }, // Krankenhaus-Sterilisator
  { materialId: "steel", massKg: 95, kind: "box", dims: [0.4, 1.1, 0.4] }, // Parkhaus-Schrankenanlage
  { materialId: "va", massKg: 145, kind: "box", dims: [2.2, 1.1, 0.75] }, // Supermarkt-Kühlregal
  { materialId: "steel", massKg: 70, kind: "box", dims: [1.8, 0.9, 0.7] }, // Supermarkt-Kassentheke

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 80, kind: "box", dims: [1.5, 1.6, 0.15] }, // Flugzeug-Seitenleitwerk
  { materialId: "alu", massKg: 110, kind: "box", dims: [2.2, 0.15, 0.8] }, // Flugzeug-Höhenleitwerk
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.45, 1.5, 0.5] }, // Flugzeug-Fahrwerksbein
  { materialId: "alu", massKg: 65, kind: "cyl", dims: [0.8, 1.6] }, // Triebwerksverkleidung
  { materialId: "alu", massKg: 90, kind: "box", dims: [2.2, 0.25, 2.2] }, // Propeller (Metall)
  { materialId: "steel", massKg: 205, kind: "cyl", dims: [0.45, 0.6] }, // Rotorkopf
  { materialId: "alu", massKg: 75, kind: "box", dims: [0.35, 0.25, 2.2] }, // Rotorblätter (Bund)
  { materialId: "alu", massKg: 85, kind: "box", dims: [1.5, 1.3, 1.6] }, // Flughafen-Gepäckwagen
  { materialId: "alu", massKg: 130, kind: "box", dims: [1.5, 1.5, 2.0] }, // Luftfracht-Container (ULD)

  // --- Schiene ---
  { materialId: "steel", massKg: 200, kind: "box", dims: [0.6, 0.5, 0.6] }, // Eisenbahn-Puffer (Paar)
  { materialId: "steel", massKg: 175, kind: "box", dims: [0.35, 0.35, 2.2] }, // Schienenbündel
  { materialId: "steel", massKg: 160, kind: "box", dims: [0.3, 0.3, 2.2] }, // Weichenzunge
  { materialId: "steel", massKg: 140, kind: "box", dims: [0.4, 2.2, 0.4] }, // Oberleitungsmast
  { materialId: "steel", massKg: 105, kind: "box", dims: [0.5, 2.1, 0.5] }, // Signalmast mit Schirm
  { materialId: "wood", massKg: 190, kind: "box", dims: [0.9, 0.55, 2.2] }, // Bahnschwellen (Holzstapel)

  // --- Hafen ---
  { materialId: "copper", massKg: 180, kind: "box", dims: [1.1, 0.3, 1.1] }, // Schiffsschraube
  { materialId: "steel", massKg: 175, kind: "box", dims: [1.4, 0.2, 1.1] }, // Ruderblatt
  { materialId: "steel", massKg: 205, kind: "wire", dims: [0.7] }, // Ankerkette (Haufen)
  { materialId: "steel", massKg: 195, kind: "box", dims: [0.9, 1.3, 0.7] }, // Stockanker
  { materialId: "steel", massKg: 190, kind: "cyl", dims: [0.3, 0.8] }, // Poller
  { materialId: "steel", massKg: 165, kind: "box", dims: [1.9, 0.2, 1.4] }, // Schiffsluke (Deckel)

  // --- Lose Schrottmaterialien (nur Metall, Holz, Reifen) ---
  { materialId: "wood", massKg: 120, kind: "box", dims: [1.4, 0.9, 1.5] }, // Holzbruch-Haufen
  { materialId: "mixed", massKg: 175, kind: "box", dims: [1.2, 0.9, 1.2] }, // Mischschrott-Haufen
  { materialId: "steel", massKg: 190, kind: "wire", dims: [0.75] }, // Stahlteile-Haufen
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.7, 0.7, 0.7] }, // Metallpaket (gepresst)
  { materialId: "tires", massKg: 95, kind: "wire", dims: [0.85] }, // Reifenhaufen
  { materialId: "steel", massKg: 205, kind: "box", dims: [0.55, 0.55, 1.3] }, // Schrottschere-Abschnitte
];

/* ------------------------------------------------------------------------ */
/* Großteile — Händleranlieferungen                                           */
/* ------------------------------------------------------------------------ */

export const KATALOG_BIG: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 320, kind: "box", dims: [1.6, 1.7, 1.5] }, // Traktorkabine
  { materialId: "steel", massKg: 480, kind: "box", dims: [2.4, 0.7, 0.7] }, // Traktor-Hinterachse
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.9, 0.5, 0.6] }, // Traktor-Vorderachse
  { materialId: "steel", massKg: 380, kind: "box", dims: [1.3, 0.5, 2.9] }, // Frontlader-Schwinge
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.1, 0.8, 0.9] }, // Frontlader-Schaufel
  { materialId: "steel", massKg: 480, kind: "cyl", dims: [0.42, 0.85] }, // Häcksler-Trommel
  { materialId: "steel", massKg: 210, kind: "box", dims: [0.8, 0.9, 0.7] }, // Güllefass-Pumpwerk
  { materialId: "steel", massKg: 340, kind: "cyl", dims: [0.4, 1.5] }, // Presskammerwalzen (Bund)
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 1.3, 1.0] }, // Sämaschine mit Saatkasten
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.8, 0.35, 0.7] }, // Mähwerk-Scheibenbalken
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 0.4, 0.4] }, // Feldspritze-Gestänge

  // --- Industrie ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.5, 1.6, 1.4] }, // Exzenterpresse
  { materialId: "steel", massKg: 280, kind: "box", dims: [1.0, 0.7, 3.0] }, // Förderband-Segment
  { materialId: "steel", massKg: 390, kind: "box", dims: [1.1, 0.9, 0.95] }, // Förderband-Antriebsstation
  { materialId: "steel", massKg: 310, kind: "cyl", dims: [0.5, 2.4] }, // Druckluftbehälter
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.9, 1.1, 0.95] }, // Notstromaggregat
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.5, 1.3] }, // Industrieofen-Kammer
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.2, 1.5, 1.6] }, // Lüftungsaggregat (Dachgerät)
  { materialId: "steel", massKg: 300, kind: "cyl", dims: [0.85, 2.2] }, // Zyklonabscheider
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.2, 1.0, 3.2] }, // Rohrbrücke-Segment
  { materialId: "steel", massKg: 470, kind: "box", dims: [1.25, 2.6, 0.85] }, // Gitterbox-Stapel
  { materialId: "steel", massKg: 350, kind: "box", dims: [1.1, 3.0, 0.9] }, // Palettenregal-Rahmen
  { materialId: "steel", massKg: 260, kind: "box", dims: [2.6, 2.4, 0.2] }, // Industrie-Rolltor
  { materialId: "steel", massKg: 330, kind: "box", dims: [2.4, 0.7, 1.1] }, // Sektionaltor-Panele (Bund)
  { materialId: "plastic", massKg: 210, kind: "box", dims: [2.2, 2.0, 2.0] }, // Kühlturm-Zelle

  // --- Haushalt ---
  { materialId: "steel", massKg: 230, kind: "cyl", dims: [0.6, 2.4] }, // Heizöltank (Stahl, liegend)
  { materialId: "wood", massKg: 240, kind: "box", dims: [2.6, 0.9, 0.65] }, // Küchenzeile (Segment)

  // --- Wohnwagen und Freizeit ---
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.0, 0.6, 3.4] }, // Wohnwagen-Chassis
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.8, 0.8, 3.2] }, // Bootsanhänger
  { materialId: "plastic", massKg: 340, kind: "box", dims: [1.7, 1.1, 3.4] }, // Sportboot-Rumpf (GFK)
  { materialId: "plastic", massKg: 280, kind: "box", dims: [2.0, 1.4, 2.6] }, // Kajütboot-Aufbau
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.0, 1.5, 3.0] }, // Campinganhänger (Faltcaravan)

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.9, 0.9, 3.4] }, // Pritschenwagen-Fahrgestell
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.3, 1.2, 3.0] }, // Kipper-Mulde
  { materialId: "alu", massKg: 300, kind: "cyl", dims: [1.0, 2.8] }, // Tankauflieger-Segment
  { materialId: "steel", massKg: 240, kind: "box", dims: [0.6, 0.25, 3.2] }, // Autotransporter-Rampen
  { materialId: "steel", massKg: 260, kind: "box", dims: [1.5, 1.0, 2.8] }, // Anhänger (Einachs, Plane)
  { materialId: "alu", massKg: 190, kind: "box", dims: [3.2, 2.2, 0.08] }, // Kofferauflieger-Seitenwand

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.1, 3.2] }, // Baggerausleger
  { materialId: "steel", massKg: 420, kind: "box", dims: [2.6, 0.9, 1.0] }, // Radlader-Schaufel
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.55, 1.1] }, // Raupenlaufwerk-Ketten (Bund)
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.4, 1.4, 2.9] }, // Turmdrehkran-Mastschuss
  { materialId: "steel", massKg: 390, kind: "box", dims: [2.4, 1.5, 0.25] }, // Betonfertigteil-Wand
  { materialId: "rubble", massKg: 520, kind: "box", dims: [1.3, 0.9, 2.0] }, // Betontreppenlauf
  { materialId: "rubble", massKg: 380, kind: "cyl", dims: [0.75, 1.2] }, // Betonrohr (Kanal)
  { materialId: "rubble", massKg: 340, kind: "cyl", dims: [0.7, 0.9] }, // Schachtring
  { materialId: "wood", massKg: 220, kind: "box", dims: [3.2, 1.4, 0.2] }, // Dachstuhl-Binder
  { materialId: "alu", massKg: 280, kind: "box", dims: [2.6, 2.2, 0.2] }, // Fensterfront (Pfosten-Riegel)
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 1.3, 3.2] }, // Schuttcontainer (Absetzmulde)
  { materialId: "wood", massKg: 340, kind: "box", dims: [2.1, 2.1, 3.2] }, // Bauwagen (alt, Holz)

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [1.5, 2.2, 1.5] }, // Aufzugskabine
  { materialId: "steel", massKg: 580, kind: "box", dims: [0.5, 1.8, 0.6] }, // Aufzugs-Gegengewicht
  { materialId: "alu", massKg: 260, kind: "box", dims: [0.9, 0.5, 3.2] }, // Rolltreppen-Stufenband
  { materialId: "steel", massKg: 430, kind: "box", dims: [2.6, 1.8, 2.2] }, // Großklimagerät (Dach)
  { materialId: "steel", massKg: 380, kind: "box", dims: [2.2, 1.4, 1.6] }, // Rückkühler (Dachaufbau)
  { materialId: "alu", massKg: 250, kind: "box", dims: [2.4, 2.4, 0.15] }, // Glasfassaden-Element
  { materialId: "steel", massKg: 560, kind: "box", dims: [1.2, 2.8, 1.0] }, // Werkstatt-Hebebühne
  { materialId: "alu", massKg: 210, kind: "box", dims: [3.0, 2.2, 0.18] }, // Autohaus-Schaufensterrahmen
  { materialId: "steel", massKg: 590, kind: "box", dims: [1.1, 1.4, 1.2] }, // Schul-Heizkesselanlage
  { materialId: "steel", massKg: 240, kind: "box", dims: [2.6, 1.2, 0.2] }, // Kühlhaus-Paneele (Stapel)
  { materialId: "steel", massKg: 300, kind: "box", dims: [3.0, 0.4, 1.6] }, // Tankstellen-Dachkonstruktion

  // --- Luftfahrt ---
  { materialId: "steel", massKg: 560, kind: "box", dims: [2.2, 1.0, 3.0] }, // Flughafen-Schleppfahrzeug
  { materialId: "alu", massKg: 260, kind: "box", dims: [1.6, 2.4, 2.6] }, // Fluggasttreppe
  { materialId: "alu", massKg: 300, kind: "box", dims: [1.7, 1.9, 2.4] }, // Cateringwagen-Aufbau
  { materialId: "alu", massKg: 420, kind: "box", dims: [2.0, 1.7, 2.6] }, // Hubschrauber-Zelle
  { materialId: "alu", massKg: 230, kind: "cyl", dims: [0.35, 3.2] }, // Hubschrauber-Heckausleger

  // --- Schiene ---
  { materialId: "steel", massKg: 580, kind: "box", dims: [1.6, 1.3, 0.9] }, // Prellbock
  { materialId: "steel", massKg: 560, kind: "cyl", dims: [0.48, 1.5] }, // Radsatz (Eisenbahn)
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.2, 2.0, 1.6] }, // Lokomotiv-Führerstand
  { materialId: "rubble", massKg: 590, kind: "box", dims: [1.0, 0.7, 2.6] }, // Bahnschwellen (Betonstapel)
  { materialId: "steel", massKg: 470, kind: "box", dims: [2.8, 1.9, 0.15] }, // Schiebewand-Waggon-Seitenteil

  // --- Hafen ---
  { materialId: "steel", massKg: 520, kind: "box", dims: [2.4, 1.2, 3.2] }, // Ponton-Segment
  { materialId: "steel", massKg: 580, kind: "box", dims: [2.6, 0.9, 1.4] }, // Reachstacker-Spreader
  { materialId: "steel", massKg: 490, kind: "box", dims: [1.6, 1.4, 3.2] }, // Bootsrumpf (Stahl)
  { materialId: "steel", massKg: 430, kind: "box", dims: [1.0, 1.0, 3.4] }, // Hafenkran-Ausleger
];

/* ------------------------------------------------------------------------ */
/* Schwergewichte — füllen einen Auflieger                                    */
/* ------------------------------------------------------------------------ */

export const KATALOG_HUGE: PileSpec[] = [
  // --- Landwirtschaft ---
  { materialId: "steel", massKg: 1300, kind: "box", dims: [4.6, 0.9, 1.3] }, // Mähdrescher-Schneidwerk
  { materialId: "steel", massKg: 620, kind: "cyl", dims: [0.65, 1.5] }, // Mähdrescher-Dreschtrommel
  { materialId: "steel", massKg: 640, kind: "box", dims: [2.6, 1.6, 2.2] }, // Mähdrescher-Korntank
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [0.95, 3.4] }, // Güllefass
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.3, 3.2] }, // Ballenpresse (Rundballen)
  { materialId: "steel", massKg: 760, kind: "box", dims: [3.0, 1.0, 1.4] }, // Grubber mit Zinkenfeld
  { materialId: "steel", massKg: 840, kind: "box", dims: [2.9, 0.9, 1.6] }, // Scheibenegge
  { materialId: "steel", massKg: 720, kind: "box", dims: [2.6, 0.8, 1.1] }, // Kreiselegge
  { materialId: "steel", massKg: 880, kind: "box", dims: [3.4, 1.1, 1.5] }, // Maispflücker-Vorsatz
  { materialId: "steel", massKg: 830, kind: "box", dims: [2.4, 2.0, 3.4] }, // Ladewagen-Aufbau
  { materialId: "steel", massKg: 920, kind: "box", dims: [1.6, 1.5, 2.4] }, // Miststreuer-Streuwerk
  { materialId: "steel", massKg: 1700, kind: "box", dims: [2.6, 2.0, 3.0] }, // Futtermischwagen-Behälter
  { materialId: "steel", massKg: 900, kind: "cyl", dims: [0.55, 2.2] }, // Futtermischwagen-Mischschnecke

  // --- Industrie ---
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.2, 2.4, 2.6] }, // CNC-Fräsmaschine
  { materialId: "steel", massKg: 2100, kind: "box", dims: [1.2, 1.4, 3.6] }, // Drehmaschine mit Bett
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.6, 1.9, 4.4] }, // Spritzgussmaschine
  { materialId: "steel", massKg: 1600, kind: "cyl", dims: [1.0, 3.2] }, // Dampfkessel

  // --- Wohnwagen und Freizeit ---
  { materialId: "alu", massKg: 950, kind: "box", dims: [2.3, 2.5, 4.6] }, // Wohnwagen (komplett)
  { materialId: "alu", massKg: 1100, kind: "box", dims: [2.4, 2.6, 4.6] }, // Wohnmobil-Aufbau
  { materialId: "alu", massKg: 620, kind: "box", dims: [2.3, 1.4, 2.4] }, // Wohnmobil-Alkoven

  // --- Fahrzeugschrott ---
  { materialId: "steel", massKg: 700, kind: "box", dims: [1.6, 1.4, 3.4] }, // Kleinwagen-Karosserie
  { materialId: "steel", massKg: 980, kind: "box", dims: [1.8, 1.5, 4.6] }, // Kombi-Karosserie
  { materialId: "steel", massKg: 1250, kind: "box", dims: [1.9, 1.8, 4.4] }, // SUV-Karosserie
  { materialId: "steel", massKg: 1400, kind: "box", dims: [2.0, 2.4, 4.8] }, // Transporter-Kastenwagen
  { materialId: "steel", massKg: 620, kind: "box", dims: [1.7, 1.4, 4.2] }, // Ausgebranntes Fahrzeug
  { materialId: "steel", massKg: 1050, kind: "box", dims: [1.8, 1.5, 4.0] }, // Unfallfahrzeug (Front eingedrückt)
  { materialId: "steel", massKg: 1800, kind: "box", dims: [2.1, 2.5, 4.8] }, // Kleinbus
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.5, 2.8, 3.6] }, // Reisebus-Heckteil
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.5, 1.2, 4.8] }, // Sattelauflieger-Chassis

  // --- Bauabbruch ---
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.2, 2.2, 3.4] }, // Minibagger (ausgeschlachtet)
  { materialId: "steel", massKg: 2200, kind: "cyl", dims: [0.85, 2.1] }, // Vibrationswalze (Bandage)
  { materialId: "steel", massKg: 1200, kind: "box", dims: [1.4, 1.4, 4.8] }, // Turmdrehkran-Ausleger
  { materialId: "rubble", massKg: 2400, kind: "box", dims: [2.4, 0.8, 1.8] }, // Kranballast-Platten
  { materialId: "steel", massKg: 1500, kind: "cyl", dims: [1.1, 2.6] }, // Betonmischer-Trommel
  { materialId: "steel", massKg: 1900, kind: "box", dims: [2.4, 2.6, 4.8] }, // Baustellencontainer
  { materialId: "rubble", massKg: 2500, kind: "box", dims: [2.4, 0.25, 4.6] }, // Hohlkammerdecke (Element)

  // --- Gebäudetechnik ---
  { materialId: "steel", massKg: 2400, kind: "box", dims: [1.4, 2.6, 4.6] }, // Rolltreppen-Segment
  { materialId: "steel", massKg: 1800, kind: "cyl", dims: [1.2, 3.6] }, // Tankstellen-Erdtank

  // --- Luftfahrt ---
  { materialId: "alu", massKg: 900, kind: "box", dims: [2.6, 1.9, 4.6] }, // Kleinflugzeug (komplett)
  { materialId: "steel", massKg: 1900, kind: "cyl", dims: [0.95, 2.8] }, // Strahltriebwerk (ausgebaut)

  // --- Schiene ---
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 2.6, 4.6] }, // Rangierlok (ausgeschlachtet)
  { materialId: "steel", massKg: 2500, kind: "box", dims: [1.5, 1.6, 2.8] }, // Diesellok-Motorblock
  { materialId: "steel", massKg: 2300, kind: "box", dims: [2.6, 2.6, 4.8] }, // Personenwaggon-Kasten
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.6, 0.6, 4.8] }, // Güterwaggon-Boden
  { materialId: "steel", massKg: 2000, kind: "cyl", dims: [1.2, 3.4] }, // Kesselwagen-Kessel
  { materialId: "steel", massKg: 2100, kind: "box", dims: [2.4, 2.6, 4.4] }, // Straßenbahn-Wagenkasten
  { materialId: "steel", massKg: 2600, kind: "box", dims: [2.4, 1.2, 2.2] }, // U-Bahn-Drehgestell (angetrieben)

  // --- Hafen ---
  { materialId: "steel", massKg: 2200, kind: "box", dims: [2.4, 2.6, 4.8] }, // Seecontainer 20 Fuß
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.7, 4.8] }, // Kühlcontainer
  { materialId: "steel", massKg: 2400, kind: "box", dims: [2.4, 2.6, 4.6] }, // Bürocontainer
  { materialId: "steel", massKg: 2500, kind: "box", dims: [2.4, 2.6, 4.6] }, // Werkstattcontainer
  { materialId: "steel", massKg: 2600, kind: "box", dims: [1.8, 1.9, 3.2] }, // Schiffsmotor (Diesel)
];
