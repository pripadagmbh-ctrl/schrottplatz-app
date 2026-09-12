# Grafik — Vorschläge (12.09.2026)

Anlass: „Die neuen Teile sehen alle wie Würfel aus, das macht die Vielfalt der
Objekte unnötig, wenn sie nicht erkennbar sind."

Stimmt, und der Grund ist kein Versehen an einer Stelle, sondern die Struktur.

## Befund

| | |
|---|---|
| Objekte im neuen Katalog mit `kind: "box"` | **189 von 221** |
| mit `kind: "cyl"` | 29 |
| mit `kind: "wire"` | 3 |
| Meshes in der Szene | 1071 |
| Dreiecke | 59 900 |
| verschiedene Geometrien | 999 |
| verschiedene Materialien | 296 |
| Bildzeit auf dem iPad (Messung 11.09.) | 2,62 von 16,7 ms = **16 %** |

Ein `box` wird in `spawnScrap` zu `new THREE.BoxGeometry(w, h, d)` — ein
nackter Quader. Die Farbe kommt aus der **Fraktion**, nicht aus dem Objekt:
Alles aus Stahl ist derselbe Braunton. Ein Kühlschrank, eine Traktorkabine und
ein Motorblock unterscheiden sich also in Kantenlängen und sonst in nichts.

Zwei Dinge sind dabei wichtig:

1. **Es ist reichlich Luft.** 16 Prozent des Bildbudgets sind belegt. Grafik
   darf hier dreimal so teuer werden, bevor es weh tut.
2. **Die Technik ist im Haus.** `formeKarosserie` in `dismantle/composites.ts`
   verschiebt die Eckpunkte eines Quaders, bis daraus eine Autokarosserie
   wird — ohne neue Geometrie, ohne Datei, und die Beul-Mechanik rechnet
   danach unverändert weiter. `CanvasTexture` wird schon an drei Stellen
   benutzt (Bagger, Instrumente, Muldenschilder). Beides ließe sich auf den
   Schrott anwenden.

---

## S1 — Bauteile statt Quader

**Die größte Wirkung pro Aufwand.** Ein Objekt ist nicht mehr *ein* Quader,
sondern zwei bis fünf Grundkörper in einer Gruppe:

- Kühlschrank = Korpus + eingelassene Tür + Griffleiste
- Traktorkabine = Kasten + vier Ecksäulen + flaches Dach + Auspuffrohr
- Gitterbox = zwölf Kanten aus dünnen Balken statt einer Kiste
- Elektromotor = Zylinder + Klemmkasten + Fußplatte + Wellenstumpf
- Seecontainer = Kasten + Rippenprofil + zwei Türflügel

Erkennbarkeit entsteht fast vollständig aus **Silhouette plus ein, zwei
Merkmalen**. Mehr braucht es nicht.

**Kosten:** Damit die Zeichenlast nicht mitwächst, werden die Grundkörper
einmal beim Bauen zu **einer** Geometrie verschmolzen
(`BufferGeometryUtils.mergeGeometries`). Dann kostet ein Objekt aus fünf
Teilen genau so viele Zeichenrufe wie heute: einen. Der Kollider bleibt
unverändert der Quader — Physik und Aussehen sind ohnehin getrennt.

**Nötige Änderung:** ein optionales Feld an `PileSpec`, etwa
`bau?: "kuehlschrank" | "kabine" | "gitterbox" | …`, das auf eine
Bau-Funktion zeigt. Ohne Feld bleibt alles wie bisher — die 78 alten Einträge
werden nicht angefasst.

---

## S2 — Formgeber auf dem Quader

Was bei der Karosserie funktioniert, funktioniert überall: die Eckpunkte des
Quaders verschieben, statt neue Geometrie zu bauen.

- **Verjüngung** — oben schmaler als unten (Behälter, Trichter, Kabinen)
- **Abschrägung** — eine Kante gebrochen (Hauben, Schaufeln, Keile)
- **Dachneigung** — First in der Mitte (Container, Häuschen)
- **Bauchung** — Flächen leicht nach außen (Tanks, Fässer)
- **Verwindung** — ein Ende gegen das andere gedreht (verbogene Bleche)

Kostet zur Laufzeit **nichts**: Die Verschiebung passiert einmal beim Anlegen
der Geometrie. Lässt sich mit S1 kombinieren und wäre auch allein schon ein
sichtbarer Gewinn.

---

## S3 — Farbe je Objekt statt je Fraktion

**Am billigsten von allem, und man sieht es sofort.** Heute bestimmt die
Fraktion die Farbe; deshalb ist der halbe Platz braun.

In Wirklichkeit ist Schrott **lackiert**: roter Traktor, blauer Container,
gelbe Baumaschine, weiße Haushaltsgeräte, grüne Landmaschine. Ein optionales
`farbe` am Spec genügt; ohne Angabe gilt weiter die Fraktionsfarbe.

Dazu eine kleine Streuung je Stück (gibt es für Kabel schon über `colorFor`),
damit nicht zwanzig identisch rote Traktorteile herumliegen.

Der Einwand liegt auf der Hand: Das Farbleitsystem der Fraktionen geht damit
verloren. Antwort: Es steht ohnehin an den Mulden, und die Sortierung
funktioniert über die Beschriftung, nicht über den Farbton eines Teils im
Haufen.

---

## S4 — Gebrauchsspuren

Neuer Schrott gibt es nicht. Drei Mittel, alle prozedural:

- **Beulen** — die Eckpunkte leicht verrauschen, je nach Masse verschieden
  stark. Ein Blech ist zerbeult, ein Motorblock nicht.
- **Rost** — ein zweiter, dunkler Materialanteil an den unteren Flächen; die
  Beul-Mechanik der Karosserie zeigt, dass das funktioniert.
- **Kantenabrieb** — Kanten leicht heller, weil dort die Farbe ab ist.

---

## S5 — Prozedurale Texturen

Im Projekt gibt es keine einzige Bilddatei, und das soll so bleiben —
`CanvasTexture` wird aber schon benutzt. Vier Muster würden den halben Platz
abdecken:

- **Riffelblech** — Bühnen, Trittflächen, Laderampen
- **Wellblech** — Hallenwände, Silosegmente, Containerseiten
- **Lochblech** — Gitterboxen, Regale, Verkleidungen
- **Rost und abblätternder Lack** — alles Alte

Erzeugt beim Start, ohne Dateien, ohne Rechtefragen. Eine Textur lässt sich
über viele Objekte teilen — das reduziert sogar die heute 296 verschiedenen
Materialien.

---

## S6 — Licht und Schatten

Aktuell: ein Himmelslicht, eine Sonne, weiche Schattenkarte. Was fehlt und
viel für den Eindruck „fest und schwer" tut:

- **Kontaktschatten** — der dunkle Saum direkt unter einem Teil. Ohne ihn
  wirkt alles, als schwebe es knapp über dem Boden, selbst wenn es aufliegt.
- **Tonwertkurve** (`ACESFilmicToneMapping`) — Metall bekommt Glanzlichter
  statt ausgefressener weißer Flächen.
- **Schattenauflösung nah am Bagger** höher als weit weg.

Das wirkt auf **alles** gleichzeitig, auch auf Gebäude, Fahrzeuge und Gelände
— und ist unabhängig von den Objekten.

---

## S7 — Lesbarkeit im Haufen

Ein Schrotthaufen ist optisch ein Brei. Zwei Mittel:

- **Umrisse** — dünne dunkle Kanten (`EdgesGeometry`) auf großen Teilen.
  Trennt Objekte im Haufen sichtbar voneinander.
- **Helligkeit gegen den Boden** — der Platz ist grau, viel Schrott ist grau.
  Eine leichte Aufhellung der Objekte trennt sie vom Untergrund.

---

## Was ich zuerst machen würde

| Reihenfolge | Schritt | Aufwand | Wirkung |
|---|---|---|---|
| 1 | **S3 Farbe je Objekt** | klein | sofort sichtbar, betrifft alle 299 Objekte |
| 2 | **S6 Licht und Kontaktschatten** | klein | wirkt auf den ganzen Platz, nicht nur auf Schrott |
| 3 | **S1 Bauteile statt Quader** | groß | löst das eigentliche Problem |
| 4 | **S2 Formgeber** | mittel | verstärkt S1, kostet zur Laufzeit nichts |
| 5 | **S4 Gebrauchsspuren** | mittel | macht aus Neuware Schrott |
| 6 | **S5 Texturen** | mittel | Oberfläche statt Farbfläche |
| 7 | **S7 Umrisse** | klein | erst sinnvoll, wenn die Formen stimmen |

S3 und S6 zusammen sind ein halber Tag und ändern den Eindruck des ganzen
Platzes. S1 ist die eigentliche Arbeit: rund zwanzig Bau-Funktionen decken die
189 Quader ab, weil sich vieles teilt — Kasten mit Tür, Kasten mit Rahmen,
Zylinder mit Anbau, Rahmen aus Kanten, Platte mit Sicken.

**Vorschlag zum Vorgehen:** Bevor ich zwanzig Bau-Funktionen schreibe, baue
ich drei Objekte in drei Stufen — nackter Quader, Quader mit Formgeber,
zusammengesetzt — und rendere sie nebeneinander. Dann ist in einer Minute
entschieden, wie weit es gehen soll, statt nach zwei Tagen.
