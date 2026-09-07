# Browsermessung Prototyp — Desktop (Claude-Browser)

Datum: 02.09.2026 · Durchgeführt von Claude im Browser-Pane des Desktops
Build: GitHub-Pages-Fassung (Produktionsbuild, `window.__game` daher nicht verfügbar)
URL: https://pripadagmbh-ctrl.github.io/schrottplatz-app/

## Messverfahren

Da der Produktionsbuild keine Debug-Schnittstelle hat, wurde von außen gemessen:
- **Bildzeit** über `requestAnimationFrame`-Abstände, Median aus je 60–110 Bildern.
- **Zeichenaufrufe** durch Patchen von `drawElements`/`drawArrays`(`Instanced`) auf
  `WebGL2RenderingContext.prototype` — zählt alle Aufrufe pro Bild, inklusive Schattenpass.

Hardware: Intel HD Graphics 5500 (integrierte Grafik, Baujahr ~2015), Windows.
Das ist **schwächer als ein aktuelles Mittelklasse-Handy bei der Grafik**, aber mit einer
deutlich stärkeren CPU. Beides ist beim Deuten der Zahlen zu beachten.

## Messung 1 — Auflösungsabhängigkeit

| Zeichenfläche | Pixel | Bildzeit (Median) | fps | Zeichenaufrufe/Bild |
|---|---|---|---|---|
| 460 × 606 | 279 000 | 35,6 ms | **28,1** | 1 781 |
| 1100 × 800 | 880 000 | 53,5 ms | **18,7** | 2 355 |

Dreifache Pixelzahl kostet nur 50 % mehr Zeit. Grob aufgeteilt (lineares Modell):
**rund 27 ms fester Anteil pro Bild, unabhängig von der Auflösung**, plus etwa 8 ms
Pixelkosten bei der kleinen Fläche.

**Deutung:** Das Spiel ist nicht in erster Linie durch die Grafikleistung begrenzt,
sondern durch den festen Aufwand pro Bild — im Wesentlichen das Absetzen von fast
zweitausend Zeichenaufrufen plus Szenendurchlauf und Physik. Genau dieser Anteil
verschwindet nicht, wenn man die Auflösung senkt: Der übliche Mobil-Reflex
("Render-Scale runter") bringt hier fast nichts.

**Das bestätigt den QA-Befund A2 §5 mit einer echten Messung:** 3 139 Meshes,
1 281 Schattenwerfer, kein Instancing. Die gezählten 1 781 Aufrufe sind der sichtbare
Ausschnitt davon plus Schattenpass.

## Messung 2 — Anstieg während des Spielens

Beobachtet über eine laufende Sitzung ohne Eingriff (Anlieferungen kommen von selbst):

| Zeitpunkt | Zeichenaufrufe/Bild | Bildzeit |
|---|---|---|
| kurz nach Start | 1 781 | 35,6 ms |
| einige Minuten später | 2 355 | 53,5 ms |
| noch später | 3 795 | 117,2 ms |

(Die dritte Zeile ist durch eine Vergrößerung des Fensters mitbeeinflusst; die Tendenz
ist trotzdem eindeutig und wird in einer sauberen Reihe mit festem Fenster nachgemessen.)

**Deutung:** Der Platz füllt sich, jedes abgeladene Teil ist ein eigenes Mesh mit eigener
Geometrie, eigenem Material und eigenem Schattenwurf. Die Last wächst also mit der
Spielzeit — genau das Muster hinter „iPad wird warm" und „könnte flüssiger laufen".
Das deckt sich mit A2 §4 (M3: unbegrenztes Wachstum, Bündelung greift nur bei ≤ 45 kg)
und A2 §4 (M1: nur ein einziges `dispose()` im ganzen Projekt).

## Vorläufiges Fazit

Der Engpass ist **die Anzahl der gezeichneten Objekte**, nicht die Physik und nicht die
Pixel. Das ist eine gute Nachricht, weil dieser Posten mit bekannten Mitteln um eine
Größenordnung sinkt:

1. Statische Geometrie zusammenführen (allein die Betonlego-Umrandung sind ~1 530 Meshes,
   `yard.ts:587-612`) → 3 Meshes.
2. Schrottteile nach Form-Typ als `InstancedMesh` → statt N Aufrufen einer pro Typ.
3. Schattenwurf auf Bagger, Fahrzeuge und Karossen begrenzen (heute 1 281 Werfer).
4. Die sechs Flutlicht-Spots bei Tag unsichtbar schalten (sie kosten im Shader auch mit
   Intensität 0).
5. Harte Obergrenze für lose Teile plus `dispose()` beim Entfernen.

Realistische Erwartung nach diesen fünf Punkten: **unter 300 Zeichenaufrufe pro Bild**.
Das ist der Bereich, in dem Mobilgeräte komfortabel arbeiten.

## Bedeutung für die Engine-Entscheidung

Unity erledigt Punkt 1–3 weitgehend automatisch (Static Batching, GPU Instancing,
SRP Batcher). In Three.js ist es Handarbeit, aber es ist **bekannte, abgegrenzte Handarbeit
von ein bis zwei Wochen** — kein Forschungsprojekt. Die Messung spricht damit weder klar
für noch klar gegen einen Engine-Wechsel; sie sagt vor allem: Wer im Web-Stack bleibt,
muss diese fünf Punkte machen, bevor er irgendetwas anderes baut.

---

## Messung 3 — Touch-Layout auf iPhone-mini-Format (760 × 375, Touch emuliert)

Der Browser wurde als Touch-Gerät emuliert (`pointer: coarse`, 5 Berührungspunkte), damit
`core/touch.ts:73` die Bedienoberfläche aufbaut. Alle Kästen per `getBoundingClientRect()`
gemessen, in CSS-Pixeln des emulierten Fensters.

### Gemessene Bedienelemente

| Element | Position (x, y) | Größe | Bemerkung |
|---|---|---|---|
| Stick links | 10, 253 | 112 × 112 | klebt am linken Rand, **keine Safe-Area** |
| Fahrkreuz ▲▼◀▶ | 128–268, 233–367 | je 52 × 56 | in der Bildmitte-links, **dritter Finger nötig** |
| Rotator ↺ ↻ | 508, 566 / 295 | je 62 × 66 | in der Bildmitte-rechts, **dritter Finger nötig** |
| Stick rechts | 638, 253 | 112 × 112 | |
| Funktionswalze | 666, 100 | 88 × 176 | |

### Belegte Überlappungen

| Konflikt | Fläche | Bewertung |
|---|---|---|
| **Funktionswalze × Stick rechts** | 84 × 23 px | **echter Bedienkonflikt** — beide nehmen Eingaben an. Das ist dein „Schaltflächen überlappen sich". |
| **Knopf SCHERE × Stick rechts** | 90 × 19 px | ebenso |
| Tutorialkarte × Stick links | 112 × 112 px (vollständig) | Karte hat `pointer-events: none`, blockiert also **nur die Sicht**, nicht die Eingabe. Man bedient den Stick blind. |
| Tutorialkarte × Fahrkreuz | 4 × 52 × 56 px | ebenso |
| Fahrkreuz ▲/▼ × ◀/▶ | 8 × 17 px | die Kreuzarme überlappen sich gegenseitig |
| Kontozeile × Toast-Meldung | 41 × 5 px | kosmetisch |

**Korrektur zum UX-Review A4:** Die Tutorialkarte hat *nicht* `pointer-events: auto` — sie
verdeckt den Stick, blockiert ihn aber nicht. Der Befund bleibt trotzdem gültig, nur die
Begründung ändert sich von „unbedienbar" zu „unsichtbar".

**Bestätigt:** Keine Safe-Area-Ränder (Stick bei x = 10). Auf einem iPhone im Querformat
liegt dort die Notch beziehungsweise das Kameraloch.

## Messung 4 — Ab wann bremst die Spinne? (aus der Geometrie gerechnet)

Aus `excavator/clawGeometry.ts` (Sennebogen MG4.1, die eine Wahrheit für Mesh und Kollider)
und `excavator/collision.ts`:

| Größe | Wert |
|---|---|
| Krallenspitze bei ganz offener Spinne | 2,01 m unter dem Kardangelenk, Radius 1,69 m |
| Pflügsonde (`PLOW_R`) | Kugel mit 1,45 m Radius, Mittelpunkt 1,35 m unter dem Greiferknoten |
| Reichweite der Sonde nach unten | bis 2,80 m unter dem Knoten |

**Die Sonde reicht 79 cm tiefer als die Krallenspitzen.**

Damit zählt beim Absenken bereits Material als „verdrängt", das noch fast einen Meter
unter der offenen Spinne liegt. Der daraus errechnete Faktor bremst **alle Achsen**
(`excavator.ts:1022-1023`) auf bis zu 14 % der Normalgeschwindigkeit.

Seitlich stimmt es dagegen: Die Sonde ist mit 1,45 m schmaler als der offene Korb (1,69 m).
Deshalb fühlt sich das Schwenken durch einen Haufen richtig an und das Absenken falsch —
genau die Unterscheidung, die im Gerätetest beschrieben wurde.

**Fix für v2 (klein und präzise):** Sondenmittelpunkt an die Krallenspitzen legen statt
1,35 m unter den Knoten, Radius aus `clawGeometry` ableiten statt frei setzen, und den
Widerstand nur in Bewegungsrichtung zählen (Shape-Cast entlang des Bewegungsvektors).
Damit bremst der Bagger, wenn er pflügt, und nicht, wenn er sich nähert.
