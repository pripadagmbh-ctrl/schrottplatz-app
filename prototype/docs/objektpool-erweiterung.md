# Objektpool — Erweiterungsvorschlag (12.09.2026)

Vorschlagsliste, keine Umsetzung. Sie erweitert ausschließlich den
**bestehenden** Objektpool und erfindet weder Spielmechanik noch neue
Datenstruktur.

## Was schon da ist

Ausgelesen aus dem Projekt, nicht aus der Erinnerung:

| Quelle | Einträge | Rolle |
|---|---|---|
| `world/scrapItems.ts` → `SPECS` | 41 | Basis-Sortiment für Haufen und Zufallsladungen |
| `world/scrapItems.ts` → `BIG_SPECS` | 25 | Großteile für Händler-Anlieferungen |
| `world/scrapItems.ts` → `HUGE_SPECS` | 12 | Schwergewichte, füllen einen Auflieger |
| `dismantle/carDef.ts` | 1 Komposit | Auto: Karosserie + Motor + vier Räder |

Zusammen **78 Objekte**. Jedes ist ein `PileSpec`:
`{ materialId, massKg, kind, dims }` — Formen `box`, `cyl`, `torus`, `wire`,
Materialklassen `steel`, `va`, `alu`, `copper`, `cable`, `mixed`, `wood`,
`tires`, `rubble`, `plastic`.

**Bereits vergeben** (wird unten nicht wiederholt): Profilstahl, Rohre,
Bleche, Heizkörper, Motorblock-Rest, Spülbecken, VA-Behälter, VA-Geländerrohr,
Alufelge, Aluprofil, Alutafel, Kupferrohr, Kupferbund, Messingarmaturen,
Kabelbunde, Holzbalken, Kunststoffplatte, Maschendrahtbündel, Waschmaschine,
Spülmaschine, Elektroherd, Warmwasserspeicher, Badewanne, Motorradrahmen,
Mopedrahmen, Pflugschar, Eggenwalze, Traktor-Frontgewicht, Heuwender-Ausleger,
LKW-Achse, LKW-Getriebe, LKW-Kühler, LKW-Felge, Motorradmotor, Elektromotor,
Traktorreifen, Doppel-T-Träger, Blechtafel, Kessel, Maschinenblock,
Schwungrad, Stahlschrank, Stahltor, Öltank, Drahtballen, VA-Tank, VA-Tafel,
Gastro-Spültisch, VA-Rohrbündel, Alu-Profilbündel, Alu-Fensterrahmen,
Alu-Kessel, Kupfer-Boiler, Kabeltrommel, Holzkiste, Betonblock,
Waggon-Drehgestell, Kettenlaufwerk, Kesselwagen-Segment, Lagertank,
Turbinengehäuse, LKW-Fahrerhaus, Pressenrahmen, VA-Prozesstank,
Tragflächenstück, Rumpfsegment, Kofferaufbau.

### Wo die Lücken sind

Der Bestand ist stark bei **Bau- und Industrieprofilen** und bei
**Einzelteilen aus Fahrzeugen**. Praktisch leer sind:

- **komplette Maschinen** — es gibt Maschinenblöcke und Getriebe, aber keine
  erkennbare Maschine, die als Ganzes auf dem Platz steht
- **Landwirtschaft** — vier Teile, alle klein
- **Wohnwagen und Freizeitfahrzeuge** — nichts
- **Schiene** — ein Drehgestell und ein Kesselwagensegment
- **Hafen** — nichts
- **Gebäudetechnik aus Abbrüchen** — nichts
- **lose Haufen** — nur der Betonblock

Dort liegt der Schwerpunkt der Liste.

---

# 1 Landwirtschaft (28)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Traktorkabine | Landwirtschaft | Abgetrennte Fahrerkabine mit Rahmen, viel Glasrest, sperrig und leicht für ihre Größe |
| Traktor-Hinterachse mit Endantrieben | Landwirtschaft | Breite Achse mit zwei Gehäusen an den Enden, kippt beim Ablegen gern zur Seite |
| Traktor-Vorderachse mit Lenkung | Landwirtschaft | Gelenkte Achse mit Spurstangen, verhakt sich bereitwillig im Haufen |
| Frontlader-Schwinge | Landwirtschaft | Zwei lange gebogene Arme mit Querstrebe, ausladend und unhandlich |
| Frontlader-Schaufel | Landwirtschaft | Offene Schale mit Schneidkante, lässt sich gut stapeln |
| Mähdrescher-Schneidwerk | Landwirtschaft | Sehr breit, flach, mit Haspel — das sperrigste Landmaschinenteil überhaupt |
| Mähdrescher-Dreschtrommel | Landwirtschaft | Schwerer Zylinder mit Schlagleisten, rollt weg, wenn man ihn falsch ablegt |
| Mähdrescher-Korntank | Landwirtschaft | Großer Blechbehälter, leicht im Verhältnis zum Volumen |
| Häcksler-Trommel | Landwirtschaft | Kompakter Zylinder mit Messern, schwer und dicht |
| Häcksler-Auswurfkrümmer | Landwirtschaft | Gebogenes weites Rohr, fasst sich schlecht mittig |
| Güllefass | Landwirtschaft | Liegender Tank auf Fahrgestell, groß und hohl |
| Güllefass-Pumpwerk | Landwirtschaft | Kompakter Block mit Pumpe und Armaturen |
| Ballenpresse (Rundballen) | Landwirtschaft | Kastenförmige Maschine mit Heckklappe, hoch und kippelig |
| Ballenpresse-Presskammerwalzen | Landwirtschaft | Bündel gleich langer Stahlwalzen, rollt auseinander |
| Grubber mit Zinkenfeld | Landwirtschaft | Rahmen mit vielen gefederten Zinken, hakt sich in allem fest |
| Scheibenegge | Landwirtschaft | Rahmen mit zwei Scheibenreihen, flach und breit |
| Kreiselegge | Landwirtschaft | Schwerer Balken mit Zinkenkreiseln unten |
| Sämaschine mit Saatkasten | Landwirtschaft | Langer Kasten auf Rahmen, oben leicht, unten schwer |
| Kartoffelroder-Siebkette | Landwirtschaft | Langes Kettenband mit Stahlstäben, biegt sich beim Anheben |
| Maispflücker-Vorsatz | Landwirtschaft | Breiter Vorsatz mit mehreren Spitzen, sieht aus wie ein Rechen |
| Mähwerk-Scheibenbalken | Landwirtschaft | Flacher Balken mit Mähscheiben, sehr breit und niedrig |
| Ladewagen-Aufbau | Landwirtschaft | Großer Gitteraufbau, viel Luft, wenig Gewicht |
| Miststreuer-Streuwerk | Landwirtschaft | Stehende Walzen mit Schlegeln, dicht und schwer |
| Futtermischwagen-Behälter | Landwirtschaft | Konischer Stahlbehälter, sehr groß, kippt ungern |
| Futtermischwagen-Mischschnecke | Landwirtschaft | Große Schnecke, eine der ungewöhnlichsten Formen auf dem Platz |
| Feldspritze-Gestänge | Landwirtschaft | Sehr langes gefaltetes Alugestänge, leicht und zerbrechlich wirkend |
| Melkstand-Gitterwerk | Landwirtschaft | Verzinkte Rohrkonstruktion aus dem Stall, sperrig, kaum Gewicht |
| Silo-Blechsegmente | Landwirtschaft | Gebogene Blechschüsse, stapeln sich ineinander |

# 2 Firmen- und Industrieschrott (30)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| CNC-Fräsmaschine | Industrie | Massiver Maschinenkörper mit Verkleidung, sehr schwer, sehr kompakt |
| Drehmaschine mit Bett | Industrie | Langes gusseisernes Maschinenbett, unhandlich und extrem dicht |
| Exzenterpresse | Industrie | Hoher C-Rahmen mit Schwungrad, kopflastig |
| Spritzgussmaschine | Industrie | Langgestreckte Maschine mit Schließeinheit, eines der schwersten Einzelteile |
| Förderband-Segment | Industrie | Rahmen mit Rollen und Gummiband, lang und durchhängend |
| Förderband-Antriebsstation | Industrie | Kompakter Block mit Trommel und Getriebe |
| Schraubenkompressor | Industrie | Schallgedämmter Kasten, kompakt, gleichmäßig schwer |
| Druckluftbehälter | Industrie | Stehender Kessel mit Füßen, hoch und hohl |
| Notstromaggregat | Industrie | Motor und Generator auf gemeinsamem Rahmen, sehr dicht |
| Großgetriebe (Industrie) | Industrie | Gusskasten mit Wellenstümpfen, klein und bleischwer |
| Kreiselpumpe mit Grundplatte | Industrie | Pumpe und Motor auf Stahlplatte, gut greifbar |
| Industrieofen-Kammer | Industrie | Ausgemauerter Stahlkasten, Rest der Schamotte fällt beim Bewegen heraus |
| Dampfkessel | Industrie | Liegender dickwandiger Kessel, sehr schwer für seine Größe |
| Wärmetauscher-Bündel | Industrie | Dichtes Rohrbündel im Mantel, unerwartet schwer |
| Lüftungsaggregat (Dachgerät) | Industrie | Großer Blechkasten mit Ventilatoren, viel Volumen, wenig Gewicht |
| Lüftungskanäle (Bündel) | Industrie | Eckige Blechrohre im Bund, sperrig und leicht |
| Zyklonabscheider | Industrie | Kegel mit Zylinder darüber, kippt auf jeder Seite weg |
| Rohrbrücke-Segment | Industrie | Stahlrahmen mit mehreren Rohren, lang und verwinkelt |
| Gitterbox (Stahl) | Industrie | Klassische Lagerbox, stapelbar, in Reihen legbar |
| Gitterbox-Stapel | Industrie | Vier ineinandergesetzte Gitterboxen, hoch und wackelig |
| Palettenregal-Rahmen | Industrie | Hoher Stahlrahmen mit Diagonalen, extrem sperrig |
| Palettenregal-Traversen (Bund) | Industrie | Bündel gelber Traversen, rutscht auseinander |
| Seecontainer 20 Fuß | Industrie | Der klassische Container, klar erkennbar, gut stapelbar |
| Bürocontainer | Industrie | Container mit Fenstern und Tür, leichter als er aussieht |
| Werkstattcontainer | Industrie | Container mit Doppeltür und Einbauten |
| Industrie-Rolltor | Industrie | Großes Lamellentor, biegt sich beim Anheben |
| Sektionaltor-Panele (Bund) | Industrie | Gedämmte Torpanele im Stapel |
| Späneförderer | Industrie | Langer Trog mit Kratzkette, schmal und lang |
| Kühlturm-Zelle | Industrie | Kunststoff-Blech-Aufbau, groß und sehr leicht |
| Hallenkran-Laufkatze | Industrie | Kompakter Block mit Seiltrommel, klein und schwer |

# 3 Haushaltsauflösungen (22)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Kühlschrank | Haushalt | Klassiker der Auflösung, leicht, beult sofort |
| Gefriertruhe | Haushalt | Liegender Kasten, breiter als hoch, gut zu greifen |
| Wäschetrockner | Haushalt | Wie eine Waschmaschine, aber deutlich leichter — fliegt schneller weg |
| Küchenzeile (Segment) | Haushalt | Korpus mit Arbeitsplatte, zerfällt beim Bewegen |
| Einbauherd mit Umluftofen | Haushalt | Kompakter Block, Glastür zerspringt |
| Dunstabzugshaube | Haushalt | Edelstahlhaube, leicht und schnittig |
| Gastherme | Haushalt | Wandgerät mit viel Kupfer innen, kompakt |
| Öltank (Keller, Kunststoff) | Haushalt | Großer Kunststofftank, sehr leicht, verformt sich |
| Heizöltank (Stahl, liegend) | Haushalt | Liegender Stahltank, rollt, wenn man ihn nicht sichert |
| Split-Klimagerät (Außeneinheit) | Haushalt | Kleiner Kasten mit Lüfterrad, viel Kupfer |
| Ölradiator | Haushalt | Gliederheizkörper auf Rollen, schwer für die Größe |
| Gusseiserner Badeofen | Haushalt | Kleiner, sehr dichter Ofen |
| Kachelofen-Einsatz | Haushalt | Gusskasten mit Tür, kompakt und schwer |
| Doppelbett-Gestell (Metall) | Haushalt | Rahmen mit Lattenrost, sperrig und leicht |
| Lattenrost-Stapel | Haushalt | Mehrere Roste übereinander, biegen und rutschen |
| Matratzenstapel | Haushalt | Weicher Stapel, federt beim Greifen zurück |
| Sofa (Dreisitzer) | Haushalt | Groß, leicht, lässt sich kaum sauber fassen |
| Schrankwand-Segment | Haushalt | Spanplattenkorpus, bricht beim Quetschen |
| Duschkabine (Glas und Alu) | Haushalt | Rahmen mit Glasresten, klirrt |
| Rollladenpanzer (aufgerollt) | Haushalt | Aufgerollte Lamellen, schwer zu greifen, rollt ab |
| Gartenhaus-Wandelement | Haushalt | Holzwand mit Fenster, groß und flach |
| Aufsitzmäher | Haushalt | Kleines Fahrzeug mit Mähwerk, gut erkennbar |

# 4 Wohnwagen und Freizeitfahrzeuge (18)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Wohnwagen (komplett) | Freizeit | Großes, sehr leichtes Objekt — beult und reißt beim Greifen auf |
| Wohnwagen-Chassis | Freizeit | Blanker Rahmen mit Deichsel und Achse, lang und schmal |
| Wohnwagen-Wandelement | Freizeit | Sandwichplatte mit Fenster, riesig und federleicht |
| Wohnwagen-Achse mit Auflaufbremse | Freizeit | Schmale Achse mit Trommelbremsen |
| Wohnmobil-Aufbau | Freizeit | Kastenaufbau ohne Fahrgestell, sehr voluminös |
| Wohnmobil-Alkoven | Freizeit | Abgetrennter Überbau, unförmig und leicht |
| Campinganhänger (Faltcaravan) | Freizeit | Flacher Anhänger mit Klappaufbau |
| Vorzelt-Gestänge (Bund) | Freizeit | Bündel Alurohre, rutscht durch den Greifer |
| Bootsanhänger | Freizeit | Rahmen mit Rollenauflagen und Winde |
| Sportboot-Rumpf (GFK) | Freizeit | Großer Kunststoffrumpf, splittert statt zu beulen |
| Ruderboot (Alu) | Freizeit | Kleines Alu-Boot, sehr leicht, verwindet sich |
| Kajütboot-Aufbau | Freizeit | Abgeschnittener Bootsaufbau mit Fenstern |
| Jetski | Freizeit | Kompakter Kunststoffkörper mit Motor, überraschend schwer |
| Quad | Freizeit | Kleines Vierradfahrzeug, kompakt und greifbar |
| Golfwagen | Freizeit | Leichtes Elektrofahrzeug mit Dach und Batteriekasten |
| Motorroller (komplett) | Freizeit | Kleines Zweirad, leicht genug zum Werfen |
| Schneemobil | Freizeit | Kette und Kufen, ungewöhnliche Form |
| Wohnwagen-Kühlschrank (Absorber) | Freizeit | Kleines Gerät mit Kühlrippen, viel Blech |

# 5 Fahrzeugschrott (26)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Kleinwagen-Karosserie | Fahrzeug | Kleiner als das vorhandene Auto, leicht, wird zum Wurfobjekt |
| Kombi-Karosserie | Fahrzeug | Länger als die Limousine, schlechter zu balancieren |
| SUV-Karosserie | Fahrzeug | Hoch und schwer, kippt beim Greifen zur Seite |
| Transporter-Kastenwagen | Fahrzeug | Großer Blechkasten, viel Volumen, wenig Dichte |
| Pritschenwagen-Fahrgestell | Fahrzeug | Rahmen mit Achsen ohne Aufbau |
| Ausgebranntes Fahrzeug | Fahrzeug | Nackte Karosse ohne Scheiben und Innenraum, leichter und spröder |
| Unfallfahrzeug (Front eingedrückt) | Fahrzeug | Schon verformt, liegt anders im Greifer |
| Kleinbus | Fahrzeug | Zwischen Transporter und Bus, hoch und lang |
| Reisebus-Heckteil | Fahrzeug | Abgetrennter Busabschnitt mit Motorraum |
| Sattelauflieger-Chassis | Fahrzeug | Sehr langer Rahmen mit Achsaggregat, kaum zu balancieren |
| Kofferauflieger-Seitenwand | Fahrzeug | Riesige flache Sandwichplatte |
| Kipper-Mulde | Fahrzeug | Stahlmulde vom Kipper, groß und robust |
| Tankauflieger-Segment | Fahrzeug | Abgeschnittener Alutank, rollt |
| Autotransporter-Rampen | Fahrzeug | Gelochte Stahlrampen, lang und flach |
| Anhänger (Einachs, Plane) | Fahrzeug | Kleiner Anhänger mit Gestänge |
| Reifenstapel (Pkw) | Fahrzeug | Fünf Reifen aufeinander, federt und rollt |
| Reifenstapel (LKW) | Fahrzeug | Große Reifen, schwerer und störrischer |
| Felgenstapel (Stahl) | Fahrzeug | Gestapelte Stahlfelgen, verkanten ineinander |
| Motorblock (V8, ausgebaut) | Fahrzeug | Kompakter Gussblock, sehr dicht |
| Automatikgetriebe | Fahrzeug | Glockenform, unhandlich zu greifen |
| Hinterachse mit Differenzial | Fahrzeug | Achsbrücke mit Kugel in der Mitte |
| Katalysator-Bündel | Fahrzeug | Mehrere Edelstahltöpfe im Bund, wertvoll |
| Stoßfänger-Stapel (Kunststoff) | Fahrzeug | Ineinandergelegte Stoßfänger, sperrig und leicht |
| Motorhauben-Stapel | Fahrzeug | Gestapelte Blechhauben, rutschen auseinander |
| Fahrzeugtüren-Bund | Fahrzeug | Mehrere Türen zusammengebunden |
| Fahrzeug-Sitzbank | Fahrzeug | Polsterbank mit Stahlrahmen, weich und sperrig |

# 6 Bauabbruch (26)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Minibagger (ausgeschlachtet) | Bauabbruch | Kleines Kettenfahrzeug ohne Ausleger |
| Baggerausleger | Bauabbruch | Langer gebogener Stahlkasten, unhandlich |
| Baggerlöffel | Bauabbruch | Schwere Schale mit Zähnen, kompakt |
| Radlader-Schaufel | Bauabbruch | Breite Schaufel mit Schneide |
| Raupenlaufwerk-Ketten (Bund) | Bauabbruch | Aufgerollte Stahlketten, extrem schwer |
| Vibrationswalze (Bandage) | Bauabbruch | Massiver Stahlzylinder, rollt unaufhaltsam |
| Turmdrehkran-Mastschuss | Bauabbruch | Gitterturmsegment, groß und trotzdem leicht |
| Turmdrehkran-Ausleger | Bauabbruch | Sehr langes Gitterteil, biegt sich beim Anheben |
| Kranballast-Platten | Bauabbruch | Betonplatten mit Aufhängung, sehr schwer |
| Betonmischer-Trommel | Bauabbruch | Große Trommel mit Innenschnecke |
| Baustellencontainer (Mannschaft) | Bauabbruch | Container mit Fenstern und Heizung |
| Bauwagen (alt, Holz) | Bauabbruch | Holzaufbau auf Achse, morsch und leicht |
| Gerüstrahmen (Bund) | Bauabbruch | Bündel Alurahmen, rutschig |
| Gerüstbohlen (Stapel) | Bauabbruch | Holzbohlen im Stapel |
| Stahlstütze (ausziehbar) | Bauabbruch | Lange dünne Rohre, einzeln fast nicht greifbar — nur im Bund |
| Stahlstützen-Bund | Bauabbruch | Zwanzig Stützen zusammengebunden |
| Betonfertigteil-Wand | Bauabbruch | Große flache Platte mit Bewehrungsschlaufen |
| Betontreppenlauf | Bauabbruch | Treppenelement, schwer und unsymmetrisch |
| Hohlkammerdecke (Element) | Bauabbruch | Lange Betondecke, bricht beim Fallenlassen |
| Betonrohr (Kanal) | Bauabbruch | Dickes kurzes Rohr, rollt |
| Schachtring | Bauabbruch | Betonring, stapelbar, rollt auf der Kante |
| Dachstuhl-Binder | Bauabbruch | Holzfachwerk, groß und leicht, verhakt sich sofort |
| Fensterfront (Pfosten-Riegel) | Bauabbruch | Große Alu-Glas-Fassade, klirrt beim Absetzen |
| Bauzaun-Felder (Stapel) | Bauabbruch | Gitterfelder im Stapel, rutschen |
| Absperrgitter (Bund) | Bauabbruch | Bündel Stahlgitter |
| Schuttcontainer (Absetzmulde) | Bauabbruch | Offene Mulde, groß, gut stapelbar |

# 7 Gebäudetechnik aus Spezialabbrüchen (20)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Aufzugskabine | Gebäudetechnik | Stahlkasten mit Tür, sauber quaderförmig |
| Aufzugs-Antriebsmaschine | Gebäudetechnik | Motor mit Treibscheibe, klein und bleischwer |
| Aufzugs-Gegengewicht | Gebäudetechnik | Rahmen mit Gewichtsplatten, extrem dicht |
| Rolltreppen-Segment | Gebäudetechnik | Fachwerk mit Stufenband, sehr lang und schwer |
| Rolltreppen-Stufenband | Gebäudetechnik | Kette aus Alustufen, hängt durch |
| Großklimagerät (Dach) | Gebäudetechnik | Riesiger Blechkasten, viel Luft |
| Rückkühler (Dachaufbau) | Gebäudetechnik | Lamellenblock mit Ventilatoren |
| Fassadenelement (Metall) | Gebäudetechnik | Große Kassette, flach und leicht |
| Glasfassaden-Element | Gebäudetechnik | Rahmen mit Verbundglas, gefährlich beim Fallen |
| Tankstellen-Zapfsäule | Gebäudetechnik | Schmaler hoher Kasten mit Schläuchen |
| Tankstellen-Erdtank | Gebäudetechnik | Sehr großer liegender Stahltank |
| Tankstellen-Dachkonstruktion | Gebäudetechnik | Weit auskragendes Stahldach |
| Supermarkt-Kühlregal | Gebäudetechnik | Langes Möbel mit Technik im Sockel |
| Supermarkt-Kassentheke | Gebäudetechnik | Theke mit Band, sperrig und leicht |
| Kühlhaus-Paneele (Stapel) | Gebäudetechnik | Sandwichplatten, groß und leicht |
| Werkstatt-Hebebühne | Gebäudetechnik | Zwei Säulen mit Tragarmen, kopflastig |
| Autohaus-Schaufensterrahmen | Gebäudetechnik | Großer Alurahmen |
| Krankenhaus-Sterilisator | Gebäudetechnik | Edelstahlkammer mit Tür, sehr schwer |
| Schul-Heizkesselanlage | Gebäudetechnik | Gliederkessel aus Guss, kompakt und dicht |
| Parkhaus-Schrankenanlage | Gebäudetechnik | Säule mit Ausleger, leicht |

# 8 Luftfahrt (16)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Kleinflugzeug (komplett) | Luftfahrt | Ganzes Flugzeug ohne Flügel, sehr leicht für die Größe |
| Flugzeug-Seitenleitwerk | Luftfahrt | Große flache Fläche, fängt beim Schwenken den Wind |
| Flugzeug-Höhenleitwerk | Luftfahrt | Zwei schmale Flächen am Stück |
| Flugzeug-Fahrwerksbein | Luftfahrt | Massive Strebe mit Rädern, extrem dicht |
| Strahltriebwerk (ausgebaut) | Luftfahrt | Zylinder mit Schaufelkranz, sehr schwer |
| Triebwerksverkleidung | Luftfahrt | Zwei Halbschalen, groß und federleicht |
| Propeller (Metall) | Luftfahrt | Sternform, verhakt sich in allem |
| Hubschrauber-Zelle | Luftfahrt | Kanzel mit Rahmen, unförmig |
| Hubschrauber-Heckausleger | Luftfahrt | Langes dünnes Rohr mit Leitwerk |
| Rotorkopf | Luftfahrt | Kompaktes Gelenkstück, klein und bleischwer |
| Rotorblätter (Bund) | Luftfahrt | Sehr lange schmale Blätter im Bund |
| Flughafen-Gepäckwagen | Luftfahrt | Offener Wagen mit Plane, leicht und rollend |
| Cateringwagen-Aufbau | Luftfahrt | Kastenaufbau mit Hubwerk |
| Flughafen-Schleppfahrzeug | Luftfahrt | Flaches schweres Fahrzeug, sehr dicht |
| Luftfracht-Container (ULD) | Luftfahrt | Schräger Alucontainer, unverwechselbare Form |
| Fluggasttreppe | Luftfahrt | Treppe auf Fahrgestell, hoch und kippelig |

# 9 Schienenverkehr (18)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Rangierlok (ausgeschlachtet) | Schiene | Kompaktes schweres Fahrzeug, das schwerste Einzelteil auf dem Platz |
| Lokomotiv-Führerstand | Schiene | Abgetrennte Kabine mit Fenstern |
| Diesellok-Motorblock | Schiene | Riesiger Motorblock, extrem dicht |
| Personenwaggon-Kasten | Schiene | Sehr langer Wagenkasten, kaum zu balancieren |
| Güterwaggon-Boden | Schiene | Lange Stahlplattform mit Längsträgern |
| Kesselwagen-Kessel | Schiene | Großer liegender Kessel, rollt |
| Schiebewand-Waggon-Seitenteil | Schiene | Große Blechwand mit Laufschienen |
| Straßenbahn-Wagenkasten | Schiene | Kürzer als der Waggon, mit Fensterband |
| U-Bahn-Wagen-Drehgestell (angetrieben) | Schiene | Drehgestell mit Motoren, noch schwerer als das vorhandene |
| Radsatz (Eisenbahn) | Schiene | Achse mit zwei Rädern, rollt sofort weg |
| Eisenbahn-Puffer (Paar) | Schiene | Zwei Pufferteller, klein und sehr dicht |
| Schienenbündel | Schiene | Mehrere Schienen zusammengebunden, sehr lang |
| Weichenzunge | Schiene | Lange schmale Schiene mit Antriebsteil |
| Prellbock | Schiene | Massiver Stahlbock, kompakt |
| Oberleitungsmast | Schiene | Gittermast, lang und leicht |
| Signalmast mit Schirm | Schiene | Mast mit Auslegern, verhakt sich |
| Bahnschwellen (Betonstapel) | Schiene | Stapel Betonschwellen, sehr schwer |
| Bahnschwellen (Holzstapel) | Schiene | Ölige Holzschwellen, rutschen |

# 10 Hafen und Schifffahrt (14)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Seecontainer 40 Fuß | Hafen | Doppelt so lang wie der 20-Fuß, kaum zu balancieren |
| Containerstapel (drei hoch) | Hafen | Drei Container am Stück, sehr hoch |
| Kühlcontainer | Hafen | Container mit Aggregat an der Stirnseite |
| Schiffsmotor (Diesel) | Hafen | Sehr großer Motorblock, extrem dicht |
| Schiffsschraube | Hafen | Bronzepropeller, schwer und wertvoll |
| Ruderblatt | Hafen | Große Stahlflosse mit Schaft |
| Ankerkette (Haufen) | Hafen | Schwerer Kettenhaufen, fließt beim Greifen auseinander |
| Stockanker | Hafen | Unverwechselbare Form, verhakt sich überall |
| Bootsrumpf (Stahl) | Hafen | Stahlrumpf mit Spanten, schalenförmig |
| Poller | Hafen | Gusspoller, klein und bleischwer |
| Hafenkran-Ausleger | Hafen | Sehr langer Gitterausleger |
| Reachstacker-Spreader | Hafen | Breiter Rahmen mit Verriegelungen |
| Ponton-Segment | Hafen | Schwimmkörper aus Stahl, groß und hohl |
| Schiffsluke (Deckel) | Hafen | Große flache Stahlplatte mit Verstärkungen |

# 11 Lose Schrottmaterialien (16)

| Objekt | Kategorie | Beschreibung |
|---|---|---|
| Bauschutthaufen | Lose | Loser Haufen gemischter Brocken |
| Betonbrocken (bewehrt) | Lose | Einzelbrocken mit herausstehendem Stahl, verhakt sich |
| Ziegelhaufen | Lose | Haufen roter Ziegel, rieselt |
| Asphaltbrocken | Lose | Flache Platten, schieben sich übereinander |
| Natursteinblock | Lose | Großer unregelmäßiger Block |
| Felsbrocken | Lose | Sehr großer Stein, nur zu schieben |
| Schotterhaufen | Lose | Rieselt durch jeden Greifer |
| Kieshaufen | Lose | Feiner als Schotter, fließt |
| Sandhaufen | Lose | Fließt vollständig, nur mit Schaufel zu fassen |
| Erdaushub-Haufen | Lose | Klumpig, bleibt im Greifer hängen |
| Holzbruch-Haufen | Lose | Bretter und Balken durcheinander, sperrig |
| Mischschrott-Haufen | Lose | Loser Haufen aus allem, was übrig bleibt |
| Stahlteile-Haufen | Lose | Verhakte Stahlreste |
| Metallpaket (gepresst) | Lose | Würfel aus gepresstem Blech, kompakt und schwer |
| Reifenhaufen | Lose | Reifen durcheinander, federt und rollt |
| Schrottschere-Abschnitte | Lose | Kurze gleichmäßige Abschnitte, dicht gepackt |

---

# Besonders empfehlenswerte neue Objekte

Dreißig Stück, ausgewählt danach, was am Bagger **anders** ist als alles, was
schon im Pool liegt.

1. **Mähdrescher-Schneidwerk** — das breiteste Teil überhaupt; zwingt zum
   Drehen des Oberwagens statt zum bloßen Heben.
2. **Futtermischwagen-Mischschnecke** — eine Form, die es im Spiel noch nicht
   gibt; liegt in keiner Lage ruhig.
3. **Grubber mit Zinkenfeld** — verhakt sich absichtlich im Haufen und macht
   das Herausziehen zur Aufgabe.
4. **Wohnwagen (komplett)** — riesig und fast gewichtslos: das Gegenstück zum
   Motorblock, lehrt den Unterschied zwischen groß und schwer.
5. **Wohnwagen-Chassis** — was nach dem Wohnwagen übrig bleibt; zwei Objekte
   aus einer Geschichte.
6. **Seecontainer 20 Fuß** — stapelbar, klar erkennbar, sofort als Maßstab
   lesbar.
7. **Containerstapel (drei hoch)** — hoch, kippelig, und ein Fehlgriff ist
   sichtbar.
8. **Rangierlok (ausgeschlachtet)** — das schwerste Einzelstück; Ziel für den
   voll ausgebauten Bagger.
9. **Radsatz (Eisenbahn)** — rollt sofort weg, sobald man ihn falsch absetzt.
10. **Ankerkette (Haufen)** — fließt beim Greifen auseinander; Verhalten, das
    im Pool noch komplett fehlt.
11. **Sandhaufen** — nur mit der Schaufel zu fassen, nicht mit der Spinne;
    macht den Radlader wichtig.
12. **Schotterhaufen** — rieselt durch den Greifer und belohnt das richtige
    Werkzeug.
13. **Aufzugs-Gegengewicht** — klein und extrem dicht; überrascht jeden, der
    nach Größe schätzt.
14. **Rolltreppen-Segment** — sehr lang, sehr schwer, muss eingefädelt werden.
15. **Strahltriebwerk** — hoher Wert, hohe Dichte, unverwechselbare Silhouette.
16. **Propeller (Metall)** — sternförmig; verhakt sich in allem und sieht im
    Haufen sofort erkennbar aus.
17. **Kleinflugzeug (komplett)** — Sonderauftrag mit Wiedererkennungswert.
18. **Vibrationswalze (Bandage)** — rollt unaufhaltsam; ein Objekt, das den
    Platz in Bewegung bringt.
19. **Turmdrehkran-Mastschuss** — groß, aber Gitter: viel Luft, wenig Gewicht.
20. **Betonfertigteil-Wand** — flach und schwer, nur an der Kante zu fassen.
21. **Hohlkammerdecke** — bricht beim Fallenlassen und bestraft grobes
    Arbeiten.
22. **Dachstuhl-Binder** — Holzfachwerk, das sich im Haufen sofort verkeilt.
23. **Reifenstapel (LKW)** — federt, rollt und ist nichts wert; gute
    Störgröße.
24. **Matratzenstapel** — federt beim Greifen zurück; einziges weiches Objekt
    im ganzen Pool.
25. **Sofa (Dreisitzer)** — groß, leicht, nirgends sauber zu fassen.
26. **Sattelauflieger-Chassis** — extrem lang, kaum zu balancieren.
27. **Kipper-Mulde** — offene Schale, in die anderer Schrott hineinfällt.
28. **Gitterbox-Stapel** — stapelbar und kippgefährdet zugleich.
29. **Metallpaket (gepresst)** — zeigt das Ergebnis der eigenen Presse als
    handelbares Objekt.
30. **Ausgebranntes Fahrzeug** — dieselbe Grundform wie das vorhandene Auto,
    aber leichter und spröder; erzählt eine Geschichte ohne neue Mechanik.
